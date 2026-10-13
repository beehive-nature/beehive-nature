// The isolated keychain's Hive signing door, end to end in a real browser. Both origins are
// served from source by route fulfilment (no server, no DNS): https://skaists.dev plays the
// asking page and https://keys.skaists.dev the keychain. A CDP virtual authenticator with PRF
// plays the passkey. TESTNET-ONLY: the root is born in a throwaway virtual authenticator; no
// Hive account is funded, no transaction is broadcast anywhere — the proof is the signature
// verified against the digest and the key the keychain itself derives.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {chromium} from 'playwright';

const root = process.cwd();
const req = createRequire(import.meta.url);
const HiveTx = req('../surfaces/onboarding/vendor/hive-tx.min.js');
const G = req('../keychain/genesis.js');
const realm = {TextEncoder, TextDecoder, Uint8Array, BigInt, console, crypto: globalThis.crypto};
realm.window = realm; realm.self = realm; realm.globalThis = realm;
vm.createContext(realm);
vm.runInContext(readFileSync(root + '/surfaces/onboarding/vendor/bnr-sign.js', 'utf8'), realm);
const B = realm.BnrSign;

const KEYS = {'/': 'keychain/index.html', '/prelude.js': 'keychain/prelude.js', '/keychain.js': 'keychain/keychain.js', '/genesis.js': 'keychain/genesis.js',
  '/vendor/bzdid-key.js': 'surfaces/onboarding/bzdid-key.js', '/vendor/bnr-sign.js': 'surfaces/onboarding/vendor/bnr-sign.js', '/vendor/hive-tx.min.js': 'surfaces/onboarding/vendor/hive-tx.min.js'};
const type = p => p.endsWith('.html') ? 'text/html' : 'text/javascript';
const parentHtml = `<!doctype html><meta charset="utf-8"><body><div id="slot"></div><script src="/surfaces/keychain-client.js"></script>
<script>window.kcReady=KeychainClient.mount(document.getElementById('slot')).then(c=>{window.kc=c;return !!c;});</script>`;

/* an unsigned Hive drop, exactly what the desk would send: no network step happens inside the keychain */
const ACCOUNT = 'loviswater';
const drop = (over = {}) => {
  const c = {parent_author: '', parent_permlink: 'hive', author: ACCOUNT, permlink: 'bdrop-keychain-door-probe',
    title: 'the keychain door', body: 'the drop desk\u2019s fixture body — byte-exact through ask, card, press and verify. \u{1F41D}',
    json_metadata: JSON.stringify({tags: ['hive'], app: 'bnr/bdrop/2.0', format: 'markdown', disclosure_version: 'bdrop-0001-disclosure-v1'}), ...over.comment};
  return {ref_block_num: 49000000 & 0xffff, ref_block_prefix: 305419896, expiration: new Date(Date.now() + 120000).toISOString().slice(0, 19), extensions: [], operations: [['comment', c]], ...over.tx};
};
function digestOf(tx) { // the same library the desk uses, run here in node
  const t = new HiveTx.Transaction([]); t.created = true; t.transaction = JSON.parse(JSON.stringify(tx));
  const d = t.digest();
  return {bytes: Uint8Array.from(String(d.digest).split(',').map(Number)), txId: d.txId};
}

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
    return r.fulfill({status: 404, body: ''});
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('https://skaists.dev/kc-parent.html');
  assert.equal(await page.evaluate(() => window.kcReady), true, 'the keychain frame mounts (prelude + hive-tx vendor load under the CSP)');
  const frame = page.frames().find(f => f.url().startsWith('https://keys.skaists.dev/'));

  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {options: {protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true}});
  await frame.getByRole('button', {name: 'Make my keychain'}).click();
  await page.waitForFunction(() => kc.state.state === 'unlocked', null, {timeout: 20000});

  // 1. The public posting key is public data: named on request, account-bound, stable.
  const pub1 = await page.evaluate(ac => kc.signer().hivePub(ac).then(p => p.pub, e => 'ERR ' + e.message), ACCOUNT);
  assert.match(pub1, /^STM[1-9A-HJ-NP-Za-km-z]+$/, 'the keychain names its posting key');
  const pub2 = await page.evaluate(ac => kc.signer().hivePub(ac).then(p => p.pub), 'someone-else');
  assert.notEqual(pub1, pub2, 'another account derives another posting key — no account fallback exists');

  // 2. A drop is decoded in the keychain, confirmed by a delayed trusted press there, and verifies independently.
  const tx = drop();
  await page.evaluate(({account, tx}) => { window.pending = kc.signer().signHive(account, tx).then(s => ({ok: s}), e => ({no: e.message})); }, {account: ACCOUNT, tx});
  const go = frame.getByRole('button', {name: 'Sign this drop'});
  await go.waitFor();
  assert.ok(await frame.getByText('Publish the drop @' + ACCOUNT + '/bdrop-keychain-door-probe on Hive').isVisible(), 'the card names the drop');
  const bodySha = Array.from(new TextEncoder().encode(tx.operations[0][1].body));
  const shaHex = Array.from(B.sha256(new Uint8Array(bodySha))).map(b => b.toString(16).padStart(2, '0')).join('');
  assert.ok(await frame.getByText(shaHex).isVisible(), 'the card shows the body digest computed inside the keychain');
  assert.ok(await frame.getByText('bdrop-0001-disclosure-v1').isVisible(), 'the card shows the disclosure version');
  assert.ok(await frame.getByText('posting authority — no funds can move').first().isVisible(), 'the card says what authority signs');
  assert.equal(await go.isDisabled(), true, 'the press is not accepted the instant the card appears');
  await page.waitForTimeout(900);
  await go.click();
  const signed = await page.evaluate(() => window.pending);
  assert.ok(signed.ok, JSON.stringify(signed));
  assert.match(signed.ok.raw, /^[0-9a-f]{130}$/, 'the signature is Hive\u2019s 65-byte recoverable form');
  const want = digestOf(tx);
  assert.equal(signed.ok.hash, want.txId, 'the returned id is the digest of exactly this transaction');
  assert.ok([31, 32, 33, 34].includes(parseInt(signed.ok.raw.slice(0, 2), 16)), 'the recovery byte is Hive\u2019s +31 form');
  assert.equal(signed.ok.pub, pub1, 'the signature claims the same key the pub query named');
  const pub33 = new Uint8Array(HiveTx.PublicKey.fromString(signed.ok.pub).key);
  assert.equal(B.secp.verify(signed.ok.raw.slice(2), want.bytes, pub33), true, 'the signature verifies against the digest and the named public key, independently');

  // 3. Refuse inside the keychain.
  await page.evaluate(({account, tx}) => { window.pending = kc.signer().signHive(account, tx).then(s => ({ok: s}), e => ({no: e.message})); }, {account: ACCOUNT, tx: drop({comment: {permlink: 'bdrop-refused-probe'}})});
  await go.waitFor(); await page.waitForTimeout(900);
  await frame.getByRole('button', {name: 'Refuse'}).click();
  assert.match((await page.evaluate(() => window.pending)).no, /refused this drop/);

  // 4. What the keychain will not sign never reaches a confirm card.
  const bad = [
    [{account: ACCOUNT, tx: drop({comment: {parent_author: 'someone'}})}, /root post; this one carries a reply/],
    [{account: ACCOUNT, tx: drop({comment: {author: 'not-the-account'}})}, /another author/],
    [{account: ACCOUNT, tx: drop({comment: {json_metadata: JSON.stringify({tags: ['hive']})}})}, /disclosed bDroP editions only/],
    [{account: ACCOUNT, tx: drop({comment: {body: 'x'.repeat(65537)}})}, /64 KB post cap/],
    [{account: ACCOUNT, tx: drop({tx: {extensions: [['a']]}})}, /extensions/],
    [{account: ACCOUNT, tx: drop({tx: {expiration: new Date(Date.now() + 7200000).toISOString().slice(0, 19)}})}, /hour ahead/],
    [{account: ACCOUNT, tx: drop({tx: {expiration: '2020-01-01T00:00:00'}})}, /already expired/],
    [{account: ACCOUNT, tx: drop({tx: {operations: [['vote', {voter: ACCOUNT, author: 'a', permlink: 'b', weight: 10000}]]}})}, /comment drops only/],
    [{account: ACCOUNT, tx: drop({tx: {operations: [drop().operations[0], drop({comment: {permlink: 'second'}}).operations[0]]}})}, /one drop per request/],
    [{account: 'BadName', tx: drop()}, /not a Hive account name/],
  ];
  for (const [req0, why] of bad) {
    const out = await page.evaluate(r => kc.signer().signHive(r.account, r.tx).then(s => ({ok: s}), e => ({no: e.message})), req0);
    assert.match(out.no || '', why, JSON.stringify(out));
  }
  // a raw request carrying both kinds at once is refused before any card (the client cannot express it)
  const both = await page.evaluate(tx => new Promise(res => {
    const id = 'both.' + Date.now();
    const onmsg = ev => { if (ev.data && ev.data.id === id) { window.removeEventListener('message', onmsg); res(ev.data); } };
    window.addEventListener('message', onmsg);
    document.querySelector('#slot iframe').contentWindow.postMessage({t: 'kc.sign', v: 1, id, tx: {chainId: '0xa4b1'}, hive: {account: 'loviswater', tx}}, 'https://keys.skaists.dev');
    setTimeout(() => res({t: 'timeout'}), 5000);
  }), drop());
  assert.equal(both.t, 'kc.refused', 'both kinds in one request is refused');
  assert.match(both.reason, /one kind/);
  assert.equal(await go.count(), 0, 'no card is standing after refusals');

  // 5. The ANT/EVM interface is unchanged beside the new door.
  const VAULT = '0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26', TOKEN = '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684';
  const {_envelope, _wire} = req('../surfaces/ant-pay.js');
  const verify = _envelope.nobleVerifier(B);
  const approve = {chainId: '0xa4b1', nonce: '0x7', gas: '0xea60', maxFeePerGas: '0x3b9aca00', maxPriorityFeePerGas: '0x0', value: '0x0', from: (await page.evaluate(() => kc.state.evm)),
    to: TOKEN, data: _wire.encodeApprove(VAULT, (10n ** 18n).toString())};
  await page.evaluate(t => { window.pending = kc.signer().signTransaction(t).then(s => ({ok: s}), e => ({no: e.message})); }, approve);
  await frame.getByRole('button', {name: 'Sign this payment'}).waitFor();
  await page.waitForTimeout(900);
  await frame.getByRole('button', {name: 'Sign this payment'}).click();
  const evm = await page.evaluate(() => window.pending);
  assert.ok(evm.ok, JSON.stringify(evm));
  _envelope.check(evm.ok, approve, approve.from, verify);
  assert.equal(evm.ok.kind, 'evm', 'the storage-payment reply still names its kind');

  assert.equal(errors.length, 0, 'no page errors: ' + errors.join(' | '));
  console.log('PASS keychain hive door: account-bound posting keys, decoded drop card with delayed trusted press, independent digest+signature verification, ten refusals, EVM path untouched');
} finally { await browser.close(); }
