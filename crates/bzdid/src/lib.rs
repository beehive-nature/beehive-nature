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
//! succession/rotation signatures yet (next increment), no `.b` name
//! binding, no BEELOG, no Merkle proofs, no Vaulta epoch root. The root
//! alone already carries its value: a free-tier identity that costs
//! nothing, exists offline, and verifies in anyone's hands.
//!
//! FAIL CLOSED everywhere: unknown algorithms refused, non-canonical
//! encodings refused, structural doubts refused. A verifier that answers
//! plausibly when it should error is how identities get forged
//! (architecture §3.4 rule 10, applied at the root).

pub mod dagcbor;
pub mod did;
pub mod genesis;

pub use did::BzDid;
pub use genesis::{GenesisOp, KeyAlg, KeyCard};

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
