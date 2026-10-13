# keychain-release

Release records for the isolated keychain at keys.skaists.dev (`bnr.keychain-release/1`). A record names every byte an edge may serve, by size, SHA-256 and SHA3-256, and the post-quantum ids allowed to sign the next record. Bytes travel on any rail; they are accepted by hash only.

## release.mjs

- `prepare --out DIR [--seq N] [--prev RECORD] [--signers id,...] [--commit SHA]` runs `node scripts/build-keychain.mjs --out <tmp>` and drops `CNAME` and `.nojekyll`. It writes `DIR/record.json` (canonical JSON), `DIR/pack.bin` (the files in record order) and `DIR/site/`.
  - It refuses when a build input in the working tree is not its bytes at the commit, when the built `keychain.js` is not `keychain/keychain.js`, or when a signer is the law key.
  - Without `--signers` it reads `docs/KEYCHAIN-RELEASE-SIGNERS.json`.
- `check DIR` strict-parses the record and checks `DIR/site` and `pack.bin` against it. It then rebuilds from `source.commit` (the build inputs read out of git) and requires the files, the record and the pack to be byte-identical.
  - It runs the build script as it was at that commit, so check only records whose commit you would build.
- `sign-test [--profile bpq|bheart] [--record R --out SIG] [--vk-out FILE] [--seed S] --i-understand-this-is-a-test-key` is **test only**. A throwaway ML-DSA-65 key, made in the process, writes a SPEC-BPQ-1 §3b detached signature (`bpq`, the default) or a `bheart.signature/1` (`bheart`, signed with noble the way `bsigner sign` signs; `--vk-out` writes its verifying key as base64url). It prints the throwaway id.
- `import-sig --sig FILE --out RELSIG` takes a signature as its signer wrote it (`bsigner sign --out` pretty-prints), holds it to its exact field set and writes its one byte form. It verifies nothing.
- A signature file has one byte form: canonical JSON (the record's canon), no trailing newline. release.mjs, anchor.mjs and probe.mjs refuse any other spelling of it. An envelope's `sig` re-serializes to exactly those bytes, so an anchor's `sig.sha3` can be recomputed from the file or from an envelope.
- `envelope --record R --sig S [--vk FILE|B64U] [--hint-ant A] [--hint-ar T]... [--hint-hive BLOCK:TRX] [--hint-peer URL]... [--out FILE]` builds the transport envelope. Its hints are unsigned and advisory, and it is at most 64 KiB.
- `verify --record R --sig S [--vk FILE|B64U] [--signers id,...] [--prev R0] [--genesis-sha3 B | --no-genesis-pin]` applies edge rules 1 to 3:
  - a strict record for this origin;
  - a valid signature (one implementation, noble; the edge runs two);
  - at seq 1, a signer from `--signers` and the record's SHA3-256 equal to `--genesis-sha3`. Without the pin there is no verdict on the chain.
  - at seq N > 1, only as `R0.seq + 1`, with `prev` naming `R0` and a signer that `R0` names. There, `--signers` only narrows.
  - `--no-genesis-pin` (seq 1 only) checks the signature and the genesis signer and nothing else. When those hold it exits 3, not 0, and the JSON says `"ok":false` and `"signature_ok":true`, never `"ok":true`. Exit 0 is only ever `"ok":true`, so `verify ... && next` never takes a signature-only check for a pass. A refusal exits 1.
- `place --dir DIR --record R --sig S [--envelope E] [--vk FILE|B64U] --signers id,... --genesis-sha3 B` verifies every release already placed under `DIR/keychain/releases/`, from the genesis pin, each `envelope.json` included, and then R as the next one. It writes `DIR/keychain/releases/<seq>/` with `record.json`, `record.json.relsig.json` and `envelope.json` (E if given, which must carry R and S exactly; else an envelope with no hints).
  - A seq directory that already exists with other bytes is refused, never rewritten. The same bytes again change nothing.
  - The layout (contract §7 A2) is read by one reader, `readPlaced`, which `probe.mjs` uses too. `keychain/releases/` holds only `<seq>/` directories, named by the record's seq in plain decimal (`1`, never `0001`), seq 1 to N with no gap. Each holds those three files and nothing else, and its `envelope.json` carries exactly the record and signature beside it. Anything else refuses the whole chain, in place and in the probe.
  - place writes into a `.place-<seq>-*` directory and renames it into place. One left behind by a crash between the two is refused by name and never read as placed. Remove it by hand.

## Signature profiles

Two profiles are accepted, here and at the edge (`ops/keys-door`, which runs two ML-DSA-65 implementations on each):

- **SPEC-BPQ-1 §3b** detached signatures (`{at,bpq,dsa,file,id,kind,sig,succ}`), signer id `bzpq1…`. The envelope carries no `vk`; one there is refused.
- **`bheart.signature/1`**, exactly as the frozen `bsigner sign --rec-env VAR --key-id ID --file record.json --out sig.json` writes it: the exact field set `{agility, alg, content{bytes, digest{alg,b64u,bytes}}, key_id, signature{alg,b64u,bytes}, signed_at_ms, type}`. It is ML-DSA-65 over the RAW record bytes, empty context, no domain prefix. `signed_at_ms` and `agility` are not covered by the signature and say nothing: **`signed_at_ms` is unauthenticated and ignored** (no authorization, freshness, ordering, revocation or report reads it; `verify` prints no time for a bheart release). Authority is the full public key and the exact record: `key_id` is only checked against `vk`, never a pin or a signer id. The profiles never fall back to each other (a bheart object without `type`, or a §3b object with one, is refused); `ops/keys-door/tests/vectors/profile-separation.json` holds the cases both readers are tested on. Its verifying key travels as the envelope's `vk` (base64url of the 1952-byte key), which is REQUIRED with it. Checked before any lattice math: `type`; `alg` and `signature.alg` are `ml-dsa-65`; `key_id` is `bheart-` + the first 16 characters of base64url(SHA3-256(`ml-dsa-65` ‖ vk)) (bsigner `derive_key_id`); `content.bytes` and `digest.bytes` are the record length; `digest.alg` is `sha3-256` and `digest.b64u` the record's SHA3-256; the signature is 3309 bytes. The signer id is `mldsa65:` + base64url without padding of SHA3-256(vk), 43 characters.

`record.signers`, the genesis signers and `docs/KEYCHAIN-RELEASE-SIGNERS.json` may name either id form. Rotation between the profiles is a record whose `signers` name the other form. `--vk` takes the base64url text, or a file holding it, the raw 1952 bytes, or a JSON object with `verifying_key_b64u` (what `bsigner keygen` prints). A placed bheart release keeps its `vk` in `envelope.json` only; `place` and `probe.mjs` read it from there.

For a release signed with bsigner: `bsigner sign … --out sig.json`, then `release.mjs import-sig --sig sig.json --out record.json.relsig.json`, then `envelope`/`place` with `--vk`.

The edge's second verifier for this profile is `bsigner verify --key-id K --file record.json --envelope sig.json --keydir TMP`, where TMP holds only a PUBLIC-ONLY keyset `K.json` = `{type:"bheart.keyset/2", kind:"signature", alg:"ml-dsa-65", key_id:K, verifying_key_b64u}`. **This relies on how the frozen bsigner reads a keyset** (`read_keyset` checks `type` and `kind`, `load_dsa_public` then reads `alg` and the public key only). `crates/bsigner/CONTRACT.md` does not promise it. A bsigner that starts demanding the sealed seed for `verify` makes every bheart release fail closed at the edge (refused, never accepted).

## anchor.mjs

`sig.bpq` keeps its name in either profile: it carries the signer id, a `bzpq1…` id or an `mldsa65:` id. `build` and `verify --record/--sig` take `--vk` for a bheart release; `verify --envelope` reads the envelope's `vk`.

- `build --record R --sig S [--vk FILE|B64U] --prev-json FILE --seq N [--loc L]... [--out FILE]` builds the canonical ASCII anchor json and the `custom_json` op (`bnr.anchor`, posting auth `loviswater`). FILE holds the exact previous anchor json string; for seq 1 it must be the pinned genesis.
  - **The anchor seq is the record seq.** The genesis anchor is seq 0, so the record with seq 1 anchors as seq 1, seq 2 as seq 2, and so on. `build` refuses any other `--seq`, and `verify` never counts an anchor whose seq differs from its record's.
- `genesis [--nodes ...] [--out FILE]` reads the genesis anchor (block 108404167) from every node and prints its SHA3-256. `--out` writes the bytes only when two operators agree and the bytes are the pin.
- `verify [--account A] [--subject S] [--nodes ...] [--record R --sig S [--vk FILE|B64U] | --envelope E]` is a quorum reader. It reports a class per anchor and for the release: ANCHORED-TERMINAL, ANCHORED-AS-REPORTED, SIGNED-UNANCHORED, DIVERGENT or INCONCLUSIVE. Anchors are classical witnesses, so the class is reported and never gates serving.
  - An operator is its scheme, host and port. `--nodes` is normalized and deduplicated, so one operator listed twice is one vote. That includes a fully qualified name's trailing dot: `https://api.hive.blog.` is `https://api.hive.blog`. A host with an empty label is refused.
  - The chain starts only at the pinned genesis: block 108404167, trx `7d404d75…`, json SHA3-256 `O4n0MUUDIN24chEO6f07XnGXUgFlqi16PauvsAp0zUs`, and ANCHORED-TERMINAL. The same 620 bytes posted again later (block 108460005) are reported under `genesis_repeats` and never start a chain.
  - A DIVERGENT anchor never links into the chain and never becomes its head. Every DIVERGENT anchor is listed under `divergent`.
  - Forks are looked for in every reading of every anchor. That includes DIVERGENT anchors, and each operator's own bytes for an op whose bytes are in dispute. One operator that omits or alters one side of an equivocation therefore cannot hide the fork and choose the head. It can stop the chain (a fork, no head), never pick its head.
  - An anchor names the release only when its `rec` digests, its `sig.bpq`, its `sig.sha3` and its seq all match. An anchor of the same record with another signer or another signature file is listed under `same_record_other_anchors` and is not this release's anchor.

## R-SIGNER

The release signer is unruled. `docs/KEYCHAIN-RELEASE-SIGNERS.json` stays empty until the founder names it, so `prepare` without `--signers` refuses, and no real release signature exists in this repository.

The release signer is never the law key in `docs/PQ-SIGNERS.json`. It is never derived from the skaists.dev wallet passkey either: any `*.skaists.dev` origin can assert that rpId and re-derive it.

A signature file is `record.json.relsig.json`, never `.bpqsig.json`, so the law gate never reads a release as law.

Tests: `node --test 'tools/keychain-release/test/*.test.mjs'`. With `BSIGNER` set to a bsigner binary, `test/bheart.test.mjs` also cross-checks noble against bsigner (bsigner-made signatures verify in noble, noble-made ones in `bsigner verify`); without it that one test prints `NOT RUN` and is skipped.
