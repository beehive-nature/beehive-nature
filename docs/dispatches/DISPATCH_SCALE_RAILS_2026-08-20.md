# DISPATCH — the scale rails: Relay Protocol, QuickNode, ERC-8004 — compared and decided

**From:** zbCode/zAgent (GLM seat), 2026-08-20 · research + decision under delegated authority;
register entries and new adapter classes remain founder-gated (N-1…N-3 below).
**Founder asks, verbatim:** *"does this help at all: https://github.com/relayprotocol ? this
one seems even better; remember to keep multiple options that serve different users and
functions and goals/outcomes. i created a free account here and an api; take a look and
compare and make a decision best way(s) to navagate to scale to 10 billion users for at
least 1k years"* · *"we will want to find a scalable no subscription solution but seems
reasonable for alpha/beta bootstrap."*

**House law this must satisfy:** the hardline 8d test (does the ten-billionth user's cost
land on BNR?), the two-oracle witness law, the adapter-register rule (entry by founder word
only), EGRESS.md (a PR that adds an outbound URL adds a row), and key law (secrets never
enter the repo or chat; `.gitignore` already covers `.env`/`*.key`/`secrets/`).

---

## 1 · What each thing actually is (verified, with receipts)

**Relay Protocol** (`github.com/relayprotocol`, 12 repos; relay.link — the ex-reservoir
cross-chain settlement network). Solver-based bridging/swapping across EVM chains:
contracts (depository, periphery, vaults), a TypeScript SDK, gasless examples, a
scan-to-pay demo, an MCP server, and a fork of the ERC-7730 clear-signing registry.
Licenses L-VERIFYed at default branches 2026-08-20:

| repo | license | verdict |
|---|---|---|
| `relay-kit` | **MIT** (© 2024 Reservoir) | boardable as pattern **and** code if a lane wants it |
| `relay-vaults` | **AGPL-3.0** | copyleft with network-trigger obligations — **reimplement, never paste** |
| `relay-depository` · `relay-periphery` · `relay-mcp` · `relay-gasless-examples` | **no LICENSE file found** | all-rights-reserved — **pattern only, code never boards** |

**QuickNode** — commercial RPC/platform. The founder created the free account, key named
`zAgent` (ID `ad48a47f-f592-4b54-89c5-05200d12f2c2`, admin scope). Offerings in scope:
JSON-RPC endpoints, **webhooks** (wallet-transfers / contract-events / parsed-contract-events
templates; chain set to **Base mainnet**), **Streams** (historical backfill pipelines), and
the **ERC-8004 add-on**. Key law recorded here: the key *value* never enters chat, the repo,
or any receipt — it lives in the founder's dashboard and, if a build ever needs it, a local
`.env` or GitHub Secret. The ID above is an identifier, not a secret.

**ERC-8004 "Trustless Agents"** (eips.ethereum.org/EIPS/eip-8004) — **DRAFT** standards-track
ERC, created 2025-08-13; authors MetaMask · ethereum.org · Google · Coinbase. Three
lightweight per-chain singleton **on-chain** registries: an **Identity Registry** (ERC-721 +
URIStorage; each agent an NFT resolving to a registration file listing MCP/A2A/ENS/DID/wallet
endpoints), a **Reputation Registry** (signed client feedback; scoring on- and off-chain),
and a **Validation Registry** (hooks for stake-secured re-execution, zkML, TEE oracles).
Trust models pluggable and tiered by value at risk. The architectural fact that decides
everything: **the registries are on-chain and public — readable by any RPC, forever.**
QuickNode's add-on is a convenience window over that data, not its source of truth.

## 2 · The decision — four rails, different users, different functions

*(founder's word: keep multiple options serving different users and functions and
goals/outcomes — recorded as standing infra law.)*

### Rail 1 — PERMANENT, sovereign, no subscription (the 1k-year layer)
**Our own read path: `b-indexer` (landed `742ffbf`, keyless-by-spec, two-oracle divergence
law at schema level) + the public-RPC mesh + direct reads of on-chain registries.**
This is the only rail that can honestly promise 10B users × 1k years: open standards,
on-chain data, self-hosted code, zero vendors load-bearing. The §10 measurement proved the
pattern works keyless today (four public endpoints, zero accounts). At future scale this
rail grows into our own nodes — cost lands where usage lands, never on the hive (8d-safe).
**QuickNode endpoints may sit in a b-indexer config as one oracle during alpha/beta**
(env-provided, key outside the repo); they are never the default and never the only oracle.

### Rail 2 — BOOTSTRAP, free tier, event push (the alpha/beta accelerator)
**The founder's QuickNode account, exactly as he framed it: reasonable for alpha/beta.**
What it buys that rail 1 lacks today: (a) rate-limit headroom — the §10 run measured
HTTP 429s on public Base RPCs within ~300 sequential calls; (b) **webhooks** for ops
alerting (OFFER acceptances, escrow-wire events, `OnMushroomTransfer`/`OnItemTransfer`
census activity) — push, not poll; (c) **Streams** for historical backfill during census
and induction passes. Discipline, written now: webhooks feed **ops and caches, never
rendering truth** — surfaces keep rendering from chain-or-cache with the museum's
dead-network honesty law unchanged. **Exit criterion recorded at entry:** the day usage
outgrows the free tier or a subscription would be required, the functions migrate to
rail 1 (b-indexer ingestion + our own polling), and the register entry is retired with a
receipt. An EGRESS.md row is owed the moment any endpoint or webhook is actually wired.

### Rail 3 — the machine-agent lane: ERC-8004 as the PUBLIC discovery layer
**For our agents, never for humans, and never as the house Reputation.** The boundary is
existing law: humans are bzDiD/PERSON-1 (biometric uniqueness, consent-first, no 1:N);
house Respect is emergent, non-transferable, never bought (GOV-1). ERC-8004 is how the
founder's autonomous-machine lane (PATH2SCALE machine docking, bMeshAsi compute workers,
future zAgent-class surfaces) becomes **discoverable and checkable by outside agent
economies**: an identity registration listing our MCP/service endpoints, feedback flowing
in as public receipts, validation hooks published. We read others' scores as evidence —
the reputation-engine stays the only source of weight. Draft-status law (UR-framing
precedent): wire types additive-only, frozen per registration; nothing load-bearing on an
unratified ERC without a migration path. The QuickNode add-on is the fast way to LEARN the
schema across its 15+ networks during alpha; rail 1 reads the same registries directly.

### Rail 4 — cross-chain value movement: Relay as PRIOR ART, with three specific gems
Relay moves **fungibles** through solver settlement. For us that maps to b-class value and
payments — **never art**: an ERC-20i routed through a bridge/pool is the `TO_SOURCE`
dissolution path (measured in the §10 receipts; COMPAT-1 §2.4) — *"escrow the payment,
never the art"* stands. Patterns worth taking: (a) **scan-to-pay demo** → bComb dynamic-QR
adjacency; (b) **gasless/EIP-7702 sponsorship** → cross-check against CD-29's
GasSponsorshipVoucher (carry-the-reservation discipline); (c) the **ERC-7730 clear-signing
registry** → direct prior art for bSAFE device verification screens — upstream
`ethereum/clear-signing-erc7730-registry` is CC0 (verify at pinned commit before any
boarding; Relay's fork license unverified). `relay-kit` (MIT) is boardable if the OFFER
ever needs solver-style settlement; everything else is pattern-only per the license table.

## 3 · The one-picture summary

| rail | serves | subscription? | lifetime | failure mode |
|---|---|---|---|---|
| 1 · b-indexer + public RPCs + on-chain reads | every user, forever | **none** | 1k years | none load-bearing — this IS the floor |
| 2 · QuickNode free tier | alpha/beta ops + backfill | free now, **never paid** | until free tier ends → migrate to 1 | vendor limits — bounded by the exit criterion |
| 3 · ERC-8004 registries | machines/agents, outside economies | none (on-chain) | as long as chains exist | draft churn — bounded by frozen wire types |
| 4 · Relay patterns | builders (bComb, bSAFE, paymaster) | none (patterns) | n/a | n/a — code boards only where MIT |

**The navigation to 10B × 1k years in one sentence: build nothing that needs QuickNode,
read everything ERC-8004 publishes straight off-chain, let agents be discoverable by open
standards, move fungibles by pattern — and use the founder's free account to make
alpha/beta fast, with its exit written on the door.**

## 4 · Gates for the founder (not mine)

| | question |
|---|---|
| **N-1** | QuickNode enters PREAPPROVED-ADAPTERS-1 as the first **bootstrap-class** entry (new class: free-tier, exit-criterion-carrying, never-subscribed)? Recommended yes, time-boxed to alpha/beta. |
| **N-2** | R-6 (from the census, already on your desk): Base + Ethereum formalized as **READ adapters**. Rails 1–3 assume it. |
| **N-3** | Open the ERC-8004 evaluation lane for the machine-agent side (registrations under founder-held keys, never seat keys; feedback published as receipts; scores read as evidence, never weight)? |

No register entry, no key usage, and no webhook has been wired by this dispatch — it is
the comparison, the decision, and the gates. Read-only research; no transaction, no key
material at any point.
