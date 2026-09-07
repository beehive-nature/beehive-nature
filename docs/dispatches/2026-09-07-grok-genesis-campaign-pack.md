# Grok genesis campaign pack — issue #27 creative lane

2026-09-07 · medium-effort Cursor cloud worker · integrator: cHiEF LoVis / Grokbot.

## Claim

Parallel creative deliverable for [issue #27](https://github.com/beehive-nature/beehive-nature/issues/27). Gift-code repairs are **not** in this tree; that engine is live on main via Astra (`a70dafe`). Shared register/tour/Home generation stay with Astra. zCode #6/#7 and backend #23 stay separate.

Canonical coordination: issue #10. This dispatch is the filesystem receipt.

## Identity

| Field | Actual |
|---|---|
| Seat | Grok / Cursor cloud agent |
| Session | `bc-5883d749-e97b-44c8-9e94-ebe385d5ab08` |
| Model | Grok 4.6 (`cursor-grok-4.6-high-fast`) |
| Effort | medium (this worker). Gift implementation is a different worker. |
| Branch | `grok/genesis-campaign-pack-2026-09-07` |
| Base | `origin/main` `832bdf83` (fetched; matched the assigned SHA) |

## What was on origin vs what had to be rebuilt

| Wanted | On origin? | What this pack did |
|---|---|---|
| `docs/mvp-walk/marketing.html`, `index.html` | No. Grok’s laptop/localhost tree was named in the docket and #10, never pushed | Wrote a portable board and walk index |
| `docs/dispatches/2026-09-07-grok-beads-newbee-outreach.md` | No | Recreated as **drafts, not posted** |
| PLUR still + prompts + Astra dispatch | Yes, `cf82f9ed` on `codex/plur-paired-hands-2026-09-07` | Checked those three files onto this branch |
| Founder genesis JPEGs (2026-09-07) | Session attachments listed under `/workspace/marketing-review/…`; files **absent** here and in `git log --all` | Provisional SVG reconstructions with chosen geometry/stops. Do not establish exact founder originals |
| Beads 15s concept still | Same: attachment missing; Respect-as-handshake conflicts with canon | New poster; old still not reused as campaign art |

## Workers (fleet)

- Gift code (other worker; integrated on main `a70dafe`): `bc-45eba030-74e5-4366-ab2b-5882c9950654` on `grok/kandi-gift-reliable-2026-09-07`
- This creative seat: `bc-5883d749-e97b-44c8-9e94-ebe385d5ab08` on `grok/genesis-campaign-pack-2026-09-07`
- Claim receipt: `docs/dispatches/2026-09-07-grok-claim-27.md` (PAT cannot write issues)

## Delivered paths

- `docs/mvp-walk/index.html` — pack index
- `docs/mvp-walk/marketing.html` — review board (marks, introduction, storyboard player, PLUR, claim-to-proof excerpt)
- `docs/mvp-walk/claim-to-proof.md`
- `docs/mvp-walk/newcomer-observation-scorecard.md` (guide + empty five-row sheet; split copies kept)
- `docs/mvp-walk/festival-pilot-brief.md` (hypothesis brief; older filename kept as alias)
- `docs/mvp-walk/observation-guide.md`, `observation-scorecard.md`, `festival-hypothesis-brief.md`
- `docs/mvp-walk/assets/genesis/*` + `PROVENANCE.md` + `build-blooms.mjs`
- `docs/mvp-walk/assets/storyboard/newbee-15s-poster.svg`, `BEATS.md`
- `docs/mvp-walk/assets/plur-paired-hands-v1.png` and prompt
- `docs/dispatches/2026-09-07-plur-paired-hands.md` (Astra’s still receipt, carried for the PNG)
- `docs/dispatches/2026-09-07-grok-beads-newbee-outreach.md`
- this file

No `surfaces/` edits. No estate-row / atlas / review.html ritual. No kandi gift engine edits.

## Limits (named)

- Board-not-film: no original video, no completed audio, no continuous two-person animation.
- Genesis SVGs are **provisional reconstructions** with chosen geometry/stops. They do not establish exact founder originals. Founder JPEGs should replace them if recovered.
- Claim-to-proof rows that need people are empty. Agent clicks are not newcomers.
- Gift engine is live via Astra integration on main (`a70dafe`). This PR does not edit it.
- No public post, recipient message, ad, or purchase.
- GitHub issue-write may still 403 for this seat; the PR and this dispatch are the record.

## 2026-09-07 revision — Astra read-only review

Addressed [comment 5575327549](https://github.com/beehive-nature/beehive-nature/pull/28#issuecomment-5575327549) as acceptance gaps, not a completion claim. Draft PR #28 stays draft. No campaign launch. Issue **#27 stays open** for creative work and real observation receipts.

1. **PLUR board honesty.** `marketing.html` no longer replays the four-panel still on each beat. One poster still + caption stepper. Labeled storyboard-not-film / not continuous two-person animation / no completed audio. Founder canon kept in production notes: Love = touching fingertips; Unity = interlocked fingers; Respect = giver wrist → receiver wrist while fingers stay locked; giver ends bare.
2. **Genesis marks provisional.** `PROVENANCE.md`, `build-blooms.mjs`, SVG titles, and board copy now say **provisional reconstructions** with **chosen** geometry/stops. They do not establish exact founder originals. Founder JPEGs invited when recovered.
3. **claim-to-proof vs live gift.** Arrival Keep (`#arKeep`) is a separate row from the old paste path. At cited baseline `832bdf83`, `#rcvgo` saved immediately; preview-first paste arrived with the gift repair now merged at `a70dafe`. A failed new write does not itself erase previously committed storage. Cited Astra receipt `docs/dispatches/2026-09-07-astra-kandi-integration.md` on `origin/main` @ `a70dafe`. Live page named as skaists.dev/surfaces/kandi.html without claiming human usability.
4. **Scorecard rigor.** Anonymous attempt IDs (`A1`…) and pair IDs (`P1`). Not observed / Not applicable. Separate denominators. Keep and decline are separate outcomes; decline is not gift-completion time.
5. **Festival brief method.** Discovery starts from recent real experiences and problems before any table or set-time proposal. Offline tolerance is an **untested hypothesis**. No invented host willingness or budget.

## Checks run in this lane

- Local preview `http://127.0.0.1:4178/docs/mvp-walk/marketing.html` after the Astra-gap revision: provisional-reconstruction copy on the marks; storyboard-not-film banner present; Step captions, 4.0s / 8.5s / 11.0s jumps, and Raver toggle keep one poster on the stage (the four-panel PLUR PNG never enters the player; it is shown once in `#plur`); claim table has separate arrival vs paste rows and the failed-write correction; festival card starts from experiences and names offline tolerance untested. First 390px pass showed a broken poster because `newbee-15s-poster.svg` had non-UTF-8 / control bytes; rewritten as well-formed UTF-8 XML and re-checked — poster paints, still does not swap. Agent fixture, not a newcomer.
- §7 local commits: founder author, seat committer, Co-authored-by trailer parsed.
- Issue comments on #27 and #10: **403** (named).
- Repository CI: subscribed on this branch; result not claimed here until the check returns.

## Distribution

Do not execute. Proposed sequence remains Home → Buzz → Bluesky, drafts only.
