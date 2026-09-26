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
        sections: [...document.querySelectorAll('main>section[data-wl-task]')].filter(inFirst).map(s => s.id),
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
ok('cypherpunk arrives with the whole pipeline open (18 sections, every note) and its console among them',
  arr.cypherpunk.visibleSections >= 18 && arr.cypherpunk.own.cypherpunk && !arr.cypherpunk.own.bee && !arr.cypherpunk.own.raver &&
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
  k('cypherpunk').rows === 0 && k('cypherpunk').art === 0 && k('cypherpunk').sections.includes('bal-sec'),
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
  // a Back into an entry the pre-reload document pushed is a full load: wait for the view, bounded
  await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForFunction(() => document.body && document.body.dataset.wlView === 'home', null, { timeout: 5000 }).catch(() => {});
  ok('bee: a reload keeps the stack index; "‹ wallet" then pops home (no dead Back press)',
    reloaded.view === 'key' && reloaded.idx === 1 && await page.evaluate(() => document.body.dataset.wlView) === 'home',
    JSON.stringify(reloaded) + ' → ' + JSON.stringify(await page.evaluate(() => ({ view: document.body.dataset.wlView, state: history.state, len: history.length, url: location.pathname + location.hash }))));
  await ctx.close();
}
{
  const src = await readFile(join(SURFACES, 'wallet.html'), 'utf8');
  // EVERY user-facing "above"/"below" (comments stripped) must be on this
  // reviewed list: each points WITHIN its own section or task, in the task's
  // own order, so it is true in every register. A new one fails until someone
  // reviews it: across tasks, a message names its target as a link instead.
  const REVIEWED = [
    ['the glyphs above open each part', 'raver stage: the dock sits above it'],
    ['more as you forge below', 'keychain → key forge, same task, after it'],
    ['paste it once below', 'within the keychain'],
    ['Any device in the list above', 'within the vault'],
    ['connect your keychain above to see your derived keys', 'key forge ← keychain, same task, before it'],
    ['orge new ones below', 'within the key forge'],
    ['(live price below)', 'within the account forge'],
    ['addresses below are yours to hand out', 'within pay'],
    ['Each address above falls out of the', 'within pay'],
    ['choose a lane above', 'within pay'],
    ['(rate cited below)', 'within the voucher'],
    ['The key in the config below is', 'within fund'],
    ['its Base address below is a bare', 'within fiat in'],
    ['data block below the fold', 'the chain matrix names its own source-code data block'],
    ['phrases belong in the recovery lane above', 'bridge/vault paste ← keychain recovery, same task, before it'],
    ['no contexts yet — forge one below', 'within the key forge'],
    ['NOT YET on chain — bridge below', 'keychain → bridge, same task, after it'],
    ['use the recovery lane below', 'within the keychain'],
    ['open the public link in the banner above', 'the origin banner heads main in every view'],
    ['create one here, or use recovery below', 'within the keychain'],
    ['the Vaulta tx passkey lane below', 'keychain → account forge passkey, same task, after it'],
    ['(passkey above or recovery below)', 'within the keychain (the QR bridge)'],
    ['first (above)', 'account forge ← bridge, same task, before it'],
    ['(the 12-char test actor above)', 'within the composer'],
    ['the TESTNET key you paste below', 'within the composer'],
    ['Raise or clear it above', 'within pay (the spend cap)'],
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
  // EVERY deck, on a phone: the first thing under the dock is art, never a section
  const leads = {};
  for (const go of ['have', 'move', 'add', 'keep', 'key', 'proof', 'all']) {
    await page.click(`#wl-dock [data-wl-go="${go}"]`); await page.waitForTimeout(250);
    leads[go] = await page.evaluate(() => {
      const first = [...document.querySelectorAll('main>*')].filter(e => e.getClientRects().length && e.id !== 'wl-dock').sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      const g = [...document.querySelectorAll('#wl-deck [data-wl-for]')].filter(s => s.getClientRects().length).map(s => s.textContent).join();
      return (first && first.id) + (g ? ':' + g : '');
    });
  }
  ok('raver: EVERY deck opens on art before any section (have on the stage, the rest on their lit glyph)',
    leads.have === 'wl-rave' && ['move', 'add', 'keep', 'key', 'proof', 'all'].every(g => leads[g].startsWith('wl-deck:')), JSON.stringify(leads));
  await page.click('#wl-dock [data-wl-go="add"]'); await page.waitForTimeout(600);
  const filled = async () => page.evaluate(() => {
    const probe = document.createElement('i'); probe.style.color = getComputedStyle(document.body).getPropertyValue('--reg-primary').trim(); document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color; probe.remove();
    return [...document.querySelectorAll('main>section[data-wl-task] button')].filter(b => b.getClientRects().length && getComputedStyle(b).backgroundColor === rgb).map(b => b.id || b.textContent.trim().slice(0, 20));
  });
  await page.click('#wl-dock [data-wl-go="move"]'); await page.waitForTimeout(600);
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
    idx.length === 19 && live.every(i => i.h >= 44) && live.length === 18 && !idx.find(i => i.sec === 'bridge-sec').shown,
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
  const landed = await page.evaluate(() => Math.round(document.getElementById('fund-sec').getBoundingClientRect().top));
  ok('cypherpunk: an index row lands on its section', landed >= 0 && landed < 40, 'top ' + landed + 'px');
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
    if (reg === 'bee') {
      // a CONNECTED reader whose read is still in flight sees the read's own state, never "connect your name"
      seen.bee.soul = await page.evaluate(() => {
        document.getElementById('v-bal').textContent = ''; window.wlRead(document.getElementById('v-stat'), true);
        document.getElementById('v-stat').textContent = 'reading…'; document.body.setAttribute('data-wl-soul', 'true');
        return new Promise(r => setTimeout(() => {
          const vis = sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => e.textContent.trim());
          r({ connect: vis('#wl-bee .wlb-connect'), stat: vis('#wl-bee .wlb-stat') });
        }, 100));
      });
    }
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
  ok('bee: a connected reader whose read is in flight sees "reading…", never "connect your name"',
    seen.bee.soul.connect.length === 0 && seen.bee.soul.stat.join() === 'reading…', JSON.stringify(seen.bee.soul));
  ok('a failed LATER read keeps its old figure but says so in every register, and its rail goes dark',
    REGS.every(r => seen[r].stale.figs.length === 1 && seen[r].stale.said.length === 1 && seen[r].stale.said[0].length > 5 && seen[r].stale.lit === 'false'),
    REGS.map(r => r + ':' + seen[r].stale.said.join()).join(' · '));
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
    els.forEach(el => {
      if (!el.getClientRects().length) return;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      const where = { t: own.slice(0, 30), sec: el.closest('section').id };
      if (own === '—' || own === '-') dash.push(where);
      if (parseFloat(cs.fontSize) < 14) small.push({ ...where, px: parseFloat(cs.fontSize) });
      if (el.closest('[aria-disabled="true"],:disabled')) return; // inactive controls are exempt (WCAG 1.4.3)
      // SVG text paints with FILL, never color: measure what is actually painted
      const fg = parse(el instanceof SVGElement ? cs.fill : cs.color), bg = bgOf(el); if (!fg || !bg) return;
      const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      const min = parseFloat(cs.fontSize) >= 18.66 || (parseFloat(cs.fontSize) >= 14 && parseInt(cs.fontWeight, 10) >= 700) ? 3 : 4.5;
      if (ratio < min) out.push({ ...where, ratio: Math.round(ratio * 100) / 100, pair: (el instanceof SVGElement ? cs.fill : cs.color) + ' on ' + `rgb(${bg.r}, ${bg.g}, ${bg.b})` });
    });
    return { out, small, dash };
  });
  const low = {}, audit = {};
  for (const reg of REGS) {
    const { ctx, page } = await open(reg);
    await page.evaluate(() => { document.body.setAttribute('data-wl-view', 'all'); });
    await page.waitForTimeout(700);
    audit[reg] = await contrast(page);
    low[reg] = audit[reg].out;
    await ctx.close();
  }
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
  ok('every one of the 19 sections belongs to a task a bee row and a raver glyph can open', reach.n === 19 && reach.orphans.length === 0, reach.orphans.join(', '));
  const map = await page.evaluate(() => {
    const dom = Object.fromEntries([...document.querySelectorAll('main>section[data-wl-task]')].map(s => [s.id, s.dataset.wlTask]));
    const early = window.WL_TASK_OF || {};
    const drift = Object.keys(dom).filter(k => dom[k] !== early[k]).concat(Object.keys(early).filter(k => !(k in dom)));
    return { drift };
  });
  ok('the first-paint task map and the sections\' own data-wl-task attributes agree (no drift)', map.drift.length === 0, map.drift.join(', '));
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
  const place = await page.evaluate(() => Math.round(document.getElementById('connect-sec').getBoundingClientRect().top));
  ok('and back in cypherpunk the reader is placed at that task\'s first section', place >= 0 && place < 60, 'connect top ' + place + 'px');
  await ctx.close();
}

// 10 · deep links land in the task that holds their target, in bee
{
  const a = await open('bee', { path: '/wallet.html?compose=' + encodeURIComponent('kingbeelovis:registeracc'), fixture: false });
  const c = await a.page.evaluate(() => ({ view: document.body.dataset.wlView, shown: document.getElementById('composer-sec').getClientRects().length > 0, contract: document.getElementById('tx-contract').value, top: Math.round(document.getElementById('composer-sec').getBoundingClientRect().top) }));
  ok('?compose= opens bee ON the composer (its task, scrolled to it) with the contract prefilled', c.view === 'proof' && c.shown && c.contract === 'kingbeelovis' && c.top >= 0 && c.top < 120, JSON.stringify(c));
  await a.ctx.close();
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
  ok('#fund-sec paints in "add money" at FIRST paint (no flash of the home screen)', await b.page.evaluate(() => window.__firstView) === 'add', await b.page.evaluate(() => String(window.__firstView)));
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
