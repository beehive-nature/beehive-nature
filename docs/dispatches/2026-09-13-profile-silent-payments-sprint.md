# Profile Silent Payments blueprint sprint

Founder-authorized zCode delegation: three fresh GLM 5.3 seats, Medium effort, separate worktrees. This is a reviewable blueprint and optional UI slice, not protocol adoption.

## z2.a — protocol research

Read BIP-352, BIP-375, BIP-376, the official index-server specification, and macgyver13's pinned silent-pay, spdk, bip375-examples and silent-payments-hub work. Return a cited mapping of receive/send, scan/spend keys, local versus delegated scanning, PSBT/DLEQ/MuSig2 boundaries, privacy leaks, wallet support, failure and recovery. Compare with BNR ERC20i/FUNGi/FROGGi/PEPi without conflating rails. No code or endpoint claims.

## z2.b — profile UX implementation

Starting from current profile.html and the shared three-view shell, draft a progressive-disclosure capability card: New bee calm artist support; Raver empathic gift/support expression; Cypherpunk receipts and protocol detail. Same facts and state across views. External links open new tabs. No keys, seeds, signing, transaction construction or live address validation. Empty/unconfigured state only; never invent an address. Open a draft PR with tests and estate checks; do not merge or deploy.

## z2.c — privacy and security review

Review z2.a and z2.b exact heads. Threat-model profile metadata, address reuse, browser storage, indexer leakage, phishing and external navigation. Verify no secrets or payment data enter localStorage, URLs, analytics or logs; check mobile, reduced motion, language and view-state retention. Return concrete findings and an acceptance bar. No implementation or production probes.

Research can block UI claims; security can block merge. Profile may say “Private Bitcoin support — coming soon” or show an unconfigured capability, never imply BNR receives Silent Payments today. ERC20i and Silent Payments remain separate rails.
