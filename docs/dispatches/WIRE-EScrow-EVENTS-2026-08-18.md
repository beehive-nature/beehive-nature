# DISPATCH → all seats · the Escrow Wire · 2026-08-18 (zCode, 1st assistant)

Founder order: "another giant leapfrog — the socioeconomic gold standard."
Founder enabled: zCode may send orders to Claude Code directly.
Basis discovered: `ui/` (port 5173) — the Scenario Viewer — the escrow engine's
lifecycles, guards and refusal paths already walkable. The surfaces' "docking
soon" language now has a real dock to wire to.

## THE WIRE (one schema, every floor)

Every offer/accord/offtake on every surface becomes a first-class escrow event
in the engine's own shape (from the fixtures, verbatim fields):

```
order_id · buyer_did (did:plc:…) · seller_did · amount · asset_id (fUSD)
escrow_wallet_id (msig) · carrier · tracking · source_chain (Zano)
steps[]: OrderPlaced → OrderFunded → … · guard refusals WITH visible math
```

## ORDERS

**CLAUDE CODE (Seat 3) — the heavy wire, in order:**
1. Export the engine's event/guard types from `ui/` fixtures into a shared
   `ui/src/escrow-schema.js` (no new deps).
2. Market (`market.html`): "inquire" gains an ESCROW PREVIEW step — draft the
   event, show the guard-check table (asset provided/required, fee buffer)
   BEFORE the note copies. Refusal math visible = the cushion law, engine-grade.
3. Farmers market (`farmers.html`): bAccord note embeds the event JSON; the
   accord card PNG gains a small QR of the deep link (qrcodegen pattern from
   WS-5; no new libs).
4. Coop (`coop.html`): offtake notes emit the event WITH carrier/tracking
   fields — physical logistics first-class from day one.
5. Landing protocol stays: parse gate + local `sh scripts/secret-scan.sh tree`
   green BEFORE commit; `&&` chains only (the 94e8b90 lesson is standing law).

**GOOSE (2nd fellow):** 8v the schema export against the fixtures — every field
must trace to a rendered scenario; no invented fields.

**CDESIGN:** the guard-table's visual language (refusals are amber, never red —
a refusal is information, not failure — founder's honesty principle).

**ZCODE (me):** the parlor + hearth build (clean file-tool pass), then verify
CC's wire in-browser per surface, claim-by-claim.

## STANDING LAWS (unchanged, now load-bearing)
- Locked inscriptions only trade; exact amounts; cushions shown; art never
  touches pools; refusals show their math.
- Static-first: fixtures until the contract signs; no backend before the escrow.
- done = deployed + verified + named as exactly what it is.

— zCode (GLM 5.3), filing from the founder's floor 🐝
