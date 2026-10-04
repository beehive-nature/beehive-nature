//! Versioned identity envelope builder (SPEC-PAY-ONCE-NOW-1 #2,
//! SPEC-VAULTA-IDENTITY-1 §2).
//!
//! Every key or address claim leaves the relay wrapped in a self-describing,
//! versioned, additive-only envelope. This file writes **v2** only:
//!
//! - `self_desc.sig_algo`, `self_desc.hash` and `self_desc.encoding` are
//!   derived from `key_algo` through [`KEY_ALGOS`], an explicit table. An id
//!   the table does not name is refused with an error, never defaulted.
//! - An address is not a key: the chain fixes the digest its signatures are
//!   computed over, so [`NETWORKS`] names `key_algo`, `hash` and `encoding`
//!   per chain (SPEC-VAULTA-IDENTITY-1 §0.2, "Per-chain self_desc hash (not
//!   global)"); `sig_algo` still comes from the key table through `key_algo`.
//! - `pq.ready` is true only when the wrapped key is itself ML-DSA-65, or the
//!   caller names a well-formed successor ([`PqSuccessor`], a bzpq1 id per
//!   SPEC-BPQ-1 §2), which then fills `pq.successor_algo` /
//!   `pq.successor_key_ref`. The successor is checked for FORM only (bech32m,
//!   hrp `bzpq`, 32 bytes). Nothing here binds it to the classical key's holder
//!   or checks it against a key card: that binding is the holder's own
//!   SPEC-BPQ-1 §3 binding statement, verified elsewhere. `pq.ready` means "a
//!   PQ successor is named", not "this envelope is covered by a PQ signature".
//!
//! v1 envelopes (written before this file) are never rewritten. They carried
//! `sig_algo:"ecdsa"` and `hash:"sha2-256"` as constants whatever the key, and
//! `pq.ready:true` with no successor; [`check`] reports them as
//! [`Checked::Legacy`] and leaves them as they are.

use bech32::{FromBase32, Variant};
use serde_json::{json, Value};

/// Schema version this file writes.
const V: u64 = 2;

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// One row of the key-algorithm table.
struct KeyAlgo {
    key_algo: &'static str,
    sig_algo: &'static str,
    /// The digest the signature scheme is computed over (or uses inside).
    hash: &'static str,
    /// How the key's text form is written.
    encoding: &'static str,
    /// The key itself is post-quantum.
    post_quantum: bool,
}

/// key_algo -> (sig_algo, hash, encoding). Hash ids are multicodec names.
const KEY_ALGOS: &[KeyAlgo] = &[
    // Antelope K1: ECDSA over secp256k1, digest SHA-256 (SPEC-VAULTA-IDENTITY-1
    // §0.2 "Antelope=SHA-256"). UNVERIFIED at crate source: no Antelope crate
    // is in this workspace. Key text: base58 (`PUB_K1_…`, legacy `EOS…`).
    KeyAlgo {
        key_algo: "k1",
        sig_algo: "ecdsa-secp256k1",
        hash: "sha2-256",
        encoding: "base58",
        post_quantum: false,
    },
    // Antelope R1: ECDSA over P-256, digest SHA-256 (same §0.2 stamp).
    // UNVERIFIED at crate source, as above.
    KeyAlgo {
        key_algo: "r1",
        sig_algo: "ecdsa-p256",
        hash: "sha2-256",
        encoding: "base58",
        post_quantum: false,
    },
    // Antelope WA: WebAuthn ES256 = ECDSA P-256 with SHA-256 (COSE alg -7).
    // UNVERIFIED at crate source: no WebAuthn crate is in this workspace.
    KeyAlgo {
        key_algo: "wa",
        sig_algo: "webauthn-es256",
        hash: "sha2-256",
        encoding: "base58",
        post_quantum: false,
    },
    // Ed25519 hashes with SHA-512 inside the signature: ed25519-dalek 2.2.0
    // src/signing.rs:568 `raw_sign::<Sha512>`. Key text base58, as
    // SPEC-BLOVERAI-BZDID-BONDING-1 §1 writes agent keys.
    KeyAlgo {
        key_algo: "ed25519",
        sig_algo: "ed25519",
        hash: "sha2-512",
        encoding: "base58",
        post_quantum: false,
    },
    // ML-DSA-65 (FIPS 204): its hash H is SHAKE-256, ml-dsa 0.1.1 (the
    // estate's implementation, crates/bsigner) src/crypto.rs:60
    // `type H = ShakeState<Shake256>`. Key text base64url, as SPEC-BPQ-1 §3
    // cards carry it.
    KeyAlgo {
        key_algo: "ml-dsa-65",
        sig_algo: "ml-dsa-65",
        hash: "shake-256",
        encoding: "base64url",
        post_quantum: true,
    },
];

/// One row of the address table: the chain names the digest.
struct Chain {
    names: &'static [&'static str],
    key_algo: &'static str,
    hash: &'static str,
    encoding: &'static str,
}

const NETWORKS: &[Chain] = &[
    // EVM: secp256k1 ECDSA over a Keccak-256 signing preimage
    // (crates/watchpay/src/signed_tx.rs:26 and :29).
    Chain {
        names: &["evm", "ethereum"],
        key_algo: "k1",
        hash: "keccak-256",
        encoding: "hex",
    },
    // Bitcoin legacy / segwit-v0: secp256k1 ECDSA over a double SHA-256
    // sighash. UNVERIFIED at crate source: no Bitcoin crate is in this
    // workspace. A taproot (bc1p) address signs with BIP-340 Schnorr, which
    // this row does not describe.
    Chain {
        names: &["btc", "bitcoin"],
        key_algo: "k1",
        hash: "dbl-sha2-256",
        encoding: "base58check",
    },
    // Zcash transparent: secp256k1 ECDSA over a BLAKE2b-256 sighash
    // (ZIP 243 / ZIP 244). UNVERIFIED at crate source: no Zcash crate is in
    // this workspace.
    Chain {
        names: &["zec", "zcash"],
        key_algo: "k1",
        hash: "blake2b-256",
        encoding: "base58check",
    },
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EnvelopeError {
    UnknownKeyAlgo(String),
    UnknownNetwork(String),
    UnknownSuccessorAlgo(String),
    SuccessorAlgoWithoutRef,
    NotABzpqId(String),
    UnknownVersion(String),
    UnknownPayloadType(String),
    /// A v2 envelope field says something its own key_algo / network /
    /// successor does not.
    Mismatch(&'static str),
}

impl std::fmt::Display for EnvelopeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnknownKeyAlgo(a) => write!(f, "unknown key_algo {a:?}: refused, never defaulted"),
            Self::UnknownNetwork(n) => write!(f, "unknown network {n:?}: refused, never defaulted"),
            Self::UnknownSuccessorAlgo(a) => write!(
                f,
                "unknown successor_algo {a:?}: only {:?} is named",
                PqSuccessor::ALGO
            ),
            Self::SuccessorAlgoWithoutRef => {
                write!(f, "successor_algo given without successor_key_ref")
            }
            Self::NotABzpqId(r) => write!(
                f,
                "successor_key_ref {r:?} is not a bzpq1 id (bech32m, hrp bzpq, 32-byte payload)"
            ),
            Self::UnknownVersion(v) => write!(f, "unknown envelope version {v}: refused"),
            Self::UnknownPayloadType(t) => write!(f, "unknown payload.type {t:?}"),
            Self::Mismatch(field) => write!(
                f,
                "envelope {field} disagrees with what its own key_algo, network and successor derive"
            ),
        }
    }
}

fn key_row(key_algo: &str) -> Result<&'static KeyAlgo, EnvelopeError> {
    KEY_ALGOS
        .iter()
        .find(|r| r.key_algo == key_algo)
        .ok_or_else(|| EnvelopeError::UnknownKeyAlgo(key_algo.to_string()))
}

fn chain_row(network: &str) -> Result<&'static Chain, EnvelopeError> {
    NETWORKS
        .iter()
        .find(|c| c.names.contains(&network))
        .ok_or_else(|| EnvelopeError::UnknownNetwork(network.to_string()))
}

/// A post-quantum successor: the bzpq1 id (SPEC-BPQ-1 §2) of the identity
/// that succeeds the key or address in an envelope.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PqSuccessor {
    key_ref: String,
}

impl PqSuccessor {
    /// The only successor algorithm this build names. A bzpq1 id commits to
    /// an ML-DSA-65 public key (SPEC-BPQ-1 §2), so the id's form fixes it.
    pub const ALGO: &'static str = "ml-dsa-65";

    /// Accept `id` only in bzpq1 form: bech32m, hrp `bzpq`, 32-byte payload
    /// (decoded with bech32 0.9.1 src/lib.rs:516 `decode`). Form only: whether
    /// the id commits to a real key is checked where the key card is
    /// (crates/bsigner `verify_card`), not here. Stored in canonical
    /// lowercase.
    pub fn from_bzpq_id(id: &str) -> Result<Self, EnvelopeError> {
        let bad = || EnvelopeError::NotABzpqId(id.to_string());
        let (hrp, data, variant) = bech32::decode(id).map_err(|_| bad())?;
        if hrp != "bzpq" || variant != Variant::Bech32m {
            return Err(bad());
        }
        let bytes = Vec::<u8>::from_base32(&data).map_err(|_| bad())?;
        if bytes.len() != 32 {
            return Err(bad());
        }
        let key_ref = bech32::encode("bzpq", data, Variant::Bech32m).map_err(|_| bad())?;
        Ok(Self { key_ref })
    }

    /// The successor a request asks for, if any. `successor_algo` may be
    /// omitted (the id names it); when given it must be [`Self::ALGO`].
    pub fn from_request(
        successor_algo: Option<&str>,
        successor_key_ref: Option<&str>,
    ) -> Result<Option<Self>, EnvelopeError> {
        if let Some(algo) = successor_algo {
            if algo != Self::ALGO {
                return Err(EnvelopeError::UnknownSuccessorAlgo(algo.to_string()));
            }
        }
        match successor_key_ref {
            Some(id) => Self::from_bzpq_id(id).map(Some),
            None if successor_algo.is_some() => Err(EnvelopeError::SuccessorAlgoWithoutRef),
            None => Ok(None),
        }
    }

    pub fn key_ref(&self) -> &str {
        &self.key_ref
    }
}

fn pq_block(key_is_pq: bool, successor: Option<&PqSuccessor>) -> Value {
    match successor {
        Some(s) => json!({
            "ready": true,
            "successor_algo": PqSuccessor::ALGO,
            "successor_key_ref": s.key_ref(),
        }),
        None => json!({ "ready": key_is_pq, "successor_algo": null, "successor_key_ref": null }),
    }
}

/// Wrap a device-read address in a v2 envelope. Unknown network: refused.
pub fn address_envelope(
    address: &str,
    network: &str,
    source: &str,
    tier: &str,
    successor: Option<&PqSuccessor>,
) -> Result<Value, EnvelopeError> {
    let chain = chain_row(network)?;
    let key = key_row(chain.key_algo)?;
    Ok(json!({ "v": V,
        "self_desc": { "key_algo": key.key_algo, "sig_algo": key.sig_algo,
            "hash": chain.hash, "encoding": chain.encoding },
        "pq": pq_block(key.post_quantum, successor),
        "payload": { "type": "address", "value": address, "network": network,
            "source": source, "custody_tier": tier },
        "timestamp": now() }))
}

/// Wrap a public key in a v2 envelope. Unknown key_algo: refused.
pub fn pubkey_envelope(
    pubkey: &str,
    key_algo: &str,
    source: &str,
    tier: &str,
    successor: Option<&PqSuccessor>,
) -> Result<Value, EnvelopeError> {
    let key = key_row(key_algo)?;
    Ok(json!({ "v": V,
        "self_desc": { "key_algo": key.key_algo, "sig_algo": key.sig_algo,
            "hash": key.hash, "encoding": key.encoding },
        "pq": pq_block(key.post_quantum, successor),
        "payload": { "type": "pubkey", "value": pubkey, "source": source, "custody_tier": tier },
        "timestamp": now() }))
}

/// What [`check`] found.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Checked {
    /// No `v`, or `v:1`: written before v2, accepted as it is.
    Legacy,
    /// `v:2`, and its `self_desc` and `pq` are exactly what its own
    /// key_algo / network and successor derive.
    V2,
}

/// Re-derive a v2 envelope's `self_desc` and `pq` block from its own
/// key_algo (pubkey) or network (address) and successor, and refuse any
/// field that says something else, including a `pq.ready` prettier than the
/// key and successor behind it. Any other version is refused.
pub fn check(env: &Value) -> Result<Checked, EnvelopeError> {
    match env.get("v") {
        None => return Ok(Checked::Legacy),
        Some(v) if v.as_u64() == Some(1) => return Ok(Checked::Legacy),
        Some(v) if v.as_u64() == Some(V) => {}
        Some(v) => return Err(EnvelopeError::UnknownVersion(v.to_string())),
    }
    let successor = PqSuccessor::from_request(
        env["pq"]["successor_algo"].as_str(),
        env["pq"]["successor_key_ref"].as_str(),
    )?;
    let value = env["payload"]["value"].as_str().unwrap_or("");
    let expected = match env["payload"]["type"].as_str() {
        Some("pubkey") => {
            let key_algo = env["self_desc"]["key_algo"].as_str().unwrap_or("");
            pubkey_envelope(value, key_algo, "", "", successor.as_ref())?
        }
        Some("address") => {
            let network = env["payload"]["network"].as_str().unwrap_or("");
            address_envelope(value, network, "", "", successor.as_ref())?
        }
        other => {
            return Err(EnvelopeError::UnknownPayloadType(
                other.unwrap_or("").to_string(),
            ))
        }
    };
    if env.get("self_desc") != Some(&expected["self_desc"]) {
        return Err(EnvelopeError::Mismatch("self_desc"));
    }
    if env.get("pq") != Some(&expected["pq"]) {
        return Err(EnvelopeError::Mismatch("pq"));
    }
    Ok(Checked::V2)
}

#[cfg(test)]
mod tests {
    use super::*;
    use bech32::ToBase32;

    const VECTORS: &str = include_str!("../../../surfaces/bpq-vectors.json");

    /// The bzpq1 ids of the SPEC-BPQ-1 cross-implementation vectors (keys
    /// derived from public sentences; no real identity).
    fn vector_ids() -> Vec<String> {
        let v: Value = serde_json::from_str(VECTORS).expect("bpq-vectors.json parses");
        let ids: Vec<String> = v["keys"]
            .as_array()
            .expect("keys")
            .iter()
            .map(|k| k["id"].as_str().expect("id").to_string())
            .collect();
        assert_eq!(ids.len(), 3);
        ids
    }

    fn successor() -> PqSuccessor {
        PqSuccessor::from_bzpq_id(&vector_ids()[0]).expect("vector id is a bzpq1 id")
    }

    #[test]
    fn every_key_algo_row_derives_its_own_ids() {
        // Expected values written out here, not read from the table, so a
        // table edit cannot pass by agreeing with itself.
        let rows = [
            ("k1", "ecdsa-secp256k1", "sha2-256", "base58", false),
            ("r1", "ecdsa-p256", "sha2-256", "base58", false),
            ("wa", "webauthn-es256", "sha2-256", "base58", false),
            ("ed25519", "ed25519", "sha2-512", "base58", false),
            ("ml-dsa-65", "ml-dsa-65", "shake-256", "base64url", true),
        ];
        assert_eq!(rows.len(), KEY_ALGOS.len(), "every table row is tested");
        for (key_algo, sig_algo, hash, encoding, pq) in rows {
            let e = pubkey_envelope("KEY", key_algo, "test", "T-F", None).unwrap();
            assert_eq!(e["v"], 2);
            assert_eq!(e["self_desc"]["key_algo"], key_algo);
            assert_eq!(e["self_desc"]["sig_algo"], sig_algo, "{key_algo}");
            assert_eq!(e["self_desc"]["hash"], hash, "{key_algo}");
            assert_eq!(e["self_desc"]["encoding"], encoding, "{key_algo}");
            assert_eq!(e["pq"]["ready"], pq, "{key_algo}: ready only if PQ-covered");
            assert_eq!(e["payload"]["value"], "KEY");
            assert_eq!(check(&e), Ok(Checked::V2));
        }
    }

    #[test]
    fn unknown_key_algo_is_refused_never_defaulted() {
        for bad in [
            "secp256k1",
            "",
            "K1",
            "ecdsa",
            "ml-dsa-87",
            "slh-dsa-shake-256f",
        ] {
            assert_eq!(
                pubkey_envelope("KEY", bad, "test", "T-F", None),
                Err(EnvelopeError::UnknownKeyAlgo(bad.to_string()))
            );
        }
    }

    #[test]
    fn every_network_row_names_its_chain_digest() {
        let rows = [
            ("evm", "keccak-256", "hex"),
            ("ethereum", "keccak-256", "hex"),
            ("btc", "dbl-sha2-256", "base58check"),
            ("bitcoin", "dbl-sha2-256", "base58check"),
            ("zec", "blake2b-256", "base58check"),
            ("zcash", "blake2b-256", "base58check"),
        ];
        assert_eq!(
            rows.len(),
            NETWORKS.iter().map(|c| c.names.len()).sum::<usize>()
        );
        for (network, hash, encoding) in rows {
            let e = address_envelope("ADDR", network, "trezor-device-read", "T-H", None).unwrap();
            assert_eq!(e["v"], 2);
            assert_eq!(e["self_desc"]["key_algo"], "k1", "{network}");
            assert_eq!(e["self_desc"]["sig_algo"], "ecdsa-secp256k1", "{network}");
            assert_eq!(e["self_desc"]["hash"], hash, "{network}");
            assert_eq!(e["self_desc"]["encoding"], encoding, "{network}");
            assert_eq!(e["payload"]["network"], network);
            assert_eq!(check(&e), Ok(Checked::V2));
        }
        for bad in ["sol", "", "EVM", "unknown"] {
            assert_eq!(
                address_envelope("ADDR", bad, "manual", "T-S", None),
                Err(EnvelopeError::UnknownNetwork(bad.to_string()))
            );
        }
    }

    #[test]
    fn successor_absent_means_not_ready_for_a_classical_key() {
        let e = pubkey_envelope("KEY", "k1", "test", "T-H", None).unwrap();
        assert_eq!(
            e["pq"],
            json!({"ready": false, "successor_algo": null, "successor_key_ref": null})
        );
        let a = address_envelope("ADDR", "evm", "test", "T-H", None).unwrap();
        assert_eq!(a["pq"], e["pq"]);
    }

    #[test]
    fn successor_present_fills_both_fields_and_ready() {
        for id in vector_ids() {
            let s = PqSuccessor::from_bzpq_id(&id).unwrap();
            assert_eq!(s.key_ref(), id);
            let e = pubkey_envelope("KEY", "k1", "test", "T-H", Some(&s)).unwrap();
            assert_eq!(
                e["pq"],
                json!({"ready": true, "successor_algo": "ml-dsa-65", "successor_key_ref": id})
            );
            let a = address_envelope("ADDR", "btc", "test", "T-H", Some(&s)).unwrap();
            assert_eq!(a["pq"], e["pq"]);
            assert_eq!(check(&e), Ok(Checked::V2));
            assert_eq!(check(&a), Ok(Checked::V2));
        }
    }

    #[test]
    fn successor_ref_must_be_a_bzpq1_id() {
        let v: Value = serde_json::from_str(VECTORS).unwrap();
        let id = vector_ids()[1].clone();
        // a valid bech32m string under another hrp (the recovery-code form)
        let recovery = v["keys"][0]["recoveryCode"].as_str().unwrap();
        // one character changed: the checksum must catch it
        let mut flipped = id.clone().into_bytes();
        let last = flipped.len() - 1;
        flipped[last] = if flipped[last] == b'q' { b'p' } else { b'q' };
        let flipped = String::from_utf8(flipped).unwrap();
        // right hrp, wrong checksum variant (bech32, not bech32m)
        let bech32_plain = bech32::encode("bzpq", [7u8; 32].to_base32(), Variant::Bech32).unwrap();
        // right hrp and variant, wrong payload length
        let short = bech32::encode("bzpq", [7u8; 20].to_base32(), Variant::Bech32m).unwrap();
        for bad in [
            recovery,
            flipped.as_str(),
            bech32_plain.as_str(),
            short.as_str(),
            "",
            "bzpq1",
        ] {
            assert_eq!(
                PqSuccessor::from_bzpq_id(bad),
                Err(EnvelopeError::NotABzpqId(bad.to_string())),
                "{bad}"
            );
        }
        // all-uppercase bech32 is valid and is stored lowercase
        let upper = PqSuccessor::from_bzpq_id(&id.to_ascii_uppercase()).unwrap();
        assert_eq!(upper.key_ref(), id);
    }

    #[test]
    fn successor_request_shapes() {
        let id_owned = vector_ids()[2].clone();
        let id = id_owned.as_str();
        assert_eq!(PqSuccessor::from_request(None, None), Ok(None));
        assert_eq!(
            PqSuccessor::from_request(None, Some(id))
                .unwrap()
                .unwrap()
                .key_ref(),
            id
        );
        assert_eq!(
            PqSuccessor::from_request(Some("ml-dsa-65"), Some(id))
                .unwrap()
                .unwrap()
                .key_ref(),
            id
        );
        assert_eq!(
            PqSuccessor::from_request(Some("ml-dsa-65"), None),
            Err(EnvelopeError::SuccessorAlgoWithoutRef)
        );
        assert_eq!(
            PqSuccessor::from_request(Some("slh-dsa-shake-256f"), Some(id)),
            Err(EnvelopeError::UnknownSuccessorAlgo(
                "slh-dsa-shake-256f".into()
            ))
        );
    }

    #[test]
    fn check_refuses_v2_fields_prettier_than_their_derivation() {
        let good = pubkey_envelope("KEY", "k1", "test", "T-H", None).unwrap();

        // the v1 shape's ready-without-successor, under a v2 label
        let mut e = good.clone();
        e["pq"]["ready"] = json!(true);
        assert_eq!(check(&e), Err(EnvelopeError::Mismatch("pq")));

        // the v1 constant sig_algo under a v2 label
        let mut e = good.clone();
        e["self_desc"]["sig_algo"] = json!("ecdsa");
        assert_eq!(check(&e), Err(EnvelopeError::Mismatch("self_desc")));

        // a successor_algo with no ref
        let mut e = good.clone();
        e["pq"]["successor_algo"] = json!("ml-dsa-65");
        assert_eq!(check(&e), Err(EnvelopeError::SuccessorAlgoWithoutRef));

        // a bad successor ref
        let mut e = good.clone();
        e["pq"]["successor_key_ref"] = json!("bzpq1notanid");
        assert!(matches!(check(&e), Err(EnvelopeError::NotABzpqId(_))));

        // an unknown key_algo
        let mut e = good.clone();
        e["self_desc"]["key_algo"] = json!("secp256k1");
        assert!(matches!(check(&e), Err(EnvelopeError::UnknownKeyAlgo(_))));

        // an address whose hash is not its chain's
        let mut a = address_envelope("ADDR", "evm", "t", "T-H", Some(&successor())).unwrap();
        a["self_desc"]["hash"] = json!("sha2-256");
        assert_eq!(check(&a), Err(EnvelopeError::Mismatch("self_desc")));

        // an unknown payload type
        let mut e = good.clone();
        e["payload"]["type"] = json!("vaulta-permission");
        assert!(matches!(
            check(&e),
            Err(EnvelopeError::UnknownPayloadType(_))
        ));
    }

    #[test]
    fn check_leaves_v1_alone_and_refuses_unknown_versions() {
        // the exact v1 shape this file used to write: still accepted as it is
        let v1 = json!({ "v":1, "self_desc":{"key_algo":"secp256k1","sig_algo":"ecdsa","hash":"sha2-256","encoding":"base58"},
            "pq":{"ready":true,"successor_algo":null,"successor_key_ref":null},
            "payload":{"type":"pubkey","value":"KEY","source":"test","custody_tier":"T-F"}, "timestamp":0 });
        assert_eq!(check(&v1), Ok(Checked::Legacy));
        assert_eq!(check(&json!({"payload":{}})), Ok(Checked::Legacy));
        for v in [json!(3), json!("2"), json!(0), json!(null)] {
            let mut e = pubkey_envelope("KEY", "k1", "t", "T-F", None).unwrap();
            e["v"] = v.clone();
            assert_eq!(check(&e), Err(EnvelopeError::UnknownVersion(v.to_string())));
        }
    }
}
