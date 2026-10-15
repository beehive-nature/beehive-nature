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
console.log(`# E1 path attribution — ${runDir}`);
for (const [node, g1] of t1) {
  const g0 = t0.get(node) ?? {};
  const eb1 = g1?.egress_budget ?? {}, eb0 = g0?.egress_budget ?? {};
  const le1 = eb1.leaf_egress ?? {}, le0 = eb0.leaf_egress ?? {};
  const hex8 = {};
  for (const s of (g1?.subscribed_topics ?? [])) hex8[s.topic_id_hex8] = s.name;
  const rows = [];
  for (const r of (le1.by_topic_and_purpose ?? [])) {
    const h = r.topic.slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
    const name = hex8[h] ?? h;
    rows.push({ name, purpose: r.purpose, demanded: r.demanded_bytes, charged: r.charged_bytes, deferred: r.deferred, fails: r.send_failures });
  }
  const store = rows.filter((r) => r.name.includes('store'));
  const tot = rows.reduce((a, r) => ({ d: a.d + r.demanded, c: a.c + r.charged, def: a.def + r.deferred }), { d: 0, c: 0, def: 0 });
  console.log(`\n## node ${node} — policy=${eb1.byte_policy} shedΔ=${(le1.shed_suppressed ?? 0) - (le0.shed_suppressed ?? 0)} reservedCharged=${le1.reserved_charged_bytes ?? '-'} reservedMsgs=${le1.reserved_msgs ?? '-'} reservedDeferred=${le1.reserved_deferred ?? '-'}`);
  console.log(`   all-topics: demanded=${tot.d} charged=${tot.c} shed=${tot.d - tot.c} deferred=${tot.def}`);
  for (const r of store) {
    console.log(`   store ${r.name} ${r.purpose}: demanded=${r.demanded} charged=${r.charged} shed=${r.demanded - r.charged} deferred=${r.deferred} fails=${r.fails}`);
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
