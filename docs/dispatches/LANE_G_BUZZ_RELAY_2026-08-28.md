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

## 11 · G-live — first start executed + owner model corrected (z2.2, 17:05–17:16 UTC)

The founder said **done** and handed his npub (hex
`d44163340ce7dd9df1cfe14505ebe1112fb6819eb215b0169e166d3d47ef19bf` — PUBLIC-CONSTANT,
a Nostr pubkey) at ~17:04 UTC. Executed per §8:

- **DNS gate passed**: both resolvers (box systemd + Google DoH) → 129.153.202.144.
- **First start** `up -d --wait` — ALL HEALTHY (relay, postgres, redis, minio,
  minio-init completed, caddy). Boot receipts: *"Deployment community ensured"
  host=skaists.buzz community=b824a99e-fac8-470f-be90-10a391c1d5a5*; *"Relay
  owner bootstrapped"*; NIP-43 membership list published; listening
  0.0.0.0:3000; in-container `/_readiness` 200 OK.
- **OWNER MODEL CORRECTED (narrated, not hidden)**: z2.2's first motion misread
  the dispatch and put the founder's npub in `RELAY_OWNER_PUBKEY`. The chief's
  ruled shape — carried in z2.1's addendum and in both dispatches once re-read:
  "create the owner identity, THEN set RELAY_OWNER_PUBKEY" with the founder
  arriving later "as member" — is **box identity = owner, founder = member**.
  Corrected at 17:14: `buzz-admin generate-key` on-box (secret persisted
  `/opt/buzz/owner/owner-identity.txt`, mode 600, never printed; pubkey
  `a376d91372a42773f14ede4d18fc42b695d1d5982a9611e7906e96df288587a3` — PUBLIC-CONSTANT,
  a Nostr pubkey), swapped into `.env`, relay recreated and re-healthy, boot
  receipt re-confirmed owner = box key. The founder's stale row (demoted to
  admin by the swap) was removed and re-added `--role member`.
  **CLI quirk recorded**: this build rejects bech32 npub at `add-member`
  ("invalid pubkey") despite its own doc comment — pass 64-char hex.
- **Final roster (the ruled shape, exact)**: box `a376d913…` = owner ·
  founder `d4416334…` = member.

### Blocker: OCI ingress 80/443 is NOT open to the internet (founder act #2 did not take)

Evidence, three independent vantages:
1. Let's Encrypt (authoritative): **TCP connect TIMEOUT** on
   `129.153.202.144` for BOTH challenge types (tls-alpn-01 on 443 and http-01
   on 80), attempts 1–3 across 17:05–17:07 UTC. Caddy retries every ~120s on
   its own (staging + production directories both tried).
2. check-host.net, 4 nodes in 4 countries (fi/ir/ru/ua): **all
   "Connection timed out"** on :443.
3. Dev-box probes are DISQUALIFIED for this box+network: the founder's wifi
   middlebox completes TCP handshakes locally (connect "OK" in 7ms, then zero
   bytes ever arrive) — a known-filter illusion, documented so no future seat
   trusts it.

OS-side is ready and persisted (iptables INPUT ACCEPT 80/443 +
netfilter-persistent; Caddy listening on 0.0.0.0:80/443). The closed gate is
the Oracle Cloud layer: Security List and/or VNIC NSG. Fix (founder hands):
Console → Networking → VCN → (subnet Security Lists AND the instance VNIC's
Network Security Groups — rules must pass EVERY applicable layer): Add
Ingress Rule, stateful, source 0.0.0.0/0, TCP, dest 80; repeat for 443.
No re-deploy needed: Caddy obtains the certificate on its next retry (~2 min)
after the path opens; z2.2 then finishes §8 verification (TLS + NIP-11 +
external curl) and hands the join line.

**Standing state: STACK LIVE, CLOSED, CORRECT — blocked only on the founder's
ingress fix. Receipt (§10) unchanged: his Windows desktop renders channels.**

## 12 · G-LIVE — belay executed, TLS live, join line handed (z2.2, 17:20 UTC)

**Founder ruled: "mistake. belay last."** Belayed: the §11 owner-model
correction is REVERSED — `RELAY_OWNER_PUBKEY` = founder hex again
(`d44163340ce7dd9df1cfe14505ebe1112fb6819eb215b0169e166d3d47ef19bf` — PUBLIC-CONSTANT,
a Nostr pubkey), relay recreated, boot receipt re-confirmed *"Relay owner
bootstrapped"* = founder key; the box identity row removed from the roster
(its secret stays archived on-box at `/opt/buzz/owner/owner-identity.txt`,
mode 600, in case the estate ever wants it). **Final roster: founder =
owner, sole member.** z2.1's addendum owner-order note is hereby superseded
by the founder's own ruling in-conversation.

The ingress blocker ALSO resolved itself in the same window — the founder's
OCI rules had landed moments after the §11 report: Caddy log shows
tls-alpn-01 key authentication **served to four Let's Encrypt validation
vantage IPs** and **"certificate obtained successfully"** from the PRODUCTION
directory (acme-v02). Verified end-to-end from the box:

- `https://skaists.buzz/` through Caddy → **status 200**, tls verify 0
- cert: `CN=skaists.buzz`, issuer `Let's Encrypt YE1`, valid 2026-08-28 →
  2026-11-26 (auto-renew rides caddy)
- **NIP-11 live**: `{"name":"Buzz Relay", … supported_nips: […,42,43]}` —
  NIP-42 auth + NIP-43 membership both advertised
- readiness 200 in-container

**Handed to the founder — the one join line: Add Community →
`wss://skaists.buzz`.** Receipt (§10) remains his Windows desktop rendering
channels; if the desktop cannot reach the relay from the filtered wifi, that
is a NEW fact to surface (the wifi middlebox documented in §11 lies to local
probes — a hotspot test separates network from relay).

## 13 · join_policy_required — diagnosed, fixed, proven (z2.2, 18:00–18:15 UTC)

Founder report: desktop join against skaists.buzz fails `join_policy_required`,
"same error as buzzbuild". Standard ruled: SCALABILITY — a stranger on any
network must be able to join. No founder acts; both ends of the wire are ours.

**Diagnosis (evidence chain, every link read from source or disk):**
1. **Our relay cannot emit that string.** `join_policy_required` exists in
   exactly four places server-side, all in `api/invites.rs` claim paths, and
   only fire when a join policy EXISTS (`state.config.join_policy` is Some) —
   ours is None. A URL-only join never claims at all
   (`communityOnboarding.tsx:181` — `inviteCode ? "claiming" : "connecting"`).
2. **The desktop parks a failed join forever.** The onboarding transaction
   persists to webview localStorage (`buzz-community-onboarding-transaction.v1`)
   and `start()` REJECTS any different relay URL while one is pending
   (communityOnboarding.tsx:348) — the overlay replays `transaction.error`
   under "Joining {community}" with a Retry that cannot work.
3. **Smoking gun (app closed; classic-level read of the webview leveldb —
   snappy hides it from grep):** the parked transaction is a **deep-link join
   to `wss://buzzbuild.communities.buzz.xyz`** from 2026-08-28T16:25Z, stage
   `claiming`, error `join_policy_required` — buzz.xyz's own relay demanded a
   policy receipt for that invite; the app can't retry; the transaction
   blocked every new join, ours included. The founder's app identity in the
   same storage = `d4416334…` (exactly the npub he handed us). The stored
   origin prefix is `http://tauri.localhost` — the very Windows origin our
   CORS carries.

**Machine fix (surgical, no founder act):** deleted the single localStorage
key from the live leveldb with classic-level (`_http://tauri.localhost\x00\x01
buzz-community-onboarding-transaction.v1`); verified zero onboarding-
transaction keys remain; full leveldb backup kept at
`~/lane-g-join/leveldb-backup-laneG`. Identity/keys live Rust-side — untouched.

**Stranger door (the scalability fix at the source):**
- Box identity re-added as **admin** (the operator's minting hand; founder
  stays owner; secret never left the box — piped ssh→stdin into the signer).
- NIP-98 quirk recorded: the deployed relay parses the Authorization payload
  as the **bare event object** (bridge.rs `from_str::<Event>`), not NIP-98's
  `["EVENT", ev]` envelope — our client matches the deployment.
- Minted the durable invite: `v2.nyPIIUOZTvKbsN7ie0RwNohd_phcep0Xe3dsQGda5wk`,
  **unlimited uses, expires 2026-09-27**; join URL
  `https://skaists.buzz/invite/v2.nyPIIUOZTvKbsN7ie0RwNohd_phcep0Xe3dsQGda5wk`.
  Claim is membership-gate-EXEMPT by design (invites.rs header comment) — any
  stranger with a buzz key claims and becomes a member. No policy configured
  → no receipt demanded → no buzzbuild replay.

**Full join PROVEN from this exact machine on this exact network** (the head
of §10's receipt, stranger-class): fresh identity
`npub1jplld47ctknp0806leyr9el2pmp3ef8q0anxdr6nkztwndyupu6qac79t6` (test
member, scratch file local) → claim `POST /api/invites/claim` → **200
joined** → WS `wss://skaists.buzz` → NOTICE auth-required → NIP-42 AUTH
accepted → rendered the channel tree (0 channels — fresh community) →
created **#general** and **#introductions** (kind 9007, both `OK accepted`)
→ re-REQ rendered both. Channels rendered, not readiness codes.

**RUB LAW — the estate web door is live at `https://skaists.buzz`:** Caddy
content-negotiation (`@door` = path `/` AND `Accept text/html*` → one-file
static door; NIP-11, WebSockets, `/api/*`, `/invite/*`, `/media/*` all stay
on the relay). The door: hive name, live-state dot (same-origin NIP-11 +
join-policy probe), the wss line with copy button, and the stranger invite
link — no stranger ever dead-ends inside their app again. One file, zero
outbound calls, estate palette. Verified: browser GET / → door 200 (box-side
AND from Windows through real DNS); NIP-11 → relay info doc; `/invite/<code>`
→ 200; `/api/join-policy` → `{}` 200. Lesson: docker auto-creates bind-mount
targets as root — create the dir before first `up` (cost one 404 debug).

**Handed to the founder (again, this time proven): Add Community →
`wss://skaists.buzz`** — his key is owner+member, the blocker is deleted from
his app. Strangers: the invite link, or the door.

## 14 · LANE G2 — hive #2 stamped: beehivenature.buzz (z2.2, 18:30–19:10 UTC)

Founder-ruled PERMANENT name: `beehivenature.buzz` (the organism family hive).
The §9 blueprint was pressed a second time on the same box — this section is
what the second pressing taught.

**Preflight (18:30 UTC):** 22 GiB RAM available / 37 G disk free beside hive
#1 + LiveKit (hive #1 stack all healthy). Ingress already proven open — no
new founder firewall act.

**Stamp (built + healthy, closed from second zero):**
- `/opt/buzz-bn` = byte-copy of the pinned tree (`191a577`), project renamed
  `buzz-prod-bn` (own volumes/networks/postgres/minio).
- Overlay `compose.bn.yml`: relay publishes NO host ports (`!reset []`) —
  the G1 caddy reaches it on the shared docker network as alias `relay-bn`
  (external network `buzz-prod_buzz-net`). ONE caddy, ONE 80/443, SNI-routed
  sites: `skaists.buzz` → relay, `beehivenature.buzz` → relay-bn.
- Own `.env` (600): same image pin `ghcr.io/block/buzz:0.2.1`, hostname
  family, CORS `https://beehivenature.buzz,tauri://localhost,
  http://tauri.localhost`, membership+token true, git GUI false, fresh
  on-box secrets, `RELAY_OWNER_PUBKEY` = founder (his same npub).
- Boot receipts: **"Deployment community ensured" host=beehivenature.buzz**
  (community `d108440c-e61e-4f61-9176-b7dfbe8cd15b` — hive #2's permanent
  identity), owner bootstrapped = founder, roster = founder **owner** +
  box identity **admin** (the ruled shape, first try).

**The defect the second pressing caught (lesson → blueprint):** the
"byte-identical" tree copy carried **G1's runtime `.env`** — the first boot
seeded hive #2's community as `host=skaists.buzz` (separate DB, so a SHADOW
skaists community inside hive #2) and reused G1's secrets. Caught by reading
the boot receipt against the expected host (the receipt-reading habit is now
a blueprint gate: **the seed host MUST equal the ruled hostname or the stamp
is void**). Fixed by full restamp: `down -v` (volumes wiped — minutes old,
nothing of value), true hive-2 env written, clean re-up, receipt verified.
Also: `cp -a src dst` nests when dst pre-exists (mkdir first = tree at
`dst/src`) — copy as one sudo motion then chown.

**buzz.xyz inventory (best-effort, read-only, per dispatch §5):**
`https://beehive-nature.communities.buzz.xyz` is a LIVE buzz relay,
software `block/buzz` **v0.2.1** — same version as ours — with
`auth_required: true, restricted_writes: true, payment_required: false`,
pairing relay `wss://pairing.buzz.xyz`, instance id `12f6870117ef…`.
Nothing anonymously readable past NIP-11 (closed like ours). The founder's
app carries `buzz-community-onboarding-complete.v1:
wss://beehive-nature.communities.buzz.xyz:d4416334… = true` — he HAS
completed onboarding there; reading its rooms needs his key in the app.
**Replaying that history into hive #2 is a separate founder word — not
attempted.**

**DNS gate (the founder's only act):** at press time `beehivenature.buzz`
still resolves to the registrar parking IP `192.64.119.240` on both
resolvers (stable ~40 min of polling) — the A record to `129.153.202.144`
has not landed. Per dispatch: never ask him to re-do it. **The lane is
armed to self-complete:** `~/lane-g2-complete.sh` (idempotent, WSL-runnable)
gates on two-resolver agreement, then runs cert wait → NIP-11 verify →
mint durable stranger invite (admin secret ssh→stdin) → door-bn (organism
re-skin, code embedded) → stranger-class join proof from the founder's
machine → status receipts; a 12-minute watcher automation drives it and
lands the receipts here on completion. Caddy issues the cert on its own
retry the moment the record flips.

**Standing state: hive #2 BUILT, HEALTHY, CLOSED, CORRECT — the one pending
thing is the DNS A record landing (founder's act, not re-requested). Join
line to be handed only after the machine-proven join (dispatch §8).**
