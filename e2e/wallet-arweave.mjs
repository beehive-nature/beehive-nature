// wallet-arweave.mjs — the ARWEAVE adapter + publish-path gate.
// Covers: pinned serialization vectors (proven live-node/arweave-js equivalent),
// gateway rotation (privacy ruling), vault custody roundtrip (runtime-generated
// JWK — never a literal key in this file, per the fixture-refinement law), the
// publish flow end-to-end with a MOCKED gateway, and the honest unfunded path.
// Run:  cd e2e && node wallet-arweave.mjs     (exit 0 = green)
import {installWalletFixture,WALLET_ORIGIN} from './lib/wallet-source-fixture.mjs';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { pinRegister } from './wallet-register-pin.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const URL_ = '/surfaces/wallet.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };


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
    if (/\/price\/\d+$/.test(u.pathname)) return json(FEE);
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
const fixtureHtml=await installWalletFixture(browser,ROOT);
// the register this battery reads in: WALLET_REG (see wallet-register-pin.mjs)
pinRegister(browser);
try {
  /* ── A · pinned serialization vectors (known-good; proven against the live
     node + arweave-js equivalence before pinning) ───────────────────────── */
  console.log('A · pinned vectors:');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(WALLET_ORIGIN + URL_, { waitUntil: 'domcontentloaded' });
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
    await page.goto(WALLET_ORIGIN + URL_, { waitUntil: 'domcontentloaded' });
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
    await page.goto(WALLET_ORIGIN + URL_, { waitUntil: 'domcontentloaded' });
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
    await page.goto(WALLET_ORIGIN + URL_, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey({ name: 'RSA-PSS', modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
      const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
      const V = window.BNRVAULT;
      await V.create('test-keypass-words-here', 'test-keypass-words-here');
      await V.addEntry({ type: 'arweave', secret: JSON.stringify(jwk), label: 'flow', chain: 'arweave' });
    });
    // served off the kit's home, the page pins a sticky "real home" banner at the top: press the
    // vault section where a reader can reach it, clear of that banner, never under it
    await page.evaluate(() => window.scrollBy(0, document.getElementById('vault-sec').getBoundingClientRect().top - 240));
    await page.locator('#vault-sec').click({ position: { x: 8, y: 8 } }); // wakes the panel's vault hook
    await page.waitForFunction(() => /publishing needs/.test(document.getElementById('arw-stat').textContent), null, { timeout: 8000 });
    await page.waitForTimeout(600);
    const armed = await page.locator('#arw-stat').innerText();
    ok('panel armed with fee + shortfall honesty (unfunded), in one sentence and its one link', /publishing needs [0-9.]+ AR/.test(armed) && await page.evaluate(() => !!document.querySelector('#arw-stat a[href="#ch-arweave"]')), armed.slice(0, 120));
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
    // Production refresh owns enablement; Playwright supplies trusted input.
    await page.evaluate(() => document.dispatchEvent(new Event('vault-unlocked')));
    await page.waitForFunction(() => !document.getElementById('arw-go').disabled);
    await page.evaluate(() => document.getElementById('arw-go').addEventListener('click', e => { window.__publishTrusted = e.isTrusted; }, { once: true }));
    await page.locator('#arw-go').click();
    ok('publication starts with trusted browser input', await page.evaluate(() => window.__publishTrusted === true));
    // the anchor is reviewed like a file: fee, the paying address and "cannot be undone", before any signature
    await page.locator('#arw-file-dialog').waitFor({ state: 'visible', timeout: 20000 });
    const anchorPlan = await page.locator('#arw-file-plan').textContent();
    const vaultAddr = await page.evaluate(() => (window.BNRVAULT.list().filter(e => e.type === 'arweave')[0] || { meta: {} }).meta.address);
    ok('the anchor waits for review: exact fee, the paying address, cannot be undone, nothing posted yet',
      /Exact fee: [0-9.]+ AR/.test(anchorPlan) && anchorPlan.includes('Paying address: ' + vaultAddr) && /cannot be undone/.test(anchorPlan) && posted.length === 0 &&
      await page.locator('#arw-file-confirm').isVisible() && /estate anchor/.test(await page.locator('#arw-file-dialog-title').textContent()), anchorPlan.slice(0, 160));
    ok('both publish buttons wait while the review is open', await page.locator('#arw-go').isDisabled() && await page.locator('#arw-file-review').isDisabled());
    await page.locator('#arw-file-confirm').click();
    await page.waitForFunction(() => /does not hold enough AR/.test(document.getElementById('arw-stat').innerText), null, { timeout: 10000 })
      .catch(() => {});
    const after = await page.locator('#arw-stat').innerText();
    ok('unfunded verdict said calmly where the reader pressed, the gateway\'s own words kept for cypherpunk', /does not hold enough AR for the fee, so nothing was published/.test(after) &&
      await page.evaluate(() => /FAILED: .*verification/i.test((document.querySelector('#arw-stat .wl-cyd') || {}).textContent || '') && (document.getElementById('tx-out').textContent || '') === ''), after.slice(0, 160));
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
/* ── E · inject path (window.arweaveWallet mock) — Gold move #1 primary ── */
  console.log('E · inject publish (mocked arweaveWallet + gateway):');
  {
    const posted = [];
    const ctx = await browser.newContext();
    mockGateways(ctx, null, { status: 400, obj: { error: 'Transaction verification failed.' } });
    ctx.route(GW_RE, async route => {
      if (route.request().method() === 'POST' && new URL(route.request().url()).pathname.endsWith('/tx'))
        posted.push(JSON.parse(route.request().postData()));
      await route.fallback();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      let _jwk = null, _addr = null, _key = null;
      const b64uDec = (s) => {
        s = String(s).replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        return Uint8Array.from(atob(s), c => c.charCodeAt(0));
      };
      const b64uEnc = (bytes) => {
        const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        let out = '';
        for (let i = 0; i < bytes.length; i += 3) {
          const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : NaN, b2 = i + 2 < bytes.length ? bytes[i + 2] : NaN;
          out += B64U[b0 >> 2];
          out += B64U[((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4)];
          if (!isNaN(b1)) out += B64U[((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6)];
          if (!isNaN(b2)) out += B64U[b2 & 63];
        }
        return out;
      };
      window.__arInjectBoot = async () => {
        const kp = await crypto.subtle.generateKey({ name: 'RSA-PSS', modulusLength: 4096,
          publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
        _jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
        _key = kp.privateKey;
        const dig = await crypto.subtle.digest('SHA-256', b64uDec(_jwk.n));
        _addr = b64uEnc(new Uint8Array(dig));
      };
      window.arweaveWallet = {
        connect: async () => {},
        getActiveAddress: async () => { window.__arAddressCount=(window.__arAddressCount||0)+1;if (!_addr) await window.__arInjectBoot(); return _addr; },
        getActivePublicKey: async () => { if (!_jwk) await window.__arInjectBoot(); return _jwk.n; },
        signature: async (data, alg) => {
          window.__arSignCount=(window.__arSignCount||0)+1;
          if (!_key) await window.__arInjectBoot();
          const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
          return new Uint8Array(await crypto.subtle.sign(
            { name: 'RSA-PSS', saltLength: (alg && alg.saltLength) || 32 }, _key, u8));
        }
      };
    });
    await page.goto(WALLET_ORIGIN + URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BNRWALLET && BNRWALLET.arInject && window.BNRAR, null, { timeout: 15000 });
    ok('arInject API exposed on BNRWALLET', await page.evaluate(() =>
      !!(BNRWALLET.arInject && BNRWALLET.arInject.present && BNRWALLET.arInject.present())));
    await page.waitForFunction(() => {
      const t = document.getElementById('arw-stat').textContent || '';
      return t && t !== '…';
    }, null, { timeout: 8000 }).catch(() => {});
    ok('honest path when inject present (no vault-JWK wall)', await page.evaluate(() => {
      const t = document.getElementById('arw-stat').textContent || '';
      return /extension|connect|Arweave|address|reading|AR/i.test(t) && !/seal your JWK/i.test(t);
    }), await page.locator('#arw-stat').innerText().then(t => t.slice(0, 100)));
    ok('opening the page never asks the Arweave extension for an address',await page.evaluate(()=>(window.__arAddressCount||0)===0));
    await page.locator('#arw-connect').click();
    await page.waitForFunction(() => {
      const a = document.getElementById('arw-addr');
      return a && /^[A-Za-z0-9_-]{43}$/.test((a.textContent || '').trim());
    }, null, { timeout: 20000 });
    const addr = (await page.locator('#arw-addr').innerText()).trim();
    ok('connect binds 43-char public address', /^[A-Za-z0-9_-]{43}$/.test(addr), addr);
    ok('scaffold details demoted (present)', await page.locator('#arw-jwk-scaffold').count().then(n => n === 1));
    await page.waitForFunction(() => /short by|funded|reading|AR/.test(document.getElementById('arw-stat').textContent || ''), null, { timeout: 12000 }).catch(() => {});
    await ctx.route(GW_RE, async route => {
      const u = new URL(route.request().url());
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      if (u.pathname.includes('/wallet/')) return route.fulfill({ contentType: 'application/json', body: '"100000000000"' });
      await route.fallback();
    });
    // Production refresh owns enablement; Playwright supplies trusted input.
    await page.evaluate(() => document.dispatchEvent(new Event('vault-unlocked')));
    await page.waitForFunction(() => !document.getElementById('arw-go').disabled);
    await page.evaluate(() => document.getElementById('arw-go').addEventListener('click', e => { window.__publishTrusted = e.isTrusted; }, { once: true }));
    await page.locator('#arw-go').click();
    ok('publication starts with trusted browser input', await page.evaluate(() => window.__publishTrusted === true));
    await page.locator('#arw-file-dialog').waitFor({ state: 'visible', timeout: 20000 });
    ok('the extension is not asked to sign before the review is confirmed', await page.evaluate(() => (window.__arSignCount || 0) === 0) && posted.length === 0 &&
      (await page.locator('#arw-file-plan').textContent()).includes('Paying address: ' + addr));
    await page.locator('#arw-file-confirm').click();
    await page.waitForFunction(() => {
      const a = document.getElementById('arw-stat').textContent || '';
      const o = (document.getElementById('tx-out') || {}).textContent || '';
      return /does not hold enough AR|said no|confirmed|did not answer|could not sign/i.test(a + o);   // a settled state, not a step on the way
    }, null, { timeout: 25000 }).catch(() => {});
    ok('inject path POSTed a signed tx (no vault JWK)', posted.length >= 1, 'posted=' + posted.length + ' · ' + await page.locator('#arw-stat').textContent());
    if (posted[0]) {
      ok('inject-signed tx format 2', posted[0].format === 2);
      ok('inject signature 512-byte RSA-PSS', unb64len(posted[0].signature) === 512);
      ok('inject id 43-char', /^[A-Za-z0-9_-]{43}$/.test(posted[0].id));
    }
    const txOut = await page.locator('#tx-out').innerText().catch(() => '');
    const arwStat = await page.locator('#arw-stat').innerText();
    ok('inject sign path spoke honestly, in the Arweave panel and nowhere else', /enough AR|said no|confirmed|sent/i.test(arwStat) && txOut === '', (txOut + ' ' + arwStat).slice(0, 140));
    ok('no page errors on inject path', errors.length === 0, errors.join(' | ').slice(0, 120));
    ok('vault JWK option reads as an Arweave key file, its scaffold tag kept for cypherpunk',
      await page.locator('#vlt-type option[value="arweave"]').textContent().then(t => /Arweave key file/.test(t))
      && await page.locator('#vlt-scaffold-law').textContent().then(t => /JWK paste is scaffold · advanced/.test(t)));
    // a publish still on its way is never signed twice: a second press points to it instead
    {
      const signs0 = await page.evaluate(() => window.__arSignCount || 0), posts0 = posted.length;
      await page.waitForFunction(() => !document.getElementById('arw-go').disabled, null, { timeout: 15000 });
      await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]'); const e = l.filter(x => x.rail === 'arweave').at(-1); if (e) { e.phase = 'submitted'; localStorage.setItem('bnr_outbox_v1', JSON.stringify(l)); } });
      await page.locator('#arw-go').click();
      await page.waitForFunction(() => /still on its way/.test(document.getElementById('arw-stat').innerText), null, { timeout: 8000 }).catch(() => {});
      ok('a second press while the first is on its way signs nothing and names where it waits',
        /still on its way, so nothing new was signed/.test(await page.locator('#arw-stat').innerText()) && await page.evaluate(() => !!document.querySelector('#arw-stat a[href="#outbox-sec"]')) &&
        await page.evaluate(() => window.__arSignCount || 0) === signs0 && posted.length === posts0 && !(await page.locator('#arw-file-dialog').isVisible()));
      await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]'); l.filter(x => x.rail === 'arweave').forEach(x => { if (x.phase === 'submitted') x.phase = 'failed'; }); localStorage.setItem('bnr_outbox_v1', JSON.stringify(l)); });
    }
    // the extension now pays from another account than the one shown: the review stops it before signing
    {
      const signs0 = await page.evaluate(() => window.__arSignCount || 0), posts0 = posted.length;
      await page.evaluate(() => window.__arInjectBoot());   // the extension switches to another account
      await page.waitForFunction(() => !document.getElementById('arw-go').disabled, null, { timeout: 15000 });
      await page.locator('#arw-go').click();
      await page.locator('#arw-file-dialog').waitFor({ state: 'visible', timeout: 20000 });
      ok('another paying account is named and cannot be confirmed', /not the one your wallet showed/.test(await page.locator('#arw-file-plan').innerText()) && !(await page.locator('#arw-file-confirm').isVisible()));
      await page.locator('#arw-file-cancel').click();
      await page.waitForFunction(() => /nothing was signed/.test(document.getElementById('arw-stat').innerText), null, { timeout: 8000 }).catch(() => {});
      ok('closing it says why, and nothing was signed or sent', /not the one your wallet showed/.test(await page.locator('#arw-stat').innerText()) &&
        await page.evaluate(() => window.__arSignCount || 0) === signs0 && posted.length === posts0);
    }
    await page.setViewportSize({width:390,height:844});
    const beforeFilePosts=posted.length, beforeFileSigns=await page.evaluate(()=>window.__arSignCount||0);
    const fileBytes=Buffer.from('Wallet publication fixture. No real upload.');
    await page.locator('#arw-file').setInputFiles({name:'<img src=x onerror=alert(1)>.txt',mimeType:'text/plain',buffer:fileBytes});
    await page.locator('#arw-file-review').click();
    await page.locator('#arw-file-dialog').waitFor({state:'visible'});
    ok('file review displays exact fee before signing',/Exact fee: [0-9.]+ AR/.test(await page.locator('#arw-file-plan').textContent())&&/for [0-9.]+ AR, paid from your Arweave address ending in .{6}\. it is public for good and cannot be undone/.test(await page.locator('#arw-file-plan').innerText())&&posted.length===beforeFilePosts&&await page.evaluate(()=>window.__arSignCount||0)===beforeFileSigns);
    ok('mobile review keeps its title and both decisions visible',await page.locator('#arw-file-dialog-title').isVisible()&&await page.locator('#arw-file-dialog').evaluate(el=>{const box=el.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight})&&await page.locator('#arw-file-cancel').isVisible()&&await page.locator('#arw-file-confirm').isVisible());
    ok('hostile filename is text, never markup',await page.locator('#arw-file-plan img').count()===0&&(await page.locator('#arw-file-plan').innerText()).includes('<img'));
    await page.locator('#arw-file-cancel').click();
    await page.waitForFunction(()=>document.querySelector('#arw-file-status').textContent.includes('cancelled before signing'));
    ok('cancel refuses signing and publication',posted.length===beforeFilePosts&&await page.evaluate(()=>window.__arSignCount||0)===beforeFileSigns);
    await page.locator('#arw-file-review').click();await page.locator('#arw-file-dialog').waitFor({state:'visible'});
    await page.locator('#arw-file-confirm').click();
    await page.waitForFunction(()=>!document.querySelector('#arw-file-review').disabled);
    ok('confirmed file uses the existing signed publication adapter',posted.length>beforeFilePosts&&Buffer.from(posted.at(-1).data,'base64url').equals(fileBytes));
    const beforeBlockedPosts=posted.length;
    await page.evaluate(()=>{window.__outboxBackup=localStorage.getItem('bnr_outbox_v1');window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='bnr_outbox_v1')throw new DOMException('Storage full','QuotaExceededError');return window.__storageSet.call(this,key,value);};});
    await page.locator('#arw-file-review').click();await page.locator('#arw-file-dialog').waitFor({state:'visible'});await page.locator('#arw-file-confirm').click();
    await page.waitForFunction(()=>!document.querySelector('#arw-file-review').disabled);
    ok('blocked outbox stops submission and preserves the prior receipt',posted.length===beforeBlockedPosts&&(await page.locator('#arw-file-status').innerText()).includes('out of room for the signed copy')&&await page.evaluate(()=>localStorage.getItem('bnr_outbox_v1')===window.__outboxBackup));
    await page.evaluate(()=>{Storage.prototype.setItem=window.__storageSet;localStorage.setItem('bnr_outbox_v1','not valid JSON');});
    await page.locator('#arw-file-review').click();await page.locator('#arw-file-dialog').waitFor({state:'visible'});await page.locator('#arw-file-confirm').click();
    await page.waitForFunction(()=>!document.querySelector('#arw-file-review').disabled);
    ok('unreadable outbox is never replaced or submitted',posted.length===beforeBlockedPosts&&(await page.locator('#arw-file-status').innerText()).includes('cannot be read on this device')&&await page.evaluate(()=>!!document.querySelector('#arw-file-status a[href="#outbox-sec"]'))&&await page.evaluate(()=>localStorage.getItem('bnr_outbox_v1')==='not valid JSON'));
    await page.evaluate(()=>localStorage.setItem('bnr_outbox_v1',window.__outboxBackup));
    await page.evaluate(()=>{const seed=JSON.parse(window.__outboxBackup)[0];localStorage.setItem('bnr_outbox_v1',JSON.stringify(Array.from({length:80},(_,i)=>({...seed,intent_id:'retention-fixture-'+i,phase:i<40?'signed':'confirmed'}))));});
    await page.locator('#arw-file-review').click();await page.locator('#arw-file-dialog').waitFor({state:'visible'});await page.locator('#arw-file-confirm').click();await page.waitForFunction(()=>!document.querySelector('#arw-file-review').disabled);
    ok('history trimming retains all forty unresolved signed transactions',await page.evaluate(()=>{const list=JSON.parse(localStorage.getItem('bnr_outbox_v1'));return list.length===80&&Array.from({length:40},(_,i)=>'retention-fixture-'+i).every(id=>list.some(e=>e.intent_id===id&&e.phase==='signed'));}));
    await page.evaluate(()=>localStorage.setItem('bnr_outbox_v1',window.__outboxBackup));
    const beforeBadSignature=posted.length;
    await page.evaluate(()=>{window.__originalSignature=arweaveWallet.signature;arweaveWallet.signature=async()=>new Uint8Array(512)});
    await page.locator('#arw-file-review').click();await page.locator('#arw-file-dialog').waitFor({state:'visible'});await page.locator('#arw-file-confirm').click();await page.waitForFunction(()=>!document.querySelector('#arw-file-review').disabled);
    ok('wrong signing key or invalid extension signature is refused before submission',posted.length===beforeBadSignature&&(await page.locator('#arw-file-status').innerText()).includes('signature that does not match this file')&&await page.evaluate(()=>!!document.querySelector('#arw-file-status button.wl-act')));
    await page.evaluate(()=>{arweaveWallet.signature=window.__originalSignature});
    const beforeOversize=posted.length;
    await page.locator('#arw-file').setInputFiles({name:'too-big.txt',mimeType:'text/plain',buffer:Buffer.alloc(30001)});
    await page.locator('#arw-file-review').click();
    ok('oversized file is refused before wallet or network work',(await page.locator('#arw-file-status').innerText()).includes('30,000')&&posted.length===beforeOversize);

    await ctx.close();
  }

  /* ── F · honest empty path (no inject, no vault) — one clear connect, no fail-box wall ── */
  console.log('F · honest empty connect path:');
  {
    const ctx = await browser.newContext();
    mockGateways(ctx);
    const page = await ctx.newPage();
    await page.goto(WALLET_ORIGIN + URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const t = await page.locator('#arw-stat').innerText();
    ok('empty path names connect / Wander / public bind', /Wander|connect|public address|forge/i.test(t), t.slice(0, 120));
    ok('empty path does not demand vault JWK as required', !/seal your JWK|paste it; the type is detected/i.test(t), t.slice(0, 120));
    ok('with no Arweave extension in this browser, no extension button shows: your own keys come first', !(await page.locator('#arw-connect').isVisible()) && await page.evaluate(() => !!document.querySelector('#arw-stat a[href="#kc-sec"]')));
    ok('JWK scaffold is in a demoted details', await page.locator('#arw-jwk-scaffold summary').innerText().then(x => /scaffold|optional|advanced/i.test(x)));
    ok('kc-rec demoted to scaffold', await page.locator('#kc-rec-scaffold summary').innerText().then(x => /scaffold|recovery/i.test(x)));
    ok('vlt-secret demoted to scaffold', await page.locator('#vlt-secret-scaffold summary').innerText().then(x => /scaffold|recovery/i.test(x)));
    ok('br-wif demoted to scaffold', await page.locator('#br-wif-scaffold summary').innerText().then(x => /scaffold|recovery/i.test(x)));
    await ctx.close();
  }
  function b64(s) { return Buffer.from(s, 'utf8').toString('base64url'); }
  function unb64len(s) { return Buffer.from(s, 'base64url').length; }
} finally {
  await browser.close();

}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
