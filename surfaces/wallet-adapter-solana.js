/* ─── LICENSE ──────────────────────────────────────────────────────────────
   SPDX-License-Identifier: Apache-2.0
   Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
   Licensed under the Apache License, Version 2.0 (the "License"); you
   may not use this file except in compliance with the License. You may
   obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
   See /LICENSE and /NOTICE in this repository. Applies to the rails:
   the wallet surface, the rail adapters, the Arweave signer.
   ─────────────────────────────────────────────────────────────────────── */
// wallet-adapter-solana.js — the Solana rail adapter on SPEC-ADAPTER-CONTRACT-1.
//
// WHERE THIS RAIL GETS ITS AUTHORITY, stated because §7 makes it a question:
// SPEC-ADAPTER-CONTRACT-1 §7 calls `Rail` a CLOSED enum whose members are added
// "by ruling, not by a caller passing a free string" — but the spec never
// writes the membership list down anywhere. So there is no list this file
// contradicts; there is also no list it may quietly join. It enters by the
// founder's scope instruction of 2026-08-29 ("stub Solana + BTC behind the
// adapter interface"), which is also SPEC-bSMARTWALLET-1 §5 GAP 5 — named
// there as un-specced and a founder scope-call. That gap is NOT closed by this
// file; this is the stub the instruction asked for, and it says so.
//
// READ-ONLY BY CONSTRUCTION. `balance` is real. Every write capability is
// ABSENT from describe() and refused by name — §9.2 says an undeclared
// capability must be unreachable, not merely erroring, so the shell never sees
// a buildSend here to call in the first place.
//
// SERVICE, not PROTOCOL: the public Solana RPC is rate-limited and degrades.
// That is declared in describe().networks_note and surfaced as RAIL_UNREACHABLE
// rather than dressed up as a zero balance — a wrong number is worse than none.

var HOSTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com'
];
var RPC_TIMEOUT = 9000;
var LAMPORTS_DECIMALS = 9;   // PUBLIC-CONSTANT: 1 SOL = 1e9 lamports (protocol fact)

var E = {
  RAIL_UNREACHABLE: -32001, NOT_FOUND: -32006,
  BAD_PARAMS: -32007, UNSUPPORTED: -32008
};

/* base58 check — a Solana address is base58 of a 32-byte ed25519 key, so it is
   32..44 chars over the Bitcoin alphabet. Validating BEFORE the network call
   keeps a typo from being reported as "rail unreachable". */
var B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function solCall(method, params) {
  var hs = HOSTS.slice();
  for (var j = hs.length - 1; j > 0; j--) {
    var r = Math.floor(Math.random() * (j + 1)); var t = hs[j]; hs[j] = hs[r]; hs[r] = t;
  }
  var lastErr = null;
  for (var i = 0; i < hs.length; i++) {
    var ctl = new AbortController();
    var to = setTimeout(function () { ctl.abort() }, RPC_TIMEOUT);
    try {
      var res = await fetch(hs[i], { method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }) });
      if (res.ok) {
        var d = await res.json();
        if (d && d.result !== undefined) return d.result;
        if (d && d.error) { lastErr = new Error(d.error.message || 'solana refused'); continue }
      }
      lastErr = new Error('host ' + hs[i] + ' said ' + res.status);
    } catch (e) { lastErr = e }
    finally { clearTimeout(to) }
  }
  var err = new Error('all Solana hosts unreachable (' + ((lastErr && lastErr.message) || 'no answer') + ')');
  err.code = E.RAIL_UNREACHABLE;
  throw err;
}

/* exact base-unit -> display, no float (lamports are integers and stay so) */
function fromLamports(units) {
  var v = BigInt(units);
  var s = v.toString().padStart(LAMPORTS_DECIMALS + 1, '0');
  var whole = s.slice(0, s.length - LAMPORTS_DECIMALS);
  var frac = s.slice(s.length - LAMPORTS_DECIMALS).replace(/0+$/, '');
  return whole + (frac ? '.' + frac : '');
}

var METHODS = {
  describe: function () {
    return {
      rail: 'solana',
      adapter_version: '0.1.0',
      contract_version: '1',
      /* READ ONLY. buildSend is deliberately absent — SPEC-bSMARTWALLET-1 §5
         GAP 1 (is there an on-chain spend-permission analogue strong enough
         for R3's ceiling?) is UNVERIFIED, and a send path whose allowance
         ceiling is undecided is not a path this estate ships. */
      capabilities: ['balance'],
      networks: ['mainnet-beta'],
      units: ['SOL'],
      state: 'STUB',
      state_note: 'reads are real; there is no send path — SPEC-bSMARTWALLET-1 §5 GAP 1 ' +
        '(Solana allowance ceiling) is UNVERIFIED and fenced to a founder scope-call.',
      service_note: 'public Solana RPC is SERVICE, not PROTOCOL: rate-limited and it degrades. ' +
        'An unreachable rail answers RAIL_UNREACHABLE, never a zero balance.'
    };
  },
  balance: async function (p) {
    if (!p || !p.address) { var b = new Error('balance needs {address}'); b.code = E.BAD_PARAMS; throw b }
    if (!B58.test(p.address)) {
      var v = new Error('not a Solana address: expected 32-44 base58 characters (a 32-byte ed25519 key)');
      v.code = E.BAD_PARAMS; throw v;
    }
    var r = await solCall('getBalance', [p.address, { commitment: 'confirmed' }]);
    if (!r || typeof r.value !== 'number') {
      var e = new Error('Solana answered without a balance value'); e.code = E.NOT_FOUND; throw e;
    }
    return { unit: 'SOL', quantity: fromLamports(r.value) + ' SOL', lamports: String(r.value) };
  }
};

self.onmessage = async function (ev) {
  var m = ev.data;
  if (!m || m.jsonrpc !== '2.0' || typeof m.id !== 'number') return;
  var fn = Object.prototype.hasOwnProperty.call(METHODS, m.method) ? METHODS[m.method] : null;
  if (!fn) {
    postMessage({ jsonrpc: '2.0', id: m.id, error: { code: E.UNSUPPORTED,
      message: 'method not on this adapter: ' + m.method +
        ' (solana carries ' + METHODS.describe().capabilities.join(', ') + ' only)' } });
    return;
  }
  try {
    postMessage({ jsonrpc: '2.0', id: m.id, result: await fn(m.params || {}) });
  } catch (e) {
    postMessage({ jsonrpc: '2.0', id: m.id,
      error: { code: (e && e.code) || -32000, message: (e && e.message) || String(e) } });
  }
};
