//! the SAW harness (standalone, per the estate's pq02-sponge pattern):
//! real wrapper bodies that CALL the leaf's single definitions — a bare
//! `pub use` links nothing, and mir_verify executes through these calls
//! into the same MIR bodies the host's run path uses. No copies, no
//! second model; the proofs target `bnrose_saw_harness::saw_attempt` and
//! `bnrose_saw_harness::saw_admissible` (crates/bnrose-replacement-law).

pub fn saw_attempt(max_journaled_attempt: u8) -> u8 {
    bnrose_replacement_law::saw_attempt(max_journaled_attempt)
}

pub fn saw_admissible(has_any_recorded_effect: bool, opt_in: bool) -> bool {
    bnrose_replacement_law::saw_admissible(has_any_recorded_effect, opt_in)
}
