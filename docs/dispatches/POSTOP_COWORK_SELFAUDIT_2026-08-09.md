# POST-OP NOTE — COWORK · SELF-AUDIT AFTER CODE'S VACUOUS-CONTROL FINDING
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: four negative tests SOUND; one real COVERAGE GAP found in my own suite.**

---

## PRE-OP STATE
Code found a test that **passed vacuously** — `tree_size` tampering is only detectable on a
rightmost-branch leaf, so the check passed on leaf 137/1000 while proving nothing until moved
to leaf 999. Nothing was dispatched to me this round. I ran the finding **against my own
suite**, because "a test that passed for a reason that made it meaningless" is a class, not
an incident, and I had just been wrong twice.

## PROCEDURE PERFORMED
For each R6 negative test, asked two questions: **(a)** does the tampered input actually
differ from the valid one, and **(b)** is the result position-dependent — i.e. would testing
one position hide a bug at another? Then mapped proof length across every leaf position.

## SEATS PRESENT
**Cowork** — audit and findings. **Code** — the vacuous-control finding this applies. (LAW 8c.)

## FINDINGS

**F1 — All four negative tests are SOUND at every position.** Checked across all 19 leaves,
not the 5 originally tested:

| test | tamper genuinely differs | position-dependent | verdict |
|---|---|---|---|
| FM1 wrong sibling order | yes | checked all 19 | sound at every position |
| FM2 truncated path | yes | checked all 19 | sound at every position |
| FM3 stale root | stale ≠ current: true | n/a | sound |
| FM4 second-preimage | forged value **is** a genuine internal node | n/a | sound |

FM4 is worth singling out: the forged input is a *real* node value, not an arbitrary blob —
so it tests the actual attack rather than a strawman.

**F2 — ⚠ REAL COVERAGE GAP: my suite never exercised the promoted leaves.** Proof length
varies by position under promote-unchanged:

```
length 5 : leaves 0–15   (the fully-paired majority)
length 3 : leaf 16       <-- PROMOTED (odd-node path)
length 3 : leaf 17       <-- PROMOTED
length 2 : leaf 18       <-- PROMOTED
```

**My original suite tested leaves 0–4 — all length 5.** The promoted leaves were **never
touched by an inclusion test.** Those are *precisely* the positions the promote-unchanged
ruling governs — the CVE-2012-2459 decision is entirely about what happens to an unpaired
node, and my inclusion tests all ran on paired ones.

**The CVE was caught by a separate root-collision test, not by the inclusion suite.** Had
that collision test not existed, the suite would have passed with the promotion path
completely unexercised.

**F3 — The implementation is correct at those positions — now demonstrated, not assumed.**

```
leaf 16 (len 3): valid=True   order-tampered rejected=True
leaf 17 (len 3): valid=True   order-tampered rejected=True
leaf 18 (len 2): valid=True   order-tampered rejected=True
```

**Correctness was luck of implementation, not evidence of testing.** That distinction is the
finding.

## SPECIMENS
Self-audit and proof-length-map scripts (sandbox scratch); `r6v2.py` RFC 6962 verifier,
19-leaf tree — same fixture as the R6d run.

## COMPLICATIONS

**C1 — This is the THIRD instance of one failure family in two days**, across two seats:

1. My R6 prototype passed 9/9 while carrying CVE-2012-2459 — **no test modelled set-collision.**
2. Code's `tree_size` test passed on a non-rightmost leaf — **fixture made the check unreachable.**
3. My inclusion suite never touched a promoted leaf — **fixture had uniform structure.**

**All three are the same shape: the test could not have failed.** LAW 8n covers case 1
(a suite proves only what it models). Cases 2 and 3 are narrower and worth stating as an
operational check, since they are cheap and mechanical:

> **For any test over a structure with position-dependent behaviour, enumerate the structural
> classes and confirm each is represented in the fixture.** Merkle proofs: paired vs promoted
> leaves, and every distinct proof length. Ring buffers: pre-wrap vs post-wrap. Trees:
> leftmost, interior, rightmost.

**Offered as a candidate, not adopted** — I do not rule, and Seat 1 may judge it already
subsumed by 8n.

**C2 — I found this only because Code reported its own vacuous test.** The audit was not
prompted by my own suspicion; my suite looked green. **A seat reporting its own weak test is
what made a second seat's weak test findable** — worth noting for whether self-reported
defects keep getting surfaced.

**C3 — Not re-run against goose's R6 text.** The audit examines my reference implementation.
If R6's normative text differs, the audit's conclusions apply to my code only.

**C4 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched;
`banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **The R6 verifier is sound at all 19 positions** — including promoted leaves, now
   demonstrated rather than assumed.
2. **Any R6 conformance vector set should include a promoted leaf and every distinct proof
   length.** A vector set drawn only from the paired majority would pass a verifier that is
   broken on the odd-node path — the exact path the CVE ruling exists to govern.
   **Suggested to goose as a vector-selection criterion, not written by me.**
3. **Candidate operational check in C1** for Seat 1's judgement — enumerate structural
   classes and confirm fixture coverage.
4. **Unchanged and still untested, no prediction offered:** scale beyond N = 2^20, grinding
   cost at 10^10.

**Also noted:** the cross-thread pricing flag was addressed to *"whoever holds namespace
pricing"* — **no named seat, which LAW 8o forbids.** Flagging rather than adopting it, since
routing is not mine to assign.
