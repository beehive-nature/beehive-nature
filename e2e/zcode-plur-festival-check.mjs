// zcode-plur-festival-check.mjs — behavioral pre-verify of the PLUR-wave + festival pages
// (throwaway gate for this dispatch; keep with the session, not the standing suite)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => { if (cond) { pass++; console.log(`PASS ${name}`); } else { fail++; console.log(`FAIL ${name}${note ? ' — ' + note : ''}`); } };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/net::ERR_|CORS/.test(m.text())) errors.push('console: ' + m.text()); });

// —— plur.html ——
await page.goto(`${BASE}/surfaces/plur.html`);
await page.waitForTimeout(400);
ok('plur: no page errors', errors.length === 0, errors.join(' | '));
ok('plur: 17 ribbon cells', (await page.locator('.rib .cell').count()) === 17);
ok('plur: every ribbon target exists', (await page.$$eval('.rib .cell', els =>
  els.every(e => document.getElementById(e.getAttribute('data-go')) !== null))));
await page.click('.rib [data-go="e-tierno"]');
await page.waitForTimeout(900);
ok('plur: 1984 cell scrolls to the crown-quote card', (await page.evaluate(() => {
  const t = document.getElementById('e-tierno');
  const r = t.getBoundingClientRect();
  return r.top > -40 && r.top < window.innerHeight * 0.6;
})));
ok('plur: crown quote verbatim on wall', (await page.locator('#e-tierno').innerText()).includes('Rockeros: el que no esté colocado, que se coloque y al loro'));
ok('plur: Tierno correction displayed (⚖)', (await page.locator('#e-tierno .vn').count()) === 1);
ok('plur: wib showcase-first (BIRTHPLACE is first card)', (await page.locator('.wib .ex').first().getAttribute('id')) === 'e-birth');
ok('plur: molecule history ceiling stated', (await page.locator('#e-mol').innerText()).includes('No chemistry'));
ok('plur: cannabis card links hemp to the commons feed', (await page.locator('#e-canna ~ .ex a[href="dao-dashboard/"]').count()) >= 1
  || (await page.locator('.wib a[href="dao-dashboard/"]').count()) === 1);
ok('plur: 7 wing medallions', (await page.locator('.wg').count()) === 7);
ok('plur: Wing IV links the kandi bar', (await page.locator('a[href="kandi.html"]').count()) === 1);
ok('plur: no 48+ hex runs (precommit law)', !(await page.evaluate(() => /[0-9a-fA-F]{48,}/.test(document.body.innerHTML))));
const exhibitCount = await page.locator('.ex').count();
console.log(`plur: ${exhibitCount} exhibits total`);
ok('plur: exhibit count grew (56 → 60+)', exhibitCount >= 60);

// i18n: es
await page.selectOption('#blangsel', 'es');
await page.waitForTimeout(600);
ok('plur: es heading docked from corpus v9', (await page.locator('.wib h2 span[data-i18n="plur.wib"]').innerText()).includes('LA ISLA · EIVISSA'));
await page.selectOption('#blangsel', 'en');
await page.waitForTimeout(300);

// —— kandi.html ——
await page.goto(`${BASE}/surfaces/kandi.html`);
await page.waitForTimeout(400);
ok('kandi: page clean', errors.length === 0, errors.join(' | '));
await page.selectOption('#blangsel', 'es');
await page.waitForTimeout(600);
const kandiEs = await page.locator('[data-i18n="kandi.bar"]').innerText();
ok('kandi: es corpus key docked, kandi untranslated', kandiEs.includes('kandi') && !kandiEs.includes('KANDI'), kandiEs);
errors.length = 0;
await page.evaluate(() => localStorage.setItem('blang', 'en'));

// —— festival ——
await page.goto(`${BASE}/surfaces/festival/index.html`);
await page.waitForTimeout(800);
ok('festival: no page errors', errors.length === 0, errors.join(' | '));
ok('festival: 9 beats render', (await page.locator('section.beat').count()) === 9);
ok('festival: ribbon cells reach their beats', (await page.$$eval('.rib .cell', els =>
  els.every(e => document.getElementById(e.getAttribute('data-go')) !== null))));
ok('festival: 127-cell comb rendered', (await page.locator('#comb2 polygon').count()) === 127);
ok('festival: eight family doors — seven gates + the kandi kid room open', (await page.locator('.gate').count()) === 8
  && (await page.locator('[data-i18n="f.gate"]').count()) === 7
  && (await page.locator('.fam').innerText()).includes('already open'));
await page.click('#calm');
ok('festival: calm button stills the rig', (await page.evaluate(() => document.body.classList.contains('still'))));
await page.click('#calm');
ok('festival: calm toggles back', !(await page.evaluate(() => document.body.classList.contains('still'))));
ok('festival: day pass strands beads', (await page.locator('#passout circle').count()) === 7);
const dialTxt = await page.locator('#s-econ').innerText();
ok('festival: economy dials show value or declared failure', /gwei|Mgas|unreachable/.test(dialTxt));
ok('festival: tour bar + language layer present', (await page.locator('#tbar').count()) === 1 && (await page.locator('#blangctl').count()) === 1);
await page.selectOption('#blangsel', 'de');
await page.waitForTimeout(600);
ok('festival: de heading docked (f.floor)', (await page.locator('[data-i18n="f.floor"]').innerText()).includes('DER FLOOR'));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
