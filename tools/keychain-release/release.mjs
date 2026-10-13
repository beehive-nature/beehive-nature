#!/usr/bin/env node
// release.mjs — release records for the isolated keychain at keys.skaists.dev
// (schema bnr.keychain-release/1).
//
//   prepare --out DIR [--seq N] [--prev RECORD] [--signers id,...] [--commit SHA]
//       run `node scripts/build-keychain.mjs --out <tmp>`, drop CNAME and .nojekyll, and write
//       DIR/record.json (canonical), DIR/pack.bin and DIR/site/
//   check DIR
//       rebuild from the commit the record names and require byte-identical files, record and pack
//   sign-test [--record R --out SIG] [--seed S] --i-understand-this-is-a-test-key
//       TEST ONLY: a throwaway ML-DSA-65 key made in this process signs R (SPEC-BPQ-1 §3b);
//       without --record it prints the throwaway id the seed gives
//   envelope --record R --sig S [--hint-ant A] [--hint-ar T]... [--hint-hive BLOCK:TRX] [--hint-peer URL]... [--out FILE]
//   verify --record R --sig S [--signers id,...] [--prev R0] [--genesis-sha3 B]
//       the signature and the seq/prev/signer rules an edge applies (one implementation here: noble)
//
// The record is the authority over what keys.skaists.dev serves: every byte by size, SHA-256 and
// SHA3-256, and the post-quantum ids allowed to sign the next record. No storage address is inside
// it; locators travel as unsigned hints and bytes are accepted by hash only. The release signer is
// unruled (R-SIGNER): docs/KEYCHAIN-RELEASE-SIGNERS.json stays empty until the founder names it,
// and no real release signature exists. The law key (docs/PQ-SIGNERS.json) is never a release key.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
export const BPQ = globalThis.BPQ;
const L = globalThis.BPQ_LIB;
if (!BPQ) throw new Error('surfaces/bpq.js did not load: no post-quantum library, no release tool');

export const SCHEMA = 'bnr.keychain-release/1', ENVELOPE = 'keychain-release-envelope/1';
export const CFG = Object.freeze({ origin: 'https://keys.skaists.dev', rp_id: 'keys.skaists.dev' });
// Never --origin/--parent: in PR #407 those name a REPLACEMENT origin and empty PARENTS.
export const BUILD = 'node scripts/build-keychain.mjs --out DIR', REPO = 'beehive-nature/beehive-nature';
const DROP = new Set(['CNAME', '.nojekyll']);
// What scripts/build-keychain.mjs reads at 38c394fac: itself, keychain/ and the two vendored
// onboarding sources. A later build that reads outside this set fails loudly (ENOENT) in check.
const INPUTS = ['scripts/build-keychain.mjs', 'keychain', 'surfaces/onboarding'];
const ENVELOPE_MAX = 64 * 1024;
const TEST_CONTEXT = 'keychain-release-test';

// ── bytes ────────────────────────────────────────────────────────────────
export const sha256 = b => createHash('sha256').update(b).digest();
export const sha3 = b => createHash('sha3-256').update(b).digest();
export const b64u = b => Buffer.from(b).toString('base64url');
// paths, keys and ids are printable ASCII, so UTF-16 order is byte order
export const bytewise = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const DIGEST_RE = /^[A-Za-z0-9_-]{43}$/;
// 32 bytes as base64url without padding; the round trip refuses non-zero spare bits. Hex never.
export const isDigest = s => typeof s === 'string' && DIGEST_RE.test(s) && b64u(Buffer.from(s, 'base64url')) === s;
export const isCount = n => Number.isSafeInteger(n) && n >= 0;
export function isId(s) {
  if (typeof s !== 'string' || s !== s.toLowerCase()) return false;
  try { const d = L.bech32m.decodeToBytes(s, 120); return d.prefix === 'bzpq' && d.bytes.length === 32; } catch { return false; }
}
const PATH_RE = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
const isPath = p => typeof p === 'string' && PATH_RE.test(p) && !p.split('/').some(s => s === '.' || s === '..');

// ── canonical JSON (contract §1) ─────────────────────────────────────────
// Printable ASCII strings, keys sorted bytewise at every level, no insignificant whitespace,
// integers only. A value it cannot carry is refused, never approximated.
const PRINTABLE = /^[\x20-\x7e]*$/;
export function canon(v) {
  if (v === null) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) throw new Error(`canonical JSON carries integers only, not ${v}`);
    return String(v);
  }
  if (typeof v === 'string') {
    if (!PRINTABLE.test(v)) throw new Error(`canonical JSON is printable ASCII only: ${JSON.stringify(v)}`);
    return '"' + v.replace(/["\\]/g, '\\$&') + '"';
  }
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  const proto = v && typeof v === 'object' ? Object.getPrototypeOf(v) : undefined;
  if (proto === Object.prototype || proto === null) {
    return '{' + Object.keys(v).sort(bytewise).map(k => canon(k) + ':' + canon(v[k])).join(',') + '}';
  }
  throw new Error(`canonical JSON cannot carry ${typeof v}`);
}

// The strict reader: refuses, with the byte offset, anything canon() would not have written
// (whitespace, non-ASCII, escapes other than \" and \\, floats, leading zeros, duplicate or
// unsorted keys, trailing bytes), then re-serializes and compares bytes besides.
export function parseStrict(input) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let i = 0;
  const fail = (why, at = i) => { throw new Error(`not canonical JSON at byte ${at}: ${why}`); };
  if (!b.length) fail('empty');
  for (let k = 0; k < b.length; k++) {
    if (b[k] >= 0x80) fail('non-ASCII byte', k);
    if (b[k] < 0x20 || b[k] === 0x7f) fail('control byte (no newline, tab or CR anywhere)', k);
  }
  const lit = (word, v) => { if (b.toString('latin1', i, i + word.length) !== word) fail('unexpected token'); i += word.length; return v; };
  function string() {
    i++;
    let s = '';
    for (;;) {
      const c = b[i];
      if (c === undefined) fail('unterminated string');
      if (c === 0x22) { i++; return s; }
      if (c === 0x5c) {
        const e = b[i + 1];
        if (e !== 0x22 && e !== 0x5c) fail('escape other than \\" or \\\\');
        s += String.fromCharCode(e); i += 2;
      } else { s += String.fromCharCode(c); i++; }
    }
  }
  function number() {
    const start = i;
    if (b[i] === 0x2d) { i++; if (b[i] === 0x30) fail('negative zero'); }
    if (b[i] === 0x30) { i++; if (b[i] >= 0x30 && b[i] <= 0x39) fail('leading zero'); }
    else if (b[i] >= 0x31 && b[i] <= 0x39) { while (b[i] >= 0x30 && b[i] <= 0x39) i++; }
    else fail('bad number');
    if (b[i] === 0x2e || b[i] === 0x65 || b[i] === 0x45) fail('float or exponent: integers only');
    const n = Number(b.toString('latin1', start, i));
    if (!Number.isSafeInteger(n)) fail('integer outside the safe range', start);
    return n;
  }
  function array() {
    i++;
    const out = [];
    if (b[i] === 0x5d) { i++; return out; }
    for (;;) {
      out.push(value());
      if (b[i] === 0x2c) { i++; continue; }
      if (b[i] === 0x5d) { i++; return out; }
      fail(b[i] === 0x20 ? 'insignificant whitespace' : "expected ',' or ']'");
    }
  }
  function object() {
    i++;
    const entries = [];
    if (b[i] === 0x7d) { i++; return {}; }
    for (;;) {
      if (b[i] !== 0x22) fail(b[i] === 0x20 ? 'insignificant whitespace' : 'expected a key');
      const at = i, k = string();
      if (entries.some(([seen]) => seen === k)) fail(`duplicate key "${k}"`, at);
      if (entries.length && bytewise(entries[entries.length - 1][0], k) > 0) fail(`key "${k}" is not in bytewise order`, at);
      if (b[i] !== 0x3a) fail(b[i] === 0x20 ? 'insignificant whitespace' : "expected ':'");
      i++;
      entries.push([k, value()]);
      if (b[i] === 0x2c) { i++; continue; }
      if (b[i] === 0x7d) { i++; return Object.fromEntries(entries); }   // fromEntries: "__proto__" stays an own key
      fail(b[i] === 0x20 ? 'insignificant whitespace' : "expected ',' or '}'");
    }
  }
  function value() {
    const c = b[i];
    if (c === 0x7b) return object();
    if (c === 0x5b) return array();
    if (c === 0x22) return string();
    if (c === 0x2d || (c >= 0x30 && c <= 0x39)) return number();
    if (c === 0x74) return lit('true', true);
    if (c === 0x66) return lit('false', false);
    if (c === 0x6e) return lit('null', null);
    fail(c === undefined ? 'unexpected end' : c === 0x20 ? 'insignificant whitespace' : 'unexpected byte');
  }
  const v = value();
  if (i !== b.length) fail(b[i] === 0x20 ? 'insignificant whitespace' : 'trailing bytes');
  if (!Buffer.from(canon(v), 'latin1').equals(b)) fail('bytes differ from the canonical re-serialization', 0);
  return v;
}

export function fields(o, names, where) {
  const proto = o && typeof o === 'object' && !Array.isArray(o) ? Object.getPrototypeOf(o) : undefined;
  if (proto !== Object.prototype && proto !== null) throw new Error(`${where} must be an object`);
  for (const k of Object.keys(o)) if (!names.includes(k)) throw new Error(`${where}: unknown field "${k}"`);
  for (const k of names) if (!Object.hasOwn(o, k)) throw new Error(`${where}: missing field "${k}"`);
  return o;
}
function digests(o, where) {
  for (const k of ['sha256', 'sha3']) if (!isDigest(o[k])) throw new Error(`${where}.${k} is not a base64url SHA digest (43 characters, no padding, never hex)`);
  if (!isCount(o.size)) throw new Error(`${where}.size is not a whole byte count`);
}

// ── the record (contract §1) ─────────────────────────────────────────────
const RECORD = ['files', 'kind', 'origin', 'pack', 'prev', 'rp_id', 'schema', 'seq', 'signers', 'source'];
export function parseRecord(bytes) {
  const r = fields(parseStrict(bytes), RECORD, 'record');
  if (r.schema !== SCHEMA) throw new Error(`record.schema is not ${SCHEMA}`);
  if (r.kind !== 'release') throw new Error('record.kind is not "release"');
  if (typeof r.origin !== 'string' || typeof r.rp_id !== 'string') throw new Error('record.origin and record.rp_id must be strings');
  if (!Number.isSafeInteger(r.seq) || r.seq < 1) throw new Error('record.seq must be an integer >= 1');
  if (r.seq === 1 && r.prev !== null) throw new Error('record.prev must be null at seq 1');
  if (r.seq > 1 && !isDigest(r.prev)) throw new Error('record.prev must be the base64url SHA3-256 of the previous record when seq > 1');
  if (!Array.isArray(r.files) || !r.files.length) throw new Error('record.files must be a non-empty array');
  let total = 0;
  r.files.forEach((f, n) => {
    fields(f, ['path', 'sha256', 'sha3', 'size'], `record.files[${n}]`);
    if (!isPath(f.path)) throw new Error(`record.files[${n}].path ${JSON.stringify(f.path)} is not a relative [A-Za-z0-9._/-] path`);
    if (n && bytewise(r.files[n - 1].path, f.path) >= 0) throw new Error(`record.files are not sorted by path with no repeats at ${f.path}`);
    digests(f, `record.files[${n}]`);
    total += f.size;
  });
  digests(fields(r.pack, ['sha256', 'sha3', 'size'], 'record.pack'), 'record.pack');
  if (r.pack.size !== total) throw new Error(`record.pack.size ${r.pack.size} is not the sum of the file sizes ${total}`);
  if (!Array.isArray(r.signers) || !r.signers.length) throw new Error('record.signers must name at least one id for the next record');
  r.signers.forEach((s, n) => {
    if (!isId(s)) throw new Error(`record.signers[${n}] is not a bzpq1 id`);
    if (n && bytewise(r.signers[n - 1], s) >= 0) throw new Error('record.signers must be sorted and unique');
  });
  fields(r.source, ['build', 'commit', 'repo'], 'record.source');
  if (r.source.build !== BUILD) throw new Error(`record.source.build must be exactly "${BUILD}"`);
  if (typeof r.source.commit !== 'string' || !/^[0-9a-f]{40}$/.test(r.source.commit)) throw new Error('record.source.commit is not a 40-hex commit');
  if (r.source.repo !== REPO) throw new Error(`record.source.repo must be "${REPO}"`);
  return r;
}
// Edge rule 1: the record is for this origin, and no other.
export function checkIdentity(r, cfg = CFG) {
  if (r.origin !== cfg.origin) throw new Error(`record.origin ${r.origin} is not ${cfg.origin}`);
  if (r.rp_id !== cfg.rp_id) throw new Error(`record.rp_id ${r.rp_id} is not ${cfg.rp_id}`);
  return r;
}

export function assemble({ files, seq, prev, signers, commit }) {
  const sorted = [...files].sort((a, b) => bytewise(a.path, b.path));
  const pack = Buffer.concat(sorted.map(f => f.bytes));
  const record = {
    files: sorted.map(f => ({ path: f.path, sha256: b64u(sha256(f.bytes)), sha3: b64u(sha3(f.bytes)), size: f.bytes.length })),
    kind: 'release', origin: CFG.origin,
    pack: { sha256: b64u(sha256(pack)), sha3: b64u(sha3(pack)), size: pack.length },
    prev, rp_id: CFG.rp_id, schema: SCHEMA, seq, signers: [...signers].sort(bytewise),
    source: { build: BUILD, commit, repo: REPO }
  };
  const bytes = Buffer.from(canon(record), 'latin1');
  parseRecord(bytes);   // what this writes, the strict reader must accept
  return { record, bytes, pack };
}

// Edge rule 6: every file and the pack by size, SHA-256 and SHA3-256; the pack is the files in order.
export function checkBytes(r, files, pack) {
  let off = 0;
  for (const f of r.files) {
    const got = files.get(f.path);
    if (!got) throw new Error(`${f.path} is missing`);
    if (got.length !== f.size || b64u(sha256(got)) !== f.sha256 || b64u(sha3(got)) !== f.sha3) throw new Error(`${f.path} is not the bytes the record names`);
    if (pack && !pack.subarray(off, off + f.size).equals(got)) throw new Error(`pack bytes at ${off} are not ${f.path}`);
    off += f.size;
  }
  if (pack && (pack.length !== r.pack.size || b64u(sha256(pack)) !== r.pack.sha256 || b64u(sha3(pack)) !== r.pack.sha3)) throw new Error('pack.bin is not the pack the record names');
}

// ── the build ────────────────────────────────────────────────────────────
export function walk(dir, base = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(join(dir, e.name), rel));
    else if (e.isFile()) out.push(rel);
    else throw new Error(`${rel} is not a regular file`);
  }
  return out.sort(bytewise);
}
const fileAt = (dir, path) => join(dir, ...path.split('/'));

// Runs the build exactly as source.build names it, in `cwd`, and returns the site without the
// GitHub Pages files (CNAME, .nojekyll), sorted by path.
export function buildSite(cwd) {
  const out = mkdtempSync(join(tmpdir(), 'kc-release-build-'));
  try {
    execFileSync(process.execPath, ['scripts/build-keychain.mjs', '--out', out], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const files = walk(out).filter(p => !DROP.has(p)).map(path => ({ path, bytes: readFileSync(fileAt(out, path)) }));
    // KC-ORIGINS guard: the built keychain.js must be the source file byte for byte. A build that
    // rewrote it (a replacement origin) does not serve keys.skaists.dev.
    const built = files.find(f => f.path === 'keychain.js');
    if (!built || !built.bytes.equals(readFileSync(join(cwd, 'keychain', 'keychain.js')))) {
      throw new Error('KC-ORIGINS: the built keychain.js is not keychain/keychain.js byte for byte; refusing');
    }
    return files;
  } finally { rmSync(out, { recursive: true, force: true }); }
}

const git = (args, opts = {}) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 256 << 20, stdio: ['pipe', 'pipe', 'pipe'], ...opts });
function commitOf(rev) {
  let c;
  try { c = git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).toString().trim(); } catch { c = ''; }
  if (!/^[0-9a-f]{40}$/.test(c)) throw new Error(`${rev} is not a commit in this clone`);
  return c;
}
// The build inputs as stored at `commit` (raw blobs: what a checkout writes, the repo being eol=lf).
export function inputsAt(commit) {
  const entries = git(['ls-tree', '-r', '-z', commit, '--', ...INPUTS]).toString('utf8').split('\0').filter(Boolean).map(line => {
    const tab = line.indexOf('\t'), [mode, type, oid] = line.slice(0, tab).split(' ');
    return { mode, type, oid, path: line.slice(tab + 1) };
  });
  if (!entries.some(e => e.path === 'scripts/build-keychain.mjs')) throw new Error(`${commit} has no scripts/build-keychain.mjs`);
  for (const e of entries) if (e.type !== 'blob' || !/^100(644|755)$/.test(e.mode)) throw new Error(`${e.path} at ${commit} is not a regular file (${e.mode} ${e.type})`);
  const out = git(['cat-file', '--batch'], { input: entries.map(e => e.oid).join('\n') + '\n' });
  const files = new Map();
  let o = 0;
  for (const e of entries) {
    const nl = out.indexOf(0x0a, o), [oid, type, size] = out.toString('latin1', o, nl).split(' ');
    if (oid !== e.oid || type !== 'blob') throw new Error(`git cat-file answered "${out.toString('latin1', o, nl)}" for ${e.path}`);
    files.set(e.path, out.subarray(nl + 1, nl + 1 + Number(size)));
    o = nl + 1 + Number(size) + 1;
  }
  return files;
}

const readJson = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
export const lawIds = () => new Set((existsSync(join(ROOT, 'docs', 'PQ-SIGNERS.json')) ? readJson('docs/PQ-SIGNERS.json').signers : []).map(s => s.id));
const pinnedSigners = () => readJson('docs/KEYCHAIN-RELEASE-SIGNERS.json').signers.map(s => (typeof s === 'string' ? s : s && s.id));
function refuseLaw(ids, law = lawIds()) {
  for (const id of ids) if (law.has(id)) throw new Error(`${id} is the law key (docs/PQ-SIGNERS.json); the law key is never a release authority`);
}
const list = s => s.split(',').map(x => x.trim()).filter(Boolean);

export function prepare(o) {
  const out = need(o, 'out');
  if (existsSync(out) && readdirSync(out).length) throw new Error(`${out} is not empty`);
  const commit = commitOf(o.commit ?? 'HEAD');
  // The record names a commit, so its bytes must be that commit's: a build input edited, staged or
  // re-ended (CRLF) in this working tree refuses here instead of being misnamed.
  for (const [path, blob] of inputsAt(commit)) {
    const p = fileAt(ROOT, path);
    if (!existsSync(p) || !readFileSync(p).equals(blob)) throw new Error(`${path} in the working tree is not its bytes at ${commit}`);
  }
  let seq = 1, prev = null;
  if (o.prev) {
    const pb = readFileSync(o.prev), pr = checkIdentity(parseRecord(pb));
    seq = pr.seq + 1; prev = b64u(sha3(pb));
  }
  if (o.seq !== undefined && (!/^[1-9][0-9]*$/.test(o.seq) || Number(o.seq) !== seq)) {
    throw new Error(o.prev ? `--seq must be ${seq}: the previous record is seq ${seq - 1}` : '--seq above 1 needs --prev (the record it follows)');
  }
  const signers = o.signers !== undefined ? list(o.signers) : pinnedSigners();
  if (!signers.length) throw new Error('no --signers and docs/KEYCHAIN-RELEASE-SIGNERS.json pins none: the release signer is unruled (R-SIGNER)');
  for (const s of signers) if (!isId(s)) throw new Error(`${s} is not a bzpq1 id`);
  refuseLaw(signers);
  const files = buildSite(ROOT);
  const { record, bytes, pack } = assemble({ files, seq, prev, signers, commit });
  for (const f of files) {
    mkdirSync(dirname(fileAt(join(out, 'site'), f.path)), { recursive: true });
    writeFileSync(fileAt(join(out, 'site'), f.path), f.bytes);
  }
  writeFileSync(join(out, 'record.json'), bytes);
  writeFileSync(join(out, 'pack.bin'), pack);
  return { record: join(out, 'record.json'), seq, prev, commit, files: record.files.length, pack: record.pack, sha3: b64u(sha3(bytes)), size: bytes.length };
}

export function check(dir) {
  const recordBytes = readFileSync(join(dir, 'record.json'));
  const r = checkIdentity(parseRecord(recordBytes));
  const pack = readFileSync(join(dir, 'pack.bin'));
  const site = join(dir, 'site'), held = walk(site), named = r.files.map(f => f.path);
  if (held.join('\n') !== named.join('\n')) throw new Error(`${site} holds [${held}] but the record names [${named}]`);
  checkBytes(r, new Map(held.map(p => [p, readFileSync(fileAt(site, p))])), pack);
  if (commitOf(r.source.commit) !== r.source.commit) throw new Error(`${r.source.commit} is not a commit in this clone`);
  const tmp = mkdtempSync(join(tmpdir(), 'kc-release-src-'));
  try {
    for (const [path, blob] of inputsAt(r.source.commit)) {
      mkdirSync(dirname(fileAt(tmp, path)), { recursive: true });
      writeFileSync(fileAt(tmp, path), blob);
    }
    const files = buildSite(tmp);
    const rebuilt = files.map(f => f.path).sort(bytewise);
    if (rebuilt.join('\n') !== named.join('\n')) throw new Error(`the build at ${r.source.commit} emits [${rebuilt}], the record names [${named}]`);
    for (const f of files) if (!f.bytes.equals(readFileSync(fileAt(site, f.path)))) throw new Error(`${f.path}: the build at ${r.source.commit} differs from ${site}`);
    const again = assemble({ files, seq: r.seq, prev: r.prev, signers: r.signers, commit: r.source.commit });
    if (!again.bytes.equals(recordBytes)) throw new Error(`the record rebuilt at ${r.source.commit} is not record.json byte for byte`);
    if (!again.pack.equals(pack)) throw new Error(`the pack rebuilt at ${r.source.commit} is not pack.bin byte for byte`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  return { ok: true, seq: r.seq, commit: r.source.commit, files: r.files.length, sha3: b64u(sha3(recordBytes)), rebuilt: 'byte-identical' };
}

// ── signatures (contract §2) ─────────────────────────────────────────────
// TEST ONLY. A throwaway key from a random root (or a seed, for repeatable tests). Never derived
// from the skaists.dev wallet passkey: any *.skaists.dev origin could re-derive that.
export function testKeys(seed) {
  const root = new Uint8Array(seed === undefined ? randomBytes(32) : sha3(Buffer.from('bnr.keychain-release/test-seed\n' + seed, 'utf8')));
  try { return BPQ.keys(root, TEST_CONTEXT); } finally { root.fill(0); }
}

const SIG = ['at', 'bpq', 'dsa', 'file', 'id', 'kind', 'sig', 'succ'];
export function readSig(bytes) {
  const d = JSON.parse(Buffer.from(bytes).toString('utf8'));
  fields(d, SIG, 'signature');
  fields(d.file, ['sha3', 'size'], 'signature.file');
  if (d.bpq !== 1 || d.kind !== 'detached') throw new Error('not a SPEC-BPQ-1 §3b detached signature');
  return d;
}

// Edge rules 1-3 over one step: strict record, a valid ML-DSA-65 signature by an authorized id,
// and seq/prev. seq 1 is authorized by the genesis signers (and, if given, the genesis sha3 pin);
// seq N > 1 only as prev.seq + 1, signed by an id the previous record names.
export function verifyRelease({ recordBytes, sigBytes, signers, prevBytes, genesisSha3, cfg = CFG, law = lawIds() }) {
  try {
    const r = checkIdentity(parseRecord(recordBytes), cfg);
    const d = readSig(sigBytes);
    const v = BPQ.verifyFile(d, new Uint8Array(recordBytes));
    if (!v.ok) return { ok: false, why: `signature: ${v.why}` };
    if (law.has(v.id)) return { ok: false, id: v.id, why: 'signed by the law key, which is never a release authority' };
    const sha = b64u(sha3(recordBytes));
    if (prevBytes) {
      const p = checkIdentity(parseRecord(prevBytes), cfg);
      if (r.seq !== p.seq + 1) return { ok: false, id: v.id, why: `seq ${r.seq} is not ${p.seq + 1}: a record is accepted only as current+1, never a jump` };
      if (r.prev !== b64u(sha3(prevBytes))) return { ok: false, id: v.id, why: 'record.prev does not name the previous record' };
      if (!p.signers.includes(v.id)) return { ok: false, id: v.id, why: `${v.id} is not among the previous record's signers` };
      if (signers && !signers.includes(v.id)) return { ok: false, id: v.id, why: `${v.id} is not among --signers` };
      return { ok: true, id: v.id, at: v.at, seq: r.seq, sha3: sha, authorized_by: 'previous record signers' };
    }
    if (r.seq !== 1) return { ok: false, id: v.id, why: `seq ${r.seq} needs the record it follows (--prev): genesis pins authorize genesis only` };
    if (!signers || !signers.length) return { ok: false, id: v.id, why: 'seq 1 needs the genesis signers (--signers)' };
    if (!signers.includes(v.id)) return { ok: false, id: v.id, why: `${v.id} is not a genesis signer` };
    if (genesisSha3 !== undefined && genesisSha3 !== sha) return { ok: false, id: v.id, why: `record sha3 ${sha} is not the genesis pin ${genesisSha3}` };
    return { ok: true, id: v.id, at: v.at, seq: 1, sha3: sha, authorized_by: 'genesis signers', genesis_pin: genesisSha3 === undefined ? 'not given' : 'matched' };
  } catch (e) { return { ok: false, why: e.message }; }
}

// ── envelope (contract §3) ───────────────────────────────────────────────
export function envelope(recordBytes, sigBytes, hints = {}) {
  checkIdentity(parseRecord(recordBytes));
  const sig = readSig(sigBytes);
  const v = BPQ.verifyFile(sig, new Uint8Array(recordBytes));
  if (!v.ok) throw new Error(`the signature is not over this record: ${v.why}`);
  const h = {};
  if (hints.ant !== undefined) {
    if (!/^[A-Za-z0-9:._-]{1,256}$/.test(hints.ant)) throw new Error('--hint-ant is not an address');
    h.ant = hints.ant;
  }
  if (hints.ar && hints.ar.length) {
    for (const t of hints.ar) if (!/^[A-Za-z0-9_-]{43}$/.test(t)) throw new Error(`--hint-ar ${t} is not an Arweave transaction id`);
    h.ar = hints.ar;
  }
  if (hints.hive !== undefined) {
    const m = /^([1-9][0-9]*):([0-9a-f]{40})$/.exec(hints.hive);
    if (!m) throw new Error('--hint-hive must be BLOCK:TRX (a block number and a 40-hex transaction id)');
    h.hive = { block: Number(m[1]), trx: m[2] };
  }
  if (hints.peers && hints.peers.length) {
    for (const p of hints.peers) if (!/^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[\x21-\x7e]*)?$/.test(p)) throw new Error(`--hint-peer ${p} is not an https URL`);
    h.peers = hints.peers;
  }
  const bytes = Buffer.from(canon({ bnr: ENVELOPE, hints: h, record: b64u(recordBytes), sig }), 'latin1');
  if (bytes.length > ENVELOPE_MAX) throw new Error(`the envelope is ${bytes.length} bytes, over the 64 KiB limit`);
  return bytes;
}

// ── command line ─────────────────────────────────────────────────────────
function need(o, k) { if (o[k] === undefined) throw new Error(`--${k} is required`); return o[k]; }
export function args(argv, spec) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if ((spec.flag || []).includes(k)) { o[k] = true; continue; }
    const many = (spec.list || []).includes(k);
    if (!many && !(spec.value || []).includes(k)) throw new Error(`unknown option ${a}`);
    const v = argv[++i];
    if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
    if (many) (o[k] ||= []).push(v);
    else if (k in o) throw new Error(`${a} given twice`);
    else o[k] = v;
  }
  if (o._.length > (spec.positional || 0)) throw new Error(`unexpected argument ${o._[spec.positional || 0]}`);
  return o;
}

const COMMANDS = {
  prepare: [{ value: ['out', 'seq', 'prev', 'signers', 'commit'] }, prepare],
  check: [{ positional: 1 }, o => { if (!o._[0]) throw new Error('check needs DIR'); return check(o._[0]); }],
  'sign-test': [{ value: ['record', 'out', 'seed'], flag: ['i-understand-this-is-a-test-key'] }, o => {
    if (!o['i-understand-this-is-a-test-key']) throw new Error('sign-test signs with a THROWAWAY key that authorizes nothing; pass --i-understand-this-is-a-test-key');
    if (o.out && !o.record) throw new Error('--out needs --record');
    const k = testKeys(o.seed);
    try {
      if (!o.record) return { test_key: true, id: k.id, sig: null };
      const bytes = readFileSync(o.record);
      checkIdentity(parseRecord(bytes));
      const d = BPQ.signFile(k, new Uint8Array(bytes), new Date().toISOString());
      writeFileSync(need(o, 'out'), JSON.stringify(d, null, 1) + '\n');
      return { test_key: true, id: k.id, sig: o.out, record_sha3: b64u(sha3(bytes)) };
    } finally { k.wipe(); }
  }],
  envelope: [{ value: ['record', 'sig', 'hint-ant', 'hint-hive', 'out'], list: ['hint-ar', 'hint-peer'] }, o => {
    const bytes = envelope(readFileSync(need(o, 'record')), readFileSync(need(o, 'sig')), { ant: o['hint-ant'], ar: o['hint-ar'], hive: o['hint-hive'], peers: o['hint-peer'] });
    if (!o.out) { process.stdout.write(bytes + '\n'); return undefined; }
    writeFileSync(o.out, bytes);
    return { envelope: o.out, size: bytes.length };
  }],
  verify: [{ value: ['record', 'sig', 'signers', 'prev', 'genesis-sha3'] }, o => {
    const r = verifyRelease({
      recordBytes: readFileSync(need(o, 'record')), sigBytes: readFileSync(need(o, 'sig')),
      signers: o.signers ? list(o.signers) : undefined, prevBytes: o.prev ? readFileSync(o.prev) : undefined,
      genesisSha3: o['genesis-sha3']
    });
    if (!r.ok) { console.log(JSON.stringify(r)); process.exitCode = 1; return undefined; }
    return r;
  }]
};

export async function cli(commands, argv, usage) {
  const [cmd, ...rest] = argv;
  if (!commands[cmd]) { console.error(usage); process.exit(2); }
  try {
    const [spec, fn] = commands[cmd];
    const out = await fn(args(rest, spec));
    if (out !== undefined) console.log(JSON.stringify(out));
  } catch (e) { console.error(`${cmd}: ${e.message}`); process.exit(1); }
}

const self = fileURLToPath(import.meta.url), argv1 = process.argv[1] ? resolve(process.argv[1]) : '';
if (process.platform === 'win32' ? self.toLowerCase() === argv1.toLowerCase() : self === argv1) {
  await cli(COMMANDS, process.argv.slice(2), 'usage: release.mjs prepare|check|sign-test|envelope|verify (see the header of tools/keychain-release/release.mjs)');
}
