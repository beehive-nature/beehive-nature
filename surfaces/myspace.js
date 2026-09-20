/* myspace.js — MY SPACE, the shell (`bee` authored first; one DOM, three registers).

   Order: PLANS/MYSPACE_01_SLICE.md (founder events ebedeaf6 / 9bc95b29); slice 02
   cut by the coordinator seat 2026-09-20 20:06Z — seam first, Blossom as the
   first adapter, and a row that carries {scheme, address} instead of a bare hash.
   Comps: OUTBOX/2026-09-20_MYSPACE_COMPS/myspace-comp.html.

   THIS FILE NO LONGER KNOWS A RAIL. Every measured fact about the hive's blob
   store — images only, no DELETE route, member-gated at both ends, `x-sha-256`
   required, the PNG wrapper, the invite door — moved to
   `surfaces/myspace-adapter-blossom.js`, which is where those measurements are
   now written down (they were taken on 2026-09-20 and recorded in
   WORK_LOGS/2026-09-20_BOPUS5_MYSPACE01_STEP0_BLOSSOM.md). What stays here is the
   half that is not the rail's: the device key, the signature over an adapter's
   digest, the retry decision, the index, and the words.

   Two sentences the shell still owns, because they are about the visitor and not
   about a store:

     - PRIVATE never reaches an adapter at all. Those bytes are encrypted and kept
       in this browser, so nobody is enrolled in anything for keeping a file to
       themselves.
     - a copy that has been shared cannot be unshared. The delete and flip
       sentences say that in words, and they are written against THIS rail's
       measured truth. When a second adapter lands, that sentence has to come from
       the adapter rather than from this file — named here, not built here, because
       one rail cannot exercise a per-rail answer.

   The device index is the truth. That is what makes "come back later and find it"
   true by construction rather than by promise. */
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
        /* v2: private bytes live HERE and nowhere else. See the joining note below. */
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

  /* ---------- an address is {scheme, address}, never a bare hash ----------
     Slice 01 stored `sha` — an address under a scheme nobody wrote down, which
     was unambiguous only because there was exactly one rail. There will not be.
     The migration below is not a guess: every row that carries a `sha` was
     written by slice 01, and slice 01 had no rail but this one, so the scheme is
     known rather than inferred. It runs once per row and persists. */
  function addrOf(row) { return (row.addr && row.addr.address) || null; }

  function migrateRow(row) {
    var moved = false;
    if (row.sha && !row.addr) { row.addr = { scheme: RAIL, address: row.sha }; moved = true; }
    if (row.oldSha && !row.oldAddr) { row.oldAddr = { scheme: RAIL, address: row.oldSha }; moved = true; }
    if (moved) { delete row.sha; delete row.oldSha; }
    return moved;
  }

  async function loadRows() {
    var rows = await allRows();
    var moved = rows.filter(migrateRow);
    for (var i = 0; i < moved.length; i++) await putRow(moved[i]);
    return rows;
  }
  function putRow(row) { return tx('files', 'readwrite', function (s) { return s.put(row); }); }
  function dropRow(id) { return tx('files', 'readwrite', function (s) { return s.delete(id); }); }
  function putKey(id, key) { return tx('keys', 'readwrite', function (s) { return s.put(key, id); }); }
  function getKey(id) { return tx('keys', 'readonly', function (s) { return s.get(id); }); }
  function dropKey(id) { return tx('keys', 'readwrite', function (s) { return s.delete(id); }); }
  function putBlob(id, bytes) { return tx('blobs', 'readwrite', function (s) { return s.put(bytes, id); }); }
  function getBlob(id) { return tx('blobs', 'readonly', function (s) { return s.get(id); }); }
  function dropBlob(id) { return tx('blobs', 'readwrite', function (s) { return s.delete(id); }); }

  /* ---------- the rail, on the far side of a boundary ----------
     Slice 02. Everything this page used to know about the hive's blob store —
     the origin, the kind:24242 auth event, the PNG wrapper the store's image-only
     decoder requires, the invite door — moved into
     `surfaces/myspace-adapter-blossom.js`, which runs in its own dedicated Web
     Worker behind SPEC-ADAPTER-CONTRACT-1 (§1, §2). What is left here is the
     shell's half and only that: the device key, the signature, the outbox
     decision, and the words.

     The shape below is the contract's, not a convenience: an adapter NEVER holds
     key material (§4), and this rail authenticates every single request, so each
     call is two halves — the adapter builds an unsigned request and hands back a
     digest, this page signs that digest with the key that has never left it, and
     the adapter speaks to the rail with the signature only. `intent_id` is the
     idempotency key, and a retry resubmits the identical intent under the
     identical signature (§6). The shell owns the retry; the adapter has none.

     THE BOUNDARY (ruled by the coordinator seat, 2026-09-20 19:05Z) SURVIVES THE
     MOVE and is now held by construction twice over: the claim fires only on the
     sharing path, and the private path never calls `railOp` at all — those bytes
     are encrypted and stored without this section being entered. Spawning the
     worker touches no network: `describe` is answered locally. */

  var RAIL = 'blossom';
  var ADAPTER_SCRIPT = 'myspace-adapter-blossom.js';

  /* The adapter's own codes. §6: an adapter answers with a code, never a
     plain-language string the shell has to parse to learn what happened. */
  var MEMBERSHIP_REQUIRED = -32020;
  var NOT_PERMITTED = -32023;

  var adapter = null;
  var joined = false;

  function rail() {
    if (!adapter) {
      if (!window.BnrSeam) throw new Error('the adapter seam did not load, so nothing can be shared from this phone');
      adapter = window.BnrSeam.spawn(RAIL, ADAPTER_SCRIPT);
    }
    return adapter;
  }

  async function signDigest(digest) {
    var s = signer();
    if (!s) throw new Error('signer unavailable');
    return hex(await s.sign(fromHex(digest), SK));
  }

  async function railOp(verb, params) {
    var a = rail();
    await a.ready;
    var begin = 'x.begin' + verb;
    var submit = 'x.submit' + verb;
    /* §9.2 is not a check here — `ops` was built from the adapter's own
       declaration, so an undeclared capability has no function to call and no
       message is dispatched. This reads the same shape for a reason. */
    if (!a.can(begin) || !a.can(submit)) throw new Error(RAIL + ' does not declare ' + verb.toLowerCase());
    var p = params || {};
    p.pubkey = devicePubkey();
    if (!p.pubkey) throw new Error('signer unavailable');
    var intent = await a.ops[begin](p);
    var sig = await signDigest(intent.digest);
    try {
      return await a.ops[submit]({ intent_id: intent.intent_id, sig: sig });
    } catch (e) {
      if (e.code !== MEMBERSHIP_REQUIRED || verb === 'Join') throw e;
      await joinHive();
      /* The IDENTICAL intent and the IDENTICAL signature. The shell resubmits; it
         never re-signs and never builds a second intent (§6). */
      return a.ops[submit]({ intent_id: intent.intent_id, sig: sig });
    }
  }

  async function joinHive() {
    if (joined) return true;
    /* Said at the moment it happens, not in a footnote: this puts the visitor's own key
       in the hive's member list. It is the price of the rail and they should read it as
       it is paid. */
    setStatus(t('joining'));
    await railOp('Join', {});
    joined = true;
    return true;
  }

  function railPut(bytes) { return railOp('Put', { bytes: bytes }); }
  function railGet(address) { return railOp('Get', { address: address }); }

  /* ---------- copy, per register. Same facts, same storage, same routes. ---------- */

  var COPY = {
    bee: {
      kicker: 'My Space', title: 'My Space',
      lede: 'Your files live on this phone.',
      empty: 'Nothing here yet. Add a file from this phone. You choose who can open it.',
      attach: 'Add a file',
      'pub-title': 'Public', 'pub-body': 'Anyone with the link opens it. Their phone joins the hive to do that, the same way this one did.',
      joining: 'Putting this phone in the hive — that is what lets it hold a file, and what lets a link open.',
      'priv-title': 'Private', 'priv-body': 'Only this phone. Locked here, and it never leaves.',
      'badge-pub': 'anyone with the link', 'badge-priv': 'only this phone',
      'why-pub': 'An open copy sits in the hive at its hash.',
      'why-priv': 'Locked on this phone. It never left.',
      copy: 'Copy link',
      locking: 'Locking it on this phone…', locked: 'Locked. Nothing left this phone.',
      sharing: 'Putting an open copy in the hive…', shared: 'In the hive. Copy the link to share it.',
      flipping: 'Changing who can open it…',
      'flip-to-pub': 'Make it public', 'flip-to-priv': 'Make it private',
      remove: 'Remove', keep: 'Keep it', confirm: 'Remove from this phone',
      'flip-keep': 'Leave it as it is', 'flip-go': 'Change it',
      law: 'This phone remembers. There is no account. Come back later on this phone and it is still here.',
      'tech-summary': 'index · rail · identity',
      count: function (n) { return n === 1 ? '1 file on this phone' : n + ' files on this phone'; }
    },
    raver: {
      kicker: 'my space', title: 'my space',
      lede: 'yours. this phone. one tap.',
      empty: 'drop a file in.',
      attach: 'add a file',
      'pub-title': 'public', 'pub-body': 'the link opens it. their phone joins the hive to do it, same as yours did.',
      joining: 'this phone is joining the hive. that is what makes a link open.',
      'priv-title': 'private', 'priv-body': 'sealed here. stays here.',
      'badge-pub': 'link opens it', 'badge-priv': 'this phone only',
      'why-pub': 'an open copy is in the hive, at its hash.',
      'why-priv': 'sealed here. it never left.',
      copy: 'copy link',
      locking: 'sealing…', locked: 'sealed. nothing left this phone.',
      sharing: 'sending an open copy…', shared: 'in the hive. grab the link.',
      flipping: 'switching…',
      'flip-to-pub': 'make public', 'flip-to-priv': 'make private',
      remove: 'remove', keep: 'keep', confirm: 'remove',
      'flip-keep': 'leave it', 'flip-go': 'change it',
      law: 'same phone, still here. no account.',
      'tech-summary': 'index · rail · identity',
      count: function (n) { return n === 1 ? '1 file' : n + ' files'; }
    },
    cypherpunk: {
      kicker: 'surfaces/myspace.html', title: 'MY SPACE',
      lede: 'Device index is authority. Store is a blob rail.',
      empty: '0 objects. PUT a blob from this device.',
      attach: 'PUT',
      'pub-title': 'PUBLIC', 'pub-body': 'plaintext by sha256. member-gated GET: anonymous 401, unclaimed key 403. a reader claims the standing invite and reads.',
      joining: 'POST /api/invites/claim — this device key enters the member list.',
      'priv-title': 'PRIVATE', 'priv-body': 'AES-GCM in-browser. ciphertext and key both stay in IndexedDB. no PUT.',
      'badge-pub': 'PUBLIC', 'badge-priv': 'PRIVATE',
      'why-pub': 'plaintext blob on the rail at its sha256.',
      'why-priv': 'ciphertext in local store. no rail record exists.',
      copy: 'copy URL',
      locking: 'AES-GCM encrypt -> IndexedDB blobs…', locked: 'sealed local. zero bytes on the wire.',
      sharing: 'PUT /upload…', shared: 'PUT 200. blob addressed by sha256.',
      flipping: 're-addressing…',
      'flip-to-pub': 're-PUT public', 'flip-to-priv': 're-PUT private',
      remove: 'DROP', keep: 'abort', confirm: 'DROP ROW',
      'flip-keep': 'abort', 'flip-go': 're-PUT',
      law: 'Come-back is the device index. No login, no session.',
      'tech-summary': 'index · rail · identity',
      count: function (n) { return n + ' object' + (n === 1 ? '' : 's'); }
    }
  };

  function reg() {
    var r = document.body.getAttribute('data-reg');
    return COPY[r] ? r : 'bee';
  }
  function t(key) { return COPY[reg()][key]; }

  /* The two delete sentences. They differ because the store differs, and flattening them
     into one would be the lie this page exists not to tell. */
  function deleteSentence(row) {
    if (row.mode === 'private') {
      if (row.oldAddr) {
        return 'The locked bytes and the key are both on this phone, and both go. The open copy you shared earlier is still in the hive at ' +
          row.oldAddr.address.slice(0, 12) + '…, and this cannot reach it.';
      }
      return 'The locked bytes and the key are both on this phone, and both go. Nothing about this file exists anywhere else.';
    }
    return 'This phone forgets the file. The copy in the hive’s store stays at its hash, and anyone who already has the link still has it.';
  }

  /* Said at the moment of the flip, never in a footnote. */
  function flipSentence(row) {
    if (row.mode === 'private') {
      return 'This phone puts an open copy in the hive, and joins the hive itself to do it. Anyone with the new link can then open it. Making it private again later does not pull that copy back: anyone who already has the link still has it.';
    }
    return 'This phone locks a new copy and keeps the key here. The open copy you already shared stays in the hive at its hash, and anyone who has that link still has it. Locking it now protects what you share from here on, not what you already shared.';
  }

  /* ---------- render ---------- */

  var pendingMode = 'private';
  var sheetRow = null;
  var sheetKind = null;

  function setStatus(msg, loud) {
    var el = $('status');
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle('loud', !!loud);
  }

  function applyCopy() {
    document.querySelectorAll('[data-reg-copy]').forEach(function (el) {
      var k = el.getAttribute('data-reg-copy');
      var v = COPY[reg()][k];
      if (typeof v === 'string') el.textContent = v;
    });
    $('modePublic').setAttribute('aria-pressed', String(pendingMode === 'public'));
    $('modePrivate').setAttribute('aria-pressed', String(pendingMode === 'private'));
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
      badge.className = 'badge' + (row.mode === 'public' ? ' pub' : '');
      badge.textContent = row.mode === 'public' ? t('badge-pub') : t('badge-priv');
      meta.appendChild(badge);
      art.appendChild(meta);

      var why = document.createElement('p');
      why.className = 'why';
      why.textContent = row.mode === 'public' ? t('why-pub') : t('why-priv');
      art.appendChild(why);

      var h = document.createElement('p');
      h.className = 'hash';
      var prov = document.createElement('span');
      prov.className = 'prov';
      /* The scheme is shown because the row now carries one. "sha256 <hex>" was
         the shell naming the rail's hash function, which is exactly the knowledge
         the shell no longer has and should not pretend to. */
      prov.textContent = (row.addr ? (row.addr.scheme + ':' + row.addr.address) : 'no rail record — these bytes are only here') +
        (row.keyref ? ('\nkeyref ' + row.keyref) : '') +
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
      actions.className = 'actions' + (addrOf(row) && row.mode === 'public' ? ' three' : '');

      if (addrOf(row) && row.mode === 'public') {
        var share = document.createElement('button');
        share.type = 'button';
        share.className = 'ghost';
        share.textContent = t('copy');
        share.onclick = function () {
          /* `f` carries a bare address and means this rail, because every link
             ever minted from this page was minted against this rail. It is not
             widened here: a second rail needs a scheme in the link, and inventing
             that parameter before a second rail exists would be a guess at its
             shape. Named, not built. */
          var link = location.origin + location.pathname + '?f=' + addrOf(row) + '&n=' + encodeURIComponent(row.name);
          navigator.clipboard.writeText(link).then(function () {
            setStatus('Link copied. Whoever opens it joins the hive to read it, then the file opens.');
          }, function () { setStatus('Link: ' + link); });
        };
        actions.appendChild(share);
      }

      var flip = document.createElement('button');
      flip.type = 'button';
      flip.className = 'ghost';
      flip.textContent = row.mode === 'private' ? t('flip-to-pub') : t('flip-to-priv');
      flip.onclick = function () { openSheet('flip', row); };
      actions.appendChild(flip);

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
    sheetKind = kind;
    if (kind === 'delete') {
      $('del-title').textContent = 'Remove ' + row.name + '?';
      $('del-body').textContent = deleteSentence(row);
    } else {
      $('flip-title').textContent = (row.mode === 'private' ? 'Make ' : 'Lock ') + row.name +
        (row.mode === 'private' ? ' public?' : ' to this phone?');
      $('flip-body').textContent = flipSentence(row);
    }
    document.body.setAttribute('data-state', kind);
  }

  function closeSheet() {
    sheetRow = null;
    sheetKind = null;
    render();
  }

  /* ---------- the acts ---------- */

  async function encryptFor(id, bytes) {
    var key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes));
    await putKey(id, { key: key, iv: iv });
    var joined = new Uint8Array(12 + ct.length);
    joined.set(iv, 0);
    joined.set(ct, 12);
    return joined;
  }

  async function addFile(file) {
    var id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var plain = new Uint8Array(await file.arrayBuffer());
    var mode = pendingMode;
    var row = {
      id: id, name: file.name || 'file', size: plain.length, type: file.type || '',
      mode: mode, ts: Date.now(), addr: null, keyref: null
    };

    if (mode === 'private') {
      /* Nothing leaves. The bytes are encrypted and kept in this browser, which is both
         the strongest form of the promise on the mode button and the reason a private
         file never puts this phone in anybody's member list. */
      setStatus(t('locking'));
      await putBlob(id, await encryptFor(id, plain));
      row.keyref = 'device:aes-gcm:v1';
      row.local = true;
      await putRow(row);
      setStatus(t('locked'));
      pendingMode = 'private';
      await render();
      return;
    }

    setStatus(t('sharing'));
    try {
      var res = await railPut(plain);
      row.addr = { scheme: res.scheme, address: res.address };
      await putRow(row);
      setStatus(t('shared'));
    } catch (e) {
      /* The file is still the visitor's — the index keeps it even when the rail refuses.
         Saying "shared" while the upload failed would be exactly the lie this page avoids. */
      row.local = true;
      row.mode = 'private';
      await putBlob(id, await encryptFor(id, plain));
      row.keyref = 'device:aes-gcm:v1';
      await putRow(row);
      setStatus('The hive did not take it (' + (e.message || 'error') + '), so nothing left this phone. It is here, locked, and you can try to share it again.', true);
    }
    pendingMode = 'private';
    await render();
  }

  async function plainBytes(row) {
    if (row.local) {
      var stored = await getBlob(row.id);
      if (!stored) throw new Error('this phone no longer holds the bytes for that file');
      var k = await getKey(row.id);
      if (!k) throw new Error('the key for this file is gone from this phone');
      var joinedBytes = new Uint8Array(stored);
      return new Uint8Array(await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: joinedBytes.subarray(0, 12) }, k.key, joinedBytes.subarray(12)));
    }
    if (!addrOf(row)) throw new Error('this file is neither on this phone nor on the rail');
    /* The adapter hands back exactly the bytes that were handed to it. Whatever
       the rail needed them to look like on the wire is the rail's business and
       stays behind the boundary. */
    return (await railGet(addrOf(row))).bytes;
  }

  async function doFlip(row) {
    setStatus(t('flipping'));
    try {
      var bytes = await plainBytes(row);

      if (row.mode === 'private') {
        /* private -> public: this is the sharing path, so the rail (and, if this phone is
           not a member yet, the claim) happens HERE and nowhere else. */
        var res = await railPut(bytes);
        row.addr = { scheme: res.scheme, address: res.address };
        row.mode = 'public';
        row.local = false;
        row.keyref = null;
        await dropBlob(row.id);
        await dropKey(row.id);
        await putRow(row);
        setStatus('An open copy is in the hive now. Anyone with the link can open it.');
      } else {
        /* public -> private: the copy already in the hive CANNOT be pulled back. The store
           has no delete route (405, Allow: GET,HEAD), so the honest result is a locked copy
           here plus an open copy that stays where it is. */
        await putBlob(row.id, await encryptFor(row.id, bytes));
        row.oldAddr = row.addr;
        row.addr = null;
        row.mode = 'private';
        row.local = true;
        row.keyref = 'device:aes-gcm:v1';
        await putRow(row);
        setStatus('Locked on this phone. The open copy you already shared stays in the hive at ' +
          row.oldAddr.address.slice(0, 12) + '… and anyone holding that link still has it.', true);
      }
    } catch (e) {
      setStatus('Nothing changed — ' + (e.message || 'the hive refused') + '.', true);
    }
    closeSheet();
  }

  async function doDelete(row) {
    /* Private: the key dies here and the ciphertext dies with it.
       Public: the row goes and the blob stays. Two acts, two sentences. */
    if (row.mode === 'private') { await dropKey(row.id); await dropBlob(row.id); }
    await dropRow(row.id);
    setStatus(row.mode === 'private'
      ? (row.oldAddr
          ? 'Gone from this phone. The open copy you shared earlier is still in the hive at ' + row.oldAddr.address.slice(0, 12) + '\u2026.'
          : 'Gone. The bytes and the key were both here, and this file existed nowhere else.')
      : 'Gone from this phone. The copy in the hive stays at its hash.');
    closeSheet();
  }

  /* ---------- a shared link ---------- */

  async function openShared(address, name) {
    setStatus('Opening ' + (name || 'the file') + '…');
    try {
      var bytes = (await railGet(address)).bytes;
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
    $('modePublic').onclick = function () { pendingMode = 'public'; applyCopy(); };
    $('modePrivate').onclick = function () { pendingMode = 'private'; applyCopy(); };
    $('delKeep').onclick = closeSheet;
    $('flipKeep').onclick = closeSheet;
    $('delConfirm').onclick = function () { if (sheetRow) doDelete(sheetRow); };
    $('flipGo').onclick = function () { if (sheetRow) doFlip(sheetRow); };

    /* register.js (mounted by tour.js) owns the switch; this page only re-renders its
       own words when the switch fires. No second switch is built here. */
    document.addEventListener('bregister', function () { render(); });

    if (!signer()) {
      setStatus('This browser could not load the signing engine, so nothing can be sent to the hive. Files you add stay on this phone.', true);
    }

    /* The worker is spawned at load, not at the first share, so the page knows
       whether it has a rail before the visitor asks it for one. This touches no
       network: `describe` is answered inside the worker. A visitor who only ever
       keeps files to themselves still sends nothing anywhere. */
    try { rail(); } catch (e) {
      setStatus('This page could not load its storage adapter, so nothing can be shared from here. Files you add stay on this phone.', true);
    }

    var q = new URLSearchParams(location.search);
    var f = q.get('f');
    render().then(function () {
      if (f && /^[0-9a-f]{64}$/.test(f)) openShared(f, q.get('n'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Opened for `e2e/myspace-seam.mjs` and for nothing else; not a public API.
     Slice 01 listed the PNG wrapper here "for the e2e walk" while no walk
     existed — a signal prettier than the truth, and it is deleted rather than
     patched. These four are each read by a named assertion in that gate. */
  window.__myspace = {
    adapter: function () { return adapter; },
    devicePubkey: devicePubkey,
    rows: loadRows,
    render: render
  };
})();
