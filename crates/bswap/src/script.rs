//! The BTC side (testnet-first): the P2WSH swap script, its bech32
//! address, and the two witness shapes.
//!
//! **Pattern (cited):** SWAP-SORT §1 row 3 — the adaptor-sig swap's
//! script coin runs a "2-of-2 lock on the SCRIPT coin": the happy path
//! needs BOTH parties' signatures (the leader's claim is completed from
//! the follower's adaptor pre-signature, so the leader's signature alone
//! never moves the coins), and the follower can unilaterally refund after
//! a relative timelock (CSV — BIP 68 relative lock via nSequence, BIP 112
//! opcode, on a P2WSH input). The exact script bytes in BasicSwap's
//! `protocols/xmr_swap_1.py` are UNVERIFIED at this seat (repo not
//! present); this construction stands on its own bytes, asserted by the
//! round-trip tests below.
//!
//! ```text
//! OP_IF
//!     <pk_leader>   OP_CHECKSIGVERIFY
//!     <pk_follower> OP_CHECKSIG
//! OP_ELSE
//!     <csv_blocks>  OP_CHECKSEQUENCEVERIFY OP_DROP
//!     <pk_follower> OP_CHECKSIG
//! OP_ENDIF
//! ```
//!
//! The IF/TRUE path is the 2-of-2 claim; the ELSE path is the follower's
//! refund (nSequence ≥ csv_blocks, nVersion ≥ 2 per BIP 68 — the tx
//! assembler's duty, asserted here as documentation).

use crate::{Error, Result};
use sha2::{Digest, Sha256};

/// OP codes used (values are Bitcoin Script's long-stable opcode bytes).
const OP_IF: u8 = 0x63;
const OP_ELSE: u8 = 0x67;
const OP_ENDIF: u8 = 0x68;
const OP_CHECKSIG: u8 = 0xac;
const OP_CHECKSIGVERIFY: u8 = 0xad;
const OP_CHECKSEQUENCEVERIFY: u8 = 0xb2; // a.k.a. OP_NOP3
const OP_DROP: u8 = 0x75;

/// Build the swap script from 33-byte compressed keys. `pk_leader` is the
/// BTC-side claiming key (Zano holder), `pk_follower` the BTC holder's key
/// (co-signs the claim, alone refunds after `csv_blocks`).
pub fn swap_script(pk_leader: &[u8; 33], pk_follower: &[u8; 33], csv_blocks: u16) -> Vec<u8> {
    let csv = csv_blocks.to_le_bytes(); // script-numbers are little-endian
    let mut s = Vec::with_capacity(41 + 4 + 6);
    s.push(OP_IF);
    s.extend_from_slice(&[33]);
    s.extend_from_slice(pk_leader);
    s.push(OP_CHECKSIGVERIFY);
    s.extend_from_slice(&[33]);
    s.extend_from_slice(pk_follower);
    s.push(OP_CHECKSIG);
    s.push(OP_ELSE);
    // minimal script-number push of the CSV value (uint16, LE, high bit
    // clear for a relative-timelock flag byte of 0 — BIP 68 semantics are
    // the tx assembler's; here we only encode the number)
    if csv[1] == 0 {
        if csv[0] > 16 {
            s.extend_from_slice(&[1]);
            s.push(csv[0]);
        } else {
            s.push(0x50 + csv[0]); /* OP_N */
        }
    } else {
        s.extend_from_slice(&[2]);
        s.extend_from_slice(&csv);
    }
    s.push(OP_CHECKSEQUENCEVERIFY);
    s.push(OP_DROP);
    s.extend_from_slice(&[33]);
    s.extend_from_slice(pk_follower);
    s.push(OP_CHECKSIG);
    s.push(OP_ENDIF);
    s
}

/// The witness program of a P2WSH output: `sha256(script)` (BIP 141).
pub fn witness_program(script: &[u8]) -> [u8; 32] {
    Sha256::digest(script).into()
}

/// The network the address targets. TESTNET is the rehearsal default
/// (founder posture: testnet-only artifacts).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Network {
    Mainnet,
    Testnet,
}

impl Network {
    fn hrp(self) -> &'static str {
        match self {
            Network::Mainnet => "bc",
            Network::Testnet => "tb",
        }
    }
}

/// Bech32 (BIP 173) address of the P2WSH output for `program`
/// (`OP_0 <32-byte program>`). The bech32 DATA carries the witness
/// version as its own single 5-bit group followed by the program
/// converted 8→5 — the two are NOT converted as one byte string (that
/// framing trap is what the round-trip test guards).
pub fn p2wsh_address(program: &[u8; 32], net: Network) -> Result<String> {
    use bech32::{encode, u5, ToBase32, Variant};
    let mut data: Vec<bech32::u5> =
        vec![u5::try_from_u8(0).map_err(|_| Error::Malformed("witness version"))?];
    data.extend(program.to_base32());
    encode(net.hrp(), data, Variant::Bech32).map_err(|_| Error::Malformed("bech32"))
}

/// The happy-path witness stack (script `IF` branch, TRUE):
/// `[leader_sig, follower_sig, <empty vec = TRUE>, script]`. The
/// follower's "signature" is the ADAPTOR-COMPLETED pre-signature — which
/// is why the leader can move the coins only by publishing (and thus
/// revealing) `t`.
pub fn witness_happy(leader_sig: &[u8], follower_sig: &[u8], script: &[u8]) -> Vec<Vec<u8>> {
    vec![
        leader_sig.to_vec(),
        follower_sig.to_vec(),
        vec![],
        script.to_vec(),
    ]
}

/// The refund witness (script `ELSE` branch, FALSE):
/// `[follower_sig, <empty vec = FALSE>, script]`, spendable with
/// `nSequence ≥ csv_blocks` (BIP 68) and `nVersion ≥ 2`.
pub fn witness_refund(follower_sig: &[u8], script: &[u8]) -> Vec<Vec<u8>> {
    vec![follower_sig.to_vec(), vec![], script.to_vec()]
}

/// Decode a bech32 address back to (hrp, program) — the reading half of
/// the round trip (a stranger verifies WHERE the coins went). The first
/// 5-bit group is the witness version (must be 0 for P2WSH); the rest
/// converts back to the 32-byte program.
pub fn decode_address(addr: &str) -> Result<(String, Vec<u8>)> {
    use bech32::{decode, FromBase32, Variant};
    let (hrp, data5, variant) = decode(addr).map_err(|_| Error::Malformed("bech32 decode"))?;
    if variant != Variant::Bech32 {
        return Err(Error::Malformed("bech32m where bech32 expected"));
    }
    if data5.is_empty() || data5[0].to_u8() != 0 {
        return Err(Error::Malformed("witness version"));
    }
    let bytes = Vec::<u8>::from_base32(&data5[1..]).map_err(|_| Error::Malformed("base32"))?;
    Ok((hrp, bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pk(seed: u8) -> [u8; 33] {
        let mut k = [seed; 33];
        k[0] = 0x02; // compressed even-y marker
        k
    }

    #[test]
    fn script_bytes_exact() {
        let a = pk(1);
        let b = pk(2);
        let s = swap_script(&a, &b, 144);
        // hand-assembled expectation, independent of the builder:
        let expect: Vec<u8> = {
            let mut e = vec![OP_IF];
            e.extend([33]);
            e.extend(a);
            e.push(OP_CHECKSIGVERIFY);
            e.extend([33]);
            e.extend(b);
            e.push(OP_CHECKSIG);
            e.push(OP_ELSE);
            e.extend([1, 144]);
            e.push(OP_CHECKSEQUENCEVERIFY);
            e.push(OP_DROP);
            e.extend([33]);
            e.extend(b);
            e.push(OP_CHECKSIG);
            e.push(OP_ENDIF);
            e
        };
        assert_eq!(s, expect);
    }

    #[test]
    fn script_small_csv_uses_op_n() {
        let s = swap_script(&pk(1), &pk(2), 7);
        // CSV 7 pushes as OP_7 (0x57)
        assert!(s.windows(2).any(|w| w == [0x57, OP_CHECKSEQUENCEVERIFY]));
    }

    #[test]
    fn script_large_csv_two_byte_le() {
        let s = swap_script(&pk(1), &pk(2), 400);
        // 400 = 0x0190 little-endian two-byte push
        assert!(s
            .windows(4)
            .any(|w| w == [2, 0x90, 0x01, OP_CHECKSEQUENCEVERIFY]));
    }

    #[test]
    fn bip173_testnet_p2wsh_vector() {
        // BIP 173 reference vector (testnet P2WSH):
        //   tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7
        //   is the bech32 of the witness program decoded below.
        let program: [u8; 32] = hex::decode(
            "1863143c14c5166804bd19203356da136c985678cd4d27a1b8c6329604903262", // TESTNET-ONLY: BIP 173 testnet P2WSH reference vector (public spec fixture)
        )
        .unwrap()
        .try_into()
        .unwrap();
        let addr = p2wsh_address(&program, Network::Testnet).unwrap();
        assert_eq!(
            addr,
            "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7"
        );
    }

    #[test]
    fn address_round_trip() {
        let prog = witness_program(&swap_script(&pk(9), &pk(8), 1008));
        let addr = p2wsh_address(&prog, Network::Testnet).unwrap();
        let (hrp, data) = decode_address(&addr).unwrap();
        assert_eq!(hrp, "tb");
        assert_eq!(&data[..], &prog[..]);
    }

    #[test]
    fn witness_shapes() {
        let s = swap_script(&pk(1), &pk(2), 16);
        let w = witness_happy(b"L", b"F", &s);
        assert_eq!(w.len(), 4);
        assert_eq!(w[2], Vec::<u8>::new()); // TRUE
        assert_eq!(w[3], s);
        let r = witness_refund(b"F", &s);
        assert_eq!(r.len(), 3);
        assert_eq!(r[1], Vec::<u8>::new()); // FALSE
    }
}
