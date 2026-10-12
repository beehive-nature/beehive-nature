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
   'evm:' + the DID, so a name (the .b layer) never shapes a key. The Hive posting key's
   context is 'hive-posting:' + the account: a Hive authority belongs to a chain account, so
   here the account — like the EVM chain id — is what the signature is FOR, never a .b name.

   WHAT IT SIGNS (this phase): Autonomi storage payments on Arbitrum One — an approve of the ANT
   token to the pinned storage vault, or payForQuotes on that vault — and Hive drops: one root
   post (a bDroP comment) under its posting authority, nothing that can move funds. Every
   request is decoded HERE and shown on a confirm card; only a trusted press inside this page
   signs, after the card has been visibly on screen. Anything else is refused before the key is
   touched.

   WHAT IT DOES NOT CLAIM: it does not protect against a wallet page that replaces this frame
   with a look-alike before you unlock (check the address bar of a popped-out keychain), and it
   does not make a root that has lived in the wallet page safe — that root is rotated away from,
   never imported. */
(function () {
  'use strict';
  var ORIGIN = 'https://keys.skaists.dev', PARENTS = ['https://skaists.dev']; /* KC-ORIGINS — scripts/build-keychain.mjs --origin/--parent rewrites THIS line only in the built copy for a replacement origin; the source line is the production truth */
  var CHAIN = 42161, CHAIN_NAME = 'Arbitrum One';
  var TOKEN = '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684'; // PUBLIC-CONSTANT: ANT (Autonomi) on Arbitrum One
  var VAULT = '0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26'; // PUBLIC-CONSTANT: Autonomi PaymentVaultV2 (e2e/ant-pay-vector.json)
  var MAX_GAS = 3000000n, PRESS_DELAY_MS = 700, VALID_UNTIL = 4102444800; // 2100-01-01T00:00:00Z
  var main = document.getElementById('kc');
  var HIVE_CHAIN = 'beeab0de00000000000000000000000000000000000000000000000000000000'; // PUBLIC-CONSTANT: Hive mainnet chain id (public network parameter)

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
  if (framed && ancestors && !ancestors.every(function (o) { return PARENTS.indexOf(o) >= 0; })) return stop('This keychain only opens on its own, or inside the wallet at ' + (PARENTS.join(' or ') || 'its home origin') + '.');
  if (!window.BZDIDKEY || !window.BnrSign || !window.BZGENESIS || !window.hiveTx) return stop('Part of the keychain did not load, so it holds and signs nothing. Reload to try again.');
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
  var mem = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };
  function evmAddress(seed) { return '0x' + hex(B.keccak_256(B.secp.getPublicKey(seed, false).slice(1)).slice(12)); }
  function identity() {
    var r0 = K.deriveRecordKey(root, 'bzdid/rotation/r0'), sg = K.deriveRecordKey(root, 'bzdid/signing');
    try {
      var op = G.build({ rotationKeys: [{ alg: 'ed25519', key: r0.publicKey }], signingKey: { alg: 'ed25519', key: sg.publicKey }, services: [], alsoKnownAs: [], validUntil: VALID_UNTIL });
      var did = G.didOf(op, B.sha256), k = K.deriveK1Key(root, 'evm:' + did);
      try { return { did: did, genesis: hex(op), evm: evmAddress(k.seed) }; } finally { k.seed.fill(0); }
    } finally { r0.seed.fill(0); sg.seed.fill(0); }
  }
  function open(secret, how, expectDid) {
    if (root) root.fill(0);
    root = null; me = null;
    root = how === 'prf' ? K.masterPrkFromPrfSecret(secret) : secret.slice();
    if (secret) secret.fill(0);
    me = identity();
    if (expectDid && me.did !== expectDid) { var got = me.did; lock(true); return stop('This passkey opened a different keychain than the one stored here (' + got + '). Nothing was unlocked; nothing was signed.'); }
    mem.set('kc.did', me.did); mem.set('kc.enrolled', '1');
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

  /* ── re-enrollment: keep THIS identity, bind a passkey born at another (or this) origin ──
     A passkey's PRF output derives the root directly only where that passkey was born; a
     replacement origin's new passkey knows nothing of it. So after opening the same keychain
     from its recovery code, the new passkey does not re-derive the root — it WRAPS it: the
     root is sealed under an AES-GCM key domain-separated from the PRF secret, and only the
     sealed blob is stored. Unlock then unwraps and checks it reconstitutes the stored DID,
     so an identity can never silently change under a stored wrap. The gesture also signs the
     succession record with the identity's own r0 rotation key: whoever holds the public
     genesis can verify, without trusting this page, that the DID authorized the new origin. */
  var WRAP_KEY = 'kc.wrapped.v1', te = new TextEncoder();
  function cat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  async function sealRoot(prfSecret) {
    var ws = B.sha256(cat(prfSecret, te.encode('bdid/wrap/v1'))); // domain-separated from both the born-here derivation and anything else the PRF feeds
    var wk = K.masterPrkFromPrfSecret(ws); ws.fill(0);
    var key = await crypto.subtle.importKey('raw', wk, 'AES-GCM', false, ['encrypt', 'decrypt']);
    wk.fill(0);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, root));
    return { v: 1, at: new Date().toISOString(), did: me.did, iv: hex(iv), ct: hex(ct) };
  }
  async function openSeal(w, prfSecret) {
    var ws = B.sha256(cat(prfSecret, te.encode('bdid/wrap/v1')));
    var wk = K.masterPrkFromPrfSecret(ws); ws.fill(0);
    var key = await crypto.subtle.importKey('raw', wk, 'AES-GCM', false, ['encrypt', 'decrypt']);
    wk.fill(0);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(w.iv) }, key, bytes(w.ct)));
  }
  function successionBody() {
    // fixed literal key order: this exact JSON.stringify output is what r0 signs
    return { v: 1, what: 'bzDiD keychain origin succession', did: me.did, to_origin: ORIGIN, passkey_rp: location.hostname, at: new Date().toISOString() };
  }
  function successionRecord() {
    var r0 = K.deriveRecordKey(root, 'bzdid/rotation/r0');
    try {
      var body = successionBody();
      return { body: body, genesis: me.genesis, r0: hex(r0.publicKey), sig: hex(r0.sign(te.encode(JSON.stringify(body)))) };
    } finally { r0.seed.fill(0); }
  }
  async function reenroll() {
    if (!me) return;
    try {
      await K.enrollPasskey('bzDiD keychain', 'bzDiD keychain'); // one ceremony makes the passkey
      var prf = await K.getPrfSecret(); // one ceremony proves it can open what is about to be sealed
      var w;
      try {
        w = await sealRoot(prf);
        var probe = await openSeal(w, prf);
        var keep = root; root = probe; var id2 = identity(); root = keep; probe.fill(0);
        if (id2.did !== me.did) throw new Error('The seal re-opened as a different identity; it was not kept.');
      } finally { prf.fill(0); }
      mem.set(WRAP_KEY, JSON.stringify(w));
      showRecord(successionRecord());
    } catch (e) { mem.del(WRAP_KEY); failSay(e); }
  }

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
    else if (m.t === 'kc.hive.pub') pubHive(m);
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
    if (m.hive && m.tx) return post({ t: 'kc.refused', v: 1, id: m.id, reason: 'A request carries one kind: a storage payment or a Hive drop' });
    if (!m.hive && !m.tx) return post({ t: 'kc.refused', v: 1, id: m.id, reason: 'No request was sent' });
    pending = { id: m.id, tx: m.tx, hive: m.hive || null, at: Date.now() };
    setTimeout(function () { if (pending && pending.id === m.id) refuse('The request waited too long and was refused.'); }, 300000);
    render();
  }
  function pubHive(m) {
    if (typeof m.id !== 'string' || m.id.length > 64) return;
    var account = String((m && m.account) || '');
    if (!/^[a-z0-9.-]{3,16}$/.test(account)) return post({ t: 'kc.refused', v: 1, id: m.id, reason: 'That is not a Hive account name' });
    if (!me) return post({ t: 'kc.refused', v: 1, id: m.id, reason: 'Unlock your isolated keychain to name its Hive posting key' });
    var k = K.deriveK1Key(root, 'hive-posting:' + account);
    try { post({ t: 'kc.hive.pubbed', v: 1, id: m.id, account: account, pub: String(new window.hiveTx.PublicKey(B.secp.getPublicKey(k.seed, true))) }); }
    finally { k.seed.fill(0); }
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

  /* ── Hive drops: one disclosed root post, posting authority only ──
     The caller builds the transaction against its own RPC (the keychain's CSP
     forbids every network call), but the keychain serializes and signs ITS OWN
     copy of the structured transaction with the same vendored hive-tx the
     wallet uses — so what the card shows is what is signed, and an opaque
     digest from any page can never be signed at all. */
  function hiveDigestOf(tx) {
    var t = new window.hiveTx.Transaction([]);
    t.created = true; t.transaction = JSON.parse(JSON.stringify(tx));
    var d = t.digest(); // sha256(Hive mainnet chain id || serialized tx), the same bytes a node recovers
    return { bytes: Uint8Array.from(Array.isArray(d.digest) ? d.digest : String(d.digest).split(',').map(Number)), txId: d.txId };
  }
  function decideHive(hv) {
    if (!hv || typeof hv !== 'object') throw new Error('No Hive drop was sent');
    var account = String(hv.account || '');
    if (!/^[a-z0-9.-]{3,16}$/.test(account)) throw new Error('That is not a Hive account name');
    var tx = hv.tx;
    if (!tx || typeof tx !== 'object') throw new Error('No transaction was sent');
    if (!Array.isArray(tx.operations) || tx.operations.length !== 1) throw new Error('This keychain signs one drop per request');
    var op = tx.operations[0];
    if (!Array.isArray(op) || op.length !== 2 || op[0] !== 'comment') throw new Error('This keychain signs Hive comment drops only');
    var c = op[1];
    if (!c || typeof c !== 'object') throw new Error('The drop is empty');
    if (c.parent_author !== '') throw new Error('A drop is a new root post; this one carries a reply');
    if (String(c.author || '').toLowerCase() !== account) throw new Error('The drop names another author than its account');
    if (!/^[a-z0-9-]{1,32}$/.test(String(c.parent_permlink || ''))) throw new Error('The community tag is malformed');
    var pl = String(c.permlink || '');
    if (!/^[a-z0-9-]{1,256}$/.test(pl)) throw new Error('The permlink is malformed');
    var title = String(c.title || '');
    if (te.encode(title).length > 256) throw new Error('The title is too long');
    var body = String(c.body || ''), bl = te.encode(body).length;
    if (!bl) throw new Error('The drop has no body');
    if (bl > 65536) throw new Error('The drop is past the 64 KB post cap');
    var meta;
    try { meta = JSON.parse(String(c.json_metadata || '')); } catch (e) { throw new Error('The drop metadata is not JSON'); }
    var disc = meta && typeof meta.disclosure_version === 'string' ? meta.disclosure_version : '';
    if (!/^bdrop-[0-9a-z-]{1,32}-disclosure-v[0-9]+$/.test(disc)) throw new Error('This keychain signs disclosed bDroP editions only');
    if (!Array.isArray(tx.extensions) || tx.extensions.length) throw new Error('The transaction carries extensions this keychain does not sign');
    if (!Number.isSafeInteger(tx.ref_block_num) || tx.ref_block_num < 0 || tx.ref_block_num > 65535) throw new Error('The reference block number is out of bounds');
    if (!Number.isSafeInteger(tx.ref_block_prefix) || tx.ref_block_prefix < 0 || tx.ref_block_prefix > 4294967295) throw new Error('The reference block prefix is out of bounds');
    var exp = String(tx.expiration || ''), et = Date.parse(exp.length === 19 ? exp + 'Z' : exp);
    if (!Number.isFinite(et)) throw new Error('The expiration is not a moment');
    if (et > Date.now() + 3600000) throw new Error('The expiration is more than an hour ahead');
    if (et < Date.now() - 60000) throw new Error('The transaction has already expired');
    var g = hiveDigestOf(tx); // what does not serialize never reaches a card
    if (g.bytes.length !== 32) throw new Error('The transaction did not serialize');
    return { what: 'Publish the drop @' + account + '/' + pl + ' on Hive (posting authority — no funds can move)', account: account, permlink: pl, tx: tx, bodySha: hex(B.sha256(te.encode(body))), bodyLen: bl, disclosure: disc, expires: exp };
  }
  function signHive(d) {
    var k = K.deriveK1Key(root, 'hive-posting:' + d.account); // the account is the chain authority this signature is FOR; a .b name never shapes a key
    try {
      var g = hiveDigestOf(d.tx);
      var sig = B.secp.sign(g.bytes, k.seed); // deterministic nonce, low-S: the same recoverable form Hive nodes expect
      var raw = (sig.recovery + 31).toString(16) + sig.toCompactHex(); // 130 hex: recovery byte +31, then compact r||s
      var pub = String(new window.hiveTx.PublicKey(B.secp.getPublicKey(k.seed, true)));
      return { raw: raw, hash: g.txId, pub: pub };
    } finally { k.seed.fill(0); }
  }

  /* ── what you see ── */
  function btn(text, fn, cls) { return el('button', { type: 'button', class: cls || '', text: text, on: { click: fn } }); }
  function trusted(fn) { return function (ev) { if (ev && ev.isTrusted) fn(ev); }; }
  function failSay(e) { show(el('h1', { text: 'bzDiD keychain' }), el('p', { text: (e && e.message) || String(e) }), btn('Back', function () { render(); })); }
  async function make() { try { var r = await K.enrollPasskey('bzDiD keychain', 'bzDiD keychain'); if (!r.prfEnabled) mem.set('kc.prf-unconfirmed', '1'); mem.del(WRAP_KEY); open(await K.getPrfSecret(), 'prf'); } catch (e) { failSay(e); } }
  async function unlock() {
    try {
      var wrapped = mem.get(WRAP_KEY);
      if (wrapped) { /* this profile's passkey opens a seal, not a birth derivation */
        var w = JSON.parse(wrapped), prf = await K.getPrfSecret(), r;
        try { r = await openSeal(w, prf); } finally { prf.fill(0); }
        open(r, 'wrapped', w.did);
      } else open(await K.getPrfSecret(), 'prf');
    } catch (e) { failSay(new Error('This passkey did not open a keychain stored here.')); }
  }
  function fromCode(input) { try { open(K.decodeRecoveryAuto(input.value.trim()), 'code'); input.value = ''; } catch (e) { input.value = ''; failSay(new Error('That recovery code did not open a keychain.')); } }
  function confirmCard() {
    var hive = !!pending.hive, d;
    try { d = hive ? decideHive(pending.hive) : decide(pending.tx); } catch (e) { refuse(e.message); return; }
    // The press counts only after the whole card has been visible and unobscured for
    // PRESS_DELAY_MS without a break. Only browsers with IntersectionObserver v2 (isVisible)
    // can prove "unobscured"; elsewhere the keychain refuses rather than guesses.
    var go = btn(hive ? 'Sign this drop' : 'Sign this payment', null, 'go'), visibleSince = null, visible = false, provable = false;
    go.disabled = true;
    var ready = function () { go.disabled = !(provable && visible && visibleSince !== null && performance.now() - visibleSince >= PRESS_DELAY_MS); };
    var seen = function (v) { if (v && !visible) { visibleSince = performance.now(); setTimeout(ready, PRESS_DELAY_MS + 10); } if (!v) visibleSince = null; visible = v; ready(); };
    go.addEventListener('click', trusted(function () {
      ready(); if (go.disabled || !pending) return;
      var p = pending; pending = null;
      try {
        var s = hive ? signHive(d) : sign(d);
        post({ t: 'kc.signed', v: 1, id: p.id, raw: s.raw, hash: s.hash, kind: hive ? 'hive' : 'evm', pub: s.pub || null });
      } catch (e) { post({ t: 'kc.refused', v: 1, id: p.id, reason: 'Signing failed: ' + e.message }); }
      render();
    }));
    var rows = hive
      ? [el('dt', { text: 'Network' }), el('dd', { text: 'Hive mainnet' }),
         el('dt', { text: 'From' }), el('dd', { class: 'mono', text: '@' + d.account + ' (posting authority)' }),
         el('dt', { text: 'Drop' }), el('dd', { class: 'mono', text: '@' + d.account + '/' + d.permlink }),
         el('dt', { text: 'Body' }), el('dd', { class: 'mono', text: d.bodyLen.toLocaleString() + ' bytes · sha-256 ' + d.bodySha }),
         el('dt', { text: 'Disclosure' }), el('dd', { class: 'mono', text: d.disclosure }),
         el('dt', { text: 'Expires' }), el('dd', { text: d.expires + ' UTC' })]
      : [el('dt', { text: 'Network' }), el('dd', { text: CHAIN_NAME }), el('dt', { text: 'From' }), el('dd', { class: 'mono', text: me.evm }),
        el('dt', { text: 'Contract' }), el('dd', { class: 'mono', text: d.to }), el('dt', { text: 'Network fee, at most' }), el('dd', { text: d.maxEth + ' ETH' }),
        el('dt', { text: 'Sequence' }), el('dd', { text: d.nonce.toString() })];
    var card = el('section', { 'aria-label': hive ? 'Drop to confirm' : 'Payment to confirm' }, [
      el('h1', { text: 'Confirm in your keychain' }),
      el('p', { text: d.what + '.' }),
      el('dl', {}, rows),
      go, btn('Refuse', trusted(function () { refuse(hive ? 'You refused this drop in your keychain.' : 'You refused this payment in your keychain.'); }))
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
  function showRecord(rec) {
    var txt = JSON.stringify(rec);
    show(el('h1', { text: 'Re-enrolled for this origin' }),
      el('p', { text: 'A passkey for ' + location.hostname + ' now opens this same keychain here — identity ' + rec.body.did + ', unchanged. The seal it opens holds only this identity, and the record below is signed by that identity\u2019s own rotation key: anyone holding the public genesis can verify the succession without trusting this page.' }),
      el('p', { class: 'mono', text: txt }),
      btn('Copy the record', trusted(function () { try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) {} })),
      btn('Back', function () { render(); publish(); }));
  }
  function render() {
    if (watcher) { watcher.disconnect(); watcher = null; }
    if (!greeted) { show(el('p', { class: 'dim', text: 'Waiting for the heART WALLet…' })); return; }
    if (pending && me) { var c = confirmCard(); if (c) show(c); return; }
    if (me) {
      var code = el('p', { class: 'mono', hidden: '' });
      show(el('h1', { text: 'Your isolated keychain is open' }),
        el('dl', {}, [el('dt', { text: 'Identity' }), el('dd', { class: 'mono', text: me.did }), el('dt', { text: 'Arbitrum account' }), el('dd', { class: 'mono', text: me.evm })]),
        el('p', { class: 'dim', text: 'The wallet page can ask this keychain to sign. It cannot sign by itself, and it never sees this key.' + (pending ? '' : ' Requests appear here for you to confirm.') }),
        btn('Show my recovery code', trusted(function () { code.hidden = !code.hidden; code.textContent = code.hidden ? '' : K.encodeRecoveryCode(root); })), btn('Lock', trusted(function () { lock(); })),
        el('details', {}, [el('summary', { text: 'New origin, or lost passkey? Re-enroll here' }),
          el('p', { class: 'dim', text: 'If this keychain was recovered here from its recovery code, one press enrolls a passkey for ' + location.hostname + ' that opens this same identity at this origin (sealed under that passkey, DID-checked at every unlock), and signs the succession record with the rotation key. Nothing else changes; the recovery code keeps working.' }),
          btn('Re-enroll a passkey for this origin', trusted(reenroll), 'go')]),
        code);
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
