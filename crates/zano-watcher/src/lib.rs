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

#![forbid(unsafe_code)]

use std::fmt;

use normalizer::RawChainAction;
use serde_json::{json, Value};
use shared_types::SourceChain;

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
}
