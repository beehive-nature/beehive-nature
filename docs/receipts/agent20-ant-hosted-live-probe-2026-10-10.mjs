import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:900}});
const out={at:new Date().toISOString(),url:'https://skaists.dev/surfaces/wallet.html',kind:'live-keyless-quote-only',timeoutSeconds:300,paymentAuthorized:false,fundsSpent:false};
try{
 await page.goto(out.url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('[data-wallet-store]').click();await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
 if(!await page.locator('#ant-quote-file').count())await page.locator('[data-audience="public"]').click();
 out.purchasePanel=await page.locator('#ant-purchase').count()>0;
 await page.locator('#ant-quote-file').setInputFiles({name:'agent20-public-probe.txt',mimeType:'text/plain',buffer:Buffer.from('Agent 20 non-spending live quote probe 2026-10-10')});
 await page.locator('#ant-quote-go').click();
 const until=Date.now()+300000;
 while(Date.now()<until){const state=await page.evaluate(()=>({text:document.getElementById('ant-quote-status').innerText,done:!document.getElementById('ant-quote-go').disabled}));if(state.text!==out.quoteStatus)console.log(state.text);out.quoteStatus=state.text;if(state.done)break;await new Promise(r=>setTimeout(r,1000));}
 if(!await page.locator('#ant-quote-go').isEnabled()){out.timedOut=true;await page.locator('#ant-quote-cancel').click();}
 out.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
}catch(e){out.error=e.message;}
finally{await browser.close();await writeFile(process.argv[2]||'tools/agent20-live-quote.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));}
