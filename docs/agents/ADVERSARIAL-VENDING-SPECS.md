# ADVERSARIAL-VENDING-SPECS — the LIVE Jungle4 settlement contract attacked

**Born 2026-09-16, after the founder froze the zArcheology authority lane (MP→RB→AB→RV→DG
complete; builder consumption next; this seat attacks a DIFFERENT domain until the builder's
wrong-assumptions report returns).** Target: `contracts/vending` — the estate's ONLY live
contract (Jungle4 `bnrapolltest`, LIVE per `docs/DEPLOYMENTS.md`; x402 meter sessions
receipted). Never adversarially audited: coverage today is receipt-driven (11/11 at deploy),
which the archaeology already flagged as honest-but-not-regression-protecting. Pipeline law
unchanged: builder proves RED, fixes GREEN, CI arbitrates; zArcheology designs tests only.

*Contract facts cited from source (`src/vending.cpp`): rates table governed-mutable, one row
per rail — basis + `tithe_bp`; sessions carry `ceiling` (the upto max) **signed once at
open**, charges clamp under it; **single-use nonces burn even at zero** (the Tally
X402UptoProxy law — the stateful party); tithe = singleton, founder-word-only.*

## ROLL V1 — the live contract's six attack classes (RED-first)

### SPEC VV-1 — governed-mutable pricing under open sessions

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 1a | rate-row mutation BETWEEN opensess and settle | charges price at the OPEN-time row (snapshot per session) OR settle refuses typed — **defined-by-test, never silent repricing under a signed ceiling** | settle charges under the mutated row unnoticed |
| 1b | tithe split arithmetic at rounding boundaries | provider_credit + tithe_credit == total_charge EXACTLY at every rounding edge (floor-of-total vs sum-of-floors leak = rounding-skim) | sub-unit value vanishes into neither party |
| 1c | adversarial rows | tithe_bp > 10000 refused at setrate; basis zero priced lawfully; precision-mismatched rate units vs asset symbol refused | 100%+ tithe accepted; precision coercion |

### SPEC VV-2 — session lifecycle, nonce burn, conservation

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 2a | settle above the signed ceiling | CLAMPS to ceiling exactly (the signed-once law) AND still consumes the nonce | refuse-then-no-burn, or charge above |
| 2b | nonce replay (same nonce, any amounts) | second settle refused — the stateful party holds | double credit |
| 2c | orphan settle (nonce never opened) | refused | credit from nothing |
| 2d | conservation, every settle | provider + tithe credits == total charged, per-asset, exact — no cross-asset netting | drift |
| 2e | zero-charge settle | nonce burns anyway (Tally law pinned) | free replay window |

### SPEC VV-3 — custody, successor, pause

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 3a | unauthorized setrate/settithe/pause | refused (negative probes exist in receipts — pin them as regression specs) | governed actions open |
| 3b | successor rotation drill | rotate the authority: old key refused, new key operates, sessions unaffected — drill-ABLE as a test, not a one-time manual receipt | rotation untestable |
| 3c | pause semantics vs OPEN sessions | pause blocks NEW exposure (opensess) while already-open sessions still settle their earned charges — the corpus pause law ("stop new exposure; preserve qualified claims"); **defined-by-test** | open sessions silently trapped or drained |

### SPEC VV-4 — C++/CDT integer shapes

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 4a | hostile quantities/prices (asset-max × rate; huge batch charges in one settle) | typed refusal BEFORE mutation; additive overflow in cumulative charge accumulation checked | u64/asset wraparound silently accepted |
| 4b | time fields at boundaries (block_timestamp edges in session windows) | fail-closed refusal | boundary wrap |

### SPEC VV-5 — x402 law conformance, on-chain

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 5a | the five meter laws where the contract enforces them | canonical decimal atomic units; upto = signed ceiling + actual ≤; idempotency by nonce; missing rate row for a rail → REFUSED (no default pricing); fail-closed shapes | default-price fallback; non-atomic units |

### SPEC VV-6 — negative controls

Broken-law harness variants (clamp-without-burn; sum-of-floors tithe; post-open repricing;
wraparound accept) each DETECTED by their probe. A harness blind on any axis fails the roll.

**Harness reality (named honestly):** no in-tree contract test dir exists today — coverage is
receipt-driven. The builder adds `contracts/vending/tests` (CDT suite) runnable in the CI Linux
job; where CI cannot run CDT, probes land as scripted box/local drills WITH receipts (the
receipt-driven house pattern — each drill banked like `RECEIPT_VENDING_*`). RED-likeliest:
1a (open-time pricing pin unknown), 3c (pause semantics unpinned), 1b (rounding edge).

*V1 roll, 2026-09-16. New artifact — the authority specs file is FROZEN per founder order and
untouched. Single-writer discipline carries over to this file.*
