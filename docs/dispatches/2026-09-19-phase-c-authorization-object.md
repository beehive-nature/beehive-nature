# PHASE C — the founder-reviewed authorization object: built, mock-proven, awaiting YOUR press

**Seat:** zCode (bPay/bData UI). **Date:** 2026-09-19. **Branch:**
`zcode/bdata-phase-c-2026-09-19`. **Advisor gate (verbatim intent):** *one
founder-reviewed authorization object, bound to this exact invoice/quote lineage,
with explicit ceilings and stop conditions, before any signing path is exposed.*

## What exists now

**The authorization organ (antd-bridge v3, `/v1/authorization`):** persists the
founder authorization record and REFUSES (never repairs) at every binding:
the job must be OPEN with a `founder-selected:<audience>` binding (a machine
default is refused outright); artifact sha+bytes must match; the ANT ceiling
must EQUAL the carried quote total (never above); and the commitment digest
must re-derive from the job's OWN chosen payment set — **the no-silent-requote
wall: any re-quote voids the authorization by construction, not discipline.**
Gas rides as a separate ceiling field, never folded. States:
`authorized-for-signing → cancelled` (append-only events; idempotent re-press).
Verified live by refusal probes only — **zero authorization records exist; the
founder's press is unexercised.**

**The review step (bData):** after a fresh price, "➜ Review what you are
authorizing" opens the panel IN PLACE (one concept, one page): invoice digest +
lineage, exact artifact identity, audience = founder-selected origin My Data,
ANT ceiling ("exact, never above"), gas separate (Arbitrum ETH, wallet-side),
freshness + single-use (the digest wall), stop conditions, and the law line:
*this press creates a bounded intent to sign — it cannot move value; signing is
Phase E.* **"I authorize this"** → the bridge record; **Cancel** → clean state,
"no paid or uploaded state exists." A stale cached price refuses to open the
review (refresh first) — the authorization binds the live quote, never a stale
one.

**founder2 invoice banked** (`surfaces/bpay-invoice-founder.json` +
`docs/receipts/bpay-invoice-founder2-2026-09-19.json`): the founder's price
REFRESH (2026-09-19T01:16:58Z, job up-1789780618488, founder-selected:public)
produced a **third observation: 4.0662581103515625 ANT** — lineage
reference → founder1 → founder2; the bridge's digest derivation and the
invoice's commitment agree byte-for-byte (sha256:ef803a7d…).

## Boundary interpretations (for the oracle seat to challenge)

1. **No A9c trip:** the tripwire guards the *pay* route; Phase C exposes
   **review + authorize-intent** with payment impossible from every surface
   (asserted by the gate). The RECON invoice obligation remains
   AWAITING-AUTHORIZATION until a *signature* exists — the authorization
   object is product-layer intent, not a settlement conclusion. The Phase E
   pay route will trip A9c deliberately and take the SURFACE_READY re-ruling
   with live exercise.
2. **The 200 ms distinction stands:** cached presentation latency ≠ live quote
   latency (measured 42–60 s network-fresh) — stated in the corpus string
   itself ("cached — shown instantly; a refresh asks the network again").

## Evidence

Gate 30→**42/42**: every review-panel binding asserted (digest+lineage,
artifact, audience provenance, ceiling exactness, gas separation, freshness +
digest-wall, nothing-paid + cannot-move-value), the press creates the record,
cancellation is clean, history appends (origin + auth + cancel + automation
editions), no pay-route strings, no signing path. Mock bridge validated the
founder-shaped request server-side; the mock's prepare speaks the CURRENT
founder invoice's own totals/quotes so the cross-checks are real. Two gate
defects found+fixed en route (both mine, same class: server-lifetime state
declared inside the request handler — the counter and the auth store). Family:
ownership 2/2, Phase B 15/15, Phase A 18/18, estate-source 11/11, selftest
5/5, RECON-1 oracle GREEN, scans clean.

## BOUNDARY NOT CROSSED

No payment. No wallet signature. No Trezor. No upload/finalize. No pointer.
The bridge holds ZERO authorization records — the first one is the founder's
press to make.
