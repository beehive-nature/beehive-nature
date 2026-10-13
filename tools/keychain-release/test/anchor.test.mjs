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
import { GENESIS, anchorJson, assess, buildAnchor, parseAnchor } from '../anchor.mjs';
import { BPQ, assemble, b64u, sha256, sha3, testKeys } from '../release.mjs';

const CLI = fileURLToPath(new URL('../anchor.mjs', import.meta.url));
const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' });
const GENESIS_JSON = readFileSync(fileURLToPath(new URL('genesis-anchor.json', import.meta.url)));
const GOLDEN = testKeys('golden');
const record = assemble({ files: [{ path: 'index.html', bytes: Buffer.from('<!doctype html>\n') }], seq: 1, prev: null, signers: [GOLDEN.id], commit: 'c'.repeat(40) }).bytes;
const sig = Buffer.from(JSON.stringify(BPQ.signFile(GOLDEN, new Uint8Array(record), '2026-10-12T00:00:00Z'), null, 1) + '\n');

test('the genesis fixture is the 620-byte chain string', () => {
  assert.equal(GENESIS_JSON.length, GENESIS.size);
  assert.equal(b64u(sha3(GENESIS_JSON)), 'O4n0MUUDIN24chEO6f07XnGXUgFlqi16PauvsAp0zUs');
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

test('anchor build: release 1 follows the genesis anchor; same inputs, same bytes; refusals', () => {
  const one = buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: GENESIS_JSON, seq: 1, loc: ['ar:' + 'A'.repeat(43)] });
  const a = parseAnchor(Buffer.from(one.json, 'latin1'));
  assert.equal(a.prev, 'O4n0MUUDIN24chEO6f07XnGXUgFlqi16PauvsAp0zUs');
  assert.deepEqual(a.rec, { sha256: b64u(sha256(record)), sha3: b64u(sha3(record)), size: record.length });
  assert.deepEqual(a.sig, { bpq: GOLDEN.id, sha3: b64u(sha3(sig)) });
  assert.deepEqual(one.op, ['custom_json', { required_auths: [], required_posting_auths: ['loviswater'], id: 'bnr.anchor', json: one.json }]);
  assert.equal(buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: GENESIS_JSON, seq: 1, loc: ['ar:' + 'A'.repeat(43)] }).json, one.json);
  assert.throws(() => buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: GENESIS_JSON, seq: 2 }), /does not follow the previous anchor's seq 0/);
  assert.throws(() => buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: Buffer.concat([GENESIS_JSON, Buffer.from('\n')]), seq: 1 }), /ends in a newline/);
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

test('quorum classes over simulated operators', async () => {
  const release = buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: GENESIS_JSON, seq: 1 }).json;
  const G = { block: GENESIS.block, trx: GENESIS.trx, op_in_trx: 0, json: GENESIS_JSON.toString('utf8') };
  const R = { block: 110000000, trx: 'a'.repeat(40), op_in_trx: 0, json: release };
  const ops = (...xs) => new Map(xs.map(x => [`${x.trx}:${x.op_in_trx}`, x]));
  const node = (url, lib, ...xs) => ({ url, ok: true, lib, ops: ops(...xs) });
  const yes = async () => true;
  const opts = { recordBytes: record, sigBytes: sig };

  let r = await assess([node('a', 110000005, G, R), node('b', 110000005, G, R)], yes, opts);
  assert.equal(r.genesis.class, 'ANCHORED-TERMINAL');
  assert.deepEqual(r.chain.map(c => [c.seq, c.class]), [[1, 'ANCHORED-TERMINAL']]);
  assert.deepEqual([r.release.class, r.release.on_chain], ['ANCHORED-TERMINAL', true]);

  r = await assess([node('a', 110000005, G, R), node('b', 109999999, G)], yes, opts);   // b lags below the block
  assert.equal(r.release.class, 'ANCHORED-AS-REPORTED');

  r = await assess([node('a', 110000005, G, R), node('b', 110000005, G, { ...R, json: release.replace('"seq":1', '"seq":2') })], yes, opts);
  assert.equal(r.divergent[0].class, 'DIVERGENT');
  assert.equal(r.release.class, 'DIVERGENT');

  r = await assess([node('a', 110000005, G, R), node('b', 110000005, G)], yes, opts);   // b is past it and omits it
  assert.match(r.release.anchor.why, /omits it/);
  assert.equal(r.release.class, 'DIVERGENT');

  r = await assess([node('a', 110000005, G, R), node('b', 110000005, G, R)], async url => url !== 'b', opts);
  assert.equal(r.release.class, 'DIVERGENT');

  r = await assess([node('a', 109999999, G, R), node('b', 109999999, G, R)], yes, opts);
  assert.equal(r.release.class, 'INCONCLUSIVE');

  r = await assess([node('a', 110000005, G), node('b', 110000005, G)], yes, opts);
  assert.deepEqual([r.release.class, r.head], ['SIGNED-UNANCHORED', null]);

  r = await assess([node('a', 110000005, G), { url: 'b', ok: false, error: 'down' }], yes, opts);
  assert.equal(r.release.class, 'INCONCLUSIVE');

  const orphan = { ...R, trx: 'b'.repeat(40), json: buildAnchor({ recordBytes: record, sigBytes: sig, prevJson: Buffer.from('{"seq":0}'), seq: 1 }).json };
  r = await assess([node('a', 110000005, G, orphan), node('b', 110000005, G, orphan)], yes, opts);
  assert.deepEqual([r.chain.length, r.orphans.length, r.release.on_chain], [0, 1, false]);
});
