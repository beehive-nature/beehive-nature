// e1-attribution.mjs — E1-PATH-ATTRIBUTION-001: which lane carries timely
// store delivery? Correlates per-purpose egress rows (charged vs demanded
// = shed bytes) on store topics, per node, with the per-op delivery
// latencies from the ledger. Usage:
//   node scripts/btmd/e1/e1-attribution.mjs --run <run-dir>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const runDir = flag('--run');
if (!runDir) { console.error('usage: e1-attribution.mjs --run <run-dir>'); process.exit(2); }

const sanitize = (s) => String(s).replace(/[0-9a-fA-F]{48,}/g, (m) => `«hex${m.length}…${m.slice(0, 6)}»`);
const t0 = new Map(), t1 = new Map();
for (const [file, map] of [['diagnostics-t0.jsonl', t0], ['diagnostics.jsonl', t1]]) {
  const p = join(runDir, 'receipts', file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const j = JSON.parse(line); map.set(j.node, j.gossip); } catch { /* partial */ }
  }
}
// Per-purpose rows are CUMULATIVE since boot: the trial-window number is
// the t0→t1 DELTA (review correction 1). Rows absent at t0 count from
// zero. Original snapshots remain on disk untouched.
function purposeDelta(node) {
  const g1 = t1.get(node), g0 = t0.get(node) ?? {};
  const le1 = g1?.egress_budget?.leaf_egress?.by_topic_and_purpose ?? [];
  const le0 = g0?.egress_budget?.leaf_egress?.by_topic_and_purpose ?? [];
  const key = (r) => r.topic.join(',') + '|' + r.purpose;
  const base = new Map(le0.map((r) => [key(r), r]));
  return le1.map((r1) => {
    const b = base.get(key(r1)) ?? { demanded_bytes: 0, charged_bytes: 0, deferred: 0, send_failures: 0 };
    return { topic: r1.topic, purpose: r1.purpose,
      demanded: Math.max(0, r1.demanded_bytes - b.demanded_bytes),
      charged: Math.max(0, r1.charged_bytes - b.charged_bytes),
      deferred: Math.max(0, r1.deferred - b.deferred),
      fails: Math.max(0, r1.send_failures - b.send_failures) };
  });
}
console.log(`# E1 path attribution — ${runDir}`);
for (const [node, g1] of t1) {
  const g0 = t0.get(node) ?? {};
  const eb1 = g1?.egress_budget ?? {}, eb0 = g0?.egress_budget ?? {};
  const le1 = eb1.leaf_egress ?? {}, le0 = eb0.leaf_egress ?? {};
  const hex8 = {};
  for (const s of (g1?.subscribed_topics ?? [])) hex8[s.topic_id_hex8] = s.name;
  const rows = purposeDelta(node).map((r) => ({
    ...r, name: (() => { const h = r.topic.slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join(''); return hex8[h] ?? h; })(),
  }));
  const store = rows.filter((r) => r.name.includes('store'));
  const tot = rows.reduce((a, r) => ({ d: a.d + r.demanded, c: a.c + r.charged, def: a.def + r.deferred }), { d: 0, c: 0, def: 0 });
  console.log(`\n## node ${node} — policy=${eb1.byte_policy} shedΔ=${(le1.shed_suppressed ?? 0) - (le0.shed_suppressed ?? 0)} reservedChargedΔ=${(le1.reserved_charged_bytes ?? 0) - (le0.reserved_charged_bytes ?? 0)} reservedMsgsΔ=${(le1.reserved_msgs ?? 0) - (le0.reserved_msgs ?? 0)} reservedDeferredΔ=${(le1.reserved_deferred ?? 0) - (le0.reserved_deferred ?? 0)} [trial-window deltas]`);
  console.log(`   all-topics: demandedΔ=${tot.d} chargedΔ=${tot.c} shedΔ=${tot.d - tot.c} deferredΔ=${tot.def}`);
  for (const r of store) {
    console.log(`   store ${r.name} ${r.purpose}: demandedΔ=${r.demanded} chargedΔ=${r.charged} shedΔ=${r.demanded - r.charged} deferredΔ=${r.deferred} failsΔ=${r.fails}`);
  }
}
const ledgerPath = join(runDir, 'receipts', 'ledger.json');
if (existsSync(ledgerPath)) {
  const l = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const syncOps = (l.ops ?? []).filter((o) => o.class === 'state_sync');
  const deliveries = (l.events ?? []).filter((e) => e.kind === 'delivered');
  console.log('\n## sync op latencies (s) — within-gate deadline 10s');
  for (const op of syncOps) {
    for (const node of op.intended) {
      const d = deliveries.find((e) => e.op_id === op.op_id && e.node === node);
      const lat = d ? ((d.at_ms - op.published_at_ms) / 1000).toFixed(1) : 'NEVER';
      console.log(`   ${sanitize(op.op_id)} -> ${node}: ${lat}${d && d.at_ms > op.deadline_ms ? ' LATE' : d ? ' within' : ''}`);
    }
  }
}
