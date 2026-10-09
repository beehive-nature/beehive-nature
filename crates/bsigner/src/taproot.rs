//! BIP-341 Taproot, key path: the signer computes what it signs
//! (SPEC-BTUNGSTEN-PQ-1 PQ12).
//!
//! The threshold BIP-340 backend that will sit behind bsigner must never sign
//! a hash it was handed: frost-wallet's page builds the TapSighash preimage in
//! JavaScript and its Rust core hashes whatever arrives, so that signer never
//! sees the transaction. Here the unsigned transaction and the outputs it
//! spends are parsed in Rust and the BIP-341 signature message is built from
//! them, field by field, as BIP-341 "Common signature message" defines it.
//!
//! Scope, refused rather than half-done: key-path spends only (ext_flag 0;
//! no tapscript, the FROST output is a key-path spend), no annex, and the
//! seven defined hash types. The official BIP-341 wallet vectors
//! (`wallet-test-vectors.json`, pinned in `scripts/btungsten/pq12-bip341.json`)
//! check every intermediary hash, every signature message, every sighash,
//! the output keys and addresses, and the expected witnesses.

use bech32::{ToBase32, Variant};
use k256::elliptic_curve::sec1::ToEncodedPoint;
use k256::elliptic_curve::PrimeField;
use sha2::{Digest, Sha256};

/// 21,000,000 BTC in satoshis: no amount, and no sum of amounts, exceeds it.
pub const MAX_MONEY: u64 = 2_100_000_000_000_000;

#[derive(Debug, PartialEq, Eq)]
pub enum TaprootError {
    Tx(&'static str),
    Prevouts(&'static str),
    HashType(u8),
    Index,
    Key(&'static str),
    Signature(&'static str),
}

impl std::fmt::Display for TaprootError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaprootError::Tx(w) => write!(f, "not an unsigned transaction: {w}"),
            TaprootError::Prevouts(w) => write!(f, "the spent outputs do not fit: {w}"),
            TaprootError::HashType(t) => write!(
                f,
                "hash type 0x{t:02x} is not one of BIP-341's seven (0x00-0x03, 0x81-0x83)"
            ),
            TaprootError::Index => write!(f, "the input index is past the last input"),
            TaprootError::Key(w) => write!(f, "not a Taproot key: {w}"),
            TaprootError::Signature(w) => write!(f, "the signature does not verify: {w}"),
        }
    }
}

pub struct TxIn {
    pub prev_txid: [u8; 32],
    pub prev_vout: u32,
    pub sequence: u32,
}

pub struct TxOut {
    pub amount: u64,
    pub script_pubkey: Vec<u8>,
}

/// An unsigned transaction (BIP-174's form: legacy serialization, every
/// scriptSig empty, no witness).
pub struct Tx {
    pub version: u32,
    pub inputs: Vec<TxIn>,
    pub outputs: Vec<TxOut>,
    pub lock_time: u32,
}

/// The output an input spends: what BIP-341 commits to beside the transaction.
pub struct Prevout {
    pub amount: u64,
    pub script_pubkey: Vec<u8>,
}

pub(crate) struct Reader<'a> {
    b: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    pub(crate) fn new(b: &'a [u8]) -> Self {
        Reader { b, at: 0 }
    }
    pub(crate) fn take(&mut self, n: usize) -> Result<&'a [u8], TaprootError> {
        let end = self
            .at
            .checked_add(n)
            .filter(|&e| e <= self.b.len())
            .ok_or(TaprootError::Tx("it ends early"))?;
        let s = &self.b[self.at..end];
        self.at = end;
        Ok(s)
    }
    pub(crate) fn u8(&mut self) -> Result<u8, TaprootError> {
        Ok(self.take(1)?[0])
    }
    pub(crate) fn u32(&mut self) -> Result<u32, TaprootError> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    pub(crate) fn u64(&mut self) -> Result<u64, TaprootError> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
    /// CompactSize, refused unless minimally encoded.
    pub(crate) fn compact(&mut self) -> Result<u64, TaprootError> {
        let first = self.take(1)?[0];
        let (v, min) = match first {
            0xfd => (
                u64::from(u16::from_le_bytes(self.take(2)?.try_into().unwrap())),
                0xfd,
            ),
            0xfe => (u64::from(self.u32()?), 0x1_0000),
            0xff => (self.u64()?, 0x1_0000_0000),
            n => return Ok(u64::from(n)),
        };
        if v < min {
            return Err(TaprootError::Tx("a length is not minimally encoded"));
        }
        Ok(v)
    }
    /// A CompactSize length followed by that many bytes.
    pub(crate) fn bytes(&mut self) -> Result<&'a [u8], TaprootError> {
        let n = self.compact()?;
        self.take(usize::try_from(n).map_err(|_| TaprootError::Tx("it ends early"))?)
    }
    pub(crate) fn remaining(&self) -> usize {
        self.b.len() - self.at
    }
    fn at(&self) -> usize {
        self.at
    }
}

fn put_compact(out: &mut Vec<u8>, n: usize) {
    match n {
        0..=0xfc => out.push(n as u8),
        0xfd..=0xffff => {
            out.push(0xfd);
            out.extend_from_slice(&(n as u16).to_le_bytes());
        }
        0x1_0000..=0xffff_ffff => {
            out.push(0xfe);
            out.extend_from_slice(&(n as u32).to_le_bytes());
        }
        _ => {
            out.push(0xff);
            out.extend_from_slice(&(n as u64).to_le_bytes());
        }
    }
}

fn put_script(out: &mut Vec<u8>, script: &[u8]) {
    put_compact(out, script.len());
    out.extend_from_slice(script);
}

/// One output: amount and scriptPubKey, the amount at most [`MAX_MONEY`].
pub(crate) fn read_txout(r: &mut Reader<'_>) -> Result<TxOut, TaprootError> {
    let amount = r.u64()?;
    if amount > MAX_MONEY {
        return Err(TaprootError::Tx("an amount is above 21 million BTC"));
    }
    Ok(TxOut {
        amount,
        script_pubkey: r.bytes()?.to_vec(),
    })
}

/// One pass over a serialized transaction, returning it and its txid.
///
/// `unsigned`: BIP-174's form, where the transaction is never in witness
/// serialization (so a 0x00 after the version is a count of zero inputs)
/// and every scriptSig is empty. Otherwise (a previous transaction) the
/// witness serialization is read when its marker is there, scriptSigs and
/// witnesses are read and skipped, and the txid covers the non-witness
/// bytes only. Refused either way: a non-minimal length, an amount or a
/// total above [`MAX_MONEY`], a count larger than the bytes could hold, and
/// any byte after the lock time.
fn read_tx(bytes: &[u8], unsigned: bool) -> Result<(Tx, [u8; 32]), TaprootError> {
    let mut r = Reader::new(bytes);
    let mut stripped = Sha256::new();
    let version = r.u32()?;
    stripped.update(&bytes[..4]);
    let witness = !unsigned && r.remaining() >= 2 && bytes[4] == 0x00 && bytes[5] == 0x01;
    if witness {
        r.take(2)?;
    }
    let body = r.at();
    let n_in = r.compact()?;
    // an input is at least 41 bytes: bounds the allocation by the input itself
    if n_in > (r.remaining() / 41) as u64 {
        return Err(TaprootError::Tx("more inputs than bytes to hold them"));
    }
    let mut inputs = Vec::with_capacity(n_in as usize);
    for _ in 0..n_in {
        let prev_txid: [u8; 32] = r.take(32)?.try_into().unwrap();
        let prev_vout = r.u32()?;
        if !r.bytes()?.is_empty() && unsigned {
            return Err(TaprootError::Tx("an input carries a scriptSig"));
        }
        let sequence = r.u32()?;
        inputs.push(TxIn {
            prev_txid,
            prev_vout,
            sequence,
        });
    }
    let n_out = r.compact()?;
    if n_out > (r.remaining() / 9) as u64 {
        return Err(TaprootError::Tx("more outputs than bytes to hold them"));
    }
    let mut outputs = Vec::with_capacity(n_out as usize);
    let mut total: u64 = 0;
    for _ in 0..n_out {
        let o = read_txout(&mut r)?;
        total = total
            .checked_add(o.amount)
            .filter(|&t| t <= MAX_MONEY)
            .ok_or(TaprootError::Tx("the outputs total above 21 million BTC"))?;
        outputs.push(o);
    }
    stripped.update(&bytes[body..r.at()]);
    if witness {
        for _ in 0..n_in {
            for _ in 0..r.compact()? {
                r.bytes()?;
            }
        }
    }
    let lock_time = r.u32()?;
    stripped.update(lock_time.to_le_bytes());
    if r.remaining() != 0 {
        return Err(TaprootError::Tx("bytes follow the lock time"));
    }
    let txid = Sha256::digest(stripped.finalize()).into();
    Ok((
        Tx {
            version,
            inputs,
            outputs,
            lock_time,
        },
        txid,
    ))
}

/// An unsigned transaction in BIP-174's form. Zero inputs or outputs are
/// allowed here (BIP-174 calls such a PSBT valid); [`parse_tx`] refuses them.
pub fn read_unsigned_tx(bytes: &[u8]) -> Result<Tx, TaprootError> {
    read_tx(bytes, true).map(|(t, _)| t).map_err(|e| {
        // 0x00 0x01 after the version reads as zero inputs and one output;
        // when that reading fails, the bytes were the witness marker
        if bytes.get(4..6) == Some(&[0x00, 0x01][..]) {
            TaprootError::Tx("it is in witness serialization, which BIP-174 forbids here")
        } else {
            e
        }
    })
}

/// A previous transaction (a PSBT's non-witness UTXO), with its txid.
pub fn read_prev_tx(bytes: &[u8]) -> Result<(Tx, [u8; 32]), TaprootError> {
    read_tx(bytes, false)
}

/// The unsigned transaction a signer will sign. Refused besides
/// [`read_unsigned_tx`]'s refusals: zero inputs or zero outputs (T-VACUOUS).
pub fn parse_tx(bytes: &[u8]) -> Result<Tx, TaprootError> {
    let tx = read_unsigned_tx(bytes)?;
    if tx.inputs.is_empty() {
        return Err(TaprootError::Tx("zero inputs"));
    }
    if tx.outputs.is_empty() {
        return Err(TaprootError::Tx("zero outputs"));
    }
    Ok(tx)
}

/// BIP-340's tagged hash: SHA-256(SHA-256(tag) ‖ SHA-256(tag) ‖ parts...).
pub fn tagged_hash(tag: &str, parts: &[&[u8]]) -> [u8; 32] {
    let t = Sha256::digest(tag.as_bytes());
    let mut h = Sha256::new();
    h.update(t);
    h.update(t);
    for p in parts {
        h.update(p);
    }
    h.finalize().into()
}

/// The five transaction-wide hashes of BIP-341's signature message.
pub struct Precomputed {
    pub sha_prevouts: [u8; 32],
    pub sha_amounts: [u8; 32],
    pub sha_script_pubkeys: [u8; 32],
    pub sha_sequences: [u8; 32],
    pub sha_outputs: [u8; 32],
}

/// Checked once per transaction: one spent output per input, each amount
/// and the total at most [`MAX_MONEY`].
pub fn precompute(tx: &Tx, prevouts: &[Prevout]) -> Result<Precomputed, TaprootError> {
    if prevouts.len() != tx.inputs.len() {
        return Err(TaprootError::Prevouts(
            "there must be exactly one spent output per input",
        ));
    }
    let mut total: u64 = 0;
    for p in prevouts {
        total = total
            .checked_add(p.amount)
            .filter(|&t| p.amount <= MAX_MONEY && t <= MAX_MONEY)
            .ok_or(TaprootError::Prevouts(
                "an amount or the total is above 21 million BTC",
            ))?;
    }
    let (mut po, mut am, mut sp, mut sq, mut out) = (
        Sha256::new(),
        Sha256::new(),
        Sha256::new(),
        Sha256::new(),
        Sha256::new(),
    );
    for i in &tx.inputs {
        po.update(i.prev_txid);
        po.update(i.prev_vout.to_le_bytes());
        sq.update(i.sequence.to_le_bytes());
    }
    for p in prevouts {
        am.update(p.amount.to_le_bytes());
        let mut s = Vec::with_capacity(p.script_pubkey.len() + 9);
        put_script(&mut s, &p.script_pubkey);
        sp.update(&s);
    }
    for o in &tx.outputs {
        out.update(serialize_output(o));
    }
    Ok(Precomputed {
        sha_prevouts: po.finalize().into(),
        sha_amounts: am.finalize().into(),
        sha_script_pubkeys: sp.finalize().into(),
        sha_sequences: sq.finalize().into(),
        sha_outputs: out.finalize().into(),
    })
}

fn serialize_output(o: &TxOut) -> Vec<u8> {
    let mut s = Vec::with_capacity(o.script_pubkey.len() + 17);
    s.extend_from_slice(&o.amount.to_le_bytes());
    put_script(&mut s, &o.script_pubkey);
    s
}

const SIGHASH_ALL: u8 = 0x01;
const SIGHASH_NONE: u8 = 0x02;
const SIGHASH_SINGLE: u8 = 0x03;
const SIGHASH_ANYONECANPAY: u8 = 0x80;

/// BIP-341 SigMsg(hash_type, ext_flag = 0) for input `index`, no annex.
pub fn sig_msg(
    tx: &Tx,
    prevouts: &[Prevout],
    pre: &Precomputed,
    index: usize,
    hash_type: u8,
) -> Result<Vec<u8>, TaprootError> {
    if !matches!(hash_type, 0x00..=0x03 | 0x81..=0x83) {
        return Err(TaprootError::HashType(hash_type));
    }
    if prevouts.len() != tx.inputs.len() {
        return Err(TaprootError::Prevouts(
            "there must be exactly one spent output per input",
        ));
    }
    if index >= tx.inputs.len() {
        return Err(TaprootError::Index);
    }
    let output_type = if hash_type == 0x00 {
        SIGHASH_ALL
    } else {
        hash_type & 0x03
    };
    let anyone_can_pay = hash_type & SIGHASH_ANYONECANPAY != 0;
    if output_type == SIGHASH_SINGLE && index >= tx.outputs.len() {
        return Err(TaprootError::Index);
    }
    let mut m = Vec::with_capacity(206);
    m.push(hash_type);
    m.extend_from_slice(&tx.version.to_le_bytes());
    m.extend_from_slice(&tx.lock_time.to_le_bytes());
    if !anyone_can_pay {
        m.extend_from_slice(&pre.sha_prevouts);
        m.extend_from_slice(&pre.sha_amounts);
        m.extend_from_slice(&pre.sha_script_pubkeys);
        m.extend_from_slice(&pre.sha_sequences);
    }
    if output_type != SIGHASH_NONE && output_type != SIGHASH_SINGLE {
        m.extend_from_slice(&pre.sha_outputs);
    }
    // spend_type = ext_flag * 2 + annex_present = 0
    m.push(0x00);
    if anyone_can_pay {
        let i = &tx.inputs[index];
        m.extend_from_slice(&i.prev_txid);
        m.extend_from_slice(&i.prev_vout.to_le_bytes());
        m.extend_from_slice(&prevouts[index].amount.to_le_bytes());
        put_script(&mut m, &prevouts[index].script_pubkey);
        m.extend_from_slice(&i.sequence.to_le_bytes());
    } else {
        m.extend_from_slice(&(index as u32).to_le_bytes());
    }
    if output_type == SIGHASH_SINGLE {
        m.extend_from_slice(&Sha256::digest(serialize_output(&tx.outputs[index])));
    }
    Ok(m)
}

/// The BIP-341 sighash: TapSighash tagged hash of epoch 0x00 ‖ SigMsg.
pub fn sighash_of(msg: &[u8]) -> [u8; 32] {
    tagged_hash("TapSighash", &[&[0x00], msg])
}

/// A Taproot output key from an internal key and an optional script-tree
/// root: Q = lift_x(P) + int(TapTweak(P ‖ root)) · G.
pub struct OutputKey {
    pub tweak: [u8; 32],
    pub key: [u8; 32],
    pub parity: u8,
}

pub fn output_key(
    internal: &[u8; 32],
    merkle_root: Option<&[u8; 32]>,
) -> Result<OutputKey, TaprootError> {
    let p = k256::schnorr::VerifyingKey::from_bytes(internal)
        .map_err(|_| TaprootError::Key("the internal key is not an x coordinate on the curve"))?;
    let tweak = match merkle_root {
        Some(r) => tagged_hash("TapTweak", &[internal, r]),
        None => tagged_hash("TapTweak", &[internal]),
    };
    let t = Option::<k256::Scalar>::from(k256::Scalar::from_repr(tweak.into()))
        .ok_or(TaprootError::Key("the tweak is not below the group order"))?;
    let q = k256::ProjectivePoint::from(*p.as_affine()) + k256::ProjectivePoint::GENERATOR * t;
    let enc = q.to_affine().to_encoded_point(true);
    let (Some(x), Some(&tag)) = (enc.x(), enc.as_bytes().first()) else {
        return Err(TaprootError::Key(
            "the tweaked key is the point at infinity",
        ));
    };
    Ok(OutputKey {
        tweak,
        key: (*x).into(),
        parity: tag - 0x02,
    })
}

/// `OP_1 <32-byte key>`: a segwit v1 output.
pub fn script_pubkey(key: &[u8; 32]) -> Vec<u8> {
    let mut s = vec![0x51, 0x20];
    s.extend_from_slice(key);
    s
}

/// The BIP-173/350 address of a witness-program output (`OP_n <2..40
/// bytes>`, version 0 only with 20 or 32 bytes); `None` for any other
/// script. Version 0 is bech32, later versions bech32m.
pub fn address_of(hrp: &str, script_pubkey: &[u8]) -> Option<String> {
    let (&op, rest) = script_pubkey.split_first()?;
    let (&len, program) = rest.split_first()?;
    let version = match op {
        0x00 => 0,
        0x51..=0x60 => op - 0x50,
        _ => return None,
    };
    if usize::from(len) != program.len()
        || !(2..=40).contains(&program.len())
        || (version == 0 && program.len() != 20 && program.len() != 32)
    {
        return None;
    }
    let mut data = vec![bech32::u5::try_from_u8(version).ok()?];
    data.extend(program.to_base32());
    let variant = if version == 0 {
        Variant::Bech32
    } else {
        Variant::Bech32m
    };
    bech32::encode(hrp, data, variant).ok()
}

/// Check a key-path witness signature the way a node does: the key is the
/// one in the spent output (`OP_1 <32>`), 64 bytes means hash type 0x00, 65
/// bytes carry their hash type last (0x00 written out is refused, BIP-341).
/// Returns the hash type the signature commits to.
pub fn verify_key_path(
    tx: &Tx,
    prevouts: &[Prevout],
    index: usize,
    sig: &[u8],
) -> Result<u8, TaprootError> {
    let spk = &prevouts
        .get(index)
        .ok_or(TaprootError::Index)?
        .script_pubkey;
    if spk.len() != 34 || spk[0] != 0x51 || spk[1] != 0x20 {
        return Err(TaprootError::Key(
            "the spent output is not OP_1 <32-byte key>",
        ));
    }
    let hash_type = match sig.len() {
        64 => 0x00,
        65 if sig[64] != 0x00 => sig[64],
        65 => return Err(TaprootError::Signature("hash type 0x00 written out")),
        _ => return Err(TaprootError::Signature("not 64 or 65 bytes")),
    };
    let vk = k256::schnorr::VerifyingKey::from_bytes(&spk[2..])
        .map_err(|_| TaprootError::Key("the output key is not on the curve"))?;
    let s = k256::schnorr::Signature::try_from(&sig[..64])
        .map_err(|_| TaprootError::Signature("not a BIP-340 signature encoding"))?;
    let pre = precompute(tx, prevouts)?;
    let msg = sig_msg(tx, prevouts, &pre, index, hash_type)?;
    vk.verify_raw(&sighash_of(&msg), &s)
        .map_err(|_| TaprootError::Signature("BIP-340 verification failed"))?;
    Ok(hash_type)
}

pub fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub fn unhex(s: &str) -> Option<Vec<u8>> {
    if !s.len().is_multiple_of(2) {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(s.get(i..i + 2)?, 16).ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const PIN: &str = include_str!("../../../scripts/btungsten/pq12-bip341.json");

    fn h(v: &Value) -> Vec<u8> {
        unhex(v.as_str().expect("a hex string")).expect("hex")
    }
    fn h32(v: &Value) -> [u8; 32] {
        h(v).try_into().expect("32 bytes")
    }

    /// The pinned vector file, refused unless its size and SHA-256 match.
    fn pinned() -> Value {
        let pin: Value = serde_json::from_str(PIN).unwrap();
        let path = std::env::var("BPQ_BIP341_VECTORS").expect("BPQ_BIP341_VECTORS names the file");
        let bytes = std::fs::read(path).unwrap();
        assert_eq!(
            bytes.len() as u64,
            pin["size"].as_u64().unwrap(),
            "pinned size"
        );
        assert_eq!(
            crate::b64::b64u(&Sha256::digest(&bytes)),
            pin["sha256"].as_str().unwrap(),
            "pinned SHA-256"
        );
        serde_json::from_slice(&bytes).unwrap()
    }

    fn tap_leaf(version: u8, script: &[u8]) -> [u8; 32] {
        let mut s = vec![version];
        put_script(&mut s, script);
        tagged_hash("TapLeaf", &[&s])
    }

    fn tap_branch(a: [u8; 32], b: [u8; 32]) -> [u8; 32] {
        let (l, r) = if a <= b { (a, b) } else { (b, a) };
        tagged_hash("TapBranch", &[&l, &r])
    }

    /// A leaf of a vector's script tree: id, leaf version, leaf hash, and
    /// the sibling hashes from the leaf up to the root.
    type Leaf = (u64, u8, [u8; 32], Vec<[u8; 32]>);

    /// A vector's script tree: its root and its leaves.
    fn tree(v: &Value) -> ([u8; 32], Vec<Leaf>) {
        if let Some(pair) = v.as_array() {
            let (lr, mut ll) = tree(&pair[0]);
            let (rr, mut rl) = tree(&pair[1]);
            for leaf in ll.iter_mut() {
                leaf.3.push(rr);
            }
            for leaf in rl.iter_mut() {
                leaf.3.push(lr);
            }
            ll.extend(rl);
            (tap_branch(lr, rr), ll)
        } else {
            let ver = v["leafVersion"].as_u64().unwrap() as u8;
            let leaf = tap_leaf(ver, &h(&v["script"]));
            (
                leaf,
                vec![(v["id"].as_u64().unwrap(), ver, leaf, Vec::new())],
            )
        }
    }

    #[test]
    #[ignore = "needs the pinned BIP-341 vectors: BPQ_BIP341_VECTORS (CI job pq12-taproot)"]
    fn bip341_wallet_vectors() {
        let v = pinned();

        // scriptPubKey: leaf hashes, merkle root, tweak, output key, address,
        // control blocks
        let spks = v["scriptPubKey"].as_array().unwrap();
        assert!(!spks.is_empty(), "T-VACUOUS: no scriptPubKey cases");
        for (n, c) in spks.iter().enumerate() {
            let internal = h32(&c["given"]["internalPubkey"]);
            let st = &c["given"]["scriptTree"];
            let (root, leaves) = if st.is_null() {
                (None, Vec::new())
            } else {
                let (r, l) = tree(st);
                (Some(r), l)
            };
            if let Some(want) = c["intermediary"]["leafHashes"].as_array() {
                let mut got = leaves.clone();
                got.sort_by_key(|l| l.0);
                let got: Vec<[u8; 32]> = got.iter().map(|l| l.2).collect();
                let want: Vec<[u8; 32]> = want.iter().map(h32).collect();
                assert_eq!(got, want, "case {n} leaf hashes");
            }
            match (&root, c["intermediary"]["merkleRoot"].as_str()) {
                (None, None) => {}
                (Some(r), Some(w)) => assert_eq!(hex(r), w, "case {n} merkle root"),
                _ => panic!("case {n}: merkle root presence differs"),
            }
            let q = output_key(&internal, root.as_ref()).unwrap();
            assert_eq!(q.tweak, h32(&c["intermediary"]["tweak"]), "case {n} tweak");
            assert_eq!(
                q.key,
                h32(&c["intermediary"]["tweakedPubkey"]),
                "case {n} output key"
            );
            assert_eq!(
                script_pubkey(&q.key),
                h(&c["expected"]["scriptPubKey"]),
                "case {n} scriptPubKey"
            );
            assert_eq!(
                address_of("bc", &script_pubkey(&q.key)).unwrap(),
                c["expected"]["bip350Address"].as_str().unwrap(),
                "case {n} address"
            );
            if let Some(want) = c["expected"]["scriptPathControlBlocks"].as_array() {
                let mut by_id = leaves.clone();
                by_id.sort_by_key(|l| l.0);
                for (leaf, w) in by_id.iter().zip(want) {
                    let mut cb = vec![leaf.1 | q.parity];
                    cb.extend_from_slice(&internal);
                    for p in &leaf.3 {
                        cb.extend_from_slice(p);
                    }
                    assert_eq!(cb, h(w), "case {n} control block of leaf {}", leaf.0);
                }
            }
        }

        // keyPathSpending: intermediary hashes, every SigMsg and sighash, the
        // expected witness verifies (and is reproduced with zero aux)
        let (mut spends, mut inputs, mut teeth) = (0, 0, 0);
        for (n, c) in v["keyPathSpending"].as_array().unwrap().iter().enumerate() {
            let tx = parse_tx(&h(&c["given"]["rawUnsignedTx"])).unwrap();
            let prevouts: Vec<Prevout> = c["given"]["utxosSpent"]
                .as_array()
                .unwrap()
                .iter()
                .map(|u| Prevout {
                    amount: u["amountSats"].as_u64().unwrap(),
                    script_pubkey: h(&u["scriptPubKey"]),
                })
                .collect();
            let pre = precompute(&tx, &prevouts).unwrap();
            let im = &c["intermediary"];
            assert_eq!(
                pre.sha_amounts,
                h32(&im["hashAmounts"]),
                "spend {n} hashAmounts"
            );
            assert_eq!(
                pre.sha_outputs,
                h32(&im["hashOutputs"]),
                "spend {n} hashOutputs"
            );
            assert_eq!(
                pre.sha_prevouts,
                h32(&im["hashPrevouts"]),
                "spend {n} hashPrevouts"
            );
            assert_eq!(
                pre.sha_script_pubkeys,
                h32(&im["hashScriptPubkeys"]),
                "spend {n} hashScriptPubkeys"
            );
            assert_eq!(
                pre.sha_sequences,
                h32(&im["hashSequences"]),
                "spend {n} hashSequences"
            );
            spends += 1;
            for s in c["inputSpending"].as_array().unwrap() {
                let g = &s["given"];
                let i = g["txinIndex"].as_u64().unwrap() as usize;
                let t = g["hashType"].as_u64().unwrap() as u8;
                let msg = sig_msg(&tx, &prevouts, &pre, i, t).unwrap();
                // the vectors print the epoch byte in front of SigMsg
                assert_eq!(
                    [&[0x00][..], &msg].concat(),
                    h(&s["intermediary"]["sigMsg"]),
                    "input {i} SigMsg"
                );
                let sh = sighash_of(&msg);
                assert_eq!(sh, h32(&s["intermediary"]["sigHash"]), "input {i} sighash");

                let internal = h32(&s["intermediary"]["internalPubkey"]);
                let root = g["merkleRoot"].as_str().map(|r| h32(&Value::from(r)));
                let q = output_key(&internal, root.as_ref()).unwrap();
                assert_eq!(q.tweak, h32(&s["intermediary"]["tweak"]), "input {i} tweak");
                assert_eq!(
                    script_pubkey(&q.key),
                    prevouts[i].script_pubkey,
                    "input {i} output key"
                );

                let wit = h(&s["expected"]["witness"][0]);
                assert_eq!(
                    verify_key_path(&tx, &prevouts, i, &wit),
                    Ok(t),
                    "input {i} witness"
                );
                let sk =
                    k256::schnorr::SigningKey::from_bytes(&h(&s["intermediary"]["tweakedPrivkey"]))
                        .unwrap();
                let made = sk.sign_raw(&sh, &[0u8; 32]).unwrap();
                assert_eq!(
                    made.to_bytes().as_slice(),
                    &wit[..64],
                    "input {i} witness reproduced"
                );

                // TEETH: another input index, another hash type, a flipped
                // signature bit, each refused
                let other = (i + 1) % tx.inputs.len();
                assert!(
                    verify_key_path(&tx, &prevouts, other, &wit).is_err(),
                    "input {i} on input {other}"
                );
                teeth += 1;
                let mut bent = wit.clone();
                bent[5] ^= 1;
                assert!(
                    verify_key_path(&tx, &prevouts, i, &bent).is_err(),
                    "input {i} flipped bit"
                );
                teeth += 1;
                if wit.len() == 65 {
                    let mut retyped = wit.clone();
                    retyped[64] = if t == 0x01 { 0x02 } else { 0x01 };
                    assert!(
                        verify_key_path(&tx, &prevouts, i, &retyped).is_err(),
                        "input {i} retyped"
                    );
                    teeth += 1;
                }
                inputs += 1;
            }
        }
        assert!(inputs > 0, "T-VACUOUS: no key-path inputs");
        println!(
            "PQ12-BIP341 bsigner: {} scriptPubKey cases (leaf hashes, root, tweak, key, address, control blocks), {spends} transaction(s) (the 5 shared hashes) and {inputs} key-path inputs (SigMsg, sighash, tweak, the witness verifies and reproduces) pass; {teeth} teeth refused",
            spks.len()
        );
    }

    fn tx_bytes(n_in: u8, script_sig: &[u8], n_out: u8, amount: u64, tail: &[u8]) -> Vec<u8> {
        let mut t = vec![2, 0, 0, 0, n_in];
        for _ in 0..n_in {
            t.extend_from_slice(&[7u8; 36]);
            put_script(&mut t, script_sig);
            t.extend_from_slice(&[0xff; 4]);
        }
        t.push(n_out);
        for _ in 0..n_out {
            t.extend_from_slice(&amount.to_le_bytes());
            put_script(&mut t, &[0x51, 0x20, 1, 2]);
        }
        t.extend_from_slice(&[0; 4]);
        t.extend_from_slice(tail);
        t
    }

    #[test]
    fn unsigned_transactions_outside_the_rule_parse_to_nothing() {
        assert!(
            parse_tx(&tx_bytes(1, &[], 1, 1000, &[])).is_ok(),
            "the control parses"
        );
        let refused = [
            (tx_bytes(0, &[], 1, 1000, &[]), "zero inputs"),
            (tx_bytes(1, &[], 0, 1000, &[]), "zero outputs"),
            (tx_bytes(1, &[0x00], 1, 1000, &[]), "a scriptSig"),
            (
                tx_bytes(1, &[], 1, MAX_MONEY + 1, &[]),
                "an amount over MAX_MONEY",
            ),
            (
                tx_bytes(1, &[], 2, MAX_MONEY / 2 + 1, &[]),
                "a total over MAX_MONEY",
            ),
            (tx_bytes(1, &[], 1, 1000, &[0]), "a trailing byte"),
        ];
        for (b, why) in refused {
            assert!(parse_tx(&b).is_err(), "{why} parsed");
        }
        let good = tx_bytes(1, &[], 1, 1000, &[]);
        for cut in 0..good.len() {
            assert!(parse_tx(&good[..cut]).is_err(), "cut at {cut} parsed");
        }
        // a non-minimal CompactSize for the input count
        let mut fat = good.clone();
        fat.splice(4..5, [0xfd, 1, 0]);
        assert_eq!(
            parse_tx(&fat).err(),
            Some(TaprootError::Tx("a length is not minimally encoded"))
        );
    }

    #[test]
    fn addresses_follow_bip173_and_bip350() {
        // BIP-173's first mainnet example (P2WPKH)
        let p2wpkh = unhex("0014751e76e8199196d454941c45d1b3a323f1433bd6").unwrap();
        assert_eq!(
            address_of("bc", &p2wpkh).as_deref(),
            Some("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")
        );
        // not witness programs: P2PKH, a 21-byte version 0 program, a
        // length byte that disagrees with the program
        let mut p2pkh = vec![0x76, 0xa9, 0x14];
        p2pkh.extend_from_slice(&[0u8; 20]);
        p2pkh.extend_from_slice(&[0x88, 0xac]);
        let mut v0_21 = vec![0x00, 21];
        v0_21.extend_from_slice(&[1u8; 21]);
        let mut short = vec![0x51, 0x20];
        short.extend_from_slice(&[1u8; 31]);
        for s in [p2pkh, v0_21, short] {
            assert_eq!(address_of("bc", &s), None);
        }
    }

    #[test]
    fn hash_types_and_indices_outside_bip341_build_no_message() {
        let tx = parse_tx(&tx_bytes(2, &[], 1, 1000, &[])).unwrap();
        let prev = || {
            vec![
                Prevout {
                    amount: 5000,
                    script_pubkey: script_pubkey(&[3; 32]),
                },
                Prevout {
                    amount: 5000,
                    script_pubkey: script_pubkey(&[4; 32]),
                },
            ]
        };
        let p = prev();
        let pre = precompute(&tx, &p).unwrap();
        for t in [0x00u8, 0x01, 0x02, 0x03, 0x81, 0x82, 0x83] {
            assert!(sig_msg(&tx, &p, &pre, 0, t).is_ok(), "hash type {t:#04x}");
        }
        for t in [0x04u8, 0x40, 0x80, 0x84, 0xff] {
            assert_eq!(sig_msg(&tx, &p, &pre, 0, t), Err(TaprootError::HashType(t)));
        }
        assert_eq!(sig_msg(&tx, &p, &pre, 2, 0x00), Err(TaprootError::Index));
        // SINGLE with no output at the input's index
        assert_eq!(sig_msg(&tx, &p, &pre, 1, 0x03), Err(TaprootError::Index));
        assert!(
            precompute(&tx, &p[..1]).is_err(),
            "one prevout for two inputs"
        );
    }
}
