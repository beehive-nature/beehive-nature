// zcode-watch-manifest-check.mjs — local proof for the W@tch manifest seam.
// The watch page is served as a one-file surface, so the test supplies only
// its existing static dependencies and a fixture-backed manifest. It never
// contacts a relay, opens x0x, writes to Autonomi, or starts a meter session.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath,['scripts/build-watch-languages.mjs','--check'],{stdio:'inherit'});
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const requests = [];
const server = createServer(async (req, res) => {
  requests.push({ method: req.method, url: req.url });
  const route = req.url.split('?')[0];
  if (route === '/live/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ publishing: false, rooms: [] })); return; }
  if (route === '/live/ticker/general.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
  if (route === '/join/' || route === '/watch/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>local room</title>'); return; }
  let file = join(ROOT, decodeURIComponent(route).replace(/^\//, ''));
  if (route === '/tokens.css') file = join(ROOT, 'surfaces', 'tokens.css');
  if (route === '/watch/hls.min.js') file = join(ROOT, 'surfaces', 'hls.min.js');
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !/net::ERR_/.test(message.text())) errors.push(message.text()); });
let pass = 0, fail = 0;
const ok = (label, condition, note = '') => { if (condition) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label}${note ? ` — ${note}` : ''}`); } };

await page.addInitScript(()=>localStorage.setItem('watch.session','watch-session-sentinel'));
await page.goto(`${base}/surfaces/watch.html`);
await page.waitForFunction(() => document.getElementById('manifest-state')?.textContent === 'shape checked');
ok('watch: page has no errors', errors.length === 0, errors.join(' | '));
ok('watch: page carries SKAISTS identity', await page.title() === 'SKAISTS watch room · skaists.buzz' && (await page.locator('h1').innerText()) === 'Watch together');
ok('watch: sample manifest shape is checked', (await page.locator('#manifest-state').textContent()).trim().toLowerCase() === 'shape checked');
ok('watch: channel and sequence are projected', await page.locator('#manifest-channel').textContent() === 'plur' && await page.locator('#manifest-sequence').textContent() === '12');
ok('watch: checkpoint remains a bounded reference', (await page.locator('#manifest-checkpoint').textContent()).includes('…'));
ok('watch: encrypted item count is visible', await page.locator('#manifest-items').textContent() === '4 encrypted');
const jamsRef = page.locator('a[href="https://jams.community/"]');
const watchRef = page.locator('a[href="https://github.com/aautonomicc/Watch-It"]');
ok('watch: independent references are explicit', await jamsRef.count() === 1 && await watchRef.count() === 1 && (await page.locator('.independent').innerText()).includes('independent companion'));
ok('watch: independent references open safely in new tabs', await jamsRef.getAttribute('target') === '_blank' && await jamsRef.getAttribute('rel') === 'noopener noreferrer' && await watchRef.getAttribute('target') === '_blank' && await watchRef.getAttribute('rel') === 'noopener noreferrer');
ok('watch: no write or raw transport was opened', !requests.some(r => r.method === 'POST' || r.url.includes('/ws')));
await page.waitForSelector('#breg-bee');
for (const mode of ['bee', 'raver', 'cypherpunk']) {
  await page.locator(`#breg-${mode}`).click();
  const view = await page.evaluate(() => {
    const visible = selector => { const node = document.querySelector(selector); return !!node && getComputedStyle(node).display !== 'none'; };
    return {
      reg: document.body.dataset.reg,
      leads: [...document.querySelectorAll('.view-lead[data-view]')].filter(node => getComputedStyle(node).display !== 'none').map(node => node.dataset.view),
      leadKeys: [...document.querySelectorAll('.view-lead[data-view]')].map(node => node.dataset.i18n || node.querySelector('[data-i18n]')?.getAttribute('data-i18n')),
      details: document.getElementById('room-details').open,
      privacy: document.getElementById('privacy-details').open,
      privacyText: document.querySelector('[data-i18n="watch.privacyIntro"]').textContent,
      pass: visible('#sess') && visible('#go'),
      money: document.querySelector('[data-i18n="watch.unquoted"]').textContent,
    };
  });
  ok(`watch: ${mode} view selects its own reading`, view.reg === mode && view.leads.length === 1 && view.leads[0] === mode && view.details === (mode === 'cypherpunk') && view.privacy === (mode === 'cypherpunk') && view.privacyText.includes('Private viewing is not established') && view.pass && view.money === 'Not quoted');
  ok(`watch: ${mode} view copy is translation-keyed`, view.leadKeys.every(Boolean));
}
await page.locator('#breg-bee').click();
await page.waitForSelector('#blangsel');
await page.evaluate(() => localStorage.setItem('blang', 'ru'));
await page.reload();
await page.waitForFunction(() => document.documentElement.lang === 'ru' && document.querySelector('#blangsel')?.value === 'ru');
const translatedLead = await page.locator('.view-lead[data-view="bee"][data-i18n="watch.beeLead"]').innerText();
const translatedLang = await page.evaluate(() => document.documentElement.lang);
ok('watch: view copy travels through the language dock', translatedLead === 'Общий экран. Хорошая компания.' && translatedLang === 'ru');

// A host-controlled field must never become executable markup in a receipt.
await page.evaluate(()=>paintStrip({sess:{credit:'2.0000 A',burned:'0.5000 A',state:0,audit_state:0},rate:{basis:'<img src="/RECEIPT-XSS-PROBE" onerror="window.receiptInjected=true">'}}));
ok('watch: host receipt fields render as text', !(await page.locator('#nums img').count()) && (await page.locator('#nums').textContent()).includes('<img') && !(await page.evaluate(()=>window.receiptInjected)) && !requests.some(r=>r.url.includes('RECEIPT-XSS-PROBE')));
const receiptBefore=await page.locator('#nums').textContent();
for(const mode of ['raver','cypherpunk','bee'])await page.locator('#breg-'+mode).click();
ok('watch: view changes preserve the same receipt amounts', (await page.locator('#nums').textContent())===receiptBefore);
ok('watch: privacy map does not expose the saved room pass', !(await page.locator('#privacy-details').textContent()).includes('watch-session-sentinel'));
ok('watch: page declares referrer suppression', await page.locator('meta[name="referrer"]').getAttribute('content')==='no-referrer' && await page.locator('#roomframe').getAttribute('referrerpolicy')==='no-referrer');

// Real opening is opt-in; the default page never contacts the room iframe.
ok('watch: room is not contacted before opening chat', !requests.some(r=>r.url==='/join/'));
await page.locator('#open-room').click();
await page.waitForFunction(()=>!document.getElementById('roomframe').hidden);
await page.locator('#roomframe').contentFrame().locator('title').waitFor({state:'attached'});
ok('watch: explicit chat opens only the same-origin room', requests.filter(r=>r.url==='/join/').length===1 && (await page.locator('#roomframe').getAttribute('src'))==='/join/');

// The user's actual repro: a raw file, without a server or permissive browser flags.
const filePage=await browser.newPage({viewport:{width:390,height:844}});
const fileErrors=[],fileNetwork=[];
filePage.on('pageerror',e=>fileErrors.push(e.message));
filePage.on('request',r=>{if(/^https?:/.test(r.url()))fileNetwork.push(r.url());});
await filePage.goto(pathToFileURL(join(ROOT,'surfaces/watch.html')).href);
await filePage.waitForSelector('#blangsel');
ok('watch: local preview has no fabricated live session', (await filePage.locator('#st').innerText())==='Local preview' && await filePage.locator('#go').isDisabled() && await filePage.locator('#open-room').isDisabled() && !(await filePage.locator('#roomframe').getAttribute('src')));
ok('watch: unmeasured receipt has no audit verdict', await filePage.locator('.cell.lit').count()===0);
const corpus=JSON.parse(await readFile(join(ROOT,'surfaces/lang-corpus.json'),'utf8'));
let overflow=[],untranslated=[];
for(const lang of ['en',...corpus._meta.langs]){
  await filePage.locator('#blangsel').selectOption(lang);
  await filePage.waitForFunction(code=>document.documentElement.lang===code,lang);
  for(const mode of ['bee','raver','cypherpunk']){
    await filePage.locator('#breg-'+mode).click();
    const key={bee:'watch.beeLead',raver:'watch.raverLead',cypherpunk:'watch.cypherLead'}[mode];
    if((await filePage.locator('.view-lead[data-view="'+mode+'"]').innerText())!==corpus.strings[key][lang])untranslated.push(lang+'/'+mode);
    const layout=await filePage.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
    if(layout.scroll>layout.w+1)overflow.push(lang+'/'+mode);
  }
}
ok('watch: 29 languages × 3 views use the corpus under file protocol', !untranslated.length,untranslated.join(', '));
ok('watch: all translated views fit a 390px phone', !overflow.length,overflow.join(', '));
await filePage.locator('#blangsel').selectOption('ar');
ok('watch: Arabic declares RTL', await filePage.locator('html').getAttribute('dir')==='rtl');
await filePage.locator('#blangsel').selectOption('en');
await filePage.locator('#breg-bee').click();
await filePage.evaluate(()=>document.documentElement.style.fontSize='200%');
ok('watch: enlarged text stays within the phone', await filePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
ok('watch: local preview opens no remote request and has no page errors', !fileNetwork.length&&!fileErrors.length,JSON.stringify({fileNetwork,fileErrors}));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
