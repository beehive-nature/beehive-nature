// ant-reach-cohort.mjs — does an endpoint keep its phenotype over time and across networks?
// The cohort is fixed from the two-network receipt: the first 20 dead-from-both and the first 20
// opened-from-both fingerprints (sorted, so anyone re-derives the same 40). Each later reach()
// export is read for those 40 only: seen or not, and its verdict when seen.
// Run: node scripts/ant-reach-cohort.mjs docs/receipts/ant-reach-2026-10-06.json run1.json [...]
//        [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { verdict } from './ant-reach-verdict.mjs';

const args = process.argv.slice(2);
const ji = args.indexOf('--json');
const jsonOut = ji >= 0 ? args.splice(ji, 2)[1] : null;
const [receiptFile, ...runFiles] = args;
if (!receiptFile || !runFiles.length) { console.error('usage: ant-reach-cohort.mjs receipt.json run.json [...] [--json out.json]'); process.exit(2); }

const N = 20;
const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
const cohort = [
  ...receipt.deadEverywhere.slice(0, N).map(id => ({ id, was: 'dead' })),
  ...receipt.openedEverywhere.slice(0, N).map(id => ({ id, was: 'opened' }))
];

const runs = runFiles.map(f => {
  const r = JSON.parse(readFileSync(f, 'utf8'));
  if (r.schema !== 'bnr.ant-reach/1') throw new Error(f + ': not bnr.ant-reach/1');
  const byPrefix = new Map(r.endpoints.map(e => [e.endpoint.slice(0, 16), verdict(e.attempts)]));
  return { label: r.label, at: r.startedAt || r.exportedAt, seen: cohort.map(c => byPrefix.get(c.id) || null) };
});

const rows = cohort.map((c, i) => {
  const seen = runs.map(r => r.seen[i]).filter(Boolean);
  const settled = seen.filter(v => v !== 'unsettled');
  const kept = settled.filter(v => v === c.was).length;
  return { ...c, observations: seen.length, settled: settled.length, kept, flipped: settled.length - kept };
});

const sum = was => {
  const g = rows.filter(r => r.was === was);
  return { members: g.length, observed: g.filter(r => r.observations).length,
    settledObservations: g.reduce((a, r) => a + r.settled, 0), kept: g.reduce((a, r) => a + r.kept, 0), flipped: g.reduce((a, r) => a + r.flipped, 0) };
};
const dead = sum('dead'), live = sum('opened');
console.log('runs: ' + runs.map(r => `${r.label} @ ${r.at}`).join(' · '));
console.log(`dead cohort: ${dead.observed}/${dead.members} observed · ${dead.kept} of ${dead.settledObservations} settled observations still dead · ${dead.flipped} opened`);
console.log(`live cohort: ${live.observed}/${live.members} observed · ${live.kept} of ${live.settledObservations} settled observations still open · ${live.flipped} failed`);
for (const r of rows.filter(r => r.flipped)) console.log(`flip: ${r.id} was ${r.was} · ${r.flipped} of ${r.settled} settled observations differ`);

if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ schema: 'bnr.ant-reach-cohort/1', receipt: receiptFile,
  runs: runs.map(r => ({ label: r.label, at: r.at })), dead, live,
  members: rows.map((r, i) => ({ ...r, perRun: runs.map(x => x.seen[i]) })) }, null, 1) + '\n');
