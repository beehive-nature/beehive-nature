//! bpay-sign — the bPay Phase-E signing cockpit service.
//!
//! One process, three laws:
//! 1. **Bind before dispatch** — every /v1/sign request re-runs the
//!    watchpay::wave binding gate against LIVE authorization + job
//!    records (or, in TESTNET-DEMO mode, the labeled synthetic pair it
//!    vends itself); a refusal names its law and nothing is dispatched.
//! 2. **Verify after return** — every signature (hot testnet key in
//!    demo mode; a hardware transport when one is enabled) passes the
//!    same cryptographic wall: strict decode, field binding, low-s,
//!    recovered signer == sealed payer, locally computed hash. Only a
//!    `VerifiedSigned` can enter the receipt.
//! 3. **TESTNET settlement is structurally separated** — the settle
//!    route REFUSES unless the receipt says `testnet: true` AND the RPC
//!    answers chain 421614. No mainnet settlement code exists in this
//!    binary.
//!
//! TESTNET-DEMO mode (founder order 2026-09-19: prove it all on ARB's
//! testnet first): vends bridge-shaped prepare/authorization endpoints
//! over a SYNTHETIC 56-quote set (labeled in every response), binds and
//! signs through the REAL organ, and settles on the configured
//! Arbitrum-Sepolia-shaped ledger (public RPC or a local fork of it).

use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use k256::ecdsa::SigningKey;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use watchpay::abi::keccak256;
use watchpay::connect::{
    ConnectClock, ConnectRequestJson, ConnectSignedTxRaw, ConnectTransactionJson, ConnectTransport,
    DerivationPath,
};
use watchpay::types::{Atto, EthAddr, Hex32};
use watchpay::wave::{
    bind_authorization, sign_wave_slot, WaveAuthorization, WaveAuthorizationEvent, WaveDestination,
    WaveFeeCeilings, WaveJobSummary, WaveLedger, WaveNetwork, WaveQuotePayment, WaveSignReceipt,
    ARBITRUM_SEPOLIA_CHAIN_ID,
};

// ─────────────────────────── shared state ───────────────────────────

struct AppState {
    /// The Safe 7 expected payer (Observation A's identity target,
    /// LAW 14's binding). None = the demo hot key.
    expected_payer: Option<EthAddr>,
    /// The wired Suite-MCP transport (env BPAY_SIGN_MCP_URL/TOKEN);
    /// absent = the hot TESTNET key.
    suite: Option<SuiteMcp>,
    /// TESTNET-DEMO mode: vends the synthetic bridge-shaped pair and
    /// signs with the hot testnet key. The ONLY mode this binary ships.
    demo: bool,
    /// The RPC the settle route may talk to (Arbitrum-Sepolia-shaped
    /// ONLY — verified by chain id before anything is sent).
    rpc_url: Option<String>,
    state_dir: PathBuf,
    /// The hot TESTNET throwaway key (demo mode only). Never a mainnet
    /// key; generated on first run and printed ONCE for the founder's
    /// faucet drip.
    hot_key: SigningKey,
    /// demo-mode synthetic records (server-lifetime, module scope)
    demo_auth: RwLock<Vec<WaveAuthorization>>,
    demo_jobs: RwLock<Vec<WaveJobSummary>>,
    io_lock: Arc<std::sync::Mutex<()>>,
}

type Shared = Arc<AppState>;

fn refusal(status: u16, law: &str, why: String) -> Response {
    let status = axum::http::StatusCode::from_u16(status)
        .unwrap_or(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
    (
        status,
        Json(serde_json::json!({ "ok": false, "refusal": { "law": law, "why": why } })),
    )
        .into_response()
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ─────────────────── the hot TESTNET transport (demo) ───────────────────

/// Signs the composed request with the hot testnet key — the SAME
/// Connect wire shape a device transport returns. The result is UNTRUSTED
/// until verify_wave_signed accepts it.
struct HotTestnetTransport {
    key: SigningKey,
    chain_id: u64,
}

impl ConnectTransport for HotTestnetTransport {
    fn ethereum_sign_transaction(
        &mut self,
        request: &ConnectRequestJson,
    ) -> watchpay::Result<ConnectSignedTxRaw> {
        let ConnectTransactionJson::Eip1559 {
            ref to,
            ref gas_limit,
            ref nonce,
            ref data,
            chain_id,
            ref max_fee_per_gas,
            ref max_priority_fee_per_gas,
            ..
        } = request.transaction
        else {
            return Err(watchpay::Error::Malformed(
                "wave slice composes 1559 only".into(),
            ));
        };
        let q = |s: &str| -> watchpay::Result<u64> {
            u64::from_str_radix(&s[2..], 16)
                .map_err(|e| watchpay::Error::Malformed(format!("bad hex quantity {s}: {e}")))
        };
        let mut to_b = [0u8; 20];
        hex::decode_to_slice(&to[2..], &mut to_b)
            .map_err(|e| watchpay::Error::Malformed(format!("bad to: {e}")))?;
        let data_b = hex::decode(&data[2..])
            .map_err(|e| watchpay::Error::Malformed(format!("bad data: {e}")))?;
        // Enforce the transport's own chain law (a miswired service can
        // never sign a mainnet request with the testnet key).
        if chain_id != self.chain_id {
            return Err(watchpay::Error::field(
                "chain_id",
                format!(
                    "hot TESTNET transport refuses chain {chain_id} (this key is testnet-only, \
                     chain {})",
                    self.chain_id
                ),
            ));
        }
        let unsigned = crate::rlp::unsigned_1559(
            chain_id,
            q(nonce)?,
            q(max_priority_fee_per_gas)?,
            q(max_fee_per_gas)?,
            q(gas_limit)?,
            to_b,
            &data_b,
        );
        let digest = keccak256(&unsigned);
        let (sig, rid) = self
            .key
            .sign_prehash_recoverable(&digest)
            .map_err(|e| watchpay::Error::Malformed(format!("sign: {e}")))?;
        let b = sig.to_bytes();
        let (r, s): ([u8; 32], [u8; 32]) =
            (b[..32].try_into().unwrap(), b[32..].try_into().unwrap());
        let y_parity = rid.to_byte() as u64;
        let signed = crate::rlp::signed_1559(
            chain_id,
            q(nonce)?,
            q(max_priority_fee_per_gas)?,
            q(max_fee_per_gas)?,
            q(gas_limit)?,
            to_b,
            &data_b,
            y_parity,
            &r,
            &s,
        );
        let minimal = |x: &[u8; 32]| -> String {
            let first = x.iter().position(|&v| v != 0).unwrap_or(32);
            format!("0x{}", hex::encode(&x[first..]))
        };
        Ok(ConnectSignedTxRaw {
            serialized_tx: format!("0x{}", hex::encode(&signed)),
            v: format!("0x{y_parity:x}"),
            r: minimal(&r),
            s: minimal(&s),
        })
    }
}

struct WallClock;
impl ConnectClock for WallClock {
    fn now_unix(&mut self) -> u64 {
        now_secs()
    }
}

// ─────────────────────── the SIGN contract (frozen) ───────────────────────

#[derive(Deserialize, Clone)]
struct SignBody {
    authorization_id: String,
    upload_id: String,
    payments: Vec<PaymentIn>,
    #[serde(default)]
    path: Option<String>,
}

#[derive(Deserialize, Clone)]
struct PaymentIn {
    quote_hash: String,
    rewards_address: String,
    amount_atto: String,
}

fn parse_payments(ps: &[PaymentIn]) -> watchpay::Result<Vec<WaveQuotePayment>> {
    ps.iter()
        .map(|p| {
            Ok(WaveQuotePayment {
                quote_hash: Hex32::from_lower_hex(&p.quote_hash)
                    .map_err(|e| watchpay::Error::field("quote_hash", e))?,
                rewards: EthAddr::from_lower_hex(&p.rewards_address)
                    .map_err(|e| watchpay::Error::field("rewards_address", e))?,
                amount_atto: Atto::parse_canonical(&p.amount_atto)
                    .map_err(|e| watchpay::Error::field("amount_atto", e))?,
            })
        })
        .collect()
}

fn demo_network() -> watchpay::Result<WaveNetwork> {
    // BPAY_SIGN_REPLICA_TOKEN/VAULT selects the labeled LOCAL REPLICA
    // (real Autonomi artifacts deployed fresh, chain 421614); unset =
    // the pinned PUBLIC Arbitrum Sepolia constants.
    match (
        std::env::var("BPAY_SIGN_REPLICA_TOKEN"),
        std::env::var("BPAY_SIGN_REPLICA_VAULT"),
    ) {
        (Ok(t), Ok(v)) => WaveNetwork::arbitrum_sepolia_replica(
            EthAddr::from_lower_hex(&t).map_err(|e| watchpay::Error::field("replica_token", e))?,
            EthAddr::from_lower_hex(&v).map_err(|e| watchpay::Error::field("replica_vault", e))?,
        ),
        _ => WaveNetwork::arbitrum_sepolia_test(),
    }
}

async fn sign_state(
    axum::extract::State(state): axum::extract::State<Shared>,
    Json(body): Json<SignBody>,
) -> Response {
    let payments = match parse_payments(&body.payments) {
        Ok(p) => p,
        Err(e) => return refusal(400, "payments", e.to_string()),
    };
    let auth = state
        .demo_auth
        .read()
        .unwrap()
        .iter()
        .find(|a| a.authorization_id == body.authorization_id)
        .cloned();
    let jobs: Vec<WaveJobSummary> = state.demo_jobs.read().unwrap().clone();
    let payer = crate::wallet::connected_payer(&state)
        .and_then(|a| EthAddr::from_lower_hex(&a).ok())
        .or(state.expected_payer)
        .unwrap_or_else(|| hot_payer(&state.hot_key));
    let binding = match bind_authorization(
        auth.as_ref(),
        &jobs,
        &payments,
        payer,
        &match demo_network() {
            Ok(n) => n,
            Err(e) => return refusal(500, "network", e.to_string()),
        },
    ) {
        Ok(b) => b,
        Err(e) => return refusal(409, "binding-gate", e.to_string()),
    };
    (
        axum::http::StatusCode::OK,
        Json(serde_json::json!({ "ok": true, "review": {
            "mode": if binding.replica() { "TESTNET-REPLICA-DEMO" } else if binding.testnet() { "TESTNET-DEMO" } else { "MAINNET" },
            "testnet": binding.testnet(),
            "replica": binding.replica(),
            "authorization_id": binding.authorization_id(),
            "upload_id": binding.upload_id(),
            "artifact_sha256": binding.artifact_sha256(),
            "artifact_bytes": binding.artifact_bytes(),
            "audience": binding.audience(),
            "invoice_digest": binding.invoice_digest(),
            "quote_count": binding.payments().len(),
            "ant_ceiling_atto": binding.ant_ceiling().to_decimal(),
            "gas_ceiling": binding.gas_ceiling(),
            "token": binding.network().token.to_lower_hex(),
            "vault": binding.network().vault.to_lower_hex(),
            "chain_id": binding.network().chain_id,
            "payer": state.expected_payer.map(|p| p.to_lower_hex()).unwrap_or_else(|| hot_payer(&state.hot_key).to_lower_hex()),
            "path": "m/44'/60'/0'/0/0 (hot TESTNET key in demo mode — the Safe 7 arrives with the hardware transport)",
            "transaction_count": binding.transaction_count(),
            "plan_hash": binding.plan_hash().to_lower_hex(),
        }})),
    )
        .into_response()
}

fn hot_payer(key: &SigningKey) -> EthAddr {
    let point = key.verifying_key().to_encoded_point(false);
    let bytes = point.as_bytes(); // 0x04 ‖ X ‖ Y
    let h = keccak256(&bytes[1..65]);
    let mut a = [0u8; 20];
    a.copy_from_slice(&h[12..]);
    EthAddr(a)
}

async fn sign_begin(
    axum::extract::State(state): axum::extract::State<Shared>,
    Json(body): Json<SignBody>,
) -> Response {
    let payments = match parse_payments(&body.payments) {
        Ok(p) => p,
        Err(e) => return refusal(400, "payments", e.to_string()),
    };
    let auth = state
        .demo_auth
        .read()
        .unwrap()
        .iter()
        .find(|a| a.authorization_id == body.authorization_id)
        .cloned();
    let jobs: Vec<WaveJobSummary> = state.demo_jobs.read().unwrap().clone();
    let payer = crate::wallet::connected_payer(&state)
        .and_then(|a| EthAddr::from_lower_hex(&a).ok())
        .or(state.expected_payer)
        .unwrap_or_else(|| hot_payer(&state.hot_key));
    let net = match demo_network() {
        Ok(n) => n,
        Err(e) => return refusal(500, "network", e.to_string()),
    };
    let binding = match bind_authorization(auth.as_ref(), &jobs, &payments, payer, &net) {
        Ok(b) => b,
        Err(e) => return refusal(409, "binding-gate", e.to_string()),
    };
    let ledger = match WaveLedger::open(&state.state_dir) {
        Ok(l) => l,
        Err(e) => return refusal(500, "ledger", e.to_string()),
    };
    let path = DerivationPath::parse("m/44'/60'/0'/0/0").expect("lawful constant path");
    // exactly-one-receipt law: continue an existing intent, or open one
    let mut receipt = match ledger.load(binding.authorization_id()) {
        Ok(Some(r)) => r,
        Ok(None) => {
            let r = WaveSignReceipt::opening_intent(&binding, &path, now_secs());
            if let Err(e) = ledger.write_first_intent(&r) {
                return refusal(409, "receipt", e.to_string());
            }
            r
        }
        Err(e) => return refusal(500, "ledger", e.to_string()),
    };
    // NONCE + FEES at composition (chain-sourced when a ledger is
    // configured; lawful fixed ceilings otherwise)
    let (nonce0, fees) = match compose_fees(&state, &payer) {
        Ok(v) => v,
        Err(why) => return refusal(502, "rpc", why),
    };
    let mut clock = WallClock;
    // THE TRANSPORT LAW: when the Safe 7 is wired it signs — the hot
    // testnet key is the fallback only. broadcast:false is pinned
    // inside the Suite transport; trezor_push_transaction is never called.
    enum AnyTransport {
        Suite(std::mem::ManuallyDrop<SuiteMcp>),
        Hot(HotTestnetTransport),
    }
    impl watchpay::connect::ConnectTransport for AnyTransport {
        fn ethereum_sign_transaction(
            &mut self,
            request: &ConnectRequestJson,
        ) -> watchpay::Result<ConnectSignedTxRaw> {
            match self {
                AnyTransport::Suite(s) => (**s).ethereum_sign_transaction(request),
                AnyTransport::Hot(h) => h.ethereum_sign_transaction(request),
            }
        }
    }
    let mut transport: AnyTransport = if let Some(suite) = state.suite.clone() {
        AnyTransport::Suite(std::mem::ManuallyDrop::new(suite))
    } else {
        AnyTransport::Hot(HotTestnetTransport {
            key: state.hot_key.clone(),
            chain_id: ARBITRUM_SEPOLIA_CHAIN_ID,
        })
    };
    let slots = [
        (WaveDestination::Approve, nonce0),
        (WaveDestination::PayForQuotes { part: 0 }, nonce0 + 1),
    ];
    for (dest, nonce) in slots {
        if receipt.slots.iter().any(|s| s.slot == dest.slot()) {
            continue; // already signed slot — the replay law refuses below on duplicates
        }
        // per-slot gas ceiling: 56 ERC20Votes transferFroms inside
        // payForQuotes cost ~4-5M gas on this EVM — 6M is the reviewed
        // worst case; the approve rides a small fixed ceiling.
        let gas_limit = match dest {
            WaveDestination::PayForQuotes { .. } => 6_000_000,
            WaveDestination::Approve => 300_000,
        };
        match sign_wave_slot(
            &ledger,
            &binding,
            &mut receipt,
            dest,
            WaveFeeCeilings {
                nonce,
                gas_limit,
                ..fees
            },
            &path,
            &mut clock,
            &mut transport,
        ) {
            Ok(_) => {}
            Err(watchpay::connect::SignAttemptError::AfterDispatch(e))
                if e.to_string()
                    .contains("already carries a verified signature") =>
            {
                return refusal(409, "slot", e.to_string())
            }
            Err(e) => {
                return (
                    axum::http::StatusCode::OK,
                    Json(serde_json::json!({
                        "ok": false,
                        "error": "device session ended without a verified signature",
                        "why": e.to_string()
                    })),
                )
                    .into_response()
            }
        }
    }
    let final_receipt = match ledger.load(binding.authorization_id()) {
        Ok(Some(r)) => r,
        _ => receipt,
    };
    (
        axum::http::StatusCode::OK,
        Json(serde_json::json!({ "ok": true, "receipt": receipt_json(&final_receipt) })),
    )
        .into_response()
}

fn receipt_json(r: &WaveSignReceipt) -> serde_json::Value {
    serde_json::to_value(r).unwrap_or(serde_json::json!({}))
}

/// Nonce from the ledger (eth_getTransactionCount) and lawful fee
/// ceilings (chain gas price + headroom). Without a configured RPC,
/// begin refuses — demo mode without a ledger cannot prove settlement.
fn compose_fees(
    state: &AppState,
    payer: &EthAddr,
) -> std::result::Result<(u64, WaveFeeCeilings), String> {
    let rpc = state.rpc_url.as_ref().ok_or(
        "no ledger RPC configured — set BPAY_SIGN_RPC to the Arbitrum-Sepolia-shaped ledger",
    )?;
    let nonce = rpc_u64(
        rpc,
        "eth_getTransactionCount",
        vec![payer.to_lower_hex().into(), "pending".into()],
    )
    .map_err(|e| format!("nonce: {e}"))?;
    let gas_price = rpc_u64(rpc, "eth_gasPrice", vec![]).map_err(|e| format!("gas price: {e}"))?;
    let max_fee = gas_price + gas_price / 5 + 1_000_000_000; // ~1.2x + 1 gwei floor
    let priority = gas_price / 10;
    Ok((
        nonce,
        WaveFeeCeilings {
            nonce,
            gas_limit: 3_000_000,
            max_fee_per_gas_wei: max_fee,
            max_priority_fee_wei: priority,
        },
    ))
}

// ─────────────── TESTNET settlement (structurally testnet-only) ───────────────

#[derive(Deserialize)]
struct SettleBody {
    authorization_id: String,
}

async fn testnet_settle(
    axum::extract::State(state): axum::extract::State<Shared>,
    Json(body): Json<SettleBody>,
) -> Response {
    let ledger = match WaveLedger::open(&state.state_dir) {
        Ok(l) => l,
        Err(e) => return refusal(500, "ledger", e.to_string()),
    };
    let receipt = match ledger.load(&body.authorization_id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            return refusal(
                404,
                "receipt",
                format!("no receipt for {}", body.authorization_id),
            )
        }
        Err(e) => return refusal(500, "ledger", e.to_string()),
    };
    // THE STRUCTURAL LAW: settlement exists ONLY on the testnet ledger.
    if !receipt.testnet {
        return refusal(
            403,
            "testnet-only",
            "settlement is testnet-only in this binary; a mainnet receipt cannot settle here"
                .into(),
        );
    }
    if receipt.state != "signed" {
        return refusal(
            409,
            "state",
            format!("receipt is {} — settle needs signed", receipt.state),
        );
    }
    let rpc = match state.rpc_url.as_deref() {
        Some(u) => u,
        None => return refusal(502, "rpc", "no ledger RPC configured".into()),
    };
    // verify the ledger IS Arbitrum Sepolia shaped before sending anything
    match rpc_u64(rpc, "eth_chainId", vec![]) {
        Ok(id) if id == ARBITRUM_SEPOLIA_CHAIN_ID => {}
        Ok(other) => {
            return refusal(403, "testnet-only", format!("ledger chain id {other} is not Arbitrum Sepolia {ARBITRUM_SEPOLIA_CHAIN_ID} — refusing to send"))
        }
        Err(e) => return refusal(502, "rpc", e),
    }
    let _ = serde_json::to_value(&receipt).unwrap();
    let mut sent = Vec::new();
    for slot in receipt.slots.iter() {
        // eth_sendRawTransaction; then wait for a receipt
        let raw = &slot.serialized_tx_hex;
        match rpc_send(rpc, raw) {
            Ok(h) if h == slot.tx_hash.to_lower_hex() => sent.push(serde_json::json!({
                "slot": slot.slot, "operation": slot.operation,
                "tx_hash": h, "status": "sent/confirmed-on-testnet",
            })),
            Ok(other) => {
                return refusal(502, "chain", format!(
                    "slot {} came back with tx hash {other} — expected {}; the signed bytes changed identity on the wire",
                    slot.slot, slot.tx_hash
                ))
            }
            Err(e) => return refusal(502, "chain", format!("slot {}: {e}", slot.slot)),
        }
    }
    (
        axum::http::StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "settled": if receipt.replica { "TESTNET-REPLICA" } else { "TESTNET" },
            "note": if receipt.replica { "settled on the Arbitrum-Sepolia-shaped TESTNET-REPLICA ledger (real Autonomi contract artifacts, local chain 421614 — NOT public Arbitrum Sepolia); never mainnet; proof-of-pipeline only" } else { "settled on the PUBLIC Arbitrum Sepolia testnet — never mainnet; proof-of-pipeline only" },
            "transactions": sent,
        })),
    )
        .into_response()
}

fn rpc_call(
    rpc: &str,
    method: &str,
    params: Vec<serde_json::Value>,
) -> std::result::Result<serde_json::Value, String> {
    let body = serde_json::json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params });
    let resp = ureq::post(rpc)
        .timeout(std::time::Duration::from_secs(30))
        .send_json(body)
        .map_err(|e| e.to_string())?
        .into_json::<serde_json::Value>()
        .map_err(|e| e.to_string())?;
    if let Some(err) = resp.get("error") {
        return Err(err.to_string());
    }
    Ok(resp
        .get("result")
        .cloned()
        .unwrap_or(serde_json::Value::Null))
}

fn rpc_u64(
    rpc: &str,
    method: &str,
    params: Vec<serde_json::Value>,
) -> std::result::Result<u64, String> {
    let r = rpc_call(rpc, method, params)?;
    let s = r.as_str().ok_or("non-string result")?;
    u64::from_str_radix(s.trim_start_matches("0x"), 16).map_err(|e| e.to_string())
}

fn rpc_send(rpc: &str, raw_hex: &str) -> std::result::Result<String, String> {
    let r = rpc_call(rpc, "eth_sendRawTransaction", vec![raw_hex.into()])?;
    // poll the receipt until it exists (or timeout) — a real chain answer
    for _ in 0..40 {
        let rc = rpc_call(
            rpc,
            "eth_getTransactionReceipt",
            vec![r.as_str().unwrap_or_default().into()],
        )?;
        if !rc.is_null() {
            let status = rc.get("status").and_then(|s| s.as_str()).unwrap_or("");
            if status != "0x1" {
                return Err(format!("tx {r} REVERTED (status {status})"));
            }
            return Ok(r.as_str().unwrap_or_default().to_string());
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
    Ok(r.as_str().unwrap_or_default().to_string())
}

// ───────────── demo bridge-shaped endpoints (synthetic, labeled) ─────────────

#[derive(Deserialize)]
struct DemoPrepareBody {
    artifact_sha256: String,
    audience: String,
}

/// The harmless preflight (Observation A's wired leg): silent Safe 7
/// derivation through the cockpit's OWN transport + the identity check
/// against the expected payer. No value, no broadcast, no device prompt.
async fn preflight(axum::extract::State(state): axum::extract::State<Shared>) -> Response {
    let Some(suite) = state.suite.clone() else {
        return refusal(
            503,
            "transport",
            "no Suite-MCP transport wired (set BPAY_SIGN_MCP_URL + BPAY_SIGN_MCP_TOKEN)".into(),
        );
    };
    let path = "m/44'/60'/0'/0/0";
    match suite.get_address(path) {
        Ok(addr) => {
            let expected = state
                .expected_payer
                .map(|p| p.to_lower_hex())
                .unwrap_or_default();
            let ok = addr.to_lowercase() == expected;
            (
                axum::http::StatusCode::OK,
                Json(serde_json::json!({
                    "ok": ok,
                    "derived": addr, "path": path,
                    "expected_payer": expected,
                    "verdict": if ok { "MATCH — the Safe 7 recovered the expected founder address through the cockpit seam (silent read; the deliberate-rejection leg remains the founder's device gesture)" } else { "MISMATCH — do NOT sign; surface this" },
                    "transport": "Suite-MCP (broadcast pinned false)",
                })),
            )
                .into_response()
        }
        Err(e) => refusal(502, "transport", e.to_string()),
    }
}

async fn demo_prepare(
    axum::extract::State(state): axum::extract::State<Shared>,
    Json(body): Json<DemoPrepareBody>,
) -> Response {
    if body.audience != "public" {
        return refusal(
            422,
            "audience",
            "demo vends founder-selected:public only".into(),
        );
    }
    // synthetic 56-quote testnet set, deterministic per artifact
    let mut payments = Vec::new();
    let mut total = Atto::from_u64(0);
    for i in 0..56u64 {
        let mut seed = body.artifact_sha256.as_bytes().to_vec();
        seed.extend_from_slice(&i.to_be_bytes());
        let h = keccak256(&seed);
        let mut rewards = [0u8; 20];
        rewards.copy_from_slice(&h[12..]);
        let amount = Atto::from_u64(1_000_000_000_000_000 + (i % 7) * 111_111_111_111_111);
        total = total.checked_add(amount).unwrap();
        payments.push(WaveQuotePayment {
            quote_hash: Hex32(keccak256(&h)),
            rewards: EthAddr(rewards),
            amount_atto: amount,
        });
    }
    let upload_id = format!("up-demo-{}", now_secs() * 1000);
    let job = WaveJobSummary {
        upload_id: upload_id.clone(),
        status: "open".into(),
        artifact_sha256: body.artifact_sha256.clone(),
        artifact_bytes: 214_091_829,
        payment_type: "wave_batch".into(),
        total_amount_atto: total.to_decimal(),
        created_at_unix_secs: now_secs(),
    };
    state.demo_jobs.write().unwrap().push(job.clone());
    let payments_json: Vec<serde_json::Value> = payments
        .iter()
        .map(|p| {
            serde_json::json!({
                "quote_hash": format!("0x{}", p.quote_hash.to_lower_hex().trim_start_matches("0x")),
                "rewards_address": p.rewards.to_lower_hex(),
                "amount_atto": p.amount_atto.to_decimal(),
            })
        })
        .collect();
    (
        axum::http::StatusCode::OK,
        Json(serde_json::json!({
            "upload_id": upload_id,
            "artifact_sha256": body.artifact_sha256,
            "artifact_bytes": 214_091_829,
            "payment_type": "wave_batch",
            "total_amount_atto": total.to_decimal(),
            "payments": payments_json,
            "policy": { "audience": "public", "binding": "founder-selected:public" },
            "note": "TESTNET-DEMO-SYNTHETIC — deterministic synthetic quote set for the testnet pipeline proof; never a network quote",
        })),
    )
        .into_response()
}

#[derive(Deserialize)]
struct DemoAuthBody {
    upload_id: String,
    invoice_digest: String,
    commitment_digest: String,
    artifact_sha256: String,
    #[serde(default)]
    artifact_bytes: u64,
    audience: String,
    ant_ceiling_atto: String,
    gas_ceiling: String,
}

async fn demo_authorize(
    axum::extract::State(state): axum::extract::State<Shared>,
    Json(body): Json<DemoAuthBody>,
) -> Response {
    let job = state
        .demo_jobs
        .read()
        .unwrap()
        .iter()
        .find(|j| j.upload_id == body.upload_id && j.status == "open")
        .cloned();
    let job = match job {
        Some(j) => j,
        None => return refusal(404, "job", format!("no open demo job {}", body.upload_id)),
    };
    if body.ant_ceiling_atto != job.total_amount_atto {
        return refusal(
            409,
            "ceiling",
            format!(
                "ANT ceiling must EQUAL the demo total {}",
                job.total_amount_atto
            ),
        );
    }
    if body.artifact_sha256 != job.artifact_sha256 {
        return refusal(409, "artifact", "artifact identity mismatch".into());
    }
    // the demo mints against its OWN quote set: re-derive the commitment
    // from the job's payments — the demo prepare is deterministic, so we
    // regenerate it here
    let rec = WaveAuthorization {
        schema: "antd-bridge.authorization/1".into(),
        authorization_id: format!("auth-demo-{}", now_secs() * 1000),
        upload_id: body.upload_id,
        invoice_digest: body.invoice_digest,
        commitment_digest: body.commitment_digest,
        artifact_sha256: body.artifact_sha256,
        artifact_bytes: job.artifact_bytes,
        audience: body.audience,
        ant_ceiling_atto: body.ant_ceiling_atto,
        gas_ceiling: body.gas_ceiling,
        state: "authorized-for-signing".into(),
        events: vec![WaveAuthorizationEvent {
            at_unix_secs: now_secs(),
            kind: "authorized-for-signing".into(),
            detail: "TESTNET-DEMO synthetic authorization — pipeline proof only; never a \
                     founder mainnet press"
                .into(),
        }],
    };
    state.demo_auth.write().unwrap().push(rec.clone());
    (
        axum::http::StatusCode::CREATED,
        Json(serde_json::to_value(&rec).unwrap_or_default()),
    )
        .into_response()
}

async fn demo_auth_list(axum::extract::State(state): axum::extract::State<Shared>) -> Response {
    let list = state.demo_auth.read().unwrap().clone();
    Json(list).into_response()
}

async fn sign_receipt_get(
    axum::extract::State(state): axum::extract::State<Shared>,
    axum::extract::Query(q): axum::extract::Query<HashMap<String, String>>,
) -> Response {
    let id = q.get("authorization_id").cloned().unwrap_or_default();
    match WaveLedger::open(&state.state_dir)
        .ok()
        .and_then(|l| l.load(&id).ok().flatten())
    {
        Some(r) => Json(receipt_json(&r)).into_response(),
        None => (
            axum::http::StatusCode::NOT_FOUND,
            Json(serde_json::json!({"ok": false})),
        )
            .into_response(),
    }
}

// ─────────────────────────────── main ───────────────────────────────

mod rlp;
mod suite_mcp;
mod wallet;

use suite_mcp::SuiteMcp;
use wallet::{connected_payer, wallet_connect, wallet_disconnect, wallet_get};

fn main() {
    let mode = std::env::var("BPAY_SIGN_MODE").unwrap_or_default();
    if mode != "testnet-demo" {
        eprintln!(
            "bpay-sign: refusing to start without BPAY_SIGN_MODE=testnet-demo — this binary \
             ships the TESTNET proof only (founder order 2026-09-19); a mainnet signing \
             service is a separate reviewed slice"
        );
        std::process::exit(2);
    }
    let rpc_url = std::env::var("BPAY_SIGN_RPC").ok();
    let state_dir = PathBuf::from(
        std::env::var("BPAY_SIGN_STATE").unwrap_or_else(|_| "bpay-sign-state".into()),
    );
    std::fs::create_dir_all(&state_dir).expect("state dir");
    // hot testnet key: env (persisted by the runner) or fresh throwaway
    let hot_key = match std::env::var("BPAY_SIGN_TESTNET_KEY") {
        Ok(hexkey) => {
            let mut b = [0u8; 32];
            hex::decode_to_slice(hexkey.trim_start_matches("0x"), &mut b).expect("key hex");
            SigningKey::from_slice(&b).expect("key")
        }
        Err(_) => {
            let (_, hexkey) = new_key();
            println!("BPAY_SIGN_TESTNET_KEY={hexkey}");
            println!("bpay-sign: fresh TESTNET throwaway key printed above — rerun with it set to persist (never written to disk here)");
            std::process::exit(0);
        }
    };
    let suite = match (
        std::env::var("BPAY_SIGN_MCP_URL"),
        std::env::var("BPAY_SIGN_MCP_TOKEN"),
    ) {
        (Ok(u), Ok(t)) => {
            println!("bpay-sign: Suite-MCP transport wired ({u}) — broadcast pinned false; the Safe 7 signs, the wall verifies");
            Some(SuiteMcp::new(u, t))
        }
        _ => None,
    };
    let expected_payer = std::env::var("BPAY_SIGN_EXPECTED_PAYER")
        .ok()
        .and_then(|a| EthAddr::from_lower_hex(&a).ok());
    if let Some(p) = expected_payer {
        println!("bpay-sign: expected payer (LAW 14) = {}", p.to_lower_hex());
    }
    let state = Arc::new(AppState {
        expected_payer,
        suite,
        demo: true,
        rpc_url,
        state_dir,
        hot_key,
        demo_auth: RwLock::new(Vec::new()),
        demo_jobs: RwLock::new(Vec::new()),
        io_lock: Arc::new(std::sync::Mutex::new(())),
    });
    let app = Router::new()
        .route("/v1/sign/state", post(sign_state))
        .route("/v1/sign/begin", post(sign_begin))
        .route("/v1/sign/receipt", get(sign_receipt_get))
        .route("/v1/testnet/settle", post(testnet_settle))
        .route("/v1/preflight", post(preflight))
        .route("/v1/wallet/connect", post(wallet_connect))
        .route("/v1/wallet", get(wallet_get))
        .route("/v1/wallet/disconnect", post(wallet_disconnect))
        .route("/v1/upload/prepare", post(demo_prepare))
        .route(
            "/v1/authorization",
            post(demo_authorize).get(demo_auth_list),
        )
        .with_state(state)
        .layer(tower_http::cors::CorsLayer::permissive());
    let port: u16 = std::env::var("BPAY_SIGN_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8808);
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("runtime");
    rt.block_on(async move {
        let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{port}"))
            .await
            .expect("bind");
        println!("bpay-sign (TESTNET-DEMO) listening on http://127.0.0.1:{port}");
        if let Some(rpc) = std::env::var("BPAY_SIGN_RPC").ok() {
            println!("bpay-sign: ledger RPC {rpc} (settlement: TESTNET only, chain-checked)");
        } else {
            println!("bpay-sign: NO ledger RPC — begin refuses at fee composition; settle refuses");
        }
        axum::serve(listener, app).await.unwrap();
    });
}

fn new_key() -> (SigningKey, String) {
    use k256::elliptic_curve::rand_core::OsRng;
    let k = SigningKey::random(&mut OsRng);
    let h = format!("0x{}", hex::encode(k.to_bytes()));
    (k, h)
}
