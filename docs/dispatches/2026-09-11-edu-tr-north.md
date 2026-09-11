# Grok — north education corpus (lv gd de nl nl-be da nb sv fi) — 2026-09-11

Seat: Grok / Cursor cloud agent. Lane: BlanguageDOCK education strings.
Branch: `cursor/edu-tr-north-fddc`.
Source: `e2e/edu-en-2026-09-11.json` (122 keys, uni.* + bld.*).
Landed: `e2e/edu-tr-north.json`.

## What this is

Real renderings for the university + BlanguageDOCK education surface in the
founder-priority northern set. Not English copies. Not placeholders. Every
key from the English file has all nine cells filled.

Languages: lv (Latviešu, founder-priority), gd (Scottish Gàidhlig, not Irish),
de, nl, nl-be (Flemish, distinct where natural), da, nb, sv, fi.

## Sense traps named and avoided

- **register** is reading density (`lasījuma blīvums` / `gnè-cainnt` /
  `ìre leughaidh`), not a government registry. The adapter *register* over
  chains stays a catalogue sense.
- **raver** stays the mid-density vivid register (`reiveris` / `raver`),
  never countryside, never `raibheir`.
- **gd** uses Scottish forms (`tha`, `a'`, `àite`, `cànan`, `cuidhteas`).
  Irish relatives (`tá`, `níl`, `bhfuil`) were scanned out.
- Proper names and protocol tokens kept verbatim: Beehive University,
  BlanguageDOCK, bFood, bTranslated, b-gating, [bX review], USDA FDC 170148,
  NASEM, DGA, SERVING-BASIS-1, COMMISSION_BEEHIVE_UNIVERSITY_2026-08-20,
  DESIGN-BRIEF-04, CARE, GIDA, UNDRIP, ISO 639-3, FATHER-SET-1, Royal Review,
  Royal Guard, BiGen, UNESCO, Karulis, Konstantīns, Latviešu etimoloģijas
  vārdnīca, skaists, skaidrs, kaist, AGPL-3.0-only, zCode, GLM.
- Scripts kept: العربية, latviešu, Русский.
- Numbers `1.25` and `6,700`, dates, filenames, emoji, arrows, `§`, `**`
  retained where the English has them.

## Receipts

```
source keys: 122
translated keys: 122
languages per key: lv gd de nl nl-be da nb sv fi
total cells: 1098
empty cells: 0
exact English copies (non-proper-name): 0
keeper-token misses: 0
```

Machine-drafted ⚙ until a human who speaks the tongue attests. No corpus
upgrade claimed. No surfaces/ ritual this beat — the file lives under `e2e/`.

UNPERFORMED: native speaker attestation; merge into `surfaces/lang-corpus.json`.
