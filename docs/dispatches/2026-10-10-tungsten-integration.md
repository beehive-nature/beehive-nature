# Agent 21 — Solana/Vaulta bTunGsTeN integration, October 10, 2026

Scope: finish existing PR [#338](https://github.com/beehive-nature/beehive-nature/pull/338),
preserve its acceptance limits and evidence, merge through the normal GitHub
workflow after applicable checks pass, and verify the resulting main commit.
No new features, public-chain deployment or mainnet spending.

## Refreshed starting state

- PR head: `c9fcf898a876bd2c5edf0f68aba19c75d7243fb2`.
- All 20 reported checks passed, including both `local-experiment` jobs and
  both `eternal` jobs. The old queued status is superseded by these results.
- GitHub reviews, inline comments, issue comments and review threads were empty.
  No submitted review finding required a code change.
- Freshly fetched main: `7f339bb0b03550a0c7cb091399fafbfb8e8d49f8`.
  The branch was 215 main commits behind. A normal merge imported those
  commits without conflicts or rewriting history.
- GitHub reports merge commits allowed, no main branch protection and no
  active main ruleset. The authorized workflow remains a normal PR merge,
  pinned to the tested head, with no administrative override.

The starting CI snapshot and evidence identities are banked in
[`2026-10-10-integration-baseline.json`](../../tools/solana-tungsten/evidence/2026-10-10-integration-baseline.json).
Already-landed main repairs are imported intact; no checks were weakened.

## Preserved acceptance

The Rust experiment, private-chain harness, durable inbox and its regressions,
existing INVOICE-1/RECON-1 helpers, and copied Vaulta verifier sources did not
change in this main integration. The October 7 public receipt and all three
failed-run diagnostics remain unchanged. A new private-chain run is not claimed
or needed solely to refresh documentation and import unrelated main changes.
CI validates the merged repository tree separately from the dated chain run.

The recorded private experiment delivered 111 receiver-verified messages,
finalized seven faucet lamports on Solana, and settled seven nonredeemable
fixture units through the matching Vaulta PLONK statement. Replay checks remain
at separate boundaries: `lab/inbox.py:Inbox.receive`, the durable Solana outbox,
and `lab/tungsten.cpp:tungsten::settle`. Transport history is not payment authority.

The separate one-unit fixture fee is **unpaid**. Both routes therefore retain
**PARTIALLY-SATISFIED** reconciliation through `lab/reconcile.mjs`; chain resource
costs do not silently satisfy that invoice line. This is private-test-chain
acceptance, not production settlement, a public-mesh scaling result, a universal
security certification or an independent cryptographic audit.

## Merge and post-merge verification

- Tested integration head: `b689fde58ae4a5a3cabf92ef8c1bf5cd20638896`.
  All nine retained pull-request workflows succeeded: 23 successful checks and
  four expected conditional skips (`rb01-psi`, `rb02-aes`, `rb03-budget`,
  `rb04-daedalus`). No submitted review findings were present at the final refresh.
- Seven unfinished duplicate push workflows were cancelled after verifying
  that the head and GitHub PR merge ref had the identical Git tree
  `e483c850f96741f139270f9f4427d88487ef2bb2`. All nine pull-request workflows
  were retained. Two push workflows had already succeeded. No checks changed.
- Normal PR merge: `36cea386fd3e9be242ec1df2275611de2d31a3a6`, recorded by
  GitHub at `2026-10-11T01:01:24Z` (October 10 in America/Denver).
  Its parents are main `fe3e9b8909fdf843367c252901df5a7df30e7bcb` and tested
  head `b689fde58ae4a5a3cabf92ef8c1bf5cd20638896`. The merge used a matching-head
  guard, with no force push or administrative override.
- The lab, INVOICE-1/RECON-1 dependencies and copied Vaulta verifier sources
  match the tested head at the merge commit. All four October 7 evidence blobs
  and both durable-inbox source/regression blobs match the starting baseline.

All nine post-merge push workflows completed successfully on that exact merge
SHA: **23 checks passed**, with the same **four conditional RB skips** and no
failed checks. Pages also completed successfully as a separate deployment run.

| Workflow | Successful post-merge run |
| --- | --- |
| solana-tungsten-local | [38100415357](https://github.com/beehive-nature/beehive-nature/actions/runs/38100415357) |
| tests | [38100415396](https://github.com/beehive-nature/beehive-nature/actions/runs/38100415396) |
| secret-scan | [38100415361](https://github.com/beehive-nature/beehive-nature/actions/runs/38100415361) |
| bTunGsTeN RB | [38100415369](https://github.com/beehive-nature/beehive-nature/actions/runs/38100415369) |
| bTunGsTeN PQ | [38100415378](https://github.com/beehive-nature/beehive-nature/actions/runs/38100415378) |
| bTunGsTeN PQ SAW | [38100415418](https://github.com/beehive-nature/beehive-nature/actions/runs/38100415418) |
| WB001 SAW proofs | [38100415403](https://github.com/beehive-nature/beehive-nature/actions/runs/38100415403) |
| WB002 SAW equivalence | [38100415373](https://github.com/beehive-nature/beehive-nature/actions/runs/38100415373) |
| WB002 WASM corpus | [38100415392](https://github.com/beehive-nature/beehive-nature/actions/runs/38100415392) |
| Pages deployment (separate) | [38100414699](https://github.com/beehive-nature/beehive-nature/actions/runs/38100414699) |

The post-merge lab job passed eight Rust boundary tests and two durable-inbox
regressions, rustfmt, clippy with warnings denied, and dependency audits with
zero findings. Its host-only reconciliation correctly remains **OPEN**.
The downloaded WB002 artifact contains three fresh-chain runs, each with
46 matching cases, zero classification mismatches and 14 atomic refusals.
Those WB002 runs are separate from the dated Solana/Vaulta private-chain run.

The committed [integration receipt](../receipts/tungsten/2026-10-10-pr338-integration.json)
banks merge identities, pre-merge and post-merge check results, duplicate-run
cancellation provenance, preserved blob identities and the three WB002 receipts.
The integration and post-merge verification are complete. This documentation
closeout records results for `36cea386f`; it does not claim fresh CI results for
the later receipt-only commit or a new Solana/Vaulta chain run. The one-unit
fixture fee remains unpaid and private-chain reconciliation remains
**PARTIALLY-SATISFIED**. No production settlement or mainnet spending occurred.
