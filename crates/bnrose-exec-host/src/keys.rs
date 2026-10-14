//! Supervisor key material (BNROSE-RUST-001).
//!
//! One root (32 bytes, file-delivered, never printed) derives everything:
//! the Ed25519 signing seed for receipts and the two MAC keys for the
//! journal and the effect ledger. Derivation is HMAC-SHA256 with fixed
//! labels — no new primitive, and deterministic, so a recovery run from
//! the same root state directory arrives at the same keys.
//!
//! Nothing here ever generates entropy: the caller supplies the root. A
//! production deployment's root comes from whatever secret store owns it;
//! the fixtures use fixed roots and say so in every receipt that depends
//! on them.

use crate::hex;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::path::Path;

type HmacSha256 = Hmac<Sha256>;

pub const KEY_FILE: &str = "supervisor.root";

#[derive(Clone)]
pub struct SupervisorKeys {
    pub root_fingerprint: [u8; 32],
    pub ed_seed: [u8; 32],
    pub ed_public: [u8; 32],
    pub journal_mac: [u8; 32],
    pub ledger_mac: [u8; 32],
}

fn derive(root: &[u8; 32], label: &[u8]) -> [u8; 32] {
    let mut m = <HmacSha256 as Mac>::new_from_slice(root).expect("hmac takes any key size");
    m.update(b"bnrose-exec/keys/1");
    m.update(label);
    m.finalize().into_bytes().into()
}

impl SupervisorKeys {
    pub fn from_root(root: &[u8; 32]) -> SupervisorKeys {
        let ed_seed = derive(root, b"ed25519-receipt-seed");
        let mut ed_public = [0u8; 32];
        libcrux_ed25519::secret_to_public(&mut ed_public, &ed_seed);
        SupervisorKeys {
            root_fingerprint: derive(root, b"fingerprint"),
            ed_seed,
            ed_public,
            journal_mac: derive(root, b"journal-mac"),
            ledger_mac: derive(root, b"ledger-mac"),
        }
    }

    /// Load from a state directory (the root file, raw 32 bytes). Missing
    /// file is an error, not a fresh key: silently rotating a supervisor
    /// identity would orphan every journal written before it.
    pub fn load(state_dir: &Path) -> Result<SupervisorKeys, String> {
        let p = state_dir.join(KEY_FILE);
        let b = std::fs::read(&p).map_err(|e| format!("{}: {e}", p.display()))?;
        if b.len() != 32 {
            return Err(format!(
                "{}: root must be exactly 32 bytes, found {}",
                p.display(),
                b.len()
            ));
        }
        Ok(SupervisorKeys::from_root(&b.try_into().unwrap()))
    }

    /// Write a caller-supplied root into a fresh state directory.
    pub fn init(state_dir: &Path, root: &[u8; 32]) -> Result<SupervisorKeys, String> {
        std::fs::create_dir_all(state_dir).map_err(|e| e.to_string())?;
        let p = state_dir.join(KEY_FILE);
        if p.exists() {
            return Err(format!(
                "{} already exists: a supervisor root is never silently replaced",
                p.display()
            ));
        }
        std::fs::write(&p, root).map_err(|e| e.to_string())?;
        Ok(SupervisorKeys::from_root(root))
    }

    /// A short, public identity for receipts and logs (the root's
    /// fingerprint, not the root).
    pub fn fingerprint(&self) -> String {
        hex(&self.root_fingerprint[..8])
    }
}
