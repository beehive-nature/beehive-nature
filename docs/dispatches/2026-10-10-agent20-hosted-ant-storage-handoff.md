# Agent 20 — Hosted ANT Storage Purchasing

Status: #391 and native bzDiD follow-up #396 MERGED AND DEPLOYED. Native public bytes and non-spending controls VERIFIED. Fresh bound invoice and live paid retrieval remain OPEN, awaiting the founder's existing-passkey sign-in and then explicit bounded payment authorization.

## Current continuation, 2026-10-11

Latest accepted deployment: Pages `38127860473` attempt 1 completed successfully on `ae4a554cd13b14185112d958d4de3cd6c476b12e`; deploy finished at `2026-10-11T09:36:57Z`. The six public asset checks passed at `09:39:17Z`. Five runtime/core files match tested #396 source byte-for-byte; stack.html matches deployment in full and its wallet row matches the tested source. The actual Codex wallet was reloaded only after confirming it was idle and disconnected; native invoice controls and the visible Rust self-test passed badge were observed.

The exact 49-byte probe was selected with a proposed, unapproved `0.0002 ETH` aggregate fee ceiling. Preparation refused because the existing bzDiD keychain is disconnected. The existing-passkey sign-in was opened, and user presence requested once. Do not create a new identity or request any recovery secret. The file input reset after refusal: reselect `tools/agent20-public-probe.txt` after sign-in before retrying. ANT total remains null; no signature, payment, uploaded file or retrieval receipt exists. Durable release receipt: `docs/receipts/agent20-ant-native-hosted-release-2026-10-10.json`. Older queued-deployment notes below are historical.

PR #391 merged as `42c466b56feaf94796da828302d01cdc714b0156`; all eight source workflows and all eight merge-commit workflows succeeded. Its v8 public release and non-spending hosted controls were verified. A quote alone did not establish a bound payable invoice or purchased retrieval.

The founder selected the estate's own bzDiD wallet and clarified that the Rust kernel is the root. PR #396 merged as `283babc42dbb7caffb1872e4fd82565d2db7edc8` after all eight workflows succeeded on source `54d8e96c4c5511fb39835da36d3390757b07034d`. The storage panel requires the first-party Rust signer, with no extension or JavaScript signing fallback. Six real-Rust fixture purchases passed across three registers and two phone widths. These are mocked-network receipts, not mainnet payments.

Custody correction: Rust computes the signature, but key material and policy still share the wallet page's JavaScript realm. There is no isolated keychain frame. Independent Rust authority over custody, aggregate authorization and cross-device replay is UNVERIFIED. Claude's competing provider will not land; its PR #400 adds envelope validation, a vault pin and scoped authorization, but does not establish isolated custody. Inspect its current status before any live payment; do not duplicate or modify that owner's worktree.

The 49-byte public probe remains unpaid. Its earlier 0.0002 ETH fee ceiling was only a proposal. No standing genealogy or bView budget authorizes this file. The public page's keychain was disconnected on the latest read, and a fresh payable ANT invoice has not been prepared. Connect the existing bzDiD keychain through the hosted UI, obtain a fresh bound invoice, show ANT and aggregate ETH separately, and obtain the founder's explicit bounded authorization before spending. Never request or export a seed.

Latest deployment observation: Pages run `38120141518` on descendant `48c8d2416f7ad4bd46ca1054646b6a66d313a183` was queued. A public-byte check at `2026-10-11T07:31:45Z` failed for the new wallet/adapters; the site still served the older release. Five runtime/core files are unchanged between tested source and this descendant; the stack inventory has an unrelated bDrop change. Hold receipt-only main pushes while this deployment waits, to avoid superseding it again. Recheck deployment and actual bytes rather than treating this paragraph as a current receipt.

Deployment coordination update: follow **38120141518 attempt 2**, rerun by bView at `2026-10-11T08:55:40Z`; attempt 1 and the documentation-only successor run `38126402218` are cancelled. Main `7a9d6e1ab` differs from the selected release only in the bDrop dispatch. bView acknowledged the founder-directed hold and the single deployment; genealogy and #400 were notified. Coordination record: https://github.com/beehive-nature/beehive-nature/pull/396#issuecomment-6107356404 . No further reruns/cancellations or receipt-only main pushes while this attempt waits. Keep checking actual run attempt, not the legacy Pages latest-build status or an old cancellation snapshot.

## User order, preserved

Start a new session from current main. Finish hosted Autonomi storage purchasing through heART WALLet, reusing existing bPay and ANT adapters. This means paying for storage with ANT, not buying ANT tokens. Check ownership first and coordinate with active backend owners instead of duplicating their work.

Deliver the complete path: live quote → bound invoice → authorized payment → upload → retrievable file → reconciled receipt. Retrieve the file and verify its bytes against the original hash.

Preserve the 100 ANT storage ceiling; budget ETH gas separately. A ceiling is not authorization. Execute a real purchase only within an existing valid, bounded authorization. No private-key export, terminal payment workaround, or manual receipt transfer. No firmware or physical SAFE 7/device operations: those belong to a separate owner.

Test cancellation, expired quotes, incorrect payment bindings, and retries without duplicate charges. Record exact deployment SHA, exact CI results, and live acceptance evidence. Keep fixture/devnet receipts distinct from real purchases. Do all unblocked implementation work without routine permission requests. If no valid bounded authorization is available, finish the reviewable implementation and identify the precise missing authorization rather than spending or inventing approval.

## Starting point verified on 2026-10-10

- Fetched `origin/main`: `ece07cbc3241d224868226c58f58e0499c457345`.
- New dedicated worktree: `C:/Users/travi/wt-codex-ant-storage-agent20`.
- Branch: `codex/ant-storage-agent20-2026-10-10`, based on that main SHA. Re-fetch and incorporate any newer main changes safely before implementation.
- Current main still imports and instantiates `UnwiredGateway` in `ops/ant-writedoor/src/main.rs`; its rejecting implementation remains in `ops/ant-writedoor/src/lib.rs`.
- Public https://skaists.dev/surfaces/wallet.html still states that Autonomi offers a price but payment is not available in the wallet.
- PR #324 is MERGED (2026-10-03), branch `lane/ant-extsig-dual-ceiling`. Reuse the now-merged `ops/ant-extsig` work; its devnet proof is not hosted/mainnet acceptance. The PR's historical 2.5 ANT wording is stale relative to the user's current 100 ANT order.
- Main tests run `38090308445` was still running when checked. Pages `38090308721`, secret scan `38090308432`, and the listed RB/PQ/WASM/SAW workflows had succeeded on the baseline SHA. Refresh before reporting final CI.
- No payment authorization was validated, no funds spent, no file purchased, no keys exported, and no device action taken during this handoff.

## Ownership check and coordination

Visible Codex chats and open PRs were checked. No active hosted-purchasing owner was identified in the visible chat inventory; that is not proof that no owner exists elsewhere.

- Active adjacent chat **Assess bView Shu Benchmark 003**, id `01a1242f-2fc4-7730-8a67-489249fc9ad8`, is implementing video playback/scaling. Its inspected current work concerned `surfaces/bview.html`, video tooling, and tests. A user-authorized coordination message was sent asking whether it owns shared ANT gateway/deployment or ant-writedoor changes. Read its reply before overlapping shared backend edits; do not interrupt or duplicate its playback work.
- Existing worktree `C:/Users/travi/wt-ant-ceiling` and merged PR #324 record external-signing/ceiling work. Do not modify another seat's worktree.
- Open historical PR #211 (`bopus5/myspace-w`, “MY SPACE slice W: the door's wire, one payer, two taps”) and #44 (`cursor/ant-door-relay-gold-a3b2`) are relevant wiring references, not evidence of active ownership or accepted production purchasing. Inspect before duplicating their adapter contracts.
- `docs/dispatches/2026-10-06-fs-8gen-order16-reconciliation.md` records a separate genealogy preservation owner, 100 ANT cap, and still-open atomic payment ceilings. Do not assume that artifact-specific standing approval authorizes a new wallet test artifact.
- Check current David Irvine backend requests per AGENTS.md, including x0x #622 and #505, before opening a new implementation lane.

## Reuse and boundaries

Read current implementations and applicable nested AGENTS.md before editing:

- `surfaces/wallet.html`: deployed wallet and storage chooser; retain naming, account tracking, all three registers, and mobile behavior.
- `surfaces/bpay-invoice.js`, `surfaces/adapter-seam.js`, and existing ANT / MY SPACE adapter/worker modules: reuse quote, invoice, authorization and receipt boundaries.
- `ops/ant-writedoor`, `ops/ant-extsig`, existing bPay/payment-plan and reconciliation code: inventory exact contracts before selecting a backend implementation.
- `docs/dispatches/2026-10-02-ant-extsig-dual-ceiling-upgrade.md` and `2026-10-02-three-collisions-to-full-function.md`: historical external-signing, aggregate gas reservation and failure/retry constraints. The new user order forbids terminal payment workarounds even where an older artifact-specific lane used one.
- `docs/dispatches/2026-10-03-heart-wallet-unification.md`: prior wallet work and its limits. PR #334 shipped wallet UI/public-read improvements, not ANT purchasing.
- Canonical artifact/authorization gates must be read fresh. Validate payer, network, amount, recipient/contract, quote/invoice/file binding, expiry, gas exposure, and replay state before signing. Reserve aggregate worst-case gas across approvals, payment batches, retries and uncertain outcomes. Do not treat a failed request as proof that no charge occurred.

No local servers or local-file previews for the user. Build and verify the hosted path through GitHub/Autonomi/Arweave/Vaulta/Hive. Tests may use the existing serverless production-origin fixtures. Never disguise fixtures, quotes, prepared invoices, or transaction submission as a reconciled purchase.

## Acceptance and closeout

Keep a durable ledger of quote/invoice/payment/upload/retrieval/reconciliation states and immutable evidence. Test refusal before signing for expired, cancelled, tampered or mismatched requests. Exercise interruption/retry and unknown-outcome recovery without duplicate payment. The live receipt must bind the original hash to authorized payment and verified retrieval.

Follow the estate's own-worktree, explicit-path staging, hook, registration, secrets, deployment and dispatch laws. Do not stage in the shared checkout. Finish with exact source/deployed SHA, CI outcome, live receipt and hash verification, and any remaining gate stated plainly. Archive of the originating wallet chat is not a completion signal.

Originating chat: **Add multi-account wallet support**, `01a100ac-99d5-73d3-92de-6195a9d8cecf`.
