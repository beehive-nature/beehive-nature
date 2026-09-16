//! The Unix implementation: config -> journal -> LIVE facilitator wiring ->
//! loopback HTTP. Every protocol concern (signature validation, on-chain
//! settlement, nonce management) is upstream `x402-facilitator-local`'s;
//! this module only translates at the door's JSON seam and maps ambiguous
//! transport outcomes to the door's Unknown law.

use crate::RunConfig;
use std::sync::Arc;
use x402_door::journal::Journal;
use x402_door::orchestrator::{Door, DoorConfig, FacilitatorSettle, SettlementFacilitator};
use x402_door::wire;

pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let cfg_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "ops/x402-door/door.config.json".to_string());
    let raw = std::fs::read_to_string(&cfg_path)?;
    let rc: RunConfig = serde_json::from_str(&raw)?;

    let journal = Arc::new(Journal::open(
        std::path::PathBuf::from(&rc.journal_root).as_path(),
        rc.daily_gas_cap_wei,
    )?);
    let inner = live_facilitator::build(&rc).await?;
    let facilitator: Arc<live_facilitator::Live> = Arc::new(inner);
    let door = Arc::new(Door::new(
        journal,
        facilitator,
        DoorConfig {
            reserved_gas_wei: rc.reserved_gas_wei,
            ops_float_available_wei: rc.ops_float_available_wei,
        },
    ));

    let app = wire::router(wire::DoorState { door });
    let listener = tokio::net::TcpListener::bind(&rc.bind).await?;
    eprintln!(
        "x402-door listening on {} (loopback; Caddy fronts the same-origin door)",
        rc.bind
    );
    axum::serve(listener, app).await?;
    Ok(())
}

async fn build_registry(rc: &RunConfig) -> Result<x402_types::scheme::SchemeRegistry, String> {
    // The chains config IS an upstream Eip155ChainConfig (serde): RPC
    // endpoints + signers. Signers use $ENV references (upstream
    // LiteralOrEnv) — the ops wallet key rides env only, never files/git.
    let chains_raw = std::fs::read_to_string(&rc.facilitator_chain_config)
        .map_err(|e| format!("chains config: {e}"))?;
    let chain_config: x402_chain_eip155::chain::Eip155ChainConfig =
        serde_json::from_str(&chains_raw).map_err(|e| format!("chains config json: {e}"))?;
    let chain_id = chain_config.chain_id();
    use x402_types::chain::FromConfig;
    let provider = <x402_chain_eip155::chain::Eip155ChainProvider as FromConfig<
        x402_chain_eip155::chain::Eip155ChainConfig,
    >>::from_config(&chain_config)
    .await
    .map_err(|e| format!("provider from config: {e}"))?;
    let providers = std::collections::HashMap::from([(chain_id.clone(), provider)]);
    let chain_registry = x402_types::chain::ChainRegistry::new(providers);
    // Chartered scope ONLY, constructed in code so the registry cannot grow
    // by configuration accident: EVM exact + upto on the one configured chain.
    let blueprints = x402_types::scheme::SchemeBlueprints::new()
        .and_register(x402_chain_eip155::V2Eip155Exact)
        .and_register(x402_chain_eip155::V2Eip155Upto);
    let schemes = vec![
        x402_types::scheme::SchemeConfig::new(chain_id.clone(), 2, "exact".to_string()),
        x402_types::scheme::SchemeConfig::new(chain_id.clone(), 2, "upto".to_string()),
    ];
    Ok(x402_types::scheme::SchemeRegistry::build(
        chain_registry,
        blueprints,
        &schemes,
    ))
}

mod live_facilitator {
    use super::RunConfig;
    use x402_door::orchestrator::FacilitatorSettle;
    use x402_door::orchestrator::SettlementFacilitator;

    pub struct Live(x402_facilitator_local::FacilitatorLocal<x402_types::scheme::SchemeRegistry>);

    pub async fn build(rc: &RunConfig) -> Result<Live, String> {
        let registry = super::build_registry(rc).await?;
        Ok(Live(x402_facilitator_local::FacilitatorLocal::new(
            registry,
        )))
    }

    impl SettlementFacilitator for Live {
        fn verify(&self, request: &serde_json::Value) -> Result<(), String> {
            let req = request.clone();
            tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(async {
                    use x402_types::facilitator::Facilitator;
                    // The upstream wire wrappers are serde-only (private
                    // constructors BY DESIGN — the protocol is never
                    // hand-assembled), so the seam deserializes the verbatim
                    // request JSON into them.
                    let typed: x402_types::proto::VerifyRequest =
                        serde_json::from_value(req).map_err(|e| format!("request decode: {e}"))?;
                    let resp = self
                        .0
                        .verify(&typed)
                        .await
                        .map_err(|e| format!("facilitator verify: {e}"))?;
                    let v = serde_json::to_value(&resp).unwrap_or(serde_json::Value::Null);
                    if v.get("valid").and_then(|b| b.as_bool()).unwrap_or(false) {
                        Ok(())
                    } else {
                        Err(v
                            .get("reason")
                            .and_then(|r| r.as_str())
                            .unwrap_or("invalid")
                            .to_string())
                    }
                })
            })
        }

        fn settle(&self, request: &serde_json::Value) -> FacilitatorSettle {
            let req = request.clone();
            tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(async {
                    use x402_types::facilitator::Facilitator;
                    let typed: x402_types::proto::SettleRequest = match serde_json::from_value(req)
                    {
                        Ok(t) => t,
                        Err(e) => {
                            return FacilitatorSettle::Error {
                                reason: format!("request decode: {e}"),
                                network: "unknown".into(),
                            }
                        }
                    };
                    match self.0.settle(&typed).await {
                        Ok(resp) => {
                            let v = serde_json::to_value(&resp).unwrap_or(serde_json::Value::Null);
                            let success =
                                v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
                            if success {
                                FacilitatorSettle::Success {
                                    payer: v
                                        .get("payer")
                                        .and_then(|p| p.as_str())
                                        .unwrap_or("")
                                        .into(),
                                    transaction: v
                                        .get("transaction")
                                        .and_then(|p| p.as_str())
                                        .unwrap_or("")
                                        .into(),
                                    network: v
                                        .get("network")
                                        .and_then(|p| p.as_str())
                                        .unwrap_or("")
                                        .into(),
                                    actual_amount: None,
                                    gas_actual_wei: None,
                                }
                            } else {
                                FacilitatorSettle::Error {
                                    reason: v
                                        .get("error_reason")
                                        .and_then(|p| p.as_str())
                                        .unwrap_or("unknown settle failure")
                                        .into(),
                                    network: v
                                        .get("network")
                                        .and_then(|p| p.as_str())
                                        .unwrap_or("")
                                        .into(),
                                }
                            }
                        }
                        // Transport-level error: the request MAY have
                        // landed — the door's Unknown law, not a failure.
                        Err(e) => FacilitatorSettle::Ambiguous {
                            reason: format!("facilitator settle transport: {e}"),
                        },
                    }
                })
            })
        }
    }
}
