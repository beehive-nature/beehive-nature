/* keychain-client.js — the wallet's side of the isolated bzDiD keychain (keychain/ in this repo,
   served at https://keys.skaists.dev).

   The wallet cannot sign through this client: it can only ask. The keychain decodes every
   request itself and signs only after a press inside its own frame. What comes back is checked
   again here by whoever asked (ant-pay.js checkEnvelope decodes the bytes and recovers the
   sender independently).

   mount(container) resolves to null when the keychain origin is unreachable (for example before
   its DNS record exists), and nothing is added to the page. */
(function (root) {
  'use strict';
  var ORIGIN = 'https://keys.skaists.dev';
  async function reachable() {
    try { await fetch(ORIGIN + '/genesis.js', { mode: 'no-cors', cache: 'no-store' }); return true; } catch (e) { return false; }
  }
  async function mount(container, opts) {
    opts = opts || {};
    if (!container || !(await reachable())) return null;
    return new Promise(function (resolve) {
      var f = document.createElement('iframe'), state = null, waits = {}, listeners = [], seq = 0, settled = false;
      f.src = ORIGIN + '/';
      f.title = 'Your isolated bzDiD keychain';
      f.allow = 'publickey-credentials-get ' + ORIGIN + '; publickey-credentials-create ' + ORIGIN;
      f.style.cssText = 'display:block;width:100%;min-height:' + (opts.height || 260) + 'px;border:1px solid currentColor;border-radius:10px;margin:8px 0;background:transparent';
      function finish(v) { if (!settled) { settled = true; resolve(v); } }
      function onmsg(ev) {
        if (ev.origin !== ORIGIN || ev.source !== f.contentWindow) return;
        var m = ev.data;
        if (!m || typeof m !== 'object' || m.v !== 1) return;
        if (m.t === 'kc.size' && Number.isFinite(m.h)) { f.style.height = Math.max(200, Math.min(720, m.h + 2)) + 'px'; return; }
        if (m.t === 'kc.state') { state = { state: m.state, did: m.did || null, evm: m.evm || null, genesis: m.genesis || null }; listeners.forEach(function (fn) { try { fn(state); } catch (e) {} }); finish(api); }
        else if ((m.t === 'kc.signed' || m.t === 'kc.refused') && waits[m.id]) {
          var w = waits[m.id]; delete waits[m.id];
          if (m.t === 'kc.signed') w.ok({ raw: m.raw, hash: m.hash });
          else { var e = new Error(m.reason || 'Your keychain refused this request'); e.refusal = 'keychain'; w.no(e); }
        }
      }
      var api = {
        frame: f,
        get state() { return state; },
        onstate: function (fn) { listeners.push(fn); },
        /* the AntPay.createHosted signer shape: public address, and a signed envelope on request */
        signer: function () {
          return {
            isolated: true,
            address: async function () { if (!state || state.state !== 'unlocked') throw new Error('Unlock your isolated keychain to prepare this invoice'); return state.evm; },
            signTransaction: function (tx) {
              return new Promise(function (ok, no) {
                if (!state || state.state !== 'unlocked') return no(new Error('Unlock your isolated keychain to sign'));
                var id = 'r' + (++seq) + '.' + Date.now();
                waits[id] = { ok: ok, no: no };
                f.scrollIntoView({ block: 'center' });
                f.contentWindow.postMessage({ t: 'kc.sign', v: 1, id: id, tx: tx }, ORIGIN);
              });
            }
          };
        }
      };
      window.addEventListener('message', onmsg);
      f.addEventListener('load', function () { f.contentWindow.postMessage({ t: 'kc.hello', v: 1 }, ORIGIN); });
      setTimeout(function () { if (!settled) { window.removeEventListener('message', onmsg); f.remove(); finish(null); } }, opts.timeout || 10000);
      container.append(f);
    });
  }
  root.KeychainClient = { mount: mount, ORIGIN: ORIGIN };
})(window);
