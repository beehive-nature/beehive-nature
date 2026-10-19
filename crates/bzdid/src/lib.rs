//! bzdid — the self-certifying `did:b:` root and its LOCAL verifier.
//!
//! First increment of the bzDiD engineering (founder order 2026-10-06:
//! "first the self-certifying `did:b:` root and verifier, then signed
//! succession/rotation, then `.b` BEELOG + independent proof verification,
//! then the minimal Vaulta epoch root"; architecture
//! `docs/bzdid-architecture-decision.md` §3.1/§1).
//!
//! THE LAW THIS CRATE IS: `bzDiD = "did:b:" ‖ base32(sha256(genesis_op))` —
//! the FULL 256-bit digest (the architecture's own correction of the
//! 128-bit candidate: adversarial birthday work at Bitcoin-class hashrate),
//! lowercase RFC 4648 base32, unpadded, 52 chars. Uniqueness is collision
//! resistance, not agreement: no issuer, no ordering, no registry, no DA,
//! no chain bytes, no cost. Anyone handed the genesis op verifies the
//! identity locally — **identity validity never trusts the service that
//! serves the proof** (the order's design principle, made mechanical).
//!
//! WHAT THIS INCREMENT IS NOT (named, so nobody reads more into it): no
//! `.b` name binding, no Vaulta epoch root yet. Signed succession/rotation
//! (ORDER BZDID-002 Phase 1) IS here — `succession::resolve_did` walks
//! the signed op chain with priority arbitration and fails closed on
//! every ambiguity. The root alone already carries its value: a
//! free-tier identity that costs nothing, exists offline, and verifies
//! in anyone's hands; the chain keeps that identity SOVEREIGN across key
//! changes — the did never moves, only the keys do.
//!
//! FAIL CLOSED everywhere: unknown algorithms refused, non-canonical
//! encodings refused, structural doubts refused. A verifier that answers
//! plausibly when it should error is how identities get forged
//! (architecture §3.4 rule 10, applied at the root).

pub mod anchor;
pub mod beelog;
pub mod dagcbor;
pub mod did;
pub mod genesis;
pub mod succession;

pub use did::BzDid;
pub use genesis::{GenesisOp, KeyAlg, KeyCard};
pub use succession::{
    resolve_did, rotate_body_bytes, DidState, LostFork, ResolvedDid, RotateOp, SuccessionError,
    ROTATE_DOMAIN, ROTATE_TYPE,
};

/// Everything that can go wrong, named — refusals are self-describing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BzDidError {
    Cbor(dagcbor::CborError),
    NotAGenesisOp(String),
    UnknownAlg(String),
    BadKeyLen {
        alg: String,
        expected: usize,
        got: usize,
    },
    BadRotationCount(usize),
    DuplicateRotationKey,
    BadValidUntil(u64),
    /// A signature does not verify under the key card it was checked
    /// against (bad bytes, wrong key, or a key since revoked).
    SignatureRejected,
    /// The handed bytes are a well-formed op — for a DIFFERENT identity.
    DidMismatch {
        claimed: String,
        computed: String,
    },
}

impl std::fmt::Display for BzDidError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BzDidError::Cbor(e) => write!(f, "genesis op bytes: {e}"),
            BzDidError::NotAGenesisOp(why) => write!(f, "not a genesis op: {why}"),
            BzDidError::UnknownAlg(id) => write!(
                f,
                "unknown key algorithm {id:?} — unlisted ids are added by ruling, never defaulted"
            ),
            BzDidError::BadKeyLen { alg, expected, got } => {
                write!(f, "{alg} public key must be {expected} bytes, got {got}")
            }
            BzDidError::BadRotationCount(n) => write!(
                f,
                "rotationKeys must carry 1..={} keys in priority order, got {n}",
                genesis::MAX_ROTATION_KEYS
            ),
            BzDidError::DuplicateRotationKey => {
                write!(f, "the same rotation key appears twice — malformed, refused")
            }
            BzDidError::BadValidUntil(v) => write!(f, "validUntil must be a nonzero unix second, got {v}"),
            BzDidError::SignatureRejected => write!(
                f,
                "the signature does not verify under the key card it names — refuse, never guess"
            ),
            BzDidError::DidMismatch { claimed, computed } => write!(
                f,
                "these bytes are not that identity: claimed {claimed}, bytes hash to {computed} — refuse, never guess"
            ),
        }
    }
}

impl std::error::Error for BzDidError {}

/// THE VERIFIER — the wallet's step 7 of architecture §3.4, at the root:
/// given op bytes and a claimed did, confirm the bytes ARE the identity.
///
/// Order of the checks: parse + structural laws first (the op must mean
/// something), then hash the HANDED BYTES and compare (the stored-bytes
/// law — never a re-encoding). Returns the typed op so the caller can
/// check `valid_at` separately: an expired identity still VERIFIES as what
/// it was; whether expired identities may act is the caller's fail-closed
/// policy, not this function's.
pub fn verify_genesis(bytes: &[u8], did: &BzDid) -> Result<GenesisOp, BzDidError> {
    let op = GenesisOp::parse(bytes)?;
    let computed = BzDid::derive(bytes);
    if &computed != did {
        return Err(BzDidError::DidMismatch {
            claimed: did.to_string(),
            computed: computed.to_string(),
        });
    }
    Ok(op)
}

#[cfg(test)]
mod tests {
    use super::*;
    use genesis::KeyAlg;

    fn demo() -> GenesisOp {
        GenesisOp {
            rotation_keys: vec![
                KeyCard::new(KeyAlg::Ed25519, vec![0xA1; 32]).unwrap(),
                KeyCard::new(KeyAlg::Ed25519, vec![0xB2; 32]).unwrap(),
            ],
            signing_key: KeyCard::new(KeyAlg::Ed25519, vec![0x5D; 32]).unwrap(),
            services: vec!["https://demo.example".into()],
            also_known_as: vec![],
            valid_until: 4_102_444_800,
        }
    }

    /// A structurally valid rotation op with placeholder signature bytes —
    /// for canon-shape tests only; resolution tests sign for real.
    pub(crate) fn demo_rotate() -> succession::RotateOp {
        succession::RotateOp {
            seq: 1,
            prev: [0x11; 32],
            at: 1_800_000_000,
            signed_by: 0,
            rotation_keys: vec![KeyCard::new(KeyAlg::Ed25519, vec![0xE4; 32]).unwrap()],
            signing_key: KeyCard::new(KeyAlg::Ed25519, vec![0x5E; 32]).unwrap(),
            services: vec!["https://demo.example".into()],
            also_known_as: vec![],
            valid_until: 4_102_444_801,
            sig: vec![0x5A; 64],
        }
    }

    /// A resolved two-op chain with REAL ed25519 signatures — the beelog
    /// identity-log test's fixture. Deterministic seeds, like every test
    /// key in this crate.
    pub(crate) fn demo_keys() -> (succession::ResolvedDid, Vec<u8>) {
        let mk = |seed: u8| {
            let mut s = [0u8; 32];
            s[0] = seed;
            ed25519_dalek::SigningKey::from_bytes(&s)
        };
        let r0 = mk(0xA1);
        let r1 = mk(0xB2);
        let genesis = GenesisOp {
            rotation_keys: vec![
                KeyCard::new(KeyAlg::Ed25519, r0.verifying_key().as_bytes().to_vec()).unwrap(),
                KeyCard::new(KeyAlg::Ed25519, r1.verifying_key().as_bytes().to_vec()).unwrap(),
            ],
            signing_key: KeyCard::new(KeyAlg::Ed25519, vec![0x5D; 32]).unwrap(),
            services: vec![],
            also_known_as: vec![],
            valid_until: 4_102_444_800,
        };
        let genesis_bytes = genesis.build().unwrap();
        let did = BzDid::derive(&genesis_bytes);
        let genesis_hash = {
            use sha2::Digest as _;
            let h: [u8; 32] = sha2::Sha256::digest(&genesis_bytes).into();
            h
        };
        let card = |k: &ed25519_dalek::SigningKey| {
            KeyCard::new(KeyAlg::Ed25519, k.verifying_key().as_bytes().to_vec()).unwrap()
        };
        let mut op1 = succession::RotateOp {
            seq: 1,
            prev: genesis_hash,
            at: 1_700_000_000,
            signed_by: 1,
            rotation_keys: vec![card(&r0)],
            signing_key: KeyCard::new(KeyAlg::Ed25519, vec![0x5E; 32]).unwrap(),
            services: vec![],
            also_known_as: vec![],
            valid_until: 4_102_444_800,
            sig: vec![0u8; 64],
        };
        use ed25519_dalek::Signer as _;
        op1.sig = r1
            .sign(&succession::rotate_body_bytes(&op1).unwrap())
            .to_bytes()
            .to_vec();
        let b1 = op1.build().unwrap();
        let h1 = op1.hash().unwrap();
        let mut op2 = succession::RotateOp {
            seq: 2,
            prev: h1,
            at: 1_700_000_100,
            signed_by: 0,
            rotation_keys: vec![card(&r1)],
            signing_key: KeyCard::new(KeyAlg::Ed25519, vec![0x5F; 32]).unwrap(),
            services: vec![],
            also_known_as: vec![],
            valid_until: 4_102_444_800,
            sig: vec![0u8; 64],
        };
        op2.sig = r0
            .sign(&succession::rotate_body_bytes(&op2).unwrap())
            .to_bytes()
            .to_vec();
        let b2 = op2.build().unwrap();
        let resolved = succession::resolve_did(&did, &genesis_bytes, &[b1, b2], None).unwrap();
        (resolved, genesis_bytes)
    }

    #[test]
    fn the_root_verifies_locally_and_fails_closed_on_any_tamper() {
        let op = demo();
        let bytes = op.build().unwrap();
        let did = BzDid::derive(&bytes);
        let parsed = verify_genesis(&bytes, &did).unwrap();
        assert_eq!(parsed, op);
        assert!(parsed.valid_at(1_800_000_000));

        // flip one byte anywhere in the op → a DIFFERENT identity, refused
        for i in [0usize, 12, 40, bytes.len() - 3] {
            let mut tampered = bytes.clone();
            tampered[i] ^= 0x01;
            let err = verify_genesis(&tampered, &did).unwrap_err();
            // either the structure broke (refused) or the hash moved (refused) —
            // there is no third outcome
            assert!(
                matches!(
                    err,
                    BzDidError::DidMismatch { .. }
                        | BzDidError::Cbor(_)
                        | BzDidError::NotAGenesisOp(_)
                ),
                "tamper at {i} must refuse, got {err:?}"
            );
        }

        // the SAME bytes claimed under a different did: the parser's shape
        // check alone cannot catch a well-formed neighbour — the HASH does
        let neighbour = {
            let mut n = did.to_string();
            let idx = "did:b:".len() + 7;
            n.replace_range(
                idx..idx + 1,
                if n.as_bytes()[idx] == b'a' { "b" } else { "a" },
            );
            BzDid::parse(&n).unwrap()
        };
        assert!(matches!(
            verify_genesis(&bytes, &neighbour),
            Err(BzDidError::DidMismatch { .. })
        ));
    }

    #[test]
    fn derive_is_pure_function_of_the_bytes() {
        let a = demo();
        let mut b = demo();
        b.services.push("https://another.example".into());
        let da = a.did().unwrap();
        let db = b.did().unwrap();
        assert_ne!(da, db, "any change to the op is a different identity");
        assert_eq!(da, BzDid::derive(&a.build().unwrap()), "derive is pure");
    }
}
