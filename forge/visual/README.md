# forge/visual — the sight side of the creation forge (BF-2)

**Ruling:** BF-2 (LEAD, 2026-08-21) — **platform Canvas/SVG only, zero third-party render
dependencies.** Any future shader or Rust/WASM dep gets raw-read + pinned before boarding.

## The starters (launch-pads, not rails — SPEC-BUZZFORGE-1 §4)

| starter | dialect | composition (seed → …) |
|---|---|---|
| `starters/hexfield.html` | Canvas 2D | axial hex lattice; per-cell hue/sat/light, ring-gate, radius pulse; symmetry mirrors the west half east |
| `starters/orbit-svg.html` | SVG | rose curves r = R·cos(kθ); per-ring petal drift, twist, layered hsla |

Both follow the organ's law (**the seed is the score**): any string seeds the piece via
FNV-1a → mulberry32; same seed, same art, forever; `?seed=` (+ params) in the URL; 🎲 rolls;
🔗 copies the seed-link — the fork is a link, the parent stays untouched (DB-5 lineage).

Each file is one self-contained piece: a marked **CORE** block (the composition — pure,
deterministic, DOM-free, JSON-able art data) and a thin **brush** below it. Artists open
the file, edit the CORE, keep or revert — the in-file Tinker note teaches the first loop.
⚙ scaffolded by an AI seat; forged art belongs to the artist.

## Tests (the receipt rail)

```bash
node forge/visual/test/core.test.mjs
```

Extracts each CORE, then asserts: purity (no DOM tokens), hash/PRNG determinism,
same-seed→identical-art, **fork law** (different seeds → different art), param
sensitivity, and JSON round-trip (inscription shape — what a seed+renderer would
carry on-chain, DB-1 class).

## Queue

Visual starters are forward-queue item 2. Next multiplayer lap wires the shared doc
(seeding `forge/MULTIPLAYER-SEAM.md` first). Publish/inscribe path (AR pin, on-chain
seed+renderer) rides MEDIA-1 / DB-1 as specced.
