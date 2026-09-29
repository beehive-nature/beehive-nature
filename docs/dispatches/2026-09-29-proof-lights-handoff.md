# 2026-09-29 — Proof lights: handoff of #250/#253, #247 and the CI-signing card

Outgoing seat: Claude Code, `session_015NgLKhQoUyK4kxFMpWKbaz` ("Badge verification — finish PRs — KEEP"). This seat is handing off before its context fills. The next owner inherits everything below; nothing is carried only in the outgoing session.

## What the next owner inherits

| Item | State at handoff | Next action |
|---|---|---|
| **#250**: build-time badge renderer plus the first badge (base `main`) | Ready for review. #253 is folded into it with a merge commit, so #250 now carries the repaired gate. Merges cleanly into `main` (checked 2026-09-29). Codex raised five findings over two rounds (`ba35019`, `802b973`), all fixed. The gate now refuses forged `renderer`/`law`, inherited badge names and non-canonical `measured_at`; the probes pass 16/16. Aikido's two file-read flags were verified false positives and dismissed with reasons. | Independent review, then merge. |
| **#253**: gate repair (base: #250's branch) | Folded into #250 and closed by that merge. Its dispatch and STATUS line travel with #250. | None. Review it as part of #250. |
| **#247**: `bnr-seal` crate, handset docket, proof-lights docket and its amendment (base `main`) | Ready for review. Merges cleanly into `main` on its own. Codex raised thirteen findings over three rounds (`cf3887a`, `6849dab`, `a0eeafd`). All were fixed, in `6849dab`, `a0eeafd` and `856a528`, and their threads resolved (dispatch `2026-09-29-codex-review-247.md`). A later Codex round may add more; handle them the same way. | Independent review, then merge. |
| **CI-signing card** | **Not started.** Owner, scope and done-when are in `2026-09-27-proof-lights-gate-repair.md`, section "The CI-signing card". | Starts after #250 is on `main`. Needs the founder to generate the key pair and store the private key in a protected environment. |

## Landing order and the one known conflict

- #250 and #247 are independent. Either can land first.
- Both add a STATUS.md ledger line at the same anchor. Whichever lands second gets a text conflict in STATUS.md only. Resolve it with a **merge commit** that keeps both lines, newest first. No other file conflicts (simulated on 2026-09-29: main ← #250+#253 ← #247 at `856a528`).

## Independent review is required before `main`

- Every recent merge to `main` in this repository records an independent review, for example "Merge #252: … (CI 14/14; independent review APPROVE at 2ec7deb5)".
- The authoring seat must not approve its own work.
- Another agent may provide the review, but it must not be the seat that wrote the change.
- The review should be recorded at a specific head sha. Merge only after the review approves, with CI green on that same head.

## Lessons carried forward (founder correction, 2026-09-29)

1. **Never force-push. Not even with `--force-with-lease`, and not even on a branch the seat created. Every repair is a new commit.**
   - On 2026-09-29 this seat force-pushed #253 (`05f9366e` → `20fef755`, identical tree). The aim was to replace a merge commit that failed the §7 identity check. The founder ruled this a violation of the no-force-push rule.
   - The work was kept, and it is not being undone again.
   - If a fix seems to need history rewriting, stop. Ask the founder, or record the failure on the PR and wait. A rewrite is never the fix.
2. **Merge commits need the seat trailers too.**
   - Git's default merge message has no `Co-authored-by` line, and §7 (`scripts/identity-check.sh`) fails the whole range on it.
   - Always give merge commits an explicit message: founder as author, seat as committer, plus the `Co-authored-by:` trailers.
   - Run `S7_BEFORE=<base> S7_SHA=HEAD sh scripts/identity-check.sh` before pushing.
3. **Don't poll without a reason.**
   - Hourly "no change" check-ins were stopped at the founder's request. They did not move the work forward.
   - PR events arrive on their own. Act on events, and on concrete next steps.

## Out of scope for this handoff

`skaists/buzz` #7 (env isolation), #8 (Landlock filesystem isolation, stacked on #7) and #9 (source-built MinIO images) were also opened by the outgoing seat. They are not part of this handoff unless the founder adds them. At handoff:
- #9 is fully green.
- #8's code checks are green. Its remaining reds are the pre-existing quay/ghcr infrastructure failures documented on #7 and #8.
