# Gallery New bee fail copy (follow-up to light stage)

Founder graded the PR #272 preview and rejected the New bee empty/error wall:
"some pieces did not arrive. the chain did not answer every question…" — "a New bee can't use that — just cypherpunk".

## Fix
- **New bee** eternal card: plain what-happened + one next step (try again / visit another collection). No "chain", no "questions". Reading line drops "contract".
- **Raver:** short warm notes; retry label is "try again" (not "ask the chain again").
- **Cypherpunk:** unchanged technical chips / failed reads / eth_call pipe.
- Cream New bee stage from the light-stage commit stays.

## Proof
e2e/blight-gallery-eternal.test.mjs expects the new New bee fail line and asserts the bee fail wall has no chain/question jargon; cypherpunk chip still matches failed reads.
