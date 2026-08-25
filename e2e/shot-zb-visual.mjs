// Visual audit shots (sprint 2026-08-24, zB set): 390px live screenshots.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', 'surfaces');
const OUT = join(HERE, 'shots-zb-visual');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const s = createServer(async (req, res) => {
  try {
    const body = await readFile(join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    res.writeHead(200, { 'Content-Type': MIME[extname(req.url)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
const base = await new Promise(r => s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${s.address().port}`)));

const PAGES = [
  ['studio-gate', 'blight/studio-gate.html'],
  ['studio-music', 'blight/studio-music.html'],
  ['organ', 'blight/midi-organ.html'],
  ['receive', 'onboarding/receive.html'],
  ['coop', 'blight/coop.html'],
  ['dids', 'keys/addresses.html'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
for (const [name, path] of PAGES) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/${path}`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(600);
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewportSize({ width: 390, height: Math.min(h, 2400) });
    await page.screenshot({ path: join(OUT, `before-${name}.png`), fullPage: false });
    console.log(`shot before-${name}.png  (scrollHeight ${h})`);
  } catch (e) { console.log(`FAIL ${name}: ${String(e).slice(0, 100)}`); }
  await page.close();
}
await browser.close();
