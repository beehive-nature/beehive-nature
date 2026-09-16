# ADVERSARIAL-BPAY-SPECS — executable test specifications for the AV queue

**Mission (founder order, 2026-09-16):** turn AV-1/2/3 (P0) into executable test
specifications with exact pass/fail criteria and target components; then roll into P1.
**zArcheology designs tests; it does not fix.** Protocol for every spec: the implementing
workerb writes the test FIRST (expected RED where a gap was proven), demonstrates the gap,
then fixes to GREEN in the same lane. AV-2 is the founder-named first implementation target.

Companion artifact: `docs/agents/ADVERSARIAL-BPAY-QUEUE.md` (the graded audit). Targets cited
at current main unless noted.

---

## SPEC AV-2 — stale conversion quote / TTL replay (P0, HEAD OF QUEUE)

**Target components:** `crates/voucher-escrow/src/lib.rs` — the `deposit_usdc` cited-rate
acceptance path and the quote/rate type it consumes; mirror case for the serve-side rate
source `scripts/buzz-meter/rate_set.json` as loaded by the serve bridge.
**Test file to create:** `crates/voucher-escrow/tests/stale_quote_replay.rs` (+ a serve-side
case in the AV-1 harness below).
**Precondition/founder input:** the TTL constant is a ruling (spec parameterizes it,
`QUOTE_TTL_SECS`, fail-closed default 300 suggested; the law decision gates the number, not
the test shape).

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 2.1 | fresh quote (age < TTL) deposits | credit math unchanged: exact units × rate, ledger row appended, chain verifies | any refusal or rounding drift |
| 2.2 | stale quote (age > TTL) **GAP DEMO — write RED first** | typed refusal (new `DepositError::StaleQuote` or equivalent), **zero** ledger mutation: chain hash identical to pre-state, no row, no partial credit | any acceptance (TODAY'S behavior — this is the proven hole: zero ttl/expiry/valid_until/stale hits in the crate at main `973e188e`) |
| 2.3 | boundary age == TTL | refused (expiry inclusive, fail closed) | accepted |
| 2.4 | quote replay (already-consumed quote id, even if fresh) | refused independent of staleness; single-use quotes | second credit |
| 2.5 | serve-side: `rate_set.json` older than TTL at session open | new sessions refused with typed error; open sessions settle only on in-force rates | charging derived from stale file |

**Definition of done:** 2.1–2.5 green; the RED run of 2.2/2.5 receipted in the implementing
lane's dispatch (that receipt is what charters the TTL fix, per founder order).

## SPEC AV-1 — serve-bridge crash / concurrency / hostile input (P0)

**Target components:** the PRODUCTION SERVE boundary — `scripts/buzz-meter/meter.py` (serve
mode) over `voucher_escrow.py` — not the engines (already CI-covered by
`test_voucher_escrow.py` / `test_x402_meter.py`).
**Harness requirements:** spawn the server as a subprocess on an ephemeral port with a temp
ledger dir; scripted HTTP client; deterministic kill points; restart against the same ledger.
The spec asserts observable behavior only — no assumption about the process's threading model
(single-process story UNKNOWN).

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 1.1 | crash mid-settle (SIGKILL after request received, before response) | restart → exactly-once: the operation either completed-with-receipt or never occurred; ledger chain verifies; identical resubmission (same idempotency key) returns the SAME outcome, never a second effect | double credit/debit, chain break, or divergent resubmission outcome |
| 1.2 | concurrent mixed load (N clients: topup + settle + read on one account) | ledger chain valid; conservation holds exactly (Σcredits == Σtopups − Σsettles); no lost update; every response coherent (typed errors allowed, no untyped 5xx) | any conservation drift or lost update |
| 1.3 | hostile-input battery (malformed JSON; wrong types; negative/oversized integers incl. u128-overflow shapes; duplicate JSON keys; unknown fields; oversized bodies; unicode edges) | typed 4xx refusal each; process alive; zero ledger mutation (chain hash unchanged across the battery) | crash, 500, or any state change |
| 1.4 | unknown-response recovery (client got no answer, resubmits same idempotent request) | same outcome returned as the original would have; no second effect | silent second effect or error |

**Negative control (house law):** a deliberately broken harness variant (e.g., idempotency
key ignored) must FAIL 1.1/1.4 — proves the harness detects the class it claims to.
**Definition of done:** 1.1–1.4 green with the negative control demonstrated.

## SPEC AV-3 — meter-vs-delivery-door split-brain (P0)

**Target components:** the accrual↔availability seam — vending/x402 session semantics
(`contracts/vending` §x402; `scripts/buzz-meter/x402_meter.py`) against door health
(`ops/watch/live-door.mjs` lineage: today the door reads session state read-only and parks on
credit-out; **no availability signal feeds accrual at all** — that absence is the target).
**Harness:** controllable door-health flag + session-row fixture (rehearsal chain or
deterministic mock of the session rows; no live-network dependency).

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 3.1 | door unreachable at session tick | **accrual parks**: zero new accepted-charge records during the unavailable window | any charge delta > 0 (charging for undeliverable service) |
| 3.2 | door returns, session still open | accrual resumes from resume-point; **no retroactive charge** for the outage window | backfill of outage-window charges |
| 3.3 | credit-out (existing receipted behavior) | regression-keep: door parks (not kills) exactly per the watch-room receipts | behavior change sneaks in |
| 3.4 | negative control | naive charger (no availability check) is detected: 3.1's delta assertion fails against it | harness cannot detect the class |

**Definition of done:** 3.1–3.3 green, 3.4 demonstrated; the missing invariant (adapter-
availability pause law) proceeds to ruling only after this test proves the gap live.

---

## P1 SPECIFICATIONS (lean; same red-test-first protocol)

**SPEC AV-4 — two-rail correlation audit + handle rotation (R4 enforcement).** Targets:
receipts emitted by `surfaces/spend-audit.js` engine inputs + voucher claim handles from the
serve bridge. Cases: (4.1) one simulated multirail intent → receipts across two rails share
NO identifier beyond the wallet-local plan (payer nonces, session ids, handles all distinct;
assert pairwise disjointness); (4.2) handle review: same principal's handles across sessions
are unlinkable without ledger access (entropy + non-reuse assertions). Pass = audit script +
zero-shared-identifier report; fail = any cross-rail join key found.

**SPEC AV-5 — reorg drill.** Targets: `scripts/buzz-meter` chainpoll cross-check +
`crates/reversibility` (currently unwired) + bindexer paths. Cases: (5.1) inject simulated
fork (block reorg event into the poller's view) → assert flag-not-credit (`meter.py:423` law
made testable) — zero credit on reorged confirmations, explicit flag emitted; (5.2)
reversibility quorum verdicts computed for the fork; (5.3) negative control: crediting
poller is detected. Pass = drill green + flag receipts.

**SPEC AV-6 — retry-storm fee battery (expected RED today).** Target: the policy layer where
failure charges accrue (voucher/x402 meter policy; watchpay refusal semantics as reference).
Cases: (6.1) one obligation driven to fail-and-retry N=10 times → cumulative failure charges
MUST be bounded by an explicit ceiling parameter; (6.2) unbounded accumulation = loud failure.
Pass = bounded total or hard refusal; TODAY: no ceiling exists → RED is the deliverable that
charts the retry-failure-ceiling invariant.

**SPEC AV-11 — R5 human-gas surface audit.** Targets: every wallet PAY-panel rail flow
(`surfaces/wallet.html` + `wallet-adapter-*.js`) and each `docs/DEPLOYMENTS.md` row. Cases:
(11.1) enumerate rail flows end-to-end; assert NO step requires the human to acquire/hold a
native gas token (ETH/EOS/CPU-NET staking) — sponsored/abstracted paths only; (11.2) new-rail
detector: any future rail demanding human-held gas fails the audit. Deliverable: audit table
+ assertions; CI-able later.

---

*Consumption order: AV-2 → AV-1 → AV-3 (P0), then P1 top-down. Every spec's RED run is
receipted in the implementing lane's dispatch; fixes ride the same lane. zArcheology remains
the adversarial designer — no production code touched here. — 2026-09-16.*

---

## P2/P3 SPECIFICATIONS (second roll, 2026-09-16 — after the x402 door landed @`341c9e1d`)

### SPEC AV-7 — two-route payment/delivery separation (P2; D2-approved corpus port)

**Targets:** watchpay reserve→settle ledger (mainline) + the door journal (`ops/x402-door`) for
the payment leg + a delivery-state seam that does NOT exist yet (the D2 MINE target — its
absence is what the RED run proves). **Reference:** banked corpus `core/tests/two_route.rs` +
ADDENDUM-0.3 §7 (the mandatory two-route acceptance test), byte-readable at
`docs/handoffs/silentpay-v2/`.

Scenario: ONE approved plan, TWO legs — compute (settles) + storage (times out) — independent
budgets, unrelated external references, hard plan-level ceiling.

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 7.1 | compute leg completes + settles; storage leg then fails | earned compute claim PRESERVED (never reversed, never re-run) | any reversal or re-execution of the paid leg |
| 7.2 | plan-level double-debit probe | total debits ≤ plan ceiling incl. fees; no second payment for the settled compute leg | any double debit |
| 7.3 | storage payment reconciliation | exact domain/tx evidence; quoted assurance policy applied; unknown → reconcile the ORIGINAL obligation (couples to AV-8) | fresh-identifier resubmission |
| 7.4 | state independence **(RED today — the deliverable)** | PaymentState and DeliveryState tracked as independent machines: paid-but-not-delivered is representable and SURFACES (final: payment=confirmed, delivery=failed on storage; both verified on compute) | any coupling (delivery failure auto-reversing payment, or payment state overwriting delivery state) |
| 7.5 | refund rules | unused storage reservation refunded; NO fee charged for an unused timed-out reservation (corpus sprint03 law) | fee or retention on unused timeout |
| 7.6 | negative control | a coupled implementation (delivery-fail → auto-refund of settled compute) is DETECTED by 7.1/7.4 | harness blind to coupling |

**Definition of done:** 7.1–7.5 green (7.4 RED first, charters the D2 typed separation), 7.6
demonstrated. The door's journal laws 2/3/4 already pin the payment-side semantics — this spec
drives them END-TO-END with a second (storage) leg.

### SPEC AV-8 — settle-UNKNOWN reconciliation (P2)

**Targets:** door journal (Unknown → HumanGate is law-pinned; `ops/x402-door/tests/acceptance.rs`)
+ `scripts/buzz-meter/meter.py` chainpoll. **Reference:** corpus sprint03 recovery planner +
corpus AGENTS.md law ("Unknown transaction status is not failure and MUST NOT trigger a new
payment under a fresh identifier").

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 8.1 | tx submitted, response lost | poll authoritative chain; outcome = the ORIGINAL obligation's fate; no second tx under a different idempotency key; exactly-once eventually | fresh-key resubmission or permanent stall without flag |
| 8.2 | delayed inclusion | late confirmation reconciles to confirmed; no re-sign | re-sign after delayed confirm |
| 8.3 | genuinely lost/expired tx | bounded replacement RETAINS the same logical obligation (same idempotency scope); cannot double-execute; replacement deadline/budget explicit | replacement creating new spending authority |
| 8.4 | crash-restart across the unknown window | journal replay reaches the same decision (watchpay C1–C4 mechanics verbatim) | divergent post-restart decision |
| 8.5 | negative control | fresh-key retry implementation DETECTED (assert idempotency-scope equality) | harness cannot detect |

**Definition of done:** 8.1–8.4 green against the door journal and the meter poller; 8.5
demonstrated. (Workerb 2's receipt already names this as their roll-forward consumer.)

### SPEC AV-9 — proof-root without witness / escape-path loudness (P3; R3's second sentence)

**Targets:** rehearsal privacy notes (`contracts/privacy`, `noteacct4`/`plonknote11` lineage,
SPEC-PRIVACY-1 §m3/§m4) + M9 anchoring shape.

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 9.1 | baseline: deposit → witness present → withdraw | succeeds (regression-keep of §m3 receipts) | any regression |
| 9.2 | witness LOST after deposit **(RED-or-LOUD today)** | the failure mode is LOUD: explicit error/flag naming witness loss, documented exit options (owner-held disclosure per §m3); no silent lock, no silent success | silent fund-lock with zero surfaced state |
| 9.3 | witness-retention audit | a written answer to "where do note witnesses live, with what redundancy" (founder question, named by test) | question remains unanswerable |
| 9.4 | M9 head-anchoring regression | anchored payload contains chain-head commitment and ZERO per-receipt identifiers (root ≠ receipt list — R3 practiced shape) | any receipt-shaped anchoring |
| 9.5 | negative control | silent-lock variant DETECTED by 9.2 | harness blind |

### SPEC AV-10 — adapter substitution behind the ring (P3; R5 mechanism proof)

**Targets:** the door's law-7 door-swap seam (ALREADY PROVEN with a second impl — the landed
slice) generalized to the wider ring: storage/chain trait-fronted adapters + a ring-bypass lint.

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 10.1 | one trait-fronted adapter swapped for a test double with behavior markers | callers above the ring observe ZERO interface change (same CanonicalEvents, same error taxonomy); only config differs | any caller-visible difference |
| 10.2 | ring-bypass lint **(RED today — the deliverable)** | CI gate: no direct third-party endpoint import/call above the adapter layer (extend the estate-source/dock-claims pattern) | bypass call passes silently |
| 10.3 | door-scheme registry extension (when live-wiring lands) | registering a new scheme slug + handler reflects in `supported` with ZERO door-code change (the ADOPTed seam's contract, now CI-guarded) | code change needed |
| 10.4 | negative control | a ring-bypassing caller is DETECTED by 10.2's gate | gate blind |

## DOOR-SURFACE WATCHLIST — attacks pre-registered against the LANDED door (`ops/x402-door`)

*The door shipped with 8 test-pinned laws + one honest FLAG (live-wiring composition
default-OFF). These attacks are pre-registered BEFORE the door runs live, per adversarial
discipline; each becomes a D-spec when its lane opens:*

- **D-1 dual-mode acceptance:** the 8-point contract must run green in BOTH feature modes;
  live-wiring ON must not weaken any law (first green Linux compile is itself an acceptance point).
- **D-2 cap-rollover exposure:** FailedKeep RETAINS no-evidence-failure exposure — define-by-test
  what happens to retained exposure at the daily-cap rollover (no silent double-count, no silent reset).
- **D-3 settle-time float drain:** float is fail-closed at `/verify`; attack = many reserves, then
  sequential settles with gas moving — assert no torn states and loud settle-time refusal when
  the float depletes mid-flight (law 1 extended to settle time).
- **D-4 release-evidence adversary:** expiry release requires on-chain non-settlement evidence —
  RPC unavailable → fail-closed HOLD (no silent release); malformed/lying RPC answer → release
  only on the verified evidence shape.
- **D-5 journal concurrency:** second door process against the same journal_root refuses NAMED
  (lock law), never corrupts (torn law 5 covers corruption; concurrent-start refusal is separate).
- **D-6 journal exfiltration hygiene:** journal_root must be unreachable from any served path
  (Caddy config review; per-chain dirs + truncated payer tags keep R4 — but mtimes/filenames
  must not be web-readable).
- **D-7 HumanGate immutability:** no code path auto-retries Unknown — behavioral (no retry within
  test horizon) + structural (call-site audit) assertions.
- **D-8 upto-at-reconcile adversary:** adversarial settle where actual > authorized → refusal
  with evidence retention (FailedKeep), never a clamped silent settle.

---

*Pipeline law (founder, 2026-09-16): zArcheology attacks → executable RED tests → builder
proves RED → builder fixes GREEN → CI arbitrates. This seat designs tests only; production
code untouched. — second roll, 2026-09-16.*
