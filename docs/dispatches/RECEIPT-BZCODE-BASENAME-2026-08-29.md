# RECEIPT — bzcode.base.eth claimed + on-chain verified (2026-08-29)

## The claim
- **Name:** bzcode.base.eth — 1 year, 0.001 ETH (founder ruling: "its just 1 year buddy")
- **Wallet:** `0x907F3B95cA3611DD3d9754B874A70CbB28C15738` (Coinbase smart wallet, bzcode@agents.skaists.buzz)
- **Ceremony:** SPLIT — script drove search → claim modal → Coinbase Wallet popup → "Sign in with Base" → email → email-OTP (auto-read from the on-box maildir); **founder typed the Google Authenticator code**; script took the back half (Register name → Confirm). First fully-landed agent basename.

## On-chain verification (keyless, reproducible)
```
contract: 0x03c4738Ee98aE44591e1A4A4F3CaB6641d95DD9a  (Basenames ERC-721, Base L2)
tokenId:  keccak256("bzcode")                              (PUBLIC-CONSTANT)
        = 0x446f30a5164fdb26117361af0d8daa457532b93c092b7a838d9ebcd0b1af9879  (PUBLIC-CONSTANT)
ownerOf → 0x907f3b95ca3611dd3d9754b874a70cbb28c15738   ← matches the wallet
RPC: https://mainnet.base.org (eth_call ownerOf)
```
Note: ownerOf read reverted during the first ~minutes after the claim Confirm — tx propagation, not a failed claim; it read clean minutes later. The old L2 registry (`0xb9470…`) holds no record for the name — the registrar NFT (above) is the ownership truth, as with every archaeology name.

## Artifacts
- Ceremony script (split, no secrets inside): `e2e/claim-final2.mjs`
- TOTP vault (never in repo/chat files): `/etc/buzz-ceremonies/bzcode.totp` (600 root) + `/opt/buzz-ceremonies/totp.py` oracle on the box
- Ledger row updated: `docs/agents/WALLET-LEDGER.md` (row 3 + the split-ceremony law section)

## The four scars (laws for the remaining ceremonies)
1. Ghost processes from earlier iterations fight the live one — kill by pattern `*claim*|*ceremony*`, verify zero, before each launch.
2. OTP mails read without a submit-instant marker can be one session stale — marker at submit; "Resend" is the recovery.
3. Wallet picker: "WalletConnect" matches any "Connect" substring — exclude explicitly, click "Coinbase Wallet".
4. The SDK popup auto-flips to extension-wait — `goBack()` recovers the sign-in path; "Sign in with Base" is the gateway element (text node, not a button).
