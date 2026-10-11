// Production-origin SOURCE fixture. Network denied; passkeys are synthetic. No live wallet or funds.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {installWalletFixture} from './lib/wallet-source-fixture.mjs';
const browser=await chromium.launch();
await installWalletFixture(browser,process.cwd());
await mkdir('tools/agent20-ux-shots',{recursive:true});
const results=[];
try {
  for(const width of [320,390,1280]) for(const reg of ['bee','raver','cypherpunk']) {
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(reg=>{
      localStorage.setItem('bregister',reg);
      localStorage.setItem('bpay-policy-v1',JSON.stringify({audience:'public'}));
      window.__passkeyGets=0;
      if(window.PublicKeyCredential)PublicKeyCredential.getClientCapabilities=async()=>({'extension:prf':true});
      navigator.credentials.get=async()=>{window.__passkeyGets++;return {id:'Zml4dHVyZQ',type:'public-key',response:{userHandle:null},getClientExtensionResults:()=>({prf:{results:{first:new Uint8Array(32).fill(7).buffer}}})};}; // TESTNET-ONLY synthetic PRF
      navigator.credentials.create=async()=>{throw Error('This test must never create an identity');};
    },reg);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('https://skaists.dev/surfaces/wallet.html#bpay-sec');
    await page.waitForFunction(()=>window.BNRPAY&&BNRPAY.coreArmed()&&document.getElementById('ant-buy-start'));
    assert.equal(await page.locator('#ant-purchase').getAttribute('open'),'');
    assert.equal(await page.locator('#ant-buy-start').isEnabled(),false);
    const probe=Buffer.from('Agent 20 non-spending live quote probe 2026-10-10');
    assert.equal(probe.length,49);
    await page.locator('#ant-buy-file').setInputFiles({name:'probe.txt',mimeType:'text/plain',buffer:probe});
    await page.locator('#ant-buy-gas').fill('0.0002');
    await page.locator('#ant-purchase').screenshot({path:`tools/agent20-ux-shots/${reg}-${width}-prepare.png`});
    await page.locator('#ant-connect').click();
    assert.equal(await page.locator('#kc-create').isVisible(),false);
    assert.equal(await page.locator('#kc-pass').isVisible(),true);
    await page.locator('#kc-pass').click();
    await page.waitForFunction(()=>document.querySelector('[data-kc-step="confirm"][aria-current]'));
    assert.equal(await page.locator('#kc-stat details').getAttribute('open'),null);
    assert.equal(await page.evaluate(()=>BNRPAY.antStorageState().connected),false);
    await page.locator('.kc-entry').screenshot({path:`tools/agent20-ux-shots/${reg}-${width}-confirm.png`});
    await page.getByRole('button',{name:'yes, open it',exact:true}).click();
    await page.waitForFunction(()=>BNRPAY.antStorageState().connected);
    assert.equal(await page.evaluate(()=>window.__passkeyGets),1);
    await page.locator('#kc-return a').click();
    assert.equal(await page.locator('#ant-buy-file').evaluate(e=>e.files[0].size),49);
    assert.equal(await page.locator('#ant-buy-gas').inputValue(),'0.0002');
    assert.equal(await page.locator('#ant-buy-start').isEnabled(),false,'Missing .b name is distinct from locked keychain');
    assert.equal(await page.locator('#ant-connect').getAttribute('href'),'#connect-sec');
    await page.locator('#ant-connect').click();
    await page.locator('#wq').fill('gatesoul');
    await page.locator('#wgo').click();
    await page.waitForFunction(()=>BNRPAY.antStorageState().hasName);
    // Use ordinary same-page navigation, preserving the selected file and sign-in.
    await page.evaluate(()=>{location.hash='bpay-sec';});
    await page.waitForFunction(()=>!document.getElementById('ant-buy-start').disabled);
    for(const other of ['bee','raver','cypherpunk']){
      await page.locator('#breg-'+other).click();
      assert.equal(await page.locator('#ant-buy-file').evaluate(e=>e.files[0].size),49);
      assert.equal(await page.locator('#ant-buy-gas').inputValue(),'0.0002');
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false,`${reg}/${width} must fit the viewport`);
    assert.deepEqual(errors,[]);
    results.push({reg,width,pass:true});console.log(`PASS ${reg} ${width}: explicit identity, return path, name readiness, retained file/ceiling, no overflow`);
    await context.close();
  }
} finally {await browser.close();}
console.log(JSON.stringify({sourceFixture:true,liveFunds:false,results}));
