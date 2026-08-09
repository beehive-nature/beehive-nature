# SPEC — RESOLVER VALIDITY RULES + TEST VECTORS (2026-08-08, rev 6)
**From:** goose (instrument-reading) · **To:** Code
**Authority:** Seat 0 + Seat 1 consensus-value rulings (tag values, odd-node promotion)
**Rev 6:** Two consensus values pinned normative in R6: (a) tag values 0x00/0x01 fixed per RFC-6962; (b) odd-node promotion = PROMOTE UNCHANGED (not duplicate; CVE-2012-2459). TV-IP6 added (duplication attack, both sides).

## DESIGN PRINCIPLE
Every ruled property of a `.b` name is a field of the **signed bDiD record**, verified off-chain by the resolver. The anchor contract stores epoch Merkle roots in a 144-row ring (single global tree per §3.5; 51.3 KB verified). No per-name contract call.

The global root spans ALL names (depth-40 indexed tree). A resolver holding one name's records cannot recompute it and MUST verify a Merkle inclusion proof (R6).

**Timestamp basis:** `epoch_time` = BLOCK TIME. Resolver = pure function of `(record, epoch_time)`. Wall-clock advisory only. (World A, efad970.)

**Namespace rhythm:** 28d change / 365d term / 28d grace.

## SIGNED RECORD MODEL

    Record {
      name, owner, revision, signed_at, expires_at, prev_signed_at, payload, sig
    }
    (Fields unchanged from rev 5 — see prior revisions for full struct.)

## VALIDITY RULES

**R0 — WORLD A (FORWARD-ONLY).** For `revision > 1`: `signed_at >= prev_signed_at`. Backdating = REJECT.

**R1 — SIGNATURE.** verify(...) passes. Else REJECT.

**R2 — TERM (365-DAY EXPIRY).** `epoch_time <= expires_at` (INCLUSIVE). Else EXPIRED -> R5.

**R3 — REVISION GAP (28-DAY).** For `revision > 1`: `signed_at - prev_signed_at >= 28 * 86400`. Else REJECT.

**R4 — PER-bDiD CAP.** Owner's active name count <= cap. At indexing.

**R5 — GRACE / LAPSE.** If EXPIRED:
- `< grace_period` (28 days) (EXCLUSIVE): GRACE. Original owner reclaims only.
- `>= grace_period`: LAPSED. Name returns to pool.

**R6 — INCLUSION PROOF (GLOBAL TREE).** The `new_root` spans all names. The resolver MUST verify a Merkle inclusion proof:
1. Leaf key = `sha256("b:v1:" ‖ skeleton(name))` per §3.5.
2. Proof: leaf hash, sibling hashes, path directions.
3. `tree_size` (from commit()) determines tree shape for rightmost-branch paths.
4. Recomputed root MUST equal `new_root` from current epoch's commit().
5. Stale root: proof against a previous epoch's root REJECTED.
6. If any check fails, REJECT.

**R6a — TAG VALUES (NORMATIVE).** Leaf hashing prefix = `0x00`. Internal node hashing prefix = `0x01`. **Fixed** per RFC-6962 convention — the most widely deployed and independently re-implemented standard. Any distinct pair works mathematically, but unpinned values mean implementations cannot interoperate. This is a pinned consensus value, not a suggestion.

**R6b — ODD-NODE PROMOTION (NORMATIVE).** When a level has an odd number of nodes, the unpaired node is **PROMOTED UNCHANGED** to the next level. **DO NOT DUPLICATE.** Duplicating (the Bitcoin construction) carries **CVE-2012-2459**: two distinct leaf sets produce an identical root, making the tree non-injective. RFC 6962 promotes unchanged and is not vulnerable. The two choices yield **DIFFERENT ROOTS** — this is consensus, not style. (See TV-IP6 for the proof.)

## RULE-APPLICATION ORDER
0. R6 (inclusion proof) — prove record committed in current epoch root
1. R1 (signature) → 2. R0 (World A) → 3. R3 (revision gap) → 4. R5 (grace lock, PREVIOUS record) → 5. R2 (term) → 6. R4 (cap)

## BOUNDARY ASYMMETRY
Term (R2): INCLUSIVE (`<=`). Grace (R5): EXCLUSIVE (`<`). Stated, not inferred.

## TEST VECTORS — RESOLVER VALIDITY (TV1-TV15)
(Unchanged from rev 5 — 15 vectors covering R0-R5, all both-sides.)

## TEST VECTORS — INCLUSION PROOF (TV-IP1 to TV-IP6)

| # | Mode | Input | Expected |
|---|---|---|---|
| TV-IP1 | Correct proof | Valid leaf, correct siblings/order, full path, current root, domain-separated (0x00/0x01) | **ACCEPT** |
| TV-IP2 | Wrong sibling order (neg) | IP1 but siblings reversed at one level | **REJECT** (root mismatch) |
| TV-IP3 | Truncated path (neg) | IP1 but path 1 level short | **REJECT** (incomplete) |
| TV-IP4 | Stale root (neg) | Correct proof, recomputes to previous epoch root | **REJECT** (stale) |
| TV-IP5 | Second-preimage (neg) | Node hash substituted for leaf hash; 0x01 prefix where 0x00 expected | **REJECT** (prefix mismatch) |
| TV-IP6 | Duplication attack (CVE-2012-2459) | See below | **REJECT** under promote-unchanged; **ACCEPT (vulnerable)** under duplication |

### TV-IP6 detail — the duplication attack proof

Two leaf sets with identical content except cardinality:
- **Set A:** {L1, L2, L3} — 3 leaves (odd at level 1)
- **Set B:** {L1, L2, L3, L3} — 4 leaves (L3 appears twice)

Let h1, h2, h3 = leaf hashes (prefix 0x00).

**Under DUPLICATION (Bitcoin, CVE-2012-2459):**
- Set A level 1: [H(0x01‖h1‖h2), H(0x01‖h3‖h3)] — h3 duplicated
- Set B level 1: [H(0x01‖h1‖h2), H(0x01‖h3‖h3)] — h3 paired naturally
- Root_A == Root_B — **same root, different sets. Attack succeeds.**

**Under PROMOTE-UNCHANGED (RFC 6962):**
- Set A level 1: [H(0x01‖h1‖h2), h3] — h3 promoted (0x00 leaf hash)
- Set B level 1: [H(0x01‖h1‖h2), H(0x01‖h3‖h3)] — h3 paired (0x01 node hash)
- Root_A = H(0x01‖H(0x01‖h1‖h2)‖h3) — right child is a LEAF hash
- Root_B = H(0x01‖H(0x01‖h1‖h2)‖H(0x01‖h3‖h3)) — right child is a NODE hash
- Root_A != Root_B — **different roots. Attack fails.** h3 (0x00) != H(0x01‖h3‖h3) for any secure hash.

**Both sides:**
- Promote-unchanged (resolver's construction): distinct roots -> REJECT false proof -> **SECURE**
- Duplication (Bitcoin construction): identical roots -> ACCEPT false proof -> **VULNERABLE** (CVE-2012-2459)

### Both-sides boundary summary (inclusion proof)

| Boundary | Positive (passes) | Negative (fails) |
|---|---|---|
| Sibling order | TV-IP1 (correct: ACCEPT) | TV-IP2 (reversed: REJECT) |
| Path completeness | TV-IP1 (full: ACCEPT) | TV-IP3 (truncated: REJECT) |
| Root freshness | TV-IP1 (current: ACCEPT) | TV-IP4 (stale: REJECT) |
| Second-preimage | TV-IP1 (domain-separated: ACCEPT) | TV-IP5 (substitution: REJECT) |
| Tree construction | TV-IP1 (promote-unchanged: ACCEPT) | TV-IP6 (duplication: VULNERABLE) |

## NOTES FOR CODE
- R6 = step 0 (prove inclusion before validity). R6a/R6b are NORMATIVE consensus values — not optional.
- tree_size load-bearing (rightmost branches). Domain separation mandatory (0x00/0x01). Promote-unchanged mandatory (not duplicate).
- Non-membership proofs (indexed tree via next_key) are §3.5 property but NOT in R6 scope — flagged for future.
- Sequencer MUST SERIALIZE anchors. Non-consecutive epochs REQUIRED. is_canonical strict.
- Negative control discipline (Cowork's): REMOVE THE MITIGATION AND CONFIRM THE ATTACK SUCCEEDS, or the pass proves nothing. Generalizes past Merkle trees.

## SCOPE FENCE
R0-R6 + TV1-TV15 + TV-IP1-TV-IP6. Anchor contract, storage, signing, uniqueness, non-membership, governance separate. Reconciled with §3.5. Kernel docs. **Out of scope: execute as written.**
