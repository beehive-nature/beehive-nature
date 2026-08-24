// design-acceptance.mjs — the STANDING ORDER DESIGN ACCEPTANCE gate.
// Five laws + mobile, as mechanical proxies; the parts that need judgment
// (does the gradient carry the ARGUMENT, do hues MEAN their meanings in use)
// stay human — the gate checks the structure that makes those judgements
// checkable, and FAILS a surface that misses the structure.
//
//   node design-acceptance.mjs surfaces/devroom.html [more.html …]
//
// D1 DEPTH LADDER      three distinct structural backgrounds: body void / panel / inset
// D2 SEMANTIC COLOUR   five --sem-* tokens declared (harm solution value system science)
//                      + meanings-picked-first comment present in source
// D3 HEADLINE          h1 has a background-image with background-clip:text, color transparent
// D4 HERO NUMBER       one figure at ≥32px with a ≤11px UPPERCASE caption beside it
// D5 DENSITY WITH AIR  body type ≤14px AND panel radius ≥10px AND panel padding ≥12px
// M  MOBILE            viewport meta + a ≤600px media query + no horizontal overflow at 375px
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['surfaces/devroom.html'];
const browser = await chromium.launch();

let totalPass = 0, totalFail = 0;
const ok = (name, cond, note = '') => {
  if (cond) { totalPass++; console.log(`  PASS ${name}`); }
  else { totalFail++; console.log(`  FAIL ${name}${note ? ' — ' + note : ''}`); }
};

for (const rel of targets) {
  const path = resolve(rel);
  const url = 'file://' + path.replace(/\\/g, '/');
  const src = await readFile(path, 'utf8');
  console.log(`\n### ${rel}`);

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // D1 — three distinct structural background steps
  const d1 = await page.evaluate(() => {
    const bg = el => el ? getComputedStyle(el).backgroundColor : 'none';
    const body = bg(document.body);
    const panel = bg(document.querySelector('section'));
    const inset = bg(document.querySelector('.art,.pstat,#pipe,pre') || document.querySelector('section *'));
    return { body, panel, inset,
      distinct: new Set([body, panel, inset]).size >= 3 && !new Set([body, panel, inset]).has('rgba(0, 0, 0, 0)') };
  });
  ok('D1 depth ladder (void/panel/inset distinct)', d1.distinct, `body=${d1.body} panel=${d1.panel} inset=${d1.inset}`);

  // D2 — semantic tokens declared with meanings first
  const tokens = await page.evaluate(() =>
    ['harm', 'solution', 'value', 'system', 'science'].map(k =>
      getComputedStyle(document.documentElement).getPropertyValue(`--sem-${k}`).trim()));
  ok('D2 five --sem-* tokens resolve', tokens.every(t => t.length > 2), tokens.join(' | '));
  ok('D2 meanings-picked-first declaration in source', /SEMANTIC COLOUR/i.test(src), 'comment block naming the meanings');

  // D3 — gradient-clipped headline
  const h1 = await page.evaluate(() => {
    const el = document.querySelector('h1,[data-hero-title]');
    if (!el) return null;
    const c = getComputedStyle(el);
    return { img: c.backgroundImage, clip: (c.webkitBackgroundClip || c.backgroundClip), color: c.color };
  });
  ok('D3 headline gradient-clipped', !!h1 && h1.img !== 'none' && h1.clip === 'text' && (h1.color.includes('rgba(0, 0, 0, 0)') || h1.color === 'transparent'),
    h1 ? `clip=${h1.clip} img=${h1.img.slice(0, 40)}…` : 'no h1');

  // D4 — hero number ≥32px with ≤11px uppercase caption
  const hero = await page.evaluate(() => {
    const n = document.querySelector('[data-hero-number],.pstat.hero .n,.hero-number');
    if (!n) return null;
    const cap = n.parentElement.querySelector('.l,.hero-caption,[data-hero-caption]');
    const cn = getComputedStyle(n), cc = cap ? getComputedStyle(cap) : null;
    return { size: parseFloat(cn.fontSize), capSize: cc ? parseFloat(cc.fontSize) : null, capUp: cc ? cc.textTransform : null };
  });
  ok('D4 hero number ≥32px + ≤11px uppercase caption', !!hero && hero.size >= 32 && hero.capSize !== null && hero.capSize <= 11 && hero.capUp === 'uppercase',
    hero ? `${hero.size}px / caption ${hero.capSize}px ${hero.capUp}` : 'no hero marked');

  // D5 — small type AND generous radius AND padding
  const d5 = await page.evaluate(() => {
    const body = parseFloat(getComputedStyle(document.body).fontSize);
    const s = document.querySelector('section');
    const c = getComputedStyle(s);
    const r = parseFloat(c.borderTopLeftRadius), p = [c.paddingTop, c.paddingLeft].map(parseFloat);
    return { body, r, p };
  });
  ok('D5 density with air', d5.body <= 14 && d5.r >= 10 && d5.p.every(v => v >= 12), `type=${d5.body}px radius=${d5.r}px padding=${d5.p}`);

  // M — mobile
  ok('M viewport meta', /name=["']viewport["']/i.test(src));
  ok('M ≤600px media query exists', /@media\s*\(\s*max-width\s*:\s*([1-5]?[0-9]{1,2})px/.test(src));
  const mob = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await mob.goto(url, { waitUntil: 'load' });
  await mob.waitForTimeout(300);
  const m = await mob.evaluate(() => {
    const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const h1 = getComputedStyle(document.querySelector('h1')).fontSize;
    return { over, h1 };
  });
  const h1Big = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('h1')).fontSize));
  ok('M no horizontal overflow at 375px', m.over <= 1, `overflow=${m.over}px`);
  ok('M headline shrinks on phone', parseFloat(m.h1) < h1Big, `phone=${m.h1} desktop=${h1Big}px`);
  await mob.close();
  await page.close();
}

console.log(`\n${totalPass} passed, ${totalFail} failed`);
await browser.close();
process.exit(totalFail ? 1 : 0);
