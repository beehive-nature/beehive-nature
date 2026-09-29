# Hardening rider — buzz-hostinger container users (2026-09-28)

Dated rider beside the migration kit. **The 2026-09-24 record files are
untouched**: `Dockerfile.{relay,storage,caddy}`, `compose.*.yml`,
`MIGRATION.md` stay byte-faithful. Everything here is NEW files and a
gated runbook for the next maintenance window.

## Findings and their runtime truth

Third-party scan (Aikido, PR #243): "default root user" MEDIUM ×3 on the
kit's Dockerfiles. Live read-only inspection 2026-09-28 (host
`buzz-hostinger`, methods: `docker inspect .Config.User`, deployed-compose
`user:` grep — none, effective uid from `/proc/<pid>/status`):

| container | image | config-user | effective uid | disposition |
|---|---|---|---|---|
| buzz-prod-caddy-1 | caddy:2-rl | empty | **0** | CONFIRMED live root |
| buzz-prod-minio-1 | buzz-storage:2025-09-07 | empty | **0** | CONFIRMED live root |
| buzz-prod-relay-1 | buzz-relay:skaists-088a677f | buzz:buzz | **1000** | REFUTED — base sets USER; inherited |
| postgres / redis | official | — | 70 / 999 | non-root, out of scope |

A Dockerfile's missing `USER` shows the configured default, not the live
process; the inspection is what sorts applicable from inherited-safe.

## Tested remedy (receipts in the 2026-09-28 dispatch)

- `Dockerfile.storage.nonroot` — same pinned sources as the record, plus
  dedicated uid/gid 9000 and data-dir ownership. Thin equivalent (built
  `FROM buzz-storage:2025-09-07` + user + chown) proven on the host staging
  fence: uid 9000, `/minio/health/ready` 200, object written and read back
  byte-identical after `restart`, fresh named volume.
- `Dockerfile.caddy.nonroot` — base image already carries
  `cap_net_bind_service=+ep`; the missing piece is `USER 1000:1000` plus
  `/data` `/config` ownership. Thin equivalent proven: serves :8080 as uid
  1000 and **binds privileged :80** (host port 81) — the capability path
  works unprivileged.
- Relay: no change needed or made.

## Production migration runbook (GATED — founder go required)

1. Window: stop caddy, then minio (stop order matters — see the re-review's
   MinIO-stop finding; also stop the relay's use of MinIO via compose
   `depends_on` if chained).
2. Chown existing volumes ONCE (root can do this from a throwaway container):
   `docker run --rm -v <vol>:/v alpine chown -R 9000:9000 /v` for the MinIO
   data volume (discover: `docker volume ls | grep -i minio`), and
   `chown -R 1000:1000` for `buzz-caddy-data` + `buzz-caddy-config`.
   Note `./certs:/certs:ro` and the `/srv/*:ro` binds must stay readable
   by uid 1000 — verify with `namei -l` before the swap.
3. Rebuild from the `.nonroot` Dockerfiles (same pins), retag or repoint
   `compose.hostinger.yml` image refs (as a NEW compose override file —
   the record compose stays as-is), `up -d`.
4. Verify: minio `/minio/health/ready` 200, caddy serves, `skaists.buzz/info`
   200, `relay.skaists.dev/info` 200, one signed upload/download path.
5. **Rollback** = revert the image refs and restart. No re-chown needed:
   root-usered images read uid-owned files fine; the ownership change is
   backward-compatible by construction.

## Not claimed

Nothing was deployed. Production was only read (inspect, /proc, compose
grep, GET /info). All testing happened in the `hard` compose project on
127.0.0.1-bound ports with throwaway creds, fully torn down and shredded
after (receipt in the dispatch). The five operational script findings from
the independent re-review are tracked separately and are NOT resolved by
this rider.
