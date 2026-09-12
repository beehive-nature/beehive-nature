# Autonomi fence readiness — the pinned runbook

**Seat:** z1.c (BNR Autonomi dependency/readiness seat), 2026-09-12.
**Docket:** assignment 3 of `docs/dispatches/2026-09-12-zcode-takeover.md`
(e3373634). Returned to Astra on issue #10.
**Law of this runbook:** everything below is READ-ONLY observation plus
owner-executable candidates. This lane changed no systemd unit, upgrade
channel, signing key, network door, or deployed binary. Every claim is
either VERIFIED with a citation or explicitly marked UNTESTED/ASSUMPTION.

Why this exists: the takeover docket ruled the reported "v0.18.1 / 5fb04fd
pin, v0.19 canary-only" policy a *candidate* policy, not installed-state
evidence. This runbook converts that report into verified state, separates
the version axes the report blurred, and gives the owner exact pins, tests,
and rollback.

---

## 1 · The version matrix — five axes, never conflated

| axis | what it actually is | verified state (2026-09-12) |
|---|---|---|
| **Node** (production storage node on the box) | `ant-node`, the farmer/validator binary | **0.18.1**, running since 2026-09-04 (PID 15409), fenced at `/mnt/ant-store/data/node-2/` — see §2 |
| **Node manager CLI + supervisor daemon** | `ant` 0.3.6 (`ant node daemon run`, PID 3889673) from the ant-node CLI distribution; the daemon in `ant-core` supervises and restarts nodes | manages node 2 via `~/.local/share/ant/node_registry.json`; registry `upgrade_channel: null` → node default = stable |
| **Client/crate** (member-write harness `ops/ant-extsig`) | `ant-core` 0.8.1, git dep on `WithAutonomi/ant-client` | resolved at rev `969ed008` (2026-09-02, "promote rc" merge) in the box's `~/ant-lane/ant-extsig/Cargo.lock`; **in-tree `Cargo.toml` has NO rev pin** — HEAD has already drifted to `c63ca687` (§6) |
| **Protocol** | `ant-protocol` (wire/storage semantics; carries the saorsa-core lineage) | **2.3.5** — harness pin, ant-node v0.18.1's own pin, AND the newest upstream release: the three agree today |
| **Buzz Relay** (`relay.skaists.dev`) | our `skaists/buzz` fork (Nostr relay) | box checkout `088a677f`; the deployed prod binary's receipt is fork `@eeb252286` (order D, `2026-09-05-order-d-join-event.md`). **Zero autonomi/ant/saorsa deps** in its `Cargo.toml`/`Cargo.lock` (grep empty, verified on the box clone). The relay's version is INDEPENDENT of every ant-node version. `relay.skaists.dev` is not, and never was, an ant-node version oracle. |

The browser read door `antd` (REST+gRPC gateway for Autonomi, `~/ant-lane/antd`,
bound `172.18.0.1:8082` REST / `127.0.0.1:50051` gRPC) is a sixth, harness-side
axis: **0.12.0, build_commit `8378338ca04d`**, `/health` → `status ok,
evm_network arbitrum-one`, uptime ≈ 8 days (started with the lane, 2026-09-04).

x0x transport (`ant-quic` 0.27.49/0.27.50, the RFC9000 §14 fix line) is a
**separate stack** (saorsa-labs/x0x), tracked by the x0x lane — it shares
lineage with the node's transport but no version coupling to ant-node 0.18.1.

## 2 · Reported policy vs verified state

The reported candidate policy came from the founder's pasted summary of a
Grok/Chief "newer Autonomi fence draft". **That draft was NOT FOUND** — this
lane searched: all `grok/*` and `cursor/*` branches (git grep for fence /
5fb04fd / ant-node markers), the Grok worktrees' untracked files
(`wt-grok-social-slice`, `wt-grok-bloom-pack`, `wt-grok-campaign-pack` — they
hold campaign art and a captured upstream ADR-0008 copy, no fence runbook),
all commits on all branches since 2026-09-08, and the box home. The
**actual, existing fence artifacts** are the committed pair:
`ops/ant-node/fence.md` (the 2026-09-04 volume fence, @fb18e18f) and
`ops/ant-extsig/` (the member-write harness, @147854c), plus the eco-sweep
verdict (@8d42da28). Nothing newer exists to recover; recreating a "newer
draft" would have fabricated it. The founder's summary is direction — and it
happens to check out, as follows:

| reported | verdict | primary-source evidence |
|---|---|---|
| "v0.18.1 pin" | **VERIFIED as installed production state** | running process cmdline `/mnt/ant-store/data/node-2/ant-node --rewards-address 0x6797…386c … --stop-on-upgrade --evm-network arbitrum-one` (ps, PID 15409, start 2026-09-04); `ant-node --version` → `ant-node 0.18.1`; registry `"version": "0.18.1"`; running binary digest = `ac7e6ab133db12e9…` PUBLIC-CONSTANT (sha256, full value §4), byte-identical to the CLI cache copy |
| "5fb04fd" | **VERIFIED — it is the commit the `v0.18.1` tag points at** | `WithAutonomi/ant-node` git ref `tags/v0.18.1` → commit `5fb04fde5fd1f32ac03a3a687c299ee6b12b93f3` (lightweight tag, ref type=commit; fetched via API 2026-09-12) |
| "v0.19 canary-only" | **VERIFIED** | newest upstream release is `v0.19.0-rc.2` (published 2026-09-09T20:59Z, `prerelease: true`); latest STABLE is `v0.18.1` (2026-09-02T20:25Z). The rc.2 release notes state verbatim: *"This is a pre-release, so it is not installed by nodes on the default `stable` channel. Only `-beta.N` releases are installed automatically, and only by nodes started with `--upgrade-channel beta`. Release candidates (`-rc.N`) are not installed automatically on any channel."* The box's own upgrade monitor agrees: its `releases.json` (fetched 2026-09-12T17:06Z, epoch 1789232809) lists rc.2/rc.1/beta.1 all `prerelease: true`, and the node logged `No upgrade available` |

## 3 · The auto-upgrade law (source-cited, the load-bearing finding)

**There is no disable switch.** `src/config.rs` (UpgradeConfig) exposes
channel / check_interval_hours / github_repo / staged_rollout_hours /
stop_on_upgrade — no `enabled` field. The README's own config example says it
verbatim: *"Upgrades are always enabled; configure behavior here."* The
`ANT_AUTO_UPGRADE=true` line in the README env-var list is documentation
only — `AUTO_UPGRADE` appears nowhere in `src/`. The verified cycle, with
every hop cited:

1. **Poll** — every 1h by default (`default_check_interval() = 1`, config.rs);
   the box node's log receipts it live: check at 2026-09-12T17:06:49Z →
   `No upgrade available` → next check 18:09:26Z.
2. **Select** — GitHub releases of `github_repo` (default
   `WithAutonomi/ant-node`); *"GitHub's own prerelease/latest flags are
   ignored; selection is driven purely by semver on the tag"* (ADR-0010).
   Stable filter = no pre-release component; beta = `-beta.*` only; **rc
   rejected on both channels** (monitor.rs `version_matches_channel`,
   ADR-0010). Our node: registry channel null → default stable.
3. **Stage** — 24h rollout window (`default_staged_rollout_hours() = 24`);
   each node waits a deterministic per-node-ID delay inside it.
4. **Apply** — download platform asset, verify **ML-DSA-65 (FIPS 204)**
   signature (`src/upgrade/signature.rs`; SHA256SUMS + `.sig` assets +
   `ant-keygen` per release notes), replace the running binary **in place**
   (ours lives inside the fence: `/mnt/ant-store/data/node-2/ant-node`),
   exit — cleanly on Unix.
5. **Restart** — the `ant` daemon supervisor detects the exit + on-disk
   version drift vs registry and **respawns directly into the new binary —
   "no backoff, no crash counter"** (ant-core
   `src/node/daemon/supervisor.rs`, `monitor_node_inner`: the
   `is_upgrade_restart_exit_code` → `extract_version(binary_path)` drift
   check → `respawn_upgraded_node` path, incl. the RESTART_EXIT_CODE=100
   const doc: Unix exits 0, Windows 100).

**Consequence (the readiness clock):** when v0.19.0 (or any newer STABLE)
lands on GitHub, this box upgrades itself — no sign-off, no seat in the loop
— within ≤ ~25h of the tag. `--stop-on-upgrade` on our cmdline does NOT
prevent this; it only selects who restarts (the ant daemon, which does,
verified above). The member-write harness pins ant-node 0.18.1 +
ant-protocol 2.3.5 + ant-core@969ed008: after any node auto-upgrade the
harness MUST be re-receipted before its proofs are cited (ADR-0004/0008
moved pricing to commitment-bound quotes — the eco sweep's "never mix old
client + new nodes, payments destroyed" law).

**Owner options for holding 0.18.1 (candidates only — none executed):**
- **A. Accept-and-receipt:** do nothing; on the first stable drop, re-run
  §5's battery + the harness devnet proof against the new node. Zero
  action now, silent breakage risk later.
- **B. Supported hold via release-source pin (cleanest):** point
  `[upgrade] github_repo` at an estate-controlled fork that never publishes
  a newer stable (e.g. `beehive-nature/ant-node-hold`, containing only the
  v0.18.1 release). Field is first-class in UpgradeConfig; the monitor then
  polls our fork hourly and finds nothing. Change shape: add
  `/mnt/ant-store/data/node-2/config.toml` with `[upgrade]` section (or a
  registry `env_variables` entry) + node restart — a production change for
  the responsible owner under the receipt/rollback process, not this docket.
- **C. Accept-and-freeze via supervision:** stop_on_upgrade is already
  true; a variant is moving the node out of `ant node daemon` supervision
  into a plain systemd unit WITHOUT `Restart=` on upgrade exits. Most
  invasive; listed for completeness.

## 4 · Exact artifact pins

Upstream (fetched 2026-09-12 via GitHub API):

- tag `v0.18.1` → commit `5fb04fde5fd1f32ac03a3a687c299ee6b12b93f3`
- release assets: `ant-node-cli-linux-arm64.tar.gz` (+`.sig`, ML-DSA-65),
  `SHA256SUMS.txt` — artifact-verify path: `ant-keygen verify` with the
  release-signing key (release notes, v0.18.1/v0.19.0-rc.2)
- `ant-protocol` latest release: `v2.3.5`
- `ant-client` HEAD: `c63ca68793bfc7e6348fcbe5812ceba21e0f1cb8` (drifted
  past the harness rev, §6)

On-box installed binaries (sha256, read-only):

```
ac7e6ab133db12e9b1b98a2315a67c3f775813aa08f04da905809bc7e24c28af  /mnt/ant-store/data/node-2/ant-node        PUBLIC-CONSTANT (running node 0.18.1)
ac7e6ab133db12e9b1b98a2315a67c3f775813aa08f04da905809bc7e24c28af  ~/.local/share/ant/bin/ant-node-0.18.1      PUBLIC-CONSTANT (CLI cache copy — byte-identical)
1cc3b4b9997e7344b92ed17cccf44324fa1aa1d8ac6e4d891fa7f3a0eab32cd8  ~/ant-lane/antd                            PUBLIC-CONSTANT (gateway 0.12.0, build 8378338ca04d)
f66ad25076a50ce471a94220dfcd239e78b7adbe12781cef010b56adfca75086  ~/.local/bin/ant                           PUBLIC-CONSTANT (manager CLI 0.3.6)
```

Harness crate pins (box `~/ant-lane/ant-extsig/Cargo.lock`, the honest pin
until the in-tree pin lands): `ant-core 0.8.1` @ git
`969ed008d9cd39bbfe6466bc5ff7943914565994`, `ant-node 0.18.1`,
`ant-protocol 2.3.5`.

## 5 · Readiness observation battery (bounded, read-only, box)

Every command below was run this lane; expected shapes are from today's
receipts. `wsl -e ssh oracle` first; no command mutates.

```
ps aux | grep -E 'ant-node|antd' | grep -v grep        # node + daemon cmdlines (channel/flags are ON the cmdline)
/mnt/ant-store/data/node-2/ant-node --version          # -> ant-node 0.18.1
cat ~/.local/share/ant/node_registry.json              # version, upgrade_channel, binary_path, data_dir
cat ~/.local/share/ant/upgrades/releases.json | head -c 400   # what the monitor fetched + when (fetched_at_epoch_secs)
grep -h -E 'upgrade' /mnt/ant-store/logs/node-2/logs/ant-node.$(date +%F).log | tail -5
                                                        # -> "No upgrade available" + next-check time
curl -s -m 3 http://172.18.0.1:8082/health              # -> antd version/build/evm_network/uptime
df -h / /mnt/ant-store                                  # fence + root floors (see §7)
sha256sum /mnt/ant-store/data/node-2/ant-node ~/.local/share/ant/bin/ant-node-0.18.1   # pin equality
git ls-remote https://github.com/WithAutonomi/ant-client HEAD   # client drift vs 969ed008
```

## 6 · Compatibility checks and bounded tests

- **Client-drift check (ran this lane):** `git ls-remote …/ant-client HEAD`
  → `c63ca687…` ≠ banked `969ed008…`. The in-tree
  `ops/ant-extsig/Cargo.toml` declares `ant-core = { git = … }` with **no
  rev** — a fresh `cargo` resolution today silently pulls different client
  code. Recommended fix for Astra (one line): add
  `rev = "969ed008d9cd39bbfe6466bc5ff7943914565994"` to the ant-core dep,
  re-lock, commit the lockfile. Until then the box's Cargo.lock is the only
  pin — never delete `~/ant-lane/ant-extsig/Cargo.lock`.
- **Member-write proof (banked, NOT re-run this lane — named skip):** the
  8-node LocalDevnet + Anvil external-signer flow (`ops/ant-extsig/src/main.rs`)
  was proven 2026-09-04 (PREPARE → member pays → client destroyed → fresh
  client resumes with NO new quote; receipts @147854c). Re-run trigger: any
  node-version change on the box, any ant-core bump, or the first v0.19
  stable. Command shape is in `ops/ant-extsig/README.md`; needs `anvil` on
  PATH + ~1.2 GB free disk — **do not run on the box today** (root is below
  its floor, §7).
- **Read-path probe:** `curl http://172.18.0.1:8082/v1/data/public/<hex>` —
  the lane's genesis DataMap address is in the @147854c receipt; unknown
  addresses return the typed "DataMap chunk not found" after a real network
  query. The `--cors` origin-echo law and the browser-client nonexistence
  (ant-browser-sdk empty; five vendor PRs pending since 2026-09-01) stand
  unchanged — see the eco sweep and `ops/ant-extsig/BROWSER-PATTERN.md`.

## 7 · New risks found (owner attention; NO action taken this lane)

1. **Root free space is BELOW the fence's own floor.** The fence was ruled
   "≥ 10 GB stays free for the hive" (fence.md). Today: `/` has **8.4 G
   free (82% used)**, down from 22 G on 2026-09-04 (~13.6 G growth). Visible
   contributors: `/tmp` 1.1 G, `/var/lib/docker` 2.9 G (watch-room
   renditions era), home ≈ 7.5 G of which the dense 5.3 G `ant-store.img`
   is the fence itself. This feeds issue #4 (recovery inventory + disk
   capacity). UNTESTED: what specifically grew — not attributed this lane.
2. **The fence volume is 93% full and node participation has PAUSED.**
   `data.mdb` = 5.37 G with mtime 2026-09-04 16:08 (no growth since install
   day; `lock.mdb` is actively written) — the store filled the 5.9 G volume
   and the node's ~0.49 G reserve law stopped further PUTs. The fence is
   doing its job (the hive is protected); "participation, not revenue"
   simply means the 6 G fence is too small for the store's appetite.
   Owner options per fence.md law: resize upward (unmount + `truncate` +
   `resize2fs`) or accept the pause. Logs (93 M, daily-rotated, 9 files)
   share the volume — keep an eye on them.
3. **The auto-upgrade clock (§3)** — no disable switch exists upstream; a
   hold requires option B (or C) as a deliberate production change.
4. **The unpinned ant-core git dep (§6)** — one-line fix recommended.

## 8 · Rollback (owner-executed; nothing here requires this lane)

- **Node binary rollback:** the CLI cache copy
  `~/.local/share/ant/bin/ant-node-0.18.1` is byte-identical to today's
  running binary (digest §4) — a verified restore source. Rollback shape:
  stop node via `ant` CLI → copy the cached 0.18.1 binary over
  `/mnt/ant-store/data/node-2/ant-node` (or point the registry
  `binary_path` at the cache) → restart. Identity is preserved by NOT
  touching `/mnt/ant-store/data/node-2/node_identity.key` or any store
  file. The upgrader's own cache lives in `~/.local/share/ant/upgrades/`
  (releases.json + locks); prior binaries may also exist there after a
  future upgrade.
- **Never:** delete `/mnt/ant-store` or the `ant-store.img` fstab entry
  (loop,nosuid — survives reboot); delete
  `~/ant-lane/ant-extsig/Cargo.lock`; run `ant update` casually (CLI
  self-update path — its exact behavior UNVERIFIED this lane; treat as a
  production change); delete devnet spills under
  `~/.local/share/ant/nodes/` only (64-hex dirs — those ARE safe on sight,
  per fence.md).
- **antd rollback:** standalone binary `~/ant-lane/antd`, no systemd unit —
  restart shape is the live ps cmdline (`--cors --rest-addr
  172.18.0.1:8082 --grpc-addr 127.0.0.1:50051`), digest banked in §4.
- **Buzz Relay:** no Autonomi coupling (§1) — nothing in this runbook can
  affect it; its own rollback lane is order D's.

## 9 · x0x field-work separation (per docket)

David Irvine's #505/#622 field requests are a DIFFERENT lane with an
existing owner — the zCode measurement seat — and are **closed as of
2026-09-11 by the founder's read**: David's ask was satisfied via upstream
saorsa-labs/x0x **#651 (merged 2026-09-11T16:30Z)**; our fork PR was
superseded; no outstanding request remains. Current upstream state
(read-only, this lane): #505 open, last activity 2026-09-11T14:39Z (before
the #651 merge); #622 open, last activity 2026-09-11T00:16Z; both quiet
since. The runner tooling (`scripts/x0x-622/`, @e1a8d3c6) and
SPEC-X0X-622-CAPTURE-1 remain reusable if the founder ever orders a live
capture. This Autonomi lane ran NO mesh node, NO capture, and NO laptop
daemon — coordination = this paragraph.

## 10 · Sources

- Box receipts (this lane, 2026-09-12 ~17:0x UTC): ps/cmdlines, registry,
  releases.json, node logs, `/health`, digests, df/du — quoted in-line.
- `WithAutonomi/ant-node` @ main + tag v0.18.1 (5fb04fd…): `src/config.rs`
  (UpgradeConfig, defaults 1h/24h/stable, "always enabled" README section),
  `src/upgrade/monitor.rs` (`version_matches_channel`: rc rejected on both
  channels), `src/upgrade/mod.rs` (auto-apply pipeline, ML-DSA, RESTART
  exit), `README.md` (--stop-on-upgrade semantics, exit 100, config
  example), `docs/adr/ADR-0010-beta-upgrade-channel-semantics.md`
  (semver-only selection), v0.18.1 + v0.19.0-rc.1/rc.2/beta.1 release pages
  (dates, prerelease flags, Auto-Upgrade note).
- `WithAutonomi/ant-client` @ main: `ant-core/src/node/daemon/supervisor.rs`
  (RESTART_EXIT_CODE const; `monitor_node_inner` upgrade-drift respawn).
- Estate: `ops/ant-node/fence.md`, `ops/ant-extsig/` (README, Cargo.toml,
  BROWSER-PATTERN.md), `docs/specs/SPEC-AUTONOMI-TREZOR-1.md`,
  `docs/dispatches/2026-09-12-eco-adaptor-sweep.md`, order-D dispatch,
  `2026-09-10-david-irvine-followup.md`, takeover docket e3373634.
- saorsa-labs/x0x issues #505/#622/#651 (states + timestamps via API).
