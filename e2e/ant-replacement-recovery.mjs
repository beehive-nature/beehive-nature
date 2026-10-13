// Interruption and replacement acceptance of the hosted ANT purchase, paid from the isolated
// keychain, in the real wallet page. Serverless: skaists.dev and keys.skaists.dev are served from
// source by route fulfilment; the chain and the storage network are fixtures whose state lives in
// this process, so it outlives any page, context or browser process. TESTNET-ONLY: the identities
// are deterministic throwaway recovery codes; nothing is funded anywhere real.
//
// The law under test: what is persisted before every consequential step (invoice identity and
// scope, the signed envelope and its hash, gas and quote reservations, the upload checkpoint,
// the retrieval reference) is enough that none of the failures below causes a second payment.
//
// EXACTLY what is covered, named by what it is:
//   1. same-context page restart after a lost receipt response — the chain took the payment and
//      answered the submission; every receipt query after that is withheld; the page is closed;
//      a new page in the same browser profile resumes from the journal: no press, no send
//   2. saved-record replacement — the payment landed, the upload was lost, the person SAVED the
//      record before the original browser was gone; a replacement client with empty storage opens
//      it, the wrong file is refused, the right file resumes with no payment and no press, and the
//      receipt names the original transactions
//   3. already-stored, no-payment reuse — no record anywhere; the network already holds the complete
//      file; a stranger's client stores it and pays nothing
//   4. lost submission acknowledgement, same context — the chain took the payment but the
//      submission reply never arrived (the page waited on it when it was closed); resume reads the
//      kept hash from the chain and sends nothing
//   5. abrupt browser-process termination (SIGKILL) after submission, receipts withheld — a
//      persistent profile on disk; the whole browser process is killed, not closed; a new process on
//      the same profile resumes from the journal: no press, no send
//
// NOT covered, and OPEN: a paid-but-incomplete upload where ALL original browser state is lost
// before any record was saved. No fixture here finishes that case, and nothing invents a payment to
// make it finish; it needs an authenticated durable-state path, which this suite does not claim.
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {chromium} from 'playwright';
import {installWalletFixture, routeWalletSource} from './lib/wallet-source-fixture.mjs';

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
const FILES = {
  A: Buffer.from('Recovery fixture A: receipt reply lost, page restarted in the same profile; never live funds.'),
  B: Buffer.from('Recovery fixture B: upload lost, record saved, replacement client; never live funds.'),
  C: Buffer.from('Recovery fixture C: submission acknowledgement lost, same profile; never live funds.'),
  D: Buffer.from('Recovery fixture D: browser process killed after submission; never live funds.'),
};
const GAS = '0.00000000002';
// the storage network and the chain, outside every browser
const net = {sends: 0, txs: {}, senders: [], holdReceipts: false, holdSendReply: false, failAfterPay: false, stored: new Set()};
const sdk = `const files=${JSON.stringify(Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k, v.toString()])))};
const enc=new TextEncoder();const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function getNetworkDefaults(){return {payment:{chainId:42161,paymentTokenAddress:'0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684',paymentVaultAddress:'0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26'},rpcUrl:'https://fixture.invalid/rpc'};}
export class AutonomiClient{static async connect(){return new AutonomiClient();}closed=false;close(){}
 async upload(file,opts){const bytes=new Uint8Array(await file.arrayBuffer()),h=await sha(bytes);const st=await (await fetch('https://fixture.invalid/sdk-state?sha='+h)).json();
  if(st.stored)return {file:{address:'fixture-'+h.slice(0,8)},storageCostAtto:'0'};
  await opts.onCheckpoint({fixture:true,sha:h});const n=(await getNetworkDefaults()).payment;
  await opts.payment.pay(n,[{quoteHash:'0x'+h.slice(0,32)+'c'.repeat(32),rewardsAddress:'0x'+'d'.repeat(40),amount:'100'}],{signal:opts.signal});
  if(st.failAfterPay)throw new Error('fixture: the upload was lost after the payment');
  await fetch('https://fixture.invalid/stored?sha='+h);return {file:{address:'fixture-'+h.slice(0,8)},storageCostAtto:'100'};}
 async download(f){for(const k of Object.keys(files)){const b=enc.encode(files[k]);if(f.address==='fixture-'+(await sha(b)).slice(0,8))return {bytes:b};}throw new Error('fixture: unknown address');}}`;
const sha256 = b => hexOf(realm.BnrSign.sha256(b));

async function wire(context) {
  await context.route('https://keys.skaists.dev/**', r => { const p = new URL(r.request().url()).pathname; return KEYS[p] ? r.fulfill({body: readFileSync(root + '/' + KEYS[p]), contentType: p.endsWith('.js') ? 'text/javascript' : 'text/html'}) : r.fulfill({status: 404, body: ''}); });
  await context.route('**/vendor/ant-browser-sdk/0.1.1/index.js', r => r.fulfill({body: sdk, contentType: 'text/javascript'}));
  await context.route('https://fixture.invalid/sdk-state?**', r => { const h = new URL(r.request().url()).searchParams.get('sha'); return r.fulfill({json: {stored: net.stored.has(h), failAfterPay: net.failAfterPay}}); });
  await context.route('https://fixture.invalid/stored?**', r => { net.stored.add(new URL(r.request().url()).searchParams.get('sha')); return r.fulfill({json: {ok: true}}); });
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
    else if (method === 'eth_sendRawTransaction') {
      const tx = senderOf(p[0]); assert.equal(tx.chainId, 42161);
      const hash = '0x' + hexOf(realm.BnrSign.keccak_256(bytesOf(p[0].slice(2))));
      net.sends++; net.senders.push(tx.from.toLowerCase()); net.txs[hash] = {...tx, hash, input: tx.data, value: '0x0', chainId: '0xa4b1'}; result = hash;
      if (net.holdSendReply) return; /* the endpoint took it; the acknowledgement never comes back */
    }
    else if (method === 'eth_getTransactionReceipt') { if (net.holdReceipts) return; /* the reply never comes */ result = net.txs[p[0]] ? {transactionHash: p[0], blockNumber: '0x64', blockHash: '0x' + 'f'.repeat(64), status: '0x1', gasUsed: '0xc350', effectiveGasPrice: '0x2'} : null; }
    else throw Error('fixture rpc: ' + method);
    await route.fulfill({json: {jsonrpc: '2.0', id: 1, result}});
  });
  await context.addInitScript(() => {
    localStorage.setItem('bregister', 'bee'); localStorage.setItem('bpay-policy-v1', JSON.stringify({audience: 'public'}));
    window.ethereum = {request: async () => { throw Error('The isolated keychain must never fall back to an extension wallet'); }};
  });
}
async function openPurchase(context, {pageKeychain = false, code = 43} = {}) {
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e.message)));
  if (pageKeychain) await page.addInitScript(() => { try { localStorage.setItem('bnr_soul', 'gatesoul'); } catch (e) {} });
  await page.goto('https://skaists.dev/surfaces/wallet.html#bpay-sec');
  if (pageKeychain) {
    await page.waitForFunction(() => window.BZDIDKEY && window.BNRPAY && BNRPAY.coreArmed(), null, {timeout: 60000});
    await page.evaluate(() => { const c = BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(42)); document.getElementById('kc-rec-scaffold').open = true; document.getElementById('kc-rec').value = c; document.getElementById('kc-recgo').click(); });
    await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, {timeout: 30000});
  }
  await page.locator('[data-wallet-store]').click(); await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
  if (!await page.locator('#ant-purchase').count()) await page.locator('[data-audience="public"]').click();
  if (!await page.locator('#ant-purchase').evaluate(el => el.open)) await page.locator('#ant-purchase summary').first().click();
  await page.locator('#ant-buy-keychain iframe').waitFor({timeout: 20000});
  const kc = page.frames().find(f => f.url().startsWith('https://keys.skaists.dev/'));
  const rec = await kc.evaluate(n => BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(n)), code); // TEST-ONLY deterministic throwaway identity
  await kc.getByText('Open with a recovery code').click(); await kc.getByLabel('Recovery code').fill(rec); await kc.getByRole('button', {name: 'Open', exact: true}).click();
  await page.getByText('Your isolated keychain is open and pays from its own account.').waitFor({timeout: 20000});
  const account = (await kc.locator('dd.mono').nth(1).innerText()).trim().toLowerCase();
  return {page, kc, errors, account};
}
const status = page => page.locator('#ant-buy-status').innerText();
async function press(page, kc, what) { await kc.getByText(what).waitFor({timeout: 30000}); await page.locator('#ant-buy-keychain iframe').evaluate(f => f.scrollIntoView({block: 'center'})); await page.waitForTimeout(900); await kc.getByRole('button', {name: 'Sign this payment'}).click(); }
async function waitStatus(page, re, ms = 30000) { const end = Date.now() + ms; for (;;) { const t = await status(page); if (re.test(t)) return t; if (/^Storage stopped:/.test(t) && !re.test(t)) throw Error(t); if (Date.now() > end) throw Error('status never matched ' + re + ': ' + t); await page.waitForTimeout(100); } }
const journal = (page, sha) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), 'bnr.ant.purchase.v1:' + sha);
async function paymentState(page, sha, want) { let payment = null; for (let i = 0; i < 300 && !(payment && payment.state === want); i++) { await page.waitForTimeout(100); const j = await journal(page, sha); payment = j && j.plans[0].txs.find(t => t.kind === 'payment'); } return payment; }
async function begin(page, kc, name, buffer) {
  await page.locator('#ant-buy-file').setInputFiles({name, mimeType: 'text/plain', buffer}); await page.locator('#ant-buy-gas').fill(GAS);
  await page.locator('#ant-buy-start').click();
  await page.getByRole('button', {name: 'Authorize this invoice and ask my wallet'}).click();
  await press(page, kc, /Let the Autonomi storage vault collect up to/);
  await kc.getByText(/Pay 0\.0+1 ANT to 1 Autonomi storage node/).waitFor({timeout: 30000}); // the approval confirmed; the payment is on the card
}
async function resumeAndCheck(page, kc, name, buffer, sendsBefore, hashes) {
  await page.locator('#ant-buy-file').setInputFiles({name, mimeType: 'text/plain', buffer}); await page.locator('#ant-buy-gas').fill(GAS);
  await page.locator('#ant-buy-start').click();
  assert.match(await waitStatus(page, /^Stored and retrieved:/, 90000), /all \d+ bytes match/);
  assert.equal(net.sends, sendsBefore, 'resuming sent nothing new');
  assert.equal(await kc.getByRole('button', {name: 'Sign this payment'}).count(), 0, 'the keychain was never asked again');
  const receipt = JSON.parse(await page.locator('#ant-buy-receipt').textContent());
  assert.deepEqual(receipt.transactions.map(t => t.hash).sort(), hashes, 'the receipt names the kept transactions');
}
const lastTwo = () => Object.keys(net.txs).slice(-2).sort();
const shaOf = k => sha256(FILES[k]);

const browser = await chromium.launch();
await installWalletFixture(browser, root);
try {
  // ── 1. same-context page restart after a lost receipt response ──
  {
    const profile = await browser.newContext({viewport: {width: 390, height: 1100}});
    await wire(profile);
    const {page, kc, errors, account} = await openPurchase(profile, {pageKeychain: true});
    const pageAccount = (await page.evaluate(() => BNRPAY.antStorageSigner().address())).toLowerCase();
    assert.notEqual(account, pageAccount, 'two keychains, two accounts');
    // with both keychains open, funding shows the isolated account and never the page's own
    await page.getByRole('button', {name: 'Fund this wallet · ETH / ANT', exact: true}).click();
    const funding = (await page.locator('#ant-funding').innerText()).toLowerCase();
    assert.ok(funding.includes(account) && funding.includes('(your isolated keychain)') && !funding.includes(pageAccount), 'the funding address is the isolated account: ' + funding);
    await begin(page, kc, 'a.txt', FILES.A);
    net.holdReceipts = true; // the submission is answered; every receipt query after it is withheld
    await press(page, kc, /Pay 0\.0+1 ANT to 1 Autonomi storage node/);
    const payment = await paymentState(page, shaOf('A'), 'submitted');
    assert.equal(net.sends, 2, 'the payment reached the chain');
    assert.equal(payment && payment.state, 'submitted'); assert.ok(payment.raw && payment.hash && payment.reservedWei, 'signed bytes, hash and reservation were kept before the receipt was awaited');
    assert.deepEqual(errors, []);
    await page.close(); // the page dies waiting for a receipt that never came
    net.holdReceipts = false;
    const again = await openPurchase(profile);
    await resumeAndCheck(again.page, again.kc, 'a.txt', FILES.A, 2, lastTwo());
    assert.deepEqual([...new Set(net.senders)], [account]);
    await profile.close();
    console.log('ok   1. same-context page restart after a lost receipt response: resumed from the journal, no second payment, no second press');
  }

  // ── 2. saved-record replacement ──
  let recordFile, hashesB;
  {
    const first = await browser.newContext({viewport: {width: 390, height: 1100}});
    await wire(first);
    net.failAfterPay = true;
    const {page, kc} = await openPurchase(first);
    const sendsBefore = net.sends;
    await begin(page, kc, 'b.txt', FILES.B);
    await press(page, kc, /Pay 0\.0+1 ANT to 1 Autonomi storage node/);
    assert.match(await waitStatus(page, /^Storage stopped: .*the upload was lost after the payment/, 60000), /resume the same file; do not start a second payment elsewhere\. To continue on another browser, save this file’s payment record/);
    assert.equal(net.sends, sendsBefore + 2);
    hashesB = lastTwo();
    const record = page.locator('#ant-buy-record');
    await page.locator('#ant-buy-record').evaluate(a => { a.closest('details').open = true; }); // the person opens 'Limits & resuming'
    await record.waitFor({state: 'visible', timeout: 10000});
    // the saved file's bytes, read from the link the person would press (its blob URL), kept outside the browser
    const recordName = await record.getAttribute('download');
    const text = await page.evaluate(async () => (await fetch(document.getElementById('ant-buy-record').href)).text());
    recordFile = {name: recordName, mimeType: 'application/json', buffer: Buffer.from(text)};
    const saved = JSON.parse(text);
    assert.match(recordName, /^ant-payment-record-[0-9a-f]{16}\.json$/);
    assert.equal(saved.schema, 'bpay.ant.journal/1'); assert.equal(saved.testnet, false); assert.equal(saved.artifact.sha256, shaOf('B'));
    assert.deepEqual(saved.ledger.plans[0].txs.map(t => t.state), ['confirmed', 'confirmed'], 'the record carries the two confirmed payments');
    assert.ok(!/bdidrec|"root"|"seed"|prf/i.test(text), 'the record carries no key material');
    await first.close(); // the original browser is gone for good — AFTER the record was saved
    net.failAfterPay = false;
    const replacement = await browser.newContext({viewport: {width: 390, height: 1100}});
    await wire(replacement);
    const r = await openPurchase(replacement);
    assert.equal(await journal(r.page, shaOf('B')), null, 'the replacement starts with no record');
    // the person opens 'Limits & resuming'; the wrong file refuses the record, the right file accepts it
    await r.page.locator('#ant-buy-record-in').evaluate(i => { i.closest('details').open = true; });
    await r.page.locator('#ant-buy-file').setInputFiles({name: 'a.txt', mimeType: 'text/plain', buffer: FILES.A});
    await r.page.locator('#ant-buy-record-in').setInputFiles(recordFile);
    await r.page.getByText(/Record not opened: That record belongs to a different file/).waitFor({timeout: 10000});
    await r.page.locator('#ant-buy-file').setInputFiles({name: 'b.txt', mimeType: 'text/plain', buffer: FILES.B}); await r.page.locator('#ant-buy-gas').fill(GAS);
    await r.page.locator('#ant-buy-record-in').setInputFiles(recordFile);
    await r.page.getByText(/Payment record opened for b\.txt \(2 kept transactions/).waitFor({timeout: 10000});
    assert.ok(await journal(r.page, shaOf('B')), 'the record is now this browser\'s journal for the file');
    await r.page.locator('#ant-buy-record-in').setInputFiles(recordFile);
    await r.page.getByText(/already holds a payment record for this file/).waitFor({timeout: 10000});
    await resumeAndCheck(r.page, r.kc, 'b.txt', FILES.B, sendsBefore + 2, hashesB);
    await replacement.close();
    console.log('ok   2. saved-record replacement: the record saved before the browser was lost resumed on a replacement client with no payment and no press');
  }

  // ── 3. already-stored, no-payment reuse ──
  {
    const stranger = await browser.newContext({viewport: {width: 390, height: 1100}});
    await wire(stranger);
    const sendsBefore = net.sends;
    const {page, kc} = await openPurchase(stranger, {code: 45}); // a different identity altogether
    await page.locator('#ant-buy-file').setInputFiles({name: 'b.txt', mimeType: 'text/plain', buffer: FILES.B}); await page.locator('#ant-buy-gas').fill(GAS);
    await page.locator('#ant-buy-start').click();
    assert.match(await waitStatus(page, /^Stored and retrieved:/, 60000), /all \d+ bytes match/);
    assert.equal(net.sends, sendsBefore, 'nothing was paid for bytes the network already holds');
    assert.equal(await kc.getByRole('button', {name: 'Sign this payment'}).count(), 0);
    assert.deepEqual(JSON.parse(await page.locator('#ant-buy-receipt').textContent()).transactions, [], 'the receipt records no payment');
    await stranger.close();
    console.log('ok   3. already-stored, no-payment reuse: a stranger\'s client stores the file and pays nothing');
  }

  // ── 4. lost submission acknowledgement, same context ──
  {
    const profile = await browser.newContext({viewport: {width: 390, height: 1100}});
    await wire(profile);
    const {page, kc} = await openPurchase(profile);
    const sendsBefore = net.sends;
    await begin(page, kc, 'c.txt', FILES.C);
    net.holdSendReply = true; // the endpoint takes the payment; its acknowledgement never comes back
    await press(page, kc, /Pay 0\.0+1 ANT to 1 Autonomi storage node/);
    for (let i = 0; i < 300 && net.sends < sendsBefore + 2; i++) await page.waitForTimeout(100);
    assert.equal(net.sends, sendsBefore + 2, 'the chain took the payment');
    await page.waitForTimeout(1500);
    const j = await journal(page, shaOf('C')), payment = j.plans[0].txs.find(t => t.kind === 'payment');
    assert.equal(payment.state, 'sending', 'the page is still waiting on the acknowledgement');
    assert.ok(payment.raw && payment.hash && payment.reservedWei, 'the signed bytes, their locally computed hash and the reservation were kept before the submission');
    assert.ok(net.txs[payment.hash], 'the kept hash is the transaction the chain holds');
    await page.close(); // closed while waiting for an acknowledgement that never came
    net.holdSendReply = false;
    const again = await openPurchase(profile);
    await resumeAndCheck(again.page, again.kc, 'c.txt', FILES.C, sendsBefore + 2, lastTwo());
    await profile.close();
    console.log('ok   4. lost submission acknowledgement: the kept hash was found on the chain; no second payment, no second press');
  }

  // ── 5. abrupt browser-process termination (SIGKILL) after submission, receipts withheld ──
  {
    const dir = mkdtempSync(join(tmpdir(), 'ant-recovery-profile-'));
    const launch = () => chromium.launchPersistentContext(dir, {viewport: {width: 390, height: 1100}, serviceWorkers: 'block'});
    let ctx = await launch();
    await routeWalletSource(ctx, root); await wire(ctx);
    const {page, kc} = await openPurchase(ctx);
    const sendsBefore = net.sends;
    await begin(page, kc, 'd.txt', FILES.D);
    net.holdReceipts = true;
    await press(page, kc, /Pay 0\.0+1 ANT to 1 Autonomi storage node/);
    const payment = await paymentState(page, shaOf('D'), 'submitted');
    assert.equal(net.sends, sendsBefore + 2); assert.equal(payment && payment.state, 'submitted');
    // The profile's localStorage reaches disk on Chromium's own commit timer, not at the write. The kill
    // comes after that delay has had its chance: a kill INSIDE it loses the last seconds of the journal
    // (measured here: 3 s was not enough), which is a property of the browser this suite records, not hides.
    await page.waitForTimeout(12000);
    // the browser's own process id, from the browser itself (CDP SystemInfo): killed, not closed
    const cdp = await ctx.browser().newBrowserCDPSession();
    const info = await cdp.send('SystemInfo.getProcessInfo');
    const pid = (info.processInfo.find(p => p.type === 'browser') || {}).id;
    assert.ok(pid, 'the browser process is known, so it can be killed rather than closed');
    process.kill(pid, 'SIGKILL');
    await new Promise(r => setTimeout(r, 2000));
    try { await ctx.close(); } catch (e) { /* already dead */ }
    net.holdReceipts = false;
    ctx = await launch();
    await routeWalletSource(ctx, root); await wire(ctx);
    const again = await openPurchase(ctx);
    const kept = await journal(again.page, shaOf('D'));
    assert.ok(kept && kept.plans[0].txs.find(t => t.kind === 'payment').state === 'submitted', 'the journal survived the killed process on disk');
    await resumeAndCheck(again.page, again.kc, 'd.txt', FILES.D, sendsBefore + 2, lastTwo());
    await ctx.close();
    console.log('ok   5. abrupt browser-process termination after submission: a new process on the same profile resumed from the journal; no second payment, no second press');
  }
  console.log('PASS recovery (exactly these): same-context page restart after a lost receipt; saved-record replacement; already-stored no-payment reuse; lost submission acknowledgement; abrupt process termination — never a second payment, never a second press. NOT covered and OPEN: paid-but-incomplete upload with all original browser state lost before any record was saved.');
} finally { await browser.close(); }
