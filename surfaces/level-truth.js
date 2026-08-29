/* level-truth.js — SHARED level-truth module.
   One table, one lvlOf, one pips renderer — used by market.html and
   museum.html so a collection's level math can never drift between surfaces
   again (LANE_MARKET_TRUTH_2026-08-28 findings, generalized 2026-08-28).

   Per-collection ladders are cited against contract bytecode (PUSH-operand
   census of eth_getCode on Base) in LANE_MARKET_TRUTH_2026-08-28.md §1.
   `driver` states what each collection's level is actually computed FROM —
   balanceOf (the caller's own holdings) or seed (a value threaded in by the
   caller, e.g. a listing amount) — so a surface can cite it per card/plinth
   instead of asserting "level" as if it were one uniform thing.
   `ou:true` marks collections carrying the over/under bug (law 4): the art
   the contract draws for a given amount does not reliably match the ladder
   tier that amount implies — declared and rendered anyway, never hidden. */
(function(global){
'use strict';

var HOSTS = ['https://base-rpc.publicnode.com', 'https://base.drpc.org'];

var COLLECTIONS = [
  {sym:'FUNGI',   c:'0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F', sel:'422b9e23',
   lv:[0,21000,525000,1050000,1575000,2100000], base:0, ou:true, driver:'balanceOf'},
  {sym:'$FROGGI', c:'0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE', sel:'422b9e23',
   lv:[0,1000,3000,10000,30000,60000,120000], base:0, ou:true, driver:'balanceOf'},
  {sym:'JELLI',   c:'0xA1b9d812926a529D8B002E69FCd070c8275eC73c', sel:'422b9e23',
   lv:[0,1000,21000,105000,420000,1050000], base:0, driver:'balanceOf'},
  {sym:'PEPI v2', c:'0x28a5e71BFc02723eAC17E39c84c5190415C0de9F', sel:'a435130b',
   lv:[0,11,22,33,44,56], base:1, driver:'balanceOf'},
  {sym:'PEPI v1', c:'0x19706c142d33376240e418d6385f05691a5fa8e2', sel:'a435130b',
   lv:[0,11,22,33,44,56], base:1, ou:true, driver:'balanceOf'}
];

function W(v){ return BigInt(v).toString(16).padStart(64,'0'); }
function AD(a){ return '0'.repeat(24) + a.replace(/^0x/,'').toLowerCase(); }

function decodeString(hex){
  var h = hex.replace(/^0x/,'');
  var off = parseInt(h.slice(0,64),16); if(!(off===0x20)) throw 0;
  var len = parseInt(h.slice(off*2,off*2+64),16); if(!(len>=0 && len<=16384)) throw 0;
  var out = '';
  for(var i=0;i<len;i++){
    var b = parseInt(h.slice((off+32+i)*2,(off+32+i)*2+2),16);
    if(Number.isNaN(b)) throw 0;
    out += String.fromCharCode(b);
  }
  try{ return decodeURIComponent(escape(out)); }catch(e){ return out; }
}

async function rpc(calls){
  for(var hi=0; hi<HOSTS.length; hi++){
    var host = HOSTS[hi];
    var ctl = new AbortController();
    var kill = setTimeout(function(){ ctl.abort(); }, 8000);
    try{
      var r = await fetch(host, {method:'POST', headers:{'Content-Type':'application/json'}, signal:ctl.signal,
        body: JSON.stringify(calls.map(function(c,i){ return {jsonrpc:'2.0', id:i, method:'eth_call', params:[{to:c.to, data:c.data}, 'latest']}; }))});
      var j = await r.json();
      clearTimeout(kill);
      if(Array.isArray(j)) return j.map(function(x){ return x.result ?? null; });
    }catch(e){ clearTimeout(kill); }
  }
  return null;
}

/* the level a value climbs to on a collection's own ladder — the ONE
   function both surfaces call, so "level" always means the same arithmetic */
function lvlOf(s, col){
  if(!col.lv) return null;
  var l = col.base;
  for(var i=1;i<col.lv.length;i++) if(s>=col.lv[i]) l++;
  return l - col.base;
}
/* NOTE: `base` cancels out inside lvlOf (l starts at col.base, then the
   function returns l-col.base) — so lvlOf's range is always 0..lv.length-1
   regardless of base. pipmax must match that same range or the dots
   silently truncate a real level off the top (caught 2026-08-28: PEPI's
   base:1 collections rendered "level 5 of 4" on the museum plinth once the
   raw number was shown honestly instead of only feeding pips()). */
function pipmax(col){ return col.lv ? col.lv.length-1 : 0; }
function pips(n, max){
  var s='';
  for(var k=0;k<Math.max(max,1);k++) s += k<n ? '●' : '·';
  return s;
}

global.LevelTruth = {HOSTS:HOSTS, COLLECTIONS:COLLECTIONS, W:W, AD:AD,
  decodeString:decodeString, rpc:rpc, lvlOf:lvlOf, pipmax:pipmax, pips:pips};
})(window);
