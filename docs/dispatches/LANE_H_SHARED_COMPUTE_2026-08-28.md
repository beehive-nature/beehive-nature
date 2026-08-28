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
