# Estate Synthesis & Unfinished Work Integration

Date: 2026-09-30  
Author: loVis waTer (GLM / Antigravity synthesis seat)  
Seat Worktree: wt-synthesis-live  
Branch: lane/synthesis-live-2026-09-30  
Base: origin/main at f1bad02bb (PR #269)  

## 1. Context & Scope

Following an exhaustive estate audit across 407 worktrees and repositories in `C:\Users\travi` and `.buzz\REPOS`, high-value in-progress and unmerged work was triaged and synthesized onto a dedicated integration branch in strict adherence to estate laws (`AGENTS.md`).

Worktree law was strictly followed: no commits were made from `C:\Users\travi\beehive-nature`; all staging, committing, and testing took place in `../wt-synthesis-live`.

## 2. Integrated Feature Lanes

1. **Agent Contacts & bMAILroom** (replayed as commit `65863fb0e` from source `c3865d7bb` authored on `codex/agent-mail-profiles-2026-09-19`):
   - Added Buzz agent team contacts (`BcODexAstRA`, `ZcODe5.3max`, `bFUzZ`) to `surfaces/profile.html` with copyable public keys, mailto fallbacks, and user-activated link to public bMAILroom.
   - 31 `prof.mail.*` i18n keys integrated into `surfaces/lang-corpus.json` across all 28 docked tongues with explicit English fallback entries in `_meta.enfill`.
   - `e2e/agent-mail-profile.test.mjs` passing 4/4 assertions. `e2e/profile-views.test.mjs` passing 18/18 assertions.

2. **Missions Engine & Supervised Autonomy** (replayed as commit `6f6685f08` from source `81edde26d` authored 2026-09-13 on `lane/zcode-missions`):
   - Three operational stations: Mission Desk (`surfaces/missions.html`: proposals, ceilings, human stop), Buzz Mission Room (`surfaces/mission-room.html`: roster, work units, receipts, evaluator, treasury release), and Receipt Ledger (`surfaces/receipts.html`: SHA-256 chained, machine-readable).
   - Shared engine `surfaces/mission-core.js` and deterministic 39-receipt seed `surfaces/mission-seed.js`.
   - 3-register support across all 3 stations (Bee calm, Raver poster, Cypherpunk boundaries).
   - `e2e/zcode-missions-check.mjs` passing 72/72 tests (including 390px, 0px horizontal overflow across all stations).

## 3. Evaluated Candidates (Not Integrated / Dropped)

- **`4cbb1cb39` (vending/wallet persona completion on `codex/vending-wallet-pass-2026-09-19`):**
  Evaluated for cherry-pick; aborted due to extensive three-way conflicts in `surfaces/vending.html` and `surfaces/wallet.html` with subsequent main changes (PRs #225, #269). Conflicting hunks were exported to artifact diffs for a separate isolated lane.
- **`0b50c8142` (messages-zano.proto v0.4 for btrezor on `zano/hf6-proto-v04-2026-09-13`):**
  Evaluated for cherry-pick; skipped because commit `0b50c8142` was already an ancestor in `origin/main` (cherry-pick resulted in empty commit).

## 4. CI Audit & Gate Healing

### A. Static Job: Language Corpus Integrity
- **CI Failure:** Step "Language — corpus integrity (estate-source)" failed:
  `FAIL every data-i18n key in the tree exists in the corpus (1829 keys) — 9 missing, e.g. ledger.eyebrow, ledger.beeLead, ledger.raverLead, ledger.cypherLead, ledger.beeIntro, ledger.raverIntro`
- **Root Cause:** When resolving merge conflicts in `surfaces/lang-corpus.json` during the missions cherry-pick, 9 `ledger.*` keys present in source `81edde26d` were dropped after `missionroom.releaseNext`.
- **Heal (commit `8af22748e`):** Restored all 9 `ledger.*` keys across all 28 docked tongues directly from source commit `81edde26d`. Formatted with canonical 1-space indentation matching `origin/main`. `e2e/estate-source.mjs` PASS (11/0).

### B. Node Job: University Smoke (Review Deck Surface Count)
- **CI Failure:** `FAIL review deck covers every surface (108) and lists the university — deck lists 105, tree holds 108`.
- **Root Cause:** Incomplete surfaces registration ritual: the 3 new missions surfaces (`missions.html`, `mission-room.html`, `receipts.html`) were registered in `estate.json` and atlas, but their entries in `surfaces/review.html` `SURFACES` array were missing (105 listed vs 108 on disk).
- **Heal (commit `d85b5fc03`):** Added `'missions.html','mission-room.html','receipts.html'` to `SURFACES` in `surfaces/review.html`. Verified `e2e/university-smoke.mjs` PASS (87/0, deck covers 108). Confirmed green in GitHub CI on commit `d85b5fc03`.

### C. Eternal Job: Bottom Half Ratchet Baseline
- **CI Failure:** `ratchet: 3 worse · 3 better than footer-audit.baseline.json` on `receipts.html`.
- **Root Cause:** The missions feature (authored 2026-09-13) predated the 2026-09-26 footer ratchet. When initially baselined in commit `d85b5fc03`, counts were sampled from Windows Chromium. Due to font metric differences between Windows and Ubuntu Linux (Playwright runner), 1–2 borderline findings diverged on `receipts.html` (e.g. SMALL 144 vs 146, JUNK 22 vs 23).
- **Heal:** Updated `e2e/footer-audit.baseline.json` to the exact floors measured by the CI Linux runner across all 9 views for `receipts.html`, `mission-room.html`, and `missions.html`.

## 5. Verification & CI Receipts (Local Tree)

- `node scripts/estate-check.mjs`: PASS — 108 counted · 117 listed · 26 domains · orgs beehive-nature:61 · skaists:42 · beehive-biomass:5 (sum 108).
- `node scripts/build-atlas.mjs`: PASS — atlas built · 117 listed · 108 counted · state-root `c39ef1a1`.
- `node e2e/estate-source.mjs`: PASS (11 passed, 0 failed — all 1829 tree keys exist in corpus; 2428 total corpus keys across 28 tongues).
- `node e2e/university-smoke.mjs`: PASS (87 passed, 0 failed — review deck covers 108, footer surface count 108).
- `node --test e2e/lang-coverage.test.mjs`: PASS (13 passed, 0 failed).
- `node --test e2e/agent-mail-profile.test.mjs e2e/profile-views.test.mjs`: PASS (22 passed, 0 failed).
- `node e2e/zcode-missions-check.mjs`: PASS (72 passed, 0 failed).

## 6. Isolated External Repositories

External repositories remain protected and isolated in their respective upstreams:
- `buzz-windows-0524`: Buzz Desktop release 0.5.24 with custom 8 MiB main-thread stack reserve (`/STACK:8388608`) and canary packaging.
- `x0x-622-src`: Saorsa Labs x0x mesh node tracked for David Irvine priority followups (#622 and #505).
