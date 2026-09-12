# z2.c correction R1 — negative-review findings fixed

Seat z2.c (GLM/zCode), 2026-09-12. Order: `2026-09-12-z2c-negative-review.md`
(Astra). Same worktree `../wt-z2c-watchsign`, branch `codex/z2c-watchsign`,
descendant of the reviewed candidate `20659754` (no force, no rewrite).

## Probes reproduced FIRST (as ordered)

The reviewer's companion file appended verbatim to
`crates/watchpay/tests/adapter_signing.rs` at `20659754`, run with the
reviewer's exact command `cargo test -p watchpay --locked --offline --test
adapter_signing astra_review -- --nocapture`:

**0 passed / 3 failed** — exactly as reviewed. Probes then removed before
fixing.

## The four corrections

### P1 — cancelled result attaching to a replacement attempt

The attempt identity now rides the whole chain:

- `SignRequest::compose` takes `attempt_seq` (the sequence
  `Ledger::write_intent` returned; `0` is refused as never-persisted) and
  records it as an immutable field.
- `VerifiedSigned` carries `request_attempt_seq` (private; getter only).
- `Ledger::record_signed_at_attempt(vp, batch, expected_seq, tx, now)` is
  the NEW atomic expected-attempt transition: the state check (latest
  attempt is EXACTLY `expected_seq` in `Intent`) and the write happen in
  one transition with no getter step between them; a mismatch refuses
  naming the attempt binding with state and reservation untouched.
  `record_verified_signed` uses it exclusively.
- The z2.b synthetic `record_signed` remains public for the preserved
  tests and is now DOCUMENTED as the offline-only door that does not
  enforce the adapter's rules — with a test (`synthetic_record_signed_door_documented_as_unenforced`)
  pinning that documented limitation honestly instead of claiming it away.
- Post-dispatch vs pre-dispatch cancellation is documented in the module
  docs and typed by the new phase enum (below): cancelling an attempt
  whose request already left our hands is an explicit operator choice,
  lawful only because nothing signed-and-returned is in our hands and
  nothing was broadcast — never an automatic rollback; the attempt
  binding then guarantees the cancelled attempt's late response cannot
  attach to its replacement.

Regression: `cancelled_result_cannot_attach_to_replacement_attempt` — the
reviewer's exact sequence (intent nonce 7 → compose/verify A → cancel →
NEW intent nonce 7 → submit A) now refuses with the attempt binding, the
replacement attempt stays `Intent` with its reservation held, and a
healthy control (recording for the attempt it was verified for) succeeds.
Probe 3's original syntax no longer compiles (compose gained the
`attempt_seq` parameter) — adapted faithfully as above.

### P1 — review summary substituting another plan's payer

The API change eliminates the substitution: `review_summary()` takes NO
plan argument. The payer and approve-ceiling figures are pinned into the
immutable `SignRequest` AT COMPOSITION from the composing plan; the
summary additionally carries the derivation path, envelope family,
attempt sequence, native value (zero) and a keccak commitment over the
exact calldata bytes (plus its length) — the full relevant transaction
identity. Regression: `review_summary_is_single_sourced_from_the_composing_plan`
asserts every field against the composing plan and includes a healthy
control where a genuinely different plan's request disagrees. Probe 2's
original syntax no longer compiles (the external plan parameter is gone).

### P2 — response wire shape

`ConnectSignedTxRaw.serialized_tx` now maps to Connect's camelCase
`serializedTx` via serde rename, with `deny_unknown_fields`. New
production decoding boundary `ConnectSignedTxRaw::decode_wire(&str)`:
bounds the whole JSON document BEFORE parsing, then strict-parses; the
outer Connect envelope (`{success, payload}`) is explicitly NOT modeled —
unwrapping it is the transport layer's concern, stated on the type, and
an accidentally whole-envelope object now fails loudly instead of
half-decoding. The reviewer's probe 1 passes VERBATIM at this pin (run
and receipted during development, then removed in favor of the permanent
regressions). Regressions: `actual_connect_wire_response_decodes_and_verifies_end_to_end`
(decode at the boundary then full verification) and
`wire_boundary_refuses_missing_unknown_malformed_oversized` (missing
field, whole-envelope shape, non-object, garbage, oversized document
refused before parsing).

### Freshness gap — post-transport expiry

`sign_batch_payment` no longer reuses a pre-call timestamp: it takes an
injected `ConnectClock` (no implementation ships; tests use deterministic
step clocks) and reads it exactly twice — `t0` at intent/compose and `t1`
AFTER the transport returns. A plan expiring DURING the bridge call is
refused at the recording boundary (`t1` revalidation inside the ledger
transition), with the intent and reservation preserved and the late
result never recorded. Every failure is phase-typed:

- `SignAttemptError::BeforeDispatch` — the bridge was never called;
  nothing dispatched; any written intent is cleanly cancellable.
- `SignAttemptError::AfterDispatch` — the bridge was called (transport
  error included: refusal/timeout still means the request left our
  hands); the attempt's outcome is uncertain on the device side; the
  intent and reservation are kept; explicit operator action only.

Regressions: `expiry_during_bridge_call_refused_and_reservation_kept`
(step clock advances t1 past expiry without sleeping; after-dispatch
phase; intent + reservation held; healthy control at a small step
succeeds) and `pre_dispatch_expiry_is_phase_distinguished` (already-
expired plan at t0 → BeforeDispatch, zero transport invocations, nothing
persisted).

## Evidence

- **114 passed / 0 failed** offline (`cargo test -p watchpay --locked
  --offline`): all 107 prior tests retained (driver/compose call sites
  faithfully adapted to the new signatures; no assertion silently
  weakened) + the 7 correction regressions above.
- Reviewer's probe 1 passes verbatim; probes 2–3 adapted (their invalid
  calls no longer compile — the substitutions were eliminated, not
  tolerated).
- `cargo fmt --all --check` clean; `cargo clippy -p watchpay --locked
  --offline --all-targets` zero warnings; `scripts/secret-scan.sh` clean
  (tree + diff); lockfile unchanged this round.
- No device, Suite/Connect session, SDK init, real signing, RPC,
  broadcast, upload, payment, deployment, merge, or upstream PR. No other
  seat's worktree touched. z2.d's separately authorized web release
  untouched.

## Return

Descendant commit on `codex/z2c-watchsign` (canonical attribution:
founder author, zCode committer, parsed coauthor trailer), pushed without
force; hosted checks reported at the exact SHA in the commit message.
Ready for re-review.
