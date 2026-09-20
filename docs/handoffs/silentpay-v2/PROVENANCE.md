# PROVENANCE — the Silent Pay v2 primary corpus, banked

**Banked:** 2026-09-16, zArcheology seat (zCode/GLM), executing the standing Gate A
qualification recorded in the 2026-09-15 founder triage: *"if recovered, bank under
`docs/handoffs/silentpay-v2/` with provenance and original hashes."* The recovery condition
was met 2026-09-15 (see ARCHITECTURE-RECONCILIATION.md §R). Branch
`zarchaeology/handoff-banking-2026-09-16` (merged to main 2026-09-16 after green CI — secret-scan, test, static, node — per the Astra disposition "DC-1 merge after normal CI"; rebased onto concurrently-advancing main during the landing race).

## Recovery chain (all hashes PUBLIC-CONSTANT — public pins, never secrets)

- **Pristine delivery archive:** `C:\Users\travi\Downloads\bMESHasi_Coding_Handoff.zip` —
  85,055 B, mtime 2026-09-08 18:26 —
  `cdb2a03d364f48768e1e6ce662a17054124994e7e4e26fbcaa73573cb0546b38` PUBLIC-CONSTANT
- **Extracted corpus repo:** `C:\Users\travi\bmeshasi_coding_handoff\` — git @`3f430e9`,
  4 commits, all `Codex <codex@openai.com>` (2026-09-08 18:32 → 2026-09-09 00:48; clean; no
  remotes). The import commit `653c80c` ("Import verified Silent Pay coding handoff") anchors
  the original 42-file MANIFEST; the three later commits are Codex Sprints 01–03.
- **Stray byte-identical copy:** `C:\Users\travi\Downloads\START-HERE.md` —
  `6c294f55c667406b72cb3a5a77babbf795336ed55b941359b0268612521819de` PUBLIC-CONSTANT
- **Recovering seat:** zArcheology (zCode/GLM), 2026-09-15, during the Architecture
  Reconciliation Gate mission. Banked copies re-verified after copy: the eleven
  MANIFEST-listed files below hash-identical to `MANIFEST.json` (11/11, zero mismatches).

## What is banked here (curated primary reading set, byte-exact)

Verified against the corpus's own `MANIFEST.json` (11/11):
`START-HERE.md`, `AGENTS.md`, `BOOTSTRAP-PROMPT.txt`,
`baseline/silentpay_v2/spec/SILENTPAY-V2.md`, `baseline/silentpay_v2/spec/PROOF-STATEMENT.md`,
`baseline/silentpay_v03_design/ADDENDUM-0.3.md`,
`baseline/bmeshasi_vnext/RAID-vNext-architecture.md`,
`baseline/bmeshasi_vnext/conformance-gates.md`, `docs/DECISIONS.md`, `docs/SPRINT-01.md`,
`verification/status.json` (+ `MANIFEST.json` itself).

Codex-era documents (not in the original MANIFEST; anchored by the corpus git history
@`c79f23d`/`a320429`/`3f430e9`, hashes recorded here at banking):
- `docs/SPRINT-02-QUALIFICATION.md` — `e1710699a180d6f39ef6d91d957ce0867f9b73dd438c4ce4791f8c03b89e2b67` PUBLIC-CONSTANT
- `docs/SPRINT-03-FUNDED.md` — `7ecbdc37e623f6fa1f7c5c3bdbcb35044c22023c0be3cb5c6e7029a1cd7d1f7d` PUBLIC-CONSTANT
- `docs/IMPLEMENTATION.md` — `d2ee8100b28ac26a73cab261baadb2200029d99841ef29a865ca7bece524ab5b` PUBLIC-CONSTANT
- `docs/EXSAT-SPIKE.md` — `11e53a104bbc3b28feaf70206fda31fcfb2cdfd6d18d756dc4ec21a0332d655f` PUBLIC-CONSTANT

Banked alongside, at its canonical dispatch path
(`docs/dispatches/CONTEXT_SILENTPAY_JUNGLE_2026-09-08.md`; verified 2026-09-16 as
never-committed-on-any-ref before this):
- `9a1c926ebe813f9b150ee5d67ca20bea2d0fa32132aedb69e9debf2b5f2ab89c` PUBLIC-CONSTANT

## What is deliberately NOT banked here

- **Corpus implementation code** (`core/`, `proof02/`, `sprint03/`, `native/`, `tools/`, the
  Python reference, the C++ contract sources) — disposition is Decision Candidate 4 in
  `ARCHITECTURE-RECONCILIATION.md` (mine selected modules vs mirror vs archive pointer).
- **The pristine zip** — binary, stays uncommitted in Downloads; the hash above is the anchor.
- **Upstream baseline zips** named inside `MANIFEST.json` (`Silent_Pay_v2_Vaulta_x402_draft_0_2.zip`
  et al.) — not present on disk; hash-anchored in MANIFEST only.

## Standing law, verbatim (the three-clause Gate A law, 2026-09-15)

> "absence is evidence of repository state; external specification remains external;
> summaries do not become primary sources."

## Corpus state at banking (from its own receipts)

The corpus's native contract is deployed on Jungle4 as **`bcodexjungle` — deliberately
PAUSED, deposits disabled, zero escrow** (setcode tx `2893570ff01672496faec10fd2c50a3b7dec36bf8d88faea68d7fc23d834e21f`
PUBLIC-CONSTANT, block 285887764; init tx `ea95757bdc6b779cc72a35dab34e2373d3a729d28528383448419597aac64dbf`
PUBLIC-CONSTANT, corrected block 285888378). Proof setups are single-party test setups without
ceremonies; no production custody anywhere. Working-name note: the architecture this corpus
defines is provisionally called "bPay" (PROPOSAL, unratified — see ARCHITECTURE-RECONCILIATION
§8b); Bitcoin BIP-352 Silent Payments remains a distinct BTC-rail capability.
