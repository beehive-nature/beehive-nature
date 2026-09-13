#!/usr/bin/env node
/* build-missions-seed.mjs — regenerates surfaces/mission-seed.js.
   Deterministic: fixed timestamps, fixed figures, no clock, no randomness.
   The budget lines and the receipt-chain recipe come from mission-core.js
   itself (required, not duplicated) so seed and browser can never disagree.
   Every figure is an accounting FIXTURE (testnet accounting) — the ledger
   says so on every surface that renders it. Run from the repo root:
     node scripts/build-missions-seed.mjs [--check]
   --check refuses to overwrite when the committed output has drifted. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'surfaces', 'mission-seed.js');
const CHECK = process.argv.includes('--check');

createRequire(import.meta.url)('../surfaces/mission-core.js');
const M = globalThis.BNRMissions;

const CURRENCY = M.CURRENCY_NOTE;
const ESC = M.ESCALATION_REASONS; /* the founder's four, verbatim order */

/* ── the three seed missions ───────────────────────────────────────────────
   001 mirrors the real music-room adoption mission (PR #75) as a completed
   lifecycle; 002 waits in review; 003 sits escalated — a work unit wanted
   production access while controls.production_access is false, so the
   evaluator paused the room and called the human. Figures are fixtures. */

function tokens(astra, glm, grok, fable) {
  return { astra, glm, grok, fable };
}
const m1 = {
  mission: { id: 'bnr-op-2026-001', title: 'Improve Raver music-room adoption', objective: 'Ship and verify the redesigned music surface' },
  team: {
    lead: 'bAiGent-01',
    agents: [
      { model: 'gpt-6-astra', role: 'architecture' },
      { model: 'glm-5.3', role: 'implementation' },
      { model: 'grok', role: 'creative-review' },
      { model: 'fable', role: 'research' }
    ],
    human_attending: 'founder · LOViS'
  },
  resources: {
    api_estimate: {
      by_model: tokens(
        { in: 12, out: 3, reason: 2 },
        { in: 40, out: 9, reason: 6 },
        { in: 6, out: 1.5, reason: 0.8 },
        { in: 8, out: 2, reason: 1 }
      )
    },
    compute: { runtime_hours: 60, storage_gb: 8, bandwidth_gb: 12 },
    external_services: [],
    human_review_hours: 6,
    contingency_percent: 10,
    tithe_percent: 10
  },
  controls: {
    spending_ceiling: 70,
    milestone_release: true,
    production_access: false,
    secrets_access: false,
    human_escalation_required_for: ESC.slice()
  },
  review: { verdict: 'approved', reviewer: 'independent-review · astra', ts: '2026-09-12T19:40:00Z', note: 'value, feasibility and conflict checks passed; ceiling recommended at the requested total rounded up' },
  milestones: [
    { id: 'M1', title: 'three-view redesign live on main', deliverable: 'music.html — bee / raver / cypherpunk, one set of facts', release_usd: 25.48, state: 'released' },
    { id: 'M2', title: 'corpus keys ×29 tongues', deliverable: 'music.* strings machine-drafted into lang-corpus.json', release_usd: 19.11, state: 'released' },
    { id: 'M3', title: 'independent verification + final report', deliverable: 'e2e walk of all three views, receipts compared', release_usd: 19.11, state: 'released' }
  ],
  work_units: [
    { id: 'W1', title: 'manifest reader + store read adapters', agent: 'gpt-6-astra', state: 'done', artifacts: ['surfaces/manifest-reader.js', 'surfaces/store-reader.js'] },
    { id: 'W2', title: 'three-view surface + BNR color law', agent: 'glm-5.3', state: 'done', artifacts: ['surfaces/music.html'] },
    { id: 'W3', title: 'old-address redirect shim', agent: 'glm-5.3', state: 'done', artifacts: ['surfaces/jams.html'] },
    { id: 'W4', title: 'floor vocabulary attestation pass', agent: 'grok', state: 'done', artifacts: ['docs/RAVER-REGISTER-LAW.md'] },
    { id: 'W5', title: 'adoption research brief', agent: 'fable', state: 'done', artifacts: ['docs/dispatches/'] }
  ],
  state: 'complete'
};

const m2 = {
  mission: { id: 'bnr-op-2026-002', title: 'Watch-room second screen', objective: 'Prove two cameras in the watch room without doubling the meter bill' },
  team: {
    lead: 'bAiGent-01',
    agents: [
      { model: 'gpt-6-astra', role: 'architecture' },
      { model: 'glm-5.3', role: 'implementation' }
    ],
    human_attending: 'founder · LOViS'
  },
  resources: {
    api_estimate: {
      by_model: tokens({ in: 9, out: 2, reason: 1.5 }, { in: 22, out: 5, reason: 3 }, { in: 0, out: 0, reason: 0 }, { in: 4, out: 1, reason: 0.5 })
    },
    compute: { runtime_hours: 34, storage_gb: 20, bandwidth_gb: 40 },
    external_services: [],
    human_review_hours: 2,
    contingency_percent: 10,
    tithe_percent: 10
  },
  controls: { spending_ceiling: 0, milestone_release: true, production_access: false, secrets_access: false, human_escalation_required_for: ESC.slice() },
  review: null,
  milestones: [
    { id: 'M1', title: 'two-camera inlet proven on the box', deliverable: 'second RTMP inlet + rendition ladder, receipted e2e', release_usd: 14.5, state: 'pending' },
    { id: 'M2', title: 'meter pause-not-kill parity for both screens', deliverable: 'session receipts stay single-payer', release_usd: 10.0, state: 'pending' }
  ],
  work_units: [
    { id: 'W1', title: 'inlet topology sketch', agent: 'gpt-6-astra', state: 'queued', artifacts: [] }
  ],
  state: 'review'
};

const m3 = {
  mission: { id: 'bnr-op-2026-003', title: 'Autonomi fence readiness sweep', objective: 'Ready the fence node for member-write verification against 0.18.1' },
  team: {
    lead: 'bAiGent-01',
    agents: [
      { model: 'glm-5.3', role: 'implementation' },
      { model: 'fable', role: 'research' }
    ],
    human_attending: 'founder · LOViS'
  },
  resources: {
    api_estimate: {
      by_model: tokens({ in: 0, out: 0, reason: 0 }, { in: 15, out: 4, reason: 2 }, { in: 0, out: 0, reason: 0 }, { in: 6, out: 1.5, reason: 0.6 })
    },
    compute: { runtime_hours: 22, storage_gb: 24, bandwidth_gb: 30 },
    external_services: [],
    human_review_hours: 3,
    contingency_percent: 10,
    tithe_percent: 10
  },
  controls: { spending_ceiling: 19, milestone_release: true, production_access: false, secrets_access: false, human_escalation_required_for: ESC.slice() },
  review: { verdict: 'approved', reviewer: 'independent-review · astra', ts: '2026-09-12T21:05:00Z', note: 'bounded sweep; ceiling set at the requested total rounded up' },
  milestones: [
    { id: 'M1', title: 'pinned-version verification matrix', deliverable: 'observed-version table with sources', release_usd: 13.09, state: 'funded' },
    { id: 'M2', title: 'member-write repro on the fence', deliverable: 'repro script + receipt', release_usd: 4.36, state: 'pending' }
  ],
  work_units: [
    { id: 'W1', title: 'version pin verification', agent: 'glm-5.3', state: 'active', artifacts: [] },
    { id: 'W2', title: 'deploy fence config to the prod box', agent: 'glm-5.3', state: 'blocked', artifacts: [] }
  ],
  state: 'escalated'
};

/* ── receipts (kind, ts, actor, summary, cost, artifacts, note) ──────────── */
const R1 = [
  ['proposal.draft', '2026-09-12T16:02:00Z', 'glm-5.3', 'mission drafted from the attending human\'s order — objective, team and bounds named', 0, [], ''],
  ['budget.calc', '2026-09-12T16:20:00Z', 'gpt-6-astra', 'budget worksheet computed — api by model, compute, contingency 10%, tithe 10%', 0, [], 'calculator: mission-core.js budget()'],
  ['review.submit', '2026-09-12T16:25:00Z', 'bAiGent-01', 'proposal submitted to independent review with the requested total', 0, [], ''],
  ['review.verdict', '2026-09-12T19:40:00Z', 'independent-review · astra', 'value, feasibility and conflict checks passed — ceiling recommended', 0, [], ''],
  ['ceiling.approve', '2026-09-12T20:05:00Z', 'founder · LOViS', 'spending ceiling approved — the autonomous envelope is set', 0, [], 'human lever, logged like every other act'],
  ['treasury.fund', '2026-09-12T20:10:00Z', 'dao treasury', 'milestone M1 funded — $23.04 against the ceiling', 23.04, [], 'testnet accounting'],
  ['unit.start', '2026-09-12T20:30:00Z', 'gpt-6-astra', 'work unit W1 started — manifest reader + store read adapters', 0, [], ''],
  ['unit.output', '2026-09-12T22:10:00Z', 'gpt-6-astra', 'W1 delivered — bounded readers, hash-checked, fail-closed overrides', 0, ['surfaces/manifest-reader.js', 'surfaces/store-reader.js'], ''],
  ['handoff', '2026-09-12T22:15:00Z', 'gpt-6-astra', 'W1 handed to glm-5.3 for the surface build', 0, [], ''],
  ['unit.start', '2026-09-12T22:20:00Z', 'glm-5.3', 'work unit W2 started — the three-view surface', 0, [], ''],
  ['unit.output', '2026-09-13T01:12:00Z', 'glm-5.3', 'W2 delivered — bee / raver / cypherpunk render one set of facts; BNR color law named in the legend', 0, ['surfaces/music.html'], ''],
  ['unit.output', '2026-09-13T01:20:00Z', 'glm-5.3', 'W3 delivered — old address keeps working as a redirect shim', 0, ['surfaces/jams.html'], ''],
  ['tool.cost', '2026-09-13T01:25:00Z', 'glm-5.3', 'e2e walk + register parity runs — compute metered at fixture rates', 1.44, [], '12 runtime hours × $0.12'],
  ['handoff', '2026-09-13T01:30:00Z', 'glm-5.3', 'W2/W3 handed to grok for creative review', 0, [], ''],
  ['unit.output', '2026-09-13T02:00:00Z', 'grok', 'W4 delivered — raver register read against the native speaker\'s law; floor vocabulary held', 0, ['docs/RAVER-REGISTER-LAW.md'], ''],
  ['verify.pass', '2026-09-13T02:40:00Z', 'independent verification', 'all three views walked headless — identical facts, zero page errors, crafted overrides refused fail-closed', 0, ['e2e/zcode-music-check.mjs'], ''],
  ['evaluator.continue', '2026-09-13T02:45:00Z', 'milestone evaluator', 'M1 verified — spend $24.48 of $70.00; release M2', 0, [], ''],
  ['treasury.release', '2026-09-13T02:46:00Z', 'milestone evaluator', 'milestone M2 released — corpus keys ×29 tongues', 17.28, [], 'testnet accounting'],
  ['unit.output', '2026-09-13T03:30:00Z', 'glm-5.3', 'music.* strings machine-drafted into the corpus, all docked tongues, drafting pass recorded', 0, ['surfaces/lang-corpus.json'], '⚙ machine drafts, no attestation claimed'],
  ['verify.pass', '2026-09-13T03:50:00Z', 'independent verification', 'corpus integrity green — every key exists, every tongue covered, English matches the page', 0, ['e2e/estate-source.mjs'], ''],
  ['evaluator.continue', '2026-09-13T03:55:00Z', 'milestone evaluator', 'M2 verified — spend $41.76 of $70.00; release M3', 0, [], ''],
  ['treasury.release', '2026-09-13T03:56:00Z', 'milestone evaluator', 'milestone M3 released — final verification and report', 17.28, [], 'testnet accounting'],
  ['verify.pass', '2026-09-13T04:20:00Z', 'independent verification', 'final walk green — projected figures compared against receipt sums', 0, [], ''],
  ['evaluator.continue', '2026-09-13T04:25:00Z', 'milestone evaluator', 'M3 verified — all milestones delivered; mission closes', 0, [], ''],
  ['report.final', '2026-09-13T04:30:00Z', 'bAiGent-01', 'final outcome report filed — projected vs actual compared from receipts', 0, [], ''],
  ['rep.update', '2026-09-13T04:31:00Z', 'dao registrar', 'team reputation updated from delivery, cost accuracy and truthful reporting', 0, [], '']
];

const R2 = [
  ['proposal.draft', '2026-09-13T06:10:00Z', 'glm-5.3', 'mission drafted — two cameras, one meter: the constraint is named in the objective', 0, [], ''],
  ['budget.calc', '2026-09-13T06:24:00Z', 'gpt-6-astra', 'budget worksheet computed — bandwidth-led estimate for the second inlet', 0, [], 'calculator: mission-core.js budget()'],
  ['review.submit', '2026-09-13T06:30:00Z', 'bAiGent-01', 'proposal submitted to independent review — awaiting ceiling', 0, [], 'state: review']
];

const R3 = [
  ['proposal.draft', '2026-09-12T20:40:00Z', 'fable', 'mission drafted — fence readiness against the observed 0.18.1', 0, [], ''],
  ['budget.calc', '2026-09-12T20:52:00Z', 'glm-5.3', 'budget worksheet computed — storage-led estimate for the fence loop file', 0, [], 'calculator: mission-core.js budget()'],
  ['review.verdict', '2026-09-12T21:05:00Z', 'independent-review · astra', 'bounded sweep approved — ceiling recommended', 0, [], ''],
  ['ceiling.approve', '2026-09-12T21:15:00Z', 'founder · LOViS', 'spending ceiling approved at $19.00', 0, [], 'human lever, logged like every other act'],
  ['treasury.fund', '2026-09-12T21:20:00Z', 'dao treasury', 'milestone M1 funded — $6.01 against the ceiling', 6.01, [], 'testnet accounting'],
  ['unit.start', '2026-09-12T21:30:00Z', 'glm-5.3', 'work unit W1 started — version pin verification', 0.96, [], '8 runtime hours × $0.12'],
  ['unit.output', '2026-09-13T00:15:00Z', 'glm-5.3', 'W1 delivered — pinned-version table with sources; M2 repro sketched', 0, [], ''],
  ['gate.request', '2026-09-13T00:20:00Z', 'glm-5.3', 'W2 requested production access to deploy the fence config to the prod box', 0, [], 'controls.production_access = false'],
  ['evaluator.pause', '2026-09-13T00:21:00Z', 'milestone evaluator', 'room paused — production access is outside the approved envelope', 0, [], 'the agents never deploy what the human has not unlocked'],
  ['evaluator.escalate', '2026-09-13T00:22:00Z', 'milestone evaluator', 'escalated to the attending human — production_changes requires their word', 0, [], 'awaiting founder decision']
];

/* ── assemble: budgets from the engine, actuals from the receipts ───────── */
function financeFor(m) {
  const b = M.budget(m.resources);
  return {
    operating_cost_estimate: b.operating_cost_estimate,
    contingency_reserve: b.contingency_reserve,
    bnr_tithe: b.bnr_tithe,
    requested_total: b.requested_total,
    currency: 'ERC20i/testnet or fiat-denominated accounting',
    _worksheet: b
  };
}
[m1, m2, m3].forEach(m => { m.finance = financeFor(m); });

/* milestone release figures: 40/30/30 of the OPERATING line, rounded — the
   contingency reserve may simply go unspent, which is the healthy ending.
   The generator derives them so they can never contradict the budget. */
function milestoneSplit(m) {
  const op = m.finance._worksheet.operating_cost_estimate;
  const a = Math.round(op * 0.4 * 100) / 100;
  const b = Math.round((op - a) / 2 * 100) / 100;
  return [a, b, Math.round((op - a - b) * 100) / 100].filter(x => x > 0);
}
m1.milestones.forEach((ms, i) => { ms.release_usd = milestoneSplit(m1)[i]; });
m2.milestones.forEach((ms, i) => { ms.release_usd = [0.6, 0.4].map(f => Math.round(m2.finance._worksheet.operating_cost_estimate * f * 100) / 100)[i]; });
m3.milestones.forEach((ms, i) => { ms.release_usd = milestoneSplit(m3)[i]; });

/* m1's final report: projected from the budget, actual from receipt sums */
const m1Spend = R1.reduce((s, r) => s + (r[4] || 0), 0);
m1.final_report = {
  projected: {
    operating_cost_estimate: m1.finance.operating_cost_estimate,
    contingency_reserve: m1.finance.contingency_reserve,
    bnr_tithe: m1.finance.bnr_tithe,
    requested_total: m1.finance.requested_total
  },
  actual: {
    total_spend: Math.round(m1Spend * 100) / 100,
    tithe_paid: Math.round(m1Spend * 0.10 * 100) / 100,
    unused_ceiling: Math.round((m1.controls.spending_ceiling - m1Spend) * 100) / 100
  },
  milestones_planned: 3,
  milestones_delivered: 3,
  unverified_claims: 0,
  variance_note: 'actuals tracked under projection — the e2e compute came in cheaper than the worksheet feared; every figure on this report is a fixture, not an invoice'
};

/* ── chain the receipts with node:crypto (same recipe as the browser) ───── */
const ledger = {
  v: M.SCHEMA_VERSION,
  currency: CURRENCY,
  fixture_note: 'SEED LEDGER — demonstration data modelled on real lanes (PR #75 music-room adoption; watch-room POC; autonomi fence readiness). Every figure is a fixture, not a measurement. Local edits live in your browser only.',
  missions: [m1, m2, m3],
  receipts: []
};
function push(missionId, rows) {
  for (const [kind, ts, actor, summary, cost, artifacts, note] of rows) {
    const rec = { seq: 0, ts, mission: missionId, kind, actor, summary, cost_usd: cost, artifacts, note };
    const prev = ledger.receipts.length ? ledger.receipts[ledger.receipts.length - 1].hash : '';
    rec.seq = ledger.receipts.length + 1;
    const canon = JSON.stringify({
      seq: rec.seq, ts: rec.ts, mission: rec.mission, kind: rec.kind, actor: rec.actor,
      summary: rec.summary, cost_usd: rec.cost_usd, artifacts: rec.artifacts, note: rec.note
    });
    rec.hash = createHash('sha256').update(prev + '|' + canon, 'utf8').digest('hex');
    ledger.receipts.push(rec);
  }
}
push(m1.mission.id, R1);
push(m2.mission.id, R2);
push(m3.mission.id, R3);

/* the chain must verify under the ENGINE's own verifier before it ships */
const check = M.verifyChain(ledger.receipts);
if (!check.ok) { console.error('seed chain failed to verify under mission-core.js — refusing'); process.exit(1); }

/* ── emit surfaces/mission-seed.js ─────────────────────────────────────────
   One receipt per line; every line carrying a hash carries the same-line
   PUBLIC-CONSTANT marker (chain hashes are public constants, never secrets). */
const head =
`/* mission-seed.js — GENERATED by scripts/build-missions-seed.mjs. Do not hand-edit.
   The deterministic seed ledger for the LOVErnment mission surfaces. Fixture
   figures (testnet accounting), modelled on real lanes; the receipt chain is
   sha-256 verified by mission-core.js on every load. */
`;
const body = '(typeof window!=="undefined"?window:globalThis).BNR_MISSION_SEED = ' + JSON.stringify(ledger, null, 1)
  .split('\n').map(line =>
    /"hash": "[0-9a-f]{64}"/.test(line) ? line + ' // PUBLIC-CONSTANT: public receipt-chain hash (sha-256, not a secret)' : line
  ).join('\n') + ';\n';
const next = head + body;

if (CHECK) {
  const have = readFileSync(OUT, 'utf8');
  if (have !== next) { console.error('mission-seed.js has drifted — run node scripts/build-missions-seed.mjs'); process.exit(1); }
  console.log('mission-seed.js up to date · ' + ledger.receipts.length + ' receipts · head ' + check.head.slice(0, 12));
} else {
  writeFileSync(OUT, next);
  console.log('wrote surfaces/mission-seed.js · ' + ledger.missions.length + ' missions · ' + ledger.receipts.length + ' receipts · head ' + check.head.slice(0, 12));
}
