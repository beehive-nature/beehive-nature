/* keychain.js — the isolated bzDiD keychain at https://keys.skaists.dev.

   WHY A SEPARATE ORIGIN: the wallet page at skaists.dev runs many scripts. A key held there is a
   key every one of them can read or use, and a passkey scoped to skaists.dev is one any of them
   can ask the browser for. This page has its own origin and its own passkey scope, so the
   wallet page can neither read its memory nor unlock its passkey. The wallet talks to it only
   through postMessage: it can ASK for a public identity or a signature; it cannot sign.

   WHAT IT HOLDS: one root, re-derived on each unlock from this origin's passkey PRF (or typed
   in here as a recovery code), kept in this page's memory and scrubbed on lock. From the root:
   a BDID-GENESIS-V1 identity (r0 rotation key + signing key, both ed25519) and keys per context
   under the same HKDF law as surfaces/onboarding/bzdid-key.js. The EVM key's context is
   'evm:' + the DID, so a name (the .b layer) never shapes a key.

   WHAT IT SIGNS (this phase): Autonomi storage payments on Arbitrum One — an approve of the ANT
   token to the pinned storage vault, or payForQuotes on that vault. Every request is decoded
   HERE and shown on a confirm card; only a trusted press inside this page signs, after the card
   has been visibly on screen. Anything else is refused before the key is touched.

   WHAT IT DOES NOT CLAIM: it does not protect against a wallet page that replaces this frame
   with a look-alike before you unlock (check the address bar of a popped-out keychain), and it
   does not make a root that has lived in the wallet page safe — that root is rotated away from,
   never imported. */
(function () {
  'use strict';
  var ORIGIN = 'https://keys.skaists.dev', PARENTS = ['https://skaists.dev'];
  var CHAIN = 42161, CHAIN_NAME = 'Arbitrum One';
  var TOKEN = '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684'; // PUBLIC-CONSTANT: ANT (Autonomi) on Arbitrum One
  var VAULT = '0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26'; // PUBLIC-CONSTANT: Autonomi PaymentVaultV2 (e2e/ant-pay-vector.json)
  var MAX_GAS = 3000000n, PRESS_DELAY_MS = 700, VALID_UNTIL = 4102444800; // 2100-01-01T00:00:00Z
  var main = document.getElementById('kc');

  /* ── tiny DOM helpers: text only, never HTML from a message ── */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'on') Object.keys(attrs.on).forEach(function (e) { n.addEventListener(e, attrs.on[e]); }); else if (k === 'text') n.textContent = attrs.text; else n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { n.append(c); });
    return n;
  }
  function show() { main.replaceChildren.apply(main, arguments); if (typeof post === 'function') setTimeout(function () { post({ t: 'kc.size', v: 1, h: Math.ceil(main.getBoundingClientRect().height) }); }, 0); }
  function stop(text) { show(el('h1', { text: 'bzDiD keychain' }), el('p', { text: text })); }

  if (location.origin !== ORIGIN) return stop('This keychain only runs at keys.skaists.dev. A copy anywhere else holds and signs nothing.');
  var framed = window.parent !== window;
  var ancestors = location.ancestorOrigins ? Array.from(location.ancestorOrigins) : null;
  if (framed && ancestors && !ancestors.every(function (o) { return PARENTS.indexOf(o) >= 0; })) return stop('This keychain only opens inside the heART WALLet at skaists.dev, or on its own.');
  if (!window.BZDIDKEY || !window.BnrSign || !window.BZGENESIS) return stop('Part of the keychain did not load, so it holds and signs nothing. Reload to try again.');
  // Without ancestorOrigins this browser cannot name who framed us: show nothing to press until
  // the wallet at skaists.dev has spoken (its message origin is checked).
  var greeted = !framed || !!ancestors;
  var K = window.BZDIDKEY, B = window.BnrSign, G = window.BZGENESIS;

  /* ── bytes ── */
  function hex(b) { return Array.from(b, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  function bytes(h) { h = h.replace(/^0x/, ''); var o = new Uint8Array(h.length / 2); for (var i = 0; i < o.length; i++) o[i] = parseInt(h.substr(2 * i, 2), 16); return o; }
  function rlpInt(v) { var n = BigInt(v), h = n.toString(16); return n === 0n ? '' : (h.length % 2 ? '0' + h : h); }
  function rlpLen(len, base) { if (len < 56) return (base + len).toString(16).padStart(2, '0'); var l = len.toString(16); if (l.length % 2) l = '0' + l; return (base + 55 + l.length / 2).toString(16) + l; }
  function rlp(item) {
    if (Array.isArray(item)) { var body = item.map(rlp).join(''); return rlpLen(body.length / 2, 0xc0) + body; }
    if (item.length === 2 && parseInt(item, 16) < 0x80) return item;
    return rlpLen(item.length / 2, 0x80) + item;
  }
  function units(v, d) { var s = BigInt(v).toString().padStart(d + 1, '0'), w = s.slice(0, -d), f = s.slice(-d).replace(/0+$/, ''); return f ? w + '.' + f : w; }

  /* ── the root and what falls out of it ── */
  var root = null, me = null, parentOrigin = framed && ancestors && ancestors.length ? ancestors[0] : null, pending = null;
  var mem = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  function evmAddress(seed) { return '0x' + hex(B.keccak_256(B.secp.getPublicKey(seed, false).slice(1)).slice(12)); }
  function identity() {
    var r0 = K.deriveRecordKey(root, 'bzdid/rotation/r0'), sg = K.deriveRecordKey(root, 'bzdid/signing');
    try {
      var op = G.build({ rotationKeys: [{ alg: 'ed25519', key: r0.publicKey }], signingKey: { alg: 'ed25519', key: sg.publicKey }, services: [], alsoKnownAs: [], validUntil: VALID_UNTIL });
      var did = G.didOf(op, B.sha256), k = K.deriveK1Key(root, 'evm:' + did);
      try { return { did: did, genesis: hex(op), evm: evmAddress(k.seed) }; } finally { k.seed.fill(0); }
    } finally { r0.seed.fill(0); sg.seed.fill(0); }
  }
  function open(secret, how) {
    if (root) root.fill(0);
    root = null; me = null;
    root = how === 'prf' ? K.masterPrkFromPrfSecret(secret) : secret.slice();
    secret.fill(0);
    me = identity(); mem.set('kc.did', me.did); mem.set('kc.enrolled', '1');
    publish(); render();
  }
  function lock(quiet) {
    if (root) root.fill(0);
    root = null; me = null;
    if (pending) refuse('The keychain was locked before you answered.');
    if (!quiet) { publish(); render(); }
  }
  window.addEventListener('pagehide', function () { lock(true); });
  window.addEventListener('pageshow', function () { render(); publish(); });

  /* ── the narrow interface: public state out, sign requests in ── */
  function stateMsg() { return me ? { t: 'kc.state', v: 1, state: 'unlocked', did: me.did, evm: me.evm, genesis: me.genesis } : { t: 'kc.state', v: 1, state: 'locked', known: mem.get('kc.did') || null }; }
  function post(m) { if (framed && parentOrigin) window.parent.postMessage(m, parentOrigin); }
  function publish() { post(stateMsg()); post({ t: 'kc.size', v: 1, h: Math.ceil(main.getBoundingClientRect().height) }); }
  window.addEventListener('message', function (ev) {
    if (!framed || ev.source !== window.parent || PARENTS.indexOf(ev.origin) < 0) return;
    var m = ev.data;
    if (!m || typeof m !== 'object' || m.v !== 1) return;
    parentOrigin = ev.origin;
    if (!greeted) { greeted = true; render(); }
    if (m.t === 'kc.hello') publish();
    else if (m.t === 'kc.sign') ask(m);
  });

  /* what a request IS, decoded here from its own bytes; throws a reason to refuse */
  function decide(tx) {
    var q = function (v, what) { if (typeof v !== 'string' || !/^0x[0-9a-f]+$/i.test(v)) throw new Error(what + ' is not a quantity'); return BigInt(v); };
    if (!tx || typeof tx !== 'object') throw new Error('No transaction was sent');
    if (q(tx.chainId, 'chain') !== BigInt(CHAIN)) throw new Error('This keychain signs storage payments on ' + CHAIN_NAME + ' only');
    if (tx.value !== undefined && q(tx.value, 'value') !== 0n) throw new Error('A storage payment carries no ETH');
    var to = String(tx.to || '').toLowerCase(), data = String(tx.data || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(to)) throw new Error('No recipient contract');
    if (!/^0x[0-9a-f]{8}([0-9a-f]{64})*$/.test(data)) throw new Error('The call data is not a function call');
    if (tx.from !== undefined && String(tx.from).toLowerCase() !== me.evm) throw new Error('The request names another account than this keychain');
    var nonce = q(tx.nonce, 'nonce'), gas = q(tx.gas, 'gas'), fee = q(tx.maxFeePerGas, 'fee cap'), tip = q(tx.maxPriorityFeePerGas, 'priority fee');
    if (gas <= 0n || gas > MAX_GAS || fee <= 0n || tip > fee) throw new Error('The gas and fee limits are out of bounds');
    var sel = data.slice(2, 10), w = []; for (var i = 10; i < data.length; i += 64) w.push(data.slice(i, i + 64));
    var what, ant;
    if (to === TOKEN && sel === '095ea7b3' && w.length === 2 && w[0] === '0'.repeat(24) + VAULT.slice(2)) {
      ant = BigInt('0x' + w[1]); what = 'Let the Autonomi storage vault collect up to ' + units(ant, 18) + ' ANT';
    } else if (to === VAULT && sel === 'b6c2141b' && w.length >= 2 && BigInt('0x' + w[0]) === 32n) {
      var n = Number(BigInt('0x' + w[1]));
      if (n < 1 || n > 256 || w.length !== 2 + 3 * n) throw new Error('The storage payment is not in the expected form');
      ant = 0n; for (var j = 0; j < n; j++) { if (w[2 + 3 * j].slice(0, 24) !== '0'.repeat(24)) throw new Error('A storage node address is malformed'); ant += BigInt('0x' + w[3 + 3 * j]); }
      what = 'Pay ' + units(ant, 18) + ' ANT to ' + n + ' Autonomi storage node' + (n === 1 ? '' : 's');
    } else throw new Error('This keychain signs Autonomi storage payments only for now');
    if (ant > 100n * 10n ** 18n) throw new Error('More than 100 ANT for one request');
    return { what: what, to: to, data: data, nonce: nonce, gas: gas, fee: fee, tip: tip, maxEth: units(gas * fee, 18) };
  }
  function ask(m) {
    if (typeof m.id !== 'string' || m.id.length > 64) return;
    if (pending) return post({ t: 'kc.refused', v: 1, id: m.id, reason: 'Another request is waiting for your answer' });
    pending = { id: m.id, tx: m.tx, at: Date.now() };
    setTimeout(function () { if (pending && pending.id === m.id) refuse('The request waited too long and was refused.'); }, 300000);
    render();
  }
  function refuse(reason) { var p = pending; pending = null; if (p) post({ t: 'kc.refused', v: 1, id: p.id, reason: reason }); render(); }
  function sign(d) {
    var k = K.deriveK1Key(root, 'evm:' + me.did);
    try {
      var body = [rlpInt(CHAIN), rlpInt(d.nonce), rlpInt(d.tip), rlpInt(d.fee), rlpInt(d.gas), d.to.slice(2), '', d.data.slice(2), []];
      var sig = B.secp.sign(B.keccak_256(bytes('02' + rlp(body))), k.seed);
      var raw = '0x02' + rlp(body.concat([rlpInt(sig.recovery), rlpInt(sig.r), rlpInt(sig.s)]));
      return { raw: raw, hash: '0x' + hex(B.keccak_256(bytes(raw))) };
    } finally { k.seed.fill(0); }
  }

  /* ── what you see ── */
  function btn(text, fn, cls) { return el('button', { type: 'button', class: cls || '', text: text, on: { click: fn } }); }
  function trusted(fn) { return function (ev) { if (ev && ev.isTrusted) fn(ev); }; }
  function failSay(e) { show(el('h1', { text: 'bzDiD keychain' }), el('p', { text: (e && e.message) || String(e) }), btn('Back', function () { render(); })); }
  async function make() { try { var r = await K.enrollPasskey('bzDiD keychain', 'bzDiD keychain'); if (!r.prfEnabled) mem.set('kc.prf-unconfirmed', '1'); open(await K.getPrfSecret(), 'prf'); } catch (e) { failSay(e); } }
  async function unlock() { try { open(await K.getPrfSecret(), 'prf'); } catch (e) { failSay(e); } }
  function fromCode(input) { try { open(K.decodeRecoveryAuto(input.value.trim()), 'code'); input.value = ''; } catch (e) { input.value = ''; failSay(new Error('That recovery code did not open a keychain.')); } }
  function confirmCard() {
    var d;
    try { d = decide(pending.tx); } catch (e) { refuse(e.message); return; }
    // The press counts only after the whole card has been visible and unobscured for
    // PRESS_DELAY_MS without a break. Only browsers with IntersectionObserver v2 (isVisible)
    // can prove "unobscured"; elsewhere the keychain refuses rather than guesses.
    var go = btn('Sign this payment', null, 'go'), visibleSince = null, visible = false, provable = false;
    go.disabled = true;
    var ready = function () { go.disabled = !(provable && visible && visibleSince !== null && performance.now() - visibleSince >= PRESS_DELAY_MS); };
    var seen = function (v) { if (v && !visible) { visibleSince = performance.now(); setTimeout(ready, PRESS_DELAY_MS + 10); } if (!v) visibleSince = null; visible = v; ready(); };
    go.addEventListener('click', trusted(function () {
      ready(); if (go.disabled || !pending) return;
      var p = pending; pending = null;
      try { var s = sign(d); post({ t: 'kc.signed', v: 1, id: p.id, raw: s.raw, hash: s.hash }); } catch (e) { post({ t: 'kc.refused', v: 1, id: p.id, reason: 'Signing failed: ' + e.message }); }
      render();
    }));
    var card = el('section', { 'aria-label': 'Payment to confirm' }, [
      el('h1', { text: 'Confirm in your keychain' }),
      el('p', { text: d.what + '.' }),
      el('dl', {}, [el('dt', { text: 'Network' }), el('dd', { text: CHAIN_NAME }), el('dt', { text: 'From' }), el('dd', { class: 'mono', text: me.evm }),
        el('dt', { text: 'Contract' }), el('dd', { class: 'mono', text: d.to }), el('dt', { text: 'Network fee, at most' }), el('dd', { text: d.maxEth + ' ETH' }),
        el('dt', { text: 'Sequence' }), el('dd', { text: d.nonce.toString() })]),
      go, btn('Refuse', trusted(function () { refuse('You refused this payment in your keychain.'); }))
    ]);
    var note = el('p', { class: 'dim', text: 'This browser cannot prove that nothing covers this card, so the keychain will not sign here. Open the wallet in Chrome, Edge or Brave to sign.', hidden: '' });
    card.append(note);
    var unprovable = function () { provable = false; note.hidden = false; ready(); };
    if ('IntersectionObserver' in window) {
      try { watcher = new IntersectionObserver(function (es) { var e = es[es.length - 1]; if (!('isVisible' in e)) return unprovable(); provable = true; seen(e.isVisible && e.intersectionRatio >= 0.999); }, { trackVisibility: true, delay: 100, threshold: [0, 1] }); watcher.observe(card); }
      catch (e) { unprovable(); }
    } else unprovable();
    return card;
  }
  var watcher = null; // the one visibility observer, for the card on screen
  function render() {
    if (watcher) { watcher.disconnect(); watcher = null; }
    if (!greeted) { show(el('p', { class: 'dim', text: 'Waiting for the heART WALLet…' })); return; }
    if (pending && me) { var c = confirmCard(); if (c) show(c); return; }
    if (me) {
      var code = el('p', { class: 'mono', hidden: '' });
      show(el('h1', { text: 'Your isolated keychain is open' }),
        el('dl', {}, [el('dt', { text: 'Identity' }), el('dd', { class: 'mono', text: me.did }), el('dt', { text: 'Arbitrum account' }), el('dd', { class: 'mono', text: me.evm })]),
        el('p', { class: 'dim', text: 'The wallet page can ask this keychain to sign. It cannot sign by itself, and it never sees this key.' + (pending ? '' : ' Requests appear here for you to confirm.') }),
        btn('Show my recovery code', trusted(function () { code.hidden = !code.hidden; code.textContent = code.hidden ? '' : K.encodeRecoveryCode(root); })), btn('Lock', trusted(function () { lock(); })), code);
      return;
    }
    var known = mem.get('kc.enrolled') === '1', input = el('input', { 'aria-label': 'Recovery code', autocomplete: 'off', spellcheck: 'false', placeholder: 'bdidrec1…' });
    show(el('h1', { text: known ? 'Unlock your isolated keychain' : 'Your isolated keychain' }),
      el('p', { text: known ? 'Your passkey for keys.skaists.dev opens it.' : 'It lives at keys.skaists.dev, apart from the wallet page. A new passkey makes a new key that the wallet page never sees.' }),
      pending ? el('p', { text: 'A payment is waiting. Unlock to review it.' }) : '',
      known ? btn('Unlock with my passkey', trusted(unlock), 'go') : btn('Make my keychain', trusted(make), 'go'),
      known ? btn('Make a new keychain', trusted(make)) : btn('I already have one', trusted(unlock)),
      el('details', {}, [el('summary', { text: 'Open with a recovery code' }), input, btn('Open', trusted(function () { fromCode(input); }))]));
  }
  render(); publish();
})();
