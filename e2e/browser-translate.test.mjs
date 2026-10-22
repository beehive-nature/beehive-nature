/* WEBML raid S1 — execute the shipped browser-translate.js in two worlds:
   a browser without the Translator API (no button, no throw, no store write) and a
   browser with a recording fake (button mounts, translates lettered leaves only,
   restores on toggle, obeys the estate-tongue event, never writes storage).
   The fake Translator is a recording boundary, not a copy of the platform's. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../surfaces/browser-translate.js',import.meta.url),'utf8');

function matches(el,sel){
  return sel.split(',').some(function(one){
    one=one.trim();
    if(one[0]==='#') return el.id===one.slice(1);
    const attr=one.match(/^\[([A-Za-z0-9_-]+)\]$/);
    if(attr) return el.attributes.includes(attr[1]);
    const kv=one.match(/^\[([A-Za-z0-9_-]+)="(.*)"\]$/);       /* [translate="no"] form */
    if(kv) return el.getAttribute(kv[1])===kv[2];
    return false;
  });
}
class Element{
  constructor(tag){ this.tagName=tag.toUpperCase(); this.id=''; this.type='';
    this.children=[]; this.parentNode=null; this.attributes=[]; this.listeners=new Map();
    this.style={cssText:''}; this.title=''; this._text=''; this.removed=false; }
  get textContent(){ return this._text; }
  set textContent(v){ this._text=String(v); }
  setAttribute(k,v){ if(!this.attributes.includes(k)) this.attributes.push(k);
    if(k==='id') this.id=v; if(k==='title') this.title=v; this['_attr_'+k]=v; }
  getAttribute(k){ return this['_attr_'+k]===undefined?null:this['_attr_'+k]; }
  hasAttribute(k){ return this.attributes.includes(k); }
  addEventListener(t,fn){ const l=this.listeners.get(t)||[]; l.push(fn); this.listeners.set(t,l); }
  click(){ (this.listeners.get('click')||[]).forEach(fn=>fn({})); }
  appendChild(c){ c.parentNode=this; this.children.push(c); return c; }
  remove(){ this.removed=true; if(this.parentNode)
    this.parentNode.children=this.parentNode.children.filter(x=>x!==this); }
  closest(sel){ for(let n=this;n;n=n.parentNode) if(matches(n,sel)) return n; return null; }
}
function makeDoc({lang='en', withHost=true}={}){
  const doc={ readyState:'complete', listeners:new Map(),
    addEventListener(t,fn){ const l=doc.listeners.get(t)||[]; l.push(fn); doc.listeners.set(t,l); },
    createElement(t){ return new Element(t); },
    querySelector(sel){
      if(sel==='main') return main;
      if(sel==='[data-language-host]') return withHost?host:null;
      if(sel==='#blangctl') return withHost?host:null;
      return null; },
    documentElement:{ lang } };
  const body=new Element('body'); const main=new Element('main');
  body.appendChild(main);
  const p1=new Element('p'); p1.textContent='the estate atlas, honest and counted';
  const p2=new Element('p'); p2.textContent='🌐';
  const keep=new Element('p'); keep.textContent='skaists.dev'; keep.attributes.push('translate'); keep['_attr_translate']='no';
  const p3=new Element('p'); p3.textContent='a second paragraph of prose';
  [p1,p2,keep,p3].forEach(p=>main.appendChild(p));
  const host=new Element('span'); host.attributes.push('data-language-host');
  body.appendChild(host); doc.body=body;
  return {doc,body,main,host,p1,p2,keep,p3};
}
function makeSandbox(doc,{translation=null,languages=['lv']}={}){
  const sandbox={ document:doc, navigator:{languages:languages,language:languages[0]},
    console:{info(){}},
    localStorage:{ setItem(){ throw new Error('FLOORS LAW: browser-translate must not write storage'); },
                   getItem(){ throw new Error('FLOORS LAW: browser-translate must not read storage'); } } };
  sandbox.window=sandbox; sandbox.self=sandbox; sandbox.globalThis=sandbox;
  sandbox.Intl=Intl;
  if(translation) sandbox.Translator=translation;
  return sandbox;
}
const drain=()=>new Promise(r=>setImmediate(r));

test('no Translator API → no button, no throw, page untouched', async()=>{
  const w=makeDoc();
  const sandbox=makeSandbox(w.doc,{translation:null});
  vm.runInNewContext(source,sandbox);
  await drain(); await drain();
  assert.ok(sandbox.BNRBrowserTranslate,'handle exposed for walkers');
  assert.equal(sandbox.document.querySelector('[data-language-host]').children.length,0,'host stays empty');
  assert.equal(w.p1.textContent,'the estate atlas, honest and counted');
});

test('page already in the reader tongue → no offer', async()=>{
  const w=makeDoc({lang:'en'});
  const fake={ availability:async()=>'available', create:async()=>({translate:async t=>t}) };
  const sandbox=makeSandbox(w.doc,{translation:fake,languages:['en']});
  vm.runInNewContext(source,sandbox);
  await drain(); await drain();
  assert.equal(w.host.children.length,0,'no button when source equals target');
});

test('API present → icon-only button, browser-tongue label, translate + restore', async()=>{
  const w=makeDoc({lang:'en'});
  const calls=[];
  const fake={ availability:async(o)=>{ calls.push(['availability',o]); return 'available'; },
               create:async(o)=>{ calls.push(['create',o]); return { translate:async t=>'[lv] '+t }; } };
  const sandbox=makeSandbox(w.doc,{translation:fake,languages:['lv']});
  vm.runInNewContext(source,sandbox);
  await drain(); await drain();
  assert.equal(w.host.children.length,1,'rider mounted in the language host');
  const btn=w.host.children[0].children[0];
  assert.equal(btn.tagName,'BUTTON'); assert.equal(btn.textContent,'🌐','icon-only: no visible estate string');
  assert.ok(btn.getAttribute('aria-label').indexOf('latviešu')!==-1,'label in the browser\'s own words');
  assert.equal(calls[0][1].sourceLanguage,'en');   /* field-wise: vm objects fail deepEqual across contexts */
  assert.equal(calls[0][1].targetLanguage,'lv');
  btn.click(); await drain(); await drain(); await drain();
  assert.equal(w.p1.textContent,'[lv] the estate atlas, honest and counted','lettered leaf translated');
  assert.equal(w.p3.textContent,'[lv] a second paragraph of prose');
  assert.equal(w.p2.textContent,'🌐','icon leaf untouched');
  assert.equal(w.keep.textContent,'skaists.dev','translate="no" (the pointer principle) untouched');
  assert.equal(btn.getAttribute('aria-pressed'),'true');
  btn.click(); await drain();
  assert.equal(w.p1.textContent,'the estate atlas, honest and counted','toggle restores the estate\'s own words');
  assert.equal(w.p3.textContent,'a second paragraph of prose');
  assert.equal(btn.getAttribute('aria-pressed'),'false');
});

test('the estate picker event undoes any browser layer, then re-offers', async()=>{
  const w=makeDoc({lang:'en'});
  const fake={ availability:async()=>'available', create:async()=>({ translate:async t=>'[lv] '+t }) };
  const sandbox=makeSandbox(w.doc,{translation:fake,languages:['lv']});
  vm.runInNewContext(source,sandbox);
  await drain(); await drain();
  const btn=w.host.children[0].children[0];
  btn.click(); await drain(); await drain(); await drain();
  assert.equal(w.p1.textContent,'[lv] the estate atlas, honest and counted');
  sandbox.document.documentElement.lang='lv';               /* the picker moved the page to the reader's tongue */
  (sandbox.document.listeners.get('blang')||[]).forEach(fn=>fn({detail:{lang:'lv'}}));
  await drain(); await drain();
  assert.equal(w.p1.textContent,'the estate atlas, honest and counted','translation undone before re-offer');
  assert.equal(w.host.children.length,0,'no further offer when the estate now speaks the reader\'s tongue');
});

test('create() failure → honest degrade: offer disappears, page unchanged, nothing loud', async()=>{
  const w=makeDoc({lang:'en'});
  const fake={ availability:async()=>'downloadable',
               create:async()=>{ throw new Error('pack refused'); } };
  const sandbox=makeSandbox(w.doc,{translation:fake,languages:['lv']});
  vm.runInNewContext(source,sandbox);
  await drain(); await drain();
  const btn=w.host.children[0].children[0];
  btn.click(); await drain(); await drain();
  assert.equal(w.host.children.length,0,'button removed after failure');
  assert.equal(w.p1.textContent,'the estate atlas, honest and counted','page unchanged');
});


test('nested controls and curated language text survive the translation layer', async()=>{
  const w=makeDoc(), parent=new Element('section'), keyed=new Element('span'), child=new Element('p');
  parent.textContent='parent container must survive';
  keyed.setAttribute('data-i18n','plur.peace'); keyed.textContent='curated Latvian';
  child.textContent='unkeyed prose';parent.appendChild(keyed);parent.appendChild(child);w.main.appendChild(parent);
  const seen=[],fake={availability:async()=>'available',create:async()=>({translate:async text=>{seen.push(text);return '[draft] '+text;}})};
  const sandbox=makeSandbox(w.doc,{translation:fake});vm.runInNewContext(source,sandbox);await drain();await drain();
  w.host.children[0].children[0].click();await drain();await drain();
  assert.equal(parent.textContent,'parent container must survive');assert.equal(parent.children.length,2);
  assert.equal(keyed.textContent,'curated Latvian');assert.equal(child.textContent,'[draft] unkeyed prose');
  assert.ok(!seen.includes('curated Latvian'));assert.ok(!seen.includes('parent container must survive'));
});
