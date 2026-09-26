# skaists.buzz migration — 2026-09-24

## Current state

Production is live on Hostinger **2.25.245.161**. Backend cutover completed at
21:50 UTC on 2026-09-24; Namecheap authoritative DNS for `skaists.buzz` and
`relay.skaists.dev` was verified at the new address by 22:00 UTC.

Oracle (129.153.202.144) forwards cached-address core traffic to Hostinger.
Its old relay/MinIO/Redis containers are stopped with restart policy `no`;
the old database is read-only, and old hive export timers are disabled.
Do not start those writers: production has accepted new writes on Hostinger.
The timed pre-cutover rollback was canceled before committing the migration.

Shared compute, voucher, voice and auxiliary model/watch/Autonomi services still
run on Oracle, reached through explicit Hostinger proxy routes. Other communities,
including `beehivenature.buzz` / `relay2.skaists.dev`, remain on Oracle.

Agent email previously used the apex as its MX target. `mail.skaists.buzz` now
points to Oracle, and `agents.skaists.buzz` MX points to that dedicated hostname.
SPF/DKIM/DMARC were retained. Cached old MX records may retry during DNS expiry.

Caddy now uses automatic HTTPS with the existing certificates seeded into its
managed storage. A restart was required when switching from manual certificate
loading; renewal information was then successfully fetched and stored for both
names. Certificates remain valid; no forced reissuance was needed.

The NixOS host has passed live activation and two successful boots after repair:
Docker, SSH, networking and DNS work, with zero failed units. The first reboot
exposed interface renaming from eth0 to ens18, confirmed in the persistent journal.
Hostinger recovery was used to add net.ifnames=0 to the boot entry; the corrected
Nix configuration was then rebuilt and reboot-tested successfully. It matches the
interface by MAC alone and explicitly disables predictable interface naming.
The generated flake.lock is retained beside this file.

Original system, retained by a remote GC root:
`/nix/store/7zw9ssl8rv1cfd0b06a2aihj9jlza4md-nixos-system-nixos-26.05.8639.c5c4a43b0e80`.

## Recovery procedure

Use Hostinger emergency mode to inspect the installed disk under `/mnt/sdb1`
(verify the filesystem UUID before assuming that mount path on another recovery).
Inspect its journal and generated network/boot configuration before changing it.
Restore the retained original generation if needed, then rebuild the corrected
configuration. Keep the dedicated laptop SSH key and verify its known host key.
Test network, DNS, Docker, SSH authentication policy and a full reboot before
deploying the relay.

## Migration inventory

- Oracle is ARM64; destination is x86_64. Do not copy ARM executables.
- Production relay image: `ghcr.io/block/buzz:0.2.1`, with custom executable
  `/opt/buzz/buzz-relay-join` mounted over `/usr/local/bin/buzz-relay`.
- Custom executable SHA-256:
  `209e4b5e96a3a055a9dca9325ad752f88f42489c16ba405d160cec8214ae3777`.
- Rebuilt and behavior-tested source: `/home/ubuntu/src`, clean tracked tree at
  `088a677f88737aa42af4d6d790bd2dfe8373e835` (join-material event patch).
  Built with Rust 1.95.0 in Debian bookworm for the image's glibc compatibility.
- PostgreSQL 17, database/user `buzz`, approximately 91 MB.
- MinIO objects approximately 130 MB; git data approximately 12 KB.
- Redis 7 uses AOF and authentication; capture final persistent state.
- Pairing sidecar uses the relay image and must remain reachable at `/pair`.
- Caddy has a custom rate-limit module: recreate for x86_64 or keep supporting
  routes behind the existing Oracle gateway until equivalence is proven.
- Main domain: root static door, relay API/WebSocket, `/join`, `/join.json`,
  `/pair`, `/compute`, `/voucher`, `/voice`.
- `relay.skaists.dev` is the same community's fallback origin and additionally
  serves hive/watch/live/model/Autonomi routes. Preserve canonical signing origin
  `wss://skaists.buzz` regardless of transport alias.
- `beehivenature.buzz` and `relay2.skaists.dev` remain on Oracle.

## Backups and cutover gates

Restricted local directory (never commit its contents):
`C:/Users/travi/buzz-repair/2026-09-24/skaists-migration-private`.

Initial online snapshots: compose archive, PostgreSQL custom-format dump,
MinIO/git archive, exact source archive. Online object archives require a final
sync under write freeze; they are not an atomic database/object snapshot.
The Windows extraction of the compose archive could not recreate one Unix
symlink; retain and extract the original archive on Linux.

Before DNS: restore privately, compare database counts and object hashes, verify
join/auth/read/write/upload/pairing/WebSocket paths, and validate TLS by hostname.
Before final copy: stop writers briefly, take a consistent final DB dump and
object/git/Redis sync, and verify the destination. Preserve rollback copies.
After DNS: ensure the old endpoint cannot accept divergent writes; proxy straggler
traffic to the new service or keep it read-only. A rollback after new writes
requires reverse synchronization, not merely reverting DNS.

## Completed acceptance gates

- Private restored clone: invite claim, NIP-42 authentication, channel read/write,
  live WebSocket echo, signed upload/read with SHA-256 match, anonymous file read
  rejection, join page, pairing WebSocket and canonical origin all passed.
- Final backup captured with old relay, MinIO and Redis stopped. Every public
  database table count matched before new production startup. MinIO/git/Redis
  restored trees had empty checksum-based rsync differences.
- Final database dump and volume archive hashes matched the restricted laptop
  copies and the destination copies.
- New production relay/Postgres/Redis/MinIO healthy; hive exporters succeeded;
  zero failed NixOS units at verification. Staging containers are now stopped.
- Post-cutover reboot passed: new boot ID, enabled production unit returned active,
  all four health-checked services healthy, zero failed units, and both public
  origins passed info/join/unauthenticated-compute/WebSocket AUTH checks again.
- Public primary/fallback `/info`: 200; unauthenticated compute models: 401;
  `beehivenature.buzz/info`: 200. Authoritative DNS confirms both migrated A records.

Final database SHA-256:
`730d2107bd4d8450c7393473e2de593b3466d5006dc3a946d4a1e97d69a6aae2`.
Final volume archive SHA-256:
`fa1a6bc0737d3d426dc8bb3259adef8f0e564634d9fb5428fe69ee84151aec36`.

Built image IDs (retain these images while the deployment uses local tags):

- relay: `sha256:11246fa8b0d91820185405809f74a8dd16b0c5c5d65d8005418fa6ad808ea0e2`
- storage: `sha256:19823ae893e0d277ae0f77d2eb297ff88f657820f957df8045b6c0f22f5ff92c`
- Caddy: `sha256:9fcaa51fcd5745588bb37c20b40cfb3ff65593337d59228ebc5f59c47cbd809a`

## Recovery after cutover

Restore from a current Hostinger backup or reverse-sync current production under
a write freeze before moving back to Oracle. Merely reverting DNS and starting
the old containers would lose post-cutover writes. Keep Oracle forwarding active
through DNS cache expiry. The initial/final migration snapshots are recovery
checkpoints, not a recurring backup service.

## Remaining work outside this migration

Recurring off-host backups still need deployment. Invite rotation remains in its
pre-existing dry-run state; no owner signing key was invented or bypassed.
Windows mesh build, ten-agent activation and the x0x three-node network are
separate acceptance gates and are not implied complete by this server migration.
