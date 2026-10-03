/*! bchat-wire.js — the bChat lane's NIP-01/NIP-17 wire assembly (SPEC-BCHAT-1 §wire).
  SPDX-License-Identifier: Apache-2.0
  Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
  Licensed under the Apache License, Version 2.0 (the "License"); you may
  not use this file except in compliance with the License. You may obtain
  a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
  See /LICENSE and /NOTICE in this repository. Applies to the bChat lane.

  ONE implementation shared by the surface (bchat.html) and the lane's
  harnesses (scripts/bchat-live-proof.mjs) — the page keeps only its ROOM
  block and socket code (turnkey law), everything that shapes EVENTS lives
  here:
    serializeEvent / finishEvent / verifyEvent — NIP-01 canonical ids +
    BIP-340 schnorr signatures via the vendored noble bundle (BnrSign).
    buildDM   — envelope → rumor(kind 14, unsigned) → seal(kind 14, signed,
                NIP-44 v2 to recipient) → gift(kind 1059, ONE-TIME ephemeral
                key, NIP-44 v2 to recipient). The ephemeral key never leaves
                this call.
    unwrapGift — eph→us opens the wrap, the seal's signature is VERIFIED
                (a failed seal is refused, never shown untrusted), then
                sender→us opens the rumor. Only kind-14 rumors are DMs.

  Zero state; pure functions over (secHex, pubHex). Requires BnrSign and
  BCHATNIP44 to be loaded first (bchat-nip44.js enforces its own order). */
(function(){
'use strict';
var G=(typeof window!=='undefined')?window:globalThis;
var N=G.BnrSign, W=G.BCHATNIP44;
if(!N||!W) throw new Error('bchat-wire: BnrSign + bchat-nip44 must load first');

function serializeEvent(pub,created_at,kind,tags,content){
  return '["0",'+JSON.stringify(pub)+','+created_at+','+kind+','+JSON.stringify(tags)+','+JSON.stringify(content)+']';
}
function finishEvent(ev,secHex){
  ev.id=W.bytesToHex(N.sha256(W.utf8encode(serializeEvent(ev.pubkey,ev.created_at,ev.kind,ev.tags,ev.content))));
  ev.sig=W.bytesToHex(N.schnorr.sign(W.hexToBytes(ev.id),W.hexToBytes(secHex)));
  return ev;
}
function verifyEvent(ev){
  try{
    var id=W.bytesToHex(N.sha256(W.utf8encode(serializeEvent(ev.pubkey,ev.created_at,ev.kind,ev.tags,ev.content))));
    if(id!==ev.id) return false;
    return !!N.schnorr.verify(W.hexToBytes(ev.sig),W.hexToBytes(ev.id),W.hexToBytes(ev.pubkey));
  }catch(e){ return false; }
}
function nowSec(){ return Math.floor(Date.now()/1000); }
function xonly(secHex){
  return W.bytesToHex(N.secp.getPublicKey(W.hexToBytes(secHex),true).slice(1));
}
function buildDM(secHex,fromPub,rcptPub,envJson){
  if(xonly(secHex)!==fromPub) throw new Error('buildDM: fromPub must be the x-only of sec');
  var rumor={pubkey:fromPub,created_at:nowSec(),kind:14,tags:[['p',rcptPub]],content:envJson};
  var ckSeal=W.conversationKey(secHex,rcptPub);
  var seal=finishEvent({
    pubkey:fromPub,created_at:nowSec(),kind:14,tags:[['p',rcptPub]],
    content:W.encrypt(ckSeal,JSON.stringify(rumor))
  },secHex);
  var eph=new Uint8Array(32);
  (G.crypto||require('crypto')).getRandomValues(eph);
  var ephHex=W.bytesToHex(eph);
  var ckGift=W.conversationKey(ephHex,rcptPub);
  var gift=finishEvent({
    pubkey:xonly(ephHex),created_at:nowSec(),kind:1059,tags:[['p',rcptPub]],
    content:W.encrypt(ckGift,JSON.stringify(seal))
  },ephHex);
  return gift;
}
function unwrapGift(secHex,myPub,gift){
  if(xonly(secHex)!==myPub) throw new Error('unwrapGift: myPub must be the x-only of sec');
  var ckGift=W.conversationKey(secHex,gift.pubkey);
  var seal=JSON.parse(W.decrypt(ckGift,gift.content));
  if(!verifyEvent(seal)) throw new Error('seal signature failed verification — message shown untrusted is refused');
  var ckSeal=W.conversationKey(secHex,seal.pubkey);
  var rumor=JSON.parse(W.decrypt(ckSeal,seal.content));
  if(rumor.kind!==14) throw new Error('rumor kind '+rumor.kind+' is not a DM');
  if(!(rumor.tags||[]).some(function(t){return t[0]==='p'&&t[1]===myPub;}))
    throw new Error('rumor is not addressed to this identity');
  return {rumor:rumor,from:seal.pubkey};
}

G.BCHATWIRE={
  serializeEvent:serializeEvent,finishEvent:finishEvent,verifyEvent:verifyEvent,
  buildDM:buildDM,unwrapGift:unwrapGift,xonly:xonly,nowSec:nowSec
};
})();
