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
  async function sha256hex(bytes) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))); }

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
  function getRow(id) { return tx('files', 'readonly', function (s) { return s.get(id); }); }
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

  /* Where a rail is in answering `describe`. ASKING IS NOT DOWN. Every rail starts
     in its own worker and answers when its script has loaded, so for the first
     moments of a visit some have answered and some have not. Until this slice the
     page waited for the slowest before it drew a single file, and anything drawn
     before that (a register switch fires early) told every row "the rail that
     holds this is not answering" — measured 2026-10-15 with one adapter script
     held back 3 s: both rows said it, the kept one included, for three seconds.
     The two states are different sentences and each row now says its own. */
  function railPhase(scheme) {
    var a = scheme && adapters[scheme];
    if (!a) return 'down';
    if (a.attached) return 'up';
    return a.state === 'spawning' ? 'asking' : 'down';
  }

  /* Resolves once `scheme` has answered or failed — never rejects. */
  function settled(scheme) {
    var a = scheme && adapters[scheme];
    return a && a.ready ? a.ready.then(function () {}, function () {}) : Promise.resolve();
  }
  function anyAsking() { return RAILS.some(function (r) { return railPhase(r.scheme) === 'asking'; }); }
  function allSettled() { return Promise.all(RAILS.map(function (r) { return settled(r.scheme); })); }

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

  /* WHAT A FAILED PUT SAYS ABOUT THE BYTES. Once a file has been handed to a rail
     that speaks to the world, a failure is one of two different facts, and until
     this slice the page said a third, false one for both: "Nothing left this
     phone." A rail that ANSWERED with a refusal had the bytes in hand to refuse
     (sent, not kept). A call that timed out, a worker that died, a network that
     dropped mid-request — those lost the ANSWER, not necessarily the act, so the
     file may well be out there (Strata's provider protocol draws the same line:
     a lost reply is not proof nothing happened). Only the refusals an adapter
     raises before it sends (`NOTHING_SENT`) may still say nothing left. */
  /* The codes that mean the rail ANSWERED NO. After hand-off, every other failure
     — a timeout (-32011), a dead worker (-32010), a dropped network (-32001), an
     adapter's catch-all (-32000, which also fires on a garbled reply to an upload
     that succeeded) — is unknown, because unknown is the only thing the page knows. */
  var RAIL_SAID_NO = [MEMBERSHIP_REQUIRED, -32022, NOT_PERMITTED];

  function putFailure(scheme, e) {
    if (!speaksToTheWorld(scheme) || e.sent || NOTHING_SENT.indexOf(e.code) >= 0) return e;
    e.sent = 'rail';
    if (RAIL_SAID_NO.indexOf(e.code) < 0) e.unknown = true;
    return e;
  }

  async function railOp(scheme, verb, params) {
    var a = rail(scheme);
    await a.ready;
    var p = params || {};

    var single = 'x.' + verb;
    if (a.can(single)) {
      if (verb !== 'put') return a.ops[single](p);
      try { return await a.ops[single](p); } catch (e) { throw putFailure(scheme, e); }
    }

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
      if (e.code !== MEMBERSHIP_REQUIRED || verb === 'join' || !a.can('x.beginJoin')) throw verb === 'put' ? putFailure(scheme, e) : e;
      await joinRail(scheme);
      /* The IDENTICAL intent and the IDENTICAL signature. The shell resubmits; it
         never re-signs and never builds a second intent (§6). */
      try { return await a.ops[submit]({ intent_id: intent.intent_id, sig: sig }); }
      catch (e2) { throw verb === 'put' ? putFailure(scheme, e2) : e2; }
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
      if (NOTHING_SENT.indexOf(e.code) < 0) e.sent = 'door';
      throw e;
    }
    var txs = null;
    try {
      txs = await payFor(prep.plan);
      setStatus(t('working'), false, true);
      return await a.ops['x.finalizePut']({ intent_id: prep.intent_id, txs: txs }, 180000);
    } catch (e) {
      e.sent = 'door';
      if (txs) e.paid = txs.map(function (x) { return x.tx_hash; });
      throw e;
    }
  }

  /* What left the phone, said after an act fails. Paid-and-not-stored is the
     stranded-payment case (SPEC-AUTONOMI-TREZOR-1 §4), and the hashes are the
     visitor's receipt for it, so they are printed, not summarised. An empty
     answer means the bytes never left, and only then may a caller say so. */
  function leftSaying(e) {
    if (e.paid) return ' You paid (' + e.paid.join(', ') + ') and the file was not confirmed as stored; keep those payment ids.';
    if (e.sent === 'door') return ' The estate\'s door saw the file to price it; nothing was stored and nothing was paid.';
    if (e.unknown) return ' The file was already on its way when the answer was lost, so this page cannot tell whether it was kept out there. Treat it as possibly shared.';
    if (e.sent) return ' The file reached the rail and the rail refused to keep it.';
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

  /* THE FOUNDER'S CHOSEN UI (order 2026-10-04, nine screens at 390 px). Its words
     are used where the code does exactly what they say; where it does not, the
     look and the nearest wording stay and the words are made true. Each of those
     is named where it lives, so the reason travels with the sentence:
       · Private never leaves this phone — the keep-it-here rail declares no
         network and holds ciphertext — so nothing is "sealed before it leaves".
       · Moving a public file home cannot drop the open copy: the hive rail
         declares deletable:false. The row says so (`leftBehind`), so no button is
         called "Make private" as if the open copy went with it.
       · There are four purposes, not two, when four rails answer; each is a card.
       · The device key is a browser-local schnorr key, not a bzdid key; the index
         is IndexedDB `myspace` v2, not localStorage. */
  var COPY = {
    bee: {
      kicker: 'MY SPACE', title: 'Your files live on this phone.',
      lede: 'Add a file from this phone. Public: anyone with the link. Private: only this phone, sealed and kept here.',
      empty: 'Nothing here yet.',
      attach: 'Add a file from this phone', 'attach-more': 'Add another file',
      'now-title': 'Just for now', 'now-body': 'Sealed here, for this visit only.', 'now-chip': 'JUST FOR NOW',
      'keep-title': 'Private', 'keep-body': 'Sealed on this phone. It never leaves.', 'keep-chip': 'PRIVATE',
      'share-title': 'Public', 'share-body': 'Not sealed. Give someone the link.', 'share-chip': 'PUBLIC',
      'forever-title': 'Forever', 'forever-body': 'Out in the open, for good. This page cannot take the payment yet.', 'forever-chip': 'FOREVER',
      'meta-here': 'this phone', 'meta-out': 'shared from this phone',
      pricing: 'Asking what it costs. The estate\'s door reads the file to price it.',
      joining: 'Putting this phone in the hive — that is what lets it hold a file, and what lets a link open.',
      copy: 'Copy link', move: 'Move it', open: 'Open',
      working: 'Putting it away…', done: 'Done.',
      opening: 'Opening it…',
      flipping: 'Moving it…',
      'move-to': function (n) { return 'Move it: ' + n; },
      remove: 'Delete', keep: 'Keep it', confirm: 'Delete',
      'del-title': function (row) { return 'Delete ' + row.name + '?'; },
      'flip-title': function (row) { return 'Where should ' + row.name + ' live?'; },
      'flip-keep': 'Leave it as it is',
      swept: function (n) { return n === 1 ? 'One file was only for that visit, and it is gone.' : n + ' files were only for that visit, and they are gone.'; },
      law: 'Your list stays on this phone. A new phone starts empty.',
      asking: 'Still asking where this file lives.',
      look: 'Preview', 'look-close': 'Close', 'look-save': 'Save to this phone',
      reading: 'Reading it…',
      checked: function (first) { return first ? 'First look: what this file holds is recorded now, so every later look is checked against it.' : 'Checked: these are exactly the bytes you added.'; },
      'count-label': 'On this phone:',
      count: function (n) { return n === 1 ? '1 file' : n + ' files'; }
    },
    raver: {
      kicker: 'MY SPACE', title: 'Drop it. Keep it. Or let it fly.',
      lede: 'Your space. Open to the link, or locked to this device. Same files. Same store. One tap to change the look.',
      empty: 'The floor is empty. Make it yours.',
      attach: 'Add a file', 'attach-more': 'Add another',
      'now-title': 'Just now', 'now-body': 'This visit. That is all.', 'now-chip': 'JUST NOW',
      'keep-title': 'Private', 'keep-body': 'Sealed on this device. The store never sees the clear file.', 'keep-chip': 'PRIVATE',
      /* `share-body` is the ACT, never the terms: the rail's own readers line in
         this register is already 'The link opens it.', and a card that prints
         the same sentence twice reads as a stutter rather than as two facts.
         Caught on the live page by the eye seat 2026-09-20 22:51Z. The row that
         keeps it dead is in `e2e/myspace-seam.mjs` §14 and it judges every
         register, not this one line. */
      'share-title': 'Public', 'share-body': 'The link is the door. Anyone who has it, walks in.', 'share-chip': 'PUBLIC',
      'forever-title': 'Forever', 'forever-body': 'Out in the open. For good. This page cannot take the payment yet.', 'forever-chip': 'FOREVER',
      'meta-here': 'this phone', 'meta-out': 'out from this phone',
      pricing: 'Pricing it. The estate door reads it to quote.',
      joining: 'This phone is joining the hive. That is what makes a link open.',
      copy: 'Copy link', move: 'Move it', open: 'Open',
      working: 'Stashing…', done: 'Done.',
      opening: 'Opening…',
      flipping: 'Moving…',
      'move-to': function (n) { return 'Move: ' + n; },
      remove: 'Delete', keep: 'Keep it', confirm: 'Delete',
      'del-title': function () { return 'Let this one go?'; },
      'flip-title': function () { return 'Where does it go?'; },
      'flip-keep': 'Leave it',
      swept: function (n) { return n === 1 ? 'One file was just for that visit. Gone.' : n + ' files were just for that visit. Gone.'; },
      law: 'This device is the index. Another phone is another room.',
      asking: 'Checking where it lives…',
      look: 'Peek', 'look-close': 'Close', 'look-save': 'Save it',
      reading: 'Pulling it up…',
      checked: function (first) { return first ? 'First peek. Its fingerprint is saved now.' : 'Verified. Same bytes you dropped.'; },
      'count-label': 'On this phone:',
      count: function (n) { return n === 1 ? '1 file' : n + ' files'; }
    },
    cypherpunk: {
      kicker: 'MYSPACE · BLOSSOM · DEVICE INDEX', title: 'local rows · sha256 · AES-GCM',
      lede: 'Identity = browser-local schnorr key, no login. PUBLIC = plaintext blob, PNG-wrapped, by sha256. PRIVATE = AES-GCM-256 in this origin; key never leaves. Local store holds ciphertext only. Device index is the truth for “come back later.”',
      empty: 'index [] · indexeddb myspace v2',
      attach: function (scheme) { return 'PUT ' + (scheme || 'nothing') + ' · choose blob'; },
      'attach-more': 'PUT another blob',
      'now-title': 'Ephemeral', 'now-body': 'AES-GCM-256 · held in a worker · swept on reload.', 'now-chip': 'EPHEMERAL',
      'keep-title': 'Private', 'keep-body': 'AES-GCM-256 in-browser · key in this origin · store = ciphertext only.', 'keep-chip': 'PRIVATE',
      'share-title': 'Public', 'share-body': 'plaintext blob · link + hive membership = read.', 'share-chip': 'PUBLIC',
      'forever-title': 'Permanent', 'forever-body': 'plaintext · public record · pay arm not wired, so no PUT completes.', 'forever-chip': 'PERMANENT',
      'meta-here': 'this phone', 'meta-out': 'index row here, blob out there',
      pricing: 'requesting a quote from the door…',
      joining: 'claiming the standing invite for this device key.',
      copy: 'Copy link', move: 're-PUT', open: 'READ',
      working: 'writing to rail…', done: 'written.',
      opening: 'reading from rail…',
      flipping: 're-addressing…',
      'move-to': function (n) { return 're-PUT -> ' + n; },
      remove: 'Delete', keep: 'abort', confirm: 'DELETE',
      'del-title': function (row) { return row.addr ? 'DELETE ' + row.addr.scheme + ':' + row.addr.address.slice(0, 9) + '…' : 'DELETE row ' + row.id; },
      'flip-title': function (row) { return 're-PUT ' + row.name + ' -> ?'; },
      'flip-keep': 'abort',
      swept: function (n) { return n + ' row(s) named a rail that does not survive a reload — swept.'; },
      law: 'rail per purpose, chosen by declared terms · a refused PUT falls back to this device · no login',
      asking: 'describe() pending · terms not declared yet',
      look: 'inspect', 'look-close': 'close', 'look-save': 'READ -> device',
      reading: 'reading from rail · verifying…',
      checked: function (first, sha) { return (first ? 'sha256 recorded now (row had none) · ' : 'sha256 == index record · ') + sha.slice(0, 16) + '…'; },
      'count-label': 'On this phone:',
      count: function (n) { return n === 1 ? '1 file' : n + ' files'; }
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
      readers: { 'this-device': 'This phone only.', 'link-holders': 'The link opens it.', everyone: 'Anyone reads it.' },
      lifetime: { 'until-this-tab-closes': 'Gone when this tab closes.', 'until-you-delete-it': 'Stays till you drop it.', 'while-the-store-keeps-it': 'Stays while the hive holds it.', permanent: 'Lasts forever.' },
      deletable: { yes: 'You can pull it back.', no: 'Nobody can delete it. Not even you.' },
      payer: { nobody: 'Nobody paid.', 'the-hive': 'The hive paid.', you: 'You pay. Your wallet.' }
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
     widening.

     NOT WHILE A RAIL IS STILL ASKING. Rails answer one by one now, so the
     visitor's purpose may simply not have arrived yet; moving the selection to
     whatever answered first would make a stranger's first file "just for now"
     because that rail's script was the smallest. Until every rail has answered
     or failed, a selection with no rail yet is held, not replaced. */
  function renderPurposes() {
    var box = $('modes');
    var open = availablePurposes();
    box.textContent = '';
    if (!anyAsking() && !open.some(function (p) { return p.id === pendingPurpose; })) {
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
    attachWords();
  }

  /* The one primary names what it will do in the registers whose voice is the
     verb (cypherpunk: `PUT <rail>`), so it follows the selection. The rail named
     is `railFor`'s answer for the pressed purpose, never a literal. */
  function attachWords() {
    var v = COPY[reg()].attach;
    if (typeof v !== 'function') return;
    var s = v(pendingPurpose ? railFor(pendingPurpose) : null);
    document.querySelectorAll('[data-reg-copy="attach"]').forEach(function (el) { el.textContent = s; });
  }

  function applyCopy() {
    document.querySelectorAll('[data-reg-copy]').forEach(function (el) {
      var k = el.getAttribute('data-reg-copy');
      var v = COPY[reg()][k];
      if (typeof v === 'string') el.textContent = v;
    });
    renderPurposes();
  }

  /* THE LIST IS DRAWN IN SLICES, AND ONLY THE LATEST DRAW MAY FINISH.

     Measured 2026-10-15 (e2e/myspace-explorer.mjs, five cold runs on one
     machine): with 20,000 rows the page built every row in one go and the main
     thread was held 4.5 to 5.3 seconds; with 2,000, about 300 ms. A tap in that
     window waits for all of it. Now the rows are read once and sorted; the first
     `BATCH` are on screen at once, the rest are built in slices of `SLICE_MS`
     with the event loop given back between them (so a tap, or a rail's answer,
     is served between any two), and they land together.

     The draw spans many tasks, so two draws can overlap (a register switch, a
     rail answering, a sheet closing). Every draw takes a ticket; a draw whose
     ticket is no longer the newest stops at its next slice and paints nothing
     more, so an older read of the index can never land on top of a newer one.
     Every caller of `render()` waits for the NEWEST draw to finish, not its own:
     "the list is drawn" means the list as it is now.

     `applyCopy()` still runs last, after the final slice: the register walk in
     e2e/myspace-seam.mjs waits on `#modes` changing as its sign that the whole
     page has the new words. */
  var BATCH = 128;
  var SLICE_MS = 12;      // after the first screen, each slice works this long, then gives the page back
  var drawTicket = 0;
  var drawDone = null;

  /* A yield that is not clamped (nested setTimeout(0) waits at least 4 ms after
     five levels) and not privileged: scheduler.yield() resumes AHEAD of every
     other task, which measured 2026-10-15 at 20,000 rows starved the rails' own
     describe answers until the whole list was drawn (they landed at ~3 s) and
     packed eight slices into each frame. A MessageChannel task waits its turn
     like a rail's answer does. */
  var yieldPort = null;
  function yieldToPage() {
    if (!yieldPort) {
      var ch = new MessageChannel();
      var waiting = [];
      ch.port1.onmessage = function () { var r = waiting.shift(); if (r) r(); };
      yieldPort = { post: function (r) { waiting.push(r); ch.port2.postMessage(0); } };
    }
    return new Promise(function (r) { yieldPort.post(r); });
  }

  function render(given) {
    var mine = ++drawTicket;
    if (!drawDone) {
      var settle = {};
      drawDone = new Promise(function (res, rej) { settle.res = res; settle.rej = rej; });
      drawDone.settle = settle;
    }
    var waiting = drawDone;
    draw(mine, given).then(function (current) {
      if (current && mine === drawTicket && drawDone === waiting) { drawDone = null; waiting.settle.res(); }
    }, function (e) {
      if (drawDone === waiting && mine === drawTicket) { drawDone = null; waiting.settle.rej(e); }
    });
    return waiting;
  }

  /* A RAIL ANSWERING CHANGES THE WORDS, NOT THE INDEX. Re-reading the index for
     it cost a whole read each time: measured at 20,000 rows, four rails answering
     during the first read pushed the first row from 0.96 s to 1.24 s (median of
     five), because each answer superseded the read in flight. So an answer
     redraws from the rows already read, and an answer that lands DURING a read
     waits for it: the slices still to come read the new terms live, and the ones
     already drawn are redrawn once the read's draw is done. Anything that writes
     the index (an act, a sweep, a register switch) still calls `render()` and
     reads afresh. */
  var reading = false;
  var lastRows = null;
  var termsDirty = false;

  function repaint() {
    if (reading || !lastRows) { termsDirty = true; return drawDone || Promise.resolve(); }
    return render(lastRows);
  }

  async function draw(mine, given) {
    var rows = given;
    if (!rows) {
      reading = true;
      try { rows = await loadRows(); } finally { reading = false; }
      if (mine !== drawTicket) return false;
      rows.sort(function (a, b) { return b.ts - a.ts; });
      lastRows = rows;
    }
    /* A sheet that is open stays open: a rail answering mid-sentence redraws the
       list behind it, never the sheet out from under the visitor. */
    if (!sheetRow) document.body.setAttribute('data-state', rows.length ? 'file' : 'empty');
    /* "On this phone: N files" — the device index is on this phone, and that is
       what it counts, in every state including zero. */
    var countEl = $('count');
    countEl.querySelector('.lbl').textContent = t('count-label');
    countEl.querySelector('.n').textContent = COPY[reg()].count(rows.length);

    var list = $('list');
    list.setAttribute('data-draw', String(mine));
    /* The first slice is the first screen: exactly BATCH rows, at once. After
       that a slice is however many rows fit in SLICE_MS, at least BATCH, so a long
       list is laid out tens of times rather than once per hundred rows.

       A REDRAW REPLACES ROWS WHERE THEY STAND. It never empties the list first:
       an emptied list collapses the page under a visitor who has scrolled, and
       every rail that answers redraws. Slice by slice the new rows take the old
       rows' places, and whatever is left past the end goes last. */
    /* THE FIRST SCREEN GOES IN AT ONCE, IN PLACE: the first BATCH new rows take
       the first BATCH old rows' places (a walking cursor, not `list.children[i]`,
       which re-walks the list after every removal and was quadratic over 20,000
       rows). THE REST IS BUILT OFF-SCREEN and swapped in with one operation.
       Appending slice by slice to a long on-screen list re-laid out the whole
       list every frame — measured at 20,000 rows: frames of 160 to 300 ms all the
       way down. A detached fragment costs no layout while it grows; the one swap
       costs one. Until it lands, the old rows past the first screen stay where
       they were, so a redraw never collapses the page under a scrolled visitor. */
    var old = list.firstElementChild;
    var head = Math.min(rows.length, BATCH);
    var screen = document.createDocumentFragment();
    for (var k = 0; k < head; k++) screen.appendChild(rowEl(rows[k]));
    for (var gone = 0; gone < head && old; gone++) { var dead = old; old = old.nextElementSibling; dead.remove(); }
    list.insertBefore(screen, old);

    var rest = document.createDocumentFragment();
    var i = head;
    while (i < rows.length) {
      await yieldToPage();
      if (mine !== drawTicket) return false;
      var t0 = performance.now();
      while (i < rows.length && (i % 16 !== 0 || performance.now() - t0 < SLICE_MS)) rest.appendChild(rowEl(rows[i++]));
    }
    if (old) {
      var tail = document.createRange();
      tail.setStartBefore(old);
      tail.setEndAfter(list.lastChild);
      tail.deleteContents();
    }
    list.appendChild(rest);
    applyCopy();
    /* a rail answered while this draw was reading: redraw from these rows once,
       and let that draw be the one the waiters wait for */
    if (termsDirty && mine === drawTicket) { termsDirty = false; render(rows); }
    return true;
  }

  /* One file's row. */
  function rowEl(row) {
    var art = document.createElement('article');
    art.className = 'file';
    art.setAttribute('data-row', row.id);

    /* The head: a plain tile (decoration; the preview is behind its own button,
       never made just because a row was drawn), the name, the size and where the
       bytes are, and the purpose as a chip. */
    var head = document.createElement('div');
    head.className = 'head';
    var thumb = document.createElement('i');
    thumb.className = 'thumb';
    thumb.setAttribute('aria-hidden', 'true');
    head.appendChild(thumb);
    var who = document.createElement('div');

    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = row.name;
    who.appendChild(name);

    /* Where the bytes are is the rail's declaration, not the purpose's name: a
       rail that speaks to the world holds them out there, and only the index
       row is on this phone. */
    var meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = kb(row.size) + ' · ' + t(speaksToTheWorld(schemeOf(row)) ? 'meta-out' : 'meta-here');
    who.appendChild(meta);

    var badge = document.createElement('span');
    badge.className = 'chip' + (speaksToTheWorld(schemeOf(row)) ? ' pub' : '');
    badge.textContent = t(row.purpose + '-chip') || purposeTitle(row.purpose) || row.purpose;
    who.appendChild(badge);
    head.appendChild(who);
    art.appendChild(head);

    /* The why line. NOT a register's opinion about a store — the rail's own
       declared answer, rendered in this register's voice. It sits under the
       row's buttons, where the chosen UI puts the one-line note. A rail that has
       not answered YET says so, in words that are not the ones for a rail that
       will not answer. */
    var why = document.createElement('p');
    why.className = 'why';
    var phase = railPhase(schemeOf(row));
    why.textContent = termsLine(schemeOf(row)) || (phase === 'asking' ? t('asking') :
      'The rail that holds this is not answering, so this page will not tell you who can read it.');

    var h = document.createElement('p');
    h.className = 'hash';
    var prov = document.createElement('span');
    prov.className = 'prov';
    var tm = terms(schemeOf(row));
    prov.textContent = (row.addr ? (row.addr.scheme + ' address\n' + row.addr.address) : 'no rail record — these bytes are only here') +
      '\n' + (row.keyref ? 'AES-GCM on · key on this device (' + row.keyref + ')' : 'AES-GCM off (plaintext)') +
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

      var look = document.createElement('button');
      look.type = 'button';
      look.className = 'ghost';
      look.id = 'look-' + row.id;
      look.textContent = t('look');
      look.onclick = function () { doLook(row); };
      actions.appendChild(look);
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

    art.appendChild(actions);
    art.appendChild(why);
    return art;
  }

  /* A ROW ON SCREEN IS A CLAIM ABOUT THE PAST. What the visitor tapped was drawn
     from the index as it was then; acting on it means acting on the index as it
     is now. So every act re-reads its row first and refuses, by name, when the
     row is gone or no longer says the same thing about where the bytes are —
     the list is redrawn and the visitor taps again on what is true. (Strata's
     provider rule, taken as pattern: "a menu is not authorization".) The
     comparison is the kernel's `open::revalidate`, held to the same three
     fields: which bytes (the recorded digest), where (the address), and under
     which terms (the purpose). */
  async function fresh(row) {
    var now = await getRow(row.id);
    if (!now) throw Object.assign(new Error('That file is no longer in your list.'), { stale: true });
    migrateRow(now);
    /* Two changes are the index LEARNING, not the row moving, and neither refuses:
       a digest recorded where the drawn row had none (a first look), and a
       pre-slice-03 row whose bytes moved onto the local rail on first read. */
    var legacy = row.local && !row.addr;
    var same = JSON.stringify([legacy ? null : now.addr, now.purpose, row.sha256 ? (now.sha256 || null) : null, now.oldAddr || null]) ===
      JSON.stringify([legacy ? null : row.addr, row.purpose, row.sha256 || null, row.oldAddr || null]);
    if (!same) throw Object.assign(new Error('That file changed since this list was drawn. The list is up to date now; tap it again.'), { stale: true });
    return now;
  }

  function staleSaid(e) {
    if (!e || !e.stale) return false;
    setStatus(e.message, true);
    sheetRow = null;
    render();
    return true;
  }

  function openSheet(kind, row) {
    /* The sheets' sentences are built from the row's rail terms. A rail still
       answering has none yet, and "not answering" would be the wrong sentence
       read at the moment of choosing, so the sheet waits for that one rail. */
    var s = schemeOf(row);
    if (railPhase(s) === 'asking') {
      setStatus(t('asking'), false, true);
      return settled(s).then(function () { setStatus(''); openSheet(kind, row); });
    }
    sheetRow = row;
    if (kind === 'delete') {
      $('del-title').textContent = t('del-title')(row);
      $('del-body').textContent = deleteSentence(row);
    } else {
      /* One button per OTHER purpose that a rail can answer, each carrying the
         sentence for that move. With three rails "flip" is no longer a toggle,
         and a toggle-shaped control would have to pick one of two destinations
         on the visitor's behalf. */
      $('flip-title').textContent = t('flip-title')(row);
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
      /* Every destination starts as an outline; the one tapped becomes the
         sheet's single filled button, and only that one moves the file on the
         next tap. Tapping another destination hands the fill (and the confirm)
         to it, so the sheet never has two filled answers at once. */
      var dests = [];
      function arm(b, id) {
        b.className = 'ghost';
        b.onclick = function () {
          dests.forEach(function (d) { if (d.b !== b) arm(d.b, d.id); });
          $('flip-body').textContent = moveSentence(row, id);
          /* Second tap confirms, with the sentence for THIS destination on
             screen — the same "said at the moment it happens" rule the delete
             sheet keeps. */
          b.onclick = function () { doMove(row, id); };
          b.className = 'primary';
        };
      }
      availablePurposes().forEach(function (p) {
        if (p.id === row.purpose) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = t('move-to')(purposeTitle(p.id));
        b.setAttribute('data-move-to', p.id);
        arm(b, p.id);
        dests.push({ b: b, id: p.id });
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

    /* SAID BEFORE THE FIRST `await`, AND THAT ORDERING IS THE POINT. Reading the
       file's bytes is already work the visitor is waiting through, so the line
       used to appear after it — which left a window where the page was busy and
       said so nowhere. Running the whole decision synchronously inside the
       change event means `data-busy` is `1` by the time the tap has finished
       being a tap: for a visitor the status simply arrives sooner, and for
       anything reading the flag there is no gap where the page looks idle while
       an act is under way. */
    setStatus(t('working'), false, true);

    /* The choice is read at the tap (above); which rail can keep it is asked once
       every rail has answered, so a file chosen in the first moments of a visit
       is not refused as "no rail can do that" by rails that are only starting. */
    if (anyAsking()) await allSettled();
    var scheme = railFor(want);
    if (!scheme) {
      setStatus('No rail on this page can do that right now, so nothing was written. Your file is still yours — try another choice.', true);
      return;
    }

    var id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var plain = new Uint8Array(await file.arrayBuffer());

    /* `sha256` is what the visitor put in, recorded on this phone at the moment
       they put it in. Every later preview checks the bytes that come back from
       ANY rail — sealed or open, hive or door — against it, end to end. */
    var row = {
      id: id, name: file.name || 'file', size: plain.length, type: file.type || '',
      purpose: want, ts: Date.now(), addr: null, keyref: null, sha256: await sha256hex(plain)
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
    try { row = await fresh(row); } catch (e) { if (staleSaid(e)) return; throw e; }
    var from = schemeOf(row);
    var fromT = from && terms(from);
    var oldAddr = row.addr;

    var addr;
    try {
      var bytes = await plainBytes(row);
      addr = await storeBytes(row.id, toScheme, bytes);
    } catch (e) {
      /* Nothing in the index changed. Whether anything LEFT the phone is the
         error's to say, never assumed: "Nothing changed" used to be printed after
         a share PUT that timed out, when the file may already have been out. */
      var left = leftSaying(e);
      setStatus(left
        ? 'The move did not finish (' + (e.message || 'that did not work') + '). Your list still has the file where it was.' + left
        : 'Nothing changed — ' + (e.message || 'that did not work') + '.', true);
      return closeSheet();
    }

    /* FROM HERE THE NEW COPY EXISTS, so the index says so before anything else
       can fail. The old order cleared the old copy first and wrote the row last;
       a failed clear then reported "Nothing changed" while the new copy was out
       there — and, between two sealed rails, while the row still named the old
       ciphertext under a key that had just been replaced, which no longer opened
       anything. Now the row moves first, and a failed clear is named for what it
       leaves behind. */
    var undeletable = !!(from && oldAddr && !(fromT && fromT.deletable));
    if (row.local) { await dropLegacy(row.id); delete row.local; }
    row.addr = addr;
    row.purpose = toId;
    row.keyref = encryptsFor(toScheme) ? 'device:aes-gcm:v1' : null;
    if (undeletable) row.oldAddr = oldAddr;
    else delete row.oldAddr;
    if (!encryptsFor(toScheme)) await dropKey(row.id);
    await putRow(row);

    /* The old copy goes ONLY where the rail says it can go. Where it cannot,
       the row remembers it and every register says so next to the file — the
       one sentence that is never a register's choice. */
    var cleared = '';
    if (!undeletable && from && oldAddr) {
      try {
        await railDrop(from, oldAddr.address);
      } catch (e) {
        if (encryptsFor(from)) {
          /* its key was replaced (sealed destination) or dropped (open one) above */
          cleared = ' The old sealed copy could not be cleared (' + (e.message || 'error') + '); its key is gone, so nothing can open it.';
        } else {
          row.oldAddr = oldAddr;
          await putRow(row);
          cleared = ' The old copy could not be removed (' + (e.message || 'error') + ') and is still at ' + oldAddr.scheme + ':' + oldAddr.address.slice(0, 12) + '….';
        }
      }
    }
    setStatus(moveSentence(row, toId) + cleared, !!cleared);
    closeSheet();
  }

  async function doDelete(row) {
    try { row = await fresh(row); } catch (e) { if (staleSaid(e)) return; throw e; }
    var s = schemeOf(row);
    var tm = s && terms(s);
    var reallyGone = false;
    var dropErr = null;
    if (s && tm && tm.deletable && addrOf(row)) {
      try { reallyGone = (await railDrop(s, addrOf(row))).dropped; } catch (e) { dropErr = e; }
    }
    if (row.local) await dropLegacy(row.id);
    await dropKey(row.id);
    await dropRow(row.id);
    /* Two acts, two sentences, and which one is said is decided by what the rail
       actually did — not by a guess made before the call. A delete the rail
       FAILED is a third sentence: it used to be swallowed and reported as "the
       copy out there stays", which is false of a sealed copy on this phone. */
    if (dropErr) {
      setStatus((encryptsFor(s)
        ? 'Gone from your list. Clearing its sealed bytes failed (' + (dropErr.message || 'error') + '); the key went with the row, so nothing can open them.'
        : 'Gone from your list, but the rail did not confirm the delete (' + (dropErr.message || 'error') + '), so a copy may still be out there.') + leftBehind(row), true);
    } else {
      setStatus(reallyGone
        ? ('Gone. The bytes and the key were both here, and this file existed nowhere else.' + leftBehind(row))
        : ('Gone from this phone. The copy out there stays where it is.' + leftBehind(row)));
    }
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

  /* The bytes a rail handed back, checked against what the visitor put in. A row
     added before the digest was recorded gets it now, from the first bytes that
     come back, and says so: that first check has nothing earlier to compare to. */
  async function checkedBytes(row) {
    var bytes = await plainBytes(row);
    var sha = await sha256hex(bytes);
    if (!row.sha256) {
      row.sha256 = sha;
      await putRow(row);
      return { bytes: bytes, first: true };
    }
    if (sha !== row.sha256) {
      throw Object.assign(new Error('the bytes that came back are not the ones you added, so they were not used'), { identity: true });
    }
    return { bytes: bytes, first: false };
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
      row = await fresh(row);
      var got = await checkedBytes(row);
      handToDevice(got.bytes, row.name, row.type);
      setStatus(t('done'));
    } catch (e) {
      if (staleSaid(e)) return;
      setStatus('Could not open ' + row.name + ' (' + (e.message || 'error') + ').', true);
    }
  }

  /* ---------- a look before saving ----------
     The preview is crates/bnr-explorer's, compiled to surfaces/bnr-explorer.wasm
     and run in its own worker (bnr-explorer-worker.js). Three things hold it:

       · THE MODULE CAN NAME NOTHING OUTSIDE ITSELF. It has no imports, so the
         code that reads a stranger's bytes has no network, key, store or clock
         to reach. Before it runs, this page checks the module's sha256 against
         the pin below and its import list against empty; either check failing
         turns previews OFF, said in words, and the file's bytes are never read.
         There is no second, weaker way to preview. A missing isolation is a
         missing preview, never a quieter one.
       · IT IS HANDED ONE OBJECT. The worker receives the bytes of the file being
         looked at and the digest they must have — no key, no rail, no index.
       · IDENTITY BEFORE PARSING, UNDER A BUDGET THE PAGE CANNOT LOOSEN. The module
         hashes the bytes against the digest recorded when the file was added and
         refuses before it parses anything that is not those bytes; then 32 MB in,
         64 KB of text out, 50 million pixels. A picture is drawn by the browser
         only after its header passed, from the checked bytes, as the type the
         content says it is (never the name's), and an SVG is shown as text.

     Each look takes a ticket like the list does: a look the visitor has left
     (closed, or looked at another file) never paints. A look that runs past its
     deadline stops the worker, and the next look starts a new one. */
  var PREVIEW_MODULE = 'bnr-explorer.wasm';
  var PREVIEW_SHA256 = '7739e3990ddc999ce15c6accf89e6b9073a4919854ae6413fd2db1cfeccf079f'; // PUBLIC-CONSTANT sha256 of surfaces/bnr-explorer.wasm (scripts/bnr-explorer/build-wasm.sh --check)
  var PREVIEW_MAX = 32 * 1024 * 1024;
  var PREVIEW_DEADLINE = 5000;
  var PREVIEW_RECYCLE = 8 * 1024 * 1024;   // after a look this large, the worker is retired so its memory goes back

  var LOOK = { ready: null, worker: null, pending: new Map(), seq: 0, held: null, url: null, last: null, pages: 0, off: null };
  var lookTicket = 0;

  var OFF_WHY = {
    wasm: 'this browser does not run WebAssembly',
    worker: 'this browser cannot start a worker',
    crypto: 'this browser has no SHA-256 for a worker',
    fetch: 'the preview module did not arrive',
    pin: 'the preview module that arrived is not the one this page was built with',
    compile: 'the preview module did not compile',
    imports: 'the preview module asks for outside access, and a preview must have none',
    start: 'the preview worker did not start'
  };

  function lookErr(kind, why) { return Object.assign(new Error(kind), { look: kind, why: why || null }); }

  function previewer() {
    if (LOOK.off) return Promise.reject(lookErr('off', LOOK.off));
    if (LOOK.ready) return LOOK.ready;
    LOOK.ready = startWorker();
    LOOK.ready.catch(function () { LOOK.ready = null; });
    return LOOK.ready;
  }

  /* The worker loads the module itself (this file reaches no network at all —
     e2e/myspace-seam.mjs §13 holds the shell to that), checks it against the pin
     sent here, and says the digest it saw; the page checks that digest again. A
     wrong pin or a module with imports is STRUCTURAL: previews stay off for the
     life of this page rather than being retried into a pass. */
  function startWorker() {
    return new Promise(function (res, rej) {
      if (typeof WebAssembly !== 'object' || typeof WebAssembly.compile !== 'function') return rej(lookErr('off', 'wasm'));
      if (typeof Worker !== 'function') return rej(lookErr('off', 'worker'));
      var w;
      try { w = new Worker('bnr-explorer-worker.js'); } catch (e) { return rej(lookErr('off', 'worker')); }
      var timer = setTimeout(function () { w.terminate(); rej(lookErr('off', 'start')); }, PREVIEW_DEADLINE);
      w.onerror = function () { clearTimeout(timer); w.terminate(); rej(lookErr('off', 'start')); };
      w.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.op === 'off') {
          clearTimeout(timer);
          w.terminate();
          var why = OFF_WHY[m.why] ? m.why : 'start';
          if (why === 'pin' || why === 'imports' || why === 'compile') LOOK.off = why;
          return rej(lookErr('off', why));
        }
        if (m.op !== 'ready') return;
        clearTimeout(timer);
        if (m.sha !== PREVIEW_SHA256 || m.imports !== 0) {
          w.terminate();
          LOOK.off = 'pin';
          return rej(lookErr('off', 'pin'));
        }
        LOOK.worker = w;
        LOOK.pages = m.pages;
        w.onerror = function () { retire('crash'); };
        w.onmessage = function (ev2) {
          var v = ev2.data || {};
          var p = v.op === 'verdict' && LOOK.pending.get(v.id);
          if (!p) return;
          clearTimeout(p.timer);
          LOOK.pending.delete(v.id);
          LOOK.pages = v.pages || LOOK.pages;
          if (v.refused) p.rej(lookErr('crash', v.refused)); else p.res(v.bytes);
        };
        res(w);
      };
      /* the version in the URL is the pin's, so a cached older module is never
         offered to a page that pins a newer one */
      w.postMessage({ op: 'init', url: PREVIEW_MODULE + '?v=' + PREVIEW_SHA256.slice(0, 12), pin: PREVIEW_SHA256 });
    });
  }

  /* Stop the worker and fail whatever it was doing; the next look starts a new one
     from the module already checked. */
  function retire(kind) {
    if (LOOK.worker) LOOK.worker.terminate();
    LOOK.worker = null;
    LOOK.ready = null;
    LOOK.pages = 0;
    LOOK.pending.forEach(function (p) { clearTimeout(p.timer); p.rej(lookErr(kind)); });
    LOOK.pending.clear();
  }

  function lookCall(digest, bytes) {
    return previewer().then(function (w) {
      return new Promise(function (res, rej) {
        var id = ++LOOK.seq;
        var timer = setTimeout(function () { LOOK.pending.delete(id); rej(lookErr('deadline')); retire('crash'); }, PREVIEW_DEADLINE);
        LOOK.pending.set(id, { res: res, rej: rej, timer: timer });
        w.postMessage({ op: 'preview', id: id, digest: digest, bytes: bytes });
      });
    });
  }

  var FORMATS = { 1: { name: 'PNG', mime: 'image/png' }, 2: { name: 'JPEG', mime: 'image/jpeg' }, 3: { name: 'GIF', mime: 'image/gif' }, 4: { name: 'WebP', mime: 'image/webp' } };

  /* The verdict wire (crates/bnr-explorer/src/wire.rs), read with every length
     checked; anything that does not parse exactly is a verdict of its own. */
  function readVerdict(b) {
    if (!(b instanceof Uint8Array) || b.length < 6 || b[0] !== 0x42 || b[1] !== 0x58 || b[2] !== 0x50 || b[3] !== 0x56 || b[4] !== 1) return { kind: 'bad' };
    var dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (b[5] === 1 && b.length >= 15 && 15 + dv.getUint32(11, true) === b.length) {
      try {
        return { kind: 'text', truncated: b[6] === 1, lines: dv.getUint32(7, true), text: new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(15)) };
      } catch (e) { return { kind: 'bad' }; }
    }
    if (b[5] === 2 && b.length === 15 && FORMATS[b[6]]) return { kind: 'image', format: FORMATS[b[6]], width: dv.getUint32(7, true), height: dv.getUint32(11, true) };
    if (b[5] === 3 && b.length === 8) return { kind: 'none', reason: b[6], detail: b[7] };
    return { kind: 'bad' };
  }

  function lookReason(v) {
    var f = FORMATS[v.detail];
    switch (v.reason) {
      case 1: return 'This file is larger than the 32 MB a preview reads, so no preview was made. Save it to see it.';
      case 2: return 'The bytes that came back are not the ones you added, so they were not shown.';
      case 3: return 'This file is empty.';
      case 4: return (f ? 'This looks like a ' + f.name + ' picture, but its structure is broken' : 'Its structure is broken') + ', so it was not drawn.';
      case 5: return 'This ' + (f ? f.name + ' ' : '') + 'picture says it has more pixels than a preview draws (50 million), so it was not drawn.';
      case 6: return 'This is not text or a picture a preview can show. Save it to open it with an app.';
      case 7: return ({ 1: 'PDFs are not previewed here.', 2: 'Sound and video are not previewed here.', 3: 'Archives are not opened here.', 4: 'This kind of picture (HEIC or AVIF) is not drawn here.' }[v.detail] || 'This kind of file is not previewed here.') + ' Save it to open it with an app.';
    }
    return 'The preview could not be made.';
  }

  function lookFailure(e) {
    if (e && e.look === 'off') return 'Previews are off on this device: ' + (OFF_WHY[e.why] || 'the preview could not start') + '. Nothing was read.';
    if (e && e.look === 'deadline') return 'The preview took longer than ' + (PREVIEW_DEADLINE / 1000) + ' seconds and was stopped.';
    if (e && e.look === 'crash') return 'The preview stopped before it finished.';
    return 'Could not read it (' + ((e && e.message) || 'error') + ').';
  }

  function lookRelease() {
    if (LOOK.url) URL.revokeObjectURL(LOOK.url);
    LOOK.url = null;
    LOOK.held = null;
    var view = $('look-view');
    view.textContent = '';
    view.removeAttribute('data-kind');
    view.removeAttribute('data-reason');
  }

  /* What the sheet shows, and what the gates read (`data-kind`, `data-reason`). */
  function lookSay(kind, sentence, reason) {
    var view = $('look-view');
    view.setAttribute('data-kind', kind);
    if (reason != null) view.setAttribute('data-reason', String(reason));
    $('look-body').textContent = sentence;
    LOOK.last = { kind: kind, reason: reason == null ? null : reason, said: sentence };
  }

  async function doLook(row) {
    var mine = ++lookTicket;
    setStatus('');
    try { row = await fresh(row); } catch (e) { if (staleSaid(e)) return; throw e; }
    if (mine !== lookTicket) return;
    lookRelease();
    sheetRow = row;
    $('look-title').textContent = row.name;
    lookSay('reading', t('reading'));
    document.body.setAttribute('data-state', 'look');
    try {
      /* the size is known from the index: an object over the budget is not read at all */
      if (row.size > PREVIEW_MAX) return lookSay('none', lookReason({ reason: 1 }), 1);
      /* isolation first: if there is no preview, there is no reason to read the file */
      await previewer();
      if (mine !== lookTicket) return;
      var got = await checkedBytes(row);
      if (mine !== lookTicket) return;
      var v = readVerdict(await lookCall(row.sha256, got.bytes));
      if (got.bytes.length > PREVIEW_RECYCLE) retire('recycled');
      if (mine !== lookTicket) return;
      LOOK.held = { id: row.id, bytes: got.bytes };
      var checked = COPY[reg()].checked(got.first, row.sha256);
      if (v.kind === 'text') {
        var pre = document.createElement('pre');
        pre.textContent = v.text;
        $('look-view').appendChild(pre);
        lookSay('text', checked + (v.truncated ? ' Showing the start: ' + v.lines + (v.lines === 1 ? ' line.' : ' lines.') : ''));
      } else if (v.kind === 'image') {
        var img = document.createElement('img');
        img.alt = row.name;
        img.width = v.width;
        img.height = v.height;
        LOOK.url = URL.createObjectURL(new Blob([got.bytes], { type: v.format.mime }));
        img.src = LOOK.url;
        $('look-view').appendChild(img);
        lookSay('image', checked + ' ' + v.format.name + ' · ' + v.width + ' × ' + v.height + '.');
        img.decode().then(null, function () {
          if (mine !== lookTicket) return;
          $('look-view').textContent = '';
          lookSay('none', 'The header was sound but this picture could not be drawn.', 0);
        });
      } else if (v.kind === 'none') {
        lookSay('none', lookReason(v), v.reason);
      } else {
        lookSay('none', 'The preview could not be made.', 0);
      }
    } catch (e) {
      if (mine !== lookTicket) return;
      if (staleSaid(e)) return;
      if (e && e.identity) return lookSay('none', lookReason({ reason: 2 }), 2);
      lookSay(e && e.look === 'off' ? 'off' : 'none', lookFailure(e), e && e.look === 'off' ? e.why : 0);
    }
  }

  function closeLook() {
    ++lookTicket;
    lookRelease();
    closeSheet();
  }

  /* Saving from a look hands over the bytes the look already checked; there is
     no second read. A look that never read bytes (too large, previews off)
     saves the way Open does. */
  function saveLook() {
    var row = sheetRow;
    var held = LOOK.held;
    closeLook();
    if (!row) return;
    if (held && held.id === row.id) {
      handToDevice(held.bytes, row.name, row.type);
      setStatus(t('done'));
    } else {
      doOpen(row);
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
    $('lookClose').onclick = closeLook;
    $('lookSave').onclick = saveLook;

    /* register.js (mounted by tour.js) owns the switch; this page only re-renders its
       own words when the switch fires. No second switch is built here. */
    document.addEventListener('bregister', function () { render(); });

    if (!signer()) {
      setStatus('This browser could not load the signing engine, so nothing can be sent to the hive. Files you keep here are unaffected.', true);
    }

    /* Every rail is spawned at load, not at first use, so the page knows which
       purposes it can honestly offer before the visitor picks one. This touches
       no network: `describe` is answered inside each worker, and two of the three
       workers contain no network primitive at all.

       THE LIST DOES NOT WAIT FOR THE SLOWEST RAIL. The device index is this
       phone's own, so it is drawn at once, each row saying whether its rail has
       answered yet; each rail's answer lands on its own rows the moment it
       arrives (a this-visit-only rail's rows are swept then, by its own word).
       Until this slice nothing reliable was on screen until every rail had
       answered: measured with one adapter script held back 3 s, the true words
       for a file kept on this phone arrived after 3.15 s. */
    var swept = 0;
    var sweeping = Promise.resolve();
    RAILS.forEach(function (r) {
      try { rail(r.scheme); } catch (e) { return; }
      settled(r.scheme).then(function () {
        sweeping = sweeping.then(async function () {
          var tm = terms(r.scheme);
          if (!(tm && tm.survives_reload === false)) return 0;
          var n = await sweepEphemeral(await loadRows());
          swept += n;
          return n;
        });
        return sweeping;
      }).then(function (n) {
        /* the cards are cheap and the visitor chooses from them: they follow each
           answer at once, not the end of a long list's draw */
        renderPurposes();
        return n ? render() : repaint();
      });
    });
    render();

    allSettled().then(function () { return sweeping; }).then(async function () {
      if (!availablePurposes().length) {
        setStatus('This page could not load any storage adapter, so there is nothing it can honestly offer to do with a file.', true);
      }
      await render();
      if (swept) setStatus(COPY[reg()].swept(swept));
      var q = new URLSearchParams(location.search);
      var f = q.get('f');
      if (f && /^[0-9a-f]{64}$/.test(f)) openShared(f, q.get('n'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Opened for the My Space gates (`e2e/myspace-seam.mjs`, `myspace-eternal.test.mjs`,
     `myspace-stranger.mjs`) and for nothing else; not a public API. Each of these is
     read by a named assertion in the seam gate. */
  window.__myspace = {
    adapter: function (scheme) { return adapters[scheme || 'blossom'] || null; },
    adapters: function () { return adapters; },
    terms: terms,
    railFor: railFor,
    purposes: function () { return availablePurposes().map(function (p) { return p.id; }); },
    devicePubkey: devicePubkey,
    rows: loadRows,
    render: render,
    phase: railPhase,
    look: function () { return { last: LOOK.last, pages: LOOK.pages, off: LOOK.off, worker: !!LOOK.worker }; }
  };
})();
