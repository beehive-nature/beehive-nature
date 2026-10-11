/* ant-pay.js — Phase E: the one shared piece every door uses to pay Autonomi for a prepared upload.

   prepare (keyless bridge) → the person's OWN wallet signs on Arbitrum One → finalize (bridge) → receipt.

   THE LAWS THIS FILE KEEPS
   - this coordinator never holds an EVM key. the native bzDiD keychain owns its Rust signing path;
     legacy adapters also support Trezor Connect and injected EIP-1193 wallets. nothing here
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
   - a signed envelope is decoded and compared field by field by code that did not build it, and its sender
     is recovered with noble secp256k1, not the Rust core that signed (checkEnvelope). keccak is the same
     vendored noble build on both sides. an authorization names the digest of what it covers (scopeOf, a
     serializer the signer shares), and the signer recomputes that digest with noble SHA-256.
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

  /* ── RLP + the EIP-1559 envelope (the Trezor path serialises the device's signature; checkEnvelope re-encodes what a signer returned) ── */
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

  /* ── the signed envelope, checked by code that did not sign it ──
     A signer's word for what it signed is not evidence. Before any broadcast the coordinator decodes
     the exact bytes, compares every field with the authorized transaction, requires the canonical
     encoding, recomputes the hash, and recovers the sender with the vendored noble secp256k1 — a
     different implementation from the Rust core that signed. */
  var SECP_N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'); // PUBLIC-CONSTANT: secp256k1 group order (SEC 2)
  function rlpDecode(hex) {
    var i = 0, bad = function () { throw refusal('binding', 'The signed envelope is not well-formed RLP'); };
    function take(n) { if (n < 0 || i + 2 * n > hex.length) bad(); var s = hex.substr(i, 2 * n); i += 2 * n; return s; }
    function size(n) { var s = take(n); if (!s || s.slice(0, 2) === '00') bad(); return parseInt(s, 16); }
    function item(depth) {
      if (depth > 4) bad(); // envelope → fields → access list → entry → storage keys
      var b = parseInt(take(1), 16);
      if (b < 0x80) return hex.substr(i - 2, 2);
      if (b < 0xb8) return take(b - 0x80);
      if (b < 0xc0) return take(size(b - 0xb7));
      var len = b < 0xf8 ? b - 0xc0 : size(b - 0xf7), end = i + 2 * len, out = [];
      if (end > hex.length) bad();
      while (i < end) out.push(item(depth + 1));
      if (i !== end) bad();
      return out;
    }
    var out = item(0); if (i !== hex.length) bad(); return out;
  }
  function checkEnvelope(signed, tx, payer, verify) {
    var refuse = function (what) { throw refusal('binding', 'The signed envelope differs from the authorized transaction: ' + what + '. Nothing was broadcast.'); };
    var raw = String(signed && signed.raw || '').toLowerCase();
    if (!/^0x02([0-9a-f]{2})+$/.test(raw) || !isH32(signed.hash)) refuse('no type-2 envelope and hash');
    var f = rlpDecode(raw.slice(4));
    if (!Array.isArray(f) || f.length !== 12 || f.slice(0, 8).concat(f.slice(9)).some(Array.isArray)) refuse('field count');
    var n = function (h, what) { if (h.slice(0, 2) === '00') refuse(what + ' encoding'); return h ? BigInt('0x' + h) : 0n; };
    var want = [['chain', CHAIN_ID], ['nonce', tx.nonce], ['priority fee', tx.maxPriorityFeePerGas], ['fee cap', tx.maxFeePerGas], ['gas', tx.gas]];
    want.forEach(function (w, k) { if (n(f[k], w[0]) !== BigInt(w[1])) refuse(w[0]); });
    if (f[5] !== strip(tx.to)) refuse('recipient');
    if (n(f[6], 'value') !== 0n) refuse('value');
    if (f[7] !== strip(tx.data)) refuse('calldata');
    if (!Array.isArray(f[8]) || f[8].length) refuse('access list');
    var v = n(f[9], 'parity'), r = n(f[10], 'r'), s = n(f[11], 's');
    if (v > 1n || r <= 0n || r >= SECP_N || s <= 0n || s > SECP_N / 2n) refuse('signature range');
    var body = [rlpInt(CHAIN_ID), rlpInt(tx.nonce), rlpInt(tx.maxPriorityFeePerGas), rlpInt(tx.maxFeePerGas), rlpInt(tx.gas), strip(tx.to), '', strip(tx.data), []];
    if ('0x02' + rlp(body.concat([rlpInt(v), rlpInt(r), rlpInt(s)])) !== raw) refuse('canonical encoding');
    var bytes = function (h) { var o = new Uint8Array(h.length / 2); for (var k = 0; k < o.length; k++) o[k] = parseInt(h.substr(2 * k, 2), 16); return o; };
    var hexOf = function (b) { return Array.from(b, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); };
    if (hexOf(verify.keccak256(bytes(raw.slice(2)))) !== strip(signed.hash)) refuse('hash');
    var from = verify.recover(verify.keccak256(bytes('02' + rlp(body))), r, s, Number(v));
    if (String(from).toLowerCase() !== String(payer).toLowerCase()) refuse('signer is not the payer');
  }
  /* the independent verifier: the page's vendored noble build (window.BnrSign), never the signer */
  function nobleVerifier(B) {
    if (!B || !B.secp || !B.secp.Signature || typeof B.keccak_256 !== 'function') return null;
    return {
      keccak256: function (b) { return B.keccak_256(b); },
      recover: function (digest, r, s, parity) {
        var P = new B.secp.Signature(r, s).addRecoveryBit(parity).recoverPublicKey(digest);
        var pub = P.toRawBytes ? P.toRawBytes(false) : P.toBytes(false), h = B.keccak_256(pub.slice(1)).slice(12);
        return '0x' + Array.from(h, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
      }
    };
  }
  /* what an authorization covers: the file, contracts, payer, every quote and every planned
     transaction's fixed fields. Nonce and broadcast state are assigned later and are not in it. */
  function scopeOf(artifact, network, p) {
    return { v: 1,
      artifact: { name: artifact.name, sha256: artifact.sha256, bytes: artifact.bytes },
      network: { chainId: network.chainId, paymentTokenAddress: String(network.paymentTokenAddress).toLowerCase(), paymentVaultAddress: String(network.paymentVaultAddress).toLowerCase() },
      payer: p.payer, payments: p.payments.map(function (q) { return { quote_hash: q.quote_hash, rewards_address: q.rewards_address, amount_atto: q.amount_atto }; }),
      total: p.total, expiresAt: p.expiresAt, gasCeilingWei: p.gasCeilingWei,
      plan: p.txs.map(function (t) { return { kind: t.kind, to: t.to, data: t.data, gas: t.gas, maxFeePerGas: t.maxFeePerGas, maxPriorityFeePerGas: t.maxPriorityFeePerGas, reservedWei: t.reservedWei }; }) };
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

  /* Hosted SDK payer. Reuses the estate wire encoders above and the reservation
     rule in ops/ant-extsig/src/budget.rs: unknown sends retain their full gas
     exposure; only a verified mined receipt can lower it. One journal belongs
     to one file hash. Web Locks serializes all purchase flows in this origin.
     Clearing site data or using another device removes this local protection. */
  function createHosted(cfg) {
    var storage = cfg.storage, rpc = cfg.rpc, eth = cfg.ethereum, signer = cfg.signer;
    var verify = cfg.verify || nobleVerifier(root.BnrSign);
    var clock = cfg.now || Date.now, pause = cfg.sleep || (ms => new Promise(r => setTimeout(r, ms)));
    var key = 'bnr.ant.purchase.v1:' + cfg.artifact.sha256;
    var fail = (code, message) => { throw refusal(code, message); };
    if (signer && !verify) fail('binding', 'The independent envelope verifier did not load; reload this wallet');
    var dec = v => { if (typeof v !== 'string' || !/^(0|[1-9]\d*)$/.test(v)) fail('binding', 'Invalid decimal amount'); return BigInt(v); };
    var hx = v => '0x' + BigInt(v).toString(16);
    var same = (a,b) => String(a).toLowerCase() === String(b).toLowerCase();
    var copy = v => JSON.parse(JSON.stringify(v));
    var digest = async v => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(v)))), b => b.toString(16).padStart(2,'0')).join('');
    var artifact = copy(cfg.artifact), network = copy(cfg.network);
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 3) fail('binding','Invalid file identity');
    if (network.chainId !== CHAIN_ID || !isAddr(network.paymentTokenAddress) || !isAddr(network.paymentVaultAddress)) fail('binding','Expected the bundled Arbitrum One payment network');
    var raw = storage.getItem(key);
    var ledger = raw ? JSON.parse(raw) : {v:1, artifact, network, plans:[], checkpoint:null, result:null, receipt:null};
    if (JSON.stringify(ledger.artifact) !== JSON.stringify(artifact) || JSON.stringify(ledger.network) !== JSON.stringify(network)) fail('binding','Saved purchase belongs to a different file or payment network');
    function save(){ storage.setItem(key, JSON.stringify(ledger)); }
    save(); // Storage failure must precede even a wallet request.
    function stopped(signal){ if (signal && signal.aborted) fail('cancelled','Request stopped. Submitted transactions may still settle; resume this file to reconcile.'); }
    async function chain(){ if (BigInt(await rpc('eth_chainId',[])) !== BigInt(CHAIN_ID)) fail('wrong-chain','The payment RPC is not Arbitrum One'); }
    async function account(prompt){
      if(signer){
        var address=await signer.address();
        if(!isAddr(address))fail('no-wallet','Connect your bzDiD keychain to prepare this invoice');
        return address.toLowerCase();
      }
      if (!eth || typeof eth.request !== 'function') fail('no-wallet','Connect an Arbitrum One browser wallet to pay for storage');
      if (BigInt(await eth.request({method:'eth_chainId'})) !== BigInt(CHAIN_ID)) fail('wrong-chain','Select Arbitrum One in your browser wallet');
      var accounts = await eth.request({method:prompt?'eth_requestAccounts':'eth_accounts'});
      if (!accounts || !isAddr(accounts[0])) fail('no-wallet','The browser wallet shared no account');
      return accounts[0].toLowerCase();
    }
    function quotesOf(quotes){
      if (!Array.isArray(quotes) || !quotes.length || quotes.length > MAX_PER_TX) fail('binding','Expected one supported wave of quotes');
      var seen = new Set();
      return quotes.map(q => {
        var h = '0x'+strip(q.quoteHash);
        if (!isH32(h) || !isAddr(q.rewardsAddress) || seen.has(h)) fail('binding','Malformed or repeated storage quote');
        seen.add(h); dec(q.amount);
        return {quote_hash:h,rewards_address:q.rewardsAddress.toLowerCase(),amount_atto:q.amount};
      });
    }
    function checkedNetwork(n){ if(n.chainId!==network.chainId || !same(n.paymentTokenAddress,network.paymentTokenAddress) || !same(n.paymentVaultAddress,network.paymentVaultAddress)) fail('binding','Payment network or contracts changed'); }
    function gasExposure(){ return ledger.plans.reduce((sum,p)=>sum+p.txs.reduce((s,t)=>s+BigInt(t.actualWei ?? t.reservedWei),0n),0n); }
    function storageExposure(){ return ledger.plans.reduce((sum,p)=>sum+(p.txs.some(t=>t.kind==='payment'&&t.state!=='planned')?BigInt(p.total):0n),0n); }
    function authorized(p, signal){
      stopped(signal);
      if (!p.authorization || p.authorization.invoice !== p.id || p.authorization.payer !== p.payer || p.authorization.expiresAt !== p.expiresAt || clock() >= p.expiresAt) fail('expired','The invoice is not authorized or has expired. No new transaction was requested.');
      if (!p.scope || p.authorization.scope !== p.scope) fail('binding','The authorization does not name this invoice’s contents. Prepare a new invoice; no new transaction was requested.');
      if (BigInt(p.total)+storageExposure()-(p.txs.some(t=>t.kind==='payment'&&t.state!=='planned')?BigInt(p.total):0n)>100n*10n**18n) fail('over-ceiling','The file would exceed the 100 ANT storage ceiling');
      if (gasExposure()>BigInt(p.authorization.gasCeilingWei)) fail('gas-ceiling','Aggregate gas exposure exceeds the authorized ETH limit');
    }
    async function invoice(n, quotes, gasCeilingWei, signal){
      var quoteExpiresAt=clock()+120000;
      stopped(signal); checkedNetwork(n); await chain();
      var payments=quotesOf(quotes), total=payments.reduce((s,q)=>s+BigInt(q.amount_atto),0n).toString();
      var binding=await digest({artifact,network,payments});
      var claims=JSON.parse(storage.getItem('bnr.ant.quote-claims.v1')||'{}');
      if(payments.some(q=>claims[q.quote_hash]&&claims[q.quote_hash]!==artifact.sha256))fail('replay','A quote belongs to another saved file purchase. Reconcile that purchase first.');
      var prior=ledger.plans.find(p=>p.binding===binding&&!p.superseded);
      if(prior && prior.txs.some(t=>t.state!=='planned')) return copy(prior);
      if(ledger.plans.some(p=>p.binding!==binding&&p.txs.some(t=>t.state==='sending'||t.state==='submitted'||t.state==='failed'))) fail('uncertain','An earlier payment must be reconciled before requesting another price');
      if(ledger.plans.some(p=>!p.superseded&&p.binding!==binding&&p.payments.some(q=>payments.some(v=>v.quote_hash===q.quote_hash)))) fail('replay','This price overlaps a kept payment. Resume its checkpoint.');
      var ceiling=dec(gasCeilingWei);
      if(ceiling===0n) fail('gas-ceiling','Set a separate maximum ETH network fee');
      if(ledger.gasCeilingWei && ledger.gasCeilingWei!==gasCeilingWei) fail('gas-ceiling','Resume with the original aggregate ETH limit');
      if(BigInt(total)+storageExposure()>100n*10n**18n) fail('over-ceiling','The file would exceed 100 ANT');
      var payer=await account(true);
      var allowance=BigInt(await rpc('eth_call',[{to:network.paymentTokenAddress,data:SEL.allowance+pad32(payer)+pad32(network.paymentVaultAddress)},'latest']));
      var balance=BigInt(await rpc('eth_call',[{to:network.paymentTokenAddress,data:SEL.balanceOf+pad32(payer)},'latest']));
      if(balance<BigInt(total)) fail('short-ant','This account has less ANT than the quoted price');
      var fee=BigInt(await rpc('eth_gasPrice',[]))*2n;
      if(fee===0n) fail('gas-ceiling','The network returned no usable fee');
      var txs=[];
      if(allowance<BigInt(total)){
        var approval={kind:'approval',to:network.paymentTokenAddress,data:encodeApprove(network.paymentVaultAddress,total)};
        approval.gas=hx((BigInt(await rpc('eth_estimateGas',[{from:payer,to:approval.to,data:approval.data,value:'0x0'}]))*120n+99n)/100n);
        txs.push(approval);
      }
      // Approval may be required before payment simulation succeeds. Reserve a
      // declared upper bound now, then simulate under that bound before sending.
      txs.push({kind:'payment',to:network.paymentVaultAddress,data:encodePayForQuotes(payments),gas:hx(3000000)});
      txs.forEach(t=>{t.maxFeePerGas=hx(fee);t.maxPriorityFeePerGas='0x0';t.reservedWei=(BigInt(t.gas)*fee).toString();t.state='planned';});
      var exposure=gasExposure()+(prior?-prior.txs.reduce((s,t)=>s+BigInt(t.reservedWei),0n):0n)+txs.reduce((s,t)=>s+BigInt(t.reservedWei),0n);
      if(exposure>ceiling) fail('gas-ceiling','This plan needs up to '+exposure+' wei in aggregate network fees, above your limit');
      if(BigInt(await rpc('eth_getBalance',[payer,'latest']))<exposure) fail('no-gas','The account cannot cover this plan’s bounded network fee');
      var p={binding,id:await digest({binding,payer,txs,gasCeilingWei,created:clock()}),payer,payments,total,expiresAt:quoteExpiresAt,gasCeilingWei,txs,authorization:null};
      p.scope=await digest(scopeOf(artifact,network,p));
      if(clock()>=quoteExpiresAt)fail('expired','The quote expired while preparing the invoice');
      if(prior)ledger.plans.splice(ledger.plans.indexOf(prior),1);
      ledger.plans.push(p);ledger.gasCeilingWei=gasCeilingWei;save();return copy(p);
    }
    function authorize(shown){
      var p=ledger.plans.find(x=>x.id===shown.id);
      if(!p || JSON.stringify(copy(p))!==JSON.stringify(shown) || clock()>=p.expiresAt) fail('binding','The displayed invoice changed or expired');
      p.authorization={invoice:p.id,scope:p.scope,payer:p.payer,expiresAt:p.expiresAt,gasCeilingWei:p.gasCeilingWei,artifactSha256:artifact.sha256,at:clock()};save();
      return p.id;
    }
    async function observe(p,t,signal){
      await chain();
      // A provider can throw after broadcast. Discover the exact nonce on chain;
      // absence is never permission to broadcast again.
      if(!t.hash){
        var end=BigInt(await rpc('eth_blockNumber',[])),start=BigInt(t.recoveryNextBlock||t.block);
        if(end-start>999n)end=start+999n;
        for(var b=start;b<=end;b++){
          var block=await rpc('eth_getBlockByNumber',[hx(b),true]);
          var found=(block?.transactions||[]).find(x=>same(x.from,p.payer)&&BigInt(x.nonce)===BigInt(t.nonce));
          if(found){t.hash=found.hash;save();break;}
        }
        if(!t.hash){
          t.recoveryNextBlock=hx(end>BigInt(t.block)+1n?end-1n:BigInt(t.block));save();
          fail('uncertain','The wallet outcome is still unknown. Resume to continue checking history; no duplicate transaction was sent.');
        }
      }
      for(var i=0;i<40;i++){
        stopped(signal);
        var receipt=await rpc('eth_getTransactionReceipt',[t.hash]);
        if(receipt){
          var tx=await rpc('eth_getTransactionByHash',[t.hash]);
          if(!isH32(receipt.blockHash)||!same(receipt.transactionHash,t.hash)||!tx||!same(tx.hash,t.hash)||!same(tx.from,p.payer)||!same(tx.to,t.to)||!same(tx.input,t.data)||BigInt(tx.value)!==0n||BigInt(tx.nonce)!==BigInt(t.nonce)||BigInt(tx.chainId)!==BigInt(CHAIN_ID)||BigInt(tx.gas)>BigInt(t.gas)||BigInt(tx.maxFeePerGas)>BigInt(t.maxFeePerGas)) fail('binding','Mined transaction differs from the authorized invoice');
          var canonical=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
          if(!isH32(canonical?.hash)||!same(canonical.hash,receipt.blockHash)||BigInt(await rpc('eth_blockNumber',[]))<BigInt(receipt.blockNumber)+1n){await pause(1500);continue;}
          var actual=BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice);
          if(actual>BigInt(t.reservedWei)) fail('gas-ceiling','Mined gas exceeds its reservation');
          t.actualWei=actual.toString();t.state=receipt.status==='0x1'?'confirmed':'failed';t.receipt=receipt;save();
          if(t.state==='failed')fail('tx-reverted','The transaction reverted. Its gas remains in the ledger; no automatic replacement is sent.');
          return;
        }
        await pause(1500);
      }
      fail('uncertain','Confirmation is pending. Resume this file to check again without paying twice.');
    }
    async function settle(id,signal,recoverOnly){
      var p=ledger.plans.find(p=>p.id===id); if(!p)fail('binding','No such invoice');
      await chain();
      for(var t of p.txs){
        if(t.state!=='planned'){await observe(p,t,signal);continue;}
        if(recoverOnly)fail('uncertain','This invoice still needs an explicitly authorized transaction; recovery sends nothing');
        authorized(p,signal);
        if(await account(false)!==p.payer)fail('binding','The wallet account changed');
        var estimated=BigInt(await rpc('eth_estimateGas',[{from:p.payer,to:t.to,data:t.data,value:'0x0'}]));
        if(estimated>BigInt(t.gas))fail('gas-ceiling','Gas estimate exceeds the authorized transaction limit');
        t.nonce=await rpc('eth_getTransactionCount',[p.payer,'pending']);t.block=await rpc('eth_blockNumber',[]);
        if(await digest(scopeOf(artifact,network,p))!==p.scope)fail('binding','The invoice changed after it was authorized. Nothing was signed.');
        // Repeat expiry/cancellation after asynchronous checks, immediately before
        // the durable send marker. This marker is never removed on a send error.
        authorized(p,signal);
        if(await account(false)!==p.payer)fail('binding','The wallet account changed before signing');
        authorized(p,signal);
        var claims=JSON.parse(storage.getItem('bnr.ant.quote-claims.v1')||'{}');
        if(p.payments.some(q=>claims[q.quote_hash]&&claims[q.quote_hash]!==artifact.sha256))fail('replay','Another file already reserved this quote');
        p.payments.forEach(q=>{claims[q.quote_hash]=artifact.sha256;});
        storage.setItem('bnr.ant.quote-claims.v1',JSON.stringify(claims));
        t.state='sending';save();
        var request={from:p.payer,to:t.to,data:t.data,value:'0x0',chainId:CHAIN_HEX,nonce:t.nonce,gas:t.gas,maxFeePerGas:t.maxFeePerGas,maxPriorityFeePerGas:t.maxPriorityFeePerGas},h;
        if(signer){
          // The bzDiD adapter signs only: it cannot broadcast. Keep the exact
          // signed envelope and its locally computed hash before any RPC send.
          var signed;
          try{
            signed=await signer.signTransaction(request,{artifact:copy(artifact),network:copy(network),invoice:copy(p),kind:t.kind});
            checkEnvelope(signed,request,p.payer,verify);
            authorized(p,signal);
          }catch(error){
            // Nothing has left this page: the envelope is dropped and its nonce stays free.
            t.state='planned';save();throw error;
          }
          t.raw=signed.raw.toLowerCase();t.hash=signed.hash.toLowerCase();save();
          h=await rpc('eth_sendRawTransaction',[t.raw]);
          if(!same(h,t.hash))fail('binding','The RPC returned a different signed transaction hash');
        }else{
          h=await eth.request({method:'eth_sendTransaction',params:[request]});
        }
        if(!isH32(h))fail('uncertain','The wallet returned no transaction hash. Resume to reconcile; do not start another payment.');
        t.hash=h;t.state='submitted';save();await observe(p,t,signal);
      }
      var paid=p.txs.find(t=>t.kind==='payment');
      return {transactionHash:paid.hash,walletAddress:p.payer,totalAmount:p.total};
    }
    function provider(id){return {
      pay:async(n,quotes,context)=>{checkedNetwork(n);var p=ledger.plans.find(p=>p.id===id);if(!p||await digest({artifact,network,payments:quotesOf(quotes)})!==p.binding)fail('binding','Quotes differ from the authorized invoice');return settle(id,context.signal,false);},
      recover:async(n,quotes,attempt,context)=>{checkedNetwork(n);var binding=await digest({artifact,network,payments:quotesOf(quotes)});var p=ledger.plans.find(p=>p.binding===binding&&!p.superseded);if(!p)fail('uncertain','No matching durable payment record');return settle(p.id,context.signal,true);}
    };}
    return {invoice,authorize,provider,snapshot:()=>copy(ledger),
      retryUnpaid:async signal=>{
        if(!ledger.checkpoint || ledger.result || ledger.plans.some(p=>p.txs.some(t=>t.kind==='payment'&&t.state!=='planned')))return false;
        // If only approvals were attempted, reconcile them before discarding the
        // unpaid SDK checkpoint. Preserve their gas and obtain fresh quotes.
        for(var p of ledger.plans)for(var t of p.txs)if(t.state!=='planned')await observe(p,t,signal);
        for(var p of ledger.plans){p.txs=p.txs.filter(t=>t.state!=='planned');p.superseded=true;}
        ledger.checkpoint=null;save();return true;
      },
      checkpoint:value=>{ledger.checkpoint=copy(value);save();},
      uploaded:result=>{ledger.result=copy(result);save();},
      reconcile:async bytes=>{
        var hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        if(!ledger.result||hash!==artifact.sha256||bytes.byteLength!==artifact.bytes)fail('hash-mismatch','Retrieved bytes do not match the original file');
        for(var p of ledger.plans)for(var t of p.txs)if(t.state!=='planned')await observe(p,t,null);
        ledger.receipt={schema:'bpay.ant.reconciled/1',artifact,network,file:ledger.result.file,storageAtto:storageExposure().toString(),gasWei:ledger.plans.reduce((sum,p)=>sum+p.txs.reduce((s,t)=>s+BigInt(t.actualWei||'0'),0n),0n).toString(),gasExposureWei:gasExposure().toString(),gasCeilingWei:ledger.gasCeilingWei||'0',invoices:ledger.plans.filter(p=>p.authorization).map(p=>p.id),transactions:ledger.plans.flatMap(p=>p.txs.filter(t=>t.hash).map(t=>({kind:t.kind,hash:t.hash,gasWei:t.actualWei}))),retrievedSha256:hash,retrievedBytes:bytes.byteLength,reconciledAt:new Date(clock()).toISOString()};save();return copy(ledger.receipt);
      }};
  }

  var api = { createHosted: createHosted, create: create, injectedSigner: injectedSigner, trezorSigner: trezorSigner, loadTrezorConnect: loadTrezorConnect, CHAIN_ID: CHAIN_ID,
    _wire: { encodeApprove: encodeApprove, encodePayForQuotes: encodePayForQuotes, rlp: rlp, serialize1559: serialize1559, SEL: SEL, scopeOf: scopeOf },
    _envelope: { check: checkEnvelope, decode: rlpDecode, nobleVerifier: nobleVerifier } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window === 'object') root.AntPay = api;
})(typeof window === 'object' ? window : globalThis);
