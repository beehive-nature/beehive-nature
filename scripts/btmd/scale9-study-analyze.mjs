#!/usr/bin/env node
// scale9-study-analyze.mjs — the scale-9 dependability study analyzer.
//
// LAWS (founder disposition, 2026-10-13):
//   1. Individual outcomes are PRESERVED — every trial is a row; legs are
//      summarized as COUNTS (clean trials / trials with failures), never
//      as a mean that conceals the failing condition. The 10/20 and 20/20
//      milestone observations stay separate rows in the record.
//   2. Failure categories per missing-in-gate op: LATE-RECOVERED (with
//      its recovery time), NEVER (not within the 180s observation).
//   3. Recovery times are per (op, node) latencies, listed, not averaged.
//   4. Workload parameters and reproducibility facts ride each trial row
//      straight from its own spec/verdict receipts.
//
// Usage: node scripts/btmd/scale9-study-analyze.mjs --runs <dir> --out <file.json>

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const runsDir = flag('--runs');
const outFile = flag('--out');
if (!runsDir || !outFile) {
  console.error('usage: scale9-study-analyze.mjs --runs <dir> --out <file>');
  process.exit(2);
}

// The per-op gate is the trial's own op deadline (published_at_ms +
// deadline_ms, 10s in the driver); anything later is LATE, anything
// absent by the last observation is NEVER.
const sanitize = (s) => String(s).replace(/[0-9a-fA-F]{48,}/g, (m) => `«hex${m.length}…${m.slice(0, 6)}»`);

const trials = [];

// Per-kind attribution (E1 Phase 0: instrument before changing policy).
// Deltas between the t0 and t1 gossip diagnostics snapshots per node,
// bucketed by topic family. APPLICATION-LEVEL counters — recorded for
// attribution, never verdict sources (kernel veth counters judge cost).
function family(topic) {
  if (topic.startsWith('x0x/caps') || topic.startsWith('caps/')) return 'caps';
  if (topic.startsWith('x0x/announce') || topic.startsWith('announce/')) return 'announce-blob';
  if (topic.startsWith('x0x.machine.announce') || topic.startsWith('machine.announce')) return 'machine-announce';
  if (topic.includes('dm/v1/bus')) return 'dm-bus';
  if (topic.startsWith('x0x.identity')) return 'identity';
  if (topic.startsWith('x0x.groups')) return 'groups';
  if (topic.startsWith('btmd/store') || topic.startsWith('btmd/cont') || topic.startsWith('x0x.group.')) return 'store-sync';
  if (topic.startsWith('btmd/')) return 'btmd-probe';
  return 'other';
}
function readSnap(path) {
  const m = new Map();
  if (!existsSync(path)) return m;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const j = JSON.parse(line); m.set(j.node, j.gossip); } catch { /* partial */ }
  }
  return m;
}
function num(x) { return typeof x === 'number' ? x : 0; }
function attribution(rd) {
  // Per-purpose rows are CUMULATIVE counters: the trial-window number is
  // the t0->t1 DELTA (aligned with the standalone e1-attribution tool;
  // review correction — the earlier version read t1 cumulatives).

  const t0 = readSnap(join(rd, 'receipts', 'diagnostics-t0.jsonl'));
  const t1 = readSnap(join(rd, 'receipts', 'diagnostics.jsonl'));
  const perNode = {};
  for (const [node, g1] of t1) {
    const g0 = t0.get(node) ?? {};
    const eb1 = g1?.egress_budget ?? {};
    const eb0 = g0?.egress_budget ?? {};
    const leaf1 = eb1.leaf_egress ?? {};
    const leaf0 = eb0.leaf_egress ?? {};
    // name <-> topic-hash bridge (subscribed_topics carries hex8 ids)
    const hex8ToFam = {};
    for (const s of g1?.subscribed_topics ?? []) {
      hex8ToFam[s.topic_id_hex8] = family(s.name);
    }
    const famOfTopicBytes = (arr) => {
      if (!Array.isArray(arr)) return 'other';
      const hex8 = arr.slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
      return hex8ToFam[hex8] ?? 'unsubscribed-or-unknown';
    };
    const fams = {};
    const bump = (f, k, n) => { fams[f] ??= {}; fams[f][k] = (fams[f][k] ?? 0) + Math.max(0, n); };
    // per-topic-per-purpose rows are CUMULATIVE: charge the t0->t1
    // WINDOW DELTA per (topic, purpose) row — the shed attribution
    // (demandedΔ - chargedΔ) is a trial-window number.
    const purposeBase = new Map(
      (leaf0.by_topic_and_purpose ?? []).map((r) => [
        r.topic.join(',') + '|' + r.purpose,
        r,
      ]),
    );
    for (const row of leaf1.by_topic_and_purpose ?? []) {
      const f = famOfTopicBytes(row.topic);
      const p = String(row.purpose ?? '?').toLowerCase();
      const b = purposeBase.get(row.topic.join(',') + '|' + row.purpose) ?? {
        demanded_bytes: 0, charged_bytes: 0, deferred: 0, send_failures: 0,
      };
      bump(f, `${p}_charged_bytes`, num(row.charged_bytes) - num(b.charged_bytes));
      bump(f, `${p}_demanded_bytes`, num(row.demanded_bytes) - num(b.demanded_bytes));
      bump(f, `${p}_shed_bytes`, (num(row.demanded_bytes) - num(b.demanded_bytes)) - (num(row.charged_bytes) - num(b.charged_bytes)));
      bump(f, `${p}_deferred`, num(row.deferred) - num(b.deferred));
      bump(f, `${p}_send_failures`, num(row.send_failures) - num(b.send_failures));
    }
    perNode[node] = {
      byte_policy: eb1.byte_policy ?? null,
      shed_suppressed_delta: num(leaf1.shed_suppressed) - num(leaf0.shed_suppressed),
      budget_timeouts_delta: num(leaf1.budget_timeouts) - num(leaf0.budget_timeouts),
      hard_exceeded_delta: num(eb1.egress_budget_hard_exceeded) - num(eb0.egress_budget_hard_exceeded),
      soft_exceeded_delta: num(eb1.egress_budget_soft_exceeded) - num(eb0.egress_budget_soft_exceeded),
      families: fams,
    };
  }
  return perNode;
}

for (const run of readdirSync(runsDir).sort()) {
  if (!run.startsWith('s9study-') && !run.startsWith('e1camp-') && !run.startsWith('e1-')) continue;
  const rd = join(runsDir, run);
  const vPath = join(rd, 'receipts', 'verdict.json');
  const lPath = join(rd, 'receipts', 'ledger.json');
  if (!existsSync(vPath) || !existsSync(lPath)) continue;
  const v = JSON.parse(readFileSync(vPath, 'utf8'));
  const l = JSON.parse(readFileSync(lPath, 'utf8'));

  const syncOps = (l.ops || []).filter((o) => o.class === 'state_sync');
  const deliveries = (l.events || []).filter((e) => e.kind === 'delivered' || e.kind === 'acked' || e.kind === 'duplicate_delivery');
  const perOp = [];
  for (const op of syncOps) {
    const key = op.destination ? op.destination.replace(/^store:/, '') : '?';
    for (const node of op.intended) {
      const first = deliveries
        .filter((e) => e.op_id === op.op_id && e.node === node)
        .map((e) => e.at_ms)
        .sort((a, b) => a - b)[0];
      const dups = deliveries.filter((e) => e.op_id === op.op_id && e.node === node).length - (first ? 1 : 0);
      let outcome;
      let latencyMs = null;
      if (first === undefined) {
        outcome = 'NEVER';
      } else if (first <= op.deadline_ms) {
        outcome = 'WITHIN-GATE';
        latencyMs = first - op.published_at_ms;
      } else {
        outcome = 'LATE-RECOVERED';
        latencyMs = first - op.published_at_ms;
      }
      perOp.push({ op: sanitize(op.op_id), key, node, outcome, latency_ms: latencyMs, duplicates: dups > 0 ? dups : 0 });
    }
  }
  const within = perOp.filter((p) => p.outcome === 'WITHIN-GATE').length;
  const late = perOp.filter((p) => p.outcome === 'LATE-RECOVERED');
  const never = perOp.filter((p) => p.outcome === 'NEVER');
  trials.push({
    run: run,
    leg: v.trial,
    x0x_version: v.x0x_version,
    leaf_config: v.leaf_config,
    scale: v.scale,
    budget_sha256_ref: sanitize(v.budget_sha256),
    workload: {
      dm: v.matrix_targeted_dm, group: v.matrix_group,
      probe: v.matrix_probe,
      sync_total_pairs: perOp.length,
    },
    sync_within_gate: `${within}/${perOp.length}`,
    sync_outcome_counts: { within: within, late: late.length, never: never.length },
    failures: [...late, ...never],
    per_op: perOp,
    attribution: attribution(rd),
    verdicts_pass: v.verdicts_pass,
    unsafe_retries: v.unsafe_retries,
  });
}

const byLeg = {};
for (const t of trials) {
  byLeg[t.leg] ??= { trials: 0, fully_within_gate: 0, with_late: 0, with_never: 0, trial_rows: [] };
  const b = byLeg[t.leg];
  b.trials += 1;
  if (t.sync_outcome_counts.late === 0 && t.sync_outcome_counts.never === 0) b.fully_within_gate += 1;
  if (t.sync_outcome_counts.late > 0) b.with_late += 1;
  if (t.sync_outcome_counts.never > 0) b.with_never += 1;
  b.trial_rows.push(`${t.run}: ${t.sync_within_gate} (late ${t.sync_outcome_counts.late}, never ${t.sync_outcome_counts.never})`);
}

// The carve-out determination INPUTS — stated as per-leg counts and the
// explicit alternative readings; the determination itself is written by
// the dispatch from these numbers, never auto-concluded here.
const out = {
  schema: 'btmd-scale9-study-1',
  generated: new Date().toISOString(),
  gate: 'per-op deadline 10s from publish (the trial op deadline; stricter than the 30s budget gate — any LATE row fails the gate)',
  observation_window_ms: 180000,
  legs: byLeg,
  trials: trials,
  milestone_observations_remain_separate: [
    'run02-p2-s9-r0-shed_normal: 10/20 within the 45s sweep window (FAIL)',
    'run03-s9shed-long (180s window): 20/20 within gate (characterization, not a pass conversion)',
  ],
};
writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
console.log(`analyzed ${trials.length} trials -> ${outFile}`);
for (const [leg, b] of Object.entries(byLeg)) {
  console.log(`${leg}: ${b.fully_within_gate}/${b.trials} fully within gate; ${b.with_late} with LATE; ${b.with_never} with NEVER`);
}
