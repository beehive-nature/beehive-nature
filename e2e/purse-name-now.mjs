/* purse-name-now.mjs — one-off: what does bqueenbee.base.eth resolve to RIGHT
   NOW on the Base registry? Uses the live profile's own resolver (registry
   walk, two RPC hosts). Receipt for the renewal re-point. */
import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--no-sandbox'] });
const p = await b.newPage();
await p.goto('https://skaists.dev/surfaces/blight/profile.html', { waitUntil:'domcontentloaded', timeout:30000 });
await p.waitForFunction(() => typeof resolveInput === 'function' || typeof resolveName === 'function', null, { timeout:15000 }).catch(() => {});
const r = await p.evaluate(async () => {
  const fn = typeof resolveInput === 'function' ? resolveInput : (typeof resolveName === 'function' ? resolveName : null);
  if (!fn) return { error: 'no resolver on page' };
  try { return await fn('bqueenbee.base.eth'); } catch (e) { return { error: String(e) }; }
});
console.log('resolveInput("bqueenbee.base.eth") =', JSON.stringify(r, null, 2));
const PURSE = '0x100fd362abf7ef7f7a7ca3c331d4c718c6f45479';
if (r && r.addr) {
  const same = r.addr.toLowerCase() === PURSE;
  console.log(same ? 'STILL THE PURSE' : 'RE-POINTED — name no longer the purse; purse must pin ' + PURSE);
}
await b.close();
