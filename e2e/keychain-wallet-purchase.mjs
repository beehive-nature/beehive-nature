// The hosted ANT purchase paid from the isolated keychain, in the real wallet page.
// Serverless: skaists.dev and keys.skaists.dev are served from source by route fulfilment; the
// chain, the storage network and the passkey (a CDP virtual authenticator with PRF) are fixtures.
// TESTNET-ONLY: the paying key is born in a throwaway virtual authenticator; nothing is funded.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {chromium} from 'playwright';
import {installWalletFixture} from './lib/wallet-source-fixture.mjs';

const root = process.cwd(), req = createRequire(import.meta.url);
const {_envelope, _wire} = req('../surfaces/ant-pay.js');
const realm = {TextEncoder, TextDecoder, Uint8Array, crypto: globalThis.crypto, console}; realm.window = realm; realm.self = realm; realm.globalThis = realm;
vm.createContext(realm); vm.runInContext(readFileSync(root + '/surfaces/onboarding/vendor/bnr-sign.js', 'utf8'), realm);
const verify = _envelope.nobleVerifier(realm.BnrSign);
const hexOf = b => Buffer.from(b).toString('hex'), bytesOf = h => new Uint8Array(Buffer.from(h.replace(/^0x/, ''), 'hex'));
const KEYS = {'/': 'keychain/index.html', '/prelude.js': 'keychain/prelude.js', '/keychain.js': 'keychain/keychain.js', '/genesis.js': 'keychain/genesis.js',
  '/vendor/bzdid-key.js': 'surfaces/onboarding/bzdid-key.js', '/vendor/bnr-sign.js': 'surfaces/onboarding/vendor/bnr-sign.js', '/vendor/hive-tx.min.js': 'surfaces/onboarding/vendor/hive-tx.min.js'};

const file = Buffer.from('Isolated keychain purchase fixture; never live funds.');
const sdk = `globalThis.__antFixtureSdk='fixture-0.1.5';
const bytes=new TextEncoder().encode(${JSON.stringify(file.toString())});
export async function getNetworkDefaults(){return {payment:{chainId:42161,paymentTokenAddress:'0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684',paymentVaultAddress:'0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26'},rpcUrl:'https://fixture.invalid/rpc'};}
export class AutonomiClient{static async connect(){return new AutonomiClient();}closed=false;close(){}async upload(file,opts){await opts.onCheckpoint({fixture:true});const n=(await getNetworkDefaults()).payment;await opts.payment.pay(n,[{quoteHash:'0x'+'c'.repeat(64),rewardsAddress:'0x'+'d'.repeat(40),amount:'100'}],{signal:opts.signal});return {file:{address:'fixture-only'},storageCostAtto:'100'};}async download(){return {bytes};}}`;

// Recover the sender of a type-2 envelope from its own bytes, independently of the keychain.
function senderOf(raw) {
  const f = _envelope.decode(raw.slice(4));
  const body = f.slice(0, 9), int = h => h ? BigInt('0x' + h) : 0n;
  return {from: verify.recover(realm.BnrSign.keccak_256(bytesOf('02' + _wire.rlp(body))), int(f[10]), int(f[11]), Number(int(f[9]))), to: '0x' + f[5], data: '0x' + f[7], nonce: '0x' + (f[1] || '0'), gas: '0x' + f[4], maxFeePerGas: '0x' + f[3]};
}

const browser = await chromium.launch();
await installWalletFixture(browser, root);
try {
  const context = await browser.newContext({viewport: {width: 390, height: 1100}});
  await context.route('https://keys.skaists.dev/**', r => {
    const p = new URL(r.request().url()).pathname;
    return KEYS[p] ? r.fulfill({body: readFileSync(root + '/' + KEYS[p]), contentType: p.endsWith('.js') ? 'text/javascript' : 'text/html'}) : r.fulfill({status: 404, body: ''});
  });
  // Consumer branch pins the qualified 0.1.5 SDK: serve only its entry module from the
  // inline fixture; same-version assets fall through to source, other versions abort.
  const sdkPin = {fixture: 'fixture-0.1.5', expected: '/vendor/ant-browser-sdk/0.1.5/index.js', served: 0, unexpected: []};
  await context.route('**/vendor/ant-browser-sdk/**', r => {
    const path = new URL(r.request().url()).pathname;
    if (path === sdkPin.expected) { sdkPin.served++; return r.fulfill({body: sdk, contentType: 'text/javascript'}); }
    if (path.startsWith('/vendor/ant-browser-sdk/0.1.5/')) return r.fallback();
    sdkPin.unexpected.push(path); return r.abort('failed');
  });
  await context.addInitScript(() => {
    localStorage.setItem('bregister', 'bee'); localStorage.setItem('bpay-policy-v1', JSON.stringify({audience: 'public'})); window.__sends = 0; window.__txs = {};
    window.ethereum = {request: async () => { throw Error('The isolated keychain must never fall back to an extension wallet'); }};
  });
  const page = await context.newPage();
  let payer = null;
  await context.route('https://fixture.invalid/rpc', async route => {
    const {method, params: p} = route.request().postDataJSON(); let result;
    if (method === 'eth_chainId') result = '0xa4b1';
    else if (method === 'eth_call') result = p[0].data.startsWith('0xdd62ed3e') ? '0x0' : '0xffff';
    else if (method === 'eth_getBalance') result = '0xffffffffff';
    else if (method === 'eth_gasPrice') result = '0x2';
    else if (method === 'eth_estimateGas') result = '0xc350';
    else if (method === 'eth_getTransactionCount') result = '0x' + (await page.evaluate(() => window.__sends)).toString(16);
    else if (method === 'eth_blockNumber') result = '0x65';
    else if (method === 'eth_getBlockByNumber') result = {hash: '0x' + 'f'.repeat(64), transactions: await page.evaluate(() => Object.values(window.__txs))};
    else if (method === 'eth_getTransactionByHash') result = await page.evaluate(h => window.__txs[h], p[0]);
    else if (method === 'eth_sendRawTransaction') {
      const tx = senderOf(p[0]);
      assert.equal(tx.from, payer, 'every payment is signed by the isolated keychain account');
      const hash = '0x' + hexOf(realm.BnrSign.keccak_256(bytesOf(p[0].slice(2))));
      result = await page.evaluate(({hash, tx}) => { window.__sends++; window.__txs[hash] = {...tx, hash, input: tx.data, value: '0x0', chainId: '0xa4b1'}; return hash; }, {hash, tx});
    }
    else if (method === 'eth_getTransactionReceipt') result = {transactionHash: p[0], blockNumber: '0x64', blockHash: '0x' + 'f'.repeat(64), status: '0x1', gasUsed: '0xc350', effectiveGasPrice: '0x2'};
    else throw Error(method);
    await route.fulfill({json: {jsonrpc: '2.0', id: 1, result}});
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {options: {protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true}});

  await page.goto('https://skaists.dev/surfaces/wallet.html');
  await page.locator('[data-wallet-store]').click(); await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
  if (!await page.locator('#ant-purchase').count()) await page.locator('[data-audience="public"]').click();
  if (!await page.locator('#ant-purchase').evaluate(el => el.open)) await page.locator('#ant-purchase summary').first().click();

  // No wallet keychain is connected in this page at all: the isolated keychain is the only key.
  await page.locator('#ant-buy-keychain iframe').waitFor({timeout: 20000});
  const kc = page.frames().find(f => f.url().startsWith('https://keys.skaists.dev/'));
  await kc.getByRole('button', {name: 'Make my keychain'}).click();
  await page.getByText('Your isolated keychain is open and pays from its own account.').waitFor({timeout: 20000});
  payer = (await kc.locator('dd.mono').nth(1).innerText()).trim();
  assert.match(payer, /^0x[0-9a-f]{40}$/);
  assert.equal(await page.evaluate(() => typeof window.MPRK), 'undefined');

  await page.locator('#ant-buy-file').setInputFiles({name: 'fixture.txt', mimeType: 'text/plain', buffer: file}); await page.locator('#ant-buy-gas').fill('0.00000000002');
  await page.locator('#ant-buy-start').click();
  await page.getByRole('button', {name: 'Authorize this invoice and ask my wallet'}).click();
  // Two payments (approval, then payForQuotes), each confirmed inside the keychain.
  for (const what of [/Let the Autonomi storage vault collect up to/, /Pay 0\.0+1 ANT to 1 Autonomi storage node/]) {
    await kc.getByText(what).waitFor({timeout: 20000});
    await page.locator('#ant-buy-keychain iframe').evaluate(f => f.scrollIntoView({block: 'center'}));
    await page.waitForTimeout(900);
    await kc.getByRole('button', {name: 'Sign this payment'}).click();
  }
  for (let i = 0; i < 150; i++) { const t = await page.locator('#ant-buy-status').innerText(); if (t.startsWith('Storage stopped:')) throw Error(t); if (t.startsWith('Stored and retrieved:')) break; await page.waitForTimeout(100); }
  assert.match(await page.locator('#ant-buy-status').innerText(), /^Stored and retrieved:/);
  assert.equal(await page.evaluate(() => window.__sends), 2);
  const receipt = JSON.parse(await page.locator('#ant-buy-receipt').textContent());
  assert.equal(receipt.transactions.length, 2); assert.equal(receipt.retrievedBytes, file.length);
  assert.equal(await page.evaluate(() => window.__antFixtureSdk), sdkPin.fixture, 'the loaded module is the intended inline fixture');
  assert.ok(sdkPin.served > 0, 'the intended 0.1.5 fixture module was actually requested');
  assert.deepEqual(sdkPin.unexpected, [], 'no unexpected SDK version request occurred');
  console.log('PASS isolated keychain purchase: wallet page holds no key, two payments confirmed in keys.skaists.dev, independent sender check, verified retrieval');
} finally { await browser.close(); }
