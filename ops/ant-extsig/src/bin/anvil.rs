//! Anvil wrapper for LocalDevnet: ensures Anvil runs with Arbitrum One L2 realistic
//! base fee (0.1 Gwei / 100_000_000 wei) so local development reflects production
//! gas conditions and adheres to the 0.0002 ETH standing gas ceiling.
//!
//! ARBITRUM NITRO PRECOMPILE CITATION & DEVNET CALIBRATION:
//! Arbitrum Nitro documentation defines the precompiles governing the L2 gas price floor:
//! - ArbOwner.setMinimumL2BaseFee(uint256 priceInWei) configures the chain's gas price floor
//!   (cite: https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbowner).
//! - ArbGasInfo.getMinimumGasPrice() at precompile address 0x000000000000000000000000000000000000006C
//!   returns the current gas price floor
//!   (cite: https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbgasinfo).
//!
//! Note on fee figures: the 0.1 Gwei (100_000_000 wei) figure passed below to `--base-fee`
//! is an empirical testnet calibration for local devnet execution (UNVERIFIED against official doc text);
//! the cited reference defines the interface functions only and specifies no numerical constants.
//! By default, Anvil runs with Ethereum L1 default fees (1.0 Gwei = 1,000,000,000 wei).
//! Because alloy-node-bindings (`alloy::node_bindings::Anvil`) spawns `Command::new("anvil")`
//! without an argument injection hook, this wrapper provides the calibrated `--base-fee 100000000`.
//!
//! On Windows the real anvil is placed in a kill-on-close job object, so it
//! dies with this wrapper. Without that, the devnet killing the wrapper left
//! the real anvil running.

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
    // 0.1 Gwei unless ANT_EXTSIG_ANVIL_BASE_FEE names another base fee in wei.
    let base_fee = std::env::var("ANT_EXTSIG_ANVIL_BASE_FEE").unwrap_or_else(|_| "100000000".to_string());
    if base_fee.is_empty() || !base_fee.bytes().all(|b| b.is_ascii_digit()) {
        eprintln!("anvil wrapper: ANT_EXTSIG_ANVIL_BASE_FEE must be a whole number of wei, got '{base_fee}'");
        std::process::exit(1);
    }
    cmd.arg("--base-fee").arg(&base_fee);
    for arg in std::env::args().skip(1) {
        cmd.arg(arg);
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("anvil wrapper: failed to execute real anvil binary at '{real_anvil}': {e}");
            std::process::exit(1);
        }
    };
    #[cfg(windows)]
    if let Err(e) = tie_to_this_process(&child) {
        eprintln!("anvil wrapper: could not tie anvil to the wrapper's lifetime ({e}); stopping it");
        let _ = child.kill();
        std::process::exit(1);
    }
    let status = match child.wait() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("anvil wrapper: waiting on anvil failed: {e}");
            std::process::exit(1);
        }
    };
    std::process::exit(status.code().unwrap_or(1));
}

/// Put the child in a job object whose only handle is held by this process.
/// When this process ends, however it ends, the handle closes and Windows
/// terminates the child.
#[cfg(windows)]
fn tie_to_this_process(child: &std::process::Child) -> std::io::Result<()> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    // SAFETY: plain Win32 calls with valid arguments; the job handle is
    // deliberately never closed so it lives exactly as long as this process.
    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return Err(std::io::Error::last_os_error());
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            std::ptr::addr_of!(info).cast(),
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        ) == 0
        {
            return Err(std::io::Error::last_os_error());
        }
        if AssignProcessToJobObject(job, child.as_raw_handle().cast()) == 0 {
            return Err(std::io::Error::last_os_error());
        }
    }
    Ok(())
}
