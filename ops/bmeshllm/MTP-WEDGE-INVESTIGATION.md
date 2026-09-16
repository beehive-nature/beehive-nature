# bMESHLLM MTP wedge — offline investigation + upstream mapping (2026-09-16)

SRE seat, founder order: "investigate the bMESHLLM MTP wedge
offline/read-only and find whether there is an upstream fix/watchdog
approach. No production changes." Every action this investigation took was
read-only on the box (journal reads, `--help` parse, one GET `/slots`) and
read-only upstream (issue search). **Nothing was changed anywhere.**

Epistemic states per `docs/agents/CONCURRENCY-PROTOCOL.md`.

## FACT — our wedge, with the new hard evidence

From `ops/bmeshllm/README.md` (@b20d4477 stability ruling): with
`--spec-type draft-mtp` the rail developed a slot wedge under use — first
requests fine (~1.6 s), then a wedged slot queues everything forever while
`/health` stays 200; trigger correlated with interrupted clients
mid-generation; after flag removal, 12/12 stability battery including
recovery from a deliberately aborted 400-token generation.

New evidence (this investigation, systemd journal, read-only):

```
Sep 16 02:48:44 systemd: Stopping buzz-compute.service…
Sep 16 02:50:14 systemd: buzz-compute.service: State 'stop-sigterm' timed out. Killing.
Sep 16 02:50:14 systemd: Killing process … (llama-server) with signal SIGKILL.
```

- The wedged process **ignored SIGTERM for the full 90 s default and died by
  SIGKILL** — a server-level hang (task/decode loop), not mere slot
  bookkeeping.
- Our build (`build-new`, 0.4.1-dev @930e2fa, tag b10991) `--help` exposes
  **no `--timeout` / `--watchdog` / generation-deadline knob at all** — there
  is no in-server watchdog to enable.
- Live rail probe target validated: GET `/slots` answers **200 in 0.65 ms**
  when healthy (plain decoding, post-park).

## FACT — upstream mapping (ggml-org/llama.cpp, read 2026-09-16)

- **#27388 [OPEN, 2026-08-19, zero comments, no linked PR]** — "Server
  wedge: generation stalls mid-decode; /health OK but /slots hangs; needs
  SIGKILL." Our exact signature, including the SIGTERM-ignore case.
  Reporter's own analysis: `/health` answering while `/slots` hangs implies
  the slots endpoint blocks on a mutex held by the stuck decode path —
  **liveness must be probed on `/slots`, not `/health`**. Incidents with AND
  without MTP (B: `--spec-type draft-mtp --spec-draft-n-max 3`, Qwen3.8-27B,
  `--parallel 2`); GPU backend, long-running load.
- **#27604 [OPEN, 2026-08-23]** — "server-wide hang after client aborts a
  streaming request while another request is in flight"; `/health` keeps
  answering; independently corroborated by a second reporter (OpenCode
  `AbortError` after 29 m, b10644). Titled Vulkan, but the abort→hang path
  is server task handling, backend-agnostic.
- **No fix shipped**: latest release **v0.4.1 (2026-09-14)** — our build is
  that generation; master since the release carries no server task-loop fix
  (only an OpenCL MoE matmul pick + a models graph-order tweak). No PR
  references #27388.

## INFERENCE

- Our wedge is an instance of the #27388/#27604 class: on client abort, a
  task-cancel/slot path leaves the decode loop holding state; `/health`
  never touches slots so it stays green; shutdown then blocks on the same
  stuck path.
- Upstream's without-MTP repro (GPU, long load) vs our MTP-correlated wedge
  (small sample, 12/12 clean without): reconciliation is that the underlying
  race exists regardless and **MTP draft processing widens the abort-race
  window** on our CPU single-slot config. Do not treat MTP as root cause;
  treat as amplifier. UNKNOWN until instrumented upstream.

## UNKNOWN

- Exact faulty path (abort callback vs speculative catch-up) — needs
  upstream instrumentation; both issues offer journals, no maintainer
  engagement yet.
- Whether `--spec-draft-n-max 1` narrows the window on our rail —
  unmeasured.
- Whether the class reproduces on other CPU/ARM64 builds — our box would be
  the first CPU data point on #27388.

## Watchdog approach — PROPOSAL (design only, NOT implemented)

1. **Probe law: liveness = GET `/slots` with a hard 2–3 s timeout, never
   `/health`.** Healthy receipt today: 0.65 ms. Wedged (per #27388's mutex
   analysis and our own hang): no answer. A generation probe also works but
   costs tokens and contended CPU; `/slots` is free and strictly better
   targeted.
2. **Detector**: systemd timer (or the buzz-meter sidecar, already
   request-adjacent) probing every 60 s; **2–3 consecutive failures** →
   `systemctl restart buzz-compute`. Restart cost receipt: ~40 s model load
   (standalone smoke) + an honest-failure window behind meter-gate.
3. **Unit hardening** (rides the same change): `TimeoutStopSec=30` — cuts the
   observed 90 s SIGTERM-ignore window roughly in thirds before SIGKILL.
4. **MTP re-entry** (per the stability ruling's own law — "returns only
   behind a watchdog or an upstream fix"): with (1)+(2) in place, draft-mtp
   becomes testably re-enterable: enable behind the watchdog, run the
   abort-battery, read the acceptance rate for the tok/s table; the watchdog
   converts the wedge from an outage into a ≤~1.5 min self-heal.
5. **Exposure reduction meanwhile**: clients avoid aborting mid-stream
   (bounded `n_predict`, let-finish policies) — mitigation, not a fix.

These are YELLOW-class changes (service restart behavior, systemd edit) —
coordination + founder word per the Buzz Box autonomy addendum. Nothing
above was applied.

## Flag for the founder (outward-facing, his word)

Posting our receipt to #27388 (first CPU/ARM64 data point: SIGTERM ignored
90 s → SIGKILL, single-slot CPU, MTP-correlated, plus the journal excerpt)
would strengthen the upstream case; comment posting works from this account
(reads verified). Not posted — external action.

## Bottom line

**No upstream fix exists today** (both matching issues open and unengaged;
v0.4.1 = our generation, nothing newer fixes it). **A watchdog is buildable
now** around the `/slots`-probe law, and it is the same instrument the
stability ruling named as MTP's re-entry condition. Until one of those
lands, MTP stays parked — correctly.
