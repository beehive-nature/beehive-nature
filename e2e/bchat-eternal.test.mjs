// bchat-eternal.test.mjs — "one surface, three trust lanes" as an ETERNAL front (SPEC-BCHAT-1,
// 2026-10-02). Proves at 390 px: the page renders entirely from local state (no socket, no probe,
// no external request fires on load — the rub law, watched from the harness, not asserted from
// prose); both threads stand with their lane badges and the SMS lane says SIMULATED in place;
// register law holds (the envelope inspector belongs to cypherpunk alone); a fresh key arms on
// device; the prove-the-encryptor panel runs the NIP's own vectors green IN the browser; an
// offline send is HELD local with an honest state (never "sent" theater); an Autonomi descriptor
// travels as a descriptor-only chip marked Building; and FORGET actually prunes a read
// until-read message locally while SAYING it is consent-routing, not deletion.
// Run: node --test bchat-eternal.test.mjs (working dir e2e)
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/bchat.html> node --test bchat-eternal.test.mjs
const PAGE = 'bchat.html', PORT = 9281;
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    const url = decodeURIComponent(q.url.split('?')[0]);
    const f = url === `/surfaces/${PAGE}` && process.env.ETERNAL_PAGE_FILE ? process.env.ETERNAL_PAGE_FILE : join(ROOT, url);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { await browser.close(); await new Promise(r => srv.close(r)); });

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => { if (cond) { pass++; console.log(`PASS ${name}`); } else { fail++; console.log(`FAIL ${name}${note ? ' — ' + note : ''}`); } };

test('bchat eternal front — three lanes, local state only', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], externals = [], sockets = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith(ORIGIN)) externals.push(r.url()); });
  page.on('websocket', w => sockets.push(w.url()));

  await page.goto(`${ORIGIN}/surfaces/${PAGE}`);
  await page.waitForTimeout(800);
  ok('loads with zero page/console errors', errors.length === 0, errors.join(' | '));
  ok('the rub law, watched: no socket and no external request on load', sockets.length === 0 && externals.length === 0, (sockets.concat(externals)).join(', '));
  ok('the shared shell rode in (tour bar present)', await page.locator('#tbar').count() === 1);
  const fresh = (await page.locator('#cockpit .light').evaluateAll(els => els.map(e => e.dataset.light + ':' + e.dataset.tone)));
  ok('the cockpit stands with five lights, none green before any receipt proves it',
    fresh.length === 5 && fresh.every(t => !t.endsWith(':ok')), fresh.join(' '));
  ok('the road light says what it knows: primary, not probed', (await page.locator('#cockpit [data-light="road"]').innerText()).includes('not probed'));

  ok('both threads stand', await page.locator('.threadrow').count() === 2);
  ok('the SMS lane says SIMULATED in place', (await page.locator('#threadcard').innerText()).includes('SIMULATED'));
  ok('SMS thread has no send button — no fake sends', await page.locator('#compose:visible').count() === 0);
  ok('lane badges render (SMS + BNR)', await page.locator('.badge-sms').count() >= 1 && await page.locator('.badge-bnr').count() >= 1);

  ok('envelope inspector is cypherpunk-only', (await page.locator('div[data-reg="cypherpunk"]').evaluate(el => getComputedStyle(el).display)) === 'none');
  await page.click('#breg-cypherpunk');
  await page.waitForFunction(() => document.body.getAttribute('data-reg') === 'cypherpunk');
  ok('cypherpunk stands the inspector open', (await page.locator('div[data-reg="cypherpunk"]').evaluate(el => getComputedStyle(el).display)) === 'block');
  await page.click('#breg-bee');
  await page.waitForFunction(() => document.body.getAttribute('data-reg') === 'bee');

  await page.click('#genkey');
  await page.waitForTimeout(400);
  const pub = await page.locator('#pubview').textContent();
  ok('a fresh key arms on device (64-hex x-only)', /^[0-9a-f]{64}$/.test(pub || ''), String(pub).slice(0, 20));
  ok('identity turns green on the key-armed receipt', ((await page.locator('#cockpit .light').evaluateAll(els => els.map(e => e.dataset.light + ':' + e.dataset.tone)))).includes('identity:ok'));

  await page.click('#runvec');
  await page.waitForTimeout(900);
  const okCount = await page.locator('#vecout .ok').count();
  const badCount = await page.locator('#vecout .bad').count();
  ok(`the encryptor proves itself in-browser (NIP's own vectors ${okCount}/5, 0 red)`, okCount === 5 && badCount === 0, `${okCount} ok / ${badCount} bad`);
  ok('crypto turns green only after the vectors ran here', ((await page.locator('#cockpit .light').evaluateAll(els => els.map(e => e.dataset.light + ':' + e.dataset.tone)))).includes('crypto:ok'));

  await page.click('.threadrow[data-t="bnr"]');
  await page.locator('#rcpt').fill('c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d'); // PUBLIC-CONSTANT (NIP-44's own published vector key)
  await page.locator('#draft').fill('held locally — the eternal front never pretends a send');
  await page.click('#send');
  await page.waitForTimeout(300);
  ok('offline send is HELD local, stated honestly', (await page.locator('#sendstate').textContent()).includes('held locally'));
  ok('no socket opened for a held message', sockets.length === 0);
  ok('the held message carries its state chip', (await page.locator('#msgs').innerText()).includes('local — not yet published'));
  await page.click('#cockpit [data-light="relay"]');
  const strip = (await page.locator('#cockpit').innerText()) + (await page.locator('#conninfo').innerText()) + (await page.locator('#receipts').innerText());
  ok('a light opens its evidence one tap deeper', await page.locator('#conninfo').evaluate(d => d.open));
  ok('lights, evidence and receipts never carry the message text', !strip.includes('the eternal front never pretends'), strip.slice(0, 120));
  const held = (await page.locator('#cockpit .light').evaluateAll(els => els.map(e => e.dataset.light + ':' + e.dataset.tone)));
  ok('a held send turns nothing green: relay not dialled, no event evidence', held.includes('relay:idle') && held.includes('receipt:idle'), held.join(' '));

  /* FORGET: a read until-read message prunes locally, and the page SAYS it is consent-routing */
  await page.selectOption('#retain', 'until-read');
  await page.locator('#draft').fill('read once, then forgotten locally');
  await page.click('#send');
  await page.waitForTimeout(200);
  const mids = await page.locator('#msgs .msg').evaluateAll(els => els.map(e => e.getAttribute('data-mid')));
  const lastMid = mids[mids.length - 1];
  await page.click(`#msgs .msg[data-mid="${lastMid}"]`);
  await page.waitForTimeout(200);
  await page.click('.threadrow[data-t="sms"]');
  await page.click('.threadrow[data-t="bnr"]');
  await page.waitForTimeout(200);
  const msgsAfter = await page.locator('#msgs .msg').count();
  const laneNote = await page.locator('#lanebadge').innerText();
  ok('FORGET pruned the read until-read message locally', msgsAfter === 1, `${msgsAfter} left (wanted 1)`);
  ok('and says it: consent-routing, never a deletion promise', /publication-consent routing, not deletion/i.test(laneNote), laneNote.slice(0, 80));

  /* Autonomi descriptor: capability travels, bytes stay out (retention back to
     persistent first — an until-read OUTBOX copy is born read and sweeps itself) */
  await page.selectOption('#retain', 'persistent');
  await page.click('#attachbtn');
  await page.locator('#antaddr').fill('autonomi://' + '1a'.repeat(32));
  await page.locator('#antbytes').fill('4096');
  await page.locator('#antsha').fill('2b'.repeat(32));
  await page.click('#antsend');
  await page.locator('#draft').fill('');
  await page.click('#send');
  await page.waitForTimeout(300);
  const threadText = await page.locator('#msgs').innerText();
  ok('an Autonomi descriptor travels as descriptor-only, marked Building',
    threadText.includes('descriptor-only') && threadText.includes('Building'), threadText.slice(0, 120));

  ok('still zero external traffic for the whole front', externals.length === 0, externals.join(', '));
  await page.close();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail) process.exitCode = 1;
});
