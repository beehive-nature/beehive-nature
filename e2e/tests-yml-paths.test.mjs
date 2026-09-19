/* Every path on a `node --test` line in tests.yml exists (Refill 4 S5, 2026-09-19).
   `node --test present.test.mjs missing.test.mjs` runs the present file and
   exits 0: a listed gate that was renamed or deleted stops running and CI stays
   green (k001 class). Rule: each file argument of every `node --test` command
   in .github/workflows/tests.yml, resolved against its step's
   `working-directory`, is tracked by git. This test reads tests.yml and never
   edits it; the file stays with its owner (#137). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKFLOW = '.github/workflows/tests.yml';

const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0').filter(Boolean));

// Walk the workflow one step at a time; a step starts at `- name:` or `- uses:`.
const listed = [];
let wd = '.';
for (const [i, line] of readFileSync(new URL('../' + WORKFLOW, import.meta.url), 'utf8').split(/\r?\n/).entries()) {
  if (/^\s*- (name|uses):/.test(line)) wd = '.';
  const w = line.match(/^\s*working-directory:\s*(\S+)\s*$/);
  if (w) wd = w[1].replace(/^["']|["']$/g, '');
  const at = line.indexOf('node --test');
  if (at < 0) continue;
  for (const tok of line.slice(at + 'node --test'.length).split(/(?:&&|\|\||;|\||>)/)[0].trim().split(/\s+/)) {
    if (!tok || tok.startsWith('-')) continue;
    listed.push({ line: i + 1, arg: tok, path: posix.normalize(posix.join(wd, tok)) });
  }
}

test('the parser is actually finding the node --test lines', () => {
  assert.ok(new Set(listed.map(l => l.line)).size >= 5, `only ${listed.length} args found`);
  assert.ok(listed.length >= 30, `only ${listed.length} args found`);
});

test('no node --test argument is a glob (a glob cannot be checked by name)', () => {
  assert.deepEqual(listed.filter(l => /[*?[{]/.test(l.arg)).map(l => `${WORKFLOW}:${l.line} ${l.arg}`), []);
});

test('every node --test path in tests.yml is tracked by git', () => {
  const absent = listed.filter(l => !tracked.has(l.path)).map(l => `${WORKFLOW}:${l.line} ${l.path}`);
  assert.deepEqual(absent, []);
});
