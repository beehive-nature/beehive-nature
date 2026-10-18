# 2026-10-17 — ci-speedup lane, phase 1: the cache patch lands on the seven uncovered jobs

The founder handed this seat the CI commit-to-test-cycle report of
2026-10-17 (runner-wait measurements, a prepared cache patch, a scheduling
change, browser-suite and SAW opportunities). This dispatch opens the lane
and lands **phase 1: the prepared cache patch**, rebuilt against current
main and fully revalidated. Phases 2–4 are spec'd below with their next
owners; nothing in them was started this session.

## One material correction to the handoff

The handoff's `ci-speedup-2026-10-17.zip` lived at a sandbox path
(`sandbox:/workspace/scratch/…`) that does not exist on this box — no copy
in the repo, the shared checkout, or Downloads. The patch was therefore
**reconstructed from the report's own written spec** (it names every
target, input, and preservation rule), not applied from the zip's bytes.
Everything the report claimed for the patch statically was re-earned
here against current main (receipts below). Also: the report was prepared
against `1c8727f1d`; this branch is cut from main `a2b2abf7d` (fetched
first, per law) — the three target workflows were byte-identical between
those two commits for every hunk this patch touches, so the re-anchor
changed nothing.

## What landed (54 insertions, 0 deletions, three workflows)

All additive. Every existing build, test, audit, proof, and
sabotage-control command is untouched — a restored cache changes no
verdict, and on a cache miss every job runs exactly as before.

1. **`tests.yml` (job `test`)** — the existing pinned rust-cache gains a
   `workspaces` map: the root workspace plus the three independent ones
   the job drives by `--manifest-path` (`rust/bsafe-host`,
   `ops/x402-door`, `ops/ant-writedoor` — each with its own `[workspace]`
   and `Cargo.lock`, verified in-tree). The report measured the x402 step
   alone recompiling ~78 s of tests per run that the root-only cache
   never saw (run 39013417846, job 117340509983).
2. **`btungsten-pq.yml` (all six jobs)** — the same pinned rust-cache,
   new everywhere: pq00, pq01, pq11, pq05 plain; **pq12 with
   `cache-all-crates: true`** so `cargo install cargo-audit --locked
   --version 0.22.2` (measured 181.6 s of a 187 s step; run 39013417840,
   job 117340511416) recognizes its own restored installation and skips
   the rebuild — the audit itself always runs, and its gate-2
   record-don't-block semantics are unchanged; **pq10 with Plonky3's own
   workspace mapped** (`crates/btungsten-p3count`, own lockfile).
3. **`bnrose-rust-001.yml` (job `twin-grid`)** — cache for the
   `bnrose-grid-agreement` release build. The `lane` job's existing cache
   is untouched; `cryptol-twin` builds no Rust and stays uncached.

**Save policy on the seven NEW caches:** `save-if: github.ref ==
'refs/heads/main'` (rust-cache already skips saving failed jobs). PR runs
restore main's warm cache and never churn the 10 GB repo cache budget
with per-PR entries; the first candidate after this lands runs cold
until a main push seeds the caches — expected, not a defect.

## Validation receipts (this session, against `a2b2abf7d` originals)

- **Strict YAML parse** of all three changed workflows (PyYAML 6.0.3,
  duplicate-key-rejecting loader, bare-`on` normalized and asserted
  present as an event mapping; CRLF absence checked). PASS.
- **Non-cache content identical:** after stripping `Swatinem/rust-cache`
  steps from both sides, each changed workflow parses structurally equal
  to its `origin/main` original — every job, step, command, env, and
  gate byte-for-byte. PASS on all three.
- **Structural asserts:** 4-line workspace map in `tests.yml` (root kept
  explicit); exactly one cache step in each of the six PQ jobs; pq12
  `cache-all-crates: true`; pq10 plonky3 map; twin-grid main-only save;
  lane cache config unchanged; cryptol-twin untouched. PASS.
- **CI-shape gate:** `node scripts/lint-ci-shape.mjs` → **139/139 suite
  steps guarded**, the same count as before the patch (caches are
  `uses:`-only steps, exempt by the gate's own law).
- **Diff shape:** `git diff --stat` = 54 insertions / 0 deletions across
  the three workflows; validator script and extracted originals live
  OUTSIDE the worktree (nothing stray staged).

## Hosted receipts (updated same day — PR, merge, seeding)

- **PR #462 CI: 18/18 runs green, zero red** — nine push + nine
  pull_request executions of the branch `zcode/ci-speedup-2026-10-17`
  (runs 39057230796–39057237089). The PR-event `tests` run (39057237019)
  shows every job green (test, static, node, wallet, eternal, meter,
  formal, formal-cryptol-leg) and its test job's input dump shows the
  runner received all four workspace mappings plus rust-cache's own
  defaults. The PR-event `bTunGsTeN PQ` run (39057237018) shows all six
  jobs green with `save-if: false` evaluated on the PR ref — the
  main-only policy working as designed; pq12's cold run still installed
  cargo-audit (no warm cache existed yet), and `/home/runner/.cargo/bin`
  entered the cache scope (cache-all-crates active).
- **Merged to main at `988e7805c`** (mergeStateStatus CLEAN before the
  click; no-stall law — the seat executed the merge itself).
- **Seeding CONFIRMED from the repo cache store** (gh cache list,
  2026-10-17, all scoped `refs/heads/main`): `v0-rust-pq00-teeth` 149.8 MB
  (22:39:58), `pq01-vectors` 247.3 MB (22:41:46), `pq05-xwing` 159.8 MB
  (22:40:19), `pq10-plonky3` 30.6 MB (22:41:04, key hash `2c29160b` ≠ the
  root-workspace jobs' `a0d4a5cf` — Plonky3's own lockfile is being
  hashed, the workspace mapping is live), `pq11-classic` 169.9 MB
  (22:40:36), `pq12-taproot` 315.9 MB (22:44:00), `twin-grid` 346.6 MB
  (22:41:53). The tests.yml cache re-keyed from `…-a0d4a5cf` (root-only,
  1078 MB) to `…-ec3650f2` (workspaces config, 936.9 MB). Seeding-run
  jobs that matter: BNROSE 39075936391 green, PQ 39075936364 green.

## Warm-cache measurement (rider `0a7233678` vs seed `988e7805c`, same day, identical job definitions)

The seeding push (cold: new cache keys, nothing to restore) versus the
receipts rider push (warm: full-match restores). Step timings from the
Actions jobs API; job totals wall-clock.

| job | cold seed | warm | net |
|---|---:|---:|---:|
| tests.yml `test` | 8m50s | 5m56s | **−2m54s** |
| pq12-taproot | 4m54s | 1m19s | **−3m35s** |
| twin-grid | 2m46s | 46s | **−2m00s** |
| pq01-vectors | 2m38s | 55s | **−1m43s** |
| pq11-classic | 1m29s | 36s | −53s |
| pq05-xwing | 1m12s | 46s | −26s |
| pq10-plonky3 | 1m58s | 1m54s | −4s (wash) |
| pq00-teeth | 51s | 48s | −3s (wash) |
| **eight jobs** | **24m38s** | **13m00s** | **−11m38s (−47%)** |

Step-level receipts: pq12 audit gate 2 **174s → 5s** (the pinned
cargo-audit install recognized and skipped; the audit itself ran); the
test job's **Build workspace 161s → 32s**; twin-grid's grid step **130s →
7s**; pq01's KAT battery **96s → 18s**. Restore cost is inside every
number above — worst case +13s (the test job's restore step 11s → 24s,
the ~937 MB workspaces cache); warm post-save dropped 23s → 0s (nothing
changed, nothing re-uploaded).

Honest boundaries, measured not assumed:

- **pq10 is a wash despite a full-match restore** (log: `Restored from
  cache key "v0-rust-pq10-plonky3-…-2c29160b" full match: true`, ~31 MB):
  its runtime is dominated by the 128-shape model tests and the
  n=16384 prove runs, not compilation. Same for pq00. The report's
  warned failure mode (restore costing more than compilation saves) did
  not occur anywhere — worst observed is break-even.
- **The x402 step is test-execution-bound on today's runners**: warm
  recompiled **0** crates vs **272** cold (the mapping mechanically
  works, proven), yet the step read 76s cold vs 82s warm — the compile
  saving vanished into run-time noise. The report's ~78s-compile
  baseline came from run 39013417846; cold-seed here compiled 272 crates
  inside a 76s step, i.e. that runner generation is simply faster than
  the report's. The mechanism is live; the per-step payoff on this
  hardware is ≈0.
- Warm numbers hold while lockfiles hold: any dependency bump re-keys
  the cache and the next run re-seeds (inherent rust-cache behavior).
- What this patch cannot touch: **queue time**. The rider's `tests`
  workflow still waited ~28 minutes for a runner. Phases 2–4 own that.

Verdict against the acceptance rule (**net time saved**): PASS —
11m38s of runner execution returned per warm main push on the eight
measured jobs, at +2s–13s restore cost per job and ~5.5 GB of the
10 GB cache budget, all main-scoped.

## What is NOT yet claimed

- Phases 2–4 below are **unstarted**.

## Phase 2 — one expensive candidate path (next owner: this lane, next session)

The report's first-priority scheduling change: `6d768d7ec` recorded 18
workflow executions (nine push + nine pull_request) for one revision,
because #452's concurrency groups include the event name. The change —
one expensive qualification path per candidate, main verification
separate — must preserve two facts the report established:

1. **Push and PR identity checks differ in coverage** (on `6d768d7ec` the
   push `tests` run FAILED §7 identity while the PR run passed — runs
   38991102588 vs 38991105731). Identity and secret scanning stay
   complete for their respective events; `tests.yml`/`secret-scan.yml`
   are deliberately outside #452's cancellation for exactly this reason.
2. **PR head ≠ tested checkout in general** (synthetic merge commit;
   `7c87a6be1`/base `1c8727f1d`/checkout `6f0f8132` had matching trees
   THIS time, established by git-object check — that is per-candidate
   evidence, not a standing fact). The qualification receipt must
   identify actual checkout, tree, PR head, base, event, run, attempt.

## Phase 3 — browser batteries (owner: wallet-lane successor seat)

Wallet job: three style batteries ~5 m each, serial = 15 m 36 s (run
39013417846, job 117340509905). Experiment: bounded parallel execution,
separate state dirs/ports/contexts. Constraints: every style and
assertion stays covered; more jobs under runner saturation makes waits
WORSE, so this follows phase 2, not precedes it; the CI-shape law's
static-independence and always()-suite rules hold.

## Phase 4 — SAW obligations (owner: bTunGsTeN proof seat)

ML-KEM NTT 33 m 34 s, ML-DSA NTT 41 m 15 s, WB001 18 m 35 s. Already
separate jobs and already decomposed — the report's next steps are
per-obligation timing, whole-tree memory measurement, bounded
concurrency across WB001's independent blocks (after a small
orchestration refactor; the runner is serial today and naive double
launch collides on shared build/output paths), and NTT splits only at
valid dependency boundaries. Acceptance rule unchanged: every
obligation and negative control keeps its correct verdict, same scope
and assumptions; a cached tool never becomes a fresh proof.

## Standing laws this lane obeyed

Worktree law (all staging from `wt-zcode-ci-speedup`, explicit pathspecs,
fetch-before-labor); commit canon (this message); CI-shape gate re-run
before push. The 81%-wait measurement (wallet job, main `1c8727f1d`: 2 h
08 m waiting vs 30 m execution) is the report's, from Actions run
39008052140 — cited, not re-derived.
