// TESTNET-ONLY: serverless, default-deny, throwaway identity; no live payment endpoints.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installWalletFixture} from '../../e2e/lib/wallet-source-fixture.mjs';
const browser=await chromium.launch();
try{
 await installWalletFixture(browser,process.cwd());
 const context=await browser.newContext();
 await context.route('**/onboarding/vendor/bnr-keys.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BNRKEYS=Promise.resolve(null);'}));
 await context.addInitScript(()=>{localStorage.setItem('bnr_soul','gatesoul');localStorage.setItem('bregister','cypherpunk');localStorage.setItem('bpay-policy-v1',JSON.stringify({audience:'public'}));});
 const page=await context.newPage();await page.goto('https://skaists.dev/surfaces/wallet.html');
 await page.waitForFunction(()=>window.BNRPAY&&window.BZDIDKEY&&window.AntPay&&window.BnrSign);
 await page.evaluate(()=>{const code=BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(42));document.getElementById('kc-rec-scaffold').open=true;document.getElementById('kc-rec').value=code;document.getElementById('kc-recgo').click();});
 await page.waitForFunction(()=>/keychain live/.test(document.getElementById('kc-stat').textContent));
 const result=await page.evaluate(async()=>{const signer=BNRPAY.antStorageSigner(),out={core:BNRPAY.coreArmed()};try{await signer.address();}catch(e){out.addressError=e.message;}try{await signer.signTransaction({},{});}catch(e){out.signError=e.message;}return out;});
 assert.equal(result.core,false);assert.match(result.addressError,/first-party signing core is not ready/);assert.match(result.signError,/first-party signing core is not ready/);
 console.log('PASS: connected bzDiD + unavailable Rust core refuses native storage identity/signing; no JavaScript or extension fallback.');
}finally{await browser.close();}

