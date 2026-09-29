# x402-door clock-boundary determinism (writer seat zCode; slice 7083c5a2 — test-only)

**STATE** · Test-only slice on `main` base `d7b9b2c6`, branch
`zcode/x402flake-clockfix`. No production bytes touched: `journal.rs`'s
identity-mismatch refusal (the Torn arm at `begin_settle`) is LAW and
stays exactly as-is; no payment behavior, no deploy.

**CLAIM** · The flake class found on #140's CI run
(`adv_retained_failures_exhaust_the_budget_by_number` →
`Torn { … res-0xF0.json, reason: identity mismatch (leg) }`) is already
FIXED on `main` by `8a94a986` (one captured `far_future()` for the whole
test; 8/8 clean runs receipted there). #140's red is the STALE FORK COPY:
`git diff origin/main a8d358ef -- ops/x402-door/tests/adversarial.rs`
is 250 lines — the #125 fork point predates the fix, so the stacked
profile tree ran the old flaky file. The cure for #140 is the merge-time
reconciliation with main (or a founder-gated #125 rebase), NOT this slice
and NOT a re-run-until-green.

What THIS slice adds is the missing piece 7083c5a2 asked for: the
deterministic clock-boundary check with a negative and a positive case,
pinned from the test side:

- `adv_clock_boundary_same_valid_before_rebuilds_the_same_leg` (positive):
  the SAME captured `valid_before` rebuilds the SAME leg — evidence
  reconciles a retained failure through it.
- `adv_clock_boundary_one_second_later_is_a_different_leg` (negative):
  `vb + 1` — a deterministic one-second "boundary crossed", no sleep, no
  race — rebuilds a DIFFERENT leg and the journal refuses it naming the
  identity mismatch. The production law bites and stays pinned.

**EVIDENCE** · `cargo test --locked --manifest-path ops/x402-door/Cargo.toml
--test adversarial --test acceptance --test d_specs --test r4_audit`
(WSL cargo 1.99.0-nightly): **11 + 13 + 10 + 2 = 36/36 green**
(adversarial 13 = the prior 11 + the 2 new boundary tests). `cargo fmt`
applied; diff is `+97` lines in `tests/adversarial.rs` only.

**BOUNDARY NOT CROSSED** · No `journal.rs`/`Door`/payment changes, no
`Cargo.toml`/`Cargo.lock` changes, no deployment, nothing in #140,
bOPus5's fence respected. CI arbitrates on push.

**NEXT OWNER** · Independent reviewer (coordinator's routing — not this
seat, not bOPus5).

**FOUNDER ACTION** · None. Merge is normal review flow.
