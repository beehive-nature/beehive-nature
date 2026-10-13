# ANT storage on the test network

This is the same hosted purchase as on Arbitrum One, run end to end on a local Autonomi test network where nothing has value:

**invoice → a bzDiD keychain signs → payment confirmed → upload → independent retrieval and hash check → reconciled receipt**

## The kit

| file | what it does |
|---|---|
| [`build.sh`](build.sh) | builds the pinned lab from source on any Linux host: `ant-devnet` from WithAutonomi/ant-node **v0.22.0 (commit 008d2ad)** with `--features test-utils`, and links **Foundry v1.8.5** `anvil`. Refuses an unpinned checkout. |
| [`start.sh`](start.sh) | a **new run**: ten storage nodes with WebRTC Direct endpoints, a local Anvil chain (31337) with the test ANT token and payment vault deployed, a manifest on port 25000. Refuses missing or wrong-version binaries and a taken port. |
| [`health.sh`](health.sh) | nine measured facts (manifest, network id, chain 31337 in the manifest and from the chain itself, at least 7 private-address endpoints, both processes with their memory). Exit 0 only when all pass. |
| [`evidence.sh`](evidence.sh) · [`evidence.ps1`](evidence.ps1) | what the lab exposes, measured: sockets, processes, versions, advertised addresses (guest side), and the host's forwarding, Hyper-V firewall, off-loopback reach and a foreign-oracle probe of the public address (Windows side). |
| [`stop.sh`](stop.sh) | stops it. **Destroys the chain and node state.** |
| [`loop.mjs`](loop.mjs) | the whole purchase in a real browser against the running network, with disposable test identities. |

Resource use, measured on this box: `ant-devnet` ≈ 260 MB resident with all ten nodes in-process, `anvil` ≈ 26 MB, ≈ 60 MB of disk, 8 cores mostly idle. Lab state lives under `~/ant-testnet/data` (`ANT_DEVNET_DATA`), apart from any real client data.

## Try it

1. Build once: `sh tools/ant-testnet/build.sh` (needs cargo; on this box in WSL with `~/.cargo/env` sourced).
2. Start: `sh tools/ant-testnet/start.sh`, then `sh tools/ant-testnet/health.sh`.
3. Open https://skaists.dev/surfaces/wallet.html?net=devnet#bpay-sec. The **TEST NETWORK** banner names how many private-address nodes it found and which loopback port the test chain answers on.
4. Connect a keychain, press **Get test ANT and test ETH**, choose a file, type a test ETH ceiling, press **Prepare storage invoice**, review the ANT total and the separate ETH ceiling, press **Authorize**.

The page uploads the file, retrieves it, compares the hash and shows the receipt.

## Which keychain pays, and how the page says so

The page never falls back silently. The session line under the purchase panel names the paying account and which keychain it belongs to:

- **The isolated TEST BUILD keychain** — `scripts/build-keychain.mjs --out DIR --origin https://keys-devnet.skaists.dev --parent https://skaists.dev --testnet TOKEN VAULT` builds the production keychain pinned, in the built copy only, to chain 31337 and the running network's own token and vault. It lives at its own origin; it can never carry `keys.skaists.dev`, and the source pin stays Arbitrum One (checked on every build). On `?net=devnet` the page mounts only that origin. The keychain announces its pin in every state message, and the page refuses by name any keychain pinned to another network than the one it pays on. Custody: the key lives in the keychain origin; the page can ask, never sign.
- **This page's own keychain** — when no isolated keychain is open, the wallet page's own bzDiD storage signer pays, pinned to the test chain, and the session line says exactly that. Custody: the key shares the wallet page's JavaScript realm.

`loop.mjs` records which one paid in its receipt (`signer`, `custody`, `keychain_build`). A result for one keychain is never a result for the other.

## What stays the same, and what is pinned

- **Same code:** the same `ant-pay.js` payer (`createHosted({testnet: true})`), the same invoice, authorization, envelope check, upload, retrieval and receipt code, the same keychain source.
- **Separate pin:** the test payer accepts only chain 31337 with the token and vault the devnet's nodes authenticated, and only on `wallet.html?net=devnet`. A mainnet payer refuses chain 31337, a test payer refuses Arbitrum One ([`e2e/ant-testnet-pin.test.mjs`](../../e2e/ant-testnet-pin.test.mjs)); the production keychain refuses chain 31337 and the TEST BUILD refuses 42161 ([`e2e/keychain-devnet.mjs`](../../e2e/keychain-devnet.mjs)).
- **Separate books:** test purchases keep their own journal and quote claims and count as `tANT` and `tETH`, never against the real daily caps.

## Confinement

The page reaches the test network at `http://127.0.0.1:25000` and the chain at the loopback port the manifest names — nothing else. Every one of those requests refuses a redirect (`redirect: 'error'`): validating the first URL would not be enough when fetch follows redirects by default. Storage peers are kept only at private IPv4 addresses. [`e2e/ant-testnet-confinement.mjs`](../../e2e/ant-testnet-confinement.mjs) drives eight hostile cases (redirecting manifest, redirecting chain, public peers, wrong chain, chain elsewhere) and asserts the refusal by name and that no request of the purchase flow left skaists.dev + loopback.

Under WSL2 NAT on this box, measured by `evidence.sh` and `evidence.ps1`: the guest binds the manifest on `0.0.0.0:25000` and the nodes on `0.0.0.0` UDP (the browser on the host must dial them); Anvil is bound to `127.0.0.1` in the guest; the host's `wslrelay` forwards both TCP ports on `127.0.0.1` only; the Hyper-V firewall for the WSL VM has `DefaultInboundAction Block` with no allow rule for any lab port; the manifest does not answer on the host's LAN address; and check-host.net cannot connect to the public address on either port. The devnet manifest carries Anvil's well-known dev-account key (public test material): the page never reads it, and that is one more reason port 25000 must stay on this computer.

## State, new runs and recovery

A start is a new network; nothing survives a stop. **Recovery runs against a running network**: a lost reply, a killed page, a dead browser or a replacement client are all exercised in [`e2e/ant-replacement-recovery.mjs`](../../e2e/ant-replacement-recovery.mjs) with the chain and storage state kept outside every browser, and never by restarting the lab between a payment and its recovery. The wallet journals, before each consequential step, the invoice identity and scope, the signed envelope and its hash, the gas and quote reservations, the upload checkpoint and the retrieval reference. "Save this file's payment record" (under *Limits & resuming*) carries that journal to another browser; opening it there resumes without paying again. It is state transport for the existing payer, not another executor.

## The proof

```
node tools/ant-testnet/loop.mjs [out.json] [--live] [--keychain] [--probe "text"]
```

- default: this checkout's bytes under the production origin; `--live`: the deployed skaists.dev bytes.
- `--keychain`: the isolated TEST BUILD keychain pays, served at `https://keys-devnet.skaists.dev` by route fulfilment from a build of this checkout, **with the page's own keychain open too** — the run asserts that funding, the session line, the invoice, every mined transaction's sender and the receipt all name the isolated account and never the page's.
- `--probe`: new bytes; a network that already holds the bytes needs no payment, which the loop refuses to count as a paid run.

It records what the invoice showed before authorization (the ANT total and the separate ETH ceiling), presses Authorize, confirms each payment inside the keychain when `--keychain`, waits for the upload, the independent retrieval and hash comparison, and the reconciled receipt, then re-reads every transaction from the test chain itself. Receipts of real runs live in `docs/receipts/ant-testnet-loop-*.json`, each labelled with its source, signer and custody boundary.

Another authorized host runs the same kit: build, start, health, loop, evidence. No host is the coordinator; the test chain, the storage nodes and the keychain build are all local to whoever runs it.
