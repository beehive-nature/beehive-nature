// e2e for surfaces/wallet.html — THE VAULT, in real Chromium with a CTAP2
// virtual authenticator carrying PRF. Static checks cannot see a runtime
// null-deref or a WebCrypto call that only fails in a browser; this can.
// Run:  cd e2e && node wallet-vault.mjs
import { chromium } from 'playwright';
import { pinRegister, REG } from './wallet-register-pin.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.E2E_ROOT || path.join(here, '..', 'surfaces');
const PORT = 8901;

const types = { '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
                '.json':'application/json', '.wasm':'application/wasm', '.jpg':'image/jpeg' };
const srv = http.createServer((req,res)=>{
  const rel = req.url === '/' ? 'wallet.html' : decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'');
  const f = path.join(root, rel);
  if (!f.startsWith(root)) { res.statusCode = 403; return res.end('no'); }
  try {
    res.setHeader('content-type', types[path.extname(f)] || 'text/html');
    res.end(fs.readFileSync(f));
  } catch { res.statusCode = 404; res.end('nf'); }
}).listen(PORT);

let pass = 0, fail = 0;
const failures = [];
const t = (name, v, detail) => {
  if (v) { pass++; console.log('  ok   ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};

const browser = await chromium.launch({ args:['--no-sandbox'] });
// the register this battery reads in: WALLET_REG (see wallet-register-pin.mjs)
pinRegister(browser);
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Surface anything the page throws — a silent handler error is the failure mode
// static analysis misses entirely.
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const cdp = await ctx.newCDPSession(page);
await cdp.send('WebAuthn.enable');
let authId = null, hasPrf = true;
try {
  const r = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol:'ctap2', transport:'internal', hasResidentKey:true, hasUserVerification:true,
    isUserVerified:true, automaticPresenceSimulation:true, hasPrf:true }});
  authId = r.authenticatorId;
} catch (e) {
  hasPrf = false;
  const r = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol:'ctap2', transport:'internal', hasResidentKey:true, hasUserVerification:true,
    isUserVerified:true, automaticPresenceSimulation:true }});
  authId = r.authenticatorId;
}

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);

console.log('\n── page boot ──');
t('vault engine loaded', await page.evaluate(()=>!!window.BNRVAULT));
t('BIP-39 wordlist loaded (2048)', await page.evaluate(()=>!!window.BIP39_WORDLIST && window.BIP39_WORDLIST.length===2048));
t('bzDiD engine still loaded', await page.evaluate(()=>!!window.BZDIDKEY));
t('vault section rendered', await page.locator('#vault-sec').count() === 1);
t('no page errors on boot', pageErrors.length === 0, pageErrors.join(' | '));

console.log('\n── the three states ──');
t('starts on the create-a-vault state', await page.locator('#vlt-new').isVisible());
t('the vault speaks in lowercase sentences: no ALL-CAPS button or stamp',
  await page.evaluate(() => ['vlt-create', 'vlt-unlock', 'vlt-add', 'vlt-openstamp'].every(i => !/\b[A-Z]{3,}\b/.test(document.getElementById(i).textContent))));
t('before create, the no-reset truth sits beside the button, not inside a fold', await page.locator('#vlt-noreset').isVisible());
t('locked state hidden', !(await page.locator('#vlt-locked').isVisible()));
t('unlocked state hidden', !(await page.locator('#vlt-open').isVisible()));

console.log('\n── generate a keypass ──');
await page.click('#vlt-gen');
await page.waitForTimeout(150);
const gen = await page.inputValue('#vlt-newpass');
t('generator filled both fields', gen.length > 0 && gen === await page.inputValue('#vlt-newpass2'));
t('8 words by default', gen.split('-').length === 8, gen);
let kp = gen;                               // the keypass in use; change keypass moves it
t('strength shown as strong', /strong/i.test(await page.textContent('#vlt-strength')));

console.log('\n── create ──');
await page.click('#vlt-create');
await page.waitForTimeout(2500);            // 600k PBKDF2 rounds, deliberately slow
t('now unlocked', await page.locator('#vlt-open').isVisible());
t('one device slot listed', (await page.locator('#vlt-devices .chip').count()) === 1);
t('slot shows the E2 floor', /E2/.test(await page.textContent('#vlt-devices')));

console.log('\n── live validation ──');
const A = n => Array(n).fill('abandon').join(' ');
await page.locator('#vlt-secret-scaffold').evaluate(el => { el.open = true; });
await page.fill('#vlt-secret', `${A(11)} about`);
await page.waitForTimeout(350);
t('valid 12-word phrase recognised', /valid BIP-39/.test(await page.textContent('#vlt-check')));
await page.fill('#vlt-secret', `${A(11)} zoo`);
await page.waitForTimeout(350);
t('bad checksum caught in the browser', /checksum failed/.test(await page.textContent('#vlt-check')));
await page.fill('#vlt-secret', 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn'); // PUBLIC-CONSTANT: published compressed WIF test vector (same as tools/test-vault.js)
await page.waitForTimeout(350);
t('Vaulta key recognised', /valid Vaulta active key/.test(await page.textContent('#vlt-check')));

console.log('\n── seal two secrets ──');
await page.fill('#vlt-label', 'kingbeelovis active');
await page.fill('#vlt-chain', 'Vaulta');
await page.click('#vlt-add');
await page.waitForTimeout(700);
await page.fill('#vlt-secret', `${A(23)} art`);
await page.fill('#vlt-label', 'ledger main');
await page.waitForTimeout(350);
await page.click('#vlt-add');
await page.waitForTimeout(700);
t('two entries listed', (await page.locator('#vlt-list .chip').count()) === 2, await page.textContent('#vlt-count'));

console.log('\n── reveal + hand a key to the bridge ──');
await page.locator('#vlt-list .chip button[data-act="reveal"]').first().click();
await page.waitForTimeout(300);
t('reveal shows the secret', /KwDiBf89/.test(await page.textContent('#vlt-revealed')));
const copyShown = await page.locator('#vlt-revealed button', { hasText: 'copy to clipboard' }).isVisible();
t(REG === 'cypherpunk' ? 'cypherpunk keeps the copy button, with its warning' : 'no copy button in ' + REG + ' (a copy sends the key elsewhere)',
  REG === 'cypherpunk' ? copyShown : !copyShown);
t('a revealed Vaulta key is offered for use right here', await page.locator('#vlt-revealed button', { hasText: 'let this wallet sign' }).isVisible());
await page.locator('#br-wif-scaffold').evaluate(el => { el.open = true; });
// no keychain in this tab: the bridge is closed, so the key goes nowhere
await page.locator('#vlt-list .chip button[data-act="bridge"]').first().click();
await page.waitForTimeout(300);
t('with the bridge closed, the key is placed nowhere (never the hidden #br-wif)',
  (await page.inputValue('#br-wif')) === '' && (await page.locator('#br-paste').count()) === 0);
t('and the line names the keychain to connect', await page.evaluate(() => !!document.querySelector('#vlt-stat a[href="#kc-sec"]')));
// the bridge open with its one-press field, as brCalm paints it once the keychain reads the account
await page.evaluate(() => {
  document.getElementById('bridge-sec').style.display = 'block';
  const i = document.createElement('input'); i.type = 'password'; i.id = 'br-paste'; document.getElementById('br-calm').appendChild(i);
});
// a paste in flight, or one held until the account is read: its field and button cannot be pressed, so no key goes there
await page.evaluate(() => {
  document.getElementById('br-paste').disabled = true;
  const g = document.createElement('button'); g.id = 'br-paste-go'; g.disabled = true; document.getElementById('br-calm').appendChild(g);
});
await page.locator('#vlt-list .chip button[data-act="bridge"]').first().click();
await page.waitForTimeout(300);
t('with a paste in flight or held, the key is placed nowhere',
  (await page.inputValue('#br-paste')) === '' && (await page.inputValue('#br-wif')) === '');
t('and the line says the last paste is still being checked, with its one link',
  /^your last paste is still being checked, so this key stays in the vault for now\. see where it stands/.test((await page.innerText('#vlt-stat')).trim())
    && await page.evaluate(() => !!document.querySelector('#vlt-stat a[href="#bridge-sec"]')), await page.innerText('#vlt-stat'));
await page.evaluate(() => { document.getElementById('br-paste').disabled = false; document.getElementById('br-paste-go').disabled = false; });
await page.locator('#vlt-list .chip button[data-act="bridge"]').first().click();
await page.waitForTimeout(300);
t('key handed to the one-press field every register sees',
  (await page.inputValue('#br-paste')) === 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn'); // PUBLIC-CONSTANT: published compressed WIF test vector
t('and never to the hidden #br-wif', (await page.inputValue('#br-wif')) === '');
t('the line links to where the key is used', await page.evaluate(() => !!document.querySelector('#vlt-stat a[href="#bridge-sec"]')));

console.log('\n── lock / unlock round trip ──');
await page.click('#vlt-lock');
await page.waitForTimeout(300);
t('locked state shown', await page.locator('#vlt-locked').isVisible());
t('a vault no passkey opens offers no passkey button', !(await page.locator('#vlt-pkunlock').isVisible()));
t('the key handed to the bridge is wiped when the vault locks', (await page.inputValue('#br-paste')) === '');
await page.evaluate(() => { window.__vaultOpened = 0; document.addEventListener('vault-unlocked', () => { window.__vaultOpened++; }); });
await page.evaluate(() => { document.getElementById('br-paste').remove(); document.getElementById('br-paste-go').remove(); document.getElementById('bridge-sec').style.display = 'none'; });
t('entries not in the DOM while locked', (await page.locator('#vlt-list .chip').count()) === 0);
await page.fill('#vlt-pass', gen);
await page.click('#vlt-unlock');
await page.waitForTimeout(2500);
t('unlocked again', await page.locator('#vlt-open').isVisible());
t('the vault says it opened (vault-unlocked), so a part reading a sealed key need not wait for a click',
  await page.evaluate(() => window.__vaultOpened === 1));
t('both entries survived', (await page.locator('#vlt-list .chip').count()) === 2);

console.log('\n── wrong keypass ──');
await page.click('#vlt-lock'); await page.waitForTimeout(200);
await page.fill('#vlt-pass', 'definitely-not-the-keypass');
await page.click('#vlt-unlock');
await page.waitForTimeout(2500);
t('refused, still locked', await page.locator('#vlt-locked').isVisible());
t('says it matched no slot', /does not match any slot/.test(await page.textContent('#vlt-stat')));
await page.fill('#vlt-pass', gen); await page.click('#vlt-unlock'); await page.waitForTimeout(2500);

console.log('\n── change keypass checks the keypass in use ──');
await page.click('#vlt-rekey');
await page.waitForTimeout(200);
t('change keypass asks in the page, hidden as typed (no browser prompt)',
  await page.locator('#vlt-ask').isVisible() && (await page.getAttribute('#vlt-ask-in', 'type')) === 'password');
await page.fill('#vlt-ask-in', 'definitely-not-the-keypass');
await page.click('#vlt-ask-go');
await page.waitForTimeout(2500);
t('a wrong current keypass is refused, and nothing changed',
  /not the keypass you use now/.test(await page.textContent('#vlt-stat')) && !(await page.locator('#vlt-ask').isVisible()),
  await page.textContent('#vlt-stat'));
// this browser refuses to save the re-key: the keypass in use stays in force, in this tab and in storage
await page.evaluate(() => {
  const o = Storage.prototype.setItem; window.__setItem = o; window.__failVault = 1;
  Storage.prototype.setItem = function (k, v) {
    if (k === 'bnr_vault' && window.__failVault > 0) { window.__failVault--; throw new DOMException('the test refuses this write', 'QuotaExceededError'); }
    return o.call(this, k, v);
  };
});
await page.click('#vlt-rekey'); await page.waitForTimeout(200);
await page.fill('#vlt-ask-in', kp); await page.click('#vlt-ask-go');
// each step waits for the page, not the clock: a loaded machine runs 600 000 rounds slower
await page.waitForFunction(() => document.getElementById('vlt-ask-in').type === 'text', null, { timeout: 30000 }).catch(() => {});
await page.click('#vlt-ask-go');
await page.waitForFunction(() => /would not save|keypass works|did not change/.test(document.getElementById('vlt-stat').textContent), null, { timeout: 30000 }).catch(() => {});
await page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
t('a re-key this browser would not save says so: the keypass is the same as before',
  /would not save the change, so your keypass is the same as before/.test(await page.innerText('#vlt-stat')), await page.innerText('#vlt-stat'));
t('and the keypass in use still opens the open slot', await page.evaluate(k => window.BNRVAULT.checkKeypass(k), kp));
// a later save must not carry the refused re-key into storage
await page.evaluate(async () => { const V = window.BNRVAULT; const e = await V.addEntry({ type: 'note', label: 'probe', secret: 'probe' }); await V.removeEntry(e.id); });
await page.click('#vlt-lock'); await page.waitForTimeout(200);
await page.fill('#vlt-pass', kp); await page.click('#vlt-unlock');
await page.waitForFunction(() => { const o = document.getElementById('vlt-open'); return (o && o.getClientRects().length > 0) || /does not match/.test(document.getElementById('vlt-stat').textContent); }, null, { timeout: 30000 }).catch(() => {});
t('after a later save, the keypass in use still opens the vault', await page.locator('#vlt-open').isVisible(), await page.textContent('#vlt-stat'));
t('and nothing else changed with it', (await page.locator('#vlt-list .chip').count()) === 2);
await page.click('#vlt-rekey'); await page.waitForTimeout(200);
await page.fill('#vlt-ask-in', kp);
await page.click('#vlt-ask-go');
await page.waitForTimeout(2500);
const newPass = await page.inputValue('#vlt-ask-in');
t('the right one moves on to the new keypass, shown once to write down',
  newPass.split('-').length === 8 && newPass !== kp && (await page.getAttribute('#vlt-ask-in', 'type')) === 'text', newPass);
await page.click('#vlt-ask-go');
await page.waitForTimeout(3500);
t('says the new keypass works', /new keypass works/.test(await page.textContent('#vlt-stat')), await page.textContent('#vlt-stat'));
await page.click('#vlt-lock'); await page.waitForTimeout(200);
await page.fill('#vlt-pass', kp); await page.click('#vlt-unlock'); await page.waitForTimeout(2500);
t('the old keypass no longer opens it', await page.locator('#vlt-locked').isVisible());
kp = newPass;
await page.fill('#vlt-pass', kp); await page.click('#vlt-unlock'); await page.waitForTimeout(2500);
t('the new keypass does', await page.locator('#vlt-open').isVisible());

console.log('\n── import never replaces this vault without a copy ──');
await page.click('#vlt-lock'); await page.waitForTimeout(200);
let chooserOpened = false;
const onChooser = () => { chooserOpened = true; };
page.on('filechooser', onChooser);
await page.click('#vlt-importbtn2');
await page.waitForTimeout(400);
page.off('filechooser', onChooser);
t('with a vault here, import first offers to save it (no file picker yet)',
  !chooserOpened && await page.locator('#vlt-stat button', { hasText: 'save this vault first' }).isVisible());
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#vlt-stat button:has-text("save this vault first")')]);
const savedPath = await dl.path();
const savedEnv = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
t('the vault here is saved as a file first', savedEnv.magic === 'BNRVAULT' && Array.isArray(savedEnv.slots));
const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#vlt-stat button:has-text("choose the vault file")')]);
page.once('dialog', d => d.dismiss());
await fc.setFiles(savedPath);
await page.waitForTimeout(700);
t('declining the replace changes nothing',
  await page.locator('#vlt-locked').isVisible() && /nothing changed/.test(await page.textContent('#vlt-stat')) && !(await page.locator('#vlt-ask').isVisible()));
await page.click('#vlt-importbtn2'); await page.waitForTimeout(200);
const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#vlt-stat button:has-text("save this vault first")')]);
const saved2 = await dl2.path();
const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#vlt-stat button:has-text("choose the vault file")')]);
let confirmText = '';
page.once('dialog', d => { confirmText = d.message(); d.accept(); });
await fc2.setFiles(saved2);
await page.waitForTimeout(700);
t('the replace is confirmed, naming the copy just saved',
  /replaces the vault on this browser/.test(confirmText) && /saved as bnr-vault-/.test(confirmText), confirmText.slice(0, 120));
t('the file keypass is asked in the page, hidden as typed', await page.locator('#vlt-ask').isVisible() && (await page.getAttribute('#vlt-ask-in', 'type')) === 'password');
await page.fill('#vlt-ask-in', kp);
await page.click('#vlt-ask-go');
await page.waitForTimeout(2500);
t('the file opened with its keypass, every secret in it', await page.locator('#vlt-open').isVisible() && (await page.locator('#vlt-list .chip').count()) === 2,
  await page.textContent('#vlt-stat'));

console.log('\n── add this device as a passkey slot ──');
if (hasPrf) {
  // Two dialogs in sequence: the label prompt, then the "no passkey on this device —
  // create one?" confirm, because the virtual authenticator starts with no credential.
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Test laptop' : ''));
  await page.click('#vlt-addpk');
  await page.waitForTimeout(4000);
  const slots = await page.locator('#vlt-devices .chip').count();
  t('a second slot appeared', slots === 2, 'slots=' + slots + ' stat=' + await page.textContent('#vlt-stat'));
  t('named from the prompt', /Test laptop/.test(await page.textContent('#vlt-devices')));
  // the vault's passkey is marked as not a soul, so the keychain picker refuses it and nothing opens
  const vcreds = (await cdp.send('WebAuthn.getCredentials', { authenticatorId: authId })).credentials;
  t('the vault\'s new passkey carries the vault mark in its user handle',
    vcreds.length === 1 && Buffer.from(vcreds[0].userHandle || '', 'base64').subarray(0, 8).toString() === 'bnrvlt01', JSON.stringify(vcreds.map(c => c.userHandle)));
  await page.evaluate(() => document.getElementById('kc-pass').click());
  await page.waitForFunction(() => /nothing opened|did not open|cannot/.test(document.getElementById('kc-stat').textContent), null, { timeout: 15000 }).catch(() => {});
  const kcv = await page.evaluate(() => ({ stat: document.getElementById('kc-stat').textContent, cards: document.getElementById('kc-cards').style.display }));
  t('the keychain picker refuses the vault\'s passkey: no soul is read from it',
    /opens your vault or your account and is not your bzDiD itself/.test(kcv.stat) && kcv.cards === 'none', kcv.stat);

  console.log('\n── unlock with the passkey alone ──');
  await page.click('#vlt-lock'); await page.waitForTimeout(300);
  await page.click('#vlt-pkunlock');
  await page.waitForTimeout(3000);
  t('passkey opened the vault', await page.locator('#vlt-open').isVisible(),
    await page.textContent('#vlt-stat'));
  t('same two entries', (await page.locator('#vlt-list .chip').count()) === 2);

  console.log('\n── revoke ──');
  const before = await page.locator('#vlt-devices .chip').count();
  const revokeBtn = page.locator('#vlt-devices button[data-revoke]').first();
  const canRevoke = (await page.locator('#vlt-open').isVisible())
    && (await revokeBtn.count()) > 0 && (await revokeBtn.isVisible());
  if (canRevoke) {
    await revokeBtn.click();
    await page.waitForTimeout(800);
    t('a slot was revoked', (await page.locator('#vlt-devices .chip').count()) === before - 1);
    // only the passkey is left: a file of this vault could be opened nowhere, so none is written
    let dlNow = false;
    const onDl = () => { dlNow = true; };
    page.on('download', onDl);
    await page.click('#vlt-export');
    await page.waitForTimeout(500);
    page.off('download', onDl);
    t('a passkey-only vault is not saved as a file nothing could open; it offers add a keypass',
      !dlNow && await page.locator('#vlt-stat button', { hasText: 'add a keypass' }).isVisible(), await page.textContent('#vlt-stat'));
  } else {
    t('a slot was revoked', false, 'vault not open, or no revocable slot — an earlier step failed');
  }
} else {
  console.log('  (skipped — this Chromium build has no PRF virtual authenticator)');
}

console.log('\n── seal my recovery words: only the soul the keychain holds ──');
await page.evaluate(() => {
  window.__credGets = 0;
  const g = navigator.credentials.get.bind(navigator.credentials);
  navigator.credentials.get = (...a) => { window.__credGets++; return g(...a); };
});
const chips0 = await page.locator('#vlt-list .chip').count();
await page.click('#vlt-sealbzdid');
await page.waitForTimeout(400);
t('with no keychain connected, nothing is sealed and the line names the keychain',
  (await page.locator('#vlt-list .chip').count()) === chips0 && await page.evaluate(() => !!document.querySelector('#vlt-stat a[href="#kc-sec"]')));
// connect the keychain from a fixed TEST soul's recovery words (a throwaway vector, never a real key)
const soulPhrase = await page.evaluate(() => BZDIDKEY.deriveIdentity(new Uint8Array(32).fill(0x2a), 'bnr.b').phrase);
await page.evaluate(p => { document.getElementById('kc-rec').value = p; document.getElementById('kc-recgo').click(); }, soulPhrase);
await page.waitForTimeout(500);
const kcFp = ((await page.textContent('#kc-soul-fp')) || '').trim();
await page.click('#vlt-sealbzdid');
await page.waitForTimeout(800);
const sealed = await page.evaluate(() => {
  const V = window.BNRVAULT;
  return V.list().filter(x => x.type === 'bzdid').map(x => ({ fp: x.meta.fingerprint, words: x.meta.words, secret: V.reveal(x.id).secret }));
});
t('sealed the recovery words of the soul the keychain holds, with no passkey ceremony of its own',
  sealed.length === 1 && sealed[0].secret === soulPhrase && kcFp.length > 0 && sealed[0].fp === kcFp && await page.evaluate(() => window.__credGets === 0),
  JSON.stringify(sealed.map(s => s.fp)) + ' vs ' + kcFp);
t('its word count is counted on whitespace', sealed.length === 1 && sealed[0].words === soulPhrase.trim().split(/\s+/).length);
await page.click('#vlt-sealbzdid');
await page.waitForTimeout(500);
t('pressing again seals no second copy',
  await page.evaluate(() => window.BNRVAULT.list().filter(x => x.type === 'bzdid').length) === 1 && /already sealed/.test(await page.textContent('#vlt-stat')));
await page.evaluate(() => document.getElementById('kc-out').click());

console.log('\n── the create-passkey fix ──');
// The reported bug: pointerdown auto-connect fired a credentials.get() first, so
// credentials.create() was refused as a second pending request and the page said
// "no passkey found — create one". The guard must now exclude #kc-create.
const guarded = await page.evaluate(() => {
  const el = document.getElementById('kc-create');
  return !!(el && el.closest('#kc-rec,#kc-recgo,#kc-create,#kc-out,#br-wif,#br-go,#vault-sec'));
});
t('#kc-create is inside the auto-connect hands-off set', guarded);
t('vault section is inside it too', await page.evaluate(() =>
  !!document.getElementById('vlt-secret').closest('#kc-rec,#kc-recgo,#kc-create,#kc-out,#br-wif,#br-go,#vault-sec')));

console.log('\n── paste-secret demoted to scaffold · recovery ──');
t('kc-rec scaffold present', await page.locator('#kc-rec-scaffold').count().then(n => n === 1));
t('kc-rec summary names scaffold · recovery', await page.locator('#kc-rec-scaffold summary').innerText().then(x => /scaffold|recovery/i.test(x)));
t('vlt-secret scaffold present', await page.locator('#vlt-secret-scaffold').count().then(n => n === 1));
t('vlt-secret summary names scaffold · recovery', await page.locator('#vlt-secret-scaffold summary').innerText().then(x => /scaffold|recovery/i.test(x)));
t('br-wif scaffold present', await page.locator('#br-wif-scaffold').count().then(n => n === 1));
t('seed option reads as recovery words', await page.locator('#vlt-type option[value="seed"]').textContent().then(x => /recovery words/i.test(x)));
t('vaulta option reads as a Vaulta key', await page.locator('#vlt-type option[value="vaulta"]').textContent().then(x => /Vaulta key/.test(x)));
t('arweave option reads as an Arweave key file', await page.locator('#vlt-type option[value="arweave"]').textContent().then(x => /Arweave key file/.test(x)));
t('the scaffold tags stay, for cypherpunk (seed and key: recovery; JWK: advanced)',
  await page.locator('#vlt-scaffold-law').textContent().then(x => /scaffold · recovery/.test(x) && /scaffold · advanced/.test(x)));
t('arw-jwk-scaffold still demoted', await page.locator('#arw-jwk-scaffold').count().then(n => n === 1));
t('primary keychain CTA is passkey connect (not paste)', await page.locator('#kc-pass').isVisible());
t('paste fields remain in DOM (recovery capability kept)', await page.locator('#kc-rec,#vlt-secret,#br-wif').count().then(n => n === 3));

console.log('\n── no runtime noise ──');
const realErrors = consoleErrors.filter(e =>
  !/favicon|net::ERR|Failed to load resource|tokens\.css|bnr-keys|wasm/i.test(e));
t('no unexpected page errors', pageErrors.length === 0, pageErrors.join(' | '));
t('no unexpected console errors', realErrors.length === 0, realErrors.slice(0,3).join(' | '));

console.log('\n────────────────────────────────');
console.log(`${pass} passed, ${fail} failed`);
if (failures.length) { console.log('\nfailures:'); failures.forEach(f => console.log('  · ' + f)); }

await browser.close();
srv.close();
process.exit(fail ? 1 : 0);
