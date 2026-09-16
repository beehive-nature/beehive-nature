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

---

## D-SPECS — the door watchlist made executable (third roll, 2026-09-16; targets verified against the landed crate)

**Harness (all D-specs):** extend `ops/x402-door/tests/` with `adversarial_d.rs`; reuse the
existing `tmp_root()` / `door()` / `request()` helpers and the test-facilitator double pattern
from `tests/acceptance.rs` (second impl at :329). Pure-journal cases need no facilitator.
Targets named from source: `Journal::{open, get, reserve, settle_precheck, settle_with_evidence,
settle_failed_no_evidence, settle_unknown, expire_released, resolve_unknown,
exposure_for_test}`, `SettleEvidence`, `ReservationState`, `HumanGate::explicit_human_approval`,
`DoorState<F>` (`src/journal.rs`, `src/imp.rs`, `src/wire.rs`). **Priority order per founder:
D-3, D-4, D-5, D-8 first — money-safety exposures.**

### SPEC D-3 — settle-time float drain (P0-class: money safety)

**Target:** the settle path (`imp.rs` settle orchestration + `DoorState` config
`ops_float_available_wei`). Law 1 pins float fail-closed at `/verify` ONLY — the attack is
drain-at-settle-time.

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 3.1 | reserve K legs under a float funding exactly ONE settlement's gas | first settle succeeds; second settle → LOUD typed refusal NAMING the shortfall (mirroring law-1's cap+exposure refusal shape) | silent success, torn state, or untyped panic |
| 3.2 | refused-settle state integrity | journal record for the refused leg byte-identical pre/post (`get()` equality); state remains valid `ReservationState` | mutation or corruption from the refusal path |
| 3.3 | float recovery | after float top-up, the refused settle proceeds under the SAME nonce — exactly-once preserved | fresh nonce / double settle |
| 3.4 | negative control | a float-ignoring settle path is DETECTED (test asserts the refusal occurred) | harness blind |

**RED expectation:** settle-time float check likely absent (law 1 is verify-time) — the RED run
charters the settle-time float law.

### SPEC D-4 — lying-RPC release evidence (P0-class: money safety)

**Target:** `Journal::expire_released(leg, chain_says_unspent: bool)` — the caller's RPC verdict
arrives as a bare `bool`; the journal must defend itself.

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 4.1 | RPC unavailable at release time | door HOLDS (typed hold state, retry path); `expire_released` not called on absent evidence | silent release or crash |
| 4.2 | **contradiction attack:** journal holds `SettleEvidence` for the leg, caller claims `chain_says_unspent=true` | `expire_released(true)` REFUSED as contradictory (evidence-present ⇒ never release); conflict surfaced | release honored despite journal evidence — the double-spend window |
| 4.3 | control: expired window, no evidence, genuine unspent | release proceeds exactly once; double-release refused (terminal state) | second release accepted |
| 4.4 | negative control | blind-bool implementation (releases on caller's word) DETECTED by 4.2 | harness blind |

**RED expectation:** the contradiction check (4.2) is a pure-journal assertion — if absent
today, RED charters it. This is the sharpest money-safety item on the board: releasing a
settled leg reopens spent authority.

### SPEC D-5 — concurrent journal start (P0-class: integrity)

**Target:** `Journal::open(root, cap)` + the exclusive-writer OS lock (watchpay mechanics).

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 5.1 | second `open` on a locked root | typed refusal NAMING the lock holder path; no journal mutation | second handle silently granted |
| 5.2 | lock released on process death | after kill/scoped drop, reopen succeeds and journal verifies | stale lock wedges the door |
| 5.3 | mutation attempt from any second handle | refused; file intact (torn law 5 regression holds) | interleaved corruption |
| 5.4 | negative control | no-lock variant DETECTED (torn detection fires on interleaved writes) | harness blind |

### SPEC D-8 — `upto` reconciliation adversary (P0-class: money safety)

**Target:** `settle_with_evidence` reconcile path (acceptance_2 pins the happy reconcile-DOWN).

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 8.1 | adversarial evidence with actual > authorized | typed REFUSAL — never a clamp, never acceptance | clamped silent settle (overspend hidden) |
| 8.2 | boundary actual == authorized | accepted once | refused or double-accepted |
| 8.3 | tampered evidence binding | one mutated evidence field (leg/nonce/amount) → refusal; evidence binds the `LegKey` + nonce | settle under foreign evidence |
| 8.4 | refusal retains exposure (FailedKeep law) | after 8.1's refusal, `exposure_for_test` reflects retained exposure / leg state names failure-with-exposure | refusal silently drops exposure |
| 8.4b | after 8.1, a VALID in-range evidence arrives for the same leg | settles correctly — the refusal did not poison the leg | leg wedged by the earlier refusal |
| 8.5 | negative control | clamp-silently implementation DETECTED | harness blind |

### SPEC D-1 — dual-mode acceptance (lean)

CI matrix: the full 8-point acceptance suite runs green in BOTH feature modes
(`--features live-wiring` on/off); identical test names both modes. **RED today by the door's
own FLAG** (live-wiring composition does not compile yet) — the RED IS the charter for the
flag's resolution; when green, the suite pins that live wiring weakened no law.

### SPEC D-2 — FailedKeep exposure at cap rollover (lean)

Cases: (2.1) exposure accrued day N with no-evidence failures; at rollover to day N+1 the
daily-cap report must show per-day breakdown — prior-day retained exposure neither silently
vanishes (free cap) nor double-counts into day N+1's cap; (2.2) refusals name BOTH days'
exposure when overlap exists. Pass = defined-by-test rollover semantics; fail = silent reset.
RED decides the current `now_unix` day-math behavior.

### SPEC D-6 — journal web-unreachability (lean)

Cases: (6.1) config validation REFUSES a `journal_root` located under any served/static root
(executable now); (6.2) box-side checklist row: no Caddy route can reach `journal_root`
(per-chain dirs + truncated payer tags keep R4 — mtimes/filenames must never be web-readable)
— SRE seat consumes this as a config review item, not a unit test.

### SPEC D-7 — HumanGate immutability (lean)

Cases: (7.1) behavioral — after `settle_unknown`, no resolution within the test horizon absent
`HumanGate::explicit_human_approval()`; `resolve_unknown` without the token refuses typed;
(7.2) with the token, resolves once, terminal after; (7.3) structural — no production code
path constructs `HumanGate` other than the explicit-approval constructor (call-site audit,
grep-gate shape).

---

*Consumption: D-3/D-4/D-5/D-8 first (money safety), then D-1/D-2/D-6/D-7. Same protocol —
builder writes RED, receipts the gap, fixes GREEN in-lane; CI arbitrates. zArcheology designs
tests only. — third roll, 2026-09-16.*

---

## RS-SPECS — the unified `bpay-rail` trait attacked (fourth roll, 2026-09-16; targets bound to the branch `codex/z2b-bpay-rail` @`aa47b04b`, R11+R12 receipts)

**Targets (from the landed receipts):** `crates/bpay-rail/src/{fee,ledger,evm,ln}.rs` +
`tests/rail_probes.rs` (P-probe harness) + `tests/surcharge_x402.rs`. Symbols:
`RailLedger<Id>` (idempotency-by-identity, forward-only, terminal immutability, worst-case
fee-window, possibility-checked evidence, expiry-blocks-new-never-old, Unknown→terminal-only),
`FeeClass` ×5 incl. `L1Surcharge` with `pays_on_failure` (gas pays on revert; LN routing does
not), `EvmPaymentId = nonce+tx_hash`, `LnMockClient` (NIP-47 vocabulary, payment_hash
idempotency, preimage settlement, OPTIONAL `fees_paid`), `open_base_intent` /
`reconcile_base` / `compose_from_offer` (identity = keccak256 of canonical offer bytes),
`base_gate`. **Founder priority: attack abstractions that make LN behave like EVM or EVM like
LN.** Already-pinned by R11/R12 (do not re-spec): the terminal-Failed evidence bug fix, the
four R12 surcharge probes, duplicate-hash→lookup, htlc-never-charges.

### SPEC RS-1 — L1Surcharge beyond the delivered harness

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 1.1 | L1 price spike mid-flight (receipt l1_fee > reserved COMBINED worst case) | refusal pre-mutation, leg NOT wedged (mirrors D-8.4b); the only path onward is a NEW intent with re-declared bound — in-place bound raise refused | in-place raise, or poisoned leg |
| 1.2 | bound-split integrity: gas underspends + surcharge overspends, SUM ≤ combined | EACH component validated against ITS OWN bound — no cross-component slack transfer | sum-only validation passes |
| 1.3 | evidence arriving after window expiry | reconciles under the OLD declared bound (expiry blocks new, never old) — no fresh infinite bound | post-expiry re-bound accepted |
| 1.4 | negative control | sum-only validator DETECTED by 1.2 | harness blind |

### SPEC RS-2 — terminal-state reconciliation, exhaustively

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 2.1 | ALL terminal→terminal transitions (Settled/Failed/Refunded/Expired × each other, both rails) | refused, zero mutation — the R11-caught bug generalized to the full matrix (parameterized probe) | any terminal→terminal accepted |
| 2.2 | Unknown + settle-evidence whose window already expired | precedence PINNED BY TEST (evidence-vs-expiry rule is a named law, not emergent behavior) | undocumented precedence flip between runs/rails |
| 2.3 | replayed OLD evidence after terminal | routes to lookup, zero mutation | second effect |

### SPEC RS-3 — cross-rail identity separation at the unified ledger (R4/R1)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 3.1 | namespace collision: identical id VALUE on two rails (EvmPaymentId fields vs LN payment_hash serialized equal) | TWO independent legs — `RailLedger<Id>` keys by (rail, id), never bare id; state never bleeds across rails | one leg shadowing the other |
| 3.2 | unified-ledger log hygiene | no record/log line joins payer identity across rails (door law-6 pattern generalized to exactly the place correlation could regress) | cross-rail join key in any emitted line |
| 3.3 | canonicalization attack on `compose_from_offer` (keccak256 of canonical offer bytes): whitespace/field-order variants of ONE obligation; vs two genuinely different obligations | same obligation → same id (no double-pay via re-canonicalization); different obligations → different ids (no collision via ambiguity); canonical form pinned with cross-implementation vectors (corpus fixture law) | either failure mode |

### SPEC RS-4 — fee-evidence impossibility (FeeClass ×5, `pays_on_failure`)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| 4.1 | boundary battery, all rails: fees at exactly the declared bound pass; bound+1 (smallest unit) refuses pre-mutation | typed refusal naming the class + field | acceptance at bound+1 |
| 4.2 | LN `fees_paid` OPTIONAL: absent vs present-zero are DISTINCT typed states (not-reported ≠ charged-nothing); fabricating zero where the rail reported absent = evidence forgery, refused | distinction observable; forgery refused | omission-vs-zero conflation |
| 4.3 | `pays_on_failure` asymmetry, both directions: Failed EVM leg + in-bound gas evidence → gas CHARGED (lawful); Failed LN leg + ANY fee charge → refused (impossible per R8); a rail-agnostic caller applying EVM fee law to LN (or vice versa) DETECTED | asymmetry enforced per rail | **the core LN-behaves-like-EVM fee conflation** |

### SPEC RS-5 — LN↔EVM semantic conflation (founder headline)

| # | conflation trap | exact pass criterion | fail criterion |
|---|---|---|---|
| 5.1 | timeout semantics: LN invoice expiry is PRE-SEND (no in-flight expiry); EVM deadline can pass in-flight | expired-invoice send refused pre-send; EVM in-flight past window reconciles Unknown→terminal via evidence; a unified `expire()` that force-fails an in-flight LN payment refused | LN in-flight force-failed (EVM semantics smuggled in) |
| 5.2 | failure finality: EVM Failed-under-window may take bounded replacement (same obligation, AV-8.3); LN Failed (HTLC timeout) is terminal, no fee, no replacement | replacement path rail-capability-gated; LN replacement refused typed | generic retry applied to LN |
| 5.3 | settlement proof shape: LN = preimage bound to payment_hash (instant, no reorg); EVM = receipt bound to nonce+tx_hash WITH finality policy | LN settle requires preimage (tx_hash-style evidence refused); EVM requires receipt+finality (preimage-only refused); **EVM treated as instant like LN refused** — reorg depth must be a field, not a default | either direction of proof-shape conflation |
| 5.4 | `upto` semantics: LN invoice amount is FIXED — no native upto | upto-request on LN without explicit modeled support (MPP/hold) → typed capability refusal | **silent conversion to an exact invoice of the MAXIMUM (charges the ceiling as the amount — the worst conflation)**; negative control: charged==max when usage<max DETECTED |

**Harness:** extend `tests/rail_probes.rs` parameterized pattern — RS-2.1, RS-4.1, RS-4.3 run
per-rail; RS-3/RS-5 are differential (need both members in one fixture; `LnMockClient` +
watchpay-composed EVM member suffice, zero network). RED expectations: the conflation traps
(4.3, 5.1–5.4) and namespace keying (3.1) are the likeliest REDs on first run — each RED run
is the charter for its fix.

---

*Fourth roll, 2026-09-16. Same pipeline law: builder proves RED, fixes GREEN, CI arbitrates;
zArcheology designs tests only, zero production code. Cross-lane note: Workerb 2's door
adversarial pass (three real defects caught: concurrent-settle race, unbounded HumanGate,
hostile chain strings) validates the method — keep both batteries running.*

---

## FIFTH ROLL — LN `upto` conflation made impossible to miss + capability discovery attacked (2026-09-16)

*Founder law for this roll, verbatim: "the unified trait must unify laws, not erase rail
semantics." Targets: `crates/bpay-rail` (`ln.rs`, `evm.rs`, `ledger.rs`, `fee.rs`) +
`tests/rail_probes.rs` on `codex/z2b-bpay-rail`; `LnMockClient` extension is the builder's.*

### SPEC LU — LN `upto`→exact-ceiling conflation (RS-5.4 expanded; RED-first)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LU-1 | partial usage on an upto-shaped charge, rail without modeled upto | construction-time typed capability refusal (see CD) — and if any path executes: the settled amount == usage-priced charge, NEVER the ceiling; **charged==max while usage<max is the conflation signature and MUST be detected** | silent exact-max settlement |
| LU-2 | MPP as the modeled upto mechanism: N parts under ONE `payment_hash` | all parts = ONE obligation: idempotency by payment_hash ACROSS parts (part replay → lookup, not a new leg); Σparts ≤ declared ceiling enforced at reconcile; a failed part is NOT terminal until all parts resolve or the window closes; partial-parts delivery inside the window reconciles per MPP law | parts becoming separate legs; part replay double-charging; early terminal on one part |
| LU-3 | invoice amount mismatch: settled invoice amount ≠ ledger's declared charge (off-by-one, rounding, **msat-vs-wei unit confusion**) | typed refusal pre-mutation naming the field; exactly-equal boundary passes; amounts are TYPED with rail units — bare-int amounts structurally refuse to compile/construct | unit-confused acceptance; coercion |
| LU-4 | capability negotiation outcome observability | caller asked `upto`, rail offers `exact` → REFUSAL or an explicit renegotiation event — never a silent substitution (corpus §4 law: "a client MUST NOT silently substitute transparent exact/upto when the requested profile is unavailable") | silent downgrade |

### SPEC CD — rail capability discovery attacked (know before you construct)

**The six axes (founder-named):** `exact` · `upto` · `replacement` · `failure-fees` ·
`finality/reorg` · `partial-settlement`. The capability set is a per-rail manifest the caller
reads BEFORE constructing an intent.

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| CD-1 | manifest completeness | every member declares ALL six axes; an undeclared axis defaults to REFUSE-ALL (fail closed — the proof-router law: unlisted suites reject) | missing axis silently treated as supported |
| CD-2 | discovery-before-intent | NO code path constructs an intent whose demanded capabilities exceed the declared set — construction-time typed refusal naming the axis (mirrors `base_gate`'s missing-bound refusal shape) | settle-time surprise |
| CD-3 | truth table pinned as data | LN: upto=false (unless MPP modeled), replacement=false, failure-fees=false, finality=instant/no-reorg, partial=per-MPP. EVM(Base): exact=true, upto=true, replacement=true(bounded), failure-fees=true (gas on revert), finality=reorg-depth-parameterized, partial=false. Probes assert the DECLARED table equals this | a member declaring LN upto=true without MPP, or EVM finality=instant (lying manifest) |
| CD-4 | manifest↔behavior cross-check | run the LU/RS/RS-4.3 probes; every behavioral outcome must MATCH the declaration — divergence = lying manifest, caught | declared-vs-behavioral gap survives |
| CD-5 | capability versioning | capabilities carry a version; a rail gaining upto changes its manifest version additively (CONSTITUTION Art. VI: additive evolution, deprecation windows) — old manifests never silently mutate | silent manifest change |
| CD-6 | negative controls | lying manifest (declares upto, charges max) DETECTED by CD-4; silent-downgrade caller DETECTED by LU-4 | harness blind |

**RED expectations:** LU-2 (MPP semantics likely absent in `LnMockClient`), LU-3's typed-units
requirement, and the entire CD manifest (no capability type exists yet on the branch) are the
likeliest REDs — each RED run charters its fix. **Harness:** extend `LnMockClient` with
multi-part + amount-unit variants (builder's); CD probes are pure data-vs-behavior and need
zero network.

---

*Fifth roll, 2026-09-16. Pipeline law unchanged: builder proves RED, fixes GREEN, CI
arbitrates; zArcheology designs tests only.*

---

## SIXTH ROLL — LU/CD continued through the R13 transport seam (2026-09-16)

*Founder state correction (verbatim): "Resume the current zArcheology roll-forward from
ADVERSARIAL-BPAY-SPECS: continue RS-5.4 and rail-capability discovery RED-first specs
against bpay-rail. No architecture waiting gate remains." Targets RE-BOUND to
`codex/z2b-bpay-rail` @`0ff70217` (R13 + its dock rider): `src/{nwc,nwc_live,nwc_mock,ln,
ledger,fee,evm,x402}.rs` + `tests/{rail_probes,surcharge_x402,nwc_laws}.rs`. The founder law
"the unified trait must unify laws, not erase rail semantics" now extends THROUGH the
transport seam R13 introduced — conflation must be attacked at the NIP-47 boundary too.*

**GREEN accounting (R13 vs prior specs — do NOT re-prove):** preimage-REQUIRED settlement
incl. the preimage-stripping transport probe (RS-5.3 LN direction), duplicate payment_hash →
route-to-lookup, expiry-blocks-new-never-old (RS-5.1 LN pre-send direction),
unknown-never-auto-retry, and the fees_paid IMPOSSIBILITY check (bound+1 refused pre-mutation)
are GREEN per R13 receipts and `tests/nwc_laws.rs`.

**REDs verified at `0ff70217` this roll (cited):** no MPP/hold symbols anywhere in `src/`
(LU-2, LU-5); `LnInvoice.amount_msat: u64` is a BARE int while identity is newtyped
(`PaymentHash`, ln.rs:30 vs ln.rs:35 — LU-3/LU-7); msat→Atto conversion scattered over TWO
sites (ln.rs:160, ln.rs:190 — LU-7.2); `reconcile` coerces absent fees to zero
(`unwrap_or(0)`, ln.rs:239 — LU-8); no negotiation-event type (LU-4); no capability or
manifest type exists (all of CD).

### SPEC LU-5 — hold-invoice modeled-upto (the OTHER lawful LN upto path; LU-2 covers MPP)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LU-5.1 | hold-invoice settle-on-release: preimage withheld by the receiver until release; hold-timeout claws back | settlement ONLY on a released preimage (RS-5.3 law); hold-timeout = terminal Failed, ZERO fee, no replacement (RS-5.2 LN law) | hold force-settled at the ceiling; hold-timeout charged |
| LU-5.2 | multi-hold partial release inside the window | Σ released ≤ declared ceiling at reconcile; unreleased parts roll to the LU-5.1 timeout law, non-terminal until then | partial release exceeds ceiling; early terminal |
| LU-5.3 | mechanism-named upto: a rail declaring `upto` must name its mechanism (`mpp` \| `hold` \| `both`) in the CD manifest | distinct CD-3 rows per mechanism; MPP and HOLD probed separately | mechanism-agnostic "upto=true" |

### SPEC LU-6 — NIP-47 error vocabulary → ledger-state mapping (transport-boundary conflation)

R13 pinned the full typed `NwcError` vocabulary + `TransportAmbiguous` → Unknown class. Attack
the MAP, not the vocabulary:

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LU-6.1 | every NIP-47 error class maps to exactly ONE lawful ledger outcome, pinned as a total map: RATE_LIMITED → intent stays OPEN at `Intent`, nothing further; NOT_ENOUGH_FUNDS-style → typed refusal PRE-send; PAYMENT_FAILED vs INTERNAL_ERROR distinctness observable; an UNMAPPED code = typed unmapped-class refusal, never a guess | total mapping pinned by a parameterized probe over the vocabulary | rate-limited coerced to Failed; vocabulary collapsed into one state |
| LU-6.2 | `TransportAmbiguous` → Unknown: never auto-retried; the original obligation reconciles only by later lookup (AV-8's law THROUGH the transport) | reconcile-by-lookup only, original payment_hash | auto-retry under a fresh payment_hash (identity laundering) |
| LU-6.3 | live-gate refusal (`send_enabled=false`, named "LIVE SENDS DISABLED this slice") leaves ZERO ledger residue | refusal pre-ledger: no intent row, no reservation, zero mutation | half-open intent at the gate |

### SPEC LU-7 — typed rail units at the transport boundary (LU-3 extended through R13)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LU-7.1 | NIP-47 JSON msat integers cross into the typed layer by TYPED construction only — a `MilliSatoshi` newtype (or equivalent); a bare-int constructor for money must not exist | typed everywhere; bare-int money path refuses to compile/construct | unit-confusable bare `u64` from JSON to ledger (CURRENT STATE — ln.rs:35, the named RED) |
| LU-7.2 | cross-rail amount passage (msat → `Atto` for the unified fee window) goes through ONE named conversion site with cross-checked vectors | single site, vector-tested | scattered conversions (CURRENT: ln.rs:160 + ln.rs:190) |
| LU-7.3 | invoice-amount mismatch refusal names the field AND the unit pair | refusal text carries both units | unitless refusal |

### SPEC LU-8 — `fees_paid` absent-vs-zero at BOOKING (RS-4.2 finished through R13)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LU-8.1 | reconcile BOOKING distinguishes not-reported (field absent) from charged-zero (present `0`) — today `unwrap_or(0)` (ln.rs:239) coerces absent→zero for the bound check; the probe pins the RS-4.2 law end-state: absent books as a DISTINCT observable state (own log/balance line) or is refused as forgery — never silently equal to zero | distinction observable in end state; lawful-distinct OR refused | absent==zero indistinguishable (CURRENT — the named RED) |
| LU-8.2 | mock fidelity: `nwc_mock` models optionality (CAN omit the field); a mock that always emits `fees_paid` must be caught by a live/mock differential — mocks may not silently be stronger than the protocol | differential green only on faithful optionality | mock drift greens a lying battery |

### SPEC CD-7 — transport capability discovery (the reader-door lesson made law)

R13's live transport DISCOVERED mid-flight that some relays need WS for kind-23195 responses
(REQ-over-POST named honestly as a capability gap). CD-7 makes that a BEFORE-construction axis:

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| CD-7.1 | evidence-channel readability (`response-read: post-req \| ws-required \| none`) is a declared capability; constructing a SEND intent when the transport cannot read responses refuses at construction naming the axis — send-then-blind is the permanent-Unknown trap | refuse-before-send, typed, names the axis | broadcast into an unreadable evidence channel, discover after |
| CD-7.2 | read-only ops (get_info/get_balance) stay lawful on a read-only transport — the refusal binds only value-carrying construction (R13's env-gated read-only live leg is the lawful shape) | read path works | over-blocking: reads also refused |

### SPEC CD-8 — the live-send gate as a capability axis

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| CD-8.1 | `send` is a manifest axis, off-by-default; intent construction demanding send with `send:off` refuses naming the gate (LU-6.3, manifest-shaped) | typed construction-time refusal | settle-time surprise |
| CD-8.2 | `enable_sends()` mutates the manifest ADDITIVELY with a version bump (CD-5 law reaches gates) | versioned, additive | silent capability flip |

### SPEC CD-9 — capability composition algebra (weakest link)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| CD-9.1 | composed stack (rail × transport) capability = INTERSECTION: `NwcRail<T>` over a `ws-required` transport caps LN's evidence semantics accordingly; the composed manifest is DERIVED, never hand-written per stack | derived intersection pinned by probe | composed manifest claims more than any component |
| CD-9.2 | the watchpay-composed EVM member's manifest derives from watchpay's PROVEN behavior (65/65 mainline), not a hand-written row — behavior-derived truth feeding CD-4 | derivation pinned | hand-written row diverges from watchpay behavior |

### SPEC CD-10 — mock-vs-live manifest truth (batteries may not green against a lying mock)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| CD-10.1 | the MOCK declares itself in its manifest (identity: mock) and an EXPLICIT divergence table lists every row where mock ≠ live | explicit divergence data | mock silently stronger/weaker than live |
| CD-10.2 | negative control: a battery that would green against a mock whose manifest lies (declares `upto`) MUST fail via CD-4 | detected | lying mock passes the suite |

**Harness notes:** LU-6/CD-7 need `nwc_mock` extension (per-class error injection +
response-readability modes — builder's); LU-5 needs hold-invoice injection (builder's); CD
probes stay pure data-vs-behavior, zero network. The live leg stays env-gated read-only
(`BPAY_NWC_URL`, `#[ignore]`) per R13 law. **RED expectations:** LU-2, LU-3/LU-7, LU-4,
LU-5, LU-8.1, and all of CD are RED today at `0ff70217` (citations above); LU-6.1 is
PARTIALLY green (the vocabulary maps, the total-map pin does not exist). Each RED run
charters its fix.

*Sixth roll, 2026-09-16. Pipeline law unchanged: builder proves RED, fixes GREEN, CI
arbitrates; zArcheology designs tests only, zero production code.*

---

## SEVENTH ROLL — capability negotiation across MULTI-RAIL plans (2026-09-16; LU/CD taken to the plan boundary; founder-required invariant: authorization-time manifest binding)

*Complements the sixth roll: CD-7/CD-9 cover transport discovery and weakest-link composition
ALGEBRA — this roll attacks the PLAN layer above the rails. Targets: the plan/intent
construction layer (corpus IntentPlan slot; today watchpay `ValidatedPlan` + `RailLedger<Id>`),
the per-rail capability manifest (CD), and the corpus signed-allowlist deployment-manifest law
(SILENTPAY-V2 §3) as the design-time ancestor of the runtime binding below.*

**The new invariant (founder-required):** a plan binds, per leg, the **capability-manifest
hash + version AT AUTHORIZATION TIME**, riding the signed authorization material. Later
capability drift can never silently change an obligation.

### SPEC MP — multirail plan capability attacks (RED-first)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| MP-1 | legs advertise incompatible capabilities (plan demands `upto` plan-wide; one leg's rail has upto=false; plan-level replacement semantics where one rail is replacement=false) | construction-time typed refusal naming leg + axis; dropping an OPTIONAL leg for mismatch = explicit renegotiation event, never silent drop (LU-4 generalized to legs) | silent leg drop, or plan built anyway |
| MP-2 | manifest drift mid-plan (rail manifest version-bumps or axis-flips after authorization, before all legs settle) | already-opened legs execute under the AUTHORIZATION-TIME manifest (grandfather law); not-yet-opened legs get a typed DRIFT refusal requiring explicit renegotiation; **no leg ever executes under a manifest it was not authorized against** | silent execution under the new manifest; silent failure of old legs |
| MP-3 | the binding itself | plan carries per-leg manifest hash+version; opening a leg validates current-manifest-hash == bound hash, mismatch = typed drift event, zero mutation; changing the binding requires a NEW signed authorization (rail capability data, not payer identity — R4-safe by construction) | unbound manifests; in-place rebind |
| MP-4 | lying adapters at plan level, per axis: upto-declared/max-charged (LU-1 signature); finality=instant-declared but reorg-depth evidence < declared (EVM lying); failure-fees=false-declared but failure charges appear (RS-4.3 impossibility); partial-declared without MPP/hold semantics (LU-2/LU-5); replacement-declared where replacement creates a NEW idempotency scope instead of same-obligation (AV-8.3) | every lie DETECTED at reconcile, typed refusal naming axis + leg; CD-4 cross-check runs per leg per plan | any lie survives to settlement |
| MP-5 | LN/EVM distinctness at plan level: per-leg settlement assurance reported DISTINCTLY in the receipt — plan assurance is the WEAKEST leg per domain (composes with CD-9's algebra), never averaged/homogenized (corpus ADDENDUM §7: "Arbitrum sequencer acknowledgement must not be relabeled Vaulta finality") | receipt shows per-leg assurance (LN: instant; EVM: reorg-depth-N); a uniform single "finality" claim on a multirail receipt = conflation signature, refused | homogenized/averaged assurance anywhere |
| MP-6 | negative controls | silent mid-plan manifest mutation DETECTED (MP-3); lying upto manifest DETECTED at plan level (MP-4); uniform-finality receipt DETECTED (MP-5) | harness blind on any axis |

**RED expectations:** the manifest binding (MP-3) exists nowhere — its RED is the charter for
the binding's type; MP-2's grandfather law and MP-5's per-leg assurance are the likeliest
additional REDs. **Harness:** plan-level fixtures above the differential probes
(`nwc_mock`/`LnMockClient` + watchpay-composed EVM member), per-rail manifest fixtures with
mutable versions (builder's), zero network; the live NWC leg stays env-gated `#[ignore]` per
R13 law.

*Seventh roll, 2026-09-16. Pipeline law unchanged. Watch list updates with R13: the live NWC
leg and any Sepolia smoke add LIVE drift sources for MP-2 drills; the Eddies worker's
obligation semantics arrive against RS-2 terminal reconciliation and RS-4.3 fee asymmetry.*

---

## EIGHTH ROLL — the R13 live NWC transport boundary attacked (2026-09-16)

*Founder order (verbatim): "Attack the R13 live NWC transport boundary itself. Design
RED-first specs for WebSocket reader/reconnect, duplicate 23195 responses, stale/wrong
request correlation, wrong `p` tag, replayed response, relay disconnect between send and
response, and conflicting responses from multiple relays." **The key law, verbatim and
binding on every row below: "transport ambiguity can only reconcile the existing
`payment_hash`; it can never create a new payment identity."** Then roll directly into
capability-manifest attacks (CD-7…CD-10). Complements the seventh roll (MP binds manifests
to plans at authorization; LT binds the wire that carries the evidence those plans settle).*

**Targets read at full source depth this roll:** `crates/bpay-rail/src/nwc_live.rs` (395
lines, ALL) + `nwc.rs` request path + `NwcConnection::parse` on `codex/z2b-bpay-rail`
@`0ff70217`.

**Verified observations — the RED anchors (cited):**
- **Relay-rejection conflation (the strongest find):** the acknowledgement check is a
  SUBSTRING test — `if !resp.contains("true") && !resp.contains("OK")` (nwc_live.rs:378) —
  so a relay REJECTION `["OK", <id>, false, "error: …"]` PASSES as acceptance (it contains
  "OK"; the message may even contain "true"). A refused event then times out at read and
  returns `TransportAmbiguous` — **rejected-at-relay is silently classified as
  in-flight-unknown**. For value-carrying requests this is the exact conflation the key law
  exists to prevent (nothing is in flight; the event never entered the network).
- **No request↔response correlation:** `read_response` issues `limit: 1` and parses the
  FIRST brace-delimited object (nwc_live.rs:331, :344-353); nothing binds the returned
  23195 to the request that spawned it (decrypt + correlation are future work — the
  content is read then discarded, nwc_live.rs:384-393). A stale first-match response to a
  DIFFERENT request is structurally indistinguishable today.
- **Response sender never authenticated:** the response event's `pubkey` is never checked
  against `wallet_pubkey_hex` and its schnorr signature is never verified — only
  `.content` is touched (nwc_live.rs:384-387).
- **Multi-relay silent last-wins:** `NwcConnection::parse` overwrites `relay` on every
  `relay=` query pair (nwc_live.rs:65-77) — a `relay=wss://a&relay=wss://b` URL keeps only
  `b`, silently; the type is single-relay (`relay_url: String`, nwc_live.rs:46).
- **One-shot read, no reconnect:** POST event → single REQ-over-POST attempt
  (nwc_live.rs:376-383); a disconnect between send and response returns
  `TransportAmbiguous` with no retry/re-read loop (the WS reader is the named next slice).
- **Clock handling:** `now_secs()` returns 0 on clock failure (nwc_live.rs:263-268) →
  epoch-0 events with a 60s expiry; request expiration is HARDCODED `now+60`
  (nwc_live.rs:369).
- **NIP-44 nonce:** documented-deviation DRBG `sha256(secret ‖ nanos)` → ChaCha20
  (nwc_live.rs:200-216); the clock is NOT injectable, so same-instant encryption is not
  testable as built. Uniqueness rests on nanosecond collision-freedom.
- **URL decoding:** `urldecode` handles exactly five UPPERCASE sequences (nwc_live.rs:87-93);
  legal lowercase percent-encoding (`%3a`) passes through undecoded.

### SPEC LT-0 — the identity law (this roll's constitution; pinned before every probe)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-0.1 | ANY transport-layer outcome (ambiguity, disconnect, timeout, reconnect, duplicate, replay, conflict) feeding the ledger | the outcome may ONLY reconcile/lookup an EXISTING `payment_hash`; no transport event constructs, derives, or re-keys a payment identity | any path where transport state mints or rotates an identity (incl. "retry with a fresh payment_hash") |

### SPEC LT-1 — relay acknowledgement truth (rejected ≠ ambiguous) — P0-class

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-1.1 | relay replies `["OK", id, false, "…"]` (rejection) to a request event | TYPED pre-ledger refusal ("relay refused the event", message surfaced); nothing is in flight; no TransportAmbiguous | rejection classified ambiguous/unknown (CURRENT — the substring check at :378 passes `OK false`) |
| LT-1.2 | relay replies `["OK", id, true, …]` then closes before any response | TransportAmbiguous (the event IS in flight); reconcile-by-lookup only, per LT-0 | force-fail or auto-retry |
| LT-1.3 | relay replies a body containing the literal word "OK"/"true" but is NOT an OK frame (e.g., an error JSON) | parsed as a FRAME, not a substring — unknown frame shape = typed unknown-frame refusal | substring acceptance (CURRENT shape) |
| LT-1.4 | negative control | a mutated (substring-only) validator must be DETECTED by the LT-1.1/1.3 probes | harness blind |

### SPEC LT-2 — WS reader / reconnect / disconnect-between-send-and-response

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-2.1 | disconnect between EVENT-accept and response arrival | bounded reconnect + re-read loop (WS subscription with resume); every retry reconciles the SAME payment_hash (LT-0); the leg never exceeds its declared evidence window | single-shot read then permanent Unknown (CURRENT — one REQ-over-POST attempt); fresh payment_hash on retry |
| LT-2.2 | reconnect storm (relay flapping) | bounded backoff; retry count/telemetry observable; window expiry still governs | infinite retry; retries past the evidence window |
| LT-2.3 | REQ-over-POST unsupported (the named capability gap) | the transport DECLARES `response-read: none|ws-required` for this relay and refuses value-carrying construction (CD-7.1); read-only ops still lawful | send-then-blind (CURRENT for such relays — sends are gated off today, the spec pins the law for when the gate lifts) |

### SPEC LT-3 — response↔request correlation (stale / wrong response)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-3.1 | the relay returns a 23195 answering a DIFFERENT (earlier) request | correlation binds response→request: decrypted `result_type` matches the pending method; response freshness ≥ request dispatch; mismatch = typed stale-response refusal, zero ledger effect | first-match accepted (CURRENT — `limit:1` + first-brace parse, :331/:344) |
| LT-3.2 | response arrives for an UNKNOWN method (never requested) | typed refusal naming method; never routed into any open intent | routed into the newest open leg |
| LT-3.3 | correlation survives process restart (response read after restart) | correlation state persisted with the intent (ledger-side), not transport memory only | in-memory-only correlation |

### SPEC LT-4 — response sender authentication (wrong `p` / wrong sender)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-4.1 | a 23195 whose event `pubkey` ≠ `wallet_pubkey_hex` | typed wrong-sender refusal BEFORE any decrypt attempt (cheap check first); zero ledger effect | sender unchecked (CURRENT — only `.content` is read, :384-387) |
| LT-4.2 | a 23195 with a forged/invalid schnorr signature over its event id | signature verified (sha256 canonical array → BIP-340 verify); invalid = typed bad-signature refusal | unverified event content consumed |
| LT-4.3 | request-side p-tag tampering: `wallet_pubkey_hex` altered in the URL | the request is encrypted to the altered key (ECDH) — a WRONG-wallet request must be detectable at parse (validation) or the first response mismatch is typed, never silent | silently paying a wrong wallet (boundary row with LU-3/LU-7) |
| LT-4.4 | response p-tag points at the client but content decrypts under a different conversation | decrypt failure = typed not-for-us refusal, DISTINCT from wrong-sender and from corrupt | all decrypt failures one error class |

### SPEC LT-5 — duplicate 23195 redelivery

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-5.1 | the same response event delivered twice (relay redelivery / reconnect replays the subscription) | dedup by event `id`; second delivery routes to lookup, exactly one effect (LU-6.2 through the live path) | second effect; second ledger mutation |
| LT-5.2 | two DISTINCT response events for ONE request (relay quirk) | first AUTHENTICATED response wins; the second recorded as a divergence flag, never applied | last-writer-wins; both applied |

### SPEC LT-6 — replayed response + clock skew

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-6.1 | an OLD stored 23195 served despite the `since` filter (relay ignores filters) | client-side freshness check: response `created_at` ≥ request dispatch (bounded skew tolerance); older = typed stale refusal | `since` trusted as the only freshness gate (CURRENT — filter-only) |
| LT-6.2 | a VALID old response replayed to reconcile a NEWER intent of the same shape | the decrypted payload's `payment_hash` must match the open intent EXACTLY (LT-0 law); evidence for a different hash = typed mismatch, routed nowhere | replay settles a new leg |
| LT-6.3 | client clock skewed vs relay (response appears "from the future"/"past") | skew-tolerance is a DECLARED bound; outside it = typed clock-skew refusal (feeds LT-8) | silent acceptance at arbitrary skew |

### SPEC LT-7 — multi-relay: typing + conflicting responses

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-7.1 | connection URL carries multiple `relay=` params | typed `Vec<relay>` (or typed refusal until multi-relay is built); NEVER silent last-wins (CURRENT: parse overwrites, :65-77) | silent last-wins (CURRENT, the named RED) |
| LT-7.2 | two relays return CONFLICTING authenticated 23195s (e.g., one preimage-valid settle, one failure) for one request | first-authenticated wins provisionally; conflict ESCALATES to a divergence flag + Unknown reconciliation, never silent pick; the ledger effect stays reversible-by-evidence | first-received-wins silently; both applied |
| LT-7.3 | one relay dead, another alive (partial availability) | failover lawful per LT-2 reconnect rules; the composite transport's capability derives per CD-9 (weakest read path) | composite claims a dead relay's read capability |

### SPEC LT-8 — clock failure + expiration policy

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-8.1 | system clock unavailable before build/sign | typed clock-unavailable refusal, pre-ledger | epoch-0 events (CURRENT `now_secs()` fallback → 0, :263-268) |
| LT-8.2 | request expiration policy | per-request TTL from the intent's declared window (LU-6/RS-5.1 law), not a hardcoded 60s (CURRENT, :369); TTL ≥ the leg's evidence window | hardcoded expiry shorter than the declared window |
| LT-8.3 | clock seam testability | the transport takes an INJECTABLE clock (pure-Rust core, host clock at the edge) — required by LT-6.3/LT-8.1 probes | `SystemTime::now()` called mid-construction (CURRENT — not testable as built) |

### SPEC LT-9 — NIP-44 v2 nonce uniqueness + official vectors (external anchor law)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| LT-9.1 | two encryptions in the SAME conversation under an injected FROZEN clock | nonces MUST differ (uniqueness by construction, not by nanosecond luck); the documented DRBG deviation (":200-216") is retired or fenced by test | identical nonce → identical message keys → keystream reuse across plaintexts |
| LT-9.2 | the full NIP-44 v2 construction (pad len, conversation key, payload framing) | pinned byte-exact against the OFFICIAL nip44 v2 test vectors (external ground-truth anchor — never memory-derived) | construction greens only against its own implementation |
| LT-9.3 | URL percent-decoding case sensitivity | case-insensitive hex decoding (`%3a` == `%3A`); unknown sequences per RFC; NWC URL shape pinned with vectors | uppercase-only five-sequence table (CURRENT `urldecode`, :87-93) |

### CD-7…CD-10 SHARPENED by the live-transport attack (the roll-into, founder-directed)

- **CD-7⁺ (response-read gains guarantee dimensions):** the axis is not one boolean —
  `response-read` must carry *correlation* (binds response→request, LT-3), *freshness*
  (client-side check vs filter-trust, LT-6.1), and *dedup* (event-id, LT-5.1) guarantees.
  A relay that reads but does not correlate is `response-read: weak` and value-carrying
  construction refuses on it. The REQ-over-POST probe result is itself a capability
  receipt (CD-4 input). Composes with MP-3: the authorization-time manifest binding rides
  a manifest whose transport axes these dimensions define.
- **CD-9⁺ (composition gains a conflict dimension):** multi-relay composition is not plain
  intersection — read capability is per-relay UNION with a CONFLICT rule (LT-7.2/7.3); the
  derived composite manifest must express `read: any-relay, conflict: escalate-unknown`.
- **CD-10⁺ (the mock must speak RELAY vocabulary, not just NIP-47 result vocabulary):**
  `nwc_mock` today models result shapes; the transport battery needs a relay-simulator
  tier — OK-false acknowledgements, duplicate EVENT delivery, since-ignoring filters,
  multi-event bodies, flapping disconnects, conflicting second responses (builder's;
  feeds every LT row).
- **CD-8⁺:** the send gate composes with `response-read` — a send-enabled construction on
  a `response-read: none` transport is a manifest-level contradiction refused at CD-8.1
  even before LT-2.3's runtime check.

**RED expectations (verified this roll at `0ff70217`):** LT-1.1/1.3 (substring ack),
LT-2.1/2.3 (no reader loop; gap unnamed to the manifest), LT-3.1 (no correlation), LT-4.1/4.2
(sender unauthenticated), LT-5.1 (no dedup — no reader at all), LT-6.1 (filter-only
freshness), LT-7.1 (silent last-wins), LT-8.1/8.2/8.3 (epoch-0 fallback; hardcoded TTL;
non-injectable clock), LT-9.1/9.3 (frozen-clock nonce; case-sensitive decode) are RED now;
LT-9.2 is UNPROVEN (no vector pin exists); LT-0 is the standing law every RED run must
charter against. **Builder consumption order:** LT-1 (money-safety, tiny) → LT-4 (sender
auth before any decrypt lands) → LT-3/LT-5 (correlation + dedup with the reader slice) →
LT-2 (reconnect loop) → LT-8/LT-9 (clock seam + nonce retirement) → LT-7 (multi-relay
typing). The WS reader slice is the natural carrier for LT-2/3/5.

*Eighth roll, 2026-09-16. Pipeline law unchanged: builder proves RED, fixes GREEN, CI
arbitrates; zArcheology designs tests only, zero production code, zero network.*

---

## NINTH ROLL — authorization-time capability binding ACROSS RECOVERY (2026-09-16)

*Founder law for this roll, verbatim: "A recovered payment may learn **new evidence**, but it
may never inherit **new capabilities** without a new authorization." Builds on SPEC MP (seventh
roll): MP binds the manifest hash+version at authorization; this roll attacks every path that
could smuggle a different binding back in through recovery. Targets: the durable journal
persistence of the binding, the reconcile/evidence path (R11 law), the replacement path
(AV-8.3), and adapter upgrades (ties to DEPLOYMENTS.md R2 identity pinning).*

### SPEC RB — recovery preserves the signed binding (RED-first)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| RB-0 | journal round-trip of the binding (mechanism) | the per-leg manifest hash+version is IN the durable record: write → drop handle → reopen → binding byte-equal; never recomputed from the live manifest | binding reconstructed from current state on reopen |
| RB-1 | crash mid-leg; manifest upgraded to v2/h2 DURING downtime; restart recovers and continues the leg | recovered binding == h1 (asserted from the recovered record); capability lookups for that leg resolve against the BOUND manifest, not the live one; new legs see the typed DRIFT refusal (MP-2) | recovered leg silently carrying h2 |
| RB-2 | UNKNOWN leg under h1; manifest drifts; settle-evidence arrives whose validity DIFFERS by manifest (h1 declares reorg-depth-12, h2 relaxes to depth-2; evidence at depth-6: passes h2, fails h1) | evidence validated under the BOUND h1 semantics → refused; acceptance via the live h2 = **capability inheritance through the evidence path** | depth-6 evidence accepted for an h1-bound leg |
| RB-3 | adapter IMPLEMENTATION upgrade declaring the same manifest (code changed, manifest didn't — lying by omission) | manifest must bind implementation identity (crate/version digest or the DEPLOYMENTS.md row hash); CD-4 behavior probes re-run on upgrade catch the divergence | upgraded adapter passes under a stale manifest |
| RB-4 | version-ONLY bump (v1→v1.1, semantically neutral, additive) | still a typed drift event for unopened legs; opened legs grandfather under v1 EXACTLY — no partial inheritance of "just the new optional stuff"; the version IS the binding | silent version migration |
| RB-5 | bounded replacement after drift | the replacement carries the ORIGINAL h1 binding and validates under h1 semantics (fees, finality, ceilings); a replacement satisfying only h2 semantics = typed refusal; the lawful path to h2 is a NEW authorization | replacement constructed under live-manifest semantics |
| RB-6 | lawful re-authorization (positive control) | post-drift, a NEW authorization binds h2: old leg reaches terminal-or-refunded, new leg executes under h2, both coexist without interference — recovery never traps a payer | re-authorization blocked or cross-bound |
| RB-7 | negative controls | (a) re-binding recovery (journal + live manifest) DETECTED by RB-1; (b) evidence-path inheritance DETECTED by RB-2; (c) replacement inheritance DETECTED by RB-5 | harness blind on any axis |

**RED expectations:** RB-0 (no binding type exists yet — MP-3's RED charters it, RB-0 pins its
persistence), RB-2/RB-5 (evidence and replacement paths have no manifest-awareness today),
RB-3 (nothing binds implementation identity). **Harness:** crash/restart via drop-and-reopen of
the journal handle against a mutated on-disk manifest fixture (deterministic — no real SIGKILL
needed for the binding question; AV-1 covers process-level crash separately); mutable-version
manifest fixtures from the seventh roll; zero network; live NWC stays `#[ignore]` env-gated.

*Single-writer discipline (founder order, 2026-09-16): no additional zArcheology writers on
this artifact — existing sessions finish their rolls; future parallelism goes to DIFFERENT
workerb lanes, not this file. — Ninth roll, 2026-09-16. Pipeline law unchanged: builder proves
RED, fixes GREEN, CI arbitrates; zArcheology designs tests only.*

---

## TENTH ROLL — the authorization object itself (2026-09-16)

*Founder law for this roll, verbatim: "the journal may preserve an authorization binding, but
it may never create or strengthen one." RB closed recovery-time capability inheritance; this
roll ensures the ORIGINAL authorization actually committed to those capabilities in the first
place — the binding must be CRYPTOGRAPHICALLY inside the signed material, not copied into the
journal afterward. Targets: the signed-authorization construction (watchpay `ValidatedPlan`
sealing, bsigner member's-hand verification, `capAssert`), the canonical serializer (RS-3.3
discipline), and the journal (RB-0's durable record — now demoted to PRESERVER, never
source). Verification runs through the estate's existing signature verification (bsigner
organ), never a bespoke re-check.*

### SPEC AB — the binding is signature-authoritative (RED-first)

| # | case | exact pass criterion | fail criterion |
|---|---|---|---|
| AB-0 | signed-scope proof (mechanism): authorization signed WITH per-leg manifest hash+version+implementation identity | verification re-derives the signed bytes from the leg INCLUDING the binding — strip the binding from the signed material and the signature FAILS; the journal record's binding is compared against the signed one, and the SIGNED one wins | verification reading the journal's binding as ground truth |
| AB-1 | journal-insertion attack (the core invariant) | a journal record claiming a binding the signed authorization does NOT contain → verification fails, named; the journal PRESERVES, never CREATES | journal-authoritative binding accepted |
| AB-2 | omission, both directions | auth signed WITHOUT a binding + journal later carrying one → refused (a leg cannot gain capabilities the signature never committed to); auth signed WITH a binding + journal dropping it → the leg REFUSES to execute unbound (an unbound leg cannot detect drift — no unbound leg executes at all) | either direction silently accepted |
| AB-3 | leg swapping | auth signs leg A under h1, leg B under h2 (both individually lawful); journal swaps them (leg A carrying h2) | per-leg signature verification FAILS on the swapped assignment — each leg's signed material binds ITS OWN manifest | swap verifies |
| AB-4 | manifest-hash substitution | same version string, different content (h1 vs h1′); and manifest content mutated while version kept | binding is by CONTENT HASH: substitution breaks the signature; stored manifest snapshots must hash to the bound value; live-manifest lookups resolve through the signed hash | version-string-only binding passes |
| AB-5 | implementation-identity substitution | same manifest hash, DIFFERENT adapter implementation digest | implementation identity is INSIDE the signed scope (RB-3's pin made cryptographic); substitution breaks the signature. RED-note: if impl identity lives only in the journal today, this RED charters moving it into the signed material | undetectable swap |
| AB-6 | mixed old/new bindings in ONE plan (the lawful RB-6 shape attacked) | plan with leg A under h1, leg B under h2 (post-drift re-authorization) | each leg verifies against ITS OWN binding — mixed bindings coexist lawfully; any plan-level "current manifest" homogenization applied to both legs = substitution, refused. Generalized: merging legs across two authorizations (A's leg under B's signature) FAILS per-leg verification | homogenized or cross-signed assignment verifies |
| AB-7 | canonicalization of the signed material | field-order/whitespace variants of one authorization verify IDENTICALLY (same canonical form → same signature); ANY binding-field mutation changes it; canonical form pinned with cross-implementation vectors (corpus fixture law; RS-3.3) | ambiguous canonical form survives |
| AB-8 | negative controls | journal-authoritative implementation DETECTED (AB-1); unbound-leg execution DETECTED (AB-2); cross-leg/cross-authorization assignment DETECTED (AB-3/AB-6) | harness blind on any axis |

**RED expectations:** AB-0/AB-1/AB-5 are near-certain RED (no binding exists in any signed
scope today — MP-3/RB charters the type, THIS roll forces it into the SIGNATURE); AB-4's
snapshot-hash pin and AB-6's per-leg mixed verification follow. **Harness:** deterministic
test signer from the estate's existing crypto (capability crate's real ed25519), canonical
serializer fixtures, journal with tamper injection points; zero network; live NWC `#[ignore]`.

*Tenth roll, 2026-09-16. Single-writer discipline stands. Pipeline law unchanged: builder
proves RED, fixes GREEN, CI arbitrates; zArcheology designs tests only.*
