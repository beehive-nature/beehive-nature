// wallet-registers.mjs — THE THREE GRAMMARS gate (founder 2026-09-26).
//
// The founder, on the #232 wallet: "made all three same exact UX with just
// changes in the color of the button. terrible." The gate that shipped with
// #232 measured colour, font family and corner radius, then printed "three
// totally different UX/UIs". That line was a false signal (k001 class) and is
// deleted. This gate measures what a person DOES in each register: what
// arrives on the first screen, how they move, what is open, how big the
// reading text is. It proves the facts never differ between registers, which
// is the DESIGN-CONSTRAINTS §5 negative control. The dress checks stay: they
// belong to the golden-dress contract and are still true.
//
// Matrix: docs/dispatches/2026-09-26-wallet-three-grammars.md
//
// The golden dress contract (#235) runs first, through its shared instrument
// e2e/register-contract.mjs: token fidelity to register.js, the dress vector,
// motion, persistence, casing. The dress is the contract's; the grammar is
// this surface's own contribution, measured after it.
//
//   node e2e/wallet-registers.mjs
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';
import { assertRegisterContract } from './register-contract.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', 'surfaces');
const SHOTS = join(here, 'shots-wallet-registers');
await mkdir(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const p = (url === '/' ? '/wallet.html' : url.indexOf('/surfaces/') === 0 ? url.slice('/surfaces'.length) : url);
  try {
    const body = await readFile(join(SURFACES, ...p.split('/').filter(Boolean)));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
// localhost, not the bare IP: the wallet's origin guard (rightly) bannered an
// IP origin, and the receipts should show the page a person gets
const origin = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
const pageErrors = [];
const REGS = ['bee', 'raver', 'cypherpunk'];
// identical data for every register: the network is cut (no live chain can
// answer one register and not another), then two FIXTURE balances are written
// into the section's own nodes, exactly where a chain read would land them
const FIXTURE = { 'v-bal': '12.3456 A', 'h-bal': '7.000 HIVE' };

async function open(reg, { width = 390, height = 844, path = '/wallet.html', fixture = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  // seed the register ONCE per tab: a reload must show the reader's own later choice
  await ctx.addInitScript(r => { try { if (!sessionStorage.getItem('gate.seeded')) { localStorage.setItem('bregister', r); sessionStorage.setItem('gate.seeded', '1'); } } catch (e) {} }, reg);
  await ctx.route(url => !url.href.startsWith(origin), r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(reg + ': ' + String(e)));
  await page.goto(origin + path, { waitUntil: 'load' });
  await page.waitForSelector('#breg-cypherpunk', { timeout: 10000 });
  await page.waitForTimeout(500);
  if (fixture) await page.evaluate(f => { for (const [id, v] of Object.entries(f)) document.getElementById(id).textContent = v; }, FIXTURE);
  await page.waitForTimeout(150);
  return { ctx, page };
}

// what arrives, measured the same way in every register
const arrival = page => page.evaluate(() => {
  const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const secs = [...document.querySelectorAll('main>section[data-wl-task]')];
  const inFirst = el => { const r = el.getBoundingClientRect(); return shown(el) && r.top < innerHeight && r.bottom > 0; };
  const ctrls = [...document.querySelectorAll('main button, main a[href], main input, main select, main textarea, main summary')];
  const notes = [...document.querySelectorAll('details[data-reg-disclose]')];
  return {
    reg: document.body.dataset.reg,
    view: document.body.dataset.wlView,
    visibleSections: secs.filter(shown).length,
    firstScreenControls: ctrls.filter(inFirst).length,
    notesOpen: notes.filter(d => d.open).length, notes: notes.length,
    own: { bee: shown(document.getElementById('wl-bee')), raver: shown(document.getElementById('wl-rave')) && shown(document.getElementById('wl-dock')), cypherpunk: shown(document.getElementById('wl-cy')) },
    mainWidth: Math.round(document.querySelector('main').getBoundingClientRect().width),
  };
});

// 1–2 · THE GOLDEN DRESS CONTRACT, by the shared instrument (toggle, token
// fidelity to register.js, dress vector, motion, voice, persistence, casing,
// unread-state receipts), then the wallet's own dress rulings
{
  const { ctx, page } = await open('bee', { fixture: false });
  const seen = await assertRegisterContract(page, {
    ok, pageErrors, shotsDir: SHOTS, stem: 'wallet-390',
    voiceProbe: async p => {
      // bee and raver lead with DIFFERENT prose (each visible in its own
      // register) while h1, the fact line, stays byte-identical
      await p.click('#breg-bee'); await p.waitForTimeout(300);
      const bee = await p.evaluate(() => { const el = document.querySelector('p[data-reg="bee"]'); return { vis: el.getBoundingClientRect().height > 0, text: el.textContent.trim(), h1: document.querySelector('h1').textContent }; });
      await p.click('#breg-raver'); await p.waitForTimeout(300);
      const raver = await p.evaluate(() => { const el = document.querySelector('p[data-reg="raver"]'); return { vis: el.getBoundingClientRect().height > 0, text: el.textContent.trim(), h1: document.querySelector('h1').textContent }; });
      return { beeText: bee.vis ? bee.text : '', raverText: raver.vis ? raver.text : '', beeFact: bee.h1, raverFact: raver.h1 };
    },
  });
  ok('bee reads in SERIF titles over SANS body', /Georgia/.test(seen.bee.h1Font) && /system-ui/.test(seen.bee.bodyFont), seen.bee.h1Font.split(',')[0]);
  ok('bee corners are SOFT (20px cards, 12px controls)', seen.bee.cardRadius === '20px' && seen.bee.btnRadius === '12px', seen.bee.cardRadius);
  ok('bee action is the ONE magenta (rgb(168, 35, 140))', seen.bee.btnColor === 'rgb(168, 35, 140)', seen.bee.btnColor);
  ok('raver shouts in a heavy display title', parseInt(seen.raver.h1Weight, 10) >= 700, 'weight ' + seen.raver.h1Weight);
  ok('raver controls are PILLS (999px)', seen.raver.btnRadius === '999px', seen.raver.btnRadius);
  ok('raver carries glow-sovereign (the ONE glow) and the purples-as-light wash', seen.raver.glow !== 'none' && /gradient/.test(seen.raver.bgImage), (seen.raver.glow || '').slice(0, 60));
  ok('raver action is you magenta (rgb(214, 85, 187))', seen.raver.btnColor === 'rgb(214, 85, 187)', seen.raver.btnColor);
  ok('cypherpunk is MONO top to bottom', /mono/i.test(seen.cypherpunk.bodyFont) && /mono/i.test(seen.cypherpunk.h1Font), seen.cypherpunk.bodyFont.split(',')[0]);
  ok('cypherpunk corners are CUT (4px cards, 4px controls)', seen.cypherpunk.cardRadius === '4px' && seen.cypherpunk.btnRadius === '4px', seen.cypherpunk.cardRadius);
  ok('cypherpunk action is ai teal (rgb(69, 194, 220))', seen.cypherpunk.btnColor === 'rgb(69, 194, 220)', seen.cypherpunk.btnColor);
  await ctx.close();
}

// 3 · the grammar: what ARRIVES differs, register by register (390px phone)
const arr = {};
for (const reg of REGS) {
  const { ctx, page } = await open(reg);
  arr[reg] = await arrival(page);
  await page.screenshot({ path: join(SHOTS, `wallet-390-${reg}-read.png`) });
  await ctx.close();
}
ok('bee arrives on its home list, no section open (one question at a time)',
  arr.bee.view === 'home' && arr.bee.visibleSections === 0 && arr.bee.own.bee && !arr.bee.own.raver && !arr.bee.own.cypherpunk, JSON.stringify(arr.bee));
ok('raver arrives on the stage and the dock, no section open (image first)',
  arr.raver.visibleSections === 0 && arr.raver.own.raver && !arr.raver.own.bee && !arr.raver.own.cypherpunk, JSON.stringify(arr.raver));
ok('cypherpunk arrives on the console with the whole pipeline open (18 sections, every note)',
  arr.cypherpunk.visibleSections >= 18 && arr.cypherpunk.own.cypherpunk && !arr.cypherpunk.own.bee && !arr.cypherpunk.own.raver &&
  arr.cypherpunk.notesOpen === arr.cypherpunk.notes && arr.cypherpunk.notes >= 14, JSON.stringify(arr.cypherpunk));
ok('bee and raver keep every technical note folded (one tap away, never deleted)', arr.bee.notesOpen === 0 && arr.raver.notesOpen === 0 && arr.bee.notes === arr.cypherpunk.notes);
const vec = r => [arr[r].visibleSections, arr[r].notesOpen, Object.entries(arr[r].own).filter(([, v]) => v).map(([k]) => k).join(), arr[r].firstScreenControls].join('|');
ok('the STRUCTURE vector differs on every pair (not a recolour)', vec('bee') !== vec('raver') && vec('raver') !== vec('cypherpunk') && vec('bee') !== vec('cypherpunk'),
  `bee ${vec('bee')} · raver ${vec('raver')} · cy ${vec('cypherpunk')}`);

// 4 · new bee: a navigation stack. A row pushes one task; back pops it.
{
  const { ctx, page } = await open('bee');
  const rows = await page.evaluate(() => [...document.querySelectorAll('#wl-bee [data-wl-go]')].map(b => ({ go: b.dataset.wlGo, h: Math.round(b.getBoundingClientRect().height) })));
  ok('bee: seven home rows (six tasks and "everything"), each ≥ 60px', rows.length === 7 && rows.every(r => r.h >= 60), rows.map(r => r.go + ':' + r.h).join(' '));
  await page.click('#wl-bee [data-wl-go="move"]');
  await page.waitForTimeout(350);
  const moved = await page.evaluate(() => {
    const shown = el => !!el && el.getClientRects().length > 0;
    return {
      view: document.body.dataset.wlView,
      sections: [...document.querySelectorAll('main>section[data-wl-task]')].filter(shown).map(s => s.id),
      bar: shown(document.getElementById('wl-bar')), home: shown(document.getElementById('wl-bee')), header: shown(document.querySelector('main>header')),
      title: [...document.querySelectorAll('#wl-bar-title [data-wl-for]')].filter(shown).map(s => s.textContent).join(),
      focus: document.activeElement && document.activeElement.id,
    };
  });
  ok('bee: "pay or get paid" pushes ONLY its task (pay + outbox), under a titled back bar',
    moved.view === 'move' && moved.sections.join() === 'pay-sec,outbox-sec' && moved.bar && !moved.home && !moved.header && moved.title === 'pay or get paid', JSON.stringify(moved));
  ok('bee: focus lands on the task title (the screen reader hears where it went)', moved.focus === 'wl-bar-title', moved.focus);
  const small = await page.evaluate(() => {
    const leaves = [...document.querySelectorAll('main>section[data-wl-task] *')].filter(el => el.children.length === 0 && el.textContent.trim() && el.getClientRects().length);
    const px = el => parseFloat(getComputedStyle(el).fontSize);
    return { n: leaves.length, under14: leaves.filter(el => px(el) < 14).map(el => el.tagName + '.' + el.className + ':' + px(el)).slice(0, 5), law: px(document.querySelector('#pay-sec .law')) };
  });
  ok('bee: a task reads at bee size (prose ≥ 16px, nothing visible under the 14px label floor)', small.law >= 16 && small.under14.length === 0, `law ${small.law}px · ${small.n} leaves · under14 ${small.under14.join(' ')}`);
  const filled = await page.evaluate(() => {
    const primary = getComputedStyle(document.body).getPropertyValue('--reg-primary').trim();
    const probe = document.createElement('i'); probe.style.color = primary; document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color; probe.remove();
    return [...document.querySelectorAll('main>section[data-wl-task] button')].filter(b => b.getClientRects().length && getComputedStyle(b).backgroundColor === rgb).map(b => b.id || b.textContent.trim().slice(0, 20));
  });
  ok('bee: a task opens with at most one filled action (not a wall of primaries)', filled.length <= 1, filled.join(', ') || 'none filled at rest');
  await page.screenshot({ path: join(SHOTS, 'wallet-390-bee-task.png') });
  await page.click('#wl-bar [data-wl-go="home"]');
  await page.waitForTimeout(350);
  const back = await page.evaluate(() => ({ view: document.body.dataset.wlView, focus: document.activeElement && document.activeElement.dataset.wlGo }));
  ok('bee: "‹ wallet" pops back home, focus returns to the row that opened the task', back.view === 'home' && back.focus === 'move', JSON.stringify(back));
  await page.click('#wl-bee [data-wl-go="add"]');
  await page.waitForTimeout(250);
  await page.goBack();
  await page.waitForTimeout(350);
  ok('bee: the browser\'s own back button pops the task too (the stack is real history)', await page.evaluate(() => document.body.dataset.wlView) === 'home');
  await page.click('#wl-bee [data-wl-go="all"]');
  await page.waitForTimeout(300);
  const all = await page.evaluate(() => [...document.querySelectorAll('main>section[data-wl-task]')].filter(s => s.getClientRects().length).length);
  ok('bee: "show me everything" is one row away and opens every section (theme freely, gate never)', all === arr.cypherpunk.visibleSections, `${all} vs cypherpunk ${arr.cypherpunk.visibleSections}`);
  await ctx.close();
}

// 5 · raver: a stage and a dock. A glyph swaps the deck in place; arrows and a swipe move along it.
{
  const { ctx, page } = await open('raver');
  const dock = await page.evaluate(() => [...document.querySelectorAll('#wl-dock [data-wl-go]')].map(b => ({ go: b.dataset.wlGo, word: (b.querySelector('.w') || {}).textContent || '', h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })));
  ok('raver: eight glyphs in the dock, every glyph keeps its word under it, each ≥ 44px', dock.length === 8 && dock.every(d => d.word.trim() && d.h >= 44 && d.w >= 44), dock.map(d => d.go + ':' + d.word).join(' '));
  const lit = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wlr-node')].map(n => [n.dataset.wlRail, n.dataset.lit])));
  ok('raver: a read rail is LIT on the stage, an unread one is not (the art tells the truth)', lit['v-bal'] === 'true' && lit['h-bal'] === 'true' && lit['a-bal'] === 'false', JSON.stringify(lit));
  ok('raver: the art carries no words (every word is a caption)', await page.evaluate(() => [...document.querySelectorAll('.wlr-art text')].every(t => !/[a-z]{2,}/i.test(t.textContent))));
  await page.click('#wl-dock [data-wl-go="add"]');
  await page.waitForTimeout(650);
  const deck = await page.evaluate(() => ({
    view: document.body.dataset.wlView,
    sections: [...document.querySelectorAll('main>section[data-wl-task]')].filter(s => s.getClientRects().length).map(s => s.id),
    stage: document.getElementById('wl-rave').getClientRects().length > 0,
    pressed: [...document.querySelectorAll('#wl-dock [aria-pressed="true"]')].map(b => b.dataset.wlGo),
    history: history.state && history.state.wlView,
  }));
  ok('raver: the "add" glyph swaps the deck in place (fund + fiat in + voucher; the stage steps aside)',
    deck.view === 'add' && deck.sections.join() === 'voucher-sec,fund-sec,peer-sec' && !deck.stage && deck.pressed.join() === 'add', JSON.stringify(deck));
  await page.screenshot({ path: join(SHOTS, 'wallet-390-raver-deck.png') });
  await page.focus('#wl-dock [data-wl-go="add"]');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  ok('raver: ArrowRight lights the next glyph and opens its deck', await page.evaluate(() => document.body.dataset.wlView === 'keep' && document.activeElement.dataset.wlGo === 'keep'));
  const swiped = await page.evaluate(() => {
    const el = document.querySelector('#arw-sec h2');
    const t = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(300, 300)], changedTouches: [t(300, 300)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(150, 310)] }));
    return document.body.dataset.wlView;
  });
  ok('raver: a sideways swipe moves along the dock (keep → key)', swiped === 'key', swiped);
  ok('raver: moving along the dock is lateral, never a history stack', await page.evaluate(() => history.length) <= 2);
  await ctx.close();
}

// 6 · cypherpunk: the pipeline at once. An index, keys, every note.
{
  const { ctx, page } = await open('cypherpunk', { width: 1280, height: 800 });
  const idx = await page.evaluate(() => [...document.querySelectorAll('#wl-cy-idx a')].map(a => ({ href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height) })));
  ok('cypherpunk: the index lists all 19 sections, each row a ≥ 44px press', idx.length === 19 && idx.every(i => i.h >= 44), idx.length + ' rows');
  const rail = await page.evaluate(() => { const c = document.getElementById('wl-cy'), m = document.getElementById('bal-sec'); return { pos: getComputedStyle(c).position, left: c.getBoundingClientRect().right <= m.getBoundingClientRect().left }; });
  ok('cypherpunk (desktop): the console is a sticky rail beside the pipeline', rail.pos === 'sticky' && rail.left, JSON.stringify(rail));
  const small = await page.evaluate(() => [...document.querySelectorAll('main button, main select')].filter(b => b.getClientRects().length && b.getBoundingClientRect().height < 44).map(b => (b.id || b.textContent.trim().slice(0, 16)) + ':' + Math.round(b.getBoundingClientRect().height)));
  ok('every press in the whole open pipeline is ≥ 44px (the floor holds in the densest register)', small.length === 0, small.slice(0, 5).join(' '));
  await page.screenshot({ path: join(SHOTS, 'wallet-1280-cypherpunk.png') });
  await page.keyboard.press('j');
  await page.waitForTimeout(500);
  const j1 = await page.evaluate(() => document.activeElement && document.activeElement.id);
  await page.keyboard.press('j');
  await page.waitForTimeout(500);
  const j2 = await page.evaluate(() => document.activeElement && document.activeElement.id);
  await page.keyboard.press('k');
  await page.waitForTimeout(500);
  const k1 = await page.evaluate(() => document.activeElement && document.activeElement.id);
  ok('cypherpunk: j moves to the next section, k back (focus follows)', j1 === 'connect-sec' && j2 === 'kc-sec' && k1 === 'connect-sec', `${j1} → ${j2} → ${k1}`);
  await page.click('#wl-cy-idx a[href="#fund-sec"]');
  await page.waitForTimeout(500);
  const landed = await page.evaluate(() => Math.round(document.getElementById('fund-sec').getBoundingClientRect().top));
  ok('cypherpunk: an index row lands on its section', landed >= 0 && landed < 40, 'top ' + landed + 'px');
  await page.keyboard.press('o');
  const folded = await page.evaluate(() => [...document.querySelectorAll('details[data-reg-disclose]')].every(d => !d.open));
  await page.keyboard.press('o');
  const opened = await page.evaluate(() => [...document.querySelectorAll('details[data-reg-disclose]')].every(d => d.open));
  ok('cypherpunk: o folds every note, o again opens every note', folded && opened);
  await ctx.close();
}

// 7 · FACTS INVARIANT (DESIGN-CONSTRAINTS §5 negative control): one number, four places, three registers
{
  const seen = {};
  for (const reg of REGS) {
    const { ctx, page } = await open(reg);
    seen[reg] = await page.evaluate(() => {
      const txt = sel => [...document.querySelectorAll(sel)].map(e => e.textContent.trim());
      return {
        card: document.getElementById('v-bal').textContent.trim(),
        bee: txt('#wl-bee .wlb-fig'), raver: txt('#wl-rave [data-wl-src="v-bal"]'), cy: txt('#wl-cy [data-wl-src="v-bal"]'),
        // a value slot is a visible leaf of a register's own component; a dash standing alone there is the defect
        own: [...document.querySelectorAll('#wl-bee *,#wl-rave *,#wl-cy *')].filter(e => e.children.length === 0 && e.getClientRects().length).map(e => e.textContent.trim()),
      };
    });
    // the negative control: blank the chain read, and every register must say so in words
    seen[reg].unread = await page.evaluate(() => {
      document.getElementById('v-bal').textContent = '—';
      return new Promise(r => setTimeout(() => {
        const vis = sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => e.textContent.trim());
        r({ figs: vis('[data-wl-src="v-bal"]'), words: vis('#wl-bee .wl-un b, #wl-rave li:first-child .wl-un, #wl-cy tbody:first-of-type tr:first-child .wl-un') });
      }, 100));
    });
    await ctx.close();
  }
  const all = REGS.flatMap(r => [seen[r].card, ...seen[r].bee, ...seen[r].raver, ...seen[r].cy]);
  ok('the same balance renders IDENTICALLY in the shared card and every register\'s own component', all.length === 12 && all.every(v => v === FIXTURE['v-bal']), [...new Set(all)].join(' | '));
  ok('no register\'s own component ever shows a bare dash for a value (never 0, never a dash)', REGS.every(r => seen[r].own.length > 5 && !seen[r].own.some(t => t === '—' || t === '-')),
  REGS.map(r => r + ' ' + seen[r].own.length + ' leaves').join(' · '));
  ok('an unread balance hides every figure and is said in words, in all three registers',
    REGS.every(r => seen[r].unread.figs.length === 0 && seen[r].unread.words.length === 1 && seen[r].unread.words[0].length > 3),
    REGS.map(r => r + ':' + seen[r].unread.words.join()).join(' · '));
}

// 8 · nothing orphaned: every section is reachable from a bee row AND a raver glyph
{
  const { ctx, page } = await open('bee', { fixture: false });
  const reach = await page.evaluate(() => {
    const rows = new Set([...document.querySelectorAll('#wl-bee [data-wl-go]')].map(b => b.dataset.wlGo));
    const glyphs = new Set([...document.querySelectorAll('#wl-dock [data-wl-go]')].map(b => b.dataset.wlGo));
    const secs = [...document.querySelectorAll('main>section')];
    return { n: secs.length, orphans: secs.filter(s => !rows.has(s.dataset.wlTask) || !glyphs.has(s.dataset.wlTask)).map(s => s.id || s.querySelector('h2').textContent) };
  });
  ok('every one of the 19 sections belongs to a task a bee row and a raver glyph can open', reach.n === 19 && reach.orphans.length === 0, reach.orphans.join(', '));
  await ctx.close();
}

// 9 · work survives a register switch (same node, same value, same place).
// The toggle is at the top of the page, so a reader always scrolls up to it:
// what carries across is where they last WORKED, not where the scroll sat.
{
  const { ctx, page } = await open('cypherpunk');
  await page.click('#breg-bee');
  await page.waitForTimeout(300);
  ok('a cypherpunk reader who worked nowhere switches to bee and lands on bee home', await page.evaluate(() => document.body.dataset.wlView) === 'home');
  await page.click('#breg-cypherpunk');
  await page.waitForTimeout(300);
  await page.fill('#wq', 'gatesoul');
  await page.click('#breg-bee');
  await page.waitForTimeout(400);
  const carried = await page.evaluate(() => ({ view: document.body.dataset.wlView, shown: document.getElementById('wq').getClientRects().length > 0 }));
  ok('the field a reader last typed in carries across: bee opens on its task with the value intact',
    carried.view === 'key' && carried.shown && await page.inputValue('#wq') === 'gatesoul', JSON.stringify(carried));
  await page.click('#breg-raver');
  await page.waitForTimeout(300);
  ok('bee\'s task carries into raver (the key glyph is lit, the same field shows)', await page.evaluate(() => document.body.dataset.wlView === 'key' && document.querySelector('#wl-dock [data-wl-go="key"]').getAttribute('aria-pressed') === 'true') && await page.isVisible('#wq'));
  await page.click('#breg-cypherpunk');
  await page.waitForTimeout(500);
  const place = await page.evaluate(() => Math.round(document.getElementById('connect-sec').getBoundingClientRect().top));
  ok('and back in cypherpunk the reader is placed at that task\'s first section', place >= 0 && place < 60, 'connect top ' + place + 'px');
  await ctx.close();
}

// 10 · deep links land in the task that holds their target, in bee
{
  const a = await open('bee', { path: '/wallet.html?compose=' + encodeURIComponent('kingbeelovis:registeracc'), fixture: false });
  const c = await a.page.evaluate(() => ({ view: document.body.dataset.wlView, shown: document.getElementById('composer-sec').getClientRects().length > 0, contract: document.getElementById('tx-contract').value }));
  ok('?compose= opens bee on the composer\'s task with the contract prefilled', c.view === 'proof' && c.shown && c.contract === 'kingbeelovis', JSON.stringify(c));
  await a.ctx.close();
  const b = await open('bee', { path: '/wallet.html#fund-sec', fixture: false });
  const f = await b.page.evaluate(() => ({ view: document.body.dataset.wlView, shown: document.getElementById('fund-sec').getClientRects().length > 0 }));
  ok('#fund-sec opens bee on "add money" with fund in view', f.view === 'add' && f.shown, JSON.stringify(f));
  await b.ctx.close();
}

// 11 · persistence, casing, receipts at desktop width
{
  const { ctx, page } = await open('bee', { fixture: false });
  await page.click('#breg-raver');
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  ok('the choice travels: a revisit opens in the reader\'s own register before first paint', await page.evaluate(() => document.body.dataset.reg) === 'raver');
  await ctx.close();
}
for (const reg of REGS) {
  const { ctx, page } = await open(reg, { width: 1280, height: 800 });
  const bad = await page.evaluate(() => [...document.querySelectorAll('main, main *')].filter(el => getComputedStyle(el).textTransform !== 'none').map(el => el.tagName + '.' + el.className).slice(0, 4));
  ok(`no text-transform anywhere in ${reg} (capitals are a signal channel, never decoration)`, bad.length === 0, bad.join(','));
  if (reg !== 'cypherpunk') await page.screenshot({ path: join(SHOTS, `wallet-1280-${reg}.png`) });
  await ctx.close();
}
ok('receipts banked: arrival with read balances at 390 and 1280 for each register, a bee task, a raver deck and the cypherpunk rail', true, 'e2e/shots-wallet-registers/');

ok('no page errors across all three registers', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ').slice(0, 200));

await browser.close();
server.close();
const failed = results.filter(r => !r.pass);
console.log(failed.length
  ? `\nWALLET REGISTERS GATE: ${failed.length} FAILED of ${results.length}`
  : `\nWALLET REGISTERS GATE: GREEN — ${results.length}/${results.length} (the golden dress contract holds; three grammars measured; the facts identical in all three)`);
process.exit(failed.length ? 1 : 0);
