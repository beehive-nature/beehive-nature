// music-cleanup.test.mjs — the focused receipts for the 2026-09-13 post-merge
// cleanup lane (bFUzZ, founder order 05:04Z): F1, the music.* machine-draft
// pass recorded in _meta.drafted, and R1, the z2sec probe asserting the
// hardened music.html directly instead of through the jams.html redirect
// shim. Static by design: node + fs only, no browser, fail-closed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('F1 receipt: the music.* machine-draft pass is recorded in _meta.drafted', async () => {
  const corpus = JSON.parse(await readFile(new URL('../surfaces/lang-corpus.json', import.meta.url), 'utf8'));
  assert.ok(corpus._meta?.drafted, '_meta.drafted exists');
  assert.match(corpus._meta.drafted, /2026-09-13 music\.\*/,
    'the drafted history names the 2026-09-13 music.* pass');
  assert.match(corpus._meta.drafted, /no human attestation claimed/,
    'the entry keeps the corpus law wording: drafts, not attestations');
});

test('R1 receipt: the z2sec probe targets music.html directly, not through the redirect shim', async () => {
  const probe = await readFile(new URL('./z2sec-probe.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(probe, /jams\.html/,
    'no jams.html navigation remains — the security receipt must not ride a redirect');
  assert.match(probe, /surfaces\/music\.html/, 'the probe navigates surfaces/music.html');
});
