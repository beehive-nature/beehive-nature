/* No machine-local paths in tracked tooling (Refill 4 S2, 2026-09-19).
   A default pointing into one seat's home folder makes a gate run against
   whatever that folder holds on one laptop: bnames-gate.mjs reported 21/21
   for a worktree 887 commits behind main. Rule: no tracked e2e/ or scripts/
   executable (.mjs .js .sh .py) may contain a user-home path.
   Exemptions are rows with an owner; each row asserts its file still has a
   hit, so the row must be deleted in the change that fixes the file. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOCAL = [
  /C:\/Users\//i,
  /C:\\Users\\/i,
  /\/mnt\/c\/Users\//i,
  /\/home\/[a-z_][a-z0-9_-]*\//,
  /file:\/\/\/C:\//i,
];

const EXEMPT = new Map([
  ['e2e/watch-room-shot.mjs', 'watch lane'],
  ['e2e/ceb9-probe.mjs', 'O3 DELETE-CANDIDATE'],
  ['scripts/mirror-harvest.mjs', 'SPEC-MIRROR-COMMONS-1:33'],
  ['scripts/x0x-622/test_runner.py', 'x0x #622 lane'],
  ['scripts/thp_pair_receipt.py', 'goose device lane'],
]);

const files = execFileSync('git', ['ls-files', '-z', '--', 'e2e', 'scripts'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0').filter(p => /\.(mjs|js|sh|py)$/.test(p));
const hits = p => LOCAL.some(re => re.test(readFileSync(join(ROOT, p), 'utf8')));

test('git ls-files is actually listing the tooling', () => {
  assert.ok(files.length > 100, `only ${files.length} tracked e2e/scripts executables — wrong cwd?`);
});

test('no machine-local path outside the exemption rows', () => {
  const offenders = files.filter(p => !EXEMPT.has(p) && hits(p));
  assert.deepEqual(offenders, []);
});

test('every exemption row still names a file with a hit', () => {
  for (const [p, owner] of EXEMPT) {
    assert.ok(files.includes(p), `${p} is not tracked — delete its row (owner ${owner})`);
    assert.ok(hits(p), `${p} has no local path now — delete its row (owner ${owner})`);
  }
});
