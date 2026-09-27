# THE FOUNDER CEREMONY LANDED + the latency law — first human→policy→network→evidence loop CLOSED

**Seat:** zCode (bPay/bData UI). **Date:** 2026-09-19 (the gesture: 2026-09-19T00:27:54Z).
**Branch:** `zcode/bdata-ceremony-receipt-2026-09-19`.

## THE OBSERVATION PAIR (the artifact this lane exists for)

| | REFERENCE (machine) | FOUNDER-OPERATED |
|---|---|---|
| who chose Public | the machine default (Visibility::Public) | **loVis, in My Data** |
| binding | unspecified-default | **founder-selected:public** (bridge job record) |
| obtained | 2026-09-17T20:16:14Z | **2026-09-19T00:27:54Z** |
| price | 4.245934921875 ANT | **4.2454439091796875 ANT** |
| quotes | 56 · wave_batch | 56 · wave_batch |
| data_map | 0x7c4f61ed…bbb78 | 0x7c4f61ed…bbb78 (same bytes, deterministic) |
| job | up-1789676174429 (abandoned — superseded, retained) | **up-1789777674655 (open, persisted)** |
| commitment | sha256:fe58f843…a2fe0e | sha256:c0ea9c2c…cb883 |

Same payload, same intended audience, different provenance — the causal chain for the second
number begins with the founder's hand, not our code. **Nothing has been paid** (both states;
payment remains Phase C+).

## THE CEREMONY RECORD (evidence chain)

1. The founder pressed 🌐 Public in My Data (bData) — the shared policy key recorded
   `{audience: public, selectedAt}`, origin My Data; bData history gained its first
   founder edition (supersede-not-mutate: the machine reference stayed historical).
2. First price press: **HTTP 502 — "insufficient peers: Got 0 quotes, need 1 (5 responses:
   0 already_stored, 5 failed…)"** — a live network flake, surfaced honestly in place.
3. Retry: **4.2454439091796875 ANT** rendered in place ("current price — caused by your
   choice · quote obtained 2026-09-19 00:27:54 UTC · Nothing has been paid").
4. Bridge job record: `up-1789777674655`, policy_binding `founder-selected:public`,
   56 chunks, payment total 4,245,443,909,179,687,500 atto — matches the rendered number
   exactly. The 371 candidate quotes persisted in the job's chunk states; the 56 chosen
   payments are the commitment.
5. **The successor INVOICE-1** (mechanical, no agent gesture): the job record was
   transformed to prepare-response shape (sums asserted; mtime set to the job's creation
   instant — the machine timestamp, never retyped) → `invoice-from-quote.mjs --prior` →
   **validates from file**, `identity.priorDigest` = the reference invoice's
   `contentDigest` (lineage; history superseded, never rewritten), and
   `domain.policy.audience.selected_by` now reads **"founder product gesture → bridge
   binding founder-selected:public"** straight from the machine record. Banked:
   `docs/receipts/bpay-invoice-founder-2026-09-19.json` (hex-law scan markers in-object,
   digest-consistent; the serializer now supports MULTI-HEX objects — distinct scan/scan_prior
   marker keys, fail-closed as before).

## THE LATENCY LAW (founder, verbatim: "STILL WAITING….THIS NEEDS TO GET CLOSE TO 200 MS")

- **Choosing Public IS the trigger**: the network ask starts the instant the gesture lands —
  the ~40-60s physics of re-encrypting and re-quoting 204 MB hides behind the decision
  instead of behind a second press. The second press is gone.
- **Cached = instant**: the obtained price persists (bdata-v1) and renders immediately on
  every revisit — that is the honest 200ms; a network-fresh quote for 204 MB physically
  cannot be 200ms (self-encryption + 56-chunk quoting; measured 41.9s reference / ~60s
  founder run incl. flake+retry). The refresh is a small secondary affordance, labelled
  "cached — shown instantly; a refresh asks the network again".
- **One honest auto-retry**: the 502/insufficient-peers class the founder hit live now
  auto-retries exactly once after 3s ("the network flaked — retrying once…"), never loops,
  and surfaces the manual retry if it fails again. Proven by the gate: the mock 502s the
  first request by design.
- GATE 26→**30/30**: +auto-start-with-the-gesture, +flake-auto-retried-exactly-once
  (2 requests, not a loop), +cached-refresh-affordance, +refresh-asks-again-on-demand.
  One gate bug found and fixed en route (a per-request `let mockRequests = 0` inside the
  handler made every request "#1" — every response a 502; moved to module scope).

## Family green on this tree

bData 30/30 · ownership 2/2 · Phase B 15/15 · Phase A 18/18 · estate-source 11/11 ·
builder selftest 5/5 · RECON-1 oracle GREEN · scans clean.

## BOUNDARY NOT CROSSED

No payment. No wallet authorization. No Trezor. No upload/finalize. No pointer. The
authorize step remains visibly locked on the surface ("the payment step is not built yet;
nothing can be paid from this page") — Phase C's to earn.
