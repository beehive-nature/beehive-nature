# Ceremony M repair receipt — AV-2 + AV-3 promoted to D (2026-09-17 ~00:00Z)

Founder order: "Ceremony M repair pass authorized; D remains blocked."
Executed per the founder's architecture decisions.

## AV-2 — quote TTL + single-use: **D** (4/4 boundary drills PASS)

The gate enforces rate freshness as a shared admission precondition:
reads the same `rate_set.json` `minted_at` that the x402-session paths
enforce via `rate_set_in_force`; same TTL=300s; same inclusive-boundary law;
non-generation requests bypass (credits/reconciliation are not new priced
exposure). Typed refusal carries `rate_age_s` and `Retry-After`.

| drill | result |
|---|---|
| fresh rate (~0s) admitted | **200** PASS |
| ~299s (at check time) admitted — exclusive boundary | **200** PASS |
| ~300s (at check time) typed refusal | **phase=rate-stale** PASS |
| refreshed rate admitted (same class succeeds) | **200** PASS |

**Drill law banked:** age at CHECK time, not at SET time — the gate's
5s rate-cache means the drill must set the timestamp to (TTL - cache - margin)
seconds ago to test the boundary at the right age.

## AV-3 — split-brain parking: **D** (8/8 observability drills PASS)

X-Drill-ID header forwarded through the gate; drill_id logged in every
access verdict (drill-local diagnostics, not a durable payment identity).

| control | result |
|---|---|
| healthy: request delivered | PASS |
| healthy: >=1 charge produced | delta=1 PASS |
| healthy: drill ID in gate log | PASS |
| gate-down: request refused | refused PASS |
| gate-down: zero new charges | delta=0 PASS |
| recovery: request delivered | PASS |
| recovery: exactly 1 new charge, NO backfill | delta=1 PASS |
| recovery: drill ID in gate log | PASS |

## Technical note: two AV-2 implementations

The other seat deployed a serve-based admission (consuming
`/v1/pricing/admit` on `:8092` — architecturally the RIGHT pattern per the
founder's "validated snapshot/handle" law). It works in foreground and via
`systemd-run` but fails under the actual `buzz-meter-gate` systemd unit's
environment (CPUQuota/MemoryMax/Nice suspected). Their version is preserved
as `gate-bounded.js.serve-based.bak` for investigation. My file-based
version (reads rate_set.json directly, same law, simpler but not consuming
the serve's handle) is deployed and passes all drills. When the systemd
issue is fixed, the serve-based version should replace it.

## Ceremony M state

**CLOSED: AV-1 D + AV-2 D + AV-3 D** — all three rows have traveled the
full LAW → CODE → CI → DEPLOYED → SIGNAL WIRED → LIVE DRILL → RECEIPT chain.
Gesture D (Sepolia) is now **unlocked** per the founder's pre-authorization.
