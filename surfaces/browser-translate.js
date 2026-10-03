/* browser-translate.js — the READER's browser translates the page's visible prose.
   WEBML raid slice S1 (docs/raids/WEBML-SORT-2026-09-30.md §8), founder order 2026-09-30
   "get it all done". Shipped on surfaces/index.html only; other surfaces adopt by
   adding the script tag.
   LAWS THIS FILE OBEYS (WEBML-SORT §8-S1, §9):
   - enhancement-only: no Translator API in the browser → no button, no wall, no dead
     affordance (onboarding law);
   - the estate's keyed floors stay ABSOLUTE: nothing is written to any store and the
     corpus is never touched — this is a reader-side DOM effect, one click, reversible,
     and a reload resets it (the estate's own words are always the source);
   - the estate authors ZERO new visible strings: icon-only button, the browser's own
     words (Intl.DisplayNames) in aria-label/title only; #brtrctl is census chrome
     beside #blangctl (lang.js measureVisibleText chrome list);
   - VENDOR-HELD, never called local/private: the spec allows cloud implementations and
     the language pack rides the browser's own wire (translation-api explainer, A98);
   - direction stays the page's — visual mirroring is the design seat's D-13 lane. */
(function(root){
  'use strict';
  var state={pair:null,on:false,busy:false,btn:null,wrap:null,translator:null,originals:[]};
  function unmount(){ if(state.wrap){ state.wrap.remove(); state.wrap=null; } state.btn=null; }
  function base(code){ return String(code||'en').split('-')[0].toLowerCase(); }
  function targetName(code){
    try{ return new Intl.DisplayNames([code],{type:'language'}).of(code); }
    catch(e){ return code; }
  }
  function label(kind){
    var name=targetName(state.pair&&state.pair.target||'');
    if(kind==='back')  return '✓ '+name+' — show the estate\'s own words';
    if(kind==='work')  return 'translating (the browser may fetch its language pack)…';
    return 'browser translate → '+name+' (unofficial, machine)';
  }
  function readerTongue(){
    var n=root.navigator||{};
    return base(n.languages&&n.languages[0]||n.language||'en');
  }
  function pair(){
    var source=base(document.documentElement.lang||'en'), target=readerTongue();
    return target===source?null:{source:source,target:target};
  }
  function leaves(){
    var scope=document.querySelector('main')||document.body;
    var skip={SCRIPT:1,STYLE:1,NOSCRIPT:1,CANVAS:1,SVG:1,PATH:1,OPTION:1,SELECT:1,TEXTAREA:1};
    var out=[],stack=[scope];
    while(stack.length){
      var el=stack.pop();
      for(var i=0;i<el.children.length;i++) stack.push(el.children[i]);
      if(el===scope||skip[el.tagName]||el.children.length) continue;
      if(el.closest('#brtrctl,[translate="no"],[data-language-host],[data-i18n],[data-key],[data-say]')) continue;
      var text=(el.textContent||'').trim();
      if(!/\p{L}/u.test(text)) continue;
      out.push(el);
    }
    return out;
  }
  function restore(){
    state.originals.forEach(function(rec){ rec.el.textContent=rec.was; });
    state.originals=[]; state.on=false;
    if(state.btn){ state.btn.setAttribute('aria-pressed','false'); state.btn.title=label('go'); }
  }
  async function translateAll(){
    var nodes=leaves();
    state.originals=nodes.map(function(el){ return {el:el,was:el.textContent}; });
    var i=0;
    async function one(){
      while(i<state.originals.length){
        var rec=state.originals[i++];
        rec.el.textContent=await state.translator.translate(rec.was);
      }
    }
    await Promise.all([one(),one(),one(),one()]);
  }
  async function onPress(){
    if(state.busy) return;
    if(state.on){ restore(); return; }
    state.busy=true; state.btn.setAttribute('aria-busy','true'); state.btn.title=label('work');
    try{
      if(!state.translator)
        state.translator=await root.Translator.create({sourceLanguage:state.pair.source,targetLanguage:state.pair.target});
      await translateAll();
      state.on=true; state.btn.setAttribute('aria-pressed','true'); state.btn.title=label('back');
    }catch(e){
      restore(); unmount();
      /* honest degrade: the offer disappears, the page is unchanged, nothing is said loudly */
      try{ root.console&&console.info('browser-translate: unavailable ('+(e&&e.message||e)+')'); }catch(_){}
    }finally{
      state.busy=false; if(state.btn) state.btn.setAttribute('aria-busy','false');
    }
  }
  function buildButton(){
    var b=document.createElement('button');
    b.type='button'; b.id='brtrbtn'; b.textContent='🌐';
    /* same pinned-properties pattern as lang.js #blangctl: an inline style only wins the
       properties it SETS, so every layout property a bare page button{} rule could reach
       is pinned here — no page rule stretches this control. */
    b.style.cssText='background:#0d1410;color:#8a9a8a;border:1px solid #243026;'
      +'border-radius:8px;font:13px ui-sans-serif,system-ui,sans-serif;cursor:pointer;'
      +'padding:0 8px;margin:0;min-height:44px;height:44px;min-width:44px;box-sizing:border-box;flex-shrink:0';
    b.setAttribute('aria-pressed','false'); b.setAttribute('aria-label',label('go'));
    b.title=label('go');
    b.addEventListener('click',onPress);
    return b;
  }
  async function mount(){
    if(!('Translator' in root)||typeof root.Translator.create!=='function') return;
    if(state.wrap) return;
    var host=document.querySelector('[data-language-host]')||document.getElementById('blangctl');
    if(!host) return;
    state.pair=pair();
    if(!state.pair) return; /* the page already speaks the reader's tongue */
    try{
      var avail=await root.Translator.availability({sourceLanguage:state.pair.source,targetLanguage:state.pair.target});
      if(!avail||avail==='unavailable') return; /* this browser cannot make the pair — no button */
    }catch(e){ return; }
    var wrap=document.createElement('span'); wrap.id='brtrctl';
    wrap.style.cssText='display:inline-flex;margin:0;padding-left:6px;'
      +'border-left:1px solid #243026;min-height:0;height:auto;box-sizing:border-box';
    state.wrap=wrap; state.btn=buildButton();
    wrap.appendChild(state.btn);
    host.appendChild(wrap);
  }
  document.addEventListener('blang',function(){
    /* the estate's own picker moved the page's tongue: undo any browser layer first
       (never translate a translation), then re-offer against the new source */
    restore();
    state.translator=null; state.pair=null;
    unmount();
    mount();
  });
  root.BNRBrowserTranslate={version:'2',state:state,mount:mount};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})(typeof window==='object'?window:globalThis);
