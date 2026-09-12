//! Two-rail publication with partial-success, retry and duplicate-
//! prevention semantics. THE LAW OF THIS MODULE: **never report both rails
//! successful when only one succeeded** — `TwinReport::both_published()`
//! is derived structurally from the two per-rail outcomes, and the summary
//! line names every failed or unattempted rail.
//!
//! Rail order follows mirror-by-law: the Nostr rail (BNR-owned, the record
//! of truth) publishes FIRST; the atproto record (the broadcast mirror) is
//! not attempted while the owned rail is down. The one partial state this
//! ordering can produce is `nostr OK, atproto failed/not-attempted` — the
//! reverse is impossible by construction.
//!
//! Per-rail idempotency is two-layered, like atmirror's State:
//! 1. **Local state** (`TwinState`) short-circuits a rail already ledgered
//!    as published, after a confirming probe.
//! 2. **Rail probes** recover the crash window between a successful write
//!    and the state save: an identical record/event already on the rail is
//!    `Already` (adopted into state), a DIFFERENT one under the same
//!    identity is `Conflict` — never overwritten.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::record::{Review, REVIEW_NSID};
use crate::twin::{build_twin, TwinEvent};
use crate::validate::{validate_review, FetchedReceipt};

/// Error shape for sink transports. `ExpiredSession` exists now so the
/// deliberate-publication/OAuth slice can surface expired tokens as a
/// distinct, non-retryable-in-process state from day one.
#[derive(Debug, Clone, PartialEq)]
pub enum SinkError {
    Transport(String),
    /// The rail refused the write (HTTP-ish status + body).
    Rejected {
        status: u16,
        body: String,
    },
    /// Auth/session no longer valid — user re-consent required, not a retry.
    ExpiredSession,
}

impl std::fmt::Display for SinkError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SinkError::Transport(e) => write!(f, "sink transport: {e}"),
            SinkError::Rejected { status, body } => {
                write!(f, "sink rejected write: {status}: {body}")
            }
            SinkError::ExpiredSession => {
                write!(
                    f,
                    "session expired — deliberate user re-authentication required"
                )
            }
        }
    }
}

impl std::error::Error for SinkError {}

/// The atproto rail boundary (com.atproto.repo.createRecord/getRecord
/// behind a trait; the real one arrives with the OAuth slice).
pub trait AtprotoSink {
    /// Write the record; return the record CID **as reported by the PDS**.
    /// (Recorded UNVERIFIED-locally — see the crate doc's known
    /// asymmetry.)
    fn create_record(
        &mut self,
        did: &str,
        collection: &str,
        rkey: &str,
        record: &serde_json::Value,
    ) -> Result<String, SinkError>;
    /// `(cid, value)` if a record exists at the coordinates.
    fn get_record(
        &self,
        did: &str,
        collection: &str,
        rkey: &str,
    ) -> Result<Option<(String, serde_json::Value)>, SinkError>;
}

/// The Nostr rail boundary (the owned rail; today the buzz relay).
pub trait NostrSink {
    /// Publish; must return the event id the rail actually stored.
    fn publish(&mut self, event: &TwinEvent) -> Result<String, SinkError>;
    /// The event id published under `(pubkey, d-tag)` if any
    /// (parameterized-replaceable addressing).
    fn find_by_dtag(&self, pubkey: &str, d: &str) -> Result<Option<String>, SinkError>;
}

/// One rail's outcome for one publish run.
#[derive(Debug, Clone, PartialEq)]
pub enum RailOutcome {
    /// This run wrote it (and the rail's answer matched what we computed).
    Published { id: String },
    /// Provably already on the rail — by probe or confirmed state. No
    /// write happened this run.
    Already { id: String },
    /// The identity is taken by DIFFERENT content. Refused; never
    /// overwritten. Human decision required.
    Conflict { detail: String },
    /// Attempted this run; did not land. Retryable.
    Failed { error: String },
    /// Not tried this run, and why (e.g. mirror blocked by owned-rail
    /// failure).
    NotAttempted { reason: String },
}

impl RailOutcome {
    fn landed(&self) -> bool {
        matches!(
            self,
            RailOutcome::Published { .. } | RailOutcome::Already { .. }
        )
    }
}

/// What one publish run did on both rails — the honest report.
#[derive(Debug, Clone, PartialEq)]
pub struct TwinReport {
    pub rkey: String,
    pub nostr: RailOutcome,
    pub atproto: RailOutcome,
}

impl TwinReport {
    /// TRUE only when BOTH rails are genuinely landed. Structurally
    /// derived from the two outcomes — there is no code path that can
    /// report success for a rail that failed or was never attempted.
    pub fn both_published(&self) -> bool {
        self.nostr.landed() && self.atproto.landed()
    }

    /// The honest one-line status. A partial or failed run can never be
    /// summarized as success: every non-landed rail is named.
    pub fn summary(&self) -> String {
        match (self.nostr.landed(), self.atproto.landed()) {
            (true, true) => format!("BOTH RAILS OK (rkey {})", self.rkey),
            (true, false) => format!(
                "PARTIAL — nostr OK, atproto {} — the owned rail holds the record; \
                 retry completes the mirror without duplicating",
                self.atproto
            ),
            (false, true) => format!(
                "INCONSISTENT — nostr {} while atproto landed; this should be \
                 unreachable (mirror never precedes the record of truth) — investigate",
                self.nostr
            ),
            (false, false) => format!(
                "NOT PUBLISHED — nostr: {}; atproto: {}",
                self.nostr, self.atproto
            ),
        }
    }
}

impl std::fmt::Display for RailOutcome {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RailOutcome::Published { id } => write!(f, "PUBLISHED id {id}"),
            RailOutcome::Already { id } => write!(f, "ALREADY id {id} (no write)"),
            RailOutcome::Conflict { detail } => write!(f, "CONFLICT — {detail}"),
            RailOutcome::Failed { error } => write!(f, "FAILED — {error}"),
            RailOutcome::NotAttempted { reason } => write!(f, "NOT ATTEMPTED — {reason}"),
        }
    }
}

/// Ledgered publication state, keyed by rkey. A cache, not a truth: a lost
/// file costs a probe round-trip, never a duplicate (the rails are
/// idempotent by identity). Same discipline as `atmirror::state`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TwinState {
    #[serde(default)]
    pub reviews: BTreeMap<String, ReviewEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewEntry {
    /// The canonical validated review (re-validated on load-and-publish).
    pub review: Review,
    pub nostr_pubkey: String,
    pub nostr_event_id: Option<String>,
    /// Sink-reported record CID — UNVERIFIED locally (crate-doc asymmetry).
    pub atproto_cid: Option<String>,
    pub attempts: u32,
}

impl TwinState {
    pub fn load(path: &std::path::Path) -> Result<TwinState, String> {
        match std::fs::read(path) {
            Ok(bytes) => {
                serde_json::from_slice(&bytes).map_err(|e| format!("{}: {e}", path.display()))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(TwinState::default()),
            Err(e) => Err(format!("{}: {e}", path.display())),
        }
    }

    /// Atomic save (sibling tmp + rename), like `atmirror::state::State`.
    pub fn save(&self, path: &std::path::Path) -> Result<(), String> {
        let json = serde_json::to_vec_pretty(self).map_err(|e| e.to_string())?;
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, &json).map_err(|e| format!("{}: {e}", tmp.display()))?;
        std::fs::rename(&tmp, path).map_err(|e| format!("{}: {e}", path.display()))?;
        Ok(())
    }
}

/// Publish one review to both rails.
///
/// - `receipt`: same Option semantics as `validate_review` (required when
///   the review carries a receipt strongRef).
/// - `rkey`: the client-minted TID (twin identity).
/// - `pubkey`: the Nostr publishing key (x-only hex).
///
/// The caller persists `state` (before and after are both safe — probes
/// recover the gap). Mutates `state` in memory either way.
pub fn publish(
    review: &Review,
    receipt: Option<FetchedReceipt<'_>>,
    rkey: &str,
    pubkey: &str,
    nostr: &mut dyn NostrSink,
    atproto: &mut dyn AtprotoSink,
    state: &mut TwinState,
) -> Result<TwinReport, String> {
    // Validate BEFORE any write — an invalid review never reaches a rail.
    validate_review(review, receipt)?;
    let event = build_twin(review, receipt, rkey, pubkey)?;
    let entry = state
        .reviews
        .entry(rkey.to_string())
        .or_insert_with(|| ReviewEntry {
            review: review.clone(),
            nostr_pubkey: pubkey.to_string(),
            nostr_event_id: None,
            atproto_cid: None,
            attempts: 0,
        });
    entry.attempts += 1;
    // The ledgered review must not silently diverge from what is published.
    if entry.review != *review {
        return Err(format!(
            "rkey {rkey} is already ledgered with DIFFERENT review content — a new \
             review needs a new rkey; refusing to mutate an existing identity"
        ));
    }

    // ---- Rail 1: Nostr (the owned rail — record of truth, first). ----
    let nostr_outcome = nostr_leg(event.clone(), entry, nostr)?;

    // ---- Rail 2: atproto (the mirror — never before the original). ----
    let atproto_outcome = match &nostr_outcome {
        RailOutcome::Published { .. } | RailOutcome::Already { .. } => {
            atproto_leg(review, rkey, entry, atproto)?
        }
        other => RailOutcome::NotAttempted {
            reason: format!(
                "nostr rail not landed ({other}) — the mirror never precedes the \
                 record of truth"
            ),
        },
    };

    Ok(TwinReport {
        rkey: rkey.to_string(),
        nostr: nostr_outcome,
        atproto: atproto_outcome,
    })
}

fn nostr_leg(
    event: TwinEvent,
    entry: &mut ReviewEntry,
    nostr: &mut dyn NostrSink,
) -> Result<RailOutcome, String> {
    let expected_id = event.id.clone();

    // 1. State short-circuit, confirmed by probe.
    if let Some(ledgered) = &entry.nostr_event_id {
        match nostr.find_by_dtag(&event.pubkey, &d_tag(&event)?) {
            Ok(Some(found)) if &found == ledgered => return Ok(RailOutcome::Already { id: found }),
            Ok(Some(_)) => {
                return Ok(RailOutcome::Conflict {
                    detail: format!(
                        "d-tag now holds a different event id than ledgered ({ledgered})"
                    ),
                })
            }
            Ok(None) => { /* ledgered but gone (e.g. relay reset) — re-publish */ }
            Err(e) => {
                return Ok(RailOutcome::Failed {
                    error: format!("probe: {e}"),
                })
            }
        }
    }

    // 2. Probe-before-write: recover the crash window between a landed
    //    write and the state save without duplicating.
    match nostr.find_by_dtag(&event.pubkey, &d_tag(&event)?) {
        Ok(Some(found)) if found == expected_id => {
            entry.nostr_event_id = Some(found.clone());
            return Ok(RailOutcome::Already { id: found });
        }
        Ok(Some(other)) => {
            return Ok(RailOutcome::Conflict {
                detail: format!(
                    "d-tag already holds event {other}, expected locally-computed \
                     {expected_id} — different content under this identity; refusing"
                ),
            })
        }
        Ok(None) => {}
        Err(e) => {
            return Ok(RailOutcome::Failed {
                error: format!("probe: {e}"),
            })
        }
    }

    // 3. Write; verify the rail's answer against the locally computed id
    //    (re-hash law — a lying sink is refused, not recorded).
    match nostr.publish(&event) {
        Ok(returned) if returned == expected_id => {
            entry.nostr_event_id = Some(expected_id.clone());
            Ok(RailOutcome::Published { id: expected_id })
        }
        Ok(other) => Ok(RailOutcome::Conflict {
            detail: format!(
                "sink stored id {other} but local computation says {expected_id} — \
                 refusing to ledger a rail that disagrees with the source hash"
            ),
        }),
        Err(SinkError::ExpiredSession) => Ok(RailOutcome::Failed {
            error: SinkError::ExpiredSession.to_string(),
        }),
        Err(e) => Ok(RailOutcome::Failed {
            error: e.to_string(),
        }),
    }
}

fn atproto_leg(
    review: &Review,
    rkey: &str,
    entry: &mut ReviewEntry,
    atproto: &mut dyn AtprotoSink,
) -> Result<RailOutcome, String> {
    let did = review.author.clone();
    let record = serde_json::to_value(review).map_err(|e| e.to_string())?;

    let mut check_stored = |stored: &(String, serde_json::Value)| -> RailOutcome {
        if stored.1 == record {
            entry.atproto_cid = Some(stored.0.clone());
            RailOutcome::Already {
                id: stored.0.clone(),
            }
        } else {
            RailOutcome::Conflict {
                detail: format!(
                    "at://{did}/{REVIEW_NSID}/{rkey} already holds different content \
                     (cid {}) — never overwritten",
                    stored.0
                ),
            }
        }
    };

    // 1. Probe-before-write (getRecord): covers both the crash window and
    //    the state-short-circuit check in one round trip — duplicate
    //    detection here is record-VALUE equality, which needs no CID
    //    computation (see the crate-doc asymmetry).
    match atproto.get_record(&did, REVIEW_NSID, rkey) {
        Ok(Some(stored)) => return Ok(check_stored(&stored)),
        Ok(None) => {}
        Err(e) => {
            return Ok(RailOutcome::Failed {
                error: format!("getRecord probe: {e}"),
            })
        }
    }

    // 2. Write. The returned CID is sink-reported, recorded UNVERIFIED.
    match atproto.create_record(&did, REVIEW_NSID, rkey, &record) {
        Ok(cid) => {
            entry.atproto_cid = Some(cid.clone());
            Ok(RailOutcome::Published { id: cid })
        }
        Err(SinkError::ExpiredSession) => Ok(RailOutcome::Failed {
            error: SinkError::ExpiredSession.to_string(),
        }),
        Err(e) => Ok(RailOutcome::Failed {
            error: e.to_string(),
        }),
    }
}

fn d_tag(event: &TwinEvent) -> Result<String, String> {
    event
        .tags
        .iter()
        .find(|t| t[0] == "d")
        .and_then(|t| t.get(1))
        .cloned()
        .ok_or_else(|| "twin event missing its d-tag".to_string())
}
