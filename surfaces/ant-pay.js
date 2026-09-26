/* ant-pay.js — Phase E: the one shared piece every door uses to pay Autonomi for a prepared upload.

   prepare (the estate's keyless write door) → the person's OWN wallet signs on Arbitrum One → finalize (door) → receipt.

   THE WIRE is the door's (ops/ant-writedoor/README.md, ruled 7b0cc99b / 795cce0e), never the private bridge's:
     prepare  → {upload_id, payment_type, total_atto:"<decimal>", chunks:{total, already_stored},
                 quotes:[{quote_hash, rewards_address, amount_atto}], data_map_address}
     finalize → POST /ant/v1/upload/finalize {upload_id, txs:[{quote_hash, tx_hash}]} → {data_map_address}
   total_atto is REQUIRED and must equal the sum of the quotes; an absent total is a refusal, never a skip.
   Downloading to verify is NOT here: the door has no route for it, so there is nothing honest to call.

   THE LAWS THIS FILE KEEPS
   - the page never holds an EVM key. a signer is something that SIGNS: Trezor Connect from our own page
     (founder ruling 2026-08-21, SPEC-AUTONOMI-TREZOR-1 §2) or an injected EIP-1193 wallet. nothing here
     accepts, derives, stores or asks for key material — there is no such parameter.
   - the press is the person's (FOUNDER-GESTURE-UX-LAW). pay() will not sign until confirmPlan() — the
     surface's own button — has been shown the exact plan: token, spender, ANT total, and the exact number
     of wallet confirmations (SPEC §1: printed BEFORE any signing).
   - refusal with a named reason, never a default. no wallet, wrong chain, no quote, a plan over the
     authorized ceiling, a price with no total or one its quotes do not add up to, a merkle plan this build cannot pay: each is a
     refusal{code} the surface can say in plain words. a price is never invented here.
   - approve is for the EXACT quoted total, never unlimited (evmlib itself approves U256::MAX, wallet.rs:188 — not here).
   - contract addresses are read from upstream evmlib at a pinned tag, file:line below. the door names none,
     and nothing a server answers can move them.
   - transaction hashes are persisted BEFORE finalize, and they are indexed BY QUOTE HASH. a
     paid-but-unfinalized upload resumes; it never pays twice.
     THE IDENTITY OF A PAYMENT IS THE QUOTE HASH, NOT THE upload_id. the door's own README says
     identical bytes re-prepare to the same quote HASHES (:62-63); it says nothing of the kind about
     upload_id. keying the guard on upload_id therefore paid the same quotes twice, demonstrated:
     pay under up-1, re-prepare the same bytes, pay under up-2 -> a second payForQuotes with no
     refusal, and resume() meanwhile reported 'nothing-to-resume' about a payment that existed, so
     the only move left charged again. both halves are keyed on the quote set now.
     BOUNDARY, stated rather than assumed: what the door does with a tx_hash minted under a
     DIFFERENT upload_id is not established here. if it refuses, the person gets
     paid-not-finalized with their hashes — visible, recoverable, and not a second signature.
     a second real payment is silent and permanent, so the refusal is the correct direction.
   - wire facts are cited: selectors and tuple order are held to a real Arbitrum One transaction in
     e2e/ant-pay-vector.json (PaymentVaultV2.payForQuotes, verified source on Blockscout), and the tuple order
     to evmlib contracts/Types.sol:33-37 (rewardsAddress, amount, quoteHash). */
(function (root) {
  'use strict';
  /* evmlib v0.9.1 = fbf879b1f7068b5b072a936589721272c62f2ca0, the version ant-client ant-cli-v0.3.7 (785a155c)
     locks — the same pin the door cites. src/lib.rs:64-65 the token, :71-72 the vault, :52-53 the public RPC,
     src/contract/payment_vault/mod.rs:11 the per-call ceiling. */
  var CHAIN_ID = 42161, CHAIN_HEX = '0xa4b1', MAX_PER_TX = 256;
  var CONTRACTS = Object.freeze({ token: '0xa78d8321B20c4Ef90eCd72f2588AA985A4BDb684', vault: '0x9A3EcAc693b699Fc0B2B6A50B5549e50c2320A26' });
  var PUBLIC_RPC = 'https://arb1.arbitrum.io/rpc';
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
    var fetchFn = cfg.fetch || (root.fetch && root.fetch.bind(root)), door = String(cfg.door || '').replace(/\/$/, '');
    var rpc = cfg.rpcCall || rpcOf(fetchFn, cfg.rpc || PUBLIC_RPC), now = cfg.now || function () { return Date.now(); };
    var sleep = cfg.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var store = cfg.store || { get: function () { return null; }, set: function () {} }, tell = cfg.onState || function () {};
    var KEY = function (id) { return 'ant-pay.paid.' + id; };
    /* one key per quote this device has paid, beside the upload record. Per-quote rather than one
       index blob so a crash mid-write leaves a consistent subset instead of losing the lot; the
       cost, named: an N-chunk upload writes N keys. */
    var QKEY = function (h) { return 'ant-pay.paid.quote.' + String(h).toLowerCase(); };
    function paidFor(quoteHash) {
      var raw = store.get(QKEY(quoteHash)); if (!raw) return null;
      /* an entry that is present and unreadable is REFUSED BY NAME, never guessed. Guessing 'unpaid'
         spends real ANT a second time — silent and permanent; refusing is visible and recoverable.
         An instrument that cannot read its own record says so; it does not answer in the expensive
         direction. Absent is a different answer from unreadable, and only absent means 'not paid'. */
      var ptr = null; try { ptr = JSON.parse(raw); } catch (e) { ptr = null; }
      if (!ptr || !ptr.upload_id || !isH32(ptr.tx_hash))
        throw refusal('unreadable-record', 'this device kept a payment record for one of these quotes and cannot read it back, so it cannot say whether that quote is already paid. nothing was signed. clear this site’s stored data and ask for the price again', { key: QKEY(quoteHash), quote: quoteHash });
      return ptr;
    }
    function markPaid(uploadId, txHashes) {
      Object.keys(txHashes).forEach(function (h) { store.set(QKEY(h), JSON.stringify({ upload_id: uploadId, tx_hash: txHashes[h] })); });
    }
    /* THE CHAIN REFUSED IT, SO NOTHING MOVED. The index entries are written BEFORE the wait —
       deliberately, so a crash keeps what did leave the wallet — and until now nothing cleared
       them when the receipt came back 0x0. The quotes then read paid-forever on a device that
       spent no ANT: pay() answered already-paid, resume() answered tx-reverted, two refusals
       pointing at each other. Before this file kept an index a re-prepare simply signed again;
       closing that route is what makes the clear owed.
       BOTH HALVES IN ONE PLACE, because charge() unwound the upload record and resume() did not:
       one chain verdict answered with two different sentences depending on which upload_id the
       person happened to be holding, and the function whose own index no longer believed in the
       payment went on re-announcing it forever. Only entries naming THIS hash are cleared, so a
       batch that did land keeps its own. The record is emptied outright when no hash is left, so
       resume says 'no payment is waiting on this price' rather than 'it belongs to a different
       plan'. On the by-quote path the record that was READ belongs to another upload, so the id
       it was read under is the id rewritten — not this prepare's; a finalized one is left whole,
       for the reason given at the line below.
       '' reads back as absent through paidFor, and absent is the true answer once the chain has
       said nothing moved. EVERY WRITE IS ATTEMPTED ON ITS OWN — a store that refuses one key must
       not leave the rest naming a refused transaction — and the return says WHICH HALF of them did
       not land, the index or the record, because the two strand a person differently and one answer
       for both was false in one of them. A denied store must not replace 'tx-reverted' with a
       storage error: the chain's verdict is what the person acts on and the stale entry is the
       lesser harm. But a repair that could not validate its own output owes that fact to the reader,
       which is what reverted() adds; without it the next attempt meets a refusal with nothing in
       this file saying why. */
    /* READ THE CLEAR BACK; 'landed' IS NOT THE ABSENCE OF A THROW. The one store that ships —
       surfaces/myspace.js:382-385 payStore — CATCHES its own denial, so on the page this sentence
       was written for a clear that never happened raises nothing at all. Measured on the two
       adapters with nothing else changed: identical stranded state, both answering already-paid,
       and the second half of the refusal in the THROWING one alone. The instrument is one line from
       the repair. Each key is asked the READER'S OWN QUESTION rather than compared byte for byte —
       paidFor() calls an entry absent when it reads falsy, and the record's only question is whether
       it still names the refused hash — so a store that answers '' as null is not reported as a
       failure it did not have. A read that itself throws is not a clear either — and that catch has
       NO ARM, for a reason worth writing down rather than arming around. MEASURED on two adapters
       with nothing else changed: a RAW store whose get throws refuses at readPlan — refusal
       wallet-declined "storage denied", ZERO payment sends — so nothing is signed and this line is
       never reached; the store that SHIPS catches its own read too (myspace.js:382, `get` returns
       null on a denial), so no throw from a read reaches this file at all. The direction is the
       fail-closed one and is kept; what it guards is a store this estate does not have. The
       adapter's null is its line and not this one, and it points the other way — a read that could
       not happen arrives here as 'absent', which reads as CLEARED. Reaching that needs a store which
       denies reads after accepting writes; it is constructible in a rig and I cannot point at one. */
    function entryGone(key) { try { return !store.get(key); } catch (e) { return false; } }
    function recordGone(key, hash) {
      var raw; try { raw = store.get(key); } catch (e) { return false; }
      if (!raw) return true;
      var r = null; try { r = JSON.parse(raw); } catch (e) { return false; }
      var m = (r && r.txHashes) || {};
      return !Object.keys(m).some(function (h) { return m[h] === hash; });
    }
    function unwind(hash, covered, recordId, record) {
      /* TWO HALVES, REPORTED APART. They fail with OPPOSITE symptoms and one boolean could not say
         which, so the sentence built on it was true of one of them and false of the other. */
      var stale = { index: false, record: false };
      covered.forEach(function (x) {
        if (x.tx_hash !== hash) return;
        try { store.set(QKEY(x.quote_hash), ''); } catch (e) { stale.index = true; }
        if (!entryGone(QKEY(x.quote_hash))) stale.index = true;
      });
      /* A FINALIZED record is LEFT WHOLE. It is the door's own answer — the data is stored and the
         address is the door's, not ours to withdraw because the chain later refused one of the
         transactions that paid for it — and its only reader is the receipt lookup in resume(). The
         index above is cleared either way, so nothing is paid twice and nothing is skipped. An
         UNFINALIZED record is what a recovery reads, so that one must stop naming the refused hash. */
      if (record.finalized) return stale;
      Object.keys(record.txHashes).forEach(function (h) { if (record.txHashes[h] === hash) delete record.txHashes[h]; });
      var left = Object.keys(record.txHashes).length;
      try { store.set(KEY(recordId), left ? JSON.stringify(record) : ''); } catch (e) { stale.record = true; }
      if (!recordGone(KEY(recordId), hash)) stale.record = true;
      return stale;
    }
    /* THE CHAIN'S VERDICT IS NEVER REPLACED, ONLY EXTENDED — BY WHICHEVER HALF DID NOT LAND. One
       boolean carried one sentence, and that sentence named a symptom that happens in only one of
       the two halves. Measured on one device, 300 quotes, the second batch refused by the chain,
       the denial SWALLOWED as the one adapter that ships swallows it:
         the INDEX clears refused   -> re-prepare and pay answers ALREADY-PAID with zero signatures,
            and resume answers tx-reverted: the two refusals point at each other and nothing but
            clearing this site's data opens it. The 'already paid' sentence is exactly true here.
         the RECORD rewrite refused -> the index is clean, so re-prepare and pay SIGNS and resolves.
            Nobody is ever told 'already paid'. What goes on is resume(), re-announcing a
            transaction that moved nothing — and the sentence did not mention resume at all.
       So the reader of a record failure was handed a prediction that does not come true, about a
       function that is not the one biting them. A fail-closed path owes a TRUE reason, and both
       read-backs already know which half failed.
       HOW LOUD THE SECOND CLAUSE SHOULD BE IS A PROPERTY OF THE STORE, AND THIS FILE CANNOT TELL.
       Under a ONE-SHOT denial the stranded record REPAIRS ITSELF on the next resume(), which unwinds
       what it watched revert: measured tx-reverted then nothing-to-resume, the record dropping from
       300 hashes to 256. Under a PERSISTENT one it does not: tx-reverted, tx-reverted, the record
       still at 300. The clause is written for the persistent case, because that is the one that does
       not end; on a store that denies once it is a warning about a state already gone. Naming both
       rather than picking one — a claim measured on a one-shot rig is a property of the rig. */
    function reverted(e, stale) {
      if (stale.index) e.message += '. this device could not clear its own record of that payment, so it may still answer “already paid” for these quotes — clear this site’s stored data before asking for the price again';
      if (stale.record) e.message += '. this device could not clear the payment it had kept for this upload, so asking to RESUME this upload will go on naming that refused transaction — ask for the price again rather than resuming it';
      return e;
    }

    /* a door refusal is {"error": "<name>"}; the name rides on the refusal so the surface can say which law held. */
    function doorJSON(path, body) {
      return fetchFn(door + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) {
          if (r.ok) return r.json();
          return r.text().then(function (t) {
            var name = null; try { name = JSON.parse(t).error || null; } catch (e) { /* a body that is not the door's JSON keeps name null */ }
            throw refusal(r.status >= 500 ? 'network' : 'door-refused', 'the door answered HTTP ' + r.status + (t ? ' — ' + t.slice(0, 200) : ''), { status: r.status, door: name });
          });
        });
    }
    function readPlan(prepare, authorization) {
      if (!prepare || !prepare.upload_id) throw refusal('no-quote', 'there is no price yet — ask Autonomi first');
      /* the arm is the door's, and it is never switched here: a merkle price is refused, not paid as a wave. */
      if (prepare.payment_type !== 'wave_batch') throw refusal('merkle-not-built', 'this upload is priced as a ' + prepare.payment_type + ' plan, which this build cannot pay yet');
      if (typeof prepare.total_atto !== 'string' || !/^\d+$/.test(prepare.total_atto)) throw refusal('no-total', 'the price names no total to check its parts against, so this page will not pay it');
      var all = Array.isArray(prepare.quotes) ? prepare.quotes : [];
      if (!all.length) throw refusal('no-quote', 'the price carries no quotes');
      var seen = {}, total = 0n;
      all.forEach(function (p) {
        if (!isH32(p.quote_hash) || !isAddr(p.rewards_address)) throw refusal('bad-plan', 'a payment is malformed');
        if (seen[p.quote_hash.toLowerCase()]) throw refusal('bad-plan', 'a quote appears twice'); seen[p.quote_hash.toLowerCase()] = 1;
        total += big(p.amount_atto, 'a payment');
      });
      if (big(prepare.total_atto, 'the total') !== total) throw refusal('quote-sum', 'the quotes do not add up to the quoted total');
      if (!authorization || authorization.state !== 'authorized-for-signing') throw refusal('not-authorized', 'this price has not been authorized for signing');
      if (authorization.upload_id !== prepare.upload_id) throw refusal('not-authorized', 'the authorization is for a different price');
      var ceiling = big(authorization.ant_ceiling_atto, 'the ceiling');
      if (total > ceiling) throw refusal('over-ceiling', 'the price is above the ceiling you authorized', { total: total.toString(), ceiling: ceiling.toString() });
      /* priced = every quote that costs anything, in the door's own order — finalize owes a tx for
         each of them. owed = the priced quotes this device has NOT already paid; settled = the rest,
         with the hash that paid them. A quote already paid is not paid again, by KEY and not by id. */
      var priced = all.filter(function (p) { return BigInt(p.amount_atto) > 0n; });
      var owed = [], settled = {}, owedTotal = 0n;
      priced.forEach(function (p) {
        var kept = paidFor(p.quote_hash);
        if (kept) { settled[p.quote_hash] = kept.tx_hash; return; }
        owed.push(p); owedTotal += big(p.amount_atto, 'a payment');
      });
      var batches = [];
      for (var i = 0; i < owed.length; i += MAX_PER_TX) batches.push(owed.slice(i, i + MAX_PER_TX));
      return { total: total, owedTotal: owedTotal, priced: priced, owed: owed, settled: settled, settledCount: Object.keys(settled).length, batches: batches };
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
    /* one entry per quote that costs anything — the door's finalize refuses a paid quote left out (missing_quote_tx). */
    function pairs(plan, txHashes) {
      var m = {};
      Object.keys(plan.settled).forEach(function (h) { m[h] = plan.settled[h]; });
      Object.keys(txHashes).forEach(function (h) { m[h] = txHashes[h]; });
      return plan.priced.map(function (p) { return { quote_hash: p.quote_hash, tx_hash: m[p.quote_hash] }; });
    }
    function finalize(prepare, txHashes, plan, payer, started) {
      tell({ phase: 'finalizing', upload_id: prepare.upload_id });
      var txs = pairs(plan, txHashes);
      return doorJSON('/ant/v1/upload/finalize', { upload_id: prepare.upload_id, txs: txs }).then(function (f) {
        if (!f || strip(f.data_map_address || '') !== strip(prepare.data_map_address || '') || !strip(f.data_map_address || ''))
          throw refusal('address-mismatch', 'the door confirmed an address that is not the one it quoted. the payment is on chain; keep these payment ids', { txs: txs });
        /* chunks_quoted, not chunks: it is copied from PREPARE, an input, and the door's finalize
           answers {data_map_address} and nothing else (README.md:13) — there is no stored count to
           report, so this page will not print one. A field sitting among txs/payer/finished_at that
           reads as an outcome and is an input is the false-signal class, and no gate reads a receipt. */
        var receipt = { address: f.data_map_address, chunks_quoted: prepare.chunks && prepare.chunks.total != null ? prepare.chunks.total : null,
          quotes_paid: plan.priced.length, quotes_already_paid: plan.settledCount, ant_atto: plan.total.toString(), ant_paid_now_atto: plan.owedTotal.toString(),
          payer: payer, txs: txs, seconds: Math.round((now() - started) / 1000), finished_at: new Date(now()).toISOString() };
        store.set(KEY(prepare.upload_id), JSON.stringify({ txHashes: txHashes, finalized: true, receipt: receipt }));
        markPaid(prepare.upload_id, txHashes);
        tell({ phase: 'done', receipt: receipt }); return receipt;
      }, function (e) {
        throw refusal('paid-not-finalized', 'the payment is on chain but the upload did not finish: ' + e.message + '. nothing is lost — ask for the price again so the door recovers this plan, then resume; you will not be charged twice', { txs: txs, door: e.detail && e.detail.door });
      });
    }
    function refused(e, fallback) { if (!e.refusal) e = refusal(fallback, String(e && e.message || e).slice(0, 200)); tell({ phase: 'refused', code: e.refusal, message: e.message, detail: e.detail }); throw e; }

    /* the chain half only: read, show, sign, wait. the hashes are kept before this returns. */
    function charge(input) {
      var started = now(), prepare = input && input.prepare, plan, c = CONTRACTS, payer, signer = cfg.signer, txHashes = {};
      return Promise.resolve().then(function () {
        plan = readPlan(prepare, input.authorization);
        /* keyed on the quote set, so a re-prepare of the same bytes under a new upload_id lands
           here too. A PARTIAL overlap is not refused: the unpaid quotes are paid and the kept
           hashes ride along into finalize, which is what a crash between batches leaves behind. */
        if (!plan.owed.length && plan.settledCount) throw refusal('already-paid', 'every quote in this price was already paid from this device — resume it instead of paying again');
        if (!signer) throw refusal('no-wallet', 'no wallet is connected to this page');
        return signer.address();
      }).then(function (a) {
        payer = a;
        return Promise.all([rpc('eth_call', [{ to: c.token, data: SEL.balanceOf + pad32(a) }, 'latest']), rpc('eth_getBalance', [a, 'latest']), rpc('eth_call', [{ to: c.token, data: SEL.allowance + pad32(a) + pad32(c.vault) }, 'latest'])]);
      }).then(function (v) {
        var ant = big(v[0]), eth = big(v[1]), allowance = big(v[2]);
        /* the wallet is asked for what it is about to SPEND, which is the unpaid remainder. The
           CEILING above is still judged on the whole quoted total, because that is the number the
           person authorized. */
        if (ant < plan.owedTotal) throw refusal('short-ant', 'this wallet holds less ANT than the price', { have: ant.toString(), need: plan.owedTotal.toString() });
        if (eth === 0n) throw refusal('no-gas', 'this wallet holds no ETH on Arbitrum One to pay the network fee');
        var needApprove = allowance < plan.owedTotal;
        var shown = { signer: signer.name, payer: payer, token: c.token, spender: c.vault, ant_total_atto: plan.owedTotal.toString(), approve_exact_atto: needApprove ? plan.owedTotal.toString() : null,
          quotes: plan.owed.length, quotes_already_paid: plan.settledCount, payment_calls: plan.batches.length, wallet_confirmations: (needApprove ? 1 : 0) + plan.batches.length, upload_id: prepare.upload_id };
        tell({ phase: 'plan', plan: shown });
        if (typeof input.confirmPlan !== 'function') throw refusal('not-confirmed', 'the surface offered no button to confirm this plan');
        return Promise.resolve(input.confirmPlan(shown)).then(function (yes) {
          if (yes !== true) throw refusal('not-confirmed', 'you did not confirm — nothing was signed, nothing was paid');
          if (!needApprove) return null;
          tell({ phase: 'signing', what: 'approve', of: shown.wallet_confirmations, n: 1 });
          return signer.send({ to: c.token, data: encodeApprove(c.vault, plan.owedTotal) }).then(function (h) { if (!isH32(h)) throw refusal('wallet-declined', 'the wallet returned no transaction hash'); return waitFor(h, 'approve', input.signal); });
        }).then(function () {
          return plan.batches.reduce(function (chain, batch, i) {
            return chain.then(function () {
              tell({ phase: 'signing', what: 'payment', of: shown.wallet_confirmations, n: (needApprove ? 2 : 1) + i });
              return signer.send({ to: c.vault, data: encodePayForQuotes(batch) });
            }).then(function (h) {
              if (!isH32(h)) throw refusal('wallet-declined', 'the wallet returned no transaction hash');
              batch.forEach(function (p) { txHashes[p.quote_hash] = h; });
              /* ISOLATED, not ordered. Ordering cannot make two effects survive each other — it
                 only chooses which one dies. Under the writes, a throwing store swallowed the one
                 line naming what left the wallet; above them, a throwing renderer destroyed the
                 record that stands between this page and a second real payment. Losing a status
                 line costs a line; losing the record costs another signature. This is the only
                 tell between the wallet signing and the record being written: 'plan'/'signing'
                 come before anything is sent, and 'waiting'/'finalizing'/'done'/'refused' come
                 after both writes. */
              try { tell({ phase: 'sent', what: 'payment', tx: h }); } catch (e) { /* the surface's own rendering is not this page's payment */ }
              store.set(KEY(prepare.upload_id), JSON.stringify({ txHashes: txHashes, finalized: false })); /* BEFORE finalize, before the wait */
              markPaid(prepare.upload_id, txHashes); /* the per-quote index, written in the same breath as the upload record */
              return waitFor(h, 'payment', input.signal).catch(function (e) {
                if (e && e.refusal === 'tx-reverted')
                  throw reverted(e, unwind(h, batch.map(function (p) { return { quote_hash: p.quote_hash, tx_hash: txHashes[p.quote_hash] }; }), prepare.upload_id, { txHashes: txHashes, finalized: false }));
                throw e;
              });
            });
          }, Promise.resolve());
        });
      }).then(function () { return { prepare: prepare, plan: plan, payer: payer, txHashes: txHashes, started: started }; });
    }
    /* pay on chain and hand the per-quote pairs back: for a surface whose own door adapter finalizes. */
    function settle(input) {
      return charge(input).then(function (r) { var txs = pairs(r.plan, r.txHashes); tell({ phase: 'paid', upload_id: r.prepare.upload_id, txs: txs }); return txs; })
        .catch(function (e) { return refused(e, 'wallet-declined'); });
    }
    /* pay on chain, then finalize at the door. */
    function pay(input) {
      return charge(input).then(function (r) { return finalize(r.prepare, r.txHashes, r.plan, r.payer, r.started); })
        .catch(function (e) { return refused(e, 'wallet-declined'); });
    }
    /* a paid upload that did not finish: confirm the kept hashes on chain, then finalize. never signs, never pays. */
    function resume(input) {
      var started = now(), prepare = input && input.prepare, kept, keptId = prepare && prepare.upload_id;
      return Promise.resolve().then(function () {
        var raw = prepare && store.get(KEY(prepare.upload_id));
        if (!raw && prepare) {
          /* the same bytes re-prepared under a new upload_id: the kept payment is found by its
             QUOTES. Without this, resume told the person a payment that exists does not exist, and
             the only move left — pay() — charged them a second time. */
          var byQuote = null;
          (Array.isArray(prepare.quotes) ? prepare.quotes : []).some(function (p) { var k = paidFor(p.quote_hash); if (k) { byQuote = k.upload_id; return true; } return false; });
          /* the id the record is READ under, remembered here because it is the id that has to be
             rewritten if the chain refuses one of these hashes. On this path it is not this
             prepare's, and writing under this prepare's would leave the refused transaction named
             in the record it actually came from while minting an empty one for an upload that never
             held a payment. */
          if (byQuote) { raw = store.get(KEY(byQuote)); keptId = byQuote; }
        }
        if (!raw) throw refusal('nothing-to-resume', 'no payment from this device is waiting on this price');
        kept = JSON.parse(raw);
        var plan = readPlan(prepare, input.authorization);
        /* coverage is judged over the MERGED map — literally the body finalize would send. Asking
           kept.txHashes alone reads THIS upload's hashes only, so after a partial recovery (a crash
           between batches, then a re-prepare) it saw 44 of 300 and refused a payment the device was
           holding the other 256 of, while pay() said already-paid: two refusals pointing at each
           other with real ANT on chain. PRICED, not owed: owed excludes what the index says is paid,
           so asking it here would be vacuously empty and this row would assert nothing. */
        var covered = pairs(plan, kept.txHashes);
        if (covered.some(function (x) { return !x.tx_hash; })) throw refusal('nothing-to-resume', 'the kept payment does not cover this price — it belongs to a different plan');
        /* only THIS upload's receipt is handed back. On the by-quote path `kept` can belong to a
           different upload that shares these quotes, and its receipt names a different address —
           the person asked about one file and would be told another one is done. When it is not
           ours, fall through and let the door finalize this upload; nothing is signed either way. */
        if (kept.finalized && strip(prepare.data_map_address || '') && strip(kept.receipt && kept.receipt.address || '') === strip(prepare.data_map_address || '')) return kept.receipt;
        var hashes = covered.map(function (x) { return x.tx_hash; }).filter(function (h, i, a) { return a.indexOf(h) === i; });
        return hashes.reduce(function (ch, h) { return ch.then(function () { return waitFor(h, 'payment', input.signal).catch(function (e) { if (e && e.refusal === 'tx-reverted') throw reverted(e, unwind(h, covered, keptId, kept)); throw e; }); }); }, Promise.resolve())
          .then(function () { return finalize(prepare, kept.txHashes, plan, null, started); });
      }).catch(function (e) { return refused(e, 'network'); });
    }
    return { pay: pay, settle: settle, resume: resume };
  }

  var api = { create: create, injectedSigner: injectedSigner, trezorSigner: trezorSigner, loadTrezorConnect: loadTrezorConnect, CHAIN_ID: CHAIN_ID, CONTRACTS: CONTRACTS,
    _wire: { encodeApprove: encodeApprove, encodePayForQuotes: encodePayForQuotes, rlp: rlp, serialize1559: serialize1559, SEL: SEL } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window === 'object') root.AntPay = api;
})(typeof window === 'object' ? window : globalThis);
