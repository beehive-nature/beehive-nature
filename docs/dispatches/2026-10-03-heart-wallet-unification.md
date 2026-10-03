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


## Review follow-through after 499118bd6

The 499118bd6 GitHub wallet job passed, as did static, Rust and both secret scans; wider estate jobs were still running when a fresh review arrived. All four actionable observations were taken up:

- Register the exact first-party `surfaces/adapter-seam.js` rider in design acceptance. The standalone design runner was not executed because it starts localhost and uses file previews; source/browser fixture checks remain serverless.
- Advance the Arweave worker entry URL to v3 along with its already-versioned nested reader, so cached v2 workers cannot retain the old status endpoint.
- Cancel native default navigation for routed wallet controls, including the brand link. The register battery now exercises home/back/forward through the brand.
- Remove both uses of the enable-and-click helper from the Arweave suite. Fixtures change the gateway balance, notify the production refresh, wait for production enablement, and use Playwright trusted clicks. Both paths assert `event.isTrusted`. No browser control is force-enabled by this suite. Fable's pinned helper/lint remains intact as a historical guard, with no active callers.

Arweave acceptance now passes **53/53 in each of bee, raver and cypherpunk** with trusted clicks. The lint and its self-tests pass. The extended register battery is running at this checkpoint. No physical extension or device result is inferred from these fixtures.


## Older review findings and wider CI repaired

The complete register run at 9f3b8c46f passed **127/127**, including the new brand Back/Forward controls. Reviewing all unresolved threads exposed older findings still present in the inherited branch; they were not treated as cleared by the wallet CI job.

- `connectTrezor` now uses the exact upstream 9.7.3 URL with SHA-384 browser integrity and anonymous CORS. The wallet CSP permits same-origin scripts, its existing inline scripts, WASM compilation and that exact Trezor script URL; objects and foreign base URLs are blocked. Changed bridge bytes fail before execution. Upstream response with `Origin: https://skaists.dev` returned CORS `*`; receipt is `docs/receipts/wallet-trezor-pin-2026-10-03.json`. The SDK remains upstream-hosted, content-pinned, and shares the wallet realm when valid; this is not an independent SDK security audit or physical device acceptance.
- `trezorSelection` defaults Solana to the documented four-level Suite path and labels the three-level option compatibility. Source: https://connect.trezor.io/9/methods/solana/solanaGetAddress/ . The test verifies account 2 as m/44'/501'/1'/0'.
- `solCall` preserves integer JSON tokens as strings before numeric conversion; `balance` accepts only unsigned u64 lamports. The account test proves 9007199254740993 lamports display as 9007199.254740993 SOL and refuses missing, negative, fractional and overflowing values.
- `wallet-adapter-vaulta.js::displayA` refuses missing or malformed liquid balances. Hive already refuses malformed liquid HIVE. Neither reader fabricates zero. The old adapter test explicitly expecting a fabricated zero is replaced with a refusal assertion.
- `readPublicBalance` respawns a down worker before waiting for attachment; a crash/Refresh recovery test passes. Updated worker URLs prevent old cached balance readers from persisting.
- The edit form retains its original storage revision even after another tab's storage event. A stale edit cannot overwrite the newer label. The scope evidence link now uses immutable 499118bd6 instead of a disposable branch name.

Current source passes **61 account**, **23 Trezor**, **33 adapter**, **53 Arweave** and **159 unified-surface** checks. Trezor includes a tampered-script SRI negative control, then a matching fixture script; its hash substitution exists only in the test HTML. No production integrity check is bypassed.

The wider 499118bd6 CI finished with wallet/static/eternal/meter/Rust green and node red. Exact node failures were the changed quote-only wording, removed old header translation selectors, wallet translation floor (18 vs 23), and a no-selection assertion treating undefined differently from null. Repairs preserve their behavioral checks: quote-only and no authorization route, current translated navigation plus exact brand, and no audience/selection timestamp before a gesture. Six new wallet keys have all 29 language cells; translations are machine drafts, not native-speaker attestation. Wallet Russian coverage now measures **24 keyed / 29 visible**, above the unchanged floor of 23. Polish rendering passes **25/25**, Phase A **18/18**, and shared-policy ownership **2/2**. These three affected browser runners now also use serverless production-origin fixtures. The lint and diff check pass.


## RPC markup and actual dependency load

`loadAbiUi` now escapes untrusted ABI field names and types in attribute values. A malicious field containing an image/event-handler payload remains the exact input attribute text and creates no injected element or execution. Adapter battery is **34/34**. Network error messages, transaction-id snippets, adapter states and CPU availability inserted into the affected HTML status panels are escaped too. This closes observed sinks, not a claim of a complete security audit.

A separate browser receipt proves the actual upstream 9.7.3 bundle loaded under the wallet's CSP, CORS and exact SRI hash on an in-memory skaists.dev-origin source page: `docs/receipts/wallet-trezor-browser-pin-2026-10-03.json`. No SDK initialization, device, account export, signing or firmware method was invoked. Estate source checks pass **11/11**, including every language key and current English text.


## Bitcoin cumulative precision

The matching Bitcoin read path had the same pre-BigInt rounding defect in cumulative received/spent totals. `wallet-adapter-bitcoin.js::esplora` now preserves integer JSON tokens before parsing, and `balance` strictly validates both u64 sums and the confirmed supply bound before subtraction. Missing/fractional/negative totals never become zero. Missing pending statistics remain unknown (`null`) rather than an invented zero. The worker entry version advances for returning readers.

The account battery is now **65/65**, including 9007199254740993 received minus 9007199254740992 spent yielding exactly one satoshi, and missing, negative-result and fractional controls. This is fixture acceptance, not an assertion of independently verified chain balances.


## SAFE 7 transport review

A later review correctly separated loading the host SDK from successful SAFE 7 pairing. The older THP matrix documents the legacy 9.7.3 iframe/WebUSB failure; it is not a physical acceptance receipt for this wallet. `connectTrezor` now explicitly sets `coreMode: 'suite-web'` and supplies the required application name. It does not select `auto`, probe the desktop WebSocket bridge, or fall back to the legacy iframe transport. The visible form names Trezor Suite web and explicitly says physical SAFE 7 end-to-end verification is pending, with manual public-address entry still available.

Source evidence: the exact pinned host bundle's `getInitTarget` selects `CoreInSuiteWeb`; its `getSuiteUrl` routes to https://suite.trezor.io/web/connect-popup and delegates transport handling to Suite. Upstream at `4434f0fdc6f140f08dabe2d44f825429cbfbbae7` has the same route in [core-in-suite-web.ts](https://github.com/trezor/trezor-suite/blob/4434f0fdc6f140f08dabe2d44f825429cbfbbae7/packages/connect-web/src/impl/core-in-suite-web.ts). Its [WebUsbTransport](https://github.com/trezor/trezor-suite/blob/4434f0fdc6f140f08dabe2d44f825429cbfbbae7/packages/transport-web/src/transports/webusb.ts) extends [AbstractApiTransport](https://github.com/trezor/trezor-suite/blob/4434f0fdc6f140f08dabe2d44f825429cbfbbae7/packages/transport-common/src/transports/abstractApi.ts), where THP message handling lives; absence of THP strings in a thin wrapper alone does not establish lack of support. This upstream source observation is not proof of the deployed Suite build or physical pairing.

The actual pinned SDK initialized in Suite web mode with **zero WebSocket attempts**, without invoking a device/export/signing method. Receipt: `docs/receipts/wallet-trezor-suite-web-2026-10-03.json`. Trezor browser battery is **24/24**, including the explicit transport/application-name assertion. No local server was started. Current official browser guidance: https://trezor.io/guides/trezor-suite/use-trezor-suite-in-your-browser-web-app .

For 3eebfdd25, the wallet, static, Rust/payment, node and standards-meter CI jobs passed. The push run's ETERNAL job failed only PLUR's raver festival scroll-position assertion; the parallel PR run of the exact same source passed that suite, and preceding 17f173238 passed the complete workflow. The failed job was rerun unchanged; no assertion or threshold was weakened. This history is retained rather than erased by the subsequent transport revision.
