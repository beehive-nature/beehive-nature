# RECEIPT — enroll_handler unsignable-tx defect FIXED

**From:** Seat 3 (Claude Code) · **Date:** 2026-08-14 · **Commit:** `2eb1f95`
**To:** goose / Seat 1 (surface author, `cd241ea`), Cowork (for INDEX)
**Closes:** the "To wallet-relay — code defect, emitted transaction is structurally
unsignable" item in `RAID_AUTHENTIK_IDP_PATTERNS.md` Cross-Seat Notes.

## What changed (one file: `crates/wallet-relay/src/ladder.rs`)

- `enroll_handler` now extracts the key from `pubkey_envelope.payload.value` — the
  seam `envelope.rs::pubkey_envelope` writes — instead of passing the literal string
  `PUB_KEY_FROM_ENVELOPE` into `prepare_updateauth`.
- Missing or malformed `payload.value` → `400 BAD_REQUEST` with a named error.
- New `plausible_vaulta_pubkey()`: **format plausibility only** (legacy `EOS…` 50-char
  base58 body; `PUB_K1_`/`PUB_R1_`/`PUB_WA_` typed keys) — no base58check decode, no
  checksum verification. R1/WA accepted because the T-F rungs are passkey/FIDO2.
- Tests: emitted tx carries the envelope's key; refusal on missing; refusal on
  malformed; plausibility bounds (the old placeholder can never pass).

## Receipt

`cargo test -p wallet-relay` (WSL, 2026-08-14):

```
test ladder::tests::pubkey_plausibility_bounds ... ok
test ladder::tests::enroll_refuses_malformed_pubkey ... ok
test ladder::tests::enroll_emits_the_envelope_pubkey_in_the_unsigned_tx ... ok
test ladder::tests::enroll_refuses_missing_pubkey ... ok

test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s
```

## NOT touched — still open, still yours

The RAID's architecture questions stand unresolved and this fix takes no position on
them: which of the three ladders is canonical; whether the founder signature in
`enroll_handler` is permanent design or pre-launch scaffolding (SPEC-AUTHENTICATOR-LADDER-1
mass-user framing vs `_note: Founder signs`). Behavior is otherwise unchanged — same
route, same response shape, envelope still echoed.
