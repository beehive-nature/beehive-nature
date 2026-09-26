//! SESSION REPLAY TO DISK — the anchor's durable record of what it did.
//!
//! Every bSEAT session writes a JSONL replay: one event per line, append
//! only, ordered. The replay IS the receipt (Milestone 1's acceptance is
//! "save the replay"), so it records the load-bearing facts: which system
//! Chromium binary ran, every navigation, every snapshot with its token
//! counts and integrity digest, every click with the element ref and the
//! page-supplied name (marked untrusted — see [`un`]).
//!
//! Digests inside replays are base64url with algorithm ids, never hex runs
//! (beehive pre-commit hex law). Times are ISO-8601 UTC plus epoch millis.
//!
//! # G2-A — recording failure is a first-class fact (fail-closed law)
//!
//! A receipt the writer could not store is NOT a receipt. [`Replay::ev`]
//! acknowledges an event only after the complete bounded record is encoded,
//! written, flushed, and storage-synchronized ([`ReceiptSink::sync`]).
//! Every refusal returns a typed [`ReceiptError`], and any write/flush/sync
//! failure POISONS the writer: a stream that may end mid-record must never
//! be quietly extended or acknowledged again. The only explicit recovery is
//! a fresh [`Replay::open`] (a new timestamped file) — there is deliberately
//! no in-place resume past a torn tail; tolerating one is the G2-B reader's
//! job, not this writer's.
//!
//! # Durability honesty
//!
//! `sync` maps to `File::sync_all` (fsync on Unix, FlushFileBuffers on
//! Windows): a request for storage synchronization the kernel/driver is
//! expected to honor, NOT a proof against power loss. At creation,
//! `Replay::open` fsyncs the PARENT DIRECTORY on Unix so the new
//! directory entry itself reaches storage (fail-closed: a refused dir
//! sync fails the open); the directory's own creation is not recursively
//! synced. Windows has no public equivalent for a directory fsync, so
//! file-creation/metadata durability there is UNPROVEN, not claimed. No
//! power-loss testing has been done. Process death between boundaries is
//! likewise not emulated by tests: a killed process does not emulate
//! storage loss (they are distinct failures; neither proves the other),
//! and what survives is reader-side (G2-B); the writer-side boundaries
//! are covered deterministically via the injected [`fault`] battery.

use std::fs::{self, File, OpenOptions};
use std::io::Write as IoWrite;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};

/// Admission bound for one record, checked BEFORE any storage is touched.
/// Derived from the existing receipt shapes: the largest event is a
/// `snapshot`, which embeds the formatted accessibility tree capped at
/// `axtree::DEFAULT_MAX_NODES` (1200) entries — measured shape is low
/// hundreds of KiB per line; 4 MiB admits every existing shape with an
/// order of magnitude of slack while keeping one event from exhausting
/// storage on its own. A free-space observation is advisory only; the
/// authoritative storage verdict is always the real write/sync result.
pub const MAX_RECORD_BYTES: usize = 4 * 1024 * 1024;

/// Mark a value as UNTRUSTED (page-supplied) in the replay record.
/// Structural, not cosmetic: downstream consumers of replays must treat
/// every `{"__untrusted":true,...}` value as data, never instructions.
pub fn un(v: &str) -> Value {
    json!({ "__untrusted": true, "v": v })
}

/// The storage seam behind [`Replay`]. Production uses [`File`]; tests
/// inject deterministic boundary faults through [`Replay::attach`]. `sync`
/// is the acknowledgment boundary's last step — see the durability note.
pub trait ReceiptSink: Send {
    fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()>;
    fn flush(&mut self) -> std::io::Result<()>;
    fn sync(&mut self) -> std::io::Result<()>;
}

impl ReceiptSink for File {
    fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()> {
        IoWrite::write_all(self, buf)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        IoWrite::flush(self)
    }
    fn sync(&mut self) -> std::io::Result<()> {
        File::sync_all(self)
    }
}

/// Every way a receipt can fail to be recorded. Typed so callers stop for
/// the right reason — storage exhaustion is an operator stop, a poisoned
/// writer is a damaged stream, and neither is ever "ok".
#[derive(Debug, thiserror::Error)]
pub enum ReceiptError {
    /// The OS refused the write or flush (permission, handle, I/O).
    #[error("receipt write failed for event {ev:?}: {source}")]
    WriteFailed { ev: String, source: std::io::Error },
    /// Storage is exhausted or unavailable — a specific stop reason, never
    /// a generic retry suggestion.
    #[error("storage exhausted/unavailable while recording {ev:?}: {source} — stop and free capacity; do not retry into silence")]
    StorageUnavailable { ev: String, source: std::io::Error },
    /// Write and flush completed but storage synchronization refused. The
    /// bytes may be in flight; the record is NOT acknowledged.
    #[error("receipt storage sync failed for event {ev:?}: {source}")]
    SyncFailed { ev: String, source: std::io::Error },
    /// Appended after [`Replay::close`]. Not poison — but never "ok".
    #[error("receipt refused: writer already closed (event {ev:?})")]
    Closed { ev: String },
    /// An earlier append failed; this stream may end mid-record. No
    /// further appends until an explicit recovery (a fresh `Replay::open`).
    #[error("receipt writer POISONED since event {since:?} — a damaged stream is never quietly extended; open a new replay to recover")]
    Poisoned { since: String },
    /// Record exceeded [`MAX_RECORD_BYTES`] before any storage admission.
    /// The stream is undamaged; this event is refused as unrecordable.
    #[error("receipt refused: event {ev:?} encodes to {bytes} bytes, over the {limit}-byte admission bound")]
    RecordTooLarge {
        ev: String,
        bytes: usize,
        limit: usize,
    },
}

fn classify_write_error(ev: &str, source: std::io::Error) -> ReceiptError {
    use std::io::ErrorKind;
    match source.kind() {
        ErrorKind::StorageFull | ErrorKind::WriteZero => ReceiptError::StorageUnavailable {
            ev: ev.to_string(),
            source,
        },
        _ => ReceiptError::WriteFailed {
            ev: ev.to_string(),
            source,
        },
    }
}

pub struct Replay {
    pub path: PathBuf,
    sink: Option<Box<dyn ReceiptSink>>,
    /// `Some(ev)` = an append failed at/after storage — poisoned until an
    /// explicit recovery (fresh open). See the module's fail-closed law.
    poisoned_since: Option<String>,
}

impl Replay {
    /// Create `<dir>/<stem>-<yyyymmdd-hhmmss>.jsonl`. Creates the dir.
    /// (Stamp is colon-free: Windows filenames.)
    ///
    /// A fresh open NEVER appends to an existing stream: the file is
    /// created exclusively (`create_new`), and a name collision (same stem
    /// in the same second, or a concurrent same-stem session) bumps a
    /// `-N` suffix until an unused name wins the exclusive race. A
    /// replacement session therefore cannot extend the torn tail of the
    /// damaged file it replaces — that file stays untouched on disk.
    pub fn open(dir: &Path, stem: &str) -> std::io::Result<Replay> {
        fs::create_dir_all(dir)?;
        let (iso, _) = now_iso();
        let stamp = iso
            .split_once('T')
            .map(|(d, t)| format!("{}-{}", d.replace('-', ""), &t[..8].replace(':', "")))
            .unwrap_or_else(|| iso.replace(['-', ':', 'T'], ""));
        let (path, file) = Self::create_exclusive(dir, stem, &stamp)?;
        // Creation/metadata durability per OS: on Unix, fsync the parent
        // directory so the new directory entry itself reaches storage
        // (fail-closed: a refused dir sync fails the open). Scope note:
        // the directory's OWN creation by create_dir_all above is not
        // recursively synced. Windows has no public equivalent — the
        // durability docs state it as unproven there.
        #[cfg(unix)]
        {
            let dir_file = File::open(dir)?;
            dir_file.sync_all()?;
        }
        Ok(Replay::attach(path, Box::new(file)))
    }

    /// Exclusive-create loop: `<stem>-<stamp>.jsonl`, then `-1`, `-2`, …
    /// until an unused name wins. Exactly one racer holds each file.
    fn create_exclusive(dir: &Path, stem: &str, stamp: &str) -> std::io::Result<(PathBuf, File)> {
        let base = dir.join(format!("{stem}-{stamp}"));
        let mut first_try = true;
        for n in 0..=999u32 {
            let path = if first_try {
                first_try = false;
                base.with_extension("jsonl")
            } else {
                base.with_file_name(format!(
                    "{}-{}.jsonl",
                    base.file_name().unwrap_or_default().to_string_lossy(),
                    n
                ))
            };
            match OpenOptions::new().create_new(true).append(true).open(&path) {
                Ok(file) => return Ok((path, file)),
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(e) => return Err(e),
            }
        }
        Err(std::io::Error::other(
            "replay open: 1000 same-second name collisions without a free name",
        ))
    }

    /// Build a replay over an injected sink. Instrumentation seam for the
    /// fault battery (and later G2-B reader proofs) — production goes
    /// through [`Replay::open`].
    #[doc(hidden)]
    pub fn attach(path: PathBuf, sink: Box<dyn ReceiptSink>) -> Replay {
        Replay {
            path,
            sink: Some(sink),
            poisoned_since: None,
        }
    }

    /// True once an append has failed — no appends will be acknowledged
    /// until an explicit recovery (a fresh `Replay::open`).
    pub fn is_poisoned(&self) -> bool {
        self.poisoned_since.is_some()
    }

    /// Append one event. Acknowledged only after the COMPLETE bounded
    /// record is encoded, written, flushed, and storage-synced — a crash
    /// before acknowledgment leaves at most an unacknowledged (possibly
    /// torn) tail, never a false "recorded".
    pub fn ev(&mut self, ev: &str, fields: Value) -> Result<(), ReceiptError> {
        if let Some(since) = &self.poisoned_since {
            return Err(ReceiptError::Poisoned {
                since: since.clone(),
            });
        }
        let Some(sink) = self.sink.as_mut() else {
            return Err(ReceiptError::Closed { ev: ev.to_string() });
        };
        // Encode the complete record FIRST (one JSONL line, envelope
        // unchanged), then admit it by size before touching storage.
        let (iso, ms) = now_iso();
        let mut line = json!({ "t": iso, "t_ms": ms, "ev": ev });
        if let (Some(obj), Some(extra)) = (line.as_object_mut(), fields.as_object()) {
            for (k, v) in extra {
                obj.insert(k.clone(), v.clone());
            }
        }
        let bytes = format!("{line}\n").into_bytes();
        if bytes.len() > MAX_RECORD_BYTES {
            return Err(ReceiptError::RecordTooLarge {
                ev: ev.to_string(),
                bytes: bytes.len(),
                limit: MAX_RECORD_BYTES,
            });
        }
        // The acknowledgment boundary. Any refusal poisons: write_all may
        // have stored a prefix, so the stream may end mid-record.
        if let Err(source) = sink.write_all(&bytes) {
            let classified = classify_write_error(ev, source);
            self.poisoned_since = Some(ev.to_string());
            return Err(classified);
        }
        if let Err(source) = sink.flush() {
            let classified = classify_write_error(ev, source);
            self.poisoned_since = Some(ev.to_string());
            return Err(classified);
        }
        if let Err(source) = sink.sync() {
            self.poisoned_since = Some(ev.to_string());
            return Err(ReceiptError::SyncFailed {
                ev: ev.to_string(),
                source,
            });
        }
        Ok(())
    }

    /// Finalize (keeps the file on disk; drops the handle). Later appends
    /// fail [`ReceiptError::Closed`] — never silently dropped.
    pub fn close(&mut self) {
        self.sink = None;
    }
}

/// (ISO-8601 UTC "YYYY-MM-DDTHH:MM:SSZ", epoch millis).
/// Civil-from-days per Howard Hinnant's algorithm — no chrono dependency.
pub fn now_iso() -> (String, u128) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs() as i64;
    let millis = now.as_millis();
    let days = secs.div_euclid(86_400);
    let sod = secs.rem_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    (
        format!(
            "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
            sod / 3600,
            (sod % 3600) / 60,
            sod % 60
        ),
        millis,
    )
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Deterministic fault injection for the receipt battery (and G2-B reader
/// proofs later): refuses at an exact boundary of the acknowledgment path.
/// [`Fault::None`] is the clean control every fault test runs beside.
#[cfg(test)]
#[doc(hidden)]
pub mod fault {
    use super::ReceiptSink;
    use std::io;
    use std::sync::{Arc, Mutex};

    /// Where the injected refusal lands — one position per boundary of the
    /// encode → write → flush → sync → ack path.
    #[derive(Clone, Copy, Debug, PartialEq)]
    pub enum Fault {
        /// Never refuses — the positive control.
        None,
        /// write_all stores a prefix, then refuses — a torn tail.
        PartialWrite(usize),
        /// write_all refuses outright, storing nothing.
        RefuseWrite,
        /// write_all succeeds; flush refuses.
        RefuseFlush,
        /// write and flush succeed; sync refuses.
        RefuseSync,
        /// The storage-exhaustion shape: ErrorKind::StorageFull on write.
        StorageFull,
    }

    pub struct FaultSink {
        pub fault: Fault,
        pub stored: Vec<u8>,
    }

    impl FaultSink {
        pub fn new(fault: Fault) -> Self {
            FaultSink {
                fault,
                stored: Vec::new(),
            }
        }
    }

    impl ReceiptSink for FaultSink {
        fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
            match self.fault {
                Fault::None => {
                    self.stored.extend_from_slice(buf);
                    Ok(())
                }
                Fault::PartialWrite(n) => {
                    let n = n.min(buf.len());
                    self.stored.extend_from_slice(&buf[..n]);
                    Err(io::Error::other("injected: prefix stored, then refused"))
                }
                Fault::RefuseWrite => Err(io::Error::other("injected: write refused")),
                Fault::StorageFull => Err(io::Error::from(io::ErrorKind::StorageFull)),
                Fault::RefuseFlush | Fault::RefuseSync => {
                    self.stored.extend_from_slice(buf);
                    Ok(())
                }
            }
        }
        fn flush(&mut self) -> io::Result<()> {
            match self.fault {
                Fault::RefuseFlush => Err(io::Error::other("injected: flush refused")),
                _ => Ok(()),
            }
        }
        fn sync(&mut self) -> io::Result<()> {
            match self.fault {
                Fault::RefuseSync => Err(io::Error::other("injected: sync refused")),
                _ => Ok(()),
            }
        }
    }

    /// Shared handle over a [`FaultSink`] so a test can inspect what was
    /// stored after the sink is boxed into a [`super::Replay`].
    #[derive(Clone)]
    pub struct SharedFaultSink(pub Arc<Mutex<FaultSink>>);

    impl SharedFaultSink {
        pub fn new(fault: Fault) -> Self {
            SharedFaultSink(Arc::new(Mutex::new(FaultSink::new(fault))))
        }
    }

    impl ReceiptSink for SharedFaultSink {
        fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
            self.0.lock().unwrap().write_all(buf)
        }
        fn flush(&mut self) -> io::Result<()> {
            self.0.lock().unwrap().flush()
        }
        fn sync(&mut self) -> std::io::Result<()> {
            self.0.lock().unwrap().sync()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::fault::{Fault, FaultSink, SharedFaultSink};
    use super::*;

    fn tmp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("banchor-g2a-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    // ---- positive controls (a fault battery is only meaningful beside
    // proof that the same harness records normally) ------------------------

    #[test]
    fn replay_writes_events() {
        let dir = tmp_dir("writable");
        let mut r = Replay::open(&dir, "unit").unwrap();
        r.ev("session_start", json!({"chrome": "test"})).unwrap();
        r.ev(
            "click",
            json!({"ref": "@e1", "name": un("More information...")}),
        )
        .unwrap();
        r.close();
        let text = fs::read_to_string(&r.path).unwrap();
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 2);
        assert!(text.contains("\"ev\":\"session_start\""));
        assert!(text.contains("\"__untrusted\":true"));
        assert!(text.contains("\"t\":\"20"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn injected_sink_success_positive_control() {
        let mut r = Replay::attach(
            PathBuf::from("unused"),
            Box::new(FaultSink::new(Fault::None)),
        );
        r.ev("probe", json!({"n": 1})).unwrap();
        assert!(!r.is_poisoned());
        // envelope preserved: one JSONL line with t/t_ms/ev keys
        let sink = FaultSink::new(Fault::None);
        let _ = sink;
        let shared = SharedFaultSink::new(Fault::None);
        let mut r2 = Replay::attach(PathBuf::from("unused"), Box::new(shared.clone()));
        r2.ev("probe", json!({"n": 1})).unwrap();
        let stored = String::from_utf8(shared.0.lock().unwrap().stored.clone()).unwrap();
        let line: Value = serde_json::from_str(stored.trim_end()).unwrap();
        assert_eq!(line["ev"], "probe");
        assert!(line.get("t").is_some() && line.get("t_ms").is_some());
    }

    // ---- fault battery: each refusal is typed, poisons where damage is
    // possible, and never acknowledges ------------------------------------

    #[test]
    fn refused_write_is_typed_failure_and_poisons() {
        let mut r = Replay::attach(
            PathBuf::from("unused"),
            Box::new(FaultSink::new(Fault::RefuseWrite)),
        );
        match r.ev("probe", json!({"n": 1})) {
            Err(ReceiptError::WriteFailed { ev, .. }) => assert_eq!(ev, "probe"),
            other => panic!("expected WriteFailed, got {other:?}"),
        }
        assert!(r.is_poisoned());
        // failure followed by another append: refused as Poisoned — the
        // damaged stream is never quietly extended.
        match r.ev("next", json!({})) {
            Err(ReceiptError::Poisoned { since }) => assert_eq!(since, "probe"),
            other => panic!("expected Poisoned, got {other:?}"),
        }
    }

    #[test]
    fn partial_write_stores_a_torn_prefix_then_poisons() {
        let shared = SharedFaultSink::new(Fault::PartialWrite(10));
        let mut r = Replay::attach(PathBuf::from("unused"), Box::new(shared.clone()));
        match r.ev("probe", json!({"n": 1})) {
            Err(ReceiptError::WriteFailed { .. }) => {}
            other => panic!("expected WriteFailed, got {other:?}"),
        }
        assert!(r.is_poisoned());
        // the torn prefix IS on the sink: visible, unacknowledged, and this
        // writer never extends it (reader tolerance is G2-B's contract)
        let stored = shared.0.lock().unwrap().stored.clone();
        assert_eq!(stored.len(), 10);
        assert!(stored.len() > 0 && stored.last() != Some(&b'\n'));
        // and the next append is refused as poison, adding no bytes
        let _ = r.ev("next", json!({}));
        assert_eq!(shared.0.lock().unwrap().stored.len(), 10);
    }

    #[test]
    fn flush_failure_is_typed_and_poisons() {
        let mut r = Replay::attach(
            PathBuf::from("unused"),
            Box::new(FaultSink::new(Fault::RefuseFlush)),
        );
        match r.ev("probe", json!({})) {
            // flush refusal classifies as a write-path failure
            Err(ReceiptError::WriteFailed { .. }) => {}
            other => panic!("expected write-class failure from flush refusal, got {other:?}"),
        }
        assert!(r.is_poisoned());
    }

    #[test]
    fn sync_failure_is_typed_and_poisons() {
        let mut r = Replay::attach(
            PathBuf::from("unused"),
            Box::new(FaultSink::new(Fault::RefuseSync)),
        );
        match r.ev("probe", json!({})) {
            Err(ReceiptError::SyncFailed { .. }) => {}
            other => panic!("expected SyncFailed, got {other:?}"),
        }
        assert!(r.is_poisoned());
        match r.ev("next", json!({})) {
            Err(ReceiptError::Poisoned { .. }) => {}
            other => panic!("expected Poisoned after sync failure, got {other:?}"),
        }
    }

    #[test]
    fn storage_exhaustion_is_a_distinct_stop_reason() {
        let mut r = Replay::attach(
            PathBuf::from("unused"),
            Box::new(FaultSink::new(Fault::StorageFull)),
        );
        match r.ev("probe", json!({})) {
            Err(ReceiptError::StorageUnavailable { .. }) => {}
            other => panic!("expected StorageUnavailable, got {other:?}"),
        }
        assert!(r.is_poisoned());
    }

    #[test]
    fn closed_writer_refuses_instead_of_dropping() {
        let dir = tmp_dir("closed");
        let mut r = Replay::open(&dir, "closed").unwrap();
        r.close();
        match r.ev("late", json!({})) {
            Err(ReceiptError::Closed { ev }) => assert_eq!(ev, "late"),
            other => panic!("expected Closed, got {other:?}"),
        }
        assert!(!r.is_poisoned()); // closed is not damage
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Review P1-1: a fresh open must NEVER extend an existing stream —
    /// same-stem reopen in the same second (or a concurrent racer) gets a
    /// NEW exclusively-created file, and the old (possibly torn) file's
    /// bytes stay untouched. Reproduces the reviewer's probe shape: a
    /// 10-byte torn tail + a fresh open + an acknowledged append.
    #[test]
    fn fresh_open_never_extends_an_existing_stream() {
        let dir = tmp_dir("reopen");
        let mut first = Replay::open(&dir, "reopen").unwrap();
        let first_path = first.path.clone();
        first.ev("probe", json!({ "n": 1 })).unwrap();
        first.close();
        // tear the stream the way a partial write would leave it
        let torn = b"0123456789"; // exactly the reviewer's 10 bytes
        fs::write(&first_path, torn).unwrap();
        // replacement session, same stem, immediately (same second or not:
        // either the stamp repeats and the suffix bump avoids it, or the
        // stamp differs — both must leave the torn file untouched)
        let mut second = Replay::open(&dir, "reopen").unwrap();
        assert_ne!(
            second.path, first_path,
            "a fresh session must never reuse the existing stream"
        );
        second.ev("probe", json!({ "n": 2 })).unwrap();
        assert_eq!(
            fs::read(&first_path).unwrap(),
            torn.to_vec(),
            "the damaged file must be left byte-identical"
        );
        assert!(fs::read_to_string(&second.path)
            .unwrap()
            .contains("\"ev\":\"probe\""));
        // and the collision bump is bounded and honest under many racers
        let mut paths = std::collections::HashSet::new();
        for _ in 0..5 {
            paths.insert(Replay::open(&dir, "reopen").unwrap().path);
        }
        assert!(!paths.contains(&first_path));
        assert_eq!(paths.len(), 5, "every same-stem session owns its own file");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Review P2: on Unix the parent directory is fsynced at creation
    /// (fail-closed — a refusal fails the open). Smoke-level: a successful
    /// open on a fresh directory implies the dir-sync step succeeded.
    #[cfg(unix)]
    #[test]
    fn open_on_unix_syncs_the_parent_directory() {
        let dir = tmp_dir("dirsync");
        let mut r = Replay::open(&dir, "dirsync").unwrap();
        r.ev("probe", json!({})).unwrap();
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn oversized_record_refused_before_storage_and_stream_stays_usable() {
        let dir = tmp_dir("toobig");
        let path = dir.join("bound.jsonl");
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .unwrap();
        let mut r = Replay::attach(path.clone(), Box::new(file));
        let huge = "x".repeat(MAX_RECORD_BYTES);
        match r.ev("snapshot", json!({ "blob": huge })) {
            Err(ReceiptError::RecordTooLarge { bytes, limit, .. }) => {
                assert_eq!(limit, MAX_RECORD_BYTES);
                assert!(bytes > limit);
            }
            other => panic!("expected RecordTooLarge, got {other:?}"),
        }
        assert!(!r.is_poisoned()); // admission refusal leaves the stream undamaged
        assert_eq!(fs::read(&path).unwrap().len(), 0); // nothing touched storage
                                                       // positive control beside the fault: normal events still record
        r.ev("small", json!({ "ok": true })).unwrap();
        assert!(fs::read_to_string(&path)
            .unwrap()
            .contains("\"ev\":\"small\""));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The REAL OS refusal (not injected): a read-only handle refuses
    /// writes; the refusal is typed; zero bytes are stored. This is the
    /// production-shaped equivalent of the G2 red baseline probe.
    #[test]
    fn read_only_handle_refusal_is_typed_with_zero_bytes_stored() {
        let dir = tmp_dir("readonly");
        let path = dir.join("refused.jsonl");
        fs::write(&path, b"").unwrap();
        // control: the OS really refuses this handle
        let mut file = File::open(&path).unwrap();
        assert!(<File as IoWrite>::write_all(&mut file, b"synthetic receipt\n").is_err());
        drop(file);
        let ro = File::open(&path).unwrap();
        let mut r = Replay::attach(path.clone(), Box::new(ro));
        match r.ev("probe", json!({"synthetic": true})) {
            Err(ReceiptError::WriteFailed { .. }) => {}
            other => panic!("expected WriteFailed from read-only handle, got {other:?}"),
        }
        assert!(r.is_poisoned());
        assert!(
            fs::read(&path).unwrap().is_empty(),
            "the refused write must have stored no receipt"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn iso_epoch_is_correct() {
        // 2026-01-01T00:00:00Z == 1767225600
        let (iso, _) = {
            let days = 1767225600i64.div_euclid(86_400);
            let sod = 1767225600i64.rem_euclid(86_400);
            let (y, m, d) = civil_from_days(days);
            (
                format!(
                    "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
                    sod / 3600,
                    (sod % 3600) / 60,
                    sod % 60
                ),
                0u128,
            )
        };
        assert_eq!(iso, "2026-01-01T00:00:00Z");
    }

    #[test]
    fn civil_known_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(19_723), (2024, 1, 1)); // 2024-01-01
        assert_eq!(civil_from_days(20_651), (2026, 7, 17)); // 2026-01-01 is day 20454; +197d
    }
}
