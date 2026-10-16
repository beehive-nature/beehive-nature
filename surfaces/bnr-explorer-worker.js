/* bnr-explorer-worker.js — the preview worker. It runs crates/bnr-explorer's preview
   (surfaces/bnr-explorer.wasm) over one object's bytes and hands back a small verdict.

   WHAT HOLDS THE BOUNDARY, in order of strength:
     1  the module has NO IMPORTS. The code that parses untrusted bytes cannot name a
        network, a key, a store or a clock. This worker fetches the module from its
        own origin, checks its sha256 against the pin the page sends and its import
        list against empty, and answers `off` rather than run a module that fails
        either; the page checks the reported digest against its pin again.
     2  this worker is handed the bytes of ONE object and its expected digest, never a
        key, a rail, an address or the index. It cannot ask for more: nobody on the
        other side of the port answers anything but `preview`.
     3  it removes its own network and storage handles as its first act. The one
        fetch it keeps, to load the module, is dropped when the module has loaded and
        before any preview is accepted. That is a forbid, not an unnameable — the
        module above is what makes it unnecessary — and it is said as what it is.
   The budget is the module's constant (32 MB in, 64 KB of text out, 50 million
   pixels); nothing sent from the page can loosen it. */
'use strict';

var grab = typeof fetch === 'function' ? fetch.bind(self) : null;
var subtle = self.crypto && self.crypto.subtle;

[
  'fetch', 'XMLHttpRequest', 'WebSocket', 'WebTransport', 'EventSource', 'importScripts',
  'indexedDB', 'caches', 'BroadcastChannel', 'Request'
].forEach(function (k) {
  try { Object.defineProperty(self, k, { value: undefined, writable: false, configurable: false }); }
  catch (e) { try { delete self[k]; } catch (e2) { /* not ours to remove */ } }
});

var X = null;     // the instance's exports, once a module passes

function off(why) { grab = null; postMessage({ op: 'off', why: why }); }

function hex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }

async function load(url, pin) {
  if (typeof WebAssembly !== 'object') return off('wasm');
  if (!subtle) return off('crypto');
  if (!grab) return off('fetch');
  var bytes;
  try {
    var res = await grab(url);
    if (!res.ok) return off('fetch');
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (e) { return off('fetch'); }
  grab = null;      // the module is here; this worker has no network from now on
  var sha = hex(new Uint8Array(await subtle.digest('SHA-256', bytes)));
  if (sha !== pin) return off('pin');
  var mod;
  try { mod = await WebAssembly.compile(bytes); } catch (e) { return off('compile'); }
  if (WebAssembly.Module.imports(mod).length !== 0) return off('imports');
  var inst;
  try { inst = await WebAssembly.instantiate(mod, {}); } catch (e) { return off('compile'); }
  if (inst.exports.bx_abi_version() !== 1) return off('compile');
  X = inst.exports;
  postMessage({ op: 'ready', sha: sha, imports: 0, pages: X.memory.buffer.byteLength / 65536 });
}

function verdict(digestHex, bytes) {
  var len = 42 + bytes.length;
  var req = X.bx_alloc(len);
  if (!req) return { refused: 'alloc' };
  try {
    var m = new Uint8Array(X.memory.buffer);
    m.set([0x42, 0x58, 0x50, 0x51, 1, 1], req);                 // "BXPQ", version 1, sha256
    for (var i = 0; i < 32; i++) m[req + 6 + i] = parseInt(digestHex.substr(2 * i, 2), 16);
    new DataView(X.memory.buffer).setUint32(req + 38, bytes.length, true);
    m.set(bytes, req + 42);
    var out = X.bx_verdict_arena();
    var n = X.bx_preview(req, len, out, X.bx_verdict_cap());
    return { bytes: new Uint8Array(X.memory.buffer).slice(out, out + n) };   // a copy: the module's memory stays here
  } finally {
    X.bx_free(req, len);
  }
}

onmessage = function (ev) {
  var m = ev.data || {};
  if (m.op === 'init') {
    if (X || !grab) return;
    load(String(m.url || ''), String(m.pin || ''));
    return;
  }
  if (m.op === 'preview') {
    if (!X) return postMessage({ op: 'verdict', id: m.id, refused: 'not ready' });
    if (!/^[0-9a-f]{64}$/.test(m.digest || '') || !(m.bytes instanceof Uint8Array)) {
      return postMessage({ op: 'verdict', id: m.id, refused: 'bad request' });
    }
    var v = verdict(m.digest, m.bytes);
    postMessage({ op: 'verdict', id: m.id, refused: v.refused || null, bytes: v.bytes || null,
      pages: X.memory.buffer.byteLength / 65536 });
  }
};
