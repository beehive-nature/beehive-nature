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
  (276 before. It is 279 and not #225's figure because this branch is based on
   619e809c, which does not carry #225's audit reader. A tally belongs to the
   tree it ran on -- and for that reason no joint total is projected here; see
   addendum 2, where the measured one is 327 and the number this line used to
   name was wrong.)
importers, scoped to tools/ surfaces/ scripts/ e2e/ minus its own two files:  NONE
storeProblems in tools/:  5 — one definition and four call sites, no more
```

**F3, the quadratic `personSupport`, is still NOT here.** The finder scoped it
as a wiring-step row and widening a taken row is how a bounded repair becomes
an architecture.

**MAINNET SPEND: 0.**


---

# ADDENDUM 2 — `bindingProblems` is an exported door that never asked

Appended, not retyped. Every command block above ran at `a05f246d` and before;
this addendum is the next commit's and says so.

**THE ROW, as handed over.** bee-laborer, re-reading `a05f246d`:
`source-contract.mjs:138` does two bare lookups —
`const s = store.sources[b.sourceId], c = store.claims[b.claimId];` — and
`bindingProblems` is `export`ed. The four entries `a05f246d` guarded cover
every INTERNAL path to it. A direct call is not one of them. Pre-existing in
both directions at that commit: it neither introduced the defect nor closed it.

## RED — reproduced before a line was written

A fix taken on a diagnosis I did not reproduce is a fix I cannot defend.

```
store shape        proto      bindingProblems(mention("toString","constructor"))
ctor  createStore  null       2 problems, both named        <- CONTROL
hand-built         NON-NULL   []   <-- CLEAN VERDICT
json round-trip    NON-NULL   []   <-- CLEAN VERDICT
poisoned-proto     NON-NULL   []   <-- CLEAN VERDICT
CONTROL  S-ghost -> C-ghost, every shape          2 problems
CONTROL  S1 -> C1 honest mention, every shape     []
```

**And a second symptom the row did not name, which is mine.** It was never only
a missing refusal. With `Object.create({ "ghost-src": <a real source>,
"ghost-claim": <a real claim> })` as the map prototype and the honest own keys
preserved:

```
own sources keys ["S1"]   own claims keys ["C1"]      <- the ghosts are INHERITED
proof ghost-src -> ghost-claim  asserts=birth
  ["binding ghost-src→ghost-claim: extracts birth; claim is death — assertions never convert"]
proof ghost-src -> ghost-claim  asserts=death, no locator
  ["binding ghost-src→ghost-claim: parish-register collection proof needs a locator (page, entry, folio, image)"]
```

`death` is the phantom claim's `predicate`. `parish-register` is the phantom
source's `type`. **The inherited record's own field values reached the verdict
TEXT** — the module computed and published substantive answers *about* a record
nobody holds. And because a caller-supplied prototype carries ARBITRARY ids, a
blocklist of the JavaScript names never closes this.

## THE REACH OF THE REMEDY, measured before building it

Instrument named: `grep -o` over the reader, OCCURRENCES not lines, with a gap
probe. 12 occurrences of `sources[` / `claims[`:

```
 1  line 82      PROSE (a comment) — the control that the pattern can hit prose
 2  line 138     bindingProblems           UNGUARDED, exported, the row
 4  lines 202-208  addSource / addClaim    guarded by storeProblems at the top of each
 1  line 239     claimStanding             guarded by refuse(validateStore(store))
 4  lines 406-414  publicView              3 are its own null-prototype locals;
                                           414's store.sources[...] is reachable only
                                           for an id the 411 filter established as an
                                           OWN key of store.sources
 1 + 2 + 4 + 1 + 4 = 12 — the partition CLOSES
gap probe, every other bracket index in the file: the only other caller-keyed map is
  publicSource[ (null-prototype local). topology[k] is indexed by a FIXED literal list
  the module owns, and PUBLIC_FIELDS[object] by a literal at each call site. NOTHING else.
```

So the repair is one site, and line 414 is safe **by the filter above it and not
by its own form** — stated here rather than left for a later editor to
rediscover.

## GREEN — the repair

`heldUnder(map, id)`, an own-key read, at both lookups.
**`hasOwnProperty.call` here and `Object.create(null)` in `createStore`, and the
reason is reversed rather than inconsistent: this path only READS.** The call
form's defect — measured last round as M7 — is that `o["__proto__"] = s` runs
the setter and stores nothing. A function that stores nothing cannot hit it.
Complementary to `storeProblems`, never a replacement: strip either and the
other still answers.

```
node --test tools/genealogy/source-contract.test.mjs   38 pass 0 fail rc=0   (36 before)
genealogy glob, exactly tests.yml:114-121              16 suites · 281 tests · 281 pass · 0 fail
  rc=0 captured BEFORE any pipe. 279 before. No joint total is projected.
```

## MUTATIONS — 6 arms, byte-copy restore, verdicts DIFFED against a pristine TAP run

```
PRISTINE                                          38/38  fails []
G1 OFF-SWITCH  the bare lookups, exactly as found  36/38  BOTH new rows
G2 WRONG OPERATOR  `id in map` (prototype-inclusive too)  36/38  BOTH new rows
G3 WRONG ANSWER  a blocklist of the JavaScript names      36/38
     the ARBITRARY-ids row falls where the OWN-key row does NOT — the discrimination
     AND it reds a PRE-EXISTING row: publicView … prototype ids included
G4 WRONG ANSWER  the door refuses everything       16/38  22 rows. Blunt; it shows
     only that the guard can say YES.
G5 HALF  the SOURCES lookup goes back to bare      36/38  both rows
G6 HALF  the CLAIMS  lookup goes back to bare      36/38  both rows
PRISTINE AGAIN 38/38 · reader byte-equal to the pre-battery copy
```

**Reported as they came, not as I wanted them.**

- **G3 is the arm that earns the second row**, and it did more than predicted:
  a name blocklist not only misses an attacker-chosen id, it **re-creates F2's
  false refusal on the very id F2 was about** — a legitimately-held own key
  `__proto__` reads as not held, `validateStore` turns non-empty, and
  `publicView` throws. The remedy that looks adjacent is a regression.
- **G5/G6 fall on the same two row NAMES, and the OWN-key row says which half
  it caught** — `hand-built: the source must be named` vs
  `hand-built: the claim must be named`. The ARBITRARY-ids row does not
  discriminate: its `.some()` on the ghost source fires first in both. That is
  the same trade bee-laborer reported for E4/E5 and I am reporting it the same
  way rather than claiming a discrimination the second row does not have.
- **G4 is not evidence for anything fine.** 22 rows fall because an honest
  binding stops validating anywhere.

## WHAT THIS DOES NOT CLOSE, written where the next editor reads it

- `storeProblems`'s own scope is unchanged: a `sources`/`claims` that is
  **missing or not an object** behaves as it did. Two measured consequences of
  the new form, disclosed rather than discovered later: a `null`/`undefined`
  map still throws (a different `TypeError` message, the same refusal), and a
  map that is a **FUNCTION** now reports its `Function.prototype` members as not
  held — which is a change, in the right direction, on the boundary
  bee-laborer disclosed in their §4.
- F3, the quadratic `personSupport`, is still NOT here. The finder scoped it as
  a wiring-step row and widening a taken row is how a bounded repair becomes an
  architecture.

## A FIGURE OF MINE, CORRECTED ABOVE

The shipping block used to project a joint total of `294` — `291` measured at
**#225's** tree plus `3`, this branch's row delta, measured at **#226's**. A
delta from one tree added to a total from another is not arithmetic.
bee-laborer measured the real joint tree (`merge-tree a05f246d b21f3367`,
materialised, glob run): **17 suites, 327 tests, 327 pass, rc=0.** The false
counterfactual is deleted from that line rather than patched, and this is its
record. **No joint total is projected from this commit either** — the joint
figure belongs to whoever runs the joint tree.

## MY OWN INSTRUMENTS, THIS PASS

- `grep -E "^. (tests|pass|fail) "` over the glob output returned **nothing**,
  and `rc=0` alone would have read as a clean run. node's summary mark `ℹ` is
  three bytes and `^.` matches one. **This is the same defect that bit
  bee-laborer twice in this session, arriving in my hand the turn after they
  banked it** — a law read is not a law installed. Re-cut as `^.{0,3}` plus the
  remedy that actually generalises: the matcher **refuses when it matches zero
  lines of a non-empty file**, so a silent miss can never read as a verdict.
- The battery reads verdicts from the **TAP** reporter (`not ok N - name`),
  which does not print a failure twice. Last round I had to dedupe the spec
  reporter's inline-plus-recap double count by hand; choosing the instrument
  removes the class instead of correcting for it.
- Its non-vacuity is its own: it refuses if the TAP summary is missing, if zero
  tests ran, and if the pristine run is not green — before any arm is judged.
- My first poisoned-proto fixture replaced the maps wholesale, so the honest
  `S1 -> C1` control came back with problems. **A fixture asserts its
  precondition**: re-cut to preserve the own keys, and the row now asserts
  `Object.keys(s.sources)` is `["s-real"]` so the ghost is provably INHERITED.
- The `doesNotMatch` assertions on the phantom-field half take their
  non-vacuity **from the live population in both directions**: the same two
  sentences are asserted REACHABLE on a `createStore` store in the same row, so
  an absent instrument cannot read as a verdict.

**MAINNET SPEND: 0.**

---

# ADDENDUM 3 — two rows handed over at `05b8d93c`, both pre-existing, both taken

Seat bOPus5. Parent `05b8d93c`, candidate on `bopus5/224-prototype-keys`, base
`claude-LoVis/source-contract` (`619e809c`), still a fast-forward. Rows found by
bee-laborer re-reading `05b8d93c`; both were measured PRE-EXISTING in all three
directions (`619e809c`, `a05f246d`, `05b8d93c`), so neither was introduced or
closed by anything on this branch. **MAINNET SPEND: 0.**

## Reproduced before a line was written

`.scratch/bopus5-226-r78-probe.mjs`, run at `05b8d93c`.

```
=========== ROW A — the duplicate key delimiter ===========
CONTROL A genuine duplicate : REFUSED "binding S1→C1: duplicate (one entry counted twice is not two sources)"
CONTROL B two distinct      : accepted 2 | validateStore []
CONTROL C pipe in locator   : accepted 3 of 3

ARM pipe in a CLAIM id      distinct field by field: true
  bind(b1) ok · bind(b2) REFUSED: binding S1→ID-FA: duplicate (one entry counted twice is not two sources)
  validateStore(handed) ["binding S1→ID-FA: duplicate ..."]
  claimStanding THREW · publicView permit-all THREW
ARM pipe in a SOURCE id     distinct field by field: true
  bind(b1) ok · bind(b2) REFUSED: binding S1→v2|C1: duplicate ...
  validateStore(handed) 1 problem · claimStanding THREW · publicView THREW
```

One honest pair of bindings denies the whole projection, with a sentence naming
a duplicate that does not exist. A `|` in free LOCATOR text was always harmless
(CONTROL C); the trigger is a `|` in an ID, and `|` is this module's own
delimiter — `parties()` splits a two-party subject on it.

```
=========== ROW B — a RECORD carrying a prototype ===========
SOURCE own keys        ["schema","id","type","scope","provider","accessedAt"]
SOURCE sourceProblems  []            <- CLEAN, on a record whose url and title are INHERITED
SOURCE addSource       ACCEPTED
SOURCE published       {"s-proto":{... ,"url":"https://private.example/signed?token=SECRET", ...}}
CONTROL ordinary       publishes its own recordId, no url
JSON-revived           own key "__proto__", proto IS Object.prototype
                       -> ["source s-json: unknown key __proto__", "... not locatable"]
```

## MINE — the same shape at the other two record gates

bee-laborer's row named sources and deliberately left claims and bindings out,
calling a shared check a shape decision rather than a patch. Measured at
`05b8d93c`, both reproduce identically, and the claim is the sharper of the two:

```
--- CLAIM ---
own keys ["schema","id"]        claimProblems []        addClaim ACCEPTED
isPublicSubject was asked about ["P-LIVING"]   <- an id nobody wrote into the record
published {"c-proto":{... "subject":"P-LIVING","predicate":"birth","note":"PRIVATE", ...}}
--- BINDING ---
own keys ["schema"]             bindingProblems []      bind() ACCEPTED
published [{... "sourceId":"S1","claimId":"c-1","relation":"mentions","quote":"SECRET LETTER TEXT"}]
```

A claim's `subject` is the id the privacy layer is ASKED ABOUT, so an inherited
subject means the decision was taken about a party nobody wrote in. A binding
whose own keys are `["schema"]` alone carried its whole identity and its quote
from a prototype. So the repair is ONE check shared by the three record gates.

## The repair

- `validateStore`'s duplicate key: `JSON.stringify([sourceId, claimId, locator])`,
  joined rather than concatenated. **RESIDUAL, disclosed in the file:** JSON maps
  `undefined` and `null` to the same `null`, so two bindings differing only that
  way in one slot still join — and both are already named by `heldUnder` as not
  held / does not exist, so the duplicate sentence is never the only thing said
  about them.
- `foreignProto(o, at)`, called at the top of `sourceProblems`, `claimProblems`
  and `bindingProblems`. It **RETURNS rather than pushes**: every sentence below
  it is computed off the record's fields, and a verdict computed off an INHERITED
  field is the defect itself — the phantom-field half, one level in. In
  `sourceProblems` it sits ABOVE the lead check, because `s.type` may itself be
  inherited (P5 below).
- `null` is allowed for the reason it is at the store: `Object.create(null)`
  inherits nothing. The modality is **can**: an array carries `Array.prototype`
  and inherits no listed key, so it is now refused by this sentence instead of by
  its missing fields — a shorter true refusal, not a different verdict.
- DISCLOSED: `at` is built from the record's own id, which on this shape may
  itself be inherited. The sentence names the object by what it answers to and
  then says that is not its own, which is the honest pair.

## GREEN — the same probe at the candidate

```
ROW A   both arms ACCEPTED · validateStore [] · claimStanding ok · publicView publishes
ROW B   sourceProblems  ["source s-proto: carries a prototype, ..."]   addSource REFUSED
        claimProblems   ["claim c-proto: carries a prototype, ..."]    addClaim  REFUSED
        bindingProblems ["binding S1→c-1: carries a prototype, ..."]   bind      REFUSED
        published {} / {} / []          CONTROL ordinary source still publishes
        JSON-revived still named by unknownKeys — a different, more precise reason
```

## Mutation battery — 9 arms, verdicts DIFFED against a pristine TAP run

Byte-copy restore; landing asserted by byte inequality + old-absent +
new-present; the matcher REFUSES when it matches zero TAP rows of a non-empty
output. `.scratch/bopus5-226-battery.mjs`.

```
PRISTINE                                            40/40
K1 the key, concatenated exactly as found           39/40  the duplicate row   ALONE
K2 HALF the locator leaves the key                  39/40  the duplicate row   ALONE
K3 OFF-SWITCH the duplicate check never fires       38/40  the duplicate row + the PRE-EXISTING
                                                           "one entry bound twice is not two sources"
P1 sourceProblems stops asking                      39/40  the record row      ALONE
P2 claimProblems stops asking                       39/40  the record row      ALONE
P3 bindingProblems stops asking                     39/40  the record row      ALONE
P4 WRONG ANSWER null is not allowed either          39/40  the record row      ALONE
P5 WRONG ANSWER the lead check runs first           39/40  the record row      ALONE
P6 WRONG ANSWER the door refuses every record        2/40  38 rows, the whole battery
PRISTINE AGAIN 40/40 · reader byte-equal TRUE
```

`K2` is the half-arm: it proves the locator is part of the key, and it lands on
CONTROL C, where three bindings differ only inside free locator text. `K3` is the
off-switch and it is the arm that shows the guard is live — a row that is only
shown to catch a missing refusal has not been shown to catch a false one, and
`K1` is the false one. `P6` is blunt by construction: refusing every record
invalidates every store the suite builds, so it proves the helper can say YES and
nothing finer.

**The five P arms fall on the same ROW and on five different ASSERTIONS**, read
from the failure text rather than relayed:

```
P1  deepEqual: []  vs  ["source s-proto: carries a prototype, ..."]
P2  "the CLAIM gate must name the shape, and say nothing computed off an inherited field"
P3  "the BINDING gate must name the shape, and say nothing computed off an inherited field"
P4  deepEqual: ["source s-null: carries a prototype, ..."]  vs  []      <- the null CONTROL
P5  did not match /carries a prototype.../  Input: "source s-typed: a hint is a lead, not a source"
```

`P2` and `P3` were indistinguishable when first measured — both read `0 !== 1`
with no message, which is my own law arriving on me: **a row must assert WHICH
thing it caught, not that a catch happened.** Messages added, re-measured above.
`P5`'s input line is the phantom-verdict symptom in one string: at the parent the
module answered "a hint is a lead, not a source" off a `type` nobody wrote in.

## Counts, each at the tree that produced it

```
node --test tools/genealogy/source-contract.test.mjs     40 pass 0 fail rc=0   (38 before)
genealogy glob, exactly tests.yml:114-121                16 suites · 283 pass 0 fail · rc=0 (281 before)
```

283 belongs to THIS tree. No joint total is projected from it: a delta from one
tree added to a total from another is not arithmetic, and the joint figure
belongs to whoever runs the joint tree.

## Measured and NOT repaired, named so the boundary is disclosed

`duplicateAssessment`'s `topology` argument is the one remaining caller-supplied
object read by a bare index, and an inherited flag does produce a signal:

```
Object.create({ sharedParents: true })   own keys []   signals ["sharedParents"]
CONTROL {}                                             signals []
CONTROL { sharedParents: true }                        signals ["sharedParents"]
```

It is **not a record**: it carries no schema, passes no gate, and never
publishes — its output is `lead/investigate`, a status, and nothing there
reaches a stranger or a merge. It is outside the row as handed, and widening a
taken row is how a bounded repair becomes an architecture. Named for whoever
rules the file, not repaired here.

`F3` (quadratic `personSupport`) is still not in this branch, at the finder's
scoping.

## My own instrument

The first cut of the probe assumed `addSource` succeeded and crashed on the
refusal it was measuring — an rc from a crash is not a measurement. Re-cut so
every step reports through the same `tryIt`, and the GREEN run reads the
refusals as results rather than dying on them.

**MAINNET SPEND: 0.**

---

# ADDENDUM 4 — two rows handed over at `ff8746f6`, and the first is MINE

Appended, never retyped: everything above belongs to the head that produced it.
The `ff8746f6` verdicts in bee-laborer's re-read are pinned to that head and are
retired by this commit, which is what taking their rows costs.

Rows handed over by bee-laborer re-reading `ff8746f6`. **The standing is new: both
arrived WITH that commit and neither is pre-existing, and ROW A is a regression
of my own fix one head earlier.**

* **ROW A — the joined key lost the string coercion the store performs.** The
  store's maps are indexed by PROPERTY KEY, so a source held under `"5"` is the
  same source a binding names as `5`. `JSON.stringify([...])` keeps them apart.
  One entry bound twice was held twice and published as two bindings on one
  source.
* **ROW B — the record prototype check asks a prototype's IDENTITY where it
  means its SHAPE.** `=== Object.prototype` is realm-local; `node:vm` is a live
  idiom in this tree, and a cross-realm record — same own keys, same inherited
  surface, zero inherited data fields — was refused with a sentence that is
  false about it.

## RED — reproduced at `ff8746f6` before a line was written

A fix taken on a diagnosis I did not reproduce is a fix I cannot defend.

```
=== ROW A: numeric vs string ids, the SAME entry ===
bind {'5','7','p. 4'}                          "accepted"
bind { 5 , 7 ,'p. 4'}  SAME entry              "accepted"      <-- one entry, twice
bindings held                                  2
validateStore                                  []
publicView sources/bindings                    [1,2]           <-- one source, two bindings
CONTROL 3 bindingProblems(numeric)             []              <-- the ids really do resolve
locator '0' then 0, same entry                 "accepted both"
CONTROL 1 genuine dup both strings             THREW: binding 5→7: duplicate (one entry counted twice is not two sources)
CONTROL 2 genuine dup both numbers             THREW: binding 5→7: duplicate (one entry counted twice is not two sources)
CONTROL 5 two genuinely distinct               2
CONTROL delimiter pair (their fix)             2
CONTROL claimStanding sees the numeric bind?   {"standing":"unsupported","mentions":[]}

=== ROW B: cross-realm plain record ===
own keys identical                             true
inherited DATA fields   local / vm             [[],[]]
proto === Object.prototype   local / vm        true / false
sourceProblems(local plain)                    []
sourceProblems(vm plain)                       ["source s-vm: carries a prototype, so a field
                                                 nobody wrote into this record can read as its own..."]
CONTROL poisoned DATA field                    refused, correctly
CONTROL null-proto record                      []
CONTROL array                                  refused, correctly
```

Their scope note on `claimStanding` reproduces and is sharper than it looks: it
filters `b.claimId === claimId` without coercing, so the numeric-id binding was
held AND published AND invisible to standing — three readings of one entry.

## MEASURED BEFORE BUILDING — their remedy, and what it takes away

Their preview was `String()` on all three parts. Measured rather than adopted:

```
                       String(v)                          JSON.stringify([v])
plain object           "[object Object]"                  "[{}]"
null-proto object      THREW: cannot convert to primitive "[{}]"
symbol                 "Symbol(x)"                        "[null]"
bigint                 "10"                               THREW: do not know how to serialize
null / undefined       "null" / "undefined"               "[null]" / "[null]"
```

Two findings that decided the shape of the repair:

1. **For the two IDS, `String()` adds no failure mode at all, because the line
   above already did it.** `at` is built as `` `binding ${b?.sourceId}→${b?.claimId}` ``
   one line into `bindingProblems`, and a template literal coerces: a null-proto
   id and a symbol id BOTH throw there, before the key is ever computed
   (measured, including through the early-return path). So coercing the ids is
   not a new coercion — it is the SAME one the refusal sentence already
   performs, and the same one the store performs. A **bigint** id threw at the
   key before this commit and no longer does.
2. **For the LOCATOR it is not free.** The locator is not a map key. It reaches
   the key line uncoerced today, and `String()` there would (a) turn a held
   binding carrying a null-prototype locator into a thrown `TypeError`, and (b)
   join every two distinct object locators on `"[object Object]"`. So the
   repair coerces primitives and leaves objects and symbols to JSON exactly as
   they were — one line, and the direction of its mistakes checked both ways.

**Third round running in which measuring the handed remedy changed the answer.**

## GREEN

```
part coerces primitives, leaves objects/symbols to JSON

bind {'5','7'} then { 5 , 7 }   REFUSED: binding 5→7: duplicate (one entry counted twice ...)
bindings held                   1
publicView sources/bindings     [1,1]
locator '0' then 0              REFUSED
CONTROL genuine dup, strings    REFUSED      CONTROL genuine dup, numbers  REFUSED
CONTROL two distinct entries    2            CONTROL delimiter pair        2

plainChain: no prototype, or ONE level carrying exactly Object.prototype's names
sourceProblems(vm plain)        []
CONTROL poisoned DATA field     refused      CONTROL array        refused
CONTROL null-proto record       []           CONTROL local plain  []
```

## What makes the widening bounded, and why it is a row and not a paragraph

The accepted set grew from "is Object.prototype" to "carries exactly
Object.prototype's names, one level deep". That is sound only because **no key
this module reads is among those twelve names** — measured: the read set is
`SOURCE_KEYS ∪ CLAIM_KEYS ∪ BINDING_KEYS ∪ {kind}` and the intersection is
empty. Put a listed key on such a prototype and the name set stops matching.

I did not write that as a list comparison, because **a list compared to the
prototype's names is satisfied by an EMPTY list** — the row would survive its own
gutting. It is written as a mechanism instead: build the most hostile chain the
check accepts (a null-prototype object carrying every one of the twelve names,
each poisoned) and require all three gates to answer **exactly as they answer for
an ordinary record**, with a control that giving that same chain ONE name of its
own makes every gate refuse it. Add a schema key named like a member of
`Object.prototype` and that row falls.

## Mutations — 10 arms, verdicts DIFFED against a pristine TAP run, restored byte-equal

```
PRISTINE                                             43/43
C1 OFF-SWITCH    the key stops coercing, as found    42/43   the coercion row ALONE
C2 HALF          the LOCATOR leaves the coercion     42/43   the coercion row ALONE
C3 HALF          the SOURCE id leaves the coercion   42/43   the coercion row ALONE
C4 WRONG ANSWER  every object coerced too            42/43   the coercion row ALONE
C5 WRONG ANSWER  only PLAIN objects coerced          42/43   the coercion row ALONE
S1 OFF-SWITCH    the prototype test asks IDENTITY    41/43   the realm row + the bound row
S2 WRONG ANSWER  the DEPTH half is dropped           42/43   the realm row  ALONE
S3 WRONG ANSWER  how MANY names, not which           42/43   the realm row  ALONE
S4 WRONG ANSWER  every shape is plain                40/43   3 rows
S5 WRONG ANSWER  null is refused too                 41/43   2 rows
PRISTINE AGAIN 43/43 · reader byte-equal
```

The five C arms fall on ONE row at **four** distinct assertions, read from the
failure text and not from the row name:

```
C1  Missing expected exception: a numeric id names the record the string id names,
                                so this is one entry bound twice
C2  Missing expected exception: the LOCATOR is part of the key and is coerced with the ids
C3  (same assertion as C1 — C3 is a HALF of C1 and cannot discriminate from it;
     reported as it came rather than dressed up)
C4  Got unwanted exception: an OBJECT locator is left to JSON, never coerced into a throw
C5  Got unwanted exception: two DISTINCT object locators are two entries
```

**C4 and C5 are the arms that earn the escape hatch its own row.** An escape
hatch owes its own mutation, and this one has two, because its two mistakes
point in opposite directions: coercing everything CRASHES on a null-prototype
locator, and coercing plain objects only JOINS two distinct ones.

**S2 and S3 are what make the two halves of `plainChain` both load-bearing**, and
each has a fixture built for it and falls at its own message:

```
S2  a masking chain one level deeper hides a field the name set cannot see
    fixture: Object.create(masked) where masked's OWN names are exactly
    Object.prototype's twelve and masked itself inherits `url` -- the field is
    reachable (asserted) and only the DEPTH half refuses it
S3  a realm that traded a name for a field of its own has the same COUNT and a
    different SET
    fixture: a vm realm that DELETES Object.prototype.toLocaleString and adds
    `url` -- twelve names either way (asserted) and only the NAME half refuses it
```

**S1 falls on two rows and the second is a precondition, not a second catch:**
under the identity test the hostile-chain fixture stops being accepted at all,
so the bound row's own precondition (`the chain is accepted`) is what fails.
Stated rather than counted as coverage.

## MEASURED AND NOT REPAIRED

`nonDataAt` makes the same identity test on VALUES, twice, and a cross-realm
value is refused by both:

```
local [1,2,3]        published
cross-realm [1,2,3]  THREW: ... not data (value: array subclass)     <- false about it
local {a:1}          published
cross-realm {a:1}    THREW: ... not data (value: Object object)
```

Unchanged in both directions by this commit. It is the same class as ROW B and
it is **not** the row I was handed: it fails CLOSED — a legitimate value is not
published — where the record check failed a RECORD with a false sentence, and
widening what may be PUBLISHED on a privacy path is not a repair to take
unasked. Disclosed at the line so the two forms in one file do not read as an
oversight, and named here for whoever rules the file.

**F3 is still not in this branch**, at bee-laborer's scoping.

## My own instruments

* `grep -E "^. (tests|pass|fail)"` over the glob output matched **nothing**, and
  `rc=0` alone would have read as a clean run. node's `ℹ` is three bytes and `^.`
  matches one — **the third time this format has beaten a matcher on this lane in
  two days**, twice for bee-laborer and now twice for me, both times AFTER it was
  banked. `^.{0,3}` is still not enough (the mark plus a space is four), and the
  remedy that generalises is the one already banked and not yet installed: **a
  matcher refuses when it matches zero lines of a non-empty file.** The battery
  does exactly that and prints `INSTRUMENT REFUSES` rather than a verdict; my
  shell did not, and reading the empty output is what caught it.
* An unterminated heredoc (I closed a `<<'NEWEOF'` with `OLDEOF`) swallowed the
  node command that was to apply the patch. Nothing landed and nothing was
  damaged — the module was byte-identical afterwards, checked — but the shell
  reported only a warning and the *absence* of the patch is what said so.
  Anchors and replacement text go through a file written with a real writer, not
  a heredoc, which is a law I had already banked for backslashes and had not
  extended to delimiters.
* My first cut of the object-locator control bound the two plain-object locators
  to DIFFERENT claims, so their keys differed on the claim and the join
  direction was never exercised. The arm that exists to catch a false join was
  passing for a reason that had nothing to do with joining; re-cut onto one
  claim, and C5 then fell on it.

**MAINNET SPEND: 0.**

---

## ADDENDUM 5 — bee-laborer's two rows at `14528dee`, taken and repaired

Base `claude-LoVis/source-contract` @ `619e809c` (still an ancestor: the lane
merge is a fast-forward). Parent `14528dee`. Both rows are this branch's own:
the first is the id half of the coercion this branch shipped, the second is the
locator hatch it shipped beside it.

### RED — reproduced at `14528dee` before a line was written

ROW A, `part` exempting objects for the two IDS, both directions live at once:

```
PRECONDITION bindingProblems(objS1 -> objC1)          []      <- the ids really do resolve
MISSED DUPLICATE   bind string form then object form  accepted, bindings 2
                   validateStore []   publicView PERMIT-ALL: sources 1, bindings 2
FALSE DUPLICATE    bind oS1->C1 then oS2->C1          REFUSED
                   "binding S2→C1: duplicate (one entry counted twice is not two sources)"
CONTROL genuine duplicate, string form                REFUSED
CONTROL genuine duplicate, the SAME objects twice     REFUSED
CONTROL object id naming a ghost source               REFUSED "source S-ghost is not held"
CONTROL two DISTINCT string sources                   2
```

ROW B, the locator hatch, by shape. **My first table was invalid and the fault
was mine**: both locators came from one nullary factory, so the "second,
DISTINCT" case was byte-identical and every shape read as a false duplicate — a
probe whose distinct case is not distinct manufactures the exact finding it is
hunting, which is the trap bee-laborer had named in the same message. Re-cut as
`mk(i)`, with `a !== b` asserted:

```
shape                       at 14528dee
plain object                1st ok / 2nd ok
null-prototype object       1st ok / 2nd ok
cross-realm plain object    1st ok / 2nd ok
FUNCTION locator            1st ok / 2nd ok     <- not in their table: typeof is
                              "function", so `part` STRINGS it and the source text keys
CIRCULAR object             THREW TypeError at the door
object holding a BigInt     THREW TypeError at the door
Symbol                      1st ok / 2nd FALSE DUPLICATE
object toJSON -> undefined  1st ok / 2nd FALSE DUPLICATE
CONTROL genuine object-locator duplicate            REFUSED
```

And the worse half, a store that already HOLDS one:

```
bindingProblems(b, store)   []                 <- the exported door says CLEAN
validateStore               THREW TypeError: Converting circular structure to JSON
claimStanding               THREW TypeError
personSupport               THREW TypeError
publicView                  THREW TypeError
CONTROL ordinary string locator: validateStore [] · publicView 1 binding
CONTROL plain object locator:   validateStore []
```

### The remedy, chosen by measurement — a cost table, not two options

Fourteen shapes, three candidate forms, the real `nonDataAt` for form A.
`JOINS**` = two distinct locators, one key. `SPLITS**` = one locator, two keys.

```
shape                       HEAD      A nonData B sym+try  C serialise
ordinary string             ok        ok        ok         ok
number                      ok        ok        ok         ok
plain object                ok        ok        ok         ok
null-prototype object       ok        ok        ok         ok
cross-realm plain object    ok        refused   ok         ok
cross-realm ARRAY           ok        refused   ok         ok
local array                 ok        ok        ok         ok
CIRCULAR object             THROWS    refused   refused    refused
object holding a BigInt     THROWS    refused   refused    refused
Symbol                      JOINS**   refused   refused    refused
object toJSON -> undefined  JOINS**   refused   JOINS**    refused
FUNCTION locator            ok        refused   ok         ok
Date                        ok        refused   ok         ok
CONTROL identical locators  one key   one key   one key    one key
```

- **Form A, `nonDataAt`** — bee-laborer measured ONE cost (a cross-realm plain
  object). Measured here it is **four**: a cross-realm plain object, a
  cross-realm array, a **Date** and a **function** locator, all of which key
  correctly today. Three of those four have nothing to do with realms. And the
  first of them is the realm-local identity defect this branch's own parent
  repaired one function over — a remedy that re-creates the defect it sits
  beside is not the remedy.
- **Form B, symbol-by-name plus try/catch** — leaves `toJSON -> undefined`
  joining, which is the shape bee-laborer's own table shows unchanged at both
  heads.
- **Form C, taken** — serialise the locator ALONE and judge the serialisation.
  A value JSON cannot express, or expresses as nothing, cannot carry an
  identity; everything else joins on its own JSON text. One mechanism closes
  all four live classes, refuses nothing that keys today, and makes the key
  **total**: the outer `JSON.stringify` now sees three strings and cannot throw.

Its refusal sentences, each carrying the cause:

```
CIRCULAR object              locator cannot be part of a duplicate key -- Converting circular structure to JSON
object holding a BigInt      locator cannot be part of a duplicate key -- Do not know how to serialize a BigInt
Symbol                       locator does not survive serialisation, so two distinct locators would join
object toJSON -> undefined   locator does not survive serialisation, so two distinct locators would join
```

The check sits in `bindingProblems` as well as at the key, because the
disagreement WAS the row: the exported door returned clean for a binding every
keying gate died on. `validateStore` says it once and then `continue`s, so an
unkeyable locator joins nothing rather than joining everything.

**Disclosed, unchanged:** JSON text is key-ORDER sensitive, so `{a:1,b:2}` and
`{b:2,a:1}` are two entries. That was true of the join before this commit and
is not what this row repairs. Nesting the locator's JSON text adds no join,
because JSON quotes strings — asserted by a control binding the object `{page:4}`
and the string `{"page":4}` and requiring two entries.

### GREEN — 10 arms, verdicts DIFFED against a pristine TAP run

```
PRISTINE                                                  45/45   fell 0
J1 OFF-SWITCH  the id exemption exactly as found          44/45   the ids row     ALONE
J2 HALF        only the CLAIM id leaves the coercion      43/45   ids row + the PRE-EXISTING numeric row
J3 WRONG ANS   ids keyed by JSON, not by ToString         43/45   ids row + the PRE-EXISTING numeric row
L1 OFF-SWITCH  the exported door stops saying it          44/45   the locator row ALONE
L2 OFF-SWITCH  an unkeyable binding is keyed, not skipped 44/45   the locator row ALONE
L3 HALF        the THROW class stops being caught         44/45   the locator row ALONE
L4 HALF        the SERIALISES-TO-NOTHING class stops      44/45   the locator row ALONE
L5 WRONG ANS   every object locator is refused            42/45   3 rows
L6 WRONG ANS   nonDataAt, the measured alternative        44/45   the locator row ALONE
L7 WRONG ANS   the door refuses every locator             18/45   27 rows
PRISTINE AGAIN                                            45/45   reader byte-equal
```

Six arms, one row, **five distinct assertions**, read from the TAP failure body:

```
L1  a locator carrying a cycle is refused rather than ACCEPTED
L2  one sentence each / 3 !== 2      <- the third sentence is the duplicate that must not exist
L3  a cycle: refused BY NAME, not by crash (got Converting circular structure to JSON)
L4  a locator carrying a symbol is refused rather than accepted
L5  Got unwanted exception: a cross-realm plain object is a keyable locator
L6  a cycle: and the sentence carries the cause
```

**J1 / J2 / J3 do NOT discriminate inside the ids row** — all three land on the
same assertion there. What separates them is the OTHER row: J2 and J3 also red
the pre-existing numeric-id row, J1 does not. Reported as it came.

**L6 is weaker than it looks and the file does not pretend otherwise.** Form A
refuses the cycle too, just with a different sentence, so the arm falls at the
first assertion and the CONTROL half of the row never runs — that arm cannot
show form A's cost. **L5 is the arm that shows it**, because it is the same
over-block shape and falls on a control by name ("a cross-realm plain object is
a keyable locator"). The full cost is the table above, not L6.

### Two instruments of mine, both caught by something other than reading them

- **`/duplicate/` is satisfied by the refusal's OWN wording.** My new "two
  unkeyable bindings are not a duplicate of each other" assertion failed against
  my own repair, because the refusal says "duplicate **key**". Re-cut to name
  the duplicate SENTENCE (`/duplicate \(one entry counted twice/`), not the word
  it shares with the thing it is asserting absent. The row caught it.
- **`assert.throws` with a regex makes a following `not a TypeError` assertion
  a row nothing plays.** When the regex misses, `assert.throws` is itself the
  failure and the next line never runs — so the assertion that exists to
  separate a refusal from a crash could only fire in a case that cannot happen.
  Re-cut to catch by hand and ask the three questions separately: was it refused
  at all, was it a refusal rather than a crash, does the sentence carry the
  cause. L3 is the arm that now falls on the middle one, naming the TypeError.
- **A mutation must keep the code RUNNING, not merely LOADING.** My first L2
  assigned to an undeclared `text` inside `validateStore`; the module loaded and
  then every gate threw a ReferenceError, so the arm "fell" on the first
  assertion of the row for a reason that had nothing to do with the mechanism.
  Re-cut as `lk.text = null`, which is the behaviour the `continue` prevents.
- The battery read node's multi-line `error: |-` block as the literal string
  `|-`, so two arms reported a fall with **no reason attached**. A verdict line
  that names nothing is the same defect as a count that names nothing. Parser
  re-cut to take the indented block.

### CHANGED

```
2 files, tools/genealogy/source-contract.mjs +81/-16 and its battery +167/-0
node --test source-contract.test.mjs      45 pass 0 fail rc=0   (43 before)
genealogy glob, tests.yml:115-121         16 suites, 288 pass 0 fail, rc=0 read
                                          BEFORE any pipe       (286 before)
288 belongs to THIS tree. No joint total is projected from it.
importers tree-wide: 0
is-shallow FALSE read before any ancestry question
```

**MAINNET SPEND: 0.**
