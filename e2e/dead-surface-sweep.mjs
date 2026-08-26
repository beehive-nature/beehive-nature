// One-shot dead/stub sweep (sprint 2026-08-24): load every local page the
// hub reaches, measure console errors, failed requests, and rendered
// substance (body text length + interactive elements). Ranks the worst.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdir, stat } from 'node:fs/promises';
import { join, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', 'surfaces');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wasm': 'application/wasm' };
const s = createServer(async (req, res) => {
  try {
    const body = await readFile(join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    res.writeHead(200, { 'Content-Type': MIME[extname(req.url)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
const base = await new Promise(r => s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${s.address().port}`)));

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'fleet-hosted' && e.name !== 'fleet') yield* walk(p); }
    else if (e.name.endsWith('.html')) yield p;
  }
}
const pages = [];
for await (const p of walk(ROOT)) pages.push(relative(ROOT, p).replace(/\\/g, '/'));

const browser = await chromium.launch();
const ctx = await browser.newContext();
const rows = [];
for (const p of pages) {
  const page = await ctx.newPage();
  const errs = [], reqfails = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 90)); });
  page.on('requestfailed', r => reqfails.push(r.url().replace(base, '').slice(0, 70)));
  try {
    await page.goto(`${base}/${p}`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').length,
      inter: document.querySelectorAll('button,a,input,canvas,select').length
    }));
    rows.push({ p, errs: errs.length, err0: errs[0] || '', reqfails: reqfails.length, rf0: reqfails[0] || '', text: m.text, inter: m.inter });
  } catch (e) {
    rows.push({ p, errs: -1, err0: String(e).slice(0, 90), reqfails: -1, rf0: '', text: 0, inter: 0 });
  }
  await page.close();
}
await browser.close();
rows.sort((a, b) => (b.errs - a.errs) || (a.text - b.text));
console.log('page | consoleErrs | reqFails | textLen | interactive | first error');
for (const r of rows.slice(0, 18))
  console.log(`${r.p} | ${r.errs} | ${r.reqfails} | ${r.text} | ${r.inter} | ${r.err0 || r.rf0}`);
console.log(`\ntotal pages: ${rows.length}`);
