//! R6 — demo-scoped settlement lane (port of Python B6).
//!
//! Honest scope, kept from the reference: this is NOT the chain-neutral
//! bPay engine. It is the economic lifecycle's SHAPE at demo scale —
//! QUOTE → COMMITMENT → INVOICE → AUTHORIZE → SETTLE → RECEIPT →
//! RECONCILE — with a real ML-DSA signature as its anchor of
//! verifiability. The receipt's trust root is the signature + hash
//! chain, not a blockchain.
//!
//! Boundaries enforced at AUTHORIZE: total within the budget ceiling;
//! single-use quotes burn on authorization; a frozen quote stays valid
//! past expiry ("governance may change tomorrow's offer; it cannot
//! change yesterday's promise").
//!
//! The one structural change from the Python: signing goes through the
//! bSigner **library** (via [`crate::identity::IdentityHook]`), never a
//! subprocess. Envelopes are therefore library-shaped
//! (`{did, signature_b64u, sha256}`), not CLI-shaped — behavior is
//! identical, bytes are not.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::identity::IdentityHook;
use crate::nostr::{self, NostrAdapter};
use crate::switch::{utc_now_plus_rfc3339, utc_now_rfc3339};
use crate::transport::Transport;

/// Settlement failure: refused quote, blown budget, unknown reference.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SettlementError(pub String);

impl std::fmt::Display for SettlementError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}", self.0)
    }
}

impl std::error::Error for SettlementError {}

/// Receipt sink: the lane calls it with every receipt. The Nostr
/// implementation publishes `KIND_SETTLE_RECEIPT`; tests record.
pub trait SettleSink: Send + Sync {
    fn settle_receipt(&self, session_id: &str, receipt: &Value);
}

/// Nostr receipt sink: signs nothing itself (the receipt is already
/// signed) — it wraps the receipt as a 31339 event and fans it out.
pub struct NostrSettleSink {
    relays: Vec<String>,
    secret: [u8; 32],
    timeout: Duration,
}

impl NostrSettleSink {
    pub fn new(relays: Vec<String>, secret: [u8; 32], timeout: Duration) -> Self {
        NostrSettleSink {
            relays,
            secret,
            timeout,
        }
    }
}

impl SettleSink for NostrSettleSink {
    fn settle_receipt(&self, session_id: &str, receipt: &Value) {
        let invoice = receipt
            .get("invoice_id")
            .and_then(Value::as_str)
            .unwrap_or("");
        let secp = NostrAdapter::secp();
        let tags = vec![
            vec!["d".to_string(), session_id.to_string()],
            vec!["invoice".to_string(), invoice.to_string()],
        ];
        // created_at is wire metadata, never hashed: wall clock is fine.
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0);
        let Ok(event) = nostr::build_event(
            &secp,
            &self.secret,
            nostr::KIND_SETTLE_RECEIPT,
            receipt,
            tags,
            created_at,
        ) else {
            return;
        };
        let bytes = serde_json::to_vec(&event).unwrap_or_default();
        let adapter = NostrAdapter::new(self.relays.clone(), self.secret, self.timeout);
        // A fresh current-thread runtime: safe inside or outside an
        // executor,Receipt fanout must never wedge the agent loop.
        let Ok(runtime) = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
        else {
            return;
        };
        let _ = runtime.block_on(adapter.publish_raw(&bytes));
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SettleState {
    #[serde(default)]
    quotes: BTreeMap<String, Value>,
    #[serde(default)]
    spent_quotes: Vec<String>,
    #[serde(default)]
    invoices: BTreeMap<String, Value>,
    #[serde(default)]
    receipts: Vec<Value>,
    #[serde(default)]
    chain_head: Option<String>,
}

/// One subtask's full walk — what the `settle_subtask` tool returns.
#[derive(Debug, Clone, Serialize)]
pub struct SettleOutcome {
    pub subtask_id: String,
    pub quote_id: String,
    pub invoice_id: String,
    pub total: i64,
    pub verdict: String,
    pub reasons: Vec<String>,
    pub receipt: Value,
}

/// The lifecycle lane: one fixed scenario, walked honestly.
pub struct SettlementLane {
    price_list: BTreeMap<String, i64>,
    price_list_sha256: String,
    workdir: PathBuf,
    session_id: String,
    state_path: PathBuf,
    state: SettleState,
    budget: i64,
    pay_to: String,
    identity: IdentityHook,
    sink: Option<Arc<dyn SettleSink>>,
    log: Option<Arc<dyn Fn(String) + Send + Sync>>,
}

impl SettlementLane {
    pub fn new(
        price_list_path: &Path,
        workdir: &Path,
        session_id: &str,
        identity: IdentityHook,
        budget: i64,
        pay_to: &str,
    ) -> Result<Self, SettlementError> {
        let raw = std::fs::read(price_list_path)
            .map_err(|e| SettlementError(format!("price list unreadable: {e}")))?;
        let mut price_hasher = Sha256::new();
        price_hasher.update(&raw);
        let price_list: BTreeMap<String, i64> = serde_json::from_slice(&raw)
            .map_err(|e| SettlementError(format!("price list is not a string->int map: {e}")))?;
        std::fs::create_dir_all(workdir).map_err(|e| SettlementError(format!("workdir: {e}")))?;
        let state_path = workdir.join(format!("{session_id}.settle.json"));
        let state = std::fs::read_to_string(&state_path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(SettleState {
                quotes: BTreeMap::new(),
                spent_quotes: Vec::new(),
                invoices: BTreeMap::new(),
                receipts: Vec::new(),
                chain_head: None,
            });
        Ok(SettlementLane {
            price_list,
            price_list_sha256: format!("{:x}", price_hasher.finalize()),
            workdir: workdir.to_path_buf(),
            session_id: session_id.to_string(),
            state_path,
            state,
            budget,
            pay_to: pay_to.to_string(),
            identity,
            sink: None,
            log: None,
        })
    }

    pub fn with_sink(mut self, sink: Arc<dyn SettleSink>) -> Self {
        self.sink = Some(sink);
        self
    }

    pub fn with_log(mut self, log: Arc<dyn Fn(String) + Send + Sync>) -> Self {
        self.log = Some(log);
        self
    }

    pub fn chain_head(&self) -> Option<&str> {
        self.state.chain_head.as_deref()
    }

    fn emit(&self, line: String) {
        if let Some(log) = &self.log {
            log(line);
        }
    }

    fn save(&self) -> Result<(), SettlementError> {
        let text = serde_json::to_string_pretty(&self.state)
            .map_err(|e| SettlementError(format!("state JSON: {e}")))?;
        std::fs::write(&self.state_path, text)
            .map_err(|e| SettlementError(format!("state write: {e}")))
    }

    fn sign(&self, payload: &[u8]) -> Result<Value, SettlementError> {
        let signed = self.identity.checkpoint(payload).map_err(SettlementError)?;
        let mut hasher = Sha256::new();
        hasher.update(payload);
        Ok(serde_json::json!({
            "did": signed.did,
            "signature_b64u": bsigner::b64::b64u(&signed.sig),
            "sha256": format!("{:x}", hasher.finalize()),
        }))
    }

    pub fn quote(&mut self, subtask_id: &str) -> Result<Value, SettlementError> {
        let unit_price = self
            .price_list
            .get(subtask_id)
            .copied()
            .ok_or_else(|| SettlementError(format!("no price for subtask {subtask_id:?}")))?;
        let quote = serde_json::json!({
            "quote_id": format!("q-{}", rand_hex(6)),
            "subtask_id": subtask_id,
            "unit_price": unit_price,
            "ttl_s": 600,
            "single_use": true,
            "price_list_sha256": self.price_list_sha256,
            "created_at": utc_now_rfc3339(),
            "expires_at": utc_now_plus_rfc3339(600),
        });
        let quote_id = quote["quote_id"].as_str().unwrap_or("").to_string();
        self.state.quotes.insert(quote_id, quote.clone());
        self.save()?;
        Ok(quote)
    }

    pub fn invoice(&mut self, quote: &Value) -> Result<Value, SettlementError> {
        let commitment = serde_json::json!({
            "quote_id": quote["quote_id"],
            "quote_sha256": sha256_hex(canonical_json(quote).as_bytes()),
            "frozen_at": utc_now_rfc3339(),
        });
        let invoice = serde_json::json!({
            "invoice_id": format!("i-{}", rand_hex(6)),
            "commitment": commitment,
            "line_items": [{"subtask_id": quote["subtask_id"], "qty": 1,
                            "unit_price": quote["unit_price"]}],
            "total": quote["unit_price"],
            "pay_to": self.pay_to,
            "created_at": utc_now_rfc3339(),
        });
        let invoice_id = invoice["invoice_id"].as_str().unwrap_or("").to_string();
        self.state.invoices.insert(invoice_id, invoice.clone());
        self.save()?;
        Ok(invoice)
    }

    pub fn authorize(&mut self, invoice: &Value) -> Result<Value, SettlementError> {
        let quote_id = invoice["commitment"]["quote_id"]
            .as_str()
            .ok_or_else(|| SettlementError("invoice references an unknown quote".to_string()))?;
        let quote =
            self.state.quotes.get(quote_id).ok_or_else(|| {
                SettlementError("invoice references an unknown quote".to_string())
            })?;
        if self
            .state
            .spent_quotes
            .iter()
            .any(|spent| spent == quote_id)
        {
            return Err(SettlementError(format!(
                "single-use quote {quote_id} already spent — REFUSED"
            )));
        }
        let total = invoice["total"].as_i64().unwrap_or(i64::MAX);
        if total > self.budget {
            return Err(SettlementError(format!(
                "total {total} exceeds budget ceiling {} — REFUSED",
                self.budget
            )));
        }
        // Commitment law: a frozen quote stays valid past expiry. (An
        // uncommitted expired quote never reaches this function — quotes
        // freeze at invoice time.)
        let _ = quote;
        let payload = canonical_json(invoice).into_bytes();
        let envelope = self.sign(&payload)?;
        self.state.spent_quotes.push(quote_id.to_string());
        let auth = serde_json::json!({
            "invoice_id": invoice["invoice_id"],
            "invoice_sha256": sha256_hex(&payload),
            "envelope": envelope,
            "authorized_at": utc_now_rfc3339(),
        });
        self.save()?;
        self.emit(format!(
            "AUTHORIZED {} total={total}",
            invoice["invoice_id"].as_str().unwrap_or("")
        ));
        Ok(auth)
    }

    pub fn settle(&self, auth: &Value, invoice: &Value) -> Result<Value, SettlementError> {
        let statement = serde_json::json!({
            "type": "b:settle",
            "invoice_id": invoice["invoice_id"],
            "total": invoice["total"],
            "pay_to": invoice["pay_to"],
            "promise": "peer-to-peer off-chain settlement: both parties hold the signed invoice + authorization; the receipt is the evidence",
            "settled_at": utc_now_rfc3339(),
        });
        let payload = canonical_json(&statement).into_bytes();
        let envelope = self.sign(&payload)?;
        let _ = auth;
        Ok(serde_json::json!({
            "statement": statement,
            "statement_sha256": sha256_hex(&payload),
            "envelope": envelope,
        }))
    }

    pub fn receipt(
        &mut self,
        invoice: &Value,
        auth: &Value,
        evidence: &Value,
    ) -> Result<Value, SettlementError> {
        let prev = self.state.chain_head.clone();
        let auth_sig = auth["envelope"]["signature_b64u"].as_str().unwrap_or("");
        let body = serde_json::json!({
            "invoice_id": invoice["invoice_id"],
            "line_items": invoice["line_items"],
            "total": invoice["total"],
            "pay_to": invoice["pay_to"],
            "prev_receipt_sha256": prev,
            "provenance": {
                "price_list_sha256": self.price_list_sha256,
                "invoice_sha256": auth["invoice_sha256"],
                "settlement_sha256": evidence["statement_sha256"],
                "auth_sig": auth_sig,
            },
            "ts": utc_now_rfc3339(),
        });
        let mut receipt = body.clone();
        receipt["receipt_sha256"] = Value::String(sha256_hex(canonical_json(&body).as_bytes()));
        self.state.receipts.push(receipt.clone());
        self.state.chain_head = receipt["receipt_sha256"].as_str().map(str::to_string);
        self.save()?;
        if let Some(sink) = &self.sink {
            sink.settle_receipt(&self.session_id, &receipt);
        }
        let parent = prev
            .map(|hash| format!("{}…", &hash[..12.min(hash.len())]))
            .unwrap_or_else(|| "genesis".to_string());
        self.emit(format!(
            "RECEIPT {} chain<-({parent})",
            invoice["invoice_id"].as_str().unwrap_or("")
        ));
        Ok(receipt)
    }

    pub fn reconcile(&self, invoice: &Value, receipt: &Value) -> Value {
        let mut reasons = Vec::new();
        if receipt["invoice_id"] != invoice["invoice_id"] {
            reasons.push("receipt/invoice id mismatch".to_string());
        }
        if receipt["total"] != invoice["total"] {
            reasons.push(format!(
                "total mismatch: invoice {} vs receipt {}",
                invoice["total"], receipt["total"]
            ));
        }
        if receipt["line_items"] != invoice["line_items"] {
            reasons.push("line items differ".to_string());
        }
        if receipt["provenance"]["invoice_sha256"]
            != Value::String(sha256_hex(canonical_json(invoice).as_bytes()))
        {
            reasons.push("provenance invoice hash does not match the invoice".to_string());
        }
        let mut body = receipt.clone();
        if let Some(object) = body.as_object_mut() {
            object.remove("receipt_sha256");
        }
        if receipt["receipt_sha256"] != Value::String(sha256_hex(canonical_json(&body).as_bytes()))
        {
            reasons.push("receipt hash chain broken".to_string());
        }
        let verdict = if reasons.is_empty() { "PASS" } else { "FAIL" };
        self.emit(format!(
            "RECONCILE {} -> {verdict}",
            invoice["invoice_id"].as_str().unwrap_or("")
        ));
        serde_json::json!({"verdict": verdict, "reasons": reasons})
    }

    /// Full walk for one subtask — what the `settle_subtask` tool calls.
    pub fn run_subtask(&mut self, subtask_id: &str) -> Result<SettleOutcome, SettlementError> {
        let quote = self.quote(subtask_id)?;
        let invoice = self.invoice(&quote)?;
        let auth = self.authorize(&invoice)?;
        let evidence = self.settle(&auth, &invoice)?;
        let receipt = self.receipt(&invoice, &auth, &evidence)?;
        let verdict = self.reconcile(&invoice, &receipt);
        Ok(SettleOutcome {
            subtask_id: subtask_id.to_string(),
            quote_id: quote["quote_id"].as_str().unwrap_or("").to_string(),
            invoice_id: invoice["invoice_id"].as_str().unwrap_or("").to_string(),
            total: invoice["total"].as_i64().unwrap_or(0),
            verdict: verdict["verdict"].as_str().unwrap_or("FAIL").to_string(),
            reasons: verdict["reasons"]
                .as_array()
                .map(|reasons| {
                    reasons
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default(),
            receipt,
        })
    }
}

/// Deterministic canonical JSON (sorted keys, compact, raw UTF-8) —
/// the same recipe as the transcript canonicalization, used for every
/// lifecycle hash.
pub fn canonical_json(value: &Value) -> String {
    let normalized: Value =
        serde_json::from_str(&serde_json::to_string(value).expect("value serializes"))
            .expect("round trip");
    serde_json::to_string(&normalized).expect("normalized serializes")
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn rand_hex(bytes: usize) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut raw = vec![0u8; bytes];
    getrandom::getrandom(&mut raw).expect("randomness");
    let mut out = String::with_capacity(bytes * 2);
    for byte in raw {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 15) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::IdentityHook;
    use std::sync::Mutex;

    struct Fixture {
        _root: PathBuf,
        lane: SettlementLane,
    }

    fn fixture(tag: &str, budget: i64) -> Fixture {
        let root =
            std::env::temp_dir().join(format!("harness-settle-test-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("root");
        std::fs::write(
            root.join("prices.json"),
            br#"{"demo-task": 500, "big-task": 50000}"#,
        )
        .expect("prices");
        let keys = root.join("keys");
        std::fs::create_dir_all(&keys).expect("keys");
        let identity = IdentityHook::genesis(&keys, IdentityHook::test_vault()).expect("genesis");
        let lane = SettlementLane::new(
            &root.join("prices.json"),
            &root.join("work"),
            "sess-settle",
            identity,
            budget,
            "demo-counterparty",
        )
        .expect("lane");
        Fixture { _root: root, lane }
    }

    #[test]
    fn full_walk_passes_with_signed_chain() {
        let mut fixture = fixture("walk", 10_000);
        let outcome = fixture.lane.run_subtask("demo-task").expect("walk");
        assert_eq!(outcome.verdict, "PASS");
        assert!(outcome.reasons.is_empty());
        assert_eq!(outcome.total, 500);
        assert!(outcome.quote_id.starts_with("q-"));
        assert!(outcome.invoice_id.starts_with("i-"));
        assert!(outcome.receipt["receipt_sha256"].as_str().is_some());
        assert!(outcome.receipt["provenance"]["auth_sig"]
            .as_str()
            .map(|sig| !sig.is_empty())
            .unwrap_or(false));
        assert!(fixture.lane.chain_head().is_some());
    }

    #[test]
    fn over_budget_is_refused() {
        let mut fixture = fixture("budget", 100);
        let error = fixture.lane.run_subtask("demo-task").expect_err("refused");
        assert!(error.0.contains("exceeds budget ceiling"));
    }

    #[test]
    fn double_spend_is_refused() {
        let mut fixture = fixture("double", 10_000);
        let quote = fixture.lane.quote("demo-task").expect("quote");
        let invoice = fixture.lane.invoice(&quote).expect("invoice");
        fixture
            .lane
            .authorize(&invoice)
            .expect("first authorization");
        let error = fixture
            .lane
            .authorize(&invoice)
            .expect_err("second refused");
        assert!(error.0.contains("already spent"));
    }

    #[test]
    fn unknown_subtask_is_refused() {
        let mut fixture = fixture("unknown", 10_000);
        let error = fixture
            .lane
            .run_subtask("no-such-task")
            .expect_err("refused");
        assert!(error.0.contains("no price for subtask"));
    }

    #[test]
    fn tampered_receipt_fails_reconcile() {
        let mut fixture = fixture("tamper", 10_000);
        let quote = fixture.lane.quote("demo-task").expect("quote");
        let invoice = fixture.lane.invoice(&quote).expect("invoice");
        let auth = fixture.lane.authorize(&invoice).expect("authorize");
        let evidence = fixture.lane.settle(&auth, &invoice).expect("settle");
        let mut receipt = fixture
            .lane
            .receipt(&invoice, &auth, &evidence)
            .expect("receipt");
        receipt["total"] = serde_json::json!(1);
        let verdict = fixture.lane.reconcile(&invoice, &receipt);
        assert_eq!(verdict["verdict"], serde_json::json!("FAIL"));
        assert!(!verdict["reasons"].as_array().unwrap().is_empty());
    }

    #[test]
    fn sink_receives_every_receipt() {
        struct RecordingSink {
            seen: Mutex<Vec<Value>>,
        }
        impl SettleSink for RecordingSink {
            fn settle_receipt(&self, _session: &str, receipt: &Value) {
                self.seen.lock().expect("seen").push(receipt.clone());
            }
        }
        let mut fixture = fixture("sink", 10_000);
        let sink = Arc::new(RecordingSink {
            seen: Mutex::new(Vec::new()),
        });
        fixture.lane.sink = Some(sink.clone());
        fixture.lane.run_subtask("demo-task").expect("walk");
        assert_eq!(sink.seen.lock().expect("seen").len(), 1);
    }

    #[test]
    fn second_receipt_links_to_first() {
        let mut fixture = fixture("chain", 10_000);
        let first = fixture.lane.run_subtask("demo-task").expect("first walk");
        let second = fixture.lane.run_subtask("demo-task").expect("second walk");
        assert_eq!(
            second.receipt["prev_receipt_sha256"],
            first.receipt["receipt_sha256"]
        );
        assert_eq!(second.verdict, "PASS");
    }
}
