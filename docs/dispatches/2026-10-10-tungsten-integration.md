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
Fresh CI will validate the merged repository tree.

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

Pending on this pre-merge dispatch revision. Exact tested head, merge SHA and
post-merge CI receipts will be recorded here after observation, before archival.
