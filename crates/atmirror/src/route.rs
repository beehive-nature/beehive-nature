//! Storage routing rule — PHASE0_AR_ANT_SETUP_SPEC step 6, restating
//! `storage-substrate-split` §1 (the 256 KiB crossover is MEASURED, not
//! estimated — Arbitrum gas made naive token-price comparison 40x wrong).
//!
//! Pure decision logic, no I/O: the relay's upload endpoint calls [`route`]
//! and then drives the matching [`crate::rail::Rail`]. Self-funded model (spec
//! v3): whoever the payload belongs to pays the destination's cost — routing
//! never implies subsidy.

/// The 256 KiB crossover (bytes). Below: Arweave ANS-104 Ed25519
/// (~$0.0000077/record). At/above: Autonomi (~19x cheaper per GiB).
pub const AR_ANT_CROSSOVER_BYTES: usize = 256 * 1024;

/// What the payload IS — the two ruled overrides route by class, not size.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PayloadClass {
    /// Identity / DID-log entries: Arweave PRIMARY + Autonomi MIRROR,
    /// regardless of size (the identity record must be on the permanence rail).
    IdentityRecord,
    /// Content a browser must fetch over plain HTTP: Arweave, regardless of
    /// size (ar-io-node serves it; Autonomi has no browser-HTTP path).
    BrowserResolvable,
    /// Everything else: routed purely by the size crossover.
    Bulk,
}

/// Where a payload lands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RouteDecision {
    /// Arweave only (ANS-104, Ed25519 sig type 2 for user-signed items).
    Arweave,
    /// Autonomi only.
    Autonomi,
    /// Arweave primary + Autonomi mirror (identity/DID-log payloads).
    ArweavePrimaryAutonomiMirror,
}

/// The Phase-0 routing rule. Class overrides first, then the size crossover.
pub fn route(class: PayloadClass, size_bytes: usize) -> RouteDecision {
    match class {
        PayloadClass::IdentityRecord => RouteDecision::ArweavePrimaryAutonomiMirror,
        PayloadClass::BrowserResolvable => RouteDecision::Arweave,
        PayloadClass::Bulk => {
            if size_bytes < AR_ANT_CROSSOVER_BYTES {
                RouteDecision::Arweave
            } else {
                RouteDecision::Autonomi
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bulk_routes_by_the_measured_crossover() {
        assert_eq!(route(PayloadClass::Bulk, 0), RouteDecision::Arweave);
        assert_eq!(
            route(PayloadClass::Bulk, AR_ANT_CROSSOVER_BYTES - 1),
            RouteDecision::Arweave
        );
        // the boundary itself goes to Autonomi (spec: ">=256KiB to Autonomi")
        assert_eq!(
            route(PayloadClass::Bulk, AR_ANT_CROSSOVER_BYTES),
            RouteDecision::Autonomi
        );
        assert_eq!(
            route(PayloadClass::Bulk, 10 * 1024 * 1024),
            RouteDecision::Autonomi
        );
    }

    #[test]
    fn identity_records_always_get_permanence_plus_mirror() {
        // size is irrelevant for identity — both sides of the crossover agree.
        for size in [0, 300, AR_ANT_CROSSOVER_BYTES, 5 * 1024 * 1024] {
            assert_eq!(
                route(PayloadClass::IdentityRecord, size),
                RouteDecision::ArweavePrimaryAutonomiMirror
            );
        }
    }

    #[test]
    fn browser_resolvable_always_routes_to_arweave() {
        // ar-io-node serves HTTP; Autonomi cannot — even huge payloads stay on AR.
        for size in [100, AR_ANT_CROSSOVER_BYTES, 100 * 1024 * 1024] {
            assert_eq!(
                route(PayloadClass::BrowserResolvable, size),
                RouteDecision::Arweave
            );
        }
    }

    /// The crossover constant is the ruled number, not a drifted one.
    #[test]
    fn crossover_is_256_kib() {
        assert_eq!(AR_ANT_CROSSOVER_BYTES, 262_144);
    }
}
