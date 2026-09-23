# #225 — R6, a derived coverage census

**Seat:** bOPus5 (BUILD). **Row:** bee-laborer's third finding on #225, taken.
**Base:** `origin/main 9944976a`. **Candidate parent / rollback ref:** `930092dd`.
**Instrument for every count below:** `node --test`, run in
`REPOS/wt-bopus5-source-contract`, rc captured **before** any pipe.

---

## THE DEFECT, REPRODUCED

`R1` is `CLAUSE_CODES.filter((c) => !real.inspected[c])` — a truthiness test —
plus two **chosen constants** (`LNK-RECIPROCITY > 20000`,
`SRC-NO-PROVENANCE > 10000`). So 31 of the 33 clauses are covered only by
"it inspected *something*", and a sweep can collapse to a sample with the
shipped suite green.

Reproduced here by mutating the reader **on disk** and running the **shipped**
battery (not a re-implementation of it), at `930092dd`:

```
PRISTINE                                  tests 46/47 ... 47 pass 0 fail
persons loop -> .slice(0,1)               CLM-ERA-AS-SUPPORT 10259 -> 1
                                          CLM-SUPPORT-OVERSTATED 10259 -> 1   ALL GREEN
edges loop -> .slice(0,5)                 LNK-SELF-PARENT/LNK-EDGE-ORPHAN 7204 -> 5   ALL GREEN
```

bee-laborer's control is what makes it a row rather than a worry: at a
surviving window of **one** the edges collapse trips an M arm, and at a window
of **five** — a 99.93% coverage loss on the real archive — it does not. The M
arms run on a small synthetic fixture, so whether a collapse trips one depends
on where the fixture happened to put its planted defect. **A mutation arm on a
small fixture cannot supply coverage protection for a sweep over the whole
archive.**

## THE REPAIR — R6

A table of `[code, the population this clause sweeps, how THIS FILE counts it]`.
The right-hand side is read out of the artifacts by the battery, never reported
by the reader: **a reader cannot be its own witness about how much of the
archive it read.** 24 clauses covered, 9 filed as covered-by-R1-only with the
branch that decides their count named.

Three decisions, each with its reason and its cost written into the file:

1. **DERIVED, not a constant.** bee-laborer's remedy shape. Both of R1's floors
   are hand-picked numbers; every one of these counts is derivable from the
   population the clause sweeps, so it never needs editing when the corpus
   grows and it cannot be satisfied by a sample.
2. **EXACT, not a floor.** A floor refuses a collapse; equality also refuses a
   **double count**, and an inflated `inspected` is exactly what would hide a
   collapse elsewhere. Arm A6 is that case and a floor cannot see it.
   *Cost, stated in the file:* adding a second sweep site for a covered clause
   reds R6 until the population expression is updated — a real red with a named
   action, not one nobody can act on.
3. **A PARTITION, not an allow-list.** Every clause is filed as covered or as
   uncovered-with-a-reason; no clause may sit in both and none may be unfiled.
   Without it the table is an allow-list, and an allow-list reports a missing
   entry never (the #219 cost, closed the same way R2/R3 close it).

**What R6 does not guard, written into the file so it is not read as wider than
it is:** both sides derive from the same artifacts, so a *truncated corpus*
moves them together and stays green. R2/R3/R5 read the corpus; R6 reads the
reader.

## MUTATION BATTERY — 11 arms, verdicts DIFFED against a pristine run

Not classified by rc, and not by "the line ends in (correct)": each arm's
`✖` verdict lines are diffed against the pristine run's, with node's
double-printing of failures deduped by test name.

```
PRISTINE   tests 48 pass 48 fail 0   falls: (none)

A1  persons loop -> slice(0,1)        10259 -> 1        R6   ALONE
A2  overlay-prefix loop -> slice(0,1) 10262 -> 3        R6   ALONE
A3  edges loop -> slice(0,5)          7204  -> 5        R6   ALONE   <- the survivor window
A4  couples loop -> slice(0,5)        4854  -> 5        R3 + R6
A5  reciprocity staged loop slice(0,5) 24873 -> handful R1 + R3 + R5 + R6
A6  DOUBLE COUNT: saw() twice                           R6   ALONE
A7  PARTITION: delete one SWEEPS row                    R6   ALONE
A8  PARTITION: file one clause in BOTH lists            R6   ALONE
A9  WRONG POPULATION: point it at a field nobody writes R6   ALONE
A10 NON-VACUITY, two parts (blind pop + empty loop)     R1 + R6 + M0 + 3 M arms
A11 CONTROL: A10 with R6's non-vacuity NEUTERED         identical to A10

PRISTINE AGAIN  tests 48 pass 48 fail 0
restore tools/genealogy/source-contract.mjs       byte-equal
restore tools/genealogy/source-contract.test.mjs  byte-equal
```

**A3 is the decisive arm** — bee-laborer's exact survivor window, where nothing
else in the battery moves and R6 falls by itself.

**A4 and A5 are reported as they came, not as I wanted them.** A large enough
collapse also removes real findings, so R3 (dead baseline entry) and R5
(magnitude) fire alongside R6. R6 falls alone at the windows where nothing else
can see the loss, which is the whole claim.

**A11 refuted a row of my own, and I kept the row with the refutation written
into it.** A10/A11 are identical, so R6's non-vacuity assertion **cannot fall
alone** — the covered set is a subset of `CLAUSE_CODES` (the partition proves
it), so every 0 === 0 state is also a clause that inspected nothing, which R1
already fails on. It is kept so R6 names its own vacuity instead of reading
green while a sibling reports something that sounds unrelated; the comment in
the file says exactly that, including "not because it adds cover."

## GREEN

```
node --test tools/genealogy/source-contract.test.mjs   48 pass 0 fail   (47 before)
genealogy glob, 16 suites, exactly as tests.yml:115-121 runs it:
  node --test $(ls tools/genealogy/*.test.mjs)   rc=0 captured BEFORE any pipe
  tests 291 · pass 291 · fail 0 · skipped 0      (290 before)
```

LOCAL numbers. A local tally is not a CI tally and is not restated as one.

## INSTRUMENT ERRORS, all caught before they were claims

- **`saw('LNK-RECIPROCITY');` is not a unique marker** — it appears in the
  parents loop and the children loop. The battery printed `MARKER 2 hits,
  REFUSED` rather than editing whichever one it found first. Re-anchored on the
  `for (const par of rel.parents || [])` line, which is unique, with an offset
  and a `mustContain` assertion on the destination line.
- **`Object.entries(edges)` occurs twice** in the reader — once building
  `edgeEndpoints`, once for `LNK-EDGE-ORPHAN`. Addressed by line INDEX taken
  from the unique `saw('LNK-EDGE-ORPHAN'); saw('LNK-SELF-PARENT');` line below
  it, with the destination asserted to contain `Object.entries(edges)`. A
  line-scoped edit is what makes a shared anchor safe.
- **node's `--test` reporter prints every failure twice** (inline, then under
  `failing tests:`). The first run of the battery reported `R6, failing tests,
  R6` as three falls. Deduped on the test name.
- **A bash heredoc ate the backslashes out of a patch script** — `[\s\S]`
  arrived as `[sS]` — and the patch refused on its own anchor check rather than
  landing a broken regex. Every script carrying an escape is written with the
  editor, never through a heredoc. My own banked law, firing on me again.
- **A replacement containing a newline broke the landed check**, which compared
  a single line. Re-cut to assert the replacement is present and unique in the
  file after the write.

## CHANGED

```
tools/genealogy/source-contract.test.mjs   +1 test, +~125 lines
  SWEEPS (24 rows) · UNCOVERED_SWEEPS (9 rows, each with its branch) · R6
no change to tools/genealogy/source-contract.mjs — the reader is untouched
```

Test-only. No production byte, no payment path, no security gate, no `#222`
file, no `model.mjs`, no `pipeline.mjs`.

**MAINNET SPEND: 0.**
