// ad-hoc smoke for surfaces/university/index.html — not part of the committed suite
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd().replace(/e2e$/, '');
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
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`PASS ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(`${BASE}/surfaces/university/index.html`);
await page.waitForTimeout(300);
if (errors.length) console.log('LOAD ERRORS:\n' + errors.join('\n'));

ok('title', (await page.title()).includes('Beehive University'));
ok('no page/console errors on load', errors.length === 0);
ok('five courses render', (await page.locator('#courses > section').count()) === 5);
ok('gates table states', (await page.locator('.gates td').allTextContents()).join(' ').includes('RULED'));

// register toggle
const bee = await page.locator('#prose-c1').innerHTML();
await page.click('#rg-cyper');
const cyper = await page.locator('#prose-c1').innerHTML();
const c5cyp = await page.locator('#prose-c5').innerHTML();
ok('register switch changes prose (bee→cypherpunk)', bee !== cyper && c5cyp.includes('3a0be7b'));
await page.click('#rg-bee');
ok('bee prose restored', (await page.locator('#prose-c1').innerHTML()) === bee);

// corpus law
await page.selectOption('#father', 'ru');
const chips = await page.locator('#corpusChips').innerHTML();
ok('corpus labels follow father tongue (ru)', chips.includes('акт ожидает') && chips.includes('⚙ machine draft'));
await page.selectOption('#father', 'en');
ok('corpus back to en, no machine badge', !(await page.locator('#corpusChips').innerHTML()).includes('machine draft'));

// c1: undercount
await page.locator('#ex-c1-opts input[data-i="0"]').check();
await page.locator('#ex-c1-opts input[data-i="1"]').check();
await page.fill('#ex-c1-num', '10000');
await page.click('#ex-c1-go');
ok('c1 correct answer accepted', (await page.locator('#ex-c1-fb').getAttribute('class')).includes('ok'));
ok('c1 ratio computed', (await page.locator('#ex-c1-fb').innerHTML()).includes('4167'));
ok('c1 receipt line', (await page.locator('#line-c1').textContent()).includes('[bUni · c1]') && (await page.locator('#line-c1').textContent()).includes('~160 known'));
ok('c1 status verified', (await page.locator('#st-c1').innerHTML()).includes('✓'));

// c1 wrong-answer control
await page.reload(); await page.waitForTimeout(300);
await page.locator('#ex-c1-opts input[data-i="2"]').check();
await page.click('#ex-c1-go');
ok('c1 wrong answer refused honestly', (await page.locator('#ex-c1-fb').getAttribute('class')).includes('bad'));
await page.reload(); await page.waitForTimeout(300);

// c2: scaling
await page.fill('#ex-c2-w', '80');
ok('c2 protein computed for 80 kg', (await page.locator('#ex-c2-out').innerHTML()).includes('96–128 g/day'));
await page.click('#ex-c2-go');
ok('c2 receipt line', (await page.locator('#line-c2').textContent()).includes('[bUni · c2]'));

// c3
await page.locator('#ex-c3-opts input[data-i="1"]').check();
await page.click('#ex-c3-go');
const c3fb = await page.locator('#ex-c3-fb').innerHTML();
if (!c3fb.includes('minimal sun')) console.log('C3 FB DUMP: ' + c3fb.slice(0, 300));
ok('c3 reconciliation accepted + brake shown', c3fb.includes('minimal sun') && c3fb.includes('iron — 6%'));

// c4
await page.locator('#ex-c4-opts input[data-i="0"]').check();
await page.click('#ex-c4-go');
ok('c4 witness A accepted, B/C refused in prose', (await page.locator('#ex-c4-fb').innerHTML()).includes('two independent oracles'));

// c4 wrong-answer control
await page.reload(); await page.waitForTimeout(300);
await page.locator('#ex-c4-opts input[data-i="2"]').check();
await page.click('#ex-c4-go');
ok('c4 failed-fetch option refused', (await page.locator('#ex-c4-fb').getAttribute('class')).includes('bad'));
await page.reload(); await page.waitForTimeout(300);

// c5: reorder trap then restore
const c5btnCount = await page.locator('#act-c5-pal button').count();
if (c5btnCount === 0) console.log('C5 PAL DUMP: ' + (await page.locator('#act-c5-pal').innerHTML().catch(() => 'ELEMENT MISSING')));
await page.locator('#act-c5-pal button').first().click(); // [idea,works,bug,gap] → works⊗bug adjacent = trap
let palHtml = await page.locator('#act-c5-pal').innerHTML();
ok('c5 swap raises the protan-trap warning', palHtml.includes('protan trap') && palHtml.includes('⚠'));
const liveDE = palHtml.match(/adjacent pairs[^:]*: <b>(\d+)</);
ok('c5 live normal-vision ΔE computed', !!liveDE && Number(liveDE[1]) > 0);
await page.click('#ex-c5-go'); // restore
palHtml = await page.locator('#act-c5-pal').innerHTML();
ok('c5 restore returns the validated order note', palHtml.includes('receipt intact') || palHtml.includes('validated order'));
ok('c5 status verified after restore', (await page.locator('#st-c5').innerHTML()).includes('✓'));

// transcript + graduation
const tlines = await page.locator('#tlines .rline').allTextContents();
ok('transcript holds all five receipts', tlines.length === 5 && tlines.every(l => l.startsWith('[bUni ·')));
ok('progress state reads 5 of 5', (await page.locator('#tstate').textContent()).includes('5 of 5'));
await page.click('text=compose graduation review line');
const grad = await page.locator('#gradOut').textContent();
ok('graduation line is [bX review] grammar', grad.startsWith('[bX review] ✅ works university/index.html'));
ok('no errors across the whole walk', errors.length === 0);

// hub + review registration
await page.goto(`${BASE}/surfaces/index.html`);
ok('hub links the university', (await page.locator('a[href="university/index.html"]').count()) === 1);
ok('hub counts 32', (await page.locator('footer').textContent()).includes('32 surfaces'));
await page.goto(`${BASE}/surfaces/review.html`);
const optCount = await page.locator('#surf option').count();
const hasUni = (await page.locator('#surf option[value="university/index.html"]').count()) === 1;
ok('review deck lists the university surface', optCount === 28 && hasUni);

console.log(`\n${pass} passed, ${fail} failed` + (errors.length ? '\nerrors:\n' + errors.join('\n') : ''));
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
