//! Signed succession and rotation — ORDER BZDID-002 Phase 1.
//!
//! The genesis op commits a rotation keyset in PRIORITY order; this module
//! is the machinery that lets that keyset CHANGE without the identity
//! moving: `bzDiD = hash(genesis_op)` forever, and every later state is a
//! signed op chained back to that root by hash pointers. The sovereign
//! root survives every rotation BY CONSTRUCTION — an op carries no did
//! field at all; it can only belong to the chain its `prev` walks into.
//!
//! Byte-level v1 canon (`BDID-ROTATE-V1`; changing any byte of this
//! encoding is a v2 ceremony, never an edit — the same law as the frozen
//! genesis canon, pinned by `tests/succession.rs`):
//!
//! ```text
//! rotate_op = dag-cbor({
//!   "type":         "b:rotate",             // the one literal
//!   "seq":          uint,                   // 1..; genesis is 0; NO GAPS
//!   "prev":         bytes(32),              // sha256 of the predecessor's STORED bytes
//!   "at":           uint,                   // claimed signing moment, unix seconds
//!   "signedBy":     uint,                   // index into the PREDECESSOR keyset
//!   "rotationKeys": [ {alg, key} × 1..8 ],  // the NEW keyset (replaces, priority order)
//!   "signingKey":   {alg, key},             // the new op-signing key
//!   "services":     [ text × 0..16 ],
//!   "alsoKnownAs":  [ text × 0..16 ],
//!   "validUntil":   uint,                   // the new expiry (renewal or shortening)
//!   "sig":          bytes                   // the signature over the body
//! })
//! ```
//!
//! The signed message is the op WITHOUT the `sig` field, canonically
//! encoded, prefixed with the domain separator `"did:b:rotate/v1" ‖ 0x00`
//! (the settle-nerve domain-separation law: one signature binds the
//! document AND its domain, so a rotation signature is never replayable as
//! another protocol's authorization). Verification dispatches on the
//! algorithm id the PREDECESSOR key card carries — `ml-dsa-65` (bSigner's
//! registry, the organ that signs in production) and `ed25519` — and
//! refuses anything else. THIS CRATE ONLY VERIFIES: it holds no keys and
//! has no custody; signing is bSigner's job through its frozen CLI
//! (`tests/bsigner_organ.rs` proves the closed loop through the real
//! organ).
//!
//! ## The arbitration law (the architecture's hardest named piece)
//!
//! Two valid ops at the same `seq`, same `prev`, signed by
//! different-priority keys: **the lower `signedBy` index wins** — r0, the
//! key kept furthest offline, outranks every later key at the moment of
//! divergence. This is priority, NOT longest-chain: a thief holding r1 can
//! extend a stolen fork forever and r0's single recovery op still governs.
//! Two valid ops at the same seq signed by the SAME index are an
//! `Equivocation` — the key itself is forked and no rule can honestly pick
//! a winner, so resolution refuses. Which branch won at which step, and
//! what lost, is returned as evidence (`lost_forks`); what a wallet does
//! with a losing branch it once trusted is caller policy — this verifier
//! reports, it never silently rebase-s.
//!
//! **Equivocation is asymmetric, by design** (review NOTE-1): on the
//! canonical path, same-index twins BELOW a higher-priority winner are
//! recorded as evidence and do not poison the resolution (r0 governs; a
//! misbehaving r1 cannot hold the identity hostage). On a LOSING branch,
//! same-index twins still refuse — an equivocating key is evidence of
//! compromise anywhere it appears, and nothing on a discarded branch is
//! worth tolerating it for.
//!
//! ## Honest limits, named so nobody reads more into this (review NOTEs)
//!
//! - `at` is a CLAIM inside the signed body: the time laws bind the
//!   signer's word, not wall-clock truth. A compromised key can backdate
//!   `at`; a later anchor/witness layer is where reality-time binds.
//! - The rollback floor is a SEQ SCALAR: it catches a head moving
//!   backwards, not a same-seq head swap — which is exactly the designed
//!   recovery gesture (a higher-priority op displacing a resolved one at
//!   the same seq, the loser returned as evidence). Callers that need
//!   fork detection at a seq use the BEELOG head comparison, not the
//!   floor.
//! - Any parseable op with a garbage signature refuses the whole
//!   resolution — fail closed by §3.4 rule 10; candidate feeds are the
//!   caller's authenticated sources.
//!
//! ## What the verifier refuses (all fail closed, all named)
//!
//! - **Authorization** — `signedBy` outside the predecessor keyset.
//! - **Invalid signature** — bytes that do not verify under the key the
//!   index names (this is also how a REVOKED key dies: after a rotation
//!   removes it, its old index names a different key and its signature no
//!   longer verifies).
//! - **Expiry** — an op claiming `at >= validUntil` of the state it
//!   extends was signed after that state expired (by its own claim);
//!   identities do not resurrect on paper. The boundary refuses
//!   (inclusive-edge law).
//! - **Time inversion** — `at` may not go backwards along a chain.
//! - **Rollback** — the caller's floor (the highest seq it has EVER
//!   verified) above the resolved head: withholding or fork-recovery,
//!   never silently accepted (§3.4 step 7).
//! - **Withholding** — handed evidence of ops beyond the head that chain
//!   to bytes we were not given.
//! - **Unchained** — an op whose `prev` hashes nothing handed: foreign or
//!   corrupt.
//! - **Equivocation** — same-priority conflicting successors (above).
//!
//! NOTHING handed goes unverified: losing branches are signature-checked
//! against their own claimed predecessors before they are allowed to
//! exist as evidence.

use crate::dagcbor::{self, DagValue};
use crate::did::BzDid;
use crate::genesis::{
    card_from_value, card_to_value, strings_from_value, GenesisOp, KeyCard, MAX_ROTATION_KEYS,
    MAX_STRINGS,
};
use crate::BzDidError;
use sha2::{Digest, Sha256};

/// The domain separator every rotation signature is prefixed with:
/// `"did:b:rotate/v1" ‖ 0x00 ‖ canonical body bytes`.
pub const ROTATE_DOMAIN: &[u8] = b"did:b:rotate/v1\x00";

/// The one literal a rotation op's `type` field may carry.
pub const ROTATE_TYPE: &str = "b:rotate";

/// Hard cap on the `sig` field at parse time (ml-dsa-65 signatures are
/// 3309 bytes; the cap only bounds memory, exact lengths are enforced per
/// algorithm at verification).
pub const MAX_SIG_BYTES: usize = 4096;

/// Everything refusal-shaped in succession, named.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SuccessionError {
    Genesis(BzDidError),
    Cbor(dagcbor::CborError),
    NotARotateOp(String),
    Unauthorized {
        seq: u64,
        signed_by: u64,
    },
    InvalidSignature {
        seq: u64,
        signed_by: u64,
    },
    SignedAfterExpiry {
        seq: u64,
        at: u64,
        valid_until: u64,
    },
    TimeWentBackwards {
        seq: u64,
        at: u64,
        previous_at: u64,
    },
    /// Two different valid ops, same seq, same `prev`, same signing index.
    Equivocation {
        seq: u64,
        signed_by: u64,
    },
    /// An op whose `seq` disagrees with the state its `prev` points at.
    BrokenChain {
        seq: u64,
        prev_pointed_seq: u64,
    },
    /// Handed ops beyond the head chaining to bytes we were not given.
    Withholding {
        head_seq: u64,
        evidence_seq: u64,
    },
    /// An op whose `prev` hashes nothing handed — foreign or corrupt.
    Unchained {
        seq: u64,
    },
    /// The caller's floor (highest seq ever verified) is above the head.
    Rollback {
        floor: u64,
        head_seq: u64,
    },
}

impl std::fmt::Display for SuccessionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SuccessionError::Genesis(e) => write!(f, "the genesis refused: {e}"),
            SuccessionError::Cbor(e) => write!(f, "an op's bytes are not dag-cbor: {e}"),
            SuccessionError::NotARotateOp(why) => write!(f, "not a rotation op: {why}"),
            SuccessionError::Unauthorized { seq, signed_by } => write!(
                f,
                "op at seq {seq} claims signing index {signed_by} outside the predecessor keyset — unauthorized, refuse"
            ),
            SuccessionError::InvalidSignature { seq, signed_by } => write!(
                f,
                "op at seq {seq} does not verify under the key index {signed_by} names — bad signature or a revoked key, refuse"
            ),
            SuccessionError::SignedAfterExpiry { seq, at, valid_until } => write!(
                f,
                "op at seq {seq} claims signing moment {at} at/after the state's expiry {valid_until} — identities do not resurrect, refuse"
            ),
            SuccessionError::TimeWentBackwards { seq, at, previous_at } => write!(
                f,
                "op at seq {seq} claims moment {at} before its predecessor's {previous_at} — time inversion, refuse"
            ),
            SuccessionError::Equivocation { seq, signed_by } => write!(
                f,
                "two different valid ops at seq {seq} signed by the same key index {signed_by} — the key itself is forked, refuse"
            ),
            SuccessionError::BrokenChain { seq, prev_pointed_seq } => write!(
                f,
                "op claims seq {seq} but its prev points at a state at seq {prev_pointed_seq} — broken chain, refuse"
            ),
            SuccessionError::Withholding { head_seq, evidence_seq } => write!(
                f,
                "handed evidence of an op at seq {evidence_seq} chaining past the head {head_seq} to bytes withheld — refuse"
            ),
            SuccessionError::Unchained { seq } => write!(
                f,
                "op at seq {seq} chains to nothing handed — foreign or corrupt, refuse"
            ),
            SuccessionError::Rollback { floor, head_seq } => write!(
                f,
                "the resolved head {head_seq} is below the previously-verified floor {floor} — withholding or fork recovery, refuse and look"
            ),
        }
    }
}

impl std::error::Error for SuccessionError {}

impl From<BzDidError> for SuccessionError {
    fn from(e: BzDidError) -> Self {
        SuccessionError::Genesis(e)
    }
}

impl From<dagcbor::CborError> for SuccessionError {
    fn from(e: dagcbor::CborError) -> Self {
        SuccessionError::Cbor(e)
    }
}

/// The signed rotation op, typed. Build the body, sign it with the organ,
/// attach `sig`, hand the stored bytes to anyone.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RotateOp {
    /// 1..; the genesis is seq 0. No gaps: an op at seq n extends the
    /// state at seq n−1 exactly.
    pub seq: u64,
    /// sha256 of the predecessor's STORED bytes. For seq 1 this is the
    /// genesis digest — which IS the did's 32-byte body.
    pub prev: [u8; 32],
    /// Claimed signing moment, unix seconds. Must be strictly before the
    /// predecessor state's `valid_until` and not before its `last_at`.
    pub at: u64,
    /// Index into the PREDECESSOR rotation keyset — the priority claim,
    /// inside the signed body so it cannot be rewritten.
    pub signed_by: u64,
    pub rotation_keys: Vec<KeyCard>,
    pub signing_key: KeyCard,
    pub services: Vec<String>,
    pub also_known_as: Vec<String>,
    pub valid_until: u64,
    pub sig: Vec<u8>,
}

/// The op with its signature stripped — the exact bytes a signer signs,
/// domain-prefixed. Building it from a parsed op re-encodes canonically;
/// VERIFICATION always signs-checks against THIS derivation of the handed
/// op's own fields, and the head-chain hashes the handed stored bytes, so
/// no serialiser can rewrite history (stored-bytes law, spine edition).
pub fn rotate_body_bytes(op: &RotateOp) -> Result<Vec<u8>, SuccessionError> {
    op.validate()?;
    let body = DagValue::Map(vec![
        ("type".into(), DagValue::text(ROTATE_TYPE)),
        ("seq".into(), DagValue::UInt(op.seq)),
        ("prev".into(), DagValue::Bytes(op.prev.to_vec())),
        ("at".into(), DagValue::UInt(op.at)),
        ("signedBy".into(), DagValue::UInt(op.signed_by)),
        (
            "rotationKeys".into(),
            DagValue::Array(op.rotation_keys.iter().map(card_to_value).collect()),
        ),
        ("signingKey".into(), card_to_value(&op.signing_key)),
        (
            "services".into(),
            DagValue::Array(op.services.iter().map(|s| DagValue::text(s)).collect()),
        ),
        (
            "alsoKnownAs".into(),
            DagValue::Array(op.also_known_as.iter().map(|s| DagValue::text(s)).collect()),
        ),
        ("validUntil".into(), DagValue::UInt(op.valid_until)),
    ]);
    let mut msg = ROTATE_DOMAIN.to_vec();
    msg.extend(dagcbor::encode(&body));
    Ok(msg)
}

impl RotateOp {
    /// Structural validation before any encoding — the same keyset and
    /// string laws the genesis carries, plus the rotate-only shapes.
    pub fn validate(&self) -> Result<(), SuccessionError> {
        let bad = |why: &str| SuccessionError::NotARotateOp(why.into());
        if self.seq == 0 {
            return Err(bad("seq must be 1..; the genesis is seq 0"));
        }
        if self.rotation_keys.is_empty() || self.rotation_keys.len() > MAX_ROTATION_KEYS {
            return Err(SuccessionError::Genesis(BzDidError::BadRotationCount(
                self.rotation_keys.len(),
            )));
        }
        for card in self
            .rotation_keys
            .iter()
            .chain(std::iter::once(&self.signing_key))
        {
            if card.key.len() != card.alg.key_len() {
                return Err(SuccessionError::Genesis(BzDidError::BadKeyLen {
                    alg: card.alg.id().into(),
                    expected: card.alg.key_len(),
                    got: card.key.len(),
                }));
            }
        }
        for (i, a) in self.rotation_keys.iter().enumerate() {
            if self.rotation_keys[i + 1..].iter().any(|b| a == b) {
                return Err(SuccessionError::Genesis(BzDidError::DuplicateRotationKey));
            }
        }
        if self.valid_until == 0 {
            return Err(SuccessionError::Genesis(BzDidError::BadValidUntil(0)));
        }
        for (list, what) in [
            (&self.services, "services"),
            (&self.also_known_as, "alsoKnownAs"),
        ] {
            if list.len() > MAX_STRINGS {
                return Err(bad(&format!(
                    "{what} carries more than {MAX_STRINGS} entries"
                )));
            }
            for s in list {
                if s.is_empty() || s.len() > crate::genesis::MAX_STRING_BYTES {
                    return Err(bad(&format!(
                        "{what} entry must be 1..={} bytes",
                        crate::genesis::MAX_STRING_BYTES
                    )));
                }
            }
        }
        if self.sig.is_empty() || self.sig.len() > MAX_SIG_BYTES {
            return Err(bad(&format!(
                "sig must be 1..={MAX_SIG_BYTES} bytes, got {}",
                self.sig.len()
            )));
        }
        Ok(())
    }

    /// Canonical stored bytes — body plus signature. sha256 of these bytes
    /// is the `prev` of the NEXT op and the hash the BEELOG leaf carries.
    pub fn build(&self) -> Result<Vec<u8>, SuccessionError> {
        self.validate()?;
        let mut body = rotate_body_bytes(self)?;
        let full = DagValue::Map(vec![
            ("type".into(), DagValue::text(ROTATE_TYPE)),
            ("seq".into(), DagValue::UInt(self.seq)),
            ("prev".into(), DagValue::Bytes(self.prev.to_vec())),
            ("at".into(), DagValue::UInt(self.at)),
            ("signedBy".into(), DagValue::UInt(self.signed_by)),
            (
                "rotationKeys".into(),
                DagValue::Array(self.rotation_keys.iter().map(card_to_value).collect()),
            ),
            ("signingKey".into(), card_to_value(&self.signing_key)),
            (
                "services".into(),
                DagValue::Array(self.services.iter().map(|s| DagValue::text(s)).collect()),
            ),
            (
                "alsoKnownAs".into(),
                DagValue::Array(
                    self.also_known_as
                        .iter()
                        .map(|s| DagValue::text(s))
                        .collect(),
                ),
            ),
            ("validUntil".into(), DagValue::UInt(self.valid_until)),
            ("sig".into(), DagValue::Bytes(self.sig.clone())),
        ]);
        let stored = dagcbor::encode(&full);
        body.clear();
        Ok(stored)
    }

    /// sha256 of the stored bytes — this op's hash-chain identity.
    pub fn hash(&self) -> Result<[u8; 32], SuccessionError> {
        Ok(Sha256::digest(&self.build()?).into())
    }

    /// Parse handed bytes into a typed op: strict dag-cbor, exactly the
    /// eleven v1 fields, then the structural laws. The handed bytes are
    /// what get hashed later — nothing is re-encoded for hashing.
    pub fn parse(bytes: &[u8]) -> Result<RotateOp, SuccessionError> {
        let v = dagcbor::decode(bytes).map_err(SuccessionError::Cbor)?;
        let m = v
            .as_map()
            .ok_or_else(|| SuccessionError::NotARotateOp("the op is not a map".into()))?;
        if m.len() != 11 {
            return Err(SuccessionError::NotARotateOp(format!(
                "the op must carry exactly the eleven v1 fields, got {}",
                m.len()
            )));
        }
        let field = |k: &str| m.iter().find(|(ek, _)| ek == k).map(|(_, v)| v);
        let ty = field("type")
            .and_then(DagValue::as_text)
            .ok_or_else(|| SuccessionError::NotARotateOp("no type text".into()))?;
        if ty != ROTATE_TYPE {
            return Err(SuccessionError::NotARotateOp(format!(
                "type is {ty:?}, not \"{ROTATE_TYPE}\""
            )));
        }
        let seq = field("seq")
            .and_then(DagValue::as_u64)
            .ok_or_else(|| SuccessionError::NotARotateOp("no seq uint".into()))?;
        if seq == 0 {
            return Err(SuccessionError::NotARotateOp(
                "seq must be 1..; the genesis is seq 0".into(),
            ));
        }
        let prev_b = field("prev")
            .and_then(DagValue::as_bytes)
            .ok_or_else(|| SuccessionError::NotARotateOp("no prev bytes".into()))?;
        if prev_b.len() != 32 {
            return Err(SuccessionError::NotARotateOp(format!(
                "prev must be exactly 32 bytes, got {}",
                prev_b.len()
            )));
        }
        let mut prev = [0u8; 32];
        prev.copy_from_slice(prev_b);
        let at = field("at")
            .and_then(DagValue::as_u64)
            .ok_or_else(|| SuccessionError::NotARotateOp("no at uint".into()))?;
        let signed_by = field("signedBy")
            .and_then(DagValue::as_u64)
            .ok_or_else(|| SuccessionError::NotARotateOp("no signedBy uint".into()))?;
        let rot = field("rotationKeys")
            .and_then(DagValue::as_array)
            .ok_or_else(|| SuccessionError::NotARotateOp("no rotationKeys array".into()))?;
        if rot.is_empty() || rot.len() > MAX_ROTATION_KEYS {
            return Err(SuccessionError::Genesis(BzDidError::BadRotationCount(
                rot.len(),
            )));
        }
        let mut rotation_keys = Vec::with_capacity(rot.len());
        for rv in rot {
            rotation_keys.push(card_from_value(rv).map_err(SuccessionError::Genesis)?);
        }
        let signing = field("signingKey")
            .ok_or_else(|| SuccessionError::NotARotateOp("no signingKey".into()))?;
        let signing_key = card_from_value(signing).map_err(SuccessionError::Genesis)?;
        let services = strings_from_value(
            field("services").ok_or_else(|| SuccessionError::NotARotateOp("no services".into()))?,
            "services",
        )
        .map_err(SuccessionError::Genesis)?;
        let also_known_as = strings_from_value(
            field("alsoKnownAs")
                .ok_or_else(|| SuccessionError::NotARotateOp("no alsoKnownAs".into()))?,
            "alsoKnownAs",
        )
        .map_err(SuccessionError::Genesis)?;
        let valid_until = field("validUntil")
            .and_then(DagValue::as_u64)
            .ok_or_else(|| SuccessionError::NotARotateOp("no validUntil uint".into()))?;
        let sig = field("sig")
            .and_then(DagValue::as_bytes)
            .ok_or_else(|| SuccessionError::NotARotateOp("no sig bytes".into()))?
            .to_vec();
        let op = RotateOp {
            seq,
            prev,
            at,
            signed_by,
            rotation_keys,
            signing_key,
            services,
            also_known_as,
            valid_until,
            sig,
        };
        op.validate()?;
        // CANONICAL-ENCODING LAW: the handed bytes must BE the canonical
        // encoding, not merely decode to one. The decoder accepts any map
        // key order (it is a reader of handed bytes), so an op re-encoded
        // with shuffled keys would parse to the same value while hashing
        // differently — two resolvers handed two orders of one op would
        // derive two chain hashes and a keyless peer could mint an
        // Equivocation from one honest signature. Refused here, at the
        // door: handed == canonical, always (review MINOR-1/2).
        if op.build()? != bytes {
            return Err(SuccessionError::NotARotateOp(
                "non-canonical encoding — the bytes decode but are not the canonical form; refuse, never guess".into(),
            ));
        }
        Ok(op)
    }
}

/// Verify a signature under a key card, dispatching on the card's own
/// algorithm id (crypto-agility law — the id rides with the bytes).
/// `verify_strict` on the ed25519 side refuses non-canonical `s` values;
/// ML-DSA verification is the FIPS 204 final check via the same `ml-dsa`
/// crate bsigner signs with (version-pinned together in the workspace
/// lock — one implementation family, no second opinion to drift).
pub fn verify_signature(card: &KeyCard, msg: &[u8], sig: &[u8]) -> Result<(), BzDidError> {
    match card.alg {
        crate::genesis::KeyAlg::Ed25519 => {
            let pk: [u8; 32] = card
                .key
                .clone()
                .try_into()
                .map_err(|_| BzDidError::BadKeyLen {
                    alg: "ed25519".into(),
                    expected: 32,
                    got: card.key.len(),
                })?;
            let vk = ed25519_dalek::VerifyingKey::from_bytes(&pk)
                .map_err(|_| BzDidError::SignatureRejected)?;
            let s: [u8; 64] = sig.to_vec().try_into().map_err(|_| BzDidError::BadKeyLen {
                alg: "ed25519 signature".into(),
                expected: 64,
                got: sig.len(),
            })?;
            let sig = ed25519_dalek::Signature::from_bytes(&s);
            vk.verify_strict(msg, &sig)
                .map_err(|_| BzDidError::SignatureRejected)
        }
        crate::genesis::KeyAlg::MlDsa65 => {
            // the exact decode/verify path bsigner's dsa_verify walks
            // (crates/bsigner/src/pq.rs:152-158) — same crate, same
            // version, one implementation family, no drift
            use ml_dsa::{MlDsa65, Verifier};
            let enc = ml_dsa::EncodedVerifyingKey::<MlDsa65>::try_from(&card.key[..])
                .map_err(|_| BzDidError::SignatureRejected)?;
            let vk = ml_dsa::VerifyingKey::<MlDsa65>::decode(&enc);
            let signature =
                ml_dsa::Signature::<MlDsa65>::try_from(sig).map_err(|_| BzDidError::BadKeyLen {
                    alg: "ml-dsa-65 signature".into(),
                    expected: 3309,
                    got: sig.len(),
                })?;
            vk.verify(msg, &signature)
                .map_err(|_| BzDidError::SignatureRejected)
        }
    }
}

/// The state of an identity at one position of its chain: everything a
/// successor op is checked against, and everything a wallet needs to know
/// at the head.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DidState {
    pub seq: u64,
    /// sha256 of this position's STORED bytes (the genesis bytes at seq 0)
    /// — the value the next op's `prev` must carry.
    pub hash: [u8; 32],
    /// The `at` of the op that produced this state (0 for the genesis).
    /// Never decreases along a chain.
    pub last_at: u64,
    pub rotation_keys: Vec<KeyCard>,
    pub signing_key: KeyCard,
    pub services: Vec<String>,
    pub also_known_as: Vec<String>,
    pub valid_until: u64,
}

impl DidState {
    /// The genesis state: seq 0, hash = sha256(genesis bytes) — the same
    /// 32 bytes the did's base32 body decodes to.
    pub fn from_genesis(op: &GenesisOp, genesis_bytes: &[u8]) -> DidState {
        DidState {
            seq: 0,
            hash: Sha256::digest(genesis_bytes).into(),
            last_at: 0,
            rotation_keys: op.rotation_keys.clone(),
            signing_key: op.signing_key.clone(),
            services: op.services.clone(),
            also_known_as: op.also_known_as.clone(),
            valid_until: op.valid_until,
        }
    }

    fn from_op(op: &RotateOp) -> Result<DidState, SuccessionError> {
        Ok(DidState {
            seq: op.seq,
            hash: op.hash()?,
            last_at: op.at,
            rotation_keys: op.rotation_keys.clone(),
            signing_key: op.signing_key.clone(),
            services: op.services.clone(),
            also_known_as: op.also_known_as.clone(),
            valid_until: op.valid_until,
        })
    }

    /// Validity at a moment — the caller's own clock, the caller's own
    /// call. The boundary refuses (inclusive-edge law).
    pub fn valid_at(&self, now: u64) -> bool {
        now < self.valid_until
    }
}

/// A valid competing op that lost arbitration — evidence, not garbage.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LostFork {
    pub seq: u64,
    pub signed_by: u64,
    /// The stored bytes of the losing op, handed back so a caller can
    /// audit exactly what it was shown and what beat it.
    pub bytes: Vec<u8>,
}

/// A fully resolved identity: the verified chain, its head, and the forks
/// that lost. Pure function of the handed bytes — the same multiset of
/// candidate bytes always resolves to the same verdict, in any order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedDid {
    pub did: BzDid,
    pub head: DidState,
    /// The stored bytes of every APPLIED op, chain order (genesis excluded
    /// — it is the `did`'s own preimage, handed separately).
    pub applied: Vec<Vec<u8>>,
    /// Valid competing ops that lost priority arbitration, at the seq they
    /// competed for (extensions of losers included, all verified).
    pub lost_forks: Vec<LostFork>,
}

impl ResolvedDid {
    pub fn valid_at(&self, now: u64) -> bool {
        self.head.valid_at(now)
    }
}

/// One candidate, parsed once, its stored bytes kept for hashing — the
/// handed bytes are the truth, the parse is just a reading of them.
struct Candidate {
    bytes: Vec<u8>,
    op: RotateOp,
    used: bool,
}

/// THE VERIFIER — resolve an identity from handed bytes, fail closed.
///
/// `floor`: the highest seq the caller has EVER verified for this did
/// (None on first sight). A head below the floor is a rollback —
/// withholding or fork recovery — and refuses rather than resolves
/// quietly. What to do about a rollback is caller policy; this function's
/// job is to make it impossible to miss.
pub fn resolve_did(
    did: &BzDid,
    genesis_bytes: &[u8],
    candidate_bytes: &[Vec<u8>],
    floor: Option<u64>,
) -> Result<ResolvedDid, SuccessionError> {
    let genesis = crate::verify_genesis(genesis_bytes, did)?;
    let mut state = DidState::from_genesis(&genesis, genesis_bytes);

    // Parse + dedup + deterministic order: the verdict is a function of
    // the multiset of handed bytes, never of their arrival order.
    let mut seen: std::collections::BTreeSet<Vec<u8>> = std::collections::BTreeSet::new();
    let mut candidates: Vec<Candidate> = Vec::new();
    for bytes in candidate_bytes {
        if seen.insert(bytes.clone()) {
            candidates.push(Candidate {
                op: RotateOp::parse(bytes)?,
                bytes: bytes.clone(),
                used: false,
            });
        }
    }

    // States any handed op may chain onto: applied history plus (later)
    // verified losing branches. The genesis state starts it.
    let mut known: std::collections::HashMap<[u8; 32], DidState> = std::collections::HashMap::new();
    known.insert(state.hash, state.clone());

    let mut applied: Vec<Vec<u8>> = Vec::new();
    let mut lost: Vec<LostFork> = Vec::new();

    // ---- the canonical walk: highest-priority valid successor wins ----
    loop {
        let next = state.seq + 1;
        let step: Vec<usize> = (0..candidates.len())
            .filter(|&i| {
                !candidates[i].used
                    && candidates[i].op.seq == next
                    && candidates[i].op.prev == state.hash
            })
            .collect();
        if step.is_empty() {
            break;
        }
        // EVERY competing successor is fully checked — an invalid
        // signature is tamper evidence even on a branch that would lose.
        for &i in &step {
            check_op_against(&candidates[i].op, &state)?;
        }
        let min_idx = step
            .iter()
            .map(|&i| candidates[i].op.signed_by)
            .min()
            .unwrap();
        let winners: Vec<usize> = step
            .iter()
            .copied()
            .filter(|&i| candidates[i].op.signed_by == min_idx)
            .collect();
        if winners.len() > 1 {
            return Err(SuccessionError::Equivocation {
                seq: next,
                signed_by: min_idx,
            });
        }
        let w = winners[0];
        for i in step {
            if i != w {
                lost.push(LostFork {
                    seq: candidates[i].op.seq,
                    signed_by: candidates[i].op.signed_by,
                    bytes: candidates[i].bytes.clone(),
                });
                let fs = DidState::from_op(&candidates[i].op)?;
                known.insert(fs.hash, fs);
                candidates[i].used = true;
            }
        }
        state = DidState::from_op(&candidates[w].op)?;
        known.insert(state.hash, state.clone());
        applied.push(candidates[w].bytes.clone());
        candidates[w].used = true;
    }

    // ---- every leftover must be explained: it chains (transitively) to
    // a known state and verifies against THAT state, or it refuses. No
    // handed byte goes unverified. ----
    let mut progressed = true;
    while progressed {
        progressed = false;
        for i in 0..candidates.len() {
            if candidates[i].used {
                continue;
            }
            let Some(pred) = known.get(&candidates[i].op.prev).cloned() else {
                continue;
            };
            if candidates[i].op.seq != pred.seq + 1 {
                return Err(SuccessionError::BrokenChain {
                    seq: candidates[i].op.seq,
                    prev_pointed_seq: pred.seq,
                });
            }
            // same-priority equivocation on a losing branch is still an
            // equivocating KEY — evidence, refuse
            let twin = candidates.iter().enumerate().any(|(j, c)| {
                j != i
                    && !c.used
                    && c.op.seq == candidates[i].op.seq
                    && c.op.prev == candidates[i].op.prev
                    && c.op.signed_by == candidates[i].op.signed_by
            });
            if twin {
                return Err(SuccessionError::Equivocation {
                    seq: candidates[i].op.seq,
                    signed_by: candidates[i].op.signed_by,
                });
            }
            check_op_against(&candidates[i].op, &pred)?;
            let fs = DidState::from_op(&candidates[i].op)?;
            known.insert(fs.hash, fs);
            lost.push(LostFork {
                seq: candidates[i].op.seq,
                signed_by: candidates[i].op.signed_by,
                bytes: candidates[i].bytes.clone(),
            });
            candidates[i].used = true;
            progressed = true;
        }
    }

    // ---- the unexplained remainder names its own refusal ----
    for c in &candidates {
        if c.used {
            continue;
        }
        if c.op.seq > state.seq {
            return Err(SuccessionError::Withholding {
                head_seq: state.seq,
                evidence_seq: c.op.seq,
            });
        }
        return Err(SuccessionError::Unchained { seq: c.op.seq });
    }

    // ---- the rollback floor ----
    if let Some(floor) = floor {
        if floor > state.seq {
            return Err(SuccessionError::Rollback {
                floor,
                head_seq: state.seq,
            });
        }
    }

    // lost_forks in a TOTAL order — (seq, signed_by, bytes) — so the
    // evidence list is a pure function of the multiset, like the head
    // and applied already are (review MINOR-3)
    lost.sort_by(|a, b| {
        (a.seq, a.signed_by, a.bytes.clone()).cmp(&(b.seq, b.signed_by, b.bytes.clone()))
    });

    Ok(ResolvedDid {
        did: did.clone(),
        head: state,
        applied,
        lost_forks: lost,
    })
}

/// Every law an op must satisfy against the state it extends — used for
/// canonical successors and losing branches alike.
fn check_op_against(op: &RotateOp, pred: &DidState) -> Result<(), SuccessionError> {
    if op.seq != pred.seq + 1 {
        return Err(SuccessionError::BrokenChain {
            seq: op.seq,
            prev_pointed_seq: pred.seq,
        });
    }
    let index = usize::try_from(op.signed_by)
        .ok()
        .filter(|&i| i < pred.rotation_keys.len());
    let Some(card) = index.and_then(|i| pred.rotation_keys.get(i)) else {
        return Err(SuccessionError::Unauthorized {
            seq: op.seq,
            signed_by: op.signed_by,
        });
    };
    let msg = rotate_body_bytes(op)?;
    verify_signature(card, &msg, &op.sig).map_err(|_| SuccessionError::InvalidSignature {
        seq: op.seq,
        signed_by: op.signed_by,
    })?;
    if op.at >= pred.valid_until {
        return Err(SuccessionError::SignedAfterExpiry {
            seq: op.seq,
            at: op.at,
            valid_until: pred.valid_until,
        });
    }
    if op.at < pred.last_at {
        return Err(SuccessionError::TimeWentBackwards {
            seq: op.seq,
            at: op.at,
            previous_at: pred.last_at,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn body_and_stored_bytes_are_distinct_canonical_forms() {
        let op = crate::tests::demo_rotate();
        let body = rotate_body_bytes(&op).unwrap();
        assert!(body.starts_with(ROTATE_DOMAIN));
        let stored = op.build().unwrap();
        assert_ne!(&body[..], &stored[..]);
        assert_eq!(RotateOp::parse(&stored).unwrap(), op);
        let h: [u8; 32] = Sha256::digest(&stored).into();
        assert_eq!(op.hash().unwrap(), h);
    }
}
