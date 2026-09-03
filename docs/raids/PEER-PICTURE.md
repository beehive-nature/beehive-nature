# A VENMO USER AT THE SALON — THE PICTURE (one screen)

## What happens, step by step

1. **The customer scans the salon's QR.** It already carries who gets paid (the salon's own wallet) and the hive's small share. Nothing to type.
2. **The customer's phone reserves the money.** A pool of dollars-on-chain that other people keep on deposit is set aside for this sale, with the salon's wallet named as the receiver.
3. **The customer pays with Venmo — to the person who keeps that pool**, not to the salon. Ordinary Venmo, the app they already have.
4. **The customer proves they paid.** A small browser helper shows the receipt to a checker; the checker signs off.
5. **Dollars-on-chain land in the salon's own wallet.** The hive's share lands in the hive's wallet in the same moment. The salon signed nothing, keeps no card terminal, has no account with anyone.

The salon's whole job is to print the QR. Money arrives as a wallet notification.

## Straight talk on the two moving parts we do not own yet

- **The pool.** Today the dollars-on-chain come from a stranger who keeps a deposit and takes Venmo for it. The salon cannot be its own pool — if it were, it would be receiving Venmo, not coins. Somebody in the hive keeps the pool, or we use theirs.
- **The checker.** Today one company's key signs off every payment. Their contracts are open and stay put; their checker is theirs. If it stops, sales already reserved can still be released by hand by the pool-keeper; new ones wait. Bringing the checker home is the second mile.

## Comes home / stays behind

| **COMES HOME** (runs on the hive, first mile) | seat | **STAYS BEHIND** (theirs, for now) |
|---|---|---|
| The pay-out engine on Base: reserve → pay → release, with the split built in | z3.3 | Their payment checker and the one key that signs every receipt |
| The hive's share taken inside the same payment, no second transaction | z3.3 | Their quote desk, price feeds and history index |
| The by-hand release door for the pool-keeper when the machine can't | z3.3 | Their dashboards, checkout pages and API keys |
| Payer posts a small deposit for risky payment apps; slow payers buy extra time from the pool-keeper | z3.3 | Their browser helper's home server (the helper itself is open code) |
| The shape of the checker — a signed receipt checked against a list of trusted signers, used once — rebuilt with the hive's own signers | z3.3 (pattern) | Their agent plugins that need their keys to run |
| A QR that already names the receiver and the split; the customer only confirms | z3.2 | — |
| A shelf view read straight from chain — pools, rates, what is reserved | z3.2 | — |
| Their own words on what the software is and is not (quoted, for counsel) | docs/ | — |

Everything on the left keeps working the day their servers stop, except starting **new** sales — that needs a checker, which is the second mile.
