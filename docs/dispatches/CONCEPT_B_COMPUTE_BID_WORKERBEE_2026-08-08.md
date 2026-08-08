# CONCEPT FILED — b COMPUTE BID · bAiGent "WORKERBEE" VOUCHER · FREELANCE ESCROW (2026-08-08)
**Authority:** Seat 0 (King Bee). **Filed by:** Cowork (document seat), courier fallback.
**Status:** **CONCEPT — FILED, NOT SPECCED.** No seat designs this until it is opened.
**To:** all seats · **Scope fence: do NOT design. This file records the idea and its open
questions so neither is lost.**

## THE CONCEPT
A **b compute bid**, a **bAiGent "workerbee" voucher**, and **escrow for larger freelance
engagements.**

**Founder's worked example:** an external blockchain operator **rents the surgical code
team** in a Buzz community to build/wire their adapter / plugin / dApp — paid in **b** (for
resources consumed) plus a **Tether-Gold escrow** (for the engagement's value).

## WHY IT IS FILED RATHER THAN QUEUED FOR DESIGN
**It needs no new primitive.** It composes three rulings exactly as they already stand:

| Existing ruling | What it supplies |
|---|---|
| **b spend boundary** (`RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW`) | b pays for **physical resources consumed** — the compute half |
| **Dual-currency** | b for compute, a **stable/money asset** for service value — the engagement half (Tether-Gold is an instance) |
| **Tiered multi-asset escrow** | The escrow vehicle, already required to be multi-asset/multi-rail so dispute agents can traverse any path |

That is a strong signal about the architecture: a substantial new business surface falls
out of three rulings **without inventing anything.** Worth noting as evidence the
primitives are the right ones — and worth resisting the pull to design it early because it
looks easy.

## SPEC QUESTIONS TO SURFACE WHEN OPENED — do NOT answer them now

1. **What does a "bid" bind?** Price, capacity, deadline — or some subset? A bid binding
   price only is a quote; binding capacity is a reservation; binding a deadline is a
   commitment. These are different objects with different failure modes.
2. **Is a workerbee voucher `bTiMe`, or a sibling primitive?** If it *is* bTiMe, the
   compute-voucher machinery already exists. If it is a sibling, the difference must be
   named precisely — otherwise two near-identical primitives drift apart.
3. **Escrow tier thresholds** — what value or risk band moves an engagement from
   simple to tiered escrow?
4. **Who is the dispute agent when the escrowed work is BNR's OWN team?** *(The sharpest
   question in the set.)* The multi-asset escrow ruling assumes a dispute agent that can
   traverse every rail — but it does not contemplate BNR being **counterparty and
   adjudicator simultaneously.** That is a structural conflict of interest, not a
   mechanism gap, and no amount of rail access resolves it.
5. **How does a rented seat's output carry attribution under the COMMIT RULING when the
   client owns the deliverable?** The commit ruling governs seat attribution
   (`Co-authored-by`, machine seats never certify). A client-owned deliverable may require
   attribution the client does not want, or omit attribution the ruling requires. Interacts
   with the aspirational `.social`/bDiD credit direction.

## RELATED, ALREADY RULED — do not re-litigate when this opens
- b is spent **only** where physical resources are consumed; access stays free at point of use.
- Amounts denominate as **resource quantities, never fiat-pegged**.
- A-first for MVP; b when its tokenomics are final.
- Spend receipts (`SPEC-SPEND-RECEIPT-1`) already cover the accounting shape for the b half,
  including the **visibility** field a client engagement would need.

**Scope fence: this file records a concept and its questions. Nothing here is a design
input until the founder opens it. Execute the prompt as written.**
