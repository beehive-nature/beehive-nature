/* Execute the shipped dock with nested DOM nodes, isolated iframe documents and
   explicit load events. Child q/ask engines are recording boundaries, not copies
   of their implementation. Browser rendering, real engine responses, speech and
   new-tab navigation still require browser verification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../surfaces/agent-dock.js',import.meta.url),'utf8');

function dock({height=650,width=1100,position='static',barHeight=540,viewport=null,
  href='https://bnr.test/surfaces/index.html',clipboard='ok'}={}) {
  const frames=[],observers=[];
  const decode=s=>String(s).replace(/&(?:amp|lt|gt|quot|#39);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[m]));
  class Events {
    listeners=new Map();
    addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
    removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x!==fn));}
    fire(type,props={}) {
      const event={type,target:this,bubbles:true,defaultPrevented:false,
        preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...props};
      for(let node=this;node;node=event.bubbles&&!event.stopped?node.parentNode:null){
        event.currentTarget=node;node['on'+type]?.call(node,event);
        for(const fn of [...(node.listeners?.get(type)||[])])fn.call(node,event);
      }return event;
    }
  }
  class Element extends Events {
    constructor(tag,ownerDocument){super();this.tagName=tag.toUpperCase();this.ownerDocument=ownerDocument;
      this.parentNode=null;this.childNodes=[];this.attributes=new Map();this.style={};this.value='';this._text='';this.hidden=false;this.disabled=false;
      this.classList={contains:c=>this.className.split(/\s+/).includes(c),
        add:(...cs)=>{this.className=[...new Set(this.className.split(/\s+/).filter(Boolean).concat(cs))].join(' ');},
        remove:(...cs)=>{this.className=this.className.split(/\s+/).filter(c=>c&&!cs.includes(c)).join(' ');},
        toggle:(c,on)=>{on=on??!this.classList.contains(c);this.classList[on?'add':'remove'](c);return on;}};
      if(tag==='iframe'){this.mounts=0;frames.push(this);}
    }
    get children(){return this.childNodes.filter(n=>n.tagName!=='#TEXT');}
    get parentElement(){return this.parentNode instanceof Element?this.parentNode:null;}
    get firstChild(){return this.childNodes[0]||null;}
    get lastChild(){return this.childNodes.at(-1)||null;}
    get isConnected(){let p=this;while(p.parentNode)p=p.parentNode;return p instanceof Document;}
    scrollIntoView(options){this.ownerDocument.scrolledElement=this;this.ownerDocument.scrollOptions=options;}
    get id(){return this.getAttribute('id')||'';}set id(v){this.setAttribute('id',v);}
    get src(){return this.getAttribute('src')||'';}set src(v){this.setAttribute('src',v);}
    get className(){return this.getAttribute('class')||'';}set className(v){this.setAttribute('class',v);}
    get textContent(){return this._text+this.childNodes.map(n=>n.textContent).join('');}
    set textContent(v){for(const n of [...this.childNodes])this.removeChild(n);this._text=String(v);}
    get innerHTML(){throw new Error('Harness does not serialize HTML; assert DOM behavior instead.');}
    set innerHTML(html){
      this.textContent='';const stack=[this],voids=new Set(['input','br','hr','meta','link','img']);
      for(const token of String(html).match(/<[^>]+>|[^<]+/g)||[]){
        if(token.startsWith('</')){stack.pop();continue;}
        if(token.startsWith('<')){
          const match=/^<([\w-]+)([\s\S]*?)\/?\s*>$/.exec(token);if(!match)continue;
          const [,tag,attrs]=match,node=this.ownerDocument.createElement(tag);
          for(const m of attrs.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g))node.setAttribute(m[1],decode(m[2]??m[3]??m[4]??''));
          stack.at(-1).appendChild(node);if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(node);
        }else{const node=new Element('#text',this.ownerDocument);node._text=decode(token);stack.at(-1).appendChild(node);}
      }
    }
    setAttribute(k,v){this.attributes.set(k,String(v));if(k==='hidden')this.hidden=true;if(k==='disabled')this.disabled=true;if(k==='src'&&this.tagName==='IFRAME'&&this.isConnected)mount(this);}
    getAttribute(k){return this.attributes.get(k)??null;}
    hasAttribute(k){return this.attributes.has(k);}
    removeAttribute(k){this.attributes.delete(k);if(k==='hidden')this.hidden=false;if(k==='disabled')this.disabled=false;}
    appendChild(node){
      if(node.parentNode)node.parentNode.removeChild(node);this.childNodes.push(node);node.parentNode=this;
      for(const frame of [node,...node.querySelectorAll('iframe')].filter(n=>n.tagName==='IFRAME'))if(frame.isConnected)mount(frame);
      return node;
    }
    removeChild(node){const i=this.childNodes.indexOf(node);if(i<0)throw new Error('Not a child');this.childNodes.splice(i,1);node.parentNode=null;return node;}
    remove(){this.parentNode?.removeChild(this);}
    after(node){const p=this.parentNode;if(!p)return;if(node.parentNode)node.parentNode.removeChild(node);p.childNodes.splice(p.childNodes.indexOf(this)+1,0,node);node.parentNode=p;}
    contains(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;}
    matches(selector){
      if(selector.includes(' ')){const parts=selector.trim().split(/\s+/);if(!this.matches(parts.pop()))return false;let parent=this.parentElement;
        while(parts.length){const part=parts.pop();while(parent&&!parent.matches(part))parent=parent.parentElement;if(!parent)return false;parent=parent.parentElement;}return true;}
      const m=/^(?:(#[\w-]+)|(\.[\w-]+)|([\w-]+))?(?:\[([\w-]+)(?:=['"]?([^'"\]]+)['"]?)?\])?$/.exec(selector);
      if(!m)throw new Error('Unsupported selector in harness: '+selector);
      return (!m[1]||this.id===m[1].slice(1))&&(!m[2]||this.classList.contains(m[2].slice(1)))&&(!m[3]||this.tagName===m[3].toUpperCase())&&(!m[4]||(this.hasAttribute(m[4])&&(m[5]===undefined||this.getAttribute(m[4])===m[5])));
    }
    querySelectorAll(selector){const found=[];for(const child of this.children){if(child.matches(selector))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    closest(selector){for(let n=this;n instanceof Element;n=n.parentNode)if(n.matches(selector))return n;return null;}
    focus(){this.ownerDocument.activeElement=this;}
    click(){if(this.disabled)return;const e=this.fire('click');if(!e.defaultPrevented&&this.tagName==='BUTTON'&&(this.type||this.getAttribute('type')||'submit')==='submit')this.closest('form')?.fire('submit');}
    getBoundingClientRect(){return {height:0,top:0,bottom:0};}
  }
  class Document extends Events {
    constructor(url){super();this.location=new URL(url);this.documentElement=new Element('html',this);this.documentElement.parentNode=this;
      this.head=new Element('head',this);this.body=new Element('body',this);this.documentElement.appendChild(this.head);this.documentElement.appendChild(this.body);this.activeElement=this.body;}
    createElement(tag){return new Element(tag,this);}
    getElementById(id){return this.documentElement.id===id?this.documentElement:this.documentElement.querySelector('#'+id);}
    querySelectorAll(s){return this.documentElement.querySelectorAll(s);}
    querySelector(s){return this.documentElement.querySelector(s);}
  }
  function mount(frame){
    // Detached-and-reinserted iframes get a new context, like browser frames.
    frame.mounts++;frame.contentDocument=new Document('about:blank');frame.contentWindow={location:new URL('about:blank')};
  }
  class MutationObserver {
    constructor(fn){this.fn=fn;this.active=false;observers.push(this);}
    observe(target,options){this.target=target;this.options=options;this.active=true;}
    disconnect(){this.active=false;}
  }
  const document=new Document(href);document.body.setAttribute('data-reg','bee');
  const bar=position===null?null:document.createElement('nav');
  if(bar){bar.id='tbar';bar.getBoundingClientRect=()=>({height:barHeight,top:height-barHeight,bottom:height});document.body.appendChild(bar);}
  const window=new Events(),copies=[],copyRequests=[];
  const navigator=clipboard==='absent'?{}:{clipboard:{writeText(text){copies.push(text);if(clipboard==='throw')throw new Error('clipboard threw');
    if(clipboard==='deferred')return new Promise((resolve,reject)=>copyRequests.push({text,resolve,reject}));
    return clipboard==='blocked'?Promise.reject(new Error('clipboard denied')):Promise.resolve();}}};
  Object.assign(window,{document,location:document.location,innerHeight:height,innerWidth:width,navigator,URL,MutationObserver,
    ResizeObserver:class {observe(){}},matchMedia:()=>({matches:true}),setTimeout,clearTimeout,
    getComputedStyle:el=>({position:el===bar?position:'static',paddingBottom:el.style.paddingBottom||'0'}),
    visualViewport:viewport?Object.assign(new Events(),viewport):null});
  window.window=window;window.addEventListener=window.addEventListener.bind(window);
  vm.runInNewContext(source,window,{filename:'surfaces/agent-dock.js'});
  const $=id=>document.getElementById(id),chip=id=>$('adAgents').querySelectorAll('.adAg').find(el=>el.getAttribute('data-agent')===id);
  function load(frame,{url=new URL(frame.src,href).href,ask='ok',missingInput=false,missingChat=false}={}){
    const d=new Document(url),isQueen=url.includes('bqueenbee-live'),calls=[],suspensions=[];
    d.body.innerHTML=isQueen?'<header>Standalone header</header><main><section><h2>Identity</h2></section><section><h2>Ask</h2><div id="chat"></div><div id="quick"></div><div id="ask"><input id="q"><button id="micb">Microphone</button><button id="autov">Auto voice</button><button>Ask</button></div><div id="tongues"></div></section></main><nav id="tbar"></nav>':'<header>Standalone header</header><div id="chat"></div><div id="seeds"></div><div id="ask"><input id="q"><button id="send">Send</button></div><div class="note">Engine description</div><nav id="tbar"></nav>';
    if(missingInput)d.getElementById('q').remove();if(missingChat)d.getElementById('chat').remove();
    const scrolls=[],w={location:d.location,document:d,calls,suspensions,scrollTo:(...args)=>scrolls.push(args),bnrDockSuspend:inactive=>suspensions.push(inactive)};
    if(ask!=='absent')w.ask=()=>{if(ask==='throw')throw new Error('engine refused');const q=d.getElementById('q');calls.push(q.value);const message=d.createElement('div');message.className='msg';message.textContent=q.value;d.getElementById('chat')?.appendChild(message);q.value='';};
    frame.contentDocument=d;frame.contentWindow=w;frame.fire('load',{bubbles:false});return {document:d,window:w,calls,suspensions,scrolls};
  }
  return {window,document,frames,observers,copies,copyRequests,$,chip,load,orb:$('adOrb'),win:$('adWin'),body:document.body,
    open(){$('adOrb').click();},choose(id){chip(id).click();},
    type(text){$('adPrompt').value=text;$('adPrompt').fire('input');},
    submit(text){if(text!==undefined)this.type(text);return $('adFoot').fire('submit');},
    key(key,props={},target=document){return target.fire('keydown',{key,altKey:false,shiftKey:false,isComposing:false,...props});},
    flushMutations(target){for(const o of [...observers])if(o.active&&(o.target===target||o.options.subtree&&o.target.contains(target)))o.fn([]);}
  };
}
const frameFor=(d,id)=>d.frames.find(f=>f.title.startsWith(id==='queen'?'bQueenBee':'heARTh'));
const activePanel=d=>d.$('adBody').children.find(el=>el.classList.contains('adSession')&&!el.hidden);
const nextTick=()=>new Promise(resolve=>setImmediate(resolve));

test('frames mount lazily, retain their browsing contexts, and are never detached by switching',()=>{
  const d=dock();assert.equal(d.frames.length,0);d.open();
  assert.equal(d.frames.length,1);const queen=frameFor(d,'queen'),q=d.load(queen);d.submit('Queen conversation');
  d.choose('hearth');assert.equal(d.frames.length,2);const hearth=frameFor(d,'hearth'),h=d.load(hearth);d.submit('Hearth conversation');
  for(const id of ['queen','queen','baigents','bloverai','hearth','queen'])d.choose(id);
  assert.equal(d.frames.length,2);assert.equal(queen.contentWindow,q.window);assert.equal(hearth.contentWindow,h.window);
  assert.equal(queen.mounts,1);assert.equal(hearth.mounts,1);assert.equal(queen.isConnected,true);assert.equal(hearth.isConnected,true);
  assert.deepEqual(q.calls,['Queen conversation']);assert.deepEqual(h.calls,['Hearth conversation']);
  assert.match(q.document.getElementById('chat').textContent,/Queen conversation/);
  assert.match(h.document.getElementById('chat').textContent,/Hearth conversation/);
  assert.equal(queen.parentNode.hidden,false);assert.equal(hearth.parentNode.hidden,true);
});

test('each agent keeps its own unsent draft through switches and closing',()=>{
  const d=dock();d.open();d.type('Queen unfinished');d.choose('hearth');assert.equal(d.$('adPrompt').value,'');
  d.type('Hearth unfinished');d.choose('bloverai');d.type('Handoff unfinished');d.choose('queen');assert.equal(d.$('adPrompt').value,'Queen unfinished');
  d.$('adClose').click();d.open();assert.equal(d.$('adPrompt').value,'Queen unfinished');
  d.choose('hearth');assert.equal(d.$('adPrompt').value,'Hearth unfinished');d.choose('bloverai');assert.equal(d.$('adPrompt').value,'Handoff unfinished');
});

test('the shared composer delivers full text to both validated engine interfaces',()=>{
  const d=dock();d.open();const queen=d.load(frameFor(d,'queen'));
  const long='happy apple application '+('🌱 a long question '.repeat(30))+'END';d.submit(long);
  assert.deepEqual(queen.calls,[long]);assert.equal(d.$('adPrompt').value,'');assert.match(d.$('adStatus').textContent,/received by bQueenBee/);
  d.choose('hearth');const hearth=d.load(frameFor(d,'hearth'));d.type('grow a happy apple mushroom');d.$('adSend').click();
  assert.deepEqual(hearth.calls,['grow a happy apple mushroom']);assert.equal(d.$('adPrompt').value,'');
});

test('both hosting prefixes resolve the expected same-origin agent URL',()=>{
  for(const href of ['https://bnr.test/surfaces/index.html','https://bnr.test/beehive-nature/surfaces/index.html']){
    const d=dock({href});d.open();const f=frameFor(d,'queen'),engine=d.load(f);d.submit('Who are you?');
    assert.deepEqual(engine.calls,['Who are you?']);assert.equal(new URL(f.src,href).pathname,href.includes('/beehive-nature/')?'/beehive-nature/surfaces/bqueenbee-live.html':'/surfaces/bqueenbee-live.html');
  }
});

test('not-ready submissions retain the draft and recover after an explicit load',()=>{
  const d=dock();d.open();assert.equal(d.$('adSend').disabled,true);d.submit('Keep my question');
  assert.equal(d.$('adPrompt').value,'Keep my question');assert.equal(d.$('adStatus').getAttribute('data-error'),'true');
  d.choose('hearth');d.choose('queen');assert.equal(d.$('adPrompt').value,'Keep my question');
  const engine=d.load(frameFor(d,'queen'));assert.equal(d.$('adSend').disabled,false);d.$('adSend').click();assert.deepEqual(engine.calls,['Keep my question']);
});

test('a throwing engine preserves the draft, identifies the failure and never claims receipt',()=>{
  const d=dock();d.open();const engine=d.load(frameFor(d,'queen'),{ask:'throw'});d.submit('Do not lose this');
  assert.deepEqual(engine.calls,[]);assert.equal(d.$('adPrompt').value,'Do not lose this');assert.match(d.$('adStatus').textContent,/could not accept/);
  assert.equal(d.$('adStatus').getAttribute('data-error'),'true');d.choose('hearth');d.choose('queen');assert.equal(d.$('adPrompt').value,'Do not lose this');
});

test('unexpected live location or inaccessible frame blocks sending despite an unchanged src',()=>{
  for(const change of ['origin','path','denied']){
    const d=dock();d.open();const frame=frameFor(d,'queen'),engine=d.load(frame),src=frame.src;
    if(change==='denied')Object.defineProperty(frame,'contentWindow',{get(){throw new Error('cross-origin access denied');}});
    else engine.window.location=new URL(change==='origin'?'https://elsewhere.test/surfaces/bqueenbee-live.html':'https://bnr.test/surfaces/gallery.html');
    d.submit('Must remain here');assert.equal(frame.src,src);assert.deepEqual(engine.calls,[]);assert.equal(d.$('adPrompt').value,'Must remain here');assert.match(d.$('adStatus').textContent,/not sent/);
  }
});

test('missing q or ask leaves a frame unavailable without consuming a draft',()=>{
  for(const options of [{missingInput:true},{ask:'absent'}]){
    const d=dock();d.open();const engine=d.load(frameFor(d,'queen'),options);assert.equal(d.$('adSend').disabled,true);
    d.submit('Still waiting');assert.equal(d.$('adPrompt').value,'Still waiting');assert.deepEqual(engine.calls,[]);
  }
});

test('Help and explicit help/install commands retain loaded conversations and handoffs',()=>{
  const d=dock();d.open();const frame=frameFor(d,'queen'),engine=d.load(frame);d.submit('Existing conversation');d.type('Draft stays');
  d.$('adHelpButton').click();assert.equal(d.$('adHelp').hidden,false);assert.equal(d.$('adFoot').hidden,true);assert.equal(d.$('adPrompt').value,'Draft stays');
  d.$('adHelpButton').click();assert.equal(d.$('adPrompt').value,'Draft stays');
  for(const command of ['/help','/install']){d.submit(command);assert.equal(d.$('adHelp').hidden,false);d.$('adHelpButton').click();}
  assert.equal(frame.contentWindow,engine.window);assert.equal(frame.mounts,1);assert.deepEqual(engine.calls,['Existing conversation']);
  d.choose('bloverai');d.submit('A prepared question');const handoff=activePanel(d).querySelector('pre').textContent;d.submit('/help');d.$('adHelpButton').click();assert.equal(activePanel(d).querySelector('pre').textContent,handoff);
});

test('bAigents is status-only and cannot consume a draft or reach another agent',()=>{
  const d=dock();d.open();const engine=d.load(frameFor(d,'queen'));d.type('Queen draft');d.choose('baigents');
  assert.equal(d.$('adFoot').hidden,true);assert.match(activePanel(d).textContent,/does not accept a message/);
  d.type('No endpoint');d.submit();assert.equal(d.$('adPrompt').value,'No endpoint');assert.deepEqual(engine.calls,[]);
  d.choose('queen');assert.equal(d.$('adPrompt').value,'Queen draft');
});

test('handoffs contain only their own messages, preserve literal text and copy the prepared result',async()=>{
  const d=dock();d.open();d.load(frameFor(d,'queen'));d.submit('Private Queen question');d.choose('hearth');d.load(frameFor(d,'hearth'));d.submit('Hearth-only question');
  d.choose('bloverai');d.submit('First <script>literal</script> & question');d.submit('Second question');const panel=activePanel(d),text=panel.querySelector('pre').textContent;
  assert.match(text,/First <script>literal<\/script> & question/);assert.match(text,/Second question/);assert.doesNotMatch(text,/Private Queen|Hearth-only/);assert.equal(panel.querySelector('script'),null);
  panel.querySelector('.adCopy').click();await nextTick();assert.deepEqual(d.copies,[text]);assert.match(d.$('adStatus').textContent,/copied/);
  d.choose('queen');d.choose('bloverai');assert.equal(activePanel(d).querySelector('pre').textContent,text);
});

test('unavailable or rejected clipboard leaves a selectable handoff and reports failure',async()=>{
  for(const clipboard of ['absent','blocked']){
    const d=dock({clipboard});d.open();d.choose('bloverai');d.submit('Keep this handoff');const panel=activePanel(d),pre=panel.querySelector('pre');
    panel.querySelector('.adCopy').click();await nextTick();assert.equal(panel.querySelector('pre'),pre);assert.match(pre.textContent,/Keep this handoff/);
    assert.match(d.$('adStatus').textContent,/unavailable|blocked/);assert.equal(d.$('adStatus').getAttribute('data-error'),'true');
  }
});

test('Enter sends once; Shift+Enter and IME Enter never submit',()=>{
  const d=dock();d.open();const engine=d.load(frameFor(d,'queen'));d.type('Composing');
  for(const props of [{shiftKey:true},{isComposing:true},{keyCode:229}]){const e=d.key('Enter',props,d.$('adPrompt'));assert.equal(e.defaultPrevented,false);}
  assert.deepEqual(engine.calls,[]);assert.equal(d.$('adPrompt').value,'Composing');
  const e=d.key('Enter',{},d.$('adPrompt'));assert.equal(e.defaultPrevented,true);assert.deepEqual(engine.calls,['Composing']);
});

test('Escape and Alt shortcuts work from the outer document and loaded child documents',()=>{
  const d=dock();let e=d.key('/',{altKey:true});assert.equal(e.defaultPrevented,true);assert.equal(d.orb.getAttribute('aria-expanded'),'true');assert.equal(d.document.activeElement,d.$('adPrompt'));
  const queen=d.load(frameFor(d,'queen'));e=d.key('2',{altKey:true},queen.document);assert.equal(e.defaultPrevented,true);assert.equal(d.chip('hearth').getAttribute('aria-pressed'),'true');
  const hearth=d.load(frameFor(d,'hearth'));e=d.key('Escape',{},hearth.document);assert.equal(e.defaultPrevented,true);assert.equal(d.orb.getAttribute('aria-expanded'),'false');assert.equal(d.document.activeElement,d.orb);
  d.key('h',{altKey:true});assert.equal(d.orb.getAttribute('aria-expanded'),'true');d.key('4',{altKey:true});assert.equal(d.chip('bloverai').getAttribute('aria-pressed'),'true');
  d.key('1',{altKey:true,isComposing:true});assert.equal(d.chip('bloverai').getAttribute('aria-pressed'),'true');
});

test('close, help, agent switches and pagehide suspend the inactive engine',()=>{
  const d=dock();d.open();const queen=d.load(frameFor(d,'queen'));assert.equal(queen.suspensions.at(-1),false);
  d.$('adHelpButton').click();assert.equal(queen.suspensions.at(-1),true);d.$('adHelpButton').click();assert.equal(queen.suspensions.at(-1),false);
  d.choose('hearth');assert.equal(queen.suspensions.at(-1),true);const hearth=d.load(frameFor(d,'hearth'));assert.equal(hearth.suspensions.at(-1),false);
  d.$('adClose').click();assert.equal(hearth.suspensions.at(-1),true);d.open();assert.equal(hearth.suspensions.at(-1),false);
  d.window.fire('pagehide');assert.equal(queen.suspensions.at(-1),true);assert.equal(hearth.suspensions.at(-1),true);
});

test('skin changes update visible and retained frames without rebuilding conversations or tools',()=>{
  const d=dock();d.open();const q=d.load(frameFor(d,'queen'));d.submit('Keep Queen history');d.choose('hearth');const h=d.load(frameFor(d,'hearth'));
  for(const reg of ['raver','cypherpunk','bee']){d.body.setAttribute('data-reg',reg);d.document.fire('bregister');
    for(const engine of [q,h]){assert.equal(engine.document.documentElement.getAttribute('data-ad-view'),reg);assert.equal(engine.document.body.getAttribute('data-reg'),reg);assert.equal(engine.document.querySelectorAll('.adTools').length,1);assert.equal(engine.document.getElementById('chat').getAttribute('role'),'log');}}
  assert.deepEqual(q.calls,['Keep Queen history']);assert.equal(frameFor(d,'queen').mounts,1);assert.equal(frameFor(d,'hearth').mounts,1);
});

test('new conversation links acquire safe targets and labels while same-page anchors remain local',()=>{
  const d=dock();d.open();const q=d.load(frameFor(d,'queen')),chat=q.document.getElementById('chat');
  chat.innerHTML='<a href="blight/gallery.html">Gallery</a><a href="https://github.com/beehive-nature/beehive-nature">Source</a><a href="#chat">This chat</a>';
  d.flushMutations(chat);d.flushMutations(chat);const links=chat.querySelectorAll('a');
  for(const link of links.slice(0,2)){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.equal(link.querySelectorAll('.adLinkNote').length,1);assert.match(link.textContent,/new tab/);}
  assert.equal(links[2].target,undefined);assert.equal(links[2].querySelector('.adLinkNote'),null);assert.equal(frameFor(d,'queen').contentWindow,q.window);
});

test('the tall in-flow footer cannot push the launcher above the viewport',()=>{
  const {orb,win,body}=dock();assert.equal(orb.style.bottom,'18px');assert.equal(body.style.paddingBottom,undefined);
  assert.ok(650-parseFloat(win.style.bottom)-parseFloat(win.style.height)>=12);
});
test('a visible fixed toolbar gets clearance; the legacy fail-safe remains',()=>{
  const fixed=dock({position:'fixed',barHeight:60});assert.equal(fixed.orb.style.bottom,'70px');assert.equal(fixed.body.style.paddingBottom,'82px');
  assert.equal(dock({position:null}).orb.style.bottom,'66px');assert.equal(dock({position:'fixed',barHeight:0}).body.style.paddingBottom,undefined);
});
test('large toolbars, short screens, mobile widths and keyboard viewports keep the dock bounded',()=>{
  for(const height of [320,650,900])for(const width of [390,1100]){
    const d=dock({height,width,position:'fixed',barHeight:height*.8});
    assert.ok(height-parseFloat(d.orb.style.bottom)-52>=12);assert.ok(height-parseFloat(d.win.style.bottom)-parseFloat(d.win.style.height)>=11.9);
    assert.ok(parseFloat(d.win.style.height)>height*.5);d.$('adExpand').click();assert.equal(d.$('adExpand').getAttribute('aria-pressed'),'true');assert.ok(height-parseFloat(d.win.style.bottom)-parseFloat(d.win.style.height)>=11.9);
  }
  const d=dock({height:800,viewport:{height:360,offsetTop:0}});assert.equal(d.orb.style.bottom,'458px');assert.equal(800-parseFloat(d.win.style.bottom)-parseFloat(d.win.style.height),12);
});

test('a stale clipboard success identifies its older handoff and a stale failure cannot replace new status',async()=>{
  for(const outcome of ['resolve','reject']){
    const d=dock({clipboard:'deferred'});d.open();d.choose('bloverai');d.submit('First question');activePanel(d).querySelector('.adCopy').click();
    d.submit('Second question');const current=activePanel(d).querySelector('pre').textContent;
    d.copyRequests[0][outcome](outcome==='reject'?new Error('late failure'):undefined);await nextTick();
    assert.equal(activePanel(d).querySelector('pre').textContent,current);
    if(outcome==='resolve')assert.match(d.$('adStatus').textContent,/earlier handoff|previous handoff/);
    else{assert.match(d.$('adStatus').textContent,/prepared/);assert.equal(d.$('adStatus').getAttribute('data-error'),'false');}
  }
});

test('a newer copy attempt owns the visible result even when an older attempt settles later',async()=>{
  const d=dock({clipboard:'deferred'});d.open();d.choose('bloverai');d.submit('First question');activePanel(d).querySelector('.adCopy').click();
  d.submit('Latest question');activePanel(d).querySelector('.adCopy').click();d.copyRequests[1].resolve();await nextTick();
  const latestStatus=d.$('adStatus').textContent;assert.match(latestStatus,/copied/);d.copyRequests[0].resolve();await nextTick();
  assert.equal(d.$('adStatus').textContent,latestStatus);assert.match(d.copies[1],/Latest question/);
});

test('synchronous clipboard failure preserves the prepared handoff with recovery text',()=>{
  const d=dock({clipboard:'throw'});d.open();d.choose('bloverai');d.submit('Copy me');const panel=activePanel(d),pre=panel.querySelector('pre');
  assert.doesNotThrow(()=>panel.querySelector('.adCopy').click());assert.equal(panel.querySelector('pre'),pre);assert.equal(d.$('adStatus').getAttribute('data-error'),'true');assert.match(d.$('adStatus').textContent,/blocked|unavailable|could not/);
});

test('changing skins preserves a send failure and does not scroll an existing conversation away',()=>{
  const d=dock();d.open();const q=d.load(frameFor(d,'queen'),{ask:'throw'});assert.deepEqual(q.scrolls,[[0,0]]);
  d.submit('Keep my failed draft');const failure=d.$('adStatus').textContent;d.body.setAttribute('data-reg','raver');d.document.fire('bregister');
  assert.equal(d.$('adStatus').textContent,failure);assert.equal(d.$('adPrompt').value,'Keep my failed draft');assert.equal(d.$('adStatus').getAttribute('data-error'),'true');assert.deepEqual(q.scrolls,[[0,0]]);
  d.choose('hearth');d.choose('queen');assert.equal(d.$('adStatus').textContent,failure);assert.deepEqual(q.scrolls,[[0,0]]);
});

function between(text,start,end){const first=text.indexOf(start),last=text.indexOf(end,first+start.length);assert.notEqual(first,-1,'Source start marker exists');assert.notEqual(last,-1,'Source end marker exists');return text.slice(first,last);}
const queenSource=readFileSync(new URL('../surfaces/bqueenbee-live.html',import.meta.url),'utf8');
const hearthSource=readFileSync(new URL('../surfaces/blight/hearth.html',import.meta.url),'utf8');

test('the shipped Queen speech hook aborts capture, ignores hidden results and preserves voice preferences',()=>{
  const d=dock();d.open();const engine=d.load(frameFor(d,'queen')),recognizers=[],spoken=[];let cancels=0;
  const speechSynthesis={getVoices:()=>[{lang:'en-US'}],cancel(){cancels++;},speak:u=>spoken.push(u)};
  class Recognition{constructor(){this.aborts=0;this.starts=0;recognizers.push(this);}start(){this.starts++;}stop(){this.onend?.();}abort(){this.aborts++;this.onend?.();}}
  const context={document:engine.document,navigator:{language:'en-US'},$:(id)=>engine.document.getElementById(id),SpeechRecognition:Recognition,speechSynthesis,
    SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speakText:text=>text,pickVoice:()=>({lang:'en-US'}),ask:engine.window.ask};context.window=context;
  vm.runInNewContext(between(queenSource,'var DOCK_SUSPENDED=','function buildTongues()'),context);
  context.micTap();assert.equal(recognizers.length,1);assert.equal(context.VOICE.auto,true);context.VOICE.lang='lv';
  context.bnrDockSuspend(true);assert.equal(recognizers[0].aborts,1);assert.equal(context.SRon,false);assert.equal(context.VOICE.auto,true);assert.equal(context.VOICE.lang,'lv');assert.equal(engine.document.getElementById('micb').getAttribute('aria-pressed'),'false');
  recognizers[0].onresult({results:[[{transcript:'late hidden words'}]]});context.speakLang('hidden reply','en');context.micTap();assert.deepEqual(engine.calls,[]);assert.equal(spoken.length,0);assert.equal(recognizers.length,1);assert.ok(cancels>0);
  context.bnrDockSuspend(false);context.speakLang('visible reply','en');assert.equal(spoken.length,1);context.micTap();assert.equal(recognizers.length,2);
  recognizers[1].onresult({results:[[{transcript:'a visible question'}]]});assert.deepEqual(engine.calls,['a visible question']);
});

test('the shipped Queen legacy bridge rejects foreign senders, invalid payloads and oversized prompts',()=>{
  const script=[...queenSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('__dockBridge'));assert.ok(script);
  const d=dock();d.open();const engine=d.load(frameFor(d,'queen')),listeners=[],parent={};
  const context={parent,location:engine.document.location,document:engine.document,ask:engine.window.ask,addEventListener:(type,fn)=>{assert.equal(type,'message');listeners.push(fn);},setTimeout:fn=>fn()};context.window=context;
  vm.runInNewContext(script,context);vm.runInNewContext(script,context);assert.equal(listeners.length,1);
  const send=(data,props={})=>listeners[0]({data,source:parent,origin:context.location.origin,...props});
  for(const data of [null,{dockPrompt:42},{dockPrompt:''},{dockPrompt:'   '},{dockPrompt:'x'.repeat(4001)}])send(data);
  send({dockPrompt:'foreign origin'},{origin:'https://elsewhere.test'});send({dockPrompt:'foreign sender'},{source:{}});assert.deepEqual(engine.calls,[]);
  const long='Full prompt '+('🌱'.repeat(500));send({dockPrompt:long});assert.deepEqual(engine.calls,[long]);
  context.parent=context;send({dockPrompt:'standalone spoof'},{source:context});assert.deepEqual(engine.calls,[long]);
});

test('the shipped Hearth keeps hidden song text while stopping and releasing its audio contexts',async()=>{
  const script=[...hearthSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('HEARTH_SUSPENDED'));assert.ok(script);
  const d=dock();d.open();d.choose('hearth');const engine=d.load(frameFor(d,'hearth')),audio=[];
  class AudioContext{
    constructor(){this.state='running';this.currentTime=0;this.destination={};this.oscillators=[];this.closes=0;audio.push(this);}
    close(){this.closes++;this.state='closed';return Promise.resolve();}
    createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this;}};}
    createOscillator(){const osc={frequency:{},connect:g=>g,start(){},stop(){}};this.oscillators.push(osc);return osc;}
  }
  const context={document:engine.document,location:engine.document.location,AudioContext,scrollTo(){throw new Error('Scrolling to the page bottom can hide the reply behind suggestions');},setTimeout,clearTimeout,AbortController,fetch:()=>Promise.reject(new Error('Network is not part of this test'))};context.window=context;
  vm.runInNewContext(script,context);await context.respond('play a blues song');assert.equal(audio.length,1);assert.equal(audio[0].oscillators.length,8);
  context.bnrDockSuspend(true);assert.equal(audio[0].state,'closed');assert.equal(audio[0].closes,1);
  const before=engine.document.getElementById('chat').children.length;await context.respond('play another song');assert.equal(audio.length,1);assert.equal(engine.document.getElementById('chat').children.length,before+1);
  context.bnrDockSuspend(false);await context.respond('play another song');assert.equal(audio.length,2);audio[1].oscillators.at(-1).onended();assert.equal(audio[1].closes,1);
  context.bnrDockSuspend(true);assert.equal(audio[1].closes,1);await nextTick();
  await context.respond('What can you do?');
  assert.equal(engine.document.scrolledElement,engine.document.getElementById('chat').lastChild);
  assert.equal(engine.document.scrollOptions.block,'start');
  assert.match(engine.document.scrolledElement.textContent,/route creative prompts/);
});
