/* ─── LICENSE ──────────────────────────────────────────────────────────────
   SPDX-License-Identifier: Apache-2.0
   Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
   Licensed under the Apache License, Version 2.0 (the "License"); you
   may not use this file except in compliance with the License. You may
   obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
   See /LICENSE and /NOTICE in this repository. Applies to the rails:
   the wallet surface, the rail adapters, the Arweave signer.
   ─────────────────────────────────────────────────────────────────────── */
// wallet-adapter-hive.js — the Hive rail adapter on SPEC-ADAPTER-CONTRACT-1.
// Read rail only: balance. It exists for the same reason every adapter exists
// (spec §1): a rail reached behind one contract, one worker, one isolation
// boundary — and with two adapters attached, the contract itself is testable
// (spec §9.7). No keys, no writes, no eosjs — Hive answers JSON-RPC natively.
var HH = 'https://api.hive.blog';

var E = { RAIL_UNREACHABLE: -32001, BAD_PARAMS: -32007 };

async function hiveCall(method, params) {
  var ctl = new AbortController();
  var to = setTimeout(function () { ctl.abort() }, 9000);
  try {
    var r = await fetch(HH, { method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: method, params: params, id: 1 }) });
    if (!r.ok) throw new Error('hive said ' + r.status);
    var d = await r.json();
    if (d && d.result) return d.result;
    throw new Error('hive: ' + JSON.stringify(d && d.error || d).slice(0, 120));
  } finally { clearTimeout(to) }
}

var METHODS = {
  describe: function () {
    return {
      rail: 'hive',
      adapter_version: '1.0.0',
      contract_version: '1',
      capabilities: ['balance'],
      networks: ['mainnet'],
      units: ['HIVE']
    };
  },
  balance: async function (p) {
    if (!p || !p.address) { var b = new Error('balance needs {address}'); b.code = E.BAD_PARAMS; throw b }
    var accounts = await hiveCall('condenser_api.get_accounts', [[p.address]]);
    if (!accounts || !accounts[0]) { var e = new Error('account ' + p.address + ' not found on Hive'); e.code = -32006; throw e }
    return { unit: 'HIVE', quantity: (parseFloat(accounts[0].balance) || 0).toFixed(3) + ' HIVE' };
  }
};

self.onmessage = async function (ev) {
  var m = ev.data;
  if (!m || m.jsonrpc !== '2.0' || typeof m.id !== 'number') return;
  var fn = METHODS[m.method];
  if (!fn) {
    postMessage({ jsonrpc: '2.0', id: m.id, error: { code: -32008, message: 'method not on this adapter: ' + m.method } });
    return;
  }
  try {
    var result = await fn(m.params || {});
    postMessage({ jsonrpc: '2.0', id: m.id, result: result });
  } catch (e) {
    var unreachable = /hive said|Failed to fetch|abort|network/i.test((e && e.message) || '');
    postMessage({ jsonrpc: '2.0', id: m.id, error: { code: (e && e.code) || (unreachable ? E.RAIL_UNREACHABLE : -32000), message: (e && e.message) || String(e) } });
  }
};
