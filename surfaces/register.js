/* Shared three-view control: New bee (default), Raver, Cypherpunk.
   FOUNDER CANON 2026-08-28: one set of facts, capabilities and access.
   Views change prose/density, never constants. Unmarked content stays shared.
   Existing [data-register-host] is reused; otherwise mount in flow at the top.
   Contract: body[data-reg], data-reg variants, bregister event {reg}, and
   same-origin localStorage bregister. Page-specific presentations are separate;
   shared chrome does not claim every page has three authored presentations. */
(function(){
  if(window.__bnrRegister || document.getElementById('bregctl')) return;
  window.__bnrRegister=true;
  var script=document.currentScript;
  var home=new URL('index.html',script&&script.src||location.href).href;
  var REGS=[['bee','🐝','reg.bee','new bee'],['raver','🎛','reg.raver','raver'],['cypherpunk','⚗','reg.cypherpunk','cypherpunk']];
  function pref(){ try{ var v=localStorage.getItem('bregister');
    return (v==='raver'||v==='cypherpunk')?v:'bee'; }catch(e){ return 'bee'; } }
  function apply(r){
    if(!document.body) return;
    document.body.setAttribute('data-reg',r);
    REGS.forEach(function(R){
      var b=document.getElementById('breg-'+R[0]);
      if(b) b.setAttribute('aria-pressed',String(R[0]===r));
    });
    document.dispatchEvent(new CustomEvent('bregister',{detail:{reg:r}}));
  }
  var css=document.createElement('style'); css.id='bregstyle';
  /* Scope colors to chrome, not page data encodings. Pin element properties:
     the estate has many bare button/span/a rules. */
  css.textContent=`
    [data-reg]:not(body){display:none}
    body[data-reg="bee"] [data-reg="bee"],body[data-reg="raver"] [data-reg="raver"],body[data-reg="cypherpunk"] [data-reg="cypherpunk"]{display:revert}
    #bregbar,#bregctl{--reg-bg:#f6f7f2;--reg-ink:#18362a;--reg-line:#8a9e90;--reg-active:#326b39;--reg-on:#fff;--reg-font:system-ui,-apple-system,'Segoe UI',sans-serif;color-scheme:light}
    body[data-reg="raver"] #bregbar,body[data-reg="raver"] #bregctl{--reg-bg:#0e1b19;--reg-ink:#e9f2ec;--reg-line:#729889;--reg-active:#b7a8f7;--reg-on:#101724;color-scheme:dark}
    body[data-reg="cypherpunk"] #bregbar,body[data-reg="cypherpunk"] #bregctl{--reg-bg:#06110c;--reg-ink:#e9f2ec;--reg-line:#729889;--reg-active:#86cc72;--reg-on:#06110c;--reg-font:ui-monospace,'Cascadia Mono',Consolas,monospace;color-scheme:dark}
    #bregbar{position:relative;inset:auto;z-index:auto;display:flex;flex:0 0 auto;order:-1;grid-column:1/-1;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-sizing:border-box;width:100%;min-width:0;max-width:none;height:auto;min-height:68px;margin:0 0 16px;padding:12px clamp(12px,3vw,40px);border:0;border-bottom:1px solid var(--reg-line);background:var(--reg-bg);color:var(--reg-ink);font:1rem/1.5 var(--reg-font);text-align:start}
    #bregbar [data-register-host]{display:block;flex:0 1 auto;min-width:0;max-width:100%;margin:0;padding:0}
    #bregctl{position:static;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;min-width:0;max-width:100%;height:auto;min-height:0;margin:0;padding:0;border:0;background:var(--reg-bg);color:var(--reg-ink);font:1rem/1.5 var(--reg-font)}
    #bregctl button{appearance:none;position:relative;inset:auto;display:inline-flex;flex:1 1 auto;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;width:auto;min-width:0;max-width:100%;height:auto;min-height:44px;margin:0;padding:10px 14px;border:1px solid var(--reg-line);border-radius:6px;background:var(--reg-bg);color:var(--reg-ink);font:400 .875rem/1.4 var(--reg-font);letter-spacing:normal;text-transform:none;text-align:center;white-space:normal;overflow-wrap:anywhere;cursor:pointer;box-shadow:none;transform:none;text-decoration:none;opacity:1}
    #bregctl button span{display:inline;position:static;width:auto;height:auto;min-height:0;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit}
    #bregctl button[aria-pressed="true"]{background:var(--reg-active);border-color:var(--reg-active);color:var(--reg-on);font-weight:600}
    #bregctl button::before{content:'✓';display:inline-block;visibility:hidden;font:inherit}
    #bregctl button[aria-pressed="true"]::before{visibility:visible}
    #bregctl button:hover{border-color:var(--reg-active);text-decoration:underline;text-underline-offset:3px}
    #bregctl button:focus-visible,#bregbar a:focus-visible{outline:2px solid var(--reg-active);outline-offset:3px}
    #bregbar .breg-home{position:static;display:inline-flex;flex:0 0 auto;align-items:center;box-sizing:border-box;min-height:44px;width:auto;height:auto;margin:0;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--reg-ink);font:600 1rem/1.5 var(--reg-font);text-transform:none;letter-spacing:normal;text-decoration:none}
    #bregbar .breg-home:hover{text-decoration:underline}
    #bregdescription{position:absolute;display:block;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
    @media(max-width:600px){#bregbar{gap:4px;padding:8px 10px}#bregbar [data-register-host]{flex:1 1 100%}#bregctl{gap:4px}#bregctl button{padding:8px;font-size:.875rem}}
    @media(forced-colors:active){#bregctl button[aria-pressed="true"]{outline:2px solid Highlight;outline-offset:-3px}}
  `;
  document.head.appendChild(css);
  function mount(){
    if(document.getElementById('bregctl')) return;
    var host=document.querySelector('[data-register-host]');
    if(!host){
      var bar=document.createElement('div'); bar.id='bregbar';
      var link=document.createElement('a'); link.className='breg-home'; link.href=home;
      link.textContent='⬡ skaists'; link.setAttribute('aria-label','skaists home'); bar.appendChild(link);
      host=document.createElement('div'); host.setAttribute('data-register-host','');
      host.setAttribute('aria-describedby','bregdescription'); bar.appendChild(host);
      var description=document.createElement('span'); description.id='bregdescription';
      description.setAttribute('data-i18n','atlas.view');
      description.textContent='Choose how this page speaks to you'; bar.appendChild(description);
      /* Centered tools use body as a horizontal flex row. A new sibling
         would squeeze their main column; put the control inside that column. */
      var parent=document.body;
      var layout=getComputedStyle(parent);
      if((layout.display==='flex'||layout.display==='inline-flex') && /^row/.test(layout.flexDirection)){
        parent=document.querySelector('body > main')||parent;
      }
      parent.insertBefore(bar,parent.firstChild);
    }
    var wrap=document.createElement('div'); wrap.id='bregctl';
    wrap.setAttribute('role','group'); wrap.setAttribute('aria-label','View');
    var described=host.getAttribute('aria-describedby');
    if(described) wrap.setAttribute('aria-describedby',described);
    REGS.forEach(function(R){
      var b=document.createElement('button'); b.type='button'; b.id='breg-'+R[0];
      b.setAttribute('aria-pressed','false');
      var icon=document.createElement('span'); icon.setAttribute('aria-hidden','true');
      icon.textContent=R[1]; b.appendChild(icon);
      var word=document.createElement('span'); word.setAttribute('data-i18n',R[2]); word.textContent=R[3]; b.appendChild(word);
      b.addEventListener('click',function(){try{localStorage.setItem('bregister',R[0]);}catch(e){} apply(R[0]);});
      wrap.appendChild(b);
    });
    host.appendChild(wrap); apply(pref());
  }
  window.addEventListener('storage',function(e){if(e.key==='bregister'||e.key===null) apply(pref());});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
