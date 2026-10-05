# PR 243: independent scanner re-review and Aikido coverage receipt

Reviewed head: `573240c98` on PR #243. Review date: 2026-09-28.
Review seat: Codex, working in `C:/Users/travi/wt-astra-pr243-rereview`.

## Scope and verdict

This is a re-review of the scanner repair in `3d4e39e6e` and the source
self-match cure in `573240c98`, not an approval of every change in PR #243.
Origin was fetched before inspection. The live PR still identified
`573240c98` as its head and reported OPEN / CLEAN at inspection.

Source inspection confirms that `scripts/secret-scan.sh` diff mode now
applies the `ops/nixos/` exclusion only to `hex_added`. PEM and keyshape
consume `added`, which retains that path. Other pre-existing exclusions
remain in both streams; this review does not certify their policy.
The runtime-assembled PEM fixture avoids the literal source self-match.
The repair does not change the tree-mode detector pipelines.

No further scanner implementation change was required by this review.
However, a separate real false-pass defect was found in the installed-hook
test and repaired in this follow-up. The scanner acceptance does not imply
acceptance of the old hook-test proof or the whole PR.

## New finding and repair: an empty commit masqueraded as hook refusal

`e2e/hooks-installed.test.sh` first committed an unmarked vector with no hook,
then installed the hook and staged the exact same bytes. Its rejection check
accepted any nonzero commit exit. Git refused because there was no staged
change, so the test passed even if the scanner did nothing.

Red receipt: the original test was run in a disposable harness with a scanner
stub that unconditionally prints clean and exits 0. All rows passed and the
test exited 0. Its purported refusal printed "nothing added to commit".

The repaired test stages a different line containing the same generated
vector, requires a nonempty staged delta, requires the scanner's hex-block
diagnostic, and verifies that refusal leaves HEAD unchanged. This prevents
an empty commit or unrelated git failure from satisfying the rejection row.

Post-repair real-scanner and disabled-scanner validation is recorded below.

## Local verification

Tests use Git-for-Windows, with only runtime-generated synthetic fixtures.
No real credentials were used or recorded. The independent matrix stages
one fixture at a time so one working detector cannot hide a broken one.

- Scanner selftest: S1-S9 passed, exit 0, using source exported from the reviewed head.
- Independent isolated matrix: 16/16 passed, exit 0 (eight isolated cases, both modes).
- Push-preflight selftest: P1-P11 passed, exit 0; P11 commits the scanner itself
  in its throwaway repository and exercises the cross-enforcer wiring.
- Original hook installer and test exited 0, but that original refusal row
  was invalid evidence for the reason above.
- Repaired hook test: all five reported checks passed, exit 0, including
  an actual staged vector refused with the scanner's diagnostic.
- Disabled-scanner mutation after repair: correctly rejected, exit 1,
  "FAIL hooked commit accepted a 48+ hex vector". The harness confirmed
  that expected failure. The original test accepted the identical mutation.

The matrix covers each WIF form separately, nsec, PEM, the allowed kit hex
pin, a blocked hex pin outside the kit, a forbidden filename, and a marked
WIF fixture. Each runs through both diff and tree mode.

| Isolated fixture | Diff | Tree |
| --- | --- | --- |
| Unmarked uncompressed WIF in kit | blocked (1) | blocked (1) |
| Unmarked compressed WIF in kit | blocked (1) | blocked (1) |
| Unmarked nsec in kit | blocked (1) | blocked (1) |
| PEM header in kit | blocked (1) | blocked (1) |
| Public hex pin in kit | clean (0) | clean (0) |
| Same hex pin outside kit | blocked (1) | blocked (1) |
| Secret-bearing filename in kit | blocked (1) | blocked (1) |
| Marked synthetic WIF in kit | clean (0) | clean (0) |

Local whole-repository CI was not rerun. Live GitHub check evidence covers
the full reviewed head; these local probes specifically exercise the repaired
boundary and the cross-enforcer self-match failure.

## Live CI and Aikido: exact limits of the green badge

GitHub reported all executed checks successful at the reviewed head:
scan, test, static, node, eternal, meter, wallet, and Aikido check code.
There were no pending checks in that snapshot. Aikido Deep Review was SKIPPED.

The Aikido check payload gives the reasons, rather than requiring inference:

- Deep Review: "Aikido skipped this review because there are no credits left in the wallet."
- Check code: three new MEDIUM issues, below its CRITICAL blocking threshold;
  no issues solved. Therefore SUCCESS is not a zero-finding result.
- The three Aikido comments concern default root users in Dockerfile.storage,
  Dockerfile.caddy, and Dockerfile.relay. These remain findings to investigate.
  Source inspection shows no explicit final-stage USER in those files;
  inherited image users and effective deployed users were not inspected.
  No runtime exploit or host compromise has been demonstrated by this review.

Evidence: https://app.aikido.dev/featurebranch/scan/206619463?groupId=154352
GitHub evidence: commit check-runs endpoint for `573240c98`, and PR #243 comments.

## Whole-PR findings remain a separate open obligation

Other review comments visible on the PR include restore input hash checks,
stopping MinIO before replacing its volume, extraction-directory reuse,
missing deployment dependencies, staging TLS isolation, smoke-test assertions,
and source/provenance claims in the dispatches. These are not erased by this
scanner acceptance. They were not all independently reproduced in this lane.

The inspected restore script does use a persistent extraction directory,
does not compare its two inputs against pinned hashes, and explicitly stops
Redis without a corresponding MinIO stop. That source evidence warrants
continued operational review. No restore, production deployment, remote
configuration change, merge, or reviewer-message posting occurred in this lane.

## Reading a third-party audit as a novice

An automated scan reports known patterns and configuration concerns. An AI
code audit reasons about source and interactions. A penetration test probes a
running application. A human audit has an agreed scope and investigator.
These provide different evidence; the word "audit" alone does not establish
which work actually occurred.

For each finding, keep four things: affected version and scope, evidence and
practical impact, disposition, and retest result. Dispositions should be
confirmed/fixed, not applicable with evidence, or unresolved. A severity
label prioritizes investigation; a pass/fail badge also depends on settings.

For this PR, a completed ordinary scan is proven, a completed Deep Review
is not, and the exact free-offer terms are not established by the GitHub
integration. No paid credits were purchased or scans launched in this lane.

Official explanations:
- https://help.aikido.dev/pr-and-release-gating/aikido-ci-gating-functionality
- https://www.aikido.dev/code/code-audit

## Workspace and publication

The shared checkout was not staged or committed. A tool-created checkout
was clean and unused; its archival was requested after inspection. This
dispatch is published from the sibling seat worktree required by AGENTS.md,
on `codex/pr243-scanner-rereview-2026-09-28`, descended from the reviewed head.
The installer-generated local hook was restored to the tracked hook after
the installation probe, preserving the repository's identity-check delegate.
Only the hook test and this dispatch are included in the follow-up commit.
