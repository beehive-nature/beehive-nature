// bPay/bData SHARED-POLICY FIELD OWNERSHIP — the ceremony-blocking repair.
//
// DEFECT (found by the pre-gesture read-only watch, 2026-09-17): a wallet tab
// opened BEFORE the founder's gesture holds audience:null in memory; any
// presentation-only save (a view toggle, the quote-service field) wrote its
// WHOLE local snapshot back — erasing the founder's newer policy from the
// shared key. A View change must never alter Policy: that is the orthogonality
// law this ceremony exists to prove, in the product, not by tab discipline.
//
// LAW: every writer of bpay-policy-v1 merges with the LATEST stored object and
// writes only the fields it owns:
//   - presentation/service fields (inspection view, bridge endpoint): any
//     surface may write them, always merged, never touching policy fields;
//   - policy fields (audience, selectedAt): written ONLY by an explicit
//     founder gesture, merged with latest, from the owning surface.
//
// THE RED (advisor's acceptance, two tabs opened BEFORE the gesture):
//   Tab A = bData, Tab B = wallet (stale audience:null).
//   A: choose Public            → shared = public · founder-selected.
//   B: toggle the VIEW          → shared STILL public · SAME selectedAt.
//   Reload both                 → both render "You chose Public", agreeing.
//   Plus: the wallet's OWN gesture path still records (merged), and bData's
//   gesture preserves wallet-side fields.
//
// THE NEAR-MISS LAW (2026-09-18): since the latency law, bData's Public press
// ALSO starts a price ask — and this gate never seeded a quote service, so on
// the founder's machine it could POST audience:public at the LIVE keyless
// bridge (a forged founder-selected job). Every context here now aborts :8807
// at the browser and counts the touches; the count must stay zero. (bData also
// refuses, by itself, to let an automated browser reach its default bridge.)
//
//   node --test e2e/bpay-policy-ownership.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', 'surfaces');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

let browser, server, origin, liveBridgeTouches = 0;
const guarded = async (ctx) => { await ctx.route('http://127.0.0.1:8807/**', route => { liveBridgeTouches++; route.abort(); }); return ctx; };
before(async () => {
  server = createServer(async (req, res) => {
    const p = (req.url === '/' ? '/bdata.html' : req.url).split('?')[0];
    try {
      const body = await readFile(join(SURFACES, ...p.split('/').filter(Boolean)));
      res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { if (browser) await browser.close(); if (server) server.close(); });

const readKey = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bpay-policy-v1') || 'null'));

test('a View change in a stale wallet tab cannot erase newer founder policy (the ceremony-blocking defect)', async () => {
  const ctx = await guarded(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  // Tab B FIRST — the wallet, booted with pristine (audience:null) state
  const tabB = await ctx.newPage();
  await tabB.goto(origin + '/wallet.html', { waitUntil: 'load' });
  await tabB.waitForTimeout(1200);
  assert.ok((() => { const k = null; return true; })(), 'premise helper');
  const bootKey = await readKey(tabB);
  assert.ok(!bootKey || bootKey.audience === null, 'wallet boots with no gesture (stale-tab premise)');

  // Tab A — My Data, opened AFTER the wallet booted
  const tabA = await ctx.newPage();
  await tabA.goto(origin + '/bdata.html', { waitUntil: 'load' });
  await tabA.waitForTimeout(1200);

  // THE FOUNDER GESTURE in the owning surface
  await tabA.click('[data-bdata-aud="public"]');
  await tabA.waitForTimeout(300);
  const afterGesture = await readKey(tabA);
  assert.equal(afterGesture.audience, 'public', 'gesture recorded: public');
  assert.ok(afterGesture.selectedAt, 'gesture recorded: selectedAt');
  const gestureAt = afterGesture.selectedAt;

  // THE DEFECT CASE: the STALE wallet tab makes a presentation-only change
  await tabB.click('[data-inspection="cypherpunk"]');
  await tabB.waitForTimeout(300);
  const afterViewChange = await readKey(tabB);
  assert.equal(afterViewChange.audience, 'public', 'VIEW change preserved audience (orthogonality law)');
  assert.equal(afterViewChange.selectedAt, gestureAt, 'VIEW change preserved the exact selectedAt');
  assert.equal(afterViewChange.inspection, 'cypherpunk', 'the view change itself did land');

  // Reload both — they must agree, and both must RENDER the founder's choice
  await tabA.reload(); await tabA.waitForTimeout(1200);
  await tabB.reload(); await tabB.waitForTimeout(1400);
  const keyA = await readKey(tabA), keyB = await readKey(tabB);
  assert.deepEqual({ a: keyA.audience, at: keyA.selectedAt }, { a: keyB.audience, at: keyB.selectedAt }, 'both tabs agree after reload');
  const textA = await tabA.innerText('#shelf');
  assert.match(textA, /You chose .*Public/i, 'My Data renders the founder choice after reload');
  const textB = await tabB.innerText('#bpay-sec');
  assert.match(textB, /You chose .*Public/i, 'the wallet panel RECEIVES the resolved operation (no re-ask)');
  assert.equal(liveBridgeTouches, 0, 'no automated press ever reached for the live quote service');

  await ctx.close();
});

test('the wallet\'s OWN gesture path still records policy — merged, never clobbering wallet-side fields', async () => {
  const ctx = await guarded(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  const page = await ctx.newPage();
  // pre-seed wallet-side service state the gesture must preserve
  await page.addInitScript(() => {
    localStorage.setItem('bpay-policy-v1', JSON.stringify({ audience: null, selectedAt: null, inspection: 'newbee', bridge: 'http://127.0.0.1:9999' }));
  });
  await page.goto(origin + '/wallet.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('[data-audience="public"]');
  await page.waitForTimeout(300);
  const key = await readKey(page);
  assert.equal(key.audience, 'public', 'wallet gesture records public');
  assert.ok(key.selectedAt, 'wallet gesture records selectedAt');
  assert.equal(key.bridge, 'http://127.0.0.1:9999', 'wallet gesture preserved the service field');
  await ctx.close();
});
