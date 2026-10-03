//! Anvil wrapper for LocalDevnet: ensures Anvil runs with Arbitrum One L2 realistic
//! base fee (0.1 Gwei / 100_000_000 wei) so local development reflects production
//! gas conditions and adheres to the 0.0002 ETH standing gas ceiling.
//!
//! ARBITRUM ONE GAS CITATION:
//! On Arbitrum One L2, base fees are determined by the Nitro gas model with a minimum
//! floor of 0.01 Gwei (10,000,000 wei) up to ~0.1 Gwei under standard conditions
//! (cite: Offchain Labs Arbitrum Nitro gas docs,
//! https://docs.arbitrum.io/build-decentralized-apps/how-to-estimate-gas).
//!
//! By default, Anvil runs with Ethereum L1 default fees (1.0 Gwei = 1,000,000,000 wei).
//! Because alloy-node-bindings (`alloy::node_bindings::Anvil`) spawns `Command::new("anvil")`
//! without an argument injection hook, this wrapper provides the calibrated `--base-fee 100000000`.
//! If the actual base fee ever spikes above the configured MaxFeePerGas::LimitedAuto cap,
//! the harness pre-send check and driver-level policy refuse cleanly before broadcasting.

use std::process::Command;

fn main() {
    let real_anvil = std::env::var("ANVIL_REAL_BIN").unwrap_or_else(|_| {
        let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap_or_default();
        let foundry_bin = std::path::PathBuf::from(home)
            .join(".foundry")
            .join("bin")
            .join(if cfg!(windows) { "anvil.exe" } else { "anvil" });
        if foundry_bin.exists() {
            foundry_bin.to_string_lossy().to_string()
        } else {
            if cfg!(windows) { "anvil.exe".to_string() } else { "anvil".to_string() }
        }
    });

    let mut cmd = Command::new(&real_anvil);
    // Arbitrum One L2 realistic base fee (0.1 Gwei = 100_000_000 wei)
    cmd.arg("--base-fee").arg("100000000");
    for arg in std::env::args().skip(1) {
        cmd.arg(arg);
    }

    let status = match cmd.status() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("anvil wrapper: failed to execute real anvil binary at '{real_anvil}': {e}");
            std::process::exit(1);
        }
    };
    std::process::exit(status.code().unwrap_or(1));
}
