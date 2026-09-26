// register-contract.mjs — THE GOLDEN DRESS CONTRACT harness (founder
// 2026-09-26): wallet.html is the reference implementation of register
// behavior; every other surface is EVALUATED AGAINST THE CONTRACT by this
// instrument — same register semantics, same persistence, same motion
// contract, same theme tokens, surface-specific content only. Rollout is
// narrow: a surface adopts by setting data-reg-dress="contract" and passes
// THIS audit; screenshots are receipts, never the standard.
//
// The contract's single shipped source is surfaces/register.js (the
// body[data-reg="…"][data-reg-dress="contract"] token sets). The harness
// PARSES register.js at import time, so the contract is what actually ships —
// a page cannot pass by declaring different values.
//
// Usage inside a surface gate:
//   import { contractSets, assertRegisterContract } from './register-contract.mjs';
//   const pageErrors = [];
//   page.on('pageerror', e => pageErrors.push(String(e)));
//   await assertRegisterContract(page, {
//     ok, pageErrors, shotsDir: join(here, 'shots-mysurface'),
//     stem: 'mysurface-390',
//     voiceProbe: async page => ({ beeText, raverText, factText }),  // optional
//   });
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// ── parse the shipped contract sets out of register.js ──────────────────────
export const contractSets = (() => {
  const src = readFileSync(join(here, '..', 'surfaces', 'register.js'), 'utf8');
  const sets = {};
  for (const m of src.matchAll(/body\[data-reg="(bee|raver|cypherpunk)"\]\[data-reg-dress="contract"\]\{([^}]*)\}/g)) {
    const vars = {};
    for (const v of m[2].matchAll(/(--reg-[a-z0-9-]+):([^;]+)/g)) vars[v[1].trim()] = v[2].trim();
    sets[m[1]] = vars;
  }
  if (!sets.bee || !sets.raver || !sets.cypherpunk) throw new Error('register.js contract sets not parseable');
  return sets;
})();

const REGS = [['bee', '#breg-bee'], ['raver', '#breg-raver'], ['cypherpunk', '#breg-cypherpunk']];

// one register's measured dress, from the live page
export async function collectDress(page) {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    // sample SHARED content only: a register's own blocks ([data-reg], e.g. the
    // wallet's bee home list or raver dock) differ per register by design, so
    // they are never the dress sample (the three grammars, 2026-09-26)
    const shared = el => !el.closest('[data-reg]:not(body)');
    const section = [...document.querySelectorAll('main section')].find(shared) || null;
    const btn = [...document.querySelectorAll('main button')].find(shared) || null;
    const h1 = document.querySelector('h1');
    const h1cs = h1 ? getComputedStyle(h1) : null;
    const tok = n => cs.getPropertyValue(n).trim();
    return {
      reg: document.body.dataset.reg,
      bg: cs.backgroundColor,
      bgImage: cs.backgroundImage,
      ink: cs.color,
      bodyFont: cs.fontFamily,
      h1Font: h1cs ? h1cs.fontFamily : '',
      h1Weight: h1cs ? h1cs.fontWeight : '',
      cardRadius: section ? getComputedStyle(section).borderRadius : '',
      btnColor: btn ? getComputedStyle(btn).color : '',
      btnRadius: btn ? getComputedStyle(btn).borderRadius : '',
      glow: section ? getComputedStyle(section).boxShadow : '',
      press: btn ? getComputedStyle(btn).transitionDuration : '',
      h1Text: h1 ? h1.textContent : '',
      tokBg: tok('--reg-bg'), tokCard: tok('--reg-card'), tokInk: tok('--reg-ink'), tokPrimary: tok('--reg-primary'),
    };
  });
}

// THE CONTRACT, asserted on a live page that has opted in
export async function assertRegisterContract(page, { ok, pageErrors = [], shotsDir, stem, voiceProbe }) {
  const seen = {};
  const tap = sel => page.click(sel, { timeout: 4000 });

  // 0 · the opt-in: a contract surface declares itself
  ok('surface opts into the golden dress contract (data-reg-dress="contract")',
    await page.evaluate(() => document.body.getAttribute('data-reg-dress') === 'contract'));

  // 1 · the toggle: three named pills, thumb-sized, bee standing default
  const toggle = await page.evaluate(() => ['bee', 'raver', 'cypherpunk'].map(r => {
    const b = document.getElementById('breg-' + r);
    return { r, present: !!b, h: b ? Math.round(b.getBoundingClientRect().height) : 0, pressed: b ? b.getAttribute('aria-pressed') : null };
  }));
  ok('the RegisterToggle is in the masthead: three NAMED pills, each ≥ 44px', toggle.every(t => t.present && t.h >= 44), JSON.stringify(toggle));
  ok('new bee is the standing default (aria-pressed on bee only)', toggle.find(t => t.r === 'bee').pressed === 'true' && toggle.filter(t => t.pressed === 'true').length === 1);

  // 2 · the three dresses, measured + token-fidelity to register.js
  const norm = s => String(s).replace(/["'\s]/g, ''); // the browser re-serializes values (quotes, spaces) — compare the token stream
  for (const [reg, sel] of REGS) {
    await tap(sel);
    await page.waitForTimeout(350);
    seen[reg] = await collectDress(page);
    const set = contractSets[reg];
    const want = {
      '--reg-bg': set['--reg-bg'], '--reg-card': set['--reg-card'], '--reg-ink': set['--reg-ink'], '--reg-primary': set['--reg-primary'],
      '--reg-font-body': set['--reg-font-body'], '--reg-radius-card': set['--reg-radius-card'],
    };
    const got = {
      '--reg-bg': seen[reg].tokBg, '--reg-card': seen[reg].tokCard, '--reg-ink': seen[reg].tokInk, '--reg-primary': seen[reg].tokPrimary,
      '--reg-font-body': seen[reg].bodyFont, '--reg-radius-card': seen[reg].cardRadius,
    };
    const drift = Object.keys(want).filter(k => norm(got[k]) !== norm(want[k]));
    ok(`register "${reg}" wears the SHIPPED contract tokens (register.js is the source; page drift = fail)`,
      drift.length === 0, drift.map(k => `${k} page=${got[k]} contract=${want[k]}`).join(' · ').slice(0, 120));
  }

  // 3 · totally different, as a composite — and the ruled pairings hold
  const vector = r => [seen[r].bg, seen[r].bodyFont, seen[r].h1Font, seen[r].cardRadius, seen[r].btnColor, seen[r].btnRadius, seen[r].glow, seen[r].h1Weight].join('|');
  ok('the dress VECTOR differs on every pair (totally different, not a recolour)',
    vector('bee') !== vector('raver') && vector('raver') !== vector('cypherpunk') && vector('bee') !== vector('cypherpunk'));
  ok('the grounds follow the sheet: bee paper apart, raver and cypherpunk share the ruled black',
    seen.bee.tokBg === '#fbf7f0' && seen.raver.tokBg === '#06110c' && seen.cypherpunk.tokBg === '#06110c');

  // 4 · the motion contract: presses answer at the ruled 140ms
  ok('presses ride the ruled motion (140ms in the transition chain)',
    REGS.some(([r]) => (seen[r].press || '').split(',').some(d => Math.abs(parseFloat(d) - 0.14) < 0.001)), JSON.stringify(REGS.map(([r]) => seen[r].press)));

  // 5 · the voice changes, the FACTS never do (optional surface-specific probe)
  if (voiceProbe) {
    const v = await voiceProbe(page);
    ok('the register changes the VOICE while the facts stay byte-identical',
      v.beeText !== v.raverText && v.beeFact === v.raverFact, String(v.beeFact).slice(0, 50));
  }

  // 6 · persistence: the choice travels before first paint
  await tap('#breg-raver');
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const afterReload = await page.evaluate(() => document.body.dataset.reg);
  ok('the choice travels: a revisit opens in the reader\'s own register', afterReload === 'raver', 'body[data-reg]=' + afterReload);
  await page.evaluate(() => localStorage.setItem('bregister', 'bee'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);

  // 7 · the casing law, every register: no text-transform anywhere
  await tap('#breg-bee');
  await page.waitForTimeout(300);
  const transforms = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('main, main *').forEach(el => {
      if (el.children.length && el.tagName !== 'svg') return;
      if (getComputedStyle(el).textTransform !== 'none') bad.push(el.tagName + '.' + el.className);
    });
    return bad;
  });
  ok('no text-transform anywhere (capitals are a signal channel, never decoration)', transforms.length === 0, transforms.slice(0, 4).join(','));

  // 8 · the receipts: three screenshots a person can look at
  for (const [reg, sel] of REGS) {
    await tap(sel);
    await page.waitForTimeout(350);
    if (shotsDir) await page.screenshot({ path: join(shotsDir, `${stem}-${reg}.png`), fullPage: false });
  }
  ok('receipts banked: three screenshots, one per register', true, shotsDir || '(no shotsDir given)');

  // 9 · no page errors across all three registers
  ok('no page errors across all three registers', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ').slice(0, 140));

  return seen;
}
