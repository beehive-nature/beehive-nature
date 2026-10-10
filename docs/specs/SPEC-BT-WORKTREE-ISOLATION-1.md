# SPEC-BT-WORKTREE-ISOLATION-1 — autonomous-seat contamination resistance

Status: **SPECIFIED / NOT BUILT / NOT RUN** (founder label, 2026-10-07,
reaffirmed 2026-10-09). Nothing in this spec is claimed as built or
running. This document opens the in-tree class record the spec handoff
named ("it lands in-tree only when the bTunGsTeN seat opens the WB
slot" — opened 2026-10-09).

Class: BT-WORKTREE-ISOLATION — its own bTunGsTeN class, extending
SPEC-BTUNGSTEN-1's workbench sequence. Evidence for the fixtures: the
three-mode wt-zcode incident (staged foreign content; branch/HEAD
displacement mid-session; attribution-by-courtesy) and the concurrent
shared-tree compile contamination. The incidents are evidence FOR the
fixtures, never evidence that a proposed detector works.

## The invariant (founder formulation, verbatim)

The shared worktree itself is the mutable security boundary — index
isolation alone is insufficient because HEAD, branch, checked-out tree, staged state,
commit tree, and commit attribution can all be mutated by another
concurrent seat.

> **Seat Isolation Invariant:** no autonomous seat may be able to alter
> another seat's branch, working tree, index, staged set, commit tree,
> or attribution without producing an explicit, machine-detectable
> failure before commit.

## The three-claim taxonomy (canon — never blur them)

- **DETECTION** — a hook or CI job notices contamination.
- **PREVENTION** — the protected operation rejects the candidate.
- **PUBLICATION INTEGRITY** — the protected ref/artifact remains
  unchanged after rejection.

Measured estate state (2026-10-07, read-only `gh api`: zero rulesets;
`main` reports "Branch not protected"): the class can claim **DETECTION
ONLY** at the Git admission boundary today. Post-push CI proves
detection, not prevention — a red check after a direct push means the
push already became visible; blocking later deploy/promotion is a
different boundary. Configuring rulesets changes seat workflow (direct
pushes to `main` are the current norm) and is a founder decision this
spec surfaces, not something a seat may configure.

**Acceptance receipt shape (anything less is not publication
fencing):** the paired observation —

    candidate rejected  +  protected reference unchanged

## The boundary (founder default)

**Canonical-branch admission**, not "first public upload". Public
scratch/feature branches remain cheap and autonomous; the irreversible
trust transition is admission into canonical history. Release then
imposes an additional, stronger boundary rather than carrying the whole
isolation burden itself. The hierarchy, each step strengthening without
making every experimental push bureaucratic:

    local worktree
      → advisory lease / hooks
      → public working branch
      → PROTECTED CANONICAL ADMISSION
      → release boundary

## The epoch rule (TOCTOU closed)

The fencing check occurs as part of acceptance of the EXACT candidate,
against the CURRENT lease epoch. A seat that successfully validated at
epoch N must still be rejected if recovery advances authority to epoch
N+1 before publication — otherwise TOCTOU reopens the resurrection
path. Lease rotation and publication acceptance are ORDERED so an
earlier success cannot survive a later revocation.

## Four adversarial scenarios (the acceptance set)

1. foreign staged content (including SCANNER-CLEAN foreign edits —
   isolation must hold when every content gate passes);
2. branch / HEAD / tree displacement mid-session;
3. provenance / attribution contamination;
4. stale-seat resurrection: an old process waking after lease recovery
   and epoch rotation must FAIL even holding the old session ID and
   filesystem state.

Each scenario runs with local enforcement enabled AND bypassed
(`--no-verify`); the publication-layer run must show BOTH the intended
rejection AND an unchanged protected ref/artifact.

## Eight pass conditions

Exclusive worktree lease per seat; no foreign branch-switch/index/tree
mutation; explicit stale-lease recovery; commit tree == the issuing
seat's declared pathspec/diff set; provenance policy-enforced (not
conventional); SCANNER-CLEAN foreign edits still blocked; no permanent
orphaned locks after crash/restart; offline + deterministic throughout.

## Enforcement chain (two stages + the backstop)

pre-commit carries the Seat Isolation Invariant itself (lease ownership,
HEAD/branch identity, index digest, declared pathspec/diff-set equality);
commit-msg carries the provenance law (committer/author/co-author
policy, seat identity, required trailers, attribution consistency). The
failure classes are kept distinct because a work/lease rejection and an
attribution rejection have different remediation paths. Both stages are
`--no-verify`-able: the push-time backstop is the guarantee.

**The canonical claim (verbatim — never say "the hooks prevent
contamination"):**

> Contamination must be detected before publication even if local
> enforcement is bypassed.

Local layers are fail-FAST; the push-time backstop is the guarantee.
Stale-lease recovery REQUIRES evidence the prior seat is no longer
active AND ROTATES the lease epoch (fencing-token semantics).

## The honest ledger this class lives beside (2026-10-09, receipted)

- BT-WORKTREE-ISOLATION: specified, not built, not run (this document).
- finalizer: the founder's authoritative correction (2026-10-07 — "no
  live-v3 claim should survive in canon until that exact repaired
  artifact executes") was honored and then CLOSED BY RECEIPT on
  2026-10-08: the exact repaired v4 artifact — byte-identical to the
  blob merged at `8519eab6c` (sha256 5529c92d…) — executed live, green
  (exit 0, 9 passed / 0 failed / 0 never-ran;
  `docs/receipts/zkr-live-v4-green-2026-10-08.txt`; the first red run
  kept verbatim beside it). v3 itself never ran live; v2's 9/9 at
  `fd12cc373` predates the repair.
- zkreceipts coupling boundary: remains closed.
- leak distinguisher (tungsten-2): EARNED at its pre-registered scope
  2026-10-08 (`9ba22a7d4` — preregistered criterion PASSED, honest
  point estimate receipted).
- remaining acceptance work: 1k/10k scale (tungsten-4; 1k compile in
  flight per the obligations dispatch, 10k box-gated).
- `zkrtst444444`: preserved exhaustion fixture.
