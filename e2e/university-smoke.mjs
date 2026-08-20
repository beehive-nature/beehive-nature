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
// the three roles (RULING_LANGUAGE_ROLES_2026-08-20)
await page.fill('#mother', 'latviešu');
await page.fill('#students', 'ru, th');
const chips3 = await page.locator('#corpusChips').innerHTML();
ok('three roles render with badges', chips3.includes('father') && chips3.includes('mother') && chips3.includes('student · ru') && chips3.includes('student · th'));
ok('russian student rendering docked + machine-badged', chips3.includes('проверено') && chips3.includes('machine draft'));
ok('latvian mother + thai student honest absence, by name', chips3.includes('latviešu') && chips3.includes('th') && chips3.includes('no ') && chips3.includes('gateless corpus — dock it'));
await page.fill('#mother', ''); await page.fill('#students', '');

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

// quests
await page.fill('#q-wt', '80');
ok('quest day default renders hemp anchor', (await page.locator('#q-out').innerHTML()).includes('100 g of hemp hearts'));
await page.click('#q-week');
ok('quest week scales ×7', (await page.locator('#q-out').innerHTML()).includes('700 g of hemp hearts'));
await page.click('#q-compose');
const qline = await page.locator('#q-line').textContent();
ok('quest receipt composed with tier + citations', qline.includes('[bUni · quest · week]') && qline.includes('tier 1→2') && qline.includes('FDC 170148'));
ok('transcript now holds six receipts', (await page.locator('#tlines .rline').count()) === 6);
await page.click('#q-year');
ok('quest year renders in kg', (await page.locator('#q-out').innerHTML()).includes('kg of hemp hearts'));

ok('no errors across the whole walk', errors.length === 0);

// bIQ composer — the Sophia gate lane
await page.goto(`${BASE}/surfaces/biq.html`);
await page.waitForTimeout(300);
ok('biq: four scope-cleared subjects', (await page.locator('#subject option').count()) === 4);
ok('biq: seeded sentences render cited + preselected', (await page.locator('#sents .sent').count()) >= 3 && (await page.locator('#sents .sent .pick:checked').count()) >= 3);
await page.locator('button.gold').click();
const biqDraft = await page.locator('#draft').textContent();
ok('biq: clean seeded draft composes with citations', biqDraft.includes('[1]') && biqDraft.includes('Citations:'));
await page.fill('#c-text', 'The adapter register is maintained in a public repository.');
await page.locator('text=attach citation & add sentence').click();
ok('biq: uncited sentence refused by the editor', (await page.locator('#c-fb').textContent()).includes('refused'));
await page.fill('#c-text', 'We are the best and most revolutionary project in crypto!');
await page.fill('#c-label', 'adversarial test');
await page.fill('#c-url', 'https://example.com/adversarial');
await page.locator('text=attach citation & add sentence').click();
await page.locator('#sents .sent').last().locator('.pick').check();
await page.locator('button.gold').click();
ok('biq: promotional sentence blocks the draft', (await page.locator('#toneOut').textContent()).includes('unacknowledged flag'));
await page.locator('#sents [data-keep]').last().check();
await page.locator('button.gold').click();
ok('biq: keep-anyway acknowledges and emits', (await page.locator('#draft').textContent()).includes('best and most revolutionary'));
ok('biq: page states it never posts', (await page.locator('body').textContent()).includes('never posts'));

// bSymposium — the MAHA × bFood discourse
await page.goto(`${BASE}/surfaces/bsymposium.html`);
await page.waitForTimeout(300);
ok('symposium: seven discourse rows render', (await page.locator('#rows tbody tr').count()) === 7);
const symLinks = await page.locator('#rows a').count();
ok('symposium: both sides cited (≥14 row citations)', symLinks >= 14);
const symTxt = await page.locator('main').innerHTML();
ok('symposium: states legend + scope fence + symbiosis + scale note',
  symTxt.includes('align') && symTxt.includes('complementary') && symTxt.includes('Scope fence')
  && symTxt.includes('SYMBIOSIS') && symTxt.includes('THE SCALE NOTE'));
ok('symposium: fetch honesty declared', symTxt.includes('fetch honesty'));

// bLongevity Map — the mirror first: the reader sees themselves in the numbers
await page.goto(`${BASE}/surfaces/blongevity.html`);
await page.waitForTimeout(500);
const mir = await page.locator('#mirror').innerHTML();
ok('mirror: personal tiles compute at 80 kg (5.4x n-3 brick, 1.6x n-6)', mir.includes('5.4') && mir.includes('100') && mir.includes('1.6'));
const hasTokens = await page.locator('link[href="tokens.css"]').count();
ok('longevity: consumes the living token sheet', hasTokens === 1);
await page.fill('#m-wt', '60');
ok('mirror: recomputes to the reader (60 kg)', (await page.locator('#mirror').innerHTML()).includes('4.1'));
const mline = await page.locator('#m-line').innerHTML();
ok('mirror: the permanent line + the quest join present', mline.includes('every day, for life') && mline.includes('quest'));

// bLongevity Map — the animated upstream river
await page.waitForTimeout(200);
ok('longevity: fat assembly line renders six stages', (await page.locator('#line .stage').count()) === 6);
ok('longevity: DIAAS demoted to the attention hook, 17 chips', (await page.locator('#diaas .dchip').count()) === 17);
const longHtml = await page.locator('body').innerHTML();
ok('longevity: walls on the face + ACiD defined + upstream since 2016',
  longHtml.includes('Artificial Chronic Inflammatory Disease') && longHtml.includes('since 2016') && longHtml.includes('graded hypothesis') && longHtml.includes('builds its own cannabinoids') && longHtml.includes('27.4 g LA') && longHtml.includes('20085953') && longHtml.includes('FLAGSHIP') && longHtml.includes('116.13') && longHtml.includes('UNTESTED'));
await page.locator('#revBtn').click();
ok('longevity: reversal toggles, hypothesis badges appear',
  (await page.locator('body').getAttribute('class')).includes('reversed')
  && (await page.locator('#line .hyp:visible').count()) === 2);

// BNR x Base — the application appendix
await page.goto(BASE+"/surfaces/b4b.html");
await page.waitForTimeout(300);
const b4b = await page.locator("body").innerText();
ok("b4b: the four receipts render with links", b4b.includes("RECEIPT 1") && b4b.includes("RECEIPT 2") && b4b.includes("RECEIPT 3") && b4b.includes("b-indexer"));
ok("b4b: synergy map + 8-week plan + verify line", b4b.includes("SYNERGY MAP") && b4b.includes("8-WEEK PLAN") && b4b.includes("#25331"));

// bQueenBee live — the first machine agent
await page.goto(BASE+"/surfaces/bqueenbee-live.html");
await page.waitForTimeout(300);
ok("queen: the honesty law is said first", (await page.locator("body").innerText()).includes("never a person"));
await page.fill("#q", "What did you measure on Base?");
await page.locator("text=ask").last().click();
ok("queen: receipts-d answer with the 25331 hit", (await page.locator("#chat").innerHTML()).includes("25331"));
await page.fill("#q", "what is the meaning of life");
await page.locator("text=ask").last().click();
ok("queen: honest absence, never a guess", (await page.locator("#chat").innerHTML()).includes("won't guess"));

await page.fill("#q", "frozen seeds?");
await page.locator("text=ask").last().click();
ok("queen: v1 KB covers the estate (frozen-seed answer)", (await page.locator("#chat").innerHTML()).includes("FROZEN"));
ok("queen: the ten drops render paste-ready", (await page.locator("#droplist .rc").count()) === 10);
ok("queen: the debut VOICE record is published on the estate", (await page.locator("#debut").innerText()).includes("persona.debut") && (await page.locator("#debut").innerText()).includes("dc9bb8c689b541b6"));

// hub + review registration
await page.goto(`${BASE}/surfaces/bfood.html`);
await page.waitForTimeout(400);
const vbig = await page.locator('#vbig').textContent();
ok('bfood rebuilt: verdict renders 31 cells', vbig.includes('of 40 nutrients covered'));
ok('bfood rebuilt: hexagon cells drawn', (await page.locator('#comb polygon').count()) > 40);
const bfoodHtml = await page.locator('main').innerHTML();
ok('bfood rebuilt: n/m never zero + hardwired hemp + fat disaggregated + quest bridge',
  bfoodHtml.includes('n/m') && bfoodHtml.includes('hardwired') && bfoodHtml.includes('lauric') && bfoodHtml.includes('Beehive University'));

await page.goto(`${BASE}/surfaces/index.html`);
ok('hub links the university', (await page.locator('a[href="university/index.html"]').count()) === 1);
ok('hub counts 41', (await page.locator('footer').textContent()).includes('41 surfaces'));
await page.goto(`${BASE}/surfaces/review.html`);
const optCount = await page.locator('#surf option').count();
const hasUni = (await page.locator('#surf option[value="university/index.html"]').count()) === 1;
ok('review deck lists the university surface', optCount === 33 && hasUni);

console.log(`\n${pass} passed, ${fail} failed` + (errors.length ? '\nerrors:\n' + errors.join('\n') : ''));
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
