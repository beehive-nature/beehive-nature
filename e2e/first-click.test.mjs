/* Exercise the shipped inline engines with fake time, RPC and small DOM boundaries.
   No network, audio hardware or browser: this is not rendered usability acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {extractKeyedText} from './i18n-extract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const musicHTML=read('surfaces/blight/studio-music.html'),galleryHTML=read('surfaces/blight/gallery.html');
const inline=html=>[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const plain=x=>JSON.parse(JSON.stringify(x));
const address='0x'+'1'.repeat(40);
const wait=()=>new Promise(resolve=>setImmediate(resolve));

function boundary(html,extra={}){
 const ids=new Map(),all=[],events={},windowEvents={},timers=new Map();let clockId=0;
 const add=(map,key,fn)=>(map[key]??=[]).push(fn);
 function element(tag='div'){
  const e={tagName:tag.toUpperCase(),dataset:{},style:{},attrs:{},children:[],listeners:{},isConnected:true,open:false,hidden:false,disabled:false,tabIndex:-1,value:'',parentElement:null,
   setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];},
   appendChild(n){if(n.parentElement){const a=n.parentElement.children;a.splice(a.indexOf(n),1);}this.children.push(n);n.parentElement=this;return n;},
   append(...nodes){nodes.forEach(n=>this.appendChild(n));},replaceChildren(...nodes){this.children.forEach(n=>n.parentElement=null);this.children=[];this.append(...nodes);},
   contains(n){return n===this||this.children.some(c=>c.contains(n));},
   addEventListener(k,fn){add(this.listeners,k,fn);},
   fire(k,event={}){for(const fn of this.listeners[k]||[])fn(event);},
   focus(){document.activeElement=this;this.fire('focus');},select(){this.selected=true;},
   click(){if(this.disabled)return;this.onclick?.();this.fire('click');},
   querySelectorAll(s){return this.children.flatMap(c=>[c,...c.querySelectorAll('*')]).filter(n=>matches(n,s));},
   querySelector(s){return this.querySelectorAll(s)[0]||null;},
   closest(s){for(let n=this;n;n=n.parentElement)if(matches(n,s))return n;return null;},
   showModal(){this.open=true;},close(){this.open=false;this.fire('close');}
  };
  let text='',content='';
  Object.defineProperty(e,'textContent',{get(){return text;},set(v){text=String(v);}});
  Object.defineProperty(e,'innerHTML',{get(){return content;},set(v){content=String(v);this.replaceChildren();if(this.tagName==='SELECT'){
   this.options=[...content.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(m=>({value:m[1].match(/value="([^"]+)"/)?.[1]??m[2],textContent:m[2],selected:m[1].includes('selected')}));this.value=(this.options.find(o=>o.selected)||this.options[0])?.value||'';
  }}});
  e.classList={contains:c=>(e.className||'').split(/\s+/).includes(c),add(c){e.className=[...new Set([...(e.className||'').split(/\s+/),c])].join(' ');},remove(c){e.className=(e.className||'').split(/\s+/).filter(x=>x!==c).join(' ');},toggle(c,on){(on?this.add:this.remove).call(this,c);}};
  all.push(e);return e;
 }
 function matches(e,selector){return selector.split(',').some(s=>{
  s=s.trim();if(s==='*')return true;
  if(s==='[hidden]')return e.hidden;
  if(s==='dialog:not([open])')return e.tagName==='DIALOG'&&!e.open;
  if(s==='details:not([open])')return e.tagName==='DETAILS'&&!e.open;
  if(s==='[contenteditable="true"]')return e.attrs.contenteditable==='true';
  const classes=[...s.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);if(classes.some(c=>!e.classList.contains(c)))return false;
  for(const m of s.matchAll(/\[data-([\w]+)="([^"]+)"\]/g))if(String(e.dataset[m[1]])!==m[2])return false;
  const tag=s.match(/^[a-z]+/i)?.[0];return (!tag||e.tagName===tag.toUpperCase())&&(classes.length>0||tag||s.startsWith('[data-'));
 });}
 const document={body:element('body'),activeElement:null,getElementById:id=>ids.get(id),createElement:element,
  querySelectorAll:s=>all.filter(e=>matches(e,s)),querySelector:s=>all.find(e=>matches(e,s))||null,
  addEventListener:(k,fn)=>add(events,k,fn)};
 document.body.dataset.reg='bee';document.activeElement=document.body;
 for(const m of html.split('<script>')[0].matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
  const e=element(m[1]);e.id=m[3];e.className=m[2].match(/class="([^"]*)"/)?.[1]||'';e.value=m[2].match(/value="([^"]*)"/)?.[1]||'';
  e.disabled=/\sdisabled\b/.test(m[2]);e.hidden=/\shidden\b/.test(m[2]);ids.set(e.id,e);document.body.appendChild(e);
 }
 for(const id of ['sound-panel','variation-panel','save-panel','import-panel','score-panel','record-details'])if(ids.has(id))ids.get(id).appendChild(element('summary'));
 if(ids.has('wave'))ids.get('wave').value='triangle';
 if(ids.has('wings'))ids.get('wings').appendChild(ids.get('collections-content'));
 const schedule=(fn,ms,interval=false)=>{const id=++clockId;timers.set(id,{fn,ms,interval});return id;};
 const context={document,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,Blob,AbortController,AbortSignal,btoa,atob,
  location:{origin:'https://skaists.dev',pathname:'/surfaces/blight/studio-music.html',search:'',hash:''},navigator:{},
  setTimeout:(fn,ms)=>schedule(fn,ms),clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>schedule(fn,ms,true),clearInterval:id=>timers.delete(id),
  matchMedia:()=>({matches:true}),addEventListener:(k,fn)=>add(windowEvents,k,fn),...extra};context.window=context;
 vm.createContext(context);
 return {ids,document,context,timers,element,run:code=>vm.runInContext(code,context),
  tick(){for(const [id,t] of [...timers]){if(!timers.has(id))continue;if(!t.interval)timers.delete(id);t.fn();}},
  fire(k,e={},target='document'){for(const fn of (target==='window'?windowEvents:events)[k]||[])fn(e);},
  view(reg){document.body.dataset.reg=reg;this.fire('bregister',{detail:{reg}});}
 };
}
function music(extra={}){const b=boundary(musicHTML,extra);b.run(inline(musicHTML));return b;}
async function gallery(extra={}){
 const requests=[];
 const b=boundary(galleryHTML,{fetch:async(url,opts)=>{const calls=JSON.parse(opts.body);requests.push({url,calls});return {ok:true,json:async()=>calls.map(c=>({id:c.id,result:'0x0'}))};},...extra});
 b.run(inline(galleryHTML).replace("\nstart('0x", "\nwindow.initialRead=start('0x"));await b.context.initialRead;return Object.assign(b,{requests});
}

test('studio presents 128 native note buttons with one keyboard entry and reversible edits',()=>{
 const b=music(),grid=b.ids.get('grid'),cells=grid.querySelectorAll('.cell');assert.equal(cells.length,128);assert.ok(cells.every(c=>c.tagName==='BUTTON'));
 assert.equal(cells.filter(c=>c.tabIndex===0).length,1);const note=cells.find(c=>c.tabIndex===0);note.focus();note.onclick();assert.equal(note.getAttribute('aria-pressed'),'true');
 let prevented=false;note.onkeydown({key:'ArrowRight',preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(b.document.activeElement.dataset.s,1);
 const composed=b.run('score()');b.ids.get('clear').onclick();assert.doesNotMatch(b.run('score().steps'),/1/);b.ids.get('undo').onclick();assert.deepEqual(plain(b.run('score()')),plain(composed));
});
test('tempo is bounded at runtime and invalid scores are rejected before any setting is applied',()=>{
 const b=music();for(const [input,expected] of [['0',60],['9999',200],['NaN',132]]){b.ids.get('bpm').value=input;b.ids.get('bpm').fire('change');assert.equal(Number(b.ids.get('bpm').value),expected);}
 const original=b.run('score()');for(const mutation of [{bpm:Infinity},{root:'wrong'},{scale:'__proto__'},{wave:'noise'},{steps:'1'},{imported:[]}]){
  b.context.bad={...plain(original),...mutation};assert.throws(()=>b.run('applyPattern(validateScore(bad))'));assert.deepEqual(plain(b.run('score()')),plain(original));
 }
});
test('complete Unicode score metadata survives share and legacy query restoration beyond the old truncation',async()=>{
 const b=music();b.context.meta={scale:'major',caption:'Mūzika · музыка · 音楽 · '.repeat(160),barColorTop:'#33cc88'};
 b.run('imported={meta};pattern[3][5]=true');await b.ids.get('link').onclick();const link=b.ids.get('share-text').value;
 assert.ok(link.length>1800);assert.ok(b.ids.get('share-text').selected);assert.equal(b.ids.get('share-fallback').hidden,false);
 const u=new URL(link),saved=plain(b.run('score()'));
 for(const location of [{origin:u.origin,pathname:u.pathname,hash:u.hash,search:''},{origin:u.origin,pathname:u.pathname,hash:'',search:'?'+u.hash.slice(1)}]){
  const restored=music({location});assert.deepEqual(plain(restored.run('score()')),saved);
 }
});
test('invalid shared score reports failure and does not partly overwrite the default composition',()=>{
 const b=music({location:{origin:'https://skaists.dev',pathname:'/music',search:'',hash:'#score=not-base64'}});
 assert.match(b.ids.get('status').textContent,/invalid/);assert.equal(b.run('score().root'),'A');assert.doesNotMatch(b.run('score().steps'),/1/);
});
test('pending audio startup can be stopped; an older resume cannot create a second playback loop',async()=>{
 const resumes=[];class Audio{state='suspended';resume(){return new Promise(resolve=>resumes.push(resolve));}}
 const b=music({AudioContext:Audio});const first=b.ids.get('play').onclick();assert.equal(b.ids.get('stop').disabled,false);
 b.ids.get('stop').onclick();const second=b.ids.get('play').onclick();resumes[0]();await first;assert.equal(b.timers.size,0);
 resumes[1]();await second;assert.equal(b.timers.size,1);b.tick();assert.equal(b.timers.size,1);
 const before=plain(b.run('score()'));b.view('raver');b.view('cypherpunk');b.view('bee');assert.deepEqual(plain(b.run('score()')),before);assert.equal(b.timers.size,1);
 b.ids.get('stop').onclick();assert.equal(b.timers.size,0);assert.equal(b.ids.get('play').disabled,false);
});
test('studio remembers manual panel choices for each view',()=>{
 const b=music();b.ids.get('sound-panel').open=true;b.view('raver');b.ids.get('save-panel').open=true;b.view('bee');assert.equal(b.ids.get('sound-panel').open,true);b.view('raver');assert.equal(b.ids.get('save-panel').open,true);
});
test('gallery empty reads are safe to navigate and each collection uses its own chain',async()=>{
 const b=await gallery();assert.equal(b.ids.get('bNext').disabled,true);assert.doesNotThrow(()=>b.run('show(-1);show(0);walk()'));
 assert.equal(b.ids.get('stage').getAttribute('aria-busy'),'false');assert.match(b.ids.get('gallery-status').textContent,/completed reads/);
 const eth=b.requests.filter(r=>r.calls.some(c=>c.params[0].to==='0x3103cD1602d5fa8f4b9283F9D5a7fa2290795d51'));
 assert.ok(eth.length);assert.ok(eth.every(r=>r.url.includes('ethereum')));
});
test('RPC batch results follow request ids instead of server response order',async()=>{
 const b=await gallery();b.context.fetch=async()=>({json:async()=>[{id:1,result:'second'},{id:0,result:'first'}]});
 assert.deepEqual(plain(await b.run("rpc([{to:'a'},{to:'b'}])")),['first','second']);assert.equal(b.timers.size,0);
});
test('failed collection reads remain distinct from a verified empty collection',async()=>{
 const b=await gallery();b.context.fetch=async()=>{throw Error('offline');};await b.run('start("'+address+'","Test garden")');
 assert.match(b.ids.get('gallery-status').textContent,/failed/);assert.equal(b.ids.get('retry').hidden,false);assert.equal(b.ids.get('record-wallet').textContent,address);
 b.run('resolveName=async()=>null');await b.run('start("unknown.name","Unknown")');assert.equal(b.ids.get('record-wallet').textContent,'Not available');
});
test('superseded gallery reads cannot overwrite the new collection; partial results retain exact artwork',async()=>{
 const b=await gallery(),pending=[];b.context.pending=pending;b.run('loadGarden=()=>new Promise(resolve=>pending.push(resolve))');
 const old=b.run('start("'+address+'","Old")');await wait();const fresh=b.run('start("'+address+'","Fresh")');await wait();
 const svg='<svg viewBox="0 0 1 1"><title>Original public artwork</title></svg>';
 const piece={svg,sym:'FUNGI',chain:'base',contract:address,seed:12,lvln:0,pipmax:5};
 pending[1]({found:[piece],raw:[piece],failures:1});await fresh;b.tick();pending[0]({found:[],raw:[],failures:0});await old;
 assert.equal(b.ids.get('frame').innerHTML,svg);assert.equal(b.ids.get('wing').textContent,'Fresh');assert.match(b.ids.get('gallery-status').textContent,/Some pieces are still loading|Some chain reads failed/);
 const requestCount=pending.length;b.view('raver');b.view('cypherpunk');b.view('bee');assert.equal(pending.length,requestCount);assert.equal(b.ids.get('frame').innerHTML,svg);
});
test('gallery keyboard shortcuts leave form fields, buttons and links to their native controls',async()=>{
 const b=await gallery();for(const tag of ['input','textarea','select','button','a','summary']){let prevented=false;b.fire('keydown',{target:b.element(tag),key:' ',preventDefault(){prevented=true;}});assert.equal(prevented,false,tag);}
 b.ids.get('bWings').onclick();assert.equal(b.ids.get('wings').open,true);b.ids.get('close-wings').onclick();assert.equal(b.ids.get('wings').open,false);assert.equal(b.document.activeElement,b.ids.get('bWings'));
});
test('gallery restores timers and retries an interrupted load after browser history restoration',async()=>{
 const b=await gallery();b.context.mockPiece={svg:'<svg></svg>',sym:'Test',seed:1,lvln:null,chain:'base',contract:address};b.run('pieces=[mockPiece];show(0);walking=true');
 b.fire('pagehide',{},'window');assert.equal(b.timers.size,0);b.fire('pageshow',{persisted:true},'window');b.tick();assert.equal(b.ids.get('frame').innerHTML,'<svg></svg>');assert.equal([...b.timers.values()].filter(t=>t.interval).length,1);
 b.ids.get('stage').setAttribute('aria-busy','true');b.run('start=()=>{window.retried=true;}');b.fire('pageshow',{persisted:true},'window');assert.equal(b.context.retried,true);
});
test('view focus recovery selects the visible outer summary when nested records close',()=>{
 for(const html of [musicHTML,galleryHTML,read('surfaces/profile.html'),read('surfaces/buzz-directory.html')]){
  const code=inline(html),start=code.indexOf('function restoreVisibleFocus('),end=code.indexOf('\n}',start)+2;
  assert.ok(start>=0);const b=boundary('');b.run(code.slice(start,end));const outer=b.element('details'),inner=b.element('details'),first=b.element('summary'),second=b.element('summary'),link=b.element('a');
  outer.append(first,inner);inner.append(second,link);b.context.focus=link;b.run('restoreVisibleFocus(focus)');assert.equal(b.document.activeElement,first);
  outer.open=true;b.run('restoreVisibleFocus(focus)');assert.equal(b.document.activeElement,second);inner.open=true;b.run('restoreVisibleFocus(focus)');assert.equal(b.document.activeElement,link);
 }
});
test('Home preserves its one search form, query, filter and per-view disclosure choices',()=>{
 const html=read('surfaces/index.html'),code=read('surfaces/atlas.js'),b=boundary(html),form=b.element('form'),collection=b.ids.get('collection');
 const q=b.ids.get('q'),family=b.ids.get('family-filter');family.options=[];q.value='';family.value='';
 const trace=b.element('details');trace.className='row-trace';const summary=b.element('summary');trace.appendChild(summary);
 const link=b.element('a');trace.appendChild(link);
 Object.assign(b.context,{q,family,form,collection});b.ids.get('search-origin').appendChild(form);
 b.run(code.slice(code.indexOf('function restoreVisibleFocus('),code.indexOf("  document.addEventListener('bregister'")));
 b.run('applyReading()');assert.equal(collection.open,false);collection.open=true;
 b.document.body.dataset.reg='cypherpunk';b.run('applyReading()');assert.equal(form.parentElement,b.ids.get('technical-search-slot'));assert.equal(trace.open,true);
 b.document.body.dataset.reg='bee';b.run('applyReading()');assert.equal(collection.open,true);assert.equal(form.parentElement,b.ids.get('search-origin'));
 collection.open=false;q.value='gallery';family.value='skaists';b.document.body.dataset.reg='raver';b.run('applyReading()');b.document.body.dataset.reg='bee';b.run('applyReading()');
 assert.equal(collection.open,true);assert.equal(q.value,'gallery');assert.equal(family.value,'skaists');
});
test('all five pages retain ordinary navigation and exact corpus English for the new labels',()=>{
 const corpus=JSON.parse(read('surfaces/lang-corpus.json'));
 for(const path of ['index.html','blight/gallery.html','blight/studio-music.html','buzz-directory.html','profile.html']){
  const html=read('surfaces/'+path),nav=html.match(/<nav data-experience-nav[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(nav,path);assert.equal((nav.match(/<a /g)||[]).length,5,path);assert.equal((nav.match(/aria-current="page"/g)||[]).length,1,path);
  for(const m of html.matchAll(/<[^>]+data-i18n="(experience\.[^"]+|social\.arrival\.home)"[^>]*>/g)){
   assert.ok(corpus.strings[m[1]],m[1]);assert.equal(extractKeyedText(html,m.index),corpus.strings[m[1]].en,path+': '+m[1]);
  }
 }
 assert.deepEqual(corpus._meta.langs.slice(0,6),['ru','lv','th','gd','tt','uk']);
 for(const [key,row] of Object.entries(corpus.strings).filter(([k])=>k.startsWith('experience.')))for(const lang of ['en',...corpus._meta.langs])assert.ok(row[lang]?.trim(),key+'/'+lang);
});
