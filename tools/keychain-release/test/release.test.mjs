// release.test.mjs — tools/keychain-release/release.mjs: the canonical record and its strict
// reader, prepare → check on the real tree (built from HEAD) and on scratch repositories built to
// break each guard, the signature and its one byte form, the seq/prev and genesis-pin rules, and
// place. Every key here is a throwaway made in the test; none authorizes anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BPQ, ROOT, assemble, b64u, buildSite, canon, check, envelope, inputsAt, openEnvelope, parseRecord, parseStrict, place, prepare,
  sha3, sigBytesOf, sigSha3, testKeys, verifyRelease
} from '../release.mjs';

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
const sign = (k, bytes, at = '2026-10-12T00:00:00Z') => sigBytesOf(BPQ.signFile(k, new Uint8Array(bytes), at));
const r1 = assemble({ files: FILES, seq: 1, prev: null, signers: [ALICE.id], commit: COMMIT });
const PIN = b64u(sha3(r1.bytes));
const tmp = () => mkdtempSync(join(tmpdir(), 'kc-release-test-'));
const HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();

// A scratch repository holding this checkout's build inputs as committed at HEAD, committed with
// plumbing only (write-tree, commit-tree, update-ref), so no hook runs in it. edit() then commit()
// makes the next commit; an edit left uncommitted is a dirty working tree on purpose.
function scratchRepo() {
  const dir = tmp();
  const env = { ...process.env, GIT_AUTHOR_NAME: 'kc-test', GIT_AUTHOR_EMAIL: 'kc-test@example.invalid', GIT_COMMITTER_NAME: 'kc-test', GIT_COMMITTER_EMAIL: 'kc-test@example.invalid' };
  const git = (...a) => execFileSync('git', ['-c', 'core.autocrlf=false', ...a], { cwd: dir, encoding: 'utf8', env }).trim();
  const edit = (path, bytes) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), bytes); };
  git('init', '-q');
  for (const [path, blob] of inputsAt(HEAD)) edit(path, blob);
  let last = null;
  const commit = msg => {
    git('add', '-A');
    last = git('commit-tree', git('write-tree'), ...(last ? ['-p', last] : []), '-m', msg);
    git('update-ref', 'HEAD', last);
    return last;
  };
  return { dir, edit, commit, read: path => readFileSync(join(dir, path)), done: () => rmSync(dir, { recursive: true, force: true }) };
}

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
    assert.equal(rec.source.commit, HEAD);
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

test('guards only a broken tree reaches: prepare\'s working-tree guard, KC-ORIGINS, and check\'s rebuild comparison', () => {
  const repo = scratchRepo(), out = tmp();
  try {
    const c1 = repo.commit('the build inputs as HEAD has them');
    // the working tree: keychain.js edited after the commit refuses, instead of being named c1
    const kc = repo.read('keychain/keychain.js');
    repo.edit('keychain/keychain.js', Buffer.concat([kc, Buffer.from('// edited after the commit\n')]));
    assert.throws(() => prepare({ out: join(out, 'dirty'), signers: ALICE.id, root: repo.dir }), new RegExp(`keychain/keychain\\.js in the working tree is not its bytes at ${c1}`));
    repo.edit('keychain/keychain.js', Buffer.from(kc.toString('latin1').replace(/\n/g, '\r\n'), 'latin1'));
    assert.throws(() => prepare({ out: join(out, 'crlf'), signers: ALICE.id, root: repo.dir }), /keychain\/keychain\.js in the working tree is not its bytes/, 'a CRLF re-ending');

    // c2 commits the edit: its build differs from c1's in keychain.js only
    repo.edit('keychain/keychain.js', Buffer.concat([kc, Buffer.from('// edited after the commit\n')]));
    const c2 = repo.commit('keychain.js edited');
    const p = prepare({ out: join(out, 'c2'), signers: ALICE.id, root: repo.dir });
    assert.equal(p.commit, c2);
    assert.equal(check(join(out, 'c2'), { root: repo.dir }).rebuilt, 'byte-identical');

    // c2's site and pack under a record that names c1: every byte matches the record, the rebuild does not
    const r = parseRecord(readFileSync(join(out, 'c2', 'record.json')));
    const site = r.files.map(f => ({ path: f.path, bytes: readFileSync(join(out, 'c2', 'site', ...f.path.split('/'))) }));
    const misnamed = assemble({ files: site, seq: 1, prev: null, signers: r.signers, commit: c1 });
    cpSync(join(out, 'c2'), join(out, 'misnamed'), { recursive: true });
    writeFileSync(join(out, 'misnamed', 'record.json'), misnamed.bytes);
    assert.throws(() => check(join(out, 'misnamed'), { root: repo.dir }), new RegExp(`^Error: keychain\\.js: the build at ${c1} differs from `));

    // KC-ORIGINS: a build that rewrites keychain.js (a replacement origin) is refused
    const build = repo.read('scripts/build-keychain.mjs').toString('utf8');
    repo.edit('scripts/build-keychain.mjs', build + "if (args[0] === '--out') writeFileSync(join(args[1], 'keychain.js'), readFileSync('keychain/keychain.js', 'utf8') + '// origin https://keys.example\\n');\n");
    repo.commit('a build that rewrites the keychain origin');
    assert.throws(() => buildSite(repo.dir), /KC-ORIGINS: the built keychain\.js is not keychain\/keychain\.js byte for byte/);
    assert.throws(() => prepare({ out: join(out, 'origins'), signers: ALICE.id, root: repo.dir }), /KC-ORIGINS/);
  } finally { repo.done(); rmSync(out, { recursive: true, force: true }); }
});

test('sign-test → verify: the one byte form, the genesis signer and pin; a wrong signer fails; no test flag, no key', () => {
  const dir = tmp();
  try {
    const rec = join(dir, 'record.json'), sig = join(dir, 'record.json.relsig.json');
    writeFileSync(rec, r1.bytes);
    assert.match(run('sign-test', '--seed', 'alice', '--record', rec, '--out', sig).stderr, /THROWAWAY/);
    const s = run('sign-test', '--seed', 'alice', '--record', rec, '--out', sig, TEST);
    assert.equal(s.status, 0, s.stderr);
    assert.equal(JSON.parse(s.stdout).id, ALICE.id);
    // the file is canonical JSON with no trailing newline, and sig_sha3 hashes exactly it
    const sb = readFileSync(sig);
    assert.equal(sb.toString('latin1'), canon(JSON.parse(sb)));
    assert.notEqual(sb[sb.length - 1], 0x0a);
    assert.equal(JSON.parse(s.stdout).sig_sha3, b64u(sha3(sb)));

    const ok = run('verify', '--record', rec, '--sig', sig, '--signers', ALICE.id, '--genesis-sha3', PIN);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.deepEqual(JSON.parse(ok.stdout), { ...JSON.parse(ok.stdout), ok: true, id: ALICE.id, seq: 1, authorized_by: 'genesis signers', genesis_pin: 'matched' });
    const wrong = run('verify', '--record', rec, '--sig', sig, '--signers', BOB.id, '--genesis-sha3', PIN);
    assert.equal(wrong.status, 1);
    assert.match(JSON.parse(wrong.stdout).why, /not a genesis signer/);
    const pin = run('verify', '--record', rec, '--sig', sig, '--signers', ALICE.id, '--genesis-sha3', b64u(sha3(Buffer.from('another'))));
    assert.match(JSON.parse(pin.stdout).why, /not the genesis pin/);
    // rule 3: no pin, no chain verdict; --no-genesis-pin is a signature-only check, exit 0 but never ok:true
    const nopin = run('verify', '--record', rec, '--sig', sig, '--signers', ALICE.id);
    assert.equal(nopin.status, 1);
    assert.match(JSON.parse(nopin.stdout).why, /seq 1 needs the genesis pin/);
    const only = run('verify', '--record', rec, '--sig', sig, '--signers', ALICE.id, '--no-genesis-pin');
    assert.equal(only.status, 0, only.stdout + only.stderr);
    const o = JSON.parse(only.stdout);
    assert.deepEqual([o.ok, o.signature_ok, o.checked, o.genesis_pin], [false, true, 'signature only (--no-genesis-pin)', 'not checked']);
    assert.equal(run('verify', '--record', rec, '--sig', sig, '--signers', BOB.id, '--no-genesis-pin').status, 1, 'a signature-only check still needs a genesis signer');
    const both = run('verify', '--record', rec, '--sig', sig, '--signers', ALICE.id, '--no-genesis-pin', '--genesis-sha3', PIN);
    assert.deepEqual([both.status, /contradict/.test(JSON.parse(both.stdout).why)], [1, true]);

    // any other byte form of the same signature is refused: pretty-printed, or a trailing newline
    const pretty = join(dir, 'pretty.json'), nl = join(dir, 'newline.json');
    writeFileSync(pretty, JSON.stringify(JSON.parse(sb), null, 1) + '\n');
    writeFileSync(nl, Buffer.concat([sb, Buffer.from('\n')]));
    for (const f of [pretty, nl]) {
      const v = run('verify', '--record', rec, '--sig', f, '--signers', ALICE.id, '--genesis-sha3', PIN);
      assert.equal(v.status, 1);
      assert.match(JSON.parse(v.stdout).why, /not its one byte form/);
      assert.match(run('envelope', '--record', rec, '--sig', f).stderr, /not its one byte form/);
    }

    const env = run('envelope', '--record', rec, '--sig', sig, '--hint-ar', 'A'.repeat(43), '--hint-hive', `110000000:${'d'.repeat(40)}`, '--out', join(dir, 'env.json'));
    assert.equal(env.status, 0, env.stderr);
    const eb = readFileSync(join(dir, 'env.json')), e = JSON.parse(eb);
    assert.deepEqual(Object.keys(e), ['bnr', 'hints', 'record', 'sig']);
    assert.equal(e.bnr, 'keychain-release-envelope/1');
    assert.ok(Buffer.from(e.record, 'base64url').equals(r1.bytes));
    assert.deepEqual(e.hints, { ar: ['A'.repeat(43)], hive: { block: 110000000, trx: 'd'.repeat(40) } });
    // the envelope carries the relsig file byte for byte: canon(envelope.sig), so sig.sha3 recomputes from either
    assert.ok(Buffer.from(canon(e.sig), 'latin1').equals(sb));
    const opened = openEnvelope(eb);
    assert.ok(opened.recordBytes.equals(r1.bytes));
    assert.ok(opened.sigBytes.equals(sb));
    assert.equal(sigSha3(opened.sigBytes), b64u(sha3(sb)));
    assert.throws(() => openEnvelope(Buffer.from(JSON.stringify(e, null, 1))), /not canonical JSON/);
    assert.throws(() => openEnvelope(Buffer.from(canon({ ...e, hints: { pad: 'x' } }), 'latin1')), /unknown field "pad"/);
    assert.match(run('envelope', '--record', rec, '--sig', sig, '--hint-ar', 'not-a-txid').stderr, /not an Arweave transaction id/);
    writeFileSync(join(dir, 'other.json'), assemble({ files: FILES, seq: 1, prev: null, signers: [BOB.id], commit: COMMIT }).bytes);
    assert.match(run('envelope', '--record', join(dir, 'other.json'), '--sig', sig).stderr, /not over this record/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('one flipped bit anywhere in the record, or in the signature, fails', () => {
  const sig = sign(ALICE, r1.bytes), base = { signers: [ALICE.id], genesisSha3: PIN, law: NO_LAW };
  assert.equal(verifyRelease({ recordBytes: r1.bytes, sigBytes: sig, ...base }).ok, true);
  for (let i = 0; i < r1.bytes.length; i++) {
    for (let bit = 0; bit < 8; bit++) {
      const t = Buffer.from(r1.bytes);
      t[i] ^= 1 << bit;
      assert.equal(verifyRelease({ recordBytes: t, sigBytes: sig, ...base }).ok, false, `byte ${i} bit ${bit}`);
    }
  }
  const d = parseStrict(sig), raw = Buffer.from(d.sig, 'base64url');
  raw[7] ^= 0x10;
  const bad = verifyRelease({ recordBytes: r1.bytes, sigBytes: sigBytesOf({ ...d, sig: b64u(raw) }), ...base });
  assert.deepEqual([bad.ok, bad.why], [false, 'signature: the signature does not verify']);
  const extra = verifyRelease({ recordBytes: r1.bytes, sigBytes: Buffer.from(canon({ ...d, note: 'x' }), 'latin1'), ...base });
  assert.match(extra.why, /unknown field "note"/);
});

test('rule 3 at seq 1: the genesis pin is required; --no-genesis-pin is a signature-only check, never ok:true', () => {
  const sig = sign(ALICE, r1.bytes), v = o => verifyRelease({ recordBytes: r1.bytes, sigBytes: sig, signers: [ALICE.id], law: NO_LAW, ...o });
  assert.deepEqual([v({}).ok, /seq 1 needs the genesis pin/.test(v({}).why)], [false, true]);
  assert.deepEqual([v({ genesisSha3: PIN }).ok, v({ genesisSha3: PIN }).genesis_pin], [true, 'matched']);
  const only = v({ noGenesisPin: true });
  assert.deepEqual([only.ok, only.signature_ok, only.genesis_pin], [false, true, 'not checked']);
  assert.equal(v({ noGenesisPin: true, signers: [BOB.id] }).signature_ok, undefined);
  assert.match(v({ noGenesisPin: true, genesisSha3: PIN }).why, /contradict/);
  assert.match(v({ genesisSha3: 'b'.repeat(64) }).why, /not a base64url SHA3-256 digest/);
  const r2 = assemble({ files: FILES, seq: 2, prev: PIN, signers: [BOB.id], commit: COMMIT });
  assert.match(verifyRelease({ recordBytes: r2.bytes, sigBytes: sign(ALICE, r2.bytes), prevBytes: r1.bytes, noGenesisPin: true, law: NO_LAW }).why, /seq 1 record alone/);
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
  assert.match(v({ recordBytes: r1.bytes, sigBytes: sign(ALICE, r1.bytes), signers: [ALICE.id], genesisSha3: PIN, law: new Set([ALICE.id]) }).why, /law key/);
  assert.match(v({ recordBytes: r1.bytes, sigBytes: sign(ALICE, r1.bytes), signers: [ALICE.id], genesisSha3: PIN, cfg: { origin: 'https://keys.example', rp_id: 'keys.example' } }).why, /record.origin/);
});

test('place: verified from the genesis pin, written to keychain/releases/<seq>/, never rewritten', () => {
  const dir = tmp();
  try {
    const s1 = sign(ALICE, r1.bytes);
    const r2 = assemble({ files: FILES, seq: 2, prev: PIN, signers: [BOB.id], commit: COMMIT }), s2 = sign(ALICE, r2.bytes);
    const base = { dir, signers: [ALICE.id], genesisSha3: PIN, law: NO_LAW };
    const releases = join(dir, 'keychain', 'releases'), at1 = join(releases, '1');

    assert.throws(() => place({ ...base, recordBytes: r2.bytes, sigBytes: s2 }), /keychain\/releases\/1 is not placed/);
    assert.throws(() => place({ ...base, genesisSha3: undefined, recordBytes: r1.bytes, sigBytes: s1 }), /--genesis-sha3 is required/);
    assert.throws(() => place({ ...base, signers: [], recordBytes: r1.bytes, sigBytes: s1 }), /--signers is required/);
    assert.throws(() => place({ ...base, genesisSha3: b64u(sha3(Buffer.from('x'))), recordBytes: r1.bytes, sigBytes: s1 }), /not the genesis pin/);
    assert.throws(() => place({ ...base, signers: [BOB.id], recordBytes: r1.bytes, sigBytes: s1 }), /not a genesis signer/);
    assert.throws(() => place({ ...base, recordBytes: r1.bytes, sigBytes: Buffer.concat([s1, Buffer.from('\n')]) }), /not its one byte form/);

    const p1 = place({ ...base, recordBytes: r1.bytes, sigBytes: s1 });
    assert.deepEqual([p1.seq, p1.unchanged, p1.sha3], [1, false, PIN]);
    assert.deepEqual(readdirSync(at1).sort(), ['envelope.json', 'record.json', 'record.json.relsig.json']);
    assert.ok(readFileSync(join(at1, 'record.json')).equals(r1.bytes));
    assert.ok(readFileSync(join(at1, 'record.json.relsig.json')).equals(s1));
    assert.ok(readFileSync(join(at1, 'envelope.json')).equals(envelope(r1.bytes, s1)));
    assert.deepEqual(readdirSync(releases), ['1'], 'no temporary directory is left behind');
    // the same bytes again change nothing; another signature or envelope for a placed seq is refused
    assert.equal(place({ ...base, recordBytes: r1.bytes, sigBytes: s1 }).unchanged, true);
    assert.throws(() => place({ ...base, recordBytes: r1.bytes, sigBytes: sign(ALICE, r1.bytes, '2026-10-13T00:00:00Z') }), /keychain\/releases\/1 exists with different bytes/);
    assert.throws(() => place({ ...base, recordBytes: r1.bytes, sigBytes: s1, envelopeBytes: envelope(r1.bytes, s1, { ar: ['A'.repeat(43)] }) }), /exists with different bytes/);

    // seq 2: authorized by seq 1's signers, carried in an envelope with hints, which must be the same record and signature
    assert.throws(() => place({ ...base, recordBytes: r2.bytes, sigBytes: s2, envelopeBytes: envelope(r1.bytes, s1) }), /carries another record/);
    assert.throws(() => place({ ...base, recordBytes: r2.bytes, sigBytes: s2, envelopeBytes: envelope(r2.bytes, sign(ALICE, r2.bytes, '2026-10-13T00:00:00Z')) }), /carries another signature/);
    assert.throws(() => place({ ...base, recordBytes: r2.bytes, sigBytes: sign(BOB, r2.bytes) }), /not among the previous record's signers/);
    const env2 = envelope(r2.bytes, s2, { ar: ['A'.repeat(43)] });
    assert.equal(place({ ...base, recordBytes: r2.bytes, sigBytes: s2, envelopeBytes: env2 }).seq, 2);
    assert.ok(readFileSync(join(releases, '2', 'envelope.json')).equals(env2));
    // a placed seq 1 tampered with breaks every placement after it
    writeFileSync(join(at1, 'record.json.relsig.json'), Buffer.concat([s1, Buffer.from('\n')]));
    assert.throws(() => place({ ...base, recordBytes: r2.bytes, sigBytes: s2, envelopeBytes: env2 }), /keychain\/releases\/1 does not verify: .*not its one byte form/);

    // the command line
    const cli = join(dir, 'cli'), rec = join(dir, 'r1.json'), sig = join(dir, 'r1.relsig.json');
    writeFileSync(rec, r1.bytes); writeFileSync(sig, s1);
    const placed = run('place', '--dir', cli, '--record', rec, '--sig', sig, '--signers', ALICE.id, '--genesis-sha3', PIN);
    assert.equal(placed.status, 0, placed.stderr);
    assert.deepEqual([JSON.parse(placed.stdout).seq, JSON.parse(placed.stdout).unchanged], [1, false]);
    assert.ok(readFileSync(join(cli, 'keychain', 'releases', '1', 'record.json')).equals(r1.bytes));
    assert.match(run('place', '--dir', cli, '--record', rec, '--sig', sig, '--signers', ALICE.id).stderr, /--genesis-sha3 is required/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
