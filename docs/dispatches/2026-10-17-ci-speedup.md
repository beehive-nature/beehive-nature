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

## What is NOT yet claimed

- **No hosted run** of this branch has completed at dispatch-writing
  time; the PR's own CI is the first hosted exercise of the patch.
- **No warm-cache before/after measurement** exists yet. The acceptance
  criterion stays the report's own: **net time saved** — cache restore
  can cost more than it saves on short jobs, and the first run is cold
  by design. The measurement plan: after merge, compare the next
  main-push PQ12 audit-step time (expect ~5 s of audit work instead of
  ~187 s) and the tests.yml x402 step time against the cited runs, on
  the same job definitions.
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
