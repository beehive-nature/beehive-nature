# Agent 20 — hosted ANT storage purchasing

Date: 2026-10-10 (America/Denver). Status: PR #391 MERGED, hosted bytes and non-spending controls/quote VERIFIED; real purchase acceptance remains OPEN. This is payment for Autonomi storage with ANT, not an ANT-token purchase.

## Delivered path

The existing wallet bPay chooser now has a separate public-file purchase action. It reuses `surfaces/ant-pay.js` wire encoders and the already-vendored Autonomi browser SDK 0.1.1 for quoting, upload checkpoints, upload and download. It requires a browser EIP-1193 wallet on Arbitrum One. The quote-only action still cancels payment without signing. Physical SAFE 7 and device operations remain with their owner.

`AntPay.createHosted` binds SHA-256, byte count, file name, payer, Arbitrum One chain, bundled token/vault, exact quote hashes/recipients/amounts, transaction calldata, separate aggregate ETH ceiling and a two-minute invoice expiry. The 100 ANT cap is per file; it is not authorization. Each wave requires an exact invoice confirmation. Contracts come from the SDK's compiled network profile. Only `eth_sendTransaction` asks the person's wallet to sign; no private-key export or terminal payer exists in this path.

Gas reservations follow `ops/ant-extsig/src/budget.rs`: reserve before sending, retain uncertainty, reduce only against verified mined gas. Approval is exact. Payment reserves a disclosed 3,000,000-gas bound and must simulate within that bound before sending. A bound exceeding the person's aggregate ETH limit refuses before any approval. The journal persists before every wallet send, including approvals. Recovery verifies the transaction's sender, recipient, nonce, chain, value, calldata and fee bounds and its canonical block with one subsequent block. An unknown wallet response is searched by payer and nonce in resumable pages of up to 1,000 blocks; absence never permits another send. Reverts retain spent gas and are not retried automatically.

A Web Lock serializes purchase operations across this origin's tabs. A shared quote-claim index prevents another saved file from reusing a claimed quote. These are browser-local protections: another device, cleared site data or lost browser storage is not a distributed replay ledger. The UI says to preserve site data and resume in this browser. An expired invoice refuses further signing. If only approvals were attempted, recovery first verifies them, preserves their gas, discards only the unpaid checkpoint and obtains fresh quotes for a new explicit authorization. Any attempted storage payment stays on the reconciliation path and is never silently repaid.

After upload, the wallet saves the returned file reference, downloads the file, compares its SHA-256 and byte count with the original, rechecks payment receipts and only then records `bpay.ant.reconciled/1`. Files are currently capped at 32 MiB for this verified in-browser hashing/download path. Merkle signing is excluded by explicitly selecting the SDK's single/wave mode. Large-file scaling is not claimed.

## Ownership and upstream

- Dedicated worktree: `C:/Users/travi/wt-codex-ant-storage-agent20`; no shared-checkout edits or staging.
- Read preserved handoff, PR #211 (still open; contains known concurrency/approval persistence gaps), PR #44 and merged external-signing work. No code copied from private bridges.
- Adjacent chat **Assess bView Shu Benchmark 003** explicitly responded that it owns playback/measurement/local packaging and the ANT purchase/write gateway remains with the storage lane. This change needs no gateway or `ops/` deployment: it uses the existing browser SDK; `UnwiredGateway` remains a separate unimplemented backend path.
- David's latest #622 closure carries work back to #504. Current #504 asks for per-kind counters and same-workload delivered/published capture; #505 was field-accepted. No measurement completion is claimed by this purchasing lane.

## Verification receipts

- `node --test e2e/ant-hosted-purchase.test.mjs`: 16/16 pass. Fixture-only; exact binding, expiry/cancel, storage/gas ceilings, durable refusal, uncertain send/receipt, nonce recovery, reverts, reload, overlap, no duplicate charge and hash mismatch.
- `node --test e2e/ant-pay.test.mjs`: 9/9 pre-existing shared payer tests pass.
- `node e2e/ant-hosted-browser.mjs`: all three registers at 390px pass explicit authorization, cancellation with no signature, exact approval/payment, verified retrieval and retry without duplicate sends. Production-origin routes are fulfilled from source; chain/wallet/storage are fixtures. No local server.
- `node scripts/estate-check.mjs`: pass. No surfaces added or moved.
- `node scripts/r5-surface-audit.mjs`: pass.
- `e2e/hooks-installed.test.sh`: pass. Installer refused to replace the pre-existing estate hook; preserved it rather than overwriting shared configuration.
- Existing wallet-unified test initially stopped inside Playwright's `waitForFunction` under the product's CSP (`unsafe-eval` prohibited). The test now polls with `evaluate`, preserving the product CSP. Full rerun and CI receipts follow below.

## Real-purchase boundary

No valid bounded authorization for a wallet test file was found. `ETERNALIZATION-EDITION-V2.json` concerns a specific genealogy archive, names artifact/client stop conditions and still carries `uploadEnabled:false`; it cannot authorize an unrelated wallet upload. No funds have been spent and no real purchased/retrieved file receipt exists in this dispatch.

The missing live authorization is the key holder's confirmation of a fresh hosted invoice binding the chosen public file SHA-256/size, payer, Arbitrum One token/vault/quotes, ANT amount within the 100 ANT ceiling, explicit aggregate ETH maximum and expiry, followed by the wallet's transaction signatures. It must occur in the hosted wallet. No chat approval, archive badge, fixture receipt or merge substitutes for it.

- Full wallet regression rerun: **201/201 checks passed**, all three registers at 320/390/1280px; public-account import/export/following and quote-only behavior preserved.
- Reference invoice and chooser fixtures: **18/18 and 19/19 passed**, respectively.

## Live baseline before deployment

The existing public wallet was checked from a fresh 390px browser at `2026-10-10T23:51:01Z`. The keyless probe reached "Asking Autonomi storage nodes for a price" but returned no quote within 90 seconds; it was cancelled without payment authorization. The new purchase panel was correctly absent before deployment. Receipt: `docs/receipts/agent20-ant-baseline-live-2026-10-10.json`. Reproducible probe: `node e2e/ant-hosted-live.mjs <output.json>`. This timeout is an unresolved live network observation, not a successful quote or a storage purchase.

Mobile inspection moved raw receipt JSON into a disclosure and provides a direct download of the bytes already retrieved and hash-verified. Fixture purchases remain distinct from live acceptance.
- Live bundled payment profile and browser RPC check: Arbitrum One chain 42161, token `0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684`, vault `0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26`; `https://arb1.arbitrum.io/rpc` returned HTTP 200 and `eth_chainId: 0xa4b1`. This read-only check confirms browser RPC reachability, not storage-node availability or a purchase.

- Pre-release recovery review found and repaired an elapsed-history refusal: unknown broadcasts now search successive bounded history pages, preserving their cursor and never resubmitting. The delayed-return regression passes.

## Extended live quote and CI correction

The same keyless hosted quote probe was allowed 300 seconds after the first 90-second timeout. It returned **0.3859936435546875 ANT for 49 bytes**, at approximately `2026-10-11T00:02:39Z` (October 10 in Denver). This supersedes the timeout as the latest quote observation, but still authorizes nothing and proves no upload or retrieval. Receipt: `docs/receipts/agent20-ant-extended-live-2026-10-10.json`.

PR #391's first full current-source test run (`38097285561`, source `7e124126fff66531a76ef5f1c61735a539f96468`) exposed a wallet-register gate failure: the new help text said "open the storage invoice below", violating the rule against positional directions. A local reproduction named line 1629 with that exact text. The correction names the actual "Pay ANT to store a public file" control. The source has also incorporated newer main `b9c75cd7b7a568fa29760acd89152c67d17aa585`; fresh CI is required for the resulting head. This record does not label the failed run green.

The local register gate completed **127/128**, with that wording assertion its sole failure. CI also exposed a missing generated dependency-directory update: `node scripts/build-stack-surfaces.mjs --check` returned `Surface directory needs regeneration`. Regenerating `surfaces/stack.html` changed only the wallet row, adding the new `ant-pay.js` reference and current bPay query version. Both Engine Room generator checks pass after regeneration. The full register correction and final head remain subject to fresh CI.

## Final merge, deployment and hosted receipts

- [PR #391](https://github.com/beehive-nature/beehive-nature/pull/391) merged at `2026-10-11T03:19:50Z` as `42c466b56feaf94796da828302d01cdc714b0156`.
- Tested source: `57c5c4d0083e15570e4e3a3e9cdc96bbb95a60d8`. All **eight PR workflows completed successfully**. The corrected local register gate passed **128/128**. The failed predecessor remains failed; the raw logs confirmed exactly the two omissions documented above.
- [Tests 38100139931](https://github.com/beehive-nature/beehive-nature/actions/runs/38100139931): all seven shards passed, including wallet, node, formal, static, meter, eternal and Rust. The hosted ANT fixture and corrected register/dependency checks passed in that run.
- Other successful source runs: secret-scan `38100139902`; WB001 SAW `38100139906`; WB002 SAW `38100139789`; WB002 WASM `38100140021`; RB `38100139816`; PQ `38100139908`; PQ SAW `38100139891`.
- The first Pages run `38108026422` was cancelled when a newer main deployment queued. Deployed descendant: `ee4893383b0cab7cfb8953fed79f55f755bfdbac`, containing the #391 merge and subsequent bView work. [Pages 38108411515](https://github.com/beehive-nature/beehive-nature/actions/runs/38108411515) completed successfully. Git ancestry and unchanged product blobs were verified.
- At `2026-10-11T03:30:52Z`, public HTTP 200 responses for `wallet.html`, `ant-pay.js?v=8`, `bpay-invoice.js?v=8` and `stack.html` matched the tested Git blobs byte-for-byte. Exact SHA-256 values and byte counts are in the release receipt.
- The actual [hosted wallet](https://skaists.dev/surfaces/wallet.html#bpay-sec), without routed fixtures, passed control checks at 390px in bee, raver and cypherpunk: purchase panel visible, ETH limit blank, missing file and missing ETH limit refused before any invoice, and no horizontal overflow. Screenshots were visually inspected for the bee view.
- A fresh post-deployment quote returned **0.329302634765625 ANT for 49 bytes** at approximately `2026-10-11T03:36:21Z`. ETH remains separate. No wallet signature, payment, upload or retrieval occurred. The final probe samples status and completion together; an earlier capture sampled them separately and retained stale progress text, so that capture is not used as a quote receipt.

Durable machine receipt: `docs/receipts/agent20-ant-hosted-release-2026-10-10.json`. Reproducible non-spending probes: `docs/receipts/agent20-ant-hosted-live-probe-2026-10-10.mjs` and `docs/receipts/agent20-ant-hosted-controls-probe-2026-10-10.mjs`.

The closeout changes only this dispatch and receipt/probe files; it does not change product bytes. Broad CI is skipped for that receipt-only commit because the probes have already run against the deployed site and the product source has the eight green runs above. Later main CI is a separate result and is not claimed green here. The remaining live purchase gate is still the exact bounded hosted invoice and the key holder's wallet confirmations described above; **no funds spent**.

## Native bzDiD correction after hosted invoice preparation

The founder selected the estate's decentralized bzDiD wallet rather than an injected browser extension. "Hosted" denotes delivery of the public UI, not hosted key custody. The existing first-party signing core is Rust/WASM (`crates/bnr-keys/src/lib.rs::sign_digest65`, exposed by `surfaces/onboarding/vendor/bnr-keys.js::sign`), not a separate C++ wallet. Existing bzDiD context derivation remains `BZDIDKEY.deriveK1Key` with `evm:<soul>`; this change does not claim that the complete UI or policy evaluator moved into Rust.

The follow-up candidate adds `wallet.html::antStorageSigner`, requires the Rust core, exposes only public identity and signed envelopes to the payment coordinator, and keeps private derived bytes in the existing keychain frame. `AntPay.createHosted::settle` persists the native signed envelope and its computed transaction hash before `eth_sendRawTransaction`. Cancellation/expiry is rechecked before broadcast. Recovery observes the original hash/nonce and sends no replacement. The signer validates the authorized file, payer, chain, contracts, exact calldata, transaction fields, expiry and fee reservation, and enforces ANT plus ETH daily caps. The production purchase panel now selects this native signer and checks keychain readiness before asking Autonomi for an invoice. No injected-wallet fallback is used by that panel.

The first real invoice-preparation attempt on the public wallet stopped before payment: `File upload failed: insufficient peers` and `could not connect to any WebRtcDirect seed`; all listed endpoints were in the failed-connection cache. A fresh unpaid attempt was explicitly stopped when the founder selected the native-wallet path. No payable invoice, authorization, signature, payment, upload or retrieved-file receipt resulted. The exact probe is `agent20-public-probe.txt`, 49 UTF-8 bytes. Proposed fee ceiling: **0.0002 ETH**, still unapproved. A read-only Arbitrum gas-price observation at `2026-10-11T03:50:13Z` was 20,022,000 wei/gas, implying a payment-only reservation of 0.000120132 ETH at twice that price and 3,000,000 gas, before approval gas. This is not a fresh ANT invoice or authority to spend.

Validation of the native candidate:

- Payer/reference unit tests: **27/27 passed**, including native refusal, expiry during signing, persist-before-broadcast and lost-reply recovery without another send.
- Serverless production-origin browser fixtures passed in bee, raver and cypherpunk at 390px. They use a deterministic throwaway identity, the real Rust/WASM signing core and mocked storage/chain services. They prove explicit invoice authorization, cancellation, independent decoding of EIP-1559 fields, independent vendored verification/recovery of Rust-produced signatures, durable signed bytes before broadcast, retrieved-byte hash matching and retry without duplicate charges.
- Native altered value/chain/recipient/calldata/gas requests are refused. The zero-ETH-cap mutation initially caught the legacy daily-cap display tolerance accepting a sub-nanounit fixture fee; the native storage signer now applies a strict comparison, and that refusal passes.
- These are fixture results, not a live purchase. No funds spent. The Python command alias resolved to the Windows Store shim during a text-edit attempt; no edit occurred through it, and the edit was performed with Node instead.
- A concurrent Claude lane was identified at branch `claude/own-key-ant-storage`, in its own `bnr-settlement-adapter-03c61e` worktree. Its in-progress native provider overlaps this candidate. That worktree was inspected read-only and left untouched. There must be one landed storage signing path; neither implementation is represented as deployed by this entry.
