// ant-reach-compare.mjs — compare reach() exports from independent networks, endpoint by endpoint.
// An endpoint that fails before ICE-connected from every network while others open from the same
// networks points at the advertisement, not at one client's network. This script classifies; it
// does not diagnose why ICE failed (closed port, NAT, firewall, stale or wrong advertisement).
// Run: node scripts/ant-reach-compare.mjs reach-a.json reach-b.json [...] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const ji = args.indexOf('--json');
const jsonOut = ji >= 0 ? args.splice(ji, 2)[1] : null;
if (args.length < 2) { console.error('usage: ant-reach-compare.mjs a.json b.json [...] [--json out.json]'); process.exit(2); }

// One run's verdict on one endpoint: opened if any attempt opened, dead if every attempt settled dead.
export function verdict(attempts) {
  if (attempts.some(a => a.stage === 'opened' || a.stage === 'answered')) return 'opened';
  if (attempts.length && attempts.every(a => a.stage.startsWith('no-') || a.stage.includes('-no-'))) return 'dead';
  return 'unsettled';
}

const runs = args.map(f => { const r = JSON.parse(readFileSync(f, 'utf8')); if (r.schema !== 'bnr.ant-reach/1') throw new Error(f + ': not bnr.ant-reach/1'); return r; });
const all = new Map();
runs.forEach((r, i) => r.endpoints.forEach(e => {
  if (!all.has(e.endpoint)) all.set(e.endpoint, runs.map(() => null));
  all.get(e.endpoint)[i] = { verdict: verdict(e.attempts), stages: e.attempts.map(a => a.stage) };
}));

const classes = { 'dead everywhere': [], 'opened everywhere': [], 'differs by network': [], 'seen by one network only': [], 'unsettled somewhere': [] };
for (const [h, per] of all) {
  const seen = per.filter(Boolean);
  if (seen.length < runs.length) classes['seen by one network only'].push(h);
  else if (seen.some(p => p.verdict === 'unsettled')) classes['unsettled somewhere'].push(h);
  else if (seen.every(p => p.verdict === 'dead')) classes['dead everywhere'].push(h);
  else if (seen.every(p => p.verdict === 'opened')) classes['opened everywhere'].push(h);
  else classes['differs by network'].push(h);
}
const deadEverywhereNoIce = classes['dead everywhere'].filter(h => all.get(h).every(p => p.stages.every(s => s === 'no-ice-connected'))).length;

console.log('runs: ' + runs.map(r => `${r.label} (${r.network.type}/${r.network.effectiveType}, ${r.startedAt || r.exportedAt}, ${r.endpoints.length} endpoints)`).join(' · '));
for (const [k, v] of Object.entries(classes)) console.log(`${k}: ${v.length}`);
console.log(`dead everywhere, never ICE-connected on any attempt: ${deadEverywhereNoIce}`);
const both = all.size - classes['seen by one network only'].length;
console.log(`endpoints seen by every network: ${both}`);

if (jsonOut) writeFileSync(jsonOut, JSON.stringify({
  schema: 'bnr.ant-reach-compare/1', runs: runs.map(r => ({ label: r.label, network: r.network, startedAt: r.startedAt, seconds: r.seconds, summary: r.summary })),
  counts: Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, v.length])), deadEverywhereNoIce,
  endpoints: Object.fromEntries([...all].map(([h, per]) => [h, per.map(p => p && p.verdict)]))
}, null, 1) + '\n');
