# zCode native Jungle4 account — 2026-09-08

**Account created and independently verified:** `bzcodejungle`.

The founder approved creating the Vaulta/Jungle testnet twin of the codex seat's
`bcodexjungle` (WALLET-LEDGER note), name selected by the founder from this
seat's proposal. This account is for the founder's Beehive Nature development
work through zCode (GLM seat).

## Account and authority

| Field | Observed value |
|---|---|
| Network | Jungle4, native Vaulta/Antelope |
| Chain ID | `73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d` — PUBLIC-CONSTANT Jungle4 chain id |
| Account | `bzcodejungle` |
| Created | 2026-09-09 00:33:07.500 UTC / 2026-09-08 18:33:07 America/Denver |
| Creator | `junglefaucet`, per the creation form's Done trace |
| Creation transaction | `f7fc803252c78edb12bf218ea24b10aadd8486d8cb9fda52fb749f1715567adb` — PUBLIC-CONSTANT on-chain trx id (CryptoLions history, block 285885119) |
| Owner public key | `PUB_K1_6n9iELk8TDMXYUMXjCZwTQkvsPoeiogoRPYgPWR4st74Tbij7w` |
| Active public key | `PUB_K1_8gn6xFZq3eqXYUy7m9ph4p1uCuPA1AgpNCQTuhQkPNSdkYD7XS` |
| Owner legacy public key | `EOS6n9iELk8TDMXYUMXjCZwTQkvsPoeiogoRPYgPWR4st74RVyQNN` |
| Active legacy public key | `EOS8gn6xFZq3eqXYUy7m9ph4p1uCuPA1AgpNCQTuhQkPNSdn4QRt6` |
| Authorities | Each threshold 1, one distinct key of weight 1; active's parent is owner; no delegated accounts or waits |

[Account explorer](https://monitor.jungletestnet.io/#accountOverview:bzcodejungle).

The account was read independently from `https://jungle4.cryptolions.io` and
`https://jungle4.greymass.com`; both returned the pinned Jungle4 chain ID, the
same creation timestamp, and on-chain authorities matching the generated keys
exactly (the chain stores legacy EOS encodings; byte equality with the
generated legacy forms proves the underlying key material).

**Founder gesture:** the founder completed the form's reCAPTCHA ("prove human")
before submission, per the agreed split — zCode fills, founder proves. zCode
clicked Create after the checkbox read checked. The founder also ran the
Jungle faucet for this account immediately after creation.

## Key custody and checks

Separate secp256k1 owner and active keys were generated locally (@noble
curves/hashes, Node cryptographic random). Local checks passed for both keys:
WIF base58check round-trip, secret→public re-derivation from the decoded WIF,
and local ECDSA sign/verify. Encoding note banked during this ceremony: the
`PUB_K1_` checksum is domain-separated (`ripemd160(pub‖"K1")`) from the legacy
`EOS` checksum (`ripemd160(pub)`); the first generation attempt used one
checksum for both and was destroyed un-used before any account existed — the
account was created only from the corrected encodings.

Private material is saved outside this repository at
`%LOCALAPPDATA%\BeehiveNature\jungle4\bzcodejungle\keys.dpapi`, encrypted with
Windows CurrentUser DPAPI; plaintext crossed only in-memory pipes (stdin to
PowerShell for encryption, stdout pipe back for the equality check). Encrypted
save/load equality was verified (MATCH). The directory ACL is the standard
user-profile inheritance (SYSTEM/Administrators/current user only). Plaintext
keys were never written to disk, displayed, or submitted to the faucet; the
file is tied to this Windows profile and is not a portable cross-machine
backup. The same directory holds `public.json` (public keys + custody
metadata) and `chain-verification.json` (RPC observations). Future signing
loads the encrypted material locally without printing and checks the Jungle4
chain ID first.

## Resources and funding

At the verification snapshot (~00:36 UTC):

- RAM quota 5,495 bytes, usage 3,446 (2,049 free — contract deployment needs more).
- CPU available 2,329,816 µs; NET available 3,052,280,859 bytes.
- Balances (CryptoLions): **100.0000 A**, **100.0000 EOS**, **100.0000 JUNGLE**
  — faucet transfers by the founder at 2026-09-09 00:33:24 UTC, block 285885152:
  `3d8d2d750efea9369f2f072b7fc1984949759af16348629fceb69104aaa7eea1`, <!-- PUBLIC-CONSTANT on-chain trx id -->
  `19adc5d3b051b12bdbcb74be27354c6e5284ebb2875b329d4dbcfb8fbf430dc5`, <!-- PUBLIC-CONSTANT on-chain trx id -->
  `87c383b694684974cbe5e350b1df7aa2febd5a68a8b1e97533a00031d803b16d`. <!-- PUBLIC-CONSTANT on-chain trx id -->
- No contract deployment is claimed.

## Reproduce the public checks

```text
POST https://jungle4.cryptolions.io and https://jungle4.greymass.com
/v1/chain/get_info             {}
/v1/chain/get_account          {"account_name":"bzcodejungle"}
/v1/chain/get_currency_balance {"code":"core.vaulta","account":"bzcodejungle","symbol":"A"}
/v1/chain/get_currency_balance {"code":"eosio.token","account":"bzcodejungle","symbol":"EOS"}
```

Require the exact chain ID, then compare owner/active authorities to the
public keys above. Raw observations are in
[the public JSON receipt](../receipts/bzcodejungle-2026-09-08.json); creation
and faucet history at
`https://jungle4.cryptolions.io/v2/history/get_actions?account=bzcodejungle&limit=20&sort=desc`.
