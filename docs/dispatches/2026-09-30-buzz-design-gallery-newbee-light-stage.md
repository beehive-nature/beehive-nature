# Gallery New bee light stage (music.html gold)

## Bug
Live New bee gallery was MIXED: cream chrome from skaists tokens, but the art stage and collection mats stayed near-black. ETERNAL E4 mapped every register's stage onto `--sk-bg-well`, then immediately overrode New bee to `--sk-ink` (`#0c1412`). Reference gold `surfaces/music.html` is fully light in New bee (`--void:#fbf7f0` / cream room).

## Fix
Removed the New bee `--sk-ink` stage override in `surfaces/blight/gallery.html`. New bee now keeps `--sk-bg-well` (`#efe9dd`). Raver and Cypherpunk still get a dark well from their register tokens. SVG artwork bytes, RPC reads, tour/register, and the three-temp layout are unchanged.

## Proof
- `e2e/blight-gallery-eternal.test.mjs` asserts New bee `#stage` and `.art-mat` compute to `rgb(239, 233, 221)` while `--sk-ink` remains `#0c1412`.
- Mutation: restoring the `--sk-ink` override fails that assertion.

## Out of scope
beehive #264 (Meld / add-money) and other ready clicks — not this lane.
