//! Emergent reputation — deterministically recomputed from evidence and
//! events, never written directly.
//!
//! ## The constitutional invariant, honored precisely
//! The constitution says reputation is *"never reduced to a single
//! universal score by the kernel."* The canonical artifact here is the
//! **component vector**: every point of reputation traces to a named
//! source with a commitment hash. The `score` field is **one
//! deterministic projection** of those components — a convenience
//! aggregate applications MAY use; they are equally free to re-weight
//! the components themselves. The kernel computes the projection; it
//! never mandates it. Nothing in this crate lets anyone *write* a score:
//! the only path to reputation is [`compute`] over inputs that are
//! themselves derived from events and evidence.
//!
//! ## Scope seams (same discipline as dispute-engine / dro-signer)
//! - [`compute`] is pure and total: same input → same output, bit for bit.
//! - Real attestation signature verification gates behind
//!   [`SignatureVerifier`] ([`MockVerifier`] in v1).
//! - Historical event replay gates behind [`EventStore`] ([`MockStore`]).
//! - No `todo!()` in shipped paths.
//!
//! ## Two forced additions to the prompt's structs (flagged)
//! - `ReputationInput.as_of_unix`: `computed_at` must come from the
//!   input, not an ambient clock, or determinism dies.
//! - Aggregate components (e.g. completed-escrow count) carry a
//!   *commitment* hash — sha256 over a canonical `source:value` string —
//!   so the transparency rule ("every point has an evidence hash") holds
//!   for contributions that summarize counts rather than cite one item.
//!
//! ## Scoring model (deterministic, documented, integer contributions)
//! - completed escrow: **+25** each; disputed escrow: **−40** each;
//!   DRO resolved-favorable: **+30** each.
//! - evidence submitted, by provenance: ChainProof/DeviceAttestation
//!   **+15**, CarrierApi **+10**, AiInference **+4**, UserClaim **+2** —
//!   machine-attested contribution outranks claims by design.
//! - attestations: **+20 per unique valid attester** — deduplicated by
//!   `attester_did` (Sybil rule: N attestations from one DID count once),
//!   self-attestation counts zero, invalid signatures count zero.
//! - `score` = Σ contributions clamped to **[0, 1000]**; components keep
//!   the raw pre-clamp contributions so the projection is auditable.

#![forbid(unsafe_code)]

use std::collections::BTreeSet;

use dispute_engine::{Evidence, Provenance};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const SCORE_MAX: u64 = 1000;

pub const COMPLETED_ESCROW_POINTS: i64 = 25;
pub const DISPUTED_ESCROW_POINTS: i64 = -40;
pub const RESOLVED_FAVORABLE_POINTS: i64 = 30;
pub const ATTESTATION_POINTS: i64 = 20;

/// One traceable contribution to a reputation projection.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReputationComponent {
    /// Named source, e.g. `completed_escrows` or `evidence:ChainProof`.
    pub source: String,
    /// Relative weight of this component class in the projection.
    pub weight: f32,
    /// Signed points contributed (pre-clamp).
    pub contribution: i64,
    /// Hex commitment: the cited evidence's payload hash, or for
    /// aggregates a sha256 over the canonical `source:value` string.
    pub evidence_hash: String,
}

/// The computed artifact. `components` is canonical; `score` is one
/// deterministic projection of it (see module docs).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReputationScore {
    pub did: String,
    pub score: u64,
    pub components: Vec<ReputationComponent>,
    pub computed_at: i64,
}

/// A third-party attestation about a DID.
#[derive(Debug, Clone, PartialEq)]
pub struct Attestation {
    pub attester_did: String,
    pub attested_did: String,
    pub claim: String,
    pub timestamp: i64,
    /// Set by a [`SignatureVerifier`]; invalid attestations contribute 0.
    pub signature_valid: bool,
}

/// Everything reputation is recomputed FROM. Derived from events and
/// evidence upstream (via an [`EventStore`]); never hand-authored in
/// production paths.
#[derive(Debug, Clone, PartialEq)]
pub struct ReputationInput {
    pub did: String,
    pub completed_escrows: u64,
    pub disputed_escrows: u64,
    /// Disputes the DRO resolved in this party's favor.
    pub resolved_favorable: u64,
    pub evidence_submitted: Vec<Evidence>,
    pub attestations_received: Vec<Attestation>,
    /// Observation time carried in the input — determinism forbids an
    /// ambient clock (forced addition, see module docs).
    pub as_of_unix: i64,
}

/// Deterministic emergent reputation. Total: never panics, including on
/// a DID with zero history (score 0, empty components).
pub fn compute(input: &ReputationInput) -> ReputationScore {
    let mut components = Vec::new();

    push_aggregate(
        &mut components,
        "completed_escrows",
        input.completed_escrows,
        COMPLETED_ESCROW_POINTS,
        1.0,
    );
    push_aggregate(
        &mut components,
        "disputed_escrows",
        input.disputed_escrows,
        DISPUTED_ESCROW_POINTS,
        1.0,
    );
    push_aggregate(
        &mut components,
        "resolved_favorable",
        input.resolved_favorable,
        RESOLVED_FAVORABLE_POINTS,
        1.0,
    );

    // Evidence: machine-attested provenance contributes more than claims.
    for item in &input.evidence_submitted {
        let (points, label) = evidence_points(item.provenance);
        components.push(ReputationComponent {
            source: format!("evidence:{label}"),
            weight: 1.0,
            contribution: points,
            evidence_hash: hex(&item.payload_hash),
        });
    }

    // Attestations: one per unique attester (Sybil rule), no self-vouching,
    // no invalid signatures. BTreeSet keeps iteration deterministic.
    let mut counted: BTreeSet<&str> = BTreeSet::new();
    for att in &input.attestations_received {
        if !att.signature_valid
            || att.attester_did == input.did
            || att.attested_did != input.did
            || !counted.insert(att.attester_did.as_str())
        {
            continue;
        }
        components.push(ReputationComponent {
            source: format!("attestation:{}", att.attester_did),
            weight: 1.0,
            contribution: ATTESTATION_POINTS,
            evidence_hash: hex(&commitment(&format!(
                "attestation:{}:{}:{}",
                att.attester_did, att.attested_did, att.claim
            ))),
        });
    }

    let total: i64 = components.iter().map(|c| c.contribution).sum();
    let score = total.clamp(0, SCORE_MAX as i64) as u64;

    ReputationScore {
        did: input.did.clone(),
        score,
        components,
        computed_at: input.as_of_unix,
    }
}

fn evidence_points(provenance: Provenance) -> (i64, &'static str) {
    match provenance {
        Provenance::ChainProof => (15, "ChainProof"),
        Provenance::DeviceAttestation => (15, "DeviceAttestation"),
        Provenance::CarrierApi => (10, "CarrierApi"),
        Provenance::AiInference => (4, "AiInference"),
        // BIND-1 G-1: between AiInference and UserClaim.
        Provenance::SignedSelfAttestation => (3, "SignedSelfAttestation"),
        Provenance::UserClaim => (2, "UserClaim"),
    }
}

/// Zero-count aggregates contribute nothing and emit no component —
/// a DID with no history gets an empty component list, not padding.
fn push_aggregate(
    components: &mut Vec<ReputationComponent>,
    source: &str,
    count: u64,
    per_item: i64,
    weight: f32,
) {
    if count == 0 {
        return;
    }
    let contribution = per_item.saturating_mul(count.min(i64::MAX as u64) as i64);
    components.push(ReputationComponent {
        source: source.to_string(),
        weight,
        contribution,
        evidence_hash: hex(&commitment(&format!("{source}:{count}"))),
    });
}

fn commitment(canonical: &str) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(canonical.as_bytes());
    h.finalize().into()
}

fn hex(bytes: &[u8; 32]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

// ---------------------------------------------------------------------------
// Reality seams
// ---------------------------------------------------------------------------

/// Real signature verification (DID key resolution + curve math) lands
/// with the identity adapters; v1 mocks it.
pub trait SignatureVerifier {
    fn verify(&self, attestation: &Attestation) -> bool;
}

/// Stamp `signature_valid` on a batch via a verifier. `compute` honors
/// the flag; this is the only sanctioned way to set it in production.
pub fn verify_attestations(
    mut attestations: Vec<Attestation>,
    verifier: &impl SignatureVerifier,
) -> Vec<Attestation> {
    for att in &mut attestations {
        att.signature_valid = verifier.verify(att);
    }
    attestations
}

/// v1 mock: valid iff the attester is on the allowlist.
#[derive(Debug, Default)]
pub struct MockVerifier {
    pub valid_attesters: Vec<String>,
}

impl SignatureVerifier for MockVerifier {
    fn verify(&self, attestation: &Attestation) -> bool {
        self.valid_attesters
            .iter()
            .any(|d| d == &attestation.attester_did)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StoreError {
    Unavailable(String),
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreError::Unavailable(why) => write!(f, "event store unavailable: {why}"),
        }
    }
}

impl std::error::Error for StoreError {}

/// Where inputs really come from: replaying the DID's CanonicalEvents
/// (b-indexer). Gated; v1 mocks it.
pub trait EventStore {
    fn input_for(&self, did: &str, as_of_unix: i64) -> Result<ReputationInput, StoreError>;
}

/// v1 mock: preloaded inputs keyed by DID; unknown DIDs yield the honest
/// zero-history input rather than an error.
#[derive(Debug, Default)]
pub struct MockStore {
    pub inputs: Vec<ReputationInput>,
}

impl EventStore for MockStore {
    fn input_for(&self, did: &str, as_of_unix: i64) -> Result<ReputationInput, StoreError> {
        Ok(self
            .inputs
            .iter()
            .find(|i| i.did == did)
            .cloned()
            .unwrap_or(ReputationInput {
                did: did.to_string(),
                completed_escrows: 0,
                disputed_escrows: 0,
                resolved_favorable: 0,
                evidence_submitted: vec![],
                attestations_received: vec![],
                as_of_unix,
            }))
    }
}

/// Convenience recompute-from-store composition.
pub fn recompute(
    did: &str,
    as_of_unix: i64,
    store: &impl EventStore,
) -> Result<ReputationScore, StoreError> {
    Ok(compute(&store.input_for(did, as_of_unix)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use dispute_engine::{Side, ViewGrade};

    const DID: &str = "did:plc:subject";
    const AS_OF: i64 = 1_782_100_000;

    fn evidence(provenance: Provenance, tag: u8) -> Evidence {
        Evidence {
            provenance,
            confidence: 1.0,
            signed: true,
            verified: true,
            payload_hash: [tag; 32],
            subject_did: None,
            source_ref: None,
            validator_digest: None,
            view_grade: ViewGrade::Informational,
            favors: Side::Buyer, // direction is dispute-scoped; irrelevant here
        }
    }

    fn attestation(attester: &str, valid: bool) -> Attestation {
        Attestation {
            attester_did: attester.into(),
            attested_did: DID.into(),
            claim: "reliable-counterparty".into(),
            timestamp: AS_OF - 100,
            signature_valid: valid,
        }
    }

    fn input() -> ReputationInput {
        ReputationInput {
            did: DID.into(),
            completed_escrows: 4,
            disputed_escrows: 1,
            resolved_favorable: 1,
            evidence_submitted: vec![
                evidence(Provenance::ChainProof, 1),
                evidence(Provenance::UserClaim, 2),
            ],
            attestations_received: vec![attestation("did:plc:peer", true)],
            as_of_unix: AS_OF,
        }
    }

    #[test]
    fn deterministic_bit_for_bit() {
        assert_eq!(compute(&input()), compute(&input()));
    }

    #[test]
    fn zero_history_scores_zero_with_empty_components() {
        let empty = ReputationInput {
            did: DID.into(),
            completed_escrows: 0,
            disputed_escrows: 0,
            resolved_favorable: 0,
            evidence_submitted: vec![],
            attestations_received: vec![],
            as_of_unix: AS_OF,
        };
        let score = compute(&empty);
        assert_eq!(score.score, 0);
        assert!(score.components.is_empty());
        assert_eq!(score.computed_at, AS_OF);
    }

    #[test]
    fn score_is_bounded_above_and_below() {
        let mut whale = input();
        whale.completed_escrows = 1_000_000;
        assert_eq!(compute(&whale).score, SCORE_MAX);

        let mut pariah = input();
        pariah.completed_escrows = 0;
        pariah.resolved_favorable = 0;
        pariah.evidence_submitted.clear();
        pariah.attestations_received.clear();
        pariah.disputed_escrows = 1_000;
        assert_eq!(compute(&pariah).score, 0, "clamped, never negative");
    }

    #[test]
    fn high_provenance_evidence_outweighs_low() {
        let base = ReputationInput {
            did: DID.into(),
            completed_escrows: 0,
            disputed_escrows: 0,
            resolved_favorable: 0,
            evidence_submitted: vec![],
            attestations_received: vec![],
            as_of_unix: AS_OF,
        };
        let mut chain = base.clone();
        chain.evidence_submitted = vec![evidence(Provenance::ChainProof, 1)];
        let mut claim = base;
        claim.evidence_submitted = vec![evidence(Provenance::UserClaim, 1)];
        assert!(compute(&chain).score > compute(&claim).score);
    }

    #[test]
    fn disputes_reduce_and_favorable_resolutions_increase() {
        let base = compute(&input());

        let mut worse = input();
        worse.disputed_escrows += 2;
        assert!(compute(&worse).score < base.score);

        let mut better = input();
        better.resolved_favorable += 2;
        assert!(compute(&better).score > base.score);
    }

    #[test]
    fn transparency_every_point_traces_to_a_hashed_component() {
        let score = compute(&input());
        let total: i64 = score.components.iter().map(|c| c.contribution).sum();
        assert_eq!(
            score.score as i64,
            total.clamp(0, SCORE_MAX as i64),
            "the projection is exactly the clamped component sum"
        );
        for c in &score.components {
            assert!(!c.source.is_empty());
            assert_eq!(c.evidence_hash.len(), 64, "sha256 hex on {}", c.source);
        }
    }

    #[test]
    fn sybil_ten_attestations_from_one_did_do_not_outweigh_one_from_another() {
        let mut sybil = input();
        sybil.attestations_received = (0..10)
            .map(|_| attestation("did:plc:sybil", true))
            .collect();

        let mut honest = input();
        honest.attestations_received = vec![attestation("did:plc:peer", true)];

        assert!(compute(&sybil).score <= compute(&honest).score);
        // And the dedupe is visible in the audit trail: one component.
        let att_components = compute(&sybil)
            .components
            .iter()
            .filter(|c| c.source.starts_with("attestation:"))
            .count();
        assert_eq!(att_components, 1);
    }

    #[test]
    fn self_attestation_counts_zero() {
        let mut vain = input();
        vain.attestations_received = vec![attestation(DID, true)];
        let mut none = input();
        none.attestations_received = vec![];
        assert_eq!(compute(&vain).score, compute(&none).score);
    }

    #[test]
    fn invalid_signature_counts_zero_and_verifier_stamps_validity() {
        let mut unverified = input();
        unverified.attestations_received = vec![attestation("did:plc:peer", false)];
        let mut none = input();
        none.attestations_received = vec![];
        assert_eq!(compute(&unverified).score, compute(&none).score);

        // The verifier is the sanctioned validity source.
        let verifier = MockVerifier {
            valid_attesters: vec!["did:plc:peer".into()],
        };
        let stamped = verify_attestations(
            vec![
                attestation("did:plc:peer", false),
                attestation("did:plc:evil", true),
            ],
            &verifier,
        );
        assert!(stamped[0].signature_valid, "allowlisted attester verifies");
        assert!(!stamped[1].signature_valid, "unknown attester is stripped");
    }

    #[test]
    fn recompute_composes_store_and_unknown_did_is_zero_history() {
        let store = MockStore {
            inputs: vec![input()],
        };
        assert!(recompute(DID, AS_OF, &store).unwrap().score > 0);
        let ghost = recompute("did:plc:ghost", AS_OF, &store).unwrap();
        assert_eq!(ghost.score, 0);
        assert!(ghost.components.is_empty());
    }
}

/// NC-VII1 (ratified, meta-tier — Article VII §1): interpretive / subjective worldviews
/// (Human Design, PLUR, Hawkins, physiocracy) live in interpretation plugins and **never become
/// consensus mechanisms**. So **no such value may reach this engine's input graph, by any path** —
/// the attestation and evidence flows that feed reputation (§3.3(b)). Trivially true today;
/// ratcheted **while uncontroversial**, so weakening it later costs a meta-tier amendment (K=8 +
/// 21% quorum) rather than a quiet PR under pressure from a stakeholder who resents it.
///
/// **Two scans, because the rule forbids reaching the inputs by *any* path — including indirectly.**
/// A vocabulary scan of this crate's source catches a field like `indigo_energy_type`, but is blind
/// to a dependency EDGE: a `plur-index` crate in Cargo.toml leaves no vocabulary in the source. So
/// a second check asserts the dependency graph carries no interpretive-framework crate — this
/// crate's manifest, and **reputation-engine's own transitive closure** of the workspace lock.
/// **Scoped to the closure, not the whole lock, on purpose:** NC-VII1 keeps the interpretive work
/// itself standing in the plugin layer, so a PLUR crate *elsewhere* in the workspace is permitted;
/// only reputation-engine's own dependency path is forbidden. A whole-lock scan would over-block
/// and fire the day the PLUR plugin is built — the exact moment loosening the ratchet tempts. The
/// decoys prove both directions: a PLUR crate on the path is caught; one off it is permitted.
/// Strengthening the firewall is ordinary-tier, so this was done directly.
///
/// **Recorded constraint on the future PLUR plugin (Law 1d, in concept space).** PLUR's "R" is
/// *Respect* — the same word as the constitution's Respect, which is the governance/reputation
/// unit this firewall exists to protect. Same word, two meanings, one of them the thing being
/// protected. The guard therefore **cannot** forbid "respect" (it would block the governance unit),
/// which means **if PLUR is ever built as a plugin, its "Respect" must be RENAMED** — otherwise the
/// firewall can neither over-block the governance unit nor under-block the interpretive one by name.
/// The collision is in the concepts, not just the lint.
#[cfg(test)]
mod nc_vii1 {
    /// Subjective-worldview vocabulary forbidden in the reputation input graph. Deliberately does
    /// NOT include "respect" — that is the legitimate reputation unit, and PLUR's R must not be
    /// allowed to shadow it.
    const FORBIDDEN: &[&str] = &[
        "human_design",
        "human-design",
        "humandesign",
        "human design",
        "energy_type",
        "energy-type",
        "energytype",
        "plur",
        "hawkins",
        "physiocracy",
        "indigo",
        "hexagram",
        "incarnation_cross",
        "incarnation-cross",
    ];

    /// Scan source for forbidden vocabulary, skipping comment lines (prose about the rule is not
    /// an input type).
    fn hd_plur_findings(source: &str) -> Vec<String> {
        let mut hits = Vec::new();
        for line in source.lines() {
            let t = line.trim();
            if t.starts_with("//") {
                continue;
            }
            let l = t.to_lowercase();
            for f in FORBIDDEN {
                if l.contains(f) {
                    hits.push(format!("{f}: {t}"));
                }
            }
        }
        hits
    }

    /// Scan a Cargo manifest's dependency sections OR a Cargo.lock's package names for an
    /// interpretive-framework crate. Catches the indirection the source scan cannot — a dependency
    /// EDGE leaves no vocabulary in this crate's own source.
    fn graph_findings(text: &str) -> Vec<String> {
        let mut hits = Vec::new();
        let mut in_deps = false;
        for line in text.lines() {
            let t = line.trim();
            if t.starts_with('#') {
                continue;
            }
            if let Some(sec) = t.strip_prefix('[') {
                in_deps = sec.contains("dependencies");
                continue;
            }
            // A Cargo.lock package name (`name = "X"`) in any section, or a Cargo.toml dep name.
            let name = if let Some(rest) = t.strip_prefix("name = \"") {
                rest.split('"').next().unwrap_or("").to_lowercase()
            } else if in_deps && !t.is_empty() {
                t.split(['=', ' ', '.'])
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_lowercase()
            } else {
                continue;
            };
            if !name.is_empty() && FORBIDDEN.iter().any(|f| name.contains(f)) {
                hits.push(name);
            }
        }
        hits
    }

    /// Package names reachable from `root` in a Cargo.lock's dependency graph — `root`'s TRANSITIVE
    /// CLOSURE, **not** the whole lock. This is the scope NC-VII1 actually names: a PLUR crate on
    /// reputation-engine's path is forbidden; one elsewhere in the workspace (the plugin layer) is
    /// permitted.
    fn closure_names(lock: &str, root: &str) -> std::collections::BTreeSet<String> {
        use std::collections::{BTreeMap, BTreeSet};
        let mut graph: BTreeMap<String, Vec<String>> = BTreeMap::new();
        let mut cur: Option<String> = None;
        let mut in_deps = false;
        for line in lock.lines() {
            let t = line.trim();
            if t == "[[package]]" {
                cur = None;
                in_deps = false;
                continue;
            }
            if in_deps {
                if t.starts_with(']') {
                    in_deps = false;
                    continue;
                }
                let dep = t.trim_matches(|c: char| c == '"' || c == ',' || c.is_whitespace());
                let name = dep.split(' ').next().unwrap_or("");
                if !name.is_empty() {
                    if let Some(c) = &cur {
                        graph.entry(c.clone()).or_default().push(name.to_string());
                    }
                }
                continue;
            }
            if let Some(rest) = t.strip_prefix("name = \"") {
                let name = rest.split('"').next().unwrap_or("").to_string();
                graph.entry(name.clone()).or_default();
                cur = Some(name);
                continue;
            }
            // A non-empty `dependencies = [` opens a multi-line list; `dependencies = []` does not.
            if t.starts_with("dependencies = [") && !t.contains(']') {
                in_deps = true;
            }
        }
        let mut seen = BTreeSet::new();
        let mut stack = vec![root.to_string()];
        while let Some(n) = stack.pop() {
            if seen.insert(n.clone()) {
                if let Some(deps) = graph.get(&n) {
                    stack.extend(deps.iter().cloned());
                }
            }
        }
        seen
    }

    /// The interpretive-framework crate names present in a set (empty = clean).
    fn interpretive_in(names: &std::collections::BTreeSet<String>) -> Vec<String> {
        names
            .iter()
            .filter(|n| {
                let l = n.to_lowercase();
                FORBIDDEN.iter().any(|f| l.contains(f))
            })
            .cloned()
            .collect()
    }

    #[test]
    fn no_subjective_worldview_reaches_the_reputation_input_graph() {
        // Scan the LIBRARY (inputs + compute), excluding the test modules where this list and the
        // decoy below live (split at the first `#[cfg(test)]`).
        let src = include_str!("lib.rs");
        let lib = src.split("#[cfg(test)]").next().unwrap();
        assert_eq!(
            hd_plur_findings(lib),
            Vec::<String>::new(),
            "NC-VII1: no Human-Design / PLUR / Hawkins / physiocracy value in the reputation input graph"
        );
        // Decoy positive control — a deliberate violation MUST be caught, or this is a lint never
        // shown to fail, which by our own rule is not a lint.
        let decoy = "    pub indigo_energy_type: f32,";
        assert!(
            !hd_plur_findings(decoy).is_empty(),
            "the guard must catch an HD/PLUR-derived reputation input"
        );
        // And the legitimate reputation unit survives: Respect is not a forbidden worldview.
        assert!(
            hd_plur_findings("pub respect: u64,").is_empty(),
            "Respect is the reputation unit — PLUR's R must not shadow it out of the input graph"
        );
    }

    #[test]
    fn no_interpretive_framework_crate_in_the_reputation_dependency_graph() {
        // The vocabulary scan is blind to a dependency EDGE; this closes the indirection path.
        // (1) Direct deps — this crate's own manifest — correctly scoped already.
        assert_eq!(
            graph_findings(include_str!("../Cargo.toml")),
            Vec::<String>::new(),
            "reputation-engine depends on no interpretive-framework crate directly"
        );
        assert!(
            !graph_findings("[dependencies]\nplur-index = \"1\"\nserde = \"1\"\n").is_empty(),
            "a plur-index direct dependency must be flagged"
        );
        // (2) TRANSITIVE CLOSURE of reputation-engine ONLY — not the whole workspace lock. NC-VII1
        // keeps interpretive work in the plugin layer, so a PLUR crate elsewhere is permitted.
        let reached = closure_names(include_str!("../../../Cargo.lock"), "reputation-engine");
        assert!(
            reached.len() > 1,
            "the closure walk found reputation-engine's real deps, not just itself"
        );
        assert_eq!(
            interpretive_in(&reached),
            Vec::<String>::new(),
            "no interpretive-framework crate in reputation-engine's transitive closure"
        );
        // Positive control — a PLUR crate ON reputation-engine's path IS caught.
        let on_path = "[[package]]\nname = \"reputation-engine\"\ndependencies = [\n \"plur-index\",\n]\n\n[[package]]\nname = \"plur-index\"\ndependencies = []\n";
        assert!(
            !interpretive_in(&closure_names(on_path, "reputation-engine")).is_empty(),
            "a PLUR crate on reputation-engine's path must be caught"
        );
        // THE SCOPING CONTROL (the fix): a PLUR crate reputation-engine does NOT depend on — a
        // legitimate plugin — must be PERMITTED. The old whole-lock scan wrongly fired here, which
        // would have bitten the day the PLUR plugin was built.
        let off_path = "[[package]]\nname = \"reputation-engine\"\ndependencies = [\n \"dispute-engine\",\n]\n\n[[package]]\nname = \"dispute-engine\"\ndependencies = []\n\n[[package]]\nname = \"plur-index\"\ndependencies = []\n";
        let sibling = closure_names(off_path, "reputation-engine");
        assert_eq!(
            interpretive_in(&sibling),
            Vec::<String>::new(),
            "a PLUR plugin NOT on reputation-engine's path must be permitted (interpretive work lives in the plugin layer)"
        );
        assert!(
            sibling.contains("dispute-engine"),
            "but reputation-engine's real deps ARE in its closure"
        );
    }
}
