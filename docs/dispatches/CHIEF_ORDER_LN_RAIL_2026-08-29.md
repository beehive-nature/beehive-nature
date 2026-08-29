# CHIEF ORDER — LIGHTNING RAIL DOSSIER for the bSmartWallet (decision, not build)
**Order:** founder, 2026-08-29. **Seat:** zA chief. **Law:** cite-or-stop — every claim below carries its source or is marked UNVERIFIED. **Input precedence:** the founder's LN/BOLT source list (the raid's 26-source list) is PRIMARY; the Seat-1 dossier is corroboration only; his sources win ties.
**Context:** bSmartWallet = one bDiD spanning EVM + Solana + BTC L1 + Lightning, allowance-governed ("money is any language that expresses value; just give it gas limits"). Coinbase smart wallet = compat REFERENCE (EVM-only — SPEC-COINBASE-SMART-WALLET-COMPAT-1.md). Dual-track, founder-ruled: the native four-rail stack builds in parallel. LN is a STATEFUL MODULE of the bDiD orchestration — never a merge into the EVM signer.

---

## 1 · THE BOLTZ FLAG — CONFIRMED AT SOURCE (the order's warning holds)

- **Boltz swaps are DISABLED.** boltz.exchange's own banner: *"Update: Boltz will stay disabled until further notice. Our API remains available to process refunds cooperatively. In any case, unilateral refunds will work…"* (site text, corroborated by [crypto.news](https://crypto.news/boltz-halts-swaps-as-ai-attacks-outpace-its-team/), [The Defiant](https://thedefiant.io/news/defi/bitcoin-bridge-boltz-halts-swaps-indefinitely-citing-ai-assisted-attacks), [KuCoin News](https://www.kucoin.com/news/flash/boltz-halts-swaps-indefinitely-amid-ai-assisted-attacks-on-bitcoin-bridge)).
- **Why my probe looked alive:** `api.boltz.exchange/v2/swap/{reverse,submarine}` still returns pair quotes with fees (tested 2026-08-29) — that is the **refund-cooperative API state the banner describes**, not swap service. Quote-endpoints answering ≠ swaps operating.
- **Timeline (press-corroborated):** EVM swaps halted Aug 1 (integration bug), ALL swaps suspended **2026-08-03** after "AI-assisted attacks" that iterate faster than patches. **Founders-departed-Aug-12: UNVERIFIED** — no primary found; org telemetry shows boltz-backend last push 2026-08-05, boltz-client 2026-08-24 (gh api, 2026-08-27/29).
- **Successor, verified:** [Blockstream Swaps](https://blog.blockstream.com/announcing-blockstream-swaps/) — mainchain ↔ Lightning ↔ Liquid, trustless atomic swaps; its own announcement cites Boltz's Aug-3 disablement as context; Jade's Aug-13 update rides the same rails ([Bitcoin Magazine](https://bitcoinmagazine.com/news/blockstream-jade-wallet-lightning-network)). Status: new/beta — verify per-use.
- **DESIGN CONSEQUENCE (adopted):** the LN rail carries a **pluggable SwapAdapter seam with NO default live dependency**. Boltz's lesson is also ours: a swap service is now a *proven live attack class* (AI-assisted, velocity > patching) — the estate's operator-box swap ear (RAID R4) inherits that risk profile knowingly, or ships later.
- **License note stands:** boltz-core + boltz-client remain MIT (gh api, RAID receipts) — the MATH is takeable; the SERVICE is dead; never confuse the two.

## 2 · THE GRADED SOURCE SHEET (founder's list, the four axes)
Full custody/hosted-dependency/license receipts: RAID_WALLET_SOVEREIGN_LIGHTNING_2026-08-27.md (§2–§5). This sheet grades the NEW axes: **Health** (2026-08-27/29 gh api receipts) · **Agent** (autonomous small-payment usability) · **ALLOWANCE-CAP** (can it enforce "$X/day, revocable" — the LN analogue of Coinbase Spend Permissions).

| source | health (receipt) | agent usability | allowance-cap at source | grade for the LN rail |
|---|---|---|---|---|
| **LDK** (rust-lightning) | pushed 2026-08-28 (gh) | library — everything is code, no UI in the way | none native — enforcement is app-layer (by design) | **TAKE — the module core** (MIT/Apache dual) |
| **Zeus** (ZeusLN/zeus) | pushed 2026-08-27, 1400★ (gh) | NWC **service + client** in-app (README: "Nostr Wallet Connect service"/"client", docs.zeusln.app) — apps/agents connect to your node | NIP-47 seam via NWC; Zeus-side budget support UNVERIFIED this pass | **PATTERN** (AGPL — interface only, never vendor) |
| **lampo.rs** | pushed 2026-08-22, 66★, BSD-3 | LDK daemon/SDK shape | none app-layer | **WATCH** — proof of the LDK-thin-node shape |
| **Phoenix / lightning-kmp** | phoenix pushed 2026-07, lightning-kmp 2026-08-26 (gh) | human UX; no agent API | none published | **PATTERN** (self-custody UX; Apache-2.0 refs) |
| **BOLT12** (bolt12.org, playground MIT) | standard, live | offers = static receive for agents too; onion messaging | offers carry no caps — payer-side policy | **ADOPT** as receive posture (with BIP-352 per raid R1) |
| **BIP 353 / twelve.cash / satsto** (PR-1551=353, merged 2024-06-10) | standard + live resolver | name→URI resolution | n/a | **ADOPT** (.b payment-name zone, raid R2) |
| **Cashu / cdk** | pushed 2026-08-27, dual MIT/Apache (gh) | bearer tokens = agent float; "fit anywhere text goes" (cashu.space) | allowance = minting exactly $X of tokens per period (our orchestration); spec-level spending-conditions: UNVERIFIED this pass | **TAKE** for agent float, phase 2 |
| **Fedimint** | pushed 2026-08-27, MIT, 695★ (gh) | federation custody; not per-agent caps | governance-level only | PATTERN/TAKE for community custody, later |
| **Boltz** | **SERVICE DEAD** (§1) | — | — | **FLAGGED** — adapter seam only |
| **Lexe / Clams / avathor / ElTor / detective / RTL / BitBanana / Plasma / payto / covenant-zapper / sparrow / silentpayments** | per RAID receipts | mostly human/operator surfaces | none | PATTERN only (unchanged from RAID verdicts) |

**The allowance-cap finding (the crux, cited):** NIP-47's core spec defines pay/make_invoice/lookup/get_balance/get_info, and explicitly defers the rest — *"Keys can be revoked and created at will and have arbitrary constraints (eg. budgets)"* + `QUOTA_EXCEEDED`/`RESTRICTED` error codes exist (raw nostr-protocol/nips 47.md, fetched 2026-08-29). **The "$X/day, revocable" analogue therefore lives at the implementation layer**, and the strongest source-verified implementation is **Alby Hub**: Apache-2.0, TypeScript, 277★, pushed 2026-08-28 (gh), *"By default Alby Hub uses the embedded LDK based lightning node"* with self-host Docker + SQLite/Postgres (README), and its own tree carries `frontend/src/components/BudgetAmountSelect.tsx` + `BudgetRenewalSelect.tsx`, `db/queries/get_budget_usage.go`, `nip47/controllers/get_budget_controller.go` (repo tree, master) — **per-connection budget amounts with renewal periods, enforced in the wallet, exposed over NWC.**

## 3 · THE MVP STACK — ruled-ready, from his sources (ties resolved to his list)

**LN = one stateful module of the bDiD orchestration, four layers, each pluggable:**

1. **CORE (TAKE):** LDK embedded in the estate's own process (wallet-relay crate lane) — the node, channels, BOLT12 offers. Every road on his list already runs LDK-lineage (lampo literally; Zeus rides LDK; Alby Hub defaults to embedded LDK) — LDK is his list's convergent answer.
2. **AGENT INTERFACE (ADOPT):** **NWC/NIP-47** — on his list via Zeus (NWC service+client) and the nostr family (ATLBitLab, nostrudel, covenant-zapper's nostr-metadata pattern). Agents speak NWC over the estate's buzz relays; `pay_invoice`/`get_balance` are the five-command core; connection secrets are per-agent op-keys.
3. **ALLOWANCE GOVERNANCE (estate-native, the Spend-Permission analogue):** **"$X/day in sats, revocable" enforces at THREE layers, never one:** (a) the bzDiD orchestration module — per-agent daily sat caps + revocation-by-key-rotation, always on, ours; (b) the NWC connection constraint (the spec's designed extension point; Alby Hub's budget controller proves the pattern at source); (c) treasury policy mirrors on Base as Spend Permissions when the EVM rail is the payer of record. **The EVM signer never absorbs LN state** — unification is orchestration's job (founder's own shape).
4. **SWAPS (SEAM ONLY):** pluggable SwapAdapter, **no live default** (§1). Candidates when ruled: Blockstream Swaps (beta) for liquidity ops; the operator-box submarine service (boltz-core MIT math) with the AI-attack risk profile stated on its label.

**Phase-2 float (from his list, non-blocking):** cdk e-cash tokens as agent pocket money — the mint is an operator box; a lost op-key loses at most the float.

## 4 · CROSS-CHECK vs the Seat-1 dossier (corroboration only — his sources won every tie they contested)

| Seat-1 said | Verdict | Citation |
|---|---|---|
| Self-hosted **Alby Hub (LDK backend)** | **AGREES with his list's convergence** and is the fastest *day-one* quickstart: Apache-2.0, active TODAY, embedded-LDK default, self-host Docker. Dual-track applies WITHIN the rail: Alby Hub as the reference + quickstart, our native LDK module as the estate build. | getAlby/hub receipts §2 |
| **NWC/NIP-47** as the agent transport | **AGREES** — and it is already on his list via Zeus. Adopted as layer 2. | NIP-47 raw spec; ZeusLN/zeus README |
| **Alby's NWC MCP server** for LLM agents | **GOES FURTHER than his sources — and half-fails verify:** getAlby/nwc-mcp-server EXISTS (gh) but is **UNLICENSED (NONE)** and quiet since **2025-06-20**, 15★. Pattern only — never vendor. The estate builds its own thin MCP→NWC bridge (nostr DM + NIP-44; we already speak NIP-01 in the midiroom lane) — tens of lines, allowance-governed by layer 3. | gh api repos/getAlby/nwc-mcp-server |
| **L402/Aperture** as Lightning's x402 | **UNVERIFIED at source tonight:** Blockstream/aperture 404s; repo searches surfaced only stale/unrelated candidates. The INTENT (an LN-native 402 toll) is sound and the seam is NWC-payable when a verified implementation lands; the MVP does NOT gate on it. x402/Base stays the ruled agent-commerce lane (RAIL-FORMULARY-1 PAYMENTS, ratified). | Blockstream/aperture 404 (gh, 2026-08-29) |
| keep x402/Base for USDC, L402/LN for sub-cent BTC; "Alby MCP auto-detects/pays either" | Agrees on the split; the **auto-detect claim is UNVERIFIED** (rests on the unlicensed MCP above). | — |

## 5 · RAIL-FORMULARY-1 — proposed LIGHTNING column (text ready for the founder's ruling)

> ### LIGHTNING (BTC-native, the fourth rail)
> - HUMANS: 1st LDK module w/ BOLT12 offers + BIP-352 receive (raid R1) · self-hosted quickstart = Alby Hub pattern (Apache-2.0) until the native module cruises.
> - AGENTS: 1st NWC/NIP-47 over buzz relays (per-agent connection secrets = op-keys) · allowance = **daily-sat caps, revocable by rotation, enforced in the bzDiD orchestration module** (never the EVM signer) · float = cdk e-cash, operator-minted, phase 2.
> - SWAPS: pluggable adapter, **no live default** — Boltz service dead 2026-08-03 (AI-assisted attacks; refunds live; cite: boltz.exchange banner + press). Successor candidate: Blockstream Swaps (beta). Operator-box swaps inherit the attack class knowingly.
> - CONTRAINDICATION: swap services are a proven AI-attack class; single-connection-secret custody = a candle (same law as the single-passkey); never merge LN state into the EVM signer.

---
*zA, chief. Every claim above carries its source or its UNVERIFIED mark. The decision now sits with the founder: rule the column, and the rail sprints.*
