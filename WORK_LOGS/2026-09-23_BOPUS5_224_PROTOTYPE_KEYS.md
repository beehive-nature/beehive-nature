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
