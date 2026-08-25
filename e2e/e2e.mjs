// e2e for surfaces/onboarding — real Chromium + CTAP2 virtual authenticator WITH PRF.
// Ported 2026-08-19 from the 2026-08-18 sprint pack: Cowork box paths → in-repo
// paths (E2E_ROOT overridable), and BDIDKEY → BZDIDKEY after the bDiD→bzDiD
// rename of the living layer (2f0d886). The surface must sit with its vendored
// engine (bzdid-key.js) — that adjacency is what flips PREVIEW off.
// Run:  cd e2e && npm ci && npx playwright install chromium && node e2e.mjs
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = process.env.E2E_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'surfaces', 'onboarding');
const srv = http.createServer((req,res)=>{
  const f = path.join(root, req.url==='/'?'index.html':req.url.split('?')[0]);
  try{ res.setHeader('content-type', f.endsWith('.js')?'text/javascript':'text/html'); res.end(fs.readFileSync(f)); }
  catch{ res.statusCode=404; res.end('nf'); }
}).listen(8899);

const browser = await chromium.launch({ args:['--no-sandbox'] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('WebAuthn.enable');
let authId = null;
try {
  const r = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol:'ctap2', transport:'internal', hasResidentKey:true, hasUserVerification:true,
    isUserVerified:true, automaticPresenceSimulation:true, hasPrf:true }});
  authId = r.authenticatorId; console.log('virtual authenticator WITH PRF:', authId.slice(0,8));
} catch(e) {
  const r = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol:'ctap2', transport:'internal', hasResidentKey:true, hasUserVerification:true,
    isUserVerified:true, automaticPresenceSimulation:true }});
  authId = r.authenticatorId; console.log('virtual authenticator WITHOUT PRF flag:', e.message.split('\n')[0]);
}

await page.goto('http://localhost:8899/');
let pass = 0, fail = 0;
const t = (name, v, note = '') => { console.log((v ? '  ✓ ' : '  ✗ ') + name + (note ? ' — ' + note : '')); v ? pass++ : fail++; };

t('engine loaded (BZDIDKEY truthy, PREVIEW=false)', await page.evaluate(()=>!!window.BZDIDKEY && !PREVIEW));

// phrase-only door
const r1 = await page.evaluate(()=>{ APP.establishRoot(null);
  return { n:APP._words.length, fp:APP._id.fingerprint.words,
    valid:(()=>{try{BZDIDKEY.decodeRecoveryPhrase(APP._words.join(' '));return true}catch{return false}})() }});
t(`phrase-only root: 24 real BIP39 words (got ${r1.n}, checksum ${r1.valid?'valid':'INVALID'})`, r1.n===24 && r1.valid);

// restore door round-trip through the actual DOM path
const r2 = await page.evaluate(async ()=>{
  const phrase = APP._words.join(' '), fp = APP._id.fingerprint.words;
  APP.go('recover');
  document.getElementById('rec-words').value = phrase;
  APP.tryRecover();
  const msg = document.getElementById('rec-err').textContent;
  return { same: APP._id.fingerprint.words===fp, msg };
});
t(`restore via UI rebuilds same identity — "${r2.msg.slice(0,60)}…"`, r2.same && /Restored/.test(r2.msg));

// wrong phrase refused honestly
const r3 = await page.evaluate(()=>{ APP.go('recover');
  document.getElementById('rec-words').value='abandon '.repeat(23)+'zoo';
  APP.tryRecover(); return document.getElementById('rec-err').textContent; });
t(`bad checksum refused — "${r3.slice(0,50)}…"`, /invalid|checksum/i.test(r3));

// full passkey ceremony (real WebAuthn against virtual authenticator)
const r4 = await page.evaluate(async ()=>{
  APP._root=null; APP._id=null; APP._words=null; APP.ctx.custody='passkey';
  APP.go('passkey');
  const btn=document.querySelector('.btn.primary');
  await APP.doPasskey(btn);
  return { mode:APP.ctx.authMode, door:APP.ctx.rootDoor, hasId:!!APP._id,
    words:APP._words?APP._words.length:0, screen:APP.current };
});
t(`passkey ceremony: authMode=${r4.mode}, door=${r4.door}, ${r4.words} words, → ${r4.screen}`,
  r4.mode==='real' && r4.hasId && r4.words===24 && r4.screen==='recovery');

// PRF determinism: second assertion derives the SAME identity (only if door was passkey+phrase)
if (r4.door==='passkey+phrase') {
  const r5 = await page.evaluate(async ()=>{
    const fp1=APP._id.fingerprint.words;
    const prf=await BZDIDKEY.getPrfSecret();
    const prk=BZDIDKEY.masterPrkFromPrfSecret(prf);
    const fp2=BZDIDKEY.deriveIdentity(prk,'bnr.b').fingerprint.words;
    return { fp1, fp2 };
  });
  t(`PRF determinism: re-assertion → same fingerprint (${r5.fp1})`, r5.fp1===r5.fp2);
} else console.log('  – PRF door not taken (virtual authenticator lacks PRF); fallback rung verified instead');

await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
