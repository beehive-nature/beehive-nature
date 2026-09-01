# THE MULTI-RELAY ASK — dispatch 2026-08-31 (@ff64da4)

Founder: "we should be the bleeding edge of innovation with the app called
buzz… seems like there should be a way for me to put in multiple relays?"

## THE ANSWER AT SOURCE (not guessed — read in the mirror at box:~/src)

- **Buzz's architecture is single-relay by design.** ARCHITECTURE.md, verbatim:
  "The relay is the single source of truth… no peer-to-peer event exchange, no
  gossip, no replication — just clients connecting to one relay over WebSocket."
- **The client holds ONE address per connection.** The desktop app's
  managed-agents.json: `relay_url` is a plain string; the founder's 19 entries
  show the same agent duplicated once per community. The webview community
  store: single wss:// strings. No fallback/multi-relay schema exists anywhere
  in apps/ or crates/buzz-core.
- **What the app DOES support: many communities** — each is exactly one relay.
  Breadth, not resilience.
- The building wifi kills `skaists.buzz` AND the vendor's
  `*.communities.buzz.xyz` (000/000 from the founder's laptop) — single-road
  clients on this network are dead clients.

## WHAT SHIPPED TODAY

1. **The founder's laptop** (app picked changes up live; timestamped backups):
   - global agent compute rail `skaists.buzz/compute/v1` →
     `relay.skaists.dev/compute/v1` (was a silent no-VPN breakage — agents'
     paid tier rode the blocked road)
   - 5 avatar URLs `skaists.buzz/media/…` → the clean road (media verified
     auth-identical on both hosts: 401 to strangers, app auths)
   - agent relay_urls were already clean (the dual-home lane's work held)

2. **`scripts/buzz-road.mjs`** — the bridge: one command flips every estate
   reference in the desktop app between roads (`clean` / `buzz`), live-reload
   via the app's own config watcher, backups each run, never touches
   vendor-host entries. `show` mode lists the roads all 19 entries use.

3. **SPEC-BUZZ-MULTIRELAY-1** (docs/specs/) — the bleeding-edge build:
   - **§roads** (buildable now): community = ordered address LIST; identity
     name never transport; last-known-good first; failover on connect/TLS/auth
     failure; periodic identity re-probe. NO protocol change needed — dual-home
     already makes every road yield identical events.
   - **§fractal** (named honestly as NOT-BUILT): replication + elasticity —
     what the founder calls "fractal anchored relay redundancy, autonomously
     scaling/contracting nodes" — requires a protocol extension (relay peers in
     NIP-11, relay-to-relay signed replication, lease-driven membership).
   - **§contribute**: fork-to-prove on the estate hives, PR upstream to
     block/sprout. The estate's name on the feature every buzz community
     inherits.

## THE FOUNDER'S MANUAL TODAY

- On the building wifi, no VPN: agents already ride clean roads; for the HUMAN
  account, re-join once from a clean door — open `https://relay.skaists.dev`
  (or relay2) in the browser and use the invite link; the app opens straight
  into the same rooms by the clean name. Same keys, same community, second road.
- Road toggle any time: `node scripts/buzz-road.mjs clean` (and `… buzz` to go
  back to identity names on a saner network).

## NEXT LANE (when the founder says go)

Build §roads in the fork: apps/ web client + desktop crates, prove through the
building-wifi filter, PR upstream.
