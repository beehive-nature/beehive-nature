/* register.js — the estate-wide technical-register toggle: 🐝 bee · 🎛 raver · ⚗ cypherpunk
   Loaded by tour.js on every surface, so the choice is IN PLACE on every page and travels
   with the reader (localStorage 'bregister', same local-first pattern as btranslated_pref).

   THE LAWS, baked in rather than remembered:
   - One set of constants. A register changes PROSE and DENSITY, never a number — three
     renderings of one truth, so the registers can never disagree about a fact.
   - Bee is the DEFAULT and is never a downgrade: guided, minimal, generous.
   - Raver is mid-density and vivid — vividness lives in chrome, never in data encodings.
   - Cypherpunk is dense and receipts-forward.
   - The toggle is glyph + word + pressed-state, never colour alone.

   Page contract: mark register-specific prose with data-reg="bee|raver|cypherpunk".
   Unmarked content renders in every register. A page with no data-reg content still
   carries the toggle — the preference is estate-wide, the prose arrives per page. */
(function(){
  if(document.getElementById('bregctl')) return;
  var REGS=[['bee','🐝','bee','guided, minimal, generous'],
            ['raver','🎛','raver','mid-density, vivid'],
            ['cypherpunk','⚗','cypher','dense, receipts-forward']];
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
   +'#bregctl{display:inline-flex;gap:4px;align-items:center;margin-left:10px;padding-left:10px;flex-shrink:0;'
   +'border-left:1px solid #243026;vertical-align:middle}'
   /* margin/min-height/height/box-sizing pinned: any page's bare button{} rule
      (attest/bset carry min-height:40px;margin-top:8px) reaches these buttons for
      every property this rule leaves open, and the tbar stretches to the tallest
      rider — 63px, caught by estate-review's paint gate. Same law as the bar's
      own links: the tour bar is nobody's element selector. */
   +'#bregctl button{background:transparent;border:1px solid #243026;border-radius:6px;'
   +'color:#8a9a8a;font:10px "IBM Plex Mono",monospace;padding:2px 7px;cursor:pointer;line-height:1.5;'
   +'margin:0;min-height:0;height:auto;box-sizing:border-box}'
   +'#bregctl button[aria-pressed="true"]{border-color:#FFD700;color:#FFD700}'
   +'#bregctl button:hover{border-color:#00E5FF;color:#00E5FF}'
   +'@media (max-width:520px){#bregctl button span.w{display:none}}'; /* phone: glyphs keep their pressed word via title */
  document.head.appendChild(css);

  function mount(){
    var host=document.getElementById('tbar');
    var c=document.createElement('span'); c.id='bregctl';
    c.setAttribute('role','group'); c.setAttribute('aria-label','technical register');
    REGS.forEach(function(R){
      var b=document.createElement('button');
      b.id='breg-'+R[0]; b.title=R[0]+' — '+R[3];
      b.setAttribute('aria-pressed','false');
      b.innerHTML=R[1]+' <span class="w">'+R[2]+'</span>';
      b.addEventListener('click',function(){ setPref(R[0]); });
      c.appendChild(b);
    });
    if(host){ host.appendChild(c); }
    else{ /* no tour bar (rare) — float it, same control, bottom-right */
      c.style.cssText+=';position:fixed;right:10px;bottom:10px;background:#0d1410;'
        +'border:1px solid #243026;border-radius:8px;padding:5px 8px;z-index:9999;margin:0';
      document.body.appendChild(c);
    }
    apply(pref());
  }
  /* stay in sync when another tab changes the choice */
  window.addEventListener('storage',function(e){ if(e.key==='bregister') apply(pref()); });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
