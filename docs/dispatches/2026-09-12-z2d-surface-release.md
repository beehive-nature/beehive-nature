# z2.d — SKAITS companion surfaces release receipt

Order: `docs/dispatches/2026-09-12-z2d-surface-release-orders.md`. Release
authorized 2026-09-12; executed same day by the zCode seat as z2.d.

## Outcome

**Integrated main SHA: `622a2c5c`** (local merge, founder author `loVis waTer
<loviswater44@gmail.com>`, z2.d committer `<zcode@skaists.dev>`, parsed
`Co-authored-by` trailers for Codex (Astra) and z2.d — never the API merge
button, no force). Parent range: `0aede743..622a2c5c` pushed as a fast-forward.

Live and verified at skaists.dev (GitHub Pages build ✓ on `622a2c5c`):

| surface | URL | byte-pin |
|---|---|---|
| PLUR three views | https://skaists.dev/surfaces/plur.html | sha256 f861e755…7357 MATCH |
| SKAISTS watch room | https://skaists.dev/surfaces/watch.html | sha256 a2334ca3…c06c MATCH |
| SKAISTS mUsiC (new) | https://skaists.dev/surfaces/jams.html | sha256 9edbb227…fd54 MATCH |
| Blanguage dock | https://skaists.dev/surfaces/blanguage.html | sha256 a09ab4e0…599f MATCH |

Supporting assets byte-matched the same pin: `surfaces/lang-corpus.json`,
`surfaces/manifest-reader.js`, `surfaces/store-reader.js`,
`fixtures/connect-store-manifest-envelope-v1.json`.

Hosted checks on the integrated SHA: **tests ✓ · secret-scan ✓ ·
pages-build-deployment ✓**. This descendant also healed main's inherited red
(the §7 founder-author violation introduced by PR #61's API-button merge at
`0aede743`); the healing range carries only founder-authored commits.

## Carried (PR #42 head `8e811768`, reviewed source `8abcf948`)

- `surfaces/plur.html` — three authored experiences: New bee welcome + first
  action; Raver PLUR/music + multilingual participation; Cypherpunk privacy
  map with source references (`ask()`, `renderHive()`, rails-badge, live-door)
  and named evidence limits. External-AI disclosure preserved everywhere.
- `surfaces/watch.html` — three-view privacy repair: no-referrer policies,
  designed empty state, opt-in chat (`/join/` only after the reader opens it),
  gauges honest ("Not quoted"), sample manifest labelled shape-checked.
- `surfaces/jams.html` — NEW surface, registration ritual complete in the
  release (estate.json row id `jams` family `plur` org `skaists` home
  `plur.earth` LIVE; atlas regenerated 94 counted / 103 listed; review deck
  entry). SKAISTS branding; JAMS.community and W@tch credited as independent
  projects, links `target=_blank rel="noopener noreferrer"`, no affiliation
  implied; payment honestly disabled, Trezor downstream, local-only join.
- `surfaces/blanguage.html` register experiences; shared `lang.js` (file:// +
  bundle loader), `tour.js`, `review.html`; read-only browser readers
  `manifest-reader.js` / `store-reader.js` (validators only — no write, no
  payment, no raw x0x transport; proven by the browser suites: no POST, no
  `/ws`); sample envelope fixture; `scripts/build-watch-languages.mjs`;
  e2e batteries `plur-views.mjs` (extended, below), `zcode-jams-check.mjs`
  (17/17), `zcode-jams-store-reader-check.mjs` (9/9),
  `zcode-watch-manifest-check.mjs` (29/29), `lang-coverage.test.mjs` union;
  CI block wired; dispatches of the lane.

## Omitted (payment lane stays separate — by order)

- `tools/connect-store/adapters.mjs` `X0xCheckpointReceiver` additions, its
  tests, README changes, and new `manifest.mjs` — **byte-restored to main's
  state** (zero diff vs `origin/main`).
- `docs/dispatches/2026-09-11-connect-store-manifest.md` and
  `2026-09-11-connect-store-x0x-receiver.md` — payment dispatches, not treated
  as executable deployment orders.
- No shipped code consumes the receiver: jams/watch read only the committed
  fixture envelope. The connect-store lane lands its own stack when its
  canary criteria (funded store, second x0x participant, writer fencing,
  client pins) are met.

## Conflict decisions

- `surfaces/lang-corpus.json` (the one textual conflict): clean 3-way JSON
  union — base `8d42da28` (995 keys) + main's people-journey 56 `dir.*/prof.*`
  keys + the PR's 50 keys = 1101; `_meta.drafted` histories concatenated; no
  side's translation discarded.
- Newer main preserved: Bloom #61 (`0aede743`) merged into the candidate
  cleanly before release (304/304 tests including its suites).
- `wl.lede` `{"en":""}` — pre-existing empty-orphan corpus key on main, rounds
  under the gate's 1-cell slack; untouched, out of scope, recorded here.

## Blockers cured

1. **Translation CI failure (estate-source)**: the 18 `plur.*` rows shipped at
   en/lv/ru/uk/th only. Completed to **all 28 docked non-English tongues** —
   600 cells (18×24 existing-key fills + 6 new keys ×28), all ⚙ machine-drafted
   per the corpus law; `_meta.drafted` records the pass; **attestation
   explicitly pending** (gd/tt/sa named first for native review). No cell
   filled with English while claiming translation; existing lv/ru/uk/th drafts
   preserved. English cells match the pages byte-true (stale-translation
   check green). New keys: `plur.hearPair · hearPairNote · voiceNone ·
   voiceReady · voicePick · voiceMatch`.
2. **Product correction (founder)**: the top `shalom · salām` control is now
   an **optional pronunciation example beside the peace words** — inside the
   f-peace field (e2e asserts it is not in the page header), labelled "Hear
   the Hebrew and Arabic greetings", captioned with exactly what it does
   (plays the two greetings in turn, only on press, only if a Hebrew or
   Arabic voice exists; nothing plays automatically). **Honestly disabled**
   when neither voice exists, with a plain status line through the corpus.
   Per-word listening (per-card no-voice labels) and the shared language
   selection stay prominent; keyboard access proven (focus+Enter in e2e);
   reduced-motion untouched; **no autoplay anywhere**. The unsupported
   "Shalom and salām are the same word" claim corrected to cognate greetings
   from the same Semitic root S‑L‑M.
3. **blanguage.html floor**: the PR's register-gating dropped visible keyed
   strings to 11 (floor 12, `i18n-coverage --floors` red); the bee dock-start
   gained the keyed `plur.conversation` link — floors PASS, no expectation
   weakened.

## Verification record

Local (worktree `wt-z2d-surface-release`, branch `codex/z2d-surface-release`,
candidate commits `9ac420ef` → `dcf7ebdb` → `883e9829` → shots):

- `node --test` full CI list: **304/304** (26 files, incl. Bloom suites)
- `estate-source`: **11/11** · `estate-check`: **94/103/26, hub in sync**
- `i18n-coverage --set … --floors`: **PASS** · `university-smoke`: **87/87**
- Browser: plur-views **PASS** (extended with the correction proofs — fake
  speech engine installed via `defineProperty` because `window.speechSynthesis`
  is a getter-only native accessor whose plain assignment is silently ignored;
  proves placement, label, honest disable, zero autoplay, keyboard-driven
  `['שלום','سلام']` sequence, lv label translation) · jams **17/17** ·
  store-reader **9/9** · watch-manifest **29/29**
- 23 evidence shots in `e2e/shots-z2d-surface-release/`: three views ×
  {plur, watch, blanguage} × {390px, desktop}, jams both sizes, Arabic RTL
  (documentElement dir=rtl asserted), Latvian switching — zero page errors.
  (Judged programmatically; shots committed as evidence per the read-on-image
  law.)
- Tests never sent conversation text to any external provider: every external
  request intercepted/aborted or 401-mocked; the live exercise below never
  touched the tutor send, chat open, join, or any payment control.

Hosted (PR #64 checks, all green): node · static · test · scan.

Live (read-only exercise against the released pin): plur three-view switching,
Latvian rendering from the served corpus, Arabic RTL, pronunciation example
present + honestly disabled with the plain status; watch title + stream-state
language + shape-checked disclosure (`textContent`, inside a collapsed
section — an `innerText` probe first misread this as missing); jams manifest
verified from the served fixture, h1 identity, payment disabled, Trezor
downstream, four encrypted references; zero page errors.

## Deployment path

Normal path, per order: candidate branch → PR #64 → green hosted checks →
**local** merge (`z2d-integration` off `origin/main`, §7 T3 shape) →
fast-forward push `0aede743..622a2c5c` → CI green on main → Pages build
completed → byte-pin + live-control verification above. No wallet, Trezor,
signatures, payment, Autonomi writes, APK installation, relay restart,
profile reset, or public-mesh load occurred at any point.

## Remaining limitations (explicitly not live)

- The 600 new translation cells are machine drafts; **no human attestation
  claimed** — gd/tt/sa flagged first for native review.
- The AI tutor remains **unavailable when its direct request fails** (no
  credentials configured, none added); no working service is implied.
- Voice availability depends on the visitor's browser; the page labels it.
- Watch's backend access finding (segment branch serving without receipt
  check) remains **open for backend follow-up** — this release changed
  presentation only, no box code.
- The connect-store receiver/payment stack is **not deployed** (see Omitted).
- Backlog (not scope): selected-language pronunciation, community-attested
  language contributions, caption access, clearer media-room entry points.

## Rollback

A normal `git revert -m 1 622a2c5c` on main (plus re-running
`node scripts/build-atlas.mjs` if the estate row is also reverted) restores
pre-release main `0aede743` while preserving any later work; no force, no
history rewrite. The Pages deployment follows the reverted commit.
