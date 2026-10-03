// Wallet source acceptance without a listener, localhost, or live services.
// Tests explicitly register mocked chain routes after this default-deny fixture.
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
export const WALLET_ORIGIN='https://skaists.dev';
export async function installWalletFixture(browser,root){
  root=resolve(root);
  const html=await readFile(resolve(root,'surfaces/wallet.html'),'utf8'),cache=new Map();
  const create=browser.newContext.bind(browser);
  browser.newContext=async function(options){
    const context=await create({...options,serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==WALLET_ORIGIN)return route.abort();
      let path=decodeURIComponent(url.pathname);
      if(!/^\/(surfaces|docs|wasm|forge)\//.test(path))path='/surfaces'+path;
      const file=resolve(root,'.'+path);
      if(!file.startsWith(root+sep))return route.abort();
      try{
        if(!cache.has(file))cache.set(file,path==='/surfaces/wallet.html'?html:await readFile(file));
        return route.fulfill({body:cache.get(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'})[extname(file)]||'application/octet-stream'});
      }catch{return route.fulfill({status:404,body:'source fixture not found'});}
    });
    return context;
  };
  return html;
}
