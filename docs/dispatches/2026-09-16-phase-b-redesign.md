# Phase B re-design — the ≥5G-root-free configuration (2026-09-16)

Founder ruling honored: Phase B stays closed; no resize, no upgrade, node
untouched. This pass MEASURED the unknown instead of assuming it, then
priced every configuration against the new target (**≥5 GiB root free
after fence expansion** — not 1.7).

## The measurement that decides everything (FACT, read-only)

`mdb_stat` (installed as `lmdb-utils`, the correct package name on this
Ubuntu — `lmdb-tools` doesn't exist here) against the live env, read-only,
node running:

| stat | value |
|---|---|
| map size | 5,370,179,584 B (5.0 GiB), page 4096 |
| pages used | **1,310,297 / 1,311,079 (99.94%)** |
| **free pages** | **6** — the env has essentially NO free pages |
| overflow pages (chunk data) | 1,310,253 |
| entries (chunks) | **1,548** (avg ~3.3 MiB/chunk) |

**Live payload ≈ 5.0 GiB — the worst-case assumption was the real case.**
There is no "measure-then-grow-smaller" win on root. Fence math is now
exact: fence ≥ legacy 5.0G + copy 5.0G + floor 2.5G = **12.5 GiB minimum,
13.5 GiB with the 1G margin** — as planned, no refinement available.

## Block layout (FACT)

`sda` = 46.6G single boot volume (GPT: sda1 45.6G root + EFI + /boot, **no
spare**); the fence is the fstab loop line
`/home/ubuntu/ant-store.img /mnt/ant-store ext4 loop,nosuid`. **No second
block volume is attached.** Instance shape `VM.Standard.A1.Flex` —
attachable via the OCI console/CLI.

## Configuration pricing vs the ≥5G-root-free target

| config | root free after | verdict |
|---|---|---|
| grow-on-root 13.5G (previous plan) | ~1.7G | REJECTED (founder) |
| grow-on-root 12.5G (no margin) | ~2.8G | fails target |
| reclaims (+2.3G YELLOW) + 12.5G | ~5.0G exactly | zero margin, consumes the bMESHLLM-adjacent reclaims — REJECTED |
| **move fence to a dedicated OCI block volume** | **~15.2G** (root GAINS 5.9G: the loop file is deleted after cutover) | **MEETS the target with the widest margin** |

## RECOMMENDED: Config V — the fence becomes a real volume (natural fence)

The loop-file fence was the right tool when the goal was "stop ANT eating
root." A dedicated volume IS the fence — same isolation, own capacity, and
root gets 5.9G **back**. At ~$0.0255/GiB/mo, a 20G volume costs ~$0.51/mo.

**Steps (all RED-class, founder word, executed in one maintenance window
~10 min):**

1. Founder console/CLI: attach a **20G** block volume (paravirtualized) →
   device appears as `/dev/sdb`.
2. Stop ant-node; verify store quiesced (`mdb_stat -r` clean).
3. `mkfs.ext4 /dev/sdb`; mount at `/mnt/ant-store-vol` (temp).
4. Copy: `rsync -aHAX /mnt/ant-store/ /mnt/ant-store-vol/` (5.1G, ~2 min).
5. Verify: `mdb_stat -e` on the copy matches (pages used 1,310,297;
   entries 1,548); file counts + sizes identical (`du -sh`, `diff -r` fast
   pass optional).
6. Cutover: umount loop; comment the fstab loop line (KEEP the line,
   commented = documented rollback); mount `/dev/sdb` at `/mnt/ant-store`
   via new fstab entry (`nofail` so a missing volume never blocks boot).
7. Restart ant-node; health (peers, version, same identity from
   `node_identity.key`).
8. Only after ≥24h healthy: delete `ant-store.img` (frees 5.9G on root).
   Until then, rollback = umount volume, uncomment fstab loop line, remount,
   restart node.

**Migration headroom under Config V:** the volume is 20G with 5.1G used →
**14.9G free ≥ 8.5G trigger with 6.4G to spare** — the 0.19 migration can
run whenever you say the word after cutover, no further sizing. Root never
participates.

## If a volume is unwanted: the fallback is honest waiting

Without new storage, the only lawful path is: keep 0.19.0 parked (node
healthy on 0.18.1), re-verify the hold-both canary override if an upgrade
is ever forced, and revisit when either root pressure drops (bitcoin is the
only big mover, 6.2G) or a third-release timeline makes parking costly.

## Status

Nothing executed. `lmdb-utils` installed (investigative tooling, 2 packages,
no service impact). ANT remains on 0.18.1; fence remains 5.9G; root remains
9.3G free (80%).
