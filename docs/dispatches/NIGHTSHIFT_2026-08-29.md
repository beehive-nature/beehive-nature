# NIGHTSHIFT 2026-08-29 — zCode running the founder's ordered list

**Boundary honored:** z1.1 owns bClaude auth, Lane M P3, and the luni text-record
treasure read — none touched.

---

## Item 1 — LEVEL-TRUTH UNIFICATION · DONE `2b95d47`

**Read-back:** `LANE_MARKET_TRUTH_2026-08-28.md` closed with market.html's own
`lvlOf`/ladder-table/`pips` inline; museum.html (landed later, `76dc1dc`) built its
Royal Collection plinths independently — no dots, no level number, no o/u label,
just a raw seed. Two surfaces, two copies of the same arithmetic, exactly the drift
this task was ordered to prevent before it could start.

**What landed:** `surfaces/level-truth.js` — one shared module (`HOSTS`,
`COLLECTIONS` table with a `driver` field cited per collection, `rpc`,
`decodeString`, `lvlOf`, `pipmax`, `pips`). Both `surfaces/blight/market.html` and
`surfaces/museum.html` load it (`<script src="level-truth.js?v=1">` /
`../level-truth.js?v=1`) and call the shared functions instead of carrying their
own copies.

- **Driver cited per surface:** market's cards render `getSvg(LISTING)` — the
  buyer's take, not the seller's balance (per the closed lane's BUYER TRUTH rule).
  Museum's Royal Collection plinths render `getSvg(balanceOf(GARDEN))` — the
  founder's own holdings, no listing concept, so no buyer/seller split — and now
  say so explicitly in the pmeta line.
- **Seed labeled as seed** on both (unchanged on market, added on museum's pmeta).
- **o/u disagreement labeled honestly on both:** FUNGI, $FROGGI, PEPI v1 carry the
  same "chain art may not agree exactly with the ladder tier this seed implies
  (law 4)" note on the museum plinth that market already carried on its card.

**Two bugs caught fixing this, both pre-existing, both now fixed in the shared
module (so both surfaces inherit the fix):**
1. `surfaces/blight/market.html`'s inline `<script>` carried a stray extra quote
   (`...exact</span></div>''+`) — two adjacent string literals with no operator,
   a `SyntaxError` that would abort the whole script. Verified with
   `node -e "new Function(...)"` before and after; script now parses clean.
2. `pipmax` computed `lv.length-1-col.base`, but `base` already cancels out
   inside `lvlOf` (`l` starts at `base`, the function returns `l-base`) — so for
   PEPI's `base:1` collections the dots silently capped one level early. Market
   never showed the raw number next to the cap so it went unnoticed; museum's new
   "level N of M" line exposed it immediately as "level 5 of 4." Fixed `pipmax`
   to `lv.length-1` (matches `lvlOf`'s actual range); live-verified PEPI now
   reads "level 5 of 5" on both surfaces.

**Gates:** `node e2e/design-acceptance.mjs surfaces/blight/market.html
surfaces/museum.html` → 28/28 (14/14 × 2 surfaces; `level-truth.js` added to the
rider allowlist in `e2e/design-acceptance.mjs`). `node e2e/estate-source.mjs` →
11/11. CI on push `2b95d47`: `secret-scan` 33224642001 success ·
`tests` 33224641998 success · `pages-build-deployment` 33224641584 success.

**Live-verified (receipt = the URL):**
- https://skaists.dev/surfaces/blight/market.html — zero console errors, dots
  match listing amounts, PEPI shows 5 slots not 4.
- https://skaists.dev/surfaces/museum.html — zero *new* console errors (the
  base.org CORS block on `cardImage.svg` is MUSEUM LAW's own designed
  degrade-to-archive path, pre-existing, confirmed graceful: nameplate reads
  "ARCHIVED — live read failed, archive is the floor"); Royal Collection plinths
  show dots + "level N of M" + o/u label, PEPI v2/v1 both read "level 5 of 5."

Local pre-push verification used a throwaway static server on `localhost:8934`
(node http, no deps) plus the Browser pane; nothing added to the repo for it.

---

## Item 2 — .b DOCKET STATE CHECK + FINISH

Status: starting next.
