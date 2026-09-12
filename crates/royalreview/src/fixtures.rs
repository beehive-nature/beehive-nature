//! In-memory sinks — test support ONLY, never a production rail (the same
//! standing as `atmirror::rail::testrail`). They live in `src` (not
//! `tests/`) so both the unit suites here and the future deliberate-
//! publication/OAuth slice can drive the orchestrator without sockets.
//!
//! Failure injection is explicit: `fail_next` makes the NEXT write fail
//! (nothing stored — a definite non-landing); `lose_next_response` stores
//! the event/record and THEN returns a transport error — the crash window
//! where the write landed but the caller never learned; and
//! `fail_probe_on_nth` / `fail_get_on_nth` fail a chosen (Nth) probe call
//! so UNCONFIRMED paths are deterministically reachable.

use std::cell::Cell;
use std::collections::BTreeMap;

use sha2::Digest;

use crate::orchestrator::{AtprotoSink, NostrSink, SinkError};
use crate::twin::{compute_event_id, TwinEvent};

#[derive(Default)]
pub struct MemNostrSink {
    /// (pubkey, d-tag) -> event id
    by_dtag: BTreeMap<(String, String), String>,
    pub events: BTreeMap<String, TwinEvent>,
    pub publish_calls: usize,
    /// Probe call counter — `Cell` because the sink trait's probe takes
    /// `&self` (an honest rail's read path has no business mutating).
    pub probe_calls: Cell<usize>,
    pub fail_next: Option<SinkError>,
    /// Store, then report transport failure (response lost).
    pub lose_next_response: bool,
    /// Fail the Nth (1-based) find_by_dtag call — models an unavailable
    /// probe at a chosen point (e.g. the reconcile probe after a lost
    /// acknowledgement) so the orchestrator's UNCONFIRMED paths are
    /// deterministically testable.
    pub fail_probe_on_nth: Option<(usize, SinkError)>,
}

impl MemNostrSink {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn fail_next(&mut self, e: SinkError) {
        self.fail_next = Some(e);
    }
}

impl NostrSink for MemNostrSink {
    fn publish(&mut self, event: &TwinEvent) -> Result<String, SinkError> {
        self.publish_calls += 1;
        if let Some(e) = self.fail_next.take() {
            return Err(e);
        }
        // An honest rail recomputes the id from the canonical form — a
        // lying or corrupted rail is refused here too.
        let id = compute_event_id(event).map_err(SinkError::Transport)?;
        if id != event.id {
            return Err(SinkError::Transport(format!(
                "id mismatch: event claims {} but canonical form hashes to {}",
                event.id, id
            )));
        }
        let d = event
            .tags
            .iter()
            .find(|t| t[0] == "d")
            .and_then(|t| t.get(1))
            .cloned()
            .expect("validated twin carries a d-tag");
        self.by_dtag.insert((event.pubkey.clone(), d), id.clone());
        self.events.insert(id.clone(), event.clone());
        if self.lose_next_response {
            self.lose_next_response = false;
            return Err(SinkError::Transport("response lost after store".into()));
        }
        Ok(id)
    }

    fn find_by_dtag(&self, pubkey: &str, d: &str) -> Result<Option<String>, SinkError> {
        let n = self.probe_calls.get() + 1;
        self.probe_calls.set(n);
        if let Some((fail_at, e)) = &self.fail_probe_on_nth {
            if *fail_at == n {
                return Err(e.clone());
            }
        }
        Ok(self
            .by_dtag
            .get(&(pubkey.to_string(), d.to_string()))
            .cloned())
    }
}

#[derive(Default)]
pub struct MemAtprotoSink {
    /// (did, collection, rkey) -> (cid, record value)
    records: BTreeMap<(String, String, String), (String, serde_json::Value)>,
    pub create_calls: usize,
    /// Read call counter — `Cell` because the sink trait's read takes
    /// `&self`.
    pub get_calls: Cell<usize>,
    pub fail_next: Option<SinkError>,
    pub lose_next_response: bool,
    /// Fail the Nth (1-based) get_record call — models an unavailable
    /// probe at a chosen point (e.g. the reconcile read after a lost
    /// acknowledgement) so the orchestrator's UNCONFIRMED paths are
    /// deterministically testable.
    pub fail_get_on_nth: Option<(usize, SinkError)>,
}

impl MemAtprotoSink {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn fail_next(&mut self, e: SinkError) {
        self.fail_next = Some(e);
    }
    /// The record cid this fixture reports is a stand-in derived from the
    /// record bytes — NOT a real DAG-CBOR CID (see the crate-doc
    /// asymmetry: atproto cids are sink-reported and UNVERIFIED locally).
    fn fixture_cid(record: &serde_json::Value) -> String {
        let bytes = serde_json::to_vec(record).expect("record serializes");
        let digest = sha2::Sha256::digest(&bytes);
        format!(
            "bafyreifixture{}",
            &atmirror::rail::hex_lower(&digest)[..32]
        )
    }
}

impl AtprotoSink for MemAtprotoSink {
    fn create_record(
        &mut self,
        did: &str,
        collection: &str,
        rkey: &str,
        record: &serde_json::Value,
    ) -> Result<String, SinkError> {
        self.create_calls += 1;
        if let Some(e) = self.fail_next.take() {
            return Err(e);
        }
        let key = (did.to_string(), collection.to_string(), rkey.to_string());
        if self.records.contains_key(&key) {
            return Err(SinkError::Rejected {
                status: 409,
                body: "record already exists".into(),
            });
        }
        let cid = Self::fixture_cid(record);
        self.records.insert(key, (cid.clone(), record.clone()));
        if self.lose_next_response {
            self.lose_next_response = false;
            return Err(SinkError::Transport("response lost after store".into()));
        }
        Ok(cid)
    }

    fn get_record(
        &self,
        did: &str,
        collection: &str,
        rkey: &str,
    ) -> Result<Option<(String, serde_json::Value)>, SinkError> {
        let n = self.get_calls.get() + 1;
        self.get_calls.set(n);
        if let Some((fail_at, e)) = &self.fail_get_on_nth {
            if *fail_at == n {
                return Err(e.clone());
            }
        }
        Ok(self
            .records
            .get(&(did.to_string(), collection.to_string(), rkey.to_string()))
            .cloned())
    }
}
