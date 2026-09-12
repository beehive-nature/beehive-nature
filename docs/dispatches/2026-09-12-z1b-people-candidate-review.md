# z1.b candidate review — PR #57 at f19513c1 — 2026-09-12

Seat: z1.b (zCode GLM 5.3), the docket's order-2 independent read-only
review session, resumed at Max effort per Astra's handoff (#10 comment
5647692459). Review worktree `wt-z1b-people-review`. Reviewed head:
**`f19513c1`** (PR #57, branch `zcode/people-journey-candidate-2026-09-12`,
merge base `8d42da28` = current main). No implementation edits, no merge,
no deploy, no shared-chrome changes. Receipt branch for this dispatch:
`z1b/people-review-receipt-2026-09-12` (based on main; adds only this file
and `e2e/shots-z1b-review/` evidence).

## Verdict

**Acceptance-ready with three standing low-severity gaps** (F1-mid-beat,
F4, F5 — all pre-existing from `4342cce8`, none introduced by the rider).
F2 and F3 are fixed and verified rendered. No new defects found. The
integration decision is Astra's; the three gaps are small enough to accept
consciously or bounce back for one small rider.

## Identity (§7) and lineage — verified

- `S7_RANGE="8d42da28..f19513c1" sh scripts/identity-check.sh` → **green,
  3/3 commits**: founder author `loVis waTer <loviswater44@gmail.com>`,
  committer `z1.a (zCode)`, one `Co-authored-by: Cursor Agent` trailer each.
- Import fidelity: all nine PR #56 files at `4b5aadd1` hash-match
  `4342cce8` **9/9 byte-identical** (re-verified by blob hash in this
  session, not taken from z1.a's receipt).
- Original branch/PR preserved: `cursor/people-journey-three-temp-7af5`
  still at `4342cce8`+descendants; no rewrite, no force-push.
- z1.a's two-lineage §7 account (push-event green on the original branch;
  pull_request-event red there by construction; candidate green on every
  event kind) matches what the script and workflow actually do.

## Suites — all reproduced independently at f19513c1

| Check | Result |
| --- | --- |
| `node --test` five suites (directory/profile views, social-arrival, first-click, social-three-view) | 47/47 |
| `node e2e/estate-source.mjs` | 11/11 |
| `node scripts/estate-check.mjs` | PASS 93/93 |
| `node e2e/reading-rooms.browser.mjs` | 1812/1812 |
| `node e2e/people-journey-shot.mjs` | 79/79 |

Assertion quality re-inspected (not just green): the page suites' new
"takeaway leads with purpose, not the warning" check
(`e2e/buzz-directory-views.test.mjs:58`) is a real structural guard on the
welcome-led arrival; the shot walk asserts focus-follow into story layers,
story paths, disclosure/language retention in the real DOM, the
external-link law, RTL ar mirroring, and zero page errors. One cosmetic
nit: `e2e/people-journey-shot.mjs:96` is vacuously true for profile.html
(`|| path !== 'buzz-directory.html'`); it still does its job for the
directory. If Astra wires this script into CI, note it writes PNGs into
the repo tree by design (z1.a's committed set); a dedicated out-dir or
clean-tree policy would keep CI checkouts honest.

## F1–F5 status at the rendered head

- **F1 (unkeyed calm-beat copy) — PARTLY UNRESOLVED.** The first paints
  were re-drafted and keyed (welcome-led, honesty demoted to support);
  verified rendered in lv. But the three mid-beat sentences remain unkeyed
  and render English under every non-English tongue: 
  `surfaces/buzz-directory.html:268` and `:276` ("A published community
  door. The same hive has a clean-name web door if .buzz is filtered.")
  and `surfaces/profile.html:257` ("Founder of the Beehive Nature
  Reserve. Builds dynasties. The holder ledger waits behind Go deeper.").
  Rendered proof: with lv selected, `dir.hives.lead` renders
  "Šīs ir muižas pašu kopienu durvis…" while the support line below stays
  English (`shots-z1b-review/v2-dir-hives-lv.png`); same on profile
  (`v2-prof-house-lv.png`).
- **F2 (duplicate destination) — FIXED.** `#layer-figure`'s primary is now
  "Meet the hosts" → `data-dir-go="hives"`, distinct from "Go deeper".
  Rendered: click lands on `#layer-hives` with the two estate door cards
  visible (figure hidden). Renders translated: "Saticiet saimniekus →
  hives". The label now matches the destination (estate-hive doors; the
  people/agents roster remains one Go-deeper away, labeled as such).
- **F3 (Raver never reaches story layers) — FIXED, both pages.** Directory
  raver: arrival → figure → hives (door cards). Profile raver: figure's
  primary "Open the founder house" → `#layer-house` (verified visible;
  renders "Atveriet dibinātāja māju → house").
- **F4 (New bee deeper sub-label sizes) — UNRESOLVED.** Measured computed
  sizes in bee view at the head: directory `.lrelay` 10.5px / `.chip`
  9.5px; profile `.bdesc` 10.5px / `.bmeta` 9.5px (`.law` 16px and table
  15px are correctly lifted by the shared reading-room CSS). Below the
  approved ≥14px routine-label hierarchy.
- **F5 (unkeyed instrument wrappers) — UNRESOLVED.** The numbered section
  headings and their new `.law` blocks remain English under lv ("1 ·
  receipt law", "2 · estate dual-home table" stay English while the keyed
  "MŪSU STROPI…" renders Latvian — `shots-z1b-review/v2-dir-instrument-lv.png`).
- **F6 — RETRACTED, confirmed.** lang.js's RTL map does include `ur`
  (`var RTL={'ar':1,'he':1,'fa':1,'ur':1}`); rendered Urdu flips `dir=rtl`
  and fits at 390 (`v2-buzz-directory-ur-bee-390.png`). My baseline claim
  read the header comment, not the map object — error withdrawn and not
  reintroduced.

## Journey, motion, input, failure states — all verified rendered

- **New bee purpose-first**: directory calm "Welcome. This page is the
  estate's front porch…", takeaway "Come meet the hive."; profile "Start
  with one house: the founder's." Honesty (receipts, no-online, guest
  reads free, lost key) sits in support-size text. Primary actions reach
  useful content: OUR HIVES → two estate door cards; Read the founder
  house → the founder story card. Return paths work (Back to overview +
  experience-nav + footer).
- **Raver compositions honor the color law** — image-verified (the pass
  z1.a could not run; gateway accepted my URLs): directory scene = two
  outlined hives (purple with gold ring, teal), purple people joined by
  warm kin-lines, teal hexagon companions on dashed tethers, green
  biomass band at the bottom; profile scene = golden name-thread through
  three generation lanterns, purple holder, teal record-keeper, green
  roots. Verified both on z1.a's committed PNGs and my own fresh renders,
  including 390 Arabic (scene mirrored left, text/CTA right — correct
  RTL). One observation: at 390 the `xMidYMid slice` crop can hide the
  biomass band (present at 1440); the composition still reads.
- **Keyboard**: 11 Tabs reach the primary door; Enter opens the story
  layer and focus lands on it (`layer-hives`/`layer-house` as
  `document.activeElement`); `:focus-visible` outline rule present.
- **Reduced motion**: `prefers-reduced-motion` → `data-motion-paused=true`,
  pause control disabled, scene animations removed. Pause/resume works in
  normal mode (suite + prior walk).
- **Retention**: per-view beats and disclosure states survive
  bee↔raver↔cypherpunk round-trips in the real DOM; language selection
  survives view toggles (verified lv, ar, he, ur).
- **Failure states**: with `localStorage` access throwing, register and
  language switching still work with zero page errors; a missing corpus
  cell (simulated by intercepting `lang-corpus.json?v=26` and deleting the
  lv cell for `dir.bee.takeaway`) renders the **visible English fallback**
  ("Come meet the hive.") with no layout break, per the corpus law.
- **Honesty fence**: unchanged facts, no fetches, no presence/chat/editor
  invented; machine agents stay labeled; both bqueenbee dates retained;
  external links labeled new-tab + noopener; all decorative SVGs
  `aria-hidden` + `focusable=false` (no untranslated accessible labels).

## Corpus — verified

Exactly 2 keys added (`prof.bee.support`, `prof.raver.openhouse`) + 7
re-drafted (list matches z1.a's dispatch); every changed key has non-empty
cells in English + all 28 tongues; no keys removed; floors untouched;
page EN == corpus EN (estate-source); ⚙ machine-draft provenance recorded
in `_meta.drafted`. Machine drafts are not human attestations — meaning
review remains #7, as disclosed.

## Screenshots (this branch, `e2e/shots-z1b-review/`)

`v2-dir-hives-lv.png`, `v2-dir-instrument-lv.png`, `v2-prof-house-lv.png`,
`v2-prof-raver-story.png`, `v2-buzz-directory-ar-bee-390.png`,
`v2-buzz-directory-ar-raver-390.png`, `v2-buzz-directory-ur-bee-390.png`,
`v2-profile-he-bee-390.png` — fresh renders at `f19513c1` from the walk
above (playwright, headless, local static server; no outbound requests).

## Remaining limits

- Image review used an AI vision pass over PNGs (two independent reads per
  key scene); it is stronger than geometry alone but is still not a human
  designer's eye. One analyzer pass initially misread the abstract
  directory scene as "stale"; the focused re-reads confirmed the current
  composition, and my own renders match the committed PNGs.
- Corpus meaning (28 tongues) unreviewed here — machine drafts by law.
- No two-device or live-Buzz behavior was tested — none is claimed by the
  candidate.

---

# z1.b Sprint 2 delta addendum — PR #57 at 0bfa4054 — 2026-09-12

Astra handoff #10@5648234510 executed (range `f19513c1..0bfa4054`, one rider
commit). §7 green on the full `8d42da28..0bfa4054` range (4/4
founder-authored · z1.a seat-committed · trailered). Verdict per finding:

- **F1 CLOSED.** The three mid-beat sentences are keyed (`dir.hives.doorcard`
  ×2, `prof.house.story`) with cells in en+28. Rendered proof: lv shows the
  door-card sentence in Latvian beside the keyed lead, and Hebrew flips it
  RTL (`v3-dir-hives-he.png`, `v3-prof-house-lv.png`); the shot walk asserts
  exact corpus equality for both.
- **F5 CLOSED.** All numbered instrument headings + their law blocks keyed
  (29 new corpus keys total, none removed, floors untouched, ⚙ provenance
  recorded). Page suites now structurally forbid unkeyed `<h2>\d` headings
  and `<div class="law">` copy. Rendered: "1 · kvītu likums…" in lv
  (`v3-dir-instrument-lv.png`). lang.js's rich-content path (`i18nRich` +
  innerHTML restore) keeps `<b>fetches nothing</b>` bold in English while
  plain cells render as text — verified. The embedded profile link is
  preserved by splitting the sentence (`dir.inst.law5a` span + separate
  keyed `experience.profile` anchor): href intact, label renders "Cilvēki
  un vārdi" in lv. Remaining unkeyed instrument *content* labels (table
  `<th>`, `relay host:`/`invite:`/`type:` field labels, roster notes,
  Buzz-app link verbs) are the pre-#56 layer — verified already unkeyed at
  `4342cce8` — kept as the disclosed limitation per Astra, not a delta
  regression.
- **F4 CLOSED.** Bee-scoped `.875rem` (14px) overrides; measured computed
  minimums at 390px: `.lrelay`/`.chip` 14px across 42+23 visible elements
  (en **and** he-RTL, both fit), `.bdesc`/`.bmeta` 14px on profile; the
  shared reading-room `.law`/table lifts (16/15px) unchanged; Cypherpunk
  scoping preserved (10.5/9.5px + mono font) and asserted in the suites.
  Visually confirmed readable (`v3-dir-instrument-lv.png`,
  `v3-prof-instrument-390.png`).
- **Assertion repair VERIFIED.** The vacuous profile-language line is now
  exact corpus equality on both pages. Negative-gating tested empirically:
  fully removing the door-card elements or the `.calm` element makes the
  assertion **fail loudly** (locator timeout), not pass. One hardening note
  (non-blocking): inside the language loop, the instrument drift sweep
  itself has no `#instrument` visibility pre-assert, so an emptied
  instrument passes that single assertion vacuously on that load (the main
  pass asserts instrument visibility on its own load). A one-line
  `isVisible` pre-assert closes it.
- F2/F3 acceptance preserved (no regression in the delta); state retention
  re-verified (beat/disclosure/language across toggles).

Checks rerun at 0bfa4054: five page suites **49/49** (two new F4 tests) ·
estate-source **11/11** · estate-check **93/93** · reading-rooms browser
**1812/1812** · people-journey-shot **97/97**. Note: the shot script's PNG
regeneration is not byte-deterministic across runs (three raver PNGs
differed on my rerun) — worth an out-dir or .gitignore decision if Astra
wires it into CI.

**Verdict: acceptance-ready.** Machine-draft meaning review stays in #7;
the disclosed legacy corpus gaps (`bd.note.title` etc.) remain release-note
material per Astra. New evidence in `e2e/shots-z1b-review/`:
`v3-dir-instrument-lv.png`, `v3-dir-hives-he.png`, `v3-prof-house-lv.png`,
`v3-prof-instrument-390.png`.
