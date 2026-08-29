/* ─── LICENSE ──────────────────────────────────────────────────────────────
   SPDX-License-Identifier: Apache-2.0
   Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
   Licensed under the Apache License, Version 2.0 (the "License"); you
   may not use this file except in compliance with the License. You may
   obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
   See /LICENSE and /NOTICE in this repository. Applies to the rails:
   the wallet surface, the rail adapters, the Arweave signer.
   ─────────────────────────────────────────────────────────────────────── */
/* surfaces/arweave.js — the Arweave adapter for the BNR wallet shell.
   First-party, no bundler (Turbo/ArDrive ruled out by founder order): a
   format-2 data transaction built and signed in the browser with WebCrypto
   only. Serialization mirrors arweave-js exactly (deepHash SHA-384, 32-byte
   big-endian merkle notes, RSASSA-PKCS1-v1_5-SHA256 over the v2 signature
   data, id = sha256(signature)); the live node is the oracle that proved it.
   Gateway rotation reuses the Base-adapter pattern: the first choice per
   call is UNIFORMLY RANDOM across public gateways — no single operator learns
   which IPs are about to anchor what. Keys NEVER live here: the JWK is held
   by the vault (BNRVAULT) and only handed to sign(). */
(function () {
  'use strict';

  var GATEWAYS = [ // PUBLIC-CONSTANT: public Arweave gateways, CORS-open, fee-bearing
    'https://arweave.net',
    'https://ar-io.dev',
    'https://gateway.ardrive.io'
  ];

  /* ── encodings ────────────────────────────────────────────────────────── */
  var B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64u(bytes) {
    var s = '', i;
    for (i = 0; i < bytes.length; i += 3) {
      var b = [bytes[i], i + 1 < bytes.length ? bytes[i + 1] : NaN, i + 2 < bytes.length ? bytes[i + 2] : NaN];
      s += B64U[b[0] >> 2];
      s += B64U[((b[0] & 3) << 4) | (isNaN(b[1]) ? 0 : b[1] >> 4)];
      s += isNaN(b[1]) ? '' : B64U[((b[1] & 15) << 2) | (isNaN(b[2]) ? 0 : b[2] >> 6)];
      s += isNaN(b[2]) ? '' : B64U[b[2] & 63];
    }
    return s;
  }
  function unb64u(s) {
    s = String(s || '').replace(/=+$/, '');
    var out = [], i, buf = 0, bits = 0;
    for (i = 0; i < s.length; i++) {
      var v = B64U.indexOf(s[i]);
      if (v < 0) throw new Error('bad base64url character');
      buf = (buf << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
    }
    return new Uint8Array(out);
  }
  function str(s) { return new TextEncoder().encode(String(s)); }
  function cat(arrs) {
    var n = 0, i;
    for (i = 0; i < arrs.length; i++) n += arrs[i].length;
    var out = new Uint8Array(n), o = 0;
    for (i = 0; i < arrs.length; i++) { out.set(arrs[i], o); o += arrs[i].length; }
    return out;
  }
  function be32(n) { // arweave merkle "note": 32-byte big-endian
    var b = new Uint8Array(32);
    for (var i = 31; i >= 0; i--) { b[i] = n % 256; n = (n - b[i]) / 256; }
    return b;
  }

  /* ── hashes (WebCrypto) ──────────────────────────────────────────────── */
  var subtle = (self.crypto || {}).subtle;
  function H(alg, bytes) {
    return subtle.digest(alg, bytes).then(function (d) { return new Uint8Array(d); });
  }
  function sha256(b) { return H('SHA-256', b); }
  function sha384(b) { return H('SHA-384', b); }

  /* ── arweave deepHash ──────────────────────────────────────────────────
     blob: sha384( sha384("blob"+len) || sha384(data) )
     list: acc = sha384("list"+len); acc = sha384(acc || deepHash(item))…    */
  async function deepHash(data) {
    if (Array.isArray(data)) {
      var acc = await sha384(cat([str('list'), str(String(data.length))]));
      for (var i = 0; i < data.length; i++) {
        acc = await sha384(cat([acc, await deepHash(data[i])]));
      }
      return acc;
    }
    var tag = await sha384(cat([str('blob'), str(String(data.length))]));
    return sha384(cat([tag, await sha384(data)]));
  }

  /* ── data_root for a single-chunk payload (<= 256 KiB) ─────────────────
     one chunk → root = leaf id = sha256( sha256(sha256(data)) || sha256(be32(len)) ).
     NOTE: the merkle tree is SHA-256 (arweave-js hash() default, HASH_SIZE=32,
     matching the node's ar_merkle.erl) — SHA-384 belongs to deepHash ONLY.
     Larger payloads need the chunked-upload lane — deliberately NOT built
     here; the adapter refuses loudly instead of guessing.                    */
  var MAX_INLINE = 256 * 1024;
  async function chunkRoot(data) {
    if (data.length === 0) return new Uint8Array(0);
    if (data.length > MAX_INLINE) throw new Error('payload over 256 KiB needs the chunked-upload lane (not built)');
    var dataHash = await sha256(data);
    return sha256(cat([await sha256(dataHash), await sha256(be32(data.length))]));
  }

  /* ── keys ─────────────────────────────────────────────────────────────── */
  function jwkOwner(jwk) { return unb64u(jwk.n); }
  async function addressOf(jwkOrAddress) {
    if (typeof jwkOrAddress === 'string' && jwkOrAddress.length === 43) return jwkOrAddress;
    return b64u(await sha256(jwkOwner(jwkOrAddress)));
  }
  function importSigner(jwk) {
    var k = {};
    ['kty', 'n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'].forEach(function (f) { if (jwk[f] != null) k[f] = jwk[f]; });
    k.kty = 'RSA';
    // Arweave signs RSA-PSS / SHA-256 / saltLength 32 (arweave-js webcrypto-driver)
    return subtle.importKey('jwk', k,
      { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['sign']);
  }

  /* ── gateway rotation (Base-adapter pattern, same privacy reasoning) ──── */
  function shuffled() {
    var o = GATEWAYS.slice();
    for (var j = o.length - 1; j > 0; j--) {
      var r = Math.floor(Math.random() * (j + 1));
      var t = o[j]; o[j] = o[r]; o[r] = t;
    }
    return o;
  }
  async function rpc(method, path, body) {
    var order = shuffled(), i = 0, lastErr = null;
    while (i < order.length) {
      var ctl = new AbortController();
      var t = setTimeout(function () { ctl.abort(); }, 9000);
      try {
        var res = await fetch(order[i++] + path, {
          method: method,
          signal: ctl.signal,
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined
        });
        clearTimeout(t);
        var text = await res.text();
        return { status: res.status, ok: res.ok, text: text };
      } catch (e) { clearTimeout(t); lastErr = e; }
    }
    throw lastErr || new Error('all gateways unreachable');
  }

  /* ── the adapter surface: balance / receiveAddress / send / publish ──── */
  async function balance(address) {
    var r = await rpc('GET', '/wallet/' + address + '/balance');
    if (!r.ok) throw new Error('balance read failed: ' + r.text.slice(0, 80));
    return r.text.replace(/"/g, ''); // winston, string
  }
  async function fee(bytes, target) {
    var r = await rpc('GET', '/price/' + bytes + (target ? ',' + target : ''));
    if (!r.ok) throw new Error('fee quote failed: ' + r.text.slice(0, 80));
    return r.text.replace(/"/g, '');
  }
  async function spotPrice() { // USD per AR — gateways first, CoinGecko keyless fallback
    try {
      var r = await rpc('GET', '/spot_price');
      var v = parseFloat(r.text.replace(/"/g, ''));
      if (r.ok && v > 0) return String(v);
    } catch (e) { /* fall through */ }
    var r2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
    if (r2.ok) {
      var j = await r2.json();
      if (j && j.arweave && j.arweave.usd) return String(j.arweave.usd);
    }
    throw new Error('no spot price source answered');
  }
  async function txAnchor() {
    var r = await rpc('GET', '/tx_anchor');
    if (!r.ok) throw new Error('tx_anchor failed');
    return r.text.replace(/"/g, '');
  }

  /* Build + sign a v2 transaction. data: Uint8Array; tags: [{name,value}]
     plaintext strings; quantity/target for AR transfers. Returns the POST
     body and the tx id. The JWK arrives from the vault and never leaves
     this call. */
  async function buildTx(jwk, data, tags, opts) {
    opts = opts || {};
    var owner = jwkOwner(jwk);
    var anchor = opts.anchor || await txAnchor();
    var reward = opts.reward || await fee(data ? data.length : 0, opts.target || '');
    var root = await chunkRoot(data);
    var tagList = [];
    for (var i = 0; i < tags.length; i++) {
      tagList.push([str(tags[i].name), str(tags[i].value)]);
    }
    var sigData = await deepHash([
      str('2'), owner, str(opts.target || ''), str(opts.quantity || '0'),
      str(reward), unb64u(anchor), tagList,
      str(String(data.length)), root
    ]);
    var key = await importSigner(jwk);
    var sig = new Uint8Array(await subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, key, sigData));
    var id = await sha256(sig);
    return {
      id: b64u(id),
      body: {
        format: 2,
        id: b64u(id),
        last_tx: anchor,
        owner: jwk.n,
        tags: tags.map(function (t) { return { name: b64u(str(t.name)), value: b64u(str(t.value)) }; }),
        target: opts.target || '',
        quantity: opts.quantity || '0',
        data: data && data.length ? b64u(data) : '',
        data_size: String(data ? data.length : 0),
        data_root: root.length ? b64u(root) : '',
        reward: reward,
        signature: b64u(sig)
      }
    };
  }

  async function postTx(body) {
    var r = await rpc('POST', '/tx', body);
    return { status: r.status, ok: r.ok, text: r.text };
  }

  async function publish(bytes, tags, jwk, opts) {
    var tx = await buildTx(jwk, bytes, tags, opts);
    var res = await postTx(tx.body);
    return { txid: tx.id, status: res.status, ok: res.ok, text: res.text };
  }

  async function send(jwk, target, winston) { // AR transfer: same proven serialization
    var tx = await buildTx(jwk, new Uint8Array(0), [], { target: target, quantity: String(winston) });
    var res = await postTx(tx.body);
    return { txid: tx.id, status: res.status, ok: res.ok, text: res.text };
  }

  /* ── the adapter-contract split (SPEC-ADAPTER-CONTRACT-1, B3) ──────────
     buildUnsigned: everything up to but NOT INCLUDING the signature — the
     worker calls this with the JWK's PUBLIC parts only ({kty,n,e}); what
     comes back is the sigData (exactly what an Arweave key signs) plus the
     unsigned wire. signRaw: the vault's half — RSA-PSS over sigData. The
     adapter never holds the private key; the vault never knows the rail. */
  async function buildUnsigned(publicJwk, data, tags, opts) {
    opts = opts || {};
    var owner = jwkOwner(publicJwk);
    var anchor = opts.anchor || await txAnchor();
    var reward = opts.reward || await fee(data ? data.length : 0, opts.target || '');
    var root = await chunkRoot(data);
    var tagList = [];
    for (var i = 0; i < tags.length; i++) tagList.push([str(tags[i].name), str(tags[i].value)]);
    var sigData = await deepHash([
      str('2'), owner, str(opts.target || ''), str(opts.quantity || '0'),
      str(reward), unb64u(anchor), tagList,
      str(String(data.length)), root
    ]);
    return {
      sigData: sigData,
      wire: {
        format: 2,
        last_tx: anchor,
        owner: publicJwk.n,
        tags: tags.map(function (t) { return { name: b64u(str(t.name)), value: b64u(str(t.value)) }; }),
        target: opts.target || '',
        quantity: opts.quantity || '0',
        data: data && data.length ? b64u(data) : '',
        data_size: String(data ? data.length : 0),
        data_root: root.length ? b64u(root) : '',
        reward: reward
      }
    };
  }
  async function signRaw(jwk, sigData) {   // the vault's half: PSS over the deepHash output
    var key = await importSigner(jwk);
    var sig = new Uint8Array(await subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, key, sigData));
    var id = await sha256(sig);
    return { signature: b64u(sig), id: b64u(id) };
  }
  async function txStatus(txid) {          // the rail read for confirm(): GET /tx/{id}
    var order = shuffled();
    for (var i = 0; i < order.length; i++) {
      try {
        var r = await fetch(order[i] + '/tx/' + encodeURIComponent(txid), { method: 'GET' });
        var text = await r.text();
        if (r.status === 200) {
          var body = null; try { body = JSON.parse(text) } catch (e) {}
          return { gateway: order[i], status: r.status, tx: body && body.status, confirmations: (body && body.confirmations) || 0 };
        }
        if (r.status === 404 || r.status === 410) return { gateway: order[i], status: r.status, tx: 'unknown' };
        if (r.status >= 400 && r.status < 500) return { gateway: order[i], status: r.status, tx: 'refused' };
      } catch (e) { /* walk */ }
    }
    return { gateway: null, status: 0, tx: 'unreachable' };
  }

  globalThis.BNRAR = {
    GATEWAYS: GATEWAYS,
    CAPABILITIES: { balance: true, receiveAddress: true, send: true, publish: true, chunked: false },
    b64u: b64u, unb64u: unb64u, deepHash: deepHash, chunkRoot: chunkRoot,
    addressOf: addressOf, balance: balance, fee: fee, spotPrice: spotPrice,
    txAnchor: txAnchor, buildTx: buildTx, publish: publish, send: send,
    buildUnsigned: buildUnsigned, signRaw: signRaw, postTx: postTx, txStatus: txStatus
  };
})();
