import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildLocalEvidence, readLocalEvidenceInput } from './local-evidence-build.mjs';

const sha = (data) => createHash('sha256').update(data).digest('hex');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'skaists-local-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, out: join(root, 'evidence'),
    corpus: { persons: { pa: { living: false, refs: [{ provider: 'familysearch', id: 'ABCD-EFG' }] },
      pb: { living: false, refs: [] } } },
    index: { schema: 'skaists.sources/1', persons: {
      'fsid:ABCD-EFG': { iid: null, fsid: 'ABCD-EFG', sources: [{ id: 'rec1', affected: ['Birth'] }] },
      pb: { iid: 'pb', sources: [{ id: 'rec1', affected: ['Name'] }] } } },
    records: { schema: 'skaists.sources-records/1', records: { rec1: { id: 'rec1',
      title: 'Frozen provider assertion', citation: 'Birth, 3 October 1872', provider: 'familysearch',
      evidence: [{ factType: 'Birth', fieldType: 'Original', value: '3 October 1872' }] } } } };
}
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

test('local values and identities survive, with one digest object across person shards', (t) => {
  const f = fixture(t), original = JSON.stringify([f.corpus, f.index, f.records]);
  const file = join(f.root, 'saved-page.txt'), data = 'independently retained page bytes';
  writeFileSync(file, data);
  const result = buildLocalEvidence({ ...f, artifacts: [{ sourceId: 'rec1', file, digest: 'sha256:' + sha(data),
    mediaType: 'text/plain', locator: 'p. 12' }] });
  assert.deepEqual(result.manifest.crosswalk, { direct: 1, providerReferences: 1 });
  assert.equal(result.manifest.counts.objects, 1);
  for (const iid of ['pa', 'pb']) {
    const d = result.manifest.persons[iid], s = json(join(f.out, d.path));
    assert.equal(sha(readFileSync(join(f.out, d.path))), d.sha256);
    assert.equal(s.personId, iid);
    assert.equal(s.sources[0].evidence[0].value, '3 October 1872');
    const artifact = s.sources[0].artifacts[0];
    assert.equal(readFileSync(join(f.out, artifact.path), 'utf8'), data);
    assert.equal(artifact.verification, 'verified');
    assert.ok(!JSON.stringify(artifact).includes(file), 'private source filename is not exposed as the object location');
  }
  assert.equal(JSON.stringify([f.corpus, f.index, f.records]), original, 'frozen inputs unchanged');
});

test('independent sources retain supporting and contradicting bindings without changing a date', (t) => {
  const f = fixture(t);
  const store = { sources: {
    book: { schema: 'skaists.source/1', id: 'book', type: 'book', scope: 'collection',
      provider: 'Town archive', title: 'Town records', accessedAt: '2026-10-18', artifactRef: 'local book' },
    index: { schema: 'skaists.source/1', id: 'index', type: 'civil-register', scope: 'collection',
      provider: 'Town clerk', title: 'Original register', accessedAt: '2026-10-18', artifactRef: 'local register' },
  }, claims: { date: { schema: 'skaists.claim/1', id: 'date', subject: 'pa', predicate: 'birth', value: '1872-10-03' } },
  bindings: [
    { schema: 'skaists.source-binding/1', sourceId: 'book', claimId: 'date', relation: 'contradicts', context: 'birth',
      asserts: 'birth', quote: 'Born October 11', locator: 'p. 20' },
    { schema: 'skaists.source-binding/1', sourceId: 'index', claimId: 'date', relation: 'supports', context: 'birth',
      asserts: 'birth', locator: 'p. 40' },
  ], leads: [{ title: 'Unconfirmed research lead' }] };
  const result = buildLocalEvidence({ ...f, store });
  const sources = json(join(f.out, result.manifest.persons.pa.path)).sources;
  assert.deepEqual(sources.filter(s => s.claims).map(s => s.claims[0].binding.relation), ['contradicts', 'supports']);
  assert.equal(sources[0].evidence[0].value, '3 October 1872');
  assert.equal(json(join(f.out, 'source-store.json')).leads.length, 1);
  assert.equal(sources.length, 3, 'the lead was retained but not promoted to evidence');
});

test('unmatched or ambiguous identities, missing records and living stubs refuse before output', (t) => {
  for (const mutate of [
    f => f.corpus.persons.pa.refs = [],
    f => f.corpus.persons.pb.refs = [{ provider: 'familysearch', id: 'ABCD-EFG' }],
    f => delete f.records.records.rec1,
    f => f.corpus.persons.pa.living = true,
    f => f.index.persons['fsid:ABCD-EFG'].iid = 'wrong',
  ]) {
    const f = fixture(t); mutate(f);
    assert.throws(() => buildLocalEvidence(f));
    assert.equal(existsSync(f.out), false);
  }
});

test('digest mismatch cannot produce a package, nor replace an existing output', (t) => {
  const f = fixture(t), file = join(f.root, 'page.txt');
  writeFileSync(file, 'different page');
  assert.throws(() => buildLocalEvidence({ ...f, artifacts: [{ sourceId: 'rec1', file,
    digest: 'sha256:' + sha('expected page'), mediaType: 'text/plain' }] }), /digest mismatch/);
  assert.equal(existsSync(f.out), false);
  assert.equal(existsSync(f.out + '.preparing-' + process.pid), false);
  buildLocalEvidence(f);
  const before = readFileSync(join(f.out, 'manifest.json'), 'utf8');
  assert.throws(() => buildLocalEvidence(f), /fresh directory/);
  assert.equal(readFileSync(join(f.out, 'manifest.json'), 'utf8'), before);
});

test('artifacts need an explicit source association and local bytes, not provider locators', (t) => {
  const f = fixture(t), input = join(f.root, 'input.json');
  writeFileSync(input, JSON.stringify({ schema: 'skaists.local-evidence-input/1', artifacts: [
    { sourceId: 'rec1', file: 'https://familysearch.org/page' } ] }));
  assert.throws(() => readLocalEvidenceInput(input), /never a URL/);
  assert.throws(() => buildLocalEvidence({ ...f, artifacts: [{ sourceId: 'guessed', file: input,
    digest: 'sha256:' + sha('x'), mediaType: 'text/plain' }] }), /explicit held sourceId/);
  const target = join(f.root, 'page.txt'), link = join(f.root, 'link.txt');
  writeFileSync(target, 'page'); symlinkSync(target, link);
  assert.throws(() => buildLocalEvidence({ ...f, artifacts: [{ sourceId: 'rec1', file: link,
    digest: 'sha256:' + sha('page'), mediaType: 'text/plain' }] }), /symlink/);
});

test('oversized person shards refuse before an incomplete catalog becomes visible', (t) => {
  const f = fixture(t);
  f.records.records.rec1.evidence[0].value = 'x'.repeat(4 * 1024 * 1024);
  assert.throws(() => buildLocalEvidence(f), /bounded reader size/);
  assert.equal(existsSync(f.out), false);
});

test('an unbound local source cannot borrow an imported id or contradictory person alias', (t) => {
  const f = fixture(t);
  const store = { sources: { rec1: { schema: 'skaists.source/1', id: 'rec1', type: 'book', scope: 'item',
    provider: 'Town archive', title: 'Different book', accessedAt: '2026-10-18', artifactRef: 'local book' } },
    claims: {}, bindings: [], leads: [] };
  assert.throws(() => buildLocalEvidence({ ...f, store }), /collides/);
  f.index.persons.pb.fsid = 'ABCD-EFG';
  assert.throws(() => buildLocalEvidence(f), /provider reference contradicts/);
  assert.equal(existsSync(f.out), false);
});

test('Windows network shares are not local acquisition inputs', (t) => {
  const f = fixture(t), input = join(f.root, 'input.json');
  for (const file of ['//server/share/page.jpg', String.raw`\\server\share\page.jpg`]) {
    writeFileSync(input, JSON.stringify({ schema: 'skaists.local-evidence-input/1', artifacts: [{ file }] }));
    assert.throws(() => readLocalEvidenceInput(input), /network share/);
  }
});
