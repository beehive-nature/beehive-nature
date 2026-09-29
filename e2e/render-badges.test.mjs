// render-badges.test.mjs — the proof-lights gate against known forgeries (review of #250, 2026-09-27).
//
// Each probe copies docs/status/ to a scratch dir, forges one thing the way an
// editor (or a careless regeneration) would, and runs the real `--check` over it.
// Every forgery below PASSED the first gate (4ad06132): it compared the SVG with
// the document and never re-derived the document from its evidence. A badge is
// only as honest as the weakest link in revision -> evidence -> document -> SVG,
// so each link has a probe that must turn the per-badge line to FAIL and the exit
// nonzero. The control proves the probes fail for their forgery, not for the harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATUS = join(HERE, '..', 'docs', 'status');
const DOC = 'skaists-meter.json', EV = 'skaists-meter.source.json', SVG = 'skaists-meter.svg';
const blobId = b => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const sha3 = b => createHash('sha3-256').update(b).digest('hex');

async function probe(forge) {
  const dir = await mkdtemp(join(tmpdir(), 'proof-lights-'));
  try {
    await cp(STATUS, dir, { recursive: true });
    const doc = JSON.parse(await readFile(join(dir, DOC), 'utf8'));
    const put = d => writeFile(join(dir, DOC), JSON.stringify(d, null, 1) + '\n');
    // re-seal the evidence the way a forger would: new bytes, matching blob id and digest
    const reseal = async bytes => {
      await writeFile(join(dir, EV), bytes);
      doc.source_blob = blobId(bytes);
      doc.source_digest = { ...doc.source_digest, value: sha3(bytes) };
    };
    await forge({ dir, doc, put, reseal });
    const r = spawnSync(process.execPath, [join(HERE, 'render-badges.mjs'), '--check', '--dir', dir], { encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
const refused = (r, why) => {
  assert.notEqual(r.code, 0, `gate exited 0:\n${r.out}`);
  // scoped to the forged document: a second, untouched badge may legitimately PASS beside it
  assert.doesNotMatch(r.out, /^PASS skaists-meter\.json/m, `the forged badge's line still says PASS:\n${r.out}`);
  assert.match(r.out, /^FAIL skaists-meter\.json/m, `the forged badge has no FAIL line:\n${r.out}`);
  assert.match(r.out, why, r.out);
};

test('control: the committed badge passes, re-derived from its evidence', async () => {
  const r = await probe(() => {});
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^PASS skaists-meter\.json: .*re-derived from 321 evidence rows/m);
});

test('deleted evidence fails (it used to print PASS with "no source file committed")', async () => {
  refused(await probe(({ dir }) => rm(join(dir, EV))), /evidence .* is missing or unreadable/);
});

test('inflated counts + message with a matching SVG fail: the document is re-derived, not trusted', async () => {
  refused(await probe(async ({ dir, doc, put }) => {
    Object.assign(doc, { fronts: 999, fronts_at_100: 999, message: '999/999 fronts 100% @7d6808d' });
    await put(doc);
    const { makeBadge } = createRequire(import.meta.url)('badge-maker');
    await writeFile(join(dir, SVG), makeBadge({ label: doc.label, message: doc.message, color: doc.color, style: 'flat' }));
  }), /fronts is 999, evidence derives 321/);
});

test('a well-formed but nonexistent revision fails: forty hex chars are not a commit', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, revision: '0'.repeat(40) })), /is not a commit in this repository/);
});

test('a supplied signature fails as unverified and does not hide the unsigned state', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, signature: { alg: 'rot13', value: 'trust me' } })), /signature supplied but no verifier exists: UNVERIFIED/);
});

test('non-JSON evidence fails even with its blob id and digest updated to match', async () => {
  refused(await probe(async ({ doc, put, reseal }) => { await reseal(Buffer.from('not json\n')); await put(doc); }), /evidence is not JSON/);
});

test('a source-hash mismatch turns the per-badge line to FAIL, not only the exit code', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, source_blob: 'f'.repeat(40) })), /source blob mismatch/);
});

test('a SHA-1-only rebind fails: the sha3-256 digest is the integrity commitment', async () => {
  refused(await probe(async ({ dir, doc, put }) => {
    const bytes = Buffer.concat([await readFile(join(dir, EV)), Buffer.from(' ')]);   // any edit, SHA-1 locator updated
    await writeFile(join(dir, EV), bytes);
    await put({ ...doc, source_blob: blobId(bytes) });
  }), /source digest mismatch/);
});

test('a duplicated row cannot stand in for a missing one: coverage is checked against the manifest', async () => {
  refused(await probe(async ({ dir, doc, put, reseal }) => {
    const rows = JSON.parse(await readFile(join(dir, EV), 'utf8'));
    rows[1] = rows[0];   // same count, one front measured twice, one never
    await reseal(Buffer.from(JSON.stringify(rows, null, 1) + '\n'));
    await put(doc);
  }), /coverage: .* measured 2 times[\s\S]*not measured/);
});

test('a malformed row fails the evidence schema', async () => {
  refused(await probe(async ({ dir, doc, put, reseal }) => {
    const rows = JSON.parse(await readFile(join(dir, EV), 'utf8'));
    rows[5].score.COLOUR = 'green';
    await reseal(Buffer.from(JSON.stringify(rows, null, 1) + '\n'));
    await put(doc);
  }), /evidence row 5: score is not the six kinds/);
});

test('a CI-origin claim fails until something binds run id + attempt to the revision', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, measurement: { origin: 'ci', run_id: 1, run_attempt: 1 } })), /origin ci .* not verifiable yet/);
});

test('forged fixed metadata fails: the renderer and the law are exactly what derive writes', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, renderer: 'badge-maker 9.9.9 (live, signed)' })), /renderer is .* the installed renderer is badge-maker/);
  refused(await probe(({ doc, put }) => put({ ...doc, law: 'live status, signed by the founder' })), /law is not the fixed statement/);
  refused(await probe(({ doc, put }) => put({ ...doc, law: { live: true } })), /law is not the fixed statement/);
});

test('an inherited property name is not a badge: the check reports it, it does not crash', async () => {
  for (const name of ['constructor', '__proto__', 'toString']) {
    const r = await probe(({ doc, put }) => put({ ...doc, name }));
    refused(r, /no derivation for badge/);
    assert.doesNotMatch(r.out, /TypeError|at verify/, r.out);
  }
});

test('measured_at must be a canonical UTC timestamp: Date.parse leniency is refused', async () => {
  for (const t of ['0', '2026-02-31T00:00:00.000Z', '2026-99-01T00:00:00.000Z', '2026-09-27T25:00:00.000Z', '2026-09-27', 'Sep 27 2026']) {
    refused(await probe(({ doc, put }) => put({ ...doc, measured_at: t })), /measured_at .* is not a canonical ISO-8601 UTC timestamp/);
  }
});

test('a malformed document fails alone: the check continues and the good badge still passes', async () => {
  for (const body of ['null', '[]', '42', '"text"']) {
    const r = await probe(({ dir }) => writeFile(join(dir, 'aa-malformed.json'), body + '\n'));
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /^FAIL aa-malformed\.json: \n  - document is not a JSON object/m, r.out);
    assert.match(r.out, /^PASS skaists-meter\.json/m, `the check stopped at the malformed document:\n${r.out}`);
    assert.match(r.out, /1\/2 badges/, r.out);
  }
});

test('an all-clear row cannot hide a failed kind: no findings means every kind is 100', async () => {
  refused(await probe(async ({ dir, doc, put, reseal }) => {
    const rows = JSON.parse(await readFile(join(dir, EV), 'utf8'));
    const i = rows.findIndex(r => r.total === 100 && r.bad.length === 0);
    rows[i].score.COLOUR = 0;   // total 100 still sits between the kind extremes [0, 100]
    await reseal(Buffer.from(JSON.stringify(rows, null, 1) + '\n'));
    await put({ ...doc, kind_min: { ...doc.kind_min, COLOUR: 0 } });   // the derivation agrees, so only the row law can catch it
  }), /all-clear row with a kind below 100 \(COLOUR\)/);
});

test('a renamed status trio fails: the file name is the badge name', async () => {
  const r = await probe(async ({ dir }) => {
    for (const x of ['.json', '.source.json', '.svg']) await cp(join(dir, 'skaists-meter' + x), join(dir, 'other' + x));
    for (const x of ['.json', '.source.json', '.svg']) await rm(join(dir, 'skaists-meter' + x));
  });
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /^FAIL other\.json: .*\n  - file other\.json does not carry the document's name "skaists-meter"/m, r.out);
  assert.doesNotMatch(r.out, /^PASS /m, r.out);
});

test('an SVG-only edit fails', async () => {
  refused(await probe(async ({ dir }) => {
    const s = await readFile(join(dir, SVG), 'utf8');
    await writeFile(join(dir, SVG), s.replace('321/321', '322/321'));
  }), /svg DIFFERS from render\(json\)/);
});

test('zero status documents fail closed', async () => {
  const r = await probe(async ({ dir }) => { for (const f of await readdir(dir)) await rm(join(dir, f)); });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /REFUSING — no status documents/);
});
