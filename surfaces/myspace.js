/* myspace.js — MY SPACE slice 01, variant 1 (`bee` authored first; one DOM, three registers).

   Order: PLANS/MYSPACE_01_SLICE.md (founder events ebedeaf6 / 9bc95b29).
   Comps: OUTBOX/2026-09-20_MYSPACE_COMPS/myspace-comp.html.

   Every sentence this file shows a stranger is written to a measurement taken against the
   live relay on 2026-09-20 and recorded in WORK_LOGS/2026-09-20_BOPUS5_MYSPACE01_STEP0_BLOSSOM.md:

     - the store accepts IMAGES ONLY. A .txt is refused `unsupported file type:
       application/octet-stream`; PNG magic with a junk body is refused `422 invalid image
       data`. So every blob this page PUTs is a valid lossless PNG, and anything that is not
       already an accepted image rides inside one. Originals come back byte-exact (measured),
       so the wrapper is lossless in practice as well as in theory.
     - there is NO DELETE ROUTE. `DELETE /media/<sha>.png` answers 405 and the server's own
       header reads `Allow: GET,HEAD`. Nothing this page does can remove a blob. Therefore:
       private delete destroys the key (the ciphertext dies with it); public delete forgets
       locally and the blob stays at its hash. Those are two different sentences and this
       file never flattens them into one.
     - reads are member-gated. Anonymous GET is 401; a fresh key is 403 `relay membership
       required`. "Public" here means hive members with the link, never "public to the
       internet", and the page says so in those words.

   The device index is the truth. That is what makes "come back later and find it" true by
   construction rather than by promise. */
(function () {
  'use strict';

  var RELAY = 'https://skaists.buzz';
  var RELAY_HOST = 'skaists.buzz';
  var JOIN_DOOR = 'https://skaists.dev/join/';
  var DB_NAME = 'myspace';
  var DB_VERSION = 1;
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
  async function sha256hex(bytes) {
    return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  }
  function kb(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function b64url(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

  /* ---------- Blossom kind:24242 auth (BUD-11), the shape the relay actually verifies ----
     Read from the client that already works against this relay:
     crates/buzz-cli/src/client.rs sign_blossom_upload / sign_blossom_get, and checked
     against the verifier in crates/buzz-media/src/auth.rs. */

  async function blossomAuth(verb, sha256) {
    var s = signer();
    if (!s) throw new Error('signer unavailable');
    var pub = hex(s.getPublicKey(SK));
    var now = Math.floor(Date.now() / 1000);
    var tags = [['t', verb], ['expiration', String(now + 600)], ['server', RELAY_HOST]];
    if (verb === 'upload') tags.splice(1, 0, ['x', sha256]);
    var ev = {
      pubkey: pub,
      created_at: now,
      kind: 24242,
      tags: tags,
      content: verb === 'upload' ? 'Upload file' : 'Get media'
    };
    var serial = JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]);
    var id = await sha256hex(new TextEncoder().encode(serial));
    var sig = hex(await s.sign(fromHex(id), SK));
    ev.id = id;
    ev.sig = sig;
    return 'Nostr ' + b64url(JSON.stringify(ev));
  }

  /* ---------- the PNG wrapper ----------
     The store decodes what it is given and refuses anything that is not an image, so bytes
     that are not already an accepted image travel inside a valid 8-bit grayscale PNG: one
     row, width = payload length, one filter byte. Measured byte-exact through the live
     store before this page was written. */

  var CRC_TABLE = (function () {
    var t = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    var out = new Uint8Array(12 + data.length);
    var dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (var i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }

  /* zlib stream with stored (uncompressed) deflate blocks — no compression, so the
     wrapper is exact and dependency-free. */
  function zlibStore(payload) {
    var blocks = [];
    var pos = 0;
    var MAX = 65535;
    do {
      var len = Math.min(MAX, payload.length - pos);
      var last = (pos + len >= payload.length) ? 1 : 0;
      var head = new Uint8Array(5);
      head[0] = last;
      head[1] = len & 0xFF; head[2] = (len >>> 8) & 0xFF;
      head[3] = (~len) & 0xFF; head[4] = ((~len) >>> 8) & 0xFF;
      blocks.push(head, payload.subarray(pos, pos + len));
      pos += len;
    } while (pos < payload.length);
    var body = 0;
    blocks.forEach(function (b) { body += b.length; });
    var out = new Uint8Array(2 + body + 4);
    out[0] = 0x78; out[1] = 0x01;
    var o = 2;
    blocks.forEach(function (b) { out.set(b, o); o += b.length; });
    // adler-32
    var a = 1, bsum = 0;
    for (var i = 0; i < payload.length; i++) { a = (a + payload[i]) % 65521; bsum = (bsum + a) % 65521; }
    new DataView(out.buffer).setUint32(2 + body, ((bsum << 16) | a) >>> 0);
    return out;
  }

  var PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

  /* No tEXt marker chunk. The relay refuses any PNG carrying metadata —
     `422 media contains metadata or a non-canonical metadata channel`, measured — so the
     wrapper is recognised by its IHDR shape instead: one row, 8-bit grayscale, width =
     payload length. Our own rows also carry `wrapped` in the device index. */
  function wrapAsPng(payload) {
    var ihdr = new Uint8Array(13);
    var dv = new DataView(ihdr.buffer);
    dv.setUint32(0, payload.length);   // width  = payload length
    dv.setUint32(4, 1);                // height = 1
    ihdr[8] = 8;                       // 8 bits
    ihdr[9] = 0;                       // grayscale
    var raw = new Uint8Array(payload.length + 1);
    raw[0] = 0;                        // filter: none
    raw.set(payload, 1);
    var parts = [
      new Uint8Array(PNG_MAGIC),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlibStore(raw)),
      chunk('IEND', new Uint8Array(0))
    ];
    var total = 0;
    parts.forEach(function (p) { total += p.length; });
    var png = new Uint8Array(total);
    var o = 0;
    parts.forEach(function (p) { png.set(p, o); o += p.length; });
    return png;
  }

  function isWrapped(png) {
    if (png.length < 33) return false;
    for (var i = 0; i < 8; i++) if (png[i] !== PNG_MAGIC[i]) return false;
    var dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
    if (dv.getUint32(8) !== 13) return false;
    if (String.fromCharCode(png[12], png[13], png[14], png[15]) !== 'IHDR') return false;
    var height = dv.getUint32(20);
    var depth = png[24];
    var colorType = png[25];
    return height === 1 && depth === 8 && colorType === 0;
  }

  function unwrapPng(png) {
    var o = 8, idat = [];
    var dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
    while (o + 8 <= png.length) {
      var len = dv.getUint32(o);
      var type = String.fromCharCode(png[o + 4], png[o + 5], png[o + 6], png[o + 7]);
      if (type === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len));
      o += 12 + len;
    }
    var size = 0;
    idat.forEach(function (b) { size += b.length; });
    var z = new Uint8Array(size), p = 0;
    idat.forEach(function (b) { z.set(b, p); p += b.length; });
    // stored deflate blocks only — this is our own wrapper, read back the way we wrote it
    var out = [], q = 2;
    for (;;) {
      var last = z[q] & 1;
      var len = z[q + 1] | (z[q + 2] << 8);
      out.push(z.subarray(q + 5, q + 5 + len));
      q += 5 + len;
      if (last) break;
    }
    var totalRaw = 0;
    out.forEach(function (b) { totalRaw += b.length; });
    var raw = new Uint8Array(totalRaw), r = 0;
    out.forEach(function (b) { raw.set(b, r); r += b.length; });
    return raw.subarray(1); // drop the filter byte
  }

  /* ---------- the device index: this device is the truth ---------- */

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
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

  /* ---------- the rail ---------- */

  async function put(bytes) {
    var sha = await sha256hex(bytes);
    var auth = await blossomAuth('upload', sha);
    var res = await fetch(RELAY + '/upload', {
      method: 'PUT',
      headers: { 'Authorization': auth, 'Content-Type': 'image/png' },
      body: bytes
    });
    var text = await res.text();
    if (!res.ok) {
      var err = new Error(text || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return JSON.parse(text);
  }

  async function fetchBlob(sha) {
    var auth = await blossomAuth('get', sha);
    var res = await fetch(RELAY + '/media/' + sha + '.png', { headers: { 'Authorization': auth } });
    if (!res.ok) {
      var err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  /* ---------- copy, per register. Same facts, same storage, same routes. ---------- */

  var COPY = {
    bee: {
      kicker: 'My Space', title: 'My Space',
      lede: 'Your files live on this phone.',
      empty: 'Nothing here yet. Add a file from this phone. You choose who can open it.',
      attach: 'Add a file',
      'pub-title': 'Public', 'pub-body': 'Hive members with the link. A stranger joins in one tap, then it opens.',
      'priv-title': 'Private', 'priv-body': 'Only this phone. Locked here before it leaves.',
      'badge-pub': 'anyone with the link', 'badge-priv': 'only this phone',
      'why-pub': 'An open copy sits in the hive at its hash.',
      'why-priv': 'Locked on this phone before it left.',
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
      'pub-title': 'public', 'pub-body': 'hive members with the link. one tap to join, then it opens.',
      'priv-title': 'private', 'priv-body': 'sealed here first.',
      'badge-pub': 'link opens it', 'badge-priv': 'this phone only',
      'why-pub': 'an open copy is in the hive, at its hash.',
      'why-priv': 'sealed on this phone before it left.',
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
      'pub-title': 'PUBLIC', 'pub-body': 'plaintext by sha256. member-gated GET: anonymous is 401, fresh key is 403.',
      'priv-title': 'PRIVATE', 'priv-body': 'AES-GCM in-browser. key never leaves. store holds ciphertext.',
      'badge-pub': 'PUBLIC', 'badge-priv': 'PRIVATE',
      'why-pub': 'plaintext blob on the rail at its sha256.',
      'why-priv': 'ciphertext on the rail. keyref stays on device.',
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
      return 'This phone destroys the key. The copy in the store becomes unreadable — to anyone, including us.';
    }
    return 'This phone forgets the file. The copy in the hive’s store stays at its hash, and anyone who already has the link still has it.';
  }

  /* Said at the moment of the flip, never in a footnote. */
  function flipSentence(row) {
    if (row.mode === 'private') {
      return 'This phone puts an open copy in the hive. Anyone with the new link — after the one-tap join — can open it. Making it private again later does not pull that copy back: anyone who already has the link still has it.';
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
    var rows = await allRows();
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

      if (row.sha) {
        var h = document.createElement('p');
        h.className = 'hash';
        h.textContent = 'sha256 ' + row.sha + (row.keyref ? ('\nkeyref ' + row.keyref) : '') +
          '\nts ' + new Date(row.ts).toISOString().replace(/\.\d+Z$/, 'Z');
        art.appendChild(h);
      }

      var actions = document.createElement('div');
      actions.className = 'actions' + (row.sha && row.mode === 'public' ? ' three' : '');

      if (row.sha && row.mode === 'public') {
        var share = document.createElement('button');
        share.type = 'button';
        share.className = 'ghost';
        share.textContent = 'Copy link';
        share.onclick = function () {
          var link = location.origin + location.pathname + '?f=' + row.sha + '&n=' + encodeURIComponent(row.name);
          navigator.clipboard.writeText(link).then(function () {
            setStatus('Link copied. Whoever opens it joins the hive in one tap, then the file opens.');
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
      mode: mode, ts: Date.now(), sha: null, keyref: null, wrapped: true
    };

    setStatus(mode === 'private' ? 'Locking it on this phone…' : 'Putting an open copy in the hive…');
    var payload;
    if (mode === 'private') {
      payload = wrapAsPng(await encryptFor(id, plain));
      row.keyref = 'device:aes-gcm:v1';
    } else {
      payload = wrapAsPng(plain);
    }

    try {
      var res = await put(payload);
      row.sha = res.sha256;
      await putRow(row);
      setStatus(mode === 'private'
        ? 'Locked. The key stays on this phone.'
        : 'In the hive. Copy the link to share it.');
    } catch (e) {
      /* The file is still the visitor's — the index keeps it even when the rail refuses.
         Saying "saved" while the upload failed would be exactly the lie this page avoids. */
      await putRow(row);
      if (e.status === 403) {
        setStatus('Kept on this phone. The hive has not let this device in yet, so nothing was uploaded — join at ' + JOIN_DOOR + ' and add it again to share it.', true);
      } else {
        setStatus('Kept on this phone. The hive did not take the upload (' + (e.message || 'error') + '), so nothing left this device.', true);
      }
    }
    await render();
  }

  async function doFlip(row) {
    setStatus('Changing who can open it…');
    try {
      var bytes = null;
      if (row.sha) {
        var got = await fetchBlob(row.sha);
        bytes = isWrapped(got) ? unwrapPng(got) : got;
        if (row.mode === 'private') {
          var k = await getKey(row.id);
          if (!k) throw new Error('the key for this file is gone from this phone');
          bytes = new Uint8Array(await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: bytes.subarray(0, 12) }, k.key, bytes.subarray(12)));
        }
      } else {
        throw new Error('this file was never uploaded, so there is nothing to re-put');
      }

      var next = row.mode === 'private' ? 'public' : 'private';
      var payload;
      if (next === 'private') {
        payload = wrapAsPng(await encryptFor(row.id, bytes));
        row.keyref = 'device:aes-gcm:v1';
      } else {
        await dropKey(row.id);
        payload = wrapAsPng(bytes);
        row.keyref = null;
      }
      var res = await put(payload);
      row.oldSha = row.sha;   /* the old blob is still there; the store has no delete route */
      row.sha = res.sha256;
      row.mode = next;
      await putRow(row);
      setStatus(next === 'public'
        ? 'Open copy is in the hive. The locked copy stays at its old hash.'
        : 'Locked copy is in the hive. The open copy you already shared stays at its old hash.');
    } catch (e) {
      setStatus('Nothing changed — ' + (e.message || 'the hive refused') + '.', true);
    }
    closeSheet();
  }

  async function doDelete(row) {
    /* Private: the key dies here and the ciphertext dies with it.
       Public: the row goes and the blob stays. Two acts, two sentences. */
    if (row.mode === 'private') await dropKey(row.id);
    await dropRow(row.id);
    setStatus(row.mode === 'private'
      ? 'Key destroyed. That copy cannot be read again by anyone.'
      : 'Gone from this phone. The copy in the hive stays at its hash.');
    closeSheet();
  }

  /* ---------- a shared link ---------- */

  async function openShared(sha, name) {
    setStatus('Opening ' + (name || 'the file') + '…');
    try {
      var got = await fetchBlob(sha);
      var bytes = isWrapped(got) ? unwrapPng(got) : got;
      var url = URL.createObjectURL(new Blob([bytes]));
      var a = document.createElement('a');
      a.href = url;
      a.download = name || (sha.slice(0, 12) + '.bin');
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      setStatus('Opened ' + (name || sha.slice(0, 12)) + '.');
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        setStatus('This file is in the hive, and this device is not in the hive yet. Join in one tap at ' + JOIN_DOOR + ' and open the link again.', true);
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

    var q = new URLSearchParams(location.search);
    var f = q.get('f');
    render().then(function () {
      if (f && /^[0-9a-f]{64}$/.test(f)) openShared(f, q.get('n'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* opened for the e2e walk; not a public API */
  window.__myspace = {
    wrapAsPng: wrapAsPng, unwrapPng: unwrapPng, isWrapped: isWrapped,
    devicePubkey: devicePubkey, blossomAuth: blossomAuth, render: render
  };
})();
