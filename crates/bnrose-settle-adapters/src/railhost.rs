//! The host-side persistence laws at the adapter seam.
//!
//! THE PERSISTENCE LAW: the exact signed bytes and the CHAIN transaction
//! id (recomputed from those bytes, never a label) are durably journaled
//! on BOTH replicas BEFORE anything leaves the process. THE REBROADCAST
//! LAW: recovery submits the bytes FROM the authenticated journal — a
//! missing record REFUSES ("recovery:no-persisted-submission — refusing
//! to invent bytes"), never a fallback to caller input. THE UNKNOWN LAW:
//! a submission with no conclusive outcome is journaled as exactly that
//! (the landed core's lost-response event), and stays resolvable by
//! observation — never classified never-executed.
//!
//! The journal is the merged core's MAC-authenticated replicated journal
//! (`bnrose-exec-host`), so every record is authenticated the same way
//! the landed harness authenticates its own. At THIS seam the admission
//! event means "the host admitted these signed bytes for submission" —
//! no wasm verdict is implied or claimed (the core-driven flow is the
//! landed netpart host's own lane).

use bnrose_exec_core::E_ADMITTED;
use bnrose_exec_host::journal::ReplicatedJournal;
use bnrose_exec_host::keys::SupervisorKeys;
use bnrose_exec_host::opexec::{replica_paths, Claim};
use std::path::Path;

/// the landed core's lost-response event: no conclusive outcome — this is
/// the UNKNOWN journal word at the seam
pub const E_LOST_RESPONSE: u8 = 5;

/// the recorded outcome codes for a submission attempt
pub mod outcome {
    pub const ACKED: u8 = 1;
    pub const DUPLICATE: u8 = 2;
    pub const TIMEOUT_UNKNOWN: u8 = 3; // no conclusive outcome — UNKNOWN, never never-executed
    pub const CONFLICT: u8 = 4;
    pub const STORAGE_ERROR: u8 = 5;
    pub const REFUSED: u8 = 6; // a definitive node refusal (class rides the payload)
    pub const OBSERVED_INCLUDED: u8 = 7;
    pub const OBSERVED_FINAL: u8 = 8;
}

/// payload layout of an admission record at this seam:
/// `raw_len u32 LE ‖ raw bytes ‖ chain_tx_id utf8`
mod payload {
    pub fn encode(raw: &[u8], tx_id: &str) -> Vec<u8> {
        let mut p = Vec::with_capacity(4 + raw.len() + tx_id.len());
        p.extend_from_slice(&(raw.len() as u32).to_le_bytes());
        p.extend_from_slice(raw);
        p.extend_from_slice(tx_id.as_bytes());
        p
    }
    pub fn decode(p: &[u8]) -> Option<(Vec<u8>, String)> {
        if p.len() < 4 {
            return None;
        }
        let n = u32::from_le_bytes([p[0], p[1], p[2], p[3]]) as usize;
        if p.len() < 4 + n {
            return None;
        }
        Some((
            p[4..4 + n].to_vec(),
            String::from_utf8_lossy(&p[4 + n..]).into_owned(),
        ))
    }
}

/// the operation id for a payload: sha256 of the raw bytes — identity is
/// the bytes, so identical bytes always find their own record
pub fn op_of(raw: &[u8]) -> [u8; 32] {
    bnr_keys::sha256_of(raw)
}

pub struct RailHost {
    pub state_dir: std::path::PathBuf,
    pub claim: Claim,
    keys: SupervisorKeys,
}

impl RailHost {
    /// claim the state directory exclusively (local exclusion protects
    /// the PROCESS — its own law, never confused with the effect's)
    pub fn open(state_dir: &Path, root: &[u8; 32]) -> Result<RailHost, String> {
        std::fs::create_dir_all(state_dir.join("replica")).map_err(|e| e.to_string())?;
        let keys = if state_dir.join(bnrose_exec_host::keys::KEY_FILE).exists() {
            SupervisorKeys::load(state_dir)?
        } else {
            SupervisorKeys::init(state_dir, root)?
        };
        let claim = Claim::acquire(state_dir)?;
        Ok(RailHost {
            state_dir: state_dir.to_path_buf(),
            claim,
            keys,
        })
    }

    /// the RECOVERY entry: a host restarting over a CRASHED
    /// predecessor's directory adopts its stale claim (the landed law:
    /// a clean exit releases on drop; a killed holder leaves the claim
    /// file, and its OS lock died with it). Adoption is still local
    /// exclusion — one live holder at a time.
    pub fn open_recovering(state_dir: &Path, root: &[u8; 32]) -> Result<RailHost, String> {
        match RailHost::open(state_dir, root) {
            Ok(h) => Ok(h),
            Err(e) if e.contains("already-claimed") => {
                std::fs::create_dir_all(state_dir.join("replica")).map_err(|e| e.to_string())?;
                let keys = if state_dir.join(bnrose_exec_host::keys::KEY_FILE).exists() {
                    SupervisorKeys::load(state_dir)?
                } else {
                    SupervisorKeys::init(state_dir, root)?
                };
                let claim = Claim::adopt_stale(state_dir)?;
                Ok(RailHost {
                    state_dir: state_dir.to_path_buf(),
                    claim,
                    keys,
                })
            }
            Err(e) => Err(e),
        }
    }

    fn journal(&self) -> Result<ReplicatedJournal, String> {
        ReplicatedJournal::open(&replica_paths(&self.state_dir), &self.keys.journal_mac)
            .map_err(|e| format!("journal open: {e:?}"))
    }

    /// THE PERSISTENCE LAW — raw signed bytes + chain tx id, durably on
    /// both replicas, BEFORE submission. `op` is derived from the bytes
    /// themselves (sha256 of the raw payload), so identical bytes find
    /// their own record. IDEMPOTENT per op: a second admission of the
    /// SAME bytes is the SAME admission (one signed attempt per
    /// admission); different bytes hash to a different op by construction.
    pub fn journal_signed(&self, raw: &[u8], chain_tx_id: &str) -> Result<[u8; 32], String> {
        let op = op_of(raw);
        if let Some((_held, held_id)) = self.persisted(&op) {
            if held_id != chain_tx_id {
                return Err(format!(
                    "admission id mismatch: journal holds {held_id}, caller said {chain_tx_id}"
                ));
            }
            return Ok(op); // already durably admitted — never a second record
        }
        let mut j = self.journal()?;
        j.append(&op, E_ADMITTED, &payload::encode(raw, chain_tx_id))
            .map_err(|e| format!("journal append: {e:?}"))?;
        Ok(op)
    }

    /// journal one submission outcome as the observation it is
    pub fn journal_outcome(&self, op: &[u8; 32], code: u8, note: &str) -> Result<(), String> {
        let mut p = vec![code];
        p.extend_from_slice(note.as_bytes());
        let mut j = self.journal()?;
        j.append(op, bnrose_exec_core::E_RESPONSE, &p)
            .map_err(|e| format!("journal append: {e:?}"))?;
        Ok(())
    }

    /// THE REBROADCAST LAW — the persisted bytes for this operation,
    /// sourced from the authenticated journal; None refuses
    pub fn persisted(&self, op: &[u8; 32]) -> Option<(Vec<u8>, String)> {
        let (records, _state) =
            ReplicatedJournal::load_state(&replica_paths(&self.state_dir), &self.keys.journal_mac)
                .ok()?;
        let r = records
            .iter()
            .find(|r| r.event == E_ADMITTED && r.op_id == *op)?;
        payload::decode(&r.payload)
    }

    pub fn records(&self) -> Vec<bnrose_exec_host::journal::Record> {
        ReplicatedJournal::load_state(&replica_paths(&self.state_dir), &self.keys.journal_mac)
            .map(|(r, _)| r)
            .unwrap_or_default()
    }

    /// how many admission records exist (one signed attempt per
    /// admission is the local-safety law)
    pub fn admissions(&self) -> usize {
        self.records()
            .iter()
            .filter(|r| r.event == E_ADMITTED)
            .count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persistence_law_roundtrip_and_refusal() {
        let dir = std::env::temp_dir().join(format!("railhost-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let host = RailHost::open(&dir, &[0x11u8; 32]).unwrap();
        let raw = b"the exact signed bytes".to_vec();
        let op = host.journal_signed(&raw, "cafebabe01").unwrap();
        // a second admission of the SAME bytes is the same op — the
        // identity is the bytes, so one signed attempt stays one
        let op2 = host.journal_signed(&raw, "cafebabe01").unwrap();
        assert_eq!(op, op2);
        let (got_raw, got_id) = host.persisted(&op).unwrap();
        assert_eq!(got_raw, raw);
        assert_eq!(got_id, "cafebabe01");
        // a missing record REFUSES — never invented
        let other = [0x99u8; 32];
        assert!(host.persisted(&other).is_none());
        host.journal_outcome(&op, outcome::TIMEOUT_UNKNOWN, "no conclusive outcome")
            .unwrap();
        assert_eq!(host.admissions(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
