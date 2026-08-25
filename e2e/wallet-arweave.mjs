// wallet-arweave.mjs — the ARWEAVE adapter + publish-path gate.
// Covers: pinned serialization vectors (proven live-node/arweave-js equivalent),
// gateway rotation (privacy ruling), vault custody roundtrip (runtime-generated
// JWK — never a literal key in this file, per the fixture-refinement law), the
// publish flow end-to-end with a MOCKED gateway, and the honest unfunded path.
// Run:  cd e2e && node wallet-arweave.mjs     (exit 0 = green)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const URL_ = '/surfaces/wallet.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(8892, '127.0.0.1', r));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

/* gateway mock: ONE RegExp over every gateway the adapter may rotate to, with
   CORS + preflight handled (a JSON POST from http origin preflights). Values
   route by path so balance/fee/spot/tx all answer deterministically. */
const GW_RE = /^https:\/\/(arweave\.net|ar-io\.dev|gateway\.ardrive\.io)(\/|$)/;
const FEE = '2971765846';        // the live gateway's quote for 1926 B (receipted)
const SPOT = '7.42';
function mockGateways(ctx, tally, txAnswer) {
  const cors = { 'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  ctx.route(GW_RE, async route => {
    const u = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (tally) { const h = u.host; tally[h] = (tally[h] || 0) + 1; }
    const json = (obj, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(obj) });
    if (u.pathname.endsWith('/price/1926')) return json(FEE);
    if (u.pathname.endsWith('/spot_price')) return json(SPOT);
    if (u.pathname.endsWith('/tx_anchor')) return json('yfE5XWLIT5U0dwMJanchorMOCK0000000000000000000');
    if (u.pathname.includes('/wallet/')) return json('0'); // unfunded
    if (u.pathname.endsWith('/tx')) {
      const body = txAnswer || { status: 400, obj: { error: 'Transaction verification failed.' } };
      return json(body.obj, body.status);
    }
    return json({});
  });
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  /* ── A · pinned serialization vectors (known-good; proven against the live
     node + arweave-js equivalence before pinning) ───────────────────────── */
  console.log('A · pinned vectors:');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8892' + URL_, { waitUntil: 'domcontentloaded' });
    const v = await page.evaluate(async (FEE) => {
      const A = window.BNRAR;
      const payload = new Uint8Array(await (await fetch('/surfaces/forge/orbit-manifests.md')).arrayBuffer());
      const enc = s => new TextEncoder().encode(s);
      const list = [enc('2'), new Uint8Array(0), enc('0'), enc(FEE), enc('anchor'),
        [[enc('Rail'), enc('2')]], enc('1926'), A.unb64u(A.b64u(await A.chunkRoot(payload)))];
      return { root: A.b64u(await A.chunkRoot(payload)), dh: A.b64u(await A.deepHash(list)),
        t1: A.b64u(enc('Content-Type')), t2: A.b64u(enc('orbit-manifest-anchor')), len: payload.length };
    }, FEE);
    ok('adapter exposes the four + publish (CAPABILITIES)', await page.evaluate(() =>
      window.BNRAR && BNRAR.CAPABILITIES.balance && BNRAR.CAPABILITIES.receiveAddress &&
      BNRAR.CAPABILITIES.send && BNRAR.CAPABILITIES.publish));
    ok('deployed manifest is exactly 1,926 bytes', v.len === 1926, v.len);
    ok('data_root of the real payload (pinned, arweave-js-agreed)',
      v.root === '2d--p1pOBlywPnnmxQYlnGAqe8RJMluwwLHGYZziOEE', v.root);
    ok('deepHash v2-shape vector (pinned)',
      v.dh === 'V-Cfct9t_i4aebedvl3EMqWPKYUNOg0_QvU5auVJQP-HHqlZcY9gzHo7wRNWADiq', v.dh);
    ok('tag b64url encoding (pinned)', v.t1 === 'Q29udGVudC1UeXBl' && v.t2 === 'b3JiaXQtbWFuaWZlc3QtYW5jaG9y');
    await ctx.close();
  }

  /* ── B · vault custody roundtrip (runtime-generated JWK — never a literal) ── */
  console.log('B · vault custody:');
  let PAGE_JWK = null, PAGE_ADDR = null;
  {
    const ctx = await browser.newContext();
    mockGateways(ctx);
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8892' + URL_, { waitUntil: 'domcontentloaded' });
    const r = await page.evaluate(async () => {
      // generate a THROWAWAY RSA-4096 key IN THE PAGE (construct-at-runtime law)
      const kp = await crypto.subtle.generateKey({ name: 'RSA-PSS', modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
      const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
      const V = window.BNRVAULT, A = window.BNRAR;
      await V.create('test-keypass-words-here', 'test-keypass-words-here');
      const det = V.detect ? await V.detect(JSON.stringify(jwk)) : null;
      const entry = await V.addEntry({ type: 'arweave', secret: JSON.stringify(jwk), label: 'gate throwaway', chain: 'arweave' });
      const listed = V.list().filter(e => e.type === 'arweave')[0];
      const revealed = V.reveal(entry.id);
      return { detKind: det && det.kind, detOk: det && det.ok, listedAddr: listed && listed.meta.address,
        addr: await A.addressOf(jwk), roundtrip: revealed.secret === JSON.stringify(jwk),
        badDetect: await V.detect('{"kty":"RSA","n":"AAAA","e":"AQAB","d":"AAAA"}') };
    });
    PAGE_JWK = true; PAGE_ADDR = r.addr;
    ok('detect() recognises a JWK as arweave', r.detKind === 'arweave' && r.detOk === true, JSON.stringify(r.detKind));
    ok('structural check rejects a broken JWK', r.badDetect && r.badDetect.kind === null, JSON.stringify(r.badDetect));
    ok('sealed entry carries the derived PUBLIC address in meta', r.listedAddr === r.addr, r.listedAddr + ' vs ' + r.addr);
    ok('reveal() returns the JWK byte-exact (custody roundtrip)', r.roundtrip);
    ok('address is 43-char base64url', /^[A-Za-z0-9_-]{43}$/.test(r.addr), r.addr);
    await ctx.close();
  }

  /* ── C · rotation (privacy ruling: no privileged gateway) ─────────────── */
  console.log('C · gateway rotation:');
  {
    const tally = {};
    const ctx = await browser.newContext();
    mockGateways(ctx, tally);
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8892' + URL_, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 12; i++) await page.evaluate(() => window.BNRAR.fee(1926));
    const hosts = Object.keys(tally);
    const total = hosts.reduce((s, h) => s + tally[h], 0);
    ok('twelve quotes, one request each', total === 12, JSON.stringify(tally));
    ok('first choice RANDOM — more than one gateway used', hosts.length >= 2, JSON.stringify(tally));
    await ctx.close();
  }

  /* ── D · publish flow end-to-end in the page (mocked gateway) ─────────── */
  console.log('D · publish flow (mocked gateway, unfunded verdict):');
  {
    const posted = [];
    const ctx = await browser.newContext();
    mockGateways(ctx, null, { status: 400, obj: { error: 'Transaction verification failed.' } });
    ctx.route(GW_RE, async route => { // capture the tx body the adapter POSTs
      if (route.request().method() === 'POST' && new URL(route.request().url()).pathname.endsWith('/tx'))
        posted.push(JSON.parse(route.request().postData()));
      await route.fallback();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8892' + URL_, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey({ name: 'RSA-PSS', modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
      const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
      const V = window.BNRVAULT;
      await V.create('test-keypass-words-here', 'test-keypass-words-here');
      await V.addEntry({ type: 'arweave', secret: JSON.stringify(jwk), label: 'flow', chain: 'arweave' });
    });
    await page.locator('#vault-sec').click({ position: { x: 8, y: 8 } }); // wakes the panel's vault hook
    await page.waitForFunction(() => /short by/.test(document.getElementById('arw-stat').textContent), null, { timeout: 8000 });
    await page.waitForTimeout(600);
    const armed = await page.locator('#arw-stat').innerText();
    ok('panel armed with fee + shortfall honesty (unfunded)', /short by/.test(armed) && /AR/.test(armed), armed.slice(0, 90));
    ok('publish control disabled while unfunded', await page.locator('#arw-go').isDisabled());
    // arm the funds: balance mock flips to funded, publish should go through
    await page.evaluate(() => { window.__flipFunded = true; });
    const ctx2 = ctx; // same context: remock wallet balance to funded
    await ctx2.route(GW_RE, async route => {
      const u = new URL(route.request().url());
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      if (u.pathname.includes('/wallet/')) return route.fulfill({ contentType: 'application/json', body: '"100000000000"' });
      await route.fallback();
    });
    await page.locator('#arw-go').evaluate(b => { b.disabled = false; }); // panel state machine re-reads on click
    await page.locator('#arw-go').click();
    await page.waitForFunction(() => document.getElementById('arw-stat').textContent.includes('expected verdict'), null, { timeout: 10000 })
      .catch(() => {});
    const after = await page.locator('#arw-stat').innerText();
    ok('unfunded verdict explained honestly (arweave-js identical)', /expected verdict/.test(after), after.slice(0, 120));
    ok('tx actually POSTed (built + signed + sent)', posted.length === 1, 'posted=' + posted.length);
    if (posted[0]) {
      const tx = posted[0];
      const payloadBytes = 1926;
      ok('POSTed tx is format 2 with pinned data_root',
        tx.format === 2 && tx.data_root === '2d--p1pOBlywPnnmxQYlnGAqe8RJMluwwLHGYZziOEE', tx.data_root);
      ok('tags are the anchor set, b64url-encoded', Array.isArray(tx.tags) && tx.tags.length === 7 &&
        tx.tags.some(t => t.name === b64('Rail')));
      ok('data_size 1926, quantity 0, target empty', tx.data_size === '1926' && tx.quantity === '0' && tx.target === '');
      ok('signature is 512-byte RSA-PSS (683 b64url chars)', unb64len(tx.signature) === 512);
      ok('id is 43-char b64url', /^[A-Za-z0-9_-]{43}$/.test(tx.id));
    }
    ok('no page errors through the whole flow', errors.length === 0, errors.join(' | ').slice(0, 120));
    await ctx.close();
  }
  function b64(s) { return Buffer.from(s, 'utf8').toString('base64url'); }
  function unb64len(s) { return Buffer.from(s, 'base64url').length; }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
