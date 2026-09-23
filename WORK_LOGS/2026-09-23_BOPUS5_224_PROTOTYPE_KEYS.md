# #224 — F1/F2, the prototype-key bypass of the privacy projection

**Seat:** bOPus5 (BUILD). **Row:** bee-laborer's F1 and F2 on #224, taken.
**I did not author #224**, and bee-laborer did not author this repair, so
author ≠ finder ≠ reviewer holds on this one for the first time in this chain.
**Base:** `619e809c` (#224's head). **Branch:** `bopus5/224-prototype-keys`.
**Instrument for every count:** `node --test`, rc captured before any pipe.

**F3 (quadratic `personSupport`) is NOT in this commit.** The finder scoped it
as a wiring-step row and I agree; widening a taken row is how a bounded repair
becomes an architecture.

---

## THE DEFECT, REPRODUCED BEFORE A LINE WAS WRITTEN

A fix taken on a diagnosis I did not reproduce is a fix I cannot defend. Every
arm below is mine, run at `619e809c` against the unmodified reader.

```
=== F1 CONTROL — an ordinary ghost id is REFUSED (the path is reachable) ===
  bind s-ghost/c-ghost  REFUSED: source s-ghost is not held; claim c-ghost does not exist

=== F1 ARM 1 — ids Object.prototype already answers ===
  bind toString/constructor  ACCEPTED
  store.claims own keys   ["c-real"]      store.sources own keys  ["s-real"]
  validateStore(store)    []              <- the store reports itself CLEAN

=== F1 ARM 2 — a standing for a claim nobody added ===
  claimStanding(store,"constructor") -> standing=unsupported, mentions=1

=== F1 ARM 3 — the privacy layer refuses EVERYTHING ===
  isPublicSubject: () => false    isPublicSource: () => false
  published claims [] · published sources [] · published bindings 1
    {"schema":"skaists.source-binding/1","sourceId":"toString",
     "claimId":"constructor","relation":"mentions",
     "quote":"SECRET FAMILY LETTER TEXT","note":"never added, never public"}

=== F2 — a false refusal carrying a false reason ===
  addSource id='toString'        REFUSED: source toString: already held   own keys []
  addSource id='valueOf'         REFUSED: ... already held                own keys []
  addSource id='constructor'     REFUSED: ... already held                own keys []
  addSource id='hasOwnProperty'  REFUSED: ... already held                own keys []
  addSource id='__proto__'       REFUSED: ... already held                own keys []
  CONTROL  id='s-ordinary'       ACCEPTED                          own keys ["s-ordinary"]
```

`__proto__` is mine and was not in the review; it matters below.

## CENSUS OF THE MECHANISM — every site, with a gap probe

```
object-literal maps in the reader            4   :342 out (PUBLIC_FIELDS keys, fixed strings — NOT id-keyed)
                                                 :360 claims · :364 publicSource · :370 sources
plus createStore                             2   store.sources · store.claims
id-indexed lookups                           :127 :166 :167 :171 :172 :199 :363 :365 :368 :371
the word hasOwnProperty in this reader       0
CONTROL, the #225 audit reader in the same folder  7
```

Five maps are keyed by a caller-chosen id. All five are repaired.

## WHY `Object.create(null)` AND NOT `hasOwnProperty.call` — measured, not preferred

The review offered either. Only one of them is complete:

```
plain {}    o['__proto__'] = {a:1}   own keys after  []      <- the SETTER ran, nothing stored
            hasOwnProperty.call(o,'__proto__')        false
null-proto  n['__proto__'] = {a:1}   own keys after  ["__proto__"]
            n['toString']                             undefined
```

With plain maps plus `hasOwnProperty.call`, `addSource` for id `__proto__`
passes the duplicate check and then stores **nothing** — reporting success and
keeping no source. That is a new false green inside the fix for a false refusal.
Mutation `M7` below is that remedy applied in full, and it fails two rows.

## THE REPAIR

```
tools/genealogy/source-contract.mjs
  createStore()   sources, claims  -> Object.create(null)
  publicView()    claims, publicSource, sources -> Object.create(null)
  no law changed, no schema changed, no key list changed
```

## THE ROWS — three added, each with a CONTROL in the same call shape

The three rows #224 already had for this class (`8`, `9`, `22`) are anchored on
ordinary ids (`"NOPE"`, `"LTR"`). A gate anchored on the well-formed case is
silent on what it exists to catch, so the new rows are anchored on the ids that
break it and each carries a passing control, so a row cannot read clean because
its mechanism never ran.

**The publicView row needed a second cut.** Its filter is
`claims[b.claimId] && publicSource[b.sourceId]` — an AND, so a single plain map
is MASKED by the other and `M4`/`M5` both survived the first version. The row
now has four sub-cases, each leaving exactly ONE map deciding:

```
(a) both refused              -> nothing publishes
(b) subject may, source may NOT -> only publicSource can refuse   (discriminates M5)
(c) source may, subject may NOT -> only claims can refuse         (discriminates M4)
(d) CONTROL both may            -> it DOES publish, 1 binding, quote intact
```

`__proto__` is the discriminating id, because assigning it on a plain object
invokes the setter and creates no own key, so the map answers from the
prototype even for a value the code explicitly wrote.

## GREEN — mutations, verdicts DIFFED against a pristine run, never read from rc

```
PRISTINE                                          33/33 rc=0
M1  createStore.sources        -> {}   30/33  all THREE new rows
M2  createStore.claims         -> {}   30/33  all THREE new rows
M3  BOTH store maps            -> {}   30/33  all THREE — the defect exactly as found
M4  publicView.claims          -> {}   32/33  the publicView row   ALONE
M5  publicView.publicSource    -> {}   32/33  the publicView row   ALONE
M6  publicView.sources         -> {}   32/33  the publicView row   ALONE
M7  WRONG ANSWER: hasOwnProperty.call at the adders, plain maps kept
                                       31/33  the publicView row AND the own-key row
PRISTINE AGAIN                         33/33 rc=0
reader byte-equal YES · test byte-equal YES
```

`M7` is the arm that earns the choice of remedy: it is the *other* offered fix,
applied in full, and it still fails two rows. An arm shown to catch an
off-switch has not been shown to catch a wrong answer — `M7` is the wrong
answer.

## AFTER — every probe arm re-run against the repaired reader

```
bind toString/constructor      REFUSED: source toString is not held; claim constructor does not exist
claimStanding(s,"constructor") REFUSED: claim constructor does not exist
privacy layer all-false        published bindings 0
addSource id='toString'        ACCEPTED   own keys ["toString"]
addSource id='__proto__'       ACCEPTED   own keys ["__proto__"]
CONTROL  id='s-ordinary'       ACCEPTED   own keys ["s-ordinary"]
```

## SHIPPING NUMBERS

```
node --test tools/genealogy/source-contract.test.mjs   33 pass 0 fail rc=0   (30 before)
genealogy glob, exactly tests.yml:115-121              16 suites · 276 pass 0 fail rc=0
```

The glob total is **276 at this pin and not 291** — this branch is based on
`619e809c`, which does not carry #225's audit reader. A tally belongs to the
tree it ran on.

**MAINNET SPEND: 0.**

---

# ADDENDUM 1 — 2026-09-23, the DURABILITY row

Everything above ran at `0df37095` under the constructor-only repair. This
addendum is a new commit on the same lane and does not retype one line of it.

**Found by bee-laborer re-reading `0df37095`** (their receipt
`WORK_LOGS/2026-09-23_BEELABORER_226_REREAD.md`): the repair is a property of
`createStore()`, not of the store. I did not take it on their diagnosis — the
run below is mine, and it adds one arm they did not have.

## RED — reproduced at `0df37095`, three store shapes, one probe

Fixture shapes taken from the battery itself, not invented (my first cut died
on `unknown predicate birth-date` before reaching a verdict — the same class of
error the finder reported on their own first cut).

```
=== ctor   proto(sources)=null    proto(claims)=null
  validateStore                []
  bind S-ghost/C-ghost         REFUSED: source S-ghost is not held; claim C-ghost does not exist
  bind toString/constructor    REFUSED: source toString is not held; claim constructor does not exist
  bind __proto__/valueOf       REFUSED: source __proto__ is not held; claim valueOf does not exist
  claimStanding constructor    REFUSED: claim constructor does not exist
  addSource __proto__          ACCEPTED ownKeys=["S1","__proto__"]
  addSource S-ordinary         ACCEPTED ownKeys=["S1","S-ordinary"]      <- CONTROL
  publicView DENY-ALL          claims 0 sources 0 bindings 0
  publicView PERMIT-ALL        claims 1 sources 1 bindings 1             <- CONTROL

=== hand   { sources: {...s.sources}, claims: {...s.claims} }   proto=Object
  validateStore                []                       <- reports the store CLEAN
  bind toString/constructor    ACCEPTED                 <- F1 integrity half is BACK
  bind __proto__/valueOf       ACCEPTED
  claimStanding constructor    ACCEPTED standing=unsupported mentions=1
  addSource __proto__          REFUSED: source __proto__: already held   <- F2 is BACK TOO
  addSource S-ordinary         ACCEPTED                                  <- CONTROL
  publicView DENY-ALL          claims 0 sources 0 bindings 0             <- privacy half CLOSED
  publicView PERMIT-ALL        claims 1 sources 1 bindings 1             <- CONTROL

=== json   JSON.parse(JSON.stringify(store))            proto=Object
  identical to hand-built on every line above
```

Two things the finder's own arms did not carry, and both are mine:

- **F2 comes back as well**, not only F1. `addSource("__proto__")` on a rebuilt
  store answers `already held` when nothing is held. Their §4 named the two
  integrity symptoms; the false-refusal mirror is the third.
- **`publicView PERMIT-ALL` is the control that makes the DENY-ALL zeros mean
  something.** Without it "bindings 0" is satisfied by an empty projection. The
  privacy half is closed under every store shape — confirmed, not assumed.

## The repair

A store's **shape** is part of the contract, not only its contents.
`storeProblems(store)` names a map that carries a prototype, and it is asked at
**four** entries because they check separately:

```
validateStore   const out = storeProblems(store);     -> claimStanding, personSupport, publicView
addSource       refuse([...storeProblems(store), ...sourceProblems(s)]);
addClaim        refuse([...storeProblems(store), ...claimProblems(c)]);
bind            refuse(storeProblems(store));   BEFORE the probe
```

`bind` needed its own call and this is the whole reason: its
`filter(p => p.startsWith("binding "))` exists so an unrelated invalid source
does not refuse every honest bind, and it would have dropped a store-shape
problem on the floor. The finder measured that their one-clause preview left
`bind toString/constructor` ACCEPTED; that is why the check sits above the
filter rather than inside it, and CONTROL (b) of the bind row pins the filter
so a later editor cannot "simplify" it into `refuse(validateStore(probe))`.

**Refused, not repaired.** Repairing means mutating the caller's store.

**COST, written into both files rather than left to look free:** a persisted
store cannot be revived by `JSON.parse` alone. There is no revive path here and
no caller that needs one — zero importers, measured below — so the hand that
persists a store writes it.

**SCOPE:** the prototype only. A `sources`/`claims` that is missing or is not an
object behaves exactly as it does today and is deliberately not this row.

## GREEN — after

```
=== hand and === json, every line:
  validateStore  ["store.sources: carries a prototype, so an id JavaScript puts on every
                   object reads as a held source -- build it with createStore()",
                  "store.claims: ... reads as an existing claim -- build it with createStore()"]
  bind / claimStanding / addSource / publicView   all REFUSED with that sentence
=== ctor  every line UNCHANGED from the block above
```

## MUTATIONS — 8 arms, verdicts DIFFED against a pristine run, never read from rc

`.scratch/bopus5_store_shape_battery.mjs`. Every arm asserts its own landing
(anchor hits `=== 1`, **byte inequality** rather than a length delta, new text
present) and both files are restored from a byte copy taken before arm one.

```
PRISTINE                                               36/36
D1 drop the SOURCES half of storeProblems     33/36    all three new rows
D2 drop the CLAIMS half of storeProblems      34/36    the validate row + the adder row
D3 OFF-SWITCH: validateStore stops asking     35/36    the validate row   ALONE
D4 addSource stops asking                     35/36    the adder row      ALONE
D5 addClaim stops asking                      35/36    the adder row      ALONE
D6 bind stops asking                          35/36    the bind row       ALONE
D7 WRONG ANSWER: prototype test INVERTED       3/36    33 rows, the whole battery
D8 WRONG ANSWER: bind's filter widened        35/36    the bind row       ALONE
PRISTINE AGAIN                                36/36    reader AND test restored byte-equal
```

- **D2 falls on two rows and not three, and that is correct**: the bind row
  anchors on `store.sources`, so the sources half still fires for it.
- **D7 is the "can it say YES" direction** and it is blunt: inverting the test
  makes every store `createStore()` builds invalid, so 33 rows fall including
  every pre-existing one. Reported as it came rather than as I would have liked
  a clean single-row fall.
- **D6 and D8 fall on the same row and on DIFFERENT assertions** — a row that
  fails without saying which thing it caught is the month-late-by-eye path, so
  both texts are here:

```
D6   AssertionError: Missing expected exception.
       expected: /store\.sources: carries a prototype/   operator: 'throws'
     (the hand-built arm, test line 665 — the guard is simply gone)
D8   Error: source s-broken: unknown type undefined; source s-broken: scope must say ...
       at bind (source-contract.mjs:215) from source-contract.test.mjs:676
     (CONTROL (b) — an honest bind refused by an unrelated invalid source)
```

## One more false signal, deleted rather than patched

`source-contract.test.mjs:528` was
`` new RegExp(`source ${id === "__proto__" ? "__proto__" : id} is not held`) ``.
Both branches evaluate to `id`; it read as though `__proto__` needed a special
case in the pattern and it does not — the id carries no regex metacharacter.
Named by bee-laborer in §5 of their re-read, now `` `source ${id} is not held` ``.
Their `:264`/`:294` note needs no action: nothing those rows intended is lost,
and M4/M5/M6 each pin the prototype of the map they mutate by falling alone.

## My own instrument, twice

- **The first battery refused D7 as NOT LANDED.** My landing criterion was a
  length delta, and `!==` → `===` is the same length. A same-length mutation
  needs a BYTE-EQUALITY assertion; my own banked law, firing on me. Re-cut, and
  the arm then took 33 rows.
- **The first battery classified every fall twice**, because `node --test`
  prints a failing row once inline and once in the recap. A verdict diff that
  double-counts is a false signal inside the instrument that exists to find
  false signals. Deduped by name.
- A patch script aborted on an anchor with `0` hits and wrote nothing. It
  refused rather than landing half an edit — the behaviour I want from it.

## SHIPPING NUMBERS — at this commit, not borrowed from the one above

```
node --test tools/genealogy/source-contract.test.mjs   36 pass 0 fail rc=0   (33 before)
genealogy glob, exactly tests.yml:114-121              16 suites · 279 pass 0 fail rc=0
  (276 before; 279 and not 294 because this branch is based on 619e809c,
   which does not carry #225's audit reader. A tally belongs to the tree it ran on.)
importers, scoped to tools/ surfaces/ scripts/ e2e/ minus its own two files:  NONE
storeProblems in tools/:  5 — one definition and four call sites, no more
```

**F3, the quadratic `personSupport`, is still NOT here.** The finder scoped it
as a wiring-step row and widening a taken row is how a bounded repair becomes
an architecture.

**MAINNET SPEND: 0.**
