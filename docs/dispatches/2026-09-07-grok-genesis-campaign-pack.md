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
- `docs/mvp-walk/assets/genesis-3d/` — #31 stills, six supplied originals, README, originals-receipt (no GLB / blend)
- `docs/mvp-walk/assets/storyboard/newbee-15s-poster.svg`, `BEATS.md`
- `docs/mvp-walk/assets/plur-paired-hands-v1.png` and prompt
- `docs/dispatches/2026-09-07-plur-paired-hands.md` (Astra’s still receipt, carried for the PNG)
- `docs/dispatches/2026-09-07-grok-beads-newbee-outreach.md`
- this file

No `surfaces/` edits. No estate-row / atlas / review.html ritual. No kandi gift engine edits.

## Limits (named)

- Board-not-film: no original video, no completed audio, no continuous two-person animation.
- Genesis SVGs remain **provisional reconstructions**. Supplied originals and Astra 3D stills are now on the board under distinct labels. Continuous PLUR film remains open.
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
- Repository CI: `610474a` and `921b292` each finished 8/8 green. Later heads must speak for themselves.

## 2026-09-07 revision — source-review edits, originals, Raver prototype

Kept draft PR #28. Issue #27 stays open. No campaign launch. No mint or contract change. Astra retains shared theme and original-based 3D on draft PR #31 (`ffb44283`).

### A. Two remaining source-review edits ([comment 5575759413](https://github.com/beehive-nature/beehive-nature/pull/28#issuecomment-5575759413))

1. Scorecard / guides now use **two clocks**: time to local handoff completion, and time to receiver Keep. Only declines **before starting** are excluded from the attempted-handoff denominator. Declines after starting stay in that denominator and still get no completion time.
2. Festival briefs keep discovery neutral. “What happened?” comes first, then what went well, then what was hard. “What went wrong?” is not used. Hypothetical text-string questions moved to a **concept-reaction** section after the night is written down.

### B. Provenance refresh

Copied lightweight #31 stills, six supplied originals, README, and originals-receipt into `docs/mvp-walk/assets/genesis-3d/`. Did **not** copy GLBs or the Blender master.

| Label | Status on this board |
|---|---|
| Supplied originals (LoVis and his mother) | Present. Purple = humans, teal = AI, green = biomass. |
| New 3D interpretation stills | Present. Depth/lighting are the study. |
| Provisional reconstructed SVGs | Still provisional. Not replaced. |

Continuous PLUR film remains an open production deliverable.

### C. Raver composition prototype — honest status

**Working CSS/SVG-adjacent motion, not a mock screenshot and not a 3D/film deliverable.**

Real on the board:

- User-chosen expressions: gentle breathing, connected/shared rhythm, celebration (`Play motion` / `Pause` / intensity range).
- Reduced-motion: motion does not run; the still stays.
- Sound control: deliberate tap only. **No audio asset** — the button reports that instead of playing a fake bed.
- Same People / Art / skaists Home / LOVErnment DAO links in every view. New bee is the default.
- FUNGi / FROGGi / PEPi snapshots linked from `surfaces/atlas-art/` with provenance.json credits. Snapshots are not recast as changed chain art.

Not real:

- No completed audio bed.
- No GLB viewer (optional 3D still only).
- No shipped artist animation, no inferred mood, no DAO activity counts.
- Continuous two-person PLUR film still open.

Measured sizes copied onto this branch (decimal): original JPEGs 11.0–82.7 kB; teal PNGs 561–689 kB; 3D stills 1.06–1.14 MB; original-blooms.png 1.92 MB. #31 GLBs 5.41–6.09 MB and Blender master 7.76 MB were **not** copied. Astra’s 180-cell SVG probe (34.9 kB / 9.5 kB gzip) remains a size probe, not finished art.

Recommend compact reproducible artwork plus optional rich 3D.

## 2026-09-07 revision — consume Astra bloom; keep controls in every view

Integrator handoff: [comment 5576271846](https://github.com/beehive-nature/beehive-nature/pull/28#issuecomment-5576271846) and `docs/dispatches/2026-09-07-astra-grok-motion-board-review.md` at `620e74fe`. Draft PR #28 stays draft. Issue #27 stays open. No campaign launch. No mint or contract change. Shared `register.js` / `tour.js` and Astra Blender builders were not rewritten.

### What the board now plays

**Real CSS/SVG bloom**, not overlay rings and not a mock screenshot.

Consumed from #31 (`620e74fe`) onto this branch, lightweight only:

| Path | Copied? | Bytes |
|---|---|---:|
| `motion/green-teal-breathing.svg` | Yes | 83,287 (gzip 29,109) |
| `motion/green-teal-breathing-poster.jpg` | Yes | 76,104 |
| `motion/studio.js`, `studio.css`, `index.html`, receipts, README | Yes | studio + receipts |
| `motion/board.js` | Board consumer (this lane) | thin apply() over the published SVG contract |
| `green-teal-breathing.mp4` | **Not copied** | 767,970 — optional film stays on #31 |
| `green-teal-breathing.blend` | **Not copied** | 481,198 — Astra lane |
| GLBs / static Blender master | **Not copied** | 5.4–7.8 MB |

The board loads the SVG once into `#bloom-stage` and drives it with the published contract: root `.bnr-breathing-bloom`, `.is-paused` (`animation-play-state: paused`, not `animation: none`), `--bloom-duration`, `--bloom-strength`, `--bloom-ring-delay`. Presets match Astra’s studio (breathing / shared / celebration). Intensity is the 0–100 studio slider. Shared rhythm remains local rings.

### Required board fixes (source findings at `b3fb7ed1`)

1. **Every view keeps the controls.** Removed `.raver-only` and the independent `setView` machine that stopped motion outside Raver. The bloom section mounts shared `surfaces/register.js` via `data-register-host`. Expression, intensity, and pause are page state in `board.js`; changing New bee / Raver / Cypherpunk does not discard them. New bee remains the register default when no `bregister` preference is stored.
2. **Pause freezes the current pose.** Board no longer uses `animation: none` on pause. Pause toggles `.is-paused` on the SVG root. Zero intensity still maps strength to 0 and labels the control “Still view”. Reduced-motion uses the SVG’s own rest-pose override (`animation: none` + `transform: none` on cells only).
3. **No inactive sound action.** `#exprSound` / “Enable sound” removed. Plain text: “Sound is not available in this preview.” No audio production.
4. **Artist-first layout.** Art, expression, intensity, and pause come first. Review/status/size tables and the optional 3D still sit in a disclosure. skaists + LOVErnment DAO are named as the people and project around the art, not “because the founder asked for them”. Blender studies are **rendered** together. The PLUR image is an **accepted concept still**, not a founder photograph.

### Open items (honest)

- Optional 6-second Blender MP4 and editable `.blend` remain on #31. The copied studio page will report a failed film load if that button is used from this branch.
- Continuous two-person PLUR film remains open.
- No completed audio bed.
- Reduced-motion live OS preference was not flipped in this seat; the CSS/controller branches were exercised by emulating `prefers-reduced-motion` in a scripted browser pass (see evidence below).
- Human newcomer observations remain separate. Agent clicks are not people.

### Evidence

Recorded after the push of this revision. Scripted Chromium against `http://127.0.0.1:4179/docs/mvp-walk/marketing.html`. Details and any failures are named in the revision commit that follows the first implementation push, or in this section if the same commit already contains them.

## Distribution

Do not execute. Proposed sequence remains Home → Buzz → Bluesky, drafts only.
