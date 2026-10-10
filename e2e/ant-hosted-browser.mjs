// Serverless production-origin fixture. All chain, wallet and storage data are simulated.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installWalletFixture} from './lib/wallet-source-fixture.mjs';
const browser=await chromium.launch();
async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('condition timed out');}
await installWalletFixture(browser,process.cwd());
const bytes=Buffer.from('Agent 20 browser purchase fixture; never live funds.');
const sdk=`const bytes=new TextEncoder().encode(${JSON.stringify(bytes.toString())});
export async function getNetworkDefaults(){return {payment:{chainId:42161,paymentTokenAddress:'0x'+'a'.repeat(40),paymentVaultAddress:'0x'+'b'.repeat(40)},rpcUrl:'https://fixture.invalid/rpc'};}
export class AutonomiClient{static async connect(){return new AutonomiClient();}closed=false;close(){}async upload(file,opts){await opts.onCheckpoint({fixture:true});const n=(await getNetworkDefaults()).payment;await opts.payment.pay(n,[{quoteHash:'0x'+'c'.repeat(64),rewardsAddress:'0x'+'d'.repeat(40),amount:'100'}],{signal:opts.signal});return {file:{address:'fixture-only'},storageCostAtto:'100'};}async download(){return {bytes};}}`;
try{
 for(const reg of ['bee','raver','cypherpunk']){
  const context=await browser.newContext({viewport:{width:390,height:900}});
  await context.route('**/vendor/ant-browser-sdk/0.1.1/index.js',r=>r.fulfill({body:sdk,contentType:'text/javascript'}));
  await context.addInitScript(reg=>{
   localStorage.setItem('bregister',reg);localStorage.setItem('bpay-policy-v1',JSON.stringify({audience:'public'}));window.__sends=0;window.__txs={};window.ethereum={request:async({method,params})=>{
    if(method==='eth_chainId')return '0xa4b1';if(method==='eth_requestAccounts'||method==='eth_accounts')return ['0x'+'e'.repeat(40)];
    if(method==='eth_sendTransaction'){const hash='0x'+String(++window.__sends).repeat(64);window.__txs[hash]={...params[0],input:params[0].data,hash};return hash;}throw Error(method);
   }};
  },reg);
  let page=await context.newPage();
  await context.route('https://fixture.invalid/rpc',async route=>{
   const {method,params:p}=route.request().postDataJSON();let result;
   if(method==='eth_chainId')result='0xa4b1';
   else if(method==='eth_call')result=p[0].data.startsWith('0xdd62ed3e')?'0x0':'0xffff';
   else if(method==='eth_getBalance')result='0xffffffffff';
   else if(method==='eth_gasPrice')result='0x2';
   else if(method==='eth_estimateGas')result='0xc350';
   else if(method==='eth_getTransactionCount')result='0x'+(await page.evaluate(()=>window.__sends)).toString(16);
   else if(method==='eth_blockNumber')result='0x65';
   else if(method==='eth_getBlockByNumber')result={hash:'0x'+'f'.repeat(64),transactions:await page.evaluate(()=>Object.values(window.__txs))};
   else if(method==='eth_getTransactionByHash')result=await page.evaluate(h=>window.__txs[h],p[0]);
   else if(method==='eth_getTransactionReceipt')result={transactionHash:p[0],blockNumber:'0x64',blockHash:'0x'+'f'.repeat(64),status:'0x1',gasUsed:'0xc350',effectiveGasPrice:'0x2'};
   else throw Error(method);
   await route.fulfill({json:{jsonrpc:'2.0',id:1,result}});
  });
  await page.goto('https://skaists.dev/surfaces/wallet.html');
  await page.locator('[data-wallet-store]').click();await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
  if(!await page.locator('#ant-purchase').count())await page.locator('[data-audience="public"]').click();
  await page.locator('#ant-purchase summary').first().click();
  await page.locator('#ant-buy-file').setInputFiles({name:'fixture.txt',mimeType:'text/plain',buffer:bytes});await page.locator('#ant-buy-gas').fill('0.00000000002');
  await page.locator('#ant-buy-start').click();await page.getByRole('button',{name:'Authorize this invoice and ask my wallet'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__sends),0);
  await page.locator('#ant-buy-stop').click();await until(()=>page.locator('#ant-buy-start').isEnabled());assert.equal(await page.evaluate(()=>window.__sends),0);
  await page.locator('#ant-buy-start').click();await page.getByRole('button',{name:'Authorize this invoice and ask my wallet'}).click();
  await until(async()=>{const text=await page.locator('#ant-buy-status').innerText();if(text.startsWith('Storage stopped:'))throw Error(text);return text.startsWith('Stored and retrieved:');});
  assert.equal(await page.evaluate(()=>window.__sends),2);
  const receipt=JSON.parse(await page.locator('#ant-buy-receipt').innerText());assert.equal(receipt.retrievedBytes,bytes.length);assert.equal(receipt.transactions.length,2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#ant-buy-start').click();await until(()=>page.locator('#ant-buy-start').isEnabled());assert.equal(await page.evaluate(()=>window.__sends),2);
  console.log('PASS '+reg+': explicit authorization, cancellation, two bounded sends, retrieved hash, retry without duplicate, 390px layout');
  await context.close();
 }
}catch(e){console.error(e);throw e;}finally{await browser.close();}
