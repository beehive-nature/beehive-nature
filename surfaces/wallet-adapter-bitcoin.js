/* ─── LICENSE ──────────────────────────────────────────────────────────────
   SPDX-License-Identifier: Apache-2.0
   Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
   Licensed under the Apache License, Version 2.0 (the "License"); you
   may not use this file except in compliance with the License. You may
   obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
   See /LICENSE and /NOTICE in this repository. Applies to the rails:
   the wallet surface, the rail adapters, the Arweave signer.
   ─────────────────────────────────────────────────────────────────────── */
// wallet-adapter-bitcoin.js — the Bitcoin L1 rail adapter on SPEC-ADAPTER-CONTRACT-1.
//
// WHERE THIS RAIL GETS ITS AUTHORITY (same statement as the Solana adapter,
// repeated because a reader of one file should not have to find the other):
// §7 calls `Rail` a CLOSED enum added to "by ruling" but never writes its
// membership down. This rail enters by the founder's scope instruction of
// 2026-08-29 ("stub Solana + BTC behind the adapter interface"), which is
// SPEC-bSMARTWALLET-1 §5 GAP 5. The gap is not closed by this file.
//
// READ-ONLY BY CONSTRUCTION, and on this rail that is not caution, it is the
// finding: SPEC-bSMARTWALLET-1 §5 GAP 2 records that WITHOUT COVENANTS an
// on-chain spend cap is not enforceable on Bitcoin L1 before signing at all —
// enforcement is signer-side or it does not exist. So a send path here would
// have to carry its cap in the signer, and that is a founder ruling, not a
// default this file may pick. Reads are real; there is no send path.
//
// Esplora is the read shape (Blockstream's and mempool.space's public
// instances speak it identically). Both are SERVICE: they rate-limit and they
// go down. An unreachable rail says so — it never reports a zero balance.

var HOSTS = [
  'https://blockstream.info/api',
  'https://mempool.space/api'
];
var HTTP_TIMEOUT = 9000;
var SATS_DECIMALS = 8;   // PUBLIC-CONSTANT: 1 BTC = 1e8 satoshi (protocol fact)

var E = {
  RAIL_UNREACHABLE: -32001, NOT_FOUND: -32006,
  BAD_PARAMS: -32007, UNSUPPORTED: -32008
};

/* Accept the address forms this estate can actually derive or be handed, and
   REFUSE anything else by name. A malformed address that reaches the network
   comes back as a 400 and reads like an outage; caught here it reads like the
   typo it is. bc1 = segwit (BIP-173), 1 = P2PKH, 3 = P2SH. */
var ADDR = /^(bc1[02-9ac-hj-np-z]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;

async function esplora(path) {
  var hs = HOSTS.slice();
  for (var j = hs.length - 1; j > 0; j--) {
    var r = Math.floor(Math.random() * (j + 1)); var t = hs[j]; hs[j] = hs[r]; hs[r] = t;
  }
  var lastErr = null;
  for (var i = 0; i < hs.length; i++) {
    var ctl = new AbortController();
    var to = setTimeout(function () { ctl.abort() }, HTTP_TIMEOUT);
    try {
      var res = await fetch(hs[i] + path, { signal: ctl.signal, headers: { 'Accept': 'application/json' } });
      if (res.ok) return await res.json();
      if (res.status === 400 || res.status === 404) {
        var nf = new Error('the rail does not know this address (' + res.status + ')');
        nf.code = E.NOT_FOUND; throw nf;
      }
      lastErr = new Error('host ' + hs[i] + ' said ' + res.status);
    } catch (e) {
      if (e && e.code) throw e;
      lastErr = e;
    } finally { clearTimeout(to) }
  }
  var err = new Error('all Bitcoin read hosts unreachable (' + ((lastErr && lastErr.message) || 'no answer') + ')');
  err.code = E.RAIL_UNREACHABLE;
  throw err;
}

/* exact base-unit -> display, no float (satoshis are integers and stay so) */
function fromSats(units) {
  var v = BigInt(units), neg = v < 0n; if (neg) v = -v;
  var s = v.toString().padStart(SATS_DECIMALS + 1, '0');
  var whole = s.slice(0, s.length - SATS_DECIMALS);
  var frac = s.slice(s.length - SATS_DECIMALS).replace(/0+$/, '');
  return (neg ? '-' : '') + whole + (frac ? '.' + frac : '');
}

/* ── THE SHAPE THIS RAIL IS BUILT FOR (founder requirement, 2026-08-29).
   This adapter's interface is cut for silent payments, payment names and
   offers FROM THE START — not a blind stub that would have to be redesigned
   when they land. Each capability below is either carried now, or DECLARED
   ABSENT with the exact reason and the thing that would close it. §9.2 makes
   an undeclared capability unreachable, so "planned" never masquerades as
   "present": the roadmap lives in `not_carried`, never in `capabilities`.

   Reference standards, named at source so a reader can check the shapes:
     BIP-352  silent payments (the reusable sp1… address)
     BIP-353  DNS payment instructions (name@domain → TXT → a BIP-321 URI)
     BIP-321  the bitcoin: URI carrying MORE THAN ONE instruction
     BOLT-12  offers (lno1…), minted by our OWN node, never a third party's
   ── */
var METHODS = {
  describe: function () {
    return {
      rail: 'bitcoin',
      adapter_version: '0.2.0',
      contract_version: '1',
      /* CARRIED NOW. receiveAddress serves the silent-payment address: it is
         static and reusable by design, so index is meaningless here and the
         answer says so rather than pretending to rotate. */
      capabilities: ['balance', 'receiveAddress'],
      networks: ['mainnet'],
      units: ['BTC'],
      state: 'PARTIAL',
      standards: {
        'BIP-352': 'silent-payment address held and decoded; SCANNING is not carried (see not_carried)',
        'BIP-353': 'the payment-name record is BUILT first-party; resolution is DoH and labelled',
        'BIP-321': 'the unified URI is built and parsed — one name, both rails',
        'BOLT-12': 'offers are decoded; minting belongs to our own LN node, never to this adapter'
      },
      /* DECLARED ABSENT, each with the thing that would close it. None of
         these is reachable from the shell — that is the point of saying it. */
      not_carried: {
        silentPaymentScan: 'BIP-352 scanning is O(every transaction) and needs an indexer or a full ' +
          'node: the wallet HOLDS the reusable address but cannot see payments to it from a browser. ' +
          'Closed by an estate scanning backend (or an operator bitcoind), not by more page code.',
        buildSend: 'SPEC-bSMARTWALLET-1 §5 GAP 2 — WITHOUT COVENANTS a Bitcoin L1 spend cap is not ' +
          'enforceable on-chain before signing at all, so enforcement is signer-side policy. That is a ' +
          'founder ruling, not a default this adapter may pick.',
        mintOffer: 'a BOLT-12 offer must be minted by OUR OWN node (LDK / Alby-Hub per RAIL-FORMULARY-1). ' +
          'An adapter that fetched one from a third party would put someone else’s payment ' +
          'instructions under the estate’s name.'
      },
      service_note: 'Esplora public instances are SERVICE, not PROTOCOL. An operator bitcoind ' +
        'is the sovereign read. Unreachable answers RAIL_UNREACHABLE, never a zero balance.'
    };
  },
  /* the reusable address, returned with its derivation named so the caller can
     reproduce the keys elsewhere — an address nobody can rebuild keys for is a
     trap, so the reference travels WITH the address, never separately. */
  receiveAddress: function (p) {
    p = p || {};
    if (!p.silentPaymentAddress) {
      var e = new Error('receiveAddress needs {silentPaymentAddress} — this adapter holds no keys and ' +
        'derives nothing; the signer owns derivation and hands the address in');
      e.code = E.BAD_PARAMS; throw e;
    }
    if (!/^sp1[02-9ac-hj-np-z]+$/.test(p.silentPaymentAddress)) {
      var v = new Error('not a mainnet silent-payment address (expected sp1…)');
      v.code = E.BAD_PARAMS; throw v;
    }
    return {
      address: p.silentPaymentAddress,
      derivation_ref: p.derivationRef || null,
      reusable: true,
      index_note: 'a silent-payment address is STATIC: the payer derives a fresh output from it per ' +
        'payment, so there is no index to advance and none is invented here.',
      scan_note: 'this rail does not scan — see describe().not_carried.silentPaymentScan.'
    };
  },
  balance: async function (p) {
    if (!p || !p.address) { var b = new Error('balance needs {address}'); b.code = E.BAD_PARAMS; throw b }
    if (!ADDR.test(p.address)) {
      var v = new Error('not a Bitcoin address this adapter accepts (bc1… segwit, or a 1…/3… legacy address)');
      v.code = E.BAD_PARAMS; throw v;
    }
    var d = await esplora('/address/' + encodeURIComponent(p.address));
    var cs = (d && d.chain_stats) || null;
    if (!cs) { var e = new Error('the rail answered without chain_stats'); e.code = E.NOT_FOUND; throw e }
    /* confirmed balance = funded - spent, in satoshi, as integers throughout */
    var sats = BigInt(cs.funded_txo_sum || 0) - BigInt(cs.spent_txo_sum || 0);
    var mp = (d && d.mempool_stats) || null;
    var pending = mp ? BigInt(mp.funded_txo_sum || 0) - BigInt(mp.spent_txo_sum || 0) : 0n;
    return {
      unit: 'BTC',
      quantity: fromSats(sats) + ' BTC',
      sats: String(sats),
      /* unconfirmed is reported SEPARATELY and never folded into the balance —
         a number that silently mixes settled and pending is a wrong number */
      unconfirmed_sats: String(pending),
      tx_count: (cs.tx_count || 0)
    };
  }
};

self.onmessage = async function (ev) {
  var m = ev.data;
  if (!m || m.jsonrpc !== '2.0' || typeof m.id !== 'number') return;
  var fn = Object.prototype.hasOwnProperty.call(METHODS, m.method) ? METHODS[m.method] : null;
  if (!fn) {
    postMessage({ jsonrpc: '2.0', id: m.id, error: { code: E.UNSUPPORTED,
      message: 'method not on this adapter: ' + m.method +
        ' (bitcoin carries ' + METHODS.describe().capabilities.join(', ') + ' only)' } });
    return;
  }
  try {
    postMessage({ jsonrpc: '2.0', id: m.id, result: await fn(m.params || {}) });
  } catch (e) {
    postMessage({ jsonrpc: '2.0', id: m.id,
      error: { code: (e && e.code) || -32000, message: (e && e.message) || String(e) } });
  }
};
