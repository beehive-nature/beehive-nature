# keys-door — the keychain edge for keys.skaists.dev

Keyless resolver, verifier and server (contract: keychain release + edge, 2026-10-12,
§1-§4 and §7 A1). It holds no key and signs nothing. It serves only the bytes a
`bnr.keychain-release/1` record names, and only after:

1. the envelope (≤ 64 KiB) and record parse strictly: canonical JSON, no duplicate key,
   no unknown or missing field; schema, kind, origin and rp_id equal the config;
2. the SPEC-BPQ-1 §3b signature verifies in BOTH ML-DSA-65 implementations, the
   `fips204` crate in-process and `bsigner bpq-verify` as a subprocess. Disagreement
   is refused and reported on health as `verifier disagreement`;
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

Peers (§7 A1). A peer is walked through its chain endpoint
`/.well-known/bnr-keychain/release/<seq>` from the highest record this edge holds
verified (the served one, or past the verified records above it that a walk cut short
left in memory; genesis when nothing is held), one seq at a time until 404. Each
envelope is checked on its own as the one after the record before it (seq, prev, a
signer that record lists, both verifiers); the first that fails ends that peer's walk
and nothing above it is fetched. A peer's claim of its current (its bare `/release`) is
never read. One poll's walk spends at most 64 requests and about 2 MiB over all peers;
the verified records above the served one (≤ 64 MiB of envelopes) are held in memory,
so the next poll resumes where the budget stopped. A peer's `/pack` is its current
pack, so it is asked only for the record that peer's chain ended at (a peer named in an
envelope's hints: only for the walk's final target), and taken by hash only. A fresh
edge configured with peers only resumes from genesis. A peer whose chain parts from
this edge's at or below the record the walk starts from shows as a refused link in the
notes; its other branch is not walked back.

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

`tests/vectors/bpqjs-genesis.json` is a release signed by `surfaces/bpq.js`; regenerate
with `node ops/keys-door/tests/vectors/make-bpqjs-vector.mjs` from the repo root.
