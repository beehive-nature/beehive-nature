# SPIKE — the bSAFE 7 host: THP-over-UDP to a signed message from an htmx surface

Sequencing item 2 of the founder-approved plan (2026-08-20): *btleplug + noise-rust +
protobufs from trezor-suite, against trezor-user-env's emulator; goal: one signed message
round-trip from an htmx surface.*

## Why v0 has no btleplug (a sequencing correction, stated not hidden)

The **emulator speaks UDP (127.0.0.1:21324), not BLE.** btleplug is the real-device
radio leg; pulling it in now would make the spike unbuildable on radio-less CI hardware
and would test nothing the emulator can answer. So the legs are ordered:

| leg | transport | status |
|---|---|---|
| 0 · datagram harness + channel bookkeeping | in-process sockets | **this crate** — builds and passes on any host |
| 1 · THP session over UDP against trezor-user-env (protobufs vendored from trezor-suite `rust/` crates at a pinned commit; noise via our `thp` crate, 4/4 green) | UDP | next — requires the emulator env |
| 2 · `GetPublicKey`/`SignMessage` round-trip surfaced to an htmx page (htmx polls a local spike server; no framework, no build step — the house grammar) | UDP + HTTP | the goal state |
| 3 · btleplug for the physical Safe 7 (BLE) | BLE | only after 2 |

## What is deliberately reused, not rebuilt

- **Noise XX + THP framing**: the sibling `thp` crate (frame codec, initiator/responder,
  seal/open) — its 4/4 suite is the handshake receipt; the spike adds transport, not crypto.
- **Protobufs**: vendored from trezor-suite's THP/message definitions at a **pinned
  commit** with the commit hash recorded here when leg 1 lands — never a floating tag.

## CI net (sequencing item 3) — wired when leg 1 exists

`fido2-tests + user-env` against bSAFE 7 builds, with an explicit **hmac-secret/PRF
conformance check** (the leverage dispatch already receipted that the emulator's fido2
impl advertises `hmac-secret` at `fido2.py:1943` and gates its reveal at `:1892–1896` —
the conformance check exists to catch exactly that class of drift between our build and
upstream's). Deferred to the moment there is an emulator leg to run it against — a CI
lane that tests nothing is worse than no lane.

## Definitions registry (sequencing item 4)

Lives at `docs/specs/SPEC-BDEF-REGISTRY-0.md` — vendor channel + self-signed additions,
fork's signing key founder-held.

## Verification, current state

- `cargo test -p spike` — transport round-trip, in-process (receipted in the landing
  commit message).
- The emulator leg's receipts land here as they are earned. Failed probes print as
  failures and exit non-zero — absence is never silently zero.
