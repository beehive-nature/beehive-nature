// Lane M beat 4 — fresh 390px/desktop images for the recovered+cured surfaces
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const server = createServer(async (req, res) => {
  try {
    const file = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function shot(page, path) { await page.screenshot({ path: join(ROOT, 'e2e', 'shots-music', path), fullPage: true }); }

// music.html — three registers, both widths
for (const reg of ['bee', 'raver', 'cypherpunk']) {
  for (const [w, h, tag] of [[390, 844, '390'], [1280, 800, '1280']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/surfaces/music.html`);
    await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
    await page.locator(`#breg-${reg}`).click();
    await page.waitForTimeout(400);
    await shot(page, `music-source-${reg}-${tag}.png`);
    await page.context().close();
    console.log(`shot music-source-${reg}-${tag}.png`);
  }
}
// listening.html — both widths (arrival state, honest idle line visible)
for (const [w, h, tag] of [[390, 844, '390'], [1280, 800, '1280']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${base}/surfaces/listening.html`);
  await page.waitForTimeout(400);
  await shot(page, `listening-${tag}.png`);
  await page.context().close();
  console.log(`shot listening-${tag}.png`);
}
await browser.close();
server.close();
console.log('done');
