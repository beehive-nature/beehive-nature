// wallet-arweave-keys.mjs — Arweave from your own keys, no extension.
// Since Arweave's 2.9 fork (block 1,602,350) a secp256k1 key owns an Arweave
// address natively: base64url(SHA-256(33-byte compressed key)); its
// transactions carry an empty owner and a recoverable r‖s‖recid signature over
// SHA-256(deepHash without the owner). The wallet derives that key from the
// keychain (context ar:<soul>), shows the address, reads its balance keyless,
// and publishes a small file from it. Node then recovers the owner from the
// posted signature, exactly as the network does. Part 0 pins the format to a
// real mainnet ECDSA transaction (G59jD7x4…, fetched once and stored below).
// Gateways are mocks; nothing reaches a live network. Run: node e2e/wallet-arweave-keys.mjs
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.window = globalThis; globalThis.self = globalThis;
require(resolve(ROOT, 'surfaces/onboarding/vendor/bnr-sign.js'));
require(resolve(ROOT, 'surfaces/arweave.js'));
const A = globalThis.BNRAR, secp = globalThis.BnrSign.secp;
const ORIGIN = 'https://skaists.dev';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png' };
const AR_RE = /^https:\/\/(arweave\.net|ar-io\.dev|gateway\.ardrive\.io)(\/|$)/;
const str = s => new TextEncoder().encode(String(s));
const sha256 = async b => new Uint8Array(await crypto.subtle.digest('SHA-256', b));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`); }
};
// recover the owner of a posted secp256k1 transaction the way the node does
async function ownerOf(tx) {
  const tags = tx.tags.map(t => [A.unb64u(t.name), A.unb64u(t.value)]);
  const dh = await A.deepHash([str(tx.format), str(tx.target), str(tx.quantity), str(tx.reward), A.unb64u(tx.last_tx), tags, str(tx.data_size), A.unb64u(tx.data_root)]);
  const msg = await sha256(dh), sig = A.unb64u(tx.signature);
  const S = secp.Signature.fromCompact(sig.slice(0, 64)).addRecoveryBit(sig[64]);
  const pub = S.recoverPublicKey(msg).toRawBytes(true);
  return { address: A.b64u(await sha256(pub)), id: A.b64u(await sha256(sig)), lowS: !S.hasHighS(), sigLen: sig.length };
}

/* 0 · the format, pinned to a real mainnet ECDSA transaction (arweave.net, read 2026-10-05) */
console.log('0 · the mainnet oracle:');
{
  const MAINNET = { format: 2, id: 'G59jD7x4Ykz0sC4lf-gtsHzYovzjuc0MORyD-O4aWA0', last_tx: '6m2MerOPhCI8FKTWT6pQSAueVdvIcP_eO34JpBUB6-7JsINMBy3mFm4NQiCikiqq', owner: '',
    tags: [{ name: 'Q29udGVudC1UeXBl', value: 'dGV4dC9wbGFpbg' }], target: '', quantity: '0', data_size: '35', data_root: 'nqeMUJPFkt9jICgRMl7wRT5I9AarwRPLiV5Kfq2PD5A', reward: '543091432',
    signature: 'p6LqtPbnfSyUqjVOFn0yqAlcf1f0dwNz2bro9aaFkOEcJoqUgSsaAW9vkZsKD_zqWJdZUupPUZuawXKhcsLuFAE' };
  const r = await ownerOf(MAINNET);
  ok('our message recovers the owner the network recorded (GraphQL owner mtBAWAKk…)', r.address === 'mtBAWAKk76PTvOvu3cy1H-gvpRkGStmfWYi5Ja-a8y8', r.address);
  ok('and the id is the SHA-256 of the signature', r.id === MAINNET.id && r.sigLen === 65, r.id);
  const pubJwk = { kty: 'EC', crv: 'secp256k1', pub: 'A9jOdCekWyY5pVjSOYBzeSEi-rQ0cIC3XsYbK9gShlgL' };   // the key GraphQL reports for it
  ok('addressOf gives the same address from the public key', await A.addressOf(pubJwk) === 'mtBAWAKk76PTvOvu3cy1H-gvpRkGStmfWYi5Ja-a8y8');
  const built = await A.buildUnsigned(pubJwk, new Uint8Array(35), [{ name: 'Content-Type', value: 'text/plain' }], { reward: MAINNET.reward, anchor: MAINNET.last_tx });
  ok('buildUnsigned for a secp256k1 owner leaves the owner empty', built.wire.owner === '' && built.wire.format === 2);
}

const browser = await chromium.launch();
try {
  for (const reg of ['bee', 'cypherpunk']) {
    console.log(`A · your Arweave address, ${reg}:`);
    const state = { posted: null, balance: '0' };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await ctx.addInitScript(r => { try { if (!sessionStorage.getItem('__s')) { localStorage.setItem('bregister', r); localStorage.setItem('bnr_soul', 'gatesoul'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
      if (navigator.credentials) navigator.credentials.get = navigator.credentials.create = async () => { throw new DOMException('test', 'NotAllowedError'); }; }, reg);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
    await ctx.route('**/*', async route => {
      const url = route.request().url(), u = new URL(url);
      if (AR_RE.test(url)) {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        const text = (t, status = 200) => route.fulfill({ status, headers: cors, body: String(t) });
        if (u.pathname.startsWith('/price/')) return text('1000');
        if (u.pathname === '/tx_anchor') return text('MOCKANCHOR' + 'a'.repeat(54));
        if (u.pathname === '/spot_price') return text('20.5');
        if (/^\/wallet\/[^/]+\/balance$/.test(u.pathname)) return text(state.balance);
        if (u.pathname === '/tx' && route.request().method() === 'POST') { state.posted = JSON.parse(route.request().postData()); return text('', 200); }
        if (/^\/tx\/[^/]+\/status$/.test(u.pathname)) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ block_height: 2014999, block_indep_hash: 'B'.repeat(64), number_of_confirmations: 3 }) });
        return text('');
      }
      if (u.origin !== ORIGIN) return route.abort();
      const path = resolve(ROOT, '.' + decodeURIComponent(u.pathname));
      if (!path.startsWith(ROOT + sep)) return route.abort();
      try { return route.fulfill({ body: await readFile(path), contentType: MIME[extname(path)] || 'application/octet-stream' }); }
      catch { return route.fulfill({ status: 404, body: 'not found' }); }
    });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html#arw-sec`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BNRWALLET && window.BZDIDKEY && window.BNRAR, null, { timeout: 20000 });
    await page.waitForTimeout(900);
    ok('before the keychain, the Arweave card is one sentence and the way to the keychain', await page.evaluate(() => { const e = document.getElementById('ar-stat'); return /connect your keychain to see your Arweave address/.test(e.textContent) && !!e.querySelector('a[href="#kc-sec"]') && !/bind a public address/.test(e.textContent); }), await page.textContent('#ar-stat'));
    ok('with no address yet, the address line stays empty and the panel line carries the one sentence and its link', await page.evaluate(() => document.getElementById('arw-addr').textContent === '' && /connect your keychain/.test(document.getElementById('arw-stat').textContent) && !!document.querySelector('#arw-stat a[href="#kc-sec"]')));
    await page.evaluate(() => { const sc = document.getElementById('kc-rec-scaffold'); if (sc) sc.open = true;
      document.getElementById('kc-rec').value = window.BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(0x2a)); document.getElementById('kc-recgo').click(); });
    await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, { timeout: 15000 });
    const want = await page.evaluate(() => { const r = window.BZDIDKEY.deriveK1Key(new Uint8Array(32).fill(0x2a), 'ar:gatesoul'); const B = window.BnrSign; return window.BNRAR.b64u(B.sha256(B.secp.getPublicKey(r.seed, true))); });
    await page.waitForFunction(w => document.getElementById('arw-addr') && document.getElementById('arw-addr').textContent.trim() === w, want, { timeout: 15000 });
    ok('the keychain makes a native Arweave address (context ar:gatesoul), no extension', /^[A-Za-z0-9_-]{43}$/.test(want));
    ok('the balance is read keyless and the card says where the address comes from', await page.evaluate(() => /from your keys|made from your keys/.test(document.getElementById('ar-stat').textContent + document.getElementById('ar-info').textContent)), await page.textContent('#ar-stat'));
    ok('the address lives only while the keychain does: nothing about it is stored', await page.evaluate(() => Object.keys(localStorage).every(k => !/ar_derived/.test(k))));
    await page.waitForFunction(() => /is empty/.test(document.getElementById('ar-stat').textContent), null, { timeout: 15000 });
    ok('an empty address reads calmly, with the one next step: copy it to receive AR', await page.evaluate(() => { const e = document.getElementById('ar-stat'); return /^your Arweave address is empty; send AR to it to publish\. copy my Arweave address$/.test([...e.childNodes].filter(n => !(n.classList && n.classList.contains('wl-cyd'))).map(n => n.textContent).join('').trim()) && /balance 0 winston/.test(e.textContent) && !!e.querySelector('button.wl-act') && !/err/.test(e.className); }), await page.textContent('#ar-stat'));
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN }).catch(() => {});
    await page.evaluate(() => document.querySelector('#ar-stat button.wl-act').click());
    await page.waitForFunction(() => /copied|did not copy/.test(document.getElementById('ar-stat').textContent), null, { timeout: 5000 }).catch(() => {});
    ok('"copied" only when the browser copied; otherwise the address is shown to copy by hand', await page.evaluate(async w => { const t = document.getElementById('ar-stat').textContent; if (/^copied\./.test(t)) { try { return (await navigator.clipboard.readText()) === w; } catch (e) { return true; } } return t.includes('did not copy it. your Arweave address is ' + w); }, want), await page.textContent('#ar-stat'));
    // an empty address cannot confirm a fee it cannot pay: the review says how much to add, and nothing is signed
    await page.setInputFiles('#arw-file', { name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello from my own keys') });
    await page.evaluate(() => document.getElementById('arw-file-review').click());
    await page.waitForFunction(() => document.getElementById('arw-file-dialog').open, null, { timeout: 20000 });
    ok('an empty address gets no confirm button, only how much AR to add', await page.evaluate(() => /add [0-9.]+ AR to it first/.test(document.getElementById('arw-file-plan').textContent) && document.getElementById('arw-file-confirm').hidden));
    await page.evaluate(() => document.getElementById('arw-file-cancel').click());
    await page.waitForFunction(() => /nothing was signed/.test(document.getElementById('arw-file-status').textContent), null, { timeout: 10000 }).catch(() => {});
    ok('closing it says what to do, and nothing was posted', !state.posted && /add [0-9.]+ AR to it, then publish again/.test(await page.textContent('#arw-file-status')), await page.textContent('#arw-file-status'));
    // publish a small file from it
    state.balance = '5000000000000';
    await page.setInputFiles('#arw-file', { name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello from my own keys') });
    await page.evaluate(() => document.getElementById('arw-file-review').click());
    await page.waitForFunction(() => document.getElementById('arw-file-dialog').open, null, { timeout: 20000 });
    ok('the review names the paying address: yours', (await page.textContent('#arw-file-plan')).includes('Paying address: ' + want), await page.textContent('#arw-file-plan'));
    await page.evaluate(() => document.getElementById('arw-file-confirm').click());
    await page.waitForFunction(() => /published\. the network confirmed it|sent\. waiting for the network/.test(document.getElementById('arw-file-status').textContent), null, { timeout: 30000 });
    ok('the file was posted', !!state.posted, await page.textContent('#arw-file-status'));
    if (state.posted) {
      const r = await ownerOf(state.posted);
      ok('the posted tx has an empty owner and a 65-byte low-S signature', state.posted.owner === '' && r.sigLen === 65 && r.lowS, JSON.stringify({ owner: state.posted.owner, len: r.sigLen }));
      ok('the network would recover YOUR address from it', r.address === want, r.address + ' vs ' + want);
      ok('and its id is the SHA-256 of the signature', r.id === state.posted.id);
    }
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\nwallet arweave keys: ${pass} pass, ${fail} fail`);
if (fail) process.exit(1);
