# skaists heART WALLet unification — 2026-10-03

Founder direction: one wallet identity, bPay as actions, explicit Autonomi/ANT and Arweave/AR choices, coins here and art on separate surfaces. No local server or local-file preview. Work started at 12:58:26 UTC; this is an intermediate implementation receipt, not final acceptance.

## Implemented

- `surfaces/wallet.html`: persistent identity and Accounts & coins / bPay / bPay store navigation across all three registers. A single storage chooser names Autonomi ANT on Arbitrum and Arweave AR. Art remains on the museum surface. Search, public JSON backup/import, and the account book sit with balances. Imports validate atomically, retain existing labels, deduplicate, and cannot assert hardware provenance.
- Trezor public import exports an EVM address once and records Ethereum, Base and Arbitrum separately. Existing account labels are preserved. No signing or firmware flashing was performed.
- `surfaces/bpay-invoice.js::quoteFile`: user-selected public file quotes use the existing `BnrSeam` / `myspace-adapter-ant.js` worker. Amounts remain exact atto-ANT values; malformed totals and unavailable services clear old prices. Worker startup failure restores controls. Quotes cannot authorize payment or publish. Reference invoices are disclosed separately. No implicit localhost service remains.
- `wallet.html::walletPublish`: small Arweave files (30,000-byte maximum) have an explicit review of exact fee, address, bytes and hash before signing; Cancel signs nothing. The same existing signing and outbox path performs publication. File names render as text. Injected addresses are requested on an explicit connection/publication gesture, not page load.
- `outboxWrite` now verifies persistence and refuses submission on storage failure; `outboxRead(true)` refuses corrupt saved state instead of replacing it. History trimming retains unresolved signed transactions. Submission acknowledgment still is not confirmation.
- Fable's helper/lint repairs through `649b0839c` are integrated in branch merge `7bda0c35a`. The enable-and-click helper remains pinned; no test re-enables a button except its ledgered helper.
- The chain matrix links the exact PR #338 dispatch at `09f3357a54c176bcdd1242bdf5bbe01c23b9a777`. Its private Solana/Vaulta acceptance and unpaid fixture fee remain explicitly bounded. This UI change does not turn that experiment into public settlement.

## Validation at this checkpoint

All browser results here use in-memory production-origin route fixtures with blocked/mocked network, never an HTTP listener or a local preview. They are source acceptance, not hosted deployment or live payments.

- `e2e/wallet-unified.mjs`: 159/159 across bee, raver, cypherpunk at 320, 390 and 1280 px. Public import/export/search, storage routes, exact ANT quotes, malformed quotes, service closure, worker failure, no credential calls, no localhost calls, no page errors or horizontal overflow.
- `e2e/wallet-arweave.mjs`: 48/48 in cypherpunk, including exact fee review, cancellation, hostile filename, signed mocked publication, oversized refusal, blocked storage and corrupt outbox. Before the final outbox repair, 46/46 passed separately in each of all three registers; the final three-register battery remains to run.
- `e2e/wallet-trezor.mjs`: 22/22, synthetic public exports including one-export multi-EVM import. No physical SAFE 7 acceptance claimed.
- `e2e/wallet-fund.mjs`: 97/97; coin arithmetic/contract identity suite 16/16.
- `e2e/bpay-phase-b-chooser.mjs`: 17/17, now itself serverless. The reference quote remains labeled and policy is preserved across presentation changes.
- Estate registry and generated stack metadata checks passed. Full register navigation battery and exact-head GitHub CI are still running/pending at this checkpoint.

## Remaining acceptance boundaries

No claim of ten-billion-user capacity, public Solana/Vaulta settlement, custom SAFE 7 firmware readiness, physical device acceptance, live ANT payment, or live Arweave publication is made. No funds, real user files or private keys were used. Public-site deployment remains separately verifiable; a PR or source pass is not deployment.

## Continued repair after checkpoint 262f2d940

- `readSlot` / `drainReads` in wallet.html impose one three-read budget across automatic bulk reads, user refreshes, and token reads. Removed or cross-tab-invalidated queued records do not dispatch. Render reuses unchanged account cards and preserves unfinished token input and its caret through read updates.
- `e2e/wallet-read-budget.mjs`: eight checks with 50 Base accounts, delayed mocked RPC, overlapping manual/token refresh and removal. Forty-eight remaining accounts succeed while one failure is isolated; peak concurrent RPC requests is three. This measures one browser against fixtures, not global capacity.
- Account battery now 50/50, including token draft retention. Arweave battery now 49/49 including retention of all 40 unresolved signed transactions when trimming historical receipts. Last three-register pass before that added retention assertion was 48/48 each; final assertion passes in cypherpunk.
- Five core wallet browser batteries now use committed `e2e/lib/wallet-source-fixture.mjs` rather than temporary transport conversions. Every default network route is denied unless the test explicitly mocks it. There is no local listener, and these fixtures cannot be mistaken for a deployed site. Chooser and unified batteries also run without listeners.
- Full navigation/presentation battery passed 125/125 before the small brand typography adjustment; the updated run is completing. Fund 97/97 and Trezor 22/22 passed using the committed fixture helper. Outbox retry now reports storage errors instead of leaving an unhandled rejection, and composer preview escapes adapter-provided text.
