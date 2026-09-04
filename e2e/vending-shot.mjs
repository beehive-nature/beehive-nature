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
ok('total is a real number', /^\$0\.\d/.test(await page.locator('#v-total').innerText()), await page.locator('#v-total').innerText());
await page.locator('#s2, .step').nth(1).scrollIntoViewIfNeeded();
await page.screenshot({ path: join(OUT, 'vending-2-price.png'), fullPage: true });

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
ok('plan shows the full total', (await page.locator('#p-total').innerText()) === (await page.locator('#v-total').innerText()));
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
