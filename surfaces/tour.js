(function(){
  if(document.getElementById('tbar'))return;
  var R=location.pathname.indexOf('/beehive-nature/')===0?'/beehive-nature/surfaces/':'/surfaces/';
  var L=[['⌂',''],['art','blight/index.html'],['explore','blight/inscription-explorer.html'],
    ['catalog','blight/compare.html'],['museum','blight/museum.html'],
    '—',
    ['market','blight/market.html'],['farm','blight/farmers.html'],['coop','blight/coop.html'],
    '—',
    ['organ','blight/midi-organ.html'],['studio','blight/studio-music.html'],['pulse','blight/pulse.html'],['hearth','blight/hearth.html'],
    '—',
    ['keys','onboarding/'],['dids','keys/addresses.html'],['recover','recover.html'],['hw','hardware/']];
  var b=document.createElement('nav');b.id='tbar';
  b.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9998;display:flex;flex-wrap:nowrap;overflow-x:auto;gap:0 8px;padding:6px 12px;background:#111;border-top:1px solid #333;font:11px monospace;-webkit-overflow-scrolling:touch;scrollbar-width:none;white-space:nowrap;max-height:40px;box-sizing:border-box';
  b.innerHTML=L.map(function(x){
    if(x==='—')return '<span style="color:#444">|</span>';
    var h=(R+x[1])===location.pathname.replace(/index.html$/,'');
    return '<a href="'+R+x[1]+'" style="color:'+(h?'#6f6':'#888')+';text-decoration:none;padding:2px 4px;flex-shrink:0">'+x[0]+'</a>';
  }).join('');
  document.body.appendChild(b);
  document.body.style.paddingBottom='48px';
})();