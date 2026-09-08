// Real work/collection/controller code at a small DOM boundary. No browser/network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const files = ['docs/mvp-walk/assets/artist-audio/collection.js', 'docs/mvp-walk/assets/first-work/work.js', 'docs/mvp-walk/assets/first-work/receive.js'].map(read);
const tick = () => new Promise(resolve => setImmediate(resolve));
function storage(initial) {
  let text = initial || null;
  return {writes:0, getItem(){return text;}, setItem(_key,value){this.writes++;text=value;}, value(){return text;}};
}
function locks() {
  let tail = Promise.resolve();
  return {request(_key,_options,fn){const next=tail.then(fn);tail=next.catch(()=>{});return next;}};
}
class Element {
  constructor(id='') {Object.assign(this,{id,children:[],listeners:{},attrs:{},disabled:false,hidden:false,textContent:'',value:'',open:false,files:[],dataset:{},selected:false});this.classList={toggle(){}};}
  addEventListener(name,fn){(this.listeners[name]||=[]).push(fn);}
  emit(name,event={}){for(const fn of this.listeners[name]||[])fn(event);}
  click(){if(!this.disabled)this.emit('click',{preventDefault(){}});}
  setAttribute(k,v){this.attrs[k]=String(v);}
  append(...nodes){this.children.push(...nodes);}
  appendChild(node){this.children.push(node);return node;}
  replaceChildren(...nodes){this.children=nodes;}
  querySelectorAll(tag){return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.querySelectorAll(tag)]);}
  focus(){this.focused=true;if(this.ownerDocument)this.ownerDocument.activeElement=this;} select(){this.selected=true;} remove(){}
}
function page({store=storage(),manager=locks(),hash='',query='',clipboard,share,reduced=false}={}) {
  const ids=['keep-work','work-collection','collection-status','work-status','export-collection','confirm-import','cancel-import','import-collection','import-preview','import-items','work-content','unknown-work','share','share-link','show-share','copy-link','native-share','share-status','work-bloom','bloom-pause'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
  const el=id=>elements[id]; el('native-share').hidden=true;el('import-preview').hidden=true;
  const document=new Element();document.hidden=false;document.body=new Element();
  document.activeElement=document.body;
  for(const node of Object.values(elements))node.ownerDocument=document;
  Object.assign(document,{getElementById:el,createElement:tag=>{const node=new Element();node.tag=tag;node.ownerDocument=document;return node;}});
  const window=new Element();
  const media=new Element();media.matches=reduced;
  const blobs=[];
  class LocalURL extends URL{static createObjectURL(blob){blobs.push(blob);return 'blob:collection';}static revokeObjectURL(){}}
  const location=new URL('https://skaists.dev/docs/mvp-walk/first-work.html'+query+hash);
  const context={window,document,location,navigator:{locks:manager,clipboard,share},localStorage:store,URL:LocalURL,URLSearchParams,Blob,matchMedia:()=>media,setTimeout:()=>0,console};
  window.navigator=context.navigator;
  for(const source of files)vm.runInNewContext(source,context);
  return {el,window,document,store,location,blobs,work:window.BNRFirstWork,later:window.BNRListenLater,
    choose(hash){location.hash=hash;window.emit('hashchange');},
    file(text){el('import-collection').files=[{size:text.length,text:async()=>text}];el('import-collection').emit('change');},
    count(){return this.later.readStore(store).items.length;}};
}

test('one allowlisted work is resolved without accepting URL-supplied credits or assets',()=>{
  const app=page();const work=app.work;
  for(const hash of ['', '#work=bnr-genesis-bloom-v1', '#makers', '#collection', '#share'])assert.equal(work.resolveHash(hash),work.id);
  for(const hash of ['#work=unknown','#work=bnr-genesis-bloom-v1&artist=Someone','#work=bnr-genesis-bloom-v1&work=other','#https://example.com/art.svg','#work=%ZZ'])assert.equal(work.resolveHash(hash),null);
  assert.equal(app.store.writes,0);
  assert.equal(work.shareURL('https://skaists.dev/docs/mvp-walk/first-work.html?private=dedication#anything'),'https://skaists.dev/docs/mvp-walk/first-work.html#work=bnr-genesis-bloom-v1');
  assert.throws(()=>work.shareURL('file:///private/art.html'));
});

test('a shared link previews before Keep; export can be deliberately restored in an independent store',async()=>{
  const sender=page();sender.el('keep-work').click();await tick();
  assert.equal(sender.count(),1);
  const receiver=page({hash:new URL(sender.el('share-link').value).hash});
  assert.equal(receiver.count(),0);assert.equal(receiver.el('work-content').hidden,false);
  receiver.el('keep-work').click();receiver.el('keep-work').click();await tick();
  assert.equal(receiver.count(),1);assert.equal(sender.count(),1);
  assert.equal(receiver.later.readStore(receiver.store).items[0].artist,'LoVis and his mother');
  receiver.el('export-collection').click();const exported=await receiver.blobs[0].text();
  const restored=page();restored.file(exported);await tick();
  assert.equal(restored.count(),0,'choosing a file only previews');
  assert.equal(restored.el('import-preview').hidden,false);
  restored.el('confirm-import').click();await tick();
  assert.equal(restored.count(),1);assert.equal(restored.el('keep-work').textContent,'In your collection');
  assert.equal(page({store:restored.store}).count(),1,'reload retains the reference');
});

test('keyboard Remove retains focus through redraw and empty collection',async()=>{
  const app=page();app.el('keep-work').click();await tick();
  await app.later.saveItem(app.store,{...app.work.record,id:'another-work',title:'Other'},{locks:locks()});
  app.window.emit('storage',{key:app.later.STORE});
  let remove=app.el('work-collection').querySelectorAll('button')[0];
  remove.focus();remove.click();await tick();
  assert.equal(app.document.activeElement.dataset.collectionId,'another-work');
  assert.equal(app.document.activeElement.tag,'button');
  remove=app.document.activeElement;remove.click();await tick();
  assert.equal(app.document.activeElement,app.el('collection-status'));
});

test('keyboard import completion and cancellation return focus to the file input',async()=>{
  const app=page();const text=JSON.stringify({schema:app.later.SCHEMA,items:[app.work.record]});
  app.file(text);await tick();
  app.el('cancel-import').focus();app.el('cancel-import').click();
  assert.equal(app.document.activeElement,app.el('import-collection'));assert.equal(app.count(),0);
  app.file(text);await tick();
  app.el('confirm-import').focus();app.el('confirm-import').click();await tick();
  assert.equal(app.document.activeElement,app.el('import-collection'));assert.equal(app.count(),1);
});

test('unknown work cannot be kept; normal maker/collection anchors preserve the work',async()=>{
  const app=page({hash:'#work=unknown'});assert.equal(app.el('keep-work').disabled,true);
  assert.equal(app.el('unknown-work').hidden,false);assert.equal(app.el('work-content').hidden,true);
  app.el('keep-work').click();await tick();assert.equal(app.count(),0);
  app.choose('#makers');assert.equal(app.el('work-content').hidden,false);
  app.el('keep-work').click();await tick();app.choose('#collection');assert.equal(app.count(),1);
});

test('forged known-work metadata is rejected during import preview',async()=>{
  const app=page();const forged={...app.work.record,artist:'Someone else'};
  app.file(JSON.stringify({schema:app.later.SCHEMA,items:[forged]}));await tick();
  assert.match(app.el('collection-status').textContent,/different details/);
  assert.equal(app.el('confirm-import').disabled,true);assert.equal(app.count(),0);
});

test('a conflicting record arriving from another tab is not treated as the canonical Keep',async()=>{
  const shared=storage();const app=page({store:shared});
  const forged={...app.work.record,artist:'Someone else'};
  shared.setItem(app.later.STORE,JSON.stringify({schema:app.later.SCHEMA,items:[forged]}));
  app.el('keep-work').click();await tick();
  assert.match(app.el('collection-status').textContent,/different details/);
  assert.notEqual(app.el('keep-work').textContent,'In your collection');
  assert.equal(app.later.readStore(shared).items[0].artist,'Someone else');
});

test('a denied write never says kept and leaves previous records intact',async()=>{
  const app=page();await app.later.saveItem(app.store,{...app.work.record,id:'another-work',title:'Other'},{locks:locks()});
  const before=app.store.value();app.store.setItem=()=>{throw new Error('quota');};
  app.el('keep-work').click();await tick();
  assert.equal(app.store.value(),before);assert.notEqual(app.el('keep-work').textContent,'In your collection');
  assert.match(app.el('collection-status').textContent,/refused/);
});

test('uncertain write rereads the result without claiming the store stayed unchanged',async()=>{
  const store=storage();const app=page({store});let verifyFailure=false;
  const get=store.getItem.bind(store),set=store.setItem.bind(store);
  store.setItem=(key,value)=>{set(key,value);verifyFailure=true;};
  store.getItem=key=>{if(verifyFailure){verifyFailure=false;throw new Error('read access lost');}return get(key);};
  app.el('keep-work').click();await tick();
  assert.match(app.el('collection-status').textContent,/could not be confirmed/);
  assert.equal(app.count(),1);assert.equal(app.el('keep-work').textContent,'In your collection');
});

test('a stale file read cannot replace a newer preview',async()=>{
  const app=page();let finish;
  app.el('import-collection').files=[{size:20,text:()=>new Promise(resolve=>finish=resolve)}];
  app.el('import-collection').emit('change');
  app.file(JSON.stringify({schema:app.later.SCHEMA,items:[app.work.record]}));await tick();
  finish('{not json');await tick();
  assert.equal(app.el('import-items').children[0].textContent,'Genesis bloom — LoVis and his mother');
  assert.equal(app.el('confirm-import').disabled,false);assert.equal(app.count(),0);
  app.el('cancel-import').click();assert.equal(app.el('import-preview').hidden,true);assert.equal(app.count(),0);
});

test('clipboard rejection exposes a selectable clean link instead of reporting success',async()=>{
  const app=page({query:'?private=dedication',clipboard:{writeText:async()=>{throw new Error('denied');}}});
  app.el('show-share').click();assert.equal(app.el('share').open,true);
  app.el('copy-link').click();await tick();
  assert.equal(app.el('share-link').selected,true);assert.doesNotMatch(app.el('share-link').value,/private|dedication/);
  assert.match(app.el('share-status').textContent,/Copy was unavailable/);
});

test('other-tab removal refreshes Keep; view events leave an import preview intact',async()=>{
  const app=page();app.el('keep-work').click();await tick();
  await app.later.removeItem(app.store,app.work.id,{locks:locks()});
  app.window.emit('storage',{key:app.later.STORE});assert.equal(app.el('keep-work').disabled,false);
  app.file(JSON.stringify({schema:app.later.SCHEMA,items:[app.work.record]}));await tick();
  for(const reg of ['raver','cypherpunk','bee'])app.document.emit('bregister',{detail:{reg}});
  assert.equal(app.el('import-preview').hidden,false);assert.equal(app.el('confirm-import').disabled,false);
});

test('page leaves stale clipboard/file callbacks unable to update its state',async()=>{
  let copied,readFile;
  const app=page({clipboard:{writeText:()=>new Promise(resolve=>copied=resolve)}});
  app.el('copy-link').click();
  app.el('import-collection').files=[{size:1,text:()=>new Promise(resolve=>readFile=resolve)}];app.el('import-collection').emit('change');
  const before=app.el('share-status').textContent;app.window.emit('pagehide');
  copied();readFile('{}');await tick();
  assert.equal(app.el('share-status').textContent,before);assert.equal(app.el('import-preview').hidden,true);
});
