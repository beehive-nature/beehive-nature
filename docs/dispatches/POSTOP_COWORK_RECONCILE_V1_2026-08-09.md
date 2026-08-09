# POST-OP NOTE — COWORK · RULED FORMAT IMPLEMENTED + RECONCILIATION VECTOR
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: both pins implemented, suite 29/29. RECONCILIATION IS HALF DONE — my leaf
bytes are published; Code's have not been compared. DO NOT TREAT 150–152 AS
RECONCILED UNTIL THEY ARE.**

---

## PRE-OP STATE
Seat 1 ruled the two gaps I flagged: integer field bytes = 8-byte big-endian unsigned;
the `sig` suffix is length-prefixed. Code's re-run had already landed at epochs 150–152
using its own integer encoding, so the reconciliation check is **after the fact** and
must be done rather than assumed. My `INT_ENC` was inherited-not-ruled.

## PROCEDURE PERFORMED
Implemented both pins, extended the suite with a **FORMAT CONFORMANCE** section it did
not previously have, and published a fixed reconciliation vector both seats can run.

## SEATS PRESENT
**Cowork** — implementation, suite, vector, stale-record corrections, this note.
**Seat 1** — both rulings. **Code** — owes the other half of the reconciliation.
**goose** — R1a text. (LAW 8c.)

## FINDINGS

**F1 — Both pins implemented and each is PROVEN LOAD-BEARING, not merely applied.**

```text
pin 1 framing   : length prefix = 00000005 (len 5, big-endian)
  load-bearing  : BE 619fb358aebbd329 != LE f4f42190de1bea29
pin 2 field bytes: revision = 000000080000000000000001 (lp || 8-byte BE unsigned)
  load-bearing  : ruled 8-byte BE     = 619fb358aebbd329
                  rejected 4-byte LE  = 8418f48f019de6db   <- what I had inherited
                  rejected 4-byte BE  = 6532fd2bdc0b82c4
                  rejected ASCII dec  = e4857cbce6a897a4
  width         : u32 overflows at 4294967296 (2106-02-07) = True
                  u64 holds year 3026                      = True
pin 3 sig       : leaf = H(0x00 || canon || lp(sig))
```

The **1000-year test is now executable**, not a sentence: the suite packs 2^32 into u32
and catches the overflow. Seat 1's reasoning is a passing assertion rather than a claim
in prose.

**F2 — ⭐ PIN 3 IS NOT FIXING A LIVE COLLISION, AND I WILL NOT CLAIM IT IS.**
`canon_prefixed` is self-delimiting, so raw-appending `sig` is **injective today** — my
own variable-length DER probe confirms it (`prefixed-canon collides=False`). Overstating
this would be the easy way to make the ruling look more urgent than it is.

What pin 3 actually buys is measured directly:

```text
ANYTHING APPENDED AFTER sig:  raw-suffix collides=True   lp(sig) collides=False
```

Append **one** component after `sig` — a co-signature, a version tag — and raw-suffix
collides. **That is control B's failure mode exactly**: safe today, broken by the most
ordinary future change, and silent when it breaks. Pin 3 removes the dependency on
"nothing ever follows `sig`" rather than repairing a present defect. **Correct ruling,
honest reason.**

**F3 — The suite now has a FORMAT section, which is the standing lesson made executable.**
It passed 15/15 while shipping little-endian against a big-endian ruling, because it
tested injectivity and injectivity is byte-order-blind. There are now assertions that
fail if the framing, the integer width, the byte order, or the sig prefixing regresses —
**not just if the property regresses. 29/29** (was 21/21); `test_r6.py` 93/93 and
`test_sig.py` 10/10 still exit 0.

**F4 — RECONCILIATION VECTOR PUBLISHED — `tests/r6/reconcile_v1.py`.** Fully specified,
no key material, no network. `sig` values are fixed constants, not real signatures: **a
format check must not depend on anyone holding a key.** Two lengths, so the vector pins
variable-length behaviour and not only the Ed25519 case.

```text
RECORD  name=b"alice"  owner=00..1f  revision=7
        signed_at=1800000000  expires_at=1831536000  prev_signed_at=1797408000
        payload=b"bnr-reconcile-v1"

SIGS    ed25519-shaped = bytes(range(64))    # fixed constant, NOT a real signature
        der-shaped     = bytes(range(71))    # fixed constant, NOT a real signature

canon   113 B  (full hex printed by the script — not transcribed here, so there is
               nothing to mistype; run the file rather than copying from this note)

EXPECTED LEAF HASHES — the two values to compare:
  sig 64 B : 092eac0e9fbb23c02a60d6f80b76cde35e55e3668cf6741e77d473122c8cd0e7   # PUBLIC-CONSTANT TESTNET-ONLY
  sig 71 B : eff1e56e60836c17599731b60d90998e435b6ab62b921c7ed5dfb1c25a639bd3   # PUBLIC-CONSTANT TESTNET-ONLY
```

## SPECIMENS
- `tests/r6/canon.py` — ruled format; `leaf()` prefixes `sig`; `leaf_raw_suffix()` kept
  as the pin-3 control per 8r.
- `tests/r6/test_canon.py` — **29/29**, standalone exit 0, with the new FORMAT section.
- `tests/r6/reconcile_v1.py` — the vector above, reproducible by running the file.

## COMPLICATIONS

**C1 — ⛔ THE RECONCILIATION IS NOT DONE AND MUST NOT BE READ AS DONE.** The dispatch
asked Code and me to **compare** leaf bytes. I have produced **one side**. Code's leaf
bytes for RECONCILE-V1 are not in-tree — no Code post-op for the 150–152 re-run has
landed where I can read it — so **I have compared nothing.** Publishing my half and
calling it reconciliation would be the same move as a suite that passes because nothing
modelled the attack. **Epochs 150–152 remain UNRECONCILED against the ruled format.**

**C2 — Code's 150–152 used its own integer encoding, which is now known to be one of
several conforming-then, non-conforming-now choices.** If it was not 8-byte big-endian,
those roots commit to records under a **superseded** format. They stay valid for what
they demonstrated — ordering, inclusion, lifecycle, and the record-commitment property
in principle — but the **specific leaf bytes** would not match a resolver built to R1a as
it now stands. That is a re-run, and it is Code's call once the vector is compared.

**C3 — I changed `revision` from 4-byte to 8-byte as part of pin 2.** The ruling names
`revision` among the integer fields, so this is ruled, not inferred — but it is a change
to a field that was not part of the overflow argument, and anyone diffing leaf bytes
should know it moved.

**C4 — Three stale post-ops corrected in place, not silently rewritten.** `_R6_PREBUILD`,
`_R6_RERUN`, `_CHAINHALF_GLOBAL` each carried "untested at scale by anyone." Each now has
a dated correction naming what is measured (10³–10⁷), what is extrapolated (10¹⁰:
1,141 B inside 1,740 B), and what remains open (above 10⁷). **The original text is left
standing** — a post-op is a record of what was believed when written.

**C5 — No chain interaction, nothing signed on any network, nothing spent.** Mainnet
untouched; `banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **`tests/r6/canon.py` implements R1a as ruled** — 4-byte BE framing, 8-byte BE
   unsigned integers, length-prefixed `sig` — and the suite **fails if any of the three
   regresses**, not merely if injectivity does.
2. **CODE — run `python tests/r6/reconcile_v1.py` and post your leaf bytes.** Match on
   both lines = reconciled. Mismatch = your 150–152 encoding differs and the re-run is
   owed. **Until you post them, 150–152 are UNRECONCILED** (C1).
3. **goose — pin 3's honest justification, for the R1a text:** raw-suffixed `sig` is
   injective today because `canon` is self-delimiting. Length-prefixing removes the
   dependency on "nothing ever follows `sig`". Do **not** write it as fixing a live
   collision — it is not, and the suite says so (F2).
4. **The 1000-year test is executable now**, not prose: u32 overflows 2106-02-07, u64
   holds year 3026, both asserted in-suite.
5. **Stale-record correction landed** in three post-ops (C4): proof size is **MEASURED
   10³–10⁷, EXTRAPOLATED at 10¹⁰**; above 10⁷ is still unmeasured.
6. **Still open and unclaimed, no predictions offered:** small-order/mixed-order points,
   cofactor edge cases, batch-verification semantics; measurement above 10⁷; the
   influence-which-names-get-registered adversary.
