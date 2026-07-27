# SPEC — BNRoSE Default Onboard
### "$10 of whatever crypto in, a real runway out" — for intermediate+ users, self-custodial end to end

Date: 2026-07-26 · Authority: R3 in `RULINGS-2026-07-26.md`
Reads with: `ONBOARDING-OPTIONS.md`, `hopper-pipeline-design.md`, `VERIFIED-FACTS.md`
Price basis: HIVE ≈ $0.049 spot (volatile — every dollar figure in this spec
recomputes at runtime from live prices; the numbers here are illustrations).

---

## 1. Who this is for, and the one structural rule

**Target user:** already holds crypto, already runs wallets (an EVM wallet, a
Lightning wallet, or both), does not need custody training — needs a *map*.
Beginners route to the lite tier (R1); this onboard assumes competence.

**The rule (R3):** BNR is never in the flow of funds. The user executes every
conversion with their own wallets along routes BNRoSE documents and watches.
BNRoSE is a checklist that can see the chains — it verifies each arrival and
provisions what the treasury owes at the end. It never holds, converts, or
forwards a user's assets. This is what keeps a $10 multi-rail onboard on the
right side of the standing fence ruling, in both directions: no custody of user
funds, and no token sale (§4).

## 2. What $10 buys — the runway composition

Illustrative split, recomputed live at onboard time:

| Slice | ≈ | Becomes | Runway it buys |
|---|---|---|---|
| HIVE, powered up | $5.00 | ~100 HIVE → ~100 HP on *their* account | RC for years of ordinary social ops — at A39-scale costs (~120M RC per power-up-class op), 100 HP of RC regeneration is effectively unlimited posting/custom_json for one person. For calibration: the entire project treasury runs on 383 HP |
| Lightning sats | $2.50 | ~sats in their own LN wallet | Live value-for-value: tipping, the LN↔HIVE route (the founder's route, self-executed), feel for the payment rail |
| ANT dust | $1.50 | ANT in their EVM wallet | A real Autonomi `put` — publish something permanent-ish, hold its DataMap |
| Creation fee (only if needed) | $0.15 | `account_create` via hopper, A41–A43 | The Hive account itself, arriving with its A42 RC floor |
| Slack | ~$0.85 | unallocated | Fees, price movement, user discretion |
| **b grant** | **$0 of their $10** | b from treasury on completion — **a tradable asset, native on Vaulta**, that auto-pays what it can and coordinates payouts across the other adapters used in an operation *(founder, review 2026-07-26)* | The settlement asset of the surface — granted, never sold (§4). Requires the user to have a Vaulta account to receive it — see G7 |

Two properties worth noticing. The composition is *experiential*, not
financial — each slice exists so the user touches a different rail (social/RC,
payments, permanence) within the first hour. And the dominant slice is HIVE
because RC is the asset that makes everything else on the surface free to use
repeatedly; $5 of powered-up HIVE outperforms $5 of anything else as runway.

## 3. The flow

```
0. Connect      — Keychain (if Hive account exists) + EVM wallet + LN wallet.
                  Whatever subset they have determines the route map shown.
1. Account      — Has Hive account → skip.
                  No account → choice: external create (Option 3, free, their keys
                  from birth) or hopper-created (Option 1, fee path, A43 pre-flight).
2. Fund HIVE    — BNRoSE shows the documented route(s) from *their* starting
                  asset to HIVE on *their* account, with live quotes:
                    BTC/LN → v4v.app → HIVE          (founder-proven; B4 gates
                                                      how much can be automated
                                                      vs linked-out)
                    EVM assets → exchange/DEX → HIVE  (route doc, linked out)
                  User executes. BNRoSE watches their account for arrival.
3. Power up     — User signs transfer_to_vesting on their own account
                  (Keychain). BNRoSE verifies via the virtual op, same
                  discipline as the hopper (never infer from broadcast).
4. Touch rails  — Guided first actions: one post/custom_json (RC), one LN
                  micro-payment, one Autonomi put (ANT). Each verified
                  on-chain/on-network by BNRoSE.
5. Provision    — All verifications green → treasury grants b to the user's
                  Vaulta account (G7) + delegates headroom RC if their power-up
                  is still settling. Attribution and receipts anchored
                  (existing anchor pattern).
```

**What BNRoSE must be able to do:** read chains (Hive API, an LN invoice-state
check, Autonomi/EVM reads), render live route quotes, and trigger two
treasury-side operations — the b grant and `delegate_rc` (Posting authority,
A5) — plus hopper `account_create` for step 1's fee path. Note what's absent:
no key custody, no signing on behalf of users, no receiving addresses owned by
BNR anywhere in the flow.

**Failure discipline inherited from the hopper design:** any leg that involves a
third-party conversion (v4v.app especially) gets timeout-and-alert, never
auto-retry, and the user is told *their* funds' state honestly — including
"stuck at V4V, here is the operator contact," since the funds are theirs, not
BNR's.

## 4. The b grant — why granted, not sold

**What b is (founder, review 2026-07-26):** a tradable asset running native on
Vaulta, which auto-pays what it can and coordinates payouts on the other
adapters used in an operation. Two consequences flow directly from
*tradable*: the granted-not-sold line below becomes more load-bearing, not
less — distributing a tradable token is closer to an airdrop than a utility
credit, which raises G5's stakes; and the sybil constraint hardens from a
preference into an inequality — **grant value must stay strictly below the
~$10 walk cost**, because farming a tradable grant pays out in cash.

If the onboard sold b for any slice of the $10, BNRoSE becomes a token seller
and the whole surface inherits that regulatory object. Instead: the $10 becomes
the *user's own* assets on public rails, and b arrives as a completion grant
from the treasury — compensation for having done the full walk, sized for
surface runway, identical for every user at a given epoch.

Design constraints on the grant, to keep it clean:

- **Fixed per epoch, not negotiated** — no price discovery against the user's
  deposit, which is what would make it look like a sale.
- **Granted on verified completion**, not on deposit size. A user who arrives
  with assets already in place (a Hive whale with an LN node) does the same
  walk and gets the same grant. The $10 is the *typical cost of the walk*, not
  the price of the b.
- **Sybil surface acknowledged:** a grant on completion invites farming.
  Mitigations in order of preference: the walk itself costs real money
  (~$10 of irreversible on-chain actions is a meaningful sybil tax), grant
  sized so farming is unprofitable at that tax, epoch-level review of grant
  outflow. The mastery-ledger / reputation crates are the eventual home for
  anything smarter.
- **Legal caveat (standing):** even as a grant, distributing a native token has
  its own legal surface, jurisdiction-dependent. Get a real lawyer's read
  before public launch. This spec is not legal advice.

**Mint path — ADOPTED (from the code seat's G2 read, A44):** `BLedger`'s only
mint is proof-gated — `mint(who, amount, at, proof, verifier)`, `UnprovenMint`
refusal, no grant/airdrop path exists. The grant therefore mints **through the
existing gate**: verified completion of the walk is defined as a
`ResourceProof` class, with BNRoSE's chain-side verifications (power-up virtual
op, LN payment, Autonomi put) as the proof payload. This keeps
"granted-never-sold" and "minted-on-proof" simultaneously true, and preserves
the system invariant that no proof-free mint exists. It also gives the grant an
honest answer to any earned-only principle: the walk *is* the earning — ~$10 of
the user's own irreversible on-chain actions, verified. **Founder decision
still named, not drifted:** whether F-Q1's earned-ceiling principle extends
from the machine quantum to onboarding grants. If yes, the proof-gated path
satisfies it; if no, the proof-gated path is still preferred for uniformity.
The rejected alternative — a new unconditional grant-mint — would be the
system's first proof-free mint and is not proposed.

## 5. Gates and open items

| # | Item | Gates | Owner |
|---|---|---|---|
| G1 | **B4 — v4v.app API** | Whether step 2's BTC/LN route shows live in-flow status or links out to v4v.app. Flow works either way; the difference is polish | bgoose (ask `@brianoflondon`) |
| G2 | **b grant constants** | Read done (`main @ 002c4d1`, A44–A45): mechanics exist and are opinionated; **economic constants exist nowhere in code** — no emission schedule, no epochs, no 420 constant. Sizing is a green-field founder decision, bounded above by the sybil inequality (§4) since maturation limits collateralization, not transfer. Mint path adopted in §4; F-Q1 extension question named there | **founder** |
| G3 | **EVM→HIVE route doc** | Which exchange/DEX routes to document for the EVM-native user. Pure research, no build | any seat |
| ~~G4~~ | ~~Autonomi put cost~~ | **CLOSED** → A46. 100 KiB = 0.10630 ANT + 0.00015 ETH gas, measured live, nothing spent. Surprise: the Arbitrum **gas** leg rivals storage at plausible spots — it's the binding constraint on the $1.50 slice. Demand-priced, so BNRoSE re-quotes at onboard time (same pre-flight discipline as A43). Dollarization pending a price feed | closed |
| G5 | **Legal read on the b grant** | §4 caveat | founder, external counsel |
| G6 | **Keychain-absent users** | Intermediate+ users who are EVM/LN-native but new to Hive need Keychain installed at step 0 — a new-tool ask in the flow. Route doc must cover it | bgoose, UX |
| G7 | **Vaulta account for the b grant** | b is Vaulta-native, so step 5 needs the user to hold a Vaulta account. Decide: user brings their own (EOS-style wallet — a second new-tool ask alongside G6), or BNRoSE provisions one (RAM/resource cost to price). **Corrected (A47):** `chain-eos` is read-only — SHIP codec and stream ingester, no transaction construction, no signing, no account creation. **The Vaulta write path is new work on either branch**, and it precedes any hardware-signing discussion for Vaulta (D-07 recalibrated accordingly) | founder + bgoose |

**Build dependencies already satisfied:** hopper plumbing (D-06) covers step 1's
fee path and the treasury-side ops; Keychain auth is R2 item 1 and serves step 0;
the anchor pattern covers step 5's receipts. The genuinely new build is the
watcher/wizard surface itself — chain-reading, quote-rendering, verification
state machine. That is client-and-read-only code, the safest kind on the board.

## 6. What this spec deliberately does not do

No fiat. The user arrives already holding crypto — fiat→crypto stays outside
the fence entirely, per the original pipeline ruling. No custody. No swaps
executed by BNR. No beginner flow — that's the lite tier (R1), which this spec
does not touch. And no dependence on any firmware outcome: nothing in this
onboard waits on D-07/D-08/D-09.
