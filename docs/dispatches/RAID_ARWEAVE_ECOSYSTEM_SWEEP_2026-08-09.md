# RAID — ARWEAVE ECOSYSTEM SWEEP (2026-08-09)
**Authority:** Seat 1 (goose holding for Fable), founder directive
**Source:** compass boarding artifact + GitHub API verifications + training knowledge (labeled)
**Doctrine:** L-VERIFY, TAKE/LEAVE/PATTERN, four axes, adoption gate vs integration gate

## THE CAPTURE PATTERN (from compass artifact, CONFIRMED)
Arweave base layer = permissionless, sound (one-time payment, endowment-funded permanent storage).
Every friction BNR encountered sits in the WRAPPER LAYER: hosted services + new tokens over the base.
Each wrapper introduces (a) hosted endpoints (b) new tokens (ARIO, AO, WNDR, IRYS).
ESCAPE HATCH: arweave-js (MIT) + arbundles (ANS-104) + self-hosted ar-io-node (AGPL) + native JWK.
RULE: build on the base layer primitives; treat wrapper layers as STUDY PATTERNS, never as dependencies.

## RAID TABLE — ALL NAMED PROJECTS

| Project | License | Verdict | Why | Source |
|---|---|---|---|---|
| arweave-js | MIT (VERIFIED) | **TAKE** | Base primitive; sovereign AR transactions; already in atmirror | GitHub API |
| arbundles / ANS-104 | MIT (TRAINING) | **TAKE** | DataItem creation; self-signed uploads without Turbo | Training (needs L-VERIFY) |
| Verto/flex | MIT (VERIFIED) | **TAKE** | Embeddable order book; could power resource-wallet trading/funding | GitHub API |
| Wander injected-API | MIT (VERIFIED) | **PATTERN** | window.arweaveWallet + custom-gateway config; take the pattern, leave the token | Compass artifact |
| Sarcophagus | UNKNOWN | **REVIEW** | Deadman's switch concept = directly relevant to succession; need license + arch | Founder flag |
| ARNS / arns.ar.io | UNKNOWN | **PATTERN** | Name system parallels .b; token-gated (ARIO) = study resolution, leave the gate | Founder flag |
| ANS / ans.gg | UNKNOWN | **PATTERN** | AR-native naming; study the approach vs our .b resolver | Founder flag |
| KYVE | UNKNOWN | **REVIEW** | Data verification layer; founder says same design, more professional | Founder flag |
| decent.land | UNKNOWN | **REVIEW** | Founder says looks good; need license + architecture verification | Founder flag |
| load.network | UNKNOWN | **REVIEW** | Post-cloud architecture; founder says similar to us; cloud.load.net login = hosted? | Founder flag |
| AO Wallet | UNKNOWN | **REVIEW** | Wallet UX; founder interested in downloading; need to verify open-source status | Founder flag |
| nest.land | UNKNOWN | **PATTERN** | Package registry on permaweb; dual-use AR pattern; study the metadata approach | Founder flag |
| Gitcoin | UNKNOWN | **PATTERN** | Quadratic funding concept; not AR-specific but relevant to b-tokenomics design | Founder flag |
| ARWiki | UNKNOWN | **REFERENCE** | Documentation surface; will use for OsE/iq.wiki formalization later | Founder flag |
| Deadman's switch (permaweb) | UNKNOWN | **REVIEW** | Specific app on permaweb; concept relevant to succession dead-man design | Founder flag |
| Wander / ArConnect | MIT (VERIFIED) | **LEAVE** (token) | $WNDR = fee-tier wrapper; take MIT code pattern, leave the economics | Compass artifact |
| Irys | NULL/ABSENT | **LEAVE** | Pivoted OFF Arweave to own L1 datachain; not our rail | GitHub API |
| ar.io / ARIO | UNKNOWN | **LEAVE** | Gateway network with 10K ARIO minimum stake = centralized gate | Compass artifact |
| AO compute | UNKNOWN | **LEAVE** (for now) | 21M token, halving economics; may revisit for compute later | Compass artifact |
| Glacier | UNKNOWN | **LEAVE** | Vaporware per founder | Founder annotation |
| 4EVERLAND | UNKNOWN | **LEAVE** | Sounds similar = likely hosted wrapper over AR | Founder annotation |
| Paragraph | UNKNOWN | **LEAVE** | Paid service with AR backend (custodial model) | Founder annotation |
| everPay / everVision | UNKNOWN | **LEAVE** | Custodial bridge payment layer | Compass artifact |

## TOP 5 TAKE CANDIDATES — DEEPER REVIEW NEEDED

### 1. Sarcophagus (deadman's switch) — HIGHEST PRIORITY
- CONCEPT: dead-man's switch on Arweave — encrypted payload released on signer failure to check in
- RELEVANCE: directly parallels our succession dead-man (eosio.msig + delay_sec); study the trigger mechanism
- NEEDS: GitHub license verification (sarcophagus-org repo moved), architecture review, escrow pattern analysis
- FOUNDER: '1st class value'

### 2. Verto/flex (MIT, VERIFIED) — READY FOR ADOPTION GATE
- CONCEPT: embeddable, programmable order book framework
- RELEVANCE: resource wallet management dashboard; b/A trading; could power the spend-receipt settlement
- LICENSE: MIT, VERIFIED from GitHub API (useverto/flex)
- NEXT: integration-gate assessment (does it fit atmirror's Rail trait?)

### 3. ARNS — STUDY THE PATTERN, LEAVE THE TOKEN
- CONCEPT: Arweave Name System — permaweb domains resolved via ar.io gateways
- RELEVANCE: directly parallels .b registry; study the resolution model (permaweb vs our Merkle-tree anchor)
- TOKEN GATE: requires ARIO for registration; 10K ARIO gateway stake = centralized
- PATTERN: how do they handle name resolution, expiry, renewal? Compare to our R0-R6 validity rules

### 4. KYVE — DATA VERIFICATION LAYER
- CONCEPT: protocol-level data verification with incentivized validators
- RELEVANCE: could serve as a foreign oracle for our atmirror verification (CLAUDE.md §5: verify against foreign oracle)
- NEEDS: license verification, architecture review, integration-path assessment
- FOUNDER: 'same design, little more professional'

### 5. AO Wallet — WALLET UX
- CONCEPT: smooth wallet UI for Arweave/AO
- RELEVANCE: founder wants resource management dashboard; wallet UX patterns applicable
- NEEDS: verify open-source status, license, self-hostability
- FOUNDER: 'thinking of downloading and running it'

## THE ESCAPE HATCH (confirmed from compass artifact + GitHub)
BNR's sovereign path EXISTS today:
1. arweave-js (MIT, VERIFIED) — native AR transactions, no gateway dependency
2. arbundles / ANS-104 (MIT, needs L-VERIFY) — self-signed DataItems, no Turbo bundler required
3. ar-io-node (AGPL-3.0) — self-hosted gateway; or direct node reads
4. Native JWK keyfiles — no Wander/ArConnect browser extension required
5. Turbo CLI/SDK — for uploads where Turbo's bundling is needed (per-claimant x-paid-by, verified)

## WHAT NEEDS THE FOUNDER
- Decision on Sarcophagus study (deadman's switch = succession-relevant)
- Decision on Verto/flex integration (order book = resource dashboard)
- Decision on KYVE as foreign oracle candidate
- AO Wallet: try it (founder's call; no security concern if keys stay local)

## SCOPE FENCE
This sweep covers the founder's named projects + the capture-pattern analysis from the compass artifact.
The Viewblock ecosystem page (viewblock.io/arweave/ecosystem) is JavaScript-rendered and could not be
scraped via curl — needs a browser session for the full list. Projects on that page that are NOT named
above need individual RAID when identified.

**Execute the prompt as written.**