/* Tracked .json parses, and the Luna Seals archive is byte-true (Refill 6 X3, 2026-09-19).
   The hex-law hook forces a same-line PUBLIC-CONSTANT comment onto hex-shaped
   values, and a comment makes a .json file stop being JSON. Such files ship as
   *.json.txt (F3 precedent, ea9c0de6) with a documented strip. The Luna Seals
   MANIFEST records sha256 and bytes of the stripped metadata, so the archive is
   checked here by stripping exactly that marker and nothing else. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SEALS = 'assets/museum/luna-seals';
const MARKER = / \/\* PUBLIC-CONSTANT[^*]*\*\//g;

const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.json'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0').filter(Boolean);
const read = p => readFileSync(join(ROOT, p));
const sha = b => createHash('sha256').update(b).digest('hex');
const strip = b => Buffer.from(b.toString('utf8').replace(MARKER, ''), 'utf8');

test('git ls-files is actually listing the JSON', () => {
  assert.ok(tracked.length > 100, `only ${tracked.length} tracked .json files — wrong cwd?`);
});

test('every tracked .json file parses', () => {
  const invalid = tracked.filter(p => {
    try { JSON.parse(read(p).toString('utf8')); return false; } catch { return true; }
  });
  assert.deepEqual(invalid, []);
});

test('Luna Seals: each exhibit matches the manifest byte for byte', () => {
  const manifest = JSON.parse(strip(read(`${SEALS}/MANIFEST.json.txt`)).toString('utf8'));
  assert.equal(manifest.items.length, 4);
  for (const item of manifest.items) {
    const stem = `${SEALS}/${item.name.replace(/\.base\.eth$/, '')}`;
    const svg = read(`${stem}.cardImage.svg`);
    assert.equal(svg.length, item.svg_bytes, `${stem}.cardImage.svg bytes`);
    assert.equal(sha(svg), item.svg_sha256, `${stem}.cardImage.svg sha256`);
    const meta = strip(read(`${stem}.metadata.json.txt`));
    assert.equal(meta.length, item.meta_bytes, `${stem}.metadata.json.txt stripped bytes`);
    assert.equal(sha(meta), item.meta_sha256, `${stem}.metadata.json.txt stripped sha256`);
    JSON.parse(meta.toString('utf8'));
  }
});
