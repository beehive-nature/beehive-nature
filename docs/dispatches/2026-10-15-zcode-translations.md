# 2026-10-15 — zCode surfaces-translations lane (PR #442)

**Order:** founder, this session — "please update the entire skaists.dev
surfaces' translations; we have built a lot of new code/text."

**Branch:** `zcode/surfaces-translations-2026-10-15` (worktree
`wt-zcode-translations`, from origin/main `8e7a16f9d`).
**Head:** `523c5d6f2` (+ dispatch rider). **PR:** #442.

## What was true first (the measurement)

The full census (`e2e/i18n-coverage.mjs --set e2e/lang-coverage-set.json ru`)
on origin/main said: 11,408 visible leaves, 1,769 keyed, **9 missing corpus
rows** (all bdata, keyed by the purchase-recovery lane but never docked),
**1 empty cell** (`v.note2`, en-only since it shipped), **Sanskrit at 96%**
of used keys (30 st.* cells never drafted), and 9,639 unkeyed leaves
estate-wide — mostly data (names, hashes, timestamps) plus not-yet-keyed
prose.

## What this lane did

### Round 1 — corpus repairs (fleet-drafted, 28 agents × one per tongue)

- 9 `bd.*` rows ×28 (bdata wallet/add/pay states the page referenced via
  `tx()` with no corpus row).
- `v.note2` ×28 (the vending rehearsal note).
- 30 `sa` cells on `st.*` keys (stack surface Sanskrit gap).
- **14 malformed cells hoisted**: they were nested `{en,sa}` row *objects*
  where strings belong (`st.hon.4` + 13 more, incl. raver/cypherpunk stack
  variants). The renderer's `typeof` check had silently fallen back to
  English for them; the intended renderings were intact inside and are now
  restored (inner `en` had to match its own row — asserted).
- Vestigial empty row `wl.lede` (referenced nowhere) removed.
- `lang.js` corpus cache-buster `v=29` → `v=30` (readers must actually get
  the new corpus).

### Round 2 — the new text (150 keys ×28, drafted inline by the seat)

The 28-agent fleet exhausted the account's weekly agent limit mid-lane
(resets 2026-10-17 18:39Z), so round 2 was drafted inline by this seat under
the same law (pointer principle, estate voice, identifier/placeholder
preservation asserted by `scripts/tmp/validate-round2.cjs` — ALL 28 CLEAN):

- **bdata** 92 keys: the `et.bdata.*` three-register fronts (76) the bdata
  lanes referenced via `T()`/`data-etk` but never docked, plus 16 `bd.*`
  dynamic states. The 18 static `data-etk` elements now also carry
  `data-i18n` — `data-etk` alone was inert (nothing renders it).
- **missions** 26 keys: intro steps, docket head/sub, desk law, nav links,
  status-note words, and the 10 `missions.state.*` chips.
- **doors/skaists** 15 keys: origin block, list head, not-yet list, footer.
- **receipts** 12 keys: table headers, both buttons, export note, kicker.
- **wallet** 4 keys: footer links + the Rust-core badge, via a guarded
  `WTX` shim beside the page's existing `BNRLanguage.text` pattern.

Keying is attribute-only (rendered English byte-identical; word-diff
checked, eternal suites green). The `deck.crumb.hub` row was reused for the
wallet footer's "the hub" (identical English).

## Gates (this box, this head)

- `i18n-coverage --selftest` PASS (29 languages).
- Full census `ru --floors`: **PASS** — keyed 1769→1815, MISSING 9→0,
  EMPTY 1→0, **every one of the 28 tongues 100% of the 1,027 keys the set
  uses** (was 99%, sa 96%).
- `node --test`: lang-coverage 13✓ · blanguage-eternal 7✓ ·
  btranslated-eternal 5✓ · browser-translate 6✓ · bdata-eternal 7✓ ·
  doors-skaists-eternal 6✓ · wallet-coins 16✓.
- `zcode-missions-check.mjs` 72✓ (3 registers × 3 mission pages); the
  screenshot churn it regenerates was restored, not committed.
- Floors were NOT advanced (gate-only): the ratchet rises from CI's own
  measured lines, not this box's playwright run.

## Honest remainders (named, with owners)

1. **9,481 unkeyed leaves** estate-wide remain the recorded backlog —
   names/hashes/timestamps (honest absence by the pointer principle) plus
   not-yet-keyed legacy prose. The census counts them; floors hold the line.
2. **mission-room / watch / profile static-prose keying** — started by
   agents, lost to the limit with nothing landed. Their dynamic text already
   translates at render time via each lane's `T()`; the static prose is
   unkeyed. NEXT OWNER: this lane resumes 2026-10-17, or any seat.
3. **Census blind spot (named for the counter's future):** `T()`-rendered
   dynamic labels carry no `data-i18n` attribute, so the census undercounts
   pages that translate at render time (mission suite, parts of bdata).
   bdata.js's `tx()` shows the fix pattern (attribute + `data-i18n-en`).
4. **Wallet passkey error-diagnostic prose** (BAD_ORIGIN banner, ceremony
   failure arrays) remains unkeyed — wallet lane family carry-over.
5. A planned live ru-render smoke (`ru-render-smoke.mjs`) could not complete
   on this box (playwright launch wedge under load — cleared once by killing
   orphaned chrome-headless-shells, then returned); the render path is
   covered instead by the eternal suites that load these exact pages and the
   13 renderer unit tests.

## Receipts

- Baseline census JSON: `scripts/tmp-i18n-baseline.json` (untracked, this
  worktree). Final census: `scripts/tmp/final-census.txt`.
- Draft sources: `scripts/tmp/i18n-drafts/round2-en-sources.json`; drafts:
  `scripts/tmp/i18n-drafts/round2/*.json` (28); validator:
  `scripts/tmp/validate-round2.cjs`.
- Corpus `_meta.drafted` carries both passes with this lane's name.
