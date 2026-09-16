# DEPLOYED — the bounded-compute lifecycle is live (2026-09-16 ~10:55Z)

Founder-approved coordinated YELLOW change, executed per the staged plan.
**Acceptance battery: 13/13 PASS.** P-C cancellation propagation: disabled.
MTP: parked (the buzz-compute override is hash-unchanged, `3e365e40…`).

## What is running now

| component | shape |
|---|---|
| **bounded gate** | `buzz-meter-gate.service` → `/opt/buzz-meter/gate-bounded.js` via drop-in `bounded.conf` (original unit backed up `.pre-bounded.20260916T105500Z.bak`; `gate.js` untouched beside it = rollback target). Bounds: header 60 s, idle 30 s, per-key 2, queue 8, readiness TTL 5 s / probe 200 ms. Keyless `/readiness` live. |
| **watchdog** | `buzz-compute-watchdog.timer` (every minute) → oneshot `--no-supervise` burst: 2 authenticated `/slots` probes (1 s apart, `--auth-file`, root-run); healthy → exit 0; both fail → `systemctl restart buzz-compute` once + exit 1. Log: `/opt/buzz-compute/watchdog/watchdog.log`. Plus `buzz-compute.service.d/watchdog.conf`: `TimeoutStopSec=30` (the SIGTERM-ignore window cut from 90 s). |
| **four-state accounting** | `buzz-meter-pd.service` → `meter-pd.py --watch`, `PD_ROOT=/opt/buzz-meter-pd`, tails the real `usage.log` + gate access log, `WEDGE_SILENCE_S=120` (production default; the evidence-derived derivation lives in `sweep-bound-evidence.py`). The production `buzz-meter.service` continues untouched — its chain remains the billing system of record; meter-pd's mirrors are delivery-observation mechanics. |

## Acceptance (13/13, receipt in the dispatch)

readiness keyless 200 · keyless API still 401 (auth first) · temp key minted ·
real completion through the bounded gate · client-departed verdict logged
(P-C off — no upstream destroy) · TimeoutStopSec=30 live · watchdog probe
200 + clean oneshot exit · meter-pd four-state stream carries COMPLETE ·
**INVARIANT: meter-pd receipts(66) == COMPLETE states(66), zero billable
shapes outside the payment chain** · MTP-parked override unchanged ·
buzz-compute active throughout (no restart).

The 66-for-66 deserves note: meter-pd started at offset zero and backfilled
the ENTIRE historical production log — every past completion across every
past boot, exactly once each, zero duplicates, zero billable outside. The
write-once epoch-qualified ledger ran a production-scale replay test as its
first act, unprompted.

## Pre-flight catches that changed the deployment (both fixed + verified first)

1. **`/slots` 401s unauthenticated in production** — the staged watchdog
   probed without credentials and would have restart-looped a HEALTHY
   server. Fix: `--auth-file` (root-run service reads the key; never
   logged). Verified read-only against the live rail as root: 200 in 0.67 ms.
2. **`--no-supervise` was not a bounded burst** — a oneshot that loops
   forever would have re-triggered the restart during the reload window.
   Fix: one probe cycle per invocation, start-cmd once, exit.

Permission law en route: the key file is root-only — an ubuntu-user watchdog
cannot authenticate (first verification 401'd for exactly this reason).

## Rollback (one paste, staged)

```bash
sudo rm /etc/systemd/system/buzz-meter-gate.service.d/bounded.conf
sudo systemctl disable --now buzz-compute-watchdog.timer buzz-meter-pd.service
sudo rm /etc/systemd/system/buzz-compute-watchdog.{service,timer} /etc/systemd/system/buzz-meter-pd.service /etc/systemd/system/buzz-compute.service.d/watchdog.conf
sudo systemctl daemon-reload && sudo systemctl restart buzz-meter-gate
# gate.js was never modified; buzz-compute was never touched
```

## Observation posture

The daily 09:15 SRE watch now carries the deployed stack: timer result +
last probe line, meter-pd liveness + ledger parse, the `/slots` wedge check
(with heal-verification via the watchdog journal on any fire), and gate
`/readiness`. A real wedge event now self-heals within ~60 s and leaves an
`UNKNOWN/WEDGED` record in `/opt/buzz-meter-pd/state.jsonl` — the failure is
not only survived but accounted.
