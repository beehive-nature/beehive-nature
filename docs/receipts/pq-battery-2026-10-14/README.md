# Fresh PQ battery execution, 2026-10-14

This directory records local execution, not a replay of older receipts and not
a CI qualification. BNR baseline: `25258d564` (descendant of the reviewed
`7e653693ca`). x0x: unmodified **v0.48.0 at `32bf552808`**.

| executed lane | observed result |
|---|---|
| BNR PQ00 Vortex controls | 2/2 tests; zero-opening verifier accepted both the vacuous and false-claim shapes; suffix collision reproduced; all three defects convicted; Vortex absent from BNR's default graph |
| BNR PQ01 official-vector battery | 2,729/2,729 counted checks; 86/86 required rows present; zero failures, missing rows or load errors; limitations remain printed in `pq01-final.log` |
| BNR Rust unit suites | bpq-core 14, bsigner 81, PQ battery 4, teeth 9; all passed; bsigner's three ignored vector tests executed separately below |
| BNR classical vectors | 1,485/1,485 Rust checks; 27/27 browser checks; low-S policy exceptions remain listed |
| X-Wing draft vectors | all three browser and Rust vectors passed, including the corruption controls |
| Law signatures | 7/7 current files verified by each implementation; changed-file control refused |
| Taproot/PSBT | all pinned BIP-341/BIP-174/BIP-371 cases passed; 20 Taproot teeth refused; see the full counted output |
| FROST | 2-of-3 authorized-spend test passed; all named refusal controls held; ChillDKG's 64 upstream tests passed; FROST absent from BNR's default graph |
| Browser PQ/authorization/sealing suites | 32/32 tests passed, zero skipped |
| Plonky3 | native tests and forgery battery passed; both true claims verified at n=64, 1024, 16384; proof sizes/security numbers are in each scale log |
| x0x application composition | group KEM/AEAD 12/12, upgrade signature 11/11, identity/certificate/introduction 68/68; **91/91** tests passed, zero skipped |
| New x0x implementation lane | **752/752**: 515 KAT, 164 DIFFERENTIAL, 73 TEETH; all 37 required rows present; separate receipts in `../x0x-pq-2026-10-14/` |
| Formatting / x0x lane lint / hook wiring | passed; clippy with `-D warnings` and the hook's positive/refusal controls executed |

The x0x selectors above were source-reviewed as inert: local crypto,
serialization and temporary files only. They do not instantiate a network
node. x0x's Rust 1.95.0 pin and its locked release test build were used;
BNR and the new standalone lane used Rust 1.98.1. The complete 4,547-test
x0x suite was not run, and no live public mesh was joined.

The current dependency audits are separate observations:

- The isolated x0x PQ test lock: 222 dependencies, no vulnerabilities;
  atomic-polyfill and proc-macro-error2 maintenance warnings.
- x0x's full recorded lock: **four rustls 0.23.45 advisories**
  (RUSTSEC-2026-0346/0347/0348/0349), five warnings. The normal dependency
  paths through ant-quic and reqwest are retained in `x0x-rustls-paths.log`.
- BNR's full recorded lock: **ten advisories** (five quinn-proto, four
  rustls, one rsa), three warnings. Its separate yanked-package lookups also
  encountered six registry HTTP 503 errors; that part of the registry check
  is incomplete. Full output retained; nothing is ignored or silently fixed.

Plonky3's preregistered one-run LEAK experiments were not rerun. On-chain
STARK verification, comparison against a freshly executed PLONK baseline,
hardware/device qualification, EcGFp5 and recursion were not executed. Neither
these observations nor the BNR formal proofs establish full-system x0x
qualification. Saorsa/FIPS L3-L5, entropy quality and every application/network
composition remain outside this lane's demonstrated coverage.

`x0x-identity.log` adds repository-required `PUBLIC-CONSTANT` annotations to
two upstream synthetic identifier lines. The raw stdout remains at
`/workspace/pq-artifacts/x0x-identity.log`; the receipt manifest records both
raw and retained hashes. Other native logs are retained verbatim.
