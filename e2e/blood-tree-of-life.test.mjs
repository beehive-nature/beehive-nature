// The blood archive opens as Austras koks: a branch can be climbed, a person
// can be researched, and the dense atlas remains available. Also proves that
// opening blood.html as a local file shows an honest recovery state rather
// than the formerly blank canvas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('../../beehive-nature/e2e/node_modules/playwright/index.mjs')); }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8993;
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\//, '').replace(/\.\./g, '');
    const file = join(ROOT, path);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
let browser;
before(async () => {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser.close(); server.close(); });

test('Austras koks is the primary world and connects branch navigation to research', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/surfaces/blood.html`, { waitUntil: 'load' });
  await page.waitForSelector('#lifeTree .tol-stage');
  await page.waitForSelector('#ppanel[data-pp-mounted="1"]', { state: 'attached' });

  assert.equal(await page.getAttribute('#viewlife', 'aria-pressed'), 'true');
  assert.equal(await page.isVisible('#treeoflife'), true);
  assert.equal(await page.isVisible('#atlas'), false);
  assert.ok(await page.locator('#lifeTree .tol-node[data-person]').count() >= 4);
  assert.ok(await page.locator('#lifeTree .tol-limb[data-focus]').count() >= 4);

  const person = page.locator('#lifeTree .tol-node[data-person]').first();
  const id = await person.getAttribute('data-person');
  await person.click();
  assert.equal(await page.isVisible('#lifeTree .tol-card'), true);
  await page.locator('#lifeTree [data-story]').click();
  assert.equal(await page.getAttribute('#ppanel', 'data-pp-mounted'), '1');
  assert.match(await page.innerText('#ppanel'), /support:|evidence|recorded|colonial|medieval|saga/i);

  await page.locator('#lifeTree .tol-card [data-focus]').click();
  assert.equal((await page.evaluate(() => globalThis.__guxAtlas.getContext().root)), id);
  assert.match(await page.innerText('#lifeTree .tol-focus'), /climbing from/i);

  await page.click('#viewped');
  assert.equal(await page.isVisible('#treeoflife'), false);
  assert.equal(await page.isVisible('#atlas'), true);
  assert.equal(await page.getAttribute('.atlas-world', 'data-view'), 'pedigree');
  assert.deepEqual(errors, []);
  await page.close();
});

test('local-file opening presents a recovery message instead of a blank field', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(pathToFileURL(join(ROOT, 'surfaces', 'blood.html')).href, { waitUntil: 'load' });
  assert.equal(await page.isVisible('#treeoflife'), true);
  assert.match(await page.innerText('#lifeLoadingText'), /open this page through the local site server/i);
  assert.ok((await page.locator('.life-loading svg path').count()) >= 2);
  await page.close();
});
