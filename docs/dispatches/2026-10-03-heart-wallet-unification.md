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

## Arweave confirmation and signing review

Code review found `BNRAR.txStatus` was reading `/tx/{id}` and expecting invented `status` / `confirmations` fields. It now reads `/tx/{id}/status`, validates the documented block height/hash and positive integer confirmation count, carries that evidence through `wallet-adapter-arweave.js::confirm`, bounds gateway reads, and rotates on malformed/rate-limited replies. The native transfer fee URL also now uses `/price/{bytes}/{target}`. Source: [Arweave HTTP API](https://docs.arweave.org/developers/arweave-node-server/http-api#get-transaction-status). HTTP 200 by itself never confirms a transaction.

`walletPublish` now reconstructs the exact signing bytes from the user's file, tags, quoted fee and anchor. Altering the worker's fee, data root or tags is refused before signing. The adapter battery has 33 passing checks, including these three negative controls and a documented-shape confirmation; the status unit battery has 11 passing cases. The full register battery is again 125/125 after restoring each register's intended title font; unified browser battery is 159/159.

A read-only live check used the actual revised `BNRAR.txStatus` against a transaction selected from a recent public block. It returned block 2013718, 26 confirmations and the block hash. The older estate vending receipt tested first returned unknown/404 and is retained as such, not relabeled successful. Exact requests, selection and both results: `docs/receipts/wallet-arweave-status-2026-10-03.json`. No new transaction was made.

The hub registry label is now skaists heART WALLet; atlas and stack generated outputs were rebuilt. Arweave loader versions were advanced so the revised shell and worker load the matching implementation.

## Final failure-path follow-through

The live hosted Autonomi metadata probe returned HTTP 405 with the expected skaists.dev CORS origin at 13:42:29 UTC. `ops/ant-writedoor/src/main.rs` still instantiates `UnwiredGateway`; the feature declaration is not a production ant-core implementation. The wallet therefore says to check availability, reports the closed service in plain language, and proves that no file bytes are sent on this refusal. Receipt: `docs/receipts/wallet-autonomi-availability-2026-10-03.json`. This is a remaining live backend gap, not a completed storage purchase.

Arweave publication now additionally verifies the returned RSA-PSS signature with the reviewed public key and reconstructs its transaction ID before persisting/submitting. A wrong-key/invalid-signature control is refused before submission. Arweave battery is 50/50; adapter battery remains 33/33 after this change.

CI at 908ef011a found one generated-hub mismatch: the Windows-written registry had CRLF while Git stored LF, so its baked byte hash differed on Linux. The registry was normalized to its committed LF bytes and the atlas rebuilt; the generated output correction is included. No rule or check was weakened. Exact failure: `FAIL the committed hub matches its registry regeneration (byte for byte)`. Earlier superseded branch runs were cancelled to release capacity for the current head; their cancelled checks are not passing evidence.

The last visual review found the raver word-fold rule hiding the publication dialog's heading. A dialog-specific rule now keeps the review title visible. The permanent Arweave battery now switches to a 390px viewport for file review and checks that the heading and both decisions fit the screen. Final battery: **51/51 in bee, 51/51 in raver, 51/51 in cypherpunk**, including invalid signature, outbox failures, retention, fee review and cancellation. This fixes the observed rendering defect rather than widening a test threshold.

## Account read demand and navigation authority

Saved public accounts now begin their automatic first read only when the account book is actually shown. Visiting the wallet home, keys or storage does not fan out fifty hidden account reads. `wallet-read-budget.mjs` now has nine passing checks, including zero account RPC calls on home and the same three-request ceiling after opening Accounts & coins.

The unified navigation and storage chooser are explicitly excluded from automatic bzDiD connection, as are keyboard navigation keys. A returning identity can use Tab and move between accounts/storage without a passkey prompt; the existing explicit keychain interaction still requests credentials in the negative control. Account battery is now 52/52; Trezor remains 22/22 after lazy reads. These changes preserve automatic connection for actual keychain work rather than treating navigation as signing intent.
