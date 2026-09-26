// profile-caps.mjs — z2.b: .b/.a/SP capability integration on BOTH profile surfaces.
//
// What this proves (each check is a regression against a defect that would
// otherwise ship):
//   D1 dynasty carries the fleet rail + register toggle (it had NEITHER — the
//      surface was the only root profile without tour.js/agent-dock).
//   D2 the register toggle actually swaps rails prose (bee/raver/cypherpunk).
//   D3 the silent-payments card is the UNCONFIGURED state, exactly per the
//      blueprint's acceptance contract: title says "coming soon", contains no
//      sp1 string, no QR/canvas/img, nothing interactive inside.
//   D4 the live registry checker answers HELD for a real row (king) with
//      owner/account/expiry, and "not on the registry today" for an absent one.
//   D5 the .a suffix rides the same row (king.a → HELD, rail .a).
//   H1 the holder surface loads with zero page errors and its caps panel shows
//      the same SP unconfigured shape.
//   H2 the address book resolves king.b → "Vaulta b name · resolves to kingbeelovis".
//   H3 an absent name (zzznope.b) stays as-written with the honest note.
//   H4 bclaude.a is NOT on the registry today — the page says so (live truth,
//      not lore) — this is the finding the dispatch flags for the founder.
//   H5 no key-shaped strings anywhere; the book stores only what was typed +
//      the resolved public account.
//   S* 390px screenshots in all three registers on both surfaces + desktop.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') + '../surfaces';
const SHOTS = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') + 'shots-profile-caps';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = createServer(async (req, res) => {
  try {
    /* tour.js derives its asset root from the PATH (/surfaces/...), so the
       harness serves the surfaces dir under that prefix and strips it here. */
    const p = decodeURIComponent(req.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '');
    const b = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
await mkdir(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, note = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}${note ? ' — ' + note : ''}`); c ? pass++ : fail++; };
const errs = page => { const a = []; page.on('pageerror', e => a.push(String(e))); return a; };

const browser = await chromium.launch();

// ═══ D — the dynasty profile (surfaces/profile.html) ═══
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const E = errs(page);
  await page.goto(`${base}/surfaces/profile.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  ok('D1a dynasty rides the fleet rail (#tbar)', await page.locator('#tbar').count() === 1);
  ok('D1b register toggle mounted (#bregctl)', await page.locator('#bregctl').count() === 1);
  ok('D1c zero page errors', E.length === 0, E.join(' | ') || 'clean');

  const vis = reg => page.evaluate(r => {
    const show = document.body.getAttribute('data-reg');
    const el = document.querySelector(`.capintro[data-reg="${r}"]`);
    return { active: show === r, seen: !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none' };
  }, reg);
  ok('D2a default register is bee', (await vis('bee')).active);
  ok('D2b bee intro visible', (await vis('bee')).seen);
  await page.click('#breg-raver'); await page.waitForTimeout(150);
  ok('D2c raver swap', (await vis('raver')).active && (await vis('raver')).seen && !(await vis('bee')).seen);
  await page.click('#breg-cypherpunk'); await page.waitForTimeout(150);
  ok('D2d cypherpunk swap', (await vis('cypherpunk')).active && (await vis('cypherpunk')).seen);

  const sp = page.locator('.cap.soon');
  const spTxt = (await sp.innerText()).toLowerCase();
  ok('D3a SP card says coming soon', spTxt.includes('coming soon'));
  ok('D3b SP card invents no address (no address-shaped run — prose may NAME sp1q)', !/sp1[a-z0-9]{30,}/.test(spTxt));
  ok('D3c SP card has no QR/canvas/img', await sp.locator('canvas,img,svg').count() === 0);
  ok('D3d SP card has nothing interactive', await sp.locator('button,input,a').count() === 0);
  ok('D3e SP card carries the never-law', spTxt.includes('never invents') && spTxt.includes('never scans'));

  await page.fill('#rail-name', 'king');
  await page.click('#rail-go');
  await page.waitForFunction(() => /HELD|couldn/.test(document.getElementById('rail-verdict').textContent), null, { timeout: 15000 });
  const v1 = await page.locator('#rail-verdict').innerText();
  ok('D4a king → HELD with owner + expiry', v1.includes('HELD') && v1.includes('kingbeelovis') && v1.includes('2027-08-01'), v1.slice(0, 90));

  await page.fill('#rail-name', 'zzznotaname');
  await page.click('#rail-go');
  await page.waitForFunction(() => /not on the registry|couldn/.test(document.getElementById('rail-verdict').textContent), null, { timeout: 15000 });
  const v2 = await page.locator('#rail-verdict').innerText();
  ok('D4b absent name → honest not-on-registry', v2.includes('not on the registry'), v2.slice(0, 90));

  await page.fill('#rail-name', 'king.a');
  await page.click('#rail-go');
  await page.waitForFunction(() => /HELD|couldn/.test(document.getElementById('rail-verdict').textContent), null, { timeout: 15000 });
  const v3 = await page.locator('#rail-verdict').innerText();
  ok('D5 king.a rides the same row (.a rail)', v3.includes('king.a') && v3.includes('HELD'), v3.slice(0, 90));

  const body = (await page.content()).toLowerCase();
  /* key-SHAPED strings, not key WORDS: the merged page lawfully says "seed phrase"
     (key/name separation law) and carries sha256 crest digests that are marked
     PUBLIC-CONSTANT at their source constant — the disclosure manifest then
     machine-renders the SAME digests into the DOM as plain JSON. Hex law honored:
     every hex run in the DOM must either sit on a marked line or be one of the
     marked digests re-rendered. */
  const hexAudit = await page.evaluate(() => {
    const lines = document.documentElement.innerHTML.split('\n');
    const marked = new Set(lines.filter(l => /PUBLIC-CONSTANT/.test(l))
      .flatMap(l => (l.match(/[0-9a-fA-F]{48,}/g) || [])));
    return lines.filter(l => /[0-9a-fA-F]{48,}/.test(l) && !/PUBLIC-CONSTANT/.test(l))
      .flatMap(l => (l.match(/[0-9a-fA-F]{48,}/g) || []))
      .filter(h => !marked.has(h)).length; });
  ok('H5a (dynasty) no key-shaped strings, no unmarked hex',
    !/xprv[1-9A-HJ-NP-Za-km-z]{20,}/.test(body) && hexAudit === 0, hexAudit + ' unknown hex run(s)');

  await page.screenshot({ path: `${SHOTS}/dynasty-cypherpunk-1440.png`, fullPage: true });
  await ctx.close();
}

// ═══ 390px × three registers — dynasty ═══
for (const reg of ['bee', 'raver', 'cypherpunk']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(r => localStorage.setItem('bregister', r), reg);
  const page = await ctx.newPage();
  const E = errs(page);
  await page.goto(`${base}/surfaces/profile.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const active = await page.evaluate(() => document.body.getAttribute('data-reg'));
  await page.screenshot({ path: `${SHOTS}/dynasty-${reg}-390.png`, fullPage: true });
  ok(`S1 dynasty ${reg} @390 renders in-register`, active === reg && E.length === 0, E.join(' | '));
  await ctx.close();
}

// ═══ H — the holder profile (surfaces/blight/profile.html) ═══
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const E = errs(page);
  await page.goto(`${base}/surfaces/blight/profile.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  ok('H1a holder loads clean', E.length === 0, E.join(' | ') || 'clean');
  ok('H1b caps panel present', await page.locator('#caps').count() === 1);

  const sp = page.locator('.cap.soon');
  const spTxt = (await sp.innerText()).toLowerCase();
  ok('H1c SP card unconfigured on holder', spTxt.includes('coming soon') && !/sp1[a-z0-9]{30,}/.test(spTxt) &&
    await sp.locator('button,input,canvas,img').count() === 0);

  await page.click('#breg-raver'); await page.waitForTimeout(150);
  const raverSeen = await page.evaluate(() => {
    const el = document.querySelector('.cap.soon [data-reg="raver"]');
    return !!el && getComputedStyle(el).display !== 'none';
  });
  ok('H1d holder register swap (raver SP body)', raverSeen);

  // — the book: .b resolves live, .a absent stays honest —
  const add = async (label, value) => {
    await page.fill('#b-label', label);
    await page.fill('#b-val', value);
    await page.click('#b-add');
  };
  await add('the king himself', 'king.b');
  await page.waitForFunction(() => {
    const e = document.querySelectorAll('#b-list .entry')[0];
    return e && /resolves to|not on the registry|could not be reached/.test(e.textContent);
  }, null, { timeout: 20000 });
  const e1 = await page.locator('#b-list .entry').first().innerText();
  ok('H2 king.b resolves to the kingbeelovis account', e1.includes('Vaulta b name') && e1.includes('kingbeelovis'), e1.replace(/\n/g, ' · ').slice(0, 110));

  await add('a name that is not there', 'zzznope.b');
  await page.waitForFunction(() => document.querySelectorAll('#b-list .entry').length === 2 &&
    /not on the kingbeelovis registry|could not be reached/.test(document.querySelectorAll('#b-list .entry')[1].textContent), null, { timeout: 20000 });
  const e2 = (await page.locator('#b-list .entry').nth(1).innerText());
  ok('H3 absent .b stays as-written with the honest note', e2.includes('kept as written') && e2.includes('zzznope.b'), e2.replace(/\n/g, ' · ').slice(0, 110));

  await add('the agent', 'bclaude.a');
  await page.waitForFunction(() => document.querySelectorAll('#b-list .entry').length === 3 &&
    /not on the kingbeelovis registry|could not be reached/.test(document.querySelectorAll('#b-list .entry')[2].textContent), null, { timeout: 20000 });
  const e3 = (await page.locator('#b-list .entry').nth(2).innerText());
  ok('H4 bclaude.a — live truth: not on the registry today', e3.includes('not on the kingbeelovis registry'), e3.replace(/\n/g, ' · ').slice(0, 110));

  const book = await page.evaluate(() => JSON.parse(localStorage.getItem('holder-book-v1') || '[]'));
  ok('H5 book stores only the typed words + public resolution',
    book.length === 3 && book[0].resolved && book[0].resolved.addr === 'kingbeelovis' &&
    !JSON.stringify(book).match(/xprv|mnemonic|bip39|seed/i));

  await page.click('#breg-bee');
  await page.screenshot({ path: `${SHOTS}/holder-bee-1440.png`, fullPage: true });
  await ctx.close();
}

// ═══ 390px × three registers — holder ═══
for (const reg of ['bee', 'raver', 'cypherpunk']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(r => localStorage.setItem('bregister', r), reg);
  const page = await ctx.newPage();
  const E = errs(page);
  await page.goto(`${base}/surfaces/blight/profile.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const active = await page.evaluate(() => document.body.getAttribute('data-reg'));
  await page.screenshot({ path: `${SHOTS}/holder-${reg}-390.png`, fullPage: true });
  ok(`S2 holder ${reg} @390 renders in-register`, active === reg && E.length === 0, E.join(' | '));
  await ctx.close();
}

// ═══ V — vending: the canonical .a surface, payment copy now tells the truth ═══
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const E = errs(page);
  await page.goto(`${base}/surfaces/vending.html`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  ok('V1a vending loads with zero page errors', E.length === 0, E.join(' | ') || 'clean');
  const note = (await page.locator('section.card[aria-label="the price, all of it"] .note').first().innerText());
  ok('V1b card/PayPal marked NOT AVAILABLE', note.includes('Card and PayPal are not available'));
  ok('V1c USDC/PYUSD marked HELD', note.includes('held') && /USDC on Base/.test(note) && /PYUSD/.test(note));
  ok('V1d the old unqualified pay line is gone', !note.includes('Pay with your card, PayPal, or any wallet'));
  const rails = (await page.locator('#vrails').innerText());
  const heldCount = (rails.match(/held/gi) || []).length;
  ok('V2 both money rails say held at the label', heldCount >= 2 && rails.includes('until the founder names the seat'));
  ok('V2b PYUSD not-a-PayPal-checkout wording rides', rails.includes('Not a PayPal checkout'));
  await page.screenshot({ path: `${SHOTS}/vending-bee-1440.png`, fullPage: true });
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const E = errs(page);
  await page.goto(`${base}/surfaces/vending.html`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/vending-bee-390.png`, fullPage: true });
  ok('V3 vending @390 clean', E.length === 0, E.join(' | '));
  await ctx.close();
}

// ═══ P — five separate cards, boundaries and links, on both surfaces ═══
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const [name, url, vendingHref, bnrPath, ercHref] of [
    ['dynasty', '/surfaces/profile.html', 'vending.html', '/r/index.html', 'blight/profile.html'],
    ['holder', '/surfaces/blight/profile.html', '../vending.html', '/r/index.html', null],
  ]) {
    const page = await ctx.newPage();
    const E = errs(page);
    await page.goto(`${base}${url}`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.capgrid .cap')].map(c => c.innerText));
    ok(`P1 ${name}: five separate capability cards`, cards.length === 5, cards.length + ' found');
    ok(`P1b ${name}: exactly one coming-soon card (SP)`,
      await page.locator('.capgrid .cap.soon').count() === 1);
    const aCard = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.capgrid .cap')].find(x => /\.a\b/.test(x.querySelector('h3').textContent));
      return { txt: c.innerText, href: c.querySelector('a[href*="vending.html"]')?.getAttribute('href') };
    });
    ok(`P2a ${name}: .a card deep-links vending`, aCard.href === vendingHref, aCard.href || 'no link');
    ok(`P2b ${name}: boundary rides verbatim`, /rehearsal today/.test(aCard.txt) && /testnet money, real law rows/.test(aCard.txt));
    const bnr = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.capgrid .cap')].find(x => /bnr:\/\//.test(x.querySelector('h3').textContent));
      const h = c.querySelector('a[href*="r/index.html"]')?.getAttribute('href');
      return { path: h ? new URL(h, location.href).pathname : null };
    });
    ok(`P3a ${name}: bnr:// card links the resolver`, bnr.path === bnrPath, bnr.path || 'no link');
    const erc = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.capgrid .cap')].find(x => /ERC20i/.test(x.querySelector('h3').textContent));
      /* textContent, not innerText: the JEDI law line lives in the cypherpunk
         register block, hidden (but present) under the default bee register */
      return { txt: c.textContent, href: c.querySelector('a')?.getAttribute('href') };
    });
    ok(`P3b ${name}: ERC20i card, JEDI law intact`, /ERC20i/.test(erc.txt) && /profile reads; the market sells/.test(erc.txt));
    if (ercHref) ok(`P3c ${name}: ERC20i card links the holder wall`, erc.href === ercHref, erc.href || 'no link');
    ok(`P4 ${name}: SP copy never claims (no balance/receipt words in the soon card)`,
      !/balance|received|confirmed/i.test((await page.locator('.capgrid .cap.soon').innerText())));
    ok(`P5 ${name}: still zero page errors`, E.length === 0, E.join(' | ') || 'clean');
    await page.close();
  }
  await ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
