# bTunGsTeN workbenches

The executable arm of SPEC-BTUNGSTEN-1: every claimed property of the
standard reduces to a reproducible adversarial test with explicit
assumptions, pass/fail criteria, evidence, and a machine-verifiable
receipt. A workbench is where a property stops being prose.

```
Foundation (Cryptol + SAW)      → prove the formal invariant
Emissary-style hostile workflow → attack the living distribution
Autonomi / x0x / BNR stack      → the sovereign substrate under test
bTunGsTeN receipt               → verdict computed from observations only
```

All three tool rows are REPLACEABLE test infrastructure, never
dependencies of the standard (SPEC-BTUNGSTEN-1 §toolchain): if NSA
deletes Foundation or SAW disappears, the workbench migrates to whatever
formal system replaces them — the ≥1000-year clause applies to bTunGsTeN's
own tooling first.

## RB — measured Rust execution and assurance with pinned Galois tools (order 2026-10-08)

Three lanes, each run by `rbench <lane>` (`crates/btungsten-bench`, Rust:
build-copy preparation, subprocess control, wait4 measurement with time and
memory budgets, verdict recognition, receipts), each writing one receipt
(`btungsten.rb-receipt/1`) whose verdict is computed from typed result rows.
Measured receipts and the compatibility and PQ-scope report:
`docs/receipts/btungsten-rb/`. CI: `.github/workflows/btungsten-rb.yml`
(fast checks every push; each lane `--quick` when its sources change; the
full plan by dispatch with `plan=full`).

| lane | what runs | pins |
|---|---|---|
| RB01 | GaloisInc/swanky popsicle circuit-PSI cardinality: the upstream example, the provider `rb01-psi/rb01_psi.rs` in the same composition, then one role per process over loopback TCP with role-local inputs and a session handshake, on bounded fixtures; refusal, abort and timeout rows through fake peers and a fault-injecting relay; characterization of upstream behaviour outside the input policy | swanky `409d1ceb`, Rust 1.99.0 (Swanky's toolchain file), Swanky's lockfile and native CPU flags; the provider is one added example file in a build copy outside this workspace |
| RB02 | GaloisInc/rustcrypto-verification's AES proof: upstream `aes-run.saw` unchanged on the pristine specimen (reproduction), then `rb02-aes/rb02-aes256.saw` and `rb02-teeth-sbox.saw` on the specimen plus `rb02_teeth.rs` (AES-256 proven, three false claims refuted); crates.io `aes 0.8.4` (BNR's lockfile checksum) compared file by file with the verified fork | rustcrypto-verification `52d36ff4`, cryptol-specs `8638495a`; SAW 1.6 + mir-json `8cbf9af1` + nightly-2026-03-21 (the WB001/WB002 bundle) |
| RB03 | Crux-MIR on `ops/ant-extsig/src/budget.rs` itself (`rb03-budget`, by `#[path]`): `fee_cap` / `plan_fee_cap`, `gas_limit_with_buffer`, `payment_floor_limit`; boundary vectors natively and under Crux; ten properties over their stated domains (p2 assumes a non-zero gas limit); two faulty variants that must be convicted | crux-mir at crucible `25d0f369` (upstream CI artifact, digest checked), mir-json `ece1622c`, nightly-2026-03-21, what4-solvers snapshot-20260622 (cvc5 integer blasting through `rb-cvc5-intblast`; bitwuzla as cross-check) |

Receipts: full-plan run 37923430005 at `073697abb`, one GitHub-hosted
runner per lane (`docs/receipts/btungsten-rb/ci-37923430005/`; the report
there carries every table).

| lane | verdict | what the receipt shows |
|---|---|---|
| RB01 | PASS: 14 VECTOR, 14 SAMPLED-ADVERSARIAL, 3 MEASUREMENT, 8 CHARACTERIZATION (recorded, not correct); independent hosts NOT-RUN | the evaluator's output equals the plaintext cardinality in every session, up to 65,536 elements a side (two processes, loopback TCP: 2.7 s median and 1.19 GB to the evaluator on a 4-CPU runner); refusal, abort and timeout rows classified, and not offered as malicious security; six upstream behaviours outside the input policy recorded (five as CHARACTERIZATION rows, one from the source); classical, not post-quantum, base OT |
| RB02 | PASS: 8 EQUIVALENCE, 3 TEETH, 3 VECTOR | upstream's six AES proofs reproduced unchanged (346 s); AES-256 proven again and three false claims refuted with counterexamples; the verified fork's `src` is byte-identical to the crates.io `aes 0.8.4` BNR locks; BNR on x86_64 with AES-NI runs AES-NI, which no proof here covers |
| RB03 | PASS: 10 properties proven, 3 TEETH, 6 VECTOR; optional bitwuzla cross-check 6 proven, 4 INCONCLUSIVE, 3 TEETH | `fee_cap`, `plan_fee_cap`, `gas_limit_with_buffer` and `payment_floor_limit` hold their ten properties for every `u128`/`u64` input (p2 assumes a non-zero gas limit, the case p1 covers; cvc5 integer blasting, about 1 to 2 s each); both faulty variants convicted |

**RB01 is an experimental benchmark adapter. Its functional and performance results do not establish suitability for sensitive data or production use.** `rbench rb01` and the provider print it, with what the run does, its parties, data, output recipient, limits and unresolved risks, before anything executes; the receipt binds that notice by version and SHA-256.

Tools layout `rbench` expects with `--tools`. RB02: `<tools>/saw/bin/saw`,
`<tools>/mirjson-root/bin/cargo-saw-build`, `<tools>/mir-json` (checkout
with `rlibs`). RB03: `<tools>/crux-mir/<dist>/bin/crux-mir`,
`<tools>/mir-json-inst/bin`, `<tools>/mir-json` (checkout with `rlibs`),
`<tools>/solvers`, `<tools>/dl/*.zip`. The CI jobs build exactly these from
pinned, digest-checked assets.

The one production change: `ops/ant-extsig/src/budget.rs` `plan_fee_cap`
now delegates its arithmetic to `fee_cap` and only formats the refusal
message. Formatting a symbolic `u128` produced solver goals that did not
close. Every call site and message is unchanged, and RB03's
`correspondence-split` row holds the new function to the old one on 74,536
inputs.

## PQ — proofs for the post-quantum stack (founder order 2026-10-08)

Design: `docs/specs/SPEC-BTUNGSTEN-PQ-1.md` (every algorithm: what is proven,
inherited, tested; the teeth each gate must catch; lanes PQ00-PQ15). CI:
`.github/workflows/btungsten-pq.yml`, one job per lane.

| lane | artifact | status |
|---|---|---|
| PQ00 teeth | `crates/btungsten-teeth` — T-VACUOUS and T-TRUNCATE, no dependencies; `pq00-teeth-vortex.sh` + `teeth-vortex/pq00_teeth.rs` run them against distributed-lab/vortex-rs at `3c0affd9320a` in a build copy outside the workspace | RUNS — 9 tests (positive controls on SHA3-256 and SHAKE256-96, planted prefix hash convicted at len 257 pos 256, planted count-free verifier convicted). Against vortex: T-VACUOUS CONVICTS `verify()` twice (zero openings; zero openings with a FALSE evaluation claim), T-TRUNCATE CONVICTS `RSis::hash()` (collision at len 257, pos 256). `cargo tree -i vortex` on the workspace: no such package |
| PQ01 vectors | `crates/btungsten-pq` — `pq-kat` runs every NIST ACVP case at ACVP-Server `975de31eb83d` (`kat-manifest.json`: 20 files pinned by size and SHA-256, fetched, never committed) for ML-KEM-512/768/1024 (keyGen, encapsulation, decapsulation expanded and seed, both key checks), ML-DSA-44/65/87 (keyGen; sigGen external-pure and internal, deterministic and hedged, expanded and seed keys; sigVer; external μ where exposed) and SLH-DSA-SHAKE-256f (keyGen, sigGen external-pure and internal, deterministic and hedged, sigVer), each on two implementations: RustCrypto ml-kem 0.3.2 / ml-dsa 0.1.1 (what bsigner links) and libcrux 0.0.11; RustCrypto slh-dsa 0.2.0-rc.5 and fips205 0.4.1 | Local receipt 2026-10-08 (WSL x86_64, 57 s, 75 MB): **2,729 executed, 2,729 passed, 0 failed; 86 required (set, function, implementation) rows, 0 missing**; 137 TEETH controls (one input byte flipped per group must change the answer or be refused) all held. NOT RUN, printed with reasons: HashML-DSA / HashSLH-DSA pre-hash groups (unused by the estate), external-μ on libcrux (no μ interface) and hedged μ on RustCrypto (randomness only through an RNG), the eleven SLH-DSA parameter sets the estate does not use. Was 17 cases (ML-DSA-65 + ML-KEM-768 only, `surfaces/pq-kat.json`); the two pins agree on the eight files they share (unit test) |
| PQ03 derivation | `crates/bpq-core` (no_std, no dependencies; bsigner builds every HKDF info string through it) + `pq03-cryptol/BpqDerive.cry` + `pq03-saw/` + `pq03-saw-check.sh`; CI `.github/workflows/btungsten-pq-saw.yml` | Local receipt 2026-10-08 (WSL, SAW 1.6, bitwuzla, 93 s): BUILD PASS; EQUIVALENCE **PROVEN** `context_ok`, `args_ok`, `info_len`, `info_byte`, `info` (bpq-core == spec; `info` for every input, the helpers in the domain `info` calls them in); PROVE-UNIVERSAL **PROVEN** `labelsPrefixFree`, `infoFits`, `infoPadded`, `rootIsolated`, `deriveInjective` (two different admitted (label, context, counter) triples never share an info string, all seven masterPrk labels); TEETH 4 of 4 refuted with counterexamples (DEL admitted; a prefix label; control bytes admitted; counter cap 0x7e). FINDING repaired: contexts were unrestricted, so the K1 retry counter could collide with a context's last byte; the context rule (1 to 64 printable ASCII) and a K1 counter cap of 31 now hold in bpq-core, bpq.js and bzdid-key.js (SPEC-BPQ-1 §2), refusing no context the wallet builds. DIFFERENTIAL: `surfaces/bzdid-derive-vectors.json`, 9 rows over every label from the browser's own functions, reproduced by bsigner; KAT: HKDF-SHA256 RFC 5869 A.1-A.3. bsigner 66 of 66, bpq-core 5 of 5, e2e/bpq 20 of 20. Not yet: SHA-256 compression and HMAC/HKDF at L4. CI: bTunGsTeN PQ SAW green on b57c73921 (run 37886784935) |
| PQ03 SHA-256 | `pq03-cryptol/Sha256.cry` (FIPS 180-4, K and H0 computed from integer roots of the primes) + `pq03-harness/sha256.rs` (sha2 0.10.9 soft.rs and consts.rs compiled verbatim) + `pq03-saw/sha256.saw` + `pq03-sha256-check.sh` (the `.crate` checked against Cargo.lock) | CI receipt 2026-10-09 (bTunGsTeN PQ SAW run 37932930215, 3 s; locally 5 s): PIN PASS; SPEC-CHECK 5 of 5 (primes, published K and H0, FIPS digests of "", "abc", the two-block example); EQUIVALENCE **PROVEN** 6: K32 and H256_256 = derived constants, two-round function and message schedule = FIPS for every input, the 64-round block function = FIPS compress (composed from those two), one block through `compress` = FIPS; TEETH 2 of 2 (Σ1 rotation 7, one K bit) refuted. The soft path only: x86_64 with SHA extensions runs SHA-NI, not covered |
| PQ02 Keccak-f[1600] | `pq02-cryptol/KeccakF1600.cry` (FIPS 202, constants derived) + `pq02-harness/harness.rs` + `pq02-saw/shipped.saw` (keccak 0.1.6, under sha3 0.10) + `pq02-harness/harness022.rs` + `pq02-saw/shipped022.saw` (keccak 0.2.2, under ml-dsa, ml-kem and slh-dsa) + `pq02-saw-check.sh` (both `.crate`s fetched and checked against Cargo.lock) | CI receipt 2026-10-09 (bTunGsTeN PQ SAW run 37919612155; locally 417 s, peak 13.4 GB): PIN PASS; SPEC-CHECK 5 of 5 (zero-state lanes, SHA3-256 "" and "abc", the ρ walk); EQUIVALENCE **PROVEN** the crate's own generic round body equals FIPS 202 `keccakRound k` for every state, all 24 constants (91 s in CI); TEETH 1 of 1 (one ρ offset off by one, refuted). keccak 0.2.2 (CI run 37925287105): its soft backend's round body, compiled verbatim, **PROVEN** equal to `keccakRound k` at all 24 constants (17 s). In both crates the step to 24 rounds is the crate's loop, read, not proven: no 24-round comparison closed (bitwuzla and z3 90 min, ABC, an agreement run) |
| PQ04 byte layouts | `crates/bpq-core/src/layout.rs` (bsigner calls it for every `bpq1/` label, nonce, segment length and binding validator; `open` and `seal_self` cut segments with it) + `pq04-cryptol/BpqLayout.cry` + `pq04-saw/` + `pq04-saw-check.sh` | CI receipt 2026-10-09 (bTunGsTeN PQ SAW run 37919612155): EQUIVALENCE **PROVEN** `domain_byte`, `domain_len`, `nonce`, `seg_ok`, `segment_count`, `body_len` (Some, None), `segment_plain_len`, `utc_timestamp`, `claim_kind` (10, 3 s); PROVE-UNIVERSAL **PROVEN** `domainsDisjoint` (13 labels), `nonceInjective`, `bodyExact` (for any segment count), `segmentsTile` (over the integers, z3), `atNoNewline`, `kindNoSeparator`, `bindInjective` (bounded MODEL of verify_bind: 63-byte id, up to two claims in any order, kinds and values up to 8 bytes; the preimage builder in bsigner is not proven equal to it); TEETH 9 of 9 refuted (lowercase z; prefix domain; 64-bit wrapping BODY check, refuted at len 2^64-1 seg 2^24; empty last segment; at validator dropped; '=' in a kind; at, kind and value rules loosened inside bindInjective). Stated, not proven: the step from bitvector to integer division (the bvudiv definition; z3 Unknown after 78 min). No length makes `open` panic: every part is a checked range, parts that do not tile the body are refused |
| PQ05/PQ06 base fields | `pq05-field/` (module-lattice 0.2.3, checksum-pinned, through cargo-saw-build; ml-kem's and ml-dsa's own `define_field!` arguments, checked) + `pq05-cryptol/Field.cry` + `pq05-saw/field.saw` + `pq05-field-check.sh` | CI receipt 2026-10-09 (bTunGsTeN PQ SAW run 37935979095, 79 s; locally 224 s): PIN PASS (3 crates + both invocations); EQUIVALENCE **PROVEN** 11: ML-KEM conditional subtraction, Barrett for every product and every sum of two products, add, sub, neg, mul; ML-DSA conditional subtraction, add, sub, neg; TEETH 2 of 2 (each precondition dropped, refuted). ML-DSA Barrett and multiply: the shipped code built as release builds run it IS the Barrett algorithm (SAW, about 1 s each; CI run 37955111771), the algorithm is correct over the integers (z3: constants, and the remainder in [0, 2q) for every product), and that its 128-bit words never wrap at these magnitudes is read; the debug build's underflow assertion in 128-bit words stays open (bitwuzla, ABC, yices, 30 min each) |
| PQ05 ML-KEM NTT | `pq05-cryptol/KemNtt.cry` (FIPS 203 Alg. 9 and 10, twiddles computed and held to Appendix A) + `pq05-ntt/` (ml-kem 0.3.2 under the workspace's exact lock) + `pq05-ntt-names.py` + `pq05-saw/ntt.saw` + `pq05-ntt-check.sh`; CI job `saw-ntt` | CI receipt 2026-10-09 (bTunGsTeN PQ SAW run 37955111771, job saw-ntt, 44 min): PIN PASS (18 packages = the workspace's); SPEC-CHECK 5 of 5 (twiddle and γ tables vs Appendix A, 128 * 3303 = 1, NTT^-1 undoes NTT, NTT-domain product = schoolbook negacyclic product); EQUIVALENCE **PROVEN** 8: ml-kem's `Elem` add, sub, mul; its NTT = Algorithm 9 and inverse NTT = Algorithm 10 for every in-field polynomial (all 896 butterflies matched, field operations uninterpreted); its Barrett instance for every sum of two products; base-case multiply = Algorithm 12 for every i < 128; multiply_ntt = Algorithm 11 (2,095 s); TEETH 2 of 2 (a bent twiddle, a bent γ, refuted) |
| PQ05 X-Wing | `scripts/btungsten/pq05-xwing-draft.{json,mjs}` + bsigner `xwing_matches_the_draft_vectors` (ignored locally, run in CI job `pq05-xwing`) | CI receipt (run 37905980541): draft-connolly-cfrg-xwing-kem-11 (2026-09-23, pinned by size and SHA-256) Appendix C: browser (bpq-lib, what bpq.js calls) 3 of 3 vectors pass keygen, encapsulation and decapsulation, TEETH caught one changed shared-secret byte; bsigner 3 of 3 pass keygen and decapsulation, one changed ciphertext refused. The browser also passes draft -06's vectors (local). Settles SPEC §8's revision question: ours is draft -11, label last in the combiner. SAW (`crates/bpq-core/src/xwing.rs`, `pq05-saw/`, CI run 37919612155): EQUIVALENCE **PROVEN** `combiner_input`, `split_seed`; `combinerBinds` **PROVEN**; TEETH 1 of 1 (a combiner without pk_X, refuted) |
| PQ11 classical + BIP-39 | `crates/btungsten-pq` `classic-kat` + `classic-manifest.json` (bitcoin/bips `200f9b26`, C2SP/wycheproof `12fd3aaf`); `scripts/btungsten/pq11-classic-kat.mjs`; `crates/bpq-core/src/bip39.rs` + `pq11-cryptol/Bip39.cry` + `pq11-saw/`; `crates/bsigner/src/bip39.rs` | CI receipts (runs 37905980541, 37919612155): **1,485 of 1,485** on the Rust implementations: BIP-340 sign 8/8 and verify 19/19 (k256 0.13.4), Wycheproof ECDSA secp256k1 476 plain (404 by result, 72 `valid` high-s refused by k256's low-S policy and listed by tcId) and 464 Bitcoin-variant, Wycheproof X25519 518 (x25519-dalek 2.0.1); BIP-340 on the wallet's noble schnorr 27 of 27. BIP-39 SAW: EQUIVALENCE **PROVEN** `indices`, `indices_ok`, `unpack`, `decode_ok`; PROVE-UNIVERSAL **PROVEN** `mnemonicRoundTrip` both ways and `badChecksumRefused` with the hash left free; TEETH 2 of 2. bsigner now reads the 24 words (`--rec-env` takes the code or the words); the official list equals the browser's word for word; the browser's phrase for the derive-vector root reads back to that root in Rust |
| PQ12 FROST lane, steps 1 to 5 (authorization, PSBT, sighash, gate, FROST) | `crates/bsigner/src/taproot.rs` + `psbt.rs` + `intent.rs` + `frost.rs` (feature `frost`, chilldkg-rs `=0.5.0`, unaudited) (`bsigner taproot-sighash`, `taproot-address`, `psbt-inspect`, `btc-intent`, `bpq-attest-intent`, `btc-verify-intent`) + `scripts/btungsten/pq12-bip341.json` (BIP-341 `wallet-test-vectors.json`, BIP-174 and BIP-371 texts, all at bitcoin/bips `200f9b26`, fetched, never committed); CI job `pq12-taproot` | Local receipt 2026-10-09 (WSL): BIP-341 7 of 7 script-tree cases (leaf hashes, root, tweak, output key, scriptPubKey, address, control blocks) and 7 of 7 key-path inputs (five shared hashes, SigMsg, sighash, tweak; the expected witness verifies and is reproduced byte for byte), 20 teeth refused; BIP-174 19 of 19 invalid PSBTs refused (each for its own defect), 10 valid + 10 walkthrough + 4 signer-check PSBTs parsed; BIP-371 11 of 11 invalid refused, 6 of 6 valid parsed; the reference signer's key-path signature verifies over bsigner's sighash. Authorization + gate (SPEC-BPQ-1 §5c, `crates/bsigner/src/intent.rs`): the honest spend verifies; refused: 418 of 418 unsigned envelope-byte edits, 15 signed fields the PSBT contradicts, 6 PSBT changes, another authority, kind, version, a clock past expiry. Browser twin: bpq.js WB001 codec 19 of 19 pinned rows, each side verifies the other's authorization; bsigner 81 of 81, bpq e2e 23 of 23. FROST (feature on): a 2-of-3 ChillDKG key signs both inputs of an ML-DSA-authorized PSBT, each a valid key-path witness; 7 refusals (one signer, replayed session id, missing input, another group's share and coordinator, a partial over another input, fewer partials than the threshold); bsigner 82 of 82 with the feature. Audit gate 1 (CI run 37931727642): chilldkg-rs absent from bsigner's default build; chilldkg's own 64 vector tests pass. Audit gate 2 (cargo audit 0.22.2, same run, lock-wide, 529 crates): 2 vulnerabilities and 3 warnings, none in bsigner's graph with or without `frost` (`cargo tree -p bsigner -e normal -i <crate>`, both ways): rsa 0.9.10 RUSTSEC-2023-0071 (wallet-relay, royalreview, atmirror, adapter-arweave; no fixed version; clears when those crates drop RSA or rsa ships a constant-time release), rustls 0.23.42 RUSTSEC-2026-0285 (composition, wallet-relay, royalreview, zano-watcher, atmirror, banchor, bindexer; clears at rustls >= 0.23.45), bincode 1.3.3 RUSTSEC-2025-0141 unmaintained (settle-solana, through the Solana crates; clears when they migrate), proc-macro-error2 2.0.1 RUSTSEC-2026-0173 unmaintained and chacha20 0.10.1 yanked (in Cargo.lock, in no normal or build graph of the workspace on x86_64 Linux; clear at the next lock refresh). Not yet: key ceremony + sealed shares + CLI rounds, sighash differential, the wallet press |
| PQ13 Nostr attestation | SPEC-BPQ-1 §5b; bpq.js `attestNostr`/`verifyNostr`; bsigner `attest_nostr`/`verify_nostr`, `bpq-attest-nostr`; `surfaces/bpq-nostr-vector.json` | Local: bsigner 71 of 71 (the attestation test: honest verifies, another event / uppercase hex / short id / kind / version / id / empty signature / another key's signature refused, the browser-made vector verifies; and the bsigner-made `surfaces/bpq-nostr-rust.json` reproduced byte for byte), e2e/bpq 22 of 22 (the browser verifies the bsigner-made one). `bpq1/nostr-event` is the 13th label, inside `domainsDisjoint`. How a relay carries it is the upstream ask to block/buzz |

### PQ10 — one Plonky3 proof of the receipt count statement (2026-10-08)

`crates/btungsten-p3count` (its own workspace; Plonky3 git pin
`eab7f0e3662500cde47cb0b6dad61afc99e3deac`, 0.8.0). The claim is
count.circom's; the commitment is Poseidon2 over KoalaBear in the same full
tree; `fp` is three range-checked limbs (exactly 64 bits; the circuit took any
BN254 scalar). The AIR is a post-order stack machine, one permutation per
row, upstream's Poseidon2 constraints run through upstream's `SubAirBuilder`,
the tree schedule fixed in preprocessed columns. Config: `HidingFriPcs` with
`MerkleTreeHidingMmcs` on both sides (Keccak-256), OS-entropy blinding, a
compile-time `ZK == true` assertion, the instance label (statement, n,
members) seeding the Keccak transcript. Parameters chosen by p3-security
(`p3count-scan`): log_blowup 3, 104 queries, 16 query-PoW bits.

Local receipts 2026-10-08 (WSL x86_64, 8 cores, another lane's SAW job
running beside it):

| | PLONK/BN254 (count.circom) | Plonky3 hiding STARK |
|---|---|---|
| security figure | pairing-based, classical (Shor forges) | proven 102 bits (p3-security, unique-decoding) at n = 64, 1,024 and 16,384; conjectured 111 / 108 / 104, a conjecture |
| ceremony | Hermez pot17 (54 contributions + beacon) | none (transparent) |
| proof, n = 64 | 768 B (24 words) | ~340 KB |
| proof, n = 1,024 / 16,384 | not run in this lane | ~484 KB / ~720 KB |
| prove, n = 64 / 1,024 / 16,384 | not measured in this lane (1k/10k NOT RUN) | 0.55-0.64 s / 2.2-2.4 s / 39-64 s, peak 13 MB / 80 MB / 1.3 GB |
| verify | 10.6-12.1 ms CPU billed on jungle4 (on chain) | 11-49 ms / 17-19 ms / 25-29 ms native; on chain NOT RUN |

- **FORGERY**: `p3count forgery` (n = 64, asymmetric cohort): the honest
  control verifies; refused: wrong count, reversed claim, non-binary kind,
  wrong root, skipped receipt, nonzero pad, two public-value swaps, the
  39-member key, 256 one-bit flips across the 341,369-byte proof (256 of 256
  refused), truncation, T-VACUOUS (no commit-phase openings; zero queries
  opened, 13 arrays emptied), and the proof checked under another instance
  label.
- **LEAK, v1** (`leak/PREREGISTERED-STARK.md`, one run): **FAIL** on the
  hiding config: F0 passed (no shared commitments or opened values), F2
  smallest p 1.228e-5 against 1.677e-5, F3b p 0.0002, F4 4 of 20 correct
  (interval 0.057 to 0.437). The non-hiding control failed every family. The
  result stands; v1's families treated correlated numbers inside a proof as
  independent and its leave-one-out centroid is biased below chance.
- **LEAK, v2** (`leak/PREREGISTERED-STARK-v2.md`, registered before new
  data, one run on new proofs, permutation over proof labels): **PASS** on
  the hiding config: G0 0 shared, G1 permutation p 0.957, G2 0.767, G3 0.252,
  G4 0.194 (threshold 0.0125 each). TEETH: the non-hiding control fails every
  family, G0 with 45 pairs sharing the trace commitment. Wording cap: no
  registered family separated the classes; upstream calls the construction
  "only statistically zk".
- **COST**: native numbers above. On chain NOT RUN. One finding already
  stands: the n = 16,384 proof (~720 KB) is larger than the
  `max_transaction_net_usage` of 524,287 bytes in jungle4's genesis
  (`contracts/zkreceipts/jungle4-genesis.json:7`; the live chain's value not
  re-read), so it cannot be verified in one
  transaction as it is; the n = 64 proof fits by size. A pairing wrapper is
  ruled out (SPEC §PQ10).
- CI: `btungsten-pq.yml` job `pq10-plonky3` runs the tests, the FORGERY
  battery and the three scale points on every push. Not yet done: the SAW
  row-soundness proof of the AIR (SPEC §PQ10 `rowSound`), the on-chain
  verifier, and audit gate 2 for this workspace (cargo-audit is not installed
  on this box; gate 1 holds by construction: the crate is its own workspace,
  outside the default build).

### PQ07, PQ08 and PQ09 (2026-10-08)

| lane | artifact | status |
|---|---|---|
| PQ08 law signatures | `scripts/verify-bpq-signatures.mjs` (noble) + `scripts/verify-law-signatures-rust.sh` (bsigner, RustCrypto ML-DSA-65) | Every file `docs/PQ-LAW.json` names must carry a signature over its CURRENT bytes from a pinned signer. STALE now fails (it used to pass), as do a missing signature, a law-shaped file left out of the list, an empty list, and listed law files with no pin file. Both implementations: 7 of 7 law files current; the Rust leg's TEETH (a changed copy of a law file) is refused. e2e/law-signatures.test.mjs 4 of 4 |
| PQ07 succession | `crates/bsigner/src/bpq.rs`: `succession_keys`, `card`, `handover`, `verify_handover`; CLI `bpq-handover`, `bpq-verify` | The Rust side now derives the SLH-DSA-SHAKE-256f succession key (fips205 0.4.1, SK.seed ‖ SK.prf ‖ PK.seed) and reproduces the browser's succession commitment and id on every `surfaces/bpq-vectors.json` row: the cross-check SPEC-BPQ-1 §6 listed as missing. Handover v1 (SPEC-BPQ-1 §5): the honest handover verifies after a JSON round trip; refused: an attacker's SLH key under the victim's id (the ML-DSA-only forger), a swapped new card, a handover replayed onto another id, a moved `at`, a newline in `at`, empty card / slh / sig / to (T-VACUOUS), a handover to itself, the reserved context. CLI end to end: an honest handover verifies (rc 0), a moved timestamp is refused (rc 1). bsigner 63 of 63 in 6.4 s (fips205 and its hashing optimised in dev builds). Not yet: the browser side, and carrying a handover inside a did-autonomi log |
| PQ09 keys at rest | `crates/bsigner/src/keys.rs` + `bpq::seal_self` | A seed reaches disk only inside a SPEC-BPQ-1 sealed object, one `self` slot under the root vault of the owner's recovery words (`bheart.keyset/2`); commands that touch a seed take `--rec-env VAR`; `verify` reads the public half with no unlock; a plaintext `bheart.keyset/1` file is refused until `bsigner keys-seal` reseals it. Tests: `no_seed_byte_reaches_disk` scans every written file for the seed in raw, base64url and hex form; the wrong words and a tampered body open nothing; bsigner 60 of 60; the nerve test 7 of 7 through sealed keys; selftest PASS. The Rust sealer is checked by the other implementation: `surfaces/bpq-rust-sealed.json` opens in bpq.js (e2e/bpq.test.mjs 19 of 19). Boundary: rewriting a file does not erase the disk blocks the old plaintext sat in |

Audit two gates for PQ01's new crates, read from rustsec/advisory-db
2026-10-08 (cargo-audit is not installed on this box): RUSTSEC-2026-0076,
-0077 (libcrux-ml-dsa verify, patched >= 0.0.8), -0125, -0126
(libcrux-ml-dsa AVX2, patched >= 0.0.9): 0.0.11 resolved. RUSTSEC-2026-0074,
-0207, -0208 (libcrux-sha3, patched >= 0.0.10): 0.0.11 resolved.
RUSTSEC-2025-0133 (libcrux-intrinsics aarch64, patched >= 0.0.4): 0.0.9.
RUSTSEC-2026-0212 (libcrux-secrets aarch64, patched >= 0.0.6): 0.0.6 and
0.0.7. RUSTSEC-2025-0144 (ml-dsa timing, patched >= 0.1.0-rc.3): 0.1.1. None
for libcrux-ml-kem, slh-dsa, fips205. The libcrux-ml-dsa verify advisories
are exactly the class sigVer vectors catch.

## WB002 — the extinct-infrastructure specimen (CURRENT, founder order 2026-10-07)

**Invariant (the killer one):** no change of implementation, network,
author, storage provider, cryptographic algorithm, or execution
environment may transfer sovereign authority without the currently
authorized sovereign action.

**Specimen:** SimpleAssets frozen at upstream `e6a042f` (2021-03-17,
v1.6.1, LGPL-2.1), vendored verbatim under `wb002-specimen/` with
provenance and file hashes (`wb002-specimen/PROVENANCE.md`). Do not
modernize it; do not build it; do not depend on it. Attack the port,
preserve the artifact. Upstream field evidence for the failure classes
under test: issues #26, #19, #21, #6 (all still open, re-verified
2026-10-07 — see PROVENANCE.md).

| artifact | status |
|---|---|
| `wb002-specimen/simpleassets-e6a042f/` + `PROVENANCE.md` | PRESERVED — 17 files incl. the 2021-era wasm/abi; nothing built or executed |
| `crates/btungsten-wb002` — **the model** (Rust-first rule, 2026-10-08; the JS port is retired): the 2021 state machine (SA.cpp line refs), two profiles `Specimen` (upstream quirks intact) and `Adapter` (the extracted BNR semantics); anchored event log with periodic checkpoints; export/import migration; truth-lattice observers (Indexer / SpecimenUI / AdapterUI). **Sovereignty is the SAW-proven `btungsten_wb002_core::sovereign`** of each asset's table status, and on the Adapter profile every sovereignty-moving NFT/NTT action is replayed through the proven `step` (the model panics on any disagreement). That replay convicted a fidelity bug the JS port carried: on `detach` the child kept its attach-time `owner`, where SA.cpp:581 sets `s.owner = owner`; fixed | RUNS — `cargo test -p btungsten-wb002` |
| `crates/btungsten-wb002/tests/wb002/` — **the battery, driving the model itself** (ported row for row from the retired JS battery): faithful-port row, idata byte-stability, the killer invariant over 600-step hostile histories on BOTH profiles (specimen violations must be NAMED or the battery fails), the 26/27-row wrong-signer matrix with fingerprint-stable rollback, F-1..F-4/F-8 A/B convictions, the truth lattice (drop/corrupt/replay/lag; adapter disputes, never lies), the torture rows (kill author / lose contract + fragment recovery / key + algorithm rotation / partition-reorg / contract replacement + migration + tamper refusal + naive-importer conviction / marketplace death), the 1,000-year leg, the TEETH row, and the hardening rows (R-1 rollback, R-2 content-authenticated display) | RUNS in CI (workspace job) — 24 tests |
| `wb002-cryptol/BTungstenWB002.cry` (was `Sovereign.cry`; renamed to its module name) — formal twin; `sovereignContinuity` for ALL states/actions of the abstraction, plus the F-1 TEETH machine `stepSpecimen` | RUNS in the CI formal job via `wb002-formal-check.sh` (cryptol 3.6.0 pinned). Local receipt 2026-10-07 on the same pinned bundle: **TYPECHECK PASS; CHECK-SAMPLED PASS (100 random + constructed F-1 row); PROVE-UNIVERSAL `sovereignContinuity` PROVEN (Q.E.D., 0.071s, Z3); TEETH PASS (the solver refutes `continuityOf stepSpecimen`)**. The staged file had never parsed (landed RED first). Sabotage control: a planted borrower-theft seam passed 100 random samples and was REFUTED by the prove leg. EQUIVALENCE not attempted — the proof covers the Cryptol abstraction, not the JS port or the wasm |
| `crates/btungsten-wb002-core` (moved from `wb002-rust/`, now a workspace crate the model links) — `sovereign`/`step` (decoded phase/head enums, one guarded `match`; no dependencies) | RUNS — `cargo test`: named seams + continuity exhaustive over a 4-actor universe (131,072 transitions; sampled class) |
| `wb002-saw/sovereign.saw` + `sovereign-defs.saw` + `sovereign-teeth.saw`, run by `wb002-saw-check.sh` in `.github/workflows/wb002-saw.yml` (SAW 1.6 by digest; mir-json at SAW 1.6's own submodule pin `8cbf9af1`, schema 13) | Local receipt 2026-10-07 on the same pins: **EQUIVALENCE PROVEN, three mir_verify obligations** — `step_matches_spec` (tag < 5, head < 16), `step_refuses_rest` (every other input is a no-op), `sovereign_matches` (all of [3]); together every raw input of the Rust `step`. **TEETH PASS** (the same obligation against `stepSpecimen` fails with a counterexample). Sabotage control: a planted Claim-by-holder guard was REFUTED with an exact counterexample (tag 2, holder 64 ≠ offeree 16). Scope: core ≡ spec, so continuity holds of the Rust function the model links; NOT the wasm |
| `crates/btungsten-wb002/src/bin/wb002-wasm-equiv.rs` (ported from `wb002-wasm-equiv.mjs`; boot readiness in `src/ready.rs`) + `wb002-wasm-receipt.json` (the 2026-10-07 JS-model receipt, kept as history) — the WASM-vs-model beat: the VENDORED 2021 wasm+abi deployed VERBATIM onto a fresh local dev chain under **Antelope Spring 1.2.2**, the 46-step corpus executed on BOTH the chain and the Rust model (Specimen profile) with one shared clock, compared on accept/refuse class + full state projection after EVERY step | EXECUTED 2026-10-08 against the Rust model — three fresh-chain runs: **46/46 matched, 0 class mismatches, 0 state mismatches, final projections agree; 14 refused steps proven atomic ON CHAIN; F-1 confiscation ACCEPTED live; F-3 owner-attach refused live.** Corpus-sampled evidence, NOT a proof; local dev chain only |

### §model-hardening (founder review 2026-10-07 — R-1/R-2, both repaired)

- **R-1 transactional atomicity.** The port had no rollback boundary: a
  refused action retained mutations made before its refusal (the
  return-to-lender path deleted the delegation + emitted `delegateclose`
  before `requireAuth`; partial batches committed their prefix). Antelope
  specifies failed transactions restore prior state — the vendored C++
  relies on that boundary. REPAIR: every public action now runs inside
  `tx()` — state tables, counters AND committed event-log effects roll
  back on any throw; nested action calls (delegate→transfer,
  undelegate→transfer, issuef→transferf) join the outer transaction
  (inline-action semantics); `tx()` is public so a caller can bundle
  several actions into one atomic unit. The battery now demands, after
  refused attempts as well as successful ones, that the ENTIRE pre-state
  and log are preserved (fingerprint-stable; 240 refused transactions
  rolled back whole in the adapter history alone). The specimen's
  authorctrl policy is untouched — rollback fidelity is not
  modernization.
- **R-2 authenticated display.** The AdapterUI compared a matching ROOT
  STRING against the trusted checkpoint and folded indexer-supplied
  contents: a substituted checkpoint BODY behind a genuine root was
  believed, and a self-consistent but unconfirmed log extension was
  promoted to current ownership. REPAIR, two obligations: (a)
  authenticate the checkpoint CONTENTS — `Chain.checkpointAnchor()`
  carries the checkpoint's parent root so the UI recomputes the root
  from the event body; (b) bound displayed state to an authenticated
  history — `display()` answers either at the authenticated TIP
  (bracketed by a trusted `{seq, root}` tip anchor with every link
  verified: current truth) or CHECKPOINT-SCOPED at its explicit height
  (never promoting an arbitrary suffix); a root-only anchor fails
  closed. Links prove self-consistency, not consensus acceptance — that
  sentence is now executable.
- Red-first receipt: the hardening suite landed against the MERGED
  module with the founder's counterexamples failing (delegated-transfer
  refusal and partial batch × both profiles; checkpoint-body
  substitution; unconfirmed extension) and the honest controls passing;
  the repair turned all rows green. Dispatch:
  `docs/dispatches/2026-10-07-btungsten-wb002-model-hardening.md`.

### §findings — the specimen's convictions (each = one BNR adapter requirement)

- **F-1** `authorctrl=true` FTs: the issuer's signature ALONE moves or
  burns any holder's balance (SA.cpp:692-695, 787). REJECTED for BNR
  sovereign funds by founder ruling (issuer authority ≠ confiscation
  authority); kept as an adversarial vector — the battery proves the
  confiscation succeeds on the specimen profile and refuses on the
  adapter profile.
- **F-2** the delegation return path in `transfer` accepts the LENDER's
  signature without undelegate's period check (SA.cpp:261 vs :514) —
  bounded tenure is not enforced on every exit path. Adapter enforces it
  (the borrower may still return at any time).
- **F-3** `attach`/`detach` (and `attachf`/`detachf`) require the
  AUTHOR's signature, not the sovereign's (SA.cpp:537, 568, 874) — the
  author can lock a sovereign's assets and value into containers the
  sovereign cannot unlock. Adapter binds composition to the sovereign.
- **F-4** offers never expire — a standing claim from 2019 is claimable
  in 3019 (1,000-year consent hazard, convicted in the millennium leg).
  Adapter offers carry TTL.
- **F-8** `changeauthor` moves the mdata-authority envelope on the
  author's signature alone (SA.cpp:14). Adapter requires the sovereign's
  co-signature.
- **Field evidence, not model inventions:** upstream issues #26/#19
  (indexer/UI truth diverging from consensus — the truth-lattice rows),
  #6 (author-side freeze — the marketplace-death torture row), #21 (CDT
  rot — the wasm+source preservation answer).

### §extractions — the semantics BNR keeps (founder mapping, 2026-10-07)

`idata` → COMMIT (commitment only; no identity/personal material —
COMMIT owns that boundary) · `mdata` → mutable status pointer ·
NTT → credential/capability primitive · `offer→claim` → consent ·
`delegate(period, redelegate)` → bounded authority (the Silent-Pay
lineage: owner → bounded authority → temporary executor → receipt) ·
`attach/attachf` → capability composition · author RAM payer →
sponsored sovereignty (payer is never an owner — proven in the
faithful-port row).

### §wasm-beat — what running the 2021 artifact on the 2026 client taught (2026-10-07)

- The wasm runs UNMODIFIED on Antelope Spring 1.2.2 (Savanna-era) once
  its OWN documented deployment link is applied (`set account permission
  … --add-code`): the contract's `sendEvent` deferred transactions act
  as the contract account and every Antelope since eosio.code requires
  the link. That link is deployment configuration, not artifact
  modification.
- Bring-up receipts, honestly: Spring's keosd serves the wallet API on
  its unix socket (HTTP wallet endpoints 404); a fresh wallet is born
  unlocked; WSL's poor timer accuracy needs `--max-transaction-time`
  raised or the subjective deadline kills heavier calls
  nondeterministically; and a failed `get table` must NEVER read as an
  empty table (the harness fails loudly instead).
- The corpus validated the model's most consequential claims LIVE: the
  F-1 issuer confiscation is ACCEPTED by the real contract on the
  issuer's signature alone; the F-3 owner-attach is refused (composition
  is author-gated upstream); the partial batch refuses with the WHOLE
  state untouched (Antelope's rollback boundary — the same class the
  hardening beat added to the model); delegation expiry follows real
  chain time; ids match naturally (both sides run the same genesis
  counters — only `offerfs.id` diverges, because upstream allocates
  deferred-event ids from the same counter the model deliberately does
  not port; the harness reconciles it and names that in its header).

### §next (named gaps, in order)

1. ~~wasm-vs-model equivalence~~ **DONE 2026-10-07** (see §wasm-beat +
   the receipt; corpus-sampled, local dev chain).
2. ~~Cryptol typecheck + `:check sovereignContinuity`~~ **DONE
   2026-10-07** — and past it: `:prove sovereignContinuity` PROVEN for
   the abstraction, TEETH green (see the artifact table + the CI formal
   job's WB002 step). SAW = Linux x86_64, still with item 3.
3. ~~Rust twin of sovereign/step, then the SAW equivalence~~ **DONE
   2026-10-07** — the twin is proven equal to the Cryptol spec for all
   inputs (see the artifact table). What it does NOT do: make the
   battery's histories provable. Those run against the JS port, and the
   JS-port-to-twin link is still sampled. Closing it needs either the
   twin driving the battery, or a vectors bridge from port to twin.
4. **Live leg**: the same torture rows against a deployed Vaulta
   contract (bzcodejungle testnet), not only the local dev chain.
5. **CI leg**: `.github/workflows/wb002-wasm.yml` runs the corpus three
   times on fresh local chains, on Ubuntu 22.04 with checksum-pinned
   Spring 1.2.2. Each run uploads fresh JSON receipts (14-day retention).
   This is corpus-sampled evidence, not a proof or testnet acceptance.
   Local runs may set `WB002_HTTP_PORT` and `WB002_P2P_PORT`; state and
   wallet directories are unique per invocation. Cleanup signals only
   owned child processes; occupied ports fail rather than evict siblings.
6. **WB003+**: scale and century-transition legs per SPEC §axes 5-6.

## WB001 — the intent-binding invariant (LIVE in CI)

**Invariant:** no valid signature may authorize any intent other than the
exact intent that was committed to. One bit of drift in domain, nonce,
epoch, action, destination, capability, amount, expiry, payer or payload
must break verification.

**Input-boundary law (repair 2026-10-07, founder review of the genesis):**
text fields accept well-formed Unicode only. The genesis module accepted
unpaired UTF-16 surrogates, which `Buffer.from(value,'utf8')` silently
maps to the same replacement bytes (`efbfbd`) — so `'\uD800'`, `'\uD801'`
and `'\uFFFD'` were three distinct accepted strings sharing ONE
authorization, in every text field. Not an Ed25519 forgery: a many-to-one
conversion BEFORE signing. The twin gap sat in decode
(`toString('utf8')` replaces instead of refusing). Repair: refuse at
encode (`bt-wb01:utf16`), refuse at decode (`bt-wb01:utf8`); valid
international text, supplementary characters and a legitimate U+FFFD
stay accepted, byte-exact. Red-first receipt in
`docs/dispatches/2026-10-07-btungsten-wb001-boundary-repair.md`.

| artifact | status |
|---|---|
| `crates/btungsten-wb001-core` — **the model** (Rust-first rule, 2026-10-08): canonical envelope encoder, UTF-8 DFA, validity predicate, offsets, byte dispatch; `no_std`, no dependencies, written function-for-function against `BTungstenWB001.cry` so SAW can prove each one | RUNS — `cargo test` (workspace job); PROVEN equal to the spec by SAW (below) |
| `crates/btungsten-wb001` — refusal codes, strict decoder (refuses malformed UTF-8 through the SAW-proven DFA), UTF-16 input boundary, Ed25519 binding via `libcrux-ed25519` =0.0.9 (safe Rust compiled from HACL*, which is F*-verified for memory safety, functional correctness against RFC 8032 and secret independence) | RUNS — `cargo test -p btungsten-wb001` |
| `crates/btungsten-wb001/tests/wb001/` — **the battery, driving the model itself** (ported row for row from the retired JS battery): injectivity corpus (25), 21 field-move mutants, 1,640 one-bit envelope mutants, 512 one-bit signature mutants, 5 structural forgeries, domain/nonce/epoch/expiry participation, cross-key, the naive-encoder TEETH row; boundary suite (32 lone-surrogate refusals, surrogate-class crossings, 8 international round trips, 9 malformed-UTF-8 refusals, malformed-wire verify refusal); pinned vectors; bridge; 4,000 random valid intents round-tripped and pairwise distinct; Ed25519 three-way agreement | RUNS in CI — 20 tests |
| `wb001-vectors.json`, `wb001-bridge.json` — pinned: 10 positives byte-for-byte, 9 refusals by code; the 8 constructed terms. Derived by `tests/wb001/pin.rs` from the model; the drift gate requires the committed bytes to EQUAL a fresh derivation (full file) | PINNED — the Rust model reproduced every byte the retired JS twin pinned (only the provenance text changed) |
| `wb001-cryptol/BTungstenWB001.cry` — the spec: meaningful lengths, canonical padding, the concrete UTF-8 DFA, the true variable-length `wire`, closed-term bridge to the model's bytes | TYPECHECK + CHECK-SAMPLED gate the CI formal job; budgeted `:prove` rows recorded there |
| `wb001-saw/rust.saw` (+ `rust-teeth.saw`) — EQUIVALENCE: 11 `mir_verify` obligations, the Rust model equal to the spec for every input in each domain: `utf8_step`, `well_formed_utf8_{64,128}`, `pad_ok_{32,64,128,4096}`, `valid_intent` (all intents), `offsets` (all intents), `byte_at` and `encode` (all length-bounded intents) | PROVEN — `wb001-saw.yml` (SAW 1.6, mir-json at SAW 1.6's pin); TEETH: `byte_at` against the spec one position off is refuted with a counterexample |
| `wb001-saw/injective.saw` + `WB001Injective.cry` (+ `injective-teeth.saw`) — PROVE-UNIVERSAL `wireInjective` by the first-difference ladder: a constructed witness `kStar` (first differing envelope position), ten per-field cases, `validImpliesBounded`/`validImpliesPadded`, `wireIndexDef` with `byteAt` opaque, composed by explicit instantiation (`goal_insert_and_specialize`) | PROVEN — 21 rungs, every one required by name; TEETH: the first case without the padding premise is refuted with a counterexample |
| `wb001-cryptol/Ed25519.cry` — **the missing algorithm artifact**: RFC 8032 §5.1 Ed25519 as an executable Cryptol spec, SHA-512 included, its 80 round constants and initial hash COMPUTED from the FIPS 180-4 definitions (no transcribed table) | SPEC-CHECK PASS — SHA-512("abc"), all four RFC 8032 §7.1 vectors (key, signature, verify), two model envelopes signed by OpenSSL, verifier refuses flipped signature/message/key |
| `wb001-ed25519-oracle.json` (+ `wb001-ed25519-oracle.mjs`) — 24 rows signed by OpenSSL (node:crypto), refused unless OpenSSL first reproduces the RFC vectors; the model's signer (libcrux/HACL*), `ed25519-dalek` and the Cryptol spec must each match byte-for-byte | PINNED — libcrux, dalek and OpenSSL agree on 24/24 |

### §result-classes (founder ruling 2026-10-07)

Four distinct results, recorded separately; NO one of them is ever
recorded as another:

| class | meaning | status |
|---|---|---|
| TYPECHECK | the .cry parses and typechecks | **PASS in CI** — gates every push (cryptol 3.6.0, pinned asset) |
| CHECK-SAMPLED | `:check` — adversarial arm (malformed classes rejected by `validIntent` BEFORE injectivity is evaluated) + constructed arm (closed terms: boundary-shift twins, astral Unicode, legitimate U+FFFD, combining sequences, near-collision payload pairs) + random arm | **WIRED IN CI** — all three arms gate the job |
| PROVE-UNIVERSAL | `:prove` per obligation across the stated domain | **THEOREM CORRECTED 2026-10-08 (founder review, SHA 8b2ac34ae): the original `wireZeroTail` quantified over ALL intents while documented for valid ones — and was REFUTED, executed** (payload len `0xfffffff0` wraps the [32] offset arithmetic so envLen lands inside the later blocks; the witness is the permanent `zeroTailWrapRefuted` regression). The corrected theorem states its valid-intent premise; the proof is now DECOMPOSED into per-obligation lemmas with per-obligation budgets — `validImpliesBounded` (45s), `offsetsOrdered` (90s), `zeroTailFromBounds` (180s), then `wireZeroTail` and `wireInjective` (240s each; 240 not 300 because prove processes died by SIGTERM twice at 269s/289s before a 300s wrapper could classify — signal death is the fact, its sender unevidenced). Live verdicts are the run's own lines. A clean exit with NO recognized verdict is a diagnostic FAILURE (red), never a silent green |
| EQUIVALENCE | SAW: implementation == spec | **PROVEN 2026-10-08** — the Rust model (`crates/btungsten-wb001-core`) equals `BTungstenWB001.cry` for every input in each stated domain (`wb001-saw/rust.saw`, 11 obligations, with TEETH). And `wireInjective` is PROVEN universally in SAW (`wb001-saw/injective.saw`). Ed25519 is no longer only assumed: the signer is HACL*-verified code (`libcrux-ed25519`), checked byte-for-byte against OpenSSL, dalek and our own RFC 8032 Cryptol spec; a SAW proof of libcrux against `Ed25519.cry` is NOT claimed |

A missing tool, a skipped obligation or a solver timeout is NOT-RUN,
never success. `:check` is testing; `:prove` is the proof step. And per
the Beat 3 scrutiny: a PROVE-UNIVERSAL receipt is canonical only if the
validity predicate is CONCRETE in the model — `wellFormedUtf8` is now
the real DFA with the runtime validator's exact transition law, not an
abstract placeholder — or connected to the runtime validator by a
separately proved refinement. A proof can be correct about the wrong
accepted language; that class of mistake is what Beat 2 eliminated and
this law keeps eliminated.

### §ladder (founder ruling 2026-10-07 — the default sequence for every workbench)

```
RED counterexample
→ accepted-language repair
→ shared vectors
→ formal wire alignment
→ TYPECHECK
→ CHECK-SAMPLED
→ PROVE-UNIVERSAL
→ eventually implementation/model EQUIVALENCE
```

No step substitutes for a later one; the WB001 chain is the reference
instance (surrogate collision → utf16/utf8 gates → wb001-vectors.json →
concrete-DFA BTungstenWB001.cry → CI formal job). The "formal wire alignment"
step is EXECUTED since the B1 repair (2026-10-07): wb001-bridge.json
pins the runtime bytes of every constructed term, both CI legs
re-derive them every run — before B1 the twin's bridge block was
comment-only and not one Cryptol wire byte had ever been compared to a
runtime byte.

### §next (named gaps, in order)

1. ~~Cryptol typecheck + `:check wireInjective`~~ **DONE** (CI formal job).
2. ~~Rust model of `canonical`/`decode` reproducing the vectors~~ **DONE
   2026-10-08** — and it is the model, not a twin: the JS module and its
   battery are retired; the battery drives the Rust code SAW proves.
3. ~~SAW equivalence proof~~ **DONE 2026-10-08** (`wb001-saw/rust.saw`),
   plus `wireInjective` PROVEN (`wb001-saw/injective.saw`), plus the
   Ed25519 RFC 8032 Cryptol spec (`wb001-cryptol/Ed25519.cry`).
   Open: a SAW proof that `libcrux-ed25519` equals `Ed25519.cry` (its
   own correctness proof is HACL*'s F* development).
4. **Distributed leg:** the bounded BNR job through a hostile P2P
   workflow — kill services, reroute, replay, fake peer, partition,
   heal — final result must still satisfy this invariant and produce the
   same meter-verifiable outcome (Emissary as sacrificial specimen, not
   dependency). Superseded as "WB002" by the founder's 2026-10-07
   SimpleAssets order; kill/partition/heal/reorg/replay are now torture
   rows of WB002's battery, and the Emissary leg remains open under its
   own workbench number.
5. **Scale/century legs (WB003+):** progressively larger physical runs
   and simulated century transitions per SPEC §axes 5-6.

### Founding receipts

- Origin: founder order 2026-10-06 (bTunGsTeN formalization, six hard
  properties, Workbench 001 design). Dispatch:
  `docs/dispatches/2026-10-06-btungsten-lane.md`.
- Toolchain posture, with precision: NSA's `Foundation` repo (Apache-2.0)
  provides Cryptol specifications + SAW assurance machinery and a
  primitives corpus (AES, ECDSA specs, HMAC, SHA2/3…). It does NOT ship
  an ECDSA SAW proof artifact today — checked 2026-10-06, and we do not
  claim otherwise. We apply the machinery ourselves; anything not yet run
  by us carries UNVERIFIED.
- Precedent instances already in-tree: `tools/net-doxx/` (the tungsten
  test harness — verdict-from-observations receipts, live FAILs
  published) and SPEC-ZK-RECEIPT-AGGREGATES-1 §tungsten (the ZK lane's
  four-receipt coupling gate). bTunGsTeN-1 names the umbrella those
  gates instantiate.

## SK001 — the Skaists seat-sovereignty deployment battery (SPEC-SKAISTS-SEAT-SOVEREIGNTY-1)

Not a workbench of the standard's own WB sequence — the first bounded
DEPLOYMENT instance of it: the Skaists LOVERnment DAO's 7,776-seat
(6⁵) organism, whose identity layer must satisfy bTunGsTeN at the
scale where every seat can be exercised exhaustively.

**Invariant (founder ruling 2026-10-07, verbatim in the spec):**
Skaists Seat Sovereignty — at every governance epoch, no natural human
may control more than one active membership seat, every active seat
must resolve to exactly one eligible living human and exactly one of
the five constitutional energy types, and no verifier needs access to
that human's underlying biometric or civil identity to establish
eligibility.

**The arithmetic law:** 7,776 = 6⁵ = 2⁵·3⁵ has no factor of five, so
equal integer fifths do not exist. Membership population is a measured
variable; governance weight is the exact rational 1/5 per constituency,
CONSTANT in population (no float ever represents it — 3 × (1/5) ≠ 0.6).
The nearest packing {1556, 1555, 1555, 1555, 1555} is recorded and NOT
constitutional.

| artifact | status |
|---|---|
| `sk001-seat.mjs` — the model: beginEpoch/occupy/depart/release/carrySeat (COMMIT), prove (PROVE — the five frozen predicates), compress (COMPRESS — the fixed-weight fold), constitutionalWeights vs populationShares (the sabotage governor), exportEra; typed `bt-sk01:*` refusals, fails closed | RUNS — imported by the battery |
| `sk001.test.mjs` — the battery (10 rows, each printing its own 0→N count): 6⁵ derived + equal-fifths impossibility by exhaustion; tightest packing recorded not constitutional; weight ⊥ population over 7 adversarial vectors; double-seat/seat-taken refusals + bijection; 8 malformed types refused; the five predicates frozen-shape with stale-epoch/not-live/vacant refusals and per-epoch carry; private-evidence byte-scan of proof and era export; full-cap fill + the 7,777th refused + one release/re-admit breath; exact COMPRESS fold of all 7,776 votes on constant weights; TEETH — the population governor and float weights convicted by name | RUNS in CI (same globbed step) — green 10/10 |

Model-scale honesty: this receipts the in-memory MODEL. The sha256
commitment is a binding placeholder only — hiding is NOT claimed; the
boundary the battery receipts is structural (evidence bytes have no
code path into the registry, the proof, or the export). No live proof
system, hiding commitment, or SETTLE chain exists for Skaists seats
yet — every live-layer claim stays UNVERIFIED until its own beat runs
(the spec's §deployment-status table is the ledger). Axes exercised:
2, 5, 6 (model scale).

Genesis receipt: the battery caught two of its own bugs before landing
— Buffer identity-comparison defeating the uniqueness index (equal
sha256 digests are distinct Map keys), and the BigInt wire form — both
fixed before the 10/10; see
`docs/dispatches/2026-10-07-skaists-seat-sovereignty.md`.
