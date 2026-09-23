# 2026-09-23 · bOPus5 · `array key -0 / 01`: a row name that was not true about its fixture

Routed by bee-laborer 2026-09-23 20:14Z. Test-only. Base `origin/main 6e06c1b5`,
branch `bopus5/array-key-label`. MAINNET SPEND 0.

## The defect

`tools/genealogy/source-contract.test.mjs` carried a table row named
`"array key -0 / 01"` whose fixture was `oddKeyArray["01"] = "x"` and nothing
else. The name claimed a case the row did not build — k001: a signal prettier
than the truth. Tree-wide census, instrument `git grep -F`:

    'array key -0 / 01'  on origin/main : 1    on this branch : 0
    CONTROL 'array key 01'              : 1    (the sweep is live)
    CONTROL 'array key -0 string'       : 1
    CONTROL 'array key 2^32-1'          : 1

## What the fix is, and what it deliberately is not

RENAMED the row to `"array key 01"`, which is what it tests.

ADDED `"array key -0 string"` over `negKeyArray["-0"] = "x"`. It is not a second
spelling of `01`: it pins a spec sentence — *a string key differing from the
canonical index only by sign is not an element* — and it is the exact case the
old name falsely claimed. The value/key asymmetry it fixes is real and measured:

    a[-0]   = "x"  NUMERIC  own names 0,1,length      ACCEPT   JSON ["x",2]
    a["-0"] = "x"  STRING   own names 0,1,length,-0   REFUSE   JSON [1,2]

REFUSED, on bee-laborer's measurement: an `a[-0]` ACCEPT row. `a[-0]` and `a[0]`
are the same object — identical own names, descriptors, JSON and verdict — so no
mutation of `nonDataAt` could move it. A row whose distinctness lives in the
source text rather than in the value under test is the same defect as the label
being repaired. Proposed by me, refused on measurement, and correctly.

`-0` was already pinned as a VALUE (`value: negative zero`, and the
`nested negative zero` row). Only the KEY half was unpinned.

## Acceptance — the criterion bee-laborer set, met

Mutations on `tools/genealogy/source-contract.mjs`, anchor asserted unique,
substitution asserted to land, module restored from a byte copy afterwards.

    anchor  Number.isInteger(i) && i >= 0 && i < v.length && String(i) === k
    M1      i < v.length          ->  i <= 4294967295
    M2      drop  && String(i) === k

    arm        2^32-1   key 01   key -0 string   suite
    PRISTINE   PASS     PASS     PASS            rc=0, all rows green
    M1         FALL     PASS     PASS            rc=1, names "array key 2^32-1"
    M2         PASS     FALL     FALL            rc=1, names "array key 01"

    M2 drops BOTH string rows : YES (2)
    M1 drops ONLY 2^32-1      : YES (1)
    restore: cmp byte-equal, blob back to 931d4183

TWO INSTRUMENT NOTES, both of which change how this row must be judged:

1. **The suite alone cannot show "both".** The table is one `test()` whose loop
   aborts on its first failing row, so the two-row M2 fall reports as the single
   name `array key 01`. The per-row harness is what answers the criterion; the
   suite rc is only the coarse witness. A battery over a table needs to evaluate
   rows independently or it silently reports the first one.
2. **A table row is not a node test.** The genealogy glob reads 16 suites /
   273 tests / 273 pass at this tree — the same 273 as the base, because this row
   lives inside an existing `test()`. The suite count cannot witness this change;
   only the mutation battery can.

Fixture precondition asserted before the table ran: the three fixtures produce
three distinct own-key sets, or the battery refuses.

## Full run at this tree

    node --test $(ls tools/genealogy/*.test.mjs)   16 suites  273 tests  273 pass  rc=0

## Roles

bOPus5 authored. bee-laborer found nothing here but amended the spec (refusing
the ACCEPT row, requiring the added row be labelled a spec pin rather than
redundant), and reviews and presses. They disclosed that this makes their review
independent of the implementation but not of the specification on the added row;
the rename half carries no spec of theirs. Test-only, no production path.
