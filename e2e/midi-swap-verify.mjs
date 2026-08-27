/* midi-swap-verify.mjs — the swap popup, verified with a fake EIP-1193 wallet.
   The popup builds the trade; the rig checks: no auto-connect, connect+Base
   guard (incl. wrong-chain switch), LIVE quote from QuoterV2, and the exact
   transaction handed to the wallet — router, value, calldata word by word
   (tokenIn=WETH, tokenOut=MiDi B, fee=10000, recipient=you, deadline>now,
   amountIn=0+msg.value, minOut within 1% of the live quote). A real signed
   trade is the founder's hands, never faked here. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8912';
const ROUTER = '0x2626664c2603336e57b271c5c0b26f421741e481';
const WETH = '0x4200000000000000000000000000000000000006';
const MIDI_B = '0xf7cf2df510bc0ec400232874f2fb4f2cdf9352d6';
const ACCT = '0x1111111111111111111111111111111111111111';
const results = [];
const check = (name, ok, detail='') => { results.push({name, ok}); console.log((ok?'PASS':'FAIL')+'  '+name+(detail?'  — '+detail:'')); };
const w = n => BigInt(n).toString(16).padStart(64, '0');

function providerInit(chainId, stateful) {
  return `
    window.__calls = []; window.__txs = []; window.__switched = null;
    let chain = '${chainId}';
    window.ethereum = { request: async (args) => {
      window.__calls.push(args.method);
      if (args.method === 'eth_chainId') return chain;
      if (args.method === 'eth_requestAccounts') return ['${ACCT}'];
      if (args.method === 'wallet_switchEthereumChain') { window.__switched = args.params[0].chainId; ${stateful ? "chain = '0x2105';" : ''} return null; }
      if (args.method === 'wallet_addEthereumChain') { window.__switched = 'added'; ${stateful ? "chain = '0x2105';" : ''} return null; }
      if (args.method === 'eth_sendTransaction') { window.__txs.push(args.params[0]); return '0x' + 'ab'.repeat(32); }
      throw new Error('unexpected method ' + args.method);
    } };`;
}

const browser = await chromium.launch({ args:['--no-sandbox'] });

/* ── run 1: right chain ── */
{
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  await ctx.addInitScript({ content: providerInit('0x2105', false) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0,120)));
  await page.goto(BASE + '/surfaces/blight/midi.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForTimeout(4000);

  const pre = await page.evaluate(() => window.__calls.length);
  check('no auto-connect: wallet untouched until the click', pre === 0, pre + ' calls before');

  await page.click('#swapbtn');
  const modalVisible = await page.evaluate(() => !document.getElementById('swapmodal').hidden);
  check('popup opens', modalVisible);
  await page.click('#sw-connectbtn');
  await page.waitForTimeout(800);
  const acct = await page.textContent('#sw-acct');
  check('connects and shows the account', /0x1111/i.test(acct.replace(/\s+/g,'')), acct.trim());
  const noSwitch = await page.evaluate(() => window.__switched);
  check('already on Base — no chain switch requested', noSwitch === null);

  await page.waitForFunction(() => /MiDi/.test(document.getElementById('sw-quote').textContent), null, { timeout:30000 });
  const quote = await page.textContent('#sw-quote');
  check('live quote renders with level preview', /MiDi/.test(quote) && /lands level/.test(quote), quote.replace(/\s+/g,' ').trim());
  const quotedOut = await page.evaluate(() => {
    const m = /([\d,]+)\s*MiDi/.exec(document.getElementById('sw-quote').textContent);
    return m ? Number(m[1].replace(/,/g, '')) : null;
  });
  check('quote is a real positive number', quotedOut !== null && quotedOut > 0, quotedOut + ' MiDi for 0.01 ETH');

  await page.click('#sw-go');
  await page.waitForTimeout(700);
  const tx = await page.evaluate(() => window.__txs[0] || null);
  check('wallet received exactly one transaction', await page.evaluate(() => window.__txs.length) === 1);
  const data = tx && tx.data || '';
  const okShape = tx && tx.to && tx.to.toLowerCase() === ROUTER
    && tx.value === '0x2386f26fc10000'   /* 0.01e18 */
    && data.startsWith('0x414bf389');
  check('tx: to SwapRouter02, value 0.01 ETH, exactInputSingle selector', !!okShape,
    tx ? tx.to.slice(0,10) + ' value=' + tx.value : 'no tx');
  const body = data.slice(10);
  const word = i => '0x' + body.slice(i*64, i*64+64);
  const words = [0,1,2,3,4,5,6,7].map(word);
  check('calldata word 0 = WETH', words[0] === '0x' + w(WETH));
  check('calldata word 1 = MiDi B', words[1] === '0x' + w(MIDI_B));
  check('calldata word 2 = fee 10000', words[2] === '0x' + w(10000));
  check('calldata word 3 = recipient = connected account', words[3] === '0x' + w(ACCT));
  const deadline = parseInt(words[4], 16);
  const now = Math.floor(Date.now()/1000);
  check('calldata word 4 = deadline (now..now+25min)', deadline > now && deadline < now + 1500, String(deadline - now) + 's out');
  check('calldata word 5 = amountIn 0 (msg.value carries the ETH)', words[5] === '0x' + w(0));
  const minOut = BigInt(words[6]);
  const quotedWei = BigInt(Math.round(quotedOut * 1e9));
  check('calldata word 6 = minOut within 1% of the live quote (slippage guard)',
    minOut > 0n && minOut <= quotedWei && minOut * 100n >= quotedWei * 99n,
    minOut.toString() + ' vs quote ' + quotedWei.toString());
  check('calldata word 7 = sqrtPriceLimit 0', words[7] === '0x' + w(0));
  const status = await page.textContent('#sw-status');
  check('status shows the tx hash + the next step', /sent — tx/.test(status) && /balance is the seed/.test(status.replace(/\s+/g,' ')), status.replace(/\s+/g,' ').slice(0,80));
  check('no page errors (swap run)', errors.length === 0, errors[0] || 'clean');
  await ctx.close();
}

/* ── run 2: wrong chain → switch requested ── */
{
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  await ctx.addInitScript({ content: providerInit('0x1', true) });
  const page = await ctx.newPage();
  await page.goto(BASE + '/surfaces/blight/midi.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForTimeout(3000);
  await page.click('#swapbtn');
  await page.click('#sw-connectbtn');
  await page.waitForTimeout(1000);
  const sw = await page.evaluate(() => window.__switched);
  check('wrong chain: page requests switch to Base (0x2105)', sw === '0x2105', String(sw));
  const trading = await page.evaluate(() => !document.getElementById('sw-trade').hidden);
  check('after switch, the trade panel shows', trading);
  /* the chat closes the sale too */
  await page.evaluate(() => { document.getElementById('swapmodal').hidden = true; });
  await page.fill('#chatin', 'how do i buy');
  await page.press('#chatin', 'Enter');
  await page.waitForTimeout(500);
  const reopened = await page.evaluate(() => !document.getElementById('swapmodal').hidden);
  check('chat "buy" route reopens the popup', reopened);
  await ctx.close();
}

await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log('\n' + (failed ? failed + ' FAILURES' : 'ALL ' + results.length + ' CHECKS PASS'));
process.exit(failed ? 1 : 0);
