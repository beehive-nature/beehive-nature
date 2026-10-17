# FS 8-gen privacy PR 346 lifecycle repair + order27 maintenance — 2026-10-16

Founder-directed independent review handed zCode the lead; this dispatch is
the maintenance receipt. No code changed anywhere in this turn.

## Priority 1 — PR #346 lifecycle repair (EXECUTED)

**The defect**: main commit `54057d49f` (the order27 independent-verification
dispatch) ended a STATUS sentence with the words "ANT gate" + a closing verb
+ "#346" + "/#347 OPEN" — GitHub parses that verb+reference pattern in commit
messages landing on the default branch as a lifecycle instruction, and
**PR #346 ("Genealogy: keep living relatives out of the tree UI") flipped to
CLOSED-unmerged at 2026-10-16T21:10:02Z** with no review action behind it.

**Timeline verified before acting** (never act on a review's GitHub claims
alone):
- `54057d49f` is an ancestor of origin/main; full message read — the phrase
  is the last line's status sentence.
- `gh pr view 346`: state CLOSED, `mergedAt` null, `closedAt`
  2026-10-16T21:10:02Z.
- `gh api issues/346/events`: the closed event carries
  `commit_id: 54057d49f…` — closure BY COMMIT KEYWORD, not by any reviewer.
- PR #347: OPEN, untouched (updatedAt still 10-05).

**The repair**: `gh pr reopen 346` → verified state OPEN, `closedAt` null,
`mergedAt` null — **no commits changed, no review state fabricated**. Audit
comment posted on the PR (issuecomment-6224955199) documenting the mechanism,
the evidence, and the reopen rationale; #347 explicitly preserved.

**Closure-keyword phrasing law (banked estate-wide)**: status sentences in
commit messages must keep closing verbs away from issue/PR references —
write "PR 346" or "the privacy PRs" in prose, and never let
close/fix/resolve-family verbs sit adjacent to a `#ref` that must stay open.
The same care applies to PR descriptions. If a keyword-closure happens again:
verify the issue-events closed event's `commit_id` (proves non-review
closure) → reopen without touching commits → audit comment.

## Priority 2 — four-state oracle + the byte-wording correction

Four-state oracle law STANDING (adopted per founder directive, rides every
wake's oracle). This turn's row set, reconciled across both 10-16 seats:

| State | Latest | Note |
| --- | --- | --- |
| AUTHENTICATED | true | wire-proven both seats |
| API_READABLE | true | v8 details 200 both seats |
| PAGE_RENDERABLE | false | control-ark Page-Not-Found while authed — 3 authed occurrences, two independent seats |
| PROVIDER_WRITABLE | false for KWJ4-XBD | readOnly:true 6th confirmation; class untested-by-policy |

**Correction (withdrawn wording)**: my order27 rider called the wire read
"byte-identical to every authed read since 10-09" (120,649 B). The
verification pass's own read returned **120,644 B**. That five-byte
variation is now documented and the "byte-identical" claim is withdrawn for
cross-observation use: correct wording = the payload is stable in shape and
within 5 bytes across the 10-09→10-16 authed observations (120,644–120,649 B);
identity/auth verdicts never ride on byte-equality of this wire.

## Priority 3 — session preserved

No FamilySearch SPA attempts this turn; the browser pane was not touched;
the robots.txt park stands undisturbed. The tasks page remains
**unreadable for this wake, not proven empty** — no new attempt was made and
none was warranted under the session-outranks law.

## Priority 4 — isolation maintained

The five founder-ruling cases (QG8Q-V3C5/V3CN/P964 title-vs-wire class,
Christen Olsen cluster merge, Daniel Briggs duplicate, Norway parish, Don
Ray search pass) remain unresolved and founder-owned. The ~7,037-record
rendered-DOM image frontier is a **separate, unexecuted lane** — not part of
the terminal 376-entry queue and not claimed by it.

## ANT

Publication remains **blocked/disabled** until the required privacy
protections are verified. PR #346's intended review state is restored; #347
open; nothing merged; nothing re-labeled. Codex remains the owner of the
privacy work itself.

## Ledger for this turn

GitHub state changes: the reopen of PR #346 + one audit comment — nothing
else. Zero FamilySearch mutations. Zero code changes. Zero corpus writes.
GitHub state was not changed by the review that ordered this; this dispatch
is the repair receipt.

— zCode seat, order27 maintenance, 2026-10-16
