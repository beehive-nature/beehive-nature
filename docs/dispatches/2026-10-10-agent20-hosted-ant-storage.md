# Agent 20 — hosted ANT storage purchasing

Date: 2026-10-10 (America/Denver). Status: implementation and fixture acceptance; real purchase acceptance remains OPEN. This is payment for Autonomi storage with ANT, not an ANT-token purchase.

## Delivered path

The existing wallet bPay chooser now has a separate public-file purchase action. It reuses `surfaces/ant-pay.js` wire encoders and the already-vendored Autonomi browser SDK 0.1.1 for quoting, upload checkpoints, upload and download. It requires a browser EIP-1193 wallet on Arbitrum One. The quote-only action still cancels payment without signing. Physical SAFE 7 and device operations remain with their owner.

`AntPay.createHosted` binds SHA-256, byte count, file name, payer, Arbitrum One chain, bundled token/vault, exact quote hashes/recipients/amounts, transaction calldata, separate aggregate ETH ceiling and a two-minute invoice expiry. The 100 ANT cap is per file; it is not authorization. Each wave requires an exact invoice confirmation. Contracts come from the SDK's compiled network profile. Only `eth_sendTransaction` asks the person's wallet to sign; no private-key export or terminal payer exists in this path.

Gas reservations follow `ops/ant-extsig/src/budget.rs`: reserve before sending, retain uncertainty, reduce only against verified mined gas. Approval is exact. Payment reserves a disclosed 3,000,000-gas bound and must simulate within that bound before sending. A bound exceeding the person's aggregate ETH limit refuses before any approval. The journal persists before every wallet send, including approvals. Recovery verifies the transaction's sender, recipient, nonce, chain, value, calldata and fee bounds and its canonical block with one subsequent block. An unknown wallet response is searched by payer and nonce over up to 1,000 blocks; absence never permits another send. Reverts retain spent gas and are not retried automatically.

A Web Lock serializes purchase operations across this origin's tabs. A shared quote-claim index prevents another saved file from reusing a claimed quote. These are browser-local protections: another device, cleared site data or lost browser storage is not a distributed replay ledger. The UI says to preserve site data and resume in this browser. An expired invoice refuses further signing. If only approvals were attempted, recovery first verifies them, preserves their gas, discards only the unpaid checkpoint and obtains fresh quotes for a new explicit authorization. Any attempted storage payment stays on the reconciliation path and is never silently repaid.

After upload, the wallet saves the returned file reference, downloads the file, compares its SHA-256 and byte count with the original, rechecks payment receipts and only then records `bpay.ant.reconciled/1`. Files are currently capped at 32 MiB for this verified in-browser hashing/download path. Merkle signing is excluded by explicitly selecting the SDK's single/wave mode. Large-file scaling is not claimed.

## Ownership and upstream

- Dedicated worktree: `C:/Users/travi/wt-codex-ant-storage-agent20`; no shared-checkout edits or staging.
- Read preserved handoff, PR #211 (still open; contains known concurrency/approval persistence gaps), PR #44 and merged external-signing work. No code copied from private bridges.
- Adjacent chat **Assess bView Shu Benchmark 003** explicitly responded that it owns playback/measurement/local packaging and the ANT purchase/write gateway remains with the storage lane. This change needs no gateway or `ops/` deployment: it uses the existing browser SDK; `UnwiredGateway` remains a separate unimplemented backend path.
- David's latest #622 closure carries work back to #504. Current #504 asks for per-kind counters and same-workload delivered/published capture; #505 was field-accepted. No measurement completion is claimed by this purchasing lane.

## Verification receipts

- `node --test e2e/ant-hosted-purchase.test.mjs`: 15/15 pass. Fixture-only; exact binding, expiry/cancel, storage/gas ceilings, durable refusal, uncertain send/receipt, nonce recovery, reverts, reload, overlap, no duplicate charge and hash mismatch.
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
