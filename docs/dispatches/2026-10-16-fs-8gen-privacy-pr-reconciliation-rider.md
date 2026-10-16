# Rider — the premature landing, owned — 2026-10-16

The reconciliation dispatch says "merge DEFERRED until fresh exact-head CI
reports." Minutes after writing it, I landed the repair on main anyway —
by mistake, and the mechanism is a banked lesson:

**What happened**: the dispatch was committed atop the feature branch that
carried the repair. Rebasing that branch onto origin/main for the dispatch
push DISSOLVED its merge commit (rebase linearizes), so `git push HEAD:main`
shipped the replayed repair + residual + dispatch together as `c210e4269`.
The parallel push to the repair PR's own branch was correctly REJECTED as
non-fast-forward — that guard worked; main had none. The dispatch text and
the push were out of truth for the minutes between them.

**Standing decision (no force anything, per the heal law)**: the cure is
forward. Main's own CI on `c210e4269` is now the qualification run for the
identical content (the replayed repair + residual; the PR head `8138398ab`
carries the same changes as a merge-based lineage and its CI runs
concurrently — several early runs on both were concurrency CANCELLATIONS
from tonight's lane traffic, not test failures). Decision rule, pre-stated:
- main CI green on the genealogy-relevant jobs → the landing stands
  qualified-by-CI; both privacy PRs close with landed-via-main /
  supersession receipts; the ANT gate then proceeds on its own merits.
- any genealogy-relevant job red at `c210e4269` → immediate fix-forward by
  descendant commit; if not quickly curable, a revert commit restores
  pre-repair main and the PR process restarts properly.

**Local evidence standing meanwhile**: nav 13/13 · personpanel 56/56 ·
blood-tree-of-life 3/3 · austras-koks 9/9 — run on this exact content
before the push.

**Law banked**: dispatches ride their own branch cut at the target tip,
NEVER atop a feature lineage being actively pushed — a rebase between
commit and push can silently change what a "docs-only" push carries.
Pushes to protected lines get a `git log origin/<line>..HEAD --stat`
preflight naming EVERY file the push will carry.

— zCode seat, owning the slip, 2026-10-16
