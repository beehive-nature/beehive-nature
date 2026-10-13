/* bdrop-eternal.test.mjs — the drop desk's durable lifecycle, proven forever.
   The page runs in a real browser (persistent context) against a mock Hive
   JSON-RPC; the REAL genesis edition is served from the real tree. Nothing
   touches Hive. Proven here: editions discovery + byte verification, the
   happy path, duplicate attempts, browser-restart reconciliation, ambiguous
   submission (lost broadcast answer), unavailable RPC, mismatched content
   (divergence refusal), independent retrieval, no key material in storage,
   a damaged journal (preserved, reported, refusing, reconciled from the
   chain — never silently emptied), the keychain signer (a full publication
   with no key paste), and fresh-client recovery with the original profile
   destroyed. Run: node --test e2e/bdrop-eternal.test.mjs */
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

/* ── the mock chain: modes, content overrides, per-account posting authorities, a broadcast ledger ── */
const mock = { mode: 'normal', content: null, accounts: {}, broadcasts: [], lastBody: null, stallMs: 0 };
const rpcResult = (method, params) => {
  if (mock.mode === 'down') throw Object.assign(new Error('mock chain unreachable'), { http: 503 });
  if (method === 'condenser_api.get_dynamic_global_properties') {
    mock.libcalls = (mock.libcalls || 0) + 1;
    if (mock.badlib && mock.libcalls > 1) return { head_block_number: 49000000, last_irreversible_block_num: 'weird', time: new Date().toISOString().slice(0, 19) };
    return { head_block_number: 49000000, head_block_id: '02e0dcb4c89a1a5c1e4e8a5c1e4e8a5c1e4e8a5c', last_irreversible_block_num: 48999990, time: new Date().toISOString().slice(0, 19) };
  }
  if (method === 'condenser_api.get_transaction') {
    if (Array.isArray(params)) params = params[0] || {}; /* positional, as mainnet expects */
    if (mock.gettx === 'fail') throw Object.assign(new Error('rpc error: transaction lookup unavailable (mock)'), { http: 200 });
    if (mock.gettx === 'missing') throw Object.assign(new Error('rpc error: Assert Exception:unknown transaction'), { http: 200 });
    const q0 = Array.isArray(params) ? params[0] : params; /* positional: the id IS the element */
    mock.lastTxId = (q0 && typeof q0 === 'object') ? String(q0.id || '') : String(q0 || '');
    const S = mock.txshape || 'ok'; /* faulty-response controls (scenario 13) */
    if (S === 'minimal') return { block_num: 1 }; /* the source counterexample: a numeric block alone */
    if (S === 'wrongid') return { transaction_id: '0x' + 'f'.repeat(40), block_num: 48999985, operations: [['comment', { author: 'someone', permlink: 'unrelated', body: 'x' }]] };
    if (S === 'noops') return { transaction_id: mock.lastTxId, block_num: 48999985, operations: [] };
    if (S === 'wrongop') return { transaction_id: mock.lastTxId, block_num: 48999985, operations: [['vote', {}]] };
    const OP = mock.lastOp ? JSON.parse(JSON.stringify(mock.lastOp)) : { author: 'none', permlink: 'none', body: '' }; /* echo the actual broadcast op */
    if (S === 'wrongbody') { OP.body = 'not the drop' + 's bytes at all'; return { transaction_id: mock.lastTxId, block_num: 48999985, operations: [['comment', OP]] }; }
    return { transaction_id: mock.lastTxId, block_num: 48999985, operations: [['comment', OP]] };
  }
  if (method === 'condenser_api.get_block') {
    if (Array.isArray(params)) params = params[0];
    if (mock.getblock === 'empty') return { timestamp: '2026-10-13T00:00:00', transactions: [] };
    return { timestamp: '2026-10-13T00:00:00', transactions: [{ transaction_id: mock.lastTxId || '0x' + 'e'.repeat(40) }] }; /* the named block contains the named tx by default */
  }
  if (method === 'condenser_api.get_accounts') {
    const names = params[0] || [];
    return names.map(n => (mock.accounts && mock.accounts[n])
      ? { name: n, posting: { key_auths: mock.accounts[n].map(k => [k, 1]) } }
      : null);
  }
  if (method === 'condenser_api.broadcast_transaction') {
    const trx = params[0];
    mock.broadcasts.push(trx);
    mock.lastOp = (trx.operations && trx.operations[0] && trx.operations[0][1]) ? JSON.parse(JSON.stringify(trx.operations[0][1])) : null; /* the inclusion answer echoes the actual broadcast op */
    mock.lastBody = trx.operations[0][1].body;
    if (mock.mode === 'swallow') throw Object.assign(new Error('broadcast answer lost (mock)'), { http: 502 });
    return 'fedcba9876543210fedcba9876543210fedcba98';
  }
  if (method === 'condenser_api.get_content') {
    if (mock.junk) return { author: 123, body: { not: 'a string' }, block_num: 'weird' }; /* the untrusted-endpoint shape */
    if (mock.contents && Object.prototype.hasOwnProperty.call(mock.contents, params.permlink)) {
      const cc = { author: params.author, permlink: params.permlink, body: mock.contents[params.permlink], created: new Date().toISOString().slice(0, 19) };
      if (!mock.blockless) cc.block_num = 48000112; /* mainnet's get_content carries NO block_num — mock.blockless models that */
      return cc;
    }
    if (mock.content && mock.content.permlink === params.permlink)
      return { author: params.author, permlink: params.permlink, body: mock.content.body, block_num: 48000111, created: new Date().toISOString().slice(0, 19) };
    if (mock.mode === 'noland' || mock.mode === 'swallow') return { author: params.author, permlink: params.permlink, body: '' };
    /* MAINNET's not-found shape (the founder's live finding, verbatim): unknown
       permlink + nothing broadcast yet ⇒ the endpoint ASSERTS instead of answering
       an empty body. mock.hive models api.hive.blog's actual behavior. */
    if (mock.hive && !mock.lastBody)
      throw Object.assign(new Error('rpc error: Assert Exception:Post ' + params.author + '/' + params.permlink + ' does not exist'), { http: 200 });
    return mock.lastBody
      ? { author: params.author, permlink: params.permlink, body: mock.lastBody, block_num: 49000123, created: new Date().toISOString().slice(0, 19) }
      : { author: params.author, permlink: params.permlink, body: '' };
  }
  throw Object.assign(new Error('mock: unknown ' + method), { http: 400 });
};

const server = createServer(async (q, s) => {
  if (q.method === 'POST' && q.url === '/rpc') {
    let b = ''; for await (const c of q) b += c;
    if (mock.stallMs) await new Promise(r => setTimeout(r, mock.stallMs)); /* the stalled-read control (scenario 6d): answers arrive past the desk's read deadline */
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
    const o = JSON.parse(b);
    mock.mode = o.mode ?? mock.mode; mock.content = o.content ?? null; mock.contents = o.contents ?? null; mock.junk = !!o.junk;
    if ('accounts' in o) mock.accounts = o.accounts; /* per-account posting authorities (the native door's authority gate) */
    if ('lastBody' in o) mock.lastBody = o.lastBody;
    if ('hive' in o) mock.hive = !!o.hive; /* model mainnet's assert-shaped not-found */
    if ('gettx' in o) mock.gettx = o.gettx; /* inclusion-lookup modes: ok | fail | missing */
    if ('blockless' in o) mock.blockless = !!o.blockless; /* model mainnet's block_num-less get_content */
    if ('txshape' in o) mock.txshape = o.txshape; /* inclusion-answer faulty shapes: minimal|wrongid|noops|wrongop|wrongbody|ok */
    if ('getblock' in o) mock.getblock = o.getblock; /* block-membership control: ok|empty */
    if ('stallMs' in o) mock.stallMs = o.stallMs; /* stall every rpc answer by N ms (the stalled-read regression) */
    if ('badlib' in o) { mock.badlib = !!o.badlib; mock.libcalls = 0; } /* malformed irreversible height, first call spared (the page's own tx build) */
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

const KCFILES = { '/': 'keychain/index.html', '/prelude.js': 'keychain/prelude.js', '/keychain.js': 'keychain/keychain.js', '/genesis.js': 'keychain/genesis.js',
  '/vendor/bzdid-key.js': 'surfaces/onboarding/bzdid-key.js', '/vendor/bnr-sign.js': 'surfaces/onboarding/vendor/bnr-sign.js', '/vendor/hive-tx.min.js': 'surfaces/onboarding/vendor/hive-tx.min.js' };
/* the desk mounts the isolated keychain only when keys.skaists.dev answers. Scenarios that do
   not drive the native door get an INERT origin: the mount's reachability probe answers, but no
   keychain ever loads and no state ever posts — the native door stays closed, no heavy files
   parse, nothing races the desk's own clock on slow runners. The live files are served only by
   the scenario that drives the real interface. Hermetic either way: never the live site. */
const serveKeysInert = r => {
  const p = new URL(r.request().url()).pathname;
  if (p === '/genesis.js') return r.fulfill({ status: 200, body: '// inert probe target', contentType: 'text/javascript' });
  if (p === '/') return r.fulfill({ status: 200, body: '<!doctype html><meta charset="utf-8"><body>', contentType: 'text/html' });
  return r.fulfill({ status: 404, body: '' });
};
const profile = name => mkdtempSync(join(tmpdir(), 'bdrop-' + name + '-'));
const ctxs = []; /* every browser context, so a failure path never leaks one into CI's pool */
async function open(profileDir) {
  const ctx = await chromium.launchPersistentContext(profileDir, { headless: true });
  ctxs.push(ctx);
  await ctx.route('https://keys.skaists.dev/**', serveKeysInert); /* hermetic: an inert keychain origin — the probe answers, no keychain loads (see serveKeysInert) */
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
    const rc1ev = (await outboxOf(one.page))[0];
    ok('receipt evidence SEPARATED: content MATCH, inclusion block, finality irreversible',
      !!(rc1ev.receipt.evidence && rc1ev.receipt.evidence.content_observed.compare === 'MATCH'
        && rc1ev.receipt.evidence.tx_included && typeof rc1ev.receipt.evidence.tx_included.block_num === 'number'
        && rc1ev.receipt.evidence.finality && rc1ev.receipt.evidence.finality.irreversible === true
        && rc1ev.receipt.evidence.signature_verified === 'verified-in-desk'),
      JSON.stringify(rc1ev.receipt.evidence || {}).slice(0, 160));
    ok('the rendered receipt names inclusion and finality as their own states',
      /inclusion: block/.test(await one.page.textContent('#receipt')) && /finality: irreversible/.test(await one.page.textContent('#receipt')));
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
    await setMock({ mode: 'swallow', content: null, gettx: 'fail' });
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

    await setMock({ mode: 'normal', content: null, gettx: 'fail' });
    const rec1 = await open(dir2);
    await step('restart after ambiguity reconciles to confirmed', () => rec1.page.waitForFunction(() => /confirmed/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 20000 }));
    ok('ambiguous path broadcast exactly once', mock.broadcasts.length === 1, 'broadcasts=' + mock.broadcasts.length);
    const rcAmb = (await outboxOf(rec1.page))[0];
    ok('an unavailable inclusion lookup stays UNCERTAINTY — content confirms, inclusion does not pretend',
      !!(rcAmb.receipt.evidence && rcAmb.receipt.evidence.content_observed.compare === 'MATCH' && !rcAmb.receipt.evidence.tx_included && /unavailable|no transaction id/.test(String(rcAmb.receipt.evidence.inclusion_note || ''))),
      JSON.stringify(rcAmb.receipt.evidence || {}));
    await setMock({ mode: 'normal', content: null, gettx: 'ok' });
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

    /* ── scenario 5: a damaged journal with MULTIPLE pending operations — partial recovery,
       per-operation outcomes, quarantined resubmission, then the deliberate archive ── */
    await setMock({ mode: 'normal', content: null });
    mock.broadcasts.length = 0; mock.lastBody = null;
    const OTHER_SHA = createHash('sha256').update(Buffer.from('other bytes live at this permlink', 'utf8')).digest('hex');
    const NEVER_SHA = createHash('sha256').update(Buffer.from('never lands anywhere', 'utf8')).digest('hex');
    const mkRec = (pl, sha, exp) => ({ v: 1, id: '@alice/' + pl, created_at: '2026-10-12T00:00:00', stage: 'signed',
      scope: { author: 'alice', permlink: pl, body_sha256: sha, body_bytes: 0, disclosure_version: 'x', rpc: `http://127.0.0.1:${PORT}/rpc` },
      body: null, signed_tx: { expiration: exp }, events: [], receipt: null, attempts: 0, last_error: null });
    const FUTURE = new Date(Date.now() + 3600e3).toISOString().slice(0, 19);
    const PAST = new Date(Date.now() - 3600e3).toISOString().slice(0, 19);
    const J5 = [
      mkRec('drop-a', BODY_SHA, FUTURE),        /* will resolve: confirmed (chain body matches) */
      mkRec('drop-b', BODY_SHA, FUTURE),        /* will resolve: diverged (chain body differs) */
      mkRec('drop-c', NEVER_SHA, FUTURE),       /* stays unresolved: not landed, signed tx still live */
      mkRec('drop-d', NEVER_SHA, PAST),         /* stays unresolved: expiry is NOT proof of non-execution */
    ];
    const RAW5 = JSON.stringify(J5).slice(0, -1) + ',{"junk-residue":true} tail]'; /* whole-parse fails; the four real objects parse; the junk group is unknowable residue */
    await setMock({ mode: 'normal', contents: { 'drop-a': BODY, 'drop-b': 'other bytes live at this permlink' } });
    const dir5 = profile('corrupt'); dirs.push(dir5);
    const cor0 = await open(dir5);
    await cor0.page.evaluate(r => localStorage.setItem('bnr.bdrop.outbox.v1', r), RAW5);
    await cor0.page.reload();
    await cor0.page.waitForSelector('body[data-reg]', { timeout: 8000 });
    ok('damaged journal bytes preserved verbatim — never replaced by an empty array',
      (await cor0.page.evaluate(() => localStorage.getItem('bnr.bdrop.outbox.v1'))) === RAW5);
    await step('the damaged journal is reported in the outbox', () => cor0.page.waitForFunction(() => /DAMAGED/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 8000 }));
    await cor0.page.fill('#author', 'alice');
    await cor0.page.fill('#permlink', 'drop-a');
    await cor0.page.fill('#body', BODY);
    await cor0.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await cor0.page.click('#publish');
    await step('submission refused while the journal is quarantined', () => cor0.page.waitForFunction(() => /refuses new submissions/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('quarantine: nothing broadcast', mock.broadcasts.length === 0);
    /* partial recovery: each readable operation reconciles on its own; unresolved stay quarantined */
    await cor0.page.click('#recover');
    await step('per-operation outcomes reported', () => cor0.page.waitForFunction(() => /resolved-confirmed/.test(document.getElementById('outbox').textContent || '') && /resolved-diverged/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    const outTxt = await cor0.page.textContent('#outbox');
    ok('partial recovery: drop-a confirmed', /drop-a[^\n]*resolved-confirmed/.test(outTxt), outTxt.split('\n').find(l => l.includes('drop-a')) || '');
    ok('partial recovery: drop-b diverged', /drop-b[^\n]*resolved-diverged/.test(outTxt));
    ok('partial recovery: drop-c stays unresolved (live signed tx, not landed)', /drop-c[^\n]*unresolved/.test(outTxt));
    ok('partial recovery: drop-d stays unresolved — an expired signed tx is NOT proof it never executed', /drop-d[^\n]*unresolved/.test(outTxt));
    ok('partial recovery: unparseable residue reported', /residue/i.test(outTxt));
    ok('partial recovery did NOT touch the damaged journal bytes',
      (await cor0.page.evaluate(() => localStorage.getItem('bnr.bdrop.outbox.v1'))) === RAW5);
    ok('damaged copy preserved under the .damaged key',
      (await cor0.page.evaluate(() => localStorage.getItem('bnr.bdrop.outbox.v1.damaged'))) === RAW5);
    await cor0.page.click('#publish');
    await step('resubmission still refused while unresolved operations remain', () => cor0.page.waitForFunction(() => /refuses new submissions/.test(document.getElementById('status').textContent || '') && /drop-a[^\n]*unresolved/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    ok('resubmission attempt: still nothing broadcast', mock.broadcasts.length === 0);
    /* the deliberate archive — explicit, dialog-confirmed, never silent */
    cor0.page.once('dialog', d => d.accept());
    await cor0.page.click('#damaged-archive');
    await step('deliberate archive starts a clean journal', () => cor0.page.waitForFunction(() => /archived deliberately/.test(document.getElementById('status').textContent || ''), null, { timeout: 8000 }));
    ok('archive: journal is a clean empty list', (await cor0.page.evaluate(() => localStorage.getItem('bnr.bdrop.outbox.v1'))) === '[]');
    const arch5 = await cor0.page.evaluate(() => localStorage.getItem('bnr.bdrop.outbox.v1.damaged'));
    ok('archive: damaged bytes preserved inside the archive wrapper', !!(arch5 && (() => { try { return JSON.parse(arch5).raw === RAW5; } catch { return false; } })()));
    await cor0.page.fill('#author', 'alice');
    await cor0.page.fill('#permlink', 'after-archive-unblocked');
    await cor0.page.fill('#body', BODY);
    await cor0.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await cor0.page.click('#publish');
    await step('after the deliberate archive the residue keeps every scope refused (independence impossible)', () => cor0.page.waitForFunction(() => /independence cannot be established/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    await cor0.ctx.close();

    /* ── scenario 6: the keychain signer — CONTRACT-FAITHFUL to upstream requestPost
       (account, title, body, parent_perm, parent_account=null, json_metadata=Object,
        permlink, comment_options, callback NINTH, rpc) — pinned from
       hive-keychain-extension master documentation/README.md ── */
    await setMock({ mode: 'normal', content: null });
    mock.broadcasts.length = 0; mock.lastBody = null;
    const dir6 = profile('keychain'); dirs.push(dir6);
    const ctx6 = await chromium.launchPersistentContext(dir6, { headless: true });
    await ctx6.route('https://keys.skaists.dev/**', serveKeysInert); /* hermetic: an inert keychain origin — the probe answers, no keychain loads */
    ctxs.push(ctx6);
    await ctx6.addInitScript(() => {
      window.hive_keychain = {
        __calls: [],
        requestPost: function (account, title, body, parent_perm, parent_account, json_metadata, permlink, comment_options, callback, rpc) {
          const args = Array.prototype.slice.call(arguments);
          window.hive_keychain.__calls.push({ n: args.length, account, title, parent_perm, parent_account, json_type: typeof json_metadata, permlink, comment_options, cb_at: args.indexOf(callback), rpc: typeof rpc });
          /* contract enforcement: the fixture refuses invented shapes */
          if (args.indexOf(callback) !== 8) { callback({ success: false, message: 'CONTRACT VIOLATION: callback must be parameter #9 (found at #' + (args.indexOf(callback) + 1) + ')' }); return; }
          if (parent_account !== null) { callback({ success: false, message: 'CONTRACT VIOLATION: parent_account must be null for a root post' }); return; }
          if (typeof json_metadata !== 'object' || json_metadata === null || Array.isArray(json_metadata)) { callback({ success: false, message: 'CONTRACT VIOLATION: json_metadata must be an Object' }); return; }
          if (typeof parent_perm !== 'string' || !parent_perm) { callback({ success: false, message: 'CONTRACT VIOLATION: parent_perm must be the main tag string' }); return; }
          if (typeof permlink !== 'string' || !permlink) { callback({ success: false, message: 'CONTRACT VIOLATION: permlink must be a string' }); return; }
          const mode = window.__kcMode || 'ok';
          const run = async (answer) => {
            try {
              const H = window.hiveTx;
              H.config.node = document.getElementById('rpc').value;
              const op = ['comment', { parent_author: '', parent_permlink: parent_perm, author: account, permlink, title, body, json_metadata: JSON.stringify(json_metadata) }];
              const tx = new H.Transaction([op]);
              await tx.create([op]);
              tx.sign(H.PrivateKey.from(String(await H.PrivateKey.randomKey())));
              await tx.broadcast();
              if (answer) answer({ success: true, message: 'ok', result: { id: tx.txId } });
            } catch (e) { if (answer) answer({ success: false, message: String((e && e.message) || e) }); }
          };
          if (mode === 'refuse') { callback({ success: false, message: 'not now — refused by the press' }); return; }
          if (mode === 'lost') { run(null); return; } /* broadcasts, never answers: outcome unknown */
          run(callback);
        }
      };
    });
    const errs6 = [];
    const page6 = await ctx6.newPage();
    page6.on('pageerror', e => errs6.push(String(e)));
    page6.on('console', m => { if (m.type() === 'error') errs6.push('console: ' + m.text()); });
    await page6.goto(ORIGIN + '/surfaces/bdrop.html#fast');
    await page6.waitForSelector('body[data-reg]', { timeout: 8000 });
    await page6.waitForFunction(() => typeof window.hiveTx === 'object', null, { timeout: 8000 });
    ok('extension present but NOT auto-selected — external signers are chosen explicitly', !(await page6.isChecked('#signer-keychain')));
    await page6.check('#signer-keychain');
    ok('disclosure speaks the keychain truth when it is selected', /never here/.test(await page6.textContent('#keytruth')));
    await page6.fill('#author', 'loviswater');
    await page6.fill('#permlink', 'bdrop-keychain-signer-path');
    await page6.fill('#body', BODY);
    await page6.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await page6.click('#publish');
    await step('keychain path: the drop lands', () => page6.waitForFunction(() => /LANDED/.test(document.getElementById('receipt').textContent || ''), null, { timeout: 30000 }));
    const ob6 = await outboxOf(page6);
    const calls6 = await page6.evaluate(() => window.hive_keychain.__calls);
    ok('upstream contract honored: 9-10 params, callback at #9, parent_account null, json_metadata an Object, permlink a string',
      calls6.length === 1 && calls6[0].n >= 9 && calls6[0].cb_at === 8 && calls6[0].parent_account === null && calls6[0].json_type === 'object' && typeof calls6[0].permlink === 'string' && calls6[0].parent_perm === 'hive',
      JSON.stringify(calls6[0] || {}));
    ok('keychain lifecycle: prepared → authorized → handoff → submitted → confirmed (operation persisted BEFORE handoff)',
      JSON.stringify(ob6[0].events.map(e => e.event)) === JSON.stringify(['prepared', 'authorized', 'handoff', 'submitted', 'confirmed'])
        && ob6[0].signed_tx === null,
      ob6[0].events.map(e => e.event).join(' → '));
    ok('keychain path: byte-compare MATCH receipt', /byte-compare MATCH/.test(await page6.textContent('#receipt')));
    ok('keychain path: the WIF field was never touched', (await page6.inputValue('#wif')) === '');
    ok('keychain path: no WIF-shaped string in any storage', !/5[JK][1-9A-HJ-NP-Za-km-z]{49}/.test(await storageDump(page6)));
    ok('keychain path: exactly one broadcast', mock.broadcasts.length === 1, 'broadcasts=' + mock.broadcasts.length);
    /* explicit refusal — pre-submission, distinguishable from unknown outcome */
    await page6.evaluate(() => { window.__kcMode = 'refuse'; });
    await setMock({ mode: 'normal', contents: { 'bdrop-keychain-refused': '' } }); /* this permlink is NOT on the chain */
    const beforeRefuse = mock.broadcasts.length;
    await page6.fill('#permlink', 'bdrop-keychain-refused');
    await page6.click('#publish');
    await step('explicit refusal is named as refusal, not "nothing was broadcast"', () => page6.waitForFunction(() => /REFUSED the request/.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    const obRef = await outboxOf(page6);
    ok('refusal: record returns to authorized, nothing broadcast', obRef.some(r => r.scope.permlink === 'bdrop-keychain-refused' && r.stage === 'authorized') && mock.broadcasts.length === beforeRefuse);
    /* lost callback — the answer never arrives; outcome UNKNOWN, chain reconciles, no blind retry */
    await page6.evaluate(() => { window.__kcMode = 'lost'; });
    await setMock({ mode: 'normal', contents: { 'bdrop-keychain-lost': '' } });
    await page6.fill('#permlink', 'bdrop-keychain-lost');
    await page6.click('#publish');
    await step('lost callback reported as outcome UNKNOWN', () => page6.waitForFunction(() => /the handoff answer never arrived/.test(document.getElementById('status').textContent || ''), null, { timeout: 20000 }));
    ok('lost-callback: the extension broadcast exactly once before going silent', mock.broadcasts.length === 2, 'broadcasts=' + mock.broadcasts.length);
    await setMock({ mode: 'normal', contents: { 'bdrop-keychain-lost': BODY } }); /* the chain catches up with the extension's broadcast */
    await page6.click('#reconcile');
    await step('lost callback reconciles to confirmed from the chain (no blind retry)', () => page6.waitForFunction(() => /bdrop-keychain-lost[^\n]*confirmed/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 30000 }));
    ok('lost-callback path: the desk never re-broadcast (still exactly 2 total)', mock.broadcasts.length === 2, 'broadcasts=' + mock.broadcasts.length);
    ok('keychain path: no page errors across all sub-cases', errs6.length === 0, errs6[0] || '');
    await ctx6.close();
    /* browser closure DURING handoff — the persisted handoff state survives and reconciles on restart */
    await setMock({ mode: 'normal', contents: { 'bdrop-keychain-closed-midhandoff': '' } });
    const ctx6b = await chromium.launchPersistentContext(dir6, { headless: true });
    await ctx6b.route('https://keys.skaists.dev/**', serveKeysInert); /* hermetic: an inert keychain origin — the probe answers, no keychain loads */
    ctxs.push(ctx6b);
    await ctx6b.addInitScript(() => {
      window.hive_keychain = {
        requestPost: function (account, title, body, parent_perm, parent_account, json_metadata, permlink, comment_options, callback) {
          /* never answers; signs nothing — the browser closes mid-handoff */
        }
      };
    });
    const page6b = await ctx6b.newPage();
    await page6b.goto(ORIGIN + '/surfaces/bdrop.html#fast');
    await page6b.waitForSelector('body[data-reg]', { timeout: 8000 });
    await page6b.waitForFunction(() => typeof window.hiveTx === 'object', null, { timeout: 8000 });
    await page6b.check('#signer-keychain');
    await page6b.fill('#author', 'loviswater');
    await page6b.fill('#permlink', 'bdrop-keychain-closed-midhandoff');
    await page6b.fill('#body', BODY);
    await page6b.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await page6b.click('#publish');
    await step('handoff state persisted before the browser dies', () => page6b.waitForFunction(() => /handoff/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    await ctx6b.close(); /* the browser closes mid-handoff */
    await setMock({ mode: 'normal', content: { permlink: 'bdrop-keychain-closed-midhandoff', body: BODY } });
    const ctx6c = await chromium.launchPersistentContext(dir6, { headless: true });
    await ctx6c.route('https://keys.skaists.dev/**', serveKeysInert); /* hermetic: an inert keychain origin — the probe answers, no keychain loads */
    ctxs.push(ctx6c);
    const page6c = await ctx6c.newPage();
    page6c.on('pageerror', e => errs6.push('restart: ' + String(e)));
    await page6c.goto(ORIGIN + '/surfaces/bdrop.html#fast');
    await page6c.waitForSelector('body[data-reg]', { timeout: 8000 });
    /* EVENT-DRIVEN SETTLE (issues #413/#415, repaired 2026-10-13): the wall-clock windows
       here (20s → 45s → 75s, each starved in turn: runs 38322545384, 38351639383,
       38360498738) measured nothing about the desk — instrumented locally the restart
       page's whole boot is ~0.6s and the reconcile RPC answers at t+180ms with the
       confirmed render at t+292ms, BEFORE the data-reg gate resolves; the eternal job's
       concurrent browsers starve the page's renderer for tens of seconds while the
       node-side clock runs, so any tuned wall can be starved past. The step now waits for
       the page's OWN settle event — the boot reconcile stamps data-boot-settled on the
       outbox when its pass completes (after its own bounded read deadline + one retry) —
       with NO tuned timeout; a broken reconcile settles too and the assertion below names
       the page's answer. The eternal step's 12-min job cap is the outer backstop. */
    await step('restart after mid-handoff closure reconciles from the chain', () => page6c.waitForFunction(() => {
      const box = document.getElementById('outbox');
      return !!box && (box.getAttribute('data-boot-settled') === '1'
        || /bdrop-keychain-closed-midhandoff[^\n]*confirmed/.test(box.textContent || ''));
    }, null, { timeout: 0 }));
    const out6c = await page6c.textContent('#outbox'); /* renderOutbox emits divs: textContent carries no newlines */
    ok('mid-handoff closure: the chain reconciles the record to confirmed (the boot pass settled)', /bdrop-keychain-closed-midhandoff · confirmed/.test(out6c), (out6c.match(/@loviswater\/bdrop-keychain-closed-midhandoff[^@]*/) || [''])[0].slice(0, 120));
    ok('mid-handoff closure: no extra broadcast across the whole keychain scenario', mock.broadcasts.length === 2, 'broadcasts=' + mock.broadcasts.length);
    await ctx6c.close();

    /* ── scenario 6d (the #413 repair's own regression): a restart whose chain read
       STALLS past the desk's read deadline must settle with a NAMED unanswered read —
       the boot pass is never wedged silent — and once the endpoint answers again the
       manual reconcile confirms from the chain. Reads only: a stalled read aborts,
       nothing is broadcast at any point. The waits here carry walls because the page's
       own work is bounded by its OWN deadlines (10s read + 1.5s backoff + 10s retry),
       not by a tuned sleep masking the desk. ── */
    await setMock({ mode: 'normal', content: { permlink: 'bdrop-stalled-read', body: BODY }, stallMs: 12000 });
    mock.broadcasts.length = 0;
    const dir6d = profile('stall'); dirs.push(dir6d);
    const st6d = await open(dir6d);
    const REC6D = { v: 1, id: '@loviswater/bdrop-stalled-read', created_at: '2026-10-13T00:00:00', stage: 'handoff',
      scope: { author: 'loviswater', permlink: 'bdrop-stalled-read', body_sha256: BODY_SHA, body_bytes: 0, disclosure_version: 'x', rpc: `http://127.0.0.1:${PORT}/rpc` },
      body: null, signed_tx: null, events: [], receipt: null, attempts: 0, last_error: null };
    await st6d.page.evaluate(r => localStorage.setItem('bnr.bdrop.outbox.v1', r), JSON.stringify([REC6D]));
    await st6d.page.reload();
    await st6d.page.waitForSelector('body[data-reg]', { timeout: 8000 });
    await step('6d the stalled boot read settles (deadline + one retry, then named)', () => st6d.page.waitForFunction(() => document.getElementById('outbox') && document.getElementById('outbox').getAttribute('data-boot-settled') === '1', null, { timeout: 35000 }));
    const out6d = await st6d.page.textContent('#outbox'); /* divs concatenate: assert the record's own segment */
    const seg6d = (out6d.match(/@loviswater\/bdrop-stalled-read[^@]*/) || [''])[0];
    ok('6d the stalled read is NAMED as an unanswered endpoint — the desk is never wedged silent',
      /bdrop-stalled-read · handoff/.test(seg6d) && /reconcile lookup failed: the endpoint did not answer in 10s — read aborted/.test(seg6d), seg6d.slice(0, 150));
    ok('6d a stalled read broadcast nothing (reads abort, they never re-sign)', mock.broadcasts.length === 0, 'broadcasts=' + mock.broadcasts.length);
    await setMock({ stallMs: 0 }); /* the endpoint answers again */
    await st6d.page.click('#reconcile');
    await step('6d the manual reconcile confirms once the endpoint answers', () => st6d.page.waitForFunction(() => /bdrop-stalled-read[^\n]*confirmed/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    ok('6d recovery broadcast nothing either — the chain was only read', mock.broadcasts.length === 0, 'broadcasts=' + mock.broadcasts.length);
    ok('6d no page errors', st6d.errs.length === 0, st6d.errs[0] || '');
    await st6d.ctx.close();

    /* ── scenario 7: recovery evidence — expected / chain / signature-bound kept SEPARATE ── */
    rmSync(dir1, { recursive: true, force: true }); /* the original browser profile is destroyed, not just closed */
    const dir7 = profile('fresh'); dirs.push(dir7);
    const fr = await open(dir7);
    await step('fresh client: the outbox starts empty', () => fr.page.waitForFunction(() => /outbox is empty/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 8000 }));
    const before = mock.broadcasts.length;
    /* 7a: commitment present and equal → MATCH, but signature evidence stays NONE */
    await setMock({ mode: 'normal', content: null, contents: { 'drop-r-match': BODY }, blockless: true }); /* mainnet shape: no block_num on content reads */
    await fr.page.fill('#author', 'loviswater');
    await fr.page.fill('#permlink', 'drop-r-match');
    await fr.page.fill('#body', BODY);
    await fr.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await fr.page.click('#recover');
    await step('7a recovered with a matching commitment', () => fr.page.waitForFunction(() => /equals the committed bytes/.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    const obA = await outboxOf(fr.page);
    const rcA = obA.find(r => r.scope.permlink === 'drop-r-match');
    ok('7a MATCH verdict with expected and chain hashes RECORDED SEPARATELY',
      !!(rcA && rcA.receipt && rcA.receipt.body_byte_compare === 'MATCH' && rcA.receipt.body_sha256_expected === BODY_SHA && rcA.receipt.body_sha256_chain === BODY_SHA && rcA.receipt.body_sha256_expected !== undefined));
    ok('7a signature evidence honestly NONE — no signing provenance invented',
      rcA.receipt.signature_bound_hash === null && /NONE/.test(rcA.receipt.signing_evidence) && rcA.receipt.txid === null && /UNVERIFIED/.test(rcA.receipt.inclusion));
    ok('7a the recovered EDITION BYTES ride the record', rcA.body === BODY);
    ok('7a a blockless chain answer renders created-time, never \'undefined\'', /created \d/.test(await fr.page.textContent('#receipt')) && !(await fr.page.textContent('#receipt')).includes('undefined'), (await fr.page.textContent('#receipt')).slice(0, 120));
    await setMock({ mode: 'normal', content: null, contents: null, blockless: false });
    /* 7b: commitment differs → DIVERGED, both digests recorded */
    await setMock({ mode: 'normal', content: { permlink: 'drop-r-diverge', body: 'someone replaced the body' } });
    await fr.page.fill('#permlink', 'drop-r-diverge');
    await fr.page.fill('#body', BODY);
    await fr.page.click('#recover');
    await step('7b divergent recovery reported', () => fr.page.waitForFunction(() => /DIFFERS from the committed bytes/.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    const rcB = (await outboxOf(fr.page)).find(r => r.scope.permlink === 'drop-r-diverge');
    ok('7b DIVERGED verdict — never a self-compared MATCH', !!(rcB && rcB.receipt && rcB.receipt.body_byte_compare === 'DIVERGED' && rcB.receipt.body_sha256_expected === BODY_SHA && rcB.receipt.body_sha256_chain !== BODY_SHA && rcB.stage === 'diverged'));
    /* 7c: no commitment in the desk → UNVERIFIED, not MATCH */
    await setMock({ mode: 'normal', content: { permlink: 'drop-r-noexp', body: BODY } });
    await fr.page.fill('#permlink', 'drop-r-noexp');
    await fr.page.fill('#body', '');
    await fr.page.click('#recover');
    await step('7c commitment-free recovery says UNVERIFIED', () => fr.page.waitForFunction(() => /NO commitment/.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    const rcC = (await outboxOf(fr.page)).find(r => r.scope.permlink === 'drop-r-noexp');
    ok('7c UNVERIFIED verdict — a missing commitment never converts to MATCH',
      !!(rcC && rcC.receipt && rcC.receipt.body_byte_compare === 'UNVERIFIED' && rcC.receipt.body_sha256_expected === null && rcC.receipt.body_sha256_chain === BODY_SHA && rcC.body === BODY));
    ok('recovery scenarios broadcast nothing', mock.broadcasts.length === before);
    /* 7d: untrusted RPC answer — malformed content is refused, nothing manufactured */
    await setMock({ mode: 'normal', junk: true, content: { permlink: 'drop-r-junk', body: BODY } });
    await fr.page.fill('#permlink', 'drop-r-junk');
    await fr.page.fill('#body', BODY);
    await fr.page.click('#recover');
    await step('7d malformed endpoint answer refused', () => fr.page.waitForFunction(() => /did not read as content/.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('7d no record manufactured from a malformed answer', !(await outboxOf(fr.page)).some(r => r.scope.permlink === 'drop-r-junk'));
    ok('fresh-client + negative scenarios produced no page errors', fr.errs.length === 0, fr.errs[0] || '');
    await fr.ctx.close();

    /* ── scenario 8: the native door — the estate's isolated keychain, no extension, no paste ──
       The desk runs at https://skaists.dev (route-fulfilled from the real tree, because the
       keychain only opens for that parent), the keychain at https://keys.skaists.dev, and the
       mock chain at https://hive-mock.test/rpc proxied to this file's one mock server. The
       passkey is a CDP virtual authenticator with PRF. No hive_keychain extension is injected,
       and the native radio is only ENABLED by the mount — the reader's own press chooses it. */
    await setMock({ mode: 'normal', content: null, junk: false, accounts: {}, lastBody: null });
    mock.broadcasts.length = 0;
    const dir8 = profile('native'); dirs.push(dir8);
    const ctx8 = await chromium.launchPersistentContext(dir8, { headless: true });
    ctxs.push(ctx8);
    const serve = async (r, rel) => {
      try {
        const file = join(ROOT, rel);
        if (!file.startsWith(ROOT)) throw new Error('escape');
        const data = await readFile(file);
        await r.fulfill({ status: 200, body: data, contentType: MIME[extname(file)] || 'application/octet-stream' });
      } catch { await r.fulfill({ status: 404, body: 'no' }); }
    };
    await ctx8.route('https://keys.skaists.dev/**', r => {
      const p = new URL(r.request().url()).pathname;
      return KCFILES[p] ? serve(r, KCFILES[p]) : r.fulfill({ status: 404, body: '' });
    });
    await ctx8.route('https://skaists.dev/**', r => serve(r, decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\//, '')) || 'surfaces/bdrop.html'));
    await ctx8.route('https://hive-mock.test/rpc', async r => {
      const resp = await fetch(`http://127.0.0.1:${PORT}/rpc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: r.request().postData() });
      await r.fulfill({ status: resp.status, body: await resp.text(), contentType: 'application/json' });
    });
    const errs8 = [];
    const page8 = await ctx8.newPage();
    page8.on('pageerror', e => errs8.push(String(e)));
    const cdp8 = await ctx8.newCDPSession(page8);
    await cdp8.send('WebAuthn.enable');
    await cdp8.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true } });
    await page8.goto('https://skaists.dev/surfaces/bdrop.html#fast');
    await page8.waitForSelector('body[data-reg]', { timeout: 8000 });
    await page8.waitForFunction(() => typeof window.hiveTx === 'object', null, { timeout: 8000 });
    ok('no extension in this browser at all', await page8.evaluate(() => typeof window.hive_keychain === 'undefined'));
    const bdropHtml = await readFile(join(ROOT, 'surfaces/bdrop.html'), 'utf8');
    ok('the native door ships disabled in the page source — only the mount enables it', /id="signer-native" disabled/.test(bdropHtml));
    await page8.waitForSelector('#kc-slot iframe', { timeout: 20000 });
    const kframe = page8.frames().find(f => f.url().startsWith('https://keys.skaists.dev/'));
    ok('the keychain runs at its own origin inside the desk', !!kframe);
    await kframe.getByRole('button', { name: 'Make my keychain' }).click();
    await page8.waitForFunction(() => window.bdropKeychain && bdropKeychain.state.state === 'unlocked', null, { timeout: 20000 });
    await step('the native door is enabled once the keychain answers', () => page8.waitForFunction(() => !document.getElementById('signer-native').disabled, null, { timeout: 10000 }));
    ok('still not auto-selected — the reader chooses', !(await page8.isChecked('#signer-native')));
    await page8.check('#signer-native');
    const pub8 = await page8.evaluate(() => bdropKeychain.signer().hivePub('loviswater').then(p => p.pub));
    await setMock({ accounts: { loviswater: [pub8] }, lastBody: null }); /* the chain — not the page — authorizes the key */
    await page8.fill('#author', 'loviswater');
    await page8.fill('#permlink', 'bdrop-native-keychain-door');
    await page8.fill('#body', BODY);
    await page8.fill('#expected', BODY_SHA);
    await page8.fill('#rpc', 'https://hive-mock.test/rpc');
    await page8.click('#publish');
    try {
      await kframe.getByRole('button', { name: 'Sign this drop' }).waitFor({ timeout: 15000 });
    } catch (e) {
      const st = await page8.locator('#status').innerText();
      const kt = await kframe.locator('#kc').innerText().catch(() => 'unreadable');
      console.log('S8-DESK-STATUS: ' + st.split('\n').join(' | '));
      console.log('S8-KEYCHAIN: ' + kt.split('\n').join(' | '));
      throw e;
    }
    ok('the keychain card names the drop and its authority', /no funds can move/.test(await kframe.locator('#kc').innerText()));
    await page8.waitForTimeout(900); /* the delayed press, as a person would */
    await kframe.getByRole('button', { name: 'Sign this drop' }).click();
    await step('native keychain path: the drop lands', () => page8.waitForFunction(() => /LANDED/.test(document.getElementById('receipt').textContent || ''), null, { timeout: 30000 }));
    const ob8 = await outboxOf(page8);
    const rec8 = ob8.find(r => r.scope.permlink === 'bdrop-native-keychain-door');
    ok('native lifecycle: prepared → authorized → handoff → signed → submitted → confirmed with the keychain named',
      JSON.stringify(rec8.events.map(e => e.event)) === JSON.stringify(['prepared', 'authorized', 'handoff', 'signed', 'submitted', 'confirmed'])
        && rec8.events[1].signer === 'native-keychain' && rec8.events[3].signer === 'native-keychain',
      rec8.events.map(e => e.event).join(' → '));
    ok('the SIGNED transaction is held by the desk (restart can re-broadcast without any key)',
      !!(rec8.signed_tx && rec8.signed_tx.signatures && /^[0-9a-f]{130}$/.test(rec8.signed_tx.signatures[0])));
    ok('the broadcast carried that very signature through the desk\u2019s own endpoint',
      mock.broadcasts.length === 1 && mock.broadcasts[0].signatures[0] === rec8.signed_tx.signatures[0]);
    ok('native path: the WIF field was never touched', (await page8.inputValue('#wif')) === '');
    ok('native path: no WIF-shaped string in any storage', !/5[JK][1-9A-HJ-NP-Za-km-z]{49}/.test(await storageDump(page8)));
    ok('native path: receipt is byte-compare MATCH', /byte-compare MATCH/.test(await page8.textContent('#receipt')));
    ok('native path: no page errors', errs8.length === 0, errs8[0] || '');

    /* the authority gate: an unauthorized key is refused BY NAME — nothing signed, no fallback */
    await setMock({ mode: 'normal', junk: false, content: null, accounts: { loviswater: ['STM1111111111111111111111111111111114T1Anm'] }, lastBody: null });
    await page8.fill('#permlink', 'bdrop-unauthorized-probe');
    await page8.fill('#body', BODY);
    await page8.click('#publish');
    await step('unauthorized posting key is refused by name', () => page8.waitForFunction(() => /NOT an authorized posting key/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('unauthorized key: nothing more was broadcast', mock.broadcasts.length === 1, 'broadcasts=' + mock.broadcasts.length);
    ok('unauthorized key: no confirm card ever stood in the keychain', (await kframe.getByRole('button', { name: 'Sign this drop' }).count()) === 0);
    const rec8b = (await outboxOf(page8)).find(r => r.scope.permlink === 'bdrop-unauthorized-probe');
    ok('unauthorized attempt left no signed record and names its refusal',
      !!(rec8b && !rec8b.signed_tx && /not an authorized posting key/i.test(rec8b.last_error || '')), (rec8b && rec8b.last_error || 'no record').slice(0, 80));
    await ctx8.close();

    /* ── scenario 9: the two quarantine gaps (Agent 30, 2026-10-13) ──
       (a) a transaction that EXECUTED before expiry, first seen through a stale
       empty read, must never be labeled resolved-expired — expiry establishes
       neither non-execution nor endpoint completeness;
       (b) archiving a damaged journal that holds an unresolved HANDOFF must carry
       that uncertainty across restart and refuse a replacement submission of the
       SAME operation — until the chain establishes its fate, and then the desk
       CONFIRMS the landing instead of republishing. Independence: a different
       scope proceeds under its own pre-flight. ── */
    await setMock({ mode: 'normal', content: null, junk: false, accounts: {}, lastBody: null });
    mock.broadcasts.length = 0;
    const PAST9 = new Date(Date.now() - 7200e3).toISOString().slice(0, 19);
    const mkOp = (pl, sha, stage, exp) => ({ v: 1, id: '@alice/' + pl, created_at: '2026-10-13T00:00:00', stage: stage,
      scope: { author: 'alice', permlink: pl, body_sha256: sha, body_bytes: 0, disclosure_version: 'x', rpc: `http://127.0.0.1:${PORT}/rpc` },
      body: null, signed_tx: exp ? { expiration: exp } : null, events: [], receipt: null, attempts: 0, last_error: null });
    const dir9 = profile('quargap'); dirs.push(dir9);
    const q9 = await open(dir9);
    /* (a) the stale view: drop-stale executed before expiry, but this read is empty */
    await setMock({ mode: 'normal', contents: { 'drop-stale': '' }, accounts: {}, lastBody: null });
    const RAW9a = JSON.stringify([mkOp('drop-stale', BODY_SHA, 'signed', PAST9)]).slice(0, -1) + ',"corrupt';
    await q9.page.evaluate(r => { localStorage.setItem('bnr.bdrop.outbox.v1', r); localStorage.removeItem('bnr.bdrop.outbox.v1.damaged'); }, RAW9a);
    await q9.page.reload();
    await q9.page.waitForSelector('body[data-reg]', { timeout: 8000 });
    await q9.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await q9.page.click('#recover'); /* corrupt-mode reconciliation against the STALE view */
    await step('9a reconciliation against the stale view reports the operation', () => q9.page.waitForFunction(() => /drop-stale/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    let txt9a = await q9.page.textContent('#outbox');
    ok('9a an expired signed tx through an empty read stays UNRESOLVED — never resolved-expired',
      /drop-stale[^\n]*unresolved/.test(txt9a) && !/drop-stale[^\n]*resolved-expired/.test(txt9a),
      (txt9a.split('\n').find(l => l.includes('drop-stale')) || '').slice(0, 150));
    ok('9a the note names expiry as non-proof (stale or incomplete reads are possible)', /NOT proof|stale/i.test(txt9a));
    /* the endpoint catches up: drop-stale HAD executed — proving the label would have been wrong */
    await setMock({ mode: 'normal', contents: { 'drop-stale': BODY }, accounts: {}, lastBody: null });
    await q9.page.click('#recover');
    await step('9a the caught-up view resolves it as LANDED', () => q9.page.waitForFunction(() => /drop-stale[^\n]*resolved-confirmed/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    ok('9a the op that "expired" actually landed — the mislabel window is closed by construction', /drop-stale[^\n]*resolved-confirmed/.test(await q9.page.textContent('#outbox')));
    /* (b) a damaged journal holding an unresolved HANDOFF */
    const RAW9b = JSON.stringify([mkOp('drop-handoff', BODY_SHA, 'handoff', null)]).slice(0, -1) + ','; /* trailing structural comma: whole-parse fails, the operation parses, NO residue */
    await q9.page.evaluate(r => { localStorage.setItem('bnr.bdrop.outbox.v1', r); localStorage.removeItem('bnr.bdrop.outbox.v1.damaged'); localStorage.removeItem('bnr.bdrop.quarantine.v1'); }, RAW9b);
    await q9.page.reload();
    await q9.page.waitForSelector('body[data-reg]', { timeout: 8000 });
    await setMock({ mode: 'normal', contents: { 'drop-handoff': '' }, accounts: {}, lastBody: null });
    await q9.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await q9.page.click('#recover');
    await step('9b the unresolved handoff is named', () => q9.page.waitForFunction(() => /drop-handoff[^\n]*unresolved/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    q9.page.once('dialog', d => d.accept());
    await q9.page.click('#damaged-archive');
    await step('9b the deliberate archive completes', () => q9.page.waitForFunction(() => /archived deliberately/.test(document.getElementById('status').textContent || ''), null, { timeout: 8000 }));
    const ledger9 = await q9.page.evaluate(() => JSON.parse(localStorage.getItem('bnr.bdrop.quarantine.v1') || '[]'));
    ok('9b the archive CARRIES the unresolved handoff into a durable quarantine ledger',
      ledger9.some(e => e.scope && e.scope.permlink === 'drop-handoff' && e.outcome === 'unresolved'),
      JSON.stringify(ledger9.map(e => (e.scope ? e.scope.permlink : '?') + ':' + e.outcome)));
    /* RESTART: uncertainty and duplicate-prevention must survive */
    await q9.page.reload();
    await q9.page.waitForSelector('body[data-reg]', { timeout: 8000 });
    await step('9b the quarantine ledger survives the restart and renders', () => q9.page.waitForFunction(() => /quarantine ledger/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 8000 }));
    await setMock({ mode: 'normal', contents: { 'drop-handoff': '' }, accounts: {}, lastBody: null });
    await q9.page.fill('#author', 'alice');
    await q9.page.fill('#permlink', 'drop-handoff');
    await q9.page.fill('#body', BODY);
    await q9.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await q9.page.click('#publish');
    await step('9b the SAME operation is refused after restart — the archive authorized no replacement',
      () => q9.page.waitForFunction(() => /quarantine ledger/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('9b resubmission attempt broadcast nothing', mock.broadcasts.length === 0, 'broadcasts=' + mock.broadcasts.length);
    await q9.page.fill('#permlink', 'drop-independent');
    await q9.page.click('#publish');
    await step('9b an independent scope proceeds under its own guards (not held hostage by the ledger)',
      () => q9.page.waitForFunction(() => /no posting key given/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    /* the chain establishes drop-handoff's fate: it HAD landed */
    await setMock({ mode: 'normal', contents: { 'drop-handoff': BODY }, accounts: {}, lastBody: null });
    await q9.page.fill('#permlink', 'drop-handoff');
    await q9.page.fill('#body', ''); /* an empty desk — the LEDGER's own commitment must do the comparing */
    await q9.page.click('#recover');
    await step('9b recovery resolves the ledger entry from its own commitment', () => q9.page.waitForFunction(() => /drop-handoff[^\n]*resolved-confirmed/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    const ledger9b = await q9.page.evaluate(() => JSON.parse(localStorage.getItem('bnr.bdrop.quarantine.v1') || '[]'));
    ok('9b the ledger entry itself is resolved-confirmed (durable state updated, not just prose)', ledger9b.some(e => e.scope && e.scope.permlink === 'drop-handoff' && e.outcome === 'resolved-confirmed'));
    await q9.page.fill('#body', BODY);
    await q9.page.click('#publish');
    await step('9b after resolution the desk CONFIRMS the landing instead of republishing',
      () => q9.page.waitForFunction(() => /already published — identical bytes confirmed/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('9b the whole quarantine-gap sequence broadcast nothing', mock.broadcasts.length === 0, 'broadcasts=' + mock.broadcasts.length);
    ok('9 scenario produced no page errors', q9.errs.length === 0, q9.errs[0] || '');
    await q9.ctx.close();

    /* ── scenario 10: MAINNET's not-found shape — get_content ASSERTS for a post that
       does not exist (the founder's live finding 2026-10-13 05:16:36, verbatim:
       "rpc error: Assert Exception:Post loviswater/bdrop-0001-genesis-… does not exist").
       The desk must read that assert as NOT LANDED — reading it as an outage would
       block every first publication and every reconciliation on mainnet ── */
    await setMock({ mode: 'normal', content: null, contents: null, junk: false, accounts: {}, lastBody: null, hive: true });
    mock.broadcasts.length = 0;
    const dir10 = profile('hiveassert'); dirs.push(dir10);
    const h10 = await open(dir10);
    await h10.page.fill('#author', 'loviswater');
    await h10.page.fill('#permlink', 'bdrop-first-publication-probe');
    await h10.page.fill('#body', BODY);
    await h10.page.fill('#expected', BODY_SHA);
    await h10.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await h10.page.fill('#wif', await h10.page.evaluate(() => String(window.hiveTx.PrivateKey.randomKey())));
    await h10.page.click('#publish');
    await step('10 the mainnet assert-shaped not-found is read as NOT LANDED — the first publication proceeds and lands', () => h10.page.waitForFunction(() => /LANDED/.test(document.getElementById('receipt').textContent || ''), null, { timeout: 30000 }));
    ok('10 a FIRST publication survives the assert-shaped not-found, byte-exact', /byte-compare MATCH/.test(await h10.page.textContent('#receipt')));
    ok('10 exactly one broadcast', mock.broadcasts.length === 1, 'broadcasts=' + mock.broadcasts.length);
    /* recovery for a permlink the chain does not hold: the assert is the endpoint's own not-found */
    await setMock({ mode: 'normal', content: null, contents: null, junk: false, accounts: {}, lastBody: null, hive: true });
    await h10.page.fill('#permlink', 'bdrop-never-published');
    await h10.page.click('#recover');
    await step('10 recovery reports the honest not-found through the assert', () => h10.page.waitForFunction(() => /no such drop/.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('10 recovery manufactured no record from the not-found', !(await outboxOf(h10.page)).some(r => r.scope.permlink === 'bdrop-never-published'));
    ok('10 scenario produced no page errors', h10.errs.length === 0, h10.errs[0] || '');
    await h10.ctx.close();

    /* ── scenario 11: the quarantine LEDGER's own failure classes (Agent 30, 2026-10-13) ──
       corruption-after-archive, missing-with-damaged-copy, and the unknown-residue marker
       that makes independence impossible for ANY scope while it stands ── */
    await setMock({ mode: 'normal', content: null, contents: null, junk: false, accounts: {}, lastBody: null, hive: false, gettx: 'ok' });
    mock.broadcasts.length = 0;
    const dir11 = profile('quargap2'); dirs.push(dir11);
    const g11 = await open(dir11);
    const op11 = mkOp('gap-handoff', BODY_SHA, 'handoff', null);
    const RAW11 = JSON.stringify([op11]).slice(0, -1) + ',{"unknown-junk":1} tail]'; /* whole-parse fails; the junk group is unknowable residue */
    await g11.page.evaluate(r => { localStorage.setItem('bnr.bdrop.outbox.v1', r); localStorage.removeItem('bnr.bdrop.outbox.v1.damaged'); localStorage.removeItem('bnr.bdrop.quarantine.v1'); localStorage.removeItem('bnr.bdrop.quarantine.v1.damaged'); }, RAW11);
    await g11.page.reload();
    await g11.page.waitForSelector('body[data-reg]', { timeout: 8000 });
    await setMock({ mode: 'normal', contents: { 'gap-handoff': '' }, accounts: {}, lastBody: null, hive: false, gettx: 'ok' });
    await g11.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await g11.page.click('#recover');
    await step('11 the unresolved handoff is named', () => g11.page.waitForFunction(() => /gap-handoff[^\n]*unresolved/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 15000 }));
    g11.page.once('dialog', d => d.accept());
    await g11.page.click('#damaged-archive');
    await step('11 archive completes with residue', () => g11.page.waitForFunction(() => /archived deliberately/.test(document.getElementById('status').textContent || ''), null, { timeout: 8000 }));
    const q11 = await g11.page.evaluate(() => JSON.parse(localStorage.getItem('bnr.bdrop.quarantine.v1') || '[]'));
    ok('11 the unparseable residue rides the ledger as an UNKNOWN-SCOPE marker', q11.some(e => e.unknown_scope === true && e.outcome === 'unresolved'));
    /* (a) restart with the residue marker standing: independence is impossible for ANY scope */
    await g11.page.reload();
    await g11.page.waitForSelector('body[data-reg]', { timeout: 8000 });
    await step('11 the unknown-residue marker survives restart and renders', () => g11.page.waitForFunction(() => /unknown operation|UNPARSEABLE residue/i.test(document.getElementById('outbox').textContent || ''), null, { timeout: 8000 }));
    await g11.page.fill('#author', 'alice');
    await g11.page.fill('#permlink', 'anything-at-all');
    await g11.page.fill('#body', BODY);
    await g11.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await g11.page.click('#publish');
    await step('11 unknown residue refuses EVERY scope — independence is impossible', () => g11.page.waitForFunction(() => /independence cannot be established/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('11 nothing broadcast under the residue marker', mock.broadcasts.length === 0);
    /* (b) corruption of the ledger itself after archive: the protection must not vanish */
    await g11.page.evaluate(() => { localStorage.setItem('bnr.bdrop.quarantine.v1', '{"broken'); localStorage.removeItem('bnr.bdrop.quarantine.v1.damaged'); });
    await g11.page.reload();
    await g11.page.waitForSelector('body[data-reg]', { timeout: 8000 });
    await step('11 a damaged ledger is reported, never emptied', () => g11.page.waitForFunction(() => /LEDGER is DAMAGED|LEDGER is MISSING/i.test(document.getElementById('outbox').textContent || ''), null, { timeout: 8000 }));
    ok('11 damaged ledger bytes preserved verbatim', (await g11.page.evaluate(() => localStorage.getItem('bnr.bdrop.quarantine.v1'))) === '{"broken');
    ok('11 damaged ledger copy stored under .damaged', (await g11.page.evaluate(() => localStorage.getItem('bnr.bdrop.quarantine.v1.damaged'))) === '{"broken');
    await g11.page.fill('#author', 'alice');
    await g11.page.fill('#permlink', 'while-ledger-damaged');
    await g11.page.fill('#body', BODY);
    await g11.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await g11.page.click('#publish');
    await step('11 a damaged ledger refuses all submissions', () => g11.page.waitForFunction(() => /LEDGER itself is damaged|no submission can be proven independent/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    /* (c) a vanished ledger while its damaged copy exists */
    await g11.page.evaluate(() => { localStorage.removeItem('bnr.bdrop.quarantine.v1'); });
    await g11.page.reload();
    await g11.page.waitForSelector('body[data-reg]', { timeout: 8000 });
    await step('11 a vanished ledger with a damaged copy present is reported', () => g11.page.waitForFunction(() => /LEDGER is MISSING/i.test(document.getElementById('outbox').textContent || ''), null, { timeout: 8000 }));
    await g11.page.fill('#author', 'alice');
    await g11.page.fill('#permlink', 'while-ledger-missing');
    await g11.page.fill('#body', BODY);
    await g11.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await g11.page.click('#publish');
    await step('11 the missing-ledger state also refuses everything', () => g11.page.waitForFunction(() => /LEDGER itself is missing/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    ok('11 scenario broadcast nothing', mock.broadcasts.length === 0, 'broadcasts=' + mock.broadcasts.length);
    ok('11 no page errors', g11.errs.length === 0, g11.errs[0] || '');
    await g11.ctx.close();

    /* ── scenario 12: the preservation door's own gates — no spend, no kit, no price ── */
    const dir12 = profile('antgate'); dirs.push(dir12);
    const ctx12 = await chromium.launchPersistentContext(dir12, { headless: true });
    ctxs.push(ctx12);
    await ctx12.addInitScript(() => { window.ethereum = { request: async () => { throw new Error('this wallet is never called in this test'); } }; });
    const p12 = await ctx12.newPage();
    p12.on('pageerror', e => errs12.push(String(e)));
    const errs12 = [];
    let dialogMode = 'accept';
    p12.on('dialog', d => { dialogMode === 'accept' ? d.accept() : d.dismiss(); });
    await p12.goto(ORIGIN + '/surfaces/bdrop.html#fast');
    await p12.waitForSelector('body[data-reg]', { timeout: 8000 });
    await p12.waitForFunction(() => typeof window.hiveTx === 'object', null, { timeout: 8000 });
    ok('12 the preservation door stays hidden until a drop confirms', await p12.isVisible('#ant-fee-limit') === false);
    await setMock({ mode: 'normal', content: null, contents: null, junk: false, accounts: {}, lastBody: null, hive: false, gettx: 'ok' });
    await p12.fill('#author', 'alice');
    await p12.fill('#permlink', 'preserve-gate-probe');
    await p12.fill('#body', BODY);
    await p12.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await p12.fill('#wif', await p12.evaluate(() => String(window.hiveTx.PrivateKey.randomKey())));
    await p12.click('#publish');
    await step('12 the probe drop lands (and unlocks the preservation door)', () => p12.waitForFunction(() => /LANDED/.test(document.getElementById('receipt').textContent || ''), null, { timeout: 30000 }));
    /* no ceiling set → nothing is priced (the operator's own authorization) */
    await p12.click('#preserve-ant');
    await step('12 an absent network-fee limit refuses to price anything', () => p12.waitForFunction(() => /network-fee limit/.test(document.getElementById('pstatus').textContent || '') && /will not price/.test(document.getElementById('pstatus').textContent || ''), null, { timeout: 15000 }));
    /* a zero ceiling authorizes nothing */
    await p12.fill('#ant-fee-limit', '0');
    await p12.click('#preserve-ant');
    await step('12 a zero ceiling authorizes nothing', () => p12.waitForFunction(() => /zero network-fee limit/.test(document.getElementById('pstatus').textContent || ''), null, { timeout: 15000 }));
    /* declining the external wallet stops BEFORE any kit load */
    await p12.fill('#ant-fee-limit', '20000000');
    dialogMode = 'dismiss';
    await p12.click('#preserve-ant');
    await step('12 declining the external wallet stops with nothing attempted', () => p12.waitForFunction(() => /no signer chosen/.test(document.getElementById('pstatus').textContent || ''), null, { timeout: 15000 }));
    ok('12 the external-wallet choice happened before any kit load', !(await p12.textContent('#pstatus')).includes('Autonomi browser kit'));
    ok('12 nothing was spent or priced in the gate tests', !(await p12.textContent('#pstatus')).includes('invoice'));
    ok('12 no page errors', errs12.length === 0, errs12[0] || '');
    await ctx12.close();

    /* ── scenario 13: the inclusion-VERIFIER adversarial battery (Agent 30, 2026-10-13)
       a numeric block_num alone is NOT inclusion; the answer must BE the named
       transaction, carry THIS drop's comment op with the committed body, and the named
       block must CONTAIN the transaction before any finality rule applies ── */
    const dir13 = profile('inclverify'); dirs.push(dir13);
    const i13 = await open(dir13);
    const CASES = [
      { name: 'minimal numeric-block answer is REJECTED (the source counterexample)', opts: { txshape: 'minimal' }, note: /no operations|did not read as a transaction/, reject: true },
      { name: 'a DIFFERENT transaction id is rejected', opts: { txshape: 'wrongid' }, note: /DIFFERENT transaction id/, reject: true },
      { name: 'empty operations rejected', opts: { txshape: 'noops' }, note: /no operations/, reject: true },
      { name: 'a transaction without this drop\u2019s comment op rejected', opts: { txshape: 'wrongop' }, note: /does not carry this drop/, reject: true },
      { name: 'a body that differs from the committed edition rejected', opts: { txshape: 'wrongbody' }, note: /differs from the committed edition/, reject: true },
      { name: 'a transaction absent from its named block rejected', opts: { txshape: 'ok', getblock: 'empty' }, note: /does not contain it/, reject: true },
      { name: 'a malformed irreversible height stays uncertainty (inclusion may stand; finality may not)', opts: { txshape: 'ok', badlib: true }, note: /malformed|absent irreversible/, finalityBad: true },
      { name: 'an unavailable history lookup stays uncertainty', opts: { gettx: 'fail' }, note: /unavailable/, reject: true },
      { name: 'the truthful full answer is accepted (id + op + body + block membership + LIB)', opts: { txshape: 'ok' }, note: /answered/, reject: false },
    ];
    let n13 = 0;
    for (const c of CASES) {
      n13++;
      await setMock(Object.assign({ mode: 'normal', content: null, contents: null, junk: false, accounts: {}, lastBody: null, hive: false, gettx: 'ok', getblock: 'ok', badlib: false, txshape: 'ok' }, c.opts));
      const pl = 'inc13-' + n13;
      await i13.page.click('#wipe'); /* a key session is bound to ONE scope — each case presents its own */
      mock.s13n = String(n13); mock.s13body = BODY; mock.s13pl = pl; mock.s13author = 'alice'; /* the mock answers THIS drop's exact op */
      await i13.page.fill('#author', 'alice');
      await i13.page.fill('#permlink', pl);
      await i13.page.fill('#body', BODY);
      await i13.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
      await i13.page.fill('#wif', await i13.page.evaluate(() => String(window.hiveTx.PrivateKey.randomKey())));
      await i13.page.click('#publish');
      try {
        await step('13 case ' + n13 + ' settles', () => i13.page.waitForFunction((p2) => {
          const rs = JSON.parse(localStorage.getItem('bnr.bdrop.outbox.v1') || '[]');
          return rs.some(r => r.scope && r.scope.permlink === p2 && r.receipt && r.receipt.evidence && r.receipt.evidence.inclusion_note);
        }, pl, { timeout: 30000 }));
      } catch (e13) {
        console.log('S13-CASE-' + n13 + ' STATUS: ' + ((await i13.page.textContent('#status')) || '').slice(0, 500));
        console.log('S13-CASE-' + n13 + ' OUTBOX: ' + ((await i13.page.textContent('#outbox')) || '').slice(0, 300));
        throw e13;
      }
      const rec13 = (await outboxOf(i13.page)).find(r => r.scope.permlink === pl);
      const ev13 = (rec13 && rec13.receipt && rec13.receipt.evidence) || {};
      const included = !!ev13.tx_included;
      const note = String(ev13.inclusion_note || '');
      if (c.finalityBad) {
        ok('13 ' + c.name, included === true && ev13.tx_included.block_checked === true && typeof ev13.finality === 'string' && c.note.test(ev13.finality), 'included=' + included + ' finality=' + JSON.stringify(ev13.finality));
      } else if (c.reject) {
        ok('13 ' + c.name, !included && c.note.test(note), 'included=' + included + ' note=' + note.slice(0, 90));
      } else {
        ok('13 ' + c.name, included && ev13.tx_included.block_checked === true && ev13.finality && ev13.finality.irreversible === true, JSON.stringify(ev13).slice(0, 120));
      }
    }
    ok('13 no page errors', i13.errs.length === 0, i13.errs[0] || '');
    await i13.ctx.close();
  } finally {
    for (const c of ctxs) { try { await c.close(); } catch {} }
    for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
    server.close();
  }
  assert.equal(failures, 0, failures + ' lifecycle assertion(s) failed — see the ✗ lines above');
  console.log(failures === 0 ? 'BDROP LIFECYCLE GREEN — editions, happy path, duplicates, restart, ambiguity, unavailability, divergence, retrieval, key hygiene, the quarantined journal, the contract-faithful keychain signer, mid-handoff closure, evidence-honest fresh-client recovery, the native keychain door (authority-checked, signature-verified, no extension, no paste), the two quarantine gaps (expiry never proves non-execution; an archive never authorizes a replacement) and mainnet\u2019s assert-shaped not-found (a first publication still proceeds) all held. nothing touched hive.' : 'BDROP LIFECYCLE RED.');
});
