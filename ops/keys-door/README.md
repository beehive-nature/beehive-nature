# keys-door — the keychain edge for keys.skaists.dev

Keyless resolver, verifier and server (contract: keychain release + edge, 2026-10-12,
§1-§4 and §7 A1). It holds no key and signs nothing. It serves only the bytes a
`bnr.keychain-release/1` record names, and only after:

1. the envelope (≤ 64 KiB) and record parse strictly: canonical JSON, no duplicate key,
   no unknown or missing field; schema, kind, origin and rp_id equal the config;
2. the signature verifies in BOTH ML-DSA-65 implementations, the `fips204` crate
   in-process and the frozen bsigner CLI as a subprocess. Disagreement is refused and
   reported on health as `verifier disagreement`. Two signature profiles are accepted
   (see "Signature profiles" below): SPEC-BPQ-1 §3b (`bsigner bpq-verify`) and
   `bheart.signature/1` (`bsigner verify`);
3. the record chains from the pinned genesis (`genesis_sha3` + `genesis_signers`), one
   seq at a time (prev hash + a signer from the previous record's `signers`);
4. its seq is ≥ `min_seq` and ≥ the persisted floor (`state_dir/floor`, its own file),
   which is raised before a release is persisted or served, never after;
5. no equivocation is unresolved at its seq (two valid records, one seq: the edge
   stops until a valid seq+1 selects one branch). Every valid record met at a fork,
   and after one, is kept in `state_dir/evidence/` (≤ 64, content-addressed) and put
   back in every poll, so a fork is not forgotten when a source stops offering a
   branch, or on restart. A full store holds the edge where it is;
6. the pack and every file match their size, SHA-256 and SHA3-256.

## Signature profiles

A signer id in `record.signers`, `genesis_signers` (and
`docs/KEYCHAIN-RELEASE-SIGNERS.json`) is either form, validated strictly: a `bzpq1…`
id (bech32m, SPEC-BPQ-1 §2), or `mldsa65:` + base64url without padding of
SHA3-256(the 1952-byte ML-DSA-65 verifying key), 43 characters. Rotation between the
profiles is a record whose `signers` name the other form; the next record is then
accepted only in that form.

The envelope is `{"bnr":"keychain-release-envelope/1","hints":{…},"record":"…","sig":{…}}`
plus an optional `"vk"`. `sig` is one of:

- a SPEC-BPQ-1 §3b detached signature (`{at,bpq,dsa,file,id,kind,sig,succ}`). `vk` is
  FORBIDDEN with it (the signature carries its key and its id commits to it). Second
  verifier: `bsigner bpq-verify --file SIG --target RECORD`.
- a `bheart.signature/1` exactly as `bsigner sign` writes it, the exact field set
  `{agility, alg, content{bytes, digest{alg,b64u,bytes}}, key_id, signature{alg,b64u,bytes},
  signed_at_ms, type}` and nothing else. It is ML-DSA-65 over the RAW record bytes, empty
  context, no domain prefix; `signed_at_ms` and `agility` are NOT covered by the
  signature, so they say nothing. `vk` (base64url of the 1952-byte verifying key) is
  REQUIRED. Before any lattice math: `type` is `bheart.signature/1`; `alg` and
  `signature.alg` are `ml-dsa-65`; `key_id` is `bheart-` + the first 16 characters of
  base64url(SHA3-256(UTF-8 `ml-dsa-65` ‖ vk)) (bsigner `derive_key_id`); `content.bytes`
  and `digest.bytes` are the record length; `digest.alg` is `sha3-256` and `digest.b64u`
  the record's SHA3-256; `signature.bytes` is 3309 and so is the decoded signature. The
  signer id is the `mldsa65:` id of `vk`. Second verifier: `bsigner verify --key-id K
  --file RECORD --envelope SIG --keydir TMP`, where TMP holds only a public-only keyset
  `K.json` = `{type:"bheart.keyset/2", kind:"signature", alg:"ml-dsa-65", key_id:K,
  verifying_key_b64u}` written from `vk`; stdout must say `verified:true` and `key_id:K`
  with exit 0 (a verdict that disagrees with the exit status is an error, not a vote).
  **Relied on, not frozen:** the frozen bsigner reads that keyset by `type` and `kind`
  and then the public key only (`read_keyset`, `load_dsa_public`); CONTRACT.md does not
  promise that a keyset with no sealed seed is accepted. A bsigner change there turns
  every bheart release into `verifier_failed` (refused, never accepted).

Authority is the full public key and the exact record bytes. A signer is named only by
`mldsa65:` SHA3-256(vk) (or its `bzpq1…` id); `key_id` is checked only as consistency with
`vk` and is never a pin or a signer id (a `bheart-…` key id in `signers` or
`genesis_signers` is refused). **`signed_at_ms` is unauthenticated and ignored**: it feeds
no authorization, freshness, ordering, revocation or report, and two signatures that differ
only in it are the same verdict by the same signer (0 and year 9999 included). Its only rule
is the shape every integer here has (a non-negative integer a JavaScript reader holds
exactly). The two profiles never fall back to each other: an object with `type` is read
only as bheart.signature/1 and one without only as §3b, each with its exact field set, so a
bheart object with `type` removed, or a §3b object with `type` added, is refused.
`tests/vectors/profile-separation.json` holds those cases; keys-door's tests and
`tools/keychain-release/test/bheart.test.mjs` must reach the same verdict on each.

## The bsigner pin

`bsigner_sha256` (required) is the base64url SHA-256 of the exact bsigner build at
`bsigner_path`. keys-door hashes the file at startup (a mismatch, or an unfilled pin,
refuses to start), before every bsigner spawn, and at every poll: a binary swapped under a
running edge refuses every new release as `bsigner_pin_mismatch`, on health, and what it
already serves stays served (as with an unreadable floor). The file is hashed, then run by
path, so a swap inside that window is not caught. The image records its bsigner's pin in
`/usr/local/share/keys-door/bsigner.sha256` and the label
`org.beehive-nature.bsigner.sha256` (ops/keys-edge/Dockerfile).

The pin is **version-specific compatibility, not a guarantee of bsigner's frozen
interface.** `bsigner_public_only_keyset_compatibility` in `src/tests.rs` runs the pinned
binary through public-only keysets case by case and prints each raw stdout and exit (CI
runs it with `--nocapture`). It also records what the pinned build does NOT check: it
accepts a keyset carrying sealed or other extra fields, and one whose `alg` is
`ml-dsa-87` (verify dispatches on the envelope's alg). keys-door's keyset writer
(`verify::public_keyset`) refuses both, before anything is written or spawned. Changing
bsigner means re-running that suite against the new build and pinning it anew.

Kept evidence is never deleted, at any seq and under any config (an envelope the config
cannot parse is refused in the pool and stays on disk). So a fork whose branches both
continue holds the edge for good, below the floor too, as rule 5 says.

A floor or evidence store that is there and cannot be read refuses every new release
until it is repaired: that poll reads no rail and fetches, keeps and swaps nothing, and
the edge never rewrites a floor it cannot read. A release already served stays served
(it was accepted while both could be read). After a restart nothing is served, so an
edge with nothing served yet (fresh or just restarted) answers 503 until it is repaired.

Sources, all untrusted: the serve state, `inbox_dir/*.json` (≤ 256 per poll), peer edges,
ANT doors (`GET <door>/v1/data/public/<addr>`, address from the envelope's unsigned
hints), Arweave GraphQL (owner filter required).

Peers (§7 A1). Every configured peer is walked through its own chain endpoint
`/.well-known/bnr-keychain/release/<seq>` from the served seq + 1 (genesis when nothing
is served), one seq at a time until 404, whatever another peer holds above it, so a
valid record that conflicts with one from elsewhere reaches the pool and rule 5. Each
envelope is checked on its own as the one after the record before it (seq, prev, a
signer that record lists, both verifiers); the first that fails ends that peer's walk
and nothing above it is fetched. A peer's claim of its current (its bare `/release`) is
never read. Each peer has its own budget per poll (64 requests, about 2 MiB), so one
long chain never starves another peer. What a walk verified of a peer's chain above
the served record (≤ 8 MiB of envelopes per peer) is held, and the next poll resumes
past it; a peer that no longer answers it (the record above does not select it, or the
record its chain ended at is gone or different) is walked again from the served
seq + 1 in the same poll, with a note. A peer's `/pack` is its current pack, so it is
asked only for the record that peer's chain ended at (a peer named in an envelope's
hints: only for the walk's final target), and taken by hash only. A fresh edge
configured with peers only resumes from genesis. Not seen: a peer's records at or below
the served seq are never fetched (A1 starts above it), so a peer whose chain parts from
this edge's there shows only as a refused link at the served seq + 1, or not at all
when it has nothing above it; and a source that withholds a branch hides it.

Serving: GET/HEAD only (else 405), `/` is index.html, unknown path 404, 503 until a
release verifies (except `/.well-known`). `/.well-known/bnr-keychain/release` is the
current envelope, `/release/<seq>` the verified envelope of every seq 1..current (plain
decimal, no leading zero; 404 for 0 or above current), `/pack` the current pack. Health
JSON `{seq, record_sha3, state, equivocation, last_error}` answers on `health_listen`
only.

    keys-door serve  --config edge.toml
    keys-door verify --config edge.toml --envelope FILE   # offline verdict JSON; exit 0 accept, 1 refuse
    keys-door --version                                   # crate version + build commit

`--version` prints `keys-door <version> (commit <sha>)`, the commit being what
`KEYS_DOOR_COMMIT` named at build time (`KEYS_DOOR_COMMIT=$(git rev-parse HEAD) cargo
build --release --locked`), else `unknown`.

`bsigner_path = ""` refuses to start: two verifiers are mandatory. The only stand-in
for bsigner is `#[cfg(test)]`, so no release build can select it.

Tests (WSL; the bsigner-gated tests fail, never skip, without `KEYS_DOOR_BSIGNER`;
CI runs the same in `.github/workflows/keys-door.yml`):

    cargo build --locked -p bsigner --target-dir ~/kd-bsigner-target   # repo root
    KEYS_DOOR_BSIGNER=~/kd-bsigner-target/debug/bsigner cargo test      # here

The bheart test makes its key with the real `bsigner keygen --alg ml-dsa-65 --rec-env V`
(V = the public BIP-39 test phrase, 23 × `abandon` then `art`) and signs with `bsigner
sign --rec-env V`, in a temporary keydir; nothing is committed from it.

`tests/vectors/bpqjs-genesis.json` is a release signed by `surfaces/bpq.js`; regenerate
with `node ops/keys-door/tests/vectors/make-bpqjs-vector.mjs` from the repo root.
