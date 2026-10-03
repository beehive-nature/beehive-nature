# Wallet scope recovered; accounts and coins, not an art lane

2026-10-03 · Codex · PR #334 continuation.

The founder corrected this lane three times: the named chains were examples,
not the scope ceiling; build/publication targets are GitHub, Autonomi,
Arweave, Vaulta and Hive, with no local server or local-file preview; ERC-20i
in this request means coin/token holdings, with art on separate surfaces.
Those corrections govern this delivery. No new art integration remains.

## Existing decisions recovered, not replanned

- [Brief 04](../DESIGN-BRIEF-04-wallet-chain-matrix-uniswap-synergy.md):
  ETH, Arbitrum, Base, exSat, Vaulta, stables, BTC, Lightning, Solana, Hive,
  Zano, BCH, Zcash, Monero, Autonomi and Arweave. These are sixteen scope
  entries, not sixteen independent blockchains: tokens, storage and Lightning
  have distinct roles. Vaulta's native account path is Antelope, not EVM.
- [Graphene/Cosmos review](../chain-support-graphene-cosmos.md): adds
  BitShares, Cosmos Hub, Osmosis, Celestia, dYdX and Injective; also records
  Steem, Golos, Blurt and Peerplays as family/research scope. Research is not
  a founder ruling to implement every sibling. Shared Graphene envelope,
  separate Hive/BTS operation decoders; Cosmos DIRECT allowlist; Injective
  uses the Ethereum-derived path, not generic Cosmos address derivation.
- [ERC-20i census](../receipts/RECEIPT_SELECTOR_CENSUS_2026-08.md) and
  [deployment registry](../receipts/deployments.json): **12 Base contracts
  plus one Ethereum contract**, with per-deployment provenance. This already
  exceeded the wallet's five-renderer table. A rendering table must not limit
  which coins a wallet reads. Contract-specific transfer semantics remain in
  [the compatibility study](../SPEC-INSCRIPTION-COMPAT-1.md).
- [Rail formulary](../RAIL-FORMULARY-1.md): Base payments, Vaulta governed
  logic/identity, privacy routing, Autonomi/Arweave storage, BTC/Lightning.
  [Preapproved adapters](../register/PREAPPROVED-ADAPTERS-1.md) also names
  GitHub serving/mirrors, Hive content, BCH backup anchoring and exSat.
- [Adapter contract](../SPEC-ADAPTER-CONTRACT-1.md): declare capabilities;
  browser worker/native process carriers; a catalog entry does not grant a
  signing or broadcast method. Its draft status is preserved.
- [bPay lifecycle](../agents/BPAY-ECONOMIC-LIFECYCLE.md),
  [September 12 Trezor review](2026-09-12-z2a-trezor-review.md), and
  [September 17 verdict](2026-09-17-bpay-wave-verdict.md): preserve quote,
  commitment, invoice, authorization, settlement, receipt and reconciliation
  as separate evidence. Reuse watchpay's receipt/journal and existing
  bPay/voucher primitives; the Solana bench does not replace them.
- [October 2 firmware audit](2026-10-02-bsafe-pq-audit.md),
  [repeatable build](2026-10-02-bsafe-reproducible-build.md), and
  [October 3 Solana bench](2026-10-03-safe7-solana-settlement.md): distinct
  source, emulator, physical device and chain settlement boundaries.

These are substantial existing plans/reviews/receipts. This pass did not
measure aggregate agent hours, so it does not certify a reconstructed
“30 hours” total or silently restart that work.

## Complete coin/chain inventory and actual boundaries

| Scope | Existing code / evidence | What remains |
|---|---|---|
| Vaulta / A | `wallet-adapter-vaulta.js::METHODS`: balance, status, buildSend, buildAction, submit, confirm; wallet public account reader and connected resource view; `chain-eos` and `wallet-relay` | Hardware key-to-account mapping, physical custom-firmware acceptance, same-envelope settlement comparison |
| Hive / HIVE, HBD, HP, RC | `wallet-adapter-hive.js::balance` now reads exact liquid HIVE and HBD; connected-wallet code reads wider Hive account data | Savings/HP/RC expansion; hardware key/account discovery and operation signing. Hive worker remains read-only |
| Base / ETH, USDC, ERC-20i | `EVM_RAILS.base`, `readPublicBalance`, `BNRCoins.readHoldings`; all 12 census contracts and additional user-entered tokens | Broad token discovery beyond a known registry; collection-specific transfers remain separate from reads |
| Ethereum / ETH, ERC-20i | New public-only ETH reader; PEPi-item token balance from the same census | Payment rail integration; general discovery beyond registry/custom contracts |
| Arbitrum / ETH, ANT | `EVM_RAILS.arbitrum`, public reads, EVM signer; watchpay payment-plan/receipt work | Physical payment/receipt/finalize evidence at the required bPay boundary |
| exSat | `chain-exsat-evm`, `bindexer`, `btrezor::chain_registry` | Account-book read wiring; live indexer and wallet settlement acceptance. Rust indexer is not the Vaulta Reader or Hive bIndexer |
| BTC | Bitcoin worker, public addresses and account xpub/ypub/zpub import/read | Spend integration, descriptors/Taproot, silent-payment scanner coverage |
| Lightning | BOLT11/BOLT12 decoding, `tools/ln-rail`, NWC/allowance work | Current live node/pay/reconciliation acceptance; it cannot be watched using a BTC address alone |
| Solana | Public balance worker; Trezor public import; `settle-solana::{prepare,verify_signature,reconcile}` and pinned firmware emulator receipt | Physical Safe 7, durable bPay authority/journal, live settlement and Vaulta comparison, SPL/Token-2022 scope |
| Zano | `chain-zano`, `zano-watcher`, custom firmware source/conformance records | Complete tracked source inputs and current clean build; complete transaction/device acceptance |
| BCH | Backup-anchor decision and Rust indexer phase-2 schema | Cashaddr/UTXO reader, exact firmware path and backup-anchor implementation/evidence |
| Zcash | Firmware app directory plus transparent/shielded research | Separate address/viewing-key readers and exact device/format acceptance |
| Monero | Firmware app directory plus view-only/cold-signing research | Wallet scanner integration; an address alone cannot reveal private balances |
| Autonomi | `adapter-autonomi`, existing prepare/quote/payment/finalize consumer | Retrieval/hash verification remains a separate earned result. ANT coin balance is on Arbitrum |
| Arweave | Public balance worker; `adapter-arweave`, `atmirror` ANS-104 and browser JWK publication | Hardware signer is unestablished; publication and independent retrieval proof per artifact |
| Stablecoins | Base USDC and connected Hive HBD already have paths | Other ERC-20/SPL inventories and exact per-token payment policies |
| BitShares / BTS | Detailed Graphene review and shared-envelope analysis | Reader, separate operation decoder, truthful recipient display and device acceptance |
| Cosmos Hub / ATOM; Osmosis / OSMO; Celestia / TIA; dYdX / DYDX | Shared Cosmos-app review, distinct chain identities/HRPs | Readers, DIRECT decoder and reviewed complete message allowlist; no colliding `slip44:118` registry entries |
| Injective / INJ | Reviewed EIP-712 fixture/path | Host address/transaction assembly and end-to-end evidence; do not use generic Cosmos derivation |
| Steem; Golos; Blurt; Peerplays | Family research; Steem registration-only recommendation | No wallet reader or signing acceptance established; kept visibly STUDY |

Additional inherited firmware directories observed in the existing fork are
Cardano, NEM, Ripple/XRP, Stellar, Tezos and Tron. They are preserved inventory,
not silently counted as integrated wallet adapters. The newer Windows source
is still dirty at `9330ef0607`; it was inspected read-only. Directory presence
does not establish Safe 7 support or a deployable build.

## What changed in PR #334

The account picker now derives from the full **26-entry** scope catalog.
Vaulta and Hive lead it. Implemented public readers are selectable; researched
or missing readers remain visible and disabled. The badges describe code/read
status and no longer make blanket `firmware ✓` claims. The original Tier-3
brief is annotated so the same overclaim cannot restart the error.

Base and Ethereum account cards now have **Read token balances**. These read
the full respective census: FUNGI, FROGGI, PEPi-v1, PEPi-v2, JELLI, TRUFFI,
JEDI, MiDi-1, MiDi-2, MiDi-3, Souli, NTNT on Base; PEPi-item on Ethereum.
Additional public token contracts can be added for the tab. This does not
claim automatic discovery of every future ERC-20i deployment.

`wallet.html`'s `wallet-coins` script reuses the existing deployment registry,
not the art renderer. `readHoldings` checks chain identity, pins token reads to
an observed block, reads each contract's decimals, formats integers exactly,
matches JSON-RPC responses by ID, rejects ambiguous batches, limits requests
to 16 calls, and keeps failed reads distinct from zeros. Chains can run
concurrently; endpoints/batches within a chain are bounded and serial. Reads
are user-triggered, not a background poll multiplied by every saved account.
`refreshCoins` uses the same stale-result/cross-tab isolation pattern as public
balances. These are endpoint observations, not independent consensus proofs.

Public Ethereum read configuration is separate from `EVM_RAILS`: adding a
reader does not enable a signer. No account selection changes bPay authority.
The coin module has no art or signing calls. Existing art surfaces and the
wallet's previous art block are byte-preserved by this follow-up.

The generated stack inventory now includes the new `settle-solana` crate,
fixing the prior-head GitHub static failure.

## Verification and publication

- `node --test e2e/wallet-coins.test.mjs`: **16/16 passed** without a server
  or browser. Full census, correct chains, reversed RPC order, non-9 decimals,
  large integer precision, custom contracts, missing/duplicate responses,
  wrong chain, malformed values, failed/partial reads and zero were exercised.
  Hive checks cover exact HIVE/HBD units, missing HBD and malformed HIVE.
- All 12 inline wallet scripts parse; `estate-check` and generated stack
  inventory/surface checks passed. `git diff --check` passed.
- GitHub browser coverage now checks the full catalog and disabled entries,
  actual removal/count mutation, all 12 Base token rows, adding a contract,
  failure clearing stale amounts, and no art navigation/credential request.
  These browser additions are pending hosted execution at this dispatch's
  initial commit; no local server or local-file preview was started.
- Earlier head `964af58f`: both GitHub wallet jobs passed; static failed for
  the generated inventory corrected here. An unrelated PLUR festival test
  also failed in the eternal job. These are not whole-PR green results.

Review and checks remain on [PR #334](https://github.com/beehive-nature/beehive-nature/pull/334).
GitHub Pages production is a distinct deployed revision. No Autonomi or
Arweave upload, Vaulta/Hive publication, device flash or transaction was
performed by this correction. Their implementation/status must not be
promoted merely because the source is pushed to GitHub.
