# /slots watchdog — off-production build + battery receipt (2026-09-16)

Founder ruling executed: watchdog approved as bounded task, tested
off-production; MTP stays parked in production; upstream #27388 comment
DRAFTED, not posted. **Zero production changes** — proven below.

## Artifacts

- `ops/bmeshllm/watchdog/slots-watchdog.sh` — the watchdog: probes a
  `/slots`-class URL (never `/health`) with a hard curl timeout; on N
  consecutive failures sends SIGTERM, waits `--stop-grace`, escalates to
  SIGKILL, respawns via `--start-cmd`; `--max-restarts` bound makes a
  restart-loop impossible; every probe logged with timestamp + latency.
  `--no-supervise` mode maps onto `systemctl restart <unit>` for a future
  production decision (documented, NOT wired).
- `ops/bmeshllm/watchdog/battery.sh` — the three-tier battery (below);
  box-side run + evidence bundle `~/watchdog-test/watchdog-battery-evidence.tgz`
  (sha256 prefix 0c541934…, contains wd-tier*.log probe histories +
  battery-run.log + receipt + start scripts).
- `ops/bmeshllm/upstream-27388-draft.md` — the upstream comment, DRAFT ONLY.

## Battery results (box, 04:44–04:58Z, standalone :8091, loopback-only)

**TIER 1 — healthy path (real llama-server, plain decoding, production
config class): PASS.** No false-positive restart across 5+ probes at 5 s
interval; `/slots` 200 throughout (probe log: 200s at 0.5–1.5 ms); clean
SIGTERM shutdown of the healthy child.

**TIER 2 — synthetic hang (deterministic wedge signature): FULL PASS.** A
threaded server that answers `/health` instantly and never answers `/slots`
(while ignoring SIGTERM) — detection fired via `/slots` timeout within the
2-fail window; **SIGTERM-ignored → SIGKILL escalation exercised**; respawn
came up healthy; the complete detect→kill→recover cycle proven.

**TIER 3 — real wedge attempt (throwaway `--spec-type draft-mtp` instance):
WEDGE NOT REPRODUCED in the bounded window — recorded honestly.** Server up
with draft-mtp, warm-up answered, 6 interrupted clients mid-generation; the
llama-server log shows clean `stop: cancel task → slot release` on every
abort; post-abort signature `health=200 slots=200`. The original wedge
needed "use" over a longer horizon; 6 aborts is a small sample and no-load
CPU contention differs. Tier 2 remains the logic proof of the watchdog; the
real-wedge heal remains demonstrated-by-proxy (identical hang signature).

Helper bug banked: the battery's first `wait_port` (/dev/tcp-based)
false-failed "server never came up" twice while the watchdog probe log
proved the servers up at +17 s — committed battery now uses curl; the two
FAIL lines in the raw log are this artifact, not server behavior.

## Production integrity (before/after)

- `buzz-compute.service.d/bmeshllm.conf` sha256 identical before and after
  (3e365e40…cdcc83d) — **the MTP-parked override was never touched**.
- `buzz-compute` active throughout; production `/slots` 200 in 0.65 ms at
  the final check; :8091 torn down clean.

## Status

- Watchdog: **built, battery-passed off-production, NOT deployed** —
  production wiring (systemd timer + `--no-supervise` restart, plus
  `TimeoutStopSec=30`) is a YELLOW-class change awaiting coordination +
  founder word, per the addendum.
- MTP: parked, per ruling.
- Upstream: `upstream-27388-draft.md` ready; posting = founder word.
