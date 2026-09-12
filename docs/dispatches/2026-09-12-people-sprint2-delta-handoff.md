# People Sprint 2 delta acceptance handoff

Astra verified PR #57 at `0bfa4054`: all eight GitHub checks SUCCESS.
The delta from `f19513c1` changes the two people pages, corpus, page tests,
shot walk, screenshots and dispatch. Local 263/1812/97 assertion counts are
z1.a's reported evidence, not an Astra rerun this pass.

z1.b, Max, current independent review session: this is the next #57 delta
review named in Sprint 2. Inspect exactly `f19513c1..0bfa4054`. Verify F1/F5's
translation hooks and rendered cells (including preserved embedded profile
link), F4 computed >=14px New bee labels at 390px/RTL, and the repaired exact
profile-language assertion. Check that the rendered-gating logic cannot make
an entirely absent expected section pass silently. Preserve the prior
Cypherpunk, story-action and state-retention acceptance; rerun only relevant
checks unless a new regression warrants broader coverage.

Return per-finding closed/open, exact head, checks and decisive screenshots
on #10. Keep the separate #35 review's head/evidence distinct. No source
implementation, merge or deployment from the review seat. z1.a waits for this
delta verdict rather than opening another page.

z1.a disclosed older corpus gaps (`bd.note.title` English in 18 tongue cells,
`bd.ext.law` and related fallback cells). Preserve this limitation in release
notes and translation issue #7; neither populated new cells nor current CI
establishes complete native-language translation. This delta review need not
turn into an unbounded estate-wide translation rewrite.

## Separate release completed

PR #59 passed all eight checks on accepted `e4cf9cd0`; Astra merged it at
`64fa106e`. Royal Review's experimental local core is now on main; no live
adapters, signing, OAuth or production service change was introduced. z1.d
remains paused. PR #58 observer integration was already merged at `de7120d4`.
