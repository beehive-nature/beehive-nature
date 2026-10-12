# ANT storage on the test network

This is the same hosted purchase as on Arbitrum One, run end to end on a local Autonomi test network where nothing has value:

**invoice → your own bzDiD keychain signs → payment confirmed → upload → independent retrieval and hash check → reconciled receipt**

## Try it

1. Start the test network (this computer, in WSL): `sh tools/ant-testnet/start.sh`
2. Open https://skaists.dev/surfaces/wallet.html?net=devnet#bpay-sec. A **TEST NETWORK** note appears.
3. Connect your keychain.
4. Press **Get test ANT and test ETH**.
5. Choose a file, type a test ETH ceiling and press **Prepare storage invoice**.
6. Review the ANT total and the separate ETH ceiling, then press **Authorize**.

The page then uploads the file, retrieves it, compares the hash and shows the receipt.

## What the test network is

- [`start.sh`](start.sh) starts `ant-devnet`, from WithAutonomi/ant-node v0.22.0 built with `--features test-utils`.
  - It runs ten storage nodes, each with a WebRTC Direct endpoint the browser dials directly.
  - It runs a local Anvil chain (31337) with the test ANT token and payment vault deployed.
  - It serves a manifest on port 25000.
- Your browser reaches the manifest and the test chain on `127.0.0.1` through WSL's localhost forwarding. It reaches the storage nodes over UDP at the WSL address the nodes advertise.
- Test funds come from the local chain's own unlocked dev account: Anvil sets the test ETH balance, and that account sends test ANT. No private key is read, typed or stored.

## What stays the same, and what is pinned

- **Same code:**
  - The purchase uses the same `ant-pay.js` payer, with `createHosted({testnet: true})`.
  - It is signed by the same native signer, `BNRPAY.antStorageSigner({testnet: {token, vault}})`.
  - It runs through the same invoice, authorization, envelope check, upload, retrieval and receipt code.
- **Separate pin:**
  - The test pin accepts only chain 31337, with the token and vault the devnet's nodes authenticated.
  - It works only on `wallet.html?net=devnet`.
  - A mainnet payer refuses chain 31337, and a test payer refuses Arbitrum One ([`e2e/ant-testnet-pin.test.mjs`](../../e2e/ant-testnet-pin.test.mjs)).
- **Separate books:**
  - Test purchases keep their own journal and quote claims.
  - Test spending is counted as `tANT` and `tETH`, so it never uses your real ANT or ETH daily cap.

## The proof

[`loop.mjs`](loop.mjs) runs the whole purchase in a real browser against the running test network, with a deterministic test-only keychain:

- it funds the test account and prepares the 49-byte probe;
- it records the ANT total and the ETH ceiling the invoice showed before authorization;
- it authorizes, then waits for the upload, the retrieval with its hash comparison, and the reconciled receipt.

`node tools/ant-testnet/loop.mjs` writes `tools/ant-testnet/last-loop.json`.
