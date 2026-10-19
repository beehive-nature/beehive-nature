# Tungsten: real x0x delivery and two private-chain proof routes

Serves BNRoSe Charter L2/L3. Continues the founder-authorized local experiment
in owned worktree `../wt-codex-solana-tungsten`, branch
`codex/solana-tungsten-2026-10-03`, after `d237cb25855cfb78c417d124f931893ef7d48d45`.
PR: https://github.com/beehive-nature/beehive-nature/pull/338.
This supersedes the earlier dispatch's unimplemented transport/chain/PLONK
items for **private local acceptance only**.

## Outcome and command

`./tools/solana-tungsten/lab/run-local.ps1` completed with exit **0** using
fresh identities, fresh Groth16 setup, a fresh PLONK build, fresh chain state
and isolated networking. Final run:
`/home/travi/bnr-tungsten-lab/run-20261003-110519-553404e6`.
Public receipts, proofs, keys, source/build hashes, tool versions and namespace
admissions are committed in `tools/solana-tungsten/evidence/2026-10-03-local.json`.
Private wallets, tokens, identity keys and node state stay outside Git.

| Acceptance | Measured result |
| --- | --- |
| x0x receiver evidence | 111/111 payloads verified in receiver history; 1/10/100-message batches |
| x0x boundaries | Unauthorized API request refused; changed payload under same logical ID refused; restart retry did not duplicate receiver history |
| Solana SBF | Real pinned verifier program and VK publish/readback on private Agave validator |
| Solana bad proof | Submitted on-chain, rejected with instruction custom error 6; recipient balance unchanged |
| Solana valid proof | Atomic verify + seven faucet-lamport transfer finalized in slot 9 |
| Solana recovery | Worker exited after submit, before confirmation; new process without signing key recovered identical signed bytes; no second payment; exclusive outbox refused duplicate reservation |
| Vaulta equivalent statement | Five public fields equal Groth16 fields; real snarkjs PLONK host verification and existing C++ arithmetic compiled to WASM |
| Vaulta settlement | Seven fixture units debited from escrow and credited to worker; block 10 irreversible; balances conserved |
| Vaulta refusals | Wrong recipient, overpayment, forged proof and replay; replay still refused after node restart |
| Receipt core | Same job, commitment, output, authorization scope and principal across independent counterfactual ledgers |
| Existing RECON-1 | PARTIALLY-SATISFIED on both; principal observed once despite duplicate evidence, distinct fixture fee unpaid |

The receipt schema is shared, but rail evidence is explicitly different. A
transaction ID, key/deployment pin, chain ID, cost and finality must not be
discarded to claim that only two adapter-name strings changed.

## Costs measured, not assumed away

Final 100-message sequential batch: **79.64 bundles/s**, p50 **12.05 ms**, p95
**15.58 ms** from send to receiver readback. Payload total **472,890 bytes**;
namespace loopback TX **9,381,081 bytes**, including both local HTTP control
APIs and receiver readback. Aggregate daemon CPU **1.73 seconds**; end-of-batch
RSS **68,079,616 / 71,069,696 bytes**. This is not public-network egress or a
concurrent mesh throughput benchmark.

Solana successful transaction: **92,229 compute units**, **5,000 lamports**
network fee, **7 lamports** principal. Registration/funding/bad-proof costs
are additional setup/test expenses, not included in that successful-tx fee.
Vaulta successful action: **7,432 microseconds CPU**, **110 NET words**.
Those values are resource measurements on this host, not fiat pricing or a
comparison of equal-valued assets. The fixture units have no exchange rate.

An earlier harness repeatedly fetched the entire receiver backlog. Correcting
that to one newest row removed quadratic readback overhead. An earlier sysfs
counter came from the parent namespace; replaced with namespace-aware netlink.
Those earlier bandwidth numbers are excluded from acceptance.

x0x may reduce central transport services and their per-user operating burden.
It does not remove peer CPU, bandwidth, storage, availability work, authority
checks, signing custody, smart-contract risk or settlement fees. This lane
establishes a reference acceptance suite; it does not certify a universal
gold standard, elimination of all attack surfaces, or cost independent of use.

## Source boundaries and pins

- Rust: `src/lib.rs:SquareJob::generate_constraints`, `Worker::bundle`,
  `SolanaHost::verify`, `LocalGate::plan` under `tools/solana-tungsten/`.
  Public fields: input, output, two 128-bit job-digest limbs, nonce. Circuit
  validates computation/binding; host recomputes the authorized job digest.
- x0x v0.46.0, commit `cea64f20eddc3d8c71cfe4fba7464d3f137eb5c4`;
  ant-quic 0.27.54 and saorsa-gossip 0.5.86. `lab/x0x_delivery.py:run`
  requests durable application acknowledgments and verifies receiver bytes.
  `lab/bundle.py:validate` pins the key from a separate owner artifact.
- Solana verifier `8bd06b4fb07f636c1872993a99f1a296b23b69fa`, Agave 4.2.2;
  `lab/solana.mjs` and `solana_recover.mjs`. Program loaded into genesis with
  upgrades disabled. This is not evidence about a public deployment.
- Vaulta: `lab/square.circom`, `lab/build_plonk.py:main`,
  `lab/tungsten.cpp:tungsten::settle`; byte-for-byte existing
  `contracts/privacy/plonk_verify.hpp:plonk_verify` and `field256.hpp`, with
  generated test-circuit VK constants in the owned build directory. Spring
  1.2.2 / CDT 4.1.1 / Circom 2.2.3 / snarkjs 0.7.6. Production privacy
  contracts and payment-circuit constants are unchanged.
- INVOICE-1/RECON-1: `lab/reconcile.mjs` reuses
  `scripts/lib/bpay-invoice-generic.mjs:buildGenericInvoice` and
  `scripts/lib/recon-reconcile.mjs:reconcileObligation`.

Groth16 setup is ephemeral single-party. PLONK uses a supplied local pot12
PTAU, whose hash is recorded; no production ceremony assurance. Cryptographic
claims stop at the source-backed checks above, sound by construction / isolated
by design. No independent cryptographic audit was performed.

## Isolation and upstream obligations

Each runtime phase passed upstream x0x namespace admission: changed network
namespace, only loopback, no foreign/default route, UID 1000, zero capabilities,
no supplementary groups, no_new_privs=1. WSL root establishes the namespace;
the workload runs unprivileged. Private HOME/X0X_HOME/tmp, 480-second timeout
and namespace-init cleanup apply. This is not full filesystem isolation.

The upstream caller initially returned `sudo: interactive authentication is
required`. `prepare_isolation.py` now invokes its config preparation and lets
WSL root enter the same setup/admission functions. This substitutes the WSL
timeout/namespace launcher for upstream's sudo/heartbeat supervisor; it is not
represented as the complete upstream test suite.

Priority upstream checked before implementation: #622's outstanding work was
folded back into [#504](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5906795696)
on September 30; its delivered/published matrix, protected named-group and
per-pair timing/skip-legacy-bus acceptance remain separate from this lane.
[#505 has explicit field acceptance](https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210).
This two-peer loopback result does not close #504 or substitute for field
evidence. No upstream message was posted and no public laptop mesh was started.

## Validation and repaired failures

- Rust: **8 passed, 0 failed, 0 ignored**, 2.35 seconds for boundary tests;
  cargo test, clippy `-D warnings`, rustfmt check all exit 0. The host-only
  Node runner still asserts **OPEN**, exit 0.
- Full private-chain command passed once before dependency hardening and again
  afterward. Final successful public receipt is the one exported above.
- Provisioning script passed from the already downloaded pinned archives,
  rebuilt SBF from its cache, and installed with lifecycle scripts disabled.
  Fresh network download steps were executed during the initial provisioning.
- npm initially reported **7 entries: 4 moderate, 3 high**. Pinned overrides
  `jayson=5.0.0`, `underscore=1.13.8` resolve them; npm audit now reports
  **0 known vulnerabilities**. Full Solana and PLONK routes passed with the
  new lockfile. This is dependency audit evidence, not general security proof.
- Python compilation, JS syntax checks and `git diff --check` passed.
- Repaired: missing x0x `network_id`; unsupported validator flags; duplicate
  transaction preflight response; Spring DB guard larger than the initial
  allocation; cleos errors reported on stdout; PowerShell/WSL path conversion;
  VK generator stdout mistaken for its output file. That generator briefly
  created a public header in the shared checkout root; exact hash comparison
  identified and removed only that artifact. Final generation has explicit
  owned output paths. No shared WIP was staged or committed.
- Expected CDT warnings: absent fixture Ricardian clauses. Node emits the
  `punycode` deprecation warning. Neither is hidden as a successful audit.

CI includes host boundaries, lab syntax and dependency audit; it does not run
the installed private-chain harness. Before this follow-up, PR #338's host
checks passed; one duplicate wallet job failed on a 30-second locator timeout
while its paired run passed. That unrelated UI failure is not repaired by this
lane. New-head CI is evaluated separately after push.

## Production acceptance still outstanding

Authenticated bPay grants and revocation; production canonical encoding and
circuit setup; hardware/isolated signer custody; a shared durable cross-rail
authorization ledger; public-chain deployment and upgrade trust; real-token
Vaulta transfer; partitions, churn, malicious peers, concurrency, bounded
queues, load shedding and geographically distributed cost measurements.
Solana replay protection here is an exclusive local outbox with an identical
signed transaction, not an on-chain BNR capability contract. Vaulta enforces
its one fixture grant on-chain, not the production bPay protocol. The chains
are independent counterfactual runs, not two spends from one global grant.
