/* pointers.js — TASK 5: the DM payload law, as a library.
   THE LAW: a message is a POINTER, never content. The room/order/piece renders
   from chain state; the DM stays thin, replayable, unforgeable-by-spam.
   Format (one line, human-readable, machine-parseable):
     [bX kind] label — url — from: bsy:… | npub:… — note (<=140 chars)
   Adopt: include pointers.js, call PTR.* — every surface converges on one grammar. */
var PTR=(function(){
  var DIDS={bsy:null,npub:null};
  function bind(bsy,npub){ DIDS.bsy=bsy||null; DIDS.npub=npub||null; }
  function fromLine(){
    var f=[];
    if(DIDS.bsy) f.push('bsy: '+DIDS.bsy);
    if(DIDS.npub) f.push('npub: '+DIDS.npub);
    if(!f.length) f.push('bind: '+location.origin+location.pathname.replace(/[^/]*$/,'')+'../keys/addresses.html');
    return f.join(' | ');
  }
  function base(){
    return location.origin+location.pathname.replace(/[^/]*$/,'');
  }
  function emit(kind,label,url,note){
    var parts=['[bX '+kind+']',label,'—',url,'— from:',fromLine()];
    if(note) parts.push('— note:',String(note).slice(0,140));
    return parts.join(' ');
  }
  return {
    bind:bind,
    room:function(sym,seed,note){ return emit('room',sym+' seed '+seed,base()+'market.html?piece='+encodeURIComponent(sym+':'+seed),note); },
    piece:function(sym,seed,note){ return emit('room',sym+' seed '+seed,base()+'inscription-explorer.html',note); },
    order:function(orderId,note){ return emit('order','order '+orderId,base()+'market.html?order='+encodeURIComponent(orderId),note); },
    song:function(seed,note){ return emit('song','seed '+seed,base()+'midi-organ.html?seed='+seed,note); },
    score:function(scoreB64,note){ return emit('score','a composition',base()+'studio-music.html?score='+encodeURIComponent(scoreB64),note); },
    accord:function(sym,seed,note){ return emit('accord','bAccord '+sym+' seed '+seed,base()+'farmers.html',note); },
    fromLine:fromLine
  };
})();
