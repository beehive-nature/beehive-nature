/* ans104.js — an ANS-104 data item, signed ed25519 in the page, no library.
   The member's own ed25519 key is the item OWNER (signature type 2, the
   Solana shape the Turbo service accepts), so the key road of POINTER LAW
   holds without any estate seat: owners: search finds it by the key alone.
   Free tier: Turbo takes items ≤ 107,520 B at no charge (read live from
   https://upload.ardrive.io/ 2026-09-26: freeUploadLimitBytes).

   Verified against @dha-team/arbundles in e2e/ans104.test.mjs: the bytes this
   file builds parse as a valid, signature-true DataItem there, and the id
   matches. Runs in the browser (WebCrypto Ed25519 + SHA-384) and in node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ANS104 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var subtle = (typeof crypto !== 'undefined' && crypto.subtle) || (typeof require === 'function' && require('node:crypto').webcrypto.subtle);
  var te = new TextEncoder();
  var UPLOAD = 'https://upload.ardrive.io/v1/tx';
  var FREE_LIMIT = 107520;

  function concat(parts) { var n = 0; parts.forEach(function (p) { n += p.length; }); var out = new Uint8Array(n), o = 0; parts.forEach(function (p) { out.set(p, o); o += p.length; }); return out; }
  async function sha384(b) { return new Uint8Array(await subtle.digest('SHA-384', b)); }
  async function sha256(b) { return new Uint8Array(await subtle.digest('SHA-256', b)); }
  function b64url(b) { var s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromB64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var bin = atob(s), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function hex(b) { return Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }

  /* arweave's deepHash: blobs are tagged "blob"+len, lists "list"+len, SHA-384 throughout */
  async function deepHash(x) {
    if (Array.isArray(x)) {
      var acc = await sha384(concat([te.encode('list'), te.encode(String(x.length))]));
      for (var i = 0; i < x.length; i++) acc = await sha384(concat([acc, await deepHash(x[i])]));
      return acc;
    }
    var tag = concat([te.encode('blob'), te.encode(String(x.length))]);
    return sha384(concat([await sha384(tag), await sha384(x)]));
  }

  /* avro zigzag varint + the tags array schema arbundles uses */
  function zz(n) { var v = (n << 1) ^ (n >> 31); var out = []; while (v & ~0x7f) { out.push((v & 0x7f) | 0x80); v >>>= 7; } out.push(v); return Uint8Array.from(out); }
  function avroString(s) { var b = te.encode(s); return concat([zz(b.length), b]); }
  function serializeTags(tags) {
    if (!tags.length) return new Uint8Array(0);
    var parts = [zz(tags.length)];
    tags.forEach(function (t) { parts.push(avroString(t.name)); parts.push(avroString(t.value)); });
    parts.push(Uint8Array.from([0]));
    return concat(parts);
  }
  function le(n, bytes) { var out = new Uint8Array(bytes); for (var i = 0; i < bytes; i++) { out[i] = n & 0xff; n = Math.floor(n / 256); } return out; }

  /* build + sign. key = {privateKey (CryptoKey, Ed25519, sign), publicRaw (32 B)} */
  async function sign(key, data, tags) {
    tags = tags || [];
    var tagBytes = serializeTags(tags);
    var owner = key.publicRaw;
    var msg = await deepHash([te.encode('dataitem'), te.encode('1'), te.encode('2'), owner, new Uint8Array(0), new Uint8Array(0), tagBytes, data]);
    var sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, key.privateKey, msg));
    var id = b64url(await sha256(sig));
    var bytes = concat([le(2, 2), sig, owner, Uint8Array.from([0]), Uint8Array.from([0]), le(tags.length, 8), le(tagBytes.length, 8), tagBytes, data]);
    return { id: id, bytes: bytes, owner: b64url(owner), signature: b64url(sig) };
  }

  /* a fresh member key; the seed is the member's, handed to them once */
  async function generateKey() {
    var kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    var pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
    var pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey));
    return { privateKey: kp.privateKey, publicKey: kp.publicKey, publicRaw: pub, publicHex: hex(pub), seed: pkcs8.slice(-32) };
  }
  async function importSeed(seed32) {
    var pkcs8 = concat([fromHex('302e020100300506032b657004220420'), seed32]);
    var priv = await subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign']);
    var jwk = await subtle.exportKey('jwk', priv); var pub = fromB64url(jwk.x);
    return { privateKey: priv, publicRaw: pub, publicHex: hex(pub), seed: seed32 };
  }
  function fromHex(h) { var out = new Uint8Array(h.length / 2); for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16); return out; }

  /* the door: POST the raw item; the service answers {id, owner, ...} */
  async function upload(item, fetchImpl) {
    if (item.bytes.length > FREE_LIMIT) throw new Error('item is ' + item.bytes.length + ' B; the free door takes ' + FREE_LIMIT);
    var f = fetchImpl || fetch;
    var r = await f(UPLOAD, { method: 'POST', headers: { 'content-type': 'application/octet-stream', accept: 'application/json' }, body: item.bytes });
    var text = await r.text();
    if (!r.ok) throw new Error('the upload door said ' + r.status + ': ' + text.slice(0, 160));
    var j; try { j = JSON.parse(text); } catch (e) { throw new Error('the upload door answered without JSON'); }
    if (j.id !== item.id) throw new Error('the door returned id ' + j.id + ' for item ' + item.id);
    return j;
  }

  return { UPLOAD: UPLOAD, FREE_LIMIT: FREE_LIMIT, deepHash: deepHash, serializeTags: serializeTags, sign: sign, generateKey: generateKey, importSeed: importSeed, upload: upload, b64url: b64url, fromB64url: fromB64url, hex: hex, fromHex: fromHex };
});
