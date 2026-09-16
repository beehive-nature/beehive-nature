# ADVERSARIAL-BPAY-QUEUE — attack the ten stable boundaries, find what's missing

**Mission (founder order, 2026-09-16, verbatim):** "Turn the ten stable boundaries + R1–R5 +
GLOSSARY-BRIDGE into an adversarial architecture audit of bPay. Attack boundary failures:
cross-rail identity linkage, replay/double settlement, fee-cap escape, payment↔delivery
coupling, proof-root mistaken for availability, adapter becoming mandatory infrastructure, gas
abstraction leaking native-gas requirements to humans, and recovery after UNKNOWN states. Use
existing code/tests/receipts. Find missing invariants and missing tests; don't implement them.
Output a prioritized adversarial test queue that implementation workerbs can consume
continuously."

**Method:** each attack class is graded against what EXISTS (code/tests/receipts, cited; `[ARCH]`
= inherited from GLM-ARCHAEOLOGY, the rest verified at current main) — then the MISSING
INVARIANT (law-shaped hole) and MISSING TEST are named. Nothing here is implemented. The §M
HOLD on the old archaeology queue still stands; this queue *reframes* its test-shaped items
(§M.9) adversarially and supersedes nothing without workerb chartering.

---

## A1 · Cross-rail identity linkage (R4; boundaries: SpendReceipt wire, bzDiD/capability)

**HOLDS:** R4 law landed (`docs/RULINGS-2026-09-16.md` R4); receipts are per-rail with
`spender_bdid` (DID, not account) and private-by-default visibility; corpus per-leg unrelated
session IDs (banked spec §2).
**MISSING INVARIANT:** no law/test forbids the SAME voucher/claim handle, payer nonce, or
session id appearing across two rails' receipts — R4 forbids the wallet-global id, but nothing
audits handle-rotation or correlation of the meter's claim handles across sessions.
**MISSING TEST:** AV-4 (P1) — two-rail correlation audit: emit receipts for a simulated
multirail intent; assert no shared identifier beyond the private wallet-local plan; plus a
handle-entropy/rotation review of `meter.py serve` voucher handles.

## A2 · Replay / double settlement (boundaries: x402 law set, vending rate-row, SpendReceipt)

**HOLDS:** vending nonce burn "even at zero" (`contracts/vending/src/vending.cpp:23`);
watchpay 121 mainline tests incl. replay; corpus 45+68 checks incl. native+EVM replay both
directions; escrow-core exhaustive state×event matrix; spend-audit `PENDING_ANCHOR` state.
**MISSING INVARIANT:** reorg handling on live pollers is a cross-check flag, not a quorum —
the `reversibility` crate exists for exactly this and is unwired `[ARCH §H]`; no
unknown-status reconciliation law for Jungle4 push paths (meter/watch) `[ARCH §I.6]`.
**MISSING TEST:** AV-5 (P1) — reorg drill (simulated fork into chainpoll/bindexer; assert
flag-not-credit at `meter.py:423` + reversibility quorum verdicts); AV-8 (P2) —
settle-unknown drill for the door/pollers (tx submitted, RPC lost: reconcile the original
obligation, never re-sign under a fresh idempotency key).

## A3 · Fee-cap escape (boundaries: vending rate-row, capAssert, x402 law set)

**HOLDS:** vending fees inside the `upto` ceiling signed once; watchpay worst-case native-fee
sealing; bsigner x402 exact-multi invariants; corpus MeterReceipt "fees count AGAINST the
funded ceiling".
**MISSING INVARIANT:** **cited conversion rates carry no TTL** — verified at current main
(`crates/voucher-escrow/src/lib.rs`: zero hits for ttl/expiry/stale) — a quote can be replayed
at a stale rate `[ARCH §I.4]`, now FACT. No retry-failure aggregate ceiling: a leg that fails
N times can charge N failure fees with no cumulative bound (corpus FeePlan names
failure-charge + retry ceilings; the estate has neither).
**MISSING TEST:** AV-2 (P0) — expired-quote refusal at `deposit_usdc` (TTL field + refusal is
implementation; the TEST is the deliverable first: today it provably accepts stale quotes);
AV-6 (P1) — retry-storm battery: repeated failure + retry on one obligation; assert bounded
cumulative failure charges (will fail today — that is the point).

## A4 · Payment ↔ delivery coupling (boundary: Payment/Delivery separation)

**HOLDS:** watch-room pause-not-kill receipted (settle while paused, chat alive); watchpay
delivery evidence mainline; corpus PaymentState/DeliveryState machines implemented in the
corpus core with the mandatory two-route acceptance test.
**MISSING INVARIANT:** nothing typed on the estate side asserts paid ≠ delivered (the
separation is practice + corpus law, not an estate invariant).
**MISSING TEST:** AV-7 (P2) — port the corpus two-route acceptance fixture as an estate test
(compute settles, storage times out: earned claim preserved, no double debit, recovery within
budget; reference `core/tests/two_route.rs` in the banked corpus; D2-MINE-approved as test
capital).

## A5 · Proof-root mistaken for availability (R3; boundary: suite-keyed agility seam)

**HOLDS:** R3 law landed; M9 anchors the chain head, never receipt lists; checkpoints fold
inline.
**MISSING INVARIANT:** R3's own second sentence — "value-bearing acceptance … requires
independently recoverable state, receipt retention, and a tested escape path" — has no
witness-retention policy and no escape-path test anywhere in the estate (corpus sprint03
recovery drills are the only rehearsals, and they live outside the repo).
**MISSING TEST:** AV-9 (P3) — root-present-witness-lost drill on the rehearsal privacy notes:
deposit, destroy/lose witness state, assert the exit path still functions (or fails LOUD, not
silently); plus a witness-retention decision (where note witnesses live) — a founder question,
named not answered.

## A6 · Adapter becoming mandatory infrastructure (boundaries: adapter-ring, CanonicalEvent)

**HOLDS:** chains-are-adapters law (CONSTITUTION Art. III); adapter-ring rule; watch live-door
fails closed 503 on credit-out; vending successor-able roles with negative proofs
(`RECEIPT-JUNGLE4-PERMISSIONS-2026-08-29.md`, tracked).
**MISSING INVARIANT:** no adapter-availability pause law — if the delivery door dies while the
meter keeps accruing, users pay for undeliverable service; substitutability is trait-shaped
but never proven end-to-end.
**MISSING TEST:** AV-3 (P0) — meter-vs-door split-brain: kill the door, keep the meter; assert
accrual parks (or refunds) rather than charging; AV-10 (P3) — adapter-substitution drill:
swap one adapter behind the ring with zero surface change (proves replaceability, the R5
mechanism).

## A7 · Gas abstraction leaking native gas to humans (R5)

**HOLDS:** R5 law landed; b-meter/capAssert/x402 mediation on the live A-rail (users never
touch CPU/NET); USDC deposit rail is server-side (box pays gas); NWC allowance; the x402 door
design carries a daily gas cap + HumanGate.
**MISSING INVARIANT:** no R5 detector — nothing audits surfaces/rails for human-held native
gas requirements (a rail row demanding the user hold ETH/EOS for gas would land unnoticed).
**MISSING TEST:** AV-11 (P1) — R5 surface audit: enumerate every wallet PAY-panel rail flow;
assert no step requires the human to acquire/hold a native gas token; becomes a CI-able
invariant later. Door acceptance gets its own gas-cap boundary test when chartered (Workerb 2
lane — named here for completeness, not assigned).

## A8 · Recovery after UNKNOWN states (boundaries: Payment/Delivery separation, x402 law set)

**HOLDS:** watchpay durable intent→signed→outcome with crash points C1–C4; corpus
sprint03 node-restart + owner-only-key recovery (68 checks); mismatch-is-a-flag-not-credit
(`meter.py:423`, verified).
**MISSING INVARIANT:** the LIVE serve bridge has no crash/UNKNOWN story — engine units are
CI-tested (`scripts/buzz-meter/test_voucher_escrow.py`, `test_x402_meter.py`, voucher battery)
but `meter.py serve` (the production voucher door) has no concurrency, hostile-input, or
crash-restart test `[ARCH §H/§J, narrowed by verification: engines covered, serve bridge not]`.
**MISSING TEST:** AV-1 (P0) — serve-bridge drill: kill -9 mid-settle, concurrent
settle/topup/read races, malformed bodies; assert single-charge and reconciled state on
restart.

---

## The prioritized queue (implementation workerbs consume top-down)

| # | item | attack class | acceptance shape | priority |
|---|---|---|---|---|
| AV-1 | voucher serve-bridge crash/concurrency/hostile-input drill (kill -9 mid-settle; races; malformed bodies; single-charge + reconciliation on restart) | A8 | battery green; restart receipt | **P0** |
| AV-2 | stale-rate replay refused at `deposit_usdc` (TTL missing = verified FACT; test first, fix after) | A3 | stale quote refused, fresh accepted | **P0** |
| AV-3 | meter-vs-door split-brain (door down, meter live → accrual parks/refunds, never charges for undeliverable) | A6 | pause law observable in test | **P0** |
| AV-4 | two-rail correlation audit + voucher handle rotation review (R4 enforcement) | A1 | no shared identifier across rails; handle unlinkability stated | **P1** |
| AV-5 | reorg drill into chainpoll/bindexer (flag-not-credit + reversibility quorum) | A2 | injected fork → flag, no credit | **P1** |
| AV-6 | retry-storm fee battery (bounded cumulative failure charges — will fail today) | A3 | bounded total or loud refusal | **P1** |
| AV-11 | R5 human-gas surface audit (no rail flow requires human-held gas tokens) | A7 | audit table + zero-hits assertion | **P1** |
| AV-7 | two-route acceptance fixture ported from corpus (`core/tests/two_route.rs` reference; D2-approved) | A4 | earned claim preserved, no double debit, recovery in budget | **P2** |
| AV-8 | settle-UNKNOWN reconciliation drill (door/pollers; original obligation, no fresh key) | A2/A8 | unknown → reconciled, never re-signed | **P2** |
| AV-9 | privacy escape-path drill (root present, witness lost → loud fail or working exit) + witness-retention founder question | A5 | exit works or fails LOUD | **P3** |
| AV-10 | adapter-substitution drill behind the ring (swap adapter, zero surface change) | A6 | substitution receipt | **P3** |

*Missing invariants named for law (not implemented here): quote TTL; retry-failure aggregate
ceiling; adapter-availability pause law; handle-rotation policy; witness-retention policy;
unknown-status reconciliation law for pollers. Each becomes a ruling proposal only after its
AV test demonstrates the gap. — zArcheology seat, 2026-09-16. No implementation performed.*

---

## CONSUMPTION LOG

- **AV-6 · CONSUMED + GREEN 2026-09-16** (zCode workerb, founder P1 roll after the
  stale-routing correction; verified untaken first — no av6 lane existed). Per-leg
  retry ceiling in `ops/x402-door`: RED receipted behaviorally (4th same-leg
  attempt returned `Ok(Error)` pre-fix — unlimited retry proven live); GREEN =
  `Reservation.settle_attempts` (leg-lifetime, serde-defaulted, outside the state
  enum because the state is `Settling` at failure-record time — state-sourced
  counters reset per cycle, lesson banked in the field doc) +
  `Journal.max_settle_attempts_per_leg` (default 3, override) + loud
  FailedKeep-gated refusal naming attempts and ceiling. Full door suite green
  locally (acceptance 11 + adversarial 10 + d_specs 10); landed `424d0dc0`,
  CI arbitrates. Receipt:
  [`2026-09-16-av6-retry-ceiling-receipt.md`](../dispatches/2026-09-16-av6-retry-ceiling-receipt.md).
  The retry-failure **aggregate ceiling** invariant is now law-shaped in code for
  the door rail (bounded attempts, loud); the ruling-proposal step for other
  rails stands.
  **Founder distinction (2026-09-16, binding):** AV-6's landing bounds
  `max_attempts` (settlement attempts per leg) — NOT yet
  `max_failure_charge` (aggregate monetary failure-fee ceiling across
  heterogeneous attempts). Two complementary limits once actual fee evidence
  is available; never infer one from the other.
- **AV-5 · CONSUMED + GREEN 2026-09-16** (same seat): reorg law at the
  credit boundary — `ReorgFlagged` (prior evidence verbatim + depth) with
  the founder's law verbatim in the refusal (`history changed, outcome
  UNDETERMINED -- replay refused, evidence preserved; the flag never decides
  refund, debit, or settlement`), human-gated + upto-bounded `resolve_reorg`,
  history preserved in `Settled.reorg_note`. Landed `f99cd316`; hex-law
  blocked the first attempt (synthetic 58-hex-char test tx — receipted).
- **AV-4 · CONSUMED + GREEN 2026-09-16** (same seat): `tests/r4_audit.rs`
  value-level cross-rail join detector + deliberately leaking fixture;
  first known-good run FAILED on 18 hits (keys-vs-values + the harness
  sharing payTo/asset/payer/tx across rails — the real R4 lesson banked:
  same-bytes-on-two-rails IS the join). Plus a genuine timing flake fixed
  (LegKey includes valid_before; per-call far_future() made rebuilt legs
  differ across second boundaries — capture once). Landed `8a94a986`.
- **AV-11 · CONSUMED + CLEAN VERDICT 2026-09-16** (same seat):
  `scripts/r5-surface-audit.mjs` (selftest-validated ask-shaped detector;
  labeled-fallback exemption) — **live scan 113/113 surfaces, ZERO
  human-gas asks: R5 HOLDS today.** Landed `eeb541d7`; CI-wiring named for
  the pipeline owner.
- **P0/P1 RECONCILIATION MATRIX produced 2026-09-16** (founder stop-order):
  [`2026-09-16-av-matrix-reconciliation.md`](../dispatches/2026-09-16-av-matrix-reconciliation.md)
  — every landed protection is currently a REPOSITORY LAW, not yet a
  production protection; per-row live-wiring blockers named (door Sepolia →
  founder-gated prod; serve-bridge token+rates; TTL ruling; split-brain
  live drill; flag_reorg notifier wiring; r4-audit on production stores;
  r5 CI step). **Consumption of new adversarial items is PAUSED for one
  reconciliation pass per founder order.**
