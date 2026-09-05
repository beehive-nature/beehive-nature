# RECEIPT — z3.3: tithe address FILED → the funnel is armed (2026-09-05)

Founder word: commit `9952f366` (author loVis waTer) —
`docs/dispatches/tithe-address.txt`, one line:

    0x8fD7252A29FB759755E30A15E966932EaAD91b75

## What this seat did with it

1. **Box runner copy placed** — `~/funnel-test/tithe-address.txt` on the
   oracle box, the runner's own one-line `cp` from the tree (per the
   founder's filing note). The on-box `~/funnel-test/instruction.json`
   placeholders filled with the same address.
2. **Guard chain measured passing the tithe** — `broadcast.mjs --compose`
   now refuses ONLY on funds: *"NO FUNDS — 0 ETH on 0xb43b…37af, need
   ~3.60e-7 ETH gas"* (previously: TITHE ADDRESS NOT POSTED). The tithe
   guard also holds its shape checks: 0x-format and ≠ seller `to`.
3. **The shipped surface now tells the truth** — wallet.html §peer-funnel
   intent card and SPEC-PEER-FUNNEL-1 §receive show the filed address
   verbatim (no more placeholder). Live confirm + shot after this push:
   `e2e/shots-peer/peer-funnel-LIVE-tithe-390.png`.
4. **Funds watch** — 0.0 ETH ×3 RPCs at 07:25–07:28Z (six reads, 40 s
   apart), nonce 0. The drop has not landed.

## Armed state

The ONE broadcast fires the hour ETH lands on `0xb43b…37af`:
`--compose` (guards + self-checked signature) then `--broadcast`.
The tx carries the instruction as UTF-8 calldata — `referralFees:
[{recipient: 0x8fD7…1b75, basisPoints: 1000}]` — visible in the decoded
input on any explorer. Receipt will carry: tx hash + the decoded
referralFees line + the basescan link.
