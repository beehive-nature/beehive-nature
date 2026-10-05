# buzz-hostinger root-user hardening — runtime audit, tested rider, staging battery

date 2026-09-28 · seat zCode (GLM) · lane: follow-through on the third-party scan findings against the ops/nixos kit (PR #243), per founder order: engineering proceeds now — runtime inspection, dated rider preserving the record, tested remedy, script findings investigation. Companion: [HARDENING-2026-09-28.md](../../ops/nixos/buzz-hostinger/HARDENING-2026-09-28.md).

## 1 · THE CORRECTED READ (lesson banked)

My earlier note said the Aikido findings were "confirmed applicable to the live deployment" from the Dockerfiles alone. Founder correction, accepted: **a Dockerfile shows the configured default, not proof of the live process's user.** Confirming production required the deployed image config, runtime overrides, and running process identities — done below. Also banked: a passing security badge means the configured check passed (Aikido's CRITICAL threshold passed with three MEDIUMs open, Deep Review skipped for no credits) — green is not zero-findings, and recording a warning is not resolving it.

## 2 · RUNTIME INSPECTION (read-only, the host itself)

Host `buzz-hostinger` (2.25.245.161) via the laptop admin key (`~/.ssh/buzz-hostinger-admin`, authorized on root in `configuration.nix`). Windows OpenSSH transport (the Git-Bash-ssh key-parse trap). Methods: `docker inspect --format .Config.User`; `grep user:` over the deployed `/opt/buzz/deploy/compose/` (no overrides — the only matches were content strings inside a public-board JSON); effective uid/gid from `/proc/<container-init-pid>/status`.

| container | image | config-user | effective uid | disposition |
|---|---|---|---|---|
| buzz-prod-caddy-1 | caddy:2-rl (kit build) | empty | **0** | **CONFIRMED live root** |
| buzz-prod-minio-1 | buzz-storage:2025-09-07 (kit build) | empty | **0** | **CONFIRMED live root** |
| buzz-prod-relay-1 | buzz-relay:skaists-088a677f (kit build) | buzz:buzz | **1000** | **REFUTED at runtime** — `ghcr.io/block/buzz:0.2.1` base sets USER; the kit Dockerfile inherits it (the pair-relay, running the base directly, shows the same uid 1000) |
| buzz-prod-postgres-1 | postgres:17-alpine | — | 70 | non-root (out of findings) |
| buzz-prod-redis-1 | redis:7-alpine | — | 999 | non-root (out of findings) |

Posted on PR #243 (issuecomment-5881185816). Of the three scan findings: two confirmed, one refuted by evidence — which is exactly why the runtime check was required.

## 3 · THE TESTED REMEDY (staging fence on the host, throwaway everything)

Venue: the Hostinger host's own staging pattern — isolated compose project `hard`, internal network, 127.0.0.1-bound host ports (18081, 81), fresh named volumes, runtime-generated throwaway MinIO creds (urandom→od, never printed, `shred -u` after). Preflight: ports 81/444/18080/19000 free, both source images local, 334G disk. Thin variants built ON the host from the existing local images (the runtime delta only — `FROM` the deployed tag + user + chown + `USER`), proving exactly the change the committed full-rebuild Dockerfiles carry:

**Battery (all green):**
1. **startup + permissions (minio):** container up as `uid=9000(minio) gid=9000`, `/minio/health/ready` → **200** on a fresh named volume.
2. **startup + permissions (caddy):** container up as `uid=1000 gid=1000`, serving static content on :8080 → body `hardening-test ok`.
3. **privileged bind (caddy):** one-off instance, Caddyfile `:80`, host `127.0.0.1:81→80`, **uid 1000 process bound :80 and served** — `cap_net_bind_service=+ep` from the official base carries; `USER` was the only missing piece.
4. **persistent storage (minio):** `mc` (in the storage image) wrote a 27-byte object as uid 9000; `docker compose restart minio`; ready 200 again; object read back **byte-identical** (`hardening-persistence-probe`).
5. **rollback / zero residue:** `down -v --remove-orphans` removed both volumes + network; test images `rmi`'d; workdir + creds destroyed; `docker ps -a`/volume/network greps for `hard` = 0/0/0; **production untouched** — same six containers with unchanged uptimes (relay Up 2 days, the rest Up 4 days), `skaists.buzz/info` → 200, `relay.skaists.dev/info` → 200.

Two honest stumbles on the way, both mine, both cured in-session: (a) the first caddy build used `chown caddy:caddy` by name and failed in the alpine base — numeric `1000:1000` is the durable form; (b) the first MinIO auth attempt sent `MINIO_TEST_USER` instead of `MINIO_ROOT_USER` (server never saw the creds the client presented) — and the empty-creds file the missing-`openssl` host wrote was caught by a non-empty check and regenerated before any `up`. The mounted-creds read as uid 9000 also needed a 644 window on the throwaway file (root-owned 600 was unreadable inside the container).

## 4 · WHAT LANDED (new files only — the record untouched)

- [Dockerfile.storage.nonroot](../../ops/nixos/buzz-hostinger/Dockerfile.storage.nonroot) — full-rebuild shape, same pins as the record + uid/gid 9000 + data-dir ownership.
- [Dockerfile.caddy.nonroot](../../ops/nixos/buzz-hostinger/Dockerfile.caddy.nonroot) — full-rebuild shape + `USER 1000:1000` + `/data` `/config` ownership.
- [HARDENING-2026-09-28.md](../../ops/nixos/buzz-hostinger/HARDENING-2026-09-28.md) — the dated rider: findings table, the gated production runbook (stop order, one-time volume chowns, `namei -l` read-checks, verify list, **rollback = image refs back + restart — ownership change is backward-compatible by construction, root reads uid-owned files**).

**Deployment is NOT proposed as done — the runbook is the proposal, gated on the founder go.** PR #258 (the re-reviewer's hook-test repair) verified green + mergeable, draft, its lane's to land.

## 5 · OPEN (named, next)

The five operational script findings from the independent re-review (restore input hash checks; MinIO stop ordering before volume replacement; extraction-directory reuse; staging TLS isolation; smoke-test assertions) — investigation underway in this lane, next commit carries the evidence and the fixes that survive it. Also open: Aikido Deep Review remains skipped (credits = a separate purchase decision, not blocking this lane).

## 6 · VALIDATION CLOSEOUT (2026-09-29, lane renamed "Container hardening — finish validation — KEEP")

The three open validations from §5's honest-limits list are closed:

1. **nix EVALUATED, on the NixOS host itself** (kit archived to /tmp, eval-only — nothing activated, /etc/nixos untouched): the full module closure (configuration.nix → buzz-services.nix with the `requires` additions) evaluates green under the flake's pinned nixpkgs, and `nix eval` answers `["buzz-stack.service"]` for BOTH `hive-board.requires` and `hive-public.requires`. /tmp cleaned after.
2. **The two new smoke route-fence assertions EXERCISED LIVE**: minimal stage rig on the host (stage `Caddyfile.stage` + a real `ghcr.io/block/buzz:0.2.1` pair-relay, one compose network, loopback-only `127.0.0.1:3400`, prod door/join mounted **read-only**); seat-side loopback SSH tunnel; the **exact assertion code** from the revised `staging-smoke.mjs` ran under node — `PASS auxiliary route refusal (/compute/models -> 503)` and `PASS /pair routed (not auxiliary-refused)` (the live pair answer is 502: the backend refusing a plain GET — routing proven, which is what the assertion asserts). Rig torn down, zero residue, production untouched (same six containers, unchanged uptimes, `skaists.buzz/info` 200).
3. **#258 RECONCILED** (no further go needed, per founder order): the re-reviewer's hook-test repair — green ×2 in its own PR runs, authored by the independent reviewer — marked ready and **merged into this branch at `3c42d9696a`**. The false-pass hook test no longer rides separately.

Final CI at the lane head: scan/static/test green; eternal/meter/node are content-identical reruns in flight. **Lane state: validation COMPLETE; the deployment proposal (the HARDENING-2026-09-28.md runbook) stands founder-gated and undispositioned; archiving deferred until that disposition, per founder order — not on this receipt alone.**
