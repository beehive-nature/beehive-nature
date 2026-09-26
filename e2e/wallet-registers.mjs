// wallet-registers.mjs — the REFERENCE IMPLEMENTATION gate for the golden
// dress contract (founder 2026-09-25/26). wallet.html IS the reference
// surface: this battery proves it wears the three registers TOTALLY
// differently behind one toggle, that the tokens it ships match the contract
// sets in register.js byte-for-byte (the fidelity half of the rollout law),
// and that its wallet-specific dress rulings hold (serif/display/mono
// titles, the action colours, the one glow). The generic contract —
// semantics, persistence, motion, casing, receipts — lives in
// e2e/register-contract.mjs so every next surface is evaluated against the
// SAME instrument, never against screenshots.
//
//   node e2e/wallet-registers.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';
import { assertRegisterContract } from './register-contract.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', 'surfaces');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const p = (url === '/' ? '/wallet.html' : url.indexOf('/surfaces/') === 0 ? url.slice('/surfaces'.length) : url);
  try {
    const body = await readFile(join(SURFACES, ...p.split('/').filter(Boolean)));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const pageErrors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(origin + '/wallet.html', { waitUntil: 'load' });
await page.waitForSelector('#breg-cypherpunk', { timeout: 10000 });
await page.waitForTimeout(400);

// THE CONTRACT, measured by the shared instrument
const seen = await assertRegisterContract(page, {
  ok, pageErrors, shotsDir: join(here, 'shots-wallet-registers'), stem: 'wallet-390',
  voiceProbe: async p => {
    // probe: bee and raver must lead with DIFFERENT prose (each visible in its
    // own register) while h1 — the fact line — stays byte-identical
    await p.click('#breg-bee'); await p.waitForTimeout(300);
    const bee = await p.evaluate(() => {
      const el = document.querySelector('p[data-reg="bee"]');
      return { vis: el.getBoundingClientRect().height > 0, text: el.textContent.trim(), h1: document.querySelector('h1').textContent };
    });
    await p.click('#breg-raver'); await p.waitForTimeout(300);
    const raver = await p.evaluate(() => {
      const el = document.querySelector('p[data-reg="raver"]');
      return { vis: el.getBoundingClientRect().height > 0, text: el.textContent.trim(), h1: document.querySelector('h1').textContent };
    });
    return { beeText: bee.vis ? bee.text : '', raverText: raver.vis ? raver.text : '', beeFact: bee.h1, raverFact: raver.h1 };
  },
});

// ── wallet-specific dress rulings (the surface's own contribution) ─────────
await page.click('#breg-bee'); await page.waitForTimeout(300);
ok('bee reads in SERIF titles over SANS body', /Georgia/.test(seen.bee.h1Font) && /system-ui/.test(seen.bee.bodyFont), seen.bee.h1Font.split(',')[0]);
ok('bee corners are SOFT (20px cards, 12px controls)', seen.bee.cardRadius === '20px' && seen.bee.btnRadius === '12px', seen.bee.cardRadius);
ok('bee action is the ONE magenta (rgb(168, 35, 140))', seen.bee.btnColor === 'rgb(168, 35, 140)', seen.bee.btnColor);
await page.click('#breg-raver'); await page.waitForTimeout(300);
ok('raver shouts in a heavy display title', parseInt(seen.raver.h1Weight, 10) >= 700, 'weight ' + seen.raver.h1Weight);
ok('raver controls are PILLS (999px)', seen.raver.btnRadius === '999px', seen.raver.btnRadius);
ok('raver carries glow-sovereign — the ONE glow — and the purples-as-light wash', seen.raver.glow !== 'none' && /gradient/.test(seen.raver.bgImage), (seen.raver.glow || '').slice(0, 60));
ok('raver action is you magenta (rgb(214, 85, 187))', seen.raver.btnColor === 'rgb(214, 85, 187)', seen.raver.btnColor);
await page.click('#breg-cypherpunk'); await page.waitForTimeout(300);
ok('cypherpunk is MONO top to bottom', /mono/i.test(seen.cypherpunk.bodyFont) && /mono/i.test(seen.cypherpunk.h1Font), seen.cypherpunk.bodyFont.split(',')[0]);
ok('cypherpunk corners are CUT (4px cards, 4px controls)', seen.cypherpunk.cardRadius === '4px' && seen.cypherpunk.btnRadius === '4px', seen.cypherpunk.cardRadius);
ok('cypherpunk action is ai teal (rgb(69, 194, 220))', seen.cypherpunk.btnColor === 'rgb(69, 194, 220)', seen.cypherpunk.btnColor);

await browser.close();
server.close();
const failed = results.filter(r => !r.pass);
console.log(failed.length
  ? `\nWALLET REGISTERS GATE: ${failed.length} FAILED of ${results.length}`
  : `\nWALLET REGISTERS GATE: GREEN — ${results.length}/${results.length} (the reference surface wears the golden dress contract)`);
process.exit(failed.length ? 1 : 0);
