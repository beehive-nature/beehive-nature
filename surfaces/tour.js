/* tour.js — the universal ecosystem nav. Every surface, one bar.
   v6: THE WALL FIX — the bar is now a single scrollable line on narrow screens,
   never growing taller than ~44px. On wide screens it wraps naturally.
   The 24-link bar wrapping to 24 lines on a phone WAS the wall of black. */
(function(){
  if(document.getElementById('tourbar')) return;
  var ROOT = location.pathname.indexOf('/beehive-nature/')===0 ? '/beehive-nature/surfaces/' : '/surfaces/';
  var P=[['⌂',''],['fLeeT','blight/'],['gallery','blight/gallery.html'],['explorer','blight/inscription-explorer.html'],
    ['workbench','blight/workbench.html'],['catalog','blight/compare.html'],['organ','blight/midi-organ.html'],
    ['studio','blight/studio-music.html'],['bNRi','blight/bnri-gallery.html'],['gate','blight/studio-gate.html'],
    ['C-1','blight/c1-aid.html'],['vaulta','blight/vaulta-reader.html'],['museum','blight/museum.html'],
    ['market','blight/market.html'],['farmers','blight/farmers.html'],['coop','blight/coop.html'],
    ['pulse','blight/pulse.html'],['hearth','blight/hearth.html'],
    ['dao','../dao-dashboard/'],['hw','hardware/'],['keys','onboarding/'],['dids','keys/addresses.html'],['recover','recover.html']];
  var bar=document.createElement('nav');
  bar.id='tourbar';
  bar.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9998;'+
    'display:flex;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;gap:2px 10px;'+
    'padding:6px 12px;background:#0a0a0fee;border-top:1px solid #262638;'+
    'font:11px ui-monospace,Menlo,monospace;-webkit-overflow-scrolling:touch;'+
    'scrollbar-width:none;-ms-overflow-style:none;white-space:nowrap;max-height:44px;box-sizing:border-box';
  bar.innerHTML=P.map(function(p){
    var here=(ROOT+p[1])===location.pathname.replace(/index\.html$/,'');
    return '<a href="'+ROOT+p[1]+'" style="color:'+(here?'#00FF41':'#5a6478')+';text-decoration:none;padding:2px 4px;'+
      'flex-shrink:0;'+(here?'border:1px solid #1d3a26;border-radius:3px':'')+'">'+p[0]+'</a>';
  }).join('');
  document.body.appendChild(bar);
  document.body.style.paddingBottom='54px';
  bar.addEventListener('scroll',function(){});
})();
