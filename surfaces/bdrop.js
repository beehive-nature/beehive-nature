/* bdrop.js — the drop desk's hands. No storage, no telemetry, no gating:
   the page informs at the point of use, the founder's single click executes.
   The posting key signs in this tab and is wiped the moment the signature
   exists; only the signed transaction travels, to the endpoint named on the page. */
(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
if(!window.hiveTx){
  var pb=$('publish');if(pb)pb.disabled=true;
  var st0=$('status');
  if(st0)st0.innerHTML='<span class="bad">the signing library did not load (onboarding/vendor/hive-tx.min.js). the desk cannot act — nothing was attempted.</span>';
  return;
}
var H=window.hiveTx;
var DISCLOSURE_VERSION='bdrop-0001-disclosure-v1';
var receiptState=null;

function log(msg,cls){
  var box=$('status');
  var line=document.createElement('div');
  if(cls)line.className=cls;
  line.textContent=new Date().toISOString().slice(11,19)+' '+msg;
  box.appendChild(line);box.scrollTop=box.scrollHeight;
}

/* bytes: a loaded file is hashed verbatim; a paste is hashed as its UTF-8 bytes */
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
$('body').addEventListener('input',function(){bodyFrom='paste';bodyBytes=null;rehash();});
$('expected').addEventListener('input',rehash);
$('bodyfile').addEventListener('change',function(ev){
  var f=ev.target.files&&ev.target.files[0];
  if(!f)return;
  f.arrayBuffer().then(function(ab){
    bodyBytes=ab;bodyFrom='file';
    $('body').value=new TextDecoder().decode(ab);
    rehash();
  }).catch(function(e){log('file read failed: '+e.message,'bad');});
});

function wipe(){
  $('wif').value='';
  log('posting key wiped from the field.','dim');
}
$('wipe').addEventListener('click',wipe);
window.addEventListener('beforeunload',wipe);

function slug(s){return s.toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');}
function firstTag(){return $('tags').value.split(/[\s,]+/).filter(Boolean)[0]||'hive';}
function jsonMetadata(){
  var tags=$('tags').value.split(/[\s,]+/).filter(Boolean);
  return JSON.stringify({tags:tags.length?tags:['hive'],app:'bnr/bdrop/1.0',format:'markdown',disclosure_version:DISCLOSURE_VERSION});
}
async function rpcCall(endpoint,method,params){
  var r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:method,params:params})});
  if(!r.ok)throw new Error('rpc http '+r.status);
  var j=await r.json();
  if(j.error)throw new Error('rpc error: '+(j.error.message||JSON.stringify(j.error)));
  return j.result;
}

$('publish').addEventListener('click',async function(){
  $('status').innerHTML='';
  var author=$('author').value.trim().toLowerCase();
  var permlink=slug($('permlink').value)||('bdrop-'+Date.now());
  var title=$('title').value.trim();
  var body=$('body').value;
  var rpc=$('rpc').value.trim().replace(/\/+$/,'');
  var wif=$('wif').value.trim();
  if(!body){log('no body — nothing to publish, nothing attempted.','bad');return;}
  if(!wif){log('no posting key given — nothing attempted, nothing sent.','bad');return;}
  var key;
  try{
    key=H.PrivateKey.from(wif);
    log('key read locally; derived public key '+String(key.createPublic())+' — shown once, never stored.','dim');
  }catch(e){
    log('the key does not read as a WIF ('+e.message+'). nothing was sent.','bad');return;
  }
  if(!lastHash)await rehash();
  var bodyHash=lastHash, bodyLen=currentBytes().length;
  log('gesture accepted — body hashed before your eyes: sha-256 '+bodyHash+' · '+bodyLen.toLocaleString()+' bytes.');
  var op=['comment',{parent_author:'',parent_permlink:firstTag(),author:author,permlink:permlink,
    title:title,body:body,json_metadata:jsonMetadata()}];
  $('opjson').textContent=JSON.stringify(op,null,1);
  H.config.node=rpc;
  var tx=new H.Transaction([op]);
  try{
    log('building the transaction against '+rpc+' (reference block, expiration)…');
    await tx.create([op]);
    log('signing in this tab…');
    tx.sign(key);
    var txidLocal=tx.txId||null; /* computed client-side over the serialized bytes */
    $('txjson').textContent=JSON.stringify(tx.signedTransaction||tx.transaction,null,1);
    $('wif').value=''; /* the key dies the moment the signature exists */
    log('posting key wiped. broadcasting the signed transaction — the key does not travel.','dim');
    var res=await tx.broadcast();
    var txid=txidLocal||((typeof res==='string'&&res)?res:((res&&(res.id||res.result))||null));
    if(txid)log('broadcast accepted. transaction id '+txid,'ok');
    else log('broadcast accepted (endpoint returned no id — the block lookup below is the receipt).','ok');
    await confirm(author,permlink,title,bodyHash,bodyLen,txid,rpc);
  }catch(e){
    $('wif').value='';
    log('the gesture failed: '+(e&&e.message?e.message:e)+' — nothing further attempted. the desk never claims a send it cannot see.','bad');
  }
});

async function confirm(author,permlink,title,bodyHash,bodyLen,txid,rpc){
  var box=$('receipt');
  box.innerHTML='<span class="dim">waiting for the chain to land the drop…</span>';
  for(var i=1;i<=30;i++){
    await new Promise(function(r){setTimeout(r,4000)});
    var c;
    try{c=await rpcCall(rpc,'condenser_api.get_content',{author:author,permlink:permlink});}
    catch(e){log('lookup '+i+' failed: '+e.message,'dim');continue;}
    if(c&&c.body&&c.body.length){
      var pubHash=await sha256Hex(new TextEncoder().encode(c.body));
      var match=pubHash===bodyHash;
      receiptState={v:1,what:'bDroP publication receipt',chain:'hive-mainnet',author:author,permlink:permlink,
        title:title,body_sha256_signed:bodyHash,body_sha256_published:pubHash,body_bytes:bodyLen,
        body_byte_compare:match?'MATCH':'DIFFERS',txid:txid||'not returned by endpoint',block_num:c.block_num,
        created:c.created,rpc_endpoint:rpc,disclosure_version:DISCLOSURE_VERSION,
        surface:'surfaces/bdrop.html',signed_at:new Date().toISOString()};
      var u='https://hive.blog/@'+author+'/'+permlink;
      $('permlinkurl').href=u;
      $('permlinkurl').textContent='the drop on hive.blog — '+u+' (opens a new tab)';
      $('permwrap').hidden=false;$('download').hidden=false;
      box.innerHTML='';
      var ok=document.createElement('div');ok.className='ok';
      ok.textContent='LANDED · block '+c.block_num+' · created '+c.created+' · published body sha-256 '+pubHash+' · byte-compare '+(match?'MATCH':'DIFFERS');
      box.appendChild(ok);
      if(!match){
        var bad=document.createElement('div');bad.className='bad';
        bad.textContent='the published bytes differ from the signed bytes — both digests ride the receipt; the signed digest is the edition\u2019s.';
        box.appendChild(bad);
      }
      var meta=document.createElement('div');meta.className='dim';
      meta.textContent='transaction id: '+(txid||'not returned by this endpoint — the block number and permlink are the durable receipt');
      box.appendChild(meta);
      log('receipt complete. land it in the estate tree — the chain, not prose, is the proof.','ok');
      return;
    }
    log('lookup '+i+': not landed yet ('+(30-i)+' tries left).','dim');
  }
  box.innerHTML='<span class="bad">not seen in 30 lookups (about two minutes). this is a lookup timeout, NOT proof of failure or success — check the permlink by hand before retrying: after a landing, a retry edits the post, it does not repost it.</span>';
}

$('download').addEventListener('click',function(){
  if(!receiptState)return;
  var blob=new Blob([JSON.stringify(receiptState,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='bdrop-receipt-'+receiptState.permlink+'.json';
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
});

rehash();
})();
