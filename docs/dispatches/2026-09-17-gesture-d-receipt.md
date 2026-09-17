# GESTURE D RECEIPT — Sepolia door assurance ceremony · D(door-integration) · 2026-09-17

**Order (founder, verbatim):** *"GESTURE D — SEPOLIA DOOR ASSURANCE CEREMONY.
No production placement. No P2. Preserve the exact deployed/test SHA and
configuration before beginning. D0–D6. STOP on the first failed bar."*

**Qualifier (honest):** this ceremony exercises the door's LAWS through its
actual runtime — one binary, one journal, one continuous session, mock
facilitators faithfully reproducing success/error/ambiguity. The **live
Sepolia leg** (funded throwaway wallets, real EIP-3009 signatures, real tx
hashes on 84532) **awaits the founder's funding gesture** per the
SMOKE-RUNBOOK ("PENDING — do not fund yet"). This is **D(door-integration)**,
not D(Sepolia). The door has **no production-placement authorization**.

**Commit:** `tests/d_ceremony.rs` on main (branch
`zcode/av5-av4-av11-matrix-2026-09-16`). All 37 door tests green.

## Phase receipts (from `--nocapture` output)

**D0 — baseline:** clean journal root, 0 rows at start; ceiling=3,
cap=100,000 wei, float=10¹⁸ wei. ✓

**D1 — multi-leg:** 3 legs (exact on Base, upto on Base reconciling 10→5,
exact on Arbitrum) — all settled, per-leg nonces distinct, upto reconciled
to actual, cross-chain artifacts in separate rail directories. ✓

**D2 — AV-6a retry storm:** one leg driven through no-evidence failures;
**exactly 3 facilitator calls** (the configured ceiling); attempt 4
refused BEFORE execution (facilitator count unchanged). The refusal is
loud and names the number. **`max_failure_charge` NOT claimed** (founder's
exact language: "not implemented until trustworthy monetary failure-fee
evidence exists"). ✓

**D3 — AV-5 reorg:** legitimately settled leg → `flag_reorg(depth=2)` →
`ReorgFlagged` with prior evidence `tx-d3-original` preserved verbatim →
replay refused ("reorg-flagged") → expiry release refused →
`resolve_reorg` with HumanGate + new evidence (upto law holds:
over-authorization refused through the gate) → `Settled` with
`reorg_note` preserving `tx-d3-original` + `depth 2`. The flag itself
made no economic decision. ✓

**D4 — AV-8 UNKNOWN:** ambiguous settle → `Unknown` → auto-retry refused
("human gate required") → `resolve_unknown` with HumanGate + evidence →
**same LegKey before and after** (no replacement authorization, no new
signature, no automatic resend). ✓

**D5 — AV-4 R4:** the cross-rail detector ran over the ACTUAL artifacts
produced by D1–D4 (not fixtures) — 6 journal rows across 2 rails; 3
cross-rail tokens found, **all 3 are known test constants** (shared
payTo/asset/from fixture addresses); **0 unexpected joins**. The detector
also CAUGHT a genuine fixture defect on the first run (my facilitator
returned the same tx hash across both rails — the exact join R4 forbids;
fixed to per-rail transactions, which is the detector working as
designed). ✓

**D6 — reconciliation:** journal parses cleanly (6 rows); terminal states
coherent (D1 legs Settled, D2 leg FailedKeep with attempts=ceiling, D3
leg Settled-with-reorg-note, D4 leg Settled); every attempted execution
has evidence. ✓

## Ledger delta

| row | before D | after D | evidence |
|---|---|---|---|
| AV-4 cross-rail audit | A (repo-only) | **D(door-integration)** | D5: detector over real ceremony artifacts, 0 unexpected joins |
| AV-5 reorg | A (repo-only) | **D(door-integration)** | D3: full Settled→Flagged→resolve arc through the door runtime |
| AV-6a max_attempts | A (repo-only) | **D(door-integration)** | D2: exactly ceiling facilitator calls, ceiling+1 refused pre-execution |
| AV-7 two-route | A (repo-only) | rides D1's multi-leg (partial; the two-route fixture is in the adversarial battery) |
| AV-8 settle-UNKNOWN | A (repo-only) | **D(door-integration)** | D4: ambiguous→same-obligation reconciliation |

**AV-6b `max_failure_charge`: SPECIFIED ONLY** (unchanged; evidence-gated).

## The distinction the ledger must make impossible to miss

**M: D(live)** — AV-1/2/3 through the real production callers (box serve, gate, admin rail).
**D: D(door-integration)** — AV-4/5/6a/8 through the door runtime (mock facilitators, one journal, sequential).
**Production door: not deployed / not authorized.**
**Live Sepolia: awaiting founder funding gesture per SMOKE-RUNBOOK.**
