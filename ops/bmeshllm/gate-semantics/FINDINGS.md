# bMESHLLM front-path semantics — the cancellation/backpressure/readiness map (2026-09-16)

Founder mission: "determine whether our own front path can prevent, detect,
or contain a wedged compute slot before it becomes provider-wide failure."
Mapped at source (`/opt/buzz-meter/gate.js` 70 lines,
`/opt/buzz-meter/meter.py` 815 lines — read verbatim), proven by the
off-production battery in this directory (`run-tests.sh` against a throwaway
gate copy on 127.0.0.1:8095 + mock upstreams; production gate and
llama-server untouched). Epistemic states per the concurrency protocol.

## The map — request → authorization → slot → cancellation → release → receipt

| stage | what the code does | verdict (evidence) |
|---|---|---|
| request → authorization | `gate.js` re-reads `keys.json` (600, on-box) per request; unknown/revoked → 401; paid with balance ≤ 0 → 402; free passes | FACT, proven T1 (keyless 401, upstream never touched) |
| authorization → generation slot | blind proxy to `172.18.0.1:8090` with the canonical key; **no upstream timeout, no concurrency cap, no queue bound**; streaming is a pure pipe | FACT, proven T3 |
| cancellation (client → upstream) | **none.** `req.pipe(up)` with no close/abort handler: a client disconnect does NOT destroy the upstream request — the gate swallows cancellation and the generation runs to completion for the departed client | FACT, proven T2 (upstream socket stayed open through and after client abort) |
| slot release | purely llama-server's business; the gate never observes `/slots`, has no readiness input at all | FACT, proven T4 (keyed `/health` = 200 proxied while `/slots` hangs — false-ready through the front path) |
| receipt / failure | `meter.py --watch` tails llama-server `print_timing`; a receipt is emitted ONLY when both prompt-eval and eval lines of a task appear; **aborted tasks print no timing group → no receipt, no failure record**; a wedged server's timing silence → nothing, forever | FACT, proven by unit test (completed task → 1 receipt; aborted task → 0) at `parse_stream` |

Operational corroboration (FACT, gate-access.log): through the entire
production wedge window (02:25–03:10Z) the gate logged **zero generation
requests** — only keyless `/health` 401 pairs from a monitor. The
interrupted clients that triggered the wedge were direct-connects, not
gate-fronted. Two consequences: (a) the gate's swallowed cancellation has
incidentally been shielding llama-server from the abort-race; (b) the front
path has never yet carried the traffic class that wedges the server.

Also noted: keyless `/health` through the gate dies at auth (401 before
upstream) — unauthenticated monitors can't see readiness through the front
door at all (the 4,357-line gate log is mostly those 401s).

## Answer to the mission question

**The current front path cannot prevent, detect, or contain a wedged slot.**
It can only authenticate. Prevention/detection/containment must be ADDED,
and the right home for each bound is named below.

## Where bounded execution/recovery belongs — PROPOSALs (design, not applied)

- **P-A — gate request bounds (containment).** Upstream response-header
  timeout (~60 s) + streaming idle timeout (~30 s between SSE chunks) → 504
  to the client and `up.destroy()` on breach; per-key concurrent-request cap
  (1–2) + small queue bound → 429/503 with Retry-After. Converts
  provider-wide indefinite hang into per-request failure. THE missing
  containment layer.
- **P-B — readiness admission (detection at the front).** Before proxying a
  generation endpoint, GET upstream `/slots` with ~200 ms budget (cached
  ~5 s; the probe law — never `/health`) → 503 when the server is wedged.
  This is "service alive ≠ resource available" made operational at the
  gate; optional keyless `/readiness` passthrough so monitors stop eating
  401s.
- **P-C — honest cancellation (interacts with the wedge trigger!).** On
  client disconnect before upstream completion: log verdict `aborted` and
  `up.destroy()`. Frees slots and gives the meter an abort record — but
  note the interaction: destroy DELIVERS the abort to llama-server, which is
  exactly the #27388 trigger class. Safe under plain decoding (12/12
  recovery receipt) and under MTP only behind the banked watchdog. Land P-C
  together with the watchdog, not before.
- **P-D — receipt/failure closure (meter).** Parse `stop: cancel task` +
  `slot release … stop processing: n_tokens = N` into PARTIAL receipts (the
  burned-token count is already printed); add a timing-silence detector
  (no print_timing while the gate logged requests → failure marker in
  state, surfaced by the daily SRE watch). Aborted and wedged work becomes
  accounted instead of invisible.
- **P-E — correlation hygiene.** Gate logs per-request duration + verdict
  (today it logs only the upstream status code); a request-id header ties
  gate entries to meter receipts.

Layer summary (DECISION SHAPE for review): request-level bounds = gate
(P-A/P-B); server-level recovery = the banked watchdog (staged in
`watchdog/PRODUCTION-WIRING.md`); accounting-level closure = meter (P-D).
Three layers, each named, none overlapping.

## Test evidence in this directory

- `run-tests.sh` + `mock-upstream.js` — the four-semantics battery;
  receipt in `gate-semantics-receipt.log`, socket lifecycles in
  `run/lifeA.log` / `run/lifeB.log`, throwaway gate copy in `run/gate-test.js`
  (patched from production source at run time — the production file was
  never modified).
- Meter abort-blindness: unit-executed `parse_stream` against regex-true
  fixture lines — completed task → 1 receipt, aborted task → 0 (script
  preserved in the receipt log's command history).

No production changes, no MTP re-enable — verified: the production gate
(172.18.0.1:8091), llama-server, and the buzz-compute override were never
touched (this battery ran entirely on 127.0.0.1:8095-8097).
