//! The bounded epoch-root commitment — ORDER BZDID-002 Phase 3.
//!
//! What the chain is FOR, in one law: the chain certifies the MINIMUM
//! necessary state, and identity validity never needs it. A BEELOG head
//! already proves its own history to anyone (Phase 2); the anchor is the
//! single constant-size row that PUBLISHES a head — the architecture's
//! "one Vaulta row per epoch" at the per-identity increment's scale.
//!
//! The commitment canon (`BNR-BZDID-ANCHOR-V1`; a byte change is a v2
//! ceremony, never an edit). Serialization is the estate canon idiom —
//! fields sorted by key, `key\x1fvalue` lines joined by `\x1e` (the
//! btungsten-wb004 `canon` format):
//!
//! ```text
//! anchor = canon([
//!   ("did",    the did:b: string, 58 chars),
//!   ("epoch",  u64, 1..),
//!   ("prev",   hex32 — the previous anchor's digest, 64 zeros at epoch 1),
//!   ("root",   hex32 — the BEELOG head root being published),
//!   ("schema", "bnr/bzdid-epoch-root/v1"),
//!   ("size",   u64 — the BEELOG head size, head seq + 1),
//! ])
//! anchor_digest = sha256(anchor)
//! ```
//!
//! BOUNDED, by construction and by test: the serialized anchor is under
//! 300 bytes no matter how long the log is — the chain row never grows
//! with history.
//!
//! The independence law, made mechanical: `verify_anchor` is pure over
//! the document; `binds` checks the anchor names a LOCALLY verified
//! head; and NOTHING in `resolve_did`, BEELOG, or the signature
//! verifiers takes an anchor, a receipt, or any chain artifact as
//! input. An identity with its anchor deleted verifies exactly as well
//! as one with it — the bridge battery proves that by deletion.
//!
//! Settlement: driving a Vaulta/Antelope action is NOT this module's
//! (the order fixes fixtures/testnets only). The model-scale adapter
//! that drives the existing WB004 epochal engine (aggregate → bounded
//! short-lived msig → immutable SETTLE receipt) lives in
//! `crates/btungsten-wb004/tests/bzdid_epoch_root.rs`, following the
//! Skaists bridge precedent; a LIVE chain settlement stays named, not
//! claimed.

use crate::beelog::Head;
use crate::did::BzDid;
use sha2::{Digest, Sha256};

pub const ANCHOR_SCHEMA: &str = "bnr/bzdid-epoch-root/v1";
/// The epoch-1 sentinel: no previous anchor exists.
pub const GENESIS_PREV: &str = "0000000000000000000000000000000000000000000000000000000000000000"; // PUBLIC-CONSTANT: the all-zeros sha256-hex sentinel, no key material
/// The size ceiling of a serialized anchor — the "bounded" in the order,
/// enforced by test, not by hope.
pub const MAX_ANCHOR_BYTES: usize = 300;

/// The typed anchor document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Anchor {
    pub did: BzDid,
    pub epoch: u64,
    pub prev: String,
    pub root: String,
    pub size: u64,
}

fn canon_pairs(pairs: &[(&str, String)]) -> String {
    let mut v: Vec<&(&str, String)> = pairs.iter().collect();
    v.sort_by_key(|(k, _)| *k);
    v.iter()
        .map(|(k, val)| format!("{k}\u{1f}{val}"))
        .collect::<Vec<_>>()
        .join("\u{1e}")
}

fn is_hex32(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}

impl Anchor {
    /// Build an anchor for a head. `prev` is the previous anchor's
    /// digest (`GENESIS_PREV` at epoch 1).
    pub fn new(did: BzDid, epoch: u64, head: &Head, prev: String) -> Result<Anchor, String> {
        let a = Anchor {
            did,
            epoch,
            prev,
            root: head.root.iter().map(|b| format!("{b:02x}")).collect(),
            size: head.size,
        };
        a.verify()?;
        Ok(a)
    }

    /// The canonical bytes — exactly what a settlement commits.
    pub fn canon(&self) -> Result<String, String> {
        self.verify()?;
        Ok(canon_pairs(&[
            ("did", self.did.as_str().to_string()),
            ("epoch", self.epoch.to_string()),
            ("prev", self.prev.clone()),
            ("root", self.root.clone()),
            ("schema", ANCHOR_SCHEMA.to_string()),
            ("size", self.size.to_string()),
        ]))
    }

    /// sha256 of the canonical bytes, hex — the anchor's digest, the
    /// next anchor's `prev`, and the payload digest a settlement
    /// receipt binds.
    pub fn digest(&self) -> Result<String, String> {
        let c = self.canon()?;
        Ok(Sha256::digest(c.as_bytes())
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect())
    }

    /// Structural verification, pure over the document: schema shape,
    /// epoch 1.., size 1.., hex32 fields, the epoch-1 sentinel law, and
    /// the byte bound. No chain artifact is consulted — ever.
    pub fn verify(&self) -> Result<(), String> {
        if self.epoch == 0 {
            return Err("anchor epoch must be 1..".into());
        }
        if self.size == 0 {
            return Err("an anchor never publishes an empty head".into());
        }
        if !is_hex32(&self.root) {
            return Err("anchor root must be 32 bytes of hex".into());
        }
        if !is_hex32(&self.prev) {
            return Err("anchor prev must be 32 bytes of hex".into());
        }
        if self.epoch == 1 && self.prev != GENESIS_PREV {
            return Err(
                "epoch 1 has no previous anchor — prev must be the genesis sentinel".into(),
            );
        }
        if self.epoch > 1 && self.prev == GENESIS_PREV {
            return Err(
                "epoch > 1 must name the previous anchor's digest, not the sentinel".into(),
            );
        }
        if self.canon_bytes_len() > MAX_ANCHOR_BYTES {
            return Err(format!(
                "anchor exceeds the {}-byte bound — bounded is a law, not a preference",
                MAX_ANCHOR_BYTES
            ));
        }
        Ok(())
    }

    fn canon_bytes_len(&self) -> usize {
        canon_pairs(&[
            ("did", self.did.as_str().to_string()),
            ("epoch", self.epoch.to_string()),
            ("prev", self.prev.clone()),
            ("root", self.root.clone()),
            ("schema", ANCHOR_SCHEMA.to_string()),
            ("size", self.size.to_string()),
        ])
        .len()
    }

    /// THE BIND CHECK: does this anchor name exactly this locally
    /// verified head? An anchor for any other head, size, or identity
    /// does not bind. This is the only place the anchor and the local
    /// truth meet, and it runs entirely on handed values.
    pub fn binds(&self, did: &BzDid, head: &Head) -> bool {
        let root = head
            .root
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>();
        &self.did == did && self.size == head.size && self.root == root
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::beelog::IdentityLog;
    use crate::tests::demo_keys;

    #[test]
    fn the_anchor_is_bounded_constant_size() {
        let (resolved, genesis_bytes) = demo_keys();
        let idlog = IdentityLog::from_resolved(&resolved, &genesis_bytes);
        let head = idlog.head();
        let a = Anchor::new(resolved.did.clone(), 1, &head, GENESIS_PREV.into()).unwrap();
        let c = a.canon().unwrap();
        assert!(c.len() < MAX_ANCHOR_BYTES);
        // and the digest is pure function of the canonical bytes
        let d1 = a.digest().unwrap();
        let d2 = a.digest().unwrap();
        assert_eq!(d1, d2);
        assert_eq!(d1.len(), 64);
    }

    #[test]
    fn the_anchor_binds_only_the_head_it_names() {
        let (resolved, genesis_bytes) = demo_keys();
        let idlog = IdentityLog::from_resolved(&resolved, &genesis_bytes);
        let head = idlog.head();
        let a = Anchor::new(resolved.did.clone(), 3, &head, "a".repeat(64)).unwrap();
        assert!(a.binds(&resolved.did, &head));
        // a different size does not bind (a stale anchor)
        let stale = Head {
            size: head.size - 1,
            root: head.root,
        };
        assert!(!a.binds(&resolved.did, &stale));
        // a different root does not bind (a foreign log)
        let foreign = Head {
            size: head.size,
            root: [9u8; 32],
        };
        assert!(!a.binds(&resolved.did, &foreign));
        // a different identity does not bind
        let other = {
            let mut n = resolved.did.as_str().to_string();
            let idx = "did:b:".len() + 3;
            n.replace_range(
                idx..idx + 1,
                if n.as_bytes()[idx] == b'a' { "b" } else { "a" },
            );
            BzDid::parse(&n).unwrap()
        };
        assert!(!a.binds(&other, &head));
    }

    #[test]
    fn structural_refusals() {
        let (resolved, genesis_bytes) = demo_keys();
        let idlog = IdentityLog::from_resolved(&resolved, &genesis_bytes);
        let head = idlog.head();
        // epoch 0 refuses
        assert!(Anchor::new(resolved.did.clone(), 0, &head, GENESIS_PREV.into()).is_err());
        // epoch 1 must carry the sentinel
        assert!(Anchor::new(resolved.did.clone(), 1, &head, "f".repeat(64)).is_err());
        // epoch 2 must not carry the sentinel
        assert!(Anchor::new(resolved.did.clone(), 2, &head, GENESIS_PREV.into()).is_err());
        // bad hex refuses
        let mut bad = Anchor::new(resolved.did.clone(), 1, &head, GENESIS_PREV.into()).unwrap();
        bad.root = "zz".repeat(32);
        assert!(bad.verify().is_err());
        // empty head refuses
        let empty = Head::empty();
        assert!(Anchor::new(resolved.did.clone(), 1, &empty, GENESIS_PREV.into()).is_err());
    }

    #[test]
    fn anchors_chain_by_digest() {
        let (resolved, genesis_bytes) = demo_keys();
        let idlog = IdentityLog::from_resolved(&resolved, &genesis_bytes);
        let head1 = idlog.head();
        let a1 = Anchor::new(resolved.did.clone(), 1, &head1, GENESIS_PREV.into()).unwrap();
        let a2 = Anchor::new(resolved.did.clone(), 2, &head1, a1.digest().unwrap()).unwrap();
        // the chain: a2.prev IS a1's digest — one history of anchors
        assert_eq!(a2.prev, a1.digest().unwrap());
        // and a tampered a1 is no longer what a2 names
        let mut tampered = a1.clone();
        tampered.size += 1;
        assert_ne!(tampered.digest().unwrap(), a2.prev);
    }
}
