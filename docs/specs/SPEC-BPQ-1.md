# SPEC-BPQ-1 — post-quantum keys and sealed objects

Status: IMPLEMENTED. JS: `surfaces/bpq.js` over `surfaces/onboarding/vendor/bpq-lib.js`.
Rust: `crates/bsigner/src/bpq.rs` (opens and verifies; CLI `bsigner bpq-open`, `bsigner bpq-verify`).
Vectors both must pass: `surfaces/bpq-vectors.json` (`node scripts/build-bpq-vectors.mjs --check`,
`cargo test -p bsigner bpq`).

This file is the decoder of record. A reader with only this text, a SHA-3 / SHA-256 / AES-GCM /
HKDF implementation and FIPS 203 / 204 / 205 can open and verify every object below.

## 1 · Why it is shaped this way

- Hashes and 256-bit symmetric ciphers are the primitives most likely to survive centuries; the
  only known quantum speed-up against them is a square root. Public-key algorithms come and go.
  So privacy for "only me" uses **no public-key step at all**, and every public-key step carries
  an algorithm id so it can be replaced.
- Identity is a hash, not a key. The id commits to a hash-based **succession key** that is not
  revealed until it is needed (pre-rotation), so a break of the lattice signature still leaves the
  owner a key the attacker never saw.
- Nothing needs a registry, a chain row or a server. The id proves itself; a sealed object
  carries its own key slots; readers need only the object and their own phrase.

## 2 · Keys from the bzDiD root

Input: the 32-byte `masterPrk` (the 24-word phrase is its BIP-39 encoding; a passkey PRF gives it
via `onboarding/bzdid-key.js`) and a context string. In the wallet the context is `pq:<name>`.

`expand(label, L) = HKDF-Expand(SHA-256, PRK = masterPrk, info = UTF-8(label) ‖ UTF-8(context), L)`

| key | label (frozen) | L | algorithm |
|---|---|---|---|
| signing | `BDID-v1/ml-dsa-65-record-key` | 32 | ML-DSA-65 KeyGen seed ξ (FIPS 204) |
| seal-to-me | `BDID-v1/x-wing-kem-key` | 32 | X-Wing seed (draft-connolly-cfrg-xwing-kem) |
| vault | `BDID-v1/vault-key` | 32 | AES-256 key material ("only me") |
| succession | `BDID-v1/slh-dsa-shake-256f-succession` | 96 | SLH-DSA-SHAKE-256f seed (FIPS 205) |

No label is a byte-prefix of another bzDiD label, so label ‖ context never collides.

X-Wing: `SHAKE-256(seed, 96)`; bytes 0–63 are the ML-KEM-768 seed d‖z, bytes 64–95 the X25519
secret. Public key = ML-KEM-768 encapsulation key (1184 B) ‖ X25519 public key (32 B). Shared
secret = `SHA3-256(ss_M ‖ ss_X ‖ ct_X ‖ pk_X ‖ "\.//^\")`; ciphertext = ct_M (1088 B) ‖ ct_X (32 B).

- `successionCommit = SHA3-256("bpq1/succession" ‖ slhPublicKey)` (SLH-DSA-SHAKE-256f pk, 64 B)
- `id = bech32m("bzpq", SHA3-256("bpq1/id" ‖ mlDsaPublicKey ‖ successionCommit))`

The succession secret is never stored; it is re-derived from the root when a rotation needs it.

## 3 · Public card and binding

Card: `{bpq:1, id, dsa, kem, succ, sig}` (base64url, no padding). `sig` = ML-DSA-65 over
`"bpq1/card" ‖ dsa ‖ kem ‖ succ`. Verify: lengths 1952 / 1216 / 32, `id` recomputes, signature.

Binding (pre-quantum notarization): `{bpq:1, kind:"binding", id, at, claims, dsa, succ, sig}`.
`claims` maps a lowercase kind (`evm`, `vaulta`, `ed25519`, …) to a one-line account string.
`sig` = ML-DSA-65 over `"bpq1/bind" ‖ SHA3-256(UTF-8(id ‖ "\n" ‖ at ‖ "\n" ‖ lines))`, where
`lines` is `kind=value\n` for each claim, kinds sorted. Made while the classical keys are still
sound, and co-signed by them where the chain allows, it lets an owner prove after a quantum break
which classical accounts were theirs before it.

## 4 · Sealed object (`bpq1`)

```
magic  89 42 50 51 31 0D 0A 1A          "\x89BPQ1\r\n\x1a"
u32be  C,  CORE   UTF-8 JSON, exact bytes
u32be  K,  KEYS   UTF-8 JSON array of reader slots
u32be  M,  META   AES-256-GCM(Kf, nonce(2,0), JSON {name,type,…}, AAD)  — empty if none
BODY       n segments, segment i = AES-256-GCM(Kf, nonce(flag,i), plain_i, AAD)
u32be  S,  SEAL   AES-256-GCM(Kf, nonce(3,0), JSON {alg,pk,sig,id?,succ?}, AAD) — empty if unsigned
```

- CORE = `{bpq:1, aead:"aes-256-gcm", seg, len, oid, kc, rosetta}`; `seg` ∈ [1024, 16 MiB];
  `oid` 16 random bytes; `kc = SHA3-256("bpq1/key-commit" ‖ oid ‖ Kf)` (key commitment: a reader
  rejects any slot whose key does not match, so one object cannot show two readers two plaintexts).
- `AAD = SHA3-256(CORE)`. `Kf` = 32 random bytes per object.
- `n = len == 0 ? 1 : ceil(len / seg)`; segment i holds plaintext bytes `[i·seg, min(len,(i+1)·seg))`
  and sits at object offset `bodyOffset + i·(seg + 16)`, so readers seek and stream.
- `nonce(flag, i)` = u32be(flag) ‖ u64be(i); flag 0 = more, 1 = final segment, 2 = META, 3 = SEAL.
- Slots carry no reader id, so the public head never names who can read (RULINGS-2026-09-16 §27):
  - `{to:"self", w}`: `KW = HKDF-SHA-256(IKM = vault key, salt = oid, info = "bpq1/wrap/self")`
  - `{to:"x-wing", ct, w}`: `KW = HKDF-SHA-256(IKM = X-Wing shared secret, salt = oid, info = "bpq1/wrap/x-wing")`
  - `w = AES-256-GCM(KW, nonce = 0¹², Kf, AAD)` (48 B). A reader tries each slot it can.
- SEAL is inside the encryption: only readers learn who sealed an object. Its signature is
  ML-DSA-65 over `"bpq1/seal" ‖ AAD ‖ SHA3-256(KEYS) ‖ SHA3-256(META) ‖ SHA3-256(BODY)`.
- The total length must equal exactly what the head implies; trailing bytes are refused.

Revocation: a reader who opened an object keeps what they read. To revoke, seal a new object (new
`Kf`, new readers). Because `Kf` is random, the new ciphertext shares nothing with the old, so
convergent storage (Autonomi self-encryption) cannot hand the old reader the new version.

Storage: a sealed object is ordinary bytes. Uploading it publicly is safe; the address is a
locator, not a capability. Only the phrase (or a reader's X-Wing key) opens it.

## 5 · Succession (rotation after a break)

When ML-DSA-65 must be retired, the owner re-derives the SLH-DSA-SHAKE-256f key from the root,
reveals its public key (anyone checks it against `succ` in the id) and signs, with SLH-DSA, a
statement naming the new key set and its own next commitment. The forger of the old ML-DSA key
cannot do this: the succession public key was never published. SLH-DSA rests on hash security
only. Signatures are 49,856 B, which is acceptable once per algorithm era.

## 6 · Agility rules

- Unknown `bpq` version, `aead`, slot `to` or seal `alg`: refuse, never default.
- New algorithms arrive as new ids (e.g. an HQC slot once FIPS 207 is final, for a second-family
  double wrap); old objects keep their ids and stay readable.
- Assurance, stated plainly: @noble/post-quantum 0.7.1 (self-audited) and RustCrypto ml-dsa 0.1.1 /
  ml-kem 0.3.2 (unaudited) agree byte for byte on the vectors; that is a cross-check between two
  implementations, not an audit. JS signing is not claimed to be constant-time.
