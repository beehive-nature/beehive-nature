# z1.c — Sprint 2 reproducible-harness build candidate (`scripts/ant-extsig-repro/`)

**Seat:** z1.c (GLM 5.3, Medium) · **Assignment:**
[#10 comment 5647975452](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647975452)
(z1.c block) · **Claim:** [#10 comment 5647993142](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647993142)
**Base:** fresh branch `zcode/ant-extsig-repro-2026-09-12` from fetched main
`8d42da28` (own worktree `../wt-z1c-repro`; nothing staged or run in the
shared checkout). **Inherits:** the accepted `9557aaeb` runbook
(`docs/runbooks/autonomi-fence-readiness.md` rev 4) + its 50/50 acceptance —
this is new work on top, not a reopening of the observer.

## What landed

`scripts/ant-extsig-repro/` — the isolated reproducibility runner for the
canonical `ops/ant-extsig` member-write harness:

- **`run.sh`** — one fail-closed pass: source-manifest gate → candidate-lock
  pin gate → isolated scratch copy + overlay + lock staging → `cargo
  metadata --locked` (explicit graph) → `cargo check --locked` → second
  locked resolution in a fresh copy → canonical-untouched assertion →
  validated-path cleanup. Five laws in the header; every cargo invocation
  asserts the staged lock's sha256 unchanged afterwards.
- **`selftest.sh`** — 9/9 green (receipt below): missing/changed lock at
  both the runner and cargo levels, the orphan-workspace error reproduced
  verbatim then cured, source drift refused, cleanup path-guard verdicts,
  canonical tree still byte-identical.
- **`overlay/Cargo.toml`** — the reviewable manifest delta applied to the
  copy: `ant-core` git dep pinned to the banked rev
  `969ed008d9cd39bbfe6466bc5ff7943914565994`, `ant-node = "=0.18.1"` and
  `ant-protocol = "=2.3.5"` as EXACT requirements (canonical are caret
  ranges), plus the `[workspace]` empty table that detaches the build copy
  from any parent workspace (the runbook §6 orphan cure).
- **`lock/Cargo.lock`** — the committed candidate lockfile: **the previously
  obtained box lockfile** (`~/ant-lane/ant-extsig/Cargo.lock`), pulled
  read-only via ssh (two `cat`/`sha256sum` calls, nothing else touched on
  the box) and **byte-identical** (sha256 `0312ab19…aa86`, 700 packages,
  format v4). The runbook's banked pins are asserted in it directly:
  ant-core 0.8.1 @ git `969ed008…5994`, ant-node 0.18.1, ant-protocol 2.3.5.
- **`source-manifest.sha256`** — digest set of the five canonical files;
  the runner refuses on content drift OR any file added/removed.
- **`README.md`** — laws, usage, provenance, honest limits.

No second maintained copy of the harness source exists: the runner copies
`ops/ant-extsig` at run time; nothing under `ops/` or the root workspace was
modified (digest-asserted before/after every run; `git status` clean for
those paths).

## The one difference found in the box lock (the "inspect differences" beat)

The box lock was generated from the **unpinned** canonical manifest, so its
ant-core source line reads `git+…/ant-client#969ed008…`. A manifest that
PINS `rev = 969ed008…` makes cargo expect `git+…/ant-client?rev=969ed008…#
969ed008…` — **same commit, same 700-package graph, different source-id
spelling** — and `--locked` refuses the unpinned spelling outright
(`cannot update the lock file … because --locked was passed`; reproduced
before the fix). The runner therefore applies a **one-line source-id
alignment to the staged copy** and refuses if the alignment touches
anything but that single line; the COMMITTED lock stays byte-identical to
the box's (both sha256s in every receipt). Verified: with the alignment,
`cargo metadata --locked` exits 0 against the box graph unchanged.

This is the only transformation. No re-resolution was performed and none is
claimed: the candidate lock is the historical box lock **obtained, not
reconstructed** — an independent `cargo update` today would resolve newer
transitive crates.io versions (ant-client HEAD has already drifted past the
banked rev), which is exactly why the lock is committed.

## Locked-build evidence (named host)

Host: the z1.c laptop — `MINGW64_NT-10.0-26200 x86_64` (Windows 10 26200,
Git Bash 3.6.9), cargo 1.98.1 (the estate `rust-toolchain.toml` pin,
exported by the runner because the scratch dir sits outside rustup's
directory walk), GNU toolchain. Verbatim runner receipt:

```
== ant-extsig-repro receipt ==
host:             MINGW64_NT-10.0-26200 x86_64 3.6.9-b4195d69.x86_64
cargo:            cargo 1.98.1 (797e8a9bc 2026-08-05) (toolchain pin: 1.98.1)
canonical src:    /c/Users/travi/wt-z1c-repro/ops/ant-extsig (verified == source-manifest.sha256, file set exact)
overlay sha256:   9036262d80bce76ba417ec82592d539976cae92234fc5acb3762b2ec240ac8a2  # PUBLIC-CONSTANT (sha256 of the public overlay manifest)
committed lock:   scripts/ant-extsig-repro/lock/Cargo.lock
box lock sha256:  0312ab19ac8082767b71e334743784e67a9f54386f105a1e12d99f922019aa86 (committed candidate — byte-identical to the box's)  # PUBLIC-CONSTANT (sha256 of the public box Cargo.lock)
staged lock:      box lock + ONE-line ant-core source-id alignment
                  (git+URL#rev -> git+URL?rev=rev#rev, same commit)
staged sha256:    76fa7184f84fa38d51d98204f296435fbc995a2cc230cca6c1d5c73d93f3a4b3  # PUBLIC-CONSTANT (sha256 of the public aligned lock)
lock packages:    700
banked pins:      ant-core git 969ed008d9cd39bbfe6466bc5ff7943914565994 / ant-node =0.18.1 / ant-protocol =2.3.5 (asserted in lock AND manifest overlay)
graph:            cargo metadata --locked OK
second resolve:   fresh copy, cargo metadata --locked OK, staged lock sha UNCHANGED
check (--locked):  OK   (cargo check --locked: Finished `dev` profile in 7m 32s)
build (--locked):  OK   (cargo build --locked: Finished `dev` profile in 4m 38s)
ops tree:         UNCHANGED (digest set identical before/after)
== end receipt ==
```

Explicit Cargo graph receipt (`cargo tree --locked --depth 1`):

```
ant-extsig v0.2.0 (<scratch>/build/ant-extsig)
├── ant-core v0.8.1 (https://github.com/WithAutonomi/ant-client?rev=969ed008d9cd39bbfe6466bc5ff7943914565994#969ed008)
├── ant-node v0.18.1
├── ant-protocol v2.3.5
├── hex v0.4.3
├── serde_json v1.0.151
└── tokio v1.53.1
```

(700 packages total in the locked graph; full `cargo metadata --locked`
JSON was emitted to the kept scratch during the run.)

A second default-mode run (no KEEP) exercised the validated cleanup: ALL
PHASES OK again and zero scratch directories left behind.

## Selftest receipt (9/9, `sh scripts/ant-extsig-repro/selftest.sh`)

| case | verdict |
|---|---|
| T1a missing committed lock | runner refuses (`candidate lockfile not found`) before any cargo run |
| T1b missing build lock | cargo `--locked` refuses to create one (`cannot create the lock file …`) — the runbook §6 quote |
| T2a tampered committed lock | runner's banked-sha assertion refuses |
| T2b tampered build lock | cargo `--locked` refuses AND leaves the tampered lock byte-unchanged (no rewrite) |
| T3a orphan workspace | `current package believes it's in a workspace when it's not` reproduced verbatim, nested under a synthetic parent workspace |
| T3b overlay cure | same nest with the overlay's `[workspace]` table — cargo accepts |
| T4 source drift | tampered canonical copy fed via `REPRO_SRC_DIR` — manifest check refuses |
| T5 cleanup path guard | the one valid scratch accepted; `/`, empty, foreign prefix, `..`-traversal, not-a-dir all rejected |
| T6 canonical untouched | `ops/ant-extsig` still matches the manifest byte-for-byte after all cases |

## Scope guards held

- No node/devnet/listener was started; the harness binary was **never
  executed** (its `main()` starts an 8-node LocalDevnet + Anvil — outside
  this lane). `cargo check`/`cargo build` only.
- No Docker/WSL daemons; ordinary local build tooling only.
- No credentials, no signing, no transfers, no production
  upgrades/resizes/deletions. The box saw two read-only ssh commands
  (`sha256sum`, `cat` of the lock/manifest).
- `ops/` and the root Cargo workspace untouched (digest-asserted;
  `git status` shows no change there).
- **The distinction is preserved:** this is a BUILD pin for the harness
  crate only. It is NOT the production auto-upgrade hold — runbook §3
  (node 0.18.1 auto-upgrade law, no disable switch, conditional timing)
  is unchanged and still untested against any hold. Nothing here receipts
  production behavior.
- The banked 2026-09-04 member-write devnet proof (`@147854c`) was NOT
  re-run; its re-run triggers (node-version change, ant-core bump, first
  v0.19 stable) are unchanged.
- Not built on the box: root free is 8.4 G (< the fence's 10 G floor) and a
  scratch build would add gigabytes — a box-side locked build is named as
  follow-up for Astra's environment, not attempted under the capacity fence.

## Proposed ops migration — a patch for Astra's receipt/rollback process, NOT a deployment

When Astra judges the harness should carry its pins in-tree, the smallest
migration is exactly what this runner rehearsed:

1. Replace `ops/ant-extsig/Cargo.toml` with the overlay content (the
   reviewable delta: rev pin, `=`-exact requirements, `[workspace]` table).
2. Commit `ops/ant-extsig/Cargo.lock` as the box lock **with the one-line
   `?rev=` source-id alignment already applied** (staged sha256
   `76fa7184…f4b3` above) — otherwise step 1's manifest cannot build
   `--locked` against it.
3. Per the ops-verbatim law, carry the same two files to the box's
   `~/ant-lane/ant-extsig/` in the same change (the box's current lock is
   the unaligned original; runbook §8's "never delete the BOX harness
   Cargo.lock" is satisfied by replacing-with-pinned, not deleting).
4. Rollback: revert the commit tree-side; box-side restore is the prior
   `~/ant-lane/ant-extsig/Cargo.toml` + lock (untouched until Astra acts).
5. Post-migration proof: `sh scripts/ant-extsig-repro/run.sh` against the
   NEW canonical digests (regenerate `source-manifest.sha256` in the same
   breath) plus one `cargo metadata --locked` on the box copy.

Until then `scripts/ant-extsig-repro/` remains the rehearsal surface and
`ops/` stays verbatim-untouched.
