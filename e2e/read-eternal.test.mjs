// read-eternal.test.mjs — the Buzz reader's three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress; all
// three carry the SAME facts (the one address grammar and feed exported by the reader, and the
// reader's own state); and no gesture fetches or claims a result on its own: every "read" hands the
// address to the page's form (#f), and "found" is drawn only when the page rendered the message.
// Run: node --test e2e/read-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8974, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const CH = '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f';
const ID = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'.repeat(2), RE = 'b'.repeat(64);
const ADDR = `buzz://message?channel=${CH}&id=${ID}`;
// a fixture feed, served ONLY where a test asks for it; everywhere else the outside network is refused
const FEED = { channel: { name: 'garden' }, messages: [
  { id: ID, pubkey: 'c'.repeat(64), name: 'ilze', created_at: 1790000000, content: 'the bees are back', tags: [] },
  { id: RE, pubkey: 'd'.repeat(64), name: 'toms', created_at: 1790000100, content: 'so are the lindens', tags: [['e', ID]] },
] };

async function open(reg, { feed = false, lang = 'en' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([r, l]) => { try { localStorage.setItem('bregister', r); localStorage.setItem('blang', l); } catch {} }, [reg, lang]);
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN)) return r.continue();
    if (feed && u.startsWith('https://relay.skaists.dev/hive/public/' + CH))
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(FEED) });
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/read.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data && document.body.dataset.reg, null, { timeout: 20000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const INPUT = { bee: '#etBAddr', raver: '#etRAddr', cypherpunk: '#etCAddr' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const state = p => p.evaluate(() => window.__eternal.data.state);

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBGo', action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etRHold', action: 'rgb(23, 16, 40)' }, // the hold rests as a sovereign-wash disc until an address parses
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(([f, act]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [FRONT[reg], w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
  // the raver hold lights magenta once the address parses
  const { ctx, p } = await open('raver');
  await p.fill('#etRAddr', ADDR);
  assert.equal(await p.$eval('#etRHold', b => getComputedStyle(b).backgroundColor), 'rgb(214, 85, 187)');
  await ctx.close();
});

test('the same facts in all three: the grammar, the feed, the reader\'s own state', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, { feed: true });
    await p.fill(INPUT[reg], ADDR);
    const ready = await p.evaluate(() => { const D = window.__eternal.data; return { state: D.state, parsed: D.parsed, url: D.url, feed: window.BuzzRead.feed }; });
    await p.evaluate(() => window.__eternal.read());
    await p.waitForFunction(() => window.__eternal.data.state === 'found', null, { timeout: 8000 });
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        ready: null, state: D.state, messages: D.messages, replies: D.replies, channel: D.channelName,
        articles: document.querySelectorAll('#out article').length, hit: t('#hit article .txt'),
        bee: t('#etBState'), word: t('#etRWord'), say: t('#etRSay'), rec: t('#etCRec'), parse: t('#etCParse'),
        lit: { id: document.querySelectorAll('#etRSpec line[data-ring="id"][data-lit]').length, ch: document.querySelectorAll('#etRSpec line[data-ring="ch"][data-lit]').length },
      };
    });
    facts[reg].ready = ready;
    await ctx.close();
  }
  const a = facts.bee;
  assert.equal(a.ready.state, 'ready');
  assert.deepEqual(a.ready.parsed, { channel: CH, id: ID, thread: '' }, 'the one grammar, read from the reader itself');
  assert.equal(a.ready.url, a.ready.feed + CH + '.json');
  for (const reg of ['raver', 'cypherpunk']) {
    assert.deepEqual(facts[reg].ready, a.ready, reg + ' parses the same');
    for (const k of ['state', 'messages', 'replies', 'channel', 'articles', 'hit']) assert.equal(facts[reg][k], a[k], reg + ' ' + k);
  }
  // the facts are the page's own rendering: two articles, one reply, the channel's name
  assert.equal(a.articles, 2); assert.equal(a.messages, 2); assert.equal(a.replies, 1); assert.equal(a.channel, 'garden');
  assert.equal(a.hit, 'the bees are back');
  // and each register draws them in its own words
  assert.match(facts.bee.bee, /found it\.\s*2 messages, 1 replies/);
  assert.equal(facts.raver.word, 'found'); assert.match(facts.raver.say, /2 messages · 1 replies/);
  assert.deepEqual(facts.raver.lit, { id: 64, ch: 32 }, 'one bar per hex digit of the id and the channel');
  assert.match(facts.cypherpunk.rec, /statefound/); assert.match(facts.cypherpunk.rec, /channelgarden/); assert.match(facts.cypherpunk.rec, /messages2/); assert.match(facts.cypherpunk.rec, /replies1/);
  assert.match(facts.cypherpunk.parse, new RegExp(CH));
});

test('bee: the action hands the address to the reader\'s form; it never claims a message', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.fill('#etBAddr', ADDR);
  await p.click('#etBGo');
  await p.waitForFunction(() => ['offline', 'private'].includes(window.__eternal.data.state), null, { timeout: 8000 });
  assert.equal(await p.inputValue('#addr'), ADDR, 'the real form carries the address');
  assert.equal(decodeURIComponent(await p.evaluate(() => location.hash.slice(1))), ADDR, 'the reader\'s own submit ran');
  assert.equal(await state(p), 'offline', 'no network here: the page says offline, and so does the front');
  assert.equal(await p.$eval('#s-offline', e => e.hidden), false);
  assert.match(await p.textContent('#etBState'), /the feed is not answering/);
  assert.doesNotMatch(await p.textContent('#etBState'), /found/);
  // an address the grammar refuses: the page shows its own "not public, or not right", and so does the front
  await p.fill('#etBAddr', 'buzz://message?channel=nope');
  assert.equal(await state(p), 'invalid');
  await p.click('#etBGo');
  assert.equal(await state(p), 'private');
  assert.equal(await p.$eval('#s-private', e => e.hidden), false);
  assert.equal(await p.$eval('#etBState', e => e.dataset.tone), 'guard', 'the refusal is guard lilac, never red');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: the address lights the rings; only a full hold reads', async () => {
  const { ctx, p, errs } = await open('raver');
  assert.equal(await p.$eval('#etRHold', b => b.disabled), true, 'no hold before an address parses');
  await p.fill('#etRAddr', `buzz://message?channel=${CH}&id=${ID.slice(0, 20)}`);
  assert.equal(await p.$$eval('#etRSpec line[data-ring="id"][data-lit]', l => l.length), 20, 'the id lights as it is pasted');
  assert.equal(await state(p), 'invalid');
  await p.fill('#etRAddr', ADDR);
  assert.equal(await p.$eval('#etRHold', b => b.disabled), false);
  await p.locator('#etRHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etRHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(350); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await state(p), 'ready', 'a short hold does not read');
  assert.equal(await p.inputValue('#addr'), '');
  await p.mouse.down(); await p.waitForTimeout(1200); await p.mouse.up();
  await p.waitForFunction(() => ['offline', 'reading'].includes(window.__eternal.data.state), null, { timeout: 8000 });
  assert.equal(await p.inputValue('#addr'), ADDR, 'the full hold hands the address to the form');
  await p.waitForFunction(() => window.__eternal.data.state === 'offline', null, { timeout: 8000 });
  assert.equal(await p.textContent('#etRWord'), 'offline');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and verifiable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    parse: document.querySelectorAll('#etCParse tr').length, steps: document.querySelectorAll('#etCPipe li').length,
    rec: document.querySelectorAll('#etCRec tr').length, curl: document.querySelector('#etCCurl').textContent,
    fork: (() => { const a = [...document.querySelectorAll('.et-c a')].find(x => /fork/.test(x.textContent)); return a && [a.target, a.rel, a.href, a.textContent]; })(),
  }));
  assert.equal(d.parse, 5); assert.equal(d.steps, 6); assert.equal(d.rec, 6);
  assert.match(d.curl, /^curl -s https:\/\/relay\.skaists\.dev\/hive\/public\//);
  assert.deepEqual(d.fork.slice(0, 2), ['_blank', 'noopener noreferrer']);
  assert.match(d.fork[2], /github\.com\/beehive-nature\/beehive-nature\/blob\/main\/surfaces\/read\.html$/);
  assert.match(d.fork[3], /opens in a new tab/, 'the reader is told a tab will open');
  await p.fill('#etCAddr', ADDR);
  assert.match(await p.textContent('#etCPipe li.now'), /GET relay\.skaists\.dev/, 'the pipeline points at the one request');
  assert.match(await p.textContent('#etCCurl'), new RegExp(CH + '\\.json$'));
  await p.click('#etCGo');
  await p.waitForFunction(() => window.__eternal.data.state === 'offline', null, { timeout: 8000 });
  assert.match(await p.textContent('#etCRec'), /stateoffline/);
  assert.match(await p.textContent('#etCRec'), /messagesnot read yet/, 'an unread count says so, never 0 and never a dash');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front, left to right and right to left', async () => {
  for (const [reg, lang] of [['bee', 'en'], ['raver', 'en'], ['cypherpunk', 'en'], ['bee', 'ar'], ['raver', 'he']]) {
    const { ctx, p } = await open(reg, { lang });
    if (lang !== 'en') await p.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 8000 });
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined)\b/.test(own)) out.push('bad value ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT|LABEL)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      if (document.documentElement.scrollWidth > innerWidth) out.push('sideways ' + document.documentElement.scrollWidth);
      return out;
    });
    assert.deepEqual(bad, [], reg + ' ' + lang);
    await ctx.close();
  }
});
