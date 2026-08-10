# FOUNDER CARD — FUNDED UPLOAD TEST
**For:** King Bee (Seat 0) · **Prepared by:** Cowork · **Handed up via:** Seat 1
**Status:** ⛔ **NOT READY TO HAND UP — two inputs outstanding.** See *Fill status* below.
**Your time:** two clicks and a paste. Everything else is already done.

---

# 🔴 BEFORE ANYTHING — THE ONE RULE

## **NEVER share your seed phrase, private key, or wallet JWK file.**
### Not with a seat. Not in chat. Not in a form. Not "just to check something."

**Nothing in this entire flow needs them.** The seats need three things only, and all
three are public: **wallet address**, **approval ID**, **transaction receipt**.

> ### 🛑 STOP IMMEDIATELY IF
> - any page asks for a **seat phrase / recovery phrase / private key / JWK upload**
> - the URL is **not** the one printed in Step 1 of this card
> - the amount shown is **not** what you typed
>
> **Stopping costs nothing. There is no step in this flow that is time-sensitive.**

---

# STEP 1 — TOP UP

> ⬜ **`[TOP-UP URL — awaiting goose's source read]`**
> ⬜ **`[EXACT BUTTON LABEL — awaiting goose]`**
> ⬜ **Amount to enter: `[MINIMUM — awaiting goose; card and AR minimums differ]`**

**Pay with card. This is the only money in the whole test.**

---

# STEP 2 — CREATE THE DELEGATED-PAYMENT APPROVAL

> ⬜ **`[EXACT CONSOLE FLOW — awaiting goose's source read]`**

**Approve these addresses — already generated, zero-value, disposable:**

> ⬜ `[CLAIMANT ADDRESS 1 — awaiting Code]`
> ⬜ `[CLAIMANT ADDRESS 2 — awaiting Code]`
> ⬜ `[… count set by Code's recommendation]`

**Pre-filled bounds — type these exactly:**

| field | value |
|---|---|
| **Cap / spending limit** | ⬜ `[awaiting goose — does the approval support a native cap?]` |
| **Expiry** | ⬜ `[awaiting goose — native expiry supported?]` |

**Why bounded:** an approval without a cap is an open tap on your balance. If the
mechanism turns out **not** to support caps natively, **that changes the plan and Seat 1
decides before you touch it** — it will not silently reach you as an uncapped approval.

---

# STEP 3 — PASTE ONE THING BACK

**Copy the approval confirmation and paste it to Seat 1. That is the whole handoff.**

> ⬜ **`[EXACT FIELD NAME — awaiting goose: approval ID? txid? just the approver address?]`**

**Then you are done.** The seats run the upload; the delegate (your approval) pays;
your key never moves and never leaves your wallet.

---
---

# ⚙️ FILL STATUS — NOT PART OF THE CARD

**This card is deliberately unfinished, and the blanks are the point.**

Every ⬜ is a value I would have had to invent. A card that sends the founder to a
plausible-looking URL to type a payment card number is not a documentation defect, it is
a **real-world harm** — and inventing the flow from memory is exactly LAW **8u**
(*verify the mechanism before claiming "integration, not invention"*) and the failure
this room has caught repeatedly this session. **I did not fill them from memory. I know
roughly how this works; roughly is not a card.**

Not filling them is also **8o**: the source read is goose's named task, and duplicating
it burns a second seat on one problem.

## Blocking input 1 — **goose** (Turbo mechanics, at source)

Return these five, each with its doc citation, and the card fills in minutes:

| # | needed | goes to |
|---|---|---|
| 1 | Top-up URL + exact button label | Step 1 |
| 2 | Card minimum **and** AR minimum (they differ) | Step 1 amount |
| 3 | Exact console flow to create a delegated-payment approval | Step 2 |
| 4 | **Do approvals carry a native cap and expiry?** If no → **the plan changes; do not hand this card up** | Step 2 bounds |
| 5 | What the uploader needs — approval ID, or just the approver's address? And does `x-paid-by` charge the **approver's** balance? | Step 3 paste-back |

**Item 4 is the one that can change the plan**, per the dispatch. If caps or expiry are
not native, an uncapped approval is a standing risk to the founder's balance and **Seat 1
rules before this card reaches him**, not after.

## Blocking input 2 — **Code (Seat 3)**

- The claimant addresses, in paste-ready order (public addresses only — **no JWK, no
  key material in this file, ever**).
- The **count**, with the why: how many delegates genuinely prove **per-claimant**
  funding with real receipts. **One address cannot** — per-claimant funding and
  leader-funding are indistinguishable at n = 1, which is the whole invariant under test
  (`epoch_funding`, 8s/8t).

## What is already done and needs nothing

- Safety framing, stop conditions, step order, and the single paste-back — **written and
  final**; they do not depend on either read.
- **Boundary held throughout:** founder-only = the card payment and the approval.
  Seats = public addresses, receipts, zero-value throwaways. **Keys never cross.**

## Handing up

**Do not hand this to the founder in its current state.** When both inputs land, I fill
the ⬜s, re-verify that Step 1's URL matches goose's citation exactly, and hand it to
Seat 1 the same turn.
