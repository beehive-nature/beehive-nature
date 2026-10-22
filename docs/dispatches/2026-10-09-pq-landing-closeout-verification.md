# PQ proof batch landing: independent closeout verification

Date: 2026-10-09 (America/Denver).

This continues the landing recorded in `2026-10-10-pq-proof-batch-landed.md`.
No new proof scope or code changes are included.

## Origin and ancestry

A fresh `git fetch origin` and the GitHub branches API both returned main at
`235d0f030`, the landing receipt commit. Git ancestry checks confirmed that
main contains frozen batch `507fd3b76`, integration `9f42d072f`, and both
repairs (`511a8cd31`, `299c3f139`). The receipt changes one dispatch file only.

The eight post-landing push workflows on integration `9f42d072f` were also
independently re-read through GitHub Actions: all completed successfully.

## Receipt CI

Final verification on 2026-10-09 (MDT): all eight push-triggered workflows on exact receipt
commit `235d0f030` were completed with conclusion `success`:

| Workflow | Run | Result |
| --- | --- | --- |
| bTunGsTeN RB | [38024604601](https://github.com/beehive-nature/beehive-nature/actions/runs/38024604601) | success |
| secret-scan | [38024604663](https://github.com/beehive-nature/beehive-nature/actions/runs/38024604663) | success |
| WB002 SAW equivalence | [38024604624](https://github.com/beehive-nature/beehive-nature/actions/runs/38024604624) | success |
| WB002 WASM corpus | [38024604616](https://github.com/beehive-nature/beehive-nature/actions/runs/38024604616) | success |
| bTunGsTeN PQ | [38024604608](https://github.com/beehive-nature/beehive-nature/actions/runs/38024604608) | success |
| WB001 SAW proofs | [38024604636](https://github.com/beehive-nature/beehive-nature/actions/runs/38024604636) | success |
| tests | [38024604635](https://github.com/beehive-nature/beehive-nature/actions/runs/38024604635) | success |
| bTunGsTeN PQ SAW | [38024604607](https://github.com/beehive-nature/beehive-nature/actions/runs/38024604607) | success |

Pages deployment [38024604739](https://github.com/beehive-nature/beehive-nature/actions/runs/38024604739)
also completed successfully; it is separate from the eight push workflows.

A final fetch and GitHub branches API read found main at `804cd2c86`, the
subsequent PR #374 RB04 merge. An ancestry check confirmed `235d0f030` remains
on main, so the frozen batch, integration and repairs remain in its history.
That later head has its own CI in progress; this closeout does not call it green.

Disposition: the PQ proof batch landing and its original receipt are CLOSED.
This supplemental verification dispatch is published on the isolated
`codex/pq-landing-closeout-2026-10-09` branch; it does not advance main or claim
CI for its own documentation commit. The original landing receipt is on main.

## Scope

ZB-1 remains open. hkdf32, #371, the contract freeze, and the bDroP publisher
findings remain outside this landing. No new runtime or cryptographic claims
are made by this verification.

No local application tests were rerun: this operation verifies ancestry and
existing exact-commit CI, with no application changes. The shared checkout
was read only; documentation work uses the isolated Codex closeout worktree.
