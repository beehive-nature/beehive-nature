(function(){
  if(document.getElementById('tbar'))return;
  /* Published dApps live at a site-root path.  A developer can also open a
     surface directly from its checkout with file://; in that mode the site
     root does not exist, so riders must resolve beside this script instead. */
  var current=document.currentScript;
  var R=location.protocol==='file:'
    ? new URL('.', current&&current.src||location.href).href
    : (location.pathname.indexOf('/beehive-nature/')===0?'/beehive-nature/surfaces/':'/surfaces/');
  /* Sibling riders (register / lang / rails-badge) follow THIS file, not the
     /surfaces/ alias. A poke at http://127.0.0.1:8765/bearth.html (surfaces as
     server root) 404s /surfaces/register.js and never applies data-reg scoping.
     Tour-bar hrefs keep R — that is the production path both deployments use. */
  var tourScript=document.currentScript;
  var assetBase=(tourScript&&tourScript.src)?tourScript.src.replace(/tour\.js(?:\?.*)?$/i,''):R;
  var L=[['⌂',''],
    ['beam','blight/demo.html'],['fLeeT','blight/index.html'],['museum','blight/museum.html'],
    '—',
    ['gallery','blight/gallery.html'],['explore','blight/inscription-explorer.html'],
    ['catalog','blight/compare.html'],['bNRi','blight/bnri-gallery.html'],
    '—',
    ['market','blight/market.html'],['farm','blight/farmers.html'],['coop','blight/coop.html'],['dao','dao-dashboard/'],
    '—',
    ['organ','blight/midi-organ.html'],['studio','blight/studio-music.html'],['gate','blight/studio-gate.html'],
    ['bench','blight/workbench.html'],['pulse','blight/pulse.html'],['hearth','blight/hearth.html'],
    ['refine','blight/pixelrefiner.html'],['qrtree','blight/qrtree.html'],['roses','blight/qrroses.html'],['holder','blight/profile.html'],['record','record.html'],['midi','blight/midi.html'],['room','blight/midiroom.html'],['vault','blight/midivault.html'],
    '—',
    ['reader','blight/vaulta-reader.html'],['c1','blight/c1-aid.html'],
    '—',
    ['my data','bdata.html'],['keys','onboarding/'],['receive','onboarding/receive.html'],['dids','keys/addresses.html'],['recover','recover.html'],['hw','hardware/'],
    '—',
    ['🎓','university/'],['🐝','bqueenbee-live.html'],['🎧','listening.html'],['⬡','bfood.html'],['🏛','bsymposium.html'],['⚙','stack.html'],['🐜','bantfarm.html'],['♫','bset.html'],['🪩','plur.html'],['🎪','festival/'],['🎨','buzz-studio.html'],['⚒','forge/'],
      '—',
      ['⚑ the FLEET','fleet-hosted/'],
      ['acid','fleet-hosted/gallery/acid-cascade.html'],['indigo','fleet-hosted/gallery/indigo-index.html'],['resonance','fleet-hosted/gallery/resonance.html'],
      ['dash','fleet-hosted/lab/bnr-dashboard.html'],['flower','fleet-hosted/lab/flower-lab.html'],['spliff','fleet-hosted/lab/spliff-lab.html'],
      ['blend','fleet-hosted/lab/blend-lab.html'],['intake','fleet-hosted/lab/intake-tracker.html'],['edible','fleet-hosted/lab/edible-tracker.html']];
  var inlineHost=document.querySelector('[data-tour-host]');
  if(!inlineHost&&document.getElementById('first-bee')&&document.getElementById('first-raver')){
    var directory=document.createElement('details');directory.className='room-navigation';
    var summary=document.createElement('summary');summary.setAttribute('data-i18n','atlas.browse');summary.textContent='Explore the estate';
    inlineHost=document.createElement('div');inlineHost.setAttribute('data-tour-host','');directory.append(summary,inlineHost);
    var content=document.getElementById('first-bee').closest('main')||document.getElementById('instrument');
    if(content)content.after(directory);else document.body.appendChild(directory);
  }
  var b=document.createElement('nav');b.id='tbar';
  /* THE BAR HAS TWO SHAPES (founder order, 2026-08-25).
     A 39-link horizontal strip was 2,272px wide: SIX links reachable at 390px,
     83% of the nav off-screen, and still 46% hidden at 1280px. Every link
     resolved — none of them could be FOUND. Reachable and findable are not the
     same property, and nothing we had asserted told them apart.
     COLLAPSED = the strip, unchanged, for the wide case where it fits.
     EXPANDED  = the same DOM wrapped into a grid, so all 39 are on screen at
     once, grouped on the '—' dividers that were already there. Same markup, same
     links, same active state — CSS decides the shape, so there is one nav to
     maintain and not two. */
  /* THE CLEAN EDGE (founder review 2026-09-26: "bugs all over the place in the bottom/footer").
     Measured at 390 px on all 104 surfaces × 3 views: the one-line strip ran 70 links, the
     language picker and the rails badge in a single scroller under a separately floated ☰, so a
     half word ("explor") was cut by the ☰ on every page, the picker and the badge sat off-screen,
     and the links were 32 px tall. Now the bar is three lanes: the LINKS scroll in their own lane
     and fade out inside it; the riders (language, rails) and the ☰ sit after it at fixed spots, so
     nothing is ever cut; every target is 44 px. The rails line is a sentence — it lives in the
     drawer on a phone, inline where there is room. */
  var lane=document.createElement('div');lane.id='tlinks';
  var css=document.createElement('style');css.id='tbarstyle';
  css.textContent='#tbar{position:fixed;bottom:0;left:0;right:0;max-width:100vw;z-index:9998;display:flex;flex-wrap:nowrap;align-items:center;gap:6px;padding:4px 8px;background:#0b0d0c;border-top:1px solid #1c211e;font:500 13px/1 ui-sans-serif,system-ui,sans-serif;box-sizing:border-box}'
    +'#tlinks{flex:1 1 auto;min-width:0;display:flex;flex-wrap:nowrap;align-items:center;gap:0 2px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent)}'
    +'#tlinks::-webkit-scrollbar{display:none}'
    +'#tlinks a{min-height:44px!important;padding:0 10px!important}'
    +'#tbarMore{order:99;flex:none}'
    /* the old floating "⌂ hub" pill (30 pages) repeats the bar's own ⌂ and sat where the orb floats: the bar is the one way home */
    +'#bnr-beta-badge{display:none!important}'
    +'@media(max-width:520px){#tbar:not(.t-open) #railsbadge{display:none!important}}'
    +'#tbar.t-open{flex-wrap:wrap;align-items:flex-start;max-height:78vh;overflow-y:auto;padding:8px 56px 10px 8px;row-gap:8px}'
    +'#tbar.t-open #tlinks{flex:1 1 100%;flex-wrap:wrap;overflow:visible;row-gap:4px;-webkit-mask-image:none;mask-image:none}'
    +'#tbar.t-open #tlinks .tsep{width:100%!important;height:1px!important;align-self:auto!important;margin:2px 0!important}'
    +'#tbar.t-open #tbarMore{position:absolute;top:8px;right:8px}'
    +'#tbar.t-open #railsbadge{order:-1;display:block!important;flex:1 1 100%;margin:0!important;padding:0!important;border:0!important;line-height:1.6}'
    +'#tbar.t-open #blangctl{order:-2;border:0!important;padding:0!important}'
    +'#blangsel{color:inherit!important;background:transparent!important;border:1px solid rgba(140,150,145,.55)!important}'
    +'#blangsel option{color:#0c1412;background:#fff}';
  document.head.appendChild(css);
  b.appendChild(lane);
  lane.innerHTML=L.map(function(x){
    if(x==='—')return '<span class="tsep" style="align-self:stretch;width:1px;background:#333;margin:0 4px;flex-shrink:0"></span>';
    var h=(R+x[1])===location.pathname.replace(/index.html$/,'');
    return '<a'+(h?' aria-current="page"':'')+' href="'+R+x[1]+'" style="color:'+(h?'#6f6':'#9aa39d')+';background:'+(h?'#16241d':'transparent')+';box-shadow:'+(h?'inset 0 0 0 1px #2b4a3b':'none')+';border-radius:6px;text-decoration:none;display:inline-flex;align-items:center;flex-shrink:0;white-space:nowrap">'+x[0]+'</a>';
  }).join('');
  if(inlineHost){
    b.style.cssText='position:static;display:flex;flex-wrap:wrap;gap:8px;padding:16px 0;font:14px/1.5 system-ui,sans-serif;background:none;border:0';
    lane.style.cssText='flex-wrap:wrap;overflow:visible;gap:8px;-webkit-mask-image:none;mask-image:none';
    inlineHost.appendChild(b);
  }else document.body.appendChild(b);

  /* the toggle: in the bar, after the riders; only earns its place when the links overflow */
  var tg=document.createElement('button');tg.id='tbarMore';tg.type='button';
  tg.setAttribute('aria-controls','tbar');tg.setAttribute('aria-expanded','false');
  tg.setAttribute('aria-label','Show all navigation');
  tg.style.cssText='min-width:44px;min-height:44px;border:1px solid #2b4a3b;border-radius:8px;background:#0f1512;color:#8fbf9f;font:600 16px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer;display:none;align-items:center;justify-content:center;margin:0;padding:0 10px';
  b.appendChild(tg);

  /* MOBILE-FIRST: if the strip cannot fit, the grid is the DEFAULT, not a tap away.
     All 39 land on screen at 390px; the toggle then COLLAPSES to the strip. */
  var open=null;
  function overflowing(){ return lane.scrollWidth>lane.clientWidth+2; }
  function apply(){
    if(inlineHost){ tg.style.display='none'; return; }
    b.classList.toggle('t-open',!!open);
    if(open){
      tg.textContent='×'; tg.style.background='#0f1512'; tg.style.color='#8fbf9f'; tg.setAttribute('aria-expanded','true'); tg.setAttribute('aria-label','Hide navigation');
    }else{
      tg.textContent='☰'; tg.style.background='#16241d'; tg.style.color='#6f6'; tg.setAttribute('aria-expanded','false'); tg.setAttribute('aria-label','Show all navigation');
    }
  }
  function sync(){ if(inlineHost) return; tg.style.display = (open||overflowing()||window.innerWidth<=520) ? 'inline-flex' : 'none'; }
  tg.addEventListener('click',function(){ open=!open; apply(); sync(); });
  addEventListener('resize',function(){ if(!open) sync(); });
  /* DRAWER, not a permanent grid. Open-by-default measured 379px at 390px — 47%
     of the viewport, fixed, forever. That trades "cannot find a link" for "cannot
     see the page", which is not a better nav. Closed is the compact strip; ONE tap
     opens every link at once. The toggle is always visible while the strip
     overflows, so the drawer is discoverable rather than hidden. */
  /* MEASURED, not chosen: default-open renders a 379px grid (47% of a 390x800
     viewport) that INTERCEPTS POINTER EVENTS over the page beneath it. The suite
     goes from 74 passed / 0 failed to 14 pointer-interception errors and a crash;
     a reader hits the same wall, silently. So the grid is one tap away, not the
     resting state — all 39 on screen at 390px with no scroll the moment it opens. */
  open = false;
  apply(); sync();

  /* Reserve the bar's own room, and never take room a page already reserved.
     tour.js owns this because the bar is tour.js's: a page should not have to
     know a fixed bar was injected under it. Re-measured after the riders mount
     (they change the bar's height) and on resize. */
  function fitPad(){
    if(inlineHost) return;
    var bar=document.getElementById('tbar'); if(!bar) return;
    var h=Math.ceil(bar.getBoundingClientRect().height); if(!h) return;
    /* PUBLISHED, not just reserved (2026-09-20): body padding only clears the
       bar for in-flow content. A page's OWN fixed or sticky bottom row (a
       sheet's action buttons, a sticky toolbar) cannot read that padding, so
       the height is also published as --tbar-h on <html>; a page anchors with
       bottom:var(--tbar-h,0) and never has to know the bar's number. Measured
       on the resting strip: the open drawer covers the page by design. */
    document.documentElement.style.setProperty('--tbar-h',h+'px');
    var need=h+22;
    var cur=parseFloat(getComputedStyle(document.body).paddingBottom)||0;
    if(cur<need) document.body.style.paddingBottom=need+'px';
  }
  if(!inlineHost) document.body.style.paddingBottom='69px'; /* fail-safe before measurement */
  else document.documentElement.style.setProperty('--tbar-h','0px'); /* in-flow bar takes no fixed room */
  fitPad();
  document.addEventListener('bregister',function(){sync();fitPad();});
  setTimeout(fitPad,500);   /* after register/lang/rails mount into the bar */
  setTimeout(fitPad,1500);
  addEventListener('resize',fitPad);

  /* MODAL RETREAT (2026-09-20, measured on the live MY SPACE page at 390x844):
     the bar sits at z-index 9998, ABOVE any page dialog, so a bottom sheet's
     action row lost its lowest 18px of 52px under the strip and 121px² more
     under the toggle — taps landed, but only because the centre stayed clear.
     A modal dialog blocks the page beneath it by definition; the estate nav
     is part of that page. So while an aria-modal dialog (or a <dialog> opened
     with showModal) is rendered, the bar and its toggle retreat with
     visibility:hidden — layout, body padding and the riders' seats stay put,
     nothing reflows, and the bar returns the moment the dialog closes. Owned
     here, once, so no surface has to repeat it. */
  var modalUp=false, modalRaf=0;
  function modalSel(){ try{ document.querySelector('dialog:modal'); return 'dialog:modal,[aria-modal="true"]'; }catch(e){ return 'dialog[open],[aria-modal="true"]'; } }
  var MODAL=modalSel();
  function modalShown(){
    var ds=document.querySelectorAll(MODAL);
    for(var i=0;i<ds.length;i++){
      var d=ds[i]; if(d.closest('#tbar,#tbarMore,#adWin,#adPanel')) continue;
      var cs=getComputedStyle(d); if(cs.display==='none'||cs.visibility==='hidden') continue;
      var r=d.getBoundingClientRect(); if(r.width>0&&r.height>0) return true;
    }
    return false;
  }
  function retreat(){
    modalRaf=0;
    if(inlineHost) return;
    var up=modalShown(); if(up===modalUp) return;
    modalUp=up;
    b.style.visibility=up?'hidden':''; tg.style.visibility=up?'hidden':'';
    if(up) b.setAttribute('aria-hidden','true'); else b.removeAttribute('aria-hidden');
  }
  function retreatSoon(){ if(!modalRaf) modalRaf=requestAnimationFrame(retreat); }
  if(!inlineHost&&window.MutationObserver){
    new MutationObserver(retreatSoon).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open','class','style','hidden','aria-hidden','aria-modal','data-state']});
    retreat();
  }

  /* THE EXTERNAL-LINK LAW (founder, 2026-08-21): every hyperlink that leaves the dApp
     opens in a NEW tab, so the reader's BNRoSe session stays handy and fully functional.
     Enforced at click time by delegation — covering links rendered after load (several
     surfaces build their citation lists from JS) — with rel=noopener so the opened page
     gets no handle back into the dApp, and noreferrer so the page URL does not travel
     to the destination as a Referer (the z2.sec cluster fix; surfaces that hand-wrote
     rel="noopener noreferrer" already carried both). In-estate links keep the same tab:
     the tour IS the session. */
  document.addEventListener('click',function(e){
    var a=e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    var u; try{ u=new URL(a.getAttribute('href'), location.href); }catch(err){ return; }
    if((u.protocol==='http:'||u.protocol==='https:') && u.host!==location.host){
      a.target='_blank';
      var rel=(a.rel||'').split(/\s+/).filter(Boolean);
      ['noopener','noreferrer'].forEach(function(t){ if(rel.indexOf(t)===-1) rel.push(t); });
      a.rel=rel.join(' ');
    }
  },true);

  /* the language toggle (every corpus-docked tongue, corpus-law honest) rides every page — see lang.js */
  function loadLanguage(){
    if(document.getElementById('blangctl')) return;
    var s2=document.createElement('script');
    s2.src=assetBase+'lang.js?v=26';
    document.body.appendChild(s2);
  }
  /* Mount view labels before language scans them. Independent async loads
     could otherwise leave the newly inserted buttons in English. */
  if(!document.getElementById('bregctl')){
    var s=document.createElement('script');
    s.src=assetBase+'register.js?v=10';
    s.onload=loadLanguage; s.onerror=loadLanguage;
    document.body.appendChild(s);
  }else loadLanguage();

  /* the rails badge — every surface's reassurance line: soul 0x fingerprint +
     LIVE rails (founder word, 2026-08-22). Rides the tbar like the registers. */
  if(!document.getElementById('railsbadge')){
    var s3=document.createElement('script');
    s3.src=assetBase+'rails-badge.js?v=4';
    document.body.appendChild(s3);
  }
})();
