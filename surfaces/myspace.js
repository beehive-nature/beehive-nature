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
     Three adapters, one contract, one seam. Two of them speak to nothing at all,
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
    { scheme: 'blossom', script: 'myspace-adapter-blossom.js' }
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
    setStatus(t('joining'));
    await railOp(scheme, 'join', {});
    joined[scheme] = true;
    return true;
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
      joining: 'Putting this phone in the hive — that is what lets it hold a file, and what lets a link open.',
      copy: 'Copy link', move: 'Move it',
      working: 'Putting it away…', done: 'Done.',
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
      'share-title': 'show it', 'share-body': 'the link opens it.',
      joining: 'this phone is joining the hive. that is what makes a link open.',
      copy: 'copy link', move: 'move it',
      working: 'stashing…', done: 'done.',
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
      joining: 'claiming the standing invite for this device key.',
      copy: 'copy URL', move: 'REWRITE',
      working: 'writing to rail…', done: 'written.',
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
      readers: { 'this-device': 'Only this phone opens it.', 'link-holders': 'Anyone with the link opens it.' },
      lifetime: { 'until-this-tab-closes': 'It goes when you close this tab.', 'until-you-delete-it': 'It stays until you remove it.', 'while-the-store-keeps-it': 'It stays as long as the hive keeps it.' },
      deletable: { yes: 'You can take it back.', no: 'You cannot take it back.' },
      payer: { nobody: 'Nobody is paying for it.', 'the-hive': 'The hive is paying for it.' }
    },
    raver: {
      readers: { 'this-device': 'this phone only.', 'link-holders': 'the link opens it.' },
      lifetime: { 'until-this-tab-closes': 'gone when this tab closes.', 'until-you-delete-it': 'stays till you drop it.', 'while-the-store-keeps-it': 'stays while the hive holds it.' },
      deletable: { yes: 'you can pull it back.', no: 'you cannot pull it back.' },
      payer: { nobody: 'nobody paid.', 'the-hive': 'the hive paid.' }
    },
    cypherpunk: {
      readers: { 'this-device': 'readers: this device', 'link-holders': 'readers: link holders' },
      lifetime: { 'until-this-tab-closes': 'lifetime: session', 'until-you-delete-it': 'lifetime: until dropped', 'while-the-store-keeps-it': 'lifetime: store-bound' },
      deletable: { yes: 'deletable: yes', no: 'deletable: no' },
      payer: { nobody: 'payer: none', 'the-hive': 'payer: the hive' }
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

  async function encryptFor(id, bytes) {
    var key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes));
    await putKey(id, { key: key, iv: iv });
    var out = new Uint8Array(12 + ct.length);
    out.set(iv, 0);
    out.set(ct, 12);
    return out;
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
    var payload = encryptsFor(scheme) ? await encryptFor(id, plain) : plain;
    var res = await railPut(scheme, payload);
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
    return ' An open copy you shared earlier is still in the hive at ' +
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

  function setStatus(msg, loud) {
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
      body.textContent = purposeBody(p.id) + ' ' + termsLine(railFor(p.id));
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
      badge.className = 'badge' + (row.purpose === 'share' ? ' pub' : '');
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
        left.textContent = 'An open copy you shared earlier is still in the hive at ' + row.oldAddr.address.slice(0, 12) + '…';
        h.appendChild(left);
      }
      art.appendChild(h);

      var actions = document.createElement('div');
      actions.className = 'actions' + (addrOf(row) && row.purpose === 'share' ? ' three' : '');

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
      del.textContent = t('remove');
      del.onclick = function () { openSheet('delete', row); };
      actions.appendChild(del);

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
    var id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var plain = new Uint8Array(await file.arrayBuffer());
    var want = pendingPurpose;
    var scheme = railFor(want);
    if (!scheme) {
      setStatus('No rail on this page can do that right now, so nothing was written. Your file is still yours — try another choice.', true);
      return;
    }

    var row = {
      id: id, name: file.name || 'file', size: plain.length, type: file.type || '',
      purpose: want, ts: Date.now(), addr: null, keyref: null
    };

    setStatus(t('working'));
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
          setStatus('That did not go through (' + (e.message || 'error') + '), so nothing left this phone. It is here, locked, and you can try again.', true);
        } catch (e2) {
          setStatus('Nothing was written (' + (e2.message || e.message || 'error') + '), so nothing left this phone.', true);
        }
      } else {
        setStatus('Nothing was written (' + (e.message || 'error') + '), so nothing left this phone.', true);
      }
    }
    /* Back to the most private purpose any rail can answer. Slice 02 did the
       same thing with two modes and it is worth more with three: the purpose
       picker only shows while the page is empty, so whatever is selected when
       the next file arrives was not chosen for that file. The default that
       carries no surprise is the one that sends the bytes least far, and
       `PURPOSES` is ordered from the most private outward precisely so this line
       cannot drift into meaning something else. */
    var open = availablePurposes();
    pendingPurpose = open.length ? open[0].id : null;
    await render();
  }

  async function doMove(row, toId) {
    var toScheme = railFor(toId);
    if (!toScheme) { setStatus('That is not available right now, so nothing changed.', true); return closeSheet(); }
    setStatus(t('flipping'));
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
      setStatus('Nothing changed — ' + (e.message || 'that did not work') + '.', true);
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

  /* ---------- a shared link ---------- */

  async function openShared(address, name) {
    var scheme = railFor('share');
    if (!scheme) {
      setStatus('This page cannot open a shared file right now: it has no rail that reads one.', true);
      return;
    }
    setStatus('Opening ' + (name || 'the file') + '…');
    try {
      var bytes = (await railGet(scheme, address)).bytes;
      var url = URL.createObjectURL(new Blob([bytes]));
      var a = document.createElement('a');
      a.href = url;
      a.download = name || (address.slice(0, 12) + '.bin');
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
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
