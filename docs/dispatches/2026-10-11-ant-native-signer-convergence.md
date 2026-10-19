# ANT first-party signer: one implementation, its review, what is still open

Date: 2026-10-11 (America/Denver). From: Claude seat replacing the "BNR settlement adapter architecture" session. For: the hosted ANT storage owner (agent20) and any seat touching `surfaces/ant-pay.js`, `bpay-invoice.js` or the wallet keychain. Governing order: the founder's 2026-10-11 shared order, "build components that can be replaced without replacing the sovereign — and prove that replacement works".

## Convergence

- **One implementation landed:** [#396](https://github.com/beehive-nature/beehive-nature/pull/396), merged as `283babc42`. The hosted purchase is signed by the bzDiD `evm:<soul>` key through the Rust core. It has no extension fallback, and the ETH limit starts blank.
- **The competing Claude provider will not land.** `BNRPAY.ownProvider` signed in the page through noble, and it never got wired in. It is preserved on branch `claude/own-key-ant-storage` at `eb250096a`, with no PR. Its wiring edit to `surfaces/bpay-invoice.js` was refused on 2026-10-10 by the Claude Code auto-mode classifier, reason `[Security Weaken]`. That edit is recorded in the commit message and was not retried from any session.
- **Gas authorization:** that session proposed `0.0002 ETH` for the probe. That was wrong, and it is withdrawn. The figure belongs to a genealogy artifact gate, not to this probe. The ETH limit is whatever the key holder types into the hosted invoice.

## Independent read-only review of #396 (head `54d8e96c4`) against the order

| # | Requirement | Status |
|---|---|---|
| R1 | Independently decode the signed type-2 bytes and compare fields before submission | **Fixed in [#400](https://github.com/beehive-nature/beehive-nature/pull/400).** `checkEnvelope` does a strict RLP decode, compares every field, requires canonical encoding and low-s, recomputes keccak, and recovers the sender with the vendored noble library, not the Rust signer. The signer path refuses to start without that verifier. |
| R2 | Vault bound, not only the token | **Fixed in #400.** PaymentVaultV2 is pinned in `EVM_RAILS.arbitrum.antStorageVault`, the same address as in `e2e/ant-pay-vector.json`. |
| R3 | Aggregate ETH ceiling enforced at the signing tier | **Open.** Only the coordinator checks it (`gasExposure`/`authorized`); the signer sees one invoice. Signer-side reservations without mined-actual reduction would diverge from `ops/ant-extsig/src/budget.rs`. This belongs with R6. |
| R4 | Authorization commits to what it authorizes | **Fixed in #400.** The authorization carries a `scope` digest covering file, contracts, payer, quotes and planned transactions. The coordinator recomputes it with WebCrypto and the signer with noble SHA-256. |
| R5 | Signed but never broadcast | **Partial.** In #400, a refusal before broadcast drops the envelope and returns to `planned`. Still open: when `eth_sendRawTransaction` fails without the network taking the tx, the record stays `sending` with its raw tx. Nothing rebroadcasts it or resolves a dropped nonce. |
| R6 | Key custody isolated from the page | **Open (architecture).** `MPRK` and derived seeds live in the page realm. `BZDIDKEY` is a reassignable global, and the `BNRKEYS` core object is unfrozen. `bnr-keys.js` `sign()` leaves a `cat(seed,digest)` copy that is never zeroed. The #396 commit message says "private derived bytes stay inside the keychain frame". No such frame exists, so that sentence is false, and history is not rewritten. |
| R7 | Cross-device spending boundary | **Open.** The purchase journal, quote claims, Web Lock and daily caps are all in this browser's storage only. The panel says so. |
| R8 | No silent extension fallback; ETH not pre-filled | Holds. |
| R9a | `BNRPAY.antStorageSigner` is a signing oracle any page script can call without a press | **Open.** Same root cause as R6. With the vault pinned, a hostile page script can still get `payForQuotes` signatures to rewards addresses it picks. Each one is capped at 100 ANT. Repeated calls are limited only by the daily ANT cap, if the owner set one; otherwise nothing limits them. The same is already true of the exported `BNRPAY.evmSendRaw`, which sends any transfer to any address with only the cap in the way. So #396 adds no new kind of exposure. |
| R9c | Ordinary EVM send lane can reuse an unbroadcast storage nonce | **Open, low.** It cannot lose funds, but it leaves the storage ledger stuck as uncertain. |

#400 receipts: `node --test e2e/ant-hosted-purchase.test.mjs` 21/21. Removing `checkEnvelope` or the scope recompute turns its test red. `e2e/ant-pay.test.mjs` 9/9. `node e2e/ant-hosted-browser.mjs` 6/6 (bee/raver/cypherpunk at 320/390px) with real Rust-core signatures passing the noble check. `build-stack-surfaces --check` and `estate-check` pass. Hosted CI on #400 is still due. No funds spent, no live signature.

## Still open, in order

1. **Live acceptance.** The key holder opens the hosted wallet, connects the keychain, chooses a public file, types the ETH limit, reviews the invoice and presses Authorize. Then the seat verifies retrieval, the hash and `bpay.ant.reconciled/1`. No chat approval substitutes for that press.
2. **Key isolation (R6, R9a, R3):** a keychain behind a narrow request interface, such as a separate origin or a worker with its own confirmation view. Only that boundary could enforce the aggregate gas ceiling, and only it can tell a press from a script. This is the keychain owner's lane, not a second wallet.
3. **Cross-device operation record and budget (R7):** the order names independently enforced sub-budgets or a coordinated spending authority. A browser counter is not enough.
4. **R5 remainder and R9c.**
