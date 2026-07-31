//! Trezor device layer (C1a) — enumeration and public-address reads only.
//!
//! Direct device access through the official Rust `trezor-client` over its own
//! transports. **Trezor Suite is not a dependency and never will be**; that is
//! the whole point. Suite's closed EVM network list is what stranded exSat
//! (SPEC_KEYRING-1 §2.7), so the signer talks to the device itself and brings
//! its own chain registry.
//!
//! # What this module deliberately cannot do
//!
//! C1 signs nothing. There is no `sign_*` function here, and this is not an
//! oversight to be filled in casually later:
//!
//! - **No signing.** Adding one is a separate order with its own consent
//!   surface (CONSENT-1 disclose-confirm) and its own honesty gate — a rail
//!   counts as working only with a logged request → on-device confirm →
//!   broadcast → chain receipt.
//! - **No key storage.** Nothing here reads, writes, derives, or holds secret
//!   material. Addresses and public device features are the entire output.
//! - **No passphrase or PIN prompting.** If a device needs either, the call
//!   fails and the founder is told; an agent must never mediate that.
//!
//! # ⚠ BLOCKER FOUND 2026-07-30 — this crate cannot talk to a Safe 7 yet
//!
//! Measured, not inferred. `cargo run --example enumerate` against the T3W1
//! fork emulator (`firmware-emu` pid 38984, `emu.py -e --headless -p safe7`,
//! udp:127.0.0.1:21324):
//!
//! ```text
//! == devices ==
//!   Trezor Emulator (transport: udp:127.0.0.1:21324)   <- enumeration WORKS
//! == ethereum address  m/44'/60'/0'/0/0 ==
//!   unavailable: failure received: code=Failure_InvalidProtocol
//! ```
//!
//! Cause, from the vendored source:
//!
//! - `trezor-client` 0.1.6 implements **`ProtocolV1` only** (framing magic
//!   `0x3f2323`, `src/transport/protocol.rs`). It ships THP *protobuf message
//!   definitions* (`MessageType_ThpCreateNewSession` etc.) but **no THP
//!   transport** — no Noise handshake, no channel or session management.
//! - The Safe 7 requires THP: `core/embed/models/T3W1/model.toml` enables the
//!   `"thp"` feature.
//!
//! So enumeration succeeds (transport-level) and every message fails
//! (protocol-level). This is the third distinct instance of the same shape:
//! `@trezor/connect` hard-blocks EOS on T3W1 in its bundled coin table, plain
//! `trezorctl` cannot pair with T3W1 non-interactively, and now the Rust
//! client cannot speak its protocol at all.
//!
//! **Consequence for SPEC_KEYRING-1 §8:** the ruled "Trezor rail via Rust
//! `trezor-client` over HID" reaches legacy models but **not the founder's
//! actual device**. Options, none chosen here (founder ruling): implement THP
//! in Rust (Noise handshake + pairing — substantial); bridge to Python
//! `trezorlib`, which *is* proven against this exact emulator by the CLSAG_GGX
//! conformance work; or wait on upstream THP support in `trezor-client`.
//!
//! # Hardware testing
//!
//! Enumeration against a real device runs only with the founder present. The
//! emulator (the crate's UDP transport) is the unattended path.

use trezor_client::AvailableDevice;

/// BIP-32 hardened-index helper. `44'` is `harden(44)`.
const fn harden(i: u32) -> u32 {
    i | 0x8000_0000
}

/// `m/44'/60'/0'/0/0` — the first Ethereum account. The EVM identity that
/// already spans Arbitrum (ANT) and the Turbo/ar.io rail is derived here.
pub const ETH_PATH_ACCOUNT_0: [u32; 5] =
    [harden(44), harden(60), harden(0), 0, 0];

#[derive(Debug, thiserror::Error)]
pub enum DeviceError {
    #[error("no Trezor found (no hardware attached and no emulator listening)")]
    NoDevice,

    #[error("device transport error: {0}")]
    Transport(String),

    #[error("device rejected or could not answer the request: {0}")]
    Device(String),
}

/// What we are willing to say publicly about an attached device.
#[derive(Debug, Clone)]
pub struct DeviceSummary {
    /// The crate's own `Display` rendering (model + transport + debug flag).
    pub description: String,
    pub model: String,
    /// True when the device exposes the debug link — i.e. an emulator or a
    /// debug build, never a production Safe 7.
    pub debug: bool,
}

impl From<&AvailableDevice> for DeviceSummary {
    fn from(d: &AvailableDevice) -> Self {
        Self {
            description: d.to_string(),
            model: format!("{}", d.model),
            debug: d.debug,
        }
    }
}

/// List every attached Trezor, hardware or emulator.
///
/// Returns an empty vector rather than an error when nothing is attached —
/// "no device present" is a normal state and a perfectly good receipt.
pub fn enumerate() -> Vec<DeviceSummary> {
    trezor_client::find_devices(false).iter().map(DeviceSummary::from).collect()
}

/// Read the Ethereum address at `path` from the first attached device.
///
/// This is a **public-key read**, not a signature. Depending on firmware the
/// device may ask the holder to confirm on-screen; that prompt is the device's
/// own consent surface and must be answered by a human on the device.
///
/// Fails cleanly when no device is attached — this crate never falls back to
/// a software key, because it holds none.
pub fn ethereum_address(path: &[u32]) -> Result<String, DeviceError> {
    let mut devices = trezor_client::find_devices(false);
    if devices.is_empty() {
        return Err(DeviceError::NoDevice);
    }
    let device = devices.remove(0);

    let mut client = device.connect().map_err(|e| DeviceError::Transport(e.to_string()))?;
    client.init_device(None).map_err(|e| DeviceError::Device(e.to_string()))?;

    client
        .ethereum_get_address(path.to_vec())
        .map_err(|e| DeviceError::Device(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eth_path_is_the_standard_first_account() {
        // m/44'/60'/0'/0/0
        assert_eq!(ETH_PATH_ACCOUNT_0, [0x8000_002C, 0x8000_003C, 0x8000_0000, 0, 0]);
    }

    #[test]
    fn enumeration_is_safe_with_no_device_attached() {
        // Must not panic and must not error: absence of a device is a state,
        // not a failure. This is the unattended-CI path.
        let _ = enumerate();
    }

    #[test]
    fn address_read_without_a_device_fails_rather_than_inventing_one() {
        if enumerate().is_empty() {
            let err = ethereum_address(&ETH_PATH_ACCOUNT_0).unwrap_err();
            assert!(matches!(err, DeviceError::NoDevice));
        }
    }
}
