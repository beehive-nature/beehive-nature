//! bnrose-replacement-law — the exact replacement law's PURE CORE, one
//! definition set (founder order 2026-10-14, BNROSE-SAW-001): the gate
//! (no recorded effect for any attempt AND explicit policy opt-in) and
//! the attempt numbering (one past the highest journaled attempt,
//! saturating at 15). The definitions MOVED here from
//! bnrose-exec-host::opexec (same bodies, same semantics — the host
//! re-exports them; this is not a second model). The crate is
//! dependency-free so `cargo saw-build` can link it alone: SAW binds
//! THESE compiled MIR bodies to the Cryptol twin
//! (scripts/bnrose-rust-001/cryptol/BnroseReplacement.cry) — the
//! implementation-correspondence leg of BNROSE-SAW-001.
//!
//! The slice-consuming scans (step_entity_attempt over journal records,
//! step_has_row_among over ledger rows) remain in opexec: dynamic-length
//! inputs are outside SAW's symbolic-execution shape, and their binding
//! stays the sampled-agreement grid — a NAMED boundary, not a gap
//! (docs/dispatches/2026-10-14-bnrose-saw-001.md).

#![no_std]

/// Options for step-based workflows. The replacement policy is OPT-IN
/// and narrow (the founder's 2026-10-13 law): only a step whose prior
/// attempt is conclusively never-executed (no ledger row for any
/// attempt) may be replaced, and only when this flag is set. A failed
/// step WITH a recorded effect, and any unresolved step, are never
/// replaceable.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct StepOptions {
    pub replace_never_executed_failed_steps: bool,
}

/// The exact replacement law's GATE, one definition (the Cryptol twin's
/// `gate` binds THIS function; SAW proves the compiled MIR equal to the
/// spec term over both inputs): admissible only when NO attempt of the
/// step has a recorded effect AND the policy flag explicitly opts in
/// (default false).
pub fn replacement_admissible(has_any_recorded_effect: bool, opts: &StepOptions) -> bool {
    !has_any_recorded_effect && opts.replace_never_executed_failed_steps
}

/// The replacement's attempt number: one past the highest journaled
/// attempt, saturating at 15 (the Cryptol twin's `nextAttempt`; the
/// saturation corner is proven there as a fact — at 16 journaled
/// attempts the encoding of slot 15 is REUSED, by design). The supported
/// domain is the attempt nibble, 0..=15, where every caller lives
/// (`encoded >> 4`); SAW proves the compiled MIR equal to the spec on
/// exactly that domain.
pub fn replacement_attempt(max_journaled_attempt: u8) -> u8 {
    (max_journaled_attempt + 1).min(15)
}

// ---- the SAW harness wrappers: real call chains, not copies —
// mir_verify targets these so the proof executes THE functions above
// through ordinary MIR calls (bool flags in, bool out; the struct
// reference is constructed here, on the Rust side of the boundary).

/// SAW entry: the gate over flat flags (constructs the real StepOptions
/// and calls the real gate). The spec side is the twin's `gate` at a
/// witnessing rows mask (see attempt.saw / admissible.saw).
pub fn saw_admissible(has_any_recorded_effect: bool, opt_in: bool) -> bool {
    replacement_admissible(
        has_any_recorded_effect,
        &StepOptions {
            replace_never_executed_failed_steps: opt_in,
        },
    )
}

/// SAW entry: the attempt numbering over the nibble domain.
pub fn saw_attempt(max_journaled_attempt: u8) -> u8 {
    replacement_attempt(max_journaled_attempt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gate_fails_closed_without_the_flag() {
        assert!(!replacement_admissible(
            false,
            &StepOptions {
                replace_never_executed_failed_steps: false,
            }
        ));
        assert!(replacement_admissible(
            false,
            &StepOptions {
                replace_never_executed_failed_steps: true,
            }
        ));
    }

    #[test]
    fn any_row_closes_the_gate_whatever_the_flag() {
        assert!(!replacement_admissible(
            true,
            &StepOptions {
                replace_never_executed_failed_steps: true,
            }
        ));
    }

    #[test]
    fn attempt_numbers_one_past_the_max_and_saturates() {
        assert_eq!(replacement_attempt(0), 1);
        assert_eq!(replacement_attempt(14), 15);
        assert_eq!(replacement_attempt(15), 15);
    }
}
