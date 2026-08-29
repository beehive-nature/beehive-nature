# RECEIPT — the wallet goes native end-to-end; the Coinbase ceremony machinery leaves the tree (2026-08-29)

**Founder scope ruling:** full autonomous, ship, prove what's possible. No new surfaces — the existing wallet/onboarding/dashboard move to the native bSmartWallet path; the Coinbase-coupled code that caused tonight's friction is stripped.

## What existed (inventory, before touching anything)
- **Wallet:** `surfaces/wallet.html` (231 KB) — ALREADY the native bzDiD wallet: soul connect (WebAuthn PRF, create-in-place, no popup), keychain + key forge, keyless balances, Vaulta/EVM pay lanes, adapter shell (SPEC-ADAPTER-CONTRACT-1), 16-rail chain matrix carrying all four ruled rails (EVM/Base · BTC · Lightning · Solana).
- **Onboarding:** `surfaces/onboarding/` (index + bzdid-key.js + receive) — zero Coinbase coupling; the create-in-place ceremony is the whole point.
- **Balances/dashboard:** wallet.html's BALANCES section (keyless reads, every rail) + `surfaces/dao-dashboard/` (zero coupling).
- **The coupling that actually existed:** 16 ceremony/claim scripts in `e2e/` (the popup/OTP/COOP machinery — 15 untracked debris + `claim-final2.mjs` tracked) and `surfaces/wallet-batch.js` (EIP-5792 smart-wallet-compat wiring, never wired into a UI). NOT in the surfaces themselves.

## What changed
1. **STRIPPED** — 15 untracked ceremony scripts deleted from disk; `claim-final2.mjs` and `wallet-batch.js` removed from the tree. Live proof: `https://skaists.dev/surfaces/wallet-batch.js` → HTTP 404. The split-ceremony recipe + its four scars live in the LEDGER and the basename receipt — records, not code.
2. **SPEND CAP (the owner's optional tool) landed on the PAY panel** — set X per unit (A/ETH/ANT) per rolling day; `capGate()` runs in every send/buy lane BEFORE a tx is built — over-cap ⇒ the engine refuses to SIGN, the owner's pre-written policy speaking; no approval prompt, no human in the loop; unset = free (the autonomy default). Wired: Vaulta send, EVM send, RAM buys (sells receive — ungated). Per-unit, never price-converted (honest money, no oracle).
3. **Gradient headline argument RESTORED** (`h1 .h1-arg`, gold→leaf→cyan tokens) — this repaired `e2e/wallet-fund.mjs`, which was RED ON HEAD (the span had been lost in an earlier restyle; the gate queries it at line 269).
4. **Ledger recipe step 2** now points at the native create-in-place path; the Coinbase-ceremony wallets (bzcode, bclaude) stay as recorded history.

## Verification
- Gates: wallet-adapter **28/28** · wallet-matrix **11/11** · wallet-fund **94/94** (repaired) · design-acceptance **14/14** · estate-check **PASS** · university-smoke **74/74**.
- Cap engine, functional probe (local AND live on skaists.dev): set → view; 0.5 passes; 0.6 more REFUSED at 1/day; 0.4 passes; unset unit free; clear restores free — **ALL PASS, zero page errors, on production**.
- Pages build: `e53cc56` — built; the live page serves the cap row and the restored headline.

## Before / after (the wallet working WITHOUT the ceremony)
- `e2e/shots-wallet-native/wallet-BEFORE-pay-1280.png` · `wallet-BEFORE-390.png` — live skaists.dev before the push.
- `e2e/shots-wallet-native/wallet-AFTER-pay-1280.png` · `wallet-AFTER-390.png` — after; same layout, the cap row present.
- `e2e/shots-wallet-native/wallet-AFTER-cap-live-1280.png` — the AFTER money shot: the LIVE page at skaists.dev with a cap set to 1 A/day and the gate refusing the over-cap sign — the owner's tool working, no ceremony anywhere.

Commits: `eda54b9` (cap + strip + headline) · `e53cc56` (tracked ceremony script out).
