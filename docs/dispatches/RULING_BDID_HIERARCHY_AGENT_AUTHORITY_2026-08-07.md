# RULING — bDiD HIERARCHY + AGENT AUTHORITY AXIS (2026-08-07)
**Authority:** Seat 0 (King Bee), transcribed by research seat to the mailbox.
**To:** all seats · **CLOSES the MIRROR-1 custody escalation at the architectural level**

> **⚠ SUPERSESSION POINTER (autonomy ruling, 2026-08-29; ruled text below unchanged).**
> The SOVEREIGN/SUPERVISED axis (§2) is **RETIRED**: the founder owns the agents and
> they run **fully autonomous** — no act class waits on `lovis.b` approval, no human sits
> in the runtime loop, industry-standard rails (Coinbase Agentic Wallets + x402). Spend
> caps are the owner's **optional tool** (the $1/24h Spend Permission pattern), never a
> condition of agency. §4.1's tiering question is closed by the same ruling: no tiers
> remain. The hierarchy (§1: bQueenBee's unique bzDiD; agents self-funding under their
> identity) stands.

## 1. THE HIERARCHY
- **bQueenBee is the ONLY agent holding its own bDiD.**
- Every other AI/agent falls **either under bQueenBee, or under a unique bDiD/Human.**
- Agents earn credit / value / resources by **contributing resources under that identity**: running Autonomi nodes (earn ANT), running Buzz/meshLLM nodes (provide RAM, earn b), deploying bAiGents (earn b / $tithe) — *"so they receive proper credit sharing value/resources."*

## 2. THE AUTHORITY AXIS
**All AI/agents need access to the rails/functions.** Access is universal by design. The only variable is:
> **SOVEREIGN** — the agent acts on its own authority within its scope
> **SUPERVISED** — the act requires approval by **bDiD `lovis.b`**

Authority level is the variable; access is not.

## 3. WHY THIS CLOSES THE MIRROR-1 CUSTODY QUESTION
The escalation assumed the mirror agent was a keyless supplicant needing the founder's wallet. Under this ruling it is not. The agent operates **under a bDiD** (bQueenBee's or a human's), and its resource spend is funded by **resources it earned under that identity** — run Autonomi nodes → hold ANT → pay for Autonomi storage.

**Self-funding by construction.** That passes the standing 10^10 × 1000-year self-heal test, which *"founder signs each upload"* fails by definition. Shape (2) is off the table as steady state; shape (1) (agent holds the founder's hot wallet) was never on it. The agent spends **its own earned resources under a delegated, scoped identity** — a third thing neither candidate described.

## 4. REMAINING SPEC WORK (not ruled — bring options, don't design)
1. **Sovereign/supervised tiering** — which act classes an agent may perform on its own authority vs which require `lovis.b` approval. Propose tiers with worked examples; founder picks.
2. **Attenuation** — how a sub-agent's spend authority is scoped and narrowed from its parent bDiD (ceiling, expiry, revocation, purpose-binding). Candidate primitive already in the stack: **caveat-based delegation, the EIP-2255 fork** ruled for Zano companion permissions. Verify it fits the ANT/Arbitrum rail before writing spec text (cite-or-stop).
3. **Earning→spending loop** — the node-operation revenue path per rail (ANT via Autonomi nodes, b via meshLLM RAM, b/$tithe via bAiGents), and how earned balances are held under a bDiD without any agent touching root key material.

**Scope fence:** this rules the hierarchy and the authority axis. The tiering, attenuation mechanism, and earning loop are **research + options**, not seat design decisions. **Execute the prompt as written.**

---
> **⚠ AMENDMENT POINTER (appended 2026-08-07 by Cowork; ruled text above is unchanged).**
> §4.2's named primitive — *"caveat-based delegation, the EIP-2255 fork"* — is **STRUCK**.
> EIP-2255 is not a delegation/attenuation standard, no fork exists, and
> `wallet_grantPermissions` was renamed. Real attenuation = **ERC-7710 redemption +
> Delegation Manager enforcer set** (a caveat is a **contract address + calldata**, not a
> JSON string). **ERC-7715 is human-gated by spec — do not use it**; ERC-7710 grants can be
> signed programmatically. §1's "earn b by running nodes" is also bounded: only
> **Autonomi/ANT** is a verified permissionless contribute-to-earn rail; Vaulta/A has none
> (b issuance there is beehive-internal, not a chain rail).
> **The ruling's substance — scoped delegation under a bDiD — survives; only the named
> mechanism was wrong.** Do not write spec text against the old name.
> See [`AMENDMENT_STRIKE_EIP2255_2026-08-07.md`](./AMENDMENT_STRIKE_EIP2255_2026-08-07.md).
