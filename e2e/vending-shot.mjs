// vending-shot.mjs — THE VENDING SURFACE lane receipt (2026-09-03).
// The lane's receipt definition: "390px receipt of all four steps live."
// Live means: rate + tithe + ledger + finality read from the public jungle4
// API during the shot; the certificate verified client-side against
// arweave.net during the shot; every monitor deep-link opened headless and
// READ BACK from the rendered DOM (data visible, not just a page load).
// The pay door is proven behaviorally TWICE:
//   hold  — approve on the money rails with no named seat ⇒ "nothing moved"
//   tap   — a mock injected wallet records every request: ZERO before
//           approval, then exactly ONE eth_sendTransaction (ERC-20 transfer,
//           calldata decoded and checked) after it.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'shots-vending');
await mkdir(OUT, { recursive: true });

const MINT_TX = '3d1f2aa870de6f32b0fb16ae2f4c3c76c735f53e9aa08956e6f74911f5a0c896'; // PUBLIC-CONSTANT jungle4 mint txid (receipted, vendingtest2)
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // PUBLIC-CONSTANT native USDC on Base
const SEAT = '0x1234567890AbCdEf1234567890aBcDeF12345678';     // TESTNET-ONLY mock pay seat for the one-tap exercise
const MON = 'https://monitor.jungletestnet.io/#accountActions:' + MINT_TX;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': MIME[(rel.match(/\.[a-z0-9]+$/) || [])[0]] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch();
let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};

/* ── the clean context: the customer's phone, no wallet injected ── */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
await page.goto(BASE + '/surfaces/vending.html', { waitUntil: 'load' });

/* live reads land */
await page.waitForFunction(() => window.__vending?.law && window.__vending?.price && window.__vending?.certs?.length, null, { timeout: 45000 });
await page.waitForFunction(() => window.__vending?.mints?.length, null, { timeout: 45000 });
const st = () => page.evaluate(() => window.__vending);

/* 1 · NAME — the derived key, the live collision refusal */
await page.locator('#vname').click();
await page.screenshot({ path: join(OUT, 'vending-1-name.png') });
ok('law rows read live from jungle4', (await st()).law?.basisTxt === '0.6000 A',
  JSON.stringify((await st()).law));
ok('tithe read live', (await st()).law?.titheBp === 1000 && (await st()).law?.titheDest === 'kingbeelovis');
ok('price kind is live or labeled', ['live', 'measured 2026-09-01'].includes((await st()).priceKind), String((await st()).priceKind));
const pk1 = await page.locator('#vnamepk').innerText();
/* the oracle that matters is the chain's own row id: fnv1a64('vendingtest2')
   IS the certs.id on jungle4 (34683951899866640) — bit-exact derivation */
const pkOracle = await page.evaluate(() => { let h = 0xcbf29ce484222325n;
  const M = 0xffffffffffffffffn;
  for (const b of new TextEncoder().encode('vendingtest3')) { h ^= BigInt(b); h = (h * 0x100000001b3n) & M; }
  return h.toString(); });
ok('pointer key derived client-side (fnv1a-64, uint64-wrapped — matches the chain row-id law)',
  pk1 === pkOracle && pk1 === '34685051411494851', pk1);
ok('fresh name shows free to mint', (await page.locator('#vnamechk').innerText()).includes('free to mint'));
await page.fill('#vname', 'vendingtest2');
await page.waitForFunction(() => document.querySelector('#vnamechk').innerText.includes('already minted'));
ok('live collision refusal against the real ledger', true);
await page.screenshot({ path: join(OUT, 'vending-1b-name-taken.png') });
ok('mint button disabled while taken', await page.locator('#vmintbtn').isDisabled());

/* 1c · CANONICALIZATION — founder order 2026-09-03. The rail test:
   "mīlestība ir karalis" survives whole; messy spellings land on the SAME
   canonical form (same key, same collision class); zero-width and
   non-breaking characters are REFUSED, never stripped. */
const fnvOracle = s => { let h = 0xcbf29ce484222325n;
  const M = 0xffffffffffffffffn;
  for (const b of Buffer.from(s, 'utf8')) { h ^= BigInt(b); h = (h * 0x100000001b3n) & M; }
  return h.toString(); };
const cleanName = 'mīlestība ir karalis';
await page.fill('#vname', cleanName);
ok('THE RAIL TEST — mīlestība ir karalis survives whole (free to mint, no marker)',
  (await page.locator('#vnamechk').innerText()).includes('free to mint')
  && !(await page.locator('#vcanon').isVisible())
  && (await page.locator('#vnamepk').innerText()) === fnvOracle(cleanName),
  await page.locator('#vnamepk').innerText());
const messy = '  MĪLESTĪBA   IR  karalis ';
await page.fill('#vname', messy);
const canonShown = await page.locator('#vcanonform').innerText();
ok('messy spelling canonicalizes to the SAME form (marker shown, same key)',
  canonShown === cleanName && (await page.locator('#vcanon').isVisible())
  && (await page.locator('#vnamepk').innerText()) === fnvOracle(cleanName)
  && (await page.locator('#vcanon').innerText()).includes('normalized from your input'),
  `"${canonShown}"`);
/* NFC: a decomposed spelling (i + combining macron) lands on the same key */
await page.fill('#vname', cleanName.normalize('NFD'));
ok('decomposed input NFC-normalizes onto the same key',
  (await page.locator('#vnamepk').innerText()) === fnvOracle(cleanName)
  && (await page.locator('#vcanonform').innerText()) === cleanName);
/* refusal classes — refused, never stripped */
await page.fill('#vname', 'mīlestība\u200Bir');
ok('zero-width character REFUSED (U+200B named, mint disabled)',
  (await page.locator('#vnamechk').innerText()).includes('U+200B')
  && (await page.locator('#vnamechk').innerText()).includes('refused')
  && await page.locator('#vmintbtn').isDisabled());
await page.fill('#vname', 'mīlestība\u00A0ir');
ok('non-breaking space REFUSED (U+00A0 named)',
  (await page.locator('#vnamechk').innerText()).includes('U+00A0'));
/* per-tongue lowercasing: Turkish İ → i */
await page.fill('#vname', 'İR');
await page.selectOption('#vtongue', 'turkish');
ok('per-tongue lowercase (Turkish İ→i)', (await page.locator('#vcanonform').innerText()) === 'ir');
await page.selectOption('#vtongue', 'latvian');
/* collision check runs on the CANONICAL form */
await page.fill('#vname', '  VENDINGTEST2  ');
await page.waitForFunction(() => document.querySelector('#vnamechk').innerText.includes('already minted'));
ok('collision check runs on the canonical form ("  VENDINGTEST2  " hits vendingtest2)', true);
/* the PLAN shows the canonical form, marked */
await page.fill('#vname', '  Mīlestība  Ir Karalis ');
await page.locator('#vmintbtn').click();
await page.waitForSelector('#plan.open');
ok('the plan shows the canonical name + the normalization marker',
  (await page.locator('#p-name').innerText()) === cleanName
  && (await page.locator('#p-canon').innerText()).includes('normalized from your input')
  && (await page.locator('#p-canonform').innerText()) === cleanName,
  await page.locator('#p-canonform').innerText());
await page.locator('#prefuse').click();
await page.waitForFunction(() => !document.getElementById('plan').classList.contains('open'));
await page.screenshot({ path: join(OUT, 'vending-1c-canonical.png') });
await page.fill('#vname', 'vendingtest3');

/* 2 · THE PRICE — every line live, $ never n/m */
const priceTxt = await page.locator('.card').nth(1).innerText();
ok('rate line carries the live basis', priceTxt.includes('0.6000 A'), priceTxt.split('\n')[0]);
ok('tithe line carries the live percent + destination', priceTxt.includes('10.00%') && priceTxt.includes('kingbeelovis'));
ok('no not-measured leaks while live', !priceTxt.includes('n/m'));
const totTxt = await page.locator('#v-total').innerText();
const stlaw = (await st()).law;
const wantB = (stlaw.basisA + 0.16 + stlaw.basisA * stlaw.titheBp / 10000).toFixed(2);
ok('hero total is b-denominated and law-true', new RegExp('^' + wantB + ' b$').test(totTxt), totTxt + ' (law says ' + wantB + ')');
ok('the $ figure rides as a labeled reference', /\$0\.\d/.test(await page.locator('#v-total-usd').innerText()), await page.locator('#v-total-usd').innerText());
ok('payment copy truth stands — card and PayPal named unavailable',
  priceTxt.includes('Card and PayPal are not available') && !priceTxt.includes('one tap, no network switch'), '');
await page.locator('#s2, .step').nth(1).scrollIntoViewIfNeeded();
await page.screenshot({ path: join(OUT, 'vending-2-price.png'), fullPage: true });

/* ── THE CONSOLE (founder order 2026-09-17): choose the bee that does my
   work — catalog honesty, autonomy, audience truth, availability gate,
   audience⊥view orthogonality, my bees, receipts ── */
const cards = page.locator('.bcard');
ok('the catalog shelves five bees', (await cards.count()) === 5, String(await cards.count()));
const cardTxts = await cards.allInnerTexts();
ok('four bees honestly say not currently runnable',
  cardTxts.filter(t => /not currently runnable/i.test(t)).length === 4, '');
ok('only the genesis bee is selectable — visible is not a promise',
  (await page.locator('.bcard.pick').count()) === 1
  && (await page.locator('#bee-genesis').getAttribute('aria-pressed')) === 'true', '');
await page.locator('#bee-genealogy').click();
ok('an unavailable bee explains itself and never becomes the purchase',
  (await page.locator('#bnote').isVisible())
  && (await page.locator('#bnote').innerText()).includes('visible is not a promise')
  && (await page.evaluate(() => window.__vending.bee)) === 'genesis'
  && (await page.locator('.bcard.pick').count()) === 1, '');
ok('clicking an unavailable bee does not select it',
  (await page.locator('#bee-genealogy').getAttribute('aria-pressed')) === 'false', '');
await page.locator('#bee-genesis').click();
ok('the genesis bee re-selects', (await page.locator('#bee-genesis').getAttribute('aria-pressed')) === 'true', '');
await page.screenshot({ path: join(OUT, 'console-1-catalog.png'), fullPage: true });

/* autonomy — a real authority mode, default ask-each-time */
ok('autonomy defaults to ask each time — no standing authority',
  (await page.locator('#aut-ask').getAttribute('class')).includes('pick')
  && (await page.locator('#aut-limits').isVisible()) === false, '');
await page.check('input[name=vaut][value=auto]');
ok('automatic-within-limits reveals the ceiling + expiry controls',
  (await page.locator('#aut-limits').isVisible())
  && (await page.locator('#aut-limits').getAttribute('class')).includes('show'), '');
await page.fill('#vceiling', '2.50');
await page.waitForFunction(() => document.getElementById('res-maxauth').innerText.includes('2.50'));
ok('max authorized spend carries the ceiling', (await page.locator('#res-maxauth').innerText()).includes('2.50 b / 24h'),
  await page.locator('#res-maxauth').innerText());
await page.locator('#vmintbtn').click();
await page.waitForSelector('#plan.open');
ok('the plan carries the granted authority (limits verbatim)',
  (await page.locator('#p-auth-limits').isVisible())
  && (await page.locator('#p-ceiling').innerText()) === '2.50'
  && (await page.locator('#p-expiry').innerText()) === '24h'
  && (await page.locator('#plan').innerText()).includes('expanding it takes a new decision from you'), '');
ok('POLICY ≠ ENFORCEMENT — the plan names the grant as recorded policy, the ceiling as the one enforced bound',
  (await page.locator('#p-auth-limits').innerText()).includes('recorded as policy')
  && (await page.locator('#p-auth-limits').innerText()).includes("meter's ceiling"), '');
ok('the plan splits persistent memory from runtime context (never one lock icon)',
  (await page.locator('#plan').innerText()).includes('persistent memory')
  && (await page.locator('#plan').innerText()).includes('not yet qualified')
  && (await page.locator('#plan').innerText()).includes('runtime context')
  && (await page.locator('#plan').innerText()).includes('VERIFIED / NOT VERIFIED'), '');
ok('the plan states pause-not-kill and view-never-authority',
  (await page.locator('#plan').innerText()).includes('paused, never killed')
  && (await page.locator('#plan').innerText()).includes('never what your bee may do'), '');
await page.locator('#prefuse').click();
await page.waitForFunction(() => !document.getElementById('plan').classList.contains('open'));
await page.check('input[name=vaut][value=ask]');
await page.waitForFunction(() => document.getElementById('res-maxauth').innerText.includes('no standing spend'));

/* audience — per-layer truth, visibly-unavailable where unwired; the two
   memory compartments are NEVER one claim (persistent ≠ runtime — the
   Goose shared-store lesson rendered as law) */
const audTxt = await page.locator('.audrow').allInnerTexts();
ok('audience truth: certificate public by construction', audTxt.some(t => t.includes('public by construction')), JSON.stringify(audTxt));
ok('audience truth: persistent memory — your key, deletable (never "only you")',
  audTxt.some(t => /persistent memory/i.test(t) && t.includes('your key · deletable'))
  && !audTxt.some(t => t.includes('only you')), '');
ok('audience truth: private path by design, not yet qualified',
  audTxt.some(t => t.includes('by design · not yet qualified')), '');
ok('audience truth: runtime context — none until the work seat opens',
  audTxt.some(t => /runtime context/i.test(t) && t.includes('until the work seat opens')), '');
ok('audience truth: selected people visibly unwired (struck, never promised)',
  audTxt.some(t => t.includes('not yet wired'))
  && (await page.locator('.audrow .strike').count()) >= 1, '');

/* the pre-launch availability gate — four live checks that qualify THE MINT,
   plus the work-seat row rendered as its own held state (mintable ≠ workable) */
const avrows = await page.locator('.avrow').allInnerTexts();
ok('availability gate shows route·access·tools·funding + work', avrows.length === 5, JSON.stringify(avrows.map(t => t.split('\n')[0])));
ok('the four mint checks pass live', (await page.locator('.avrow .m.ok').count()) === 4, '');
ok('MINTABLE ≠ WORKABLE — the work row is its own held state, outside the gate',
  avrows.some(t => /^WORK/i.test(t) && t.includes('work seat is not yet open') && t.includes('—')),
  avrows.find(t => /^WORK/i.test(t)) || '');
ok('gate says ready to MINT, and names the work seat separately',
  (await page.locator('#avstate').innerText()).includes('ready to mint')
  && (await page.locator('#avstate').innerText()).includes('work seat'),
  await page.locator('#avstate').innerText());
ok('the genesis chip is mint-scoped — AVAILABLE TO MINT, never bee-level "live"',
  /available to mint/i.test(await page.locator('#bee-genesis-chip').innerText()),
  await page.locator('#bee-genesis-chip').innerText());
await page.screenshot({ path: join(OUT, 'console-2-availability.png'), fullPage: true });

/* audience ⊥ view — the tour-bar register pills change presentation,
   NEVER price, audience, or authority (the orthogonality law, mechanical) */
const beforeTotal = await page.locator('#v-total').innerText();
const beforeAud = await page.locator('.audrow').allInnerTexts();
await page.locator('#breg-cypherpunk').click();
await page.waitForFunction(() => document.body.getAttribute('data-reg') === 'cypherpunk');
ok('cypherpunk view stands the disclosures open by default',
  await page.locator('details[data-reg-disclose]').first().evaluate(d => d.open), '');
ok('ORTHOGONAL: view change never touches the price',
  (await page.locator('#v-total').innerText()) === beforeTotal, beforeTotal + ' → ' + (await page.locator('#v-total').innerText()));
ok('ORTHOGONAL: view change never touches the audience rows',
  JSON.stringify((await page.locator('.audrow').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')))
  === JSON.stringify(beforeAud.map(t => t.replace(/\s+/g, ' '))), '');
await page.locator('#breg-bee').click();
await page.waitForFunction(() => document.body.getAttribute('data-reg') === 'bee');
ok('back on new bee view, the price is unchanged',
  (await page.locator('#v-total').innerText()) === beforeTotal, '');

/* my bees — the ledger's own rows, nothing invented */
const certsN = (await st()).certs.length;
ok('my bees renders every ledger row', (await page.locator('#bee-list .bee').count()) === certsN,
  certsN + ' certs / ' + (await page.locator('#bee-list .bee').count()) + ' bees');
const beeTxts = await page.locator('#bee-list .bee').allInnerTexts();
ok('each bee carries finality honestly (final or sealing, from the walk)',
  beeTxts.every(t => t.includes('final') || t.includes('sealing') || t.includes('none on record')), '');

/* receipts — every landed mint plus the held doors */
const rcpt = await page.locator('.rrow').allInnerTexts();
ok('receipts list every landed mint', rcpt.filter(t => t.includes('mint ·')).length === (await st()).mints.length, '');
ok('the held money-rail is named as the actionable block',
  rcpt.some(t => /held/i.test(t) && t.includes('payment seat')), '');
await page.screenshot({ path: join(OUT, 'console-3-mybees-receipts.png'), fullPage: true });

/* 3 · WATCH IT LAND — shot FIRST, in its canonical landed state, before the
   door tests arm the watcher and write their own status lines */
const land = await page.evaluate(() => ({
  mint: window.__vending.mint, href: document.querySelector('#vtx a')?.href,
  capL: document.querySelector('#c-capped-l').innerText, capS: document.querySelector('#c-capped-s').innerText,
  honeyS: document.querySelector('#c-honey-s').innerText }));
ok('comb follows a real mint tx', !!land.mint, land.mint?.name + ' @ ' + land.mint?.block);
ok('the mint is irreversible on chain', land.mint?.irrev === true);
ok('final cell sealed with the tick', land.capL.includes('final') && land.capL.includes('✓') && land.capS.includes('irreversible'));
ok('honey cell carries the block number', /\d/.test(land.honeyS.replace(/ /g, '')), land.honeyS);
ok('tx link is a monitor #accountActions deep-link', land.href === 'https://monitor.jungletestnet.io/#accountActions:' + land.mint.trx, land.href);
await page.locator('.step').nth(2).scrollIntoViewIfNeeded();
await page.waitForFunction(() => document.querySelector('#vchecked').innerText.includes('checked just now'));
await page.screenshot({ path: join(OUT, 'vending-3-land.png'), fullPage: true });

/* 2b · THE PLAN SCREEN — refuse first; nothing may move */
await page.locator('#vmintbtn').click();
await page.waitForSelector('#plan.open');
const planTxt = await page.locator('#plan').innerText();
ok('plan shows the itemized price again', planTxt.includes('0.6000 A') && planTxt.includes('10.00%') && planTxt.includes('the tithe'));
ok('plan shows the full total — same number the hero references',
  (await page.locator('#p-total').innerText()) === (await page.locator('#v-total-usd').innerText()).match(/\$0\.\d+/)[0],
  (await page.locator('#p-total').innerText()) + ' vs ' + (await page.locator('#v-total-usd').innerText()));
ok('plan names what you asked for', planTxt.includes('vendingtest3') && planTxt.includes('latviešu'));
await page.screenshot({ path: join(OUT, 'vending-2b-plan.png') });
await page.locator('#papprove').scrollIntoViewIfNeeded();   /* the sticky bar — approval in frame */
await page.screenshot({ path: join(OUT, 'vending-2b-plan-buttons.png') });
await page.locator('#prefuse').click();
await page.waitForFunction(() => !document.getElementById('plan').classList.contains('open'));
ok('refuse closes and states nothing moved', (await page.locator('#afterplan').innerText()).includes('nothing moved'));

/* 2c · the door HOLDS on the money rails with no seat named (clean page) */
await page.locator('#vmintbtn').click();
await page.waitForSelector('#plan.open');
await page.check('input[name=vrail][value=usdc]');
await page.locator('#papprove').click();
await page.waitForFunction(() => document.querySelector('#doorstate').innerText.includes('nothing moved'));
ok('money-rail door holds without a founder-named seat', true, 'the ceremony gate, live');
await page.screenshot({ path: join(OUT, 'vending-2c-door-held.png') });
await page.locator('#prefuse').click();

/* 2d · the rehearsal rail arms with its memo binding */
await page.locator('#vmintbtn').click();
await page.waitForSelector('#plan.open');
await page.check('input[name=vrail][value=a]');
await page.locator('#papprove').click();
await page.waitForFunction(() => document.querySelector('#doorstate').innerText.includes('memo is the binding'));
ok('rehearsal rail arms memo-bound to bnrapolltest', (await page.locator('#doorstate').innerText()).includes('vending:vendingtest3'));
await page.screenshot({ path: join(OUT, 'vending-2d-door-armed.png') });
await page.locator('#prefuse').click();

/* 4 · YOURS TO KEEP — the certificate + the client-side resurrection, live */
await page.locator('#vres').scrollIntoViewIfNeeded();
/* the summary updates after every gate — wait for the FINAL shape (gate 11
   of 11, zero failed), not the first intermediate line */
await page.waitForFunction(() => document.querySelectorAll('#vres-list li').length === 11
  && document.querySelector('#vres-sum').innerText.includes('11 checks passed, 0 failed'), null, { timeout: 90000 });
const res4 = await page.evaluate(() => ({ sum: document.querySelector('#vres-sum').innerText,
  gates: [...document.querySelectorAll('#vres-list li')].length,
  fails: [...document.querySelectorAll('#vres-list li .fail')].length,
  cert: window.__vending.cert, quote: document.querySelector('#vcert-q').innerText }));
ok('resurrection ran all 11 gates client-side', res4.gates === 11, res4.gates + ' gates');
ok('ELEVEN PASSED, ZERO FAILED — live', res4.fails === 0 && res4.sum.includes('11 checks passed, 0 failed'), res4.sum.slice(0, 80));
ok('the forged copy was refused live', res4.sum.includes('forged copy was refused'));
ok('certificate card carries the real row', res4.cert.agent_name === 'vendingtest2' && res4.cert.content_hash.startsWith('fa0116af'), res4.cert.agent_name);
ok('the quote filled from the fetched record', res4.quote.includes('member-owned'));
await page.screenshot({ path: join(OUT, 'vending-4-keep.png'), fullPage: true });

ok('zero page errors', errors.length === 0, errors.join(' | '));

/* ── the one-tap proof: a mock wallet records every request ── */
const wctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await wctx.addInitScript(d => {
  window.__VENDING_PAY_SEAT = d.seat;
  window.__walletCalls = [];
  window.ethereum = { request: async a => {
    window.__walletCalls.push({ method: a.method, params: JSON.stringify(a.params || []) });
    if (a.method === 'eth_accounts') return ['0xabc0000000000000000000000000000000000abc'];
    if (a.method === 'eth_sendTransaction') return '0x' + 'beef'.repeat(16);
    return null; } };
}, { seat: SEAT });
const wpage = await wctx.newPage();
await wpage.goto(BASE + '/surfaces/vending.html', { waitUntil: 'load' });
await wpage.waitForFunction(() => window.__vending?.law && window.__vending?.price, null, { timeout: 45000 });
ok('NOTHING moves while the plan is only open', (await wpage.evaluate(() => window.__walletCalls.length)) === 0);
await wpage.locator('#vmintbtn').click();
await wpage.waitForSelector('#plan.open');
await wpage.waitForTimeout(400);
ok('still nothing after the plan renders', (await wpage.evaluate(() => window.__walletCalls.length)) === 0);
await wpage.check('input[name=vrail][value=usdc]');
await wpage.locator('#papprove').click();
await wpage.waitForFunction(() => window.__walletCalls.some(c => c.method === 'eth_sendTransaction'), null, { timeout: 15000 });
const calls = await wpage.evaluate(() => window.__walletCalls);
const sends = calls.filter(c => c.method === 'eth_sendTransaction');
const switchd = calls.filter(c => c.method === 'wallet_switchEthereumChain');
ok('chain switch asked once, to Base', switchd.length === 1 && switchd[0].params.includes('"0x2105"'), JSON.stringify(switchd));
ok('EXACTLY ONE send after approval', sends.length === 1, sends.length + ' sends');
const tx = JSON.parse(sends[0].params)[0];
const wst = await wpage.evaluate(() => ({ law: window.__vending.law, price: window.__vending.price }));
const total = (wst.law.basisA + 0.16 + wst.law.basisA * wst.law.titheBp / 10000) * wst.price;
const units = BigInt(Math.round(total * 1e6));
const want = '0xa9059cbb' + SEAT.replace(/^0x/, '').toLowerCase().padStart(64, '0') + units.toString(16).padStart(64, '0');
ok('the one tap is an ERC-20 transfer of the exact total to the seat',
  tx.to === USDC_BASE && tx.value === '0x0' && tx.data === want,
  'data tail ' + tx.data.slice(-24));
ok('the door reports the live link + sent state',
  (await wpage.locator('#doorstate').innerText()).includes('open USDC on Base in your wallet'));
await wpage.screenshot({ path: join(OUT, 'vending-2e-one-tap-sent.png') });

/* ── the route-blocked state — the bFabLeAPi acceptance case: a customer
   must never finish onboarding into a wall. Route dead ⇒ the shelf says
   temporarily unavailable + preserved, the launch stays locked, the
   operator line stays in the cypherpunk view, and nothing fakes a price. */
{
  const bctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await bctx.route('**jungle4.greymass.com/**', r => r.abort());
  const bpage = await bctx.newPage();
  const berr = [];
  bpage.on('pageerror', e => berr.push(String(e).slice(0, 120)));
  await bpage.goto(BASE + '/surfaces/vending.html', { waitUntil: 'load' });
  await bpage.waitForFunction(() => document.getElementById('avstate').innerText.includes('temporarily unavailable'), null, { timeout: 30000 });
  const avt = await bpage.locator('#avstate').innerText();
  ok('route dead ⇒ "temporarily unavailable" + work and allowance preserved',
    avt.includes('temporarily unavailable') && avt.includes('preserved'), avt.slice(0, 90));
  ok('launch stays locked while the route is unreadable', await bpage.locator('#vmintbtn').isDisabled(), '');
  ok('the genesis chip holds honestly', /temporarily unavailable/i.test(await bpage.locator('#bee-genesis-chip').innerText()),
    await bpage.locator('#bee-genesis-chip').innerText());
  ok('no fake verdict — the price hero rests on a dash, n/m named',
    (await bpage.locator('#v-total').innerText()).includes('—')
    && (await bpage.locator('#l-mint-sub').innerText()).includes('never faked'), '');
  await bpage.screenshot({ path: join(OUT, 'console-4-route-blocked.png'), fullPage: true });
  ok('zero page errors under route failure', berr.length === 0, berr.join(' | '));
  await bctx.close();
}

/* ── the monitor deep-link, rendered and read back ── */
const mctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const mpage = await mctx.newPage();
await mpage.goto(MON, { waitUntil: 'domcontentloaded', timeout: 60000 });
await mpage.waitForTimeout(10000);
let mtxt = await mpage.locator('body').innerText();
if (!mtxt.includes('285021247')) {
  /* the hash route can idle on Main; the monitor's own global search is the
     proven road (monitor-txroute.mjs) — drive it and read back the same view */
  await mpage.goto('https://monitor.jungletestnet.io/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mpage.waitForTimeout(8000);
  await mpage.locator('#globalSearch').fill(MINT_TX);
  await mpage.locator('#globalSearch').press('Enter');
  await mpage.waitForTimeout(10000);
  mtxt = await mpage.locator('body').innerText();
}
ok('monitor deep-link renders the mint tx', mtxt.includes('285021247') && mtxt.toLowerCase().includes('mint'),
  mtxt.includes('285021247') ? 'block 285021247 visible at ' + mpage.url().slice(0, 80) : mtxt.slice(0, 120));
ok('monitor shows finality', /irreversible/i.test(mtxt), '');
await mpage.screenshot({ path: join(OUT, 'monitor-deeplink-1280.png') });

await browser.close(); srv.close();
console.log(fail ? `\n${fail} FAIL` : '\nvending surface receipt: ALL PASS');
process.exit(fail ? 1 : 0);
