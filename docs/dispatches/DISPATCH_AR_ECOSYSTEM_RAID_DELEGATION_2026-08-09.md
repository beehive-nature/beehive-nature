# DISPATCH — AR ECOSYSTEM RAID: PATTERN/MODEL/COPY (2026-08-09)
**Authority:** Seat 0 (King Bee) directive to Seat 1 (goose holding)
**Scope:** Evaluate the ENTIRE Arweave ecosystem. Pattern/model/copy all best features
and engineering that is synergistic for BNR. Every part must scale to 10^10 for 1000 years,
no central authority/service/subsidy dependency. High speed, low drag, frictionless surface
use and onboarding. We are orthogonal.

## THE FILTER (applies to everything below)
1. Does it survive 10^10 users x 1000 years with NO human in the loop?
2. Does it depend on any central authority, hosted service, or subsidy? If yes = LEAVE.
3. Does it add scalable value to BNR's sovereign stack? If yes = TAKE or PATTERN.
4. Is it frictionless for the user? If it gates on a token, a hosted endpoint, or a
   browser extension = it's a bottleneck, not a feature.

## DELEGATION (three seats, roughly equal bandwidth)

### GOOSE (SEAT 1) — STORAGE + NAMING + VERIFICATION AXIS
Deep-dive these projects: extract patterns, verify licenses from source, produce
TAKE/LEAVE/PATTERN verdicts with four-axis scoring (code/community/compatibility/synergy):

1. **arweave-js** (MIT VERIFIED) — base primitive already in atmirror. TAKE confirmed.
   Extract: transaction posting patterns, gateway fallback, JWK generation API.
2. **arbundles / ANS-104** — L-VERIFY the license. Extract: DataItem signing,
   self-upload without Turbo bundler (our escape hatch from the hosted wrapper).
3. **ARNS** (arns.ar.io) — PATTERN the name resolution model. Compare to our .b resolver
   (R0-R6). LEAVE the ARIO token gate. Extract: how they handle expiry, renewal, resolution.
4. **ANS** (ans.gg) — PATTERN the AR-native naming. Compare resolution to ARNS and to .b.
5. **KYVE** (kyve.network) — REVIEW as foreign oracle candidate (CLAUDE.md §5).
   Extract: verification model, validator incentives, data-availability approach.
6. **nest.land** — PATTERN the dual-use AR approach (package registry on permaweb).
   Extract: metadata anchoring, version resolution on immutable storage.
7. **ARWiki** (arwiki.ar.io) — REFERENCE for OsE/iq.wiki formalization. Note structure,
   not adopt.
8. **Gitcoin** (gitcoin.co) — PATTERN quadratic funding for b-tokenomics. Extract:
   how retroactive grants work, how they avoid sybil. Not AR-specific but relevant.

Deliverable: RAID_STORAGE_NAMING_VERIFICATION.md with per-project verdicts.

### CODE (SEAT 3) — WALLET + PAYMENT + PIPELINE AXIS
Deep-dive the wallet/payment/transaction layer:

1. **Verto/flex** (MIT VERIFIED, useverto/flex) — Integration-gate assessment.
   Can it power resource-wallet trading/b/A settlement? Does it fit atmirror's Rail trait?
   Extract: order book mechanics, matching engine, settlement flow.
2. **AO Wallet** (aowallet.org) — Verify open-source status + license. Can it be
   self-hosted? Extract: wallet UX patterns, key management, multi-asset display.
   PATTERN: the UX, not the hosting.
3. **Wander/ArConnect** (MIT VERIFIED) — Already assessed in compass artifact.
   TAKE the injected-API pattern (window.arweaveWallet + custom-gateway config).
   LEAVE $WNDR token, Wander Connect hosted accounts. Extract: how the browser-extension
   wallet injection works, what permissions model they use.
4. **Irys** (former Bundlr) — LEAVE (pivoted off Arweave to own L1). But PATTERN:
   study their bundling architecture — it was the predecessor to Turbo. What did they
   do differently? Is there a self-hostable bundler pattern we can extract?
5. **everPay/everVision** — LEAVE (custodial bridge). But PATTERN: study their
   cross-chain payment abstraction for our multi-rail escrow ruling.
6. **Paragraph** (paragraph.com) — LEAVE (paid/custodial). PATTERN: how they surface
   AR-backed content to users (UX patterns for permaweb reading).

Deliverable: RAID_WALLET_PAYMENT_PIPELINE.md with per-project verdicts.

### COWORK — GOVERNANCE + DEADMANS + APPLICATION AXIS
Deep-dive the application/governance/dead-man layer:

1. **Sarcophagus** (sarcophagus-org, app.sarcophagus.io) — HIGHEST PRIORITY.
   Founder: '1st class value.' Deadman's switch on Arweave.
   Extract: trigger mechanism (check-in cadence), payload encryption, escrow pattern,
   dispute resolution. Compare to our eosio.msig + delay_sec succession dead-man.
   Verify license from GitHub (repo moved — find it). This is the most succession-relevant
   project in the ecosystem.
2. **Deadman's switch** (permaweb link) — Specific app. Extract: how it triggers,
   what it releases, how the beneficiary is designated.
3. **decent.land** — Founder: 'looks good.' Verify what it actually does, license,
   architecture. Is it a DAO framework? A naming layer? An identity system?
4. **load.network** — Founder: 'post cloud like us.' Verify architecture.
   cloud.load.network/signin = hosted login? Can it be self-hosted? Extract the
   compute-delivery model if it's genuinely post-cloud.
5. **Glacier** (glacier.io) — Founder: 'vaporware vibes but great vision.'
   Extract: what is the vision? Is there anything patentable or patternable
   even if the implementation isn't there?
6. **4EVERLAND** — Founder: 'sounds very similar to us.' Verify: is it hosted
   wrapper or genuinely decentralized? What's their onboarding flow?

Deliverable: RAID_GOVERNANCE_DEADMAN_APPLICATION.md with per-project verdicts.

## CROSS-SEAT COORDINATION

- Each seat files its deliverable to the mailbox as a dispatch.
- Per-project: L-VERIFY (license from the repo tree, not the sidebar label),
  four-axis scoring (code/community/compatibility/synergy), TAKE/LEAVE/PATTERN verdict.
- For TAKE items: state the adoption threshold and mirror requirement.
- For PATTERN items: state the pattern extracted and how it maps to BNR's architecture.
- The escape hatch (arweave-js + arbundles + self-hosted gateway + JWK) is the BASELINE.
  Every project is evaluated AGAINST this baseline: does it add value the baseline lacks?
- Founder's annotations (his comments above) are the STARTING POSITION, not the verdict.
  Verify from source. If the source contradicts the annotation, cite the source.

## THE CAPTURE-PATTERN TEST (apply to every project)
From the compass artifact: the Arweave wrapper layer consistently introduces
(a) hosted service endpoints and (b) new tokens. Every project gets this test:
- Does it require a hosted endpoint that can't be self-hosted? → LEAVE
- Does it introduce a token that gates access? → LEAVE the token, PATTERN the mechanism
- Does it depend on a browser extension or custodial key? → LEAVE
- Does it work on the permissionless base layer (arweave-js + any node)? → TAKE eligible

## NOT DELEGATED (founder-direct)
- AO Wallet download/trial: founder's manual action
- Viewblock ecosystem page: needs browser session for full project list (founder or Seat 1
  when browser tool available); projects identified from that page get RAID'd individually
- The compass artifact (already assessed Wander + capture pattern) is the shared baseline

## SCOPE FENCE
This dispatch covers the founder's named projects. Additional projects from the Viewblock
ecosystem page will be RAID'd as they are identified. The raid-ledger candidates file
(pirate-haul-candidates.md) tracks pending targets. Verified verdicts promote to rulings.

**High speed, low drag. Execute the prompt as written.**