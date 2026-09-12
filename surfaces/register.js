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

    /* Shared wayfinding for the five connected first-click experiences. */
    [data-experience-nav]{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;max-width:1440px;margin:0 auto;padding:0 clamp(14px,3vw,40px) 12px;border:0;font:1rem/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
    [data-experience-nav] a{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;border:1px solid transparent;border-radius:8px;color:inherit;text-decoration:none;font:inherit;letter-spacing:normal;text-transform:none}
    [data-experience-nav] a[aria-current="page"]{border-color:currentColor;font-weight:650;text-decoration:underline;text-underline-offset:5px}
    [data-experience-nav] a:hover{text-decoration:underline;text-underline-offset:5px}
    [data-experience-nav] a:focus-visible{outline:2px solid currentColor;outline-offset:3px}
    body[data-reg="cypherpunk"] [data-experience-nav]{font-family:ui-monospace,Consolas,monospace;font-size:.875rem}
    body[data-reg="raver"] [data-experience-nav] a{border-radius:99px}
    body[data-experience] #tbar{background:var(--bg,#0e1b19)!important;border-color:var(--line,#42574a)!important;font:500 .875rem/1.4 system-ui,sans-serif!important}
    body[data-experience] #tbar a{color:var(--ink,#e9f2ec)!important;min-height:44px!important;box-shadow:none!important;background:transparent!important}
    body[data-experience] #tbar a[aria-current="page"]{font-weight:700;text-decoration:underline!important;text-underline-offset:4px}
    body[data-experience] #tbarMore{background:var(--panel,#0e1b19)!important;color:var(--ink,#e9f2ec)!important;border-color:var(--line,#42574a)!important;min-width:44px!important;min-height:44px!important;font-size:1rem!important}
    body[data-experience][data-reg="bee"] #tbar,body[data-experience][data-reg="bee"] #tbarMore{background:#f6f7f2!important;color:#18362a!important;border-color:#ccd7cf!important}
    body[data-experience][data-reg="bee"] #tbar a{color:#18362a!important}
    body[data-experience] #tbar :is(a,button):focus-visible,body[data-experience] #tbarMore:focus-visible{outline:3px solid currentColor!important;outline-offset:-3px}
    body[data-experience] [data-view]{display:none}
    body[data-experience][data-reg="bee"] [data-view="bee"],body[data-experience][data-reg="raver"] [data-view="raver"],body[data-experience][data-reg="cypherpunk"] [data-view="cypherpunk"]{display:revert}

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
    /* Authored reading rooms. Opt in only where the two arrival compositions
       and page-owned stages exist. Scientific palettes stay page-owned. */
    body[data-reading-room]:not([data-reg="cypherpunk"]){padding:0 0 32px!important;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:1.0625rem;line-height:1.65}
    body[data-reading-room]:not([data-reg="cypherpunk"]) main{width:100%;max-width:1240px!important;margin:auto;padding:0 clamp(20px,4vw,64px);box-sizing:border-box}
    body[data-reading-room]:not([data-reg="cypherpunk"]) #masthead{text-align:start;margin:clamp(28px,5vw,64px) 0 24px}
    body[data-reading-room]:not([data-reg="cypherpunk"]) #masthead h1{font:650 1.2rem/1.4 system-ui,sans-serif;letter-spacing:0;color:var(--ink)}
    body[data-reading-room]:not([data-reg="cypherpunk"]) #masthead .eyebrow{margin:4px 0 0;text-align:start;font-size:.9375rem}
    body[data-reading-room][data-reg="bee"] #first-bee{gap:12px 48px;text-align:start;align-content:center;padding:12px 0 40px;min-height:420px;max-width:none}
    body[data-reading-room][data-reg="bee"][data-room-arrival="true"] #first-bee{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}
    body[data-reading-room][data-reg="bee"] #first-bee>:not(.room-art){grid-column:1;max-width:36rem;margin:0}
    body[data-reading-room][data-reg="bee"] #first-bee .take{grid-row:1;font:600 clamp(2rem,3.5vw,3.4rem)/1.14 system-ui,sans-serif;letter-spacing:-.04em;color:#18362a;text-wrap:balance;overflow-wrap:anywhere}
    body[data-reading-room][data-reg="bee"] #first-bee .calm{grid-row:2;margin-top:12px;font-size:1.125rem;line-height:1.65;color:#435f4e}
    body[data-reading-room][data-reg="bee"] #first-bee .support{font-size:.9375rem;color:#52695b}
    body[data-reading-room][data-reg="bee"] #first-bee .choices{margin-top:20px;justify-content:start;gap:10px}
    body[data-reading-room] .room-art{grid-column:2;grid-row:1/span 7;align-self:stretch;min-width:0;max-height:510px;border-radius:32px;overflow:hidden;background:#e8ede2;margin:0;display:flex;align-items:center;justify-content:center}
    body[data-reading-room] .room-art svg{display:block;width:100%;height:100%;max-height:510px;min-height:360px;object-fit:cover}
    body[data-reading-room] .room-art svg *{animation:none!important}
    body[data-reading-room]:not([data-reg="cypherpunk"]) .door{min-height:48px;max-width:100%;font:550 1rem/1.4 system-ui,sans-serif;text-align:center;white-space:normal;padding:12px 20px}
    body[data-reading-room][data-reg="bee"] .door:not(.primary){background:transparent;border-color:#a9bcad;color:#264d33}
    body[data-reading-room][data-reg="raver"]{--bg:#121021;--panel:#1e1830;--well:#201c30;--ink:#f5effa;--dim:#c4b9d5;--line:#59496b;--cyan:#8ddcdf;--violet:#d2b6f5;background:#121021!important;color:#f5effa}
    body[data-reading-room][data-reg="raver"] #first-raver{min-height:620px;height:auto;isolation:isolate;justify-content:center;align-items:flex-start;text-align:start;padding:clamp(36px,7vw,90px) clamp(22px,5vw,64px);margin:32px 0 40px;border-radius:36px;background:#21192c;box-shadow:0 26px 90px #04020955}
    body[data-reading-room][data-reg="raver"] #first-raver>svg{inset:0 0 0 auto;width:60%;height:100%;opacity:.95;mask-image:linear-gradient(90deg,transparent,#000 25%)}
    body[data-reading-room][data-reg="raver"] #first-raver .feel{max-width:16ch;font:500 clamp(2.3rem,5vw,4.4rem)/1.13 system-ui,sans-serif;letter-spacing:-.045em;text-shadow:0 2px 20px #15101b;margin:0;text-wrap:balance}
    body[data-reading-room][data-reg="raver"] #first-raver .choices{justify-content:start;max-width:25rem;margin-top:30px}
    body[data-reading-room][data-reg="raver"] #first-raver .door.primary{background:#dfb8fa;border-color:#dfb8fa;color:#241031}
    body[data-reading-room]:not([data-reg="cypherpunk"]) :is(#layer-figure,#layer-land,#layer-meet,#layer-story,#layer-map,#layer-draw,#layer-start,#layer-leave){max-width:960px;margin:24px auto 40px;padding:clamp(22px,4vw,44px);border:1px solid var(--line);border-radius:28px;background:var(--panel);text-align:start}
    body[data-reading-room]:not([data-reg="cypherpunk"]) :is(#instrument,#layer-inputs){font:1rem/1.65 system-ui,sans-serif}
    body[data-reading-room]:not([data-reg="cypherpunk"]) :is(#instrument,#layer-inputs) :is(section,.card,.brick,.panel){background:var(--panel);border-color:var(--line);border-radius:20px;padding:24px;margin-block:20px}
    body[data-reading-room]:not([data-reg="cypherpunk"]) :is(#instrument,#layer-inputs) :is(p,li,.law,.sub,.banner,.quote,.stat,.bs,.note,label){font:inherit;line-height:1.65;color:var(--ink)}
    body[data-reading-room]:not([data-reg="cypherpunk"]) :is(#instrument,#layer-inputs) :is(h2,h3,h4){font:650 1.15rem/1.5 system-ui,sans-serif;letter-spacing:0;color:var(--ink)}
    body[data-reading-room]:not([data-reg="cypherpunk"]) :is(#instrument,#layer-inputs) :is(input,select,textarea){font:inherit;min-height:44px;background:var(--well);color:var(--ink);max-width:100%;border:1px solid var(--line);border-radius:8px}
    body[data-reading-room]:not([data-reg="cypherpunk"]) :is(th,td){font-size:.9375rem;line-height:1.6}
    body[data-reading-room]:not([data-reg="cypherpunk"]) .room-table{overflow:auto;max-width:100%;border-radius:12px}
    body[data-reading-room] .room-tools{max-width:1112px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:22px auto 8px;padding:0 clamp(20px,4vw,64px);box-sizing:content-box}
    body[data-reading-room][data-reg="cypherpunk"] .room-tools{display:none}
    body[data-reading-room][data-reg="bee"][data-room-arrival="true"] .room-tools{display:none}
    body[data-reading-room] .room-tools button{appearance:none;background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:99px;min-height:44px;padding:9px 16px;font:500 .9375rem/1.4 system-ui,sans-serif;cursor:pointer}
    body[data-reading-room] .room-tools button:focus-visible{outline:3px solid var(--cyan);outline-offset:3px}
    body[data-reading-room] [data-room-pause]{margin-inline-start:auto}
    body[data-reading-room][data-reg="bee"] [data-room-pause]{display:none}
    body[data-reading-room][data-room-arrival="true"] [data-room-overview]{visibility:hidden}
    /* Pause continuous illustration motion through deeper Raver content too.
       Entrance animations and functional spinners must still complete. */
    body[data-reading-room][data-reg="raver"][data-motion-paused="true"] :is(#first-raver svg *,.flowline path,.brick .dot,.cgroup.ess,.qr),body[data-reading-room]:not([data-reg="raver"]) #first-raver svg *{animation-play-state:paused!important}
    body[data-reading-room] .room-navigation{max-width:1112px;margin:36px auto 16px;padding:0 clamp(20px,4vw,64px);font:1rem/1.5 system-ui,sans-serif}
    body[data-reading-room] .room-navigation summary{min-height:48px;cursor:pointer;padding:16px 0;border-top:1px solid var(--line);color:var(--ink)}
    body[data-reading-room]:not([data-reg="cypherpunk"]) .room-navigation #tbar a{font:500 1rem/1.5 system-ui,sans-serif!important;color:var(--ink)!important;min-height:44px!important;border:1px solid var(--line);white-space:normal;max-width:100%;box-sizing:border-box}
    body[data-reading-room] .room-navigation #tbar .tsep{display:none}
    body[data-reading-room]:not([data-reg="cypherpunk"]) footer{font:.9375rem/1.6 system-ui,sans-serif;color:var(--dim)}
    body[data-reading-room]:not([data-reg="cypherpunk"]) :is(.map-caption,.draw-caption,.story-caption,.together,.meet-card p,.meet-card h3,.consciousness){font:inherit;line-height:1.65}
    @media(max-width:720px){
      body[data-reading-room][data-reg="bee"][data-room-arrival="true"] #first-bee{grid-template-columns:1fr;min-height:0;gap:18px}
      body[data-reading-room] .room-art{grid-column:1;grid-row:auto;max-height:220px;border-radius:24px}
      body[data-reading-room] .room-art svg{min-height:220px;height:220px}
      body[data-reading-room][data-reg="bee"] #first-bee .take{grid-row:1}
      body[data-reading-room][data-reg="bee"] #first-bee .calm{grid-row:2;margin-top:0}
      body[data-reading-room][data-reg="bee"] #first-bee .choices{margin-top:6px}
      body[data-reading-room][data-reg="raver"] #first-raver{min-height:580px;padding:220px 24px 32px;justify-content:flex-end;border-radius:26px;margin-top:16px}
      body[data-reading-room][data-reg="raver"] #first-raver>svg{inset:0;width:100%;height:100%;mask-image:linear-gradient(#000 20%,#0005 55%,transparent 80%)}
      body[data-reading-room][data-reg="raver"] #first-raver .feel{font-size:clamp(2rem,8vw,3rem);max-width:18ch}
      body[data-reading-room] .room-tools{margin-top:12px}
      body[data-reading-room] :is(.two,.meet-grid,.bricks){grid-template-columns:1fr}
    }
    @media(prefers-reduced-motion:reduce){body[data-reading-room] #first-raver svg *{animation:none!important}}
  `;
  document.head.appendChild(css);
  function readingRoom(){
    var bee=document.getElementById('first-bee'),raver=document.getElementById('first-raver');
    if(!bee||!raver||document.body.hasAttribute('data-reading-room'))return;
    var beatAttr=Array.from(document.body.attributes).find(function(a){return /^data-.*-beat$/.test(a.name);});
    if(!beatAttr)return;
    document.body.setAttribute('data-reading-room','');
    var svg=raver.querySelector('svg');
    if(svg){
      var art=document.createElement('figure');art.className='room-art';art.setAttribute('aria-hidden','true');
      var copy=svg.cloneNode(true);var remap={};
      [copy].concat(Array.from(copy.querySelectorAll('[id]'))).forEach(function(n){if(n.id){remap[n.id]='calm-'+n.id;n.id=remap[n.id];}});
      [copy].concat(Array.from(copy.querySelectorAll('*'))).forEach(function(n){
        Array.from(n.attributes).forEach(function(a){var v=a.value;Object.keys(remap).forEach(function(id){v=v.split('#'+id).join('#'+remap[id]);});n.setAttribute(a.name,v);});
        n.removeAttribute('data-i18n');
      });
      copy.removeAttribute('aria-label');copy.setAttribute('aria-hidden','true');
      var bg=copy.querySelector('rect');if(bg){bg.setAttribute('fill','#e8ede2');}
      art.appendChild(copy);bee.appendChild(art);
    }
    var tools=document.createElement('div');tools.className='room-tools';
    var back=document.createElement('button');back.type='button';back.setAttribute('data-room-overview','');
    var pause=document.createElement('button');pause.type='button';pause.setAttribute('data-room-pause','');
    tools.append(back,pause);var main=bee.closest('main')||bee.parentElement;
    if(main===document.body)bee.before(tools);else main.before(tools);
    var reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    var paused=reduced.matches;try{paused=paused||localStorage.getItem('bnr.motion.paused')==='true';}catch(e){}
    function label(node,key,fallback){node.setAttribute('data-i18n',key);node.textContent=window.BNRLanguage?window.BNRLanguage.text(key,fallback):fallback;node.dataset.i18nEn=fallback;}
    function sync(){
      var arrival=document.body.getAttribute(beatAttr.name)==='arrival';document.body.setAttribute('data-room-arrival',String(arrival));
      document.body.setAttribute('data-motion-paused',String(paused||reduced.matches));
      label(back,'ux.overview','Back to overview');
      label(pause,reduced.matches?'ux.still':paused?'ux.resume':'ux.pause',reduced.matches?'Still image':paused?'Resume motion':'Pause motion');
      pause.disabled=reduced.matches;pause.setAttribute('aria-pressed',String(paused||reduced.matches));
    }
    back.addEventListener('click',function(){
      var reg=document.body.getAttribute('data-reg');document.body.setAttribute(beatAttr.name,'arrival');sync();
      var first=reg==='raver'?raver:bee;first.tabIndex=-1;first.focus({preventScroll:true});first.scrollIntoView({block:'start',behavior:'instant'});
    });
    pause.addEventListener('click',function(){paused=!paused;try{localStorage.setItem('bnr.motion.paused',String(paused));}catch(e){}sync();});
    reduced.addEventListener('change',sync);
    window.addEventListener('storage',function(e){if(e.key==='bnr.motion.paused'){paused=e.newValue==='true';sync();}});
    document.addEventListener('blang',sync);document.addEventListener('bregister',sync);
    new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:[beatAttr.name]});
    /* Focus follows an action into its newly opened content, never into a
       hidden button. View switches retain focus on the shared view control. */
    document.addEventListener('click',function(e){
      var trigger=e.target.closest('button');if(!trigger||!Array.from(trigger.attributes).some(function(a){return /^data-.*-go$/.test(a.name);}))return;
      requestAnimationFrame(function(){
        var candidates=Array.from(main.querySelectorAll('[id^="layer-"],#instrument'));
        var visible=candidates.find(function(n){return n.getClientRects().length&&getComputedStyle(n).display!=='none';});
        if(visible){visible.tabIndex=-1;visible.focus({preventScroll:true});}
      });
    });
    main.querySelectorAll('table').forEach(function(table){var wrap=document.createElement('div');wrap.className='room-table';table.before(wrap);wrap.appendChild(table);});
    sync();
  }
  function mount(){
    if(document.getElementById('bregctl')) return;
    var host=document.querySelector('[data-register-host]');
    var experienceNav=document.querySelector('[data-experience-nav]');
    if(experienceNav&&!experienceNav.children.length){
      var stops=[['home','index.html','social.arrival.home','Home'],['gallery','blight/gallery.html','experience.gallery','Art gallery'],['music','blight/studio-music.html','experience.music','Music studio'],['directory','buzz-directory.html','social.arrival.hive','Meet the hive'],['profile','profile.html','experience.profile','People and names']];
      stops.forEach(function(stop){var a=document.createElement('a');a.href=new URL(stop[1],home).href;a.setAttribute('data-i18n',stop[2]);a.textContent=stop[3];if(document.body.getAttribute('data-experience')===stop[0])a.setAttribute('aria-current','page');experienceNav.appendChild(a);});
    }
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
    host.appendChild(wrap); apply(pref()); readingRoom();
  }
  window.addEventListener('storage',function(e){if(e.key==='bregister'||e.key===null) apply(pref());});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
