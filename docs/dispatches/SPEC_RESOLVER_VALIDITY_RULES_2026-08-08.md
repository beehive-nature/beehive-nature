# SPEC — RESOLVER VALIDITY RULES + TEST VECTORS (2026-08-08, rev 3)
**From:** goose (instrument-reading) · **To:** Code
**Authority:** Seat 0 delegation reset + World A timestamp-basis + grace-period ruling (2026-08-08)
**Law:** crate+ref (8a), provenance (8c), post-op register
**Rev 3:** grace_period ruled 28 days (not 30d placeholder). One namespace rhythm: 28d change / 365d term / 28d grace. TV12 boundary adjusted. No other vectors affected.

## DESIGN PRINCIPLE
Every ruled property of a `.b` name is a field of the **signed bDiD record**, verified off-chain by the resolver. The anchor contract stores only epoch Merkle roots (O(DAOs x epochs), 144-row ring per bdid-architecture-decision.md:137). The resolver fetches signed records from Autonomi/Arweave via the epoch root and enforces these rules. No per-name contract call. No fee. No admin. No RAM per name.

**Timestamp basis:** validity evaluates against a **record-carried signed timestamp** (`signed_at`), with the **epoch root as the ordering witness**. The resolver uses `epoch_time` (the latest epoch root's anchored timestamp) for expiry and grace checks. **Wall-clock is advisory only.** (World A, efad970: bTiMeLiNe is forward-only and chronological.)

**Namespace rhythm (one rhythm, three values):**
- Change: no more than once per **28 days**
- Term: **365 days** from signing
- Grace: **28 days** after lapse

## SIGNED RECORD MODEL

    Record {
      name:            string         // [a-z0-9-]{1,32}, lowercase
      owner:           public_key     // bDiD Layer-0 keypair
      revision:        uint32         // 1 = initial; monotonic
      signed_at:       time_point_sec // RECORD-CARRIED signed timestamp; Unix seconds
      expires_at:      time_point_sec // signed_at + 365*86400 (one term)
      prev_signed_at:  time_point_sec // signed_at of previous revision; 0 if revision==1
      payload:         bytes          // chain addresses, biometric refs, etc. (opaque to rules)
      sig:             bytes          // Ed25519 over canonical(name|owner|revision|signed_at|expires_at|prev_signed_at|payload)
    }

## VALIDITY RULES

**R0 — WORLD A (FORWARD-ONLY REVISION CHAIN).** For `revision > 1`: `signed_at >= prev_signed_at`. Backdating = REJECT unconditionally. Epoch root is the ordering witness. (World A, efad970.)

**R1 — SIGNATURE.** `verify(owner, canonical(record_without_sig), sig)` passes. Else REJECT.

**R2 — TERM (365-DAY EXPIRY).** `epoch_time <= expires_at`. Else EXPIRED -> R5. `epoch_time` = latest epoch root's anchored timestamp (NOT wall-clock).

**R3 — REVISION GAP (28-DAY CHANGE LIMIT).** For `revision > 1`: `signed_at - prev_signed_at >= 28 * 86400`. For `revision == 1`: always passes. Resolver MUST verify `prev_signed_at` against actual previous record. Else REJECT.

**R4 — PER-bDiD CAP.** Owner's active name count <= cap. Enforced at signing/indexing. Resolver SHOULD verify if uniqueness-layer available.

**R5 — GRACE / LAPSE.** If EXPIRED (`epoch_time > expires_at`):
- `epoch_time - expires_at <= 28 days`: **GRACE**. Original owner can reclaim. Others CANNOT register.
- `epoch_time - expires_at > 28 days`: **LAPSED**. Name returns to pool. Any user can register (revision resets to 1).

`grace_period = 28 days` (ruled by Seat 0, 2026-08-08).

## TEST VECTORS

Legend: `epoch_time = T` (latest epoch root's anchored timestamp). `grace_period = 28d` (ruled). `d = 86400 sec`.

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
| TV10 | R5 new owner in grace | 1 | T-1d | T+364d | 0 | different | prev GRACE | **REJECT** (grace lock) |
| TV11 | R2 boundary epoch==exp | 1 | T-365d | T | 0 | — | boundary | **ACCEPT** (inclusive) |
| TV12 | R5 boundary ==grace | 1 | T-393d | T-28d | 0 | — | boundary | **LAPSED** (==28d lapses) |
| TV13 | R3 prev_signed_at lie | 2 | T-1d | T+364d | T-100d (false) | same | ACTIVE | **REJECT** (chain) |
| TV14 | R4 cap exceeded | 1 | T-10d | T+355d | 0 | — | ACTIVE | **REJECT at indexing** |
| TV15 | R0 backdated (World A) | 2 | T-50d | T+315d | T-30d | same | ACTIVE | **REJECT** (backdating) |

## NOTES FOR CODE

- **All open flags closed.** Grace period ruled (28d). Timestamp basis ruled (epoch root, World A). Spec is complete.
- **TV12** boundary updated from T-30d to T-28d (grace boundary follows the ruled value). `signed_at` adjusted from T-395d to T-393d to maintain the 365-day term.
- **TV15** tests World A: revision 2 claims `signed_at = T-50d` but previous was `T-30d`. Backdated — R0 rejects.
- **TV13** tests revision-chain consistency: signer lies about `prev_signed_at`. Resolver fetches previous and compares.
- **TV14** enforced at indexing (uniqueness layer), not purely at resolution.
- Resolver is NOT stateless: R0, R3, R5 require the **previous record**. R4 requires **uniqueness-layer** access.
- Epoch root dual role: (1) Merkle root proves integrity; (2) anchored timestamp provides ordering witness.

## SCOPE FENCE
Resolver validity rules + test vectors ONLY. Anchor contract (144-row ring), storage layer, signing/indexing pipeline, uniqueness layer are separate. File under kernel docs. **Anything beyond is out of scope. Execute the prompt as written.**
