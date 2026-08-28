/* midi-agent-verify.mjs — bMiDi's residency, verified (2026-08-27 order).
   The defect: visuals lasted two ~5s bursts (rendering was gated on the audio
   playing). The build: always-on scratch pad (ambient field + pointer blooms),
   prompt window whose replies are painted mandalas, the level-5 3:33 @ 162BPM
   psytrance container, and a live-sourced pitch for MiDi B (renounced owner,
   burned supply, real pool). */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8912';
const PAGE = process.env.PAGE || '/surfaces/blight/midi.html';
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

  await page.goto(BASE + PAGE, { waitUntil:'domcontentloaded', timeout:30000 });
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

  /* the master visualist: FULL canvas, smaller+variable hexes, words */
  await page.fill('#chatin', 'mandala bloom');
  await page.press('#chatin', 'Enter');
  await page.waitForTimeout(2500);
  const cov = await page.evaluate(() => {
    const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const hex = artGround().replace('#', '');
    const gr = parseInt(hex.slice(0, 2), 16), gg = parseInt(hex.slice(2, 4), 16), gb = parseInt(hex.slice(4, 6), 16);
    const W = cv.width, H = cv.height;
    const ink = [[0,0],[1,0],[0,1],[1,1]].map(([qx, qy]) => {
      let n = 0, tot = 0;
      for (let y = qy * H / 2 | 0; y < (qy + 1) * H / 2; y += 3)
        for (let x = qx * W / 2 | 0; x < (qx + 1) * W / 2; x += 3) {
          tot++;
          const i = (y * W + x) * 4;
          if (Math.abs(img[i] - gr) + Math.abs(img[i + 1] - gg) + Math.abs(img[i + 2] - gb) > 60) n++;
        }
      return n / tot;
    });
    return { ink, W, minR: ART.minR, maxR: ART.maxR, ratio: ART.maxR / ART.minR };
  });
  check('full-canvas: every quadrant carries ink', cov.ink.every(f => f > 0.015), cov.ink.map(f => (f * 100).toFixed(1) + '%').join(' · '));
  check('hexes are smaller (maxR < canvas/24)', cov.maxR < cov.W / 24, 'maxR=' + cov.maxR.toFixed(1) + ' of ' + cov.W + 'px');
  check('hexes are variable (maxR/minR > 1.6)', cov.ratio > 1.6, 'ratio=' + cov.ratio.toFixed(2));
  const lastWord = await page.evaluate(() => window.__lastWord);
  check('bMiDi writes words on the lattice', lastWord === 'MANDALA', lastWord);

  /* level 5: the container AND the bare score — the top keeps every rung */
  await page.fill('#in', '1500000');
  await page.click('#read');
  await page.waitForFunction(() => /score from the contract/.test(document.getElementById('msg').textContent), null, { timeout:45000 });
  const badge = await page.textContent('#container');
  check('level 5 badge: 3:33 · 162', /3:33/.test(badge) && /162/.test(badge), badge.trim());
  const v2vis = await page.evaluate(() => !document.getElementById('voice2').hidden);
  check('level 5 shows BOTH plays (container + bare score)', v2vis);
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
  const bothBack = await page.evaluate(() => !document.getElementById('voice').hidden && !document.getElementById('voice2').hidden);
  check('after closing, both plays are offered again', bothBack);

  /* the bare score at level 5 — a top holder keeps the lower-rung performance */
  await page.click('#voice2');
  await page.waitForTimeout(2500);
  const bareBadge = await page.textContent('#container');
  check('bare score at L5 plays (no container clock)', /bare score plays · level 5/.test(bareBadge.trim()), bareBadge.trim());
  const bareMoving = await snap();
  await page.waitForTimeout(1500);
  check('bare score visuals animate', bareMoving !== await snap());
  await page.click('#voice2');
  await page.waitForTimeout(500);

  /* prompt modes: journey vs score */
  await page.fill('#chatin', 'play the journey');
  await page.press('#chatin', 'Enter');
  await page.waitForTimeout(1200);
  const jm = await page.textContent('#container');
  check('prompt "play the journey" → container mode', /psytrance · 162 BPM/.test(jm), jm.trim());
  await page.fill('#chatin', 'play the score');
  await page.press('#chatin', 'Enter');
  await page.waitForTimeout(1200);
  const sm2 = await page.textContent('#container');
  check('prompt "play the score" → bare score mode', /bare score plays/.test(sm2), sm2.trim());
  await page.fill('#chatin', 'silence');
  await page.press('#chatin', 'Enter');
  await page.waitForTimeout(600);

  /* future contracts: validated live before joining; impostors refused */
  await page.fill('#chatin', 'contract 0x7d9Ce55D54FF3FEddb611fC63fF63ec01F26D15F');
  await page.press('#chatin', 'Enter');
  await page.waitForTimeout(5000);
  const refuse = await page.evaluate(() => [...document.querySelectorAll('#chat p.agent')].pop().textContent);
  check('non-MiDi contract refused honestly', /did not answer as a MiDi instrument/.test(refuse), refuse.slice(0,70));
  const stillB = await page.evaluate(() => document.querySelectorAll('#contracts .rung b')[2].textContent);
  await page.fill('#chatin', 'contract 0x569e1A337b095B1A6c8F206158072cEDb6325b56');
  await page.press('#chatin', 'Enter');
  await page.waitForTimeout(6000);
  const switched = await page.evaluate(() => document.querySelector('#prov-c').textContent);
  check('contract route switches to a validated instrument contract', /0x569e1A33/i.test(switched), switched.trim());
  const back = await page.evaluate(() => [...document.querySelectorAll('#chat p.agent')].pop().textContent);
  check('switch line carries the equal-access law', /equal on every deployment/.test(back), back.slice(0,80));
  /* back to B — the canonical holding */
  await page.evaluate(() => { document.querySelectorAll('#contracts .rung')[2].click(); });
  await page.waitForTimeout(1500);
  const provB = await page.evaluate(() => document.querySelector('#prov-c').textContent);
  check('switcher returns to B (canonical)', /0xf7Cf2DF5/i.test(provB), provB.trim());
  await page.waitForFunction(() => /RENOUNCED/.test(document.getElementById('pi-owner').textContent), null, { timeout:30000 });
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
  await page.goto(BASE + PAGE, { waitUntil:'domcontentloaded', timeout:30000 });
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
