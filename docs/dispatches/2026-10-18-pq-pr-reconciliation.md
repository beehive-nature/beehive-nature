# PQ assurance PR reconciliation — 2026-10-18

Reconciled the complete content of PR #430 at `ada2cb86` onto current main
`7163316b`. The original five-commit contribution failed the repository's
author-identity rule, including the proof commit. Its hosted PQ and SAW
workflows passed, but that did not make the draft PR ready to merge. The
earlier handoff should have caught the identity failure before publication.

The replacement contains one attributed contribution on current main. The
original branch and its receipts remain intact; no force push or change to
the identity rule is needed. The entire patch applied cleanly in its own
worktree. The x0x implementation, isolated locks, candidate, Rust proof
controller/contracts, native controllers and NTT transcript corrections are
byte-identical to the original PR head. All 105 bound source hashes match
the original proof receipt.

## Changes to delivery

- Use the repository's exact founder author identity, a separate Codex
  committer identity, and a parsed `Co-authored-by` trailer. Run the actual
  staged identity check, use the tracked identity hooks for the commit, and
  check the entire main-to-head contribution before pushing.
- Preserve current main's CI cancellation and caching changes. The prepared
  proof step now uses `!cancelled()` while evidence upload still uses
  `always()`.
- Run the two PQ workflows on PR updates, main pushes and manual dispatches.
  A feature push followed by opening/updating its PR no longer duplicates
  those expensive batteries and arithmetic replays. The existing identity
  and secret workflows still audit every branch push independently.
- Run the prepared-key proof immediately after
  toolchain setup, before the longer arithmetic replays, and upload its
  receipts immediately. Every existing arithmetic replay remains present.
- Give the isolated x0x job the same pinned Rust cache action and main-only
  save policy as the current PQ jobs. Its cache includes the pinned audit
  tool installation. The audit and every assurance check still execute.

## Fresh verification

The Rust controller ran again from the reconciled worktree using the pinned
SAW 1.6 / mir-json nightly-2026-03-21 toolchain. It built fresh linked MIR,
passed all **36 conditional compiled obligations**, and refuted all **seven**
deliberately false return-value claims. Native verification passed
**4245/4245** checks across **21** exact-count rows; all five defective native
verifiers and the empty-coverage run failed their intended gates.

Formatting, all-target Clippy with warnings denied, the CI shape check,
installed-hook controls, and the identity check's selftests passed. The
staged identity/message check also passed before creating the contribution.
The committed implementation/contract hashes were compared with the original
receipt; no old proof result was silently substituted for the fresh run.

Fresh evidence is in
[`docs/receipts/pq-reconcile-2026-10-18`](../receipts/pq-reconcile-2026-10-18).
The manifest records the reconciled parent, original PR head, source equality,
and hashes of every retained original/compressed artifact. Large native
receipts, full proof transcripts and fresh MIR are retained losslessly.
The proof runner's `base_commit` remains its pinned implementation baseline
`a4296c847`; the reconciliation manifest records the execution parent
`7163316b`. Exact source hashes bind both records.

The [original boundary](../../crates/btungsten-x0x-pq/proof/README.md) is
unchanged: acceptance/rejection equivalence under explicit shared FIPS
contracts, universal over bytes at the enumerated lengths. Unbounded compiled
slice-length equivalence, arithmetic qualification and full-system security
remain unproved. The old KAT, performance and audit receipts remain prior
evidence. A green hosted result for the replacement commit must be observed
separately; it is not inferred from the prior PR's green proof workflows.
