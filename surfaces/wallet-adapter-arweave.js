/* ─── LICENSE ──────────────────────────────────────────────────────────────
   SPDX-License-Identifier: Apache-2.0
   Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
   Licensed under the Apache License, Version 2.0 (the "License"); you
   may not use this file except in compliance with the License. You may
   obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
   See /LICENSE and /NOTICE in this repository. Applies to the rails:
   the wallet surface, the three rail adapters, the Arweave signer.
   ─────────────────────────────────────────────────────────────────────── */
// wallet-adapter-arweave.js — the Arweave rail adapter on SPEC-ADAPTER-CONTRACT-1.
// Browser carrier: one dedicated Web Worker, JSON-RPC 2.0 over postMessage.
// The adapter KNOWS THE RAIL AND HOLDS NO KEYS: buildPublish works from the
// JWK's PUBLIC modulus only ({kty,n,e}); the vault signs the sigData with the
// private JWK (RSA-PSS, saltLength 32 — arweave-js parity, live-proven); the
// shell owns the outbox, submits, confirms by reading the gateway back.
//
// The serialization primitives are the proven first-party set from
// surfaces/arweave.js (format-2 data tx, deepHash SHA-384, merkle notes) —
// vendored same-origin, proven working inside the worker (the stack law:
// present-but-inert does not count).
importScripts('arweave.js?v=2');
var A = globalThis.BNRAR;

var E = { RAIL_UNREACHABLE: -32001, BAD_PARAMS: -32007, SUBMIT_REFUSED: -32005, UNSUPPORTED: -32008, SERIALIZE: -32004 };

function b64(bytes) {
  var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBytes(b) {
  var s = atob(b), u = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
function hexOf(bytes) {
  var s = ''; for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
async function sha256Hex(bytes) {
  var d = await crypto.subtle.digest('SHA-256', bytes);
  return hexOf(new Uint8Array(d));
}

var METHODS = {
  describe: function () {
    return {
      rail: 'arweave',
      adapter_version: '1.0.0',
      contract_version: '1',
      capabilities: ['balance', 'buildPublish', 'submit', 'confirm', 'status'],
      networks: ['mainnet'],
      units: ['AR'],
      replay_safe: true   // a posted tx is idempotent by id; resubmitting identical bytes is the safe path
    };
  },
  balance: async function (p) {
    if (!p || !p.address || p.address.length !== 43) throw bad('balance needs {address} (43-char arweave address)');
    var winston = await A.balance(p.address);
    return { unit: 'AR', quantity: String(winston), winston: String(winston) };
  },
  /* THE INTENT (spec §3.3): unsigned_bytes is base64 of exactly what an
     Arweave key signs — the deepHash signature data; digest is its sha256
     (the vault re-derives and CHECKS it before signing). wire carries the
     unsigned transaction body the shell re-pairs with the signature. */
  buildPublish: async function (p) {
    p = p || {};
    if (!p.public_jwk || !p.public_jwk.n) throw bad('buildPublish needs {public_jwk:{kty,n,e}} — the JWK\'s PUBLIC parts only');
    if (typeof p.payload_b64 !== 'string' || !p.payload_b64) throw bad('buildPublish needs {payload_b64}');
    if (!Array.isArray(p.tags)) throw bad('buildPublish needs {tags:[[name,value],…]}');
    var bytes = b64ToBytes(p.payload_b64);
    var built = await A.buildUnsigned(p.public_jwk, bytes, p.tags.map(function (t) { return { name: t[0], value: t[1] } }));
    var digest = await sha256Hex(built.sigData);
    return {
      intent_id: 'arweave:' + digest.slice(0, 32),
      rail: 'arweave',
      network: 'mainnet',
      unsigned_bytes: b64(built.sigData),
      digest: digest,
      wire_json: JSON.stringify(built.wire),
      payload_size: bytes.length,
      expires_at: null,            // arweave anchors have no expiry semantics — the outbox may retry indefinitely
      human_summary: 'Arweave anchor — publish ' + bytes.length + ' B with ' + p.tags.length + ' tags (sha256-of-sigData ' + digest.slice(0, 12) + '…) to the permaweb'
    };
  },
  submit: async function (p) {
    p = p || {};
    if (!p.intent_id || !p.signed_bytes) throw bad('submit needs {intent_id, signed_bytes}');
    var s = JSON.parse(p.signed_bytes);          // {wire, signature, id}
    if (!s.wire || !s.signature || !s.id) throw bad('signed_bytes missing wire/signature/id');
    var body = JSON.parse(s.wire);
    body.signature = s.signature;
    body.id = s.id;
    var res = await A.postTx(body);
    if (res.ok) return { ref: s.id, accepted_at: new Date().toISOString(), block_hint: null, gateway_http: res.status };
    var err = new Error('gateway said ' + res.status + ': ' + String(res.text).slice(0, 160));
    err.code = E.SUBMIT_REFUSED;
    throw err;
  },
  /* confirm (spec §5): ONE rail read — GET /tx/{id} on a rotated gateway.
     confirmed only when the gateway says so; the evidence names the gateway. */
  confirm: async function (p) {
    if (!p || !p.ref) throw bad('confirm needs {ref}');
    var st = await A.txStatus(p.ref);
    if (st.tx === 'confirmed') {
      return { phase: 'confirmed', evidence: { read: 'GET /tx/' + p.ref.slice(0, 12) + '… @ ' + st.gateway, status: st.tx, confirmations: st.confirmations } };
    }
    if (st.tx === 'unknown' || st.tx === 'refused') {
      return { phase: 'submitted', evidence: { read: 'GET /tx/' + p.ref.slice(0, 12) + '… @ ' + st.gateway, status: 'not in the mempool (HTTP ' + st.status + ') — an unfunded key never enters the pool' } };
    }
    return { phase: 'submitted', evidence: { read: 'GET /tx/' + p.ref.slice(0, 12) + '… @ ' + (st.gateway || 'no gateway'), status: st.tx || 'pending' } };
  },
  status: null   // alias set below
};
METHODS.status = METHODS.confirm;

function bad(msg) { var e = new Error(msg); e.code = E.BAD_PARAMS; return e }

self.onmessage = async function (ev) {
  var m = ev.data;
  if (!m || m.jsonrpc !== '2.0' || typeof m.id !== 'number') return;
  var fn = METHODS[m.method];
  if (!fn) {
    postMessage({ jsonrpc: '2.0', id: m.id, error: { code: E.UNSUPPORTED, message: 'method not on this adapter: ' + m.method } });
    return;
  }
  try {
    var result = await fn(m.params || {});
    postMessage({ jsonrpc: '2.0', id: m.id, result: result });
  } catch (e) {
    postMessage({ jsonrpc: '2.0', id: m.id, error: { code: (e && e.code) || -32000, message: (e && e.message) || String(e) } });
  }
};
