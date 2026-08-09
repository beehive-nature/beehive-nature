# POST-OP NOTE — COWORK · R6 REBUILT (RFC 6962) + GLOBAL-TREE LIFECYCLE RE-RUN
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: RE-RUN COMPLETE — 9/9 validity AND inclusion.**

---

## PRE-OP STATE
Two consensus values ruled: tags `0x00` leaf / `0x01` node; **odd node PROMOTED UNCHANGED**,
which **corrects my prototype** (it duplicated). Global tree verified by Code. Re-run was
held pending these.

## PROCEDURE PERFORMED
1. **Rebuilt the R6 verifier** to RFC 6962 — promote-unchanged, no duplication.
2. Re-ran the four failure modes.
3. **Proved CVE-2012-2459 rather than citing it**, per the standing bar.
4. Ran the **full lifecycle re-run** under a genuine global tree, every stage checked for
   **both** validity (R0–R5) **and** inclusion (R6).

## SEATS PRESENT
**Cowork** — rebuild, proofs, re-run, this note. **Seat 1** ruled both values and caught the
duplication defect. **goose** owns R6's normative text; **Code** the global-tree contract.
(LAW 8c.)

## FINDINGS

**F1 — The correction was real and I had it wrong.** My prototype duplicated the last node
on odd levels — the Bitcoin construction, vulnerable to **CVE-2012-2459**. Rebuilt to
RFC 6962. **R6 v2: 9/9** on valid leaves + FM1 wrong sibling order + FM2 truncated path +
FM3 stale root + FM4 second-preimage.

**F2 — ⭐ CVE-2012-2459 REPRODUCED AND REFUSED — the ruling is demonstrated, not asserted.**
Two **distinct** leaf sets, `S1 = [A,B,C]` and `S2 = [A,B,C,C]`:

```text
DUPLICATING (Bitcoin, CVE-2012-2459)
  root(S1) = 04cb0237ca22bf62ef1c936feb1291e817aa95c6dfa94d71…   # TESTNET-ONLY synthetic root
  root(S2) = 04cb0237ca22bf62ef1c936feb1291e817aa95c6dfa94d71…   # TESTNET-ONLY synthetic root
  COLLIDE  = True    <-- distinct sets, IDENTICAL root

PROMOTE-UNCHANGED (RFC 6962, RULED)
  root(S1) = 1b2c5a954379125b917ab20bb84bbbb38ca63910e4b5eb0d…   # TESTNET-ONLY synthetic root
  root(S2) = 04cb0237ca22bf62ef1c936feb1291e817aa95c6dfa94d71…   # TESTNET-ONLY synthetic root
  COLLIDE  = False   <-- distinct sets, DISTINCT roots
```

The vulnerability **reproduces** under the construction I had used and is **absent** under
the ruled one. Note `root(S2)` is identical across both constructions — as it must be, since
a 4-leaf level is even and never triggers the odd-node rule. That is a useful internal
consistency check on the harness itself.

**F3 — ⭐ LIFECYCLE RE-RUN: 9/9, VALIDITY *AND* INCLUSION.** Global tree of **19 leaves — 7
from this DAO, 12 from three other DAOs**, so this DAO's records are a real subtree, which is
the whole condition R6 exists for.

```text
GLOBAL ROOT: ecc730baa44dfeffd26ff074606c0768b2ae3bb58f79d459fcf33d3a395a4624   # TESTNET-ONLY synthetic root
```

| Stage | R0–R5 | R6 inclusion |
|---|---|---|
| 1 REGISTER | ACCEPT | ✔ |
| 2 CHANGE @28d | ACCEPT | ✔ |
| 2b CHANGE @27d *(neg)* | REJECT | ✔ |
| 3 RENEW @365d | ACCEPT | ✔ |
| 4b GRACE @exp+27d | GRACE | ✔ |
| 4 LAPSE @exp+28d | LAPSED | ✔ |
| 5 RECLAIM (owner, grace) | ACCEPT | ✔ |
| 5b STRANGER in grace *(neg)* | REJECT | ✔ |
| 6 STRANGER post-lapse | ACCEPT | ✔ |

**The re-run now proves strictly MORE than the per-DAO run**, which was the point of holding
it: each stage's record is both *valid* and *provably present in the global root*. The
per-DAO run could only recompute a root it owned entirely.

**F4 — Negative stages carry inclusion proofs too, deliberately.** 2b and 5b are `REJECT` on
validity **and** `✔` on inclusion — they *are* in the tree, and are refused on their merits.
That separation matters: **"not in the tree" and "in the tree but invalid" are different
failures**, and conflating them would hide a whole class of bug.

## SPECIMENS
- `/tmp/r6v2.py` (RFC 6962 verifier), CVE reproduction and re-run scripts (sandbox scratch).
- Records from seeds `COWORK-LIFECYCLE-{OWNER,STRNGR}-SEED-2026`, byte-identical to the
  per-DAO run (previously verified against on-chain roots).

## COMPLICATIONS

**C1 — My prototype was wrong and shipped a real vulnerability class.** Not a near miss: had
R6 been written from it, the duplication construction would have been normative and every
implementation would have inherited CVE-2012-2459. **Caught by Seat 1 reading the choice, not
by my tests** — my 9/9 passed happily under the vulnerable construction, because none of the
four failure modes tests set-collision. **Worth carrying: a passing test suite is not
evidence the construction is sound; it is evidence it survives the cases you thought of.**

**C2 — Inclusion proofs are still UNTESTED AT SCALE.** 19 leaves. §3.5's ~1.7 KB proof budget
and depth-12 prefix-page privacy are scale-only properties and remain unverified by anyone —
already flagged to Code, restated so it is not lost.

**C3 — This verifier still is not the spec.** goose's R6 text is normative; mine is a
reference implementation that now matches the ruled values. If R6's text differs, R6 wins.

**C4 — No chain interaction. Nothing signed, nothing spent, no re-anchor performed.** The
re-run is the **offline** half; re-anchoring the same leaves as a subtree of Code's global
tree is a separate step, available on request. Mainnet untouched; `banchor11111` dead (8h).

## DISPOSITION

**Sufficient alone for the next operator:**

1. **R6 verifier matches the ruled construction and passes 9/9**; the lifecycle re-run passes
   9/9 on **both** validity and inclusion against a real global root.
2. **The CVE is proven both ways** — reproduced under duplication, refused under
   promote-unchanged. goose can cite this run for the R6 vector rather than constructing it
   fresh; leaf sets `[A,B,C]` vs `[A,B,C,C]` are the minimal case.
3. **Remaining untested, scale-only:** proof size vs ~1.7 KB, depth-12 prefix-page privacy.
4. **Available on request:** re-anchoring these leaves as a subtree of the deployed global
   tree, to close the chain half of the re-run as well.
