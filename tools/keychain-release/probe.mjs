// probe.mjs — the independent prober for the keychain edge at keys.skaists.dev, and the only
// source allowed to call that edge green. An edge is never its own witness: every expectation
// here comes from the repository (committed release records verified back to the pinned signers,
// or the build at this checkout) and every observation from the wire or a foreign oracle (crt.sh,
// two public DoH resolvers). Read-only: GETs, one OPTIONS per address, TLS handshakes. No key, no
// secret, no payment.
//
//   node tools/keychain-release/probe.mjs [--vantage LABEL] [--out FILE] [--tls auto|docker|local]
//       writes a bnr.keychain-edge-receipt/1 (default keychain-edge-receipt.json) and exits 0 once
//       it is written, whatever the verdicts; a crash writes nothing
//   node tools/keychain-release/probe.mjs summary FILE
//       prints the receipt as a markdown table and exits 0 only when it is green: every check PASS
//       and none missing. Any FAIL exits 1; anything NOT MEASURED or missing exits 2. An edge that
//       did not answer is not an edge that passed.
//
// The edge is every A and AAAA address the two resolvers give, each probed on its own: TLS
// handshakes to the address, and HTTPS from a client pinned to it (SNI and certificate checked for
// keys.skaists.dev). A vantage without an IPv6 route leaves AAAA addresses NOT MEASURED, so it
// cannot produce a green run while the name has AAAA records.
//
// The expectation:
//   keychain/releases/<seq>/ (contract §7 A2): every committed record, in the layout place writes and
//   read by the same reader (release.mjs readPlaced: only <seq>/ directories named by their record's
//   seq, seq 1..N with no gap, each holding exactly record.json, record.json.relsig.json and
//   envelope.json; an unfinished place, .place-*, refuses). Each record strict (contract §1,
//   release.mjs's reader: one strict reader for the tools and the probe; the edge, ops/keys-door,
//   reads with its own), each prev naming the record before, each SPEC-BPQ-1 §3b signature in its one
//   byte form (canonical JSON, no trailing newline) and valid (surfaces/bpq.js) by a signer pinned in
//   docs/KEYCHAIN-RELEASE-SIGNERS.json at seq 1 and by an id the previous record names after it, and
//   each envelope.json carrying exactly that record and signature.
//   The highest is the expectation; any defect is NOT MEASURED, never a fallback to the build.
//   With none committed: `node scripts/build-keychain.mjs --out` on this checkout (CNAME and
//   .nojekyll left out, as a record leaves them out), only when every build input is byte for byte
//   its blob at HEAD.
//
// Checks, each PASS | FAIL | NOT MEASURED with its evidence:
//   dns           A/AAAA/CNAME/CAA from dns.google and cloudflare-dns.com; a disagreement is FAIL.
//   tls ADDR      OpenSSL >= 3.5: --tls docker runs alpine:3.22 (openssl 3.5.9-r0,
//                 pkgs.alpinelinux.org/package/v3.22/main/x86_64/openssl), --tls local the openssl on
//                 PATH; auto picks docker when it answers. Trust is Node's bundled root store passed
//                 as -CAfile, no other store. The control (-tls1_3 -groups X25519MLKEM768) must
//                 complete on that group, else NOT MEASURED (a broken probe is not evidence), and its
//                 certificate must verify for keys.skaists.dev, else FAIL. Then every other TLS 1.3
//                 group (OTHER_GROUPS, plus any `openssl list -tls1_3 -tls-groups` adds) and TLS 1.2,
//                 1.1 and 1.0 with every cipher at security level 0: any accepted is FAIL; PASS only
//                 when each is refused by a TLS alert from the server. A close without an alert is not
//                 a refusal: a local middlebox produces the same.
//   bytes ADDR    "/" and every file the expectation names: HTTP 200, sha256, sha3, size.
//   serving ADDR  contract §4: Content-Type from the allowlist, nosniff, Cache-Control no-cache,
//                 ETag "<sha256>", OPTIONS answered 405, an unknown path 404, and
//                 /.well-known/bnr-keychain/pack as the expected pack.
//   well-known ADDR  /.well-known/bnr-keychain/release: PASS only for an envelope (contract §3) whose
//                 record reads strictly for this origin, whose signature verifies here by an id the
//                 repository authorizes for that seq, and whose files and pack are the expectation.
//                 Absent is NOT MEASURED while both resolvers name GitHub Pages (its published
//                 addresses, any CNAME a *.github.io host) and FAIL when they name anything else.
//   ct            crt.sh lists each served certificate that verified, matched by serial AND issuer
//                 (not listed yet is NOT MEASURED: crt.sh ingests with a delay). Issuers outside
//                 KNOWN_ISSUERS and more than one certificate valid now are noted, never fatal.
//                 Wildcard *.skaists.dev certificates are not queried.
//
// Digests in the receipt are base64url (the secret scan blocks hex runs of 48+ characters).
import {readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createHash, X509Certificate, randomBytes} from 'node:crypto';
import {execFile, execFileSync, spawnSync} from 'node:child_process';
import {request} from 'node:https';
import {rootCertificates} from 'node:tls';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {BPQ as RELEASE_BPQ, canon as releaseCanon, checkIdentity, checkPlacedEnvelope, checkSig, isId as releaseIsId, parseRecord, readPlaced, readSig} from './release.mjs';

export const SCHEMA = 'bnr.keychain-edge-receipt/1';
export const ORIGIN = 'https://keys.skaists.dev';
export const HOST = 'keys.skaists.dev';
export const IMAGE = 'alpine:3.22';
export const CONTROL = ['-tls1_3', '-groups', 'X25519MLKEM768'];
// Every TLS 1.3 group OpenSSL 3.5 offers besides X25519MLKEM768 (`openssl list -tls1_3 -tls-groups`,
// 3.5.7 and 3.5.5), then every version below 1.3 with every cipher. The contract allows none of them.
export const OTHER_GROUPS = ['secp256r1', 'secp384r1', 'secp521r1', 'x25519', 'x448', 'brainpoolP256r1tls13',
  'brainpoolP384r1tls13', 'brainpoolP512r1tls13', 'ffdhe2048', 'ffdhe3072', 'ffdhe4096', 'ffdhe6144', 'ffdhe8192',
  'MLKEM512', 'MLKEM768', 'MLKEM1024', 'SecP256r1MLKEM768', 'SecP384r1MLKEM1024'];
export const LEGACY = ['-tls1_2', '-tls1_1', '-tls1'].map(v => [v, '-cipher', 'ALL:@SECLEVEL=0']);
// GitHub Pages certificates come from Let's Encrypt; Caddy's default issuers are Let's Encrypt, then ZeroSSL.
export const KNOWN_ISSUERS = ["Let's Encrypt", 'ZeroSSL'];
// GitHub's published Pages addresses (docs.github.com, "Managing a custom domain for your GitHub Pages site").
export const PAGES = {A: ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'],
  AAAA: ['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153']};
// Contract §4: the only Content-Types an edge sends.
export const CONTENT_TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css; charset=utf-8'};
export const TYPES = ['A', 'AAAA', 'CNAME', 'CAA'];
const RESOLVERS = {'dns.google': 'https://dns.google/resolve', 'cloudflare-dns.com': 'https://cloudflare-dns.com/dns-query'};
const RRTYPE = {1: 'A', 28: 'AAAA', 5: 'CNAME', 257: 'CAA'};
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// What scripts/build-keychain.mjs reads (:13-14): itself, keychain/ and the vendored onboarding sources.
const INPUTS = ['scripts/build-keychain.mjs', 'keychain', 'surfaces/onboarding'];

// The post-quantum verifier (surfaces/bpq.js), loaded by release.mjs as scripts/verify-bpq-signatures.mjs loads it.
export const BPQ = RELEASE_BPQ;

const b64u = buf => Buffer.from(buf).toString('base64url');
const hash = (alg, bytes) => b64u(createHash(alg).update(bytes).digest());
const bytewise = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const check = (name, verdict, evidence) => ({name, verdict, evidence});
export const digests = bytes => ({sha256: hash('sha256', bytes), sha3: hash('sha3-256', bytes), size: bytes.length});

// ---- release records, read with release.mjs's strict reader ----

export const isId = releaseIsId;
// Contract §1 canonical JSON: printable ASCII, keys sorted bytewise, integers only, no whitespace.
export const canon = releaseCanon;

const exactly = (o, keys, where) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error(`${where} is not an object`);
  const got = Object.keys(o).sort(bytewise).join(','), want = [...keys].sort(bytewise).join(',');
  if (got !== want) throw new Error(`${where} has fields [${got}], the contract names [${want}]`);
  return o;
};

// A record whose bytes are exactly the canonical form of their own parse (no whitespace, escapes,
// floats, duplicate or unsorted keys), with every field the contract names and no other, for this
// origin and RP ID.
export const readRecord = bytes => checkIdentity(parseRecord(bytes), {origin: ORIGIN, rp_id: HOST});

// A SPEC-BPQ-1 §3b detached signature over exactly these bytes → its signer id; anything else throws.
export function signerOf(sig, bytes) {
  checkSig(sig);
  const v = BPQ.verifyFile(sig, new Uint8Array(bytes));
  if (!v.ok) throw new Error(`signature: ${v.why}`);
  return v.id;
}

// The repository's release signer pins, and the law ids, which are never a release authority.
export function authority(root) {
  const signers = p => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), 'utf8')).signers ?? [] : []);
  return {pins: signers('docs/KEYCHAIN-RELEASE-SIGNERS.json').map(s => (typeof s === 'string' ? s : s?.id)),
    law: signers('docs/PQ-SIGNERS.json').map(s => s?.id)};
}

// Contract §4 rule 3: the pinned signers authorize seq 1 only; seq N > 1 an id the record before names.
const authorized = (seq, id, auth, before) => !auth.law.includes(id) && (seq === 1 ? auth.pins : before?.signers ?? []).includes(id);

// ---- the expectation, from the repository only ----

// releases: keychain/releases. The layout is read by release.mjs's readPlaced, the reader place
// writes for: only <seq>/ directories named by their record's seq, seq 1..N with no gap, each holding
// exactly record.json, record.json.relsig.json and envelope.json; an unfinished place (.place-*) or
// anything else there refuses the whole expectation rather than being read as part of the chain.
export function expectedFromRecords(releases, auth) {
  const placed = readPlaced(releases);
  if (!placed.length) return null;
  const found = placed.map(p => {
    const where = `${p.where}/record.json`;
    let r, id;
    try { r = readRecord(p.recordBytes); id = signerOf(readSig(p.sigBytes), p.recordBytes); } catch (e) { throw new Error(`${where}: ${e.message}`); }
    checkPlacedEnvelope(p);   // its messages name keychain/releases/<seq>/envelope.json
    return {r, where, id, sha3: hash('sha3-256', p.recordBytes)};
  });
  found.forEach((f, n) => {
    if (n && f.r.prev !== found[n - 1].sha3) throw new Error(`${f.where}: prev does not name the committed seq ${n}`);
    if (!authorized(f.r.seq, f.id, auth, found[n - 1]?.r)) throw new Error(`${f.where}: signed by ${f.id}, not an id the repository authorizes for seq ${f.r.seq}`);
  });
  const top = found.at(-1);
  return {source: `record seq ${top.r.seq} (${top.where})`, seq: top.r.seq, recordSha3: top.sha3,
    chain: found.map(f => ({seq: f.r.seq, sha3: f.sha3, signers: f.r.signers})), files: top.r.files, pack: top.r.pack};
}

// The build inputs at `rev` whose working-tree bytes are not their blob (raw bytes, no eol filter),
// or that are missing.
export function inputsChanged(root, rev = 'HEAD') {
  const git = (args, input) => execFileSync('git', args, {cwd: root, encoding: 'utf8', input, maxBuffer: 64 << 20});
  const tree = git(['ls-tree', '-r', '-z', rev, '--', ...INPUTS]).split('\0').filter(Boolean)
    .map(l => { const t = l.indexOf('\t'); return {oid: l.slice(0, t).split(' ')[2], path: l.slice(t + 1)}; });
  if (!tree.length) return [`no build input at ${rev}`];
  const here = tree.filter(e => existsSync(join(root, e.path)));
  const oids = here.length ? git(['hash-object', '--no-filters', '--stdin-paths'], here.map(e => e.path).join('\n') + '\n').split('\n') : [];
  return [...tree.filter(e => !here.includes(e)).map(e => e.path), ...here.filter((e, i) => oids[i] !== e.oid).map(e => e.path)];
}

// The site exactly as a release builds it (contract §1: source.build), from this checkout at HEAD.
export function expectedFromBuild(root) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  const changed = inputsChanged(root);
  if (changed.length) throw new Error(`build inputs in the working tree are not their bytes at ${commit}: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ', …' : ''}`);
  const out = mkdtempSync(join(tmpdir(), 'kc-probe-'));
  try {
    execFileSync(process.execPath, ['scripts/build-keychain.mjs', '--out', out], {cwd: root, stdio: ['ignore', 'ignore', 'inherit']});
    const site = readdirSync(out, {recursive: true}).map(p => relative(out, join(out, p)).split('\\').join('/'))
      .filter(p => statSync(join(out, p)).isFile() && p !== 'CNAME' && p !== '.nojekyll').sort(bytewise)
      .map(p => ({path: p, bytes: readFileSync(join(out, p))}));
    return {source: `node scripts/build-keychain.mjs --out at ${commit}`, files: site.map(f => ({path: f.path, ...digests(f.bytes)})),
      pack: digests(Buffer.concat(site.map(f => f.bytes)))};
  } finally { rmSync(out, {recursive: true, force: true}); }
}

// ---- verdicts (pure; probe.test.mjs drives them from fixtures) ----

// One check from its parts: FAIL if any part is, PASS only when every part is, else NOT MEASURED.
export function rollup(name, parts, evidence = {}) {
  const verdict = parts.some(p => p.verdict === 'FAIL') ? 'FAIL' : parts.length && parts.every(p => p.verdict === 'PASS') ? 'PASS' : 'NOT MEASURED';
  const off = parts.filter(p => p.verdict !== 'PASS').map(p => `${p.name}: ${p.evidence.brief}`).join('; ');
  const brief = !parts.length ? 'nothing to judge' : off ? (off.length > 600 ? off.slice(0, 600) + '…' : off) : `${parts.length} of ${parts.length} PASS`;
  return check(name, verdict, {...evidence, parts, brief});
}

export function bytesCheck(name, want, got) {
  const ev = {url: got.url, want: {sha256: want.sha256, sha3: want.sha3, size: want.size}};
  if (got.error) return check(name, 'NOT MEASURED', {...ev, error: got.error, brief: `no answer: ${got.error}`});
  ev.status = got.status;
  if (got.status !== 200) return check(name, 'FAIL', {...ev, brief: `HTTP ${got.status}`});
  ev.got = digests(got.bytes);
  const differ = ['sha256', 'sha3', 'size'].filter(k => ev.want[k] !== undefined && ev.want[k] !== ev.got[k]);
  if (differ.length) return check(name, 'FAIL', {...ev, brief: `${differ.join(', ')} differ: want sha256 ${want.sha256}, got ${ev.got.sha256}`});
  return check(name, 'PASS', {...ev, brief: `sha256 ${ev.got.sha256}, ${ev.got.size} B`});
}

const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, '');

// Contract §4 headers on a 200 answer for a file the expectation names ("/" stands for index.html).
export function headersCheck(name, want, got) {
  if (got.error) return check(name, 'NOT MEASURED', {url: got.url, error: got.error, brief: `no answer: ${got.error}`});
  if (got.status !== 200) return check(name, 'NOT MEASURED', {url: got.url, status: got.status, brief: `HTTP ${got.status}, judged under bytes`});
  const h = got.headers ?? {}, type = CONTENT_TYPES[/\.[^./]+$/.exec(want.path)?.[0]];
  const wrong = [
    !type ? `${want.path} has no Content-Type in the allowlist` : norm(h['content-type']) !== norm(type) && `content-type ${h['content-type'] ?? 'absent'} (want ${type})`,
    norm(h['x-content-type-options']) !== 'nosniff' && `x-content-type-options ${h['x-content-type-options'] ?? 'absent'} (want nosniff)`,
    norm(h['cache-control']) !== 'no-cache' && `cache-control ${h['cache-control'] ?? 'absent'} (want no-cache)`,
    (h.etag ?? '').trim() !== `"${want.sha256}"` && `etag ${h.etag ?? 'absent'} (want "${want.sha256}")`,
  ].filter(Boolean);
  const ev = {url: got.url, headers: h};
  return wrong.length ? check(name, 'FAIL', {...ev, brief: wrong.join(', ')}) : check(name, 'PASS', {...ev, brief: 'contract §4 headers'});
}

export function statusCheck(name, got, want) {
  if (got.error) return check(name, 'NOT MEASURED', {url: got.url, error: got.error, brief: `no answer: ${got.error}`});
  return check(name, got.status === want ? 'PASS' : 'FAIL', {url: got.url, status: got.status, brief: `HTTP ${got.status} (want ${want})`});
}

export function packCheck(name, want, got) {
  if (got.error) return check(name, 'NOT MEASURED', {url: got.url, error: got.error, brief: `no answer: ${got.error}`});
  const ev = {url: got.url, status: got.status, want};
  if (got.status !== 200) return check(name, 'FAIL', {...ev, brief: `HTTP ${got.status}`});
  ev.got = digests(got.bytes);
  const type = got.headers?.['content-type'] ?? null;
  if (norm(type) !== 'application/octet-stream') return check(name, 'FAIL', {...ev, brief: `content-type ${type ?? 'absent'} (want application/octet-stream)`});
  const differ = ['sha256', 'sha3', 'size'].filter(k => want?.[k] !== ev.got[k]);
  if (differ.length) return check(name, 'FAIL', {...ev, brief: `${differ.join(', ')} differ: want sha256 ${want?.sha256}, got ${ev.got.sha256}`});
  return check(name, 'PASS', {...ev, brief: `the expected pack, ${ev.got.size} B`});
}

export function opensslVersion(text) {
  const m = /OpenSSL (\d+)\.(\d+)\.(\d+)/.exec(String(text));
  return m ? {text: m[0], ok: Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 5)} : {text: String(text).trim().slice(0, 80) || 'unknown', ok: false};
}

// The offers besides the control: OTHER_GROUPS, any further TLS 1.3 group the probing OpenSSL lists,
// then LEGACY. X25519MLKEM768 is never among them.
export function otherProbes(listed = []) {
  const seen = new Set(['x25519mlkem768']), groups = [];
  for (const g of [...OTHER_GROUPS, ...listed]) if (/^[A-Za-z0-9_-]+$/.test(g) && !seen.has(g.toLowerCase())) { seen.add(g.toLowerCase()); groups.push(g); }
  return [...groups.map(g => ['-tls1_3', '-groups', g]), ...LEGACY];
}
const REQUIRED_OFFERS = otherProbes().map(a => a.join(' '));

// "Peer Temp Key: X25519, 253 bits" names the group first; "Peer Temp Key: ECDH, prime256v1, 256 bits" second.
const tempKey = out => {
  const p = /(?:Peer|Server) Temp Key: ([^\r\n]+)/.exec(out)?.[1].split(',').map(s => s.trim());
  return !p ? null : p[0] === 'ECDH' && p[1] ? p[1] : p[0];
};

// One s_client run → accepted | refused (a TLS alert arrived) | closed (no alert) | error.
// "New, X, Cipher is" names the version that defined the cipher (SSLv3, TLSv1.0 …), not the one
// negotiated; the "Protocol" line names that.
export function classify({code = null, stdout = '', stderr = '', timedOut = false}) {
  const out = String(stdout), err = String(stderr);
  if (timedOut) return {outcome: 'error', detail: 'timeout'};
  const done = /New, (\S+), Cipher is (?!\(NONE\))(\S+)/.exec(out);
  if (done) return {
    outcome: 'accepted', protocol: /(?:^|\n)\s*Protocol\s*: (\S+)/.exec(out)?.[1] ?? done[1], cipher: done[2],
    group: /Negotiated TLS1\.3 group: (\S+)/.exec(out)?.[1] ?? tempKey(out),
    verify: /Verify return code: ([^\r\n]+)/.exec(out)?.[1].trim() ?? null,
    pem: /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.exec(out)?.[0] ?? null,
  };
  const alert = /SSL alert number (\d+)/.exec(err);
  if (alert) return {outcome: 'refused', alert: Number(alert[1]), detail: /alert ([a-z][a-z ]*[a-z])/i.exec(err)?.[1] ?? null};
  if (/CONNECTED\(/.test(out) && /unexpected eof|connection reset|errno=104/i.test(err)) return {outcome: 'closed', detail: 'closed without a TLS alert'};
  const line = err.split('\n').map(s => s.trim()).find(s => /errno|error|failed/i.test(s)) ?? `exit ${code}`;
  return {outcome: 'error', detail: line.slice(0, 160)};
}

export function certFacts(pem) {
  const c = new X509Certificate(pem), k = c.publicKey, d = k.asymmetricKeyDetails ?? {};
  const key = k.asymmetricKeyType === 'rsa' ? `RSA ${d.modulusLength}` : k.asymmetricKeyType === 'ec' ? `EC ${d.namedCurve}` : k.asymmetricKeyType;
  return {key, issuer: c.issuer.split('\n').join(', '), notAfter: (c.validToDate ?? new Date(c.validTo)).toISOString(),
    serial: c.serialNumber.toLowerCase().replace(/^0+(?=.)/, ''), sha256: hash('sha256', c.raw)};
}

const lean = ({pem, ...rest}) => rest;
const said = p => p.outcome === 'accepted' ? `${p.protocol} ${p.group}` : p.outcome === 'refused' ? `alert ${p.alert}` : `${p.outcome} (${p.detail})`;
const shown = ps => ps.map(p => `${p.args.join(' ')} → ${said(p)}`).join('; ');

export function tlsCheck(family, address, {via, openssl, trust, control, others}) {
  const name = `tls ${family} ${address}`;
  const ev = {via, openssl: openssl.text, trust, control: lean(control), others: others.map(lean)};
  const pem = control.pem ?? others.find(p => p.pem)?.pem;
  if (pem) try { ev.certificate = certFacts(pem); } catch (e) { ev.certificate = {error: e.message}; }
  if (!openssl.ok) return check(name, 'NOT MEASURED', {...ev, brief: `${openssl.text} cannot offer X25519MLKEM768 (needs OpenSSL >= 3.5)`});
  if (control.outcome !== 'accepted' || control.group !== 'X25519MLKEM768')
    return check(name, 'NOT MEASURED', {...ev, brief: `control did not complete on X25519MLKEM768: ${said(control)}`});
  ev.verified = control.verify === '0 (ok)';
  const taken = others.filter(p => p.outcome === 'accepted');
  if (taken.length) return check(name, 'FAIL', {...ev, brief: `not X25519MLKEM768 only, accepted: ${shown(taken)}`});
  if (control.verify === null) return check(name, 'NOT MEASURED', {...ev, brief: 'the control printed no certificate verification result'});
  if (!ev.verified) return check(name, 'FAIL', {...ev, brief: `the certificate does not verify for ${HOST} against ${trust}: ${control.verify}`});
  const offered = new Set(others.map(p => p.args.join(' '))), unasked = REQUIRED_OFFERS.filter(a => !offered.has(a));
  if (unasked.length) return check(name, 'NOT MEASURED', {...ev, brief: `not offered, so not measured: ${unasked.join('; ')}`});
  const open = others.filter(p => p.outcome !== 'refused');
  if (open.length) return check(name, 'NOT MEASURED', {...ev, brief: `control ok, not refused on the wire: ${shown(open)}`});
  return check(name, 'PASS', {...ev, brief: `X25519MLKEM768 only as far as ${openssl.text} can ask: ${others.length - LEGACY.length} other TLS 1.3 groups and TLS 1.2, 1.1, 1.0 each refused by alert; the certificate verifies for ${HOST}`});
}

// The certificates the tls checks were served and verified, once each.
export function servedCertificates(checks) {
  const out = new Map();
  for (const c of checks) if (c.name.startsWith('tls ') && c.evidence?.verified && c.evidence.certificate?.serial) out.set(c.evidence.certificate.sha256, c.evidence.certificate);
  return [...out.values()];
}

const issuerOrg = issuer => /(?:^|,\s*)O=("?)([^,"]+)\1/.exec(String(issuer))?.[2] ?? null;
const dn = s => String(s ?? '').replace(/"/g, '').split(/\n|,\s*/).map(x => x.trim()).filter(Boolean).join(', ');
const serialOf = s => String(s).toLowerCase().replace(/^0+(?=.)/, '');

// crt.sh lists a precertificate and its final certificate under one serial; they count once. A served
// certificate counts as listed only when an entry carries its serial AND its issuer: a CA's serials
// are unique to it, a serial alone is not.
export function ctCheck(res, served, now = Date.now()) {
  if (res.error) return check('ct', 'NOT MEASURED', {error: res.error, brief: `crt.sh: ${res.error}`});
  const listed = new Map();
  for (const e of res.entries) {
    const serial = serialOf(e.serial_number), key = `${serial} ${dn(e.issuer_name)}`;
    if (!listed.has(key)) listed.set(key, {issuer: e.issuer_name, not_before: e.not_before, not_after: e.not_after, serial});
  }
  const certificates = [...listed.values()].sort((a, b) => bytewise(a.not_before, b.not_before));
  const notes = [];
  for (const c of certificates) if (!KNOWN_ISSUERS.includes(issuerOrg(c.issuer))) notes.push(`unknown issuer ${c.issuer} (serial ${c.serial})`);
  const validNow = certificates.filter(c => Date.parse(c.not_before + 'Z') <= now && now < Date.parse(c.not_after + 'Z')).length;
  if (validNow > 1) notes.push(`${validNow} certificates valid now; an edge serves one`);
  const unlogged = served.filter(s => !listed.has(`${serialOf(s.serial)} ${dn(s.issuer)}`));
  const ev = {entries: res.entries.length, certificates, served, notes};
  const tail = notes.length ? `; notes: ${notes.join('; ')}` : '';
  const named = ss => ss.map(s => `serial ${s.serial} from ${dn(s.issuer)}`).join(', ');
  if (!served.length) return check('ct', 'NOT MEASURED', {...ev, brief: `${certificates.length} certificates; no verified served certificate to look up${tail}`});
  // crt.sh ingests with a delay: a certificate it has not listed yet is not a measurement.
  if (unlogged.length) return check('ct', 'NOT MEASURED', {...ev, brief: `${named(unlogged)} not (yet) listed by crt.sh; ${certificates.length} certificates listed${tail}`});
  return check('ct', 'PASS', {...ev, brief: `${named(served)} logged; ${certificates.length} certificates listed${tail}`});
}

export function normAnswer(answer = []) {
  const n = s => String(s).toLowerCase().replace(/\.$/, '');
  return [...new Set(answer.map(a => `${n(a.name)} ${RRTYPE[a.type] ?? a.type} ${a.type === 257 ? a.data : n(a.data)}`))].sort(bytewise);
}

// res[resolver][type] = {status, answer: normAnswer(...)} | {error}
export function dnsCheck(res) {
  const [r1, r2] = Object.keys(res);
  const lost = [r1, r2].flatMap(r => TYPES.filter(t => res[r][t].error).map(t => `${r} ${t}: ${res[r][t].error}`));
  if (lost.length) return check('dns', 'NOT MEASURED', {answers: res, brief: `no answer: ${lost.join('; ')}`});
  const same = t => res[r1][t].status === res[r2][t].status && res[r1][t].answer.join('\n') === res[r2][t].answer.join('\n');
  const differ = TYPES.filter(t => !same(t));
  if (differ.length) return check('dns', 'FAIL', {answers: res, brief: `${r1} and ${r2} disagree on ${differ.join(', ')}`});
  const own = t => res[r1][t].answer.filter(s => s.split(' ')[1] === t);
  const cname = own('CNAME').map(s => s.split(' ')[2]).join(', ') || 'none';
  return check('dns', 'PASS', {answers: Object.fromEntries(TYPES.map(t => [t, res[r1][t]])),
    brief: `${r1} and ${r2} agree: CNAME ${cname}; A ${own('A').length}; AAAA ${own('AAAA').length}; CAA ${own('CAA').length}`});
}

export function addresses(res) {
  const out = {A: new Set(), AAAA: new Set()};
  for (const r of Object.values(res)) for (const t of ['A', 'AAAA']) for (const s of r[t]?.answer ?? []) {
    const [, type, data] = s.split(' ');
    if (type === t) out[t].add(data);
  }
  return {A: [...out.A].sort(bytewise), AAAA: [...out.AAAA].sort(bytewise)};
}

// Whether both resolvers agree the name is GitHub Pages: every address one of PAGES and any CNAME a
// *.github.io host. null when DNS did not settle it. Never the edge's own word (its Server header).
export function pagesFromDns(res) {
  if (dnsCheck(res).verdict !== 'PASS') return null;
  const {A, AAAA} = addresses(res), r1 = res[Object.keys(res)[0]];
  const cnames = r1.CNAME.answer.map(s => s.split(' ')).filter(([, t]) => t === 'CNAME').map(([, , d]) => d);
  return A.length + AAAA.length > 0 && A.every(a => PAGES.A.includes(a)) && AAAA.every(a => PAGES.AAAA.includes(a)) && cnames.every(c => c.endsWith('.github.io'));
}

const isHints = h => !!h && typeof h === 'object' && !Array.isArray(h) && Object.entries(h).every(([k, v]) =>
  k === 'ant' ? typeof v === 'string' && /^[A-Za-z0-9:._-]{1,256}$/.test(v)
  : k === 'ar' ? Array.isArray(v) && v.every(t => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t))
  : k === 'hive' ? !!v && typeof v === 'object' && Object.keys(v).sort().join() === 'block,trx' && Number.isSafeInteger(v.block) && v.block > 0 && /^[0-9a-f]{40}$/.test(v.trx)
  : k === 'peers' ? Array.isArray(v) && v.every(p => typeof p === 'string' && /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[\x21-\x7e]*)?$/.test(p))
  : false);

// Contract §3: {"bnr":"keychain-release-envelope/1","hints":{…},"record":"<b64u>","sig":{…}}, at most 64 KiB.
// expected: the repository's expectation (with its chain when records are committed); auth:
// authority(); pages: pagesFromDns().
export function wellKnownCheck(name, got, {expected = null, auth = {pins: [], law: []}, pages = null} = {}) {
  if (got.error) return check(name, 'NOT MEASURED', {url: got.url, error: got.error, brief: `no answer: ${got.error}`});
  const ev = {url: got.url, status: got.status, server: got.headers?.server ?? null};
  const say = (verdict, brief) => check(name, verdict, {...ev, brief});
  if (got.status === 404) return pages === true ? say('NOT MEASURED', 'absent (HTTP 404); expected while both resolvers name GitHub Pages')
    : pages === false ? say('FAIL', 'absent (HTTP 404) on a host DNS does not name as GitHub Pages')
    : say('NOT MEASURED', 'absent (HTTP 404); DNS did not settle whether this is GitHub Pages');
  if (got.status !== 200) return say('FAIL', `HTTP ${got.status}`);
  let recBytes, r, id;
  try {
    if (norm(got.headers?.['content-type']) !== 'application/json') throw new Error(`content-type ${got.headers?.['content-type'] ?? 'absent'} (want application/json)`);
    if (got.bytes.length > 65536) throw new Error(`${got.bytes.length} B exceeds 64 KiB`);
    let env;
    try { env = JSON.parse(got.bytes.toString('utf8')); } catch { throw new Error('not JSON'); }
    exactly(env, ['bnr', 'hints', 'record', 'sig'], 'envelope');
    if (env.bnr !== 'keychain-release-envelope/1') throw new Error('bnr is not keychain-release-envelope/1');
    if (!isHints(env.hints)) throw new Error('hints are not contract §3 hints');
    if (typeof env.record !== 'string' || !/^[A-Za-z0-9_-]+$/.test(env.record)) throw new Error('record is not base64url');
    recBytes = Buffer.from(env.record, 'base64url');
    if (b64u(recBytes) !== env.record) throw new Error('record is not canonical base64url');
    r = readRecord(recBytes);
    id = signerOf(env.sig, recBytes);
    if (auth.law.includes(id)) throw new Error(`signed by the law key ${id}, never a release authority`);
  } catch (e) { return say('FAIL', `refused: ${e.message}`); }
  const sha3 = hash('sha3-256', recBytes);
  Object.assign(ev, {seq: r.seq, record: digests(recBytes), signer: id, verified_with: 'surfaces/bpq.js (ML-DSA-65)'});
  const chain = expected?.chain ?? [];
  if (chain.length) {
    const top = chain.at(-1);
    if (r.seq > top.seq) return say('NOT MEASURED', `serves seq ${r.seq}; the repository commits up to seq ${top.seq} and the probe vouches only for committed releases`);
    if (r.seq < top.seq) return say('FAIL', `serves seq ${r.seq}, older than the committed seq ${top.seq}`);
    if (sha3 !== top.sha3) return say('FAIL', `seq ${r.seq} is not the committed record of that seq`);
  } else {
    if (!auth.pins.length) return say('NOT MEASURED', `signature by ${id} verifies, but no record is committed and docs/KEYCHAIN-RELEASE-SIGNERS.json pins no release signer (R-SIGNER): nothing in the repository authorizes it`);
    if (r.seq !== 1) return say('NOT MEASURED', `seq ${r.seq} is authorized only through every record before it, and none is committed`);
  }
  if (!authorized(r.seq, id, auth, chain[r.seq - 2])) return say('FAIL', `signed by ${id}, not an id the repository authorizes for seq ${r.seq}`);
  if (!expected?.files) return say('NOT MEASURED', 'no expectation from the repository to hold its files to');
  const key = f => `${f.path} ${f.sha256} ${f.sha3} ${f.size}`;
  if (r.files.map(key).join('\n') !== expected.files.map(key).join('\n')) return say('FAIL', `its files are not the files of ${expected.source}`);
  if (['sha256', 'sha3', 'size'].some(k => r.pack[k] !== expected.pack?.[k])) return say('FAIL', `its pack is not the pack of ${expected.source}`);
  return say('PASS', `seq ${r.seq}, record sha3 ${sha3}, signature by ${id} verified here, authorized by ${r.seq === 1 ? 'the pinned release signers' : `committed seq ${r.seq - 1}`}; files and pack are ${expected.source}`);
}

// Green only when every check is PASS and each one the receipt calls for is there: dns, ct, and tls,
// bytes, serving and well-known for every address it names.
export function overall(r) {
  if (r?.schema !== SCHEMA) throw new Error(`not a ${SCHEMA}`);
  const checks = Array.isArray(r.checks) ? r.checks : [], names = new Set(checks.map(c => c.name));
  const where = [...(r.addresses?.A ?? []).map(a => `A ${a}`), ...(r.addresses?.AAAA ?? []).map(a => `AAAA ${a}`)];
  const missing = ['dns', 'ct', ...where.flatMap(a => ['tls', 'bytes', 'serving', 'well-known'].map(k => `${k} ${a}`))].filter(n => !names.has(n));
  if (!where.length) missing.push('any A or AAAA address');
  const n = v => checks.filter(c => c.verdict === v).length;
  const odd = checks.length - n('PASS') - n('FAIL') - n('NOT MEASURED');
  if (n('FAIL')) return {verdict: 'FAIL', exit: 1, why: `${n('FAIL')} FAIL`};
  if (missing.length || n('NOT MEASURED') || odd) return {verdict: 'NOT MEASURED', exit: 2,
    why: [n('NOT MEASURED') && `${n('NOT MEASURED')} NOT MEASURED`, odd && `${odd} without a verdict`, missing.length && `missing: ${missing.join(', ')}`].filter(Boolean).join('; ')};
  return {verdict: 'PASS', exit: 0, why: `all ${checks.length} checks PASS`};
}

export function summary(r) {
  const o = overall(r);
  const n = v => r.checks.filter(c => c.verdict === v).length;
  const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
  return [`### keychain edge probe: ${r.vantage}, ${r.at}`, '',
    `**overall: ${o.verdict}** (${o.why}); green only when every check is PASS`, '',
    `PASS ${n('PASS')} · FAIL ${n('FAIL')} · NOT MEASURED ${n('NOT MEASURED')}`, '',
    '| check | verdict | evidence |', '|---|---|---|',
    ...r.checks.map(c => `| ${cell(c.name)} | ${c.verdict} | ${cell(c.evidence?.brief)} |`), ''].join('\n');
}

// ---- the wire ----

async function get(url, headers = {}, ms = 20000) {
  try {
    const r = await fetch(url, {redirect: 'manual', headers: {'cache-control': 'no-cache', ...headers}, signal: AbortSignal.timeout(ms)});
    return {url, status: r.status, bytes: Buffer.from(await r.arrayBuffer())};
  } catch (e) { return {url, error: String(e.cause?.code ?? e.cause?.message ?? e.name ?? e.message)}; }
}

// HTTPS to one address: the connection goes there; SNI and the certificate check (Node's bundled
// roots) are keys.skaists.dev. No redirect is followed.
const KEEP = ['server', 'content-type', 'cache-control', 'etag', 'x-content-type-options'];
function fetchAt(family, address, path, method = 'GET', ms = 20000) {
  const url = `${ORIGIN}${path} via ${address}`, fam = family === 'AAAA' ? 6 : 4;
  return new Promise(resolve => {
    const req = request({host: HOST, servername: HOST, port: 443, path, method, agent: false, timeout: ms, headers: {'cache-control': 'no-cache'},
      lookup: (h, o, cb) => (o?.all ? cb(null, [{address, family: fam}]) : cb(null, address, fam))}, res => {
      const chunks = [];
      let size = 0;
      res.on('data', c => { size += c.length; if (size > 32 << 20) req.destroy(Object.assign(new Error('answer over 32 MiB'), {code: 'E2BIG'})); else chunks.push(c); });
      res.on('end', () => resolve({url, status: res.statusCode, headers: Object.fromEntries(KEEP.map(k => [k, res.headers[k] ?? null])), bytes: Buffer.concat(chunks)}));
      res.on('error', e => resolve({url, error: String(e.code ?? e.message)}));
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), {code: 'ETIMEDOUT'})));
    req.on('error', e => resolve({url, error: String(e.code ?? e.message)}));
    req.end();
  });
}

async function webChecks(family, address, exp, auth, pages) {
  const at = (path, method) => fetchAt(family, address, path, method), tag = `${family} ${address}`;
  if (exp.error) {
    const why = {brief: `no expectation from the repository: ${exp.error}`};
    return [check(`bytes ${tag}`, 'NOT MEASURED', why), check(`serving ${tag}`, 'NOT MEASURED', why),
      wellKnownCheck(`well-known ${tag}`, await at('/.well-known/bnr-keychain/release'), {auth, pages})];
  }
  const targets = [['/', exp.files.find(f => f.path === 'index.html')], ...exp.files.map(f => [`/${f.path}`, f])];
  const [got, options, absent, pack, release] = await Promise.all([Promise.all(targets.map(([p]) => at(p))), at('/', 'OPTIONS'),
    at(`/kc-probe-absent-${randomBytes(6).toString('hex')}`), at('/.well-known/bnr-keychain/pack'), at('/.well-known/bnr-keychain/release')]);
  const none = p => check(p, 'NOT MEASURED', {brief: 'the expectation names no index.html'});
  return [
    rollup(`bytes ${tag}`, targets.map(([p, want], i) => (want ? bytesCheck(p, want, got[i]) : none(p))), {source: exp.source}),
    rollup(`serving ${tag}`, [...targets.map(([p, want], i) => (want ? headersCheck(p, want, got[i]) : none(p))),
      statusCheck('OPTIONS /', options, 405), statusCheck('unknown path', absent, 404), packCheck('/.well-known/bnr-keychain/pack', exp.pack, pack)]),
    wellKnownCheck(`well-known ${tag}`, release, {expected: exp, auth, pages}),
  ];
}

function run(cmd, args, ms = 25000) {
  return new Promise(resolve => {
    const cp = execFile(cmd, args, {timeout: ms, maxBuffer: 1 << 22, encoding: 'utf8', windowsHide: true}, (e, stdout, stderr) =>
      resolve({code: e ? (typeof e.code === 'number' ? e.code : null) : 0, stdout, stderr: stderr || (e && !stdout ? e.message : ''), timedOut: !!e?.killed}));
    cp.stdin?.end();
  });
}

function openssl(mode) {
  if (mode === 'auto') mode = spawnSync('docker', ['version'], {stdio: 'ignore'}).status === 0 ? 'docker' : 'local';
  const roots = rootCertificates.join('\n') + '\n', trust = `Node ${process.version} bundled roots (${rootCertificates.length})`;
  if (mode === 'local') {
    const dir = mkdtempSync(join(tmpdir(), 'kc-probe-roots-')), ca = join(dir, 'roots.pem');
    writeFileSync(ca, roots);
    return {via: 'local openssl on PATH', trust, ca, run: args => run('openssl', args), close() { rmSync(dir, {recursive: true, force: true}); }};
  }
  if (mode !== 'docker') throw new Error('--tls is auto, docker or local');
  const box = `kc-probe-${randomBytes(4).toString('hex')}`;
  execFileSync('docker', ['run', '-d', '--rm', '--network', 'host', '--name', box, IMAGE, 'sleep', '900'], {stdio: ['ignore', 'ignore', 'inherit']});
  try {
    execFileSync('docker', ['exec', box, 'apk', 'add', '-q', 'openssl'], {stdio: ['ignore', 'ignore', 'inherit']});
    execFileSync('docker', ['exec', '-i', box, 'sh', '-c', 'cat > /kc-roots.pem'], {input: roots, stdio: ['pipe', 'ignore', 'inherit']});
  } catch (e) { spawnSync('docker', ['rm', '-f', box]); throw e; }
  return {via: `docker ${IMAGE} --network host`, trust, ca: '/kc-roots.pem', run: args => run('docker', ['exec', box, 'timeout', '20', 'openssl', ...args]),
    close() { spawnSync('docker', ['rm', '-f', box], {stdio: 'ignore'}); }};
}

async function probeAddress(ossl, family, address, others) {
  const hs = async extra => ({args: extra, ...classify(await ossl.run(['s_client', '-connect', family === 'AAAA' ? `[${address}]:443` : `${address}:443`,
    '-servername', HOST, '-verify_hostname', HOST, '-CAfile', ossl.ca, '-no-CApath', '-no-CAstore', ...extra]))});
  const control = await hs(CONTROL), out = [];
  for (const extra of others) out.push(await hs(extra));
  return {control, others: out};
}

async function main(argv) {
  if (argv[0] === 'summary') {
    const r = JSON.parse(readFileSync(argv[1], 'utf8'));
    process.stdout.write(summary(r));
    process.exitCode = overall(r).exit;
    return;
  }
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const vantage = arg('vantage', 'unlabelled'), out = arg('out', 'keychain-edge-receipt.json'), tlsMode = arg('tls', 'auto');
  const at = new Date().toISOString(), checks = [];

  let auth = {pins: [], law: []}, exp;
  try {
    auth = authority(ROOT);
    exp = expectedFromRecords(join(ROOT, 'keychain', 'releases'), auth) ?? expectedFromBuild(ROOT);
  } catch (e) { exp = {error: e.message}; }

  // dns first: every probe below goes to its answers
  const res = Object.fromEntries(Object.keys(RESOLVERS).map(r => [r, Object.fromEntries(TYPES.map(t => [t, null]))]));
  await Promise.all(Object.entries(RESOLVERS).flatMap(([r, base]) => TYPES.map(async t => {
    const g = await get(`${base}?name=${HOST}&type=${t}`, {accept: 'application/dns-json'});
    let v;
    if (g.error) v = {error: g.error};
    else if (g.status !== 200) v = {error: `HTTP ${g.status}`};
    else try { const j = JSON.parse(g.bytes.toString('utf8')); v = {status: j.Status, answer: normAnswer(j.Answer)}; } catch { v = {error: 'not JSON'}; }
    res[r][t] = v;
  })));
  checks.push(dnsCheck(res));
  const addr = addresses(res), pages = pagesFromDns(res);
  const list = [...addr.A.map(a => ['A', a]), ...addr.AAAA.map(a => ['AAAA', a])];
  if (!list.length) checks.push(check('tls', 'NOT MEASURED', {brief: 'no A or AAAA answer to probe'}));

  // per address: tls, then bytes, serving and well-known over HTTPS pinned to it
  let ossl = null, unavailable = null;
  if (list.length) try { ossl = openssl(tlsMode); } catch (e) { unavailable = `openssl unavailable: ${e.message}`; }
  try {
    let version, others;
    if (ossl) {
      version = opensslVersion((await ossl.run(['version'])).stdout);
      others = otherProbes((await ossl.run(['list', '-tls1_3', '-tls-groups'])).stdout.trim().split(':').filter(Boolean));
    }
    const per = await Promise.all(list.map(async ([f, a]) => [
      ossl ? tlsCheck(f, a, {via: ossl.via, openssl: version, trust: ossl.trust, ...await probeAddress(ossl, f, a, others)})
        : check(`tls ${f} ${a}`, 'NOT MEASURED', {brief: unavailable}),
      ...await webChecks(f, a, exp, auth, pages)]));
    for (const cs of per) checks.push(...cs);
  } finally { ossl?.close(); }

  // ct
  const ct = await get(`https://crt.sh/?q=${HOST}&output=json`, {accept: 'application/json'}, 60000);
  let ctRes;
  if (ct.error) ctRes = {error: ct.error};
  else if (ct.status !== 200) ctRes = {error: `HTTP ${ct.status}`};
  else try { const j = JSON.parse(ct.bytes.toString('utf8')); ctRes = Array.isArray(j) ? {entries: j} : {error: 'not a JSON array'}; } catch { ctRes = {error: 'not JSON'}; }
  checks.push(ctCheck(ctRes, servedCertificates(checks)));

  const receipt = {schema: SCHEMA, at, vantage, addresses: addr, expectation: exp.error ? {error: exp.error} : {source: exp.source}, checks};
  writeFileSync(out, JSON.stringify(receipt, null, 1) + '\n');
  process.stdout.write(summary(receipt));
  console.log(`receipt → ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
