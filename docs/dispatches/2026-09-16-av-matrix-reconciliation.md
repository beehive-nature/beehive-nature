# AV P0/P1 MATRIX — specified → implemented/CI-proven → live-wired · 2026-09-16

**Order (founder, verbatim):** *"After AV-11, stop consuming new adversarial
items for one reconciliation pass. Produce the P0/P1 matrix with three
independently evidenced states: specified → implemented/CI-proven →
live-wired/operationally proven. That last column matters now. AV-1/2/3 and
these P1 protections can be excellent repository laws while the deployed
caller still lacks the new signal/configuration. We should never let 'green
in CI' silently become 'protecting money in production.'"*
**Method:** each cell carries its own evidence citation (commit, dispatch,
or in-tree receipt); where live-wired status is UNKNOWN or NOT-YET, the
blocking step is named. State definitions: **specified** = the gap + law
named in the adversarial queue (or D/CA specs); **implemented/CI-proven** =
code + tests landed on main (local suite green; CI arbitrates on push);
**live-wired** = the deployed caller actually emits/consumes the new
signal/configuration in production — receipts, not intent.

## The matrix

| item | specified | implemented / CI-proven | live-wired / operational |
|---|---|---|---|
| **AV-1** serve-bridge crash/concurrency | ADVERSARIAL-BPAY-QUEUE A8/AV-1 | **YES** — another workerb, RED→GREEN, CI-green (av1-serve-bridge lane; admin settle/charge rail w/ idempotency keys, fsync-before-respond, chain-fork race fixed) | **NOT-YET** — that lane's own receipt: *"NO deploy (gated on token + fresh rates)"*; the box serve bridge predates the fix |
| **AV-2** stale-rate TTL | A3/AV-2 | **YES** — RED→GREEN CI-green (av2-stale-quote lane: quote TTL + single-use in voucher-escrow + StaleRateSet serve-side) | **NOT-YET** — same lane: TTL number + box mint discipline = pending founder rulings; deployed mint does not serve TTL'd rates yet |
| **AV-3** meter/door split-brain | A6/AV-3 | **YES** — RED→GREEN CI-green (av3-split-brain lane: door-down accrual parks (reason door\|balance), no backfill) | **PARTIAL/UNKNOWN** — engine units are box-live (voucher/meter), but the parking behavior's operational receipt on the deployed pair was not evidenced in-tree by that lane; treat as repo-law until a live drill receipt lands |
| **AV-6** retry ceiling | A3/AV-6 + founder distinction | **YES** — this seat @424d0dc0: `settle_attempts` + `max_settle_attempts_per_leg` (3) + loud FailedKeep-gated refusal; adversarial 11/11 local | **NOT-YET** — the door itself is pre-production (Sepolia smoke staged, no prod deployment); no live caller consumes the refusal yet |
| **AV-5** reorg boundary | A2/AV-5 + founder law verbatim | **YES** — this seat @f99cd316: `ReorgFlagged` + `flag_reorg`/`resolve_reorg` (HumanGate + upto-bounded), replay/release/refusal laws, exposure re-retained | **NOT-YET** — same: no chain notifier calls `flag_reorg` in any deployed path; the reversibility crate remains unwired to pollers (the A2 half of AV-5 — see open items) |
| **AV-4** cross-rail audit | A1/AV-4 + R4 | **YES** — this seat @8a94a986: `tests/r4_audit.rs` detector (value-level joins, keys=schema) + leaking fixture; plus the flake fix (time-dependent LegKey lesson) | **N/A-as-test + NOT-YET-as-scan** — the detector is a repo gate today; it has NOT been run against PRODUCTION journal/receipt stores (the door is pre-prod; box-side stores unaudited by it) |
| **AV-11** R5 surface audit | A7/AV-11 + R5 | **YES** — this seat @eeb541d7: `scripts/r5-surface-audit.mjs`, selftest-validated, **live scan verdict: 113/113 surfaces ZERO human-gas asks** | **OPERATIONAL-BY-DEFINITION** (surfaces ARE the live estate face) — but the gate is not yet a CI step; re-runs are manual until the pipeline owner wires it |
| **AV-7** two-route fixture | A4 | **YES** (door battery `adv_av7_two_route_acceptance_no_double_debit`) | rides the door's deployment state (NOT-YET) |
| **AV-8** settle-UNKNOWN | A2/A8 | **YES** (`adv_av8` + `resolve_unknown` gate) | rides the door (NOT-YET); box pollers' unknown-status law remains the named open invariant |
| **AV-9** privacy escape-path | A5 | **NO** — named only (P3; witness-retention founder question open) | — |
| **AV-10** adapter substitution | A6 | **PARTIAL** — `acceptance_7_door_swap_zero_surface_change` exists (door-level); the RING-level substitution drill (swap adapter behind production surfaces) not evidenced | **NOT-YET** |

## The honest headline

**Every P0/P1 protection landed so far is a REPOSITORY LAW, not yet a
PRODUCTION PROTECTION.** The door family (AV-4/5/6/7/8) guards a component
that has no production deployment yet (Sepolia smoke staged only); the
voucher/meter engines (AV-1/2/3) are box-live but their fixes await deploy
gates (token+fresh rates; founder TTL ruling; live drill receipts). AV-11
is the one item whose subject is already live (the surfaces fleet) — and it
PASSES today, with the gate now banked but not CI-wired.

**Live-wiring checklist (the named blockers, per row):** (1) door →
Sepolia smoke → founder-gated production placement; (2) serve-bridge deploy
(token + fresh rates); (3) TTL ruling + box mint re-serve; (4) split-brain
live drill receipt; (5) `flag_reorg` notifier wiring (reversibility crate →
pollers — the unfinished A2 half); (6) r4-audit run against production
stores once they exist; (7) r5-audit CI step.

## Standing orders honored

- Founder distinction banked in the AV-6 receipt: `max_attempts` ≠
  `max_failure_charge`; never infer one from the other.
- **This seat STOPS consuming adversarial items here** (per order) after
  AV-5 → AV-4 → AV-11 landed in sequence, each verified untaken first.
- Hex-law block receipted (AV-5's first commit attempt was blocked by the
  pre-commit hook — the law worked).
- Flake fix receipted (time-dependent LegKey lesson — callers must capture
  `valid_before` once; the journal's identity law caught it).

## Landing

This matrix + the consumption-log updates land with this dispatch; branch
`zcode/av5-av4-av11-matrix-2026-09-16`. Local suite receipts: door
acceptance 11 + adversarial 11 + d_specs 10 + r4_audit 2 (8/8 clean runs
after the flake fix); r5 audit selftest PASS + live scan 113/113 clean.
CI arbitrates.
