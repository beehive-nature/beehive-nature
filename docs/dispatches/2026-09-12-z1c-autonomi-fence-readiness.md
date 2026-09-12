# z1.c dispatch — Autonomi fence readiness, verified not assumed (2026-09-12)

**Lane:** assignment 3 of the zCode takeover docket (e3373634), claimed on
issue #10 ([claim](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647384849)).
**Session/effort:** fresh local zCode GLM 5.3 readiness session; Max for
version/signer/auto-upgrade reasoning, Low for inventory, per the docket.
**Worktree:** `wt-z1c-autonomi-fence`, branch
`zcode/autonomi-fence-readiness-2026-09-12`, base = fetched origin/main
`8d42da28`. **Owned paths:** `docs/runbooks/autonomi-fence-readiness.md`
(new) + this dispatch. No production, systemd, channel, signing, network,
or ops-tree change; no node, capture, or mesh run.

## Deliverable

`docs/runbooks/autonomi-fence-readiness.md` — the pinned runbook: five-axis
version matrix, verified-vs-reported table, the source-cited auto-upgrade
law, exact artifact pins (upstream tag→commit, on-box sha256s, crate revs),
a read-only observation battery, compatibility checks, new risks, and
rollback. Everything verified carries a citation; skips are named.

## What was verified (headline)

1. **The reported policy is CORRECT but was already the installed state,
   not a new pin.** Box production node = ant-node 0.18.1 (running process
   + registry + binary digest + CLI cache copy byte-identical);
   `5fb04fd` = `5fb04fde5fd1f32ac03a3a687c299ee6b12b93f3` = the exact
   commit the WithAutonomi/ant-node tag `v0.18.1` points at; v0.19 exists
   only as rc.2/rc.1/beta.1 prereleases (upstream API + the box's own
   upgrade-monitor `releases.json`, fetched 2026-09-12T17:06Z, agreeing
   `No upgrade available` in the node log).
2. **Auto-upgrade is ALWAYS ON with no disable switch** (README: "Upgrades
   are always enabled"; no enabled/env field exists in src). Cycle verified
   hop-by-hop: 1h polls → semver-only stable filter, rc rejected on both
   channels (ADR-0010, monitor.rs) → ≤24h staged rollout → ML-DSA-65-verified
   binary self-replacement inside the fence → ant-daemon supervisor respawn
   on version drift ("no backoff, no crash counter", supervisor.rs).
   **When a newer stable ships, the box upgrades itself within ≤ ~25h
   unless the owner first lands a hold** — runbook option B (estate-fork
   `github_repo` pin) is the cleanest supported hold; all options are
   owner-executed candidates.
3. **The axes the report blurred are now separated:** node 0.18.1 / manager
   CLI ant 0.3.6 / harness client ant-core 0.8.1@969ed008 / protocol
   ant-protocol 2.3.5 (harness = node = latest release: aligned today) /
   Buzz Relay skaists-buzz (box checkout 088a677f, deployed receipt
   @eeb252286) with ZERO Autonomi crates — relay.skaists.dev was never an
   ant-node oracle. antd = 0.12.0 build 8378338ca04d, /health ok on
   arbitrum-one.
4. **Grok/Chief's "newer fence draft" does NOT exist to recover.** Searched:
   all grok/cursor branches, Grok worktrees incl. untracked files, all
   commits since 2026-09-08, the box home. The real artifacts are the
   committed `ops/ant-node/fence.md` (@fb18e18f) + `ops/ant-extsig/`
   (@147854c). The founder's summary = direction that checked out (§1);
   nothing was recreated.
5. **#505/#622 ownership confirmed, no duplicate:** the zCode measurement
   lane closed it 2026-09-11 — David satisfied via upstream x0x #651
   (merged 2026-09-11T16:30Z); both issues quiet since (read-only check);
   runner tooling e1a8d3c6 remains reusable. This lane ran nothing.

## New risks surfaced (owner attention, untouched)

- **Root free 8.4G < the fence's own ≥10G floor** (22G free on 09-04;
  ~13.6G growth: /tmp 1.1G, docker 2.9G, plus unaudited — feeds issue #4).
- **Fence 93% full; node participation PAUSED since ~install day**
  (data.mdb 5.37G, mtime 09-04; the reserve law stopped PUTs) — the fence
  works; 6G is just smaller than the store's appetite. Resize is an owner
  decision (fence.md law).
- **ant-core git dep is UNPINNED in-tree** and upstream HEAD has drifted
  (969ed008 → c63ca687); one-line rev-pin + lockfile commit recommended to
  Astra. Until then the box's Cargo.lock is the only pin.

## Named skips (not performed)

LocalDevnet member-write proof re-run (banked @147854c; trigger = any node
version change; blocked on box disk anyway); antd read-path chunk fetch
(address in prior receipt; /health sufficed); `ant update` CLI behavior
(treat as production change); attribution of the 13.6G root growth.

## Return

To Astra on issue #10 with this dispatch + the runbook. Integration
decisions left to Astra/founder: ant-core rev pin, fence resize, hold
option A/B/C, disk-floor recovery (issue #4 lane).
