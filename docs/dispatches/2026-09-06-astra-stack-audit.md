# Astra stack audit — evidence, repairs and remaining gates

**Audit base:** `526d90eb367b164dab765ae54c6023bfe07d484e`.
**Observation window:** 2026-09-07 UTC / 2026-09-06 America/Denver.
**Seat:** Codex (Astra), `C:/Users/travi/wt-astra-audit`.

The stack has working services and substantial executable checks, but it is
**not yet ready for an unconditional production-quality sign-off**. The
highest remaining risks are provider-independent recovery/replay, production
disk pressure, incomplete deployment provenance and unverified cloud configuration. The laptop access path and
voice worker have been repaired and verified. This report records what was
examined, not a claim that every line in every fork received a security audit.

The founder's destination is a decentralized runtime serving at least ten
billion people over at least a thousand years. The box is bootstrap capacity.
The [kernel continuity audit](2026-09-06-astra-kernel-continuity.md) maps the
seven constitutional primitives to inspected code, adds an offline archive
reader, and defines failure/scale experiments without claiming those targets
are already achieved.

## Coverage

| Area | Work performed | Boundary |
|---|---|---|
| GitHub estate | Paginated 90 accessible repos; 86 in the named scope; 39 selected repos resolved and inventoried, including one empty stub; raw root license files and latest HEAD checks collected | 47 personal study forks are inventory-only; four outside collaborator repos excluded |
| Monorepo | Standing laws, runbooks, CI/security gates, estate registry, exposed service entry points and selected contract boundaries inspected | 469 code files exist; this is not a line-by-line cryptographic or smart-contract certification |
| Public doors | 19 CNAME-derived domains received DNS and HTTPS HEAD checks | Registrar holdings are not silently treated as deployed applications; failures are observations from this client |
| Production | SSH health, service/timer census, listeners, Docker ports/mount metadata, host IPv4/IPv6 rules, MTU, secret-file metadata, disk consumers and failure categories | No customer messages/audio, key values or raw environment dumps were emitted |
| Cloud | Existing OCI exception and retire trigger read; release metadata checked | No authenticated OCI console/CLI was available; live security lists, NSGs and backup policies remain unverified |
| Laptop | Windows/WSL P2P process census, adapter counters, short baseline/SSH comparison and real tunnel lifecycle checks | No intentional node-induced outage, speed test, router reset or building-network changes |

Full names, refs, file counts, check outcomes, license-byte hashes and domain
observations: [repository inventory](2026-09-06-astra-repository-inventory.md).
Deployment reasons, safeguards, exact rollback locations and live validation:
[change receipt](2026-09-06-astra-change-receipt.md).

## P1 — production disk reserve has failed; bitcoind is down — OPEN

`wsl -e ssh oracle 'df -h /; systemctl --failed --no-pager --plain'`
returned **45G total, 41G used, 3.6G available, 93% used**, with
`buzz-bitcoind.service` and `postfix@-.service` failed. The Bitcoin journal
was classified on the box without printing raw log content: `Disk space is
too low`, `No space left on device`, `Fatal LevelDB error` and `Error opening
block database` occur in the failure sequence. A running process was not
restarted merely to clear the failed indicator.

`sudo du -x -h --max-depth=2 /opt /var/lib /home/ubuntu /var/log /tmp`
identified `/var/lib/bitcoin` at 5.8G, including 4.1G chainstate;
`/home/ubuntu/src/target` at 5.7G; journal storage at 1.2G. `docker system df`
reported 2.476GB of reclaimable image storage, **not approved deletion**:
some images may be rollback material. Live `/proc` inspection found a
development `buzz-relay` executing `/home/ubuntu/src/target/debug/buzz-relay
(deleted)` with cwd `/home/ubuntu/src`.

The six-GiB Autonomi filesystem fence is mounted, but it caps only that
store. The statement in `ops/ant-node/fence.md` that it leaves room
"forever" is invalid when other workloads grow. The same document requires
at least ten GB free; the live measurement is below that reserve.

**Acceptance for closure:** inventory restartable binaries and active builds;
separate development build output from the production volume; establish a
measured free-space budget and growth limits; preserve verified recovery
material; then recover the Bitcoin database under its own snapshot/rollback
receipt and prove block progress. A rebuild/reindex or data deletion was not
attempted in this audit. Postfix must be reconciled with the existing working
receive-only `buzz-mail-sink` on port 25 before any mail restart.

## P1 — recovery capability is not demonstrated — OPEN / evidence needed

The service/timer census and bounded search of `/opt`, `/var/backups`,
`/etc/systemd/system` and `/etc/cron.d` found the OS dpkg backup timer, but
no application backup job. This does **not** establish that no backup exists:
OCI boot-volume backups and external storage were not accessible here.
The founder clarified that continuity must ultimately be decentralized; a
cloud backup is only a possible bootstrap recovery aid.

Postgres, MinIO objects, relay signing identity, x0x identity, meter/escrow
state and configuration need a consistent recovery map. Local copies on the
same nearly full boot volume are rollback aids, not independent disaster
recovery. **Closure requires a restore rehearsal on an isolated target**,
with independently verified history, explicit recovery point/time objectives,
and secrets restored securely. Map every item to a constitutional primitive
or replaceable adapter/cache; distinguish restoring bytes from reconstructing
authorized state. The new archive verifier closes one receiving seam, not
this whole-estate recovery gate.
No new paid storage or destructive restore was provisioned.

## P1 — laptop "tunnel" joined the public mesh — REPAIRED

At the audit base, `ops/x0x/x0x-tunnel.ps1` `up` calls `Start-Process x0xd`
before forwarding. Its `down` kills all x0xd processes, and each `up` starts
another unspecific stop timer. `ops/x0x/x0xd-laptop.toml` records historical
traffic near 6 Mbps and explicitly says there was no byte-rate cap.

The founder reports every router-connected device loses usable internet
until a router restart. The exact router mechanism remains unverified.
The installed replacement uses one scoped SSH control connection, loopback
listeners, renewable expiry and a unique socket per session. No local mesh
daemon starts. Windows reaches box x0x 0.41.3 with 28 peers. Six-probe samples
measured 49.4 ms mean box RTT before and 51.5 ms with SSH open, with zero
adapter errors; unrelated application traffic is included.

The reusable case study and low-volume measurement tool are in
[`ops/x0x/LAPTOP-NETWORK.md`](../../ops/x0x/LAPTOP-NETWORK.md).
Real expiry and installed-entry-point checks passed. Four offline lifecycle
checks now gate CI. The laptop tunnel was left down after testing.

## P1 — voice workload could consume parallel workers and login-user authority — REPAIRED

Baseline `ops/voice-scribe/voice-scribe.mjs` lines 129–174 increment a counter
and immediately execute each accepted job: up to four concurrent pipelines,
despite the serialized-job claim. `mkdtemp` precedes its cleanup `try`, so a
disk failure leaks capacity. Lines 154–161 spawn ffprobe without a timeout.
The live source matched this baseline byte-for-byte. The old service runs
as the shared `ubuntu` login user with no filesystem isolation or memory cap.

The installed worker serializes jobs and releases capacity on setup failure;
probe output/time and conversion duration are bounded; local media formats
are allowlisted; child exit precedes cleanup. HTTP parsing survives a hostile
Host header. The unit now uses `DynamicUser=voice-scribe`, private runtime
spool, empty capabilities, protected home/read-only system and a 3G memory cap.
Six tests pass. A live signed synthetic speech request returned 200, a
transcript and `audio_deleted:true`; the spool was empty afterward. Public
health returned 200; memory peak was about 1.29 GiB.

**Retained limitation:** the existing NIP-98 policy proves key possession,
not community membership (`voice-scribe.mjs` header and `authorize`). Its
per-key quota can be evaded with new identities. The new worker bounds
simultaneous processing; a product admission policy is still needed before
offering an unlimited public transcription service. The synthetic test's
56-second completion is not a latency guarantee for long notes under load.

## P2 — source/deployment map overstates the mirror and conflates doors — CORRECTED IN BRIEF

- `gh api repos/beehive-nature/buzz/branches` returned no branches;
  contents returned "This repository is empty" and the commit endpoint 409.
  The [2026-08-22 mirror receipt](RECEIPT_ZCODE_BUZZ_MIRROR_2026-08-22.md)
  explicitly deferred the full-code push. A description containing a pin is
  not a preserved source tree.
- Docker metadata identifies the live Buzz image as `ghcr.io/block/buzz:0.2.1`
  on internal port 3000. `ss -lntup` identifies host 8080 as **wallet-relay**.
  antd HTTP binds `172.18.0.1:8082`; only its gRPC 50051 is loopback.
- DNS from the laptop and an explicit 1.1.1.1 query places `skaists.dev` on
  GitHub Pages (185.199.108–111.153). `relay.skaists.dev` and `skaists.buzz`
  resolve to 129.153.202.144. The existing compute receipt correctly names
  `https://relay.skaists.dev/compute` as the service door.

The original briefing remains as historical input with a correction rider.
**Open closure:** populate the intended pinned mirror using reviewed source
and record the actual image digest/source/build recipe for each running
relay. Do not infer that skaists/buzz main, voice-messages, the empty mirror
and the running 0.2.1 image are interchangeable builds.

## P2 — broad CI tokens, moving action refs and scanner log disclosure — REPAIRED IN CODE

`gh api repos/beehive-nature/beehive-nature/actions/permissions/workflow`
returned default workflow permissions **write**. The tests and secret-scan
workflows had no explicit token permissions and used moving action refs.
They now explicitly use `contents: read`; checkout, setup-node, rust-cache
and the Rust-toolchain action are pinned to resolved upstream commit SHAs.

Baseline `scripts/secret-scan.sh` printed the matched content when refusing
hex/PEM material, potentially reproducing a secret in CI logs. It now prints
locations and redaction markers. Synthetic rejection tests prove both tree
and staged-diff modes refuse without echoing matching content.

**Retained limitation:** these scans detect selected shapes, not every secret
format or historic leak. Push CI runs after publication. Main's branch
metadata is unprotected and `rules/branches/main` returned an empty list.
Branch-protection/PR-only policy remains the founder's decision, as the
existing workflow's §7 comments explicitly require. No enforcement is claimed.

**PR verification finding:** after audit commit `f5ccebcd`, push static
[job 101597392565](https://github.com/beehive-nature/beehive-nature/actions/runs/34074323738/job/101597392565)
passed, while PR static
[job 101597397731](https://github.com/beehive-nature/beehive-nature/actions/runs/34074325462/job/101597397731)
failed only the §7 identity step. The PR checkout includes GitHub's synthetic
merge, whose author is not the contributing seat. The workflow now provides
the actual PR base/head refs to the same checker; pushes retain before/sha.
`bash e2e/identity-pr-range.test.sh` creates a real temporary merge graph and
proves the valid contributed range passes, an invalid contributor is refused,
and an unavailable head fails closed. The synthetic merge also fails when
deliberately submitted as the contribution. No identity policy is relaxed.

## P2 — governance HEAD had inherited red formatting CI — FIXED, CI GREEN

`skaists/LOVErnment-DAO` at `dca913306455` passed build and tests but failed
formatting in [run 32360589417](https://github.com/skaists/LOVErnment-DAO/actions/runs/32360589417).
The oldest of five inspected runs had the same failed step. Applying rustfmt
in the isolated governance checkout changed 13 source/test files, with no
new dependency or enabled live integration test.
Commit `e51d0af` passed the full existing Linux workflow in
[run 34073115670](https://github.com/skaists/LOVErnment-DAO/actions/runs/34073115670).
Its own dispatch is `docs/dispatches/2026-09-06-astra-ci-format.md` in that repo.

The separate `skaists/buzz` snapshot has successful core CI plus failed
publishing/image jobs. Those are recorded in the inventory and are not
misrepresented as a failure of every core test. Release credentials and
fork-specific publication policy need a separate owner-scoped review.

## P2 — license and production-readiness boundaries need an explicit matrix — OPEN

API badges are not sufficient: the monorepo root LICENSE is Apache text;
NOTICE scopes named paths, excludes `scripts/buzz-meter` to its separate
Business Source License and leaves other paths for founder rulings; the Rust
workspace declares AGPL-3.0-only. bnri-cosmic and several holdings have AGPL
root text. Several original repos lack a root license file. attestation-core's
Apache file is an abbreviated notice while its MIT text is present.

Raw bytes/hashes at captured HEADs are in the inventory. **No new component
has been certified adoptable**, and no terms were rewritten. Closure needs
the existing L-VERIFY procedure and a path/component/source/deployment matrix,
not a mass LICENSE replacement.

`contracts/vending/src/vending.cpp` explicitly retains its Jungle4 rehearsal
and founder-gated mainnet deployment. The watch runbook labels its payment
path a POC; commercial media authorization remains a readiness gate. No
production payment-enforcement claim is made. Exploitable findings follow
`SECURITY.md`'s private handling before publication of details.
No chain action or customer transaction was executed in this audit.

## Network controls and deliberate states verified

`sudo iptables-save` shows an IPv4 INPUT chain with ACCEPT policy followed
by explicit allowed traffic and a terminal REJECT. Calling the policy itself
"default-REJECT" is imprecise; the effective terminal rule supplies the deny.
The public TCP doors are 22, 25, 80, 443, 7880, 7881 and 8080; UDP doors
include 3478, 7882 and 5483. Bridge-only TCP doors cover 8082 and 8090–8094.
Docker-published 80/443 use NAT/FORWARD chains; the audit examined those too,
rather than assuming host INPUT filters every container.

`sudo ip6tables-save` has permissive INPUT and `ip -6 address show scope
global` returned none. This is latent exposure to reconcile **before** adding
global IPv6, not a demonstrated currently reachable IPv6 service. `enp0s6`
MTU is 1500. SSH password and keyboard-interactive authentication are disabled.

x0x is active at 0.41.3 with 28 peers, MemoryMax 512M, MemoryHigh 384M,
TasksMax 64, strict filesystem protection and empty capabilities. The exec
ACL file is absent. The production invite environment was checked in memory:
`ROTATE_DRY_RUN=1`, owner key absent; the dry-run design remains intact.
The throwaway rotation stack is loopback-published. Both production relays,
Postgres, Redis and MinIO reported healthy. One-shot MinIO init containers
are exited, which is not the same as a failed service.

The OCI any/any ingress remains documented as a deliberate fragmented-PQ
handshake exception. Latest release metadata still names x0x v0.41.3.
No rule was tightened, and no independent live OCI verification or binary
dependency attestation is claimed; the attempted release Cargo.lock read was
404. Retire only against the existing ant-quic ≥0.27.49 release criterion.

## Secret locations and recovery ownership

Only names/locations, permissions and presence were inspected. Values remain
on their original systems.

| Material | Located at / evidence | Rotation or recovery boundary |
|---|---|---|
| SSH key | WSL SSH alias references `~/.ssh/oracle_key` | Keep in WSL; use the owner's existing SSH access/recovery procedure |
| Relay environment | `/opt/buzz/deploy/compose/.env`, `/opt/buzz-bn/deploy/compose/.env`, mode 0600 ubuntu | Inventory signing identity versus replaceable service credentials before rotation |
| Invite credentials | `/opt/invite-rotate/secrets/{prod,test}.env`, 0600 ubuntu | Prod owner key absent; cutover remains founder-gated per runbook |
| x0x durable API token | `/var/lib/x0x/data/api-token`, 0600 x0x | API sessions and node identity are distinct; identity replacement is not routine token rotation |
| Compute key | `/etc/buzz-compute/api.key`, 0600 root | Coordinate gate/client rollover; no value inspected or changed |
| Watch stream credentials | `/etc/buzz-watch/live.env`, 0600 root | Existing watch runbook owns stream/meter credential lifecycle |
| Agent environment | `/etc/buzz-bclaude/bclaude.env` from EnvironmentFiles metadata | Rotation procedure not exercised; keep owner review tied to relay identity |

## Acceptance gates for the next production sign-off

1. Demonstrated restore onto an isolated target and a stable disk reserve above
   the founder's ten-GB requirement; recover bitcoind without sacrificing relay state.
2. Live OCI security-list/NSG and backup-policy evidence, preserving the
   fragmentation exception until its documented release trigger is met.
3. Immutable deployment inventory: source ref, binary/container digest,
   build recipe, service owner, ports, secret locations, rollback and health
   check for every operational service. The audited voice/x0x files provide
   a starting point; a Caddy door list alone is insufficient.
4. Explicit license and readiness matrix; keep conceptual/governance/testnet
   claims behind their existing gates. Add deeper contract/crypto review
   against named source functions and adversarial tests before stronger claims.
5. Decide protected-branch policy and public-service admission/metering rules;
   verify the chosen rules with negative controls and recovery tests.

The repairs in this dispatch improve actual running behavior. These open
gates remain visible; green CI alone does not close them.
