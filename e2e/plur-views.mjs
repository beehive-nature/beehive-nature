import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = process.cwd();
const server = createServer((req, res) => {
  try {
    const file = resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + '/') && !file.startsWith(root + '\\')) throw Error('path');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' })[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  /* Fake speech engine: deterministic voices under test, real sequence timing.
     No audio path is opened; nothing can play unless the page calls speak(). */
  await page.addInitScript(() => {
    window.__spokes = [];
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    /* window.speechSynthesis is a getter-only native accessor (assignment is
       silently ignored), so the stub is installed via defineProperty */
    const stub = {
      _voices: [], _fn: null,
      getVoices() { return this._voices; },
      cancel() {},
      speak(u) { window.__spokes.push(u.text); setTimeout(() => { if (u.onend) u.onend(); }, 5); },
    };
    Object.defineProperty(stub, 'onvoiceschanged', {
      get() { return this._fn; },
      set(fn) { this._fn = fn; },
    });
    Object.defineProperty(window, 'speechSynthesis', { value: stub, writable: true, configurable: true });
    window.__setVoices = function (v) {
      stub._voices = v;
      if (stub._fn) stub._fn();
    };
  });
  // External services never receive test input; simulate an actual HTTP refusal.
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (url === 'https://api.anthropic.com/v1/messages') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"type":"authentication_error"}}' });
    return route.abort();
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const name of ['plur', 'blanguage']) {
    await page.goto(`${base}/surfaces/${name}.html`);
    for (const reg of ['bee', 'raver', 'cypherpunk']) {
      await page.locator(`#breg-${reg}`).click();
      assert.equal(await page.locator('body').getAttribute('data-reg'), reg);
      assert.equal(await page.locator('h1:visible').count(), 1);
    }
  }
  await page.goto(`${base}/surfaces/plur.html`);
  await page.locator('#breg-raver').click();
  await page.locator('#blangsel').selectOption('lv');
  await page.getByText('Viena deju grīda. Visas valodas.', { exact: true }).waitFor();
  await page.locator('#blangsel').selectOption('th');
  await page.getByText('ฟลอร์เดียวกัน ทุกภาษา', { exact: true }).waitFor();

  /* ── pronunciation-example correction: optional, labelled, honestly disabled,
     never autoplay, keyboard reachable, translated through the corpus ── */
  await page.locator('#blangsel').selectOption('en');
  await page.locator('#breg-bee').click();
  const hearButton = page.locator('#vsalam');
  assert.equal(await hearButton.count(), 1, 'the hear-greetings control exists');
  assert(await hearButton.evaluate(el => el.closest('.field.f-peace') !== null), 'the control sits beside the peace words');
  assert(await hearButton.evaluate(el => el.closest('.open') === null), 'the control is NOT the page header or its first task');
  assert.equal(await hearButton.locator('[data-i18n="plur.hearPair"]').innerText(), 'Hear the Hebrew and Arabic greetings', 'direct, labelled purpose');
  await page.getByText('Optional pronunciation example beside the words.').waitFor();
  assert(await hearButton.isDisabled(), 'no Hebrew or Arabic voice (fake synth) → honestly disabled');
  await page.locator('#vst').getByText(/No Hebrew or Arabic voice is installed/).waitFor();
  assert.equal(await page.evaluate(() => window.__spokes.length), 0, 'nothing plays automatically');
  await hearButton.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__spokes.length), 0, 'disabled control stays inert under keyboard');
  await page.evaluate(() => window.__setVoices([
    { name: 'Hebrew Local', lang: 'he-IL' },
    { name: 'Arabic Local', lang: 'ar-SA' },
  ]));
  await page.waitForFunction(() => !document.getElementById('vsalam').disabled);
  await hearButton.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spokes.length === 2);
  assert.deepEqual(await page.evaluate(() => window.__spokes), ['שלום', 'سلام'], 'press plays the two greetings in sequence');
  await page.locator('#blangsel').selectOption('lv');
  await page.getByText('Klausies ivrita un arābu sveicienus', { exact: true }).waitFor();

  await page.locator('#say').fill('Synthetic offline test');
  await page.locator('#send').click();
  await page.getByText(/the tutor is unavailable in this copy/).waitFor();
  assert.equal(await page.locator('.thinking').count(), 0);
  assert.equal(await page.locator('.msg.hive').count(), 0, 'provider error must not become an empty successful reply');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['plur', 'blanguage']) {
    await page.goto(`${base}/surfaces/${name}.html`);
    for (const reg of ['bee', 'raver', 'cypherpunk']) {
      await page.locator(`#breg-${reg}`).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}/${reg}: overflow`);
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 6 desktop views, 6 mobile views, Latvian/Thai rendering, HTTP-refusal regression; pronunciation example labelled/optional/no-autoplay/honestly-disabled/keyboard-driven/translated; no page errors or external requests delivered.');
} finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
