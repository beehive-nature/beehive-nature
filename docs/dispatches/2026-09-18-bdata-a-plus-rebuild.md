# bData A+ REBUILD — "D+ (buttons don't even work)" answered: every press answers

**Seat:** 3 (Claude Code). **Date:** 2026-09-18 (evening; the founder's press under audit: 2026-09-19T01:15:49Z).
**Branch:** `claude-LoVis/button-fixes-d-to-a-10fc65`. **Surface:** `surfaces/bdata.html` + `surfaces/bdata.js`.
**FOUNDER ACTION SURFACE:** My Data → 🌐 Public → the price, in place. (Authorize stays locked — Phase C's to earn.)

## THE FINDING THAT REFRAMES THE GRADE

The founder's screenshot shows "… asking Autonomi — up to a minute" under a live-looking
"➜ Get the storage price" button. The bridge's own job directory shows that press **worked**:
job `up-1789780618488` was banked 69 s after the 01:15:49Z gesture. The page simply gave **no sign
of life for 69 seconds** — the primary button had been painted and then silently `disabled` by the
auto-ask (no `:disabled` style existed), so it looked pressable and did nothing. The old gate was
30/30 green throughout, because it asserted selectors, not what a person experiences.

## WHAT WAS DEAD OR LYING (audit: 8 read-only agents, ~150 findings; the load-bearing ones)

| # | defect on the old page | class |
|---|---|---|
| 1 | The estate's top-bar **new bee / raver / cypherpunk** buttons did nothing here — bData kept a private 20px `newbee` picker and ignored `bregister` | dead control |
| 2 | The price button arrived **already fired and disabled**, pixel-identical to live; the only feedback was one 11px line | decoy |
| 3 | **Only me / Selected people** were `<button disabled>` — dead clicks, reasons only in `title=` (invisible on touch, unreachable by keyboard, untranslatable) | dead control |
| 4 | **↻ refresh** had no in-flight guard at all (the guard queried a button that no longer existed) — N taps = N concurrent `force_fresh` prepares, last answer wins | double-fire |
| 5 | Any redraw mid-ask (an automation tap) wiped the status and **re-armed** the price button | double-fire |
| 6 | No timeout: a hung quote service left the page waiting forever | dead end |
| 7 | The **language select** re-worded 8 static lines and left the whole JS-drawn page in the old tongue (`T` bound once, no `blang` listener; lang.js was also included twice) | half-dead control |
| 8 | After choosing, **Public silently returned**; with a second tab it was dead *and* looked unchosen (no `storage` listener); there was no way to withdraw the choice short of devtools | dead control |
| 9 | The ask fired even if the gesture **failed to persist**; the request sent the literal `'public'`, not the recorded policy | false signal |
| 10 | "originated in My Data" was claimed from the shared key alone — also after a **wallet** selection | false signal |
| 11 | A cached price of any age read "**current price**"; a failed refresh left it standing under its own error | false signal |
| 12 | A local quote-service failure was reported as "**Autonomi** did not answer"; a schema fault likewise | false signal |
| 13 | A dark 14/11/10px page under the light New-bee toolbar — the exact shape `DESIGN-CONSTRAINTS.md` §13 (founder continuation 2026-09-07) forbids; every control under the 44px floor | law |
| 14 | `e2e/bpay-policy-ownership.test.mjs` pressed Public with **no seeded quote service** — on this machine it could POST `audience:public` at the LIVE keyless bridge | near-miss |

## THE REBUILD

- **The screen is derived from state** (shared policy key + `bdata-v1` + the one in-flight ask) — never
  poked into the DOM. Listeners are delegated once on the stable page; a region that fails to draw
  cannot strand the rest.
- **The price step is an explicit machine:** `waiting → asking ⇄ retrying → priced | failed`, plus `idle` and `elsewhere` (another tab is asking).
  While asking there is **no price button at all**: a spinner, the seconds so far, the reference figure,
  "Nothing has been paid.", and **Stop waiting**. One guard covers gesture, button, refresh and retry;
  answers to a withdrawn ask are ignored; a 150 s deadline ends a hung one.
- **Latency law held:** the gesture is still the trigger; cached is still instant; the 5xx flake still
  auto-retries exactly once — now decided on the error's *type*, never its (translatable) words.
  An unreachable quote service fails fast and is named as such.
- **Honest labels:** a price is "current" for 15 minutes, then "earlier" (and asking again becomes the
  primary press). A cached price stands only for this artifact, this selection, this quote service.
- **One live choice, two reasons in plain sight:** the unavailable audiences are prose rows
  ("Not available yet — …"), never buttons; the engineering reason rides the cypherpunk register.
- **Withdrawal is first-class:** *Undo this choice* (a new history edition — supersede, never rewrite)
  and *Stop waiting*. The founder no longer needs an agent or devtools to reset a ceremony.
- **The gesture persists first, reads back, and only then asks**; the request carries the recorded
  policy. The origin claim is made only on evidence (this surface's own stamp for this selection, or
  its own history edition of that moment for selections made before the stamp existed).
- **The riders are obeyed:** depth follows `body[data-reg]` + `<details data-reg-disclose>` (the
  comprehension law — the law prose MOVED one tap away, nothing deleted); strings follow `blang`;
  both keys follow `storage`. The private picker and the duplicate `lang.js` include are gone.
- **New bee is the hub's light canvas** (`data-bee-theme="shared"`), 16px+ reading text, 14px secondary,
  44px controls, focus rings, radios with a ✓ (colour is never the only channel), a live
  region, labelled + validated fields, `<bdi>`/logical CSS for the four RTL tongues. The full-precision
  figure is on screen in every register (the first four decimals lead; typography, never rounding).
- **An automated browser can never be the founder's hand:** with `navigator.webdriver` true, bData
  refuses to contact its default quote service. Both gates also abort `:8807` at the browser and
  assert zero touches.
- History editions are structured and worded at display time (whole sentences, the reader's tongue);
  editions written before this build are shown exactly as written. Obtained prices now return to
  history as evidence. The 40-entry truncation is gone.

## RECEIPTS

**RED first** — the new gate run against the OLD page (`git show HEAD:surfaces/bdata.{html,js}` served as an overlay):
```
✗ New bee renders the hub's light canvas (no dark page under a light toolbar) — {"reg":"bee","bg":"rgb(11, 13, 12)","size":14,"theme":"pending"}
✗ every control clears the 44px touch floor (before the gesture) — 🌐 Public=35px, 🔒 Only me=35px, 🔒 Selected people=35px, Ask me=33px, Automatic within limits=33px, Never=33px, newbee=20px, raver=20px, cypherpunk=20px
✗ unavailable modes are PROSE, never buttons (dead affordances are banned) — BUTTON/not-allowed,BUTTON/not-allowed
✗ the TOP-BAR cypherpunk button opens the anatomy (8 sections) — {"shown":false,"ok":true,"sects":8}
   … 31 ✗ / 15 ✓ in all (first edition of the new gate, 46 checks)
```
**GREEN** — `node e2e/bdata-surface.mjs` on the rebuilt page:
```
bData GATE: GREEN — 70/70 (every press answers; My Data owns policy; bPay holds the economics; supersede-not-mutate held)
```
**Family** — `node --test e2e/bpay-policy-ownership.test.mjs` → `pass 2 / fail 0` (live-bridge touches asserted 0) ·
`node e2e/estate-source.mjs` → `11 passed, 0 failed` · `node --test e2e/register.test.mjs` → `pass 15 / fail 0` ·
`node e2e/i18n-coverage.mjs --set lang-coverage-set.json ru --floors` → `PASS coverage measurement and keyed-count floors`
(bdata.html joins the set at floor **59** keyed of 73 visible leaves, 81% — the old page was never in the measured set) · `node scripts/lint-ci-shape.mjs` → `69/69 suite steps guarded`.

**Corpus** — `node scripts/tmp/bdata-aplus-corpus.mjs`:
```
born 48 keys · 1344 tongue cells · 0 en-filled · retired 5
```
Fleet-drafted per tongue from that tongue's own bData vocabulary, each batch independently reviewed (23 cells
corrected), then a mechanical leak sweep (placeholders, own-script, no markup, no A9c vocabulary, 🌐/ANT kept):
`tongues: 28/28 · corrections applied: 23 · problems: 0`. All ⚙ (unattested). Two late keys
(`bd.price.unreachable.allow`, `bd.price.elsewhere`) are K3 en-filled and recorded in `_meta.enfill` — real
renderings are backlog. Retired: `bd.preserve.first` (had drifted into a lie), `bd.hist.auto`, `bd.hist.bound`,
`bd.hist.fwd` (sentence fragments), `bd.view`.

**Adversarial review** — 4 read-only reviewers over the rebuild produced 33 findings; the ones that stood were
fixed and given a failing check: a field edit re-rendering between mousedown and mouseup **ate the next button
press** (a regression this rebuild introduced — caught before it shipped); legacy cached quotes bypassing the
binding guards; a wallet re-selection stranding an in-flight answer; "current" never expiring on an untouched
page; single-flight being per-tab (now estate-wide: store marker + BroadcastChannel liveness ping, so a closed
tab's marker cannot strand the page); 10px type in the "earlier price" block; focus dropped to `<body>` after a
press; re-announcing alerts on every redraw; toggle semantics on a choice that cannot be un-pressed (now radios).
**CI's verdict is not in this receipt** — nothing has been pushed; the numbers above are this box's runs.

## BOUNDARY NOT CROSSED

No payment. No wallet authorization. No Trezor. No upload/finalize. **No request from this seat ever
reached the live quote service on :8807** — the live page was opened read-only (the register buttons
only), and every price path was exercised against the gate's mock. No change to `bpay-invoice.js`,
the wallet, the bridge, `tour.js`/`register.js`/`lang.js`, or any ruled document.

## NOT DONE HERE (named, so they are backlog and not silence)

- `tour.js`'s bottom bar has no entry for My Data, and stays dark under the light New-bee canvas on
  pages without `data-experience` — both belong to the rider (its `?v=42` is pinned estate-wide).
- The wallet's bPay panel still has the `<button disabled>` audience pattern and no `storage` listener.
- Resuming an in-flight ask after a reload needs a documented non-mutating job endpoint on the bridge.
- `estate-source.mjs` still walks HTML only — keys used from JavaScript are invisible to it (that is
  how `bd.preserve.first` drifted into telling 28 tongues to look for a button that no longer existed).

## REBASE ADDENDUM — 2026-09-19 (onto `77ceb896`, Phase C already on main)

The branch was cut before PR #127 (Phase C, the authorization object) landed on the OLD page, so the
rebase conflicted in `bdata.js`, the gate, the 390 shot and the corpus. Resolution: the rebuild's
architecture stands, and Phase C was PORTED into it rather than pasted over it — step 3 is derived
from state like the rest (locked prose until a price stands → review → `I authorize this` → cancel),
presses are delegated, the review uses the light canvas and holds the 14px/44px/390px floors, there
is no authorize button while the quote service is being asked, the automated-browser wall covers
the authorization POST too, and an authorization is shown only for the exact quote it was pressed
for (a re-quote unbinds it — the digest wall, mirrored). Corpus = union of both sides (2016 keys).
The mock now speaks the current founder invoice's own total and quotes (as #127's did).
Gate: **85/85** on this box (70 rebuild transitions + 15 Phase C). `bdata.js?v=3`.
