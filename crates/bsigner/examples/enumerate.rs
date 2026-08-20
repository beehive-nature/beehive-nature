//! C1 acceptance receipt: enumerate attached Trezors and read one address.
//!
//! Run:  cargo run -p bsigner --example enumerate
//!
//! Unattended this prints "no device" and exits 0 — that is a valid receipt
//! showing the HID/transport path executes. A real-device run happens only
//! with the founder present; the emulator is the unattended alternative.
//!
//! This example cannot sign. There is no signing capability in the crate.

use bsigner::{chain_registry, device};

fn main() {
    println!("bsigner C1 receipt — {}", env!("CARGO_PKG_VERSION"));
    println!("no Suite, no WalletConnect in the dependency tree\n");

    println!("== chain registry ==");
    for c in chain_registry::EVM_CHAINS {
        match c.provenance {
            chain_registry::Provenance::VerifiedLive(d) => println!(
                "  {:<16} {:<18} chain_id {:<7} verified live {}",
                c.name,
                c.chain_key.to_string(),
                c.chain_id,
                d
            ),
            chain_registry::Provenance::Unverified(r) => {
                println!(
                    "  {:<16} {:<18} UNVERIFIED — {}",
                    c.name,
                    c.chain_key.to_string(),
                    r
                )
            }
        }
    }
    for c in chain_registry::ANTELOPE_CHAINS {
        println!("  {:<16} {}", c.name, c.chain_id_hex);
    }

    println!("\n== chain-id law (type-enforced) ==");
    match chain_registry::EXSAT_MAINNET.verify_chain_id(7200) {
        Ok(v) => println!("  exSat  eth_chainId 7200 -> VERIFIED ({})", v.chain().name),
        Err(e) => println!("  exSat  unexpected: {e}"),
    }
    match chain_registry::EXSAT_MAINNET.verify_chain_id(1) {
        Ok(_) => println!("  FENCE BREACH: mismatched chain id verified"),
        Err(e) => println!("  exSat  eth_chainId 1    -> REFUSED: {e}"),
    }

    println!("\n== devices ==");
    let devices = device::enumerate();
    if devices.is_empty() {
        println!("  none attached (no hardware, no emulator listening)");
    } else {
        for d in &devices {
            println!(
                "  {}  [model {} | debug {}]",
                d.description, d.model, d.debug
            );
        }
    }

    println!("\n== ethereum address  m/44'/60'/0'/0/0 ==");
    match device::ethereum_address(&device::ETH_PATH_ACCOUNT_0) {
        Ok(addr) => println!("  {addr}"),
        Err(e) => println!("  unavailable: {e}"),
    }

    println!("\n== signing ==");
    println!("  refused by construction — C1 holds no signing capability");
}
