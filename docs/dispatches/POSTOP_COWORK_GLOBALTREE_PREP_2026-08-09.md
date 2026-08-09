# POST-OP NOTE — COWORK · GLOBAL-TREE RE-RUN PREP + RESOLVER GAP
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.

---

## PRE-OP STATE
Global tree ruled; per-DAO rings abandoned on physical grounds. Cowork's re-run is gated on
Code landing the global-tree anchor. Per-DAO lifecycle already anchored and closed
(epochs 1000145–1000149).

## PROCEDURE PERFORMED
1. Recorded **LAW 8l** (sequencers serialize anchors) and **LAW 8m** (the core measure
   decides) in the standing laws.
2. **Regenerated the lifecycle records from seed** and re-derived every leaf and every epoch
   root, comparing against what is anchored on Jungle — to establish whether the re-run is a
   re-anchor or a re-derivation.
3. Checked the resolver spec against the new anchor shape.

## SEATS PRESENT
**Cowork** — all findings below. Rulings by **Seat 0** and **Seat 1 under the core measure**;
resolver spec by **goose**; global-tree contract is **Code's**, unstarted at time of writing.
(LAW 8c.)

## FINDINGS

**F1 — The lifecycle records are REPRODUCIBLE FROM SEED, exactly.** All five epoch roots
re-derive byte-identical to what is anchored on-chain:

```
epoch 1000145 REGISTER     539ab074f64c3982…  MATCH
epoch 1000146 CHANGE@28d   f22617b86069a253…  MATCH
epoch 1000147 RENEW@365d   4f7685a900a6a2ac…  MATCH
epoch 1000148 RECLAIM      a153875e0c3aec48…  MATCH
epoch 1000149 STRANGER     b517e5cfb5558056…  MATCH
```

**The re-run is therefore a RE-ANCHOR, not a re-derivation** — records and leaves need no
regeneration, as the founder anticipated. Deterministic seeds were worth using.

**F2 — Leaves are INVARIANT under the shape change.** A leaf is `H(canon(record) ‖ sig)` —
it depends only on the signed record, never on the tree it sits in. Moving from per-DAO
rings to one global tree does not touch a single leaf; a DAO's leaves simply become a
**subtree** of the all-DAO tree.

## SPECIMENS
- Reproduction script (sandbox scratch), seeds `COWORK-LIFECYCLE-{OWNER,STRNGR}-SEED-2026`.
- On-chain roots: `banchor22222::roots`, epochs 1000145–1000149, previously verified via
  `cryptolions`.
- `SPEC_RESOLVER_VALIDITY_RULES` rev 4; `docs/bdid-architecture-decision.md` §3.5 (LAW 8a).

## COMPLICATIONS

**C1 — ⚠ SPEC GAP: the resolver spec does not cover MERKLE INCLUSION PROOFS, and the global
tree makes them mandatory.**

Under **per-DAO** anchoring, the anchored root *was* that DAO's tree root — a resolver
holding the DAO's records could recompute it directly. That is what my closed milestone did.

Under the **global** tree, the anchored root spans **all** DAOs. **A resolver holding one
DAO's records can no longer recompute the anchored root.** It must verify a **Merkle
inclusion proof** — the sibling path from its leaf up to the global root.

Grep of `SPEC_RESOLVER_VALIDITY_RULES` rev 4 for *merkle / inclusion / proof / path /
sibling / subtree*: **the only hit is a passing mention that the contract "stores only epoch
Merkle roots."** No rule requires or specifies proof verification.

**The architecture doc already assumes proofs** — `bdid-architecture-decision.md` §3.5
describes "a single proof," a "~1.7 KB" resolution cost, a depth-12 prefix page for privacy,
and a `commit()` carrying `tree_size` and `delta_id`. **So the two documents now disagree**:
the architecture is proof-based, the resolver spec is not.

**Precisely what does and does not change** — this distinction matters and is easy to blur:
- **R0–R5 validity rules: UNCHANGED.** They are a pure function of `(record, epoch_time)`.
  **My 9/9 stands and does not need re-running for validity.**
- **Inclusion verification: NEW, and absent from the spec.** *"Is this record in the anchored
  tree?"* was previously answered by recomputing a root; under a global tree it requires a
  proof, with its own failure modes — wrong sibling order, truncated path, proof against a
  stale root, second-preimage on the leaf/node domain separation.

**This is LAW 8h's shape applied one level up:** the *validity rules* didn't change, so it is
tempting to say nothing changed — but **what the resolver must verify did change.** The tell
is the same one 8h warns about.

**Owed by goose (flagged, not written by Cowork):** an inclusion-proof rule and vectors,
under the same both-sides boundary discipline — a valid proof accepted, and each malformation
above rejected.

**C2 — No chain interaction, nothing signed, nothing spent.** `banchor22222` untouched this
procedure. Mainnet untouched; `banchor11111` dead per LAW 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **The re-run is cheap and ready.** Records reproduce from seed byte-exact (F1); leaves are
   invariant (F2). When Code lands the global tree, the re-run is: re-anchor the same leaves
   as a subtree, re-verify the same 9 stages offline.
2. **BLOCKING for a meaningful re-run: the inclusion-proof rule (C1).** Without it, a
   global-tree "re-run" would verify the record but never verify that the record is *in* the
   anchored tree — which is the only thing the global tree changed. It would look like a pass
   and prove less than the per-DAO run did.
3. **Do not treat R0–R5 as needing revision.** They are correct and unchanged; the gap is
   strictly the inclusion layer.
4. Carrying into the re-run: LAW 8l (serialize anchors — this is what bit E5), LAW 8k
   (prove the probe can return a positive), strict `is_canonical` on both leading bytes.
