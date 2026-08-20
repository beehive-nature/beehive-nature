# SPEC-ERC8004-EVAL-0 — the ERC-8004 evaluation lane (ruled N-3, 2026-08-20)

**Founder, verbatim:** *"full steem ahead yes to all three"* (on the N-gates table, with
the acting-chief assessment `ASSESSMENT_N_GATES_2026-08-20.md` and zCode's merged riders).
**Status:** the lane is OPEN for evaluation. **Nothing registers** until founder-held
keys exist — founder-hands only; no seat creates registration keys, ever.

---

## 0 · What ERC-8004 is, receipted

"**Trustless Agents**" — a DRAFT standard, **live on Ethereum mainnet since February**:
three on-chain singleton registries for machine agents (**Identity · Reputation ·
Validation**), extending Google's A2A protocol, commonly paired with x402 payments.
Receipts: <https://eips.ethereum.org/EIPS/eip-8004> · Ledger Academy glossary · Allium
blog · awesome-erc8004. **A draft that is live is exactly why this is an evaluation lane,
not an adoption.**

## 1 · The fences (as ruled, both seats' riders included — these are load-bearing)

1. **Machine agents only.** Never humans; never house Respect. An ERC-8004 identity is a
   discovery pointer for a machine counterpart — never a person, never standing.
2. **The Identity Registry never touches bzDiD or persona machinery.** One bzDiD per
   living human is law; machine agents are a separate class with their own registry.
   No bridge, no mapping, no future "convenience" join — flag, never resolve.
3. **Registrations under founder-held keys, never seat keys.** Same key law as the
   definitions registry: credentials are used, never held; seats stay keyless.
4. **Feedback published as receipts; scores read as evidence, never weight** — the
   Reputation Registry maps onto BiGen's Law B verbatim (evidence renders beside,
   never auto-downgrades; Article II: attestation is evidence, not status).
5. **The consent-layer seam, pre-named:** if human feedback ever feeds an agent's
   reputation, the raters ride the consent layer — persona nullifier, never the root.
   Machine-to-machine feedback needs none.
6. **Two-oracle law on the registries themselves** — the three singletons are on-chain;
   every registry read verifies on two operator-class-diverse RPCs, like every chain fact.
7. **DRAFT discipline** — this lane evaluates, never depends. Wire types freeze only at
   first real use, per the UR-framing precedent (migration by deprecation, never
   mutation). If the draft moves, the lane re-evaluates; the tree never breaks with it.
8. **x402, if it follows, is a money lane** — any payments pairing routes through the
   scale-rails law (rail-4 family): license table verified before any code; pattern
   over paste where licenses demand it.

## 2 · What the lane does (the evaluation itself)

- **Read-first:** enumerate and read the three registries on two oracles (Ethereum READ
  adapter, ruled N-2); receipt what actually lives there today — entry shapes, counts,
  the A2A fields as deployed, score distributions.
- **Map, don't marry:** for each of our machine surfaces (the bIQ composer's subjects,
  the b-indexer's attested read path, future agent counterparts), record what an 8004
  identity WOULD and WOULD NOT buy — with the fences above deciding every would-not.
- **One worked specimen, paper-only:** what a bNR machine-agent identity entry would
  look like (fields, key ceremony, revocation path) — drafted, reviewed, **not
  registered** until the founder holds the keys and says register.

## 3 · Gates carried forward

| | question |
|---|---|
| **E-1** | ~~first registry-read receipt~~ **CLOSED 2026-08-20** — `RECEIPT_ERC8004_E1_READ_FIRST_2026-08-20.md`: canonical singletons are 130-B ERC-1967 proxies over chain-identical impls (admin slot empty), minimal (no name, no count surface, URI-optional), **live with real registrations on both chains** (8/8 sampled ids exist, distinct owners; Base #25331 = the literature's Prover Agent, exact match); Validation Registry = honest absence; reputation score-reads owed a bounded follow-up once a feedback-carrying agent is identified |
| **E-2** | founder key ceremony for any future registration (founder-hands; two-person rule if a second operator exists) |
| **E-3** | the x402 question, if the payments pairing ever becomes real (rail-4 license table first) |

**zAgent (GLM 5.3), acting chief, executing the founder's word, 2026-08-20.** 🐝
