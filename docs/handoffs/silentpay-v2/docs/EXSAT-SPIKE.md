# Executed local native/EVM spike

The pinned exSat EVM contract compiled and ran on an isolated **Spring 1.2.2** node. The executable probe passed five tests: refused native deposits roll back token balances; EVM revert rolls back an earlier native write and nonce; native rejection rolls back an earlier EVM value transfer; rejected `exec` callbacks roll back native callback state; successful callbacks commit it. Evidence: [local-spike.json](../verification/current/local-spike.json).

This is a qualification of these specific local paths and artifacts. It is not an exSat-network deployment, a Jungle EVM deployment, an external-chain atomicity claim, or integration of Silent Pay's missing payment circuit. `exec` itself is a read-only EVM call; its callback is an inline native action. It must not be described as a general mutating EVM transaction.

## Pinned implementation

Official repository: [exsat-network/evm-contract](https://github.com/exsat-network/evm-contract/tree/c5fcfd1bcda9c414ab05c3d6116070b9e9ae3c47), commit `c5fcfd1bcda9c414ab05c3d6116070b9e9ae3c47`. This is an exact source commit, not a claim that a public deployment runs the same build. Its internal build macro says 1.0.0; the commit is the identifying version.

Compiler CDT 4.1.1, CMake 3.31.6; compiled EVM WASM SHA-256 `c0ec4e3c2971045d32518be14321741e286d63cc79873cf6a906ee493aa2f56d`, 480,703 bytes. Local node binary SHA-256 `080932810667b798f5c5fdbcc4e0b8d7dd1b30794ddc773914638eb3b1e88bda`. [pins.json](../tools/spike/pins.json) records the compile dependency commits. No upstream C++ source was patched. An interrupted fetch of unused Ethereum test fixtures was avoided by selecting only the required compile submodules.

The exSat contract's pinned [license](https://github.com/exsat-network/evm-contract/blob/c5fcfd1bcda9c414ab05c3d6116070b9e9ae3c47/LICENSE) is Business Source License 1.1 with a custom EOS-dependent production grant and a version-dependent change provision. The pinned [Spring license](https://github.com/AntelopeIO/spring/blob/v1.2.2/LICENSE) also has a custom grant and includes inherited MIT notices. This work uses the non-production permission for a local test. It does not assume either package is unrestricted MIT software or authorize a new production chain. Upstream source and its notices remain together in the ignored clone; distributing a derivative requires preserving applicable notices and reviewing dependency licenses.

## Actual APIs and mappings

The [action implementation](https://github.com/exsat-network/evm-contract/blob/c5fcfd1bcda9c414ab05c3d6116070b9e9ae3c47/src/actions.cpp) and [types](https://github.com/exsat-network/evm-contract/blob/c5fcfd1bcda9c414ab05c3d6116070b9e9ae3c47/include/evm_runtime/types.hpp) establish these distinct paths:

| API | Actual behavior and tested boundary |
|---|---|
| `call(from,to,value,data,gas_limit)` | Requires native `from` authorization; increments its native nonce and sets `abort_on_failure=true`. Used for the mutating rollback tests. |
| `exec(input, optional callback)` | Read-only EVM state; returns status/data/context or sends an inline callback without authorization entries. Fixture validates `get_sender()==spikeevm`; callback failure aborts the host transaction. |
| `bridgereg(receiver,handler,min_fee)` / `onbridgemsg` | Registered native message receiver and handler with a minimum fee. Not exercised by this milestone; do not equate it with the tested `exec` callback. |
| token `transfer`, `open`, `withdraw` | One configured native token contract/symbol maps native balance plus dust to EVM precision 18. Precision scaling is `10^(18-native_precision)`; non-open egress accounts reject dust. This is not a generic b token registry. |
| reserved EVM addresses | Native account identity is encoded in a reserved address range; this is public routing metadata, not an anonymity mechanism. |

The local fixture uses test EVM chain ID 25555, a newly generated genesis identity, a locally minted EOS-symbol test token, native accounts `spikeevm`, `spikefixture`, and `spikesilent`, and all supported protocol features listed in the receipt. Production throughput, hostile callback reentrancy, real verifier rejection, dust edge vectors and cross-network substitution remain outside this narrow probe.

## Reproduce

From WSL at the project root, with CDT and Spring already installed:

```sh
.venv/testenv/bin/python --version
# CMake is pinned in the project's test environment:
/home/travi/.local/bin/uv pip install --python .venv/testenv/bin/python cmake==3.31.6
bash tools/build-native.sh
bash tools/spike/build.sh
```

Then from Windows PowerShell:

```powershell
npm --prefix tools/jungle ci --ignore-scripts --no-audit --no-fund
node tools/spike/local.cjs
```

The harness pins the runtime binary and EVM artifact hashes, refuses an occupied localhost port, starts a unique node on 18888/19876, creates ephemeral signing material, executes the tests, stops only that node and removes its signing config. No Jungle key store is read. If it stops before a qualified result, inspect the saved failure receipt; a build alone is not a passing integration test.
