//! Permissive canonical wire types shared by the AGPL BNR kernel and its MIT/Apache SDK
//! edges. Licensed **MIT OR Apache-2.0** so a downstream permissive crate can reuse the
//! canonical types without AGPL infection — the "type bindings" edge `LICENSING.md`
//! names. v0.1 holds the `Did` principal; `EvidenceClass` and event types follow here as
//! edges need them (and as they can be cleanly split from the kernel's logic).

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};

/// A decentralized identifier used as an authorization principal.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Did(pub String);

impl Did {
    pub fn new(s: impl Into<String>) -> Self {
        Did(s.into())
    }
    /// The DID method segment (`autonomi`, `plc`, …), if well-formed
    /// (`did:<method>:<id>`).
    pub fn method(&self) -> Option<&str> {
        let mut it = self.0.split(':');
        match (it.next(), it.next()) {
            (Some("did"), Some(method)) if !method.is_empty() => Some(method),
            _ => None,
        }
    }
    pub fn is_root(&self) -> bool {
        self.method() == Some("autonomi")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn method_parses_well_formed_dids() {
        assert_eq!(Did::new("did:autonomi:abc").method(), Some("autonomi"));
        assert_eq!(Did::new("not-a-did").method(), None);
        assert!(Did::new("did:autonomi:root").is_root());
    }
}
