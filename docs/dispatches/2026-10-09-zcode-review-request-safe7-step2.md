# 2026-10-09 — zCode review request: Safe 7 step 2, the hardware-build candidate

Seat 3 (Claude Code), firmware lane, answering the founder's relayed step-2 order of
2026-10-09 ("a reviewed, reproducible hardware-build candidate, not a device ceremony
yet … zCode doing the independent review"). Everything below is landed and receipted;
nothing was flashed, no device was enumerated, no unlock, no wipe, no real seed, no
mainnet. This dispatch asks zCode for the independent review the order names and lists
exactly what to read and what to re-run. A proxy read-only review by this seat's own
reviewer preceded the commits; its two blocking findings were fixed before they landed
(the unguarded unit-test import; a black line); zCode's review is the one that counts.

## What landed, by sha

| where | sha | what |
|---|---|---|
| private fork `beehive-nature/Trezor-firmware-dApp`, branch `bpq-safe7-7a8709b` | `7dab5f939` | bpq becomes a model-scoped cargo feature of universal T3W1 firmware (hardware and emulator) on the tree's `eos` precedent; a build-time refusal by model name; an xtask test over every model's resolved features; the unit test guarded; mocks regenerated; `docs/bpq-device.md` status rewritten |
| same branch | `967fddb3d` | the emulator cross-check takes its Rust oracle from beehive-nature; the stale `crypto/bpq/rust-xcheck` copy is deleted; both oracles report key equality, signature verification and controls separately |
| same branch | `bc8bb2e75` | `crypto/bpq/HARDWARE_CANDIDATE_RECEIPT.md` and the emulator cross-check receipt at `967fddb3d` |
| public `beehive-nature`, main | `92c035635` (on main at `d46a26c21`) | `crates/bpq-device-xcheck`: bsigner's own `bpq.rs` compiled by `#[path]` as a library, plus the oracle binary; one foreign-witness test (the public fixture's PRK must give the emulator's id) |
| public main | `the commit that lands this request` | `docs/receipts/bpq-safe7-hardware-candidate-2026-10-09.json`, the handoff §8 status, the corrected gate-6 ceremony plan, this request |

Fork lineage: `da2583079` (10-05 receipt chain) → `cce1fe1e2` (ARM fix) → `5e12b132f`
(its receipt) → `7dab5f939` → `967fddb3d` → `bc8bb2e75`. Branch name informational; cite shas.

## The candidate image (read from the artifacts, never from a plan)

- Two fresh pinned builds of `967fddb3d` at `/home/travi/bsafe-canonical-build` with
  `tools/firmware/build-pinned.sh` (`--model T3W1 --pyopt true`, CFLAGS prefix map, clean tree
  and pinned submodules enforced), moved to `/home/travi/bsafe-candidate-run-1` and `-2`;
  `tools/firmware/compare-builds.py` over `firmware.bin`, `kernel.bin`, `secmon.bin`:
  `byte_identical: true (compare exit 0; the same-checkout control refused: "Two distinct checkouts are required")`.
- `firmware.bin`: 2,396,672 bytes, sha256 `dfc5d2a435c78223115b191c076080981f280c8125873a08784d4a39ad6508aa` PUBLIC-CONSTANT; headertool
  fingerprint `9643e4be1c1d4e2e58a15f972aaaa2569e3bef219fe28915e848e1efae800a9f` PUBLIC-CONSTANT (equal in both builds; `trezorctl firmware
  verify` on the file, no device).
- Vendor header: the first 1024 bytes equal `vendorheader_unsafe_signed_prod.bin`
  (`6c80f1f17f1a352fbb3c5f63ab902f0142aea3f1c9205a0ec097ab2965229553` PUBLIC-CONSTANT, text "UNSAFE, DO NOT USE!"); secmon embedded is the prebuilt
  `core/embed/models/T3W1/secmon/secmon.bin` (`f9cacf15ec3e126fa26d31790bc5038474f373f81f616163937c5beb277098d9` PUBLIC-CONSTANT, 186,368 bytes).
- Resolved features of the firmware package: `models/model_t3w1,pyopt,dev_keys,universal_fw,frozen,…,bpq` (no `debuglink`, no `debug`, no
  `emulator`; `pyopt`, `dev_keys`, `universal_fw`, `bpq` present; development keys, not
  production authority).
- bpq symbols in `firmware.elf`: 47 (names matching bpq_ or mod_trezorcrypto_bpq_) (the parent `5e12b132f` baseline: 0).
- Fit on build A against the parent baseline (`crypto/bpq/fit.sh`): heap peak 86,160 B (host seam, largest block 30,720 B), worst static stack 16,296 B below the binding, FLASH 2340.5 KB / 3336.0 KB (70.16 %) against the parent's 2305.0 KB (69.09 %), a delta of 36,352 B, the same numbers the 2026-10-05 measurement tree gave.
- Toolchain inside the pinned nix shell: rustc 1.96.0-nightly (1e2183119 2026-03-15), cargo 1.96.0-nightly, Arm GNU Toolchain 13.3.Rel1 (GCC 13.3.1), uv 0.11.26, Python 3.14.6, Nix 2.35.1; builds 1 and 2 each 4 min 28 s (2026-10-09T23:23:55Z to 23:28:23Z and 23:38:33Z to 23:43:01Z).

## Emulator cross-check at `967fddb3d`

`crypto/bpq/emu_xcheck.py`, oracle checkout beehive-nature `d46a26c21` (`surfaces/bpq.js`
`d2c42d58…`, `surfaces/onboarding/vendor/bpq-lib.js` `510efda5…`, `crates/bsigner/src/bpq.rs`
`1f3eb997…`, the Rust oracle built by `cargo 1.98.1 --locked`): PASS (fork_revision 967fddb3d, fork_dirty false; emulator 66bb00b4…, 47 bpq symbols, 5 unit tests; js and rust both keys_equal, signatures_verify, controls_refused true; the second profile gives the same card; device id bzpq1lws2ertcufjd8ehnr0qndqrz5krg3qqd4zltg7d5vrgncl8j8qjsr47lvv unchanged since 2026-10-04). Key equality and
signature verification are reported apart (`keys_equal`, `signatures_verify`,
`controls_refused`) in both oracles.

## What zCode is asked to review (read-only; findings to this lane)

1. **Source and feature scope.** `7dab5f939`: is `bpq` reachable for any model but T3W1, any
   project but firmware, or any btc-only build? Read `core/embed/xtask/src/config.rs`
   `resolve_board_features`, every `projects/*/project.toml` and `models/*/model.toml`, the
   Cargo forwarding (`projects/firmware`, `projects/unix`, `rtl`, `upymod`), the `ensure!`
   guard in `rtl/build.rs`, and `core/embed/xtask/tests/bpq_model_scope.rs`
   (`cd core/embed && cargo test -p xtask --test bpq_model_scope`; it does not run in CI).
   Known boundary: the guard fires on `rtl/bpq`; `upymod/bpq` now implies it; a hand-rolled
   cargo call enabling only `rtl/bpq` is outside xtask.
2. **Consistency.** The C, the `trezorcrypto.bpq` binding, the frozen app, `USE_BPQ`, the
   frozen-module literal and the message routing must be present exactly together.
3. **Build provenance.** Re-run the two pinned builds yourself if you have the toolchain
   (the recipe is `tools/firmware/README.md`; ~7 min per build after the clone), or at least
   re-hash the retained artifacts in `/home/travi/bsafe-candidate-run-1` and `-2` and re-run
   `compare-builds.py`; check the logs' sha256 against `logs.sha256` in the evidence dir
   `/home/travi/bsafe-candidate-20261009`; confirm the resolved feature lines; confirm the
   vendor header and secmon identities from the bytes.
4. **Oracle.** `crates/bpq-device-xcheck` (public): is the `#[path]` inclusion the same bytes as
   `crates/bsigner/src/bpq.rs` at the revision (the binary prints their sha256); does the
   harness pin honestly (it records the checkout's revision; it does not pin); re-run
   `emu_xcheck.py` at `967fddb3d` with a fresh emulator build if you can.
5. **Privacy and authorization.** The corrected ceremony plan
   (`docs/dispatches/2026-10-09-safe7-gate6-ceremony-plan.md`): no device-identifying material
   in any public receipt contract; nothing in it or in these commits authorizes unlocking,
   flashing, wiping or physical acceptance; the founder's working Safe 7 is out of scope.

## Remaining acceptance gaps (explicit, with owners)

- Gate 1, upstream security reconciliation: none; the candidate is 23 ahead and 825 behind
  upstream `c1dacf2f4` (merge-base `0cd72f033`, authored 2026-07-21). Owner: the firmware seat,
  before any candidate is called releasable.
- Gate 2, native transport and pairing receipt on a development unit: none; no device has
  enumerated from the scripts' shell. Owner: the firmware seat.
- Gate 4, recovery tests on the emulator (wrong phrase, wrong passphrase, algorithm version,
  context): none. Owner: the firmware seat.
- Gate 5, binding, replay, downgrade and rotation evidence: none. Owner: the PQ lane.
- The 13 pre-`7a8709bdff` fork commits carrying `dev@beehive-nature`: founder acknowledgment,
  unchanged.
- On-device stack headroom, heap fragmentation, signing time, the display flow: measurable
  only at gate 6, which is not authorized by anything here.
- The `bsigner` CONTRACT.md freeze versus main's added subcommands (unrelated to this candidate):
  founder ruling, escalated 2026-10-09.

HUMAN INTERACTION: NONE. NEXT OWNER: zCode seat (this review); then the firmware seat on gates
1, 2 and 4.
