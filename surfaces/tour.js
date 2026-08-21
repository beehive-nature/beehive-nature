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
    '—',
    ['reader','blight/vaulta-reader.html'],['c1','blight/c1-aid.html'],
    '—',
    ['keys','onboarding/'],['receive','onboarding/receive.html'],['dids','keys/addresses.html'],['recover','recover.html'],['hw','hardware/'],
    '—',
    ['🎓','university/'],['🐝','bqueenbee-live.html'],['🎧','listening.html'],['⬡','bfood.html'],['🏛','bsymposium.html'],['⚙','stack.html']];
  var b=document.createElement('nav');b.id='tbar';
  b.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9998;display:flex;flex-wrap:nowrap;overflow-x:auto;gap:0 8px;padding:6px 12px;background:#111;border-top:1px solid #333;font:11px monospace;-webkit-overflow-scrolling:touch;scrollbar-width:none;white-space:nowrap;max-height:40px;box-sizing:border-box';
  b.innerHTML=L.map(function(x){
    if(x==='—')return '<span style="color:#444">|</span>';
    var h=(R+x[1])===location.pathname.replace(/index.html$/,'');
    return '<a href="'+R+x[1]+'" style="color:'+(h?'#6f6':'#888')+';text-decoration:none;padding:2px 4px;flex-shrink:0">'+x[0]+'</a>';
  }).join('');
  document.body.appendChild(b);
  document.body.style.paddingBottom='48px';

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
    s.src=R+'register.js?v=1';
    document.body.appendChild(s);
  }
  /* the language toggle (18 tongues, corpus-law honest) rides every page — see lang.js */
  if(!document.getElementById('blangctl')){
    var s2=document.createElement('script');
    s2.src=R+'lang.js?v=1';
    document.body.appendChild(s2);
  }
})();