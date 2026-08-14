# CONSENT-1 — BNRi Presale Disclose-and-Confirm

**Status:** DRAFT v1.0 — authored fresh by Seat-1 (Fable) 2026-08-14 on founder order. **DRAFT-FOR-COUNSEL — every clause is a drafting proposal for legal review; no buyer sees this text before counsel sign-off.** Governing-law working default: Wyoming law, binding arbitration (per the bLICENSE ruling; counsel flags on arbitration scope ride with it).
**Pattern:** disclose-and-confirm — the buyer affirms EACH numbered disclosure individually before funds move. Referenced by `crates/bsigner` and `bnri-cosmic` code comments as "a later order"; this is that order.

## Part A — Disclosures (each requires an individual affirmative check)

**D-1 · What this is.** BNRi is an inscription art-money token: a fixed-supply (133,701.69, 2 decimals) ERC-20i whose balances render fully on-chain hexagonal-pixel art. You are buying digital art-money to hold, display, use, and play with — a cultural/collectible object. **Nothing here is investment advice, and BNRi is offered for its artistic and utility character, not as a profit vehicle. No one — not the artist, not the DAO, not any agent — promises price appreciation, income, or a market.**

**D-2 · Price is fixed and no oracle exists.** Presale price is fixed at 1 USDC per BNRi unit. There is no price feed, no oracle, and no mechanism to change the presale price. (That surface was deliberately deleted; it cannot be reintroduced.)

**D-3 · Caps and refund.** Hard cap 50,000 USDC total. Per-buyer cap 500 USDC. If the 10,000 USDC soft cap is not reached, the presale auto-refunds every buyer in full — no discretion involved.

**D-4 · Where the money goes.** Presale proceeds go to the artist, with the ruled portion pairing the permanent liquidity position (half XBTC / half BNRi at the $1 reference per the S-8 composition; any unpaired LP earmark routes to the DAO). Exact split figures render here from the S-8 constants at publication — this document may never state numbers that differ from the deployed contract.

**D-5 · The liquidity is locked forever — really forever.** The BNRi/XBTC liquidity position is held by a contract (BNRiV3PermaLock) that has **no owner, no withdraw function, no unlock, no migration path — these capabilities are absent from the code, not switched off.** No one, including the artist and the founder, can ever remove that liquidity. The only thing the contract can do is collect trading fees.

**D-6 · Trading fees route 100% to the artist.** The pool charges a 1% fee on swaps. Anyone can trigger collection; every collected unit of both tokens goes to the artist's address. This is the artist's ongoing income and is hardcoded.

**D-7 · What can never change.** Supply, the art renderer, the fee routing, and the lock are immutable once deployed. **Both halves of immutability apply to you: it protects you from rugs, and it removes anyone's ability to "fix" or reverse anything later — including for your benefit.**

**D-8 · Dynamic art and locking.** Your art changes with your balance (8 levels; per-mint odds follow the Human-Design distribution — odds, not scarcity). You may optionally lock/seal tokens NFT-like (lock fee 0.1 BNRi, routed per the protocol fee split); rerolls are free.

**D-9 · License.** Your rights in the artwork are exactly the bLICENSE tier published for BNRi (artist retains copyright; you receive a non-exclusive display license; attribution survives). The license is machine-readable, immutable at mint, and linked from the token metadata.

**D-10 · Risks, plainly.** Experimental software on a young chain. Contracts are tested and specified but not infallible; the chain, wallets, and bridges carry their own risks; regulation of digital assets is unsettled and varies by jurisdiction; the value of art-money can go to zero. **Do not spend money you cannot afford to lose entirely.**

**D-11 · Who may not participate.** Persons in jurisdictions where participation would be unlawful must not participate; you confirm your participation is lawful where you are. [COUNSEL: eligibility screening scope.]

**D-12 · Disputes.** [DRAFT] Wyoming law; binding arbitration. Counsel flags of record: a choice-of-law clause governs this contract, not copyright (national law governs ownership/infringement), and mandatory arbitration limits court and class access and does not uniformly bind in the EU and some US states. Final text is counsel's.

## Part B — Confirmation
The buyer affirms, per checkbox: "I have read D-1 through D-12, I understand each, and I confirm my purchase on these terms." The signed confirmation (bDiD-bound) is recorded with the purchase. No funds move without it.

## Part C — Change control
This document's published hash is referenced by the presale UI. Any post-publication edit invalidates the hash and halts the presale until re-confirmed. Numbers in D-3/D-4/D-6 must be render-time reads of the deployed constants — never retyped.
