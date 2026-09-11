# 2026-09-11 — edu Slavic drafts (ru / uk / tt / cs)

Lane: machine-draft ⚙ of the 122 `uni.*` + `bld.*` English strings from
`e2e/edu-en-2026-09-11.json` into Russian, Ukrainian, Tatar (Tatarstan
Cyrillic), and Czech. File: `e2e/edu-tr-slavic.json`.

## What landed

- 122 keys, same order as the English source.
- Every key has four non-empty cells: `ru`, `uk`, `tt`, `cs`.
- Proper names and protocol tokens kept verbatim (Beehive University,
  BlanguageDOCK, bFood, bTranslated, b-gating, [bX review], USDA FDC
  170148, NASEM, DGA, SERVING-BASIS-1,
  COMMISSION_BEEHIVE_UNIVERSITY_2026-08-20, DESIGN-BRIEF-04, CARE, GIDA,
  UNDRIP, ISO 639-3, FATHER-SET-1, Royal Review, Royal Guard, BiGen,
  UNESCO, Karulis, Konstantīns, Latviešu etimoloģijas vārdnīca, skaists,
  skaidrs, kaist, AGPL-3.0-only, zCode, GLM, COA, and the rest of the
  keep-as-is list).
- العربية / latviešu / Русский left in their own scripts where they
  appear as language names.
- Numbers, dates (2026-08-20, 2026-08-26), §, **asterisks**, arrows,
  and emoji preserved.
- Tatar uses Tatarstan Cyrillic (ә ө ү җ ң һ). English label is Tatar,
  never Tartar. Inventory on this draft: ә 607, ө 110, ү 192, җ 40,
  ң 65, һ 57 across the 122 cells. 103 cells carry at least one of
  those letters; the other 19 are short authentic Tatar (ата теле,
  сорау, юклык, алу, кушу, …).
- The only cell identical to English is `uni.title` = Beehive
  University, the proper name.

## Checks run

JSON parse; key-set equality vs the English source; per-cell nonempty;
protocol-token presence in every language of every key that carries
the token in English; no `Tartar` / `тартар` string; no reserved-token
corruption. Receipt:
`/opt/cursor/artifacts/edu_tr_slavic_validate.log`.

## Not done

- No merge into `surfaces/lang-corpus.json` (this seat wrote the
  four-language object only).
- No human attestation. Corpus law applies: machine-draft ⚙ until a
  speaker signs.
- Native review still owed, especially Tatar technical register
  (док / регистр / квитанция loans follow the existing corpus) and
  Czech “řetězec” (string) vs “řetěz” (chain) in the charter law.
- No CI run against estate-check / university-smoke this seat.

Tone held to the calm New bee register already used in the estate
ru/uk/tt/cs cells (квитанция / квитанція / квитанция / doklad;
поместье / маєток / утар / panství).
