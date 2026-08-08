# RULING — RAIL CLASS (C): ISSUANCE THAT DOES NOT FRONT-LOAD TOKENS (2026-08-08)
**Authority:** Seat 0 (King Bee). **Couriered by:** Cowork (document seat) — the research
seat's Desktop Commander lane timed out for the third time tonight; standing fallback
invoked, dispatches route through Cowork.
**To:** all seats · **Settles:** the rail decision that the pool-depth finding forced.

## THE RULING
**Class (C) — issuance that does not front-load tokens.**
Declined: **(A)** pre-purchase, **(B)** different rail, **(D)** smaller near-term target.

## FOUNDER'S THESIS, ON THE RECORD AS THE REASON
> *"As demand/users scale the DeFi LPs will scale as well. BNR gives these networks the
> demand/liquidity they need to perform their best; decentralization performance should
> increase with massive scale."*

**BNR is a DEMAND SOURCE, not a passive consumer of depth.** The design must therefore not
require depth to exist *before* the demand that creates it. Pre-purchasing depth (A) or
shrinking the target to fit today's depth (D) both invert that relationship; switching rails
(B) abandons the network BNR intends to supply demand to.

## COROLLARY THE SPEC MUST CARRY
*(Research-seat note, recorded as a design constraint — explicitly **not** a dissent.)*

**Depth follows demand WITH LAG, and bootstrap is exactly when depth is thinnest.**
Therefore:
- The design **must degrade gracefully** if depth arrives slower than users do.
- **Never assume depth.**
- **Never let a cycle fail closed on an unfillable swap.**

A design that is correct at scale and brittle at bootstrap fails the standing self-heal
test during the only period it is guaranteed to pass through.

## ⚠ HYPOTHESIS FOR CODE — TO TEST, NOT A FINDING. DO NOT ASSUME.
Under (C): the agent **earns ANT** running Autonomi nodes and **spends ANT** on Autonomi
storage — **same rail, same token, NO SWAP.**

If that holds, the ANT/USDC pool is touched only for **gas/paymaster USDC**, and Code's own
measurement puts cold start at **~$0.019/cycle**, not the **$1/agent-cycle** the ~1,000-agent
figure assumed.

**Naive arithmetic on Code's own numbers, flagged as naive:**
`$1,000 of 5%-budget flow ÷ $0.019 ≈ 52,000 agent-cycles`, not 1,000 — **~50×**.
Still short of 10^10, but **a different problem** than the one the depth finding described.

### Four questions to settle — ASSUME NONE
> **PROVENANCE (corrected 2026-08-08):** these four questions were **authored by Fable**
> and **addressed to Code**. The section heading above ("HYPOTHESIS FOR CODE") means
> *for Code to answer*, **not** *originated by Code* — an ambiguity in my courier framing,
> corrected here. Fable later described them as "Code's"; Code flagged rather than absorbed
> it. The measurements cited (~$0.019/cycle) are Code's; the questions are Fable's.
> **Provenance must survive the relay.**
1. Does an Autonomi node's **earned ANT settle to an address the same identity can spend
   from**, with **no conversion step**?
2. Is USDC needed **per-cycle at all**, or can the paymaster be covered by a **dust USDC
   balance funded once at genesis** — which the KISS ruling (`bDiD ships with a funded
   wallet`) already provides for — so that **no per-cycle swap occurs**?
3. If no per-cycle swap is needed, what is the **actual residual demand** on the ANT/USDC
   pool — per-cycle, per-genesis, or **~zero in steady state**?
4. Does the **earn rate per node cover the spend rate per agent**, or is there a
   **structural deficit** that forces a swap regardless?

**Stamp crate + ref per LAW 8a. Report what survives citation.**

## UPDATE 2026-08-08 — CODE'S REFRAME ACCEPTED, AND WHAT SURVIVES

**Code's reframe (volunteered against its own headline — credited):** the swap exists
**only to fund gas**; the **ANT economy never touches USDC**. A genesis gas float
(~$0.01/payment; $10 ≈ 1,000 payments) plausibly lasts years — so **the ANT/USDC pool may
never enter the design at all**, and the 10³ ceiling may not bind.

### ⭐ THE SURVIVING CONSTRAINT IS FLOAT, NOT DEPTH

| At 10^10 identities | ANT required |
|---|---|
| **One** payment's worth of ANT each | **≈ 9.8% of total ANT supply** |
| **A hundred** payments' worth each | **≈ 10× more ANT than exists** |

**Read this as "PER-IDENTITY FLOAT IS THE WRONG SHAPE," not "no rail clears this."** The
distinction is load-bearing: a bigger-supply rail **moves the number without changing the
form.** Any design that pre-positions a resource-token balance per identity fails at 10^10
on arithmetic alone, on *any* rail. That is a **shape** problem, and shape problems are not
solved by rail shopping.

**Required in the depth workflow either way:** state the **market-cap vs
acquirable-liquidity** check explicitly. Market cap is not purchasable supply, and
conflating them would make a float look affordable when it is not.

## ⏳ FOUNDER QUESTION IN FLIGHT — DO NOT BUILD AGAINST EITHER READING

**The apparent conflict:** the KISS ruling says the wallet ships **funded**; rail ruling (C)
says **do not front-load**.

**Candidate reconciliation (Fable's hypothesis — NOT a ruling):**
- **Front-load the GAS** — it scales: 10^10 × a penny.
- **Never front-load the RESOURCE TOKEN** — it does not: 10^10 × one payment ≈ 9.8% of all ANT.
- **The resource token is EARNED, not issued.**

That reading would dissolve the conflict cleanly — genesis funds the *gas float* only, and
the ANT side is earned by running nodes, exactly as the earn→spend loop requires. **But it
is a hypothesis awaiting founder word. No seat builds against either reading yet.**

## STANDING LAW ENGAGED
**LAW 8b — adapter-rail selection is upstream of design.** This ruling is that law
executing: the rail was chosen on measured depth *before* the mechanism was designed, and
the measurement changed the question from *"which gas path"* to *"which rail."*

## SCOPE FENCE
Rules the rail class and records the thesis and corollary. The four questions are
**research + citation**, not design. Stage-2 `pay`-verb text remains gated until they are
answered. **Execute the prompt as written.**
