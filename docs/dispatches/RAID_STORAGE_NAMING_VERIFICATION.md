# RAID — STORAGE + NAMING + VERIFICATION AXIS (goose, Seat 1)
**Source:** GitHub API verifications (2026-08-09) + compass boarding artifact
**Doctrine:** L-VERIFY from repo, four axes, capture-pattern test, TAKE/LEAVE/PATTERN

## 1. arweave-js — TAKE (CONFIRMED)
- **Repo:** ArweaveTeam/arweave-js
- **License:** MIT (VERIFIED from GitHub API, SPDX: MIT)
- **What:** Browser/Node client for Arweave protocol — transactions, gateway reads, JWK crypto
- **Capture test:** PASS — permissionless base layer, no token, no hosted dependency
- **Four axes:** Code: mature, TypeScript, MIT. Community: official team repo. Compatibility: already in atmirror. Synergy: sovereign AR path.
- **TAKE:** already adopted. Pattern to extract: gateway fallback chain, JWK generation (`arweave.crypto.generateJWK()`), transaction signing without any wrapper.

## 2. arbundles / ANS-104 — TAKE
- **Repos:** DHA-Team/arbundles, ar-io/arbundles, Irys-xyz/arbundles (all Apache-2.0)
- **License:** Apache-2.0 (VERIFIED from GitHub API, SPDX: Apache-2.0)
- **What:** ANS-104 DataItem creation + signing — self-upload to any Arweave node without Turbo bundler
- **Capture test:** PASS — self-hostable, no token, no hosted endpoint required. The escape hatch from Turbo dependency.
- **Four axes:** Code: TypeScript, Apache-2.0, three maintained forks. Community: ar-io + Irys + DHA-Team all maintain. Compatibility: native to our atmirror DataItem pipeline. Synergy: eliminates the Turbo hosted-endpoint dependency for uploads.
- **TAKE:** adopt as the sovereign DataItem path. Turbo stays as an optional accelerator (per-claimant x-paid-by), not a dependency. **Mirror requirement:** pin a specific commit in our Cargo.toml/npm deps.
- **PATTERN for BNR:** this is the architectural lesson — the bundling layer should be self-hostable, not hosted. Our pipeline already constructs DataItems client-side (epoch_pipeline.py); arbundles proves the self-upload path works without a third-party bundler.

## 3. ARNS (Arweave Name System) — PATTERN (LEAVE the token gate)
- **Repo:** ar-io/ant-pilot (ANT = Arweave Name Token contract)
- **License:** AGPL-3.0 (VERIFIED from GitHub API, SPDX: AGPL-3.0)
- **What:** Permaweb domain system — names resolved via ar.io gateway network; registration requires ARIO token
- **Capture test:** FAILS token gate (ARIO required for registration; 10K ARIO gateway stake). FAILS hosted test (resolution depends on ar.io gateways). AGPL-3.0 = copyleft (adoption consideration for any derivative).
- **Four axes:** Code: Smartweave contracts, AGPL. Community: ar.io team. Compatibility: resolution model parallels .b but uses a different substrate (Smartweave vs our Merkle tree anchor). Synergy: naming patterns, not code.
- **PATTERN (LEAVE the implementation):** Extract: (1) how they handle name expiry + renewal (compare to our R2/R3/R5 365-day term + 28-day grace); (2) how resolution works (gateway-resolved Smartweave vs our off-chain Merkle resolver — our model is stronger: no gateway dependency, resolver is pure function); (3) their ANT (Arweave Name Token) concept — a transferable name token. Our .b is non-transferable (owner keypair bound); their model allows trading names. **State for the record:** our anchor-based resolver is architecturally superior (no gateway dependency, O(1) on-chain, O(names) off-chain) vs ARNS's gateway-dependent Smartweave resolution.

## 4. ANS (Arweave Name Service, decent.land) — PATTERN
- **Repos:** decentldotland/ANS (MIT), decentLand/ans-arweave (MIT), decentldotland/ans-js-sdk (MIT)
- **License:** MIT (VERIFIED from GitHub API, SPDX: MIT — all three repos)
- **What:** Decentralized name service for Arweave wallets — alternative to ARNS, no ARIO gate
- **Capture test:** PASS — MIT, no token requirement, no hosted gate (resolution via Arweave transactions directly)
- **Four axes:** Code: MIT, multiple repos (contract + SDK + stats). Community: decent.land team. Compatibility: Arweave-native, clean license. Synergy: naming patterns relevant to .b.
- **PATTERN:** Extract: (1) how they resolve names without a gateway (if truly on-chain resolution, this is architecturally cleaner than ARNS); (2) their registration flow (no token = simpler than ARNS); (3) compare to our .b resolver — does their model have anything we're missing? **Note:** decent.land (the org behind ANS) is also in Cowork's axis — coordinate on the full decent.land assessment.

## 5. KYVE — REVIEW / TAKE CANDIDATE
- **Repos:** KYVENetwork/chain (MIT), KYVENetwork/kyvejs (Apache-2.0)
- **License:** MIT (chain) + Apache-2.0 (SDK) — BOTH VERIFIED from GitHub API
- **What:** Protocol-level data validation with incentivized validators; a Cosmos SDK chain that archives and validates data from other chains
- **Capture test:** PARTIAL — has its own token ($KYVE) for validator incentives, but the VERIFICATION CONCEPT is patternable without the token. The chain itself is permissionless (Cosmos SDK). Token gates validator participation, not data access.
- **Four axes:** Code: MIT + Apache-2.0, Cosmos SDK (Go + TypeScript). Community: active, mainnet live. Compatibility: verifies Arweave data (direct synergy with atmirror). Synergy: HIGH — CLAUDE.md §5 mandates 'verify against a foreign oracle, never against our own code.' KYVE IS a foreign oracle for Arweave data.
- **TAKE CANDIDATE (needs deeper review):** KYVE as a foreign oracle for Arweave data verification is architecturally aligned with our standing doctrine. The token ($KYVE) gates who validates, not who reads — so data access remains permissionless. **Next step:** assess whether KYVE's verification model can be used as the foreign oracle in atmirror's pipeline without depending on KYVE's hosted endpoints. If yes → TAKE. If KYVE requires their chain to verify → PATTERN only.

## 6. nest.land — PATTERN
- **Repo:** nestdotland/nest.land (MIT)
- **License:** MIT (VERIFIED from GitHub API)
- **What:** Package registry on Arweave permaweb — Deno modules published and resolved immutably
- **Capture test:** PASS — MIT, no token, uses Arweave base layer directly
- **Four axes:** Code: MIT, TypeScript/Deno. Community: modest but active. Compatibility: Arweave-native. Synergy: MEDIUM — the pattern of anchoring package metadata to immutable storage + resolving versions from the anchor is relevant to our bDiD record resolution.
- **PATTERN:** Extract: how they anchor package metadata (name, version, source hash) to Arweave and resolve it client-side. Compare to our signed-record → Merkle leaf → epoch root → on-chain anchor resolution chain. The nest.land pattern is simpler (single transaction per version) vs our layered model (record → leaf → tree → root → commit). Our model is stronger for scale.

## 7. ARWiki — REFERENCE
- **What:** Wiki documentation on Arweave permaweb
- **Verdict:** REFERENCE only. Structure is relevant for when we formalize OsE with iq.wiki. Not a code adoption target. Note for later: how they organize community-maintained documentation on immutable storage.

## 8. Gitcoin — PATTERN
- **What:** Quadratic funding platform for open-source (Ethereum-based, not Arweave-specific)
- **Verdict:** PATTERN only. Extract: quadratic funding formula (how matching pools amplify many small contributions over few large ones). Relevant to b-tokenomics design (how b rewards distribute for community participation). Sybil resistance approach (passport/identity). Not a code adoption — concept extraction only.

## SUMMARY — MY AXIS

| Project | License (L-VERIFY) | Verdict | Key extraction |
|---|---|---|---|
| arweave-js | MIT ✅ | TAKE | Gateway fallback, JWK crypto, sovereign transactions |
| arbundles/ANS-104 | Apache-2.0 ✅ | TAKE | Self-signed DataItems without Turbo (escape hatch) |
| ARNS | AGPL-3.0 ✅ | PATTERN | Name expiry/renewal model; LEAVE ARIO token + gateway dep |
| ANS (decent.land) | MIT ✅ | PATTERN | Gateway-free resolution; no token gate |
| KYVE | MIT + Apache-2.0 ✅ | TAKE CANDIDATE | Foreign oracle for Arweave data (CLAUDE.md §5) |
| nest.land | MIT ✅ | PATTERN | Package metadata anchoring on permaweb |
| ARWiki | — | REFERENCE | Doc structure for OsE/iq.wiki later |
| Gitcoin | — | PATTERN | Quadratic funding for b-tokenomics |

## ARCHITECTURAL FINDING
Our anchor-based resolver (signed record → Merkle leaf → epoch root → on-chain commit) is
architecturally STRONGER than both ARNS (gateway-dependent Smartweave) and ANS (direct
transaction resolution). We require zero gateway reads for resolution (the Merkle proof is
self-contained). Neither ARNS nor ANS can make that claim. The ecosystem's naming systems
validate our design rather than competing with it.

## WHAT NEEDS DEEPER REVIEW (token-budget permitting)
1. KYVE integration path — can we use KYVE verification without depending on their chain?
2. arbundles self-upload — benchmark: does self-uploading to a raw Arweave node actually work
   reliably without Turbo's bundling, or is Turbo structurally necessary for throughput?

**Execute the prompt as written.**