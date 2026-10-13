// probe.mjs — the independent prober for the keychain edge at keys.skaists.dev, and the only
// source allowed to call that edge green. An edge is never its own witness: every expectation
// here comes from the repository (a committed release record, or the build at this checkout) and
// every observation from the wire or a foreign oracle (crt.sh, two public DoH resolvers).
// Read-only: public GETs and TLS handshakes. No key, no secret, no payment.
//
//   node tools/keychain-release/probe.mjs [--vantage LABEL] [--out FILE] [--tls auto|docker|local]
//       writes a bnr.keychain-edge-receipt/1 (default keychain-edge-receipt.json) and exits 0 once
//       it is written, whatever the verdicts; a crash writes nothing
//   node tools/keychain-release/probe.mjs summary FILE
//       prints the receipt as a markdown table; exits 1 if any check is FAIL
//
// Checks, each PASS | FAIL | NOT MEASURED with its evidence:
//   bytes       "/" and every file the release names, against the highest-seq committed
//               keychain/releases/*/record.json, else `node scripts/build-keychain.mjs --out` on this
//               checkout (CNAME and .nojekyll left out, as the record leaves them out).
//   tls         per DNS answer, A and AAAA apart, with OpenSSL >= 3.5: --tls docker runs alpine:3.22
//               (openssl 3.5.9-r0, pkgs.alpinelinux.org/package/v3.22/main/x86_64/openssl), --tls local
//               the openssl on PATH; auto picks docker when it answers. The control is
//               -tls1_3 -groups X25519MLKEM768. Hybrid-only is PASS only when the control completes on
//               that group AND each classical probe (-groups X25519, -groups secp256r1, -tls1_2) is
//               refused by a TLS alert from the server. A failed control makes the address NOT MEASURED
//               (a broken probe is not evidence). A connection closed without an alert is not counted
//               as a refusal: a local middlebox produces the same.
//   ct          crt.sh lists the certificate the tls probes were served (not listed yet is NOT MEASURED:
//               crt.sh ingests with a delay). Issuers outside KNOWN_ISSUERS and more than one
//               certificate valid now are noted, never fatal. Wildcard *.skaists.dev certificates are
//               not queried.
//   dns         A/AAAA/CNAME/CAA from dns.google and cloudflare-dns.com; a disagreement is FAIL.
//   well-known  /.well-known/bnr-keychain/release. Absent is NOT MEASURED while the host answers as
//               GitHub Pages (Server: GitHub.com) and FAIL on any other host. The envelope's signature
//               is not verified here; keys-door and release.mjs do that.
//
// Digests in the receipt are base64url (the secret scan blocks hex runs of 48+ characters).
import {readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createHash, X509Certificate, randomBytes} from 'node:crypto';
import {execFile, execFileSync, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const SCHEMA = 'bnr.keychain-edge-receipt/1';
export const ORIGIN = 'https://keys.skaists.dev';
export const HOST = 'keys.skaists.dev';
export const IMAGE = 'alpine:3.22';
export const CONTROL = ['-tls1_3', '-groups', 'X25519MLKEM768'];
export const CLASSICAL = [['-groups', 'X25519'], ['-groups', 'secp256r1'], ['-tls1_2']];
// GitHub Pages certificates come from Let's Encrypt; Caddy's default issuers are Let's Encrypt, then ZeroSSL.
export const KNOWN_ISSUERS = ["Let's Encrypt", 'ZeroSSL'];
export const TYPES = ['A', 'AAAA', 'CNAME', 'CAA'];
const RESOLVERS = {'dns.google': 'https://dns.google/resolve', 'cloudflare-dns.com': 'https://cloudflare-dns.com/dns-query'};
const RRTYPE = {1: 'A', 28: 'AAAA', 5: 'CNAME', 257: 'CAA'};
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const b64u = buf => Buffer.from(buf).toString('base64url');
const hash = (alg, bytes) => b64u(createHash(alg).update(bytes).digest());
const bytewise = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const check = (name, verdict, evidence) => ({name, verdict, evidence});
export const digests = bytes => ({sha256: hash('sha256', bytes), sha3: hash('sha3-256', bytes), size: bytes.length});

// ---- the expectation, from the repository only ----

const isDigest = s => typeof s === 'string' && /^[A-Za-z0-9_-]{43}$/.test(s) && b64u(Buffer.from(s, 'base64url')) === s;

// The highest-seq committed release record, its base64url digests decoded and re-encoded to prove
// they are canonical 32-byte values. null when none is committed.
export function expectedFromRecords(dir) {
  if (!existsSync(dir)) return null;
  const found = [];
  for (const d of readdirSync(dir)) {
    const p = join(dir, d, 'record.json');
    if (!existsSync(p)) continue;
    const bytes = readFileSync(p), r = JSON.parse(bytes.toString('utf8'));
    if (!Number.isInteger(r.seq) || r.seq < 1 || !Array.isArray(r.files)) throw new Error(`${d}/record.json is not a release record`);
    found.push({r, bytes, d});
  }
  if (!found.length) return null;
  found.sort((a, b) => b.r.seq - a.r.seq);
  if (found[1] && found[1].r.seq === found[0].r.seq) throw new Error(`two committed records share seq ${found[0].r.seq}`);
  const {r, bytes, d} = found[0];
  const files = r.files.map(f => {
    if (!isDigest(f.sha256) || !isDigest(f.sha3) || !Number.isInteger(f.size)) throw new Error(`${d}/record.json: bad digest for ${f.path}`);
    return {path: f.path, sha256: f.sha256, sha3: f.sha3, size: f.size};
  });
  return {source: `record seq ${r.seq} (keychain/releases/${d}/record.json)`, seq: r.seq, recordSha3: hash('sha3-256', bytes), files};
}

// The site exactly as a release builds it (contract §1: source.build), from this checkout.
export function expectedFromBuild(root) {
  const out = mkdtempSync(join(tmpdir(), 'kc-probe-'));
  try {
    execFileSync(process.execPath, ['scripts/build-keychain.mjs', '--out', out], {cwd: root, stdio: ['ignore', 'ignore', 'inherit']});
    const files = readdirSync(out, {recursive: true}).map(p => relative(out, join(out, p)).split('\\').join('/'))
      .filter(p => statSync(join(out, p)).isFile() && p !== 'CNAME' && p !== '.nojekyll').sort(bytewise)
      .map(p => ({path: p, ...digests(readFileSync(join(out, p)))}));
    let commit = 'unknown';
    try { commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(); } catch {}
    return {source: `node scripts/build-keychain.mjs --out at ${commit}`, files};
  } finally { rmSync(out, {recursive: true, force: true}); }
}

// ---- verdicts (pure; probe.test.mjs drives them from fixtures) ----

export function bytesCheck(name, want, got, source) {
  const ev = {url: got.url, source, want: {sha256: want.sha256, sha3: want.sha3, size: want.size}};
  if (got.error) return check(name, 'NOT MEASURED', {...ev, error: got.error, brief: `no answer: ${got.error}`});
  ev.status = got.status;
  if (got.status !== 200) return check(name, 'FAIL', {...ev, brief: `HTTP ${got.status}`});
  ev.got = digests(got.bytes);
  const differ = ['sha256', 'sha3', 'size'].filter(k => ev.want[k] !== undefined && ev.want[k] !== ev.got[k]);
  if (differ.length) return check(name, 'FAIL', {...ev, brief: `${differ.join(', ')} differ: want sha256 ${want.sha256}, got ${ev.got.sha256}`});
  return check(name, 'PASS', {...ev, brief: `sha256 ${ev.got.sha256}, ${ev.got.size} B`});
}

export function opensslVersion(text) {
  const m = /OpenSSL (\d+)\.(\d+)\.(\d+)/.exec(String(text));
  return m ? {text: m[0], ok: Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 5)} : {text: String(text).trim().slice(0, 80) || 'unknown', ok: false};
}

// "Peer Temp Key: X25519, 253 bits" names the group first; "Peer Temp Key: ECDH, prime256v1, 256 bits" second.
const tempKey = out => {
  const p = /(?:Peer|Server) Temp Key: ([^\r\n]+)/.exec(out)?.[1].split(',').map(s => s.trim());
  return !p ? null : p[0] === 'ECDH' && p[1] ? p[1] : p[0];
};

// One s_client run → accepted | refused (a TLS alert arrived) | closed (no alert) | error.
export function classify({code = null, stdout = '', stderr = '', timedOut = false}) {
  const out = String(stdout), err = String(stderr);
  if (timedOut) return {outcome: 'error', detail: 'timeout'};
  const done = /New, (TLSv1\.[0-3]), Cipher is (?!\(NONE\))(\S+)/.exec(out);
  if (done) return {
    outcome: 'accepted', protocol: done[1], cipher: done[2],
    group: /Negotiated TLS1\.3 group: (\S+)/.exec(out)?.[1] ?? tempKey(out),
    verify: /Verify return code: ([^\n]+)/.exec(out)?.[1].trim() ?? null,
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

export function tlsCheck(family, address, {via, openssl, control, classical}) {
  const name = `tls ${family} ${address}`;
  const ev = {via, openssl: openssl.text, control: lean(control), classical: classical.map(lean)};
  const pem = [control, ...classical].find(p => p.pem)?.pem;
  if (pem) try { ev.certificate = certFacts(pem); } catch (e) { ev.certificate = {error: e.message}; }
  if (!openssl.ok) return check(name, 'NOT MEASURED', {...ev, brief: `${openssl.text} cannot offer X25519MLKEM768 (needs OpenSSL >= 3.5)`});
  if (control.outcome !== 'accepted' || control.group !== 'X25519MLKEM768')
    return check(name, 'NOT MEASURED', {...ev, brief: `control did not complete on X25519MLKEM768: ${said(control)}`});
  const shown = classical.map(p => `${p.args.join(' ')}: ${said(p)}`).join('; ');
  if (classical.some(p => p.outcome === 'accepted')) return check(name, 'FAIL', {...ev, brief: `classical accepted. ${shown}`});
  if (classical.every(p => p.outcome === 'refused')) return check(name, 'PASS', {...ev, brief: `hybrid only: X25519MLKEM768 negotiated; ${shown}`});
  return check(name, 'NOT MEASURED', {...ev, brief: `control ok, classical not refused on the wire. ${shown}`});
}

const issuerOrg = issuer => /(?:^|,\s*)O=("?)([^,"]+)\1/.exec(String(issuer))?.[2] ?? null;

// crt.sh lists a precertificate and its final certificate under one serial; they count once.
export function ctCheck(res, served, now = Date.now()) {
  if (res.error) return check('ct', 'NOT MEASURED', {error: res.error, brief: `crt.sh: ${res.error}`});
  const bySerial = new Map();
  for (const e of res.entries) {
    const serial = String(e.serial_number).toLowerCase().replace(/^0+(?=.)/, '');
    if (!bySerial.has(serial)) bySerial.set(serial, {issuer: e.issuer_name, not_before: e.not_before, not_after: e.not_after, serial});
  }
  const certificates = [...bySerial.values()].sort((a, b) => bytewise(a.not_before, b.not_before));
  const notes = [];
  for (const c of certificates) if (!KNOWN_ISSUERS.includes(issuerOrg(c.issuer))) notes.push(`unknown issuer ${c.issuer} (serial ${c.serial})`);
  const validNow = certificates.filter(c => Date.parse(c.not_before + 'Z') <= now && now < Date.parse(c.not_after + 'Z')).length;
  if (validNow > 1) notes.push(`${validNow} certificates valid now; an edge serves one`);
  const unlogged = served.filter(s => !bySerial.has(s));
  const ev = {entries: res.entries.length, certificates, served, notes};
  const tail = notes.length ? `; notes: ${notes.join('; ')}` : '';
  if (!served.length) return check('ct', 'NOT MEASURED', {...ev, brief: `${certificates.length} certificates; no served certificate to look up${tail}`});
  // crt.sh ingests with a delay: a certificate it has not listed yet is not a measurement.
  if (unlogged.length) return check('ct', 'NOT MEASURED', {...ev, brief: `served serial ${unlogged.join(', ')} not (yet) listed by crt.sh; ${certificates.length} certificates listed${tail}`});
  return check('ct', 'PASS', {...ev, brief: `served serial ${served.join(', ')} is logged; ${certificates.length} certificates listed${tail}`});
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

// Contract §3: {"bnr":"keychain-release-envelope/1","hints":{…},"record":"<b64u>","sig":{…}}, at most 64 KiB.
export function wellKnownCheck(got, committed = null) {
  const name = 'well-known';
  if (got.error) return check(name, 'NOT MEASURED', {url: got.url, error: got.error, brief: `no answer: ${got.error}`});
  const ev = {url: got.url, status: got.status, server: got.server ?? null};
  if (got.status === 404) return /^github\.com$/i.test(got.server ?? '')
    ? check(name, 'NOT MEASURED', {...ev, brief: 'absent (HTTP 404); expected while the host is GitHub Pages'})
    : check(name, 'FAIL', {...ev, brief: `absent (HTTP 404) on a host that is not GitHub Pages (Server: ${got.server ?? 'none'})`});
  if (got.status !== 200) return check(name, 'FAIL', {...ev, brief: `HTTP ${got.status}`});
  const bad = why => check(name, 'FAIL', {...ev, brief: `malformed envelope: ${why}`});
  if (got.bytes.length > 65536) return bad(`${got.bytes.length} B exceeds 64 KiB`);
  let env, rec, recBytes;
  try { env = JSON.parse(got.bytes.toString('utf8')); } catch { return bad('not JSON'); }
  if (env?.bnr !== 'keychain-release-envelope/1') return bad('bnr is not keychain-release-envelope/1');
  if (typeof env.record !== 'string' || !/^[A-Za-z0-9_-]+$/.test(env.record)) return bad('record is not base64url');
  if (typeof env.sig !== 'object' || env.sig === null) return bad('no sig object');
  try { recBytes = Buffer.from(env.record, 'base64url'); rec = JSON.parse(recBytes.toString('utf8')); } catch { return bad('record is not JSON'); }
  if (rec?.schema !== 'bnr.keychain-release/1' || rec.kind !== 'release') return bad('record schema/kind');
  if (rec.origin !== ORIGIN || rec.rp_id !== HOST) return bad(`record names ${rec.origin} / ${rec.rp_id}`);
  if (!Number.isInteger(rec.seq) || rec.seq < 1) return bad('record seq');
  Object.assign(ev, {seq: rec.seq, record: digests(recBytes), signature: 'not verified by this probe'});
  if (committed?.seq !== undefined) {
    if (rec.seq < committed.seq) return check(name, 'FAIL', {...ev, brief: `serves seq ${rec.seq}, older than committed seq ${committed.seq}`});
    if (rec.seq === committed.seq && ev.record.sha3 !== committed.recordSha3) return check(name, 'FAIL', {...ev, brief: `seq ${rec.seq} differs from the committed record of the same seq`});
  }
  return check(name, 'PASS', {...ev, brief: `envelope for seq ${rec.seq} served (record sha3 ${ev.record.sha3}); signature not verified here`});
}

export function summary(r) {
  if (r?.schema !== SCHEMA) throw new Error(`not a ${SCHEMA}`);
  const n = v => r.checks.filter(c => c.verdict === v).length;
  const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
  return [`### keychain edge probe: ${r.vantage}, ${r.at}`, '',
    `PASS ${n('PASS')} · FAIL ${n('FAIL')} · NOT MEASURED ${n('NOT MEASURED')}`, '',
    '| check | verdict | evidence |', '|---|---|---|',
    ...r.checks.map(c => `| ${cell(c.name)} | ${c.verdict} | ${cell(c.evidence?.brief)} |`), ''].join('\n');
}

// ---- the wire ----

async function get(url, headers = {}, ms = 20000) {
  try {
    const r = await fetch(url, {redirect: 'manual', headers: {'cache-control': 'no-cache', ...headers}, signal: AbortSignal.timeout(ms)});
    return {url, status: r.status, server: r.headers.get('server'), bytes: Buffer.from(await r.arrayBuffer())};
  } catch (e) { return {url, error: String(e.cause?.code ?? e.cause?.message ?? e.name ?? e.message)}; }
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
  if (mode === 'local') return {via: 'local openssl on PATH', run: args => run('openssl', args), close() {}};
  if (mode !== 'docker') throw new Error('--tls is auto, docker or local');
  const box = `kc-probe-${randomBytes(4).toString('hex')}`;
  execFileSync('docker', ['run', '-d', '--rm', '--network', 'host', '--name', box, IMAGE, 'sleep', '900'], {stdio: ['ignore', 'ignore', 'inherit']});
  try { execFileSync('docker', ['exec', box, 'apk', 'add', '-q', 'openssl'], {stdio: ['ignore', 'ignore', 'inherit']}); } catch (e) { spawnSync('docker', ['rm', '-f', box]); throw e; }
  return {via: `docker ${IMAGE} --network host`, run: args => run('docker', ['exec', box, 'timeout', '20', 'openssl', ...args]),
    close() { spawnSync('docker', ['rm', '-f', box], {stdio: 'ignore'}); }};
}

async function probeAddress(ossl, family, address) {
  const hs = async extra => ({args: extra, ...classify(await ossl.run(['s_client', '-connect', family === 'AAAA' ? `[${address}]:443` : `${address}:443`,
    '-servername', HOST, '-verify_hostname', HOST, ...extra]))});
  const control = await hs(CONTROL), classical = [];
  for (const extra of CLASSICAL) classical.push(await hs(extra));
  return {control, classical};
}

async function main(argv) {
  if (argv[0] === 'summary') {
    const r = JSON.parse(readFileSync(argv[1], 'utf8'));
    process.stdout.write(summary(r));
    process.exitCode = r.checks.some(c => c.verdict === 'FAIL') ? 1 : 0;
    return;
  }
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const vantage = arg('vantage', 'unlabelled'), out = arg('out', 'keychain-edge-receipt.json'), tlsMode = arg('tls', 'auto');
  const at = new Date().toISOString(), checks = [];

  // bytes
  let exp;
  try { exp = expectedFromRecords(join(ROOT, 'keychain', 'releases')) ?? expectedFromBuild(ROOT); } catch (e) { exp = {error: e.message}; }
  if (exp.error) checks.push(check('bytes', 'NOT MEASURED', {brief: `no expectation from the repository: ${exp.error}`}));
  else {
    const index = exp.files.find(f => f.path === 'index.html');
    const targets = [['/', index], ...exp.files.map(f => [`/${f.path}`, f])];
    const got = await Promise.all(targets.map(([p]) => get(ORIGIN + p)));
    targets.forEach(([p, want], i) => checks.push(want ? bytesCheck(`bytes ${p}`, want, got[i], exp.source)
      : check(`bytes ${p}`, 'NOT MEASURED', {brief: 'the expectation names no index.html'})));
  }

  // dns (asked first: the tls probes go to its answers)
  const res = Object.fromEntries(Object.keys(RESOLVERS).map(r => [r, Object.fromEntries(TYPES.map(t => [t, null]))]));
  await Promise.all(Object.entries(RESOLVERS).flatMap(([r, base]) => TYPES.map(async t => {
    const g = await get(`${base}?name=${HOST}&type=${t}`, {accept: 'application/dns-json'});
    let v;
    if (g.error) v = {error: g.error};
    else if (g.status !== 200) v = {error: `HTTP ${g.status}`};
    else try { const j = JSON.parse(g.bytes.toString('utf8')); v = {status: j.Status, answer: normAnswer(j.Answer)}; } catch { v = {error: 'not JSON'}; }
    res[r][t] = v;
  })));

  // tls
  const served = new Set(), addr = addresses(res);
  if (!addr.A.length && !addr.AAAA.length) checks.push(check('tls', 'NOT MEASURED', {brief: 'no A or AAAA answer to probe'}));
  else {
    let ossl;
    try { ossl = openssl(tlsMode); } catch (e) { checks.push(check('tls', 'NOT MEASURED', {brief: `openssl unavailable: ${e.message}`})); }
    if (ossl) try {
      const version = opensslVersion((await ossl.run(['version'])).stdout);
      const list = [...addr.A.map(a => ['A', a]), ...addr.AAAA.map(a => ['AAAA', a])];
      const probes = await Promise.all(list.map(([f, a]) => probeAddress(ossl, f, a)));
      list.forEach(([f, a], i) => {
        const c = tlsCheck(f, a, {via: ossl.via, openssl: version, ...probes[i]});
        if (c.evidence.certificate?.serial) served.add(c.evidence.certificate.serial);
        checks.push(c);
      });
    } finally { ossl.close(); }
  }

  // ct
  const ct = await get(`https://crt.sh/?q=${HOST}&output=json`, {accept: 'application/json'}, 60000);
  let ctRes;
  if (ct.error) ctRes = {error: ct.error};
  else if (ct.status !== 200) ctRes = {error: `HTTP ${ct.status}`};
  else try { const j = JSON.parse(ct.bytes.toString('utf8')); ctRes = Array.isArray(j) ? {entries: j} : {error: 'not a JSON array'}; } catch { ctRes = {error: 'not JSON'}; }
  checks.push(ctCheck(ctRes, [...served]));

  checks.push(dnsCheck(res));
  checks.push(wellKnownCheck(await get(`${ORIGIN}/.well-known/bnr-keychain/release`), exp.seq ? exp : null));

  const receipt = {schema: SCHEMA, at, vantage, checks};
  writeFileSync(out, JSON.stringify(receipt, null, 1) + '\n');
  process.stdout.write(summary(receipt));
  console.log(`receipt → ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
