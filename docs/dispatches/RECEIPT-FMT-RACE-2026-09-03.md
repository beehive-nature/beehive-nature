# RECEIPT — bundle 02b landed · a two-day fmt red found and cleared · a shared-checkout race caught, and healed by the lane that owned it (2026-09-03)

Seat: the night-shift coding seat (bclaude). Every claim carries the command
that produced it; where two seats reached the same finding independently,
both are cited. Nothing here rewrites history: `717d413` and its broken
window stay in main exactly as they happened. **Corrected once, in §7, by a
follow-up commit — the false claim deleted, the correction named.**

## 1 · The bundle order — what landed, what didn't

- **Read-back discrepancy, resolved by hash:** the attached bundle was
  `cowork-2026-09-02b.bundle` (sha256 `5c4254ca…6426`); the pasted command
  named `…02c.bundle` with sha256 `32b8ae48…`. No `02c` existed on this box
  and neither bundle on disk matched that hash. Landed what was attached and
  verified, under its own name.
- **`02b` landed as `e39845e`** ("swap raid: sort, register, zano verification,
  picture"): `docs/raids/SWAP-SORT-2026-09-02.md`, `docs/raids/SWAP-PICTURE.md`
  (byte-identical to the founder's attached copy), 5 lines in
  `docs/VERIFIED-FACTS.md`. `git bundle verify` clean; `git merge-base
  --is-ancestor` = fast-forward; `50e30e7..e39845e`. `02.bundle`'s head was
  already main — nothing to merge.
- **PEER-SORT-2026-09-02.md is NOT in the tree** (re-checked against
  `44dbde7`: still absent). It was attached in Downloads but is not in `02b`;
  it is evidently the commit that makes `02c`. Not hand-committed from
  Downloads — that would fork history under this seat's authorship and block
  `02c` from fast-forwarding. **Owed from the founder: the `02c` bundle.**
  Until it lands, z3.3/z3.2's read-instruction
  (`docs/raids/PEER-SORT-2026-09-02.md` §1/§5) points at a file that isn't
  there.

## 2 · Main had been red for two days — found by opening the run, not the push

`tests` had failed on **`Check formatting`** on every push since `2d34391`
(2026-09-01). Confirmed by reading the runs: `33488537672` (`2d34391`) and
`33488818583` (`68df645`) both fail on the identical step; build and tests
pass in both. Every landing since — the swap raid, the bdispatch commits —
sat on a red receipt. This seat also pushed the bundle before checking the
standing verdict; named here on itself.

Unformatted set (`cargo fmt --all -- --check`, rustfmt 1.9.0-stable): 102
diffs in `crates/banchor` (70) + `crates/bheart-signer` (32). Fixed forward
as `717d413` — and 19 of its 20 files were exactly that: `diff <(git show
efc8957:$f | rustfmt) <(git show 717d413:$f)` IDENTICAL for every file but
one, and CI's rustfmt 1.98.1 accepted all 19.

## 3 · The race — `717d413` swept another lane's mid-edit, and this seat did it

**What happened.** This checkout is shared. Between this seat's local
verification (fmt/build/test, all green at that instant) and its `git commit
-- crates/banchor crates/bheart-signer` minutes later, the lane building the
qwen node-cap ladder edited `crates/banchor/src/axtree.rs` in the same
working tree — `format_with_cap`, `DEFAULT_MAX_NODES`, a `max_nodes`
parameter on `walk()` — at a moment when the three recursive `walk()` call
sites still passed 7 arguments. A pathspec commit records the working tree
as it is at commit time; `717d413` carried that broken intermediate under a
message claiming "zero semantic change." CI on `717d413`: `error[E0061]:
this function takes 8 arguments but 7 arguments were supplied` ×3 —
`Build workspace` red, `Test workspace` red, and the only two `Check
formatting` diffs left were inside the swept code. `4ab1a2f` was pushed on
top of it and inherited the same red.

**Evidence, definitive:** the one differing file is `axtree.rs`, 18 lines
beyond pure fmt. Parent `efc8957` has no `max_nodes` anywhere. The working
tree's `axtree.rs` mtime (17:04:13) is six minutes after the commit
(16:58:01) and by then carried all four completed call sites. `qwen.rs`
(holding `CAP_LADDER`) existed only in the working tree.

**Corroborated independently by the lane that owned the code**, in
`44dbde7`'s own message: *"origin/main carried a snapshot of
crates/banchor/src/axtree.rs from the exact moment between my
format_with_cap signature change and the call-site sed (the concurrent
fmt/bdispatch sessions committed and pushed my in-flight intermediate)."*
Two seats, one diagnosis, reached separately. The "fmt session" is this one.

**The mechanism, so it is not repeated:** verification and commit are not
atomic on a shared checkout. A pathspec commit must be re-verified at the
commit instant (`git diff --cached` against what was tested), or made from a
separate worktree — the shared-checkout law's whole point. This seat has used
a separate worktree for everything since.

## 4 · The repair this seat prepared — and withdrew, unpushed

In `.claude/worktrees/fmt-race-fix` (branched from `717d413`; the shared
checkout untouched), the surgical fix was built and fully verified:
`axtree.rs` restored from `efc8957` + rustfmt → `diff` against
`rustfmt(efc8957 blob)` IDENTICAL, zero swept tokens, `cargo fmt --all --
--check` exit 0, `cargo build --workspace --locked` (CI's exact command) exit
0, `cargo test -p banchor -p bheart-signer` 38 + 17 = 55, one file changed.

**It was never pushed, and that was the right call.** On the pre-push fetch,
`origin/main` had moved five commits: `4ab1a2f` (bdispatch), `da00af2` (M2:
the qwen loop, `format_with_cap` parameterized, `qwen.rs`), `11ac3c3`
(NAMING RULED: `bheart-signer → bsigner`, old `bsigner → btrezor`),
`4e640e1` (z3.2 verifier lanes), and **`44dbde7` — "CI RED HEALED"**: the
feature's owner landed the completed call sites (verified here on the
`44dbde7` blob: `walk(` at lines 239/287/310/365, `max_nodes` as the closing
argument at 247/295/318/373, `fn walk` signature `max_nodes: usize` at 261,
`qwen.rs` in tree), re-applied `cargo fmt` across the renamed organ crates,
and reported the battery green on the pushed tree: banchor 44 + bsigner 17 +
btrezor 13 = 74/74. Pushing a restore-to-pre-race over that would have
regressed a landed feature. The worktree was reset to `44dbde7` and the
restore discarded; this file is the only thing it carried.

## 5 · State of the shared checkout — not this seat's to reconcile

At the time of the race the shared working tree held a **staged** rename
(`bheart-signer → bsigner`, `bsigner → btrezor`), a staged dispatch file, and
`tools/bdispatch/watcher.py` edits — residue of work that landed on origin
from another worktree (`11ac3c3`, `4ab1a2f`). Its owner reconciled it while
this receipt was being written (local `main` moved to `44dbde7`). Left
exactly as found throughout.

## 6 · One reproducibility note, not actioned (no new process this sprint)

`rust-toolchain.toml` pins `channel = "stable"` — floating. CI resolved
1.98.1 (released 2026-09-01) on every run today; this box has 1.97.1 with
rustfmt 1.9.0. They agreed on 19/20 files by the stability of rustfmt across
minors, not by pin. Flagged for the founder: pinning to a version is a
one-line change and a real decision, not this seat's to make.

## 7 · CORRECTION — a slow install, not a hang; this seat misread the clock

The first commit of this file (`2746129`) carried a §7 claiming the `tests`
workflow's `node` job was **hung** on `4e640e1` and `44dbde7` — "30+
minutes," "runs to GitHub's 6-hour default," "an existing battery choking on
`4e640e1`'s surface changes," "flagged for the lane." **That was false, and
the error was this seat's own arithmetic:** the reading was taken around
23:32 on a job that started 23:26:48 — about **six minutes** elapsed, not
thirty — against a ~2-minute baseline. Slow, and read as hung. Per the
false-signal law the claim is deleted here, not softened, and replaced with
the step timings read after completion:

| run | `node` job | where the time went |
|---|---|---|
| `4e640e1` · `33817624750` | **success**, 23:26:37 → 23:34:27 (7m50s) | dependency install (cold) |
| `44dbde7` · `33817636397` | **success**, 23:26:48 → 23:36:29 (9m41s) | `shared setup — install` **7m23s** (23:26:53 → 23:34:16); then every battery in seconds — Onboarding e2e 1s · University smoke 7s · No page errors 48s · Language 1s + 1m11s · Fleet 2s + 2s |
| `2746129` · `33818075771` | **success**, 23:33:03 → 23:35:47 (2m44s) | install cached — back to baseline |

No battery choked on anything. `4e640e1`'s surfaces, `spend-audit.js`, the
verifier lanes — all green under CI's headless run, in seconds. The two slow
runs were a cold npm/Playwright install, nothing more. What survives of the
original §7 is one latent, true observation, stripped of its alarm:
`.github/workflows/tests.yml` sets no `timeout-minutes` on the `node` job, so
a *genuine* hang would run to GitHub's 6-hour default — a one-line workflows
change, Lane A's file, a process decision, and not urgent.

## CI, read not inferred

| push | workflow | note |
|---|---|---|
| `e39845e` (bundle 02b) | failure — `Check formatting` | inherited since `2d34391` |
| `717d413` (fmt) | failure — `Build workspace` E0061 ×3 | the race, this seat's |
| `4ab1a2f` | failure | pushed onto the race window |
| `4e640e1` | failure — `test` job only (race window); `node` success 7m50s | z3.2's verifier lanes |
| `44dbde7` (heal) | **SUCCESS** — `test` (Build · Test · Check formatting) 23:29:12 · `static` · `node` 23:36:29 · `secret-scan` · `pages` | the lane's own repair: the two-day formatting red and the race-break both closed on main |
| `2746129` (this file, v1) | **SUCCESS** — `test` · `static` · `node` 2m44s · `secret-scan` | docs only |
