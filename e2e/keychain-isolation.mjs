// The isolated keychain, end to end in a real browser. Both origins are served from source by
// route fulfilment (no server, no DNS): https://skaists.dev plays the wallet page and
// https://keys.skaists.dev the keychain. A CDP virtual authenticator with PRF plays the passkey.
// TESTNET-ONLY: every key here is born in a throwaway virtual authenticator; nothing is funded.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {chromium} from 'playwright';

const root = process.cwd();
const req = createRequire(import.meta.url);
const G = req('../keychain/genesis.js');
const {_envelope, _wire} = req('../surfaces/ant-pay.js');
const realm = {TextEncoder, TextDecoder, Uint8Array, crypto: globalThis.crypto, console}; realm.window = realm; realm.self = realm; realm.globalThis = realm;
vm.createContext(realm); vm.runInContext(readFileSync(root + '/surfaces/onboarding/vendor/bnr-sign.js', 'utf8'), realm);
const verify = _envelope.nobleVerifier(realm.BnrSign);
const sha256 = b => new Uint8Array(createHash('sha256').update(b).digest());
const bytes = h => new Uint8Array(Buffer.from(h.replace(/^0x/, ''), 'hex'));

const VAULT = '0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26', TOKEN = '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684';
const KEYS = {'/': 'keychain/index.html', '/keychain.js': 'keychain/keychain.js', '/genesis.js': 'keychain/genesis.js',
  '/vendor/bzdid-key.js': 'surfaces/onboarding/bzdid-key.js', '/vendor/bnr-sign.js': 'surfaces/onboarding/vendor/bnr-sign.js'};
const type = p => p.endsWith('.js') ? 'text/javascript' : 'text/html';
const parentHtml = `<!doctype html><meta charset="utf-8"><body><div id="slot"></div><script src="/surfaces/keychain-client.js"></script>
<script>window.kcReady=KeychainClient.mount(document.getElementById('slot')).then(c=>{window.kc=c;window.states=[];c&&c.onstate(s=>states.push(s));return !!c;});</script>`;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({viewport: {width: 390, height: 900}});
  await context.route('https://keys.skaists.dev/**', r => {
    const p = new URL(r.request().url()).pathname;
    return KEYS[p] ? r.fulfill({body: readFileSync(root + '/' + KEYS[p]), contentType: type(KEYS[p])}) : r.fulfill({status: 404, body: ''});
  });
  await context.route('https://skaists.dev/**', r => {
    const p = new URL(r.request().url()).pathname;
    if (p === '/kc-parent.html') return r.fulfill({body: parentHtml, contentType: 'text/html'});
    if (p === '/surfaces/keychain-client.js') return r.fulfill({body: readFileSync(root + '/surfaces/keychain-client.js'), contentType: 'text/javascript'});
    // a copy of the keychain at the WRONG origin
    const k = p.replace(/^\/keychain/, '');
    if (p.startsWith('/keychain') && KEYS[k || '/']) return r.fulfill({body: readFileSync(root + '/' + KEYS[k || '/']), contentType: type(KEYS[k || '/'])});
    return r.fulfill({status: 404, body: ''});
  });
  await context.route('https://evil.example/**', r => r.fulfill({body: '<!doctype html><iframe src="https://keys.skaists.dev/" style="width:100%;height:300px"></iframe>', contentType: 'text/html'}));

  const page = await context.newPage();
  await page.goto('https://skaists.dev/kc-parent.html');
  assert.equal(await page.evaluate(() => window.kcReady), true, 'the keychain frame mounts and reports its state');
  const frame = page.frames().find(f => f.url().startsWith('https://keys.skaists.dev/'));
  assert.ok(frame, 'the keychain runs in its own origin');
  assert.equal(await page.evaluate(() => kc.state.state), 'locked');

  // 1. The wallet page cannot reach into the keychain.
  assert.equal(await page.evaluate(() => { try { return kc.frame.contentWindow.document ? 'read' : 'none'; } catch (e) { return 'blocked'; } }), 'blocked');
  assert.equal(await page.evaluate(() => { try { kc.frame.contentWindow.BZDIDKEY; return typeof kc.frame.contentWindow.BZDIDKEY; } catch (e) { return 'blocked'; } }), 'blocked');

  // 2. A passkey scoped to keys.skaists.dev makes the keychain; the root is born there.
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {options: {protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true}});
  await frame.getByRole('button', {name: 'Make my keychain'}).click();
  await page.waitForFunction(() => kc.state.state === 'unlocked', null, {timeout: 20000});
  const st = await page.evaluate(() => kc.state);
  assert.match(st.did, /^did:b:[a-z2-7]{52}$/);
  assert.equal(G.didOf(bytes(st.genesis), sha256), st.did, 'the DID is the hash of the BDID-GENESIS-V1 bytes the keychain reports');
  assert.match(st.evm, /^0x[0-9a-f]{40}$/);

  // 3. A storage approval is decoded in the keychain, confirmed by a press there, and verifies independently.
  const base = {chainId: '0xa4b1', nonce: '0x7', gas: '0xea60', maxFeePerGas: '0x3b9aca00', maxPriorityFeePerGas: '0x0', value: '0x0', from: st.evm};
  const approve = {...base, to: TOKEN, data: _wire.encodeApprove(VAULT, (10n ** 18n).toString())};
  await page.evaluate(tx => { window.pendingSign = kc.signer().signTransaction(tx).then(s => ({ok: s}), e => ({no: e.message})); }, approve);
  const go = frame.getByRole('button', {name: 'Sign this payment'});
  await go.waitFor();
  assert.ok(await frame.getByText('Let the Autonomi storage vault collect up to 1 ANT.').isVisible());
  assert.equal(await go.isDisabled(), true, 'the press is not accepted the instant the card appears');
  await page.waitForTimeout(900);
  await go.click();
  const signed = await page.evaluate(() => window.pendingSign);
  assert.ok(signed.ok, JSON.stringify(signed));
  _envelope.check(signed.ok, approve, st.evm, verify); // decode, compare, canonical, keccak, recover — independently

  // 3b. Hidden time does not count: the press needs the card visible, unobscured, without a break.
  await page.evaluate(tx => { kc.frame.style.opacity = '0'; window.pendingSign = kc.signer().signTransaction(tx).then(s => ({ok: s}), e => ({no: e.message})); }, approve);
  await go.waitFor({state: 'attached'});
  await page.waitForTimeout(1200);
  await page.evaluate(() => { kc.frame.style.opacity = '1'; });
  await page.waitForTimeout(250);
  assert.equal(await go.isDisabled(), true, 'time spent hidden does not count toward the press delay');
  await page.waitForTimeout(900); await go.click();
  _envelope.check((await page.evaluate(() => window.pendingSign)).ok, approve, st.evm, verify);

  // 4. A payForQuotes is shown as what it pays.
  const pay = {...base, nonce: '0x8', to: VAULT, data: _wire.encodePayForQuotes([{rewards_address: '0x' + '1'.repeat(40), amount_atto: '250000000000000000', quote_hash: '0x' + 'a'.repeat(64)}, {rewards_address: '0x' + '2'.repeat(40), amount_atto: '250000000000000000', quote_hash: '0x' + 'b'.repeat(64)}])};
  await page.evaluate(tx => { window.pendingSign = kc.signer().signTransaction(tx).then(s => ({ok: s}), e => ({no: e.message})); }, pay);
  await go.waitFor();
  assert.ok(await frame.getByText('Pay 0.5 ANT to 2 Autonomi storage nodes.').isVisible());
  await page.waitForTimeout(900); await go.click();
  const paid = await page.evaluate(() => window.pendingSign);
  _envelope.check(paid.ok, pay, st.evm, verify);

  // 5. Refuse inside the keychain.
  await page.evaluate(tx => { window.pendingSign = kc.signer().signTransaction(tx).then(s => ({ok: s}), e => ({no: e.message})); }, approve);
  // let the card settle (the frame resizes to fit it) before pressing, as a person would
  await go.waitFor(); await page.waitForTimeout(900);
  await frame.getByRole('button', {name: 'Refuse'}).click();
  assert.match((await page.evaluate(() => window.pendingSign)).no, /refused this payment/);

  // 6. What the keychain will not sign never reaches a confirm card.
  for (const [tx, why] of [[{...approve, data: _wire.encodeApprove('0x' + '9'.repeat(40), '1')}, /storage payments only/], [{...approve, chainId: '0x1'}, /Arbitrum One only/],
    [{...approve, value: '0x1'}, /no ETH/], [{...approve, data: '0xa9059cbb' + '0'.repeat(128)}, /storage payments only/], [{...approve, data: _wire.encodeApprove(VAULT, (101n * 10n ** 18n).toString())}, /100 ANT/],
    [{...approve, from: '0x' + '3'.repeat(40)}, /another account/], [{...approve, gas: '0xffffff'}, /out of bounds/]]) {
    const out = await page.evaluate(tx => kc.signer().signTransaction(tx).then(s => ({ok: s}), e => ({no: e.message})), tx);
    assert.match(out.no || '', why, JSON.stringify(out));
  }
  assert.equal(await go.count(), 0);

  // 7. Lock scrubs it; the same passkey reopens the same identity.
  await frame.getByRole('button', {name: 'Lock'}).click();
  await page.waitForFunction(() => kc.state.state === 'locked');
  assert.match(await page.evaluate(() => kc.signer().address().then(() => 'open', e => e.message)), /Unlock your isolated keychain/);
  await frame.getByRole('button', {name: 'Unlock with my passkey'}).click();
  await page.waitForFunction(() => kc.state.state === 'unlocked', null, {timeout: 20000});
  assert.equal(await page.evaluate(() => kc.state.did), st.did);
  assert.equal(await page.evaluate(() => kc.state.evm), st.evm);

  // 8. A copy at the wallet's own origin is inert; a foreign page cannot embed the keychain.
  const wrong = await context.newPage();
  await wrong.goto('https://skaists.dev/keychain/');
  assert.match(await wrong.locator('#kc').innerText(), /only runs at keys\.skaists\.dev/);
  const evil = await context.newPage();
  await evil.goto('https://evil.example/');
  const evilFrame = evil.frames().find(f => f.url().startsWith('https://keys.skaists.dev/'));
  await evilFrame.waitForFunction(() => /only opens inside/.test(document.getElementById('kc').innerText));

  console.log('PASS keychain isolation: own origin, passkey-born root, BDID-GENESIS-V1 did, decoded confirm with delayed trusted press, independent envelope check, refusals, lock/unlock, inert copy, foreign embedder refused');
} finally { await browser.close(); }
