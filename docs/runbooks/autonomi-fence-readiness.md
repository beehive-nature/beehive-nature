# Autonomi fence readiness — the pinned runbook

**Seat:** z1.c (BNR Autonomi dependency/readiness seat), 2026-09-12.
**Revision 3** — observation script made FAIL-CLOSED per Astra integration
review of e220dfcc ([#10 comment 5647673959](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647673959)):
raw fallbacks and argv output removed, all output through schema-validated
projections, local secret-canary test suite added (28/28). Revision 2
([#10 comment 5647564848](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647564848))
corrected: field-work closure (§9), installed-version-vs-enforced-pin
separation (§2–3), conditional scheduling bound to installed revisions,
participation claims re-based on direct node diagnostics (§7), rollback
hardened (§8), search and lockfile limits (§6).
**Law of this runbook:** READ-ONLY observation plus owner-executable
candidates. No systemd, upgrade-channel, signing, network, or binary change
was made by this lane. Every claim is VERIFIED with a citation bound to the
installed source revision, or explicitly marked UNTESTED/ASSUMPTION.

Why this exists: the takeover docket ruled the reported "v0.18.1 / 5fb04fd
pin, v0.19 canary-only" policy a *candidate* policy, not installed-state
evidence. This runbook converts that report into verified state, separates
the version axes, and gives the owner exact pins, tests, and rollback —
with installed state kept strictly distinct from any tested hold.

---

## 1 · The version matrix — five axes, never conflated

| axis | what it actually is | verified state (2026-09-12) |
|---|---|---|
| **Node** (production storage node on the box) | `ant-node` binary | **0.18.1 observed running** since 2026-09-04 (PID 15409), fenced at `/mnt/ant-store/data/node-2/`. Provenance PROVEN: the running binary's sha256 equals the official `ant-node-cli-linux-arm64.tar.gz` asset of release tag `v0.18.1` (§4). Observation, not an enforced pin — see §3 |
| **Node manager CLI + supervisor daemon** | `ant` 0.3.6 = the `ant-cli` crate in `WithAutonomi/ant-client` | running (PID 3889673, `ant node daemon run`); provenance PROVEN: box binary sha256 equals the official `ant-cli-v0.3.6` aarch64-musl release asset (§4). Daemon semantics cited at that release's source lineage (§3.5) |
| **Client/crate** (member-write harness `ops/ant-extsig`) | `ant-core` 0.8.1, git dep on `WithAutonomi/ant-client` | resolved at rev `969ed008` in the BOX's `~/ant-lane/ant-extsig/Cargo.lock` (reproducible there: `cargo metadata --locked` exit 0). The IN-TREE copy has NO lockfile and floats — §6 |
| **Protocol** | `ant-protocol` | 2.3.5 in the harness lock; ant-node v0.18.1 declares `ant-protocol = "2.3.5"` (Cargo.toml @ tag); latest upstream release is v2.3.5. The three agree today |
| **Buzz Relay** (`relay.skaists.dev`) | our `skaists/buzz` fork (Nostr relay) | box checkout `088a677f`; deployed prod binary receipt `@eeb252286` (order D). ZERO autonomi/ant/saorsa deps in its Cargo.toml/lock (grep, box clone). Independent of every ant-node version; `relay.skaists.dev` is not an ant-node oracle |

The browser read door `antd` (REST+gRPC gateway, `~/ant-lane/antd`, REST
`172.18.0.1:8082` / gRPC `127.0.0.1:50051`) is a sixth, harness-side axis:
**0.12.0, build_commit `8378338ca04d`** (its `/health`), supervised by an
existing watchdog shell loop (observed PID 42487: `pgrep -x antd || setsid
./antd …` — antd restarts if killed; relevant to §8).

x0x transport (`ant-quic` 0.27.49/0.27.50) is a separate stack tracked by
the x0x lane: shared lineage with the node's transport, no version coupling
to ant-node 0.18.1.

## 2 · Reported policy vs verified state

The reported candidate policy came from the founder's pasted summary of a
Grok/Chief "newer Autonomi fence draft". **That draft was not found in the
searched locations**: all `grok/*` and `cursor/*` branches (git grep for
fence / 5fb04fd / ant-node markers), the Grok worktrees including untracked
files (`wt-grok-social-slice`, `wt-grok-bloom-pack`, `wt-grok-campaign-pack`
— campaign art and a captured upstream ADR-0008 copy, no fence runbook),
every commit on all branches since 2026-09-08, and the box home. The
existing fence artifacts are the committed `ops/ant-node/fence.md`
(@fb18e18f) and `ops/ant-extsig/` (@147854c). Absence in those locations is
not proof of nonexistence elsewhere; nothing was recreated either way.

| reported | verdict | evidence |
|---|---|---|
| "v0.18.1 pin" | **VERIFIED as the installed version — NOT an enforced pin.** Nothing holds the node on 0.18.1 except the absence of a newer stable; see §3 | running process + registry `"version": "0.18.1"` + binary sha256 = official v0.18.1 release asset (§4) |
| "5fb04fd" | **VERIFIED — the commit the `v0.18.1` tag points at** | `WithAutonomi/ant-node` ref `tags/v0.18.1` → commit `5fb04fde5fd1f32ac03a3a687c299ee6b12b93f3` (lightweight tag; API 2026-09-12) |
| "v0.19 canary-only" | **VERIFIED** | newest upstream release `v0.19.0-rc.2` (2026-09-09T20:59Z, prerelease) vs latest stable `v0.18.1` (2026-09-02). rc.2 release notes verbatim: *"This is a pre-release, so it is not installed by nodes on the default `stable` channel. Only `-beta.N` releases are installed automatically, and only by nodes started with `--upgrade-channel beta`. Release candidates (`-rc.N`) are not installed automatically on any channel."* The box monitor's own `releases.json` (fetched 2026-09-12T17:06Z) lists all v0.19 entries `prerelease: true`; node logged `No upgrade available` |

## 3 · The auto-upgrade law — bound to the INSTALLED revisions

All file:line citations in this section are at **ant-node tag v0.18.1**
(commit 5fb04fd) unless noted; the supervisor at the **ant-cli-v0.3.6
lineage** (the digest-proven installed manager; release tag → commit
`dbc01ce8`, behavior cross-checked at rev `969ed008` whose ant-cli crate
declares 0.3.6).

**There is no disable switch.** `src/config.rs` (UpgradeConfig) exposes
channel / check_interval_hours / github_repo / staged_rollout_hours /
stop_on_upgrade — no `enabled` field. README @ v0.18.1 line 1023: *"Upgrades
are always enabled; configure behavior here."* The README's `ANT_AUTO_UPGRADE`
env line (line 1006) is documentation only — no such env exists in src. The
installed CLI reaches exactly two upgrade knobs: `--upgrade-channel` /
`ANT_UPGRADE_CHANNEL` and `--stop-on-upgrade` (cli.rs @ v0.18.1:35-42, 131-135;
`into_config` sets only those two, cli.rs:244-246).

The verified cycle, hop by hop:

1. **Poll — jittered ~1h.** Base `default_check_interval() = 1` hour
   (config.rs @ tag:395-397); the loop schedules each next check via
   `jittered_interval(check_interval())` (node.rs @ tag:648-654) — observed
   gaps 16:06→17:06→next 18:09. Check errors log a warning and ride the
   same sleep (node.rs @ tag: `Err(e) => warn!(…)` arm).
2. **Select — semver-only, channel-filtered.** GitHub releases of
   `github_repo` (default `WithAutonomi/ant-node`); *"GitHub's own
   prerelease/latest flags are ignored; selection is driven purely by
   semver on the tag"* (ADR-0010, present at the tag). Stable = no
   pre-release component; beta = `-beta.*` only; **rc rejected on both
   channels** (monitor.rs @ tag:182-185 `version_matches_channel`).
   Registry `upgrade_channel: null` → the daemon's default stable.
3. **Stage — deterministic per-node delay inside a 24h window**
   (`default_staged_rollout_hours() = 24`, config.rs @ tag:399-401;
   rollout.rs @ tag: delay derived from node-ID hash, consistent across
   restarts). While the delay remains, checks log "Upgrade pending,
   rollout delay remaining" (node.rs @ tag).
4. **Apply — ML-DSA-65 (FIPS 204) verified binary self-replacement**
   (upgrade/mod.rs + signature.rs @ tag; release assets carry `.sig` +
   SHA256SUMS, verified with `ant-keygen` per release notes). If the apply
   FAILS, the upgrader **rolls itself back** — `UpgradeResult::RolledBack`
   (node.rs @ tag loop; apply.rs @ tag:155-158: *"Returns an error only for
   critical failures where rollback also fails"*) — and retries on later
   checks with a backoff of at least one jittered interval (node.rs @ tag:
   656-665, "avoid a tight loop").
5. **Restart — the `ant` daemon respawns the upgraded binary.** ant-node
   exits cleanly after applying (Unix exit 0; Windows RESTART_EXIT_CODE=100,
   apply.rs @ tag:25-30). The daemon's supervisor treats exit 0-or-100 as an
   upgrade-restart candidate **only if the on-disk binary version drifted
   from the registry** — `is_upgrade_restart_exit_code` matches
   `Some(0) | Some(100)`; "A matching code is necessary but not sufficient —
   the caller additionally confirms the on-disk binary version drifted"
   (supervisor.rs @ ant-client 969ed008:954-962). On drift it respawns
   directly into the new binary, "no backoff, no crash counter". The
   supervisor doc also notes the daemon itself **always passes
   `--stop-on-upgrade`** when spawning nodes (supervisor.rs @ 969ed008:957,
   1037-1039) — which is why the flag appears on the box cmdline.

**Consequence — CONDITIONAL, not a guaranteed deadline.** When a newer
STABLE tag publishes, the upgrade lands on this box at the first ready check
after the tag (≈ ≤1h+jitter polling) plus this node's deterministic rollout
delay (∈ the 24h window) plus apply time — **if** every check, download, and
signature verification succeeds along the way. Failed checks push to the
next jittered interval; failed applies roll back and back off ≥ one
interval. So "typically within ~1 day of a stable tag, conditions
permitting; no upper bound under persistent failures." No seat is in the
loop; the harness compatibility consequence is unchanged (any node version
change ⇒ re-receipt the member-write harness before citing its proofs —
ADR-0004/0008 pricing moved to commitment-bound quotes).

**Owner options for holding 0.18.1 — candidates, none executed:**
- **A. Accept-and-receipt:** do nothing; on the first stable drop re-run §5
  + the harness devnet proof against the new node. Zero action now.
- **B. Release-source redirection via `github_repo` — UNTESTED** on the
  installed version, and its reachability is narrower than main suggests:
  `github_repo` exists only as a serde field in UpgradeConfig (config.rs @
  tag:157-158) — there is **no CLI arg and no env var** for it at v0.18.1.
  The only path is launching the node with `--config <file>` whose TOML
  carries `[upgrade] github_repo = "<fork>"` (`NodeConfig::from_file` loads
  the full config, cli.rs @ tag `into_config`) — and today's daemon-spawned
  cmdline passes no `--config`. Whether `ant` 0.3.6's node-add supports
  passing one is unverified. A hold via B requires a disposable test first:
  on a throwaway host/container, launch the OFFICIAL v0.18.1 binary with a
  `--config` pointing `github_repo` at a repo with no newer stable, and
  observe "No upgrade available" against it (protocol: bounded, no
  production contact, no fork creation needed from this lane). Until that
  test passes for the installed version, B is classified UNTESTED.
- **C. Supervision freeze:** run the node outside `ant node daemon`
  supervision in a unit that does not restart on upgrade exits. Most
  invasive; listed for completeness.

## 4 · Exact artifact pins and provenance

Upstream (GitHub API, 2026-09-12):

- ant-node tag `v0.18.1` → commit `5fb04fde5fd1f32ac03a3a687c299ee6b12b93f3`
- ant-cli release tag `ant-cli-v0.3.6` → commit `dbc01ce8fdbdfe9ac4d064d35f36b4684bf6a616`
- `ant-protocol` latest release `v2.3.5`; `ant-client` HEAD `c63ca687…`
  (drifted past the harness's banked rev — §6)

On-box digests vs official release assets (PROVEN equal this lane — the
tarballs were downloaded and hashed locally, no execution):

```
ac7e6ab133db12e9b1b98a2315a67c3f775813aa08f04da905809bc7e24c28af  box /mnt/ant-store/data/node-2/ant-node == ant-node-cli-linux-arm64.tar.gz(v0.18.1)::ant-node   PUBLIC-CONSTANT (sha256)
ac7e6ab133db12e9b1b98a2315a67c3f775813aa08f04da905809bc7e24c28af  box ~/.local/share/ant/bin/ant-node-0.18.1 (same asset)                                          PUBLIC-CONSTANT (sha256)
f66ad25076a50ce471a94220dfcd239e78b7adbe12781cef010b56adfca75086  box ~/.local/bin/ant == ant-0.3.6-aarch64-unknown-linux-musl.tar.gz(ant-cli-v0.3.6)::ant          PUBLIC-CONSTANT (sha256)
1cc3b4b9997e7344b92ed17cccf44324fa1aa1d8ac6e4d891fa7f3a0eab32cd8  box ~/ant-lane/antd (0.12.0 build 8378338ca04d per /health; release not re-derived this pass)     PUBLIC-CONSTANT (sha256)
```

Harness crate pins (box `~/ant-lane/ant-extsig/Cargo.lock`): `ant-core 0.8.1`
@ git `969ed008d9cd39bbfe6466bc5ff7943914565994` (ant-cli crate at that rev
declares 0.3.6), `ant-node 0.18.1`, `ant-protocol 2.3.5`.

## 5 · Readiness observation battery (fail-closed, allowlisted, read-only)

Use `docs/runbooks/autonomi-observe.sh` (revision 3, hardened per Astra
review #10/5647673959). Its output law: **only explicitly approved fields
are printed — process identity as pid/comm/elapsed with argv and
environment never read into output; registry/monitor/health values only
through schema-validated jq projections that drop unknown fields by
construction; log signals only as extracted named values (counts, a
timestamp, the two refusal numbers), with unparseable lines omitted rather
than echoed; no raw fallbacks — any parse/schema failure or missing tool
yields one generic diagnostic and a nonzero exit, never the source input
or parser errors.** Input locations are env-overridable for local tests
only (`OBS_*`; `OBS_JQ` exists solely to exercise the missing-tool path).

The companion suite `docs/runbooks/autonomi-observe.test.sh` proves the
law locally with synthetic fixtures and secret canaries (ZCANARY…) planted
in unknown registry/health/release fields, process arguments, `--version`
output junk, malformed registry/health JSON, a missing jq, and a changed
log shape — asserting canaries never reach stdout/stderr, failures are
visible and nonzero, and approved fields survive: **28/28 pass** (receipt
in the r3 dispatch). Run it anywhere bash+jq exist:
`bash docs/runbooks/autonomi-observe.test.sh`.

Rev 2 of the script was also receipted against the box (read-only) before
hardening; its observed values stand as the 2026-09-12 receipts quoted in
this runbook (registry node 2 → version 0.18.1, channel null; monitor
newest `v0.19.0-rc.2` prerelease / latest stable `v0.18.1`; `No upgrade
available` + jittered next checks; PUT rejections §7). Rev 3 has not been
box-run (not required for this patch); next box run re-receipts the new
output shape.

## 6 · Compatibility checks, lockfile reality, and the in-tree harness

- **Lockfile behavior (inspected, with receipts):** the IN-TREE
  `ops/ant-extsig/` has **no committed Cargo.lock**, and `cargo build`
  there resolves `ant-core` from ant-client HEAD — already drifted
  (`969ed008` → `c63ca687`). `cargo metadata --locked` in a workspace-free
  copy of the in-tree harness FAILS: *"cannot create the lock file …
  because --locked was passed to prevent this"* (cargo 1.98.1) — `--locked`
  guards nothing until a lockfile exists. The BOX copy
  (`~/ant-lane/ant-extsig`) HAS the lockfile and passes
  `cargo metadata --locked` (exit 0) — the banked pins are reproducible
  there and only there today. Additionally the in-tree copy sits under the
  repo-root workspace without being a member ("current package believes
  it's in a workspace when it is not" — cargo error, receipted), which
  breaks plain builds from the repo tree independently of the pin.
- **Candidate fix (separately reviewable; NOT applied — this pass is
  documentation-only):** commit a rev-pinned `Cargo.toml`
  (`ant-core = { git = …, rev = "969ed008d9cd39bbfe6466bc5ff7943914565994" }`)
  plus the resulting `Cargo.lock`, and a workspace exclusion or explicit
  membership so standalone builds work. Any change must respect the
  ops-verbatim law (in-tree = what runs on the box) before deployment.
- **Member-write proof (banked, NOT re-run this pass — named skip):** the
  2026-09-04 LocalDevnet + Anvil external-signer flow (receipts @147854c).
  Re-run trigger: any node-version change on the box, any ant-core bump, or
  the first v0.19 stable. Needs `anvil` + ~1.2 GB free — not on the box
  today (§7).
- **Read-path probe:** `curl http://172.18.0.1:8082/v1/data/public/<hex>`;
  the `--cors` origin-echo law and the browser-client nonexistence stand
  unchanged (eco sweep + `ops/ant-extsig/BROWSER-PATTERN.md`).

## 7 · Disk and participation state (measured; corrected per review)

1. **Root free 8.4 G (82% used) — below the fence's ≥10 G floor.** Down from
   22 G on 2026-09-04. Visible same-day sizes: `/tmp` 1.1 G, `/var/lib/docker`
   2.9 G, home ≈ 7.5 G (incl. the dense 5.3 G fence image). **Today's
   directory sizes do not attribute the ~13.6 G historical growth** — that
   needs the separate bounded capacity inventory the review ordered,
   coordinated with the Watch/media owner (candidate recoverable items with
   ownership/retention evidence; nothing deleted).
2. **Fence volume 93% full; storage-PUT offers are being REFUSED in the
   observed sample windows — direct diagnostics, not file metadata, and
   not a claim about every write path.** Today's node log carries
   recurring `ant_node::storage::disk_precheck: Rejecting PUT before
   payment verification: storage error: Insufficient disk space: 0.40 GiB
   available, 0.49 GiB reserve required…` (16:33–17:38Z receipt window).
   These rejections are ABSENT from the 09-04/05 logs; the exact onset date
   is not bounded this pass. The reported refusals are observations of
   offered PUTs in sampled windows only — they are not generalized into
   proof of zero writes on any path. The `data.mdb` size/mtime (5.37 G,
   2026-09-04 16:08) is retained as a measurement only — it is NOT itself
   a participation signal. The refusal is an operational follow-up for the
   owner (capacity/recovery planning keeps production boundaries and
   coordinates with the Watch/media owner); it is not authority to resize.
3. **Participation is NOT paused overall.** The same logs show daily
   replication-verification and first-audit activity (thousands of pending
   verifications, nonzero ingress-received totals in every daily log
   examined, `capacity_deferred_*=0`), i.e. the node still serves and
   verifies its records while refusing NEW chunks for space. Net: the fence
   bounds new storage exactly as designed; whether that trade stays
   acceptable (vs. an owner-approved resize, per fence.md law) is a founder
   decision. Logs (93 M, 9 daily files) share the fenced volume.
4. **The auto-upgrade clock (§3)** and the **unpinned in-tree ant-core
   (§6)** stand as before.

## 8 · Rollback (owner-executed; UNAPPROVED and UNEXECUTED as written)

- **Binary-only downgrade is NOT a complete rollback.** The store
  (`chunks.mdb`, `paid_list.mdb`) may carry version-coupled format state;
  whether a given downgrade pair is store-compatible is UNVERIFIED per
  pair. A complete rollback needs a **named compatible recovery point**: a
  pre-upgrade copy of the fence's `data/` (and the node identity) taken by
  the owner at approved-upgrade time — none exists today — plus the pinned
  old binary (verified restore sources: the official v0.18.1 release asset
  and the byte-identical CLI cache `~/.local/share/ant/bin/ant-node-0.18.1`,
  §4).
- **Validation requirements after any rollback:** node starts and opens the
  store (no LMDB/format errors in `stderr.log`), `--version` matches,
  routing recovery (close-group cache rewritten, peers), replication cycles
  resume in the daily log, antd `/health` ok, and the harness devnet proof
  re-receipted before any custody claim.
- **Mitigating fact:** a FAILED auto-apply already self-rolls-back
  (`UpgradeResult::RolledBack`, §3.4) — the dangerous window is a
  SUCCESSFUL upgrade followed by incompatibility, which is exactly the case
  that needs the pre-upgrade recovery point.
- **antd:** standalone binary with an observed watchdog loop (§1) — killing
  it will be undone by the watchdog; rollback = replace the binary and let
  the watchdog restart it, or stop the watchdog first (owner action).
- **Never:** delete `/mnt/ant-store`, its store files, or the `ant-store.img`
  fstab entry (loop,nosuid); delete the BOX harness `Cargo.lock`; run
  `ant update` casually (CLI self-update path UNVERIFIED — treat as a
  production change). The hex-named directories under
  `~/.local/share/ant/nodes/` are documented by the harness lane as
  LocalDevnet leftovers, but **names do not establish ownership** — any
  deletion requires owner confirmation of origin, not name-matching.
- **Resize/deletion/downgrade procedures remain unapproved and unexecuted.**

## 9 · x0x field-work separation (corrected per review)

David Irvine's #505/#622 are **OPEN upstream and still request field
evidence** — the estate's lane exit was a local decision, not upstream
acceptance:

- **#505** (open): dirvine's latest comment (2026-09-11T14:39:22Z) reports
  x0x 0.42.0 shipped with ant-quic 0.27.50 and asks the founder
  (@loviswaternakamoto) to *"re-run the OCI / fragment-filtering workload
  against the current bootstraps and report reassembly failures + handshake
  success — that field result is what closes this; the dependency fix alone
  is not accepted as proof."* **An outstanding field request, addressed to
  the founder.**
- **#622** (open): gated on a live public-mesh Leaf capture (human-with-a-
  daemon task; parked by David until Ben/Winston return, 2026-09-10). The
  founder's latest reply (2026-09-11T00:16Z) reports the box healthy on
  0.41.3 with 27 peers, notes `/diagnostics/gossip` lacks the §5
  eligibility fields on that version, and states intent to prepare a
  separate pinned instrumented capture. **No capture has been performed by
  any estate seat** as of this pass.
- **What actually closed:** upstream **#651** (merged 2026-09-11T16:30Z)
  fixed the LOCAL test suites (#641/#642/#648) — related help, NOT the
  field evidence; the earlier framing of it as satisfying #505/#622 was
  wrong and is retracted. The founder's 2026-09-11 pause of OUR measurement
  lane (fork PR superseded, runner tooling `scripts/x0x-622/` @e1a8d3c6 and
  SPEC-X0X-622-CAPTURE-1 preserved) was a local sequencing decision that
  does not close the upstream requests.
- This Autonomi lane ran NO mesh node, NO capture, NO laptop daemon. Any
  future capture is a founder-ordered, separately-owned action.

## 10 · Sources

- Box receipts (2026-09-12, via `autonomi-observe.sh` + direct probes):
  processes, registry, releases.json, node logs (upgrade lines, PUT
  rejections, replication summaries), `/health`, digests, df/du.
- `WithAutonomi/ant-node` **@ v0.18.1** (= 5fb04fd): src/config.rs
  (UpgradeConfig, defaults, github_repo field), src/bin/ant-node/cli.rs
  (upgrade args/envs, into_config, `--config` file load),
  src/upgrade/monitor.rs (channel filter), src/upgrade/apply.rs
  (RESTART_EXIT_CODE, rollback-on-failure doc), src/upgrade/rollout.rs
  (deterministic delay), src/node.rs (jittered check loop, RolledBack/
  backoff arms), README.md:814/966/1006/1023, docs/adr/ADR-0010, release
  workflow (.github/workflows/release.yml — tarball = ant-node +
  bootstrap_peers.toml ONLY), release v0.18.1 assets (SHA256SUMS, .sig).
- `WithAutonomi/ant-client`: ant-cli crate (name=ant, version 0.3.6) @
  969ed008; ant-core/src/node/daemon/supervisor.rs @ 969ed008
  (is_upgrade_restart_exit_code, version-drift confirmation, daemon always
  sets --stop-on-upgrade); releases ant-cli-v0.3.6 (assets incl.
  aarch64-musl tarball); ant-quic lineage via ant-protocol pins.
- Estate: `ops/ant-node/fence.md`, `ops/ant-extsig/` (README, Cargo.toml,
  BROWSER-PATTERN.md), `docs/specs/SPEC-AUTONOMI-TREZOR-1.md`,
  `docs/dispatches/2026-09-12-eco-adaptor-sweep.md`, order-D dispatch,
  `2026-09-10-david-irvine-followup.md`, takeover docket e3373634, Astra
  review #10/5647564848.
- saorsa-labs/x0x issues #505/#622 + PR #651 (states, timestamps, latest
  comment text via API, 2026-09-12).
