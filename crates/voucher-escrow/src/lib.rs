// ─── LICENSE ────────────────────────────────────────────────────────────────
// SPDX-License-Identifier: BUSL-1.1
// Licensor: Travis Mark Remington <lovis@skaists.dev>
// The commercial moat — Business Source License 1.1. Canonical terms:
// scripts/buzz-meter/LICENSE. Change Date: August 29, 2030 (the LICENSE
// PUBLISH commit of 2026-08-29, plus four years). Change License:
// GPL-2.0-or-later. Non-production use per the Additional Use Grant in that
// LICENSE; production use requires a commercial license from the Licensor.
// ────────────────────────────────────────────────────────────────────────────
//! voucher-escrow — the voucher/escrow MONEY engine for Vaulta-A-metered
//! compute, kernel form. The Rust half of a two-form engine.
//!
//! Seat-1 delivered this as `escrow-core`; it is landed under a different name
//! because `crates/escrow-core` ALREADY EXISTS in this tree and is an entirely
//! different thing — the bNature escrow STATE MACHINE (buyer/seller/dispute
//! lifecycle, brief §9.1–9.2). This one is the money; that one is the
//! lifecycle.
//!
//! # WIRE LAW v1 — the live deployed chain wins
//!
//! Founder ruling, 2026-08-29: *"THE LIVE DEPLOYED CHAIN WINS — never orphan a
//! live money ledger."* `scripts/buzz-meter/voucher_escrow.py` is merged and
//! running on the box with a real hash-chained ledger, so ITS format is
//! canonical and this crate conforms to it — not the reverse. Concretely:
//!
//! 1. **Canonicalisation is SORTED KEYS**, compact separators, and Python's
//!    `ensure_ascii` escaping — byte-for-byte `json.dumps(body, sort_keys=True,
//!    separators=(",", ":"))`. Seat-1's Rust used struct declaration order,
//!    which hashed the same event differently and meant the two forms could
//!    never read each other's chains.
//! 2. **The resource enum is the ruled set** (SPEC-SPEND-RECEIPT-1 plus the
//!    Lane M dispatch's `prefill_token` / `decode_token`). Seat-1's
//!    `llm.tokens.*` names stay RETIRED.
//! 3. **`verify_chain` hashes the RAW STORED BODY BYTES** — the bytes as they
//!    sit on disk, recovered by removing the two chain fields from the line.
//!    It never re-serialises a struct to verify. This is the general fix for
//!    the whole float/format class: a chain verifies the bytes it stored, so no
//!    serialiser disagreement can ever make an honest ledger look tampered.
//! 4. **Money on the wire is a 4-decimal A string** (`"5.0000"`), as Python
//!    writes it. Internally it stays exact `i128` raw units — integer money is
//!    an arithmetic property, not a wire format, and this crate keeps it while
//!    speaking Python's bytes.
//! 5. **`ts` is Python's `time.time()` float.** It has to be: the merge
//!    acceptance is that `verify_chain` passes on a snapshot of the live
//!    ledger, and those timestamps are floats. Rule 3 is what makes the float
//!    harmless — see `verify_chain`.
//!
//! # THE CONFORMANCE BATTERY IS THE GRADUATION CRITERION
//!
//! The same proofs run here and in the Python reference — two forms, one law,
//! one test suite. ANY future port, in any language, graduates only by passing
//! this battery unmodified AND by round-tripping against the other form: this
//! crate's tests verify a Python-written ledger and hand back a Rust-written
//! one for Python to verify. A port that needs the tests softened has not been
//! ported; it has been replaced.
//!
//! What this form adds over the Python reference:
//!
//! 1. **INTEGER MONEY.** Amounts are `i128` raw units (1 A = 10_000 raw), the
//!    representation Antelope itself uses. No floats, no decimal library, no
//!    rounding drift — exact for the life of the ledger.
//! 2. **UNKNOWN RESOURCE CLASSES ARE UNREPRESENTABLE.** `Meterable` is a
//!    closed enum, so a caller cannot submit a resource that was not added by
//!    ruling. The tithe line is produced only internally. The Python version
//!    refuses at runtime; here the program does not compile.
//! 3. **REFUSE-BEFORE-WRITE.** An over-balance charge returns
//!    `Err(InsufficientVoucher)` having appended nothing.
//! 4. **APPEND-ONLY, HASH-CHAINED**, verified against stored bytes.
//! 5. **TOTALS ARE COMPUTED, NEVER STORED.**
//! 6. **THE TITHE: 10%, a distinct line on every receipt.** Founder-ruled.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// 1 A = 10_000 raw units (Antelope 4-decimal asset precision).
pub const RAW_PER_A: i128 = 10_000;
/// The tithe: 10% on cost basis, founder-ruled. Never moves without his word.
pub const TITHE_NUM: i128 = 10;
pub const TITHE_DEN: i128 = 100;
/// The literal the Python reference writes for the tithe rate: `str(Decimal("0.10"))`.
pub const TITHE_RATE_TEXT: &str = "0.10";
// PUBLIC-CONSTANT: the genesis link of the hash chain — 32 zero bytes in hex.
// A fixed structural sentinel, not a key, a seed, or a vector: every ledger in
// every deployment starts here, and it is printed in the format spec.
const GENESIS: &str = "0000000000000000000000000000000000000000000000000000000000000000"; // PUBLIC-CONSTANT

// ---------------------------------------------------------------------------
// Money: integer raw units internally, 4-decimal A strings on the wire.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct RawA(pub i128);

impl RawA {
    /// Parse a decimal A string ("5", "5.0", "0.4400") into raw units.
    /// Rejects more than 4 decimals and junk — A carries four, and silently
    /// dropping a fifth would be inventing someone's money.
    pub fn parse(s: &str) -> Result<RawA, EscrowError> {
        let s = s.trim();
        let neg = s.starts_with('-');
        let body = if neg { &s[1..] } else { s };
        if body.is_empty() || !body.bytes().all(|b| b.is_ascii_digit() || b == b'.') {
            return Err(EscrowError::BadAmount(s.into()));
        }
        let (int, frac) = match body.split_once('.') {
            Some((i, f)) => (i, f),
            None => (body, ""),
        };
        if int.is_empty() || frac.len() > 4 || frac.contains('.') {
            return Err(EscrowError::BadAmount(s.into()));
        }
        let int: i128 = int.parse().map_err(|_| EscrowError::BadAmount(s.into()))?;
        let frac_padded = format!("{frac:0<4}");
        let frac: i128 = if frac.is_empty() {
            0
        } else {
            frac_padded
                .parse()
                .map_err(|_| EscrowError::BadAmount(s.into()))?
        };
        let v = int * RAW_PER_A + frac;
        Ok(RawA(if neg { -v } else { v }))
    }
    /// The wire form: exactly what Python's `str(Decimal.quantize(0.0001))` gives.
    pub fn to_a_string(self) -> String {
        let neg = self.0 < 0;
        let v = self.0.abs();
        format!(
            "{}{}.{:04}",
            if neg { "-" } else { "" },
            v / RAW_PER_A,
            v % RAW_PER_A
        )
    }
}

impl fmt::Display for RawA {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} A", self.to_a_string())
    }
}

// ---------------------------------------------------------------------------
// Resources: THE closed enum, the estate's ONE ruled set.
// ---------------------------------------------------------------------------

/// SPEC-SPEND-RECEIPT-1's set plus the Lane M dispatch ruling
/// (`prefill_token` / `decode_token`). An unlisted class is added BY RULING —
/// a caller passing a free string is a compile error, not a runtime check.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Meterable {
    #[serde(rename = "mesh_second")]
    MeshSecond,
    #[serde(rename = "vram_byte_second")]
    VramByteSecond,
    #[serde(rename = "ram_byte")]
    RamByte,
    #[serde(rename = "cpu_microsecond")]
    CpuMicrosecond,
    #[serde(rename = "net_byte")]
    NetByte,
    #[serde(rename = "chunk_count")]
    ChunkCount,
    #[serde(rename = "storage_byte")]
    StorageByte,
    #[serde(rename = "chain_fee")]
    ChainFee,
    #[serde(rename = "prefill_token")]
    PrefillToken,
    #[serde(rename = "decode_token")]
    DecodeToken,
}

impl Meterable {
    /// The wire spelling — the same string the Python reference writes.
    pub fn as_str(self) -> &'static str {
        match self {
            Meterable::MeshSecond => "mesh_second",
            Meterable::VramByteSecond => "vram_byte_second",
            Meterable::RamByte => "ram_byte",
            Meterable::CpuMicrosecond => "cpu_microsecond",
            Meterable::NetByte => "net_byte",
            Meterable::ChunkCount => "chunk_count",
            Meterable::StorageByte => "storage_byte",
            Meterable::ChainFee => "chain_fee",
            Meterable::PrefillToken => "prefill_token",
            Meterable::DecodeToken => "decode_token",
        }
    }
}

/// An exact decimal rate, kept as the LITERAL TEXT the rate set was written
/// with plus an integer mantissa/scale for arithmetic.
///
/// The text is preserved verbatim because it goes on the wire and the wire is
/// hashed: re-rendering `0.000002` as `2E-6` would change the bytes and break
/// conformance with the Python form, which writes `str(Decimal(...))`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rate {
    text: String,
    mant: i128,
    scale: u32,
}

impl Rate {
    pub fn parse(text: &str) -> Result<Rate, EscrowError> {
        let t = text.trim();
        if t.is_empty() || !t.bytes().all(|b| b.is_ascii_digit() || b == b'.') {
            return Err(EscrowError::BadRate(text.into()));
        }
        let (int, frac) = match t.split_once('.') {
            Some((i, f)) => (i, f),
            None => (t, ""),
        };
        if int.is_empty() || frac.contains('.') || frac.len() > 18 {
            return Err(EscrowError::BadRate(text.into()));
        }
        let joined = format!("{int}{frac}");
        let mant: i128 = joined.parse().map_err(|_| EscrowError::BadRate(text.into()))?;
        Ok(Rate {
            text: t.to_string(),
            mant,
            scale: frac.len() as u32,
        })
    }
    pub fn as_str(&self) -> &str {
        &self.text
    }
    /// `charged` in raw units for an integer quantity, quantised to A's four
    /// decimals with HALF-UP rounding — the same rule as Python's
    /// `Decimal.quantize(Q4, ROUND_HALF_UP)`.
    fn charge_raw(&self, qty: i128) -> Result<i128, EscrowError> {
        let num = qty
            .checked_mul(self.mant)
            .and_then(|v| v.checked_mul(RAW_PER_A))
            .ok_or(EscrowError::Overflow)?;
        let den = 10i128.checked_pow(self.scale).ok_or(EscrowError::Overflow)?;
        Ok(div_half_up(num, den))
    }
}

/// Versioned pricing law. Rates are A per unit of the closed resource enum.
#[derive(Debug, Clone)]
pub struct RateSet {
    pub version: String,
    pub cost_basis_ref: String,
    rates: Vec<(Meterable, Rate)>,
}

impl RateSet {
    pub fn new(version: &str, cost_basis_ref: &str, rates: Vec<(Meterable, Rate)>) -> Self {
        RateSet {
            version: version.into(),
            cost_basis_ref: cost_basis_ref.into(),
            rates,
        }
    }
    fn rate(&self, r: Meterable) -> Result<&Rate, EscrowError> {
        self.rates
            .iter()
            .find(|(m, _)| *m == r)
            .map(|(_, v)| v)
            .ok_or(EscrowError::NoRate(r))
    }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub enum EscrowError {
    BadAmount(String),
    BadRate(String),
    EmptyTxRef,
    EmptyUsage,
    NonPositiveQuantity,
    NoRate(Meterable),
    Overflow,
    /// Charge exceeds balance. NOTHING was written.
    InsufficientVoucher {
        needed: RawA,
        balance: RawA,
    },
    /// The chain does not verify at this event. Carries what was expected.
    Tamper {
        at_event: usize,
    },
    /// A stored line is not a well-formed event.
    Malformed {
        at_event: usize,
        why: String,
    },
    Io(std::io::Error),
}

impl fmt::Display for EscrowError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EscrowError::BadAmount(s) => write!(f, "bad amount: {s}"),
            EscrowError::BadRate(s) => write!(f, "bad rate: {s}"),
            EscrowError::EmptyTxRef => write!(f, "deposit requires a vaulta_tx reference"),
            EscrowError::EmptyUsage => write!(f, "empty usage"),
            EscrowError::NonPositiveQuantity => write!(f, "quantity must be positive"),
            EscrowError::NoRate(r) => write!(f, "no rate for {} in rate set", r.as_str()),
            EscrowError::Overflow => write!(f, "arithmetic overflow"),
            EscrowError::InsufficientVoucher { needed, balance } => write!(
                f,
                "charge {needed} exceeds voucher balance {balance} — refused, nothing written"
            ),
            EscrowError::Tamper { at_event } => write!(f, "chain broken at event {at_event}"),
            EscrowError::Malformed { at_event, why } => {
                write!(f, "event {at_event} is malformed: {why}")
            }
            EscrowError::Io(e) => write!(f, "io: {e}"),
        }
    }
}
impl std::error::Error for EscrowError {}
impl From<std::io::Error> for EscrowError {
    fn from(e: std::io::Error) -> Self {
        EscrowError::Io(e)
    }
}

// ---------------------------------------------------------------------------
// The event shape — Python's field names, Python's value encodings.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LineItem {
    pub resource: String,
    pub quantity: String,
    pub rate: String,
    pub rate_set_ref: String,
    /// A 4-decimal A string, e.g. "0.2000".
    pub charged: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EventBody {
    pub r#type: String,
    pub voucher: String,
    /// Seconds since the epoch as Python's `time.time()` writes it.
    ///
    /// This is a float, and that is deliberate under wire law v1: the live
    /// ledger this crate must verify was written by Python. It is harmless
    /// because `verify_chain` hashes STORED BYTES and never re-serialises —
    /// which is the general form of the defect found in the delivered crate,
    /// where the flattened writer and `canonical()` formatted the same f64
    /// differently and made intact chains report `Tamper`.
    pub ts: f64,
    /// A 4-decimal A string on DEPOSIT, e.g. "5.0000".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vaulta_tx: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_basis_ref: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_items: Option<Vec<LineItem>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Event {
    pub body: EventBody,
    pub prev: String,
    pub hash: String,
}

/// Sorted-key, compact, ASCII-escaped JSON — byte-for-byte what
/// `json.dumps(obj, sort_keys=True, separators=(",", ":"))` produces.
///
/// Sorted keys come free: `serde_json::Value`'s map is a `BTreeMap`, so going
/// through `to_value` orders every object, recursively, exactly as Python's
/// `sort_keys=True` does. The ASCII escaping is applied afterwards because
/// Python's `ensure_ascii` defaults to on and serde_json emits raw UTF-8 —
/// without it, one non-ASCII voucher name would silently fork the two forms.
fn canonical_value(v: &serde_json::Value) -> String {
    ensure_ascii(&serde_json::to_string(v).expect("Value is always serializable"))
}

fn canonical_body(body: &EventBody) -> Result<String, EscrowError> {
    let v = serde_json::to_value(body)
        .map_err(|e| EscrowError::BadAmount(format!("unserializable body: {e}")))?;
    Ok(canonical_value(&v))
}

/// Escape every non-ASCII scalar as `\uXXXX` (surrogate pairs above the BMP),
/// matching Python's `ensure_ascii=True`. Non-ASCII can only occur inside JSON
/// string literals, so a blanket pass over the rendered text is safe.
fn ensure_ascii(s: &str) -> String {
    if s.is_ascii() {
        return s.to_string();
    }
    let mut out = String::with_capacity(s.len() + 8);
    for ch in s.chars() {
        if ch.is_ascii() {
            out.push(ch);
        } else {
            let cp = ch as u32;
            if cp <= 0xFFFF {
                out.push_str(&format!("\\u{cp:04x}"));
            } else {
                let c = cp - 0x1_0000;
                out.push_str(&format!("\\u{:04x}", 0xD800 + (c >> 10)));
                out.push_str(&format!("\\u{:04x}", 0xDC00 + (c & 0x3FF)));
            }
        }
    }
    out
}

fn chain_hash(canon_body: &str, prev: &str) -> String {
    let mut h = Sha256::new();
    h.update(prev.as_bytes());
    h.update(canon_body.as_bytes());
    hex(&h.finalize())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn now() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs_f64()
}

/// Half-up integer division (matches `ROUND_HALF_UP` for non-negative values).
fn div_half_up(num: i128, den: i128) -> i128 {
    if num >= 0 {
        (num + den / 2) / den
    } else {
        -((-num + den / 2) / den)
    }
}

/// Remove one `"key":"value"` pair from a rendered JSON object, returning the
/// value — **by string surgery on the stored bytes**, so that what remains is
/// exactly the bytes that were hashed. Values are hex hashes, so they contain
/// no escapes and the scan is unambiguous; the caller cross-checks the result
/// against a real parse of the same line, which is what makes this safe rather
/// than merely convenient.
fn cut_string_field(s: &mut String, key: &str) -> Option<String> {
    let pat = format!("\"{key}\":\"");
    let k = s.find(&pat)?;
    let vstart = k + pat.len();
    let vend = vstart + s[vstart..].find('"')?;
    let value = s[vstart..vend].to_string();
    let mut cut_start = k;
    let mut cut_end = vend + 1;
    if s[cut_end..].starts_with(',') {
        cut_end += 1;
    } else if cut_start > 0 && s.as_bytes()[cut_start - 1] == b',' {
        cut_start -= 1;
    }
    s.replace_range(cut_start..cut_end, "");
    Some(value)
}

/// The stored body bytes for one line, plus its chain fields.
///
/// THE RULE (founder, 2026-08-29): a chain verifies the bytes it stored. The
/// body is recovered by deleting the two chain fields from the raw line — never
/// by re-serialising a struct — so no serialiser disagreement, float formatting
/// or key ordering can make an honest ledger look tampered.
fn split_stored(line: &str, idx: usize) -> Result<(String, String, String), EscrowError> {
    // parse once, for VALIDATION only — the hash uses the raw bytes below
    let parsed: serde_json::Value = serde_json::from_str(line).map_err(|e| EscrowError::Malformed {
        at_event: idx,
        why: format!("not JSON: {e}"),
    })?;
    let obj = parsed.as_object().ok_or_else(|| EscrowError::Malformed {
        at_event: idx,
        why: "not a JSON object".into(),
    })?;
    let want = |k: &str| -> Result<String, EscrowError> {
        obj.get(k)
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or_else(|| EscrowError::Malformed {
                at_event: idx,
                why: format!("missing string field {k}"),
            })
    };
    let prev_parsed = want("prev")?;
    let hash_parsed = want("hash")?;

    let mut body = line.trim().to_string();
    let prev_cut = cut_string_field(&mut body, "prev");
    let hash_cut = cut_string_field(&mut body, "hash");
    // the surgery must agree with the parse, or we do not trust the surgery
    if prev_cut.as_deref() != Some(prev_parsed.as_str())
        || hash_cut.as_deref() != Some(hash_parsed.as_str())
    {
        return Err(EscrowError::Malformed {
            at_event: idx,
            why: "chain fields could not be located unambiguously in the stored bytes".into(),
        });
    }
    Ok((body, prev_parsed, hash_parsed))
}

// ---------------------------------------------------------------------------
// The escrow: append-only JSONL, balances derived, refuse-before-write.
// ---------------------------------------------------------------------------

pub struct Escrow {
    pub path: PathBuf,
}

impl Escrow {
    pub fn open(path: impl AsRef<Path>) -> Result<Escrow, EscrowError> {
        let path = path.as_ref().to_path_buf();
        if let Some(dir) = path.parent() {
            if !dir.as_os_str().is_empty() {
                std::fs::create_dir_all(dir)?;
            }
        }
        if !path.exists() {
            File::create(&path)?;
        }
        Ok(Escrow { path })
    }

    fn lines(&self) -> Result<Vec<String>, EscrowError> {
        let mut out = Vec::new();
        for line in BufReader::new(File::open(&self.path)?).lines() {
            let line = line?;
            if !line.trim().is_empty() {
                out.push(line);
            }
        }
        Ok(out)
    }

    pub fn events(&self) -> Result<Vec<Event>, EscrowError> {
        let mut out = Vec::new();
        for (i, line) in self.lines()?.into_iter().enumerate() {
            let (_, prev, hash) = split_stored(&line, i)?;
            let body: EventBody =
                serde_json::from_str(&line).map_err(|e| EscrowError::Malformed {
                    at_event: i,
                    why: format!("body does not fit the event shape: {e}"),
                })?;
            out.push(Event { body, prev, hash });
        }
        Ok(out)
    }

    fn tip(&self) -> Result<String, EscrowError> {
        match self.lines()?.last() {
            Some(line) => {
                let (_, _, hash) = split_stored(line, 0)?;
                Ok(hash)
            }
            None => Ok(GENESIS.into()),
        }
    }

    fn append(&self, body: EventBody) -> Result<Event, EscrowError> {
        let prev = self.tip()?;
        let canon = canonical_body(&body)?;
        let hash = chain_hash(&canon, &prev);
        // the stored line is the whole event, sorted-key compact — Python's
        // `json.dumps({**body, "prev":…, "hash":…}, sort_keys=True, …)`
        let mut v = serde_json::to_value(&body)
            .map_err(|e| EscrowError::BadAmount(format!("unserializable body: {e}")))?;
        let obj = v.as_object_mut().expect("body serializes to an object");
        obj.insert("prev".into(), serde_json::Value::String(prev.clone()));
        obj.insert("hash".into(), serde_json::Value::String(hash.clone()));
        let line = canonical_value(&v);
        let mut f = OpenOptions::new().append(true).open(&self.path)?;
        writeln!(f, "{line}")?;
        Ok(Event { body, prev, hash })
    }

    /// Top-up read back from the watch_account: every deposit cites its tx.
    pub fn deposit(
        &self,
        voucher: &str,
        amount: RawA,
        vaulta_tx: &str,
    ) -> Result<Event, EscrowError> {
        if amount.0 <= 0 {
            return Err(EscrowError::BadAmount(amount.to_a_string()));
        }
        if vaulta_tx.is_empty() {
            return Err(EscrowError::EmptyTxRef);
        }
        self.append(EventBody {
            r#type: "DEPOSIT".into(),
            voucher: voucher.into(),
            ts: now(),
            amount: Some(amount.to_a_string()),
            vaulta_tx: Some(vaulta_tx.into()),
            cost_basis_ref: None,
            line_items: None,
        })
    }

    /// Derived from events. There is no stored balance to corrupt.
    pub fn balance(&self, voucher: &str) -> Result<RawA, EscrowError> {
        let mut bal: i128 = 0;
        for ev in self.events()? {
            if ev.body.voucher != voucher {
                continue;
            }
            match ev.body.r#type.as_str() {
                "DEPOSIT" => {
                    if let Some(a) = ev.body.amount.as_deref() {
                        bal += RawA::parse(a)?.0;
                    }
                }
                "CHARGE" => {
                    for li in ev.body.line_items.as_deref().unwrap_or(&[]) {
                        bal -= RawA::parse(&li.charged)?.0;
                    }
                }
                _ => {}
            }
        }
        Ok(RawA(bal))
    }

    /// Meter usage against the voucher. Refuses BEFORE writing if the total
    /// (incl. tithe) exceeds balance. The tithe is a DISTINCT line, produced
    /// only here — callers cannot submit or price it (type-enforced).
    pub fn charge(
        &self,
        voucher: &str,
        usage: &[(Meterable, i128)],
        rs: &RateSet,
    ) -> Result<Event, EscrowError> {
        if usage.is_empty() {
            return Err(EscrowError::EmptyUsage);
        }
        let mut items = Vec::with_capacity(usage.len() + 1);
        let mut subtotal: i128 = 0;
        for &(res, qty) in usage {
            if qty <= 0 {
                return Err(EscrowError::NonPositiveQuantity);
            }
            let rate = rs.rate(res)?;
            let charged = rate.charge_raw(qty)?;
            subtotal += charged;
            items.push(LineItem {
                resource: res.as_str().into(),
                quantity: qty.to_string(),
                rate: rate.as_str().into(),
                rate_set_ref: rs.version.clone(),
                charged: RawA(charged).to_a_string(),
            });
        }
        // THE TITHE — 10% on cost basis, a distinct line on every receipt.
        let tithe = div_half_up(subtotal * TITHE_NUM, TITHE_DEN);
        items.push(LineItem {
            resource: "tithe.founder".into(),
            quantity: "1".into(),
            rate: TITHE_RATE_TEXT.into(),
            rate_set_ref: rs.version.clone(),
            charged: RawA(tithe).to_a_string(),
        });
        let total = RawA(subtotal + tithe);
        let bal = self.balance(voucher)?;
        if total > bal {
            return Err(EscrowError::InsufficientVoucher {
                needed: total,
                balance: bal,
            });
        }
        self.append(EventBody {
            r#type: "CHARGE".into(),
            voucher: voucher.into(),
            ts: now(),
            amount: None,
            vaulta_tx: None,
            cost_basis_ref: Some(rs.cost_basis_ref.clone()),
            line_items: Some(items),
        })
    }

    /// Walk the chain, hashing the STORED BYTES of each body.
    ///
    /// Nothing is re-serialised here. That is the whole point: a chain that
    /// verifies a re-derived rendering is really testing that two serialisers
    /// agree, which is a property no format guarantees — and when they
    /// disagreed by one digit of a float, this engine called its own intact
    /// ledger tampered.
    pub fn verify_chain(&self) -> Result<usize, EscrowError> {
        let mut prev = GENESIS.to_string();
        let lines = self.lines()?;
        for (i, line) in lines.iter().enumerate() {
            let (body_bytes, stored_prev, stored_hash) = split_stored(line, i)?;
            if stored_prev != prev || chain_hash(&body_bytes, &prev) != stored_hash {
                return Err(EscrowError::Tamper { at_event: i });
            }
            prev = stored_hash;
        }
        Ok(lines.len())
    }
}

/// The one true total: computed from line items every time, never stored.
pub fn receipt_total(ev: &Event) -> RawA {
    RawA(
        ev.body
            .line_items
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .map(|li| RawA::parse(&li.charged).map(|r| r.0).unwrap_or(0))
            .sum(),
    )
}

pub fn receipt_tithe(ev: &Event) -> RawA {
    RawA(
        ev.body
            .line_items
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .filter(|li| li.resource == "tithe.founder")
            .map(|li| RawA::parse(&li.charged).map(|r| r.0).unwrap_or(0))
            .sum(),
    )
}

// ===========================================================================
// The conformance battery — the same proofs as the Python reference.
// ===========================================================================
#[cfg(test)]
mod tests {
    use super::*;

    fn fresh(name: &str) -> Escrow {
        let p = std::env::temp_dir().join(format!(
            "voucher-escrow-{name}-{}.jsonl",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&p);
        Escrow::open(p).unwrap()
    }

    fn rs() -> RateSet {
        RateSet::new(
            "rate_set-2026-08-29-v1",
            "anthropic-posted-2026-08",
            vec![
                (Meterable::PrefillToken, Rate::parse("0.00002").unwrap()),
                (Meterable::DecodeToken, Rate::parse("0.0001").unwrap()),
            ],
        )
    }

    #[test]
    fn conformance_battery() {
        let es = fresh("battery");
        let rs = rs();

        // 1. deposit refuses without a cited vaulta_tx
        assert!(matches!(
            es.deposit("member-abc", RawA::parse("5.0").unwrap(), ""),
            Err(EscrowError::EmptyTxRef)
        ));

        // 2. deposit recorded, tx-cited, money on the wire as a 4dp A string
        let d = es
            .deposit("member-abc", RawA::parse("5.0").unwrap(), "6eddf2c1demo")
            .unwrap();
        assert_eq!(d.body.vaulta_tx.as_deref(), Some("6eddf2c1demo"));
        assert_eq!(d.body.amount.as_deref(), Some("5.0000"));

        // 3. balance derived
        assert_eq!(es.balance("member-abc").unwrap(), RawA::parse("5.0").unwrap());

        // 4. a charge meters at the posted basis and carries the tithe line
        let c = es
            .charge(
                "member-abc",
                &[
                    (Meterable::PrefillToken, 100_000),
                    (Meterable::DecodeToken, 20_000),
                ],
                &rs,
            )
            .unwrap();
        // 100000 * 0.00002 = 2.0000 ; 20000 * 0.0001 = 2.0000 ; tithe = 0.4000
        assert_eq!(receipt_total(&c), RawA::parse("4.4").unwrap());
        assert_eq!(receipt_tithe(&c), RawA::parse("0.4").unwrap());

        // 5. the tithe is a DISTINCT line, priced by the engine
        let items = c.body.line_items.as_deref().unwrap();
        let tithe_line = items.iter().find(|li| li.resource == "tithe.founder").unwrap();
        assert_eq!(tithe_line.rate, "0.10");
        assert_eq!(tithe_line.charged, "0.4000");

        // 6. totals are COMPUTED — never a stored field on the event
        assert!(!serde_json::to_string(&c.body).unwrap().contains("\"total\""));

        // 7. balance follows
        assert_eq!(es.balance("member-abc").unwrap(), RawA::parse("0.6").unwrap());

        // 8. REFUSE-BEFORE-WRITE: an over-balance charge writes nothing
        let before = std::fs::read_to_string(&es.path).unwrap();
        assert!(matches!(
            es.charge("member-abc", &[(Meterable::DecodeToken, 1_000_000)], &rs),
            Err(EscrowError::InsufficientVoucher { .. })
        ));
        assert_eq!(std::fs::read_to_string(&es.path).unwrap(), before);

        // 9. a meterable with no rate in THIS set refuses (the unknown-class
        //    case proper is a compile error — Meterable is closed)
        assert!(matches!(
            es.charge("member-abc", &[(Meterable::ChainFee, 1)], &rs),
            Err(EscrowError::NoRate(Meterable::ChainFee))
        ));

        // 10. the chain verifies, then a single edited byte breaks it
        assert_eq!(es.verify_chain().unwrap(), 2);
        let text = std::fs::read_to_string(&es.path).unwrap();
        let mut lines: Vec<String> = text.lines().map(String::from).collect();
        lines[1] = lines[1].replacen("\"charged\":\"2.0000\"", "\"charged\":\"0.0001\"", 1);
        std::fs::write(&es.path, lines.join("\n") + "\n").unwrap();
        assert!(matches!(
            es.verify_chain(),
            Err(EscrowError::Tamper { at_event: 1 })
        ));
    }

    #[test]
    fn money_is_exact_integer() {
        assert_eq!(RawA::parse("5.0").unwrap(), RawA(50_000));
        assert_eq!(RawA::parse("0.4400").unwrap(), RawA(4_400));
        assert_eq!(RawA::parse("0.0001").unwrap(), RawA(1));
        assert!(RawA::parse("0.00001").is_err()); // beyond A precision: refused
        assert_eq!(RawA(4_400).to_a_string(), "0.4400");
        assert_eq!(RawA(50_000).to_a_string(), "5.0000");
    }

    #[test]
    fn rates_are_exact_and_round_half_up() {
        let r = Rate::parse("0.00002").unwrap();
        assert_eq!(r.charge_raw(100_000).unwrap(), 20_000); // 2.0000 A
        assert_eq!(r.as_str(), "0.00002"); // the literal survives to the wire
                                           // half-up at the A boundary
        let h = Rate::parse("0.00005").unwrap();
        assert_eq!(h.charge_raw(1).unwrap(), 1); // 0.00005 → 0.0001
        assert!(Rate::parse("abc").is_err());
    }

    /// WIRE LAW v1 · canonicalisation. The bytes must be sorted-key, compact
    /// and ASCII-escaped — i.e. exactly `json.dumps(sort_keys=True,
    /// separators=(",", ":"))`. Declaration order (what the delivered crate
    /// used) hashes the same event differently and forks the two forms.
    #[test]
    fn canonicalisation_is_sorted_keys_compact_and_ascii_escaped() {
        let body = EventBody {
            r#type: "DEPOSIT".into(),
            voucher: "caf\u{e9}".into(), // non-ASCII: Python escapes it
            ts: 1.5,
            amount: Some("5.0000".into()),
            vaulta_tx: Some("tx".into()),
            cost_basis_ref: None,
            line_items: None,
        };
        let c = canonical_body(&body).unwrap();
        assert_eq!(
            c,
            r#"{"amount":"5.0000","ts":1.5,"type":"DEPOSIT","vaulta_tx":"tx","voucher":"caf\u00e9"}"#
        );
        assert!(c.is_ascii(), "ensure_ascii must hold: {c}");
    }

    /// REGRESSION for the whole float/format class. A chain verifies the bytes
    /// it stored, so verification must not depend on any re-rendering. This
    /// writes many events (the original defect only surfaced on timestamps
    /// needing 17 significant digits) and checks the chain every time.
    #[test]
    fn verification_uses_stored_bytes_and_survives_float_timestamps() {
        let es = fresh("bytes");
        let rs = rs();
        es.deposit("m", RawA::parse("100.0").unwrap(), "tx1").unwrap();
        for _ in 0..40 {
            es.charge("m", &[(Meterable::PrefillToken, 1_000)], &rs).unwrap();
        }
        assert_eq!(es.verify_chain().unwrap(), 41);

        // every stored line must re-verify from its own bytes, and the body we
        // hash must be the line minus exactly the two chain fields
        for (i, line) in std::fs::read_to_string(&es.path).unwrap().lines().enumerate() {
            let (body, prev, hash) = split_stored(line, i).unwrap();
            assert_eq!(chain_hash(&body, &prev), hash, "event {i}");
            assert!(!body.contains("\"prev\""));
            assert!(!body.contains("\"hash\""));
        }
    }

    /// A ledger written by the OTHER form must verify here. The fixture below
    /// was produced by `scripts/buzz-meter/voucher_escrow.py` — see
    /// `tests/python_ledger.rs` for the live-format proof.
    #[test]
    fn a_python_written_line_verifies_against_stored_bytes() {
        // one DEPOSIT event exactly as the Python reference writes it
        // PUBLIC-CONSTANT: the prev field is the GENESIS sentinel (32 zero bytes),
        // the same structural constant declared at the top of this file.
        let line = r#"{"amount":"5.0000","hash":"REPLACED","prev":"0000000000000000000000000000000000000000000000000000000000000000","ts":1787995204.5123239,"type":"DEPOSIT","vaulta_tx":"tx1","voucher":"m"}"#; // PUBLIC-CONSTANT
        // compute what the hash must be, then assert the engine agrees
        let mut body = line.to_string();
        let _ = cut_string_field(&mut body, "prev");
        let _ = cut_string_field(&mut body, "hash");
        let want = chain_hash(&body, GENESIS);
        let real = line.replace("REPLACED", &want);
        let p = std::env::temp_dir().join(format!("voucher-escrow-py-{}.jsonl", std::process::id()));
        std::fs::write(&p, real + "\n").unwrap();
        let es = Escrow::open(&p).unwrap();
        assert_eq!(es.verify_chain().unwrap(), 1);
        assert_eq!(es.balance("m").unwrap(), RawA::parse("5.0").unwrap());

        // THE RULING, PROVEN. This fixture carries a NON-SHORTEST float —
        // 1787995204.5123239, which is what the old flattened Rust writer
        // emitted and which no shortest-round-trip serialiser (Python's repr,
        // Rust's ryu) would ever write: read back and re-rendered it becomes
        // 1787995204.512324. Under the old scheme that one digit made an
        // intact chain report Tamper. Under wire law v1 the chain verified
        // above anyway, because verification hashes the STORED BYTES.
        let ts_read = es.events().unwrap()[0].body.ts;
        assert_ne!(
            serde_json::to_string(&ts_read).unwrap(),
            "1787995204.5123239",
            "the fixture must genuinely NOT round-trip, or it proves nothing"
        );
        let restored = canonical_body(&es.events().unwrap()[0].body).unwrap();
        let mut stored = std::fs::read_to_string(&p).unwrap().trim().to_string();
        let _ = cut_string_field(&mut stored, "prev");
        let _ = cut_string_field(&mut stored, "hash");
        assert_ne!(
            restored, stored,
            "re-serialising must differ from the stored bytes here — that is the trap"
        );
        // …and the chain still verifies, which is the entire point of rule 3
        assert_eq!(es.verify_chain().unwrap(), 1);
    }
}
