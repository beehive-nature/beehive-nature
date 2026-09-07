/* Execute the shipped dock against a small DOM boundary. These regressions
   prove positioning decisions and close controls, not rendered-browser layout. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../surfaces/agent-dock.js',import.meta.url),'utf8');

function dock({height=650,position='static',barHeight=540,viewport=null}={}) {
  const ids=new Map(), events={}, elements=[];
  function element(tag) {
    const attrs={}, classes=new Set(), listeners={}, children=[];
    const el={tag,style:{},children,listeners,attrs,
      appendChild(child){children.push(child);},
      setAttribute(k,v){attrs[k]=v;},getAttribute(k){return attrs[k]??null;},
      addEventListener(k,fn){(listeners[k]??=[]).push(fn);},
      querySelector(s){return s==='iframe'?this.frame:ids.get(s==='.x'?'close':s.slice(1));},
      querySelectorAll(){return children;},focus(){focused=el;},
      click(){this.onclick?.();},
      classList:{contains:k=>classes.has(k),toggle(k,on){if(on??!classes.has(k))classes.add(k);else classes.delete(k);},add:k=>classes.add(k),remove:k=>classes.delete(k)}
    };
    Object.defineProperty(el,'id',{set(v){ids.set(v,el);},get(){return [...ids].find(([,v])=>v===el)?.[0];}});
    Object.defineProperty(el,'innerHTML',{set(v){this.html=v;this.frame=v.includes('<iframe ')?element('iframe'):null;},get(){return this.html||'';}});
    elements.push(el);return el;
  }
  let focused;
  const body=element('body');
  for(const id of ['adAgents','adBody','adPrompt','adSend','close']) element('div').id=id;
  const bar=position===null?null:element('nav');
  if(bar){bar.id='tbar';bar.getBoundingClientRect=()=>({height:barHeight,top:height-barHeight,bottom:height});}
  const on=(k,fn)=>(events[k]??=[]).push(fn);
  const document={body,head:element('head'),documentElement:element('html'),
    createElement:element,getElementById:id=>ids.get(id),addEventListener:on};
  const context={document,innerHeight:height,location:{pathname:'/surfaces/'},
    getComputedStyle:el=>({position:el===bar?position:'static',paddingBottom:'0'}),
    matchMedia:()=>({matches:true}),addEventListener:on,MutationObserver:class{observe(){}disconnect(){}},
    setTimeout,clearTimeout,navigator:{},visualViewport:viewport?{...viewport,addEventListener:on}:null};
  context.window=context;
  vm.runInNewContext(source,context);
  return {orb:ids.get('adOrb'),win:ids.get('adWin'),body,ids,
    fire(k,event={}){for(const fn of events[k]||[])fn(event);},focused:()=>focused};
}

test('the tall in-flow footer cannot push the launcher above the viewport',()=>{
  const {orb,win,body}=dock();
  assert.equal(orb.style.bottom,'18px');
  assert.equal(body.style.paddingBottom,undefined);
  assert.ok(650-parseFloat(win.style.bottom)-parseFloat(win.style.height)>=12);
});
test('a visible fixed toolbar gets clearance; the pre-toolbar fail-safe remains',()=>{
  const fixed=dock({position:'fixed',barHeight:60});
  assert.equal(fixed.orb.style.bottom,'70px');
  assert.equal(fixed.body.style.paddingBottom,'82px');
  assert.equal(dock({position:null}).orb.style.bottom,'66px');
  assert.equal(dock({position:'fixed',barHeight:0}).body.style.paddingBottom,undefined);
});
test('large toolbars and short or keyboard-reduced viewports keep the dialog bounded',()=>{
  for(const height of [320,650,900]) {
    const {orb,win}=dock({height,position:'fixed',barHeight:height*.8});
    assert.ok(height-parseFloat(orb.style.bottom)-52>=12);
    assert.ok(height-parseFloat(win.style.bottom)-parseFloat(win.style.height)>=11.9);
    assert.ok(parseFloat(win.style.height)>height*.5);
  }
  const {orb,win}=dock({height:800,viewport:{height:360,offsetTop:0}});
  assert.equal(orb.style.bottom,'458px');
  assert.equal(800-parseFloat(win.style.bottom)-parseFloat(win.style.height),12);
});
test('opening and closing updates the accessible state and returns keyboard focus',()=>{
  const d=dock();d.orb.onclick();
  assert.equal(d.orb.attrs['aria-expanded'],'true');
  assert.equal(d.focused(),d.ids.get('adPrompt'));
  d.fire('keydown',{key:'Escape'});
  assert.equal(d.orb.attrs['aria-expanded'],'false');
  assert.equal(d.win.classList.contains('on'),false);
  assert.equal(d.focused(),d.orb);
});
test('frame and ordinary panels select their own scroll mode',()=>{
  const d=dock(), body=d.ids.get('adBody'), chips=d.ids.get('adAgents').children;
  assert.equal(body.classList.contains('has-frame'),true);
  chips[2].click();assert.equal(body.classList.contains('has-frame'),false);
  chips[0].click();assert.equal(body.classList.contains('has-frame'),true);
});
