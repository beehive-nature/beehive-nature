/* myspace.js — MY SPACE, the shell (`bee` authored first; one DOM, three registers).

   Order: PLANS/MYSPACE_01_SLICE.md (founder events ebedeaf6 / 9bc95b29); slice 03
   cut by the coordinator seat 2026-09-20 21:12Z — the two rails that do not speak
   to the world, behind the seam slice 02 built.
   Comps: OUTBOX/2026-09-20_MYSPACE_COMPS/myspace-comp.html.

   THIS FILE KNOWS NO RAIL, AND AS OF THIS SLICE IT NO LONGER KNOWS WHAT ANY RAIL
   DOES EITHER. Slice 02 moved the routes and the wire format behind the boundary
   but kept the CONSEQUENCES here — "an open copy sits in the hive at its hash",
   "no rail record exists" — because with one rail there was no way to tell a
   fact about a store from a fact about storage. There are three rails now and
   they answer differently, so those sentences are built from what the attached
   adapter DECLARES (`describe().x_terms`: deletable? / who reads? / how long? /
   who paid?, the founder's four questions, direction relayed 2026-09-20 20:21Z).

   THE VISITOR CHOOSES A PURPOSE; THE SHELL CHOOSES THE RAIL. Also the founder's
   shape. A purpose is a PREDICATE OVER DECLARED TERMS, not a rail name — which
   is what makes rails 4, 5 and 6 additive instead of another branch here, and
   what makes a purpose with no rail behind it disappear from the page rather
   than fail when it is tapped.

   WHAT STAYS THE SHELL'S, AND ONLY THIS: the device key, the signature over an
   adapter's digest, the retry decision, the index, and the words.

   THE PRIVACY PROMISE IS NOW STRUCTURAL, NOT A CODE PATH. Slice 02 held it by
   "the private path never calls railOp" — true, but it was a property of there
   being exactly one rail and that rail being the network. The rule here is
   stronger and survives more rails: a purpose that is not `share` will not be
   routed to ANY adapter whose declared `networks` list is non-empty. The two
   local rails declare `[]`, contain no network primitive at all, and
   `e2e/myspace-seam.mjs` counts zero requests while they are used. A promise
   about bytes not leaving is worth what it can be measured at.

   WHAT THE LOCAL RAILS HOLD, THEY CANNOT READ. The shell encrypts before it
   hands anything to a keep-it-here rail and keeps the key in the page, so §4 is
   a shape rather than a rule those adapters promise to obey: there is no key
   over there to hold.

   The device index is still the truth. That is what makes "come back later and
   find it" true by construction rather than by promise. */
(function () {
  'use strict';

  var JOIN_DOOR = 'https://skaists.dev/join/';
  var DB_NAME = 'myspace';
  var DB_VERSION = 2;
  var SK_KEY = 'myspace.device-secret.v1';

  /* ---------- small helpers ---------- */

  function $(id) { return document.getElementById(id); }
  function hex(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
    return out;
  }
  function fromHex(h) {
    var u = new Uint8Array(h.length / 2);
    for (var i = 0; i < u.length; i++) u[i] = parseInt(h.substr(2 * i, 2), 16);
    return u;
  }
  function kb(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /* ---------- identity: one key, generated once in this browser, never sent ----------
     The estate's bzdid-key.js mints an identity from a passkey or a recovery phrase — both
     are ceremonies, and a stranger who just wants to keep a file should not be marched
     through one. This is the dispatch's own "persistent browser-local key" shape
     (docs/dispatches/2026-09-04-buzz-join-by-address.md): generated once, kept here,
     honestly labeled. Upgrading it to a passkey-derived identity is a later slice. */

  function deviceSecret() {
    var stored = null;
    try { stored = localStorage.getItem(SK_KEY); } catch (e) { stored = null; }
    if (stored && /^[0-9a-f]{64}$/.test(stored)) return fromHex(stored);
    var sk = crypto.getRandomValues(new Uint8Array(32));
    try { localStorage.setItem(SK_KEY, hex(sk)); } catch (e) { /* private mode: key lives for this page only, and the index will not persist either */ }
    return sk;
  }

  var SK = deviceSecret();

  function signer() {
    var B = (typeof BnrSign !== 'undefined') ? BnrSign : null;
    if (!B || !B.schnorr) return null;
    return B.schnorr;
  }

  function devicePubkey() {
    var s = signer();
    if (!s) return null;
    return hex(s.getPublicKey(SK));
  }


  /* ---------- the device index: this device is the truth ---------- */

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
        /* v2 held private bytes here. As of slice 03 the LOCAL RAIL holds them, in
           its own database; this store is kept only so that rows written before
           slice 03 can be moved across on first read, and it empties as they are.
           See `legacyBytes` below — the store is not written to any more. */
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(store, mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var req = fn(t.objectStore(store));
        t.oncomplete = function () { resolve(req && req.result); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  function allRows() { return tx('files', 'readonly', function (s) { return s.getAll(); }); }
  function putRow(row) { return tx('files', 'readwrite', function (s) { return s.put(row); }); }
  function dropRow(id) { return tx('files', 'readwrite', function (s) { return s.delete(id); }); }
  function putKey(id, key) { return tx('keys', 'readwrite', function (s) { return s.put(key, id); }); }
  function getKey(id) { return tx('keys', 'readonly', function (s) { return s.get(id); }); }
  function dropKey(id) { return tx('keys', 'readwrite', function (s) { return s.delete(id); }); }
  function legacyBytes(id) { return tx('blobs', 'readonly', function (s) { return s.get(id); }); }
  function dropLegacy(id) { return tx('blobs', 'readwrite', function (s) { return s.delete(id); }); }

  /* ---------- the rails ----------
     Four adapters, one contract, one seam. Two of them speak to nothing at all,
     which is the whole reason the coordinator put them before HIVE, ANT and AR:
     if the boundary does not hold for a rail with no account, no key, no network
     and no approval, we learn it for nothing.

     Every adapter runs in its own dedicated Web Worker behind
     SPEC-ADAPTER-CONTRACT-1 (§1, §2) and a fault in one is one dead rail, never
     the page (§6). Spawning them all at load touches no network: `describe` is
     answered inside each worker, and the page needs their answers before it can
     honestly offer a purpose. */

  var RAILS = [
    { scheme: 'temp', script: 'myspace-adapter-temp.js' },
    { scheme: 'local', script: 'myspace-adapter-local.js' },
    { scheme: 'blossom', script: 'myspace-adapter-blossom.js' },
    { scheme: 'ant', script: 'myspace-adapter-ant.js' }
  ];

  /* The adapters' own codes. §6: an adapter answers with a code, never a
     plain-language string the shell has to parse to learn what happened. */
  var MEMBERSHIP_REQUIRED = -32020;
  var NOT_PERMITTED = -32023;
  var NOT_FOUND = -32024;

  var adapters = {};
  var joined = {};

  function rail(scheme) {
    if (!adapters[scheme]) {
      var def = null;
      for (var i = 0; i < RAILS.length; i++) if (RAILS[i].scheme === scheme) def = RAILS[i];
      if (!def) throw new Error('no rail called ' + scheme);
      if (!window.BnrSeam) throw new Error('the adapter seam did not load, so this page has no rails at all');
      adapters[scheme] = window.BnrSeam.spawn(scheme, def.script);
    }
    return adapters[scheme];
  }

  /* A rail's declared terms, or null. NULL IS A REFUSAL, NOT A DEFAULT: an
     adapter that will not say who reads its bytes and for how long gets no
     purpose routed to it, the same way §9.1 gives an adapter that will not
     describe itself no attachment at all. A missing answer must never read as a
     harmless one. */
  function terms(scheme) {
    var a = adapters[scheme];
    if (!a || !a.attached || !a.caps) return null;
    var t = a.caps.x_terms;
    if (!t) return null;
    if (typeof t.deletable !== 'boolean' || typeof t.survives_reload !== 'boolean') return null;
    if (!t.readers || !t.lifetime || !t.payer) return null;
    return t;
  }

  function speaksToTheWorld(scheme) {
    var a = adapters[scheme];
    return !!(a && a.caps && (a.caps.networks || []).length);
  }

  /* ---------- purposes ----------
     The visitor picks one of these; the shell picks the rail. A purpose is a
     predicate over DECLARED TERMS and never a rail name, so a fourth rail that
     answers the predicate is offered with no edit here, and a purpose no
     attached rail can answer is not shown at all rather than failing on tap.

     `allowNetwork` is the privacy promise made structural: only `share` may be
     routed to an adapter that declares any network. */
  var PURPOSES = [
    {
      id: 'now', allowNetwork: false,
      wants: function (t) { return t.survives_reload === false && t.readers === 'this-device'; }
    },
    {
      id: 'keep', allowNetwork: false,
      wants: function (t) { return t.survives_reload === true && t.readers === 'this-device'; }
    },
    {
      id: 'share', allowNetwork: true,
      wants: function (t) { return t.readers === 'link-holders'; }
    },
    /* Rail 4 (ruling 06:27Z). Last because it sends bytes furthest: readable
       by anyone, for as long as the network lasts, with no delete. Its own
       predicate rather than a widened `share`, because `railFor` takes the
       FIRST rail that answers and `share` would never reach past the hive. */
    {
      id: 'forever', allowNetwork: true,
      wants: function (t) { return t.readers === 'everyone' && t.lifetime === 'permanent' && t.deletable === false; }
    }
  ];

  function purposeById(id) {
    for (var i = 0; i < PURPOSES.length; i++) if (PURPOSES[i].id === id) return PURPOSES[i];
    return null;
  }

  function railFor(id) {
    var p = purposeById(id);
    if (!p) return null;
    for (var i = 0; i < RAILS.length; i++) {
      var scheme = RAILS[i].scheme;
      var t = terms(scheme);
      if (!t) continue;
      if (!p.allowNetwork && speaksToTheWorld(scheme)) continue;
      if (p.wants(t)) return scheme;
    }
    return null;
  }

  function availablePurposes() {
    return PURPOSES.filter(function (p) { return !!railFor(p.id); });
  }

  /* ---------- speaking to a rail ----------
     THE SHAPE COMES FROM THE DECLARATION, NOT FROM THE RAIL'S NAME. Blossom
     authenticates every request, so §4 (an adapter holds no key) forces two
     halves: `begin*` returns a digest, the page signs it with the key that has
     never left it, `submit*` speaks to the rail. The two local rails
     authenticate nothing, so they declare single-shot methods — a signature over
     nothing would be a ceremony, and a ceremony is a signal prettier than the
     truth (CLAUDE.md §2.10).

     This function reads which shape an adapter declared and takes it. That is
     §9.2 doing the work it exists to do: `ops` is built from the adapter's own
     list, so an undeclared method has no function to call and no message is
     dispatched. `intent_id` is the idempotency key and a failed submit KEEPS its
     intent, so the retry resubmits identical bytes under an identical signature
     (§6). The shell owns the retry; no adapter has one. */

  function cap(verb) { return verb.charAt(0).toUpperCase() + verb.slice(1); }

  async function signDigest(digest) {
    var s = signer();
    if (!s) throw new Error('signer unavailable');
    return hex(await s.sign(fromHex(digest), SK));
  }

  async function railOp(scheme, verb, params) {
    var a = rail(scheme);
    await a.ready;
    var p = params || {};

    var single = 'x.' + verb;
    if (a.can(single)) return a.ops[single](p);

    /* The third shape: the rail PRICES, a payment is made, the rail STORES.
       Read from the declaration like the other two. */
    if (verb === 'put' && a.can('x.preparePut') && a.can('x.finalizePut')) return paidPut(a, p.bytes);

    var begin = 'x.begin' + cap(verb);
    var submit = 'x.submit' + cap(verb);
    if (!a.can(begin) || !a.can(submit)) throw new Error(scheme + ' does not declare ' + verb);

    p.pubkey = devicePubkey();
    if (!p.pubkey) throw new Error('signer unavailable');
    var intent = await a.ops[begin](p);
    var sig = await signDigest(intent.digest);
    try {
      return await a.ops[submit]({ intent_id: intent.intent_id, sig: sig });
    } catch (e) {
      if (e.code !== MEMBERSHIP_REQUIRED || verb === 'join' || !a.can('x.beginJoin')) throw e;
      await joinRail(scheme);
      /* The IDENTICAL intent and the IDENTICAL signature. The shell resubmits; it
         never re-signs and never builds a second intent (§6). */
      return a.ops[submit]({ intent_id: intent.intent_id, sig: sig });
    }
  }

  async function joinRail(scheme) {
    if (joined[scheme]) return true;
    /* Said at the moment it happens, not in a footnote: this puts the visitor's own key
       in that rail's member list. It is the price of the rail and they should read it as
       it is paid. */
    setStatus(t('joining'), false, true);
    await railOp(scheme, 'join', {});
    joined[scheme] = true;
    return true;
  }

  /* ---------- a rail the visitor pays for ----------
     The rail prices the file (the door reads it to self-encrypt and quote),
     `payFor` pays the plan it returns, and the rail stores against that
     payment. `sent` and `paid` travel on the error so the sentence the
     visitor reads afterwards says what really left the phone.

     THIS PAGE CANNOT PAY YET. `PAY_ARMS` is empty, so `payFor` refuses every
     plan by name and the wallet is never asked for anything. Paying is slice W
     (ruling 795cce0e): it wires the estate's one payer, surfaces/ant-pay.js,
     with the price shown and accepted before anything is signed. There is no
     wallet code in this file, and there must not be a second payer here. */

  var NOTHING_SENT = [-32030, -32031];   // the adapter's DOOR_CLOSED and TOO_LARGE: thrown before its POST

  var PAY_ARMS = {};

  async function payFor(plan) {
    var arm = PAY_ARMS[plan && plan.payment_type];
    if (!arm) throw new Error('this page cannot pay a ' + (plan && plan.payment_type) + ' plan yet, so it will not ask your wallet to');
    var txs = await arm(plan);
    if (!Array.isArray(txs) || !txs.length) throw new Error('the payment step returned no payment');
    return txs;
  }

  async function paidPut(a, bytes) {
    setStatus(t('pricing'), false, true);
    var prep;
    try {
      prep = await a.ops['x.preparePut']({ bytes: bytes }, 180000);
    } catch (e) {
      if (NOTHING_SENT.indexOf(e.code) < 0) e.sent = true;
      throw e;
    }
    var txs = null;
    try {
      txs = await payFor(prep.plan);
      setStatus(t('working'), false, true);
      return await a.ops['x.finalizePut']({ intent_id: prep.intent_id, txs: txs }, 180000);
    } catch (e) {
      e.sent = true;
      if (txs) e.paid = txs.map(function (x) { return x.tx_hash; });
      throw e;
    }
  }

  /* What left the phone, said after a paid act fails. Paid-and-not-stored is
     the stranded-payment case (SPEC-AUTONOMI-TREZOR-1 §4), and the hashes are
     the visitor's receipt for it, so they are printed, not summarised. */
  function leftSaying(e) {
    if (e.paid) return ' You paid (' + e.paid.join(', ') + ') and the file was not confirmed as stored; keep those payment ids.';
    if (e.sent) return ' The estate\'s door saw the file to price it; nothing was stored and nothing was paid.';
    return '';
  }

  function railPut(scheme, bytes) { return railOp(scheme, 'put', { bytes: bytes }); }
  function railGet(scheme, address) { return railOp(scheme, 'get', { address: address }); }

  /* A rail that does not declare `x.drop` has no delete, and the page must not
     pretend otherwise. `deletable` in the declared terms and the presence of the
     method are two statements of one fact; disagreeing with each other is the
     one thing they must not do, so the gate asserts they agree. */
  async function railDrop(scheme, address) {
    var a = rail(scheme);
    await a.ready;
    if (!a.can('x.drop')) return { dropped: false };
    return a.ops['x.drop']({ address: address });
  }

  /* ---------- copy, per register ----------
     CHARACTER PER REGISTER; FACTS FROM THE RAIL. Everything a rail knows about
     itself now arrives through `x_terms` and is rendered by `termsLine` below.
     What is left in here is voice.

     DELETED, NOT PATCHED (CLAUDE.md §2.10, the flag raised by the eye seat
     2026-09-20 21:10Z): the cypherpunk register used to carry
     `'plaintext blob on the rail at its sha256.'` and
     `'ciphertext in local store. no rail record exists.'` as its `why` lines,
     plus route literals in its mode bodies and status lines. The first was
     already false when the row started reading `blossom:<address>`; the second
     became false the moment a local rail existed to hold a record. A false
     signal is deleted, not repaired — the shell no longer names a rail, so its
     copy does not either. */

  var COPY = {
    bee: {
      kicker: 'My Space', title: 'My Space',
      lede: 'Your files live on this phone.',
      empty: 'Nothing here yet. Add a file from this phone. You choose what it is for.',
      attach: 'Add a file',
      'now-title': 'Just for now', 'now-body': 'For this visit only.',
      'keep-title': 'Keep it here', 'keep-body': 'Yours, on this phone.',
      'share-title': 'Show the world', 'share-body': 'Give someone the link.',
      'forever-title': 'Keep it forever', 'forever-body': 'Put it out in the open, for good.',
      pricing: 'Asking what it costs. The estate\'s door reads the file to price it.',
      joining: 'Putting this phone in the hive — that is what lets it hold a file, and what lets a link open.',
      copy: 'Copy link', move: 'Move it', open: 'Open',
      working: 'Putting it away…', done: 'Done.',
      opening: 'Opening it…',
      flipping: 'Moving it…',
      'move-to': function (n) { return 'Move it: ' + n; },
      remove: 'Remove', keep: 'Keep it', confirm: 'Remove from this phone',
      'flip-keep': 'Leave it as it is',
      swept: function (n) { return n === 1 ? 'One file was only for that visit, and it is gone.' : n + ' files were only for that visit, and they are gone.'; },
      law: 'This phone remembers. There is no account. Come back later on this phone and it is still here.',
      'tech-summary': 'index · rails · identity',
      count: function (n) { return n === 1 ? '1 file on this phone' : n + ' files on this phone'; }
    },
    raver: {
      kicker: 'my space', title: 'my space',
      lede: 'yours. this phone. one tap.',
      empty: 'drop a file in.',
      attach: 'add a file',
      'now-title': 'just now', 'now-body': 'this visit. that is all.',
      'keep-title': 'keep it', 'keep-body': 'yours. this phone.',
      /* `share-body` is the ACT, never the terms: the rail's own readers line in
         this register is already 'the link opens it.', and a card that prints
         the same sentence twice reads as a stutter rather than as two facts.
         Caught on the live page by the eye seat 2026-09-20 22:51Z. The row that
         keeps it dead is in `e2e/myspace-seam.mjs` §14 and it judges every
         register, not this one line. */
      'share-title': 'show it', 'share-body': 'put it out there.',
      'forever-title': 'forever', 'forever-body': 'out in the open. for good.',
      pricing: 'pricing it. the estate door reads it to quote.',
      joining: 'this phone is joining the hive. that is what makes a link open.',
      copy: 'copy link', move: 'move it', open: 'open',
      working: 'stashing…', done: 'done.',
      opening: 'opening…',
      flipping: 'moving…',
      'move-to': function (n) { return 'move: ' + n; },
      remove: 'remove', keep: 'keep', confirm: 'remove',
      'flip-keep': 'leave it',
      swept: function (n) { return n === 1 ? 'one file was just for that visit. gone.' : n + ' files were just for that visit. gone.'; },
      law: 'same phone, still here. no account.',
      'tech-summary': 'index · rails · identity',
      count: function (n) { return n === 1 ? '1 file' : n + ' files'; }
    },
    cypherpunk: {
      kicker: 'surfaces/myspace.html', title: 'MY SPACE',
      lede: 'Device index is authority. Storage is an adapter.',
      empty: '0 objects. Choose a purpose; the shell resolves a rail.',
      attach: 'ATTACH',
      'now-title': 'EPHEMERAL', 'now-body': 'purpose: this session.',
      'keep-title': 'DEVICE', 'keep-body': 'purpose: retained here.',
      'share-title': 'PUBLISHED', 'share-body': 'purpose: readable by link.',
      'forever-title': 'PERMANENT', 'forever-body': 'purpose: public record.',
      pricing: 'requesting a quote from the door…',
      joining: 'claiming the standing invite for this device key.',
      copy: 'copy URL', move: 'REWRITE', open: 'READ',
      working: 'writing to rail…', done: 'written.',
      opening: 'reading from rail…',
      flipping: 're-addressing…',
      'move-to': function (n) { return 'REWRITE -> ' + n; },
      remove: 'DROP', keep: 'abort', confirm: 'DROP ROW',
      'flip-keep': 'abort',
      swept: function (n) { return n + ' row(s) named a rail that does not survive a reload — swept.'; },
      law: 'Come-back is the device index. No login, no session.',
      'tech-summary': 'index · rails · identity',
      count: function (n) { return n + ' object' + (n === 1 ? '' : 's'); }
    }
  };

  /* The rail's declared answers, in each register's voice. The KEYS are contract
     vocabulary — the shell is allowed to know the contract, that is the whole
     point of one — and the VALUES are always the adapter's. A term this table
     does not recognise is printed raw rather than dropped: an unknown answer is
     still the rail's answer, and silently swallowing it would be the shell
     deciding what a rail is allowed to say. */
  var TERM_WORDS = {
    bee: {
      readers: { 'this-device': 'Only this phone opens it.', 'link-holders': 'Anyone with the link opens it.', everyone: 'Anyone can read it.' },
      lifetime: { 'until-this-tab-closes': 'It goes when you close this tab.', 'until-you-delete-it': 'It stays until you remove it.', 'while-the-store-keeps-it': 'It stays as long as the hive keeps it.', permanent: 'It lasts forever.' },
      deletable: { yes: 'You can take it back.', no: 'Nobody can delete it, not even you.' },
      payer: { nobody: 'Nobody is paying for it.', 'the-hive': 'The hive is paying for it.', you: 'You pay for it, from your own wallet.' }
    },
    raver: {
      readers: { 'this-device': 'this phone only.', 'link-holders': 'the link opens it.', everyone: 'anyone reads it.' },
      lifetime: { 'until-this-tab-closes': 'gone when this tab closes.', 'until-you-delete-it': 'stays till you drop it.', 'while-the-store-keeps-it': 'stays while the hive holds it.', permanent: 'lasts forever.' },
      deletable: { yes: 'you can pull it back.', no: 'nobody can delete it. not even you.' },
      payer: { nobody: 'nobody paid.', 'the-hive': 'the hive paid.', you: 'you pay. your wallet.' }
    },
    cypherpunk: {
      readers: { 'this-device': 'readers: this device', 'link-holders': 'readers: link holders', everyone: 'readers: everyone' },
      lifetime: { 'until-this-tab-closes': 'lifetime: session', 'until-you-delete-it': 'lifetime: until dropped', 'while-the-store-keeps-it': 'lifetime: store-bound', permanent: 'lifetime: permanent' },
      deletable: { yes: 'deletable: yes', no: 'deletable: no' },
      payer: { nobody: 'payer: none', 'the-hive': 'payer: the hive', you: 'payer: you (own wallet)' }
    }
  };

  function word(kind, value) {
    var table = TERM_WORDS[reg()][kind] || {};
    return table[value] || String(value);
  }

  /* The two a visitor acts on. The other two ride where they matter: `deletable`
     in the remove and move sentences, `payer` in the cypherpunk provenance. */
  function termsLine(scheme) {
    var t = terms(scheme);
    if (!t) return '';
    return word('readers', t.readers) + ' ' + word('lifetime', t.lifetime);
  }

  /* A purpose card says more than a why-line, because it is read BEFORE the
     choice: a rail with no delete says so, and a rail the visitor pays for says
     so, on the card itself and ahead of any price or signature (ruling 06:27Z —
     "a card that says only 'store forever' is the pretty-signal class"). Driven
     by the declared values, never by which purpose or rail this is. */
  function cardTerms(scheme) {
    var tm = terms(scheme);
    if (!tm) return '';
    var out = termsLine(scheme);
    if (tm.deletable === false) out += ' ' + word('deletable', 'no');
    if (tm.payer === 'you') out += ' ' + word('payer', 'you');
    return out;
  }

  function reg() {
    var r = document.body.getAttribute('data-reg');
    return COPY[r] ? r : 'bee';
  }
  function t(key) { return COPY[reg()][key]; }
  function purposeTitle(id) { return COPY[reg()][id + '-title']; }
  function purposeBody(id) { return COPY[reg()][id + '-body']; }

  /* ---------- rows ----------
     An address is {scheme, address}, never a bare hash; and as of slice 03 a row
     names a PURPOSE, not one of two modes. Both migrations are mechanical rather
     than guessed: a row carrying `sha` was written by slice 01, which had exactly
     one rail, so its scheme is known; and slice 01/02's `mode` had exactly two
     values with exactly one purpose each. They run once per row and persist. */

  function addrOf(row) { return (row.addr && row.addr.address) || null; }
  function schemeOf(row) { return (row.addr && row.addr.scheme) || null; }

  function migrateRow(row) {
    var moved = false;
    if (row.sha && !row.addr) { row.addr = { scheme: 'blossom', address: row.sha }; moved = true; }
    if (row.oldSha && !row.oldAddr) { row.oldAddr = { scheme: 'blossom', address: row.oldSha }; moved = true; }
    if (moved) { delete row.sha; delete row.oldSha; }
    if (row.mode && !row.purpose) {
      row.purpose = row.mode === 'public' ? 'share' : 'keep';
      delete row.mode;
      moved = true;
    }
    return moved;
  }

  async function loadRows() {
    var rows = await allRows();
    var moved = rows.filter(migrateRow);
    for (var i = 0; i < moved.length; i++) await putRow(moved[i]);
    return rows;
  }

  /* Rows whose rail said it does not survive a reload. Their bytes are gone by
     construction — the worker that held them died with the last page — so the
     row is swept rather than left pointing at nothing. THE SWEEP IS DRIVEN BY
     THE DECLARATION: `survives_reload`, read from the adapter, not from the
     rail's name. A rail that later persists across reloads needs no edit here.

     Rows whose scheme names no rail we have are LEFT ALONE. "I do not recognise
     this rail" and "this rail throws its bytes away" are different sentences,
     and deleting a visitor's row on the first is the kind of confident mistake
     an index is supposed to protect them from. */
  async function sweepEphemeral(rows) {
    var dead = rows.filter(function (row) {
      var s = schemeOf(row);
      var tm = s && terms(s);
      return !!tm && tm.survives_reload === false;
    });
    for (var i = 0; i < dead.length; i++) {
      await dropKey(dead[i].id);
      await dropRow(dead[i].id);
    }
    return dead.length;
  }

  /* ---------- bytes ---------- */

  /* Returns the key rather than storing it. The caller stores it only once the
     rail has taken the bytes: written earlier, a refused add left a key with
     nothing to open, and a refused move between two keep-class rails replaced
     the key the old rail's ciphertext still needed. */
  async function encryptFor(bytes) {
    var key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes));
    var out = new Uint8Array(12 + ct.length);
    out.set(iv, 0);
    out.set(ct, 12);
    return { bytes: out, key: { key: key, iv: iv } };
  }

  async function decryptFor(id, stored) {
    var k = await getKey(id);
    if (!k) throw new Error('the key for this file is gone from this phone');
    var joinedBytes = new Uint8Array(stored);
    return new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: joinedBytes.subarray(0, 12) }, k.key, joinedBytes.subarray(12)));
  }

  /* A keep-it-here rail receives ciphertext and the page keeps the key, so §4 is
     a shape rather than a promise over there: there is no key on that side to
     hold. A share rail receives plaintext, which is exactly what "anyone with
     the link opens it" means and what the page says out loud. */
  function encryptsFor(scheme) { return !speaksToTheWorld(scheme); }

  async function storeBytes(id, scheme, plain) {
    var sealed = encryptsFor(scheme) ? await encryptFor(plain) : null;
    var res = await railPut(scheme, sealed ? sealed.bytes : plain);
    if (sealed) await putKey(id, sealed.key);
    return { scheme: res.scheme, address: res.address };
  }

  async function plainBytes(row) {
    /* Written before slice 03: the bytes sat in the shell's own `blobs` store
       under the row id, because there was no local rail to hold them. Move them
       across on first read — ciphertext only, the key is untouched — and the old
       store empties as rows are opened. Two read paths for one release is the
       honest price of not rewriting a visitor's files underneath them. */
    if (row.local && !row.addr) {
      var legacy = await legacyBytes(row.id);
      if (!legacy) throw new Error('this phone no longer holds the bytes for that file');
      var here = railFor('keep');
      if (here) {
        var moved = await railPut(here, new Uint8Array(legacy));
        row.addr = { scheme: moved.scheme, address: moved.address };
        delete row.local;
        await putRow(row);
        await dropLegacy(row.id);
      }
      return decryptFor(row.id, legacy);
    }

    if (!addrOf(row)) throw new Error('this file is neither on this phone nor on a rail');
    /* The adapter hands back exactly the bytes that were handed to it. Whatever
       the rail needed them to look like on the wire is the rail's business and
       stays behind the boundary. */
    var got = (await railGet(schemeOf(row), addrOf(row))).bytes;
    return encryptsFor(schemeOf(row)) ? decryptFor(row.id, got) : got;
  }

  /* ---------- the sentences ----------
     Built from what the rail declared. `deletable` is the term that makes these
     differ, and it is the whole reason the slice needed a second rail before it
     could be honest: with one rail, "you cannot take it back" and "this store
     has no delete route" were indistinguishable sentences. */

  function leftBehind(row) {
    if (!row.oldAddr) return '';
    return ' An open copy you shared earlier is still out there at ' + row.oldAddr.scheme + ':' +
      row.oldAddr.address.slice(0, 12) + '…, and this cannot reach it.';
  }

  function deleteSentence(row) {
    var s = schemeOf(row);
    var tm = s && terms(s);
    if (!tm) {
      return 'This phone forgets the file. What happens to any copy elsewhere is not something this page can promise, because the rail that holds it is not answering.' + leftBehind(row);
    }
    if (tm.deletable) {
      return 'The bytes go and the key goes with them. ' + word('readers', tm.readers) +
        ' Nothing about this file will exist anywhere else.' + leftBehind(row);
    }
    return 'This phone forgets the file. The copy stays where it is, and anyone who already has the link still has it.' + leftBehind(row);
  }

  /* Said at the moment of the move, never in a footnote. */
  function moveSentence(row, toId) {
    var from = schemeOf(row);
    var fromT = from && terms(from);
    var toScheme = railFor(toId);
    var toT = toScheme && terms(toScheme);
    var out = toT ? (word('readers', toT.readers) + ' ' + word('lifetime', toT.lifetime)) : '';
    if (fromT && fromT.deletable === false) {
      out += ' The copy already out there stays where it is: moving this file protects what you share from here on, not what you already shared.';
    } else if (fromT && fromT.deletable === true) {
      out += ' The copy held here now goes.';
    }
    return out.trim();
  }

  /* ---------- render ---------- */

  var pendingPurpose = 'keep';
  var sheetRow = null;

  /* THE BUSY STATE IS PUBLISHED, NEVER INFERRED FROM THE WORDS.

     Until this slice the only way to know the page was mid-act was to read the
     status LINE and match it against a list of in-progress sentences, in three
     registers, maintained by hand. That list was wrong twice: it missed the
     longest-running status on the page (`joining`, whose bee copy shares no word
     with the others), and a plain copy edit to `working` makes it wrong again
     with nothing in the tree objecting. A sentence is written for a reader; a
     reader is not a machine, and asking a machine to parse one is how a gate
     goes green on the thing it exists to catch.

     So the page states it, the way the tour bar states `--tbar-h`: `data-busy`
     is `1` while an act is in flight and the line is DESCRIBING it, `0` when
     what is on the line is the RESULT. Set before the early return, so a
     cleared status is never left reading busy.

     AND A FLAG ALONE WAS NOT ENOUGH — measured, not reasoned. A reader that
     chooses a file and then looks for `data-busy="1"` is asking a question
     about a moment that may already be over: a refusal (an undeclared `x.put`,
     a store the browser will not open) goes busy and back to idle inside the
     round trip, and the look lands on `0`. Two clean runs in four failed that
     way. `0` cannot say "not started" apart from "already finished", so every
     announcement of work also moves `data-busy-seq` forward, and a reader waits
     for the sequence to pass the number it saw BEFORE it acted. That question
     has one answer however fast the act was. */
  var busySeq = 0;
  function setStatus(msg, loud, busy) {
    document.body.setAttribute('data-busy', busy ? '1' : '0');
    if (busy) document.body.setAttribute('data-busy-seq', String(++busySeq));
    var el = $('status');
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle('loud', !!loud);
  }

  /* The purpose buttons are built from what the rails answered, so a purpose
     with no rail behind it is absent rather than broken when tapped. If the
     purpose the visitor had selected is one of the missing ones, the selection
     moves to the first that survives — never silently to a purpose that sends
     bytes further than the one they chose, because `PURPOSES` is ordered from
     the most private outward and the first survivor is therefore never a
     widening. */
  function renderPurposes() {
    var box = $('modes');
    var open = availablePurposes();
    box.textContent = '';
    if (!open.some(function (p) { return p.id === pendingPurpose; })) {
      pendingPurpose = open.length ? open[0].id : null;
    }
    open.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'mode';
      b.type = 'button';
      b.id = 'mode-' + p.id;
      b.setAttribute('data-purpose', p.id);
      b.setAttribute('aria-pressed', String(pendingPurpose === p.id));
      var title = document.createElement('b');
      title.textContent = purposeTitle(p.id);
      var body = document.createElement('span');
      /* Voice from the register, facts from the rail — in that order, so a
         reader gets the character and then the terms it is character about. */
      body.textContent = purposeBody(p.id) + ' ' + cardTerms(railFor(p.id));
      b.appendChild(title);
      b.appendChild(body);
      b.onclick = function () { pendingPurpose = p.id; renderPurposes(); };
      box.appendChild(b);
    });
    box.style.setProperty('--modes', String(open.length || 1));
  }

  function applyCopy() {
    document.querySelectorAll('[data-reg-copy]').forEach(function (el) {
      var k = el.getAttribute('data-reg-copy');
      var v = COPY[reg()][k];
      if (typeof v === 'string') el.textContent = v;
    });
    renderPurposes();
  }

  async function render() {
    var rows = await loadRows();
    rows.sort(function (a, b) { return b.ts - a.ts; });
    document.body.setAttribute('data-state', rows.length ? 'file' : 'empty');
    $('count').textContent = COPY[reg()].count(rows.length);

    var list = $('list');
    list.textContent = '';
    rows.forEach(function (row) {
      var art = document.createElement('article');
      art.className = 'file';

      var name = document.createElement('div');
      name.className = 'name';
      name.textContent = row.name;
      art.appendChild(name);

      var meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = kb(row.size) + ' · ';
      var badge = document.createElement('span');
      badge.className = 'badge' + (speaksToTheWorld(schemeOf(row)) ? ' pub' : '');
      badge.textContent = purposeTitle(row.purpose) || row.purpose;
      meta.appendChild(badge);
      art.appendChild(meta);

      /* The why line. NOT a register's opinion about a store — the rail's own
         declared answer, rendered in this register's voice. */
      var why = document.createElement('p');
      why.className = 'why';
      why.textContent = termsLine(schemeOf(row)) ||
        'The rail that holds this is not answering, so this page will not tell you who can read it.';
      art.appendChild(why);

      var h = document.createElement('p');
      h.className = 'hash';
      var prov = document.createElement('span');
      prov.className = 'prov';
      var tm = terms(schemeOf(row));
      prov.textContent = (row.addr ? (row.addr.scheme + ':' + row.addr.address) : 'no rail record — these bytes are only here') +
        (row.keyref ? ('\nkeyref ' + row.keyref) : '') +
        (tm ? ('\n' + word('deletable', tm.deletable ? 'yes' : 'no') + ' · ' + word('payer', tm.payer)) : '') +
        '\nts ' + new Date(row.ts).toISOString().replace(/\.\d+Z$/, 'Z');
      h.appendChild(prov);
      /* This one is never a register's choice. A copy the visitor cannot pull back is said
         in every register, in words, next to the file it belongs to. */
      if (row.oldAddr) {
        var left = document.createElement('span');
        left.className = 'left';
        left.textContent = 'An open copy you shared earlier is still out there at ' + row.oldAddr.scheme + ':' + row.oldAddr.address.slice(0, 12) + '…';
        h.appendChild(left);
      }
      art.appendChild(h);

      var actions = document.createElement('div');
      actions.className = 'actions';

      /* Offered only when there is something to read. A row whose bytes are on
         no rail and not on this phone would fail on tap, and a control that
         fails on tap is the thing `availablePurposes` exists to avoid one level
         up. The id is the handle two gates drive this row by — a class would be
         an anchor on incidental structure, and this button being added is
         exactly what broke the previous `.ghost` first-match anchor. */
      if (addrOf(row) || row.local) {
        var openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'ghost';
        openBtn.id = 'open-' + row.id;
        openBtn.textContent = t('open');
        openBtn.onclick = function () { doOpen(row); };
        actions.appendChild(openBtn);
      }

      if (addrOf(row) && row.purpose === 'share') {
        var share = document.createElement('button');
        share.type = 'button';
        share.className = 'ghost';
        share.textContent = t('copy');
        share.onclick = function () {
          /* `f` carries a bare address and means the share rail, because every
             link ever minted from this page was minted against it. It is not
             widened here: a second SHARE rail needs a scheme in the link, and
             inventing that parameter before one exists would be a guess at its
             shape. Named, not built. */
          var link = location.origin + location.pathname + '?f=' + addrOf(row) + '&n=' + encodeURIComponent(row.name);
          navigator.clipboard.writeText(link).then(function () {
            setStatus('Link copied. Whoever opens it joins the hive to read it, then the file opens.');
          }, function () { setStatus('Link: ' + link); });
        };
        actions.appendChild(share);
      }

      var move = document.createElement('button');
      move.type = 'button';
      move.className = 'ghost';
      move.id = 'move-' + row.id;
      move.textContent = t('move');
      move.onclick = function () { openSheet('flip', row); };
      actions.appendChild(move);

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.id = 'del-' + row.id;
      del.textContent = t('remove');
      del.onclick = function () { openSheet('delete', row); };
      actions.appendChild(del);

      /* Three fit one row at 390px; four wrap to two-by-two on the two-column
         default. Counted, not guessed from the purpose — the row's buttons are
         built conditionally above and a second SHARE rail would change the
         count without touching this line. */
      if (actions.children.length === 3) actions.className = 'actions three';

      art.appendChild(actions);
      list.appendChild(art);
    });
    applyCopy();
  }

  function openSheet(kind, row) {
    sheetRow = row;
    if (kind === 'delete') {
      $('del-title').textContent = 'Remove ' + row.name + '?';
      $('del-body').textContent = deleteSentence(row);
    } else {
      /* One button per OTHER purpose that a rail can answer, each carrying the
         sentence for that move. With three rails "flip" is no longer a toggle,
         and a toggle-shaped control would have to pick one of two destinations
         on the visitor's behalf. */
      $('flip-title').textContent = 'Where should ' + row.name + ' live?';
      $('flip-body').textContent = '';
      var box = $('flip-actions');
      box.textContent = '';
      var keepBtn = document.createElement('button');
      keepBtn.className = 'ghost';
      keepBtn.type = 'button';
      /* The id is load-bearing, not decoration: `e2e/tour-bar-clearance.test.mjs`
         drives the real gesture across the estate and closes this sheet by
         `#flipKeep`. When the sheet's buttons stopped being markup and started
         being built here, the button survived and the handle did not — the
         visitor lost nothing and the gate lost its anchor. A class selector
         would be an anchor on incidental structure, which is the thing that has
         cost us most this week; the id is the cheap, stable handle. */
      keepBtn.id = 'flipKeep';
      keepBtn.textContent = t('flip-keep');
      keepBtn.onclick = closeSheet;
      box.appendChild(keepBtn);
      availablePurposes().forEach(function (p) {
        if (p.id === row.purpose) return;
        var b = document.createElement('button');
        b.className = 'primary';
        b.type = 'button';
        b.textContent = t('move-to')(purposeTitle(p.id));
        b.setAttribute('data-move-to', p.id);
        b.onclick = function () {
          $('flip-body').textContent = moveSentence(row, p.id);
          /* Second tap confirms, with the sentence for THIS destination on
             screen — the same "said at the moment it happens" rule the delete
             sheet keeps. */
          b.onclick = function () { doMove(row, p.id); };
          b.className = 'danger';
        };
        box.appendChild(b);
      });
    }
    document.body.setAttribute('data-state', kind);
  }

  function closeSheet() {
    sheetRow = null;
    render();
  }

  /* ---------- the acts ---------- */

  async function addFile(file) {
    var want = pendingPurpose;
    var scheme = railFor(want);
    if (!scheme) {
      setStatus('No rail on this page can do that right now, so nothing was written. Your file is still yours — try another choice.', true);
      return;
    }

    /* SAID BEFORE THE FIRST `await`, AND THAT ORDERING IS THE POINT. Reading the
       file's bytes is already work the visitor is waiting through, so the line
       used to appear after it — which left a window where the page was busy and
       said so nowhere. Running the whole decision synchronously inside the
       change event means `data-busy` is `1` by the time the tap has finished
       being a tap: for a visitor the status simply arrives sooner, and for
       anything reading the flag there is no gap where the page looks idle while
       an act is under way. */
    setStatus(t('working'), false, true);

    var id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var plain = new Uint8Array(await file.arrayBuffer());

    var row = {
      id: id, name: file.name || 'file', size: plain.length, type: file.type || '',
      purpose: want, ts: Date.now(), addr: null, keyref: null
    };

    try {
      row.addr = await storeBytes(id, scheme, plain);
      if (encryptsFor(scheme)) row.keyref = 'device:aes-gcm:v1';
      await putRow(row);
      setStatus(t('done'));
    } catch (e) {
      /* The file is still the visitor's — the index keeps it even when a rail
         refuses. Saying it was put away while the write failed would be exactly
         the lie this page exists not to tell. The fallback is the keep-it-here
         rail, which speaks to nothing, so a failed share never becomes a quiet
         second attempt at sending the bytes somewhere. */
      var here = railFor('keep');
      if (here && here !== scheme) {
        try {
          row.addr = await storeBytes(id, here, plain);
          row.purpose = 'keep';
          row.keyref = 'device:aes-gcm:v1';
          await putRow(row);
          setStatus('That did not go through (' + (e.message || 'error') + ').' + (leftSaying(e) || ' Nothing left this phone.') + ' It is here, locked, and you can try again.', true);
        } catch (e2) {
          setStatus('Nothing was written (' + (e2.message || e.message || 'error') + ').' + (leftSaying(e) || ' Nothing left this phone.'), true);
        }
      } else {
        setStatus('Nothing was written (' + (e.message || 'error') + ').' + (leftSaying(e) || ' Nothing left this phone.'), true);
      }
    }
    /* Back to the most private purpose any rail can answer.

       WAS TRUE UNTIL THIS SLICE AND IS NOT ANY MORE, so the reason is rewritten
       rather than left standing: the justification here used to be that the
       purpose picker only showed while the page was empty, so a stale selection
       could never be read as a choice made for the file that just arrived. The
       picker is on screen in both states now (the founder's stranger could not
       reach it once they had one file), which makes this reset VISIBLE instead
       of invisible — the buttons move under the visitor's eyes and the next
       file's purpose is the one they can see.

       The reset itself is unchanged and its real reason never depended on the
       picker being hidden: a default that carries no surprise is the one that
       sends the bytes least far, and `PURPOSES` is ordered from the most private
       outward precisely so this line cannot drift into meaning something else. */
    var open = availablePurposes();
    pendingPurpose = open.length ? open[0].id : null;
    await render();
  }

  async function doMove(row, toId) {
    var toScheme = railFor(toId);
    if (!toScheme) { setStatus('That is not available right now, so nothing changed.', true); return closeSheet(); }
    setStatus(t('flipping'), false, true);
    try {
      var bytes = await plainBytes(row);
      var from = schemeOf(row);
      var fromT = from && terms(from);

      var addr = await storeBytes(row.id, toScheme, bytes);

      /* The old copy goes ONLY where the rail says it can go. Where it cannot,
         the row remembers it and every register says so next to the file — the
         one sentence that is never a register's choice. */
      if (from && fromT && fromT.deletable) {
        await railDrop(from, addrOf(row));
        delete row.oldAddr;
      } else if (from && addrOf(row)) {
        row.oldAddr = row.addr;
      }
      if (row.local) { await dropLegacy(row.id); delete row.local; }

      row.addr = addr;
      row.purpose = toId;
      row.keyref = encryptsFor(toScheme) ? 'device:aes-gcm:v1' : null;
      if (!encryptsFor(toScheme)) await dropKey(row.id);
      await putRow(row);
      setStatus(moveSentence(row, toId));
    } catch (e) {
      setStatus('Nothing changed — ' + (e.message || 'that did not work') + '.' + leftSaying(e), true);
    }
    closeSheet();
  }

  async function doDelete(row) {
    var s = schemeOf(row);
    var tm = s && terms(s);
    var reallyGone = false;
    if (s && tm && tm.deletable && addrOf(row)) {
      try { reallyGone = (await railDrop(s, addrOf(row))).dropped; } catch (e) { reallyGone = false; }
    }
    if (row.local) await dropLegacy(row.id);
    await dropKey(row.id);
    await dropRow(row.id);
    /* Two acts, two sentences, and which one is said is decided by what the rail
       actually did — not by a guess made before the call. */
    setStatus(reallyGone
      ? ('Gone. The bytes and the key were both here, and this file existed nowhere else.' + leftBehind(row))
      : ('Gone from this phone. The copy out there stays where it is.' + leftBehind(row)));
    closeSheet();
  }

  /* Hand bytes back to the device. The only exit this page has for a file's
     contents, used by both openings: the row's own Open button and a shared
     link's arrival. The bytes are already plaintext by the time they get here —
     whatever a rail needed them to look like, and whatever the page had to
     decrypt, happened before the call. */
  function handToDevice(bytes, name, type) {
    var url = URL.createObjectURL(new Blob([bytes], type ? { type: type } : undefined));
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* A kept file could be put away and never taken back out: every row carried
     Move it and Remove, and nothing that opened it (slice 01 through 03; named
     in #168 and measured on the live page by the eye seat 2026-09-20 22:51Z).
     This is the same read `plainBytes` already did for a move, ending at the
     device instead of at another rail — so it works for every rail the page can
     route to, including ones that do not exist yet, and it branches on no rail
     name. */
  async function doOpen(row) {
    setStatus(t('opening'), false, true);
    try {
      var bytes = await plainBytes(row);
      handToDevice(bytes, row.name, row.type);
      setStatus(t('done'));
    } catch (e) {
      setStatus('Could not open ' + row.name + ' (' + (e.message || 'error') + ').', true);
    }
  }

  /* ---------- a shared link ---------- */

  async function openShared(address, name) {
    var scheme = railFor('share');
    if (!scheme) {
      setStatus('This page cannot open a shared file right now: it has no rail that reads one.', true);
      return;
    }
    setStatus('Opening ' + (name || 'the file') + '…', false, true);
    try {
      var bytes = (await railGet(scheme, address)).bytes;
      handToDevice(bytes, name || (address.slice(0, 12) + '.bin'), '');
      setStatus('Opened ' + (name || address.slice(0, 12)) + '.');
    } catch (e) {
      /* A code, not a parsed sentence. These two mean the rail would not let this
         phone read — the case with a door. Everything else, including a refused
         join, keeps its own words, which say more than the door would. */
      if (e.code === NOT_PERMITTED || e.code === MEMBERSHIP_REQUIRED) {
        setStatus('This file is in the hive and this phone could not get in to read it. The door is ' + JOIN_DOOR + ' if you want to try it by hand.', true);
      } else if (e.code === NOT_FOUND) {
        setStatus('Nothing is stored at that address any more.', true);
      } else {
        setStatus('Could not open it (' + (e.message || 'error') + ').', true);
      }
    }
  }

  /* ---------- wiring ---------- */

  function init() {
    document.querySelectorAll('[data-attach]').forEach(function (b) {
      b.onclick = function () { $('picker').click(); };
    });
    $('picker').onchange = function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (f) addFile(f);
    };
    $('delKeep').onclick = closeSheet;
    $('delConfirm').onclick = function () { if (sheetRow) doDelete(sheetRow); };

    /* register.js (mounted by tour.js) owns the switch; this page only re-renders its
       own words when the switch fires. No second switch is built here. */
    document.addEventListener('bregister', function () { render(); });

    if (!signer()) {
      setStatus('This browser could not load the signing engine, so nothing can be sent to the hive. Files you keep here are unaffected.', true);
    }

    /* Every rail is spawned at load, not at first use, so the page knows which
       purposes it can honestly offer before the visitor picks one. This touches
       no network: `describe` is answered inside each worker, and two of the three
       workers contain no network primitive at all. */
    var ready = RAILS.map(function (r) {
      try { return rail(r.scheme).ready.catch(function () {}); }
      catch (e) { return Promise.resolve(); }
    });

    Promise.all(ready).then(async function () {
      if (!availablePurposes().length) {
        setStatus('This page could not load any storage adapter, so there is nothing it can honestly offer to do with a file.', true);
      }
      var swept = await sweepEphemeral(await loadRows());
      await render();
      if (swept) setStatus(COPY[reg()].swept(swept));
      var q = new URLSearchParams(location.search);
      var f = q.get('f');
      if (f && /^[0-9a-f]{64}$/.test(f)) openShared(f, q.get('n'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Opened for `e2e/myspace-seam.mjs` and for nothing else; not a public API.
     Each of these is read by a named assertion in that gate. */
  window.__myspace = {
    adapter: function (scheme) { return adapters[scheme || 'blossom'] || null; },
    adapters: function () { return adapters; },
    terms: terms,
    railFor: railFor,
    purposes: function () { return availablePurposes().map(function (p) { return p.id; }); },
    devicePubkey: devicePubkey,
    rows: loadRows,
    render: render
  };
})();
