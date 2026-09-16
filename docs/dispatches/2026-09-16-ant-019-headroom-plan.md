# ANT v0.19 migration headroom — the measurable threshold (2026-09-16)

Founder mission: turn "DO NOT UPGRADE" into **"upgrade becomes safe at ≥ X"**.
Read-only; nothing deleted, resized, or upgraded. Follows
`2026-09-16-ant-019-migration-verification.md` (source mechanics, all
constants cited there).

## The threshold

From the verified source: the copier runs while free space on the storage
partition (our fence loop) stays above **slack 2048 MB + reserve 500 MiB**;
the legacy `chunks.mdb` (5.0G, pinned never-grows) coexists with the file
copy (~live chunk payload; worst case = the mdb size while free-page ratio
is unmeasured); the file store costs ≈ payload (1 file/chunk, negligible
ext4 overhead at ~1 MiB chunks).

**Rule: upgrade becomes safe when free-inside-fence ≥ live_payload + 2.5 G.**

| live payload assumption | free needed in fence | fence size needed (now 5.9G) |
|---|---|---|
| worst case = mdb = 5.0 G | **≥ 7.5 G** (+1 G margin → **8.5 G**) | **13.5 G** (+7.6 G) |
| measured later (see below) | payload + 2.5 G | payload + 7.5 G |

**Concrete trigger: 8.5 GiB free inside /mnt/ant-store (fence grown to
13.5 GiB), OR live payload measured ≤ 3.5 G with the fence at 12.5 GiB.**
Below that, 0.19.0 stays parked; the canary override
(`ANT_MIGRATION_RETIRE_LEGACY=0`) remains the forced-upgrade fallback.

## Why the fence can't grow today (root at 91%)

The fence is `/home/ubuntu/ant-store.img` (6.0G **on root**). Root: 45G,
40.7G used, **4.4G free (91%)**. Growing the fence +7.6G needs root free
≥ ~9G after leaving 1.5G operating margin.

## What can be reclaimed — inventory (all read-only today; classes per the autonomy addendum)

| item | size | class | notes |
|---|---|---|---|
| **`/var/log/syslog` 2.1G + `syslog.1` 1.8G** | **3.9G** | GREEN (logrotate) | uncompressed; **cause: x0xd `ant_quic::send_error` WARN spam — 2.74M lines in the current file alone**; rsyslog rotates weekly/compresses but the spam outpaces it |
| journal vacuum 1.3G → 500M | ~0.8G | GREEN | `journalctl --vacuum-size=500M` |
| apt cache + snap disabled rev + box /tmp test artifacts | ~0.3G | GREEN | `apt-get clean`, `snap remove --revision` old, rm composite/watchdog-test/gate-* scratch |
| **subtotal safe** | **≈ 5.0G** | | root free → ≈ 9.4G |
| vending-probe | 0.9G | YELLOW (owner lane) | excluded from backups; founder call |
| .rustup trim to one toolchain | ~1.0G | YELLOW | keep llama builds working; founder call |
| preserved backup copy `.verified-0330` | 0.4G | YELLOW | after the laptop pull confirms |
| docker "reclaimable 1.5G" | — | NO | all 7 images ACTIVE (fleet); the df figure is shared-layer optimism |

NOT reclaimable: `/var/lib/bitcoin` 6.2G (production chain), the MTP model
2.99G (production rail), qwen2.5-3b 1.9G (bMESHLLM rollback — keep).

## The plan (phased, each with rollback; nothing runs without the founder word)

**Phase A — root cleanup (GREEN + one cause fix, ~5.0G):**
logrotate -f rsyslog + compress syslog.1; journal vacuum; apt/snap/tmp.
**Cause fix:** x0xd log level — one line in the systemd unit
(`Environment=RUST_LOG=warn,ant_quic=error`) + restart x0xd (YELLOW: service
restart, coordinate) — otherwise the spam refills 3.9G in ~weeks.
Rollback: none needed (logs are expendable; config revert restores level).

**Phase B — fence resize 5.9G → 13.5G (RED: filesystem operation, founder
word, node QUIESCED):** stop ant-node (it holds the mdb) →
`truncate -s 13.5G /home/ubuntu/ant-store.img` → `losetup -c /dev/loop0` →
`resize2fs /dev/loop0` (ext4 online-grow; the mount shows loop+ext4) →
verify `df /mnt/ant-store` ≥ 8.5G free → restart node.
Rollback: none downward — shrinking is a separate deliberate step (see D);
before Phase C the rollback is simply "leave it enlarged" (harmless).

**Phase C — optional precision (GREEN):** with the fence enlarged, measure
live payload before upgrading: run 0.18.1's own store stats or open the env
read-only with lmdb tools (`mdb_stat -r`) — refines X from worst-case to
measured; if live ≪ 5.0G the migration will be correspondingly lighter.

**Phase D — post-migration shrink (RED, after `migration complete` logs and
`chunks.mdb` gone):** fence 13.5G → ~8G (file store ≈ payload + 2.5 floor +
margin), returning ~5.5G to root. ext4 shrink requires umount (node stopped).

**Phase E — the upgrade itself (YELLOW):** 0.19.x with the daily watch
armed on fence-free and `migration-state.json` phases; the
`stopped_for_space` log line is the early tripwire that says the threshold
math was wrong.

## Sequence law

A before B (root must have room for the loop file); B before E by the
threshold rule; D only after E completes. **Nothing here executes today** —
this is the plan the founder word triggers.
