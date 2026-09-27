/* myspace-adapter-temp.js — the TEMP rail: bytes that exist for this visit and
   then do not exist. SPEC-ADAPTER-CONTRACT-1, browser carrier (§2), one
   dedicated worker.

   Slice 03, second of the two rails that DO NOT SPEAK TO THE WORLD. That is the
   whole reason this one and `local` come before HIVE, ANT and AR (sequencing
   ruled by the coordinator seat 2026-09-20 20:26Z): a rail that needs no
   account, no key, no network and no approval is the cheapest possible proof
   that the seam is a seam rather than one rail wearing an abstraction hat. If
   the boundary does not hold here it costs nothing to learn.

   THE STORE IS A `Map` IN THIS WORKER AND NOTHING ELSE. No IndexedDB, no
   sessionStorage, no cache. The page closes, the worker dies, the Map dies with
   it — which is not a policy this file promises to honour, it is the only thing
   that can happen. `x_terms.survives_reload: false` is that fact declared, and
   the shell reads the declaration rather than knowing it.

   THIS FILE CONTAINS NO NETWORK PRIMITIVE. Not `fetch`, not `XMLHttpRequest`,
   not `WebSocket`, not `sendBeacon`, not `importScripts`. `e2e/myspace-seam.mjs`
   asserts that over the source AND counts zero requests at runtime while this
   rail is used, because a promise about bytes not leaving is worth exactly what
   it can be measured at.

   SHAPE: SINGLE-SHOT, NOT begin/submit. The Blossom adapter is two halves per
   call because that rail authenticates every request and §4 forbids an adapter
   holding the key — so it must hand back a digest for the page to sign. This
   rail authenticates nothing, so a signature here would be a ceremony over
   nothing, and a signature over nothing is a signal prettier than the truth
   (CLAUDE.md §2.10). It declares `x.put` / `x.get` / `x.drop` and the shell
   takes the shape from the declaration — which is §9.2 doing the work it exists
   to do rather than the shell knowing which rail is which.

   The `x.` prefix is the same reservation the Blossom adapter documents: contract
   v1 §3.2/§3.3 carries no method that moves bytes and §7's `Capability` enum
   names no members, so these declare themselves extensions rather than squatting
   on contract vocabulary. The spec text belongs to the wallet lane. */

var RAIL = 'temp';
var SCHEME = 'temp';

var E = {
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

/* The entire store. */
var HELD = new Map();

var METHODS = {
  describe: function () {
    return {
      rail: RAIL,
      adapter_version: '0.1.0',
      contract_version: '1',
      capabilities: ['x.put', 'x.get', 'x.drop'],
      /* §2 `networks`: the list of things this adapter talks to. Empty is a
         claim with teeth — the shell refuses to hand a keep-it-here purpose to
         any rail whose list is not empty, so this field is load-bearing routing
         input, not documentation. */
      networks: [],
      units: [],
      /* The founder's four questions (direction relayed 2026-09-20 20:21Z), answered
         BY THE RAIL. Slice 02 wrote in myspace.js that these had to come from the
         adapter once a second adapter existed, because one rail cannot exercise a
         per-rail answer. This is that second adapter, so here they are. The shell
         renders them per register; it does not know them. */
      x_terms: {
        deletable: true,
        readers: 'this-device',
        lifetime: 'until-this-tab-closes',
        survives_reload: false,
        payer: 'nobody'
      }
    };
  },

  'x.put': async function (p) {
    if (!(p && p.bytes instanceof Uint8Array) || !p.bytes.length) throw fail(E.BAD_PARAMS, 'needs {bytes} as a non-empty Uint8Array');
    var address = await sha256hex(p.bytes);
    /* A copy, not the caller's view: structured clone already gave us our own
       buffer, but slicing makes that independent of how the carrier evolves. */
    HELD.set(address, p.bytes.slice());
    return { scheme: SCHEME, address: address, size: p.bytes.length };
  },

  'x.get': async function (p) {
    if (!(p && /^[0-9a-f]{64}$/.test(p.address || ''))) throw fail(E.BAD_PARAMS, 'needs {address} as 64 hex');
    var got = HELD.get(p.address);
    /* The honest answer after a reload: this rail was never going to have it.
       The shell does not need this call to find that out — it reads
       survives_reload from describe and sweeps the row before asking — but a
       rail that answered vaguely here would make that sweep unfalsifiable. */
    if (!got) throw fail(E.NOT_FOUND, 'this rail only holds bytes for the current visit, and it is not holding these');
    return { bytes: got.slice() };
  },

  /* Deletion on this rail is REAL and that is the per-rail difference the whole
     slice exists to show: Blossom's store has no DELETE route at all (405,
     `Allow: GET,HEAD`, measured 2026-09-20), so its `x_terms.deletable` is false
     and the page has to say a shared copy cannot be pulled back. Here it can. */
  'x.drop': async function (p) {
    if (!(p && /^[0-9a-f]{64}$/.test(p.address || ''))) throw fail(E.BAD_PARAMS, 'needs {address} as 64 hex');
    var had = HELD.delete(p.address);
    return { dropped: had };
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
