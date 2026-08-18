/* tour.js — the universal ecosystem nav. Every surface, one bar, path-aware.
   No decor. Inject into <body> end: <div id="tour"></div><script src=".../tour.js"></script> */
(function(){
  if(document.getElementById('tourbar')) return;
  var ROOT = location.pathname.indexOf('/beehive-nature/')===0 ? '/beehive-nature/surfaces/' : '/surfaces/';
  var P=[['⌂ hub',''],['fLeeT','blight/'],['museum','blight/museum.html'],['explorer','blight/inscription-explorer.html'],['workbench','blight/workbench.html'],
    ['catalog','blight/compare.html'],['organ','blight/midi-organ.html'],['music studio','blight/studio-music.html'],['bNRi gallery','blight/bnri-gallery.html'],
    ['studio gate','blight/studio-gate.html'],['C-1 aid','blight/c1-aid.html'],['vaulta reader','blight/vaulta-reader.html'],
    ['hardware','hardware/'],['key build','onboarding/'],['recover','recover.html']];
  var bar=document.createElement('nav');
  bar.id='tourbar';
  bar.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9998;display:flex;flex-wrap:wrap;gap:2px 10px;'+
    'padding:6px 12px;background:#0a0a0fee;border-top:1px solid #262638;font:11px ui-monospace,Menlo,monospace;'+
    'backdrop-filter:blur(4px)';
  bar.innerHTML=P.map(function(p){
    var here=(ROOT+p[1])===location.pathname.replace(/index\.html$/,'');
    return '<a href="'+ROOT+p[1]+'" style="color:'+(here?'#00FF41':'#5a6478')+';text-decoration:none;padding:2px 4px;'+
      (here?'border:1px solid #1d3a26;border-radius:3px':'')+'">'+p[0]+'</a>';
  }).join('');
  document.body.appendChild(bar);
  document.body.style.paddingBottom='46px';
})();
