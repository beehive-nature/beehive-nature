// bdid-key test vectors + invariants. Run: node test/test.mjs
import {
  PRF_INPUT_SALT, masterPrkFromPrfSecret, deriveRecordKey, verifyRecordSig,
  personaNullifier, encodeRecoveryPhrase, decodeRecoveryPhrase,
  encodeRecoveryCode, decodeRecoveryCode, decodeRecoveryAuto,
  fingerprint, deriveIdentity, toHex, BdidKeyError, CONTEXT_TAG_LEN, contextTag,
} from '../src/bdid-key.js';
import { ed25519 } from '@noble/curves/ed25519.js';

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.error('  ✗', name); } };
const throws = (fn, code, name) => {
  try { fn(); fail++; console.error('  ✗', name, '(did not throw)'); }
  catch (e) { ok(e instanceof BdidKeyError && e.code === code, `${name} [${e.code}]`); }
};

console.log('— constants —');
ok(PRF_INPUT_SALT.length === 32, 'PRF input salt is 32 bytes');
ok(CONTEXT_TAG_LEN >= 8, 'context tags are ≥8 bytes (birthday-safe at ecosystem scale)');

console.log('— determinism: same secret, same everything —');
const prf = new Uint8Array(32).fill(1);
const prk1 = masterPrkFromPrfSecret(prf);
const prk2 = masterPrkFromPrfSecret(new Uint8Array(32).fill(1));
ok(toHex(prk1) === toHex(prk2), 'master_prk deterministic');
const idA = deriveIdentity(prk1, 'bnr.b');
const idB = deriveIdentity(prk2, 'bnr.b');
ok(toHex(idA.record.publicKey) === toHex(idB.record.publicKey), 'record pubkey deterministic');
ok(idA.fingerprint.words === idB.fingerprint.words, 'fingerprint deterministic');
ok(idA.phrase === idB.phrase, 'phrase deterministic');

console.log('— context separation —');
const idC = deriveIdentity(prk1, 'skaists.b');
ok(toHex(idA.record.publicKey) !== toHex(idC.record.publicKey), 'different context → different key');
ok(toHex(personaNullifier(prk1, 'ctx-1')) !== toHex(personaNullifier(prk1, 'ctx-2')), 'nullifiers unlinkable across contexts');
ok(toHex(personaNullifier(prk1, 'ctx-1')) === toHex(personaNullifier(prk1, 'ctx-1')), 'nullifier stable within context');
ok(toHex(contextTag('bnr.b')) !== toHex(contextTag('skaists.b')), 'context tags differ');

console.log('— two doors, one root —');
const phrase = encodeRecoveryPhrase(prk1);
ok(phrase.split(' ').length === 24, 'phrase is 24 words');
ok(toHex(decodeRecoveryPhrase(phrase)) === toHex(prk1), 'phrase → same master_prk');
const code = encodeRecoveryCode(prk1);
ok(code.startsWith('bdidrec1'), `recovery code self-describing (${code.slice(0, 16)}…)`);
ok(toHex(decodeRecoveryCode(code)) === toHex(prk1), 'code → same master_prk');
ok(toHex(decodeRecoveryAuto(phrase)) === toHex(prk1), 'auto-detect: phrase');
ok(toHex(decodeRecoveryAuto(code)) === toHex(prk1), 'auto-detect: code');
ok(toHex(decodeRecoveryAuto(' ' + phrase.toUpperCase() + ' ')) === toHex(prk1), 'phrase tolerant of case/whitespace');

console.log('— honest refusals —');
throws(() => decodeRecoveryPhrase(phrase.split(' ').slice(0, 12).join(' ')), 'word_count', '12 words refused with the stage-props explanation');
const badWords = phrase.split(' '); badWords[3] = badWords[3] === 'abandon' ? 'ability' : 'abandon';
throws(() => decodeRecoveryPhrase(badWords.join(' ')), 'bip39_invalid', 'checksum failure refused');
throws(() => masterPrkFromPrfSecret(new Uint8Array(16)), 'prf_secret_length', 'short prf_secret refused');
throws(() => decodeRecoveryCode('bdidrec1qqqq'), 'bech32m_decode', 'garbage code refused');

console.log('— signatures: R1b strictness —');
const msg = new TextEncoder().encode('bDiD record');
const sig = idA.record.sign(msg);
ok(verifyRecordSig(sig, msg, idA.record.publicKey), 'valid signature verifies');
ok(!verifyRecordSig(sig, new TextEncoder().encode('tampered'), idA.record.publicKey), 'tampered message rejected');
ok(!verifyRecordSig(sig, msg, idC.record.publicKey), 'wrong key rejected');
// R1b: s + L must be rejected explicitly (the malleability record_sig.rs legislates against)
const Lbytes = [0xed,0xd3,0xf5,0x5c,0x1a,0x63,0x12,0x58,0xd6,0x9c,0xf7,0xa2,0xde,0xf9,0xde,0x14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0x10];
const mall = sig.slice();
{ let carry = 0;
  for (let i = 0; i < 32; i++) { const v = mall[32 + i] + Lbytes[i] + carry; mall[32 + i] = v & 0xff; carry = v >> 8; } }
ok(!verifyRecordSig(mall, msg, idA.record.publicKey), 'non-canonical scalar s+L rejected (R1b)');
// cross-check against plain noble verify
ok(ed25519.verify(sig, msg, idA.record.publicKey), 'noble cross-check verifies');

console.log('— pinned test vectors (regeneration must be byte-identical; Rust port must match) —');
const V = {
  prf_secret: toHex(prf),
  master_prk: toHex(prk1),
  context: 'bnr.b',
  record_pub: toHex(idA.record.publicKey),
  fp_words: idA.fingerprint.words,
  fp_hex: idA.fingerprint.hex,
  first3: phrase.split(' ').slice(0, 3).join(' '),
};
console.log(JSON.stringify(V, null, 2));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
