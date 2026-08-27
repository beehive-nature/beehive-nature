/* midi-swap-facts.mjs — one-off: the swap popup's on-chain legs, verified.
   1. selectors computed with the page's OWN keccak (no memory-trust)
   2. SwapRouter02 + QuoterV2 exist on Base (eth_getCode)
   3. a LIVE quote WETH->MiDi through the 1% pool returns real MiDi out */
import { chromium } from 'playwright';
const RPC = 'https://base-rpc.publicnode.com';
const WETH = '0x4200000000000000000000000000000000000006';
const MIDI_B = '0xf7Cf2DF510bc0EC400232874f2fB4F2cDf9352d6';
const ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';  // SwapRouter02 on Base (candidate)
const QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';  // QuoterV2 on Base (candidate)
const w = n => BigInt(n).toString(16).padStart(64, '0');
const ad = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
async function call(to, data) {
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call', params:[{ to, data }, 'latest'] }) });
  const j = await r.json();
  return j.result !== undefined ? j.result : 'ERR:' + JSON.stringify(j.error).slice(0, 90);
}
async function getCode(a) {
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_getCode', params:[a, 'latest'] }) });
  const j = await r.json();
  return j.result ? j.result.length : 0;
}

/* 1. selectors via the page's keccak — the same function that powers namehash */
const browser = await chromium.launch({ args:['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8912/surfaces/blight/midi.html', { waitUntil:'domcontentloaded', timeout:30000 });
await page.waitForFunction(() => typeof keccak256 === 'function', null, { timeout:15000 });
const sels = await page.evaluate(async () => {
  const sigs = [
    'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
    'quoteExactInputSingle((address,address,uint256,uint24,uint160))',
  ];
  const hexB = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return sigs.map(s => '0x' + hexB(keccak256(new TextEncoder().encode(s))).slice(0, 8));
});
await browser.close();
console.log('exactInputSingle selector :', sels[0]);
console.log('quoteExactInputSingle    :', sels[1]);

/* 2. do the candidates exist on Base? */
const rc = await getCode(ROUTER), qc = await getCode(QUOTER);
console.log('SwapRouter02 code bytes   :', rc, rc > 100 ? '(EXISTS)' : '(MISSING — wrong address!)');
console.log('QuoterV2 code bytes       :', qc, qc > 100 ? '(EXISTS)' : '(MISSING — wrong address!)');

/* 3. live quote: 0.01 ETH -> MiDi through the 1% pool (9-decimal token) */
const ETH_IN = BigInt('10000000000000000'); // 0.01e18
const q = await call(QUOTER, sels[1] + ad(WETH) + ad(MIDI_B) + w(ETH_IN) + w(10000) + w(0));
if (q.startsWith('ERR') || q === '0x') {
  console.log('quote FAILED:', q);
} else {
  const amountOut = BigInt('0x' + q.slice(2, 66));
  console.log('quote 0.01 ETH -> ' + Number(amountOut) / 1e9 + ' MiDi (live, 1% pool)');
  console.log('sanity: > 0 and < totalSupply:', amountOut > 0n && amountOut < 210000000n * 10n ** 9n);
}
