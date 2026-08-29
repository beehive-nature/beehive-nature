/* lang.js — the estate-wide language toggle. every corpus-docked tongue, one corpus, honest absence.
   Loaded by tour.js on every surface, same pattern as register.js: the choice persists
   (localStorage 'blang'), travels between pages, and syncs across open tabs.

   THE CORPUS LAW, enforced here:
   - every rendering in lang-corpus.json is MACHINE-DRAFTED (⚙) until a human attestation
     upgrades it — the picker says so on its face, not in a footnote;
   - a string with no docked rendering FALLS BACK TO ENGLISH VISIBLY (the coverage counter
     beside the picker tells the reader how much of the page is in their language);
   - a machine draft never finalizes a consent — consent surfaces keep their own stricter
     ceremony (CONSENT-1) and do not accept this layer as sufficient;
   - names are names (bzDiD, rust, Base, b4b) — the pointer principle: never translated.
   RTL: Arabic, Hebrew and Farsi set dir=rtl on the document. Full RTL layout mirroring
   remains the design seat's D-13 lane; text direction lands now, honestly labeled beta. */
(function(){
  if(document.getElementById('blangctl')) return;
  var R=location.pathname.indexOf('/beehive-nature/')===0?'/beehive-nature/surfaces/':'/surfaces/';
  var LANGS=[
    ['en','English'],
    ['ru','Русский'],
    ['uk','Українська'],
    ['tt','Татар теле','Tatar'],
    ['cs','Čeština'],
    ['de','Deutsch'],
    ['nl','Nederlands'],
    ['nl-be','Vlaams (België)'],
    ['fr','Français'],
    ['es','Español'],
    ['gd','Gàidhlig'],
    ['lv','Latviešu'],
    ['zh','中文'],
    ['ko','한국어'],
    ['ja','日本語'],
    ['ur','اردو'],
    ['tr','Türkçe'],
    ['hu','magyar'],
    ['da','dansk'],
    ['nb','norsk'],
    ['sv','svenska'],
    ['fi','suomi'],
    ['th','ไทย'],
    ['hi','हिन्दी'],
    ['sa','संस्कृतम्','Sanskrit'],
    ['bn','বাংলা'],
    ['ar','العربية'],
    ['he','עברית'],
    ['fa','فارسی']
  ];
  var RTL={'ar':1,'he':1,'fa':1,'ur':1};
  var corpus=null;

  function pref(){ try{ var v=localStorage.getItem('blang');
    return LANGS.some(function(L){return L[0]===v})?v:'en'; }catch(e){ return 'en'; } }
  function setPref(c){
    try{ localStorage.setItem('blang',c); }catch(e){}
    /* additive mirror into the tri-role language schema, so corpus surfaces can read
       the reader's UI tongue without a second key; never overwrites father/mother/students */
    try{ var p=JSON.parse(localStorage.getItem('btranslated_pref')||'{}');
      p.ui=c; localStorage.setItem('btranslated_pref',JSON.stringify(p)); }catch(e){}
    apply(c);
  }
  function apply(code){
    document.documentElement.lang=code;
    document.documentElement.dir=RTL[code]?'rtl':'ltr';
    var nodes=document.querySelectorAll('[data-i18n]');
    var hit=0,total=0;
    nodes.forEach(function(el){
      var k=el.getAttribute('data-i18n'); total++;
      /* MARKUP-AWARE SWAP (founder order: rich paragraphs ARE the argument).
         If the English carries inline markup (links, emphasis), capture the
         innerHTML once and restore it; a corpus rendering containing '<' is
         set as HTML. Trust basis: the corpus is repo-committed and reviewed
         like the page itself — same trust level as the document. Plain
         renderings stay textContent. */
      if(el.dataset.i18nEn===undefined){
        if(el.innerHTML.indexOf('<')!==-1){ el.dataset.i18nEn=el.innerHTML; el.dataset.i18nRich='1'; }
        else el.dataset.i18nEn=el.textContent;
      }
      if(code==='en'){ if(el.dataset.i18nRich) el.innerHTML=el.dataset.i18nEn; else el.textContent=el.dataset.i18nEn; hit++; return; }
      var s=corpus&&corpus.strings[k]&&corpus.strings[k][code];
      if(s){ if(s.indexOf('<')!==-1) el.innerHTML=s; else el.textContent=s; hit++; }
      else { if(el.dataset.i18nRich) el.innerHTML=el.dataset.i18nEn; else el.textContent=el.dataset.i18nEn; } /* honest fallback: English, counted */
    });
    /* THE COVERAGE COUNTER (founder defect order 2026-08-29): the old count was
       keys-present over [data-i18n] elements — a page reading English to every
       tongue showed a green 49/49. The carrier now counts VISIBLE STRINGS
       covered: same walk as e2e/i18n-coverage.mjs (leaf elements, riders and
       canvas excluded, on-screen, lettered text >= 3 chars). covered = the leaf
       sits inside a data-i18n holder whose cell for this tongue is non-empty
       (English counts keyed as covered — it is the source). */
    var CHROME='#tbar,#adOrb,#adPanel,#tbarMore,#railsbadge,#bregctl,#blangctl,#veil,#bandwrap';
    var vis=0, cov=0;
    document.querySelectorAll('body *').forEach(function(n){
      if(n.children.length) return;
      if(n.closest && n.closest(CHROME)) return;
      if(['SCRIPT','STYLE','NOSCRIPT','CANVAS','SVG','PATH','OPTION'].includes(n.tagName)) return;
      var t=(n.textContent||'').trim();
      if(t.length<3||!/[A-Za-zА-Яа-яЀ-ӿ]/.test(t)) return;
      var r=n.getBoundingClientRect();
      if(r.width===0&&r.height===0) return;
      vis++;
      var hold=n.closest('[data-i18n]');
      if(hold){ var hk=hold.getAttribute('data-i18n');
        if(code==='en'){ cov++; }
        else if(corpus&&corpus.strings[hk]&&corpus.strings[hk][code]){ cov++; } }
    });
    var sel=document.getElementById('blangsel');
    if(sel){ sel.value=code;
      var note=document.getElementById('blangnote');
      if(note){
        if(code==='en'){ note.textContent=''; note.title=''; }
        else{
          var att=corpus&&corpus._meta&&corpus._meta.attested&&corpus._meta.attested[code];
          if(att){ note.textContent='✓ '+cov+'/'+vis;
            note.title='HUMAN-ATTESTED '+(att.by||'(name withheld)')+' · '+(att.date||'')+
              ' — a person who lives in this tongue signed these lines'; }
          else{ note.textContent = vis===0 ? '' : '⚙ '+cov+'/'+vis;
            note.title='machine-drafted ⚙ — human attestation upgrades it; '+
              (vis-cov)+' of '+vis+' visible strings on this page are unkeyed — no tongue can reach them'; }
        }
      }
    }
    try{ document.dispatchEvent(new CustomEvent('blang',{detail:{lang:code}})); }catch(e){}
  }
  function mount(){
    var host=document.getElementById('tbar');
    /* margin/min-height/height/box-sizing pinned on all three elements below:
       an inline style only wins the properties it SETS — any page's bare
       select{}/span{} rule reaches these controls through every property left
       open, and the tbar stretches to the tallest rider. Same class as the
       bare button{} rules (attest/bset, 63px bar) pinned in register.js; no
       page exercises the select/span hole today — closed before one does.
       The tour bar is nobody's element selector. */
    var wrap=document.createElement('span'); wrap.id='blangctl';
    wrap.style.cssText='display:inline-flex;gap:5px;align-items:center;margin:0 0 0 10px;flex-shrink:0;'
      +'padding-left:10px;border-left:1px solid #243026;vertical-align:middle;'
      +'min-height:0;height:auto;box-sizing:border-box';
    var sel=document.createElement('select'); sel.id='blangsel';
    sel.setAttribute('aria-label','language');
    sel.style.cssText='background:#0d1410;color:#8a9a8a;border:1px solid #243026;'
      +'border-radius:6px;font:10px "IBM Plex Mono",monospace;padding:2px 4px;max-width:110px;'
      +'margin:0;min-height:0;height:auto;box-sizing:border-box';
    sel.innerHTML='<option value="" disabled>🌐</option>'+LANGS.map(function(L){
      return '<option value="'+L[0]+'"'+(L[2]?' title="'+L[2]+'"':'')+'>'+L[1]+'</option>'; }).join('');
    sel.addEventListener('change',function(){ setPref(sel.value); });
    var note=document.createElement('span'); note.id='blangnote';
    note.style.cssText='font:9px "IBM Plex Mono",monospace;color:#FFD700;white-space:nowrap;'
      +'margin:0;min-height:0;height:auto;box-sizing:border-box';
    wrap.appendChild(sel); wrap.appendChild(note);
    if(host) host.appendChild(wrap); else document.body.appendChild(wrap);
    var c=pref();
    if(c==='en'){ sel.value='en'; apply('en'); return; }
    load(function(){ apply(c); });
  }
  function load(cb){
    if(corpus) return cb();
    fetch(R+'lang-corpus.json?v=11').then(function(r){return r.json()})
      .then(function(j){ corpus=j;
        /* the withdrawal law reaches the renderer: a withdrawn tongue stops rendering
           estate-wide (history kept in the corpus file); its picker entry says so. */
        try{ var wd=(j._meta&&j._meta.withdrawn)||{};
          var sel=document.getElementById("blangsel");
          Object.keys(wd).forEach(function(code){
            if(sel){ var o=sel.querySelector('option[value="'+code+'"]');
              if(o){ o.disabled=true; o.textContent+=" 🕊"; } }
            if(corpus.strings) Object.keys(corpus.strings).forEach(function(k){ delete corpus.strings[k][code]; });
          });
        }catch(e){}
        cb(); })
      .catch(function(){ corpus={strings:{}}; cb(); }); /* fetch failure = full English fallback, counter shows 0/N */
  }
  var _setPref=setPref;
  setPref=function(c){ if(c==='en'){ _setPref(c); } else load(function(){ _setPref(c); }); };
  window.addEventListener('storage',function(e){
    if(e.key==='blang'){ var c=pref(); if(c==='en') apply(c); else load(function(){ apply(c); }); }
  });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
