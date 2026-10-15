#!/usr/bin/env node
// btmd-001 evidence distiller — turns raw run receipts (WSL ~/btmd/runs)
// into the sanitized, committable in-tree evidence set.
//
// Laws enforced here:
//   1. No 64-hex identity rides the distilled output in plaintext. Hex
//      runs >= 48 chars become «hexNN…first6» references. Digests that
//      MUST be cited (budget hash, binary pins) ride markdown lines with
//      a same-line PUBLIC-CONSTANT marker (the estate hex law).
//   2. Nothing is averaged across configs: baseline and candidate rows
//      stay side by side, per trial, per scale — the reader compares.
//   3. Raw receipts are referenced by path; the raws themselves live
//      outside the tree and are gzipped in-tree only when named by the
//      closeout.
//
// Usage: node scripts/btmd/distill.mjs --runs <dir> --out <evidence-dir>

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const runsDir = flag('--runs');
const outDir = flag('--out');
if (!runsDir || !outDir) {
  console.error('usage: distill.mjs --runs <dir> --out <dir>');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const sanitize = (s) =>
  String(s).replace(/[0-9a-fA-F]{48,}/g, (m) => `«hex${m.length}…${m.slice(0, 6)}»`);

const rows = [];
const recovery = [];
const continuity = [];
const notes = [];

for (const run of readdirSync(runsDir)) {
  const rd = join(runsDir, run);
  const v = join(rd, 'receipts', 'verdict.json');
  if (existsSync(v)) {
    const j = JSON.parse(readFileSync(v, 'utf8'));
    rows.push(j);
  }
  for (const [file, sink] of [['recovery.jsonl', recovery], ['continuity.jsonl', continuity], ['notes.jsonl', notes]]) {
    const p = join(rd, 'receipts', file);
    if (existsSync(p)) {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        if (line.trim()) {
          try { sink.push({ run, ...JSON.parse(line) }); } catch { /* partial line */ }
        }
      }
    }
  }
}

rows.sort((a, b) => (a.scale - b.scale) || (a.run_id < b.run_id ? -1 : 1));

// Debug lineage vs canonical set: the debug runs are the battery's own
// bring-up (observation bugs being found and fixed — see the dispatch).
// They stay in the record, flagged, never in the canonical table.
const isDebug = (r) =>
  /^p1[a-z]?-/.test(r.run_id) ||
  r.run_id.includes('dbg') ||
  // run01's s6/s9 pairs predate the group member-roster fix (12/24, 12/42
  // artifacts); run02 reran them post-fix.
  /^run01-p2-s[69]-/.test(r.run_id);

// verdicts.json — machine-readable, fully sanitized
const sanitized = {
  schema: 'btmd-evidence-1',
  generated: new Date().toISOString(),
  trials: rows.map((r) => ({
    phase: r.phase, trial: r.trial, run_id: r.run_id, x0x_version: r.x0x_version,
    leaf_config: r.leaf_config, skip_legacy_dm_bus: r.skip_legacy_dm_bus, scale: r.scale,
    budget_sha256_ref: sanitize(r.budget_sha256),
    cost: r.cost,
    matrices: {
      targeted_dm: r.matrix_targeted_dm, group: r.matrix_group,
      sync: r.matrix_sync, class_probe: r.matrix_probe,
    },
    unsafe_retries: r.unsafe_retries,
    verdicts: r.verdicts,
    verdicts_pass: r.verdicts_pass,
  })),
  recovery_drills: recovery,
  continuity: continuity,
  notes,
};
writeFileSync(join(outDir, 'verdicts.json'), JSON.stringify(sanitized, null, 2) + '\n');

// summary.md — the human table
let md = `# BT-MESH-DEPENDABILITY-001 — measured evidence (local rig)\n\n`;
md += `Generated ${sanitized.generated}. All numbers are kernel veth counters and\n`;
md += `recipient-side delivery evidence from the netns rig; daemon diagnostics are\n`;
md += `recorded alongside as application-level context and are never verdict sources.\n`;
md += `Proposed budgets live in the committed budgets artifact; every trial binds its\n`;
md += `sha256 (referenced below; the full digest rides the closeout receipts).\n\n`;
if (rows.length) {
  md += `budgets sha256 ${rows[0].budget_sha256} PUBLIC-CONSTANT\n\n`;
  md += `## Canonical matched cost trials (identical workload shape; interleaved)\n\n`;
  md += `| trial | scale | leaf cfg | dm | group | sync | probe | leaf idle egress+ingress B/min | seed phase egress | relay phase egress | unsafe retries | pass |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows.filter((x) => !isDebug(x))) {
    const leafIdle = r.cost.filter((c) => c.node.startsWith('n')).map((c) => `${c.node}:${Math.round(c.idle_egress_bytes_per_min + c.idle_ingress_bytes_per_min)}`).join(' ');
    const seed = r.cost.find((c) => c.node === 'seed');
    const relay = r.cost.find((c) => c.node === 'relay');
    md += `| ${r.trial} | ${r.scale} | ${JSON.stringify(r.leaf_config)} ${r.skip_legacy_dm_bus ? '+skipbus' : ''} | ${r.matrix_targeted_dm.delivered}/${r.matrix_targeted_dm.total} | ${r.matrix_group.delivered}/${r.matrix_group.total} | ${r.matrix_sync.delivered}/${r.matrix_sync.total} | ${r.matrix_probe.delivered}/${r.matrix_probe.total} | ${leafIdle} | ${seed ? seed.phase_egress_bytes : '-'} | ${relay ? relay.phase_egress_bytes : '-'} | ${r.unsafe_retries} | ${r.verdicts_pass ? 'yes' : 'NO'} |\n`;
  }
  md += `\nDelivery cells are delivered/total-intended-recipient-pairs from the\nmessage-identity ledger; lost/unknown/duplicated counts are in verdicts.json.\n\n`;
  const dbg = rows.filter((x) => isDebug(x));
  if (dbg.length) {
    md += `## Debug lineage (battery bring-up: observation bugs found and fixed — kept for the record, NOT evidence)\n\n`;
    md += `| trial | scale | run | dm | group | sync | probe | pass |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    for (const r of dbg) {
      md += `| ${r.trial} | ${r.scale} | ${r.run_id} | ${r.matrix_targeted_dm.delivered}/${r.matrix_targeted_dm.total} | ${r.matrix_group.delivered}/${r.matrix_group.total} | ${r.matrix_sync.delivered}/${r.matrix_sync.total} | ${r.matrix_probe.delivered}/${r.matrix_probe.total} | ${r.verdicts_pass ? 'yes' : 'NO'} |\n`;
    }
  }
}
if (recovery.length) {
  md += `\n## Recovery drills\n\n`;
  for (const d of recovery) {
    md += `- **${d.drill}** (${d.run || d.node || ''}): ${sanitize(JSON.stringify({ ...d, drill: undefined, run: undefined }))}\n`;
  }
}
if (continuity.length) {
  md += `\n## Continuity\n\n`;
  for (const c of continuity) {
    md += `- ${sanitize(JSON.stringify(c))}\n`;
  }
}
if (notes.length) {
  md += `\n## Notes\n\n`;
  for (const n of notes) md += `- ${sanitize(typeof n === 'string' ? n : JSON.stringify(n))}\n`;
}
writeFileSync(join(outDir, 'summary.md'), md);
console.log(`distilled ${rows.length} trials, ${recovery.length} recovery drills, ${continuity.length} continuity rows -> ${outDir}`);
