/* bdrop-eternal.test.mjs — the drop desk's durable lifecycle, proven forever.
   The page runs in a real browser (persistent context) against a mock Hive
   JSON-RPC; the REAL genesis edition is served from the real tree. Nothing
   touches Hive. Proven here: editions discovery + byte verification, the
   happy path, duplicate attempts, browser-restart reconciliation, ambiguous
   submission (lost broadcast answer), unavailable RPC, mismatched content
   (divergence refusal), independent retrieval, and that no key material ever
   reaches storage. Run: node --test e2e/bdrop-eternal.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9171, ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

/* ── the mock chain: modes, content overrides, a broadcast ledger ── */
const mock = { mode: 'normal', content: null, broadcasts: [], lastBody: null };
const rpcResult = (method, params) => {
  if (mock.mode === 'down') throw Object.assign(new Error('mock chain unreachable'), { http: 503 });
  if (method === 'condenser_api.get_dynamic_global_properties')
    return { head_block_number: 49000000, head_block_id: '02e0dcb4c89a1a5c1e4e8a5c1e4e8a5c1e4e8a5c', time: new Date().toISOString().slice(0, 19) };
  if (method === 'condenser_api.broadcast_transaction') {
    const trx = params[0];
    mock.broadcasts.push(trx);
    mock.lastBody = trx.operations[0][1].body;
    if (mock.mode === 'swallow') throw Object.assign(new Error('broadcast answer lost (mock)'), { http: 502 });
    return 'fedcba9876543210fedcba9876543210fedcba98';
  }
  if (method === 'condenser_api.get_content') {
    if (mock.content && mock.content.permlink === params.permlink)
      return { author: params.author, permlink: params.permlink, body: mock.content.body, block_num: 48000111, created: new Date().toISOString().slice(0, 19) };
    if (mock.mode === 'noland' || mock.mode === 'swallow') return { author: params.author, permlink: params.permlink, body: '' };
    return mock.lastBody
      ? { author: params.author, permlink: params.permlink, body: mock.lastBody, block_num: 49000123, created: new Date().toISOString().slice(0, 19) }
      : { author: params.author, permlink: params.permlink, body: '' };
  }
  throw Object.assign(new Error('mock: unknown ' + method), { http: 400 });
};

const server = createServer(async (q, s) => {
  if (q.method === 'POST' && q.url === '/rpc') {
    let b = ''; for await (const c of q) b += c;
    let code = 200, body;
    try {
      const { method, params } = JSON.parse(b);
      body = JSON.stringify({ jsonrpc: '2.0', id: 1, result: rpcResult(method, params) });
    } catch (e) {
      code = e.http || 500;
      body = JSON.stringify({ jsonrpc: '2.0', id: 1, error: { message: e.message } });
    }
    s.writeHead(code, { 'Content-Type': 'application/json' });
    s.end(body);
    return;
  }
  if (q.method === 'POST' && q.url === '/mock') { /* test-side control; the page never calls this */
    let b = ''; for await (const c of q) b += c;
    Object.assign(mock, JSON.parse(b));
    s.writeHead(200); s.end('ok'); return;
  }
  const rel = decodeURIComponent(q.url.split('?')[0].replace(/^\//, '')) || 'index.html';
  try {
    const file = join(ROOT, rel);
    if (!file.startsWith(ROOT)) throw new Error('escape');
    const data = await readFile(file);
    s.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    s.end(data);
  } catch { s.writeHead(404); s.end('no'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const setMock = o => fetch(`http://127.0.0.1:${PORT}/mock`, { method: 'POST', body: JSON.stringify(o) }).then(r => r.text());
const GENESIS_SHA = '9fa6998d548e8f4afd0a7e17fa2a11ea50a0db18b1808d74f985931ff6d825e9'; /* PUBLIC-CONSTANT: the genesis edition's reported+verified public digest */
const BODY = [
  '# bDroP offline fixture (never published anywhere but the mock)',
  '',
  'the quick brown fox · byte-exact through sign, submit, restart and reconcile. 🐝',
  '',
].join('\n');
const BODY_SHA = createHash('sha256').update(Buffer.from(BODY, 'utf8')).digest('hex');

let failures = 0;
const ok = (name, cond, detail = '') => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + detail : '')); if (!cond) failures++; };
const step = async (name, fn) => { try { return await fn(); } catch (e) { ok(name, false, (e && e.message ? e.message : String(e))); return undefined; } };

const profile = name => mkdtempSync(join(tmpdir(), 'bdrop-' + name + '-'));
async function open(profileDir) {
  const ctx = await chromium.launchPersistentContext(profileDir, { headless: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(ORIGIN + '/surfaces/bdrop.html#fast');
  await page.waitForSelector('body[data-reg]', { timeout: 8000 });
  await page.waitForFunction(() => typeof window.hiveTx === 'object', null, { timeout: 8000 });
  return { ctx, page, errs };
}
const outboxOf = p => p.evaluate(() => JSON.parse(localStorage.getItem('bnr.bdrop.outbox.v1') || '[]'));
const storageDump = p => p.evaluate(() => {
  const dump = o => { const out = {}; for (let i = 0; i < o.length; i++) out[o.key(i)] = o.getItem(o.key(i)); return out; };
  return JSON.stringify({ local: dump(localStorage), session: dump(sessionStorage) });
});

test('the drop desk lifecycle: editions, happy path, duplicates, restart, ambiguity, unavailability, divergence, retrieval, key hygiene', async () => {
  const dirs = [];
  try {
    /* ── scenario 1: editions + happy path + duplicate + restart ── */
    await setMock({ mode: 'normal', content: null });
    mock.broadcasts.length = 0; mock.lastBody = null;
    const dir1 = profile('main'); dirs.push(dir1);
    const one = await open(dir1);

    await step('editions panel lists edition 0001', () => one.page.waitForFunction(() => /0001/.test(document.getElementById('editions').textContent || ''), null, { timeout: 8000 }));
    await one.page.click('#editions button');
    await step('edition bytes hash to a live digest', () => one.page.waitForFunction(() => document.getElementById('livehash').value !== '', null, { timeout: 8000 }));
    const live = await one.page.inputValue('#livehash');
    ok('edition 0001 loads and verifies byte-exact against the reported digest', live === GENESIS_SHA, live.slice(0, 16) + '…');
    ok('verdict reads MATCH', /MATCH/.test(await one.page.textContent('#hashverdict')));

    /* the incident artifact: an uploaded file went SILENT on v1 — the file
       input itself is now exercised, with multi-byte content so byte-true
       hashing (not char counting) is what passes */
    const uploadPath = join(dir1, 'upload-check.md');
    const UPLOAD = 'bDroP file-input check \u2014 harmless test bytes for the regression suite \u00b7 \u2014 \u{1F41D}\n';
    const UPLOAD_SHA = createHash('sha256').update(UPLOAD, 'utf8').digest('hex');
    await writeFile(uploadPath, UPLOAD, 'utf8');
    await one.page.fill('#expected', UPLOAD_SHA);
    await one.page.setInputFiles('#bodyfile', uploadPath);
    await step('uploaded file hashes to its own digest', () => one.page.waitForFunction(
      (sha) => document.getElementById('livehash').value === sha, UPLOAD_SHA, { timeout: 8000 }));
    ok('the file path answers with MATCH (the v1 silence is regression-covered)', /MATCH/.test(await one.page.textContent('#hashverdict')));

    await one.page.fill('#body', BODY);
    await one.page.fill('#expected', BODY_SHA);
    await one.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await one.page.fill('#wif', await one.page.evaluate(() => String(window.hiveTx.PrivateKey.randomKey())));
    await one.page.click('#publish');
    await step('the drop lands', () => one.page.waitForFunction(() => /LANDED/.test(document.getElementById('receipt').textContent || ''), null, { timeout: 30000 }));
    ok('LANDED with block, byte-compare MATCH', /byte-compare MATCH/.test(await one.page.textContent('#receipt')));
    ok('key field cleared after the gesture', (await one.page.inputValue('#wif')) === '');
    ok('key session display live (bound scope)', !(await one.page.getAttribute('#keysession', 'hidden')));

    const ob1 = await outboxOf(one.page);
    ok('outbox holds the record at confirmed', ob1.length === 1 && ob1[0].stage === 'confirmed', ob1.map(r => r.stage).join(','));
    ok('event log tells the whole lifecycle in order',
      JSON.stringify(ob1[0].events.map(e => e.event)) === JSON.stringify(['prepared', 'authorized', 'signed', 'submitted', 'confirmed']),
      ob1[0].events.map(e => e.event).join(' → '));
    ok('signed transaction persisted (with body) before submission', !!(ob1[0].signed_tx && ob1[0].signed_tx.signatures && ob1[0].body));
    ok('no page errors during the happy path', one.errs.length === 0, one.errs[0] || '');

    await one.page.fill('#body', BODY);
    await one.page.click('#publish');
    await step('duplicate attempt reconciles', () => one.page.waitForFunction(() => /already published/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('duplicate attempt re-publishes nothing', mock.broadcasts.length === 1, 'broadcasts=' + mock.broadcasts.length);

    await one.ctx.close();
    const two = await open(dir1);
    await step('restart: outbox renders the recovered record', () => two.page.waitForFunction(() => /confirmed/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    ok('restart re-broadcast nothing', mock.broadcasts.length === 1);
    ok('restart produced no page errors', two.errs.length === 0, two.errs[0] || '');

    const ob2 = await outboxOf(two.page);
    const chainSha = createHash('sha256').update(Buffer.from(mock.lastBody, 'utf8')).digest('hex');
    ok('independent retrieval: chain body hash equals the receipt\u2019s signed digest', !!(ob2[0] && ob2[0].receipt && chainSha === ob2[0].receipt.body_sha256_signed));

    const dump = await storageDump(two.page);
    ok('no WIF-shaped string in any storage', !/5[JK][1-9A-HJ-NP-Za-km-z]{49}/.test(dump));
    ok('no key-named fields in storage', !/"(wif|privkey|private_key)"\s*:/i.test(dump));
    ok('recoverable state (body + signed tx) IS in storage', /signed_tx/.test(dump) && /body/.test(dump));
    await two.ctx.close();

    /* ── scenario 2: ambiguity, unavailability, divergence ── */
    await setMock({ mode: 'swallow', content: null });
    mock.broadcasts.length = 0; mock.lastBody = null;
    const dir2 = profile('ambig'); dirs.push(dir2);
    const amb = await open(dir2);
    await amb.page.fill('#body', BODY);
    await amb.page.fill('#expected', BODY_SHA);
    await amb.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await amb.page.fill('#wif', await amb.page.evaluate(() => String(window.hiveTx.PrivateKey.randomKey())));
    await amb.page.click('#publish');
    await step('lost answer is reported as outcome-unknown', () => amb.page.waitForFunction(() => /outcome-unknown/i.test(document.getElementById('status').textContent || ''), null, { timeout: 30000 }));
    const obAmb = await outboxOf(amb.page);
    ok('lost answer leaves submitted-outcome-unknown state, recoverable', !!(obAmb[0] && obAmb[0].stage === 'submitted' && obAmb[0].signed_tx), obAmb.map(r => r.stage).join(','));
    await amb.ctx.close();

    await setMock({ mode: 'normal', content: null });
    const rec1 = await open(dir2);
    await step('restart after ambiguity reconciles to confirmed', () => rec1.page.waitForFunction(() => /confirmed/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 20000 }));
    ok('ambiguous path broadcast exactly once', mock.broadcasts.length === 1, 'broadcasts=' + mock.broadcasts.length);
    await rec1.ctx.close();

    await setMock({ mode: 'down', content: null });
    const dir3 = profile('down'); dirs.push(dir3);
    const down = await open(dir3);
    await down.page.fill('#body', BODY);
    await down.page.fill('#expected', BODY_SHA);
    await down.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await down.page.fill('#wif', await down.page.evaluate(() => String(window.hiveTx.PrivateKey.randomKey())));
    await down.page.click('#publish');
    await step('unavailable RPC: the desk says it will not sign blind', () => down.page.waitForFunction(() => /will not sign blind|pre-flight lookup failed/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('unavailable RPC: nothing new broadcast', mock.broadcasts.length === 1);
    const obDown = await outboxOf(down.page);
    ok('prepared state persisted even though the RPC was down', obDown.some(r => r.stage === 'prepared' || r.stage === 'authorized'), obDown.map(r => r.stage).join(','));
    await down.ctx.close();

    await setMock({ mode: 'normal', content: { permlink: 'bdrop-0001-genesis-public-evidence-informed-consent', body: 'someone else\u2019s bytes already live at this permlink' } });
    const dir4 = profile('diverge'); dirs.push(dir4);
    const div = await open(dir4);
    await div.page.click('#editions button');
    await step('edition loads for the divergence probe', () => div.page.waitForFunction(() => document.getElementById('livehash').value !== '', null, { timeout: 8000 }));
    await div.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await div.page.fill('#wif', await div.page.evaluate(() => String(window.hiveTx.PrivateKey.randomKey())));
    await div.page.click('#publish');
    await step('divergence is refused and named', () => div.page.waitForFunction(() => /DIFFERENT bytes|diverged/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    const obDiv = await outboxOf(div.page);
    ok('divergence recorded, never edited', !!(obDiv[0] && obDiv[0].stage === 'diverged'), obDiv.map(r => r.stage).join(','));
    ok('divergence broadcast nothing', mock.broadcasts.length === 1);
    ok('divergence produced no page errors', div.errs.length === 0, div.errs[0] || '');
    await div.ctx.close();
  } finally {
    for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
    server.close();
  }
  assert.equal(failures, 0, failures + ' lifecycle assertion(s) failed — see the ✗ lines above');
  console.log(failures === 0 ? 'BDROP LIFECYCLE GREEN — editions, happy path, duplicates, restart, ambiguity, unavailability, divergence, retrieval and key hygiene all held. nothing touched hive.' : 'BDROP LIFECYCLE RED.');
});
