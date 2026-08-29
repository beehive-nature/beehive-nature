// claim-final2.mjs — SPLIT CEREMONY:
//   script does: search, wallet connect, email, email-OTP (auto from maildir)
//   FOUNDER does: the Google Authenticator 6-digit code (typed by hand in the popup)
//   script does: rest — connect approve, claim, register
// Browser NEVER closes. No TOTP automation. One process.
import { chromium } from 'playwright';
import { writeFileSync, appendFileSync } from 'fs';
import { execSync } from 'child_process';

const EMAIL = 'bzcode@agents.skaists.buzz';
const MAILDIR = '/var/mail-agents/bzcode/new';
const NAME = 'bzcode';

const log = m => { const l = '[' + new Date().toISOString().slice(11, 19) + '] ' + m; console.log(l); appendFileSync('C:/tmp/claim-final2.log', l + '\n'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function ssh(cmd) {
  try { return execSync('wsl -e bash -lc "ssh -o BatchMode=yes oracle \'' + cmd + '\'"', { encoding: 'utf8', timeout: 30000 }).trim(); }
  catch { return ''; }
}
async function text(t) { try { return await t.evaluate(() => document.body ? document.body.innerText : ''); } catch { return ''; } }

const browser = await chromium.launch({ headless: false, args: ['--disable-popup-blocking', '--disable-blink-features=AutomationControlled', '--no-first-run'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
let popup = null;
ctx.on('page', p => { if (!popup || popup.isClosed()) { popup = p; log('POPUP: ' + p.url()); } else { log('stray popup closed'); p.close().catch(() => {}); } });

async function clickBtn(t, want, exclude = [], maxLen = 30) {
  for (const w of want) {
    const btns = t.locator('button, [role="button"]');
    const n = await btns.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      try {
        const b = btns.nth(i);
        const bt = ((await b.textContent()) || '').trim();
        if (!bt || bt.length > maxLen || !bt.includes(w)) continue;
        if (exclude.some(x => bt.includes(x))) continue;
        if (await b.isVisible() && await b.isEnabled()) {
          log('  click "' + bt + '"');
          await b.click({ timeout: 8000 });
          await sleep(2500);
          return bt;
        }
      } catch {}
    }
  }
  return null;
}
async function readOtp(marker) {
  for (let i = 0; i < 40; i++) {
    await sleep(4000);
    const f = ssh('sudo ls -t ' + MAILDIR + '/ 2>/dev/null | head -1');
    if (f && f.length > 10 && f !== marker) {
      const body = ssh('sudo cat ' + MAILDIR + '/' + f + ' 2>/dev/null');
      const m = body.match(/Subject:\s*(\d{6})/);
      if (m) { log('  OTP mail → ' + m[1]); return m[1]; }
    }
  }
  return null;
}

try {
  log('=== SPLIT CEREMONY: ' + NAME + '.base.eth ===');

  // 1. landing + cookie + search + row
  await page.goto('https://www.base.org/name', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await clickBtn(page, ['Confirm my choices', 'Accept All']);
  await page.evaluate(() => document.querySelector('#onetrust-accept-btn-handler')?.click()).catch(() => {});
  await sleep(1500);
  const search = page.locator('input[placeholder*="name" i], input[type="search"], input[type="text"]').first();
  await search.click({ timeout: 15000 });
  await search.fill(NAME);
  await sleep(2500);
  const row = page.getByText(NAME + '.base.eth', { exact: true }).first();
  await row.click({ timeout: 10000 });
  log('result row clicked');
  await sleep(5000);

  // 2. wallet connect → Coinbase Wallet → popup
  await clickBtn(page, ['Connect wallet'], ['WalletConnect']);
  await sleep(2000);
  await clickBtn(page, ['Coinbase Wallet'], ['WalletConnect', 'Trust', 'Zerion'], 24);
  for (let i = 0; i < 10 && !popup; i++) await sleep(1500);
  if (!popup) throw new Error('no popup');
  await sleep(6000);

  // 3. gateway: extension-wait → back; pairing → Sign in with Base
  for (let i = 0; i < 6; i++) {
    const t = await text(popup);
    if (/opening coinbase wallet|confirm connection in the extension/i.test(t)) { log('extension-wait → back'); try { await popup.goBack(); } catch {} await sleep(3000); continue; }
    if (/sign in with base/i.test(t)) {
      await popup.getByText('Sign in with Base').first().click({ timeout: 8000 });
      log('"Sign in with Base" clicked');
      await sleep(3500);
      break;
    }
    await sleep(2500);
  }

  // 4. email → submit
  let emailDone = false;
  for (let i = 0; i < 8 && !emailDone; i++) {
    const t = await text(popup);
    if (/what's your email/i.test(t) || await popup.locator('input[type="email"], input[name="email"]').first().isVisible().catch(() => false)) {
      const em = popup.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
      if (await em.count()) {
        await em.fill(EMAIL, { timeout: 8000 });
        await sleep(400);
        (await clickBtn(popup, ['Continue'], [], 20)) || await em.press('Enter');
        log('EMAIL SUBMITTED');
        emailDone = true;
      }
    } else await sleep(2500);
  }

  // 5. email OTP (auto)
  let otpDone = false;
  if (emailDone) {
    await sleep(5000);
    const marker = ssh('sudo ls -t ' + MAILDIR + '/ 2>/dev/null | head -1');
    const otp = await readOtp(marker);
    if (otp) {
      const multi = popup.locator('input[maxlength="1"], input[data-testid*="otp" i], input[aria-label*="digit" i]');
      const mc = await multi.count().catch(() => 0);
      log('  otp inputs: multi=' + mc);
      if (mc >= 6) { for (let j = 0; j < 6; j++) { await multi.nth(j).fill(otp[j], { timeout: 4000 }).catch(() => {}); await sleep(100); } }
      else { await popup.keyboard.type(otp, { delay: 180 }); }
      await sleep(1500);
      await clickBtn(popup, ['Continue', 'Verify'], [], 20);
      otpDone = true;
      log('EMAIL OTP ENTERED: ' + otp);
    } else log('!!! no OTP mail — founder can type the email code too');
  }

  // 6. WAIT FOR FOUNDER — authenticator screen: HANDS OFF
  log('');
  log('╔══════════════════════════════════════════════════╗');
  log('║  FOUNDER: TYPE YOUR 6-DIGIT GOOGLE AUTH CODE     ║');
  log('║  IN THE POPUP WINDOW NOW                         ║');
  log('╚══════════════════════════════════════════════════╝');
  log('');
  let authPassed = false;
  for (let i = 0; i < 90; i++) { // up to 7.5 min for founder
    await sleep(5000);
    const url = popup.isClosed() ? '(closed)' : popup.url();
    const t = popup.isClosed() ? '' : await text(popup);
    if (i % 6 === 0) log('  waiting (' + (i * 5) + 's) popup=' + url.slice(24, 70) + ' :: ' + t.slice(0, 100).replace(/\n/g, ' '));
    if (!popup.isClosed() && !/authenticator/i.test(t) && !/what's your email/i.test(t) && (url.includes('/connect') || /select|account|connect/i.test(t))) { authPassed = true; break; }
    if (popup.isClosed()) { log('popup closed — checking main page state'); break; }
  }
  log(authPassed ? '*** AUTH PASSED — script takes over ***' : 'auth wait ended (timeout or closed) — taking over best-effort');

  // 7. drive the rest: connect approvals + claim/register
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const ts = [];
    if (popup && !popup.isClosed()) ts.push(popup);
    ts.push(page);
    for (const t of ts) {
      const tx = await text(t);
      if (/connect wallet/i.test(tx) && t === page) {
        await clickBtn(page, ['Connect wallet'], ['WalletConnect']);
        await clickBtn(page, ['Coinbase Wallet'], ['WalletConnect', 'Trust', 'Zerion'], 24);
      }
    }
    if (popup && !popup.isClosed()) await clickBtn(popup, ['Connect', 'Select account', 'Select', 'Allow', 'Approve', 'Confirm'], ['WalletConnect', 'Reconnect'], 24);
    const mt = await text(page);
    await clickBtn(page, ['Claim', 'Register', 'Mint', 'Confirm', 'Continue'], ['WalletConnect'], 30);
    const all = mt + (popup && !popup.isClosed() ? await text(popup).catch(() => '') : '');
    if (all.includes(NAME + '.base.eth') && /registered|is yours|successfully|you now own|claimed/i.test(all)) {
      const addr = all.match(/0x[a-fA-F0-9]{40}/);
      log('*** CLAIMED ' + NAME + '.base.eth addr=' + (addr ? addr[0] : '?') + ' ***');
      writeFileSync('C:/tmp/bzcode-basename.json', JSON.stringify({ agent: 'bzcode', basename: NAME + '.base.eth', address: addr ? addr[0] : null, timestamp: new Date().toISOString() }, null, 1));
      break;
    }
    if (i % 6 === 0) log('  [' + (i * 5) + 's] main=' + (await text(page)).slice(0, 90).replace(/\n/g, ' '));
  }
  try { await page.screenshot({ path: 'C:/tmp/cf-end.png' }); } catch {}
  log('DONE — browser stays open');
} catch (err) {
  log('ERROR: ' + err.message);
}
await new Promise(() => {});
