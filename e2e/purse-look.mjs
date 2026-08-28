/* purse-look.mjs — one-off: what the founder sees when he goes looking for the
   Purse. LIVE main (skaists.dev) profile with bqueenbee.base.eth pasted, and
   museum Exhibit 10. Untracked by design; a look, not a lane. */
import { chromium } from 'playwright';
const browser = await chromium.launch({ args:['--no-sandbox'] });
const page = await browser.newPage({ viewport:{ width:900, height:1100 } });

/* 1. the LIVE profile, the purse's name typed in */
await page.goto('https://skaists.dev/surfaces/blight/profile.html', { waitUntil:'domcontentloaded', timeout:30000 });
await page.fill('#addr', 'bqueenbee.base.eth');
await page.click('#go');
await page.waitForFunction(() => /rendered from chain|holds nothing|did not resolve/.test(document.getElementById('msg').textContent), null, { timeout:90000 });
await page.waitForTimeout(1800); /* art fade-in */
console.log('LIVE msg :', (await page.textContent('#msg')).trim());
const wall = await page.textContent('#wall');
console.log('wall     : FROGGI=' + /\$?FROGGI/i.test(wall), '· egg=' + /\begg\b/i.test(wall), '· seed 52=' + /seed\s*52\b/.test(wall), '· PEPI=' + /PEPI/i.test(wall));
const chips = await page.textContent('#chips');
console.log('chips    :', chips.replace(/\s+/g,' ').trim().slice(0,200));
await page.screenshot({ path:'e2e/shots-zb-visual/purse-live-profile.png', fullPage:true });

/* 2. museum, Exhibit 10 */
await page.goto('https://skaists.dev/surfaces/blight/museum.html', { waitUntil:'domcontentloaded', timeout:30000 });
const h = page.locator('h2', { hasText:'Exhibit 10' });
await h.scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
console.log('ex10 id  :', await h.getAttribute('id'));
const sec = h.locator('xpath=..');
console.log('ex10 text:', (await sec.textContent()).replace(/\s+/g,' ').trim().slice(0,340));
await page.screenshot({ path:'e2e/shots-zb-visual/purse-museum-ex10.png' });

await browser.close();
console.log('done');
