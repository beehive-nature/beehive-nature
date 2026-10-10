# RUSTSEC-2026-0285 in the root Cargo.lock: rustls 0.23.42 to 0.23.45

**What was found.** GitHub Actions run 37931727642 (workflow bTunGsTeN PQ, a push to btungsten-ci-scratch at `6c05ba67`), job pq12-taproot, step "PQ12 audit gate 2":

- The step ran `cargo audit --file Cargo.lock` with cargo-audit 0.22.2.
- It reported RUSTSEC-2026-0285 ("TLS 1.3 handshake messages incorrectly accepted across encryption level boundaries", 2026-09-14) on rustls 0.23.42.
- Its summary line was "2 vulnerabilities found!". The step records the audit and does not block it: "cargo audit exited 1".
- The advisory's patched range is `>= 0.23.45`.
- Evidence: `3-provenance/ci-37931727642-pq12-audit-gate-2.log`, lines 766–1431 of the job log, verbatim with ANSI escapes kept.

**What changed.** Only the root `Cargo.lock`, four lines:

- rustls 0.23.42 to 0.23.45, published 2026-09-14 and the newest 0.23.x.
- rustls-webpki 0.103.13 to 0.103.15, published 2026-08-21 and not yanked. rustls 0.23.45 declares `rustls-webpki` `0.103.14` (a caret requirement), so cargo moved it with rustls.

Evidence for both: `3-provenance/crates-io.txt`.

**What did not change.**

- The audit is not clean. RUSTSEC-2023-0071 (rsa 0.9.10, Marvin attack) has no patched version, and this change leaves it alone. It is not repaired, not accepted and not suppressed.
- The three allowed warnings stay as they were: bincode 1.3.3 and proc-macro-error2 2.0.1 are unmaintained, and chacha20 0.10.1 is yanked.
- Both audits exit 1.
- No audit policy, ignore list or hook was changed.

**Outside this change.** Two separate-workspace lockfiles also carry rustls versions below 0.23.45: `ops/x402-door/Cargo.lock` (0.23.44) and `scripts/ant-extsig-repro/lock/Cargo.lock` (0.23.43). Neither feeds the root audit. They are named here, not changed.

## Environment

The files in `3-provenance/` were captured on 2026-10-09 between 16:40 and 16:42Z, after both stages ran. Each one prints its own capture time.

- WSL2 on the build box: cargo 1.98.1, rustc 1.98.1 (`3-provenance/env.txt`). `CARGO_TARGET_DIR=~/rustls-0285-target`, fresh for this work.
- cargo-audit 0.22.2, installed in this WSL environment with `cargo install cargo-audit --locked --version 0.22.2`. That is the version the PQ12 step installs.
  - The binary's mtime is 2026-10-09 07:08:02 −0600 (`3-provenance/env.txt`).
  - It prints its version as `cargo-audit-audit 0.22.2`.
- Audit configuration: none. There is no `~/.cargo/audit.toml` and no `.cargo/audit.toml` in the repo (`2-integrated/audit-meta.txt`).
- Advisory database: RustSec/advisory-db `7eebec69c352c7191b1f13eb95dd510eeca5d1de`, committed 2026-10-09T10:12:02+02:00. Every run loaded 1296 advisories.
  - **Stage 2:** the revision was read directly, after the fetching run and again after the `--no-fetch` run (`2-integrated/audit-meta.txt`).
  - **Stage 1:** the revision was **not captured** at run time. What follows is inference from later captures.
    - The database's reflog has a single entry: a clone at 2026-10-09 07:08:10 −0600, at `7eebec69` (`3-provenance/advisory-db-reflog.txt`).
    - That is eight seconds after cargo-audit was installed and before `e68a1b1b3` was committed (07:12:35 −0600). The only `cargo audit --file` runs in that window were stage 1's.
    - HEAD was still `7eebec69` after stage 2. A fetch-only clone does not leave a revision and come back to it.
    - So the stage-1 runs most likely used `7eebec69` too.

## Stage 1: local, branch base 447a6a751

The lock change was committed as `e68a1b1b3`. The sha256 values below were computed from git after the runs. The runs themselves record no commit, tree or lock hash.

| tree | commit | Cargo.lock sha256 |
|---|---|---|
| before | `447a6a751b7a` tree `8f225a155462` | `bb970436ac5d288b88c3cafb4dd964d0b7a51bc709599a8e4be8fb94c3629ec0` <!-- PUBLIC-CONSTANT: sha256 of Cargo.lock at 447a6a751 --> |
| after | `e68a1b1b337c` tree `019f3c7d5f15` | `e07d3d2150c9eec199eb4409d288e09971d50b80d6fb9e01e842b42c26b3ebb7` <!-- PUBLIC-CONSTANT: sha256 of Cargo.lock at e68a1b1b3 --> |

- **`update.txt`:** `cargo update -p rustls --precise 0.23.45` reports two lines, rustls 0.23.42 to 0.23.45 and rustls-webpki 0.103.13 to 0.103.15. Exit 0.
- **`tree-*.txt`** (made by `scripts/tree.sh`): `cargo tree --locked --workspace -i rustls`, with and without `-e normal`, before and after. In each pair one line differs, the rustls version. The crates the trees show:
  - **Normal graph:** composition, wallet-relay, royalreview, zano-watcher, atmirror, banchor and bindexer reach rustls through ureq. adapter-pixellab reaches it through reqwest and hyper-rustls.
  - **bzdid:** reaches rustls through its own dev-dependency on atmirror, so its tests link rustls.
  - **bheraldry:** appears under bzdid only because the workspace-wide inverted tree lists every dependent of bzdid. bheraldry depends on bzdid as a normal dependency, and cargo does not carry bzdid's dev-dependencies to its dependents. **bheraldry does not build rustls.** It was tested anyway, and its results are part of the counts below.
  - **bsigner:** does not reach rustls.
- **`audit-before.txt`:** 2 vulnerabilities (RUSTSEC-2023-0071 in rsa, RUSTSEC-2026-0285 in rustls) and 3 allowed warnings. Exit 1.
- **`audit-after.txt`:** 1 vulnerability (RUSTSEC-2023-0071 in rsa) and the same 3 warnings. Exit 1.
- **`test-attempt-1.txt`:** `cargo test --locked` over the ten crates **failed on an environment precondition**, not on the change.
  - Exit 101: bheraldry `tests/bsigner_seam.rs:39` panicked with "bsigner binary not found". The test runs the prebuilt bsigner binary, which CI produces with its workspace build. The fresh target directory had none.
  - Without `--no-fail-fast`, cargo stopped at that test target, and no doctests ran. Up to that point: 179 passed, 1 failed.
- **`test-attempt-2.txt`:** `cargo build --locked -p bsigner` (exit 0), then `cargo test --locked --no-fail-fast` over the ten crates. Exit 0: 336 passed, 0 failed, 0 ignored, across 43 test binaries including doctests.
  - The run used the worktree whose only change was `Cargo.lock`, the lock committed as `e68a1b1b3`.
  - The run does not record a hash.

## Stage 2: integrated, on 64dd73226

origin/main moved to `64dd7322687e`: 30 commits, including other root-lock additions. It merged into the branch cleanly as `f48c99adf`. As in stage 1, the sha256 values were computed from git after the runs.

| tree | commit | Cargo.lock sha256 |
|---|---|---|
| origin/main | `64dd7322687e` tree `aa5f90597df0` | `904bb727499605ba24700f57c744838eeae539527efdb4b2e3eed549fef2d347` <!-- PUBLIC-CONSTANT: sha256 of Cargo.lock at 64dd73226 --> |
| merged candidate | `f48c99adfc46` tree `de5aa8573e4f` | `3a25b5897b05d06349da389212ec555478afc55e8847a5edcbfd05bc704fe7ee` <!-- PUBLIC-CONSTANT: sha256 of Cargo.lock at f48c99adf --> |

- **`recheck.txt`:** a fresh `cargo update -p rustls --precise 0.23.45` on origin/main's own lock is byte-identical to the merged lock (`cmp`: identical).
  - The update is applied once, and main's new commits needed nothing more.
  - `git diff 64dd73226 f48c99adf -- Cargo.lock` shows the same four lines.
  - `main.lock`, the file the recheck and `audit-main.txt` read, was written from `git show origin/main:Cargo.lock`.
- **`tree.txt`, `tree-normal.txt`:** the same crates as stage 1, with the same bzdid and bheraldry reading.
- **`audit-main.txt`** (the fetching run, on origin/main's lock): 2 vulnerabilities, 3 warnings, exit 1.
- **`audit-merged.txt`** (`--no-fetch`, same database): 1 vulnerability (RUSTSEC-2023-0071 in rsa), 3 warnings, exit 1.
- **`test.txt`:** `cargo build --locked -p bsigner`, then `cargo test --locked --no-fail-fast` over the ten crates. Exit 0: 336 passed, 0 failed, 0 ignored, across 43 test binaries.
  - The run used the worktree at `f48c99adf`. `git status --short` was empty right after the recheck and again after the run.
  - The run does not record a hash.

## Reproduce

```
source ~/.cargo/env
cargo install cargo-audit --locked --version 0.22.2
cargo update -p rustls --precise 0.23.45
cargo tree --locked --workspace -i rustls
cargo audit --file Cargo.lock
cargo build --locked -p bsigner
cargo test --locked --no-fail-fast -p composition -p wallet-relay -p royalreview -p zano-watcher -p atmirror -p banchor -p bindexer -p adapter-pixellab -p bzdid -p bheraldry
```

## Not captured

- **Hashes at run time:** no commit, tree or lockfile hash was recorded when the tests and audits ran. The tables were computed from git afterwards.
- **Stage 1's advisory-database revision:** inferred above.
- **The crates.io index state when `cargo update` ran:** stage 2's byte-identical recheck shows the same resolution later that day.
- **Wall-clock times for each run,** beyond file times and the two timestamps cited above.
- **The environment and registry facts in `3-provenance/`:** these were captured after the runs, not during them.
- **`scripts/lane.sh`:** this is the version after attempt 1. Its test step gained the bsigner build and `--no-fail-fast` between the attempts. The first line of each test file is the exact command that produced it.
