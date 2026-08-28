# AGENT TOOL LOOP — why the bees' buzz CLI tools returned empty (2026-08-28 ~21:30 UTC)
**Order:** trace the spiral; run one CLI by hand in the agent's context; fix ours / report theirs; taming settings; who rides the box.

## 1 · Where tools execute + the hand-run truth
- Tools are the `buzz` CLI (bundled at `C:\Users\travi\AppData\Local\Buzz\buzz.exe` on the founder's machine), launched by the agent harness's MCP layer. Spawn is **`env_clear()` + a narrow passthrough allowlist** (`crates/buzz-agent/src/mcp.rs`): the CLI sees only `BUZZ_RELAY_URL`, `BUZZ_PRIVATE_KEY`, `BUZZ_AUTH_TAG` (+ proxies/TLS/Windows temp) — the desktop's managed-agent runtime (`managed_agents/runtime.rs:531-532`) injects the relay URL and the agent's nsec, so a correctly-launched agent has everything it needs.
- **Hand-run, real stdout/stderr/exit captured** (not the rendered blank):
  - no relay env → default `http://localhost:3000` → prints `[]`, **exit 0** — silently empty
  - relay set, non-member key → `{"error":"auth_error","message":"relay error 403: relay_membership_required"}` on **stderr**, **empty stdout, exit 0**
  - auth-shape errors generally → stderr only, exit 0, stdout empty
- **The design fact that makes the spiral:** the CLI puts DATA on stdout and EVERYTHING WRONG on stderr, always exits 0 — and the tool wrapper feeds the model stdout only. Any failure (wrong relay, non-member, unreachable) reads to the model as "the tool worked and found nothing," so it investigates forever. That is **their design, not ours** — reported, not fixable from our side.
- **Which failure the founder's bees actually hit: the alias-collision era.** His agents are members with the correct injected URL (runtime.rs wiring above), but between ~19:0x and the 21:10 UTC fix, every CLI websocket round-robined onto hive-2's relay (the DNS collision fixed earlier tonight), where their keys are not members → 403 → stderr → empty stdout → spiral. **Since the 21:10 pin, his tool traffic returns real data:** relay log at 21:28 shows his desktop pubkey `d44163…` bridging `/query` with status 200 and result_count 1–3, live.
- One founder gesture remains: **restart the desktop app** so any agent pool holding a pre-fix websocket to the wrong relay reconnects clean.

## 2 · Taming paste for the welcome bees (exact fields, per agent's edit screen → Advanced)
```
Max rounds:    8      (numeric-max-rounds-input; 0 = unlimited, blank = inherit — the spiral inherits unlimited)
Effort:        medium (the effort select; max is what makes each empty result worth re-investigating)
Mode:          auto   (unchanged)
```
Nothing else changes. Eight rounds is a full tool-answer-tool-answer budget; medium effort stops the model from burning rounds interrogating silence.

## 3 · Who rides the box vs zai (the usage.log turns were real)
The turns in `/opt/buzz-compute/logs/usage.log` (tasks ~162–343, 20:05–20:44 UTC, 25–116 tokens each) were **the founder's hive bees on the box** — the default harness (OpenAI-compatible → https://skaists.buzz/compute/v1, qwen2.5-3b-instruct), confirmed by the same-window relay bridge traffic from his desktop pubkey. The one agent on Provider=zai glm-5.2 (effort=max, rounds inherit) is **BYO on his GLM subscription** — it never appears in our usage.log; its empty-tool spiral was the collision-era wire, and after the 21:10 fix + an app restart its tools return data too.
