# Watchdog production wiring — STAGED, NOT INSTALLED

Per founder ruling 2026-09-16: the watchdog stays banked, not wired, until
the production rail demonstrates the underlying hang again or MTP approaches
re-entry. This file is the complete one-paste deployment for that day — a
YELLOW-class change (systemd edit + service restart behavior): coordinate
with affected seats, then founder word, then paste.

## The pieces

1. **Unit drop-in** — hardens the SIGTERM-ignore case observed in the wild
   (90 s default → 30 s to SIGKILL):

```
# /etc/systemd/system/buzz-compute.service.d/watchdog.conf
[Service]
TimeoutStopSec=30
```

2. **The watchdog** — copy `ops/bmeshllm/watchdog/slots-watchdog.sh` to
   `/opt/buzz-compute/watchdog/slots-watchdog.sh` (mode 755). It runs
   `--no-supervise`: detection restarts the systemd unit; systemd owns the
   process lifecycle.

3. **Timer** — probe every 60 s, 2 consecutive failures restart:

```
# /etc/systemd/system/buzz-compute-watchdog.service
[Unit]
Description=/slots liveness watchdog for buzz-compute (the wedge keeps /health green)
After=buzz-compute.service

[Service]
Type=oneshot
ExecStart=/opt/buzz-compute/watchdog/slots-watchdog.sh \
  --url http://172.18.0.1:8090/slots --timeout 3 --interval 1 --max-fails 2 \
  --stop-grace 0 --no-supervise \
  --start-cmd "sudo systemctl restart buzz-compute" \
  --log /var/log/buzz-compute-watchdog.log
```

> NOTE: in `--no-supervise` mode the script probes `--interval × --max-fails`
> per invocation and exits; the unit above makes ONE probe-burst per timer
> tick with `--interval 1` (two probes 1 s apart). A wedge is confirmed only
> when both time out — matching the battery's 2-consecutive-fail law while
> keeping each oneshot run short.

```
# /etc/systemd/system/buzz-compute-watchdog.timer
[Unit]
Description=Probe buzz-compute /slots liveness every 60s

[Timer]
OnCalendar=*-*-* *:*:00
Persistent=false

[Install]
WantedBy=timers.target
```

4. **Install + verify** (the day it is approved):

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now buzz-compute-watchdog.timer
systemctl list-timers buzz-compute-watchdog.timer        # next tick visible
curl -s -m 3 http://172.18.0.1:8090/slots -o /dev/null   # healthy: instant
sudo journalctl -u buzz-compute-watchdog.service -n 5    # probe receipts
```

## Rollback

`sudo systemctl disable --now buzz-compute-watchdog.timer` + remove the two
unit files + the drop-in + `daemon-reload`. The watchdog never modifies the
llama-server unit itself; with the timer off it is inert.

## Evidence base

- Battery receipt: `ops/bmeshllm/WATCHDOG-TEST-RECEIPT.md` (tier-2 full
  detect→kill→recover cycle; tier-1 no-false-positives).
- Soak receipt (real-wedge reproduction attempt under concurrent load):
  `soak-receipt-*.log` in `~/watchdog-test/` on the box, mirrored with this
  lane's commits.
- Probe law: `/slots`, never `/health` — upstream #27388's mutex analysis,
  corroborated by our SIGKILL journal receipt (posted upstream as
  issuecomment-5692308653).

---

## AS DEPLOYED (2026-09-16 ~10:55Z) — see DEPLOYMENT-2026-09-16.md

This file's original staging is superseded by the live deployment: gate
drop-in + oneshot timer + meter-pd service, acceptance 13/13. Two pre-flight
fixes changed the shape from this staging: the watchdog probes WITH
`--auth-file` (production /slots 401s unauthenticated) and `--no-supervise`
is a single bounded burst per timer tick. Rollback one-paste lives in the
deployment receipt.
