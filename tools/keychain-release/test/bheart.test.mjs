// bheart.test.mjs — the second release-signature profile: bheart.signature/1 (what the frozen
// `bsigner sign` writes: ML-DSA-65 over the raw record bytes, empty context), its verifying key in
// the envelope's vk, and its signer id mldsa65:<base64url SHA3-256(vk)>. Through release.mjs
// (verify, envelope, place, sign-test, import-sig), anchor.mjs and probe.mjs, with rotation from a
// §3b genesis to a bheart seq 2. Every key here is a throwaway made in the test; none authorizes
// anything. With BSIGNER set to a bsigner binary, a noble-vs-bsigner cross check runs too; without
// it that one test prints NOT RUN and is skipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BPQ, ROOT, assemble, b64u, bheartKeyId, bheartSig, canon, envelope, isBzpqId, isId, isMldsaId, mldsaId, openEnvelope, parseRecord,
  place, readSig, readVk, sha3, sigBytesOf, testBheartKey, testKeys, verifyRelease, verifySig
} from '../release.mjs';
import { assess, buildAnchor, GENESIS } from '../anchor.mjs';
import { expectedFromRecords, wellKnownCheck } from '../probe.mjs';

const CLI = fileURLToPath(new URL('../release.mjs', import.meta.url));
const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { cwd: ROOT, encoding: 'utf8' });
const TEST = '--i-understand-this-is-a-test-key';
const NO_LAW = new Set();
const COMMIT = 'c'.repeat(40);
const OLD = testKeys('bheart-old'), H = testBheartKey('h'), OTHER = testBheartKey('other');
const FILES = [{ path: 'index.html', bytes: Buffer.from('<!doctype html>\n') }, { path: 'keychain.js', bytes: Buffer.from('k();\n') }];
const tmp = () => mkdtempSync(join(tmpdir(), 'kc-bheart-test-'));
const signBpq = (k, bytes) => sigBytesOf(BPQ.signFile(k, new Uint8Array(bytes), '2026-10-12T00:00:00Z'));
const signH = (k, bytes) => sigBytesOf(k.sign(bytes));
// rotation: a §3b genesis that names the mldsa65: id as the next signer
const g = assemble({ files: FILES, seq: 1, prev: null, signers: [H.id], commit: COMMIT });
const PIN = b64u(sha3(g.bytes));
const r2 = assemble({ files: FILES, seq: 2, prev: PIN, signers: [H.id], commit: COMMIT });
// a bheart genesis
const hg = assemble({ files: FILES, seq: 1, prev: null, signers: [H.id], commit: COMMIT });

test('ids: mldsa65: is "mldsa65:" + base64url SHA3-256(vk), validated strictly; bzpq1 ids still accepted', () => {
  assert.equal(H.id, 'mldsa65:' + b64u(sha3(H.vk)));
  assert.equal(mldsaId(H.vk), H.id);
  assert.equal(H.id.length, 8 + 43);
  assert.ok(isMldsaId(H.id) && isId(H.id) && !isBzpqId(H.id));
  assert.ok(isId(OLD.id) && isBzpqId(OLD.id) && !isMldsaId(OLD.id));
  // bsigner derive_key_id: "bheart-" + 16 characters of base64url SHA3-256("ml-dsa-65" || vk)
  assert.equal(H.key_id, 'bheart-' + b64u(sha3(Buffer.concat([Buffer.from('ml-dsa-65'), H.vk]))).slice(0, 16));
  assert.equal(bheartKeyId(H.vk), H.key_id);
  const d = H.id.slice(8), A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (const bad of ['', d, 'MLDSA65:' + d, `mldsa65:${d}=`, `mldsa65:${d.slice(0, 42)}`, `mldsa65:${d}A`, `mldsa87:${d}`, 'mldsa65:',
    `mldsa65:${d.slice(0, 42)}${A[A.indexOf(d[42]) | 1]}`]) assert.ok(!isId(bad), bad);
  // records and the CLI take either form
  assert.deepEqual(parseRecord(assemble({ files: FILES, seq: 1, prev: null, signers: [OLD.id, H.id], commit: COMMIT }).bytes).signers, [OLD.id, H.id].sort());
  assert.throws(() => assemble({ files: FILES, seq: 1, prev: null, signers: ['mldsa65:short'], commit: COMMIT }), /not a bzpq1 or mldsa65: id/);
});

test('bheart verify: the raw record bytes, empty context, by vk; every precheck refuses before any lattice math', () => {
  const sig = H.sign(hg.bytes);
  assert.deepEqual(Object.keys(sig).sort(), ['agility', 'alg', 'content', 'key_id', 'signature', 'signed_at_ms', 'type']);
  const ok = verifySig(sig, hg.bytes, H.vk);
  assert.deepEqual(ok, { ok: true, id: H.id, profile: 'bheart.signature/1' });
  assert.equal(verifySig(sig, hg.bytes, b64u(H.vk)).id, H.id, 'vk as base64url');
  const v = (s, vk = H.vk, rec = hg.bytes) => verifySig(s, rec, vk);
  const edit = f => { const s = structuredClone(sig); f(s); return s; };
  assert.match(v(sig, OTHER.vk).why, /key_id is not the bsigner key id of vk/, 'wrong vk');
  assert.match(v(edit(s => { s.key_id = OTHER.key_id; })).why, /key_id is not the bsigner key id of vk/, 'key_id mismatch');
  assert.match(v(edit(s => { s.alg = 'ml-dsa-87'; })).why, /ml-dsa-65/, 'alg mismatch');
  assert.match(v(edit(s => { s.signature.alg = 'ml-dsa-44'; })).why, /ml-dsa-65/, 'signature.alg mismatch');
  assert.match(verifySig(sig, hg.bytes, undefined).why, /needs its verifying key/, 'missing vk');
  assert.match(verifySig(BPQ.signFile(OLD, new Uint8Array(hg.bytes), '2026-10-12T00:00:00Z'), hg.bytes, H.vk).why, /vk is forbidden/, 'vk with §3b');
  assert.match(v(sig, H.vk.subarray(0, 1951)).why, /1951 bytes, not the 1952/);
  assert.match(v(edit(s => { s.content.digest.b64u = b64u(sha3(Buffer.from('x'))); })).why, /other bytes than this record/, 'digest mismatch');
  assert.match(v(edit(s => { s.content.bytes += 1; })).why, /other bytes/);
  assert.match(v(edit(s => { s.content.digest.bytes -= 1; })).why, /other bytes/);
  assert.match(v(edit(s => { s.signature.bytes = 3308; })).why, /3309 bytes/, 'signature length field');
  assert.match(v(edit(s => { s.signature.b64u = b64u(Buffer.from(s.signature.b64u, 'base64url').subarray(0, 3308)); })).why, /3309 bytes/, 'signature length');
  assert.match(v(edit(s => { s.type = 'bheart.signature/2'; })).why, /signature\.type/);
  assert.match(v(edit(s => { s.note = 'x'; })).why, /unknown field "note"/);
  assert.match(v(edit(s => { delete s.agility; })).why, /missing field "agility"/);
  assert.match(v(edit(s => { s.content.digest.extra = 1; })).why, /unknown field "extra"/);
  // one bit of the record: the digest no longer names it; rebound, only ML-DSA refuses it
  const t = Buffer.from(hg.bytes); t[t.indexOf('index.html') + 1] ^= 1;
  assert.match(v(sig, H.vk, t).why, /other bytes/);
  const rebound = bheartSig(H.key_id, t, Buffer.from(sig.signature.b64u, 'base64url'));
  assert.match(v(rebound, H.vk, t).why, /does not verify/);
  // signed_at_ms and agility are not covered by the signature: changing them changes nothing
  assert.equal(v(edit(s => { s.signed_at_ms = 1; })).ok, true);
});

test('envelope: vk REQUIRED with bheart, FORBIDDEN with §3b; canonical; openEnvelope returns it', () => {
  const sigBytes = signH(H, hg.bytes);
  const e = envelope(hg.bytes, sigBytes, {}, H.vk);
  const o = openEnvelope(e);
  assert.ok(o.recordBytes.equals(hg.bytes) && o.sigBytes.equals(sigBytes) && o.vk.equals(H.vk));
  assert.ok(e.toString('latin1').endsWith(`,"vk":"${b64u(H.vk)}"}`), 'vk sorts last, canonical');
  assert.throws(() => envelope(hg.bytes, sigBytes, {}), /needs its verifying key/);
  assert.throws(() => envelope(g.bytes, signBpq(OLD, g.bytes), {}, H.vk), /vk is forbidden/);
  const parsed = JSON.parse(e);
  const re = obj => Buffer.from(canon(obj), 'latin1');
  const { vk: _drop, ...noVk } = parsed;
  assert.throws(() => openEnvelope(re(noVk)), /envelope\.vk is required with a bheart\.signature\/1/);
  const bpqEnv = JSON.parse(envelope(g.bytes, signBpq(OLD, g.bytes)));
  assert.throws(() => openEnvelope(re({ ...bpqEnv, vk: b64u(H.vk) })), /envelope\.vk is forbidden/);
  assert.throws(() => openEnvelope(re({ ...parsed, vk: b64u(H.vk.subarray(1)) })), /envelope\.vk is 1951 bytes/);
  assert.equal(openEnvelope(envelope(g.bytes, signBpq(OLD, g.bytes))).vk, undefined);
});

test('CLI: sign-test --profile bheart → envelope --vk → verify --vk; import-sig writes bsigner\'s pretty form in its one byte form', () => {
  const dir = tmp();
  try {
    const rec = join(dir, 'record.json'), sig = join(dir, 'sig.json'), vk = join(dir, 'vk.txt'), env = join(dir, 'env.json');
    writeFileSync(rec, hg.bytes);
    const made = run('sign-test', '--profile', 'bheart', '--seed', 'h', '--record', rec, '--out', sig, '--vk-out', vk, TEST);
    assert.equal(made.status, 0, made.stderr);
    const out = JSON.parse(made.stdout);
    assert.deepEqual([out.profile, out.id, out.key_id, out.test_key], ['bheart', H.id, H.key_id, true]);
    assert.equal(readFileSync(vk, 'latin1'), b64u(H.vk));
    assert.equal(run('sign-test', '--profile', 'bheart', '--record', rec, '--out', sig).status, 1, 'the test flag is required');
    assert.match(run('sign-test', '--profile', 'nope', TEST).stderr, /--profile is bpq/);
    assert.match(run('sign-test', '--vk-out', vk, TEST).stderr, /--vk-out is for --profile bheart/);
    writeFileSync(sig, signH(H, hg.bytes));
    const yes = run('verify', '--record', rec, '--sig', sig, '--vk', vk, '--signers', H.id, '--genesis-sha3', b64u(sha3(hg.bytes)));
    assert.equal(yes.status, 0, yes.stdout + yes.stderr);
    assert.equal(JSON.parse(yes.stdout).id, H.id);
    assert.equal(run('verify', '--record', rec, '--sig', sig, '--vk', b64u(H.vk), '--signers', H.id, '--genesis-sha3', b64u(sha3(hg.bytes))).status, 0, '--vk as base64url');
    const noVk = run('verify', '--record', rec, '--sig', sig, '--signers', H.id, '--genesis-sha3', b64u(sha3(hg.bytes)));
    assert.equal(noVk.status, 1); assert.match(JSON.parse(noVk.stdout).why, /needs its verifying key/);
    const stranger = run('verify', '--record', rec, '--sig', sig, '--vk', vk, '--signers', OLD.id, '--genesis-sha3', b64u(sha3(hg.bytes)));
    assert.equal(stranger.status, 1); assert.match(JSON.parse(stranger.stdout).why, /is not a genesis signer/, 'a signer not in the authorized set');
    assert.equal(run('envelope', '--record', rec, '--sig', sig, '--vk', vk, '--out', env).status, 0);
    assert.ok(openEnvelope(readFileSync(env)).vk.equals(H.vk));
    // --vk FILE: the raw bytes, or bsigner keygen's JSON, are the same key
    writeFileSync(join(dir, 'vk.bin'), H.vk);
    writeFileSync(join(dir, 'keygen.json'), JSON.stringify({ key_id: H.key_id, verifying_key_b64u: b64u(H.vk) }, null, 2) + '\n');
    assert.ok(readVk(join(dir, 'vk.bin')).equals(H.vk) && readVk(join(dir, 'keygen.json')).equals(H.vk) && readVk(b64u(H.vk)).equals(H.vk));
    // bsigner sign --out writes pretty-printed JSON: refused as a relsig file, imported to its one byte form
    const pretty = join(dir, 'bsigner-out.json');
    writeFileSync(pretty, JSON.stringify(H.sign(hg.bytes), null, 2));
    assert.throws(() => readSig(readFileSync(pretty)), /not its one byte form/);
    const imp = run('import-sig', '--sig', pretty, '--out', join(dir, 'relsig.json'));
    assert.equal(imp.status, 0, imp.stderr);
    const relsig = readFileSync(join(dir, 'relsig.json'));
    assert.ok(relsig.equals(Buffer.from(canon(JSON.parse(readFileSync(pretty, 'utf8'))), 'latin1')));
    assert.equal(verifySig(readSig(relsig), hg.bytes, H.vk).ok, true);
    writeFileSync(pretty, JSON.stringify({ ...H.sign(hg.bytes), extra: 1 }));
    assert.match(run('import-sig', '--sig', pretty, '--out', join(dir, 'x.json')).stderr, /unknown field "extra"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('rotation: a §3b genesis names an mldsa65: id; a bheart seq 2 by it is accepted, a §3b seq 2 by the old key is refused', () => {
  const g1 = signBpq(OLD, g.bytes);
  assert.equal(verifyRelease({ recordBytes: g.bytes, sigBytes: g1, signers: [OLD.id], genesisSha3: PIN, law: NO_LAW }).ok, true);
  const two = signH(H, r2.bytes);
  const yes = verifyRelease({ recordBytes: r2.bytes, sigBytes: two, vk: H.vk, prevBytes: g.bytes, law: NO_LAW });
  assert.deepEqual([yes.ok, yes.id, yes.profile, yes.authorized_by], [true, H.id, 'bheart.signature/1', 'previous record signers']);
  const old = verifyRelease({ recordBytes: r2.bytes, sigBytes: signBpq(OLD, r2.bytes), prevBytes: g.bytes, law: NO_LAW });
  assert.equal(old.ok, false); assert.match(old.why, /is not among the previous record's signers/);
  const other = verifyRelease({ recordBytes: r2.bytes, sigBytes: signH(OTHER, r2.bytes), vk: OTHER.vk, prevBytes: g.bytes, law: NO_LAW });
  assert.equal(other.ok, false); assert.match(other.why, /is not among the previous record's signers/, 'a bheart signer not named');
  // place: the chain on disk, the vk kept in envelope.json, re-verified from the genesis pin on every place
  const dir = tmp();
  try {
    const base = { dir, signers: [OLD.id], genesisSha3: PIN, law: NO_LAW };
    place({ ...base, recordBytes: g.bytes, sigBytes: g1 });
    assert.throws(() => place({ ...base, recordBytes: r2.bytes, sigBytes: two }), /needs its verifying key/);
    assert.throws(() => place({ ...base, recordBytes: r2.bytes, sigBytes: signBpq(OLD, r2.bytes) }), /not among the previous record's signers/);
    assert.throws(() => place({ ...base, recordBytes: r2.bytes, sigBytes: two, vk: OTHER.vk, envelopeBytes: envelope(r2.bytes, two, {}, H.vk) }), /--vk is not the vk --envelope carries/);
    const placed = place({ ...base, recordBytes: r2.bytes, sigBytes: two, vk: H.vk });
    assert.equal(placed.seq, 2);
    const at = join(dir, 'keychain', 'releases', '2');
    assert.ok(openEnvelope(readFileSync(join(at, 'envelope.json'))).vk.equals(H.vk));
    assert.ok(readFileSync(join(at, 'record.json.relsig.json')).equals(two));
    assert.equal(place({ ...base, recordBytes: r2.bytes, sigBytes: two, vk: H.vk }).unchanged, true, 'the same bytes again');
    // a seq 3 re-verifies 1 and 2 from disk, seq 2's vk read from its envelope.json
    const r3 = assemble({ files: FILES, seq: 3, prev: b64u(sha3(r2.bytes)), signers: [H.id], commit: COMMIT });
    const three = signH(H, r3.bytes);
    assert.equal(place({ ...base, recordBytes: r3.bytes, sigBytes: three, envelopeBytes: envelope(r3.bytes, three, {}, H.vk) }).seq, 3);
    // probe.mjs reads the same chain (its pins: the genesis signer)
    const e = expectedFromRecords(join(dir, 'keychain', 'releases'), { pins: [OLD.id], law: [] });
    assert.deepEqual(e.chain.map(c => c.seq), [1, 2, 3]);
    // and the well-known check verifies a bheart envelope by its vk
    const got = { url: 'u', status: 200, headers: { 'content-type': 'application/json' }, bytes: envelope(r3.bytes, three, {}, H.vk) };
    const wk = wellKnownCheck('well-known A 203.0.113.7', got, { expected: e, auth: { pins: [OLD.id], law: [] } });
    assert.equal(wk.verdict, 'PASS', wk.evidence.brief);
    assert.equal(wk.evidence.signer, H.id);
    const noVk = JSON.parse(got.bytes); delete noVk.vk;
    assert.match(wellKnownCheck('wk', { ...got, bytes: Buffer.from(JSON.stringify(noVk)) }, { expected: e, auth: { pins: [OLD.id], law: [] } }).evidence.brief, /vk is required/);
    // a broken envelope.json leaves seq 2 without its key: the whole chain is refused, never half-read
    writeFileSync(join(at, 'envelope.json'), '{}');
    assert.throws(() => expectedFromRecords(join(dir, 'keychain', 'releases'), { pins: [OLD.id], law: [] }), /releases\/2\/record\.json: signature: a bheart\.signature\/1 needs its verifying key/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('anchor: sig.bpq keeps its name and carries the mldsa65: id; assess reads the release by its vk', async () => {
  const two = signH(H, r2.bytes);
  const prevJson = Buffer.from(canon({ loc: [], prev: GENESIS.sha3, rec: { sha256: GENESIS.sha3, sha3: GENESIS.sha3, size: 1 }, seq: 1, sig: { bpq: OLD.id, sha3: GENESIS.sha3 }, subject: 'keys.skaists.dev', type: 'release', v: 1 }), 'latin1');
  const { json } = buildAnchor({ recordBytes: r2.bytes, sigBytes: two, vk: H.vk, prevJson, seq: 2 });
  const a = JSON.parse(json);
  assert.equal(a.sig.bpq, H.id);
  assert.equal(a.sig.sha3, b64u(sha3(two)));
  assert.throws(() => buildAnchor({ recordBytes: r2.bytes, sigBytes: two, prevJson, seq: 2 }), /needs its verifying key/);
  const out = await assess([], async () => true, { recordBytes: r2.bytes, sigBytes: two, vk: H.vk });
  assert.equal(out.release.signer, H.id);
  await assert.rejects(assess([], async () => true, { recordBytes: r2.bytes, sigBytes: two, vk: OTHER.vk }), /key_id is not the bsigner key id/);
});

// ── the shared fixture (ops/keys-door/tests/vectors/profile-separation.json) ──────
// keys-door's profile_separation_vector_verdicts reads the same cases; both must reach each verdict.
const VECTOR = JSON.parse(readFileSync(join(ROOT, 'ops', 'keys-door', 'tests', 'vectors', 'profile-separation.json'), 'utf8'));
function jsVerdict(c) {
  try {
    const o = openEnvelope(Buffer.from(canon(c.envelope), 'latin1'));
    parseRecord(o.recordBytes);
    const v = verifySig(readSig(o.sigBytes), o.recordBytes, o.vk);
    return v.ok ? { accept: true, id: v.id } : { accept: false, why: v.why };
  } catch (e) { return { accept: false, why: e.message }; }
}

test('profile separation: the JS reader reaches every verdict of the shared fixture, no fallback between profiles', () => {
  assert.ok(VECTOR.cases.length >= 13);
  for (const c of VECTOR.cases) {
    const v = jsVerdict(c);
    console.log(`profile ${c.name}: ${v.accept ? `accept ${v.id}` : `refuse (${v.why})`}`);
    if (c.expect === 'accept') assert.deepEqual(v, { accept: true, id: c.signer }, c.name);
    else assert.equal(v.accept, false, c.name);
  }
  const why = n => jsVerdict(VECTOR.cases.find(c => c.name === n)).why;
  // a bheart object without its type is not re-read as §3b; a §3b object with a type is not re-read as bheart
  assert.match(why('bheart_type_removed'), /envelope\.vk is forbidden with a SPEC-BPQ-1 §3b signature/);
  assert.match(why('bheart_type_removed_no_vk'), /unknown field "agility"/);
  assert.match(why('bpq_with_type_added'), /envelope\.vk is required with a bheart\.signature\/1/);
  assert.match(why('bpq_with_type_added_and_vk'), /unknown field "at"/);
  assert.match(why('bpq_with_vk'), /envelope\.vk is forbidden/);
  assert.match(why('bheart_without_vk'), /envelope\.vk is required/);
  // and verifySig itself, handed each object directly, with no envelope around it
  const sigOf = n => VECTOR.cases.find(c => c.name === n).envelope.sig;
  const rec = Buffer.from(VECTOR.cases[0].envelope.record, 'base64url'), vk = Buffer.from(VECTOR.cases[1].envelope.vk, 'base64url');
  assert.match(verifySig(sigOf('bheart_type_removed'), rec, vk).why, /unknown field "agility"/);
  assert.match(verifySig(sigOf('bpq_with_type_added'), rec, undefined).why, /unknown field "at"/);
  assert.match(verifySig(sigOf('bpq_valid'), rec, vk).why, /vk is forbidden/);
});

test('signed_at_ms is unauthenticated and ignored: 0, far future and the original are one verdict, one signer, and never reported', () => {
  const sig = H.sign(hg.bytes);
  const at = n => ({ ...sig, signed_at_ms: n });
  const results = [sig, at(0), at(253402300799999)].map(s => verifySig(s, hg.bytes, H.vk));
  for (const r of results) assert.deepEqual(r, { ok: true, id: H.id, profile: 'bheart.signature/1' });
  // verifyRelease reports no time for a bheart release: nothing downstream can read one as truth
  const out = verifyRelease({ recordBytes: hg.bytes, sigBytes: sigBytesOf(at(1)), vk: H.vk, signers: [H.id], genesisSha3: b64u(sha3(hg.bytes)), law: NO_LAW });
  assert.equal(out.ok, true);
  assert.ok(!JSON.stringify(out).includes('signed_at') && out.at === undefined, JSON.stringify(out));
  // the shared fixture: the same signature bytes under different signed_at_ms, the same verdict
  const ids = ['bheart_valid', 'bheart_signed_at_ms_zero', 'bheart_signed_at_ms_far_future'].map(n => jsVerdict(VECTOR.cases.find(c => c.name === n)));
  assert.deepEqual(ids[1], ids[0]); assert.deepEqual(ids[2], ids[0]);
});

test('key_id is consistency with vk, never an authority: a bheart- key id is no signer id anywhere', () => {
  assert.ok(!isId(H.key_id));
  assert.throws(() => assemble({ files: FILES, seq: 1, prev: null, signers: [H.key_id], commit: COMMIT }), /not a bzpq1 or mldsa65: id/);
  // pinning the key id authorizes nothing, even with a good signature
  const v = verifyRelease({ recordBytes: hg.bytes, sigBytes: signH(H, hg.bytes), vk: H.vk, signers: [H.key_id], genesisSha3: b64u(sha3(hg.bytes)), law: NO_LAW });
  assert.equal(v.ok, false); assert.match(v.why, /is not a genesis signer/);
  assert.equal(v.id, H.id, 'the signer is named by the full key, mldsa65:sha3(vk)');
});

// ── noble vs bsigner (BSIGNER = a bsigner binary) ─────────────────────────────
const BSIGNER = process.env.BSIGNER;
const PHRASE = [...Array(23).fill('abandon'), 'art'].join(' ');   // the public BIP-39 test phrase, never a real key
const bsigner = (args, env = {}) => spawnSync(BSIGNER, args, { encoding: 'utf8', env: { ...process.env, KC_TEST_REC: PHRASE, ...env } });

test('cross check: a bsigner-made bheart signature verifies in noble; a noble-made one verifies in bsigner verify (public-only keyset)', t => {
  if (!BSIGNER) {
    console.log('NOT RUN: noble-vs-bsigner cross check (set BSIGNER to a bsigner binary to run it)');
    t.skip('BSIGNER is not set');
    return;
  }
  const dir = tmp();
  try {
    const keys = join(dir, 'keys');
    const kg = bsigner(['keygen', '--alg', 'ml-dsa-65', '--rec-env', 'KC_TEST_REC', '--keydir', keys]);
    assert.equal(kg.status, 0, kg.stderr);
    const made = JSON.parse(kg.stdout), vk = Buffer.from(made.verifying_key_b64u, 'base64url');
    assert.equal(bheartKeyId(vk), made.key_id, 'derive_key_id agrees');
    const rec = join(dir, 'record.json'), out = join(dir, 'bsigner-sig.json');
    const genesis = assemble({ files: FILES, seq: 1, prev: null, signers: [mldsaId(vk)], commit: COMMIT });
    writeFileSync(rec, genesis.bytes);
    const sg = bsigner(['sign', '--rec-env', 'KC_TEST_REC', '--key-id', made.key_id, '--file', rec, '--out', out, '--keydir', keys]);
    assert.equal(sg.status, 0, sg.stderr);
    // bsigner → import-sig → noble verifies it, and the release verifies end to end
    const imp = run('import-sig', '--sig', out, '--out', join(dir, 'relsig.json'));
    assert.equal(imp.status, 0, imp.stderr);
    const relsig = readFileSync(join(dir, 'relsig.json'));
    const v = verifyRelease({ recordBytes: genesis.bytes, sigBytes: relsig, vk, signers: [mldsaId(vk)], genesisSha3: b64u(sha3(genesis.bytes)), law: NO_LAW });
    assert.deepEqual([v.ok, v.id], [true, mldsaId(vk)], v.why);
    const t1 = Buffer.from(genesis.bytes); t1[t1.indexOf('index.html') + 1] ^= 1;
    assert.equal(verifySig(readSig(relsig), t1, vk).ok, false);
    // noble → bsigner verify, against a public-only keyset (relied on, not frozen: see README)
    const pub = join(dir, 'pub');
    mkdirSync(pub);
    writeFileSync(join(pub, `${H.key_id}.json`), JSON.stringify({ type: 'bheart.keyset/2', kind: 'signature', alg: 'ml-dsa-65', key_id: H.key_id, verifying_key_b64u: b64u(H.vk) }));
    const nsig = join(dir, 'noble-sig.json');
    writeFileSync(nsig, signH(H, genesis.bytes));
    const yes = bsigner(['verify', '--key-id', H.key_id, '--file', rec, '--envelope', nsig, '--keydir', pub]);
    assert.equal(yes.status, 0, yes.stdout + yes.stderr);
    assert.deepEqual([JSON.parse(yes.stdout).verified, JSON.parse(yes.stdout).key_id], [true, H.key_id]);
    writeFileSync(rec, t1);
    const no = bsigner(['verify', '--key-id', H.key_id, '--file', rec, '--envelope', nsig, '--keydir', pub]);
    assert.equal(no.status, 1);
    assert.equal(JSON.parse(no.stdout).verified, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
