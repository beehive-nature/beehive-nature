/* ant-pay.js — Phase E: the one shared piece every door uses to pay Autonomi for a prepared upload.

   prepare (keyless bridge) → the person's OWN wallet signs on Arbitrum One → finalize (bridge) → receipt.

   THE LAWS THIS FILE KEEPS
   - the page never holds an EVM key. a signer is something that SIGNS: Trezor Connect from our own page
     (founder ruling 2026-08-21, SPEC-AUTONOMI-TREZOR-1 §2) or an injected EIP-1193 wallet. nothing here
     accepts, derives, stores or asks for key material — there is no such parameter.
   - the press is the person's (FOUNDER-GESTURE-UX-LAW). pay() will not sign until confirmPlan() — the
     surface's own button — has been shown the exact plan: token, spender, ANT total, and the exact number
     of wallet confirmations (SPEC §1: printed BEFORE any signing).
   - refusal with a named reason, never a default. no wallet, wrong chain, no quote, a plan over the
     authorized ceiling, contracts the bridge did not name, a merkle plan this build cannot pay: each is a
     refusal{code} the surface can say in plain words. a price is never invented here.
   - approve is for the EXACT quoted total, never unlimited.
   - contract addresses come from the bridge's own binary (/health → evm), never from a document or this file.
   - transaction hashes are persisted BEFORE finalize. a paid-but-unfinalized upload resumes; it never pays twice.
   - wire facts are cited: selectors and tuple order are held to a real Arbitrum One transaction in
     e2e/ant-pay-vector.json (PaymentVaultV2.payForQuotes, verified source on Blockscout). */
(function (root) {
  'use strict';
  var CHAIN_ID = 42161, CHAIN_HEX = '0xa4b1', MAX_PER_TX = 256; /* evmlib MAX_TRANSFERS_PER_TRANSACTION */
  var SEL = { approve: '0x095ea7b3', balanceOf: '0x70a08231', allowance: '0xdd62ed3e', payForQuotes: '0xb6c2141b' };

  function refusal(code, message, detail) { var e = new Error(message); e.refusal = code; if (detail) e.detail = detail; return e; }
  var strip = function (h) { return String(h).replace(/^0x/i, '').toLowerCase(); };
  var isAddr = function (h) { return /^0x[0-9a-fA-F]{40}$/.test(h); }, isH32 = function (h) { return /^0x[0-9a-fA-F]{64}$/.test(h); };
  var pad32 = function (h) { h = strip(h); if (h.length > 64) throw refusal('bad-plan', 'a value does not fit in 32 bytes'); return h.padStart(64, '0'); };
  var word = function (n) { return pad32(BigInt(n).toString(16)); };
  var big = function (v, what) { try { if (typeof v === 'string' && !/^(0x[0-9a-fA-F]+|\d+)$/.test(v)) throw 0; var b = BigInt(v); if (b < 0n) throw 0; return b; } catch (e) { throw refusal('bad-plan', 'unreadable amount' + (what ? ' in ' + what : '')); } };

  /* ── calldata ── */
  function encodeApprove(spender, amountAtto) { if (!isAddr(spender)) throw refusal('bad-plan', 'spender is not an address'); return SEL.approve + pad32(spender) + word(amountAtto); }
  function encodePayForQuotes(payments) {
    if (!payments.length || payments.length > MAX_PER_TX) throw refusal('bad-plan', 'a payment call carries 1 to ' + MAX_PER_TX + ' quotes');
    return SEL.payForQuotes + word(32) + word(payments.length) + payments.map(function (p) { return pad32(p.rewards_address) + word(p.amount_atto) + pad32(p.quote_hash); }).join('');
  }

  /* ── RLP + the EIP-1559 envelope (only the Trezor path needs them: the device returns a signature, the page serialises and broadcasts) ── */
  function rlpBytes(hex) { hex = strip(hex); if (hex.length % 2) hex = '0' + hex; return hex; }
  function rlpInt(v) { var h = BigInt(v).toString(16); return BigInt(v) === 0n ? '' : (h.length % 2 ? '0' + h : h); }
  function rlpLen(len, base) { if (len < 56) return (base + len).toString(16).padStart(2, '0'); var l = len.toString(16); if (l.length % 2) l = '0' + l; return (base + 55 + l.length / 2).toString(16) + l; }
  function rlp(item) {
    if (Array.isArray(item)) { var body = item.map(rlp).join(''); return rlpLen(body.length / 2, 0xc0) + body; }
    var b = rlpBytes(item); if (b.length === 2 && parseInt(b, 16) < 0x80) return b; return rlpLen(b.length / 2, 0x80) + b;
  }
  function serialize1559(tx, sig) {
    return '0x02' + rlp([rlpInt(CHAIN_ID), rlpInt(tx.nonce), rlpInt(tx.maxPriorityFeePerGas), rlpInt(tx.maxFeePerGas), rlpInt(tx.gasLimit), tx.to, '', tx.data, [], rlpInt(sig.v), rlpInt(sig.r), rlpInt(sig.s)]);
  }

  /* ── the chain, asked directly (a public RPC — never the wallet's word for a balance) ── */
  function rpcOf(fetchFn, url) {
    var id = 0;
    return function (method, params) {
      return fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: method, params: params || [] }) })
        .then(function (r) { if (!r.ok) throw refusal('network', 'the Arbitrum RPC answered HTTP ' + r.status); return r.json(); })
        .then(function (j) { if (j.error) throw refusal('rpc', 'the Arbitrum RPC refused ' + method + ': ' + String(j.error.message || '').slice(0, 160)); return j.result; });
    };
  }

  /* ── signers. each is { name, address(), send({to,data}) → txHash }. a signer signs; it is never handed a key. ── */
  function injectedSigner(eth) {
    if (!eth || typeof eth.request !== 'function') throw refusal('no-wallet', 'no wallet is connected to this page');
    var from = null;
    return {
      name: 'injected wallet',
      address: function () {
        return eth.request({ method: 'eth_requestAccounts' }).then(function (a) {
          if (!a || !isAddr(a[0])) throw refusal('no-wallet', 'the wallet shared no account');
          from = a[0]; return eth.request({ method: 'eth_chainId' });
        }).then(function (c) {
          if (String(c).toLowerCase() !== CHAIN_HEX) throw refusal('wrong-chain', 'the wallet is on chain ' + c + '; Autonomi is paid on Arbitrum One (' + CHAIN_ID + ')', { have: c, need: CHAIN_HEX });
          return from;
        });
      },
      send: function (tx) { return eth.request({ method: 'eth_sendTransaction', params: [{ from: from, to: tx.to, data: tx.data, value: '0x0' }] }); }
    };
  }
  function trezorSigner(connect, opts) {
    if (!connect || typeof connect.ethereumSignTransaction !== 'function') throw refusal('no-wallet', 'Trezor Connect is not loaded — it loads only when you ask for it');
    var path = (opts && opts.path) || "m/44'/60'/0'/0/0", rpc = opts && opts.rpc, from = null, hx = function (v) { return '0x' + BigInt(v).toString(16); };
    if (typeof rpc !== 'function') throw refusal('no-wallet', 'the Trezor path needs the chain to read nonce and fees');
    var ok = function (r, what) { if (!r || !r.success) throw refusal('wallet-declined', what + ': ' + String((r && r.payload && r.payload.error) || 'no answer').slice(0, 160)); return r.payload; };
    return {
      name: 'Trezor',
      address: function () { return connect.ethereumGetAddress({ path: path, showOnTrezor: false }).then(function (r) { from = ok(r, 'the Trezor shared no address').address; if (!isAddr(from)) throw refusal('no-wallet', 'the Trezor shared no address'); return from; }); },
      send: function (tx) {
        var t = { to: tx.to, data: tx.data };
        return Promise.all([rpc('eth_getTransactionCount', [from, 'pending']), rpc('eth_gasPrice', []), rpc('eth_estimateGas', [{ from: from, to: tx.to, data: tx.data }])]).then(function (v) {
          t.nonce = BigInt(v[0]); t.maxPriorityFeePerGas = 0n; t.maxFeePerGas = BigInt(v[1]) * 2n; t.gasLimit = BigInt(v[2]) * 5n / 4n;
          return connect.ethereumSignTransaction({ path: path, transaction: { to: t.to, value: '0x0', data: t.data, chainId: CHAIN_ID, nonce: hx(t.nonce), gasLimit: hx(t.gasLimit), maxFeePerGas: hx(t.maxFeePerGas), maxPriorityFeePerGas: '0x0' } });
        }).then(function (r) { return rpc('eth_sendRawTransaction', [serialize1559(t, ok(r, 'the Trezor did not sign'))]); });
      }
    };
  }
  /* Trezor's own official bridge, the one disclosed dependency (SPEC §2): fetched on the person's gesture only, never at page load. */
  function loadTrezorConnect(doc, manifest) {
    if (!manifest || !manifest.email || !manifest.appUrl) return Promise.reject(refusal('no-wallet', 'the surface did not name itself to Trezor Connect (manifest)'));
    return new Promise(function (resolve, reject) {
      if (root.TrezorConnect) return resolve(root.TrezorConnect);
      var s = doc.createElement('script'); s.src = 'https://connect.trezor.io/9/trezor-connect.js';
      s.onload = function () { root.TrezorConnect ? resolve(root.TrezorConnect) : reject(refusal('no-wallet', 'Trezor Connect loaded but did not start')); };
      s.onerror = function () { reject(refusal('no-wallet', 'Trezor Connect could not be fetched from connect.trezor.io')); };
      doc.head.appendChild(s);
    }).then(function (tc) { return Promise.resolve(tc.init({ manifest: manifest, lazyLoad: true })).catch(function () {}).then(function () { return tc; }); });
  }

  /* ── the payer ── */
  function create(cfg) {
    var fetchFn = cfg.fetch || (root.fetch && root.fetch.bind(root)), bridge = String(cfg.bridge || '').replace(/\/$/, '');
    var rpc = cfg.rpcCall || rpcOf(fetchFn, cfg.rpc), now = cfg.now || function () { return Date.now(); };
    var sleep = cfg.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var store = cfg.store || { get: function () { return null; }, set: function () {} }, tell = cfg.onState || function () {};
    var KEY = function (id) { return 'ant-pay.paid.' + id; };

    function bridgeJSON(path, body) {
      return fetchFn(bridge + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
        .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw refusal(r.status >= 500 ? 'network' : 'bridge-refused', 'the bridge answered HTTP ' + r.status + (t ? ' — ' + t.slice(0, 200) : ''), { status: r.status }); }); return r.json(); });
    }
    function contracts() {
      return bridgeJSON('/health').then(function (h) {
        var e = h && h.evm;
        if (!e || !isAddr(e.payment_token) || !isAddr(e.payment_vault)) throw refusal('no-contracts', 'the bridge did not name the ANT token and payment vault it was built with — this page will not take them from anywhere else');
        if (Number(e.chain_id) !== CHAIN_ID) throw refusal('wrong-chain', 'the bridge pays on chain ' + e.chain_id + ', not Arbitrum One', { have: e.chain_id, need: CHAIN_ID });
        return { token: e.payment_token, vault: e.payment_vault };
      });
    }
    function readPlan(prepare, authorization) {
      if (!prepare || !prepare.upload_id) throw refusal('no-quote', 'there is no price yet — ask Autonomi first');
      if (prepare.payment_type !== 'wave_batch') throw refusal('merkle-not-built', 'this upload is priced as a ' + prepare.payment_type + ' plan, which this build cannot pay yet');
      var all = Array.isArray(prepare.payments) ? prepare.payments : [];
      if (!all.length) throw refusal('no-quote', 'the price carries no payments');
      var seen = {}, total = 0n;
      all.forEach(function (p) {
        if (!isH32(p.quote_hash) || !isAddr(p.rewards_address)) throw refusal('bad-plan', 'a payment is malformed');
        if (seen[p.quote_hash.toLowerCase()]) throw refusal('bad-plan', 'a quote appears twice'); seen[p.quote_hash.toLowerCase()] = 1;
        total += big(p.amount_atto, 'a payment');
      });
      if (prepare.total_amount_atto != null && big(prepare.total_amount_atto, 'the total') !== total) throw refusal('quote-sum', 'the payments do not add up to the quoted total');
      if (!authorization || authorization.state !== 'authorized-for-signing') throw refusal('not-authorized', 'this price has not been authorized for signing');
      if (authorization.upload_id !== prepare.upload_id) throw refusal('not-authorized', 'the authorization is for a different price');
      var ceiling = big(authorization.ant_ceiling_atto, 'the ceiling');
      if (total > ceiling) throw refusal('over-ceiling', 'the price is above the ceiling you authorized', { total: total.toString(), ceiling: ceiling.toString() });
      var owed = all.filter(function (p) { return BigInt(p.amount_atto) > 0n; }), batches = [];
      for (var i = 0; i < owed.length; i += MAX_PER_TX) batches.push(owed.slice(i, i + MAX_PER_TX));
      return { total: total, owed: owed, batches: batches };
    }
    function waitFor(hash, label, signal) {
      var started = now();
      return (function poll() {
        if (signal && signal.aborted) throw refusal('stopped-waiting', 'you stopped waiting. the transaction may still land; its hash is kept and nothing will be paid twice', { tx: hash });
        return rpc('eth_getTransactionReceipt', [hash]).then(function (r) {
          if (r && r.status) { if (r.status !== '0x1') throw refusal('tx-reverted', 'the ' + label + ' transaction was refused by the chain', { tx: hash }); return r; }
          var secs = Math.round((now() - started) / 1000);
          if (secs > 600) throw refusal('stopped-waiting', 'ten minutes without a confirmation. the hash is kept; resume when the chain has it', { tx: hash });
          tell({ phase: 'waiting', what: label, tx: hash, seconds: secs });
          return sleep(3000).then(poll);
        });
      })();
    }
    function finalize(prepare, txHashes, plan, payer, started) {
      tell({ phase: 'finalizing', upload_id: prepare.upload_id });
      return bridgeJSON('/v1/upload/finalize', { upload_id: prepare.upload_id, tx_hashes: txHashes }).then(function (f) {
        if (f.total_chunks != null && f.chunks_stored < f.total_chunks) throw refusal('partial-store', 'only ' + f.chunks_stored + ' of ' + f.total_chunks + ' pieces were stored', { chunks_stored: f.chunks_stored, total_chunks: f.total_chunks });
        var receipt = { address: f.data_map_address || prepare.data_map_address || null, chunks: f.chunks_stored != null ? f.chunks_stored : null, quotes_paid: plan.owed.length,
          ant_atto: plan.total.toString(), payer: payer, tx_hashes: txHashes, seconds: Math.round((now() - started) / 1000), finished_at: new Date(now()).toISOString() };
        store.set(KEY(prepare.upload_id), JSON.stringify({ txHashes: txHashes, finalized: true, receipt: receipt }));
        tell({ phase: 'done', receipt: receipt }); return receipt;
      }, function (e) {
        throw refusal('paid-not-finalized', 'the payment is on chain but the upload did not finish: ' + e.message + '. nothing is lost — ask for the price again so the bridge recovers this plan, then resume; you will not be charged twice', { tx_hashes: txHashes });
      });
    }

    function pay(input) {
      var started = now(), prepare = input && input.prepare, plan, c, payer, signer = cfg.signer, txHashes = {};
      return Promise.resolve().then(function () {
        plan = readPlan(prepare, input.authorization);
        if (store.get(KEY(prepare.upload_id))) throw refusal('already-paid', 'this price was already paid from this device — resume it instead of paying again');
        if (!signer) throw refusal('no-wallet', 'no wallet is connected to this page');
        return contracts();
      }).then(function (x) { c = x; return signer.address(); }).then(function (a) {
        payer = a;
        return Promise.all([rpc('eth_call', [{ to: c.token, data: SEL.balanceOf + pad32(a) }, 'latest']), rpc('eth_getBalance', [a, 'latest']), rpc('eth_call', [{ to: c.token, data: SEL.allowance + pad32(a) + pad32(c.vault) }, 'latest'])]);
      }).then(function (v) {
        var ant = big(v[0]), eth = big(v[1]), allowance = big(v[2]);
        if (ant < plan.total) throw refusal('short-ant', 'this wallet holds less ANT than the price', { have: ant.toString(), need: plan.total.toString() });
        if (eth === 0n) throw refusal('no-gas', 'this wallet holds no ETH on Arbitrum One to pay the network fee');
        var needApprove = allowance < plan.total;
        var shown = { signer: signer.name, payer: payer, token: c.token, spender: c.vault, ant_total_atto: plan.total.toString(), approve_exact_atto: needApprove ? plan.total.toString() : null,
          quotes: plan.owed.length, payment_calls: plan.batches.length, wallet_confirmations: (needApprove ? 1 : 0) + plan.batches.length, upload_id: prepare.upload_id };
        tell({ phase: 'plan', plan: shown });
        if (typeof input.confirmPlan !== 'function') throw refusal('not-confirmed', 'the surface offered no button to confirm this plan');
        return Promise.resolve(input.confirmPlan(shown)).then(function (yes) {
          if (yes !== true) throw refusal('not-confirmed', 'you did not confirm — nothing was signed, nothing was paid');
          if (!needApprove) return null;
          tell({ phase: 'signing', what: 'approve', of: shown.wallet_confirmations, n: 1 });
          return signer.send({ to: c.token, data: encodeApprove(c.vault, plan.total) }).then(function (h) { if (!isH32(h)) throw refusal('wallet-declined', 'the wallet returned no transaction hash'); return waitFor(h, 'approve', input.signal); });
        }).then(function () {
          return plan.batches.reduce(function (chain, batch, i) {
            return chain.then(function () {
              tell({ phase: 'signing', what: 'payment', of: shown.wallet_confirmations, n: (needApprove ? 2 : 1) + i });
              return signer.send({ to: c.vault, data: encodePayForQuotes(batch) });
            }).then(function (h) {
              if (!isH32(h)) throw refusal('wallet-declined', 'the wallet returned no transaction hash');
              batch.forEach(function (p) { txHashes[p.quote_hash] = h; });
              store.set(KEY(prepare.upload_id), JSON.stringify({ txHashes: txHashes, finalized: false })); /* BEFORE finalize, before the wait */
              return waitFor(h, 'payment', input.signal);
            });
          }, Promise.resolve());
        });
      }).then(function () { return finalize(prepare, txHashes, plan, payer, started); })
        .catch(function (e) { if (!e.refusal) e = refusal('wallet-declined', String(e && e.message || e).slice(0, 200)); tell({ phase: 'refused', code: e.refusal, message: e.message, detail: e.detail }); throw e; });
    }
    /* a paid upload that did not finish: confirm the kept hashes on chain, then finalize. never signs, never pays. */
    function resume(input) {
      var started = now(), prepare = input && input.prepare, kept;
      return Promise.resolve().then(function () {
        var raw = prepare && store.get(KEY(prepare.upload_id)); if (!raw) throw refusal('nothing-to-resume', 'no payment from this device is waiting on this price');
        kept = JSON.parse(raw); if (kept.finalized) return kept.receipt;
        var plan = readPlan(prepare, input.authorization), hashes = Object.keys(kept.txHashes).map(function (k) { return kept.txHashes[k]; }).filter(function (h, i, a) { return a.indexOf(h) === i; });
        if (plan.owed.some(function (p) { return !kept.txHashes[p.quote_hash]; })) throw refusal('nothing-to-resume', 'the kept payment does not cover this price — it belongs to a different plan');
        return hashes.reduce(function (ch, h) { return ch.then(function () { return waitFor(h, 'payment', input.signal); }); }, Promise.resolve())
          .then(function () { return finalize(prepare, kept.txHashes, plan, null, started); });
      }).catch(function (e) { if (!e.refusal) e = refusal('network', String(e && e.message || e).slice(0, 200)); tell({ phase: 'refused', code: e.refusal, message: e.message, detail: e.detail }); throw e; });
    }
    /* verify by downloading: only if the bridge says it can. otherwise the surface says "not available yet" in prose. */
    function verify(address, sha256) {
      return bridgeJSON('/health').then(function (h) {
        if (!h || !h.capabilities || h.capabilities.indexOf('verify-download') < 0) return { available: false, reason: 'this bridge cannot download yet, so the check by downloading is not available yet' };
        return bridgeJSON('/v1/download/verify', { address: address, expect_sha256: sha256 }).then(function (v) { return { available: true, matches: v.matches === true, sha256: v.sha256 || null, bytes: v.bytes || null }; });
      });
    }
    return { pay: pay, resume: resume, verify: verify, contracts: contracts };
  }

  var api = { create: create, injectedSigner: injectedSigner, trezorSigner: trezorSigner, loadTrezorConnect: loadTrezorConnect, CHAIN_ID: CHAIN_ID,
    _wire: { encodeApprove: encodeApprove, encodePayForQuotes: encodePayForQuotes, rlp: rlp, serialize1559: serialize1559, SEL: SEL } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window === 'object') root.AntPay = api;
})(typeof window === 'object' ? window : globalThis);
