/* bdrop.js v3 — the drop desk's durable lifecycle.
   prepared → authorized → signed → submitted → confirmed → reconciled.
   The browser is a client, never the sole keeper: recoverable state (scope,
   body bytes, the signed transaction, the event log) persists in localStorage
   BEFORE submission and never contains a secret; a restart or a lost RPC
   response reconciles against the chain first — a landed drop is confirmed,
   never re-published; a diverged permlink is reported, never edited; an
   unexpired signed transaction re-broadcasts byte-identically without the key.
   A journal that cannot be parsed is never silently replaced: the damaged
   bytes are preserved verbatim, the problem is reported, and new submissions
   are refused until the chain reconciles what happened — uncertain history is
   never overwritten with an empty array.
   Signing has two doors, no new keychain: the founder's existing Hive
   Keychain extension (the key never touches this page) or a one-scope paste
   held as zeroable bytes in tab memory — never persisted, never logged, never
   sent; only the signed transaction travels. */
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
   garbage: the raw bytes are preserved verbatim under the .damaged key, the
   working key is left untouched until reconciliation (or an explicit,
   receipted archive) establishes what happened, and nothing new is submitted
   while the question stands. */
var CORRUPT=null;
function loadOutbox(){
  var raw=localStorage.getItem(OUTBOX_KEY);
  if(raw===null)return [];
  try{
    var a=JSON.parse(raw);
    if(!Array.isArray(a))throw new Error('the saved journal is not a list');
    CORRUPT=null;return a;
  }catch(e){
    CORRUPT={raw:raw,why:e&&e.message?e.message:String(e),seen:new Date().toISOString()};
    if(localStorage.getItem(OUTBOX_DAMAGED_KEY)===null)localStorage.setItem(OUTBOX_DAMAGED_KEY,raw);
    return [];
  }
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
    w.textContent='the recoverable journal is DAMAGED ('+CORRUPT.why+') — seen '+String(CORRUPT.seen).slice(11,19)+'. the damaged bytes are preserved verbatim under '+OUTBOX_DAMAGED_KEY+' and the original key is untouched. the desk REFUSES new submissions until the chain reconciles what happened: name the drop in the desk above (an edition load fills it) and press "recover a drop from the chain alone", or archive the damaged record deliberately below — it is never replaced silently.';
    box.appendChild(w);
    var rb=$('rebroadcast');if(rb)rb.hidden=true;
    return;
  }
  a=a||loadOutbox();
  if(!a.length){box.innerHTML='<span class="dim">the outbox is empty — no recoverable state yet.</span>';$('rebroadcast').hidden=true;return;}
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
  catch(e){r.last_error='reconcile lookup failed: '+e.message;if(!quiet)log(r.id+' — reconcile lookup failed: '+e.message,'bad');saveOutbox(a);return r;}
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
/* two signing doors, no new keychain: the founder's existing hive keychain
   extension (the key never enters this page), or a one-scope in-tab paste */
var KC=(typeof window.hive_keychain==='object'&&window.hive_keychain&&typeof window.hive_keychain.requestPost==='function')?window.hive_keychain:null;
function signerMode(){var el=document.querySelector('input[name="signer"]:checked');return el?el.value:'paste';}
function renderSigner(){
  var kc=$('signer-keychain');if(!kc)return;
  var note=$('signer-note'),kt=$('keytruth'),wl=document.querySelector('label[for="wif"]');
  if(!KC){
    kc.disabled=true;kc.checked=false;
    if(note)note.textContent='no hive keychain extension detected in this browser — the paste signer below is the working door today. (the estate\u2019s isolated keychain at keys.skaists.dev signs EVM/bzDiD only; a hive phase belongs to its owner and is routed there.)';
  }else{
    kc.checked=true;
    if(note)note.textContent='your keychain extension signs after one press inside it and broadcasts through the endpoint IT is configured with; this desk confirms inclusion from the endpoint named below. the posting key never enters this page.';
  }
  var keychain=signerMode()==='keychain';
  if(kt)kt.textContent=keychain
    ?'to no one and never here: your keychain extension signs after your press inside it and broadcasts through its own configured endpoint; the desk confirms inclusion from the endpoint named below.'
    :'to no one: it signs in this tab and is wiped after the gesture; only the signed transaction is sent, to the RPC endpoint named below.';
  if(wl)wl.style.opacity=keychain?'0.6':'1';
}
Array.prototype.forEach.call(document.querySelectorAll('input[name="signer"]'),function(r){r.addEventListener('change',renderSigner);});
$('publish').addEventListener('click',async function(){
  $('status').innerHTML='';
  var body=$('body').value;
  var wif=$('wif').value.trim();
  if(!body){log('no body — nothing to publish, nothing attempted.','bad');return;}
  if(CORRUPT){log('the recoverable journal is damaged — the desk refuses new submissions until the chain reconciles what happened (see the outbox below).','bad');return;}
  if(!lastHash)await rehash();
  var bodyHash=lastHash;
  var scope=await currentScope(bodyHash);
  if(!scope.permlink)scope.permlink='bdrop-'+Date.now();
  var a=loadOutbox();
  var existing=findRec(a,scope);
  if(existing&&existing.stage==='diverged'){
    log('this permlink diverged already — the desk refuses to edit an existing edition. fork a new permlink.','bad');return;
  }
  /* prepared: recoverable state persists before any network step or key */
  upsert(a,scope,function(r){r.body=body;if(!r.events.length)r.events.push(ev('prepared',scope.body_sha256));});
  /* pre-flight: the chain is read before any signature — duplicates reconcile, divergences refuse */
  var pre;
  try{pre=await rpcCall(scope.rpc,'condenser_api.get_content',{author:scope.author,permlink:scope.permlink});}
  catch(e){log('pre-flight lookup failed ('+e.message+'). the desk will not sign blind — retry when the endpoint answers.','bad');return;}
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
  if(mode==='keychain'){
    if(!KC){log('no hive keychain extension detected in this browser — choose the paste signer instead.','bad');return;}
    $('txjson').textContent='the keychain signer holds the signed bytes — this page never sees them; the chain read below is the proof.';
    log('gesture accepted — body hashed before your eyes: sha-256 '+scope.body_sha256+' · '+scope.body_bytes.toLocaleString()+' bytes.');
    var recK=upsert(a,scope,function(r){r.body=body;r.stage='authorized';r.events.push(ev('authorized',scope.body_sha256,{signer:'hive-keychain'}));});
    log('asking your keychain extension to sign and broadcast — the posting key never enters this page; press once inside the extension…','dim');
    var kcd=await new Promise(function(res){
      try{KC.requestPost(scope.author,scope.permlink,scope.title,body,op[1].json_metadata,function(r){res(r&&r.success?r:{refused:(r&&(r.message||r.error))||'the keychain did not confirm'});});}
      catch(e){res({refused:e&&e.message?e.message:String(e)});}
    });
    if(!kcd||kcd.refused){
      upsert(a,scope,function(r){r.last_error='keychain: '+((kcd&&kcd.refused)||'no answer');});
      log('the keychain refused or failed ('+((kcd&&kcd.refused)||'no answer')+') — nothing was broadcast. the record stays authorized; reconciliation reads the chain before anything is asked again.','bad');
      return;
    }
    var kctxid=(kcd.result&&kcd.result.id)||kcd.id||null;
    var recS=upsert(a,scope,function(r){r.stage='submitted';r.last_error=null;r.events.push(ev('submitted',kctxid||'keychain',{signer:'hive-keychain'}));});
    if(kctxid)log('the keychain broadcast accepted. transaction id '+kctxid,'ok');
    else log('the keychain broadcast accepted (no id returned — the chain lookup below is the receipt).','ok');
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
  head.className=(rc.body_byte_compare==='MATCH')?'ok':'bad';
  head.textContent=(r.stage==='diverged'?'DIVERGED':'LANDED')+' · block '+rc.block_num+' · created '+rc.created+' · body sha-256 '+rc.body_sha256_published+' · byte-compare '+rc.body_byte_compare;
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
$('reconcile').addEventListener('click',async function(){$('status').innerHTML='';await reconcileAll(false);});

/* ─── recovery from the chain alone: a fresh client, the original profile gone ───
   No journal, no key, no manual JSON: the desk names a drop (an edition load
   fills the fields), the chain answers, and the record is rebuilt confirmed
   with a receipted event. this is also the reconciliation path for a damaged
   journal: the chain — never an empty array — establishes what happened. */
$('recover').addEventListener('click',async function(){
  $('status').innerHTML='';
  var author=$('author').value.trim().toLowerCase(),permlink=slug($('permlink').value);
  if(!author||!permlink){log('name the drop to recover — author and permlink (an edition load fills both).','bad');return;}
  var rpc=$('rpc').value.trim().replace(/\/+$/,'');
  if(!rpc){log('name the rpc endpoint to read the chain from.','bad');return;}
  log('reading the chain alone for @'+author+'/'+permlink+' — no key, no journal, nothing is broadcast.','dim');
  var c;
  try{c=await rpcCall(rpc,'condenser_api.get_content',{author:author,permlink:permlink});}
  catch(e){log('the chain read failed ('+e.message+') — nothing was recovered; nothing beyond the read was attempted.','bad');return;}
  if(!(c&&c.body&&c.body.length)){log('the chain shows no such drop at @'+author+'/'+permlink+' from this endpoint. a chain read is not proof it never existed — another endpoint may know more; nothing was recovered.','bad');return;}
  var chainHash=await sha256Hex(new TextEncoder().encode(c.body));
  var deskBytes=currentBytes();
  var compare=deskBytes&&deskBytes.length?((await sha256Hex(deskBytes))===chainHash?'MATCH':'DIFFERS'):'not compared — no body in the desk';
  var scope={author:author,permlink:permlink,title:(c.title||$('title').value.trim()||''),
    parent_permlink:($('tags').value.split(/[\s,]+/).filter(Boolean)[0]||'hive'),
    tags:$('tags').value.split(/[\s,]+/).filter(Boolean).join(','),
    body_sha256:chainHash,body_bytes:new TextEncoder().encode(c.body).length,
    disclosure_version:DISCLOSURE_VERSION,rpc:rpc};
  if(CORRUPT){
    var seed={v:1,id:'@'+author+'/'+permlink,created_at:new Date().toISOString(),stage:'confirmed',
      scope:scope,body:null,signed_tx:null,receipt:null,attempts:0,last_error:null,
      events:[ev('recovered_from_chain','chain:'+c.block_num,{client:'recovery',journal:'damaged-quarantined',body_byte_compare:compare})]};
    seed.receipt=assembleReceipt(seed,c,chainHash,null);
    localStorage.setItem(OUTBOX_DAMAGED_KEY,localStorage.getItem(OUTBOX_DAMAGED_KEY)||CORRUPT.raw);
    CORRUPT=null; /* the chain established this scope's fate; the clean journal starts receipted */
    saveOutbox([seed]);
    renderOutbox([seed]);renderReceipt(seed);
    log('the chain established the outcome: @'+author+'/'+permlink+' landed in block '+c.block_num+', byte-compare '+compare+'. the damaged journal is preserved verbatim under '+OUTBOX_DAMAGED_KEY+' and a clean receipted journal begins — submissions are unblocked.','ok');
    return;
  }
  var a=loadOutbox();
  var rec=upsert(a,scope,function(r){r.stage='confirmed';r.receipt=assembleReceipt(r,c,chainHash,null);r.events.push(ev('recovered_from_chain','chain:'+c.block_num,{client:'fresh',body_byte_compare:compare}));});
  renderReceipt(rec);
  log('recovered from the chain alone: @'+author+'/'+permlink+' landed in block '+c.block_num+' · byte-compare '+compare+'. no key, no journal import, nothing broadcast — the chain was the keeper all along.','ok');
});
$('damaged-archive').addEventListener('click',function(){
  if(!CORRUPT)return;
  if(!window.confirm('archive the damaged journal? its bytes stay preserved under '+OUTBOX_DAMAGED_KEY+' — this only starts a clean journal and unblocks submissions.'))return;
  localStorage.setItem(OUTBOX_DAMAGED_KEY,JSON.stringify({archived_at:new Date().toISOString(),why:CORRUPT.why,raw:CORRUPT.raw}));
  CORRUPT=null;
  saveOutbox([]);
  renderOutbox([]);
  log('the damaged journal was archived deliberately — its bytes remain preserved under '+OUTBOX_DAMAGED_KEY+'. a clean journal begins; submissions are unblocked.','dim');
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
   bpay-invoice pattern: priced invoice, the founder's wallet signs, ceilings
   enforced by the module, nothing spent silently. */
$('preserve-ant').addEventListener('click',async function(){
  var ps=$('pstatus');ps.hidden=false;
  var line=function(t,cls){ps.innerHTML='';var d=document.createElement('div');if(cls)d.className=cls;d.textContent=t;ps.appendChild(d);};
  if(!lastRec||!lastRec.receipt||lastRec.stage!=='confirmed'){line('preservation needs a confirmed drop first.','bad');return;}
  if(!window.AntPay){line('the hosted purchaser module (ant-pay.js) did not load — preservation unavailable, nothing attempted.','bad');return;}
  if(!window.ethereum){line('no EVM wallet detected — the hosted ANT purchase needs your wallet to sign the priced invoice. nothing was attempted or spent.','bad');return;}
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
    var payer=window.AntPay.createHosted({artifact:{name:file.name,sha256:sha,bytes:file.size},network:defaults.payment,storage:localStorage,rpc:rpc,ethereum:window.ethereum});
    await payer.retryUnpaid();
    line('asking Autonomi for the price of '+file.size.toLocaleString()+' bytes — nothing is signed yet.','dim');
    var paid=await client.upload(file,{visibility:'public',paymentMode:'single',payment:{
      pay:async function(network,quotes,context){
        var inv=await payer.invoice(network,quotes,'20000000000000000',null);
        line('invoice ready: review it in your wallet before signing. aggregate ceilings are enforced by the shared module.','dim');
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
reconcileAll(true).then(function(a){
  var pend=a.filter(function(r){return r.stage==='signed'||r.stage==='submitted';});
  if(pend.length)log('recovered state: '+pend.length+' drop(s) in flight — reconciled against the chain on load; nothing was re-signed or re-published blind.','dim');
  if(CORRUPT)log('the recoverable journal is damaged — bytes preserved, problem reported, submissions refused until the chain reconciles what happened (see the outbox).','bad');
  renderOutbox(a);
});
})();
