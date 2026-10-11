# Agent 20: wallet sign-in and storage UX in all three styles

The founder rejected the hosted sign-in experience and explicitly confirmed that the requested three interfaces are Bee, Raver and Cypherpunk. This product change takes precedence over asking them to repeat the old identity prompt. The 49-byte probe remains unpaid and has no fresh payable invoice or spending authorization.

## Changed behavior

- Sign-in leads with the existing passkey, a three-step progress indicator, and a prominent identity decision. New-identity creation and phone sign-in live behind a secondary disclosure. The existing identity check, rejection, timeout and key wiping remain in force. A sign-in confirmation never becomes a transaction signature.
- Technical passkey diagnostics are available in a closed disclosure rather than competing with the decision. The identity's public six words have their own readable card. Locking the keychain restores its sign-in action.
- Storage leads with the payable workflow after the reader explicitly selects Public. A price-only request remains available under its own clearly named disclosure. The obsolete claim that this wallet cannot pay has been removed.
- Readiness distinguishes a locked keychain, a missing .b paying name, and a Rust core that is not ready. A return link brings the reader back from sign-in. File and ETH inputs survive same-page navigation and style changes; inputs lock while an invoice is active.
- Each live invoice displays its exact ANT amount and separate aggregate ETH ceiling as two labeled values. It still names the file, byte count, paying account, network, expiry, transaction count and per-part approval boundary. Raw contract bindings remain inspectable. Explicit authorization, cancel, expiry, reconciliation and no-duplicate retry remain separate operations.
- Bee uses a guided paper card, Raver a focused card with step lights, and Cypherpunk a compact checklist and two-column cost ledger. The existing three navigation grammars remain in place. No signing keys, addresses, price or authority depend on the selected style.

Implementation: `surfaces/wallet.html::kcProgress`, `soulAsk`, `wlSay` and `BNRPAY.antStorageState`; `surfaces/bpay-invoice.js::renderChooser`, `purchasePanel` and `bindPurchase`. `ant-pay.js` and the Rust signer were not changed. Rust signs but isolated Rust custody and authority remain UNVERIFIED; this is a presentation and workflow change, not a new custody claim.

## Validation and release state

Source fixtures only: no local listener, real passkey, live funds or public upload was used. Source receipt logs and screenshots stay in this lane's `tools/agent20-ux-*` artifacts; other seats' existing screenshot changes were not staged.

- Guided sign-in fixture: nine combinations (Bee/Raver/Cypherpunk at 320, 390 and 1280 pixels) passed explicit first-identity confirmation, one passkey request, .b readiness, retained 49-byte file and ETH ceiling, style switching and overflow checks. Added to the wallet CI job.
- Native purchase fixture: six combinations passed separate ANT/ETH display, zero sends before authorization, cancellation, bounded simulated sends, retrieved hash verification and retry without duplicate payment.
- Unified wallet: 201 checks passed. Quote chooser: 19/19. Reference invoice: 18/18. ANT wire and policy tests: 27/27.
- First three-style regression run: 127/128, with one diagnostic text leaf below Bee's 14px floor. Corrected to 14px and kept closed diagnostic content hidden; the rerun passed 128/128. Final visual review then moved the long key-derivation explanation into a closed disclosure and removed a duplicate sign-in action. All three final sign-in views were captured; exact final-head CI still gates release.
- JavaScript syntax, unique ids and integration checks pass. `tools/check-wallet.js` retains its pre-existing raw div-tag count failure: baseline 427 opening / 428 closing, candidate 433 / 434. This simplistic count includes script strings; the failure is recorded, not reported as green. Browser DOM/interaction checks pass.
- Estate check, atlas generation, stack directory generation/check, R5 surface audit and diff whitespace check pass. No surface was added or moved; the existing wallet inventory row was regenerated.

This branch is not yet a hosted release. Merge requires the exact final head's workflows and a fresh deployment/actual public-byte receipt. No receipt-only main push will be used to record progress while Pages waits.

## Ownership and continuation

### Exact-head CI correction, 10:58 UTC

The first product head's tests run 38130953386 failed only the wallet job. Its three vault batteries each reported `FAIL primary keychain CTA is passkey connect (not paste)` (83 passed, 1 failed per style). This was this lane's regression: after locking, the status offered `open it again`, which the new duplicate-action observer treated as an error action and used to hide the primary sign-in button. The observer now treats that normal reopen action like the initial connect action, keeping one primary passkey button. Error-specific actions still remain available.

The original Cypherpunk vault battery now passes 84/84 using its local synthetic WebAuthn test server; no real wallet or funds were used. The guided source fixture passes all nine style/width combinations, additionally checking lock, visible primary action, hidden duplicate and reopening via a second synthetic passkey request in each style. The generated surface directory is unchanged by this correction. Fresh exact-head CI is required again; the failed first run is not counted as green.

Current main was fetched and merged into the owned worktree before changes. #400 remains the independent envelope/vault/authorization-hardening lane; coordination is recorded at https://github.com/beehive-nature/beehive-nature/pull/400#issuecomment-6107827204 . bView was notified that this lane owns the three-style wallet UX, while its separate artifact and payment authority remain its own. Its wallet tab was not touched.

After this product release is hosted and verified, continue the original exact 49-byte probe using the existing bzDiD identity. Show a fresh ANT amount and separate aggregate ETH ceiling before any payment authorization. Historical quotes and 0.0002 ETH are not authorization. Retrieve and compare the original hash only after an explicitly authorized purchase; reconcile canonical receipts without duplicate payment. The existing hosted session is preserved during development.
