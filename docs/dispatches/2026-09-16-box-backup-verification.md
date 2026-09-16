# box-backup line-28 defect — verification + manual-path re-green receipt (2026-09-16)

Founder order (YELLOW, coordinate-first): fix the one-line quoting defect in
`/usr/local/sbin/box-backup.sh`, syntax-check, bounded manual verification
before tonight's run, preserve/verify the previous backup, touch nothing
unrelated. **No script edit was needed — the evidence below shows the defect
was already fixed in-window by the lane owner; this lane's work was
verification, preservation, and re-greening the failed manual path.**
Receipt for the SRE daily-watch finding (manual unit FAILED 02:30Z).

## What actually happened (timeline, read-only evidence)

- 02:02:12Z — `box-backup-manual.service` started (a manual verification
  run by the backup lane, which was reworking excludes 01:19–02:02).
- 02:29:43Z — `box-backup.sh` last written (script mtime). The lane owner's
  edit landed **while the old invocation was still executing**.
- 02:30:16Z — the running bash reached the OLD content's broken line 28:
  `unexpected EOF while looking for matching `` ` `` ` → unit FAILED
  (exit 2) after 28 min / 3.9G peak. Classic race: **bash executes the
  already-read buffer; a file fixed on disk does not heal the running
  process.** (Corollary of the lane's own "test what's closed" law.)
- 03:30:00Z — the nightly `box-backup.timer` fired the FIXED script:
  **success** in ~53 s, artifact `box-nightly-20260916.tar.gz` (415,878,074
  B, root-only 600) + all three pg dumps in `dbs/` (buzz-prod 818K,
  buzz-prod-bn 235K, invite-rotate-test 56K).

## Verification performed (GREEN, all read-only until the rerun)

- `bash -n` on the current script: **clean** (rc=0).
- Nightly artifact: `gzip -t` **OK**; bounded content listing sane
  (`home/ubuntu` dominates; excludes held — no models/node_modules/src;
  27 x0x identity+config entries; `etc/systemd`, `/root` secrets included).
- Previous backup **preserved aside** as
  `box-nightly-20260916.tar.gz.verified-0330` (suffix keeps it outside the
  rotation glob) before any write.
- **Bounded manual rerun** (the order's verification run): `systemctl start
  box-backup-manual.service` → **success / exit 0 in 115 s**; fresh artifact
  416,055,566 B; `gzip -t` OK. The unit's failed state cleared (system
  failed-units now 0). Timer armed for 2026-09-17 03:30 UTC.
- Disk: 5.1G free after the preserved copy (88→89% band, within bounds).

## Laws banked

1. **An edit racing a running bash fails the RUN, not the script** — a
   script fixed mid-execution still dies on the old broken line; judge the
   script by `bash -n` + a FRESH run, and judge runs by the content that was
   on disk when they started.
2. Preserve-with-a-suffix (`…tar.gz.verified-0330`) keeps evidence outside
   the rotation glob — verified copies never age out by accident.

## Posture

Backup system: healthy, tonight's 03:30 unthreatened, manual path re-proven
green. One lane note for the owner: only one nightly artifact exists in
`/var/backups/box/` (the earlier 1.5G-era files were rotated/cleaned during
the excludes rework) — rotation keep-3 will refill naturally; the preserved
verified copy rides beside it. SRE seat rolls back into its standing
observation mission.
