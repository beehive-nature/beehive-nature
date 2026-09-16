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
