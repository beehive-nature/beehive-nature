# RULINGS — THE HARDLINE · FULL-SURFACE METHOD · ADOPTION UX (2026-08-08)
**Authority:** Seat 0 (King Bee). **Filed by:** Cowork (document seat).
**To:** all seats. **Status:** CANON, except §4 which is a seat contribution to an open task.

---

## 1. THE HARDLINE — decides every funding question

> **"Me/BNR funding being a gate for scaling" is the hardline. People pay their own way in
> BNR — "probably much less $ in the outcomes."**

**Any option whose cost curve makes BNR or the founder the bottleneck on how many users can
exist is DISQUALIFIED BY CONSTRUCTION, however elegant.**

This is a **disqualifier, not a preference.** It is applied *before* an option is evaluated
on its merits — an option that fails it is not compared, it is removed.

**Applied immediately:**

| Option | Verdict |
|---|---|
| **(a) sponsored / metered** | **DEAD.** $600M–$1.2B/yr in perpetuity **is** BNR funding as the scaling gate — the definition of the thing the hardline forbids |
| **(c) credit systems** | **SURVIVES ONLY where USERS BUY the credits.** A BNR-funded credit treasury reintroduces the identical gate one layer down |

**Why this is the right shape of rule:** it converts an open-ended economic argument into a
single test any seat can apply without a founder round-trip. *"Does the cost of the
ten-billionth user land on BNR?"* If yes, stop.

## 2. METHOD RULING — stop electing one mechanism

> **"Why do we keep trying to pick one option for things. Build out fastidious but full
> features."**

**Both (b) RENT/LEASE and (d) DEFERRED FUNDING are ADOPTED.**

**General method:** build the **full feature surface, user-selectable**, rather than electing
one mechanism. Same shape as the **visibility ruling** (all three ship, user picks by
intent) and the **dual-currency ruling** (b for compute, stable for service value).

**The hardline disciplines the menu.** Options multiply; **every option must let the user
pay their own way.** These two rulings are complements, not tensions — one expands the
surface, the other bounds what may enter it. A menu without the hardline is how a
BNR-funded option sneaks back in as "just one more choice."

## 3. ADOPTION UX — named pattern (BN EDU / onboarding)

> Potential users must **easily see the kernels of knowledge** needed to choose adopting the
> tech, with **accessible deeper statistics** for those who want them.

**NAMED: "SUMMARY THAT IS TRUE ALONE, DEPTH THAT IS REACHABLE."**

| Tier | Requirement | Failure mode it forbids |
|---|---|---|
| **1 — the kernel** | The minimum **TRUE** things needed to decide, plain and up front. **Must be SUFFICIENT ALONE** | A summary that only makes sense *after* tier 2 is a **teaser, not a kernel** |
| **2 — the depth** | Full statistics / evidence, one level down. **Must be REAL EVIDENCE** | Marketing expansion of tier 1 is **not depth** |

**This is now a house pattern with three instances, and naming it is the point — the same
shape had been re-derived three times:**

1. **Spend-receipt UX** — total first, itemised beneath (`RULING_KISS…`).
2. **Informed consent** — privacy *and* cost consequences shown together at the moment of
   choosing (`SPEC-SPEND-RECEIPT-1` §3a).
3. **BN EDU / adoption** — this ruling.

The unifying discipline: **the top tier must let someone decide correctly without reading
the lower tier, and the lower tier must be evidence rather than elaboration.** Both halves
are required; either alone produces a familiar failure — an opaque summary, or a wall of
data nobody can act on.

## 4. ARCHITECTURAL CORRECTION — Vaulta rows re-derived (SEAT CONTRIBUTION)

**The correction:** Vaulta and b-domain store **most data on AR/ANT, not on Vaulta.** So
Vaulta's `max_ram_size` ceiling binds **only what lives ON Vaulta** — it is **not** a ceiling
on identities.

**Finding: the tree already derived this, and it agrees with the correction.**
Stamped per LAW 8a — source is this repo, `docs/bdomain-scaling.md:160` and
`docs/RECEIPT_R8_VAULTA_RAM.md:34,51-55`, both previously receipted:

> *"1B users does not mean 1B Antelope accounts… The only architecture that reaches a
> billion is one where a `.b` identity is **a keypair, not an account** — the vast majority
> of users never hold an on-chain account, and only those who anchor or pay take a row.
> This is precisely the ENS outcome… split by unit economics, not by count."*

### What must be a Vaulta row per identity?

**Under Layer-0 keypair-first: for most identities, NOTHING.** A Vaulta row is required only
for identities that take an on-chain action. Measured costs already receipted:

| What | Bytes | Ceiling implied |
|---|---|---|
| `.b` registry row only (user already holds an Antelope account) | **2,537 B** | 30,007,452 |
| All-in (new user: registry row **+** Antelope account creation ≈3,450 B) | **5,983 B** | 12,724,536 |
| **Keypair-only identity, no on-chain action** | **0 B** | **not bound by RAM at all** |

**The binding structural constraint is not `max_ram_size` — it is
`registeracc`'s `require_auth(registrant)`** (`bdomain.cpp`, per `RECEIPT_R8_VAULTA_RAM.md`).
That call means a `.b` registrant **must already BE an Antelope account**, which is what
drags the ~3,450 B account cost in behind every registry row. **Ceilings bind
on-chain-registered identities, not identities.**

### The open question this re-derivation exposes — NOT answered here

**Is there a `.b` identity path that takes NO Vaulta row at all?** Today's contract path
cannot provide one: `registeracc` requires an existing Antelope account by construction. So
keypair-first identity implies **either** a registration path that does not call
`registeracc`, **or** `.b` names for keypair-only identities living on AR/ANT with a
resolution path that never touches a Vaulta row.

**Which of those is the design — and whether it exists in code today — needs a source read
with crate + ref. Cowork does not answer it; it is named so the derivation is not mistaken
for complete.** (`registeracc` behaviour above is cited from an existing receipted
document, not from a fresh source read by this seat — flagged rather than implied.)

## 5. Q4 STANDS · NUMBER CORRECTION

- **Q4 stands: the earn→spend loop does NOT close on Autonomi.** Zero-sum; **no ANT minted
  in ~360 days**; **77.87% of node income from two addresses**; network-wide flow
  **~$10.68/day**. This is the finding that matters most for the earn-loop architecture.
- **Q1 / Q2 / Q3 ERRORED and returned nothing — RE-RUN before any Stage-2 text.** An errored
  query is not a negative result; treating it as one would be a law-10 false signal.
- **CARRY `0.0402` ANT/chunk, NOT `0.0117`.** Any figure derived from 0.0117 is stale and
  must be recomputed.

## SHELF — one word each
`LAW 8c` adoption (provenance survives the relay) · `renew` bounding · `owner` succession.
