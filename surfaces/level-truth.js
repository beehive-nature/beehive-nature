/* level-truth.js — SHARED level-truth module.
   One table, one lvlOf, one pips renderer, one calldata builder — used by
   market.html and museum.html so a collection's level math can never drift
   between surfaces again (LANE_MARKET_TRUTH_2026-08-28 findings,
   generalized 2026-08-28; the getSvg/getMeta calldata bug fixed and the
   o/u law corrected 2026-08-29, founder eye-catch #6).

   THE BUG THIS FILE FIXES (founder eye-catch #6, 2026-08-29): every card
   showed the MAX ladder tier while getSvg rendered the LOWEST-tier art.
   Root cause, verified against each contract's own Sourcify-verified
   source (`Generator.sol`, fetched live 2026-08-29): `getSvg`/`getMeta`
   take a single `SeedData calldata` STRUCT parameter whose fields
   (FUNGI/$FROGGI/JELLI: {seed,extra}; PEPI v1/v2: {seed,seed2,extra}) are
   ALL static `uint256` — a static struct is encoded as its fields in
   sequence, NO leading dynamic-offset word. The old code prepended a
   bogus offset word (`W(0x20)`) before the seed, which shifted every
   field over by one: the contract decoded `seed_data.seed` as the literal
   constant 32, and the real balance silently landed in the ignored
   `extra`/`seed2` field. `RandLib.lvl()` compares `rnd.seed` (=32) against
   thresholds starting at 1,000+ — so the art was ALWAYS the lowest tier,
   regardless of balance. Confirmed live: FUNGI garden balance 2,650,559 —
   broken calldata drew a 351-byte near-empty piece; correct calldata (two
   words, no offset) drew a 1,863-byte level-5 mushroom, and
   `getMeta`'s own `"level"` field read exactly 5, matching this module's
   `lvlOf` independently. Same confirmed for FROGGI (6), JELLI (5).

   THE SECOND BUG (PEPI only): PEPI's own `getItemData` does
   `data.lvl = rnd.lvl() + 1` — FUNGI's `getMushroom` does
   `data.lvl = rnd.lvl()`, no +1. Two different contracts, two different
   display conventions, cited from each's own source. `lvlOffset` below
   carries that difference explicitly per collection instead of silently
   guessing one convention for all five.

   `driver` states what each collection's level is actually computed FROM
   — balanceOf (the caller's own holdings) or seed (a value threaded in by
   the caller, e.g. a listing amount) — so a surface can cite it per
   card/plinth instead of asserting "level" as if it were one uniform
   thing. `seed` IS the correct name for the normalized whole-token value:
   it is exactly `SeedData.seed`, the contract's own field name — never
   raw, undivided balance (that would double-count the decimals() division
   the contract itself does not re-apply).

   THE O/U LABEL, corrected: `ou:true` used to mark FUNGI, $FROGGI and
   PEPI v1 as carrying a chain-art/ladder disagreement (founder testimony,
   "under verification" per SPEC-ERC20I-MECHANICS-1.md §10). With the
   calldata bug fixed, `verifyLevel()` below was run live against every
   collection's own `getMeta` for real holdings: ALL FIVE agreed exactly
   with this module's `lvlOf` (FUNGI 5, FROGGI 6, JELLI 5, PEPI v2 6, PEPI
   v1 6 — the last two only after `lvlOffset:1` is applied). No genuine
   contract-side divergence survived. Per the standing law — "agreement is
   the pass; only a genuine, cited contract-side divergence keeps the o/u
   label" — every `ou` flag is REMOVED. The apparent bug was this file's
   own arithmetic the whole time. */
(function(global){
'use strict';

var HOSTS = ['https://base-rpc.publicnode.com', 'https://base.drpc.org'];

var COLLECTIONS = [
  {sym:'FUNGI',   c:'0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F', sel:'422b9e23', metaSel:'c3f4552a',
   lv:[0,21000,525000,1050000,1575000,2100000], fields:2, lvlOffset:0, driver:'balanceOf'},
  {sym:'$FROGGI', c:'0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE', sel:'422b9e23', metaSel:'c3f4552a',
   lv:[0,1000,3000,10000,30000,60000,120000], fields:2, lvlOffset:0, driver:'balanceOf'},
  {sym:'JELLI',   c:'0xA1b9d812926a529D8B002E69FCd070c8275eC73c', sel:'422b9e23', metaSel:'c3f4552a',
   lv:[0,1000,21000,105000,420000,1050000], fields:2, lvlOffset:0, driver:'balanceOf'},
  {sym:'PEPI v2', c:'0x28a5e71BFc02723eAC17E39c84c5190415C0de9F', sel:'a435130b', metaSel:'63f6e78c',
   lv:[0,11,22,33,44,56], fields:3, lvlOffset:1, driver:'balanceOf'},
  {sym:'PEPI v1', c:'0x19706c142d33376240e418d6385f05691a5fa8e2', sel:'a435130b', metaSel:'63f6e78c',
   lv:[0,11,22,33,44,56], fields:3, lvlOffset:1, driver:'balanceOf'}
];

function W(v){ return BigInt(v).toString(16).padStart(64,'0'); }
function AD(a){ return '0'.repeat(24) + a.replace(/^0x/,'').toLowerCase(); }

/* the ONE place SeedData calldata is built. A static struct (every field
   is uint256) is encoded as its fields back to back — NO offset word.
   2-field collections: [seed][extra]. 3-field collections (PEPI): the
   contract's own field order is [seed][seed2][extra] — seed2 drives only
   palette, never level (`RandLib.next2`), but seed2=0 underflows
   (`0 + nonce++ - 1`), so a preview call substitutes seed2=1 when the
   caller doesn't have the account's real captured seed2 on hand; this is
   flagged, not hidden — palette may not match the piece's true locked
   colours, level is unaffected because level reads `seed` alone. */
function seedCallData(col, selector, seed, extra, seed2){
  var body = col.fields === 3
    ? W(seed) + W(seed2 === undefined ? 1 : seed2) + W(extra || 0)
    : W(seed) + W(extra || 0);
  return '0x' + selector + body;
}
function svgCallData(col, seed, extra, seed2){ return seedCallData(col, col.sel, seed, extra, seed2); }
function metaCallData(col, seed, extra, seed2){ return seedCallData(col, col.metaSel, seed, extra, seed2); }

function decodeString(hex){
  var h = hex.replace(/^0x/,'');
  var off = parseInt(h.slice(0,64),16); if(!(off===0x20)) throw 0;
  /* cap raised 2026-08-29 (16384 -> 131072): FROGGI's real level-6 SVG,
     recovered by the eye-catch #6 calldata fix, is 31,411 bytes — the old
     cap silently dropped the card (catch-and-skip at the call site) rather
     than render it, which is exactly the kind of quiet loss the corner law
     forbids. 131072 (128 KB) gives real headroom above every collection's
     largest observed piece while still bounding a malformed/hostile
     response. */
  var len = parseInt(h.slice(off*2,off*2+64),16); if(!(len>=0 && len<=131072)) throw 0;
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

/* the level a value climbs to on a collection's own ladder, INCLUDING the
   contract's own display offset (PEPI: +1, cited above) — the ONE
   function both surfaces call, so "level" always means the same
   arithmetic AND matches what the contract itself would tell you via
   getMeta. */
function lvlOf(s, col){
  if(!col.lv) return null;
  var l = 0;
  for(var i=1;i<col.lv.length;i++) if(s>=col.lv[i]) l++;
  return l + (col.lvlOffset||0);
}
function pipmax(col){ return col.lv ? (col.lv.length-1) + (col.lvlOffset||0) : 0; }
function pips(n, max){
  var s='';
  for(var k=0;k<Math.max(max,1);k++) s += k<n ? '●' : '·';
  return s;
}

/* THE NEW GATE (permanent, per founder order 2026-08-29 item "eye-catch
   #6"): reads the collection's own getMeta live and compares its "level"
   field to this module's lvlOf for the same seed. Returns
   {agree, ours, theirs} — a surface calls this before ever printing an
   o/u label; the label is lawful ONLY when agree===false, and the
   disagreement + both numbers must be shown, never just asserted. */
async function verifyLevel(col, seed, extra, seed2){
  var res = await rpc([{to: col.c, data: metaCallData(col, seed, extra, seed2)}]);
  var ours = lvlOf(seed, col);
  if(!res || !res[0] || res[0] === '0x') return {agree: null, ours: ours, theirs: null, error: 'no read'};
  var json;
  try{ json = JSON.parse(decodeString(res[0])); }catch(e){ return {agree: null, ours: ours, theirs: null, error: 'undecodable'}; }
  var theirs = json && json.level;
  if(typeof theirs !== 'number') return {agree: null, ours: ours, theirs: theirs, error: 'no level field'};
  return {agree: theirs === ours, ours: ours, theirs: theirs};
}

global.LevelTruth = {HOSTS:HOSTS, COLLECTIONS:COLLECTIONS, W:W, AD:AD,
  decodeString:decodeString, rpc:rpc, lvlOf:lvlOf, pipmax:pipmax, pips:pips,
  svgCallData:svgCallData, metaCallData:metaCallData, verifyLevel:verifyLevel};
})(window);
