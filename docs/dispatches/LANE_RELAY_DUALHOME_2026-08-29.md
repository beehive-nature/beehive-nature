# LANE RELAY DUAL-HOME — the guaranteed path · 2026-08-29

**Founder GO:** "skaists.buzz stays the brand; skaists.dev is the guaranteed path." **Status: server-side STAGED + client failover LANED @e9fef55 — one DNS gesture from the founder completes it.**

## The fault (proved, not theorized)

Filtered-path TLS probe to 129.153.202.144:443, same second, same IP:
- SNI `skaists.buzz` → **`write:errno=10054`** — RST mid-ClientHello, `Cipher is (NONE)`. The middlebox kills the connection by hostname string.
- SNI `relay.skaists.dev` → **no reset** — the filter passes the new name through.
- DNS: all four major resolvers (Google/Cloudflare/Quad9/OpenDNS) answer `skaists.buzz` cleanly — this is SNI/DPI filtering, not resolver-level TLD blocking.
- Box: both relays + caddy + postgres + redis + minio + AlbyHub all `Up (healthy)`; cert valid to 2026-11-26; loopback 200; **Zurich/Moscow/LA external probes all 200 OK** — globally healthy.

## Staged on the box (done)

`/opt/buzz/deploy/compose/Caddyfile` (+ backup `Caddyfile.bak-20260829`), validated and reloaded:
- **`relay.skaists.dev`** → `buzz-prod-relay-1:3000` (hive #1) **+ `/compute/*` → 172.18.0.1:8091** (lane H rides the fallback — bees on filtered ISPs keep the paid tier)
- **`relay2.skaists.dev`** → `buzz-prod-bn-relay-1:3000` (hive #2)
- Certs auto-issue the moment DNS resolves (issuance retries are armed; nothing else to do server-side).

## THE ONE GESTURE (founder hands, Namecheap — the registrar holds the only key)

Add two A records on skaists.dev:
```
relay   A   129.153.202.144
relay2  A   129.153.202.144
```
When they land: certs issue automatically, `https://relay.skaists.dev` goes live, and every proof below turns real-path. Say "added" and this seat verifies end-to-end and reports.

## Client failover (landed @e9fef55 — live on Pages)

`surfaces/buzz-studio.html`, proven in-browser with the primary aborted (filter replayed):
- The opt-in probe cascades primary → fallback and says which answered: *"answering ✓ via relay.skaists.dev · your network filters the skaists.buzz name — the fallback is live, use it below"*.
- **When the fallback answers, the join line itself switches to `wss://relay.skaists.dev`** — a stranger gets the reachable hive without knowing a fallback exists.
- Copy joins whatever the probe proved alive; unprobed, it copies the brand address (RUB LAW kept — probe is opt-in, rendering never needs the relay).
- Battery 14/14; shot: `e2e/shots-wiring/failover-proof-390.png`.

## .buzz exposure inventory (the blast radius, cited)

| endpoint | what rides it | filtered-ISP risk | treatment |
|---|---|---|---|
| `skaists.buzz` (wss) | hive #1 relay — the founder's app + bClaude + bees | **CRITICAL — proven blocked on this ISP** | `relay.skaists.dev` staged ✓ |
| `skaists.buzz/compute` | lane H compute, bearer-keyed — **the till's metered path** | **CRITICAL — same SNI filter** | included in the fallback block ✓ |
| `skaists.buzz/media` | media absolute base (BUZZ_MEDIA_BASE_URL) | high — URLs are absolute; a fallback client still fetches .buzz media | needs relay-side config (`BUZZ_MEDIA_*`) at next maintenance window; flagged, not silently changed |
| `beehivenature.buzz` | hive #2 relay + door + media | **same class** | `relay2.skaists.dev` staged ✓ (media flag same as above) |
| `agents.skaists.buzz` | mail sink (SMTP :25 + MX) | different class — no TLS SNI on plain :25; port-25 filters are separate | leave; monitor; already dual-path via founder's port-25 gestures |
| `beehivebuds.buzz` | resolves to the box (129.153.202.144) — front-door | same SNI class for any TLS browser reach | pages/door only; fallback optional, not hive-critical |
| `beehivebiomass.buzz` / `bnature.buzz` | parked registrar IPs (162.255.119.x) — not the box | registrar-parked, no estate service | none |
| founder's own bees (this box, `%APPDATA%\xyz.block.buzz.app\agents\*`) | `wss://skaists.buzz` in agent configs | **affected today without VPN** | after DNS: switch agent relay env to `wss://relay.skaists.dev` (one-paste, same lane H pattern) |

**Recommended order:** DNS gesture → verify both fallback hostnames live → flip founder-side agent configs to the fallback → schedule the media-base dual-home for the next relay maintenance window.

## CLOSURE — 2026-08-29, all green

**DNS landed (founder):** `relay` + `relay2` A records live at Namecheap. Certs issued within seconds of propagation (Let's Encrypt, renewal window armed).

**One fix the proof caught:** the fallback vhosts initially passed the client Host through — the relay 404'd the wss upgrade (it validates Host against BUZZ_DOMAIN; control experiment: primary 101, fallback 404, same process). Fixed caddy-side: `header_up Host <primary-domain>` per fallback block — pure hostname alias, zero relay changes.

**Verified from the FOUNDER'S FILTERED PATH** (the network that resets .buzz):
- `wss://relay.skaists.dev` → **101, then OPEN with NIP-42 AUTH challenge** (real WebSocket, real relay)
- `wss://relay2.skaists.dev` → same ✓
- NIP-11 identity on both ✓ · `/compute` → **401 bearer gate alive** ✓
- External nodes: Germany/Iran/Turkey 200 OK (relay) · Finland/India/US 200 OK (relay2)

**Real-path failover proof (no stubs):** on the filtered network, the probe cascaded primary (filter-killed) → fallback (answered), dot live, **join line switched to `wss://relay.skaists.dev`** — shot: `e2e/shots-wiring/failover-REAL-390.png`.

**Follow-ons landed same night:**
- **Media dual-home:** `BUZZ_MEDIA_BASE_URL`/`BUZZ_MEDIA_SERVER_DOMAIN` → fallback names on both hives; `BUZZ_CORS_ORIGINS` += fallback + `https://skaists.dev` (estate pages can now speak to their own relay). Both relay containers recreated (env backups: `.env.bak-20260829-dualhome`); the bn recreate needed its compose file pair explicit (`-f compose.yml -f compose.bn.yml`) — the bare up grabbed the wrong port map and was corrected; both `healthy` post-recreate.
- **Founder's bees:** `managed-agents.json` backed up (`*.bak-20260829-dualhome`), 3 relay URLs switched to `wss://relay.skaists.dev`; JSON re-validated. Bees reconnect on the app's next cycle/restart.

**Fence note:** the desktop app on this box still needs its own restart (or next reconnect cycle) to ride the fallback; the brand `skaists.buzz` remains the primary everywhere a non-filtered network connects.
