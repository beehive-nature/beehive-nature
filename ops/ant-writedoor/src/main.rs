//! ant-writedoor binary. Loopback-bind only (Caddy fronts the door on the
//! box — nodes-on-the-box law, same shape as x402-door); never a public
//! interface.
//!
//! Until the `ant-wiring` slice lands, the default gateway is UNWIRED: the
//! GET probe answers non-200 and every prepare refuses by name — the honest
//! closed-door contract. `--mock` serves the shape-only MockGateway for
//! local demos and the adapter's dev loop; it can touch no network.

use std::net::SocketAddr;

use ant_writedoor::{Door, DoorConfig, MockGateway, UnwiredGateway};
use std::sync::Arc;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mock = std::env::args().any(|a| a == "--mock");
    let cfg = DoorConfig {
        max_bytes: env_or("ANT_DOOR_MAX_BYTES", "33554432").parse()?,
        allowed_origin: env_or("ANT_DOOR_ALLOWED_ORIGIN", "https://skaists.dev"),
    };
    let listen: SocketAddr = env_or("ANT_DOOR_LISTEN", "127.0.0.1:8095").parse()?;
    let gateway: Arc<dyn ant_writedoor::AntGateway> = if mock {
        eprintln!("ant-writedoor: MOCK gateway (shape-only, no network) on {listen}");
        Arc::new(MockGateway::new())
    } else {
        eprintln!(
            "ant-writedoor: UNWIRED gateway (refuses by name until the ant-wiring slice) on {listen}"
        );
        Arc::new(UnwiredGateway)
    };
    let door = Door::new(cfg, gateway);
    let listener = tokio::net::TcpListener::bind(listen).await?;
    axum::serve(listener, door.router()).await?;
    Ok(())
}
