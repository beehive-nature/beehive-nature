// bViEw prebuffer receipts — before/after 390px (2026-09-26).
// Not part of the CI battery: the "before" surface is the previous main
// (fixed 12 MiB start) pulled from git at run time; the "after" is this tree.
// Door is mocked with the same shape as e2e/bview.test.mjs — the real relay
// is touched zero times. Fixture: the tree's 6 s H.264 MP4 + a 14 MiB free
// box so the OLD rule crosses its 12 MiB start mid-download.
// Each phase gets a FRESH context — init scripts and the device video cache
// must not leak between shots.
// Run: node e2e/bview-prebuffer-shots.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURF = join(HERE, '..', 'surfaces');
const SHOTS = join(HERE, 'shots-bview');
const MP4 = await readFile(join(HERE, '..', 'docs', 'mvp-walk', 'assets', 'genesis-3d', 'motion', 'green-teal-breathing.mp4'));
const FREE = Buffer.alloc(14 << 20); FREE.writeUInt32BE(FREE.length, 0); FREE.write('free', 4, 'latin1');
const BIG2 = Buffer.concat([MP4, FREE]);
const PORT = 8875, ORIGIN = `http://127.0.0.1:${PORT}`;
const DOOR = 'https://relay.skaists.dev/ant/v1/data/public/';
const A1 = 'ef'.repeat(32);

// the previous main's bview.html — the "before" behaviour (12 MiB fixed start)
const OLD = execFileSync('git', ['show', '2fb2052b3:surfaces/bview.html'], { maxBuffer: 1 << 24 });
const stage = await mkdtemp(join(tmpdir(), 'bview-shots-'));
await writeFile(join(stage, 'bview-before.html'), OLD);
await writeFile(join(stage, 'bview.html'), await readFile(join(SURF, 'bview.html')));

const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    let body;
    try { body = await readFile(join(stage, rel)); }
    catch { body = await readFile(join(SURF, rel)); }
    const ct = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : rel.endsWith('.css') ? 'text/css' : rel.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
    s.writeHead(200, { 'content-type': ct }); s.end(body);
  } catch { s.writeHead(404); s.end(); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
await mkdir(SHOTS, { recursive: true });

const cors = { 'access-control-allow-origin': ORIGIN };
const b = await chromium.launch();
const errs = [];
const phase = async ms => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  if (ms) {
    await ctx.addInitScript(({ door, ms }) => {
      const real = window.fetch;
      window.fetch = async (u, o) => {
        const r = await real(u, o);
        if (!String(u).startsWith(door) || !String(u).endsWith('/stream')) return r;
        const h = new Headers(r.headers);
        const slow = r.body.pipeThrough(new TransformStream({ async transform(c, out) {
          for (let i = 0; i < c.length; i += 65536) { await new Promise(z => setTimeout(z, ms)); out.enqueue(c.subarray(i, i + 65536)); }
        } }));
        return new Response(slow, { status: r.status, headers: h });
      };
    }, { door: DOOR, ms });
  }
  await ctx.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    if (url.startsWith(DOOR) && url.endsWith('/stream')) {
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream', 'content-length': String(BIG2.length) }, body: BIG2 }).catch(() => {});
    }
    return route.abort('blockedbyclient');
  });
  return { ctx, p };
};
const watch = async (p, file) => {
  await p.goto(`${ORIGIN}/surfaces/${file}`, { waitUntil: 'domcontentloaded' });
  await p.fill('#addr', 'autonomi://' + A1);
  await p.click('button[type=submit]');
};
const SLOW = 40;   // 64 KiB / 40 ms ~ 1.6 MB/s — behind this fixture's play rate
const FAST = 15;   // 64 KiB / 15 ms ~ 4.4 MB/s — ahead of the play rate (BIG2 ~2.5 MB/s)

// BEFORE — previous main: no readiness information mid-download
{
  const { ctx, p } = await phase(SLOW);
  await watch(p, 'bview-before.html');
  await p.waitForFunction(() => {
    const g = document.getElementById('got'); const pg = document.getElementById('pg');
    return pg && !pg.hidden && g && /\d+(\.\d)? MB · \d+(\.\d)? MB\/s/.test(g.textContent);
  }, null, { timeout: 60000, polling: 50 });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: join(SHOTS, 'prebuffer-before-390.png') });
  console.log('before shot: bar + counter, no readiness line (12 MiB fixed rule)');
  await ctx.close();
}

// AFTER — this tree: honest whole-file countdown on the same pipe
{
  const { ctx, p } = await phase(SLOW);
  await watch(p, 'bview.html');
  await p.waitForFunction(() => {
    const v = document.getElementById('v');
    return v.dataset.prebuffer === 'whole-file' && !document.getElementById('eta').hidden;
  }, null, { timeout: 90000, polling: 50 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(SHOTS, 'prebuffer-after-390.png') });
  console.log('after shot: whole-file countdown, playback rule on the sheet');
  await ctx.close();
}

// AFTER, fast pipe — the sustained start, still downloading
{
  const { ctx, p } = await phase(FAST);
  await watch(p, 'bview.html');
  await p.waitForFunction(() => document.getElementById('v').dataset.prebuffer === 'sustained', null, { timeout: 90000, polling: 50 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(SHOTS, 'prebuffer-after-fast-390.png') });
  console.log('after-fast shot: sustained early start while bytes still arrive');
  await ctx.close();
}

if (errs.length) { console.error('PAGE ERRORS:', errs); process.exit(1); }
await b.close(); srv.close();
console.log('shots written to e2e/shots-bview/');
