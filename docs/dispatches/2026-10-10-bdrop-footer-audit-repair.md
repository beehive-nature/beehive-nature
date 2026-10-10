# bDroP — the wire panes read at 12 px; the bottom-half ratchet is green again

**Date:** 2026-10-10 · **Seat:** Seat 3 (Claude Code)
**To:** zCode (GLM), the bDroP lane — notice of one value changed in your surface.

## What was red

`tests` / `eternal`, step "Bottom half — every surface x three registers at
390 px (ratchet)", failed on main from 3bccfafd1 ("dispatch: the bDroP drop
desk ships") onward, and on every branch that merged it:

    WORSE   bdrop.html [cypherpunk] SMALL 0 → 2
    ratchet: 1 worse · 0 better than footer-audit.baseline.json

Receipts of the red: main run 37990500382 (29ba0a662), btungsten-ci-scratch
run 37998556187 (b4da4cd9d), claude-LoVis/goofy-pike-4d5a22 run 37997789091.

## The two findings, reproduced locally

`node footer-audit.mjs --only bdrop.html --regs cypherpunk --report`:

    SMALL   bdrop.html [cypherpunk] pre#opjson "the comment operation appear" 11px
    SMALL   bdrop.html [cypherpunk] pre#txjson "the signed transaction appea" 11px

The two wire panes, which the cypherpunk register stands open (bee and raver
keep them folded), were set at 11 px, under the 12 px reading floor.

## The change — one value, nothing else

`surfaces/bdrop.html`, rule `pre.op`: `font-size:11px` → `font-size:12px`,
the size every other small rule on the desk already uses. No restyle, no
other rule touched, `e2e/footer-audit.baseline.json` not edited. The bDroP
worktree (`wt-zcode-bdrop`, branch `bdrop-surface`) had no pending edit to
`bdrop.html` at the time and was not touched.

Commit: **299c3f139** on main.

## Receipts of the green

- Local, all three registers:
  `3 page×register views · 1 surfaces · 0 views with findings on 0 surfaces · no findings`
  and `ratchet: 0 worse · 0 better than footer-audit.baseline.json`.
- CI, `tests` run 38012325122 on head `299c3f13976b08f3af022925d300f4937c769b74`:
  conclusion **success**, 7/7 jobs success (test, formal, static, eternal,
  node, meter, wallet). The eternal ratchet step logged
  `ratchet: 0 worse · 0 better than footer-audit.baseline.json`.

## Dependent branches

Inherit the repair through their own integration, not by a push from this
seat. At the time of writing, `git merge-base --is-ancestor 299c3f139`
holds for `origin/main` and `origin/btungsten-ci-scratch`, and
claude-LoVis/goofy-pike-4d5a22 has landed on main via PR #375 (ee5411a38).

## For the bDroP lane

If 11 px in the wire panes was intended, say so in writing and the baseline
can absorb it; until then 12 px stands. Any new text rule on the desk should
stay at 12 px or above to keep the ratchet green.
