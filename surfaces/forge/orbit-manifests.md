# orbit manifests — the founder's two frozen renders

Dictated by the founder 2026-08-24. The renderer is FROZEN (see
e2e/forge-freeze.mjs — its committed-blob sha256 is pinned and CI fails on
any edit; tinkering forks to surfaces/forge/orbit-v2.html).

## Manifest A

```
renderer: sha256:6e54b80deff87861e4ad0134799cbd8a28492ed9e851b26bdfd597f4258a6b29 <!-- PUBLIC-CONSTANT: frozen orbit.html renderer committed-blob sha256 -->
renderer_path: surfaces/forge/orbit.html
renderer_commit: c3e49979a7429b49ab623e3347b8c94e36791780
params A: seed=2000 k=8 rings=7 twist=-10 hueBase=283
```

## Manifest B

```
renderer: sha256:6e54b80deff87861e4ad0134799cbd8a28492ed9e851b26bdfd597f4258a6b29 <!-- PUBLIC-CONSTANT: frozen orbit.html renderer committed-blob sha256 -->
renderer_path: surfaces/forge/orbit.html
renderer_commit: c3e49979a7429b49ab623e3347b8c94e36791780
params B: seed=2000 k=8 rings=7 twist=80  hueBase=250
```

Provenance: the sha256 is of the COMMITTED blob (git show, never a
worktree copy — the fleet-preservation law), 8,644 bytes, asserted by CI
on every push. renderer_commit is the last commit to touch the file —
the exact tree the bytes were pinned from. Reproduce either render by
opening the frozen renderer with the params above.

## Arweave mirror (owed — the July Rail 2 ceremony item)

Bytes to mirror, in one tx payload or two: the frozen renderer
(`git show c3e4997:surfaces/forge/orbit.html`, sha256 above) and this
manifest file. Rail, per the estate's own RAID verdicts: NATIVE JWK +
direct post — no third-party bundlers (Irys/bundlers = LEAVE; the funded
path "must be solved in-house", RAID_WALLET_PAYMENT_PIPELINE). GATE:
a funded JWK (AR) — none exists on the dev box tonight, so this section
is the ceremony's ready state, not a completed mirror. When the key
arrives: post, record the tx id here, and the mirror closes with the
freeze already proving which bytes were sent.
