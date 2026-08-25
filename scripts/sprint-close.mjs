#!/usr/bin/env node
// Sprint closing receipt — re-derives what a sprint claims, from the repo.
//
// WHY THIS EXISTS
//
// The 2026-08-24 gate-seat order named the failure exactly: "fleet-pixels,
// fleet-bus, dock-claims and university-smoke were built and mutation-proven but
// ran on NO push; every assertion this sprint gated nothing." The work was done.
// Nothing surfaced it. At close, a sprint that shipped and a sprint that stalled
// produce the same artifact — a report — and a report cannot tell you which one
// you had. That is the same defect as §7's hook selftest ("a gate's success state
// is SILENCE") applied to the sprint itself rather than to a hook.
//
// So: a sprint does not close on what the seats say. It closes on what this
// script can re-derive from the repository. Method is lifted wholesale from
// e2e/dock-claims.mjs, which re-derives the Dock's hero numbers from source and
// compares them against what the page prints. Same trick, larger subject.
//
// THREE STATES, AND "DONE" IS NOT ONE OF THEM
//
//   PROVEN    re-derived here, from the repo, on this commit
//   LANDED    the artifact exists but nothing proves it runs or is read
//   MISSING   not present
//
// LANDED is the important one. It is the state the four suites were in, and the
// state a report would have called "done". Naming it is the whole point.
//
// Usage:  node scripts/sprint-close.mjs docs/dispatches/<sprint>.sprint.json
// Exit 1 if any claim marked `must` is not PROVEN. Everything else is reported,
// never silently dropped.

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('usage: node scripts/sprint-close.mjs <sprint.json>');
  process.exit(2);
}
const M = JSON.parse(readFileSync(manifestPath, 'utf8'));

const git = (cmd) => {
  try { return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); }
  catch { return ''; }
};
const read = (p) => existsSync(p) ? readFileSync(p, 'utf8') : null;

// ── derivations ───────────────────────────────────────────────────────────────
// Each returns { state, note }. No derivation may return "PROVEN" without having
// actually looked at something.

const DERIVE = {
  // the artifact exists on disk
  file: (c) => existsSync(c.path)
    ? { state: 'PROVEN', note: `${c.path} exists` }
    : { state: 'MISSING', note: `${c.path} not found` },

  // a receipt exists AND is non-trivial (an empty receipt is a report)
  receipt: (c) => {
    const s = read(c.path);
    if (s === null) return { state: 'MISSING', note: `${c.path} not found` };
    if (s.length < (c.minBytes ?? 400))
      return { state: 'LANDED', note: `${c.path} exists but is ${s.length}B — too thin to be evidence` };
    return { state: 'PROVEN', note: `${c.path}, ${s.length}B` };
  },

  // a string is present in a file — used for spec amendments and rulings
  contains: (c) => {
    const s = read(c.path);
    if (s === null) return { state: 'MISSING', note: `${c.path} not found` };
    return s.includes(c.needle)
      ? { state: 'PROVEN', note: `${c.path} carries "${c.needle.slice(0, 48)}"` }
      : { state: 'MISSING', note: `${c.path} does not carry "${c.needle.slice(0, 48)}"` };
  },

  // THE FOUR-SUITE CHECK. A test that exists is LANDED. A test that a workflow
  // invokes, in a job that runs on push, is PROVEN. This is the distinction the
  // 2026-08-24 order was written about, and it is why `file` is not enough.
  ciStep: (c) => {
    if (c.testPath && !existsSync(c.testPath))
      return { state: 'MISSING', note: `${c.testPath} not found` };
    const wf = read(c.workflow);
    if (wf === null) return { state: 'MISSING', note: `${c.workflow} not found` };
    if (!wf.includes(c.invocation))
      return { state: 'LANDED', note: `${c.testPath ?? c.invocation} exists but NO workflow step invokes it — it gates nothing` };
    const onPush = /^on:\s*$[\s\S]*?^\s{2}push:/m.test(wf) || /^on:.*\bpush\b/m.test(wf);
    if (!onPush)
      return { state: 'LANDED', note: `invoked, but ${c.workflow} does not run on push` };
    return { state: 'PROVEN', note: `${c.workflow} invokes it on push` };
  },

  // a commit touching a path landed since the sprint opened
  commitSince: (c) => {
    const range = c.since ? `${c.since}..HEAD` : '';
    const log = git(`log ${range} --oneline -- ${c.path}`);
    if (!log) return { state: 'MISSING', note: `no commits touching ${c.path}${c.since ? ` since ${c.since}` : ''}` };
    const n = log.split('\n').length;
    return { state: 'PROVEN', note: `${n} commit(s) touching ${c.path}` };
  },

  // a founder gate — never PROVEN by a script. Reported so it cannot be forgotten.
  gate: (c) => ({ state: 'GATE', note: c.note ?? 'awaiting founder' }),

  // explicitly unprovable: recorded so the receipt shows its own blind spots
  manual: (c) => ({ state: 'LANDED', note: c.note ?? 'asserted, not re-derivable here' }),
};

// ── run ───────────────────────────────────────────────────────────────────────
const rows = M.claims.map((c) => {
  const fn = DERIVE[c.derive];
  const r = fn ? fn(c) : { state: 'MISSING', note: `unknown derivation "${c.derive}"` };
  return { ...c, ...r };
});

const head = git('rev-parse --short HEAD') || '(no git)';
const W = Math.max(...rows.map(r => r.id.length), 4);
const pad = (s, n) => String(s).padEnd(n);

console.log(`\nSPRINT CLOSING RECEIPT — ${M.sprint}`);
console.log(`re-derived at ${head}${M.since ? `, opened at ${M.since}` : ''}`);
console.log('='.repeat(78));

for (const g of [...new Set(rows.map(r => r.lane ?? 'general'))]) {
  console.log(`\n  ${g.toUpperCase()}`);
  for (const r of rows.filter(x => (x.lane ?? 'general') === g)) {
    console.log(`    ${pad(r.state, 7)} ${pad(r.id, W)}  ${r.title}`);
    console.log(`    ${' '.repeat(7)} ${' '.repeat(W)}  ↳ ${r.note}`);
  }
}

const tally = rows.reduce((a, r) => (a[r.state] = (a[r.state] ?? 0) + 1, a), {});
console.log('\n' + '='.repeat(78));
console.log(`  ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(' · ')}`);

const landed = rows.filter(r => r.state === 'LANDED');
if (landed.length) {
  console.log(`\n  LANDED-BUT-UNPROVEN — the four-suite state. Built, and gating nothing:`);
  for (const r of landed) console.log(`    · ${r.id} — ${r.note}`);
}
const gates = rows.filter(r => r.state === 'GATE');
if (gates.length) {
  console.log(`\n  OPEN FOUNDER GATES — no seat may close these:`);
  for (const r of gates) console.log(`    · ${r.id} — ${r.title}`);
}

const failedMust = rows.filter(r => r.must && r.state !== 'PROVEN');
if (failedMust.length) {
  console.log(`\n  ✗ SPRINT DOES NOT CLOSE. ${failedMust.length} required claim(s) unproven:`);
  for (const r of failedMust) console.log(`    · ${r.id} — ${r.note}`);
  console.log('');
  process.exit(1);
}
console.log(`\n  ✓ every required claim re-derived. The sprint may close.\n`);
