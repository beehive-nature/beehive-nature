/* Node test harness for surfaces/vault.js — run: node tools/test-vault.js
   Shims the three browser globals the vault touches (window, localStorage,
   BIP39_WORDLIST) and exercises the crypto/format logic headlessly. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
async function throws(name, fn, wantSubstr) {
  try { await fn(); ok(name, false, 'expected a throw, got none'); }
  catch (e) {
    ok(name, !wantSubstr || e.message.includes(wantSubstr), 'got: ' + e.message);
  }
}

// ── sandbox ────────────────────────────────────────────────────────────────
const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
};
const sandbox = {
  window: {}, localStorage, crypto, console,
  TextEncoder, TextDecoder, btoa, atob, Math, Date, JSON, Object, Array,
  Uint8Array, Uint16Array, String, Number, RegExp, Error, Promise, parseInt,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'surfaces/onboarding/vendor/bip39-wordlist.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'surfaces/vault.js'), 'utf8'), sandbox);
const V = sandbox.window.BNRVAULT;
const WL = sandbox.window.BIP39_WORDLIST;

(async function main() {

console.log('\n── wordlist ──');
ok('2048 words', WL.length === 2048);
ok('bounds abandon..zoo', WL[0] === 'abandon' && WL[2047] === 'zoo');
ok('sorted', WL.every((w, i) => i === 0 || WL[i - 1] < w));

console.log('\n── BIP-39: official Trezor vectors (all-zero entropy) ──');
const A = n => Array(n).fill('abandon').join(' ');
const vectors = [
  [`${A(11)} about`, 12, 128],
  [`${A(17)} agent`, 18, 192],
  [`${A(23)} art`, 24, 256],
];
for (const [phrase, count, bits] of vectors) {
  const r = await V.validateMnemonic(phrase);
  ok(`${count}-word vector validates`, r.ok, r.error);
  ok(`${count}-word entropy is ${bits} bits of zero`,
     r.ok && r.entropyBits === bits && /^0+$/.test(r.entropyHex),
     r.ok ? r.entropyHex : '');
}

console.log('\n── BIP-39: checksum arithmetic across every legal length ──');
// For an N-word phrase the final word carries (ENT - 11*(N-1)) free entropy bits,
// so exactly 2^that many last-words can complete a valid phrase. Wrong bit order
// or an off-by-one in the checksum slice changes these counts immediately.
const expectedTails = { 12: 128, 15: 64, 18: 32, 21: 16, 24: 8 };
for (const n of [12, 15, 18, 21, 24]) {
  const head = Array(n - 1).fill('abandon');
  let good = 0, sample = null;
  for (const w of WL) {
    const r = await V.validateMnemonic(head.concat([w]).join(' '));
    if (r.ok) { good++; if (!sample) sample = w; }
  }
  ok(`${n}-word: exactly ${expectedTails[n]} valid final words`,
     good === expectedTails[n], `got ${good}`);
  if (sample) {
    const r = await V.validateMnemonic(head.concat([sample]).join(' '));
    ok(`${n}-word: entropy is ${n * 11 - (n * 11) / 33} bits`,
       r.entropyBits === n * 11 - (n * 11) / 33, String(r.entropyBits));
  }
}

console.log('\n── BIP-39: rejections ──');
let r;
r = await V.validateMnemonic(`${A(10)} about`);
ok('rejects 11 words', !r.ok && r.error.includes('12, 15, 18, 21 or 24'), r.error);
r = await V.validateMnemonic(`${A(11)} zzzznotaword`);
ok('rejects unknown word, names position', !r.ok && r.error.includes('word 12'), r.error);
r = await V.validateMnemonic(`${A(11)} zoo`);
ok('rejects bad checksum', !r.ok && r.error.includes('checksum failed'), r.error);
r = await V.validateMnemonic(`  ABANDON   ${A(10)}\n about  `);
ok('normalises case + whitespace', r.ok, r.error);
r = await V.validateMnemonic('');
ok('rejects empty', !r.ok);

console.log('\n── BIP-39: seed derivation (official vector, passphrase TREZOR) ──');
const seed = await V.mnemonicToSeed(`${A(11)} about`, 'TREZOR');
const seedHex = Buffer.from(seed).toString('hex');
ok('seed matches published vector',
   seedHex === 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04', // PUBLIC-CONSTANT: BIP-39 published test vector — the known-answer the standard itself prints, never a live seed
   seedHex.slice(0, 24));

console.log('\n── Vaulta / EOSIO private keys ──');
// Known-good WIF for secret 0x00…01 (uncompressed, mainnet 0x80).
const WIF_UNCOMP = '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAnchuDf';
const WIF_COMP   = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
r = await V.validateVaultaKey(WIF_UNCOMP);
ok('accepts 51-char WIF', r.ok && r.format === 'WIF', r.error || r.format);
r = await V.validateVaultaKey(WIF_COMP);
ok('accepts 52-char compressed WIF', r.ok && r.format === 'WIF-compressed', r.error || r.format);
r = await V.validateVaultaKey('PVT_K1_' + '5'.repeat(50));
ok('accepts PVT_K1_ shape, defers checksum', r.ok && r.checksum === 'deferred', r.error);
r = await V.validateVaultaKey('PVT_R1_' + '5'.repeat(50));
ok('rejects PVT_R1_ (wrong curve)', !r.ok && r.error.includes('K1'), r.error);
r = await V.validateVaultaKey(WIF_UNCOMP.slice(0, -1) + 'X');
ok('rejects tampered checksum', !r.ok && r.error.includes('checksum failed'), r.error);
r = await V.validateVaultaKey('EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV');
ok('rejects a PUBLIC key with a useful message',
   !r.ok && /PUBLIC key/.test(r.error), r.error);
r = await V.validateVaultaKey('not base58 !!');
ok('rejects non-base58', !r.ok && r.error.includes('base58'), r.error);

console.log('\n── detect() routing ──');
ok('routes a phrase to seed', (await V.detect(`${A(11)} about`)).kind === 'seed');
ok('routes a WIF to vaulta', (await V.detect(WIF_COMP)).kind === 'vaulta');
ok('routes PVT_K1_ to vaulta', (await V.detect('PVT_K1_' + '5'.repeat(50))).kind === 'vaulta');

console.log('\n── keypass generation ──');
const kp = V.generateKeypass(8);
ok('8 words / 88 bits', kp.words === 8 && kp.bits === 88, JSON.stringify(kp));
ok('drawn from the wordlist', kp.phrase.split('-').every(w => WL.includes(w)));
const many = new Set();
for (let i = 0; i < 200; i++) many.add(V.generateKeypass(8).phrase);
ok('200 generations are all distinct', many.size === 200, String(many.size));
ok('clamps low', V.generateKeypass(1).words === 4);
ok('clamps high', V.generateKeypass(99).words === 24);
ok('generated phrase scores as strong', V.keypassStrength(kp.phrase).bits >= 88);
ok('short password scores weak', V.keypassStrength('hunter2').bits < 50);

console.log('\n── vault lifecycle ──');
const PASS = V.generateKeypass(8).phrase;
await V.create(PASS);
ok('created + unlocked', V.isUnlocked() && V.exists());
await throws('refuses a second vault', () => V.create(PASS), 'already exists');

await V.addEntry({ type: 'seed', label: 'ledger main', secret: `${A(23)} art`, chain: 'BTC' });
await V.addEntry({ type: 'vaulta', label: 'kingbeelovis active', secret: WIF_COMP, chain: 'Vaulta' });
await V.addEntry({ type: 'note', label: 'where the steel plate is', secret: 'under the third hive' });
ok('three entries stored', V.list().length === 3);
ok('list() never carries secrets',
   JSON.stringify(V.list()).indexOf(WIF_COMP) < 0 && !('secret' in V.list()[0]));
ok('seed meta recorded', V.list()[0].meta.words === 24 && V.list()[0].meta.valid === true);
ok('vaulta meta recorded', V.list()[1].meta.format === 'WIF-compressed');

await throws('rejects an invalid seed', () =>
  V.addEntry({ type: 'seed', label: 'bad', secret: `${A(11)} zoo` }), 'checksum failed');
await throws('rejects an invalid key', () =>
  V.addEntry({ type: 'vaulta', label: 'bad', secret: 'nope' }), 'too short');
await throws('rejects a blank label', () =>
  V.addEntry({ type: 'seed', label: '   ', secret: `${A(11)} about` }), 'label');
const forced = await V.addEntry({ type: 'seed', label: 'nonstandard', secret: `${A(11)} zoo`, force: true });
ok('force:true stores but marks invalid', forced.meta.valid === false);
await V.removeEntry(forced.id);
ok('removed', V.list().length === 3);

console.log('\n── lock / unlock ──');
const id0 = V.list()[1].id;
ok('reveal works while unlocked', V.reveal(id0).secret === WIF_COMP);
V.lock();
ok('locked', !V.isUnlocked());
try { V.list(); ok('list() blocked when locked', false); }
catch (e) { ok('list() blocked when locked', e.message.includes('locked')); }
await throws('wrong keypass rejected', () => V.unlock('wrong-keypass-entirely'), 'does not match any slot');
await V.unlock(PASS);
ok('re-unlocked, entries intact', V.list().length === 3);
ok('secret survived the round trip', V.reveal(id0).secret === WIF_COMP);

console.log('\n── envelope ──');
const env = JSON.parse(V.exportEnvelope());
ok('envelope is versioned + labelled', env.magic === 'BNRVAULT' && env.format === 2);
ok('KDF params recorded on the slot', env.slots[0].kdf === 'PBKDF2-SHA-256' && env.slots[0].iterations === 600000);
ok('no plaintext in the envelope',
   !JSON.stringify(env).includes(WIF_COMP) && !JSON.stringify(env).includes('kingbeelovis'));
ok('slot salt and payload IV are distinct', env.slots[0].salt !== env.iv && env.slots[0].salt.length >= 20);
ok('wrapped VMK present and distinct from the payload', !!env.slots[0].wrapped && env.slots[0].wrapped !== env.ct);

// AAD: editing the header must break authentication, not silently downgrade.
const tampered = JSON.parse(JSON.stringify(env));
tampered.slots[0].iterations = 1;
await throws('slot tampering fails authentication',
  () => V.importEnvelope(JSON.stringify(tampered), PASS), 'does not match any slot');

console.log('\n── re-key ──');
const PASS2 = V.generateKeypass(8).phrase;
const cur0 = V.listSlots().filter(x=>x.current)[0].id;
 const saltBefore = JSON.parse(V.exportEnvelope()).slots.filter(x=>x.id===cur0)[0].salt;
await V.changeKeypass(PASS, PASS2);
const saltAfter = JSON.parse(V.exportEnvelope()).slots.filter(x=>x.current!==false).map(x=>x.salt).join();
ok('slot salt rotated on re-key', saltBefore && saltAfter && saltBefore !== saltAfter, saltBefore+' vs '+saltAfter);
V.lock();
await throws('old keypass no longer opens it', () => V.unlock(PASS), 'does not match any slot');
await V.unlock(PASS2);
ok('new keypass opens it, entries intact', V.list().length === 3);

console.log('\n── import / destroy ──');
const saved = V.exportEnvelope();
V.destroy();
ok('destroyed', !V.exists() && !V.isUnlocked());
await V.importEnvelope(saved, PASS2);
ok('imported and unlocked', V.isUnlocked() && V.list().length === 3);
await throws('import with wrong keypass refused',
  () => V.importEnvelope(saved, 'nope-nope-nope'), 'does not match any slot');
await throws('import of junk refused', () => V.importEnvelope('{not json', PASS2), 'not JSON');


console.log('\n── multi-device slots ──');
ok('one slot after create', V.listSlots().length === 1);
ok('current slot flagged', V.listSlots()[0].current === true);

const LAPTOP = PASS2;                        // the slot we are currently unlocked with
const PHONE  = V.generateKeypass(8).phrase;  // 'mobile - Bitwarden'
const TABLET = V.generateKeypass(8).phrase;  // 'tablet - Google'
await V.addKeypassSlot(PHONE, 'mobile - Bitwarden');
await V.addKeypassSlot(TABLET, 'tablet - Google');
ok('three slots', V.listSlots().length === 3);
ok('labels kept', V.listSlots().map(s => s.label).includes('mobile - Bitwarden'));
await throws('refuses a duplicate keypass', () => V.addKeypassSlot(PHONE, 'dupe'), 'already opens');
await throws('refuses a weak slot keypass', () => V.addKeypassSlot('abc', 'weak'), 'too weak');

console.log('\n── every slot opens the same vault ──');
for (const [name, pass] of [['laptop', LAPTOP], ['phone', PHONE], ['tablet', TABLET]]) {
  V.lock();
  await V.unlock(pass);
  ok(name + ' keypass opens it, same 3 entries', V.list().length === 3);
  ok(name + ' sees the same secret', V.reveal(V.list()[1].id).secret === WIF_COMP);
}

console.log('\n── passkey slots (PRF secret supplied by the page) ──');
const PRF_LAPTOP = new Uint8Array(32).fill(7);
const PRF_PHONE  = new Uint8Array(32).fill(9);
V.lock(); await V.unlock(LAPTOP);
await V.addPasskeySlot(PRF_LAPTOP, 'Windows Hello - laptop');
ok('passkey slot added', V.listSlots().length === 4);
await throws('rejects a short PRF secret', () => V.addPasskeySlot(new Uint8Array(8), 'bad'), '32-byte');
await throws('refuses a duplicate passkey', () => V.addPasskeySlot(PRF_LAPTOP, 'dupe'), 'already opens');
V.lock();
const pr = await V.unlockWithPasskey(PRF_LAPTOP);
ok('passkey opens the vault', V.isUnlocked() && V.list().length === 3, JSON.stringify(pr));
V.lock();
await throws('an unknown passkey is refused', () => V.unlockWithPasskey(PRF_PHONE), 'does not match any slot');

console.log('\n── revocation ──');
await V.unlock(LAPTOP);
const phoneSlot = V.listSlots().filter(s => s.label === 'mobile - Bitwarden')[0];
await throws('cannot remove the slot you are using',
  () => V.removeSlot(V.listSlots().filter(s => s.current)[0].id), 'currently unlocked with');
await V.removeSlot(phoneSlot.id);
ok('slot removed', V.listSlots().length === 3);
V.lock();
await throws('revoked keypass no longer opens it', () => V.unlock(PHONE), 'does not match any slot');
await V.unlock(TABLET);
ok('other devices still work after a revoke', V.list().length === 3);

console.log('\n── re-keying one device leaves the others alone ──');
const LAPTOP2 = V.generateKeypass(8).phrase;
V.lock(); await V.unlock(LAPTOP);
await V.changeKeypass(LAPTOP, LAPTOP2);
V.lock();
await throws('old laptop keypass dead', () => V.unlock(LAPTOP), 'does not match any slot');
await V.unlock(LAPTOP2); ok('new laptop keypass works', V.list().length === 3);
V.lock();
await V.unlock(TABLET);  ok('tablet keypass untouched by the re-key', V.list().length === 3);

console.log('\n── v1 vaults still open, and migrate ──');
const v1pass = 'legacy-keypass-legacy-keypass';
{
  const te = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const hdr = { magic: 'BNRVAULT', format: 1, kdf: 'PBKDF2-SHA-256', iterations: 600000,
                salt: Buffer.from(salt).toString('base64') };
  const base = await crypto.subtle.importKey('raw', te.encode(v1pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:600000, hash:'SHA-256' },
    base, { name:'AES-GCM', length:256 }, false, ['encrypt']);
  const payload = { entries: [{ id:'aa', type:'note', label:'legacy note', secret:'from v1',
                    passphrase:'', chain:'', note:'', meta:{}, added:'2026-01-01T00:00:00Z' }] };
  const aad = te.encode(JSON.stringify(hdr));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv, additionalData: aad },
    key, te.encode(JSON.stringify(payload))));
  store.set('bnr_vault', JSON.stringify(Object.assign({}, hdr,
    { iv: Buffer.from(iv).toString('base64'), ct: Buffer.from(ct).toString('base64') })));
}
V.lock();
const mig = await V.unlock(v1pass);
ok('v1 vault opens', V.isUnlocked() && V.list().length === 1, JSON.stringify(mig));
ok('v1 reported as migrated', mig.migrated === true);
ok('v1 entry survived', V.reveal(V.list()[0].id).secret === 'from v1');
ok('now stored as v2 with a slot', JSON.parse(V.exportEnvelope()).format === 2);
V.lock();
await V.unlock(v1pass);
ok('migrated vault reopens with the same keypass', V.list().length === 1);
await V.addKeypassSlot(V.generateKeypass(8).phrase, 'phone');
ok('and can now take a second device', V.listSlots().length === 2);

console.log('\n── T3 §6b evidence ladder ──');
V.destroy();
const EPASS = V.generateKeypass(8).phrase;
await V.create(EPASS, 'laptop - Bitwarden');
ok('a keypass slot sits at the E2 floor', V.listSlots()[0].evidence === 'E2');
ok('and is marked as software/synced', V.listSlots()[0].bound === 'synced-or-software');
await V.addPasskeySlot(new Uint8Array(32).fill(3), 'iPhone - iCloud Keychain');
const synced = V.listSlots().filter(x => x.label.includes('iPhone'))[0];
ok('a passkey with no attestation is E2, not E3', synced.evidence === 'E2');
await V.addPasskeySlot(new Uint8Array(32).fill(4), 'Windows Hello', { deviceBound: true });
const bound = V.listSlots().filter(x => x.label === 'Windows Hello')[0];
ok('a device-bound platform passkey can claim E3', bound.evidence === 'E3');
ok('and is marked device-bound', bound.bound === 'device-bound');

// The evidence class is inside the slot AAD, so re-grading it must break the wrap.
{
  const env = JSON.parse(V.exportEnvelope());
  const i = env.slots.findIndex(x => x.label === 'iPhone - iCloud Keychain');
  env.slots[i].evidence = 'E3';
  store.set('bnr_vault', JSON.stringify(env));
  V.lock();
  let opened = true;
  try { await V.unlockWithPasskey(new Uint8Array(32).fill(3)); } catch (e) { opened = false; }
  ok('re-grading E2 to E3 by editing JSON breaks that slot', opened === false);
  store.set('bnr_vault', V.exportEnvelope === null ? '' : JSON.stringify(env));
}

console.log('\n── T3 panic path: revoke-all-except-anchor ──');
V.destroy();
const APASS = V.generateKeypass(8).phrase;
await V.create(APASS, 'anchor');
await V.addKeypassSlot(V.generateKeypass(8).phrase, 'lost phone');
await V.addPasskeySlot(new Uint8Array(32).fill(5), 'lost tablet');
ok('three ways in before the panic', V.listSlots().length === 3);
const anchorId = V.listSlots().filter(x => x.current)[0].id;
await throws('refuses to keep a slot you are not holding',
  () => V.revokeAllExcept(V.listSlots().filter(x => !x.current)[0].id), 'currently unlocked with');
const rr = await V.revokeAllExcept(anchorId);
ok('revoked the other two', rr.revoked === 2 && V.listSlots().length === 1);
ok('the anchor still opens it', (V.lock(), await V.unlock(APASS), V.isUnlocked()));
await throws('nothing left to revoke', () => V.revokeAllExcept(), 'only one slot');
console.log('\n────────────────────────────────');
console.log(`${pass} passed, ${fail} failed`);
if (fail) { console.log('\nfailures:'); failures.forEach(f => console.log('  · ' + f)); process.exit(1); }
})().catch(e => { console.error('\nHARNESS ERROR:', e); process.exit(1); });
