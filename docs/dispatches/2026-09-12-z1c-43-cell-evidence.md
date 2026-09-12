# z1.c dispatch — #43 cell evidence artifact (2026-09-12)

**Assignment:** Astra ruling #10 5648661483 → "supply cell evidence." This
dispatch lands the machine-checkable artifact behind the classification
returned in [#10 comment 5648710120](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5648710120).

## Artifact

`docs/receipts/2026-09-12-z1c-43-cell-evidence.tsv` — **7,076 rows**, one per
corpus cell (`.strings[key][lang]`) introduced or changed by PR #43 between
its merge-base `e1a8d3c6` and its head `ab9be3d4`. Columns, tab-separated:

| col | meaning |
|---|---|
| 1 | corpus key (e.g. `uni.title`) |
| 2 | language code |
| 3 | class: `equal` \| `superseded` \| `missing` |
| 4 | superseding commit (`dd95c4d0`) or `-` |
| 5 | PR value (the cell as #43 wrote it) |
| 6 | current-main value (`<ABSENT>` = key/lang not on main) |

Classification rules (three-way: PR value vs merge-base value vs
current-main value): equal = landed verbatim; superseded = a later
main-side corpus commit set a different value (cited — one of the four
commits that touched the corpus since the base: dd95c4d0 → 4b5aadd1 →
444663bb → 0bfa4054, oldest→newest); missing = main still carries the
merge-base value or lacks the cell entirely — the PR's change never landed.
All 23 superseded rows carry a real commit (0 uncited).

## Receipt

- Counts: **equal 6 · superseded 23 · missing 7,047** (total 7,076; missing
  spans 243 keys in 7 families — uni 1,827 / bld 1,682 / pl 928 / bf 899 /
  bnm 696 / d 551 / bst 464).
- Base for "current main": `00258d7c`; verified the corpus blob is
  byte-identical on the newer main `0aede743` (the #61 Bloom merge touched
  zero corpus cells), so the evidence stands for current main as of this
  dispatch.
- Reproduction: flatten each version with jq
  (`.strings | to_entries[] | …` → `key\tlang\tvalue`), diff base→PR for
  the changed set, classify three-way with the four intermediate corpus
  commits flattened likewise. Cross-check: PR-vs-main direct differing
  leaves ≈ 7,070, matching Astra's independent 7,071 recursive count.

## Use

The re-import payload for #43 is exactly the `missing` rows (cols 1, 2, 5).
This branch is evidence-only: no corpus changes, no floors/tests edits, no
merge proposal — the integration shape stays Astra's ruling.
