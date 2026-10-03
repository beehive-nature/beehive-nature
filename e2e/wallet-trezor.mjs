// Chromium contract checks with a fake official bridge. No hardware or live RPC.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'bnr.wallet.public-accounts.v1';
const SOL = '11111111111111111111111111111111'; // PUBLIC-CONSTANT: system program, fixture only
const EVM = '0x' + 'a2'.repeat(20);
// A public account node assembled from the secp256k1 generator, NOT a secret.
const body = Buffer.alloc(78, 1); body.writeUInt32BE(0x04b24746); body[4] = 3; body.writeUInt32BE(0x80000000, 9);
Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex').copy(body, 45); // PUBLIC-CONSTANT
const hash = bytes => createHash('sha256').update(bytes).digest();
let n = BigInt('0x' + Buffer.concat([body, hash(hash(body)).subarray(0, 4)]).toString('hex')), ZPUB = '';
while (n) { ZPUB = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Number(n % 58n)] + ZPUB; n /= 58n; }
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' }[extname(path)] || 'application/octet-stream');
    res.end(await readFile(join(root, decodeURIComponent(path))));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
let loads = 0, checks = 0;
const errors = [];
const check = (label, condition) => { assert.ok(condition, label); console.log(`PASS ${++checks}: ${label}`); };
await ctx.addInitScript(() => { localStorage.setItem('bregister', 'bee'); window.bridgeCalls = []; window.bridgeMode = 'ok'; });
await ctx.route(url => !url.href.startsWith(origin), async route => {
  const req = route.request(), url = new URL(req.url());
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  const json = value => route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(value) });
  if (url.href === 'https://connect.trezor.io/9/trezor-connect.js') {
    loads++;
    return route.fulfill({ headers, contentType: 'text/javascript', body: `
      window.TrezorConnect={
        init:async p=>{bridgeCalls.push(['init',p]);if(bridgeMode==='init-fail')throw Error('fixture init failure')},
        solanaGetAddress:async p=>reply('solanaGetAddress',p,{address:${JSON.stringify(SOL)}}),
        ethereumGetAddress:async p=>reply('ethereumGetAddress',p,{address:${JSON.stringify(EVM)}}),
        getPublicKey:async p=>reply('getPublicKey',p,{xpubSegwit:${JSON.stringify(ZPUB)}}),
        getAccountInfo:async p=>reply('getAccountInfo',p,{descriptor:bridgeMode==='wrong-descriptor'?'wrong':p.descriptor,balance:'9007199254740993'}),
        solanaSignTransaction:()=>{throw Error('FORBIDDEN SIGNING')},
        ethereumSignTransaction:()=>{throw Error('FORBIDDEN SIGNING')},
        firmwareUpdate:()=>{throw Error('FORBIDDEN FIRMWARE UPDATE')}
      };
      function reply(method,p,data){bridgeCalls.push([method,p]);return bridgeMode==='cancel'?{success:false,payload:{error:'cancelled'}}:{success:true,payload:{serializedPath:bridgeMode==='wrong-path'?"m/44'/501'/99'":p.path,...data}}}
    ` });
  }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  let body = {}; try { body = req.postDataJSON() || {}; } catch {}
  if (body.method === 'getBalance') return json({ result: { value: 1234567890 } });
  if (body.method === 'eth_chainId') return json({ result: /base|1rpc/.test(url.host) ? '0x2105' : /arbitrum/.test(url.host) ? '0xa4b1' : '0x1' });
  if (body.method === 'eth_getBalance' || body.method === 'eth_call') return json({ result: '0x1' });
  return route.abort();
});
const page = await ctx.newPage(); page.on('pageerror', error => errors.push(String(error)));
const entries = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{"entries":[]}').entries, KEY);
const status = () => page.locator('#wa-status').textContent();
async function importAccount(chain, account = '1') {
  await page.locator('#wa-trezor-chain').selectOption(chain);
  await page.locator('#wa-trezor-account').fill(account);
  await page.locator('#wa-trezor-import').click();
  await page.waitForFunction(() => !document.getElementById('wa-trezor-import').disabled);
}
try {
  await page.goto(origin + '/surfaces/wallet.html#wallet-accounts');
  check('bridge absent at page load', loads === 0);
  await page.locator('#wa-trezor').click();
  check('opening import form does not contact Trezor', loads === 0);
  await page.evaluate(() => window.bridgeMode = 'init-fail');
  await importAccount('solana');
  check('init failure saves no account and is surfaced', (await entries()).length === 0 && (await status()).includes('fixture init failure'));
  await page.evaluate(() => window.bridgeMode = 'ok');
  await importAccount('solana', '2');
  let saved = await entries();
  check('Solana account 2 preserves Suite path and public provenance', saved[0].trezor.path === "m/44'/501'/1'" && saved[0].address === SOL && saved[0].kind === 'mine');
  check('public export explicitly requests device display', await page.evaluate(() => bridgeCalls.find(([m]) => m === 'solanaGetAddress')[1].showOnTrezor === true));
  await importAccount('solana', '2');
  check('repeat sync cannot duplicate an account', (await entries()).length === 1 && (await status()).includes('already saved'));
  await page.evaluate(() => window.bridgeMode = 'cancel');
  await importAccount('base');
  check('cancel leaves book unchanged', (await entries()).length === 1 && (await status()).includes('cancelled'));
  await page.evaluate(() => window.bridgeMode = 'wrong-path');
  await importAccount('base');
  check('wrong returned path is refused', (await entries()).length === 1 && (await status()).includes('different derivation path'));
  await page.evaluate(() => window.bridgeMode = 'ok');
  await importAccount('base', '3');
  check('EVM account 3 imports its own path', (await entries())[1].trezor.path === "m/44'/60'/2'/0/0");
  await page.locator('.wa-card').filter({ hasText: EVM }).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#wa-label').fill('Hardware savings');
  await page.locator('#wa-save').click();
  await page.waitForFunction(() => document.getElementById('wa-form').hidden);
  check('renaming retains public derivation provenance', (await entries())[1].trezor.path === "m/44'/60'/2'/0/0");
  await importAccount('bitcoin-account');
  const btc = page.locator('.wa-card').filter({ hasText: ZPUB });
  check('Bitcoin sync stores a whole native SegWit account', (await entries())[2].address === ZPUB);
  check('Bitcoin integer balance stays exact above JS safe integer', await btc.locator('.wa-amount').textContent() === '90071992.54740993 BTC');
  check('Bitcoin account refresh uses public descriptor without device path', await page.evaluate(() => { const p = bridgeCalls.find(([m]) => m === 'getAccountInfo')[1]; return !!p.descriptor && !p.path && p.details === 'basic'; }));
  await page.evaluate(() => window.bridgeMode = 'wrong-descriptor');
  await btc.getByRole('button', { name: 'Refresh', exact: true }).click();
  await btc.locator('.wa-state').filter({ hasText: 'different account' }).waitFor();
  check('wrong Bitcoin descriptor removes previous amount', await btc.locator('.wa-amount').count() === 0);
  check('bridge was loaded once and no signer method was used', loads === 1 && await page.evaluate(() => bridgeCalls.every(([m]) => ['init','getPublicKey','getAccountInfo','solanaGetAddress','ethereumGetAddress'].includes(m))));
  const beforeReload = loads;
  await page.reload();
  await page.locator('.wa-state').filter({ hasText: 'Press Refresh' }).waitFor();
  check('reloading Bitcoin account does not load the bridge automatically', loads === beforeReload);
  await page.locator('#wa-follow').click();
  await page.locator('#wa-chain').selectOption('bitcoin-account');
  await page.locator('#wa-address').fill(ZPUB.slice(0, -1) + (ZPUB.endsWith('1') ? '2' : '1'));
  await page.locator('#wa-save').click();
  check('malformed XPUB checksum is rejected before save or read', (await entries()).length === 3 && (await status()).includes('checksum failed') && loads === beforeReload);
  await page.locator('#wa-cancel').click();
  await page.locator('#wa-trezor').click();
  await page.setViewportSize({ width: 390, height: 844 });
  check('Trezor account import fits mobile', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const shots = join(root, 'e2e', 'shots-wallet-accounts'); await mkdir(shots, { recursive: true });
  await page.locator('#wa-trezor-form').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(shots, 'trezor-import-390.png') });
  const exportsBefore=await page.evaluate(()=>bridgeCalls.filter(([m])=>m==='ethereumGetAddress').length);
  await importAccount('evm','3');
  const expanded=await entries();
  check('one public EVM export adds Ethereum and Arbitrum beside existing Base',expanded.length===5&&['ethereum','base','arbitrum'].every(chain=>expanded.some(r=>r.chain===chain&&r.address===EVM)));
  check('multi-network import preserves existing label and path',expanded.find(r=>r.chain==='base').label==='Hardware savings'&&expanded.filter(r=>['ethereum','base','arbitrum'].includes(r.chain)).every(r=>r.trezor.path==="m/44'/60'/2'/0/0"));
  check('multi-network sync asks the device only once',await page.evaluate(()=>bridgeCalls.filter(([m])=>m==='ethereumGetAddress').length)===exportsBefore+1);
  check('no browser script exceptions', errors.length === 0);
  console.log(`${checks} Trezor checks passed; fake bridge, no device or signing.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
