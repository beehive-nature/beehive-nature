# 2026-10-20 — the x0x transport investigation: real authenticated delivery observed; the restart seam named

Founder bar (after #480): "independent hosts using real x0x
authenticated peer transport, with attributable delivery evidence
through partition, peer failure, and autonomous recovery." This wake
investigated the real thing — because x0x v0.48.1 turned out to be
PUBLIC with Windows/Linux builds — and shipped live evidence, honest
fault findings, and the named blockers. No promotion claims.

## What ran (real, not mocked)

Two real `x0xd` v0.48.1 daemons (sha256-verified public release; GPG
sig not verifiable in this environment — named) with separate data
dirs, API ports and Bearer tokens, distinct ML-DSA agent identities,
on the real gossip plane. Full evidence file:
`docs/rails/x0x-transport-evidence-2026-10-20.md`.

## Observed live

- **Attributable, byte-exact delivery PROVEN once, cleanly**: announce
  → discovery over the real mesh → `send-file` with a transfer receipt
  attributing the bytes to the sender's agent id → accepted →
  `bytes_transferred: 507` → received file sha256-IDENTICAL to the
  sealed fixture artifact. Real identities, real QUIC mesh, real
  attribution — the capability the founder said to investigate exists
  and works.
- **Pending transfers are volatile across a receiver restart** — the
  unaccepted offer queue does not survive; recovery means sender
  re-send.
- **The restart-path rough edge, named**: after node restarts,
  re-delivery fails at the offer stage (`peer did not accept the file
  control frame`, HTTP 500), reproduced twice including with the
  receiver's watcher live. Recorded for the x0x lane/upstream — not
  patched around, not hidden. It bounds today's autonomous-recovery
  claim honestly.
- `connect <location-words>` resolves to public-side addresses;
  loopback labs must rendezvous via announce/agents-list.

## Blockers to the full bar (named)

1. **Multi-host**: the estate box SSH timed out three times today; no
   second administered host exists for this seat. The lab is two real
   nodes on one host — labeled everywhere it is cited.
2. The x0x restart-path offer rejection (above) — an upstream seam.
3. Autonomous recovery remains unproven (observed recovery requires
   sender action).

## What changed in-tree

- `crates/btungsten-sovereign-rails/src/lib.rs` x0x module: STATUS now
  records the live observation; MISSING narrowed to multi-host + the
  restart seam (evidence file cited). All existing tests green; fmt
  clean.
- `docs/rails/x0x-transport-evidence-2026-10-20.md` — the evidence
  file itself (setup, receipts, fault findings, blockers).
- `rail-manifest.json` UNCHANGED — x0x stays declared/unqualified for
  corpus delivery; this is evidence, not promotion.

NEXT OWNER: the x0x lane/upstream for the restart-path offer rejection;
multi-host repetition the moment a second administered host exists
(the box's SSH is the gate); then the partition/failure/recovery
qualification the bar demands, on real hosts.
