# hexart — the hive's own pixels (2026-09-16)

Founder order: a BeehiveNature.buzz generative-art surface inspired by
PixelLab's useful capability surface, never its implementation — **default
visual primitive = hexagonal/honeycomb pixel blocks**, polygons beside,
squares as guests. One feature of the estate, not a SaaS.

## What shipped

**`surfaces/hexart.html`** — one self-contained file, zero outbound requests
(the SWEEP law; battery-verified), client-side everything:

- **text→art** — the `comb-field` engine: seeded value-noise field (3 octaves)
  quantized onto the cells with a 4×4 ordered comb dither; the prompt's hash
  bends the field's phase; transparent cells below the open threshold.
- **image→hex-art** — `image-conv` engine: per-cell palette-nearest
  quantization of a loaded image; **palette-from-image** distills dyes by
  deterministic farthest-point selection.
- **palette/style control** — six presets (honeycomb default, estate tokens,
  ember, verdant, wax mono) + a custom editor (per-swatch color inputs);
  medium selector (hex-pointy default, hex-flat, tri, square-guest).
- **transparent output** — alpha cells render/export as true transparency;
  PNG and WebP export at 16px cell scale.
- **edit/inpaint** — paint/erase/pick tools on the cell grid (pointer,
  capture, topology hit-test); **edits ride the recipe as an overlay** so
  reproduction includes the hand.
- **deterministic seed/reproduction** — same seed+params → same cells
  (battery: regenerate identical, prompt changes field, empty prompt
  returns, **recipe round-trip regrows identical cells**, edits in recipe).
- **engines as replaceable adapters** — `window.HexArtEngines` contract
  `{generate(recipe) → cells}`; a future local-model adapter (bMESHLLM rail)
  drops in without touching renderer/editor/recipe/export.
- **future-proof representation** — the piece = {topology, cols, rows,
  cells[], palette[], recipe}: animation = frames of grids; sprites =
  bounds; rotations = axial transforms; tiles/maps = wrap sampling; UI
  assets = export scale. Consumers of the grid, not core rebuilds.

## Registration ritual (all beats, same commit)

- root `estate.json` row (id hexart · family beehivenature · home
  beehivenature.buzz · org beehive-nature · state LIVE) + `surfaces/estate.json`
  row (domain nature · i18n s.hexart) — **the two-registry law**.
- `scripts/build-atlas.mjs` run: counts re-derived (96 counted · 105 listed),
  hub regenerated.
- doors/beehivenature.html: **hand-kept row** (the byte-true ruling — the
  generator does NOT own the doors; running it sprayed `undefined.name`
  across nine doors and was reverted), count 28→29.
- review deck SURFACES array + hexart battery CI-armed.

## Corpus

32 new keys ×29 cells machine-drafted ⚙ (31 UI keys + `s.hexart.name` for
the door row), `_meta.drafted` records the pass. No cell claims attestation.

## Batteries (receipts in this dispatch)

- `e2e/hexart-check.mjs` — **20/20**: zero page errors; hex-pointy default;
  determinism (regen identical · prompt bends · empty-prompt return · recipe
  round-trip identical · edits ride recipe); all four topologies render
  error-free; transparent cells present; PNG blob 340KB; image→cells fills
  1727/1728; palette active; **zero outbound**; 390px no overflow.
- `university-smoke` 87/87 · `estate-check` PASS (96/105/26, orgs 58+33+5,
  hub in sync) · `estate-source` 10 PASS + the byte-for-byte hub check that
  by design compares against HEAD (clears at commit) · i18n floors PASS ·
  atlas + lang-coverage suites green.

## Bugs found and fixed en route (banked)

1. **`tri.poly` referenced `r` outside its parameter list** — caught by the
   battery's zero-page-errors tripwire (hex-flat passed, tri/square threw).
2. **JS object keys with hyphens parse as subtraction** — `nl-be:'…'` became
   `nl` minus `be` in the corpus merge script (every line, one error).
3. **Curly-vs-straight apostrophes** between page text and corpus en cells
   read as drift — the corpus is the source of truth; the page was aligned.
4. **Two registries, two roles** (root = atlas/org axis, surfaces/ = doors) —
   a surface registers in BOTH; the doors themselves are HAND-KEPT.

## Honest limits

- The `comb-field` engine is procedural, not a model — prompts bend the
  field deterministically; they do not "draw" semantics. The adapter seam
  exists precisely so a local model can take that seat one day.
- The Bayer dither is 4×4; finer combs are a tuning pass, not an
  architecture change.
- Animation/sprites/rotations/tilesets are NOT built — the representation
  is designed for them and the spec says so on-page; nothing silent.
