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
