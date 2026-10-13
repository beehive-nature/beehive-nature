# keychain-release

Release records for the isolated keychain at keys.skaists.dev (`bnr.keychain-release/1`). A record names every byte an edge may serve, by size, SHA-256 and SHA3-256, and the post-quantum ids allowed to sign the next record. Bytes travel on any rail; they are accepted by hash only.

## release.mjs

- `prepare --out DIR [--seq N] [--prev RECORD] [--signers id,...] [--commit SHA]` runs `node scripts/build-keychain.mjs --out <tmp>` and drops `CNAME` and `.nojekyll`. It writes `DIR/record.json` (canonical JSON), `DIR/pack.bin` (the files in record order) and `DIR/site/`.
  - It refuses when a build input in the working tree is not its bytes at the commit, when the built `keychain.js` is not `keychain/keychain.js`, or when a signer is the law key.
  - Without `--signers` it reads `docs/KEYCHAIN-RELEASE-SIGNERS.json`.
- `check DIR` strict-parses the record and checks `DIR/site` and `pack.bin` against it. It then rebuilds from `source.commit` (the build inputs read out of git) and requires the files, the record and the pack to be byte-identical.
  - It runs the build script as it was at that commit, so check only records whose commit you would build.
- `sign-test [--record R --out SIG] [--seed S] --i-understand-this-is-a-test-key` is **test only**. A throwaway ML-DSA-65 key, made in the process, writes a SPEC-BPQ-1 §3b detached signature. It prints the throwaway id.
- A signature file has one byte form: canonical JSON (the record's canon), no trailing newline. release.mjs, anchor.mjs and probe.mjs refuse any other spelling of it. An envelope's `sig` re-serializes to exactly those bytes, so an anchor's `sig.sha3` can be recomputed from the file or from an envelope.
- `envelope --record R --sig S [--hint-ant A] [--hint-ar T]... [--hint-hive BLOCK:TRX] [--hint-peer URL]... [--out FILE]` builds the transport envelope. Its hints are unsigned and advisory, and it is at most 64 KiB.
- `verify --record R --sig S [--signers id,...] [--prev R0] [--genesis-sha3 B | --no-genesis-pin]` applies edge rules 1 to 3:
  - a strict record for this origin;
  - a valid signature (one implementation, noble; the edge runs two);
  - at seq 1, a signer from `--signers` and the record's SHA3-256 equal to `--genesis-sha3`. Without the pin there is no verdict on the chain.
  - at seq N > 1, only as `R0.seq + 1`, with `prev` naming `R0` and a signer that `R0` names. There, `--signers` only narrows.
  - `--no-genesis-pin` (seq 1 only) checks the signature and the genesis signer and nothing else. It exits 0 when those hold, but the JSON says `"ok":false` and `"signature_ok":true`, never `"ok":true`.
- `place --dir DIR --record R --sig S [--envelope E] --signers id,... --genesis-sha3 B` verifies every record already placed under `DIR/keychain/releases/`, from the genesis pin, and then R as the next one. It writes `DIR/keychain/releases/<seq>/` with `record.json`, `record.json.relsig.json` and `envelope.json` (E if given, which must carry R and S exactly; else an envelope with no hints).
  - A seq directory that already exists with other bytes is refused, never rewritten. The same bytes again change nothing.

## anchor.mjs

- `build --record R --sig S --prev-json FILE --seq N [--loc L]... [--out FILE]` builds the canonical ASCII anchor json and the `custom_json` op (`bnr.anchor`, posting auth `loviswater`). FILE holds the exact previous anchor json string; for seq 1 it must be the pinned genesis.
  - **The anchor seq is the record seq.** The genesis anchor is seq 0, so the record with seq 1 anchors as seq 1, seq 2 as seq 2, and so on. `build` refuses any other `--seq`, and `verify` never counts an anchor whose seq differs from its record's.
- `genesis [--nodes ...] [--out FILE]` reads the genesis anchor (block 108404167) from every node and prints its SHA3-256. `--out` writes the bytes only when two operators agree and the bytes are the pin.
- `verify [--account A] [--subject S] [--nodes ...] [--record R --sig S | --envelope E]` is a quorum reader. It reports a class per anchor and for the release: ANCHORED-TERMINAL, ANCHORED-AS-REPORTED, SIGNED-UNANCHORED, DIVERGENT or INCONCLUSIVE. Anchors are classical witnesses, so the class is reported and never gates serving.
  - An operator is its scheme, host and port. `--nodes` is normalized and deduplicated, so one operator listed twice is one vote. That includes a fully qualified name's trailing dot: `https://api.hive.blog.` is `https://api.hive.blog`. A host with an empty label is refused.
  - The chain starts only at the pinned genesis: block 108404167, trx `7d404d75…`, json SHA3-256 `O4n0MUUDIN24chEO6f07XnGXUgFlqi16PauvsAp0zUs`, and ANCHORED-TERMINAL. The same 620 bytes posted again later (block 108460005) are reported under `genesis_repeats` and never start a chain.
  - A DIVERGENT anchor never links into the chain and never becomes its head. Every DIVERGENT anchor is listed under `divergent`.
  - Forks are looked for in every reading of every anchor. That includes DIVERGENT anchors, and each operator's own bytes for an op whose bytes are in dispute. One operator that omits or alters one side of an equivocation therefore cannot hide the fork and choose the head. It can stop the chain (a fork, no head), never pick its head.
  - An anchor names the release only when its `rec` digests, its `sig.bpq`, its `sig.sha3` and its seq all match. An anchor of the same record with another signer or another signature file is listed under `same_record_other_anchors` and is not this release's anchor.

## R-SIGNER

The release signer is unruled. `docs/KEYCHAIN-RELEASE-SIGNERS.json` stays empty until the founder names it, so `prepare` without `--signers` refuses, and no real release signature exists in this repository.

The release signer is never the law key in `docs/PQ-SIGNERS.json`. It is never derived from the skaists.dev wallet passkey either: any `*.skaists.dev` origin can assert that rpId and re-derive it.

A signature file is `record.json.relsig.json`, never `.bpqsig.json`, so the law gate never reads a release as law.

Tests: `node --test 'tools/keychain-release/test/*.test.mjs'`.
