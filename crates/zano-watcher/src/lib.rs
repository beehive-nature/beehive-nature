//! Zano sense adapter — a **view-only wallet scanner**, not a block parser.
//!
//! Zano is a confidential chain: an outside observer sees neither amounts
//! nor asset ids. Observation therefore requires the wallet layer — a
//! view-only wallet per escrow multisig (the host-safe restore in
//! `chain_zano::view`, vector-proven) served over Zano's wallet RPC. This
//! crate polls that RPC (`getbalance`, verified against
//! `wallet_rpc_server.h` / `wallet_public_structs_defs.h`) and maps
//! observations to the normalizer's `RawChainAction`.
//!
//! Division of knowledge, deliberate:
//! - the CHAIN knows balances: the escrow asset and the native ZANO fee
//!   buffer (§9.2 needs both — `getbalance` reports both in one call);
//! - the ORDER knows identities: buyer/seller DIDs, order id, which
//!   multisig belongs to it. The chain cannot reveal these (that is the
//!   point of a confidential chain), so [`OrderContext`] supplies them.
//!   In the production design each escrow IS its own multisig wallet, so
//!   the order↔wallet binding is structural. (Zano also exposes
//!   `payment_id` lookup via `get_payments` for flows that need in-band
//!   binding; not used here.)
//!
//! The funding check itself lives in `escrow-core`; this crate reports
//! what it sees and never invents what it doesn't (`fee_buffer_zano` is
//! the *observed* native balance — zero is reported as zero).
//!
//! The HF6 transfer read path lives in [`hf6`]: `get_recent_txs_and_info3`,
//! (payment_id, asset_id) deposit attribution, the three named refusals,
//! and read-only gateway types. Its module doc is that lane's contract.

#![forbid(unsafe_code)]

pub mod hf6;

use std::fmt;

use normalizer::RawChainAction;
use serde_json::{json, Value};
use shared_types::SourceChain;

pub use hf6::{
    attribute_deposits, hf6_readiness, parse_recent_txs, readiness_facts, DepositAttribution,
    Hf6Error, Subtransfer, TransferEntry, WalletTx, HF6_HEIGHT, HF6_MIN_VERSION,
};

/// What the order (not the chain) knows about an escrow being watched.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrderContext {
    pub order_id: String,
    pub buyer_did: String,
    pub seller_did: String,
    /// The escrow multisig wallet's address (the wallet the RPC serves).
    pub multisig_address: String,
    /// Asset id (hex) the escrow is denominated in (e.g. testnet fUSD).
    pub asset_id: String,
    /// The escrow's expected payment id — HF6 attribution keys on
    /// (payment_id, asset_id); this is the order-known half of that key.
    pub payment_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WatcherError {
    /// Transport-level failure talking to the wallet RPC.
    Http(String),
    /// The RPC answered with a JSON-RPC error object.
    Rpc(String),
    /// The response parsed as JSON but did not carry the expected shape.
    BadResponse(&'static str),
}

impl fmt::Display for WatcherError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WatcherError::Http(e) => write!(f, "wallet rpc transport: {e}"),
            WatcherError::Rpc(e) => write!(f, "wallet rpc error: {e}"),
            WatcherError::BadResponse(what) => write!(f, "unexpected rpc response: {what}"),
        }
    }
}

impl std::error::Error for WatcherError {}

/// One observation of the watched wallet's balances (atomic units).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BalanceObservation {
    /// Unlocked amount of the escrow asset.
    pub asset_unlocked: u64,
    /// Unlocked native ZANO (the §9.2 fee buffer), as observed.
    pub native_unlocked: u64,
}

pub struct ZanoWatcher {
    rpc_url: String,
    agent: ureq::Agent,
}

impl ZanoWatcher {
    /// `rpc_url` is the wallet RPC endpoint, e.g. `http://127.0.0.1:12233/json_rpc`.
    pub fn new(rpc_url: impl Into<String>) -> Self {
        ZanoWatcher {
            rpc_url: rpc_url.into(),
            agent: ureq::agent(),
        }
    }

    /// One `getbalance` poll → balances of (escrow asset, native ZANO).
    pub fn observe_balances(&self, asset_id: &str) -> Result<BalanceObservation, WatcherError> {
        let body = json!({"jsonrpc": "2.0", "id": "0", "method": "getbalance"});
        let response = self
            .agent
            .post(&self.rpc_url)
            .send_string(&body.to_string())
            .map_err(|e| WatcherError::Http(e.to_string()))?
            .into_string()
            .map_err(|e| WatcherError::Http(e.to_string()))?;
        let parsed: Value =
            serde_json::from_str(&response).map_err(|_| WatcherError::BadResponse("not JSON"))?;
        parse_balances(&parsed, asset_id)
    }

    /// Poll once and, if the escrow asset has arrived, produce the
    /// `RawChainAction` the normalizer maps to `OrderFunded` (§9.3).
    ///
    /// `observed_at_unix` is the observation wall-time (the caller owns the
    /// clock); it becomes the event timestamp and part of the synthetic
    /// observation id (balance observations are not block-anchored, so
    /// `block_num` is 0 and `tx_id` identifies the observation, not a tx).
    pub fn observe_funding(
        &self,
        ctx: &OrderContext,
        observed_at_unix: i64,
    ) -> Result<Option<RawChainAction>, WatcherError> {
        let obs = self.observe_balances(&ctx.asset_id)?;
        Ok(funding_action(ctx, obs, observed_at_unix))
    }

    /// The HF6 start gate: refuse to scan unless the daemon reports
    /// version ≥ 2.2.1.501 and height ≥ 3,833,000. Probes `get_info` on the
    /// same RPC endpoint; a probe that cannot read BOTH facts is a named
    /// refusal — no fallback.
    pub fn require_hf6(&self) -> Result<(), Hf6Error> {
        let body = json!({"jsonrpc": "2.0", "id": "0", "method": "get_info"});
        let response = self
            .agent
            .post(&self.rpc_url)
            .send_string(&body.to_string())
            .map_err(|_| Hf6Error::ReadinessUnreadable { what: "transport" })
            .and_then(|r| {
                r.into_string()
                    .map_err(|_| Hf6Error::ReadinessUnreadable { what: "transport" })
            })
            .and_then(|s| {
                serde_json::from_str::<Value>(&s)
                    .map_err(|_| Hf6Error::ReadinessUnreadable { what: "not JSON" })
            })?;
        let (version, height) = readiness_facts(&response)?;
        hf6_readiness(&version, height)
    }

    /// The HF6 read path: one `get_recent_txs_and_info3` scan, refused
    /// before it starts unless the daemon passes [`require_hf6`], parsed
    /// with the module's named refusals, attributed on (payment_id,
    /// asset_id), and mapped to `OrderFunded` raw actions for the order's
    /// own key. Gateway entries parse and are skipped (read path only).
    ///
    /// NOTE: the `info3` parameter surface is UNVERIFIED at source — the
    /// call sends no params and relies on wallet defaults; when the params
    /// are verified they land here, not in the pure module.
    pub fn scan_deposits(&self, ctx: &OrderContext) -> Result<Vec<RawChainAction>, Hf6Error> {
        self.require_hf6()?;
        let body = json!({"jsonrpc": "2.0", "id": "0", "method": "get_recent_txs_and_info3"});
        let response = self
            .agent
            .post(&self.rpc_url)
            .send_string(&body.to_string())
            .map_err(|_| Hf6Error::BadResponse("transport"))?
            .into_string()
            .map_err(|_| Hf6Error::BadResponse("transport"))?;
        let parsed: Value =
            serde_json::from_str(&response).map_err(|_| Hf6Error::BadResponse("not JSON"))?;
        let txs = parse_recent_txs(&parsed)?;
        let attrs = attribute_deposits(&txs);
        Ok(deposit_actions(ctx, &txs, &attrs))
    }
}

/// Pure mapping: an observation with no asset yet is `None`; an observed
/// asset balance becomes the §9.3 `zano:transfer` raw action, carrying the
/// native balance as the observed fee buffer (zero stays zero).
pub fn funding_action(
    ctx: &OrderContext,
    obs: BalanceObservation,
    observed_at_unix: i64,
) -> Option<RawChainAction> {
    if obs.asset_unlocked == 0 {
        return None;
    }
    Some(RawChainAction {
        source_chain: SourceChain::Zano,
        contract: "zano".to_string(),
        action_name: "transfer".to_string(),
        data: json!({
            "order_id": ctx.order_id,
            "buyer_did": ctx.buyer_did,
            "seller_did": ctx.seller_did,
            "amount": obs.asset_unlocked,
            "asset_id": ctx.asset_id,
            "fee_buffer_zano": obs.native_unlocked,
            "multisig_address": ctx.multisig_address,
            "timestamp": observed_at_unix,
        }),
        block_num: 0,
        tx_id: format!("balance-{}-{}", ctx.order_id, observed_at_unix),
    })
}

/// Pure mapping: the order's own (payment_id, asset_id) attribution becomes
/// a block-anchored `zano:transfer` raw action per contributing tx — the
/// deposit's `tx_hash` is the REAL tx id and `block_num` its height (unlike
/// balance observations, which stay synthetic). The observed native balance
/// is not available per-tx here; the fee buffer stays the balance-poller's
/// fact (`fee_buffer_zano: None` on this path).
pub fn deposit_actions(
    ctx: &OrderContext,
    txs: &[WalletTx],
    attrs: &[DepositAttribution],
) -> Vec<RawChainAction> {
    let Some(own) = attrs
        .iter()
        .find(|d| d.payment_id == ctx.payment_id && d.asset_id.eq_ignore_ascii_case(&ctx.asset_id))
    else {
        return Vec::new();
    };
    let credited = own.credited();
    if credited == 0 {
        return Vec::new();
    }
    txs.iter()
        .filter(|tx| {
            let TransferEntry::Ordinary {
                subtransfers_by_pid,
            } = &tx.entry
            else {
                return false;
            };
            subtransfers_by_pid.iter().any(|s| {
                s.payment_id == ctx.payment_id && s.asset_id.eq_ignore_ascii_case(&ctx.asset_id)
            })
        })
        .map(|tx| RawChainAction {
            source_chain: SourceChain::Zano,
            contract: "zano".to_string(),
            action_name: "transfer".to_string(),
            data: json!({
                "order_id": ctx.order_id,
                "buyer_did": ctx.buyer_did,
                "seller_did": ctx.seller_did,
                "amount": credited,
                "asset_id": ctx.asset_id,
                "payment_id": ctx.payment_id,
                "multisig_address": ctx.multisig_address,
                "timestamp": tx.timestamp,
            }),
            block_num: tx.height,
            tx_id: tx.tx_hash.clone(),
        })
        .collect()
}

/// Parse a `getbalance` response (shape per `COMMAND_RPC_GET_BALANCE`:
/// `result.unlocked_balance` = native unlocked; `result.balances[]` with
/// `asset_info.asset_id` + `unlocked` per asset).
fn parse_balances(response: &Value, asset_id: &str) -> Result<BalanceObservation, WatcherError> {
    if let Some(err) = response.get("error") {
        return Err(WatcherError::Rpc(err.to_string()));
    }
    let result = response
        .get("result")
        .ok_or(WatcherError::BadResponse("missing result"))?;
    let native_unlocked = result
        .get("unlocked_balance")
        .and_then(Value::as_u64)
        .ok_or(WatcherError::BadResponse("missing unlocked_balance"))?;

    let mut asset_unlocked = 0u64;
    if let Some(entries) = result.get("balances").and_then(Value::as_array) {
        for entry in entries {
            let id = entry
                .get("asset_info")
                .and_then(|i| i.get("asset_id"))
                .and_then(Value::as_str)
                .ok_or(WatcherError::BadResponse("balance entry without asset_id"))?;
            if id.eq_ignore_ascii_case(asset_id) {
                asset_unlocked = entry
                    .get("unlocked")
                    .and_then(Value::as_u64)
                    .ok_or(WatcherError::BadResponse("balance entry without unlocked"))?;
            }
        }
    }
    Ok(BalanceObservation {
        asset_unlocked,
        native_unlocked,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use normalizer::normalize;
    use shared_types::{EventPayload, EventType};

    fn ctx() -> OrderContext {
        OrderContext {
            order_id: "order-9".into(),
            buyer_did: "did:plc:buyer".into(),
            seller_did: "did:plc:seller".into(),
            multisig_address: "msig-addr-9".into(),
            asset_id: "625829188fa787fb71153aa09d251c162be072eaf5402888032d014d7ad4bf9e".into(), // TESTNET-ONLY public asset id fixture
            payment_id: "pid-1".into(),
        }
    }

    /// Canned response shaped exactly per COMMAND_RPC_GET_BALANCE (source-
    /// verified fields), as the live testnet wallet returns it.
    fn balance_response(native_unlocked: u64, fusd_unlocked: u64) -> Value {
        serde_json::json!({
            "id": "0",
            "jsonrpc": "2.0",
            "result": {
                "balance": native_unlocked,
                "unlocked_balance": native_unlocked,
                "balances": [
                    {
                        "asset_info": {
                            "asset_id": "d6329b5b1f7c0805b5c345f4957554002a2f557845f64d7645dae0e051a6498a", // TESTNET-ONLY public asset id fixture
                            "ticker": "ZANO",
                            "decimal_point": 12
                        },
                        "total": native_unlocked,
                        "unlocked": native_unlocked
                    },
                    {
                        "asset_info": {
                            "asset_id": "625829188fa787fb71153aa09d251c162be072eaf5402888032d014d7ad4bf9e", // TESTNET-ONLY public asset id fixture
                            "ticker": "FUSD",
                            "decimal_point": 4
                        },
                        "total": fusd_unlocked,
                        "unlocked": fusd_unlocked
                    }
                ]
            }
        })
    }

    #[test]
    fn parses_both_balances_from_source_shaped_response() {
        let obs = parse_balances(
            &balance_response(1_000_000_000_000, 1_000_000),
            &ctx().asset_id,
        )
        .unwrap();
        assert_eq!(obs.native_unlocked, 1_000_000_000_000);
        assert_eq!(obs.asset_unlocked, 1_000_000);
    }

    #[test]
    fn absent_asset_is_zero_not_an_error() {
        let response = serde_json::json!({
            "result": { "balance": 5, "unlocked_balance": 5, "balances": [] }
        });
        let obs = parse_balances(&response, &ctx().asset_id).unwrap();
        assert_eq!(obs.asset_unlocked, 0);
        assert_eq!(obs.native_unlocked, 5);
    }

    #[test]
    fn rpc_error_and_malformed_responses_are_typed_errors() {
        let err = serde_json::json!({"error": {"code": -1, "message": "boom"}});
        assert!(matches!(
            parse_balances(&err, "x"),
            Err(WatcherError::Rpc(_))
        ));
        let bad = serde_json::json!({"result": {"balances": []}});
        assert_eq!(
            parse_balances(&bad, "x"),
            Err(WatcherError::BadResponse("missing unlocked_balance"))
        );
    }

    #[test]
    fn no_asset_yet_means_no_action() {
        let obs = BalanceObservation {
            asset_unlocked: 0,
            native_unlocked: 999,
        };
        assert_eq!(funding_action(&ctx(), obs, 1_782_000_200), None);
    }

    #[test]
    fn observation_normalizes_to_order_funded_with_observed_fee_buffer() {
        let obs = BalanceObservation {
            asset_unlocked: 1_000_000,
            native_unlocked: 1_000_000_000_000,
        };
        let raw = funding_action(&ctx(), obs, 1_782_000_200).unwrap();
        assert_eq!(raw.contract, "zano");
        assert_eq!(raw.action_name, "transfer");

        let event = normalize(raw).unwrap().expect("mapped");
        assert_eq!(event.event_type, EventType::OrderFunded);
        assert_eq!(event.timestamp, 1_782_000_200);
        let EventPayload::Order(o) = &event.payload else {
            panic!("expected Order payload");
        };
        assert_eq!(o.amount, 1_000_000);
        assert_eq!(o.fee_buffer_zano, Some(1_000_000_000_000));
        assert_eq!(o.order_id, "order-9");
    }

    #[test]
    fn zero_native_balance_is_reported_not_invented() {
        let obs = BalanceObservation {
            asset_unlocked: 1_000_000,
            native_unlocked: 0,
        };
        let raw = funding_action(&ctx(), obs, 1).unwrap();
        let event = normalize(raw).unwrap().unwrap();
        let EventPayload::Order(o) = &event.payload else {
            panic!("expected Order payload");
        };
        // Observed zero rides through as zero — escrow-core will refuse it.
        assert_eq!(o.fee_buffer_zano, Some(0));
    }

    /// The HF6 deposit path: attribution on (pid, asset) becomes a
    /// block-anchored action with the REAL tx hash — named values asserted.
    #[test]
    fn deposit_attribution_maps_to_block_anchored_action() {
        let response = serde_json::json!({
            "result": {"transfers": [{
                "tx_hash": "real-tx-hash-1",
                "height": 3833500,
                "timestamp": 1790000000,
                "remote_addresses": ["Zan...buyer"],
                "payment_id": "",
                "subtransfers_by_pid": [
                    {"payment_id": "pid-1", "asset_id": ctx().asset_id, "amount": 1_234, "is_income": true},
                    {"payment_id": "pid-2", "asset_id": ctx().asset_id, "amount": 9_999, "is_income": true}
                ]
            }]}
        });
        let txs = parse_recent_txs(&response).unwrap();
        let attrs = attribute_deposits(&txs);
        let actions = deposit_actions(&ctx(), &txs, &attrs);
        assert_eq!(actions.len(), 1, "only the order's own pid maps");
        let raw = &actions[0];
        assert_eq!(
            raw.tx_id, "real-tx-hash-1",
            "the REAL tx id, not a synthetic observation"
        );
        assert_eq!(raw.block_num, 3_833_500, "block-anchored height");
        assert_eq!(
            raw.data["amount"], 1_234,
            "credited = the pid-1 income only"
        );
        assert_eq!(
            raw.data["payment_id"], "pid-1",
            "the attribution key rides the action"
        );
        let event = normalize(raw.clone()).unwrap().unwrap();
        assert_eq!(
            event.event_type,
            EventType::OrderFunded,
            "normalizes as funding"
        );
    }
}
