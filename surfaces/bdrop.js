/* bdrop.js v5 — the drop desk's durable lifecycle.
   prepared → authorized → [signed | handoff] → submitted → confirmed → reconciled.
   The browser is a client, never the sole keeper: recoverable state (scope,
   body bytes, the signed transaction, the event log) persists in localStorage
   BEFORE submission and never contains a secret; a restart or a lost RPC
   response reconciles against the chain first — a landed drop is confirmed,
   never re-published; a diverged permlink is reported, never edited; an
   unexpired signed transaction re-broadcasts byte-identically without the key.
   A journal that cannot be read is QUARANTINED: bytes preserved verbatim,
   every parseable operation reconciled on its own against the chain, unresolved
   operations and unparseable residue keep new submissions refused — an explicit,
   dialog-confirmed archive is the only exit, never a silent empty rewrite.
   Signing has three doors, chosen explicitly, nothing auto-selected: the
   native BNR wallet signer — the estate's isolated keychain at keys.skaists.dev
   (the contract of issue #405, delivered: the desk checks the posting key is
   chain-authorized before asking, one press inside that origin signs, the
   returned signature is verified here against the drop's own digest, and the
   desk broadcasts through its own named endpoint), the Hive Keychain extension
   (external COMPATIBILITY; its upstream requestPost contract is pinned below —
   callback NINTH), and a one-scope in-tab paste held as zeroable bytes — never
   persisted, never logged, never sent; only the signed transaction travels.
   Recovery evidence
   keeps expected, chain-recovered and signature-bound hashes SEPARATE: a
   content read proves presence, never a signature — no commitment means
   UNVERIFIED, never MATCH. */
(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
if(!window.hiveTx){
  var pb0=$('publish');if(pb0)pb0.disabled=true;
  var st0=$('status');
  if(st0)st0.innerHTML='<span class="bad">the signing library did not load (onboarding/vendor/hive-tx.min.js). the desk cannot act — nothing was attempted.</span>';
  return;
}
var H=window.hiveTx;
var DISCLOSURE_VERSION='bdrop-0001-disclosure-v1';
var OUTBOX_KEY='bnr.bdrop.outbox.v1';
var OUTBOX_DAMAGED_KEY='bnr.bdrop.outbox.v1.damaged';
var EDITIONS_URL='../docs/bdrop/editions.json';
var ANT_KIT='/vendor/ant-browser-sdk/0.1.1/';
var RECEIPT_NEVER=['content','text','payload','plaintext','wif','key','secret'];
/* bMeter shape: events and references, never contents (bchat-core law) */
function ev(event,ref,meta){
  var r={event:event,ref:ref,ts:Date.now()};
  if(meta&&typeof meta==='object')Object.keys(meta).forEach(function(k){
    if(RECEIPT_NEVER.indexOf(k)<0)r[k]=meta[k];
  });
  return r;
}

/* ─── storage: bytes verbatim from a file, UTF-8 from a paste ─── */
var bodyBytes=null, bodyFrom=null;
function currentBytes(){
  if(bodyFrom==='file'&&bodyBytes)return bodyBytes;
  var t=$('body').value;
  return t?new TextEncoder().encode(t):null;
}
async function sha256Hex(buf){
  var d=await crypto.subtle.digest('SHA-256',buf);
  return Array.prototype.map.call(new Uint8Array(d),function(b){return('0'+b.toString(16)).slice(-2)}).join('');
}
function log(msg,cls){
  var box=$('status');
  var line=document.createElement('div');
  if(cls)line.className=cls;
  line.textContent=new Date().toISOString().slice(11,19)+' '+msg;
  box.appendChild(line);box.scrollTop=box.scrollHeight;
}

/* ─── the key session: zeroable bytes + one bound scope ─── */
var KEY={bytes:null,pub:null,scopeHash:null};
function canonicalScope(scope){
  return JSON.stringify(Object.keys(scope).sort().map(function(k){return[k,scope[k]]}));
}
async function currentScope(bodyHash){
  return {
    author:$('author').value.trim().toLowerCase(),
    permlink:slug($('permlink').value),
    title:$('title').value.trim(),
    parent_permlink:($('tags').value.split(/[\s,]+/).filter(Boolean)[0]||'hive'),
    tags:$('tags').value.split(/[\s,]+/).filter(Boolean).join(','),
    body_sha256:bodyHash,
    body_bytes:currentBytes()?currentBytes().length:0,
    disclosure_version:DISCLOSURE_VERSION,
    rpc:$('rpc').value.trim().replace(/\/+$/,'')
  };
}
async function bindKey(wif,scope){
  var pk;
  try{pk=H.PrivateKey.from(wif);}
  catch(e){return{err:'the key does not read as a WIF ('+e.message+') — nothing was sent.'};}
  var bytes=pk.key;               /* raw 32-byte seed, held zeroable */
  var pub=String(pk.createPublic());
  KEY.bytes=bytes;KEY.pub=pub;
  KEY.scopeHash=await sha256Hex(new TextEncoder().encode(canonicalScope(scope)));
  $('wif').value='';               /* the string copy dies with the field */
  return{pub:pub};
}
async function scopeMatches(scope){
  if(!KEY.bytes)return false;
  return KEY.scopeHash===await sha256Hex(new TextEncoder().encode(canonicalScope(scope)));
}
function wipe(){
  if(KEY.bytes){KEY.bytes.fill(0);KEY.bytes=null;}
  KEY.pub=null;KEY.scopeHash=null;
  $('wif').value='';
  renderKeySession();
  log('key session wiped: held bytes zeroed, references dropped. wiped-by-construction, not proven-erasure.','dim');
}
function renderKeySession(){
  var v=$('keysession');
  if(!KEY.bytes){v.hidden=true;return;}
  v.hidden=false;
  v.className='verdict match';
  v.textContent='key session live · '+KEY.pub+' · bound to this scope (permlink + body digest + disclosure version + endpoint). a scope change requires the key again.';
}

/* ─── the outbox: recoverable state, persisted before submission ───
   A journal that cannot be parsed is evidence of an uncertain past, not
   garbage: the raw bytes are preserved verbatim under the .damaged key and the
   working key is never touched. Every balanced object inside the damaged raw
   that parses as a record is a READABLE operation and is reconciled against
   the chain on its own; unresolved operations and the unparseable residue
   keep the whole desk refusing new submissions (QUARANTINE). Recovering one
   operation never clears uncertainty about the others. */
var CORRUPT=null; /* {raw,why,seen,ops[],statuses[],residue_bytes} */
function parseDamaged(raw){
  var ops=[],depth=0,start=-1,inStr=false,esc=false,covered=0;
  for(var i=0;i<raw.length;i++){
    var ch=raw[i];
    if(esc){esc=false;continue;}
    if(inStr){if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue;}
    if(ch==='"'){inStr=true;continue;}
    if(ch==='{'){if(depth===0)start=i;depth++;}
    else if(ch==='}'&&depth>0){depth--;if(depth===0&&start>=0){
      var span=raw.slice(start,i+1),o=null;
      try{o=JSON.parse(span);}catch(e){}
      if(o&&typeof o==='object'&&o.id&&o.stage&&o.scope){ops.push(o);covered+=span.length;}
      start=-1;
    }}
  }
  return {ops:ops,residue_bytes:Math.max(0,raw.length-covered)};
}
/* the quarantine ledger: unresolved operations carried OUT of damaged journals.
   Archiving reorganizes evidence; it reconciles nothing. An unresolved operation's
   uncertainty and its duplicate-prevention state survive restarts here — its scope
   stays refused until the chain establishes its fate, and an independent scope
   proceeds under its own guards. Expiry never resolves an entry. */
var QUAR_KEY='bnr.bdrop.quarantine.v1';
function loadQuar(){try{var q=JSON.parse(localStorage.getItem(QUAR_KEY)||'[]');return Array.isArray(q)?q:[];}catch(e){return[];}}
function saveQuar(q){localStorage.setItem(QUAR_KEY,JSON.stringify(q));}
function quarFor(author,permlink){return loadQuar().find(function(e){return e.scope&&e.scope.author===author&&e.scope.permlink===permlink;})||null;}
function quarUpsert(q,o,outcome,note,block){
  var le=q.find(function(e){return e.id===o.id;});
  if(!le){le={v:1,id:o.id,scope:o.scope,outcome:'unresolved',note:'',block:null,signed_tx_expiration:(o.signed_tx&&o.signed_tx.expiration)||null,created_at:new Date().toISOString(),updated_at:null};q.push(le);}
  le.outcome=outcome;le.note=note||'';le.block=block||null;le.updated_at=new Date().toISOString();
  return le;
}
function loadOutbox(){
  var raw=localStorage.getItem(OUTBOX_KEY);
  if(raw===null)return [];
  try{
    var a=JSON.parse(raw);
    if(!Array.isArray(a))throw new Error('the saved journal is not a list');
    CORRUPT=null;return a;
  }catch(e){
    var p=parseDamaged(raw);
    var q=loadQuar(); /* outcomes already established survive the restart */
    CORRUPT={raw:raw,why:e&&e.message?e.message:String(e),seen:new Date().toISOString(),
      ops:p.ops,residue_bytes:p.residue_bytes,
      statuses:p.ops.map(function(o){
        var k=q.find(function(e){return e.id===o.id;});
        return k?{id:o.id,outcome:k.outcome,block:k.block||null,note:k.note||''}:{id:o.id,outcome:'unresolved',note:'not yet reconciled'};
      })};
    if(localStorage.getItem(OUTBOX_DAMAGED_KEY)===null)localStorage.setItem(OUTBOX_DAMAGED_KEY,raw);
    return [];
  }
}
function quarantine(){ /* true while ANY uncertainty from the damaged journal stands */
  return !!(CORRUPT&&(CORRUPT.residue_bytes>0||CORRUPT.statuses.some(function(s){return s.outcome==='unresolved';})));
}
function saveOutbox(a){
  if(CORRUPT)return false; /* never overwrite uncertain history */
  localStorage.setItem(OUTBOX_KEY,JSON.stringify(a));
  return true;
}
function findRec(a,scope){return a.find(function(r){return r.id==='@'+scope.author+'/'+scope.permlink;});}
function upsert(a,scope,mut){
  var r=findRec(a,scope);
  if(!r){r={v:1,id:'@'+scope.author+'/'+scope.permlink,created_at:new Date().toISOString(),stage:'prepared',events:[],signed_tx:null,body:null,receipt:null,attempts:0,last_error:null};a.push(r);}
  r.scope=scope;r.updated_at=new Date().toISOString();
  if(mut)mut(r);
  saveOutbox(a);
  renderOutbox(a);
  return r;
}
function renderOutbox(a){
  var box=$('outbox');
  var arc=$('damaged-archive');if(arc)arc.hidden=!CORRUPT;
  if(CORRUPT){
    box.innerHTML='';
    var w=document.createElement('div');w.className='bad';
    w.textContent='the recoverable journal is DAMAGED ('+CORRUPT.why+') — seen '+String(CORRUPT.seen).slice(11,19)+'. the damaged bytes are preserved verbatim under '+OUTBOX_DAMAGED_KEY+' and the working key is untouched. '+CORRUPT.ops.length+' readable operation(s) inside it will each be reconciled against the chain on their own; '+(quarantine()?'unresolved operations or unparseable residue ('+CORRUPT.residue_bytes+' bytes) keep the desk REFUSING new submissions.':'every operation resolved and no residue remains.')+' press "recover a drop from the chain alone" to reconcile them now; the deliberate archive below is a founder decision, never a silent rewrite.';
    box.appendChild(w);
    CORRUPT.statuses.forEach(function(s){
      var l=document.createElement('div');
      l.className=s.outcome==='unresolved'?'bad':(s.outcome.indexOf('resolved-')===0?'ok':'dim');
      l.textContent=s.id+' · '+s.outcome+(s.block?' (block '+s.block+')':'')+(s.note?' — '+s.note:'');
      box.appendChild(l);
    });
    if(CORRUPT.residue_bytes>0){
      var rz=document.createElement('div');rz.className='bad';
      rz.textContent=CORRUPT.residue_bytes+' unparseable residue byte(s) — preserved verbatim; their operations are unknowable from here';
      box.appendChild(rz);
    }
    var rb=$('rebroadcast');if(rb)rb.hidden=true;
    return;
  }
  a=a||loadOutbox();
  if(!a.length){box.innerHTML='<span class="dim">the outbox is empty — no recoverable state yet.</span>';$('rebroadcast').hidden=true;renderQuar(box);return;}
  box.innerHTML='';
  a.forEach(function(r){
    var line=document.createElement('div');
    var tone=r.stage==='confirmed'||r.stage==='reconciled'?'ok':(r.stage==='diverged'?'bad':'dim');
    if(tone)line.className=tone;
    line.textContent=r.id+' · '+r.stage+(r.receipt&&r.receipt.block_num?' · block '+r.receipt.block_num:'')+' · '+r.events.length+' events · updated '+String(r.updated_at||'').slice(11,19)+(r.last_error?' · last error: '+r.last_error:'');
    box.appendChild(line);
  });
  var pend=a.find(function(r){return (r.stage==='signed'||r.stage==='submitted')&&r.signed_tx&&!expired(r.signed_tx);});
  $('rebroadcast').hidden=!pend;
  renderQuar(box);
}
function renderQuar(box){
  var ql=loadQuar();if(!ql.length)return;
  var un=ql.filter(function(e){return e.outcome==='unresolved';});
  var qd=document.createElement('div');qd.className=un.length?'bad':'ok';
  qd.textContent='quarantine ledger: '+un.length+' unresolved operation(s) carried out of damaged journals'+(un.length?' — their scopes stay refused until the chain establishes their fate (name the scope and press "recover a drop from the chain alone")':'.');
  box.appendChild(qd);
  ql.slice(-8).forEach(function(e){
    var l=document.createElement('div');
    l.className=e.outcome==='unresolved'?'bad':'ok';
    l.textContent=e.id+' · '+e.outcome+(e.note?' — '+e.note:'');
    box.appendChild(l);
  });
}
function expired(signedTx){
  try{return Date.parse((signedTx&&signedTx.expiration||'')+'Z')<Date.now();}catch(e){return true;}
}

/* ─── rpc ─── */
async function rpcCall(endpoint,method,params){
  var r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:method,params:params})});
  if(!r.ok)throw new Error('rpc http '+r.status);
  var j=await r.json();
  if(j.error)throw new Error('rpc error: '+(j.error.message||JSON.stringify(j.error)));
  return j.result;
}
/* Hive's condenser_api.get_content ASSERTS for a post that does not exist —
   "Assert Exception:Post author/permlink does not exist" — that assert IS the
   endpoint's own not-found answer, never an outage (the founder's live finding
   at the desk, 2026-10-13 05:16:36). Reading it as a failure would block every
   first publication and every reconciliation on mainnet. */
function isNotFound(e){
  return /does not exist/i.test(String((e&&e.message)||e));
}

/* ─── hash verdict ─── */
var lastHash='';
async function rehash(){
  var b=currentBytes(),v=$('hashverdict'),lh=$('livehash');
  if(!b||!b.length){v.textContent='body empty — the desk is idle.';v.className='verdict';lh.value='';lastHash='';return;}
  lastHash=await sha256Hex(b);
  lh.value=lastHash;
  var exp=$('expected').value.trim().toLowerCase();
  var sizeNote=b.length>60000?' · past 60,000 bytes — the 64 KB post cap is near':'';
  if(!exp){v.textContent=b.length.toLocaleString()+' bytes · sha-256 '+lastHash+' · no expected digest given'+sizeNote;v.className='verdict';}
  else if(exp===lastHash){v.textContent='MATCH · '+b.length.toLocaleString()+' bytes · sha-256 '+lastHash+sizeNote;v.className='verdict match';}
  else{v.textContent='DIFFERS · '+b.length.toLocaleString()+' bytes · computed '+lastHash+' ≠ expected '+exp+' · publishing stays your call'+sizeNote;v.className='verdict differs';}
}

/* ─── approved editions, discoverable through the surface ─── */
async function loadEditions(){
  var box=$('editions');
  try{
    var r=await fetch(EDITIONS_URL);
    if(!r.ok)throw new Error('http '+r.status);
    var j=await r.json();
    box.innerHTML='';
    (j.editions||[]).forEach(function(e){
      var row=document.createElement('div');row.className='row';row.style.margin='var(--s2) 0';
      var txt=document.createElement('span');txt.className='law';
      txt.textContent=e.id+' · '+e.title+' · '+e.bytes.toLocaleString()+' bytes · sha-256 '+String(e.sha256).slice(0,16)+'… · '+e.status;
      var b=document.createElement('button');b.type='button';b.textContent='load into the desk';
      b.onclick=async function(){
        try{
          var rr=await fetch('../'+e.path.replace(/^docs\//,'docs/'));
          if(!rr.ok)throw new Error('http '+rr.status);
          var ab=await rr.arrayBuffer();
          bodyBytes=new Uint8Array(ab);bodyFrom='file';
          $('body').value=new TextDecoder().decode(ab);
          $('author').value=e.author;$('permlink').value=e.permlink;$('title').value=e.title;$('tags').value=(e.tags||['hive']).join(',');
          $('expected').value=e.sha256;
          await rehash();
          log('edition '+e.id+' loaded — '+e.bytes.toLocaleString()+' bytes, hashed verbatim against the approved digest.','dim');
        }catch(err){log('edition load failed: '+err.message,'bad');}
      };
      row.appendChild(txt);row.appendChild(b);
      box.appendChild(row);
    });
    if(!(j.editions||[]).length)box.textContent='no approved editions yet.';
  }catch(e){box.textContent='the editions index did not load ('+e.message+'). the paste and file paths still work.';}
}

/* ─── reconciliation: the chain is read FIRST, never re-signed blind ─── */
async function reconcileOne(a,r,quiet){
  var s=r.scope;
  var c;
  try{c=await rpcCall(s.rpc,'condenser_api.get_content',{author:s.author,permlink:s.permlink});}
  catch(e){
    if(!isNotFound(e)){r.last_error='reconcile lookup failed: '+e.message;if(!quiet)log(r.id+' — reconcile lookup failed: '+e.message,'bad');saveOutbox(a);return r;}
    /* the assert IS the not-found answer: fall through as not landed */
  }
  if(c&&c.body&&c.body.length){
    var pubHash=await sha256Hex(new TextEncoder().encode(c.body));
    if(pubHash===s.body_sha256){
      r.stage='confirmed';
      r.receipt=assembleReceipt(r,c,pubHash,null);
      r.events.push(ev('reconciled','chain:'+c.block_num,{from:'recovery',body_byte_compare:'MATCH'}));
      r.last_error=null;
      if(!quiet)log(r.id+' — reconciled against the chain: landed in block '+c.block_num+', byte-compare MATCH. no re-publication.','ok');
    }else{
      r.stage='diverged';
      r.events.push(ev('diverged','chain:'+c.block_num,{body_sha256_chain:pubHash}));
      if(!quiet)log(r.id+' — DIVERGED: the permlink exists with different bytes. the desk refuses to edit; both digests ride the record.','bad');
    }
  }else{
    if(!quiet)log(r.id+' — not landed on the chain. '+(r.signed_tx?(expired(r.signed_tx)?'the signed transaction expired; a fresh signature needs the key.':'an unexpired signed transaction is held — re-broadcast needs no key.'):'no signed transaction held.'),'dim');
  }
  r.updated_at=new Date().toISOString();
  saveOutbox(a);renderOutbox(a);
  return r;
}
async function reconcileAll(quiet){
  var a=loadOutbox();
  if(CORRUPT){
    if(!quiet)log('the journal is damaged — "reconcile now" cannot read it. use "recover a drop from the chain alone" to reconcile what happened against the chain, or archive it deliberately.','bad');
    return a;
  }
  for(var i=0;i<a.length;i++){
    var r=a[i];
    if(r.stage==='signed'||r.stage==='submitted'||(r.stage==='confirmed'&&!r.receipt)){
      await reconcileOne(a,r,quiet);
    }else if(r.stage==='handoff'){
      /* a handoff whose answer never arrived: the outcome is unknown — the chain decides */
      var h=await reconcileOne(a,r,true);
      if(!quiet)log(r.id+' — a handoff whose answer never arrived: '+(h.stage==='confirmed'?'the chain shows it LANDED — confirmed, never re-asked.':h.stage==='diverged'?'the permlink exists with different bytes — diverged.':'the chain does not show it yet. it may still land; reconcile again later. a re-attempt is a new explicit press, never a blind retry.'),(h.stage==='confirmed'?'ok':(h.stage==='diverged'?'bad':'dim')));
    }else if(r.stage==='diverged'){
      if(!quiet)log(r.id+' — diverged. the desk will not edit an existing edition; fork a new permlink for corrections.','dim');
    }
  }
  return a;
}

function assembleReceipt(r,c,pubHash,txid){
  return {
    v:2,what:'bDroP publication receipt',chain:'hive-mainnet',
    author:r.scope.author,permlink:r.scope.permlink,title:r.scope.title,
    body_sha256_signed:r.scope.body_sha256,body_sha256_published:pubHash,
    body_bytes:r.scope.body_bytes,
    body_byte_compare:(pubHash===r.scope.body_sha256)?'MATCH':'DIFFERS',
    txid:txid||(r.receipt&&r.receipt.txid)||'not returned by endpoint',
    block_num:c?c.block_num:null,created:c?c.created:null,
    rpc_endpoint:r.scope.rpc,disclosure_version:r.scope.disclosure_version,
    surface:'surfaces/bdrop.html',signed_at:r.created_at,
    events:r.events
  };
}

/* ─── the gesture ─── */
function slug(s){return s.toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');}
function jsonMetadata(tags){
  return JSON.stringify({tags:tags&&tags.length?tags:['hive'],app:'bnr/bdrop/2.0',format:'markdown',disclosure_version:DISCLOSURE_VERSION});
}
/* three signing doors, chosen explicitly, and no key enters this page: the
   native BNR wallet door — the estate's isolated keychain at keys.skaists.dev
   (mounted only when that origin answers; the drop is confirmed by one press
   inside it, the desk checks the posting key is chain-authorized before
   asking, and verifies the signature against the drop's own bytes after) —
   the founder's existing hive keychain extension (compatibility, you choose
   it), or a one-scope in-tab paste */
var KC=(typeof window.hive_keychain==='object'&&window.hive_keychain&&typeof window.hive_keychain.requestPost==='function')?window.hive_keychain:null;
var KCX=null; /* the mounted isolated keychain client — public state and ask-only; the native door of issue #405 */
if(window.KeychainClient&&document.getElementById('kc-slot')){
  KeychainClient.mount(document.getElementById('kc-slot')).then(function(c){
    KCX=c; window.bdropKeychain=c||null; /* public-data handle: state reads and ask-only signers */
    renderSigner();
  });
}
function signerMode(){var el=document.querySelector('input[name="signer"]:checked');return el?el.value:'paste';}
/* the returned keychain signature is verified here against the drop's own
   bytes — the page trusts no one's word for what was signed */
function verifyHiveSig(out,tx){
  if(!out||typeof out.raw!=='string'||!/^[0-9a-f]{130}$/.test(out.raw))throw new Error('what came back is not a Hive signature');
  var rec=parseInt(out.raw.slice(0,2),16)-31;
  if(!(rec>=0&&rec<=3))throw new Error('the recovery byte is out of range');
  if(typeof out.pub!=='string'||!/^STM[1-9A-HJ-NP-Za-km-z]{20,60}$/.test(out.pub))throw new Error('no posting public key came back');
  if(!window.BnrSign)throw new Error('the verification stack did not load');
  var t=new H.Transaction([]);t.created=true;t.transaction=JSON.parse(JSON.stringify(tx));
  var d=t.digest();
  var db=Uint8Array.from(String(d.digest).split(',').map(Number));
  if(d.txId!==out.hash)throw new Error('the transaction id does not match this drop');
  var pub33=new Uint8Array(H.PublicKey.fromString(out.pub).key);
  if(!BnrSign.secp.verify(out.raw.slice(2),db,pub33))throw new Error('the signature does not match the posting key');
  return true;
}
function renderSigner(){
  var kc=$('signer-keychain');if(!kc)return;
  var nat=$('signer-native');
  var note=$('signer-note'),kt=$('keytruth'),wl=document.querySelector('label[for="wif"]');
  kc.disabled=!KC; /* external signers are NEVER auto-selected — nothing sets this radio but the reader's own choice */
  if(nat)nat.disabled=!KCX; /* the native door unlocks when the keychain origin answers; the choice stays the reader's */
  var mode=signerMode();
  if(note)note.textContent=mode==='native'
    ?(KCX
      ?'the estate\u2019s isolated keychain holds the posting key at keys.skaists.dev — this desk asks, that origin shows the drop and signs after one press there. before asking, the desk checks that key is an authorized posting key of the author at the endpoint below; after, it verifies the signature against the drop\u2019s own bytes and broadcasts through this endpoint. the desk never holds a Hive key, and nothing falls back to another door silently.'
      :'the keychain at keys.skaists.dev did not answer in this browser — the native door is closed here and now. choose another door; nothing was attempted.')
    :KC
    ?'the keychain extension is a COMPATIBILITY door you choose yourself. it signs after one press inside it and broadcasts through the endpoint IT is configured with; this desk confirms inclusion from the endpoint named below. the native BNR wallet signer is the estate\u2019s isolated keychain at keys.skaists.dev (enabled above when it answers).'
    :(KCX
      ?'the estate\u2019s isolated keychain at keys.skaists.dev answered — the native door above is open. the manual paste below still works.'
      :'no hive keychain extension detected — that door is closed. the estate\u2019s isolated keychain did not answer here either; the manual paste below works today.');
  if(kt)kt.textContent=mode==='native'
    ?'to no one and never here: your keychain at keys.skaists.dev derives the posting key inside itself and signs after your press there; this page receives only the signature, and checks it against the chain-named authority and the drop\u2019s own digest before broadcasting through the endpoint below.'
    :mode==='keychain'
    ?'to no one and never here: your keychain extension signs after your press inside it and broadcasts through its own configured endpoint; the desk confirms inclusion from the endpoint named below.'
    :'to no one: it signs in this tab and is wiped after the gesture; only the signed transaction is sent, to the RPC endpoint named below.';
  if(wl)wl.style.opacity=(mode==='paste')?'1':'0.6';
}
Array.prototype.forEach.call(document.querySelectorAll('input[name="signer"]'),function(r){r.addEventListener('change',renderSigner);});
$('publish').addEventListener('click',async function(){
  $('status').innerHTML='';
  var body=$('body').value;
  var wif=$('wif').value.trim();
  if(!body){log('no body — nothing to publish, nothing attempted.','bad');return;}
  if(quarantine()){log('the journal is quarantined (damaged, with unresolved operations or unparseable bytes) — the desk refuses new submissions until every readable operation is reconciled against the chain (see the outbox below).','bad');return;}
  var mode0=signerMode();
  if(mode0==='native'&&!KCX){log('the native door needs the estate\u2019s isolated keychain at keys.skaists.dev, and it did not answer in this browser — choose another door; nothing was attempted.','bad');return;}
  if(!lastHash)await rehash();
  var bodyHash=lastHash;
  var scope=await currentScope(bodyHash);
  if(!scope.permlink)scope.permlink='bdrop-'+Date.now();
  /* the quarantine ledger: an unresolved operation's scope is never resubmitted —
     a different scope is independent and proceeds under its own guards */
  var quarOp=quarFor(scope.author,scope.permlink);
  if(quarOp&&quarOp.outcome==='unresolved'){
    log('this exact drop (author + permlink) has an UNRESOLVED operation in the quarantine ledger (an archived damaged journal) — its fate is unknown and it may have landed; resubmitting could duplicate an edition. establish its fate first: name this scope and press "recover a drop from the chain alone"; if the chain holds it, the ledger resolves and this desk confirms the landing instead of republishing.','bad');
    return;
  }
  var a=loadOutbox();
  var existing=findRec(a,scope);
  if(existing&&existing.stage==='diverged'){
    log('this permlink diverged already — the desk refuses to edit an existing edition. fork a new permlink.','bad');return;
  }
  /* prepared: recoverable state persists before any network step or key */
  upsert(a,scope,function(r){r.body=body;if(!r.events.length)r.events.push(ev('prepared',scope.body_sha256));});
  /* pre-flight: the chain is read before any signature — duplicates reconcile, divergences refuse.
     the endpoint's assert-shaped "does not exist" IS its not-found answer: not landed. */
  var pre;
  try{pre=await rpcCall(scope.rpc,'condenser_api.get_content',{author:scope.author,permlink:scope.permlink});}
  catch(e){
    if(!isNotFound(e)){log('pre-flight lookup failed ('+e.message+'). the desk will not sign blind — retry when the endpoint answers.','bad');return;}
    pre=null;
  }
  if(pre&&pre.body&&pre.body.length){
    var preHash=await sha256Hex(new TextEncoder().encode(pre.body));
    if(preHash===scope.body_sha256){
      var rr=upsert(a,scope,function(r){r.stage='confirmed';r.receipt=assembleReceipt(r,pre,preHash,null);r.events.push(ev('reconciled','chain:'+pre.block_num,{from:'preflight-duplicate'}));});
      log('already published — identical bytes confirmed in block '+pre.block_num+'. no new signature, no re-publication.','ok');
      renderReceipt(rr);return;
    }
    upsert(a,scope,function(r){r.stage='diverged';r.events.push(ev('diverged','chain:'+pre.block_num,{body_sha256_chain:preHash}));});
    log('the permlink exists with DIFFERENT bytes — the desk refuses to edit an existing edition. fork a new permlink for corrections.','bad');
    return;
  }
  var op=['comment',{parent_author:'',parent_permlink:scope.parent_permlink,author:scope.author,permlink:scope.permlink,
    title:scope.title,body:body,json_metadata:jsonMetadata(scope.tags?scope.tags.split(','):null)}];
  $('opjson').textContent=JSON.stringify(op,null,1);
  var mode=signerMode();
  if(mode==='native'){
    /* the estate's keychain door (issue #405): no extension, no paste, no key here */
    if(!KCX){log('the isolated keychain at keys.skaists.dev is no longer mounted — choose another door; nothing was attempted.','bad');return;}
    if(!KCX.state||KCX.state.state!=='unlocked'){log('unlock the isolated keychain in its frame above first — nothing was attempted.','bad');return;}
    var isoPub;
    try{isoPub=await KCX.signer().hivePub(scope.author);}
    catch(e){log('the keychain would not name its posting key for @'+scope.author+' ('+e.message+') — a typed refusal, nothing was attempted.','bad');return;}
    var auth;
    try{auth=await rpcCall(scope.rpc,'condenser_api.get_accounts',[[scope.author]]);}
    catch(e){log('the authority lookup at '+scope.rpc+' failed ('+e.message+') — the desk will not ask for a signature blind. retry when the endpoint answers.','bad');return;}
    var posting=(auth&&auth[0]&&auth[0].posting&&Array.isArray(auth[0].posting.key_auths))?auth[0].posting.key_auths.map(function(k){return String(k[0]);}):[];
    if(posting.indexOf(isoPub.pub)<0){
      upsert(a,scope,function(r){r.last_error='authority: the keychain posting key is not an authorized posting key of @'+scope.author;});
      log('the keychain\u2019s posting key '+isoPub.pub+' is NOT an authorized posting key of @'+scope.author+' at this endpoint — a typed refusal: nothing was signed or sent. authorize that key once on-chain (an account_update signed by any active-key holder), publish under an account that already authorizes it, or choose another door. no fallback happened silently.','bad');
      return;
    }
    log('the keychain will publish as @'+scope.author+' with posting key '+isoPub.pub+' — authorized at this endpoint. the drop is confirmed by one press inside keys.skaists.dev.','dim');
    H.config.node=scope.rpc;
    var itx=new H.Transaction([op]);
    var recN=upsert(a,scope,function(r){r.body=body;r.stage='authorized';r.events.push(ev('authorized',scope.body_sha256,{signer:'native-keychain',pub:isoPub.pub}));});
    /* the attempted operation persists BEFORE the component that signs sees it — an answer that never comes back is UNKNOWN, never "not signed" */
    upsert(a,scope,function(r){r.stage='handoff';r.events.push(ev('handoff','native-keychain'));});
    log('handing the drop to your keychain — persisted first at the handoff stage; if the answer never comes back the outcome is UNKNOWN, and the desk reconciles from the chain instead of guessing.','dim');
    var outNat;
    try{
      log('building the transaction against '+scope.rpc+' (reference block, expiration)…');
      await itx.create([op]);
      log('asking your keychain to sign the drop — press once inside it…','dim');
      outNat=await KCX.signer().signHive(scope.author,itx.transaction);
    }catch(e){
      if(/did not answer in time/.test(e&&e.message||'')){
        upsert(a,scope,function(r){r.stage='submitted';r.last_error='handoff: '+(e&&e.message?e.message:e)+' — outcome UNKNOWN';r.events.push(ev('submitted','outcome-unknown',{signer:'native-keychain'}));});
        log('the handoff answer never arrived ('+(e&&e.message?e.message:e)+') — the outcome is UNKNOWN, not "not signed". the desk reconciles from the chain before anything is asked again; it never blind-retries.','bad');
        await confirmFromChain(a,null,scope,null);
        return;
      }
      upsert(a,scope,function(r){r.stage='authorized';r.last_error='keychain refused: '+(e&&e.message?e.message:e);r.events.push(ev('refused','native-keychain'));});
      log('the keychain REFUSED the request ('+(e&&e.message?e.message:e)+') — an explicit refusal before any signature existed. the record returns to authorized; nothing was broadcast.','bad');
      return;
    }
    try{verifyHiveSig(outNat,itx.transaction);}
    catch(e){
      upsert(a,scope,function(r){r.stage='authorized';r.last_error='verify: '+e.message;r.events.push(ev('refused','native-keychain',{why:'signature did not verify'}));});
      log('what came back did not verify against this drop ('+e.message+') — the signature travels nowhere and nothing was broadcast. the record returns to authorized.','bad');
      return;
    }
    itx.addSignature(outNat.raw);
    var signedNat=JSON.parse(JSON.stringify(itx.signedTransaction));
    upsert(a,scope,function(r){r.signed_tx=signedNat;r.stage='signed';r.events.push(ev('signed',outNat.hash,{signer:'native-keychain',expiration:signedNat.expiration}));});
    $('txjson').textContent=JSON.stringify(signedNat,null,1);
    log('signed by the keychain and verified here against the drop\u2019s own digest — transaction id '+outNat.hash+'. the signed transaction is persisted before broadcast, so a restart re-broadcasts it without any key.','dim');
    upsert(a,scope,function(r){r.attempts=(r.attempts||0)+1;});
    var resNat;
    try{resNat=await itx.broadcast();}
    catch(e){
      upsert(a,scope,function(r){r.stage='submitted';r.last_error='broadcast: '+(e&&e.message?e.message:e);r.events.push(ev('submitted','outcome-unknown',{error:r.last_error}));});
      log('the broadcast ANSWER was lost or refused ('+(e&&e.message?e.message:e)+'). the state is submitted-outcome-unknown — reconciliation reads the chain before anything is signed again.','bad');
      await confirmFromChain(a,null,scope,null);
      return;
    }
    var txidNat=outNat.hash||((typeof resNat==='string'&&resNat)?resNat:((resNat&&(resNat.id||resNat.result))||null));
    var recNS=upsert(a,scope,function(r){r.stage='submitted';r.last_error=null;r.events.push(ev('submitted',txidNat||'no-id',{signer:'native-keychain'}));});
    if(txidNat)log('broadcast accepted through '+scope.rpc+'. transaction id '+txidNat,'ok');
    else log('broadcast accepted (endpoint returned no id — the chain lookup below is the receipt).','ok');
    await confirmFromChain(a,recNS,scope,txidNat);
    return;
  }
  if(mode==='keychain'){
    if(!KC){log('the hive keychain extension is not present — choose another door.','bad');return;}
    $('txjson').textContent='the keychain signer holds the signed bytes — this page never sees them; the chain read below is the proof.';
    log('gesture accepted — body hashed before your eyes: sha-256 '+scope.body_sha256+' · '+scope.body_bytes.toLocaleString()+' bytes.');
    var recK=upsert(a,scope,function(r){r.body=body;r.stage='authorized';r.events.push(ev('authorized',scope.body_sha256,{signer:'hive-keychain'}));});
    /* the attempted operation persists BEFORE anything that can broadcast sees it */
    upsert(a,scope,function(r){r.stage='handoff';r.events.push(ev('handoff','hive-keychain'));});
    log('handing the operation to your keychain — persisted first at the handoff stage; if the answer never comes back the outcome is UNKNOWN, and the desk reconciles from the chain instead of guessing.','dim');
    var fast=(location.hash||'').indexOf('fast')>=0;
    var kcd=await new Promise(function(res){
      var done=false;
      var t=setTimeout(function(){if(!done){done=true;res({unknown:true,why:'the keychain answer never arrived'});}},fast?2500:240000);
      try{
        /* upstream contract PINNED from hive-keychain-extension master documentation/README.md:
           requestPost(account, title, body, parent_perm, parent_account=null for root,
           json_metadata as Object, permlink, comment_options, callback — the NINTH
           parameter, then optional rpc override). Never invent a different shape. */
        KC.requestPost(scope.author,scope.title,body,scope.parent_permlink,null,
          JSON.parse(op[1].json_metadata),scope.permlink,null,
          function(r){
            if(done)return;done=true;clearTimeout(t);
            res(r&&typeof r==='object'&&r.success?r:{refused:(r&&(r.message||r.error))||'the keychain did not confirm'});
          },null);
      }catch(e){
        if(!done){done=true;clearTimeout(t);res({unknown:true,why:'the keychain call itself failed: '+(e&&e.message?e.message:String(e))});}
      }
    });
    if(kcd&&kcd.unknown){
      upsert(a,scope,function(r){r.stage='submitted';r.last_error='handoff: '+kcd.why+' — outcome UNKNOWN';r.events.push(ev('submitted','outcome-unknown',{signer:'hive-keychain'}));});
      log('the handoff answer never arrived ('+kcd.why+') — the outcome is UNKNOWN, not "not broadcast". the desk reconciles from the chain before anything is asked again; it never blind-retries.','bad');
      await confirmFromChain(a,null,scope,null);
      return;
    }
    if(!kcd||kcd.refused){
      upsert(a,scope,function(r){r.stage='authorized';r.last_error='keychain refused: '+((kcd&&kcd.refused)||'no reason given');r.events.push(ev('refused','hive-keychain'));});
      log('the keychain REFUSED the request ('+((kcd&&kcd.refused)||'no reason given')+') — an explicit refusal before any broadcast it would make. the record returns to authorized; the chain is read before any re-attempt.','bad');
      return;
    }
    var kctxid=(kcd.result&&(kcd.result.id||kcd.result))||null;
    if(typeof kctxid==='object')kctxid=kctxid.id||null;
    var recS=upsert(a,scope,function(r){r.stage='submitted';r.last_error=null;r.events.push(ev('submitted',kctxid||'keychain',{signer:'hive-keychain'}));});
    log('the keychain broadcast accepted. transaction id '+(kctxid||'(none returned — the chain lookup below is the receipt)'),'ok');
    await confirmFromChain(a,recS,scope,kctxid);
    return;
  }
  /* the paste signer — the estate's wallet law: one scope, zeroable bytes */
  if(!wif&&!KEY.bytes){log('no posting key given — nothing attempted, nothing sent.','bad');return;}
  if(KEY.bytes&&!(await scopeMatches(scope))){
    log('the key session is bound to a different scope (permlink, body, endpoint or disclosure changed) — present the key again for the new scope. authority never expands silently.','bad');return;
  }
  var keyObj=null;
  if(wif){
    var bnd=await bindKey(wif,scope);
    if(bnd.err){log(bnd.err,'bad');return;}
    log('key accepted locally; derived public key '+bnd.pub+' — shown once, never stored.','dim');
  }
  try{keyObj=H.PrivateKey.from(KEY.bytes);}catch(e){log('held key bytes failed to reconstruct ('+e.message+').','bad');return;}
  renderKeySession();
  log('gesture accepted — body hashed before your eyes: sha-256 '+scope.body_sha256+' · '+scope.body_bytes.toLocaleString()+' bytes.');
  var rec=upsert(a,scope,function(r){r.body=body;r.stage='authorized';r.events.push(ev('authorized',KEY.scopeHash,{pub:KEY.pub,signer:'paste'}));});
  H.config.node=scope.rpc;
  var tx=new H.Transaction([op]);
  try{
    log('building the transaction against '+scope.rpc+' (reference block, expiration)…');
    await tx.create([op]);
    log('signing in this tab…');
    tx.sign(keyObj);
    var txidLocal=tx.txId||null;
    var signedTx=JSON.parse(JSON.stringify(tx.signedTransaction||tx.transaction));
    /* persist BEFORE submission — the outbox is the record, not this page's memory */
    rec=upsert(a,scope,function(r){r.signed_tx=signedTx;r.stage='signed';r.events.push(ev('signed',txidLocal||'held',{expiration:signedTx.expiration}));});
    $('txjson').textContent=JSON.stringify(signedTx,null,1);
    log('signed transaction persisted to the outbox BEFORE submission — a restart reconciles instead of losing or duplicating the gesture.','dim');
    rec=upsert(a,scope,function(r){r.attempts=(r.attempts||0)+1;});
    log('broadcasting the signed transaction — the key does not travel.','dim');
    var res;
    try{res=await tx.broadcast();}
    catch(e){
      rec=upsert(a,scope,function(r){r.stage='submitted';r.last_error='broadcast: '+(e&&e.message?e.message:e);r.events.push(ev('submitted','outcome-unknown',{error:r.last_error}));});
      log('the broadcast ANSWER was lost or refused ('+(e&&e.message?e.message:e)+'). the state is submitted-outcome-unknown — reconciliation reads the chain before anything is signed again.','bad');
      await confirmFromChain(a,rec,scope);
      return;
    }
    var txid=txidLocal||((typeof res==='string'&&res)?res:((res&&(res.id||res.result))||null));
    rec=upsert(a,scope,function(r){r.stage='submitted';r.last_error=null;r.events.push(ev('submitted',txid||'no-id'));});
    if(txid)log('broadcast accepted. transaction id '+txid,'ok');
    else log('broadcast accepted (endpoint returned no id — the chain lookup below is the receipt).','ok');
    await confirmFromChain(a,rec,scope,txid);
  }catch(e){
    upsert(a,scope,function(r){r.last_error='gesture: '+(e&&e.message?e.message:e);});
    log('the gesture failed: '+(e&&e.message?e.message:e)+' — nothing further attempted. the desk never claims a send it cannot see.','bad');
  }
});

async function confirmFromChain(a,rec,scope,txid){
  var box=$('receipt');
  var fast=(location.hash||'').indexOf('fast')>=0; /* the committed regression suite runs the same loop on a fast clock */
  var tries=fast?15:30, delay=fast?300:4000;
  box.innerHTML='<span class="dim">waiting for the chain to land the drop…</span>';
  for(var i=1;i<=tries;i++){
    await new Promise(function(r){setTimeout(r,delay)});
    var c;
    try{c=await rpcCall(scope.rpc,'condenser_api.get_content',{author:scope.author,permlink:scope.permlink});}
    catch(e){log('lookup '+i+' failed: '+e.message,'dim');continue;}
    if(c&&c.body&&c.body.length){
      var pubHash=await sha256Hex(new TextEncoder().encode(c.body));
      var match=pubHash===scope.body_sha256;
      var done=upsert(a,scope,function(r){
        r.stage=match?'confirmed':'diverged';
        r.receipt=assembleReceipt(r,c,pubHash,txid);
        r.events.push(ev('confirmed','chain:'+c.block_num,{body_byte_compare:match?'MATCH':'DIFFERS'}));
      });
      renderReceipt(done);
      if(match){
        var u='https://hive.blog/@'+scope.author+'/'+scope.permlink;
        $('permlinkurl').href=u;
        $('permlinkurl').textContent='the drop on hive.blog — '+u+' (opens a new tab)';
        $('permwrap').hidden=false;$('download').hidden=false;$('bundle').hidden=false;$('preserve-ant').hidden=false;
        log('receipt complete. the chain — not prose — is the proof; the outbox and the tree are mirrors.','ok');
      }else{
        log('the published bytes DIFFER from the signed bytes — both digests ride the record; the signed digest is the edition\u2019s.','bad');
      }
      return;
    }
    log('lookup '+i+': not landed yet ('+(30-i)+' tries left).','dim');
  }
  box.innerHTML='<span class="bad">not seen in 30 lookups (about two minutes). this is a lookup timeout, NOT proof of failure or success — reconcile now or after a restart; the chain is read before anything is signed again.</span>';
}

function renderReceipt(r){
  var box=$('receipt');
  box.innerHTML='';
  var rc=r.receipt;if(!rc){box.textContent='no receipt on this record yet.';return;}
  var head=document.createElement('div');
  if(rc.what==='bDroP chain-recovery record'){
    head.className=rc.body_byte_compare==='MATCH'?'ok':(rc.body_byte_compare==='DIVERGED'?'bad':'dim');
    head.textContent='RECOVERED (chain read — proves presence, never a signature) · block '+rc.block_num+' · expected '+(rc.body_sha256_expected||'NONE in this desk')+' · chain '+rc.body_sha256_chain+' · '+rc.body_byte_compare+' · signing evidence NONE · inclusion UNVERIFIED';
  }else{
    head.className=(rc.body_byte_compare==='MATCH')?'ok':'bad';
    head.textContent=(r.stage==='diverged'?'DIVERGED':'LANDED')+' · block '+rc.block_num+' · created '+rc.created+' · body sha-256 '+rc.body_sha256_published+' · byte-compare '+rc.body_byte_compare;
  }
  box.appendChild(head);
  var meta=document.createElement('div');meta.className='dim';
  meta.textContent='transaction id: '+rc.txid+' · events: '+r.events.map(function(e){return e.event;}).join(' → ');
  box.appendChild(meta);
}

/* ─── re-broadcast: the held signed bytes, no key needed ─── */
$('rebroadcast').addEventListener('click',async function(){
  var a=loadOutbox();
  var r=a.find(function(x){return (x.stage==='signed'||x.stage==='submitted')&&x.signed_tx&&!expired(x.signed_tx);});
  if(!r){log('no unexpired signed transaction to re-broadcast.','bad');return;}
  var s=r.scope;
  H.config.node=s.rpc;
  var tx=new H.Transaction([]);
  tx.created=true;tx.transaction=r.signed_tx;tx.signedTransaction=r.signed_tx;tx.txId=r.signed_tx.txId||null;
  try{
    log('re-broadcasting the held signed bytes for '+r.id+' — byte-identical, no key involved.','dim');
    await tx.broadcast();
    r.stage='submitted';r.events.push(ev('submitted','rebroadcast'));r.updated_at=new Date().toISOString();
    saveOutbox(a);renderOutbox(a);
    await confirmFromChain(a,r,s,null);
  }catch(e){
    r.last_error='rebroadcast: '+(e&&e.message?e.message:e);saveOutbox(a);renderOutbox(a);
    log('re-broadcast failed: '+r.last_error,'bad');
  }
});
$('reconcile').addEventListener('click',async function(){$('status').innerHTML='';await reconcileAll(false);await reconcileQuar(false);});
/* the quarantine ledger reconciles against the chain too: a landing resolves an
   entry (recovered, never resubmitted); a not-landing stays unresolved — expiry
   is not proof, reads can be stale */
async function reconcileQuar(quiet){
  var q=loadQuar();if(!q.length)return q;
  var rpc=$('rpc').value.trim().replace(/\/+$/,'');
  if(!rpc)return q;
  var changed=false;
  for(var i=0;i<q.length;i++){
    var e=q[i];
    if(e.outcome!=='unresolved'||!e.scope)continue;
    var c;
    try{c=await rpcCall(rpc,'condenser_api.get_content',{author:e.scope.author,permlink:e.scope.permlink});}
    catch(err){continue;}
    if(c&&typeof c==='object'&&typeof c.body==='string'&&c.body.length){
      var h=await sha256Hex(new TextEncoder().encode(c.body));
      if(h===e.scope.body_sha256){e.outcome='resolved-confirmed';e.note='the chain holds this operation\u2019s committed bytes (block '+c.block_num+') — recovered, never resubmitted';}
      else{e.outcome='resolved-diverged';e.note='the permlink holds different bytes (block '+c.block_num+') — occupied; the desk edits nothing';}
      e.updated_at=new Date().toISOString();changed=true;
      if(!quiet)log(e.id+' — the quarantine ledger resolves: '+e.outcome+'.','ok');
    } /* not landed stays unresolved — expiry is not proof, reads can be stale */
  }
  if(changed)saveQuar(q);
  renderOutbox();
  return q;
}

/* ─── recovery from the chain alone: a fresh client, the original profile gone ───
   No journal, no key, no manual JSON. A content read proves PRESENCE, never a
   signature: the expected commitment (the desk's bytes, when present), the
   chain-recovered hash and any signature-bound hash stay SEPARATE fields. A
   missing commitment means UNVERIFIED, never MATCH; a differing commitment
   means DIVERGED. Nothing here invents signing time, signature provenance,
   transaction inclusion or finality — and the recovered BYTES ride the record.
   When the journal is damaged, this same button reconciles every READABLE
   operation in it on its own; unresolved operations stay quarantined. */
async function reconcileDamaged(){
  if(!CORRUPT)return;
  var rpc=$('rpc').value.trim().replace(/\/+$/,'');
  if(!rpc){log('name the rpc endpoint to read the chain from.','bad');return;}
  log('reconciling every readable operation in the damaged journal against the chain — '+CORRUPT.ops.length+' readable, '+CORRUPT.residue_bytes+' unparseable residue byte(s) preserved verbatim.','dim');
  var q=loadQuar();
  for(var i=0;i<CORRUPT.ops.length;i++){
    var o=CORRUPT.ops[i],st=CORRUPT.statuses[i],s=o.scope||{};
    st.note='';
    var c;
    try{c=await rpcCall(rpc,'condenser_api.get_content',{author:s.author,permlink:s.permlink});}
    catch(e){
      if(!isNotFound(e)){st.outcome='unresolved';st.note='chain read failed: '+e.message;continue;}
      /* the assert IS the not-found answer: fall through as not landed */
    }
    if(c&&typeof c==='object'&&typeof c.body==='string'&&c.body.length){
      var h=await sha256Hex(new TextEncoder().encode(c.body));
      if(h===s.body_sha256){st.outcome='resolved-confirmed';st.block=c.block_num;}
      else{st.outcome='resolved-diverged';st.block=c.block_num;st.note='the chain body differs from this operation\u2019s committed bytes';}
    }else{
      /* expiry establishes neither non-execution nor endpoint completeness — it never resolves */
      st.outcome='unresolved';
      st.note=(o.signed_tx&&expired(o.signed_tx)
        ?'not landed at this read and the signed transaction has expired — expiry is NOT proof it never executed: reads can be stale or incomplete; it stays unresolved'
        :(o.signed_tx
          ?'not landed at this read and the signed transaction is still live — it may be in flight'
          :'not landed at this read and no signed bytes are held — a handoff may or may not have broadcast it; unknowable from here'));
    }
    quarUpsert(q,o,st.outcome,st.note,st.block); /* every outcome is durable: restarts keep what was established */
  }
  saveQuar(q);
  renderOutbox();
  if(quarantine()){
    log('the damaged journal still holds unresolved operations or unparseable bytes — submissions stay refused. each resolved outcome above is recorded; the raw bytes stay preserved; recovering one operation never clears the others\u2019 uncertainty.','bad');
  }else{
    /* every readable operation resolved and no residue remains — the outcomes are established */
    var clean=CORRUPT.ops.map(function(o,i){
      var st=CORRUPT.statuses[i];
      o.stage=st.outcome==='resolved-confirmed'?'confirmed':'diverged';
      o.events=(o.events||[]).concat([ev('resolved_from_damaged_journal','chain:'+(st.block||'none'),{outcome:st.outcome})]);
      return o;
    });
    CORRUPT=null;
    saveOutbox(clean);renderOutbox(clean);
    log('every readable operation in the damaged journal resolved against the chain and no residue remains — the quarantine lifts; the resolved records are the journal now.','ok');
  }
}
$('recover').addEventListener('click',async function(){
  $('status').innerHTML='';
  if(CORRUPT)return reconcileDamaged();
  var author=$('author').value.trim().toLowerCase(),permlink=slug($('permlink').value);
  if(!author||!permlink){log('name the drop to recover — author and permlink (an edition load fills both).','bad');return;}
  var rpc=$('rpc').value.trim().replace(/\/+$/,'');
  if(!rpc){log('name the rpc endpoint to read the chain from.','bad');return;}
  log('reading the chain alone for @'+author+'/'+permlink+' — a content read: it proves presence, never a signature. nothing is broadcast.','dim');
  var c;
  try{c=await rpcCall(rpc,'condenser_api.get_content',{author:author,permlink:permlink});}
  catch(e){
    if(isNotFound(e)){log('the chain shows no such drop at @'+author+'/'+permlink+' — the endpoint\u2019s own not-found answer (a chain read is not proof it never existed elsewhere; nothing was recovered).','bad');return;}
    log('the chain read failed ('+e.message+') — nothing was recovered; nothing beyond the read was attempted.','bad');return;
  }
  if(!(c&&typeof c==='object'&&typeof c.body==='string'&&c.body.length)){
    log('the endpoint\u2019s answer did not read as content — nothing was recovered and nothing was manufactured. an untrusted endpoint cannot make this desk invent a record.','bad');return;
  }
  var chainHash=await sha256Hex(new TextEncoder().encode(c.body));
  var deskBytes=currentBytes();
  /* the commitment: the desk's own bytes, or — when the desk is empty — the
     quarantine ledger's recorded commitment for this exact scope */
  var lede=quarFor(author,permlink);
  var expFrom=deskBytes&&deskBytes.length?'desk':(lede?'quarantine-ledger':'none');
  var expected=expFrom==='desk'?await sha256Hex(deskBytes):(expFrom==='quarantine-ledger'?lede.scope.body_sha256:null);
  var verdict=expected===null?'UNVERIFIED':(expected===chainHash?'MATCH':'DIVERGED');
  var rec={v:1,id:'@'+author+'/'+permlink,created_at:new Date().toISOString(),
    stage:verdict==='DIVERGED'?'diverged':'confirmed',
    scope:{author:author,permlink:permlink,title:(typeof c.title==='string'?c.title:''),
      parent_permlink:($('tags').value.split(/[\s,]+/).filter(Boolean)[0]||'hive'),
      tags:$('tags').value.split(/[\s,]+/).filter(Boolean).join(','),
      body_sha256:expected,body_bytes:new TextEncoder().encode(c.body).length,
      disclosure_version:DISCLOSURE_VERSION,rpc:rpc},
    body:c.body,signed_tx:null,attempts:0,last_error:null,events:[],receipt:null};
  rec.events.push(ev('recovered_from_chain','chain:'+(typeof c.block_num==='number'?c.block_num:'unnumbered'),{verdict:verdict,body_bytes:c.body.length}));
  rec.receipt={v:3,what:'bDroP chain-recovery record',chain:'hive-mainnet',
    author:author,permlink:permlink,
    body_sha256_expected:expected,body_sha256_chain:chainHash,signature_bound_hash:null,
    signing_evidence:'NONE — a content read cannot speak for any signature',
    txid:null,inclusion:'UNVERIFIED — content lookup only; no transaction inclusion or finality claimed',
    block_num:(typeof c.block_num==='number'?c.block_num:null),
    created:(typeof c.created==='string'?c.created:null),
    rpc_endpoint:rpc,disclosure_version:DISCLOSURE_VERSION,
    recovered_at:new Date().toISOString(),body_byte_compare:verdict,events:rec.events};
  if(lede){
    /* recovery is also how a quarantined operation's fate gets established */
    var q3=loadQuar();
    var e3=q3.find(function(e2){return e2.scope&&e2.scope.author===author&&e2.scope.permlink===permlink;});
    if(e3){
      if(verdict==='MATCH'){e3.outcome='resolved-confirmed';e3.note='recovered from the chain: the committed bytes hold (block '+c.block_num+')';}
      else if(verdict==='DIVERGED'){e3.outcome='resolved-diverged';e3.note='recovered from the chain: the permlink holds different bytes';}
      else{e3.note='chain body present but no commitment comparable — the operation\u2019s fate stays unknown';}
      e3.updated_at=new Date().toISOString();
      saveQuar(q3);
    }
  }
  var a=loadOutbox();
  a=a.filter(function(x){return x.id!==rec.id;});
  a.push(rec);
  saveOutbox(a);renderOutbox(a);renderReceipt(rec);
  var line={MATCH:'recovered: the chain body equals the committed bytes (MATCH, from the '+(expFrom==='desk'?'desk':'quarantine ledger')+'). the signature evidence is still NONE — presence proven, signing never.',
    DIVERGED:'recovered: the chain body DIFFERS from the committed bytes (DIVERGED, from the '+(expFrom==='desk'?'desk':'quarantine ledger')+') — both digests ride the record; the desk edits nothing.',
    UNVERIFIED:'recovered with NO commitment anywhere (UNVERIFIED): the chain body is recorded as-found; nothing claims what was signed — a missing commitment never converts to MATCH.'}[verdict];
  log(line+' the recovered bytes ride the record. no key, no journal import, nothing broadcast.','ok');
});
$('damaged-archive').addEventListener('click',function(){
  if(!CORRUPT)return;
  var unres=CORRUPT.statuses.filter(function(s){return s.outcome==='unresolved';}).length;
  if(!window.confirm('archive the damaged journal? its bytes stay preserved under '+OUTBOX_DAMAGED_KEY+(unres?', and its '+unres+' unresolved operation(s) stay in the quarantine ledger — their scopes stay refused until the chain establishes their fate':'')+'. this reorganizes evidence; it reconciles nothing.'))return;
  localStorage.setItem(OUTBOX_DAMAGED_KEY,JSON.stringify({archived_at:new Date().toISOString(),why:CORRUPT.why,raw:CORRUPT.raw}));
  /* archiving never erases unresolved-operation markers: every readable operation
     rides the durable ledger — resolved as established, unresolved as unresolved */
  var q=loadQuar();
  CORRUPT.statuses.forEach(function(s,i){quarUpsert(q,CORRUPT.ops[i],s.outcome,s.note,s.block);});
  saveQuar(q);
  var carried=q.filter(function(e){return e.outcome==='unresolved';}).length;
  CORRUPT=null;
  saveOutbox([]);
  renderOutbox([]);
  log('the damaged journal was archived deliberately — its bytes remain preserved under '+OUTBOX_DAMAGED_KEY+'. '+(carried?carried+' unresolved operation(s) ride the quarantine ledger: their scopes stay refused (a replacement submission is not authorized) until the chain establishes their fate.':'no unresolved operations remained — the ledger records their established outcomes.'),'dim');
});

/* ─── receipt download + the preservation bundle ─── */
var lastRec=null;
var _renderReceipt=renderReceipt;
renderReceipt=function(r){lastRec=r;_renderReceipt(r);};
$('download').addEventListener('click',function(){
  if(!lastRec||!lastRec.receipt)return;
  var blob=new Blob([JSON.stringify(lastRec.receipt,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='bdrop-receipt-'+lastRec.scope.permlink+'.json';
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
});
function bundleBytes(rec){
  var manifest={
    v:1,what:'bDroP preservation bundle',
    edition:{permlink:rec.scope.permlink,sha256:rec.scope.body_sha256,bytes:rec.scope.body_bytes,disclosure_version:rec.scope.disclosure_version},
    receipt_sha256:null,edition_body_sha256:rec.scope.body_sha256,composed_at:new Date().toISOString()
  };
  var receiptJson=JSON.stringify(rec.receipt,null,2);
  return {manifest:manifest,receipt:receiptJson,edition_body:rec.body,
    all:JSON.stringify({manifest:manifest,receipt:rec.receipt,edition_body:rec.body},null,2)};
}
$('bundle').addEventListener('click',function(){
  if(!lastRec||!lastRec.receipt)return;
  var b=bundleBytes(lastRec);
  var blob=new Blob([b.all],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='bdrop-bundle-'+lastRec.scope.permlink+'.json';
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
});

/* hosted ANT preservation — Agent 20's shared module (ant-pay.js), the
   bpay-invoice pattern: priced invoice, ceilings enforced by the module,
   nothing spent silently. The FIRST-PARTY signer is the estate's isolated
   keychain (the same KCX signer() the purchase suites exercise); a browser
   wallet is an external door that must be chosen explicitly. No budget is
   invented here and the purchasing module is untouched. */
$('preserve-ant').addEventListener('click',async function(){
  var ps=$('pstatus');ps.hidden=false;
  var line=function(t,cls){ps.innerHTML='';var d=document.createElement('div');if(cls)d.className=cls;d.textContent=t;ps.appendChild(d);};
  if(!lastRec||!lastRec.receipt||lastRec.stage!=='confirmed'){line('preservation needs a confirmed drop first.','bad');return;}
  if(!window.AntPay){line('the hosted purchaser module (ant-pay.js) did not load — preservation unavailable, nothing attempted.','bad');return;}
  var evmSigner=null,who='';
  if(KCX&&KCX.state&&KCX.state.state==='unlocked'&&KCX.state.evm){
    evmSigner=KCX.signer();who='the isolated keychain at keys.skaists.dev (first-party)';
  }else if(window.ethereum){
    if(!window.confirm('the first-party keychain is not unlocked here. use the connected BROWSER WALLET (external) for this one purchase? nothing happens before you sign inside it, and the choice is yours.')){line('no signer chosen — nothing was attempted or spent.','dim');return;}
    evmSigner=window.ethereum;who='your browser wallet (external, your explicit choice)';
  }else{
    line('no first-party signer: the isolated keychain is not unlocked here and no external wallet was offered. unlock the keychain in its frame above or connect a wallet — nothing was attempted or spent.','bad');return;
  }
  var rec=lastRec;
  try{
    line('composing the bundle and loading the Autonomi browser kit…','dim');
    var b=bundleBytes(rec);
    var bytes=new Text8ToU8(b.all);
    var sha=await sha256Hex(bytes);
    var file=new File([bytes],'bdrop-bundle-'+rec.scope.permlink+'.json',{type:'application/json'});
    var kit=await import(ANT_KIT+'index.js');
    var defaults=await kit.getNetworkDefaults({});
    var client=await kit.AutonomiClient.connect({});
    var requestId=0;
    var rpc=async function(method,params){
      var r=await fetch(defaults.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method:method,params:params})});
      if(!r.ok)throw new Error('payment rpc unavailable');
      var j=await r.json();if(j.error)throw new Error('payment rpc refused '+method);return j.result;
    };
    var payer=window.AntPay.createHosted({artifact:{name:file.name,sha256:sha,bytes:file.size},network:defaults.payment,storage:localStorage,rpc:rpc,ethereum:evmSigner});
    await payer.retryUnpaid();
    line('asking Autonomi for the price of '+file.size.toLocaleString()+' bytes — nothing is signed yet.','dim');
    var paid=await client.upload(file,{visibility:'public',paymentMode:'single',payment:{
      pay:async function(network,quotes,context){
        var inv=await payer.invoice(network,quotes,'20000000000000000',null);
        line('invoice ready: review it in '+who+' before signing. aggregate ceilings are enforced by the shared module.','dim');
        var out=await payer.provider(inv.id).pay(network,quotes,context);
        return out;
      },
      recover:function(network,quotes,attempt,context){return payer.provider(null).recover(network,quotes,attempt,context);}
    },onCheckpoint:function(v){payer.checkpoint(v);}});
    payer.uploaded(paid);
    var back=await client.download(paid.file,{});
    var reconciled=await payer.reconcile(back.bytes);
    var a2=loadOutbox();
    var r2=a2.find(function(x){return x.id===rec.id;});
    if(r2){r2.stage='reconciled';r2.events.push(ev('reconciled','bpay.ant.reconciled/1',{addr:String((paid.file&&paid.file.addr)||paid)}));saveOutbox(a2);renderOutbox(a2);}
    line('stored and retrieved on Autonomi: '+reconciled.retrievedBytes+' bytes match the bundle\u2019s sha-256. receipt reconciled; the record\u2019s durable copy no longer depends on this browser or on github.','ok');
  }catch(e){
    line('preservation stopped: '+(e&&e.message?e.message:e)+'. nothing further attempted; the bundle download and the chain record remain.','bad');
  }
});
function Text8ToU8(s){return new TextEncoder().encode(s);}

/* ─── wiring ─── */
$('body').addEventListener('input',function(){bodyFrom='paste';bodyBytes=null;rehash();});
$('expected').addEventListener('input',rehash);
$('bodyfile').addEventListener('change',function(ev2){
  var f=ev2.target.files&&ev2.target.files[0];
  if(!f)return;
  f.arrayBuffer().then(function(ab){
    bodyBytes=new Uint8Array(ab);bodyFrom='file';
    $('body').value=new TextDecoder().decode(ab);
    rehash();
  }).catch(function(e){log('file read failed: '+e.message,'bad');});
});
$('wipe').addEventListener('click',wipe);
window.addEventListener('beforeunload',wipe);
window.addEventListener('pagehide',wipe);

renderKeySession();
renderSigner();
renderOutbox();
loadEditions();
rehash();
reconcileAll(true).then(async function(a){
  var pend=a.filter(function(r){return r.stage==='signed'||r.stage==='submitted';});
  if(pend.length)log('recovered state: '+pend.length+' drop(s) in flight — reconciled against the chain on load; nothing was re-signed or re-published blind.','dim');
  if(CORRUPT)log('the recoverable journal is damaged — bytes preserved verbatim; every readable operation reconciles on its own (press "recover a drop from the chain alone"); submissions stay refused while any operation or residue is unresolved.','bad');
  await reconcileQuar(true); /* quarantined operations reconcile on their own too — expiry never resolves them */
  renderOutbox(a);
});
})();
