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
  console.log('PASS: 6 desktop views, 6 mobile views, Latvian/Thai rendering, HTTP-refusal regression; no page errors or external requests delivered.');
} finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
