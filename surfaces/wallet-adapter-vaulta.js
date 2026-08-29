/* ─── LICENSE ──────────────────────────────────────────────────────────────
   SPDX-License-Identifier: Apache-2.0
   Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
   Licensed under the Apache License, Version 2.0 (the "License"); you
   may not use this file except in compliance with the License. You may
   obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
   See /LICENSE and /NOTICE in this repository. Applies to the rails:
   the wallet surface, the rail adapters, the Arweave signer.
   ─────────────────────────────────────────────────────────────────────── */
// wallet-adapter-vaulta.js — the Vaulta rail adapter on SPEC-ADAPTER-CONTRACT-1.
// Browser carrier per spec §2: one dedicated Web Worker (this file), JSON-RPC 2.0
// over postMessage, fault containment by terminate+respawn (the shell's job).
//
// THE ADAPTER KNOWS THE RAIL AND HOLDS NO KEYS (spec §4): write methods BUILD
// intent — unsigned bytes + digest + human summary — and nothing here ever
// receives, derives, or transmits private key material. The vault signs the
// digest; the shell persists, submits, confirms.
//
// Receipt law (spec §5): submit only reports the rail ACCEPTED bytes. Terminal
// state comes from confirm/status, which reads the block back and names what
// it read. Replay safety (spec §6): a signed Antelope tx has a fixed id and an
// expiration; the chain rejects the duplicate — resubmitting identical stored
// bytes is safe by construction, re-signing is the only unsafe path.
importScripts('onboarding/vendor/bnr-sign.js?v=6');   // worker-relative: /surfaces/onboarding/…
var BN = globalThis.BnrSign;

var MAIN_HOSTS = ['https://eos.api.eosnation.io', 'https://eos.greymass.com', 'https://api.eosn.io'];
var J4 = {
  hosts: ['https://jungle4.cryptolions.io', 'https://jungle4.eosphere.io', 'https://jungle4.api.eosnation.io'],
  chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d' // PUBLIC-CONSTANT: Jungle4 chain id (live get_info)
};
var MAIN_CHAIN_ID = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'; // PUBLIC-CONSTANT: Vaulta mainnet chain id
var RPC_TIMEOUT = 9000;

// estate error codes (spec §6: a coded error object, never a bare string,
// never partial success)
var E = {
  RAIL_UNREACHABLE: -32001, CHAIN_GUARD: -32002, ABI_MISSING: -32003,
  SERIALIZE: -32004, SUBMIT_REFUSED: -32005, NOT_FOUND: -32006,
  BAD_PARAMS: -32007, UNSUPPORTED: -32008
};

function hostsFor(net) { return net === 'jungle4' ? J4.hosts : MAIN_HOSTS }
function chainIdFor(net) { return net === 'jungle4' ? J4.chainId : MAIN_CHAIN_ID }

/* rotated rail read: Fisher-Yates, walk on failure, 2xx JSON or throw */
async function railPost(net, path, body) {
  var hs = hostsFor(net).slice();
  for (var j = hs.length - 1; j > 0; j--) {
    var r = Math.floor(Math.random() * (j + 1)); var t = hs[j]; hs[j] = hs[r]; hs[r] = t;
  }
  var lastErr = null;
  for (var i = 0; i < hs.length; i++) {
    var ctl = new AbortController();
    var to = setTimeout(function () { ctl.abort() }, RPC_TIMEOUT);
    try {
      var res = await fetch(hs[i] + path, { method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) return await res.json();
      // an HTTP answer with a parseable error body is the RAIL SAYING NO — a
      // verdict, not a network fault: surface it, never walk around it
      var d = null; try { d = await res.json() } catch (e) {}
      if (d && d.error) {
        var msg = (d.error.details && d.error.details[0] && d.error.details[0].message) || d.error.what || 'rail refused';
        var err = new Error(msg); err.code = E.SUBMIT_REFUSED; throw err;
      }
      lastErr = new Error('host ' + hs[i] + ' said ' + res.status);
    } catch (e) {
      if (e && e.code) throw e;
      lastErr = e;
    } finally { clearTimeout(to) }
  }
  var unreachable = new Error('all ' + (net || 'mainnet') + ' hosts unreachable (' + ((lastErr && lastErr.message) || 'no answer') + ')');
  unreachable.code = E.RAIL_UNREACHABLE;
  throw unreachable;
}

/* the chain-id HARD guard: a node answering with the wrong chain is refused,
   before anything is built or pushed (earned live: it caught a 65-hex typo) */
async function guardedInfo(net) {
  var info = await railPost(net, '/v1/chain/get_info', {});
  if (!info || !info.chain_id) { var e = new Error('no chain id in get_info'); e.code = E.CHAIN_GUARD; throw e }
  if (info.chain_id !== chainIdFor(net)) {
    var g = new Error('chain-id guard: endpoint is not ' + net + ' (' + info.chain_id.slice(0, 10) + '…) — REFUSED');
    g.code = E.CHAIN_GUARD; throw g;
  }
  return info;
}

async function getAbi(net, contract) {
  var r = await railPost(net, '/v1/chain/get_abi', { account_name: contract });
  if (!r || !r.abi) { var e = new Error('no ABI on ' + contract + ' (network ' + net + ')'); e.code = E.ABI_MISSING; throw e }
  return r.abi;
}

/* ABI-driven action serialization — the vendored eosjs lane owns the packing */
function serializeActionHex(abi, contract, action, actz, data) {
  var types = BN.Serialize.getTypesFromAbi(BN.Serialize.createInitialTypes(), abi);
  var amap = new Map();
  for (var i = 0; i < abi.actions.length; i++) amap.set(abi.actions[i].name, BN.Serialize.getType(types, abi.actions[i].type));
  if (!amap.get(action)) {
    var e = new Error('action ' + action + ' not in ' + contract + ' ABI (has: ' + abi.actions.map(function (a) { return a.name }).slice(0, 10).join(', ') + ')');
    e.code = E.SERIALIZE; throw e;
  }
  var sa = BN.Serialize.serializeAction({ types: types, actions: amap }, contract, action, actz, data,
    new TextEncoder(), new TextDecoder());
  return hexToBytes(sa.data);
}

/* envelope packing — the vendored eosjs Api's own serializer (byte-identical
   to the first-party Rust core, proven in the shell's lanes). The dummy rpc
   is never touched: serializeTransaction is pure. */
var PACK_API = null;
function packTransaction(txJson) {
  if (!PACK_API) PACK_API = new BN.Api({ rpc: {}, textEncoder: new TextEncoder(), textDecoder: new TextDecoder() });
  var out = PACK_API.serializeTransaction(txJson);
  if (typeof out === 'string') return hexToBytes(out);       // hex form
  return new Uint8Array(out);                                 // byte form (this bundle's shape, live-proven)
}

function b64(bytes) {
  var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function hexOf(bytes) {
  var s = ''; for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

/* THE INTENT (spec §3.3): unsigned_bytes is base64 of exactly what a Vaulta
   key signs — chain_id || packed_trx || 32 zero bytes (the empty cfa hash) —
   so digest = sha256(unsigned_bytes) IS the chain digest. */
async function buildIntent(net, contract, action, data, actz, summaryWords) {
  var abi = await getAbi(net, contract);
  var actionBytes = serializeActionHex(abi, contract, action, actz, data);
  var info = await guardedInfo(net);
  var ref = await railPost(net, '/v1/chain/get_block', { block_num_or_id: info.head_block_num - 3 });
  if (!ref || ref.ref_block_prefix === undefined) { var e = new Error('no ref block from rail'); e.code = E.RAIL_UNREACHABLE; throw e }
  var expSec = Math.floor(Date.now() / 1000) + 120;
  var txJson = {
    expiration: new Date(expSec * 1000).toISOString().slice(0, 19),
    ref_block_num: (info.head_block_num - 3) & 0xffff,
    ref_block_prefix: ref.ref_block_prefix,
    max_net_usage_words: 0, max_cpu_usage_ms: 0, delay_sec: 0,
    context_free_actions: [],
    actions: [{ account: contract, name: action, authorization: actz, data: hexOf(actionBytes) }],
    transaction_extensions: []
  };
  var packed = packTransaction(txJson);
  var chainId = hexToBytes(chainIdFor(net));
  var signingPayload = new Uint8Array(32 + packed.length + 32);
  signingPayload.set(chainId, 0);
  signingPayload.set(packed, 32);   // cfa hash stays zero — no context-free actions, ever, here
  var digestBytes = BN.sha256(signingPayload);
  var digest = hexOf(digestBytes);
  return {
    intent_id: 'vaulta:' + digest.slice(0, 32),   // deterministic: same built bytes = same id
    rail: 'vaulta',
    network: net,
    unsigned_bytes: b64(signingPayload),
    digest: digest,
    packed_hex: hexOf(packed),                    // the wire body the shell re-pairs with signatures
    expires_at: new Date(expSec * 1000).toISOString(),
    human_summary: summaryWords
  };
}

function hexToBytes(h) {
  var o = new Uint8Array(h.length >> 1);
  for (var i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16);
  return o;
}

/* confirm/status (spec §5): ONE rail read, plugin-free — the block itself.
   submit's block_hint says where the rail said it landed; we wait for the
   head to reach it, fetch the block, and scan for the transaction id. */
async function readBack(net, ref, blockHint) {
  if (!ref) { var e = new Error('status needs a ref (transaction id)'); e.code = E.BAD_PARAMS; throw e }
  var info = await guardedInfo(net);
  if (typeof blockHint !== 'number' || !blockHint) {
    return { phase: 'submitted', evidence: { read: 'get_info @ head ' + info.head_block_num, note: 'no block hint from submit — cannot scan without it' } };
  }
  if (info.head_block_num < blockHint) {
    return { phase: 'submitted', evidence: { read: 'get_info @ head ' + info.head_block_num, note: 'block ' + blockHint + ' not reached yet' } };
  }
  var block = await railPost(net, '/v1/chain/get_block', { block_num_or_id: blockHint });
  var txs = (block && block.transactions) || [];
  for (var i = 0; i < txs.length; i++) {
    var t = txs[i];
    var id = t.id || (t.trx && t.trx.id);
    if (id === ref) {
      var status = t.status || (t.trx && t.trx.receipt && t.trx.receipt.status) || 'executed';
      if (status === 'executed') {
        return { phase: 'confirmed', evidence: { read: 'get_block #' + blockHint + ' on ' + net, block_id: block.id, block_num: blockHint, status: status, irreversible_behind: info.head_block_num - blockHint } };
      }
      return { phase: 'failed', evidence: { read: 'get_block #' + blockHint + ' on ' + net, block_id: block.id, status: status } };
    }
  }
  return { phase: 'submitted', evidence: { read: 'get_block #' + blockHint + ' — ' + txs.length + ' txs scanned, id not present', block_id: block.id } };
}

/* ── the JSON-RPC 2.0 server (spec §3) ─────────────────────────────── */
var METHODS = {
  describe: function () {
    return {
      rail: 'vaulta',
      adapter_version: '1.0.0',
      contract_version: '1',
      capabilities: ['balance', 'status', 'buildSend', 'buildAction', 'submit', 'confirm'],
      networks: ['mainnet', 'jungle4'],
      units: ['A'],
      replay_safe: true   // §6: the chain rejects duplicate signed bytes; resubmit is the safe path
    };
  },
  balance: async function (p) {
    if (!p || !p.address) throw bad('balance needs {address}');
    var d = await railPost(p.network === 'jungle4' ? 'jungle4' : 'mainnet', '/v1/chain/get_account', { account_name: p.address });
    if (!d || d.error) { var e = new Error('account ' + p.address + ' unreadable'); e.code = E.NOT_FOUND; throw e }
    return { unit: 'A', quantity: d.core_liquid_balance || '0.0000 A' };
  },
  buildSend: async function (p) {
    p = p || {};
    if (!p.from || !p.to || !p.quantity) throw bad('buildSend needs {from,to,quantity}');
    var actz = [{ actor: p.from, permission: p.auth || 'active' }];
    var data = { from: p.from, to: p.to, quantity: p.quantity, memo: p.memo || '' };
    return buildIntent(netOf(p), 'eosio.token', 'transfer', data, actz,
      'Vaulta transfer ' + p.quantity + ' from ' + p.from + ' to ' + p.to + (p.memo ? ' — memo "' + p.memo + '"' : '') + ' on ' + netOf(p));
  },
  buildAction: async function (p) {
    p = p || {};
    if (!p.account || !p.action || !p.data) throw bad('buildAction needs {account,action,data}');
    var auth = p.auth || [{ actor: guessActor(p.data), permission: 'active' }];
    if (!auth[0] || !auth[0].actor) throw bad('buildAction: no actor — pass auth or a recognizable actor field');
    return buildIntent(netOf(p), p.account, p.action, p.data, auth,
      'Vaulta action ' + p.account + '::' + p.action + ' by ' + auth[0].actor + '@' + (auth[0].permission || 'active') +
      ' — ' + JSON.stringify(p.data) + ' on ' + netOf(p));
  },
  submit: async function (p) {
    p = p || {};
    if (!p.intent_id || !p.signed_bytes) throw bad('submit needs {intent_id, signed_bytes}');
    var wire = JSON.parse(p.signed_bytes);   // {network, packed_hex, signatures, block_hint-less}
    var net = netOf(wire);
    if (!wire.packed_hex || !wire.signatures || !wire.signatures.length) throw bad('signed_bytes missing packing or signatures');
    var res = await railPost(net, '/v1/chain/send_transaction', {
      signatures: wire.signatures, compression: 0, packed_context_free_data: '', packed_trx: wire.packed_hex
    });
    if (!res || !res.transaction_id) {
      var e = new Error('rail accepted nothing: ' + JSON.stringify(res).slice(0, 200)); e.code = E.SUBMIT_REFUSED; throw e;
    }
    return {
      ref: res.transaction_id,
      accepted_at: new Date().toISOString(),
      block_hint: (res.processed && res.processed.block_num) || null
    };
  },
  confirm: async function (p) { return readBack(netOf(p), p && p.ref, p && p.block_hint) },
  status: async function (p) { return readBack(netOf(p), p && p.ref, p && p.block_hint) }
};

function netOf(p) { return (p && p.network) === 'jungle4' ? 'jungle4' : 'mainnet' }
function bad(msg) { var e = new Error(msg); e.code = E.BAD_PARAMS; return e }
function guessActor(data) {
  return (data && (data.registrant || data.owner || data.from || data.account || data.committer || data.voter)) || null;
}

self.onmessage = async function (ev) {
  var m = ev.data;
  if (!m || m.jsonrpc !== '2.0' || typeof m.id !== 'number') return;   // not a contract message
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
