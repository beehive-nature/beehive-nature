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
      if(el.dataset.i18nEn===undefined) el.dataset.i18nEn=el.textContent;
      if(code==='en'){ el.textContent=el.dataset.i18nEn; hit++; return; }
      var s=corpus&&corpus.strings[k]&&corpus.strings[k][code];
      if(s){ el.textContent=s; hit++; }
      else { el.textContent=el.dataset.i18nEn; } /* honest fallback: English, counted */
    });
    var sel=document.getElementById('blangsel');
    if(sel){ sel.value=code;
      var note=document.getElementById('blangnote');
      if(note){
        if(code==='en'){ note.textContent=''; note.title=''; }
        else{
          var att=corpus&&corpus._meta&&corpus._meta.attested&&corpus._meta.attested[code];
          if(att){ note.textContent='✓ '+hit+'/'+total;
            note.title='HUMAN-ATTESTED '+(att.by||'(name withheld)')+' · '+(att.date||'')+
              ' — a person who lives in this tongue signed these lines'; }
          else{ note.textContent = total===0 ? '⚙ 0 docked here yet' : '⚙ '+hit+'/'+total;
            note.title='machine-drafted ⚙ — human attestation upgrades it; '+
              (total-hit)+' line(s) on this page fall back to English and say so here'; }
        }
      }
    }
    try{ document.dispatchEvent(new CustomEvent('blang',{detail:{lang:code}})); }catch(e){}
  }
  function mount(){
    var host=document.getElementById('tbar');
    var wrap=document.createElement('span'); wrap.id='blangctl';
    wrap.style.cssText='display:inline-flex;gap:5px;align-items:center;margin-left:10px;'
      +'padding-left:10px;border-left:1px solid #243026;vertical-align:middle';
    var sel=document.createElement('select'); sel.id='blangsel';
    sel.setAttribute('aria-label','language');
    sel.style.cssText='background:#0d1410;color:#8a9a8a;border:1px solid #243026;'
      +'border-radius:6px;font:10px "IBM Plex Mono",monospace;padding:2px 4px;max-width:110px';
    sel.innerHTML='<option value="" disabled>🌐</option>'+LANGS.map(function(L){
      return '<option value="'+L[0]+'">'+L[1]+'</option>'; }).join('');
    sel.addEventListener('change',function(){ setPref(sel.value); });
    var note=document.createElement('span'); note.id='blangnote';
    note.style.cssText='font:9px "IBM Plex Mono",monospace;color:#FFD700;white-space:nowrap';
    wrap.appendChild(sel); wrap.appendChild(note);
    if(host) host.appendChild(wrap); else document.body.appendChild(wrap);
    var c=pref();
    if(c==='en'){ sel.value='en'; apply('en'); return; }
    load(function(){ apply(c); });
  }
  function load(cb){
    if(corpus) return cb();
    fetch(R+'lang-corpus.json?v=8').then(function(r){return r.json()})
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
