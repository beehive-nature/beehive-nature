// Public accounts / following: real Chromium, existing workers, mocked RPCs.
// No keys, funding, signing or live chain writes. Run: node e2e/wallet-accounts.mjs
import assert from 'node:assert/strict';
import {installWalletFixture,WALLET_ORIGIN} from './lib/wallet-source-fixture.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const origin = WALLET_ORIGIN;
const browser = await chromium.launch();
const fixtureHtml=await installWalletFixture(browser,root);
let checks = 0;
function check(name, value) { assert.ok(value, name); console.log(`PASS ${++checks}: ${name}`); }
const KEY = 'bnr.wallet.public-accounts.v1';
const EVM = '0x' + 'a1'.repeat(20); // Synthetic public address, no key material.
const BTC = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'; // PUBLIC-CONSTANT: Bitcoin genesis recipient
const SOL = '11111111111111111111111111111111'; // PUBLIC-CONSTANT: Solana system program
const AR = 'a'.repeat(42) + 'A'; // Synthetic public address, no key material.
const calls = [], pageErrors = [];
let btcRaw=null, solRaw='1234567890', vaultMalformed=false, hiveMalformed=false;
let outage = false, wrongChain = false, deferred = null, preview = false;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => {
  localStorage.setItem('bregister', sessionStorage.getItem('test-register') || 'bee');
  window.credentialCalls = 0;
  navigator.credentials.get = async () => { window.credentialCalls++; throw new Error('test forbids credentials'); };
  navigator.credentials.create = navigator.credentials.get;
});
await ctx.route(url => !url.href.startsWith(origin), async route => {
  const req = route.request(), url = new URL(req.url());
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  const json = data => route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(data) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  let body = {}; try { body = req.postDataJSON() || {}; } catch {}
  const evm = /arbitrum|base\.|1rpc\.io/.test(url.host);
  if(evm&&Array.isArray(body)){
    return json(body.map(request=>{
      calls.push(request.method);
      if(request.method==='eth_chainId')return {id:request.id,result:wrongChain?'0x1':'0x2105'};
      if(request.method==='eth_blockNumber')return {id:request.id,result:'0x100'};
      if(outage)return {id:request.id,error:{code:-32000,message:'fixture outage'}};
      return {id:request.id,result:'0x'+(request.params[0].data==='0x313ce567'?6n:1250000n).toString(16).padStart(64,'0')};
    }).reverse());
  }
  if (evm) {
    calls.push(body.method);
    if (deferred && body.method === 'eth_getBalance') await deferred;
    if (outage) return json({ error: { code: -32000, message: 'fixture outage' } });
    if (body.method === 'eth_chainId') return json({ result: wrongChain ? '0x1' : /base|1rpc/.test(url.host) ? '0x2105' : '0xa4b1' });
    if (body.method === 'eth_getBalance') return json({ result: '0x' + (preview ? 12345000000000000n : 9007199254740993123456789n).toString(16) });
    if (body.method === 'eth_call') return json({ result: '0x' + (preview ? /base|1rpc/.test(url.host) ? 21000000n : 42000000000000000000n : 1234567890123456789n).toString(16) });
  }
  // A is core.vaulta's token; get_account's core_liquid_balance is EOS, a different token
  if (url.pathname === '/v1/chain/get_currency_balance') {
    calls.push('get_currency_balance');
    if (body.code !== 'core.vaulta' || body.symbol !== 'A') return json([]);
    return json(vaultMalformed ? { error: 'fixture' } : body.account === 'alice' ? ['12.3456 A'] : ['7.0000 A']);
  }
  if (url.pathname === '/v1/chain/get_account') {
    calls.push('get_account');
    if (body.account_name === 'missing') return json({ error: { message: 'unknown account' } });
    return json({ account_name: body.account_name, core_liquid_balance: '0.0000 EOS', permissions: [], ram_usage: 10, ram_quota: 100 });
  }
  if (url.host === 'api.hive.blog') { calls.push(body.method); return json({ result: [{ balance: hiveMalformed ? 'not a balance' : '42.123 HIVE',hbd_balance:'8.765 HBD' }] }); }
  if (/blockstream|mempool/.test(url.host)) {
    calls.push('esplora balance');
    if(btcRaw!==null)return route.fulfill({headers,contentType:'application/json',body:btcRaw});
    return json({ chain_stats: { funded_txo_sum: 123456789, spent_txo_sum: 0, tx_count: 1 }, mempool_stats: { funded_txo_sum: 100, spent_txo_sum: 0 } });
  }
  if (/solana|solana-mainnet/.test(url.host)) { calls.push(body.method); return route.fulfill({headers,contentType:'application/json',body:'{"result":{"value":'+solRaw+'}}'}); }
  if (/\/wallet\/.+\/balance$/.test(url.pathname)) { calls.push('AR balance'); return route.fulfill({ headers, body: '1234567890123' }); }
  return route.abort();
});
const page = await ctx.newPage();
page.on('pageerror', error => pageErrors.push(String(error)));
async function open(query = '') { await page.goto(origin + '/surfaces/wallet.html' + query + '#wallet-accounts'); await page.locator('#wallet-accounts').waitFor({ state: 'visible' }); }
const cards = () => page.locator('.wa-card');
const card = id => page.locator('.wa-card').filter({ has: page.locator('.wa-address', { hasText: id }) });
async function add(chain, address, kind = 'mine', label = '') {
  await page.locator(kind === 'mine' ? '#wa-add' : '#wa-follow').click();
  await page.locator('#wa-chain').selectOption(chain);
  await page.locator('#wa-address').fill(address);
  await page.locator('#wa-label').fill(label);
  await page.locator('#wa-save').click();
}
async function settled(locator) {
  await locator.locator('.wa-state').filter({ hasText: /Read \d|Read unavailable/ }).waitFor();
}
try {
  await open();
  check('address book accessible without identity', await page.locator('#wa-add').isVisible());
  await add('vaulta', 'Alice.b', 'mine', 'Everyday');
  await settled(card('alice'));
  await add('vaulta', 'bob', 'mine', 'Savings');
  await settled(card('bob'));
  check('multiple Vaulta accounts stay separate', (await page.locator('#wa-mine .wa-amount').allTextContents()).join('|') === '12.3456 A|7.0000 A');
  check('public accounts never pollute connected-wallet totals', (await page.locator('#v-bal').textContent()).trim() === '');
  await add('arbitrum', EVM, 'following', 'Autonomi treasury');
  await settled(card(EVM));
  check('large ETH amount preserves all base-unit digits', await card(EVM).locator('.wa-amount').first().textContent() === '9007199.254740993123456789 ETH');
  check('ANT is read with its own decimals', await card(EVM).locator('.wa-amount').last().textContent() === '1.234567890123456789 ANT');
  check('following is separate from my accounts', await page.locator('#wa-following .wa-card').count() === 1 && await page.locator('#wa-mine .wa-card').count() === 2);
  const before = calls.length;
  await add('arbitrum', '0x' + EVM.slice(2).toUpperCase(), 'mine');
  check('same-chain EVM casing cannot duplicate or imply ownership', (await page.locator('#wa-status').textContent()).includes('already saved') && await cards().count() === 3 && calls.length === before);
  await add('arbitrum', 'not a public address');
  check('invalid input makes no public read', (await page.locator('#wa-status').textContent()).includes('40 hexadecimal') && calls.length === before);
  await add('arbitrum', '0x52908400098527886e0F7030069857D2E4169EE7'); // PUBLIC-CONSTANT: intentionally bad case of EIP-55 example
  check('incorrect mixed-case EVM checksum is refused', (await page.locator('#wa-status').textContent()).includes('checksum failed') && calls.length === before);
  await add('base', EVM, 'mine', 'Base savings');
  const base = page.locator('#wa-mine .wa-card').filter({ hasText: 'Base savings' });
  await settled(base);
  check('same address on a different chain is a separate account', await cards().count() === 4 && (await base.textContent()).includes('1234567890123.456789 USDC'));
  const arb = page.locator('#wa-following .wa-card');
  await arb.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#wa-label').fill('<img src=x onerror=alert(1)>');
  await page.locator('#wa-save').click();
  await settled(arb);
  check('labels render as text, never markup', await arb.locator('img').count() === 0 && (await arb.locator('h4').textContent()).startsWith('<img'));
  const explorer = arb.getByRole('link', { name: 'Activity' });
  check('activity uses chain-specific new-tab links with isolation', await explorer.getAttribute('href') === 'https://arbiscan.io/address/' + EVM && await explorer.getAttribute('target') === '_blank' && await explorer.getAttribute('rel') === 'noopener noreferrer');
  outage = true;
  await arb.getByRole('button', { name: 'Refresh', exact: true }).click();
  await settled(arb);
  check('failed refresh removes old figures, never fabricates zero', await arb.locator('.wa-amount').count() === 0 && await arb.getAttribute('data-state') === 'failed');
  outage = false; wrongChain = true;
  await arb.getByRole('button', { name: 'Refresh', exact: true }).click();
  await settled(arb);
  check('wrong-network RPC is refused', (await arb.textContent()).includes('different network') && await arb.locator('.wa-amount').count() === 0);
  wrongChain = false;
  await arb.getByRole('button', { name: 'Refresh', exact: true }).click(); await settled(arb);
  await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 121000; document.dispatchEvent(new Event('visibilitychange')); Date.now = now; });
  check('expired reads show no current balance', await arb.getAttribute('data-state') === 'stale' && await arb.locator('.wa-amount').count() === 0);
  let release; deferred = new Promise(resolve => { release = resolve; });
  await arb.getByRole('button', { name: 'Refresh', exact: true }).click();
  await arb.getByRole('button', { name: 'Remove', exact: true }).click();
  release(); deferred = null;
  await page.waitForTimeout(100);
  check('removing during a read cannot resurrect the account', await page.locator('#wa-following .wa-card').count() === 0);
  await page.locator('#wa-undo').click(); await settled(arb);
  check('undo restores the public account', await page.locator('#wa-following .wa-card').count() === 1);
  await add('bitcoin', BTC, 'following', 'Bitcoin genesis'); await settled(card(BTC));
  check('Bitcoin uses existing worker and confirmed amount only', (await card(BTC).textContent()).includes('1.23456789 BTC') && (await card(BTC).textContent()).includes('Confirmed BTC only'));
  btcRaw='{"chain_stats":{"funded_txo_sum":9007199254740993,"spent_txo_sum":9007199254740992,"tx_count":2},"mempool_stats":{"funded_txo_sum":0,"spent_txo_sum":0}}';
  await card(BTC).getByRole('button',{name:'Refresh',exact:true}).click();await settled(card(BTC));
  check('Bitcoin subtracts cumulative sums exactly above Number safe integer',(await card(BTC).textContent()).includes('0.00000001 BTC'));
  for(const raw of ['{"chain_stats":{}}','{"chain_stats":{"funded_txo_sum":1,"spent_txo_sum":2}}','{"chain_stats":{"funded_txo_sum":1.5,"spent_txo_sum":0}}']){
    btcRaw=raw;await card(BTC).getByRole('button',{name:'Refresh',exact:true}).click();await settled(card(BTC));
    check('invalid Bitcoin sums refuse a displayed amount',await card(BTC).locator('.wa-amount').count()===0);
  }
  btcRaw=null;
  await add('bitcoin', BTC.slice(0, -1) + 'b');
  check('legacy Bitcoin checksum rejected before save', (await page.locator('#wa-status').textContent()).includes('checksum failed'));
  await add('bitcoin', 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', 'following', 'Segwit');
  await settled(card('bc1q'));
  check('segwit checksum and witness program accepted', (await card('bc1q').textContent()).includes('BTC'));
  await add('solana', SOL, 'following', 'Solana'); await settled(card(SOL));
  check('Solana reuses existing read worker', (await card(SOL).textContent()).includes('1.23456789 SOL'));
  solRaw='9007199254740993';
  await card(SOL).getByRole('button',{name:'Refresh',exact:true}).click(); await settled(card(SOL));
  check('Solana preserves lamports above Number safe integer', (await card(SOL).textContent()).includes('9007199.254740993 SOL'));
  for (const malformed of ['null','-1','1.5','18446744073709551616']) {
    solRaw=malformed; await card(SOL).getByRole('button',{name:'Refresh',exact:true}).click(); await settled(card(SOL));
    check('Solana refuses invalid u64 '+malformed, await card(SOL).locator('.wa-amount').count()===0);
  }
  solRaw='1234567890';
  await page.evaluate(()=>BNRWALLET._crash('solana','fixture worker failure'));
  await card(SOL).getByRole('button',{name:'Refresh',exact:true}).click(); await settled(card(SOL));
  check('Refresh respawns a crashed Solana worker', (await card(SOL).textContent()).includes('1.23456789 SOL'));
  await add('arweave', AR, 'following', 'Arweave'); await settled(card(AR));
  check('Arweave formats winston exactly', (await card(AR).textContent()).includes('1.234567890123 AR'));
  await add('hive', '@alice', 'mine', 'Hive'); await settled(card('alice').filter({ hasText: 'Hive ·' }));
  check('Hive account normalization and both liquid coins', (await card('alice').filter({ hasText: 'Hive ·' }).textContent()).includes('42.123 HIVE')&&(await card('alice').filter({ hasText: 'Hive ·' }).textContent()).includes('8.765 HBD'));
  vaultMalformed=true;
  const vaultCard=card('alice').filter({hasText:'Vaulta'});
  await vaultCard.getByRole('button',{name:'Refresh',exact:true}).click(); await settled(vaultCard);
  check('missing Vaulta balance is unavailable rather than zero',await vaultCard.locator('.wa-amount').count()===0);
  vaultMalformed=false;hiveMalformed=true;
  const hiveCard=card('alice').filter({hasText:'Hive'});
  await hiveCard.getByRole('button',{name:'Refresh',exact:true}).click(); await settled(hiveCard);
  check('malformed Hive balance is unavailable rather than zero',await hiveCard.locator('.wa-amount').count()===0);
  hiveMalformed=false;
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  check('persistence contains only versioned public metadata', saved.v === 1 && saved.entries.length === 9 && saved.entries.every(row => Object.keys(row).sort().join(',') === 'address,chain,kind,label'));
  check('all reads avoid credentials and signing RPCs', await page.evaluate(() => window.credentialCalls) === 0 && calls.every(method => ['eth_chainId','eth_getBalance','eth_call','get_account','get_currency_balance','condenser_api.get_accounts','esplora balance','getBalance','AR balance'].includes(method)));
  await open(); await settled(card(BTC));
  check('reload preserves all accounts and rereads', await cards().count() === 9);
  const second = await ctx.newPage(); await second.goto(origin + '/surfaces/wallet.html#wallet-accounts');
  await second.evaluate(key => { const data = JSON.parse(localStorage.getItem(key)); data.entries = data.entries.filter(row => row.chain !== 'bitcoin'); localStorage.setItem(key, JSON.stringify(data)); }, KEY);
  await page.waitForFunction(() => document.querySelectorAll('.wa-card').length === 7);
  check('cross-tab changes clear old reads and preserve the new list', (await page.locator('#wa-status').textContent()).includes('another tab') && await cards().locator('.wa-amount').count() === 0);
  await base.getByRole('button',{name:'Edit',exact:true}).click();
  await page.locator('#wa-label').fill('Stale edit');
  await second.evaluate(key=>{const data=JSON.parse(localStorage.getItem(key));data.entries.find(r=>r.chain==='base').label='Other tab wins';localStorage.setItem(key,JSON.stringify(data));},KEY);
  await page.waitForFunction(()=>document.getElementById('wa-mine').textContent.includes('Other tab wins'));
  await page.locator('#wa-save').click();
  check('open edit cannot overwrite another tab after its storage event',await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).entries.find(r=>r.chain==='base').label==='Other tab wins',KEY));
  await page.locator('#wa-cancel').click();
  await second.evaluate(key=>{const data=JSON.parse(localStorage.getItem(key));data.entries.find(r=>r.chain==='base').label='Base savings';localStorage.setItem(key,JSON.stringify(data));},KEY);
  await base.waitFor();
  await second.close();
  await page.locator('#wa-refresh').click(); await settled(base);
  await page.evaluate(() => { const original = Storage.prototype.setItem; window.restoreStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function(key,value){ if(key === 'bnr.wallet.public-accounts.v1')throw new DOMException('quota','QuotaExceededError'); return original.call(this,key,value); }; });
  await add('vaulta', 'carol');
  check('storage failure never claims saved or mutates list', (await page.locator('#wa-status').textContent()).includes('Nothing was saved') && await cards().count() === 7);
  await page.evaluate(() => window.restoreStorage()); await page.locator('#wa-cancel').click();
  await page.evaluate(() => localStorage.setItem('bnr_soul', 'alice'));
  await open('?account-test=known-soul');
  await page.waitForFunction(() => document.getElementById('v-bal').textContent === '12.3456 A');
  await page.locator('#wa-follow').click();
  await page.locator('#wa-address').fill('bob');
  await page.locator('#wa-cancel').click();
  await settled(card(EVM).filter({ hasText: 'Base savings' }));
  check('watch controls do not auto-unlock a returning soul', await page.evaluate(() => window.credentialCalls) === 0 && await page.locator('#wq').inputValue() === 'alice' && await page.locator('#v-bal').textContent() === '12.3456 A');
  await page.evaluate(()=>document.activeElement.blur());
  await page.keyboard.press('Tab');
  check('keyboard navigation does not start an automatic passkey ceremony',await page.evaluate(()=>window.credentialCalls)===0);
  await page.locator('[data-wallet-store]').click();
  await page.locator('#wallet-storage a[href="#arw-sec"]').click();
  await page.locator('#wallet-identity a[href="#wallet-accounts"]').click();
  check('returning identity can navigate accounts and storage without a passkey request',await page.evaluate(()=>window.credentialCalls)===0);
  await page.locator('#kc-stat').dispatchEvent('pointerdown');
  await page.waitForFunction(() => window.credentialCalls > 0);
  check('negative control: the existing keychain gesture would request credentials', await page.evaluate(() => window.credentialCalls) === 1);
  await page.evaluate(() => localStorage.removeItem('bnr_soul'));
  await page.evaluate(key => { window.savedBook = localStorage.getItem(key); localStorage.setItem(key, '{broken'); }, KEY);
  await open('?account-test=corrupt');
  check('unreadable storage stays intact and is reported', (await page.locator('#wa-status').textContent()).includes('Saving is paused') && await page.evaluate(key => localStorage.getItem(key), KEY) === '{broken');
  preview = true;
  await page.evaluate(({ key, address }) => localStorage.setItem(key, JSON.stringify({ v: 1, entries: [
    { chain: 'vaulta', address: 'alice', kind: 'mine', label: 'Everyday' },
    { chain: 'base', address, kind: 'mine', label: 'Savings on Base' },
    { chain: 'arbitrum', address, kind: 'following', label: 'Autonomi treasury' }
  ] })), { key: KEY, address: EVM });
  const shots = join(root, 'e2e', 'shots-wallet-accounts'); await mkdir(shots, { recursive: true });
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    await page.evaluate(reg => sessionStorage.setItem('test-register', reg), reg);
    await page.setViewportSize({ width: 390, height: 844 }); await open('?account-test=' + reg); await settled(card('alice'));
    check(`${reg}: actual register matches the test`, await page.locator('body').getAttribute('data-reg') === reg);
    await page.locator('#wa-follow').click();
    check(`${reg}: address form accessible on mobile`, await page.locator('#wa-save').isVisible());
    check(`${reg}: public-read disclosure always visible`, await page.locator('#wa-privacy').isVisible());
    check(`${reg}: no horizontal page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#wallet-accounts').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: join(shots, `accounts-${reg}-390.png`) });
    await page.locator('#wa-cancel').click();
    await page.locator('#wa-mine').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: join(shots, `accounts-${reg}-list-390.png`) });
  }
  await page.evaluate(() => sessionStorage.setItem('test-register', 'bee'));
  await page.setViewportSize({ width: 1280, height: 900 });
  await open('?account-test=desktop'); await settled(card('alice'));
  await page.screenshot({ path: join(shots, 'accounts-desktop.png') });
  const coinsCard=page.locator('#wa-mine .wa-card').filter({hasText:'Savings on Base'});
  const priorHash=await page.evaluate(()=>location.hash);
  await coinsCard.locator('[data-wa-action="coins"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.wa-token').length===12);
  check('Base card reads all twelve registered ERC-20i token balances', (await coinsCard.textContent()).includes('TRUFFI · 1.25')&&(await coinsCard.textContent()).includes('MiDi-3 · 1.25'));
  check('token balances stay on the account card without navigating to art', await page.evaluate(()=>location.hash)===priorHash&&await coinsCard.locator('svg,img').count()===0);
  await coinsCard.locator('input[name="contract"]').fill('0x'+'34'.repeat(20));
  await coinsCard.locator('form[data-wa-token] button').click();
  await page.waitForFunction(()=>document.querySelectorAll('.wa-token').length===13);
  check('additional token expands rather than replaces the census', (await coinsCard.textContent()).includes('Additional token · 1.25'));
  outage=true;await coinsCard.locator('[data-wa-action="coins"]').click();
  await page.waitForFunction(()=>document.querySelector('.wa-coins')?.textContent.includes('Contract read failed'));
  check('token failure removes prior balances instead of reporting zero', !(await coinsCard.locator('.wa-coins').textContent()).includes('1.25')&&(await coinsCard.locator('.wa-coins').textContent()).includes('unavailable'));
  check('coin reads request no credentials', await page.evaluate(()=>window.credentialCalls)===0);
  outage=false;
  const draftAddress='0x'+'56'.repeat(20);
  await coinsCard.locator('input[name="contract"]').fill(draftAddress);
  await page.locator('#wa-refresh').click();
  await page.waitForFunction(()=>!document.querySelector('#wa-refresh').disabled);
  check('balance refresh preserves an unfinished token contract entry',await coinsCard.locator('input[name="contract"]').inputValue()===draftAddress);
  check('no browser script exceptions', pageErrors.length === 0);
  console.log(`${checks} checks passed; RPC fixtures only, no live signing or chain writes.`);
} finally { await browser.close();  }
