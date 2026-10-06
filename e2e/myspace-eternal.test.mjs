// myspace-eternal.test.mjs — MY SPACE in the founder's chosen UI (order 2026-10-04: "NOW seems like a
// good time to bring my chosen UI back in", nine screens at 390 px). One DOM, three registers: new bee
// (cream paper, forest-green primary), raver (violet night, magenta primary), cypherpunk (mono, cyan
// primary, cut corners). Proves at 390x844, in every register and in all three views a visitor meets
// (empty, one file, the delete sheet): each register wears its own ground, words and primary; there is
// never more than one filled primary on screen; nothing scrolls sideways; every press target is at
// least 44 px; text holds 4.5:1 on its ground; no text is re-cased; the cards are exactly the purposes
// the attached rails answer, in the page's own order; and the words do not claim what the code does
// not do. Behaviour (rails, storage, delete, sweep, ANT) is judged by e2e/myspace-seam.mjs.
// Run: node --test e2e/myspace-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8955, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const REGS = ['bee', 'raver', 'cypherpunk'];
// each register's own dress, read off the screens: ground, the big line, the one primary's fill
const WANT = {
  bee: { bg: 'rgb(251, 247, 240)', title: 'Your files live on this phone.', primary: 'rgb(38, 77, 54)', face: /system-ui|Segoe UI|ui-sans-serif/ },
  raver: { bg: 'rgb(18, 14, 30)', title: 'Drop it. Keep it. Or let it fly.', primary: 'rgb(214, 85, 187)', face: /system-ui|Segoe UI|ui-sans-serif/ },
  cypherpunk: { bg: 'rgb(6, 17, 12)', title: 'local rows · sha256 · AES-GCM', primary: 'rgb(69, 194, 220)', face: /monospace/ },
};

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { if (r.request().url().startsWith(ORIGIN)) return r.continue(); outside.push(r.request().url()); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/myspace.html`, { waitUntil: 'load' });
  await p.waitForFunction(r => document.body.dataset.reg === r && window.__myspace && document.querySelectorAll('#modes .mode').length >= 2, reg, { timeout: 20000 });
  await p.waitForTimeout(400);
  return { ctx, p, errs, outside };
}

// one probe for every view: what a visitor can see, measured the way the estate's meters measure it
function probe() {
  const rgb = s => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
  const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ground = el => { for (let e = el; e; e = e.parentElement) { const b = rgb(getComputedStyle(e).backgroundColor); if (b && b[3] > .5) return b; } return rgb(getComputedStyle(document.body).backgroundColor); };
  const seen = e => e.checkVisibility() && e.getBoundingClientRect().width > 0;
  const roots = [document.getElementById('eternal'), ...document.querySelectorAll('.sheet')].filter(seen);
  const els = roots.flatMap(r => [r, ...r.querySelectorAll('*')]).filter(seen);
  const out = { primaries: 0, small: [], faint: [], caps: [], junk: [], text: '' };
  for (const e of els) {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (e.matches('.primary')) out.primaries++;
    if (/^(BUTTON|A)$/.test(e.tagName) && (r.height < 43.5 || r.width < 43.5)) out.small.push(e.textContent.trim().slice(0, 24) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!own) continue;
    if (cs.textTransform !== 'none') out.caps.push(own.slice(0, 24));
    if (/^[—–-]$/.test(own) || /\b(NaN|undefined|null)\b|\[object/.test(own)) out.junk.push(own.slice(0, 24));
    const fg = rgb(cs.color), bg = ground(e);
    if (fg && fg[3] > .5) { const a = L(fg), b = L(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (ratio < 4.49) out.faint.push(own.slice(0, 24) + ' ' + ratio.toFixed(2)); }
  }
  out.text = roots.map(r => r.innerText).join('\n');
  out.wide = document.documentElement.scrollWidth;
  return out;
}

const law = (reg, view, m) => {
  assert.ok(m.primaries <= 1, `${reg} ${view}: at most one filled primary on screen (saw ${m.primaries})`);
  assert.ok(m.wide <= 390, `${reg} ${view}: no sideways page at 390 px (scrollWidth ${m.wide})`);
  assert.deepEqual(m.small, [], `${reg} ${view}: every press target is at least 44 px`);
  assert.deepEqual(m.faint, [], `${reg} ${view}: text holds 4.5:1 on its ground`);
  assert.deepEqual(m.caps, [], `${reg} ${view}: no text is re-cased by text-transform`);
  assert.deepEqual(m.junk, [], `${reg} ${view}: no dash, NaN or undefined shown as a value`);
};

// words the screens used that the code does not do (the false-signal law): none may appear in any register
const UNTRUE = [/before it leaves/i, /asks? the store to drop/i, /drop the open (hash|one)/i, /localStorage/, /bzdid/i, /GET \/blossom/, /\/blossom\//];

test('three registers, one page: each wears its own ground, big line and one primary; the cards are the rails\' purposes', async () => {
  for (const reg of REGS) {
    const { ctx, p, errs } = await open(reg);
    const d = await p.evaluate(() => {
      const prim = [...document.querySelectorAll('#eternal .primary')].filter(e => e.checkVisibility());
      return {
        bg: getComputedStyle(document.body).backgroundColor,
        title: document.querySelector('#eternal h1').textContent,
        face: getComputedStyle(document.querySelector('#eternal h1')).fontFamily,
        primary: prim.map(e => getComputedStyle(e).backgroundColor),
        cards: [...document.querySelectorAll('#modes .mode')].map(b => b.dataset.purpose),
        pressed: [...document.querySelectorAll('#modes .mode[aria-pressed="true"]')].map(b => b.dataset.purpose),
        offered: window.__myspace.purposes(),
        empty: document.querySelector('.drop').checkVisibility(),
        count: document.getElementById('count').textContent.replace(/\s+/g, ' ').trim(),
      };
    });
    assert.equal(d.bg, WANT[reg].bg, reg + ' ground');
    assert.equal(d.title, WANT[reg].title, reg + ' big line');
    assert.match(d.face, WANT[reg].face, reg + ' heading face');
    assert.deepEqual(d.primary, [WANT[reg].primary], reg + ': exactly one filled primary, in the register\'s colour');
    assert.deepEqual(d.cards, d.offered, reg + ': one card per purpose an attached rail answers, in the page\'s order');
    assert.ok(d.cards.length >= 2, reg + ': at least two purposes offered offline');
    assert.equal(d.pressed.length, 1, reg + ': one card selected');
    assert.ok(d.empty, reg + ': the empty well is on screen');
    assert.equal(d.count, 'On this phone: 0 files', reg + ': the count reads the index');
    law(reg, 'empty', await p.evaluate(probe));
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('one file and the delete sheet, in every register: the laws hold, nothing leaves for a private file', async () => {
  for (const reg of REGS) {
    const { ctx, p, errs, outside } = await open(reg);
    await p.click('#mode-keep');
    await p.setInputFiles('#picker', { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('kept on this phone') });
    await p.waitForFunction(() => document.body.dataset.state === 'file' && document.body.dataset.busy === '0', null, { timeout: 15000 });
    const row = await p.evaluate(() => window.__myspace.rows().then(r => r.map(x => [x.name, x.purpose, x.addr && x.addr.scheme])));
    assert.deepEqual(row, [['note.txt', 'keep', 'local']], reg + ': the page wrote the row with the chosen purpose');
    const card = await p.evaluate(() => {
      const f = document.querySelector('#list .file');
      return { name: f.querySelector('.name').textContent, chip: f.querySelector('.chip').textContent, ids: [...f.querySelectorAll('button')].map(b => b.id.split('-')[0]).filter(Boolean), modes: document.getElementById('modes').checkVisibility(), drop: document.querySelector('.drop').checkVisibility() };
    });
    assert.equal(card.name, 'note.txt');
    assert.equal(card.chip, 'PRIVATE', reg + ': the chip names the purpose');
    assert.deepEqual(card.ids, ['open', 'move', 'del'], reg + ': open, move and delete on a private row (no link to copy)');
    assert.ok(card.modes && !card.drop, reg + ': the choice cards stay for the next file; the empty well goes');
    law(reg, 'one file', await p.evaluate(probe));
    await p.click('#list button[id^="del-"]');
    await p.waitForFunction(() => document.body.dataset.state === 'delete');
    const sheet = await p.evaluate(probe);
    law(reg, 'delete sheet', sheet);
    assert.equal(sheet.primaries, 1, reg + ': the delete sheet has exactly one filled answer');
    await p.click('#delConfirm');
    await p.waitForFunction(() => document.body.dataset.state === 'empty', null, { timeout: 10000 });
    assert.equal((await p.evaluate(() => window.__myspace.rows())).length, 0, reg + ': delete removed the row');
    assert.deepEqual(outside, [], reg + ': a private file and its delete send nothing anywhere');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the move sheet keeps one filled answer: the tapped destination fills, the others stay outlines', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#mode-keep');
  await p.setInputFiles('#picker', { name: 'move-me.txt', mimeType: 'text/plain', buffer: Buffer.from('m') });
  await p.waitForFunction(() => document.body.dataset.state === 'file' && document.body.dataset.busy === '0', null, { timeout: 15000 });
  await p.click('#list button[id^="move-"]');
  await p.waitForFunction(() => document.body.dataset.state === 'flip');
  const dests = await p.evaluate(() => [...document.querySelectorAll('[data-move-to]')].map(b => b.dataset.moveTo));
  assert.ok(dests.length >= 1);
  assert.equal((await p.evaluate(probe)).primaries, 0, 'nothing is filled before a destination is chosen');
  for (const d of dests) {
    await p.click(`[data-move-to="${d}"]`);
    const m = await p.evaluate(probe);
    law('bee', 'move sheet -> ' + d, m);
    assert.equal(m.primaries, 1, 'one filled answer after choosing ' + d);
    assert.equal(await p.getAttribute(`[data-move-to="${d}"]`, 'class'), 'primary', d + ' is the filled one');
  }
  await p.click('#flipKeep');
  await p.waitForFunction(() => document.body.dataset.state === 'file');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the words stay true to the code in every register and view', async () => {
  for (const reg of REGS) {
    const { ctx, p } = await open(reg);
    let text = (await p.evaluate(probe)).text;
    await p.click('#mode-keep');
    await p.setInputFiles('#picker', { name: 'w.txt', mimeType: 'text/plain', buffer: Buffer.from('w') });
    await p.waitForFunction(() => document.body.dataset.state === 'file' && document.body.dataset.busy === '0', null, { timeout: 15000 });
    text += '\n' + (await p.evaluate(probe)).text;
    await p.click('#list button[id^="del-"]');
    await p.waitForFunction(() => document.body.dataset.state === 'delete');
    text += '\n' + (await p.evaluate(probe)).text;
    const bad = UNTRUE.filter(re => re.test(text)).map(String);
    assert.deepEqual(bad, [], reg + ': a sentence claims what the code does not do');
    const cards = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modes .mode')].map(b => [b.dataset.purpose, b.textContent])));
    if (cards.forever) assert.match(cards.forever, /cannot take the payment yet|pay arm not wired/, reg + ': the forever card says this page cannot pay yet');
    if (cards.share) assert.match(cards.share, /nobody can delete it|deletable: no/i, reg + ': the public card says it cannot be taken back');
    await ctx.close();
  }
});
