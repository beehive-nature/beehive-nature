//! G2-B — bounded, read-only receipt reading and explicit cursors.
//!
//! An offline reader of ONE explicitly supplied replay file. It observes
//! historical bytes; it never drives a browser, asks a model, resolves a
//! URL, or executes an event. Every record stays UNTRUSTED data.
//!
//! # The acknowledgment boundary (demonstrated, not assumed)
//!
//! The G2-A writer persists no independent acknowledgment watermark: a
//! complete JSON line can be present after a refused sync — including a
//! final `session_end` declaring no gaps — while the write call returned
//! `SyncFailed`. A reader therefore CANNOT reconstruct the caller's
//! observed `Ok` from the file alone. Everything here names its result a
//! PARSED/OBSERVED prefix; writer acknowledgment is always reported as
//! `unknown`, and receipts that left no bytes are not countable.
//!
//! # Reader laws
//!
//! * FINITE OBSERVATION: the source length H is captured at call start;
//!   only bytes below H are inspected. Later appends wait for another
//!   call. Shortening below H (or below a cursor's prior length) is a
//!   typed truncation failure. No EOF-following, discovery, polling,
//!   rotation, repair, truncation, or appending.
//! * BYTE FRAMING: a record is a valid UTF-8 JSON object ending in LF,
//!   within the writer's record bound. Offsets count original bytes
//!   including delimiters. Blank/malformed records, wrong envelope
//!   types, and duplicate top-level keys are REFUSED at their offset —
//!   never silently skipped. Never sorted by timestamp.
//! * NO FALSE TAIL: EOF-at-H mid-record is `IncompleteTail` even if the
//!   bytes parse; stopping on a budget is `LimitReached`, never EOF or a
//!   torn tail.
//! * CONTIGUOUS PROGRESS: only contiguous valid records are delivered; a
//!   fault stops at its starting offset with no scan-ahead.
//! * BUDGETS BEFORE PARSING: per-record, per-batch, prefix-validation,
//!   and cursor caps bound every allocation before work happens, with
//!   checked arithmetic and an explicit budget-too-small result.
//! * HONEST STATUS: stop reason, session evidence, and writer
//!   acknowledgment stay separate. Gaps latch permanently; anomalies are
//!   reported, never repaired; even a consistent clean declaration is
//!   not proof of writer acknowledgment.
//!
//! # Integrity limits (stated, not implied)
//!
//! Cursor validation is integrity RELATIVE TO A CALLER-SUPPLIED
//! CHECKPOINT, not authentication or freshness. Under the supported
//! append-only/stable-prefix model it detects changed consumed bytes and
//! observed shortening. A byte-identical replacement under the same
//! logical key is indistinguishable and may be accepted; changes before
//! the first checkpoint, changes to unconsumed bytes, and hostile
//! concurrent in-place writers are not fully detectable. Checkpoint
//! saves prove process independence, not power-loss durability.

use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

use serde_json::{json, Map, Value};

use crate::b64;

/// Hard admission caps (G2-B brief). Caller budgets may LOWER these.
pub const MAX_RECORD_BYTES: usize = crate::replay::MAX_RECORD_BYTES; // 4 MiB incl LF
pub const MAX_BATCH_RECORDS: usize = 256;
pub const MAX_BATCH_BYTES: usize = 8 * 1024 * 1024; // delivered record bytes per batch
pub const MAX_PREFIX_VALIDATION_BYTES: usize = 64 * 1024 * 1024;
pub const MAX_CURSOR_BYTES: usize = 4096;
pub const MAX_SOURCE_KEY_BYTES: usize = 256;
pub const MAX_JSON_DEPTH: usize = 32;
const READ_CHUNK: usize = 64 * 1024;
pub const DIGEST_ALG: &str = "sha3-256";
pub const CURSOR_VERSION: u64 = 1;

/// Caller-tunable work ceilings for one call (the hard caps above stay).
#[derive(Clone, Copy, Debug)]
pub struct Budget {
    pub max_batch_records: usize,
    pub max_batch_bytes: usize,
    pub max_prefix_validation: usize,
}

impl Default for Budget {
    fn default() -> Self {
        Budget {
            max_batch_records: MAX_BATCH_RECORDS,
            max_batch_bytes: MAX_BATCH_BYTES,
            max_prefix_validation: MAX_PREFIX_VALIDATION_BYTES,
        }
    }
}

// ---------------------------------------------------------------------------
// sources

/// One regular, seekable source opened read-only. The extent H is
/// captured per call.
pub trait ByteSource {
    fn len_at_call(&self) -> std::io::Result<u64>;
    /// Read up to `buf.len()` bytes at `off` (may return short at EOF).
    fn read_at(&mut self, off: u64, buf: &mut [u8]) -> std::io::Result<usize>;
}

pub struct FileSource {
    file: File,
}

impl FileSource {
    pub fn open(path: &Path) -> Result<FileSource, OpenError> {
        let file = OpenOptions::new()
            .read(true)
            .open(path)
            .map_err(OpenError)?;
        if !file.metadata().map_err(OpenError)?.is_file() {
            return Err(OpenError(std::io::Error::other(
                "source is not a regular file",
            )));
        }
        Ok(FileSource { file })
    }
}

impl ByteSource for FileSource {
    fn len_at_call(&self) -> std::io::Result<u64> {
        self.file.metadata().map(|m| m.len())
    }
    fn read_at(&mut self, off: u64, buf: &mut [u8]) -> std::io::Result<usize> {
        self.file.seek(SeekFrom::Start(off))?;
        let mut filled = 0;
        while filled < buf.len() {
            match self.file.read(&mut buf[filled..]) {
                Ok(0) => break,
                Ok(n) => filled += n,
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(e) => return Err(e),
            }
        }
        Ok(filled)
    }
}

/// In-memory source for the synthetic fixture battery.
#[derive(Default)]
pub struct MemSource(pub Vec<u8>);

impl ByteSource for MemSource {
    fn len_at_call(&self) -> std::io::Result<u64> {
        Ok(self.0.len() as u64)
    }
    fn read_at(&mut self, off: u64, buf: &mut [u8]) -> std::io::Result<usize> {
        let off = off as usize;
        if off >= self.0.len() {
            return Ok(0);
        }
        let n = buf.len().min(self.0.len() - off);
        buf[..n].copy_from_slice(&self.0[off..off + n]);
        Ok(n)
    }
}

/// Open error carries only the OS error kind — no paths, no excerpts.
#[derive(Debug)]
pub struct OpenError(pub std::io::Error);

impl std::fmt::Display for OpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "source open refused: {}", err_code(&self.0))
    }
}
impl std::error::Error for OpenError {}

pub fn err_code(e: &std::io::Error) -> String {
    format!("{:?}", e.kind())
}

// ---------------------------------------------------------------------------
// typed errors — codes and offsets only; never parser excerpts, raw
// records, or strings that could echo file contents or paths

#[derive(Debug, thiserror::Error)]
pub enum ReaderError {
    #[error("i/o failure ({code}) — no candidate cursor")]
    Io { code: String },
    #[error("source shortened below the captured extent — truncation; no candidate cursor")]
    TruncatedDuringRead,
    #[error("source length {len} is below the cursor's prior observed length {prior}")]
    TruncatedBelowCursor { len: u64, prior: u64 },
    #[error("cursor refused: {reason}")]
    CursorRefused { reason: CursorRefusal },
    #[error("prefix record refused at offset {at} ({fault}) — cursor does not match a valid consumed prefix")]
    PrefixRecordFault { at: u64, fault: FramingFault },
}

#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum CursorRefusal {
    #[error("unsupported version {0}")]
    Version(u64),
    #[error("malformed/partial cursor file")]
    Malformed,
    #[error("cursor over the {MAX_CURSOR_BYTES}-byte bound")]
    TooLarge,
    #[error("source key mismatch or over the {MAX_SOURCE_KEY_BYTES}-byte bound")]
    SourceKey,
    #[error("offset {0} is out of range or not on a record boundary")]
    Offset(u64),
    #[error("prefix of {0} bytes exceeds the validation budget — resume refused (scalable indexing is not claimed)")]
    PrefixTooLarge(u64),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum FramingFault {
    #[error("record is not valid UTF-8")]
    NotUtf8,
    #[error("record is not a JSON object")]
    NotJsonObject,
    #[error("record is not well-formed JSON")]
    MalformedJson,
    #[error("envelope missing t/t_ms/ev")]
    EnvelopeMissing,
    #[error("envelope field has the wrong type")]
    EnvelopeType,
    #[error("duplicate top-level key")]
    DuplicateTopKey,
    #[error("JSON nesting over the limit")]
    NestingTooDeep,
    #[error("record exceeds the byte bound")]
    OversizedRecord,
    #[error("blank line")]
    BlankLine,
}

#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum CursorSaveError {
    #[error("checkpoint exists — saves never overwrite")]
    Collision,
    #[error("checkpoint parent directory missing")]
    ParentMissing,
    #[error("serialized cursor over the {MAX_CURSOR_BYTES}-byte bound")]
    TooLarge,
    #[error("write/sync refused ({code}) — previous checkpoint (if any) unchanged")]
    WriteFailed { code: String },
}

// ---------------------------------------------------------------------------
// strict top-level object scan: duplicate keys + nesting depth, bounded

#[derive(Debug, PartialEq)]
enum ScanFault {
    Malformed,
    Dup,
    Depth,
}

/// Scan ONE top-level JSON object for duplicate keys and excessive
/// nesting, and confirm the input is exactly that object. Bounded by
/// input length; the duplicate check is O(n²) over a key list bounded by
/// the record cap. Reused for records and cursor files.
fn scan_top_object(bytes: &[u8]) -> Result<u32, ScanFault> {
    let mut p = 0usize;
    skip_ws(bytes, &mut p);
    if p >= bytes.len() || bytes[p] != b'{' {
        return Err(ScanFault::Malformed);
    }
    p += 1;
    let mut keys: Vec<(usize, usize)> = Vec::new();
    let mut max_depth = 1u32;
    loop {
        skip_ws(bytes, &mut p);
        if p < bytes.len() && bytes[p] == b'}' {
            p += 1;
            break;
        }
        let (ks, ke) = parse_string_span(bytes, &mut p)?;
        keys.push((ks, ke));
        skip_ws(bytes, &mut p);
        if p >= bytes.len() || bytes[p] != b':' {
            return Err(ScanFault::Malformed);
        }
        p += 1;
        skip_ws(bytes, &mut p);
        max_depth = max_depth.max(skip_value(bytes, &mut p, 1)?);
        skip_ws(bytes, &mut p);
        if p < bytes.len() && bytes[p] == b',' {
            p += 1;
            continue;
        }
        if p < bytes.len() && bytes[p] == b'}' {
            p += 1;
            break;
        }
        return Err(ScanFault::Malformed);
    }
    skip_ws(bytes, &mut p);
    if p != bytes.len() {
        return Err(ScanFault::Malformed);
    }
    for i in 0..keys.len() {
        for j in i + 1..keys.len() {
            if bytes[keys[i].0..keys[i].1] == bytes[keys[j].0..keys[j].1] {
                return Err(ScanFault::Dup);
            }
        }
    }
    Ok(max_depth)
}

fn skip_ws(b: &[u8], p: &mut usize) {
    while *p < b.len() && matches!(b[*p], b' ' | b'\t' | b'\r' | b'\n') {
        *p += 1;
    }
}

/// Parse a JSON string at `*p`, returning its span (excluding quotes).
fn parse_string_span(b: &[u8], p: &mut usize) -> Result<(usize, usize), ScanFault> {
    if *p >= b.len() || b[*p] != b'"' {
        return Err(ScanFault::Malformed);
    }
    *p += 1;
    let start = *p;
    while *p < b.len() {
        match b[*p] {
            b'\\' => {
                *p += 2;
            }
            b'"' => {
                let end = *p;
                *p += 1;
                return Ok((start, end));
            }
            _ => *p += 1,
        }
    }
    Err(ScanFault::Malformed)
}

fn skip_value(b: &[u8], p: &mut usize, depth: u32) -> Result<u32, ScanFault> {
    if depth > MAX_JSON_DEPTH as u32 {
        return Err(ScanFault::Depth);
    }
    if *p >= b.len() {
        return Err(ScanFault::Malformed);
    }
    let mut max_depth = depth;
    match b[*p] {
        b'"' => {
            parse_string_span(b, p)?;
        }
        b'{' => {
            *p += 1;
            loop {
                skip_ws(b, p);
                if *p < b.len() && b[*p] == b'}' {
                    *p += 1;
                    break;
                }
                parse_string_span(b, p)?;
                skip_ws(b, p);
                if *p >= b.len() || b[*p] != b':' {
                    return Err(ScanFault::Malformed);
                }
                *p += 1;
                skip_ws(b, p);
                max_depth = max_depth.max(skip_value(b, p, depth + 1)?);
                skip_ws(b, p);
                match b.get(*p) {
                    Some(b',') => *p += 1,
                    Some(b'}') => {
                        *p += 1;
                        break;
                    }
                    _ => return Err(ScanFault::Malformed),
                }
            }
        }
        b'[' => {
            *p += 1;
            loop {
                skip_ws(b, p);
                if *p < b.len() && b[*p] == b']' {
                    *p += 1;
                    break;
                }
                max_depth = max_depth.max(skip_value(b, p, depth + 1)?);
                skip_ws(b, p);
                match b.get(*p) {
                    Some(b',') => *p += 1,
                    Some(b']') => {
                        *p += 1;
                        break;
                    }
                    _ => return Err(ScanFault::Malformed),
                }
            }
        }
        b't' | b'f' | b'n' => {
            while *p < b.len() && b[*p].is_ascii_alphabetic() {
                *p += 1;
            }
        }
        c if c == b'-' || c.is_ascii_digit() => {
            while *p < b.len() && matches!(b[*p], b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9') {
                *p += 1;
            }
        }
        _ => return Err(ScanFault::Malformed),
    }
    Ok(max_depth)
}

// ---------------------------------------------------------------------------
// session evidence

#[derive(Clone, Debug, PartialEq)]
struct EndFlags {
    ok: Option<bool>,
    halted: Option<bool>,
    gaps: Option<bool>,
}

/// Semantic state accumulated over an observed prefix — recomputed on
/// every resume, never cached in cursor JSON (the cursor carries none by
/// construction). A latched gap cannot be cleared by later records.
#[derive(Clone, Debug, Default)]
pub struct SessionState {
    pub start_seen: bool,
    pub end_markers: u64,
    first_end_flags: Option<EndFlags>,
    flags_conflict: bool,
    pub gap_observed: bool,
    pub post_end_records: bool,
}

impl SessionState {
    fn observe(&mut self, ev: &str, fields: &Map<String, Value>) {
        if self.end_markers > 0 {
            self.post_end_records = true;
        }
        match ev {
            "session_start" => self.start_seen = true,
            "session_end" => {
                let flags = EndFlags {
                    ok: fields.get("ok").and_then(Value::as_bool),
                    halted: fields.get("halted").and_then(Value::as_bool),
                    gaps: fields.get("gaps").and_then(Value::as_bool),
                };
                if let Some(first) = &self.first_end_flags {
                    if *first != flags {
                        self.flags_conflict = true;
                    }
                } else {
                    self.first_end_flags = Some(flags.clone());
                }
                self.end_markers += 1;
                let gappy = flags.gaps == Some(true)
                    || flags.halted == Some(true)
                    || flags.ok == Some(false);
                if gappy {
                    self.gap_observed = true;
                }
            }
            _ => {}
        }
    }

    /// The session's DECLARED disposition from its first end marker's
    /// flags — a declaration, never proof of writer acknowledgment.
    fn declared(&self) -> &'static str {
        match (&self.first_end_flags, self.flags_conflict) {
            (_, true) => "contradictory",
            (None, _) if self.end_markers == 0 => "no_end_marker",
            (None, _) => "unknown_legacy",
            // a legacy end with NO explicit flags: unknown, never gappy
            (Some(f), _) if f.ok.is_none() && f.halted.is_none() && f.gaps.is_none() => {
                "unknown_legacy"
            }
            // partially specified flags: not clean-eligible, not gappy —
            // the declaration itself is incomplete
            (Some(f), _) if f.ok.is_none() || f.halted.is_none() || f.gaps.is_none() => {
                "unknown_partial_flags"
            }
            (Some(f), _) => {
                if f.ok == Some(true) && f.halted == Some(false) && f.gaps == Some(false) {
                    "clean_declared"
                } else {
                    "gappy_declared"
                }
            }
        }
    }

    fn to_json(&self, clean_valid: bool) -> Value {
        let mut anomalies: Vec<&str> = Vec::new();
        if self.end_markers > 1 {
            anomalies.push("repeated_end");
        }
        if self.post_end_records {
            anomalies.push("post_end_records");
        }
        if self.flags_conflict {
            anomalies.push("contradictory_flags");
        }
        if self.end_markers > 0 && !self.start_seen {
            anomalies.push("end_without_start");
        }
        json!({
            "start_seen": self.start_seen,
            "end_markers": self.end_markers,
            "declared": self.declared(),
            "clean_valid": clean_valid,
            "gap_observed": self.gap_observed,
            "anomalies": anomalies,
            "writer_acknowledgment": "unknown",
        })
    }
}

// ---------------------------------------------------------------------------
// cursor

/// The cursor this module writes/loads — exactly these fields; semantic
/// state is deliberately NOT cached (recomputed from bytes on resume).
#[derive(Clone, Debug, PartialEq)]
pub struct Cursor {
    pub src: String,
    pub next: u64,
    pub prior_len: u64,
    pub digest_b64u: String,
}

impl Cursor {
    pub fn to_json_string(&self) -> Result<String, CursorSaveError> {
        let s = json!({
            "v": CURSOR_VERSION,
            "src": self.src,
            "next": self.next,
            "len": self.prior_len,
            "digest": { "alg": DIGEST_ALG, "b64u": self.digest_b64u },
        })
        .to_string();
        if s.len() > MAX_CURSOR_BYTES {
            return Err(CursorSaveError::TooLarge);
        }
        Ok(s)
    }

    /// Strict parse: exact field set, types, bounds, no duplicate keys.
    /// Rejects malformed/partial files.
    pub fn parse(bytes: &[u8]) -> Result<Cursor, CursorRefusal> {
        if bytes.len() > MAX_CURSOR_BYTES {
            return Err(CursorRefusal::TooLarge);
        }
        scan_top_object(bytes).map_err(|_| CursorRefusal::Malformed)?;
        let v: Value = serde_json::from_slice(bytes).map_err(|_| CursorRefusal::Malformed)?;
        let obj = v.as_object().ok_or(CursorRefusal::Malformed)?;
        if obj.len() != 5 {
            return Err(CursorRefusal::Malformed);
        }
        let version = obj.get("v").and_then(Value::as_u64);
        if version != Some(CURSOR_VERSION) {
            return Err(CursorRefusal::Version(version.unwrap_or(0)));
        }
        let src = match obj.get("src").and_then(Value::as_str) {
            Some(s) if !s.is_empty() && s.len() <= MAX_SOURCE_KEY_BYTES => s.to_string(),
            _ => return Err(CursorRefusal::SourceKey),
        };
        let next = obj
            .get("next")
            .and_then(Value::as_u64)
            .ok_or(CursorRefusal::Malformed)?;
        let prior_len = obj
            .get("len")
            .and_then(Value::as_u64)
            .ok_or(CursorRefusal::Malformed)?;
        if next > prior_len {
            return Err(CursorRefusal::Offset(next));
        }
        let digest = obj
            .get("digest")
            .and_then(Value::as_object)
            .ok_or(CursorRefusal::Malformed)?;
        if digest.len() != 2 || digest.get("alg").and_then(Value::as_str) != Some(DIGEST_ALG) {
            return Err(CursorRefusal::Malformed);
        }
        let digest_b64u = digest
            .get("b64u")
            .and_then(Value::as_str)
            .ok_or(CursorRefusal::Malformed)?
            .to_string();
        // b64u of a SHA3-256 digest is exactly 43 unpadded characters
        if digest_b64u.len() != 43 || !digest_b64u.bytes().all(is_b64u_byte) {
            return Err(CursorRefusal::Malformed);
        }
        Ok(Cursor {
            src,
            next,
            prior_len,
            digest_b64u,
        })
    }
}

fn is_b64u_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'-' || b == b'_'
}

/// Load a cursor file (bounded; typed refusals; key must match).
pub fn load_cursor_file(path: &Path, expected_key: &str) -> Result<Cursor, CursorRefusal> {
    let file = File::open(path).map_err(|_| CursorRefusal::Malformed)?;
    let mut buf = Vec::with_capacity(256);
    file.take((MAX_CURSOR_BYTES + 1) as u64)
        .read_to_end(&mut buf)
        .map_err(|_| CursorRefusal::Malformed)?;
    let cursor = Cursor::parse(&buf)?;
    if cursor.src != expected_key {
        return Err(CursorRefusal::SourceKey);
    }
    Ok(cursor)
}

/// Save a cursor to a NEW checkpoint file — exclusive creation, complete
/// bounded encoding, checked writes and file sync, Unix parent-directory
/// sync (Windows creation-durability limit as documented in G2-A). The
/// parent must exist. Never overwrites; a failed save leaves the
/// caller's previously selected checkpoint untouched (replaying from it
/// may repeat an already-accepted batch — the explicit recovery rule).
pub fn save_cursor_new(path: &Path, cursor: &Cursor) -> Result<(), CursorSaveError> {
    let encoded = cursor.to_json_string()?;
    let parent = path.parent().unwrap_or(Path::new("."));
    if !parent.is_dir() {
        return Err(CursorSaveError::ParentMissing);
    }
    let mut file = match OpenOptions::new().create_new(true).write(true).open(path) {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            return Err(CursorSaveError::Collision)
        }
        Err(e) => return Err(CursorSaveError::WriteFailed { code: err_code(&e) }),
    };
    let outcome = file
        .write_all(encoded.as_bytes())
        .and_then(|_| file.sync_all());
    #[cfg(unix)]
    let outcome = outcome.and_then(|_| File::open(parent)?.sync_all());
    outcome.map_err(|e| CursorSaveError::WriteFailed { code: err_code(&e) })
}

// ---------------------------------------------------------------------------
// reading

/// Where this observation starts: the beginning, or a validated cursor.
#[derive(Clone, Debug)]
pub enum Resume {
    Start,
    Cursor(Cursor),
}

/// One admitted record. `raw` (the exact line bytes) is UNTRUSTED data;
/// the CLI omits it from default output.
#[derive(Clone, Debug)]
pub struct Record {
    pub offset: u64,
    pub len: u64,
    pub ev: String,
    pub t: String,
    pub t_ms: u64,
    pub raw: String,
}

#[derive(Clone, Debug, PartialEq)]
pub enum StopReason {
    /// EOF at the captured extent H with no partial record pending.
    EndOfCapturedExtent,
    /// EOF at H in the middle of a record (starts_at = the partial
    /// line's first byte). Even parseable bytes without their LF are a
    /// tail, never an admitted record.
    IncompleteTail { starts_at: u64 },
    /// A record was refused at its starting offset; no scan-ahead.
    FramingRefused { at: u64, fault: FramingFault },
    /// A work ceiling stopped the batch with more captured bytes below H.
    LimitReached { records: usize, bytes: usize },
    /// The first record cannot fit the caller's batch budget — an
    /// explicit result, not an endless empty successful batch.
    BudgetTooSmall { first_record_bytes: usize },
}

pub struct ReadOutcome {
    pub records: Vec<Record>,
    pub extent_len: u64,
    pub next_offset: u64,
    /// H − next: OBSERVED byte backlog, including any blocked tail. Not
    /// an exact event count; not a live backlog.
    pub observed_backlog_bytes: u64,
    pub stop: StopReason,
    pub session: Value,
    pub candidate: Cursor,
}

struct Reader<'s> {
    src: &'s mut dyn ByteSource,
    extent: u64,
    hasher: sha3::Sha3_256,
    digest_len: u64,
}

impl<'s> Reader<'s> {
    /// Read exactly `want` bytes at `off` (clamped to the captured
    /// extent) or fail as typed truncation/I-O. A short read inside the
    /// extent means the source shrank below H mid-call.
    fn read_exact_at(&mut self, off: u64, want: usize) -> Result<Vec<u8>, ReaderError> {
        let clamped = (self.extent.saturating_sub(off)).min(want as u64) as usize;
        let mut buf = vec![0u8; clamped];
        let mut got = 0usize;
        while got < clamped {
            let n = self
                .src
                .read_at(off + got as u64, &mut buf[got..])
                .map_err(|e| ReaderError::Io { code: err_code(&e) })?;
            if n == 0 {
                return Err(ReaderError::TruncatedDuringRead);
            }
            got += n;
        }
        Ok(buf)
    }

    /// Locate the LF ending the record starting at `off`, examining at
    /// most `hard_cap` line bytes. Returns the complete line (incl LF)
    /// and its end offset, or None if no LF exists within the scan limit
    /// (bounded memory: the line buffer never exceeds hard_cap).
    fn find_line_end(
        &mut self,
        off: u64,
        hard_cap: usize,
    ) -> Result<Option<(Vec<u8>, u64)>, ReaderError> {
        let mut line: Vec<u8> = Vec::new();
        let scan_limit = off
            .checked_add(hard_cap as u64 + 1)
            .expect("offset overflow")
            .min(self.extent);
        let mut pos = off;
        while pos < scan_limit {
            let room = hard_cap + 1 - line.len();
            let want = READ_CHUNK.min((scan_limit - pos) as usize).min(room);
            if want == 0 {
                return Ok(None);
            }
            let chunk = self.read_exact_at(pos, want)?;
            if let Some(nl) = chunk.iter().position(|&b| b == b'\n') {
                line.extend_from_slice(&chunk[..=nl]);
                return Ok(Some((line, pos + nl as u64 + 1)));
            }
            line.extend_from_slice(&chunk);
            pos += chunk.len() as u64;
        }
        Ok(None)
    }

    /// Strict parse of one complete line (incl LF). Returns the record
    /// and its parsed object (for semantic tracking). Never digests.
    fn parse_record(bytes: &[u8]) -> Result<(Record, Map<String, Value>), FramingFault> {
        let line = std::str::from_utf8(bytes).map_err(|_| FramingFault::NotUtf8)?;
        let trimmed = line.strip_suffix('\n').unwrap_or(line);
        if trimmed.trim().is_empty() {
            return Err(FramingFault::BlankLine);
        }
        match scan_top_object(trimmed.as_bytes()) {
            Err(ScanFault::Dup) => return Err(FramingFault::DuplicateTopKey),
            Err(ScanFault::Depth) => return Err(FramingFault::NestingTooDeep),
            Err(ScanFault::Malformed) => {
                // distinguish "valid JSON, wrong shape" from broken JSON
                return Err(match serde_json::from_str::<Value>(trimmed) {
                    Ok(v) if !v.is_object() => FramingFault::NotJsonObject,
                    _ => FramingFault::MalformedJson,
                });
            }
            Ok(_) => {}
        }
        let v: Value = serde_json::from_str(trimmed).map_err(|_| FramingFault::MalformedJson)?;
        let obj = match v {
            Value::Object(map) => map,
            _ => return Err(FramingFault::NotJsonObject),
        };
        let t = obj
            .get("t")
            .ok_or(FramingFault::EnvelopeMissing)?
            .as_str()
            .ok_or(FramingFault::EnvelopeType)?
            .to_string();
        let t_ms = obj
            .get("t_ms")
            .ok_or(FramingFault::EnvelopeMissing)?
            .as_u64()
            .ok_or(FramingFault::EnvelopeType)?;
        let ev = obj
            .get("ev")
            .ok_or(FramingFault::EnvelopeMissing)?
            .as_str()
            .ok_or(FramingFault::EnvelopeType)?
            .to_string();
        let record = Record {
            offset: 0, // filled by the caller
            len: bytes.len() as u64,
            ev: ev.clone(),
            t,
            t_ms,
            raw: line.to_string(),
        };
        Ok((record, obj))
    }

    fn update_digest(&mut self, bytes: &[u8]) {
        use sha3::Digest;
        self.hasher.update(bytes);
        self.digest_len += bytes.len() as u64;
    }
}

/// Validate a resume cursor's consumed prefix: digest over ALL bytes
/// before `next`, plus semantic recomputation (never trusting cached
/// state — the cursor carries none). Budget is checked before reading.
fn validate_prefix(
    reader: &mut Reader<'_>,
    cursor: &Cursor,
    budget: &Budget,
    state: &mut SessionState,
) -> Result<(), ReaderError> {
    if cursor.next as u128 > budget.max_prefix_validation as u128 {
        return Err(ReaderError::CursorRefused {
            reason: CursorRefusal::PrefixTooLarge(cursor.next),
        });
    }
    let mut pos = 0u64;
    while pos < cursor.next {
        let (line, end) =
            reader
                .find_line_end(pos, MAX_RECORD_BYTES)?
                .ok_or(ReaderError::PrefixRecordFault {
                    at: pos,
                    fault: FramingFault::MalformedJson,
                })?;
        if end != cursor.next && end < cursor.next {
            // a complete record inside the prefix — fine, continue
        }
        if end > cursor.next {
            return Err(ReaderError::PrefixRecordFault {
                at: pos,
                fault: FramingFault::MalformedJson,
            });
        }
        let (record, fields) = Reader::parse_record(&line)
            .map_err(|fault| ReaderError::PrefixRecordFault { at: pos, fault })?;
        state.observe(&record.ev, &fields);
        reader.update_digest(&line);
        pos = end;
    }
    use sha3::Digest;
    let computed = b64::b64u(&reader.hasher.clone().finalize());
    if computed != cursor.digest_b64u {
        return Err(ReaderError::CursorRefused {
            reason: CursorRefusal::Offset(cursor.next),
        });
    }
    Ok(())
}

/// One bounded, read-only observation. Returns admitted records plus a
/// CANDIDATE cursor — stored consumer state never advances here; the
/// caller accepts the batch, then explicitly saves a new checkpoint.
pub fn read_batch(
    src: &mut dyn ByteSource,
    resume: Resume,
    source_key: &str,
    budget: Budget,
) -> Result<ReadOutcome, ReaderError> {
    if source_key.is_empty() || source_key.len() > MAX_SOURCE_KEY_BYTES {
        return Err(ReaderError::CursorRefused {
            reason: CursorRefusal::SourceKey,
        });
    }
    let extent = src
        .len_at_call()
        .map_err(|e| ReaderError::Io { code: err_code(&e) })?;
    let mut reader = Reader {
        src,
        extent,
        hasher: sha3::Sha3_256::new(),
        digest_len: 0,
    };
    let mut state = SessionState::default();

    let start_at = match resume {
        Resume::Start => 0u64,
        Resume::Cursor(c) => {
            // the cursor must bind to THIS logical source — never silently
            // apply one source's checkpoint to another
            if c.src != source_key {
                return Err(ReaderError::CursorRefused {
                    reason: CursorRefusal::SourceKey,
                });
            }
            if extent < c.prior_len {
                return Err(ReaderError::TruncatedBelowCursor {
                    len: extent,
                    prior: c.prior_len,
                });
            }
            if c.next > extent {
                return Err(ReaderError::CursorRefused {
                    reason: CursorRefusal::Offset(c.next),
                });
            }
            // newline boundary: next is 0 or immediately after an LF
            if c.next > 0 {
                let b = reader.read_exact_at(c.next - 1, 1)?;
                if b[0] != b'\n' {
                    return Err(ReaderError::CursorRefused {
                        reason: CursorRefusal::Offset(c.next),
                    });
                }
            }
            validate_prefix(&mut reader, &c, &budget, &mut state)?;
            c.next
        }
    };

    let mut records: Vec<Record> = Vec::new();
    let mut batch_bytes = 0usize;
    let mut pos = start_at;
    let stop;
    loop {
        if pos >= extent {
            stop = StopReason::EndOfCapturedExtent;
            break;
        }
        let found = reader.find_line_end(pos, MAX_RECORD_BYTES)?;
        let (line, end) = match found {
            Some(found) => found,
            None => {
                // no LF within the record cap or before extent H
                let cap_end = pos
                    .checked_add(MAX_RECORD_BYTES as u64)
                    .expect("offset overflow");
                if cap_end < extent {
                    // more captured bytes exist below H with no LF within
                    // the record bound — an admission refusal, not a tail
                    stop = StopReason::FramingRefused {
                        at: pos,
                        fault: FramingFault::OversizedRecord,
                    };
                } else {
                    stop = StopReason::IncompleteTail { starts_at: pos };
                }
                break;
            }
        };
        let line_len = line.len();
        if records.is_empty() && line_len > budget.max_batch_bytes {
            stop = StopReason::BudgetTooSmall {
                first_record_bytes: line_len,
            };
            break;
        }
        if records.len() >= budget.max_batch_records
            || batch_bytes + line_len > budget.max_batch_bytes
        {
            stop = StopReason::LimitReached {
                records: records.len(),
                bytes: batch_bytes,
            };
            break;
        }
        let (mut record, fields) = match Reader::parse_record(&line) {
            Ok(parsed) => parsed,
            Err(fault) => {
                stop = StopReason::FramingRefused { at: pos, fault };
                break;
            }
        };
        record.offset = pos;
        state.observe(&record.ev, &fields);
        reader.update_digest(&line);
        batch_bytes += line_len;
        pos = end;
        records.push(record);
    }

    let next_offset = match &stop {
        StopReason::FramingRefused { at, .. } => *at,
        StopReason::IncompleteTail { starts_at } => *starts_at,
        _ => pos,
    };
    use sha3::Digest;
    let digest_b64u = b64::b64u(&reader.hasher.finalize());
    // A VALID clean classification requires an explicitly DECLARED clean
    // end (legacy/partial flags stay unknown), one terminal end after a
    // start marker, no latched gap, no post-end records, and a fully
    // accounted captured extent.
    let clean_valid = matches!(stop, StopReason::EndOfCapturedExtent)
        && next_offset == extent
        && state.declared() == "clean_declared"
        && state.end_markers == 1
        && !state.post_end_records;
    Ok(ReadOutcome {
        session: state.to_json(clean_valid),
        observed_backlog_bytes: extent - next_offset,
        extent_len: extent,
        next_offset,
        stop,
        records,
        candidate: Cursor {
            src: source_key.to_string(),
            next: next_offset,
            prior_len: extent,
            digest_b64u,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(ev: &str, extra: &str) -> String {
        format!("{{\"t\":\"2026-09-07T00:00:00Z\",\"t_ms\":1,\"ev\":\"{ev}\"{extra}}}\n")
    }

    fn clean_session() -> String {
        let mut s = String::new();
        s.push_str(&line("session_start", ""));
        s.push_str(&line("navigated", ""));
        s.push_str(&line(
            "session_end",
            ",\"ok\":true,\"halted\":false,\"gaps\":false",
        ));
        s
    }

    #[test]
    fn healthy_source_multi_batch_contiguous_and_clean_only_at_end() {
        // four records with the END LAST — a record after session_end
        // would (correctly) be a post_end_records anomaly, not clean
        let mut s = String::new();
        s.push_str(&line("session_start", ""));
        s.push_str(&line("navigated", ""));
        s.push_str(&line("resolved", ""));
        s.push_str(&line(
            "session_end",
            ",\"ok\":true,\"halted\":false,\"gaps\":false",
        ));
        let mut src = MemSource(s.as_bytes().to_vec());
        let b = Budget {
            max_batch_records: 1,
            ..Default::default()
        };
        let mut resume = Resume::Start;
        let mut next = 0u64;
        for (i, expected_ev) in ["session_start", "navigated", "resolved", "session_end"]
            .iter()
            .enumerate()
        {
            let out = read_batch(&mut src, resume.clone(), "k", b).unwrap();
            assert_eq!(out.records.len(), 1);
            assert_eq!(out.records[0].ev, *expected_ev);
            assert_eq!(out.records[0].offset, next);
            next = out.next_offset;
            let expect_clean = i == 3;
            assert_eq!(out.session["clean_valid"], json!(expect_clean));
            if *expected_ev == "session_end" {
                assert_eq!(out.session["declared"], json!("clean_declared"));
                assert_eq!(out.observed_backlog_bytes, 0);
            } else {
                assert!(out.observed_backlog_bytes > 0);
            }
            resume = Resume::Cursor(out.candidate);
        }
        // resume across batches equals one uninterrupted inspection
        let mut whole = MemSource(s.clone().into_bytes());
        let one = read_batch(&mut whole, Resume::Start, "k", Budget::default()).unwrap();
        assert_eq!(one.records.len(), 4);
        assert_eq!(one.next_offset, next);
        assert_eq!(one.session["clean_valid"], json!(true));
        assert_eq!(one.session["writer_acknowledgment"], json!("unknown"));
    }

    #[test]
    fn duplicates_are_two_observations_and_repeat_is_repeat() {
        let same = line("click", "");
        let mut s = same.clone();
        s.push_str(&same);
        let mut src = MemSource(s.clone().into_bytes());
        let out = read_batch(&mut src, Resume::Start, "k", Budget::default()).unwrap();
        assert_eq!(out.records.len(), 2);
        assert_ne!(out.records[0].offset, out.records[1].offset);
        // resuming with the accepted next cursor does not repeat consumed
        // offsets; re-reading with the SAME cursor may repeat
        let mut again = MemSource(s.as_bytes().to_vec());
        let out2 = read_batch(
            &mut again,
            Resume::Cursor(out.candidate.clone()),
            "k",
            Budget::default(),
        )
        .unwrap();
        assert_eq!(out2.records.len(), 0);
        assert_eq!(out2.next_offset, out.next_offset);
        let mut third = MemSource(s.as_bytes().to_vec());
        let out3 = read_batch(
            &mut third,
            Resume::Cursor(out.candidate),
            "k",
            Budget::default(),
        )
        .unwrap();
        assert_eq!(out3.next_offset, out2.next_offset);
    }

    #[test]
    fn partial_line_waits_cursor_holds_line_start() {
        let mut s = clean_session();
        let cut = s.len();
        s.push_str("{\"t\":\"2026-09"); // no LF — partial
        let mut src = MemSource(s.as_bytes().to_vec());
        let out = read_batch(&mut src, Resume::Start, "k", Budget::default()).unwrap();
        assert_eq!(out.records.len(), 3);
        match out.stop {
            StopReason::IncompleteTail { starts_at } => assert_eq!(starts_at, cut as u64),
            other => panic!("expected IncompleteTail, got {other:?}"),
        }
        assert_eq!(out.next_offset, cut as u64);
        assert_eq!(out.observed_backlog_bytes, (s.len() - cut) as u64);
        // a later append completes it: the next call reads the record
        let mut grown = s.clone();
        grown.push_str("T00:00:01Z\",\"t_ms\":2,\"ev\":\"late\"}\n");
        let mut src2 = MemSource(grown.as_bytes().to_vec());
        let out2 = read_batch(
            &mut src2,
            Resume::Cursor(out.candidate),
            "k",
            Budget::default(),
        )
        .unwrap();
        assert_eq!(out2.records.len(), 1);
        assert_eq!(out2.records[0].ev, "late");
    }

    #[test]
    fn complete_json_without_lf_is_never_admitted() {
        let mut s = clean_session();
        let cut = s.len();
        s.push_str("{\"t\":\"2026-09-07T00:00:02Z\",\"t_ms\":3,\"ev\":\"noLF\"}");
        let mut src = MemSource(s.as_bytes().to_vec());
        let out = read_batch(&mut src, Resume::Start, "k", Budget::default()).unwrap();
        assert_eq!(out.records.len(), 3);
        assert!(matches!(
            out.stop,
            StopReason::IncompleteTail { starts_at } if starts_at == cut as u64
        ));
    }

    #[test]
    fn malformed_records_stop_contiguously_no_scan_ahead() {
        let cases: Vec<(&str, FramingFault)> = vec![
            ("not json at all\n", FramingFault::MalformedJson),
            ("[1,2,3]\n", FramingFault::NotJsonObject),
            (
                "{\"t\":\"x\",\"t_ms\":1,\"ev\":\"a\",\"t\":\"y\"}\n",
                FramingFault::DuplicateTopKey,
            ),
            (
                "{\"t\":\"x\",\"t_ms\":\"no\",\"ev\":\"a\"}\n",
                FramingFault::EnvelopeType,
            ),
            (
                "{\"t\":\"x\",\"ev\":\"a\"}\n",
                FramingFault::EnvelopeMissing,
            ),
            ("\n", FramingFault::BlankLine),
        ];
        for (bad, fault) in cases {
            let mut s = line("session_start", "");
            let bad_at = s.len();
            s.push_str(bad);
            s.push_str(&line("after", "")); // a valid record AFTER the fault
            let mut src = MemSource(s.into_bytes());
            let out = read_batch(&mut src, Resume::Start, "k", Budget::default()).unwrap();
            assert_eq!(out.records.len(), 1, "fault {fault:?}");
            match &out.stop {
                StopReason::FramingRefused { at, fault: f } => {
                    assert_eq!(*at, bad_at as u64);
                    assert_eq!(*f, fault);
                }
                other => panic!("expected FramingRefused, got {other:?}"),
            }
            assert_eq!(out.next_offset, bad_at as u64);
            assert!(!out.records.iter().any(|r| r.ev == "after"));
        }
    }

    #[test]
    fn deep_nesting_is_refused_and_oversized_records_stop() {
        let mut s = String::new();
        s.push_str("{\"t\":\"x\",\"t_ms\":1,\"ev\":\"a\",\"d\":");
        for _ in 0..64 {
            s.push('[');
        }
        for _ in 0..64 {
            s.push(']');
        }
        s.push_str("}\n");
        let mut src = MemSource(s.into_bytes());
        let out = read_batch(&mut src, Resume::Start, "k", Budget::default()).unwrap();
        assert!(matches!(
            out.stop,
            StopReason::FramingRefused {
                fault: FramingFault::NestingTooDeep,
                ..
            }
        ));

        // oversized: no LF within the hard record cap, with more captured
        // bytes below H beyond the cap
        let mut big = String::new();
        big.push_str(&line("session_start", ""));
        let at = big.len();
        big.push_str(&"x".repeat(MAX_RECORD_BYTES + 10));
        big.push('\n');
        let mut src2 = MemSource(big.into_bytes());
        let out2 = read_batch(&mut src2, Resume::Start, "k", Budget::default()).unwrap();
        assert!(matches!(
            out2.stop,
            StopReason::FramingRefused {
                at: a,
                fault: FramingFault::OversizedRecord
            } if a == at as u64
        ));
    }

    #[test]
    fn budget_stop_is_limit_reached_not_eof_and_backlog_exact() {
        let mut s = String::new();
        for i in 0..5 {
            s.push_str(&line(&format!("ev{i}"), ""));
        }
        let mut src = MemSource(s.clone().into_bytes());
        let b = Budget {
            max_batch_records: 2,
            ..Default::default()
        };
        let out = read_batch(&mut src, Resume::Start, "k", b).unwrap();
        assert_eq!(out.records.len(), 2);
        match &out.stop {
            StopReason::LimitReached { records, .. } => assert_eq!(*records, 2),
            other => panic!("expected LimitReached, got {other:?}"),
        }
        assert_eq!(
            out.observed_backlog_bytes,
            (s.len() as u64) - out.next_offset
        );
        assert!(!out.session["clean_valid"].as_bool().unwrap());

        // first record bigger than the batch budget: explicit result
        let mut src2 = MemSource(s.clone().into_bytes());
        let b2 = Budget {
            max_batch_records: 2,
            max_batch_bytes: 10,
            ..Default::default()
        };
        let out2 = read_batch(&mut src2, Resume::Start, "k", b2).unwrap();
        assert!(matches!(
            out2.stop,
            StopReason::BudgetTooSmall { first_record_bytes } if first_record_bytes > 10
        ));
        assert_eq!(out2.records.len(), 0);
        assert_eq!(out2.next_offset, 0);
    }

    #[test]
    fn cursor_refusals_without_auto_reset() {
        let s = clean_session();
        let mut src = MemSource(s.as_bytes().to_vec());
        let first = read_batch(&mut src, Resume::Start, "k", Budget::default()).unwrap();
        let cursor = first.candidate.clone();

        // wrong source key
        let wrong_key = Cursor {
            src: "other".into(),
            ..cursor.clone()
        };
        let mut m = MemSource(s.as_bytes().to_vec());
        assert!(matches!(
            read_batch(&mut m, Resume::Cursor(wrong_key), "k", Budget::default()),
            Err(ReaderError::CursorRefused {
                reason: CursorRefusal::SourceKey
            })
        ));

        // same-length mutation inside the consumed prefix → digest refusal
        let mut mutated = s.clone().into_bytes();
        mutated[10] = match mutated[10] {
            b'0' => b'1',
            _ => b'0',
        };
        let mut m2 = MemSource(mutated);
        assert!(matches!(
            read_batch(
                &mut m2,
                Resume::Cursor(cursor.clone()),
                "k",
                Budget::default()
            ),
            Err(ReaderError::CursorRefused { .. })
        ));

        // mid-line offset → boundary refusal
        let mid = Cursor {
            next: 3,
            prior_len: cursor.prior_len,
            digest_b64u: cursor.digest_b64u.clone(),
            src: "k".into(),
        };
        let mut m3 = MemSource(s.as_bytes().to_vec());
        assert!(matches!(
            read_batch(&mut m3, Resume::Cursor(mid), "k", Budget::default()),
            Err(ReaderError::CursorRefused {
                reason: CursorRefusal::Offset(_)
            })
        ));

        // unsupported version / malformed / oversized cursor payloads
        let bad_version = format!(
            "{{\"v\":2,\"src\":\"k\",\"next\":0,\"len\":0,\"digest\":{{\"alg\":\"sha3-256\",\"b64u\":\"{}\"}}}}",
            "A".repeat(43)
        );
        assert!(matches!(
            Cursor::parse(bad_version.as_bytes()),
            Err(CursorRefusal::Version(2))
        ));
        assert!(matches!(
            Cursor::parse(b"{\"v\":1"),
            Err(CursorRefusal::Malformed)
        ));
        assert!(matches!(
            Cursor::parse(&vec![b'x'; MAX_CURSOR_BYTES + 1]),
            Err(CursorRefusal::TooLarge)
        ));

        // truncation below the cursor's prior observed length
        let mut short = s.clone().into_bytes();
        short.truncate((cursor.prior_len - 1) as usize);
        let mut m4 = MemSource(short);
        assert!(matches!(
            read_batch(&mut m4, Resume::Cursor(cursor), "k", Budget::default()),
            Err(ReaderError::TruncatedBelowCursor { .. })
        ));
    }

    #[test]
    fn gap_state_survives_batch_boundaries_and_resume() {
        let mut s = String::new();
        s.push_str(&line("session_start", ""));
        let mut src = MemSource(s.as_bytes().to_vec());
        let b = Budget {
            max_batch_records: 1,
            ..Default::default()
        };
        let out1 = read_batch(&mut src, Resume::Start, "k", b).unwrap();
        assert_eq!(out1.session["declared"], json!("no_end_marker"));

        let mut s2 = s.clone();
        s2.push_str(&line(
            "session_end",
            ",\"ok\":false,\"halted\":true,\"gaps\":true",
        ));
        let mut src2 = MemSource(s2.as_bytes().to_vec());
        let out2 = read_batch(&mut src2, Resume::Cursor(out1.candidate), "k", b).unwrap();
        assert_eq!(out2.session["declared"], json!("gappy_declared"));
        assert_eq!(out2.session["gap_observed"], json!(true));
        assert!(!out2.session["clean_valid"].as_bool().unwrap());

        // post-end records: anomaly visible, the gap never cleans
        let mut s3 = s2.clone();
        s3.push_str(&line("navigated", ""));
        let mut src3 = MemSource(s3.as_bytes().to_vec());
        let out3 = read_batch(&mut src3, Resume::Cursor(out2.candidate), "k", b).unwrap();
        let anomalies = out3.session["anomalies"].as_array().unwrap();
        assert!(anomalies.contains(&json!("post_end_records")));
        assert_eq!(out3.session["gap_observed"], json!(true));
        assert!(!out3.session["clean_valid"].as_bool().unwrap());

        // legacy end (no flags) stays unknown
        let legacy = format!("{}{}", line("session_start", ""), line("session_end", ""));
        let mut lsrc = MemSource(legacy.into_bytes());
        let lout = read_batch(&mut lsrc, Resume::Start, "k", Budget::default()).unwrap();
        assert_eq!(lout.session["declared"], json!("unknown_legacy"));
        assert!(!lout.session["clean_valid"].as_bool().unwrap());

        // repeated ends stay anomalous, never repaired to clean
        let mut twice = clean_session();
        twice.push_str(&line(
            "session_end",
            ",\"ok\":true,\"halted\":false,\"gaps\":false",
        ));
        let mut tsrc = MemSource(twice.into_bytes());
        let tout = read_batch(&mut tsrc, Resume::Start, "k", Budget::default()).unwrap();
        let anomalies = tout.session["anomalies"].as_array().unwrap();
        assert!(anomalies.contains(&json!("repeated_end")));
        assert!(!tout.session["clean_valid"].as_bool().unwrap());
    }

    /// The demonstrated acknowledgment boundary: readable records — even
    /// a clean-looking end marker — are OBSERVED, never "acknowledged".
    /// These bytes are exactly what a sync-refused writer leaves on disk.
    #[test]
    fn readable_bytes_never_become_acknowledgment() {
        // probe 1: an event record readable after a refused sync
        let mut s = clean_session();
        s.push_str(&line("click", ",\"ref\":\"@e1\""));
        let mut src = MemSource(s.into_bytes());
        let out = read_batch(&mut src, Resume::Start, "k", Budget::default()).unwrap();
        assert_eq!(out.records.len(), 4);
        assert_eq!(out.session["writer_acknowledgment"], json!("unknown"));

        // probe 2: a clean-looking END marker readable after a refused
        // sync — the strongest form of the boundary
        let clean = clean_session();
        let mut src2 = MemSource(clean.into_bytes());
        let out2 = read_batch(&mut src2, Resume::Start, "k", Budget::default()).unwrap();
        assert_eq!(out2.records.len(), 3);
        assert_eq!(out2.session["declared"], json!("clean_declared"));
        assert_eq!(out2.session["clean_valid"], json!(true));
        // ... and STILL unknown acknowledgment: a declared clean end is
        // not proof the writer's call returned Ok
        assert_eq!(out2.session["writer_acknowledgment"], json!("unknown"));
    }

    #[test]
    fn cursor_save_collision_parent_partial_and_roundtrip() {
        let dir = std::env::temp_dir().join("banchor-g2b-cursor-save");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let s = clean_session();
        let mut src = MemSource(s.as_bytes().to_vec());
        let out = read_batch(&mut src, Resume::Start, "k", Budget::default()).unwrap();
        let cursor = &out.candidate;

        let missing = dir.join("nope").join("c.json");
        assert!(matches!(
            save_cursor_new(&missing, cursor),
            Err(CursorSaveError::ParentMissing)
        ));

        let cp = dir.join("cp1.json");
        save_cursor_new(&cp, cursor).unwrap();
        let loaded = load_cursor_file(&cp, "k").unwrap();
        assert_eq!(loaded, *cursor);

        // collision: never overwrites; the old checkpoint is unchanged
        let mut before = String::new();
        File::open(&cp)
            .unwrap()
            .read_to_string(&mut before)
            .unwrap();
        assert!(matches!(
            save_cursor_new(&cp, cursor),
            Err(CursorSaveError::Collision)
        ));
        let mut after = String::new();
        File::open(&cp).unwrap().read_to_string(&mut after).unwrap();
        assert_eq!(before, after);

        // partial/truncated cursor files refuse to load
        let partial = dir.join("partial.json");
        std::fs::write(&partial, &before[..before.len() / 2]).unwrap();
        assert!(matches!(
            load_cursor_file(&partial, "k"),
            Err(CursorRefusal::Malformed)
        ));

        assert!(matches!(
            load_cursor_file(&cp, "other"),
            Err(CursorRefusal::SourceKey)
        ));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Real temporary-file round trip through FileSource: growth between
    /// calls, resume validity, and source immutability.
    #[test]
    fn real_file_roundtrip_growth_and_immutability() {
        let dir = std::env::temp_dir().join("banchor-g2b-file");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("replay.jsonl");
        std::fs::write(&path, clean_session().as_bytes()).unwrap();

        let mut src = FileSource::open(&path).unwrap();
        let out = read_batch(&mut src, Resume::Start, "file-k", Budget::default()).unwrap();
        assert_eq!(out.records.len(), 3);
        assert_eq!(out.session["clean_valid"], json!(true));

        // the writer appends a late record between calls
        {
            let mut f = OpenOptions::new().append(true).open(&path).unwrap();
            Write::write_all(&mut f, line("late", "").as_bytes()).unwrap();
        }
        let grown_len = std::fs::metadata(&path).unwrap().len();
        let mut src2 = FileSource::open(&path).unwrap();
        let out2 = read_batch(
            &mut src2,
            Resume::Cursor(out.candidate),
            "file-k",
            Budget::default(),
        )
        .unwrap();
        assert_eq!(out2.records.len(), 1);
        assert_eq!(out2.records[0].ev, "late");
        assert_eq!(out2.extent_len, grown_len);
        assert!(out2.session["anomalies"]
            .as_array()
            .unwrap()
            .contains(&json!("post_end_records")));

        // truncation below prior observed length: typed, no candidate
        std::fs::write(&path, b"short\n").unwrap();
        let mut src3 = FileSource::open(&path).unwrap();
        assert!(matches!(
            read_batch(
                &mut src3,
                Resume::Cursor(out2.candidate),
                "file-k",
                Budget::default()
            ),
            Err(ReaderError::TruncatedBelowCursor { .. })
        ));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
