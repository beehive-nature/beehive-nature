# Config V runbook — the ANT fence moves to its own volume (one paste, ~10 min)

Founder-approved architecture (2026-09-16): **dedicated ~20 GiB OCI block
volume becomes the ANT storage fence; the old loop image stays as rollback
for ≥24 h after verified cutover; ANT stays on 0.18.1 through the move;
0.19 only after parity + health are proven.** RED class — executes when the
founder says the volume is attached and the window is open.

Measured facts this runbook is built on (dispatch
`2026-09-16-phase-b-redesign.md`): fence holds 5.1G (chunks env 5.0 GiB,
1,310,297/1,311,079 pages used, 1,548 entries); ant-node is NOT a daemon
(no unit, pid file stale) — the window needs only a process check, not a
service stop.

## PRE-FLIGHT (read-only, run first, abort on any FAIL)

```bash
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT | grep -v loop   # EXPECT: a new ~20G disk (sdb or sdс) with NO mountpoint
pgrep -af 'ant-node' | grep -v pgrep && echo "ABORT: node running" || echo "ok: no ant-node process"
mdb_stat -e /mnt/ant-store/data/node-2/chunks.mdb | grep -E 'Map size|pages used'   # baseline: 5370179584 / 1310297
sudo md5sum /mnt/ant-store/data/node-2/node_identity.key | tee /tmp/configv-id.md5  # identity anchor
df -B1M / | tail -1                                # root free before (expect ~9300M)
```

## THE MOVE (DEV=the new device from pre-flight, e.g. /dev/sdb)

```bash
set -euo pipefail
DEV=/dev/sdb   # <-- SET ME from lsblk
# 1. filesystem on the new volume (the volume IS the fence now)
sudo mkfs.ext4 -L ant-store $DEV
# 2. temp mount + copy (5.1G, ~2 min)
sudo mkdir -p /mnt/ant-store-vol
sudo mount $DEV /mnt/ant-store-vol
sudo rsync -aHAX /mnt/ant-store/ /mnt/ant-store-vol/
# 3. PARITY — every check must match pre-flight before cutover
sudo mdb_stat -e /mnt/ant-store-vol/data/node-2/chunks.mdb | grep -E 'Map size|pages used'   # same numbers
sudo md5sum /mnt/ant-store-vol/data/node-2/node_identity.key   # == /tmp/configv-id.md5
[ "$(sudo du -sm /mnt/ant-store | cut -f1)" = "$(sudo du -sm /mnt/ant-store-vol | cut -f1)" ] && echo "size parity ok"
# 4. CUTOVER
sudo umount /mnt/ant-store
sudo cp /etc/fstab /etc/fstab.pre-configv.bak
sudo sed -i 's|^/home/ubuntu/ant-store.img|#CONFIG-V-ROLLBACK /home/ubuntu/ant-store.img|' /etc/fstab   # keep, commented
echo "LABEL=ant-store /mnt/ant-store ext4 nosuid,nofail 0 2" | sudo tee -a /etc/fstab
sudo systemctl daemon-reload
sudo mount /mnt/ant-store
findmnt /mnt/ant-store | grep -v loop    # mounted from the NEW device, no loop
# 5. POST-CUTOVER parity + the mount survives a boot-mock
sudo mdb_stat -e /mnt/ant-store/data/node-2/chunks.mdb | grep -E 'Map size|pages used'
sudo systemctl restart mnt-ant\\x2dstore.mount && findmnt /mnt/ant-store | head -2
```

## VERIFY + THE 24H LAW

- Health: the founder may start the node on 0.18.1 (identity unchanged —
  `node_identity.key` rode the rsync, md5-anchored). Peers/version via the
  node's own logs; `mdb_stat -r` readers clean.
- The OLD image (`/home/ubuntu/ant-store.img`, 6G on root) is **rollback
  for ≥24 h**: `df /mnt/ant-store` + node health at +24 h, and only then
  `sudo rm /home/ubuntu/ant-store.img` as its own deliberate step (root
  gains ~5.9G).
- The daily watch reads `/mnt/ant-store` free (already armed at ≥93%).

## ROLLBACK (any parity fail or post-cutover doubt, before image deletion)

```bash
sudo umount /mnt/ant-store
sudo cp /etc/fstab.pre-configv.bak /etc/fstab   # restores the loop line
sudo systemctl daemon-reload && sudo mount /mnt/ant-store
findmnt /mnt/ant-store     # loop again; node data exactly as pre-move
```

The volume keeps its copy — nothing to rebuild; the fstab bak restores the
line in one step either way.

## AFTER (separate founder gates, already sized)

With the volume live: free-inside ≈ 14.9G ≥ 8.5G trigger — **ANT 0.19.0
upgrade becomes a plain YELLOW gate** (no storage prerequisite), per
`2026-09-16-ant-019-migration-verification.md`.

---

## HOT UPDATE 2026-09-16 ~19:00Z — official v0.19.0 rollout incorporated

**Release state (verified at source):** `ant-node 0.19.0` on crates.io
(published 2026-09-16T00:29Z, normal release); `ant-cli 0.3.7` crate exists
(downloadable, Cargo.toml confirms). **`ant update` is NOT run** — the order
stands: Config V cutover first, v0.19.0 immediately after.

### The official completion signal (replaces any status-based check)

**Migration is complete when `chunks.mdb` is GONE and a `chunks/` directory
IS present.** Do NOT use `ant node status` as the migration-complete or
enough-space signal — the operator guidance is explicit on this.

### Official operator thresholds (banked as MINIMUM guidance)

| state | free space |
|---|---|
| generally okay | > ~3 GB |
| stalled (migration pauses) | < ~3 GB |
| minimum freeing target | ~3.5 GB |
| working margin | 2.5 GB |

**Our box-specific trigger stays STRICTER** (free-inside ≥ 8.5G / fence
13.5G+): our `mdb_stat` showed the 5 GB LMDB is essentially all live payload
(6 free pages, 99.94%), which is exactly Rusty's "more if a node has a lot
left to move" case. The bare 3.5 GB minimum is NOT our planning target.

### Migration is self-pausing, not catastrophic

The v0.19.0 migration **stops and waits** when disk gets tight
(`stopped_for_space` in the source) — it does not fill the disk. If someone
accidentally upgraded early, it would stall rather than crash. But on our
box that's still needless downtime; Config V prevents it entirely.

### The `ant update` sequence (after Config V cutover passes)

```bash
# 1. Pre-update receipts (preserved)
ant-node --version                              # expect: ant-node 0.18.1
sudo md5sum /mnt/ant-store/data/node-2/node_identity.key   # identity hash
df -B1M /mnt/ant-store | tail -1                # fence free baseline
sudo stat -c '%s' /mnt/ant-store/data/node-2/chunks.mdb/data.mdb   # mdb size
# 2. Update (separate receipt from the node migration — see below)
ant update
ant-node --version                              # new version receipt
# 3. Migration receipts (during migration, log every 60s):
#    df /mnt/ant-store (free space over time)
#    stat chunks.mdb/data.mdb (size)
#    ls chunks/ | wc -l && du -s chunks/ (file count + bytes)
#    node health/peer count (from logs)
#    grep for stop-for-space events
#    exact timestamp when chunks.mdb disappears
# 4. Post-migration reclaim measurement:
df -B1M /mnt/ant-store | tail -1                # actual free after
#    DO NOT ASSUME the beta's 1/3-1/2 reclaim — Rusty says newer/full nodes
#    can reclaim almost nothing. Our LMDB is ~fully live; expect minimal
#    reclaim and record it as evidence.
```

### Separate receipts: node vs client

**`ant-node` v0.19.0** (the migration) and **`ant` CLI** (the client) are
**separate binaries with separate receipts** — `ant update` may update both;
do not let it blur which changed what. Record each binary's version before
and after independently.

### zBlood convergence (noted, separate lane)

Once the zBlood preservation adversarial gate is green, **`ant` CLI becomes
the fresh client baseline for the first real quote/upload/retrieval
receipt**. Keep that separate from the node migration, but timestamp both
into the same 2026-09-16 network-state record.

### Rollback material timeline (unchanged)

The old loop image + the volume's pre-update state are rollback for the
existing **≥24 h verification window** before any deletion. No change to
Config V's own rollback procedure.
