# "Cannot allocate memory" on ARM64 Linux when half the RAM is free — how to read the failing mmap

**The symptom, in the words you'd search for:** a 64-bit program (often one with a large mmap
reservation — a database, a datastore client, a runtime with a big reserved heap) dies with
"out of memory", `Cannot allocate memory`, or `ENOMEM` on an `mmap` call — while `free -h` shows
gigabytes unused. You are not out of RAM. You are almost certainly out of *address space*, out of
*commit limit*, or hitting a resource limit — three different walls that all wear the same error
message.

This article is a **diagnostic procedure**, not a cause announcement. Follow it in order and the
failing wall will identify itself. In particular: whether an ARM64 kernel's virtual-address width
(`VA_BITS`) is the wall on any given machine is **established only by step 5**, never assumed.

## Step 0 — confirm it's the mmap failing

Run the program under strace and look at the tail:

```sh
strace -f -e trace=mmap,mmap2 <your program> 2>&1 | tail
```

A failing call looks like:

```
mmap(NULL, 137438953472, PROT_NONE, MAP_PRIVATE|MAP_ANONYMOUS|MAP_NORESERVE, -1, 0) = -1 ENOMEM (Cannot allocate memory)
```

Write down three numbers from that line:

- the **requested length** (here 137,438,953,472 bytes = 128 GiB);
- the **protection and flags** (`PROT_NONE` + `MAP_NORESERVE` = a pure reservation, no RAM
  backing needed yet);
- whether it is a **fixed-address** request (`MAP_FIXED` with a non-NULL first argument) —
  fixed mappings can fail where a free-range request of the same size would succeed.

A `PROT_NONE|MAP_NORESERVE` reservation of 128 GiB consumes essentially no RAM — it only needs
*address space* to exist. That is why free RAM proves nothing.

## Step 1 — check resource limits (the most common and cheapest wall)

```sh
ulimit -v        # RLIMIT_AS: total address space per process, in KiB
ulimit -a        # see everything
```

If `ulimit -v` is `unlimited`, skip ahead. If it is a number smaller than the requested mapping,
this is your wall — and the fix belongs in the service definition (`LimitAS=` in the systemd unit,
or the launching shell's `ulimit -v unlimited`), not in the kernel. Overcommit policy
(`/proc/sys/vm/overcommit_memory`, checked in step 4) interacts here: mode 2 with a strict
`overcommit_ratio` refuses reservations that mode 0 (heuristic) would allow.

## Step 2 — page size (ARM64 is not uniform here)

```sh
getconf PAGE_SIZE
```

ARM64 kernels boot with either 4 KiB (`CONFIG_ARM64_PAGE_SHIFT=12`) or 16 KiB
(`PAGE_SHIFT=14`) pages. Page size changes how much a given reservation costs in page-table
entries and, on 16 KiB-page systems, effectively halves the reach of the same VA width. Record
the value; you need it when comparing your requested mapping against the address-space ceiling in
step 5.

## Step 3 — read the error correctly

`ENOMEM` from `mmap` means one of: the process is out of address space, `RLIMIT_AS` was hit,
overcommit refused the reservation, or (with `MAP_FIXED`) the requested range was unavailable.
The kernel does **not** tell you which. That is what the remaining steps are for.

## Step 4 — overcommit

```sh
cat /proc/sys/vm/overcommit_memory
```

`0` heuristic (default), `1` always allow, `2` refuse reservations beyond
`(swap + RAM × overcommit_ratio)`. Mode 2 on a machine with little swap refuses large
`MAP_NORESERVE` reservations even though free RAM exists — a frequent mimic of this symptom.

## Step 5 — measure the actual address-space ceiling (VA_BITS)

On ARM64, the width of the user virtual address space is a **kernel build-time constant**:

```sh
# /proc/config.gz first — always matches the RUNNING kernel
zcat /proc/config.gz | grep CONFIG_ARM64_VA_BITS
# fallback: the /boot copy, only valid if it matches the running release
cat /boot/config-$(uname -r) | grep CONFIG_ARM64_VA_BITS
```

- `CONFIG_ARM64_VA_BITS=39` → user address space is 512 GiB
- `=48` → 256 TiB
- `=52` → 4 PiB

If your failing reservation (from step 0) exceeds the ceiling implied by the measured value, you
have your wall — no hypothesis needed, it is arithmetic. If it fits comfortably inside the
ceiling, **VA_BITS is not your problem**; go back to steps 1 and 4.

Two fencing notes on measurement:

- `/boot/config-*` files can lag the running kernel (multiple installed kernels, out-of-range
  fallback picks the wrong one). `/proc/config.gz` is authoritative when present; when absent,
  many distributions ship kernel config in a separate package (`linux-image-*.dbg` or similar).
- If neither source exists, the honest verdict is **unknown**, not pass. Refuse to guess.

**What we are NOT claiming:** that a 39-bit VA kernel is *the* cause of any specific
"out of memory" report. It is one measurable ceiling among several. The procedure above stands
on its own; every cause claim must come from your own step-5 arithmetic against your own step-0
mmap line.

## If step 5 arithmetic does name VA_BITS as the wall

The width is fixed at kernel build and boot time; it cannot be raised at runtime. The remedy is
to run a kernel built with 48-bit (or 52-bit) VA — for example a mainstream distribution arm64
kernel, most of which build 48-bit — or to reduce the mapping's size in software.

## Credits

The ARM64 probe procedure and its output shape were contributed by **TT3**, and the tooling that
automates the VA_BITS/page-size/read-ahead checks with typed Pass/Fail/Unknown verdicts is the
`bmesh-hwfit` preflight probe (landed 2026-08-23). Community diagnostics thread, Beehive Nature
Relay, 2026-08.
