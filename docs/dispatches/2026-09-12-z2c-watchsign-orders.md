# z2.c — offline Trezor Connect adapter and signed-result verification

Founder-authorized continuation of the SKAISTS companion Trezor integration. Start a fresh zCode session at GLM 5.3 MAX. This is an implementation order, not permission to operate a device or spend funds.

## Base and ownership

Create your own `C:\Users\travi\wt-z2c-watchsign` worktree and `codex/z2c-watchsign` branch directly from accepted `76b23661513dd6d33b81f465a3bd958499271864`. Fetch first and verify the base. The z2.b branch is not claimed merged into main. Read AGENTS.md. Do not change the builder, reviewer, shared checkout, Watch-It fork, live surfaces, ops, or admission-gate worktrees.

Read:
- `C:\Users\travi\wt-zcode-watch-jams-plur\docs\dispatches\2026-09-12-z2b-r2-review.md`
- `C:\Users\travi\wt-zcode-watch-jams-plur\docs\dispatches\2026-09-12-z2b-offline-contract-orders.md`
- `C:\Users\travi\wt-z2a-trezor-audit\docs\dispatches\2026-09-12-z2a-watch-autonomi-trezor-audit.md`
- accepted `crates/watchpay`, especially tx.rs and ledger.rs.

## Deliverable

Build an offline adapter between the accepted plan validation and Trezor Connect's Ethereum signing interface. Our companion owns this integration; do not insert SKAISTS branding into upstream W@tch. Reuse maintained transaction/cryptography libraries rather than inventing RLP or signature mathematics.

1. Pin and cite the actual Trezor Connect package/source version used for the request and response contract. Inspect its Ethereum signing types and implementation. A signing response may contain signature components rather than a serialized transaction: implement the actual contract, not an invented response. Do not infer Suite MCP limitations from older audit claims. Connect remains the preferred bridge. Dependency downloads are permitted; no live SDK/device calls.
2. Compose immutable, plan-bound signing requests for exactly the supported legacy EIP-155 and EIP-1559 envelopes. Bind operation, plan hash, batch identity where applicable, expected nonce, chain, payer, destination, zero value, calldata, gas and fee ceilings. Use lossless integer encodings. A review summary must derive from the same request and describe approval/payment, token ceiling and worst-case native fee; no hidden recomposition after review. Reject unsupported envelope types. Path selection is explicit and constrained; the recovered signer must still match the approved payer.
3. Treat all bridge results as untrusted. Reconstruct or strictly decode the signed transaction using the pinned library, reject noncanonical/malformed encodings and signatures, verify chain/replay protection, recover the signer, and compute the transaction hash locally. Validate every decoded field against both the exact pending request and the sealed plan. Never trust bridge-supplied sender, hash or status. Specify and test low-s and v/yParity handling according to the chosen library/protocol. Bound all input lengths before expensive parsing.
4. Return a private verified-result type that cannot be constructed by callers from unchecked fields. Feed only that result into the new adapter's signed-result recording boundary. Preserve the existing synthetic z2.b API explicitly as offline-only if compatibility requires it; do not claim the whole crate prevents bypass while an unchecked API remains public.
5. Use the existing persisted batch intent before invoking an injected fake signer; accept and record a result only for that exact pending attempt. Cancellation/refusal, timeout, duplicate callback, stale or mismatched result and process interruption must never automatically retry signing or release uncertain reservations. Recheck freshness at the signing boundary and clearly define late-response handling. Do not expand the per-batch ledger into an approval/payment workflow in this slice: approval encoding/verification may be tested purely, but approval orchestration remains disabled and explicitly out of scope until it has its own persisted fee accounting.
6. The transport is injected and fake in this slice. Include a deterministic harness exercising compose -> fake bridge -> cryptographic verification -> ledger acceptance. No browser page, SDK initialization, network signer or auto-connect path is enabled. Tests may use clearly labelled public synthetic test keys only; never read an existing wallet, seed, keyring or token.

## Required evidence

Preserve all 65 existing tests. Add actual adapter-boundary tests with deterministic signed fixtures for both supported envelopes, independently checked against a maintained Ethereum implementation or its published vectors. Cover changed chain, signer, nonce, destination, value, calldata, gas and fee fields; forged reported hash/sender; malformed and oversized responses; missing signature components; unsupported type; cancellation; duplicate/stale callbacks; and interrupted attempt recovery. Assert refusals cannot enter Signed or free reservations. A fake transport spy must prove invalid requests invoke it zero times. Mutate the field-binding or signature-verification boundary deliberately, show an appropriate test fails, then restore it. Name exactly what each test proves; mocks are not hardware evidence.

Run the repo CI formatting check, the offline workspace-appropriate tests, clippy, and secret scan. Record dependency and lockfile changes with reasons. Keep public hex fixtures and their PUBLIC-CONSTANT markers compliant with repository rules. Do not silently modify existing assertions to accommodate a behavioral regression.

## Return and gates

Commit a dispatch with architecture, source pins, test counts, mutation evidence, API limitations, and the proposed later device preflight. Use founder author, zCode committer and parsed coauthor trailer; push a descendant without force and report hosted checks at the exact SHA. No merge or upstream PR in this slice.

No real device/Suite/Connect interaction, wallet access, real-key signing, RPC, broadcast, uploads, payment, installation or deployment. No public-mesh traffic on the household Wi-Fi. Offline fixture signatures are test data only. Hardware display behavior, live network contract parity, approval orchestration and power-loss durability remain unverified unless separately demonstrated later.
