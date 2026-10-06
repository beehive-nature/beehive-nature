# SPEC-RECEIPT-OBSERVABILITY-1 — receipt-derived observability: a BNR design law

Status: BANKED 2026-10-06 by founder ruling, after two independent lanes
converged on the same primitive unprompted. This spec promotes
`event → receipt → projection → human truth` from a bChat/bViEw
implementation detail to a cross-stack architectural rule.

## THE LAW

User-facing state MUST be a deterministic derivation of receipts the system
already banked — never a second mutable health model, never polled theater:

```
receipts[] → derive(surface) → { state, tone, word, evidence[] }
```

- Every domain keeps its OWN semantic receipts (no universal status schema).
  The generic piece is the derivation RULE, not a giant shared shape.
- A light, chip or word is allowed to say "green/ok" ONLY when the receipt
  that proves it exists. Otherwise it says NOT MEASURED in the words
  themselves (dashed rim, no fill — non-value states are first-class).
- NO TIMER WITHOUT A MEASURED REFERENT. A countdown that counts nothing we
  can name is theater (the doxx "39s" key timer is the named anti-pattern).
  The doxx tungsten test technically failed and produced the productive
  mutation: their pretty status lights became BNR evidence lights, and the
  evidence lights then exposed a real mainnet transport problem. That is
  the tungsten failure working as intended.

## PROVEN INSTANCES (receipts, not claims)

1. **bChat cockpit** — `aae4d8751764c4e6e422c5cbd27ad5cb3ddc3e65`:
   `bchat-cockpit.js` is a PURE FOLD over the receipt stream. Regressions
   prove: an open socket is NOT enough for relay green;
   `restricted: not a relay member` remains a failure state; fallback
   differs from primary; offline is a valid state; plaintext cannot leak
   through the cockpit projection. Live: dialled → socket open 325 ms →
   challenged → signed in 73 ms → relay said no, shown in warning tone.
2. **bViEw transport funnel** — `7035ccd6bf2a2fad6706dd6e3b38617b35456871`:
   every WebRTC connection the Autonomi SDK opens becomes receipts through
   ICE / DTLS / channel / answer. Live mainnet receipt (one network, one
   moment): 329 dials · 176 opened · 131 dead · 22 waiting; 118/247 settled
   endpoints reachable; 129 of the 131 dead attempts never reached
   ICE-connected; p50 dial→open 2.58 s, p95 5.49 s. Status line: "19 of 37
   nodes answered"; zero-answer says so instead of "went quiet".
3. **bmesh-meter** — `crates/bmesh-meter` (receipts 2026-08-16): 17 tests,
   mutation-proven, vectors derived independently before the assertions —
   receipts-as-tests, proven in CI on every push.
4. Honest lineage: a bMESH/x0x five-light surface built 2026-10-06 on this
   same pattern was REVERTED the same day by founder ruling (§sequence) —
   extract the common contract BEFORE building another dashboard. Its
   receipts-file format (state/what/source/measuredAt; no-timer law;
  measured-lights-must-cite) is preserved on branch
   `zcode/bmesh-lights-2026-10-06` as input to step 4.

## THE PRECISION LAW (evidence localizes, never over-diagnoses)

An evidence light states WHAT the run establishes, not the diagnosis it
suggests. Worked example, binding wording: 129/131 failed attempts never
reached ICE-connected — that LOCALIZES the failure to the
connectivity-establishment layer and is CONSISTENT WITH
unreachable/misadvertised UDP endpoints; it does NOT distinguish closed
port vs NAT mapping vs firewall vs stale candidate vs bad advertisement.
The narrower claim is the stronger upstream gift: evidence, not a
diagnosis we have not measured.

## §experiment — the narrow ant-node test (step 2; design banked, run pending)

```
advertised WebRTC endpoint
→ browser attempts it
→ classify the failure (pre-ICE / post-ICE / handshake / channel / answer)
→ retry from a SECOND independent network
→ compare
```

If the same advertised endpoint repeatedly fails from independent browser
networks while another endpoint repeatedly succeeds, the hypothesis moves
from "this client/network had trouble" toward "the advertisement itself is
bad." Privacy shape, per founder: locally generated only — `endpoint_hash`,
advertisement observed, attempt classifications A/B/C, timestamps, coarse
client/network class; the raw address is discarded after hashing. NO
global telemetry collector until a collector and a privacy ruling exist.
BLOCKED ON: a second independent network (founder gesture).

## §sequence (founder ruling 2026-10-06, binding order)

1. Bank receipt-derived observability as a cross-stack rule (THIS SPEC).
2. Run the independent-network Autonomi reachability experiment.
3. Take that evidence UPSTREAM (David's team) BEFORE touching `ant-node`.
4. Only then generalize the projection primitive into bMESHasi/x0x —
   smallest common receipt-projection contract first, dashboards after.

## §future mappings (the law applied forward)

- bPay/bMeter: `AUTHORIZATION → SETTLEMENT → RECEIPT → cockpit says what
  actually happened` — never "probably fine."
- x0x/bMESHasi: `capability granted → route created → exercise observed →
  revoked → cockpit` — the same fold, different semantic receipts.
