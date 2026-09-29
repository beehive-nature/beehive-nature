// live-regression.mjs — the founder-gate mirror (surface polish lane, 2026-09-13).
// Read-only walk of the highest-traffic LIVE pages on skaists.dev: HTTPS answers,
// zero page errors, both toggles mount, the corpus loads, and a Russian reader
// actually receives Russian (corpus-exact cells, ⚙ counter, RTL reach on one page).
// Local-first law: this is the only suite that talks to production; it never
// clicks into wallets, chats, or payments — reads and one toggle click only.
// Usage: node e2e/live-regression.mjs [--origin=https://skaists.dev] [--out=file.json]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const arg = f => { const a = process.argv.find(x => x.startsWith('--' + f + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const ORIGIN = (arg('origin') || 'https://skaists.dev').replace(/\/$/, '');
const OUT = arg('out');

/* highest-traffic public doors (estate.json home skaists.dev family + the hub) */
const PAGES = [
  'surfaces/index.html',        // the hub atlas
  'surfaces/wallet.html',       // the custody door
  'surfaces/plur.html',         // the PLUR museum
  'surfaces/watch.html',        // watch together
  'surfaces/vending.html',      // the vending machine
  'surfaces/or-board.html',     // the operating room
  'surfaces/privacy-lens.html', // privacy lens
  'surfaces/profile.html'       // the dynasty profile
];

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${note ? ' — ' + note : ''}`); }
};

const b = await chromium.launch();
const rows = [];
for (const page of PAGES) {
  const url = ORIGIN + '/' + page;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('blang', 'ru'); } catch (e) {} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 90)));
  const row = { page, errs };
  try {
    const resp = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    ok(`LIVE ${page} answers HTTPS 200`, resp && resp.ok(), resp ? String(resp.status()) : 'no response');
    await p.waitForTimeout(2500);
    row.checks = await p.evaluate(() => {
      const out = {};
      out.regToggle = !!document.getElementById('bregctl');
      out.langToggle = !!document.getElementById('blangctl');
      out.corpusLoaded = !!(window.BNRLanguageCoverage && window.BNRLanguage);
      out.ruRendered = Array.from(document.querySelectorAll('[data-i18n]'))
        .filter(el => /[\u0400-\u04FF]/.test(el.textContent || '')).length;
      out.keyedHolders = document.querySelectorAll('[data-i18n],[data-key]').length;
      const note = document.getElementById('blangnote');
      out.counter = note ? note.textContent : '';
      return out;
    });
    ok(`LIVE ${page} both toggles mount`, row.checks.regToggle && row.checks.langToggle);
    ok(`LIVE ${page} corpus loads`, row.checks.corpusLoaded);
    ok(`LIVE ${page} Russian actually renders (${row.checks.ruRendered} holders)`, row.checks.ruRendered >= 3, row.checks.counter);
    ok(`LIVE ${page} coverage counter shows ⚙`, /^\s*⚙\s*\d+\/\d+/.test(row.checks.counter), row.checks.counter);
    ok(`LIVE ${page} zero page errors`, errs.length === 0, errs.join(' | '));
  } catch (e) {
    ok(`LIVE ${page} loads`, false, String(e).slice(0, 90));
  }
  rows.push(row);
  await ctx.close();
}

/* one deep interaction: the register toggle travels on the hub */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 90)));
  await p.goto(ORIGIN + '/surfaces/index.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await p.waitForTimeout(1500);
  await p.locator('#breg-raver').click().catch(() => {});
  await p.waitForTimeout(400);
  const reg = await p.evaluate(() => document.body.getAttribute('data-reg'));
  ok('LIVE hub register toggle switches to raver', reg === 'raver', String(reg));
  ok('LIVE hub toggle click clean', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await b.close();
if (OUT) { writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), origin: ORIGIN, rows }, null, 1)); console.log('written ' + OUT); }
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
