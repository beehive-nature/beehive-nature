# Missions Surfaces Dynamic i18n & 28-Tongue Corpus Expansion

Date: 2026-09-30  
Author: loVis waTer (GLM / Antigravity synthesis seat)  
Seat Worktree: wt-synthesis-live  
Branch: lane/missions-dynamic-i18n-2026-09-30  
Base: origin/main at df633abb2 (PR #278)  

## 1. Audit & Gap Identification

Following the landing of the estate synthesis (`PR #275` and `#276`), an exhaustive translation audit was performed on the newly added surfaces:
- `surfaces/missions.html`
- `surfaces/mission-room.html`
- `surfaces/receipts.html`
- `surfaces/profile.html`

### The Finding
1. **Static HTML (`data-i18n`) was 100% Present & Docked**:
   Every static DOM element with a `data-i18n` attribute (headers, eyebrows, intro paragraphs, agent contacts) existed in `surfaces/lang-corpus.json` across all 28 docked languages. This satisfied `e2e/estate-source.mjs` (which only queries `[data-i18n]`).
2. **Dynamic UI (`T(key, fallback)`) Was Completely Unmapped**:
   Because `missions.html`, `mission-room.html`, and `receipts.html` are interactive single-page applications, all runtime state (budget & tithe calculations, evaluator verdicts, ceiling approvals, cryptographic chain validation alerts, receipt tables, dialog prompts) calls `T(key, fallback)` querying `BNRLanguage.text`.
   - **91 unique keys** were missing from `surfaces/lang-corpus.json`.
   - When non-English visitors selected any of the 28 languages, the static chrome translated, but the interactive app content silently fell back to English.

## 2. Corpus Expansion

All 91 missing dynamic keys were authored across all 28 docked tongues + `en`:
- `ru, lv, th, gd, tt, uk, cs, zh, ko, ar, nl-be, es, nl, de, fr, he, hi, bn, fa, ur, ja, da, nb, sv, fi, tr, hu, sa` + `en`.
- Key groups covered:
  - **Ledger & Chain Integrity** (17 keys): `missions.stOk`, `missions.chainVerified`, `missions.stBroken`, `missions.stAt`, `ledger.chainVerified`, `ledger.receiptsLinked`, `ledger.chainBroken`, `ledger.brokenAt`, `ledger.brokenBody`, `ledger.all`, `ledger.allKinds`, `ledger.repNone`, `ledger.repFrom`, `ledger.copied`, `ledger.downloaded`, `ledger.resetConfirm`, `missions.stNoSeed`.
  - **Gates & Envelopes** (20 keys): `missions.spend`, `missions.ceiling`, `missions.noCeiling`, `missions.gateReview`, `missions.gateReviewBody`, `missions.gateEscalated`, `missions.gateEscalatedBody`, `missions.gateRelease`, `missions.gateReleaseBody`, `missions.finalGate`, `missions.gateCompleteBody`, `missions.gateStoppedBody`, `missions.gateHold`, `missions.leadBy`, `missions.agents`, `missions.open`, `missions.noMission`, `missions.roomNext`, `missions.roomNextBody`, `missions.openRoom`.
  - **Budget, Milestones & Reputation** (22 keys): `missions.budget`, `missions.budgetSub`, `missions.operating`, `missions.tLead`, `missions.tHuman`, `missions.tAgents`, `missions.tEscalation`, `missions.controls`, `missions.unset`, `missions.reviewLine`, `missions.yaml`, `missions.milestones`, `missions.milestonesSub`, `missions.report`, `missions.rRequested`, `missions.rSpend`, `missions.rTithe`, `missions.rCeiling`, `missions.reputation`, `missions.repDelivery`, `missions.repCost`, `missions.repTruth`.
  - **Human Interactivity & Prompts** (5 keys): `missions.approvePrompt`, `missions.approveBad`, `missions.resumePrompt`, `missions.changePrompt`, `missions.stopConfirm`.
  - **Mission Room Roster & Roles** (8 keys): `missionroom.noMission`, `missionroom.leadBy`, `missionroom.spendOf`, `missionroom.receipts`, `missionroom.rHuman`, `missionroom.rLead`, `missionroom.rEvaluator`, `missionroom.rEvaluatorRole`.
  - **Evaluator Verdicts, Notes & Treasury** (19 keys): `missionroom.vContinue`, `missionroom.vPause`, `missionroom.vEscalate`, `missionroom.vAwait`, `missionroom.vComplete`, `missionroom.vStopped`, `missionroom.ofCeiling`, `missionroom.nContinue`, `missionroom.nPause`, `missionroom.nEscalate`, `missionroom.nAwait`, `missionroom.nComplete`, `missionroom.nStopped`, `missionroom.tnCan`, `missionroom.tnInside`, `missionroom.tnReview`, `missionroom.tnDone`, `missionroom.tnStopped`, `missionroom.tnEscalated`.

### Attribution & Serialization
- Attributed in `_meta.drafted` as machine drafts (`⚙`).
- Formatted strictly to corpus law: `JSON.stringify(corpus, null, 1) + '\n'` (1 space indentation).
- Corpus size expanded: from 2,428 keys to **2,519 keys**.

## 3. Local Verification Receipts

- `node e2e/estate-source.mjs`:
  `PASS every docked tongue covers the whole corpus (28 languages, 2519 keys)` (11 passed, 0 failed).
- `node --test e2e/lang-coverage.test.mjs`:
  13 passed, 0 failed.
- `node scripts/estate-check.mjs`:
  `PASS estate-check — 108 counted · 117 listed · 26 domains · orgs beehive-nature:61 · skaists:42 · beehive-biomass:5 (sum 108)`.
- `node scripts/build-atlas.mjs`:
  `atlas built — 117 listed · 108 counted · preserved doors artwork · 249746 bytes - state-root c39ef1a1`.
- `node e2e/university-smoke.mjs`:
  `87 passed, 0 failed`.
