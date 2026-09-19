/* No stray tracked temp files (Refill 4 S1, 2026-09-19).
   A tracked `*.tmp*` file is a working copy that escaped into the repo: it
   ships with every deploy of the tree (the root strays patch-drift.tmp.mjs
   and buzz-listings.tmp.json were both served 200 by skaists.dev), and
   nothing reads it. Rule: no path tracked by git may have a basename that
   matches /\.tmp(\.|$)/. `scripts/tmp/` is a directory, not a basename
   match, and is not affected.
   Exemptions are rows with an owner; each row asserts its file is still
   tracked, so the row must be deleted in the change that removes the file. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STRAY = /\.tmp(\.|$)/;

const EXEMPT = new Map([
  // Tracked near-copy of blight/workbench.html; its deletion is ZcODe's #136.
  ['surfaces/workbench.tmp', 'ZcODe5.3max #136'],
]);

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0').filter(Boolean);

test('git ls-files is actually listing the repo', () => {
  assert.ok(tracked.length > 1000, `only ${tracked.length} tracked paths — wrong cwd?`);
});

test('no tracked basename matches .tmp outside the exemption rows', () => {
  const offenders = tracked.filter(p => STRAY.test(p.split('/').pop()) && !EXEMPT.has(p));
  assert.deepEqual(offenders, []);
});

test('every exemption row still names a tracked stray', () => {
  for (const [p, owner] of EXEMPT) {
    assert.ok(tracked.includes(p), `${p} is gone — delete its row (owner ${owner})`);
    assert.ok(STRAY.test(p.split('/').pop()), `${p} does not match the stray rule — row is dead`);
  }
});
