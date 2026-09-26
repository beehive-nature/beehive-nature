# 2026-09-12 · zCode translation lane — surfaces/profile.html, three modes, corpus-keyed

Order: fresh isolated worktree from origin/main; audit profile.html, the shared
locale/corpus wiring, and the three toggled modes (new bee / raver / cypherpunk);
measure untranslated visible strings from source and rendered locale paths; key
navigation/headings/controls/privacy/editor/mode-specific labels; preserve
SKAISTS styling and the three registers; no silent English fallback — absence
marked, not disguised; keyed translations + regression tests; exact suites,
secret scan, diff checks; founder-author/zCode-committer commit with parsed
Co-authored-by trailer; review branch only, no merge/deploy/main.

Worktree: `wt-zcode-tx`, branch `zcode/profile-translation-2026-09-12`, cut from
origin/main `f65bb609`.

## What was measured (BEFORE)

The census instrument (`lang.js measureVisibleText`, the same one the picker
counter uses) walks laid-out lettered leaves per state — profile.html hides its
sections behind register×beat states, so a single default-load measurement sees
only 15 leaves. The lane instrument walked all seven states:

| state | leaves | keyed | unkeyed |
|---|---|---|---|
| bee/arrival | 15 | 15 | 0 |
| bee/house | 70 | 15 | 55 |
| bee/deeper | 98 | 36 | 62 |
| raver/arrival | 12 | 12 | 0 |
| raver/figure | 14 | 14 | 0 |
| raver/house | 85 | 16 | 69 |
| cypherpunk/deeper | 196 | 35 | 161 |
| **total** | **490** | **143 (29%)** | **347 (156 distinct texts)** |

The unkeyed mass split into (a) house-archive UI chrome — headings, controls,
editor/privacy copy, mode-specific labels, dynamic statuses — and (b) published
record data. profile.html was in NEITHER the coverage arrival set NOR the floors
file: the page had never been under the CI i18n ratchet.

## What was keyed

136 new corpus keys: 126 on-page (`data-i18n`) + 10 JS-only dynamic statuses
(audience notes ×3, editor statuses ×3, share statuses ×5 — all through
`window.BNRLanguage.text`, the corpus law's dynamic-control path, with a
`blang` re-render so a live language switch keeps the CURRENT status, not the
boot default). `&middot;` entities in keyed elements became literal `·`
(corpus convention — the extractor does not decode `&middot;`).

Sections keyed: cypherpunk masthead (eyebrow + disclosure), crest stage
(kicker, title, three register-specific leads, claim stamp, five actions),
nature signature (4), profile editor (summary/copy/4 labels/2 buttons/status),
raver symbols panel (11), lineage panel (three-register headings + bodies,
audience controls + notes, four nodes, four scope tags), rails panel + both
schemas (24), privacy seam matrix complete (heading/body/headers/fields/values/
laws — 28), market panel (9) + the language caveat REWRITTEN to tell the truth
of the new state, manifest panel (2), the instrument's record-about body, and
the footer key-law fragment.

Corpus: 1,350 → **1,486 keys × 29 cells** (en + 28 tongues), authored per key
with en extracted FROM THE PAGE through the same `extractKeyedText`
estate-source uses (byte-faithful by construction — zero hand-copy drift).
All cells machine-drafted ⚙ (the picker-wide default until human attestation;
`_meta.attested` is empty). Registers kept: bee copy welcoming, raver copy
approachable, cypherpunk copy technical — including three separate renderings
each for the lineage heading/body and the archive lead.

**No silent English fallback claiming translation:**
- zero en-fill cells in this group (`_meta.enfill` gains nothing);
- 20 cells are recorded HOMOGRAPHS — true same-spelling words (fr "art",
  "source", "public", "agent", "succession", "local"; es "no", "local";
  cs "agent", "status"; nl/nl-be "agent", "privacy", "status"; da/nb/sv
  "status") — enumerated verbatim in `profile-views.test.mjs` as an exact-set
  carve-out, so any NEW en-echo fails the suite. (Scandinavian kind labels use
  honest compound orthography, ".b-person"/".a-agent", not echo dodges.)
- the on-page language caveat now names exactly what is and is not translated.

## What stays English, on the record (remaining gaps)

Published house-record data: holder names, house names, wallets, mailboxes,
house prose (bdesc), generation lines, record badges (human / bAiGenTiC /
primary tongue / deed holder:), the date-reconciliation caution, and the
manifest JSON receipt — the record of origin, per the pointer law (names are
names). AFTER-state measurement: **510 leaves, 379 keyed (74%), 131 unkeyed —
all record data; zero UI chrome unkeyed** (bee/house and raver/house each show
3 unkeyed: the two holder-record displays + the story-door name). Record-prose
keying is the recorded backlog for the owning lane. Also pre-existing and
named, not fixed (out of lane): `_meta.drafted` on main is a fossilized
numeric-keyed map (an old string exploded to char-codes, 10,937 entries) —
provenance for this lane rides in the dispatch + tests, not that field.

## Regression tests added

- `e2e/profile-views.test.mjs` (front-door line): house-archive-chrome-keyed
  law (only the two holder-record displays may stay unkeyed), the 136-key
  corpus law (en + all 28 tongues non-empty, JS keys cited in the page
  script), the exact-20 homograph record, BNRLanguage.text wiring assertions.
  Six shape assertions updated to the keyed HTML (summary, leads, actions,
  claim stamp now literal ·).
- `e2e/profile-i18n.mjs` (new, CI-wired in the browser job beside the language
  steps): **46/46** — corpus-exact rendered cells per register under ru,
  dynamic statuses through real clicks (audience circle/private, editor
  req/applied, blang re-render), RTL he/ar (`dir=rtl`), sa/tt script reach,
  honest English record of origin (holder name untranslated), manifest stays a
  local JSON receipt, coverage counter machine-marked (⚙ n/m), zero page
  errors across all states.
- profile.html added to the coverage arrival set; floors advanced:
  profile.html = 16 (default-state leaves, all keyed) — and the ratchet caught
  six pages whose floors had lagged main-side growth (bearth 9→10, bigen
  12→13, blongevity 9→11, bsymposium 10→11, onboarding 0→8, review 6→10);
  none dropped (ratchet is monotonic by construction).
- Rider law honored: `lang-corpus.json?v=18 → v19` in lang.js (new keys +
  cached corpus = invisible translations otherwise).

## Receipts (exact commands, final tree)

- Front door (exact CI line): **315/315 pass, 0 fail**
- estate-source: **11/11** (1,183 tree keys exist; 28 tongues cover all 1,486
  corpus keys; corpus English byte-matches the pages)
- i18n-coverage `--selftest`: PASS (31/60 fixture)
- i18n-coverage `--set lang-coverage-set.json ru --floors`: PASS
- profile-i18n.mjs: **46/46**
- estate-check: PASS (94 counted, hub in sync)
- secret-scan tree: exit 0 (silent green)
- lint-ci-shape: 44/44 suite steps guarded (incl. the new profile step)
- lint-shell-chains: ok
- lang-coverage.test.mjs: 29/29
- Shots: `e2e/shots-prof-tx/` — bee-ru-house, raver-ru-house, cypher-ru,
  bee-en-house, all 390px (en baseline = styling untouched; the lane changed
  no CSS beyond label-wrapping spans inside already-gridded labels)
- Corpus merge verified deep: zero pre-existing keys changed, exactly 136
  added, `_meta` byte-identical

## Findings (pre-existing, not this lane)

- The floors measurement can flake on stack.html (observed 100 vs floor 118
  once, then 118 on re-run in BOTH this tree and pristine origin/main — the
  organ board's room table renders from fetched data inside the 700 ms
  measurement window). Flagged for the coverage-gate owner; not widened here.
- attest.html (v=9) and blanguage.html (v=2) carry their own corpus-fetch
  riders — they don't consume this lane's prof.* keys, but their riders belong
  to their owning surfaces and were not bumped.

## Boundary

Review branch only. Nothing merged, deployed, or pushed to main; no unrelated
lane touched. Commit: founder author, zCode committer, parsed
`Co-authored-by: zCode <zcode@skaists.dev>`.

## Tranche 2 — founder card feedback ("this looks amazing except the cards", Thai view)

The founder reviewed the page with the picker on Thai: translated chrome
everywhere, but the seven house-record cards still read English. Second commit
on the same branch: every readable line on the cards is now keyed —
**46 more corpus keys** (type lines, the human badge, primary-tongue badges,
all house descriptions, root/deed-holder/resident/title meta labels, all
generation stamps and their prose, the date-reconciliation caution, the guest
citizen card, the sources summary), each ×29 cells with en extracted from the
page. Corpus 1,486 → **1,532 keys**; tranche-2 en-echo = 0 after honest fixes
(cs "rezident/ozdoba", da/nb "beboer", sv "boende" for same-spelling dodges
that weren't); the homograph record gains one true homograph
(`prof.rec.sources:fr`, French "sources") → exact set now 21, asserted.

The identifier carve-out stands and is named in the on-page caveat (rewritten
again to the new truth): house names, holder names, wallet addresses,
mailboxes, glyph names (蜂王 LOViS, 北方國王之手, Seat-1), the bAiGenTiC brand
chip, and the "English" tongue datum after its translated label stay printed
exactly as published.

**AFTER2 measurement** (same seven states): 540 leaves, **495 keyed (92%)**,
45 unkeyed — all identifiers/manifest receipt. Thai render verified in-DOM:
`บุคคล · เรือนมุษย์`, Thai founder prose, `รุ่นที่ 1 — ผู้ก่อตั้ง`,
`ภาษาหลัก: ลัตเวีย`, counter `⚙ 196/217`, wallet/name as printed.

Regression additions: profile-views gains the **card-keyed law** (unkeyed card
text outside the identifier carve-out fails; 18/18) and the lane corpus law
now covers `prof.rec.*`; profile-i18n gains seven card assertions including
the bAiGenTiC-chip-stays-printed proof (53/53). Battery on the final tranche-2
tree: front-door line **316/316** · estate-source **11/11** (28 tongues cover
1,532 keys) · i18n selftest + set + floors PASS. Shot:
`e2e/shots-prof-tx/cypher-th-cards-390.png`.

Instrument note (method, not a defect): probing the page with a static server
that double-prefixes `surfaces/` starves lang.js of the corpus — the swap
silently no-ops and everything reads English; the e2e servers strip the prefix
(matching the real `/surfaces/` deployment route).
