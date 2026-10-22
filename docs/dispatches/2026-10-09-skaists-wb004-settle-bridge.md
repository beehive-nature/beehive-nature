# 2026-10-09 — Skaists × WB004: the SETTLE bridge at model scale (order reconciliation + delta execution)

Lane: btungsten / SK001 + WB004. Seat: zCode. Order: founder 2026-10-09
(the bTunGsTeN/Skaists distinction message).

## Reconciliation first (order-reconciliation law)

The order matches a PROVEN artifact: nearly every line of it is already
canon, verified at the tip before any labor:

- **The invariant** — "Skaists Seat Sovereignty: at every governance
  epoch, no natural human may control more than one active membership
  seat, every active seat must resolve to exactly one eligible living
  human and exactly one of the five constitutional energy types, and no
  verifier needs access to that human's underlying biometric or civil
  identity to establish eligibility" — is VERBATIM the founder ruling
  2026-10-07 in SPEC-SKAISTS-SEAT-SOVEREIGNTY-1 (PR #353 @6c9147d74,
  ratified #355 @2fb2bd4f1).
- **The proofs set** — UNIQUE / LIVE-authorized / SEAT / ENERGY_TYPE ∈
  {1..5} / CURRENT_EPOCH — is EXACTLY `PROOF_KEYS` in
  scripts/btungsten/sk001-seat.mjs:152; PROVE's input is (era, seat),
  structurally unable to reach evidence never stored.
- **COMMIT's private evidence boundary** — canon (the battery byte-scans
  the proof and era export for evidence bytes).
- **The arithmetic law** — 7,776 = 6⁵, no factor of five, population a
  measured variable, weight the exact rational 1/5 per constituency
  constant in population, no float, the {1556, 1555×4} packing recorded
  and not constitutional — canon in the SK001 battery (10/10 CI).
- **The bTunGsTeN/Skaists framing** (planetary machinery vs one bounded
  deployment) — the README's SK001 section says exactly this.

**The delta, named by SK001's own header**: `SETTLE — future beat … NOT
MODELED HERE`. The order's "SETTLE can ultimately drive an
Antelope/Vaulta multisig" became executable TODAY because WB004's
epochal engine landed tonight (PR #377): the aggregate → bounded
short-lived msig → immutable receipt machinery. The delta executed:

## The bridge (crates/btungsten-wb004/tests/skaists_bridge.rs, 2/2 green)

- The organism: 7,776 seats DERIVED from the sixfold five-layer
  geometry (never hardcoded); five constituencies under an adversarially
  UNEQUAL occupancy {4,000, 1,200, 1,200, 1,000, 376} — population is a
  measured variable; one human, one seat (a second seat for the same
  human refused).
- The five predicates gate every voting seat (UNIQUE, LIVE, SEAT,
  ENERGY_TYPE, CURRENT_EPOCH).
- COMPRESS re-derived in integers (sk001-seat.mjs:182-202): per-
  constituency member majority, federation by strict majority of the
  five equal 1/5 rational weights — population never enters, no float.
- SETTLE: the compressed verdict (five tallies + constant weights +
  verdict, canonically serialized) drives `Engine::epoch_cycle` — the
  6⁵ organism aggregates through shards into ONE constant-size msig
  proposal; exec inside the 7-day TTL; the immutable hash-chained
  receipt binds the payload digest. The execution layer stayed ≤3
  permission levels while the organism is 7,776 (law L3 witnessed at
  organism scale).
- **The population governor convicted by disagreement**: the three small
  constituencies (2,576 humans of 7,776) pass a motion by 3/5
  constitutional weight that population-weighting (5,200 humans) would
  block — the constitutional verdict is the settled one; the population
  governor is the teeth, not the law.

## Canon updated

- sk001-seat.mjs header: SETTLE now "MODELED 2026-10-09 at model scale
  by the WB004 bridge; LIVE Antelope/Vaulta settlement stays named, not
  claimed (non-inheritance law)."
- SPEC-SKAISTS §deployment-status: the SETTLE row splits — model scale
  MODELED (this bridge); live chain NOT BUILT, not inheriting the model
  receipt.
- README: SK001 section gains the SETTLE-bridge paragraph.

## Boundaries

- This is a MODEL bridge: SK001's sha256 commitment remains a binding
  placeholder (hiding NOT claimed), liveness/proofs are interfaces, and
  no live Antelope/Vaulta settlement exists or is implied — the
  non-inheritance law (founder ratification 2026-10-07) governs.
- Receipts: `cargo test -p btungsten-wb004 --test skaists_bridge` 2/2;
  full crate 15/15 after the bridge; fmt + clippy clean.

## NEXT OWNER

- CI green on this PR → this seat merges.
- Named open, unchanged: hiding commitment scheme; live PROVE; live
  SETTLE on a real chain (founder-gesture class); the WB004 Cryptol
  twin; aggregation cryptography behind the fixed interface.

HUMAN INTERACTION: NONE.
