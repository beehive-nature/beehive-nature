/*! bchat-nip44.js — NIP-44 v2 encryption for the bChat lane (SPEC-BCHAT-1).
  SPDX-License-Identifier: Apache-2.0
  Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
  Licensed under the Apache License, Version 2.0 (the "License"); you may
  not use this file except in compliance with the License. You may obtain
  a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
  See /LICENSE and /NOTICE in this repository. Applies to the bChat lane:
  this NIP-44 v2 module, bchat-core.js, and the bchat surface.

  The estate had NO JS NIP-44 (Rust-only, bpay-rail branch); this module is
  the JS seat, built ONLY on parts already vendored in-tree:
    surfaces/onboarding/vendor/bnr-sign.js — @noble/secp256k1 2.3.0 (ECDH
    getSharedSecret), @noble/hashes 1.8.0 (sha256, hmac), MIT.
  Supplied here (pure JS, zero deps, vector-pinned):
    HKDF-SHA256 — RFC 5869 (test case 1 pinned in e2e/bchat-core.test.mjs)
    ChaCha20    — RFC 8439 §2.3.2/§2.4.2 vectors pinned in the same file.
  Algorithm source: NIP-44 v2 as published 2026-10-02
    https://github.com/nostr-protocol/nips/blob/master/44.md
  Official vectors: paulmillr/nip44 nip44.vectors.json,
    sha256 269ed0f69e4c192512cc779e78c555090cebc7c785b609e338a62afc3ce25040 PUBLIC-CONSTANT
  PUBLIC-CONSTANT (the pin above and the selftest below are the NIP's own
  published test vectors — public by definition).
  Crypto wording law: sound by construction against pinned vectors; claims
  cite file+function — the vectors ARE the receipt.
  Deployment lesson carried (bkimi 2026-09-17): the v2 plaintext cap is
  implementation-deployed — THIS module caps encrypt() at 65,535 BYTES and
  rejects empty; the caller sizes before calling, never after. */
(function(){
'use strict';
var G=(typeof window!=='undefined')?window:globalThis;
var N=G.BnrSign;
if(!N||!N.secp||!N.sha256||!N.hmac||!N.secp.getSharedSecret){
  throw new Error('bchat-nip44: BnrSign (vendor/bnr-sign.js) must load first');
}

/* ── bytes ── */
function cat(){
  var n=0,i; for(i=0;i<arguments.length;i++) n+=arguments[i].length;
  var out=new Uint8Array(n),o=0;
  for(i=0;i<arguments.length;i++){ out.set(arguments[i],o); o+=arguments[i].length; }
  return out;
}
function hexToBytes(h){
  if(typeof h!=='string'||h.length%2) throw new Error('hex invalid');
  var out=new Uint8Array(h.length>>1);
  for(var i=0;i<out.length;i++){
    var hi=h.charCodeAt(i*2),lo=h.charCodeAt(i*2+1);
    hi=hi<58?hi-48:(hi&~32)-55; lo=lo<58?lo-48:(lo&~32)-55;
    if(!(hi>=0&&hi<16&&lo>=0&&lo<16)) throw new Error('hex invalid');
    out[i]=(hi<<4)|lo;
  }
  return out;
}
function bytesToHex(b){
  var s='';
  for(var i=0;i<b.length;i++) s+=(b[i]<16?'0':'')+b[i].toString(16);
  return s;
}
/* realm-tolerant byte-array check: works when the module is loaded in a
   vm context with arrays from another realm (the e2e pattern) */
function isU8(x){
  return x&&typeof x==='object'&&x.buffer&&x.BYTES_PER_ELEMENT===1&&x.byteLength===x.length;
}
function asBytes32(x){
  var b=isU8(x)?x:(typeof x==='string'?hexToBytes(x.replace(/^0x/,'')):null);
  if(!b||b.length!==32) throw new Error('expected 32 bytes');
  return b;
}
function asHex64(x){
  var h=(typeof x==='string')?x.replace(/^0x/,''):bytesToHex(x);
  if(!/^[0-9a-fA-F]{64}$/.test(h)) throw new Error('expected x-only pubkey (64 hex)');
  return h.toLowerCase();
}
function utf8encode(s){
  if(typeof TextEncoder!=='undefined') return new TextEncoder().encode(s);
  var out=[];
  for(var i=0;i<s.length;i++){
    var c=s.codePointAt(i);
    if(c>0xffff) i++;
    if(c<0x80) out.push(c);
    else if(c<0x800) out.push(0xc0|c>>6,0x80|c&63);
    else if(c<0x10000) out.push(0xe0|c>>12,0x80|c>>6&63,0x80|c&63);
    else out.push(0xf0|c>>18,0x80|c>>12&63,0x80|c>>6&63,0x80|c&63);
  }
  return new Uint8Array(out);
}
function utf8decode(b){
  if(typeof TextDecoder!=='undefined') return new TextDecoder().decode(b);
  var s='',i=0;
  while(i<b.length){
    var c=b[i];
    if(c<0x80){ s+=String.fromCharCode(c); i++; }
    else if(c<0xe0){ s+=String.fromCharCode((c&31)<<6|b[i+1]&63); i+=2; }
    else if(c<0xf0){ s+=String.fromCharCode((c&15)<<12|(b[i+1]&63)<<6|b[i+2]&63); i+=3; }
    else{ s+=String.fromCodePoint((c&7)<<18|(b[i+1]&63)<<12|(b[i+2]&63)<<6|(b[i+3]&63)); i+=4; }
  }
  return s;
}
/* strict RFC 4648 base64 — the NIP's invalid vectors reject uri-alphabet and
   non-ascii characters, so decode accepts ONLY [A-Za-z0-9+/] with '=' tail */
var B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64encode(b){
  var s='';
  for(var i=0;i<b.length;i+=3){
    var a=b[i],m=b[i+1],z=b[i+2],has2=i+1<b.length,has3=i+2<b.length;
    s+=B64[a>>2];
    s+=B64[(a&3)<<4|(has2?m>>4:0)];
    s+=has2?B64[(m&15)<<2|(has3?z>>6:0)]:'=';
    s+=has3?B64[z&63]:'=';
  }
  return s;
}
function b64decode(s){
  if(typeof s!=='string'||s.length===0||s.length%4) throw new Error('invalid base64');
  var pad=0;
  if(s.slice(-2)==='==') pad=2; else if(s.slice(-1)==='=') pad=1;
  var n=s.length,out=[],buf=0,bits=0;
  for(var i=0;i<n;i++){
    var ch=s.charAt(i);
    if(ch==='='){ if(i<n-pad) throw new Error('invalid base64'); continue; }
    var v=B64.indexOf(ch);
    if(v<0) throw new Error('invalid base64');
    buf=(buf<<6)|v; bits+=6;
    if(bits>=8){ bits-=8; out.push((buf>>bits)&255); }
  }
  return new Uint8Array(out);
}
function ctEq(a,b){
  if(a.length!==b.length) return false;
  var d=0;
  for(var i=0;i<a.length;i++) d|=a[i]^b[i];
  return d===0;
}
function randomBytes(n){
  var b=new Uint8Array(n);
  var c=G.crypto;
  if(!c||!c.getRandomValues) throw new Error('no secure randomness source');
  c.getRandomValues(b);
  return b;
}

/* ── hashes (delegated to the vendored noble bundle) ── */
function sha256(data){ return N.sha256(data); }
function hmacSha256(key,data){ return N.hmac(N.sha256,key,data); }

/* ── HKDF-SHA256, RFC 5869 ── */
function hkdfExtract(salt,ikm){ return hmacSha256(salt,ikm); }
function hkdfExpand(prk,info,len){
  prk=asBytes32(prk);
  if(!Number.isSafeInteger(len)||len<1||len>255*32) throw new Error('bad hkdf length');
  var infoB=isU8(info)?info:new Uint8Array(0);
  var t=new Uint8Array(0),out=[],left=len,i=1;
  while(left>0){
    t=hmacSha256(prk,cat(t,infoB,[i]));
    var take=Math.min(32,left);
    out.push(t.slice(0,take)); left-=take; i++;
  }
  return cat.apply(null,out);
}

/* ── ChaCha20, RFC 8439 ── */
function rotl(v,n){ return ((v<<n)|(v>>>(32-n)))>>>0; }
function qr(s,a,b,c,d){
  s[a]=(s[a]+s[b])>>>0; s[d]=rotl(s[d]^s[a],16);
  s[c]=(s[c]+s[d])>>>0; s[b]=rotl(s[b]^s[c],12);
  s[a]=(s[a]+s[b])>>>0; s[d]=rotl(s[d]^s[a],8);
  s[c]=(s[c]+s[d])>>>0; s[b]=rotl(s[b]^s[c],7);
}
function le32(b,o){ return (b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0; }
function chacha20(key,nonce,counter,data){
  if(!isU8(key)||key.length!==32) throw new Error('chacha key must be 32 bytes');
  if(!isU8(nonce)||nonce.length!==12) throw new Error('chacha nonce must be 12 bytes');
  var out=new Uint8Array(data.length);
  var st=new Uint32Array(16),w=new Uint32Array(16);
  st[0]=0x61707865; st[1]=0x3320646e; st[2]=0x79622d32; st[3]=0x6b206574;
  for(var i=0;i<8;i++) st[4+i]=le32(key,4*i);
  st[12]=counter>>>0;
  for(i=0;i<3;i++) st[13+i]=le32(nonce,4*i);
  for(var off=0;off<data.length;off+=64){
    w.set(st);
    for(var r=0;r<10;r++){
      qr(w,0,4,8,12); qr(w,1,5,9,13); qr(w,2,6,10,14); qr(w,3,7,11,15);
      qr(w,0,5,10,15); qr(w,1,6,11,12); qr(w,2,7,8,13); qr(w,3,4,9,14);
    }
    for(i=0;i<16;i++) w[i]=(w[i]+st[i])>>>0;
    var n=Math.min(64,data.length-off);
    for(i=0;i<n;i++) out[off+i]=data[off+i]^((w[i>>2]>>>((i&3)*8))&255);
    st[12]=(st[12]+1)>>>0;
  }
  return out;
}

/* ── NIP-44 v2 ──
   conversation key = HKDF-SHA256 extract(salt=utf8('nip44-v2'),
     ikm = x-only ECDH(privA, lift_even(pub2)) x-coordinate)
   message keys     = HKDF-SHA256 expand(prk=conversation key, info=nonce, L=76)
     → chacha_key[0..32) chacha_nonce[32..44) hmac_key[44..76)
   token = base64( 0x02 ‖ nonce(32) ‖ chacha20(padded) ‖ HMAC(hmac_key, nonce‖ct) ) */
function conversationKey(sec1,pub2){
  var sec=asBytes32(sec1),pub=asHex64(pub2);
  /* lift x-only to even-Y compressed (the NIP-44 convention; noble validates
     the point is on curve — twist and no-sqrt pubkeys throw here) */
  var shared=N.secp.getSharedSecret(sec,cat(new Uint8Array([0x02]),hexToBytes(pub)));
  var x=(shared.length===33)?shared.slice(1,33):shared;
  return hkdfExtract(utf8encode('nip44-v2'),x);
}
function messageKeys(conversationKeyBytes,nonce){
  var e=hkdfExpand(asBytes32(conversationKeyBytes),asBytes32(nonce),76);
  return {chachaKey:e.slice(0,32),chachaNonce:e.slice(32,44),hmacKey:e.slice(44,76)};
}
function calcPaddedLen(len){
  if(!Number.isSafeInteger(len)||len<0) throw new Error('bad length');
  if(len<=32) return 32;
  var nextPower=Math.pow(2,Math.floor(Math.log2(len-1))+1);
  var chunk=nextPower<=256?32:nextPower/8;
  return chunk*Math.ceil(len/chunk);
}
function pad(pt){
  var len=pt.length;
  var head=(len<65536)
    ? new Uint8Array([len>>>8&255,len&255])
    : new Uint8Array([0,0,len>>>24&255,len>>>16&255,len>>>8&255,len&255]);
  /* the padded target counts the CONTENT, not the prefix — pinned by the
     official encrypt vectors (e.g. "a" → 2-byte head + 32-byte padded) */
  return cat(head,pt,new Uint8Array(calcPaddedLen(len)-len));
}
function unpad(b){
  if(b.length<2) throw new Error('invalid padding');
  var hl=(b[0]===0&&b[1]===0)?6:2,len;
  if(hl===2) len=(b[0]<<8)|b[1];
  else{
    if(b.length<6) throw new Error('invalid padding');
    len=((b[2]<<24)|(b[3]<<16)|(b[4]<<8)|b[5])>>>0;
  }
  if(len<1||hl+len>b.length) throw new Error('invalid padding');
  /* the buffer must land exactly on the chunk boundary the padder chose */
  if(b.length-hl!==calcPaddedLen(len)) throw new Error('invalid padding');
  for(var i=hl+len;i<b.length;i++) if(b[i]!==0) throw new Error('invalid padding');
  return b.slice(hl,hl+len);
}
/* the deployed cap is explicit and checked BEFORE any crypto runs */
var MAX_PLAINTEXT_BYTES=65535;
function encrypt(ck,plaintext,nonceOpt){
  var pt=isU8(plaintext)?plaintext:utf8encode(String(plaintext));
  if(pt.length===0||pt.length>MAX_PLAINTEXT_BYTES) throw new Error('invalid plaintext length: 1..'+MAX_PLAINTEXT_BYTES+' bytes');
  var nonce=(nonceOpt!==undefined&&nonceOpt!==null)?asBytes32(nonceOpt):randomBytes(32);
  var k=messageKeys(ck,nonce);
  var ct=chacha20(k.chachaKey,k.chachaNonce,0,pad(pt));
  var mac=hmacSha256(k.hmacKey,cat(nonce,ct));
  return b64encode(cat(new Uint8Array([2]),nonce,ct,mac));
}
function decrypt(ck,payload){
  var d=b64decode(payload);
  if(d.length<99) throw new Error('invalid payload length');
  if(d[0]===35) throw new Error('unknown encryption version');
  if(d[0]!==2) throw new Error('unknown encryption version '+d[0]);
  var nonce=d.slice(1,33),mac=d.slice(d.length-32),ct=d.slice(33,d.length-32);
  var k=messageKeys(ck,nonce);
  if(!ctEq(hmacSha256(k.hmacKey,cat(nonce,ct)),mac)) throw new Error('invalid MAC');
  return utf8decode(unpad(chacha20(k.chachaKey,k.chachaNonce,0,ct)));
}

/* ── in-page selftest: the NIP's own canonical vectors, so any reader can
   prove the encryptor without trusting this comment (full battery:
   e2e/bchat-core.test.mjs) ── */
function selftest(){
  var r=[];
  function t(name,fn){
    try{ fn(); r.push({name:name,ok:true}); }
    catch(e){ r.push({name:name,ok:false,err:e.message}); }
  }
  var SEC1='0000000000000000000000000000000000000000000000000000000000000001'; // PUBLIC-CONSTANT
  var SEC2='0000000000000000000000000000000000000000000000000000000000000002'; // PUBLIC-CONSTANT
  var CK='c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d'; // PUBLIC-CONSTANT
  var NONCE='0000000000000000000000000000000000000000000000000000000000000001'; // PUBLIC-CONSTANT
  var PAYLOAD='AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABee0G5VSK0/9YypIObAtDKfYEAjD35uVkHyB0F4DwrcNaCXlCWZKaArsGrY6M9wnuTMxWfp1RTN9Xga8no+kF5Vsb'; // PUBLIC-CONSTANT
  t('conversation key (sec1=…01, sec2=…02)',function(){
    var pub2=bytesToHex(N.secp.getPublicKey(hexToBytes(SEC2),true).slice(1));
    if(bytesToHex(conversationKey(hexToBytes(SEC1),pub2))!==CK) throw new Error('conversation key mismatch');
  });
  t('encrypt "a" with pinned nonce',function(){
    if(encrypt(hexToBytes(CK),'a',hexToBytes(NONCE))!==PAYLOAD) throw new Error('payload mismatch');
  });
  t('decrypt the canonical payload',function(){
    if(decrypt(hexToBytes(CK),PAYLOAD)!=='a') throw new Error('plaintext mismatch');
  });
  t('tamper rejected (invalid MAC)',function(){
    var i=PAYLOAD.length-3;
    var bad=PAYLOAD.slice(0,i)+(PAYLOAD.charAt(i)==='A'?'B':'A')+PAYLOAD.slice(i+1);
    var threw=false;
    try{ decrypt(hexToBytes(CK),bad); }catch(e){ threw=true; }
    if(!threw) throw new Error('tamper accepted');
  });
  t('round-trip with a fresh key',function(){
    var sec=randomBytes(32),pub2=bytesToHex(N.secp.getPublicKey(sec,true).slice(1));
    var ck=conversationKey(sec,pub2);
    var p=encrypt(ck,'honey ⛓ emoji ✓');
    if(decrypt(ck,p)!=='honey ⛓ emoji ✓') throw new Error('round-trip mismatch');
  });
  return r;
}

G.BCHATNIP44={
  MAX_PLAINTEXT_BYTES:MAX_PLAINTEXT_BYTES,
  conversationKey:conversationKey,
  messageKeys:messageKeys,
  calcPaddedLen:calcPaddedLen,
  encrypt:encrypt,
  decrypt:decrypt,
  selftest:selftest,
  /* primitives exposed for tests and the cypherpunk register */
  hkdfExtract:hkdfExtract,hkdfExpand:hkdfExpand,chacha20:chacha20,
  utf8encode:utf8encode,utf8decode:utf8decode,
  b64encode:b64encode,b64decode:b64decode,
  hexToBytes:hexToBytes,bytesToHex:bytesToHex,cat:cat,ctEq:ctEq
};
})();
