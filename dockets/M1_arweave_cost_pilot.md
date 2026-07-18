# DOCKET M-1 — Arweave cost pilot + full-sweep sizing

**Status:** MEASUREMENT ONLY — no spend, no write. 2026-07-17.
**Authority:** founder ruling "decentralized MVP first" (Drive, 2026-07-17) → M-1.
**Unit of record:** AR (fetched live from `arweave.net/price/{bytes}`). USD figures are a
decorative CoinGecko snapshot (**$1.92/AR, 2026-07-17**) and will age — AR is the fact.
**Boundary:** the funded write is key-holder-only; the numbers below are measured, the
spend is not committed here.

---

## 1. The pricing shape — a 256 KiB chunk floor

Arweave bills in **256 KiB (262,144 B) chunks**, verified live: every size from 1 B to
262,144 B returns the identical price. So the honest cost is two regimes, not one
"cost-per-MB":

- **≤ 256 KiB → flat floor: 0.00274974 AR per transaction** (≈ $0.0053).
- **> 256 KiB → ~0.0109 AR/MiB marginal**, rounded up to whole chunks.

A naive "cost-per-MB" would misprice every small surface by up to ~19×. The floor, not
the per-MB rate, governs at MVP scale.

## 2. Full-sweep sizing (reachable published surfaces, as they stand)

Render-critical bytes only (what a visitor fetches; dev/tooling files excluded):

| surface | repo | bytes | files | chunks | bundled cost |
|---|---|---:|---:|---:|---:|
| styleguide | beehive-biomass/bnr-design | 13,607 | 2 | 1 | **0.00274974 AR** |
| Explorer | skaists/sovereignty-explorer | 539,861 | 19 | 3 | **0.00818269 AR** |
| **whole sweep (one bundle)** | — | **553,468** | **21** | **3** | **0.00818269 AR** |

The styleguide's 13.6 KB rides **free** in the headroom of the Explorer's third chunk:
one bundle of both costs the same as the Explorer alone.

**Optional brand assets** (bnr-design mandala set — not part of any surface's render):
`beehivebiomass-logo.svg` + the three `mandala-*.svg` = 52,515 B / 4 files. Adding them
keeps the bundle at 3 chunks (605,983 B < 786,432) — still **0.00818269 AR**.

**Not measured — not published:** the Commons / BioMass / Nature concept surfaces and the
D-11 quest skin are not reachable repos yet. They are unsized here by construction, not
by omission; they get measured when they land as surfaces.

## 3. The delta that decides the mechanism: bundle, don't per-file

| approach | cost | note |
|---|---:|---|
| 21 separate base-layer txs | **0.05774455 AR** ($0.111) | each file < 256 KiB pays the full floor |
| one ANS-104 data bundle | **0.00818269 AR** ($0.016) | priced by total bytes; no per-file floor |

**Bundling is 7.1× cheaper**, and the gap widens with file count (the Explorer's 12 woff2
subsets alone would be 12 floors as separate txs). Turbo / ArDrive (the ruled tooling)
bundle via ANS-104 natively — so the cheap path *is* the ruled path. **Publish each
surface, or the whole sweep, as one bundle.**

## 4. Retrieval model + reproducible anchor

The Arweave txid (the "release hash") exists only after a funded, signed write, so it is
not in this docket. What is verifiable now is the payload's content digest — recompute it
against the release before trusting a mirror:

- styleguide `sha256(index.html ‖ tokens.css)` =
  `7e13f9da86c2ec733bc8b4f199cc9cb5f0147290031943eb9ad3b314297ad4c1` <!-- PUBLIC-CONSTANT: styleguide payload content digest, not key material -->

Post-publish retrieval: `https://arweave.net/<txid>`, with an Arweave path manifest so
`index.html`'s `<link href="tokens.css">` resolves under one base. The txid becomes the
release; GitHub Pages demotes to a mirror (ruling §5).

## 5. Rulings recorded

- **§1 merge:** C-6 (`adapter-lti` spec + red skeleton) merged to `main` at `985829c`;
  CI green (test + scan). Done.
- **§4 mechanism:** AR writes via off-kernel key-holder tooling (arweave-js / Turbo /
  ArDrive). `adapter-arweave` stays as-is — it anchors event-bundle Merkle roots
  (`upload_bundle(EventBundle)`), which is a different job from publishing static files;
  no `publish_data` in-tree unless it becomes recurring.
- **§5 doctrine:** GitHub Pages = rehearsal (L0/L1, free, fix-forward works). Arweave =
  **wall-cleared releases only** — because there is no unpublish, the health-claim wall
  (k001) is a hard pre-publication gate per surface. The styleguide is wall-clear (design
  tokens, zero claims); the Explorer and future concept surfaces are not auto-clear.
- **§6 staging:** waits on these numbers + per-surface wall-audits + the founder's tool
  pick. The funded write remains key-holder-only.

---

*One line to carry: the entire decentralized MVP is a ~1.6-cent, 3-chunk, one-bundle
write — the cost was never the constraint; the wall-audit and the key are.*
