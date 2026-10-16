//! BIP-174 PSBT, version 0, with BIP-371's Taproot fields: the form the
//! threshold signer behind bsigner takes its transaction in
//! (SPEC-BTUNGSTEN-PQ-1 PQ12 step 2).
//!
//! The reader is strict where BIP-174 and BIP-371 fix a shape: every known
//! key type is checked for its key data and value lengths, public keys must
//! be points on the curve, keys are unique within a map, version 2 fields
//! and versions above 0 are refused, a non-witness UTXO must hash to the
//! outpoint it claims, and no byte may follow the last map. Unknown and
//! proprietary keys are allowed, as BIP-174 requires. Preimage fields are
//! checked for key length; SHA-256 and HASH256 preimages are also checked
//! against their key (RIPEMD-160 ones are not: no RIPEMD-160 here).
//!
//! [`signing_view`] is the signer's reading of a parsed PSBT: refused
//! unless every input's spent output is known, every hash type is one of
//! BIP-341's seven, the transaction has inputs and outputs, and the outputs
//! do not exceed the inputs.

use crate::taproot::{self, Prevout, Reader, TaprootError, Tx, TxOut};
use sha2::{Digest, Sha256};

#[derive(Debug, PartialEq, Eq)]
pub struct PsbtError(pub String);

impl std::fmt::Display for PsbtError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "not a valid PSBT: {}", self.0)
    }
}

impl From<TaprootError> for PsbtError {
    fn from(e: TaprootError) -> Self {
        PsbtError(e.to_string())
    }
}

fn bad<T>(why: impl Into<String>) -> Result<T, PsbtError> {
    Err(PsbtError(why.into()))
}

#[derive(Default)]
pub struct PsbtInput {
    pub witness_utxo: Option<TxOut>,
    /// The previous transaction's outputs, its txid already checked
    /// against the outpoint.
    pub non_witness_outputs: Option<Vec<TxOut>>,
    pub sighash_type: Option<u32>,
    pub tap_key_sig: Option<Vec<u8>>,
    pub tap_internal_key: Option<[u8; 32]>,
    pub tap_merkle_root: Option<[u8; 32]>,
}

#[derive(Default)]
pub struct PsbtOutput {
    pub tap_internal_key: Option<[u8; 32]>,
}

pub struct Psbt {
    pub tx: Tx,
    pub inputs: Vec<PsbtInput>,
    pub outputs: Vec<PsbtOutput>,
}

/// A map's entries: (key type, key data, value).
type Map<'a> = Vec<(u64, &'a [u8], &'a [u8])>;

fn read_map<'a>(r: &mut Reader<'a>, which: &str) -> Result<Map<'a>, PsbtError> {
    let mut keys: Vec<&[u8]> = Vec::new();
    let mut out = Vec::new();
    loop {
        let key = r.bytes()?;
        if key.is_empty() {
            return Ok(out);
        }
        if keys.contains(&key) {
            return bad(format!("a key appears twice in the {which} map"));
        }
        keys.push(key);
        let mut kr = Reader::new(key);
        let key_type = kr.compact()?;
        let key_data = kr.take(kr.remaining())?;
        out.push((key_type, key_data, r.bytes()?));
    }
}

fn no_key_data(map: &str, t: u64, kd: &[u8]) -> Result<(), PsbtError> {
    if kd.is_empty() {
        Ok(())
    } else {
        bad(format!("{map} key type 0x{t:02x} carries key data"))
    }
}

fn exact_len(map: &str, t: u64, what: &str, b: &[u8], n: usize) -> Result<(), PsbtError> {
    if b.len() == n {
        Ok(())
    } else {
        bad(format!(
            "{map} key type 0x{t:02x}: {what} is {} bytes, not {n}",
            b.len()
        ))
    }
}

fn pubkey(map: &str, t: u64, kd: &[u8]) -> Result<(), PsbtError> {
    if (kd.len() == 33 || kd.len() == 65) && k256::PublicKey::from_sec1_bytes(kd).is_ok() {
        Ok(())
    } else {
        bad(format!(
            "{map} key type 0x{t:02x}: the key data is not a public key"
        ))
    }
}

/// A BIP-32 origin: a 4-byte fingerprint and 4-byte path elements.
fn origin(map: &str, t: u64, v: &[u8]) -> Result<(), PsbtError> {
    if v.len() >= 4 && v.len().is_multiple_of(4) {
        Ok(())
    } else {
        bad(format!(
            "{map} key type 0x{t:02x}: not a fingerprint and path"
        ))
    }
}

/// BIP-371 Taproot derivation: leaf hashes, then a BIP-32 origin.
fn tap_origin(map: &str, t: u64, v: &[u8]) -> Result<(), PsbtError> {
    let mut r = Reader::new(v);
    let n = r.compact()?;
    let hashes = usize::try_from(n)
        .ok()
        .and_then(|n| n.checked_mul(32))
        .ok_or(PsbtError(format!(
            "{map} key type 0x{t:02x}: leaf hash count"
        )))?;
    r.take(hashes)?;
    origin(map, t, r.take(r.remaining())?)
}

fn sig_len(map: &str, t: u64, v: &[u8]) -> Result<(), PsbtError> {
    if v.len() == 64 || v.len() == 65 {
        Ok(())
    } else {
        bad(format!(
            "{map} key type 0x{t:02x}: a signature is 64 or 65 bytes, not {}",
            v.len()
        ))
    }
}

fn whole<T>(
    map: &str,
    t: u64,
    v: &[u8],
    f: impl FnOnce(&mut Reader) -> Result<T, TaprootError>,
) -> Result<T, PsbtError> {
    let mut r = Reader::new(v);
    let out = f(&mut r).map_err(|e| PsbtError(format!("{map} key type 0x{t:02x}: {e}")))?;
    if r.remaining() != 0 {
        return bad(format!("{map} key type 0x{t:02x}: bytes follow the value"));
    }
    Ok(out)
}

fn key32(map: &str, t: u64, v: &[u8]) -> Result<[u8; 32], PsbtError> {
    v.try_into().map_err(|_| {
        PsbtError(format!(
            "{map} key type 0x{t:02x}: the value is {} bytes, not 32",
            v.len()
        ))
    })
}

/// Parse a PSBT's bytes.
pub fn parse(bytes: &[u8]) -> Result<Psbt, PsbtError> {
    let mut r = Reader::new(bytes);
    if r.take(5).ok() != Some(b"psbt\xff".as_slice()) {
        return bad("it does not start with the magic bytes psbt 0xff");
    }
    let mut tx = None;
    for (t, kd, v) in read_map(&mut r, "global")? {
        const G: &str = "global";
        match t {
            0x00 => {
                no_key_data(G, t, kd)?;
                tx = Some(taproot::read_unsigned_tx(v)?);
            }
            0x01 => {
                exact_len(G, t, "the extended key", kd, 78)?;
                origin(G, t, v)?;
            }
            0x02..=0x06 => return bad(format!("global key type 0x{t:02x} is a version 2 field")),
            0xfb => {
                no_key_data(G, t, kd)?;
                exact_len(G, t, "the version", v, 4)?;
                let ver = u32::from_le_bytes(v.try_into().unwrap());
                if ver != 0 {
                    return bad(format!("version {ver} is not supported (version 0 only)"));
                }
            }
            _ => {}
        }
    }
    let tx = tx.ok_or(PsbtError("there is no unsigned transaction".into()))?;

    let mut inputs = Vec::with_capacity(tx.inputs.len());
    for (i, txin) in tx.inputs.iter().enumerate() {
        const I: &str = "input";
        let mut inp = PsbtInput::default();
        for (t, kd, v) in read_map(&mut r, "input")? {
            match t {
                0x00 => {
                    no_key_data(I, t, kd)?;
                    let (prev, txid) = taproot::read_prev_tx(v)?;
                    if txid != txin.prev_txid {
                        return bad(format!("input {i}: the non-witness UTXO is not the transaction its outpoint names"));
                    }
                    inp.non_witness_outputs = Some(prev.outputs);
                }
                0x01 => {
                    no_key_data(I, t, kd)?;
                    inp.witness_utxo = Some(whole(I, t, v, taproot::read_txout)?);
                }
                0x02 => pubkey(I, t, kd)?,
                0x03 => {
                    no_key_data(I, t, kd)?;
                    exact_len(I, t, "the sighash type", v, 4)?;
                    inp.sighash_type = Some(u32::from_le_bytes(v.try_into().unwrap()));
                }
                0x04 | 0x05 | 0x07 | 0x09 => no_key_data(I, t, kd)?,
                0x06 => {
                    pubkey(I, t, kd)?;
                    origin(I, t, v)?;
                }
                0x08 => {
                    no_key_data(I, t, kd)?;
                    whole(I, t, v, |r| {
                        for _ in 0..r.compact()? {
                            r.bytes()?;
                        }
                        Ok(())
                    })?;
                }
                0x0a | 0x0c => exact_len(I, t, "the hash", kd, 20)?,
                0x0b => {
                    exact_len(I, t, "the hash", kd, 32)?;
                    if Sha256::digest(v).as_slice() != kd {
                        return bad(format!(
                            "input {i}: a SHA-256 preimage does not hash to its key"
                        ));
                    }
                }
                0x0d => {
                    exact_len(I, t, "the hash", kd, 32)?;
                    if Sha256::digest(Sha256::digest(v)).as_slice() != kd {
                        return bad(format!(
                            "input {i}: a HASH256 preimage does not hash to its key"
                        ));
                    }
                }
                0x0e..=0x12 => {
                    return bad(format!("input key type 0x{t:02x} is a version 2 field"))
                }
                0x13 => {
                    no_key_data(I, t, kd)?;
                    sig_len(I, t, v)?;
                    inp.tap_key_sig = Some(v.to_vec());
                }
                0x14 => {
                    exact_len(I, t, "the key and leaf hash", kd, 64)?;
                    sig_len(I, t, v)?;
                }
                0x15 => {
                    if kd.len() < 33
                        || !(kd.len() - 33).is_multiple_of(32)
                        || kd.len() > 33 + 32 * 128
                    {
                        return bad(format!("input {i}: a control block is {} bytes", kd.len()));
                    }
                    if v.is_empty() {
                        return bad(format!("input {i}: a leaf script without its leaf version"));
                    }
                }
                0x16 => {
                    exact_len(I, t, "the x-only key", kd, 32)?;
                    tap_origin(I, t, v)?;
                }
                0x17 => {
                    no_key_data(I, t, kd)?;
                    inp.tap_internal_key = Some(key32(I, t, v)?);
                }
                0x18 => {
                    no_key_data(I, t, kd)?;
                    inp.tap_merkle_root = Some(key32(I, t, v)?);
                }
                _ => {}
            }
        }
        if let (Some(w), Some(outs)) = (&inp.witness_utxo, &inp.non_witness_outputs) {
            let o = outs.get(txin.prev_vout as usize);
            if o.is_none_or(|o| o.amount != w.amount || o.script_pubkey != w.script_pubkey) {
                return bad(format!(
                    "input {i}: the witness UTXO and the non-witness UTXO disagree"
                ));
            }
        }
        inputs.push(inp);
    }

    let mut outputs = Vec::with_capacity(tx.outputs.len());
    for _ in 0..tx.outputs.len() {
        const O: &str = "output";
        let mut out = PsbtOutput::default();
        for (t, kd, v) in read_map(&mut r, "output")? {
            match t {
                0x00 | 0x01 => no_key_data(O, t, kd)?,
                0x02 => {
                    pubkey(O, t, kd)?;
                    origin(O, t, v)?;
                }
                0x03 | 0x04 => {
                    return bad(format!("output key type 0x{t:02x} is a version 2 field"))
                }
                0x05 => {
                    no_key_data(O, t, kd)?;
                    out.tap_internal_key = Some(key32(O, t, v)?);
                }
                0x06 => {
                    no_key_data(O, t, kd)?;
                    whole(O, t, v, |r| {
                        if r.remaining() == 0 {
                            return Err(TaprootError::Tx("an empty tap tree"));
                        }
                        while r.remaining() > 0 {
                            if r.u8()? > 128 {
                                return Err(TaprootError::Tx("a leaf deeper than 128"));
                            }
                            r.u8()?;
                            r.bytes()?;
                        }
                        Ok(())
                    })?;
                }
                0x07 => {
                    exact_len(O, t, "the x-only key", kd, 32)?;
                    tap_origin(O, t, v)?;
                }
                _ => {}
            }
        }
        outputs.push(out);
    }
    if r.remaining() != 0 {
        return bad("bytes follow the last output map");
    }
    Ok(Psbt {
        tx,
        inputs,
        outputs,
    })
}

/// Standard base64 (RFC 4648 §4, padded), refused unless canonical.
pub fn from_base64(s: &str) -> Result<Vec<u8>, PsbtError> {
    let s = s.trim();
    let body = s.trim_end_matches('=');
    if !s.len().is_multiple_of(4) || s.len() - body.len() > 2 {
        return bad("not padded base64");
    }
    let bytes = crate::b64::b64u_decode(&body.replace('+', "-").replace('/', "_"))
        .ok_or(PsbtError("not base64".into()))?;
    let again = crate::b64::b64u(&bytes).replace('-', "+").replace('_', "/");
    let pad = "=".repeat((4 - again.len() % 4) % 4);
    if again + &pad != s {
        return bad("not canonical base64");
    }
    Ok(bytes)
}

/// What the signer reads from a PSBT: the transaction, every spent output,
/// every input's hash type (absent = 0x00, SIGHASH_DEFAULT), the fee.
pub struct SigningView {
    pub tx: Tx,
    pub prevouts: Vec<Prevout>,
    pub hash_types: Vec<u8>,
    pub fee: u64,
}

pub fn signing_view(p: Psbt) -> Result<SigningView, PsbtError> {
    if p.tx.inputs.is_empty() || p.tx.outputs.is_empty() {
        return bad("a transaction with no inputs or no outputs is not signed (T-VACUOUS)");
    }
    let mut prevouts = Vec::with_capacity(p.inputs.len());
    let mut hash_types = Vec::with_capacity(p.inputs.len());
    for (i, (inp, txin)) in p.inputs.iter().zip(&p.tx.inputs).enumerate() {
        let o = match (&inp.witness_utxo, &inp.non_witness_outputs) {
            (Some(w), _) => w,
            (None, Some(outs)) => outs.get(txin.prev_vout as usize).ok_or(PsbtError(format!(
                "input {i}: the previous transaction has no output {}",
                txin.prev_vout
            )))?,
            (None, None) => return bad(format!("input {i}: its spent output is not in the PSBT")),
        };
        prevouts.push(Prevout {
            amount: o.amount,
            script_pubkey: o.script_pubkey.clone(),
        });
        let t = inp.sighash_type.unwrap_or(0);
        match u8::try_from(t) {
            Ok(b) if matches!(b, 0x00..=0x03 | 0x81..=0x83) => hash_types.push(b),
            _ => {
                return bad(format!(
                    "input {i}: sighash type {t:#x} is not one of BIP-341's seven"
                ))
            }
        }
    }
    let spent = prevouts
        .iter()
        .try_fold(0u64, |a, p| a.checked_add(p.amount))
        .filter(|&s| s <= taproot::MAX_MONEY)
        .ok_or(PsbtError(
            "the spent outputs total above 21 million BTC".into(),
        ))?;
    let paid: u64 = p.tx.outputs.iter().map(|o| o.amount).sum();
    let fee = spent.checked_sub(paid).ok_or(PsbtError(
        "the outputs pay more than the inputs spend".into(),
    ))?;
    Ok(SigningView {
        tx: p.tx,
        prevouts,
        hash_types,
        fee,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const PIN: &str = include_str!("../../../scripts/btungsten/pq12-bip341.json");

    /// One pinned BIP text, refused unless its size and SHA-256 match.
    fn pinned_text(name: &str, var: &str) -> String {
        let pin: Value = serde_json::from_str(PIN).unwrap();
        let p = &pin["psbt"][name];
        let path = std::env::var(var).unwrap_or_else(|_| panic!("{var} names the file"));
        let bytes = std::fs::read(path).unwrap();
        assert_eq!(
            bytes.len() as u64,
            p["size"].as_u64().unwrap(),
            "{name} pinned size"
        );
        assert_eq!(
            crate::b64::b64u(&Sha256::digest(&bytes)),
            p["sha256"].as_str().unwrap(),
            "{name} pinned SHA-256"
        );
        String::from_utf8(bytes).unwrap()
    }

    /// The test-vector cases of a BIP text: (section, case title, PSBT
    /// bytes), from each case's base64 string. Sections are the lines that
    /// introduce a list ("The following are invalid PSBTs:" and the like);
    /// from BIP-174's role walkthrough on (its master key line), every PSBT
    /// is a walkthrough PSBT, which a role must create or is given.
    fn cases(text: &str) -> Vec<(String, String, Vec<u8>)> {
        let start = text
            .find("==Test Vectors==")
            .expect("a test vector section");
        let end = text[start..]
            .find("\n==Rationale==")
            .map_or(text.len(), |e| start + e);
        let (mut section, mut title) = (String::new(), String::new());
        let mut out = Vec::new();
        for line in text[start..end].lines() {
            let b64 = line
                .strip_prefix("** Base64 String: <pre>")
                .or_else(|| line.strip_prefix("* Base64 String: <pre>"));
            if let Some(t) = line.strip_prefix("* Case: ") {
                title = t.trim().to_string();
            } else if let Some(rest) = b64 {
                let b64 = rest.trim_end_matches("</pre>").trim();
                out.push((
                    section.clone(),
                    title.clone(),
                    from_base64(b64).expect("vector base64"),
                ));
            } else if line.starts_with("The private keys in the tests below") {
                section = "role walkthrough".into();
            } else if section != "role walkthrough"
                && ((!line.starts_with('*') && line.trim_end().ends_with(':'))
                    || line.trim() == "Fails Signer checks")
            {
                section = line.trim().to_string();
            }
        }
        out
    }

    #[test]
    #[ignore = "needs the pinned BIP-174 and BIP-371 texts: BPQ_BIP174_TEXT, BPQ_BIP371_TEXT (CI job pq12-taproot)"]
    fn bip174_and_bip371_vectors() {
        let mut tally = std::collections::BTreeMap::<String, usize>::new();
        let mut key_sigs = 0;
        for (name, var) in [("bip174", "BPQ_BIP174_TEXT"), ("bip371", "BPQ_BIP371_TEXT")] {
            let all = cases(&pinned_text(name, var));
            assert!(!all.is_empty(), "T-VACUOUS: {name} yielded no cases");
            for (section, title, bytes) in all {
                let parsed = parse(&bytes);
                let (want_ok, label) = if section.contains("invalid PSBTs") {
                    (false, "invalid, refused")
                } else if section.contains("valid PSBTs") {
                    (true, "valid, parsed")
                } else if section == "role walkthrough" {
                    (true, "role walkthrough PSBTs, parsed")
                } else if section == "Fails Signer checks" {
                    // valid PSBTs whose P2SH/P2WSH scripts a signer must
                    // reject; those script checks are not a Taproot key-path
                    // signer's, so only the format is claimed here
                    (true, "valid but failing BIP-174's P2SH/P2WSH signer checks, parsed (those checks not claimed)")
                } else {
                    continue;
                };
                match parsed {
                    Err(e) => {
                        assert!(!want_ok, "{name} {section} {title}: {e}");
                        println!("  {name} refused \"{title}\": {}", e.0);
                    }
                    Ok(p) => {
                        assert!(want_ok, "{name} {section} {title} parsed");
                        // a key-path signature a valid PSBT carries must verify
                        // over the sighash bsigner computes; one flipped bit
                        // must not
                        let sigs: Vec<(usize, Vec<u8>)> = p
                            .inputs
                            .iter()
                            .enumerate()
                            .filter_map(|(i, x)| x.tap_key_sig.clone().map(|s| (i, s)))
                            .collect();
                        if !sigs.is_empty() {
                            let v = signing_view(p).expect("a signed PSBT has its spent outputs");
                            for (i, sig) in sigs {
                                assert!(
                                    taproot::verify_key_path(&v.tx, &v.prevouts, i, &sig).is_ok(),
                                    "{name} {title}: input {i}'s key-path signature"
                                );
                                let mut bent = sig.clone();
                                bent[0] ^= 1;
                                assert!(
                                    taproot::verify_key_path(&v.tx, &v.prevouts, i, &bent).is_err()
                                );
                                key_sigs += 1;
                            }
                        }
                    }
                }
                *tally.entry(format!("{name} {label}")).or_default() += 1;
            }
        }
        for (k, n) in &tally {
            println!("PQ12-PSBT bsigner: {k}: {n} of {n}");
        }
        println!("PQ12-PSBT bsigner: key-path signatures carried by valid PSBTs that verify over bsigner's sighash (one flipped bit refused): {key_sigs}");
        assert!(key_sigs > 0, "T-VACUOUS: no key-path signature checked");
        assert!(
            tally.keys().any(|k| k.contains("invalid")),
            "T-VACUOUS: no invalid cases"
        );
    }

    fn psbt_with(global: &[u8], inputs: &[&[u8]], outputs: &[&[u8]]) -> Vec<u8> {
        let mut v = b"psbt\xff".to_vec();
        v.extend_from_slice(global);
        v.push(0);
        for m in inputs.iter().chain(outputs) {
            v.extend_from_slice(m);
            v.push(0);
        }
        v
    }

    fn kv(key_type: u8, key_data: &[u8], value: &[u8]) -> Vec<u8> {
        let mut k = vec![key_type];
        k.extend_from_slice(key_data);
        let mut v = vec![k.len() as u8];
        v.extend(k);
        v.push(value.len() as u8);
        v.extend_from_slice(value);
        v
    }

    /// One P2TR input spending 5000 sats, one 4000-sat output.
    fn small() -> (Vec<u8>, Vec<u8>, Vec<u8>) {
        let mut tx = vec![2, 0, 0, 0, 1];
        tx.extend_from_slice(&[7u8; 36]);
        tx.extend_from_slice(&[0, 0xff, 0xff, 0xff, 0xff, 1]);
        tx.extend_from_slice(&4000u64.to_le_bytes());
        tx.extend_from_slice(&[34, 0x51, 0x20]);
        tx.extend_from_slice(&[9u8; 32]);
        tx.extend_from_slice(&[0; 4]);
        let mut utxo = 5000u64.to_le_bytes().to_vec();
        utxo.extend_from_slice(&[34, 0x51, 0x20]);
        utxo.extend_from_slice(&[3u8; 32]);
        (kv(0x00, &[], &tx), kv(0x01, &[], &utxo), utxo)
    }

    #[test]
    fn the_signer_reads_only_complete_spendable_psbts() {
        let (g, wu, _) = small();
        let ok = psbt_with(&g, &[&wu], &[&[]]);
        let view = signing_view(parse(&ok).unwrap()).unwrap();
        assert_eq!(
            (view.fee, view.hash_types.clone()),
            (1000, vec![0x00]),
            "the control"
        );
        assert_eq!(
            taproot::sig_msg(
                &view.tx,
                &view.prevouts,
                &taproot::precompute(&view.tx, &view.prevouts).unwrap(),
                0,
                0
            )
            .map(|m| m.len()),
            Ok(1 + 4 + 4 + 32 * 5 + 1 + 4),
            "a SIGHASH_DEFAULT message has its fixed length"
        );
        // refused by the signer: the spent output missing, a hash type
        // outside BIP-341, more paid than spent
        assert!(
            signing_view(parse(&psbt_with(&g, &[&[]], &[&[]])).unwrap()).is_err(),
            "no spent output"
        );
        let st = kv(0x03, &[], &0x04u32.to_le_bytes());
        assert!(
            signing_view(parse(&psbt_with(&g, &[&[wu.clone(), st].concat()], &[&[]])).unwrap())
                .is_err(),
            "hash type 4"
        );
        let mut poor = 3000u64.to_le_bytes().to_vec();
        poor.extend_from_slice(&[34, 0x51, 0x20]);
        poor.extend_from_slice(&[3u8; 32]);
        assert!(
            signing_view(parse(&psbt_with(&g, &[&kv(0x01, &[], &poor)], &[&[]])).unwrap()).is_err(),
            "paid more than spent"
        );
        // refused by the reader
        let refused: Vec<(Vec<u8>, &str)> = vec![
            (
                psbt_with(&g, &[&[wu.clone(), wu.clone()].concat()], &[&[]]),
                "a duplicate key",
            ),
            (psbt_with(&g, &[&wu], &[]), "a missing output map"),
            (
                psbt_with(
                    &[g.clone(), kv(0xfb, &[], &2u32.to_le_bytes())].concat(),
                    &[&wu],
                    &[&[]],
                ),
                "version 2",
            ),
            (
                psbt_with(
                    &[g.clone(), kv(0x02, &[], &2u32.to_le_bytes())].concat(),
                    &[&wu],
                    &[&[]],
                ),
                "a version 2 global field",
            ),
            (
                psbt_with(
                    &g,
                    &[&[wu.clone(), kv(0x17, &[], &[1u8; 33])].concat()],
                    &[&[]],
                ),
                "a 33-byte internal key",
            ),
            (
                psbt_with(
                    &g,
                    &[&[wu.clone(), kv(0x13, &[], &[1u8; 63])].concat()],
                    &[&[]],
                ),
                "a 63-byte key-path signature",
            ),
            (
                psbt_with(
                    &g,
                    &[&[wu.clone(), kv(0x0b, &[1u8; 32], b"x")].concat()],
                    &[&[]],
                ),
                "a SHA-256 preimage that does not hash to its key",
            ),
            (
                psbt_with(&g, &[&wu], &[&kv(0x06, &[], &[129, 0xc0, 1, 0x51])]),
                "a leaf deeper than 128",
            ),
            (
                [psbt_with(&g, &[&wu], &[&[]]), vec![0]].concat(),
                "a trailing byte",
            ),
            (psbt_with(&[], &[&wu], &[&[]]), "no unsigned transaction"),
        ];
        for (b, why) in refused {
            assert!(parse(&b).is_err(), "{why} parsed");
        }
        for cut in 5..ok.len() {
            assert!(parse(&ok[..cut]).is_err(), "cut at {cut} parsed");
        }
        // a non-witness UTXO must be the transaction its outpoint names
        let mut prev = vec![2, 0, 0, 0, 1];
        prev.extend_from_slice(&[1u8; 36]);
        prev.extend_from_slice(&[0, 0, 0, 0, 0, 1]);
        prev.extend_from_slice(&5000u64.to_le_bytes());
        prev.extend_from_slice(&[34, 0x51, 0x20]);
        prev.extend_from_slice(&[3u8; 32]);
        prev.extend_from_slice(&[0; 4]);
        assert!(
            parse(&psbt_with(&g, &[&kv(0x00, &[], &prev)], &[&[]])).is_err(),
            "a non-witness UTXO for another txid"
        );
    }

    #[test]
    fn base64_is_read_only_in_its_canonical_form() {
        assert_eq!(from_base64("cHNidP8=").unwrap(), b"psbt\xff");
        for bad in ["cHNidP8", "cHNidP9=", "cHNid P8=", "cHNidP8==", "cHNi-P8="] {
            assert!(from_base64(bad).is_err(), "{bad} decoded");
        }
    }
}
