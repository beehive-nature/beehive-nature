// Serverless production-origin fixture. All chain, wallet and storage data are simulated.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installWalletFixture} from './lib/wallet-source-fixture.mjs';
function rlpDecode(buf) {
  let i = 0;
  function item() {
    const b = buf[i];
    if (b <= 0x7f) { i += 1; return buf.slice(i - 1, i) }
    if (b <= 0xb7) { const l = b - 0x80; i += 1 + l; return buf.slice(i - l, i) }
    if (b <= 0xbf) { const ll = b - 0xb7; const l = num(buf.slice(i + 1, i + 1 + ll)); i += 1 + ll + l; return buf.slice(i - l, i) }
    if (b <= 0xf7) { const l = b - 0xc0; const end = i + 1 + l; i += 1; const out = []; while (i < end) out.push(item()); return out }
    const ll = b - 0xf7; const l = num(buf.slice(i + 1, i + 1 + ll)); const end = i + 1 + ll + l; i += 1 + ll;
    const out = []; while (i < end) out.push(item()); return out;
  }
  const num = b => { let n = 0; for (const x of b) n = n * 256 + x; return n };
  return item();
}
const big = b => (b.length ? BigInt('0x' + Buffer.from(b).toString('hex')) : 0n);
const hexOf = b => Buffer.from(b).toString('hex');

const browser=await chromium.launch();
async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('condition timed out');}
await installWalletFixture(browser,process.cwd());
const bytes=Buffer.from('Agent 20 browser purchase fixture; never live funds.');
const sdk=`const bytes=new TextEncoder().encode(${JSON.stringify(bytes.toString())});
export async function getNetworkDefaults(){return {payment:{chainId:42161,paymentTokenAddress:'0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684',paymentVaultAddress:'0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26'},rpcUrl:'https://fixture.invalid/rpc'};}
export class AutonomiClient{static async connect(){return new AutonomiClient();}closed=false;close(){}async upload(file,opts){await opts.onCheckpoint({fixture:true});const n=(await getNetworkDefaults()).payment;await opts.payment.pay(n,[{quoteHash:'0x'+'c'.repeat(64),rewardsAddress:'0x'+'d'.repeat(40),amount:'100'}],{signal:opts.signal});return {file:{address:'fixture-only'},storageCostAtto:'100'};}async download(){return {bytes};}}`;
try{
 for(const width of [320,390]) for(const reg of ['bee','raver','cypherpunk']){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.route('**/vendor/ant-browser-sdk/0.1.1/index.js',r=>r.fulfill({body:sdk,contentType:'text/javascript'}));
  await context.addInitScript(reg=>{
   localStorage.setItem('bregister',reg);localStorage.setItem('bnr_soul','gatesoul');localStorage.setItem('bpay-policy-v1',JSON.stringify({audience:'public'}));window.__sends=0;window.__txs={};
   window.ethereum={request:async()=>{throw Error('Native bzDiD storage must never request an extension wallet');}};
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
   else if(method==='eth_sendRawTransaction') {
    const envelope=Buffer.from(p[0].slice(2),'hex');assert.equal(envelope[0],2);
    const fields=rlpDecode(envelope.subarray(1));assert.equal(fields.length,12);
    assert.equal(big(fields[0]),42161n);assert.equal(big(fields[2]),0n);assert.equal(big(fields[6]),0n);assert.deepEqual(fields[8],[]);
    assert.ok(big(fields[9])<=1n);assert.equal(big(fields[3]),4n);
    const decoded={nonce:'0x'+big(fields[1]).toString(16),to:'0x'+hexOf(fields[5]),data:'0x'+hexOf(fields[7]),gas:'0x'+big(fields[4]).toString(16)};
    const signature=Buffer.concat([Buffer.from(fields[10]).length<32?Buffer.alloc(32-fields[10].length):Buffer.alloc(0),fields[10],Buffer.from(fields[11]).length<32?Buffer.alloc(32-fields[11].length):Buffer.alloc(0),fields[11]]).toString('hex');
    assert.ok(await page.evaluate(({sig,parity,decoded})=>{
      const hex=h=>new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));
      const r=BNRPAY.rlp([42161n,BigInt(decoded.nonce),0n,4n,BigInt(decoded.gas),hex(decoded.to.slice(2)),0n,hex(decoded.data.slice(2)),[]]);
      const typed=new Uint8Array(r.length+1);typed[0]=2;typed.set(r,1);
      const digest=BnrSign.keccak_256(typed),compact=hex(sig);
      const key=BZDIDKEY.deriveK1Key(new Uint8Array(32).fill(42),'evm:gatesoul');
      try{
        const pub=BnrSign.secp.getPublicKey(key.seed,true);
        return BnrSign.secp.verify(compact,digest,pub)&&String(BnrSign.secp.Signature.fromCompact(compact).addRecoveryBit(parity).recoverPublicKey(digest).toRawBytes(true))===String(pub);
      }finally{key.seed.fill(0);}
    },{sig:signature,parity:Number(big(fields[9])),decoded}),'Rust signature verifies in the independent vendored verifier and recovers the expected bzDiD public key');
    result=await page.evaluate(raw=>{
     const ledgers=Object.keys(localStorage).filter(k=>k.startsWith('bnr.ant.purchase.v1:')).map(k=>JSON.parse(localStorage.getItem(k)));
     const plan=ledgers.flatMap(l=>l.plans).find(p=>p.txs.some(t=>t.raw===raw));
     const tx=plan&&plan.txs.find(t=>t.raw===raw);
     if(!tx||!tx.hash||tx.state!=='sending')throw Error('Raw bytes and hash were not durable BEFORE broadcast');
     const bytes=new Uint8Array(raw.slice(2).match(/../g).map(h=>parseInt(h,16)));
     const hash='0x'+Array.from(BnrSign.keccak_256(bytes),b=>b.toString(16).padStart(2,'0')).join('');
     if(hash!==tx.hash)throw Error('Stored hash does not match native signed envelope');
     window.__sends++;window.__txs[hash]={...tx,from:plan.payer,input:tx.data,value:'0x0',chainId:'0xa4b1'};
     return hash;
    },p[0]);
   }
   else if(method==='eth_getTransactionReceipt')result={transactionHash:p[0],blockNumber:'0x64',blockHash:'0x'+'f'.repeat(64),status:'0x1',gasUsed:'0xc350',effectiveGasPrice:'0x2'};
   else throw Error(method);
   await route.fulfill({json:{jsonrpc:'2.0',id:1,result}});
  });
  await page.goto('https://skaists.dev/surfaces/wallet.html');
  await page.waitForFunction(()=>window.BZDIDKEY&&window.BNRPAY&&BNRPAY.coreArmed());
  await page.evaluate(()=>{
    // TESTNET-ONLY: deterministic throwaway fixture identity, never a user's key.
    const code=BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(42));
    document.getElementById('kc-rec-scaffold').open=true;
    document.getElementById('kc-rec').value=code;document.getElementById('kc-recgo').click();
  });
  await page.waitForFunction(()=>/keychain live/.test(document.getElementById('kc-stat').textContent));
  await page.locator('[data-wallet-store]').click();await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
  if(!await page.locator('#ant-purchase').count())await page.locator('[data-audience="public"]').click();
  if(!await page.locator('#ant-purchase').evaluate(el=>el.open))await page.locator('#ant-purchase summary').first().click();
  await page.locator('#ant-buy-file').setInputFiles({name:'fixture.txt',mimeType:'text/plain',buffer:bytes});await page.locator('#ant-buy-gas').fill('0.00000000002');
  await page.locator('#ant-buy-start').click();await page.getByRole('button',{name:'Authorize this invoice and ask my wallet'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__sends),0);
  assert.equal(await page.locator('#ant-invoice-total').innerText(),'0.0000000000000001 ANT');
  assert.equal(await page.locator('#ant-invoice-eth').innerText(),'0.00000000002 ETH');
  if(reg==='bee'){
    const refusals=await page.evaluate(()=>{
      const ledger=JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('bnr.ant.purchase.v1:'))));
      const p=ledger.plans[0];p.authorization={invoice:p.id,scope:p.scope,payer:p.payer,artifactSha256:ledger.artifact.sha256,expiresAt:p.expiresAt,gasCeilingWei:p.gasCeilingWei};
      const t=p.txs[0];t.state='sending';t.nonce='0x0';
      const tx={from:p.payer,to:t.to,data:t.data,gas:t.gas,nonce:t.nonce,maxFeePerGas:t.maxFeePerGas,maxPriorityFeePerGas:'0x0',value:'0x0',chainId:'0xa4b1'};
      const bound={artifact:ledger.artifact,network:ledger.network,invoice:p,kind:t.kind},signer=BNRPAY.antStorageSigner();
      const errors=[];
      for(const change of [{value:'0x1'},{chainId:'0x1'},{to:'0x'+'f'.repeat(40)},{data:'0xdead'},{gas:'0xffffff'}]){
        try{signer.signTransaction({...tx,...change},bound);errors.push('SIGNED');}catch{errors.push('refused');}
      }
      // Another vault, or a quote recipient changed after authorization, is refused by the signer itself.
      for(const other of [{...bound,network:{...bound.network,paymentVaultAddress:'0x'+'b'.repeat(40)}},{...bound,invoice:{...p,payments:p.payments.map(q=>({...q,rewards_address:'0x'+'9'.repeat(40)}))}}]){
        try{signer.signTransaction(tx,other);errors.push('SIGNED');}catch{errors.push('refused');}
      }
      localStorage.setItem('bnr-spend-cap',JSON.stringify({ETH:0}));
      try{signer.signTransaction(tx,bound);errors.push('SIGNED');}catch{errors.push('refused');}
      localStorage.removeItem('bnr-spend-cap');return errors;
    });
    assert.deepEqual(refusals,Array(8).fill('refused'));
    // The daily cap holds one reservation per payer nonce: the same nonce re-signed under a
    // second invoice counts once; a different nonce past the cap is refused.
    const reuse=await page.evaluate(()=>{
      const ledger=JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('bnr.ant.purchase.v1:'))));
      const p=ledger.plans[0];p.authorization={invoice:p.id,scope:p.scope,payer:p.payer,artifactSha256:ledger.artifact.sha256,expiresAt:p.expiresAt,gasCeilingWei:p.gasCeilingWei};
      const t=p.txs[0];t.state='sending';t.nonce='0x0';
      const signer=BNRPAY.antStorageSigner(),kept=localStorage.getItem('bnr-cap-ledger');
      localStorage.removeItem('bnr-cap-ledger');localStorage.setItem('bnr-spend-cap',JSON.stringify({ETH:Number(BigInt(t.reservedWei))/1e18}));
      const sign=inv=>{const x=inv.txs[0];try{signer.signTransaction({from:inv.payer,to:x.to,data:x.data,gas:x.gas,nonce:x.nonce,maxFeePerGas:x.maxFeePerGas,maxPriorityFeePerGas:'0x0',value:'0x0',chainId:'0xa4b1'},{artifact:ledger.artifact,network:ledger.network,invoice:inv,kind:x.kind});return 'signed';}catch{return 'refused';}};
      const again=structuredClone(p);again.id='0x'+'1'.repeat(64);again.authorization.invoice=again.id;
      const next=structuredClone(p);next.txs[0].nonce='0x1';
      const out=[sign(p),sign(again),sign(next)];
      localStorage.removeItem('bnr-spend-cap');if(kept===null)localStorage.removeItem('bnr-cap-ledger');else localStorage.setItem('bnr-cap-ledger',kept);
      return out;
    });
    assert.deepEqual(reuse,['signed','signed','refused']);
  }
  await page.locator('#ant-buy-stop').click();await until(()=>page.locator('#ant-buy-start').isEnabled());assert.equal(await page.evaluate(()=>window.__sends),0);
  await page.locator('#ant-buy-start').click();await page.getByRole('button',{name:'Authorize this invoice and ask my wallet'}).click();
  await until(async()=>{const text=await page.locator('#ant-buy-status').innerText();if(text.startsWith('Storage stopped:'))throw Error(text);return text.startsWith('Stored and retrieved:');});
  assert.equal(await page.evaluate(()=>window.__sends),2);
  const receipt=JSON.parse(await page.locator('#ant-buy-receipt').textContent());assert.equal(receipt.retrievedBytes,bytes.length);assert.equal(receipt.transactions.length,2);
  await page.evaluate(()=>document.fonts.ready);
  const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(layout.scroll<=layout.viewport+1,`${reg} at ${width}px overflows: ${JSON.stringify(layout)}`);
  await page.locator('#ant-buy-start').click();await until(()=>page.locator('#ant-buy-start').isEnabled());assert.equal(await page.evaluate(()=>window.__sends),2);
  console.log('PASS '+reg+': explicit authorization, cancellation, two bounded sends, retrieved hash, retry without duplicate, '+width+'px layout');
  await context.close();
 }
}catch(e){console.error(e);throw e;}finally{await browser.close();}
