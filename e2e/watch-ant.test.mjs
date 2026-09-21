// watch-ant.test.mjs — Watch from Autonomi plays a public video through the estate's ant door, whatever
// shape the door is in. The door is always MOCKED here (the real relay is touched zero times):
//   · today's antd 0.12.0: /stream is cut at a wrong Content-Length (4170 B), /data/public answers
//     {"data":"<base64>"} — the page must fall back to the envelope and play the decoded Blob;
//   · an upgraded antd (>= 0.12.1): /stream carries the whole file — the page plays it and never
//     downloads the envelope;
//   · door down, not a video, error envelope: the honest failure row, no page errors;
//   · a failure after the first frame still shows the failure row;
//   · a bad address requests nothing; a new address really cancels (aborts) the old download;
//   · the live door's reply shape (no Content-Length): the bar says busy, the counter moves, it plays.
// Fixture: a real 6 s H.264 MP4 already in the tree (moov first, like the founder's upload).
// Run: node --test e2e/watch-ant.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURF = join(HERE, '..', 'surfaces');
const MP4 = await readFile(join(HERE, '..', 'docs', 'mvp-walk', 'assets', 'genesis-3d', 'motion', 'green-teal-breathing.mp4'));
const PORT = 8873;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const DOOR = 'https://relay.skaists.dev/ant/v1/data/public/';
const A1 = 'ab'.repeat(32), A2 = 'cd'.repeat(32);   // shaped like addresses; built, not written out
const CUT = 4170;                                    // what antd 0.12.0 sent for the founder's 214 MB file
// The same MP4 with a legal 9 MB ISO-BMFF 'free' box appended: big enough that the page folds its
// decoded bytes into more than one 8 MB Blob segment, and still a playable file.
const FREE = Buffer.alloc(9 << 20); FREE.writeUInt32BE(FREE.length, 0); FREE.write('free', 4, 'latin1');
const BIG = Buffer.concat([MP4, FREE]);

const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    const ct = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : rel.endsWith('.css') ? 'text/css' : rel.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
    const body = await readFile(join(SURF, rel));
    s.writeHead(200, { 'content-type': ct }); s.end(body);
  } catch { s.writeHead(404); s.end(); }
});
let b = null;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); b = await chromium.launch(); });
after(async () => { if (b) await b.close(); srv.close(); });

const cors = { 'access-control-allow-origin': ORIGIN };
const envelope = bytes => JSON.stringify({ data: Buffer.from(bytes).toString('base64') });

// door: { stream(addr) -> fulfil opts | 'abort', json(addr) -> fulfil opts | 'abort' | Promise<...> }
async function open(door) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [], hits = { stream: [], json: [], stray: [], failed: [] };
  p.on('pageerror', e => errs.push(String(e)));
  p.on('requestfailed', r => hits.failed.push({ url: r.url(), err: r.failure()?.errorText || '' }));
  await ctx.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    if (url.startsWith(DOOR)) {
      const rest = url.slice(DOOR.length), addr = rest.slice(0, 64), isStream = rest.endsWith('/stream');
      (isStream ? hits.stream : hits.json).push(addr);
      const plan = await (isStream ? door.stream : door.json)(addr);
      if (plan === 'abort') return route.abort('connectionrefused').catch(() => {});
      return route.fulfill(plan).catch(() => {});
    }
    hits.stray.push(url);
    return route.abort('blockedbyclient');
  });
  return { ctx, p, errs, hits };
}
const state = p => p.evaluate(() => ({
  bad: !document.getElementById('s-bad').hidden, slow: !document.getElementById('s-slow').hidden,
  fail: !document.getElementById('s-fail').hidden, bar: !(document.getElementById('pg')?.hidden ?? true), got: !(document.getElementById('got')?.hidden ?? true),
  src: document.getElementById('v').currentSrc, w: document.getElementById('v').videoWidth,
  shown: document.getElementById('shown').textContent,
}));
async function watch(p, addr) {
  await p.fill('#addr', 'autonomi://' + addr);
  await p.click('button[type=submit]');
}
async function settles(p, pred, ms = 30000) {
  await p.waitForFunction(pred, null, { timeout: ms, polling: 200 });
  return state(p);
}
async function plays(p) {
  const t = await p.evaluate(async () => {
    const v = document.getElementById('v'); v.muted = true; await v.play();
    await new Promise(r => setTimeout(r, 1200)); return v.currentTime;
  });
  assert.ok(t > 0.3, `the clock advances (currentTime ${t})`);
}
const done = () => { const f = id => !document.getElementById(id).hidden; return f('s-fail') || (!f('s-slow') && !(document.getElementById('pg') && f('pg')) && document.getElementById('v').videoWidth > 0); };

test('antd 0.12.0 door: the cut stream falls back to the envelope, and the decoded Blob plays', async () => {
  const { ctx, p, errs, hits } = await open({
    stream: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream', 'content-length': String(CUT) }, body: MP4.subarray(0, CUT) }),
    json: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: envelope(BIG) }),
  });
  await p.goto(`${ORIGIN}/surfaces/watch-ant.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  const s = await settles(p, done, 60000);
  assert.equal(await p.locator('#got').textContent(), '9 MB', 'the counter reached the whole decoded file (two segments)');
  assert.equal(s.fail, false, 'no failure row'); assert.equal(s.slow, false); assert.equal(s.bar, false); assert.equal(s.got, false, 'the MB counter is put away');
  assert.equal(s.w, 720, 'the fixture decodes at its real width');
  assert.match(s.src, /^blob:/, 'the Blob is what plays');
  assert.equal(s.shown, 'autonomi://' + A1);
  await plays(p);
  assert.deepEqual([hits.stream.length, hits.json.length], [1, 1], 'stream tried once, envelope fetched once');
  assert.deepEqual(hits.stray, [], 'nothing else left the page'); assert.deepEqual(errs, []);
  await ctx.close();
});

test('upgraded door (antd >= 0.12.1): the whole stream plays and the envelope is never fetched', async () => {
  const { ctx, p, errs, hits } = await open({
    stream: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream', 'content-length': String(MP4.length) }, body: MP4 }),
    json: () => 'abort',   // counted below: it must never be asked for
  });
  await p.goto(`${ORIGIN}/surfaces/watch-ant.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  const s = await settles(p, done);
  assert.equal(s.fail, false); assert.equal(s.w, 720);
  assert.equal(s.src, DOOR + A1 + '/stream', 'the stream itself plays');
  await plays(p);
  // a failure AFTER the first frame (the door drops mid-file) must still reach the guest
  await p.evaluate(() => document.getElementById('v').dispatchEvent(new Event('error')));
  assert.equal((await state(p)).fail, true, 'a mid-play media error shows the failure row');
  assert.deepEqual([hits.stream.length, hits.json.length], [1, 0]);
  assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});

test('door down, not a video, error envelope: the honest failure row and no page errors', async () => {
  const cases = [
    ['door down', { stream: () => 'abort', json: () => 'abort' }],
    ['not a video', { stream: () => ({ status: 500, headers: cors, body: '' }), json: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: envelope(Buffer.from('plain words, not a video at all')) }) }],
    ['error envelope', { stream: () => ({ status: 404, headers: cors, body: '' }), json: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"not found"}' }) }],
    ['cut envelope', { stream: () => 'abort', json: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: envelope(MP4).slice(0, 5000) }) }],
  ];
  for (const [name, door] of cases) {
    const { ctx, p, errs, hits } = await open(door);
    await p.goto(`${ORIGIN}/surfaces/watch-ant.html`, { waitUntil: 'domcontentloaded' });
    await watch(p, A1);
    const s = await settles(p, done, 60000);
    assert.equal(s.fail, true, `${name}: failure row shown`);
    assert.equal(s.slow, false, `${name}: not left looking busy`); assert.equal(s.bar, false, `${name}: bar gone`); assert.equal(s.got, false, `${name}: counter gone`);
    assert.deepEqual(hits.stray, [], `${name}: nothing else left the page`); assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
});

test('a bad address requests nothing', async () => {
  const { ctx, p, errs, hits } = await open({ stream: () => 'abort', json: () => 'abort' });
  await p.goto(`${ORIGIN}/surfaces/watch-ant.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, 'not-an-address');
  const s = await state(p);
  assert.equal(s.bad, true); assert.equal(s.slow, false);
  assert.deepEqual([hits.stream.length, hits.json.length, hits.stray.length], [0, 0, 0]); assert.deepEqual(errs, []);
  await ctx.close();
});

test('a new address cancels the old download; only the new one plays', async () => {
  const { ctx, p, errs, hits } = await open({
    stream: () => 'abort',
    json: async addr => {
      if (addr === A1) { await new Promise(r => setTimeout(r, 4000)); return { status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: envelope(Buffer.from('stale bytes that must never play')) }; }
      return { status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: envelope(MP4) };
    },
  });
  await p.goto(`${ORIGIN}/surfaces/watch-ant.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  await p.waitForFunction(() => document.getElementById('pg') ? !document.getElementById('pg').hidden : !document.getElementById('s-slow').hidden, null, { timeout: 30000 });
  await watch(p, A2);
  const s = await settles(p, done, 60000);
  await p.waitForTimeout(4500);   // let the stale A1 reply land; it must change nothing
  const after = await state(p);
  assert.equal(after.fail, false, 'the stale reply did not flip the row'); assert.equal(after.w, 720);
  assert.equal(s.shown, 'autonomi://' + A2); assert.equal(after.shown, 'autonomi://' + A2);
  assert.match(after.src, /^blob:/);
  const staleEnvelope = hits.failed.filter(f => f.url === DOOR + A1);
  assert.equal(staleEnvelope.length, 1, 'the old envelope download was cancelled, not left running');
  assert.match(staleEnvelope[0].err, /ABORTED/i, `cancelled by the page (${staleEnvelope[0].err})`);
  await plays(p);
  assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});

test('the real door reply shape: no Content-Length, the bar says busy (never a frozen 0) and the Blob still plays', async () => {
  // Playwright's fulfil always adds Content-Length, but the live door reached Chromium without one.
  // Rebuild the envelope reply inside the page without that header, and dribble it so the busy
  // state can be seen.
  const { ctx, p, errs, hits } = await open({
    stream: () => 'abort',
    json: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: envelope(MP4) }),
  });
  await ctx.addInitScript(door => {
    const real = window.fetch;
    window.fetch = async (u, o) => {
      const r = await real(u, o);
      if (!String(u).startsWith(door)) return r;
      const h = new Headers(r.headers); h.delete('content-length');
      const slow = r.body.pipeThrough(new TransformStream({ async transform(c, out) {
        for (let i = 0; i < c.length; i += 65536) { await new Promise(z => setTimeout(z, 60)); out.enqueue(c.subarray(i, i + 65536)); }
      } }));
      return new Response(slow, { status: r.status, headers: h });
    };
  }, DOOR);
  await p.goto(`${ORIGIN}/surfaces/watch-ant.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  await p.waitForFunction(() => { const g = document.getElementById('pg'); return !g.hidden && !g.hasAttribute('value') && /\d+ MB/.test(document.getElementById('got').textContent); }, null, { timeout: 30000, polling: 50 });
  const s = await settles(p, done, 60000);
  assert.equal(s.fail, false); assert.equal(s.w, 720); assert.match(s.src, /^blob:/);
  await plays(p);
  assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});
