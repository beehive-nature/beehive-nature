// zcode-u123-check.mjs - Listening U1/U2/U3 proof, measured on the rendered
// page at 390x844 like the comps were. U3: a 44px in-page road back to Music
// exists under the register bar (Browser Back is not the only door). U2: the
// 11px wall is gone - body/lede 16px, meta lines 14px, every control a 44px
// target. U1: play stays first; provenance and doctrine ride the estate
// details[data-reg-disclose] pattern (collapsed for the default register, one
// tap open, cypherpunk open by canon) instead of sitting 1027-1517px down;
// nothing is removed - the full text stays in the DOM behind the summary.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const server = createServer(async (req, res) => {
  try {
    const file = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (label, condition, note='') => { if (condition) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label}${note ? ` - ${note}` : ''}`); } };

async function fresh(reg) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (reg) await context.addInitScript(r => localStorage.setItem('bregister', r), reg);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/net::ERR_/.test(message.text())) errors.push(message.text()); });
  await page.goto(`${base}/surfaces/listening.html`);
  // settled state, or the number is a lie: register bar mounted (it lands
  // after load via tour.js), fonts ready, one paint beat for the i18n swap.
  // earned 2026-09-20: the delivery-time ~790px was read pre-settle; live
  // read 889px. the instrument must agree with the live page.
  await page.waitForSelector('#bregbar', { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { context, page, errors };
}
const box = (page, sel) => page.locator(sel).boundingBox();
const px = v => Math.round(parseFloat(v));

// 1 · U3 - the road back, and where it sits
{
  const { context, page, errors } = await fresh();
  const link = page.locator('nav.back a[data-i18n="music.back"]');
  ok('u3: the Music road exists and is keyed for every tongue', await link.count() === 1);
  ok('u3: it points at music.html (the page that links here)', (await link.getAttribute('href')) === 'music.html');
  const lb = await box(page, 'nav.back a');
  ok('u3: it is a 44px target', lb && lb.height >= 44, lb ? `height ${lb.height}` : 'no box');
  const nb = await box(page, 'nav.back');
  const ih1 = await page.evaluate(() => window.innerHeight);
  ok('u3: it sits on the first screen (under the register bar)', nb && nb.y + nb.height <= ih1, nb ? `bottom ${Math.round(nb.y + nb.height)}` : 'no box');
  ok('u3: the register bar mounted (sibling chrome intact)', await page.locator('#bregctl').count() === 1);
  await page.waitForSelector('#bregbar');
  const order = await page.evaluate(() => {
    const bar = document.getElementById('bregbar'), nav = document.querySelector('nav.back'), h = document.querySelector('header');
    return { barBeforeNav: !!(bar.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING),
             navBeforeHeader: !!(nav.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  ok('u3: DOM order is register bar -> back nav -> header', order.barBeforeNav && order.navBeforeHeader, JSON.stringify(order));
  ok('u3: no page errors', errors.length === 0, errors.join('; '));
  await context.close();
}

// 2 · U2 - the 11px wall is gone; every control a 44px target
{
  const { context, page } = await fresh();
  const style = async (sel, prop) => await page.locator(sel).first().evaluate((el, p) => getComputedStyle(el)[p], prop);
  ok('u2: body text is 16px (was 13)', px(await style('body', 'fontSize')) >= 16);
  ok('u2: the lede is 16px (was the 11px wall)', px(await style('header p', 'fontSize')) >= 16);
  ok('u2: law lines are 14px (was 10)', px(await style('.law', 'fontSize')) >= 14);
  ok('u2: the status line is 14px (was 10.5)', px(await style('#now', 'fontSize')) >= 14);
  ok('u2: the provenance table is 14px (was 10.5)', px(await style('table', 'fontSize')) >= 14);
  const pb = await box(page, '#play');
  ok('u2: play is a 44px target', pb && pb.height >= 44, pb ? `height ${pb.height}` : 'no box');
  const sb = await box(page, '#seed');
  ok('u2: the seed field is a 44px target', sb && sb.height >= 44, sb ? `height ${sb.height}` : 'no box');
  const ow = await page.evaluate(() => document.documentElement.scrollWidth);
  ok('u2: no horizontal overflow at 390px', ow <= 390, `scrollWidth ${ow}`);
  await context.close();
}

// 3 · U1 - play first, disclosures carry the depth, nothing removed.
// standing condition (laborer 0f8d72f1): at 390x844 the provenance summary
// row is FULLY visible without scrolling, in all three registers. the old
// threshold (<1000px) passed 890px green - it never encoded the claim.
// v2 (laborer 653ebede): "fully visible" = clear of the BAR CHROME, and the
// limit is COMPUTED - innerHeight - tbar-h, read from the variable tour.js
// publishes (#159). an unpublished variable fails CLOSED, never || 0.
{
  const regs = [['bee', null], ['raver', 'raver'], ['cypherpunk', 'cypherpunk']];
  for (const [name, reg] of regs) {
    const { context, page } = await fresh(reg);
    const ih = await page.evaluate(() => window.innerHeight);
    const pb = await box(page, '#play');
    ok(`u1: play sits above the fold (${name})`, pb && pb.y < ih, pb ? `y ${Math.round(pb.y)}` : 'no box');
    const details = page.locator('details[data-reg-disclose]');
    ok(`u1: provenance and doctrine ride the estate disclosure (two blocks, ${name})`, await details.count() === 2);
    const sums = await details.evaluateAll(ds => ds.map(d => d.querySelector('summary').getBoundingClientRect().height));
    ok(`u1: each summary is a 44px row (${name})`, sums.every(h => h >= 44), JSON.stringify(sums));
    const m = await page.evaluate(() => ({
      raw: getComputedStyle(document.documentElement).getPropertyValue('--tbar-h').trim(),
      ih: window.innerHeight,
      sy: window.scrollY,
      bottom: document.querySelector('details[data-reg-disclose] > summary').getBoundingClientRect().bottom,
    }));
    const tbarH = parseFloat(m.raw);
    if (m.raw === '' || !Number.isFinite(tbarH)) {
      ok(`u1: the tour bar publishes --tbar-h (${name})`, false, `raw '${m.raw}' - gate fails closed, no || 0 shortcut`);
    } else {
      ok(`u1: the tour bar publishes --tbar-h (${name})`, true, m.raw);
      const sumBottom = Math.round(m.bottom + m.sy);
      const limit = m.ih - tbarH;
      ok(`u1: the provenance summary clears the bar chrome at 390x844 (${name})`, sumBottom <= limit, `bottom ${sumBottom}px <= innerHeight ${m.ih} - tbar-h ${tbarH} = ${Math.round(limit)}px`);
    }
    if (!reg) {
      const open = await details.evaluateAll(ds => ds.map(d => d.open));
      ok('u1: both collapse for the default register (bee)', open.every(o => o === false), JSON.stringify(open));
      const kept = await page.evaluate(() => ({
        table: !!document.querySelector('details[data-reg-disclose] table'),
        doctrine: document.body.textContent.includes('The creation doctrine in four lines'),
        inscription: document.body.textContent.includes('a sound inscription IS an on-chain seed + renderer'),
        statuses: document.body.textContent.includes('pins on first founder upload'),
      }));
      ok('u1: nothing removed - table, doctrine, statuses all still in the page', kept.table && kept.doctrine && kept.inscription && kept.statuses, JSON.stringify(kept));
      await details.first().click();
      ok('u1: one tap opens the block', await details.first().evaluate(d => d.open === true));
    }
    await context.close();
  }
}

// 4 · register canon + engine wiring intact through the new layout
{
  const { context, page, errors } = await fresh('cypherpunk');
  const open = await page.locator('details[data-reg-disclose]').evaluateAll(ds => ds.map(d => d.open));
  ok('canon: cypherpunk stands the disclosures open', open.every(o => o === true), JSON.stringify(open));
  await page.locator('#play').click();
  await page.waitForFunction(() => /(playing|waiting) - /.test(document.getElementById('now').textContent), null, { timeout: 8000 });
  ok('engine: play still speaks through the status line in the new layout', true);
  const seedBefore = await page.locator('#seed').inputValue();
  await page.locator('#fork').click();
  await page.waitForFunction(() => document.querySelectorAll('#lineage .forkrow').length === 1, null, { timeout: 8000 });
  const forkReceipt = await page.evaluate(before => ({
    count: document.getElementById('forkcount').textContent,
    seedChanged: document.getElementById('seed').value !== before,
    rows: document.querySelectorAll('#lineage .forkrow').length,
  }), seedBefore);
  ok('engine: fork still writes its divergence receipt (button in section 1, lineage in section 4)', forkReceipt.count === '1 fork' && forkReceipt.seedChanged && forkReceipt.rows === 1, JSON.stringify(forkReceipt));
  ok('engine: no page errors in any register', errors.length === 0, errors.join('; '));
  await context.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
