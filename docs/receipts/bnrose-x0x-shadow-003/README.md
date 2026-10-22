# Native NixOS source validation and Oracle recovery

Source: x0x `85633f6a6dfea44e62a0cad778aa429275fc4604`, PR #4, unmerged.
This supplements receipt 002's NixOS execution of WSL-built binaries.

- `native-launch.sh` runs inside the unchanged `nix/shadow` flake shell.
  It creates only a temporary build service and its private state directory.
- `native-validation.sh` checks out the exact revision, installs Rust 1.95.0,
  builds with the tracked lockfile, and selects only inert shadow tests.
- `audit.json` is cargo-audit 0.22.2's report, with one added `receipt_note`
  identifying public crate checksums for the repository's secret-scanning hook.
  Native audit exited zero; stderr was empty. No ignore list was used.
- `audit-initial.log` retains the first audit's registry-refresh warning;
  the final run used the populated build Cargo home.
- `hostinger-health.log` records live OS and existing daemon health. It is
  not a deployment, message-delivery, or invitation-convergence test.
- `native-build-and-initial-tests.log` retains the successful release build
  and six example tests, preceded by noexec setup failures and followed by
  the library-test compilation's 8 GB OOM failure.
- `native-encoder-launch.sh` and `native-encoder.sh` retry only that unfinished
  selector with networking disabled, one compile job, and 16 GB maximum memory.
- `native-encoder-tests.log` records the successful retry: 23m 17s compilation,
  both tests passed, 3,962 unrelated tests filtered, 8.4 GB peak memory.
  The public executable checksum line has an added PUBLIC-CONSTANT marker.
- `hostinger-final-health.log` confirms the existing daemon remained healthy
  after validation, with 21 send-ready peers and zero restarts.
- `native-smoke.sh` records the command used for the isolated execution of
  the source-built release binary. Raw samples are in `native-smoke.json`;
  `native-smoke-sandbox.log` records exit zero and the resource envelope.
  Compilation was concurrent, so this is not a comparative speed benchmark.
- `pr4-current.json` records the unchanged PR head and 32 successful / two
  skipped checks, independently of these host-side results.

The build deliberately has network access to fetch public dependencies.
The two encoder tests and six example controls were inspected to be inert;
no daemon test suite is run in this network-enabled build environment.
The shadow has no production ingress connection, transport override, new
authority service, signature cache, or peer participation requirement.

The Oracle recovery lane and the unresolved invitation-convergence failure
are described in `../../dispatches/2026-10-20-oracle-recovery-nixos-validation.md`.
