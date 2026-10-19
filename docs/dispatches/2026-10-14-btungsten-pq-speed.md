# bTunGsTeN PQ speed comparator — 2026-10-14

Built a caller-owned prepared ML-DSA-65 public-key verifier and a measured
assurance lane in BNR's isolated `btungsten-x0x-pq` test workspace. The candidate
retains pinned fips204's expanded public key and verifies every message/context/
signature through the same implementation. It changes no shipping x0x, ANT or
BNR protocol or cryptographic parameters.

Source: `crates/btungsten-x0x-pq/src/lib.rs`,
`PreparedMlDsa65PublicKey::{from_bytes,verify}`. Performance harness:
`src/bin/pq-speed.rs::{assurance,benchmark}`. Pin/count/exit/receipt controller:
`scripts/btungsten/pq-speed-check.py::main`. Full integration and measurement
limits: [PERFORMANCE.md](../../crates/btungsten-x0x-pq/PERFORMANCE.md).

## Measured result

Host: Linux-6.18.44-x86_64-with-glibc2.41; CPU: AMD EPYC 7763 64-Core Processor; rustc 1.98.1 (48a229cea 2026-09-01).

| Message | Warm API speedup (two trials) | Warm ANT legacy speedup | Cold API speedup |
|---|---|---|---|
| 0 B | 1.211× / 1.196× | 1.210× / 1.200× | 1.173× / 1.165× |
| 256 B | 1.200× / 1.197× | 1.210× / 1.205× | 1.176× / 1.195× |
| 4096 B | 1.189× / 1.168× | 1.190× / 1.182× | 1.160× / 1.154× |
| 65536 B | 1.095× / 1.101× | 1.086× / 1.099× | 1.084× / 1.085× |

These are measured ratios of median batch times on this shared host. Each
profile has 17 samples of 64 valid verifications, rotating execution order,
after one warmup batch. Signing and receipt writing are outside the timers.
The warm profiles use the same message/signature repeatedly; this does not
measure multi-peer working sets, wire traffic, TLS handshakes, network delivery,
population scaling, energy or adversarial sustained load. No timing threshold
is enforced in CI. All individual samples remain in the JSON receipts.

The object costs 6240 inline bytes per key on this build, compared with a
1952-byte encoded public key plus wrapper. At 1000 keys this is 6.24 MB for
prepared objects alone. A production integration needs bounded identity-owned
retention and must release prepared keys on binding/epoch changes. Authorization,
revocation and identity binding remain caller obligations for every operation.
No secret-key cache, global registry or verification-result cache was added.

## Executed assurance and controls

- Two fresh candidate runs each passed **414/414**: 15 KAT, 108 DIFFERENTIAL,
  291 TEETH, with **14/14 exact-count coverage rows**. Pure/external ML-DSA-65
  official sigVer includes 3 valid and 12 invalid cases. Randomized signatures
  are independently checked by RustCrypto and libcrux on all 36 message/context
  boundary combinations; they are not deterministic KAT results.
- Accept-all sabotage: native exit 1, **300 named failures**, including all
  empty-signature teeth. No timings were produced.
- Truncated-message sabotage: native exit 1, **26 named failures**, including
  six last-message-byte failures for changed suffixes beyond position 256.
  The control deliberately signs a prefix to expose ignored input. No timings.
- Empty-vector control: native exit 1, **zero executed**, all **14 named missing
  rows**, no timings. Tool/load failures cannot supply an accepted receipt;
  controllers remove stale receipts before each run.
- Original x0x PQ regression passed **752/752**, all **37 rows**; the altered
  expected-byte control produced its two intended failures and the empty run
  refused all 37 rows. No missing honest rows or load errors.
- Isolated-lock audit gate 2: zero reported vulnerabilities, the same two
  maintenance warnings (atomic-polyfill and proc-macro-error2), retained verbatim.
  Default BNR dependency graph still excludes Saorsa. No dependency versions
  or lock files changed. Previously recorded full-lock advisory findings remain.
- Locked release build, formatting, all-target Clippy with warnings denied,
  Python compilation, repository hook checks and whitespace checks passed.

The PQ workflow now runs this controller after the original pinned battery and
uploads both evidence sets even on failure. This is an additional native lane;
BNR's existing RustCrypto SAW proofs do not qualify the new FIPS comparator.

## Upstream priority and scope

Read current dirvine discussion on x0x #622, #505 and #504 before the lane.
The #622 work remains with #504's delivery/measurement criteria; #505's
fragmentation half remains field-accepted. This comparator makes no claim of
meeting E-D17 delivered/published criteria or fixing the recorded shed profiles.
No fleet node, network default, live mesh test or upstream communication changed.

Version binding remains x0x v0.48.0 / `32bf552808`, saorsa-pqc 0.5.1 and
fips204 0.4.6. The ANT comparator calls Saorsa's legacy API used by ant-quic
0.27.60; it does not qualify Autonomi storage or every ANT path. Full Cryptol/
SAW equivalence of the FIPS/Saorsa path, constant-time behavior, entropy quality,
production integration and full-system qualification are **UNESTABLISHED**.

## Receipts

[`docs/receipts/pq-speed-2026-10-14`](../receipts/pq-speed-2026-10-14): both honest
runs, all controls, samples, stdout, source pins, binary/source/lock hashes,
platform, build and Clippy logs; `regression/` retains the original battery's
fresh outputs and audits. `manifest.json` hashes every retained file except
itself. Source and log hashes were verified before staging.

These receipts were generated in the worktree descending from `a27921cf8`;
`run.json` records that base commit and the exact source hashes under test.
The pushed descendant carries those sources and the receipts together.
