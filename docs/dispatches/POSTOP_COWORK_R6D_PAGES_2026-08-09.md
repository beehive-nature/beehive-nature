# POST-OP NOTE — COWORK · R6d PAGE MECHANISM (k=10) + PADDING NEGATIVE CONTROL
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: 13/13 combined. Padding leak REPRODUCED — the mitigation is load-bearing.**

---

## PRE-OP STATE
`k` ruled = 10 → anonymity floor 1,024 names, ~32 KB per cold lookup. R6 landed at rev 6
(R6a tags, R6b promote-unchanged, R6c binary encoding, R6d padding **principle**). R6d's
padding **target** still reads *"follows from k once the founder sets the page-size
parameter"* — goose's text update pending.

## PROCEDURE PERFORMED
1. Implemented the page mechanism against the **ruled** values (k=10, floor 1,024, 32 B
   records) — not against R6d's not-yet-written target.
2. Verified the ruled arithmetic independently.
3. **Negative control per the standing bar:** built pages **without** padding and tested
   whether bucket-size variance actually leaks, as a distinguishing attack rather than an
   assertion.
4. Re-ran the R6 inclusion suite with the page mechanism added.

## SEATS PRESENT
**Cowork** — implementation, negative control, this note. **Seat 1** ruled k=10 under
founder delegation. **goose** owns R6's normative text. (LAW 8c.)

## FINDINGS

**F1 — The ruled arithmetic checks out exactly.** At N = 1,048,576 names, depth = log2(N) − k
= 10 bits → 1,024 buckets, ~1,024 names each. Padded page = **1,024 records × 32 B =
32,768 B = 32 KB**, matching the ruled figure to the byte.

**F2 — ⭐ THE LEAK IS REAL, and worse than the headline.** Attack model: a network observer
sees **only the response size** of a cold lookup. Can size alone identify the prefix queried?

```
UNPADDED (mitigation REMOVED)
  distinct response sizes observable        : 158
  prefixes uniquely fingerprinted by size   : 24 of 1,024  (2.3%)
  attacker's candidate set  min 1 · median 10 · max 22

PADDED (k=10 → 1,024 records)
  distinct response sizes observable        : 1  (32,768 B)
  prefixes distinguishable by size          : 0
```

**The 2.3% understates it.** The load-bearing number is the **median candidate set of 10**:
for a *typical* query, response size alone narrows 1,024 candidate prefixes to ~10 — an
effective anonymity set collapsing from **~1,048,576 names to ~10,240**, a **~100× loss**,
before any other signal is considered. The 24 uniquely-fingerprinted prefixes are the worst
case; the ~100× reduction is the *average* case. Padding removes both.

**F3 — Combined suite: 13/13.** R6 inclusion (5 valid + FM1–FM4) plus four R6d page
properties — page is 1,024 records; page is exactly 32 KB; all pages identical size;
unpadded sizes vary. Adding the page mechanism broke nothing in the inclusion verifier;
they are orthogonal layers (pages govern *fetching*, proofs govern *verifying*).

## SPECIMENS
- `/tmp/pages.py` (page mechanism), negative-control and combined-suite scripts
  (sandbox scratch).
- `SPEC_RESOLVER_VALIDITY_RULES` rev 6, R6a–R6d + scope note (LAW 8a).

## COMPLICATIONS

**C1 — Measured under a UNIFORM hash distribution; real-world skew makes this WORSE, not
better.** SHA-256 prefixes are near-uniform, so bucket occupancy clustered tightly
(933–1,133). Any real-world correlation — popular name patterns, bulk registrations, a
single DAO claiming many adjacent names — widens the spread and **increases** the number of
uniquely-fingerprinted prefixes. **The 2.3% figure is a floor on the leak, not a ceiling.**
Do not cite it as the expected severity.

**C2 — Scale-dependent, and measured at exactly one scale.** N = 2^20. The relationship
between bucket-size variance and N is not tested here; at 10^10 with depth scaled to hold
page size constant, occupancy variance relative to the floor will differ. **Untested.**

**C3 — R6d's padding TARGET is not yet in goose's text.** I implemented against the ruling
(1,024), not against the spec, because the spec currently defers the number. **If goose's
R6d text lands with anything other than 1,024, my implementation is wrong and gets
rewritten. goose's text is normative; mine is a reference implementation.**

**C4 — Padding records are `os.urandom`, which is a choice I made and R6d does not specify.**
Whether padding records must be indistinguishable from real ones (random), or may be a fixed
sentinel, is **unspecified**. It matters: a fixed sentinel is distinguishable *within* the
page by anyone who receives it, which leaks true occupancy to the requester even though it
hides it from a size-observer. **Flagged for R6d — not decided by me.**

**C5 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched;
`banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **k=10 / 1,024 / 32 KB verified consistent**, and the padding mitigation is **proven
   load-bearing** by reproducing the leak with it removed.
2. **Cite the median-candidate-set figure (~100× anonymity loss), not the 2.3%**, when
   justifying R6d — the average case is the stronger argument and the honest one.
3. **goose owes two R6d items:** the padding target (1,024, per the ruling) and **whether
   padding records must be indistinguishable from real records** (C4) — the second is
   unspecified and has a real privacy consequence.
4. **Untested:** leak severity under non-uniform/adversarial name distributions (C1), and
   scale behaviour beyond N = 2^20 (C2).
