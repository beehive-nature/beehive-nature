// The prober must not be able to call the edge green on evidence it did not observe. Every
// fixture below is a way the edge, the path or the probe itself can mislead; no network is used.
// Release keys are throwaway, made in this process; none authorizes anything outside it.
//   node --test tools/keychain-release/test/probe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  SCHEMA, ORIGIN, HOST, CONTROL, LEGACY, OTHER_GROUPS, PAGES, BPQ, classify, tlsCheck, otherProbes, opensslVersion, certFacts,
  servedCertificates, bytesCheck, headersCheck, statusCheck, packCheck, rollup, digests, canon, readRecord, expectedFromRecords,
  inputsChanged, dnsCheck, normAnswer, addresses, pagesFromDns, ctCheck, wellKnownCheck, overall, summary,
} from '../probe.mjs';

const PROBE = fileURLToPath(new URL('../probe.mjs', import.meta.url));

// A throwaway self-signed P-256 certificate (its key was discarded at generation): serial 0a1b2c3d.
const PEM = `-----BEGIN CERTIFICATE-----
MIIBrDCCAVGgAwIBAgIEChssPTAKBggqhkjOPQQDAjAzMRYwFAYDVQQKDA1Qcm9i
ZSBGaXh0dXJlMRkwFwYDVQQDDBBrZXlzLnNrYWlzdHMuZGV2MB4XDTI2MDEwMTAw
MDAwMFoXDTI3MDExMDE5NTY0OFowMzEWMBQGA1UECgwNUHJvYmUgRml4dHVyZTEZ
MBcGA1UEAwwQa2V5cy5za2Fpc3RzLmRldjBZMBMGByqGSM49AgEGCCqGSM49AwEH
A0IABHqrilOEJvpXnBZZ2o7FB5SChwvgnS/eABqYCfsd/zEjebk1HHXDjQBLVW16
pRBoyD1mfIr2u9SikllMW2ABuSOjUzBRMB0GA1UdDgQWBBRGW7pi5KEQVFGXWbwh
VPEma2TOGzAfBgNVHSMEGDAWgBRGW7pi5KEQVFGXWbwhVPEma2TOGzAPBgNVHRMB
Af8EBTADAQH/MAoGCCqGSM49BAMCA0kAMEYCIQD60Jig7Tegs+AvL/NEX+UEVXOX
gx+YCJ7w0WC8Ag8UdgIhAP9RHJjyVGE+rlQuXVC4lxAks27HcxToboTwWOWUIgOc
-----END CERTIFICATE-----`;

// s_client 3.5 output shapes, as observed against a live host and trimmed.
const accepted13 = (group, verify = '0 (ok)') => ({code: 0, stderr: 'Connecting to 203.0.113.7\ndepth=0 CN=keys.skaists.dev\nverify return:1\nDONE\n', stdout:
  `CONNECTED(00000164)\n---\nServer certificate\n${PEM}\nsubject=CN=keys.skaists.dev\n---\nPeer signature type: ecdsa_secp256r1_sha256\n` +
  (/MLKEM/i.test(group) ? `Negotiated TLS1.3 group: ${group}\n` : `Peer Temp Key: ${group}, 253 bits\n`) +
  '---\nVerification: OK\n---\nNew, TLSv1.3, Cipher is TLS_AES_128_GCM_SHA256\nProtocol: TLSv1.3\n' + (verify ? `Verify return code: ${verify}\n` : '')});
const accepted12 = {code: 0, stderr: 'DONE\n', stdout: `CONNECTED(00000160)\nServer certificate\n${PEM}\nPeer Temp Key: X25519, 253 bits\n---\nNew, TLSv1.2, Cipher is ECDHE-ECDSA-CHACHA20-POLY1305\nProtocol: TLSv1.2\nVerify return code: 0 (ok)\n`};
// "New, X" names the version that defined the cipher; a TLS 1.0 session prints TLSv1.0 there and TLSv1 as its protocol
const accepted10 = {code: 0, stderr: 'DONE\n', stdout: `CONNECTED(00000160)\nServer certificate\n${PEM}\nPeer Temp Key: X25519, 253 bits\n---\nNew, TLSv1.0, Cipher is ECDHE-RSA-AES128-SHA\nProtocol: TLSv1\nVerify return code: 0 (ok)\n`};
const refused = {code: 1, stdout: 'CONNECTED(00000003)\n---\nno peer certificate available\nNegotiated TLS1.3 group: <NULL>\n---\nNew, (NONE), Cipher is (NONE)\n',
  stderr: 'Connecting to 203.0.113.7\n40F7:error:0A000410:SSL routines::ssl/tls alert handshake failure:../ssl/record/rec_layer_s3.c:916:SSL alert number 40\n'};
const closed = {code: 1, stdout: 'CONNECTED(00000164)\nNegotiated TLS1.3 group: <NULL>\nNew, (NONE), Cipher is (NONE)\nProtocol: TLSv1.3\n',
  stderr: 'Connecting to 203.0.113.7\n687B0000:error:0A000126:SSL routines::unexpected eof while reading:../openssl-3.5.7/ssl/record/rec_layer_s3.c:698:\n'};
const noConnect = {code: 1, stdout: '', stderr: '10460000:error:80002743:system library:BIO_connect:Unknown error:../crypto/bio/bio_sock2.c:183:calling connect()\nconnect:errno=0\n'};

const V35 = opensslVersion('OpenSSL 3.5.7 9 Jun 2026 (Library: OpenSSL 3.5.7 9 Jun 2026)');
const OTHERS = otherProbes();
const offer = args => args.join(' ');
// every offer besides the control refused by alert, unless `take` names its s_client output
const probe = (control, take = {}, others = OTHERS) => ({via: 'fixture', openssl: V35, trust: 'fixture roots',
  control: {args: CONTROL, ...classify(control)}, others: others.map(args => ({args, ...classify(take[offer(args)] ?? refused)}))});
const grp = g => offer(['-tls1_3', '-groups', g]);

test('classify: each s_client outcome, CRLF output included; the protocol is the negotiated one', () => {
  const c = classify(accepted13('X25519MLKEM768'));
  assert.equal(c.outcome, 'accepted'); assert.equal(c.group, 'X25519MLKEM768'); assert.equal(c.protocol, 'TLSv1.3'); assert.equal(c.verify, '0 (ok)');
  assert.ok(c.pem.startsWith('-----BEGIN CERTIFICATE-----'));
  const crlf = accepted13('X25519MLKEM768'); crlf.stdout = crlf.stdout.replace(/\n/g, '\r\n');
  assert.equal(classify(crlf).group, 'X25519MLKEM768'); assert.equal(classify(crlf).verify, '0 (ok)');
  assert.deepEqual([classify(accepted13('X25519')).group, classify(accepted12).protocol, classify(accepted12).group], ['X25519', 'TLSv1.2', 'X25519']);
  assert.equal(classify(accepted13('ECDH, prime256v1')).group, 'prime256v1');
  // a TLS 1.0 session, and a TLS 1.2 session on a cipher SSLv3 defined, are both acceptances
  assert.deepEqual([classify(accepted10).outcome, classify(accepted10).protocol], ['accepted', 'TLSv1']);
  const sslv3Cipher = {...accepted12, stdout: accepted12.stdout.replace('New, TLSv1.2, Cipher is ECDHE-ECDSA-CHACHA20-POLY1305', 'New, SSLv3, Cipher is AES128-SHA')};
  assert.deepEqual([classify(sslv3Cipher).outcome, classify(sslv3Cipher).protocol], ['accepted', 'TLSv1.2']);
  assert.equal(classify(accepted13('X25519MLKEM768', null)).verify, null);
  assert.deepEqual(classify(refused), {outcome: 'refused', alert: 40, detail: 'handshake failure'});
  assert.equal(classify(closed).outcome, 'closed');
  assert.equal(classify(noConnect).outcome, 'error');
  assert.deepEqual(classify({timedOut: true, stdout: 'CONNECTED(00000003)\n'}), {outcome: 'error', detail: 'timeout'});
  assert.equal(classify({code: 1, stderr: 'Call to SSL_CONF_cmd(-groups, NOPE) failed\n'}).outcome, 'error');
});

test('opensslVersion: 3.5 is the floor for X25519MLKEM768', () => {
  assert.equal(V35.ok, true);
  assert.equal(opensslVersion('OpenSSL 3.0.13 30 Jan 2024').ok, false);
  assert.equal(opensslVersion('OpenSSL 3.4.1 11 Feb 2025').ok, false);
  assert.equal(opensslVersion('OpenSSL 4.0.0 1 Apr 2026').ok, true);
  assert.equal(opensslVersion('').ok, false);
});

test('certFacts: key algorithm, issuer, notAfter, serial, fingerprint', () => {
  const f = certFacts(PEM);
  assert.equal(f.key, 'EC prime256v1');
  assert.equal(f.issuer, 'O=Probe Fixture, CN=keys.skaists.dev');
  assert.equal(f.notAfter, '2027-01-10T19:56:48.000Z');
  assert.equal(f.serial, 'a1b2c3d');
  assert.match(f.sha256, /^[A-Za-z0-9_-]{43}$/);
});

// `openssl list -tls1_3 -tls-groups`, OpenSSL 3.5.7 on this box
const LISTED_357 = 'secp256r1:secp384r1:secp521r1:x25519:x448:brainpoolP256r1tls13:brainpoolP384r1tls13:brainpoolP512r1tls13:ffdhe2048:ffdhe3072:ffdhe4096:ffdhe6144:ffdhe8192:MLKEM512:MLKEM768:MLKEM1024:SecP256r1MLKEM768:X25519MLKEM768:SecP384r1MLKEM1024'.split(':');

test('offers: every TLS 1.3 group OpenSSL 3.5 lists but X25519MLKEM768, then TLS 1.2, 1.1 and 1.0', () => {
  assert.deepEqual(LISTED_357.filter(g => g !== 'X25519MLKEM768'), OTHER_GROUPS);
  assert.deepEqual(otherProbes(LISTED_357), OTHERS, 'nothing the 3.5.7 listing names is left out');
  for (const g of ['secp384r1', 'secp521r1', 'x448', 'ffdhe2048', 'brainpoolP256r1tls13', 'SecP256r1MLKEM768']) assert.ok(OTHERS.some(a => offer(a) === grp(g)), g);
  assert.deepEqual(OTHERS.slice(-3).map(a => a[0]), ['-tls1_2', '-tls1_1', '-tls1']);
  const more = otherProbes([...LISTED_357, 'FutureGroup', 'x25519mlkem768', 'bad;name']);
  assert.equal(more.length, OTHERS.length + 1); assert.ok(more.some(a => offer(a) === grp('FutureGroup')));
  assert.ok(!more.some(a => /mlkem768$/i.test(a[2] ?? '') && /^x25519/i.test(a[2])), 'the control group is never an "other" offer');
});

test('tls: PASS only when the control completes on X25519MLKEM768 with a verified certificate and every other offer is refused by alert', () => {
  const pass = tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768')));
  assert.equal(pass.verdict, 'PASS');
  assert.equal(pass.evidence.verified, true);
  assert.equal(pass.evidence.certificate.key, 'EC prime256v1');
  assert.equal(pass.evidence.control.pem, undefined, 'raw certificate text stays out of the receipt');
  assert.match(pass.evidence.brief, /18 other TLS 1\.3 groups and TLS 1\.2, 1\.1, 1\.0 each refused by alert/);
});

test('tls: an edge with `curves x25519mlkem768 secp384r1` is FAIL, and so is any other single acceptance', () => {
  const c = tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), {[grp('secp384r1')]: accepted13('secp384r1')}));
  assert.equal(c.verdict, 'FAIL'); assert.match(c.evidence.brief, /not X25519MLKEM768 only, accepted: -tls1_3 -groups secp384r1/);
  for (const args of OTHERS) {
    const got = args[0] === '-tls1_3' ? accepted13(args[2]) : args[0] === '-tls1_2' ? accepted12 : accepted10;
    assert.equal(tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), {[offer(args)]: got})).verdict, 'FAIL', offer(args));
  }
});

test('tls: a certificate that does not verify for keys.skaists.dev is FAIL; no verification result is NOT MEASURED', () => {
  for (const v of ['18 (self-signed certificate)', '62 (hostname mismatch)', '10 (certificate has expired)', '20 (unable to get local issuer certificate)']) {
    const c = tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768', v)));
    assert.equal(c.verdict, 'FAIL', v); assert.match(c.evidence.brief, /does not verify for keys\.skaists\.dev/); assert.equal(c.evidence.verified, false);
  }
  assert.equal(tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768', null))).verdict, 'NOT MEASURED');
});

test('tls: an offer left out is not measured, so never PASS (the three-offer probe of the first draft included)', () => {
  const short = OTHERS.filter(a => offer(a) !== grp('secp384r1'));
  const c = tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), {}, short));
  assert.equal(c.verdict, 'NOT MEASURED'); assert.match(c.evidence.brief, /not offered, so not measured: -tls1_3 -groups secp384r1$/);
  const firstDraft = [['-groups', 'X25519'], ['-groups', 'secp256r1'], ['-tls1_2']];
  assert.equal(tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), {}, firstDraft)).verdict, 'NOT MEASURED');
});

test('tls: a failed control is NOT MEASURED even when other offers answered', () => {
  const answered = {[grp('x25519')]: accepted13('X25519'), [offer(LEGACY[0])]: accepted12};
  for (const control of [noConnect, closed, refused, {timedOut: true}]) {
    assert.equal(tlsCheck('AAAA', '2001:db8::7', probe(control, answered)).verdict, 'NOT MEASURED');
  }
  // control "accepted" on a group it never offered: the probe is broken, not the edge
  assert.equal(tlsCheck('A', '203.0.113.7', probe(accepted13('X25519'))).verdict, 'NOT MEASURED');
});

test('tls: a close without an alert, or a connect error, is not a refusal', () => {
  assert.equal(tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), {[grp('secp256r1')]: closed})).verdict, 'NOT MEASURED');
  assert.equal(tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), Object.fromEntries(OTHERS.map(a => [offer(a), noConnect])))).verdict, 'NOT MEASURED');
});

test('tls: OpenSSL older than 3.5 is NOT MEASURED whatever it printed', () => {
  const p = probe(accepted13('X25519MLKEM768'));
  p.openssl = opensslVersion('OpenSSL 3.0.13 30 Jan 2024');
  assert.equal(tlsCheck('A', '203.0.113.7', p).verdict, 'NOT MEASURED');
});

test('served certificates: only those that verified reach the ct lookup, each once', () => {
  const ok = tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768')));
  const twin = tlsCheck('A', '203.0.113.8', probe(accepted13('X25519MLKEM768')));
  const bad = tlsCheck('A', '203.0.113.9', probe(accepted13('X25519MLKEM768', '18 (self-signed certificate)')));
  assert.deepEqual(servedCertificates([ok, twin, bad]), [ok.evidence.certificate]);
  assert.deepEqual(servedCertificates([bad]), []);
});

const KEYCHAIN = Buffer.from('<!doctype html><title>bzDiD keychain</title>\n');
const want = {path: 'index.html', ...digests(KEYCHAIN)};
const EVIL = Buffer.from('<!doctype html><title>bzDiD keychain</title><script src=//x></script>\n');

test('bytes: match is PASS; any digest or size mismatch is FAIL with both digests; no answer is NOT MEASURED', () => {
  assert.equal(bytesCheck('/', want, {url: 'u', status: 200, bytes: KEYCHAIN}).verdict, 'PASS');
  const f = bytesCheck('/', want, {url: 'u', status: 200, bytes: EVIL});
  assert.equal(f.verdict, 'FAIL');
  assert.equal(f.evidence.want.sha256, want.sha256); assert.equal(f.evidence.got.sha256, digests(EVIL).sha256);
  assert.match(f.evidence.brief, new RegExp(`want sha256 ${want.sha256}, got ${digests(EVIL).sha256}`));
  assert.equal(bytesCheck('/', {path: 'index.html', sha256: want.sha256}, {url: 'u', status: 200, bytes: EVIL}).verdict, 'FAIL');
  assert.equal(bytesCheck('/', want, {url: 'u', status: 404, bytes: Buffer.alloc(0)}).verdict, 'FAIL');
  assert.equal(bytesCheck('/', want, {url: 'u', status: 301, bytes: Buffer.alloc(0)}).verdict, 'FAIL');
  assert.equal(bytesCheck('/', want, {url: 'u', error: 'ETIMEDOUT'}).verdict, 'NOT MEASURED');
});

test('rollup: one address, many parts: any FAIL is FAIL, PASS only when every part is, nothing judged is NOT MEASURED', () => {
  const P = {name: 'p', verdict: 'PASS', evidence: {brief: 'ok'}}, N = {name: 'n', verdict: 'NOT MEASURED', evidence: {brief: 'lost'}}, F = {name: 'f', verdict: 'FAIL', evidence: {brief: 'bad'}};
  assert.equal(rollup('x', [P, P]).verdict, 'PASS');
  assert.equal(rollup('x', [P, N]).verdict, 'NOT MEASURED');
  const r = rollup('x', [P, N, F]);
  assert.equal(r.verdict, 'FAIL'); assert.equal(r.evidence.brief, 'n: lost; f: bad');
  assert.equal(rollup('x', []).verdict, 'NOT MEASURED');
});

const H = (o = {}) => ({'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache', etag: `"${want.sha256}"`, ...o});
const ok200 = headers => ({url: 'u', status: 200, headers, bytes: KEYCHAIN});

test('serving: contract §4 headers are PASS; the GitHub Pages shape, a wrong type or a near-miss ETag is FAIL', () => {
  assert.equal(headersCheck('/', want, ok200(H())).verdict, 'PASS');
  const pages = headersCheck('/', want, ok200(H({'cache-control': 'max-age=600', etag: 'W/"6a1b2c3d-7af"', 'x-content-type-options': null})));
  assert.equal(pages.verdict, 'FAIL'); assert.match(pages.evidence.brief, /x-content-type-options absent.*cache-control max-age=600.*etag W\//);
  assert.equal(headersCheck('/', want, ok200(H({etag: `"${want.sha256.toUpperCase()}"`}))).verdict, 'FAIL', 'the ETag is the digest exactly');
  assert.equal(headersCheck('/keychain.js', {...want, path: 'keychain.js'}, ok200(H())).verdict, 'FAIL', 'a .js file is text/javascript');
  assert.equal(headersCheck('/keychain.js', {...want, path: 'keychain.js'}, ok200(H({'content-type': 'text/javascript;charset=UTF-8'}))).verdict, 'PASS');
  assert.match(headersCheck('/x.wasm', {...want, path: 'x.wasm'}, ok200(H())).evidence.brief, /no Content-Type in the allowlist/);
  assert.equal(headersCheck('/', want, {url: 'u', status: 404, headers: H(), bytes: Buffer.alloc(0)}).verdict, 'NOT MEASURED');
  assert.equal(headersCheck('/', want, {url: 'u', error: 'ECONNRESET'}).verdict, 'NOT MEASURED');
  assert.equal(statusCheck('OPTIONS /', {url: 'u', status: 405}, 405).verdict, 'PASS');
  assert.equal(statusCheck('OPTIONS /', {url: 'u', status: 200}, 405).verdict, 'FAIL');
  assert.equal(statusCheck('unknown path', {url: 'u', status: 404}, 404).verdict, 'PASS');
  assert.equal(statusCheck('unknown path', {url: 'u', status: 200}, 404).verdict, 'FAIL');
  assert.equal(statusCheck('unknown path', {url: 'u', error: 'ETIMEDOUT'}, 404).verdict, 'NOT MEASURED');
  const bin = {'content-type': 'application/octet-stream'};
  assert.equal(packCheck('pack', digests(KEYCHAIN), {url: 'u', status: 200, headers: bin, bytes: KEYCHAIN}).verdict, 'PASS');
  assert.equal(packCheck('pack', digests(KEYCHAIN), {url: 'u', status: 200, headers: bin, bytes: EVIL}).verdict, 'FAIL');
  assert.equal(packCheck('pack', digests(KEYCHAIN), {url: 'u', status: 200, headers: {'content-type': 'text/html'}, bytes: KEYCHAIN}).verdict, 'FAIL');
  assert.equal(packCheck('pack', digests(KEYCHAIN), {url: 'u', status: 404, headers: bin, bytes: Buffer.alloc(0)}).verdict, 'FAIL');
  assert.equal(packCheck('pack', digests(KEYCHAIN), {url: 'u', error: 'ECONNREFUSED'}).verdict, 'NOT MEASURED');
});

// ---- release records, signed with throwaway keys ----

const K1 = BPQ.keys(randomBytes(32), 'keychain-release-test'), K2 = BPQ.keys(randomBytes(32), 'keychain-release-test');
const sign = (k, bytes) => BPQ.signFile(k, new Uint8Array(bytes), '2026-10-12T22:00:00Z');
const recordOf = (o = {}) => ({files: [want], kind: 'release', origin: ORIGIN, pack: digests(KEYCHAIN), prev: null, rp_id: HOST,
  schema: 'bnr.keychain-release/1', seq: 1, signers: [K2.id],
  source: {build: 'node scripts/build-keychain.mjs --out DIR', commit: 'c0ffee'.padEnd(40, '0'), repo: 'beehive-nature/beehive-nature'}, ...o});
const bytesOf = r => Buffer.from(canon(r), 'latin1');
const R1 = bytesOf(recordOf()), R2 = bytesOf(recordOf({seq: 2, prev: digests(R1).sha3}));
// one insignificant space: printable ASCII, so only the canonical comparison refuses it
const SPACED = Buffer.from(canon(recordOf()).replace('":', '": '));
const PINNED = {pins: [K1.id], law: []};
const EXPECTED = {source: 'the fixture build', files: [want], pack: digests(KEYCHAIN)};

test('record: canonical bytes with exactly the contract fields, or refused', () => {
  assert.equal(readRecord(R1).seq, 1);
  assert.throws(() => readRecord(Buffer.from(JSON.stringify(recordOf(), null, 1))), /not printable ASCII/, 'newlines');
  assert.throws(() => readRecord(SPACED), /not the canonical form/);
  assert.throws(() => readRecord(Buffer.from(canon(recordOf()).replace('"kind"', '"kind":"release","kind"'))), /canonical/, 'a duplicate key');
  assert.throws(() => readRecord(bytesOf(recordOf({unknown: 1}))), /record has fields/);
  assert.throws(() => readRecord(bytesOf(recordOf({origin: 'https://evil.example'}))), /record names/);
  assert.throws(() => readRecord(bytesOf(recordOf({seq: 2}))), /prev at seq 2/);
  assert.throws(() => readRecord(bytesOf(recordOf({files: [{path: '../x', sha256: want.sha256, sha3: want.sha3, size: want.size}]}))), /path/);
  assert.throws(() => readRecord(bytesOf(recordOf({signers: ['bzpq1nope']}))), /signers/);
  assert.throws(() => readRecord(bytesOf(recordOf({source: {...recordOf().source, build: 'node scripts/build-keychain.mjs --out DIR --origin x'}}))), /source/);
  assert.throws(() => readRecord(bytesOf(recordOf({pack: {...digests(KEYCHAIN), size: 1}}))), /pack/);
});

const ok = (bytes, sig, o = {}, headers = {'content-type': 'application/json'}) => ({url: 'u', status: 200, headers,
  bytes: Buffer.from(JSON.stringify({bnr: 'keychain-release-envelope/1', hints: {}, record: bytes.toString('base64url'), sig, ...o}))});
const WK = 'well-known A 203.0.113.7';

test('well-known: PASS only for a verified, authorized envelope whose files and pack are the expectation', () => {
  const p = wellKnownCheck(WK, ok(R1, sign(K1, R1)), {expected: EXPECTED, auth: PINNED});
  assert.equal(p.verdict, 'PASS'); assert.equal(p.evidence.signer, K1.id); assert.match(p.evidence.brief, /verified here, authorized by the pinned release signers/);
  const hinted = {ant: 'ant:abc', ar: ['A'.repeat(43)], hive: {block: 108404167, trx: 'ab'.repeat(20)}, peers: ['https://peer.example/']};
  assert.equal(wellKnownCheck(WK, ok(R1, sign(K1, R1), {hints: hinted}), {expected: EXPECTED, auth: PINNED}).verdict, 'PASS');
});

test('well-known: the review fixture (sig {}, seq 999, an unknown field, files [evil.js]) is FAIL, and so is each of its defects alone', () => {
  const review = Buffer.from(JSON.stringify({...recordOf({seq: 999, prev: digests(R1).sha3, files: [{path: 'evil.js'}]}), unknown: 1}));
  assert.equal(wellKnownCheck(WK, ok(review, {}), {expected: EXPECTED, auth: PINNED}).verdict, 'FAIL');
  const ctx = {expected: EXPECTED, auth: PINNED};
  const fail = (got, re) => { const c = wellKnownCheck(WK, got, ctx); assert.equal(c.verdict, 'FAIL', re.source); assert.match(c.evidence.brief, re); };
  fail(ok(R1, {}), /signature has fields/);
  fail(ok(R1, {...sign(K1, R1), kind: 'binding'}), /not a SPEC-BPQ-1/);
  fail(ok(R1, sign(K1, R2)), /signature: this is not the file that was signed/);
  const unknown = bytesOf(recordOf({unknown: 1}));
  fail(ok(unknown, sign(K1, unknown)), /record has fields/);
  fail(ok(SPACED, sign(K1, SPACED)), /not the canonical form/);
  const evil = bytesOf(recordOf({files: [{path: 'evil.js', ...digests(EVIL)}], pack: digests(EVIL)}));
  fail(ok(evil, sign(K1, evil)), /its files are not the files of the fixture build/);
  fail(ok(R1, sign(K2, R1)), /not an id the repository authorizes for seq 1/);
  const far = bytesOf(recordOf({seq: 999, prev: digests(R1).sha3}));
  assert.match(wellKnownCheck(WK, ok(far, sign(K1, far)), ctx).evidence.brief, /seq 999 is authorized only through every record before it/);
  assert.equal(wellKnownCheck(WK, ok(far, sign(K1, far)), ctx).verdict, 'NOT MEASURED');
});

test('well-known: no pinned signer and no committed record authorizes nothing; the law key never; the envelope is exact', () => {
  const nm = wellKnownCheck(WK, ok(R1, sign(K1, R1)), {expected: EXPECTED, auth: {pins: [], law: []}});
  assert.equal(nm.verdict, 'NOT MEASURED'); assert.match(nm.evidence.brief, /pins no release signer \(R-SIGNER\)/);
  assert.match(wellKnownCheck(WK, ok(R1, sign(K1, R1)), {expected: EXPECTED, auth: {pins: [K1.id], law: [K1.id]}}).evidence.brief, /law key/);
  const ctx = {expected: EXPECTED, auth: PINNED};
  for (const [got, why] of [
    [ok(R1, sign(K1, R1), {extra: 1}), 'an unknown envelope field'],
    [ok(R1, sign(K1, R1), {hints: {pad: 'x'}}), 'an unknown hint'],
    [ok(R1, sign(K1, R1), {hints: {peers: ['http://plain.example']}}), 'a peer that is not https'],
    [ok(R1, sign(K1, R1), {bnr: 'other/1'}), 'another envelope kind'],
    [ok(R1, sign(K1, R1), {record: 'abc!'}), 'a record that is not base64url'],
    [ok(R1, sign(K1, R1), {}, {'content-type': 'text/html'}), 'not application/json'],
    [ok(R1, sign(K1, R1), {hints: {peers: Array(1200).fill('https://peer.example/padding-padding-padding-padding-padding')}}), 'over 64 KiB'],
    [{url: 'u', status: 200, headers: {'content-type': 'application/json'}, bytes: Buffer.from('{')}, 'not JSON'],
    [{url: 'u', status: 503, headers: {}, bytes: Buffer.alloc(0)}, 'HTTP 503'],
  ]) assert.equal(wellKnownCheck(WK, got, ctx).verdict, 'FAIL', why);
  assert.equal(wellKnownCheck(WK, {url: 'u', error: 'ECONNRESET'}, ctx).verdict, 'NOT MEASURED');
  assert.equal(wellKnownCheck(WK, ok(R1, sign(K1, R1)), {auth: PINNED}).verdict, 'NOT MEASURED', 'no expectation to hold its files to');
});

test('well-known: absent is NOT MEASURED only while both resolvers name GitHub Pages, whatever Server header the edge sends', () => {
  const absent = server => ({url: 'u', status: 404, headers: {server}, bytes: Buffer.alloc(0)});
  assert.equal(wellKnownCheck(WK, absent('GitHub.com'), {pages: true}).verdict, 'NOT MEASURED');
  assert.equal(wellKnownCheck(WK, absent('GitHub.com'), {pages: false}).verdict, 'FAIL', 'the edge cannot exempt itself by its Server header');
  assert.equal(wellKnownCheck(WK, absent('Caddy'), {pages: false}).verdict, 'FAIL');
  assert.equal(wellKnownCheck(WK, absent('Caddy'), {pages: null}).verdict, 'NOT MEASURED');
});

// committed records in a scratch keychain/releases
const commit = (dir, name, bytes, sig) => {
  mkdirSync(join(dir, name), {recursive: true});
  writeFileSync(join(dir, name, 'record.json'), bytes);
  if (sig) writeFileSync(join(dir, name, 'record.json.relsig.json'), JSON.stringify(sig, null, 1) + '\n');
};
const scratch = fn => { const dir = mkdtempSync(join(tmpdir(), 'kc-probe-test-')); try { fn(dir); } finally { rmSync(dir, {recursive: true, force: true}); } };

test('expectation: committed records are a verified chain from the pinned signer, or no expectation at all', () => scratch(dir => {
  assert.equal(expectedFromRecords(join(dir, 'absent'), PINNED), null);
  assert.equal(expectedFromRecords(dir, PINNED), null);
  commit(dir, '0001', R1, sign(K1, R1));
  commit(dir, '0002', R2, sign(K2, R2));
  const e = expectedFromRecords(dir, PINNED);
  assert.equal(e.seq, 2); assert.deepEqual(e.files, [want]); assert.deepEqual(e.pack, digests(KEYCHAIN));
  assert.match(e.source, /record seq 2 \(keychain\/releases\/0002\/record\.json\)/);
  assert.deepEqual(e.chain.map(c => [c.seq, c.sha3]), [[1, digests(R1).sha3], [2, digests(R2).sha3]]);
  assert.throws(() => expectedFromRecords(dir, {pins: [], law: []}), /0001\/record\.json: signed by .* not an id the repository authorizes for seq 1/);
  assert.throws(() => expectedFromRecords(dir, {pins: [K1.id], law: [K1.id]}), /seq 1/);
  commit(dir, '0002', R2, sign(K1, R2));
  assert.throws(() => expectedFromRecords(dir, PINNED), /0002\/record\.json: signed by .* not an id the repository authorizes for seq 2/);
  rmSync(join(dir, '0002', 'record.json.relsig.json'));
  assert.throws(() => expectedFromRecords(dir, PINNED), /no record\.json\.relsig\.json beside it/);
}));

test('expectation: a gap, a repeat anywhere, a broken prev or a non-canonical record refuses the whole expectation', () => scratch(dir => {
  commit(dir, '0001', R1, sign(K1, R1));
  const R3 = bytesOf(recordOf({seq: 3, prev: digests(R2).sha3}));
  commit(dir, '0003', R3, sign(K2, R3));
  assert.throws(() => expectedFromRecords(dir, PINNED), /not seq 1\.\.2 with no gap or repeat/);
  rmSync(join(dir, '0003'), {recursive: true});
  commit(dir, '0002', R2, sign(K2, R2));
  const R1b = bytesOf(recordOf({signers: [K1.id, K2.id].sort()}));
  commit(dir, '0001b', R1b, sign(K1, R1b));
  assert.throws(() => expectedFromRecords(dir, PINNED), /no gap or repeat/, 'a repeated seq below the top');
  rmSync(join(dir, '0001b'), {recursive: true});
  const R2x = bytesOf(recordOf({seq: 2, prev: digests(R1b).sha3}));
  commit(dir, '0002', R2x, sign(K2, R2x));
  assert.throws(() => expectedFromRecords(dir, PINNED), /prev does not name the committed seq 1/);
  commit(dir, '0001', SPACED, sign(K1, SPACED));
  assert.throws(() => expectedFromRecords(dir, PINNED), /0001\/record\.json: record bytes are not the canonical form/);
  // a second spelling of the same 32 bytes (non-zero padding bits in the last character)
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', alias = want.sha256.slice(0, 42) + A[A.indexOf(want.sha256[42]) ^ 1];
  assert.deepEqual(Buffer.from(alias, 'base64url'), Buffer.from(want.sha256, 'base64url'));
  const aliased = bytesOf(recordOf({files: [{...want, sha256: alias}]}));
  commit(dir, '0001', aliased, sign(K1, aliased));
  assert.throws(() => expectedFromRecords(dir, PINNED), /digests/);
}));

test('well-known: against committed records the edge serves exactly the top one', () => scratch(dir => {
  commit(dir, '0001', R1, sign(K1, R1));
  commit(dir, '0002', R2, sign(K2, R2));
  const expected = expectedFromRecords(dir, PINNED), ctx = {expected, auth: PINNED};
  const p = wellKnownCheck(WK, ok(R2, sign(K2, R2)), ctx);
  assert.equal(p.verdict, 'PASS'); assert.match(p.evidence.brief, /authorized by committed seq 1/);
  assert.match(wellKnownCheck(WK, ok(R1, sign(K1, R1)), ctx).evidence.brief, /older than the committed seq 2/);
  const fork = bytesOf(recordOf({seq: 2, prev: digests(R1).sha3, files: [{path: 'index.html', ...digests(EVIL)}], pack: digests(EVIL)}));
  assert.match(wellKnownCheck(WK, ok(fork, sign(K2, fork)), ctx).evidence.brief, /not the committed record of that seq/);
  const R3 = bytesOf(recordOf({seq: 3, prev: digests(R2).sha3}));
  assert.equal(wellKnownCheck(WK, ok(R3, sign(K2, R3)), ctx).verdict, 'NOT MEASURED');
}));

test('expectation: the build stands for HEAD only when every input is its blob byte for byte', () => scratch(dir => {
  const git = (...a) => execFileSync('git', ['-c', 'core.autocrlf=false', ...a], {cwd: dir, encoding: 'utf8'}).trim();
  git('init', '-q');
  for (const [p, s] of [['scripts/build-keychain.mjs', '// build\n'], ['keychain/index.html', '<!doctype html>\n'], ['surfaces/onboarding/x.js', 'x\n'], ['unrelated.txt', 'u\n']]) {
    mkdirSync(dirname(join(dir, p)), {recursive: true}); writeFileSync(join(dir, p), s);
  }
  git('add', '-A');
  const tree = git('write-tree');
  assert.deepEqual(inputsChanged(dir, tree), []);
  writeFileSync(join(dir, 'unrelated.txt'), 'changed\n');
  assert.deepEqual(inputsChanged(dir, tree), [], 'a path outside the inputs does not count');
  writeFileSync(join(dir, 'keychain/index.html'), '<!doctype html>\r\n');
  assert.deepEqual(inputsChanged(dir, tree), ['keychain/index.html'], 'a CRLF re-ending is a change');
  rmSync(join(dir, 'surfaces/onboarding/x.js'));
  assert.deepEqual(inputsChanged(dir, tree), ['surfaces/onboarding/x.js', 'keychain/index.html']);
}));

const google = {
  A: {status: 0, answer: normAnswer([{name: 'keys.skaists.dev.', type: 5, TTL: 1799, data: 'beehive-nature.github.io.'}, {name: 'beehive-nature.github.io.', type: 1, TTL: 3600, data: '203.0.113.8'}, {name: 'beehive-nature.github.io.', type: 1, TTL: 3600, data: '203.0.113.7'}])},
  AAAA: {status: 0, answer: normAnswer([{name: 'keys.skaists.dev.', type: 5, data: 'beehive-nature.github.io.'}, {name: 'beehive-nature.github.io.', type: 28, data: '2001:db8::7'}])},
  CNAME: {status: 0, answer: normAnswer([{name: 'keys.skaists.dev.', type: 5, data: 'beehive-nature.github.io.'}])},
  CAA: {status: 0, answer: normAnswer([{name: 'keys.skaists.dev.', type: 5, data: 'beehive-nature.github.io.'}, {name: 'beehive-nature.github.io.', type: 257, data: '0 issue "letsencrypt.org"'}])},
};
// the same answers, the way cloudflare-dns.com spells them: no trailing dot on names, other order, other TTLs
const cloudflare = {
  A: {status: 0, answer: normAnswer([{name: 'beehive-nature.github.io', type: 1, TTL: 60, data: '203.0.113.7'}, {name: 'beehive-nature.github.io', type: 1, TTL: 60, data: '203.0.113.8'}, {name: 'keys.skaists.dev', type: 5, TTL: 60, data: 'beehive-nature.github.io.'}])},
  AAAA: {status: 0, answer: normAnswer([{name: 'keys.skaists.dev', type: 5, data: 'beehive-nature.github.io.'}, {name: 'beehive-nature.github.io', type: 28, data: '2001:db8::7'}])},
  CNAME: {status: 0, answer: normAnswer([{name: 'keys.skaists.dev', type: 5, data: 'beehive-nature.github.io.'}])},
  CAA: {status: 0, answer: normAnswer([{name: 'beehive-nature.github.io', type: 257, data: '0 issue "letsencrypt.org"'}, {name: 'keys.skaists.dev', type: 5, data: 'beehive-nature.github.io.'}])},
};

test('dns: agreement is PASS across spelling, order and TTL; disagreement is FAIL; a lost answer is NOT MEASURED', () => {
  const ok2 = dnsCheck({'dns.google': google, 'cloudflare-dns.com': cloudflare});
  assert.equal(ok2.verdict, 'PASS');
  assert.match(ok2.evidence.brief, /CNAME beehive-nature\.github\.io; A 2; AAAA 1; CAA 1/);
  const moved = {...cloudflare, A: {status: 0, answer: normAnswer([{name: 'keys.skaists.dev', type: 1, data: '198.51.100.9'}])}};
  const f = dnsCheck({'dns.google': google, 'cloudflare-dns.com': moved});
  assert.equal(f.verdict, 'FAIL'); assert.match(f.evidence.brief, /disagree on A$/);
  // the same records under a different status (SERVFAIL) is still a disagreement
  assert.equal(dnsCheck({'dns.google': google, 'cloudflare-dns.com': {...cloudflare, CAA: {...cloudflare.CAA, status: 2}}}).verdict, 'FAIL');
  assert.equal(dnsCheck({'dns.google': google, 'cloudflare-dns.com': {...cloudflare, AAAA: {error: 'ETIMEDOUT'}}}).verdict, 'NOT MEASURED');
  assert.deepEqual(addresses({'dns.google': google, 'cloudflare-dns.com': moved}), {A: ['198.51.100.9', '203.0.113.7', '203.0.113.8'], AAAA: ['2001:db8::7']});
});

test('pages: decided by both resolvers (GitHub\'s published addresses, a *.github.io CNAME), never by the edge', () => {
  const at = (cname, a, aaaa) => ({
    A: {status: 0, answer: normAnswer([...(cname ? [{name: HOST, type: 5, data: cname}] : []), ...a.map(x => ({name: cname || HOST, type: 1, data: x}))])},
    AAAA: {status: 0, answer: normAnswer([...(cname ? [{name: HOST, type: 5, data: cname}] : []), ...aaaa.map(x => ({name: cname || HOST, type: 28, data: x}))])},
    CNAME: {status: 0, answer: normAnswer(cname ? [{name: HOST, type: 5, data: cname}] : [])},
    CAA: {status: 0, answer: []},
  });
  const both = r => ({'dns.google': r, 'cloudflare-dns.com': r});
  assert.equal(pagesFromDns(both(at('beehive-nature.github.io.', PAGES.A, PAGES.AAAA))), true);
  assert.equal(pagesFromDns(both(at('', PAGES.A.slice(0, 2), []))), true, 'an apex on Pages addresses');
  assert.equal(pagesFromDns(both(at('edge.example.', PAGES.A, []))), false, 'a CNAME elsewhere');
  assert.equal(pagesFromDns(both(at('beehive-nature.github.io.', [...PAGES.A, '198.51.100.9'], []))), false, 'one address off Pages');
  assert.equal(pagesFromDns({'dns.google': google, 'cloudflare-dns.com': cloudflare}), false, 'the documentation addresses are not Pages');
  assert.equal(pagesFromDns({'dns.google': at('beehive-nature.github.io.', PAGES.A, []), 'cloudflare-dns.com': at('beehive-nature.github.io.', PAGES.A.slice(1), [])}), null, 'disagreement settles nothing');
});

const NOW = Date.parse('2026-10-12T22:00:00Z');
const LE = "C=US, O=Let's Encrypt, CN=YR2";
const le = (serial, nb, na, issuer = LE) => ({issuer_name: issuer, serial_number: serial, not_before: nb, not_after: na});
const served = (serial = 'a1b2c3d', issuer = LE) => [{serial, issuer}];

test('ct: the served certificate must be listed under its serial AND issuer; a precertificate and its certificate count once', () => {
  const entries = [le('00a1b2c3d', '2026-10-12T18:58:19', '2027-01-10T18:58:18'), le('0a1b2c3d', '2026-10-12T18:58:19', '2027-01-10T18:58:18')];
  const p = ctCheck({entries}, served(), NOW);
  assert.equal(p.verdict, 'PASS'); assert.equal(p.evidence.certificates.length, 1); assert.deepEqual(p.evidence.notes, []);
  // Node prints an issuer one attribute per line; crt.sh joins with commas
  assert.equal(ctCheck({entries}, served('a1b2c3d', "C=US\nO=Let's Encrypt\nCN=YR2"), NOW).verdict, 'PASS');
  // the review fixture: a self-signed certificate that copies a logged Let's Encrypt serial
  const copy = ctCheck({entries}, [certFacts(PEM)], NOW);
  assert.equal(copy.verdict, 'NOT MEASURED'); assert.match(copy.evidence.brief, /serial a1b2c3d from O=Probe Fixture, CN=keys\.skaists\.dev not \(yet\) listed/);
  // crt.sh lags issuance: not listed yet is not a measurement
  assert.equal(ctCheck({entries: []}, served(), NOW).verdict, 'NOT MEASURED');
  assert.equal(ctCheck({entries}, [], NOW).verdict, 'NOT MEASURED');
  assert.equal(ctCheck({error: 'HTTP 502'}, served(), NOW).verdict, 'NOT MEASURED');
});

test('ct: an unknown issuer and a second valid certificate are noted, never fatal', () => {
  const entries = [le('0a1b2c3d', '2026-10-12T18:58:19', '2027-01-10T18:58:18'),
    le('77', '2026-10-01T00:00:00', '2026-12-30T00:00:00', 'C=XX, O=Elsewhere CA, CN=E1')];
  const c = ctCheck({entries}, served(), NOW);
  assert.equal(c.verdict, 'PASS');
  assert.equal(c.evidence.notes.length, 2);
  assert.match(c.evidence.brief, /unknown issuer C=XX, O=Elsewhere CA, CN=E1 \(serial 77\); 2 certificates valid now/);
});

// ---- the gate: green only when everything was measured and passed ----

const A1 = 'A 203.0.113.7';
const receipt = (checks, addrs = {A: ['203.0.113.7'], AAAA: []}) => ({schema: SCHEMA, at: '2026-10-12T22:00:00.000Z', vantage: 'fixture', addresses: addrs, checks});
const every = (verdict, a = A1) => ['dns', `tls ${a}`, `bytes ${a}`, `serving ${a}`, `well-known ${a}`, 'ct'].map(name => ({name, verdict, evidence: {brief: verdict}}));

test('overall: an edge that is down (dns PASS, the rest NOT MEASURED) is not green; PASS needs every check present and PASS', () => {
  const down = every('NOT MEASURED').map(c => (c.name === 'dns' ? {...c, verdict: 'PASS'} : c));
  assert.deepEqual([overall(receipt(down)).verdict, overall(receipt(down)).exit], ['NOT MEASURED', 2]);
  assert.deepEqual([overall(receipt(every('PASS'))).verdict, overall(receipt(every('PASS'))).exit], ['PASS', 0]);
  const failed = every('PASS').map(c => (c.name === 'ct' ? {...c, verdict: 'FAIL'} : c));
  assert.deepEqual([overall(receipt(failed)).verdict, overall(receipt(failed)).exit], ['FAIL', 1]);
  const gap = overall(receipt(every('PASS').filter(c => !c.name.startsWith('serving'))));
  assert.equal(gap.exit, 2); assert.match(gap.why, /missing: serving A 203\.0\.113\.7/);
  assert.equal(overall(receipt(every('PASS'), {A: ['203.0.113.7'], AAAA: ['2001:db8::7']})).exit, 2, 'an address with no checks');
  assert.equal(overall(receipt(every('PASS').filter(c => c.name === 'dns' || c.name === 'ct'), {A: [], AAAA: []})).exit, 2, 'no address at all');
  assert.equal(overall(receipt(every('PASS').map(c => (c.name === 'dns' ? {...c, verdict: 'pass'} : c)))).exit, 2, 'a verdict outside the three');
  assert.equal(overall({...receipt(every('PASS')), addresses: undefined}).exit, 2, 'a receipt that names no addresses');
});

test('summary: counts and the overall verdict derive from the checks; a foreign schema is refused', () => {
  const r = receipt([{name: 'bytes /', verdict: 'PASS', evidence: {brief: 'a | b'}}, {name: 'dns', verdict: 'FAIL', evidence: {brief: 'x'}},
    {name: 'ct', verdict: 'NOT MEASURED', evidence: {brief: 'y\nz'}}]);
  const s = summary(r);
  assert.match(s, /\*\*overall: FAIL\*\* \(1 FAIL\)/);
  assert.match(s, /PASS 1 · FAIL 1 · NOT MEASURED 1/);
  assert.match(s, /\| bytes \/ \| PASS \| a \\\| b \|/);
  assert.match(s, /\| ct \| NOT MEASURED \| y z \|/);
  assert.throws(() => summary({...r, schema: 'other/1'}), /not a bnr\.keychain-edge-receipt\/1/);
});

test('summary CLI (the workflow gate): exit 0 only for an all-PASS receipt, 1 for any FAIL, 2 for anything not measured', () => scratch(dir => {
  const gate = r => { const f = join(dir, 'r.json'); writeFileSync(f, JSON.stringify(r)); return spawnSync(process.execPath, [PROBE, 'summary', f], {encoding: 'utf8'}); };
  const green = gate(receipt(every('PASS')));
  assert.equal(green.status, 0, green.stderr); assert.match(green.stdout, /\*\*overall: PASS\*\*/);
  assert.equal(gate(receipt(every('PASS').map(c => (c.name === 'dns' ? {...c, verdict: 'FAIL'} : c)))).status, 1);
  assert.equal(gate(receipt(every('NOT MEASURED').map(c => (c.name === 'dns' ? {...c, verdict: 'PASS'} : c)))).status, 2);
  assert.equal(gate(receipt(every('PASS').slice(0, 1))).status, 2);
}));
