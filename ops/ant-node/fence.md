# ant-node store fence — the hive outranks the node (2026-09-04)

Founder order: disk at 98–100% endangers the hive; cap the node's storage
so ≥ 10 GB stays free; participation, not revenue. Receipt = `df -h` after,
node still running and recovering its routing table.

## Why the fence is a volume, not a flag

ant-node 0.18.1 has **no max-storage flag** (every env var in the binary
enumerated: `ANT_ROOT_DIR/PORT/BOOTSTRAP/CACHE_CAPACITY/…` — nothing bounds
the store). The storage handler fills the filesystem down to a ~0.49 GiB
reserve — on a single-volume VPS that means "eat the hive's disk." The VPS
has one disk (46.6 GB, single root partition) — no dedicated volume exists,
so we MADE one: a 6 GiB ext4 loop image is the node's world now. The
filesystem IS the cap.

## What was done

1. **Reclaimed 22 GiB**: devnet spill dirs (16 peer-id dirs under
   `~/.local/share/ant/nodes/`, ~1 GB), `~/src/target` 8.3 GB (relay build
   cache — rebuildable), `~/ant-lane/ant-extsig/target` 2.8 GB, npm cache,
   probe node_modules. The old 9.3 GB `chunks.mdb` was retired with the old
   node (trim per the order — participation resumes on the bounded store;
   the network re-replicates what we dropped, it is not data loss to anyone
   but our own reward ledger).
2. **The fence**: `truncate -s 6G ~/ant-store.img` + ext4 + loop-mount at
   `/mnt/ant-store`, **fstab entry added** (`loop,nosuid` — survives reboot).
3. **Node re-homed**: `ant node add --rewards-address 0x6797…386c
   --data-dir-path /mnt/ant-store/data --log-dir-path /mnt/ant-store/logs`;
   the node's **identity key preserved** (same peer identity), old registry
   entry dismissed.

## The receipt (2026-09-04T15:41Z)

```
/dev/sda1        45G   23G   22G  52% /              <- 22 GiB free (≥ 10 required)
/dev/loop2       5.9G  100M  5.5G   2% /mnt/ant-store <- the node's whole world: 6 GiB
```

- node2 0.18.1 **Running** (PID 15409) on the bounded volume
- **routing recovery proven the hard way**: node STOPPED, restarted, and the
  close-group cache rewritten at 15:41:25 (29 s before the read) with **20
  peers** — recovery, not a stale file
- the store (83 MB and growing) can never exceed 5.9 GiB; the worst case
  leaves 45.6 − 23 − 6 ≈ **16 GiB free** for the hive forever

## Operations law

- `ant-store.img` is sparse-capable but ext4 preallocation makes it dense —
  its 6 GiB is committed; resize ONLY downward-never while mounted, upward
  via `truncate -s` + `resize2fs` if the founder ever rules a bigger fence.
- The old `~/.local/share/ant/nodes` path is dead; the daemon registry knows
  the new home. Devnet spills (any 64-hex dir under `nodes/`) are safe to
  delete on sight — they are LocalDevnet leftovers, not the production node.
