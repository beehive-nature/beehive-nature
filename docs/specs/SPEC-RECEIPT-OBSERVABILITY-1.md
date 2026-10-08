# SPEC-RECEIPT-OBSERVABILITY-1 — receipt-derived observability: a BNR design law

Status: RATIFIED 2026-10-06 by founder word ("Ratify it."), after two
independent lanes converged on the same primitive unprompted. Short form:
`docs/architecture/receipt-derived-observability.md`. This spec promotes
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

5. **ant-reach two-network experiment** — docs/receipts/
   ant-reach-2026-10-06.json (+ the cohort receipt): the §experiment
   itself ran as the law prescribes — dials classified into receipts,
   compared across networks, concordance stated exactly (365/365, zero
   opposite), endpoint identity reduced to pseudonymous fingerprints.
   Evidence ready for upstream.

## THE PRECISION LAW (evidence localizes, never over-diagnoses)

An evidence light states WHAT the run establishes, not the diagnosis it
suggests. Worked example, binding wording: 129/131 failed attempts never
reached ICE-connected — that LOCALIZES the failure to the
connectivity-establishment layer and is CONSISTENT WITH
unreachable/misadvertised UDP endpoints; it does NOT distinguish closed
port vs NAT mapping vs firewall vs stale candidate vs bad advertisement.
The narrower claim is the stronger upstream gift: evidence, not a
diagnosis we have not measured.

## §experiment — the narrow ant-node test (Step 2 — COMPLETED 2026-10-06)

```
advertised WebRTC endpoint
→ browser attempts it
→ classify the failure (pre-ICE / post-ICE / handshake / channel / answer)
→ retry from a SECOND independent network
→ compare
```

**Step 2 — COMPLETED 2026-10-06.** Laptop and GitHub-hosted runner
(e2e/ant-reach-probe.mjs; runner side = GitHub Actions run 37525604244)
independently exercised the same live bViEw direct route during
overlapping 150 s windows. Among 365 endpoints settled by both networks,
outcome concordance was 365/365: 195 failed from both, 170 opened from
both, and zero differed by network (10 were unsettled somewhere). All 195
dead-everywhere endpoints never reached ICE-connected on EITHER network.
Receipt: docs/receipts/ant-reach-2026-10-06.json (schema
bnr.ant-reach-receipt/1). This localizes the problem away from one
client network and toward endpoint-specific reachability/advertisement
state; it does not diagnose the underlying cause — the PRECISION LAW
holds on the completed result too.

Privacy shape, as ruled: endpoint IDs are truncated deterministic
fingerprints — first 16 hex of SHA-256("ip:port") — pseudonymous by
design (holders of the advertised set can recompute; raw addresses are
not published). No global collector exists.

FOLLOW-UP EVIDENCE, already banked (not a prerequisite): a 40-endpoint
cohort held across time and THREE vantage points kept its phenotype —
docs/receipts/ant-reach-cohort-2026-10-06.json + cohort window 2
(commits e7be8a369, 31e97c333). The temporal/third-network repeat the
founder called useful is therefore already in the record.

## §sequence (founder ruling 2026-10-06, binding order — AMENDED 2026-10-06 on completed evidence)

1. ✓ DONE — bank receipt-derived observability as a cross-stack rule
   (THIS SPEC @eebe10646; the bmesh dashboard revert rode the same push).
2. ✓ DONE 2026-10-06 — the independent-network Autonomi reachability
   experiment COMPLETED (§experiment above; receipts on main). The
   second network was a GitHub Actions runner — no founder gesture
   was required.
3. ← CURRENT — take that evidence UPSTREAM (David's team) BEFORE
   touching ant-node. Founder ruling 2026-10-06: no additional
   hour/day/network repeat is a prerequisite — temporal/third-network
   repeats are follow-up evidence, and the first cohort is already
   banked (40 endpoints, three vantage points, phenotype-stable).
4. LATER — generalize the projection primitive into bMESHasi/x0x:
   smallest common receipt-projection contract first, dashboards after
   (the reverted lane's receipts format is preserved on branch
   zcode/bmesh-lights-2026-10-06 as input).

## §future mappings (the law applied forward)

- bPay/bMeter: `AUTHORIZATION → SETTLEMENT → RECEIPT → cockpit says what
  actually happened` — never "probably fine."
- x0x/bMESHasi: `capability granted → route created → exercise observed →
  revoked → cockpit` — the same fold, different semantic receipts.
