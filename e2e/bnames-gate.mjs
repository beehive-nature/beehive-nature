// bnames-gate.mjs — the three fail-opens in Cowork's patch set, asserted shut.
//
// Each test below corresponds to a defect that WOULD have shipped. They are
// written as regressions: if someone re-introduces the original shape, these go
// red rather than the page quietly handing out founder rights.
//
//   F1 orb fail-safe   fit() with no #tbar must write NOTHING. The patch as
//                      staged wrote bottom:10px, MORE clipped than the 18px it
//                      replaced — and tour.js injects the bar separately, so
//                      "no bar yet" is the common first-paint path.
//   F2 absent SOUL     registrantAllowed(null) must be FALSE. `SOUL||'kingbeelovis'`
//                      resolved every visitor to the founder with the refusal hidden.
//   F3 single owner    Ticking consent-check ALONE must not enable the button. The
//                      pre-existing document-level handler fired on the BUBBLE phase,
//                      after the element-level refreshGate, and overwrote it.
//   G1 named reason    A dead button with three causes must say WHICH one.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.env.SURFACES || 'C:/Users/travi/wt-cD/surfaces';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const srv = createServer(async (req,res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const b = await readFile(join(ROOT, p));
    res.writeHead(200,{'content-type':TYPES[extname(p)]||'application/octet-stream'});
    res.end(b);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => srv.listen(0,'127.0.0.1',r));
const base = `http://127.0.0.1:${srv.address().port}`;

let pass=0, fail=0;
const ok=(n,c,note='')=>{ console.log(`  ${c?'PASS':'FAIL'} ${n}${note?' — '+note:''}`); c?pass++:fail++; };

const browser = await chromium.launch();

// ── F1 · orb fail-safe with NO bar ──────────────────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/tour.js*', r => r.abort());        // no bar is ever injected
  await page.goto(`${base}/bnames.html`, { waitUntil:'load' });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const o = document.getElementById('adOrb');
    return { present: !!o,
             bottom: o ? getComputedStyle(o).bottom : null,
             bar: !!document.getElementById('tbar') };
  });
  ok('F1 no #tbar present (tour.js blocked)', r.bar === false);
  ok('F1 orb exists', r.present);
  ok('F1 orb keeps the 66px FAIL-SAFE, never lowered to 10px',
     r.bottom === '66px', `bottom=${r.bottom}`);
  await ctx.close();
}

// ── F1b · bar arrives later → fit() re-seats (MutationObserver path) ─
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/tour.js*', r => r.abort());
  await page.goto(`${base}/bnames.html`, { waitUntil:'load' });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const b = document.createElement('div');
    b.id = 'tbar';
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:46px';
    document.body.appendChild(b);
  });
  await page.waitForTimeout(400);
  const bottom = await page.evaluate(() => getComputedStyle(document.getElementById('adOrb')).bottom);
  ok('F1b bar arriving LATER re-seats the orb (MutationObserver fired)',
     bottom === '56px', `bottom=${bottom} (46px bar + 10)`);
  await ctx.close();
}

// ── F2 · absent SOUL must not be the founder ───────────────────────
// The inline script is IIFE-wrapped, so registrantAllowed/SOUL are NOT global.
// That is the answer to the scope question — op2 lands INSIDE the same IIFE as
// the click handler, so hoisting saves it — and it means this must be tested
// through observable DOM behaviour, not by calling internals. Better test.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/bnames.html`, { waitUntil:'load' });
  const soul = await page.evaluate(() => localStorage.getItem('bnr_soul'));
  ok('F2 a fresh visitor really has no stored SOUL', soul === null, String(soul));
  await ctx.close();
}

// ── F3 + G1 · one owner of disabled, and it names the reason ───────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/bnames.html`, { waitUntil:'load' });
  await page.evaluate(() => { document.getElementById('consent-card').style.display = 'block'; });

  const tick = (id, v) => page.evaluate(([i,val]) => {
    const el = document.getElementById(i);
    el.checked = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));   // bubbles, like a real click
  }, [id, v]);
  const state = () => page.evaluate(() => ({
    disabled: document.getElementById('sign-btn').disabled,
    why: (document.getElementById('gate-why')||{}).textContent || '',
    refusal: getComputedStyle(document.getElementById('nf-refusal')).display,
  }));

  let s = await state();
  ok('F3 button starts disabled', s.disabled === true);
  ok('G1 and says why', /custody|one name|founder/i.test(s.why), JSON.stringify(s.why).slice(0,64));

  await tick('consent-check', true);
  s = await state();
  ok('F3 consent-check ALONE does NOT enable (bubble handler no longer overwrites)',
     s.disabled === true, `disabled=${s.disabled}`);
  ok('G1 names the still-unmet condition', s.why.length > 0, JSON.stringify(s.why).slice(0,72));

  await tick('ack', true);
  s = await state();
  ok('F3 both boxes ticked STILL refused — no SOUL means not founder',
     s.disabled === true, `disabled=${s.disabled}`);
  ok('F3 refusal notice is visible', s.refusal === 'block');

  await ctx.close();
}

// ── F2b · a FOUNDER soul (seeded before load) opens the gate ───────
// Proves the gate is not merely stuck shut. SOUL is restored from
// localStorage at load, which is the only way in from outside the IIFE.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => { try{ localStorage.setItem('bnr_soul','kingbeelovis'); }catch(e){} });
  await page.goto(`${base}/bnames.html`, { waitUntil:'load' });
  await page.evaluate(() => { document.getElementById('consent-card').style.display='block'; });
  for (const id of ['consent-check','ack']) {
    await page.evaluate((i) => { const el=document.getElementById(i); el.checked=true;
      el.dispatchEvent(new Event('change',{bubbles:true})); }, id);
  }
  const s2 = await page.evaluate(() => ({
    disabled: document.getElementById('sign-btn').disabled,
    why: (document.getElementById('gate-why')||{}).textContent || '',
  }));
  ok('F2b founder SOUL + both boxes -> ENABLED (gate is not merely stuck shut)',
     s2.disabled === false, `disabled=${s2.disabled}`);
  ok('G1 reason clears when nothing is unmet', s2.why === '', JSON.stringify(s2.why));
  await ctx.close();
}

// ── no console errors anywhere (the RPC placeholder used to throw) ──
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`${base}/bnames.html`, { waitUntil:'load' });
  await page.waitForTimeout(600);
  ok('no page errors on load (RPC is null, so no fetch is attempted)',
     errs.length === 0, errs.slice(0,2).join(' | ') || 'none');
  await ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
