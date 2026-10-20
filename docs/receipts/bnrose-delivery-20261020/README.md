# Direct x0x transport on NixOS

Harness commit: `42a306546b0e50d3d10f33b26a09a621f400dfad`, on the separate
x0x `codex/bnrose-direct-delivery` branch. Its example source bytes match the
native build checksum recorded in `preflight.log`.

The fixed measurement matrix is the 24 `r*.json.gz` files. Compression was
round-trip checked against the original JSON bytes. `node analyze.mjs` validates
counts and signature controls and regenerates `summary.json`.

Each process uses two independent peer pairs, three 128-message bursts per
pair, and an 8- or 64-call in-flight limit. Baseline and shadow order alternates
between repeats. In churn trials, pair 0 withdraws its receiver for the middle
burst and reconnects it before the final burst; pair 1 stays online.
The 500 ms send deadline and 500 ms phase settle interval are experimental
parameters. There is no application retry, random mid-flight fault or steady
offered-rate saturation workload.

Every receipt contains attempted message IDs, send outcomes and timestamps,
verified receive IDs and timestamps, signature verdicts, local withdrawal/rejoin
events and transport-generation snapshots. The same process supplies both
monotonic clocks. Baseline and shadow retain ML-DSA verification and locally
bound sender identity. The observer's Replay label is diagnostic: out-of-order
verified messages still count as application delivery. Actual duplicate IDs
are counted separately.

Files:

- `preflight.log`, `final-health.log`: NixOS, load, artifact checksums and
  production health. Checksums are annotated PUBLIC-CONSTANT.
- `build.sh`, `build-launch.sh`, `build.log`: native isolated build procedure
  and log, including preliminary setup failures.
- `lint.sh`, `lint-launch.sh`, `lint.log`: exact example lint and formatting.
- `run-nixos.sh`, `matrix.sh`: executed isolation and comparison procedures.
- `r*.sandbox.log`: non-root, separate loopback-only network admission and
  process results, including rounded systemd CPU/memory/IP accounting.
- `r*.resources.log`: post-exit property reads. CPU/memory/byte properties were
  already released and report unavailable, not zero. Use the rounded sandbox
  log values only with that limitation.
- `smoke-*`: preliminary launcher failure and successful smoke runs, excluded
  from the fixed matrix. The initial launcher lacked the NixOS PATH; no
  benchmark executed in that failed run.

No public peers, user keys, DAO votes, wallet operations or production service
configuration are involved. This is direct x0x NetworkNode transport, not
WebRTC–ANT, the Agent DM API, gossip, WAN capacity or a live mesh. Per-connection
UDP counters are not a global egress metric and must not be summed across
connection generations.
