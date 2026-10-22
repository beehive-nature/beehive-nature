# bNames: the registry fee reads A

Lane: PR #322, branch `claude-LoVis/eos-vaulta-a-reading-3f3628`. Founder ask, 2026-10-02: "All EOS needs to function and read A for Vaulta."

## What changed

- `surfaces/bnames.html` — the `kingbeelovis` config row's `registration_fee` passes through `displayA()` at the load point (`loadConfig`). Every consumer of `live.fee` / `D.fee` inherits the reading: the FEE card, both AVAILABLE lines, the copy text, the raver pill meta, the bee row and the cypherpunk reads table. The numeric text is kept exactly as the chain returns it; only a trailing `EOS` symbol is shown as `A`. Any other symbol is shown as returned.
- A value that is not a chain asset string (`<amount> <SYMBOL>`) is **unread**: `displayA()` returns `null`, the card is not flashed, and every consumer keeps saying "not read yet". The page never manufactures `0.0000 A`.
- `e2e/bnames-eternal.test.mjs` — the config mock is the real mainnet row shape (`0.0000 EOS`) and the three-register test asserts `0.0000 A`. A new test feeds missing, null, empty, blank, numeric, wordy, unit-less, symbol-only and negative fees and asserts the model stays `null`, the card stays "not read yet", and the term is still read.

## What did not change, and why

- `surfaces/fieldnotes.html` and the `fn.e3.cost` corpus cells keep **EOS**. That entry is the record of the Jungle4 permission experiment; its receipt, `docs/dispatches/RECEIPT-JUNGLE4-PERMISSIONS-2026-08-29.md:14`, records "RAM+stake+seed 10 EOS" and lists the A seed separately. It is a measured historical cost, not a live display symbol. The first commit on this lane (`59aef1633`) rewrote it to A in 29 languages; that was wrong and is reverted here byte-for-byte to the pre-lane files.
- No contract, no chain write, no key. `registration_fee` on chain is unchanged and still says `0.0000 EOS`.

## Review repair

Codex review on `59aef16337` raised three P1 findings; all three were correct.

1. Missing lane dispatch — this file.
2. `displayA()` turned a missing fee into `0.0000 A` — now unread (`null`), with a test.
3. Fieldnotes EOS→A corrupted a measured cost — reverted.

## Receipts

Live config row, two foreign hosts, 2026-10-02:

```
https://vaulta.greymass.com  -> {"rows":[{"admin":"kingbeelovis","registration_fee":"0.0000 EOS","registration_days":365,"initialized":1}],"more":false,"next_key":""}
https://eos.api.eosnation.io -> {"rows":[{"admin":"kingbeelovis","registration_fee":"0.0000 EOS","registration_days":365,"initialized":1}],"more":false,"next_key":""}
```

Local gates, 2026-10-03, on the repaired tree:

```
node --test e2e/bnames-eternal.test.mjs e2e/bnames-rpc.test.mjs
ℹ tests 11
ℹ pass 11
ℹ fail 0

node skaists-conformance.mjs --only bnames.html --min 100
  100%  bnames.html [bee]  COLOUR 100 · TYPE 100 · RADIUS 100 · TARGET 100 · CONTRAST 100 · CASE 100  (112 checks)
  100%  bnames.html [raver]  COLOUR 100 · TYPE 100 · RADIUS 100 · TARGET 100 · CONTRAST 100 · CASE 100  (107 checks)
  100%  bnames.html [cypherpunk]  COLOUR 100 · TYPE 100 · RADIUS 100 · TARGET 100 · CONTRAST 100 · CASE 100  (394 checks)

git diff 59aef1633^ --stat -- surfaces/fieldnotes.html surfaces/lang-corpus.json
(no output: both files identical to their pre-lane bytes)
```

## State

- STATE: review repair pushed; awaiting exact-head CI and review.
- ORDER: #327 lands the main repair first; this lane then syncs repaired main.
- NOT DONE: merge. This seat authored #322 and does not press it.
