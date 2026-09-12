# 2026-09-12 — New bee chrome corpus UNION (#45–#52)

This is the beta-floors **corpus UNION**, not a new three-temperature
adapter. No HTML page was remodeled. No synonym key was invented. Essay
/ `h.*` body fill is out of scope and was not chased.

Beta target (Chief PASS): land remodeled doors
[#45](https://github.com/beehive-nature/beehive-nature/pull/45)–[#52](https://github.com/beehive-nature/beehive-nature/pull/52),
then this UNION, so those landings cannot drop earlier doors’ chrome
cells. Each adapter branches from the same `main` and replaces
`surfaces/lang-corpus.json` with only that door’s new keys. Sequential
merge without a UNION leaves only the last door’s cells.

David Irvine / x0x #622 is untouched. This seat did not start a backend
lane.

## Tip SHAs fetched (2026-09-12)

| PR | Branch | Head | New bee chrome (exact keys, not renamed) |
|----|--------|------|------------------------------------------|
| #45 | `cursor/bearth-three-temp-d797` | `deb81c3b9cb72c90feb0b48cac46d9c41f6e0845` | `bearth.bee.calm` · `takeaway` · `support` · `land` · `deeper` |
| #46 | `cursor/bsymposium-three-temp-9e07` | `5be549d9a3705625d9a1a3b019f8aead62f5e6a2` | `bsymp.bee.calm` · `takeaway` · `support` · `meet` · `deeper` |
| #47 | `cursor/bfood-three-temp-9be5` | `3e41289da08d350c6626de1da8351cc252d81b84` | `bfood.bee.calm` · `takeaway` · `support` · `draw` · `deeper` |
| #48 | `cursor/blongevity-three-temp-934b` | `1b9776f6c800a3d1829bae15bd80b3a3374e2c09` | `blong.bee.calm` · `takeaway` · `support` · `story` · `deeper` |
| #49 | `cursor/review-three-temp-beca` | `a861d813a53043248466e6fbc438e8f6838e822b` | `review.bee.calm` · `takeaway` · `marks` · `support` · `leave` · `deeper` |
| #50 | `cursor/bigen-three-temp-5aed` | `0d839a723a750a04afb59a8788d6c50b697052c5` | `bigen.bee.calm` · `takeaway` · `support` · `fence` · `map` · `deeper` |
| #51 | `cursor/university-three-temp-314e` | `d1468053c99dbe6fc5ace6f9ade1a12a36f15fcc` | `uni.bee.calm` · `takeaway` · `support` · `start` · `deeper` |
| #52 | `cursor/onboarding-three-temp-02d6` | `2cf9629dfd8f6c4626697fc185d1036e52257455` | `onb.bee.calm` · `takeaway` · `support` · `start` · `deeper` plus the other `onb.bee.*` already on tip (`choice` · `preview` · `continue`) |

`onb.mark` and `onb.pair` sit inside `#first-bee` on the #52 tip and
were UNION’d. The other seven doors keep `*.mark` / `*.pair` on the
masthead; those tip-born rows were UNION’d too so a later door cannot
drop them.

## What was UNION’d

Additive only. `origin/main` had 829 corpus keys. This tree has **938**
(+109). No existing main key was rewritten (zero cell conflicts). Later
tip would have won a same-key conflict; none occurred.

All 109 tip-born keys from those eight heads ride in this file — not
only the listed New bee five/six. Each adapter’s corpus is a whole-file
replace. Omitting the sibling tip-born chrome (`*.raver.*`, second-beat
captions, `*.foot.*`) would drop those cells the same way the listed
bee keys would drop. None of those siblings are essays. No `h.*` body
was filled. No new key was coined.

Every UNION’d key carries English plus the 28 docked tongues (**29/29**
cells), copied from the newest tip that defined it.

#50’s tip did not append its own `_meta.drafted` suffix. The UNION note
records that `bigen.*` (15 keys) came from that tip anyway.

## Floors (`e2e/lang-coverage-floors.json`)

| Door | Floor | Note |
|------|------:|------|
| `bearth.html` | 9 | tip #45, already on main |
| `bsymposium.html` | 10 | tip #46, already on main |
| `bfood.html` | 12 | tip #47, already on main |
| `blongevity.html` | 9 | tip #48, already on main |
| `review.html` | 6 | WATCH — kept as tip #49 |
| `bigen.html` | 12 | tip #50, already on main |
| `university/index.html` | **11** | from #51 (was 7 on main) |
| `onboarding/index.html` | **0** | honest — not raised |

The university ratchet is the post-#51 first-paint census. This PR does
not carry #51’s HTML. Against current main HTML,
`node e2e/i18n-coverage.mjs ru --floors` will fail university
(`7 keyed / floor 11`) until #51 lands and this branch rebases. That is
sequencing, not a missing draft. After #45–#52 land, rebase this UNION
so the floor is checked against the remodeled door.

Onboarding stays 0. Mha unit polish on `bearth.bee.support` is out of
scope. Ant-door / WELLness remodel is out of scope.

## Out of scope (named)

- Essay / `h.*` translation fills
- New synonym keys
- Remodeling HTML pages (#45–#52 land those separately)
- Onboarding floor raise
- `bearth.bee.support` Mha unit polish
- Ant-door / WELLness
- `lang.js` cache bump (`lang-corpus.json?v=17` unchanged on every tip)

## How to prove (no essay chase)

```bash
# every listed New bee chrome key is present with 29 filled cells
node -e '
const c=require("./surfaces/lang-corpus.json");
const langs=["en",...c._meta.langs];
const keys=[
  "bearth.bee.calm","bearth.bee.takeaway","bearth.bee.support","bearth.bee.land","bearth.bee.deeper",
  "bsymp.bee.calm","bsymp.bee.takeaway","bsymp.bee.support","bsymp.bee.meet","bsymp.bee.deeper",
  "bfood.bee.calm","bfood.bee.takeaway","bfood.bee.support","bfood.bee.draw","bfood.bee.deeper",
  "blong.bee.calm","blong.bee.takeaway","blong.bee.support","blong.bee.story","blong.bee.deeper",
  "review.bee.calm","review.bee.takeaway","review.bee.marks","review.bee.support","review.bee.leave","review.bee.deeper",
  "bigen.bee.calm","bigen.bee.takeaway","bigen.bee.support","bigen.bee.fence","bigen.bee.map","bigen.bee.deeper",
  "uni.bee.calm","uni.bee.takeaway","uni.bee.support","uni.bee.start","uni.bee.deeper",
  "onb.bee.calm","onb.bee.takeaway","onb.bee.support","onb.bee.start","onb.bee.deeper",
  "onb.bee.choice","onb.bee.preview","onb.bee.continue","onb.mark","onb.pair"
];
for (const k of keys) {
  const row=c.strings[k];
  if (!row) { console.error("MISSING",k); process.exitCode=1; continue; }
  const n=langs.filter(L=>typeof row[L]==="string" && row[L].trim()).length;
  if (n!==29) { console.error("THIN",k,n); process.exitCode=1; }
}
console.log((process.exitCode?"FAIL":"PASS")+" union chrome", keys.length, "keys × 29 cells");
'

node scripts/estate-check.mjs
node e2e/estate-source.mjs
# floors: university 11 is the #51 ratchet — expect fail on pre-#51 HTML
node e2e/i18n-coverage.mjs ru --set e2e/lang-coverage-set.json --floors
```

Machine drafts only. `_meta.attested` is unchanged. Passing these
checks is not a human attestation and not a meaning review.
