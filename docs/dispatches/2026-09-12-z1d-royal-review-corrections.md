# z1.d — Royal Review corrections: identity checks + unambiguous publication outcomes

2026-09-12 · z1.d correction pass · fixes both required corrections from [Astra's integration
review](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647664844)
(comment 5647664844, reviewing candidate `55e43766`). Medium effort, signing/OAuth/live
adapters untouched — fixture-only, zero network, no merge/deploy.

| | |
|---|---|
| Parent | `55e43766` on `z1d/royal-review-2026-09-12` |
| Base | `8d42da28` (unchanged; origin checked before commit) |
| Owned paths | same as the slice: `crates/royalreview/**` only |
| Not touched | atmirror, receipt lexicon, shared UI, Watch/3Speak, any signing/OAuth/live adapter |

## Correction 1 — identity checks (Astra finding 1)

**Stale-ledger approval hole.** `nostr_leg`'s state short-circuit accepted
`probe == ledgered` without comparing either to the locally computed `expected_id`, so a
stale or hand-corrupted ledger that agreed with the rail could approve foreign content and
let the mirror proceed. Fix: **every success path in the leg now requires agreement with
`expected_id`**; a ledger+probe agreement on an id this run would NOT mint is a `Conflict`
("stale or foreign identity; refusing"). Regression:
`stale_ledger_matching_probe_but_not_local_computation_is_refused` — a foreign review takes
the identity, the corrupted ledger carries OUR review text + the FOREIGN event id (exactly
the shape that sailed through before): outcome `Conflict`, mirror `NotAttempted`, and no
new write. The normal `Already` path is unchanged (ledger == probe == expected).

**Second Nostr identity.** `publish` stored `nostr_pubkey` but never checked it, so a retry
under a different key would silently fork the twin binding (two `(pubkey, d-tag)` events for
one atproto record). Fix: one rkey, one identity — a changed publishing pubkey is refused
BEFORE any write. Regression: `retry_under_a_different_publishing_pubkey_is_refused_before_any_write`
(call counts frozen at 1/1 across the refusal).

## Correction 2 — ambiguous publication outcomes (Astra finding 2)

**A lost acknowledgement is UNKNOWN, not definitely unpublished.** New
`RailOutcome::Unconfirmed`: transport errors after a possible store, and unavailable probes,
report unknown — `Failed` is reserved for observed non-landing (explicit `Rejected`, or
`ExpiredSession` where no write was attempted past auth). After a lost acknowledgement the
orchestrator makes ONE best-effort reconcile probe: confirming the expected content upgrades
the run to `Published` (nostr: expected id; atproto: record-value equality); anything short
of that stays `Unconfirmed`. The mirror stays blocked while the owned rail is unconfirmed.

**A failed probe never asserts absence.** Pre-write probe errors, ledger-confirming probe
errors and reconcile-probe errors are all `Unconfirmed` — `TwinReport::summary()` gains an
`UNRESOLVED — … settle by probe, never re-publish blindly` line for any run holding an
unknown rail, and "NOT PUBLISHED" now appears only when a non-landing was actually observed
(rejections) or both rails are definitely down. `both_published()` is unchanged and still
structurally excludes every non-landed shape including `Unconfirmed`.

Regressions (first report AND retry, both rails, per the review):
- `nostr_lost_ack_with_unavailable_reconcile_is_unconfirmed_then_retry_settles_by_probe`
  — first report `Unconfirmed` + mirror `NotAttempted` + `UNRESOLVED` summary; retry settles
  by probe (`Already`), still exactly ONE nostr write.
- `atproto_lost_ack_with_unavailable_reconcile_is_unconfirmed_then_retry_settles` — first
  report `PARTIAL … UNCONFIRMED`; retry settles by record equality (`Already`), one write.
- `lost_nostr_acknowledgement_is_reconciled_immediately_by_probe` /
  `lost_atproto_acknowledgement_is_reconciled_by_record_equality` — the reconcile probe
  AVAILABLE case: same-run `Published`, one write.
- `unavailable_probes_never_assert_absence` — pre-write probe down (fresh and LEDGERED
  entries) and atproto read down: all `Unconfirmed`, zero blind writes.
- `definite_rejection_on_nostr_is_failed_not_unconfirmed` — the complement: an observed
  rejection is still `Failed`/`NOT PUBLISHED`.
- The never-both-ok outcome grid gains the `Unconfirmed` rows (`PARTIAL` when only the
  mirror is unknown, `UNRESOLVED` when the owned rail is unknown).

Updated with the new semantics (not weakened): the former transport-`Failed` assertions in
the partial-success and mirror-block tests now assert `Unconfirmed`/`UNRESOLVED`.

## Fixture support

`MemNostrSink`/`MemAtprotoSink` gain nth-call probe failure injection
(`fail_probe_on_nth` / `fail_get_on_nth`, `Cell` counters because the read traits take
`&self`) so the UNCONFIRMED paths are deterministically reachable — the pre-write probe can
succeed while the reconcile probe fails, which is the exact crash-window shape under review.

## Tests

`cargo test -p royalreview`: **39/39 green** (14 unit + 17 orchestration + 8 validation),
zero network; `cargo fmt --all --check` clean; `cargo build --locked` green. Six net-new
regression tests plus three new outcome-grid rows, per the review's requested cases.

## Wording correction accepted

The review is right that my slice dispatch overstated the recovery: the Week-1 draft was
**not found in any searched location** (5 grok branches, 3 grok worktrees incl. untracked
files, dispatches, the one stash) — that is the finding; "does not exist" is stronger than
the evidence and this dispatch supersedes that wording.

## Still out of scope (unchanged)

Signing/BIP-340, the browser OAuth deliberate-publication slice, live adapters of any kind,
schema/validator parity + receipt-bytes validation (Astra's named next boundary), the
sink-reported CID limitation (kept visible in-crate and in the slice dispatch).
