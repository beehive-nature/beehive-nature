# SPEC — RESOLVER VALIDITY RULES + TEST VECTORS (2026-08-08, rev 4)
**From:** goose (instrument-reading) · **To:** Code
**Authority:** Seat 0 delegation reset + World A + grace + epoch_time=block-time rulings
**Rev 4:** R5 grace boundary EXCLUSIVE (< not <=). Boundary asymmetry STATED. Rule-application order SPECIFIED. Grace lock clarified: constrains the PREVIOUS record. epoch_time = BLOCK TIME.

## DESIGN PRINCIPLE
Every ruled property of a `.b` name is a field of the **signed bDiD record**, verified off-chain by the resolver. The anchor contract stores only epoch Merkle roots (144-row ring). No per-name contract call. No fee. No admin.

**Timestamp basis:** `epoch_time` = **BLOCK TIME** (chain-derived, unforgeable by the anchoring party). The sequencer never asserts time. The resolver is a **PURE FUNCTION** of `(record, epoch_time)`: given a record and the block time from the epoch root, it returns ACCEPT or REJECT. Wall-clock is advisory only. The lifecycle proof runs the resolver offline with synthetic epoch_time at each stage; the chain proves only anchoring and ordering. (World A, efad970.)

**Namespace rhythm:** 28d change / 365d term / 28d grace (one rhythm, three values).

## SIGNED RECORD MODEL

    Record {
      name:            string         // [a-z0-9-]{1,32}, lowercase
      owner:           public_key     // bDiD Layer-0 keypair
      revision:        uint32         // 1 = initial; monotonic
      signed_at:       time_point_sec // RECORD-CARRIED signed timestamp; Unix seconds
      expires_at:      time_point_sec // signed_at + 365*86400 (one term)
      prev_signed_at:  time_point_sec // signed_at of previous revision; 0 if revision==1
      payload:         bytes          // chain addresses, biometric refs, etc. (opaque)
      sig:             bytes          // Ed25519 over canonical(name|owner|revision|signed_at|expires_at|prev_signed_at|payload)
    }

## VALIDITY RULES

**R0 — WORLD A (FORWARD-ONLY).** For `revision > 1`: `signed_at >= prev_signed_at`. Backdating = REJECT unconditionally. (efad970.)

**R1 — SIGNATURE.** `verify(owner, canonical(record_without_sig), sig)` passes. Else REJECT.

**R2 — TERM (365-DAY EXPIRY).** `epoch_time <= expires_at` (**INCLUSIVE** — at exactly expires_at: ACTIVE). Else EXPIRED -> R5.

**R3 — REVISION GAP (28-DAY).** For `revision > 1`: `signed_at - prev_signed_at >= 28 * 86400`. Else REJECT.

**R4 — PER-bDiD CAP.** Owner's active name count <= cap. At indexing.

**R5 — GRACE / LAPSE.** If the record is EXPIRED (`epoch_time > expires_at`):
- `epoch_time - expires_at < grace_period` (28 days) (**EXCLUSIVE** — at exactly 28d: LAPSED): **GRACE**. Original owner can reclaim. Others CANNOT register.
- `epoch_time - expires_at >= grace_period`: **LAPSED**. Name returns to pool. Any user can register (revision resets to 1).

## RULE-APPLICATION ORDER

The resolver evaluates a record in this order. Early rejection short-circuits:

1. **R1 (signature)** — invalid sig -> REJECT
2. **R0 (World A)** — backdated signed_at -> REJECT
3. **R3 (revision gap)** — gap < 28d -> REJECT
4. **R5 (GRACE LOCK on the PREVIOUS record)** — when a new record is published for a name with an existing previous record:
   - Previous ACTIVE: new record must be revision > 1 from the SAME owner
   - Previous GRACE: new record must be from the SAME owner (reclaim); different owner -> REJECT
   - Previous LAPSED: any owner; revision resets to 1
   - No previous (first registration): any owner; revision = 1

   **The grace lock constrains the PREVIOUS record, not the one being resolved.** The resolver checks the PREVIOUS record's expiry state to determine whether a new publication is allowed. TV10 tests this: a different owner is REJECTED during grace.

5. **R2 (term)** — the record itself must not be expired for normal resolution (an expired record enters R5 for its own grace/lapse state)
6. **R4 (cap)** — owner's name count at indexing

## BOUNDARY ASYMMETRY (stated, not inferred)

| Boundary | Type | At exactly the boundary |
|---|---|---|
| Term (R2) | INCLUSIVE: `epoch_time <= expires_at` | ACTIVE |
| Grace (R5) | EXCLUSIVE: `epoch_time - expires_at < grace_period` | LAPSED |

An implementer must not have to infer this from a vector annotation.

## TEST VECTORS

Legend: `epoch_time = T` (block time from latest epoch root). `grace_period = 28d` (ruled). `d = 86400 sec`.

| # | Rule | rev | signed_at | expires_at | prev_signed_at | prev owner | State | Expected |
|---|---|---|---|---|---|---|---|---|
| TV1 | R0+R1+R2 valid | 1 | T-100d | T+265d | 0 | — | ACTIVE | **ACCEPT** |
| TV2 | R2 expired+lapse | 1 | T-400d | T-35d | 0 | — | LAPSED | **LAPSED** (pool) |
| TV3 | R5 grace | 1 | T-370d | T-5d | 0 | — | GRACE | **GRACE** (owner-only) |
| TV4 | R3 too soon | 2 | T-10d | T+355d | T-20d | same | ACTIVE | **REJECT** (gap=10d < 28d) |
| TV5 | R3 boundary 28d | 2 | T-1d | T+364d | T-29d | same | ACTIVE | **ACCEPT** (gap=28d) |
| TV6 | R3 renewal early | 2 | T-1d | T+364d | T-200d | same | ACTIVE | **ACCEPT** (gap=199d) |
| TV7 | R1 bad sig | 1 | T-10d | T+355d | 0 | — | ACTIVE | **REJECT** (sig) |
| TV8 | R5 reclaim in grace | 2 | T-1d | T+364d | T-200d | same | prev GRACE | **ACCEPT** (owner) |
| TV9 | R5 new owner after lapse | 1 | T-1d | T+364d | 0 | different | prev LAPSED | **ACCEPT** (pool) |
| TV10 | R5 new owner in grace | 1 | T-1d | T+364d | 0 | different | prev GRACE | **REJECT** (grace lock on PREV) |
| TV11 | R2 boundary epoch==exp | 1 | T-365d | T | 0 | — | boundary | **ACCEPT** (inclusive) |
| TV12 | R5 boundary ==grace | 1 | T-393d | T-28d | 0 | — | boundary | **LAPSED** (exclusive: ==28d lapses) |
| TV13 | R3 prev_signed_at lie | 2 | T-1d | T+364d | T-100d (false) | same | ACTIVE | **REJECT** (chain) |
| TV14 | R4 cap exceeded | 1 | T-10d | T+355d | 0 | — | ACTIVE | **REJECT at indexing** |
| TV15 | R0 backdated (World A) | 2 | T-50d | T+315d | T-30d | same | ACTIVE | **REJECT** (backdating) |

## NOTES FOR CODE

- **All three rev-4 fixes resolved contradictions without changing any vector's expected result.** The vectors were correct; the text underspecified. Rev 4 brings text and vectors into alignment.
- **TV10** now has explicit text backing: the grace lock (rule-application order step 4) constrains the PREVIOUS record. A different owner is rejected because the previous record is in grace, not because the current record is invalid.
- **TV12** now consistent: `28d < 28d` is false -> LAPSED. The EXCLUSIVE grace boundary matches.
- **TV13** tests revision-chain consistency: signer lies about prev_signed_at.
- **TV14** enforced at indexing (uniqueness layer).
- Resolver is NOT stateless: R0, R3, R5 require the **previous record**. R4 requires **uniqueness-layer** access.
- epoch_time = BLOCK TIME: the resolver reads it from the epoch root, never from wall-clock.

## SCOPE FENCE
Resolver validity rules + test vectors ONLY. Anchor contract, storage layer, signing/indexing, uniqueness layer are separate. File under kernel docs. **Anything beyond is out of scope. Execute the prompt as written.**
