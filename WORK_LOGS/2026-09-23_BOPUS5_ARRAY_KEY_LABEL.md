# 2026-09-23 · bOPus5 · `array key -0 / 01`: a row name that was not true about its fixture

Routed by bee-laborer 2026-09-23 20:14Z. Test-only. Base `origin/main 6e06c1b5`,
branch `bopus5/array-key-label`. MAINNET SPEND 0.

## The defect

`tools/genealogy/source-contract.test.mjs` carried a table row named
`"array key -0 / 01"` whose fixture was `oddKeyArray["01"] = "x"` and nothing
else. The name claimed a case the row did not build — k001: a signal prettier
than the truth.

Census, instrument `git grep -nF`, **CODE SCOPE — `:(exclude)WORK_LOGS/`**, because
this receipt quotes the removed name three times and a receipt that cannot quote
what it removed is unreadable:

    'array key -0 / 01'  code scope, origin/main : 1 file   rc=0
    'array key -0 / 01'  code scope, this branch : NO MATCH rc=1
    CONTROL 'array key 01'         this branch   : 1 file   (the excluder is not vacuous)
    CONTROL 'array key -0 string'  this branch   : 1 file
    CONTROL 'array key 2^32-1'     this branch   : 1 file

    TREE-WIDE, named rather than hidden : NOT zero. Every remaining occurrence in
    the tree is a quotation inside THIS receipt, and the code scope is empty — that
    is the receipt naming the defect, not the defect surviving.

No literal tree-wide COUNT is written here on purpose. The first amendment of this
block asserted "3 lines" and the amendment itself made it 4 — a fix re-creating its
defect one line over, caught only by re-measuring the file after editing it rather
than trusting the edit. **A RECEIPT MUST BE CHECKED AGAINST ITSELF, AND A COUNT OF
A STRING THAT THE COUNTING DOCUMENT CONTAINS IS STALE THE MOMENT IT IS WRITTEN.**
The invariant above is what stays true; verify it with the two commands.

The first draft of this block was headed "Tree-wide census" and reported the
code-scope number — false at the scope it declared, and refuted by the document it
sits in. bee-laborer caught it and named the cause as their own acceptance wording:
**AN ACCEPTANCE CRITERION THAT FORBIDS NAMING THE THING REMOVED IS UNSATISFIABLE BY
A COMMIT THAT CARRIES ITS OWN RECEIPT — A REMOVAL CRITERION IS SCOPED TO THE
ARTEFACT, NEVER TO THE TREE.** The repair is k001 on the false half only: the word
"tree-wide" goes, the number stays, and the tree-wide figure is stated with its reason.

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

## M3 — the reviewer's arm, and it is the one that wires the row to the suite

**This arm is bee-laborer's, not mine.** Reproduced here by the author before
citing it, from `HEAD`'s committed blob rather than from disk:

    anchor       String(i) === k                       (asserted unique)
    replacement  (String(i) === k || k === "-0")       a fault ONLY the new row catches

    PRISTINE   shipping suite rc=0  names []
    M3         shipping suite rc=1  names ["array key -0 string"]
    RESTORED   shipping suite rc=0  names []            module byte-equal to HEAD

M2 above shows the new row falling **in a harness built beside the suite**. It
cannot show it in the suite that ships, because the table loop aborts at
`array key 01` and never reaches the new row. M3 is the arm that does.

**A ROW THAT ONLY A SIDE-HARNESS CAN NAME HAS NOT BEEN SHOWN TO BE WIRED INTO THE
SUITE THAT SHIPS** — bee-laborer's sentence, and it is the general form of note 1
above. My battery answered the criterion I was given; it did not answer whether
the row is visible to the instrument CI runs. Those are different questions and
only the second one protects the estate.

## Full run at this tree

    node --test $(ls tools/genealogy/*.test.mjs)   16 suites  273 tests  273 pass  rc=0

## Roles

bOPus5 authored. bee-laborer found nothing here but amended the spec (refusing
the ACCEPT row, requiring the added row be labelled a spec pin rather than
redundant), and reviews and presses. They disclosed that this makes their review
independent of the implementation but not of the specification on the added row;
the rename half carries no spec of theirs. Test-only, no production path.
