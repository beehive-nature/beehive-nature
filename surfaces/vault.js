/* ────────────────────────────────────────────────────────────────────────────
   BNRVAULT — one keypass, every secret.

   Holds the two secret shapes a human actually ends up with:
     · BIP-39 seed phrases  (12 / 15 / 18 / 21 / 24 words, optional 25th-word passphrase)
     · Vaulta / EOSIO ACTIVE private keys (WIF 5K…, WIF-compressed L…/K…, PVT_K1_…)
   …encrypted under a keypass so none of them are ever handled raw again — and openable
   by SEVERAL credentials, one per device or password manager (see "slots" below).

   HONEST LIMITS — read these before trusting it with real value:
     · This is browser-resident hot storage, NOT a hardware wallet. A key that has
       ever been typed into a browser is a hot key. Treat this as a way to stop
       juggling plaintext, not as a substitute for a signing device.
     · The page is served from a public origin. Anyone who can change what that
       origin serves (repo compromise, a bad dependency, XSS) can serve JS that
       captures your keypass at unlock time. That is the real threat model here.
       Mitigations in place: zero third-party code on this page, no network calls
       from this file at all, and the whole thing works offline from file://.
     · JS strings cannot be reliably wiped from memory. Key material derived here
       lives in Uint8Arrays that ARE zeroed on lock; the secrets themselves are
       strings and are dropped, not scrubbed. Close the tab when you are done.

   Crypto, stated plainly (envelope format v2):
     Vault key    a random 256-bit VMK encrypts the payload; the VMK itself is
                  wrapped once per SLOT, so several credentials can each open the
                  same vault without any of them knowing the others
     Slots        "keypass" = PBKDF2-HMAC-SHA-256, 600 000 iterations, per-slot
                  16-byte salt (WebCrypto has no Argon2; 600k is the OWASP floor)
                  "passkey" = HKDF-SHA-256 over a WebAuthn PRF secret the page
                  supplies — this file never calls WebAuthn itself
     Cipher       AES-256-GCM throughout, fresh 12-byte random IV per write
     AAD          each wrap is bound to its own slot descriptor, so slot KDF
                  parameters cannot be downgraded or swapped between slots
     Envelope     JSON, versioned, safe to sync/back up anywhere — it is ciphertext.
                  v1 (single-keypass) vaults still open and migrate on first unlock.

   Dependencies: WebCrypto (crypto.subtle) and window.BIP39_WORDLIST. Nothing else.
   ──────────────────────────────────────────────────────────────────────────── */
window.BNRVAULT = (function () {
  'use strict';

  var MAGIC = 'BNRVAULT';
  var FORMAT = 2;
  var KDF_ITERS = 600000;
  var LS_KEY = 'bnr_vault';
  var VALID_WORD_COUNTS = [12, 15, 18, 21, 24];

  var subtle = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;
  function randomBytes(n) {
    var b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b;
  }

  /* ── bytes / text / base64 ─────────────────────────────────────────────── */
  var enc = new TextEncoder();
  var dec = new TextDecoder();

  function b64(bytes) {
    var s = '', i;
    for (i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toHex(bytes) {
    var s = '', i;
    for (i = 0; i < bytes.length; i++) s += (bytes[i] >> 4).toString(16) + (bytes[i] & 15).toString(16);
    return s;
  }
  function zero(u8) { if (u8 && u8.fill) u8.fill(0); }

  async function sha256(bytes) {
    return new Uint8Array(await subtle.digest('SHA-256', bytes));
  }
  async function sha256d(bytes) {
    return await sha256(await sha256(bytes));
  }

  /* ── base58 (Bitcoin alphabet) ─────────────────────────────────────────── */
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  var B58MAP = (function () {
    var m = {}, i;
    for (i = 0; i < B58.length; i++) m[B58.charAt(i)] = i;
    return m;
  })();

  function b58decode(str) {
    if (!str.length) throw new Error('empty');
    var bytes = [0], i, j, c, carry;
    for (i = 0; i < str.length; i++) {
      c = B58MAP[str.charAt(i)];
      if (c === undefined) throw new Error('illegal base58 character "' + str.charAt(i) + '"');
      carry = c;
      for (j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    for (i = 0; i < str.length && str.charAt(i) === '1'; i++) bytes.push(0);
    return new Uint8Array(bytes.reverse());
  }

  /* ── BIP-39 ────────────────────────────────────────────────────────────────
     Full checksum validation. This is the part that catches a mistyped word
     BEFORE it gets sealed into a vault you cannot later reconcile.            */
  function wordlist() {
    var wl = window.BIP39_WORDLIST;
    if (!wl || wl.length !== 2048) {
      throw new Error('BIP-39 wordlist missing — onboarding/vendor/bip39-wordlist.js did not load');
    }
    return wl;
  }

  function normalizePhrase(input) {
    // NFKD per BIP-39, lowercase, collapse all whitespace runs to single spaces.
    return String(input || '')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Returns {ok, words, count, entropyBits, entropyHex, error, badWords[]} */
  async function validateMnemonic(input) {
    var wl;
    try { wl = wordlist(); } catch (e) { return { ok: false, error: e.message }; }

    var phrase = normalizePhrase(input);
    if (!phrase) return { ok: false, error: 'nothing entered' };
    var words = phrase.split(' ');
    var count = words.length;

    if (VALID_WORD_COUNTS.indexOf(count) < 0) {
      return {
        ok: false, count: count,
        error: count + ' words — a BIP-39 phrase is 12, 15, 18, 21 or 24 words'
      };
    }

    // Unknown words, reported individually so the user can see which to fix.
    var bad = [], idx = [], i, at;
    for (i = 0; i < words.length; i++) {
      at = wl.indexOf(words[i]);
      if (at < 0) bad.push({ position: i + 1, word: words[i] });
      idx.push(at);
    }
    if (bad.length) {
      return {
        ok: false, count: count, badWords: bad,
        error: bad.length === 1
          ? 'word ' + bad[0].position + ' ("' + bad[0].word + '") is not in the BIP-39 wordlist'
          : bad.length + ' words are not in the BIP-39 wordlist (positions ' +
            bad.map(function (b) { return b.position; }).join(', ') + ')'
      };
    }

    // 11 bits per word => ENT + CS, where CS = ENT/32 and ENT = count*11 - CS.
    var totalBits = count * 11;
    var csBits = totalBits / 33;          // integer for every legal count
    var entBits = totalBits - csBits;
    var entBytes = entBits / 8;

    var bits = new Uint8Array(totalBits);
    for (i = 0; i < count; i++) {
      for (var b = 0; b < 11; b++) bits[i * 11 + b] = (idx[i] >> (10 - b)) & 1;
    }
    var entropy = new Uint8Array(entBytes);
    for (i = 0; i < entBits; i++) {
      if (bits[i]) entropy[i >> 3] |= 1 << (7 - (i & 7));
    }

    var h = await sha256(entropy);
    for (i = 0; i < csBits; i++) {
      var expect = (h[i >> 3] >> (7 - (i & 7))) & 1;
      if (bits[entBits + i] !== expect) {
        zero(entropy);
        return {
          ok: false, count: count,
          error: 'checksum failed — every word is valid BIP-39 but the phrase as a whole ' +
                 'is not. Usually a word in the wrong position, or one word wrong.'
        };
      }
    }

    var hex = toHex(entropy);
    zero(entropy);
    return { ok: true, words: words, count: count, entropyBits: entBits, entropyHex: hex };
  }

  /* BIP-39 seed (PBKDF2-HMAC-SHA512, 2048 iters, salt "mnemonic"+passphrase).
     Provided so a phrase can be checked against a wallet you already control;
     address derivation (BIP-32/44) is deliberately NOT implemented here. */
  async function mnemonicToSeed(mnemonic, passphrase) {
    var pw = enc.encode(normalizePhrase(mnemonic));
    var salt = enc.encode(('mnemonic' + (passphrase || '')).normalize('NFKD'));
    var k = await subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveBits']);
    var bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: 2048, hash: 'SHA-512' }, k, 512);
    return new Uint8Array(bits);
  }

  /* ── Vaulta / EOSIO ACTIVE private keys ──────────────────────────────────
     Accepts the three shapes that actually turn up in the wild:
       5K…  51 chars  legacy WIF, 0x80 + 32-byte secret
       L… K… 52 chars WIF with the 0x01 compressed flag
       PVT_K1_…       EOSIO "new format", base58(secret ‖ ripemd160-checksum)
     The first two are checksum-verified here. PVT_K1_ uses RIPEMD-160, which
     WebCrypto does not implement — it is shape-checked here and left for the
     page's signing bundle to verify authoritatively.                         */
  async function validateVaultaKey(input) {
    var s = String(input || '').trim();
    if (!s) return { ok: false, error: 'nothing entered' };

    if (/^PVT_K1_[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(s)) {
      return {
        ok: true, format: 'PVT_K1_', checksum: 'deferred',
        note: 'PVT_K1_ checksum is RIPEMD-160, which WebCrypto lacks — verified by the signer, not here'
      };
    }
    if (/^PVT_/.test(s)) {
      return { ok: false, error: 'only PVT_K1_ keys are supported (K1/secp256k1 — the curve Vaulta uses)' };
    }
    // Caught before the base58 test: an EOS-prefixed public key contains a capital
    // O, so it would otherwise fail as "not base58" and hide the real mistake.
    if (/^(EOS|PUB_K1_|PUB_R1_|PUB_WA_)/.test(s)) {
      return {
        ok: false,
        error: 'that is a PUBLIC key — it is safe to share and cannot sign. ' +
               'The vault needs the ACTIVE private key your wallet exported (5K… / L… / K… / PVT_K1_…).'
      };
    }
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) {
      return { ok: false, error: 'not base58 — check for O/0, I/l confusion, or a stray space' };
    }

    var raw;
    try { raw = b58decode(s); }
    catch (e) { return { ok: false, error: e.message }; }

    if (raw.length !== 37 && raw.length !== 38) {
      var hint = raw.length < 20
        ? 'That is far too short to be a private key — is it an account name?'
        : 'This is the length of a PUBLIC key, not an active private key.';
      return {
        ok: false,
        error: 'decoded to ' + raw.length + ' bytes — a WIF private key decodes to 37 or 38. ' + hint
      };
    }
    if (raw[0] !== 0x80) {
      return { ok: false, error: 'wrong version byte (0x' + raw[0].toString(16) + ', expected 0x80) — not a mainnet WIF' };
    }
    var compressed = raw.length === 38;
    if (compressed && raw[33] !== 0x01) {
      return { ok: false, error: '38-byte WIF without the 0x01 compressed flag — malformed' };
    }

    var body = raw.slice(0, raw.length - 4);
    var want = raw.slice(raw.length - 4);
    var got = (await sha256d(body)).slice(0, 4);
    for (var i = 0; i < 4; i++) {
      if (want[i] !== got[i]) {
        zero(raw); zero(body);
        return { ok: false, error: 'checksum failed — one or more characters are wrong. Re-copy the whole key.' };
      }
    }

    var secret = raw.slice(1, 33);
    // The secret must be a valid secp256k1 scalar: 0 < k < n.
    var N = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'; // PUBLIC-CONSTANT: the secp256k1 curve order n, published in SEC 2 — a range bound, never a secret
    var kHex = toHex(secret).toUpperCase();
    var allZero = /^0+$/.test(kHex);
    zero(secret); zero(raw); zero(body);
    if (allZero || kHex >= N) {
      return { ok: false, error: 'not a valid secp256k1 private key (out of curve order)' };
    }

    return {
      ok: true,
      format: compressed ? 'WIF-compressed' : 'WIF',
      compressed: compressed,
      checksum: 'verified'
    };
  }

  /* ── arweave JWK shape check (structural, before sealing) ────────────────
     Parses the JSON, demands the RSA private parts, decodes the modulus, and
     derives the PUBLIC address (sha256 of the modulus, base64url) for meta.
     Self-contained b64url decode — no dependency on the shared unb64.       */
  var B64U_V = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function unb64uV(s) {
    s = String(s || '').replace(/=+$/, '');
    var out = [], buf = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      var v = B64U_V.indexOf(s[i]);
      if (v < 0) return null;
      buf = (buf << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
    }
    return out.length ? new Uint8Array(out) : new Uint8Array(0);
  }
  function b64uV(bytes) {
    var s = '', B = B64U_V;
    for (var i = 0; i < bytes.length; i += 3) {
      var a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : null, c = i + 2 < bytes.length ? bytes[i + 2] : null;
      s += B[a >> 2];
      s += B[((a & 3) << 4) | (b === null ? 0 : b >> 4)];
      if (b !== null) s += B[((b & 15) << 2) | (c === null ? 0 : c >> 6)];
      if (c !== null) s += B[c & 63];
    }
    return s;
  }
  async function validateArweaveJwk(input) {
    var j;
    try { j = JSON.parse(String(input || '').trim()); }
    catch (e) { return { ok: false, error: 'not JSON — an arweave key is the wallet\'s JWK file contents' }; }
    if (!j || j.kty !== 'RSA') return { ok: false, error: 'kty is not RSA' };
    if (!j.n || !j.e || !j.d) return { ok: false, error: 'missing n / e / d — this looks like a public half' };
    var mod = unb64uV(j.n);
    if (!mod || mod.length < 256) return { ok: false, error: 'modulus does not decode to an RSA-2048+-sized key' };
    var digest = await crypto.subtle.digest('SHA-256', mod);
    return { ok: true, address: b64uV(new Uint8Array(digest)), size: mod.length * 8 };
  }

  /* Route any pasted secret to the right validator. */
  async function detect(input) {
    var s = String(input || '').trim();
    if (!s) return { kind: null, error: 'nothing entered' };
    if (/^\s*\{/.test(s) && /"kty"\s*:\s*"RSA"/.test(s)) {
      var w = await validateArweaveJwk(s);
      if (w.ok) return Object.assign({ kind: 'arweave' }, w);
      return { kind: null, error: 'reads like an arweave JWK but fails its shape check: ' + w.error };
    }
    if (/^PVT_/.test(s) || (/^[1-9A-HJ-NP-Za-km-z]{50,53}$/.test(s) && !/\s/.test(s))) {
      var v = await validateVaultaKey(s);
      return Object.assign({ kind: 'vaulta' }, v);
    }
    if (/\s/.test(s)) {
      var m = await validateMnemonic(s);
      return Object.assign({ kind: 'seed' }, m);
    }
    return { kind: null, error: 'unrecognised — a seed phrase has spaces, a Vaulta key does not' };
  }

  /* ── keypass generation ──────────────────────────────────────────────────
     Diceware over the same 2048-word list. 2048 is exactly 2^11, so 11 raw
     random bits select a word with no modulo bias whatsoever.                */
  function generateKeypass(words) {
    var n = words || 8;
    if (n < 4) n = 4;
    if (n > 24) n = 24;
    var wl = wordlist();
    var out = [], buf = new Uint16Array(n);
    crypto.getRandomValues(buf);
    for (var i = 0; i < n; i++) out.push(wl[buf[i] & 0x7ff]);
    zero(buf);
    return { phrase: out.join('-'), words: n, bits: n * 11 };
  }

  /* Rough strength read for a typed keypass. Deliberately conservative. */
  function keypassStrength(pw) {
    var s = String(pw || '');
    if (!s) return { bits: 0, label: 'empty', ok: false };
    var pool = 0;
    if (/[a-z]/.test(s)) pool += 26;
    if (/[A-Z]/.test(s)) pool += 26;
    if (/[0-9]/.test(s)) pool += 10;
    if (/[^A-Za-z0-9]/.test(s)) pool += 32;
    var bits = Math.floor(s.length * Math.log2(pool || 1));
    // A generated diceware phrase scores its real entropy, not its char entropy.
    var parts = s.split(/[-\s]+/).filter(Boolean);
    try {
      var wl = wordlist();
      if (parts.length >= 4 && parts.every(function (w) { return wl.indexOf(w) >= 0; })) {
        bits = Math.max(bits, parts.length * 11);
      }
    } catch (e) { /* wordlist absent — fall back to character entropy */ }
    var label = bits < 50 ? 'weak' : bits < 70 ? 'fair' : bits < 90 ? 'strong' : 'very strong';
    return { bits: bits, label: label, ok: bits >= 70 };
  }


  /* ── envelope crypto — v2, multi-slot ────────────────────────────────────
     One random 256-bit Vault Master Key (VMK) encrypts the payload. The VMK is
     then WRAPPED separately by each credential that is allowed to open the
     vault — a "slot", the same shape as a LUKS keyslot or a BitLocker key
     protector. Any one slot opens it; no slot can read any other slot.

     That is what makes multi-device work: this laptop's keypass (stored in
     Bitwarden, say), the phone's keypass (Google Password Manager), and a
     Windows Hello / platform passkey are three independent slots over one
     vault. Adding or revoking a device re-wraps one slot and never touches
     the payload, so nothing else has to be re-encrypted or re-synced.

     Slot key material:
       type "keypass"  PBKDF2-HMAC-SHA-256, 600 000 iters, per-slot salt
       type "passkey"  HKDF-SHA-256 over a WebAuthn PRF secret, per-slot salt
                       (the page supplies the secret; this file never calls
                       WebAuthn itself)

     Each wrap is authenticated with its own slot descriptor as AAD, so a slot's
     KDF parameters cannot be downgraded or swapped between slots. The payload is
     authenticated against the envelope header only — deliberately NOT against the
     slot list, so adding a device does not require rewriting the ciphertext.     */

  var PAYLOAD_AAD = function (env) {
    return enc.encode(JSON.stringify({ magic: env.magic, format: env.format }));
  };
  var SLOT_AAD = function (slot) {
    // evidence is authenticated too — nobody re-grades an E2 slot to E3 by editing JSON
    return enc.encode(JSON.stringify({
      id: slot.id, type: slot.type, kdf: slot.kdf,
      iterations: slot.iterations || 0, salt: slot.salt,
      evidence: slot.evidence || 'E2'
    }));
  };

  async function keypassSlotKey(keypass, salt, iters) {
    var base = await subtle.importKey('raw', enc.encode(String(keypass)), 'PBKDF2', false, ['deriveKey']);
    return await subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: iters, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function passkeySlotKey(prfSecret, salt) {
    var base = await subtle.importKey('raw', prfSecret, 'HKDF', false, ['deriveKey']);
    return await subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: salt, info: enc.encode('BNRVAULT slot v2') },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  // cred: {type:'keypass', keypass} | {type:'passkey', prfSecret}
  async function slotKeyFor(slot, cred) {
    if (slot.type !== cred.type) throw new Error('slot/credential type mismatch');
    if (slot.type === 'keypass') return await keypassSlotKey(cred.keypass, unb64(slot.salt), slot.iterations);
    return await passkeySlotKey(cred.prfSecret, unb64(slot.salt));
  }

  /* Evidence class per dockets/T3_device_enrollment_flows.md §6b — the ladder ranks a
     credential by WHERE THE PRIVATE KEY ACTUALLY LIVES, not by brand:
       E3  device-bound passkey in a hardware keystore (platform authenticator on its
           own hardware, Bitwarden device-bound mobile) — the key cannot leave
       E2  vault-synced passkey (iCloud Keychain / Google Password Manager / Bitwarden
           vault-stored / Proton Pass) — portable inside a software vault, so it is
           only as strong as that vault account's own auth
       E2  a keypass stored in a password manager, for the same reason
     §6b closes with: evidence class is decided by the authenticator's attestation
     statement, "or its absence => E2 floor". This page requests no attestation
     statement, so every slot it mints is E2 unless the caller can prove better.
     We record the claim rather than inflating it. */
  var EVIDENCE_FLOOR = 'E2';

  async function makeSlot(cred, label, vmk) {
    var slot = {
      id: newId(),
      type: cred.type,
      label: String(label || '').trim() || (cred.type === 'passkey' ? 'passkey' : 'keypass'),
      evidence: cred.evidence === 'E3' ? 'E3' : EVIDENCE_FLOOR,
      bound: cred.evidence === 'E3' ? 'device-bound' : 'synced-or-software',
      kdf: cred.type === 'keypass' ? 'PBKDF2-SHA-256' : 'HKDF-SHA-256',
      iterations: cred.type === 'keypass' ? KDF_ITERS : 0,
      salt: b64(randomBytes(16)),
      created: new Date().toISOString()
    };
    var k = await slotKeyFor(slot, cred);
    var iv = randomBytes(12);
    var wrapped = new Uint8Array(await subtle.encrypt(
      { name: 'AES-GCM', iv: iv, additionalData: SLOT_AAD(slot) }, k, vmk));
    slot.iv = b64(iv);
    slot.wrapped = b64(wrapped);
    return slot;
  }

  async function unwrapSlot(slot, cred) {
    var k = await slotKeyFor(slot, cred);
    var raw = await subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(slot.iv), additionalData: SLOT_AAD(slot) },
      k, unb64(slot.wrapped));
    return new Uint8Array(raw);
  }

  async function encryptPayload(payload, vmk, env) {
    var key = await subtle.importKey('raw', vmk, 'AES-GCM', false, ['encrypt']);
    var iv = randomBytes(12);
    var ct = new Uint8Array(await subtle.encrypt(
      { name: 'AES-GCM', iv: iv, additionalData: PAYLOAD_AAD(env) },
      key, enc.encode(JSON.stringify(payload))));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function decryptPayload(env, vmk) {
    var key = await subtle.importKey('raw', vmk, 'AES-GCM', false, ['decrypt']);
    var pt = await subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(env.iv), additionalData: PAYLOAD_AAD(env) },
      key, unb64(env.ct));
    return JSON.parse(dec.decode(pt));
  }

  /* ── v1 compatibility ────────────────────────────────────────────────────
     v1 sealed the payload directly under PBKDF2(keypass). Those vaults still
     open, and are migrated to a v2 single-slot envelope on first unlock so the
     user can then add their other devices.                                    */
  function v1HeaderBytes(hdr) {
    return enc.encode(JSON.stringify({
      magic: hdr.magic, format: hdr.format, kdf: hdr.kdf,
      iterations: hdr.iterations, salt: hdr.salt
    }));
  }
  async function openV1(env, keypass) {
    var key = await keypassSlotKey(keypass, unb64(env.salt), env.iterations);
    var pt = await subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(env.iv), additionalData: v1HeaderBytes(env) },
      key, unb64(env.ct));
    return JSON.parse(dec.decode(pt));
  }

  /* ── vault state ───────────────────────────────────────────────────────── */
  var state = { unlocked: false, entries: null, vmk: null, env: null, slotId: null };

  function exists() {
    try { return !!localStorage.getItem(LS_KEY); } catch (e) { return false; }
  }
  function readEnvelope() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeEnvelope(env) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(env)); return true; }
    catch (e) { return false; }
  }
  function newId() { return toHex(randomBytes(8)); }
  function requireUnlocked() { if (!state.unlocked) throw new Error('vault is locked'); }

  async function persist() {
    requireUnlocked();
    var body = await encryptPayload({ entries: state.entries }, state.vmk, state.env);
    state.env = Object.assign({}, state.env, body, { updated: new Date().toISOString() });
    if (!writeEnvelope(state.env)) {
      throw new Error('could not write to localStorage — export to a file to avoid losing this');
    }
    return state.env;
  }

  /* ── create / unlock / lock ────────────────────────────────────────────── */
  async function create(keypass, label) {
    if (exists()) throw new Error('a vault already exists on this browser — unlock it, or destroy it first');
    var st = keypassStrength(keypass);
    if (st.bits < 50) throw new Error('that keypass is too weak (' + st.bits + ' bits) — generate one instead');
    var vmk = randomBytes(32);
    var env = {
      magic: MAGIC, format: FORMAT, slots: [],
      created: new Date().toISOString(), updated: new Date().toISOString()
    };
    env.slots = [await makeSlot({ type: 'keypass', keypass: keypass }, label || 'this device', vmk)];
    var body = await encryptPayload({ entries: [] }, vmk, env);
    env = Object.assign(env, body);
    if (!writeEnvelope(env)) throw new Error('could not write to localStorage (private browsing?) — export to a file instead');
    state = { unlocked: true, entries: [], vmk: vmk, env: env, slotId: env.slots[0].id };
    return { created: true, strength: st, slot: env.slots[0].label };
  }

  /* Try a credential against every slot of its type. onProgress(i, n, label) lets
     the page narrate, because N slots means N KDF runs and that is visibly slow. */
  async function openWith(cred, onProgress) {
    var env = readEnvelope();
    if (!env) throw new Error('no vault on this browser — create one, or import a vault file');
    if (env.magic !== MAGIC) throw new Error('not a BNR vault file');

    // v1: single-keypass envelope. Open, then migrate to v2 in place.
    if (env.format === 1) {
      if (cred.type !== 'keypass') throw new Error('this vault predates passkey slots — unlock it with its keypass once, and it will be upgraded');
      var payload = await openV1(env, cred.keypass).catch(function () {
        throw new Error('wrong keypass, or this vault has been modified');
      });
      var vmk = randomBytes(32);
      var fresh = {
        magic: MAGIC, format: FORMAT, slots: [],
        created: env.created || new Date().toISOString(), updated: new Date().toISOString()
      };
      fresh.slots = [await makeSlot({ type: 'keypass', keypass: cred.keypass }, 'original keypass', vmk)];
      fresh = Object.assign(fresh, await encryptPayload(payload, vmk, fresh));
      writeEnvelope(fresh);
      state = { unlocked: true, entries: payload.entries || [], vmk: vmk, env: fresh, slotId: fresh.slots[0].id };
      return { entries: state.entries.length, slot: fresh.slots[0].label, migrated: true };
    }

    if (env.format > FORMAT) throw new Error('vault format v' + env.format + ' is newer than this page understands');
    var candidates = (env.slots || []).filter(function (s) { return s.type === cred.type; });
    if (!candidates.length) {
      throw new Error(cred.type === 'passkey'
        ? 'no passkey slot on this vault — unlock with a keypass, then add this device'
        : 'no keypass slot on this vault');
    }
    for (var i = 0; i < candidates.length; i++) {
      if (onProgress) onProgress(i + 1, candidates.length, candidates[i].label);
      var vmk2;
      try { vmk2 = await unwrapSlot(candidates[i], cred); }
      catch (e) { continue; }                       // wrong credential for this slot — try the next
      var payload2 = await decryptPayload(env, vmk2);
      state = { unlocked: true, entries: payload2.entries || [], vmk: vmk2, env: env, slotId: candidates[i].id };
      return { entries: state.entries.length, slot: candidates[i].label };
    }
    throw new Error(cred.type === 'passkey'
      ? 'that passkey does not match any slot on this vault'
      : 'that keypass does not match any slot on this vault');
  }

  function unlock(keypass, onProgress) {
    return openWith({ type: 'keypass', keypass: keypass }, onProgress);
  }
  function unlockWithPasskey(prfSecret, onProgress) {
    return openWith({ type: 'passkey', prfSecret: prfSecret }, onProgress);
  }

  function lock() {
    if (state.vmk) zero(state.vmk);
    state = { unlocked: false, entries: null, vmk: null, env: null, slotId: null };
  }
  function isUnlocked() { return state.unlocked; }

  /* ── slots: the multi-device surface ───────────────────────────────────── */
  function listSlots() {
    var env = state.unlocked ? state.env : readEnvelope();
    if (!env) return [];
    if (env.format === 1) {
      return [{ id: 'v1', type: 'keypass', label: 'original keypass (upgrades on unlock)', created: env.created, current: true }];
    }
    return (env.slots || []).map(function (s) {
      return {
        id: s.id, type: s.type, label: s.label, kdf: s.kdf, created: s.created,
        evidence: s.evidence || 'E2', bound: s.bound || 'synced-or-software',
        current: s.id === state.slotId
      };
    });
  }

  async function addKeypassSlot(newKeypass, label) {
    requireUnlocked();
    var st = keypassStrength(newKeypass);
    if (st.bits < 50) throw new Error('that keypass is too weak (' + st.bits + ' bits) — generate one instead');
    // Refuse a duplicate: it would silently create two slots with one secret.
    for (var i = 0; i < state.env.slots.length; i++) {
      var s = state.env.slots[i];
      if (s.type !== 'keypass') continue;
      try { var got = await unwrapSlot(s, { type: 'keypass', keypass: newKeypass }); zero(got);
            throw new Error('that keypass already opens the slot "' + s.label + '"'); }
      catch (e) { if (/already opens/.test(e.message)) throw e; }
    }
    var slot = await makeSlot({ type: 'keypass', keypass: newKeypass }, label, state.vmk);
    state.env = Object.assign({}, state.env, {
      slots: state.env.slots.concat([slot]), updated: new Date().toISOString()
    });
    if (!writeEnvelope(state.env)) throw new Error('could not write the new slot');
    return { id: slot.id, label: slot.label, strength: st };
  }

  // opts.deviceBound:true claims E3 — pass it ONLY for a platform authenticator whose
  // key cannot leave the device. Everything else stays at the E2 floor.
  async function addPasskeySlot(prfSecret, label, opts) {
    requireUnlocked();
    if (!(prfSecret && prfSecret.length === 32)) throw new Error('expected a 32-byte PRF secret from the authenticator');
    for (var i = 0; i < state.env.slots.length; i++) {
      var s = state.env.slots[i];
      if (s.type !== 'passkey') continue;
      try { var got = await unwrapSlot(s, { type: 'passkey', prfSecret: prfSecret }); zero(got);
            throw new Error('that passkey already opens the slot "' + s.label + '"'); }
      catch (e) { if (/already opens/.test(e.message)) throw e; }
    }
    var slot = await makeSlot({ type: 'passkey', prfSecret: prfSecret,
      evidence: (opts && opts.deviceBound) ? 'E3' : 'E2' }, label, state.vmk);
    state.env = Object.assign({}, state.env, {
      slots: state.env.slots.concat([slot]), updated: new Date().toISOString()
    });
    if (!writeEnvelope(state.env)) throw new Error('could not write the new slot');
    return { id: slot.id, label: slot.label };
  }

  async function removeSlot(id) {
    requireUnlocked();
    var slots = state.env.slots || [];
    if (slots.length <= 1) throw new Error('this is the only way into the vault — add another device before removing this one');
    if (id === state.slotId) throw new Error('that is the slot you are currently unlocked with — remove it from one of your other devices');
    var left = slots.filter(function (s) { return s.id !== id; });
    if (left.length === slots.length) throw new Error('no such slot');
    state.env = Object.assign({}, state.env, { slots: left, updated: new Date().toISOString() });
    if (!writeEnvelope(state.env)) throw new Error('could not write the revoked slot list');
    return true;
  }

  /* T3 §Failure & recovery: "Panic path: revoke-all-except-anchor." Keeps exactly one
     way in — by default the slot you are holding right now — and drops every other
     credential in one act, for the lost-or-stolen-device case. */
  async function revokeAllExcept(keepId) {
    requireUnlocked();
    var keep = keepId || state.slotId;
    var slots = state.env.slots || [];
    if (!slots.some(function (s) { return s.id === keep; })) throw new Error('no such slot to keep');
    if (keep !== state.slotId) {
      throw new Error('you can only keep the slot you are currently unlocked with — ' +
                      'otherwise this device would revoke its own way back in');
    }
    var dropped = slots.length - 1;
    if (dropped < 1) throw new Error('there is only one slot — nothing to revoke');
    state.env = Object.assign({}, state.env, {
      slots: slots.filter(function (s) { return s.id === keep; }),
      updated: new Date().toISOString()
    });
    if (!writeEnvelope(state.env)) throw new Error('could not write the revoked slot list');
    return { revoked: dropped, kept: keep };
  }

  async function renameSlot(id, label) {
    requireUnlocked();
    var found = false;
    var slots = (state.env.slots || []).map(function (s) {
      if (s.id !== id) return s;
      found = true;
      return Object.assign({}, s, { label: String(label || '').trim() || s.label });
    });
    if (!found) throw new Error('no such slot');
    // The label is inside each slot's AAD, so a rename must re-wrap that slot.
    var i = slots.map(function (s) { return s.id; }).indexOf(id);
    state.env = Object.assign({}, state.env, { slots: slots, updated: new Date().toISOString() });
    if (!writeEnvelope(state.env)) throw new Error('could not write the renamed slot');
    return true;
  }

  /* Re-key the slot you are currently using. Other devices' slots are untouched —
     which is the point: changing this laptop's keypass must not lock out the phone. */
  async function changeKeypass(oldPass, newPass) {
    var env = readEnvelope();
    if (!env) throw new Error('no vault to re-key');
    if (env.format === 1) { await unlock(oldPass); env = state.env; }
    else if (!state.unlocked) { await unlock(oldPass); }
    var st = keypassStrength(newPass);
    if (st.bits < 50) throw new Error('new keypass too weak (' + st.bits + ' bits)');
    var cur = (state.env.slots || []).filter(function (s) { return s.id === state.slotId; })[0];
    if (!cur) throw new Error('cannot tell which slot you are using — unlock again');
    if (cur.type !== 'keypass') throw new Error('you are unlocked with a passkey — re-key from a keypass slot instead');
    var fresh = await makeSlot({ type: 'keypass', keypass: newPass }, cur.label, state.vmk);
    var slots = state.env.slots.map(function (s) { return s.id === cur.id ? fresh : s; });
    state.env = Object.assign({}, state.env, { slots: slots, updated: new Date().toISOString() });
    state.slotId = fresh.id;
    if (!writeEnvelope(state.env)) throw new Error('could not write the re-keyed vault');
    return true;
  }

  /* ── entries ───────────────────────────────────────────────────────────── */
  async function addEntry(e) {
    requireUnlocked();
    var type = e.type;
    var label = String(e.label || '').trim();
    var secret = String(e.secret || '');
    if (!label) throw new Error('give it a label — you will not remember which is which');
    if (!secret.trim()) throw new Error('nothing to store');

    var meta = {};
    if (type === 'seed') {
      var v = await validateMnemonic(secret);
      if (!v.ok && !e.force) throw new Error(v.error);
      secret = normalizePhrase(secret);
      meta = { words: v.count || null, valid: !!v.ok, entropyBits: v.entropyBits || null };
      if (e.passphrase) meta.hasPassphrase = true;
    } else if (type === 'vaulta') {
      var k = await validateVaultaKey(secret);
      if (!k.ok && !e.force) throw new Error(k.error);
      secret = secret.trim();
      meta = { format: k.format || 'unknown', checksum: k.checksum || 'unverified', valid: !!k.ok };
    } else if (type === 'bzdid') {
      // A bzDiD recovery phrase is NOT plain BIP-39 — it carries its own version and
      // checksum over the same wordlist — so it is stored verbatim. The page validates
      // it through BZDIDKEY before calling this; we record what it claimed.
      secret = secret.trim();
      meta = { words: secret.split(/s+/).length, fingerprint: String(e.fingerprint || '') };
    } else if (type === 'note') {
      meta = {};
    } else if (type === 'arweave') {
      // An Arweave JWK (JSON): structurally validated BEFORE sealing — kty RSA,
      // modulus + private exponent present and decodable. The PUBLIC address is
      // derived and stored in meta so the wallet's read lanes never need to
      // unseal for balance lookups. The secret never leaves the vault sealed.
      var a = await validateArweaveJwk(secret);
      if (!a.ok && !e.force) throw new Error(a.error);
      secret = secret.trim();
      meta = { address: a.address || null };
    } else {
      throw new Error('unknown entry type: ' + type);
    }

    var entry = {
      id: newId(), type: type, label: label, secret: secret,
      passphrase: e.passphrase ? String(e.passphrase) : '',
      chain: String(e.chain || '').trim(), note: String(e.note || '').trim(),
      meta: meta, added: new Date().toISOString()
    };
    state.entries.push(entry);
    await persist();
    return entry;
  }

  async function removeEntry(id) {
    requireUnlocked();
    var before = state.entries.length;
    state.entries = state.entries.filter(function (x) { return x.id !== id; });
    if (state.entries.length === before) throw new Error('no such entry');
    await persist();
    return true;
  }

  function list() {
    requireUnlocked();
    return state.entries.map(function (e) {
      return {
        id: e.id, type: e.type, label: e.label, chain: e.chain, note: e.note,
        meta: e.meta, added: e.added, hasPassphrase: !!e.passphrase
      };
    });
  }

  function reveal(id) {
    requireUnlocked();
    var e = state.entries.filter(function (x) { return x.id === id; })[0];
    if (!e) throw new Error('no such entry');
    return { secret: e.secret, passphrase: e.passphrase, type: e.type, label: e.label };
  }

  /* ── portability ───────────────────────────────────────────────────────── */
  function exportEnvelope() {
    var env = state.unlocked ? state.env : readEnvelope();
    if (!env) throw new Error('no vault to export');
    return JSON.stringify(env, null, 2);
  }
  async function importEnvelope(json, keypass) {
    var env;
    try { env = JSON.parse(json); } catch (e) { throw new Error('that file is not JSON'); }
    if (!env || env.magic !== MAGIC) throw new Error('not a BNR vault file');
    var backup = readEnvelope();
    if (!writeEnvelope(env)) throw new Error('could not write the imported vault');
    try {
      return await unlock(keypass);                 // refuse to keep what we cannot open
    } catch (e) {
      if (backup) writeEnvelope(backup); else { try { localStorage.removeItem(LS_KEY); } catch (x) {} }
      throw e;
    }
  }

  function destroy() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    lock();
  }

  return {
    exists: exists, isUnlocked: isUnlocked, list: list, reveal: reveal,
    create: create, unlock: unlock, unlockWithPasskey: unlockWithPasskey,
    lock: lock, destroy: destroy, changeKeypass: changeKeypass,
    listSlots: listSlots, addKeypassSlot: addKeypassSlot, addPasskeySlot: addPasskeySlot,
    removeSlot: removeSlot, renameSlot: renameSlot, revokeAllExcept: revokeAllExcept,
    addEntry: addEntry, removeEntry: removeEntry,
    exportEnvelope: exportEnvelope, importEnvelope: importEnvelope,
    validateMnemonic: validateMnemonic, validateVaultaKey: validateVaultaKey,
    validateArweaveJwk: validateArweaveJwk,
    mnemonicToSeed: mnemonicToSeed, normalizePhrase: normalizePhrase, detect: detect,
    generateKeypass: generateKeypass, keypassStrength: keypassStrength,
    VALID_WORD_COUNTS: VALID_WORD_COUNTS, KDF_ITERS: KDF_ITERS, LS_KEY: LS_KEY, FORMAT: FORMAT
  };
})();
