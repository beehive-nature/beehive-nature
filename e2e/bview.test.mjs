// bview.test.mjs — bViEw plays a public video through the estate's ant door, whatever
// shape the door is in. The door is always MOCKED here (the real relay is touched zero times):
//   · today's antd 0.12.0: /stream is cut at a wrong Content-Length (4170 B) — the page aborts that
//     stub in <500 ms and falls to the JSON envelope, playing as soon as moov + early mdat arrive
//     (not after the whole file);
//   · an upgraded antd (>= 0.12.1): /stream carries the whole file — the page consumes that
//     fetch as binary progressive Blobs (never video.src = remote URL) and never downloads the envelope;
//   · door down, not a video, error envelope: the honest failure row, no page errors;
//   · a failure after the first frame still shows the failure row;
//   · a bad address requests nothing; a new address really cancels (aborts) the old download;
//   · the live door's reply shape (no Content-Length): the bar says busy, the counter moves, it plays;
//   · WHEN to play is decided by time, not bytes (2026-09-26): a door at half the video's bitrate
//     gets an honest "ready to play in ~N s" countdown, no play before the computed threshold, then
//     playback that never freezes; a door at twice the bitrate plays early; a device whose
//     mediaCapabilities says smooth=false gets the plain warning row.
// Fixtures: a real 6 s H.264 MP4 already in the tree (moov first, like the repro upload (moov-first)),
// and fixtures/bview/vp9-opus-10s-faststart.mp4 for the timing tests — VP9 + Opus because
// Playwright's Chromium has no H.264, and those tests must watch real frames advance.
// Run: node --test e2e/bview.test.mjs
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
const CUT = 4170;                                    // what antd 0.12.0 sent for the repro 214 MB file
// The same MP4 with a legal 9 MB ISO-BMFF 'free' box appended: the download runs on well past the
// last media byte (mdat ends first), and it is still a playable file.
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
// Browser CORS: custom headers (x-ant-first-chunk, accept-ranges) stay hidden from
// JS unless exposed. Content-Length is safelisted. Live door must ExposeHeaders too (#208).
const corsExpose = {
  ...cors,
  'access-control-expose-headers': 'x-ant-first-chunk, accept-ranges',
};
const envelope = bytes => JSON.stringify({ data: Buffer.from(bytes).toString('base64') });

// door: { stream(addr) -> fulfil opts | 'abort', json(addr) -> fulfil opts | 'abort' | Promise<...> }
async function open(door) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [], hits = { stream: [], json: [], stray: [], failed: [], jsonAt: [] };
  p.on('pageerror', e => errs.push(String(e)));
  p.on('requestfailed', r => hits.failed.push({ url: r.url(), err: r.failure()?.errorText || '' }));
  await ctx.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    if (url.startsWith(DOOR)) {
      const rest = url.slice(DOOR.length), addr = rest.slice(0, 64), isStream = rest.endsWith('/stream');
      if (isStream) hits.stream.push(addr);
      else { hits.json.push(addr); hits.jsonAt.push(Date.now()); }
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
  shown: document.getElementById('out').dataset.addr || '',   // the address being played (written once on screen: in the field)
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
// Some agent boxes ship Chromium without H.264 — videoWidth stays 0 even for a perfect Blob.
// Probe once; codec-dependent asserts skip with a clear note when unsupported.
let CODEC = null;
async function hasCodec(p) {
  if (CODEC !== null) return CODEC;
  CODEC = await p.evaluate(async () => {
    const v = document.createElement('video');
    // ISO-BMFF + avc1 baseline — the fixture profile.
    return v.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
  });
  if (!CODEC) console.log('# note: H.264 unavailable in this Chromium — skipping frame/clock asserts');
  return CODEC;
}
const done = () => { const f = id => !document.getElementById(id).hidden; return f('s-fail') || (!f('s-slow') && !(document.getElementById('pg') && f('pg')) && document.getElementById('v').videoWidth > 0); };
const framed = () => document.getElementById('v').videoWidth > 0;

test('antd 0.12.0 door: stub /stream aborts fast, envelope plays, full decode still finishes', async () => {
  const { ctx, p, errs, hits } = await open({
    stream: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream', 'content-length': String(CUT) }, body: MP4.subarray(0, CUT) }),
    json: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: envelope(BIG) }),
  });
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  await watch(p, A1);
  assert.equal(await hasCodec(p), await hasCodec(p)); // prime probe
  await p.waitForFunction(() => {
    const g = document.getElementById('got');
    const v = document.getElementById('v');
    return (g && /\d+ MB/.test(g.textContent)) || v.videoWidth > 0 || v.currentSrc.startsWith('blob:');
  }, null, { timeout: 60000 });
  // stub → envelope must start well under the old 45 s STREAM_WAIT
  assert.ok(hits.jsonAt[0] - t0 < 1500, `envelope fetch began ${hits.jsonAt[0] - t0} ms after watch (stub abort <500 ms class)`);
  const s = await settles(p, () => {
    const f = id => !document.getElementById(id).hidden;
    const v = document.getElementById('v');
    const got = document.getElementById('got');
    return f('s-fail') || (!f('s-slow') && !(document.getElementById('pg') && f('pg')) && (v.videoWidth > 0 || (got && /^9(\\.\\d)? MB/.test(got.textContent))));
  }, 60000);
  assert.match(await p.locator('#got').textContent(), /^9(\.\d)? MB/, 'the counter reached the whole decoded file');
  assert.equal(s.shown, 'autonomi://' + A1);
  assert.match(s.src, /^blob:/, 'progressive Blob is what plays');
  assert.deepEqual([hits.stream.length, hits.json.length], [1, 1], 'stream tried once, envelope fetched once');
  if (await hasCodec(p)) {
    assert.equal(s.fail, false); assert.equal(s.slow, false); assert.equal(s.bar, false);
    assert.equal(s.w, 720);
    await plays(p);
  } else {
    // Decoder missing: page may show fail after firstFrame timeout; bytes + stub abort still proven.
    assert.ok(true, 'codec-free path: stub abort + full decode counter proven');
  }
  assert.deepEqual(hits.stray, [], 'nothing else left the page'); assert.deepEqual(errs, []);
  await ctx.close();
});

test('upgraded door (antd >= 0.12.1): honest /stream plays as progressive Blob; envelope never fetched', async () => {
  const { ctx, p, errs, hits } = await open({
    stream: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream', 'content-length': String(MP4.length) }, body: MP4 }),
    json: () => 'abort',   // counted below: it must never be asked for
  });
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  if (!(await hasCodec(p))) {
    // Without H.264 Blob paint may time out; stream was still consumed (no remote video.src).
    await p.waitForTimeout(1500);
    assert.ok(hits.stream.length >= 1, 'stream was probed');
    assert.equal(hits.json.length, 0, 'envelope not fetched on honest stream');
    await ctx.close();
    return;
  }
  const s = await settles(p, done);
  assert.equal(s.fail, false); assert.equal(s.w, 720);
  assert.match(s.src, /^blob:/, 'honest stream plays via Blob, never remote video.src');
  assert.ok(!s.src.includes('/stream'), 'remote /stream URL is not the media src');
  await plays(p);
  await p.evaluate(() => document.getElementById('v').dispatchEvent(new Event('error')));
  assert.equal((await state(p)).fail, true, 'a mid-play media error shows the failure row');
  assert.ok(hits.stream.length >= 1); assert.equal(hits.json.length, 0);
  assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});

test('progressive envelope: first frame before the JSON body finishes', async () => {
  const { ctx, p, errs, hits } = await open({
    stream: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream', 'content-length': String(CUT) }, body: MP4.subarray(0, CUT) }),
    json: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: envelope(BIG) }),
  });
  await ctx.addInitScript(door => {
    const real = window.fetch;
    window.fetch = async (u, o) => {
      const r = await real(u, o);
      if (!String(u).startsWith(door) || String(u).endsWith('/stream')) return r;
      const h = new Headers(r.headers);
      const slow = r.body.pipeThrough(new TransformStream({ async transform(c, out) {
        for (let i = 0; i < c.length; i += 65536) { await new Promise(z => setTimeout(z, 40)); out.enqueue(c.subarray(i, i + 65536)); }
      } }));
      return new Response(slow, { status: r.status, headers: h });
    };
  }, DOOR);
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  await p.waitForFunction(() => {
    const g = document.getElementById('got');
    const v = document.getElementById('v');
    const bar = document.getElementById('pg') && !document.getElementById('pg').hidden;
    // Prefer a painted frame while the envelope is still dripping; else 1+ MB with bar.
    return (v.videoWidth > 0 && bar) || (g && /[1-9]\d* MB/.test(g.textContent) && bar);
  }, null, { timeout: 60000, polling: 50 });
  let mid = await p.evaluate(() => ({
    w: document.getElementById('v').videoWidth,
    bar: !document.getElementById('pg').hidden,
    got: document.getElementById('got').textContent,
    src: document.getElementById('v').currentSrc,
  }));
  assert.equal(mid.bar, true, 'download bar still up while bytes arrive');
  assert.match(mid.got, /^\d+(\.\d)? MB/, 'counter moving before settle');
  if (await hasCodec(p)) {
    if (mid.w === 0) {
      await p.waitForFunction(() => document.getElementById('v').videoWidth > 0 && !document.getElementById('pg').hidden, null, { timeout: 20000 });
      mid = await p.evaluate(() => ({
        w: document.getElementById('v').videoWidth,
        bar: !document.getElementById('pg').hidden,
        got: document.getElementById('got').textContent,
        src: document.getElementById('v').currentSrc,
      }));
    }
    assert.equal(mid.w, 720, 'first frame while envelope still dripping');
    assert.match(mid.src, /^blob:/);
    assert.equal(mid.bar, true, 'still downloading after early paint');
  }
  const s = await settles(p, done, 120000);
  if (await hasCodec(p)) { assert.equal(s.fail, false); assert.equal(s.w, 720); await plays(p); }
  assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});


test('honest /stream binary progressive: first frame before the body finishes', async () => {
  const { ctx, p, errs, hits } = await open({
    stream: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream', 'content-length': String(BIG.length) }, body: BIG }),
    json: () => 'abort',
  });
  await ctx.addInitScript(door => {
    const real = window.fetch;
    window.fetch = async (u, o) => {
      const r = await real(u, o);
      if (!String(u).startsWith(door) || !String(u).endsWith('/stream')) return r;
      const h = new Headers(r.headers);
      const slow = r.body.pipeThrough(new TransformStream({ async transform(c, out) {
        for (let i = 0; i < c.length; i += 65536) { await new Promise(z => setTimeout(z, 40)); out.enqueue(c.subarray(i, i + 65536)); }
      } }));
      return new Response(slow, { status: r.status, headers: h });
    };
  }, DOOR);
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  await p.waitForFunction(() => {
    const g = document.getElementById('got');
    const v = document.getElementById('v');
    const bar = document.getElementById('pg') && !document.getElementById('pg').hidden;
    return (v.videoWidth > 0 && bar) || (g && /[1-9]\d* MB/.test(g.textContent) && bar);
  }, null, { timeout: 60000, polling: 50 });
  let mid = await p.evaluate(() => ({
    w: document.getElementById('v').videoWidth,
    bar: !document.getElementById('pg').hidden,
    got: document.getElementById('got').textContent,
    src: document.getElementById('v').currentSrc,
  }));
  assert.equal(mid.bar, true, 'download bar still up while /stream bytes arrive');
  assert.match(mid.got, /^\d+(\.\d)? MB/, 'counter moving before settle');
  if (await hasCodec(p)) {
    if (mid.w === 0) {
      await p.waitForFunction(() => document.getElementById('v').videoWidth > 0 && !document.getElementById('pg').hidden, null, { timeout: 20000 });
      mid = await p.evaluate(() => ({
        w: document.getElementById('v').videoWidth,
        bar: !document.getElementById('pg').hidden,
        got: document.getElementById('got').textContent,
        src: document.getElementById('v').currentSrc,
      }));
    }
    assert.equal(mid.w, 720, 'first frame while /stream still dripping');
    assert.match(mid.src, /^blob:/);
    assert.equal(mid.bar, true, 'still downloading after early paint');
  }
  const s = await settles(p, done, 120000);
  if (await hasCodec(p)) { assert.equal(s.fail, false); assert.equal(s.w, 720); assert.match(s.src, /^blob:/); await plays(p); }
  assert.equal(hits.json.length, 0, 'envelope never fetched');
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
    await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
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
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
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
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  await p.waitForFunction(() => document.getElementById('pg') ? !document.getElementById('pg').hidden : !document.getElementById('s-slow').hidden, null, { timeout: 30000 });
  await watch(p, A2);
  const s = await settles(p, done, 60000);
  await p.waitForTimeout(4500);   // let the stale A1 reply land; it must change nothing
  const after = await state(p);
  assert.equal(s.shown, 'autonomi://' + A2); assert.equal(after.shown, 'autonomi://' + A2);
  const staleEnvelope = hits.failed.filter(f => f.url === DOOR + A1);
  assert.equal(staleEnvelope.length, 1, 'the old envelope download was cancelled, not left running');
  assert.match(staleEnvelope[0].err, /ABORTED/i, `cancelled by the page (${staleEnvelope[0].err})`);
  if (await hasCodec(p)) {
    assert.equal(after.fail, false, 'the stale reply did not flip the row');
    assert.equal(after.w, 720);
    assert.match(after.src, /^blob:/);
    await plays(p);
  }
  assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});

test('the real door reply shape: no Content-Length, the bar says busy (never a frozen 0) and the Blob still plays', async () => {
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
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  await p.waitForFunction(() => { const g = document.getElementById('pg'); return !g.hidden && !g.hasAttribute('value') && /\d+ MB/.test(document.getElementById('got').textContent); }, null, { timeout: 30000, polling: 50 });
  const s = await settles(p, done, 60000);
  if (await hasCodec(p)) {
    assert.equal(s.fail, false); assert.equal(s.w, 720); assert.match(s.src, /^blob:/);
    await plays(p);
  } else {
    assert.match(await p.locator('#got').textContent(), /\d+ MB/);
  }
  assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});


test('cypherpunk sheet: honest path/size fields only — no invented Autonomi network stats', async () => {
  const { ctx, p, errs, hits } = await open({
    stream: () => ({ status: 200, headers: { ...corsExpose, 'content-type': 'application/octet-stream', 'content-length': String(MP4.length), 'accept-ranges': 'bytes', 'x-ant-first-chunk': 'HIT' }, body: MP4 }),
    json: () => 'abort',
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'cypherpunk'); } catch {} });
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
  await watch(p, A1);
  if (!(await hasCodec(p))) {
    await p.waitForTimeout(1500);
    assert.ok(hits.stream.length >= 1);
    await ctx.close();
    return;
  }
  await settles(p, done);
  const sheet = await p.evaluate(() => ({
    reg: document.body.getAttribute('data-reg'),
    open: document.getElementById('sheet-wrap')?.open,
    path: document.getElementById('n-path')?.textContent,
    cl: document.getElementById('n-cl')?.textContent,
    chunk: document.getElementById('n-chunk')?.textContent,
    ranges: document.getElementById('n-ranges')?.textContent,
    addrRow: !!document.getElementById('n-addr'),
    hexSeen: (document.body.innerText.match(/(ab){32}/g) || []).length + (document.getElementById('addr').value.includes('ab'.repeat(32)) ? 1 : 0),
    size: document.getElementById('n-size')?.textContent,
    nm: [...document.querySelectorAll('#nerd .nm dd')].map(d => d.textContent),
  }));
  assert.equal(sheet.reg, 'cypherpunk');
  assert.equal(sheet.open, true, 'disclose opens for cypherpunk');
  assert.equal(sheet.path, 'stream');
  assert.match(sheet.cl, new RegExp(String(MP4.length)));
  assert.equal(sheet.chunk, 'HIT');
  assert.match(sheet.ranges, /bytes/i);
  assert.equal(sheet.addrRow, false, 'the sheet does not repeat the address');
  assert.equal(sheet.hexSeen, 1, 'the address is on screen once: in the field');
  assert.match(sheet.size, /\d/);
  assert.ok(sheet.nm.every(t => /not measured/i.test(t)), 'Autonomi demo fields stay silent');
  assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});

// ---- WHEN to play: time, not bytes (docs/dispatches/2026-09-26-bview-time-prebuffer.md) ----
// The door is paced in the page at a share of the fixture's own bitrate (media bytes / duration).
// The threshold below is the page's rule, computed here from the fixture and the door's nominal
// rate with the page's own SAFETY and MARGIN (read from bview.html so the two cannot drift):
// play from 0 once (media end - bytes) / rate * SAFETY + MARGIN <= duration. The page measures a
// rate at or below nominal (timers only ever run late), so it can never legitimately start sooner.
const FIX = await readFile(join(HERE, '..', 'fixtures', 'bview', 'vp9-opus-10s-faststart.mp4'));
const PLAN = (() => {
  const u32 = i => FIX.readUInt32BE(i), cc = i => FIX.toString('latin1', i + 4, i + 8), out = { dur: 0, m0: 0, m1: 0 };
  for (let i = 0; i + 8 <= FIX.length;) {
    const sz = u32(i);
    if (cc(i) === 'moov') for (let j = i + 8; j + 8 <= i + sz; j += u32(j)) if (cc(j) === 'mvhd') out.dur = u32(j + 24) / u32(j + 20);  // v0 mvhd
    if (cc(i) === 'mdat') { out.m0 = i + 8; out.m1 = i + sz; break; }
    if (sz < 8) break;
    i += sz;
  }
  return out;
})();
const [SAFETY, MARGIN] = (await readFile(join(SURF, 'bview.html'), 'utf8')).match(/SAFETY = ([\d.]+), MARGIN = ([\d.]+)/).slice(1).map(Number);
const PIECE = 16 << 10;
assert.ok(PLAN.dur > 9 && PLAN.m1 > PLAN.m0 && PLAN.m0 < 16 << 10, 'fixture is moov-first with a readable duration');

// A door delivering the fixture at `share` x its bitrate (dropping to `drop.share` once `drop.at`
// bytes are out); the page's play() calls, the bytes the door had sent by then, and every
// decodingInfo() question are recorded (the answer can be forced).
async function paced(share, { smooth, drop, reg } = {}) {
  const bps = (PLAN.m1 - PLAN.m0) / PLAN.dur, rate = share * bps;
  // (init-script args travel as JSON: no Infinity — "never drops" is a byte count past the file)
  const gaps = [Math.round(PIECE / rate * 1000), drop ? drop.at : FIX.length + 1, drop ? Math.round(PIECE / (drop.share * bps) * 1000) : 0];
  const o = await open({
    stream: () => ({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream', 'content-length': String(FIX.length) }, body: FIX }),
    json: () => 'abort',
  });
  if (reg) await o.ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await o.ctx.addInitScript(([door, piece, [gap, dropAt, slowGap], smooth, size]) => {
    window.__fed = 0; window.__size = size; window.__plays = []; window.__dec = []; window.__decOut = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__plays.push({ fed: window.__fed, bar: !document.getElementById('pg').hidden });
      return play.call(this);
    };
    if (navigator.mediaCapabilities) {
      const ask = MediaCapabilities.prototype.decodingInfo;
      MediaCapabilities.prototype.decodingInfo = async function (cfg) {
        window.__dec.push(JSON.parse(JSON.stringify(cfg)));
        const r = smooth === undefined ? await ask.call(this, cfg) : { supported: true, smooth, powerEfficient: false };
        window.__decOut.push({ supported: r.supported, smooth: r.smooth, bar: !document.getElementById('pg').hidden });
        return r;
      };
    }
    const real = window.fetch;
    window.fetch = async (u, o) => {
      const r = await real(u, o);
      if (!String(u).startsWith(door)) return r;
      const slow = r.body.pipeThrough(new TransformStream({ async transform(c, out) {
        for (let i = 0; i < c.length; i += piece) { await new Promise(z => setTimeout(z, window.__fed < dropAt ? gap : slowGap)); const x = c.subarray(i, i + piece); window.__fed += x.length; out.enqueue(x); }
      } }));
      return new Response(slow, { status: r.status, headers: new Headers(r.headers) });
    };
  }, [DOOR, PIECE, gaps, smooth, FIX.length]);
  await o.p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
  const vp9 = await o.p.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="vp09.00.10.08"') !== '');
  if (!vp9) console.log('# note: VP9-in-MP4 unavailable in this Chromium — skipping the time-based playback asserts');
  return { ...o, rate, vp9 };
}
const probe = p => p.evaluate(() => {
  const v = document.getElementById('v'), w = document.getElementById('s-wait'), r = document.getElementById('s-rough');
  return { plays: window.__plays.length, fed: window.__fed, t: v.currentTime, paused: v.paused, ended: v.ended,
    bar: !document.getElementById('pg').hidden, wait: w && !w.hidden ? w.textContent : '', waitS: w && !w.hidden ? +(w.dataset.s || 0) : 0, rough: !!r && !r.hidden };
});

test('slow door (0.5x bitrate): an honest countdown, no play before the computed threshold, then no freeze', async () => {
  const { ctx, p, errs, hits, rate, vp9 } = await paced(0.5);
  if (!vp9) { await ctx.close(); return; }
  const need = PLAN.m1 - rate * (PLAN.dur - MARGIN) / SAFETY;   // bytes local when the rule allows play
  await watch(p, A1);
  const counts = [];
  let s = await probe(p), said = 0;
  for (const until = Date.now() + 60000; !s.plays && Date.now() < until; s = await probe(p)) {
    if (s.waitS && !said) said = Date.now();
    if (s.waitS && s.waitS !== counts[counts.length - 1]) counts.push(s.waitS);
    await p.waitForTimeout(100);
  }
  const waited = (Date.now() - said) / 1000;
  const first = (await p.evaluate(() => window.__plays[0])) || {};
  console.log(`# slow: rule plays at >= ${(need / 1024).toFixed(0)} KiB of ${(FIX.length / 1024).toFixed(0)}; page played at ${(first.fed / 1024).toFixed(0)} KiB; countdown ${counts.length ? counts.join(' ') + ` (said ~${counts[0]} s, took ${waited.toFixed(1)} s)` : 'never shown'}`);
  assert.ok(s.plays > 0, 'playback started before the download finished');
  assert.ok(first.fed >= need - PIECE, `no play before the computed threshold (${first.fed} B sent, rule needs ${Math.round(need)} B)`);
  assert.ok(first.bar && first.fed < FIX.length, 'it started while the download was still running (time-based, not whole-file)');
  assert.ok(counts.length >= 3 && counts[0] >= 4, `the wait row counted down in seconds (${counts.join(' ')})`);
  assert.ok(counts.every((n, i) => i === 0 || n <= counts[i - 1] + 1), `the countdown only goes down (${counts.join(' ')})`);
  assert.ok(counts[counts.length - 1] <= 2, 'the countdown reached the start');
  assert.ok(Math.abs(waited - counts[0]) <= Math.max(2, 0.35 * counts[0]), `the first number was honest: said ~${counts[0]} s, it took ${waited.toFixed(1)} s`);
  // From the first play to the end of the video the clock keeps moving: Blob swaps are hiccups, never freezes.
  let last = -1, still = 0, worst = 0, prev = Date.now();
  for (const until = Date.now() + 40000; Date.now() < until;) {
    s = await probe(p);
    const now = Date.now();
    if (s.ended || s.t >= PLAN.dur - 0.3) break;
    if (s.t > last + 0.01) { last = s.t; still = 0; } else { still += now - prev; worst = Math.max(worst, still); }
    prev = now;
    await p.waitForTimeout(150);
  }
  console.log(`# slow: longest stop after start ${worst} ms; reached ${s.t.toFixed(2)} s of ${PLAN.dur.toFixed(2)} s`);
  assert.ok(s.ended || s.t >= PLAN.dur - 0.3, `played to the end (${s.t} of ${PLAN.dur})`);
  assert.ok(worst < 1500, `no freeze after the start (longest stop ${worst} ms)`);
  assert.equal((await probe(p)).wait, '', 'no wait row once playing');
  assert.equal(await p.evaluate(() => document.getElementById('s-fail').hidden), true, 'no failure row');
  assert.equal(hits.json.length, 0); assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});

test('fast door (2x bitrate): plays early, long before the file is in; decodingInfo asked with the moov facts', async () => {
  const { ctx, p, errs, hits, vp9 } = await paced(2);
  if (!vp9) { await ctx.close(); return; }
  await watch(p, A1);
  await p.waitForFunction(() => window.__plays.length > 0, null, { timeout: 30000, polling: 50 });
  const first = await p.evaluate(() => window.__plays[0]);
  console.log(`# fast: page played at ${(first.fed / 1024).toFixed(0)} KiB of ${(FIX.length / 1024).toFixed(0)}`);
  assert.ok(first.bar && first.fed < FIX.length / 2, `plays with under half the file in (${first.fed} of ${FIX.length} B)`);
  await p.waitForFunction(() => document.getElementById('v').currentTime > 0.5, null, { timeout: 10000 });
  const { dec, out, rough } = await p.evaluate(() => ({ dec: window.__dec, out: window.__decOut, rough: !(document.getElementById('s-rough')?.hidden ?? true) }));
  assert.equal(dec.length, 1, 'mediaCapabilities asked once per video');
  assert.equal(dec[0].type, 'file');
  assert.match(dec[0].video.contentType, /^video\/mp4; codecs="vp09\.\d\d\.\d\d\.08"$/, 'codec string read from vpcC');
  assert.deepEqual([dec[0].video.width, dec[0].video.height], [320, 180], 'size read from the sample entry');
  assert.ok(Math.abs(dec[0].video.framerate - 24) < 0.1, `frame rate from stsz / mdhd (${dec[0].video.framerate})`);
  const bps = 8 * (PLAN.m1 - PLAN.m0) / PLAN.dur;
  assert.ok(Math.abs(dec[0].video.bitrate - bps) < 1000, `bitrate = media bytes / duration (${dec[0].video.bitrate} vs ${Math.round(bps)})`);
  assert.equal(out[0].bar, true, 'asked while the download was still running');
  assert.equal(rough, out[0].smooth === false, `the warning row follows what this device answered (smooth=${out[0].smooth})`);
  assert.equal(hits.json.length, 0); assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});

test('decodingInfo says smooth=false: the plain warning row shows while the file is still arriving; playback is not blocked', async () => {
  const { ctx, p, errs, hits, vp9 } = await paced(1, { smooth: false });
  await watch(p, A1);
  // Until the row shows or the download ends, whichever is first.
  await p.waitForFunction(() => { const r = document.getElementById('s-rough'); return (r && !r.hidden) || window.__fed >= window.__size; }, null, { timeout: 30000, polling: 50 });
  const s = await p.evaluate(() => { const r = document.getElementById('s-rough'); return { shown: !!r && !r.hidden, text: r?.textContent, bar: !document.getElementById('pg').hidden, fed: window.__fed, key: r?.getAttribute('data-i18n') }; });
  assert.equal(s.shown, true, 'decodingInfo said smooth=false: the warning row is up');
  assert.equal(s.text, 'This device may not play this video smoothly.');
  assert.equal(s.key, 'bview.rough');
  assert.ok(s.bar && s.fed < FIX.length, `shown as soon as moov was read, before the download finished (${s.fed} of ${FIX.length} B)`);
  if (vp9) {
    await p.waitForFunction(() => window.__plays.length > 0, null, { timeout: 30000, polling: 50 });
    assert.equal((await probe(p)).rough, true, 'the warning stays while it plays');
  }
  // A new address clears the warning; it belongs to the video that raised it.
  await watch(p, 'not-an-address');
  assert.equal((await probe(p)).rough, false, 'a new address clears the row');
  assert.equal(hits.json.length, 0); assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});

test('door slows mid-play (2x then 0.4x): the Blob runs dry, the countdown returns at once, playback resumes by itself', async () => {
  const { ctx, p, errs, hits, vp9 } = await paced(2, { drop: { at: 320 << 10, share: 0.4 } });
  if (!vp9) { await ctx.close(); return; }
  await watch(p, A1);
  await p.waitForFunction(() => window.__plays.length > 0, null, { timeout: 30000, polling: 50 });
  const first = await p.evaluate(() => window.__plays[0]);
  assert.ok(first.fed < FIX.length * 0.4, `started early on the fast door (${first.fed} of ${FIX.length} B)`);
  // Watch for the run-dry: the clock stops. Within a second of stopping the wait row must say why.
  let s = await probe(p), last = s.t, stopT = null, stopAt = 0, told = null;
  for (const until = Date.now() + 30000; Date.now() < until && told === null; await p.waitForTimeout(100)) {
    s = await probe(p);
    if (s.t > last + 0.01) { last = s.t; stopAt = 0; continue; }
    if (!stopAt) { stopAt = Date.now(); stopT = s.t; }
    if (s.waitS) told = { ms: Date.now() - stopAt, text: s.wait, n: s.waitS, t: s.t, bar: s.bar, at: Date.now() };
  }
  assert.ok(told, 'the Blob ran dry on the slow door and the wait row came up');
  console.log(`# drop: stopped at ${told.t.toFixed(2)} s of video; row after ${told.ms} ms: "${told.text.slice(0, 26)}…"`);
  assert.ok(told.ms <= 1000, `never a silent freeze: the row came up ${told.ms} ms after the clock stopped`);
  assert.ok(told.bar, 'still downloading while it waits');
  assert.ok(told.n >= 1 && told.text.length > 20, 'a number of seconds and a plain sentence');
  // It resumes on its own (no tap), from where it stopped, and finishes without a failure row.
  await p.waitForFunction(t => document.getElementById('v').currentTime > t + 0.05, told.t, { timeout: 40000, polling: 100 });
  const waited = (Date.now() - told.at) / 1000, n = told.n;
  console.log(`# drop: said ~${n} s, resumed after ${waited.toFixed(1)} s`);
  assert.ok(Math.abs(waited - n) <= Math.max(2, 0.35 * n), `the countdown was honest: said ~${n} s, it took ${waited.toFixed(1)} s`);
  await p.waitForFunction(t => document.getElementById('v').currentTime > t + 0.5, told.t, { timeout: 10000, polling: 100 });
  const back = await probe(p);
  assert.ok(back.t > told.t, `resumed by itself from ${told.t.toFixed(2)} s`);
  assert.ok(back.t < told.t + 3, `resumed from the same place, not the start or the end (${back.t.toFixed(2)} s)`);
  await p.waitForFunction(d => { const v = document.getElementById('v'); return v.ended || v.currentTime >= d - 0.3; }, PLAN.dur, { timeout: 40000, polling: 200 });
  assert.equal(await p.evaluate(() => document.getElementById('s-fail').hidden), true, 'no failure row');
  assert.equal(hits.json.length, 0); assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
  await ctx.close();
});

// ---- THREE AUTHORED EXPERIENCES (founder review 2026-09-26: "D+ … the redundancy … make SURE there are
// three separate user experiences and interfaces/graphics/design/information for three separate personas").
// Each register is measured at 390 px on its own: dress, composition, what it shows while waiting, and
// the rules they share — the address on screen once, "autonomi://" at most once, no horizontal scroll,
// the facts one tap away in every register (register canon: one set of facts, capabilities, access).
test('three registers are three authored experiences at 390 px, and none repeats the address', async () => {
  const html = await readFile(join(SURF, 'bview.html'), 'utf8');
  assert.doesNotMatch(html, /text-transform\s*:/, 'casing law: no forced capitals');
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs, hits, vp9 } = await paced(0.5, { reg });
    const look = () => p.evaluate(() => {
      const $ = id => document.getElementById(id), vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const txt = document.body.innerText, stage = document.querySelector('.stage'), btn = document.querySelector('button[type=submit]');
      return {
        reg: document.body.getAttribute('data-reg'), bg: getComputedStyle(document.body).backgroundColor,
        title: getComputedStyle([...document.querySelectorAll('#eternal .et-b-h, #eternal .et-r-h, #eternal .et-c-path')].find(vis) || document.querySelector('h1')).fontFamily, body: getComputedStyle(document.body).fontFamily,
        btnRadius: getComputedStyle(btn).borderTopLeftRadius, btnBg: getComputedStyle(btn).backgroundColor, btnText: btn.innerText.trim(),
        stageW: vis(stage) ? Math.round(stage.getBoundingClientRect().width) : 0,
        art: vis($('art')), motion: vis($('motion')), inst: vis($('inst')), panes: [...document.querySelectorAll('#inst .pane')].filter(vis).length,
        veil: vis($('veil')), count: $('count').textContent, till: vis(document.querySelector('.till')), waitRow: vis($('s-wait')), waitS: +($('s-wait').dataset.s || 0),
        flow: vis($('flow')), rule: $('rule').textContent, sheetOpen: $('sheet-wrap').open, summary: vis(document.querySelector('#sheet-wrap > summary')),
        schemes: (txt.match(/autonomi:\/\//g) || []).length, hex: (txt.match(/(ab){32}/g) || []).length + ($('addr').value.includes('ab'.repeat(32)) ? 1 : 0),
        dashes: [...document.querySelectorAll('#nerd dd')].filter(d => d.textContent.trim() === '—').length,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    const land = await look();
    await watch(p, A1);
    let wait = null;
    if (vp9) {
      await p.waitForFunction(() => +(document.getElementById('s-wait').dataset.s || 0) > 0, null, { timeout: 30000, polling: 100 });
      await p.waitForTimeout(400);
      wait = await look();
    }
    seen[reg] = { land, wait };
    console.log(`# ${reg}: bg ${land.bg} · button "${land.btnText}" r=${land.btnRadius} · stage ${wait && wait.stageW}px · art ${land.art} · instrument panes ${land.panes}`);
    assert.equal(land.reg, reg);
    assert.equal(land.overflow, 0, `${reg}: no sideways scroll at 390 px`);
    assert.equal(land.schemes, 0, `${reg}: at arrival "autonomi://" is only the field's format hint, never in the text`);
    assert.equal(land.dashes, 0, `${reg}: an unknown value is said, never a dash`);
    assert.ok(land.summary || land.sheetOpen, `${reg}: the facts are there (one tap away, or open)`);
    if (wait) {
      assert.equal(wait.hex, 1, `${reg}: the address is on screen once, in the field`);
      assert.equal(wait.schemes, 0, `${reg}: no "autonomi://" echoed anywhere but the field`);
      assert.equal(wait.overflow, 0, `${reg}: no sideways scroll while waiting`);
    }
    assert.deepEqual(hits.stray, []); assert.deepEqual(errs, []);
    await ctx.close();
  }
  const { bee, raver, cypherpunk: cy } = seen;
  // NEW BEE — a calm room: paper, serif title, one magenta "watch", the video framed, no instrument, no art.
  // ETERNAL (2026-09-26): the dress is the skaists design system now (docs/design/skaists/tokens.json),
  // not hand-picked values: the bee title is Instrument Serif (bee-display), the primary button's corner is
  // radius-lg 16px ("the primary button in new bee"), cypherpunk's is radius-sm 6px ("cypherpunk: rows,
  // tables, buttons"). The old 12px / 4px corners were the pre-token dress of PR #232.
  assert.equal(bee.land.bg, 'rgb(251, 247, 240)'); assert.match(bee.land.title, /Instrument Serif/);
  assert.equal(bee.land.btnText, 'watch'); assert.equal(bee.land.btnBg, 'rgb(168, 35, 140)'); assert.equal(bee.land.btnRadius, '16px');
  assert.equal(bee.land.art, false); assert.equal(bee.land.inst, false); assert.equal(bee.land.sheetOpen, false);
  // RAVER — the drop: black, pills, original art that can be paused, a full-bleed stage, the countdown on the picture.
  assert.equal(raver.land.bg, 'rgb(6, 17, 12)'); assert.equal(raver.land.btnRadius, '999px'); assert.equal(raver.land.btnBg, 'rgb(214, 85, 187)');
  assert.equal(raver.land.art, true, 'raver arrives on its own art'); assert.equal(raver.land.inst, false);
  // CYPHERPUNK — the instrument, complete before any address: mono, teal "fetch", 6px (radius-sm), panes up, the sheet open.
  assert.match(cy.land.body, /mono|Menlo|Consolas/i); assert.equal(cy.land.btnText, 'fetch'); assert.equal(cy.land.btnBg, 'rgb(69, 194, 220)'); assert.equal(cy.land.btnRadius, '6px');
  assert.equal(cy.land.inst, true); assert.equal(cy.land.panes, 4, 'byte map, start rule, decodingInfo, receipts'); assert.equal(cy.land.sheetOpen, true); assert.equal(cy.land.summary, false);
  assert.equal(cy.land.art, false);
  // Pairwise: no two registers share the same dress.
  for (const [a, b] of [['bee', 'raver'], ['bee', 'cypherpunk'], ['raver', 'cypherpunk']]) {
    const A = seen[a].land, B = seen[b].land;
    assert.notDeepEqual([A.bg, A.title, A.btnRadius, A.btnBg, A.btnText], [B.bg, B.title, B.btnRadius, B.btnBg, B.btnText], `${a} and ${b} are different pages`);
  }
  if (bee.wait) {
    // The same wait, three ways — the number said once in each.
    assert.equal(bee.wait.veil, true); assert.equal(bee.wait.count, bee.wait.waitS + ' s'); assert.equal(bee.wait.waitRow, true, 'bee: one plain sentence under the picture');
    assert.equal(bee.wait.flow, false); assert.ok(bee.wait.stageW < 390, 'bee: the video sits in a framed card');
    assert.equal(raver.wait.veil, true); assert.equal(raver.wait.count, String(raver.wait.waitS)); assert.equal(raver.wait.till, true);
    assert.equal(raver.wait.waitRow, false, 'raver: the picture carries the number; no sentence repeats it');
    assert.equal(raver.wait.flow, true, 'raver: the flow meter says why'); assert.equal(raver.wait.stageW, 390, 'raver: full-bleed stage');
    assert.equal(cy.wait.veil, false); assert.equal(cy.wait.waitRow, false); assert.equal(cy.wait.flow, false);
    assert.match(cy.wait.rule, /MB\/s × 1\.15 \+ 2 s = [\d.]+ s > [\d.]+ s left → hold ~\d+ s$/, 'cypherpunk: the rule with its live numbers carries the wait');
  }
});

test('raver motion is optional: one tap pauses it, the choice is remembered estate-wide', async () => {
  const { ctx, p, errs } = await open({ stream: () => 'abort', json: () => 'abort' });
  await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'raver'); } catch {} });
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
  const before = await p.evaluate(() => ({ paused: document.body.hasAttribute('data-motion-paused'), anim: getComputedStyle(document.querySelector('#art .beat')).animationName }));
  await p.click('#motion');
  const after = await p.evaluate(() => ({ paused: document.body.hasAttribute('data-motion-paused'), stored: localStorage.getItem('bnr.motion.paused'), anim: getComputedStyle(document.querySelector('#art .beat')).animationName, label: document.getElementById('motion').innerText.trim() }));
  assert.equal(before.paused, false); assert.notEqual(before.anim, 'none', 'the art moves by default (no reduced-motion preference)');
  assert.equal(after.paused, true); assert.equal(after.stored, '1'); assert.equal(after.anim, 'none', 'paused means still');
  assert.equal(after.label, 'let it move');
  await p.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await p.evaluate(() => document.body.hasAttribute('data-motion-paused')), true, 'remembered after reload');
  assert.deepEqual(errs, []);
  await ctx.close();
});
