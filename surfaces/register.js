/* register.js — the estate-wide reading-register toggle, FOUNDER CANON 2026-08-28.
   Loaded by tour.js on every surface, so the choice is IN PLACE on every page and travels
   with the reader (localStorage 'bregister', same local-first pattern as btranslated_pref).

   THE CANON (founder-ruled, verbatim definitions):
   - new bee  = "the apple of the decentralized OS eco" (polished, human, zero jargon)
   - raver    = "everything expressed through art, graphics, animation"
   - cypherpunk = "everything a computer scientist/engineer will want"

   THE LAWS, baked in rather than remembered:
   - One set of constants. A register changes PROSE and DENSITY, never a number — three
     renderings of one truth, so the registers can never disagree about a fact.
   - new bee is the DEFAULT and is never a downgrade: guided, minimal, generous.
   - Raver is mid-density and vivid — vividness lives in chrome, never in data encodings.
   - Cypherpunk is dense and receipts-forward.
   - THE TOGGLE IS OBVIOUS: three NAMED pills (icon + word), 44px touch targets,
     active state unmistakable and never carried by colour alone (filled pill +
     pressed ring + aria-pressed). A first-time visitor SEES that three readings exist:
     the control introduces itself once — one quiet line with the three definitions.
   - Standing law unchanged: move the detail, never delete it — registers relocate
     content, never erase it.

   Page contract: mark register-specific prose with data-reg="bee|raver|cypherpunk".
   Unmarked content renders in every register. A page with no data-reg content still
   carries the toggle — the preference is estate-wide, the prose arrives per page. */
(function(){
  if(document.getElementById('bregctl')) return;
  /* labels + the intro line are CORPUS KEYS (reg.*) — one key one English;
     lang.js swaps them like any other string, so the canon speaks every tongue */
  var REGS=[['bee','🐝','reg.bee'],
            ['raver','🎛','reg.raver'],
            ['cypherpunk','⚗','reg.cypherpunk']];
  function pref(){ try{ var v=localStorage.getItem('bregister');
    return (v==='raver'||v==='cypherpunk')?v:'bee'; }catch(e){ return 'bee'; } }
  function setPref(r){ try{ localStorage.setItem('bregister',r); }catch(e){} apply(r); }
  function apply(r){
    document.body.setAttribute('data-reg',r);
    REGS.forEach(function(R){
      var b=document.getElementById('breg-'+R[0]);
      if(b) b.setAttribute('aria-pressed', String(R[0]===r));
    });
    try{ document.dispatchEvent(new CustomEvent('bregister',{detail:{reg:r}})); }catch(e){}
  }
  /* the visibility mechanism: CSS attribute matching, no per-page wiring */
  var css=document.createElement('style');
  css.textContent=
    '[data-reg]:not(body){display:none}'
   +'body[data-reg="bee"] [data-reg="bee"],'
   +'body[data-reg="raver"] [data-reg="raver"],'
   +'body[data-reg="cypherpunk"] [data-reg="cypherpunk"]{display:revert}'
   /* the wrap itself is a span: under a bare span{} rule it read +4px (lang-lane
      probe, b2b4eee). Pinned like its buttons — nobody's element selector. */
   +'#bregctl{display:inline-flex;gap:5px;align-items:center;margin:0 0 0 10px;padding-left:10px;flex-shrink:0;min-height:0;height:auto;box-sizing:border-box;'
   +'border-left:1px solid #243026;vertical-align:middle}'
   /* CANON: 44px touch targets, named pills, unmistakable active state —
      filled pill + ring + bold + leading dot, never colour alone. Property
      pinning law preserved (the tour bar is nobody's element selector). */
   +'#bregctl button{background:transparent;border:1px solid #243026;border-radius:999px;'
   +'color:#8a9a8a;font:11px "IBM Plex Mono",monospace;padding:0 12px;cursor:pointer;line-height:1;'
   +'margin:0;min-height:44px;height:44px;box-sizing:border-box;display:inline-flex;'
   +'align-items:center;gap:6px;white-space:nowrap}'
   +'#bregctl button[aria-pressed="true"]{border-color:#FFD700;color:#FFD700;font-weight:700;'
   +'background:rgba(255,215,0,.10);box-shadow:0 0 0 2px rgba(255,215,0,.35)}'
   +'#bregctl button[aria-pressed="true"]::before{content:"●";font-size:8px}'
   +'#bregctl button:hover{border-color:#00E5FF;color:#00E5FF}'
   /* the once-introduction: one quiet line, dismissed by any choice or its own click */
   +'#bregintro{position:absolute;left:0;right:0;bottom:100%;display:block;width:100%;box-sizing:border-box;margin:0 0 2px;padding:6px 10px;'
   +'background:#0d1410;border:1px solid #243026;border-radius:8px 8px 0 0;color:#8a9a8a;font:10.5px "IBM Plex Mono",monospace;line-height:1.7;cursor:pointer}';
  document.head.appendChild(css);

  function mount(){
    var host=document.getElementById('tbar');
    var wrap=document.createElement('span'); wrap.id='bregctl';
    wrap.setAttribute('role','group'); wrap.setAttribute('aria-label','reading register — three readings of every page');
    REGS.forEach(function(R){
      var b=document.createElement('button');
      b.id='breg-'+R[0];
      b.setAttribute('aria-pressed','false');
      b.appendChild(document.createTextNode(R[1]));
      var w=document.createElement('span'); w.className='w'; w.setAttribute('data-i18n',R[2]);
      w.textContent=R[0]==='bee'?'new bee':R[0];
      b.appendChild(w);
      b.addEventListener('click',function(){ try{ localStorage.setItem('bregintro','1'); }catch(e){}
        var intro=document.getElementById('bregintro'); if(intro) intro.remove();
        setPref(R[0]); });
      wrap.appendChild(b);
    });
    if(host){ host.appendChild(wrap); }
    else{ /* no tour bar (rare) — float it, same control, bottom-right */
      wrap.style.cssText+=';position:fixed;right:10px;bottom:10px;background:#0d1410;'
        +'border:1px solid #243026;border-radius:8px;padding:5px 8px;z-index:9999;margin:0';
      document.body.appendChild(wrap);
    }
    /* the once-introduction — one quiet line carrying the three definitions
       verbatim (corpus-keyed as reg.intro), gone after the first choice */
    var seen=false; try{ seen=!!localStorage.getItem('bregintro'); }catch(e){}
    if(!seen&&host){
      var line=document.createElement('span'); line.id='bregintro';
      line.setAttribute('data-i18n','reg.intro');
      line.setAttribute('role','note');
      line.textContent='three readings of every page — new bee: the apple of the decentralized OS eco · raver: everything expressed through art, graphics, animation · cypherpunk: everything a computer scientist/engineer will want. pick yours; it travels with you.';
      line.addEventListener('click',function(){ try{ localStorage.setItem('bregintro','1'); }catch(e){} line.remove(); });
      host.appendChild(line);
    }
    apply(pref());
  }
  /* stay in sync when another tab changes the choice */
  window.addEventListener('storage',function(e){ if(e.key==='bregister') apply(pref()); });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
