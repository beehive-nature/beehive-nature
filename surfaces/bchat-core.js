/*! bchat-core.js — the bChat lane's transport-neutral core (SPEC-BCHAT-1).
  SPDX-License-Identifier: Apache-2.0
  Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
  Licensed under the Apache License, Version 2.0 (the "License"); you may
  not use this file except in compliance with the License. You may obtain
  a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
  See /LICENSE and /NOTICE in this repository.

  ONE conversation surface, THREE trust lanes — the lane is payload, not
  decoration (founder order 2026-10-02: "one app where a thread can visibly
  distinguish SMS / BNR Private / Autonomi attachment … the system keeps
  the trust boundaries explicit"):
    sms                 carrier transport — DISPLAY-ONLY, low trust. BNR
                        keys never touch the telephony subsystem (E5 law:
                        the handset is never a root-key holder).
    bnr-private         NIP-44 v2 end-to-end between nostr identities
                        (bchat-nip44.js), NIP-17 gift-wrapped on the wire.
    autonomi-attachment a small encrypted message carrying a CAPABILITY
                        (address+bytes+hash), never the bytes themselves;
                        the object is retrieved separately and its state
                        is a MEASURED state, never asserted.

  The envelope is the COMMIT layer of the estate's messaging vocabulary:
    COMMIT  sender binds an identity (npub) or a labeled pseudonym — the
            envelope carries WHO, never a phone number for private lanes.
    PROVE   optional claims field (future: credentials) — absent by default.
    RETAIN / FORGET  publication-consent routing, NOT deletion — no
            deletion promise exists anywhere (GLOSSARY-BRIDGE ruling);
            applyRetain() prunes the LOCAL store and reports what it did.
    SETTLE  paid services founder-gated; receipts never carry contents.

  Zero dependencies; pure model. The wire adapters (relay, SMS bridge,
  Autonomi retrieval) live in the surfaces and adapter seams, never here. */
(function(){
'use strict';
var G=(typeof window!=='undefined')?window:globalThis;

var V=1;
var LANES=Object.freeze({
  SMS:'sms',
  BNR:'bnr-private',
  AUTONOMI:'autonomi-attachment'
});
var LANE_TRUST=Object.freeze({
  'sms':'carrier — display-only, low trust; keys never touch telephony',
  'bnr-private':'end-to-end NIP-44 v2 between nostr identities',
  'autonomi-attachment':'capability travels, bytes stay out; retrieval is a measured state'
});
var RETAIN=Object.freeze(['persistent','until-read','ephemeral']);
/* measured states, in order — a state is ENTERED by evidence, never skipped */
var ATTACH_STATES=Object.freeze(['descriptor-only','retrieving','retrieved','hash-verified']);
var FORGET_LAW='RETAIN/FORGET is publication-consent routing, not deletion — no deletion promise exists anywhere (GLOSSARY-BRIDGE ruling 2026-09)';

function id32(){
  try{
    var b=new Uint8Array(16);
    (G.crypto||require('crypto')).getRandomValues(b);
    var s='';
    for(var i=0;i<b.length;i++) s+=(b[i]<16?'0':'')+b[i].toString(16);
    return s;
  }catch(e){ return Date.now().toString(16)+Math.floor(Math.random()*0xffffffff).toString(16); }
}
function isHex64(s){ return typeof s==='string'&&/^[0-9a-fA-F]{64}$/.test(s); }

function validate(env){
  var errs=[];
  if(!env||typeof env!=='object') return ['envelope must be an object'];
  if(env.v!==V) errs.push('v must be '+V);
  if(Object.keys(LANES).map(function(k){return LANES[k];}).indexOf(env.lane)<0)
    errs.push('lane must be one of the three trust lanes');
  var f=env.from||{};
  if(['npub','phone','label'].indexOf(f.kind)<0) errs.push('from.kind must be npub|phone|label');
  else if(f.kind==='npub'&&!isHex64(f.value)) errs.push('npub identity must be 64-hex (x-only)');
  else if(f.kind==='phone'&&!/^\+?[0-9]{7,15}$/.test(String(f.value))) errs.push('phone must be E.164-ish digits');
  else if(f.kind==='label'&&(typeof f.value!=='string'||!f.value.length)) errs.push('label identity must be non-empty');
  var b=env.body||{};
  if(b.type==='text'){
    if(typeof b.text!=='string'||b.text.length===0) errs.push('text body must be non-empty');
    if(b.text.length>65535) errs.push('text body exceeds the NIP-44 v2 deployed cap (65535 bytes)');
  }else if(b.type==='attachment'){
    var a=env.attachment;
    if(!a||typeof a!=='object') errs.push('attachment body requires an attachment descriptor');
    else{
      if(!/^autonomi:\/\/[0-9a-fA-F]{64}$/.test(String(a.addr||''))) errs.push('attachment.addr must be autonomi:// + 64 hex');
      if(!Number.isSafeInteger(a.bytes)||a.bytes<1) errs.push('attachment.bytes must be a positive integer');
      if(!isHex64(a.sha256)) errs.push('attachment.sha256 must be 64 hex');
      if(ATTACH_STATES.indexOf(a.state)<0) errs.push('attachment.state must be a measured state');
    }
  }else errs.push('body.type must be text|attachment');
  var p=env.policy||{};
  if(RETAIN.indexOf(p.retain)<0) errs.push('policy.retain must be persistent|until-read|ephemeral');
  if(p.forgetAt!==undefined&&(!Number.isSafeInteger(p.forgetAt)||p.forgetAt<1)) errs.push('policy.forgetAt must be a positive epoch ms');
  return errs;
}
function envelope(fields){
  fields=fields||{};
  var env={
    v:V,
    id:id32(),
    ts:Date.now(),
    lane:fields.lane,
    from:fields.from,
    body:fields.body,
    policy:{retain:(fields.policy&&fields.policy.retain)||'persistent'}
  };
  if(fields.policy&&fields.policy.forgetAt!==undefined) env.policy.forgetAt=fields.policy.forgetAt;
  if(fields.attachment) env.attachment=fields.attachment;
  if(fields.claims) env.claims=fields.claims; /* PROVE — absent by default */
  var errs=validate(env);
  return errs.length?{ok:false,errors:errs}:{ok:true,env:env};
}
/* the rumor content on the wire — canonical key order, nothing ambient */
function wireEncode(env){
  var e=validate(env);
  if(e.length) throw new Error('wireEncode refuses an invalid envelope: '+e.join('; '));
  return JSON.stringify({
    v:env.v,id:env.id,ts:env.ts,lane:env.lane,
    from:env.from,body:env.body,
    attachment:env.attachment||undefined,
    policy:env.policy,claims:env.claims||undefined
  });
}
function wireDecode(json){
  var env=JSON.parse(json);
  var errs=validate(env);
  if(errs.length) throw new Error('wireDecode refuses an invalid envelope: '+errs.join('; '));
  return env;
}
/* FORGET — local pruning with an honest report (bmeshasi law: forget()
   returns what actually happened). store: [{env, read:bool}] */
function applyRetain(store,now){
  var dropped=[],keep=[];
  store.forEach(function(m){
    var r=m.env.policy.retain;
    if(r==='until-read'&&m.read) dropped.push({id:m.env.id,reason:'until-read: read, consent to retain withdrawn'});
    else if(r==='ephemeral'&&m.env.policy.forgetAt&&m.env.policy.forgetAt<=now) dropped.push({id:m.env.id,reason:'ephemeral: forgetAt reached ('+m.env.policy.forgetAt+')'});
    else keep.push(m);
  });
  store.length=0;
  keep.forEach(function(m){ store.push(m); });
  return {dropped:dropped,kept:keep.length,law:FORGET_LAW};
}
/* bMeter-shaped receipts: events and references, never contents */
var RECEIPT_NEVER=['content','text','payload','plaintext'];
function receipt(event,ref,meta){
  var r={event:event,ref:ref,ts:Date.now()};
  if(meta&&typeof meta==='object'){
    Object.keys(meta).forEach(function(k){
      if(RECEIPT_NEVER.indexOf(k)<0) r[k]=meta[k];
    });
  }
  return r;
}

G.BCHAT={
  V:V,LANES:LANES,LANE_TRUST:LANE_TRUST,RETAIN:RETAIN,ATTACH_STATES:ATTACH_STATES,FORGET_LAW:FORGET_LAW,
  envelope:envelope,validate:validate,
  wireEncode:wireEncode,wireDecode:wireDecode,
  applyRetain:applyRetain,receipt:receipt
};
})();
