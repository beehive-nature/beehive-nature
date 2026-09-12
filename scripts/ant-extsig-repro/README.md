# ant-extsig-repro — the isolated reproducible-build harness

**Seat:** z1.c, Sprint 2 (assignment
[#10 comment 5647975452](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647975452);
**r2 corrections** per Astra's review
[#10 comment 5648317459](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5648317459)
(physical path guard, failure/interruption finalizer, strict lock-refusal
test). Inherits the accepted fence-readiness runbook + acceptance receipt
(`9557aaeb`: `docs/runbooks/autonomi-fence-readiness.md` rev 4, 50/50) —
this is NEW work on top of it, not a reopening of the observer.

## The problem it solves (runbook §6, receipted)

The canonical member-write harness `ops/ant-extsig` cannot prove what it
builds against:

1. **No lockfile in-tree** — a plain build resolves `ant-core` from
   ant-client HEAD, which has already drifted past the banked revision
   (`969ed008d9cd39bbfe6466bc5ff7943914565994`); `--locked` guards nothing
   until a lock exists ("cannot create the lock file … because --locked was
   passed").
2. **Caret requirements** — `ant-node = "0.18.1"` / `ant-protocol = "2.3.5"`
   accept any semver-compatible newer minor/patch.
3. **Orphan workspace** — the copy sits under the repo-root workspace
   without being a member, so even an in-tree build dies with "current
   package believes it's in a workspace when it is not".

The only place the banked pins are reproducible today is the box copy
(`~/ant-lane/ant-extsig/Cargo.lock`, `cargo metadata --locked` exit 0). This
harness makes them reproducible from the repo — WITHOUT touching `ops/`
(production-mirrored, verbatim law) or the root Cargo workspace, and without
creating a second maintained copy of the harness source.

## What it does

`sh scripts/ant-extsig-repro/run.sh` — one fail-closed pass:

1. **Source-manifest gate** — every file under `ops/ant-extsig` must match
   `source-manifest.sha256` (content AND exact file set). Any drift (a byte
   changed, a file added or removed) refuses the run: the committed overlay
   and lock are only meaningful against that exact source.
2. **Candidate-lock pin gate** — `lock/Cargo.lock` must be byte-identical to
   the banked box lock (sha256 `0312ab19…aa86`, pulled read-only 2026-09-12)
   AND must itself carry the banked pins: `ant-core` at git rev
   `969ed008d9cd39bbfe6466bc5ff7943914565994`, `ant-node` 0.18.1,
   `ant-protocol` 2.3.5, exactly one ant-client git source.
3. **Isolated copy** — the canonical source is copied into a validated
   `mktemp` scratch dir; the overlay manifest (`overlay/Cargo.toml`, the
   reviewable diff: rev pin + `=`-exact requirements + `[workspace]`
   detachment table) replaces the copy's manifest; the candidate lock is
   staged in with a ONE-LINE source-id alignment (the box lock spells the
   ant-core git source `git+URL#<commit>` because its manifest dep was
   unpinned; the overlay's `rev =` pin makes cargo expect
   `git+URL?rev=<commit>#<commit>` — same commit, same graph, different
   spelling; the runner refuses if the alignment touches anything but that
   single line, and the COMMITTED lock stays byte-identical to the box's).
   The canonical tree's digest set is asserted UNCHANGED after the run.
4. **Locked graph + compile** — `cargo metadata --locked` (explicit graph
   receipt), then `cargo check --locked`. The harness binary is NEVER
   EXECUTED: its `main()` starts an 8-node LocalDevnet + Anvil, which is
   outside this lane (no node/devnet/listener). `REPRO_BUILD=1` adds
   `cargo build --locked` on top.
5. **Second locked resolution** — a fresh scratch copy, same overlay + same
   committed lock, another `cargo metadata --locked`; the lock must come out
   byte-identical. Lock sha is asserted unchanged after EVERY cargo call.
6. **Validated PHYSICAL cleanup + finalizer** (Astra r2) — scratch dirs are
   removed only after passing the path guard, which canonicalizes BOTH the
   mktemp base and the target PHYSICALLY (`pwd -P`, symlink-transparent),
   restricts cleanup to OWNED DIRECT scratch children of the base (this
   runner's name prefix, no deeper path segment, no `..` traversal), and
   rejects a symlink whose logical path sits under the base but physically
   escapes it. An EXIT/HUP/INT/TERM finalizer is installed the moment
   scratch ownership is acquired: it retains the original failure status,
   validates before cleanup, honors `REPRO_KEEP` with an explicit kept-path
   receipt, and asserts a canonical-tree baseline taken BEFORE staging on
   every exit — success, failure, or interruption. On any doubt the
   directory is KEPT and named, never deleted.

The runner also honors the estate's `rust-toolchain.toml` pin inside the
scratch dir (where rustup's directory walk can't see it), so the isolated
build rides the same toolchain as CI and the box.

`sh scripts/ant-extsig-repro/selftest.sh` — T1a/T1b missing lock (runner
refusal + cargo `--locked` refusal), T2a/T2b tampered lock (banked-sha
refusal + cargo refusal REQUIRING the expected lock-update text — an
unrelated tool/network failure fails the case — with the lock left
byte-unchanged), T2c an offline stub-cargo control proving an unrelated
failure does NOT satisfy that matcher, T3a/T3b orphan-workspace error
reproduced verbatim then cured by the overlay's `[workspace]` table, T4
source drift refused, T5a the cleanup path guard's verdict set (valid direct
child accepted; `/`, empty, foreign prefix, `..`-traversal, not-a-dir,
nested subpath rejected), T5b the symlink-escape regression (logically
under the base, physically outside — rejected via `pwd -P`; a NAMED SKIP
where the platform cannot create a true symlink, e.g. Git Bash without
native-symlink privileges), T7/T8/T8b the finalizer regressions (injected
staging failure, injected cargo failure via stub, TERM interruption
mid-run — each must clean the validated scratch or name a kept path, keep
the canonical baseline, and never touch unrelated neighbors), T9 the
unrelated-neighbor survivor, T6 the canonical tree still byte-identical.

## Files

| path | role |
|---|---|
| `run.sh` | the runner (laws in the header comment) |
| `selftest.sh` | the refusal/case suite |
| `overlay/Cargo.toml` | the reviewable manifest delta (pins + workspace table) |
| `lock/Cargo.lock` | the committed candidate lock — the box lock, byte-identical (the one-line `?rev=` source-id alignment happens at staging, in the copy) |
| `source-manifest.sha256` | digest set of the canonical `ops/ant-extsig` files |

## Honest limits

- **The lock is OBTAINED, not reconstructed.** The candidate lock is the box
  lockfile as it stood (resolved by cargo during the 2026-09-04 lane at the
  then-HEAD `969ed008`, then frozen). This harness proves the banked graph
  still satisfies the pinned requirements and still compiles — it does not
  claim an independent `cargo update` would regenerate it byte-identically
  (transitive crates.io versions move; a fresh resolution WOULD differ —
  that is exactly why the lock is committed).
- **This is a BUILD pin only.** It pins what `ops/ant-extsig` compiles
  against. It is NOT the production auto-upgrade hold: the box's ant-node
  0.18.1 auto-upgrade law (runbook §3) is untested against any hold and
  remains an open, separately-owned question.
- **No execution proofs.** No devnet run, no member-write, no listener. The
  2026-09-04 member-write proof stays banked at `@147854c`; its re-run
  triggers are unchanged.
- **Eventual ops migration is NOT here.** Moving the overlay into
  `ops/ant-extsig/Cargo.toml` + committing the lock there must go through
  Astra as a patch inside the ops-verbatim receipt/rollback process
  (in-tree = what runs on the box). This runner is the rehearsal for that
  patch, not the patch.
