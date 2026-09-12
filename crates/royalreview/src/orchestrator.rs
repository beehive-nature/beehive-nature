//! Two-rail publication with partial-success, retry and duplicate-
//! prevention semantics. THE LAW OF THIS MODULE: **never report both rails
//! successful when only one succeeded** — `TwinReport::both_published()`
//! is derived structurally from the two per-rail outcomes, and the summary
//! line names every failed, unconfirmed or unattempted rail.
//!
//! Rail order follows mirror-by-law: the Nostr rail (BNR-owned, the record
//! of truth) publishes FIRST; the atproto record (the broadcast mirror) is
//! not attempted while the owned rail's landing is not CONFIRMED. The one
//! partial state this ordering can produce is `nostr landed, atproto
//! failed/unconfirmed/not-attempted` — the reverse is impossible by
//! construction.
//!
//! Epistemics of outcomes (Astra review 2026-09-12, comment 5647664844):
//! a **lost acknowledgement is unknown, not definitely unpublished**. A
//! transport error after a possible store, and an unavailable probe, both
//! yield [`RailOutcome::Unconfirmed`] — never `Failed`, which is reserved
//! for definite non-landing (an explicit rejection, an expired session).
//! After a lost acknowledgement the orchestrator makes ONE best-effort
//! reconcile probe: if it confirms the expected content the run reports
//! `Published`; otherwise `Unconfirmed`, and a later run's
//! probe-before-write settles it without ever re-publishing blindly.
//!
//! Per-rail idempotency is two-layered, like atmirror's State:
//! 1. **Local state** (`TwinState`) short-circuits a rail already ledgered
//!    as published — but ONLY when the rail's probe answer ALSO equals the
//!    locally computed expected id: a stale or inconsistent ledger can
//!    never approve content we would not mint ourselves.
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
    /// This run wrote it, and the rail's answer (or an immediate
    /// post-lost-ack reconcile probe) matched the locally computed id.
    Published { id: String },
    /// Provably already on the rail — by probe against the expected id. No
    /// write happened this run.
    Already { id: String },
    /// The identity is taken by DIFFERENT content (a probe answer or a
    /// ledger that disagrees with the locally computed id). Refused; never
    /// overwritten. Human decision required.
    Conflict { detail: String },
    /// Attempted this run and DEFINITELY did not land (explicit rejection
    /// or expired session). Retryable.
    Failed { error: String },
    /// Attempted (or probed) and the outcome is UNKNOWN: a transport
    /// error after a possible store, a lost acknowledgement whose
    /// reconcile probe was also unavailable, or a probe that cannot
    /// answer. The write may have landed — never re-publish blindly;
    /// settle by probe.
    Unconfirmed { detail: String },
    /// Not tried this run, and why (e.g. mirror blocked by owned-rail
    /// failure/unconfirmed state).
    NotAttempted { reason: String },
}

impl RailOutcome {
    fn landed(&self) -> bool {
        matches!(
            self,
            RailOutcome::Published { .. } | RailOutcome::Already { .. }
        )
    }
    fn is_unconfirmed(&self) -> bool {
        matches!(self, RailOutcome::Unconfirmed { .. })
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
    /// summarized as success: every non-landed rail is named, and a rail
    /// whose outcome is UNKNOWN reads UNRESOLVED — never "NOT PUBLISHED",
    /// which would claim an absence nobody observed.
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
            (false, false) if self.nostr.is_unconfirmed() || self.atproto.is_unconfirmed() => {
                format!(
                    "UNRESOLVED — nostr: {}; atproto: {} — an unconfirmed write may \
                     have landed; settle by probe before any retry, never re-publish blindly",
                    self.nostr, self.atproto
                )
            }
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
            RailOutcome::Unconfirmed { detail } => write!(
                f,
                "UNCONFIRMED — {detail} (the write may have landed; probe before retrying)"
            ),
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
    // Nor may one rkey be published under a second Nostr identity: the
    // twin binding (one atproto record ↔ one (pubkey, d-tag) event) would
    // silently fork. Checked BEFORE any write.
    if entry.nostr_pubkey != pubkey {
        return Err(format!(
            "rkey {rkey} is ledgered under a different publishing pubkey — refusing to \
             mint a second Nostr identity for one review (retry with the original key, \
             or use a new rkey)"
        ));
    }

    // ---- Rail 1: Nostr (the owned rail — record of truth, first). ----
    let nostr_outcome = nostr_leg(event.clone(), entry, nostr)?;

    // ---- Rail 2: atproto (the mirror — never before the original, and
    //      never while the original's landing is unconfirmed). ----
    let atproto_outcome = match &nostr_outcome {
        RailOutcome::Published { .. } | RailOutcome::Already { .. } => {
            atproto_leg(review, rkey, entry, atproto)?
        }
        other => RailOutcome::NotAttempted {
            reason: format!(
                "nostr rail not confirmed landed ({other}) — the mirror never \
                 precedes the record of truth, and not while its landing is unknown",
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

    // 1. State short-circuit — confirmed by probe AND against the locally
    //    computed expected id. The ledger agreeing with the rail is NOT
    //    enough: both could be stale or foreign. Every success path in
    //    this leg requires agreement with expected_id.
    if let Some(ledgered) = &entry.nostr_event_id {
        match nostr.find_by_dtag(&event.pubkey, &d_tag(&event)?) {
            Ok(Some(found)) if found == *ledgered && found == expected_id => {
                return Ok(RailOutcome::Already { id: found })
            }
            Ok(Some(found)) if found == *ledgered => {
                // Ledger and rail agree — with an id this run would NOT
                // mint. The ledger cannot vouch for content we would not
                // publish ourselves.
                return Ok(RailOutcome::Conflict {
                    detail: format!(
                        "ledger and rail both hold event {found}, but the locally \
                         computed id for this review+rkey+pubkey is {expected_id} — \
                         stale or foreign identity; refusing"
                    ),
                });
            }
            Ok(Some(_)) => {
                return Ok(RailOutcome::Conflict {
                    detail: format!(
                        "d-tag now holds a different event id than ledgered ({ledgered})"
                    ),
                })
            }
            Ok(None) => { /* ledgered but gone (e.g. relay reset) — re-publish */ }
            Err(e) => {
                return Ok(RailOutcome::Unconfirmed {
                    detail: format!("ledgered but probe unavailable: {e}"),
                })
            }
        }
    }

    // 2. Probe-before-write: recover the crash window between a landed
    //    write and the state save without duplicating. An unavailable
    //    probe is UNCONFIRMED — it must not assert the event is absent.
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
            return Ok(RailOutcome::Unconfirmed {
                detail: format!("pre-write probe unavailable: {e}"),
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
        // Definite non-landing — never a write.
        Err(e @ (SinkError::Rejected { .. } | SinkError::ExpiredSession)) => {
            Ok(RailOutcome::Failed {
                error: e.to_string(),
            })
        }
        // Transport error: the write MAY have landed. One best-effort
        // reconcile probe settles it; anything short of a confirmed
        // expected id stays UNCONFIRMED.
        Err(e) => match nostr.find_by_dtag(&event.pubkey, &d_tag(&event)?) {
            Ok(Some(found)) if found == expected_id => {
                entry.nostr_event_id = Some(expected_id.clone());
                Ok(RailOutcome::Published { id: expected_id })
            }
            Ok(Some(other)) => Ok(RailOutcome::Conflict {
                detail: format!(
                    "lost acknowledgement; probe shows event {other} under this \
                     d-tag but expected {expected_id} — refusing"
                ),
            }),
            Ok(None) => Ok(RailOutcome::Unconfirmed {
                detail: format!(
                    "acknowledgement lost ({e}); reconcile probe found \
nothing yet — replication lag is possible"
                ),
            }),
            Err(probe_err) => Ok(RailOutcome::Unconfirmed {
                detail: format!(
                    "acknowledgement lost ({e}); reconcile probe \
unavailable ({probe_err})"
                ),
            }),
        },
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

    // Classify what a probe found at our coordinates. `was_write_this_run`
    // separates Already (probe-only) from Published (this run's write,
    // confirmed after a lost acknowledgement by value equality).
    let mut confirm_stored =
        |stored: &(String, serde_json::Value), was_write_this_run: bool| -> RailOutcome {
            if stored.1 == record {
                entry.atproto_cid = Some(stored.0.clone());
                if was_write_this_run {
                    RailOutcome::Published {
                        id: stored.0.clone(),
                    }
                } else {
                    RailOutcome::Already {
                        id: stored.0.clone(),
                    }
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
    //    computation (see the crate-doc asymmetry). An unavailable probe
    //    is UNCONFIRMED — it must not assert the record is absent.
    match atproto.get_record(&did, REVIEW_NSID, rkey) {
        Ok(Some(stored)) => return Ok(confirm_stored(&stored, false)),
        Ok(None) => {}
        Err(e) => {
            return Ok(RailOutcome::Unconfirmed {
                detail: format!("getRecord probe unavailable: {e}"),
            })
        }
    }

    // 2. Write. The returned CID is sink-reported, recorded UNVERIFIED.
    match atproto.create_record(&did, REVIEW_NSID, rkey, &record) {
        Ok(cid) => {
            entry.atproto_cid = Some(cid.clone());
            Ok(RailOutcome::Published { id: cid })
        }
        // Definite non-landing.
        Err(e @ (SinkError::Rejected { .. } | SinkError::ExpiredSession)) => {
            Ok(RailOutcome::Failed {
                error: e.to_string(),
            })
        }
        // Transport error: the write MAY have landed (the fixture proves
        // this shape: store, then lose the response). One best-effort
        // reconcile getRecord settles it by value equality.
        Err(e) => match atproto.get_record(&did, REVIEW_NSID, rkey) {
            Ok(Some(stored)) => Ok(confirm_stored(&stored, true)),
            Ok(None) => Ok(RailOutcome::Unconfirmed {
                detail: format!(
                    "acknowledgement lost ({e}); reconcile probe found nothing yet — \
                     the write may still land; settle by probe before retrying"
                ),
            }),
            Err(probe_err) => Ok(RailOutcome::Unconfirmed {
                detail: format!(
                    "acknowledgement lost ({e}); reconcile probe unavailable ({probe_err})"
                ),
            }),
        },
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
