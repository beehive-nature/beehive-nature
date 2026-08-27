/* purse-live-check.mjs — one-off: click the live exhibit button on skaists.dev
   and confirm the Purse renders. Untracked; a look, not a lane. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://skaists.dev';
const b = await chromium.launch({ args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{ width:900, height:1000 } });
await p.goto(BASE + '/surfaces/blight/inscription-explorer.html', { waitUntil:'domcontentloaded', timeout:30000 });
await p.click('button[data-a="0x100fd362abf7ef7f7a7ca3c331d4c718c6f45479"]');
await p.waitForFunction(() => {
  const m = document.querySelector('#dmsg');
  if (!m) return false;
  const t = m.textContent;
  return /quiet|didn.t answer|crown found|rendered|pieces|found for that address/.test(t) || (document.querySelector('#wall') && document.querySelector('#wall').children.length > 0);
}, null, { timeout:120000 }).catch(() => {});
console.log('dmsg :', ((await p.textContent('#dmsg')) || '').replace(/\s+/g, ' ').trim().slice(0, 240));
const wall = await p.textContent('#wall').catch(() => '');
console.log('wall : FROGGI=' + /FROGGI/i.test(wall) + ' · egg=' + /\begg\b/i.test(wall));
await p.waitForTimeout(1500);
await p.screenshot({ path:'e2e/shots-zb-visual/purse-live-explorer.png' });
await b.close();
console.log('shot : e2e/shots-zb-visual/purse-live-explorer.png');
