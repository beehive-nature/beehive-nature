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
    if (mock.junk) return { author: 123, body: { not: 'a string' }, block_num: 'weird' }; /* the untrusted-endpoint shape */
    if (mock.contents && Object.prototype.hasOwnProperty.call(mock.contents, params.permlink))
      return { author: params.author, permlink: params.permlink, body: mock.contents[params.permlink], block_num: 48000112, created: new Date().toISOString().slice(0, 19) };
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
    const o = JSON.parse(b);
    mock.mode = o.mode ?? mock.mode; mock.content = o.content ?? null; mock.contents = o.contents ?? null; mock.junk = !!o.junk;
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
const ctxs = []; /* every browser context, so a failure path never leaks one into CI's pool */
async function open(profileDir) {
  const ctx = await chromium.launchPersistentContext(profileDir, { headless: true });
  ctxs.push(ctx);
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
      mkRec('drop-d', NEVER_SHA, PAST),         /* will resolve: expired (cannot land anymore) */
    ];
    const RAW5 = JSON.stringify(J5).slice(0, -1) + ',{"v":1,"id":"@zombie/trunca'; /* whole-parse fails; the four real objects still parse */
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
    ok('partial recovery: drop-d resolved-expired (cannot land anymore)', /drop-d[^\n]*resolved-expired/.test(outTxt));
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
    await step('after the deliberate archive the normal guards apply again', () => cor0.page.waitForFunction(() => /no posting key given/i.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    await cor0.ctx.close();

    /* ── scenario 6: the keychain signer — CONTRACT-FAITHFUL to upstream requestPost
       (account, title, body, parent_perm, parent_account=null, json_metadata=Object,
        permlink, comment_options, callback NINTH, rpc) — pinned from
       hive-keychain-extension master documentation/README.md ── */
    await setMock({ mode: 'normal', content: null });
    mock.broadcasts.length = 0; mock.lastBody = null;
    const dir6 = profile('keychain'); dirs.push(dir6);
    const ctx6 = await chromium.launchPersistentContext(dir6, { headless: true });
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
    await step('lost callback reported as outcome UNKNOWN', () => page6.waitForFunction(() => /outcome UNKNOWN|outcome is UNKNOWN/.test(document.getElementById('status').textContent || ''), null, { timeout: 20000 }));
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
    ctxs.push(ctx6c);
    const page6c = await ctx6c.newPage();
    page6c.on('pageerror', e => errs6.push('restart: ' + String(e)));
    await page6c.goto(ORIGIN + '/surfaces/bdrop.html#fast');
    await page6c.waitForSelector('body[data-reg]', { timeout: 8000 });
    await step('restart after mid-handoff closure reconciles from the chain', () => page6c.waitForFunction(() => /bdrop-keychain-closed-midhandoff[^\n]*confirmed/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 20000 }));
    ok('mid-handoff closure: no extra broadcast across the whole keychain scenario', mock.broadcasts.length === 2, 'broadcasts=' + mock.broadcasts.length);
    await ctx6c.close();

    /* ── scenario 7: recovery evidence — expected / chain / signature-bound kept SEPARATE ── */
    rmSync(dir1, { recursive: true, force: true }); /* the original browser profile is destroyed, not just closed */
    const dir7 = profile('fresh'); dirs.push(dir7);
    const fr = await open(dir7);
    await step('fresh client: the outbox starts empty', () => fr.page.waitForFunction(() => /outbox is empty/.test(document.getElementById('outbox').textContent || ''), null, { timeout: 8000 }));
    const before = mock.broadcasts.length;
    /* 7a: commitment present and equal → MATCH, but signature evidence stays NONE */
    await setMock({ mode: 'normal', content: { permlink: 'drop-r-match', body: BODY } });
    await fr.page.fill('#author', 'loviswater');
    await fr.page.fill('#permlink', 'drop-r-match');
    await fr.page.fill('#body', BODY);
    await fr.page.fill('#rpc', `http://127.0.0.1:${PORT}/rpc`);
    await fr.page.click('#recover');
    await step('7a recovered with a matching commitment', () => fr.page.waitForFunction(() => /equals the desk/.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
    const obA = await outboxOf(fr.page);
    const rcA = obA.find(r => r.scope.permlink === 'drop-r-match');
    ok('7a MATCH verdict with expected and chain hashes RECORDED SEPARATELY',
      !!(rcA && rcA.receipt && rcA.receipt.body_byte_compare === 'MATCH' && rcA.receipt.body_sha256_expected === BODY_SHA && rcA.receipt.body_sha256_chain === BODY_SHA && rcA.receipt.body_sha256_expected !== undefined));
    ok('7a signature evidence honestly NONE — no signing provenance invented',
      rcA.receipt.signature_bound_hash === null && /NONE/.test(rcA.receipt.signing_evidence) && rcA.receipt.txid === null && /UNVERIFIED/.test(rcA.receipt.inclusion));
    ok('7a the recovered EDITION BYTES ride the record', rcA.body === BODY);
    /* 7b: commitment differs → DIVERGED, both digests recorded */
    await setMock({ mode: 'normal', content: { permlink: 'drop-r-diverge', body: 'someone replaced the body' } });
    await fr.page.fill('#permlink', 'drop-r-diverge');
    await fr.page.fill('#body', BODY);
    await fr.page.click('#recover');
    await step('7b divergent recovery reported', () => fr.page.waitForFunction(() => /DIFFERS from the desk/.test(document.getElementById('status').textContent || ''), null, { timeout: 15000 }));
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
  } finally {
    for (const c of ctxs) { try { await c.close(); } catch {} }
    for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
    server.close();
  }
  assert.equal(failures, 0, failures + ' lifecycle assertion(s) failed — see the ✗ lines above');
  console.log(failures === 0 ? 'BDROP LIFECYCLE GREEN — editions, happy path, duplicates, restart, ambiguity, unavailability, divergence, retrieval, key hygiene, the quarantined journal, the contract-faithful keychain signer, mid-handoff closure and evidence-honest fresh-client recovery all held. nothing touched hive.' : 'BDROP LIFECYCLE RED.');
});
