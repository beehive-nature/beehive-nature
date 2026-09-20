/* myspace-adapter-blossom.js — the hive's Blossom blob store as an adapter on
   SPEC-ADAPTER-CONTRACT-1, browser carrier (§2), behind one dedicated worker.

   Slice 02, first adapter. Nothing here is new behaviour: `put`, `fetchBlob`,
   `blossomAuth`, `joinHive` and the PNG wrapper all ran inside `myspace.js` at
   slice 01 and were measured against the live relay on 2026-09-20
   (WORK_LOGS/2026-09-20_BOPUS5_MYSPACE01_STEP0_BLOSSOM.md). They are MOVED, not
   rewritten — the boundary is the change.

   WHY THIS FILE EXISTS AS A SEPARATE PROCESS (§1): the page must be able to hold
   a file when this rail is dead. A fault here is one terminated worker; the
   private path never touched this file in the first place.

   THE KEY NEVER CROSSES (§4). This rail authenticates EVERY request, so the
   naive move — hand the adapter the device key — is the one move the contract
   forbids. Instead every method is two halves in the order §6 fixes:

       begin*  → the adapter builds the unsigned request and returns a DIGEST
       (shell) → the device key signs that digest, in the page, never here
       submit* → the adapter assembles the signed request and speaks to the rail

   So the adapter knows the rail and holds no key; the shell holds the key and
   knows no rail. `intent_id` is the idempotency key: a failed submit KEEPS its
   intent so the shell can resubmit the identical bytes with the identical
   signature (§6), and the adapter itself never retries.

   METHOD NAMES ARE `x.`-PREFIXED ON PURPOSE. Contract v1 §3.2/§3.3 carries no
   method that moves bytes — `buildPublish` takes a `payload_hash` and there is
   no read-bytes method at all. That hole is named and routed to the wallet lane,
   which owns the contract text; this seat does not edit the spec. Until it is
   ruled, these methods declare themselves extensions in their own names rather
   than squatting on contract vocabulary. */

var RELAY = 'https://skaists.buzz';
var RELAY_HOST = 'skaists.buzz';
var RAIL = 'blossom';

/* `scheme` is the short address prefix a row stores next to the address — the
   same shape `crates/atmirror/src/rail.rs` gives Arweave ("ar") and Autonomi
   ("ant"). `Rail` is a closed enum by §7 and that section names no members, so
   nothing here can cite a ruled roster: `blossom` is this adapter's declared
   value and the shell's accepted list is repo-side code, not a caller string. */
var SCHEME = 'blossom';

var E = {
  RAIL_UNREACHABLE: -32001,
  BAD_PARAMS: -32007,
  METHOD_ABSENT: -32008,
  MEMBERSHIP_REQUIRED: -32020,
  UNKNOWN_INTENT: -32021,
  RAIL_REFUSED: -32022,
  NOT_PERMITTED: -32023
};

/* An error carries an estate CODE and a message, and nothing else structured:
   the seam propagates exactly those two, so a `data` bag would be a field no
   caller can read. §6 — an adapter must not return a plain-language error
   string in place of a code. */
function fail(code, message) {
  var e = new Error(message);
  e.code = code;
  return e;
}

/* ---------- small helpers (moved verbatim from myspace.js) ---------- */

function hex(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

async function sha256hex(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

function b64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ---------- the PNG wrapper ----------
   The store decodes what it is given and refuses anything that is not an image
   (`unsupported file type` on a .txt, `422 invalid image data` on junk), so
   bytes that are not already an accepted image travel inside a valid 8-bit
   grayscale PNG: one row, width = payload length, one filter byte. Measured
   byte-exact through the live store. This is rail knowledge and it belongs on
   this side of the boundary: the shell hands over bytes and gets the same bytes
   back, and never learns that a PNG was involved. */

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
   `422 media contains metadata or a non-canonical metadata channel`, measured —
   so the wrapper is recognised by its IHDR shape instead: one row, 8-bit
   grayscale, width = payload length. */
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

/* ---------- unsigned request building ----------
   The digest is a nostr event id: sha256 over the canonical serialization. The
   shell signs those 32 bytes and hands back only a signature. */

async function eventDigest(ev) {
  var serial = JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]);
  return sha256hex(new TextEncoder().encode(serial));
}

/* Blossom kind:24242 (BUD-11), the shape the relay actually verifies — read from
   the client that already works against it (crates/buzz-cli/src/client.rs
   sign_blossom_upload / sign_blossom_get) and checked against the verifier in
   crates/buzz-media/src/auth.rs. */
async function buildBlossomEvent(verb, pubkey, sha) {
  var now = Math.floor(Date.now() / 1000);
  var tags = [['t', verb], ['expiration', String(now + 600)], ['server', RELAY_HOST]];
  if (verb === 'upload') tags.splice(1, 0, ['x', sha]);
  var ev = {
    pubkey: pubkey,
    created_at: now,
    kind: 24242,
    tags: tags,
    content: verb === 'upload' ? 'Upload file' : 'Get media'
  };
  ev.id = await eventDigest(ev);
  return ev;
}

/* NIP-98 (kind 27235) over the CANONICAL origin. Transport here IS that origin,
   so the `u` tag and the URL are the same string; a page served against an alias
   host would have to read NIP-11 /info for `push.origin` and sign THAT. This
   adapter does not pretend to handle that case. */
async function buildClaimEvent(pubkey, url, body) {
  var ev = {
    pubkey: pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 27235,
    tags: [
      ['u', url],
      ['method', 'POST'],
      ['payload', await sha256hex(new TextEncoder().encode(body))],
      ['nonce', crypto.randomUUID()]
    ],
    content: ''
  };
  ev.id = await eventDigest(ev);
  return ev;
}

/* ---------- intents ----------
   An intent is an unsigned request waiting for its signature. It is dropped when
   its submit SUCCEEDS; a failed submit keeps it, because §6's retry resubmits the
   identical bytes under the identical idempotency key and the shell — not this
   adapter — decides whether to. The sweep below only discards intents older than
   any signature could still be valid for; it is housekeeping, not a retry policy. */

var INTENTS = new Map();
var INTENT_TTL_MS = 15 * 60 * 1000;

function sweepIntents() {
  var cut = Date.now() - INTENT_TTL_MS;
  INTENTS.forEach(function (v, k) { if (v.born < cut) INTENTS.delete(k); });
}

function newIntent(rec) {
  sweepIntents();
  var id = RAIL + ':' + Date.now().toString(36) + ':' + crypto.randomUUID().slice(0, 8);
  rec.born = Date.now();
  INTENTS.set(id, rec);
  return id;
}

function takeIntent(id, verb) {
  var rec = id && INTENTS.get(id);
  if (!rec || rec.verb !== verb) throw fail(E.UNKNOWN_INTENT, 'no open ' + verb + ' intent by that id');
  return rec;
}

function requirePubkey(p) {
  if (!p || !/^[0-9a-f]{64}$/.test(p.pubkey || '')) throw fail(E.BAD_PARAMS, 'needs {pubkey} as 64 hex');
  return p.pubkey;
}

function requireSig(p) {
  if (!p || !/^[0-9a-f]{128}$/.test(p.sig || '')) throw fail(E.BAD_PARAMS, 'needs {sig} as 128 hex');
  return p.sig;
}

function authHeader(ev, sig) {
  var signed = {
    pubkey: ev.pubkey, created_at: ev.created_at, kind: ev.kind,
    tags: ev.tags, content: ev.content, id: ev.id, sig: sig
  };
  return 'Nostr ' + b64url(JSON.stringify(signed));
}

/* ---------- the rail ---------- */

/* Both ends of this rail are member-gated and the two refusals are different
   facts: anonymous is 401, a key the hive does not know is 403. Only one of them
   has a door the visitor can walk through, so only one of them gets the code the
   shell answers with a join. */
function railError(res, text) {
  if (res.status === 403) return fail(E.MEMBERSHIP_REQUIRED, 'this key is not in the hive member list');
  if (res.status === 401) return fail(E.NOT_PERMITTED, 'the hive did not accept this request');
  return fail(E.RAIL_REFUSED, text || ('HTTP ' + res.status));
}

var METHODS = {
  describe: function () {
    return {
      rail: RAIL,
      adapter_version: '0.1.0',
      contract_version: '1',
      capabilities: ['x.beginPut', 'x.submitPut', 'x.beginGet', 'x.submitGet', 'x.beginJoin', 'x.submitJoin'],
      networks: [RELAY_HOST],
      units: []
    };
  },

  'x.beginPut': async function (p) {
    var pubkey = requirePubkey(p);
    if (!(p.bytes instanceof Uint8Array) || !p.bytes.length) throw fail(E.BAD_PARAMS, 'needs {bytes} as a non-empty Uint8Array');
    var wire = wrapAsPng(p.bytes);
    var sha = await sha256hex(wire);
    var ev = await buildBlossomEvent('upload', pubkey, sha);
    return { intent_id: newIntent({ verb: 'put', ev: ev, wire: wire, sha: sha, size: p.bytes.length }), digest: ev.id };
  },

  'x.submitPut': async function (p) {
    var rec = takeIntent(p && p.intent_id, 'put');
    var sig = requireSig(p);
    /* `x-sha-256` is not optional: without it the relay answers
       `401 authentication failed` whatever key signs. Measured. */
    var res = await fetch(RELAY + '/upload', {
      method: 'PUT',
      headers: {
        'Authorization': authHeader(rec.ev, sig),
        'Content-Type': 'image/png',
        'x-sha-256': rec.sha
      },
      body: rec.wire
    });
    var text = await res.text();
    if (!res.ok) throw railError(res, text);
    var out = JSON.parse(text);
    INTENTS.delete(p.intent_id);
    return { scheme: SCHEME, address: out.sha256, size: rec.size };
  },

  'x.beginGet': async function (p) {
    var pubkey = requirePubkey(p);
    if (!p || !/^[0-9a-f]{64}$/.test(p.address || '')) throw fail(E.BAD_PARAMS, 'needs {address} as 64 hex');
    var ev = await buildBlossomEvent('get', pubkey, p.address);
    return { intent_id: newIntent({ verb: 'get', ev: ev, address: p.address }), digest: ev.id };
  },

  'x.submitGet': async function (p) {
    var rec = takeIntent(p && p.intent_id, 'get');
    var sig = requireSig(p);
    var res = await fetch(RELAY + '/media/' + rec.address + '.png', {
      headers: { 'Authorization': authHeader(rec.ev, sig) }
    });
    if (!res.ok) throw railError(res, null);
    var got = new Uint8Array(await res.arrayBuffer());
    INTENTS.delete(p.intent_id);
    return { bytes: isWrapped(got) ? unwrapPng(got) : got };
  },

  /* Membership is a rail fact, so the door is this adapter's knowledge — but the
     claim is signed by the device key, so it is the same two halves as everything
     else. The shell decides WHETHER to walk through it; nothing here joins
     anybody to anything on its own. */
  'x.beginJoin': async function (p) {
    var pubkey = requirePubkey(p);
    var mat = await fetch(RELAY + '/join.json').then(function (r) { return r.ok ? r.json() : null; });
    var code = mat && typeof mat.invite_url === 'string'
      ? mat.invite_url.slice(mat.invite_url.indexOf('/invite/') + 8)
      : null;
    if (!code) throw fail(E.RAIL_UNREACHABLE, 'the hive publishes no invite right now');
    var url = RELAY + '/api/invites/claim';
    var body = JSON.stringify({ code: code, policy_receipt: null });
    var ev = await buildClaimEvent(pubkey, url, body);
    return { intent_id: newIntent({ verb: 'join', ev: ev, url: url, body: body }), digest: ev.id };
  },

  'x.submitJoin': async function (p) {
    var rec = takeIntent(p && p.intent_id, 'join');
    var sig = requireSig(p);
    /* The claim endpoint verifies a plain base64 NIP-98 event, not the base64url
       the Blossom route wants. Two encodings because two verifiers; measured
       against the live join bundle rather than guessed. */
    var signed = {
      pubkey: rec.ev.pubkey, created_at: rec.ev.created_at, kind: rec.ev.kind,
      tags: rec.ev.tags, content: rec.ev.content, id: rec.ev.id, sig: sig
    };
    var res = await fetch(rec.url, {
      method: 'POST',
      headers: { 'Authorization': 'Nostr ' + btoa(JSON.stringify(signed)), 'Content-Type': 'application/json' },
      body: rec.body
    });
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok) throw fail(E.RAIL_REFUSED, out.error || ('the hive refused the invite (HTTP ' + res.status + ')'));
    INTENTS.delete(p.intent_id);
    return { joined: true };
  }
};

self.onmessage = async function (ev) {
  var m = ev.data;
  if (!m || m.jsonrpc !== '2.0' || typeof m.id !== 'number') return;
  var fn = METHODS[m.method];
  if (!fn) {
    postMessage({ jsonrpc: '2.0', id: m.id, error: { code: E.METHOD_ABSENT, message: 'method not on this adapter: ' + m.method } });
    return;
  }
  try {
    postMessage({ jsonrpc: '2.0', id: m.id, result: await fn(m.params || {}) });
  } catch (e) {
    var unreachable = /Failed to fetch|NetworkError|abort/i.test((e && e.message) || '');
    postMessage({
      jsonrpc: '2.0', id: m.id,
      error: {
        code: (e && e.code) || (unreachable ? E.RAIL_UNREACHABLE : -32000),
        message: (e && e.message) || String(e)
      }
    });
  }
};
