# POST-OP NOTE — COWORK · LEAF-CONTENT STRUCTURE (the untested axis)
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: `canon()` AS WRITTEN IS NOT INJECTIVE. Two distinct collisions reproduced.
The leaf is not a commitment unless the encoding changes.**

---

## PRE-OP STATE
Leaf-content structure was the one genuinely untested axis, named-not-claimed across
several post-ops. The R6 suite uses synthetic `sha256(0x00‖i)` leaves; real leaves are
`canon(record)‖sig` with attacker-influenced `name` and `payload`.

## PROCEDURE PERFORMED
Read the actual `canon()` — `b"|".join([name, owner, revision, signed_at, expires_at,
prev_signed_at, payload])` — and tested injectivity directly, rather than testing the
hash over it. Then built both attacks as in-suite negative controls and extended
`tests/r6/`.

## SEATS PRESENT
**Cowork** — analysis, attacks, suite extension, this note. (LAW 8c.)

## FINDINGS

**F1 — ⛔ COLLISION A: with an unvalidated `name`, `canon()` is not injective.**
The fixed middle (owner ‖ rev ‖ 3 timestamps + separators) is **66 bytes**. A record can
absorb it:

```
A: name = b"a"          payload = MIDDLE + b"z"
B: name = b"a" + MIDDLE payload = b"z"

names differ    : True
payloads differ : True
canon() EQUAL   : True      <-- DISTINCT RECORDS, IDENTICAL BYTES
leaf hash EQUAL : True
```

**A signature over `canon(A)` is a valid signature over `canon(B)`.** The leaf commits to
the *bytes*, not the *record*.

**F2 — ⭐ COLLISION B: charset validation does NOT fix this — it only postpones it.**
The obvious defence is the spec's `[a-z0-9-]{1,32}`, which blocks Collision A. But it
holds **only while `payload` is the LAST field.** Append any field — a memo, a tag, a
version — and the collision returns with **fully charset-valid names**:

```
C: payload = b"X|Y"  memo = b"memo"
D: payload = b"X"    memo = b"Y|memo"

canon() EQUAL = True        <-- and BOTH names pass [a-z0-9-]{1,32}
```

**`canon()`'s injectivity depends on two invariants that nothing in the code records:**
name validation happens before hashing, **and** payload stays the last field forever.
**A schema addition — the most ordinary change imaginable — silently breaks the
commitment.** Nobody adding a memo field would think they were touching signature
security.

**F3 — Length-prefixed encoding is injective UNCONDITIONALLY.** Same records, `<u32 len>‖
field` per field: **no collision, under either attack, with or without charset
validation, with or without trailing fields.** No validation dependency, no ordering
dependency.

**F4 — Second-preimage over the record: no hit.** 768 attacker-controlled payloads
against a chosen target leaf under the safe encoding — target never reached. Expected,
and now measured rather than assumed.

**F5 — 8 structural classes of a REAL leaf enumerated and all distinct** (LAW 8p):
minimal name, max-length name (32), hyphenated, empty payload, 4 KiB payload, payload
containing the separator, payload of NUL bytes, and **payload equal to the fixed
middle** — the class that produces Collision A.

## SPECIMENS
- `tests/r6/canon.py` — both encodings; the vulnerable one kept deliberately per 8r.
- `tests/r6/test_canon.py` — **15/15**, including both collisions as required-to-reproduce
  controls. Standalone exit 0. `tests/r6/test_r6.py` still exit 0.

## COMPLICATIONS

**C1 — THIS IS A SPEC DEFECT, NOT A TEST FINDING, AND IT IS NOT MINE TO FIX.** `canon()`
is defined in `SPEC_RESOLVER_VALIDITY_RULES` (R1: *"Ed25519 over
canonical(name|owner|revision|signed_at|expires_at|prev_signed_at|payload)"*). **The
pipe-separated form in the spec text is exactly the vulnerable construction.** goose owns
R1; the fix is one line — **mandate length-prefixed field encoding** — and it should carry
the reasoning per 8t, because the safe-looking alternative (add charset validation) leaves
a landmine for the next person who appends a field.

**C2 — My own harness has been using the vulnerable encoding all along**, including in the
lifecycle re-run and the on-chain anchors at epochs 1000145–1000149 and 146. **Those runs
remain valid as tests of what they tested** — ordering, inclusion, lifecycle verdicts —
none of which depend on `canon()` injectivity. **But no run so far has demonstrated that a
leaf commits to its record.** Stating the blast radius precisely rather than implying
either more or less than is true.

**C3 — Collision A requires an invalid name; Collision B requires a schema change that
has not happened.** Neither is exploitable against the current deployed shape **today**.
**That is not a reason to defer it** — the cost of changing the encoding rises with every
implementation written against it, and the failure mode is silent.

**C4 — I did not test `sig` malleability**, only `canon()`. Ed25519 has known
malleability considerations at the signature level; whether the leaf's `‖sig` suffix
introduces a second path to the same leaf is **untested and unpredicted**.

**C5 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched;
`banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **`canon()` as specified is not injective. Two distinct records can share a leaf.**
   Both attacks reproduce on demand in `tests/r6/test_canon.py`.
2. **goose owns the fix: mandate LENGTH-PREFIXED field encoding in R1.** Do **not** fix it
   with charset validation alone — that leaves the trailing-field collision live and
   invisible.
3. **Charset validation remains worth having**, but it is a *validation* rule, not an
   *encoding* property. Do not let it be mistaken for the fix.
4. **The suite now fails if either collision stops reproducing** (8r), so the fix cannot
   quietly become unproven.
5. **New untested axis, named not claimed:** `sig` malleability at the leaf boundary (C4).
   Scale beyond N = 2^20 and the influence-which-names-get-registered adversary remain
   open. No predictions offered on any of them.
