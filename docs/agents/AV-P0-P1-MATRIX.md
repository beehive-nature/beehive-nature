# AV P0/P1 MATRIX — specified → implemented/CI-proven → live-wired

**Why this exists** (founder order, 2026-09-16): the test estate improved
fast; this matrix prevents repository guarantees from being read as deployed
guarantees. Three columns, maintained per lane. **implemented/CI-proven**
means the law exists in code with a battery that proves it on every push.
**live-wired/operationally proven** means the PRODUCTION caller exercises it —
nothing in this file claims that unless a receipt names the box.

| spec | specified | implemented / CI-proven | live-wired / operationally proven |
|---|---|---|---|
| AV-1 serve-bridge crash/concurrency/hostile | ✅ ADVERSARIAL-BPAY-SPECS | ✅ admin settle/charge rail (bearer-gated, unset token = typed 503), idempotency keys burned on events, fsync-before-respond appends, chain-fork race fixed; battery 5/5 in CI incl. negative control | ❌ **NO** — the box serve bridge runs pre-AV-1 code. Deploy gates: mint `VOUCHER_ADMIN_TOKEN`, fresh `rate_set.json` (AV-2 mint law), wire pollers/doors to the rail |
| AV-2 stale-quote TTL | ✅ | ✅ quote TTL (inclusive, 300s ratified-configurable) + single-use ids in the Rust core AND the python engine; batteries in CI (rust 7/7 incl. reload-replay; 2.5 ×6) | ❌ **NO** — box `rate_set.json` minted 2026-08-29 (18 days stale); wiring freshness + re-mint is part of any deploy |
| AV-3 meter↔door split-brain | ✅ | ✅ `door_reachable` park law (reason door/balance separated), resume-never-backfills; battery 5/5 in CI | ❌ **NO** — no production burn caller passes live door health (the founder's standing reminder: implemented ≠ live-wired) |
| AV-4 cross-rail disjointness + handle unlinkability | ✅ | ✅ door audit over ACTUAL journal artifacts (identifier-leaf disjointness, payer/nonce containment, cross-chain silence, filename distinctness; leaky control detected) in CI; entropy quote handles (10k-mint no-reuse) — sequential minter retired | ❌ **NO** for the door (chartered no-production; testnet runbook only) and ❌ for handles (the box x402 meter predates the minter fix) |
| AV-5 reorg / flag-not-credit | ✅ | ✅ `process_transfers` pure seam: seq→trx swap + head-rollback ⇒ flag loudly, zero credit, watermark parks; reversibility quorum drill (NoQuorum/Reorg{depth}) — both in CI | ❌ **NO** — the box chainpoll runs pre-AV-5 code; the reorg leg deploys with the meter |
| AV-6 retry-storm failure-charge ceiling | ✅ | ✅ `FailureChargePolicy` inclusive ceiling, typed loud refusal, per-attempt evidence rows preserved incl. refused attempts; battery 4/4 in CI | ❌ **NO** — no caller wires a policy; translating booked fees to escrow `chain_fee` charges is deploy-side rate-book work |
| AV-11 human native-gas surface | ✅ | ✅ audit in CI: every rail classified, first-line gas surfaces REGISTERED with R5 remediations, future-rail detector fails unregistered surfaces; **registered ≠ resolved** — 5 findings (Base "tiny gas" top-up ×2 surfaces, Arbitrum ANT gas estimate, gas-read status line, gwei rendering) are the R5 gas-abstraction backlog | ❌ **NO** — the registered findings are live human-gas surfaces today; resolution = the R5 sponsored/abstracted paths (4337 paymaster shapes, 7702, L2-native sponsorship) |
| AV-7 two-route separation (P2) | ✅ spec'd | ❌ not built (D2 MINE target — the RED is the deliverable when the lane runs) | ❌ |
| AV-8 settle-UNKNOWN reconciliation (P2) | ✅ spec'd | ❌ (door journal laws exist; the reconciliation drill not built) | ❌ |

**The standing rule**: a lane's dispatch may claim column 2 the moment CI is
green. Column 3 requires a box receipt naming the wired caller — and until
then every "protection" above is a repository guarantee, not a production
one.
