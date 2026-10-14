# x0x implementation-specific PQ battery

Run from the BNR repository root:

```sh
cargo install cargo-audit --locked --version 0.22.2
python3 scripts/btungsten/x0x-pq-check.py
```

The check builds this isolated test workspace with `--locked`, runs the
official-vector battery, convicts an altered expected answer, refuses an
empty coverage run, and executes both dependency audit gates. Logs and JSON
receipts go to `target/x0x-pq/`; `--out DIR` and `--cache DIR` override those
locations. `.github/workflows/btungsten-pq.yml` runs the same command and
retains its evidence even when a gate fails.

Fresh local receipt, 2026-10-14 (Rust 1.98.1, x86_64 Linux): **752/752**
checks pass: **515 KAT, 164 DIFFERENTIAL, 73 TEETH**, with **37/37** required
coverage rows present. The expected-byte control produced two real failures;
the empty-run control refused all 37 missing obligations. Audit gate 1 passed.
Gate 2 scanned 222 locked dependencies: no vulnerabilities, two unmaintained
dependency warnings (atomic-polyfill and proc-macro-error2). The original
lane's CI job also passed in run `38598493201` at `e246b7954`; downloading its
hosted artifact returned HTTP 403. The controller now prints the actual
tallies and result classes in CI logs as well as writing artifacts. Retained evidence:
[`docs/receipts/x0x-pq-2026-10-14`](../../docs/receipts/x0x-pq-2026-10-14).

`inventory.json` binds x0x **v0.48.0 at 32bf552808**, source snapshots,
saorsa-pqc **0.5.1**, fips203 **0.4.3**, fips204 **0.4.6**, and their SHA/RNG
dependencies to x0x's recorded lock. This workspace's lock was resolved from
that x0x lock, with the independent test implementations added. The controller
checks the recorded sources and dependency checksums before building.

| path | executed evidence |
|---|---|
| fips203 ML-KEM-768 | ACVP keyGen, deterministic encapsulation, expanded/seed decapsulation, both key checks; the existing PQ01 input-mutation controls |
| fips204 ML-DSA-65 | ACVP keyGen, pure external/internal deterministic and supplied-randomness sigGen, pure external/internal sigVer; the existing PQ01 input-mutation controls |
| Saorsa ML-KEM API | the same official keyGen, decapsulation and key-check cases; actual OsRng keyGen/encapsulation interoperates with RustCrypto and libcrux in both encapsulation directions |
| Saorsa ML-DSA API | the same official keyGen and pure sigVer cases; actual OsRng signing on official secret keys checked independently by RustCrypto and libcrux, including contexts; additional message-boundary tests |
| Saorsa legacy ML-DSA wrapper | actual OsRng keyGen/signing checked by both independent verifiers; changed message refused |

The reused vector files come from BNR's `kat-manifest.json`, which pins
ACVP-Server by commit and every file by byte count and SHA-256. FIPS203-tr1
and FIPS204-tr1 seed-key groups remain separate rows. Every required row
must execute. Prehash and external-mu limitations remain explicit NOT RUN.

Randomized Saorsa signatures and encapsulations are **DIFFERENTIAL** results,
not deterministic KAT results. The wrapper hardcodes OsRng, so the supplied
randomness KAT runs on its underlying FIPS crate; the receipt names that
boundary. The signature tests consume messages of 0, 1, 63, 64, 65, 135, 136,
137, 255, 256, 257 and 4096 bytes. Changed last message/signature bytes, a
different signer and malformed empty imports must fail. Changed KEM ciphertext
must return a different shared secret: ML-KEM implicit rejection is not an
error return.

The expected-answer control changes one official expected public-key byte
**after** checksum verification, then runs the same equality checks; its
receipt must contain real failures with no load error or missing row. The
empty-run control must fail with zero executed cases and named missing
obligations. An unrelated tool failure does not count as a convicted control.

Audit gate 1 confirms saorsa-pqc does not enter BNR's default workspace.
Gate 2 records cargo-audit's output and native exit status without suppressing
advisories. The receipt's local battery PASS does not mean the dependency
audit is clean; inspect `audit-gate2.log` and `run.json`.

The receipts separate **KAT**, **DIFFERENTIAL**, **TEETH**, **NOT RUN** and
**UNESTABLISHED**. This lane does not establish the complete Cryptol comparison,
FIPS/Saorsa equivalence proofs, entropy quality, RNG failure propagation,
validation status, ChaCha20-Poly1305/BLAKE3/SHA-256 qualification, transport
composition, every application call site, or full-system qualification.
BNR's RustCrypto SAW proofs are not inherited by these implementations.
Execution of x0x's own selected composition tests is recorded separately in
the dispatch; this crate does not link the complete x0x application.
