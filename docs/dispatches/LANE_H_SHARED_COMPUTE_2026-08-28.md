# LANE H — THE ESTATE'S FIRST SHARED-COMPUTE NODE (Oracle box, 129.153.202.144)
**Date:** 2026-08-28. **Seat:** zCode. **Standard:** the founder's Buzz agents answer from OUR box via "another provider"; Buzz's hosted shared compute is never wired.

## H1 · TRUTH FIRST — what the Provider dropdown accepts (v0.5.20, read in-tree at ~/buzz-src)
Enumerated from `desktop/src/features/agents/ui/agentConfigOptions.tsx` (PERSONA_LLM_PROVIDER_OPTIONS) and `crates/buzz-agent/src/config.rs`:
**anthropic · openai · openai-compat ("OpenAI-compatible") · openrouter · relay-mesh ("Buzz shared compute") · databricks · databricks_v2.**

`openai-compat` is the custom-endpoint lane and its exact shape is:
- `OPENAI_COMPAT_API_KEY` — the bearer key (surfaced in the env editor as "OpenAI-compatible Runtime API Key"; **required**)
- `OPENAI_COMPAT_BASE_URL` — routes to `{base_url}/chat/completions` with `Authorization: Bearer` (default `https://api.openai.com/v1`)
- `OPENAI_COMPAT_MODEL` — the model name
- `OPENAI_COMPAT_API` (`auto|chat|responses`) — optional; `auto` picks Chat Completions for non-openai.com bases, so it need not be set
- Buzz sends `stream: false` (verified in `llm.rs`) — it consumes batched completions; our endpoint keeps streaming enabled anyway (proven below)

**v0.5.20 CAN take a custom provider. No STOP fired. The `relay-mesh` (their hosted shared compute) was never wired.**

## H2 · the box
4-core aarch64 (ARM Ampere), 24 GB RAM (22.7 available), 37 GB disk free, load 0.03. Two buzz stacks behind dockerized Caddy (buzz-prod + buzz-prod-bn, SNI-routed). Doors: **skaists.buzz 200**; beehivenature.buzz DNS still parked at the registrar (192.64.119.240) — pre-existing state, its on-box stack (relay-bn) is docker-healthy; the live gate is skaists.buzz NIP-11 + relay readiness.

## H3–H4 · the node (what runs, where the fences are)
- **llama.cpp `llama-server` v0.3.0 tag, built from source on-box (aarch64, Release, -j4).** One model: **Qwen2.5-3B-Instruct Q4_K_M** (1.93 GB, bartowski GGUF).
- **Systemd `buzz-compute.service`:** binds **172.18.0.1:8090 only** (the docker bridge — never 0.0.0.0; port 8090 unreachable from outside, verified 000). **HARD CAPS: CPUQuota=300% (one of four cores always free), MemoryMax=4G / MemoryHigh=3G, Nice=10, CPUWeight=40, IO best-effort 7.** (2-thread caps measured first; raised to 3 after the door proved immovable — both readings below.)
- **Auth: llama-server's own `--api-key`** — 401 without the bearer, verified through the public URL. Key generated on-box (`openssl rand -hex 24`), `/etc/buzz-compute/api.key`, **root:root 600**.
- **Exposure: the existing skaists.buzz Caddy only** — `handle_path /compute/* → 172.18.0.1:8090`, no new ports, no new DNS. Caddyfile backup `Caddyfile.pre-lane-h` beside it; the compose mounts the file so re-deploys preserve the route.
- **Firewall:** one bridge-only accept (`-s 172.16.0.0/12 --dport 8090`), persisted via `buzz-compute-firewall.service` (idempotent iptables pin). Oracle's hardened catch-all reject stays otherwise untouched.
- **Usage log (plain file):** `/opt/buzz-compute/logs/usage.log` — every request carries prompt/decode timings and token counts. The b-metering sidecar comes later per the bMeshLLM ruling; the founder's kind-44200 archive is the client-side meter already.

## H5 · MEASURED (no adjectives)
Model: qwen2.5-3b-instruct (Q4_K_M), 3 threads (caps at 300%):

| measurement | value |
|---|---|
| decode, short prompt | 11.9–12.5 tok/s |
| decode, 4 concurrent requests | 12.0–12.5 tok/s aggregate (one slot, serialized) |
| prefill | ~28 tok/s (923 tok in 32.7 s) |
| same at 2-thread caps (recorded) | decode 8.3–8.5, prefill 19–20 tok/s |
| streaming through public Caddy | SSE live (16–17 data frames on a 24-token stream) |
| skaists.buzz door latency, idle | 37.3–38.5 ms |
| skaists.buzz door latency, under 4-way compute load | 38.3–41.2 ms |
| direct port 8090 from outside | unreachable |

The door did not move under load at either cap level; the tighter caps stay on record if they're ever needed.

## H6 · FOUNDER PASTE-IN (Agents screen → provider "OpenAI-compatible", env vars)
```
Provider:             OpenAI-compatible
OPENAI_COMPAT_BASE_URL: https://skaists.buzz/compute/v1
OPENAI_COMPAT_API_KEY:  <delivered to the founder directly — never committed; on-box at /etc/buzz-compute/api.key, root 600>
OPENAI_COMPAT_MODEL:    qwen2.5-3b-instruct
```
Nothing to figure out: paste the three env values in the agent's env editor (the key row appears when the provider is chosen), pick any model alias shown in the model dropdown — it lists `qwen2.5-3b-instruct` live from the box.

## Receipt state
**Awaiting the founder's screen:** an agent in his hive answering a message through this endpoint. Everything up to his paste is measured and green. Fences held: bLOVErAi durable path NOT on this node; no hosted provider wired anywhere; Buzz's own relay-mesh shared compute untouched.

## FOLLOW-UP (2026-08-28 PM) — founder reports desktop "isn't connecting" + Compute screen "mesh-llm feature not enabled"

### 1 · The wire bug — FOUND and FIXED: Caddy was rewriting the upstream Host
Symptom: door 200, NIP-11 200, /api/join-policy 200 — but the real WebSocket handshake at wss://skaists.buzz returned **404 "relay: no community is configured for this host"** (the relay's fail-closed row-zero tenant binding — by design — rejecting the Host Caddy sent upstream, which was the dial address `relay:3000`, not `skaists.buzz`).
**Fix:** `header_up Host {host}` added to both relay proxies in the Caddyfile (skaists.buzz + beehivenature.buzz blocks; backup `.pre-lane-h` predates all Lane H edits). One reload initially never applied (a failed `caddy fmt` broke the `&&` chain — read-back caught it); after the true reload:
- **wss://skaists.buzz handshake = HTTP/1.1 101 Switching Protocols** (real upgrade, verified externally)
- door 200 · NIP-11 200 · join-policy 200 · /compute 401-without-key — no regressions
- direct-to-relay with Host: skaists.buzz = 101 (relay itself was never wrong; lane G's blind verify had tested that path, missing the Caddy hop)
- beehivenature.buzz: same fix applied to its block; externally untestable until its DNS leaves the registrar parking spot (its ACME is failing against the parked IP — pre-existing)
- the /compute route addition does NOT shadow the root/WS/NIP-11 matchers (all four verified green side by side)
The founder's desktop should now connect: his invite-claim and /query bridge traffic were already reaching the relay (logged, pubkey d44163…); only the WS was dead.

### 2 · mesh-llm — SCOPING ONLY (nothing applied, per order)
**The Compute screen error is a COMPILE-TIME property of the desktop binary, not config.** `desktop/src-tauri/Cargo.toml` defines `mesh-llm` as an optional cargo feature (OFF by default; pulls `iroh` + the Mesh-LLM v0.75.1 crates sdk/host-runtime/client/node/system/events). Without it, `#[cfg(not(feature = "mesh-llm"))]` compiles in `mesh_llm_stubs.rs`, whose every command returns exactly `"mesh-llm feature not enabled"`. The full module IS in-tree (coordinator/discovery/identity/usage/recovery) — gated, not absent.
**To enable:** build the desktop from this tree with `--features mesh-llm` (Rust, the Mesh-LLM git deps at tag v0.75.1). No runtime flag exists; no official release binary carries it as shipped to us.
**What it would talk to:** discovery rides plain nostr status notes (kind = MESH_STATUS_KIND) + the NIP-43 membership roster — our relay 0.2.1 already serves both (NIP-43 is in its supported_nips); member-to-member serving is p2p (iroh). No relay change needed for the founder's member-machine-sharing vision. NOTE: the relay's own `BUZZ_MESH=on` env is a DIFFERENT mesh (inter-relay transport, runtime-opt-in) — untouched.
**Awaiting founder word before any build** — enabling changes what member machines offer each other.

## LIVE WIRE PROBE (2026-08-28 ~21:10 UTC) — founder reports "Can't reach the relay"
**Verdict: wire BROKEN (flapping) on skaists.buzz → found + fixed → wire GOOD (10/10 × 101). beehivenature.buzz: wire GOOD throughout (5/5 × 101) — its DNS landed on the box this evening and its ACME issued.**
Root cause (the flap was the tell: 101/404 alternating on repeated handshakes, direct-to-relay flapping too, Caddy and DB exonerated): **DNS alias collision on the shared docker network.** `buzz-prod-bn-relay-1` (hive #2, joined `buzz-prod_buzz-net` so Caddy can reach `relay-bn`) carries its compose service name `relay` as a network alias — so `relay` resolves to TWO containers (172.18.0.5 prod + 172.18.0.7 bn). Caddy round-robined skaists.buzz traffic between them; the bn relay's DB has no skaists community → the fail-closed "no community" 404 on every other connection. The founder's desktop reconnect loop made it look like a hard outage.
**Fix:** both Caddyfile relay proxies pinned to unambiguous container names (`buzz-prod-relay-1:3000`, `buzz-prod-bn-relay-1:3000`), caddy reload only — zero door downtime. Post-fix: skaists 10/10 × 101, beehivenature 5/5 × 101, door/NIP-11/compute all green. The 7 "error" log lines in the window were NIP-42 auth-timeout closes of my own unauthenticated test sockets — normal, not DB faults.
**Durable follow-up noted for the relay lane:** give each relay a distinct explicit network alias in compose (e.g. `relay-prod`) instead of relying on container names, so a future stack rejoin can't re-collide.
