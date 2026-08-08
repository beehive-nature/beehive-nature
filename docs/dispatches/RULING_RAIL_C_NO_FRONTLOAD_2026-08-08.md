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

## STANDING LAW ENGAGED
**LAW 8b — adapter-rail selection is upstream of design.** This ruling is that law
executing: the rail was chosen on measured depth *before* the mechanism was designed, and
the measurement changed the question from *"which gas path"* to *"which rail."*

## SCOPE FENCE
Rules the rail class and records the thesis and corollary. The four questions are
**research + citation**, not design. Stage-2 `pay`-verb text remains gated until they are
answered. **Execute the prompt as written.**
