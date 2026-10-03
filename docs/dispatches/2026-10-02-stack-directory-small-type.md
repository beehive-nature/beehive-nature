# Engine Room directory: small text raised to the 12 px floor — 2026-10-02

Problem. On main at c5c15f6d7 the `eternal` job step "Bottom half — every surface x three registers at 390 px (ratchet)" fails with exactly three lines (run 37089684100):

    WORSE   stack.html [bee] SMALL 0 → 163
    WORSE   stack.html [cypherpunk] SMALL 0 → 243
    WORSE   stack.html [raver] SMALL 0 → 161

PR #325 shows the same three lines; it inherits them from main.

Cause. `node footer-audit.mjs --only stack.html --report` (run from e2e/) lists one kind of element only: `<small>` at 11.7 px, in all three registers. These are the purpose line and the "Runtime integration: unverified by this inventory." line in each row of the surface directory that scripts/build-stack-surfaces.mjs generates into surfaces/stack.html (#317 to #319). The emitted rule `#surfaceDirectory small` set no size, so the browser default for `small` (0.833 of the 14 px cell) applied.

Fix. One declaration, `font-size:12px`, added to `#surfaceDirectory small` in the generator, then both generators re-run. It is the same value the sibling generated rule `#stackInventory small` already uses. Type size only: no palette, layout, register or markup change. The baseline file e2e/footer-audit.baseline.json is untouched. scripts/build-stack-inventory.mjs needed no change and its regenerated output is byte-identical.

Receipts, this box (Windows, local Chromium), on the branch:

- `node scripts/build-stack-inventory.mjs --check` and `node scripts/build-stack-surfaces.mjs --check`: both pass (127 surfaces, 118 registered, 9 unregistered).
- `node footer-audit.mjs --only stack.html --report`: before, SMALL 566 across 3 views; after, "0 views with findings on 0 surfaces · no findings".
- `node skaists-conformance.mjs --only stack.html`: 100% in bee, raver and cypherpunk, exit 0.
- `node --test stack-eternal.test.mjs`: 6 pass, 1 fail. The failure is "the same facts in all three" with `0 !== 5`, the failure already on main. Not affected, not fixed.
- `node --test comprehension.test.mjs` "stack organ board": still fails, "seven disclosures on the organ board, got 6". Already red on main. Not affected, not fixed.
- `node footer-audit.mjs --baseline footer-audit.baseline.json` (whole estate): no stack.html line remains. On this box it still exits 1 with four WORSE lines on pages this change does not touch (mission-room.html bee SMALL 103 → 104; missions.html raver CAPS 2 → 3 and SMALL 27 → 28; vending-deck.html cypherpunk TINY 0 → 3) and three BETTER on receipts.html. CI on main reports none of these, so they read as box-versus-runner variance, but that is an inference. The CI run on the PR is the receipt for the ratchet step.

Open, not in this change: the two red tests above (D.autonomi count 0 versus 5; organ board 6 disclosures versus 7) need their own repair.
