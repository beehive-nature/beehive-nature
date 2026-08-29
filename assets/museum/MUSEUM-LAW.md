# MUSEUM LAW — permanent

Every exhibit = **live chain read** + **archived byte-true fallback**.

- The live read renders the exhibit from the chain at page-open (the contract's own `getSvg`, the registry's own row, the RPC's own answer).
- The archived fallback is the same bytes, committed to the tree under `assets/museum/`, sha256-receipted in the exhibit's MANIFEST.
- When the live read fails (dead RPC, vanished API, faded IPFS pin), the exhibit **degrades to the archive**, never to a broken frame — and **says so honestly**: the nameplate shows "ARCHIVED — live read unavailable" rather than pretending the archive is the chain.
- The archive is updated when a new exhibit is acquired; it is never the primary render, only the floor.

## Nameplate dependency (read-back rule, Safe precedent)

No attribution label ("the King's", "the Founder's") appears on any plinth until the holding address has been verified as the founder's through a founder-confirmed read-back. Anonymously-held or unverified pieces carry an honest "holder: <address>" label — never a guess.

## Current wings

| wing | contents | status |
|---|---|---|
| THE ROYAL COLLECTION | PEPI inscriptions, art from the contracts' own `getSvg` | live from chain |
| THE LUNA SEALS | four .base.eth name NFTs, cardImage.svg + metadata | archived + live |
| THE LOST PURSE | bQueenBee's Lost Purse (address-pinned 0x100f…) | ruled exhibit |
