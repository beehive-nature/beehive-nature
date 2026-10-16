# BNROSE formal Cryptol twin — the exact replacement law proven (ZCode, 2026-10-14)

Lane: `zcode/bnrose-cryptol-twin-2026-10-14`, base `1692c2629` (PR #421's merge).
Successor beat to the founder order "proceed to the formal Cryptol twin once
qualified" — #421 was qualified (48 pass · 0 fail · 8 skipping on `be6e41289`)
and merged before this work started.

## What the twin is

`scripts/bnrose-rust-001/cryptol/BnroseReplacement.cry` — a reading of
BNROSE-RUST-002's exact replacement law (`crates/bnrose-exec-host/src/opexec.rs`)
into Cryptol definition by definition, so the law's gate can be proven exactly.
The law (the founder's 2026-10-13 order, as merged): one admitted attempt per
step, UNLESS the prior attempt is conclusively never-executed (no ledger row for
ANY of the step's 16 attempt encodings) AND the policy flag explicitly opts in
(default false); a replacement is a NEW attempt entity (`step | attempt<<4`,
`(max+1).min(15)`); old records stand.

**What the twin is NOT** (boundaries, stated in the module header): it is not a
proof about the compiled Rust — that equivalence is a SAW result class, a
separate leg. It does not verify the wire, the digest, or the claim. The op_id
is read as an injective key per encoded attempt (digest collision-freedom is
NOT claimed). The attempt nibble saturates at 15; the freshness obligation is
stated below saturation and the corner is named, not hidden.

## The obligations — 6, each its own `:prove` (Cryptol 3.6.0, yices, pinned)

1. `gateFailsClosed` — no opt-in, no replacement, whatever the ledger says.
2. `gateNeedsNeverExecuted` — any recorded effect row closes the gate.
3. `gateOpensOnlyWhenBothHold` — the gate is exactly the conjunction.
4. `replacementNeverTouchesARow` — a replacement's fresh entity has no row.
5. `freshAttemptBelowSaturation` — below saturation the entity is new to both
   journal and ledger.
6. `oldRecordsStand` — the transition only ever adds a record.

## The teeth — 2 negative controls, one textual substitution each, both REFUTE

- `optin-dropped` (the gate line loses the flag conjunct): counterexample
  `gateFailsClosed False 0x0000 = False` — the door opens without the flag.
- `zero-slot-only` (only attempt 0's row is checked): counterexample
  `gateNeedsNeverExecuted True 0x4000 = False` — a row at attempt 14 is missed.

## The harness

`scripts/bnrose-rust-001/cryptol-twin-check.sh` — the estate's formal-classes
law (wb001-cryptol-leg-check.sh's, unchanged): one process per obligation under
a 6 GiB address-space cap and its own clock; Q.E.D. → PROVEN; timeout/memory
death → NOT-PROVEN, recorded and GREEN (the formal ladder's law: an open
obligation is a recorded state, never a wedge); a counterexample on an
obligation, or a control without its counterexample, is RED. The COMPOSED line
prints PROVEN only when every obligation printed Q.E.D. in the same run.
CI: its own `cryptol-twin` job in the BNROSE lane workflow, running beside
`lane`, on the pinned cryptol 3.6.0 with bundled solvers.

## Receipts

Local (WSL Ubuntu, cryptol 3.6.0, yices 2.6.5, z3 4.8.14 — the CI-pinned
versions): the full check script green end-to-end — 6/6 PROVEN (each ≤1s, peak
RSS ≈118 MiB), both controls counterexampled, composed line PROVEN over
6 obligations + 2 controls. CI verdict recorded on the PR once run.

NEXT OWNER: any merger. HUMAN INTERACTION: NONE.
