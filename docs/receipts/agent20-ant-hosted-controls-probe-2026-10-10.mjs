import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
const out={at:new Date().toISOString(),url:'https://skaists.dev/surfaces/wallet.html',kind:'live-hosted-controls-no-payment',fundsSpent:false,registers:[]};
try{
 for(const reg of ['bee','raver','cypherpunk']){
  const context=await browser.newContext({viewport:{width:390,height:900}});
  await context.addInitScript(reg=>{localStorage.setItem('bregister',reg);localStorage.setItem('bpay-policy-v1',JSON.stringify({audience:'public'}));},reg);
  const page=await context.newPage();
  await page.goto(out.url,{waitUntil:'domcontentloaded'});
  await page.locator('[data-wallet-store]').click();
  await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
  if(!await page.locator('#ant-purchase').count())await page.locator('[data-audience="public"]').click();
  await page.locator('#ant-purchase summary').first().click();
  assert.equal(await page.locator('#ant-buy-gas').inputValue(),'');
  await page.locator('#ant-buy-start').click();
  const missingFile=await page.locator('#ant-buy-status').innerText();
  assert.match(missingFile,/Choose a public file/);
  await page.locator('#ant-buy-file').setInputFiles({name:'agent20-control-probe.txt',mimeType:'text/plain',buffer:Buffer.from('Non-spending controls probe')});
  await page.locator('#ant-buy-start').click();
  const missingGas=await page.locator('#ant-buy-status').innerText();
  assert.match(missingGas,/Enter a separate ETH fee limit/);
  assert.equal(await page.locator('#ant-buy-invoice').innerText(),'');
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  assert.equal(horizontalOverflow,false);
  await page.locator('#ant-purchase').evaluate(el=>{el.scrollIntoView({block:'start'});window.scrollBy(0,-130);});
  await page.screenshot({path:'tools/agent20-hosted-'+reg+'.png'});
  out.registers.push({register:reg,purchaseVisible:true,gasDefault:'',missingFile,missingGas,invoicePrepared:false,horizontalOverflow});
  await context.close();
 }
 out.passed=true;
}catch(e){out.passed=false;out.error=e.message;process.exitCode=1;}
finally{await browser.close();await writeFile('tools/agent20-hosted-controls.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));}
