/* myspace-adapter-local.js — the LOCAL rail: this device, and no further.
   SPEC-ADAPTER-CONTRACT-1, browser carrier (§2), one dedicated worker.

   Slice 03, first of the two rails that DO NOT SPEAK TO THE WORLD. See
   `myspace-adapter-temp.js` for why these two go before HIVE/ANT/AR: they need
   no account, no key, no network and no approval, so they are the cheapest
   possible test of whether the seam is a seam. The difference between the two is
   exactly one declared term — `survives_reload` — and the shell routes on that
   declaration rather than on either rail's name.

   THE STORE IS THIS BROWSER'S IndexedDB AND NOTHING ELSE. Its own database
   (`myspace-rail-local`), deliberately NOT the shell's `myspace` database: two
   holders opening one database at different versions is a `blocked` upgrade
   waiting to happen, and a rail that can wedge the page it serves is not a rail
   behind a boundary. The shell's own stores stay the shell's.

   THIS FILE CONTAINS NO NETWORK PRIMITIVE. Not `fetch`, not `XMLHttpRequest`,
   not `WebSocket`, not `sendBeacon`, not `importScripts`. `e2e/myspace-seam.mjs`
   asserts that over the source AND counts zero requests at runtime while this
   rail is used.

   WHAT THIS RAIL HOLDS IT CANNOT READ. The shell encrypts before it hands
   anything over (AES-GCM, key minted in the page and kept in the page), so what
   arrives here is ciphertext and the address is the digest OF THE CIPHERTEXT.
   That is §4 not as a rule this file promises to obey but as a shape: there is
   no key here to hold. It is also why `x.get` can hand back bytes without
   anyone worrying what they are.

   SHAPE: SINGLE-SHOT, NOT begin/submit — same reasoning as the temp rail. The
   two halves on the Blossom adapter exist because that rail authenticates every
   request; this one authenticates nothing, and a signature over nothing is a
   signal prettier than the truth. */

var RAIL = 'local';
var SCHEME = 'local';
var DB_NAME = 'myspace-rail-local';
var DB_VERSION = 1;
var STORE = 'blobs';

var E = {
  RAIL_UNREACHABLE: -32001,
  BAD_PARAMS: -32007,
  METHOD_ABSENT: -32008,
  NOT_FOUND: -32024
};

function fail(code, message) {
  var e = new Error(message);
  e.code = code;
  return e;
}

function hex(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

async function sha256hex(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

function openDb() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = function () { resolve(req.result); };
    /* Private browsing and storage-denied profiles reject here. That is the rail
       being unreachable, which is a code the shell already knows how to answer
       (§6) — it is not a reason for the page to stop having files. */
    req.onerror = function () { reject(fail(E.RAIL_UNREACHABLE, 'this browser would not open local storage for the page')); };
    req.onblocked = function () { reject(fail(E.RAIL_UNREACHABLE, 'local storage for the page is blocked by another tab')); };
  });
}

function tx(mode, fn) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(STORE, mode);
      var req = fn(t.objectStore(STORE));
      t.oncomplete = function () { resolve(req && req.result); };
      t.onerror = function () { reject(fail(E.RAIL_UNREACHABLE, (t.error && t.error.message) || 'local store transaction failed')); };
      t.onabort = function () { reject(fail(E.RAIL_UNREACHABLE, (t.error && t.error.message) || 'local store transaction aborted')); };
    });
  });
}

var METHODS = {
  describe: function () {
    return {
      rail: RAIL,
      adapter_version: '0.1.0',
      contract_version: '1',
      capabilities: ['x.put', 'x.get', 'x.drop'],
      /* Empty, and load-bearing: the shell refuses to route a keep-it-here
         purpose to any rail whose `networks` is not empty. */
      networks: [],
      units: [],
      /* The founder's four questions, answered BY THE RAIL (direction relayed
         2026-09-20 20:21Z). `deletable: true` is the honest per-rail difference
         this slice exists to make visible: Blossom's store has NO delete route
         (405, `Allow: GET,HEAD`, measured), so its answer is false and the page
         must say a shared copy cannot be pulled back. Here it can, and the page
         says that instead — from the declaration, never from its own memory of
         which rail is which. */
      x_terms: {
        deletable: true,
        readers: 'this-device',
        lifetime: 'until-you-delete-it',
        survives_reload: true,
        payer: 'nobody'
      }
    };
  },

  'x.put': async function (p) {
    if (!(p && p.bytes instanceof Uint8Array) || !p.bytes.length) throw fail(E.BAD_PARAMS, 'needs {bytes} as a non-empty Uint8Array');
    var address = await sha256hex(p.bytes);
    var copy = p.bytes.slice();
    await tx('readwrite', function (s) { return s.put(copy, address); });
    return { scheme: SCHEME, address: address, size: p.bytes.length };
  },

  'x.get': async function (p) {
    if (!(p && /^[0-9a-f]{64}$/.test(p.address || ''))) throw fail(E.BAD_PARAMS, 'needs {address} as 64 hex');
    var got = await tx('readonly', function (s) { return s.get(p.address); });
    if (!got) throw fail(E.NOT_FOUND, 'this device is not holding those bytes');
    return { bytes: new Uint8Array(got) };
  },

  'x.drop': async function (p) {
    if (!(p && /^[0-9a-f]{64}$/.test(p.address || ''))) throw fail(E.BAD_PARAMS, 'needs {address} as 64 hex');
    /* Reported honestly rather than assumed: a delete of an absent key succeeds
       in IndexedDB, so `dropped` is read from a prior get, not from the delete.
       The page tells a visitor that bytes are gone; it should only say that
       about bytes that were there. */
    var had = await tx('readonly', function (s) { return s.get(p.address); });
    await tx('readwrite', function (s) { return s.delete(p.address); });
    return { dropped: !!had };
  }
};

self.onmessage = async function (ev) {
  var m = ev.data;
  if (!m || m.jsonrpc !== '2.0' || typeof m.id !== 'number') return;
  var fn = METHODS[m.method];
  if (!fn) {
    postMessage({ jsonrpc: '2.0', id: m.id, error: { code: E.METHOD_ABSENT, message: 'method not on this adapter: ' + m.method } });
    return;
  }
  try {
    postMessage({ jsonrpc: '2.0', id: m.id, result: await fn(m.params || {}) });
  } catch (e) {
    postMessage({
      jsonrpc: '2.0', id: m.id,
      error: { code: (e && e.code) || -32000, message: (e && e.message) || String(e) }
    });
  }
};
