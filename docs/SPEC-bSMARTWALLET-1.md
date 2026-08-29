# SPEC-bSMARTWALLET-1 — REQUIREMENTS (ruled-ready, awaiting founder scope)
**Status:** DRAFT FOR FOUNDER RULING — no key-management code until this spec is his. Self-custody is the one thing that cannot ship fast-and-fix (founder fence, 2026-08-29).
**Method:** cite-or-stop — every requirement below cites the ruling it descends from; gaps carry UNVERIFIED. Nothing here is new law; it is existing law assembled.

---

## 1 · THE SIX REQUIREMENTS (each descended from a standing ruling)

**R1 — ONE IDENTITY, EVERY RAIL.** A single bDiD spans all value rails; identity, authentication, and the means to pay for its own rails arrive as ONE object — "a new bDiD is never a keyless, penniless supplicant."
*Cite:* RULING_KISS_BDID_PASSKEY_WALLET_2026-08-08 §1 · CHIEF_ORDER_LN_RAIL_2026-08-29 context ("one bDiD spanning EVM + Solana + Bitcoin L1 + Lightning").

**R2 — FOUR NATIVE RAILS, LN AS STATEFUL MODULE.** EVM, Solana, BTC L1, and Lightning are first-class. Lightning is a module of the bDiD orchestration, NEVER a merge into the EVM signer — unification is the orchestration's job.
*Cite:* CHIEF_ORDER_LN_RAIL_2026-08-29 §Context · RAIL-FORMULARY-1 §LIGHTNING (ratified @db12e7d).

**R3 — ALLOWANCE-GOVERNED, EVERY RAIL.** "Money is any language that expresses value; just give it gas limits." Every agent-scoped spending path carries a capped, revocable allowance: **$X/day analogue enforced at the strongest layer available per rail** — on-chain (Base Spend Permissions / Spend Permission Manager), wallet-side (NWC connection budgets — proven at source, Alby Hub in-tree budget controller), or orchestration-side (bzDiD daily-sat caps with revocation-by-rotation) as the floor.
*Cite:* founder doctrine (CHIEF_ORDER context, verbatim) · genesis-allowance rider @a0d54c9 ($1 USDC/24h, spender = the agent's own wallet, revocable by hash) · RAIL-FORMULARY-1 §LIGHTNING agents line · CHIEF_ORDER_LN_RAIL §3 layer-3.

**R4 — SELF-CUSTODY, SIGNER-AUTHORITATIVE.** Keys never on a server; the relay serves but never signs; capped-spend enforcement is SIGNER-AUTHORITATIVE and any relay pre-check is advisory ("a keyless relay can be replaced, so a cap only it enforces is not a cap"). Tier escalation preserves the bDiD.
*Cite:* DESIGN-BRIEF-03 §8.1/§8.7/§8.8 (superseded-banner applies to frontend stack only) · RULINGS_FRONTEND_SIGNER_XLM_2026-08-11 ruling 2.

**R5 — TWO POPULATIONS, ONE OBJECT.** Humans and agents are prescribed separately per rail (RAIL-FORMULARY pattern); the wallet serves both without forking identity. Agents move value NATIVE (dual-track §3 below); humans onboard through the easiest lawful door.
*Cite:* RAIL-FORMULARY-1 §PAYMENTS (HUMANS/AGENTS columns) · KISS ruling §1.

**R6 — 10¹⁰ USERS, 1000 YEARS.** Stateless-per-user wherever a server exists; all user state on-chain or client-side; the server can disappear and users retain identity, wallet, and data. Every rail choice must name its scale story.
*Cite:* DESIGN-BRIEF-03 §8.8 · SPRINT-2026-08-28-PLAN scale framing · SPEC-BNROSE-3 eternal-data doctrine (the 1000-year data floor).

## 2 · RECONCILIATION — the five antecedents, where each binds

| antecedent | what it contributes | where it binds in bSmartWallet | conflict → resolution |
|---|---|---|---|
| **KISS ruling (2026-08-08)** | bDiD ships WITH passkey + wallet; spend-view UX: one aggregate number, itemized one click down, resource-denominated never fiat | R1, R5; the wallet's default view | none — it is the UX floor |
| **External-signer ruling (2026-08-11)** | signer-authoritative caps; relay advisory-only | R4; allowance enforcement layering (R3's floor is orchestration, ceiling is on-chain) | "which signer for which rail" → per-rail signer map, UNVERIFIED below |
| **Vaulta account-set (governed set_code/setabi; lawgiver Trezor)** | governed-mutable logic without redeploy; .b names; the bzDiD's mutable home | identity + governed parameters (allowance ceilings, rail configs) live as Vaulta law; art stays immutable on EVM | none — it owns the LAW column, not the keys (RAIL-FORMULARY §GOVERNED-MUTABLE; amendment authority = founder's Trezor) |
| **Alby-NWC LN rail (2026-08-29, live)** | a running self-hosted LDK node + NWC agent seam with budgeted connections (1000 sat/day shape), our own MCP→NWC bridge, swap seam with no default | R2's LN module, R3's LN allowance, R5's agent path | relay-ACL gap on the live QUOTA run (README parked leg) — does not block the spec |
| **Base Spend Permissions (a0d54c9 + compat spec)** | the EVM genesis allowance ($1/24h, revocable, enforced by the Spend Permission Manager) + the compat surface law (COOP law @5d22057, full-tab practice) | R3's EVM ceiling; Track B's onboarding engine | none — compat is Track B only (§3) |

## 3 · THE DUAL-TRACK BOUNDARY (explicit, founder-ruled, NOT abandonment)

**Track A — NATIVE (agents move value here).** bzDiD orchestration · op-keys per agent · NWC-over-buzz for Lightning · Base Spend Permissions mirroring on EVM · native Solana/BTC-L1 paths (gaps below). Allowances enforced at the strongest layer per rail; the EVM signer never absorbs LN state.

**Track B — COINBASE-COMPAT (humans onboard here).** The passkey smart wallet stays the human front door: free passkey onboarding, counterfactual addresses, email recovery, Basename identity — the adoption play, RETAINED. Its laws live in SPEC-COINBASE-SMART-WALLET-COMPAT-1 (incl. the COOP law and full-tab practice) and the genesis docket.
**Boundary rule:** Track B never becomes the agent path; Track A never blocks the human door. The two meet exactly once — at the genesis allowance ceremony (the $1/24h Spend Permission a Track-B wallet grants to the agent's own key, which is Track A's EVM ceiling).

## 4 · THREE-GATE ACCEPTANCE (the spec is DONE when all three gates pass)

1. **SCALABLE to 10¹⁰:** every component names its stateless/replicated story; nothing single-instance except law (Vaulta) and the user's own keys.
2. **ADOPTABLE, KISS-easy:** a stranger reaches a funded-ish identity through ONE door with ONE gesture class (passkey), sees the spend-view aggregate first; zero jargon on the first fold (the hub-atlas law applied to the wallet).
3. **SECURE, or clearly defined for informed consent:** every custody boundary is either enforced (signer/on-chain) or LABELLED as enforced-only-by-promise — no silent trust. A wrong number is worse than no number (honest-empty law).

## 5 · GAPS — UNVERIFIED, each a founder scope-call
1. **Solana allowance ceiling** — is there an on-chain spend-permission analogue (delegate/allowance model) strong enough for R3's ceiling, or is orchestration the floor there? UNVERIFIED at source.
2. **BTC L1 allowance** — without covenants, on-chain caps are not enforceable pre-signing; R3's BTC-L1 enforcement is signer-side (Trezor/ephemeral-op-key policy). Confirm as ruling.
3. **Per-rail signer map** — one seed behind the bDiD vs per-rail keys derived at Tier escalation: derivation scheme UNDECIDED (key-management = fenced until this spec is his).
4. **The relay-ACL leg of the LN seam** (NIP-42 vs buzz write-grant) — named in tools/ln-rail/README; does not gate this spec.
5. **Solana/BTC-L1 adapter contracts** — SPEC-ADAPTER-CONTRACT-1 covers Vaulta (B1) and Arweave (B3); Sol/BTC adapters are un specced.

---
*z1 (zCode), chief — 2026-08-29. Assembled from the rulings; gaps marked; fences drawn. The founder rules scope, then it sprints.*
