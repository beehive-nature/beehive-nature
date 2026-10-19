// Importing a payment record is importing untrusted evidence. Against the real wallet page's
// handler (not a copy), with the production keychain from source and a fixture chain whose state
// lives in this process: a record that conflicts, is malformed, is inconsistent, or whose kept
// envelope was not signed by its payer is refused before anything is installed; a storage write
// that fails installs nothing and erases nothing; a running purchase refuses the import; and a
// record whose asserted "confirmed" transactions the chain does not know resumes to UNKNOWN —
// exposure held, nothing re-signed, no replacement payment. TESTNET-ONLY: throwaway recovery
// codes; nothing is funded anywhere real.
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
function senderOf(raw) {
  const f = _envelope.decode(raw.slice(4));
  const body = f.slice(0, 9), int = h => h ? BigInt('0x' + h) : 0n;
  return {chainId: Number(int(f[0])), from: verify.recover(realm.BnrSign.keccak_256(bytesOf('02' + _wire.rlp(body))), int(f[10]), int(f[11]), Number(int(f[9]))), to: '0x' + f[5], data: '0x' + f[7], nonce: '0x' + (f[1] || '0'), gas: '0x' + f[4], maxFeePerGas: '0x' + f[3]};
}
const KEYS = {'/': 'keychain/index.html', '/prelude.js': 'keychain/prelude.js', '/keychain.js': 'keychain/keychain.js', '/genesis.js': 'keychain/genesis.js',
  '/vendor/bzdid-key.js': 'surfaces/onboarding/bzdid-key.js', '/vendor/bnr-sign.js': 'surfaces/onboarding/vendor/bnr-sign.js', '/vendor/hive-tx.min.js': 'surfaces/onboarding/vendor/hive-tx.min.js'};
const file = Buffer.from('Record import fixture: untrusted evidence, validated whole; never live funds.');
const GAS = '0.00000000002', CLAIMS = 'bnr.ant.quote-claims.v1';
const sha = '0x' + hexOf(realm.BnrSign.sha256(file)), shaHex = sha.slice(2), JOURNAL = 'bnr.ant.purchase.v1:' + shaHex;
const sdk = `const bytes=new TextEncoder().encode(${JSON.stringify(file.toString())});
export async function getNetworkDefaults(){return {payment:{chainId:42161,paymentTokenAddress:'0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684',paymentVaultAddress:'0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26'},rpcUrl:'https://fixture.invalid/rpc'};}
export class AutonomiClient{static async connect(){return new AutonomiClient();}closed=false;close(){}
 async upload(file,opts){const st=await (await fetch('https://fixture.invalid/sdk-state')).json();await opts.onCheckpoint({fixture:true});const n=(await getNetworkDefaults()).payment;
  await opts.payment.pay(n,[{quoteHash:'0x'+'c'.repeat(64),rewardsAddress:'0x'+'d'.repeat(40),amount:'100'}],{signal:opts.signal});
  if(st.failAfterPay)throw new Error('fixture: the upload was lost after the payment');return {file:{address:'fixture-only'},storageCostAtto:'100'};}
 async download(){return {bytes};}}`;
// one fixture chain per context: nothing crosses between them unless a test says so
const chain = () => ({sends: 0, txs: {}, failAfterPay: false});
async function wire(context, net) {
  await context.route('https://keys.skaists.dev/**', r => { const p = new URL(r.request().url()).pathname; return KEYS[p] ? r.fulfill({body: readFileSync(root + '/' + KEYS[p]), contentType: p.endsWith('.js') ? 'text/javascript' : 'text/html'}) : r.fulfill({status: 404, body: ''}); });
  await context.route('**/vendor/ant-browser-sdk/0.1.1/index.js', r => r.fulfill({body: sdk, contentType: 'text/javascript'}));
  await context.route('https://fixture.invalid/sdk-state', r => r.fulfill({json: {failAfterPay: net.failAfterPay}}));
  await context.route('https://fixture.invalid/rpc', async route => {
    const {method, params: p} = route.request().postDataJSON(); let result;
    if (method === 'eth_chainId') result = '0xa4b1';
    else if (method === 'eth_call') result = p[0].data.startsWith('0xdd62ed3e') ? '0x0' : '0xffff';
    else if (method === 'eth_getBalance') result = '0xffffffffff';
    else if (method === 'eth_gasPrice') result = '0x2';
    else if (method === 'eth_estimateGas') result = '0xc350';
    else if (method === 'eth_getTransactionCount') result = '0x' + net.sends.toString(16);
    else if (method === 'eth_blockNumber') result = '0x65';
    else if (method === 'eth_getBlockByNumber') result = {hash: '0x' + 'f'.repeat(64), transactions: Object.values(net.txs)};
    else if (method === 'eth_getTransactionByHash') result = net.txs[p[0]] || null;
    else if (method === 'eth_sendRawTransaction') { const tx = senderOf(p[0]); const hash = '0x' + hexOf(realm.BnrSign.keccak_256(bytesOf(p[0].slice(2)))); net.sends++; net.txs[hash] = {...tx, hash, input: tx.data, value: '0x0', chainId: '0xa4b1'}; result = hash; }
    else if (method === 'eth_getTransactionReceipt') result = net.txs[p[0]] ? {transactionHash: p[0], blockNumber: '0x64', blockHash: '0x' + 'f'.repeat(64), status: '0x1', gasUsed: '0xc350', effectiveGasPrice: '0x2'} : null;
    else throw Error('fixture rpc: ' + method);
    await route.fulfill({json: {jsonrpc: '2.0', id: 1, result}});
  });
  await context.addInitScript(() => {
    localStorage.setItem('bregister', 'bee'); localStorage.setItem('bpay-policy-v1', JSON.stringify({audience: 'public'}));
    window.ethereum = {request: async () => { throw Error('never an extension wallet'); }};
    // a storage that can be told to refuse one key: the quota/write-failure case
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (window.__refuseKey && k === window.__refuseKey) { window.__refused = (window.__refused || 0) + 1; throw new DOMException('fixture: storage refused the write', 'QuotaExceededError'); } return set.call(this, k, v); };
  });
}
async function openPanel(context, {keychain = false} = {}) {
  const page = await context.newPage();
  await page.goto('https://skaists.dev/surfaces/wallet.html#bpay-sec');
  await page.locator('[data-wallet-store]').click(); await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
  if (!await page.locator('#ant-purchase').count()) await page.locator('[data-audience="public"]').click();
  if (!await page.locator('#ant-purchase').evaluate(el => el.open)) await page.locator('#ant-purchase summary').first().click();
  await page.locator('#ant-buy-record-in').evaluate(i => { i.closest('details').open = true; });
  let kc = null;
  if (keychain) {
    await page.locator('#ant-buy-keychain iframe').waitFor({timeout: 20000});
    kc = page.frames().find(f => f.url().startsWith('https://keys.skaists.dev/'));
    const rec = await kc.evaluate(() => BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(43))); // TEST-ONLY throwaway identity
    await kc.getByText('Open with a recovery code').click(); await kc.getByLabel('Recovery code').fill(rec); await kc.getByRole('button', {name: 'Open', exact: true}).click();
    await page.getByText('Your isolated keychain is open and pays from its own account.').waitFor({timeout: 20000});
  }
  await page.locator('#ant-buy-file').setInputFiles({name: 'r.txt', mimeType: 'text/plain', buffer: file});
  return {page, kc};
}
const stored = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
async function tryImport(page, text) {
  await page.evaluate(() => { document.getElementById('ant-buy-record-status').textContent = ''; }); // never read the previous answer
  await page.locator('#ant-buy-record-in').setInputFiles({name: 'record.json', mimeType: 'application/json', buffer: Buffer.from(text)});
  const say = page.locator('#ant-buy-record-status');
  for (let i = 0; i < 100; i++) { const t = await say.innerText(); if (/^(Record not opened|Payment record opened)/.test(t)) return t; await page.waitForTimeout(100); }
  throw Error('the importer never answered');
}
async function press(page, kc, what) { await kc.getByText(what).waitFor({timeout: 30000}); await page.locator('#ant-buy-keychain iframe').evaluate(f => f.scrollIntoView({block: 'center'})); await page.waitForTimeout(900); await kc.getByRole('button', {name: 'Sign this payment'}).click(); }
async function waitStatus(page, re, ms) { const end = Date.now() + ms; for (;;) { const t = await page.locator('#ant-buy-status').innerText(); if (re.test(t)) return t; if (Date.now() > end) throw Error('status never matched ' + re + ': ' + t); await page.waitForTimeout(200); } }

const browser = await chromium.launch();
await installWalletFixture(browser, root);
try {
  // ── a genuine record: paid on the fixture chain, upload lost after the payment ──
  const origin = chain(); origin.failAfterPay = true;
  let text, record;
  {
    const context = await browser.newContext({viewport: {width: 390, height: 1100}});
    await wire(context, origin);
    const {page, kc} = await openPanel(context, {keychain: true});
    await page.locator('#ant-buy-gas').fill(GAS); await page.locator('#ant-buy-start').click();
    await page.getByRole('button', {name: 'Authorize this invoice and ask my wallet'}).click();
    await press(page, kc, /Let the Autonomi storage vault collect up to/);
    await press(page, kc, /Pay 0\.0+1 ANT to 1 Autonomi storage node/);
    await waitStatus(page, /^Storage stopped: .*the upload was lost after the payment/, 60000);
    assert.equal(origin.sends, 2);
    text = await page.evaluate(async () => (await fetch(document.getElementById('ant-buy-record').href)).text());
    record = JSON.parse(text);
    assert.deepEqual(record.ledger.plans[0].txs.map(t => t.state), ['confirmed', 'confirmed']);
    await context.close();
  }
  const quote = record.ledger.plans[0].payments[0].quote_hash.toLowerCase();
  const mutate = fn => { const r = JSON.parse(text); fn(r); return JSON.stringify(r); };
  const fresh = async (seed) => { const context = await browser.newContext({viewport: {width: 390, height: 1100}}); const net = chain(); await wire(context, net); if (seed) await context.addInitScript(seed); const {page} = await openPanel(context); return {context, page, net}; };
  const expired = mutate(r => { r.ledger.plans[0].expiresAt = 1; r.ledger.plans[0].authorization.expiresAt = 1; }); // the same evidence, its authorization window long shut

  // The window-open path (the identical kept envelope re-offered while the invoice is still authorized,
  // never re-signed) is the payer's own law and is proven with an injectable clock in
  // e2e/ant-hosted-purchase.test.mjs; a browser run cannot reach it deterministically, because the payer
  // first polls the chain for a minute per kept transaction. Case 5 below drives the expired path.

  const untouched = async (page, claimsBefore) => { assert.equal(await stored(page, JOURNAL), null, 'no journal was installed'); assert.equal(await stored(page, CLAIMS), claimsBefore, 'the claims store is exactly what it was'); };

  // ── 1. a quote already claimed by another file here: refused, nothing installed, claims untouched ──
  {
    const other = JSON.stringify({[quote]: 'e'.repeat(64)});
    const {context, page} = await fresh(`localStorage.setItem(${JSON.stringify(CLAIMS)}, ${JSON.stringify(other)})`);
    assert.match(await tryImport(page, text), /^Record not opened: A quote in that record is already claimed by another file in this browser; nothing was replaced/);
    await untouched(page, other);
    await context.close(); console.log('ok   1. conflicting quote ownership refused; nothing installed');
  }
  // ── 2. the claims write fails after the journal write: both restored, nothing half-installed ──
  {
    const prior = JSON.stringify({['0x' + 'b'.repeat(64)]: 'a'.repeat(64)}); // an unrelated existing reservation that must survive
    const {context, page} = await fresh(`localStorage.setItem(${JSON.stringify(CLAIMS)}, ${JSON.stringify(prior)}); window.__refuseKey = ${JSON.stringify(CLAIMS)};`);
    assert.match(await tryImport(page, text), /^Record not opened: This browser could not keep the record \(storage refused the write\); nothing was installed/);
    assert.ok((await page.evaluate(() => window.__refused)) >= 1, 'the write was attempted and refused (the restore tries the same key, and is refused too)');
    await untouched(page, prior);
    await context.close(); console.log('ok   2. write failure after the journal write: failure-atomic, existing reservation kept');
  }
  // ── 3. malformed and inconsistent records are refused before anything is installed ──
  {
    const cases = [
      ['plans is an object, not a list', mutate(r => { r.ledger.plans = {0: r.ledger.plans[0]}; }), /malformed \(no v1 ledger with a list of plans\)/],
      ['a plan total that does not add up', mutate(r => { r.ledger.plans[0].total = '1'; }), /inconsistent \(plan 1 total\)/],
      ['a payer that did not sign the kept envelope', mutate(r => { r.ledger.plans[0].payer = '0x' + '1'.repeat(40); r.ledger.plans[0].authorization.payer = '0x' + '1'.repeat(40); }), /The signed envelope differs from the authorized transaction/],
      ['a nonce the kept envelope does not carry', mutate(r => { r.ledger.plans[0].txs[1].nonce = '0x7'; }), /The signed envelope differs from the authorized transaction: nonce/],
      ['a payment to other quotes than the plan names', mutate(r => { r.ledger.plans[0].payments[0].rewards_address = '0x' + '9'.repeat(40); }), /inconsistent \(plan 1 transaction 2 pays other quotes\)/],
      ['another network inside the ledger', mutate(r => { r.ledger.network.chainId = 31337; }), /names another payment network/],
      ['a record for other bytes', mutate(r => { r.artifact.sha256 = 'f'.repeat(64); r.ledger.artifact.sha256 = 'f'.repeat(64); }), /belongs to a different file/],
      ['a receipt for other bytes', mutate(r => { r.ledger.receipt = {schema: 'bpay.ant.reconciled/1', retrievedSha256: 'f'.repeat(64)}; }), /receipt for other bytes/],
      ['a planned transaction that claims signed bytes', mutate(r => { r.ledger.plans[0].txs[0].state = 'planned'; }), /planned yet signed/],
      ['a submitted transaction without its signed bytes', mutate(r => { delete r.ledger.plans[0].txs[1].raw; }), /sent without its signed bytes/],
      ['an unknown transaction state', mutate(r => { r.ledger.plans[0].txs[1].state = 'paid'; }), /malformed \(plan 1 transaction 2\)/],
      ['not JSON at all', '{not json', /not a payment record/],
    ];
    const {context, page} = await fresh();
    for (const [name, body, re] of cases) {
      const said = await tryImport(page, body);
      assert.match(said, /^Record not opened: /, name + ': ' + said); assert.match(said, re, name + ': ' + said);
      await untouched(page, null);
    }
    await context.close(); console.log('ok   3. ' + cases.length + ' malformed or inconsistent records refused before installation');
  }
  // ── 4. a running purchase holds the lock: the import waits its turn, installing nothing ──
  {
    const {context, page} = await fresh();
    await page.evaluate(() => { window.__hold = navigator.locks.request('bnr-ant-purchase-v1', () => new Promise(() => {})); });
    assert.match(await tryImport(page, text), /^Record not opened: Another tab is handling a storage purchase/);
    await untouched(page, null);
    await context.close(); console.log('ok   4. concurrent purchase (the shared Web Lock) refuses the import');
  }
  // ── 5. asserted "confirmed" the chain does not know, authorization expired: imported as evidence, resumed to UNKNOWN; nothing sent, exposure held ──
  {
    const context = await browser.newContext({viewport: {width: 390, height: 1100}});
    const net = chain(); await wire(context, net); // this chain has never seen the record's transactions
    const {page, kc} = await openPanel(context, {keychain: true});
    const said = await tryImport(page, expired);
    assert.match(said, /^Payment record opened for r\.txt \(2 kept transactions from 0x[0-9a-f]{40}\)\. .*re-read from the chain before it counts, what the chain does not confirm stays unknown/);
    assert.ok(await stored(page, JOURNAL), 'the journal is installed'); assert.equal(JSON.parse(await stored(page, CLAIMS))[quote], shaHex, 'the claim is derived from the record\'s own plan');
    await page.locator('#ant-buy-gas').fill(GAS); await page.locator('#ant-buy-start').click();
    const t = await waitStatus(page, /^Storage stopped: /, 180000); // the payer polls the chain for each kept transaction before giving its verdict
    assert.match(t, /has not reached the network and its invoice has expired\. It stays reserved/, 'the verdict is UNKNOWN and the reservation is held: ' + t);
    assert.equal(net.sends, 0, 'nothing was sent'); assert.equal(await kc.getByRole('button', {name: 'Sign this payment'}).count(), 0, 'nothing was asked to be signed');
    const j = JSON.parse(await stored(page, JOURNAL));
    assert.ok(j.plans[0].txs.every(x => x.state !== 'dropped'), 'the kept transactions and their reservations are still held');
    assert.equal(JSON.parse(await stored(page, CLAIMS))[quote], shaHex, 'the quote stays claimed');
    await context.close(); console.log('ok   5. asserted confirmed, chain unaware, window shut: UNKNOWN on resume; no send, no press, exposure held');
  }
  console.log('PASS record import: untrusted evidence validated whole, envelopes checked independently, claims derived from plans, conflicts and malformed records refused, failure-atomic under the purchase lock, unknown stays unknown');
} finally { await browser.close(); }
