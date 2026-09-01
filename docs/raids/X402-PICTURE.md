# x402 — THE PICTURE (one screen)

Four small projects were read cover to cover. Each one lets a machine pay another
machine a few cents for a thing — a minute of compute, one answer, one report — with
no account, no card, no login. Everything below is what a **member** can do once the
useful parts are home, versus what they can do today.

## Before → After

| today | after this lands |
|---|---|
| A member's agent can look but cannot buy. Anything paid needs the founder's card or a hand-made deal. | A member's agent **pays as it goes** — a few cents per second of compute, per answer, per page — and stops by itself when the budget is gone. |
| Price is whatever the seller says at the end. | The price is **pinned up front**, single-use, and expires on its own. You never pay for an offer that cannot be served. |
| A meter that runs dry kills the job and loses the work. | A meter that runs dry **pauses**. Top up, it resumes. Nothing is thrown away. |
| "You owe $X" is the seller's word. | Every bill is **recomputed by anyone** from the public record: rate × seconds burned. A stranger can check it; a hidden markup shows as a red cell. |
| A member's wallet can be asked to sign for more than it meant to. | The signer **refuses any offer over its cap before it signs.** The cap lives in the member's hand, not on someone's server. |
| Paying the seller and paying the hive's 10 % are two payments, two chances to skip one. | **One signature pays both.** The split is baked into the single instruction; the ledger itself enforces it. No server, no honour system. |
| A receipt is a screenshot. | A receipt is a **signed object** carrying the hash of what was delivered — provable later, offline. |
| Disputes are a DM. | A dispute **costs a small bond** to file, so it is cheap to be right and expensive to spam. |

## Comes home / stays on Azure

| **COMES HOME** (runs on the hive with no box) | **STAYS ON AZURE** (the class we replace) |
|---|---|
| Pause-not-kill meter · credit only from money that actually settled | Their rented VM, systemd units, and cloud sandboxes (Daytona / Modal) |
| Rate table = cost basis + 10 % tithe field | Their OpenAI / OpenRouter / Gemini keys behind the metered answers |
| `upto` ceiling: sign the max once, pay only the actual | Their custodial "workspace wallets" holding members' funds in a JSON file |
| One-signature pass-through with the tithe split inside it | Their single broker process that is registry, matcher, cashier and database at once |
| Signer refuses over-cap offers before signing; destination allowlist | Their web demo that signs with a key kept on the web server |
| Pinned, single-use, self-expiring quotes; pre-payment guards | Their in-memory "already paid" list that forgets everything on restart |
| Receipt bundle with the delivered-result hash; verifiable offline | — |
| Four verifier states drawn on the comb: nectar = inconclusive · honey = pending anchor · capped = passed · red = failed | — |
| Bonded disputes; honesty score computed from the public record | — |

Everything on the left works the day their hosting stops. Everything on the right is
what stops.
