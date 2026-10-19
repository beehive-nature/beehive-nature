//! R2 — failover switch + context preservation (port of Python B2).
//!
//! The switch sequence (spec §2.2), verbatim from the reference:
//! FAILOVER detected → FREEZE (keep partial, mark truncated) → CHECKPOINT
//! (serialize + sha256 + sign via identity hook + publish) → PENDING TOOLS
//! (orphaned calls are NOT executed; re-presented for explicit re-decision)
//! → HANDOFF INJECTION (one user-role note, harness-written) → RESUME on
//! the next backend → POST-SWITCH CHECKPOINT after the first successful turn.
//!
//! Wire purity: the transcript sent to backends contains only role/content/
//! tool_call_id fields. Per-message metadata (backend, truncated, orphaned,
//! injected) lives in the JSONL rows beside each message, never inside it —
//! so the canonical transcript hash is stable and the §2.5 byte-prefix
//! property holds. Byte parity with the Python canonicalization is pinned
//! by oracle vectors generated from the reference implementation.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio_util::sync::CancellationToken;

use event_bus::EventBus;
use shared_types::{AgentEvent, CanonicalEvent, EventPayload, EventType, SourceChain};

use crate::backend::{BackendError, ChatMessage, ModelBackend, StopReason, Turn};
use crate::identity::IdentityHook;
use crate::tools::{parse_tool_blocks, tool_message, ToolCall, Toolset};

/// Verbatim handoff note (§2.3). Placeholders: ts, old, new, goal.
pub const HANDOFF_TEMPLATE: &str =
    "[harness] Provider failover at {ts}. You are the same agent, continuing \
    the same task. Your model backend changed ({old} -> {new}). Your memory, \
    goal, and tool history above are intact and authoritative — do not \
    re-derive them, do not restart the task. Last confirmed state: {goal}. \
    Orphaned tool calls (if any) are listed in the following tool messages \
    for your explicit re-decision. Continue.";

/// Verbatim orphan notice (§2.2 step 4).
pub const ORPHAN_NOTICE: &str =
    "[harness] the previous backend died before this call was executed; it \
    was NOT run, and no side effects occurred. Re-decide whether it is \
    still needed.";

/// Probe cadence for every backend (spec §5).
pub const PROBE_INTERVAL_SECS: u64 = 5;

/// Render the handoff note. `goal_objective` is the goal's `objective`
/// field or `"(goal unset)"`, exactly like the reference.
pub fn handoff_note(ts: &str, old: &str, new: &str, goal_objective: &str) -> String {
    HANDOFF_TEMPLATE
        .replace("{ts}", ts)
        .replace("{old}", old)
        .replace("{new}", new)
        .replace("{goal}", goal_objective)
}

/// Deterministic serialization of the wire-pure transcript (§2.5).
/// Byte-identical to the Python: compact separators, keys sorted,
/// non-ASCII unescaped, `\n`-joined.
pub fn canonical_messages(msgs: &[ChatMessage]) -> String {
    msgs.iter()
        .map(|message| {
            let value = serde_json::to_value(message).expect("chat message serializes to JSON");
            serde_json::to_string(&value).expect("JSON value serializes")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Hex sha256 of the canonical transcript (Python `transcript_sha256`).
pub fn transcript_sha256(msgs: &[ChatMessage]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(canonical_messages(msgs).as_bytes());
    format!("{:x}", hasher.finalize())
}

/// §2.5 — what "no context loss" means, checked mechanically.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContinuityReport {
    pub ok: bool,
    pub transcript_prefix_exact: bool,
    pub goal_identical: bool,
    pub tool_results_preserved: bool,
    pub pre_sha256: String,
    pub post_sha256: String,
}

pub fn verify_transcript_continuity(
    pre_msgs: &[ChatMessage],
    post_msgs: &[ChatMessage],
    pre_goal: &Value,
    post_goal: &Value,
) -> ContinuityReport {
    let prefix = &post_msgs[..pre_msgs.len().min(post_msgs.len())];
    let transcript_prefix_exact = pre_msgs.len() <= post_msgs.len()
        && canonical_messages(pre_msgs) == canonical_messages(prefix);
    let goal_identical = pre_goal == post_goal;
    let pre_tools: Vec<&ChatMessage> = pre_msgs.iter().filter(|m| m.role == "tool").collect();
    let post_tools: Vec<&ChatMessage> = prefix.iter().filter(|m| m.role == "tool").collect();
    let tool_results_preserved = pre_tools == post_tools;
    ContinuityReport {
        ok: transcript_prefix_exact && goal_identical && tool_results_preserved,
        transcript_prefix_exact,
        goal_identical,
        tool_results_preserved,
        pre_sha256: transcript_sha256(pre_msgs),
        post_sha256: transcript_sha256(post_msgs),
    }
}

/// UTC seconds since the Unix epoch.
pub fn unix_now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

/// RFC 3339 UTC timestamp (`2026-10-19T12:00:00+00:00`), hand-rolled so
/// the harness adds no date dependency. Format-only: not hashed, not
/// compared — it lives in JSONL rows beside messages, never inside them.
pub fn utc_now_rfc3339() -> String {
    utc_from_secs(unix_now_secs().max(0) as u64)
}

/// RFC 3339 UTC timestamp offset into the future (quote TTLs).
pub fn utc_now_plus_rfc3339(offset_secs: i64) -> String {
    utc_from_secs(unix_now_secs().saturating_add(offset_secs).max(0) as u64)
}

fn utc_from_secs(secs: u64) -> String {
    let days = secs / 86_400;
    let time = secs % 86_400;
    // Howard Hinnant's civil-from-days.
    let era = (if days >= 719_468 { days } else { 0 } + 719_468) / 146_097;
    let day_of_era = (if days >= 719_468 { days } else { 0 } + 719_468) - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era as i64 + era as i64 * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month = (day_of_year * 5 + 2) / 153;
    let day = (day_of_year - (153 * month + 2) / 5 + 1) as u64;
    let month = if month < 10 { month + 3 } else { month - 9 } as u64;
    let year = if month <= 2 { year + 1 } else { year };
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}+00:00",
        time / 3_600,
        (time % 3_600) / 60,
        time % 60
    )
}

/// One stored row: the wire-pure message plus sidecar metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredRow {
    pub msg: ChatMessage,
    pub ts: String,
    #[serde(flatten, default)]
    pub meta: BTreeMap<String, Value>,
}

/// Append-only session persistence (Python `SessionStore`).
pub struct SessionStore {
    session_id: String,
    dir: PathBuf,
    rows: Vec<StoredRow>,
}

impl SessionStore {
    pub fn new(root: &Path, session_id: &str) -> std::io::Result<Self> {
        let dir = root.join("sessions");
        std::fs::create_dir_all(&dir)?;
        Ok(SessionStore {
            session_id: session_id.to_string(),
            dir,
            rows: Vec::new(),
        })
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn rows(&self) -> &[StoredRow] {
        &self.rows
    }

    pub fn messages(&self) -> Vec<ChatMessage> {
        self.rows.iter().map(|row| row.msg.clone()).collect()
    }

    pub fn append(
        &mut self,
        message: ChatMessage,
        meta: BTreeMap<String, Value>,
    ) -> std::io::Result<()> {
        let row = StoredRow {
            msg: message,
            ts: utc_now_rfc3339(),
            meta,
        };
        let line = serde_json::to_string(&row).expect("stored row serializes");
        self.append_row(&self.session_file("jsonl"), &line)?;
        self.rows.push(row);
        Ok(())
    }

    pub fn save_goal(&self, goal: &Value) -> std::io::Result<()> {
        std::fs::write(
            self.session_file("goal.json"),
            serde_json::to_string_pretty(goal).expect("goal serializes"),
        )
    }

    pub fn load_goal(&self) -> Option<Value> {
        let text = std::fs::read_to_string(self.session_file("goal.json")).ok()?;
        serde_json::from_str(&text).ok()
    }

    pub fn append_checkpoint(&self, snapshot: &Value) -> std::io::Result<()> {
        let line = serde_json::to_string(snapshot).expect("checkpoint serializes");
        self.append_row(&self.session_file("checkpoints.jsonl"), &line)
    }

    pub fn read_checkpoints(&self) -> Vec<Value> {
        let path = self.session_file("checkpoints.jsonl");
        let text = std::fs::read_to_string(path).unwrap_or_default();
        text.lines()
            .filter_map(|line| serde_json::from_str(line).ok())
            .collect()
    }

    fn session_file(&self, suffix: &str) -> PathBuf {
        self.dir.join(format!("{}.{suffix}", self.session_id))
    }

    fn append_row(&self, path: &Path, line: &str) -> std::io::Result<()> {
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?;
        writeln!(file, "{line}")?;
        Ok(())
    }
}

fn meta_pair(key: &str, value: &str) -> BTreeMap<String, Value> {
    let mut meta = BTreeMap::new();
    meta.insert(key.to_string(), Value::String(value.to_string()));
    meta
}

fn meta_flag(key: &str) -> BTreeMap<String, Value> {
    let mut meta = BTreeMap::new();
    meta.insert(key.to_string(), Value::Bool(true));
    meta
}

/// Thread-safe failover request (prober or operator → loop).
#[derive(Debug, Default)]
pub struct FailoverFlag {
    requested: AtomicBool,
    reason: Mutex<String>,
}

impl FailoverFlag {
    pub fn request(&self, reason: String) {
        *self.reason.lock().expect("reason lock") = reason;
        self.requested.store(true, Ordering::SeqCst);
    }

    pub fn take(&self) -> Option<String> {
        if self
            .requested
            .compare_exchange(true, false, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            Some(self.reason.lock().expect("reason lock").clone())
        } else {
            None
        }
    }
}

/// Signed checkpoint material for the bus event.
#[derive(Debug, Clone)]
pub struct CheckpointEnvelope {
    pub did: String,
    pub signature_b64u: String,
    pub transcript_sha256: String,
}

/// Event publisher: builds bus-native lifecycle events and publishes
/// them. The Nostr adapter (R4) subscribes to the bus and translates —
/// the bus stays primary, Nostr stays transport.
pub trait CheckpointPublisher: Send + Sync {
    fn agent_checkpoint(
        &self,
        session_id: &str,
        phase: &str,
        transcript_sha256: &str,
        turn_count: u64,
        backend: &str,
        envelope: Option<&CheckpointEnvelope>,
    ) -> CanonicalEvent;

    fn agent_status(
        &self,
        session_id: &str,
        task_id: &str,
        turn: u64,
        backend: &str,
        state: &str,
    ) -> CanonicalEvent;

    fn publish(&self, event: CanonicalEvent);
}

/// Bus-native publisher: builds `AgentStatus` / `AgentCheckpoint`
/// CanonicalEvents and publishes them on the bus.
pub struct BusPublisher {
    bus: EventBus,
    agent_did: String,
}

impl BusPublisher {
    pub fn new(bus: EventBus, agent_did: impl Into<String>) -> Self {
        BusPublisher {
            bus,
            agent_did: agent_did.into(),
        }
    }

    fn envelope(
        &self,
        event_type: EventType,
        session_id: &str,
        detail: &str,
        payload: AgentEvent,
    ) -> CanonicalEvent {
        CanonicalEvent {
            event_id: format!("{session_id}-{detail}"),
            event_type,
            timestamp: unix_now_secs(),
            source_chain: SourceChain::Harness,
            source_ref: format!("harness:{session_id}:{detail}"),
            payload: EventPayload::Agent(payload),
            canonicalized_by: "harness-sovereign".to_string(),
        }
    }
}

impl CheckpointPublisher for BusPublisher {
    fn agent_checkpoint(
        &self,
        session_id: &str,
        phase: &str,
        transcript_sha256: &str,
        turn_count: u64,
        backend: &str,
        envelope: Option<&CheckpointEnvelope>,
    ) -> CanonicalEvent {
        self.envelope(
            EventType::AgentCheckpoint,
            session_id,
            phase,
            AgentEvent {
                agent_did: self.agent_did.clone(),
                session_id: session_id.to_string(),
                task_id: None,
                turn: None,
                backend: Some(backend.to_string()),
                state: None,
                phase: Some(phase.to_string()),
                transcript_sha256: Some(transcript_sha256.to_string()),
                turn_count: Some(turn_count),
                signature_b64u: envelope.map(|env| env.signature_b64u.clone()),
            },
        )
    }

    fn agent_status(
        &self,
        session_id: &str,
        task_id: &str,
        turn: u64,
        backend: &str,
        state: &str,
    ) -> CanonicalEvent {
        self.envelope(
            EventType::AgentStatus,
            session_id,
            state,
            AgentEvent {
                agent_did: self.agent_did.clone(),
                session_id: session_id.to_string(),
                task_id: Some(task_id.to_string()),
                turn: Some(turn),
                backend: Some(backend.to_string()),
                state: Some(state.to_string()),
                phase: None,
                transcript_sha256: None,
                turn_count: None,
                signature_b64u: None,
            },
        )
    }

    fn publish(&self, event: CanonicalEvent) {
        let _ = self.bus.publish(event);
    }
}

/// How [`SwitchCoordinator::run`] ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunOutcome {
    EndTurn,
    Cancelled,
    MaxTurns,
}

/// Coordinator errors: a fatal backend (or an exhausted backend list)
/// aborts the run; store failures propagate as text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CoordError {
    Backend(BackendError),
    Store(String),
}

impl std::fmt::Display for CoordError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CoordError::Backend(error) => write!(formatter, "backend failed: {error:?}"),
            CoordError::Store(error) => write!(formatter, "session store failed: {error}"),
        }
    }
}

impl std::error::Error for CoordError {}

/// The agent loop that survives its model dying (Python
/// `SwitchCoordinator`). One-way failover per run.
pub struct SwitchCoordinator {
    backends: Vec<std::sync::Arc<dyn ModelBackend>>,
    store: SessionStore,
    toolset: Toolset,
    publisher: Option<std::sync::Arc<dyn CheckpointPublisher>>,
    identity: Option<IdentityHook>,
    goal: Value,
    max_turns: u32,
    probe_every_secs: u64,
    consecutive_failures: u32,
    active_index: usize,
    pending_post: bool,
    flag: Arc<FailoverFlag>,
    log: Option<Arc<dyn Fn(String) + Send + Sync>>,
}

impl SwitchCoordinator {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        backends: Vec<std::sync::Arc<dyn ModelBackend>>,
        store: SessionStore,
        toolset: Toolset,
        publisher: Option<std::sync::Arc<dyn CheckpointPublisher>>,
        identity: Option<IdentityHook>,
        goal: Value,
        max_turns: u32,
    ) -> Self {
        assert!(
            backends.len() >= 2,
            "a switch demo needs at least two backends"
        );
        SwitchCoordinator {
            backends,
            store,
            toolset,
            publisher,
            identity,
            goal,
            max_turns,
            probe_every_secs: crate::switch::PROBE_INTERVAL_SECS,
            consecutive_failures: 2,
            active_index: 0,
            pending_post: false,
            flag: Arc::new(FailoverFlag::default()),
            log: None,
        }
    }

    pub fn with_log(mut self, log: Arc<dyn Fn(String) + Send + Sync>) -> Self {
        self.log = Some(log);
        self
    }

    pub fn request_failover(&self, reason: String) {
        self.flag.request(reason);
    }

    fn emit(&self, line: String) {
        if let Some(log) = &self.log {
            log(line);
        }
    }

    fn task_id(&self) -> String {
        self.goal
            .get("task_id")
            .and_then(|id| id.as_str())
            .unwrap_or("task")
            .to_string()
    }

    fn goal_objective(&self) -> String {
        self.goal
            .get("objective")
            .and_then(|objective| objective.as_str())
            .unwrap_or("(goal unset)")
            .to_string()
    }

    /// Run the agent loop until end_turn / cancelled / max_turns.
    /// Raises the backend error when the last backend fails fatally or
    /// failover is exhausted.
    pub async fn run(&mut self, cancel: CancellationToken) -> Result<RunOutcome, CoordError> {
        self.store
            .save_goal(&self.goal)
            .map_err(|e| CoordError::Store(e.to_string()))?;
        if let Some(identity) = &self.identity {
            // F4 boot gate: the signer must prove itself before the demo
            // starts; genesis op + DID are established before the first turn.
            if !identity.selftest() {
                return Err(CoordError::Store(
                    "bsigner selftest failed at boot".to_string(),
                ));
            }
        }
        let monitor = self.spawn_monitor();
        let outcome = self.drive(cancel).await;
        monitor.abort();
        outcome
    }

    fn spawn_monitor(&self) -> tokio::task::JoinHandle<()> {
        let flag = self.flag.clone();
        let primary = self.backends[0].clone();
        let every = self.probe_every_secs;
        let consecutive = self.consecutive_failures;
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(every));
            interval.tick().await; // first probe after one full period
            let mut fails = 0u32;
            loop {
                interval.tick().await;
                if primary.health().await {
                    fails = 0;
                } else {
                    fails += 1;
                    if fails >= consecutive {
                        flag.request(format!("prober: {consecutive} consecutive health failures"));
                        return;
                    }
                }
            }
        })
    }

    async fn drive(&mut self, cancel: CancellationToken) -> Result<RunOutcome, CoordError> {
        for _turn in 0..self.max_turns {
            if cancel.is_cancelled() {
                return Ok(RunOutcome::Cancelled);
            }
            if let Some(reason) = self.flag.take() {
                if self.active_index + 1 < self.backends.len() {
                    self.do_failover(String::new(), reason)?;
                    continue;
                }
            }
            let backend = self.backends[self.active_index].clone();
            self.publish_status("thinking", backend.name());
            let turn = match backend
                .complete(&self.store.messages(), cancel.clone())
                .await
            {
                Ok(turn) => turn,
                Err(error) => match error {
                    BackendError::Unavailable {
                        reason,
                        detail,
                        partial,
                    } => {
                        self.do_failover(
                            partial,
                            format!("in-flight [{}] {detail}", reason.as_str()),
                        )?;
                        continue;
                    }
                    fatal => return Err(CoordError::Backend(fatal)),
                },
            };
            if turn.stop_reason == StopReason::Cancelled {
                if !turn.text.trim().is_empty() {
                    self.append_assistant(&turn.text, backend.name(), true)?;
                }
                return Ok(RunOutcome::Cancelled);
            }
            self.append_assistant(&turn.text, backend.name(), false)?;
            self.publish_status("responded", backend.name());
            if self.pending_post && self.active_index > 0 {
                self.checkpoint("post-switch")?;
                self.pending_post = false;
            }
            // The parser is the single source of truth for tool calls:
            // re-parse the appended text instead of trusting the backend.
            let tool_calls = if turn.tool_calls.is_empty() {
                parse_tool_blocks(&turn.text)
            } else {
                turn.tool_calls.clone()
            };
            if tool_calls.is_empty() {
                return Ok(RunOutcome::EndTurn);
            }
            for call in &tool_calls {
                let result = self.toolset.execute(call);
                self.store
                    .append(result, meta_pair("backend", backend.name()))
                    .map_err(|e| CoordError::Store(e.to_string()))?;
            }
        }
        Ok(RunOutcome::MaxTurns)
    }

    fn append_assistant(
        &mut self,
        text: &str,
        backend_name: &str,
        truncated: bool,
    ) -> Result<(), CoordError> {
        let mut meta = meta_pair("backend", backend_name);
        if truncated {
            meta.insert("truncated".to_string(), Value::Bool(true));
        }
        self.store
            .append(
                ChatMessage {
                    role: "assistant".into(),
                    content: text.to_string(),
                    tool_call_id: None,
                },
                meta,
            )
            .map_err(|e| CoordError::Store(e.to_string()))
    }

    fn do_failover(&mut self, partial_text: String, reason: String) -> Result<(), CoordError> {
        let old_name = self.backends[self.active_index].name().to_string();
        let new_name = self.backends[self.active_index + 1].name().to_string();
        self.emit(format!("FAILOVER {old_name} -> {new_name} ({reason})"));

        // FREEZE — partial text is kept and marked, never dropped.
        if !partial_text.trim().is_empty() {
            self.append_assistant(&partial_text, &old_name, true)?;
        }

        // CHECKPOINT — serialize + hash (+ sign/publish when hooks exist).
        self.checkpoint("pre-switch")?;

        // PENDING TOOLS — orphaned calls are NOT executed; the new model
        // explicitly re-decides. No phantom side effects.
        for orphan in self.find_orphans() {
            let id = orphan.id.clone().unwrap_or_else(|| "unknown".to_string());
            self.store
                .append(tool_message(&id, ORPHAN_NOTICE), {
                    let mut meta = meta_pair("backend", &old_name);
                    meta.insert("orphaned".to_string(), Value::Bool(true));
                    meta
                })
                .map_err(|e| CoordError::Store(e.to_string()))?;
        }

        // HANDOFF INJECTION — one harness-written user note.
        let note = handoff_note(
            &utc_now_rfc3339(),
            &old_name,
            &new_name,
            &self.goal_objective(),
        );
        self.store
            .append(ChatMessage::user(note), {
                let mut meta = meta_pair("backend", "harness");
                meta.insert("injected".to_string(), Value::String("handoff".to_string()));
                meta
            })
            .map_err(|e| CoordError::Store(e.to_string()))?;

        // RESUME — flip the pointer; every later turn is tagged.
        self.active_index += 1;
        self.pending_post = true;
        self.publish_status("failed-over", &new_name);
        Ok(())
    }

    fn find_orphans(&self) -> Vec<ToolCall> {
        let satisfied: std::collections::HashSet<Option<String>> = self
            .store
            .rows()
            .iter()
            .filter(|row| row.msg.role == "tool")
            .map(|row| row.msg.tool_call_id.clone())
            .collect();
        let mut orphans = Vec::new();
        for row in self.store.rows() {
            if row.msg.role != "assistant" {
                continue;
            }
            for call in parse_tool_blocks(&row.msg.content) {
                if call.id.is_some() && !satisfied.contains(&call.id) {
                    orphans.push(call);
                }
            }
        }
        orphans
    }

    fn checkpoint(&mut self, phase: &str) -> Result<serde_json::Value, CoordError> {
        let msgs = self.store.messages();
        let sha = transcript_sha256(&msgs);
        let backend_name = self.backends[self.active_index].name().to_string();
        let mut snap = serde_json::json!({
            "phase": phase,
            "ts": utc_now_rfc3339(),
            "backend": backend_name,
            "turn_count": msgs.len(),
            "transcript_sha256": sha,
        });
        let mut envelope: Option<CheckpointEnvelope> = None;
        if let Some(identity) = &self.identity {
            let bytes = canonical_messages(&msgs).into_bytes();
            let signed = identity.checkpoint(&bytes).map_err(CoordError::Store)?;
            envelope = Some(CheckpointEnvelope {
                did: signed.did.clone(),
                signature_b64u: bsigner::b64::b64u(&signed.sig),
                transcript_sha256: sha.clone(),
            });
            snap["bsigner_envelope"] = serde_json::json!({
                "did": signed.did,
                "signature_b64u": bsigner::b64::b64u(&signed.sig),
            });
        }
        self.store
            .append_checkpoint(&snap)
            .map_err(|e| CoordError::Store(e.to_string()))?;
        if let Some(publisher) = &self.publisher {
            let event = publisher.agent_checkpoint(
                self.store.session_id(),
                phase,
                &sha,
                msgs.len() as u64,
                &backend_name,
                envelope.as_ref(),
            );
            publisher.publish(event);
        }
        self.emit(format!("CHECKPOINT {phase} sha256={}…", &sha[..16]));
        Ok(snap)
    }

    fn publish_status(&self, state: &str, backend_name: &str) {
        if let Some(publisher) = &self.publisher {
            let event = publisher.agent_status(
                self.store.session_id(),
                &self.task_id(),
                self.store.rows().len() as u64,
                backend_name,
                state,
            );
            publisher.publish(event);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backend::{FailoverReason, StopReason};
    use std::collections::VecDeque;

    enum StubStep {
        Turn(Turn),
        Fail(BackendError),
    }

    struct StubBackend {
        name: String,
        model: String,
        script: Mutex<VecDeque<StubStep>>,
        health_script: Mutex<VecDeque<bool>>,
    }

    impl StubBackend {
        fn failing(name: &str, error: BackendError) -> Arc<Self> {
            Arc::new(StubBackend {
                name: name.into(),
                model: "stub-model".into(),
                script: Mutex::new(VecDeque::from([StubStep::Fail(error)])),
                health_script: Mutex::new(VecDeque::new()),
            })
        }
    }

    #[async_trait::async_trait]
    impl ModelBackend for StubBackend {
        fn name(&self) -> &str {
            &self.name
        }

        fn model_id(&self) -> &str {
            &self.model
        }

        async fn complete(
            &self,
            _messages: &[ChatMessage],
            _cancel: CancellationToken,
        ) -> Result<Turn, BackendError> {
            match self.script.lock().expect("script").pop_front() {
                Some(StubStep::Turn(turn)) => Ok(turn),
                Some(StubStep::Fail(error)) => Err(error),
                None => Err(BackendError::from_transport("script exhausted".to_string())),
            }
        }

        async fn health(&self) -> bool {
            self.health_script
                .lock()
                .expect("health")
                .pop_front()
                .unwrap_or(true)
        }
    }

    fn scripted_turn(text: &str) -> StubStep {
        StubStep::Turn(Turn {
            text: text.to_string(),
            tool_calls: parse_tool_blocks(text),
            stop_reason: StopReason::EndTurn,
            usage: Value::Null,
        })
    }

    fn temp_root(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("harness-switch-test-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp root");
        dir
    }

    #[test]
    fn canonical_form_matches_python_oracle() {
        // Oracle vectors generated from harness/switch.py canonical_messages
        // + hashlib.sha256 (canon_vectors.py). Byte parity is load-bearing
        // for the §2.5 prefix property across implementations.
        let user_hi = vec![ChatMessage {
            role: "user".into(),
            content: "hi".into(),
            tool_call_id: None,
        }];
        assert_eq!(
            canonical_messages(&user_hi),
            "{\"content\":\"hi\",\"role\":\"user\"}"
        );
        assert_eq!(
            transcript_sha256(&user_hi),
            concat!(
                "9017285104d1b249960a30732b8e92f6e2",
                "fb3acf8d8e4b2a16c116ad0c1ed211"
            )
        );

        let unicode = vec![ChatMessage {
            role: "user".into(),
            content: "héllo wörld ✓".into(),
            tool_call_id: None,
        }];
        assert_eq!(
            transcript_sha256(&unicode),
            concat!(
                "e98274d4eb382bfa1a173667ac0f95d52d",
                "073b0c395533e29b3d2f5c90befea3"
            )
        );

        let mixed = vec![
            ChatMessage::user("go"),
            ChatMessage {
                role: "assistant".into(),
                content: "on it".into(),
                tool_call_id: None,
            },
            ChatMessage::tool("t1", "sha256(text) = abc"),
        ];
        assert_eq!(
            canonical_messages(&mixed),
            "{\"content\":\"go\",\"role\":\"user\"}\n\
             {\"content\":\"on it\",\"role\":\"assistant\"}\n\
             {\"content\":\"sha256(text) = abc\",\"role\":\"tool\",\"tool_call_id\":\"t1\"}"
        );
        assert_eq!(
            transcript_sha256(&mixed),
            concat!(
                "9252c5abd7bfdbb8d9381758dcae85d5eff8",
                "40dc83c8eed595f209c03c2eb0de"
            )
        );
    }

    #[test]
    fn continuity_checks_mean_what_they_say() {
        let goal = serde_json::json!({"objective": "fetch", "task_id": "T-1"});
        let pre = vec![
            ChatMessage::user("go"),
            ChatMessage {
                role: "assistant".into(),
                content: "call".into(),
                tool_call_id: None,
            },
            ChatMessage::tool("t1", "result"),
        ];
        let mut post = pre.clone();
        post.push(ChatMessage {
            role: "assistant".into(),
            content: "done".into(),
            tool_call_id: None,
        });
        let report = verify_transcript_continuity(&pre, &post, &goal, &goal);
        assert!(report.ok, "extension must verify: {report:?}");

        let mut other_goal = goal.clone();
        other_goal["objective"] = serde_json::json!("changed");
        let report = verify_transcript_continuity(&pre, &post, &goal, &other_goal);
        assert!(!report.ok && !report.goal_identical);

        let mut dropped = pre.clone();
        dropped.pop();
        let mut post2 = dropped.clone();
        post2.extend(post[3..].iter().cloned());
        let report = verify_transcript_continuity(&pre, &post2, &goal, &goal);
        assert!(!report.ok && !report.tool_results_preserved);

        let mut diverged = post.clone();
        diverged[1].content = "rewritten".into();
        let report = verify_transcript_continuity(&pre, &diverged, &goal, &goal);
        assert!(!report.ok && !report.transcript_prefix_exact);
    }

    fn failover_fixture(tag: &str) -> (PathBuf, Toolset, IdentityHook, BusPublisher, Value) {
        let root = temp_root(tag);
        let sandbox = root.join("sandbox");
        let toolset = Toolset::new(&sandbox).expect("sandbox");
        std::fs::write(sandbox.join("a.txt"), b"alpha-network-data\n").expect("fixture file");
        let keys = root.join("keys");
        std::fs::create_dir_all(&keys).expect("keys dir");
        let identity = IdentityHook::genesis(&keys, IdentityHook::test_vault()).expect("genesis");
        let bus = EventBus::new(64);
        let publisher = BusPublisher::new(bus, identity.did());
        let goal = serde_json::json!({"objective": "fetch the data", "task_id": "T-001"});
        (root, toolset, identity, publisher, goal)
    }

    #[tokio::test]
    async fn full_failover_sequence_through_scripted_backends() {
        let (root, toolset, identity, publisher, goal) = failover_fixture("failover");

        let tool_text = "hashing now\n```tool\n{\"id\": \"t1\", \"name\": \"compute_sha256\", \"args\": {\"target\": \"a.txt\"}}\n```";
        let orphan_partial = "partial thinking ```tool\n{\"id\": \"t9\", \"name\": \"read_file\", \"args\": {\"path\": \"a.txt\"}}\n```";
        let primary = Arc::new(StubBackend {
            name: "mock-primary".into(),
            model: "spark-primary".into(),
            script: Mutex::new(VecDeque::from([
                scripted_turn(tool_text),
                StubStep::Fail(BackendError::Unavailable {
                    reason: FailoverReason::RateLimit,
                    detail: "HTTP 429".into(),
                    partial: orphan_partial.into(),
                }),
            ])),
            health_script: Mutex::new(VecDeque::new()),
        });
        let secondary = Arc::new(StubBackend {
            name: "mock-secondary".into(),
            model: "spark-tertiary".into(),
            script: Mutex::new(VecDeque::from([scripted_turn("final answer")])),
            health_script: Mutex::new(VecDeque::new()),
        });

        let store = SessionStore::new(&root, "sess-failover").expect("store");
        let mut coordinator = SwitchCoordinator::new(
            vec![primary, secondary],
            store,
            toolset,
            Some(Arc::new(publisher)),
            Some(identity),
            goal.clone(),
            8,
        );
        let outcome = coordinator
            .run(CancellationToken::new())
            .await
            .expect("run succeeds");
        assert_eq!(outcome, RunOutcome::EndTurn);

        let rows = coordinator.store.rows().to_vec();
        // turn1 assistant + tool result + freeze partial + orphan notice +
        // handoff + final assistant = 6 rows.
        assert_eq!(rows.len(), 6, "rows: {rows:?}");
        assert_eq!(rows[0].msg.role, "assistant");
        assert_eq!(
            rows[0].meta.get("backend").and_then(|v| v.as_str()),
            Some("mock-primary")
        );
        assert!(rows[1].msg.content.contains("sha256(a.txt) = "));
        assert_eq!(rows[1].msg.role, "tool");
        assert_eq!(
            rows[2].meta.get("truncated"),
            Some(&Value::Bool(true)),
            "FREEZE keeps partial marked"
        );
        assert!(rows[2].msg.content.contains("partial thinking"));
        assert_eq!(rows[3].meta.get("orphaned"), Some(&Value::Bool(true)));
        assert!(rows[3].msg.content.contains("NOT run"));
        assert!(rows[4]
            .msg
            .content
            .contains("mock-primary -> mock-secondary"));
        assert_eq!(
            rows[4].meta.get("injected").and_then(|v| v.as_str()),
            Some("handoff")
        );
        assert_eq!(rows[5].msg.content, "final answer");

        // Pre/post checkpoints on disk with distinct digests.
        let checkpoints = coordinator.store.read_checkpoints();
        assert_eq!(checkpoints.len(), 2);
        assert_eq!(checkpoints[0]["phase"], Value::String("pre-switch".into()));
        assert_eq!(checkpoints[1]["phase"], Value::String("post-switch".into()));
        assert_ne!(
            checkpoints[0]["transcript_sha256"],
            checkpoints[1]["transcript_sha256"]
        );
        assert!(checkpoints[0].get("bsigner_envelope").is_some());

        // §2.5 continuity: the pre-switch messages are a byte-exact prefix
        // of the final transcript, same goal.
        let final_msgs = coordinator.store.messages();
        let pre_count = checkpoints[0]["turn_count"].as_u64().expect("turn_count") as usize;
        let report =
            verify_transcript_continuity(&final_msgs[..pre_count], &final_msgs, &goal, &goal);
        assert!(report.ok, "continuity must hold: {report:?}");
        assert_eq!(
            report.pre_sha256,
            checkpoints[0]["transcript_sha256"].as_str().unwrap()
        );

        // Orphan policy (smoke T3): exactly one t9 row — the notice, with
        // no fabricated result — and the run ends on the secondary backend.
        let t9: Vec<_> = rows
            .iter()
            .filter(|row| row.msg.tool_call_id.as_deref() == Some("t9"))
            .collect();
        assert_eq!(t9.len(), 1);
        assert!(!t9[0].msg.content.contains("sha256("));
        assert_eq!(
            rows.last().map(|row| row.msg.role.as_str()),
            Some("assistant")
        );
        assert_eq!(
            rows.last()
                .and_then(|row| row.meta.get("backend"))
                .and_then(|value| value.as_str()),
            Some("mock-secondary")
        );
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn bus_carries_checkpoint_and_status_events() {
        let root = temp_root("bus");
        let sandbox = root.join("sandbox");
        let toolset = Toolset::new(&sandbox).expect("sandbox");
        let keys = root.join("keys");
        std::fs::create_dir_all(&keys).expect("keys dir");
        let identity = IdentityHook::genesis(&keys, IdentityHook::test_vault()).expect("genesis");
        let goal = serde_json::json!({"objective": "fetch", "task_id": "T-7"});

        let bus = EventBus::new(128);
        let mut rx = bus.subscribe();
        let publisher = Arc::new(BusPublisher::new(bus, identity.did()));
        let primary = Arc::new(StubBackend {
            name: "mock-primary".into(),
            model: "spark-primary".into(),
            script: Mutex::new(VecDeque::from([
                scripted_turn("listing\n```tool\n{\"id\": \"t1\", \"name\": \"list_files\"}\n```"),
                StubStep::Fail(BackendError::Unavailable {
                    reason: FailoverReason::Transport,
                    detail: "refused".into(),
                    partial: String::new(),
                }),
            ])),
            health_script: Mutex::new(VecDeque::new()),
        });
        let secondary = Arc::new(StubBackend {
            name: "mock-secondary".into(),
            model: "spark-tertiary".into(),
            script: Mutex::new(VecDeque::from([scripted_turn("done")])),
            health_script: Mutex::new(VecDeque::new()),
        });
        let store = SessionStore::new(&root, "sess-bus").expect("store");
        let mut coordinator = SwitchCoordinator::new(
            vec![primary, secondary],
            store,
            toolset,
            Some(publisher),
            Some(identity),
            goal,
            8,
        );
        let outcome = coordinator
            .run(CancellationToken::new())
            .await
            .expect("run succeeds");
        assert_eq!(outcome, RunOutcome::EndTurn);

        let mut checkpoints = 0u32;
        let mut statuses = 0u32;
        while let Ok(event) = rx.try_recv() {
            match event.event_type {
                EventType::AgentCheckpoint => checkpoints += 1,
                EventType::AgentStatus => statuses += 1,
                _ => {}
            }
        }
        assert!(checkpoints >= 2, "pre+post checkpoints must ride the bus");
        assert!(
            statuses >= 3,
            "thinking/responded/failed-over must ride the bus"
        );
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn fatal_on_last_backend_aborts() {
        let root = temp_root("fatal");
        let toolset = Toolset::new(&root.join("sandbox")).expect("sandbox");
        let store = SessionStore::new(&root, "sess-fatal").expect("store");
        let goal = serde_json::json!({"objective": "x"});
        let fatal = || {
            StubBackend::failing(
                "dead",
                BackendError::Fatal {
                    reason: "auth: HTTP 401".into(),
                },
            )
        };
        let mut coordinator =
            SwitchCoordinator::new(vec![fatal(), fatal()], store, toolset, None, None, goal, 4);
        let error = coordinator
            .run(CancellationToken::new())
            .await
            .expect_err("fatal aborts the run");
        assert!(matches!(
            error,
            CoordError::Backend(BackendError::Fatal { .. })
        ));
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn store_persists_goal_and_checkpoints() {
        let root = temp_root("store");
        let mut store = SessionStore::new(&root, "sess-store").expect("store");
        store
            .save_goal(&serde_json::json!({"objective": "persist me"}))
            .expect("save goal");
        assert_eq!(
            store.load_goal(),
            Some(serde_json::json!({"objective": "persist me"}))
        );
        store
            .append(ChatMessage::user("hi"), BTreeMap::new())
            .expect("append");
        store
            .append_checkpoint(&serde_json::json!({"phase": "pre-switch"}))
            .expect("checkpoint");
        assert!(root.join("sessions/sess-store.jsonl").exists());
        assert!(root.join("sessions/sess-store.goal.json").exists());
        assert!(root.join("sessions/sess-store.checkpoints.jsonl").exists());
        assert_eq!(store.read_checkpoints().len(), 1);
        std::fs::remove_dir_all(&root).ok();
    }
}
