# Phase A executed — log-cause fixed, root 90%→80% (2026-09-16 ~17:45Z)

Founder-authorized (Phase A only; fence NOT resized, ANT NOT upgraded).
Follows the headroom plan `2026-09-16-ant-019-headroom-plan.md`.

## Evidence preserved before cleanup

- `/var/log/syslog` 2,222,949,800 B + `syslog.1` 1,855,335,593 B
  (uncompressed); `syslog.2.gz` 20.7M, `syslog.3.gz` 24.4M — the rotation
  config existed but lost the race.
- Spam measured: **2,749,230 `send_error` lines in syslog + 1,914,957 in
  syslog.1** — every one `x0xd … WARN ant_quic::send_error: send failed
  peer_id=PeerId([…])`, plus sibling `saorsa_gossip_presence: Timed out
  sending beacon` — the box's own QUIC retry churn against unreachable
  peers, at WARN under a global `log_level = "info"`.
- Root before: 45,130M total, 40,562M used, **4,552M free (90%)**.

## The cause fix (YELLOW, authorized)

`/etc/x0x/x0xd.toml`: `log_level = "info"` → **`"info,ant_quic=error"`**
(file backed up `.pre-phaseA.bak`; `--check` rc=0 before restart). The
target syntax is the crate's own env-target list (same directive the toml
already used for level). x0xd restarted; **same agent id**
(`1ca00a42…8df66367`), healthy, peers 20→26 within the window.

**Spam stopped, receipts:** restart settled at 17:44Z — last `send_error`
17:46:01 (residual in-flight retries), then **0 in the trailing 5-minute
window** (verified again after all reclaims). Rate context: 851
send_error/min at 17:4x pre-fix vs 0 post-fix.

## Reclaims executed (rollback = none needed for logs; config revert for the cause)

| action | result |
|---|---|
| logrotate refused first (`/var/log` is `root:syslog 775` — group-writable, the documented `su` fix needed): added `su root syslog` to `/etc/logrotate.d/rsyslog` (backed up `.pre-phaseA.bak`), forced rotation ×2 | 4.0G → **254M** compressed (`syslog.2.gz` 127M + `syslog.3.gz` 127M hold the two old giants; active syslog now 3.3K) |
| journal | already at **417M** (the earlier vacuum had done /var/log/journal; only /run reported) |
| `apt-get clean` | 150M → 28K |
| snap: removed disabled `snapd 27709` revision | ~90M |
| box scratch: `~/composite`, `~/watchdog-test`, `~/gate-*`, `~/meter-pd`, `~/composite-lane`, `/tmp/deploy-*`, `/tmp/*.b64` (all my own test artifacts; receipts live in the repo) | ~100M |

**Root after: 35,799M used, 9,315M free — 80%.** (+4,763M reclaimed.)

## Health after everything

All 12 seat services active · docker 14/14 · x0x healthy, 26 peers, v0.45.0,
same agent · bounded-compute stack green (watchdog `success`, `/slots` 200,
gate readiness 200) · box-backup untouched (tonight's 03:30 unaffected).

## Phase-B headroom — recomputed from the ACTUAL reclaimed state

- Root free: **9,315M**. Phase B (fence 5,960M → 13.5G) needs **+7,624M**
  on root → **post-B root free ≈ 1,691M** — above the 1.5G operating
  margin I set, but only just.
- Trigger stands: fence at 13.5G gives free-inside ≈ 8.4G ≥ live(≤5.0G) +
  2.5G floor (+margin). **Phase B is now AFFORDABLE and remains the next
  founder gate** (RED: node quiesced, ext4 online-grow).
- One refinement from this run: if Phase B is instead sized to **12.5G**
  (+6.5G on root → post-B root free ≈ 2.8G), it still satisfies the
  worst-case rule (free-inside ≈ 7.4G ≥ 7.5G… marginal) — recommend the
  13.5G size; the extra 1G of root margin costs comfort, and Phase C
  (payload measurement) can right-size Phase D's shrink either way.

## Standing

- The x0xd `ant_quic=error` level holds until the next x0x upgrade
  rewrites the toml — the runbook note stands: re-apply after any x0xd
  binary swap (the upgrade runbook already preserves config; verify the
  line survives).
- Daily watch: the root-disk ≥90% alert now has headroom; the syslog-spam
  tripwire (`send_error` count in trailing window) is worth adding to the
  morning line as a regression check.
