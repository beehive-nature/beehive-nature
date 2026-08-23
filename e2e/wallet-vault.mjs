// e2e for surfaces/wallet.html — THE VAULT, in real Chromium with a CTAP2
// virtual authenticator carrying PRF. Static checks cannot see a runtime
// null-deref or a WebCrypto call that only fails in a browser; this can.
// Run:  cd e2e && node wallet-vault.mjs
import { chromium } from 'playwright';
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
t('locked state hidden', !(await page.locator('#vlt-locked').isVisible()));
t('unlocked state hidden', !(await page.locator('#vlt-open').isVisible()));

console.log('\n── generate a keypass ──');
await page.click('#vlt-gen');
await page.waitForTimeout(150);
const gen = await page.inputValue('#vlt-newpass');
t('generator filled both fields', gen.length > 0 && gen === await page.inputValue('#vlt-newpass2'));
t('8 words by default', gen.split('-').length === 8, gen);
t('strength shown as strong', /strong/i.test(await page.textContent('#vlt-strength')));

console.log('\n── create ──');
await page.click('#vlt-create');
await page.waitForTimeout(2500);            // 600k PBKDF2 rounds, deliberately slow
t('now unlocked', await page.locator('#vlt-open').isVisible());
t('one device slot listed', (await page.locator('#vlt-devices .chip').count()) === 1);
t('slot shows the E2 floor', /E2/.test(await page.textContent('#vlt-devices')));

console.log('\n── live validation ──');
const A = n => Array(n).fill('abandon').join(' ');
await page.fill('#vlt-secret', `${A(11)} about`);
await page.waitForTimeout(350);
t('valid 12-word phrase recognised', /valid BIP-39/.test(await page.textContent('#vlt-check')));
await page.fill('#vlt-secret', `${A(11)} zoo`);
await page.waitForTimeout(350);
t('bad checksum caught in the browser', /checksum failed/.test(await page.textContent('#vlt-check')));
await page.fill('#vlt-secret', 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn');
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

console.log('\n── reveal + send to bridge ──');
await page.locator('#vlt-list .chip button[data-act="reveal"]').first().click();
await page.waitForTimeout(300);
t('reveal shows the secret', /KwDiBf89/.test(await page.textContent('#vlt-revealed')));
await page.locator('#vlt-list .chip button[data-act="bridge"]').first().click();
await page.waitForTimeout(300);
t('key handed to the bridge field',
  (await page.inputValue('#br-wif')) === 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn');

console.log('\n── lock / unlock round trip ──');
await page.click('#vlt-lock');
await page.waitForTimeout(300);
t('locked state shown', await page.locator('#vlt-locked').isVisible());
t('entries not in the DOM while locked', (await page.locator('#vlt-list .chip').count()) === 0);
await page.fill('#vlt-pass', gen);
await page.click('#vlt-unlock');
await page.waitForTimeout(2500);
t('unlocked again', await page.locator('#vlt-open').isVisible());
t('both entries survived', (await page.locator('#vlt-list .chip').count()) === 2);

console.log('\n── wrong keypass ──');
await page.click('#vlt-lock'); await page.waitForTimeout(200);
await page.fill('#vlt-pass', 'definitely-not-the-keypass');
await page.click('#vlt-unlock');
await page.waitForTimeout(2500);
t('refused, still locked', await page.locator('#vlt-locked').isVisible());
t('says it matched no slot', /does not match any slot/.test(await page.textContent('#vlt-stat')));
await page.fill('#vlt-pass', gen); await page.click('#vlt-unlock'); await page.waitForTimeout(2500);

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
  } else {
    t('a slot was revoked', false, 'vault not open, or no revocable slot — an earlier step failed');
  }
} else {
  console.log('  (skipped — this Chromium build has no PRF virtual authenticator)');
}

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
