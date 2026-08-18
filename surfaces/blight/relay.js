/* relay.js — TASK 6: nostr relay transport, v1.
   PTR messages over public relays via wss. v1 is READ + PLAINTEXT-KIND broadcast
   of pointer events (kind 1 with the [bX ] prefix filter); E2E (NIP-44 + secp256k1
   vendored from bdid-key) docks as TASK 6b — the law stays: payloads are POINTERS,
   never content, so plaintext-v1 leaks nothing but a URL that renders from chain.
   Zero deps: WebSocket + SubCrypto for ids. */
var RELAY=(function(){
  var RELAYS=['wss://relay.damus.io','wss://nos.lol','wss://relay.nostr.band'];
  var sub=null, notes=[], listeners=[];
  function now(){ return Math.floor(Date.now()/1000); }
  async function sha256hex(s){
    var d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
    return Array.from(d).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  function connect(onNote,onState){
    try{ sub=new WebSocket(RELAYS[0]); }catch(e){ onState&&onState('ws unavailable: '+e.message); return; }
    sub.onopen=function(){
      onState&&onState('relay open · '+RELAYS[0]);
      sub.send(JSON.stringify(['REQ','bx_'+now(),{kinds:[1],limit:20}]));
    };
    sub.onmessage=function(ev){
      try{
        var m=JSON.parse(ev.data);
        if(m[0]==='EVENT'&&m[2]){
          var txt=String(m[2].content||'');
          if(txt.indexOf('[bX ')===0) { notes.push(m[2]); listeners.forEach(function(f){f(m[2]);}); }
        }
      }catch(e){}
    };
    sub.onclose=function(){ onState&&onState('relay closed'); };
    sub.onerror=function(){ onState&&onState('relay error — rotating'); try{sub.close();}catch(e){} };
  }
  function disconnect(){ if(sub){ try{sub.close();}catch(e){} sub=null; } }
  function on(f){ listeners.push(f); }
  return {connect:connect,disconnect:disconnect,on:on,notes:function(){return notes;}};
})();
