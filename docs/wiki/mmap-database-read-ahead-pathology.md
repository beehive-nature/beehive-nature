# My database got slower the more RAM the machine had — oversized disk read-ahead on an mmap'd database

**The symptom, in the words you'd search for:** your database is mmap'd (LMDB, or anything built on
memory-mapped files), the machine has plenty of free RAM, disk utilisation is pinned at 100%, and
throughput is terrible — while a machine with *less* memory runs the same workload faster. `iostat`
shows reads far larger than your actual access pattern. Adding RAM or a bigger page cache makes it
worse, not better.

## What is actually happening

An mmap'd database does random point reads through the page cache. The Linux block layer, however,
applies **read-ahead** to sequential-ish access patterns: when it thinks you're scanning, it reads
ahead of you. Read-ahead is sized per block device by
`/sys/block/<device>/queue/read_ahead_kb` (in KiB).

When that number is huge — some storage drivers and desktop-tuned distributions set it to tens of
megabytes — every random 4 KiB point read drags a multi-megabyte read behind it. Your random-read
workload becomes a sequential-scan workload at the device level. On spinning rust or a bus-limited
USB device, that read amplification swamps you.

The counter-intuitive part: read-ahead *feeds the page cache*, which is why a bigger cache can make
it worse — the kernel happily fills RAM with bytes you never asked for, evicting the pages you
actually reuse, while the device stays busy serving amplification.

## The diagnostic, step by step

1. **Find the block device behind your data directory.** `df /path/to/data` gives you the
   mount; `lsblk` maps it to the underlying device. (Partition vs whole disk matters — the queue
   tunable lives on the whole-disk node.)

2. **Read the current read-ahead:**

   ```sh
   cat /sys/block/<device>/queue/read_ahead_kb
   ```

3. **Form the ratio.** Divide `read_ahead_kb` by your workload's access granularity. A
   random-read database touches the machine's page size (4 KiB on most ARM64 and x86_64, 16 KiB on
   Apple Silicon and some ARM64 kernels — check with `getconf PAGE_SIZE`).

   As a working threshold measured and pinned in our node preflight tooling on 2026-08-23:
   **above 1024 KiB is a Fail** for a random-read database workload; the boundary sits exactly at
   1024 KiB (1024 passes, 1025 fails). A `read_ahead_kb` of, say, 65532 KiB against 4 KiB pages is
   a ~16,000:1 read-amplification ratio on every miss.

4. **Corroborate with `iostat -x 1`** while the workload runs: the average request size
   (`rareq-sz`) will be in the read-ahead range, not your access range.

## The fix — and why a restart is required

Cap read-ahead persistently with a udev rule, so it survives replug and reboot:

```
# /etc/udev/rules.d/90-read-ahead-cap.rules
ACTION=="add|change", KERNEL=="<device>", ATTR{queue/read_ahead_kb}="1024"
```

Then reload and trigger:

```sh
sudo udevadm control --reload && sudo udevadm trigger
```

**You must restart the database process afterwards.** The read-ahead window in effect for a file is
captured when the file is opened — a process holding the data files open keeps its oversized
read-ahead behaviour until it closes and reopens them. Verifying the sysfs value shows the new cap
while your still-running process quietly keeps the old behaviour; that gap has fooled people into
"the fix didn't work."

`ATTR{queue/read_ahead_kb}` accepts the value in KiB on the ATTR path (note: writing
`/sys/.../read_ahead_kb` directly takes KiB on older kernels, bytes on some newer ones — the udev
ATTR path is the stable form).

## Credits

The read-ahead finding was made by **storage_guy** in the Beehive Nature Relay community
diagnostics thread (2026-08); this article is the write-up of that finding, with thresholds from
the `bmesh-hwfit` preflight probe (landed 2026-08-23).
