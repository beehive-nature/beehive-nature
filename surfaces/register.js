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
    var theme=document.body.getAttribute('data-bee-theme');
    document.documentElement.setAttribute('data-bee-light',String(r==='bee' && (theme==='shared'||theme==='custom')));
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

    /* New bee's page canvas. Neutral aliases bridge the older page families;
       categorical/semantic tokens, charts, images and canvas paint stay owned
       by their page. The hub already has its approved custom treatment. */
    html[data-bee-light="true"]{background:#f6f7f2;color-scheme:light}
    body[data-reg="bee"][data-bee-theme="shared"]{
      --bg:#f6f7f2;--bg0:#f6f7f2;--void:#f6f7f2;
      --panel:#fff;--bg1:#fff;--bg-card:#fff;--tile:#fff;
      --well:#edf2eb;--inset:#edf2eb;--bg2:#edf2eb;--bg-well:#edf2eb;--panel2:#edf2eb;
      --bg3:#e2eadf;--lift:#e2eadf;--line:#ccd7cf;
      --ink:#18362a;--ink-hi:#18362a;--fg:#18362a;
      --dim:#435f4e;--dimmer:#52695b;--faint:#52695b;--mut:#52695b;--ink-dim:#52695b;--ink-mut:#52695b;
      --bee-font:system-ui,-apple-system,'Segoe UI',sans-serif;--sans:var(--bee-font);--font-ui:var(--bee-font);
      --t-body:1.125rem;--t-small:.875rem;--t-law:.875rem;--t-micro:.875rem;--t-h2:1.25rem;
      background:#f6f7f2;color:#18362a;color-scheme:light;font-family:var(--bee-font);font-size:1.125rem;line-height:1.65;
    }
    body[data-reg="bee"][data-bee-theme="shared"] :where(h1){background:none;color:var(--ink);-webkit-text-fill-color:currentColor;font-family:var(--bee-font);letter-spacing:-.035em;line-height:1.15}
    body[data-reg="bee"][data-bee-theme="shared"] :where(p,li,dt,dd,label,summary,.lede,.lead,.sub,.law,.intro,.bdesc,.gdesc,.seat-note){font-family:var(--bee-font);font-size:max(1rem,1em);line-height:1.65}
    body[data-reg="bee"][data-bee-theme="shared"] :where(.crumbs,.kicker,.eyebrow,.bmeta,.gwhen,.genlabel,.email,.lrelay,.who,footer,.foot){font-family:var(--bee-font);font-size:.875rem;line-height:1.65;letter-spacing:normal}
    body[data-reg="bee"][data-bee-theme="shared"] :where(.panel,.card,.house,.listing){background:var(--panel);border-color:var(--line);border-radius:16px}
    body[data-reg="bee"][data-bee-theme="shared"] :where(p,.lede,.lead,.intro){max-inline-size:72ch}
    body[data-reg="bee"][data-bee-theme="shared"] :where(pre,code,kbd,samp){font-family:ui-monospace,'Cascadia Mono',Consolas,monospace}

    /* Reviewed document adapters. These pages have prose, links and status
       labels rather than chart palettes. Deeper stops keep their hue roles. */
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="door"]{--green:#326b39;--magenta:#9e327f;--cyan:#176879;--lilac:#65509a;--blue:#29628f;--gold:#855b0b;--ember:#9f362c;--accent:var(--magenta);--hot:#8a9e90}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-accent="green"]{--accent:#326b39}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-accent="blue"]{--accent:#29628f}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-accent="cyan"]{--accent:#176879}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-accent="lilac"]{--accent:#65509a}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="door"] #veil{display:none}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="door"] :where(section,.origin,.act,.notyet,a.t){border-radius:16px}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="door"] :where(.what,.intro,.origin p,.notyet p,.notyet li,a.t s,.act s){font-size:1rem;line-height:1.7}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="door"] a.t.big s{font-size:1rem;line-height:1.7}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="door"] :where(a.t b,.act b,.shead h2){font-size:1.125rem;line-height:1.4}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="door"] :where(a.t u,.shead em,.shead .n,.origin .src,.act em,.notyet h2,.origin a){font-size:.875rem;line-height:1.6;letter-spacing:normal;text-transform:none}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="door"] :where(a):focus-visible{outline:2px solid var(--accent);outline-offset:4px}

    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="directory"]{--gold:#855b0b;--cyan:#176879;--verified:#326b39;--guard:#65509a;--violet:#65509a;--info:#29628f}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="directory"] :where(section){padding:clamp(20px,3vw,32px);border-radius:16px;margin-block:24px}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="directory"] :where(.listing){background:var(--well);padding:18px 20px}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="directory"] :where(h2,.lname){font-size:1.125rem;line-height:1.5;letter-spacing:normal}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="directory"] :where(.chip,.who,.a-link,.cap,.nt,.hivedivider){font-size:.875rem;line-height:1.6;letter-spacing:normal;white-space:normal}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="directory"] :where(.lrelay,.nb,.seat-note){font-size:1rem;line-height:1.7}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="directory"] .a-link{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="directory"] a:focus-visible{outline:2px solid var(--info);outline-offset:4px}

    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"] :where(.sub,.note,footer,.card h2){color:var(--dim);font-size:1rem;letter-spacing:normal;line-height:1.65}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"] :where(.hex){color:#326b39;font-size:.875rem;letter-spacing:normal}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"] :where(h1 span){color:#855b0b}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"][data-bee-accent="green"] :where(h1 span){color:#326b39}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"] :where(.state,.state b){color:var(--ink);font-size:1rem}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"] code.join{background:var(--well);border-color:var(--line);color:#855b0b;font-size:1rem}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"] button[data-copy]{background:var(--panel);color:#326b39;border-color:#8a9e90;min-height:44px;font:500 1rem/1.5 var(--bee-font)}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"] button[data-copy]:hover{background:var(--well);border-color:#326b39}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"] a.btn{background:#326b39;color:#fff;min-height:44px}
    body[data-reg="bee"][data-bee-theme="shared"][data-bee-adapter="relay"] :where(a,button):focus-visible{outline:2px solid #326b39;outline-offset:4px}
  `;
  document.head.appendChild(css);
  function mount(){
    if(document.getElementById('bregctl')) return;
    var host=document.querySelector('[data-register-host]');
    /* Migrate complete page families, not arbitrary dark widgets. A dark
       chart + its palette/HUD is one unit. Pending tools keep that unit until
       their adapter is reviewed. New pages can opt into the shared contract;
       an authored theme can use data-bee-theme="custom". */
    if(!document.body.getAttribute('data-bee-theme')){
      var path=new URL(location.href).pathname;
      var art=/\/fleet\//.test(path)||/\/fleet-hosted\/(gallery|lab)\//.test(path)||/\/forge\/orbit(?:-v2)?\.html$/.test(path);
      var base=new URL('.',script&&script.src||location.href).pathname;
      var route=path.indexOf(base)===0?path.slice(base.length):'';
      var doors={'doors/index.html':'magenta','doors/skaists.html':'blue','doors/beehivenature.html':'magenta','doors/beehivebiomass.html':'green','doors/bnature-bio.html':'green','doors/bnature-social.html':'cyan','doors/plur.html':'lilac'};
      var adapter=doors[route]?'door':/^doors\/(skaists|beehivenature)-buzz\.html$/.test(route)?'relay':route==='profile.html'?'profile':route==='buzz-directory.html'?'directory':null;
      if(adapter)document.body.setAttribute('data-bee-adapter',adapter);
      if(doors[route])document.body.setAttribute('data-bee-accent',doors[route]);
      if(adapter==='relay')document.body.setAttribute('data-bee-accent',route.indexOf('beehivenature')>=0?'green':'gold');
      document.body.setAttribute('data-bee-theme',art?'preserve':host?'custom':adapter?'shared':'pending');
    }
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
