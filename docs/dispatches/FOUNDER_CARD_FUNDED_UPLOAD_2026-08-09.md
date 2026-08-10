# FOUNDER ONE-PAGER — BNR WALLET CEREMONY
**For:** King Bee (Seat 0) · **Prepared by:** Cowork · **Handed up via:** Seat 1
**Status:** ⛔ **NOT READY — awaiting goose's verified syntax and Code's script + addresses.**
**Your part:** run two commands, click one checkout link, paste one line back.

> **The web app is out of the path.** It gates login on a balance fetch to one
> third-party host and reports that failure as "wrong password." We replace it rather
> than work around it. **Everything below is CLI — your key never leaves your machine.**

---

# 🔴 THE ONE RULE

## **NEVER share, paste, upload, or transmit the keyfile.**
### Not to a seat. Not into chat. Not into a web form. Not "just to check it."

**The file `[KEYFILE NAME — Code]` on your disk IS the wallet.** Whoever holds it holds
the funds. **No step below asks for it, and no seat will ever ask you for it.**

**Back it up before you fund it:** copy it somewhere offline. If it is lost, the $10 is
lost with it — recoverable only from your own backup.

**What the seats receive, all public and all harmless:** your wallet **address**, the
**approval receipt**, transaction **IDs**.

---

# STEP 1 — GENERATE THE WALLET (your machine, offline key)

```
⬜ [COMMAND 1 — awaiting Code, built from goose's verified syntax]
```

**Prints:** your new **address**, a **backup instruction**, and a **Stripe checkout link**.
**Writes:** the keyfile to your disk. **Sends:** nothing.

# STEP 2 — PAY $10

**Open the checkout link Step 1 printed. Pay by card. Cap: $10 — this is the only money
in the whole test.**

> ⬜ `[Confirm the address shown at checkout matches the address Step 1 printed]`

# STEP 3 — CREATE THE CAPPED APPROVALS

```
⬜ [COMMAND 2 — awaiting Code]
```

**Grants the seats' disposable addresses permission to spend — capped and expiring:**

| bound | value |
|---|---|
| Cap | ⬜ `[awaiting goose — native cap flag]` |
| Expiry | ⬜ `[awaiting goose — native expiry flag]` |
| Addresses | ⬜ `[awaiting Code — zero-value, disposable]` |

# STEP 4 — PASTE ONE LINE BACK

**Command 2 prints a receipt. Paste it to Seat 1. Done** — the seats run the upload, your
approval pays, and the keyfile never moves.

---

> ### 🛑 STOP IF
> - anything asks you to **upload, paste, or type the keyfile or a seed phrase**
> - the checkout amount is **not $10**
> - the address at checkout ≠ the address Step 1 printed
>
> **Nothing here is time-sensitive. Stopping costs nothing.**

---
---

# ⚙️ NOT PART OF THE ONE-PAGER

## Fill status

**The ⬜s are commands I would have had to invent.** A wrong command in a wallet ceremony
either fails loudly or **writes a keyfile the founder thinks is backed up and isn't** —
and inventing CLI syntax from memory is LAW **8u**, plus duplicating goose's named source
read (**8o**). Structure, safety framing, ordering and the paste-back are **final**.

- **goose owes:** fiat-checkout flow to an address (no wallet login) · create-approval /
  share-credits syntax with **cap + expiry flags** · confirmation a **native-JWK** account
  can create approvals (and, for the record, whether Solana-owned can — the dead-end
  check) · wallet-generation command that **keeps the JWK local**.
- **Code owes:** both commands as a runnable script, plus the disposable addresses and the
  count. **The script must run for the founder alone — no seat touches the keyfile.**

## Two things I am flagging rather than assuming

**1. `n = 1` cannot prove per-claimant funding.** At a single claimant address,
per-claimant and leader-funded are **indistinguishable** — which is the whole invariant
under test (`epoch_funding`, 8s/8t). The count needs its why either way.

**2. If cap and expiry are not native flags, this one-pager does not ship as written.**
An uncapped approval against a live card-funded balance is an open tap. **Seat 1 rules
before it reaches the founder**, not after.

## Delivery — one half is not mine to do

Dispatch says land in the **mailbox + the BNR public drive**. **Mailbox: done** (this
file, in-tree). **Public drive: I have no upload path** — no funded key, and creating one
is precisely what this ceremony exists to do. **Chicken-and-egg, stated rather than
quietly half-delivered:** the drive copy lands after the ceremony funds the wallet, or a
seat with an existing funded path does it. **Not silently skipped.**

## Boarding fact — logged

`docs/ledger/pirate-haul-rulings-2026q3.md`, with one precision the dispatch's wording
overstates: the **design defect** (single third-party host on the login path; two causes
collapsed into one message) is established from the app's own config and error text and
stands. The **founder's specific incident is UNDETERMINED** — a seed reimport clears a
corrupted keystore *and* would coincide with a transient fault passing, and both hosts
tested reachable minutes later. **The replacement ruling does not depend on which it was**,
so the ledger records the defect as fact and the incident as unresolved.
