# keys-door — the keychain edge for keys.skaists.dev

Keyless resolver, verifier and server (contract: keychain release + edge, 2026-10-12, §1-§4).
It holds no key and signs nothing. It serves only the bytes a `bnr.keychain-release/1`
record names, and only after:

1. the envelope (≤ 64 KiB) and record parse strictly: canonical JSON, no duplicate key,
   no unknown or missing field; schema, kind, origin and rp_id equal the config;
2. the SPEC-BPQ-1 §3b signature verifies in BOTH ML-DSA-65 implementations, the
   `fips204` crate in-process and `bsigner bpq-verify` as a subprocess. Disagreement
   is refused and reported on health as `verifier disagreement`;
3. the record chains from the pinned genesis (`genesis_sha3` + `genesis_signers`), one
   seq at a time (prev hash + a signer from the previous record's `signers`);
4. its seq is ≥ `min_seq` and ≥ the persisted floor (`state_dir/floor`, its own file);
5. no equivocation is unresolved at its seq (two valid records, one seq: the edge
   stops until a valid seq+1 selects one branch);
6. the pack and every file match their size, SHA-256 and SHA3-256.

Sources, all untrusted: the serve state, `inbox_dir/*.json` (≤ 256 per poll), peer edges
(`/.well-known/bnr-keychain/release` and `/pack`), ANT doors (`GET <door>/v1/data/public/<addr>`,
address from the envelope's unsigned hints), Arweave GraphQL (owner filter required).

Serving: GET/HEAD only (else 405), `/` is index.html, unknown path 404, 503 until a
release verifies (except `/.well-known`). Health JSON `{seq, record_sha3, state,
equivocation, last_error}` answers on `health_listen` only.

    keys-door serve  --config edge.toml
    keys-door verify --config edge.toml --envelope FILE   # offline verdict JSON; exit 0 accept, 1 refuse

`bsigner_path = ""` refuses to start: two verifiers are mandatory. The only stand-in
for bsigner is `#[cfg(test)]`, so no release build can select it.

Tests (WSL; the bsigner-gated tests fail, never skip, without `KEYS_DOOR_BSIGNER`):

    cargo build --locked -p bsigner --target-dir ~/kd-bsigner-target   # repo root
    KEYS_DOOR_BSIGNER=~/kd-bsigner-target/debug/bsigner cargo test      # here

`tests/vectors/bpqjs-genesis.json` is a release signed by `surfaces/bpq.js`; regenerate
with `node ops/keys-door/tests/vectors/make-bpqjs-vector.mjs` from the repo root.
