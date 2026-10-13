# keychain-release

Release records for the isolated keychain at keys.skaists.dev (`bnr.keychain-release/1`). A record names every byte an edge may serve, by size, SHA-256 and SHA3-256, and the post-quantum ids allowed to sign the next record. Bytes travel on any rail; they are accepted by hash only.

## release.mjs

- `prepare --out DIR [--seq N] [--prev RECORD] [--signers id,...] [--commit SHA]` runs `node scripts/build-keychain.mjs --out <tmp>` and drops `CNAME` and `.nojekyll`. It writes `DIR/record.json` (canonical JSON), `DIR/pack.bin` (the files in record order) and `DIR/site/`.
  - It refuses when a build input in the working tree is not its bytes at the commit, when the built `keychain.js` is not `keychain/keychain.js`, or when a signer is the law key.
  - Without `--signers` it reads `docs/KEYCHAIN-RELEASE-SIGNERS.json`.
- `check DIR` strict-parses the record and checks `DIR/site` and `pack.bin` against it. It then rebuilds from `source.commit` (the build inputs read out of git) and requires the files, the record and the pack to be byte-identical.
  - It runs the build script as it was at that commit, so check only records whose commit you would build.
- `sign-test [--record R --out SIG] [--seed S] --i-understand-this-is-a-test-key` is **test only**. A throwaway ML-DSA-65 key, made in the process, writes a SPEC-BPQ-1 §3b detached signature. It prints the throwaway id.
- `envelope --record R --sig S [--hint-ant A] [--hint-ar T]... [--hint-hive BLOCK:TRX] [--hint-peer URL]... [--out FILE]` builds the transport envelope. Its hints are unsigned and advisory, and it is at most 64 KiB.
- `verify --record R --sig S [--signers id,...] [--prev R0] [--genesis-sha3 B]` applies edge rules 1 to 3:
  - a strict record for this origin;
  - a valid signature (one implementation, noble; the edge runs two);
  - at seq 1, a signer from `--signers` (and the genesis pin, if given);
  - at seq N > 1, only as `R0.seq + 1`, with `prev` naming `R0` and a signer that `R0` names. There, `--signers` only narrows.

## anchor.mjs

- `build --record R --sig S --prev-json FILE --seq N [--loc L]... [--out FILE]` builds the canonical ASCII anchor json and the `custom_json` op (`bnr.anchor`, posting auth `loviswater`). FILE holds the exact previous anchor json string.
- `genesis [--nodes ...] [--out FILE]` reads the genesis anchor (block 108404167) from every node and prints its SHA3-256. `--out` writes the bytes, only when two operators agree.
- `verify [--account A] [--subject S] [--nodes ...] [--record R --sig S]` is a quorum reader. It reports a class per anchor and for the release: ANCHORED-TERMINAL, ANCHORED-AS-REPORTED, SIGNED-UNANCHORED, DIVERGENT or INCONCLUSIVE. Anchors are classical witnesses, so the class is reported and never gates serving.

## R-SIGNER

The release signer is unruled. `docs/KEYCHAIN-RELEASE-SIGNERS.json` stays empty until the founder names it, so `prepare` without `--signers` refuses, and no real release signature exists in this repository.

The release signer is never the law key in `docs/PQ-SIGNERS.json`. It is never derived from the skaists.dev wallet passkey either: any `*.skaists.dev` origin can assert that rpId and re-derive it.

A signature file is `record.json.relsig.json`, never `.bpqsig.json`, so the law gate never reads a release as law.

Tests: `node --test 'tools/keychain-release/test/*.test.mjs'`.
