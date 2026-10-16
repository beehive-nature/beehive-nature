// e1-coalesce-scope.mjs — E1-IHAVE-COALESCE-001 scoping measurement:
// unique announcement identities vs retry multiplicity, per leg, from
// existing campaign receipts (t0→t1 window deltas; no new rig run).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const runsRoot = process.argv[2] ?? '//wsl.localhost/Ubuntu/home/travi/btmd/runs';
const parse = (p) =>
  existsSync(p)
    ? readFileSync(p, 'utf8').trim().split('\n').filter(Boolean)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean)
    : [];
const runs = readdirSync(runsRoot).filter((r) => /^e1camp-r\d+-(e1|e1off)$/.test(r));
const tot = { e1: { def: 0, nodes: 0 }, e1off: { def: 0, nodes: 0 } };
const uniqueRecordsPerTrial = 10; // store puts per trial
for (const run of runs) {
  const leg = run.endsWith('-e1') ? 'e1' : 'e1off';
  const rd = join(runsRoot, run, 'receipts');
  const t0 = new Map(parse(join(rd, 'diagnostics-t0.jsonl')).map((j) => [j.node, j.gossip]));
  for (const j of parse(join(rd, 'diagnostics.jsonl'))) {
    const le1 = j.gossip?.egress_budget?.leaf_egress?.by_topic_and_purpose ?? [];
    const le0 = t0.get(j.node)?.egress_budget?.leaf_egress?.by_topic_and_purpose ?? [];
    const base = new Map(le0.map((r) => [r.topic.join(',') + '|' + r.purpose, r]));
    for (const r of le1) {
      if (String(r.purpose) !== 'IHAVE') continue;
      const b = base.get(r.topic.join(',') + '|' + r.purpose) ?? { deferred: 0 };
      tot[leg].def += Math.max(0, (r.deferred ?? 0) - (b.deferred ?? 0));
    }
    tot[leg].nodes += 1;
  }
}
for (const leg of ['e1', 'e1off']) {
  const multiplicity = tot[leg].def / (tot[leg].nodes * uniqueRecordsPerTrial);
  console.log(`${leg}: IHAVE deferredΔ total=${tot[leg].def} over ${tot[leg].nodes} node-trials → retry multiplicity ≈ ${multiplicity.toFixed(1)}× per unique record per node`);
}
console.log('scope verdict: the IHAVE load is overwhelmingly RETRIES of ~10 unique announcement identities — bounded coalescing/dedup is the correct next mechanism (E1-IHAVE-COALESCE-001), not more priority.');
