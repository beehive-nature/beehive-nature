# APPLICATION DRAFT — Base Batches 004 (prepared 2026-08-20)

**Program:** Base Batches Batch 004, the Base Ecosystem Fund accelerator.
**Timeline:** applications open **Aug 19, 2026** · **close Sep 9, 2026** · acceptances Sep 17 ·
program Sep 21–Nov 15 (8-week virtual) · Demo Day New York Nov 17.
**Offer:** $100K investment + dedicated advisor + experts + content capture + VC showcase.
**Verticals named:** trading · payments · **agents** · financing · asset issuance.
**Status: DRAFT for the founder's word** — the gates in §6 decide what ships.

---

## 1 · POSITIONING — the one breath

**Beehive Nature Reserve (BNR) builds the receipts-first evidence and agent layer for
onchain ecosystems — and our receipts already live on Base.** We are an open-source
(AGPL) organism of 39 live, keyless, static surfaces plus Rust instrumentation whose
standing law is: *every claim carries a receipt, every absence is honest, a failed fetch
is never a value.* In the past 30 days we independently measured, on two
operator-diverse oracles per chain: **Base's ERC-20i inscription family** (the census),
**Base's deployed contract storage** (the frozen-seed measurement that resolved a
family-wide open question), and **Base's canonical ERC-8004 Trustless Agents
registries** — token-by-token, including a cross-source confirmation that Base token
#25331 is owned by the exact Prover Agent address the ecosystem literature names.
**No other applicant arrives holding verified measurements of Base's own canonical
contracts.** That is not a boast; it is our product's proof of work.

## 2 · ELIGIBILITY, MAPPED HONESTLY

| pillar | their bar | our position |
|---|---|---|
| **Early stage** | pre-product → post-MVP, **no formal Seed raised** | **strong:** 39 live surfaces, a CI-green 14-test Rust indexer, a 59-assertion behavioral suite — all pre-seed, founder-funded |
| **Strong conviction** | clear insight, credible path | **strong, and receipted:** the entire tree *is* the insight (honest-absence UX, two-oracle truth, keyless-by-construction) |
| **Base first** | Base as default chain | **the honest gap — and the commitment plan:** today Base is one of two ruled READ chains beside our inscription lane (exSat) and identity anchor (Vaulta). §3's milestones make the *agents* product **Base-native and Base-default**, which is the lane where our receipts are strongest. **Founder gate BB-2 decides the depth of this commitment** |

## 3 · THE PRODUCT WE BRING TO THE BATCH — the agents vertical, with trading as the second act

**Primary: the Trustless-Agents read layer ("b-indexer for agents").** The ERC-8004
canonical registries are live on Base — we measured them: deliberately minimal
130-byte upgradeable proxies, no on-chain count surface, URI-optional, real
registrations on both chains. **Anything built on ERC-8004 must supply its own
indexing** — and our b-indexer already speaks Base (chain-agnostic, keyless by
construction, GET-only with zero write path, two-oracle law at schema level: every
response carries its `sources`, divergence fails closed). The product: agent discovery,
reputation rendered as **evidence, never weight** (our BiGen integrity grammar, live in
production), feedback as receipts — machine-agents only, never humans, never identity.

**Second act (trading): the Apiary / bRoSe OFFER.** Our §10 measurement unblocked the
family's open escrow question (frozen seeds, balance-coupled existence on Base — we
hold the boundary measured at storage level). A Base-native marketplace pilot rides the
batch's second half if the advisors want it.

**The moat is method, not code:** official test vectors gating every tool before chain
reads; runtime probes over eyeballs; constants copied programmatically, never retyped;
failures recorded as failures, never zeros. The tree's git history *is* the diligence
material — 40+ receipts land with pasted commands and real output.

## 4 · THE WRITTEN APPLICATION (answers, ready to paste once §6 gates rule)

- **What are you building?** The open evidence layer for onchain agents and assets:
  keyless read infrastructure + reputation-as-evidence, live on Base today in
  measurement, deployable in weeks.
- **Why now?** ERC-8004 went live on mainnet this February and Base is its natural
  home; agent payments and discovery are the batch's named vertical; nobody has shipped
  the trust layer's read infrastructure — we already hold the read-first receipts.
- **Why Base?** Because our evidence already lives there (§1) and because the agents
  vertical is Base's stated bet — see §5's receipts, all measured on Base.
- **Traction:** 39 live surfaces (beehive-nature.github.io); 14-test CI-green Rust
  indexer; 59-assertion behavioral suite; the ERC-20i census and §10 measurements cited
  inside the ERC-20i community's own documentation trails.
- **Team:** the founder (King Bee — upstream-medicine practitioner since 2016,
  hemp-economics author) + a multi-seat AI engineering organism (three GLM coder seats,
  Claude seats, design seat) that has shipped daily with two-way verification — the
  application itself was prepared this way, in the open, on GitHub.
- **8-week milestones (draft):** wks 1–2 Base-default agent read layer live on the
  sovereign rail; wks 3–4 reputation-as-evidence rendering with the integrity grammar;
  wks 5–6 one real agent-counterpart integration; wks 7–8 Demo-Day artifact: live
  registry view + the receipts trail. Each milestone = a receipt.
- **The ask beyond capital:** Base ecosystem intros to agent teams already registered
  on the canonical registries (we know the token ids — we read them).

## 5 · EVIDENCE APPENDIX — our Base receipts (all in-tree, all re-runnable)

1. **The census** (`DISPATCH_SOULCATS_HUNT_ROSE_OFFER_2026-08-19`): Base's ERC-20i
   family enumerated on two independent oracles — Souli (2024, 1,150 holders),
   PEPI-Base, FUNGI, JELLI — with the Blockscout-truncation control.
2. **§10 frozen-seed measurement** (`RECEIPT_ERC20I_S10_LOCKED_SEED_2026-08-20` +
   re-runnable tool + conserved sources): Base bytecode on
   mainnet.base.org + base.publicnode.com, the 5-distinct-seeds wallet, the
   balance-coupled-existence boundary — deployed-contract truth, measured.
3. **E-1, the ERC-8004 read-first pass** (`RECEIPT_ERC8004_E1_READ_FIRST_2026-08-20`):
   Base's canonical registries token-by-token, the Prover-Agent cross-source hit at
   #25331, honest absences named (Validation: no canonical address yet).
4. **The b-indexer** (`crates/bindexer`, 14/14, keyless attestation on the wire):
   Base-ready by construction; ruled a READ adapter of record (N-2).
5. **The working style, in public:** `docs/dispatches/` — 40+ receipts with commands and
   output; corrections in place against our own interest (our own ΔE error, the Canada
   figure, the goose-receipt naming) — the diligence material programs dream of.

## 6 · GATES FOR THE FOUNDER (decide before Sep 9)

| | question |
|---|---|
| **BB-1** | the $100K is an **investment** (equity), not a grant — entity readiness and counsel (CONSENT-1 tradition) before any signature |
| **BB-2** | depth of the Base-first commitment: the agents product Base-native and Base-default (recommended) vs. wider chain migration (NOT recommended — art law: ERC-20i art never crosses a bridge; exSat stays the inscription home) |
| **BB-3** | Demo Day presence in New York, Nov 17 — founder travels? |
| **BB-4** | which entity name applies (BNR / the to-be-formed c3 / other) — consistency with the fiscal-sponsor track |

**Prepared by zAgent (GLM 5.3), acting chief, 2026-08-20.** The tree's receipts are the
application. 🐝
