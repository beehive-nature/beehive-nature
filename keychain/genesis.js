/* genesis.js — the BDID-GENESIS-V1 canon in JavaScript, for the isolated keychain.

   The canon lives in crates/bzdid/src/genesis.rs (fields), dagcbor.rs (canonical encoding: map
   keys length-first then bytewise, shortest heads) and did.rs (lowercase RFC 4648 base32, no
   padding). This file reproduces those bytes; e2e/keychain-genesis.test.mjs holds it to the
   crate's frozen vector (crates/bzdid/tests/genesis_vector.rs). Changing an encoded byte is a
   v2 ceremony, never an edit. */
(function (root) {
  'use strict';
  var ALGS = { 'ed25519': 32, 'ml-dsa-65': 1952 };
  var B32 = 'abcdefghijklmnopqrstuvwxyz234567';

  function head(major, n, out) {
    var m = major << 5;
    if (n < 24) out.push(m | n);
    else if (n < 0x100) out.push(m | 24, n);
    else if (n < 0x10000) out.push(m | 25, n >>> 8, n & 0xff);
    else if (n < 0x100000000) out.push(m | 26, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
    else { var b = BigInt(n); out.push(m | 27); for (var s = 56n; s >= 0n; s -= 8n) out.push(Number((b >> s) & 0xffn)); }
  }
  function utf8(s) { return Array.from(new TextEncoder().encode(s)); }
  /* values: {uint}, Uint8Array, string, Array, {map:[[key,value]...]} */
  function enc(v, out) {
    if (v instanceof Uint8Array) { head(2, v.length, out); for (var i = 0; i < v.length; i++) out.push(v[i]); return; }
    if (typeof v === 'string') { var b = utf8(v); head(3, b.length, out); out.push.apply(out, b); return; }
    if (Array.isArray(v)) { head(4, v.length, out); v.forEach(function (x) { enc(x, out); }); return; }
    if (v && typeof v.uint === 'number') { head(0, v.uint, out); return; }
    if (v && Array.isArray(v.map)) {
      var es = v.map.slice().sort(function (a, b) {
        var ka = utf8(a[0]), kb = utf8(b[0]);
        if (ka.length !== kb.length) return ka.length - kb.length;
        for (var j = 0; j < ka.length; j++) if (ka[j] !== kb[j]) return ka[j] - kb[j];
        return 0;
      });
      head(5, es.length, out);
      es.forEach(function (e) { enc(e[0], out); enc(e[1], out); });
      return;
    }
    throw new Error('genesis: unencodable value');
  }
  function card(c) {
    if (!c || !(c.alg in ALGS) || !(c.key instanceof Uint8Array) || c.key.length !== ALGS[c.alg]) throw new Error('genesis: a key card is {alg: ed25519|ml-dsa-65, key: bytes of that length}');
    return { map: [['alg', c.alg], ['key', c.key]] };
  }
  function strings(a, what) {
    if (!Array.isArray(a) || a.length > 16 || a.some(function (s) { return typeof s !== 'string' || utf8(s).length > 256; })) throw new Error('genesis: ' + what + ' is 0..16 strings of at most 256 bytes');
    return a.slice();
  }
  function build(op) {
    var keys = op.rotationKeys;
    if (!Array.isArray(keys) || keys.length < 1 || keys.length > 8) throw new Error('genesis: 1..8 rotation keys');
    var seen = {};
    keys.forEach(function (k) { var id = k.alg + ':' + Array.from(k.key).join(','); if (seen[id]) throw new Error('genesis: duplicate rotation key'); seen[id] = 1; });
    if (!Number.isSafeInteger(op.validUntil) || op.validUntil <= 0) throw new Error('genesis: validUntil is nonzero unix seconds');
    var out = [];
    enc({ map: [
      ['type', 'b:genesis'],
      ['rotationKeys', keys.map(card)],
      ['signingKey', card(op.signingKey)],
      ['services', strings(op.services || [], 'services')],
      ['alsoKnownAs', strings(op.alsoKnownAs || [], 'alsoKnownAs')],
      ['validUntil', { uint: op.validUntil }]
    ] }, out);
    return new Uint8Array(out);
  }
  function base32(bytes) {
    var out = '', acc = 0, bits = 0;
    for (var i = 0; i < bytes.length; i++) {
      acc = ((acc << 8) | bytes[i]) & 0xffff; bits += 8;
      while (bits >= 5) { bits -= 5; out += B32[(acc >>> bits) & 31]; }
    }
    if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
    return out;
  }
  /* sha256: (Uint8Array) => Uint8Array(32), supplied by the caller (noble in the keychain, node:crypto in tests) */
  function didOf(bytes, sha256) { return 'did:b:' + base32(sha256(bytes)); }

  var api = { build: build, didOf: didOf, base32: base32 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BZGENESIS = api;
})(typeof window === 'object' ? window : globalThis);
