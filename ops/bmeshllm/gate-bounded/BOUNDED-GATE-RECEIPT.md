# P-A + P-B implemented and battery-passed off-production (2026-09-16)

Founder mission executed: bounded gate requests/queues (P-A) + `/slots`
readiness admission (P-B), proven against the six required scenarios plus a
seventh (recovery). **P-C deliberately NOT implemented** — `up.destroy()` on
client disconnect would deliver aborts into llama-server (the #27388 trigger
class); it lands with the banked watchdog per the sequencing ruling
(contain → observe readiness → watchdog → cancellation). **No production
changes**: everything ran on 127.0.0.1:8095/8098; the production gate,
llama-server, and buzz-compute override untouched.

## Artifacts

- `gate-bounded.js` — the bounded gate (production auth semantics + the two
  bound layers). Config by env: `BOUND_HEADER_MS` (60 s default),
  `BOUND_IDLE_MS` (30 s), `BOUND_PERKEY` (1), `BOUND_QUEUE` (4),
  `READY_TTL_MS` (5 s), `READY_PROBE_MS` (200 ms). Verdict log carries
  duration + phase + queue-wait (P-E hygiene rides along). A keyless
  `/readiness` endpoint (the `/slots` probe, 200/503) ends the monitors-eat-
  401s era.
- `mock2.js` — four upstream modes: `normal`, `slowchunks`, `wedgeslots`
  (the #27388 signature), `headerhang` (slots fine, generation wedges).
- `run-bounded-tests.sh` — the battery (test bounds: 3 s header / 2 s idle /
  perkey 1 / queue 1 / readyTTL 2.5 s). Receipt: `bounded-receipt.log`;
  verdict log: `run/gate.log`; socket lifecycles: `run/life.log`.

## Battery — 7/7 PASS (2026-09-16 06:27–06:28Z)

| # | scenario | result |
|---|---|---|
| S1 | normal generation | full stream delivered; verdict `complete` |
| S2 | slow generation (3.5 s chunk gaps > 2 s idle bound) | stream CUT, no DONE; verdict `stream-idle-cut`; upstream stream destroyed |
| S3 | wedged `/slots` | generation refused **503 before proxying** (upstream never saw it); verdict `not-ready`; keyless `/readiness` = 503 |
| S4 | wedged generation (`/slots` fine, POST hangs) | **504 after 3,026 ms — was: infinite hold**; verdict `header-timeout` |
| S5 | queue saturation (perkey 1, queue 1) | third concurrent request **503 queue-full** — was: infinite queue |
| S6 | client timeout mid-stream | departure logged (`client-departed`); slot released — next request admitted at **ttfb 3.7 ms**; the departed client's generation was NOT destroyed upstream (P-C absence verified) |
| S7 | recovery after wedge clears | 503 during wedge → **200 after heal + cache expiry, no gate restart** |

## Bugs found and fixed during the battery (banked)

1. **Node flushes response headers lazily** — `writeHead()` sends nothing
   until the first `write()`; a mock that streamed its first chunk at 3.5 s
   hit the 3 s header-timeout instead of exercising the idle path. Fix:
   chunk 0 at connect. Applies to any future llm-server-facing test harness.
2. **destroy-before-respond race** — `up.destroy()` fires 'error'
   synchronously, so the 502 handler raced the 504 response (duplicated
   verdicts, double-release). Fix: settle-once guard + respond before
   destroy.
3. Test-side: admission latency must be measured as time-to-first-byte, not
   completion.

## Deployment posture

Same as the watchdog: **staged, not installed.** When the founder wires the
production gate, the shape is: copy `gate-bounded.js` beside
`/opt/buzz-meter/gate.js`, swap the unit's ExecStart, keep the old file as
rollback; bounds start generous (60 s header / 30 s idle / perkey 2 /
queue 8). Until then it lives here, proven.

Next roll per the mission: **P-D meter failure/partial-receipt semantics.**
