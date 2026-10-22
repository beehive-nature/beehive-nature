//! The three fault classes the 2026-10-15 architecture review attributed to
//! the inspected multisig tooling, as switchable deviations of the faithful
//! walk. The faithful walk is `Faults::NONE`; a fault is turned on ONLY by
//! the corpus, to prove that the vectors can tell the difference. A vector
//! that cannot convict a planted fault is not a conformance vector.
//!
//! The attribution is the review's; this crate vendors none of that tooling
//! and re-verifies nothing about it. What the crate proves is narrower and
//! checkable: each class, if present in ANY resolver, is convicted by a named
//! vector on which the chain gives the other answer.

/// Which deviations are planted. `NONE` is the chain.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Faults {
    /// Class 1: following a referenced account under the ENCLOSING
    /// permission name instead of the name the referenced
    /// `permission_level` carries. `alice@active -> {bob@custom}` is resolved
    /// as `bob@active`. The chain follows `permission.permission` as written
    /// (`authority_checker.hpp:230`).
    pub follow_with_enclosing_permission_name: bool,
    /// Class 2: the visited/evaluated set keyed by ACCOUNT instead of by
    /// `actor@permission`; the first permission of an actor to be evaluated
    /// decides every later permission of that actor. The chain keys its cache
    /// by `permission_level` (`authority_checker.hpp:70,136`).
    pub cache_by_actor_only: bool,
    /// Class 3: no visited set and no depth bound, so an indirect cycle
    /// recurses forever. The chain marks a level `being_evaluated` before
    /// descending (`authority_checker.hpp:237`) and descends only while
    /// `recursion_depth < max_authority_depth` (`:224`).
    pub no_visited_set_no_depth_bound: bool,
}

impl Faults {
    pub const NONE: Faults = Faults {
        follow_with_enclosing_permission_name: false,
        cache_by_actor_only: false,
        no_visited_set_no_depth_bound: false,
    };

    pub const CLASS_1_PARENT_NAME: Faults = Faults {
        follow_with_enclosing_permission_name: true,
        ..Faults::NONE
    };

    pub const CLASS_2_ACTOR_DEDUPE: Faults = Faults {
        cache_by_actor_only: true,
        ..Faults::NONE
    };

    pub const CLASS_3_UNBOUNDED: Faults = Faults {
        no_visited_set_no_depth_bound: true,
        ..Faults::NONE
    };

    pub fn any(&self) -> bool {
        self.follow_with_enclosing_permission_name
            || self.cache_by_actor_only
            || self.no_visited_set_no_depth_bound
    }
}
