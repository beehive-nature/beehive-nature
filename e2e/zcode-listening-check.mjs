// zcode-listening-check.mjs - Lane M beat 3 proof: the generated-sound demo's
// state machine tells the truth. Play claims playing only while a timer runs;
// Stop reports stopped with the step count; natural completion reports
// completed; a suspended/refused audio context never claims playing; a missing
// audio engine reports audio unavailable without disabling the control.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const server = createServer(async (req, res) => {
  try {
    const file = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (label, condition, note='') => { if (condition) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label}${note ? ` - ${note}` : ''}`); } };

async function fresh(initScript) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/net::ERR_/.test(message.text())) errors.push(message.text()); });
  if (initScript) await page.addInitScript(initScript);
  await page.goto(`${base}/surfaces/listening.html`);
  return { page, errors };
}
const now = page => page.locator('#now').innerText();
const state = page => page.evaluate(() => window.listeningDemo);

// 1. arrival: honest idle, live region, no errors, no autoplay
{
  const { page, errors } = await fresh();
  ok('listening: page has no errors', errors.length === 0, errors.join('; '));
  ok('listening: the status line is a polite live region', (await page.locator('#now').getAttribute('aria-live')) === 'polite');
  ok('listening: arrival is idle - no autoplay claim', /idle/.test(await now(page)) && !/playing/.test(await now(page)));
  const s = await state(page);
  ok('listening: nothing plays on arrival', s.playing === false && s.audioState === 'none');
  await page.context().close();
}

// 2. play -> playing claim backed by a live timer; stop -> stopped with count
{
  const { page, errors } = await fresh();
  await page.locator('#play').click();
  await page.waitForFunction(() => /playing - 32 steps/.test(document.getElementById('now').textContent));
  let s = await state(page);
  ok('listening: play claims playing with the timer actually running', s.playing === true && s.audioState === 'running' && s.total === 32);
  await page.locator('#stop').click();
  await page.waitForFunction(() => /stopped - /.test(document.getElementById('now').textContent));
  s = await state(page);
  const txt = await now(page);
  ok('listening: stop reports stopped with the honest step count', /stopped - \d+ of 32 steps/.test(txt) && s.playing === false);
  ok('listening: the stopped line never claims playing', !/playing/.test(txt));
  await page.waitForFunction(() => window.listeningDemo.audioState === 'suspended');
  ok('listening: the audio context is actually suspended after stop', true);
  ok('listening: stop/play cycle raises no page errors', errors.length === 0, errors.join('; '));
  await page.context().close();
}

// 3. natural completion reports completed (32 steps x 160ms, real clock)
{
  const { page, errors } = await fresh();
  await page.locator('#play').click();
  await page.locator('#now').filter({ hasText: 'completed - all 32 steps' }).waitFor({ timeout: 20000 });
  const s = await state(page);
  ok('listening: natural completion reports completed, not stopped, not playing', /completed - all 32 steps/.test(await now(page)) && s.playing === false);
  await page.waitForFunction(() => window.listeningDemo.audioState === 'suspended');
  ok('listening: completion silences the context', true);
  ok('listening: completion raises no page errors', errors.length === 0, errors.join('; '));
  await page.context().close();
}

// 4. suspended at start: resume refused -> suspended sentence, never playing
{
  const { page, errors } = await fresh(() => {
    class BlockedAudioContext {
      constructor(){ this.state = 'suspended'; }
      resume(){ return Promise.reject(new Error('blocked by policy')); }
    }
    window.AudioContext = BlockedAudioContext;
    window.webkitAudioContext = BlockedAudioContext;
  });
  await page.locator('#play').click();
  await page.locator('#now').filter({ hasText: 'suspended - ' }).waitFor({ timeout: 5000 });
  const s = await state(page);
  const txt = await now(page);
  ok('listening: refused audio reports suspended, never claims playing', /suspended - /.test(txt) && !/playing/.test(txt) && s.playing === false);
  ok('listening: the play control stays a live control (no dead button)', await page.locator('#play').isEnabled());
  ok('listening: the blocked-context path raises no page errors', errors.length === 0, errors.join('; '));
  await page.context().close();
}

// 5. no audio engine at all: audio unavailable, plain explanation
{
  const { page, errors } = await fresh(() => {
    delete window.AudioContext; delete window.webkitAudioContext;
  });
  await page.locator('#play').click();
  await page.locator('#now').filter({ hasText: 'audio unavailable' }).waitFor({ timeout: 5000 });
  const s = await state(page);
  ok('listening: a missing engine reports audio unavailable', /audio unavailable/.test(await now(page)) && s.playing === false && s.audioState === 'none');
  ok('listening: the page still works around the missing engine (viz, seed, fork)', await page.locator('#fork').isEnabled());
  ok('listening: the no-engine path raises no page errors', errors.length === 0, errors.join('; '));
  await page.context().close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
