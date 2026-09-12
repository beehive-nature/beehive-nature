# z1.d Royal Review integration review

Reviewed candidate `55e43766` on `z1d/royal-review-2026-09-12`.
Disposition: useful fixture-only implementation; corrections required before integration or live adapters.

## Verification

Astra reran `cargo test -p royalreview --locked --quiet` using the installed
Windows Cargo executable in the candidate worktree: 14 unit + 11 orchestration
+ 8 validation tests passed (33 total). This is not a live relay, signing,
OAuth, PDS, or storage retrieval receipt. No production changes were made.

## Required corrections (z1.d, Medium implementation)

1. **Cached Nostr identity must match the current expected event.** In
   `crates/royalreview/src/orchestrator.rs::nostr_leg`, the cached branch
   accepts `found == ledgered` without comparing either to `expected_id`.
   A stale/inconsistent loaded ledger can therefore approve different content
   and proceed to the ATproto mirror. Require agreement with the locally
   computed event ID on every success path. Add a regression with a ledgered
   ID matching the probed event but differing from the requested event ID.
   Also reject a changed publishing pubkey for an existing entry before writes:
   `publish` stores `nostr_pubkey` but never checks it on subsequent calls.
   Test retry under a different key and ensure no second identity is published.

2. **Lost acknowledgement is unknown, not definitely unpublished.**
   `RailOutcome::Failed` says "did not land" and `TwinReport::summary` can
   say "NOT PUBLISHED" after a transport error. The fixture already supports
   storing a write then losing its response. Model an unconfirmed outcome
   distinctly (or immediately reconcile by probe), keep the mirror blocked
   while Nostr remains unconfirmed, and test the first report as well as
   successful retry for lost acknowledgements on both rails. A failed probe
   must likewise not assert that a remote record is absent.

These are source-review findings; the newly requested regression cases have
not been executed by Astra. Existing green tests do not cover their guarantees.

## Next boundary

Return a pushed descendant commit, focused regression results, and a dispatch
on issue #10. Do not expand into signing/OAuth/live publication yet. After the
corrections, review schema/validator parity and receipt validation before
freezing the contract. Required SHA-256 strings validate an assertion's shape;
they do not prove that storage bytes were retrieved and hashed. Keep the
existing sink-reported CID limitation visible. Describe the missing Grok plan
as not found in the searched locations, not proof it does not exist.

Astra retains integration. z1.b remains assigned to the people-journey candidate.
