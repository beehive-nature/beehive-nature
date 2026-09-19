/* Docs link-integrity gate (X4, 2026-09-19) — a relative link in a tracked
   markdown doc must point at something that exists in the tree.

   Scope and rules, as cut:
     1. Tracked `*.md` only, minus `docs/dispatches/` and `docs/receipts/`:
        both are dated records, never rewritten (false-signal law), so a rotted
        link inside one is history rather than a defect. They are still valid
        TARGETS — only their own bodies are out of scan.
     2. Skipped link forms: scheme/protocol-relative (`https:`, `mailto:`,
        `//host`), repo-absolute (`/x`), and pure anchors (`#x`). A `#frag`
        or `?query` suffix is trimmed before resolution.
     3. A directory target resolves when any tracked path sits under it —
        `git` tracks files, not directories.
     4. The match anchors on `](target)`, not on a well-formed `[text](…)`.
        An image-badge link — `[![alt](img)](./LICENSE)`, README.md:11 — has
        a `]` inside its own link text, so a pattern that forbids that
        character silently drops the target. That miss is what made this
        gate count 164 relative links where the Refill 6 census counted 165.

   EXEMPT rows: the silentpay-v2 handoff corpus (ed099888, 2026-09-16; the
   RULINGS-2026-09-16:16 durable pointer) landed with `verification/status.json`
   only. Its 64 links point at reproduction artifacts that never landed — a
   provenance gap in a RULED corpus, which is a Codex-seat/founder question and
   not a seat fix. Each row is named with the count it stands for.

   Z5 assertion (standing law from 2026-09-19, bGENEaLOGy): an exemption row
   must keep matching its offender. A row whose doc is gone, whose links now
   all resolve, or whose count has drifted is stale — and a stale row masks
   exactly the defect class this gate exists for, so it fails RED here and
   must be re-cut rather than widened. */
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

const OUT_OF_SCAN = ['docs/dispatches/', 'docs/receipts/'];
const docs = tracked.filter(p => p.endsWith('.md') && !OUT_OF_SCAN.some(d => p.startsWith(d)));

const LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const isExternal = t => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t) || t.startsWith('//');

// A tracked directory prefix — `git ls-files` lists files, so a link to a
// directory resolves when at least one tracked path lives under it.
const dirPrefixes = new Set();
for (const p of tracked) {
  const parts = p.split('/');
  for (let i = 1; i < parts.length; i++) dirPrefixes.add(parts.slice(0, i).join('/'));
}

const targetsIn = doc => {
  const out = [];
  for (const m of readFileSync(ROOT + doc, 'utf8').matchAll(LINK)) out.push(m[1].trim());
  return out;
};

const unresolvedIn = doc => {
  const dir = posix.dirname(doc);
  const out = [];
  for (const m of readFileSync(ROOT + doc, 'utf8').matchAll(LINK)) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('/') || isExternal(raw)) continue;
    const target = raw.split('#')[0].split('?')[0];
    if (!target) continue;
    const resolved = posix
      .normalize(posix.join(dir, target))
      .replace(/^\.\//, '')
      .replace(/\/$/, '');
    if (!trackedSet.has(resolved) && !dirPrefixes.has(resolved)) out.push(raw);
  }
  return out;
};

const EXEMPT = [
  {
    doc: 'docs/handoffs/silentpay-v2/docs/SPRINT-03-FUNDED.md',
    unresolved: 24,
    why: 'banked silentpay-v2 corpus: sprint03 verification artifacts never landed',
  },
  {
    doc: 'docs/handoffs/silentpay-v2/docs/SPRINT-02-QUALIFICATION.md',
    unresolved: 23,
    why: 'banked silentpay-v2 corpus: sprint02 verification artifacts never landed',
  },
  {
    doc: 'docs/handoffs/silentpay-v2/docs/IMPLEMENTATION.md',
    unresolved: 15,
    why: 'banked silentpay-v2 corpus: verification/current demo JSON never landed',
  },
  {
    doc: 'docs/handoffs/silentpay-v2/docs/EXSAT-SPIKE.md',
    unresolved: 2,
    why: 'banked silentpay-v2 corpus: local-spike.json and tools/spike/pins.json never landed',
  },
];
const exemptDocs = new Set(EXEMPT.map(r => r.doc));

test('the scanner actually reaches the estate docs', () => {
  assert.ok(docs.length > 300, `only ${docs.length} tracked docs in scan — scanner is broken`);
  const links = docs.reduce((n, d) => n + (readFileSync(ROOT + d, 'utf8').match(LINK) || []).length, 0);
  assert.ok(links > 100, `only ${links} markdown links seen — scanner is broken`);
});

test('the scanner sees image-badge link targets (coverage pin)', () => {
  // README.md:11 is `[![license: …](badge-url)](./LICENSE)` — the target sits
  // behind a `]` inside the link text. A pattern anchored on a well-formed
  // `[text](…)` drops it silently, which is how this gate first counted 164
  // relative links against the Refill 6 census's 165. Pin the coverage so a
  // narrowing of LINK fails here instead of going quiet.
  // README.md carries ./LICENSE twice: the badge at :11 and the plain link
  // at :126. A narrowed pattern still finds :126, so presence is not enough —
  // the count is what proves the badge form is covered.
  const seen = targetsIn('README.md').filter(t => t === './LICENSE');
  assert.equal(
    seen.length,
    2,
    'LINK no longer matches image-badge links — README.md:11 target is invisible',
  );
});

test('every relative link outside the exempt corpus resolves', () => {
  const offenders = [];
  for (const doc of docs) {
    if (exemptDocs.has(doc)) continue;
    const bad = unresolvedIn(doc);
    if (bad.length) offenders.push(`${doc} -> ${bad.join(', ')}`);
  }
  assert.deepEqual(offenders, [], 'these relative links point at nothing in the tree');
});

test('every exemption row still matches its offender (Z5 assertion)', () => {
  for (const row of EXEMPT) {
    assert.ok(trackedSet.has(row.doc), `exempt row ${row.doc} is no longer tracked — stale row, re-cut it`);
    const bad = unresolvedIn(row.doc);
    assert.ok(bad.length > 0, `exempt row ${row.doc} has no unresolved links left — stale row, delete it`);
    assert.equal(
      bad.length,
      row.unresolved,
      `exempt row ${row.doc} names ${row.unresolved} unresolved links but carries ${bad.length} — stale row, re-cut it`,
    );
  }
});
