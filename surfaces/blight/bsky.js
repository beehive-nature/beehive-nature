/* bsky.js — TASK 7: ATProto transport, v1. READ path first, zero deps:
   the public AppView API (no account needed) searched for the [bX pointer
   grammar — same law, second rail. Post path (write) needs a session and
   docks with the bzDiD did:plc binding (TASK 1 engine wiring); v1 keeps the
   house static-clean: fetch-only, CORS-open, no keys in the page. */
var BSKY=(function(){
  var VIEW='https://public.api.bsky.app/xrpc';
  async function searchPointer(q,cb,err){
    try{
      var ctl=new AbortController(); var kill=setTimeout(function(){ctl.abort();},10000);
      var r=await fetch(VIEW+'/app.bsky.feed.searchPosts?q='+encodeURIComponent(q||'[bX')+'&limit=25',
        {headers:{'User-Agent':'gallery/1.0'},signal:ctl.signal});
      clearTimeout(kill);
      var j=await r.json();
      (j.posts||[]).forEach(function(p){
        var txt=String((p.record&&p.record.text)||'');
        if(txt.indexOf('[bX')>-1&&cb) cb({
          text:txt,
          author:(p.author&&(p.author.handle||p.author.did))||'?',
          at:(p.indexedAt||'').slice(0,19),
          uri:p.uri||''
        });
      });
    }catch(e){ err&&err(e.message); }
  }
  return {searchPointer:searchPointer};
})();
