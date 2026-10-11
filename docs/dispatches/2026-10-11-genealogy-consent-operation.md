# Genealogy: restore the missing consent operation

The founder confirmed that the missing cypherpunk operation was consent
review/signing. The existing button only opened the banked payment status.

The cypherpunk front now has a separate consent review: exact manifest hash,
tar hash, byte count, file count, public destination and permanence terms.
It hands off to the existing wallet keychain. The wallet requires key review,
an unchecked acknowledgment and a separate signing press. A changed key or
changed edition refuses signing. No extension or new key store is introduced.

`tools/genealogy/consent.mjs::signConsent` uses the existing wallet
`BZDIDKEY.deriveRecordKey(MPRK, 'bnr.b')` callback. The derived seed is cleared
after use. `verifyConsent` independently verifies the domain-separated
document using WebCrypto Ed25519 and checks every bound field against the
displayed edition. This is classical signing, not a PQ claim; the wallet's
Cryptol/SAW lanes and their scope are unchanged. Existing page-realm key
custody limitations remain; this change makes no new isolation claim.

The receipt stays in browser storage and can be downloaded. It proves the
displayed key signed those terms; it does not establish record ownership or
consent from relatives. Canonical published approval, payment, upload and
retrieval states are never changed by the UI. No wallet action or real
signature was performed by the agent. Pkg15 and its quotes remain immutable
snapshot evidence; this new signing UI is not retroactively part of pkg15.
The runtime allowlist includes the consent module for subsequent editions.

Validation: 23/23 focused consent and preservation tests pass. Tests use the
existing bzDiD signer with a disposable fixture key, then WebCrypto verifies;
tampered terms, origin, destination, key, signature, manifest, tar, sizes and
extra authorization fields are refused. The browser regression covers the
review, wallet handoff and disconnected-key refusal and runs in hosted CI.
No localhost server was started. `git diff --check` passes.

Upstream: x0x #622 remains closed (last update 2026-09-30); no backend or
transport change is made here. Main was fetched before work. The current
wallet signer convergence dispatch and open #400 were read; this change
does not use its ANT spending API or the genealogy spending ceiling.

A wallet-lane coordination message requests a pause on receipt-only main
pushes and Pages reruns during its live acceptance. This lane keeps its
evidence with the feature branch and does not cancel or rerun that deployment.
Hosted consent acceptance is recorded in the PR once its deployment lands.

Candidate browser acceptance: rendered PR commit `2f3a6527f` with same-origin
development interception in a temporary skaists.dev tab, retaining the
wallet's CSP. Exact-edition review and wallet mounting passed; pressing
review with no connected key leaves both acknowledgment and signing disabled.
The existing wallet auto-connect handler now excludes this panel, so review
cannot trigger an unrelated passkey prompt. This last guard was included in
the preview and is asserted by the hosted regression. Interception was cleared
and the temporary tab closed. The original live genealogy tab stays open.
This candidate preview is not a Pages deployment receipt.
