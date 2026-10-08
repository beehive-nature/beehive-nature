/* bchat-core.test.mjs — the bChat lane's genesis battery (SPEC-BCHAT-1).
   Proves, from sources:
     1. bchat-nip44.js against the OFFICIAL NIP-44 v2 vectors (pinned module
        beside this file), plus RFC 5869 HKDF and RFC 8439 ChaCha20 vectors.
     2. bchat-core.js envelope model invariants (lanes, retention/FORGET,
        attachment measured states, wire round-trip).
     3. bchat.html source boundary laws: SIMULATED labeling, external-link
        rel noopener, the no-request-on-load posture, tokens.css adoption.
   The crypto claims in dispatches cite THIS file: vectors green = the
   receipt. Run: node --test e2e/bchat-core.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  get_conversation_key, get_message_keys, calc_padded_len,
  encrypt_decrypt, encrypt_decrypt_long_msg, invalid
} from './bchat-nip44-vectors.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const load = (src, name) => {
  const ctx = vm.createContext({ console, TextEncoder, TextDecoder, crypto: globalThis.crypto });
  vm.runInContext(src, ctx, { filename: name });
  return ctx;
};
/* the vendored noble bundle arms BnrSign; bchat-nip44 arms BCHATNIP44 on it */
const vendorCtx = load(read('surfaces/onboarding/vendor/bnr-sign.js'), 'bnr-sign.js');
vm.runInContext(read('surfaces/bchat-nip44.js'), vendorCtx, { filename: 'bchat-nip44.js' });
const N44 = vendorCtx.BCHATNIP44;
const B = vendorCtx.BnrSign;
const h2b = N44.hexToBytes, b2h = N44.bytesToHex, cat = N44.cat;

test('NIP-44 v2: all official conversation-key vectors', () => {
  for (const c of get_conversation_key) {
    assert.equal(b2h(N44.conversationKey(h2b(c.sec1), c.pub2)), c.conversation_key,
      'conversation key mismatch for sec1=' + c.sec1);
  }
});
test('NIP-44 v2: invalid conversation-key inputs all throw (twist/no-sqrt/bad sec)', () => {
  for (const c of invalid.get_conversation_key) {
    assert.throws(() => N44.conversationKey(h2b(c.sec1), c.pub2), undefined,
      'must reject: ' + c.note);
  }
});
test('NIP-44 v2: message-key derivation vectors', () => {
  const ck = h2b(get_message_keys.conversation_key);
  for (const k of get_message_keys.keys) {
    const m = N44.messageKeys(ck, h2b(k.nonce));
    assert.equal(b2h(m.chachaKey), k.chacha_key, 'chacha_key');
    assert.equal(b2h(m.chachaNonce), k.chacha_nonce, 'chacha_nonce');
    assert.equal(b2h(m.hmacKey), k.hmac_key, 'hmac_key');
  }
});
test('NIP-44 v2: padded-length table', () => {
  for (const [len, padded] of calc_padded_len) {
    assert.equal(N44.calcPaddedLen(len), padded, 'calcPaddedLen(' + len + ')');
  }
});
test('NIP-44 v2: deterministic encrypt vectors (fixed nonce → exact payload)', () => {
  for (const c of encrypt_decrypt) {
    assert.equal(N44.encrypt(h2b(c.conversation_key), c.plaintext, h2b(c.nonce)), c.payload,
      'payload mismatch for plaintext=' + JSON.stringify(c.plaintext));
  }
});
test('NIP-44 v2: decrypt vectors', () => {
  for (const c of encrypt_decrypt) {
    assert.equal(N44.decrypt(h2b(c.conversation_key), c.payload), c.plaintext);
  }
});
test('NIP-44 v2: long-message vectors (pattern×repeat, sha256-pinned both ways)', () => {
  const sha256hex = s => b2h(B.sha256(N44.utf8encode(s)));
  for (const c of encrypt_decrypt_long_msg) {
    const pt = c.pattern.repeat(c.repeat);
    assert.equal(sha256hex(pt), c.plaintext_sha256, 'plaintext construction');
    const payload = N44.encrypt(h2b(c.conversation_key), pt, h2b(c.nonce));
    assert.equal(sha256hex(payload), c.payload_sha256, 'payload sha256');
    assert.equal(N44.decrypt(h2b(c.conversation_key), payload), pt, 'round-trip');
  }
});
test('NIP-44 v2: every invalid decrypt payload throws', () => {
  for (const c of invalid.decrypt) {
    assert.throws(() => N44.decrypt(h2b(c.conversation_key), c.payload), undefined,
      'must reject: ' + c.note);
  }
});
test('NIP-44 v2: encrypt rejects the deployed length bounds (0 and >65535 bytes)', () => {
  const ck = h2b(encrypt_decrypt[0].conversation_key);
  for (const len of invalid.encrypt_msg_lengths) {
    assert.throws(() => N44.encrypt(ck, 'a'.repeat(len)), undefined, 'must reject len=' + len);
  }
});
test('NIP-44 v2: fresh-key round-trip + tamper rejection (self-generated)', () => {
  const raw = new Uint8Array(32); crypto.getRandomValues(raw);
  const sec = b2h(raw); /* hex across the realm boundary, arrays stay home */
  const pub = b2h(B.secp.getPublicKey(sec, true).slice(1));
  const ck = N44.conversationKey(sec, pub);
  for (const pt of ['a', 'honey ⛓ ✓ you', 'x'.repeat(1000), 'ä'.repeat(3000)]) {
    assert.equal(N44.decrypt(ck, N44.encrypt(ck, pt)), pt);
  }
  const p = N44.encrypt(ck, 'proof');
  const i = p.length - 4;
  const bad = p.slice(0, i) + (p[i] === 'A' ? 'B' : 'A') + p.slice(i + 1);
  assert.throws(() => N44.decrypt(ck, bad), /invalid MAC/);
});

/* ── primitive pins: HKDF RFC 5869 case 1, ChaCha20 RFC 8439 §2.4.2 ── */
test('HKDF-SHA256 matches RFC 5869 test case 1', () => {
  const IKM = h2b('0b'.repeat(22)); // PUBLIC-CONSTANT
  const salt = h2b('000102030405060708090a0b0c'); // PUBLIC-CONSTANT
  const info = h2b('f0f1f2f3f4f5f6f7f8f9'); // PUBLIC-CONSTANT
  const prk = N44.hkdfExtract(salt, IKM);
  assert.equal(b2h(prk), '077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5'); // PUBLIC-CONSTANT
  assert.equal(b2h(N44.hkdfExpand(prk, info, 42)),
    '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865'); // PUBLIC-CONSTANT
});
test('ChaCha20 matches RFC 8439 §2.4.2 (sunscreen vector)', () => {
  const key = h2b('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'); // PUBLIC-CONSTANT
  const nonce = h2b('000000000000004a00000000'); // PUBLIC-CONSTANT
  const pt = new TextEncoder().encode("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
  const ct = N44.chacha20(key, nonce, 1, pt);
  assert.equal(b2h(ct),
    '6e2e359a2568f98041ba0728dd0d6981e97e7aec1d4360c20a27afccfd9fae0bf91b65c5524733ab8f593dabcd62b3571639d624e65152ab8f530c359f0861d807ca0dbf500d6a6156a38e088a22b65e52bc514d16ccf806818ce91ab77937365af90bbf74a35be6b40b8eedf2785e42874d'); // PUBLIC-CONSTANT
});

/* ── bchat-core.js: the transport-neutral envelope model ── */
const coreCtx = load(read('surfaces/bchat-core.js'), 'bchat-core.js');
const CORE = coreCtx.BCHAT;
test('bchat-core: lanes are the three trust lanes, frozen', () => {
  assert.deepEqual(Object.values(CORE.LANES).sort(),
    ['autonomi-attachment', 'bnr-private', 'sms']);
  assert.throws(() => { CORE.LANES.SMS = 'x'; }, undefined, 'lanes immutable');
});
test('bchat-core: envelope validation accepts a good envelope and names every bad one', () => {
  const good = CORE.envelope({
    lane: CORE.LANES.BNR,
    from: { kind: 'npub', value: 'ab'.repeat(32) },
    body: { type: 'text', text: 'first light' },
    policy: { retain: 'persistent' }
  });
  assert.equal(good.ok, true);
  assert.equal(good.env.v, 1);
  for (const bad of [
    { lane: 'carrier-pigeon' },
    { lane: CORE.LANES.BNR, from: { kind: 'npub', value: 'nothex' } },
    { lane: CORE.LANES.BNR, from: { kind: 'npub', value: 'ab'.repeat(32) }, body: { type: 'text', text: '' } },
    { lane: CORE.LANES.BNR, from: { kind: 'npub', value: 'ab'.repeat(32) }, body: { type: 'text', text: 'x' }, policy: { retain: 'forever' } }
  ]) assert.equal(CORE.envelope(bad).ok, false);
});
test('bchat-core: attachment states are measured states, in order, never skipped silently', () => {
  assert.deepEqual([...CORE.ATTACH_STATES],
    ['descriptor-only', 'retrieving', 'retrieved', 'hash-verified']);
  const e = CORE.envelope({
    lane: CORE.LANES.AUTONOMI,
    from: { kind: 'npub', value: 'ab'.repeat(32) },
    body: { type: 'attachment' },
    attachment: { addr: 'autonomi://' + '0'.repeat(64), bytes: 4096, sha256: 'c'.repeat(64), state: 'descriptor-only' },
    policy: { retain: 'persistent' }
  });
  assert.equal(e.ok, true);
  assert.equal(CORE.envelope(Object.assign({}, e.env, { attachment: { state: 'magically-there' } })).ok, false);
});
test('bchat-core: wire round-trip carries envelope v1 losslessly', () => {
  const e = CORE.envelope({
    lane: CORE.LANES.BNR,
    from: { kind: 'npub', value: 'ab'.repeat(32) },
    body: { type: 'text', text: 'round trip' },
    policy: { retain: 'until-read' }
  }).env;
  assert.equal(JSON.stringify(CORE.wireDecode(CORE.wireEncode(e))), JSON.stringify(e)); // structural equality (env is cross-realm)
});
test('bchat-core: FORGET prunes by policy and REPORTS what actually happened (never claims deletion)', () => {
  const now = 1_000_000;
  const mk = (retain, forgetAt) => CORE.envelope({
    lane: CORE.LANES.BNR,
    from: { kind: 'npub', value: 'ab'.repeat(32) },
    body: { type: 'text', text: 'x' },
    policy: { retain, forgetAt }
  }).env;
  const store = [
    { env: mk('persistent'), read: true },
    { env: mk('until-read'), read: true },
    { env: mk('until-read'), read: false },
    { env: mk('ephemeral', now - 1), read: false },
    { env: mk('ephemeral', now + 999), read: false }
  ];
  const report = CORE.applyRetain(store, now);
  assert.equal(store.length, 3, 'two entries pruned locally');
  assert.equal(report.dropped.length, 2, 'report lists both drops');
  assert.ok(report.dropped.every(d => d.reason.length > 0));
  assert.ok(/publication-consent|deletion/i.test(report.law), 'the no-deletion-promise law travels with the report');
});
test('bchat-core: receipts carry events, never contents', () => {
  const r = CORE.receipt('published', 'evid', { kind: 1059 });
  assert.equal(r.event, 'published');
  assert.ok(!('content' in r) && !('text' in r) && !('payload' in r));
});

/* ── bchat-wire.js: the NIP-01/NIP-17 assembly shared by page + harness ── */
vm.runInContext(read('surfaces/bchat-wire.js'), vendorCtx, { filename: 'bchat-wire.js' });
const WIRE = vendorCtx.BCHATWIRE;
test('bchat-wire: NIP-17 gift round-trip between two fresh identities', () => {
  const rawA = new Uint8Array(32), rawB = new Uint8Array(32);
  crypto.getRandomValues(rawA); crypto.getRandomValues(rawB);
  const secA = b2h(rawA), secB = b2h(rawB);
  const pubA = WIRE.xonly(secA), pubB = WIRE.xonly(secB);
  const env = CORE.envelope({
    lane: CORE.LANES.BNR, from: { kind: 'npub', value: pubA },
    body: { type: 'text', text: 'wire round-trip ⛓' }, policy: { retain: 'persistent' }
  }).env;
  const gift = WIRE.buildDM(secA, pubA, pubB, CORE.wireEncode(env));
  assert.equal(gift.kind, 1059, 'gift wrap kind');
  assert.equal(JSON.stringify(gift.tags), JSON.stringify([['p', pubB]]), 'gift addressed to recipient'); // cross-realm compare
  assert.notEqual(gift.pubkey, pubA, 'gift carries the EPHEMERAL key, not the sender');
  assert.ok(WIRE.verifyEvent(gift), 'gift is a well-signed NIP-01 event');
  const got = WIRE.unwrapGift(secB, pubB, gift);
  assert.equal(got.from, pubA, 'seal reveals the true sender');
  assert.equal(got.rumor.kind, 14);
  assert.equal(JSON.stringify(CORE.wireDecode(got.rumor.content)), JSON.stringify(env), 'envelope survives the wire');
});
test('bchat-wire: a forged seal signature is refused, never shown untrusted', () => {
  const secA = b2h(new Uint8Array(32).fill(7)), secB = b2h(new Uint8Array(32).fill(9));
  const pubA = WIRE.xonly(secA), pubB = WIRE.xonly(secB);
  const env = CORE.envelope({
    lane: CORE.LANES.BNR, from: { kind: 'npub', value: pubA },
    body: { type: 'text', text: 'forged' }, policy: { retain: 'persistent' }
  }).env;
  const rumor = { pubkey: pubA, created_at: 1, kind: 14, tags: [['p', pubB]], content: CORE.wireEncode(env) };
  const seal = WIRE.finishEvent({
    pubkey: pubA, created_at: 1, kind: 14, tags: [['p', pubB]],
    content: N44.encrypt(N44.conversationKey(secA, pubB), JSON.stringify(rumor))
  }, secA);
  const sig = seal.sig.split('');
  sig[0] = sig[0] === '0' ? '1' : '0'; /* break the signature */
  seal.sig = sig.join('');
  const eph = b2h(new Uint8Array(32).fill(3));
  const gift = WIRE.finishEvent({
    pubkey: WIRE.xonly(eph), created_at: 1, kind: 1059, tags: [['p', pubB]],
    content: N44.encrypt(N44.conversationKey(eph, pubB), JSON.stringify(seal))
  }, eph);
  assert.throws(() => WIRE.unwrapGift(secB, pubB, gift), /signature/);
});
test('bchat-wire: a wrap for someone else cannot be opened (wrong identity)', () => {
  const secA = b2h(new Uint8Array(32).fill(5)), secB = b2h(new Uint8Array(32).fill(6));
  const secC = b2h(new Uint8Array(32).fill(8));
  const pubA = WIRE.xonly(secA), pubB = WIRE.xonly(secB), pubC = WIRE.xonly(secC);
  const env = CORE.envelope({
    lane: CORE.LANES.BNR, from: { kind: 'npub', value: pubA },
    body: { type: 'text', text: 'not for C' }, policy: { retain: 'persistent' }
  }).env;
  const gift = WIRE.buildDM(secA, pubA, pubB, CORE.wireEncode(env));
  assert.throws(() => WIRE.unwrapGift(secC, pubC, gift), /MAC|conversation|pub/i);
});

test('bchat-wire: canonical NIP-01 serialization — the leading 0 is a NUMBER (regression: the signed-as-"0" defect)', () => {
  /* 2026-10-03: serializeEvent emitted ["0",…] so every signature was made over a
     wrong hash; the member relay's 'verification failed' was TRUE. Caught by
     cross-library hash comparison against nostr-tools 2.10.4 (offline control).
     This golden string pins the canonical form forever. */
  const pub = 'ab'.repeat(32), chal = 'cd'.repeat(32);
  const s = WIRE.serializeEvent(pub, 1700000000, 22242, [['relay', 'wss://x'], ['challenge', chal]], '');
  assert.equal(s, '[0,"' + pub + '",1700000000,22242,[["relay","wss://x"],["challenge","' + chal + '"]],""]');
  /* and a finished event's id is the hash OF THAT STRING */
  const raw = new Uint8Array(32); crypto.getRandomValues(raw);
  const sec = b2h(raw);
  const ev = WIRE.finishEvent({ pubkey: WIRE.xonly(sec), created_at: 1700000001, kind: 1, tags: [], content: 'x' }, sec);
  const expectId = b2h(B.sha256(N44.utf8encode('[0,"' + ev.pubkey + '",1700000001,1,[],"x"]')));
  assert.equal(ev.id, expectId);
});

/* ── bchat.html source boundary laws (cite-or-silent, no theater) ── */
/* lazy: the page tests read the file at run time so the crypto battery
   above still runs while the surface is being authored */
let _page = null;
const page = () => { if (_page === null) _page = read('surfaces/bchat.html'); return _page; };
test('bchat.html: the SMS lane is SIMULATED and says so in place', () => {
  assert.match(page(), /SIMULATED/);
  assert.match(page(), /carrier transport/i);
});
test('bchat.html: external links open a new tab with rel noopener, and say so', () => {
  for (const m of page().match(/<a [^>]*href="https?:[^"]*"[^>]*>/g) || []) {
    assert.match(m, /target="_blank"/, m);
    assert.match(m, /rel="noopener/, m);
  }
});
test('bchat.html: renders without a relay — no request on load (the rub law)', () => {
  assert.match(page(), /data-no-request-on-load/);
  assert.match(page(), /connect is a click/); /* the posture is stated in place */
  assert.ok((page().match(/new WebSocket/g) || []).length >= 1, 'a real client exists, not theater');
  assert.doesNotMatch(page(), /window\.addEventListener\('load'[^)]*\)[^;]*connect/);
});
test('bchat.html: register contract + tokens sheet adopted', () => {
  /* the estate's one-shell law (e2e/register.test.mjs:171-175): exactly one
     shared-loader tag, and it is tour.js?v=42 — tour bootstraps register.js */
  const tags = [...page().matchAll(/<script\b[^>]*\bsrc=["']([^"']*\b(?:tour|register)\.js(?:\?[^"']*)?)["'][^>]*>/gi)];
  assert.equal(tags.length, 1, 'must load the shared shell once');
  assert.match(tags[0][1], /tour\.js\?v=42$/);
  assert.match(page(), /tokens\.css/);
  assert.match(page(), /data-reg/);
});
