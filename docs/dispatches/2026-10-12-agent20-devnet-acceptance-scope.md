# Agent 20 — ANT purchasing: the paid-devnet milestone closed at its scope, the isolated signer exercised, confinement measured, recovery accepted

Date: 2026-10-12/13 (America/Denver). Seat: Claude Code (Fable 5.1), branch `claude-LoVis/ant-purchasing-devnet-54711d` from main `d978da387`. Orders: the Agent 20 review relayed by the founder on 2026-10-12 ("Preserve the paid-devnet receipt … Reconcile with the current isolated keychain … Make network confinement observable … Make the lab reproducible … Finish interruption and replacement acceptance … Keep CI conclusions exact … Keep mainnet acceptance separate").

## 1. The paid-devnet receipt, preserved at its stated scope

`docs/receipts/ant-testnet-loop-live-2026-10-12.json` is complete at exactly this scope and is not re-run to refresh its date:

| | |
|---|---|
| page | the **deployed** skaists.dev bytes (a7d0989f2), `wallet.html?net=devnet` |
| storage | local ant-devnet, WithAutonomi/ant-node v0.22.0 (008d2ad), ten nodes over WebRTC Direct |
| chain | local Anvil 31337 (Foundry v1.8.5); approval and payment mined, both `from` the paying account, both chain 31337 |
| signer | **the wallet page's own keychain** (a deterministic disposable recovery code typed into the page); custody = the wallet page's JavaScript realm |
| amount | 0.046875 test ANT paid for the 49-byte probe; 0.05 test ETH was the ceiling, not the spend (actual gas 75,559,356,023,196 wei) |
| retrieval | all 49 bytes, SHA-256 equal to the original |

The already-stored / no-payment case is a different outcome and stays separate: the loop refuses to count it as a paid run and says so (`tools/ant-testnet/loop.mjs`).

**What that receipt did not establish, and why:** `bpay-invoice.js` at `19ded5a3a` used the isolated keychain only off the test network, and the test network's funding button read its address from the wallet-page signer. An open isolated frame and a successful devnet purchase could name two different accounts. That is now closed (§2), and the two receipts of this lane are labelled by signer so neither is mistaken for the other.

## 2. The isolated keychain, reconciled: a TEST BUILD at its own origin, the production pin untouched

The production keychain at `keys.skaists.dev` intentionally signs Arbitrum One only. It was not weakened. Instead:

- **One marked pin line.** `keychain/keychain.js` carries chain, name, token, vault and `TEST_BUILD` on the single `KC-PIN` line, beside the existing `KC-ORIGINS` line. `scripts/build-keychain.mjs --out DIR --origin URL --parent URL --testnet TOKEN VAULT` rewrites it **only in a built copy**: chain 31337, the running devnet's own token and vault, `TEST_BUILD = true`. A test build needs `--origin` and can never carry `https://keys.skaists.dev`; every build mode first asserts the **source** pin is the production pin. The production site build is byte-identical in its pin and CNAME (`e2e/keychain-testnet-build.test.mjs`, 4 tests).
- **The keychain announces its pin.** Every `kc.state` message now carries `pin: {chain, token, vault, test}`; the card says "Signs on: … (chain …)" and a test build says **TEST BUILD** in both its locked and unlocked views.
- **The wallet mounts by build, from a fixed list.** `KeychainClient.mount(slot, {build})` chooses between `https://keys.skaists.dev` (production) and `https://keys-devnet.skaists.dev` (devnet); no origin comes from data and no runtime override exists. On `?net=devnet` the page mounts the devnet origin only.
- **No silent fallback.** `bpay-invoice.js` chooses the payer by the announced pin: an open isolated keychain whose pin is not the network this page pays on is **refused by name** ("Your isolated keychain is pinned to Arbitrum One and cannot pay on the test network. Lock it … or open a TEST BUILD keychain."; the mirror refusal for a test build on Arbitrum One). Only when no isolated keychain is open does the page's own keychain pay, and the session line then says exactly that. Funding, the session line, the invoice's "Paying account", the recovered sender of every mined transaction and the receipt all come from the same chooser.

**Result, live, on the running lab (`docs/receipts/ant-testnet-loop-keychain-2026-10-12.json`, `node tools/ant-testnet/loop.mjs --keychain --probe …`):** this checkout's wallet bytes under the production origin; the TEST BUILD keychain built from this checkout (`keychain.js` sha256 `72a4d0f6…dea1e`) served at `https://keys-devnet.skaists.dev` by route fulfilment (no DNS, no host); **both keychains open**. The isolated account `0x8c327f51…e855` was funded, named by the session line and the invoice, confirmed two payments by two presses inside the keychain, and is the `from` of both mined transactions (approval block 10, payment block 15, chain 31337); the page's own account `0xd85e0d79…62d1` appears nowhere in funding, invoice or chain. 0.046875 test ANT for a 54-byte probe, retrieved and hash-equal. Custody boundary: the key lives in the keychain origin; the page can ask, never sign.

**Result, live, the other signer (`docs/receipts/ant-testnet-loop-page-keychain-2026-10-12.json`):** same checkout bytes, no isolated keychain open; the session line reads "This page's own test keychain pays on the test network; no isolated keychain is open." and the page account paid. Labelled as such. Neither result is transferred to the other signer.

**Regression with both keychains present** (`e2e/keychain-devnet.mjs`, fixtures only): the TEST BUILD pays while the page keychain is open — funding target, session line, invoice payer, every envelope's recovered sender and chain id, and the receipt agree; a production-pinned keychain served at the devnet origin is refused by name and funding refuses too, with nothing sent; inside the keychains the production build refuses chain 31337 and the TEST BUILD refuses 42161. `e2e/ant-replacement-recovery.mjs` repeats the both-keychains funding check on the Arbitrum fixture.

**Boundary, stated:** `keys-devnet.skaists.dev` has no DNS record and is not hosted. The TEST BUILD is served by route fulfilment inside the automated runs; a person running the lab in their own browser still pays with the page's own keychain until that origin is hosted, which is a founder-level DNS/Pages step this lane does not take. The production keychain at `keys.skaists.dev` was neither redeployed nor changed in what it signs; the deployed keychain predates the pin announcement, and the wallet treats a keychain that announces no pin as the production one.

## 3. Confinement, observable and measured

- **Fail-closed redirects.** Every request `bpay-invoice.js` makes to the test network's manifest and to any payment RPC now carries `redirect: 'error'`; a redirect is a named refusal, never followed. (The keychain client's reachability probe is a `no-cors` fetch, which the Fetch standard forbids from refusing redirects; it reads no data and keeps `follow`.) `e2e/ant-testnet-confinement.mjs` drives eight hostile cases — a redirecting manifest, a redirecting chain, all-public peers, a wrong chain id in the manifest, an https chain elsewhere, an http chain at another host (only its port survives, on loopback), a chain that answers another id, and mixed peers — and asserts the refusal text and that no request of the purchase flow left skaists.dev + the devnet keychain origin + loopback (the wallet's own Vaulta reads at page load are the measured baseline). The TEST NETWORK banner now states, measured, how many private-address nodes it kept and which loopback port the chain answers on.
- **This box, measured** (`docs/receipts/ant-testnet-confinement-2026-10-12.json`, from `tools/ant-testnet/evidence.sh` and `evidence.ps1`): in the guest the manifest binds `0.0.0.0:25000` and the nodes `0.0.0.0` UDP 30444–30463 (what the host browser needs), Anvil `0.0.0.0:43229` in the still-running instance; on the host `wslrelay` forwards both TCP ports on **127.0.0.1 only**; no portproxy names a lab port; the Hyper-V firewall for the WSL VM is **DefaultInboundAction Block** with no allow rule for any lab port; the manifest does not answer on the host's LAN address; check-host.net nodes **time out** on the public address for both ports (two probes each, three nodes each). `start.sh` now binds Anvil to `127.0.0.1` in the guest (`ANVIL_IP_ADDR`), so its unlocked accounts and balance-setting methods are never on a LAN-facing socket; the manifest port must stay on this computer because the devnet manifest carries Anvil's well-known dev key (public test material, read by nothing in the page).

## 4. The lab, reproducible

`tools/ant-testnet/`: `build.sh` (pinned source build: ant-node v0.22.0 = 008d2ad with `--features test-utils`; Foundry v1.8.5 linked; refuses an unpinned checkout), `start.sh` (a new run; refuses missing or wrong-version binaries and a taken port — its old port probe was a bash-only `/dev/tcp` path that silently reported "free" under `sh`; lab state under `~/ant-testnet/data`, apart from any real client data), `health.sh` (nine measured facts; 9/9 on the running lab), `stop.sh` (explicit: destroys chain and node state), `evidence.sh` + `evidence.ps1` (the exposure measurements above), `loop.mjs` (`--live`, `--keychain`, `--probe`). Footprint measured: ant-devnet ≈ 260 MB resident, anvil ≈ 26 MB, ≈ 60 MB disk. **New-run initialization is separate from recovery:** a start is a new network and nothing survives a stop, so every recovery case runs against a running network and never restarts between a payment and its recovery. Another authorized host runs the same five scripts and records its own evidence; no host coordinates, Hostinger included.

## 5. Interruption and replacement acceptance

The payer (`ant-pay.js`) already persisted, before each consequential step, the invoice identity and scope, the signed envelope and its hash, gas and quote reservations, the upload checkpoint and the retrieval reference, and reconciles an unknown broadcast from the chain by payer nonce. What was missing was a way for that record to leave a dead browser. `bpay-invoice.js` now offers **"Save this file's payment record"** (schema `bpay.ant.journal/1`: the journal plus this file's quote claims, never a key) and **"Open a saved payment record"** under *Limits & resuming*; opening refuses a record for another file, another network, or a browser that already holds a live record for the file, and resuming reuses kept payments and signs nothing new without a fresh authorization. This is state transport for the existing payer, not another executor. **BNROSE-RUST-001**, named in the orders, exists nowhere in this repository (no file, dispatch or index entry); nothing here competes with it, and the record format is the payer's own journal so any future core consumes the same bytes.

`e2e/ant-replacement-recovery.mjs` (Arbitrum fixture, production keychain from source, chain and storage state kept outside every browser): (1) payment accepted, reply lost, page killed → a new page in the same profile resumes from the journal with no press and no send; (2) payment landed, upload lost, original browser closed for good → the saved record opens on a replacement client with empty storage, the wrong file is refused, the right file resumes with no payment and no press, and the receipt names the original transactions; (3) no record anywhere and the network already holds the bytes → a stranger's client stores the file and pays nothing. All three green locally at this head (`PASS replacement recovery: lost reply + killed process, lost upload + dead browser with the saved record, and no record at all — never a second payment, never a second press`).

## 6. CI, exact

[CI-LINE]

## 7. Mainnet, separate

No mainnet act. Test balances and test ceilings authorize nothing. The bounded real-network purchase remains with its own funding and spending authority and the founder's gesture, after this lane's signer and recovery controls are integrated. The founder is not asked to repeat the automated devnet test.

## Files

`keychain/keychain.js`, `scripts/build-keychain.mjs`, `surfaces/keychain-client.js`, `surfaces/bpay-invoice.js` (+ `wallet.html` loader bumps, `stack.html` regenerated), `tools/ant-testnet/{README.md,build.sh,start.sh,health.sh,stop.sh,evidence.sh,evidence.ps1,loop.mjs}`, `e2e/{keychain-testnet-build.test.mjs,keychain-devnet.mjs,ant-testnet-confinement.mjs,ant-replacement-recovery.mjs}`, `.github/workflows/tests.yml`, `docs/receipts/ant-testnet-{confinement,loop-keychain,loop-page-keychain}-2026-10-12.json`.
