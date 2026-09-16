# ops/bmeshllm — the mesh-served LLM door (staged 2026-09-15, NOT deployed)

**Status: PREP COMPLETE, deployment waits for founder sprint-go** (grant
2026-09-15: upgrades yes, no full sprint). This file is the one-command
runbook for that go.

## What already runs (found live 2026-09-15 — corrects the raid dispatch's
"door 404" flag)

The Lane-H compute rail is ALIVE as **systemd services, not containers**
(that is why `docker ps` showed nothing):

- `buzz-compute.service` — llama-server
  (`/opt/buzz-compute/src/build/bin/llama-server`) bound
  **172.18.0.1:8090** (docker bridge only), model
  `qwen2.5-3b-instruct-q4_k_m.gguf`, flags `--threads 3 --ctx-size 16384
  --parallel 1 --cont-batching --cache-type-k q8_0 --cache-type-v q8_0 -fa on`.
- `buzz-meter-gate.service` (Lane M P2 per-key bearer gate) + `buzz-meter.service`
  (receipts sidecar) in front of it; `buzz-compute-firewall.service` (bridge-only
  pin, inactive).
- The public `https://skaists.buzz/compute` 404 is real but shallow: the
  current Caddyfile carries **no compute route** — the rail is bridge-only
  today. Re-adding the route is a deployment step below (Caddyfile inode law
  applies: container restart after edit).

## The staged upgrade (on disk, service untouched)

`/opt/buzz-compute/models/Qwen3.5-4B-UD-Q4_K_XL-MTP.gguf` (2,990,664,000 B,
sha256 `d2bfbee4de17c74e…db6fccc` — `.sha256` beside it) from
`unsloth/Qwen3.5-4B-MTP-GGUF`: the 3.5 hybrid-attention line (262K ctx),
unsloth dynamic Q4_K_XL packing (the ≥95%-BF16-recovery agent tier per the
16GB-threshold raid laws), **MTP draft heads inside the file**.

Why it beats the current qwen2.5-3b: +hybrid linear attention (context
nearly free vs 16K dense), +MTP speculation, +dynamic-quant packing — same
CPU, same RAM class.

## Sprint-go runbook (in order)

1. **Binary check FIRST:** the llama-server build is from Aug 28 — MTP
   (`--spec-type draft-mtp` family) needs a current build. Run
   `/opt/buzz-compute/src/build/bin/llama-server --help | grep -i spec`;
   if absent, `git pull && rebuild` in `/opt/buzz-compute/src` (whisper.cpp
   tree is separate — do not touch).
2. Swap the model: edit `systemctl cat buzz-compute` ExecStart →
   `--model .../Qwen3.5-4B-UD-Q4_K_XL-MTP.gguf --alias qwen3.5-4b-mtp`,
   keep threads/cache flags; add the MTP/speculation flags per the --help of
   the (possibly rebuilt) binary; `--ctx-size` can rise (hybrid) — 32K is a
   safe first step on 16Gi available RAM.
3. `sudo systemctl daemon-reload && sudo systemctl restart buzz-compute` →
   smoke: bridge curl `/health` + one completion; meter-gate + meter stay.
4. Public door: re-add the `/compute` route in the buzz-prod-caddy
   Caddyfile → **container restart** (inode law) → 390px + desktop smoke.
5. Acceptance: token/s + prefill receipts vs the qwen2.5-3b baseline
   (5.7 s prefill is the number to beat); MTP acceptance rate from
   llama-server logs (author-reported 0.63–0.75 is the reference band).
   Rollback = point ExecStart back at the qwen2.5 model (keep it).

## Disk law (box is at 89% / 45G)

Staging cost ~3.0G (5.2G free now). After acceptance the old model (1.9G)
can go; `/var/log/journal` capped at 1G via vacuum policy; do NOT stage the
27B/Flash-Next tiers here — those wait on the $780 16GB GPU box per the raid.

## Future tiers (pinned, not staged)

- GPU sovereign tier: `ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF` (11.8 GB
  IQ3_S; multimodal, 262K ctx) — the 16GB-threshold article's build.
- MoE tier: `Qwen3.8-Flash-Next-GSQ-RCO` (qwen4exp arch) — repo-scale ~177G,
  GPU-class only.
- Weights-on-Autonomi (bMESHLLM/netWORK's storage leg): publish the chosen
  GGUF as a content-addressed archive — plan, unmeasured; ADR-0008 record
  pricing applies (~4 MiB per record, 3× upper-median quote).

## Attempt receipts (2026-09-16 00:38–01:05 UTC, founder "word" go)

Swap attempted per runbook; **rolled back clean** — rail served qwen2.5-3b
throughout the gap (~9 min), meter-gate + meter never dropped.

- Binary check (step 1 fear CONFIRMED): llama-server 0.3.0-dev @6fe7498
  (Aug 28) has speculative flags but CANNOT generate on the qwen35 hybrid
  arch — model LOADS (health 200, ~80 s with `-fa on` + q8_0 KV @ 16K→32K)
  but generation hangs (8-token request unfinished at 90 s; one earlier
  40-token call returned empty in 8.9 s).
- Variant without `-fa`/KV-quant at ctx 32K: fails to finish loading in
  200+ s (f16 KV pressure) — worse, not better.
- Rollback = delete `/etc/systemd/system/buzz-compute.service.d/bmeshllm.conf`
  + daemon-reload + restart: health 200, 30-token smoke in 5.5 s, meters active.
- **Cure in flight:** llama.cpp rebuilt at tag `b10991` into
  `/opt/buzz-compute/src/build-new/` (log `/tmp/llama-build.log`, BUILD_OK/
  BUILD_FAIL marker). Swap procedure once OK: standalone smoke on :8091 with
  the staged model + the NEW binary, then the unit override points at
  `build-new/bin/llama-server` — never overwrite the known-good `build/`.

## SWAP COMPLETE (2026-09-16 ~02:30 UTC)

- llama.cpp REBUILT: tag b10991 → `build-new/bin/llama-server`
  **0.4.1-dev @930e2fa** — the running binary was 0.3.0-dev (a whole major
  behind; that was the generation-hang root cause). `--spec-type` menu now
  includes **draft-mtp**.
- Standalone smoke (:8091): loads in ~40 s, prompt eval 16.5 tok/s,
  **eval 5.49 tok/s** on 3 threads.
- PRODUCTION SWAPPED via drop-in override (rollback = delete
  `/etc/systemd/system/buzz-compute.service.d/bmeshllm.conf` + daemon-reload
  + restart): build-new binary + Qwen3.5-4B-UD-Q4_K_XL-MTP + `--spec-type
  draft-mtp`. Health 200, meter-gate + meter active.
- **Consumer law — this is a REASONING model:** short `max_tokens` return
  empty `content` with the tokens in `reasoning_content`. Direct answers:
  send `"chat_template_kwargs":{"enable_thinking":false}` (verified live:
  16-token clean answer). Agents that want thinking just raise max_tokens.
- Timing receipts are CPU-contended (backup tar concurrent); re-measure on
  an idle box for the acceptance table.

## MTP PARKED (2026-09-16 ~03:10 UTC) — stability ruling

With `--spec-type draft-mtp` the rail developed a **slot wedge under use**:
first requests fine (~1.6 s), then a wedged slot queues everything forever
(health stays 200 — completions hang). Trigger correlated with interrupted
clients mid-generation. MTP flag REMOVED from the override; production now
runs the new binary + model with plain decoding (`-fa on`, q8 KV, 5.49 tok/s
eval class from the smoke receipt). **Stability battery after removal: 12/12
answered, including recovery from a deliberately aborted 400-token
generation.** MTP returns only behind a watchdog or an upstream fix.
GOTCHA banked: `pgrep -af <pattern>` matches the ssh session's own command
line — verify flags from unit FILES, never from pgrep through ssh.
