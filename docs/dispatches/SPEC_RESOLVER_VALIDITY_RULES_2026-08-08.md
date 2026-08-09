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

**R1a — CANONICAL ENCODING (NORMATIVE).** canon() MUST use LENGTH-PREFIXED field encoding: each field as 4-byte big-endian length || field bytes, concatenated in fixed field order. Unconditionally injective.

**WHY NOT PIPE-JOIN (Cowork proved the collision):** pipe-join is NOT injective when two fields are attacker-influenced and variable-length. A{name="a", payload=MIDDLE+"z"} and B{name="a"+MIDDLE, payload="z"} produce IDENTICAL canon bytes — a signature over one validates the other. Charset validation is NOT the fix (holds only while payload stays last; breaks when a field is appended). Length-prefixing has no validation or ordering dependency.

**CHARSET VALIDATION IS A VALIDATION RULE, NOT AN ENCODING FIX.** Must NEVER be mistaken for the mechanism that makes canon() injective.

**BLAST RADIUS:** Prior runs valid for ordering, inclusion, lifecycle. But NO RUN HAS YET DEMONSTRATED THAT A LEAF COMMITS TO ITS RECORD. Until length-prefixed canon() lands and roots re-anchor, Merkle proof proves inclusion of bytes, not commitment to a record.

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

**R6c — PROOF ENCODING (NORMATIVE).** Inclusion proofs MUST be encoded in **BINARY**, not hex-JSON. §3.5's ~1.7 KB resolution-cost budget is in binary bytes. At 10^10 scale, a proof carries ceil(log2(10^10)) ≈ 34 sibling hashes; at 32 B each = **1,088 B** binary. Adding leaf hash (32 B) + path-direction bitmap (~5 B) = **~1,125 B** — within budget. The same proof as hex-JSON expands to **~2,400 B** (each byte → 2 hex chars + JSON delimiters) — **over budget on encoding alone**. A budget without a pinned encoding is not a budget.

**MEASURED (Code, synthetic 10^3-10^7 tree):** ceil(log2(N)) exact at every tested N, including both sides of 2^20. At 10^10: binary proof = **1,141 B** inside the **1,740 B** budget with **599 B** headroom. Same proof as hex-JSON = **~2,550 B**, over budget on encoding alone. R6c pin is now MEASURED, not asserted.

**R6d — UNIFORM PAGE PADDING (NORMATIVE).** Prefix-page buckets are padded to a uniform length. Raw bucket size is a side channel that leaks population density of a name's neighborhood. HIBP ships Add-Padding (normalizing to 800-1,000 records) because this leakage is known and mitigated in production. A known side channel with a shipped mitigation is not a design choice. k = 10 (ruled by Seat 1, founder-delegated). Page size = 2^k = 1,024 entries. Buckets padded to 1,024 uniformly. Download per cold lookup: 1,024 x 32 B = ~32 KB, constant at any N.

**DEPTH RULE (separate from k):** d = ceil(log2 N) - 9 (NOT -10). The depth exponent and page-size exponent are DIFFERENT NUMBERS — they were conflated; measurement separated them. k=10 sets page/padding = 1,024; d = ceil(log2 N) - 9 sets average occupancy at ~512 (half the page), leaving headroom.

**BROKEN NEIGHBOUR (cite the unsafe alternative):** at d = ceil(log2 N) - 10, powers of two put mu = 2^10 = 1,024 = P (page size), so padding overflows — measured 1,104-1,138 against a 1,024 ceiling — and grinding is FREE. A rule's safety is only proven by exhibiting its unsafe alternative.

**Why k=10 (re-derivable, not a taste):**
1. HIBP's ~800-suffix bucket is the only planetary-scale deployment of this construction; 1,024 exceeds it, same order of magnitude. Prior-art grounded.
2. Option F removes the payment path — cost lands only on cold third-party resolution (rarer path, can afford higher floor).
3. ~32 KB is affordable on any connection that can run the app. Inclusion by construction.
4. Dialing up is free via j decoys (mechanism C); the floor need only be defensible, not maximal.
5. Uniform padding to 1,024 is required anyway; page size is constant regardless of prefix occupancy.

**LEAKAGE SEVERITY (cite the average, not the worst):** The median candidate set per prefix is ~10, meaning response size alone collapses effective anonymity from ~1,048,576 to ~10,240 — a ~100x reduction. The 24 uniquely-fingerprinted prefixes (2.3%) are the WORST case; ~100x is the AVERAGE case and the one to cite.

**OCCUPANCY THREAT (real mechanism, not distributional):** Hashing destroys input structure — 50k names sharing a literal prefix scatter across all 1,024 buckets, so real-world name patterns do NOT concentrate occupancy. Skew moves the leak from 2.3% to only 2.9%. The real threat is adversarial GRINDING: ~133,000 hash attempts find a favorable bucket (trivial computation), but 122 REAL REGISTRATIONS are needed to make a chosen bucket the unique largest. Grinding is bounded by REGISTRATION COST, not hash uniformity.

**CROSS-THREAD FLAG:** The privacy threat model is now coupled to registration pricing — a cheaper registration is a cheaper occupancy attack. This is a NEW input to the per-bDiD-cap decision (previously weighed only cost-recovery, rationing, sybil, spam). Do not set a registration cost without it.

**C4 — PADDING RECORDS INDISTINGUISHABLE FROM REAL (ruled, Seat 1).** Padding records must have the same byte distribution as real records — no sentinel, no distinguishable filler. Four reasons: (1) a sentinel hides occupancy from a size-observer but hands TRUE OCCUPANCY to the requester, who can count real records; (2) occupancy over many queries is namespace-density mapping — the enumeration channel this mechanism exists to close; (3) the cost is zero since the bytes ship either way; (4) it weakens nothing — validity comes from the SIGNATURE and the MERKLE PROOF, never from page membership.

**REVISION TEST:** k moves if (a) measurement shows cold third-party resolution is far more common than expected, or (b) bandwidth data shows 32 KB is a barrier for the marginal user. Measurable, therefore revisable.

**R6 COMPLETE.** Padding target = 1,024, following from k = 10.

**SCOPE NOTE (LOOKUP PRIVACY).** The payment path has NO lookup-privacy problem by construction. RFC 9162's mitigation is that the counterparty SENDS THE PROOF (the recipient hands over their log at payment time per bdid-architecture-decision.md:245). The lookup-privacy constraint (R6d padding, bounded download, k-anonymity) bites ONLY on cold third-party resolution — where the resolver has no counterparty relationship and must fetch independently. Do not solve a problem the payment path does not have.

**R6e — VECTOR-SELECTION CRITERION (LAW 8p, SHARPENED).** Any conformance set for inclusion-proof verification MUST include (1) at least one PROMOTED leaf — a leaf that traverses an odd-node level via promote-unchanged — and (2) EVERY DISTINCT proof length the tree produces at the tested tree_size. A set drawn only from the paired majority (all full-length proofs) passes a verifier broken on the odd-node path because the broken code never executes. Worked example (Cowork's 19-leaf tree): length-5 proofs (leaves 0-15, paired subtrees), length-3 (leaves 16-17, promoted), length-2 (leaf 18, promoted) — three distinct structural classes. A set missing any length is incomplete per 8p: enumerate the structural classes and confirm each is represented in the fixture.

**R6e N-RANGING (8p sharpened over N):** The criterion must range over N, not merely positions within one N. Fixing the fixture at a single N is an 8p violation one level up. REQUIRED across N: (1) N=1 (empty proof, root IS the leaf hash); (2) at least one power-of-2 N (balanced tree, zero promotions, all proofs equal — a verifier broken only on balanced trees passes an odd-N suite); (3) the within-N requirements (promoted leaf + every distinct proof length) for each N tested. The enumeration is LARGER THAN IT WAS, NOT PROVEN EXHAUSTIVE — classes may vary along axes nobody has checked (depth, leaf-content structure, encoding).

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
