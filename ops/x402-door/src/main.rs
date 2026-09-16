//! The x402-door binary: config load -> journal open -> LIVE facilitator
//! wiring (x402-facilitator-local, reused not forked) -> bind loopback
//! (Caddy fronts the same-origin door on the box; this binary never binds
//! a public interface — nodes-on-the-box law).
//!
//! Testnet runbook + ops-wallet funding gesture: see README.md. There is
//! deliberately no production path in this binary.
//!
//! Upstream `x402-facilitator-local` uses `tokio::signal::unix` — the live
//! wiring targets Unix (box/CI). The library + acceptance suite are
//! platform-independent. All Unix code lives in `imp` (own imports, so
//! Windows-side lint passes cannot strip them as unused).

#[cfg(all(unix, feature = "live-wiring"))]
mod imp;

#[cfg(all(unix, feature = "live-wiring"))]
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    imp::run().await
}

#[cfg(not(all(unix, feature = "live-wiring")))]
fn main() {
    eprintln!(
        "x402-door: the live facilitator wiring targets Unix (upstream uses \
         tokio::signal::unix). Library + acceptance suite run everywhere; \
         run the binary on the box/CI."
    );
    std::process::exit(1);
}
