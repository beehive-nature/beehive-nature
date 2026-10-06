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
//
// ONE READER for every Vaulta send: the wallet's own key (the outbox) and the
// one paste (wallet.html brWitness) both read a sent transaction here, so the
// rule for "it went in" and "it can never land" lives in one place.
importScripts('onboarding/vendor/bnr-sign.js?v=6');   // worker-relative: /surfaces/onboarding/…
var BN = globalThis.BnrSign;

var MAIN_HOSTS = ['https://eos.api.eosnation.io', 'https://eos.greymass.com'];
var J4 = {
  hosts: ['https://jungle4.cryptolions.io', 'https://jungle4.eosphere.io', 'https://jungle4.api.eosnation.io'],
  chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d' // PUBLIC-CONSTANT: Jungle4 chain id (live get_info)
};
var MAIN_CHAIN_ID = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'; // PUBLIC-CONSTANT: Vaulta mainnet chain id
var RPC_TIMEOUT = 9000;
var READ_TIMEOUT = 6000;
var DUP_GRACE = 1500;   // a "duplicate" acks at once; a transaction id from another host is waited for this long
/* Hyperion history, read by transaction id only when no node that follows every block since the signing
   can say. It may only ever show that a block holds a transaction, never that none does: its index can
   have gaps. No Hyperion is known for Jungle4 */
var HYPERION = { mainnet: ['https://eos.hyperion.eosrio.io', 'https://eos.eosusa.io'], jungle4: [] };

/* RPC account rows still use the historical EOS symbol on Vaulta. Keep the
   numeric text exactly as returned; only the display unit belongs to this UI. */
var A_TOKEN = 'core.vaulta';   // the A token contract on Vaulta (mainnet and Jungle4)
function displayA(raw) {
  if(typeof raw!=='string'||!/^\d+\.\d{4} (EOS|A)$/.test(raw))throw new Error('Vaulta returned no valid liquid balance');
  return raw.replace(/ EOS$/, ' A');
}

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
        if (d.error.name && msg.indexOf(d.error.name) < 0) msg += ' [' + d.error.name + ']';
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

/* one POST to one host: its answer (ok, status, parsed body), or the fact that the answer was lost */
async function hostPost(h, path, json, ms) {
  var ctl = new AbortController();
  var to = setTimeout(function () { ctl.abort() }, ms || RPC_TIMEOUT);
  try {
    var res = await fetch(h + path, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: json });
    var d = null; try { d = await res.json() } catch (e) {}
    return { h: h, ok: res.ok, status: res.status, d: d };
  } catch (e) { return { h: h, lost: true, why: (e && e.message) || String(e) } }
  finally { clearTimeout(to) }
}
/* a node's refusal in its own words (the same words railPost has always surfaced) */
function errText(d) {
  if (!d || !d.error) return '';
  var msg = (d.error.details && d.error.details[0] && d.error.details[0].message) || d.error.what || 'rail refused';
  if (d.error.name && msg.indexOf(d.error.name) < 0) msg += ' [' + d.error.name + ']';
  return msg;
}
function isDuplicate(t) { return /duplicate transaction|tx_duplicate|already in the mempool|already known|already processed/i.test(String(t || '')) }
/* the one refusal that holds on every node whatever it has seen: the signature itself */
function authorityNo(t) { return /missing authority|unsatisfied|irrelevant|declares authority/i.test(String(t || '')) }
function hostName(h) { return String(h).replace(/^https?:\/\//, '') }
function chainMs(t) { t = String(t || ''); var v = Date.parse(/Z$/.test(t) ? t : t + 'Z'); return isFinite(v) ? v : NaN }
function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i }) }

/* the signed bytes go to every host at once. They are the same bytes, so a second answer is the same
   transaction: the first host that takes them answers for the send, and a "duplicate" from another
   host means it holds them too. A refusal answers only when no host took them; a host whose answer was
   lost may still hold the bytes, so then only a refusal of the signature itself is a clean "no" */
function sendAll(net, body) {
  var json = JSON.stringify(body), s = { res: null, acked: [], dup: null, refused: [], lost: [] };
  var each = hostsFor(net).map(function (h) {
    return hostPost(h, '/v1/chain/send_transaction', json, RPC_TIMEOUT).then(function (x) {
      var d = x.d, why = errText(d);
      if (x.ok && d && d.transaction_id) { s.acked.push(h); if (!s.res) s.res = d }
      else if (d && !x.ok && isDuplicate(why)) { s.acked.push(h); if (!s.dup) s.dup = why }
      else if (d && !x.ok && why) s.refused.push(why);
      else s.lost.push(hostName(h) + (x.lost ? ' (' + x.why + ')' : ' said ' + x.status));
    });
  });
  return new Promise(function (done) {
    var t = null;
    each.forEach(function (q) { q.then(function () {
      if (s.res) done(s);
      else if (s.acked.length && !t) t = setTimeout(function () { done(s) }, DUP_GRACE);
    }) });
    Promise.all(each).then(function () { if (t) clearTimeout(t); done(s) });
  });
}

/* an Antelope transaction id is the sha256 of its packed bytes; the signed expiration is their first
   four bytes (seconds, little endian), so what the reader holds a send to is what was signed */
function txIdOf(hx) { return hexOf(BN.sha256(hexToBytes(hx))) }
function signedTerms(sb) {
  var w = sb;
  if (typeof sb === 'string') { try { w = JSON.parse(sb) } catch (e) { return null } }
  var hx = w && w.packed_hex;
  if (typeof hx !== 'string' || !/^([0-9a-f]{2}){10,}$/i.test(hx)) return null;
  var b = hexToBytes(hx.slice(0, 8)), sec = (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
  return { id: txIdOf(hx), expStr: new Date(sec * 1000).toISOString().slice(0, 19) };
}

/* a host is read for a transaction only once its own get_info names this network's chain */
var CHAIN_OK = {};
async function hostOnChain(net, h) {
  var k = net + ' ' + h;
  if (CHAIN_OK[k]) return true;
  var x = await hostPost(h, '/v1/chain/get_info', '{}', READ_TIMEOUT);
  if (x.ok && x.d && x.d.chain_id === chainIdFor(net)) { CHAIN_OK[k] = true; return true }
  return false;
}
/* the transaction's own status on one host (get_transaction_status follows every block for about an hour) */
async function statusAt(net, h, id) {
  var both = await Promise.all([hostPost(h, '/v1/chain/get_transaction_status', JSON.stringify({ id: id }), READ_TIMEOUT), hostOnChain(net, h)]);
  var x = both[0];
  return both[1] && x.ok && x.d && typeof x.d.state === 'string' ? x.d : null;
}
async function hyperionTx(net, id) {
  var hs = HYPERION[net] || [];
  for (var i = 0; i < hs.length; i++) {
    var ctl = new AbortController(), to = setTimeout(ctl.abort.bind(ctl), READ_TIMEOUT);
    try {
      var r = await fetch(hs[i] + '/v2/history/get_transaction?id=' + encodeURIComponent(id), { signal: ctl.signal });
      var d = await r.json();
      if (r.ok && d && typeof d.executed === 'boolean') return { h: hs[i], d: d };
    } catch (e) {} finally { clearTimeout(to) }
  }
  return null;
}
/* the latest final block a status reply named, else the chain's own get_info: its number and time */
function finalOf(said) {
  var best = null;
  said.forEach(function (x) {
    var t = x.d.irreversible_timestamp;
    if (isFinite(chainMs(t)) && (!best || chainMs(t) > chainMs(best.time))) best = { time: t, block: x.d.irreversible_number };
  });
  return best;
}
async function finalInfo(net) {
  var info = null;
  try { info = await guardedInfo(net) } catch (e) { return null }
  var t = info && info.last_irreversible_block_time;
  return isFinite(chainMs(t)) ? { time: t, block: info.last_irreversible_block_num } : null;
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
    head: info.head_block_num,                    // the head it was built at: no block before it can hold it
    human_summary: summaryWords
  };
}

function hexToBytes(h) {
  var o = new Uint8Array(h.length >> 1);
  for (var i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16);
  return o;
}

/* confirm/status (spec §5): where a sent transaction is, read from the chain itself. Every host is
   asked for the transaction's own status, and a host counts only once its get_info names this chain:
   - a block holds it on any host: confirmed, with its block;
   - a host that has followed every block since the head at signing (earliest_tracked_block_number at or
     below it) has made final a block whose time is past the signed expiration, and no host holds it in a
     block: it can never land (failed when a host says FAILED, expired otherwise). That is the only "never";
   - such a host answers without that proof yet: it may still land, so wait.
   When no host that follows blocks from the signing can say (none answered, or the hour each host
   remembers no longer reaches back to it), the witnesses that can only say "in" are read: Hyperion by
   transaction id, then the block the node named at submit. Hosts that answered but no longer reach back,
   with a final block past the expiration: this wallet can no longer tell from the chain ("lost": maybe
   in, nothing given back). Silence is never a verdict. The final block found is returned with every
   answer that is not settled, so the one paste can read its account after it (wallet.html brWitness) */
async function readBack(net, p) {
  p = p || {};
  var terms = signedTerms(p.signed_bytes), ref = p.ref || (terms && terms.id);
  if (!ref) { var e = new Error('status needs a ref (transaction id) or the signed bytes'); e.code = E.BAD_PARAMS; throw e }
  var expStr = terms ? terms.expStr : (typeof p.expiration === 'string' && p.expiration ? p.expiration.replace(/Z$/, '').slice(0, 19) : null);
  var expT = expStr ? chainMs(expStr) : NaN, until = expStr ? ' · valid until ' + expStr + 'Z' : '';
  var head = typeof p.head === 'number' && p.head > 0 ? p.head : null;
  var acked = Array.isArray(p.acked_by) && p.acked_by.length ? ' · acked by ' + p.acked_by.map(hostName).join(', ') : '';
  var reads = await Promise.all(hostsFor(net).map(function (h) { return statusAt(net, h, ref).then(function (d) { return { h: h, d: d } }) }));
  var said = reads.filter(function (x) { return x.d });
  var all = said.map(function (x) { return hostName(x.h) + ' ' + x.d.state }).join(', ');
  var inb = said.filter(function (x) { return x.d.state === 'IN_BLOCK' || x.d.state === 'IRREVERSIBLE' })[0];
  if (inb) return { phase: 'confirmed', evidence: { read: 'get_transaction_status at ' + hostName(inb.h) + ': ' + inb.d.state + ' in block #' + inb.d.block_number + acked,
    via: 'status', k: 'in', block_num: inb.d.block_number, block_id: inb.d.block_id || null, state: inb.d.state } };
  var cover = head === null ? [] : said.filter(function (x) { return typeof x.d.earliest_tracked_block_number === 'number' && x.d.earliest_tracked_block_number <= head });
  var past = isFinite(expT) ? cover.filter(function (x) { return chainMs(x.d.irreversible_timestamp) > expT })[0] : null;
  if (past) {
    var failed = said.some(function (x) { return x.d.state === 'FAILED' });
    var why = 'final block ' + past.d.irreversible_number + ' at ' + past.d.irreversible_timestamp + ' (' + hostName(past.h) + ', following every block since ' + past.d.earliest_tracked_block_number +
      ', signed at head ' + head + ') is past its expiration ' + expStr + ', and no block holds it';
    return { phase: failed ? 'failed' : 'expired', evidence: { read: 'get_transaction_status: ' + all + ' · ' + why + acked, via: 'status', k: failed ? 'failed' : 'never',
      definite: true, maybe_in: false, state: failed ? 'FAILED' : 'never in a block', detail: 'expired: ' + why, final_time: past.d.irreversible_timestamp, final_block: past.d.irreversible_number } };
  }
  if (cover.length) return { phase: 'submitted', evidence: { read: 'get_transaction_status: ' + all + until + acked, via: 'status', k: 'wait', covered: true } };
  /* no host that follows every block since the signing could say: the witnesses that can only say "in" */
  var hy = await hyperionTx(net, ref), hyN = hy && hy.d.executed && hy.d.actions && hy.d.actions[0] && hy.d.actions[0].block_num;
  if (hy && hy.d.executed) return { phase: 'confirmed', evidence: { read: 'Hyperion at ' + hostName(hy.h) + ': executed' + (hyN ? ' in block #' + hyN : '') +
    (said.length ? ' (get_transaction_status: ' + all + ', following no block from the signing)' : ' (get_transaction_status did not answer)') + acked, via: 'hyperion', k: 'in', block_num: hyN || null } };
  var blk = typeof p.block_hint === 'number' && p.block_hint > 0 ? await blockRead(net, ref, p.block_hint) : null;
  if (blk && blk.phase !== 'submitted') return blk;
  var fin = finalOf(said) || await finalInfo(net);
  var notes = (said.length ? 'get_transaction_status: ' + all + (head === null ? ' (the head at signing is not known)' : '; none follows every block since the head at signing ' + head) : 'get_transaction_status did not answer') +
    (hy ? ' · Hyperion at ' + hostName(hy.h) + ': not executed, indexed to ' + hy.d.last_indexed_block + ' (an index can have gaps, so this is never a "no")' : '') +
    (blk ? ' · ' + blk.evidence.read : '') + (fin ? ' · final block ' + fin.block + ' at ' + fin.time : '');
  var fins = { final_time: fin ? fin.time : null, final_block: fin ? fin.block : null };
  if (said.length && fin && isFinite(expT) && chainMs(fin.time) > expT)   /* the hosts no longer reach back to the signing, and it can no longer land: no chain read can tell now */
    return { phase: 'expired', evidence: Object.assign({ read: 'get_transaction_status lapsed: ' + notes + ', past its expiration ' + expStr + acked, via: 'status', k: 'lost', maybe_in: true, definite: false, lapsed: true }, fins) };
  if (said.length || hy || blk) return { phase: 'submitted', evidence: Object.assign({ read: notes + until + acked, via: said.length ? 'status' : hy ? 'hyperion' : 'block', k: 'wait', covered: false }, fins) };
  return { phase: 'submitted', evidence: Object.assign({ read: 'no host answered get_transaction_status, Hyperion did not answer' + (p.block_hint ? ', and block #' + p.block_hint + ' could not be read' : ', and no block was named to read') + until + acked, via: 'none', k: 'none' }, fins) };
}
/* the block the node named at submit (processed.block_num, its speculative head): a block that holds it
   says in (or failed, with the chain's own status); a block without it proves nothing, the transaction
   may sit in any later one. null when no node answered */
async function blockRead(net, ref, blockHint) {
  try {
    var info = await guardedInfo(net);
    if (info.head_block_num < blockHint) return { phase: 'submitted', evidence: { read: 'get_info @ head ' + info.head_block_num + ': block #' + blockHint + ' not reached yet', via: 'block', k: 'wait' } };
    var block = await railPost(net, '/v1/chain/get_block', { block_num_or_id: blockHint });
    var txs = (block && block.transactions) || [];
    for (var i = 0; i < txs.length; i++) {
      var t = txs[i];
      var id = t.id || (t.trx && t.trx.id);
      if (id === ref) {
        var status = t.status || (t.trx && t.trx.receipt && t.trx.receipt.status) || 'executed';
        if (status === 'executed') {
          return { phase: 'confirmed', evidence: { read: 'get_block #' + blockHint + ' on ' + net, via: 'block', k: 'in', block_id: block.id, block_num: blockHint, status: status, irreversible_behind: info.head_block_num - blockHint } };
        }
        return { phase: 'failed', evidence: { read: 'get_block #' + blockHint + ' on ' + net, via: 'block', k: 'failed', block_id: block.id, status: status } };
      }
    }
    return { phase: 'submitted', evidence: { read: 'get_block #' + blockHint + ': ' + txs.length + ' txs scanned, id not present', via: 'block', k: 'wait', block_id: block && block.id } };
  } catch (e) {
    if (e && e.code === E.CHAIN_GUARD) throw e;
    return null;
  }
}

/* ── the JSON-RPC 2.0 server (spec §3) ─────────────────────────────── */
var METHODS = {
  describe: function () {
    return {
      rail: 'vaulta',
      adapter_version: '1.1.0',
      contract_version: '1',
      capabilities: ['balance', 'status', 'buildSend', 'buildAction', 'submit', 'confirm'],
      networks: ['mainnet', 'jungle4'],
      units: ['A'],
      replay_safe: true   // §6: the chain rejects duplicate signed bytes; resubmit is the safe path
    };
  },
  balance: async function (p) {
    if (!p || !p.address) throw bad('balance needs {address}');
    var net = p.network === 'jungle4' ? 'jungle4' : 'mainnet';
    var d = await railPost(net, '/v1/chain/get_account', { account_name: p.address });
    if (!d || d.error) { var e = new Error('account ' + p.address + ' unreadable'); e.code = E.NOT_FOUND; throw e }
    // A is the token of core.vaulta. get_account's core_liquid_balance is EOS
    // (eosio.token), a different token that swaps 1:1 into A but is not A until it does
    var a = await railPost(net, '/v1/chain/get_currency_balance', { code: A_TOKEN, account: p.address, symbol: 'A' });
    if (!Array.isArray(a)) { var e2 = new Error('A balance of ' + p.address + ' unreadable'); e2.code = E.RAIL_UNREACHABLE; throw e2 }
    return { unit: 'A', quantity: a.length ? displayA(a[0]) : '0.0000 A' };
  },
  buildSend: async function (p) {
    p = p || {};
    if (!p.from || !p.to || !p.quantity) throw bad('buildSend needs {from,to,quantity}');
    var actz = [{ actor: p.from, permission: p.auth || 'active' }];
    var data = { from: p.from, to: p.to, quantity: p.quantity, memo: p.memo || '' };
    // A moves through core.vaulta; EOS (the old core coin) through eosio.token
    return buildIntent(netOf(p), / A$/.test(String(p.quantity)) ? A_TOKEN : 'eosio.token', 'transfer', data, actz,
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
    /* the identical signed bytes go to every host at once: the first that takes them answers, a
       "duplicate" from another is the same transaction held there, and a refusal answers only when no
       host took them (spec §6: resubmitting identical bytes is safe; nothing here re-signs) */
    var s = await sendAll(net, { signatures: wire.signatures, compression: 0, packed_context_free_data: '', packed_trx: wire.packed_hex });
    if (s.acked.length) {
      var res = s.res;
      return {
        ref: (res && res.transaction_id) || txIdOf(wire.packed_hex),
        accepted_at: new Date().toISOString(),
        block_hint: (res && res.processed && res.processed.block_num) || null,
        acked_by: s.acked.map(hostName),
        duplicate: !res,                            // every host that answered already held these exact bytes
        detail: res ? null : s.dup
      };
    }
    var refusal = uniq(s.refused).join(' | ');
    if (s.refused.length && (!s.lost.length || s.refused.some(authorityNo))) { var e = new Error(refusal); e.code = E.SUBMIT_REFUSED; throw e }
    var u = new Error('no ' + net + ' host took it' + (s.lost.length ? ' (no answer from ' + s.lost.join(', ') + ')' : '') + (refusal ? '; refused elsewhere: ' + refusal : ''));
    u.code = E.RAIL_UNREACHABLE; throw u;
  },
  confirm: async function (p) { return readBack(netOf(p), p) },
  status: async function (p) { return readBack(netOf(p), p) }
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
