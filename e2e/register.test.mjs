/* Runs the shipped register at a small DOM boundary; not a rendered-layout test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {listSurfacesOnDisk} from '../scripts/surface-count.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const source=read('surfaces/register.js');
function page({saved=null,denied=false,host=false,loading=false,display='block',direction='row',script='https://skaists.dev/surfaces/register.js?v=7'}={}){
  const ids=new Map(), events={}, docEvents={}, storage=new Map();
  if(saved!==null) storage.set('bregister',saved);
  const on=(map,k,fn)=>(map[k]??=[]).push(fn);
  function element(tag){
    const e={tag,attrs:{},children:[],style:{},listeners:{},
      setAttribute(k,v){this.attrs[k]=v;}, getAttribute(k){return this.attrs[k]??null;},
      appendChild(c){this.children.push(c);return c;},
      insertBefore(c,b){this.children.splice(b?this.children.indexOf(b):0,0,c);return c;},
      addEventListener(k,fn){on(this.listeners,k,fn);},
      click(){for(const fn of this.listeners.click||[])fn();}};
    Object.defineProperty(e,'id',{get(){return this.attrs.id;},set(v){this.attrs.id=v;ids.set(v,this);}});
    Object.defineProperty(e,'firstChild',{get(){return this.children[0]??null;}});
    return e;
  }
  const body=element('body'),content=element('main');content.textContent='All facts, all actions';body.appendChild(content);
  const explicit=host?element('div'):null;
  if(explicit){explicit.setAttribute('data-register-host','');explicit.setAttribute('aria-describedby','view-explainer');body.appendChild(explicit);}
  const document={body,head:element('head'),readyState:loading?'loading':'complete',currentScript:{src:script},
    createElement:element,getElementById:k=>ids.get(k),querySelector:s=>s==='[data-register-host]'?explicit:s==='body > main'?content:null,
    addEventListener:(k,fn)=>on(docEvents,k,fn),dispatchEvent:e=>{for(const fn of docEvents[e.type]||[])fn(e);}};
  const context={document,URL,getComputedStyle:()=>({display,flexDirection:direction}),location:{href:'https://skaists.dev/surfaces/doors/bnature-social.html'},
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
    localStorage:{getItem:k=>{if(denied)throw Error('blocked');return storage.get(k)??null;},setItem:(k,v)=>{if(denied)throw Error('blocked');storage.set(k,v);}},
    addEventListener:(k,fn)=>on(events,k,fn)};
  context.window=context;
  const run=()=>vm.runInNewContext(source,context);run();
  return {ids,body,content,explicit,storage,document,run,
    fire(k,e={}){for(const fn of events[k]||[])fn(e);},
    ready(){document.readyState='complete';document.dispatchEvent({type:'DOMContentLoaded'});}};
}
test('new visitors get one top control and New bee; content remains the same node',()=>{
  const p=page();assert.equal(p.body.firstChild,p.ids.get('bregbar'));
  assert.equal(p.body.attrs['data-reg'],'bee');assert.equal(p.ids.get('bregctl').children.length,3);
  for(const mode of ['raver','cypherpunk','bee']){
    p.ids.get('breg-'+mode).click();
    assert.equal(p.body.attrs['data-reg'],mode);assert.equal(p.storage.get('bregister'),mode);
    assert.equal(p.ids.get('bregctl').children.filter(b=>b.attrs['aria-pressed']==='true').length,1);
    assert.ok(p.body.children.includes(p.content));assert.equal(p.content.textContent,'All facts, all actions');
  }
});
test('the existing hub host is reused without another header',()=>{
  const p=page({host:true,saved:'raver'});assert.equal(p.ids.has('bregbar'),false);
  assert.equal(p.explicit.children[0],p.ids.get('bregctl'));assert.equal(p.body.attrs['data-reg'],'raver');
  assert.equal(p.ids.get('bregctl').attrs['aria-describedby'],'view-explainer');
});
test('centered row-flex pages keep their main column; column pages retain a top sibling',()=>{
  for(const direction of ['row','row-reverse']){
    const p=page({display:'flex',direction});
    assert.equal(p.body.firstChild,p.content);assert.equal(p.body.children.length,1);
    assert.equal(p.content.firstChild,p.ids.get('bregbar'));assert.deepEqual(p.body.style,{});
  }
  const p=page({display:'flex',direction:'column'});assert.equal(p.body.firstChild,p.ids.get('bregbar'));
});
test('persistence survives navigation; invalid/blocked storage falls back without disabling choice',()=>{
  for(const saved of ['bee','raver','cypherpunk'])assert.equal(page({saved}).body.attrs['data-reg'],saved);
  assert.equal(page({saved:'unexpected'}).body.attrs['data-reg'],'bee');
  const p=page({denied:true});p.ids.get('breg-cypherpunk').click();assert.equal(p.body.attrs['data-reg'],'cypherpunk');
});
test('same-origin storage changes and clearing synchronize views without rewriting preferences',()=>{
  const p=page();p.storage.set('bregister','raver');p.fire('storage',{key:'bregister'});
  assert.equal(p.body.attrs['data-reg'],'raver');p.storage.clear();p.fire('storage',{key:null});
  assert.equal(p.body.attrs['data-reg'],'bee');assert.equal(p.storage.size,0);
});
test('duplicate script execution before or after DOM readiness mounts once',()=>{
  const p=page({loading:true});p.run();assert.equal(p.ids.has('bregctl'),false);p.ready();p.run();p.ready();
  assert.equal(p.ids.get('bregctl').children.length,3);
  assert.equal(p.body.children.filter(c=>c.id==='bregbar').length,1);
  assert.equal(p.document.head.children.length,1);
});
test('native buttons cannot submit a surrounding form; labels use existing corpus keys',()=>{
  const p=page({host:true});const corpus=JSON.parse(read('surfaces/lang-corpus.json')).strings;
  for(const button of p.ids.get('bregctl').children){
    assert.equal(button.type,'button');assert.equal(button.children[0].attrs['aria-hidden'],'true');
    const label=button.children[1];assert.equal(corpus[label.attrs['data-i18n']].en,label.textContent);
  }
});
test('home resolves beside the loader on custom and GitHub project origins',()=>{
  for(const prefix of ['https://skaists.dev/surfaces/','https://beehive-nature.github.io/beehive-nature/surfaces/']){
    const p=page({script:prefix+'register.js?v=7'});assert.equal(p.ids.get('bregbar').children[0].href,prefix+'index.html');
  }
});
test('bregister retains the established event payload for page presentations',()=>{
  const p=page();let observed;p.document.addEventListener('bregister',e=>observed=e.detail.reg);
  p.ids.get('breg-raver').click();assert.equal(observed,'raver');
});
test('every current estate HTML has one resolvable shared loader; frozen art stays pinned separately',()=>{
  const estate=JSON.parse(read('estate.json'));
  const files=new Set([...listSurfacesOnDisk().map(p=>'surfaces/'+p),...estate.surfaces.map(s=>s.path)]);
  assert.ok(files.size>=102);
  for(const p of files){
    const tags=[...read(p).matchAll(/<script\b[^>]*\bsrc=["']([^"']*\b(?:tour|register)\.js(?:\?[^"']*)?)["'][^>]*>/gi)];
    assert.equal(tags.length,1,p+' must load the shared shell once');
    const target=resolve(dirname(resolve(root,p)),tags[0][1].split('?')[0]);
    assert.equal(target,resolve(root,'surfaces/tour.js'),p+' must resolve to the shared tour');
    if(p!=='surfaces/forge/orbit.html')assert.match(tags[0][1],/tour\.js\?v=37$/,p);
  }
  for(const p of ['scripts/build-atlas.mjs','tools/build-surfaces.mjs']){
    assert.match(read(p),/tour\.js\?v=37/);assert.doesNotMatch(read(p),/tour\.js\?v=(?!37\b)\d+/);
  }
});
test('tour language bootstrap waits for view labels, with a script-error fallback',()=>{
  const tour=read('surfaces/tour.js');
  assert.match(tour,/s\.onload=loadLanguage; s\.onerror=loadLanguage/);
  assert.match(tour,/else loadLanguage\(\)/);
  assert.match(read('surfaces/lang.js'),/#bregbar,#bregctl/);
});
