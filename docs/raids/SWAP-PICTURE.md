# SWAPS & THE SHELF — THE PICTURE (one screen)

Two working things were read cover to cover: a coin-for-coin swap desk that runs with nobody in
the middle, and a marketplace where the shelf, the checkout and the escrow all live on the
members' own machines. Plus one rumour checked: **"Zano just joined that swap desk" — nobody at
Zano or at the swap desk has said so anywhere we can read. Filed as unconfirmed; do not repeat it.**

## What a member can do, with no operator anywhere

| today | after this lands |
|---|---|
| To trade one coin for another, a member hands both to an exchange and hopes. | A member **swaps directly with another member**. Each side's coins are locked so that either both move or neither does. Nobody holds the money in between. |
| A swap that goes wrong means a support ticket. | A swap that goes wrong **unwinds by itself** — the coins come back on a timer, and if the other side walks away with your lock, a small on-chain note gives you the key to recover. |
| Selling something means a storefront on somebody's website. | A member **posts a listing from their own machine**; it travels as a sealed message every member's node passes along. A listing costs a tiny fee that is burned, so spam has a price and no moderator. |
| Buying means trusting the seller, or trusting the platform to referee. | **Both buyer and seller lock a deposit** into the same sealed box. The only one-sided move either can make is to destroy everything — so both are paid to finish honestly. Release needs both signatures. No referee, no platform holding funds. |
| A shipping address goes into a database someone else keeps. | The address rides **inside the sealed offer, readable only by that seller.** No account, no form, no identity check — a member's identity is their key. |
| A "market" is a domain that can be taken down. | A market is **a key**. Hold the key, see the shelf. Nothing to seize. |
| Price tickers decide what the software does. | Price tickers are **decoration only** — the swap and the escrow never read them. Pull the ticker and the trade still completes. |

## Comes home / stays behind

| **COMES HOME** (runs on the hive with no box) | seat | **STAYS BEHIND** (the class we replace) |
|---|---|---|
| Order book as sealed gossip over the members' own transport, expiring on its own | z2.1 | Their message layer welded to one coin's node — every trader must run it |
| Zano as the "no-script" leg of a swap — the same signature the vault already makes | z2.1 | The rumoured Zano listing on the swap desk — not confirmed anywhere first-party |
| Buyer address sealed to the seller's key; identity = a key, no forms | z2.1 | Any hosted checkout that keeps addresses in a database |
| Hash-lock swap template for coins that have script | z3.3 | CoinGecko as the only price source, with a bundled key |
| Self-unwinding failed swaps + the recovery note + a bounded wait that records why it gave up | z3.3 | Public light-wallet servers hard-coded into the install |
| Escrow where both sides lock deposits, mutual-destruction is the only unilateral move, release needs two signatures | z3.3 | Any escrow with a referee or a platform holding funds |
| Listing fee burned at a rate the hive votes; bids and images free with a size cap | z3.3 | A six-year-old marketplace codebase (the design is lifted, the code is left) |
| Deposit ratios as a per-market law field | z3.3 | Download mirrors and name-server seeds owned by the project |
| A market is a key; the atlas shows whatever it can decrypt | z3.2 | Domains as storefronts |
| Trading surface loopback-only by default; any exposure is the member's choice | z3.2 | Fiat tickers from third-party APIs |
| Listing media small and content-addressed; the listing carries hashes | z3.2 | — |

Everything on the left works the day the last project server stops. Everything on the right is
what stops — or, in the rumour's case, what was never there.
