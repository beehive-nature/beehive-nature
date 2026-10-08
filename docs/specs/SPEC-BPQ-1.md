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
  carries its own key slots. Files the wallet seals for "only me" open from the phrase alone
  (context `root`, §2). A file shared to a persona opens with the phrase plus that persona's
  soul name (the name on its card). Objects sealed before this change opened only with the
  persona context, and the wallet still tries every persona it knows.
  (Founder ruling 2026-10-04: the soul name lives only in a browser's storage, so "only me"
  must not depend on it.)

## 2 · Keys from the bzDiD root

Input: the 32-byte `masterPrk` (the 24-word phrase is its BIP-39 encoding; a passkey PRF gives it
via `onboarding/bzdid-key.js`) and a context string. In the wallet a persona context is
`pq:<name>`; the "only me" vault uses the reserved context `root` (below).

`expand(label, L) = HKDF-Expand(SHA-256, PRK = masterPrk, info = UTF-8(label) ‖ UTF-8(context), L)`

| key | label (frozen) | L | algorithm |
|---|---|---|---|
| signing | `BDID-v1/ml-dsa-65-record-key` | 32 | ML-DSA-65 KeyGen seed ξ (FIPS 204) |
| seal-to-me | `BDID-v1/x-wing-kem-key` | 32 | X-Wing seed (draft-connolly-cfrg-xwing-kem) |
| vault | `BDID-v1/vault-key` | 32 | AES-256 key material ("only me") |
| succession | `BDID-v1/slh-dsa-shake-256f-succession` | 96 | SLH-DSA-SHAKE-256f seed (FIPS 205) |

No label is a byte-prefix of another bzDiD label, so label ‖ context never collides.

Phrase-only vault (founder ruling 2026-10-04). The reserved context string `root` (no `pq:`
prefix, so it never equals a wallet persona context, which always starts `pq:`) gives the
**root vault key** = `expand("BDID-v1/vault-key", 32)` with context `root`: the same HKDF, the
same frozen label, only the context differs. No new label and no object-format change: the
`self` slot (§4) is the same AES-256-GCM wrap, only the key fed to it differs, and its bytes
name neither the persona nor the root. JS `BPQ.rootVault(masterPrk)`, Rust
`bpq::root_vault(prk)`. The wallet seals every new file's own slot under the root vault, so
files it seals for "only me" open from the phrase alone; a file shared to a persona opens with
the phrase plus that persona's soul name (the name on its card), through its X-Wing slot, and
its optional SEAL is signed by the persona keys (`pq:<name>`), unchanged. Objects sealed before
this change opened only with the persona context; the wallet opens with the root vault first,
then every persona it knows, and when nothing opens an object it asks for the soul name it was
sealed or shared under, tries that persona's vault slot and then its X-Wing slot, and keeps the
name only if it opens the object. `root` is reserved: `keys` (JS `BPQ.keys`, Rust `bpq::keys`)
refuses it, so no signing, X-Wing or succession key is ever derived under it. `bsigner bpq-open`
with no `--context` opens with the root vault; with `--context` it tries the root vault, then
that context's vault and X-Wing key.

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
`claims` is a JSON object (never an array) mapping a kind (`evm`, `vaulta`, `ed25519`, …) to a
non-empty one-line account string. `sig` = ML-DSA-65 over
`"bpq1/bind" ‖ SHA3-256(UTF-8(id ‖ "\n" ‖ at ‖ "\n" ‖ lines))`, where `lines` is `kind=value\n`
for each claim, kinds sorted.

Because those bytes are newline-delimited, a verifier refuses, and a signer never writes:
- `at` not of the shape `YYYY-MM-DDTHH:MM:SS[.f]Z` (UTC; the shape only, field ranges are not
  checked), exactly `^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,9})?Z$` (otherwise `at:"…Z\ned25519=…"` could carry a claim removed from `claims` under the same
  signature);
- a kind not matching `^[a-z0-9][a-z0-9._-]{0,31}$` (so no `=`, no newline, ASCII order is the
  sort order), or a value that is empty or contains `\n` or `\r`;
- `bpq` other than 1, or `kind` other than `"binding"`. A card carries no `kind` at all; a card
  with any `kind` is refused. A detached signature (§3b) needs `kind:"detached"`, `bpq:1` and the
  same `at` rule. Made while the classical keys are still
sound, and co-signed by them where the chain allows, it lets an owner prove after a quantum break
which classical accounts were theirs before it.

The wallet adds `cosign: [{alg:"ed25519", claim:"bzdid-ed25519", sig}]`: the bzDiD Ed25519 record key
(context `bnr.b`) signs UTF-8(`"bpq1/cosign:" ‖ sig`), so the classical identity endorses this exact PQ
statement while Ed25519 is still sound. Verifiers that do not know a cosign `alg` ignore that entry;
the PQ signature alone decides `verifyBind`.

A binding proves something only if it existed before the break. The wallet stamps the exact saved
binding bytes with OpenTimestamps: SHA-256 of the file is POSTed to public calendars and the
replies are written as a standard detached `.ots` file (magic, version 1, sha256 op, digest, one
forked branch per calendar). The proof is hash-only (SHA-256 commitments into a Bitcoin block
header), so no signature inside it can be forged by Shor; it holds while SHA-256 and the
proof-of-work chain hold, and is renewed under a new hash before either weakens (RFC 4998 model).

## 3b · Detached file signature

`{bpq:1, kind:"detached", id, at, file:{size, sha3}, dsa, succ, sig}`. `sig` = ML-DSA-65 over
`"bpq1/detached" ‖ SHA3-256(file) ‖ SHA3-256(UTF-8(id ‖ "\n" ‖ at ‖ "\n" ‖ size))`. The file name
is not signed: files get renamed, their bytes do not. In a repository the signature sits beside its
file as `<file>.bpqsig.json`; `node scripts/verify-bpq-signatures.mjs` checks every one in CI and
`bsigner bpq-verify --file <sig> --target <file>` checks one natively. This is the mechanism by
which rulings, releases and archive manifests can carry an authorship proof that outlives Ed25519
and the hosting account. It is not in force yet: no tracked file carries a `.bpqsig.json` (the
script reports 0 of 0), and while `docs/PQ-SIGNERS.json` does not exist a signature that verifies
proves only that some `bzpq1` key signed, not whose. Enforcement begins once
`docs/PQ-SIGNERS.json` lists a signer.

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
  The SEAL answers only who sealed the object; the bytes are authenticated segment by segment.
  So a SEAL that fails in any way (fails AES-GCM, is not a JSON object, names an unknown `alg`,
  lacks or mangles `pk`/`sig`, has a non-string `id`, has an `id` without `succ`, or whose
  signature or id does not match) reports the sealer as not verified, never as verified, and
  does not fail the open. A sealer id is reported only when the sealer is verified (signature
  valid and the id recomputes from `pk` and `succ`); otherwise no id is reported.
- Every JSON part (CORE, KEYS, META, SEAL) is UTF-8 without a byte-order mark; a leading BOM is
  not stripped, so the part is refused (or, for SEAL, not verified).
- KEYS is not under the AEAD: a change there that leaves the reader's own slot intact still
  opens, and is caught by the SEAL signature (signed objects only).
- CORE number tokens are plain non-negative decimal digits (no sign, fraction or exponent):
  `65536.0` is refused, not read as 65536. `len + 16·n` must be computed without overflow and
  fit inside the object; a reader checks this before allocating.
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

- Unknown `bpq` version, `aead`, slot `to` or seal `alg`: refuse, never default. An unknown slot
  refuses the whole object, even when another slot opens it. An unknown seal `alg` means the
  sealer is reported not verified (§4).
- New algorithms arrive as new ids (e.g. an HQC slot once FIPS 207 is final, for a second-family
  double wrap); old objects keep their ids and stay readable.
- Assurance, stated plainly: @noble/post-quantum 0.7.1 (self-audited) and RustCrypto ml-dsa 0.1.1 /
  ml-kem 0.3.2 (unaudited) agree byte for byte on the vectors; that is a cross-check between two
  implementations, not an audit. JS signing is not claimed to be constant-time.
- Not cross-checked: the SLH-DSA-SHAKE-256f succession key (§2, §5). Only the JS side derives
  it; the Rust twin takes the succession commitment as an input and never derives the key, so
  the vectors' `slhPublicKey` has one implementation behind it, and `surfaces/pq-kat.json`
  carries no SLH-DSA known-answer vectors.

## 7 · Hardware signer (Safe 7, T3W1)

Ruled by R4 (`docs/RULINGS-2026-10-04.md`, option A): the device has its **own** `bzpq1` id. No
recovery phrase goes onto the device and no wallet key is imported into it.

- **Root.** The PRK for §2 is the SLIP-21 node `["BZPQ-DEVICE", "v1"]` of the device's own seed
  (named in the fork's `docs/bpq-device.md` before the code). It is a child, never the seed, and is
  kept apart from every coin path and from the MCU attestation key. Everything in §2 then applies
  unchanged: the same labels, the same id, the same card. The reserved context `root` is refused on
  the device, so the device never opens a wallet's "only me" vault.
- **Binding, both ways.** A §3 binding signed by the wallet id names the device id under the claim
  `bsafe-pq`; a §3 binding signed on the device names the wallet id. Each verifies with the code in
  §3 alone.
- **Signing.** The device builds the bytes it signs from the request (§3 binding or §3b detached
  signature), shows them, and signs only after a hold to confirm. Wire messages `BpqGetCard`,
  `BpqCard`, `BpqSign`, `BpqSignature` (ids 1300 to 1303, `messages-bpq.proto` in the fork).
- **Proved, emulator only** (`docs/receipts/bpq-safe7-emulator-2026-10-04.json`): the device card
  equals what `bpq.js` and `bsigner` derive for the same PRK and context; its bindings and detached
  signatures verify in both. **Not proved:** fit on hardware (ML-DSA-65 working memory on the
  MicroPython heap, 32 KiB app stack), channel confidentiality (the host link is classical Noise),
  device attestation. A signature from the device says who signed; it does not make the cable
  post-quantum.
