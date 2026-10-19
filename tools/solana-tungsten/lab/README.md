# Private-chain acceptance lab

From an owned Windows worktree, after provisioning:

```powershell
./tools/solana-tungsten/lab/run-local.ps1
```

Parameters: `-Distro Ubuntu`, `-Lab /home/travi/bnr-tungsten-lab`,
`-Ptau /home/travi/plonkport/pot12_final.ptau`,
`-Circom /home/travi/.cargo/bin/circom`. These defaults describe the measured
host; override them for another installation. Every run gets a new private
directory. Existing wallets, node data and mesh instances are never reused.
The script stops its own daemons and keeps the evidence and disposable state.
Wallet state is private and must not be committed or uploaded.

## Prerequisites and provisioning

Windows Rust/Cargo 1.98.1; PowerShell; WSL Ubuntu with native Python (tarfile
`filter='data'` support), Node/npm, Rust/Cargo, Circom 2.2.3, CDT 4.1.1 and
Spring 1.2.2 (`nodeos`, `cleos`, `keosd`). The local test uses an existing
pot12 phase-2 PTAU file and records its hash. This is not a production ceremony
assurance. No previously installed wallet or signing key is used.

Run this inside WSL, substituting the worktree path if needed:

```sh
python3 /mnt/c/Users/travi/wt-codex-solana-tungsten/tools/solana-tungsten/lab/provision.py \
  --lab /home/travi/bnr-tungsten-lab
```

Provisioning downloads x0x v0.46.5 and Agave 4.2.2 release archives with pinned
SHA-256 checksums, exact-commit source archives, then runs `npm ci
--ignore-scripts` with the checked-in lockfile and builds the pinned verifier
with `cargo-build-sbf --arch v3`. It starts no daemon. Release checksum matching
is not a claim of independently verified maintainer signatures.

The npm overrides pin jayson 5.0.0 and underscore 1.13.8 to resolve the lab's
initial audit findings. The actual Solana and PLONK paths are rerun with these
versions. A clean npm audit is dependency evidence, not a cryptographic audit.

## Isolation

The runner prepares config with x0x's pinned `scripts/ci/isolated-runtime.py`,
then uses WSL's root entry only to establish network/PID/mount namespaces.
The upstream setup/admission functions drop to the caller UID with zero
capabilities, no supplementary groups and `no_new_privs=1`. Only loopback is
present; foreign/default routes are refused. Each phase has a 480-second
timeout and namespace-init cleanup. HOME, X0X_HOME and /tmp are private.

`prepare_isolation.py` replaces only the launch callback so Windows can enter
through WSL root without interactive sudo. This differs from upstream's full
sudo/heartbeat supervisor. We claim upstream admission plus the bounded WSL
launcher, not upstream's complete runtime acceptance suite. The fence isolates
networking and processes, not all host filesystem access.

## What runs

- `x0x_delivery.py`: two real x0xd peers, explicit local network plane, no hard
  coded bootstrap, discovery or port mapping; mutual card import; 1/10/100
  sequential durable sends. Every received payload is checked. Unauthenticated
  local API access, changed-payload logical-ID reuse and restart retry are
  exercised. A durable SQLite BNR inbox binds sender and logical ID to exact
  bytes across reopen and concurrent connections. Transport history can contain
  duplicates: the raw restart delta remains in the receipt, while the inbox
  must retain exactly 111 queued messages. This is queue idempotency, not
  exactly-once settlement or a distributed authority ledger. Netlink measures
  namespace loopback bytes, including HTTP control
  and readback; these are not public-network egress measurements.
- `bundle.py`: exact fixture job, recomputed digest/public fields and an
  out-of-band owner key pin. A received key never becomes trusted merely by
  arriving over x0x.
- `chains.py` / `solana.mjs`: real SBF verifier loaded as an immutable genesis
  program, VK staging/publish/readback, actual rejected forged-proof transaction,
  and atomic verify-plus-transfer of seven faucet lamports. Network fee ceiling
  is 5,000 lamports, separate from the semantic fixture fee. An exclusive,
  fsynced outbox precedes submission. The worker exits before confirmation;
  `solana_recover.mjs` starts without its key, resubmits identical signed bytes,
  checks finality and balance, and checks duplicate reservation refusal.
- `build_plonk.py`: equivalent five-public-field Circom circuit, local PLONK
  setup/proof/host verification, byte-for-byte copies of the existing
  `plonk_verify.hpp` and `field256.hpp` arithmetic, generated circuit-specific
  constants, and CDT compilation. Production circuit/constants are untouched.
- `vaulta.py` / `tungsten.cpp`: private Spring, ephemeral local wallet, protocol
  activation, trusted grant with amount/expiry/recipient checks, PLONK verification,
  atomic escrow debit/recipient credit and authorization consumption. Forgery,
  wrong recipient, overpayment and replay are refused. Balances conserve seven
  fixture units and replay remains refused after node restart. This is a
  fixture ledger, not `eosio.token` or a transfer of mainnet A.
  Feature activation is polled. The local node uses a 100 ms wallet RPC budget
  and 150 ms ABI serialization budget to tolerate development-host contention;
  these are not public-node performance claims.
- `reconcile.mjs`: existing INVOICE-1/RECON-1, terminal readback evidence,
  duplicate-evidence refusal and equality of the common semantic receipt core.
  The unpaid fixture-fee line keeps each result PARTIALLY-SATISFIED.

`acceptance.json`, phase receipts, public proof artifacts, build hashes and
namespace `admission.json`/`exit.json` remain in the run directory. Success
means the complete command exits zero, not merely that a daemon started.

## Limits of the measurements

Two peers, one host, sequential traffic and 111 messages cannot establish mesh
scale, public reachability, peer churn, partitions, adversarial traffic, loss,
backpressure or tail latency under concurrency. Local API/readback overhead is
included. A first harness read the whole backlog each time; the current one
reads the newest row, avoiding quadratic measurement overhead.

x0x can reduce centrally operated transport infrastructure. CPU, bandwidth,
storage, availability, signing custody and chain resources still have costs.
This lab makes those boundaries measurable; it does not claim all attack
surfaces disappear or operating cost is independent of usage.
