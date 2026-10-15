// The TEST BUILD of the isolated keychain on wallet.html?net=devnet, with BOTH keychains present.
// Serverless: skaists.dev is served from source by the default-deny fixture, keys-devnet.skaists.dev
// from a build of this checkout (scripts/build-keychain.mjs --testnet), keys.skaists.dev from source;
// the test network's manifests and chain are route fixtures on loopback. TESTNET-ONLY: both
// identities are deterministic throwaway recovery codes; nothing is funded anywhere real.
//
// What it proves:
//   1. with the TEST BUILD keychain open AND the wallet page's own keychain open, the page funds,
//      displays, invoices and pays from the isolated account and never from the page's own;
//      every transaction is confirmed by a press inside the keychain, signed on chain 31337
//   2. an isolated keychain pinned to Arbitrum One (the production pin, served at the devnet
//      origin) is REFUSED by name on the test network: no silent fallback to the page's keychain
//   3. inside the keychains: the production build refuses chain 31337, the TEST BUILD refuses 42161
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {chromium} from 'playwright';
import {installWalletFixture} from './lib/wallet-source-fixture.mjs';

const root = process.cwd(), req = createRequire(import.meta.url);
const {_envelope, _wire} = req('../surfaces/ant-pay.js');
const realm = {TextEncoder, TextDecoder, Uint8Array, crypto: globalThis.crypto, console}; realm.window = realm; realm.self = realm; realm.globalThis = realm;
vm.createContext(realm); vm.runInContext(readFileSync(root + '/surfaces/onboarding/vendor/bnr-sign.js', 'utf8'), realm);
const verify = _envelope.nobleVerifier(realm.BnrSign);
const hexOf = b => Buffer.from(b).toString('hex'), bytesOf = h => new Uint8Array(Buffer.from(h.replace(/^0x/, ''), 'hex'));
function senderOf(raw) {
  const f = _envelope.decode(raw.slice(4));
  const body = f.slice(0, 9), int = h => h ? BigInt('0x' + h) : 0n;
  return {chainId: Number(int(f[0])), from: verify.recover(realm.BnrSign.keccak_256(bytesOf('02' + _wire.rlp(body))), int(f[10]), int(f[11]), Number(int(f[9]))), to: '0x' + f[5], data: '0x' + f[7], nonce: '0x' + (f[1] || '0'), gas: '0x' + f[4], maxFeePerGas: '0x' + f[3]};
}

const TOKEN = '0x5fbdb2315678afecb367f032d93f642f64180aa3', VAULT = '0x8464135c8f25da09e49bc8782676a84730c318bc'; // the devnet's deployed test contracts, as its manifest names them
const KEYS_DEVNET = 'https://keys-devnet.skaists.dev', KEYS_PROD = 'https://keys.skaists.dev', MANIFEST = 'http://127.0.0.1:25000', RPC = 'http://127.0.0.1:45000/';
const build = (...extra) => { const out = mkdtempSync(join(tmpdir(), 'kc-devnet-')); execFileSync(process.execPath, ['scripts/build-keychain.mjs', '--out', out, '--origin', KEYS_DEVNET, '--parent', 'https://skaists.dev', ...extra], {stdio: ['ignore', 'ignore', 'inherit']}); return out; };
const TEST_BUILD = build('--testnet', TOKEN, VAULT), WRONG_PIN = build(); // the production pin served at the devnet origin: a mis-deployment the wallet must refuse
const SRC = {'/': 'keychain/index.html', '/prelude.js': 'keychain/prelude.js', '/keychain.js': 'keychain/keychain.js', '/genesis.js': 'keychain/genesis.js',
  '/vendor/bzdid-key.js': 'surfaces/onboarding/bzdid-key.js', '/vendor/bnr-sign.js': 'surfaces/onboarding/vendor/bnr-sign.js', '/vendor/hive-tx.min.js': 'surfaces/onboarding/vendor/hive-tx.min.js'};
const type = p => p.endsWith('.js') ? 'text/javascript' : 'text/html';
const serveDir = dir => r => { const p = new URL(r.request().url()).pathname, file = p === '/' ? 'index.html' : p.slice(1); try { return r.fulfill({body: readFileSync(join(dir, file)), contentType: type(file)}); } catch { return r.fulfill({status: 404, body: ''}); } };
const serveSrc = r => { const p = new URL(r.request().url()).pathname; return SRC[p] ? r.fulfill({body: readFileSync(root + '/' + SRC[p]), contentType: type(p)}) : r.fulfill({status: 404, body: ''}); };
const endpoints = Array.from({length: 8}, (_, i) => ({multiaddr: `/ip4/10.0.0.5/udp/${30454 + i}/webrtc-direct/certhash/uEiAfixture${i}/p2p/16Uiu2fixture${i}`}));
const browserManifest = {version: 6, network_id: 'fixture-devnet', endpoints, payment_network: {chain_id: 31337, payment_token_address: TOKEN, payment_vault_address: VAULT}};
const devnetManifest = {node_count: 8, evm: {rpc_url: 'http://0.0.0.0:45000/', payment_token_address: TOKEN, payment_vault_address: VAULT}};
const file = Buffer.from('TEST BUILD keychain purchase fixture on the test network; never live funds.');
const sdk = `const bytes=new TextEncoder().encode(${JSON.stringify(file.toString())});
export class AutonomiClient{static async connect(o){if(!o||!o.network||o.network.id!=='bnr-devnet'||!o.expectedPaymentNetwork||o.expectedPaymentNetwork.chainId!==31337)throw new Error('fixture: the page must connect with the devnet profile');return new AutonomiClient();}closed=false;close(){}async upload(file,opts){await opts.onCheckpoint({fixture:true});const n={chainId:31337,paymentTokenAddress:${JSON.stringify(TOKEN)},paymentVaultAddress:${JSON.stringify(VAULT)}};await opts.payment.pay(n,[{quoteHash:'0x'+'c'.repeat(64),rewardsAddress:'0x'+'d'.repeat(40),amount:'100'}],{signal:opts.signal});return {file:{address:'fixture-only'},storageCostAtto:'100'};}async download(){return {bytes};}}`;

// one fixture chain per context: who was funded, what was sent, by whom
function chain(context, expectPayer) {
  const st = {sends: 0, txs: {}, funded: [], balances: [], senders: []};
  context.route(MANIFEST + '/api/browser-manifest.json', r => r.fulfill({json: browserManifest}));
  context.route(MANIFEST + '/api/devnet-manifest.json', r => r.fulfill({json: devnetManifest}));
  context.route(RPC, async route => {
    const {method, params: p} = route.request().postDataJSON(); let result = null;
    if (method === 'eth_chainId') result = '0x7a69';
    else if (method === 'evm_setIntervalMining') result = null;
    else if (method === 'eth_accounts') result = ['0x' + 'f'.repeat(39) + '0'];
    else if (method === 'anvil_setBalance') { st.balances.push(String(p[0]).toLowerCase()); result = null; }
    else if (method === 'eth_sendTransaction') { st.funded.push('0x' + String(p[0].data).slice(34, 74).toLowerCase()); result = '0x' + '1'.repeat(64); }
    else if (method === 'eth_call') result = p[0].data.startsWith('0xdd62ed3e') ? '0x0' : '0x' + (10n * 10n ** 18n).toString(16);
    else if (method === 'eth_getBalance') result = '0xde0b6b3a7640000';
    else if (method === 'eth_gasPrice') result = '0x2';
    else if (method === 'eth_estimateGas') result = '0xc350';
    else if (method === 'eth_getTransactionCount') result = '0x' + st.sends.toString(16);
    else if (method === 'eth_blockNumber') result = '0x65';
    else if (method === 'eth_getBlockByNumber') result = {hash: '0x' + 'f'.repeat(64), transactions: Object.values(st.txs)};
    else if (method === 'eth_getTransactionByHash') result = st.txs[p[0]] || null;
    else if (method === 'eth_sendRawTransaction') {
      const tx = senderOf(p[0]);
      assert.equal(tx.chainId, 31337, 'every envelope names the test chain');
      assert.equal(tx.from.toLowerCase(), expectPayer().toLowerCase(), 'every payment is signed by the isolated TEST BUILD keychain account');
      st.senders.push(tx.from.toLowerCase());
      const hash = '0x' + hexOf(realm.BnrSign.keccak_256(bytesOf(p[0].slice(2))));
      st.sends++; st.txs[hash] = {...tx, hash, input: tx.data, value: '0x0', chainId: '0x7a69'}; result = hash;
    }
    else if (method === 'eth_getTransactionReceipt') result = p[0] === '0x' + '1'.repeat(64) || st.txs[p[0]] ? {transactionHash: p[0], blockNumber: '0x64', blockHash: '0x' + 'f'.repeat(64), status: '0x1', gasUsed: '0xc350', effectiveGasPrice: '0x2'} : null;
    else throw Error('fixture rpc: ' + method);
    await route.fulfill({json: {jsonrpc: '2.0', id: 1, result}});
  });
  return st;
}
async function openWallet(context) {
  await context.route('**/vendor/ant-browser-sdk/0.1.1/index.js', r => r.fulfill({body: sdk, contentType: 'text/javascript'}));
  await context.addInitScript(() => {
    localStorage.setItem('bregister', 'bee'); localStorage.setItem('bnr_soul', 'gatesoul'); localStorage.setItem('bpay-policy-v1', JSON.stringify({audience: 'public'}));
    window.ethereum = {request: async () => { throw Error('The isolated keychain must never fall back to an extension wallet'); }};
  });
  await context.grantPermissions(['local-network-access'], {origin: 'https://skaists.dev'});
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e.message)));
  await page.goto('https://skaists.dev/surfaces/wallet.html?net=devnet#bpay-sec');
  await page.waitForFunction(() => window.BZDIDKEY && window.BNRPAY && BNRPAY.coreArmed(), null, {timeout: 60000});
  // the wallet page's OWN keychain, open too: a deterministic throwaway code, never a person's key
  await page.evaluate(() => { const code = BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(42)); document.getElementById('kc-rec-scaffold').open = true; document.getElementById('kc-rec').value = code; document.getElementById('kc-recgo').click(); });
  await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, {timeout: 30000});
  await page.locator('[data-wallet-store]').click(); await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
  if (!await page.locator('#ant-purchase').count()) await page.locator('[data-audience="public"]').click();
  if (!await page.locator('#ant-purchase').evaluate(el => el.open)) await page.locator('#ant-purchase summary').first().click();
  await page.locator('#ant-buy-keychain iframe').waitFor({timeout: 20000});
  const kc = page.frames().find(f => f.url().startsWith(KEYS_DEVNET + '/'));
  assert.ok(kc, 'the keychain frame on the test network is mounted from the devnet origin, never from keys.skaists.dev');
  // the isolated keychain: a DIFFERENT deterministic throwaway code
  const code = await page.evaluate(() => BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(43)));
  await kc.getByText('Open with a recovery code').click();
  await kc.getByLabel('Recovery code').fill(code);
  await kc.getByRole('button', {name: 'Open', exact: true}).click();
  const pageAccount = (await page.evaluate(({token, vault}) => BNRPAY.antStorageSigner({testnet: {token, vault}}).address(), {token: TOKEN, vault: VAULT})).toLowerCase();
  return {page, kc, errors, pageAccount};
}
const status = page => page.locator('#ant-buy-status').innerText();
async function settle(page, kc) {
  for (let i = 0; i < 600; i++) {
    const sign = kc.getByRole('button', {name: 'Sign this payment'});
    if (await sign.count()) { await page.locator('#ant-buy-keychain iframe').evaluate(f => f.scrollIntoView({block: 'center'})); await page.waitForTimeout(900); if (await sign.count()) await sign.click(); }
    const t = await status(page); if (t.startsWith('Storage stopped:')) throw Error(t); if (t.startsWith('Stored and retrieved:')) return t; await page.waitForTimeout(100);
  }
  throw Error('purchase did not settle');
}

const browser = await chromium.launch();
await installWalletFixture(browser, root);
try {
  // ── 1. both keychains present: the isolated TEST BUILD pays, the page's own never does ──
  {
    const context = await browser.newContext({viewport: {width: 390, height: 1100}});
    await context.route(KEYS_DEVNET + '/**', serveDir(TEST_BUILD));
    let isolated = null; const st = chain(context, () => isolated);
    const {page, kc, errors, pageAccount} = await openWallet(context);
    await kc.getByText('TEST BUILD at keys-devnet.skaists.dev').first().waitFor({timeout: 20000});
    await page.getByText('Your isolated TEST BUILD keychain is open and pays from its own account').waitFor({timeout: 20000});
    isolated = (await kc.locator('dd.mono').nth(1).innerText()).trim().toLowerCase();
    assert.match(isolated, /^0x[0-9a-f]{40}$/);
    assert.notEqual(isolated, pageAccount, 'the two keychains are two accounts');
    assert.match(await kc.locator('dd').nth(2).innerText(), /the local test network \(chain 31337\)/, 'the keychain card says which network it signs on');
    const session = await page.locator('#ant-session-message').innerText();
    assert.ok(session.toLowerCase().includes('paying account: ' + isolated), 'the session line names the isolated account');
    assert.ok(!session.toLowerCase().includes(pageAccount), 'the session line never names the page account');
    // funding goes to the account that will pay
    await page.getByRole('button', {name: 'Get test ANT and test ETH', exact: true}).click();
    await page.getByText(/Funded on the test network|Test funding stopped/).waitFor({timeout: 20000});
    const funding = (await page.locator('#ant-funding').innerText()).toLowerCase();
    assert.match(funding, /funded on the test network/, funding);
    assert.ok(funding.includes(isolated) && funding.includes('(your isolated test build keychain)'), 'the funding line names the isolated account and which keychain it is');
    assert.deepEqual([st.balances, st.funded], [[isolated], [isolated]], 'the chain funded the isolated account only');
    // invoice, authorization, two presses inside the keychain, verified retrieval
    await page.locator('#ant-buy-file').setInputFiles({name: 'fixture.txt', mimeType: 'text/plain', buffer: file}); await page.locator('#ant-buy-gas').fill('0.001');
    await page.locator('#ant-buy-start').click();
    const authorize = page.getByRole('button', {name: 'Authorize this invoice and ask my wallet'});
    await authorize.waitFor({timeout: 60000});
    const invoice = await page.locator('#ant-buy-invoice').innerText();
    assert.ok(invoice.includes('Paying account: ' + isolated), 'the invoice names the isolated account');
    assert.ok(!invoice.toLowerCase().includes(pageAccount), 'the invoice never names the page account');
    await authorize.click();
    assert.match(await settle(page, kc), /^Stored and retrieved:/);
    assert.equal(st.sends, 2, 'approval then payment, both from the keychain');
    assert.deepEqual(st.senders, [isolated, isolated]);
    const receipt = JSON.parse(await page.locator('#ant-buy-receipt').textContent());
    assert.equal(receipt.network.chainId, 31337); assert.equal(receipt.transactions.length, 2); assert.equal(receipt.retrievedBytes, file.length);
    assert.deepEqual(receipt.transactions.map(t => t.hash).sort(), Object.keys(st.txs).sort(), 'the receipt names exactly the transactions the chain saw');
    const record = page.locator('#ant-buy-record');
    assert.equal(await record.evaluate(a => a.hidden), false, 'the payment record is offered (inside the resuming disclosure)');
    assert.match(await record.getAttribute('download'), /-testnet\.json$/, 'a test-network record is named as one');
    assert.deepEqual(errors, [], 'no page errors');
    await context.close();
  }
  // ── 2. the production pin at the devnet origin is refused by name; nothing falls back ──
  {
    const context = await browser.newContext({viewport: {width: 390, height: 1100}});
    await context.route(KEYS_DEVNET + '/**', serveDir(WRONG_PIN));
    const st = chain(context, () => { throw Error('nothing may be signed'); });
    const {page, kc} = await openWallet(context);
    await kc.getByText('Arbitrum One (chain 42161)').waitFor({timeout: 20000});
    await page.getByText('pinned to Arbitrum One and cannot pay on the test network').waitFor({timeout: 20000});
    assert.equal(await page.locator('#ant-buy-start').isDisabled(), true, 'the invoice cannot be prepared');
    await page.getByRole('button', {name: 'Get test ANT and test ETH', exact: true}).click();
    await page.getByText(/Funded on the test network|Test funding stopped/).waitFor({timeout: 20000});
    assert.match(await page.locator('#ant-funding').innerText(), /^Test funding stopped: Your isolated keychain is pinned to Arbitrum One/, 'funding refuses by the same name');
    assert.deepEqual([st.balances, st.funded, st.sends], [[], [], 0], 'nothing was funded or sent');
    await context.close();
  }
  // ── 3. inside the keychains: each build refuses the other chain ──
  {
    const parentHtml = `<!doctype html><meta charset="utf-8"><body><div id="a"></div><div id="b"></div><script src="/surfaces/keychain-client.js"></script>
<script>window.ready=Promise.all([KeychainClient.mount(document.getElementById('a'),{build:'devnet'}),KeychainClient.mount(document.getElementById('b'))]).then(c=>{window.kcs=c;return c.map(x=>!!x);});</script>`;
    const context = await browser.newContext({viewport: {width: 390, height: 1400}});
    await context.route(KEYS_DEVNET + '/**', serveDir(TEST_BUILD));
    await context.route(KEYS_PROD + '/**', serveSrc);
    await context.route('https://skaists.dev/**', r => { const p = new URL(r.request().url()).pathname; if (p === '/kc-parent.html') return r.fulfill({body: parentHtml, contentType: 'text/html'}); if (p === '/surfaces/keychain-client.js') return r.fulfill({body: readFileSync(root + '/surfaces/keychain-client.js'), contentType: 'text/javascript'}); return r.fulfill({status: 404, body: ''}); });
    const page = await context.newPage();
    await page.goto('https://skaists.dev/kc-parent.html');
    assert.deepEqual(await page.evaluate(() => window.ready), [true, true], 'both keychains mount');
    const frames = [page.frames().find(f => f.url().startsWith(KEYS_DEVNET + '/')), page.frames().find(f => f.url().startsWith(KEYS_PROD + '/'))];
    for (const [i, fr] of frames.entries()) {
      await fr.getByText('Open with a recovery code').click();
      await fr.getByLabel('Recovery code').fill(await fr.evaluate(n => BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(n)), 44 + i));
      await fr.getByRole('button', {name: 'Open', exact: true}).click();
      await page.waitForFunction(i => window.kcs[i].state && window.kcs[i].state.state === 'unlocked', i, {timeout: 20000});
    }
    const pins = await page.evaluate(() => window.kcs.map(c => c.state.pin));
    assert.deepEqual(pins.map(p => [p.chain, p.test]), [[31337, true], [42161, false]], 'each keychain announces its own pin');
    const base = {nonce: '0x0', gas: '0xea60', maxFeePerGas: '0x3b9aca00', maxPriorityFeePerGas: '0x0', value: '0x0', to: TOKEN, data: '0x095ea7b3' + VAULT.slice(2).padStart(64, '0') + (100n).toString(16).padStart(64, '0')};
    const ask = (i, chainId) => page.evaluate(({i, tx}) => window.kcs[i].signer().signTransaction(tx).then(() => 'signed', e => e.message), {i, tx: {...base, chainId}});
    assert.match(await ask(0, '0xa4b1'), /the local test network only/, 'the TEST BUILD refuses Arbitrum One');
    assert.match(await ask(1, '0x7a69'), /Arbitrum One only/, 'the production build refuses the test chain');
    await context.close();
  }
  console.log('PASS keychain on the test network: TEST BUILD keychain pays from its own account with the page keychain open too (funding, session, invoice, two presses, chain, receipt all agree); a production-pinned keychain is refused by name; each build refuses the other chain');
} finally { await browser.close(); }
