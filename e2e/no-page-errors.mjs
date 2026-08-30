// no-page-errors.mjs — the helper-missing gate (the T_ class).
// Walks every live surface from estate.json in a fresh page each and fails on
// ANY uncaught page error. Born from two days of landing collisions: a lost
// helper (T_) unlabeled the public status board for a day, and a gutted
// logbook lost three live entries — silent until someone walked.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const estate = JSON.parse(readFileSync(join(ROOT, 'estate.json'), 'utf8'));
const paths = estate.surfaces.filter(s => s.state === 'LIVE').map(s => s.path);

const srv = createServer(async (q, s) => {
  try {
    const p = join(SURF, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '').replace('surfaces/', ''));
    const body = await readFile(p);
    s.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
    s.end(body);
  } catch { s.writeHead(404); s.end(); }
});
srv.listen(8840, '127.0.0.1', async () => {
  const b = await chromium.launch();
  const bad = [];
  for (const path of paths) {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 90)));
    try {
      await p.goto('http://127.0.0.1:8840/' + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await p.waitForTimeout(400);
    } catch (e) { errs.push('load: ' + String(e).slice(0, 60)); }
    if (errs.length) bad.push(path + ' — ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  srv.close();
  console.log((paths.length) + ' surfaces walked · ' + (bad.length) + ' with page errors');
  bad.forEach(x => console.log('  ' + x));
  process.exit(bad.length ? 1 : 0);
});
