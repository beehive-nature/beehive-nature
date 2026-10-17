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

**Addendum (CI watch, 2026-10-16 ~17:2x MDT):** fleet still saturated — every
run for `c210e4269` / `d938ba682` (and the sibling lanes' pushes) remains
QUEUED, none in progress; all of PR 347's check "failures" verified as the
concurrency-cancellation class (uniform 2m11s / 0s with the higher-priority-
request annotation), NOT test verdicts. No CI verdict exists yet. The
pre-stated decision rule stays armed for the next wake that finds the fleet
drained (daily cadence or any seat): green → landing stands + the two PRs
take their landed-via-main / supersession receipts and close; red →
fix-forward or revert descendant. This watch does not loop.

**Addendum 2 (founder-review safeguard, 2026-10-16 evening):** the closure
bar for the two privacy PRs is RAISED by verified review — before either PR
takes its landed-via-main / supersession receipt and closes, the executing
wake must verify (a) the relevant privacy tests EXECUTED SUCCESSFULLY
against the LANDED implementation (the eternal genealogy step + static +
node + meter actually ran and passed on the landed head — a cancellation
supplies neither success nor failure), and (b) BOTH PRs' unique
requirements are covered on main: the three repairs (deceased-entry
rooting, tol-space focus transfer, grandparent self) AND the ported
nonduplicate residual (CI wiring, austras spatial e2e, grandparent-self
e2e, founder-ruling doc). Only then the receipts; a genuine regression
routes to fix-forward or explicit revert with evidence. Fleet re-checked
this turn: still saturated (1 pending, rest queued, tip 6ebef2584) — no
verdict, no polling loop, no new automation.
