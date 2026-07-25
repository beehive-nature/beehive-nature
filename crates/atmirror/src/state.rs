//! Idempotency state — the local record of what already reached the rail.
//! Keyed by **commit CID** (never by CAR sha256: CAR block order is not
//! canonical, so identical repo state can produce different CAR bytes; the
//! commit CID is the stable identity of a repo state). Blobs are keyed by
//! their own CIDs and reused across commits, so a new post never re-uploads
//! an old avatar.
//!
//! State is a cache, not a truth: the mirror re-probes the rail for the CAR
//! address before honoring a hit (where the rail supports probing), and a
//! deleted state file merely costs a re-upload of content-addressed bytes.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::receipt::Receipt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitEntry {
    pub rev: String,
    pub scheme: String,
    pub address: String,
    pub sha256: String,
    pub byte_length: u64,
    pub created_at: String,
    /// The exact receipt emitted for this commit — re-emitted verbatim on
    /// idempotent re-runs so a re-run is byte-stable.
    pub receipt: Receipt,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlobEntry {
    pub scheme: String,
    pub address: String,
    pub sha256: String,
    pub byte_length: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct State {
    pub did: String,
    #[serde(default)]
    pub commits: BTreeMap<String, CommitEntry>,
    #[serde(default)]
    pub blobs: BTreeMap<String, BlobEntry>,
}

impl State {
    pub fn load(path: &Path, did: &str) -> Result<State, String> {
        match std::fs::read(path) {
            Ok(bytes) => {
                let state: State = serde_json::from_slice(&bytes)
                    .map_err(|e| format!("{}: {e}", path.display()))?;
                if state.did != did {
                    return Err(format!(
                        "{}: state is for {} but mirroring {} — refusing to mix accounts \
                         (use a distinct --out per account)",
                        path.display(),
                        state.did,
                        did
                    ));
                }
                Ok(state)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(State {
                did: did.to_string(),
                ..State::default()
            }),
            Err(e) => Err(format!("{}: {e}", path.display())),
        }
    }

    /// Atomic save: write sibling temp file, then rename over.
    pub fn save(&self, path: &Path) -> Result<(), String> {
        let json = serde_json::to_vec_pretty(self).map_err(|e| e.to_string())?;
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, &json).map_err(|e| format!("{}: {e}", tmp.display()))?;
        std::fs::rename(&tmp, path).map_err(|e| format!("{}: {e}", path.display()))?;
        Ok(())
    }
}
