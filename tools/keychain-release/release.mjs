#!/usr/bin/env node
// release.mjs — release records for the isolated keychain at keys.skaists.dev
// (schema bnr.keychain-release/1).
//
//   prepare --out DIR [--seq N] [--prev RECORD] [--signers id,...] [--commit SHA]
//       run `node scripts/build-keychain.mjs --out <tmp>`, drop CNAME and .nojekyll, and write
//       DIR/record.json (canonical), DIR/pack.bin and DIR/site/
//   check DIR
//       rebuild from the commit the record names and require byte-identical files, record and pack
//   sign-test [--profile bpq|bheart] [--record R --out SIG] [--vk-out FILE] [--seed S] --i-understand-this-is-a-test-key
//       TEST ONLY: a throwaway ML-DSA-65 key made in this process signs R, as a SPEC-BPQ-1 §3b
//       signature (bpq, the default) or as a bheart.signature/1 (bheart; --vk-out writes its
//       verifying key, base64url); without --record it prints the throwaway id the seed gives
//   import-sig --sig FILE --out RELSIG
//       a signature as its signer wrote it (bsigner sign writes pretty-printed JSON) checked for its
//       exact field set and written in its one byte form
//   envelope --record R --sig S [--vk FILE|B64U] [--hint-ant A] [--hint-ar T]... [--hint-hive BLOCK:TRX] [--hint-peer URL]... [--out FILE]
//   verify --record R --sig S [--vk FILE|B64U] [--signers id,...] [--prev R0] [--genesis-sha3 B | --no-genesis-pin]
//       the signature and the seq/prev/signer rules an edge applies (one implementation here: noble);
//       seq 1 needs the genesis pin, and --no-genesis-pin is a signature-only check, never ok:true.
//       Exit 0 only for ok:true; 1 for a refusal; 3 for a good signature-only check (no chain verdict)
//   place --dir DIR --record R --sig S [--envelope E] [--vk FILE|B64U] --signers id,... --genesis-sha3 B
//       verify the chain already placed under DIR (rules 1-3 from the genesis pin, every envelope.json,
//       A2's layout and nothing else), then R as the next record, and write
//       DIR/keychain/releases/<seq>/{record.json, record.json.relsig.json, envelope.json};
//       an existing seq directory with other bytes is refused, never rewritten
//
// Two signature profiles are accepted, as the edge accepts them (ops/keys-door):
//   - SPEC-BPQ-1 §3b detached signatures, signer id bzpq1…; the envelope carries no vk.
//   - bheart.signature/1, what the frozen `bsigner sign` writes: ML-DSA-65 over the RAW record bytes,
//     empty context, no domain prefix (signed_at_ms and agility are not signed). Its verifying key
//     travels as the envelope's vk (REQUIRED there), and its signer id is
//     mldsa65:<base64url SHA3-256(vk)>. --vk FILE|B64U: the base64url text, or a file holding it, the
//     raw 1952 bytes, or a JSON object with verifying_key_b64u (bsigner keygen's output).
//
// A signature file (record.json.relsig.json) has ONE byte form: the canonical JSON of the record
// (§1 canon), no trailing newline. The envelope's sig is that same object, so canon(envelope.sig)
// is the file byte for byte and an anchor's sig.sha3 can be recomputed from either.
//
// The record is the authority over what keys.skaists.dev serves: every byte by size, SHA-256 and
// SHA3-256, and the post-quantum ids allowed to sign the next record. No storage address is inside
// it; locators travel as unsigned hints and bytes are accepted by hash only. The release signer is
// unruled (R-SIGNER): docs/KEYCHAIN-RELEASE-SIGNERS.json stays empty until the founder names it,
// and no real release signature exists. The law key (docs/PQ-SIGNERS.json) is never a release key.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
export function isBzpqId(s) {
  if (typeof s !== 'string' || s !== s.toLowerCase()) return false;
  try { const d = L.bech32m.decodeToBytes(s, 120); return d.prefix === 'bzpq' && d.bytes.length === 32; } catch { return false; }
}
// The bheart profile's signer id: "mldsa65:" + base64url (no padding) of SHA3-256(verifying key).
export const MLDSA_PREFIX = 'mldsa65:';
export const isMldsaId = s => typeof s === 'string' && s.startsWith(MLDSA_PREFIX) && isDigest(s.slice(MLDSA_PREFIX.length));
// A signer id of either accepted profile (record.signers, the genesis signers, the pins).
export const isId = s => isBzpqId(s) || isMldsaId(s);
export const DSA_PK_LEN = 1952, DSA_SIG_LEN = 3309;
export const mldsaId = vk => MLDSA_PREFIX + b64u(sha3(vkBytes(vk)));
// bsigner's key id (crates/bsigner/src/keys.rs derive_key_id): "bheart-" + the first 16 characters of
// base64url(SHA3-256(UTF-8 "ml-dsa-65" || verifying key)).
export const bheartKeyId = vk => 'bheart-' + b64u(sha3(Buffer.concat([Buffer.from('ml-dsa-65'), vkBytes(vk)]))).slice(0, 16);
// A verifying key as bytes, from bytes or strict base64url; exactly 1952 bytes or refused.
export function vkBytes(vk) {
  let b;
  if (typeof vk === 'string') {
    b = /^[A-Za-z0-9_-]+$/.test(vk) ? Buffer.from(vk, 'base64url') : null;
    if (!b || b64u(b) !== vk) throw new Error('vk is not canonical base64url');
  } else if (vk instanceof Uint8Array) b = Buffer.from(vk);
  else throw new Error('vk is missing');
  if (b.length !== DSA_PK_LEN) throw new Error(`vk is ${b.length} bytes, not the 1952 of an ML-DSA-65 verifying key`);
  return b;
}
// --vk FILE|B64U: the base64url text itself, or a file holding the text (one trailing newline
// allowed), the raw 1952 bytes, or a JSON object with verifying_key_b64u (bsigner keygen's output).
export function readVk(arg) {
  if (/^[A-Za-z0-9_-]{2603}$/.test(arg)) return vkBytes(arg);
  const raw = readFileSync(arg);
  if (raw.length === DSA_PK_LEN) return Buffer.from(raw);
  const text = raw.toString('latin1').replace(/\n$/, '');
  if (text.startsWith('{')) {
    let j;
    try { j = JSON.parse(text); } catch { throw new Error(`${arg} is not JSON`); }
    return vkBytes(j && j.verifying_key_b64u);
  }
  return vkBytes(text);
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
    if (!isId(s)) throw new Error(`record.signers[${n}] is not a bzpq1 or mldsa65: id`);
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

// `root` is the clone that builds: this one unless a caller (the tests' scratch repositories) names another.
const git = (args, root = ROOT, opts = {}) => execFileSync('git', args, { cwd: root, maxBuffer: 256 << 20, stdio: ['pipe', 'pipe', 'pipe'], ...opts });
function commitOf(rev, root = ROOT) {
  let c;
  try { c = git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`], root).toString().trim(); } catch { c = ''; }
  if (!/^[0-9a-f]{40}$/.test(c)) throw new Error(`${rev} is not a commit in this clone`);
  return c;
}
// The build inputs as stored at `commit` (raw blobs: what a checkout writes, the repo being eol=lf).
export function inputsAt(commit, root = ROOT) {
  const entries = git(['ls-tree', '-r', '-z', commit, '--', ...INPUTS], root).toString('utf8').split('\0').filter(Boolean).map(line => {
    const tab = line.indexOf('\t'), [mode, type, oid] = line.slice(0, tab).split(' ');
    return { mode, type, oid, path: line.slice(tab + 1) };
  });
  if (!entries.some(e => e.path === 'scripts/build-keychain.mjs')) throw new Error(`${commit} has no scripts/build-keychain.mjs`);
  for (const e of entries) if (e.type !== 'blob' || !/^100(644|755)$/.test(e.mode)) throw new Error(`${e.path} at ${commit} is not a regular file (${e.mode} ${e.type})`);
  const out = git(['cat-file', '--batch'], root, { input: entries.map(e => e.oid).join('\n') + '\n' });
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

const readJson = (p, root = ROOT) => JSON.parse(readFileSync(join(root, p), 'utf8'));
// The law ids are always this repository's: no clone a caller names can make the law key a release key.
export const lawIds = () => new Set((existsSync(join(ROOT, 'docs', 'PQ-SIGNERS.json')) ? readJson('docs/PQ-SIGNERS.json').signers : []).map(s => s.id));
const pinnedSigners = root => readJson('docs/KEYCHAIN-RELEASE-SIGNERS.json', root).signers.map(s => (typeof s === 'string' ? s : s && s.id));
function refuseLaw(ids, law = lawIds()) {
  for (const id of ids) if (law.has(id)) throw new Error(`${id} is the law key (docs/PQ-SIGNERS.json); the law key is never a release authority`);
}
const list = s => s.split(',').map(x => x.trim()).filter(Boolean);

export function prepare(o) {
  const out = need(o, 'out'), root = o.root ?? ROOT;
  if (existsSync(out) && readdirSync(out).length) throw new Error(`${out} is not empty`);
  const commit = commitOf(o.commit ?? 'HEAD', root);
  // The record names a commit, so its bytes must be that commit's: a build input edited, staged or
  // re-ended (CRLF) in this working tree refuses here instead of being misnamed.
  for (const [path, blob] of inputsAt(commit, root)) {
    const p = fileAt(root, path);
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
  const signers = o.signers !== undefined ? list(o.signers) : pinnedSigners(root);
  if (!signers.length) throw new Error('no --signers and docs/KEYCHAIN-RELEASE-SIGNERS.json pins none: the release signer is unruled (R-SIGNER)');
  for (const s of signers) if (!isId(s)) throw new Error(`${s} is not a bzpq1 or mldsa65: id`);
  refuseLaw(signers);
  const files = buildSite(root);
  const { record, bytes, pack } = assemble({ files, seq, prev, signers, commit });
  for (const f of files) {
    mkdirSync(dirname(fileAt(join(out, 'site'), f.path)), { recursive: true });
    writeFileSync(fileAt(join(out, 'site'), f.path), f.bytes);
  }
  writeFileSync(join(out, 'record.json'), bytes);
  writeFileSync(join(out, 'pack.bin'), pack);
  return { record: join(out, 'record.json'), seq, prev, commit, files: record.files.length, pack: record.pack, sha3: b64u(sha3(bytes)), size: bytes.length };
}

export function check(dir, { root = ROOT } = {}) {
  const recordBytes = readFileSync(join(dir, 'record.json'));
  const r = checkIdentity(parseRecord(recordBytes));
  const pack = readFileSync(join(dir, 'pack.bin'));
  const site = join(dir, 'site'), held = walk(site), named = r.files.map(f => f.path);
  if (held.join('\n') !== named.join('\n')) throw new Error(`${site} holds [${held}] but the record names [${named}]`);
  checkBytes(r, new Map(held.map(p => [p, readFileSync(fileAt(site, p))])), pack);
  if (commitOf(r.source.commit, root) !== r.source.commit) throw new Error(`${r.source.commit} is not a commit in this clone`);
  const tmp = mkdtempSync(join(tmpdir(), 'kc-release-src-'));
  try {
    for (const [path, blob] of inputsAt(r.source.commit, root)) {
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

// TEST ONLY. A throwaway bheart signer: a noble ML-DSA-65 key from a random seed (or a named one,
// for repeatable tests). It signs as `bsigner sign` does: the raw bytes, empty context.
export function testBheartKey(seed) {
  const s = new Uint8Array(seed === undefined ? randomBytes(32) : sha3(Buffer.from('bnr.keychain-release/test-seed-bheart\n' + seed, 'utf8')));
  let k;
  try { k = L.ml_dsa65.keygen(s); } finally { s.fill(0); }
  const vk = Buffer.from(k.publicKey);
  return {
    vk, id: mldsaId(vk), key_id: bheartKeyId(vk),
    sign: bytes => bheartSig(bheartKeyId(vk), bytes, L.ml_dsa65.sign(new Uint8Array(bytes), k.secretKey)),
    wipe: () => k.secretKey.fill(0)
  };
}

export const BHEART_TYPE = 'bheart.signature/1', BHEART_ALG = 'ml-dsa-65';
// bsigner's agility text (crates/bsigner/src/envelope.rs); not covered by the signature.
const AGILITY = 'verify dispatches on the alg fields above; unknown ids are refused, never defaulted';
// A bheart.signature/1 object, field for field as bsigner's sign_envelope writes it.
export function bheartSig(keyId, bytes, sig, signedAtMs = Date.now()) {
  return {
    agility: AGILITY, alg: BHEART_ALG,
    content: { bytes: bytes.length, digest: { alg: 'sha3-256', b64u: b64u(sha3(bytes)), bytes: bytes.length } },
    key_id: keyId, signature: { alg: BHEART_ALG, b64u: b64u(sig), bytes: sig.length },
    signed_at_ms: signedAtMs, type: BHEART_TYPE
  };
}

const SIG = ['at', 'bpq', 'dsa', 'file', 'id', 'kind', 'sig', 'succ'];
const BHEART = ['agility', 'alg', 'content', 'key_id', 'signature', 'signed_at_ms', 'type'];
// An object with a "type" field is read as a bheart.signature/1, anything else as §3b; each is then
// held to its exact field set, so no object is both.
export const isBheart = d => !!d && typeof d === 'object' && Object.hasOwn(d, 'type');
const B64U_RE = /^[A-Za-z0-9_-]*$/;
// The shape of a signature object of either profile, wherever it came from (a file, an envelope).
export function checkSig(d) {
  if (isBheart(d)) {
    fields(d, BHEART, 'signature');
    fields(d.content, ['bytes', 'digest'], 'signature.content');
    fields(d.content.digest, ['alg', 'b64u', 'bytes'], 'signature.content.digest');
    fields(d.signature, ['alg', 'b64u', 'bytes'], 'signature.signature');
    if (d.type !== BHEART_TYPE) throw new Error(`signature.type is not ${BHEART_TYPE}`);
    if (d.alg !== BHEART_ALG || d.signature.alg !== BHEART_ALG) throw new Error('signature.alg and signature.signature.alg must both be ml-dsa-65');
    if (d.content.digest.alg !== 'sha3-256') throw new Error('signature.content.digest.alg is not sha3-256');
    if (typeof d.agility !== 'string' || !d.agility || d.agility.length > 256 || !PRINTABLE.test(d.agility)) throw new Error('signature.agility is not printable ASCII');
    if (typeof d.key_id !== 'string' || !/^bheart-[A-Za-z0-9_-]{16}$/.test(d.key_id)) throw new Error('signature.key_id is not a bsigner key id');
    for (const s of [d.content.digest.b64u, d.signature.b64u]) if (typeof s !== 'string' || !B64U_RE.test(s)) throw new Error('signature digests and bytes are base64url');
    for (const n of [d.content.bytes, d.content.digest.bytes, d.signature.bytes, d.signed_at_ms]) if (!isCount(n)) throw new Error('signature byte counts and signed_at_ms are whole numbers');
    return d;
  }
  fields(d, SIG, 'signature');
  fields(d.file, ['sha3', 'size'], 'signature.file');
  if (d.bpq !== 1 || d.kind !== 'detached') throw new Error('not a SPEC-BPQ-1 §3b detached signature');
  return d;
}

// The signature of either profile over exactly these record bytes, before any chain rule:
// { ok, id, profile, at? } or { ok: false, why }. vk is the envelope's verifying key (bytes or
// base64url): REQUIRED with a bheart.signature/1, FORBIDDEN with a §3b signature.
export function verifySig(d, recordBytes, vk) {
  try { checkSig(d); } catch (e) { return { ok: false, why: e.message }; }
  if (!isBheart(d)) {
    if (vk !== undefined) return { ok: false, why: 'vk is forbidden with a SPEC-BPQ-1 §3b signature (it carries its own key)' };
    const v = BPQ.verifyFile(d, new Uint8Array(recordBytes));
    return v.ok ? { ok: true, id: v.id, at: v.at, profile: 'bpq1/detached' } : { ok: false, why: v.why };
  }
  if (vk === undefined) return { ok: false, why: 'a bheart.signature/1 needs its verifying key (vk)' };
  let k;
  try { k = vkBytes(vk); } catch (e) { return { ok: false, why: e.message }; }
  if (d.key_id !== bheartKeyId(k)) return { ok: false, why: 'signature.key_id is not the bsigner key id of vk' };
  const n = recordBytes.length;
  if (d.content.bytes !== n || d.content.digest.bytes !== n || d.content.digest.b64u !== b64u(sha3(recordBytes))) return { ok: false, why: 'the signature names other bytes than this record (size or SHA3-256)' };
  const sig = Buffer.from(d.signature.b64u, 'base64url');
  if (b64u(sig) !== d.signature.b64u || sig.length !== DSA_SIG_LEN || d.signature.bytes !== DSA_SIG_LEN) return { ok: false, why: 'signature.signature is not 3309 bytes of canonical base64url' };
  let ok = false;
  try { ok = L.ml_dsa65.verify(new Uint8Array(sig), new Uint8Array(recordBytes), new Uint8Array(k)) === true; } catch { ok = false; }
  return ok ? { ok: true, id: mldsaId(k), profile: BHEART_TYPE } : { ok: false, why: 'the ML-DSA-65 signature does not verify' };
}
// The one byte form of a signature: what sign-test writes, what an envelope's sig re-serializes to,
// and what an anchor's sig.sha3 hashes.
export const sigBytesOf = d => Buffer.from(canon(checkSig(d)), 'latin1');
// A signature file is read strictly: canonical JSON, no trailing newline, so its sha3 is one value.
export function readSig(bytes) {
  let d;
  try { d = parseStrict(bytes); } catch (e) { throw new Error(`the signature file is not its one byte form (canonical JSON, no trailing newline): ${e.message}`); }
  return checkSig(d);
}
export const sigSha3 = sigBytes => b64u(sha3(sigBytesOf(readSig(sigBytes))));

// Edge rules 1-3 over one step: strict record, a valid ML-DSA-65 signature by an authorized id,
// and seq/prev. seq 1 is authorized by the genesis signers AND the genesis sha3 pin (rule 3);
// seq N > 1 only as prev.seq + 1, signed by an id the previous record names.
// noGenesisPin: a signature-only check of a seq 1 record. It reports signature_ok and is never
// ok: true, because without the pin nothing here says this record is the genesis.
export function verifyRelease({ recordBytes, sigBytes, vk, signers, prevBytes, genesisSha3, noGenesisPin = false, cfg = CFG, law = lawIds() }) {
  try {
    const r = checkIdentity(parseRecord(recordBytes), cfg);
    const d = readSig(sigBytes);
    const v = verifySig(d, recordBytes, vk);
    if (!v.ok) return { ok: false, why: `signature: ${v.why}` };
    if (law.has(v.id)) return { ok: false, id: v.id, why: 'signed by the law key, which is never a release authority' };
    const sha = b64u(sha3(recordBytes));
    if (prevBytes) {
      if (noGenesisPin) return { ok: false, id: v.id, why: '--no-genesis-pin is for a seq 1 record alone; a record after it is checked against the record it follows' };
      const p = checkIdentity(parseRecord(prevBytes), cfg);
      if (r.seq !== p.seq + 1) return { ok: false, id: v.id, why: `seq ${r.seq} is not ${p.seq + 1}: a record is accepted only as current+1, never a jump` };
      if (r.prev !== b64u(sha3(prevBytes))) return { ok: false, id: v.id, why: 'record.prev does not name the previous record' };
      if (!p.signers.includes(v.id)) return { ok: false, id: v.id, why: `${v.id} is not among the previous record's signers` };
      if (signers && !signers.includes(v.id)) return { ok: false, id: v.id, why: `${v.id} is not among --signers` };
      return { ok: true, id: v.id, at: v.at, profile: v.profile, seq: r.seq, sha3: sha, authorized_by: 'previous record signers' };
    }
    if (r.seq !== 1) return { ok: false, id: v.id, why: `seq ${r.seq} needs the record it follows (--prev): genesis pins authorize genesis only` };
    if (!signers || !signers.length) return { ok: false, id: v.id, why: 'seq 1 needs the genesis signers (--signers)' };
    if (!signers.includes(v.id)) return { ok: false, id: v.id, why: `${v.id} is not a genesis signer` };
    if (noGenesisPin) {
      if (genesisSha3 !== undefined) return { ok: false, id: v.id, why: '--no-genesis-pin and --genesis-sha3 contradict each other' };
      return { ok: false, signature_ok: true, checked: 'signature only (--no-genesis-pin)', id: v.id, at: v.at, profile: v.profile, seq: 1, sha3: sha,
        authorized_by: 'genesis signers', genesis_pin: 'not checked', why: 'signature only: rule 3 accepts a genesis by its pinned sha3, which was not given, so this is no verdict on the chain' };
    }
    if (genesisSha3 === undefined) return { ok: false, id: v.id, why: 'seq 1 needs the genesis pin (--genesis-sha3): rule 3 accepts a genesis only by its pinned sha3 and its signers' };
    if (!isDigest(genesisSha3)) return { ok: false, id: v.id, why: `the genesis pin ${genesisSha3} is not a base64url SHA3-256 digest` };
    if (genesisSha3 !== sha) return { ok: false, id: v.id, why: `record sha3 ${sha} is not the genesis pin ${genesisSha3}` };
    return { ok: true, id: v.id, at: v.at, profile: v.profile, seq: 1, sha3: sha, authorized_by: 'genesis signers', genesis_pin: 'matched' };
  } catch (e) { return { ok: false, why: e.message }; }
}

// ── envelope (contract §3) ───────────────────────────────────────────────
const HINTS = ['ant', 'ar', 'hive', 'peers'];
const PEER_RE = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[\x21-\x7e]*)?$/;
export function checkHints(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) throw new Error('envelope.hints must be an object');
  fields(h, Object.keys(h).filter(k => HINTS.includes(k)), 'envelope.hints');
  if (h.ant !== undefined && (typeof h.ant !== 'string' || !/^[A-Za-z0-9:._-]{1,256}$/.test(h.ant))) throw new Error('hints.ant is not an address');
  if (h.ar !== undefined) {
    if (!Array.isArray(h.ar) || !h.ar.length) throw new Error('hints.ar must be a non-empty list');
    for (const t of h.ar) if (typeof t !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(t)) throw new Error(`hints.ar ${t} is not an Arweave transaction id`);
  }
  if (h.hive !== undefined) {
    fields(h.hive, ['block', 'trx'], 'envelope.hints.hive');
    if (!Number.isSafeInteger(h.hive.block) || h.hive.block < 1 || typeof h.hive.trx !== 'string' || !/^[0-9a-f]{40}$/.test(h.hive.trx)) throw new Error('hints.hive must be {block, trx}: a block number and a 40-hex transaction id');
  }
  if (h.peers !== undefined) {
    if (!Array.isArray(h.peers) || !h.peers.length) throw new Error('hints.peers must be a non-empty list');
    for (const p of h.peers) if (typeof p !== 'string' || !PEER_RE.test(p)) throw new Error(`hints.peers ${p} is not an https URL`);
  }
  return h;
}

// vk: the verifying key of a bheart.signature/1 (bytes or base64url), carried as envelope.vk;
// refused with a §3b signature.
export function envelope(recordBytes, sigBytes, hints = {}, vk) {
  checkIdentity(parseRecord(recordBytes));
  const sig = readSig(sigBytes);
  const v = verifySig(sig, recordBytes, vk);
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
    for (const p of hints.peers) if (!PEER_RE.test(p)) throw new Error(`--hint-peer ${p} is not an https URL`);
    h.peers = hints.peers;
  }
  const e = { bnr: ENVELOPE, hints: checkHints(h), record: b64u(recordBytes), sig };
  if (vk !== undefined) e.vk = b64u(vkBytes(vk));
  const bytes = Buffer.from(canon(e), 'latin1');
  if (bytes.length > ENVELOPE_MAX) throw new Error(`the envelope is ${bytes.length} bytes, over the 64 KiB limit`);
  return bytes;
}

// The strict envelope reader: the canonical bytes envelope() writes, and nothing else. It returns
// the record bytes, the signature in its one byte form and the verifying key (vk, bytes; only with
// a bheart.signature/1, where it is required), so an envelope and a record.json beside its
// record.json.relsig.json are the same evidence. It verifies nothing; verifyRelease does.
export function openEnvelope(bytes) {
  const b = Buffer.from(bytes);
  if (b.length > ENVELOPE_MAX) throw new Error(`the envelope is ${b.length} bytes, over the 64 KiB limit`);
  let e;
  try { e = parseStrict(b); } catch (err) { throw new Error(`the envelope is not canonical JSON: ${err.message}`); }
  const hasVk = !!e && typeof e === 'object' && Object.hasOwn(e, 'vk');
  fields(e, ['bnr', 'hints', 'record', 'sig', ...(hasVk ? ['vk'] : [])], 'envelope');
  if (e.bnr !== ENVELOPE) throw new Error(`envelope.bnr is not ${ENVELOPE}`);
  if (isBheart(e.sig) !== hasVk) throw new Error(hasVk ? 'envelope.vk is forbidden with a SPEC-BPQ-1 §3b signature' : 'envelope.vk is required with a bheart.signature/1');
  let vk;
  if (hasVk) { try { vk = vkBytes(e.vk); } catch (err) { throw new Error(`envelope.${err.message}`); } }
  checkHints(e.hints);
  if (typeof e.record !== 'string' || !/^[A-Za-z0-9_-]+$/.test(e.record)) throw new Error('envelope.record is not base64url');
  const recordBytes = Buffer.from(e.record, 'base64url');
  if (b64u(recordBytes) !== e.record) throw new Error('envelope.record is not canonical base64url');
  return { recordBytes, sigBytes: sigBytesOf(e.sig), hints: e.hints, vk };
}

// ── committed releases (contract §7 A2) ──────────────────────────────────
// DIR/keychain/releases/<seq>/ holds record.json, record.json.relsig.json and envelope.json, and
// nothing else; <seq> is the record's own seq in plain decimal, and the seqs are 1..N with no gap.
// keychain/releases holds nothing but those directories. build-keychain.mjs copies an explicit file
// list, so nothing here reaches the site.
export const PLACED = ['envelope.json', 'record.json', 'record.json.relsig.json'];
// The one reader of that layout, for place and for probe.mjs, so the two agree on it. It checks the
// layout and the strict record (its seq is its directory's name); the caller verifies signatures and
// the chain, then checkPlacedEnvelope. A .place-<seq>-* directory is a place that wrote its files and
// never renamed them into place (it crashed between the two): nothing in it is placed, and it is
// refused, never read as the top of the chain.
export function readPlaced(releases) {
  if (!existsSync(releases)) return [];
  const out = [];
  for (const e of readdirSync(releases, { withFileTypes: true })) {
    const where = `keychain/releases/${e.name}`;
    if (e.name.startsWith('.place-')) throw new Error(`${where} is an unfinished place (its files were written and never renamed into place): nothing in it is placed; remove it`);
    if (!e.isDirectory() || !/^[1-9][0-9]*$/.test(e.name)) throw new Error(`${where}: keychain/releases holds only <seq>/ directories, named by the record's seq in plain decimal (contract §7 A2)`);
    const at = join(releases, e.name), held = walk(at);
    if (held.join('\n') !== PLACED.join('\n')) throw new Error(`${where} holds [${held}], not [${PLACED}]`);
    const p = { seq: Number(e.name), where, recordBytes: readFileSync(join(at, 'record.json')), sigBytes: readFileSync(join(at, 'record.json.relsig.json')), envelopeBytes: readFileSync(join(at, 'envelope.json')) };
    let r;
    try { r = parseRecord(p.recordBytes); } catch (err) { throw new Error(`${where}/record.json: ${err.message}`); }
    if (r.seq !== p.seq) throw new Error(`${where}/record.json is seq ${r.seq}: a placed record lives at keychain/releases/<its seq>/`);
    out.push(p);
  }
  out.sort((a, b) => a.seq - b.seq);
  out.forEach((p, i) => { if (p.seq !== i + 1) throw new Error(`keychain/releases/${i + 1} is not placed and ${p.where} is: placed releases are seq 1..N with no gap`); });
  return out;
}
// A placed envelope.json is the same evidence as the record.json and record.json.relsig.json beside
// it, byte for byte: an envelope that carries another record or signature is refused. Returns the
// opened envelope (its vk is the only place a bheart release's verifying key is kept).
export function checkPlacedEnvelope({ where, recordBytes, sigBytes, envelopeBytes }) {
  let e;
  try { e = openEnvelope(envelopeBytes); } catch (err) { throw new Error(`${where}/envelope.json: ${err.message}`); }
  if (!e.recordBytes.equals(recordBytes)) throw new Error(`${where}/envelope.json carries another record than ${where}/record.json`);
  if (!e.sigBytes.equals(sigBytes)) throw new Error(`${where}/envelope.json carries another signature than ${where}/record.json.relsig.json`);
  return e;
}
// The vk a placed envelope carries, read before the chain is verified (a broken envelope gives none,
// and checkPlacedEnvelope then names what is wrong with it).
export const placedVk = p => { try { return openEnvelope(p.envelopeBytes).vk; } catch { return undefined; } };

export function place({ dir, recordBytes, sigBytes, envelopeBytes, vk, signers, genesisSha3, law = lawIds() }) {
  if (!signers || !signers.length) throw new Error('--signers is required: the genesis signers rule 3 starts the chain from');
  if (!isDigest(genesisSha3)) throw new Error('--genesis-sha3 is required: the pinned SHA3-256 (base64url) of the seq 1 record');
  const r = checkIdentity(parseRecord(recordBytes));
  const releases = join(dir, 'keychain', 'releases');
  // Rule 3, from the genesis pin: everything already placed verifies, in order, each envelope.json
  // included, in A2's layout and nothing else; then this record, as the next one or as the one placed
  // at its seq.
  const placed = readPlaced(releases);
  let prevBytes;
  for (const p of placed) {
    const v = verifyRelease({ recordBytes: p.recordBytes, sigBytes: p.sigBytes, vk: placedVk(p), signers: p.seq === 1 ? signers : undefined, genesisSha3: p.seq === 1 ? genesisSha3 : undefined, prevBytes, law });
    if (!v.ok) throw new Error(`${p.where} does not verify: ${v.why}`);
    checkPlacedEnvelope(p);
    prevBytes = p.recordBytes;
  }
  if (r.seq > placed.length + 1) throw new Error(`keychain/releases/${placed.length + 1} is not placed: seq ${r.seq} is accepted only after every record before it`);
  // a bheart release's verifying key: --vk, or the given envelope's vk (the same key when both are given)
  const given = envelopeBytes ? openEnvelope(envelopeBytes) : null;
  if (vk !== undefined) vk = vkBytes(vk);
  if (given && vk !== undefined && !(given.vk && given.vk.equals(vk))) throw new Error('--vk is not the vk --envelope carries');
  if (given) vk = given.vk;
  const v = verifyRelease({ recordBytes, sigBytes, vk, signers: r.seq === 1 ? signers : undefined, genesisSha3: r.seq === 1 ? genesisSha3 : undefined, prevBytes: r.seq === 1 ? undefined : placed[r.seq - 2].recordBytes, law });
  if (!v.ok) throw new Error(`the record does not verify: ${v.why}`);
  let env;
  if (given) {
    if (!given.recordBytes.equals(recordBytes)) throw new Error('--envelope carries another record');
    if (!given.sigBytes.equals(sigBytes)) throw new Error('--envelope carries another signature');
    env = Buffer.from(envelopeBytes);
  } else env = envelope(recordBytes, sigBytes, {}, vk);
  const want = { 'envelope.json': env, 'record.json': Buffer.from(recordBytes), 'record.json.relsig.json': Buffer.from(sigBytes) };
  const target = join(releases, String(r.seq)), out = { placed: target, seq: r.seq, sha3: b64u(sha3(recordBytes)) };
  if (r.seq <= placed.length) {
    const p = placed[r.seq - 1], held = { 'envelope.json': p.envelopeBytes, 'record.json': p.recordBytes, 'record.json.relsig.json': p.sigBytes };
    if (PLACED.some(f => !held[f].equals(want[f]))) throw new Error(`keychain/releases/${r.seq} exists with different bytes; a placed release is never rewritten`);
    return { ...out, unchanged: true };
  }
  mkdirSync(releases, { recursive: true });
  const tmp = mkdtempSync(join(releases, `.place-${r.seq}-`));
  try {
    for (const f of PLACED) writeFileSync(join(tmp, f), want[f]);
    renameSync(tmp, target);
  } catch (e) { rmSync(tmp, { recursive: true, force: true }); throw e; }
  return { ...out, unchanged: false, files: PLACED };
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
  'sign-test': [{ value: ['record', 'out', 'seed', 'profile', 'vk-out'], flag: ['i-understand-this-is-a-test-key'] }, o => {
    if (!o['i-understand-this-is-a-test-key']) throw new Error('sign-test signs with a THROWAWAY key that authorizes nothing; pass --i-understand-this-is-a-test-key');
    if (o.out && !o.record) throw new Error('--out needs --record');
    const profile = o.profile ?? 'bpq';
    if (profile !== 'bpq' && profile !== 'bheart') throw new Error('--profile is bpq (SPEC-BPQ-1 §3b) or bheart (bheart.signature/1)');
    if (profile === 'bpq' && o['vk-out']) throw new Error('--vk-out is for --profile bheart: a §3b signature carries its own key');
    const k = profile === 'bheart' ? testBheartKey(o.seed) : testKeys(o.seed);
    try {
      const vk = profile === 'bheart' ? { key_id: k.key_id, vk_out: o['vk-out'] ?? null } : {};
      if (profile === 'bheart' && o['vk-out']) writeFileSync(o['vk-out'], b64u(k.vk));
      if (!o.record) return { test_key: true, profile, id: k.id, ...vk, sig: null };
      const bytes = readFileSync(o.record);
      checkIdentity(parseRecord(bytes));
      const d = profile === 'bheart' ? k.sign(bytes) : BPQ.signFile(k, new Uint8Array(bytes), new Date().toISOString());
      const sigBytes = sigBytesOf(d);   // the one byte form: canonical, no trailing newline
      writeFileSync(need(o, 'out'), sigBytes);
      return { test_key: true, profile, id: k.id, ...vk, sig: o.out, record_sha3: b64u(sha3(bytes)), sig_sha3: b64u(sha3(sigBytes)) };
    } finally { k.wipe(); }
  }],
  'import-sig': [{ value: ['sig', 'out'] }, o => {
    // as its signer wrote it: bsigner sign pretty-prints. Read as JSON, held to its exact field set,
    // written in the one byte form. Nothing is verified here; envelope/verify/place verify.
    const text = readFileSync(need(o, 'sig'), 'utf8');
    let d;
    try { d = JSON.parse(text); } catch { throw new Error(`${o.sig} is not JSON`); }
    const sigBytes = sigBytesOf(d);
    writeFileSync(need(o, 'out'), sigBytes);
    return { sig: o.out, profile: isBheart(d) ? BHEART_TYPE : 'bpq1/detached', sig_sha3: b64u(sha3(sigBytes)) };
  }],
  envelope: [{ value: ['record', 'sig', 'vk', 'hint-ant', 'hint-hive', 'out'], list: ['hint-ar', 'hint-peer'] }, o => {
    const bytes = envelope(readFileSync(need(o, 'record')), readFileSync(need(o, 'sig')), { ant: o['hint-ant'], ar: o['hint-ar'], hive: o['hint-hive'], peers: o['hint-peer'] }, o.vk === undefined ? undefined : readVk(o.vk));
    if (!o.out) { process.stdout.write(bytes + '\n'); return undefined; }
    writeFileSync(o.out, bytes);
    return { envelope: o.out, size: bytes.length };
  }],
  verify: [{ value: ['record', 'sig', 'vk', 'signers', 'prev', 'genesis-sha3'], flag: ['no-genesis-pin'] }, o => {
    const r = verifyRelease({
      recordBytes: readFileSync(need(o, 'record')), sigBytes: readFileSync(need(o, 'sig')), vk: o.vk === undefined ? undefined : readVk(o.vk),
      signers: o.signers ? list(o.signers) : undefined, prevBytes: o.prev ? readFileSync(o.prev) : undefined,
      genesisSha3: o['genesis-sha3'], noGenesisPin: !!o['no-genesis-pin']
    });
    // exit 0 only for ok:true, a verdict on the chain; 1 for a refusal; 3 when --no-genesis-pin found
    // the signature and the genesis signer good, which is no verdict on the chain: a gate that reads
    // the exit status (`verify ... && next`) never takes a signature-only check for a pass
    process.exitCode = r.ok ? 0 : o['no-genesis-pin'] && r.signature_ok ? 3 : 1;
    console.log(JSON.stringify(r));
    return undefined;
  }],
  place: [{ value: ['dir', 'record', 'sig', 'envelope', 'vk', 'signers', 'genesis-sha3'] }, o => place({
    dir: need(o, 'dir'), recordBytes: readFileSync(need(o, 'record')), sigBytes: readFileSync(need(o, 'sig')),
    envelopeBytes: o.envelope ? readFileSync(o.envelope) : undefined, vk: o.vk === undefined ? undefined : readVk(o.vk),
    signers: list(need(o, 'signers')), genesisSha3: need(o, 'genesis-sha3')
  })]
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
  await cli(COMMANDS, process.argv.slice(2), 'usage: release.mjs prepare|check|sign-test|import-sig|envelope|verify|place (see the header of tools/keychain-release/release.mjs)');
}
