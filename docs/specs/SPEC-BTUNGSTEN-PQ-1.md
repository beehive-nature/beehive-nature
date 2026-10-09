# SPEC-BTUNGSTEN-PQ-1 — proof design for the post-quantum stack

Status: DESIGN, 2026-10-08. Seat 3 (Claude Code), founder order 2026-10-08
("build the Rust bTunGsTeN proofs for every algorithm in the full PQ-immunized
stack; Plonky3 and Schnorr next") with the founder's external review folded in
(handoff `handoff-2026-10-08-btungsten-pq-proofs`, synergy input). Umbrella:
SPEC-BTUNGSTEN-1 (result-class law, right-language law, formal-assurance
ladder, §receipt). Decoder of record for the objects under proof: SPEC-BPQ-1.

This document says, for every algorithm the stack uses, what we PROVE, what we
INHERIT from someone else's machine-checked proof, what we only TEST, and which
sabotage each gate must catch. Nothing here is a result. Every row stays
NOT-RUN until its own lane prints its own receipt in CI.

Wording ceiling (law 4): nothing in this program is ever described as stronger
than "sound by construction / isolated by design". A SAW `PROVEN` is a result
class (implementation equals specification over a stated domain), never a
security claim. A Plonky3 security figure is a number p3-security computed
under a named regime, never an adjective.

---

## §0 · The laws this design obeys (all already in force)

1. **Rust first.** The model is Rust; the battery drives the same Rust; SAW
   proves that Rust. No JS twin is built beside it. Where JS ships (the
   browser's `surfaces/bpq.js` over noble), it is an independent implementation
   the vectors must agree with, never the model.
2. **The proof reaches shipped code, or the receipt prints the gap.** A proof
   about a twin the product does not link is recorded as a proof about the
   twin. Each lane names the exact code path that ships and what covers it.
3. **Result classes stay separate.** TYPECHECK, CHECK-SAMPLED, PROVE-UNIVERSAL
   and EQUIVALENCE (SPEC-BTUNGSTEN-1), plus three this program adds:
   - **KAT** — official known-answer vectors (NIST ACVP/CAVP, IETF, BIP)
     reproduced byte for byte, every case executed and counted;
   - **DIFFERENTIAL** — two or more independent implementations and the
     Cryptol spec agree on random and constructed inputs;
   - **INHERITED** — a third party's machine-checked proof about code we ship,
     cited at a pinned commit. We did not prove it and never say we did.
   A missing tool, a skipped case, a timeout or an empty vector file is
   NOT-RUN, never success.
4. **Every gate has teeth.** A planted flaw the gate must convict, run in the
   same job. A gate whose sabotage control passes is red.
5. **Cite or stop.** Every claim about an upstream library (verified status,
   a fixed bug, a parameter) cites file:line at a pinned commit, or is marked
   UNVERIFIED and nothing downstream leans on it.
6. **Audit two gates** (law 3) for every new dependency, no `--ignore`.
7. **No mainnet act, no key material.** Proof lanes run on local and
   rehearsal chains only.

## §1 · The assurance ladder per algorithm

```
L0 INVENTORY      where it is used, which parameter sets and functions are exposed
L1 KAT            official vectors, every exposed parameter set x every exposed function
L2 DIFFERENTIAL   shipped impl == independent impl == Cryptol spec
L3 SPEC           Cryptol spec from the standard (upstream spec at a pin, or ours),
                  constants derived from their definitions, not transcribed
L4 EQUIVALENCE    SAW: OUR glue (encodings, domain separation, combiners,
                  derivations, parsers) == spec, for every input in the stated domain;
                  plus small primitive cores of the SHIPPED crate where SAW closes
L5 PROVE          the protocol property (injectivity, domain separation, binding)
                  for the accepted language the runtime validator actually enforces
TEETH             at L1, L2, L4 and L5
```

The partition, stated once:

- **Big arithmetic** (NTT and ring multiplication, curve groups, full
  permutations end to end) is INHERITED where a verified implementation exists
  and DIFFERENTIAL everywhere. We do not re-prove lattice arithmetic.
- **Our glue** is where this estate's own bugs have lived (the UTF-16
  surrogate collision, the bind claim-stripping via `at`, the inverted count
  selector, the detach-owner fidelity bug). All of it gets L4 and, where a
  property is claimed, L5.
- **Small primitive cores of the shipped crate** (one Keccak-f round, an NTT
  butterfly, Barrett and Montgomery reductions, one Poseidon2 round) get L4
  against the spec when SAW closes on them, because those are the cores the
  rest of the arithmetic is built from.

## §2 · Teeth templates (the Vortex review becomes the standard sabotage set)

Vortex (`distributed-lab/vortex-rs` at `3c0affd9320a`) stays OUT of the stack.
Its two flaws, confirmed in source at that pin, become the two universal
sabotage templates every lane must apply to its own code:

- **T-VACUOUS: a verifier must refuse the degenerate shape.**
  vortex `src/lib.rs:195-262`: `verify()` checks a Merkle path for each entry
  of `proof.columns` and never compares that count to
  `params.num_columns_to_open`, so a proof with zero opened columns runs the
  loop zero times and only the `beta_y == ux` equation remains, which the
  prover satisfies alone. The count is not vortex's only gap: the positions
  it opens, `proof.column_ids` (`lib.rs:38`, read at `:241`), also come from
  the prover and are never sampled. So the companion rule rides with this
  template: positions to open come from the verifier's transcript, never
  from the proof. Applied here as: every verifier, aggregator and gate
  we write or wrap is fed its zero shape (no openings, no queries, no rounds,
  no partial signatures, an empty manifest, an empty vector file, an empty
  PSBT) and must refuse. Plonky3 already refuses the FRI forms upstream
  (`fri/src/verifier.rs:507` refuses `num_queries == 0`, `:657` compares each
  round's opening count to `params.num_queries`, at `eab7f0e`); our obligation
  is that `params` come from OUR pinned config, never from the proof.
- **T-TRUNCATE: a hash must depend on every input position.**
  vortex `src/sis.rs:224-228`: on any build without AVX-512, `hash()` calls
  `inner_hash(res, &mut v.iter(), i, ..)` once per polynomial chunk with a
  FRESH iterator each time, so every chunk re-reads the first 256 elements and
  everything after them is ignored; any two inputs that agree on their first
  256 elements collide. Applied here as: every hash, absorb, encoder and
  key-derivation input we ship is tested at lengths straddling every block and
  rate boundary (0, 1, r-1, r, r+1, 255, 256, 257, 4096, ...) by changing only
  the LAST element and requiring the output to change; where the function is
  in SAW scope, L4 equivalence to a spec that consumes all input closes the
  class universally.

The templates are validated against the real defect before they guard
anything: a standalone crate outside the workspace
(`scripts/btungsten/teeth-vortex/`, own lockfile, never in the default build)
runs T-VACUOUS against vortex `verify()` and T-TRUNCATE against vortex
`RSis::hash()` at the pin, on a non-AVX-512 target, and both MUST convict.
If either template passes vortex, the template is broken and every gate using
it is red.

Lane-specific teeth are named per lane below.

## §3 · Inventory (L0)

| # | algorithm | standard | where it is used | exposed sets / functions | ships as | L1 today |
|---|---|---|---|---|---|---|
| A1 | SHA3-256/512, SHAKE128/256 | FIPS 202 | bzpq1 id, succession commit, X-Wing combiner and seed, sealed-object AAD and key commit, inside ML-KEM/ML-DSA/SLH-DSA | all four | RustCrypto `sha3`; noble | none |
| A2 | SHA-256, SHA-512, HMAC, HKDF | FIPS 180-4, RFC 2104, RFC 5869 | bpq key derivation (§2), sealed-object wraps, OpenTimestamps, BIP-340 tags, Ed25519 | SHA-256, SHA-512, HKDF-SHA-256 | RustCrypto `sha2`/`hkdf`; libcrux-sha2 (WB001) | none |
| A3 | AES-256-GCM | SP 800-38D | sealed-object segments, META, SEAL, key slots | 256-bit key, 96-bit nonce | RustCrypto `aes-gcm` | none |
| A4 | ML-KEM | FIPS 203 | X-Wing (768); bsigner exposes 512/768/1024 (`alg.rs:52-61`) | keyGen, encaps, decaps, both key checks | RustCrypto `ml-kem 0.3` (unaudited); noble | 768 keyGen + decap only |
| A5 | X-Wing | draft-connolly-cfrg-xwing-kem (revision UNVERIFIED) | seal-to-me, QR bridge v2 | one set | bpq.rs over A1, A4, A8 | none |
| A6 | ML-DSA | FIPS 204 | card, bind, detached, seal, cosign target, atmirror `keyAlg`, device; bsigner exposes 44/65/87 (`alg.rs:34-43`) | keyGen; sigGen (Rust: deterministic, empty context; browser: hedged, `bpq.js:194` passes no options and noble then adds 32 random bytes); sigVer | RustCrypto `ml-dsa 0.1` (unaudited); noble | 65 keyGen + sigVer only |
| A7 | SLH-DSA-SHAKE-256f | FIPS 205 | succession key (SPEC-BPQ-1 §2, §5) | keyGen, sigGen, sigVer | noble; since PQ07 also fips205 0.4.1 in bsigner (`bpq::succession_keys`, handover v1) | none at design time; PQ01 ACVP, PQ07 browser cross-check |
| A8 | X25519 | RFC 7748 | X-Wing classical half, QR bridge | one | `x25519-dalek 2` | none |
| A9 | Ed25519 | RFC 8032 | bzDiD record key, cosign, atmirror | sign, verify (strict) | libcrux-ed25519 (HACL*), dalek | DONE in WB001 (24/24 three-way + RFC) |
| A10 | ECDSA secp256k1 | SEC 1, Antelope canonical form | Vaulta K1 (`bnr-keys`), Arweave 2.9 keys, EVM rails, atproto ES256K (low-S, `crates/atmirror/src/commit.rs:5-7`) | sign (RFC 6979), verify, recover | `k256 0.13`; noble/eosjs | none |
| A10b | ECDSA P-256 | FIPS 186-5 | atproto ES256 (low-S, same file) | verify | `p256 0.13` | none |
| A11 | BIP-340 Schnorr | BIP-340 | FROST output, Taproot rails, Buzz events (block/buzz `crates/buzz-core/src/verification.rs:11` at upstream `8af2d91f`, as cited by the stack inventory; not checked out here, UNVERIFIED) | sign, verify | `k256`; chilldkg-rs; noble | none |
| A12 | BIP-39 | BIP-39 | the 24 recovery words = masterPrk | 256-bit entropy <-> 24 words, checksum | `surfaces/onboarding/bzdid-key.js` (@scure/bip39); since PQ11 also bsigner (`bip39.rs` over bpq-core's packing). At design time no Rust BIP-39 existed; the bech32m `bdidrec` recovery code is a different encoding | none at design time; PQ11 SAW + browser cross-check |
| A13 | FROST3 + ChillDKG | BIP-FROST-signing, BIP-FROST-DKG | threshold BIP-340 payload signer behind bSiGner (new) | DKG, nonce, partial sign, aggregate, recovery | `olegfomenko/chilldkg` `afeafbc7f9df` (README: "not been audited"), `olegfomenko/frost-wallet` `20b25cd73a2c` | upstream vectors only |
| A14 | Poseidon2 | Poseidon2 paper; Plonky3 | in-AIR receipt tree (new) | KoalaBear width 16 | Plonky3 `eab7f0e` | none |
| A15 | Plonky3 STARK | ethSTARK / FRI / Plonky3 | receipt count statement (replaces PLONK/BN254) | uni-stark, HidingFriPcs | Plonky3 `eab7f0e` (0.8.0) | none |
| A16 | EcGFp5 Schnorr | Pornin 2022 | STARK-friendly Schnorr verified inside Plonky3 (later) | sign, verify, in-AIR verify | none yet | none |

Retained classical, by design: A8 (X-Wing holds while either half holds),
A9, A10, A10b, A11, A12 (BIP-39 is an encoding, hash-only).

Pins that were only listed through the GitHub API on 2026-10-08, contents
not yet read by this seat (cryptol-specs `d0647fa970db`, Foundation
`7d0528bd9986`, libcrux `42d68bd49b24`, the X-Wing draft): UNVERIFIED until
the lane that uses them vendors and reads them (law 5). They get correctness
proofs here, never a PQ label.

## §4 · Lanes, in build order

Each lane lands as: crate code + Cryptol (`scripts/btungsten/<lane>-cryptol/`)
+ SAW (`scripts/btungsten/<lane>-saw/`) + a check script
`scripts/btungsten/<lane>-saw-check.sh` on the WB001 template + a CI job +
receipts in the README. Code homes:

- `crates/bpq-core` (`no_std`, no dependencies): the SAW targets that SHIP.
  `crates/bsigner/src/bpq.rs` is refactored to call it for every byte layout,
  so the proof reaches the code bsigner runs (law 2).
- `crates/btungsten-teeth`: the two §2 templates, no dependencies (so the
  Vortex build copy outside the workspace links it). Test code only.
- `crates/btungsten-pq`: the battery, the KAT and differential harnesses.
  Test code only.
- `crates/btungsten-p3count`: the Plonky3 receipt statement (PQ10).
- Upstream Cryptol specs are vendored per file with a PROVENANCE.md (sha256
  per file), specification files only. Their test files carry long hex
  literals and are fetched at the pin in CI instead.

### PQ00 · Teeth library + Vortex reproduction

The §2 templates as a generic Rust harness, proven against vortex first.
**Accept:** CI prints `T-VACUOUS convicts vortex verify: true`,
`T-TRUNCATE convicts vortex RSis::hash: true`, plus the colliding input pair;
`cargo tree -e normal` of every workspace crate shows no `vortex`.

### PQ01 · Official vectors for everything we expose (the 17 cases become all of them)

Today `surfaces/pq-kat.json` carries ML-DSA-65 keyGen + sigVer and ML-KEM-768
keyGen + decapsulation from ACVP-Server `975de31eb83d`, and its own
`notIncluded` list names the rest. The lane closes that list:

| algorithm | source (pinned) | groups |
|---|---|---|
| ML-KEM-512/768/1024 | ACVP-Server ML-KEM-keyGen / encapDecap FIPS203 | keyGen; encapsulation (deterministic, through the hazmat entry point); decapsulation; encapsulationKeyCheck; decapsulationKeyCheck |
| ML-DSA-44/65/87 | ACVP ML-DSA-keyGen / sigGen / sigVer FIPS204 | keyGen; sigGen deterministic, pure, with the empty context we sign under AND with non-empty contexts the verifier must handle; sigVer pure (external mu and HashML-DSA groups only if a path to them exists, else listed as unexposed) |
| SLH-DSA-SHAKE-256f | ACVP SLH-DSA-keyGen / sigGen / sigVer FIPS205 | all three, this parameter set (the only one exposed) |
| SHA3/SHAKE | CAVP SHA3 + SHAKE byte vectors | short, long, Monte Carlo, variable output |
| SHA-256/512, HMAC | CAVP SHAVS / HMACVS | short, long, Monte Carlo |
| HKDF-SHA-256 | RFC 5869 appendix A | all SHA-256 cases |
| AES-256-GCM | CAVP gcmEncryptExtIV256 / gcmDecrypt256 | 96-bit IV, all tag lengths we accept (only 128) |
| X25519 | RFC 7748 §5.2 + §6.1, Wycheproof x25519 | all |
| X-Wing | the draft's own vectors | all; the matching draft revision is recorded |
| ECDSA secp256k1 | Wycheproof ecdsa_secp256k1_sha256 (+ bitcoin variant) | all, with Antelope's canonical-signature filter as the verdict |
| BIP-340 | `bip-0340/test-vectors.csv` | all 19, negatives included |
| BIP-39 | trezor/python-mnemonic `vectors.json` | the 24-word English rows |
| FROST / ChillDKG | chilldkg-rs `tests/*_vectors.rs` at `afeafbc` | all ten files |

Rules: vector files are fetched at a pinned commit and refused unless their
sha256 matches the manifest (no 48+ hex literals enter the repo); every group
prints `executed N of N`; a group whose file parses to zero cases is red
(T-VACUOUS); a flipped expected byte in one case must turn the job red
(teeth). Shipped implementation AND each independent implementation run the
same cases (DIFFERENTIAL rides on KAT).

### PQ02 · SHA-3 / Keccak (everything PQ rests on it)

- L3: Foundation `algorithms/Keccak` + `algorithms/SHA3` (Apache-2.0) and
  GaloisInc/cryptol-specs `Primitive/Keyless/Hash/SHA3` at `d0647fa970db`.
  Foundation also ships SAW theorems for its Keccak spec
  (`algorithms/Keccak/theorems/*.saw`), reused as method, not as our receipt.
- L4: Keccak-f[1600] of the shipped crate's portable path, one round then the
  24-round permutation, EQUIVALENT to the spec; the sponge absorb loop and the
  SHAKE squeeze for the lengths the stack uses (32, 64, 96, 1088...).
- Teeth: one rotation offset changed (refuted with counterexample); T-TRUNCATE
  at every rate boundary of all four functions.
- **Accept:** `PROVEN keccak_round`, `PROVEN keccak_f1600`, `PROVEN absorb_<n>`
  for each stack length, teeth `Invalid: [`.
- **Built 2026-10-09** (keccak 0.1.6, the crate under sha3 0.10, so under
  bsigner's SHA3-256 and SHAKE256: every bzpq1 id, succession commitment,
  sealed-object hash and the X-Wing seed and combiner):
  - SPEC-CHECK: `pq02-cryptol/KeccakF1600.cry` derives the ρ offsets and
    round constants from FIPS 202's algorithms and is held to the Keccak
    team's zero-state lanes and FIPS 202's SHA3-256 of "" and "abc".
  - EQUIVALENCE, one round at a time: the crate's OWN generic round body
    (`keccak::keccak_p`, run once per constant through a harness lane type
    whose `KECCAK_F_ROUND_COUNT` is k+1 and whose operations are u64's own)
    equals FIPS 202 `keccakRound k` for every state, for all 24 constants
    (`pq02-saw/shipped.saw`); tooth: one ρ offset off by one, refuted.
  - Not machine-checked: that `p1600(s, 24)` (the u64 instantiation) runs
    those 24 bodies in order. That is the crate's loop
    (`for &rc in round_consts`, src/lib.rs:248), read. Every attempt to
    check it whole failed to close: the 24-round comparison against the
    spec (bitwuzla and z3 90 minutes; two rounds already past 24 minutes,
    because What4 reorders the Rust term's AND/XOR operands so no structure
    is shared across rounds), ABC's sweeping checker (memory), and a
    shipped-against-reference agreement run (bitwuzla in CI, ABC 50
    minutes). A harness copy of the round, composed by 24 overrides, did
    prove equal to `keccakF` (574 s locally), which shows the composition
    is sound for a separate function; it is not the shipped loop.
  - **keccak 0.2.2, 2026-10-09** (the Keccak under shake 0.1 for ml-dsa
    0.1.1 and under sha3 0.11 for ml-kem 0.3.2 and slh-dsa, per Cargo.lock):
    its round body (`backends::soft::keccak_p`, the backend
    `Keccak::with_backend` takes on x86_64 with no `keccak_backend` cfg) is
    crate-private, so `pq02-harness/harness022.rs` compiles the pinned
    crate's `consts.rs`, `types.rs` and `backends/soft.rs` verbatim, adding
    only the `Backend` trait with the one method soft.rs implements, and
    runs the body once per constant through a lane type whose `RC` is
    `[RC[k]]`. `pq02-saw/shipped022.saw`: equal to `keccakRound k` for every
    state, all 24 constants (CI run 37925287105, 17 s). Read, not proven:
    `keccak_p::<u64, 24>` runs those bodies in order (`for rc in
    round_consts`, src/backends/soft.rs:68). The aarch64 SHA-3 backend is
    not covered; it is compiled only on aarch64.
  - Not yet: the sponge absorb and squeeze for the stack's lengths.

### PQ03 · SHA-2 / HMAC / HKDF + the bzDiD derivation

- L3: cryptol-specs `SHA2`, Foundation `HMAC`; HKDF written from RFC 5869.
- L4: the SHA-256 compression function (shipped crate) EQUIVALENT to spec;
  `expand_label` (`bpq.rs:82`) and `hkdf32` (`bpq.rs:90`) in `bpq-core`
  EQUIVALENT to spec.
- L5 PROVE-UNIVERSAL `deriveInjective`: over EVERY label derived from the
  masterPrk, not only the four PQ ones (SPEC-BPQ-1 §2 says "another bzDiD
  label"): the four PQ labels plus `BDID-v1/ed25519-record-key`,
  `BDID-v1/secp256k1-record-key` and `BDID-v1/persona-nullifier`
  (`surfaces/onboarding/bzdid-key.js:4864-4866`), for every context in the
  context language the runtime actually accepts, distinct (label, context,
  counter) triples give distinct HKDF info strings. The K1 derivation
  appends a counter byte when its counter is above 0, so with unrestricted
  contexts `label ‖ "a" ‖ 0x01` equals `label ‖ "a\x01"`: the theorem holds
  only if the accepted context language excludes such bytes. The lane first
  reads which contexts each caller admits; if they are unrestricted, that
  collision is a FINDING (reachable only on the counter > 0 path, which
  needs an out-of-range derived scalar) and the repair is a context rule or
  a length prefix, chosen in the lane. Plus `rootIsolated`: context `root`
  never equals any `pq:<name>` context, and `keys()` refuses it.
- Teeth: a label that is a prefix of an existing one must refute
  `deriveInjective`; the counter-suffix pair above must refute it when the
  context rule is removed.
- **Built 2026-10-08.** The callers were read: every context the wallet
  builds is printable ASCII of at most 51 bytes, but `deriveK1Key`,
  `BPQ.keys` and bsigner's `bpq::keys` accepted any non-empty string, so the
  collision was a FINDING (unreachable in practice: counter 1 needs an
  out-of-range scalar, probability below 2^-127 per derivation). The repair
  is a context rule, not a length prefix (a prefix would change every key):
  1 to 64 printable ASCII bytes, and the K1 counter capped at 31 so a
  counter byte is never a context byte. It holds in `crates/bpq-core`
  (which now builds every info string bsigner derives from), in
  `surfaces/bpq.js` (`keys`, `successionKeys`) and in
  `surfaces/onboarding/bzdid-key.js` (`deriveK1Key`). SPEC-BPQ-1 §2 states it.
  - EQUIVALENCE (`scripts/btungsten/pq03-saw/derive.saw`): `context_ok`,
    `args_ok`, `info_len`, `info_byte`, `info` equal to
    `pq03-cryptol/BpqDerive.cry` for every input in their domains (`info`,
    `context_ok` and `args_ok` for every input at all). The spec builds the
    info string by OR-ing three shifted strings; the Rust places bytes one
    position at a time. The HKDF call itself stays in bsigner
    (`expand_label`, `hkdf32`); only the info string moved to bpq-core.
  - PROVE-UNIVERSAL (`injective.saw`): `labelsPrefixFree`, `infoFits`,
    `infoPadded`, `rootIsolated`, `deriveInjective`, over all seven labels,
    every admitted context (capacity 64, which is the whole rule) and every
    counter. Two boundaries: the counter > 0 path is run only by the
    browser's `deriveK1Key` (bsigner derives no K1 key and always passes
    counter 0), so for it the proof covers the info construction the
    browser mirrors, checked by DIFFERENTIAL on counter-0 rows only; and
    `rootIsolated` is only the byte-0 fact, the separation of the root
    vault being `keys()` refusing the exact string `root` plus
    `deriveInjective`.
  - TEETH: `context_ok` asked to admit DEL; `deriveInjective` with
    `BDID-v1/vault` as a label (refuted: `(4, "-key…")` vs `(5, "…")`), with
    control bytes admitted (refuted: the counter-suffix pair), with the
    counter cap at 0x7e (refuted: `(k1, "H@", 0)` vs `(k1, "H", 0x40)`).
  - DIFFERENTIAL: `surfaces/bzdid-derive-vectors.json` (9 rows, every
    label, built by `scripts/build-derive-vectors.mjs` from the browser's own
    functions) reproduced by bsigner through bpq-core and the hkdf crate.
  - KAT: HKDF-SHA256 on RFC 5869 A.1 to A.3 (extract PRK, expand OKM).
  - **SHA-256, 2026-10-09** (sha2 0.10.9, the `.crate` checked against
    Cargo.lock; `scripts/btungsten/pq03-sha256-check.sh`):
    `pq03-cryptol/Sha256.cry` is FIPS 180-4 with K and H0 COMPUTED (integer
    cube and square roots of the primes, mod 2^32; the primes checked prime
    and consecutive) and is held to FIPS 180-4's digests of "", "abc" and
    the two-block example. `pq03-harness/sha256.rs` compiles the crate's
    soft.rs and consts.rs verbatim. PROVEN: the crate's K32 and H256_256
    tables equal the derived constants; its two-round function
    (`sha256_digest_round_x2`) and message schedule (`schedule`) equal
    FIPS 180-4 for every input; its 64-round block function
    (`sha256_digest_block_u32`) equals FIPS compress for every state and
    block, composed from the two proofs above as overrides with T1, T2 and
    the schedule word uninterpreted; one block through its `compress`
    (bytes to big-endian words) equals FIPS compress. Six obligations in
    5 s locally. TEETH: Σ1 rotating by 7, and one round constant off by a
    bit, each refuted with a counterexample. Scope: the soft path. On
    x86_64 with the SHA extensions sha2 runs SHA-NI intrinsics instead,
    which this does not cover; the spec groups each FIPS sum the way the
    soft code does (addition mod 2^32 makes every grouping the standard's
    sum, and the closed checks hold the spec to the published digests).
  - Not yet: the HMAC/HKDF composition at L4 (KAT + DIFFERENTIAL today),
    the multi-block `compress` loop (one block is proven), and the digest
    core's padding and length encoding. `deriveRecordKey` and
    `personaNullifier` keep accepting any string: their labels take no
    counter, so label prefix-freeness alone keeps them apart, but JavaScript's
    UTF-8 encoder maps a lone surrogate to U+FFFD, so two different JS
    strings can share a context's bytes there. No caller passes one.

### PQ04 · bpq-core: every SPEC-BPQ-1 byte layout

The estate's own PQ glue, where its review findings lived.

- L4 EQUIVALENCE, each against a Cryptol spec of SPEC-BPQ-1: id and
  succession-commit preimages; the card, bind, detached, seal and cosign
  signing messages; `nonce(flag, i)`; the sealed-object head parser (CORE
  plain-integer rule, `len + 16·n` without overflow, exact total length,
  trailing bytes refused); the bind validators (`at` shape, kind regex, value
  without CR/LF) as concrete DFAs, the WB001 right-language lesson.
- L5 PROVE-UNIVERSAL:
  - `domainsDisjoint`: every `bpq1/...` label (ten today: nine in
    `surfaces/bpq.js:63-64` plus the wallet's `bpq1/cosign:`; PQ13 adds one)
    is prefix-free against every other, so no byte string is a signing
    message, hash preimage or wrap info of two kinds;
  - `bindInjective`: for every pair of bindings the validator ACCEPTS, equal
    signed bytes imply equal (id, at, claims). The claim-stripping attack
    (`at:"…Z\ned25519=…"`) is the TEETH row: drop the `at` validator and the
    proof must refute with that counterexample;
  - `nonceInjective` over (flag, i) and `headTotal` (the parser never reads
    past the object and never allocates from an unchecked length).
- **Accept:** each obligation PROVEN by name; bpq-vectors.json still passes
  byte for byte in Rust and JS after the refactor.
- **Built 2026-10-09** (`crates/bpq-core/src/layout.rs`, which bsigner now
  calls for every `bpq1/` label, nonce, segment length and binding
  validator; `scripts/btungsten/pq04-cryptol/BpqLayout.cry`, `pq04-saw/`):
  - The label table holds twelve, not ten: the nine of bpq.js, `cosign:`,
    `bpq1/handover` (PQ07) and `bpq1/words` (bpq.js `words`). Since
    2026-10-09 fourteen: `bpq1/nostr-event` (PQ13) and `bpq1/intent`
    (PQ12, SPEC-BPQ-1 §5c), and every obligation below runs over them.
  - EQUIVALENCE `domain_byte`, `domain_len`, `nonce`, `seg_ok`,
    `segment_count`, `body_len` (Some and None), `segment_plain_len`,
    `utc_timestamp`, `claim_kind`; bsigner's `seal_self` and `open` both
    cut segments with `segment_plain_len`. The last-segment length is now `len % seg` (or a whole
    `seg`, or 0), with no multiplication or subtraction to wrap; the old
    `len - i·seg` path carried 64-bit multiply and subtract overflow
    obligations no solver here closed.
  - PROVE-UNIVERSAL `domainsDisjoint`, `nonceInjective`, `bodyExact`,
    `segmentsTile`, `atNoNewline`, `kindNoSeparator`,
    `bindInjective`. 64-bit division defeats every bit-level solver on this
    box (bitwuzla does not close `len % seg < seg` in 5 minutes), so the
    segment facts split: `bodyExact` holds for ANY segment count
    (segCount uninterpreted); `segmentsTile` is over the integers (z3,
    division native); the step from the bitvector definitions to those
    integers is the definition of unsigned division (SMT-LIB bvudiv and
    bvurem), stated, not proven: posed as a goal (`segmentsBridge`), z3
    returned Unknown after 78 minutes in CI. `headTotal` became structural instead: bsigner
    takes every part with a checked range and refuses parts that do not tile
    the BODY, so no length can make it panic, and `segmentsTile` is why an
    accepted object never meets that refusal.
  - `bindInjective` is a bounded MODEL of bsigner `verify_bind` (the
    63-byte id, up to two claims in any order, kinds and values up to 8
    bytes); bsigner builds the signed bytes with `format!` and checks values
    for CR/LF itself, and no Rust function is proven equal to the model's
    preimage or value rule. What carries to every size: `atNoNewline` and
    `kindNoSeparator` hold for every accepted `at` and kind (the proven
    validators), the id is bech32 (no line break), and values are refused
    if they hold CR or LF; with those, the decoding (split on line breaks,
    then each line at its first '=') is the argument on paper, and the
    bounded proof checks it where a solver can. The model leaves claim order
    free (bsigner sorts; injectivity does not need it).
  - TEETH: `utc_timestamp` asked to take a lowercase z; a prefix domain
    (`bpq1/wrap`); the BODY check in wrapping arithmetic (refuted: len
    2^64-1, seg 2^24); an empty last segment for an exact multiple; the at
    validator dropped (the claim-stripping attack); '=' in a kind; and the
    at, kind and value rules each loosened inside `bindInjective`.
  - Not yet: the id, succession, card, detached, seal, bind and cosign
    message layouts beyond their labels (Rust builds them by concatenation;
    the bind preimage is modeled, not tied), and the CORE plain-integer
    scan.

### PQ05 · ML-KEM + X-Wing

- Shipped-implementation decision, evidence gated: libcrux-ml-kem is adopted
  behind bsigner's alg-id interface only if its pinned version carries a
  machine-checked functional-correctness proof for the backend we would ship,
  cited at file:line (law 5). Otherwise RustCrypto stays and the claim is
  "three implementations agree on all official vectors". Either way ML-KEM
  keyGen from (d, z) is deterministic, so every KEY in bpq-vectors.json must
  still reproduce byte for byte. Sealed objects carry fresh randomness
  (`scripts/build-bpq-vectors.mjs:5-8`), so for those the swap test is that
  every committed object still opens.
- L3: cryptol-specs `ML_KEM` (512/768/1024) at `d0647fa970db`.
- L4: X-Wing in `bpq-core`: the seed split `SHAKE-256(seed, 96) → (d‖z, x25519
  secret)` and the combiner input `ss_M ‖ ss_X ‖ ct_X ‖ pk_X ‖ "\.//^\"`,
  EQUIVALENT to a Cryptol X-Wing spec built on cryptol-specs ML-KEM768 and
  `Common/EC/Curve25519`; the shipped NTT butterfly and Barrett/Montgomery
  reductions EQUIVALENT to spec over all 16/32-bit inputs.
- L5: `combinerBinds`: the combiner input is injective in
  (ss_M, ss_X, ct_X, pk_X) (fixed widths, proven, not assumed).
- Teeth: a combiner that drops `pk_X` must refute; a decapsulation that skips
  the implicit-rejection compare must fail the decapsulation KAT group.
- **Built 2026-10-09.** `crates/bpq-core/src/xwing.rs` holds the seed split
  and the combiner input; bsigner's `xwing_expand` and `xwing_decapsulate`
  call them. SAW (`pq05-saw/xwing.saw`): EQUIVALENCE of `combiner_input`
  and `split_seed` to `pq05-cryptol/XWing.cry` (written from draft -11, not
  on cryptol-specs: the primitives stay KAT), `combinerBinds` PROVEN, and the
  tooth (a combiner without `pk_X`) refuted. The whole construction
  reproduces draft -11's Appendix C in both implementations (CI job
  `pq05-xwing`). Not yet: the libcrux adoption decision (RustCrypto stays;
  three implementations agree on every ACVP vector, PQ01), the NTT and
  reductions at L4, and the implicit-rejection tooth as its own KAT group.
- **Base field, 2026-10-09** (shared with PQ06; `scripts/btungsten/pq05-field-check.sh`).
  ml-kem 0.3.2 and ml-dsa 0.1.1 define their fields with module-lattice
  0.2.3's `define_field!`; `pq05-field/` links the checksum-pinned
  module-lattice through cargo-saw-build and invokes the macro with the
  crates' own arguments (the check refuses to run unless the pinned
  crates still carry exactly those lines). PROVEN against
  `pq05-cryptol/Field.cry` (arithmetic mod q on words wide enough not to
  wrap; that this is integer arithmetic mod q rests on the widths, read:
  a z3 proof of the bridge did not finish in 400 s), for every input in
  the field: ML-KEM's branchless conditional subtraction (x < 2q), Barrett
  reduction for every product of two elements (x <= (q-1)^2) and for
  every sum of two products (x <= 2(q-1)^2, what its base-case multiply
  hands it), and `Elem` add, sub, neg, mul; ML-DSA's conditional
  subtraction, add, sub and neg. Eleven obligations, 224 s locally.
  TEETH: the conditional subtraction claimed for every word, and Barrett
  claimed for every 32-bit word, each refuted with a counterexample.
  ML-DSA's Barrett (a 128-bit product) and multiply are open: bitwuzla,
  ABC and yices are each past 15 minutes on it.

### PQ06 · ML-DSA (44/65/87)

- Same evidence-gated decision for libcrux-ml-dsa (its README at
  `42d68bd49b24` claims hax/F* verification for "field arithmetic, NTT
  polynomial arithmetic, and serialization", portable and AVX2, which is
  not the whole algorithm; read and cited in the lane). The swap test: every
  keyGen output reproduces byte for byte, every existing signature verifies,
  and the ACVP deterministic sigGen KAT passes. Signatures are NOT compared
  byte for byte against the committed vectors: the browser signs hedged
  (`bpq.js:194`, noble adds 32 random bytes when `extraEntropy` is unset),
  and pq-kat.json carries no signing cases (its `notIncluded` list).
- L3: cryptol-specs `ML_DSA` (44/65/87).
- L4: the message layer around the primitive (PQ04 messages, the FIPS 204
  external `M' = 0 ‖ len(ctx) ‖ ctx ‖ M` framing in bsigner) EQUIVALENT to
  spec; shipped NTT butterfly and reductions as in PQ05.
- Teeth: sigVer must refuse every negative ACVP case; a verifier that accepts
  a hint with too many ones (the classic `h` weight bug) must fail sigVer.
- **Base field, 2026-10-09:** see PQ05's base-field entry (one lane, both
  fields): ML-DSA's conditional subtraction, add, sub and neg PROVEN;
  its Barrett reduction and multiply open.

### PQ07 · SLH-DSA-SHAKE-256f + the succession handover

Closes SPEC-BPQ-1 §6 "not cross-checked".

- Rust derives the succession key (today only `bpq.js` does): a FIPS 205
  implementation behind bsigner, crate chosen by the same evidence rule,
  differential against noble, ACVP KAT.
- L3: cryptol-specs carries SPHINCS+ 3.1 (`SphincsPlus/3.1/sphincsplus256f`),
  not FIPS 205. Its deltas from FIPS 205 for the SHAKE sets are listed and
  closed before it is used as an oracle; until then it is UNVERIFIED as a
  FIPS 205 spec and the lane relies on KAT + DIFFERENTIAL.
- The handover is a bzpq1 statement, SPEC-BPQ-1 §5 "Handover v1" (built
  2026-10-08): `{bpq:1, kind:"handover", from, to, at, dsa, slh, card, sig}`,
  SLH-DSA over `"bpq1/handover" ‖ SHA3-256(from \n to \n at)`, refused unless
  `from` recomputes from `dsa` and `SHA3-256("bpq1/succession" ‖ slh)`. (The
  first draft of this design put it in a did-autonomi `rotate` op through
  `atmirror::record_sig::verify_record_alg`; a bzpq1 id lives outside those
  logs, so the statement had to exist on its own. Carrying a handover inside
  a did-autonomi log, with `keyAlg = "slh-dsa-shake-256f"` and the caller
  obligation at `record_sig.rs:175-180`, is the later integration.)
- Obligations (L5 where formal, battery rows otherwise):
  - `handoverAuthorized`: a handover is accepted only if its SLH-DSA
    signature verifies under a revealed key whose commitment equals the id's
    `succ`;
  - `handoverBinds`: the signed bytes bind the old id, the new id (and
    through it the new key set and its next commitment) and the time, so a
    handover cannot be replayed onto another id or swapped to another key
    set; a position in a log is the log's to bind;
  - `handoverOnce`: after a handover the old `succ` is spent; a second
    handover under it is refused (the log is the state, so this obligation
    belongs to whoever keeps the log, not to the stateless verifier);
  - T-VACUOUS: a handover with an empty card, key, signature or new id is
    refused.
- Teeth (built, `crates/bsigner/src/bpq.rs`
  `a_handover_verifies_and_its_forgeries_do_not`): a forger holding only the
  ML-DSA key (the break scenario) signs with their own SLH-DSA key under the
  victim's id and is refused, because that key hashes to a different
  commitment; a swapped card, a handover replayed onto another id, a moved
  `at`, a handover to itself and the reserved context are refused.

### PQ08 · The law-signature checker refuses stale signatures

Today `scripts/verify-bpq-signatures.mjs:7-10, 34-41` reports a law file that
changed after signing as STALE and exits 0. The review's rule: a current
signature per law file.

- A manifest (`docs/LAW-MANIFEST.json`) names the law set by glob
  (`docs/CONSTITUTION.md`, `ORDERS-1.md`, `docs/RULINGS-*.md`). Every file the
  globs match must carry a `.bpqsig.json` that verifies over its CURRENT bytes
  from a pinned signer. STALE is red. Missing is red. A manifest that matches
  zero files is red (T-VACUOUS).
- Two implementations must agree: the JS checker and `bsigner bpq-verify`
  (Rust) over the same manifest, each printing `law files: N of N current`.
- Teeth: CI builds a scratch copy with one law file edited after signing and
  requires both checkers to fail it.
- The founder's one-press "sign the law" (`wallet.html#pq-law`) stays the
  only way a law change turns green.

### PQ09 · bSiGner keys at rest

Today the seed sits in plaintext JSON (`crates/bsigner/src/keys.rs:12-16`
says so; each key file carries `"at_rest_encryption": "NOT DONE"`,
`keys.rs:60` and `:90`).

- Design: each key file becomes a SPEC-BPQ-1 sealed object (`bpq1`), one
  `self` slot under the root vault key of the owner's phrase
  (`bpq::root_vault`), so the at-rest format reuses the decoder PQ04 proves
  and needs no public-key step (SPEC-BPQ-1 §1: "only me" is hash and AES-256
  only). Existing plaintext files are migrated and refused after migration.
- Obligations: no seed byte reaches disk in clear (battery scans every
  written file for every seed); open with the wrong phrase or a tampered body
  refuses; listing still shows no secrets (`keys.rs` tests kept).
- Teeth: a planted plaintext write must be convicted by the scan.

### PQ10 · Plonky3: one proof of the existing receipt statement

The deep item (`contracts/zkreceipts/PQ-INVENTORY.md` §3). First job only:
ONE base proof, measured against the PLONK/BN254 baseline. Recursion is out
(§PQ15).

**The statement: the same claim, a new commitment, one narrowing.**
`contracts/zkreceipts/count.circom` and
`count_scale.circom`: over a private witness of n receipt leaves (n a power
of two, slots past `members` constrained to the all-zero preimage), each leaf
`(fp, pheno, r1, r2, r3)`; `kept = (≥1 settled verdict) AND (no flip)`; the
public claim `(root, kind, count)` holds iff the committed set's kept-count
for baseline `kind` equals `count` (the repaired selector law, including the
asymmetric fixture). What changes is only the commitment: Poseidon over the
BN254 scalar field is non-native to a 31-bit field, so the STARK commits the
same leaves with Poseidon2 over KoalaBear in the same full-tree shape
(SPEC-ZK-RECEIPT-AGGREGATES-1 §shape keeps "a Merkle tree"; PQ-INVENTORY §3
already records the hash as replaced-with-the-system). Leaf and node hashing
are domain separated; n and `members` are statement dimensions absorbed into
the transcript as length-delimited bytes.

One deliberate narrowing, recorded rather than hidden: the circuit does not
range-check `fp` (`count.circom:33`), so PLONK accepts any BN254 scalar
there. The STARK takes `fp` as three range-checked limbs, exactly 64 bits.
Every fixture is a 64-bit fingerprint, so every fixture lies in both
domains; a witness with a wider `fp` is accepted by PLONK and refused by
the STARK, and the cross-system differential prints that row as the one
expected divergence.

**Statement equivalence across systems.** A Rust model
`count_statement(leaves) -> (root_p2, dead_kept, live_kept)` (also computing
the BN254 root through the existing witness path for the cross-check) and a
Cryptol spec. For every fixture (the 40-member cohort, `asym-cohort.json`,
the scale fixtures), the PLONK claim and the STARK claim must be the same
claim. SAW: the model's leaf predicate and selector EQUIVALENT to spec (the
leaf domain is 128 cases; also exhausted by test).

**The AIR.** Preferred layout: a post-order stack machine, one Poseidon2
permutation per row (poseidon2-air columns composed into the row), leaf rows
push a leaf digest and its two kept bits, merge rows pop two entries and push
their hash and summed counters; stack depth ≤ log2 n + 1. Every constraint is
local (this row, next row), so the bus/lookup class of caller obligations
does not arise. Fallback if width blows up: level rows with a LogUp bus, in
which case every bus obligation in upstream `docs/caller-obligations.md`
applies by name.

**Row soundness, the under-constraint proof.** The AIR's per-row constraints
are written once, generic over a ring; one instance is Plonky3's AirBuilder,
one is a concrete KoalaBear evaluator SAW verifies. Obligation `rowSound`: for
every assignment of a row's columns, all constraints zero implies the row's
outputs equal the spec function of its inputs and the inputs are in range;
the Poseidon2 sub-columns are held to `out = P(in)` as a named assumption
(INHERITED from poseidon2-air, separately KAT- and differential-tested).
Teeth, each must be convicted twice (SAW counterexample AND a forged proof the
sabotaged verifier accepts): the original `IsEqual(kind,0)` selector; a
dropped verdict range check; an unconstrained pad slot; a non-boolean `kind`.

**The zero-knowledge composition, named in full.** At the pin, `TwoAdicFriPcs`
and `CirclePcs` declare `ZK = false` (`fri/src/two_adic_pcs.rs:946`,
`circle/src/pcs.rs:1118`), and the only `const ZK: bool = true` in the
workspace is `HidingFriPcs` (`fri/src/hiding_pcs.rs:306`). `HidingWhirPcs`
(`whir/src/pcs/zk/adapter.rs:30`) hides too, but it implements
`MultilinearPcs` (`adapter.rs:78`), not uni-stark's `Pcs`, so it is not an
alternative for this statement. The config is:

- `HidingFriPcs`, with BOTH its input MMCS and its FRI MMCS
  `MerkleTreeHidingMmcs` (upstream: "Both MMCSs must also be hiding; this is
  not enforced at compile time", `hiding_pcs.rs:51`). Our config type
  alias is the only constructor and a compile-time assertion requires
  `Pcs::ZK == true`;
- the blinding RNG is a `CryptoRng` seeded from the OS (a fixed seed exists
  only in tests, behind a test-only type); two proofs of one witness must
  differ;
- the hiding budget `N ≥ 2·(num_queries + D·opening_points)`
  (`hiding_pcs.rs:65`) is derived from the config and the trace is padded
  to meet it, never hand-set; small n is exactly where it binds;
- prover data is opened once (fresh commitment per proof);
- the STARK's own randomization polynomial (`uni-stark/src/prover.rs:344-360`)
  and out-of-domain sampling (`:386-392`) stay as uni-stark runs them.
  Upstream's own word for this construction is "only statistically zk"
  (`:351`), and that is the strongest word the receipt may use.

Two configs are built and measured, only one goes on chain:
**K** — Keccak-256 MMCS and a Keccak `SerializingChallenger32` (digest 256
bits; Vaulta has `keccak`/`sha3` host functions, so Merkle checks on chain are
host calls), the on-chain candidate; **P** — Poseidon2 MMCS and
`DuplexChallenger` (digest 8×31 = 248 bits), the recursion-friendly
candidate. Upstream rule "digest at least twice the security level" caps P at
124 bits and K at 128. Challenge field: degree-4 and degree-5
(`QuinticTrinomialExtensionField<KoalaBear>`) both measured.

**Transcript discipline.** From upstream `docs/caller-obligations.md`
§Transcript ordering at `eab7f0e` (`:66-102`): commitments are absorbed and
opening points bound before opening at prescribed points; the width of an
opaque observation is bound through the instance label. From upstream
`symmetric/src/sponge.rs:160-173`: variable-length absorption uses
`Pad10Sponge`, never `PaddingFreeSponge`. Our own rules, not upstream's:
public values `(root, kind, count)`, n, `members` and the instance label are
observed before any challenge is drawn, and FRI parameters come from our
pinned config, never from the proof. MultiField32Challenger is not used; the pin
postdates its fixes (#597, #1299, and the challenger fixes #1738 absorb-length
overflow and #1747 PoW bit-bound bypass, all in `git log` at `eab7f0e`).

**Security figure.** Parameters are sized so p3-security's
`proven_security` meets the target. `conjectured_security` is printed beside
it and labeled a conjecture; `legacy_security` is never used (upstream: "Do
not use it to size deployment parameters", `uni-stark/src/proof.rs:30-35`).
The receipt prints every error term, the regime and the grinding bits. Target for the base proof: ≥ 100 bits proven. The number is
reported, never turned into a word.

**The four tungsten receipts, side by side with PLONK/BN254**
(SPEC-ZK-RECEIPT-AGGREGATES-1 §tungsten):

1. FORGERY. Statement mutations (wrong count, wrong root, skipped receipt,
   reversed kind, swapped leaf, nonzero pad, `members` lie) are refused;
   proof mutations: every byte of the n=64 proof flipped one at a time, a
   sampled sweep at n=1k/10k, truncation, non-canonical field encodings, zero
   openings (T-VACUOUS), the same proof under different public values or a
   different n or instance label.
2. LEAK. A new preregistration (`leak/PREREGISTERED-STARK.md`) is committed
   BEFORE the first STARK proof, in the form of the existing one: same
   REAL/SIM classes, families adapted to STARK transcripts (opened values,
   Merkle siblings, FRI final polynomial), the same fixed pass criterion.
   Teeth: the same distinguisher run against the NON-hiding config
   (`TwoAdicFriPcs` + plain MMCS) must detect leakage. A LEAK harness that
   cannot see a non-hiding STARK is broken.
3. COST. Native: prover time, verifier time, proof bytes, peak memory. On
   chain: config K's verifier compiled to wasm32 and run in a contract on the
   Spring 1.2.2 rehearsal chain, billed CPU µs and NET bytes per verify,
   against the PLONK count verifier's measured 10.6-12.1 ms on jungle4
   (SPEC-ZK-RECEIPT-AGGREGATES-1 §sequence 4) and its 768-byte proof (24
   words, `leak/PREREGISTERED.md`). Rehearsal
   chain and jungle4 only. A STARK is never wrapped in a pairing verifier at
   the acceptance boundary, because that puts BN254 back where the quantum
   adversary forges.
4. SCALE. n = 64, 1,024 and 16,384 (10k members padded), prover time and
   memory for both systems on the same box, same day. PLONK at 1k and 10k is
   run in the same beat if its own receipt does not exist yet.

**Crate posture.** Plonky3 is a git dependency at `eab7f0e`; the crate builds
in its own CI job; the audit two gates run on its tree.

### PQ11 · Classical correctness lane (A8, A10, A11, A12)

- BIP-340: Cryptol spec (secp256k1 constants checked on closed terms: `n·G =
  O`, the curve equation for G, `p = 2^256 - 2^32 - 977` derived), tagged-hash
  glue EQUIVALENT, KAT + DIFFERENTIAL (k256, libsecp256k1 via `secp256k1`,
  noble).
- ECDSA K1: Antelope's canonical-signature rule as a concrete predicate,
  EQUIVALENT to spec; Wycheproof verdicts reproduced under it.
- BIP-39: no Rust implementation exists today (the words are handled only
  by `bzdid-key.js` over @scure/bip39). Rust first: a Rust BIP-39 in
  `bpq-core` becomes the model, @scure the differential. L5
  `mnemonicRoundTrip` for every 256-bit entropy (checksum as an
  uninterpreted function, so the bijection is proven for any hash) and
  `badChecksumRefused`.
- X25519: KAT + DIFFERENTIAL; clamping EQUIVALENT to spec.
- BCH note for the rails table: Bitcoin Cash Schnorr (2019) is not BIP-340;
  any BCH signing path gets its own vectors.
- **Built 2026-10-09.** BIP-39: `crates/bpq-core/src/bip39.rs` packs and
  unpacks the 264 bits (SAW: EQUIVALENCE of `indices`, `indices_ok`,
  `unpack`, `decode_ok`; `mnemonicRoundTrip` both ways and
  `badChecksumRefused` with the checksum hash a free input; two teeth), and
  `crates/bsigner/src/bip39.rs` adds SHA-256 and the official English list
  (bitcoin/bips `ce1862ac6bcf`, equal to the browser's word for word), so
  `--rec-env` takes the 24 words as well as the `bdidrec1` code; the
  browser's phrase for the derive-vector root reads back to it in Rust.
  KAT (`classic-kat`, pins in `crates/btungsten-pq/classic-manifest.json`):
  BIP-340 sign and verify on k256 and on the wallet's noble schnorr,
  Wycheproof secp256k1 ECDSA (plain and Bitcoin low-S sets) on k256,
  Wycheproof X25519 on x25519-dalek, all passing in CI; k256 refuses the 72
  plain-set `valid` signatures whose s is high, its low-S policy, listed by
  tcId. Not yet: the BIP-340 Cryptol spec and tagged-hash EQUIVALENCE (no
  Rust BIP-340 signer exists in the tree until PQ12), the Antelope canonical
  K1 predicate, X25519 clamping at L4, libsecp256k1 as a third DIFFERENTIAL.

### PQ12 · FROST / ChillDKG behind bSiGner

bSiGner signs the PQ authorization (ML-DSA-65 under the owner's bzpq1 id);
each rail signs with its own curve. FROST is a threshold BIP-340 backend
behind bsigner's interface, the way the manifest already intends for btrezor
(`crates/bsigner/Cargo.toml` description), never a sibling. It signs, it never
submits: no network code in the backend.

What the pins show: chilldkg-rs `sample_nonce` takes `msg: Option<&[u8]>`
(`src/sign/party/nonce.rs:66-110`), and its `SecNonce` is neither Clone nor
Copy. frost-wallet's PSBT handling lives in the page's JavaScript: the page
builds the TapSighash tagged preimage (`web/bitcoin.js:64-81`) and the Rust
core SHA-256s whatever it is handed (`core/src/wallet.rs:1366`), so the Rust
signer never sees the transaction it signs. That also means the core cannot
be handed a 32-byte sighash: it would hash it again and the Taproot
signature would be invalid. Our signer therefore does not reuse the
frost-wallet core; it computes the BIP-341 sighash itself and hands it to
chilldkg directly. Backups leave through an explicit `export`
(`wallet.rs:418`) as plain base64.

Obligations:

- `intentBeforeNonce` (structural, CLAUDE.md §5 "unnameable to forbidden"):
  the nonce function takes a `VerifiedIntent` that only the verifier can
  construct, and the verifier constructs it only after (1) the ML-DSA
  authorization verifies under the pinned authority id, (2) the Rust signer
  parses the PSBT itself, (3) it recomputes every BIP-341 sighash it will
  sign, and (4) outputs, amounts, fee and destination equal the authorized
  intent field for field (a WB001 envelope with a rail-payload descriptor).
  At the chilldkg layer `msg` is always `Some(sighash)`.
- Battery: every intent field flipped refuses before any nonce exists; a
  PSBT with zero inputs or zero outputs refuses (T-VACUOUS); a sighash type
  other than the authorized one refuses.
- `nonceOnce`: secret nonces are consumed by value; reuse does not compile,
  and the runtime refuses a replayed session id.
- Sighash DIFFERENTIAL: our BIP-341 sighash vs `rust-bitcoin` vs
  `@scure/btc-signer`, plus BIP-341's `wallet-test-vectors.json`.
- Aggregation refuses fewer than t partial signatures and verifies the final
  BIP-340 signature before release.
- Shares and backups at rest are sealed objects (PQ09 format); host-key
  compromise is a lifecycle (new DKG session, old shares retired, funds moved
  under the new key), not a rerun.
- chilldkg-rs is unaudited and says so; it enters only behind this design,
  through the audit two gates, with its upstream vectors in our CI.
- **Built 2026-10-09, step (3): the signer computes what it signs.**
  `crates/bsigner/src/taproot.rs` parses the unsigned transaction itself
  (refused: zero inputs, zero outputs, a scriptSig, an amount or total over
  21 million BTC, a non-minimal length, a trailing byte, every truncation),
  builds BIP-341's signature message for a key-path spend field by field
  for the seven hash types (others refused, as is SINGLE without its
  output), and computes the tweak, output key and bech32m address and the
  check a node makes of a key-path witness. Out of scope and refused, not
  half-done: tapscript spends and the annex. On BIP-341's
  `wallet-test-vectors.json` (bitcoin/bips `200f9b26`, pinned by size and
  SHA-256 in `scripts/btungsten/pq12-bip341.json`, fetched by CI job
  `pq12-taproot`, never committed): 7 of 7 script-tree cases (leaf hashes,
  root, tweak, output key, scriptPubKey, address, control blocks) and 7 of
  7 key-path inputs (the five shared hashes, SigMsg, sighash, tweak; the
  expected witness verifies, and signing with the vector's tweaked key and
  zero aux reproduces it byte for byte); 20 teeth refused (the witness on
  another input, one flipped bit, another hash type). `bsigner
  taproot-sighash` and `taproot-address` expose it.
- **Built 2026-10-09, step (2): the signer reads the PSBT itself.**
  `crates/bsigner/src/psbt.rs` reads BIP-174 version 0 with BIP-371's
  Taproot fields: every known key type checked for key-data and value
  length, public keys on the curve, keys unique per map, version 2 fields
  and versions above 0 refused, a non-witness UTXO refused unless it hashes
  to its outpoint (and agrees with any witness UTXO), no trailing byte;
  unknown and proprietary keys allowed, as BIP-174 requires. The signer's
  reading (`signing_view`) refuses a PSBT missing any spent output, a hash
  type outside BIP-341's seven, zero inputs or outputs, and outputs that
  pay more than the inputs spend. Every test PSBT in the pinned BIP-174 and
  BIP-371 texts (CI job `pq12-taproot`): BIP-174 19 of 19 invalid refused,
  each for its own stated defect; 10 of 10 valid, 10 of 10 role-walkthrough
  and 4 of 4 "fails signer checks" PSBTs parsed (those 4 fail P2SH/P2WSH
  script checks, which are not claimed: a Taproot key-path signer has no
  such input to sign); BIP-371 11 of 11 invalid refused, 6 of 6 valid
  parsed. The key-path signature BIP-371's signed PSBT carries (made by the
  reference implementation) verifies over the sighash bsigner computes, and
  one flipped bit does not. `bsigner psbt-inspect` prints what the signer
  reads: each input's outpoint, amount, address, hash type, sighash and
  whether the PSBT's internal key tweaks to the spent key; each output's
  amount and address; the fee.
- **Built 2026-10-09, steps (1) and (4): the authorization and the gate.**
  SPEC-BPQ-1 §5c: the owner's bzpq1 key signs a WB001 intent envelope
  with ML-DSA-65 under the new label `bpq1/intent` (bpq-core's
  fourteenth; PQ04's `domainsDisjoint` and its tooth move to fourteen),
  and for a Taproot key-path spend the envelope's payload binds the txid
  and BIP-341's hashes of the spent amounts and scriptPubKeys.
  `crates/bsigner/src/intent.rs`: `verify_spend` is the only
  constructor of `VerifiedIntent` (its fields are private, it has no
  other constructor) and refuses unless the authorization verifies under
  the pinned authority, the expiry has not passed, and the PSBT, read by
  bsigner, equals the authorization field for field. Battery (bsigner
  test `the_signer_signs_only_the_spend_it_was_authorized`): the honest
  spend verifies with BIP-341's sighashes; refused: 418 of 418 envelope
  bytes changed without re-signing, 15 signed fields that contradict the
  PSBT (domain twice, action, destination, capability, amount, a passed
  expiry, payer, the descriptor's hash type, fee, txid, spent amounts,
  spent scripts, length and tag), 6 PSBT changes (an output amount, a
  spent amount, a hash type, one input fewer, no outputs, change to a
  third key), another authority, kind, version, and a clock past expiry.
  `bsigner btc-intent`, `bpq-attest-intent`, `btc-verify-intent`
  expose it. The browser twin: `BPQ.attestIntent` / `verifyIntent` and a
  WB001 codec in bpq.js, 19 of 19 of WB001's pinned rows (10 envelopes
  byte for byte both ways, 9 refusal codes); each implementation verifies
  the other's authorization (`surfaces/bpq-intent-vector.json`,
  `surfaces/bpq-intent-rust.json`), and both refuse another envelope, a
  trailing byte, another kind, id or key.
- **Built 2026-10-09, step (5): FROST behind the gate, feature-gated.**
  `crates/bsigner/src/frost.rs` over chilldkg-rs `=0.5.0` (crates.io;
  its `.crate` is byte-identical to the pinned `afeafbc7f9df` but for a
  stray `.DS_Store`, which is why it reads "dirty"; README line 9: "has not
  been audited"). Compiled only with the off-by-default `frost` feature,
  so it is absent from the shipped binary until its key ceremony and its
  shares at rest (PQ09's sealed format) land; with the feature on and no
  CLI yet, the toolchain reports its functions unused, as the stub law
  wants. `open` takes a `VerifiedIntent` and refuses unless its output
  key is the group's Taproot key (BIP-341 TapTweak of the threshold key,
  computed by bsigner's own code and equal to chilldkg's tweaked key) and
  the input exists; the nonce is bound at round 1 to that sighash and
  tweak (chilldkg's `msg` is always `Some`); a session id opens once;
  `sign` consumes the session (chilldkg's secret nonce is neither Clone
  nor Copy); `relay` and `finish` refuse fewer signers or partial
  signatures than the threshold, and `finish` releases the signature only
  after bsigner's own BIP-340 check under the output key. Test (local,
  WSL): a 2-of-3 ChillDKG key signs both inputs of an ML-DSA-authorized
  PSBT with two different pairs, and each signature passes the node check
  of a key-path witness (`taproot::verify_key_path`); refused: one
  signer, a replayed session id, a missing input, another group's share
  and coordinator, a partial signature over another input's sighash, fewer
  partials than the threshold. CI job `pq12-taproot` also runs chilldkg's
  own vector tests from the `.crate` checked against Cargo.lock, audit
  gate 1 (blocking: `cargo tree -e normal -i chilldkg-rs` finds nothing in
  bsigner's default build) and gate 2 (`cargo audit` 0.22.2 over the lock,
  recorded). Not yet: the key ceremony and sealed shares, the CLI rounds,
  the sighash DIFFERENTIAL against rust-bitcoin and @scure/btc-signer, and
  the wallet's press that makes an authorization.

### PQ13 · Buzz events

Buzz (block/buzz) signs Nostr events with secp256k1 Schnorr. That is
upstream's protocol and it stays classical at the relay. The estate adds a
PQ attestation beside it: a separate event kind carrying an ML-DSA-65
signature over `"bpq1/nostr-event" ‖ event_id`, by the author's bzpq1 key,
referencing the target event. A separate event avoids the circularity of a
tag inside the id it signs. Obligations: the label joins PQ04's
`domainsDisjoint`; verifiers that do not know the kind ignore it; the
upstream ask is filed with block/buzz by the upstream-handling seat.

- **Built 2026-10-09** (the statement; carrying it on a relay is the
  upstream ask): SPEC-BPQ-1 §5b, `{bpq:1, kind:"nostr-event", id, event,
  dsa, succ, sig}`. Browser `BPQ.attestNostr` / `verifyNostr`, Rust
  `bpq::attest_nostr` / `verify_nostr`, `bsigner bpq-attest-nostr`, and
  `bpq-verify` reads the kind. `bpq1/nostr-event` is the thirteenth label
  of bpq-core's domain table, so `domainsDisjoint` covers it. Refused in
  both test suites: another event, uppercase hex, a short id, another kind
  or version, another id, an empty signature, another key's signature, the
  reserved context. bsigner verifies the browser-made
  `surfaces/bpq-nostr-vector.json`, and the browser verifies the
  bsigner-made `surfaces/bpq-nostr-rust.json` (which bsigner reproduces
  byte for byte: deterministic ML-DSA).

### PQ14 · EcGFp5 Schnorr inside Plonky3 (after PQ10 has its own evidence)

Curve confirmation first: EcGFp5 lives over GF(p^5) with p = 2^64 - 2^32 + 1
and modulus z^5 - 3; Plonky3 at the pin has
`impl BinomiallyExtendable<5> for Goldilocks` (`goldilocks/src/extension.rs:131`)
with W = 3 (`:153`, after the sage note "x^5-3 is irreducible"), so
the field exists; the curve, its encoding and a Schnorr variant still need a
spec and vectors from the EcGFp5 reference before anything is built.
Nothing starts here until PQ10's four receipts exist.

### PQ15 · Recursion: out

Plonky3 recursion stays out until the base proof has its own evidence. When
it enters: the recursion crates are unaudited and are labeled so, and the
acceptance boundary never verifies through a pairing.

## §5 · Rails: classical at the destination, tracked upstream

| rail | destination signature | where in tree | what the estate controls | status |
|---|---|---|---|---|
| Lightning | secp256k1 ECDSA, Schnorr for Taproot channels | none in tree yet | the bSiGner-authorized intent before any rail signer runs | CLASSICAL AT DESTINATION |
| exSat | secp256k1 ECDSA (EVM on Bitcoin) | `crates/chain-exsat-evm` | same | CLASSICAL AT DESTINATION |
| cbBTC on Base | secp256k1 ECDSA EOAs / smart accounts | bPay SETTLE adapters | same | CLASSICAL AT DESTINATION |
| BCH | secp256k1 ECDSA, BCH Schnorr (not BIP-340) | `crates/bindexer` BCH schema seam | same | CLASSICAL AT DESTINATION |

None of these is ever labeled post-quantum. Each is an upstream dependency
whose PQ path is that chain's to ship; the estate's claim stops at "the
authorization that released the rail payload was ML-DSA-signed and bound to
the exact payload" (WB001 + PQ12).

## §6 · What each lane's receipt carries

Per SPEC-BTUNGSTEN-1 §receipt: counts printed by CI's own run; the pinned
commits of every upstream (Plonky3 `eab7f0e`, cryptol-specs `d0647fa970db`,
Foundation `7d0528bd9986`, ACVP-Server `975de31eb83d` or the newer pin the lane
records, chilldkg `afeafbc7f9df`, frost-wallet `20b25cd73a2c`, vortex
`3c0affd9320a`); each obligation by name with its result class; each teeth
row with its counterexample; the audit two gates for every new crate; the
boundary each claim does not cross. CI's verdict on the landing commit is the
receipt; local numbers are what CI must reproduce.

## §7 · Order and dependencies

```
PQ00 teeth ──┬─> PQ01 vectors ──> PQ02 SHA-3 ──> PQ03 SHA-2/HKDF ──> PQ04 bpq-core
             │                                                         │
             │        PQ05 ML-KEM/X-Wing <──┬──────────────────────────┤
             │        PQ06 ML-DSA        <──┘                          │
             │        PQ07 SLH-DSA + handover <── PQ04, PQ06           │
             │        PQ08 law checker <── PQ04                        │
             │        PQ09 keys at rest <── PQ04                       │
             └──────> PQ10 Plonky3 receipt statement (independent; parallel)
                      PQ11 classical lane ──> PQ12 FROST behind bSiGner ──> PQ13 Buzz
                      PQ14 EcGFp5 <── PQ10 evidence;  PQ15 recursion: out
```

## §8 · Open, named (not resolved here)

- **X-Wing draft revision.** SPEC-BPQ-1 names the draft without a revision;
  PQ05 records which revision's vectors ours reproduce. Settled for the
  browser 2026-10-09: bpq-lib's X-Wing (what bpq.js calls) passes all three
  Appendix C vectors of draft-connolly-cfrg-xwing-kem-11 (the latest,
  2026-09-23: keygen, encapsulation, decapsulation) and of -06; the
  combiner in -11 still puts the label last, as SPEC-BPQ-1 §2 does. CI job
  `pq05-xwing` pins -11 by size and SHA-256 and runs bsigner's keygen and
  decapsulation on the same file.
- **SPHINCS+ 3.1 vs FIPS 205** as a Cryptol oracle (PQ07).
- **On-chain STARK verify fit.** Whether config K fits Vaulta's per-transaction
  CPU and NET limits is a measurement PQ10 makes on the rehearsal chain, not a
  prediction this document makes.
- **libcrux adoption** for ML-KEM / ML-DSA turns on what their pinned
  verification status says (PQ05, PQ06).
