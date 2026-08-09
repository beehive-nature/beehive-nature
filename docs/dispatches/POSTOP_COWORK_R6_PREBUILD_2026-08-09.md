# POST-OP NOTE — COWORK · R6 INCLUSION-PROOF VERIFIER, PRE-BUILT
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Re-run status: HELD as ordered**, pending goose's R6 spec text.

---

## PRE-OP STATE
Global tree verified by Code (51.3 KB total, wrap 0 bytes, forged `prev_root` refused,
`push_and_wait` serializes by construction). Permissionless commit adopted. R6 assigned to
goose; Cowork's re-run held until it lands.

## PROCEDURE PERFORMED
Held the re-run. Used the wait to **pre-build an R6 verifier** against the four failure modes
named in the ruling, so the re-run executes on R6's arrival rather than beginning design
then. Then ran a **negative control** on the verifier's own mitigation.

## SEATS PRESENT
**Cowork** — verifier, exercises, negative control, this note. **R6 spec text is goose's**;
nothing here substitutes for it. **Ruling** by Seat 1 under the core measure. (LAW 8c.)

## FINDINGS

**F1 — R6 verifier: 9/9 against the ruling's four failure modes**, on a global tree of 14
leaves (5 belonging to one DAO, 9 to three others) — i.e. the DAO's records are a genuine
**subtree**, which is the condition that made R6 necessary:

| Case | Expect | Got |
|---|---|---|
| VALID leaf ×5 | accept | accept |
| **FM1** wrong sibling order | reject | reject |
| **FM2** truncated path | reject | reject |
| **FM3** proof against a stale root | reject | reject |
| **FM4** second-preimage (node presented as leaf) | reject | reject |

**F2 — ⭐ NEGATIVE CONTROL: domain separation is LOAD-BEARING, proven not assumed.**
An FM4 "pass" is meaningless unless the mitigation is doing work — so I rebuilt the tree
**without** domain separation and re-ran the same attack:

```
forged "record" hashes to an internal node : True
WITHOUT domain separation, attack SUCCEEDS : True
WITH    domain separation, attack REJECTED : True
```

The attack is concrete: with untagged hashing, `H(leaf)` and `H(node)` share a namespace, so
an attacker submits the 64-byte preimage `L0‖L1` as a "record"; it hashes to the internal
node and the node then verifies as a leaf. Prefixing `0x00` for leaves and `0x01` for
internal nodes makes it impossible by construction.

**Per LAW 8k, this is the point:** I proved the probe returns a positive when the mitigation
is removed, so the FM4 pass is meaningful rather than vacuous. A verifier that "rejects" an
attack it was never actually capable of accepting proves nothing.

## SPECIMENS
- `/tmp/r6.py` (verifier + 9 cases), negative-control script inline (sandbox scratch).
- Ruling's four failure modes; `bdid-architecture-decision.md` §3.5 (LAW 8a).

## COMPLICATIONS

**C1 — This verifier is NOT the spec, and must not be mistaken for it.** goose owns R6's
text. Two choices I made are **implementation guesses that R6 must actually rule**, and if
R6 differs, my verifier is wrong and gets rewritten:
- **Tag values** — I used `0x00`/`0x01`. Any distinct pair works; the *values* must be ruled
  so independent implementations interoperate.
- **Odd-node promotion** — I duplicate the last node when a level is odd. The alternative
  (promote unpaired node unchanged) yields **different roots**, so this is a
  consensus-critical choice, not a detail.

**C2 — Untested here, and flagged rather than assumed:** proof size/cost against §3.5's
~1.7 KB budget, and depth-12 prefix-page privacy behaviour. My tree is 14 leaves; those
properties only appear at scale.

**C3 — No chain interaction. Nothing signed, nothing spent, no re-run started.**
`banchor22222` untouched. Mainnet untouched; `banchor11111` dead per LAW 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **The re-run remains HELD** until R6 lands — correctly. A green run without inclusion
   proofs would prove *less* than the per-DAO run and read as success.
2. **On R6's arrival the re-run is: re-anchor the same leaves as a subtree, verify the same
   9 lifecycle stages offline, plus R6 inclusion proofs.** Records re-derive byte-identical
   from seed; leaves are invariant under the shape change.
3. **goose: two consensus-critical values need ruling in R6** — the domain-separation tag
   values, and odd-node promotion (duplicate vs promote). Both change the root; neither is
   inferable from the failure-mode list.
4. **The negative-control pattern generalises.** Any test asserting a mitigation works should
   also demonstrate the attack succeeding without it. Otherwise the test may be passing
   because the attack was never reachable — the same shape as LAW 8k, applied to mitigations
   rather than queries.
