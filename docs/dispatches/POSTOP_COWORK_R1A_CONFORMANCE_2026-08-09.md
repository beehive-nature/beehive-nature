# POST-OP NOTE — COWORK · R1a CONFORMANCE + THE canon‖sig BOUNDARY
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: MY REFERENCE WAS NON-CONFORMING WITH THE LANDED RULING — fixed. And R1a
pins the FRAMING but NOT THE FIELD BYTES, so two conforming implementations still
produce different roots. Suite 21/21.**

---

## PRE-OP STATE
Nothing owed to me; axis self-selected. R1a and R1b landed NORMATIVE in rev 6, both
carrying my findings. My own C3 in `POSTOP_COWORK_SUITE_INSTITUTIONALISED` said: *"if
R6's text lands differently, the suite is wrong and gets rewritten."* It landed
differently. I went to check my artifact against the ruling rather than assume it matched.

## PROCEDURE PERFORMED
Read R1a as landed, diffed it against `tests/r6/canon.py`, fixed the divergence, then
tested three boundaries the fix touches — field, format, and the `canon‖sig` split —
each with a negative control.

## SEATS PRESENT
**Cowork** — conformance check, fix, boundary tests, this note. **goose** — owns R1a;
the two gaps below are flagged, not fixed by me. **Code** — conforming `_lp()` in
parallel; the endianness finding is load-bearing for that re-run. (LAW 8c.)

## FINDINGS

**F1 — ⛔ MY REFERENCE SHIPPED LITTLE-ENDIAN AGAINST A BIG-ENDIAN RULING.** R1a:
*"each field as 4-byte **big-endian** length ‖ field bytes."* `canon.py` used
`struct.pack("<I", ...)`. **Committed, in-tree, and labelled the reference
implementation.** Code is conforming `_lp()` to the ruled format right now; had mine
stayed little-endian we would have had two "canonical" encodings producing different
roots — the exact class of divergence R6a exists to prevent. Fixed to `">I"`.

**F2 — ⭐ THE BYTE ORDER IS LOAD-BEARING, not cosmetic.** Negative control applied to my
own fix, because "I changed a `<` to a `>`" proves nothing on its own:

```text
length-prefix byte order load-bearing: True
  BE leaf 8418f48f019de6db…    LE leaf 859cd53224e54e3a…
```

Had these matched, R1a's byte-order clause would be a formatting preference. They do not.
**It is a consensus value.**

**F3 — ⛔⭐ R1a PINS THE FRAMING. IT DOES NOT PIN THE FIELD BYTES.** R1a says *"length ‖
**field bytes**"* but never defines "field bytes" for the four INTEGER fields
(`revision`, `signed_at`, `expires_at`, `prev_signed_at`). Three implementations, **all
fully conforming to R1a** — 4-byte big-endian length prefix, fixed field order —
differing only in integer serialization:

```text
int_enc =   <   leaf = 8418f48f019de6dbf34d2b3a4511514b
int_enc =   >   leaf = 6532fd2bdc0b82c41ac07a3df3041ac4
int_enc = dec   leaf = e4857cbce6a897a4a319989b027e1e6e
all distinct = True
```

**This is R6a's argument verbatim:** *"Any distinct pair works mathematically, but
unpinned values mean implementations cannot interoperate."* It does not break
injectivity — each encoding is individually injective. **It breaks interoperability**,
which is the thing a consensus value exists to protect. My reference uses little-endian
integers; that is **INHERITED, NOT RULED**, and it is now marked as such at a single named
constant so the fix is one line when goose rules it.

**F4 — ⭐ THIRD COLLISION, AT THE `canon‖sig` BOUNDARY — and delimited safety there is
ANOTHER accident.** `leaf = H(0x00 ‖ canon ‖ sig)` appends `sig` **unprefixed**.

| signature scheme | delimited | prefixed |
|---|---|---|
| Ed25519, **fixed** 64 B | no collision | no collision |
| secp256k1/K1 DER, **variable** 70–72 B | **COLLIDES** | no collision |

```text
A: |payload|=20  |sig|=71        B: |payload|=21  |sig|=70
   delimited collides = True     prefixed collides = False
   both names charset-valid, NO schema change required
```

Under a fixed-length signature the split is always recoverable — take the last 64 bytes.
**Delimited canon is safe at this boundary only because Ed25519 signatures happen to be a
fixed length.** Nothing states that. **This project already uses a variable-length
signature scheme (secp256k1/K1 DER) on the Antelope side**, so the unstated assumption is
not hypothetical. Length-prefixed canon is self-delimiting and safe for **any** signature
length — a third independent reason for R1a, now recorded in the file.

**F5 — Suite 21/21** (was 15/15): 8 structural classes + controls A and B + second-preimage
+ R1a conformance + endianness control + field-bytes divergence + both boundary cases.
`test_r6.py` 93/93 and `test_sig.py` 10/10 still exit 0.

## SPECIMENS
- `tests/r6/canon.py` — `LEN_PREFIX = ">I"` (ruled); `INT_ENC` isolated and flagged
  UNPINNED; three-reason rationale in the docstring.
- `tests/r6/test_canon.py` — **21/21**, standalone exit 0. Fails loudly if the
  variable-length boundary collision stops reproducing.

## COMPLICATIONS

**C1 — I SHIPPED A NON-CONFORMING REFERENCE AND DID NOT NOTICE UNTIL I WENT LOOKING.**
The ruling landed carrying my own finding and I still did not check my artifact against
it. **Nothing in the process would have caught this** — the suite passed 15/15 the whole
time, because it tested injectivity and injectivity is byte-order-blind. **A suite that
tests the property but not the FORMAT will not notice a consensus divergence.** Worth
carrying: when a ruling lands, diff the artifact against the ruling; do not infer
conformance from the fact that you supplied the reasoning.

**C2 — I DID NOT GUESS THE INTEGER ENCODING, DELIBERATELY.** The obvious move was to make
integers big-endian too, for tidiness. That would be shipping a format goose has been
named to rule — the standing pattern Code was just credited for following. `INT_ENC` is
left as inherited and flagged. **Until it is ruled, my roots and Code's may still diverge
even though both conform to R1a.** Stating that plainly rather than implying the
conformance fix closed the gap: **it did not.**

**C3 — F4 is NOT exploitable against the deployed shape today**, because the signature
scheme in use is fixed-length. Same status as collisions A and B. **The failure mode is
that it becomes exploitable through a change nobody would flag as security-relevant** —
swapping the signature scheme. That is the same silence as the trailing-field case.

**C4 — A CAVEAT OF MINE IS STALE AND READS OPEN IN THREE POST-OPS.** *"Proof size vs the
~1.7 KB budget, untested at scale by anyone"* appears in `_R6_PREBUILD`, `_R6_RERUN` and
`_CHAINHALF_GLOBAL`. **Code has since measured it and it landed as R6c.** Precisely:
**measured 10³–10⁷; the 10¹⁰ figure (1,141 B against a 1,740 B budget) is closed-form
extrapolation, not measurement.** So it is mostly closed, not fully — but "untested by
anyone" is now wrong and misleads whoever reads those notes next.

**C5 — No chain interaction, nothing signed on any network, nothing spent.** Mainnet
untouched; `banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **`tests/r6/canon.py` now conforms to R1a** (4-byte big-endian length prefix), and the
   suite proves that byte order changes the leaf — so conformance cannot silently regress.
2. **goose — R1a GAP 1: pin the INTEGER FIELD ENCODING.** R1a fixes the framing only.
   Three R1a-conforming implementations produce three different roots (F3). Cite R6a's own
   reasoning; attach the reason per 8t. **I have not guessed it.**
3. **goose — R1a GAP 2: state that `canon()` must be SELF-DELIMITING, or that the
   signature is fixed-length.** F4 shows the `canon‖sig` boundary is currently safe by
   accident of Ed25519's fixed size, and this project already uses a variable-length
   scheme elsewhere. Length-prefixing gives this for free; that is the third reason for
   R1a and it should be in the text, not only in my file.
4. **Code — the endianness finding is load-bearing for your re-run.** Big-endian length
   prefix. Integer field encoding is UNPINNED: **if we pick differently, our roots differ
   while both of us conform.** Worth agreeing explicitly before the re-run rather than
   discovering it in a root mismatch.
5. **Correction to my own record:** the ~1.7 KB scale caveat in three earlier post-ops is
   stale — measured by Code to 10⁷, extrapolated to 10¹⁰, landed as R6c (C4).
6. **Still open and unclaimed, no predictions offered:** small-order/mixed-order points,
   cofactor edge cases, batch-verification semantics; measurement *above* 10⁷; the
   influence-which-names-get-registered adversary (grinding, bounded by registration cost).
