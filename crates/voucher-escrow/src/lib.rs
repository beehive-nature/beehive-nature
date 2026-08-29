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
//! compute, kernel form. Seat-1 delivered this as `escrow-core`; it is landed
//! under a different name because `crates/escrow-core` ALREADY EXISTS in this
//! tree and is an entirely different thing — the bNature escrow STATE MACHINE
//! (buyer/seller/dispute lifecycle, build brief §9.1–9.2). Two crates, two
//! jobs, one namespace: this one is the money, that one is the lifecycle.
//! Nothing else about the delivered crate was changed.
//!
//! **THE CONFORMANCE BATTERY BELOW IS THE GRADUATION CRITERION.** The same ten
//! proofs run here and in the Python reference (voucher_escrow.py) — two forms,
//! one law, one test suite. ANY future port of this engine, in any language,
//! graduates only by passing this battery unmodified. A port that needs the
//! tests softened has not been ported; it has been replaced.
//!
//! Built for 10^10 users × 1000 years. The gold-standard moves over the Python
//! reference implementation:
//!
//! 1. **INTEGER MONEY.** Amounts are `i128` raw units (1 A = 10_000 raw), the same
//!    representation Antelope itself uses on-chain. No floats, no decimal crate,
//!    no rounding drift — arithmetic is exact for the life of the ledger.
//! 2. **UNKNOWN RESOURCE CLASSES ARE UNREPRESENTABLE.** `Meterable` is a closed
//!    enum; a caller cannot submit a resource that was not added by ruling. The
//!    tithe line is produced only internally — no caller can forge or price it.
//!    (The Python version refuses at runtime; here the program does not compile.)
//! 3. **REFUSE-BEFORE-WRITE.** An over-balance charge returns
//!    `Err(InsufficientVoucher)` having appended nothing.
//! 4. **APPEND-ONLY, HASH-CHAINED.** Every event carries the hash of its
//!    predecessor; `verify_chain` catches a single edited byte.
//! 5. **TOTALS ARE COMPUTED, NEVER STORED.** `receipt_total` derives from line
//!    items every time; the headline number cannot drift from the breakdown.
//! 6. **THE TITHE: 10%, a distinct line on every receipt.** Founder-ruled;
//!    the constant never moves without his word.
//!
//! License: BSL 1.1 — Licensor Travis Mark Remington <lovis@skaists.dev>,
//! Change Date 2030-08-29 → GPL-2.0-or-later.

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
// PUBLIC-CONSTANT: the genesis link of the hash chain — 32 zero bytes in hex.
// It is a fixed structural sentinel, not a key, a seed, or a vector: every
// ledger in every deployment starts here, and it is printed in the format spec.
const GENESIS: &str = "0000000000000000000000000000000000000000000000000000000000000000"; // PUBLIC-CONSTANT

// ---------------------------------------------------------------------------
// Money: integer raw units, exact forever.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct RawA(pub i128);

impl RawA {
    /// Parse "5.0" / "0.4400" → raw units. Rejects >4 decimals and junk.
    pub fn parse(s: &str) -> Result<RawA, EscrowError> {
        let (int, frac) = match s.split_once('.') {
            Some((i, f)) => (i, f),
            None => (s, ""),
        };
        if frac.len() > 4 {
            return Err(EscrowError::BadAmount(s.into()));
        }
        let int: i128 = int.parse().map_err(|_| EscrowError::BadAmount(s.into()))?;
        let frac_padded = format!("{:0<4}", frac);
        let frac: i128 = if frac.is_empty() {
            0
        } else {
            frac_padded
                .parse()
                .map_err(|_| EscrowError::BadAmount(s.into()))?
        };
        Ok(RawA(int * RAW_PER_A + frac))
    }
    pub fn to_a_string(self) -> String {
        format!("{}.{:04}", self.0 / RAW_PER_A, (self.0 % RAW_PER_A).abs())
    }
}

impl fmt::Display for RawA {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} A", self.to_a_string())
    }
}

// ---------------------------------------------------------------------------
// Resources: a CLOSED enum. An unlisted class is added BY RULING — a caller
// passing a free string is a compile error, not a runtime check.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Meterable {
    #[serde(rename = "llm.tokens.in")]
    LlmTokensIn,
    #[serde(rename = "llm.tokens.out")]
    LlmTokensOut,
    #[serde(rename = "vram.byte_seconds")]
    VramByteSeconds,
    #[serde(rename = "cpu.seconds")]
    CpuSeconds,
    #[serde(rename = "net.bytes")]
    NetBytes,
}

/// Versioned pricing law. Rates in raw units per 1_000_000 resource units —
/// integer, exact, sub-raw precision without floats.
#[derive(Debug, Clone)]
pub struct RateSet {
    pub version: String,
    pub cost_basis_ref: String,
    rates: Vec<(Meterable, i128)>, // (resource, raw units per 1e6 units)
}

impl RateSet {
    pub fn new(version: &str, cost_basis_ref: &str, rates: Vec<(Meterable, i128)>) -> Self {
        RateSet {
            version: version.into(),
            cost_basis_ref: cost_basis_ref.into(),
            rates,
        }
    }
    fn rate_ppm(&self, r: Meterable) -> Result<i128, EscrowError> {
        self.rates
            .iter()
            .find(|(m, _)| *m == r)
            .map(|(_, v)| *v)
            .ok_or(EscrowError::NoRate(r))
    }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub enum EscrowError {
    BadAmount(String),
    EmptyTxRef,
    EmptyUsage,
    NonPositiveQuantity,
    NoRate(Meterable),
    /// Charge exceeds balance. NOTHING was written.
    InsufficientVoucher {
        needed: RawA,
        balance: RawA,
    },
    Tamper {
        at_event: usize,
    },
    Io(std::io::Error),
}

impl fmt::Display for EscrowError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EscrowError::BadAmount(s) => write!(f, "bad amount: {s}"),
            EscrowError::EmptyTxRef => write!(f, "deposit requires a vaulta_tx reference"),
            EscrowError::EmptyUsage => write!(f, "empty usage"),
            EscrowError::NonPositiveQuantity => write!(f, "quantity must be positive"),
            EscrowError::NoRate(r) => write!(f, "no rate for {r:?} in rate set"),
            EscrowError::InsufficientVoucher { needed, balance } => write!(
                f,
                "charge {needed} exceeds voucher balance {balance} — refused, nothing written"
            ),
            EscrowError::Tamper { at_event } => write!(f, "chain broken at event {at_event}"),
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
// Ledger events. Amounts serialize as strings (exact, language-portable).
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineItem {
    pub resource: String, // meterable rename OR "tithe.founder" (internal only)
    pub quantity: String,
    pub rate: String, // raw units per 1e6 resource units; tithe: "10/100"
    pub rate_set_ref: String,
    pub charged: String, // raw units
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBody {
    pub r#type: String, // "DEPOSIT" | "CHARGE"
    pub voucher: String,
    /// Microseconds since the Unix epoch, as an INTEGER.
    ///
    /// This was an `f64` as delivered, and it made the hash chain unverifiable:
    /// the flattened write path and `canonical()` formatted the SAME f64
    /// differently (…1703103 on disk vs …1703105 re-serialised), so
    /// `verify_chain` reported `Tamper` on chains that were provably intact —
    /// checked by recomputing the whole chain with an independent
    /// implementation, which verified every event. It looked intermittent only
    /// because it depended on how many significant digits that particular
    /// microsecond needed.
    ///
    /// A float has no business in a ledger whose first stated principle is
    /// INTEGER MONEY. Integers round-trip exactly through every serialiser,
    /// which is the property a hash chain actually requires.
    ///
    /// WIRE-FORMAT CHANGE — the Python reference (voucher_escrow.py) MUST make
    /// the same move, or the two forms stop sharing a format and the
    /// conformance battery stops meaning anything. Two forms, one law.
    pub ts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<String>, // raw units, DEPOSIT only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vaulta_tx: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_basis_ref: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_items: Option<Vec<LineItem>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Event {
    #[serde(flatten)]
    pub body: EventBody,
    pub prev: String,
    pub hash: String,
}

/// Deserialised BY HAND, and this is not decoration — it is the fix for a
/// defect that made the engine call its own honest ledger tampered.
///
/// `#[serde(flatten)]` is correct on the WRITE side (the on-disk shape below
/// is exactly what it produces). On the READ side it buffers every field
/// through serde's `Content` before handing them over, and that buffering
/// **loses f64 precision**: a timestamp written as
///
/// ```text
/// "ts":1787995204.5123239        (17 significant digits)
/// ```
///
/// came back as `1787995204.512324`, so `canonical()` re-serialised a
/// DIFFERENT string, the recomputed hash missed, and `verify_chain` reported
/// `Tamper` on a chain that was provably intact — confirmed by recomputing the
/// whole chain with an independent implementation, which verified all six
/// events. Timestamps whose shortest form needs only 16 digits survived, which
/// is why it looked intermittent rather than broken: it depended on the
/// microsecond the event happened to land on.
///
/// Splitting `prev`/`hash` off by hand and deserialising the body directly
/// keeps the on-disk format BYTE-IDENTICAL — the Python reference and this
/// crate still read and write the same lines — while making the round-trip
/// exact. The alternative fixes both changed the wire format, which would have
/// broken the shared conformance battery that is the whole point.
impl<'de> Deserialize<'de> for Event {
    fn deserialize<D>(d: D) -> Result<Event, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        use serde::de::Error as _;
        let mut v = serde_json::Value::deserialize(d)?;
        let obj = v
            .as_object_mut()
            .ok_or_else(|| D::Error::custom("an event must be a JSON object"))?;
        let prev = match obj.remove("prev") {
            Some(serde_json::Value::String(s)) => s,
            _ => return Err(D::Error::custom("event is missing its prev hash")),
        };
        let hash = match obj.remove("hash") {
            Some(serde_json::Value::String(s)) => s,
            _ => return Err(D::Error::custom("event is missing its own hash")),
        };
        let body: EventBody = serde_json::from_value(v).map_err(D::Error::custom)?;
        Ok(Event { body, prev, hash })
    }
}

fn canonical(body: &EventBody) -> String {
    // serde_json's default map is BTreeMap-backed → sorted keys → deterministic.
    serde_json::to_string(body).expect("serializable")
}

fn chain_hash(body: &EventBody, prev: &str) -> String {
    let mut h = Sha256::new();
    h.update(prev.as_bytes());
    h.update(canonical(body).as_bytes());
    hex(&h.finalize())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Microseconds since the epoch, integer. Exact, and it round-trips.
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_micros() as i64
}

/// Half-up integer division.
fn div_half_up(num: i128, den: i128) -> i128 {
    (num + den / 2) / den
}

// ---------------------------------------------------------------------------
// The escrow: append-only JSONL, balances derived, refuse-before-write.
// ---------------------------------------------------------------------------

pub struct Escrow {
    path: PathBuf,
}

impl Escrow {
    pub fn open(path: impl AsRef<Path>) -> Result<Escrow, EscrowError> {
        let path = path.as_ref().to_path_buf();
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        if !path.exists() {
            File::create(&path)?;
        }
        Ok(Escrow { path })
    }

    fn events(&self) -> Result<Vec<Event>, EscrowError> {
        let mut out = Vec::new();
        for line in BufReader::new(File::open(&self.path)?).lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            out.push(
                serde_json::from_str(&line).map_err(|_| EscrowError::Tamper {
                    at_event: out.len(),
                })?,
            );
        }
        Ok(out)
    }

    fn tip(&self) -> Result<String, EscrowError> {
        Ok(self
            .events()?
            .last()
            .map(|e| e.hash.clone())
            .unwrap_or_else(|| GENESIS.into()))
    }

    fn append(&self, body: EventBody) -> Result<Event, EscrowError> {
        let prev = self.tip()?;
        let hash = chain_hash(&body, &prev);
        let ev = Event { body, prev, hash };
        let mut f = OpenOptions::new().append(true).open(&self.path)?;
        writeln!(f, "{}", serde_json::to_string(&ev).expect("serializable"))?;
        Ok(ev)
    }

    /// Top-up read back from the watch_account: every deposit cites its Vaulta tx.
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
            amount: Some(amount.0.to_string()),
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
                    bal += ev
                        .body
                        .amount
                        .as_deref()
                        .unwrap_or("0")
                        .parse::<i128>()
                        .unwrap_or(0)
                }
                "CHARGE" => {
                    for li in ev.body.line_items.as_deref().unwrap_or(&[]) {
                        bal -= li.charged.parse::<i128>().unwrap_or(0);
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
            let ppm = rs.rate_ppm(res)?;
            let charged = div_half_up(qty * ppm, 1_000_000);
            subtotal += charged;
            items.push(LineItem {
                resource: serde_json::to_value(res).unwrap().as_str().unwrap().into(),
                quantity: qty.to_string(),
                rate: ppm.to_string(),
                rate_set_ref: rs.version.clone(),
                charged: charged.to_string(),
            });
        }
        // THE TITHE — 10% on cost basis, a distinct line on every receipt.
        let tithe = div_half_up(subtotal * TITHE_NUM, TITHE_DEN);
        items.push(LineItem {
            resource: "tithe.founder".into(),
            quantity: "1".into(),
            rate: format!("{TITHE_NUM}/{TITHE_DEN}"),
            rate_set_ref: rs.version.clone(),
            charged: tithe.to_string(),
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

    /// Walk the chain; a single edited byte fails verification.
    pub fn verify_chain(&self) -> Result<usize, EscrowError> {
        let mut prev = GENESIS.to_string();
        let evs = self.events()?;
        for (i, ev) in evs.iter().enumerate() {
            if ev.prev != prev || chain_hash(&ev.body, &prev) != ev.hash {
                return Err(EscrowError::Tamper { at_event: i });
            }
            prev = ev.hash.clone();
        }
        Ok(evs.len())
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
            .map(|li| li.charged.parse::<i128>().unwrap_or(0))
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
            .map(|li| li.charged.parse::<i128>().unwrap_or(0))
            .sum(),
    )
}

// ===========================================================================
// The conformance battery — the same ten proofs as the Python reference.
// ===========================================================================
#[cfg(test)]
mod tests {
    use super::*;

    fn fresh(name: &str) -> Escrow {
        let p =
            std::env::temp_dir().join(format!("escrow-core-{name}-{}.jsonl", std::process::id()));
        let _ = std::fs::remove_file(&p);
        Escrow::open(p).unwrap()
    }

    fn rs() -> RateSet {
        RateSet::new(
            "rate_set-2026-08-29-v1",
            "anthropic-posted-2026-08",
            vec![
                (Meterable::LlmTokensIn, 20_000),   // 0.000002 A/token
                (Meterable::LlmTokensOut, 100_000), // 0.000010 A/token
                (Meterable::VramByteSeconds, 1),
            ],
        )
    }

    #[test]
    fn conformance_battery() {
        let es = fresh("battery");
        let rs = rs();

        // 1. deposit refuses without vaulta_tx
        assert!(matches!(
            es.deposit("member-abc", RawA::parse("5.0").unwrap(), ""),
            Err(EscrowError::EmptyTxRef)
        ));

        // 2. deposit recorded, tx-cited
        let d = es
            .deposit("member-abc", RawA::parse("5.0").unwrap(), "6eddf2c1demo")
            .unwrap();
        assert_eq!(d.body.vaulta_tx.as_deref(), Some("6eddf2c1demo"));

        // 3. balance derived = 5.0000 A
        assert_eq!(es.balance("member-abc").unwrap(), RawA(50_000));

        // 4. charge metered: 100k in + 20k out → 0.4000 cost + 0.0400 tithe = 0.4400 A
        let r = es
            .charge(
                "member-abc",
                &[
                    (Meterable::LlmTokensIn, 100_000),
                    (Meterable::LlmTokensOut, 20_000),
                ],
                &rs,
            )
            .unwrap();
        assert_eq!(receipt_total(&r), RawA(4_400));
        assert_eq!(receipt_tithe(&r), RawA(400));
        let items = r.body.line_items.as_ref().unwrap();
        assert!(items.iter().any(|li| li.resource == "tithe.founder"));
        assert!(items
            .iter()
            .all(|li| !li.rate_set_ref.is_empty() && !li.rate.is_empty()));

        // 5. balance after charge = 4.5600 A
        assert_eq!(es.balance("member-abc").unwrap(), RawA(45_600));

        // 6. REFUSE-BEFORE-WRITE: over-balance charge leaves ledger byte-identical
        let before = std::fs::read(&es.path).unwrap();
        let err = es
            .charge("member-abc", &[(Meterable::LlmTokensOut, 5_000_000)], &rs)
            .unwrap_err();
        assert!(matches!(err, EscrowError::InsufficientVoucher { .. }));
        assert_eq!(
            std::fs::read(&es.path).unwrap(),
            before,
            "ledger changed on refusal"
        );

        // 7. stolen-key ceiling: drain to hard stop; blast radius = the voucher
        let mut drained = 0;
        while es
            .charge("member-abc", &[(Meterable::LlmTokensOut, 100_000)], &rs)
            .is_ok()
        {
            drained += 1;
        }
        assert_eq!(drained, 4);
        assert!(es.balance("member-abc").unwrap() < RawA(11_000)); // < 1.1 A

        // 8. unknown resource class: UNREPRESENTABLE — `Meterable` is a closed
        //    enum, so a caller cannot construct a "magic.beans" usage entry.
        //    The Python runtime refusal became a Rust compile error. (The
        //    weaker runtime case that CAN occur — a meterable with no rate in
        //    this rate set — still refuses:)
        assert!(matches!(
            es.charge("member-abc", &[(Meterable::NetBytes, 1)], &rs),
            Err(EscrowError::NoRate(Meterable::NetBytes))
        ));

        // 9. hash chain verifies clean
        let n = es.verify_chain().unwrap();
        assert_eq!(n, 6);

        // 10. tamper: shrink one bill by one byte → chain breaks at that event
        let text = std::fs::read_to_string(&es.path).unwrap();
        let mut lines: Vec<String> = text.lines().map(String::from).collect();
        lines[1] = lines[1].replacen("\"charged\":\"2000\"", "\"charged\":\"0001\"", 1);
        std::fs::write(&es.path, lines.join("\n") + "\n").unwrap();
        assert!(matches!(
            es.verify_chain(),
            Err(EscrowError::Tamper { at_event: 1 })
        ));
    }

    /// REGRESSION (the f64 timestamp defect). The chain's whole premise is
    /// that a body re-serialises to exactly the bytes it was hashed over. This
    /// asserts that invariant directly against the file, so ANY future
    /// serialisation drift — a new field, another float, a serde change —
    /// fails here loudly instead of surfacing as a phantom "Tamper" on an
    /// honest ledger.
    #[test]
    fn a_body_read_back_reserialises_to_the_bytes_it_was_hashed_over() {
        let es = fresh("roundtrip");
        let rs = rs();
        es.deposit("m", RawA::parse("5.0").unwrap(), "tx1").unwrap();
        // many events: the defect only showed on timestamps needing 17 digits
        for _ in 0..25 {
            es.charge("m", &[(Meterable::LlmTokensIn, 1_000)], &rs)
                .unwrap();
        }
        let text = std::fs::read_to_string(&es.path).unwrap();
        for (i, line) in text.lines().enumerate() {
            let ev: Event = serde_json::from_str(line).unwrap();
            let reser = serde_json::to_string(&ev.body).unwrap();
            // the RAW bytes, sliced off the stored line. Not a Value
            // round-trip: serde_json::Value is a BTreeMap and would sort the
            // keys, which would compare a different string than the one the
            // hash was actually taken over.
            let cut = line.find(",\"prev\":").expect("stored event carries prev");
            let body_on_disk = format!("{}}}", &line[..cut]);
            assert_eq!(
                reser, body_on_disk,
                "event {i}: the body does not re-serialise to its own stored bytes"
            );
        }
        // and the chain therefore verifies, every event, every time
        assert_eq!(es.verify_chain().unwrap(), 26);
    }

    #[test]
    fn money_is_exact_integer() {
        assert_eq!(RawA::parse("5.0").unwrap(), RawA(50_000));
        assert_eq!(RawA::parse("0.4400").unwrap(), RawA(4_400));
        assert_eq!(RawA::parse("0.0001").unwrap(), RawA(1));
        assert!(RawA::parse("0.00001").is_err()); // beyond A precision: refused
        assert_eq!(RawA(4_400).to_a_string(), "0.4400");
    }
}
