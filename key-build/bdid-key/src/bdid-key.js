// bdid-key — the bDiD key build.
//
// PRF secret → master_prk → Ed25519 keys, recovery phrase, fingerprints, persona
// nullifiers. Derivation pattern adapted from FileKey (github.com/RockwellShah/filekey,
// GPLv3; this adaptation intended for the AGPL-3.0-only kernel — GPLv3↔AGPLv3
// compatible via GPLv3 §13). Curve swapped P-256 → Ed25519 per did-autonomi-spec
// (keyAlg=ed25519, see crates/atmirror/src/record_sig.rs).
//
// ARCHITECTURAL LAW (crates/onboarding/src/lib.rs): the authenticator is a key,
// NEVER the identity. Everything derived here AUTHORISES a bDiD root; none of it
// IS the root. The bDiD stays the self-certifying digest of the genesis op; keys
// derived here sign records under it and are rotatable via the DID log.
//
// Two doors, one root:
//   passkey (WebAuthn PRF, UV=required)  ─┐
//                                          ├─► master_prk (32 B) ─► everything
//   written phrase (BIP39, 24 words)     ─┘
//
// PROPOSED-PENDING-RAID: every "BDID-v1/..." label below is a normative byte
// string once ratified. Rename before first mainnet derivation or never.
//
// DECISION GATE (founder-class, see sprint map): 24 words (256-bit root) is
// implemented as canonical. The mock showed 12. This module refuses 12-word
// phrases loudly rather than guessing — flip WORDS_DECISION after the ruling.

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { extract, expand } from '@noble/hashes/hkdf.js';
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { bech32m } from '@scure/base';

// ── constants: exact bytes are normative once ratified ─────────────────────────
export const LABEL_PRF_INPUT   = 'BDID-v1/prf-input/identity';
export const LABEL_MASTER_PRK  = 'BDID-v1/master-prk';
export const LABEL_RECORD_KEY  = 'BDID-v1/ed25519-record-key';
export const LABEL_PERSONA     = 'BDID-v1/persona-nullifier';
export const LABEL_FINGERPRINT = 'BDID-v1/fingerprint';
export const RECOVERY_HRP      = 'bdidrec';      // self-describing recovery encoding
export const REC_VERSION       = 0x01;
export const CONTEXT_TAG_LEN   = 8;              // ≥8 bytes: 4 birthday-bounds at ~65k contexts
export const WORDS_DECISION    = 24;             // founder gate: 24 implemented, 12 refused

const te = new TextEncoder();
const ascii = (s) => te.encode(s);

function concat(...arrs) {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

export const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export class BdidKeyError extends Error {
  constructor(msg, code) { super(msg); this.name = 'BdidKeyError'; this.code = code; }
}

// ── §1 · PRF input salt (constant; the one WebAuthn PRF eval input) ─────────────
/** 32-byte constant PRF input: SHA-256("BDID-v1/prf-input/identity"). */
export const PRF_INPUT_SALT = sha256(ascii(LABEL_PRF_INPUT));

// ── §2 · master_prk ────────────────────────────────────────────────────────────
/** master_prk = HKDF-Extract(SHA-256, salt="BDID-v1/master-prk", IKM=prf_secret). */
export function masterPrkFromPrfSecret(prfSecret) {
  if (!(prfSecret instanceof Uint8Array) || prfSecret.length !== 32) {
    throw new BdidKeyError(`prf_secret must be 32 bytes, got ${prfSecret?.length}`, 'prf_secret_length');
  }
  return extract(sha256, prfSecret, ascii(LABEL_MASTER_PRK));
}

// ── §3 · context tags (persona / namespace scoping, ≥8 bytes) ──────────────────
/** context_tag = SHA-256(canonical context string)[0..8]. */
export function contextTag(context) {
  if (typeof context !== 'string' || context.length === 0) {
    throw new BdidKeyError('context must be a non-empty string', 'context_empty');
  }
  return sha256(ascii(context)).subarray(0, CONTEXT_TAG_LEN);
}

// ── §4 · Ed25519 record-signing key (authorises the root; rotatable) ───────────
/**
 * Derive the Ed25519 record-signing keypair for a context:
 *   seed = HKDF-Expand(master_prk, "BDID-v1/ed25519-record-key" || context_utf8, 32)
 * The full context string (not its tag) is bound into the info, so distinct
 * contexts give unlinkable keys and a tag collision cannot alias derivations.
 */
export function deriveRecordKey(masterPrk, context) {
  if (masterPrk.length !== 32) throw new BdidKeyError('master_prk must be 32 bytes', 'master_prk_length');
  const seed = expand(sha256, masterPrk, concat(ascii(LABEL_RECORD_KEY), ascii(context)), 32);
  const publicKey = ed25519.getPublicKey(seed);
  return {
    context,
    /** 32-byte Ed25519 seed (the private key). Scrub with .fill(0) when done. */
    seed,
    /** 32-byte Ed25519 public key. */
    publicKey,
    sign: (msg) => ed25519.sign(msg, seed),
  };
}

/**
 * Verify an Ed25519 record signature with the SAME strictness the resolver
 * mandates (R1b, record_sig.rs): reject non-canonical scalar s >= L explicitly —
 * never by library accident. @noble's ed25519.verify rejects s >= L (RFC 8032
 * strict) and we assert the canonical bound ourselves as the loud second check.
 */
const L = 0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3edn/*PUBLIC-CONSTANT*/; // ed25519 group order
export function verifyRecordSig(sig, msg, publicKey) {
  if (!(sig instanceof Uint8Array) || sig.length !== 64) return false;
  let s = 0n; // little-endian scalar half
  for (let i = 63; i >= 32; i--) s = (s << 8n) | BigInt(sig[i]);
  if (s >= L) return false; // R1b: explicit canonical-scalar refusal
  try { return ed25519.verify(sig, msg, publicKey, { zip215: false }); } catch { return false; }
}

// ── §5 · persona nullifiers (context nullifiers below the bDiD) ────────────────
/**
 * nullifier = HKDF-Expand(master_prk, "BDID-v1/persona-nullifier" || context, 32).
 * Pairwise, unlinkable across contexts, deterministic within one — the
 * Semaphore/World-ID pattern named in docs/biometric-uniqueness-ledger.md.
 */
export function personaNullifier(masterPrk, context) {
  if (masterPrk.length !== 32) throw new BdidKeyError('master_prk must be 32 bytes', 'master_prk_length');
  return expand(sha256, masterPrk, concat(ascii(LABEL_PERSONA), ascii(context)), 32);
}

// ── §6 · recovery phrase: the written-code FLOOR, derivational ─────────────────
// The phrase IS the root (mnemonicToEntropy(phrase) == master_prk). Recovery is
// pure re-derivation — no service, no stored hash needed to restore. Enrolment's
// code_hash becomes a local write-down check only.

/** master_prk (32 B) → canonical 24-word English phrase. */
export function encodeRecoveryPhrase(masterPrk) {
  if (masterPrk.length !== 32) throw new BdidKeyError('master_prk must be 32 bytes', 'master_prk_length');
  return entropyToMnemonic(masterPrk, wordlist);
}

/** Phrase → master_prk. Refuses non-24-word counts with the honest reason. */
export function decodeRecoveryPhrase(mnemonic) {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);
  if (words.length !== WORDS_DECISION) {
    throw new BdidKeyError(
      words.length === 12
        ? 'this is a 12-word phrase; bDiD recovery phrases are 24 words (256-bit root). If you are holding prototype "stage prop" words, they never derived anything — see the preview banner.'
        : `a recovery phrase is exactly ${WORDS_DECISION} words, got ${words.length}`,
      'word_count');
  }
  const normalized = words.join(' ');
  if (!validateMnemonic(normalized, wordlist)) {
    throw new BdidKeyError('invalid phrase: unknown word or checksum failure — check each word against the printed list', 'bip39_invalid');
  }
  const entropy = mnemonicToEntropy(normalized, wordlist);
  if (entropy.length !== 32) throw new BdidKeyError('entropy != 32 bytes', 'entropy_length');
  return entropy;
}

/** Self-describing single-string recovery code: bdidrec1… (version ‖ master_prk). */
export function encodeRecoveryCode(masterPrk) {
  if (masterPrk.length !== 32) throw new BdidKeyError('master_prk must be 32 bytes', 'master_prk_length');
  return bech32m.encode(RECOVERY_HRP, bech32m.toWords(concat(Uint8Array.of(REC_VERSION), masterPrk)), 1023);
}

export function decodeRecoveryCode(code) {
  let payload;
  try { payload = bech32m.fromWords(bech32m.decode(code.trim(), 1023).words); }
  catch (e) { throw new BdidKeyError(`not a valid bdidrec code: ${e.message}`, 'bech32m_decode'); }
  if (!code.trim().toLowerCase().startsWith(RECOVERY_HRP + '1')) throw new BdidKeyError('wrong prefix', 'wrong_hrp');
  if (payload.length !== 33) throw new BdidKeyError(`payload length ${payload.length} != 33`, 'payload_length');
  if (payload[0] !== REC_VERSION) throw new BdidKeyError(`unsupported rec version 0x${payload[0].toString(16)}`, 'rec_version');
  return payload.slice(1);
}

/** Auto-detect either recovery format. */
export function decodeRecoveryAuto(input) {
  const t = input.trim();
  if (new RegExp(`^${RECOVERY_HRP}1`, 'i').test(t)) return decodeRecoveryCode(t);
  return decodeRecoveryPhrase(t);
}

// ── §7 · fingerprint words (T3 countersign: humans compare by eye/voice) ───────
/** SHA-256("BDID-v1/fingerprint" ‖ publicKey), top 66 bits → 6 BIP39 words + 4-byte hex. */
export function fingerprint(publicKey) {
  if (publicKey.length !== 32) throw new BdidKeyError('public key must be 32 bytes', 'pk_length');
  const h = sha256(concat(ascii(LABEL_FINGERPRINT), publicKey));
  let acc = 0n;
  for (let i = 0; i < 9; i++) acc = (acc << 8n) | BigInt(h[i]);
  acc >>= 6n; // keep top 66 bits = 6 × 11-bit indices
  const idx = new Array(6);
  for (let i = 5; i >= 0; i--) { idx[i] = Number(acc & 0x7ffn); acc >>= 11n; }
  return { words: idx.map((i) => wordlist[i]).join(' '), hex: toHex(h.subarray(0, 4)) };
}

// ── §8 · one-call identity bundle ──────────────────────────────────────────────
/** Everything a surface needs from one root, for one context. */
export function deriveIdentity(masterPrk, context) {
  const record = deriveRecordKey(masterPrk, context);
  return {
    context,
    record,
    fingerprint: fingerprint(record.publicKey),
    phrase: encodeRecoveryPhrase(masterPrk),
    recoveryCode: encodeRecoveryCode(masterPrk),
  };
}

// ── §9 · WebAuthn ceremony (browser only; every FileKey lesson kept) ───────────
// UV MUST be "required" at BOTH create and get: CTAP2 hmac-secret returns a
// DIFFERENT secret for UV vs non-UV assertions — under "preferred" a later
// assertion can silently skip UV and derive a different identity (lockout that
// looks like data loss). residentKey "required" → discoverable credential, so
// nothing is stored beyond the passkey (matches onboarding crate: only the
// opaque credential id is ever carried).

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const bs = (u) => { const ab = new ArrayBuffer(u.length); new Uint8Array(ab).set(u); return ab; };

/** Layer 1 of the capability ladder: does the BROWSER claim PRF? true/false/undefined(unknown → just try). */
export async function prfBrowserSupport() {
  const PKC = typeof PublicKeyCredential !== 'undefined' ? PublicKeyCredential : undefined;
  if (!PKC?.getClientCapabilities) return undefined;
  try {
    const v = (await PKC.getClientCapabilities())['extension:prf'];
    return v === true ? true : v === false ? false : undefined;
  } catch { return undefined; }
}

/**
 * Enroll a passkey with PRF. Resolves { prfEnabled } — Layer 2 of the ladder:
 * the AUTHENTICATOR's answer (a browser can claim PRF the authenticator can't do,
 * e.g. pre-25H2 Windows Hello). prfEnabled=false ⇒ offer another rung; nothing
 * proceeds silently.
 */
export async function enrollPasskey(displayName, rpName = 'BNR') {
  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { name: rpName },
      user: { id: bs(randomBytes(16)), name: displayName || 'you', displayName: displayName || 'you' },
      challenge: bs(randomBytes(32)),
      pubKeyCredParams: [{ type: 'public-key', alg: -8 }, { type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      timeout: 60_000,
      extensions: { prf: {} },
    },
  });
  if (!cred) throw new BdidKeyError('passkey creation returned null', 'create_null');
  const ext = cred.getClientExtensionResults();
  return { credentialId: cred.id, prfEnabled: ext?.prf?.enabled === true };
}

/** PRF assertion → 32-byte prf_secret. Discoverable get(), UV required (must match enrolment). */
export async function getPrfSecret() {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: bs(randomBytes(32)),
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: bs(PRF_INPUT_SALT) } } },
    },
  });
  if (!assertion) throw new BdidKeyError('assertion returned null', 'assert_null');
  const first = assertion.getClientExtensionResults()?.prf?.results?.first;
  if (!first) throw new BdidKeyError('no PRF output (authenticator lacks PRF, or no passkey enrolled here)', 'no_prf_output');
  const out = new Uint8Array(first);
  if (out.length !== 32) throw new BdidKeyError(`PRF output ${out.length} bytes, expected 32`, 'prf_length');
  return out;
}

/** Full passkey door: assert → derive → scrub intermediates. */
export async function identityFromPasskey(context) {
  const prfSecret = await getPrfSecret();
  const masterPrk = masterPrkFromPrfSecret(prfSecret);
  prfSecret.fill(0);
  const id = deriveIdentity(masterPrk, context);
  return { masterPrk, ...id };
}

/** Full phrase door: same identity, no passkey, works offline forever. */
export function identityFromRecovery(input, context) {
  const masterPrk = decodeRecoveryAuto(input);
  return { masterPrk, ...deriveIdentity(masterPrk, context) };
}
