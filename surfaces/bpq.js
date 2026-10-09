/* ────────────────────────────────────────────────────────────────────────────
   BPQ — post-quantum keys and sealed objects (window.BPQ).

   Spec of record: docs/specs/SPEC-BPQ-1.md. Every byte layout below is fixed by
   that file; change the spec first, then this file, then the Rust twin
   (crates/bsigner/src/bpq.rs), then the shared vectors.

   WHAT IT GIVES A PERSON
     · keys(masterPrk, context): PQ keys derived from the SAME 32-byte root the
       24-word bzDiD phrase already carries, so the phrase restores them too:
         ML-DSA-65 signing key ......... FIPS 204, every-day signatures
         X-Wing (ML-KEM-768 + X25519) .. draft-connolly-cfrg-xwing-kem, so others can
                                          seal things TO you
         vault key ...................... 256-bit symmetric, per persona
         SLH-DSA-SHAKE-256f succession .. FIPS 205, hash-only security; only its HASH is
                                          published now (pre-rotation), so a lattice
                                          break later still leaves you a key to rotate to
       and a self-certifying id `bzpq1…` = hash(signing key, succession commitment).
       No registry, no chain row, no server: the id proves itself.
     · rootVault(masterPrk): the "only me" vault key, the same vault label under
       the reserved context 'root' (never a persona: those start 'pq:'), so a
       file sealed for "only me" opens from the phrase alone, no soul name needed.
     · seal(bytes, {self, to, signer, meta}): one self-contained sealed object.
       Segments are AES-256-GCM under a fresh random file key; the file key is
       wrapped once per reader ("self" = a vault key, "x-wing" = a recipient's
       public key). An "only me" slot under rootVault opens with the phrase
       alone; an X-Wing slot opens with the phrase plus the persona's soul name.
     · open / opener: whole-object and per-segment decryption (seek and stream);
       who sealed it is itself sealed, so only readers can see it.
     · card / bind: a signed public key card, and a signed statement binding
       classical accounts (EVM, Vaulta, Ed25519, …) to the PQ id, made while the
       classical keys are still sound.

   STATED PLAINLY
     · Library: @noble/post-quantum 0.7.1 (self-audited at 0.6.1 per its README,
       not independently audited). Its ML-DSA-65 / ML-KEM-768 outputs agree byte
       for byte with RustCrypto ml-dsa 0.1.1 / ml-kem 0.3.2 on shared seeds; the
       vectors in surfaces/bpq-vectors.json are checked by both implementations in CI.
       The SLH-DSA succession key is derived here only: the Rust twin never derives
       it and no known-answer vectors cover it (SPEC-BPQ-1 §6).
     · Symmetric layer: WebCrypto AES-256-GCM. 256-bit keys are the PQ choice for
       symmetric ciphers; the only quantum speed-up known is Grover's square root.
     · Keys live in this page's memory while it is open. Uint8Arrays are zeroed by
       wipe(); JS strings cannot be scrubbed. This is browser custody, not hardware.
     · Revocation: a reader who once opened an object can keep what they read.
       Revoking means sealing a new object to a new set of readers.
   ──────────────────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';
  var L = root.BPQ_LIB;
  if (!L) { root.BPQ = null; return; }   // no library, no PQ — never pretend

  // FROZEN v1 BYTE CONSTANTS. KDF labels follow the bzDiD v1 family
  // (onboarding/bzdid-key.js keeps BDID-v1 spellings frozen; these are new,
  // additive labels and change no existing key). Changing a byte orphans keys.
  var LABEL = {
    DSA: 'BDID-v1/ml-dsa-65-record-key',
    KEM: 'BDID-v1/x-wing-kem-key',
    VAULT: 'BDID-v1/vault-key',
    SUCC: 'BDID-v1/slh-dsa-shake-256f-succession'
  };
  var DOM = {
    ID: 'bpq1/id', SUCC: 'bpq1/succession', CARD: 'bpq1/card', BIND: 'bpq1/bind', DETACHED: 'bpq1/detached',
    KC: 'bpq1/key-commit', SEAL: 'bpq1/seal', WRAP_SELF: 'bpq1/wrap/self', WRAP_XWING: 'bpq1/wrap/x-wing',
    NOSTR: 'bpq1/nostr-event'
  };
  var MAGIC = [0x89, 0x42, 0x50, 0x51, 0x31, 0x0d, 0x0a, 0x1a];   // "\x89BPQ1\r\n\x1a"
  var ID_HRP = 'bzpq';
  var SEG_DEFAULT = 65536, SEG_MIN = 1024, SEG_MAX = 16777216;
  var FLAG_MORE = 0, FLAG_FINAL = 1, FLAG_META = 2, FLAG_SEAL = 3;
  var ROSETTA = 'bpq1 sealed object: CORE json, KEYS json (file key wrapped per reader: self = AES-256-GCM under HKDF-SHA256(vault key), x-wing = ML-KEM-768+X25519), META, BODY = AES-256-GCM segments (nonce = u32 flag || u64 index, AAD = SHA3-256(CORE)), SEAL = ML-DSA-65 record, itself AES-256-GCM under the file key. Spec: SPEC-BPQ-1.';

  var te = new TextEncoder(), td = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });   // keep a BOM, so JSON.parse refuses it as serde_json does
  var utf8 = function (s) { return te.encode(s); };
  var H = function (b) { return L.sha3_256(b); };

  // A signed timestamp has the shape YYYY-MM-DDTHH:MM:SS[.f]Z and nothing
  // else (the shape only: field ranges are not checked). The signed bytes are
  // "id NL at NL lines", so an `at` carrying a newline could move a claim line
  // out of `claims` and keep the signature valid.
  var AT_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,9})?Z$/;
  // A claim kind: lowercase, no '=' and no newline, so "kind=value" splits one way.
  var KIND_RE = /^[a-z0-9][a-z0-9._-]{0,31}$/;
  function isAt(at) { return typeof at === 'string' && AT_RE.test(at); }

  function BpqError(msg, code) { var e = new Error(msg); e.name = 'BpqError'; e.code = code; return e; }

  function concat() {
    var n = 0, i, o = 0;
    for (i = 0; i < arguments.length; i++) n += arguments[i].length;
    var out = new Uint8Array(n);
    for (i = 0; i < arguments.length; i++) { out.set(arguments[i], o); o += arguments[i].length; }
    return out;
  }
  function u32(n) { return Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255); }
  function readU32(b, o) {
    if (o + 4 > b.length) throw BpqError('truncated object', 'truncated');
    return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
  }
  function nonce(flag, index) {
    var n = new Uint8Array(12), hi = Math.floor(index / 4294967296), lo = index >>> 0;
    n.set(u32(flag), 0); n.set(u32(hi), 4); n.set(u32(lo), 8);
    return n;
  }
  function b64u(b) {
    var s = '', i;
    for (i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(s) {
    if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s)) throw BpqError('bad base64url field', 'b64u');
    var t = s.replace(/-/g, '+').replace(/_/g, '/'), pad = (4 - (t.length % 4)) % 4;
    var bin = atob(t + '===='.slice(0, pad)), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function eq(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var d = 0;
    for (var i = 0; i < a.length; i++) d |= a[i] ^ b[i];
    return d === 0;
  }
  function bytes(x, name, len) {
    if (!(x instanceof Uint8Array)) throw BpqError(name + ' must be a Uint8Array', 'type');
    if (len != null && x.length !== len) throw BpqError(name + ' must be ' + len + ' bytes, got ' + x.length, 'length');
    return x;
  }

  // ── symmetric layer (WebCrypto) ──────────────────────────────────────────
  var subtle = root.crypto && root.crypto.subtle;
  function aesKey(raw) {
    if (!subtle) throw BpqError('WebCrypto AES-GCM is unavailable in this context', 'no_webcrypto');
    return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async function gcmSeal(key, iv, plain, aad) {
    return new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: aad, tagLength: 128 }, key, plain));
  }
  async function gcmOpen(key, iv, sealed, aad) {
    try {
      return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: iv, additionalData: aad, tagLength: 128 }, key, sealed));
    } catch (e) { return null; }
  }
  function hkdf(ikm, salt, info) { return L.hkdfExpand(L.sha256, L.hkdfExtract(L.sha256, ikm, salt), utf8(info), 32); }

  // ── keys ─────────────────────────────────────────────────────────────────
  function expandLabel(masterPrk, label, context, len) {
    return L.hkdfExpand(L.sha256, masterPrk, concat(utf8(label), utf8(context)), len);
  }
  // The phrase-only vault key (SPEC-BPQ-1 §2, founder ruling 2026-10-04): the
  // frozen vault label under the reserved context 'root'. Persona contexts
  // always start 'pq:', so 'root' never equals one. Returns only the 32 bytes;
  // the caller zeroes them.
  var ROOT_CONTEXT = 'root';
  function rootVault(masterPrk) {
    return expandLabel(bytes(masterPrk, 'masterPrk', 32), LABEL.VAULT, ROOT_CONTEXT, 32);
  }
  function successionCommit(slhPk) { return H(concat(utf8(DOM.SUCC), slhPk)); }
  function idFrom(dsaPk, succCommit) {
    var d = H(concat(utf8(DOM.ID), bytes(dsaPk, 'ML-DSA-65 public key', 1952), bytes(succCommit, 'succession commitment', 32)));
    return L.bech32m.encode(ID_HRP, L.bech32m.toWords(d), 120);
  }
  function words(id) {
    var wl = root.BIP39_WORDLIST;
    if (!wl || wl.length !== 2048) return null;
    var h = H(concat(utf8('bpq1/words'), utf8(id))), acc = 0n, out = [], i;
    for (i = 0; i < 9; i++) acc = (acc << 8n) | BigInt(h[i]);
    acc >>= 6n;
    for (i = 5; i >= 0; i--) { out[i] = wl[Number(acc & 0x7ffn)]; acc >>= 11n; }
    return out.join(' ');
  }

  // The context rule of crates/bpq-core (SPEC-BTUNGSTEN-PQ-1 PQ03): 1 to 64
  // printable ASCII characters, so Rust and the browser refuse the same contexts.
  function checkContext(context) {
    if (typeof context !== 'string' || !context) throw BpqError('context must be a non-empty string', 'context_empty');
    if (!/^[\x20-\x7e]{1,64}$/.test(context)) throw BpqError('context must be 1 to 64 printable ASCII characters', 'context_rule');
  }

  function keys(masterPrk, context) {
    bytes(masterPrk, 'masterPrk', 32);
    checkContext(context);
    // 'root' belongs to the phrase-only vault (rootVault) and never names a signing or X-Wing key
    if (context === ROOT_CONTEXT) throw BpqError('context "root" is reserved for the phrase-only vault (use rootVault)', 'context_reserved');
    var dsaSeed = expandLabel(masterPrk, LABEL.DSA, context, 32);
    var kemSeed = expandLabel(masterPrk, LABEL.KEM, context, 32);
    var vault = expandLabel(masterPrk, LABEL.VAULT, context, 32);
    var succSeed = expandLabel(masterPrk, LABEL.SUCC, context, 96);
    var dsa = L.ml_dsa65.keygen(dsaSeed);
    var kem = L.xwing.keygen(kemSeed);
    var slh = L.slh_dsa_shake_256f.keygen(succSeed);
    var commit = successionCommit(slh.publicKey);
    slh.secretKey.fill(0); succSeed.fill(0);   // the succession secret is re-derived from the phrase when needed, never kept
    var id = idFrom(dsa.publicKey, commit);
    var live = true;
    function alive() { if (!live) throw BpqError('keys were wiped', 'wiped'); }
    return {
      context: context,
      id: id,
      words: words(id),
      dsa: {
        alg: 'ml-dsa-65', publicKey: dsa.publicKey,
        sign: function (msg) { alive(); return L.ml_dsa65.sign(msg, dsa.secretKey); }
      },
      kem: {
        alg: 'x-wing', publicKey: kem.publicKey,
        decapsulate: function (ct) { alive(); return L.xwing.decapsulate(ct, kem.secretKey); }
      },
      vault: { alg: 'aes-256-gcm/hkdf-sha256', key: vault },
      succession: { alg: 'slh-dsa-shake-256f', commit: commit, publicKey: slh.publicKey },
      wipe: function () {
        if (!live) return;
        live = false;
        dsa.secretKey.fill(0); dsaSeed.fill(0); kem.secretKey.fill(0); kemSeed.fill(0); vault.fill(0);
      }
    };
  }

  // A rotation to the succession key reveals it and signs with it. Re-derives
  // the SLH-DSA secret from the root on demand; never stored.
  function successionKeys(masterPrk, context) {
    checkContext(context);
    if (context === ROOT_CONTEXT) throw BpqError('context "root" is reserved for the phrase-only vault (use rootVault)', 'context_reserved');
    var seed = expandLabel(bytes(masterPrk, 'masterPrk', 32), LABEL.SUCC, context, 96);
    var k = L.slh_dsa_shake_256f.keygen(seed);
    seed.fill(0);
    return {
      alg: 'slh-dsa-shake-256f', publicKey: k.publicKey, commit: successionCommit(k.publicKey),
      sign: function (msg) { return L.slh_dsa_shake_256f.sign(msg, k.secretKey); },
      wipe: function () { k.secretKey.fill(0); }
    };
  }

  // ── public card and classical binding ────────────────────────────────────
  function card(k) {
    var msg = concat(utf8(DOM.CARD), k.dsa.publicKey, k.kem.publicKey, k.succession.commit);
    return { bpq: 1, id: k.id, dsa: b64u(k.dsa.publicKey), kem: b64u(k.kem.publicKey), succ: b64u(k.succession.commit), sig: b64u(k.dsa.sign(msg)) };
  }
  // A card carries no `kind` (SPEC-BPQ-1 §3); bindings and detached signatures do.
  function verifyCard(c) {
    try {
      if (!c || c.bpq !== 1 || c.kind !== undefined) return false;
      var dsa = unb64u(c.dsa), kem = unb64u(c.kem), succ = unb64u(c.succ), sig = unb64u(c.sig);
      if (dsa.length !== 1952 || kem.length !== 1216 || succ.length !== 32) return false;
      if (idFrom(dsa, succ) !== c.id) return false;
      return L.ml_dsa65.verify(sig, concat(utf8(DOM.CARD), dsa, kem, succ), dsa);
    } catch (e) { return false; }
  }
  // claims: a flat map of account kind -> account string, e.g.
  // { evm: '0x…', vaulta: 'name.b', ed25519: '<hex>' }. Signed over a stable
  // line form so any implementation can rebuild the exact bytes.
  function claimLines(claims) {
    var proto = claims && typeof claims === 'object' ? Object.getPrototypeOf(claims) : undefined;
    if (proto !== Object.prototype && proto !== null) throw BpqError('claims must be a plain object', 'claims');
    var ks = Object.keys(claims).sort(), out = '';
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i], v = claims[k];
      if (!KIND_RE.test(k)) throw BpqError('claim kind "' + k + '" must be lowercase [a-z0-9._-]', 'claim_kind');
      if (typeof v !== 'string' || !v || /[\r\n]/.test(v)) throw BpqError('claim "' + k + '" must be a one-line string', 'claim_value');
      out += k + '=' + v + '\n';
    }
    return out;
  }
  function bind(k, claims, at) {
    if (!isAt(at)) throw BpqError('at must have the shape YYYY-MM-DDTHH:MM:SS[.f]Z (UTC)', 'at');
    var lines = claimLines(claims);
    var msg = concat(utf8(DOM.BIND), H(utf8(k.id + '\n' + at + '\n' + lines)));
    return { bpq: 1, kind: 'binding', id: k.id, at: at, claims: claims, dsa: b64u(k.dsa.publicKey), succ: b64u(k.succession.commit), sig: b64u(k.dsa.sign(msg)) };
  }
  function verifyBind(b) {
    try {
      if (!b || b.bpq !== 1 || b.kind !== 'binding' || !isAt(b.at)) return false;
      var dsa = unb64u(b.dsa), succ = unb64u(b.succ);
      if (idFrom(dsa, succ) !== b.id) return false;
      var msg = concat(utf8(DOM.BIND), H(utf8(b.id + '\n' + b.at + '\n' + claimLines(b.claims))));
      return L.ml_dsa65.verify(unb64u(b.sig), msg, dsa);
    } catch (e) { return false; }
  }

  // ── detached file signatures: rulings, releases, archives ──────────────
  // Signed over the file's SHA3-256 and "id NL at NL size" (NL = newline),
  // never its name: files get renamed, their bytes do not.
  function detachedMsg(id, at, size, fileHash) {
    return concat(utf8(DOM.DETACHED), fileHash, H(utf8(id + '\n' + at + '\n' + size)));
  }
  function signFile(k, fileBytes, at) {
    bytes(fileBytes, 'file');
    if (!isAt(at)) throw BpqError('at must have the shape YYYY-MM-DDTHH:MM:SS[.f]Z (UTC)', 'at');
    var fh = H(fileBytes);
    return { bpq: 1, kind: 'detached', id: k.id, at: at, file: { size: fileBytes.length, sha3: b64u(fh) },
      dsa: b64u(k.dsa.publicKey), succ: b64u(k.succession.commit), sig: b64u(k.dsa.sign(detachedMsg(k.id, at, fileBytes.length, fh))) };
  }
  // {ok, id, why}: ok only when the signature, the id and the file all match
  function verifyFile(d, fileBytes) {
    try {
      if (!d || d.kind !== 'detached' || d.bpq !== 1) return { ok: false, why: 'not a bpq1 detached signature' };
      if (!isAt(d.at)) return { ok: false, why: 'at does not have the shape YYYY-MM-DDTHH:MM:SS[.f]Z' };
      if (!d.file || !Number.isSafeInteger(d.file.size) || d.file.size < 0) return { ok: false, why: 'file.size is not a whole byte count' };
      var dsa = unb64u(d.dsa), succ = unb64u(d.succ);
      if (idFrom(dsa, succ) !== d.id) return { ok: false, why: 'the id does not match the key' };
      var fh = H(bytes(fileBytes, 'file'));
      if (fileBytes.length !== d.file.size || !eq(fh, unb64u(d.file.sha3))) return { ok: false, id: d.id, why: 'this is not the file that was signed' };
      var ok = L.ml_dsa65.verify(unb64u(d.sig), detachedMsg(d.id, d.at, d.file.size, fh), dsa);
      return ok ? { ok: true, id: d.id, at: d.at } : { ok: false, id: d.id, why: 'the signature does not verify' };
    } catch (e) { return { ok: false, why: e.message }; }
  }
  // {ok, id, at}: the signature is authentic over the file hash and size it names.
  // It says nothing about whether a file you hold is that file; verifyFile does.
  function verifyDetachedClaim(d) {
    try {
      if (!d || d.kind !== 'detached' || d.bpq !== 1) return { ok: false, why: 'not a bpq1 detached signature' };
      if (!isAt(d.at)) return { ok: false, why: 'at does not have the shape YYYY-MM-DDTHH:MM:SS[.f]Z' };
      if (!d.file || !Number.isSafeInteger(d.file.size) || d.file.size < 0) return { ok: false, why: 'file.size is not a whole byte count' };
      var dsa = unb64u(d.dsa), succ = unb64u(d.succ), fh = unb64u(d.file.sha3);
      if (fh.length !== 32) return { ok: false, why: 'file.sha3 is not 32 bytes' };
      if (idFrom(dsa, succ) !== d.id) return { ok: false, why: 'the id does not match the key' };
      var ok = L.ml_dsa65.verify(unb64u(d.sig), detachedMsg(d.id, d.at, d.file.size, fh), dsa);
      return ok ? { ok: true, id: d.id, at: d.at } : { ok: false, id: d.id, why: 'the signature does not verify' };
    } catch (e) { return { ok: false, why: e.message }; }
  }

  // ── Nostr event attestations (SPEC-BPQ-1 §5b) ─────────────────────────────
  // Buzz and every Nostr relay check an event's secp256k1 Schnorr signature,
  // which a quantum adversary forges. This statement lets the author's bzpq1
  // key vouch for one event id beside it: ML-DSA-65 over "bpq1/nostr-event"
  // then the 32 id bytes. The id hashes the author's Nostr key, time, kind,
  // tags and content (NIP-01), so the statement names all of them.
  var EVENT_RE = /^[0-9a-f]{64}$/;
  function nostrMsg(eventHex) {
    var ev = new Uint8Array(32);
    for (var i = 0; i < 32; i++) ev[i] = parseInt(eventHex.slice(2 * i, 2 * i + 2), 16);
    return concat(utf8(DOM.NOSTR), ev);
  }
  function attestNostr(k, eventHex) {
    if (typeof eventHex !== 'string' || !EVENT_RE.test(eventHex)) throw BpqError('a Nostr event id is 64 lowercase hex characters', 'event');
    return { bpq: 1, kind: 'nostr-event', id: k.id, event: eventHex, dsa: b64u(k.dsa.publicKey), succ: b64u(k.succession.commit), sig: b64u(k.dsa.sign(nostrMsg(eventHex))) };
  }
  // {ok, id, event}: ok only when the id matches the key and the signature
  // holds over that event id
  function verifyNostr(a) {
    try {
      if (!a || a.bpq !== 1 || a.kind !== 'nostr-event') return { ok: false, why: 'not a bpq1 Nostr event attestation' };
      if (typeof a.event !== 'string' || !EVENT_RE.test(a.event)) return { ok: false, why: 'event is not 64 lowercase hex characters' };
      var dsa = unb64u(a.dsa), succ = unb64u(a.succ);
      if (dsa.length !== 1952 || succ.length !== 32 || idFrom(dsa, succ) !== a.id) return { ok: false, why: 'the id does not match the key' };
      var ok = L.ml_dsa65.verify(unb64u(a.sig), nostrMsg(a.event), dsa);
      return ok ? { ok: true, id: a.id, event: a.event } : { ok: false, id: a.id, why: 'the signature does not verify' };
    } catch (e) { return { ok: false, why: e.message }; }
  }

  // ── sealed objects ───────────────────────────────────────────────────────
  // a vault key may be passed bare or inside a keys() result
  function vaultOf(x) { return x instanceof Uint8Array ? x : (x && x.vault ? x.vault.key : (x && x.key)); }
  function segCount(len, seg) { return len === 0 ? 1 : Math.ceil(len / seg); }

  async function wrapFor(fileKey, kw, aadCore) {
    var k = await aesKey(kw);
    kw.fill(0);
    return gcmSeal(k, new Uint8Array(12), fileKey, aadCore);
  }

  async function seal(plain, opts) {
    bytes(plain, 'plaintext');
    opts = opts || {};
    var seg = opts.seg == null ? SEG_DEFAULT : opts.seg;
    if (!Number.isInteger(seg) || seg < SEG_MIN || seg > SEG_MAX) throw BpqError('seg must be an integer in [' + SEG_MIN + ', ' + SEG_MAX + ']', 'seg');
    var to = opts.to || [];
    if (!opts.self && !to.length) throw BpqError('a sealed object needs at least one reader (self or to)', 'no_reader');
    var fileKey = L.randomBytes(32), oid = L.randomBytes(16);
    var core = {
      bpq: 1, aead: 'aes-256-gcm', seg: seg, len: plain.length, oid: b64u(oid),
      kc: b64u(H(concat(utf8(DOM.KC), oid, fileKey))), rosetta: ROSETTA
    };
    var coreB = utf8(JSON.stringify(core)), aad = H(coreB);
    var slots = [], i;
    if (opts.self) {
      var vk = bytes(vaultOf(opts.self), 'vault key', 32);
      slots.push({ to: 'self', w: b64u(await wrapFor(fileKey, hkdf(vk, oid, DOM.WRAP_SELF), aad)) });
    }
    for (i = 0; i < to.length; i++) {
      var pk = bytes(to[i], 'recipient X-Wing public key', 1216);
      var enc = L.xwing.encapsulate(pk);
      var ss = enc.sharedSecret || enc.sharedKey;
      slots.push({ to: 'x-wing', ct: b64u(enc.cipherText), w: b64u(await wrapFor(fileKey, hkdf(ss, oid, DOM.WRAP_XWING), aad)) });
      ss.fill(0);
    }
    var keysB = utf8(JSON.stringify(slots));
    var fk = await aesKey(fileKey);
    var metaB = new Uint8Array(0);
    if (opts.meta) metaB = await gcmSeal(fk, nonce(FLAG_META, 0), utf8(JSON.stringify(opts.meta)), aad);
    var n = segCount(plain.length, seg), parts = new Array(n);
    for (i = 0; i < n; i++) {
      parts[i] = await gcmSeal(fk, nonce(i === n - 1 ? FLAG_FINAL : FLAG_MORE, i), plain.subarray(i * seg, Math.min(plain.length, (i + 1) * seg)), aad);
    }
    fileKey.fill(0);
    var body = concat.apply(null, parts);
    var sealB = new Uint8Array(0);
    if (opts.signer) {
      // The record naming the sealer is encrypted under the file key: only
      // readers learn who sealed it. A public head never links a person to a
      // stored object (RULINGS-2026-09-16 §27).
      var s = opts.signer, msg = concat(utf8(DOM.SEAL), aad, H(keysB), H(metaB), H(body));
      var rec = { alg: 'ml-dsa-65', pk: b64u(s.dsa.publicKey), sig: b64u(s.dsa.sign(msg)) };
      if (s.id && s.succession) { rec.id = s.id; rec.succ = b64u(s.succession.commit); }
      sealB = await gcmSeal(fk, nonce(FLAG_SEAL, 0), utf8(JSON.stringify(rec)), aad);
    }
    return concat(Uint8Array.from(MAGIC), u32(coreB.length), coreB, u32(keysB.length), keysB, u32(metaB.length), metaB, body, u32(sealB.length), sealB);
  }

  // JSON.parse reads 65536.0 or 6.5536e4 as 65536; the Rust twin refuses them.
  // Every CORE number is a whole count, so CORE's number tokens must be plain
  // digits: no sign, fraction or exponent. Scans the text outside strings.
  function plainIntegers(text) {
    var inStr = false, esc = false, prevDigit = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (inStr) {
        if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) inStr = false;
        continue;
      }
      if (c === 34) inStr = true;
      else if (c === 45 || c === 46 || c === 43) return false;      // - . +
      else if ((c === 101 || c === 69) && prevDigit) return false;   // e E after a digit
      prevDigit = c >= 48 && c <= 57;
    }
    return true;
  }

  // Parse the head. Accepts the whole object or just a prefix that covers the
  // head (for streaming: fetch the first few KiB, then ranges of the body).
  function inspect(obj) {
    bytes(obj, 'sealed object');
    for (var i = 0; i < 8; i++) if (obj[i] !== MAGIC[i]) throw BpqError('not a bpq1 sealed object', 'magic');
    var o = 8, c = readU32(obj, o); o += 4;
    if (o + c > obj.length) throw BpqError('truncated head', 'truncated');
    var coreB = obj.subarray(o, o + c); o += c;
    var k = readU32(obj, o); o += 4;
    if (o + k > obj.length) throw BpqError('truncated head', 'truncated');
    var keysB = obj.subarray(o, o + k); o += k;
    var m = readU32(obj, o); o += 4;
    if (o + m > obj.length) throw BpqError('truncated head', 'truncated');
    var metaB = obj.subarray(o, o + m); o += m;
    var core, slots, coreText;
    try { coreText = td.decode(coreB); core = JSON.parse(coreText); slots = JSON.parse(td.decode(keysB)); }
    catch (e) { throw BpqError('head is not valid JSON', 'head_json'); }
    if (!core || typeof core !== 'object' || Array.isArray(core)) throw BpqError('CORE must be a JSON object', 'head_json');
    if (!plainIntegers(coreText)) throw BpqError('CORE numbers must be plain non-negative integers', 'number');
    if (core.bpq !== 1) throw BpqError('unsupported bpq version ' + core.bpq, 'version');
    if (core.aead !== 'aes-256-gcm') throw BpqError('unsupported aead ' + core.aead, 'aead');
    if (!Number.isSafeInteger(core.seg) || core.seg < SEG_MIN || core.seg > SEG_MAX) throw BpqError('bad seg', 'seg');
    if (!Number.isSafeInteger(core.len) || core.len < 0) throw BpqError('bad len', 'len');
    if (!Array.isArray(slots)) throw BpqError('KEYS must be an array', 'keys');
    for (var j = 0; j < slots.length; j++) {
      var st = slots[j] && typeof slots[j] === 'object' && !Array.isArray(slots[j]) ? slots[j].to : undefined;
      if (st !== 'self' && st !== 'x-wing') throw BpqError('unknown reader slot ' + JSON.stringify(st) + ' (slot ' + j + ')', 'slot');
    }
    var n = segCount(core.len, core.seg), bodyLen = core.len + 16 * n;
    if (!Number.isSafeInteger(bodyLen)) throw BpqError('len + 16 per segment is past 2^53', 'len');
    return {
      core: core, slots: slots, coreBytes: coreB, keysBytes: keysB, metaBytes: metaB, aad: H(coreB),
      bodyOffset: o, bodyLength: bodyLen, segments: n, sealOffset: o + bodyLen,
      // byte range of segment i inside the object: [start, end)
      segmentRange: function (i) {
        var s = o + i * (core.seg + 16), plainLen = i === n - 1 ? core.len - i * core.seg : core.seg;
        return [s, s + plainLen + 16];
      }
    };
  }

  // Unwrap the file key with whatever the reader holds: { self: vaultKey | keys,
  // kem: keys.kem | keys }. Returns an opener for whole or per-segment reads.
  async function opener(obj, cred) {
    var h = inspect(obj), core = h.core, oid = unb64u(core.oid), kc = unb64u(core.kc), fileKey = null, i;
    cred = cred || {};
    var vault = cred.self ? vaultOf(cred.self) : null;
    var kem = cred.kem ? (cred.kem.decapsulate ? cred.kem : cred.kem.kem) : null;
    for (i = 0; i < h.slots.length && !fileKey; i++) {
      var s = h.slots[i], kw = null;
      if (s.to === 'self' && vault) kw = hkdf(bytes(vault, 'vault key', 32), oid, DOM.WRAP_SELF);
      else if (s.to === 'x-wing' && kem) {
        var ct = unb64u(s.ct);
        if (ct.length !== 1120) continue;
        var ss = kem.decapsulate(ct);
        kw = hkdf(ss, oid, DOM.WRAP_XWING); ss.fill(0);
      }
      if (!kw) continue;
      var got = await gcmOpen(await aesKey(kw), new Uint8Array(12), unb64u(s.w), h.aad);
      kw.fill(0);
      if (got && got.length === 32 && eq(H(concat(utf8(DOM.KC), oid, got)), kc)) fileKey = got;
    }
    if (!fileKey) throw BpqError('none of the keys you hold opens this object', 'no_key');
    var fk = await aesKey(fileKey);
    fileKey.fill(0);
    async function segment(i, sealedSeg) {
      if (!Number.isInteger(i) || i < 0 || i >= h.segments) throw BpqError('segment index out of range', 'range');
      var r = h.segmentRange(i);
      if (sealedSeg.length !== r[1] - r[0]) throw BpqError('segment ' + i + ' has the wrong length', 'seg_length');
      var p = await gcmOpen(fk, nonce(i === h.segments - 1 ? FLAG_FINAL : FLAG_MORE, i), sealedSeg, h.aad);
      if (!p) throw BpqError('segment ' + i + ' failed authentication', 'auth');
      return p;
    }
    return {
      head: h,
      meta: async function () {
        if (!h.metaBytes.length) return null;
        var p = await gcmOpen(fk, nonce(FLAG_META, 0), h.metaBytes, h.aad);
        if (!p) throw BpqError('meta failed authentication', 'auth');
        return JSON.parse(td.decode(p));
      },
      segment: segment,
      // who sealed it: decrypts the seal record and checks its ML-DSA-65
      // signature over the whole object. Needs the whole object. null = unsigned.
      sealedBy: async function (whole) {
        var x = sealInfo(whole, h);
        if (!x.sealB.length) return null;
        // The SEAL answers only who sealed the object; the bytes themselves are
        // authenticated segment by segment. Every SEAL that fails (altered
        // bytes, a malformed record, an unknown alg, an id without its
        // succession commitment, a signature or id that does not match) reads
        // as ok: false with id: null, never ok: true, and never fails the open.
        // The Rust twin (bpq.rs seal_record) draws the same line.
        var no = function (why) { return { ok: false, id: null, idOk: null, why: why }; };
        var p = await gcmOpen(fk, nonce(FLAG_SEAL, 0), x.sealB, h.aad);
        if (!p) return no('seal failed authentication');
        var rec;
        try { rec = JSON.parse(td.decode(p)); } catch (e) { return no('seal is not JSON'); }
        if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return no('seal record is not an object');
        if (rec.alg !== 'ml-dsa-65') return no('unsupported seal ' + rec.alg);
        var hasId = rec.id !== undefined && rec.id !== null;
        if (hasId && typeof rec.id !== 'string') return no('seal id is not a string');
        var pk, sig, succ;
        try { pk = unb64u(rec.pk); sig = unb64u(rec.sig); if (hasId) succ = unb64u(rec.succ); }
        catch (e) { return no('seal record has a missing or malformed field'); }
        var idOk = hasId ? pk.length === 1952 && succ.length === 32 && idFrom(pk, succ) === rec.id : null;
        var body = whole.subarray(h.bodyOffset, h.sealOffset);
        var msg = concat(utf8(DOM.SEAL), h.aad, H(h.keysBytes), H(h.metaBytes), H(body));
        var ok = pk.length === 1952 && L.ml_dsa65.verify(sig, msg, pk) && idOk !== false;
        // an id is reported only when ok: a page or CLI never shows a
        // claimed sealer that did not verify
        return { ok: ok, id: ok && hasId ? rec.id : null, idOk: idOk, publicKey: pk };
      },
      // plaintext bytes [start, end) — fetchRange(a, b) must return object bytes [a, b)
      read: async function (start, end, fetchRange) {
        start = Math.max(0, start); end = Math.min(core.len, end);
        if (end <= start) return new Uint8Array(0);
        var first = Math.floor(start / core.seg), last = Math.floor((end - 1) / core.seg), out = [];
        for (var j = first; j <= last; j++) {
          var r = h.segmentRange(j), p = await segment(j, await fetchRange(r[0], r[1]));
          var a = j === first ? start - j * core.seg : 0, b = j === last ? end - j * core.seg : p.length;
          out.push(p.subarray(a, b));
        }
        return concat.apply(null, out);
      }
    };
  }

  function sealInfo(obj, h) {
    h = h || inspect(obj);
    var end = h.sealOffset;
    var s = readU32(obj, end);
    if (end + 4 + s !== obj.length) throw BpqError('object length does not match its head', 'length');
    return { h: h, sealB: obj.subarray(end + 4, end + 4 + s) };
  }

  async function open(obj, cred) {
    var x = sealInfo(obj), op = await opener(obj, cred), h = x.h, parts = [];
    for (var i = 0; i < h.segments; i++) {
      var r = h.segmentRange(i);
      parts.push(await op.segment(i, obj.subarray(r[0], r[1])));
    }
    return { bytes: concat.apply(null, parts), meta: await op.meta(), sealedBy: await op.sealedBy(obj) };
  }

  // short public fingerprint for display: first 8 bytes of SHA3-256, hex
  function fingerprint(pub) {
    var h = H(bytes(pub, 'public key')), s = '';
    for (var i = 0; i < 8; i++) s += (h[i] < 16 ? '0' : '') + h[i].toString(16);
    return s;
  }

  function isSealed(obj) {
    if (!(obj instanceof Uint8Array) || obj.length < 8) return false;
    for (var i = 0; i < 8; i++) if (obj[i] !== MAGIC[i]) return false;
    return true;
  }

  root.BPQ = Object.freeze({
    version: 1,
    spec: 'docs/specs/SPEC-BPQ-1.md',
    algorithms: Object.freeze({ sign: 'ml-dsa-65', kem: 'x-wing', aead: 'aes-256-gcm', kdf: 'hkdf-sha256', hash: 'sha3-256', succession: 'slh-dsa-shake-256f' }),
    library: L.versions,
    keys: keys,
    rootVault: rootVault,
    successionKeys: successionKeys,
    idFrom: idFrom,
    card: card, verifyCard: verifyCard,
    bind: bind, verifyBind: verifyBind,
    signFile: signFile, verifyFile: verifyFile, verifyDetachedClaim: verifyDetachedClaim,
    attestNostr: attestNostr, verifyNostr: verifyNostr,
    seal: seal, open: open, opener: opener, inspect: inspect, isSealed: isSealed,
    fingerprint: fingerprint, b64u: b64u, unb64u: unb64u
  });
})(typeof window !== 'undefined' ? window : globalThis);
