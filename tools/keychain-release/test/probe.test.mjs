// The prober must not be able to call the edge green on evidence it did not observe. Every
// fixture below is a way the edge, the path or the probe itself can mislead; no network is used.
//   node --test tools/keychain-release/test/probe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  SCHEMA, CONTROL, CLASSICAL, classify, tlsCheck, opensslVersion, certFacts, bytesCheck, digests,
  expectedFromRecords, dnsCheck, normAnswer, addresses, ctCheck, wellKnownCheck, summary,
} from '../probe.mjs';

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
const accepted13 = group => ({code: 0, stderr: 'Connecting to 203.0.113.7\ndepth=0 CN=keys.skaists.dev\nverify return:1\nDONE\n', stdout:
  `CONNECTED(00000164)\n---\nServer certificate\n${PEM}\nsubject=CN=keys.skaists.dev\n---\nPeer signature type: ecdsa_secp256r1_sha256\n` +
  (group.startsWith('X25519MLKEM') ? `Negotiated TLS1.3 group: ${group}\n` : `Peer Temp Key: ${group}, 253 bits\n`) +
  '---\nVerification: OK\n---\nNew, TLSv1.3, Cipher is TLS_AES_128_GCM_SHA256\nProtocol: TLSv1.3\nVerify return code: 0 (ok)\n'});
const accepted12 = {code: 0, stderr: 'DONE\n', stdout: `CONNECTED(00000160)\nServer certificate\n${PEM}\nPeer Temp Key: X25519, 253 bits\n---\nNew, TLSv1.2, Cipher is ECDHE-ECDSA-CHACHA20-POLY1305\nProtocol: TLSv1.2\nVerify return code: 0 (ok)\n`};
const refused = {code: 1, stdout: 'CONNECTED(00000003)\n---\nno peer certificate available\nNegotiated TLS1.3 group: <NULL>\n---\nNew, (NONE), Cipher is (NONE)\n',
  stderr: 'Connecting to 203.0.113.7\n40F7:error:0A000410:SSL routines::ssl/tls alert handshake failure:../ssl/record/rec_layer_s3.c:916:SSL alert number 40\n'};
const closed = {code: 1, stdout: 'CONNECTED(00000164)\nNegotiated TLS1.3 group: <NULL>\nNew, (NONE), Cipher is (NONE)\nProtocol: TLSv1.3\n',
  stderr: 'Connecting to 203.0.113.7\n687B0000:error:0A000126:SSL routines::unexpected eof while reading:../openssl-3.5.7/ssl/record/rec_layer_s3.c:698:\n'};
const noConnect = {code: 1, stdout: '', stderr: '10460000:error:80002743:system library:BIO_connect:Unknown error:../crypto/bio/bio_sock2.c:183:calling connect()\nconnect:errno=0\n'};

const V35 = opensslVersion('OpenSSL 3.5.7 9 Jun 2026 (Library: OpenSSL 3.5.7 9 Jun 2026)');
const probe = (control, ...classical) => ({via: 'fixture', openssl: V35,
  control: {args: CONTROL, ...classify(control)}, classical: CLASSICAL.map((args, i) => ({args, ...classify(classical[i])}))});

test('classify: each s_client outcome, CRLF output included', () => {
  const c = classify(accepted13('X25519MLKEM768'));
  assert.equal(c.outcome, 'accepted'); assert.equal(c.group, 'X25519MLKEM768'); assert.equal(c.protocol, 'TLSv1.3'); assert.equal(c.verify, '0 (ok)');
  assert.ok(c.pem.startsWith('-----BEGIN CERTIFICATE-----'));
  const crlf = accepted13('X25519MLKEM768'); crlf.stdout = crlf.stdout.replace(/\n/g, '\r\n');
  assert.equal(classify(crlf).group, 'X25519MLKEM768');
  assert.deepEqual([classify(accepted13('X25519')).group, classify(accepted12).protocol, classify(accepted12).group], ['X25519', 'TLSv1.2', 'X25519']);
  assert.equal(classify(accepted13('ECDH, prime256v1')).group, 'prime256v1');
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

test('tls: PASS only when the control completes on X25519MLKEM768 and all three classical probes are refused by alert', () => {
  const pass = tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), refused, refused, refused));
  assert.equal(pass.verdict, 'PASS');
  assert.equal(pass.evidence.certificate.key, 'EC prime256v1');
  assert.equal(pass.evidence.control.pem, undefined, 'raw certificate text stays out of the receipt');
});

test('tls: any classical acceptance is FAIL (the GitHub Pages shape today)', () => {
  for (const which of [0, 1, 2]) {
    const cl = [refused, refused, refused]; cl[which] = which === 2 ? accepted12 : accepted13('X25519');
    const c = tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), ...cl));
    assert.equal(c.verdict, 'FAIL', `classical probe ${which}`);
    assert.match(c.evidence.brief, /classical accepted/);
  }
});

test('tls: a failed control is NOT MEASURED even when classical probes answered', () => {
  for (const control of [noConnect, closed, refused, {timedOut: true}]) {
    assert.equal(tlsCheck('AAAA', '2001:db8::7', probe(control, accepted13('X25519'), accepted13('X25519'), accepted12)).verdict, 'NOT MEASURED');
  }
  // control "accepted" on a group it never offered: the probe is broken, not the edge
  assert.equal(tlsCheck('A', '203.0.113.7', probe(accepted13('X25519'), refused, refused, refused)).verdict, 'NOT MEASURED');
});

test('tls: a classical close without an alert, or a connect error, is not a refusal', () => {
  assert.equal(tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), refused, closed, refused)).verdict, 'NOT MEASURED');
  assert.equal(tlsCheck('A', '203.0.113.7', probe(accepted13('X25519MLKEM768'), noConnect, noConnect, noConnect)).verdict, 'NOT MEASURED');
});

test('tls: OpenSSL older than 3.5 is NOT MEASURED whatever it printed', () => {
  const p = probe(accepted13('X25519MLKEM768'), refused, refused, refused);
  p.openssl = opensslVersion('OpenSSL 3.0.13 30 Jan 2024');
  assert.equal(tlsCheck('A', '203.0.113.7', p).verdict, 'NOT MEASURED');
});

const KEYCHAIN = Buffer.from('<!doctype html><title>bzDiD keychain</title>\n');
const want = {path: 'index.html', ...digests(KEYCHAIN)};

test('bytes: match is PASS; any digest or size mismatch is FAIL with both digests; no answer is NOT MEASURED', () => {
  assert.equal(bytesCheck('bytes /', want, {url: 'u', status: 200, bytes: KEYCHAIN}, 's').verdict, 'PASS');
  const evil = Buffer.from('<!doctype html><title>bzDiD keychain</title><script src=//x></script>\n');
  const f = bytesCheck('bytes /', want, {url: 'u', status: 200, bytes: evil}, 's');
  assert.equal(f.verdict, 'FAIL');
  assert.equal(f.evidence.want.sha256, want.sha256); assert.equal(f.evidence.got.sha256, digests(evil).sha256);
  assert.match(f.evidence.brief, new RegExp(`want sha256 ${want.sha256}, got ${digests(evil).sha256}`));
  assert.equal(bytesCheck('bytes /', {path: 'index.html', sha256: want.sha256}, {url: 'u', status: 200, bytes: evil}, 's').verdict, 'FAIL');
  assert.equal(bytesCheck('bytes /', want, {url: 'u', status: 404, bytes: Buffer.alloc(0)}, 's').verdict, 'FAIL');
  assert.equal(bytesCheck('bytes /', want, {url: 'u', status: 301, bytes: Buffer.alloc(0)}, 's').verdict, 'FAIL');
  assert.equal(bytesCheck('bytes /', want, {url: 'u', error: 'ETIMEDOUT'}, 's').verdict, 'NOT MEASURED');
});

test('expectation: the highest-seq committed record wins; its digests must be canonical base64url', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kc-probe-test-'));
  try {
    assert.equal(expectedFromRecords(join(dir, 'absent')), null);
    const rec = (d, seq, files) => { mkdirSync(join(dir, d), {recursive: true}); writeFileSync(join(dir, d, 'record.json'), JSON.stringify({seq, files})); };
    const other = {path: 'keychain.js', ...digests(Buffer.from('kc'))};
    rec('0001', 1, [other]);
    rec('0002', 2, [want, other]);
    const e = expectedFromRecords(dir);
    assert.equal(e.seq, 2);
    assert.deepEqual(e.files, [want, other]);
    assert.match(e.source, /record seq 2 \(keychain\/releases\/0002\/record\.json\)/);
    assert.match(e.recordSha3, /^[A-Za-z0-9_-]{43}$/);
    rec('0003', 2, [want]);
    assert.throws(() => expectedFromRecords(dir), /two committed records share seq 2/);
    rmSync(join(dir, '0003'), {recursive: true});
    rec('0004', 4, [{...want, sha256: 'ab'.repeat(16)}]);
    assert.throws(() => expectedFromRecords(dir), /bad digest/);
    // a second spelling of the same 32 bytes (non-zero padding bits in the last character)
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', last = A.indexOf(want.sha256[42]);
    const alias = want.sha256.slice(0, 42) + A[last ^ 1];
    assert.deepEqual(Buffer.from(alias, 'base64url'), Buffer.from(want.sha256, 'base64url'));
    rec('0004', 4, [{...want, sha256: alias}]);
    assert.throws(() => expectedFromRecords(dir), /bad digest/);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

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
  const ok = dnsCheck({'dns.google': google, 'cloudflare-dns.com': cloudflare});
  assert.equal(ok.verdict, 'PASS');
  assert.match(ok.evidence.brief, /CNAME beehive-nature\.github\.io; A 2; AAAA 1; CAA 1/);
  const moved = {...cloudflare, A: {status: 0, answer: normAnswer([{name: 'keys.skaists.dev', type: 1, data: '198.51.100.9'}])}};
  const f = dnsCheck({'dns.google': google, 'cloudflare-dns.com': moved});
  assert.equal(f.verdict, 'FAIL'); assert.match(f.evidence.brief, /disagree on A$/);
  // the same records under a different status (SERVFAIL) is still a disagreement
  assert.equal(dnsCheck({'dns.google': google, 'cloudflare-dns.com': {...cloudflare, CAA: {...cloudflare.CAA, status: 2}}}).verdict, 'FAIL');
  assert.equal(dnsCheck({'dns.google': google, 'cloudflare-dns.com': {...cloudflare, AAAA: {error: 'ETIMEDOUT'}}}).verdict, 'NOT MEASURED');
  assert.deepEqual(addresses({'dns.google': google, 'cloudflare-dns.com': moved}), {A: ['198.51.100.9', '203.0.113.7', '203.0.113.8'], AAAA: ['2001:db8::7']});
});

const NOW = Date.parse('2026-10-12T22:00:00Z');
const le = (serial, nb, na, issuer = "C=US, O=Let's Encrypt, CN=YR2") => ({issuer_name: issuer, serial_number: serial, not_before: nb, not_after: na});

test('ct: the served certificate must be listed; a precertificate and its certificate count once', () => {
  const entries = [le('00a1b2c3d', '2026-10-12T18:58:19', '2027-01-10T18:58:18'), le('0a1b2c3d', '2026-10-12T18:58:19', '2027-01-10T18:58:18')];
  const p = ctCheck({entries}, ['a1b2c3d'], NOW);
  assert.equal(p.verdict, 'PASS'); assert.equal(p.evidence.certificates.length, 1); assert.deepEqual(p.evidence.notes, []);
  // crt.sh lags issuance: not listed yet is not a measurement
  assert.equal(ctCheck({entries: []}, ['a1b2c3d'], NOW).verdict, 'NOT MEASURED');
  assert.equal(ctCheck({entries}, [], NOW).verdict, 'NOT MEASURED');
  assert.equal(ctCheck({error: 'HTTP 502'}, ['a1b2c3d'], NOW).verdict, 'NOT MEASURED');
});

test('ct: an unknown issuer and a second valid certificate are noted, never fatal', () => {
  const entries = [le('0a1b2c3d', '2026-10-12T18:58:19', '2027-01-10T18:58:18'),
    le('77', '2026-10-01T00:00:00', '2026-12-30T00:00:00', 'C=XX, O=Elsewhere CA, CN=E1')];
  const c = ctCheck({entries}, ['a1b2c3d'], NOW);
  assert.equal(c.verdict, 'PASS');
  assert.equal(c.evidence.notes.length, 2);
  assert.match(c.evidence.brief, /unknown issuer C=XX, O=Elsewhere CA, CN=E1 \(serial 77\); 2 certificates valid now/);
});

const record = (o = {}) => Buffer.from(JSON.stringify({files: [], kind: 'release', origin: 'https://keys.skaists.dev', rp_id: 'keys.skaists.dev', schema: 'bnr.keychain-release/1', seq: 3, ...o}));
const envelope = (rec, o = {}) => ({url: 'u', status: 200, server: 'Caddy', bytes: Buffer.from(JSON.stringify({bnr: 'keychain-release-envelope/1', hints: {}, record: rec.toString('base64url'), sig: {kind: 'detached'}, ...o}))});

test('well-known: absent is NOT MEASURED only while GitHub Pages answers; anywhere else it is FAIL', () => {
  assert.equal(wellKnownCheck({url: 'u', status: 404, server: 'GitHub.com', bytes: Buffer.alloc(0)}).verdict, 'NOT MEASURED');
  assert.equal(wellKnownCheck({url: 'u', status: 404, server: 'Caddy', bytes: Buffer.alloc(0)}).verdict, 'FAIL');
  assert.equal(wellKnownCheck({url: 'u', status: 503, server: 'Caddy', bytes: Buffer.alloc(0)}).verdict, 'FAIL');
  assert.equal(wellKnownCheck({url: 'u', error: 'ECONNRESET'}).verdict, 'NOT MEASURED');
});

test('well-known: a well-formed envelope is PASS (signature named as unverified); malformed, older or equivocating is FAIL', () => {
  const rec = record();
  const p = wellKnownCheck(envelope(rec));
  assert.equal(p.verdict, 'PASS'); assert.equal(p.evidence.seq, 3); assert.equal(p.evidence.signature, 'not verified by this probe');
  assert.equal(wellKnownCheck(envelope(rec), {seq: 3, recordSha3: digests(rec).sha3}).verdict, 'PASS');
  assert.equal(wellKnownCheck(envelope(rec), {seq: 3, recordSha3: digests(record({seq: 3, files: [want]})).sha3}).verdict, 'FAIL');
  assert.equal(wellKnownCheck(envelope(rec), {seq: 4, recordSha3: 'x'}).verdict, 'FAIL');
  assert.equal(wellKnownCheck(envelope(record({origin: 'https://evil.example'}))).verdict, 'FAIL');
  assert.equal(wellKnownCheck(envelope(record({seq: 0}))).verdict, 'FAIL');
  assert.equal(wellKnownCheck(envelope(rec, {bnr: 'other/1'})).verdict, 'FAIL');
  assert.equal(wellKnownCheck(envelope(rec, {sig: null})).verdict, 'FAIL');
  assert.equal(wellKnownCheck({url: 'u', status: 200, server: 'Caddy', bytes: Buffer.from('{')}).verdict, 'FAIL');
  assert.equal(wellKnownCheck(envelope(rec, {hints: {pad: 'x'.repeat(70000)}})).verdict, 'FAIL');
});

test('summary: counts derive from the checks; a foreign schema is refused', () => {
  const r = {schema: SCHEMA, at: '2026-10-12T22:00:00.000Z', vantage: 'fixture', checks: [
    {name: 'bytes /', verdict: 'PASS', evidence: {brief: 'a | b'}}, {name: 'dns', verdict: 'FAIL', evidence: {brief: 'x'}},
    {name: 'ct', verdict: 'NOT MEASURED', evidence: {brief: 'y\nz'}}]};
  const s = summary(r);
  assert.match(s, /PASS 1 · FAIL 1 · NOT MEASURED 1/);
  assert.match(s, /\| bytes \/ \| PASS \| a \\\| b \|/);
  assert.match(s, /\| ct \| NOT MEASURED \| y z \|/);
  assert.throws(() => summary({...r, schema: 'other/1'}), /not a bnr\.keychain-edge-receipt\/1/);
});
