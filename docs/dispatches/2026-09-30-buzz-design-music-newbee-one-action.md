# Music New bee: one primary action (Floor A)

Founder rejected the New bee four-row dead status sheet (who made it / in the set / play here / listen elsewhere).

## Fix
- Removed `#etBeeRows` from `surfaces/music.html` New bee.
- One live status (`#etBeeNow`) + one primary (`#etBeeJoin`) + quiet listen link + foot.
- Creator / set / doors stay on Raver + Cypherpunk (and `__eternal.data`).
- Gallery cream stage + plain New bee fail copy from earlier commits on this PR stay.

## Proof
`e2e/music-eternal.test.mjs` asserts no etBeeRows; join hand-off and refused-envelope stay green.
