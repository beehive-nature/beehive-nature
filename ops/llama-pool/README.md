# ops/llama-pool — the interchangeable-agent model pool (Phase 1)

**Status: AUTHORED, NOT DEPLOYED.** Founder applies on the boxes; per
ops/ verbatim law the on-box state and this tree must land together.

## Shape

One OpenAI-compatible door, many interchangeable members behind it:

- `llama-server.nix` — one llama.cpp member as a NixOS service:
  mesh-only bind, restart-on-failure, hardened, capped. No secrets.
- `hostinger.nix` — Hostinger member + the Caddy door: health checks
  on `/health` (10s), failover across healthy members, pool-key Bearer
  required (`{$POOL_KEY}` from `/var/lib/llama-pool/door.env`, root
  0600, created on the box — never in this repo).
- `oracle.nix` — Oracle member unit (Phase 2 joins the door's
  upstreams; the unit ships now so both changes stay verbatim).
- `Caddyfile.pool.snippet` — the same door block for a non-Nix Caddy.

A Buzz managed agent (harness: Buzz Agent, provider
OpenAI-compatible) points at the door with the pool key in env. Kill
any member mid-task and the door fails over; the agent's DID and task
state never lived on the member.

## Deploy-time facts to fill (marked DEPLOY-TIME in the files)

- Each member's mesh address (`ORACLE_MESH_ADDR` in the door block).
- The door hostname (`llm.door` placeholder).
- llama-server binary + GGUF staged under `/var/lib/llama-pool/`
  (Hostinger references the staged Qwen3.5-4B from ops/bmeshllm).
- `/var/lib/llama-pool/door.env` with `POOL_KEY=...` on Hostinger.

## Validation (run from WSL Nix on the build box)

```
nix-instantiate --parse ops/llama-pool/*.nix
nix-instantiate --eval --strict \
  -E '(import <nixpkgs/nixos/lib/eval-config.nix> {
        modules = [ /path/to/ops/llama-pool/hostinger.nix ]; })
      .config.systemd.services."llama-server-hostinger".serviceConfig.Restart'
```

Receipts for this lane go in the Phase 1 dispatch / WORK_LOGS.
