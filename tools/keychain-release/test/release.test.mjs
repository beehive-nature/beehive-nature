// release.test.mjs — tools/keychain-release/release.mjs: the canonical record and its strict
// reader, prepare → check on the real tree (built from HEAD), and the signature and seq/prev
// rules. Every key here is a throwaway made in the test; none authorizes anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BPQ, ROOT, assemble, b64u, canon, parseRecord, parseStrict, sha3, testKeys, verifyRelease } from '../release.mjs';

const CLI = fileURLToPath(new URL('../release.mjs', import.meta.url));
const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { cwd: ROOT, encoding: 'utf8' });
const TEST = '--i-understand-this-is-a-test-key';
const NO_LAW = new Set();
const COMMIT = 'c'.repeat(40);
const ALICE = testKeys('alice'), BOB = testKeys('bob');
const FILES = [
  { path: 'vendor/a.js', bytes: Buffer.from('a();\n') },
  { path: 'index.html', bytes: Buffer.from('<!doctype html>\n') },
  { path: 'keychain.js', bytes: Buffer.from('k();\n') }
];
const sign = (k, bytes) => Buffer.from(JSON.stringify(BPQ.signFile(k, new Uint8Array(bytes), '2026-10-12T00:00:00Z')));
const r1 = assemble({ files: FILES, seq: 1, prev: null, signers: [ALICE.id], commit: COMMIT });
const tmp = () => mkdtempSync(join(tmpdir(), 'kc-release-test-'));

test('canonical: the record round-trips byte for byte, keys sorted at every level, files by path', () => {
  const s = r1.bytes.toString('latin1');
  assert.equal(canon(parseStrict(r1.bytes)), s);
  assert.deepEqual(parseRecord(r1.bytes), r1.record);
  assert.equal(canon({ b: 1, a: [2, 'x"y\\z'], c: { z: null, y: true } }), '{"a":[2,"x\\"y\\\\z"],"b":1,"c":{"y":true,"z":null}}');
  assert.deepEqual(r1.record.files.map(f => f.path), ['index.html', 'keychain.js', 'vendor/a.js']);
  assert.equal(r1.record.pack.size, 26);
  assert.ok(s.startsWith('{"files":[{"path":"index.html","sha256":"'));
  assert.ok(s.endsWith(`"source":{"build":"node scripts/build-keychain.mjs --out DIR","commit":"${COMMIT}","repo":"beehive-nature/beehive-nature"}}`));
  assert.throws(() => canon({ x: 1.5 }), /integers only/);
  assert.throws(() => canon({ x: 'é' }), /printable ASCII only/);
});

test('strict reader refuses: duplicate key, unknown and missing fields, whitespace, non-ASCII, float, hex digest', () => {
  const s = r1.bytes.toString('latin1');
  const refuse = (text, re) => assert.throws(() => parseRecord(Buffer.from(text, 'utf8')), re);
  refuse(s.replace('{"files"', '{"files":[],"files"'), /duplicate key "files"/);
  refuse(s.slice(0, -1) + ',"zzz":1}', /unknown field "zzz"/);
  refuse(s.replace('"kind":"release",', ''), /missing field "kind"/);
  refuse(s.replace('"kind":', '"kind": '), /insignificant whitespace/);
  refuse(' ' + s, /insignificant whitespace/);
  refuse(s + '\n', /control byte/);
  refuse(s.replace('"release"', '"reléase"'), /non-ASCII byte/);
  refuse(s.replace('"seq":1', '"seq":1.0'), /float or exponent/);
  refuse(s.replace('"seq":1', '"seq":1e0'), /float or exponent/);
  refuse(s.replace('"seq":1', '"seq":01'), /leading zero/);
  refuse(s.replace(r1.record.files[0].sha256, createHash('sha256').update('x').digest('hex')), /never hex/);
  refuse(s.replace('"kind":"release",', '').replace('{"files"', '{"kind":"release","files"'), /not in bytewise order/);
  refuse(s.replace('"release"', '"rel\\u0065ase"'), /escape other than/);
  refuse(s.replace('"prev":null', `"prev":"${b64u(sha3(Buffer.from('x')))}"`), /prev must be null at seq 1/);
  refuse(s.replace(`"signers":["${ALICE.id}"]`, '"signers":[]'), /at least one id/);
  refuse(s.replace('--out DIR', '--origin x --out DIR'), /source.build must be exactly/);
  refuse(s.replace('"path":"index.html"', '"path":"../index.html"'), /not a relative/);
});

test('prepare → check: the real tree, built from HEAD, rebuilds byte-identical; tampering fails', () => {
  const dir = tmp();
  try {
    const p = run('prepare', '--out', join(dir, 'r1'), '--signers', ALICE.id);
    assert.equal(p.status, 0, p.stderr);
    const bytes = readFileSync(join(dir, 'r1', 'record.json')), rec = parseRecord(bytes);
    assert.equal(rec.source.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim());
    assert.deepEqual(rec.files.map(f => f.path), ['genesis.js', 'index.html', 'keychain.js', 'vendor/bnr-sign.js', 'vendor/bzdid-key.js']);
    assert.deepEqual([rec.seq, rec.prev, rec.signers], [1, null, [ALICE.id]]);
    assert.ok(readFileSync(join(dir, 'r1', 'site', 'keychain.js')).equals(readFileSync(join(ROOT, 'keychain', 'keychain.js'))));

    const c = run('check', join(dir, 'r1'));
    assert.equal(c.status, 0, c.stderr);
    assert.equal(JSON.parse(c.stdout).rebuilt, 'byte-identical');
    console.log(c.stdout.trim());

    for (const victim of ['site/keychain.js', 'pack.bin', 'record.json']) {
      const t = join(dir, 'tamper-' + victim.replace(/\W/g, '_'));
      cpSync(join(dir, 'r1'), t, { recursive: true });
      const b = readFileSync(join(t, victim));
      b[victim === 'record.json' ? b.length - 3 : 100] ^= 1;
      writeFileSync(join(t, victim), b);
      const bad = run('check', t);
      assert.equal(bad.status, 1, `${victim}: ${bad.stdout}`);
      assert.match(bad.stderr, /not the bytes the record names|pack bytes at|not canonical|record.source/);
    }
    const extra = join(dir, 'extra');
    cpSync(join(dir, 'r1'), extra, { recursive: true });
    writeFileSync(join(extra, 'site', 'CNAME'), 'keys.skaists.dev\n');
    assert.match(run('check', extra).stderr, /holds .* but the record names/);

    const r2 = run('prepare', '--out', join(dir, 'r2'), '--prev', join(dir, 'r1', 'record.json'), '--signers', BOB.id);
    assert.equal(r2.status, 0, r2.stderr);
    const rec2 = parseRecord(readFileSync(join(dir, 'r2', 'record.json')));
    assert.deepEqual([rec2.seq, rec2.prev], [2, b64u(sha3(bytes))]);
    assert.match(run('prepare', '--out', join(dir, 'r3'), '--prev', join(dir, 'r1', 'record.json'), '--seq', '3', '--signers', BOB.id).stderr, /--seq must be 2/);
    assert.match(run('prepare', '--out', join(dir, 'r1'), '--signers', ALICE.id).stderr, /is not empty/);
    const law = JSON.parse(readFileSync(join(ROOT, 'docs', 'PQ-SIGNERS.json'), 'utf8')).signers[0].id;
    assert.match(run('prepare', '--out', join(dir, 'law'), '--signers', law).stderr, /law key/);
    assert.match(run('prepare', '--out', join(dir, 'none')).stderr, /R-SIGNER/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('sign-test → verify: the genesis signer verifies; a wrong signer fails; no test flag, no key', () => {
  const dir = tmp();
  try {
    const rec = join(dir, 'record.json'), sig = join(dir, 'record.json.relsig.json');
    writeFileSync(rec, r1.bytes);
    assert.match(run('sign-test', '--seed', 'alice', '--record', rec, '--out', sig).stderr, /THROWAWAY/);
    const s = run('sign-test', '--seed', 'alice', '--record', rec, '--out', sig, TEST);
    assert.equal(s.status, 0, s.stderr);
    assert.equal(JSON.parse(s.stdout).id, ALICE.id);
    const ok = run('verify', '--record', rec, '--sig', sig, '--signers', ALICE.id, '--genesis-sha3', b64u(sha3(r1.bytes)));
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.deepEqual(JSON.parse(ok.stdout), { ...JSON.parse(ok.stdout), ok: true, id: ALICE.id, seq: 1, authorized_by: 'genesis signers', genesis_pin: 'matched' });
    const wrong = run('verify', '--record', rec, '--sig', sig, '--signers', BOB.id);
    assert.equal(wrong.status, 1);
    assert.match(JSON.parse(wrong.stdout).why, /not a genesis signer/);
    const pin = run('verify', '--record', rec, '--sig', sig, '--signers', ALICE.id, '--genesis-sha3', b64u(sha3(Buffer.from('another'))));
    assert.match(JSON.parse(pin.stdout).why, /not the genesis pin/);

    const env = run('envelope', '--record', rec, '--sig', sig, '--hint-ar', 'A'.repeat(43), '--hint-hive', `110000000:${'d'.repeat(40)}`, '--out', join(dir, 'env.json'));
    assert.equal(env.status, 0, env.stderr);
    const e = JSON.parse(readFileSync(join(dir, 'env.json'), 'utf8'));
    assert.deepEqual(Object.keys(e), ['bnr', 'hints', 'record', 'sig']);
    assert.equal(e.bnr, 'keychain-release-envelope/1');
    assert.ok(Buffer.from(e.record, 'base64url').equals(r1.bytes));
    assert.deepEqual(e.hints, { ar: ['A'.repeat(43)], hive: { block: 110000000, trx: 'd'.repeat(40) } });
    assert.match(run('envelope', '--record', rec, '--sig', sig, '--hint-ar', 'not-a-txid').stderr, /not an Arweave transaction id/);
    writeFileSync(join(dir, 'other.json'), assemble({ files: FILES, seq: 1, prev: null, signers: [BOB.id], commit: COMMIT }).bytes);
    assert.match(run('envelope', '--record', join(dir, 'other.json'), '--sig', sig).stderr, /not over this record/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('one flipped bit anywhere in the record, or in the signature, fails', () => {
  const sig = sign(ALICE, r1.bytes);
  assert.equal(verifyRelease({ recordBytes: r1.bytes, sigBytes: sig, signers: [ALICE.id], law: NO_LAW }).ok, true);
  for (let i = 0; i < r1.bytes.length; i++) {
    for (let bit = 0; bit < 8; bit++) {
      const t = Buffer.from(r1.bytes);
      t[i] ^= 1 << bit;
      assert.equal(verifyRelease({ recordBytes: t, sigBytes: sig, signers: [ALICE.id], law: NO_LAW }).ok, false, `byte ${i} bit ${bit}`);
    }
  }
  const d = JSON.parse(sig), raw = Buffer.from(d.sig, 'base64url');
  raw[7] ^= 0x10;
  const bad = verifyRelease({ recordBytes: r1.bytes, sigBytes: Buffer.from(JSON.stringify({ ...d, sig: b64u(raw) })), signers: [ALICE.id], law: NO_LAW });
  assert.deepEqual([bad.ok, bad.why], [false, 'signature: the signature does not verify']);
  const extra = verifyRelease({ recordBytes: r1.bytes, sigBytes: Buffer.from(JSON.stringify({ ...d, note: 'x' })), signers: [ALICE.id], law: NO_LAW });
  assert.match(extra.why, /unknown field "note"/);
});

test('seq/prev: N > 1 only as current+1, prev naming current, signed by an id current names', () => {
  const v = o => verifyRelease({ law: NO_LAW, ...o });
  const r2 = assemble({ files: FILES, seq: 2, prev: b64u(sha3(r1.bytes)), signers: [BOB.id], commit: COMMIT });
  const r2ok = v({ recordBytes: r2.bytes, sigBytes: sign(ALICE, r2.bytes), prevBytes: r1.bytes });
  assert.deepEqual([r2ok.ok, r2ok.seq, r2ok.authorized_by], [true, 2, 'previous record signers']);
  assert.match(v({ recordBytes: r2.bytes, sigBytes: sign(BOB, r2.bytes), prevBytes: r1.bytes }).why, /not among the previous record's signers/);
  assert.match(v({ recordBytes: r2.bytes, sigBytes: sign(ALICE, r2.bytes), signers: [ALICE.id, BOB.id] }).why, /genesis pins authorize genesis only/);
  assert.match(v({ recordBytes: r2.bytes, sigBytes: sign(ALICE, r2.bytes), prevBytes: r1.bytes, signers: [BOB.id] }).why, /not among --signers/);
  const elsewhere = assemble({ files: FILES, seq: 2, prev: b64u(sha3(Buffer.from('elsewhere'))), signers: [BOB.id], commit: COMMIT });
  assert.match(v({ recordBytes: elsewhere.bytes, sigBytes: sign(ALICE, elsewhere.bytes), prevBytes: r1.bytes }).why, /does not name the previous record/);
  const r3 = assemble({ files: FILES, seq: 3, prev: b64u(sha3(r2.bytes)), signers: [ALICE.id], commit: COMMIT });
  assert.match(v({ recordBytes: r3.bytes, sigBytes: sign(ALICE, r3.bytes), prevBytes: r1.bytes }).why, /never a jump/);
  assert.equal(v({ recordBytes: r3.bytes, sigBytes: sign(BOB, r3.bytes), prevBytes: r2.bytes }).ok, true);
  assert.match(v({ recordBytes: r1.bytes, sigBytes: sign(ALICE, r1.bytes), signers: [ALICE.id], law: new Set([ALICE.id]) }).why, /law key/);
  assert.match(v({ recordBytes: r1.bytes, sigBytes: sign(ALICE, r1.bytes), signers: [ALICE.id], cfg: { origin: 'https://keys.example', rp_id: 'keys.example' } }).why, /record.origin/);
});
