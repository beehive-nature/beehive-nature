/* Surface static-ref gate (X5, 2026-09-19) — a relative href/src on a surface
   page must point at something that exists in the tree.

   Scope, as cut (Refill 6 §0): every tracked `surfaces/**.html`, every
   `href` / `src` / `xlink:href` on `<a|link|script|img|source|iframe|audio|
   video|use>`. Skipped: scheme and protocol-relative URLs, repo-absolute
   paths, pure anchors, and JS-built values — a value carrying `$`, `'`,
   a backtick or `+` is a concatenated expression inside a script, not a
   static path (three such values live in bnames.html and stack.html). A
   `#frag` or `?query` suffix is trimmed. A directory target resolves when any
   tracked path sits under it, because git tracks files, not directories.

   The defect this gate was cut for: the house marks live at repo-root
   `assets/house/` (7d33007e, 2026-08-30) and three favicon lines pointed one
   directory too shallow, at `surfaces/assets/house/`, which does not exist.
   Live confirmation in the map: skaists.dev/surfaces/assets/house/… 404,
   skaists.dev/assets/house/… 200. Blast radius is a missing favicon, no more.

   EXEMPT rows: the two `surfaces/blight/` pages belong to ZcODe's bLIGHT lane
   (profile.html additionally sits under the Z6 slice), and a second writer in
   another seat's organ is a worse defect than a missing favicon. Each row
   carries the exact one-line fix so the owner does not have to re-derive it.

   Z5 assertion (standing law, 2026-09-19): an exemption row must keep matching
   its offender. A row whose page is gone, or whose refs all resolve, is stale
   — and a stale row masks exactly the defect class this gate exists for, so it
   fails RED here and must be deleted rather than left standing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const trackedSet = new Set(tracked);
const dirPrefixes = new Set();
for (const p of tracked) {
  const parts = p.split('/');
  for (let i = 1; i < parts.length; i++) dirPrefixes.add(parts.slice(0, i).join('/'));
}

const pages = tracked.filter(p => p.startsWith('surfaces/') && p.endsWith('.html'));

const TAG = /<(?:a|link|script|img|source|iframe|audio|video|use)\b[^>]*>/gi;
const ATTR = /\b(?:href|src|xlink:href)\s*=\s*"([^"]*)"/i;
const DYNAMIC = /[$'`+]/;

const refsIn = page => {
  const dir = posix.dirname(page);
  const out = [];
  for (const m of readFileSync(ROOT + page, 'utf8').matchAll(TAG)) {
    const a = m[0].match(ATTR);
    if (!a) continue;
    const raw = a[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('/')) continue;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith('//')) continue;
    if (DYNAMIC.test(raw)) continue;
    const target = raw.split('#')[0].split('?')[0];
    if (!target) continue;
    const resolved = posix
      .normalize(posix.join(dir, target))
      .replace(/^\.\//, '')
      .replace(/\/$/, '');
    out.push({ raw, resolved, ok: trackedSet.has(resolved) || dirPrefixes.has(resolved) });
  }
  return out;
};

const unresolvedIn = page => refsIn(page).filter(r => !r.ok).map(r => r.raw);

const EXEMPT = [
  {
    page: 'surfaces/blight/index.html',
    owner: "ZcODe5.3max — bLIGHT lane",
    fix: 'href="../../assets/house/house-seal-roundel.svg"',
  },
  {
    page: 'surfaces/blight/profile.html',
    owner: "ZcODe5.3max — bLIGHT lane, page also under the Z6 slice",
    fix: 'href="../../assets/house/house-avatar-square.png"',
  },
];
const exemptPages = new Set(EXEMPT.map(r => r.page));

test('the scanner actually reaches the surfaces', () => {
  assert.ok(pages.length > 100, `only ${pages.length} surface pages in scan — scanner is broken`);
  const refs = pages.reduce((n, p) => n + refsIn(p).length, 0);
  assert.ok(refs > 500, `only ${refs} static refs seen — scanner is broken`);
});

test('every static ref outside the exempt pages resolves', () => {
  const offenders = [];
  for (const page of pages) {
    if (exemptPages.has(page)) continue;
    const bad = unresolvedIn(page);
    if (bad.length) offenders.push(`${page} -> ${bad.join(', ')}`);
  }
  assert.deepEqual(offenders, [], 'these static refs point at nothing in the tree');
});

test('every exemption row still matches its offender (Z5 assertion)', () => {
  for (const row of EXEMPT) {
    assert.ok(trackedSet.has(row.page), `exempt row ${row.page} is no longer tracked — stale row, delete it`);
    const bad = unresolvedIn(row.page);
    assert.ok(
      bad.length > 0,
      `exempt row ${row.page} has no unresolved refs left — stale row, delete it (${row.owner})`,
    );
  }
});
