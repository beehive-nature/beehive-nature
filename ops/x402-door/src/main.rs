//! The x402-door binary: config load -> journal open -> LIVE facilitator
//! wiring (x402-facilitator-local, reused not forked) -> bind loopback
//! (Caddy fronts the same-origin door on the box; this binary never binds
//! a public interface — nodes-on-the-box law).
//!
//! Testnet runbook + ops-wallet funding gesture: see README.md. There is
//! deliberately no production path in this binary.

use std::path::PathBuf;

#[derive(serde::Deserialize)]
#[cfg_attr(windows, allow(dead_code))]
struct RunConfig {
    bind: String,
    journal_root: String,
    daily_gas_cap_wei: u64,
    reserved_gas_wei: u64,
    ops_float_available_wei: u64,
    facilitator_chains_config: PathBuf,
    facilitator_schemes_config: PathBuf,
}

#[cfg(unix)]
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cfg_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "ops/x402-door/door.config.json".to_string());
    let raw = std::fs::read_to_string(&cfg_path)?;
    let rc: RunConfig = serde_json::from_str(&raw)?;

    let journal = Arc::new(Journal::open(
        PathBuf::from(&rc.journal_root).as_path(),
        rc.daily_gas_cap_wei,
    )?);
    let inner = live_facilitator::build(&rc).await?;
    let facilitator = Arc::new(inner);
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

/// The live adapter lives in its own module so its upstream-facing glue is
/// clearly delimited; every protocol concern is upstream's.
#[cfg(unix)]
mod live_facilitator {
    use super::RunConfig;
    use x402_door::orchestrator::FacilitatorSettle;
    use x402_door::orchestrator::SettlementFacilitator;

    pub async fn build(rc: &RunConfig) -> Result<Live, String> {
        let chains_raw = std::fs::read_to_string(&rc.facilitator_chains_config)
            .map_err(|e| format!("chains config: {e}"))?;
        let chains_config: serde_json::Value =
            serde_json::from_str(&chains_raw).map_err(|e| format!("chains config json: {e}"))?;
        let schemes_raw = std::fs::read_to_string(&rc.facilitator_schemes_config)
            .map_err(|e| format!("schemes config: {e}"))?;
        let schemes_config: serde_json::Value =
            serde_json::from_str(&schemes_raw).map_err(|e| format!("schemes config json: {e}"))?;
        let chain_registry = x402_types::chain::ChainRegistry::from_config(&chains_config)
            .await
            .map_err(|e| format!("chain registry: {e}"))?;
        let blueprints = x402_types::scheme::SchemeBlueprints::new()
            .and_register(x402_chain_eip155::V2Eip155Exact)
            .and_register(x402_chain_eip155::V2Eip155Upto);
        let registry =
            x402_types::scheme::SchemeRegistry::build(chain_registry, blueprints, &schemes_config);
        Ok(Live(x402_facilitator_local::FacilitatorLocal::new(
            registry,
        )))
    }

    pub struct Live(x402_facilitator_local::FacilitatorLocal<x402_types::scheme::SchemeRegistry>);

    impl SettlementFacilitator for Live {
        fn verify(&self, request: &serde_json::Value) -> Result<(), String> {
            let req = request.clone();
            tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(async {
                    use x402_types::facilitator::Facilitator;
                    let resp = self
                        .0
                        .verify(&x402_types::proto::VerifyRequest(req))
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
                    match self.0.settle(&x402_types::proto::SettleRequest(req)).await {
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
                        Err(e) => FacilitatorSettle::Ambiguous {
                            reason: format!("facilitator settle transport: {e}"),
                        },
                    }
                })
            })
        }
    }
}

#[cfg(windows)]
fn main() {
    // Upstream x402-facilitator-local uses tokio::signal::unix (Linux-only
    // compile surface — upstream Dockerfile target). The door LAWS
    // (journal/orchestrator/wire) and the acceptance suite are
    // platform-independent; the live binary targets the Linux box/CI.
    eprintln!("x402-door: the live facilitator wiring targets Unix (upstream tokio::signal::unix). Library + tests run everywhere; run the binary on the box/CI.");
    std::process::exit(1);
}
