# 2026-10-09 — BT-WORKTREE-ISOLATION: the class record opened in-tree (SPECIFIED / NOT BUILT / NOT RUN), and the ledger reconciled against receipts

Lane: btungsten / class canonization. Seat: zCode. Order: founder
2026-10-09 (the ledger-close message — detection/prevention/publication
integrity, the paired observation, the epoch refinement, the
canonical-admission boundary, and the finalizer correction).

## Reconciliation first

The order re-issues the founder's 2026-10-07 ledger close. Its class
half was already fully specified in the seat record — and its own
handoff note said the record "lands in-tree only when the bTunGsTeN
seat opens the WB slot." That slot is now open: this beat opens it.

Its ledger half needed receipt reconciliation, because the canon moved
after 2026-10-07:

- **Finalizer.** The founder's correction — "no live-v3 claim should
  survive in canon until that exact repaired artifact executes" — was
  honored AND closed by receipt on 2026-10-08: the exact repaired v4
  artifact (byte-identical to the blob merged at `8519eab6c`, sha256
  `5529c92d…`) executed live, green: exit 0, 9 passed / 0 failed / 0
  never-ran, `docs/receipts/zkr-live-v4-green-2026-10-08.txt` (the
  first red run kept verbatim beside it, with the live-caught helper
  defect fixed the same day). v3 itself never ran live; v2's 9/9 at
  `fd12cc373` predates the repair. The honest line today is therefore
  not "live confirmation still absent" but "live v4 green, receipted;
  the correction line is closed."
- **Leak distinguisher.** Tungsten-2 is EARNED at its pre-registered
  scope (2026-10-08, `9ba22a7d4`: the preregistered criterion PASSED,
  honest point estimate receipted). The remaining acceptance work is
  the 1k/10k scale (tungsten-4; 1k compile in flight per the
  obligations dispatch `4601b8306`, 10k box-gated).
- Unchanged and correct: the class label SPECIFIED / NOT BUILT / NOT
  RUN; the zkreceipts coupling boundary closed; `zkrtst444444`
  preserved as the exhaustion fixture.

## What landed

**`docs/specs/SPEC-BT-WORKTREE-ISOLATION-1.md`** — the class record,
opened with the founder's own structure, honestly labeled:

- the Seat Isolation Invariant (verbatim founder formulation);
- the three-claim taxonomy — DETECTION / PREVENTION / PUBLICATION
  INTEGRITY — with the measured estate state (zero rulesets, main
  unprotected: detection only) and the founder decision ruleset
  configuration remains;
- the paired-observation acceptance receipt — `candidate rejected` +
  `protected reference unchanged` — "anything less is not publication
  fencing";
- the canonical-branch-admission boundary default and the five-step
  hierarchy (local worktree → advisory lease/hooks → public working
  branch → protected canonical admission → release boundary);
- the epoch/TOCTOU rule: fencing at acceptance of the EXACT candidate
  against the CURRENT epoch; epoch-N validation rejected if recovery
  advances to N+1 before publication;
- the four adversarial scenarios (foreign staged content incl.
  SCANNER-CLEAN; displacement; attribution; stale-seat resurrection),
  each run with enforcement enabled AND bypassed;
- the eight pass conditions; the two-stage enforcement chain + the
  push-time backstop; the canonical claim verbatim ("Contamination must
  be detected before publication even if local enforcement is
  bypassed");
- the receipted ledger above, dated.

**SPEC-BTUNGSTEN-1** gains the class pointer beside §watch (one
paragraph, labeled SPECIFIED / NOT BUILT / NOT RUN).

Nothing is built, nothing is run, no hooks or rulesets were touched.
This PR is text-only canonization + reconciliation.

## NEXT OWNER

- Merge order: #379 (L5) first, then this stacked PR; both blocked on
  the estate-wide inherited footer-audit red (bDroP seat's call), as
  named in their dispatches.
- The BUILD belongs to the bTunGsTeN seat's WB slot per the class
  record — not to be built in parallel from another worktree.

HUMAN INTERACTION: NONE.
