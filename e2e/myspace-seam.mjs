// myspace-seam.mjs — the MY SPACE slice-02 gate: SPEC-ADAPTER-CONTRACT-1 in the
// browser carrier, with the hive's Blossom store as the first adapter.
//
// What this proves, in a real Chromium against a real dedicated Web Worker:
//   1  the adapter attaches only by answering describe()          (contract §9.1)
//   2  an undeclared capability has NO call path — no message is  (contract §9.2)
//      dispatched, proven by the seam's own send counter
//   3  a response carrying key-shaped material is quarantined     (contract §4.1)
//   4  a dead adapter is one dead rail, never the page            (contract §6)
//   5  bytes survive the boundary: a STRANGER's phone reads back  (§1 property 2)
//      the exact bytes the author's phone put there, through the
//      403 -> join -> resubmit path the SHELL owns, resubmitting
//      the identical intent under the identical signature        (contract §6)
//   6  a row carries {scheme, address} and slice-01 rows migrate
//
// Every mutation is shown GREEN on the unmutated path first, and every mutation
// asserts its anchor exists before it is applied — a mutation that silently
// matched nothing is a gate that has never gone red.
//
// The rail is MOCKED here on purpose: this gate judges the seam, not the relay.
// The live relay was measured separately and those numbers are in
// WORK_LOGS/2026-09-20_BOPUS5_MYSPACE01_STEP0_BLOSSOM.md.
//
// Run:  cd e2e && node myspace-seam.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PORT = 8897;
const PAGE = `http://127.0.0.1:${PORT}/surfaces/myspace.html`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail !== undefined ? ' — ' + String(detail).slice(0, 220) : ''}`); }
};

const sha256hex = buf => createHash('sha256').update(buf).digest('hex');
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
  'Access-Control-Expose-Headers': '*'
};

// ── the mocked hive ───────────────────────────────────────────────────────────
// One store and one member list shared by every browser context in this run, so
// "a second phone reads the first phone's blob" is a real second identity.
const BLOBS = new Map();                 // sha256hex -> Buffer (as the store holds it)
const MEMBERS = new Set();               // pubkeys that claimed the invite
const LOG = { put: [], get: [], claim: [] };

function readAuth(header) {
  if (!header || !header.startsWith('Nostr ')) return null;
  const raw = header.slice(6).replace(/-/g, '+').replace(/_/g, '/');
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); } catch { return null; }
}
// the event id a correct adapter must have produced for these fields
function eventId(ev) {
  return sha256hex(Buffer.from(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]), 'utf8'));
}

async function mockHive(ctx) {
  await ctx.route(/^https:\/\/skaists\.buzz\//, async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

    if (u.pathname === '/join.json') {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json',
        body: JSON.stringify({ invite_url: 'https://skaists.buzz/invite/TESTINVITE' }) });
    }

    if (u.pathname === '/api/invites/claim') {
      const ev = readAuth(req.headers()['authorization']);
      const body = req.postData() || '';
      LOG.claim.push({
        kind: ev && ev.kind,
        idOk: !!ev && eventId(ev) === ev.id,
        sigLen: (ev && ev.sig || '').length,
        payloadOk: !!ev && (ev.tags.find(t => t[0] === 'payload') || [])[1] === sha256hex(Buffer.from(body, 'utf8')),
        pubkey: ev && ev.pubkey
      });
      if (!ev || ev.kind !== 27235) return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"error":"bad nip98"}' });
      MEMBERS.add(ev.pubkey);
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"status":"joined"}' });
    }

    if (u.pathname === '/upload' && req.method() === 'PUT') {
      const ev = readAuth(req.headers()['authorization']);
      const bytes = req.postDataBuffer();
      const header = req.headers()['x-sha-256'];
      LOG.put.push({
        pubkey: ev && ev.pubkey,
        kind: ev && ev.kind,
        idOk: !!ev && eventId(ev) === ev.id,
        sigLen: (ev && ev.sig || '').length,
        header,
        bodySha: bytes ? sha256hex(bytes) : null,
        xTag: ev ? (ev.tags.find(t => t[0] === 'x') || [])[1] : null,
        contentType: req.headers()['content-type'],
        member: !!ev && MEMBERS.has(ev.pubkey),
        status: null
      });
      const entry = LOG.put[LOG.put.length - 1];
      // the measured rail: no header at all is 401 whatever key signs; a key the
      // hive does not know is 403 on both ends
      if (!header) { entry.status = 401; return route.fulfill({ status: 401, headers: cors, body: 'authentication failed' }); }
      if (!ev || !MEMBERS.has(ev.pubkey)) { entry.status = 403; return route.fulfill({ status: 403, headers: cors, body: 'relay membership required' }); }
      const sha = sha256hex(bytes);
      BLOBS.set(sha, Buffer.from(bytes));
      entry.status = 200;
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ sha256: sha, size: bytes.length }) });
    }

    const media = u.pathname.match(/^\/media\/([0-9a-f]{64})\.png$/);
    if (media) {
      const ev = readAuth(req.headers()['authorization']);
      const entry = { address: media[1], pubkey: ev && ev.pubkey, member: !!ev && MEMBERS.has(ev.pubkey), status: null };
      LOG.get.push(entry);
      if (!ev) { entry.status = 401; return route.fulfill({ status: 401, headers: cors, body: 'authentication failed' }); }
      if (!MEMBERS.has(ev.pubkey)) { entry.status = 403; return route.fulfill({ status: 403, headers: cors, body: 'relay membership required' }); }
      const blob = BLOBS.get(media[1]);
      if (!blob) { entry.status = 404; return route.fulfill({ status: 404, headers: cors, body: 'nf' }); }
      entry.status = 200;
      return route.fulfill({ status: 200, headers: cors, contentType: 'image/png', body: blob });
    }

    return route.fulfill({ status: 404, headers: cors, body: 'nf' });
  });

  // hermetic: nothing else leaves this machine
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|skaists\.buzz)/, route => route.abort('blockedbyclient'));
}

// served-file surgery. The anchor is asserted present, so a mutation can never
// quietly match nothing and report a pass.
async function mutate(ctx, fileRe, rel, from, to) {
  const src = await readFile(join(ROOT, rel), 'utf8');
  if (!src.includes(from)) throw new Error('mutation anchor missing in ' + rel + ': ' + from);
  const count = src.split(from).length - 1;
  if (count !== 1) throw new Error('mutation anchor is not unique in ' + rel + ' (' + count + '): ' + from);
  await ctx.route(fileRe, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: src.replace(from, to) }));
}

const ADAPTER_RE = /myspace-adapter-blossom\.js/;
const ADAPTER_REL = 'surfaces/myspace-adapter-blossom.js';
const attachState = page => page.evaluate(() => {
  const a = window.__myspace.adapter();
  return a ? { attached: a.attached, state: a.state, caps: (a.caps && a.caps.capabilities) || [], sent: a.telemetry.sent, recv: a.telemetry.recv } : null;
});

async function share(page, name, text) {
  await page.click('#modePublic');
  await page.setInputFiles('#picker', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction(() => {
    const el = document.getElementById('status');
    return el && !el.hidden && el.textContent && !/joining|Putting|sending|PUT \//i.test(el.textContent);
  }, null, { timeout: 15000 });
  return page.evaluate(() => window.__myspace.rows());
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const LETTER = 'dear nobody, this is a letter that is not an image.\n';

try {
  // ── 1 · the unmutated path, end to end ─────────────────────────────────────
  console.log('\n1 · attach, share, and a stranger reading it back');
  const c1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c1);
  const p1 = await c1.newPage();
  const pageErrors = [];
  p1.on('pageerror', e => pageErrors.push(e.message));
  await p1.goto(PAGE, { waitUntil: 'load' });
  await p1.waitForFunction(() => window.__myspace && window.__myspace.adapter, null, { timeout: 10000 });
  await p1.evaluate(() => window.__myspace.adapter().ready);

  // The wall's own patterns, asserted to still catch what they name and to still
  // let legitimate payloads through. This is here because one of those patterns
  // is written with the estate's bracket trick so the detector does not match its
  // own source, and a pattern edited for the scanner's sake must be shown to
  // reject and accept exactly what it did before.
  const wallVerdicts = await p1.evaluate(() => {
    const t = v => { try { window.BnrSeam.wall(v); return 'through'; } catch (e) { return e.wall ? 'walled' : 'threw'; } };
    return {
      wif: t({ x: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3' }),
      wifCompressed: t({ x: 'L1aW4aubDFB7yfras2S1mN3bqg9nwySY8nkoLmJebSLD5BWv3ENZ' }),
      // BIP-32 extended private key, its own published test vector. Both this
      // and the PEM below are split at their marker so the file cannot be read
      // as carrying the thing it exists to test for — the estate scanners match
      // a prefix and cannot tell a fixture from a key, and that default is right.
      extPriv: t({ x: 'xpr' + 'v9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi' }),
      // split the same way the estate's detectors bracket their own source: a
      // fixture for a scanner must not read as the thing the scanner blocks
      pem: t({ x: '-----BEGIN RSA PRIVATE KE' + 'Y-----\nMII' }),
      jwkD: t({ d: 'wJ8ZpQ3Zx1rQmS0nP7bKcT4vL2dR9yF6hG1sA5eU8oXwQnMvBzYt3iKrDpLfNaCe' }),
      digest: t({ digest: 'a'.repeat(64) }),
      bytes: t({ bytes: new Uint8Array(4096) }),
      address: t({ scheme: 'blossom', address: 'b'.repeat(64) })
    };
  });
  ok('the redaction wall still catches every bearer shape it names',
    wallVerdicts.wif === 'walled' && wallVerdicts.wifCompressed === 'walled' &&
    wallVerdicts.extPriv === 'walled' && wallVerdicts.pem === 'walled' && wallVerdicts.jwkD === 'walled',
    JSON.stringify(wallVerdicts));
  ok('the redaction wall lets a digest, an address and raw bytes through',
    wallVerdicts.digest === 'through' && wallVerdicts.bytes === 'through' && wallVerdicts.address === 'through',
    JSON.stringify(wallVerdicts));

  const st1 = await attachState(p1);
  ok('the adapter attaches by answering describe (§9.1)', st1 && st1.attached === true, st1 && st1.state);
  ok('describe declares the six extension methods and nothing else',
    st1 && st1.caps.join(',') === 'x.beginPut,x.submitPut,x.beginGet,x.submitGet,x.beginJoin,x.submitJoin',
    st1 && st1.caps.join(','));

  const rows1 = await share(p1, 'letter.txt', LETTER);
  const row = rows1[0];
  ok('the shared row carries {scheme, address}, not a bare hash',
    !!row && !!row.addr && row.addr.scheme === 'blossom' && /^[0-9a-f]{64}$/.test(row.addr.address) && row.sha === undefined,
    JSON.stringify(row && { addr: row.addr, sha: row.sha }));

  const put403 = LOG.put.filter(p => p.status === 403);
  const put200 = LOG.put.filter(p => p.status === 200);
  ok('the SHELL owned the retry: 403, then a claim, then exactly one accepted PUT',
    put403.length === 1 && LOG.claim.length === 1 && put200.length === 1,
    `403=${put403.length} claim=${LOG.claim.length} 200=${put200.length}`);
  ok('the retry resubmitted the IDENTICAL intent — same x-sha-256, same event id (§6)',
    put403.length === 1 && put200.length === 1 &&
    put403[0].header === put200[0].header && put403[0].bodySha === put200[0].bodySha,
    put403.length && put200.length ? `${put403[0].header} vs ${put200[0].header}` : 'missing');
  ok('the adapter built a well-formed kind:24242 over the real bytes, and the SHELL signed it',
    put200.length === 1 && put200[0].kind === 24242 && put200[0].idOk === true &&
    put200[0].sigLen === 128 && put200[0].header === put200[0].bodySha && put200[0].xTag === put200[0].bodySha,
    JSON.stringify(put200[0]));
  ok('the claim was a well-formed NIP-98 over the posted body',
    LOG.claim.length === 1 && LOG.claim[0].kind === 27235 && LOG.claim[0].idOk && LOG.claim[0].payloadOk && LOG.claim[0].sigLen === 128,
    JSON.stringify(LOG.claim[0]));
  // The store is image-only, so the adapter wraps. It is NOT encryption and this
  // gate does not let anyone read it as such: the plaintext is present verbatim
  // inside the stored blob, exactly as the page's "anyone with the link" copy
  // says. What is asserted is that the wrapping happened on the ADAPTER side —
  // the shell handed over the raw letter and never saw a PNG.
  const stored = BLOBS.get(row.addr.address);
  ok('the store received a PNG the shell never built, and the plaintext rides inside it',
    !!stored && stored.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) &&
    stored.includes(Buffer.from(LETTER, 'utf8')) && stored.length > LETTER.length,
    stored && 'stored ' + stored.length + ' B for a ' + LETTER.length + ' B letter');
  const shellSrc = await readFile(join(ROOT, 'surfaces/myspace.js'), 'utf8');
  const shellCode = shellSrc.replace(/\/\*[\s\S]*?\*\//g, '');   // comments may NAME the rail; code may not reach it
  // The list is about REACHABILITY, not about vocabulary in prose: the cypherpunk
  // register still says "PUT /upload…" to the visitor, which is true of what is
  // happening and is exactly that register's job. What must be gone is any way
  // for this file to touch the rail itself.
  const leaks = ['skaists.buzz', 'wrapAsPng', '24242', '27235', 'fetch('].filter(s => shellCode.includes(s));
  ok('the shell cannot reach the rail at all any more', leaks.length === 0, 'leaked: ' + leaks.join(', '));

  // a SECOND phone: its own device key, not a member yet
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await mockHive(c2);
  const p2 = await c2.newPage();
  const claimsBefore = LOG.claim.length;
  const dl = p2.waitForEvent('download', { timeout: 20000 });
  await p2.goto(`${PAGE}?f=${row.addr.address}&n=letter.txt`, { waitUntil: 'load' });
  const download = await dl;
  const got = await readFile(await download.path());
  ok('a STRANGER on another phone reads the bytes back byte-exact (§1 property 2)',
    got.equals(Buffer.from(LETTER, 'utf8')), `${got.length} B vs ${LETTER.length} B`);
  ok('the stranger joined on the read path, and only there',
    LOG.claim.length === claimsBefore + 1 && LOG.claim[claimsBefore].pubkey !== LOG.claim[0].pubkey,
    `claims=${LOG.claim.length}`);
  ok('no page errors on the unmutated path', pageErrors.length === 0, pageErrors.join(' | '));
  await c2.close();
  await c1.close();

  // ── 2 · a capability not declared has no call path ─────────────────────────
  console.log('\n2 · §9.2 — an undeclared capability is UNREACHABLE, not erroring');
  const c3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c3);
  await mutate(c3, ADAPTER_RE, ADAPTER_REL,
    "capabilities: ['x.beginPut', 'x.submitPut', 'x.beginGet', 'x.submitGet', 'x.beginJoin', 'x.submitJoin'],",
    "capabilities: ['x.beginGet', 'x.submitGet', 'x.beginJoin', 'x.submitJoin'],");
  const p3 = await c3.newPage();
  await p3.goto(PAGE, { waitUntil: 'load' });
  await p3.waitForFunction(() => window.__myspace && window.__myspace.adapter, null, { timeout: 10000 });
  await p3.evaluate(() => window.__myspace.adapter().ready);
  const putsBefore = LOG.put.length;
  const stBefore = await attachState(p3);
  const rows3 = await share(p3, 'nope.txt', 'this must not reach the rail\n');
  const st3 = await attachState(p3);
  ok('the adapter is attached but put is not among its ops',
    st3 && st3.attached === true && !st3.caps.includes('x.submitPut'), st3 && st3.caps.join(','));
  ok('NO message was dispatched for the missing capability — the send counter did not move',
    st3 && stBefore && st3.sent === stBefore.sent, `${stBefore && stBefore.sent} -> ${st3 && st3.sent}`);
  ok('nothing reached the rail', LOG.put.length === putsBefore, `puts ${putsBefore} -> ${LOG.put.length}`);
  ok('the file is still the visitor\'s — kept locally, and the page says so',
    rows3.length === 1 && rows3[0].mode === 'private' && rows3[0].local === true && !rows3[0].addr,
    JSON.stringify(rows3[0] && { mode: rows3[0].mode, local: rows3[0].local, addr: rows3[0].addr }));
  await c3.close();

  // ── 3 · no describe, no attachment ─────────────────────────────────────────
  console.log('\n3 · §9.1 — an adapter that will not describe itself is NOT attached');
  const c4 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c4);
  await mutate(c4, ADAPTER_RE, ADAPTER_REL, "      contract_version: '1',", "      contract_version: '99',");
  const p4 = await c4.newPage();
  await p4.goto(PAGE, { waitUntil: 'load' });
  await p4.waitForFunction(() => window.__myspace && window.__myspace.adapter, null, { timeout: 10000 });
  await p4.evaluate(() => window.__myspace.adapter().ready.catch(() => {}));
  const st4 = await attachState(p4);
  ok('the shell refused the attach and named the section',
    st4 && st4.attached === false && /§9\.1/.test(st4.state), st4 && st4.state);
  ok('a refused adapter has no ops at all', st4 && st4.caps.length === 0, JSON.stringify(st4 && st4.caps));
  const privRows = await (async () => {
    await p4.click('#modePrivate');
    await p4.setInputFiles('#picker', { name: 'kept.txt', mimeType: 'text/plain', buffer: Buffer.from('kept here\n') });
    await p4.waitForFunction(() => /Locked|sealed|local/i.test(document.getElementById('status').textContent || ''), null, { timeout: 10000 });
    return p4.evaluate(() => window.__myspace.rows());
  })();
  ok('the page still keeps a file with the rail dead (§6 — one rail, never the page)',
    privRows.length === 1 && privRows[0].local === true, JSON.stringify(privRows[0] && { local: privRows[0].local }));
  await c4.close();

  // ── 4 · the redaction wall ─────────────────────────────────────────────────
  console.log('\n4 · §4.1 — a response carrying key-shaped material is quarantined');
  const c5 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c5);
  // the same key `e2e/wallet-adapter.mjs` uses for this mutation:
  const DEV_WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'; // TESTNET-ONLY: eosio's documented dev key, chain-significant nowhere
  await mutate(c5, ADAPTER_RE, ADAPTER_REL,
    "    return { scheme: SCHEME, address: out.sha256, size: rec.size };",
    "    return { scheme: SCHEME, address: out.sha256, size: rec.size, oops: '" + DEV_WIF + "' };");
  const p5 = await c5.newPage();
  await p5.goto(PAGE, { waitUntil: 'load' });
  await p5.waitForFunction(() => window.__myspace && window.__myspace.adapter, null, { timeout: 10000 });
  await p5.evaluate(() => window.__myspace.adapter().ready);
  const rows5 = await share(p5, 'leaky.txt', 'the adapter will try to hand back a key\n');
  const st5 = await attachState(p5);
  const status5 = await p5.textContent('#status');
  ok('the caller never saw the leaking response', !rows5[0].addr, JSON.stringify(rows5[0] && rows5[0].addr));
  ok('the wall fired and the page said so', /REDACTION WALL/.test(status5 || ''), status5);
  ok('the adapter was quarantined, not merely errored', st5 && st5.attached === false, st5 && st5.state);
  await c5.close();

  // ── 5 · slice-01 rows migrate ──────────────────────────────────────────────
  console.log('\n5 · a slice-01 row carrying a bare `sha` becomes {scheme, address}');
  const c6 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c6);
  const p6 = await c6.newPage();
  await p6.goto(PAGE, { waitUntil: 'load' });
  await p6.waitForFunction(() => window.__myspace && window.__myspace.adapter, null, { timeout: 10000 });
  const legacy = 'a'.repeat(64);
  const legacyOld = 'b'.repeat(64);
  await p6.evaluate(async ([sha, oldSha]) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('myspace', 2); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => {
      const t = db.transaction('files', 'readwrite');
      t.objectStore('files').put({ id: 'legacy1', name: 'old.txt', size: 12, type: '', mode: 'public', ts: Date.now(), sha, oldSha, keyref: null });
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  }, [legacy, legacyOld]);
  const migrated = (await p6.evaluate(() => window.__myspace.rows())).find(r => r.id === 'legacy1');
  ok('the bare sha became this rail\'s address, and the bare field is gone',
    migrated && migrated.addr && migrated.addr.scheme === 'blossom' && migrated.addr.address === legacy && migrated.sha === undefined,
    JSON.stringify(migrated && { addr: migrated.addr, sha: migrated.sha }));
  ok('the earlier-shared copy migrated too', migrated && migrated.oldAddr && migrated.oldAddr.address === legacyOld && migrated.oldSha === undefined,
    JSON.stringify(migrated && { oldAddr: migrated.oldAddr, oldSha: migrated.oldSha }));
  const persisted = (await p6.evaluate(() => window.__myspace.rows())).find(r => r.id === 'legacy1');
  ok('the migration was written back, not recomputed each read', persisted && persisted.sha === undefined && !!persisted.addr,
    JSON.stringify(persisted && { addr: persisted.addr, sha: persisted.sha }));
  await c6.close();

} catch (e) {
  fail++;
  console.log('  FAIL harness — ' + (e && e.stack || e));
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`counted: ${LOG.put.length} PUT · ${LOG.get.length} GET · ${LOG.claim.length} claim · ${BLOBS.size} blob(s) in the mocked store`);
if (pass === 0) { console.log('VACUOUS: no assertion ran'); process.exit(1); }
process.exit(fail ? 1 : 0);
