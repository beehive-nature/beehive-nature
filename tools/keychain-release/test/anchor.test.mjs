// anchor.test.mjs — tools/keychain-release/anchor.mjs: the canonical anchor json, the build that
// chains release 1 to the genesis anchor read from Hive, and the quorum classes (operators
// simulated: no network in this suite; the live read is `anchor.mjs genesis` / `anchor.mjs verify`).
//
// genesis-anchor.json is the exact json string of bnr.anchor at block 108404167, trx 7d404d75…,
// written by `anchor.mjs genesis --out` on 2026-10-12 when 4 of 4 operators (api.hive.blog,
// api.openhive.network, api.deathwing.me, techcoderx.com) returned the same 620 bytes, irreversible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENESIS, anchorJson, assess, buildAnchor, normalizeNode, normalizeNodes, parseAnchor } from '../anchor.mjs';
import { BPQ, assemble, b64u, envelope, openEnvelope, sha256, sha3, sigBytesOf, testKeys } from '../release.mjs';

const CLI = fileURLToPath(new URL('../anchor.mjs', import.meta.url));
const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' });
const GENESIS_JSON = readFileSync(fileURLToPath(new URL('genesis-anchor.json', import.meta.url)));
const GOLDEN = testKeys('golden'), OTHER = testKeys('other');
const signAt = (k, bytes, at = '2026-10-12T00:00:00Z') => sigBytesOf(BPQ.signFile(k, new Uint8Array(bytes), at));
const record = assemble({ files: [{ path: 'index.html', bytes: Buffer.from('<!doctype html>\n') }], seq: 1, prev: null, signers: [GOLDEN.id], commit: 'c'.repeat(40) }).bytes;
const sig = signAt(GOLDEN, record);
const REC = { sha256: b64u(sha256(record)), sha3: b64u(sha3(record)), size: record.length };

// simulated operators
const LIB = 110000005;
const G = { block: GENESIS.block, trx: GENESIS.trx, op_in_trx: 0, json: GENESIS_JSON.toString('utf8') };
const R = { block: 110000000, trx: 'a'.repeat(40), op_in_trx: 0, json: buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: GENESIS_JSON, seq: 1 }).json };
const ops = (...xs) => new Map(xs.map(x => [`${x.trx}:${x.op_in_trx}`, x]));
const node = (url, lib, ...xs) => ({ url, ok: true, lib, ops: ops(...xs) });
const yes = async () => true;
const opts = { recordBytes: record, sigBytes: sig };

test('the genesis fixture is the 620-byte chain string, and its sha3 is the pin', () => {
  assert.equal(GENESIS_JSON.length, GENESIS.size);
  assert.equal(b64u(sha3(GENESIS_JSON)), 'O4n0MUUDIN24chEO6f07XnGXUgFlqi16PauvsAp0zUs');
  assert.equal(GENESIS.sha3, b64u(sha3(GENESIS_JSON)));
  assert.equal(JSON.parse(GENESIS_JSON).seq, 0);
});

test('anchor canonical bytes are stable (golden), whatever order the fields arrive in', () => {
  assert.equal(GOLDEN.id, 'bzpq1r8y5d8nmnhj4f2l9e2lhy4k03tt8r6gxr80pyx4g45z9r3fu2h4q38jf5z');
  const fields = { sig: { sha3: 'M'.repeat(43), bpq: GOLDEN.id }, seq: 1, rec: { size: 1241, sha3: 'I'.repeat(43), sha256: 'E'.repeat(43) }, prev: 'A'.repeat(43), loc: ['ar:tx', 'ant:addr'] };
  const a = anchorJson(fields);
  assert.equal(a, '{"loc":["ar:tx","ant:addr"],"prev":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","rec":{"sha256":"EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE","sha3":"IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII","size":1241},"seq":1,"sig":{"bpq":"bzpq1r8y5d8nmnhj4f2l9e2lhy4k03tt8r6gxr80pyx4g45z9r3fu2h4q38jf5z","sha3":"MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM"},"subject":"keys.skaists.dev","type":"release","v":1}');
  assert.equal(b64u(sha3(Buffer.from(a, 'latin1'))), 'iev_3NEprd1jFr23E2AlIdW1P67nc-jtNKVHC6-TuqU');
  assert.equal(anchorJson({ loc: fields.loc, prev: fields.prev, rec: fields.rec, seq: 1, sig: fields.sig }), a);
  assert.throws(() => parseAnchor(Buffer.from(a.replace('"v":1', '"v": 1'))), /insignificant whitespace/);
  assert.throws(() => anchorJson({ ...fields, prev: 'b'.repeat(64) }), /prev is not a base64url/);
});

test('anchor build: release 1 follows the pinned genesis, carries its record\'s seq and its signature\'s one byte form; refusals', () => {
  const one = buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: GENESIS_JSON, seq: 1, loc: ['ar:' + 'A'.repeat(43)] });
  const a = parseAnchor(Buffer.from(one.json, 'latin1'));
  assert.equal(a.prev, 'O4n0MUUDIN24chEO6f07XnGXUgFlqi16PauvsAp0zUs');
  assert.deepEqual(a.rec, REC);
  assert.deepEqual(a.sig, { bpq: GOLDEN.id, sha3: b64u(sha3(sig)) });
  // the envelope carries the same signature bytes, so sig.sha3 recomputes from it
  assert.equal(b64u(sha3(openEnvelope(envelope(record, sig)).sigBytes)), a.sig.sha3);
  assert.deepEqual(one.op, ['custom_json', { required_auths: [], required_posting_auths: ['loviswater'], id: 'bnr.anchor', json: one.json }]);
  assert.equal(buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: GENESIS_JSON, seq: 1, loc: ['ar:' + 'A'.repeat(43)] }).json, one.json);
  // the anchor's seq is the record's seq, and it follows the previous anchor's
  assert.throws(() => buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: GENESIS_JSON, seq: 2 }), /--seq 2 is not the record's seq 1/);
  const rec2 = assemble({ files: [{ path: 'index.html', bytes: Buffer.from('<!doctype html>\n') }], seq: 2, prev: REC.sha3, signers: [GOLDEN.id], commit: 'c'.repeat(40) }).bytes;
  assert.throws(() => buildAnchor({ recordBytes: rec2, sigBytes: signAt(GOLDEN, rec2), prevJson: GENESIS_JSON, seq: 2 }), /does not follow the previous anchor's seq 0/);
  assert.throws(() => buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: Buffer.from('{"seq":0}'), seq: 1 }), /not the pinned genesis/);
  assert.throws(() => buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: Buffer.concat([GENESIS_JSON, Buffer.from('\n')]), seq: 1 }), /ends in a newline/);
  assert.throws(() => buildAnchor({ recordBytes: record, sigBytes: Buffer.from(JSON.stringify(JSON.parse(sig), null, 1) + '\n'), prevJson: GENESIS_JSON, seq: 1 }), /not its one byte form/);
  const other = assemble({ files: [{ path: 'index.html', bytes: Buffer.from('other') }], seq: 1, prev: null, signers: [GOLDEN.id], commit: 'c'.repeat(40) }).bytes;
  assert.throws(() => buildAnchor({ recordBytes: other, sigBytes: sig, prevJson: GENESIS_JSON, seq: 1 }), /not over this record/);

  const dir = mkdtempSync(join(tmpdir(), 'kc-anchor-test-'));
  try {
    const files = { record: join(dir, 'record.json'), sig: join(dir, 'record.json.relsig.json'), prev: join(dir, 'genesis.json') };
    writeFileSync(files.record, record); writeFileSync(files.sig, sig); writeFileSync(files.prev, GENESIS_JSON);
    const base = ['build', '--record', files.record, '--sig', files.sig, '--prev-json', files.prev, '--seq', '1'];
    const cli = run(...base, '--loc', 'ar:' + 'A'.repeat(43), '--out', join(dir, 'anchor.json'));
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(JSON.parse(cli.stdout).json, one.json);
    assert.equal(readFileSync(join(dir, 'anchor.json'), 'latin1'), one.json);
    const nonAscii = run(...base, '--loc', 'ar:é');
    assert.equal(nonAscii.status, 1);
    assert.match(nonAscii.stderr, /printable ASCII only/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('quorum classes over simulated operators; a DIVERGENT anchor never links into the chain', async () => {
  let r = await assess([node('a', LIB, G, R), node('b', LIB, G, R)], yes, opts);
  assert.deepEqual([r.genesis.class, r.genesis.pinned, r.genesis.starts_chain], ['ANCHORED-TERMINAL', true, true]);
  assert.deepEqual(r.chain.map(c => [c.seq, c.class]), [[1, 'ANCHORED-TERMINAL']]);
  assert.deepEqual([r.release.class, r.release.on_chain, r.release.seq], ['ANCHORED-TERMINAL', true, 1]);
  assert.deepEqual(r.divergent, []);

  r = await assess([node('a', LIB, G, R), node('b', 109999999, G)], yes, opts);   // b lags below the block
  assert.equal(r.release.class, 'ANCHORED-AS-REPORTED');

  r = await assess([node('a', LIB, G, R), node('b', LIB, G, { ...R, json: R.json.replace('"seq":1', '"seq":2') })], yes, opts);
  assert.equal(r.divergent[0].class, 'DIVERGENT');
  assert.equal(r.release.class, 'DIVERGENT');
  assert.deepEqual([r.chain.length, r.head], [0, null]);

  // b is past the block and omits it: DIVERGENT, so it is not linked, not the head, and it is listed
  r = await assess([node('a', LIB, G, R), node('b', LIB, G)], yes, opts);
  assert.match(r.release.anchor.why, /omits it/);
  assert.equal(r.release.class, 'DIVERGENT');
  assert.deepEqual([r.chain.length, r.head, r.orphans.length], [0, null, 0]);
  assert.deepEqual(r.divergent.map(d => [d.trx, d.class]), [[R.trx, 'DIVERGENT']]);
  assert.match(r.divergent[0].why, /irreversible history at b omits it/);

  // b's account history lists it and its block does not carry it: the same
  r = await assess([node('a', LIB, G, R), node('b', LIB, G, R)], async (url, op) => !(url === 'b' && op.trx === R.trx), opts);
  assert.equal(r.genesis.class, 'ANCHORED-TERMINAL');
  assert.equal(r.release.class, 'DIVERGENT');
  assert.deepEqual([r.chain.length, r.head], [0, null]);
  assert.deepEqual(r.divergent.map(d => [d.trx, d.class]), [[R.trx, 'DIVERGENT']]);

  r = await assess([node('a', 109999999, G, R), node('b', 109999999, G, R)], yes, opts);
  assert.equal(r.release.class, 'INCONCLUSIVE');

  r = await assess([node('a', LIB, G), node('b', LIB, G)], yes, opts);
  assert.deepEqual([r.release.class, r.head], ['SIGNED-UNANCHORED', null]);

  r = await assess([node('a', LIB, G), { url: 'b', ok: false, error: 'down' }], yes, opts);
  assert.equal(r.release.class, 'INCONCLUSIVE');

  // an anchor that follows something other than the genesis is an orphan
  const orphan = { ...R, trx: 'b'.repeat(40), json: anchorJson({ loc: [], prev: b64u(sha3(Buffer.from('{"seq":0}'))), rec: REC, seq: 1, sig: { bpq: GOLDEN.id, sha3: b64u(sha3(sig)) } }) };
  r = await assess([node('a', LIB, G, orphan), node('b', LIB, G, orphan)], yes, opts);
  assert.deepEqual([r.chain.length, r.orphans.length, r.release.on_chain], [0, 1, false]);
});

test('an anchor names the release only when rec, sig.bpq, sig.sha3 and seq all match', async () => {
  const at = (trx, json) => ({ block: 110000000, trx: trx.repeat(40), op_in_trx: 0, json });
  const both = (...xs) => [node('a', LIB, G, ...xs), node('b', LIB, G, ...xs)];
  // another signer's signature over the same record bytes, anchored: on the chain, but not this release
  const byOther = at('c', buildAnchor({ recordBytes: record, sigBytes: signAt(OTHER, record), prevJson: GENESIS_JSON, seq: 1 }).json);
  let r = await assess(both(byOther), yes, opts);
  assert.deepEqual(r.chain.map(c => [c.seq, c.signer, c.class]), [[1, OTHER.id, 'ANCHORED-TERMINAL']]);
  assert.deepEqual([r.release.class, r.release.anchor], ['SIGNED-UNANCHORED', null]);
  assert.match(r.release.same_record_other_anchors[0].not_this_release, new RegExp(`witnesses a signature by ${OTHER.id}, not ${GOLDEN.id}`));
  // the same signer, another signature file over the same record (another time)
  const later = signAt(GOLDEN, record, '2026-10-13T00:00:00Z');
  const byLater = at('d', buildAnchor({ recordBytes: record, sigBytes: later, prevJson: GENESIS_JSON, seq: 1 }).json);
  r = await assess(both(byLater), yes, opts);
  assert.equal(r.release.class, 'SIGNED-UNANCHORED');
  assert.match(r.release.same_record_other_anchors[0].not_this_release, /another signature file/);
  r = await assess(both(byLater), yes, { recordBytes: record, sigBytes: later });
  assert.deepEqual([r.release.class, r.release.on_chain], ['ANCHORED-TERMINAL', true], 'the signature it witnesses is that release');
  // an anchor whose seq is not the record's seq names no release
  const wrongSeq = at('e', anchorJson({ loc: [], prev: GENESIS.sha3, rec: REC, seq: 2, sig: { bpq: GOLDEN.id, sha3: b64u(sha3(sig)) } }));
  r = await assess(both(wrongSeq), yes, opts);
  assert.equal(r.release.class, 'SIGNED-UNANCHORED');
  assert.match(r.release.same_record_other_anchors[0].not_this_release, /anchor seq 2 is not the record's seq 1/);
  // the envelope is the same evidence as record.json + record.json.relsig.json
  const e = openEnvelope(envelope(record, sig));
  r = await assess(both(R), yes, { recordBytes: e.recordBytes, sigBytes: e.sigBytes });
  assert.deepEqual([r.release.class, r.release.sig_sha3], ['ANCHORED-TERMINAL', b64u(sha3(sig))]);
});

test('operators: scheme, host and port, normalized; one operator listed twice is one vote', async () => {
  assert.deepEqual(normalizeNodes(['https://api.hive.blog', 'https://API.Hive.blog/', 'https://api.hive.blog:443', ' https://api.openhive.network/ ']), ['https://api.hive.blog', 'https://api.openhive.network']);
  assert.equal(normalizeNode('https://techcoderx.com:8443'), 'https://techcoderx.com:8443');
  assert.equal(normalizeNode('http://127.0.0.1:8091'), 'http://127.0.0.1:8091');
  for (const bad of ['http://api.hive.blog', 'https://api.hive.blog/rpc', 'https://api.hive.blog/?x=1', 'https://api.hive.blog/#f', 'https://u:p@api.hive.blog', 'api.hive.blog']) {
    assert.throws(() => normalizeNode(bad), /^Error: node /, bad);
  }
  const r = await assess([node('https://api.hive.blog', LIB, G, R), node('https://API.hive.blog/', LIB, G, R)], yes, opts);
  assert.deepEqual([r.operators.length, r.duplicate_operators], [1, ['https://API.hive.blog/']]);
  assert.deepEqual([r.genesis.class, r.genesis.starts_chain, r.chain.length], ['ANCHORED-AS-REPORTED', false, 0]);
  assert.deepEqual([r.release.class, r.release.on_chain], ['ANCHORED-AS-REPORTED', false]);
  // the command line normalizes --nodes before any request
  const cli = run('verify', '--nodes', 'https://api.hive.blog/rpc');
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /no path, query, fragment or credentials/);
});

test('the chain starts only at the pinned genesis json, ANCHORED-TERMINAL', async () => {
  // operators agree on other bytes at the genesis block and trx: not the pin, so nothing links
  const fakeJson = '{"seq":0,"type":"genesis","v":1}';
  const F = { ...G, json: fakeJson };
  const RF = { ...R, trx: 'f'.repeat(40), json: anchorJson({ loc: [], prev: b64u(sha3(Buffer.from(fakeJson))), rec: REC, seq: 1, sig: { bpq: GOLDEN.id, sha3: b64u(sha3(sig)) } }) };
  let r = await assess([node('a', LIB, F, RF), node('b', LIB, F, RF)], yes, opts);
  assert.deepEqual([r.genesis.class, r.genesis.pinned, r.genesis.starts_chain], ['ANCHORED-TERMINAL', false, false]);
  assert.match(r.genesis.why, /is not the pin O4n0MUUDIN24chEO6f07XnGXUgFlqi16PauvsAp0zUs/);
  assert.deepEqual([r.chain.length, r.head, r.orphans.length], [0, null, 1]);
  // the pinned bytes, confirmed in its block by one operator only: ANCHORED-AS-REPORTED starts nothing
  r = await assess([node('a', LIB, G, R), node('b', LIB, G, R)], async url => (url === 'a' ? true : null), opts);
  assert.deepEqual([r.genesis.class, r.genesis.pinned, r.genesis.starts_chain, r.chain.length], ['ANCHORED-AS-REPORTED', true, false, 0]);
  assert.match(r.genesis.why, /not ANCHORED-TERMINAL/);
  // a genesis one operator omits from irreversible history is DIVERGENT, and starts nothing
  r = await assess([node('a', LIB, G, R), node('b', LIB, R)], yes, opts);
  assert.deepEqual([r.genesis.class, r.genesis.starts_chain, r.chain.length], ['DIVERGENT', false, 0]);
});

test('the identical genesis repeat at block 108460005 is never the genesis: the reader pins block 108404167, trx 7d404d75…', async () => {
  const REPEAT = { block: 108460005, trx: 'd29215dbcebd822eab9ca29071d2997acc4fed20', op_in_trx: 0, json: GENESIS_JSON.toString('utf8') };
  let r = await assess([node('a', LIB, G, REPEAT, R), node('b', LIB, G, REPEAT, R)], yes, opts);
  assert.deepEqual([r.genesis.block, r.genesis.trx, r.genesis.starts_chain], [GENESIS.block, GENESIS.trx, true]);
  assert.deepEqual(r.genesis_repeats.map(x => [x.block, x.trx, x.class]), [[REPEAT.block, REPEAT.trx, 'ANCHORED-TERMINAL']]);
  assert.deepEqual([r.chain.map(c => c.seq), r.fork, r.other_anchors], [[1], null, 0]);
  // the repeat alone starts nothing
  r = await assess([node('a', LIB, REPEAT, R), node('b', LIB, REPEAT, R)], yes, opts);
  assert.deepEqual([r.genesis.starts_chain, r.chain.length, r.genesis_repeats.length], [false, 0, 1]);
  assert.match(r.genesis.why, /no operator returns block 108404167 trx 7d404d75b82ac38fc5b27b1dd4cf2727c9c583b8/);
});
