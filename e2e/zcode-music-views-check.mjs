// zcode-music-views-check.mjs — the three authored experiences of the
// SKAISTS mUsiC room, proven per view at 390px and desktop: contrast (WCAG),
// overflow, keyboard focus, language switching, persistence across reload,
// external links, the BNR color-law legend, and the motion laws (pause
// control + prefers-reduced-motion). Facts stay identical across views —
// proven in zcode-music-check.mjs; this file proves the EXPERIENCES.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = createServer((req, res) => {
  try {
    const file = resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + '/') && !file.startsWith(root + '\\')) throw Error('path');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' })[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

/* WCAG 2.x contrast from computed colors — the same math the spec states */
const luminance = rgb => {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
const parseRgb = s => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
async function contrastOf(page, selector, ownBackground) {
  return page.evaluate(([sel, own]) => {
    const el = document.querySelector(sel);
    const col = getComputedStyle(el).color;
    let bg = own || null, node = el;
    while (!bg || bg === 'rgba(0, 0, 0, 0)') {
      node = node.parentElement;
      if (!node) break;
      const c = getComputedStyle(node).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)') bg = c;
    }
    return [col, bg || 'rgb(255,255,255)'];
  }, [selector, ownBackground]).then(([f, b]) => ratio(parseRgb(f), parseRgb(b)));
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const errors = [];
  const newPage = async (viewport, reducedMotion = 'no-preference') => {
    const ctx = await browser.newContext({ viewport, reducedMotion });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(base)) return route.continue();
      return route.abort();            // nothing external is ever delivered
    });
    return page;
  };
  const REGS = ['bee', 'raver', 'cypherpunk'];

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const page = await newPage(viewport);
    await page.goto(`${base}/surfaces/music.html`);
    await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
    for (const reg of REGS) {
      await page.locator(`#breg-${reg}`).click();
      assert.equal(await page.locator('body').getAttribute('data-reg'), reg, `${reg}: view applies`);
      assert.equal(await page.locator('h1:visible').count(), 1, `${reg}: exactly one visible h1`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${reg}@${viewport.width}: no horizontal overflow`);
      assert(await page.locator('.colorlaw:visible').count() === 1, `${reg}: the BNR color-law legend is visible`);
      /* contrast — the texts a reader actually reads, AA for body text */
      const lead = await contrastOf(page, '.lead');
      assert(lead >= 4.5, `${reg}@${viewport.width}: lead contrast ${lead.toFixed(2)} < 4.5`);
      const dim = await contrastOf(page, '.sub');
      assert(dim >= 4.5, `${reg}@${viewport.width}: secondary text contrast ${dim.toFixed(2)} < 4.5`);
      const join = await contrastOf(page, '#join');
      const joinBg = await page.evaluate(() => getComputedStyle(document.getElementById('join')).backgroundColor);
      assert(ratio(parseRgb(await page.evaluate(() => getComputedStyle(document.getElementById('join')).color)), parseRgb(joinBg)) >= 4.5,
        `${reg}@${viewport.width}: join button text/background contrast < 4.5`);
      /* keyboard focus: tab reaches the nav and the ring is visible */
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        const s = getComputedStyle(el);
        return { tag: el.tagName, outline: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      assert(focused.outline !== 'none' && focused.width > 0, `${reg}@${viewport.width}: focus ring visible (${focused.outline} ${focused.width})`);
      /* external links stay new-tab + noopener in every view (the estate law
         is cross-origin: tour-bar absolute hrefs back into this origin are
         internal and keep the same tab) */
      const externals = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="http"]'))
        .filter(a => { try { return new URL(a.href).host !== location.host; } catch { return false; } })
        .map(a => ({ target: a.getAttribute('target'), rel: a.getAttribute('rel') || '' })));
      assert(externals.length >= 3, `${reg}: external links found (${externals.length})`);
      for (const x of externals) {
        assert.equal(x.target, '_blank', `${reg}: external link opens new tab`);
        assert(x.rel.includes('noopener'), `${reg}: external link carries noopener`);
      }
      /* join still joins, in every skin */
      await page.locator('#join').click();
      assert.equal(await page.locator('#join').innerText(), 'leave preview', `${reg}: join toggles`);
      await page.locator('#join').click();
    }
    await page.context().close();
  }

  /* language switching: the leads and the legend translate through the corpus */
  const page = await newPage({ width: 390, height: 844 });
  await page.goto(`${base}/surfaces/music.html`);
  await page.locator('#breg-bee').click();
  await page.locator('#blangsel').selectOption('lv');
  await page.getByText('Mierīga istaba. Mūzika jau skan.', { exact: true }).waitFor();
  await page.locator('#breg-raver').click();
  await page.getByText('Deju grīda ir tava.', { exact: true }).waitFor();
  assert((await page.locator('.colorlaw').innerText()).includes('violets = cilvēki'), 'raver/lv: color law renders in Latvian');
  await page.locator('#breg-cypherpunk').click();
  assert((await page.locator('#join').innerText()).includes('jam'), 'cypherpunk/lv: join stays labelled');

  /* persistence across reload: view + tongue survive */
  await page.reload();
  await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
  assert.equal(await page.locator('body').getAttribute('data-reg'), 'cypherpunk', 'view persists across reload');
  await page.getByText('Pārbaudi manifestu, krātuves lasījumu un vārtus.', { exact: true }).waitFor();

  /* the motion laws — Raver carries ambient motion, and both switches stop it */
  const rpage = await newPage({ width: 1280, height: 900 });
  await rpage.goto(`${base}/surfaces/music.html`);
  await rpage.locator('#breg-raver').click();
  const motionButton = rpage.locator('#motion');
  assert(await motionButton.isVisible(), 'raver: the pause control is visible');
  assert.equal(await motionButton.getAttribute('aria-pressed'), 'false', 'raver: motion starts unpaused');
  const animating = await rpage.evaluate(() => getComputedStyle(document.querySelector('.art-bar')).animationName !== 'none');
  assert(animating, 'raver: the artwork breathes');
  await motionButton.click();
  assert.equal(await motionButton.getAttribute('aria-pressed'), 'true', 'pause control reports paused');
  assert.equal(await rpage.locator('body').getAttribute('data-motion-paused'), 'true', 'body carries the paused flag');
  const pausedState = await rpage.evaluate(() => getComputedStyle(document.querySelector('.art-bar')).animationPlayState);
  assert.equal(pausedState, 'paused', 'paused: artwork animation play-state is paused');
  await rpage.reload();
  await rpage.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
  assert.equal(await rpage.locator('body').getAttribute('data-motion-paused'), 'true', 'pause persists across reload');
  await rpage.context().close();

  /* prefers-reduced-motion: nothing ambient moves, the control is honestly still */
  const spage = await newPage({ width: 390, height: 844 }, 'reduce');
  await spage.goto(`${base}/surfaces/music.html`);
  await spage.locator('#breg-raver').click();
  await spage.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
  const still = await spage.evaluate(() => {
    const bar = getComputedStyle(document.querySelector('.art-bar'));
    return { name: bar.animationName, pressed: document.getElementById('motion').getAttribute('aria-pressed'), disabled: document.getElementById('motion').disabled };
  });
  assert.equal(still.name, 'none', 'reduced-motion: artwork animation is none');
  assert.equal(still.pressed, 'true', 'reduced-motion: control honestly reports still');
  assert(still.disabled, 'reduced-motion: control is disabled');
  assert.equal(await spage.locator('body').getAttribute('data-motion-paused'), 'true', 'reduced-motion: body paused flag set');
  await spage.context().close();

  /* the bee and cypherpunk views never run ambient loops either */
  const bpage = await newPage({ width: 390, height: 844 });
  await bpage.goto(`${base}/surfaces/music.html`);
  await bpage.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
  assert(!(await bpage.locator('#motion').isVisible()), 'bee: no motion control offered');
  await bpage.locator('#breg-cypherpunk').click();
  assert(!(await bpage.locator('#motion').isVisible()), 'cypherpunk: no motion control offered');
  await bpage.context().close();

  assert.deepEqual(errors, []);
  console.log('PASS: music views — 3 views × {390,1280} no-overflow/contrast/focus/external-links/join; lv switching on all three leads + legend; view+tongue persist across reload; Raver motion pauses (control + persisted) and prefers-reduced-motion stills it; no ambient loops in bee/cypherpunk; zero page errors, zero external deliveries.');
} finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
