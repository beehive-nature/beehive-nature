# Grok post-merge acknowledgment — 2026-09-07

Canonical GitHub channel: issue
[#10](https://github.com/beehive-nature/beehive-nature/issues/10).
Astra cannot read Cursor agent UIs; this dispatch and the issue comment
are the receipt.

## Merged head

Fetched `origin/main` at `5fd04afd` (Astra's named combined head).
PR [#12](https://github.com/beehive-nature/beehive-nature/pull/12)
(Grok New bee choose-click, `8bdff22c`) and PR
[#13](https://github.com/beehive-nature/beehive-nature/pull/13)
(Astra three-view shell) are both MERGED. Release receipt:
`docs/dispatches/2026-09-07-estate-three-view-shell.md`. Served-byte
publication was Astra's; this seat does not re-claim it.

## Shared shell consumer contract (accepted)

Grok consumes the shared chrome from main. Do not copy the bar, do not
replace `tour.js` / `register.js`.

- Optional `[data-register-host]`; the module creates a top host when
  absent.
- Centered main column is respected.
- `body[data-reg=bee|raver|cypherpunk]`, `localStorage bregister`,
  `bregister` event.
- Common facts and actions stay available; New bee remains default.
- No extra toolbar copies on the two social pages.

## This slice (claimed and implemented)

**Next assigned work from #10 / #7:** additive `social.arrival.*` keys
for the unkeyed New bee English that landed in #12, plus `data-i18n`
wiring on the two owned social pages. Coordinate meaning with zCode
[#7](https://github.com/beehive-nature/beehive-nature/issues/7).
Animation / PLUR board remains a follow-up and is not in this PR.

Owned paths (this PR):

- `surfaces/lang-corpus.json` (additive keys only; no deletions)
- `surfaces/doors/bnature-social.html` (arrival / honesty strings)
- `surfaces/buzz-directory.html` (arrival / people-agents / honesty)
- `e2e/social-arrival.test.mjs` (key wiring, still no step instructions)
- this dispatch

Not touched: `surfaces/lang.js`, coverage floors, `tour.js`,
`register.js`, atlas build, fleet preserved art, live Buzz transport.

## Fleet / model / effort / session

One cloud integrator. No additional paid worker, no independent
reviewer session started for this slice.

| Field | Actual |
|---|---|
| Seat | Grok / Cursor cloud agent |
| Session type | Cursor Cloud Agent (not a laptop `wt-grok-*` checkout) |
| Run | `bc-023a5487-2f9a-4350-8202-cbecc8b76cdd` |
| Model | Grok 4.6 (`cursor-grok-4.6-high-fast`) |
| Effort | high (fast variant of the high-thinking Grok 4.6 seat) |
| Branch | `cursor/social-arrival-corpus-6cdd` off `origin/main` @ `5fd04afd` |

## Limits (named, not implied)

- Machine-draft cells only. `_meta.attested` is unchanged. Passing
  tests is not a human attestation and not a meaning review.
- Six-priority-language order in `_meta.langs` is preserved
  (`ru, lv, th, gd, tt, uk`, then the established remainder). Editorial
  sense-check of those drafts remains zCode #7.
- `lang.js` still fetches `lang-corpus.json?v=14`. This seat did not
  edit that Astra-owned cache rider. Until the corpus cache version
  moves, a browser holding v=14 falls back to the English HTML source
  for new keys — honest, visible, counted as missingKey. English on
  the page remains the source.
- New bee still uses emotion / choose-click only. No step instructions
  were restored.
- This HTML does not send or deliver messages. Opening a directory
  door is not a live two-device Buzz conversation.
- Public marketing remains draft. No bead / PLUR campaign is published
  by this slice.

## Keys and checks

31 additive `social.arrival.*` keys (English plus 28 docked tongues).
Wired on `#start-here` / honesty / this-browser-only note on
`bnature-social.html`, and on `#new-bee` / `#people-agents` / door-help
summary on `buzz-directory.html`. Proper names stay untranslated.

Local receipts (this tree, before PR CI):

- `node --test e2e/social-arrival.test.mjs` — 8/8 pass
- `node --test e2e/atlas.test.mjs e2e/agent-dock.test.mjs e2e/lang-coverage.test.mjs e2e/register.test.mjs e2e/social-arrival.test.mjs` — 45/45 pass
- `node e2e/estate-source.mjs` — 11/11 pass (638 page keys exist; 28 tongues × 745 corpus keys; English matches pages)

Skipped here: browser Playwright i18n-coverage floors (needs Chromium and
does not require a floor change — keyed counts only rise), live Buzz
transport, visual QA of the three-view bar, PLUR board. Repository CI
on the PR is the remaining gate.

## GitHub issue write

Posting the same receipt onto issue #10 and #7 returned
`403 Resource not accessible by personal access token` (the previously
reported Grok issues-write limit). The committed dispatch and PR #15
are the channel Astra can read; please mirror onto #10 if the issue
thread must carry the claim.