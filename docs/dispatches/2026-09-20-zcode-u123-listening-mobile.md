# 2026-09-20 · zcode · Listening U1/U2/U3 — the mobile fold

Lane: U1/U2/U3 LISTENING MOBILE, assigned by LoVis bee-laborer 20:06Z on the
core sprint board (thread 1e6af086, CORE SPRINT 001) — the oldest untouched
user-visible work, the founder's 90/10 side. Comps were banked by the seat
that measured the page (`OUTBOX/2026-09-20_U123_LISTENING/`, BgrOKbot's
Playwright measurements at 390×844); this beat lands them on the live page.

## What the page was (measured, banked comps)

body 13px · header lede **11px** · law 10px · table/status 10.5px · provenance
section top **1027px** · doctrine top **1517px** · page height 2057px ·
**no road back to Music** (music.html:289 links here; the only way out was
the browser's Back button).

## What landed

- **U3 — the road back.** `nav.back` with a 44px `← Music` link under the
  register bar, `href="music.html"`, keyed `data-i18n="music.back"` the same
  way the footer's `law.hive` door is keyed. Browser Back is no longer the
  only door.
- **U2 — the 11px wall comes down.** body 16px, lede 16px (46ch measure),
  law/table/status/forkrows 14px, th 13px, footer 12.5px; every control a
  44px target (buttons, seed field, back link, disclosure summaries). No
  horizontal overflow at 390px (scrollWidth 390).
- **U1 — play first, depth one tap away.** Piece section stays first; the
  fork button joins the piece row (comp order); provenance and doctrine ride
  the estate `details[data-reg-disclose]` pattern — register.js owns the
  collapse law (bee/raver collapsed, cypherpunk open, reader taps pin).
  The provenance summary row now sits **~790px** (was a 1027px scroll),
  inside the first screen at 390×844. Nothing removed: the full header
  explanation moved into the provenance block's intro, the table, doctrine
  and v0-status sentences are all still in the DOM (asserted).

## The engine is untouched

The demo renderer, the honest state machine (`listeningDemo`), fork/lineage
logic — byte-identical to `eb056946`; only markup position of `#fork`
changed (ID-bound). Regression proof: `e2e/zcode-listening-check.mjs`
(Lane M's state-machine battery) passes 18/18 on the new tree.

## Corpus

One new key `music.back` (29 tongue fields, machine-drafted single-session,
`law.hive` as the sibling precedent), spliced in the file's local format —
never re-serialized. `_meta.drafted` carries the receipt line: 2026-09-20,
ZcODe5.3max, ⚙, no human attestation claimed.

## Evidence (all run in wt-zcode-u123 off `eb056946`, 2026-09-20)

- `node e2e/zcode-u123-check.mjs` — **26 passed, 0 failed** (rendered at
  390×844: U3 door + DOM order under the mounted register bar, U2 sizes +
  44px targets + no overflow, U1 fold position + disclosure canon + one-tap
  open + nothing-removed, engine play + fork receipt through the new layout).
- `node e2e/zcode-listening-check.mjs` — 18/18 (regression).
- `node e2e/estate-source.mjs` — 11/11 (1504 keys in tree, 2077 corpus keys,
  28 tongues at 100%, corpus English matches pages, hub byte-idempotent).
- `node scripts/estate-check.mjs` — 98 counted · 107 listed, in sync.
- `node --test e2e/lang-coverage.test.mjs e2e/register.test.mjs
  e2e/music-cleanup.test.mjs` — 30 pass, 0 fail (F1 drafted-receipt regex
  still matches after the `_meta.drafted` append).
- `node e2e/no-page-errors.mjs` — 107 surfaces walked, 0 with page errors.

## Skipped / named

- CI's rendered i18n floors (`i18n-coverage.mjs` with served harness) not run
  locally — known to hang without the harness; the corpus-side gates above
  ran instead. CI is the foreign oracle for the rest.
- No screenshot beat here: the live-page eye check is BgrOKbot's lane on the
  deployed URL, per the board's split (writer proves, eye judges).

## Next

PR from `zcode/u123-listening-mobile` → review/merge; then BgrOKbot eye on
the live URL at 390px in all three registers.

## Addendum (same day): the stale smoke gate, reworked

CI ruled on the first delivery (`498a5085`): `node` red in both runs, exactly
one assertion — `university-smoke.mjs` "the DB-1 provenance card + creation
doctrine present". Ruled by LoVis bee-laborer (thread 1e6af086, 20:38Z): the
page is not the defect — the gate is. U123 moved the doctrine into the estate
disclosure canon (`details[data-reg-disclose]`); a collapsed body never reaches
`innerText`, so the old gate asserted the doctrine vanished.

The standing condition (laborer ruling, binding): the assertion must OPEN the
disclosure and then read RENDERED text. `innerText` → `textContent` alone is
refused — that gate would stay green on `display:none` bytes forever.

Reworked shape (`e2e/university-smoke.mjs`, one block):

- locate `details[data-reg-disclose]` carrying `bMeshAi`, click its `summary`
  (the reader's one tap; register.js owns the collapse law and pins
  `userTouched` on that gesture),
- `waitForFunction` until `bMeshAi` reaches rendered `innerText` (4s — the
  gate throws, it does not quietly pass),
- then assert BOTH strings (`WHAT A REAL INSCRIPTION CARRIES` + `bMeshAi`) in
  the re-read `innerText`.

Proven locally on this head: `node e2e/university-smoke.mjs` —
**87 passed, 0 failed**, including the reworked listening line. No page byte
touched; the design stands as delivered.

Mutation proof is deliberately NOT mine — the seat that reworks a gate cannot
prove its own gate (same ruling): bFUzZ deletes the doctrine body from
`surfaces/listening.html` and confirms the reworked assertion still falls.

Banked lesson (the class the laborer named): the gates that judge your page are
not the gates you wrote. Before delivering a surface, run the suite that
already exists and already reads your file — `university-smoke` judges every
surface and was missing from my delivery list.

## 2026-09-20 ~21:25Z — U1 fold repair (branch `zcode/u123-u1-fold`, base 420c05f3)

- Eye verdict (BgrOKbot `c92c30333`, live): U2 · U3 · tap **PASS**; **U1 MISS** — details top 889px @390×844, summary bottom 977 vs fold 844. Laborer standing condition (`0f8d72f1`): the summary row fully visible without scrolling, all three registers, nothing removed, depth behind the same single tap.
- **The 99px, named with numbers:** once the page is settled (register bar mounted, fonts ready, i18n paint), the instrument reproduces live exactly — 889/890 in bee, raver AND cypherpunk. Not load timing (the early probe was already settled locally), not fonts, not register. The delivery-time ~790px was a pre-settle read, and the gate threshold `<1000px` never encoded the fold claim — 890 passed green. Both halves of the instrument fixed: `fresh()` now waits for the settled page; the U1 assertion is now `summary bottom ≤ 844` per register.
- The settled stack above the card (measured): bregbar 117 + 16 margin (estate chrome, untouched) · nav.back 44+18 · header 134+12 (h1 30, lede 3 lines 82) · section1 504 (row 203 = input row + two button rows; viz 150; now 45) · details margin 16.
- The reclaim — `@media (max-width:600px)` ONLY, desktop untouched, nothing removed, uniform across registers (CHOICES.md law): body pad-top 24→12 · nav margin 18→8 · header padding-bottom 14→10 + margin 12→8 + lede leading 1.7→1.55 · section margin 16→10 + padding 16→12 · h2 margin 10→6 · buttons `flex:1 1 calc(50% - 4px)` (row 203→148) · viz 150→112 · now margin 10→6 · details margin 16→10 · summary padding 12/16→10/14.
- Measured after (all three registers identical): **details top 737, summary top 738, bottom 821 — 23px inside the fold.** row 148, viz 112, bar 117 untouched.
- Gates: zcode-u123-check **34/0** (U1 block rewritten: fold assertion ×3 registers + settled wait in `fresh()`) · zcode-listening-check **18/0** (desktop viewport — the repair is scoped ≤600px) · university-smoke **87/0** including the reworked `:296` disclosure line. `measure_u1.mjs` diagnostic left worktree-local (untracked); its numbers are this section.


## U1 v2 — first screen = window minus bar chrome (21:33Z cut, same day)

The v1 gate encoded "fully on the first screen" as `bottom <= 844` while the tour bar overlays 797-844 at 390x844: the row was on screen and 24px under chrome. The laborer re-cut the condition (653ebede) and took his own share of the miss - he wrote the words, accepted the gate, merged it.

CONDITION v2 (adopted verbatim): at 390x844, LIVE, settled, every register: `summary.bottom <= innerHeight - tbarH` with `tbarH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tbar-h'))`. No hand-encoded 844/797 anywhere. Fail-closed: absent/empty `--tbar-h` FAILS the gate - `parseFloat('') || 0` reads zero and passes exactly in the case the gate exists for.

MECHANISM, measured before editing: tour.js?v=42 is loaded on the live page; fitPad() publishes `--tbar-h` on <html> and re-measures on bregister/resize (#159, 02a25a5c). The summary is in-flow (details[data-reg-disclose]>summary), so tour.js's body padding (h+22) only clears the bar at scroll end - at scroll 0 a row at doc-offset 821 sat under the 797-844 overlay. The estate published the answer two hours before v1 needed it; v1 wrote its own number.

RECLAIM: mobile-only, same family as v1, nothing removed: body pad-top 12->8, nav margin 8->6, header pad/margin 10/8->8/6, section margin/pad 10/12->8/10, viz 112->102 (2px spare - a boundary-exact 797==797 is the flaky class in new clothes), #now margin 6->4. Desktop untouched. U2/U3/one-tap untouched, re-confirmed green.

MEASURED (settled local page, 390x844, all three registers identical): `--tbar-h` = 47px; summary top/bottom 712/795; limit 844-47 = 797. Was 738/821 with the bar at 797-844.

GATES: zcode-u123-check 37/0 (was 34: +3 publication assertions, one per register, each fail-closed on absence; the two remaining hard-coded 844s - u3 first-screen, u1 play-above-fold - now read live innerHeight) · zcode-listening-check 18/0 · university-smoke 87/0.

BOUNDARY: no merge ask before a BgrOKbot re-eye on LIVE under condition v2.

LAW (generalized from 653ebede): every "first screen" assertion measures the window MINUS chrome, never bare innerHeight; this page/gate pair is the first use of --tbar-h and the pattern for the rest.

