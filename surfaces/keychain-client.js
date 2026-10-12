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
      var f = document.createElement('iframe'), state = null, waits = {}, listeners = [], seq = 0, settled = false, loads = 0;
      function failAll(why) { Object.keys(waits).forEach(function (id) { var w = waits[id]; delete waits[id]; var e = new Error(why); e.refusal = 'keychain'; w.no(e); }); }
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
          if (m.t === 'kc.signed') w.ok({ raw: m.raw, hash: m.hash, kind: m.kind || 'evm', pub: m.pub || null });
          else { var e = new Error(m.reason || 'Your keychain refused this request'); e.refusal = 'keychain'; w.no(e); }
        }
        else if (m.t === 'kc.hive.pubbed' && waits[m.id]) {
          var hp = waits[m.id]; delete waits[m.id]; hp.ok({ account: m.account, pub: m.pub });
        }
      }
      var api = {
        frame: f,
        get state() { return state; },
        onstate: function (fn) { listeners.push(fn); },
        ask: function (msg) {
          return new Promise(function (ok, no) {
            var id = 'r' + (++seq) + '.' + Date.now();
            waits[id] = { ok: ok, no: no };
            setTimeout(function () { if (waits[id]) { delete waits[id]; var e = new Error('Your keychain did not answer in time; nothing was signed'); e.refusal = 'keychain'; no(e); } }, 310000);
            f.contentWindow.postMessage(msg(id), ORIGIN);
          });
        },
        /* the AntPay.createHosted signer shape: public address, and a signed envelope on request */
        signer: function () {
          return {
            isolated: true,
            address: async function () { if (!state || state.state !== 'unlocked') throw new Error('Unlock your isolated keychain to prepare this invoice'); return state.evm; },
            signTransaction: function (tx) {
              if (!state || state.state !== 'unlocked') return Promise.reject(new Error('Unlock your isolated keychain to sign'));
              f.scrollIntoView({ block: 'center' });
              return api.ask(function (id) { return { t: 'kc.sign', v: 1, id: id, tx: tx }; });
            },
            /* bDroP's Hive door: the structured transaction travels to the keychain, which
               serializes and signs ITS OWN copy — the page never holds a Hive key */
            signHive: function (account, tx) {
              if (!state || state.state !== 'unlocked') return Promise.reject(new Error('Unlock your isolated keychain to sign this drop'));
              f.scrollIntoView({ block: 'center' });
              return api.ask(function (id) { return { t: 'kc.sign', v: 1, id: id, hive: { account: account, tx: tx } }; });
            },
            /* the public posting key this keychain would sign that account with — public
               data only, so the desk can check it against the chain before asking anything */
            hivePub: function (account) { return api.ask(function (id) { return { t: 'kc.hive.pub', v: 1, id: id, account: account }; }); }
          };
        }
      };
      window.addEventListener('message', onmsg);
      f.addEventListener('load', function () {
        if (loads++) failAll('Your keychain reloaded before answering; nothing was signed');
        f.contentWindow.postMessage({ t: 'kc.hello', v: 1 }, ORIGIN);
      });
      setTimeout(function () { if (!settled) { window.removeEventListener('message', onmsg); f.remove(); finish(null); } }, opts.timeout || 10000);
      container.append(f);
    });
  }
  root.KeychainClient = { mount: mount, ORIGIN: ORIGIN };
})(window);
