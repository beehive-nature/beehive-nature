//! Graphene binary serialization for the Hive rail.
//!
//! Byte law: u16 `ref_block_num` LE, u32 `ref_block_prefix` LE, u32
//! `expiration` (unix seconds) LE, varint operation count, each operation
//! as varint operation id followed by its body, varint 0 extensions.
//! Transfer (id 2): string from, string to, asset, string memo. Comment
//! (id 1): seven strings (parent_author, parent_permlink, author,
//! permlink, title, body, json_metadata). Assets: int64 thousandths LE,
//! precision byte 3, then the 7-byte legacy symbol — HIVE keeps the
//! legacy bytes `STEEM`, HBD keeps `SBD`.
//!
//! Differentially pinned: the transaction below reproduces the reference
//! bytes and digest computed by @hiveio/dhive 1.3.6 (Hive's own library;
//! vector pinned in `e2e/wallet-hive.mjs` REF and asserted here). The
//! digest is `sha256(chain_id ∥ bytes)` — NOTE: NOT the EOSIO digest
//! (which appends 32 zero bytes; `bnr_keys::chain_digest` would be wrong
//! here by construction). The transaction id is `sha256(bytes)[0..20]`.

use crate::hex;
use sha2::{Digest, Sha256};

/// PUBLIC-CONSTANT: Hive mainnet chain id (beeab0de ‖ 28 zero bytes)
pub const HIVE_CHAIN_ID_HEX: &str =
    "beeab0de00000000000000000000000000000000000000000000000000000000"; // PUBLIC-CONSTANT: Hive mainnet chain id

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HiveSymbol {
    Hive,
    Hbd,
}

impl HiveSymbol {
    /// the 7-byte legacy symbol field: HIVE serializes as `STEEM`, HBD as `SBD`
    fn legacy(self) -> &'static [u8] {
        match self {
            HiveSymbol::Hive => b"STEEM".as_slice(),
            HiveSymbol::Hbd => b"SBD".as_slice(),
        }
    }
    pub fn word(self) -> &'static str {
        match self {
            HiveSymbol::Hive => "HIVE",
            HiveSymbol::Hbd => "HBD",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TransferOp {
    pub from: String,
    pub to: String,
    /// canonical form only ("1" normalizes to "1.000" BEFORE building)
    pub amount: String,
    pub sym: HiveSymbol,
    pub memo: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommentOp {
    pub parent_author: String,
    pub parent_permlink: String,
    pub author: String,
    pub permlink: String,
    pub title: String,
    pub body: String,
    pub json_metadata: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HiveOperation {
    Comment(CommentOp),
    Transfer(TransferOp),
}

impl HiveOperation {
    /// the varint operation id on the wire: comment = 1, transfer = 2
    fn id(&self) -> u8 {
        match self {
            HiveOperation::Comment(_) => 1,
            HiveOperation::Transfer(_) => 2,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UnsignedTrx {
    pub ref_block_num: u16,
    pub ref_block_prefix: u32,
    pub expiration: u32,
    pub operations: Vec<HiveOperation>,
}

/// One amount, one form: "1" and "1.0" are "1.000" — used for the bytes,
/// the broadcast and the words. Zero, more than three decimals, and
/// amounts at or beyond 2^63 thousandths are refused.
pub fn canonical_amount(input: &str) -> Result<String, String> {
    let s = input.trim();
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return Err("amount: empty".into());
    }
    let mut int_part = String::new();
    let mut frac_part: Option<String> = None;
    for &b in bytes.iter() {
        let c = b as char;
        if c == '.' {
            if frac_part.is_some() {
                return Err("amount: more than one decimal point".into());
            }
            frac_part = Some(String::new());
            continue;
        }
        if !c.is_ascii_digit() {
            return Err(format!("amount: not a digit: '{c}'"));
        }
        match &mut frac_part {
            Some(f) => f.push(c),
            None => int_part.push(c),
        }
    }
    if int_part.is_empty() || int_part.len() > 1 && int_part.starts_with('0') {
        return Err("amount: malformed integer part".into());
    }
    let frac = match frac_part {
        None => String::new(),
        Some(f) => {
            if f.len() > 3 {
                return Err("amount: more than three decimals".into());
            }
            f
        }
    };
    let whole: u64 = int_part
        .parse()
        .map_err(|_| "amount: integer part too large".to_string())?;
    let thousandths: u128 = (whole as u128) * 1000
        + format!("{frac:0<3}")
            .parse::<u128>()
            .map_err(|_| "amount: bad fraction".to_string())?;
    if thousandths == 0 {
        return Err("amount: zero".into());
    }
    if thousandths >= (1u64 << 63) as u128 {
        return Err("amount: at or beyond the int64 ceiling".into());
    }
    let w = thousandths / 1000;
    let f = thousandths % 1000;
    Ok(format!("{w}.{f:03}"))
}

/// parse a 64-hex-char chain id into bytes
pub fn chain_id_from_hex(s: &str) -> Result<[u8; 32], String> {
    let v = crate::unhex(s).ok_or("chain id: not hex")?;
    v.try_into()
        .map_err(|_| "chain id: not 32 bytes".to_string())
}

fn varint(out: &mut Vec<u8>, mut n: u64) {
    while n >= 0x80 {
        out.push((n & 0x7f) as u8 | 0x80);
        n >>= 7;
    }
    out.push(n as u8);
}

fn put_str(out: &mut Vec<u8>, s: &str) {
    let b = s.as_bytes();
    varint(out, b.len() as u64);
    out.extend_from_slice(b);
}

fn put_asset(out: &mut Vec<u8>, amount: &str, sym: HiveSymbol) -> Result<(), String> {
    let canon = canonical_amount(amount)?;
    let (w, f) = canon
        .split_once('.')
        .expect("canonical always has 3 decimals");
    let thousandths: u128 = w.parse::<u128>().unwrap() * 1000 + f.parse::<u128>().unwrap();
    for i in 0..8 {
        out.push(((thousandths >> (8 * i)) & 0xff) as u8);
    }
    out.push(3); // precision
    let legacy = sym.legacy();
    for j in 0..7 {
        out.push(if j < legacy.len() { legacy[j] } else { 0 });
    }
    Ok(())
}

/// the canonical serialized transaction bytes (what the id derives from)
pub fn serialize_trx(trx: &UnsignedTrx) -> Result<Vec<u8>, String> {
    if trx.operations.is_empty() {
        return Err("transaction: no operations".into());
    }
    if trx.operations.len() > 100 {
        return Err("transaction: too many operations".into());
    }
    let mut out = Vec::with_capacity(128);
    out.extend_from_slice(&trx.ref_block_num.to_le_bytes());
    out.extend_from_slice(&trx.ref_block_prefix.to_le_bytes());
    out.extend_from_slice(&trx.expiration.to_le_bytes());
    varint(&mut out, trx.operations.len() as u64);
    for op in &trx.operations {
        varint(&mut out, op.id() as u64);
        match op {
            HiveOperation::Transfer(t) => {
                put_str(&mut out, &t.from);
                put_str(&mut out, &t.to);
                put_asset(&mut out, &t.amount, t.sym)?;
                put_str(&mut out, &t.memo);
            }
            HiveOperation::Comment(c) => {
                put_str(&mut out, &c.parent_author);
                put_str(&mut out, &c.parent_permlink);
                put_str(&mut out, &c.author);
                put_str(&mut out, &c.permlink);
                put_str(&mut out, &c.title);
                put_str(&mut out, &c.body);
                put_str(&mut out, &c.json_metadata);
            }
        }
    }
    varint(&mut out, 0); // extensions
    Ok(out)
}

/// the Hive signing digest: sha256(chain_id ∥ bytes) — no zero suffix
/// (that suffix is the EOSIO form; Hive's is the plain concatenation)
pub fn hive_digest(chain_id: &[u8; 32], ser: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(chain_id);
    h.update(ser);
    let out = h.finalize();
    let mut d = [0u8; 32];
    d.copy_from_slice(&out);
    d
}

/// the Hive transaction id: sha256(bytes)[0..20] as hex — the chain's own
/// identity, recomputed from canonical bytes
pub fn hive_txid(ser: &[u8]) -> String {
    let d = Sha256::digest(ser);
    hex(&d[..20])
}

/// sign the digest with a seed key — the eosjs/hive 65-byte recoverable
/// form [31 + recid ‖ r32 ‖ s32], hex-encoded as Hive expects
pub fn sign_hex(seed: &[u8; 32], chain_id: &[u8; 32], ser: &[u8]) -> Result<String, String> {
    let digest = hive_digest(chain_id, ser);
    let payload = bnr_keys::sign_digest65(seed, &digest).map_err(|e| e.to_string())?;
    Ok(hex(&payload))
}

/// the STM-form public key for a seed (EOS-legacy payload, STM prefix)
pub fn stm_pub(seed: &[u8; 32]) -> Result<String, String> {
    let eos = bnr_keys::eos_pub_string(seed).map_err(|e| e.to_string())?;
    Ok(format!("STM{}", &eos[3..]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bnr_keys::sha256_of;

    fn ref_trx() -> UnsignedTrx {
        UnsignedTrx {
            ref_block_num: 12345,
            ref_block_prefix: 3123456789,
            expiration: 1791201600,
            operations: vec![
                HiveOperation::Transfer(TransferOp {
                    from: "loviswater".into(),
                    to: "someoneelse".into(),
                    amount: "1.234".into(),
                    sym: HiveSymbol::Hive,
                    memo: "hi ✓".into(),
                }),
                HiveOperation::Transfer(TransferOp {
                    from: "loviswater".into(),
                    to: "someoneelse".into(),
                    amount: "0.5".into(),
                    sym: HiveSymbol::Hbd,
                    memo: String::new(),
                }),
            ],
        }
    }

    // PUBLIC-CONSTANT: @hiveio/dhive 1.3.6 reference bytes for ref_trx()
    // (pinned in e2e/wallet-hive.mjs REF, computed once by Hive's own library)
    const REF_BYTES: &str = "3930152b2cba4091c36a02020a6c6f76697377617465720b736f6d656f6e65656c7365d20400000000000003535445454d000006686920e29c93020a6c6f76697377617465720b736f6d656f6e65656c7365f40100000000000003534244000000000000"; // PUBLIC-CONSTANT: dhive reference bytes
                                                                                                                                                                                                                                        // PUBLIC-CONSTANT: @hiveio/dhive 1.3.6 reference digest (sha256 of chain id ‖ bytes)
    const REF_DIGEST: &str = "cf26cd0fcc28d3d586d35c2a17bf953539c7c8ba4fbbdce9daf7a48349267278"; // PUBLIC-CONSTANT: dhive reference digest

    #[test]
    fn bytes_equal_hives_own_library() {
        assert_eq!(hex(&serialize_trx(&ref_trx()).unwrap()), REF_BYTES);
    }

    #[test]
    fn digest_equals_hives_own_library() {
        let chain = crate::hive::ser::chain_id_from_hex(HIVE_CHAIN_ID_HEX).unwrap();
        let ser = serialize_trx(&ref_trx()).unwrap();
        assert_eq!(hex(&hive_digest(&chain, &ser)), REF_DIGEST);
    }

    #[test]
    fn txid_is_sha256_first20_of_bytes() {
        let ser = serialize_trx(&ref_trx()).unwrap();
        let expect = hex(&sha256_of(&ser)[..20]);
        assert_eq!(hive_txid(&ser), expect);
        assert_eq!(hive_txid(&ser).len(), 40);
    }

    #[test]
    fn one_amount_one_form_and_the_refusals() {
        assert_eq!(canonical_amount("1").unwrap(), "1.000");
        assert_eq!(canonical_amount("0.5").unwrap(), "0.500");
        assert_eq!(canonical_amount("2.25").unwrap(), "2.250");
        assert_eq!(
            canonical_amount("01.000"),
            Err("amount: malformed integer part".to_string())
        );
        assert!(canonical_amount("0").is_err());
        assert!(canonical_amount("1.2345").is_err());
        assert_eq!(
            canonical_amount("9223372036854775.807").unwrap(),
            "9223372036854775.807"
        );
        assert!(canonical_amount("9223372036854775.808").is_err());
    }

    #[test]
    fn signature_recovers_the_signing_key() {
        let seed = [0x2au8; 32];
        let chain = chain_id_from_hex(HIVE_CHAIN_ID_HEX).unwrap();
        let ser = serialize_trx(&ref_trx()).unwrap();
        let digest = hive_digest(&chain, &ser);
        let sig_hex = sign_hex(&seed, &chain, &ser).unwrap();
        let payload = crate::unhex(&sig_hex).unwrap();
        assert_eq!(payload.len(), 65);
        assert!((31..=34).contains(&payload[0]));
        assert!(bnr_keys::verify_digest65(&seed, &digest, &payload));
        // the STM public key is the EOS-legacy payload with the prefix swapped
        assert!(stm_pub(&seed).unwrap().starts_with("STM"));
    }
}
