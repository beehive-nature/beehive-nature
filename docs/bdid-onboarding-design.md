<!-- Generated 2026-08-04 by a 14-agent measurement: 4 read-only crate maps,
     6 per-chain requirement probes against live docs/explorers, 3 adversarial
     architecture reviews, 1 synthesis. Fiat figures are 2026-08-04 spot and are
     re-quotable, NOT constants. Re-price before sizing anything. -->

# bDiD onboarding — the buildable design

Companion to [bdid-onboarding-inventory.md](bdid-onboarding-inventory.md), which measures
what the workspace already does. This one measures what the *chains* require.

**Correction carried in from the BNR firmware tree:** where this document reports that the
Trezor Safe 7 (T3W1) cannot sign Vaulta/EOS because upstream dropped it after T2T1 (#2793),
that is true of **stock** firmware only. The BNR fork restores it — `Capability.EOS` is
re-added for T3W1 in `core/src/apps/base.py`, the 39 Eckhart `eos__` strings are filled, and
`mp_module_trezorzano` plus `zano_generate_clsag_ggx` are in the built image. Read every
"Trezor: NO" for Vaulta against that. Hive remains genuinely unsupported (4-key Graphene
model, no BIP-32 path).

---

# bDiD Onboarding — One Buildable Design

**Status:** synthesis for build. All three previously-drafted architectures were rejected; this document is the survivor, assembled from what each got right.
**Price basis:** all fiat figures are 2026-08-04 spot and are re-quotable, not constants. A (Vaulta) spot is **disputed ±25%** across venues ($0.0647 CMC / $0.0727 Coinbase / $0.0803 CryptoRank); A-denominated figures below use $0.065–$0.073.
**Governing text:** `C:\Users\travi\beehive-nature\docs\CONSTITUTION.md`, `...\docs\RULINGS-2026-07-26.md`, `...\docs\SPEC-BNROSE-ONBOARD.md`, `...\docs\feature-backlog.md`, `...\crates\onboarding\src\lib.rs`.

---

## 1. What a bDiD is

A bDiD is **not a wallet and does not contain a key**. In the shipped crate it is exactly three things.

**(a) A root identity.** `RootIdentity { did: Did, anchored: bool }` — `crates\onboarding\src\lib.rs:62-67`. `Did` is `type_bindings::Did(pub String)` (`crates\type-bindings\src\lib.rs:13`), a newtype over a string with a `method()` accessor and **no validation** — nothing today checks the string is `did:autonomi:…`.

**(b) A completed enrolment.** `Enrolment` (`lib.rs:247-253`) is the only type in the crate with private fields and a smart constructor. `Enrolment::complete(...)` (`lib.rs:259-277`) refuses on `EnrolError::NoRecoveryPath` and `EnrolError::NoWrittenCodeFloor`. An enrolment cannot finish without a written-code recovery path — RELAY_22 §5 (`lib.rs:213-217`), the floor that "costs nothing… and is the only option available to someone poor."

**(c) Public authenticator material only.** `Authenticator { credential_id: String, kind: AuthenticatorKind }` (`lib.rs:50-55`) — "carries only the opaque public credential id — never key material" (`lib.rs:48-49`). Plus zero or more `persona::PersonaBinding` (`lib.rs:180-208`), each with its own `DisclosureMode` defaulting to `Selective` (`lib.rs:127-131`), bound through `PersonaBinding::bind` which refuses `BindingError::CustodyUndisclosed` when a PDS-custodial persona's custody is not disclosed (`lib.rs:199-201`).

Grade is derived, not stored: `reachable_grade` (`lib.rs:314-319`) returns `ViewGrade::Settlement` iff `binding.is_some() && enrolment.root.anchored && SettlementBinding::is_settlement_grade()`, else `Confirmed`. It **never returns `Informational`** — so "has a grade" is not a gate; only `== Settlement` is.

### What a bDiD is NOT today, and what this design must add

Five concrete gaps, all of which are new code in `crates/onboarding`:

| Gap | Evidence | What v1 adds |
|---|---|---|
| No per-chain state anywhere | No `Step` enum, no transition fn; steps 0–3 exist only in the doc comment `lib.rs:5-18` | New module `crates\onboarding\src\rails.rs` (below) |
| `Enrolment.root` is private with **no mutator and no `anchor()`** | `lib.rs:250`, accessors `lib.rs:282-284` | `Enrolment::anchor(&mut self, AnchorProof)` |
| `SettlementBinding` is forgeable | `lib.rs:298-302`, both fields public, no smart constructor — compare `treasury_t0::SettlementAuthorization` (`crates\treasury-t0\src\lib.rs:108-140`: ≥2 distinct `source_ref`s, no `Deserialize`) | Smart constructor + drop `Deserialize`, mirroring T-0 |
| Disclosure covers only PDS custody | `lib.rs:149-156, 199-201` | `InformedConsent.discloses_software_key`, `.discloses_recovery_custody`, `.discloses_bridge_custody`, each enforced the same way |
| No key material, by design and correctly | `Cargo.toml:8-11` — no crypto dep | Unchanged. Keys stay on the device / in the browser, never in the crate |

**The new type, concretely.** A bDiD gains an *address book of public material*, not a wallet:

```rust
// crates/onboarding/src/rails.rs
pub enum Rail { Vaulta, Hive, ArbitrumOne, EthereumL1, ExSat, Bitcoin,
                BitcoinCash, ZcashTransparent, Xrp, Stellar, Solana,
                Arweave, Zano }

pub enum KeyClass { HardwareSafe7, SoftwareClientSide, UserSuppliedExternal }

pub struct RailAddress {           // public material ONLY
    pub rail: Rail,
    pub address: String,
    pub derivation: String,        // e.g. "m/84'/0'/0'" or "client-generated"
    pub key_class: KeyClass,
}

pub enum RailStatus {
    Derived,                                        // address known; chain knows nothing
    FloorQuoted { minimum: u128, unit: &'static str, quoted_at: i64 },
    AwaitingArrival { expected: u128, since: i64 },
    Live { observed: u128, at: i64, chain_ref: String },   // set ONLY by chain read
    Refused(FloorRefusal),
    Unavailable { blocker: &'static str },          // named, permanent-for-v1
}

pub struct FloorRefusal { pub rail: Rail, pub required: u128,
                          pub offered: u128, pub unit: &'static str }

pub struct Wallet { root: Did, rails: BTreeMap<Rail, (RailAddress, RailStatus)> }
```

`Wallet::observe(...)` is the only path to `Live`, is idempotent, and takes a chain-read witness — never a broadcast receipt. This is the existing discipline in the tree (`docs\SPEC-BNROSE-ONBOARD.md:60-61`, "never infer from broadcast"). `FloorRefusal` is CD-13's "no half-born accounts" (`docs\feature-backlog.md:303-313`) made into a type.

---

## 2. The honest chain table

The 13 rails split into **three mechanical classes**, and the class — not the price — decides everything.

- **Class A — someone already on-chain MUST act.** No self-service path exists at any price. 2 rails.
- **Class B — the user can self-service via any exchange withdrawal.** BNR derives the address and reads the chain. BNR signs nothing. 9 rails.
- **Class C — BNR cannot even derive the address.** Requires a second, incompatible seed the user must back up separately. 2 rails.

| # | Rail | Class | Who must act first | Measured floor (fund at this, not the protocol dust) | Trezor Safe 7 (T3W1) | v1 |
|---|---|---|---|---|---|---|
| 1 | **Vaulta** (aca376f2…) | **A** | `eosio::newaccount` from an existing account. A bare pubkey is **not an address** — cannot receive anything. | RAM **4096 B = 1.3546 A ≈ $0.088–0.099** (NOT 1600 B — that leaves **4 bytes** of headroom vs 2996 used / 3000 quota). PowerUp min fee 0.0001 A. Leave **0.5 A ≈ $0.033–0.037** in-account for self-powerup. | **NO.** `support.json`: T3W1 = `not for T3W1 (#2793)`. Only T2T1 ever supported EOS. | **IN** |
| 2 | **Hive** | **A** | `account_create` (3.000 HIVE, **burned**) or `claim_account`+`create_claimed_account`. Transfer to a nonexistent name is rejected by consensus. | **3.000 HIVE = $0.124** exactly; fee is a witness-voted median and must be **exact** — re-read `get_chain_properties` immediately before every broadcast. | **NO.** trezor.io verbatim: "Currently, Trezor does not support Hive." 4-key Graphene model, no BIP-32 path. | **IN** |
| 3 | **Arbitrum One** (42161) | B | Nobody. EOA is implicit. | **0.0002 ETH ≈ $0.37** (hundreds of txs; absorbs an L1 blob spike). L2 base-fee floor 0.01 gwei; live 0.02 gwei. | **YES**, Suite-native. SLIP-44 60, `m/44'/60'/0'/0/i`, same address as ETH. | **IN** |
| 4 | **Ethereum L1** | B | Nobody. | **0.0005–0.001 ETH = $0.94–$1.87.** Today's 0.46 gwei is a cycle low: the same transfer is $1.18 at 30 gwei, $3.93 at 100 gwei. Do not size off today. | **YES**, Suite-native. SLIP-44 60. | v2 |
| 5 | **exSat** (7200) + XBTC | B | Nobody at the EVM layer. | Gas float **0.000002–0.00001 BTC = $0.13–$0.64**. Fixed 500,000 wei base fee (verified constant over 50 blocks). | **CONDITIONAL** — not in Suite; Suite accepts no custom RPC. Works via MetaMask/Trezor Connect with the signed network definition (fetched: 575 B). **Unverified on physical hardware.** | v2 |
| 6 | **Bitcoin** | B | Nobody. UTXO. | **20,000 sat = $12.82.** Dust floors (330 P2TR / 294 P2WPKH / 546 P2PKH) are **not** usable floors — a 111 vB sweep at 100 sat/vB costs 11,100 sat. 5,000 sat = $3.20 goes uneconomical above ~45 sat/vB. | **YES**, Suite-native. SLIP-44 0; `m/84'` default, `m/86'` Taproot. | v2 |
| 7 | **Bitcoin Cash** | B | Nobody. | **5,000–10,000 sat = $0.011–$0.021.** 1 sat/byte is always sufficient; no spike risk. | **YES**, SLIP-44 145, CashAddr. | v2 |
| 8 | **Zcash (transparent)** | B | Nobody. | **50,000 zat = $0.25.** ZIP-317 hard floor is 10,000 zat — below it the UTXO **can never pay its own fee**. Never provision under 30,000. | **YES for t-addresses only.** Shielded is dead in firmware: `apps/zcash/signer.py` hardcodes `nSpendsSapling=0, nOutputsSapling=0, nActionsOrchard=0` (A25). | v2 |
| 9 | **XRP** | B | Someone funded must send **≥1.000000 XRP** — below that fails `tecNO_DST_INSUF_XRP` and delivers nothing. An exchange withdrawal satisfies this. | **1.1 XRP = $1.19.** 1 XRP base reserve is locked and only ~0.8 recoverable via `AccountDelete` (0.2 XRP fee). | **YES**, but `messages-ripple.proto` has **only** `RipplePayment` + `RippleAccountDelete`. No `TrustSet` → a Trezor-held XRP account **can never hold an issued token**. | v2 |
| 10 | **Stellar** | B | `CREATE_ACCOUNT` required — a plain `PAYMENT` to an unfunded address fails `op_no_destination`. An exchange withdrawal does this. | **2 XLM = $0.34** (1 XLM minimum + 0.5/trustline + fee headroom). | **YES**, SEP-0005 `44'/148'/a'`. **No** Begin/EndSponsoringFutureReserves in the proto → CAP-0033 sponsorship is **unusable**; you must actually transfer the XLM. | v2 |
| 11 | **Solana** | B | A transfer leaving a new account below **890,880 lamports** fails `InsufficientFundsForRent`. ATA per (owner,mint) = 2,039,280 lamports. | **0.005 SOL = $0.37** (wallet rent $0.066 + one ATA $0.151 + fees). Use `CreateIdempotent`, never `Create`. | **YES**, Safe 7 named literally by Trezor. `m/44'/501'/i'/0'` — **4 levels**, differs from Ledger's 3. Pin it. | v2 |
| 12 | **Arweave** | **C** | Nobody on-chain, but the **wallet is an RSA-4096 JWK** that must be generated somewhere. | First-touch surcharge measured live today: **200,688,267,354 winston = 0.2006882674 AR = $0.369**. **Dynamic** — no `WALLET_GEN_FEE` constant in `ar.hrl`; the legacy "0.25 AR" is stale. Must be priced per-address via `GET /price/0/{target}`. ANT/ArNS cost: **uncertain** — ar.io publishes no fee table; the 2,384.25 ARIO figure in the SDK docs is an illustrative sample, not a quote. | **NO.** trezor.io verbatim. Secure element does not do RSA. | **OUT** |
| 13 | **Zano** | **C** | Nobody on-chain, but **BNR cannot derive the address**. No delegated creation for standard addresses; the user's device must generate the Ed25519 spend/view pair. | **0.05 ZANO = $0.47.** Flat hardcoded `TX_MINIMUM_FEE` 0.01 ZANO, no fee market; ≤0.01 ZANO is receivable and **permanently unspendable**. 0.05 chosen because governance is openly discussing raising the fee to 0.05/0.1. | **NO.** Code search *and* issue search for "zano" in trezor-firmware return **zero** results. | **OUT** |

### Chains that cannot be in v1, and why — stated plainly

- **Arweave (and ANT/ArNS).** Three independent blockers: RSA-4096 is outside every Trezor's capability, so the user carries a JSON keyfile they must back up on day one — exactly the custody training `SPEC-BNROSE-ONBOARD.md:14` says the target user should not need. The funding surcharge is dynamic and must be re-quoted per address. And ANT provisioning has **moved to Solana** as a Metaplex Core asset — whether Trezor Suite renders or transfers one is **unverified**. Blocker to clear: a decision that a browser-generated RSA keyfile is acceptable, plus a live ArNS price feed.
- **Zano.** BNR cannot produce the address at all, so "we give you all the addresses" is mechanically false here. A firmware port does not fix it: Monero has been in Trezor firmware since 2018 and is *still* unusable on Safe 7 because Suite doesn't support it and no third-party host speaks the Safe 7 wire protocol. Zano is Monero-class or heavier (mandatory ring of 16, Bulletproofs+, plus CA surjection and balance proofs). Blocker to clear: a Safe 7-protocol-aware host **and** a coreapp firmware fork — D-02 settles that an extapp cannot sign (trezor_api_v1 grants no crypto, no keys, no secure element).
- **Zcash shielded, XRP issued tokens, Stellar sponsored reserves.** Permanently out at the protocol-message level, not scheduling decisions. Say so in the UI rather than leaving a blank.

**Founder's named list vs. this table.** The verbatim requirement names RAM/CPU/NET, ANT/AR, HIVE, Zano, xbtc, ARB1ETH. Of those six, **three ship in v1** (Vaulta, Hive, Arbitrum), **one ships in v2** (exSat/XBTC, pending a hardware verification), and **two cannot ship** (AR and Zano) for the structural reasons above.

---

## 3. The recommended architecture

**DERIVE-ALL / FUND-ON-DEMAND, with a capped Class-A bootstrap seed.**

Four rules:

1. **Address derivation is free, non-custodial, and happens for every derivable rail on day one.** One Safe 7 xpub export per account tree (`m/84'/0'/0'`, `m/44'/145'/0'`, `m/44'/133'/0'`, `m/44'/60'/0'/0`, `m/44'/501'/i'/0'`, `44'/144'/a'/0/0`, `44'/148'/a'`), each with a physical device confirmation, **zero signatures requested**. From those, unlimited receive addresses forever, offline, at $0. The founder's "all the addresses/wallet that is possible" is honored **in full, on day one, for nothing.** What costs money and strands users is *funding*, and funding is the thing that becomes on-demand.
2. **The user funds every Class-B rail themselves, from their own wallet or exchange, at a floor BNRoSE quotes live.** BNR never receives, holds, converts, or forwards a cent. This is R3 verbatim (`RULINGS-2026-07-26.md:47-52`) and Article V.1 verbatim (`CONSTITUTION.md:83`, "Users fund the resources they consume… must never *absorb* cost"). BNRoSE quotes, watches, verifies arrival by reading the chain, and provisions.
3. **BNR signs exactly two acts per user, on the two Class-A rails, from its own accounts, naming only the user's public keys.** `eosio::newaccount` + `core.vaulta::giftram` + powerup + a 0.5 A float, atomic in one transaction; and Hive `account_create`/`create_claimed_account` + `delegate_rc`. Nothing else. This is a **bootstrap seed** under Article V.1's only exemption — and it must be authorized as one, with a hard cohort cap and a sunset date (see §7, F1).
4. **Every rail refuses below its floor, pre-purchase, naming the failing minimum.** `FloorRefusal` is a type, not a lint. CD-13's "no half-born accounts" becomes code before any chain write ships.

### Rejected, one line each

- **Model A — BNR receives the deposit and spreads it.** Dies on arithmetic before law: recommended provisioning is ~$21.30 against a $10 deposit, and a 13-way split produces slices below every exchange withdrawal minimum, so the implementation *must* batch across users, which is pooled custody and 18 U.S.C. 1960 exposure.
- **Model B — the user's Trezor signs every provisioning transaction.** Dies because Safe 7 cannot sign 4 of 13 rails including Vaulta where `b` lives, and because on Vaulta the bootstrap is circular — a bare pubkey is not an address, so there is nothing to sign *from*.
- **Model C — BNR gifts all gas from treasury.** Dies on `CONSTITUTION.md:128`, the `resource.accounting` row that names **Vaulta RAM/CPU/NET, ZANO, AR, ANT** by name and says "never subsidizes" — and on sybil economics: ~$17.42/user out, ~$15–16 walk-away extractable, against ~$1–2 of attacker sweep fees.

**What this design keeps from each:** A's correct insight that third-party provisioning is *mandatory* on Class A (Vaulta and Hive have no self-service path at any price). B's correct insight that the user's key must never leave the device even for a signature. C's correct insight that the two Class-A costs are real and someone has to eat them — answered by capping them at **$0.25/user** rather than $17.

---

## 4. The bootstrap problem and its answer

The problem is "who pays the first transaction when the user has zero balance." It has **three different answers** depending on class, and for nine of thirteen rails it does not exist at all.

**Class B (9 rails) — the problem is self-inflicted and dissolves.** The first act on these rails is an **inbound** transfer to an address that already exists as a cryptographic fact. The user withdraws from any exchange, or sends from any wallet they already have, directly to the address BNR derived from their xpub. Nobody needs a prior balance because nobody is *sending from* the empty address. Three of these have an existence floor rather than a dust floor, and an ordinary exchange withdrawal clears all three:

- XRP: the first inbound must be **≥1.000000 XRP** or it fails `tecNO_DST_INSUF_XRP` and delivers nothing.
- Stellar: the first inbound must be a **`CREATE_ACCOUNT`** op with `startingBalance ≥ 1 XLM` — exchanges do this; a raw `PAYMENT` fails `op_no_destination`.
- Solana: the first inbound must leave the account at **≥890,880 lamports** or it fails `InsufficientFundsForRent`. The ATA is separate and is created with `CreateIdempotent`, payer ≠ owner.

BNRoSE's job here is to *quote the right number and then read the chain* — nothing more.

**Class A (2 rails) — the problem is real and unbreakable, and BNR signs.**

*Vaulta.* There is no address. `eosio::newaccount` must come from an already-existing account, with the user's public owner/active authorities as action parameters. Verified live, not theoretical: `pcash` created `chuvak.pcash` at 2026-08-04T18:09:45 with owner+active set to a single user-held key, and does this dozens of times a day; `openvaccount`, `eosdididoda1`, `fireblockssd` do the same. The user's key controls the account from block one; BNR is only creator and payer. Four hard prerequisites:

1. **BNR must own a suffix account (`bnr`) before the first user.** Names are 12 chars from `[a-z1-5.]`; anything shorter is a premium name requiring a won `bidname` auction and **cannot be minted**. `user.bnr` is free-mintable only by the owner of `bnr`. This is a prerequisite, not an optimization.
2. **Buy 4096 bytes, not 1600.** 1600 purchased + 1400 gift = 3000 quota against 2996 used = **four bytes** spare. The first token balance row overflows it and the account cannot transact.
3. **Use `core.vaulta::giftram`, not `buyrambytes`.** Gifted RAM is encumbered; plain RAM can be sold by the user out from under their own account, bricking it.
4. **Leave 0.5 A in the account.** A fresh account has `cpu_weight=0`, `net_weight=0`, `cpu_limit.max = 0 µs` — verified on `chuvak.pcash`. It can **hold** tokens and cannot **move** them. `powup.state` (at code=`eosio`, table=`powup.state`, **scope 0 / empty name** — querying scope `eosio` returns empty on every node and will make you conclude PowerUp is dead) has `powerup_days = 1`. Rentals expire every 24 hours. A one-time BNR powerup makes the account a read-only tomb by T+24h. **The answer is a self-powerup float, not a subscription:** 0.5 A ≈ $0.036 at the 0.0001 A minimum fee funds thousands of days of self-service renewal. Since the user's Vaulta key is a software key anyway (Safe 7 cannot sign the chain), they renew from a web wallet that displays `powerup` correctly — the Model T blind-signing problem does not bite, because the Model T is not in this path.

*Hive.* `account_create` must come from an existing funded account, passing the user's four **public** keys (owner/active/posting/memo). 3.000 HIVE is burned; the new account receives nothing from it. The fee must be **exact** post-HF20 and is a witness-voted median — re-read `condenser_api.get_chain_properties` immediately before each broadcast or the transaction fails. A brand-new account gets only `max_rc_creation_adjustment` RC (~4.85e9, ≈28 transfers or ≈4 comments per 5-day window), so BNR follows with a `delegate_rc` custom_json (posting key, costs ~1.8e8 RC, no HIVE, revocable by re-delegating `max_rc = 0`). The ACT path (`claim_account`) costs 0 HIVE but requires ~6,170 HP (~$256 staked) per ACT per 5 days — **the paid 3 HIVE path is ~2,000× cheaper in capital terms** and is what v1 uses.

**Class C (2 rails) — the problem is upstream of funding.** BNR cannot derive the address, so there is no first transaction to pay for. Out of scope; see §6.

**Class-A total per user: ~$0.25.** Vaulta RAM $0.088–0.099 + float $0.033–0.037 + Hive 3.000 HIVE $0.124. Two orders of magnitude below the $17.42 basket that killed Model C, which is the entire reason this is arguable as a bootstrap seed rather than a standing subsidy — but it is still a founder decision, not an implementer's (§7, F1).

---

## 5. Deposit split

**First, the thing that governs everything below: the deposit never lands at BNR.** "Split" means *a quote the user executes with their own wallet or exchange withdrawals*, which BNRoSE then verifies by reading each chain. There is no BNR receiving address anywhere in this flow (`SPEC-BNROSE-ONBOARD.md:74-76`).

### $10 walk, priority ladder, allocate-in-order, refuse-don't-partially-fund

| Order | Rail | Amount | USD | Running | Why here |
|---|---|---|---|---|---|
| — | *Vaulta creation* | 4096 B RAM + 0.5 A | *$0.12–0.14* | *BNR seed, not from deposit* | Class A |
| — | *Hive creation* | 3.000 HIVE | *$0.124* | *BNR seed, not from deposit* | Class A |
| 1 | Arbitrum One | 0.0002 ETH | $0.37 | $0.37 | cheapest live EVM rail |
| 2 | Vaulta working float | 5 A | $0.33–0.37 | $0.74 | `b` settles here (G7) |
| 3 | Hive Power | 10 HIVE | $0.41 | $1.15 | own RC, ends the delegation dependency |
| 4 | Bitcoin Cash | 10,000 sat | $0.021 | $1.17 | negligible, no spike risk |
| 5 | Stellar | 2 XLM | $0.34 | $1.51 | clears the 1 XLM min + one trustline |
| 6 | Solana | 0.005 SOL | $0.37 | $1.88 | rent + one ATA + fees |
| 7 | Zcash (t) | 50,000 zat | $0.25 | $2.13 | 5× the ZIP-317 minimum fee |
| 8 | exSat | 0.00001 BTC | $0.64 | $2.77 | ~1,000 txs |
| 9 | XRP | 1.1 XRP | $1.19 | $3.96 | 1 XRP is locked, not spendable |
| 10 | Ethereum L1 | 0.001 ETH | $1.87 | $5.83 | sized for 30–100 gwei, not for today |
| 11 | **Bitcoin** | 20,000 sat | **$12.82** | — | **REFUSED** |
| — | Residual | — | **$4.17** | — | see policy |

**The refusal is the feature.** Bitcoin's spike-survivable floor is $12.82. $4.17 remains. The system does **not** fund BTC at 6,500 sat, because a UTXO funded there goes permanently uneconomical the moment fees pass ~45 sat/vB and the user is left staring at a balance they can never move — the exact failure the founder is trying to avoid. It emits:

```
FloorRefusal { rail: Bitcoin, required: 20_000, offered: 6_507, unit: "sat" }
→ "Bitcoin needs 20,000 sat (~$12.82) to survive a fee spike. You have $4.17.
   Short $8.65. Not funded. Top up any time and it provisions then."
```

### Residual policy — four rules

1. **Never split a residual across rails to make the table look full.** A residual that clears no remaining floor is not spent.
2. **Residual accrues to the settlement rail (Vaulta, as A).** Vaulta has no dust floor once RAM is bought — any amount of A is spendable — so it is the only rail where a residual cannot strand. $4.17 ≈ 57–64 A.
3. **Refusals are sticky and re-evaluated on every deposit.** `RailStatus::Refused` is a resting state, not an error. The rail provisions the moment the user's balance clears the live floor.
4. **A rail marked `Unavailable` (Arweave, Zano) receives zero allocation and shows its named blocker.** Never a blank, never a silent skip.

### Scaling to other $X

- **$3** clears rails 1–4 only ($1.17), residual $1.83 to Vaulta. Five refusals, each named.
- **$10** as above.
- **$25** clears 1–11 ($18.65) with $6.35 residual — the first amount at which the founder's "all the addresses" is *fully funded* for the 11 provisionable rails.

The honest headline: **~$18.65 is the price of a fully-funded 11-rail walk at spike-survivable levels.** $10 buys 10 rails and one honest refusal. Nothing in this design pretends otherwise.

### Sybil note, because the split determines it

`SPEC-BNROSE-ONBOARD.md:91-93` requires grant value to stay strictly below the walk cost, and sizes the whole defence on the walk costing the user real money. Under this design that inequality **holds**, because the user funds their own walk from their own money — but only barely, since under R3 the $10 becomes the user's own assets rather than being burned. The residual sybil tax is the *irreversible* fraction: Hive's 3 HIVE is burned, Vaulta RAM is encumbered by `giftram`, XRP's 1 XRP is ~80% recoverable, Zano's fee is burned. **BNR's $0.25 Class-A seed is pure extractable loss to an attacker** and is the number that the cohort cap must bound (§7, F1/F2).

---

## 6. Build order

Every phase ends with a real user, on mainnet, holding something they can move. No phase ends in a stub.

**Phase 0 — the address book, and the refusal.** *(No chain writes.)*
Ship `crates\onboarding\src\rails.rs` (§1), the per-rail floors table, `FloorRefusal`, `Wallet::observe`, plus the four crate fixes: `Enrolment::anchor`, `SettlementBinding` smart constructor with no `Deserialize`, the three new `InformedConsent` disclosure fields enforced like `discloses_pds_custody`, and `RootIdentity` DID-method validation.
**Ends working:** a real user's Safe 7 exports every account xpub with a physical confirmation, and the surface displays every derivable address across 11 rails, each address re-derivable and verifiable on-device. They can receive at any of them today. Two rails show a named blocker instead of an address. **Done when:** an address derived by BNR and an address shown by Trezor Suite match, on hardware, for all 8 Suite-native rails.

**Phase 1 — Arbitrum One, complete.**
Floor quote, user self-funds from any exchange, BNRoSE reads arrival via RPC, `RailStatus::Live`.
**Ends working:** a real user has a funded Arbitrum address, signs a transfer on their own Safe 7, and it confirms. Zero BNR signatures, zero BNR custody, whole loop closed.

**Phase 2 — Vaulta, complete.** *The largest single chunk of new work.*
Prerequisite (blocking, do first): acquire the `bnr` suffix account. Then build the Vaulta **write** path — note A47: `chain-eos` is **read-only** (SHIP codec + ingester, no transaction construction, no signing, no account creation), so transaction building, serialization and signing are entirely new. Then: `newaccount` + `giftram(4096)` + powerup + 0.5 A float, atomic, one transaction, founder-signed in batches; user's Vaulta keypair generated client-side with `discloses_software_key` enforced.
**Ends working:** a real user holds `b` on Vaulta in an account their own key controls, and moves it, and can renew their own powerup on day 400.

**Phase 3 — Hive, complete.**
`account_create` with a fee re-read immediately before broadcast; four client-generated public keys; `delegate_rc` follow-up; `discloses_recovery_custody` enforced **and** `change_recovery_account` surfaced in the UI with its 30-day delay stated.
**Ends working:** a real user transfers and posts on Hive from an account whose owner key only they hold, having been told in advance that BNR is their default recovery account and how to change it.

**Phase 4 — Class-B breadth, one rail at a time, each independently shippable.**
BCH → XLM → SOL → ZEC-t → XRP → ETH L1 → exSat. Each is *derive + quote + watch*: no BNR signing, no new key handling, no new custody surface. Per-rail gotchas are already enumerated (§2) and each rail is done when arrival verification passes on mainnet with a real deposit. exSat ships last and only after the Trezor Connect network-definition path is exercised on physical hardware; until then it stays `Unavailable`, and `XBTC` is labeled **XBTC** everywhere, never `BTC`, with the custodian dependency disclosed via `discloses_bridge_custody`.

### Deliberately out of scope for v1 — and why that is scoped, not half-built

| Out | Named blocker | What would unblock it |
|---|---|---|
| **Arweave / ANT / ArNS** | RSA-4096 JWK, no hardware path, dynamic surcharge, ANT moved to Solana as a Metaplex Core asset (Suite support **unverified**) | Founder ruling that a browser-generated keyfile is acceptable + a live ArNS price feed + a hardware test of Metaplex Core in Suite |
| **Zano** | BNR cannot derive the address; zero Trezor firmware presence; Monero precedent proves firmware alone is insufficient | A coreapp firmware fork **and** a Safe 7-protocol-aware host — multi-quarter, two-sided |
| **Zcash shielded** | `apps/zcash/signer.py` hardcodes zero Sapling/Orchard bundles — a firmware fact, not a Suite gap | Upstream firmware work; PR #1847 closed unmerged, #2472 open |
| **XRP issued tokens** | No `TrustSet` in `messages-ripple.proto` | Upstream proto addition |
| **Stellar sponsored reserves** | No `EndSponsoringFutureReserves` in `messages-stellar.proto`; the sponsored account must sign it | Upstream proto addition |
| **Per-user smart-wallet contracts on Vaulta** | `setcode_ram_bytes_multiplier = 10` — a 100 KB wasm bills 1,024,000 bytes = 338.7 A ≈ $22–27 **per account** | Nothing. Never do this per-user |

**Why this is scoped and not half-built.** The founder's standard is "no version after version of half built software." Half-built means a rail that *appears* provisioned and hands the user a balance they cannot move — Vaulta at 1600 bytes, BTC at 5,000 sat, Zcash at 8,000 zat, Zano at 0.01, a Vaulta account whose powerup lapsed at T+24h. Every one of those is a rail that looks finished. This design ships **eleven rails that fully work and two that say, in the UI, exactly why they do not and what would change it.** A named `Unavailable { blocker }` is a finished state. A funded-below-floor rail is not.

---

## 7. What must be settled before code

### Founder-class — no seat can settle these

**F1 — Article V.1 authorization for the Class-A seed.** `CONSTITUTION.md:83` forbids the operator absorbing cost; `:128` names Vaulta RAM/CPU/NET and ZANO/AR/ANT specifically and says "never subsidizes." Its only door is "bootstrap seeds." **Question:** does the founder authorize ~$0.25/user of Class-A seed (Vaulta RAM + float + 3 HIVE) as a bootstrap seed, with (a) a hard cohort cap N and (b) a sunset date? The cap is the sybil bound and the design does not ship without a number in it. Route per `feature-backlog.md:283-285`: CD-4 / Article VI meta-tier, premine-robe test applies.

**F2 — the pre-spend gate.** Must a bDiD reach `ViewGrade::Settlement` (`lib.rs:314-319`: `binding.is_some() && root.anchored && verified_bidirectional && op_log_views >= 2`) before BNR signs *anything*? Note `reachable_grade` never returns `Informational`, so gating on "has a grade" gates on nothing. Today `Enrolment::complete` requires only a free passkey and a free written code — there is no cost between "stranger" and "BNR signs two transactions for you."

**F3 — Hive recovery-account custody.** BNR becomes every created account's default recovery account: a standing, seizure-capable relationship, changeable only by the user via `change_recovery_account` with a 30-day delay. Does BNR accept this role at all, and is disclosure-plus-surfacing sufficient? This is the same defect class RELAY_22 §5a already legislates for PDS custody (`lib.rs:149-156, 199-201`); the crate enforces disclosure for an identity binding and not for a seizure power over money.

**F4 — launch breadth.** 3 rails at launch (Vaulta, Hive, Arbitrum) with 8 more following one at a time, versus attempting more simultaneously. Related: the founder's own named list includes AR and Zano, which cannot ship — confirm they are struck rather than deferred.

**F5 — the signing budget.** Every Class-A act needs a founder device confirmation, and the Safe 7 cannot sign Vaulta or Hive at all — so BNR's own treasury keys on those two chains are **software keys by necessity**. Confirm this explicitly, and set a batch size and a rate. The predictable failure is that ops quietly provisions a hot signer and the standing law is broken by operations rather than by design.

**F6 — user-side software keys.** Vaulta and Hive user keys cannot live on a Safe 7. Confirm that client-side software key generation for those two rails is accepted, with `discloses_software_key` as the enforced disclosure.

**F7 — G5, still open.** The legal read on the `b` grant (`SPEC-BNROSE-ONBOARD.md:143`) remains founder + outside counsel. Nothing in this design touches it, and no signing or provisioning decision should be mistaken for progress on it.

### Implementable — no founder input needed

1. Per-rail floors table with live re-quoting: Vaulta rammarket is a floating Bancor price (0.000329067 A/byte today); Hive fee is a witness-voted median that must be **exact**; Arweave (if ever) must be priced per-address.
2. `FloorRefusal` + `Wallet::observe` idempotent, resumable, per-rail — the state machine that does not exist in the crate today.
3. Safe 7 xpub export UX, one confirmation per account tree, signatures never requested.
4. `powup.state` query at **scope 0 / empty name**, not scope `eosio`.
5. `core.vaulta::giftram` not `buyrambytes`; 4096 bytes not 1600.
6. Solana `CreateIdempotent`; path pinned at `m/44'/501'/i'/0'` (4-level) and documented against Ledger's 3-level.
7. exSat: host must supply the signed network definition from `data.trezor.io/firmware/definitions/eth/chain-id/7200/network.dat`; XBTC labeled XBTC everywhere.
8. Arrival verification by chain read only, never from broadcast.
9. `core.vaulta` `swaptrace` indexed if balances are tracked.

### Explicitly uncertain — do not invent numbers

- **A (Vaulta) spot** — disputed across venues today, $0.0647–$0.0803. Every A figure here carries ±25%.
- **ANT/ArNS registration cost** — ar.io publishes no fee table by design; the 2,384.25 ARIO in the SDK docs is a documentation sample, not a quote. Solana-side cost ~$0.40–$0.60 is **unverified**.
- **exSat on physical Safe 7** — the signed network definition exists (fetched, 575 bytes) but no end-to-end hardware exercise has been done. Failure mode is an "unknown network" display, not a lost transaction — but it is unverified.
- **Hive `delegate_rc` batch limits** — per-op delegatee count and any minimum delegation size not verified against hived source.
- **Zano alias 0.11 ZANO** and **HF6 gateway registration 100 ZANO** — both from secondary sources; `currency_config.h` exposes only a decaying-price schedule, not a flat table. Moot for v1 (Zano is out) but do not carry these figures forward unverified.
- **Zcash transparent dust threshold** — zcashd used 300 zat/kB, secondary sources say 2,730; unconfirmed against current Zebra. Moot because the 10,000-zat ZIP-317 fee dominates. Size off 10,000.
- **Trezor Safe 7 authenticity root** — `data.trezor.io/firmware/t3w1/authenticity.json` returns **404** while `t3t1` returns 200. Any design that attests device genuineness is blocked on a vendor publication BNR does not control.
