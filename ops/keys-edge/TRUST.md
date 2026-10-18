# keys.skaists.dev: release authority and the browser's trust boundary

Three properties, reported separately. None of them implies another.

| property | what provides it | class |
|---|---|---|
| key exchange, browser ↔ edge | TLS 1.3, `X25519MLKEM768` only (Caddyfile.keys `curves`) | hybrid: ML-KEM-768 + X25519 |
| server authentication, browser ↔ edge | the WebPKI certificate (Let's Encrypt, ECDSA P-256) | classical |
| which bytes are the keychain | a release record signed with ML-DSA-65, checked by the edge | post-quantum signature, edge-enforced |

`x25519mlkem768` protects the confidentiality of the session against a later quantum attack on the
recorded traffic. It does not authenticate the server or the bytes post-quantum. No browser trusts a
post-quantum certificate today.

## 1. Edge-enforced release verification (what it is, and what it is not)

`keys-door` serves only the files a release record names, and only after two independent ML-DSA-65
implementations accept the record's signature, the record chains from the pinned genesis, and every
file hashes to the record. That is **edge-enforced release verification**.

It is **not** end-user verification against a malicious edge. The browser checks only the TLS
certificate. Nothing in the browser checks the release signature before keychain code runs:

- whoever controls the TLS terminator for `keys.skaists.dev` (the edge host's root, its Caddy, its
  Docker daemon, or anyone who obtains a certificate for the name) can serve other bytes;
- such bytes run with the keychain origin's full power, including the passkey whose RP ID is
  `keys.skaists.dev`, and (because `keys.skaists.dev` may assert the parent RP ID) the wallet passkey
  whose RP ID is `skaists.dev`;
- a verifier downloaded from that same edge cannot establish the edge's honesty.

The keychain's `index.html` pins its vendor scripts by SRI, so a changed vendor file fails closed
once `index.html` is fixed; `index.html` itself is pinned by nothing the browser checks.

What exists outside the edge is **detection**, not a pre-execution barrier: the independent prober
(`tools/keychain-release/probe.mjs`, run from vantages the edge does not control) compares the served
bytes, TLS group, certificate and Certificate Transparency entries with the signed record. A prober
finding is evidence after the fact; it does not stop a user's browser from running bad bytes first.

A real pre-execution barrier needs a verifier the edge does not serve, holding a key and checkpoint
the edge cannot change: for example the parent wallet (on a different host) fetching the keychain
files, verifying them against a pinned release, and loading only verified bytes. A cross-origin frame
loads from its own origin, so this is a design change to the wallet/keychain boundary, owned by the
keychain owner. It is not built.

## 2. Release authority: the bootstrap decision that is still absent

Nothing here makes a release key authoritative. The signer pin file
`docs/KEYCHAIN-RELEASE-SIGNERS.json` is empty. The decision missing is exactly this:

> **A law-signed founder ruling (a `docs/RULINGS-*.md` file listed in `docs/PQ-LAW.json`, signed
> through the existing one-press law signature) that appoints one release-signing public key.**

The law key authenticates the *ruling*; it never signs releases. The ruling must state:

1. **Public-key binding.** The release signer id (`mldsa65:<base64url SHA3-256 of the ML-DSA-65
   verifying key>` for a `bsigner` key, or a `bzpq1…` id for a §3b key) and the full verifying key
   (or the `bsigner keygen` public output), so any verifier can check the id against the key.
2. **Custody.** Who holds it, and in which environment; provisioned there (for a `bsigner` key,
   `bsigner keygen --alg ml-dsa-65 --rec-env VAR`, sealed at rest under that custodian's recovery
   words). Provisioning inside the custodian's environment is not the same as private material
   entering an agent's conversation: the seed, the recovery words and the sealed keyset never
   appear in a conversation, a repository, CI, or a serving edge. The key is dedicated to releases.
   Never derived from the `skaists.dev` wallet passkey (any `*.skaists.dev` origin can re-derive
   that root), never the law key. Generating a key does not appoint it.
3. **Genesis checkpoint.** The SHA3-256 of the seq-1 record it authorizes. Edges are provisioned
   with this checkpoint and the signer id out of band (from the signed ruling), never from a peer.
4. **Succession.** A rotation is a release record whose `signers` names the successor, signed by the
   current signer; edges follow it without reconfiguration. A §3b key additionally commits to an
   SLH-DSA succession key in its id.
5. **Revocation and recovery.** The current signer cannot be revoked by itself if it is lost or
   compromised: the recovery path is a new law-signed ruling that names a new genesis checkpoint
   and signer, and every edge is re-provisioned with it (an operator act per edge, receipted).
   Equivocation (two valid records at one seq) holds every edge until a seq+1 record selects one.

Until that ruling exists, every release in this tree is signed by a disposable test key and is lab
evidence only. A fixture key is never promoted, and no production key is authorized by committing it.

### Signature profiles

Two profiles are accepted, each parsed strictly, with no fallback from one to the other:
SPEC-BPQ-1 §3b detached (`bzpq1…` ids) and `bheart.signature/1` from `bsigner sign`
(`mldsa65:<base64url SHA3-256 of the verifying key>` ids). Authority is the full public key and the
exact record bytes: the short `key_id` in a `bheart` envelope is checked only for consistency with
the key, never used as a pin. `signed_at_ms` is not covered by the `bheart` signature; it is ignored
for authorization, freshness, ordering and revocation, which come only from the authenticated
release history. The edge's second verifier calls `bsigner verify` with a public-only keyset; that
works with the pinned `bsigner` build and is version-specific compatibility, not a guarantee of
bsigner's frozen interface.

## 3. Anchors are witnesses

A Hive `bnr.anchor` (posting authority, secp256k1) or an Arweave transaction can witness that an
already-authorized release existed by a time and in an order. It creates no authority, never
replaces the ML-DSA verification, and serving never waits on it.
