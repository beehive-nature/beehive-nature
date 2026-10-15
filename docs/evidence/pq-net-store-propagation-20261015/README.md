# V3 recovery-intent and deferred IWANT experiment

This is an experimental dependency backport, not a released x0x binary or a
production configuration change. Raw receipts stay under
`/home/travi/btmd/pq-net-propagation-runs`; no private identities, API tokens
or complete daemon logs belong in this directory.

## Source and build provenance

- x0x v0.47.1 peeled source commit: `ae064f6dd13479ee46a196de87e147c1b5ec7ecd`.
- Published saorsa-gossip-pubsub 0.5.87 archive SHA-256: `d3d61f1e611205b38c896d61c7082d3c18f804a5417e02c28a6dcf3c954f3502` PUBLIC-CONSTANT
- Original pubsub `src/lib.rs` SHA-256: `5de8d4e465bda0c93493e18e3c9e6dc4fd6d3a715656d7b703f1ec99da19cb08` PUBLIC-CONSTANT
- Original local x0x lockfile SHA-256: `61f83d1bd979dc4a92f504fa3a89f5ebc5a7496c3171c65b349938cf1edfaf9e` PUBLIC-CONSTANT
- Path-override lockfile SHA-256: `c2dad2060694814609fb96db7988ab30fb92f7922d077804dc31e0ee86142b50` PUBLIC-CONSTANT
- Upstream regression workspace base: saorsa-gossip `4d41f88f57e92eb439dda184700350f80d86c84a`, package 0.5.88.
- Frozen source-built control executable SHA-256: `cd42b9487371f2630458610711d3e97098f84718e79a0c131f120cd43885afee` PUBLIC-CONSTANT
- Frozen guard-only executable SHA-256: `409572181dbc8144fd8f3287591c0a415eef286681a6d8a4012f556396ab3e72` PUBLIC-CONSTANT
- Frozen V3-fixed executable SHA-256: `6ed846c8930cd48b5b31fc6bb93fb98e25352a0f3d62c8c0903b0ffc7389525e` PUBLIC-CONSTANT

The daemon experiment uses isolated copies of the x0x source and the
published 0.5.87 crate. The x0x manifest adds only:

```toml
[patch.crates-io]
saorsa-gossip-pubsub = { path = "../pubsub" }
```

All builds use the same local Cargo.lock and command:

```sh
CARGO_TARGET_DIR=/home/travi/btmd/pq-net-repair-target CARGO_BUILD_JOBS=3 \
  cargo build --release --locked --offline --bin x0xd
```

The initial control build creates the path-override lockfile before it is
frozen. The control's only source additions are `cfg(test)` regression code;
its production retry logic is unchanged. The first candidate changes only
the same-peer pending-retry guard. The final candidate also fixes V3
recovery-intent identity. Test verification uses the upstream workspace because the published crate omits
its unpublished legacy compatibility fixture.

The control release build succeeded in 62m 05s. Its executable is frozen at
`/home/travi/btmd/pq-net-repair-pins/v0.47.1-control/x0x-linux-x64-gnu/x0xd`.
The guard-only build succeeded in 20m 50s and is frozen at
`/home/travi/btmd/pq-net-repair-pins/v0.47.1-iwant/x0x-linux-x64-gnu/x0xd`.
The lockfile is byte-identical between the builds. Comparing the control and
guard-only pubsub source copies gives exactly six added guard/comment lines.
The final V3-fixed build succeeded in 17m 22s and is frozen at
`/home/travi/btmd/pq-net-repair-pins/v0.47.1-v3-intent/x0x-linux-x64-gnu/x0xd`.
Its lockfile is also byte-identical to the control.

`pubsub-0.5.87-v3-intent.patch` is the final production backport. Apply it to
a pristine published crate with `patch -p1` from its root.
`upstream-v3-recovery.patch` includes the production repairs and regressions.
`pubsub-0.5.87-guard.patch` and `upstream-deferred-iwant.patch` preserve the
earlier guard-only candidate, whose matched run did not improve delivery.
For a published-crate backport the production file is
`src/lib.rs`, rather than `crates/pubsub/src/lib.rs`; surrounding line numbers
also differ. Do not replace the published crate with upstream 0.5.88 or
silently update the rest of the dependency graph.

The daemon toolchain is `rustc 1.95.0 (59807616e 2026-04-14)`, selected by
x0x's toolchain file. Upstream workspace tests use its selected
`rustc 1.99.0-nightly (dc3f85158 2026-07-26)`; these are separate source/build
receipts. The upstream ignored Cargo.lock SHA-256 is
`22f15e02261226b269d55ff061ac7e539c60cc0ce04b24a76426eca3dfb7ff4a`. PUBLIC-CONSTANT

## Measurement contract

Use the frozen #433 driver and the same workload, budgets, nine-node topology,
fresh identities, 90-second idle period and default 45-second observation
sweep for every leg. The store on-time deadline remains ten seconds. Start
each run only after the previous owned rig has torn down. Existing `wa` and
`wb` namespaces belong to other work.
Mean leaf idle B/min sums ingress and egress and averages the seven leaves.
Per-node, seed/relay and workload-phase costs remain in comparison.json.

```sh
BTMD_RIG=1 /home/travi/btmd/pq-net-status-target/debug/btmd trial \
  --run-id UNIQUE-s9-20261015 --label LABEL --subnet-third 86 --scale 9 \
  --version PIN --binaries-root /home/travi/btmd/pq-net-repair-pins \
  --work-root /home/travi/btmd/pq-net-propagation-runs
```

Run as root inside WSL for isolated namespaces. Candidate-policy legs append
`--gossip byte_policy=shed_normal`. The private rig has no public-mesh route.
Do not run bandwidth measurements alongside builds. A failed delivery gate
is retained as a result; a collector failure makes the trial invalid.
