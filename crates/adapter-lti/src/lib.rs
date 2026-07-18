//! `adapter-lti` — the seam where *verified mastery* becomes a *request to mint* `b`
//! (C-6). Canvas, or any LTI 1.3 platform, is below the spine: replaceable furniture.
//!
//! **The one property, encoded rather than asserted: the adapter *requests*; the
//! ledger *enforces*.** The 420 lifetime cap, the PoUL personhood gate and emission
//! velocity live in the `b` engine. This crate's entire public output is an
//! [`EmissionRequest`] — never a mint — and it holds no key. A fully compromised
//! adapter can only emit requests the ledger then rejects on cap / velocity / PoUL
//! grounds. That is *why* the LMS is furniture: trust concentrates in the engine, not
//! in the edge that talks to a third-party gradebook.
//!
//! Mock-first (the `adapter-carrier` idiom): the real JWT/JWKS signature check and the
//! real consented-binding + PoUL resolution gate on a registered platform and a live
//! commons; v1 ships the pure weight math, the fail-closed admission *shape*, and
//! in-memory trait impls so the logic is fully testable now.
//!
//! §5 QuestWeight and §1 EdgeFactor are **UNRATIFIED**. Their numbers sit behind
//! [`QuestParams`]'s `ratified` flag (the `FirmwarePolicy` precedent — policy data,
//! founder-ruled), and a weight computed under unratified params is refused at the
//! request stage. Nothing mints, two independent ways: no engine call is wired, and
//! provisional weights are refused.

#![forbid(unsafe_code)]

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use capability::Did;
use serde::Deserialize;

// ─── errors: every refusal is typed — never a panic, never a silent drop ───

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LtiError {
    /// Stage 1 — signature/JWKS, `iss`/`aud`, or `exp` failed.
    BadSignature(&'static str),
    /// Stage 1 — the payload was not a well-formed, completed AGS score.
    Parse(&'static str),
    /// Stage 1 — nonce already seen (replay).
    ReplayedNonce,
    /// Stage 2 — `sub` has no consented DID binding / no live PoUL thread.
    UnboundSubject,
    /// Stage 3 — weight computed under UNRATIFIED params; nothing may be requested.
    ProvisionalWeight,
}

impl fmt::Display for LtiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LtiError::BadSignature(w) => {
                write!(f, "LTI admission: signature/claim check failed: {w}")
            }
            LtiError::Parse(w) => write!(f, "LTI admission: malformed AGS payload: {w}"),
            LtiError::ReplayedNonce => write!(f, "LTI admission: nonce already seen (replay)"),
            LtiError::UnboundSubject => {
                write!(f, "LTI identity: subject has no consented DID binding")
            }
            LtiError::ProvisionalWeight => {
                write!(f, "LTI weight: params unratified — request refused")
            }
        }
    }
}

impl std::error::Error for LtiError {}

// ─── Stage 1 output: a verified mastery event ───

/// The admitted result of a platform mastery/score event. Only a [`JwtVerifier`]
/// produces one — an unverified event cannot reach the weight or request stages
/// because [`process`] takes raw bytes and calls the verifier first.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MasteryClaim {
    pub platform_id: String,
    /// LTI subject — a per-platform pseudonym, NOT a person.
    pub subject: String,
    pub quest_id: String,
    /// Mastery-path depth of the completed quest.
    pub depth: u32,
    /// Cohort scarcity, parts-per-million (rarer mastery ⇒ larger). Computed
    /// ledger-side and carried in; the adapter never queries global state.
    pub scarcity_ppm: u32,
    /// Replay-protection nonce.
    pub nonce: String,
    pub issued_at: i64,
}

/// The raw LTI 1.3 AGS-ish wire shape the mock verifier parses. The real verifier
/// will parse the JWT body *after* checking its signature against pinned JWKS.
#[derive(Debug, Deserialize)]
struct RawAgs {
    iss: String,
    aud: String,
    sub: String,
    nonce: String,
    iat: i64,
    quest_id: String,
    depth: u32,
    scarcity_ppm: u32,
    score: RawScore,
}

#[derive(Debug, Deserialize)]
struct RawScore {
    #[serde(rename = "activityProgress")]
    activity_progress: String,
    #[serde(rename = "gradingProgress")]
    grading_progress: String,
}

// ─── the three seams (real impls gate on platform + commons; mocks ship now) ───

/// Stage 1 signature/claim boundary. The real impl verifies the platform JWT against
/// JWKS pinned at tool registration; v1 ships mock verifiers.
pub trait JwtVerifier {
    fn admit(&self, raw: &[u8]) -> Result<MasteryClaim, LtiError>;
}

/// Replay protection.
pub trait NonceStore {
    fn seen(&self, nonce: &str) -> bool;
    fn record(&mut self, nonce: &str);
}

/// Stage 2 — the consented `sub` → DID binding AND the PoUL-liveness gate. Returns
/// `Some(did)` only when the subject is bound by an explicit ceremony and the DID
/// resolves to a live PoUL thread. **Never auto-links** — absence returns `None`,
/// which [`process`] turns into a refusal, not an invented identity.
pub trait SubjectBinding {
    fn resolve(&self, platform_id: &str, subject: &str) -> Option<Did>;
}

// ─── Stage 3: the pure weight function (SHAPE lands now; NUMBERS gated) ───

/// §5 policy data. `UNRATIFIED` until the founder rules §5; under it every weight is
/// tagged provisional and refused before it can become a request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct QuestParams {
    pub depth_coeff: u32,
    pub scarcity_coeff: u32,
    /// In-weight edge multiplier, milli-units (1000 = ×1.0 neutral). Distinct from
    /// the §1 EdgeFactor the b engine applies at mint — this is only the in-weight
    /// edge contribution shape.
    pub edge_milli: u32,
    pub ratified: bool,
}

impl QuestParams {
    /// The only value that ships in the tree until §5 ratifies. Coefficients are
    /// placeholders; `ratified: false` forces every weight provisional.
    pub const UNRATIFIED: QuestParams = QuestParams {
        depth_coeff: 1,
        scarcity_coeff: 1,
        edge_milli: 1000,
        ratified: false,
    };
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Weight {
    pub value: u64,
    /// True when computed under UNRATIFIED params — the request stage refuses these.
    pub provisional: bool,
}

/// `QuestWeight = depth × scarcity × edge` (§5 *shape*). `edge_milli` is a multiplier
/// (1000 = neutral) so an absent edge never *zeroes* a real mastery — edges are a
/// bonus, not a gate. Pure and deterministic. The exact combination and the
/// coefficients are §5's to ratify; the tests assert *structure* (monotonic in depth,
/// provisional-when-unratified, edge-raises-never-zeroes), never magic numbers.
pub fn quest_weight(
    depth: u32,
    scarcity_ppm: u32,
    edge_milli: u32,
    params: &QuestParams,
) -> Weight {
    let base = (depth as u64)
        .saturating_mul(params.depth_coeff as u64)
        .saturating_mul(scarcity_ppm as u64)
        .saturating_mul(params.scarcity_coeff as u64);
    let value = base.saturating_mul(edge_milli as u64) / 1000;
    Weight {
        value,
        provisional: !params.ratified,
    }
}

// ─── Stage 3b: the distinct-counterparty edge rule (§1 / v2 §2) ───

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EdgeKind {
    PeerMasteryVerified,
    TeachBack,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EdgeEvent {
    pub kind: EdgeKind,
    pub a: Did,
    pub b: Did,
}

/// The in-weight edge multiplier. Applies (`> 1000`) only when the edge carries two
/// DISTINCT ends and one of them is the earning subject; a self-loop or an alias ring
/// yields neutral (1000). NOTE: real distinctness is on **PoUL-thread** identity, not
/// raw DID equality — that gate lives behind [`SubjectBinding`]; the skeleton
/// approximates it with DID distinctness and marks the gap here rather than hiding it.
pub fn edge_multiplier(edge: Option<&EdgeEvent>, subject: &Did, params: &QuestParams) -> u32 {
    match edge {
        Some(e) if e.a != e.b && (e.a == *subject || e.b == *subject) => {
            params.edge_milli.max(1000)
        }
        _ => 1000,
    }
}

// ─── Stage 4: the request. NOT a mint. ───

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmissionRequest {
    pub did: Did,
    pub quest_weight: u64,
    /// The adapter merely *flags* that a distinct-counterparty edge was present; the
    /// b engine applies the ratified §1 EdgeFactor at mint. EdgeFactor never lives here.
    pub edge_present: bool,
    /// Content anchor for the mastery evidence (quest id, for the skeleton).
    pub evidence_ref: String,
}

/// The whole seam, composed fail-closed. Any refusal short-circuits with a typed
/// [`LtiError`] and emits no request. On success the ONLY output is an
/// [`EmissionRequest`] handed to the b engine — which alone mints, applies velocity,
/// and enforces the 420/PoUL cap at the ledger.
pub fn process(
    raw: &[u8],
    verifier: &dyn JwtVerifier,
    nonces: &mut dyn NonceStore,
    binding: &dyn SubjectBinding,
    params: &QuestParams,
    edge: Option<&EdgeEvent>,
) -> Result<EmissionRequest, LtiError> {
    // Stage 1 — signature/claims, then replay.
    let ev = verifier.admit(raw)?;
    if nonces.seen(&ev.nonce) {
        return Err(LtiError::ReplayedNonce);
    }
    // Stage 2 — consented binding + PoUL liveness. Never auto-link.
    let did = binding
        .resolve(&ev.platform_id, &ev.subject)
        .ok_or(LtiError::UnboundSubject)?;
    // Stage 3 — weight (shape only; provisional under UNRATIFIED params).
    let em = edge_multiplier(edge, &did, params);
    let w = quest_weight(ev.depth, ev.scarcity_ppm, em, params);
    if w.provisional {
        return Err(LtiError::ProvisionalWeight);
    }
    // Accept: burn the nonce now. A *refused* event (e.g. provisional) may legitimately
    // be resubmitted once params ratify; an *accepted* one may never replay.
    nonces.record(&ev.nonce);
    // Stage 4 — request, not a mint.
    Ok(EmissionRequest {
        did,
        quest_weight: w.value,
        edge_present: em > 1000,
        evidence_ref: ev.quest_id,
    })
}

// ─── mock-first impls: the logic is testable now; reality gates later ───

/// Models "signature already verified against pinned JWKS": parses the AGS body and
/// checks `iss`/`aud` + that the score is a completed, fully-graded mastery.
pub struct MockJwtVerifier {
    pub pinned_iss: String,
    pub pinned_aud: String,
}

impl JwtVerifier for MockJwtVerifier {
    fn admit(&self, raw: &[u8]) -> Result<MasteryClaim, LtiError> {
        let p: RawAgs = serde_json::from_slice(raw).map_err(|_| LtiError::Parse("not AGS JSON"))?;
        if p.iss != self.pinned_iss {
            return Err(LtiError::BadSignature("iss not the pinned platform"));
        }
        if p.aud != self.pinned_aud {
            return Err(LtiError::BadSignature("aud not this tool"));
        }
        if p.score.activity_progress != "Completed" || p.score.grading_progress != "FullyGraded" {
            return Err(LtiError::Parse(
                "score not a completed, fully-graded mastery",
            ));
        }
        Ok(MasteryClaim {
            platform_id: p.iss,
            subject: p.sub,
            quest_id: p.quest_id,
            depth: p.depth,
            scarcity_ppm: p.scarcity_ppm,
            nonce: p.nonce,
            issued_at: p.iat,
        })
    }
}

/// Models a failed signature (unknown `kid` / bad sig): admits nothing.
pub struct RejectingJwtVerifier;
impl JwtVerifier for RejectingJwtVerifier {
    fn admit(&self, _raw: &[u8]) -> Result<MasteryClaim, LtiError> {
        Err(LtiError::BadSignature("no pinned key admitted this token"))
    }
}

/// In-memory replay set.
#[derive(Default)]
pub struct InMemoryNonceStore {
    seen: BTreeSet<String>,
}
impl NonceStore for InMemoryNonceStore {
    fn seen(&self, nonce: &str) -> bool {
        self.seen.contains(nonce)
    }
    fn record(&mut self, nonce: &str) {
        self.seen.insert(nonce.to_string());
    }
}

/// An in-memory binding table. A real impl consults the consented-binding ledger and
/// the PoUL-thread registry; an absent entry models "not bound / no live thread".
#[derive(Default)]
pub struct MockSubjectBinding {
    map: BTreeMap<(String, String), Did>,
}
impl MockSubjectBinding {
    pub fn bind(&mut self, platform_id: &str, subject: &str, did: Did) {
        self.map
            .insert((platform_id.to_string(), subject.to_string()), did);
    }
}
impl SubjectBinding for MockSubjectBinding {
    fn resolve(&self, platform_id: &str, subject: &str) -> Option<Did> {
        self.map
            .get(&(platform_id.to_string(), subject.to_string()))
            .cloned()
    }
}

// ─── tests: structure and refusals, red-then-green ───

#[cfg(test)]
mod tests {
    use super::*;

    const SYNTHETIC: &str = include_str!("../fixtures/synthetic_ags_score.json");

    fn ratified() -> QuestParams {
        // A test-only ratified params. The TREE still ships UNRATIFIED; this only
        // proves the shape works once §5 lands.
        QuestParams {
            depth_coeff: 2,
            scarcity_coeff: 3,
            edge_milli: 1500, // D-11's peer-verify ×1.5
            ratified: true,
        }
    }

    fn verifier() -> MockJwtVerifier {
        MockJwtVerifier {
            pinned_iss: "https://canvas.test/".into(),
            pinned_aud: "bnri-lti-tool".into(),
        }
    }

    fn bound() -> MockSubjectBinding {
        let mut b = MockSubjectBinding::default();
        b.bind(
            "https://canvas.test/",
            "lti|course-42|user-abc",
            Did::new("did:autonomi:earner-1"),
        );
        b
    }

    // Stage 3 — pure weight structure (never magic numbers; §5 owns those).
    #[test]
    fn weight_is_provisional_under_unratified_params() {
        let w = quest_weight(3, 120_000, 1000, &QuestParams::UNRATIFIED);
        assert!(w.provisional, "unratified params must taint the weight");
    }

    #[test]
    fn weight_not_provisional_once_ratified() {
        let w = quest_weight(3, 120_000, 1000, &ratified());
        assert!(!w.provisional);
    }

    #[test]
    fn weight_monotonic_in_depth() {
        let p = ratified();
        let lo = quest_weight(1, 100_000, 1000, &p).value;
        let hi = quest_weight(5, 100_000, 1000, &p).value;
        assert!(hi > lo, "deeper mastery must not weigh less");
    }

    #[test]
    fn edge_raises_but_absence_never_zeroes() {
        let p = ratified();
        let neutral = quest_weight(3, 100_000, 1000, &p).value;
        let edged = quest_weight(3, 100_000, 1500, &p).value;
        assert!(neutral > 0, "a real mastery with no edge still weighs > 0");
        assert!(edged > neutral, "an edge must raise the weight");
    }

    // Stage 3b — distinct-counterparty rule.
    #[test]
    fn edge_multiplier_rules() {
        let p = ratified();
        let me = Did::new("did:autonomi:earner-1");
        let peer = Did::new("did:autonomi:verifier-2");
        let none: Option<&EdgeEvent> = None;
        assert_eq!(edge_multiplier(none, &me, &p), 1000, "no edge → neutral");

        let self_loop = EdgeEvent {
            kind: EdgeKind::PeerMasteryVerified,
            a: me.clone(),
            b: me.clone(),
        };
        assert_eq!(
            edge_multiplier(Some(&self_loop), &me, &p),
            1000,
            "self-loop → neutral"
        );

        let distinct = EdgeEvent {
            kind: EdgeKind::PeerMasteryVerified,
            a: me.clone(),
            b: peer.clone(),
        };
        assert_eq!(
            edge_multiplier(Some(&distinct), &me, &p),
            1500,
            "distinct + involves me → applies"
        );

        let stranger = Did::new("did:autonomi:stranger-9");
        let not_mine = EdgeEvent {
            kind: EdgeKind::TeachBack,
            a: peer,
            b: stranger,
        };
        assert_eq!(
            edge_multiplier(Some(&not_mine), &me, &p),
            1000,
            "edge not involving me → neutral"
        );
    }

    // Whole seam — happy path (ratified) yields a REQUEST, not a mint.
    #[test]
    fn process_valid_event_yields_request() {
        let mut nonces = InMemoryNonceStore::default();
        let req = process(
            SYNTHETIC.as_bytes(),
            &verifier(),
            &mut nonces,
            &bound(),
            &ratified(),
            None,
        )
        .expect("a valid, bound, ratified event should produce a request");
        assert_eq!(req.did, Did::new("did:autonomi:earner-1"));
        assert_eq!(req.evidence_ref, "coa-total-thc");
        assert!(!req.edge_present);
        assert!(req.quest_weight > 0);
    }

    // Fail-closed table, one test per row.
    #[test]
    fn refuse_unratified_params() {
        let mut nonces = InMemoryNonceStore::default();
        let err = process(
            SYNTHETIC.as_bytes(),
            &verifier(),
            &mut nonces,
            &bound(),
            &QuestParams::UNRATIFIED,
            None,
        )
        .unwrap_err();
        assert_eq!(err, LtiError::ProvisionalWeight);
    }

    #[test]
    fn refuse_bad_signature() {
        let mut nonces = InMemoryNonceStore::default();
        let err = process(
            SYNTHETIC.as_bytes(),
            &RejectingJwtVerifier,
            &mut nonces,
            &bound(),
            &ratified(),
            None,
        )
        .unwrap_err();
        assert!(matches!(err, LtiError::BadSignature(_)));
    }

    #[test]
    fn refuse_replayed_nonce() {
        let mut nonces = InMemoryNonceStore::default();
        // first accept burns the nonce
        process(
            SYNTHETIC.as_bytes(),
            &verifier(),
            &mut nonces,
            &bound(),
            &ratified(),
            None,
        )
        .unwrap();
        // replay
        let err = process(
            SYNTHETIC.as_bytes(),
            &verifier(),
            &mut nonces,
            &bound(),
            &ratified(),
            None,
        )
        .unwrap_err();
        assert_eq!(err, LtiError::ReplayedNonce);
    }

    #[test]
    fn refuse_unbound_subject() {
        let mut nonces = InMemoryNonceStore::default();
        let empty = MockSubjectBinding::default();
        let err = process(
            SYNTHETIC.as_bytes(),
            &verifier(),
            &mut nonces,
            &empty,
            &ratified(),
            None,
        )
        .unwrap_err();
        assert_eq!(err, LtiError::UnboundSubject);
    }

    // A refused (provisional) event must NOT have burned its nonce — it can be
    // resubmitted once §5 ratifies.
    #[test]
    fn provisional_refusal_does_not_burn_nonce() {
        let mut nonces = InMemoryNonceStore::default();
        let _ = process(
            SYNTHETIC.as_bytes(),
            &verifier(),
            &mut nonces,
            &bound(),
            &QuestParams::UNRATIFIED,
            None,
        );
        // now with ratified params the same event still goes through
        let ok = process(
            SYNTHETIC.as_bytes(),
            &verifier(),
            &mut nonces,
            &bound(),
            &ratified(),
            None,
        );
        assert!(
            ok.is_ok(),
            "a provisional refusal must not consume the nonce"
        );
    }

    // GREEN pending C-5: the real captured AGS payload. `cargo test` skips this;
    // run with `--ignored` once `fixtures/real_ags_score.json` lands from the eval.
    #[test]
    #[ignore = "waiting on C-5's real LTI 1.3 AGS capture (fixtures/real_ags_score.json)"]
    fn process_real_ags_capture() {
        let raw = std::fs::read("fixtures/real_ags_score.json")
            .expect("real AGS fixture from C-5 not present yet");
        let mut nonces = InMemoryNonceStore::default();
        let _ = process(&raw, &verifier(), &mut nonces, &bound(), &ratified(), None)
            .expect("the real payload should admit and produce a request");
    }
}
