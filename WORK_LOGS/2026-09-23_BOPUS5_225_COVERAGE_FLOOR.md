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

---

## ADDENDUM — RENAME, founder order 2026-09-23 10:44Z

**Everything above this line was measured at `fb11b47f`, where the two files
were still `tools/genealogy/source-contract.mjs` and `.test.mjs`. Those pasted
commands are left exactly as they ran; they are not retyped to the new names,
because a receipt that renames its own history stops being a record of what
happened.** The re-run under the new names is below.

### The collision, reproduced — this is the RED

`#224` (`claude-LoVis/source-contract`, head `619e809c`) and `#225`
(`bopus5/source-contract`, head `fb11b47f`) both ADD the same two paths, and
they hold different systems: `#224` is the provider-neutral source / claim /
binding contract; `#225` is the independent reader that audits the published
archive. Both report MERGEABLE against main individually, which says nothing
about each other.

```
gh api .../pulls/224/files   added 373/0  tools/genealogy/source-contract.mjs
                             added 498/0  tools/genealogy/source-contract.test.mjs
gh api .../pulls/225/files   added 531/0  tools/genealogy/source-contract.mjs
                             added 630/0  tools/genealogy/source-contract.test.mjs

git merge-tree --write-tree --messages 619e809c fb11b47f        rc=1
  CONFLICT (add/add): Merge conflict in tools/genealogy/source-contract.mjs
  CONFLICT (add/add): Merge conflict in tools/genealogy/source-contract.test.mjs
```

Individually mergeable, jointly conflicting. Whichever lands first turns the
other into an add/add conflict, and the one-owner-per-file-family rule is
broken before either merges.

### The rename — `#224` keeps the canonical names

```
git mv tools/genealogy/source-contract.mjs       tools/genealogy/source-contract-audit.mjs
git mv tools/genealogy/source-contract.test.mjs  tools/genealogy/source-contract-audit.test.mjs
```

**NO LOGIC CHANGE, measured rather than asserted.** Occurrence census before
the edit — every `source-contract` token in both files is part of a filename,
with no gap:

```
source-contract.mjs        ".test.mjs" 1 + ".mjs" 1 = 2   ALL hits 2
source-contract.test.mjs   ".test.mjs" 1 + ".mjs" 6 = 7   ALL hits 7
```

After the substitution, the same census, and the diff:

```
old name remaining, both files                                   0
new names present                          1+1  and  6+1    (counts preserved)
git diff -M -U0 -- tools/genealogy   total changed lines      18 = (2+7)*2
                                     changed lines NOT bearing the name   0
CONTROL: the same filter CAN report a line — it reports        18
git status --porcelain                RM  ->  RM   (both detected as renames)
```

### GREEN — at the new names

```
node --test tools/genealogy/source-contract-audit.test.mjs
  rc=0   tests 48 · pass 48 · fail 0 · skipped 0      (48 at fb11b47f too)

the genealogy glob, exactly tests.yml:115-121:
  ls tools/genealogy/*.test.mjs | wc -l       16 suite(s)
  position 16 in the glob: tools/genealogy/source-contract-audit.test.mjs
  node --test $(ls tools/genealogy/*.test.mjs)
  rc=0   tests 291 · pass 291 · fail 0 · skipped 0    (291 at fb11b47f too)
```

**The CI pickup is not assumed.** The glob is `ls tools/genealogy/*.test.mjs`,
so a `*.test.mjs` under that directory is matched whatever its stem, and the
listing above names the renamed file at position 16 of 16.

### The collision, after — this is the GREEN for the RED above

```
git merge-tree --write-tree --messages 619e809c <renamed head>    rc=0
  conflicts: NONE
```

### What the rename did NOT touch

`I2` already asserts the reader **imports nothing at all**, so it covers
`#224`'s `source-contract.mjs` without a new row — no clause was added,
widened or narrowed for the rename. `R6`, the coverage census, the partition
and all eleven arms are byte-identical apart from the filename in `I2`/`I3`'s
`readFileSync` and the header prose.

### Still owed, and it is not mine to do

Per the order: `#224` is finished and final-reviewed first, `#225` is then
updated from the main that carries it, the reader and the R6 mutations are
re-run against that exact tree, and **bee-laborer re-reads the new head**.
A verification is pinned to the sha it ran against; this addendum is pinned to
the rename commit and to nothing later.

**MAINNET SPEND: 0.**

---

## ADDENDUM 2 — THE BULK-INCREMENT ROW (bee-laborer's fifth finding on #225)

**Pinned at `8c81ec0d` (the rename head) for the RED, and at the commit this
addendum ships in for the GREEN.**

### The defect

`source-contract-audit.mjs:418` incremented the clause's inspection count once,
in bulk, by the staged store's own size. R6's population expression for that
same code was the same size computed a second time. The equality was `n === n`
and could not fall from any collapse of the two walks the clause actually does.

### Census of the mechanism — mine, not inherited

Instrument named: `grep -o` over the reader at `8c81ec0d`, **occurrences, not
lines**, with a gap probe.

```
saw(  total occurrences                 36
  saw('CODE', ...)  bulk form            1   <- line 418, this clause, only this one
  saw('CODE')       per-row form        35
  1 + 35 = 36 — the partition CLOSES
gap probe: any saw( matching neither shape ->  NOTHING
```

A colleague's count is still an unmeasured count: theirs was 36 sites / 1 bulk /
**27** per-row, which leaves 8 sites unaccounted. The finding is the same and
their scope was right; this partition is the one with no remainder.

### RED — reproduced on the reader ON DISK through the SHIPPED battery

Verdict lines diffed against a pristine run; rc is never the classifier.

```
PRISTINE                                  48/48 rc=0
W5    surviving window 5 on both walks    47/48  FELL: M LNK-STAGED-CORPUS-DIVERGE
W10   surviving window 10                 48/48  ALL GREEN   <- 99.90% coverage loss
W100  surviving window 100                48/48  ALL GREEN
s2    CONTROL: the bulk count -> 1         47/48  FELL: R6  ALONE
PRISTINE AGAIN 48/48 · reader byte-equal to the copy: YES
```

`s2` is the control that makes the silence the gate's and not the rig's: R6's
row for this code is alive and can say no. It simply could not say no to the
collapse, because the number it compared was the number it was given.

### GREEN — counted per row, over both lists

```
inspected[LNK-STAGED-CORPUS-DIVERGE]   10259  ->  20518
corpus.persons 10259 · staged 10259 · sum 20518
findings 12 · vacuous clauses 0        UNMOVED
```

The clause walks **two** lists — `Object.keys(persons)` for the
missing-from-store side, `stagedIds` for the extra-in-store side — so the
honest population is their sum, and the table said the staged store alone.

**The verdicts are untouched and that is asserted by the shipped rows, not by
me:** `R2` (no finding outside the baseline) and `R3` (no dead baseline entry)
are green at the fixed tree, which is a stronger statement about the key set
than any re-implementation of it here.

### Mutations — 9 arms, verdicts DIFFED against pristine, restored byte-equal

```
B1  window 5 on both walks        R6 + M LNK-STAGED-CORPUS-DIVERGE
B2  window 10                     R6   ALONE   <- the exact survivor, 48/48 before
B3  window 100                    R6   ALONE
B4  window 5000 (HALF of each list still walked)   R6   ALONE
B5  HALF-DELETE the extra-in-store count only      R6   ALONE
B6  HALF-DELETE the missing-from-store count only  R6   ALONE
B7  OFF-SWITCH: restore the bulk increment         R6   ALONE
B8  WRONG POPULATION: the table says staged alone  R6   ALONE
B9  DOUBLE COUNT: count one row twice              R6   ALONE
PRISTINE AGAIN 48/48 rc=0 · reader byte-equal YES · test byte-equal YES
```

`B1` is **reported as it came**: at a window of five the small-fixture M arm
also fires, so R6 is claimed to fall ALONE at B2-B9 and not at B1.

`B5`/`B6` are the arms that earn the row — a floor over an inventory must count
the thing that can be DELETED, and here half the work can be deleted while the
other half still runs. `B4` shows it catches a **partial** collapse, not only a
drastic one. `B7` is the off-switch and `B8` is the wrong ANSWER on the table
side; an arm shown to catch an off-switch has not been shown to catch a wrong
answer.

### One thing NOT proven, named rather than left to be found

The population expression carries the reader's own `if (stagedIds.length)`
guard. **Deleting that guard is INVISIBLE — measured, not assumed:**

```
GUARD-DELETED arm   rc=0   tests 48 · pass 48 · fail 0
```

R6 reads the published archive alone, whose staged store is not empty, so the
false branch is unreachable and no arm in this file can fall on it. It mirrors
the reader's condition so that an empty store reds nothing, and the file says
so where the expression is. `LNK-FRONTIER-UNDISCLOSED` already sits in
`UNCOVERED_SWEEPS` for the same branch.

### GREEN, the shipping numbers

```
node --test .../source-contract-audit.test.mjs   rc=0  48 pass 0 fail 0 skipped
genealogy glob, exactly tests.yml:115-121        rc=0  291 pass 0 fail, 16 suites
```

**MAINNET SPEND: 0.**
