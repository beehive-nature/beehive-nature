# The orbit-manifest Arweave anchor — Rail 2 ceremony, ready state

Founder order 2026-08-25: "Anchor the founder's orbit manifests to Arweave.
Rail 2 has been open since July." This file is the ceremony's READY STATE —
everything except the one thing this box physically lacks: a funded JWK.

## The payload (committed-blob law — git show, never a worktree copy)

| item | bytes | sha256 |
|---|---|---|
| surfaces/forge/orbit-manifests.md @ main | 1,926 | `865f86caf55fab14be36746b4b5465025b04fae478072b09e13fcdbca3b7c406` <!-- PUBLIC-CONSTANT: orbit-manifests.md committed-blob sha256 --> |
| surfaces/forge/orbit.html @ main (the frozen renderer the manifest pins) | 8,644 | `6e54b80deff87861e4ad0134799cbd8a28492ed9e851b26bdfd597f4258a6b29` <!-- PUBLIC-CONSTANT: frozen orbit.html renderer committed-blob sha256 --> |

Anchoring the MANIFEST alone suffices — it carries the renderer's hash; the
renderer itself is CI-frozen by e2e/forge-freeze.mjs. Mirror both if the
founder wants the bytes themselves permanent, not just their attestation.

## The tx, pre-shaped (tags follow the house self-describing pattern)

- Content-Type: `text/markdown`
- App-Name: `Beehive-Nature`
- Type: `orbit-manifest-anchor`
- Manifest-SHA256: the payload hash above
- Renderer-SHA256: the frozen renderer hash above
- Renderer-Commit: `c3e49979a7429b49ab623e3347b8c94e36791780`
- Rail: `2`

## The gate, stated plainly

NO funded JWK exists on this box (searched); wallet-relay signs nothing by
its own law (user-signed DataItems, never holds keys); third-party bundlers
are ruled out by the estate's own RAID (Irys = LEAVE; the funded path "must
be solved in-house"). An Arweave data tx of 1,926 B costs well under 0.01 AR
at current fee floors — the ceremony needs one founder-held or
founder-funded JWK. That is what has held Rail 2 open since July: not
process, physics.

## Completion, one signature away

With a funded JWK at `<path>`: post the manifest bytes with the tags above
via the estate's own rails (adapter-arweave ANS-104 shape, direct post —
no bundler), record the tx id BELOW, and Rail 2 closes with the freeze
already proving which bytes were attested.

| anchored tx id | (pending — the funded key) |
|---|---|
