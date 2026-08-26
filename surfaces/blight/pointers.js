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
    if(!f.length) f.push('bind: '+base().replace(/blight\/$/,'')+'keys/addresses.html');
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
    /* [bX kandi] — a bead stack shown to the floor. The piece IS its seed: a
       KND1 string is ~30 chars and the bracelet renders from it, so the
       pointer stays thin exactly as the law requires (same shape as song/score).
       #k= NOT ?k=: a fragment is never sent to the server, so a shared piece
       never lands in a request log. A query string would have. */
    kandi:function(str,note){ return emit('kandi',(String(str).split('|')[4]||'').length+' beads', base().replace(/blight\/$/,'')+'kandi.html#k='+encodeURIComponent(str),note); },
    song:function(seed,note){ return emit('song','seed '+seed,base()+'midi-organ.html?seed='+seed,note); },
    score:function(scoreB64,note){ return emit('score','a composition',base()+'studio-music.html?score='+encodeURIComponent(scoreB64),note); },
    accord:function(sym,seed,note){ return emit('accord','bAccord '+sym+' seed '+seed,base()+'farmers.html',note); },
    /* [bX review] — a peer-review receipt (DISPATCH_BMESSENGER_GUARDS_BLOVERAI §2):
       attestation, never telemetry. path is repo-relative under surfaces/. */
    review:function(path,verdict,note){ return emit('review',verdict+' '+path,base()+path,note); },
    /* [bX guard] — a Royal-guard verdict on a review receipt, referenced by the
       first 12 hex of sha256(receipt line). Guards weight, never gate (§3). */
    guard:function(refId,verdict,note){ return emit('guard',verdict+' review:'+refId,base().replace(/blight\/$/,'')+'review.html',note); },
    fromLine:fromLine
  };
})();
