// bqueenbee-live-eternal.test.mjs — the hive's machine referee as three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal; ETERNAL wave 3). Proves at 390 px: exactly one
// front per register, each in its own dress, structure and gesture; all three carry the SAME facts,
// read from her own knowledge (window.__queen) and her own #chat; THE LIVE-REFEREE RULING: nothing is
// asked or sent on arrival (no "you" message, no lane taken, no request off the origin, no POST), and
// every ask is a person's gesture that runs the page's own ask(); the fronts mirror what #chat says,
// never more. Inside the agent dock the fronts stand aside. Run: node --test e2e/bqueenbee-live-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9251, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [], requests = [];
  await ctx.route('**/*', r => { const q = r.request(), u = q.url(); if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); } requests.push(q.method() + ' ' + u.slice(ORIGIN.length)); return r.continue(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/bqueenbee-live.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.quick.length && window.__queen.roster() !== null, null, { timeout: 15000 });
  await p.waitForTimeout(400);
  return { ctx, p, errs, outside, requests };
}

test('each register: its own front, dress and structure; the same facts; nothing asked or sent on arrival; the laws', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', actSel: '.et-b-primary', titleSel: '.et-b-h' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', actSel: '.et-r-pill', titleSel: '.et-r-h' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', actSel: '.et-c-primary', titleSel: '.et-c-path' },
  };
  const facts = {};
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside, requests } = await open(reg);
    const d = await p.evaluate(w => {
      const txt = s => (s || '').replace(/\s+/g, ' ').trim();
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const fr = document.querySelector('#eternal>' + w.front), D = window.__eternal.data, Q = window.__queen, bad = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) bad.push('value ' + own);
        const r = el.getBoundingClientRect(); if (r.right > 390.5) bad.push('edge ' + el.tagName + ' ' + Math.round(r.right));
        if ((/^(BUTTON|A|LABEL|INPUT)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 43.5 || r.width < 43.5)) bad.push('small ' + el.tagName + ' ' + txt(el.textContent).slice(0, 20));
      }
      return {
        shown, bad, bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.titleSel)).fontFamily, action: getComputedStyle(fr.querySelector(w.actSel)).backgroundColor,
        wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: fr.querySelectorAll('.et-b-rows .et-b-row').length, cells: fr.querySelectorAll('svg.et-r-art [data-et-cell]').length, pipe: fr.querySelectorAll('ol.et-c-pipe li').length,
        model: { tongues: D.tongues, quick: D.quick, topics: D.topics, kbx: D.kbx, keywords: D.keywords, drops: D.drops, roster: D.roster, walls: D.walls },
        page: { tongues: Q.tongues.length, quick: Q.quick, topics: Q.kb.length, kbx: Q.kbx.length, drops: document.querySelectorAll('#droplist .rc').length, roster: Q.roster() && Q.roster().people.length, quickButtons: [...document.querySelectorAll('#quick button')].map(b => b.textContent) },
        arrival: { you: document.querySelectorAll('#chat .msg.you').length, her: document.querySelectorAll('#chat .msg.bee').length, lane: Q.last.lane, n: Q.last.n, last: D.last },
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.querySelector('span').textContent), beeMore: txt(document.querySelector('#etBeeRows .et-b-more').textContent),
        cellLabels: [...document.querySelectorAll('#etArt [data-et-cell]')].map(g => g.getAttribute('aria-label')), dots: document.querySelectorAll('#etArt circle.tg').length, hint: document.querySelector('#etRaverHint').textContent,
        lanes: [...document.querySelectorAll('#etPipe li b')].map(b => b.textContent), receipt: txt(document.querySelector('#etReceipt').textContent), cyQuick: document.querySelectorAll('#etCyQuick tr').length, cyWalls: document.querySelectorAll('#etWalls tr').length,
      };
    }, w);
    assert.deepEqual(d.shown, [w.front], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows > 0, reg === 'bee', 'bee is a card of rows'); assert.equal(d.cells > 0, reg === 'raver', 'raver is the comb'); assert.equal(d.pipe > 0, reg === 'cypherpunk', 'cypherpunk is the instrument');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ': the laws on the front');
    // THE RULING: nothing asked, nothing sent on arrival
    assert.deepEqual([d.arrival.you, d.arrival.her, d.arrival.n, d.arrival.lane, d.arrival.last], [0, 1, 0, '', null], reg + ': only her greeting; no question was put on arrival');
    assert.deepEqual(outside, [], reg + ': no request left the origin');
    assert.deepEqual(requests.filter(r => !r.startsWith('GET ')), [], reg + ': nothing was sent (no POST)');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.model.quick, a.page.quick); assert.deepEqual(a.model.quick, a.page.quickButtons, 'the quick questions are the page\'s own buttons');
  assert.deepEqual([a.model.tongues, a.model.topics, a.model.kbx, a.model.drops], [a.page.tongues, a.page.topics, a.page.kbx, a.page.drops]);
  assert.equal(a.model.tongues, 26); assert.equal(a.model.drops, 10); assert.equal(a.model.roster, a.page.roster + ' people');
  assert.equal(a.model.walls.length, 7); assert.equal(a.model.walls[0], 'machine agent, never a person, never pretending');
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].model, a.model, reg + ' reads the same facts');
  assert.deepEqual(a.beeRows, [0, 16, 15, 9, 5].map(i => a.model.quick[i]));
  assert.equal(a.beeMore, `and ${a.model.quick.length - 5} more questions in the conversation below. she hears ${a.model.tongues} languages.`);
  const r = facts.raver; assert.deepEqual(r.cellLabels, a.model.quick, 'one cell per quick question, named by the question'); assert.equal(r.dots, a.model.tongues, 'one rim dot per tongue');
  assert.equal(r.hint, `0 of ${a.model.quick.length} asked · tap a cell`);
  const c = facts.cypherpunk; assert.equal(c.lanes.length, 5);
  assert.deepEqual(c.lanes, [`heart lane · ${a.model.tongues} tongues`, `roster · eco-roster.json · ${a.model.roster}`, `kb · ${a.model.topics} topics`, `kbx · ${a.model.kbx} topics · ${a.model.keywords} keywords`, 'absence · named']);
  assert.match(c.receipt, /^qnone asked yet · nothing sent on arrival/); assert.equal(c.cyQuick, a.model.quick.length); assert.equal(c.cyWalls, 7);
});

test('bee: a row asks through the page\'s own ask(); the card mirrors her answer; the reader stays put', async () => {
  const { ctx, p, errs, requests } = await open('bee');
  const y0 = await p.evaluate(() => scrollY), req0 = requests.length;
  await p.click('#etBeeRows .et-b-row >> nth=0'); await p.waitForTimeout(700);
  const d = await p.evaluate(() => ({ you: [...document.querySelectorAll('#chat .msg.you')].map(m => m.lastChild.textContent), lane: window.__queen.last.lane, card: document.querySelector('#etBeeAns .a').textContent, links: [...document.querySelectorAll('#etBeeAns a')].map(a => [a.href, a.target]), herLinks: [...document.querySelectorAll('#chat .msg.bee:last-child a.po-bee')].map(a => a.href), y: scrollY }));
  assert.deepEqual(d.you, ['Who are you?'], 'the page\'s own chat holds the question');
  assert.equal(d.lane, 'kb'); assert.match(d.card, /^I am bQueenBee/); assert.match(d.card, /Never a person, never pretending/);
  assert.deepEqual(d.links.map(l => l[0]), d.herLinks, 'the card links are her receipt links'); assert.ok(d.links.every(l => l[1] === '_blank'), 'external receipts open a new tab');
  assert.ok(Math.abs(d.y - y0) < 40, 'the page did not pull the reader away from the front (' + y0 + ' → ' + d.y + ')');
  assert.deepEqual(requests.slice(req0), [], 'an english answer costs zero requests');
  await p.fill('#etBeeQ', 'what is the meaning of life'); await p.click('#etBeeAsk'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.__queen.last.lane), 'absence');
  assert.match(await p.textContent('#etBeeAns .none'), /doesn't know this one by name, and she won't guess/);
  assert.match(await p.textContent('#chat'), /won't guess/, 'the absence is hers, said in the chat');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('raver: a cell is a question; the comb lights what was asked; the rim lights the tongue that spoke', async () => {
  const { ctx, p, errs } = await open('raver');
  const i = await p.evaluate(() => window.__queen.quick.indexOf('Frozen seeds?'));
  await p.click(`#etArt [data-et-cell="${i}"]`, { force: true }); await p.waitForTimeout(400);
  assert.equal(await p.$eval(`#etArt [data-et-cell="${i}"]`, g => g.getAttribute('class')), 'last', 'the answering cell lights');
  assert.match(await p.textContent('#etRaverAns .a'), /FROZEN seeds/); assert.match(await p.textContent('#etRaverAns .who'), /· kb$/);
  assert.equal(await p.$eval('#etRaverAns .et-r-chip', a => [a.target, a.rel].join(' ')), '_blank noopener noreferrer');
  await p.fill('#etRaverQ', 'labdien'); await p.click('#etRaverAsk'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.__queen.last.lane), 'heart');
  assert.equal(await p.$eval('#etArt circle.tg.lit title', t => t.textContent), 'lv', 'the latvian dot lit');
  assert.match(await p.textContent('#etRaverAns .a'), /Laipni lūgti/);
  assert.equal(await p.$eval(`#etArt [data-et-cell="${i}"]`, g => g.getAttribute('class')), 'asked');
  assert.match(await p.textContent('#etRaverHint'), /^1 of \d+ asked/);
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('cypherpunk: the lane ask() took is marked; the receipt is the chat\'s own; the dock keeps the fronts out', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const i = await p.evaluate(() => window.__queen.quick.indexOf('What did you measure on Base?'));
  await p.click(`#etCyQuick tr[data-et-ask="${i}"]`); await p.waitForTimeout(400);
  const d = await p.evaluate(() => ({ now: document.querySelector('#etPipe li.now b').textContent, receipt: document.querySelector('#etReceipt').textContent.replace(/\s+/g, ' '), herLinks: [...document.querySelectorAll('#chat .msg.bee:last-child a.po-bee')].map(a => a.href), raw: document.querySelector('#etCyAns').textContent }));
  assert.match(d.now, /^kb · \d+ topics ← took this lane$/);
  assert.match(d.receipt, /^qWhat did you measure on Base\?lanekb/); assert.match(d.raw, /25331/);
  for (const h of d.herLinks) assert.ok(d.receipt.includes(h), 'receipt lists ' + h);
  assert.match(d.receipt, /chatyou 1 · her 2network/);
  await p.evaluate(() => document.documentElement.classList.add('ad-embedded'));
  assert.deepEqual(await p.evaluate(() => [getComputedStyle(document.getElementById('eternal')).display, getComputedStyle(document.getElementById('etArchive')).display]), ['none', 'none'], 'inside the dock the conversation stands alone');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});
