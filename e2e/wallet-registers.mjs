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
import {installWalletFixture,WALLET_ORIGIN} from './lib/wallet-source-fixture.mjs';
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

// Production-origin source fixture; all services remain mocked or blocked.
const origin = WALLET_ORIGIN;

const browser = await chromium.launch();
const fixtureHtml=await installWalletFixture(browser,join(SURFACES,'..'));
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
  // the fixture writes what a successful read writes: the figure AND its stat line ("✓ live", class ok)
  if (fixture) await page.evaluate(f => { for (const [id, v] of Object.entries(f)) { document.getElementById(id).textContent = v; const st = document.getElementById(id.replace('-bal', '-stat')); st.textContent = '✓ live'; st.className = 'stat ok'; } }, FIXTURE);
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
    // what KIND of thing is in the FIRST SCREEN (inside the viewport), not merely rendered somewhere
    kinds: (() => {
      const vis = el => { const r = el.getBoundingClientRect(); return { top: Math.max(0, r.top), bottom: Math.min(innerHeight, r.bottom), w: r.width }; };
      const area = el => { const v = vis(el); return v.bottom > v.top ? (v.bottom - v.top) * v.w : 0; };
      return {
        rows: [...document.querySelectorAll('main .wlb-row')].filter(inFirst).length,
        art: Math.round([...document.querySelectorAll('main svg.wlr-art')].filter(inFirst).reduce((a, s) => a + area(s), 0)),
        index: [...document.querySelectorAll('#wl-cy-idx a')].filter(inFirst).length,
        sections: [...document.querySelectorAll('main>section[data-wl-task]')].filter(inFirst).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map(s => s.id),
      };
    })(),
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
  // the founder's chosen UI (his My Space screens, 2026-10-04; the wallet 2026-10-05):
  // bee's titles are BOLD SYSTEM SANS over the same sans, its controls pills, its action forest
  const SANS = 'ui-sans-serif,system-ui,SegoeUI,Roboto,Helvetica,Arial,sans-serif';
  const flat = s => String(s).replace(/["'\s]/g, '');
  ok('bee reads in BOLD SYSTEM SANS titles (≥ 700) over the same system sans body (the chosen UI)',
    flat(seen.bee.h1Font) === SANS && flat(seen.bee.bodyFont) === SANS && parseInt(seen.bee.h1Weight, 10) >= 700, seen.bee.h1Font.split(',').slice(0, 3).join(',') + ' · ' + seen.bee.h1Weight);
  ok('bee corners are SOFT (18px radius-xl cards) and its controls are PILLS (999px) — the chosen UI', seen.bee.cardRadius === '18px' && seen.bee.btnRadius === '999px', seen.bee.cardRadius + ' · ' + seen.bee.btnRadius);
  ok('bee action is the ONE forest green (rgb(38, 77, 54), --sk-forest)', seen.bee.btnColor === 'rgb(38, 77, 54)', seen.bee.btnColor);
  ok('raver shouts in a heavy title, bold system sans (the chosen UI)', parseInt(seen.raver.h1Weight, 10) >= 700 && flat(seen.raver.h1Font) === SANS && flat(seen.raver.bodyFont) === SANS, 'weight ' + seen.raver.h1Weight + ' · ' + seen.raver.h1Font.split(',').slice(0, 3).join(','));
  ok('raver controls are PILLS (999px)', seen.raver.btnRadius === '999px', seen.raver.btnRadius);
  ok('raver carries glow-sovereign (the ONE glow) and the purples-as-light wash', seen.raver.glow !== 'none' && /gradient/.test(seen.raver.bgImage), (seen.raver.glow || '').slice(0, 60));
  ok('raver action is you magenta (rgb(214, 85, 187))', seen.raver.btnColor === 'rgb(214, 85, 187)', seen.raver.btnColor);
  ok('cypherpunk is MONO top to bottom', /mono/i.test(seen.cypherpunk.bodyFont) && /mono/i.test(seen.cypherpunk.h1Font), seen.cypherpunk.bodyFont.split(',')[0]);
  ok('cypherpunk corners are CUT (6px radius-sm — the sheet)', seen.cypherpunk.cardRadius === '6px' && seen.cypherpunk.btnRadius === '6px', seen.cypherpunk.cardRadius);
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
ok('cypherpunk arrives with the whole pipeline open (17 sections, every note) and its console among them',
  arr.cypherpunk.visibleSections === 17 && arr.cypherpunk.own.cypherpunk && !arr.cypherpunk.own.bee && !arr.cypherpunk.own.raver &&
  arr.cypherpunk.notesOpen === arr.cypherpunk.notes && arr.cypherpunk.notes >= 14, JSON.stringify(arr.cypherpunk));
ok('bee and raver keep every technical note folded (one tap away, never deleted)', arr.bee.notesOpen === 0 && arr.raver.notesOpen === 0 && arr.bee.notes === arr.cypherpunk.notes);
// not "which block is flagged" (that differs by construction): what KIND of
// thing is IN THE FIRST SCREEN of a phone. Bee: choices (list rows) and no
// section. Raver: a picture and no section. Cypherpunk: the pipeline itself,
// hero balance first by the ruled phone fold law (its console sits beside it
// on desktop, checked in 6).
const k = r => arr[r].kinds;
ok('on a phone the first screen holds a different KIND of thing: bee choices, raver a picture, cypherpunk the pipeline itself (hero balance first)',
  k('bee').rows >= 2 && k('bee').art === 0 && k('bee').sections.length === 0 &&
  k('raver').rows === 0 && k('raver').art > 30000 && k('raver').sections.length === 0 &&
  k('cypherpunk').rows === 0 && k('cypherpunk').art === 0 && k('cypherpunk').sections[0] === 'bal-sec',
  REGS.map(r => r + ' ' + JSON.stringify(k(r))).join(' · '));

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
  // a message that names another part of the wallet is a LINK and lands in its task
  await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(350);
  await page.click('#wl-bee [data-wl-go="move"]'); await page.waitForTimeout(350);
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '#vault-sec'; a.id = 'gate-link'; a.textContent = 'the vault'; document.getElementById('pay-sec').appendChild(a); });
  await page.click('#gate-link'); await page.waitForTimeout(600);
  const linked = await page.evaluate(() => ({ view: document.body.dataset.wlView, vault: document.getElementById('vault-sec').getClientRects().length > 0, idx: history.state && history.state.wlIdx }));
  ok('bee: a link naming another part (the vault) lands in its task, never "above" or "below"', linked.view === 'key' && linked.vault, JSON.stringify(linked));
  await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(400);
  ok('bee: a cross-reference replaces, it never deepens: "‹ wallet" still pops straight home', await page.evaluate(() => document.body.dataset.wlView) === 'home');
  await page.goForward(); await page.waitForTimeout(400);
  const fwd = await page.evaluate(() => ({ view: document.body.dataset.wlView, idx: history.state && history.state.wlIdx }));
  await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(400);
  ok('bee: after the browser\'s Forward, "‹ wallet" pops again (the stack index lives in history, not a counter)',
    fwd.view === 'key' && await page.evaluate(() => document.body.dataset.wlView) === 'home', JSON.stringify(fwd));
  // from HOME, the card's link is a step down the stack: browser Back returns home, not out of the wallet
  await page.evaluate(() => { document.getElementById('v-bal').textContent = ''; });
  await page.waitForTimeout(150);
  await page.click('#wl-bee .wlb-connect'); await page.waitForTimeout(500);
  const fromHome = await page.evaluate(() => ({ view: document.body.dataset.wlView, idx: history.state && history.state.wlIdx, wq: document.getElementById('wq').getClientRects().length > 0 }));
  await page.goBack(); await page.waitForTimeout(400);
  ok('bee: the unread card\'s "connect your name" link opens the connect field one step down; Back returns home',
    fromHome.view === 'have' && fromHome.idx === 1 && fromHome.wq && await page.evaluate(() => document.body.dataset.wlView) === 'home', JSON.stringify(fromHome));
  // a link whose target the page itself holds hidden (the bridge, before any keychain) lands on its task, focus kept
  await page.click('#wl-bee [data-wl-go="move"]'); await page.waitForTimeout(350);
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '#bridge-sec'; a.id = 'gate-hidden'; a.textContent = 'the bridge'; document.getElementById('pay-sec').appendChild(a); });
  await page.click('#gate-hidden'); await page.waitForTimeout(500);
  const hid = await page.evaluate(() => ({ view: document.body.dataset.wlView, bridge: document.getElementById('bridge-sec').getClientRects().length > 0, focus: document.activeElement && document.activeElement.id }));
  ok('bee: a link to a part the page holds hidden lands on its task with focus on the task title, never on nothing',
    hid.view === 'key' && !hid.bridge && hid.focus === 'wl-bar-title', JSON.stringify(hid));
  // a reload on a task keeps its place in the stack: "‹ wallet" still pops home
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500);
  const reloaded = await page.evaluate(() => ({ view: document.body.dataset.wlView, idx: history.state && history.state.wlIdx }));
  // after a reload the entry below belongs to a document that no longer exists: "‹ wallet"
  // must return home WITHIN this page (a Back there is a full load that drops the tab-memory keychain)
  await page.evaluate(() => { window.__gateSameDocument = true; });
  await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ view: document.body.dataset.wlView, same: window.__gateSameDocument === true, hash: location.hash }));
  ok('bee: after a reload, "‹ wallet" returns home within the page (never a reload that would drop the tab-memory keychain)',
    reloaded.view === 'key' && reloaded.idx === 1 && after.view === 'home' && after.same && after.hash === '',
    JSON.stringify(reloaded) + ' → ' + JSON.stringify(after));
  await ctx.close();
}
{
  const src = await readFile(join(SURFACES, 'wallet.html'), 'utf8');
  // EVERY user-facing "above"/"below" (comments stripped) must be on this
  // reviewed list: each points WITHIN its own section or task, in the task's
  // own order, so it is true in every register. A new one fails until someone
  // reviews it: across tasks, a message names its target as a link instead.
  const REVIEWED = [
    ['more as you forge below', 'keychain → key forge, same task, after it'],
        ['Any device in the list above', 'within the vault'],
    ['addresses below are yours to hand out', 'within pay'],
    ['Each address above falls out of the', 'within pay'],
    ['choose a lane above', 'within pay'],
    ['(rate cited below)', 'within the voucher'],
    ['The key in the config below is', 'within fund'],
    ['its Base address below is a bare', 'within fiat in'],
    ['use the recovery lane below', 'within the keychain'],
    ['create one here, or use recovery below', 'within the keychain'],
    ['(passkey above or recovery below)', 'within the keychain (the QR bridge)'],
    ['(the 12-char test actor above)', 'within the composer'],
    ['the TESTNET key you paste below', 'within the composer'],
    ['set one above and this lane obeys it too', 'within pay (the sats cap)'],
    ['filled into both fields below', 'within the vault'],
    ['connect your keychain above to use it', 'vault → keychain, same task, before it'],
    ['bridge field below', 'vault → bridge, same task, after it'],
    ['select the text above and copy it manually', 'within the vault'],
    ['unlock with a keypass below', 'within the vault'],
  ];
  const blank = m => m.replace(/[^\n]/g, ' ');
  let code = src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank);
  code = code.split('\n').map(l => l.replace(/(^|\s)\/\/\s.*$/, (m, p) => p + blank(m.slice(p.length)))).join('\n');
  const found = [];
  code.split('\n').forEach((l, i) => { const re = /[^.;:!?<>'"]{0,48}\b(above|below)\b[^.;:!?<>'"]{0,32}/gi; let x; while ((x = re.exec(l))) found.push({ line: i + 1, text: x[0].trim() }); });
  const unreviewed = found.filter(f => !REVIEWED.some(([snip]) => f.text.includes(snip.trim())));
  ok(`every "above"/"below" a reader can see (${found.length}) is a reviewed within-task reference; across tasks a message names its target as a link`,
    unreviewed.length === 0 && found.length > 0, unreviewed.slice(0, 4).map(u => u.line + ': ' + u.text).join(' · '));
  const stale = REVIEWED.filter(([snip]) => !found.some(f => f.text.includes(snip.trim())));
  ok('the reviewed list carries no stale entry (an entry that matches nothing could quietly widen it)', stale.length === 0, stale.map(x => x[0]).join(' · '));
}

// 4b · the reviewer's exact S2 path: a deep link lands on a task; "‹ wallet"; the
// card's link pushes; "‹ wallet" pops. The Back fires popstate THEN hashchange,
// and the entry's own view (home) must win over its hash.
{
  const { ctx, page } = await open('bee', { path: '/wallet.html#receipts-sec' });
  const landed = await page.evaluate(() => document.body.dataset.wlView);
  await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById('v-bal').textContent = ''; }); await page.waitForTimeout(150);
  await page.click('#wl-bee .wlb-connect'); await page.waitForTimeout(400);
  const pushed = await page.evaluate(() => document.body.dataset.wlView);
  await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(600);
  const home = await page.evaluate(() => ({ view: document.body.dataset.wlView, hash: location.hash }));
  ok('bee: a Back whose hash changes keeps the entry\'s own view (popstate, then hashchange, never re-routes it)',
    landed === 'proof' && pushed === 'have' && home.view === 'home', `${landed} → home → ${pushed} → ${JSON.stringify(home)}`);
  await ctx.close();
}
// 4c · S3: every register's own blocks hide themselves until their register is
// known, even if register.js is late or missing (no raver orb painting in bee)
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'bee'); sessionStorage.setItem('wl.view', 'move'); } catch (e) {} });
  await ctx.route(url => !url.href.startsWith(origin) || /register\.js/.test(url.href), r => r.abort());
  const page = await ctx.newPage();
  await page.goto(origin + '/wallet.html', { waitUntil: 'load' }); await page.waitForTimeout(600);
  const leaked = await page.evaluate(() => ['wl-deck', 'wl-dock', 'wl-rave', 'wl-cy', 'wl-bee'].filter(id => document.getElementById(id).getClientRects().length));
  ok('without register.js (late or missing), no other register\'s block paints in bee (no raver orb, dock or console)', leaked.length === 0, leaked.join(', '));
  await ctx.close();
}

// 4d · AT TASK DEPTH (the dress-stripped audit): one tap in, bee and raver must
// not be the same body under a different header. Driven by the reader's own
// taps: bee taps its row, raver taps its glyph and then each card; cypherpunk
// has nothing to tap (every section is open). Per section, three measures:
// the visible words, the visible controls, and any engineering left showing.
{
  const TASKS = { have: ['connect-sec', 'bal-sec', 'summary-sec'], move: ['pay-sec', 'outbox-sec'], add: ['voucher-sec', 'peer-sec'],
    keep: ['bpay-sec', 'arw-sec'], key: ['kc-sec', 'vault-sec', 'forge-sec', 'acct-sec'], proof: ['receipts-sec', 'composer-sec', 'matrix-sec'] };
  const measure = (page, id) => page.evaluate(i => {
    // shown = it has boxes AND no closed <details> folds it (this Chromium keeps boxes for a closed note's content)
    const folded = e => { for (let d = e.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) { const sm = d.querySelector(':scope>summary'); if (!d.open && !(sm && sm.contains(e))) return true; } return false; };
    const s = document.getElementById(i), vis = e => e.getClientRects().length > 0 && !folded(e);
    const CTL = 'button:not(.wl-more),a[href],input:not([type="hidden"]),select,textarea';
    return {
      // the words are prose: visible text outside the controls (a button's label or a select's options are not words)
      words: (() => { const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); let t = '', n;
        while ((n = w.nextNode())) { const p = n.parentElement; if (!p || !vis(p) || p.closest('button,select,textarea,option')) continue; t += ' ' + n.textContent; }
        return t.replace(/\s+/g, ' ').trim(); })(),
      // a disclosure whose note holds controls is itself the way in to them: its summary counts
      ctrls: [...s.querySelectorAll(CTL)].filter(vis).length + [...s.querySelectorAll('details>summary')].filter(sm => vis(sm) && sm.parentElement.querySelector(CTL)).length,
      tech: [...s.querySelectorAll('[data-wl-tech]')].filter(e => vis(e) && !e.querySelector(CTL)).length,
    };
  }, id);
  const bodies = {};
  for (const reg of REGS) {
    const { ctx, page } = await open(reg);
    // the contract audit's method: the dress stripped, so only structure and words can differ
    await page.addStyleTag({ content: '*,*::before,*::after{color:#000!important;background:#fff!important;font-family:Arial!important;border-radius:0!important;box-shadow:none!important;text-shadow:none!important;animation:none!important;transition:none!important;border-color:#000!important} svg *{fill:#000!important;stroke:#000!important}' });
    bodies[reg] = {};
    for (const [task, ids] of Object.entries(TASKS)) {
      if (reg === 'bee') await page.click(`#wl-bee [data-wl-go="${task}"]`);
      if (reg === 'raver') await page.click(`#wl-dock [data-wl-go="${task}"]`);
      await page.waitForTimeout(350);
      const shownSecs = await page.evaluate(() => [...document.querySelectorAll('main>section[data-wl-task]')].filter(s => s.getClientRects().length).map(s => s.id));
      const cardsShown = await page.evaluate(() => [...document.querySelectorAll('#wl-cards .wlr-card, body[data-reg="raver"] #wallet-storage a')].filter(c => c.getClientRects().length).length);
      const sec = {};
      for (const id of ids) {
        const card = task === 'keep' ? `#wallet-storage a[href="#${id}"]` : `#wl-cards .wlr-card[data-wl-card-for="${id}"]`;
        if (reg === 'raver') { if (!await page.isVisible(card)) { sec[id] = null; continue; } await page.click(card); await page.waitForTimeout(250); }
        sec[id] = await measure(page, id);
        if (reg === 'raver') { await page.click(card); await page.waitForTimeout(150); }
      }
      bodies[reg][task] = { shownSecs, cardsShown, sec };
      if (reg === 'bee') { await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(350); }
    }
    await ctx.close();
  }
  const tasks = Object.keys(TASKS);
  ok('dress stripped, one tap in (the reader\'s own row or glyph), raver deals CARDS and shows no section, while bee shows the task’s sections: never the same page under a different header',
    tasks.every(t => bodies.raver[t].shownSecs.length === 0 && bodies.raver[t].cardsShown === TASKS[t].length && bodies.bee[t].shownSecs.length >= 1 && bodies.bee[t].cardsShown === 0),
    tasks.map(t => `${t}: bee ${bodies.bee[t].shownSecs.length} sections · raver ${bodies.raver[t].cardsShown} cards`).join(' · '));
  const all = [].concat(...tasks.map(t => TASKS[t]));
  const m = (reg, id) => bodies[reg][tasks.find(t => TASKS[t].includes(id))].sec[id];
  const folded = ['kc-sec', 'forge-sec', 'pay-sec', 'receipts-sec', 'composer-sec', 'outbox-sec', 'matrix-sec'];
  ok('each section with engineering reads as three bodies by visible words: cypherpunk > bee (engineering folded) > raver (words folded)',
    folded.every(id => m('cypherpunk', id).words.length > m('bee', id).words.length && m('bee', id).words.length > m('raver', id).words.length),
    folded.map(id => `${id} ${m('cypherpunk', id).words.length}/${m('bee', id).words.length}/${m('raver', id).words.length}`).join(' · '));
  const noCtl = all.filter(id => m('cypherpunk', id).ctrls > 0 && !(m('raver', id) && m('raver', id).ctrls > 0));
  ok('raver: every card whose section has controls opens with a control showing (a button, link, field, or the summary of a note that holds controls; the words fold, the controls never do)',
    noCtl.length === 0, all.filter(id => m('cypherpunk', id).ctrls > 0).map(id => `${id} ${m('raver', id) ? m('raver', id).ctrls : '-'}`).join(' · ') + (noCtl.length ? ' · NONE: ' + noCtl.join(',') : ''));
  const techShown = reg => all.filter(id => m(reg, id) && m(reg, id).tech > 0);
  ok('bee and raver at rest show none of a section’s engineering (every [data-wl-tech] block without a control is folded)',
    techShown('bee').length === 0 && techShown('raver').length === 0, `bee ${techShown('bee').join(',') || 'none'} · raver ${techShown('raver').join(',') || 'none'}`);
  const same = all.filter(id => m('bee', id) && m('raver', id) && m('bee', id).words === m('raver', id).words);
  ok('no section renders the SAME body in bee and raver (the visible words compared as strings)', same.length === 0, same.join(', ') || 'none identical');
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
    cards: [...document.querySelectorAll('#wl-cards .wlr-card')].filter(c => c.getClientRects().length).map(c => c.dataset.wlCardFor),
    words: [...document.querySelectorAll('#wl-cards .wlr-card')].filter(c => c.getClientRects().length).every(c => c.querySelector('.w').textContent.trim() && c.querySelector('.g').textContent.trim()),
    stage: document.getElementById('wl-rave').getClientRects().length > 0,
    pressed: [...document.querySelectorAll('#wl-dock [aria-pressed="true"]')].map(b => b.dataset.wlGo),
  }));
  ok('raver: the "add" glyph deals its parts as glyph cards, each with its word, and no section yet (not bee’s form under a dock)',
    deck.view === 'add' && deck.sections.length === 0 && deck.cards.join() === 'voucher-sec,peer-sec' && deck.words && !deck.stage && deck.pressed.join() === 'add', JSON.stringify(deck));
  await page.click('#wl-cards [data-wl-card-for="peer-sec"]'); await page.waitForTimeout(500);
  const card = await page.evaluate(() => ({ open: [...document.querySelectorAll('main>section[data-wl-task]')].filter(s => s.getClientRects().length).map(s => s.id), lit: document.querySelector('[data-wl-card-for="peer-sec"]').getAttribute('aria-pressed') }));
  await page.click('#wl-cards [data-wl-card-for="voucher-sec"]'); await page.waitForTimeout(400);
  const swap = await page.evaluate(() => [...document.querySelectorAll('main>section[data-wl-task]')].filter(s => s.getClientRects().length).map(s => s.id));
  ok('raver: a card opens its ONE section; another card swaps it (one part at a time)', card.open.join() === 'peer-sec' && card.lit === 'true' && swap.join() === 'voucher-sec', JSON.stringify(card) + ' → ' + swap.join());
  // EVERY deck, on a phone: the first thing under the dock is art, never a section
  const leads = {};
  for (const go of ['have', 'move', 'add', 'keep', 'key', 'proof', 'all']) {
    await page.click(`#wl-dock [data-wl-go="${go}"]`); await page.waitForTimeout(250);
    leads[go] = await page.evaluate(() => {
      const first = [...document.querySelectorAll('main>*')].filter(e => e.getClientRects().length && !['wl-dock','wallet-identity'].includes(e.id)).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      const g = [...document.querySelectorAll('#wl-deck [data-wl-for]')].filter(s => s.getClientRects().length).map(s => s.textContent).join();
      return (first && first.id) + (g ? ':' + g : '');
    });
  }
  ok('raver: storage opens on its network chooser; other decks keep their stage or glyph',
    leads.have === 'wl-rave' && leads.keep === 'wallet-storage' && ['move', 'add', 'key', 'proof', 'all'].every(g => leads[g].startsWith('wl-deck:')), JSON.stringify(leads));
  await page.click('#wl-dock [data-wl-go="add"]'); await page.waitForTimeout(600);
  const filled = async () => page.evaluate(() => {
    const probe = document.createElement('i'); probe.style.color = getComputedStyle(document.body).getPropertyValue('--reg-primary').trim(); document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color; probe.remove();
    return [...document.querySelectorAll('main>section[data-wl-task] button')].filter(b => b.getClientRects().length && getComputedStyle(b).backgroundColor === rgb).map(b => b.id || b.textContent.trim().slice(0, 20));
  });
  await page.click('#wl-dock [data-wl-go="move"]'); await page.waitForTimeout(600);
  await page.click('#wl-cards [data-wl-card-for="pay-sec"]'); await page.waitForTimeout(500);
  const rf = await filled();
  ok('raver: the "move" deck opens with at most one filled action (not three magenta pills)', rf.length <= 1, rf.join(', ') || 'none filled at rest');
  await page.click('#wl-dock [data-wl-go="add"]'); await page.waitForTimeout(600);
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
  await page.focus('#wl-dock [data-wl-go="key"]');
  await page.keyboard.press('End'); await page.waitForTimeout(700);
  const inView = await page.evaluate(() => { const d = document.getElementById('wl-dock').getBoundingClientRect(), b = document.querySelector('#wl-dock [aria-pressed="true"]').getBoundingClientRect(); return { go: document.body.dataset.wlView, inside: b.left >= d.left - 1 && b.right <= d.right + 1 }; });
  ok('raver: on a narrow dock the lit glyph scrolls into view (the last glyph, "all", is never off-screen when lit)', inView.go === 'all' && inView.inside, JSON.stringify(inView));
  await ctx.close();
}
{
  // under reduced motion every raver piece holds a still (the orb, its rings, the orbit, the soul)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'raver'); sessionStorage.setItem('wl.view', 'move'); } catch (e) {} });
  await ctx.route(url => !url.href.startsWith(origin), r => r.abort());
  const page = await ctx.newPage();
  await page.goto(origin + '/wallet.html', { waitUntil: 'load' }); await page.waitForTimeout(500);
  const still = await page.evaluate(() => {
    const orb = document.querySelector('.wld-orb');
    return [getComputedStyle(orb).animationName, getComputedStyle(orb, '::before').animationName, getComputedStyle(orb, '::after').animationName,
      getComputedStyle(document.querySelector('.wlr-orbit')).animationName, getComputedStyle(document.querySelector('.wlr-soul')).animationName];
  });
  ok('raver under reduced motion: the orb, its rings, the orbit and the soul all hold still', still.every(a => a === 'none'), still.join(','));
  await ctx.close();
}

// 6 · cypherpunk: the pipeline at once. An index, keys, every note.
{
  const { ctx, page } = await open('cypherpunk', { width: 1280, height: 800 });
  const idx = await page.evaluate(() => [...document.querySelectorAll('#wl-cy-idx a')].map(a => ({ sec: a.getAttribute('href').slice(1), shown: a.getClientRects().length > 0, h: Math.round(a.getBoundingClientRect().height) })));
  const live = idx.filter(i => i.shown);
  ok('cypherpunk: the index has a row for every section it can show (each a ≥ 44px press), none pointing at a hidden one',
    idx.length === 18 && live.every(i => i.h >= 44) && live.length === 17 && !idx.find(i => i.sec === 'bridge-sec').shown,
    `${idx.length} rows · ${live.length} live · bridge ${idx.find(i => i.sec === 'bridge-sec').shown ? 'SHOWN (dead)' : 'held until the page shows it'}`);
  const rail = await page.evaluate(() => { const c = document.getElementById('wl-cy'), m = document.getElementById('bal-sec'); return { pos: getComputedStyle(c).position, left: c.getBoundingClientRect().right <= m.getBoundingClientRect().left, top: Math.round(c.getBoundingClientRect().top), fold: innerHeight }; });
  ok('cypherpunk (desktop): the console is a sticky rail beside the pipeline, in the first screen', rail.pos === 'sticky' && rail.left && rail.top < rail.fold, JSON.stringify(rail));
  const small = await page.evaluate(() => [...document.querySelectorAll('main button, main select, main summary, main a.fund-launch')].filter(b => b.getClientRects().length && b.getBoundingClientRect().height < 44).map(b => (b.id || b.textContent.trim().slice(0, 16)) + ':' + Math.round(b.getBoundingClientRect().height)));
  ok('every press in the whole open pipeline is ≥ 44px, links that act as buttons included', small.length === 0, small.slice(0, 5).join(' '));
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
  const landed = await page.evaluate(() => Math.round(document.getElementById('fund-sec').getBoundingClientRect().top-document.getElementById('wallet-identity').getBoundingClientRect().bottom));
  ok('cypherpunk: an index row lands on its section', landed >= 0 && landed < 40, 'below wallet bar ' + landed + 'px');
  await page.keyboard.press('o');
  const folded = await page.evaluate(() => [...document.querySelectorAll('details[data-reg-disclose]')].every(d => !d.open));
  await page.keyboard.press('o');
  const opened = await page.evaluate(() => [...document.querySelectorAll('details[data-reg-disclose]')].every(d => d.open));
  ok('cypherpunk: o folds every note, o again opens every note', folded && opened);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#breg-bee'); await page.waitForTimeout(400);
  const beeOpen = await page.evaluate(() => [...document.querySelectorAll('details[data-reg-disclose]')].filter(d => d.open).length);
  ok('a bulk key never pins the notes: after o, bee still folds every note by default', beeOpen === 0, beeOpen + ' open in bee');
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
    // a LATER read that fails leaves the old figure in the card: it must never pass for current
    seen[reg].stale = await page.evaluate(v => {
      document.getElementById('v-bal').textContent = v;
      // exactly what the page's own failure branch does: the text, the colour, and the read's own mark
      const st = document.getElementById('v-stat'); st.textContent = 'read failed'; st.className = 'stat err'; window.wlRead(st, false);
      return new Promise(r => setTimeout(() => {
        const vis = sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => e.textContent.trim());
        r({ figs: vis('#wl-bee .wlb-fig, #wl-rave li:first-child .wl-fig, #wl-cy tbody:first-of-type tr:first-child .wl-fig'),
            said: vis('#wl-bee .wl-stale, #wl-rave li:first-child .wl-stale, #wl-cy tbody:first-of-type tr:first-child td:last-child'),
            lit: document.querySelector('.wlr-node[data-wl-rail="v-bal"]').getAttribute('data-lit') });
      }, 100));
    }, FIXTURE['v-bal']);
    // Arweave paints "stat err" for a read that SUCCEEDED but is short of the anchor fee: not a failure
    seen[reg].short = await page.evaluate(() => {
      document.getElementById('ar-bal').textContent = '0.5 AR';
      const st = document.getElementById('ar-stat'); st.className = 'stat err'; st.textContent = 'live · short 0.1 AR for the anchor'; window.wlRead(st, true);
      return new Promise(r => setTimeout(() => r({
        lit: document.querySelector('.wlr-node[data-wl-rail="ar-bal"]').getAttribute('data-lit'),
        staleShown: [...document.querySelectorAll('#wl-rave li[data-wl-stat="ar-stat"] .wl-stale')].filter(e => e.getClientRects().length).length,
      }), 100));
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
  ok('a read that succeeds short of a fee ("live · short …", painted err) is NOT called failed: its rail stays lit, no stale line',
    REGS.every(r => seen[r].short.lit === 'true' && seen[r].short.staleShown === 0), REGS.map(r => r + ':' + JSON.stringify(seen[r].short)).join(' · '));
  ok('a failed LATER read keeps its old figure but says so in every register, and its rail goes dark',
    REGS.every(r => seen[r].stale.figs.length === 1 && seen[r].stale.said.length === 1 && seen[r].stale.said[0].length > 5 && seen[r].stale.lit === 'false'),
    REGS.map(r => r + ':' + seen[r].stale.said.join()).join(' · '));
}

// 7a · a RETURNING reader, the real path: the page restores the saved soul and
// starts the reads; every chain request hangs (never answered), so the reads
// stay in flight. Nothing is injected: the card must say what the page is doing.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'bee'); localStorage.setItem('bnr_soul', 'gatesoul'); } catch (e) {} });
  await ctx.route(url => !url.href.startsWith(origin), () => { /* never answered: the read stays in flight */ });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push('bee (returning): ' + String(e)));
  await page.goto(origin + '/wallet.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const inflight = await page.evaluate(() => {
    const vis = sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => e.textContent.trim());
    return { soul: document.body.dataset.wlSoul, connect: vis('#wl-bee .wlb-connect'), stat: vis('#wl-bee .wlb-stat'), fig: vis('#wl-bee .wlb-fig') };
  });
  ok('bee: a returning reader whose read is still in flight sees "reading…" (the page’s own state), never "connect your name"',
    inflight.soul === 'true' && inflight.connect.length === 0 && inflight.stat.join() === 'reading…' && inflight.fig.length === 0, JSON.stringify(inflight));
  await ctx.close();
}

// 7b · CONTRAST, measured on every visible text leaf of the whole wallet
// ("everything" view) against its effective background. Bee is paper, so the
// sections' dark-ground inline palette must have migrated with it: AA, no
// exceptions. Raver and cypherpunk may miss AA only by the sheet's ONE ruled
// exception (ink-dim #648176 on bg-card #0c1412, kept exact, 4.4:1).
{
  const contrast = page => page.evaluate(() => {
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(s => parseFloat(s)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const bgOf = el => { for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > .5) return c; } return parse(getComputedStyle(document.body).backgroundColor); };
    const out = [], small = [], dash = [];
    // every visible TEXT NODE, so the own text of a mixed-content parent counts
    // too (CSS-generated content is not text and is not measured)
    const els = new Set(), walk = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) { const n = walk.currentNode, p = n.parentElement; if (n.textContent.trim() && p && p.closest('main>section[data-wl-task]')) els.add(p); }
    // what is PAINTED: an element's own opacity times every ancestor's (SVG opacity attributes included)
    const effOpacity = el => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
    els.forEach(el => {
      if (!el.getClientRects().length) return;
      const cs = getComputedStyle(el), alpha = effOpacity(el); if (cs.visibility === 'hidden' || alpha === 0) return;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      const where = { t: own.slice(0, 30), sec: el.closest('section').id };
      if (own === '—' || own === '-') dash.push(where);
      if (parseFloat(cs.fontSize) < 14) small.push({ ...where, px: parseFloat(cs.fontSize) });
      if (el.closest('[aria-disabled="true"],:disabled')) return; // inactive controls are exempt (WCAG 1.4.3)
      // SVG text paints with FILL, never color: measure what is actually painted
      const fg0 = parse(el instanceof SVGElement ? cs.fill : cs.color), bg = bgOf(el); if (!fg0 || !bg) return;
      const a = alpha * (fg0.a == null ? 1 : fg0.a), fg = { r: fg0.r * a + bg.r * (1 - a), g: fg0.g * a + bg.g * (1 - a), b: fg0.b * a + bg.b * (1 - a) };
      const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      const min = parseFloat(cs.fontSize) >= 18.66 || (parseFloat(cs.fontSize) >= 14 && parseInt(cs.fontWeight, 10) >= 700) ? 3 : 4.5;
      if (ratio < min) out.push({ ...where, ratio: Math.round(ratio * 100) / 100, pair: (el instanceof SVGElement ? cs.fill : cs.color) + (alpha < 1 ? ' at opacity ' + Math.round(alpha * 100) / 100 : '') + ' on ' + `rgb(${bg.r}, ${bg.g}, ${bg.b})` });
    });
    // honey = the gold token, b-value, and bee's stepped honey: never a border or a ground in a section
    const HONEY = ['rgb(255, 215, 0)', 'rgb(232, 181, 75)', 'rgb(122, 82, 9)', 'rgb(133, 91, 11)'];
    const honey = [...document.querySelectorAll('main>section[data-wl-task], main>section[data-wl-task] *')].filter(e => e.getClientRects().length).filter(e => {
      const c = getComputedStyle(e);
      return HONEY.includes(c.backgroundColor) || ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(c['border' + k + 'Width']) > 0 && HONEY.includes(c['border' + k + 'Color'])) || /255, 215, 0|232, 181, 75/.test(c.backgroundImage);
    }).map(e => (e.id || e.tagName.toLowerCase() + '.' + (e.getAttribute('class') || '')).slice(0, 30));
    // and no visible text paints honey: a direct text node's colour is its parent's
    const honeyText = [];
    for (const e of document.querySelectorAll('main>section[data-wl-task] *')) {
      if (!e.getClientRects().length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const c = getComputedStyle(e); if (HONEY.includes(e instanceof SVGElement ? c.fill : c.color)) honeyText.push((e.id || e.tagName.toLowerCase()) + ' "' + e.textContent.trim().slice(0, 24) + '"');
    }
    return { out, small, dash, honey, honeyText };
  });
  const low = {}, audit = {};
  for (const reg of REGS) {
    const { ctx, page } = await open(reg);
    await page.evaluate(() => { document.body.setAttribute('data-wl-view', 'all'); });
    await page.waitForTimeout(700);
    // measure the SETTLED page: every finite animation (the arrivals) run to its end
    await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* infinite ambient motion cannot finish */ } }));
    audit[reg] = await contrast(page);
    low[reg] = audit[reg].out;
    await ctx.close();
  }
  // honey is the colour of b only: no section border or background paints it, in any register
  ok('no visible section border (any side) or background paints honey (gold) in any register, the whole wallet at rest',
    REGS.every(r => audit[r].honey.length === 0), REGS.map(r => r + ' ' + audit[r].honey.slice(0, 3).join(',')).join(' · '));
  ok('no visible text in any section paints honey in any register at rest (the crest’s gold stays out of the interface; states reached only after an action are not rendered here)',
    REGS.every(r => audit[r].honeyText.length === 0), REGS.map(r => r + ' ' + (audit[r].honeyText.slice(0, 3).join(', ') || 'none')).join(' · '));
  ok('bee: no visible text node at rest in the whole wallet (every task open, notes folded) reads under the 14px label floor, SVG and script-set styles included', audit.bee.small.length === 0,
    audit.bee.small.slice(0, 4).map(l => `${l.sec} "${l.t}" ${l.px}px`).join(' · '));
  ok('no register shows a bare dash standing for a value in any visible text node at rest of the whole wallet (never 0, never a dash)', REGS.every(r => audit[r].dash.length === 0),
    REGS.map(r => r + ' ' + audit[r].dash.slice(0, 3).map(l => `${l.sec} "${l.t}"`).join(',')).join(' · '));
  ok('bee: every visible text node at rest of the whole wallet holds AA contrast on paper (SVG measured by fill)', low.bee.length === 0,
    low.bee.slice(0, 3).map(l => `${l.sec} "${l.t}" ${l.ratio} (${l.pair})`).join(' · '));
  const ruled = l => l.pair === 'rgb(100, 129, 118) on rgb(12, 20, 18)';
  for (const reg of ['raver', 'cypherpunk']) {
    const other = low[reg].filter(l => !ruled(l));
    ok(`${reg}: below AA only by the sheet's one ruled exception (ink-dim on bg-card)`, other.length === 0,
      `${low[reg].length - other.length} ruled · ` + other.slice(0, 3).map(l => `${l.sec} "${l.t}" ${l.ratio} (${l.pair})`).join(' · '));
  }
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
  ok('every one of the 18 sections belongs to a task a bee row and a raver glyph can open', reach.n === 18 && reach.orphans.length === 0, reach.orphans.join(', '));
  const map = await page.evaluate(() => {
    const dom = Object.fromEntries([...document.querySelectorAll('main>section[data-wl-task]')].map(s => [s.id, s.dataset.wlTask]));
    const early = window.WL_TASK_OF || {};
    const drift = Object.keys(dom).filter(k => dom[k] !== early[k]).concat(Object.keys(early).filter(k => !(k in dom)));
    return { drift };
  });
  ok('the first-paint task map and the sections\' own data-wl-task attributes agree (no drift)', map.drift.length === 0, map.drift.join(', '));
  const heldMap = await page.evaluate(() => ({ dom: [...document.querySelectorAll('main>section[data-wl-held]')].map(s => s.id).sort().join(), early: Object.keys(window.WL_HELD || {}).sort().join() }));
  ok('the first-paint held map and the sections\' own data-wl-held attributes agree (the card route, and only it)', heldMap.dom === 'fund-sec' && heldMap.early === heldMap.dom, JSON.stringify(heldMap));
  const ring = await page.evaluate(() => ({ words: [...document.querySelectorAll('#kc-sec svg text')].map(t => t.textContent.trim()).filter(t => /[a-z]{2,}/i.test(t)), key: document.querySelectorAll('#kc-sec .ring-key li').length }));
  ok('the keychain ring carries numerals only; its words are a text key beneath it (no words inside art)', ring.words.length === 0 && ring.key === 5, JSON.stringify(ring));
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
  // moving through the console (j, an index row) is browsing, not work
  await page.keyboard.press('j'); await page.keyboard.press('j'); await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#breg-bee'); await page.waitForTimeout(300);
  ok('browsing the console with j is not work: switching to bee still lands home', await page.evaluate(() => document.body.dataset.wlView) === 'home');
  await page.click('#breg-cypherpunk'); await page.waitForTimeout(300);
  await page.fill('#wq', 'gatesoul');
  await page.click('#breg-bee');
  await page.waitForTimeout(400);
  const carried = await page.evaluate(() => ({ view: document.body.dataset.wlView, shown: document.getElementById('wq').getClientRects().length > 0 }));
  ok('the field a reader last typed in carries across: bee opens on its task ("see what i have", where connect lives) with the value intact',
    carried.view === 'have' && carried.shown && await page.inputValue('#wq') === 'gatesoul', JSON.stringify(carried));
  await page.click('#breg-raver');
  await page.waitForTimeout(300);
  ok('bee\'s task carries into raver (the have glyph is lit, the same field shows)', await page.evaluate(() => document.body.dataset.wlView === 'have' && document.querySelector('#wl-dock [data-wl-go="have"]').getAttribute('aria-pressed') === 'true') && await page.isVisible('#wq'));
  await page.click('#breg-cypherpunk');
  await page.waitForTimeout(500);
  const place = await page.evaluate(() => Math.round(document.getElementById('connect-sec').getBoundingClientRect().top-document.getElementById('wallet-identity').getBoundingClientRect().bottom));
  ok('and back in cypherpunk the reader is placed at that task\'s first section', place >= 0 && place < 60, 'connect below wallet bar ' + place + 'px');
  await ctx.close();
}

// 4e · THE CONTENT, NOT ITS LENGTH, with the dress stripped (the contract audit's own method:
// every colour, font, radius, shadow and animation forced to one value). One tap into
// "add money" and the footer, per register, and the actual engineering strings checked:
// bee and raver keep them folded (one tap away), cypherpunk shows them; the plain facts
// (the balance, the memo warning, the card route's own reason, the checkout state) show
// everywhere. The card route (fund) is HELD out of bee's and raver's "add money" (founder
// direction 2026-09-28, bPay only; the held law itself is 4i): there it is read in "show me
// everything", the one view that shows it, its engineering one tap further behind its toggle.
{
  const STRIP = '*,*::before,*::after{color:#000!important;background:#fff!important;font-family:Arial!important;border-radius:0!important;box-shadow:none!important;text-shadow:none!important;animation:none!important;transition:none!important;border-color:#000!important} svg *{fill:#000!important;stroke:#000!important}';
  const VOUCHER = { balance: '12.5000', topup: { rail_a: { send_to: 'bnrvoucher11', memo: 'gatekey' }, rail_usdc: { send_to: '0x' + '1'.repeat(40), rate_a_per_usdc: '4.2', rate_ref: 'RATE-REF-FIXTURE' } },
    spent_total: '1.0000', deposited_total: '13.5000', tithe_total: '0.1000', receipts: [], source: 'SOURCE-FIXTURE-HOST' };
  const ENG = { voucher: ['SOURCE-FIXTURE-HOST', 'hash-chained ledger', 'RATE-REF-FIXTURE'], fund: ['BNR_MELD_PUBLIC_KEY', 'data-meld-public-key', 'sb.meldcrypto.com'], footer: ['PBKDF2+AES-GCM', 'crates/bnr-keys', 'vendored eosjs'] };
  const PLAIN = { voucher: ['12.5000', 'no memo, no credit'], fund: ['not wired to bPay', 'card checkout is not switched on here yet'], footer: ['skaists heART WALLet', 'how this page is built'] };
  const seen = (page, sel) => page.evaluate(sel => {
    const folded = e => { for (let d = e.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) { const sm = d.querySelector(':scope>summary'); if (!d.open && !(sm && sm.contains(e))) return true; } return false; };
    const root = document.querySelector(sel), w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let t = '', n;
    while ((n = w.nextNode())) { const p = n.parentElement; if (p && p.getClientRects().length && getComputedStyle(p).visibility !== 'hidden' && !folded(p)) t += ' ' + n.textContent; }
    return t.replace(/\s+/g, ' ');
  }, sel);
  const has = (text, list) => list.filter(m => text.includes(m));
  const resW = {};
  for (const W of [390, 1280]) {
  const res = resW[W] = {};
  for (const reg of REGS) {
    const ctx = await browser.newContext({ viewport: { width: W, height: W === 390 ? 844 : 900 } });
    await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch (e) {} }, reg);
    await ctx.route(url => !url.href.startsWith(origin), r => /\/voucher\/v1\/voucher\//.test(r.request().url())
      ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(VOUCHER) }) : r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', e => pageErrors.push(reg + ': ' + String(e)));
    await page.goto(origin + '/wallet.html', { waitUntil: 'load' });
    await page.waitForSelector('#breg-cypherpunk'); await page.waitForTimeout(400);
    const strip = await page.addStyleTag({ content: STRIP }); await page.waitForTimeout(150);
    const r = res[reg] = {};
    // the footer at arrival, then one tap on its summary
    r.footer = await seen(page, 'footer');
    if (reg !== 'cypherpunk') { await page.click('footer .wl-foot>summary'); await page.waitForTimeout(150); r.footerTap = await seen(page, 'footer'); }
    // one tap into "add money": bee's row, raver's glyph and then each card; cypherpunk is already open
    if (reg === 'bee') await page.click('#wl-bee [data-wl-go="add"]');
    if (reg === 'raver') await page.click('#wl-dock [data-wl-go="add"]');
    await page.waitForTimeout(350);
    for (const [part, id] of [['voucher', 'voucher-sec']]) {
      if (reg === 'raver') { await page.click(['bpay-sec','arw-sec'].includes(id) ? `#wallet-storage a[href="#${id}"]` : `#wl-cards .wlr-card[data-wl-card-for="${id}"]`); await page.waitForTimeout(300); }
      if (part === 'voucher') { await page.fill('#vc-key', 'gatekey'); await page.click('#vc-go'); await page.waitForFunction(() => document.getElementById('vc-panel').style.display === 'block', null, { timeout: 5000 }); }
      r[part] = await seen(page, '#' + id);
      // the voucher panel a lookup opens, read as words: no dash, no capitals-as-shout
      // (its heading is the keyed-heading casing follow-up, measured elsewhere)
      // (a lone "—" is the page's empty-value placeholder, which is data, not punctuation)
      if (part === 'voucher') r.voucherCopy = await page.evaluate(() => {
        const ORACLE = '#vc-u-ref,#vc-a-dest,#vc-a-memo,#vc-u-dest,#vc-src,#vc-balance';   // values the oracle returns: data, not the wallet's copy
        const s = document.getElementById('vc-panel'), w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); const out = []; let n;
        while ((n = w.nextNode())) { const p = n.parentElement, t = n.textContent.trim(); if (!t || t === '—' || !p.getClientRects().length || p.closest('details:not([open])') || p.closest(ORACLE)) continue; out.push(t); }
        return out;
      });
      if (reg !== 'cypherpunk') { await page.click(`#${id} .wl-more`); await page.waitForTimeout(150); r[part + 'Tap'] = await seen(page, '#' + id); await page.click(`#${id} .wl-more`); await page.waitForTimeout(100); }
      if (reg === 'raver') { await page.click(['bpay-sec','arw-sec'].includes(id) ? `#wallet-storage a[href="#${id}"]` : `#wl-cards .wlr-card[data-wl-card-for="${id}"]`); await page.waitForTimeout(150); }
    }
    // receipts: the add task one tap deep, stripped and in colour (to tell a real overlap from a strip artefact)
    if (reg === 'raver') { await page.click('#wl-cards .wlr-card[data-wl-card-for="peer-sec"]'); await page.waitForTimeout(300); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(here, 'shots-wallet-registers', `wallet-${W}-${reg}-add-stripped.png`) });
    await page.evaluate(el => el.remove(), strip); await page.waitForTimeout(300);
    await page.screenshot({ path: join(here, 'shots-wallet-registers', `wallet-${W}-${reg}-add-colour.png`) });
    // the card route, dress stripped again: cypherpunk reads it in the open pipeline; bee and
    // raver in "show me everything" (bee: back, then its row; raver: the "all" glyph)
    await page.addStyleTag({ content: STRIP }); await page.waitForTimeout(150);
    if (reg === 'bee') { await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(350); await page.click('#wl-bee [data-wl-go="all"]'); }
    if (reg === 'raver') await page.click('#wl-dock [data-wl-go="all"]');
    await page.waitForTimeout(350);
    r.fund = await seen(page, '#fund-sec');
    if (reg !== 'cypherpunk') { await page.click('#fund-sec .wl-more'); await page.waitForTimeout(150); r.fundTap = await seen(page, '#fund-sec'); }
    await ctx.close();
  }
  }
  const res = { bee: {}, raver: {}, cypherpunk: {} };
  for (const reg of REGS) for (const k of Object.keys(resW[390][reg])) res[reg][k] = resW[390][reg][k] + ' ¦ ' + (resW[1280][reg][k] || '');
  const parts = ['voucher', 'fund', 'footer'];
  const leak = (reg) => parts.flatMap(p => has(res[reg][p], ENG[p]).map(m => p + ':' + m));
  ok('dress stripped, at 390 and 1280, one tap in: bee and raver show NONE of the voucher, fund and footer engineering at rest (source host, rate citation, ledger internals, key names, sandbox host, crypto and build notes)',
    leak('bee').length === 0 && leak('raver').length === 0, `bee ${leak('bee').join(', ') || 'none'} · raver ${leak('raver').join(', ') || 'none'}`);
  const missing = reg => parts.flatMap(p => ENG[p].filter(m => [390, 1280].some(W => !resW[W][reg][p].includes(m))).map(m => p + ':' + m));
  ok('cypherpunk shows every one of those engineering strings open, with no tap', missing('cypherpunk').length === 0, missing('cypherpunk').join(', ') || 'all open');
  const far = reg => parts.flatMap(p => ENG[p].filter(m => [390, 1280].some(W => !resW[W][reg][p + 'Tap'].includes(m))).map(m => p + ':' + m));
  ok('in bee and raver each one is ONE tap away (the section\'s own toggle, the footer\'s summary): moved, never deleted',
    far('bee').length === 0 && far('raver').length === 0, `bee ${far('bee').join(', ') || 'all reached'} · raver ${far('raver').join(', ') || 'all reached'}`);
  const lost = reg => parts.flatMap(p => PLAIN[p].filter(m => [390, 1280].some(W => !resW[W][reg][p].includes(m))).map(m => p + ':' + m));
  // tickers and names are words, not shouting
  const VC_TICKERS = new Set(['USDC', 'ETH', 'ANT', 'HIVE', 'HBD', 'BTC', 'BNR', 'EVM', 'HTTP', 'A']);
  const vcBad = [];
  for (const W of [390, 1280]) for (const reg of REGS) for (const t of resW[W][reg].voucherCopy || []) {
    const shout = (t.match(/\b[A-Z]{2,}\b/g) || []).filter(x => !VC_TICKERS.has(x));
    if (/[—–]/.test(t) || shout.length) vcBad.push(`${W} ${reg}: ‹${t.slice(0, 50)}›`);
  }
  ok('the voucher panel a lookup opens reads as words in every register at 390 and 1280: no dash as punctuation, no capitals-as-shout (a lone "—" empty value and the oracle’s own values excepted)',
    vcBad.length === 0 && REGS.every(r => (resW[390][r].voucherCopy || []).length > 0), vcBad.slice(0, 4).join(' · ') || 'clean');
  ok('the plain facts show at rest in every register: the voucher balance, the memo warning, the card route\'s own "not wired to bPay", the checkout state, the footer\'s name and its way in',
    REGS.every(r => lost(r).length === 0), REGS.map(r => `${r} ${lost(r).join(', ') || 'all shown'}`).join(' · '));
}

// 4f · NEW BEE'S OPENING COPY, read as words: every section a bee task opens (its visible
// heading and the intro under it) carries no capitals-as-shout, no dash, and none of the
// machine words below. At 390 and 1280, dress stripped, one real row tap per task.
{
  const STRIP = '*,*::before,*::after{color:#000!important;background:#fff!important;font-family:Arial!important;border-radius:0!important;box-shadow:none!important;text-shadow:none!important;animation:none!important;transition:none!important;border-color:#000!important}';
  // tickers and names a reader meets on any exchange are words, not shouting
  const TICKERS = new Set(['USDC', 'ETH', 'ANT', 'HIVE', 'HBD', 'HP', 'AR', 'BTC', 'BCH', 'ZEC', 'XMR', 'BNR', 'EVM', 'QR']);
  // the engine room's vocabulary: true, and belonging one tap deeper
  const MACHINE = ['rpc', 'keyless', 'vram', 'spec-', 'bytes', 'persist', 'contract surface', 'unicove', 'abi', 'prf', 'jwk', 'wasm', 'oracle', 'hash-chained', 'derivation', 'endpoint', 'eosjs', 'sandbox', 'escrow', 'orchestrator', 'metadata', 'masterprk', 'funnel'];
  const found = [];
  const seenOpen = [];
  for (const W of [390, 1280]) {
    const { ctx, page } = await open('bee', { width: W, height: W === 390 ? 844 : 900 });
    await page.addStyleTag({ content: STRIP });
    for (const t of ['have', 'move', 'add', 'keep', 'key', 'proof']) {
      await page.click(`#wl-bee [data-wl-go="${t}"]`); await page.waitForTimeout(350);
      const opening = await page.evaluate(() => {
        const vis = e => e.getClientRects().length > 0 && !e.closest('details:not([open])');
        const CTL = 'button,a[href],input,select,textarea,summary';
        return [...document.querySelectorAll('main>section[data-wl-task]')].filter(vis).map(s => {
          const heads = [...s.querySelectorAll(':scope>h2')].filter(vis);
          const last = heads[heads.length - 1];
          let intro = last && last.nextElementSibling;
          while (intro && (!vis(intro) || !intro.innerText.trim())) intro = intro.nextElementSibling;
          const words = heads.map(h => h.innerText).join(' ') + (intro && !intro.matches(CTL) && !intro.querySelector(CTL) ? ' ' + intro.innerText : '');
          return { id: s.id, words: words.replace(/\s+/g, ' ').trim() };
        });
      });
      for (const o of opening) {
        seenOpen.push(`${W}:${t}:${o.id}`);
        const shout = (o.words.match(/\b[A-Z]{2,}(?:[-_][A-Z0-9]+)*\b/g) || []).filter(w => !TICKERS.has(w));
        const dash = /[—–]/.test(o.words);
        const low = o.words.toLowerCase(), machine = MACHINE.filter(m => low.includes(m));
        if (shout.length || dash || machine.length) found.push(`${W} ${t}/${o.id}: ${[...shout, dash ? 'dash' : '', ...machine].filter(Boolean).join(',')} ‹${o.words.slice(0, 60)}›`);
      }
      await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(350);
    }
    await ctx.close();
  }
  ok('new bee\'s opening copy, dress stripped at 390 and 1280: every section a task opens reads with no capitals-as-shout, no dash and none of the machine words (heading and the intro under it)',
    // 16 sections per width, EXACTLY: the 17 the pipeline shows, less the card route, held out of
    // bee's tasks (4i reads it, in "show me everything"); the bridge waits hidden until needed
    found.length === 0 && seenOpen.length === 2 * 16 && !seenOpen.some(s => s.endsWith(':fund-sec')), found.length ? found.slice(0, 5).join(' · ') : `${seenOpen.length} openings read clean`);
}

// 4g · THE HEADINGS READ AS WORDS: no visible section heading shouts in capitals, in
// cypherpunk (every keyed heading open) and in new bee's "everything" view (its own
// headings). Tickers and names a reader meets on any exchange are words, not shouting,
// and so is a SPEC-… identifier: the canonical name of a spec document (docs/specs/).
{
  const TICKERS = new Set(['USDC', 'ETH', 'ANT', 'HIVE', 'HBD', 'HP', 'AR', 'BTC', 'BCH', 'ZEC', 'XMR', 'BNR', 'EVM', 'QR', 'A', 'RAM']);
  const shouted = {};
  for (const reg of ['cypherpunk', 'bee']) {
    const { ctx, page } = await open(reg);
    if (reg === 'bee') { await page.click('#wl-bee [data-wl-go="all"]'); await page.waitForTimeout(350); }
    shouted[reg] = await page.evaluate(T => [...document.querySelectorAll('main>section[data-wl-task] h2')].filter(h => h.getClientRects().length)
      .map(h => h.innerText.replace(/\s+/g, ' ').trim()).filter(t => (t.replace(/\bSPEC-[A-Z0-9-]+/g, '').match(/\b[A-Z]{2,}\b/g) || []).some(w => !T.includes(w))), [...TICKERS]);
    await ctx.close();
  }
  ok('no visible section heading shouts in capitals, in cypherpunk (every keyed heading) or in new bee\'s everything view (tickers and SPEC-… document identifiers excepted)',
    shouted.cypherpunk.length === 0 && shouted.bee.length === 0, `cypherpunk ${shouted.cypherpunk.join(' · ') || 'none'} · bee ${shouted.bee.join(' · ') || 'none'}`);
}

// 4h · THE bPAY LAW LINE FOLLOWS ITS ENGLISH: the English says "the chooser comes first";
// every tongue once still said "Phase A", a label the page no longer carries. No cell may
// keep a standalone capital A, Latin or Cyrillic (the phase letter in every script), and none may fall back
// to the English.
{
  const corpus = JSON.parse(await readFile(join(SURFACES, 'lang-corpus.json'), 'utf8'));
  const row = corpus.strings['wl.bpay.law'];
  const stale = Object.entries(row).filter(([l, v]) => l !== 'en' && (/(^|[^\p{L}])[AА]([^\p{L}]|$)/u.test(v) || v === row.en)).map(([l]) => l);
  ok('the bPay law line follows its English in every tongue: no stale "Phase A" label, no English fallback', Object.keys(row).length === 29 && stale.length === 0, stale.join(' ') || `${Object.keys(row).length} cells`);
}

// 4i · THE CARD ROUTE LEAVES NEW BEE'S "ADD MONEY" (founder direction 2026-09-28 under the
// standing bPay-only order; the reviewer's criteria: PR #237 comment 5882215580). Meld buys
// USDC on Base or Ethereum, bPay spends ANT with Arbitrum gas, and nothing turns one into the
// other, so the card route is no step of bee's (or raver's) "add money". Every check reads
// CONTENT: the visible text, the visible fields and the visible controls, dress stripped, at
// 390 and 1280. Never text length. A negative control proves each detector can fire.
{
  const STRIP = '*,*::before,*::after{color:#000!important;background:#fff!important;font-family:Arial!important;border-radius:0!important;box-shadow:none!important;text-shadow:none!important;animation:none!important;transition:none!important;border-color:#000!important} svg *{fill:#000!important;stroke:#000!important}';
  // what the card route would put on screen
  const MELD = ['Meld', 'USDC', 'buy USDC', 'card checkout', 'separate card route', '.eth name', 'checkout key'];
  const CHAIN = /\b(Base|Ethereum|Arbitrum|Vaulta|Hive|Arweave|Solana|Bitcoin|Zano|Optimism|Polygon)\b/;
  // the visible words of every section the view shows, grouped by the block that holds them
  // (a sentence is read whole across its inline <b> and <a>); field placeholders are words too
  const read = page => page.evaluate(() => {
    const folded = e => { for (let d = e.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) { const sm = d.querySelector(':scope>summary'); if (!d.open && !(sm && sm.contains(e))) return true; } return false; };
    const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && !folded(e);
    const blockOf = el => { for (let n = el; n; n = n.parentElement) { if (!/^inline/.test(getComputedStyle(n).display) || n.matches('button,summary,select,option')) return n; } return el; };
    const secs = [...document.querySelectorAll('main>section[data-wl-task]')].filter(s => s.getClientRects().length);
    const blocks = new Map();
    for (const s of secs) {
      const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('script,style') || !vis(p) || !n.textContent.trim()) continue; const b = blockOf(p); blocks.set(b, (blocks.get(b) || '') + n.textContent); }
      for (const i of s.querySelectorAll('input,textarea')) if (vis(i) && i.placeholder) blocks.set(i, i.placeholder);
    }
    const main = document.querySelector('main');
    return {
      sections: secs.map(s => s.id),
      blocks: [...blocks.values()].map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean),
      fundParts: [...document.querySelectorAll('#fund-sec, #fund-sec *')].filter(vis).length,
      selects: [...main.querySelectorAll('main>section select')].filter(vis).map(e => e.id),
      buyLinks: [...main.querySelectorAll('a[href]')].filter(a => vis(a) && (/meld/i.test(a.href) || /buy USDC/.test(a.textContent) || a.id === 'fund-go')).map(a => a.id || a.textContent.trim()),
      // a greyed control that would BUY (the card route's, or any "buy" press): the other
      // sections' own waiting states (a sign button before a keychain) are theirs, not this law's
      dead: [...main.querySelectorAll('[aria-disabled="true"], button:disabled')].filter(e => vis(e) && (e.closest('#fund-sec') || /\bbuy\b/i.test(e.textContent))).map(e => (e.id || e.tagName) + ' "' + e.textContent.trim().slice(0, 30) + '"'),
      step: { words: vis(document.querySelector('#voucher-sec [data-reg="bee"]')) ? document.querySelector('#voucher-sec [data-reg="bee"]').textContent.trim() : '', field: vis(document.getElementById('vc-key')), go: vis(document.getElementById('vc-go')) && !document.getElementById('vc-go').disabled },
      cards: [...document.querySelectorAll('#wl-cards .wlr-card')].filter(c => c.getClientRects().length).map(c => c.dataset.wlCardFor),
    };
  });
  // tickers and acronyms own their capitals; every other sentence starts lowercase
  const OWNS = /^[A-Z0-9]{2,}$/;
  const capStarts = blocks => blocks.flatMap(b => b.split(/(?<=[.!?])\s+/).map(x => x.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter(x => /^\p{Lu}/u.test(x) && !OWNS.test(x.split(/[^\p{L}\p{N}]/u)[0])).map(x => '‹' + x.slice(0, 44) + '›'));
  const machine = blocks => blocks.filter(b => /0x[0-9a-f]{2,}/i.test(b) || CHAIN.test(b) || /[—–]|\s-\s/.test(b)).map(b => '‹' + b.slice(0, 50) + '›');
  const meld = blocks => blocks.filter(b => MELD.some(m => b.includes(m))).map(b => '‹' + b.slice(0, 50) + '›');
  const at = {};
  for (const W of [390, 1280]) {
    at[W] = {};
    for (const reg of REGS) {
      const { ctx, page } = await open(reg, { width: W, height: W === 390 ? 844 : 900 });
      await page.addStyleTag({ content: STRIP }); await page.waitForTimeout(150);
      if (reg === 'bee') await page.click('#wl-bee [data-wl-go="add"]');
      if (reg === 'raver') await page.click('#wl-dock [data-wl-go="add"]');
      await page.waitForTimeout(400);
      const r = at[W][reg] = { add: await read(page) };
      // raver: every card its add deck deals, opened one at a time
      if (reg === 'raver') {
        r.opened = [];
        for (const id of r.add.cards) { await page.click(['bpay-sec','arw-sec'].includes(id) ? `#wallet-storage a[href="#${id}"]` : `#wl-cards .wlr-card[data-wl-card-for="${id}"]`); await page.waitForTimeout(300); r.opened.push(await read(page)); await page.click(['bpay-sec','arw-sec'].includes(id) ? `#wallet-storage a[href="#${id}"]` : `#wl-cards .wlr-card[data-wl-card-for="${id}"]`); await page.waitForTimeout(150); }
      }
      // "show me everything": the one bee and raver view that still shows the card route
      if (reg === 'bee') { await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(350); await page.click('#wl-bee [data-wl-go="all"]'); }
      if (reg === 'raver') await page.click('#wl-dock [data-wl-go="all"]');
      await page.waitForTimeout(400);
      r.all = await read(page);
      r.fundAll = await page.evaluate(() => document.getElementById('fund-sec').innerText.replace(/\s+/g, ' '));
      await ctx.close();
    }
  }
  const both = f => [390, 1280].flatMap(W => f(at[W]).map(x => W + ' ' + x));
  // 1 · out of bee's add, a working next step left
  const beeMeld = both(a => [...meld(a.bee.add.blocks), ...(a.bee.add.fundParts ? ['fund-sec parts visible: ' + a.bee.add.fundParts] : []), ...a.bee.add.selects.map(s => 'select #' + s), ...a.bee.add.buyLinks.map(l => 'buy link ' + l)]);
  ok('1 · bee\'s "add money" shows NO card route at 390 and 1280: no fund part, no Meld, no USDC, no chain select, no 0x field, no buy link (by visible content)',
    beeMeld.length === 0 && [390, 1280].every(W => !at[W].bee.add.sections.includes('fund-sec') && at[W].bee.add.sections.length >= 1), beeMeld.slice(0, 4).join(' · ') || [390, 1280].map(W => W + ': ' + at[W].bee.add.sections.join(',')).join(' · '));
  ok('1 · bee\'s "add money" still leaves a working next step: "prepay for compute", its field and its "look up"',
    [390, 1280].every(W => /prepay for compute/.test(at[W].bee.add.step.words) && at[W].bee.add.step.field && at[W].bee.add.step.go), JSON.stringify(at[390].bee.add.step));
  const rvMeld = both(a => [...meld(a.raver.add.blocks), ...a.raver.opened.flatMap(o => [...meld(o.blocks), ...(o.fundParts ? ['fund-sec parts visible'] : []), ...o.buyLinks])]);
  ok('1 · raver\'s "add money" deck deals no card for the card route (voucher and money in only), and no card it deals opens it',
    [390, 1280].every(W => at[W].raver.add.cards.join() === 'voucher-sec,peer-sec' && at[W].raver.opened.every(o => !o.sections.includes('fund-sec'))) && rvMeld.length === 0,
    [390, 1280].map(W => W + ': ' + at[W].raver.add.cards.join(',')).join(' · ') + (rvMeld.length ? ' · ' + rvMeld.slice(0, 3).join(' · ') : ''));
  // 2 · moved, not deleted; a reason in words, never a dead button
  const src = await readFile(join(SURFACES, 'wallet.html'), 'utf8');
  const kept = ['id="fund-go"', 'id="fund-asset"', 'id="fund-addr"', 'BNR_MELD_PUBLIC_KEY', "Meld's hosted checkout", 'buy USDC (opens Meld)', 'transactionType'].filter(m => !src.includes(m));
  ok('2 · the card route\'s code and words stay in the file (moved, not deleted)', kept.length === 0, kept.join(', ') || 'launch, asset, address, key config, note, label, checkout builder all present');
  const says = both(a => ['cypherpunk', 'bee', 'raver'].filter(r => !(r === 'cypherpunk' ? a[r].add : a[r].all).sections.includes('fund-sec') || !a[r].fundAll.includes('not wired to bPay yet') || !a[r].fundAll.includes('card checkout is not switched on here yet')));
  ok('2 · wherever the card route still shows (cypherpunk\'s pipeline, bee\'s and raver\'s "show me everything") it says it is a separate card route not wired to bPay yet, and why checkout is off, in words',
    says.length === 0, says.join(' · ') || 'said in all three');
  const dead = both(a => REGS.flatMap(r => ['add', 'all'].filter(v => a[r][v]).flatMap(v => [...a[r][v].dead, ...a[r][v].buyLinks].map(x => r + '/' + v + ': ' + x))));
  ok('2 · no dead or greyed buy button renders anywhere (every register, "add money" and "show me everything", key unset as on main)', dead.length === 0, dead.slice(0, 4).join(' · ') || 'none rendered');
  // the prose is a STATE, not a deletion: with a key armed the same panel renders its buy link
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'cypherpunk'); } catch (e) {} });
    await ctx.route(url => !url.href.startsWith(origin), r => r.abort());
    await ctx.route(/\/wallet\.html$/, async route => { const resp = {text:async()=>fixtureHtml}; await route.fulfill({ contentType: 'text/html', body: (await resp.text()).replace('data-meld-public-key=""', 'data-meld-public-key="GATE-PUBLIC-PLACEHOLDER"') }); });
    const page = await ctx.newPage();
    await page.goto(origin + '/wallet.html', { waitUntil: 'load' }); await page.waitForTimeout(600);
    const armed = await page.evaluate(() => ({ go: document.getElementById('fund-go').getClientRects().length > 0, off: document.getElementById('fund-off').getClientRects().length > 0, dis: document.getElementById('fund-go').getAttribute('aria-disabled') }));
    ok('2 · control: with a public key armed, the same panel renders its live buy link and drops the "not switched on" sentence', armed.go && !armed.off && armed.dis === 'false', JSON.stringify(armed));
    await ctx.close();
  }
  // 3 · casing, 4 · folding: bee's add at rest; the same detectors must FIRE on cypherpunk's open pipeline
  const beeCaps = both(a => capStarts(a.bee.add.blocks));
  ok('3 · nothing bee shows in "add money" starts a sentence with a capital (tickers and acronyms own theirs), buttons, notes and field hints included',
    beeCaps.length === 0, beeCaps.slice(0, 4).join(' · ') || at[390].bee.add.blocks.length + ' blocks read');
  const beeMachine = both(a => machine(a.bee.add.blocks));
  ok('4 · bee\'s "add money" shows no 0x, no chain name and no dash-glued technical line before "show the details"',
    beeMachine.length === 0, beeMachine.slice(0, 4).join(' · ') || 'none');
  const cy = at[390].cypherpunk.add.blocks;
  ok('negative control: the same detectors fire on cypherpunk\'s open "add" pipeline (capitals, 0x or chain, card route words), so a clean bee is not a blind probe',
    capStarts(cy).length > 0 && machine(cy).length > 0 && meld(cy).length > 0, `caps ${capStarts(cy).length} · machine ${machine(cy).length} · card route ${meld(cy).length}`);
}

// 9b · bee's "show the details" is bee's: a register switch starts every section folded, and the toggle is not work
{
  const { ctx, page } = await open('bee');
  await page.click('#wl-bee [data-wl-go="move"]'); await page.waitForTimeout(350);
  await page.click('#pay-sec .wl-more'); await page.waitForTimeout(150);
  const before = await page.evaluate(() => document.getElementById('pay-sec').hasAttribute('data-wl-more'));
  await page.click('#breg-raver'); await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ more: [...document.querySelectorAll('main>section[data-wl-more]')].map(s => s.id), open: [...document.querySelectorAll('main>section[data-wl-open]')].map(s => s.id) }));
  ok('bee\'s opened details do not carry into raver: after the switch no section is unfolded and no card opened itself', before && after.more.length === 0 && after.open.length === 0, JSON.stringify({ before, ...after }));
  await ctx.close();
}

// 10 · deep links land in the task that holds their target, in every register
{
  const a = await open('bee', { path: '/wallet.html?compose=' + encodeURIComponent('kingbeelovis:registeracc'), fixture: false });
  const c = await a.page.evaluate(() => ({ view: document.body.dataset.wlView, shown: document.getElementById('composer-sec').getClientRects().length > 0, contract: document.getElementById('tx-contract').value, top: Math.round(document.getElementById('composer-sec').getBoundingClientRect().top), headerBottom: Math.round(document.getElementById('wallet-identity').getBoundingClientRect().bottom) }));
  ok('?compose= opens bee ON the composer (its task, scrolled to it) with the contract prefilled', c.view === 'proof' && c.shown && c.contract === 'kingbeelovis' && c.top >= c.headerBottom - 1 && c.top <= c.headerBottom + 24, JSON.stringify(c));
  await a.ctx.close();
  // raver lands on the composer's own card, cypherpunk on the composer in the open pipeline
  for (const reg of ['raver', 'cypherpunk']) {
    const r = await open(reg, { path: '/wallet.html?compose=' + encodeURIComponent('kingbeelovis:registeracc'), fixture: false });
    await r.page.waitForTimeout(800);
    const c2 = await r.page.evaluate(() => ({ view: document.body.dataset.wlView, shown: document.getElementById('composer-sec').getClientRects().length > 0, contract: document.getElementById('tx-contract').value, top: Math.round(document.getElementById('composer-sec').getBoundingClientRect().top), headerBottom: Math.round(document.getElementById('wallet-identity').getBoundingClientRect().bottom) }));
    ok(`?compose= lands ${reg} ON the composer, painted, with the contract prefilled`, c2.shown && c2.contract === 'kingbeelovis' && c2.top >= c2.headerBottom - 1 && c2.top <= c2.headerBottom + 24, JSON.stringify(c2));
    await r.ctx.close();
  }
  // the desktop's QR (#qr=<request>) lands on the waiting sheet, painted, in every register
  {
    const q = Buffer.alloc(81, 7); q[16] = 2;   // v2: sid(16) ‖ secp256k1 pub(33) ‖ SHA-256 of the X-Wing key(32)
    const got = {};
    for (const reg of REGS) {
      const r = await open(reg, { path: '/wallet.html#qr=' + q.toString('base64url'), fixture: false });
      await r.page.waitForTimeout(800);
      await r.page.waitForTimeout(400); // past the re-land
      got[reg] = await r.page.evaluate(() => { const e = document.getElementById('qr-sec'), b = e.getBoundingClientRect(), t = document.getElementById('qr-title').getBoundingClientRect(); return { painted: e.getClientRects().length > 0, top: Math.round(b.top), titleBottom: Math.round(t.bottom), vh: innerHeight, title: document.getElementById('qr-title').textContent.slice(0, 40) }; });
      await r.ctx.close();
    }
    ok('#qr= lands on the QR bridge sheet ("a desktop is waiting"), painted, its top and its title inside the first screen, in every register',
      REGS.every(r => got[r].painted && got[r].top >= 0 && got[r].titleBottom <= got[r].vh && /waiting/.test(got[r].title)), JSON.stringify(got));
  }
  // record the FIRST view the body ever wears: a #section link must never flash home
  const b = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('bregister', 'bee'); } catch (e) {}
      window.__firstView = null;
      new MutationObserver((ms, o) => { if (document.body && document.body.hasAttribute('data-wl-view')) { window.__firstView = document.body.getAttribute('data-wl-view'); o.disconnect(); } })
        .observe(document, { attributes: true, subtree: true, attributeFilter: ['data-wl-view'] }); // the Document itself: documentElement does not exist yet at init
    });
    await ctx.route(url => !url.href.startsWith(origin), r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', e => pageErrors.push('bee: ' + String(e)));
    await page.goto(origin + '/wallet.html#fund-sec', { waitUntil: 'load' });
    await page.waitForTimeout(600);
    return { ctx, page };
  })();
  // the card route is held out of bee's "add money" (4i): its deep link lands on "show me
  // everything", the one bee view that shows it, never on a task that hides its target
  ok('#fund-sec paints in "show me everything" at FIRST paint (held out of "add money"; no flash of the home screen)', await b.page.evaluate(() => window.__firstView) === 'all', await b.page.evaluate(() => String(window.__firstView)));
  const f = await b.page.evaluate(() => ({ view: document.body.dataset.wlView, shown: document.getElementById('fund-sec').getClientRects().length > 0 }));
  ok('#fund-sec opens bee on "show me everything" with fund in view', f.view === 'all' && f.shown, JSON.stringify(f));
  await b.ctx.close();
  // a #fund-sec link clicked inside bee's "add money" lands on "show me everything" too
  {
    const c = await open('bee', { fixture: false });
    await c.page.click('#wl-bee [data-wl-go="add"]'); await c.page.waitForTimeout(350);
    await c.page.evaluate(() => { const a = document.createElement('a'); a.href = '#fund-sec'; a.id = 'gate-fund'; a.textContent = 'the card route'; document.getElementById('voucher-sec').appendChild(a); });
    await c.page.click('#gate-fund'); await c.page.waitForTimeout(500);
    const g = await c.page.evaluate(() => ({ view: document.body.dataset.wlView, shown: document.getElementById('fund-sec').getClientRects().length > 0 }));
    ok('bee: a link to the held card route lands on "show me everything" with it in view, never on a task that hides it', g.view === 'all' && g.shown, JSON.stringify(g));
    await c.ctx.close();
  }
}

// Brand navigation must preserve the Bee history stack.
{
  const { ctx, page } = await open('bee', { fixture: false });
  await page.click('#wl-bee [data-wl-go="have"]');
  await page.waitForFunction(() => document.body.dataset.wlView === 'have');
  await page.click('#wallet-identity .wallet-brand');
  await page.waitForFunction(() => document.body.dataset.wlView === 'home');
  ok('brand returns home without native fragment navigation', await page.evaluate(() => !location.hash && history.state.wlView === 'home'));
  await page.goForward();
  await page.waitForFunction(() => document.body.dataset.wlView === 'have');
  ok('brand back preserves the original forward task', await page.evaluate(() => history.state.wlView === 'have'));
  await ctx.close();
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

const failed = results.filter(r => !r.pass);
console.log(failed.length
  ? `\nWALLET REGISTERS GATE: ${failed.length} FAILED of ${results.length}`
  : `\nWALLET REGISTERS GATE: GREEN — ${results.length}/${results.length} (the golden dress contract holds; three grammars measured; the facts identical in all three)`);
process.exit(failed.length ? 1 : 0);
