/* midi-agent-verify.mjs — bMiDi's residency, verified (2026-08-27 order).
   The defect: visuals lasted two ~5s bursts (rendering was gated on the audio
   playing). The build: always-on scratch pad (ambient field + pointer blooms),
   prompt window whose replies are painted mandalas, the level-5 3:33 @ 162BPM
   psytrance container, and a live-sourced pitch for MiDi B (renounced owner,
   burned supply, real pool). */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8912';
const results = [];
const check = (name, ok, detail='') => { results.push({name, ok}); console.log((ok?'PASS':'FAIL')+'  '+name+(detail?'  — '+detail:'')); };
const hash = s => { let h=2166136261; for (const c of s) { h^=c.charCodeAt(0); h=Math.imul(h,16777619);} return (h>>>0).toString(16); };

const browser = await chromium.launch({ args:['--no-sandbox'] });

/* ── main run: animation + prompt + container + pitch ── */
{
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0,120)));
  const snap = () => page.evaluate(() => document.getElementById('cv').toDataURL()).then(hash);

  await page.goto(BASE + '/surfaces/blight/midi.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForTimeout(3500);   /* level-0 static face */

  const h1 = await snap();
  await page.waitForTimeout(2500);
  const h2 = await snap();
  check('scratch pad animates while idle (no sound pressed)', h1 !== h2, 'ambient static breathes');

  await page.waitForTimeout(16000);  /* sail past the old ~10s death */
  const h3 = await snap();
  await page.waitForTimeout(1500);
  const h4 = await snap();
  check('visuals persist past 25 seconds', h3 !== h4, 'still moving at t≈25s');

  await page.click('#cv', { position:{ x:190, y:300 } });
  await page.waitForTimeout(700);
  const h5 = await snap();
  check('pointer touch blooms a mandala', h5 !== h4);

  const agentLines0 = await page.evaluate(() => document.querySelectorAll('#chat p.agent').length);
  await page.fill('#chatin', 'bloom for me');
  await page.click('#say');
  await page.waitForTimeout(700);
  const agentLines1 = await page.evaluate(() => document.querySelectorAll('#chat p.agent').length);
  const h6 = await snap();
  check('prompt window: bMiDi replies', agentLines1 === agentLines0 + 1, agentLines1 + ' agent lines');
  check('prompt window: the reply is painted on the pad', h6 !== h5);

  /* level 5: the container */
  await page.fill('#in', '1500000');
  await page.click('#read');
  await page.waitForFunction(() => /score from the contract/.test(document.getElementById('msg').textContent), null, { timeout:45000 });
  const badge = await page.textContent('#container');
  check('level 5 badge: 3:33 · 162', /3:33/.test(badge) && /162/.test(badge), badge.trim());
  await page.click('#voice');
  await page.waitForTimeout(3000);
  const run = await page.textContent('#container');
  check('container runs: psytrance · 162 BPM · clock', /psytrance · 162 BPM · 0:0\d \/ 3:33/.test(run.replace(/\s+/g,' ')), run.trim());
  const progHidden = await page.evaluate(() => document.getElementById('progress').hidden);
  check('container progress bar visible', !progHidden);
  const c1 = await snap();
  await page.waitForTimeout(4000);   /* 3s later — old page's bursts were dead by now */
  const c2 = await snap();
  check('container visuals still moving at ~7s into the journey', c1 !== c2);
  await page.click('#voice');        /* close it — silence */
  await page.waitForTimeout(600);
  const closed = await page.textContent('#voice');
  check('container closes back to its invite', /3:33 at 162/.test(closed), closed.trim());
  await page.screenshot({ path:'e2e/shots-zb-visual/midi-agent-390.png', fullPage:true });

  /* the pitch: live numbers for MiDi B */
  await page.waitForFunction(() => !/^…$/.test(document.getElementById('pi-owner').textContent), null, { timeout:30000 });
  const owner = await page.textContent('#pi-owner');
  const burn = await page.textContent('#pi-burn');
  const pool = await page.textContent('#pi-pool');
  const supply = await page.textContent('#pi-supply');
  check('pitch: owner RENOUNCED', /RENOUNCED/.test(owner), owner.trim());
  check('pitch: burned ≈ 41.6M (19.8%)', /41,618/.test(burn) && /19\.8%/.test(burn), burn.trim());
  check('pitch: pool 3.70 WETH ↔ ~106.9M MiDi', /3\.7\d? WETH/.test(pool) && /106,880,236/.test(pool), pool.trim());
  check('pitch: supply 210,000,000', /210,000,000/.test(supply), supply.trim());
  check('no page errors across the whole run', errors.length === 0, errors[0] || 'clean');
  await ctx.close();
}

/* ── reduced motion: the honest rest ── */
{
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, reducedMotion:'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0,120)));
  const snap = () => page.evaluate(() => document.getElementById('cv').toDataURL()).then(hash);
  await page.goto(BASE + '/surfaces/blight/midi.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForTimeout(2500);
  const r1 = await snap();
  await page.waitForTimeout(2500);
  const r2 = await snap();
  check('reduced motion: the pad rests (no animation)', r1 === r2);
  const agent0 = await page.evaluate(() => document.querySelectorAll('#chat p.agent').length);
  await page.fill('#chatin', 'who are you');
  await page.press('#chatin', 'Enter');
  await page.waitForTimeout(500);
  const agent1 = await page.evaluate(() => document.querySelectorAll('#chat p.agent').length);
  check('reduced motion: prompt still answers in words', agent1 === agent0 + 1);
  check('reduced motion: no page errors', errors.length === 0, errors[0] || 'clean');
  await ctx.close();
}

await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log('\n' + (failed ? failed + ' FAILURES' : 'ALL ' + results.length + ' CHECKS PASS'));
process.exit(failed ? 1 : 0);
