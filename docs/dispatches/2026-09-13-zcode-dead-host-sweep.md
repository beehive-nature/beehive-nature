# zCode — dead-host sweep (the seven sites) — 2026-09-13

Assignment: #10 c5649760460 — remove only the dead host from all seven
browser-side sites, preserve every selection semantic, crate in-tree, no
box rebuild/deploy/production mutation, one focused PR with exact head,
8/8 CI and changed-file manifest before merge. Branch
`zcode/dead-host-sweep-2026-09-13` off main `f65bb609`.

## The subtraction (remove-only, survivor order preserved, no reordering)

| site | before | after |
|------|--------|-------|
| `surfaces/bmeshasi.html:332` | dead, eosnation, greymass | eosnation, greymass |
| `surfaces/wallet.html:1522` | eosnation, greymass, dead | eosnation, greymass |
| `surfaces/wallet-adapter-vaulta.js:27` | eosnation, greymass, dead | eosnation, greymass |
| `surfaces/bantfarm.html:462` | greymass, dead, eosnation | greymass, eosnation |
| `surfaces/blight/workbench.html:302` | greymass, dead, eosnation | greymass, eosnation |
| `surfaces/blight/vaulta-reader.html:106` | greymass, dead, eosnation | greymass, eosnation |
| `crates/bmesh-serve/assets/page.html:181` | dead, eosnation, greymass | eosnation, greymass |

Plus bantfarm's now-stale "proven three-host failover" comment corrected
to the two-host truth. **Rust test-fixture labels untouched** per the
order — the CI gate gives them a verified non-runtime treatment instead.

## workbench.tmp — handled explicitly

Inspected: `surfaces/workbench.tmp` is a TRACKED, unreferenced (zero
references tree-wide), near-copy of `surfaces/blight/workbench.html`
(2-line drift, 67,967 vs 67,965 bytes). Not in estate.json, not runtime
scope. Ruling inside this sweep: the dead literal is SUBTRACTED from it
(same one-line shape as workbench.html) so no tracked file carries the
dead endpoint; the file itself is NOT deleted — deletion stays a
separate housekeeping ruling for Astra.

## Guards added

- `e2e/no-dead-host.test.mjs` (CI-wired into the front-door line, 11/11):
  (1) zero `api.eosn.io` in every .html/.js/.tmp under surfaces/ and the
  crate assets — **empty allowlist**; (2) Rust literal allowed only
  INSIDE a `#[cfg(test)]` region, proven structurally by line scan;
  (3) per-site structural assertions — each of the eight arrays is
  exactly its two confirmed hosts in survivor order; (4) semantics
  survive structurally: fixed-order failover walk, wallet
  probe-and-cache, adapter Fisher-Yates shuffle, vaulta-reader
  round-robin modulo.
- `e2e/no-dead-host-emission.mjs` (seat-side, committed): the bounded
  localhost emission rig — the inventory's method, now reproducible.

## Re-proof (this run, from the healed tree)

- Emission: **zero dead-host requests on every page**, live hosts
  answering 2xx — bmeshasi 1 (eosnation), wallet probe 1 (eosnation),
  bantfarm 5 (both hosts), vaulta-reader 2 (both), crate page 2
  (eosnation); workbench 0 by design (on-demand path). Six pages × 10s.
- Wallet-adapter contract battery: **28/28** (shuffle, walk-on-failure,
  sign path, JWK wall — against mocked rails).
- estate-source 11/11 · bnames-rpc regression 3/3 (the #67 gate still
  green).

## Rig limitation (reported separately per order)

The crate page is served statically in the emission rig, so its
crate-served `/api/tick` is absent (404); a pageerror observed in the
inventory run traced to that missing API, not to the host list. The
production crate serves `/api/tick` alongside this asset. No box
rebuild/redeploy was performed or needed for this change — the crate
edit lands in-tree and rides the next natural deploy.

## Changed-file manifest (this PR)

M `surfaces/bmeshasi.html` · M `surfaces/wallet.html` · M
`surfaces/wallet-adapter-vaulta.js` · M `surfaces/bantfarm.html` · M
`surfaces/blight/workbench.html` · M `surfaces/blight/vaulta-reader.html`
· M `crates/bmesh-serve/assets/page.html` · M `surfaces/workbench.tmp`
· M `.github/workflows/tests.yml` (gate wiring) · A
`e2e/no-dead-host.test.mjs` · A `e2e/no-dead-host-emission.mjs` · A this
dispatch. Nothing else; no Rust source, no corpus, no box.
