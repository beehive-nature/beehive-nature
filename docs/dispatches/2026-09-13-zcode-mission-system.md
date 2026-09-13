# THE MISSION SYSTEM — supervised autonomy as three stations (LOVErnment · off-chain first rail)

**Lane:** zcode-missions · **Seat:** zCode (bFUzZ) · **Date:** 2026-09-13
**Founder order:** build the supervised-autonomous-mission system for skaists.dev — every
operation a supervised mission, the proposal shape exactly as dictated (mission/team/
resources/finance/controls), the ten-step loop, the six human levers, the five never-laws,
first implementation off-chain in Buzz with testnet accounting, ERC20i/reputation/escrow
later. Respect the three toggled UX views (new bee · raver · cypherpunk). The OR board
(founder-named, already far along in the polish lane) is included as the live-roster station.

## What landed — three new surfaces, one shared engine

| station | file | what it does |
|---|---|---|
| the mission desk | `surfaces/missions.html` | proposal registrar: the docket, the full envelope (YAML in the founder's shape), budget & tithe calculator, independent review, ceiling approval, change orders, stop, final report (projected vs actual), reputation |
| the Buzz mission room | `surfaces/mission-room.html` | execution: team roster (BNR color law), planner's work-unit board, the receipt feed, the milestone evaluator (continue/pause/escalate), treasury releases, founder levers |
| the receipt ledger | `surfaces/receipts.html` | the machine-readable station: every receipt filterable, sha-256 chain verified on load (and loudly broken on tamper), JSON export/copy, reputation + spend-vs-ceiling boards |
| the engine | `surfaces/mission-core.js` | schema, state machine, budget/tithe math, chain recipe, evaluator (a pure function of the ledger), storage adapter — node-requireable so the seed generator cannot drift from the browser |
| the seed | `surfaces/mission-seed.js` ← `scripts/build-missions-seed.mjs` | deterministic ledger: 3 missions, 39 chained receipts, node:crypto through the same engine; every hash line carries the same-line PUBLIC-CONSTANT marker |
| live roster | `surfaces/or-board.html` | UNTOUCHED — linked as the fourth station (live presence is its job, keyless relay door); the polish lane's PR #76 rides independently |

## The shape, kept

The desk renders proposals exactly as dictated — `mission:` (id/title/objective),
`team:` (lead, agents with model+role, human_attending), `resources:` (api_estimate
by model, compute, external_services, human_review_hours, contingency_percent,
tithe_percent), `finance:` (operating/contingency/bnr_tithe/requested_total/currency),
`controls:` (spending_ceiling, milestone_release, production_access, secrets_access,
human_escalation_required_for: the founder's four, verbatim order). The calculator
re-prices live (contingency/tithe defaults 10% — THE TITHE is founder-word-only law);
requested total = operating + contingency + tithe; ceilings are human-approved and the
evaluator refuses any release that would leave the envelope.

## The loop, in code

draft → budget → review → **ceiling approved (human)** → fund M1 → work in the room
(units, handoffs, tool costs — each a receipt) → independent verification → evaluator
(continue / pause / escalate) → treasury release or escalation → final report →
reputation. Stop and change-order are legal at any moment; every lever appends a
chained receipt before the state moves (`applyControl()` is the only state-changing
door). The never-laws are enforced structurally: releases need funded/active state +
headroom + no open escalation; production_access=false froze seed mission 003 into
ESCALATE — the guardrail demo, live on the room surface.

## Seed ledger (all figures fixtures, testnet accounting — labeled on every surface)

- `bnr-op-2026-001` "Improve Raver music-room adoption" — COMPLETE; modelled on the real
  PR #75 music-room mission. $59.04 actual of $70 ceiling vs $69.70 projected; tithe
  computed on actuals; reputation 3/3/100%.
- `bnr-op-2026-002` "Watch-room second screen" — IN REVIEW, awaiting the human ceiling
  (the desk's approve lever is the demo).
- `bnr-op-2026-003` "Autonomi fence readiness" — ESCALATED: a work unit requested
  production access outside the envelope; the room paused and called the human.

## Three registers, one set of facts (founder canon 2026-08-28)

bee — calm light canvas, the five-step "how a mission runs" walk, plain labels.
raver — poster type, first-party SVG art (the loop ring / the crew orbit / the chain),
motion that pauses (and pauses itself for prefers-reduced-motion).
cypherpunk — terminal density, boundary/evidence card leads, YAML open by default.
Same ledger, same math, same states in all three — verified by e2e (titles identical
across registers; registers asserted on the body). BNR color law named in the legend
on every surface: purple = humans, teal = Ai, green = biomass.

## i18n

30 new keys (`missions.*` / `missionroom.*` / `ledger.*`) × 28 docked tongues,
machine-drafted ⚙, recorded in `_meta.drafted` (the `room.*` namespace was taken by
the two-tab room — re-keyed to `missionroom.*` before merge). Coverage floors entered
for the three pages (8 / 9 / 10 keyed). Unkeyed deep body stays English — the recorded
backlog, like every surface; the polish lane is the rail for that.

## Verification (all local, this worktree)

- `e2e/zcode-missions-check.mjs` — **72/72**: zero page errors × 3 stations × 3
  registers; chain VERIFIED everywhere; total spend $66.01 from receipts; approve
  ceiling → receipt #40 `ceiling.approve`, chain still green; ESCALATE room refuses
  release; human stop → `control.stop` receipt; export parses, sequences 1..n; a quiet
  edit breaks the chain loudly at #6; 390px zero horizontal overflow × 6; shots in
  `e2e/shots-missions/` (6 files, 390px bee+raver per station).
- `scripts/estate-check.mjs` PASS — 98 counted · 107 listed, hub embed in sync.
- `node --test` register/review-views/atlas/no-dead-host/lang-coverage/music-cleanup/
  university-views — 69/69.
- `e2e/university-smoke.mjs` 87/0 — deck covers 98, footer matches tree, reachability ✓.
- `e2e/no-page-errors.mjs` 107 walked · 0 errors.
- `e2e/i18n-coverage.mjs --set … --floors` PASS.
- `node scripts/build-missions-seed.mjs --check` — committed seed reproducible.

## Honest boundaries (named on the surfaces, repeated here)

Off-chain, local-first: the ledger is a deterministic seed + your browser's edits; the
Buzz relay wire (proposal/receipt envelopes over community rooms) is DESIGNED, not
built — no socket is opened on any of the three pages. Testnet accounting only: no
token, wallet, or chain is touched; ERC20i treasury, on-chain escrow and reputation
settlement are later rails. Every figure is a fixture, not a measurement (dao-dashboard
law). The OR board owns live presence; the mission room's roster is ledger-local by design.

## Flags

- The university-smoke + estate-check gates were verified against the REGENERATED hub;
  estate-source's hub check compares against HEAD by construction and can only pass
  post-commit (it restores HEAD's hub when they differ — this bit me twice mid-lane;
  the final commit carries the regenerated hub so CI sees them equal).
- `mission-seed.js` carries 39 sha-256 chain hashes, each on a same-line
  PUBLIC-CONSTANT marker (public constants, never secrets — pre-commit hex law).

Co-authored-by: bFUzZ <bGoose@agents.skaists.dev>
