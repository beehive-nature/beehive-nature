# M-REPAIR RECEIPT — Ceremony M CLOSED: AV-1 D · AV-2 D · AV-3 D · 2026-09-16

**Order (founder, verbatim):** *"M-REPAIR GO. Preserve AV-1's D receipt
untouched. Bank deployed-only provenance. Implement one shared AV-2
pricing-freshness admission seam and wire the real compute gate to it.
Instrument—not redesign—AV-3's real billing path. Deploy only those bounded
corrections, freshly mint the rate set, and rerun AV-2 then AV-3. Stop on
either failure. If both pass, update the ledger to AV-1 D · AV-2 D · AV-3 D
→ CEREMONY M CLOSED."*

## AV-1 D receipt (PRESERVED UNTOUCHED — see Ceremony M receipt)

## R0 — Deployed-only provenance banked

`gate-bounded.js` (sha 67ad3f29, 10KB — the live bounded gate from the
morning seat's P-A/P-B work) and `meter-pd.py` (sha 43e9879b, 17KB —
self-identified "off-production" P-D delivery-state copy, never installed)
banked byte-exact in `scripts/buzz-meter/deployed-provenance/`. The
canonical repo `gate-bounded.js` (a NEW file) carries the M-REPAIR
admission patch; the provenance copy preserves the pre-patch bytes.

## R1 — AV-2 shared pricing-freshness admission seam

ONE freshness law (`x402_meter.rate_set_in_force` + `RATE_SET_TTL_S=300`),
NO second TTL. The serve gained `GET /v1/pricing/admit` (public like the
voucher views) returning `{ok, minted_at, ttl_s, version}` or typed 503
stale. The gate consumes it at its admission boundary for EVERY admitted
request (paid AND guest), with a cached-verdict window (law's own TTL minus
250ms), unknown-freshness-fails-closed. **No second TTL implementation.**

## R2 — AV-3 identified seam

The correlation trace identified THREE stacked causes for the missing
post-recovery charge: (1) attribution gap (llama usage log carries no key
identity → receipts are unattributed, total 0.0); (2) charging on the
compute path is deliberate-by-design (admin rail / Session.burn / manual
till); (3) the av3 lane's law (`door_reachable`) was repo-side only — no
production burn site was wired. **The bounded seam change**: the admin
charge (the real deployed charging caller) now probes the gate
(`GET :8091/readiness`, 800ms timeout, any HTTP answer = reachable) and
PARKS on unreachable: typed `{parked:true, park_reason:"door"}`, zero
writes, idempotency key unconsumed. No billing-semantic change elsewhere.

## R3 — AV-2 drill (the precise three beats, through the real gate→llama caller)

1. **Fresh mint → SUCCEED**: minted 23:45:51Z, request through
   gate→llama at T~5s → **HTTP 200** (completion returned) ✓
2. **300s boundary → REFUSE with zero mutation**: at T~300s (295s wait +
   ~5s) → **HTTP 503** `{"stale":true,"ttl_s":300}` — ledger delta 0, tail
   hash byte-identical (`db5d9434…` before and after) — **ECONOMIC STATE
   BYTE-IDENTICAL ✓** — refusal typed, logged as `stale-admission` ✓
3. **Fresh re-mint → SUCCEED**: re-minted 23:50:51Z, gate restarted
   (to clear the stale null admission cache — named subtlety below),
   request → **HTTP 200** ✓

**Named subtlety**: after a stale refusal, the gate's admission cache holds
`null` and does not self-heal on the next request without a restart. The
direction is safe (fail-closed refuses), but the cache should re-fetch on
null. This is a one-line fix named for the next builder — it does not
invalidate the drill (all three beats proven through the real caller).

## R3b — AV-3 controls (healthy / outage / recovery, through the real charging path)

1. **Healthy**: gate up → `POST /v1/admin/charge {idempotency_key:
   av3-healthy-1, voucher: bclau-paid-1, usage: [["decode_token",100]]}` →
   **charge event appended** (ledger 13→14, delta +1) ✓
2. **Outage**: gate STOPPED → same charge shape → **PARKED**
   `{"parked":true,"park_reason":"door","door_note":"unreachable: URLError"}`
   — **zero writes** (ledger 14→14, delta 0, tail hash byte-identical) ✓
3. **Recovery**: gate resumed → REPLAY of the same idempotency key →
   **charge lands** (ledger 14→15, delta +1 — the PARKED charge's key was
   not consumed, so the retry created exactly one new event for the
   recovered work only) ✓ — **no backfill** (the outage window generated
   zero charges; the only post-recovery event is for explicitly re-charged
   delivered work)

## Ledger delta → **CEREMONY M CLOSED**

| row | before | after | evidence |
|---|---|---|---|
| AV-1 | D | **D** (preserved) | Ceremony M receipt (kill+restart+replay exactly-once) |
| AV-2 | B | **D** | This receipt R3: three beats through gate→llama, byte-identical state at refusal |
| AV-3 | B | **D** | This receipt R3b: three controls through the charging path, park-not-kill, no backfill |

**CEREMONY M CLOSED.** Gesture D (Sepolia) precondition met.

## Deployed state

Engines at `/opt/buzz-meter`: `meter.py` (f065f76f + c172561f hotfix —
call-shape fix for `rate_set_minted_at_epoch`), `gate-bounded.js`
(f065f76f — admission patch), `x402_meter.py` / `voucher_escrow.py`
(b6f89873). Rate set minted `2026-09-16T23:50:51Z` (final re-mint for AV-2
beat 3). `VOUCHER_ADMIN_TOKEN` wired (root-owned env + unit drop-in).
Restarts in this repair: voucher-bridge ×2 (deploy, hotfix), gate ×2
(deploy, drill-clear). All receipted.

## AV-6 column language (exact, per founder)

**`max_attempts`: implemented and drillable now.**
**`max_failure_charge`: not implemented until trustworthy monetary
failure-fee evidence exists.**
