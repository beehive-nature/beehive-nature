# Lane M dispatch — Watch → Music → an honest, usable sound destination (Music + Listening subset)

Seat: ZcODe5.3max (writer). Date: 2026-09-19. Base: `origin/main` `d7b9b2c6`.
Branch: `zcode/lane-m-music-listening` (fresh recovery branch; worktree `REPOS/wt-zcode-lanem`).
Status: **complete locally, push held** — per the routing seat (bUi `ece7e2df`), the
push waits for the founder's word on the open commit-identity question (the same
gate Slice A and G1 wait on). No merge, no deploy. Draft PR body is staged; the
PR opens the moment the word lands.

## Scope (as routed)

Music + Listening only. `watch.html`, its embedded language bundle and
`register.js` untouched (Cowork's fence, unreleased). `music.beeLead` untouched
by law — it feeds Watch's inline bundle. **The receipt line the routing seat
required: Watch's "music already playing" invitation is STILL FALSE on main and
in this branch — curing it needs watch.html, which stays fenced until Cowork
releases it in-thread.**

## Beats

| beat | commit | what |
|---|---|---|
| 1 | `4e8a6608` | Recovery of draft PR #78 @ `5b9164af` by `cherry-pick -x` (original message byte-faithful; corpus + music.html auto-merged; the stale floors conflict resolved to the CURRENT map — no wholesale import). #78's remote history untouched. |
| 1b | `be892b5a` | Music floor ratcheted 7→20 via the sanctioned tool (`i18n-coverage.mjs --set-floors`); programmatic value-diff: exactly one entry changed, every other floor byte-identical. |
| 2 | `8c96449b` | The Music hero stops claiming playback: new `music.roomPreviewLead` (29 cells, music.html-only), `music.beeIntro` + `music.artistNote` rewritten in place (29 cells each), the unsupported ready-state promise removed (branch, config seam, CSS, `music.playHereReady`/`music.stateAttached` withdrawn). |
| 3 | `0752ae2e` | The generated-sound demo stops lying about its state: five distinct truths (play/stop/completion/suspended/failure), aria-live status, inspectable `window.listeningDemo`, demo link on music.html labeled "generated-sound demo". |
| 4 | this commit | Fresh 390/1280 images (music ×3 registers + listening), AR/RTL + Thai acceptance probe. |

## Proof (all at the branch head, local — GitHub CI runs when the push lands)

- `e2e/zcode-listening-check.mjs` **18/18**: play claims playing only with the
  timer live + context running; stop reports the honest step count and suspends
  the context; completion reports completed on the real clock; refused audio
  reports suspended and never claims playing (button stays live); a missing
  engine reports audio unavailable; zero page errors in every path.
- `e2e/zcode-music-check.mjs` **37/37** (panel states, disabled-with-reason,
  named external links, YouTube named-not-linked, artist note, honest
  visualizer label).
- `e2e/zcode-music-views-check.mjs` PASS — 3 views × {390,1280}: no overflow,
  contrast, focus, external-link safety, lv switching on all three leads,
  view+tongue persist across reload, reduced-motion stills, zero page errors
  and zero external deliveries.
- Acceptance probe (AR/TH): Arabic lead renders from the corpus with `dir=rtl`;
  the Thai long-translation lead renders; `music.roomPreviewLead` carries all
  29 cells.
- `e2e/zcode-watch-manifest-check.mjs` **29/29 — unchanged**, as the addendum
  requires. `e2e/estate-source.mjs` **11/11** (corpus English matches pages;
  1476 tree keys / 2035 corpus keys). Floors gate PASS (music 20/97 keyed, 0
  empty cells; watch 44 untouched). `music-cleanup` 2/2. `lang-coverage` unit 13/13.

## Provenance and laws honored

- Recovery records `5b9164af` (cherry-pick `-x` line in `4e8a6608`); no reviewed
  history rewritten. #78 closes only after this supersedes it.
- The `0496a9f6` addendum: `music.beeLead` untouched; new music-only key with
  all 29 cells; `music.beeIntro` corrected in place; corpus `_meta` (law,
  langs, rtl, attested, withdrawn) preserved; drafted provenance appended.
- Scope fences held: no watch.html, no register.js, no hub/atlas/daily-art, no
  genealogy, no bData, no wallets, no host/media infrastructure, no payment
  code, no new transport, no media writes. `e2e/.lanem-set.json` (measurement
  set) stays untracked and out of the PR.

## Out of scope / next

- Watch invitation cure + embedded bundle rebuild — blocked on Cowork releasing
  the watch.html fence.
- Behavioral review (bFUzZ) and journey review (Astra) — on the draft PR.
- PR #78 closes after this lands.
