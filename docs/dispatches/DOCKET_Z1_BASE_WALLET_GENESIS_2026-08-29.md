# DOCKET — z1's OWN BASE SMART WALLET · GENESIS ALLOWANCE CEREMONY
**Source:** founder-relayed walkthrough, 2026-08-29 (verbatim below). **Recipe match:** the genesis-allowance rider ratified @a0d54c9 — "$1 USDC / 24h Coinbase spend-permission per agent wallet at creation (spender = the agent's OWN wallet; createSpendPermission, revocable; the maxim is OUR configuration)" — same ceremony as bClaude/bfuzz.
**COOP pre-check (the founder's docs interjection, same evening):** our live Pages host sends **no Cross-Origin-Opener-Policy header at all** (verified by `curl -sI` on skaists.dev/surfaces/wallet.html, 2026-08-29 — empty grep for `cross-origin`), so cross-origin popup auth keeps `window.opener` and the Base Account popup flow is unbroken on our surfaces. Base's own troubleshooting names COOP as the cause of "popup opens and displays an error or infinite spinner" (docs.base.org/base-account/more/troubleshooting/usage-details/popups — page is a JS shell to fetchers; the directive guidance is `same-origin-allow-popups`-or-unset per the platform semantics of COOP; exact docs wording UNVERIFIED through the shell). **Standing rule for the estate: never add `COOP: same-origin` to any surface that opens Base/Coinbase popups.**

## THE WALKTHROUGH (verbatim, as handed to this seat)
1. **Create the wallet.** Go to `wallet.coinbase.com` (or the Base App on mobile) and start a new account. Choose passkey-based sign-in — no seed phrase to manage, no browser extension required. Add an email for account recovery/lookup if prompted.
2. **The address exists before it's "real" on-chain.** Base Account addresses are counterfactual — yours is valid and can receive funds immediately, but the account contract doesn't actually deploy on-chain until its first transaction. Don't worry if some UI panels (like recovery-phrase setup) look empty or greyed out before that first transaction — that's expected, not broken.
3. **Get a small amount of ETH into it, on Base (not Ethereum mainnet).** Even basic account actions — deploying the contract, adding a recovery phrase, setting a primary name — are transactions that need gas. Wrong-chain sends can get stuck, so double check the network is **Base** before funding.
4. **Optional: set a recovery phrase.** Once funded, the wallet can generate a recovery phrase as a backup signer — useful in case the passkey device is lost. This itself is a transaction (uses a bit of that gas).
5. **Optional: claim a free Basename.** If eligible (Coinbase Verification, Coinbase One, or a few other credential paths — one per address, best plan checked at `base.org/names`), a 5+ letter `.base.eth` name is free for a year. Good for a human-readable identity instead of `0x...`.
6. **For an agent-operational wallet specifically:** per the estate's ratified genesis-allowance recipe, don't hand the wallet a blank check. Set up a **Spend Permission** scoping what the agent's own operational key can move — allowance capped (e.g. $1 USDC/24h), `spender` set to the agent's own wallet, revocable anytime by the permission hash. That's enforced on-chain by Base's Spend Permission Manager, not by anyone's promise.

**Authority line (the relayer's own):** the click-through and signing are zCode's own hands — instructions handed over, never someone else operating the wallet.

## EXECUTION STATE (this seat fills as it goes)
- [ ] Account created at wallet.coinbase.com (passkey ceremony — Windows Hello gesture is the founder's screen)
- [ ] Address recorded (counterfactual until first tx — expected)
- [ ] Funded with small ETH **on Base** (founder's hands send)
- [ ] Recovery phrase set (optional, post-funding)
- [ ] Basename claimed if eligible (optional)
- [ ] **Genesis Spend Permission: $1 USDC / 24h, spender = z1's own op key, revocable — THE allowance ceremony**
- [ ] Address + permission hash recorded in this docket (public parts) and the roster lane

**Fence check:** this is identity/wallet/allowance provisioning — explicitly allowed by the coherence fence. The paid till stays dormant until the founder flips the prototype live.
