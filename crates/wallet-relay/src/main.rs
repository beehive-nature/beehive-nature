//! Phase-0 relay entrypoint. Config is env-only (stateless, D5):
//!   RELAY_GATEWAYS   comma-separated preference list (default: self-hosted + public fallback)
//!   RELAY_FORWARD_TO bundler base URL for validated Arweave-routed items (unset = validate-only)
//!   RELAY_PORT       listen port (default 8080)
//! No key material is read, held, or accepted — by construction.

use wallet_relay::gateway::GatewayPool;
use wallet_relay::{app, AppState};

#[tokio::main]
async fn main() {
    let pool = match std::env::var("RELAY_GATEWAYS") {
        Ok(list) => {
            let urls: Vec<String> = list.split(',').map(|s| s.trim().to_string()).collect();
            GatewayPool::new(&urls).expect("RELAY_GATEWAYS must name >=2 distinct gateways (a single gateway is the hard-coded shape)")
        }
        Err(_) => GatewayPool::default_pool(),
    };
    let forward_to = std::env::var("RELAY_FORWARD_TO").ok();
    let port: u16 = std::env::var("RELAY_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("bind relay port");
    eprintln!("wallet-relay listening on :{port} (forward: {})", forward_to.as_deref().unwrap_or("validate-only"));
    axum::serve(listener, app(AppState::new(pool, forward_to)))
        .await
        .expect("serve");
}
