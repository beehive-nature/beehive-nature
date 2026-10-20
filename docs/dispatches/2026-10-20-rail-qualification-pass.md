# 2026-10-20 — rail qualification pass: adapters in the reader, live observations, honest rows

Founder milestone (after #477): "actual decentralized rail retrieval
qualification: make Arweave, Autonomi, and especially x0x deliver content
through the existing verified reader, with exact-byte checks,
corruption/refusal tests, and observed availability. Until then, GitHub
remains the only qualified delivery route."

## What was built

- **Pluggable rails in the reader** (`surfaces/blood-seal.js`): a rail
  now says WHERE bytes may come from — never WHAT to trust (the pin
  rules every byte from every rail, so a hostile rail or hostile
  manifest can only affect availability). Three real adapters:
  same-origin static (github), estate-door (Autonomi via
  `relay.skaists.dev/ant/v1/data/public/`, implementing the door's
  OBSERVED response shape `JSON {"data": base64}`), public-gateway
  (Arweave, raw GET, gateway list with named per-gateway refusals).
  `rail-manifest.json` (committed beside the seal, config not content)
  carries endpoints, observed shapes, per-rail statuses and the corpus
  ADDRESS MAPS — empty until an authorized upload fills them; a rail
  participates only when marked qualified AND addressed.
- **Hermetic pluggability control** (e2e gate J, ten gates now): two
  door-shaped rails through the REAL reader's `verifyPerson` — the
  tampered rail is named (`page-drift`) and refused, the clean rail
  verifies; two tampered rails fail closed with every refusal named. No
  rail's bytes render unverified.
- **Qualification driver + receipt**
  (`scripts/rail-qualification.mjs` →
  `assets/profile-archive/lineage/rail-qualification.json`): live
  observations with exact-byte evidence. A rail flips qualified only
  when a row records observed delivery of SEALED CORPUS artifacts.

## Observed this wake (live, exact bytes)

- **github-pages — OBSERVED, exact:** the deployed Pages origin
  (`skaists.dev`) delivered `publication-state.json` (2,405,249 B) and
  `publication-index.json` byte-identical to the committed /2 artifacts
  — the real corpus through the real deployed rail. The one qualified
  rail is now receipted, not presumed.
- **autonomi — ROUTE OBSERVED, corpus absent:** the estate door served
  the public example artifact twice (185,255 B decoded), reads
  byte-identical; the reader's door adapter implements exactly the
  observed shape. NOT qualified for corpus delivery: no corpus content
  on Autonomi — upload is a founder gesture; no spend was taken.
- **arweave — ABSENT, named:** gateway adapter implemented; no corpus
  content on Arweave (upload/spend is a founder gesture). Mechanics
  proven hermetically by gate J.
- **x0x — DEFERRED, named:** x0xd v0.45 is loopback-only gossip with no
  stored history (ops/x0x verbatim; harness-sovereign's x0x.rs collects
  a live SSE window precisely because nothing is stored) — a public
  on-demand read rail is structurally absent, not merely untried. Live
  node observation was attempted via the box and refused (SSH connection
  reset — consistent with the known sealed-SSH tenancy state); nothing
  was forced.

## Honest bottom line

GitHub Pages remains the only qualified delivery route — now with a live
exact-byte receipt. Autonomi's route is real and observed; its corpus
delivery waits on an upload gesture. Arweave waits on content. x0x waits
on structure (a public endpoint or a store), not on effort. No ANT
spend, no .b registration, no IQ.wiki, zero FamilySearch requests; the
studio's content and the frozen lanes untouched.

## Evidence

- e2e `e2e/blood-seal.test.mjs`: 10 gates green (A–F prior, G/H/I #477,
  J pluggable rails).
- `gp check` green (seal untouched — the manifest and receipt are
  deliberately OUTSIDE the sealed nine; the receipt states this itself).
- register.test 16/16; footer-audit 0 worse / 0 better; the three
  generated-artifact checks green (no script-list change → no directory
  rider).

NEXT OWNER: the founder holds the upload gestures (Arweave AR / Autonomi
ANT) that would fill the manifest's address maps; the re-run is
`node scripts/rail-qualification.mjs` followed by a manifest
qualified-flip only on an observed row. A public x0x read shape, if the
founder wants x0x as a read rail, is an x0x-lane question (the harness
transport is not it).
