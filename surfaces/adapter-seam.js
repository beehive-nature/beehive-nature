/* ─── LICENSE ──────────────────────────────────────────────────────────────
   SPDX-License-Identifier: Apache-2.0
   Copyright 2026 Travis Mark Remington <lovis@skaists.dev>
   Licensed under the Apache License, Version 2.0 (the "License"); you
   may not use this file except in compliance with the License. You may
   obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
   See /LICENSE and /NOTICE in this repository. Applies to the rails:
   the wallet surface, the rail adapters, the Arweave signer.
   ─────────────────────────────────────────────────────────────────────── */
/* adapter-seam.js — SPEC-ADAPTER-CONTRACT-1, browser carrier, as a module any
   surface can load.

   THIS IS A LIFT, NOT A SECOND SEAM. The shell in `surfaces/wallet.html`
   (search `THE ADAPTER SHELL`) already implements this contract and is gated by
   `e2e/wallet-adapter.mjs` against §9 criteria 1-6. It is written inline in that
   page, so a second surface cannot reach it. This file is that shell, lifted
   verbatim in behaviour — same attach check, same redaction wall, same
   capability gate, same fault containment — so that when the wallet lane wants
   the dedupe it is a DELETION from wallet.html, not a merge of two designs.
   The wallet surface is a payment surface and this seat does not edit it; the
   duplication is named here rather than hidden.

   What the shell knows: the contract. What the shell never knows: the rail.
     - §9.1  an adapter that does not answer `describe` is NOT ATTACHED.
     - §9.2  a capability not in `describe` is UNREACHABLE — `ops` is built from
             the declared list, so the call path is an absent function, not an
             error branch. No message is dispatched. TELEMETRY proves it.
     - §4.1  every response crosses the redaction wall before the caller sees it.
     - §6    a faulted adapter is terminated; it is ONE dead worker, never the
             page. Retries and any outbox belong to the caller, not the adapter.

   Transport is the dedicated worker's own message channel, which is what the
   wallet shell already does; §2 names a MessagePort and this is that port pair
   under its default name. Params and results cross by structured clone, so a
   Uint8Array travels as itself and nothing is JSON-serialised on the way. */
(function () {
  'use strict';

  var nextRpcId = 1;

  /* THE REDACTION WALL (contract §4.1) — shell-side, on every adapter response:
     no method on this contract returns key material. A hit quarantines the
     adapter: the response never reaches the caller. Matching is EXACT-VALUE,
     never substring-of-the-serialization: legitimate blobs (base64 bytes, hex
     digests) are long and must not trip a fuzzy WIF regex — a key is exactly
     key-shaped, whole. */
  var WALL_EXACT = [
    /^5[HJK][1-9A-HJ-NP-Za-km-z]{49}$/,                // WIF (uncompressed), exactly 51
    /^[LK][1-9A-HJ-NP-Za-km-z]{51}$/,                  // WIF (compressed), exactly 52
    /^PVT_[K1R]_[1-9A-HJ-NP-Za-km-z]+$/,               // Antelope explicit private
    /^xpr[v][1-9A-HJ-NP-Za-km-z]{50,}$/                // BIP32 extended private
  ];
  /* The `[v]` is the estate's bracket trick (scripts/secret-scan.sh:55, and
     scripts/push-preflight.sh:174 says the same in its own comment): a detector
     must not match its own source, or every commit that carries it is blocked as
     if it carried a key. The character class is one character wide, so the regex
     accepts and rejects exactly what it did before. This is the one place this
     file reads differently from the shell it was lifted from — wallet.html
     carries the bare literal, and is a payment surface this seat does not edit. */

  function wallThrow() {
    var err = new Error('REDACTION WALL: adapter response carried key-shaped material — quarantined');
    err.code = -32012;
    err.wall = true;
    throw err;
  }

  function wallWalk(x, key) {
    if (typeof x === 'string') {
      if (key && /^(d|p|q|dp|dq|qi)$/.test(key) && /^[A-Za-z0-9_-]{40,}$/.test(x)) wallThrow();   // JWK private parameters — any of them
      if (/PRIVATE KEY-----/.test(x)) wallThrow();                      // PEM block
      for (var i = 0; i < WALL_EXACT.length; i++) if (WALL_EXACT[i].test(x)) wallThrow();
      return;
    }
    /* Binary payloads are not walked. Every pattern above matches a STRING-shaped
       bearer value; a Uint8Array holds numbers, so walking one can never trip a
       rule — it would only spend O(bytes) proving nothing. This narrows the
       wall's cost, not its reach, and it is written down because a reader is
       owed the difference. */
    if (ArrayBuffer.isView(x) || x instanceof ArrayBuffer) return;
    if (Array.isArray(x)) { for (var j = 0; j < x.length; j++) wallWalk(x[j]); return; }
    if (x && typeof x === 'object') {
      var ks = Object.keys(x);
      for (var k = 0; k < ks.length; k++) wallWalk(x[ks[k]], ks[k]);
    }
  }

  function wall(result) {
    wallWalk(result);
    return result;
  }

  function rpcError(e) {
    var err = new Error((e && e.message) || String(e));
    err.code = e && e.code;
    return err;
  }

  /* spawn(rail, script) -> handle. `rail` is the value the adapter must return
     from describe(); a mismatch is a refusal, because a caller-supplied
     classification is not a classification (§7). */
  function spawn(rail, script) {
    var a = {
      rail: rail,
      worker: null,
      caps: null,
      attached: false,
      state: 'spawning',
      pending: new Map(),
      telemetry: { sent: 0, recv: 0 },
      ops: {}
    };

    function crash(why) {
      a.pending.forEach(function (p) {
        clearTimeout(p.timer);
        p.rej(rpcError({ code: -32010, message: 'adapter ' + rail + ' faulted: ' + why }));
      });
      a.pending.clear();
      try { a.worker.terminate(); } catch (e) { /* already gone */ }
      a.attached = false;
      a.caps = null;
      a.ops = {};                                   // §9.2: the call paths go with it
      a.state = 'down — ' + why;                    // ONE rail, never the page (§6)
    }

    function call(method, params, ms) {
      if (!a.worker) return Promise.reject(new Error('no ' + rail + ' adapter'));
      if (!a.attached && method !== 'describe') return Promise.reject(new Error(rail + ' adapter not attached'));
      return new Promise(function (res, rej) {
        var id = nextRpcId++;
        var timer = setTimeout(function () {
          a.pending.delete(id);
          rej(rpcError({ code: -32011, message: method + ' on ' + rail + ' timed out' }));
        }, ms || 15000);
        a.pending.set(id, { res: res, rej: rej, timer: timer });
        a.telemetry.sent++;
        a.worker.postMessage({ jsonrpc: '2.0', id: id, method: method, params: params || {} });
      });
    }

    function boot() {
      a.state = 'spawning';
      a.worker = new Worker(script);
      a.worker.onmessage = function (ev) {
        var m = ev.data;
        if (!m || m.jsonrpc !== '2.0' || typeof m.id !== 'number') return;
        var p = a.pending.get(m.id);
        if (!p) return;
        clearTimeout(p.timer);
        a.pending.delete(m.id);
        a.telemetry.recv++;
        if (m.error) {
          /* the wall covers errors too — a hostile adapter does not get an
             exfiltration lane by failing loudly */
          try { wall(m.error.message); }
          catch (e) { crash('redaction wall: error message carried key-shaped material'); p.rej(e); return; }
          p.rej(rpcError(m.error));
        } else {
          try { p.res(wall(m.result)); }
          catch (e) { crash('redaction wall: response carried key-shaped material'); p.rej(e); }
        }
      };
      a.worker.onerror = function () { crash('worker error'); };

      a.ready = call('describe', {}, 8000).then(function (d) {
        if (!d || d.rail !== rail || d.contract_version !== '1' ||
            !Array.isArray(d.capabilities) || !d.capabilities.length) {
          crash('describe incomplete — adapter not attached (contract §9.1)');
          throw new Error(rail + ' adapter not attached');
        }
        a.caps = d;
        a.attached = true;
        a.state = 'attached';
        /* §9.2 made mechanical: the ONLY way to reach a method is through a
           function this loop built from the adapter's own declaration. An
           undeclared capability has no function to call. */
        a.ops = {};
        d.capabilities.forEach(function (cap) {
          a.ops[cap] = function (params, ms) { return call(cap, params, ms); };
        });
        return d;
      }, function (e) {
        crash('describe failed: ' + ((e && e.message) || e));
        throw e;
      });
      /* a.ready still rejects for whoever awaits it; this derived promise only
         keeps a refused attach from surfacing as an unhandled rejection when a
         caller legitimately does not await. */
      a.ready.catch(function () {});
    }

    a.can = function (cap) { return typeof a.ops[cap] === 'function'; };
    a.terminate = function (why) { crash(why || 'terminated by the shell'); };
    a.respawn = boot;
    boot();
    return a;
  }

  window.BnrSeam = { spawn: spawn, wall: wall };
})();
