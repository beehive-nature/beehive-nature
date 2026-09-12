# z1.b delta review — PR #57 at 0bfa4054 (Sprint 2 patch) — 2026-09-12

Seat: z1.b (zCode GLM 5.3, Max), independent read-only reviewer, continuing
the people lane from the accepted f19513c1 review (dispatch
`2026-09-12-z1b-people-candidate-review.md`). This receipt covers ONLY the
delta `f19513c1..0bfa4054` (one commit, 15 files) per the Sprint 2 docket;
the earlier audit was not re-run absent regression. Review worktree
`wt-z1b-people-review` (detached at the delta head). Receipt branch
`z1b/people-delta-review-receipt-2026-09-12` (based on origin/main
`de7120d4`; adds only this file and two fresh `e2e/shots-z1b-review/`
renders).

## Verdict

**Delta ACCEPTED — F1, F4 and F5 are fixed and independently verified
rendered; the vacuous profile assertion is repaired with a substantive
corpus-equality check; the accepted F2/F3 journeys and behaviors are
retained; the corpus law holds.** No new defects found. People #57 is
release-ready from this seat's side; assembly and release are Astra's.

## Identity and scope

- §7 on the delta range: **1/1 green** — founder-authored, z1.a
  seat-committed, one Cursor Agent trailer (`identity-check.sh` override
  `f19513c1..0bfa4054`).
- Delta touches exactly what the docket named: `surfaces/buzz-directory.html`
  (+32/−), `surfaces/profile.html` (+37/−), `surfaces/lang-corpus.json`
  (+901), the three test files (two page suites + the shot walk), z1.a's
  dispatch rider section, and committed screenshots. No shared chrome, no
  CI wiring, no other surfaces.

## F1 — mid-beat sentences: FIXED, verified rendered

Both estate door cards (`dir.hives.doorcard`, one shared key for identical
text) and the founder-house story (`prof.house.story`) are keyed and render
translated. Independently probed at 390px: with lv selected, both door
cards render "Publicēta kopienu durvis…" and the founder story renders
"Dabas rezervāta «Beehive» dibinātājs…" — each **exactly equal to the
corpus cell** (compared against `lang-corpus.json` in-page, not eyeballed);
with ar, the story renders Arabic and `dir=rtl` holds. None of the three
sentences renders the English source under lv/ar anymore.

## F5 — instrument copy: FIXED, verified rendered

27 new `dir.inst.*` / `prof.inst.*` keys cover every numbered section
heading (1–7 per page) and every previously unkeyed law block; the roster
law is split into a keyed span so the embedded profile link stays intact;
section 2 reuses the existing `bd.hives.law` (identical text — reuse
verified). Rendered at 390 in lv: "1 · kvītu likums", "3 · publiskā
kataloga instruments", law1 text — all exactly equal to their corpus
cells.

## F4 — New bee routine label sizes: FIXED, measured computed

Bee-scoped overrides lift `.listing .lrelay` / `.listing .chip` (directory)
and `.holder .bio .bdesc` / `.holder .bio .bmeta` (profile) to 14px
(.875rem). Measured computed sizes at 390px in the bee instrument:
directory 42×14px + 14×14px, profile 7×14px + 6×14px — minimum exactly 14,
zero horizontal clipping, page fits 390. Under RTL ar at the instrument
layer: 13/13 visible labels at 14px, fits 390 (my first ar measurement was
vacuously empty at the wrong layer — re-measured non-vacuously and
recorded here as such). Cypherpunk's compact register is untouched
(measured 10.5px there, as designed).

## Repaired assertion — substantive now

`e2e/people-journey-shot.mjs` no longer short-circuits for profile.html:
the rendered calm must EQUAL the corpus cell on both pages, and the walk
adds story-sentence and raver-feel corpus equality plus an instrument-wide
sweep (every rendered leaf keyed element matches its cell; rendered-gated
for closed details; textContent so text-transform cannot distort). I
re-derived the calm-equality myself for directory-lv and profile-ar
(the previously vacuous page) — both match exactly.

## Suites — all reproduced at 0bfa4054

| Check | Result |
| --- | --- |
| `node --test` five page suites + lang-coverage + register + atlas + agent-dock | **111/111** |
| `node e2e/estate-source.mjs` | 11/11 |
| `node scripts/estate-check.mjs` | PASS 93/93 |
| `node e2e/people-journey-shot.mjs` | **97/97** (z1.a's claim reproduced) |
| `node e2e/reading-rooms.browser.mjs` | **1812/1812** (all-28-language sweep incl. RTL) |
| §7 identity `f19513c1..0bfa4054` | 1/1 green |

## Corpus law

29 new keys × 29 languages (en + 28 tongues): every cell populated, none
identical to the English source. Provenance: `_meta.drafted` names the new
keys and marks them all ⚙ machine-drafted, with meaning review explicitly
kept in #7 — no human/native-language attestation claimed, matching the
docket's separation. Pre-existing gaps z1.a named are real and NOT widened
by this delta: `bd.note.title` still echoes English in exactly 18/28
tongue-cells (as stated), and the delta touches zero lines of the
pre-existing gap keys. Those remain Astra's conscious-acceptance or
follow-up item, unchanged in severity from Sprint 1.

## Retained accepted paths (spot-verified)

F2 (figure primary "Meet the hosts" → hives layer with both estate door
cards) and F3 (profile figure primary → founder-house layer) both still
land correctly through the real DOM; disclosures/retention and the
external-link law were asserted green by the 97-check walk and the
1812-check sweep at this head.

## Not claimed

Machine-draft coverage ≠ meaning review (#7 stays open). No native-language
approval, no adoption claim. z1.b merges/deploys nothing; Astra owns
release assembly.
