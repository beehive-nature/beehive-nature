// Host and domain loss, survived: the disposable-identity proof the deployment receipt left open.
// A keychain is born at keys.skaists.dev (route-fulfilled from source, passkey with PRF); that
// origin then DISAPPEARS (every request aborted). The replacement site is BUILT for another
// origin by scripts/build-keychain.mjs --origin (the only way a replacement origin exists — no
// runtime override was added anywhere), and a SECOND browser with a SECOND authenticator — a
// client that has never seen the identity — recovers it from the recovery code alone, enrolls a
// replacement passkey that opens the SAME identity at the new origin, and emits the succession
// record signed by the identity's own r0 rotation key, verified here from the recovery code.
// TESTNET-ONLY: the identity is disposable, nothing is funded, no account binding changes.
import assert from 'node:assert/strict';
import {readFileSync, existsSync, writeFileSync} from 'node:fs';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {chromium} from 'playwright';

const root = process.cwd();
const req = createRequire(import.meta.url);
const G = req('../keychain/genesis.js');
const realm = {TextEncoder, TextDecoder, Uint8Array, BigInt, console, crypto: globalThis.crypto};
realm.window = realm; realm.self = realm; realm.globalThis = realm;
vm.createContext(realm);
vm.runInContext(readFileSync(root + '/surfaces/onboarding/bzdid-key.js', 'utf8'), realm);
const K = realm.BZDIDKEY;

const REPLACEMENT = 'https://replacement.example';
const SITE = mkdtempSync(join(tmpdir(), 'kc-succession-'));
const KEYS = {'/': 'keychain/index.html', '/prelude.js': 'keychain/prelude.js', '/keychain.js': 'keychain/keychain.js', '/genesis.js': 'keychain/genesis.js',
  '/vendor/bzdid-key.js': 'surfaces/onboarding/bzdid-key.js', '/vendor/bnr-sign.js': 'surfaces/onboarding/vendor/bnr-sign.js', '/vendor/hive-tx.min.js': 'surfaces/onboarding/vendor/hive-tx.min.js'};
const type = p => p.endsWith('.html') ? 'text/html' : 'text/javascript';
const AUTHN = {protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true};
const nodeSha256 = b => new Uint8Array(createHash('sha256').update(b).digest());

/* 0. The replacement origin exists only as a BUILD — the source line stays the production truth. */
execFileSync('node', ['scripts/build-keychain.mjs', '--out', SITE, '--origin', REPLACEMENT], {cwd: root, stdio: 'pipe'});
const built = readFileSync(join(SITE, 'keychain.js'), 'utf8');
assert.ok(built.includes(`var ORIGIN = '${REPLACEMENT}'`), 'the built copy carries the replacement origin');
assert.ok(!built.includes("var ORIGIN = 'https://keys.skaists.dev'"), 'the built copy no longer claims the lost origin');
assert.ok(built.includes('PARENTS = []'), 'the replacement build names no embedder until one is chosen');
assert.equal(existsSync(join(SITE, 'CNAME')), false, 'a replacement build claims no domain');
const source = readFileSync(join(root, 'keychain/keychain.js'), 'utf8');
assert.ok(source.includes("var ORIGIN = 'https://keys.skaists.dev'"), 'the SOURCE still pins the production origin — nothing at keys.skaists.dev gained an override');

/* ── act I: the keychain is born at keys.skaists.dev ── */
const browserA = await chromium.launch();
let did1, evm1, code;
try {
  const contextA = await browserA.newContext();
  await contextA.route('https://keys.skaists.dev/**', r => {
    const p = new URL(r.request().url()).pathname;
    return KEYS[p] ? r.fulfill({body: readFileSync(root + '/' + KEYS[p]), contentType: type(KEYS[p])}) : r.fulfill({status: 404, body: ''});
  });
  const pageA = await contextA.newPage();
  const cdpA = await contextA.newCDPSession(pageA);
  await cdpA.send('WebAuthn.enable');
  await cdpA.send('WebAuthn.addVirtualAuthenticator', {options: AUTHN});
  await pageA.goto('https://keys.skaists.dev/');
  await pageA.getByRole('button', {name: 'Make my keychain'}).click();
  await pageA.getByText('Your isolated keychain is open').waitFor({timeout: 20000});
  did1 = (await pageA.locator('dd.mono').nth(0).innerText()).trim();
  evm1 = (await pageA.locator('dd.mono').nth(1).innerText()).trim();
  assert.match(did1, /^did:b:[a-z2-7]{52}$/);
  assert.match(evm1, /^0x[0-9a-f]{40}$/);
  await pageA.getByRole('button', {name: 'Show my recovery code'}).click();
  code = (await pageA.locator('p.mono:not([hidden])').first().innerText()).trim();
  assert.match(code, /^bdidrec1/i, 'the recovery code is shown by the keychain itself');
} finally { await browserA.close(); } /* the original host, profile and authenticator are gone */

/* ── act II: the original origin is UNAVAILABLE; an independent client recovers ── */
const browserB = await chromium.launch();
try {
  const contextB = await browserB.newContext();
  await contextB.route('https://keys.skaists.dev/**', r => r.abort('connectionrefused'));
  await contextB.route(REPLACEMENT + '/**', r => {
    const p = new URL(r.request().url()).pathname;
    const file = join(SITE, p === '/' ? 'index.html' : p.slice(1));
    try { return r.fulfill({body: readFileSync(file), contentType: type(file)}); }
    catch { return r.fulfill({status: 404, body: ''}); }
  });
  const probe = await contextB.newPage();
  const gone = await probe.goto('https://keys.skaists.dev/').then(() => 'opened', e => 'unreachable');
  assert.equal(gone, 'unreachable', 'the original origin does not answer');

  const pageB = await contextB.newPage();
  const cdpB = await contextB.newCDPSession(pageB);
  await cdpB.send('WebAuthn.enable');
  await cdpB.send('WebAuthn.addVirtualAuthenticator', {options: AUTHN}); /* a different device: no shared passkey */
  await pageB.goto(REPLACEMENT + '/');
  await pageB.getByRole('button', {name: 'I already have one'}).waitFor();
  /* no silent new identity: the page offers birth, but recovery is what is used */
  await pageB.getByText('Open with a recovery code').click();
  await pageB.locator('input[aria-label="Recovery code"]').fill(code);
  await pageB.getByRole('button', {name: 'Open', exact: true}).click();
  await pageB.getByText('Your isolated keychain is open').waitFor({timeout: 20000});
  const did2 = (await pageB.locator('dd.mono').nth(0).innerText()).trim();
  const evm2 = (await pageB.locator('dd.mono').nth(1).innerText()).trim();
  assert.equal(did2, did1, 'the SAME identity recovered at the replacement origin');
  assert.equal(evm2, evm1, 'the intended account bindings are unchanged — no new funded identity was made');

  /* ── act III: a replacement passkey for the new origin, and the succession record ── */
  await pageB.getByText('New origin, or lost passkey? Re-enroll here').click();
  await pageB.getByRole('button', {name: 'Re-enroll a passkey for this origin'}).click();
  await pageB.getByText('Re-enrolled for this origin').waitFor({timeout: 30000});
  const recordText = await pageB.locator('p.mono').first().innerText();
  const record = JSON.parse(recordText);
  assert.equal(record.body.did, did1, 'the record names the original identity');
  assert.equal(record.body.to_origin, REPLACEMENT, 'the record names the replacement origin');
  assert.equal(record.body.passkey_rp, 'replacement.example', 'the record names the passkey scope honestly');
  /* verified here from the recovery code and the public genesis — this page's word counts for nothing */
  const masterPrk = K.decodeRecoveryAuto(code);
  const r0 = K.deriveRecordKey(masterPrk, 'bzdid/rotation/r0');
  assert.equal(K.toHex(r0.publicKey), record.r0, 'the r0 key in the record is the one the recovery code derives');
  const msg = new TextEncoder().encode(JSON.stringify(record.body));
  assert.equal(K.verifyRecordSig(new Uint8Array(Buffer.from(record.sig, 'hex')), msg, r0.publicKey), true,
    'the succession record is signed by the identity\u2019s own rotation key');
  const genesisBytes = new Uint8Array(Buffer.from(record.genesis, 'hex'));
  assert.equal(G.didOf(genesisBytes, nodeSha256), did1, 'the record carries the genesis whose hash IS the did');

  /* ── act IV: the replacement passkey opens the same identity with NO code ── */
  await pageB.getByRole('button', {name: 'Back'}).click();
  await pageB.getByRole('button', {name: 'Lock'}).click();
  await pageB.getByText('Unlock your isolated keychain').waitFor();
  await pageB.getByRole('button', {name: 'Unlock with my passkey'}).click();
  await pageB.getByText('Your isolated keychain is open').waitFor({timeout: 20000});
  assert.equal((await pageB.locator('dd.mono').nth(0).innerText()).trim(), did1, 'the enrolled passkey reopens the SAME identity');
  assert.equal((await pageB.locator('dd.mono').nth(1).innerText()).trim(), evm1, 'the SAME Arbitrum account — the wrap checks the did at every unlock');

  /* what the replacement profile stores: a seal under the new passkey, never the root itself */
  const store = await pageB.evaluate(() => JSON.stringify(localStorage));
  const wrapped = JSON.parse(JSON.parse(store)['kc.wrapped.v1']);
  assert.equal(wrapped.did, did1, 'the seal names the identity it holds');
  assert.match(wrapped.ct, /^[0-9a-f]+$/, 'the seal is ciphertext only');
  assert.equal(wrapped.ct.length, 96, 'the seal is the 32-byte root plus its 16-byte GCM tag — longer than the root itself');
  assert.ok(!store.toLowerCase().includes(K.toHex(masterPrk)), 'the root itself never sits in storage');
  assert.equal((store.match(/"[0-9a-f]{64}"/gi) || []).length, 0, 'no bare 32-byte hex value sits in storage');
  assert.ok(!new RegExp(code.slice(-20), 'i').test(store), 'no recovery-code material sits in storage');

  /* a replacement build refuses a foreign embedder exactly as the production one does: with no
     named parent, being framed at all is refused. the parent below is a plain page at the same
     origin (the keychain's own CSP would block it framing anything, so a separate page is used) */
  writeFileSync(join(SITE, 'parent.html'), '<!doctype html><meta charset="utf-8"><body><iframe src="https://replacement.example/" style="width:100%;height:300px"></iframe></body>');
  const framed = await contextB.newPage();
  await framed.goto(REPLACEMENT + '/parent.html');
  await framed.waitForTimeout(1500);
  const frameText = framed.frames()[1] ? await framed.frames()[1].locator('#kc').innerText().catch(() => '') : '';
  assert.match(frameText, /on its own/, 'the framed replacement copy refuses to be a keychain inside a page that is not its wallet');
} finally { await browserB.close(); rmSync(SITE, {recursive: true, force: true}); }

console.log('PASS keychain succession: origin lost, independent client recovered the same identity from the code, replacement passkey enrolled at the new origin opens it without the code, r0-signed succession record verified from the recovery code, storage holds only the seal');
