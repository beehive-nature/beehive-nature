# DISPATCH — ant-pay.js: Phase E's shared payer (for zCode · bData, and bOPus5 · MY SPACE rail 4)

**From:** Seat 3 (Claude Code, Fable 5.1), 2026-09-21. **Order:** Seat-1 decisions B/C, same day; founder: "my paid
upload to ANT with the video should be able to be repeated by a billion other users."
**FOUNDER ACTION SURFACE:** My Data → 🌐 Public → the price → authorize → **pay with your wallet** (the step this
module makes possible). The first real payment is the founder's press in that UI. Agents never press it.

## CLAIM

`surfaces/ant-pay.js` is ONE shared module that takes a prepared, authorized price and gets it paid by the
person's own wallet, then finalizes through the keyless bridge and returns a receipt. It is the common piece:
**zCode wires it into `bdata.html`; bOPus5 wires it into MY SPACE rail 4. Neither re-implements payment.**
This PR ships the module and its tests only. `bdata.html` is NOT touched here — its wiring is a separate PR
in zCode's lane.

## THE SURFACE CONTRACT (what your page calls)

```js
var signer = AntPay.trezorSigner(await AntPay.loadTrezorConnect(document, manifest), { rpc })   // the ruled path
          // or AntPay.injectedSigner(window.ethereum)                                           // everyone without a Trezor
var payer  = AntPay.create({ bridge, rpc: 'https://arb1.arbitrum.io/rpc', signer, store, onState })
var receipt = await payer.pay({ prepare, authorization, confirmPlan, signal })
```

- `prepare` — the bridge's `/v1/upload/prepare` answer, untouched. `authorization` — `{ state:'authorized-for-signing',
  upload_id, ant_ceiling_atto }` from `/v1/authorization`.
- `confirmPlan(plan)` — YOUR button. It is handed `{ signer, payer, token, spender, ant_total_atto, approve_exact_atto,
  quotes, payment_calls, wallet_confirmations }` and must resolve `true` from a real press. SPEC-AUTONOMI-TREZOR-1 §1:
  the exact confirmation count is on screen BEFORE any signing. Anything but `true` = nothing signed.
- `onState` — `plan → signing(n of m) → waiting(seconds) → finalizing → done{receipt}` or `refused{code,message}`.
  The waiting state carries real seconds; `signal` is "stop waiting" (it cancels nothing and says so).
- `store` — `{get,set}` handed in by the page (the module never touches localStorage). Tx hashes are persisted
  BEFORE finalize. `payer.resume()` finalizes a paid-but-unfinished upload without signing; a second `pay()` is refused.
- Refusal codes, each with plain words: `no-quote · merkle-not-built · quote-sum · bad-plan · not-authorized ·
  over-ceiling · no-wallet · wrong-chain · no-contracts · short-ant · no-gas · not-confirmed · wallet-declined ·
  tx-reverted · stopped-waiting · paid-not-finalized · partial-store · already-paid · nothing-to-resume`.
  Never a default price, never a guessed address.

## EVIDENCE

- `e2e/ant-pay.test.mjs` **9/9**, registered in `tests.yml`. Mock bridge + mock chain + mock wallet. **Mainnet spend: 0.**
- The calldata is held to a foreign oracle: a REAL `PaymentVaultV2.payForQuotes` transaction on Arbitrum One
  (`e2e/ant-pay-vector.json`, read from Blockscout 2026-09-21) re-encodes byte for byte. RLP is held to the
  Ethereum wiki's vectors; the EIP-1559 envelope to a hand-checked byte string.
- Laws asserted on the file itself: no key material or message-signing calls, no unlimited approval, no contract
  address anywhere in the module, Trezor Connect fetched on gesture only, storage handed in.

## BOUNDARY NOT CROSSED — and three things that are NOT done

1. **The bridge does not yet name its contracts.** `GET /health` has no `evm` block, so against today's bridge
   `pay()` refuses `no-contracts` — by design (SPEC §2: addresses come from the installed binary, never a document).
   Needed in `family-lineage/antd-bridge`: `evm: { chain_id, payment_token, payment_vault }` read from evmlib's
   `Network::ArbitrumOne`. Until that lands, nobody can pay through this module. That is the truth.
2. **Merkle plans are refused**, here and in the bridge (`finalize` returns 501 for merkle). Files over ~64 chunks
   (~260 MB) cannot be paid yet. The founder's video is 55 quotes: wave, one payment call, two wallet confirmations.
3. **"Verify by downloading" is prose until the bridge can download** (`capabilities: ['verify-download']`).
   The module says "not available yet" with the reason; it never fakes a check.
4. Not proven on a device: the Trezor Connect adapter is tested against a mock of Connect's API. What the device
   screen shows for `payForQuotes` calldata (SPEC §2's blind-signing risk) is still unanswered; gate AT-1
   (Sepolia bench, founder signs) is the honest next proof. Bridge and module would need `arbitrum-sepolia` for that.

No payment. No signature. No finalize. No press on the live bridge. `bdata.html` untouched.

## For the two seats

- **zCode (bData):** replace the "signing arrives with Phase E" prose with the pay step driven by `onState`; one
  primary; the plan row uses `PlainRow`; refusals are guard-lilac prose, never a dead button. Keep your `:8807`
  abort guard in every gate.
- **bOPus5 (MY SPACE rail 4):** same contract. If your rail needs a different store or signer order, pass them in —
  do not fork the module.
