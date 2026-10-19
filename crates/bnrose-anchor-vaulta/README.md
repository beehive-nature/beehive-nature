# bnrose-anchor-vaulta: the Vaulta carrier for bnrose-evolve anchors

bnrose-evolve's journal is an unkeyed SHA3 chain. A writer with store access
can rewrite it and recompute every link consistently, and a plain
`Controller::open` accepts that. An anchor of the head held where that writer
cannot reach convicts it. The anchor has three parts:

| part | where | what |
|---|---|---|
| statement + check | `bnrose-evolve::anchor` (socket-free) | `AnchorStatement` = (subject, journal head, latest PROMOTE `Decision::statement()` digest, policy digest); `Controller::open_anchored` refuses a journal shorter than the anchor or whose anchored prefix is not the anchored one, before recovery writes anything |
| carrier contract | `contracts/evanchor/evanchor.cpp` | one row per subject: the latest statement; the first anchor binds its publisher; count strictly grows; the statement's own subject and count must be the action's; the publisher pays the RAM |
| this crate | reads + unsigned action | `latest()` reads the row from every endpoint given, pins the chain id (Jungle4 by default), and returns `Unreachable` on any doubt (transport, wrong chain, split answers, a row that does not decode); `anchor_action()` builds the UNSIGNED `anchor` action |

## What this crate does not do

It holds no key, asks for none, signs nothing, and pushes nothing. The
`anchor` action it builds is signed and pushed in the estate's signer lanes.
Its authority test enforces that its dependencies are exactly
`{bnrose-evolve, serde_json, ureq}` and that no source names a signing key,
a push or a wallet.

The command face `bnrose-anchor-vaulta action …` prints the next anchor action
only after the same anchored open accepted the journal: a refused journal is
never re-anchored.

## Receipts

- `cargo test -p bnrose-anchor-vaulta`: the carrier offline (chain check,
  row parsing, endpoint agreement, the unsigned action, authority).
- `scripts/bnrose-evolve/anchor-vaulta-teeth.sh`: each carrier guard
  disabled in turn must turn its test red.
- `docs/receipts/bnrose-evolve/anchor-vaulta-live-read.txt`: the opt-in
  live read (`--ignored live_jungle4_read`) against Jungle4 on two endpoints
  and a Vaulta mainnet endpoint. Reads only.
- `docs/receipts/bnrose-evolve/evanchor-build-local.txt`: the contract built
  with CDT 4.1.1, wasm and abi digests.

## Named, not claimed

- The contract is **not deployed**. Until a signer lane deploys it and
  publishes the first anchor, every live read fails closed (receipt above).
- An anchor covers the anchored prefix only. Records written after the
  latest anchor are as strong as the unkeyed chain until the next anchor.
- A compromised publisher key can advance the anchor to a forged head. The
  anchored open then refuses the honest journal (loud), it never accepts a
  rewrite. The publisher key is the signer lane's to protect.
- Persistence law for whoever pushes (WB004 handoff §2): the action is a
  pure function of the statement, so a rebroadcast of the identical signed
  bytes is the only legitimate retry, and an unresolved push is UNKNOWN.
- Autonomi persistence of the statement bytes is not built:
  `adapter-autonomi` is node telemetry, not a storage client.
