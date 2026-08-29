//! Rust conformance core for the voucher/escrow engine — the same laws as
//! `scripts/buzz-meter/voucher_escrow.py`, proven by the ported 16-proof
//! battery (`tests/conformance.rs`). Pure logic: no I/O, no ambient clock
//! (time enters as an explicit `ts`), integer fixed-point money throughout.
//!
//! Laws (the ruled record):
//! - A-denominated; line items carry exact quantity, explicit rate, versioned
//!   rate_set_ref, charged amount. Totals are COMPUTED, never stored.
//! - THE TITHE: 10% on top of cost basis, a DISTINCT line on every receipt.
//! - Append-only, hash-chained ledger; balances derived, never stored.
//! - Refuse-before-write: an over-balance charge writes NOTHING.
//! - Deposits cite their tx; USDC deposits additionally cite the conversion
//!   rate and where it was read (rate_ref). Dust refused.
//! - The A rail is memo-native (sender + memo recorded when given, no binding
//!   table); the USDC/Base rail resolves the payer by binding table — the
//!   rails are NOT symmetric (founder rider, 2026-08-29).
//!
//! Money representation: `Quatch` = 1e-4 A (u128), matching Vaulta A's
//! 4-decimal asset precision and the Python engine's quantization. USDC
//! arrives as 1e-6 units; rates carry 8 decimal places (`rate_fp8`).

#![forbid(unsafe_code)]

use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};

pub const TITHE_RATE_FP8: u128 = 100_000; // 10% — founder-ruled, never moves without his word
pub const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000"; // PUBLIC-CONSTANT: 64 zeros, the chain's genesis sentinel

/// The CLOSED resource enum — the estate's one set (SPEC-SPEND-RECEIPT-1 +
/// the Lane M dispatch). An unlisted class is added BY RULING, never by a caller.
pub const RESOURCE_CLASSES: &[&str] = &[
    "mesh_second",
    "vram_byte_second",
    "ram_byte",
    "cpu_microsecond",
    "net_byte",
    "chunk_count",
    "storage_byte",
    "chain_fee",
    "prefill_token",
    "decode_token",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VoucherError {
    UnknownResourceClass(String),
    NoRate(String, String),
    NonPositive(&'static str),
    MissingRef(&'static str),
    DustRefused,
    InsufficientVoucher { total: String, balance: String },
    Tamper(usize),
}

impl std::fmt::Display for VoucherError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VoucherError::UnknownResourceClass(c) => write!(f, "unknown resource class(es): {c}"),
            VoucherError::NoRate(r, v) => write!(f, "no rate for '{r}' in rate_set {v}"),
            VoucherError::NonPositive(what) => write!(f, "{what} must be positive"),
            VoucherError::MissingRef(what) => write!(f, "deposit requires {what}"),
            VoucherError::DustRefused => write!(f, "credited A rounds to zero — deposit too small"),
            VoucherError::InsufficientVoucher { total, balance } => write!(
                f,
                "charge {total} A exceeds voucher balance {balance} A — refused, nothing written"
            ),
            VoucherError::Tamper(n) => write!(f, "chain broken at event {n}"),
        }
    }
}

pub type Result<T> = std::result::Result<T, VoucherError>;

/// round-half-up division: (num / den) with .5 biasing away from zero (all values non-negative here)
fn div_half_up(num: u128, den: u128) -> u128 {
    (num + den / 2) / den
}

/// Versioned pricing law over the closed enum. `rates_fp8`: resource → A per unit at 1e-8.
#[derive(Debug, Clone)]
pub struct RateSet {
    pub version: String,
    pub cost_basis_ref: String,
    pub rates_fp8: Vec<(&'static str, u128)>,
}

impl RateSet {
    pub fn new(
        version: &str,
        cost_basis_ref: &str,
        rates: Vec<(&'static str, u128)>,
    ) -> Result<Self> {
        for (class, _) in &rates {
            if !RESOURCE_CLASSES.contains(class) {
                return Err(VoucherError::UnknownResourceClass(class.to_string()));
            }
        }
        Ok(Self {
            version: version.into(),
            cost_basis_ref: cost_basis_ref.into(),
            rates_fp8: rates,
        })
    }
    fn rate(&self, resource: &str) -> Result<u128> {
        self.rates_fp8
            .iter()
            .find(|(c, _)| *c == resource)
            .map(|(_, r)| *r)
            .ok_or_else(|| VoucherError::NoRate(resource.into(), self.version.clone()))
    }
}

/// fmt a quatch count as the A string the Python engine writes ("0.4400")
pub fn fmt_a(quatch: u128) -> String {
    format!("{}.{:04}", quatch / 10_000, quatch % 10_000)
}

/// Append-only, hash-chained ledger (in-memory: the pure state machine; the
/// Python engine owns the on-disk JSONL). Balances derived, never stored.
#[derive(Default)]
pub struct Escrow {
    events: Vec<Value>,
}

impl Escrow {
    pub fn new() -> Self {
        Self::default()
    }

    fn canonical(body: &Map<String, Value>) -> String {
        // sorted keys, no whitespace — the same canonicalization law as Python
        let sorted: std::collections::BTreeMap<&String, &Value> = body.iter().collect();
        serde_json::to_string(&sorted).unwrap()
    }

    fn hash(body: &Map<String, Value>, prev: &str) -> String {
        let mut h = Sha256::new();
        h.update(prev.as_bytes());
        h.update(Self::canonical(body).as_bytes());
        hex(&h.finalize())
    }

    fn tip(&self) -> String {
        self.events
            .last()
            .map(|e| e["hash"].as_str().unwrap().to_string())
            .unwrap_or_else(|| GENESIS_HASH.into())
    }

    fn append(&mut self, mut body: Map<String, Value>) -> Value {
        let prev = self.tip();
        let h = Self::hash(&body, &prev);
        body.insert("prev".into(), json!(prev));
        body.insert("hash".into(), json!(h));
        let ev = Value::Object(body);
        self.events.push(ev.clone());
        ev
    }

    /// Walk the chain; Err(Tamper) on any break. Returns the event count.
    pub fn verify_chain(&self) -> Result<usize> {
        let mut prev = GENESIS_HASH.to_string();
        for (n, ev) in self.events.iter().enumerate() {
            let body = {
                let mut m = ev.as_object().unwrap().clone();
                m.remove("prev");
                m.remove("hash");
                m
            };
            if ev["prev"].as_str() != Some(prev.as_str())
                || Self::hash(&body, &prev) != ev["hash"].as_str().unwrap()
            {
                return Err(VoucherError::Tamper(n));
            }
            prev = ev["hash"].as_str().unwrap().to_string();
        }
        Ok(self.events.len())
    }

    fn body_events(&self) -> impl Iterator<Item = &Value> {
        self.events.iter()
    }

    /// Derived balance in quatch. There is no stored balance to corrupt.
    pub fn balance_quatch(&self, voucher: &str) -> u128 {
        let deposits: u128 = self
            .body_events()
            .filter(|e| e["voucher"].as_str() == Some(voucher) && e["type"] == "DEPOSIT")
            .map(|e| parse_a(e["amount"].as_str().unwrap()))
            .fold(0u128, |a, b| a + b);
        let charges: u128 = self
            .body_events()
            .filter(|e| e["voucher"].as_str() == Some(voucher) && e["type"] == "CHARGE")
            .map(|e| {
                e["line_items"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .fold(0u128, |a, li| a + parse_a(li["charged"].as_str().unwrap()))
            })
            .fold(0u128, |a, b| a + b);
        deposits - charges
    }

    pub fn balance(&self, voucher: &str) -> String {
        fmt_a(self.balance_quatch(voucher))
    }

    /// A-rail deposit: cites its tx; memo-native (sender + memo recorded when
    /// given — NO binding table on this rail, per the founder rider).
    pub fn deposit(
        &mut self,
        voucher: &str,
        amount_quatch: u128,
        vaulta_tx: &str,
        sender: &str,
        memo: &str,
        ts: u64,
    ) -> Result<Value> {
        if amount_quatch == 0 {
            return Err(VoucherError::NonPositive("deposit"));
        }
        if vaulta_tx.is_empty() {
            return Err(VoucherError::MissingRef("a vaulta_tx reference"));
        }
        let mut body = Map::new();
        body.insert("type".into(), json!("DEPOSIT"));
        body.insert("voucher".into(), json!(voucher));
        body.insert("ts".into(), json!(ts));
        body.insert("amount".into(), json!(fmt_a(amount_quatch)));
        body.insert("vaulta_tx".into(), json!(vaulta_tx));
        body.insert("currency_in".into(), json!("A"));
        body.insert("chain_in".into(), json!("vaulta"));
        if !sender.is_empty() {
            body.insert("sender".into(), json!(sender));
        }
        if !memo.is_empty() {
            body.insert("memo".into(), json!(memo));
        }
        Ok(self.append(body))
    }

    /// USDC-on-Base rail: credited in A at an EXPLICIT cited rate. Dust refused.
    /// `usdc_micro` = 1e-6 USDC units; `rate_fp8` = A per USDC at 1e-8.
    pub fn deposit_usdc(
        &mut self,
        voucher: &str,
        usdc_micro: u128,
        base_tx: &str,
        rate_fp8: u128,
        rate_ref: &str,
        ts: u64,
    ) -> Result<Value> {
        if usdc_micro == 0 {
            return Err(VoucherError::NonPositive("usdc deposit"));
        }
        if base_tx.is_empty() {
            return Err(VoucherError::MissingRef("a base_tx reference"));
        }
        if rate_ref.is_empty() {
            return Err(VoucherError::MissingRef(
                "a rate_ref (where the rate was read)",
            ));
        }
        if rate_fp8 == 0 {
            return Err(VoucherError::NonPositive("conversion rate"));
        }
        // usdc(1e-6) × rate(1e-8) = A at 1e-14 → quatch (1e-4) with half-up
        let credited = div_half_up(usdc_micro * rate_fp8, 10_000_000_000); // 1e-6 × 1e-8 → 1e-4
        if credited == 0 {
            return Err(VoucherError::DustRefused);
        }
        let mut body = Map::new();
        body.insert("type".into(), json!("DEPOSIT"));
        body.insert("voucher".into(), json!(voucher));
        body.insert("ts".into(), json!(ts));
        body.insert("amount".into(), json!(fmt_a(credited))); // A — what balance math sees
        body.insert("currency_in".into(), json!("USDC"));
        body.insert("chain_in".into(), json!("base"));
        body.insert("usdc_amount".into(), json!(fmt_usdc(usdc_micro)));
        body.insert("base_tx".into(), json!(base_tx));
        body.insert("rate_a_per_usdc".into(), json!(fmt_fp8(rate_fp8)));
        body.insert("rate_ref".into(), json!(rate_ref));
        Ok(self.append(body))
    }

    /// Meter usage against the voucher; refuses BEFORE writing if the total
    /// (incl. tithe) exceeds balance. usage = [(resource_class, integer qty)].
    pub fn charge(
        &mut self,
        voucher: &str,
        usage: &[(&'static str, u128)],
        rate_set: &RateSet,
        ts: u64,
    ) -> Result<Value> {
        if usage.is_empty() {
            return Err(VoucherError::NonPositive("usage"));
        }
        let mut line_items = Vec::new();
        let mut subtotal = 0u128;
        for (resource, qty) in usage {
            if *qty == 0 {
                return Err(VoucherError::NonPositive("quantity"));
            }
            let rate = rate_set.rate(resource)?;
            let charged = div_half_up(qty * rate, 10_000); // qty × rate_fp8 → quatch (1e-8 → 1e-4)
            subtotal += charged;
            line_items.push(json!({
                "resource": resource, "quantity": qty.to_string(),
                "rate": fmt_fp8(rate), "rate_set_ref": rate_set.version,
                "charged": fmt_a(charged),
            }));
        }
        // THE TITHE — a distinct line, 10% on top of cost basis.
        let tithe = div_half_up(subtotal * TITHE_RATE_FP8, 1_000_000); // ×0.10
        line_items.push(json!({
            "resource": "tithe.founder", "quantity": "1",
            "rate": fmt_fp8(TITHE_RATE_FP8), "rate_set_ref": rate_set.version,
            "charged": fmt_a(tithe),
        }));
        let total = subtotal + tithe;
        let bal = self.balance_quatch(voucher);
        if total > bal {
            return Err(VoucherError::InsufficientVoucher {
                total: fmt_a(total),
                balance: fmt_a(bal),
            });
        }
        let mut body = Map::new();
        body.insert("type".into(), json!("CHARGE"));
        body.insert("voucher".into(), json!(voucher));
        body.insert("ts".into(), json!(ts));
        body.insert("cost_basis_ref".into(), json!(rate_set.cost_basis_ref));
        body.insert("line_items".into(), Value::Array(line_items));
        Ok(self.append(body))
    }

    /// The one true total: computed from line items every time, never stored.
    pub fn receipt_total_quatch(charge_event: &Value) -> u128 {
        charge_event["line_items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|li| parse_a(li["charged"].as_str().unwrap()))
            .sum()
    }
    pub fn receipt_tithe_quatch(charge_event: &Value) -> u128 {
        charge_event["line_items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|li| li["resource"] == "tithe.founder")
            .map(|li| parse_a(li["charged"].as_str().unwrap()))
            .sum()
    }

    /// test seam: mutate a stored event (tamper proofs)
    pub fn tamper_event(&mut self, idx: usize, f: impl FnOnce(&mut Value)) {
        f(&mut self.events[idx]);
    }
    pub fn event_count(&self) -> usize {
        self.events.len()
    }
}

fn parse_a(s: &str) -> u128 {
    let (i, f) = s.split_once('.').unwrap_or((s, ""));
    i.parse::<u128>().unwrap() * 10_000 + format!("{:<04}", f).parse::<u128>().unwrap_or(0)
}
fn fmt_usdc(micro: u128) -> String {
    format!("{}.{:06}", micro / 1_000_000, micro % 1_000_000)
}
fn fmt_fp8(v: u128) -> String {
    format!("{}.{:08}", v / 100_000_000, v % 100_000_000)
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_string()
}
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
