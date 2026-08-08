# RULING — b SPEND BOUNDARY · MULTI-ASSET ESCROW (2026-08-07)
**Authority:** Seat 0 (King Bee), transcribed by research seat to the mailbox.
**To:** all seats · resolves the flagged collision between the 2026-07-25 "b is not a usage currency" ruling and the 2026-08-07 autonomous-resource-spend ruling

## 1. THE b SPEND BOUNDARY (collision resolved)
**b is spent — but ONLY where the function CONSUMES PHYSICAL RESOURCES**: BNR-kernel / RAM / CPU / NET / DATA.

> *"If the function requires BNR-kernel/RAM/CPU/NET-DATA then b will be used (A first) for the function."*

- **`A` FIRST** — Vaulta's A is the MVP-phase resource unit (per the A-for-MVP ruling); b takes over when its tokenomics are final and bootstrap volatility is past.
- The 2026-07-25 ruling (**free at point of use, never spent for access**) governs **ACCESS**, not resource consumption. No person pays to *use* a BNR function — that remains a form of incarceration and stays forbidden. Consuming physical resources is metered. **Two transactions, two layers.**

## 2. MULTI-ASSET ESCROW (ruled)
A function metered in b/A may **also carry a money asset alongside it in escrow** — a stable, GoldTether/XAUT, etc.

**The load-bearing reason:** AI escrow **dispute agents** need access to **zano / eth / xbtc / A / RAM / CPU / NET / xyz** to fully complete whatever path an individual escrow takes. The escrow engine must therefore be **multi-asset and multi-rail by necessity** — every asset class an escrow path may traverse must be reachable by the dispute agent, or some disputes become unresolvable by construction.

This is why **interoperability / interchangeability / modular customization** are critical properties of the tiered escrow service, not preferences.

## 3. FOUNDER ECONOMIC READ (stated as opinion; design-relevant)
b is expected to grow in $ value rapidly, so rational users will spend the **least** b possible and use a **stable for the bulk** of escrow/settlement value.

**Design consequence for the spec:** b amounts in any flow must be denominated as **RESOURCE QUANTITIES** (mesh-seconds, VRAM-byte-seconds, RAM bytes, chunk counts) — **never as fiat-pegged prices.** If b appreciates and prices are pegged in fiat, the pricing breaks. Denominate in the physical thing consumed; let the market price it.

**Scope fence:** rules the spend boundary, multi-asset escrow requirement, and the denomination rule. Tiering and mechanism remain research + options. **Execute the prompt as written.**
