# Astra review handoff — New bee choose-click

Founder relayed that Grok's Cursor cloud agent is running the repo choose-click revision while Grok updates its local preview. Astra checked current GitHub state: no open PR was visible in `beehive-nature/beehive-nature` at inspection. Cloud-agent execution is Grok's report; Astra has no direct session API/ID for that worker and has not started a duplicate implementer.

## Observed snapshot

Grok's local worktree is `C:/Users/travi/wt-grok-social-slice`, branch `grok/bnrose-social-slice-2026-09-07`, committed HEAD `6b66c038`. The choose-click changes are uncommitted across the two social pages, test and landing dispatch. `node --test e2e/social-arrival.test.mjs` passes 6/6 against the observed working files. Those are source assertions, not browser interaction or usability proof. The existing independent review is pinned to the preceding stepped version (`7171a1a0`, feature `64b12a20`) and must not be reused as acceptance for this revision.

## Preview root cause

HTTP source checks (no browser DOM inspection) found:

- `http://127.0.0.1:4176/surfaces/doors/bnature-social.html` returns 200, matches Astra's own source bytes, does not match Grok's WIP and has no `choose-grid`.
- `http://127.0.0.1:4177/marketing.html` returns 200.
- The social door and directory under `/surfaces/` on 4177 both return 404.

Grok: provide a social-preview URL that actually serves your working tree and verify its served bytes against the candidate. Keep the marketing board URL labeled separately. Do not overwrite Astra's preview source or point to 4176 as proof that your WIP landed. A running cloud agent, a local preview, a committed candidate and a deployed main are different states.

## Corrections for the cloud implementation / fresh review

1. **Matriarch readability:** new `.choose .help` text is 10.5 px in the directory and 11 px in the social door; leads are 11.5–12 px and action labels 12.5–13.5 px. Bring the New bee text/controls up to the approved readable hierarchy (16 px body/help text and at least 14 px routine labels; use rem). Keeping old CSS is not proof of narrow-screen/keyboard usability.
2. **Language support:** the new choice labels, explanations, people/agent guidance and fallback prose are unkeyed. Translation is already a founder requirement, not an optional later feature. Add the owned `social.arrival.*` keys and reviewed machine-draft cells under the existing corpus law, coordinating meaning with zCode #7. Preserve the six-priority-language order and no human-attestation claims.
3. **Choice means the labeled action:** in the directory, both “Find a hive” and “Open a Buzz room” link to `#our-hives`. The second card currently scrolls to a list rather than opening a room. Give it a distinct honest destination/action or collapse/relabel the duplicate; keep plain-language choices separate from protocol explanations. Do not manufacture a room-connected or delivered state.
4. **Return a new receipt:** exact cloud session/branch/head, owned paths, model/effort, fixture results, working preview URL/source match and independent review of that head. The six source tests are useful but do not establish typography, focus, translation delivery or a cross-device chat. Return the test command; Astra will coordinate any shared CI wiring once the candidate is ready.

The cloud agent retains Grok's claimed implementation paths. Astra performed read-only review and coordination only; no edit to Grok's worktree, no duplicated product implementation, no production deployment.

## Receipt arrived during review

Grok has now committed the choose-click change as `fef37937539fec176e924964bc5d091a254c221d` and its new source acceptance as `ca071d61`. The two page files and test match the working files Astra checked (Git diff against fef37937 is empty). The new acceptance establishes the absence of numbered steps and retention of the existing labels; it does not resolve the readability, missing-translation-key, duplicate-destination or preview-root findings above. Those are the next cloud-agent acceptance items. This supersedes only the earlier uncommitted-state observation, not the review findings.
