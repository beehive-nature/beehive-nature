(function(){
  if(document.getElementById('tbar'))return;
  var R=location.pathname.indexOf('/beehive-nature/')===0?'/beehive-nature/surfaces/':'/surfaces/';
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
    ['keys','onboarding/'],['receive','onboarding/receive.html'],['dids','keys/addresses.html'],['recover','recover.html'],['hw','hardware/'],
    '—',
    ['🎓','university/'],['🐝','bqueenbee-live.html'],['🎧','listening.html'],['⬡','bfood.html'],['🏛','bsymposium.html'],['⚙','stack.html'],['🐜','bantfarm.html'],['♫','bset.html'],['🪩','plur.html'],['🎪','festival/'],['🎨','buzz-studio.html'],['⚒','forge/'],
      '—',
      ['⚑ the FLEET','fleet-hosted/'],
      ['acid','fleet-hosted/gallery/acid-cascade.html'],['indigo','fleet-hosted/gallery/indigo-index.html'],['resonance','fleet-hosted/gallery/resonance.html'],
      ['dash','fleet-hosted/lab/bnr-dashboard.html'],['flower','fleet-hosted/lab/flower-lab.html'],['spliff','fleet-hosted/lab/spliff-lab.html'],
      ['blend','fleet-hosted/lab/blend-lab.html'],['intake','fleet-hosted/lab/intake-tracker.html'],['edible','fleet-hosted/lab/edible-tracker.html']];
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
  b.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9998;display:flex;flex-wrap:nowrap;overflow-x:auto;gap:0 4px;padding:7px 12px;background:#0b0d0c;border-top:1px solid #1c211e;font:500 12px/1 ui-sans-serif,system-ui,sans-serif;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 34px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 34px),transparent)';
  b.innerHTML=L.map(function(x){
    if(x==='—')return '<span class="tsep" style="align-self:stretch;width:1px;background:#333;margin:0 4px;flex-shrink:0"></span>';
    var h=(R+x[1])===location.pathname.replace(/index.html$/,'');
    return '<a href="'+R+x[1]+'" style="color:'+(h?'#6f6':'#888')+';background:'+(h?'#16241d':'transparent')+';box-shadow:'+(h?'inset 0 0 0 1px #2b4a3b':'none')+';border-radius:6px;text-decoration:none;padding:6px 9px;min-height:32px;display:inline-flex;align-items:center;flex-shrink:0">'+x[0]+'</a>';
  }).join('');
  document.body.appendChild(b);

  /* the toggle: only earns its place when the strip actually overflows */
  var tg=document.createElement('button');tg.id='tbarMore';tg.type='button';
  tg.setAttribute('aria-controls','tbar');tg.setAttribute('aria-expanded','false');
  tg.setAttribute('aria-label','Show all navigation');
  tg.style.cssText='position:fixed;right:6px;z-index:9999;min-width:34px;min-height:32px;border:1px solid #2b4a3b;border-radius:6px;background:#0f1512;color:#8fbf9f;font:600 13px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer;display:none;align-items:center;justify-content:center';
  document.body.appendChild(tg);

  /* MOBILE-FIRST: if the strip cannot fit, the grid is the DEFAULT, not a tap away.
     All 39 land on screen at 390px; the toggle then COLLAPSES to the strip. */
  var open=null;
  function seatToggle(){ tg.style.bottom=Math.max(7,Math.round((b.getBoundingClientRect().height-32)/2))+'px'; }
  function overflowing(){ return b.scrollWidth>b.clientWidth+2; }
  function apply(){
    if(open){
      b.style.flexWrap='wrap'; b.style.overflowX='hidden'; b.style.overflowY='auto';
      b.style.maxHeight='78vh'; b.style.rowGap='6px'; b.style.paddingRight='46px';
      b.style.webkitMaskImage='none'; b.style.maskImage='none';
      /* dividers become full-width rules, so each group starts its own row */
      [].forEach.call(b.querySelectorAll('.tsep'),function(s){
        s.style.width='100%';s.style.height='1px';s.style.alignSelf='auto';s.style.margin='2px 0';});
      tg.textContent='×'; tg.style.background='#0f1512'; tg.style.color='#8fbf9f'; tg.setAttribute('aria-expanded','true'); tg.setAttribute('aria-label','Hide navigation');
    }else{
      b.style.flexWrap='nowrap'; b.style.overflowX='auto'; b.style.overflowY='hidden';
      b.style.maxHeight=''; b.style.rowGap=''; b.style.paddingRight='';
      b.style.webkitMaskImage='linear-gradient(90deg,#000 calc(100% - 34px),transparent)';
      b.style.maskImage='linear-gradient(90deg,#000 calc(100% - 34px),transparent)';
      [].forEach.call(b.querySelectorAll('.tsep'),function(s){
        s.style.width='1px';s.style.height='';s.style.alignSelf='stretch';s.style.margin='0 4px';});
      tg.textContent='☰'; tg.style.background='#16241d'; tg.style.color='#6f6'; tg.setAttribute('aria-expanded','false'); tg.setAttribute('aria-label','Show all navigation');
    }
    seatToggle();
  }
  function sync(){ tg.style.display = (open||overflowing()) ? 'inline-flex' : 'none'; seatToggle(); }
  tg.addEventListener('click',function(){ open=!open; apply(); sync(); });
  addEventListener('resize',function(){ if(!open) sync(); else seatToggle(); });
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
    var bar=document.getElementById('tbar'); if(!bar) return;
    var h=Math.ceil(bar.getBoundingClientRect().height); if(!h) return;
    var need=h+22;
    var cur=parseFloat(getComputedStyle(document.body).paddingBottom)||0;
    if(cur<need) document.body.style.paddingBottom=need+'px';
  }
  document.body.style.paddingBottom='69px'; /* fail-safe before measurement */
  fitPad();
  setTimeout(fitPad,500);   /* after register/lang/rails mount into the bar */
  setTimeout(fitPad,1500);
  addEventListener('resize',fitPad);

  /* THE EXTERNAL-LINK LAW (founder, 2026-08-21): every hyperlink that leaves the dApp
     opens in a NEW tab, so the reader's BNRoSe session stays handy and fully functional.
     Enforced at click time by delegation — covering links rendered after load (several
     surfaces build their citation lists from JS) — with rel=noopener so the opened page
     gets no handle back into the dApp. In-estate links keep the same tab: the tour IS
     the session. */
  document.addEventListener('click',function(e){
    var a=e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    var u; try{ u=new URL(a.getAttribute('href'), location.href); }catch(err){ return; }
    if((u.protocol==='http:'||u.protocol==='https:') && u.host!==location.host){
      a.target='_blank';
      a.rel=((a.rel||'')+' noopener').trim();
    }
  },true);

  /* the technical-register toggle (🐝/🎛/⚗) rides every page — see register.js */
  if(!document.getElementById('bregctl')){
    var s=document.createElement('script');
    s.src=R+'register.js?v=5';
    document.body.appendChild(s);
  }
  /* the language toggle (every corpus-docked tongue, corpus-law honest) rides every page — see lang.js */
  if(!document.getElementById('blangctl')){
    var s2=document.createElement('script');
    s2.src=R+'lang.js?v=17';
    document.body.appendChild(s2);
  }

  /* the rails badge — every surface's reassurance line: soul 0x fingerprint +
     LIVE rails (founder word, 2026-08-22). Rides the tbar like the registers. */
  if(!document.getElementById('railsbadge')){
    var s3=document.createElement('script');
    s3.src=R+'rails-badge.js?v=4';
    document.body.appendChild(s3);
  }
})();