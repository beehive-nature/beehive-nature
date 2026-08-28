# LANE G — ESTATE BUZZ RELAY · skaists.buzz · 2026-08-28

Seat: **z2.2** · Dispatch: founder lane order (LANE G), same day.
Host: Oracle VPS `129.153.202.144` (the LiveKit box), Ubuntu 24.04.4 aarch64.

**Ruling carried forever: `skaists.buzz` is the community hostname — the relay
derives community identity from this name** (relay seeds its deployment
community from the host parsed out of `RELAY_URL`; upstream main.rs calls this
the deployment community and it scopes every member row).

## Status: STAGED / READY — waiting on the founder's two acts + his npub

Everything through "configure before first start" is done and verified on the
box. Nothing is running. The next motion is the founder's:

1. DNS A `skaists.buzz` → `129.153.202.144`
2. OCI console ingress TCP 80 and 443 (Security List of the VCN)
3. (bundled ask) his npub — "Copy your public ID" from the desktop app

Bring-up runbook is §8. The ONLY done for this lane is §10.

## 1 · Source and pins

| What | Pin | Notes |
|---|---|---|
| Source read | estate mirror `skaists/buzz` @ `191a577d5804` | MIRROR-1 landed (beehive-nature/buzz stayed empty — known shallow-clone failure). Clone on dev box `~/buzz-src`, on VPS `/opt/buzz`. |
| License | Apache-2.0 | LVERIFY-0813 clean per dispatch; LICENSE verified in mirror. |
| Relay image | `ghcr.io/block/buzz:0.2.1` | `relay-v0.2.1` is the LIVE upstream latest relay release (checked 2026-08-28: upstream changelog head == mirror head == relay-v0.2.1). arm64 manifest verified from the box. Digest `sha256:4e31b7c7abb7` (full digest in `/opt/buzz/IMAGE-PINS.txt`). |
| Why pinned | `relay-v*` moves independently of the desktop app | Desktop line is at `desktop-v0.5.20` (2026-08-26) while the relay line sits at 0.2.1 — the tag namespaces are separate pipelines (docker.yml: only `relay-v*` tags publish the relay image, as bare semver `:0.2.1` + `:0.2` + `:0`). `:main` was REFUSED for prod (moves daily). |

Sidecar pins (all pre-pulled, digests in `/opt/buzz/IMAGE-PINS.txt`):
`postgres:17-alpine` (`sha256:18cfe3ef5e68`), `redis:7-alpine` (`sha256:ff02b58f971e`),
`minio/minio:RELEASE.2025-09-07T16-13-09Z` (`sha256:14cea493d9a3`),
`minio/mc:RELEASE.2025-08-13T08-35-41Z` (`sha256:a7fe349ef4bd`),
`caddy:2-alpine` (`sha256:5f5c8640aae0`).

## 2 · Preflight (beside LiveKit) — PASSED, 2026-08-28 ~16:44 UTC

| Resource | Number | Verdict |
|---|---|---|
| RAM | 23 GiB total, **22 GiB available** (781 Mi used incl. LiveKit) | fits relay+PG+Redis+MinIO with room |
| Disk | 45 G total, 6.1 G used, **38 G free** | fits incl. local MinIO media (see §4) |
| CPU | 4 cores, load 0.00 | idle beside LiveKit |
| Docker | 29.1.3 + compose 2.40.3 | ≥ 2.24.4 (`!reset` requirement) |
| Ports | 80/443/3000 free; LiveKit holds 7880 + 8080 on the HOST | no collision; relay's 8080 is container-internal only (caddy overlay `!reset`s the relay port publish) |

LiveKit is NOT docker — host processes. Zero docker containers existed before
this lane; zero exist after staging. **LiveKit untouched.**

## 3 · Configuration (written before first start, verified by read-back)

`/opt/buzz/deploy/compose/.env` — mode `600`, generated 2026-08-28T16:51:59Z:

```env
BUZZ_IMAGE=ghcr.io/block/buzz:0.2.1
BUZZ_DOMAIN=skaists.buzz
RELAY_URL=wss://skaists.buzz
BUZZ_MEDIA_BASE_URL=https://skaists.buzz/media
BUZZ_MEDIA_SERVER_DOMAIN=skaists.buzz
# BOTH desktop origins — the Windows one is the buzzbuild defect, never repeated:
BUZZ_CORS_ORIGINS=https://skaists.buzz,tauri://localhost,http://tauri.localhost
BUZZ_REQUIRE_AUTH_TOKEN=true
BUZZ_REQUIRE_RELAY_MEMBERSHIP=true
BUZZ_ALLOW_NIP_OA_AUTH=true
BUZZ_AUTO_MIGRATE=true
BUZZ_GIT_CONFORMANCE_PROBE=true
BUZZ_SERVE_GIT_WEB_GUI=false          # explicit; upstream default is false too
RUST_LOG=buzz_relay=info,buzz_db=info,buzz_auth=info,buzz_pubsub=info,tower_http=info
RELAY_OWNER_PUBKEY=                   # EMPTY until founder npub → hex (see §5)
POSTGRES_DB=buzz
POSTGRES_USER=buzz
BUZZ_S3_BUCKET=buzz-media
BUZZ_S3_ADDRESSING_STYLE=path
BUZZ_HTTP_PORT=3000
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443
```

Secrets (values NEVER in any transcript — generated on-box with openssl inside
the ssh session, file mode 600): `POSTGRES_PASSWORD`, `REDIS_PASSWORD`,
`BUZZ_RELAY_PRIVATE_KEY` (secp256k1, the relay identity that signs NIP-43
events and powers buzz-admin), `BUZZ_GIT_HOOK_HMAC_SECRET`,
`BUZZ_S3_ACCESS_KEY` + `BUZZ_S3_SECRET_KEY` (local MinIO root).

Stack shape: `compose.yml` (relay + postgres + redis + minio + minio-init) +
`compose.caddy.yml` (Caddy on 80/443, automatic Let's Encrypt for
`{$BUZZ_DOMAIN}`, reverse_proxy relay:3000). `docker compose config` → VALID.

OS firewall: INPUT ACCEPT tcp/80 + tcp/443 (comment "buzz relay"), before the
catch-all REJECT, **netfilter-persistent saved**. The OCI security list
remains the founder's act — this box cannot open it.

## 4 · Decisions and their dispatch grounding

1. **MinIO local** (media on-box): dispatch §2 budgets relay+PG+Redis+MinIO on
   this box; 38 G free. This supersedes lane R-1's "external S3 default"
   (2026-08-16) — newer, more specific order. Media growth watch: the disk
   holds; a future migration to external S3 stays possible via the
   compose.external-s3 pattern (already proven in ~/buzz-relay-deploy.sh).
2. **Both tauri origins** in CORS: comma-split parser confirmed in source
   (`config.rs` `.split(',')` + trim). `tauri://localhost` covers macOS/legacy,
   `http://tauri.localhost` covers Windows WebView2 — the exact omission that
   walled the founder's desktop at buzzbuild. Our relay never repeats it.
3. **Git web GUI off**: `BUZZ_SERVE_GIT_WEB_GUI=false` (`true`/`1` parser,
   default false — upstream's own test asserts the default; we pin it
   explicitly so a future default flip can't open it).
4. **Estate mirror, not upstream, for the box clone**: dispatch §1 order
   (MIRROR-1 landed). Mirror == upstream on the relay line today; drift only
   matters for compose files, which the pin freezes.
5. **Fail-closed beats fail-open, structurally**: with
   `BUZZ_REQUIRE_RELAY_MEMBERSHIP=true` and no valid `RELAY_OWNER_PUBKEY`, the
   relay REFUSES TO START (main.rs fail-fast). So "the open-door default lives
   for zero minutes" is enforced by the binary itself: it cannot come up
   admin-less and open.
6. **Owner plan**: ideal — founder's npub arrives with his "done"; hex goes
   into `RELAY_OWNER_PUBKEY` BEFORE first `up`; on boot the relay
   auto-bootstraps him as owner (idempotent, re-runs every start). Fallback if
   bring-up must precede the npub: generate a bootstrap owner on-box
   (`buzz-admin generate-key`), boot closed, swap the env to founder hex at
   first re-start (bootstrap_owner re-runs; the placeholder never owns again).

## 5 · Code-verified facts this lane stands on (mirror @ 191a577)

- CORS parse: `BUZZ_CORS_ORIGINS` comma-separated (config.rs:702).
- `BUZZ_SERVE_GIT_WEB_GUI`: `true`/`1`, default false (config.rs:965).
- Closed mode without owner pubkey = startup error (main.rs:234).
- `RELAY_OWNER_PUBKEY` unprefixed, 64-char hex, warn-and-ignore if invalid;
  owner role exists ONLY there — buzz-admin `add-member` roles are
  admin/member, never owner (buzz-admin/src/main.rs).
- `buzz-admin add-member --pubkey <npub|hex> [--role member|admin]` requires
  `BUZZ_RELAY_PRIVATE_KEY` (signs a kind:13534 roster event via Redis);
  `list-members`, `migrate`, `generate-key` also exist.
- Deployment community = host derived from `RELAY_URL` (main.rs) — the
  hostname IS the community identity, forever.

## 6 · On-box state after staging

- `/opt/buzz` — estate mirror clone @ `191a577d5804` (depth 1)
- `/opt/buzz/deploy/compose/.env` — 600, 7 secret keys generated on-box
- `/opt/buzz/IMAGE-PINS.txt` — full repo digests of every pulled image
- `/opt/buzz/reapply-firewall.sh` — NOT needed (netfilter-persistent present)
- images pulled (no containers created); compose config VALID; nothing started

## 7 · What the founder was asked for (READY message)

1. DNS A `skaists.buzz` → `129.153.202.144`
2. OCI ingress TCP 80 + 443
3. His npub ("Copy your public ID" in the desktop app) — enables owner-at-boot

## 8 · Bring-up runbook (z2.2 executes after the founder's "done")

```
0. npub → hex (bech32 decode, on-box python3) → sed RELAY_OWNER_PUBKEY in .env
1. DNS: two independent resolvers must agree on skaists.buzz → box IP
   (getent + dns.google DoH, from the box; REFUSE on mismatch)
2. sudo -n docker compose --env-file .env -f compose.yml -f compose.caddy.yml \
      up -d --wait                      # first start; slow part already pulled
3. verify: in-container /_readiness 200; https://skaists.buzz/ 200 via Caddy;
   NIP-11 info document served; cert issuer = Let's Encrypt
4. buzz-admin list-members (owner present); if needed:
   buzz-admin add-member --pubkey <founder-npub>   # roster event, idempotent
5. hand the founder ONE line:  Add Community → wss://skaists.buzz
```

## 9 · REFERENCE-BLUEPRINT — stamping an artist's hive from this one

1. Preflight the target box beside what already lives there (RAM/disk/ports);
   stop with numbers if it doesn't fit — never evict a resident service.
2. Clone the estate mirror (skaists/buzz) — never a moving `:main` image;
   pin the relay semver tag (it moves independently of desktop releases) and
   record every digest to IMAGE-PINS.txt after pull.
3. Write .env BEFORE first start: hostname (community identity, permanent),
   RELAY_URL wss://<host>, CORS = web origin + tauri://localhost +
   http://tauri.localhost, REQUIRE_AUTH_TOKEN=true,
   REQUIRE_RELAY_MEMBERSHIP=true, SERVE_GIT_WEB_GUI=false, AUTO_MIGRATE=true.
   Generate ALL secrets on-box (openssl; mode 600); never in a transcript.
4. Owner at boot: RELAY_OWNER_PUBKEY = founder hex BEFORE first up. The relay
   fails closed without it — an ownerless open relay cannot exist.
5. Founder does DNS A + cloud ingress 80/443; deployer verifies with two
   resolvers; then and only then `up -d --wait`.
6. Receipt = the founder's client renders channels on his screen — not logs.
7. Park with: pins, redacted env, resource numbers beside the resident
   service, and this blueprint.

## 10 · Receipt definition (the only DONE)

The founder's Windows desktop app joins `wss://skaists.buzz` and RENDERS
CHANNELS — his screen, not our logs. Then this file closes with the live
receipt, resource numbers beside LiveKit under load, and the parked state.

## Fences (standing)

- This relay is infrastructure — NEVER the bLOVErAi durable path.
- No estate surface work in this lane.
- Lane B (z1.1) untouched.
- Founder's acts are founder's acts: DNS, OCI console, his npub. Never faked,
  never simulated.

---

## Addendum — z2.1 independent verification pass (2026-08-28, ~17:15 UTC)

Seat z2.1 (dispatched by the chief, Fable 5, with the same lane order) re-ran
the source read and the box audit WITHOUT first reading this file — every pin
re-derived independently, then reconciled:

- **Same pins, independently**: estate mirror `skaists/buzz @ 191a577` (clone
  `~/buzz-src`), upstream parent read `d8281b9c9339`, relay line `relay-v0.2.1`
  (Cargo.toml + CHANGELOG), image `ghcr.io/block/buzz:0.2.1` with index digest
  `sha256:4e31b7c7abb7` — byte-identical to `/opt/buzz/IMAGE-PINS.txt`. arm64
  manifest confirmed in the 0.2.1 index (amd64 + arm64 + 2 attestations).
  Desktop line independence confirmed the same way (desktop 0.5.x vs relay
  0.2.1 in one tree; docker.yml: only `relay-v*` publishes the image, as bare
  semver).
- **main.rs:234 re-verified**: `require_relay_membership && relay_owner_pubkey
  .is_none()` → hard boot error. This reconciles the two source layers:
  config.rs warn-and-ignores an INVALID owner value at parse time; main.rs
  refuses to BOOT closed-mode ownerless. Fail-closed is structural, confirmed.
- **Staged box state audited live — every §6 claim green**: `/opt/buzz` at the
  pin; `.env` mode 600 ubuntu with the exact §3 knobs (`RELAY_OWNER_PUBKEY=`
  empty as parked); six images present; **zero containers**; iptables INPUT
  ACCEPT 80/443 "buzz relay" beside the BNR-relay 8080 and LiveKit 7880 rules.
  Secrets were not read (names/patterns only — the law held from z2.2 to z2.1).
- **FOUNDER ACT #1 EVIDENCED — DNS IS LIVE**: `skaists.buzz` A →
  `129.153.202.144` answering on Google DoH AND the box resolver (the §8.1
  two-resolver gate passes, ~17:10 UTC). The Windows-local resolver gave no
  answer (local cache quirk; not a runbook gate). Ingress probe from the
  founder's network: TCP to the box :80/:443 connects-then-resets (curl exit
  56, no timeout — consistent with open OCI ingress and no listener yet;
  DEFINITIVE ingress proof only exists once Caddy listens).
- **Owner-order note for bring-up**: the chief's dispatch to z2.1 orders a
  box-created owner identity at first launch with the founder added as MEMBER
  — i.e. §4.6's fallback path, not the ideal. Executed as one motion:
  `buzz-admin generate-key` on-box → pubkey into `RELAY_OWNER_PUBKEY` →
  single first `up` (the binary refuses ownerless boot, so there is no window
  where the relay exists open or admin-less). The founder's npub then enters
  via `add-member --role member` per dispatch step 6.

**Standing state: READY at the founder gate.** DNS done (public evidence);
awaiting his word ("done" — his OCI ingress act with it) and his npub. Bring-up
follows §8 with the owner motion above folded into step 0.

*Artifacts from this pass (local disk, not repo cargo): the Lane-G-revised
`~/buzz-relay-deploy.sh` (dash-syntax clean, property-grepped) — kept as the
external-S3 migration pattern reference per §4.1, NOT the runbook of record;
`~/buzz-src` mirror clone.*
