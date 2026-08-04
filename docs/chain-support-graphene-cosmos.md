# Chain support — BitShares/Graphene, Injective, Cosmos

<!-- 7 agents incl. 2 adversarial cross-checks. Measured against the BNR
     Trezor fork at 2,361,344 B of FIRMWARE_MAXSIZE 3,416,064 B. -->

# Chain-Support Addendum — BitShares / Graphene, Injective, Cosmos

**Scope:** answers the founder ask verbatim — *"i want to see about adding Bitshares/BTS as well; plus make sure we are good for injective/cosmos chains."*
**Fork state assumed:** T3W1, EOS/Vaulta re-enabled, Zano in progress. Firmware image 2,361,344 B of `FIRMWARE_MAXSIZE` 3,416,064 B (`core/embed/models/T3W1/memory.h:64`) — **~1.05 MB / 31% free.**
**Standing rule honored:** no half-built versions. Every recommendation below is either "ship it complete" or "don't start it."

---

## 1. The Graphene realization

BitShares is not a new family for this fork. **It is the family the fork is already in.**

Dan Larimer built Graphene for BitShares 2.0; EOS/Antelope is the descendant. That lineage is not trivia here — it is sitting in the C code:

- `core/embed/upymod/modtrezorcrypto/modtrezorcrypto-secp256k1.h:100-106` — `eos_is_canonical` is **character-for-character** the Graphene `is_canonical` predicate. Verified against beem's `_is_canonical` in `beemgraphenebase/ecdsasig.py`: same four high-bit tests, same order.
- `:157` — `sig.buf[0] = 27 + pby + compressed*4` is beem's `recid + 4 + 27`, exactly.
- `apps/eos/helpers.py:48-58` — `public_key_to_wif` with `"EOS"` → `"BTS"`/`"STM"` emits a **valid Graphene public key verbatim**: same compressed-33 payload, same `ripemd160(...)[:4]` checksum.
- `apps/common/writers.py:84-92` — `write_uvarint` is byte-identical to `graphenebase/types.py` `varint()`.

**So the crypto cost of the entire Graphene family is zero.** Nothing new in C. That is the realization, and it is real.

What comes as a family: **BitShares, Hive, Steem, Golos, Blurt, Peerplays** — all share the envelope:

```
chain_id[32] | ref_block_num u16le | ref_block_prefix u32le | expiration u32le
             | varint(n_ops) | (varint(tag) ‖ body)* | varint(0)
→ single SHA-256 → secp256k1 CANONICAL_SIG_EOS → raw 65-byte compact sig (no SIG_K1_ wrapper)
```

Versus `apps/eos/sign_tx.py:38-62` the deltas are three: header field order swapped, no `max_net_usage_words`/`max_cpu_usage_ms`/`delay_sec`, and **lines 43 and 57 must not be emitted** (no `context_free_actions` count, no trailing 32 zero bytes). `chain_id` already arrives as a protobuf field (`sign_tx.py:41`), so it parameterizes for free.

### What one app does NOT cover

The single-parameterized-Graphene-app claim was put to an adversarial cross-check and **refuted, high confidence.** The correct shape is **two operation front-ends over one shared envelope module.**

Measured on the shipped EOS app (808 lines total): the reusable envelope is **187 lines (23%)** — `__init__` 5, `get_public_key` 34, `helpers` 58, `layout` 23, `sign_tx` 67. The operation layer is **621 lines (77%)**, and it shares **nothing** across the BitShares/Hive boundary.

Three structural facts, not preferences, kill the single app:

1. **Disjoint tag tables, no name-level rescue.** BitShares has 78 op tags, Hive 50 regular + 43 virtual. Intersection at matching tag index: **empty.** Intersection at matching name *and* field layout: **empty.** BTS 2 = `limit_order_cancel`, Hive 2 = `transfer`. A shared dispatcher degenerates to `if chain == BTS: <78-arm table> else: <50-arm table>` — two apps wearing one filename, with a new failure mode: a chain_id/table mismatch signs a real transfer while showing a cancel-order screen.

2. **The unknown-action escape hatch cannot be ported.** `apps/eos/actions/__init__.py:84` emits `write_bytes_prefixed(sha, w)` — EOS declares each action payload's length, which is the sole reason `_process_unknown_action` (`:87-120`) can stream an opaque blob and confirm it by SHA-256 checksum. Graphene's `Static_variant.__bytes__` is `varint(type_id) + bytes(data)` — **no length.** An unknown Graphene op cannot be skipped, cannot be bounded, cannot be blob-hashed; the device cannot even reach the extensions tail to finish the digest. **A Graphene app must fully decode every op it will sign, or hard-refuse mid-stream.** The op decoder is not optional surface — it *is* the app. Real consequence: Hive's `custom_json` (tag 18) dominates live Hive traffic and every one outside the compiled whitelist is a dead end, not a degraded confirm.

3. **Asymmetric trust model, not asymmetric strings.** `eos_name_to_string` / `eos_asset_to_string` (`helpers.py:17-45`) work because EOS names and symbols are self-describing *inside the signed bytes*. Hive/Steem have direct analogues (length-prefixed UTF-8 name; `amount i64 | precision i8 | symbol[7]`). BitShares has **neither**: `ObjectId.__bytes__` returns the instance number alone, assets are `(i64, varint asset_id)`. A BitShares confirmation is either unverifiable (host-supplied labels outside the signature) or unreadable (`1.2.12345 → 1.2.67890, 10000000 of 1.3.0`). Different security posture, different UX, different warning flows — not a config toggle.

**What survives:** Hive + Steem in one app is honest (same `STM` prefix, same op tags 0-43, same string accounts, same legacy asset; deltas are chain_id, Hive-only ops 44-49, Steem-only SMT ops, and Hive's HF26 pack boolean). The envelope module is genuinely shared with BitShares too. The op front-ends are not.

### The free-tier collision (read this before scoping anything)

The target architecture is **free tier = derive addresses, no chain writes, scales to billions**. That architecture **does not exist on Graphene**, by construction:

- A Graphene account is a *registered name* mapping to an authority set. Transfers address `object_id` (BitShares) or a length-prefixed account name (Hive/Steem). **There is no address derivable from a key alone.**
- Getting a usable identity requires an on-chain `account_create` — which costs a fee on BitShares and RC/fee on Hive, paid by an existing account.

So **every Graphene account is a paid-tier account.** Free-tier derivation for BTS/HIVE/STEEM can deliver a public key (`BTS7…`, `STM7…`) and nothing else. Cosmos and Injective, by contrast, are perfect free-tier chains — the bech32 address is a pure function of the key and the account materializes on first receipt.

*(Confidence note: this follows directly from the measured wire encodings and op tables rather than from a separately fetched account-model spec. Confirm before it goes in a product deck — but the encodings leave little room for another reading.)*

Second structural cost the EOS app does not prepare you for: **derivation.** EOS is `PATTERN_BIP44` / SLIP-44 194 (`apps/eos/__init__.py:1-5`). Graphene's standard is **SLIP-48**: `m/48'/network'/role'/account'/key'`, roles owner=0 / active=1 / memo=3 / posting=4, because a Graphene account is an authority set BIP-44's one-key-per-account shape cannot express. Ship `m/44'/308'/…` and you produce keys **no BitShares wallet can reproduce.** Note `purpose 48'` is already in-tree with a *different* shape at `apps/bitcoin/keychain.py:54-56` (6 levels, unhardened tail) — not a blocker, but it rules out naive pattern reuse. And `posting` (role 4) has no BitShares equivalent, so even the role enum is chain-conditional.

---

## 2. BitShares

| | |
|---|---|
| **chain_id** | `4018d7844c78f6a6c41c6a552b898022310fc5dec06da467ee7905a8dad512c8` <!-- PUBLIC-CONSTANT: BitShares mainnet chain id, published in every Graphene client --> |
| **key prefix** | `BTS` |
| **pubkey encoding** | `base58(pk33 ‖ ripemd160(pk33)[:4])` — `helpers.py:48-58` verbatim, swap `"EOS"`→`"BTS"` |
| **SLIP-44** | **308** (official, `slip-0044.md`) |
| **CAIP-2** | **none** — no `bitshares` or `graphene` namespace exists in ChainAgnostic |
| **registry key** | `slip44:308` |
| **derivation** | SLIP-48 `m/48'/1'/role'/account'/key'` (network `0x00000001`) — **not** BIP-44 |
| **signing** | envelope above, `secp256k1.sign(priv, digest, True, CANONICAL_SIG_EOS)` — reused verbatim |

### What the firmware needs

**Free (already in the tree):** the canonical-sig predicate, the recovery byte, `write_uvarint`, `base58_encode`, `sha256` streaming, the whole `sign_tx` skeleton.

**New:**
1. **Envelope module** (~187 lines adapted): drop `sign_tx.py:43` and `:57`, reorder the header per `writers.py:62-68`, emit `varint(0)` extensions.
2. **SLIP-48 keychain pattern** — new 5-level pattern with a role level; cannot reuse `PATTERN_BIP44` or bitcoin's `PATTERN_BIP48_*`.
3. **A complete op whitelist with hard refusal.** No catch-all is possible (§1.2). Minimum useful set: `transfer` (0), `limit_order_create` (1), `limit_order_cancel` (2), `account_update` (5-ish region), `asset_transfer` family, `vesting_balance_withdraw`. Every BitShares op begins with `asset fee` (`FC_REFLECT(transfer_operation, (fee)(from)(to)(amount)(memo)(extensions))`), which Hive ops do not.
4. **Sorted-map serialization** for any `account_update` / `account_create`: Graphene `Permission` = `weight_threshold u32 | Map(String→u16) account_auths | Map(PublicKey→u16) key_auths`, and the C++ `flat_map` **requires sorted entries** while `graphenebase`'s `Map.__bytes__` does *not* sort. `write_auth` (`writers.py:38-59`) also emits a key-type varint and a `waits` vector Graphene has neither of. Forwarding host ordering yields a wrong digest or an unenforceable authority. This landmine is absent from EOS entirely.
5. **A display decision that has to be made before a line is written.** Recipient and asset are numeric ids inside the signature. Either (a) show `1.2.12345 → 1.2.67890, 10000000 of 1.3.0` — correct, unusable; or (b) show host-supplied labels — usable, and a malicious host relabels `1.2.99999` as "alice" while the device faithfully corroborates it. That is precisely the attack class the EOS app avoids by decoding names from signed bytes. **There is no third option that is both honest and readable.** Recommended posture if built: transfer-only, numeric ids shown raw, plus an unconditional "the device cannot verify this recipient's name" warning screen.

### Effort relative to the shipped EOS app

- Envelope: **~23% free.** Crypto: **100% free.**
- Op layer: **~621 lines of EOS bought 13 actions** plus 39 `eos__` translation strings and `actions/layout.py` at 305 lines. A BitShares whitelist of 6-8 ops with no catch-all lands at roughly **60-70% of the EOS op-layer cost**, plus the SLIP-48 pattern, plus the sorting logic, plus the warning UX EOS never needed.
- Registration is two lines (`workflow_handlers.py:232-236`). That is not where cost lives.

**Bottom line: a *complete* BitShares app is EOS-scale work minus the crypto, plus a security problem EOS does not have — and it lands on the paid tier only, because BTS accounts must be registered on-chain.**

---

## 3. Injective

**Cross-check verdict first: `inj-eip712` — holds = TRUE, high confidence.** The check set out to refute the claim and found the opposite.

**The BNR Safe 7 can produce a valid Injective transaction signature today with zero new firmware.**

The complete explanation of "why isn't Injective a typical Cosmos chain": **it is an Ethereum chain wearing a Cosmos address format.** Same secp256k1 curve, coin type **60** (not 118), address = `keccak256(uncompressed_pubkey[1:])[12:]` — the bit-for-bit Ethereum address — re-encoded as bech32 with HRP `inj`. `inj14au322k9munkmx5wrchz9q30juf5wjgz2cfqku` ≡ `0xAF79152AC5dF276D9A8e1E2E22822f9713474902`. The `inj1` form is pure client-side re-encoding.

And the signing primitive was **written by Injective, for Injective**: `sign_typed_data.py` came from [trezor-firmware PR #1568](https://github.com/trezor/trezor-firmware/pull/1568), authored by xlab (Max Kupriianov) of Injective Protocol, explicitly to sign Cosmos txs from Ethereum wallets.

### Direct evidence in this tree

- `common/tests/fixtures/ethereum/sign_typed_data.json:678-820` — a fixture literally named **`"injective_testcase"`**, comment *"Full Injective Protocol testcase (issue #2167)"*. Domain `{name:"Injective Web3", version:"1.0.0", chainId:1, verifyingContract:"cosmos", salt:"1646906878039"}`, primaryType `Tx`, message `chain_id: "injective-1"`, `cosmos-sdk/MsgDelegate`, `inj17vy…` → `injvaloper1w3p…`, denom `inj`. Exercises `Coin[]`, `Msg[]`, nested `Tx → Fee → Coin` and `Tx → Msg → MsgValue → TypeAmount`. Expected signature recorded: `0x4873bf73…1c`.
- `tests/device_tests/ethereum/test_sign_typed_data.py:29-46` — `@pytest.mark.models("core")`, so it runs on **T3W1** and asserts that exact signature.
- `tests/ui_tests/fixtures.json:35714, 39376, +4` — six recorded **Eckhart** screenshot hashes, `T3W1_{cs,de,en,es,fr,pt}_…[injective_testcase]`. The T3W1 layout renders the whole flow. Not extrapolation.
- Path: `apps/ethereum/keychain.py:66-74` `PATTERN_BIP44_ETH = "m/44'/coin_type'/0'/0/account"` with slip44 60 — Injective's path exactly. No new keychain pattern.
- Routing: `workflow_handlers.py:170`, unconditional for core. `apps/base.py:129` announces `Capability.Ethereum` for all models — **no EOS-style `INTERNAL_MODEL` gate** (contrast `base.py:162-170`).
- Signature shape: `sign_typed_data.py:57-64` → `r‖s‖v` with **v ∈ {27,28}**, byte-identical to `eth_signTypedData_v4` and to what Ethermint's `Eip712SigVerificationDecorator` normalizes by subtracting 27.
- Strings are **filled**, unlike the `eos__` case: `ethereum__sign_eip712`, `ethereum__show_full_struct`, `ethereum__show_full_array`, `ethereum__title_confirm_typed_data` all present in `core/translations/en.json:868-892` and `translated_string.rs:431-449`.
- Arrays of structs at `:354-377` with `metamask_v4_compat=True` (default, proto line 25) use `hash_struct` per element — exactly the mode go-ethereum's `apitypes`, and therefore Ethermint's ante handler, reconstructs.

### What must be verified on hardware before anyone relies on it

The signature machinery is proven. **What is unproven is the end-to-end path — nobody in this tree has broadcast an Injective transaction.** Before this goes in any customer-facing claim, run all five:

1. **Broadcast one real tx on `injective-1`.** The whole gap between "correct EIP-712 signature" and "chain accepts it" is host-side and untested here.
2. **Resolve the `typedDataChainID` value.** The fixture carries `chainId: 1`. One measurement pass surfaced Injective's EIP-155 id as **888**; the registry pass surfaced **`eip155:1776`** for Injective EVM from a secondary source (chainlist), *not* from `ethereum-lists/chains`. **These do not agree and neither is confirmed from a primary Injective source.** chainId is host-supplied and hashed opaquely, so firmware capability is unaffected — but the ante handler will reject a mismatch. Pin it from a primary source before building.
3. **`v` normalization 27/28 → 0/1** in the client, and `ExtensionOptionsWeb3Tx{typedDataChainID, feePayer, feePayerSig}` attached to the tx.
4. **Confirm Ethermint's `PrivKey.Sign()` uses `keccak256(msg)`, not sha256.** `Address()` and the constants were read; `Sign()` was not. If it holds (likely), `SIGN_MODE_DIRECT` is *unreachable* from the Ethereum app — `sign_message.py` forcibly prepends `"\x19Ethereum Signed Message:\n"` and `sign_tx.py` hashes RLP, so neither yields a bare `keccak256(signBytes)`. That makes EIP-712 not merely convenient but **the only path**, which is the load-bearing reason the answer is "use EIP-712" rather than "add a Cosmos app."
5. **Exercise one exchange message** (`MsgBatchUpdateOrders` or similar) against a golden signature. Confirmed scope is single-message `cosmos-sdk/*` amino-JSON with 1-D arrays of structs at depth ~4. Exchange messages are deeper and wider but structurally identical, so they should work — not verifying one is the only reason confidence here is *high* rather than *certain*.

### Honest limitations (none block signing)

- **The device never shows `inj1…`.** `apps/ethereum/layout.py:397-409` renders `"0x" + hexlify(address_bytes)`. A user delegating INJ confirms an Ethereum-looking `0x73d0385F…`. Correct bytes, wrong alphabet for the chain being signed.
- **The confirmation is generic EIP-712, not Injective-aware.** No denom/precision formatting: the user reads `"100000000000000000"` and `"inj"` as two unrelated strings, never `0.1 INJ`. Worse, `limit_str(s, limit=16)` (`layout.py:560-565`) truncates nested titles to the **last** 16 chars behind a `..`, so `msgs.value.amount` and sibling branches can collapse to visually identical titles. Legible, not unambiguous.
- **Nested arrays (`T[][]`) fail ungracefully.** `sign_typed_data.py:353` carries the TODO verbatim; `validate_field_type` (`:517-565`) accepts a 2D array, then `encode_field` (`:473`) raises a **bare `ValueError`, not a `DataError`** — the host gets a generic firmware error instead of a clean refusal. `trezorlib/ethereum.py:89-91` refuses client-side first, and Ethermint's generator emits no 2D arrays, so this is a latent edge rather than an Injective blocker. Worth converting to `DataError` while you're in there.
- **`verifyingContract: "cosmos"` (V1) is not a 20-byte address** and must be declared as type `string` in the domain array — `sign_typed_data.py:507-509` rejects any `ADDRESS` field that isn't exactly 20 bytes. Load-bearing for the client.
- **Zero Injective-specific code exists in the fork.** `grep -rni injective` over `*.md/*.py/*.rs/*.proto` returns nothing; the only hits anywhere are the two test fixtures. "Signs today" means: hand the device typed data, get a correct signature. Building the amino JSON, deriving `inj1…`, assembling and broadcasting the tx are **all host work that does not exist yet.** Trezor Suite will not show an Injective account.
- **Use EIP-712 V1, not V2.** V2 flattens the tx into two opaque JSON strings (`context`, `msgs`) — the user sees two blobs. V1 renders the amino tree field-by-field. Client choice, not a firmware constraint, and V1 is the only defensible clear-signing story.

**Contrast for calibration:** EOS needed `eos_is_canonical` in C; Zano needs `zano_generate_clsag_ggx` in C. Injective needs neither, and needs no app directory. **It is strictly less work than either — arguably zero.**

---

## 4. Cosmos generally

### What ATOM / Osmosis / Celestia / dYdX require

- **Key:** `/cosmos.crypto.secp256k1.PubKey`, 33-byte compressed. Same curve already shipped.
- **Address (ADR-028):** `bech32(hrp, ripemd160(sha256(pubkey33))[:20])` — **bech32 (BIP-173, checksum const 1), not bech32m.**
- **Both primitives are already in the tree:** `core/src/trezor/crypto/scripts.py:4` defines `class sha256_ripemd160(sha256)` — the exact address hash. `core/src/trezor/crypto/bech32.py` exposes `bech32_encode(hrp, data, Encoding.BECH32)` + `convertbits()`, generic and HRP-agnostic. (Do **not** use `encode()`/`decode()` — those are segwit-specific. Call the primitives directly, as OneKey does.)
- **Signing:** `sha256(protobuf(SignDoc))` → ECDSA → 64-byte `R‖S`, **low-S required**. The fork already satisfies low-S unconditionally at `crypto/ecdsa.c:755-756`. **`CANONICAL_SIG_EOS` is irrelevant to Cosmos** — Cosmos wants exactly the default, not the Graphene high-bit rule. Nothing to reuse from the EOS work here.

| chain | chain_id | HRP | slip44 | fee denom |
|---|---|---|---|---|
| Cosmos Hub | `cosmoshub-4` | `cosmos` | 118 | uatom |
| Osmosis | `osmosis-1` | `osmo` | 118 | uosmo |
| Celestia | `celestia` | `celestia` | 118 | utia |
| dYdX | `dydx-mainnet-1` | `dydx` | 118 | adydx |
| Injective | `injective-1` | `inj` | **60** | inj, **`ethsecp256k1`** |

**Injective is not the general Cosmos case; it is an Ethermint case.** A Cosmos app doing 118/secp256k1 serves Hub + Osmosis + Celestia + dYdX and essentially the rest of the ecosystem, and does **not** serve Injective without a second address codepath. OneKey's table includes `injective-1` — **that is a likely defect**, since a secp256k1/ripemd160 address for `inj` is simply wrong. (Inference from their code, not something they document.) **Do not copy that row.**

### Trezor's current support: none

`core/src/apps/` contains `bitcoin, cardano, common, debug, eos, ethereum, evolu, homescreen, management, misc, monero, nem, nostr, ripple, solana, stellar, telemetry, tezos, thp, tron, webauthn, zano, zcash`. **No `cosmos/`.** `common/defs/` has no cosmos defs. Repo-wide case-insensitive grep for `cosmos` returns exactly 2 irrelevant files. [Issue #119](https://github.com/trezor/trezor-firmware/issues/119) (2019) closed as not planned.

### Does one app serve many chains? Yes — proven, not theoretical

OneKey (a trezor-core fork) ships a table-driven `networks.py` keyed `chain_id → (chain_id, chain_name, coin_denom, coin_minimal_denom, coin_decimals, hrp, icon, primary_color)` covering **~24 chains in 7,574 bytes**. Adding a chain = one tuple. Runtime app is 5 files, ~25.5 KB Python.

### Prior art to fork — this materially changes the estimate

- **[PR #6720](https://github.com/trezor/trezor-firmware/pull/6720)** — @Pantani, opened 2026-04-07, **closed 2026-04-08, 5,904 additions.** The mature one: rejects unknown protobuf fields, validates signer info, restricts HRPs to a known list, rejects unsupported msg types *before* showing UI, confirms chain id / account number / sequence / msg type / outputs / fee / memo / timeout height. Full device tests, fixtures, changelog. **Closed for a non-technical reason** — maintainer Hannsek: *"we don't accept any new chain support … because flash space constrains."* **That reason does not apply to this fork.** Its CodeRabbit review surfaced concrete defects worth inheriting as fixes.
- **[PR #5440](https://github.com/trezor/trezor-firmware/pull/5440)** — @n0izn0iz, opened 2025-07-28, **still open (draft), 4,818 additions.** SIGN_MODE_DIRECT, secp256k1, slip44 118, `MsgSend` clear-signing. Author demonstrated a **real end-to-end broadcast** on AtomOne (`atone` HRP, `m/44h/118h/0h/0/0`, tx `398CE76B…`).

**Fork #6720 as the base and cherry-pick #5440's proven-broadcast path.** Neither needs to be written from scratch.

### The one real gap

`MICROPY_PY_UJSON (0)` at `core/embed/projects/firmware/mpconfigport.h:140` (and `unix/mpconfigport.h:149`). OneKey's cosmos app is built on `import ujson`. An **Amino-JSON** implementation must either flip that flag (costs flash, adds an untrusted-input C parser to the attack surface) or hand-roll a streaming parser. **A DIRECT-mode implementation avoids this entirely** — which is exactly why both Trezor PRs chose DIRECT. **Choose DIRECT. Do not flip `ujson`.**

The remaining hard part is not crypto: `TxBody.messages` is `repeated Any`, an open universe, and the firmware's protobuf codec only decodes registered Trezor message types — it cannot walk `TxBody.messages[i].value`. You need a hand-rolled protobuf reader. Three postures: **(1) allowlist + hard reject** — safest, smallest, most useful; **(2) allowlist + raw JSON fallback** (Ledger's model — above depth ~2 they dump raw JSON text); **(3) SIGN_MODE_TEXTUAL** — lowest firmware complexity, ecosystem adoption still thin. **Take posture 1**; it matches #6720 and matches the no-half-built rule.

### Effort and verdict

| Phase | Scope | Size |
|---|---|---|
| 1 | `CosmosGetAddress`/`CosmosGetPublicKey`, HRP param, address derivation, path validation | ~400 LOC + proto + trezorlib |
| 2 | `CosmosSignTx` DIRECT, `MsgSend` only, chain-id table, confirm screens | ~700–900 LOC |
| 3 | Allowlist expansion (delegate / undelegate / withdraw / IBC transfer) | ~150 LOC per msg type |
| 4 | Eckhart strings, device tests, fixtures | ~comparable to the 39 `eos__` strings |

In-tree comparables: `tezos` 767 LOC, `eos` 808, `ripple` 536, `stellar` 2,064. **Phases 1-2 land squarely in the eos/tezos band (~800-1,000 LOC of `core/src/apps/`), plus roughly 4× that in generated bindings and tests.** You have done the eos-scale lift once already in this fork.

**Verdict: v2 — the release right after Zano lands.** Not v1 (it is a new app with a new protobuf surface and a hand-rolled Any-decoder; rushing it produces exactly the half-built version the standing rule forbids). Definitely worth it: Phase 1 alone is a **free-tier product** — `cosmos1…`, `osmo1…`, `celestia1…`, `dydx1…` addresses derive from the key with zero chain writes, four chains for one ~400-LOC lift and one table.

**Ship gate for v2:** Phase 1 + Phase 2 + `MsgDelegate`/`MsgUndelegate`/`MsgWithdrawDelegatorReward`/`MsgTransfer` together. Address-derivation-without-signing is a legitimate standalone free-tier release; signing-with-only-`MsgSend` is not.

---

## 5. Registry keys

Contract rules confirmed at `C:/Users/travi/b-domain/contract/bdomain.cpp`:
- **:275-276** — `addchainkey` requires only *a colon somewhere*: `check(chain_key.find(':') != std::string::npos, "chain_key must be namespaced (CAIP-2 or slip44:N) — bare aliases are not registry values")`. Plus non-empty, `size() <= 64` (:269-270), `label` ≤ 32 chars (:271). **No namespace whitelist — correctness is discipline, not enforcement.**
- **:279 / :283-289** — id is `hash_name(chain_key)`; registering the same string twice takes the `modify` branch and **silently overwrites** label and `requires_memo`. That is the collision hazard.
- **:195-200** — `setchain` refuses any `chain_key` not already in `chainkeys`. **:205-208** — a true `requires_memo` makes `setchain` reject an empty `memo_tag`.

Live registry today: 11 rows (`eip155:1`, `eip155:42161`, `eip155:7200`, `slip44:0`, `slip44:133`, `slip44:144`, `slip44:145`, `slip44:148`, `slip44:194`, `slip44:501`, `slip44:1018`), **all with `requires_memo: 0`.**

### Ready for `addchainkey`

| Chain | `chain_key` (exact) | `label` | `requires_memo` | Notes |
|---|---|---|---|---|
| BitShares | `slip44:308` | `BitShares` | `0` | Official SLIP-44 308. **No CAIP-2 namespace exists** — `slip44:308` is the only citable key. Collision-free. |
| Hive | `slip44:3054` | `Hive` | `0` | Official SLIP-44 3054 (Hive's own, **not** Steem's). CAIP-2 alternative `hive:beeab0de000000000000000000000000` exists but is **`status: Draft`** (created 2026-02-25, author @feruzm, PR #174) — citable, not finalized. Recommend the SLIP-44 form. |
| Steem | `slip44:135` | `Steem` | `0` | Official SLIP-44 135. **No CAIP-2 namespace.** Collision-free. See §7 before registering. |
| Cosmos Hub | `cosmos:cosmoshub-4` | `Cosmos Hub` | `0` | **Must be CAIP-2** — see flag 1. |
| Osmosis | `cosmos:osmosis-1` | `Osmosis` | `0` | **Must be CAIP-2.** SLIP-44 lists `10000118` — dead registration, wallets derive at 118. |
| Celestia | `cosmos:celestia` | `Celestia` | `0` | **Must be CAIP-2.** ⚠️ **Not in SLIP-0044 at all** — CAIP-2 is the only citable key, not merely the preferred one. |
| dYdX | `cosmos:dydx-mainnet-1` | `dYdX` | `0` | **Must be CAIP-2.** SLIP-44 lists `22000118` — dead registration; chain-registry says 118. |
| Injective (Cosmos side) | `cosmos:injective-1` | `Injective` | `0` | bech32 `inj1…`. Derives at **60**, not 118 and not the registry's `22000119`. |
| Injective (EVM side) | `eip155:1776` | `Injective EVM` | `0` | ⚠️ **Optional and lower-confidence.** Same network, hex `0x…` addresses. Chain id `1776` is from **chainlist (secondary)**, not `ethereum-lists/chains`, and a separate pass surfaced **888**. **Do not register until pinned from a primary source.** Must never be labeled interchangeably with the Cosmos side. |

All keys are ≤ 64 chars; all labels ≤ 32.

### Flags

1. **`slip44:118` is a hard collision — never register it.** Cosmos Hub, Osmosis, dYdX, Celestia and ~90% of Cosmos SDK chains all derive from 118. Because `id = hash_name(chain_key)`, a second `slip44:118` **relabels the first row instead of erroring.** All Cosmos entries must use `cosmos:` CAIP-2 keys, which are unique per chain.
2. **`slip44:10000118` and `slip44:22000119` exist but are traps.** Both are real SLIP-0044 entries (verified, not guessed) and both are registry-only — no wallet derives from them. Registering either would be citable and would mislead any client that tries to derive from it.
3. **Celestia has no SLIP-44 entry at all.** It is the one chain in this table *forced* onto CAIP-2 by absence rather than by collision.
4. **No CAIP-2 namespace exists for BitShares or Steem.** The ChainAgnostic repo contains no `bitshares`, `steem`, or `graphene` directory. Their SLIP-44 keys are the only option — fine, since both are collision-free.
5. **`requires_memo: 0` for all of them, and reconcile the existing rows first.** None of these chains protocol-level requires a memo to a self-custody destination: BitShares/Hive/Steem route to named accounts, and the Cosmos `memo` field is optional. Memos are mandatory only for pooled custodial deposits. Since `setchain` treats `requires_memo` as a hard gate (:205), setting it true would **block legitimate self-custody entries.** Note the live table already sets `requires_memo: 0` for XRP (`slip44:144`) and Stellar (`slip44:148`) — the two chains the code comment at :202 explicitly names as the destination-tag class. **The comment and the data already disagree; fix that before adding nine more rows on top of the ambiguity.**
6. **Adjacent, out of scope:** an `antelope` CAIP-2 namespace exists while the live registry uses `slip44:194` for Vaulta/EOS. Worth a decision, not worth a migration.

---

## 6. Effort ranking — cheapest to hardest, for THIS fork

| # | Chain / family | Firmware cost | Why it sits here |
|---|---|---|---|
| 1 | **Injective (EIP-712)** | **0 LOC** | Already signs. Fixture named `injective_testcase`, T3W1 Eckhart goldens recorded, strings filled, path `m/44'/60'/0'/0/x` matches, no capability gate. All remaining work is host-side: wrap, normalize `v`, bech32-encode, attach `ExtensionOptionsWeb3Tx`. |
| 2 | **Registry rows (all 8-9)** | 0 LOC firmware | Contract calls only. Governed by §5, not by firmware. Instant free-tier surface for anything already derivable. |
| 3 | **Cosmos Hub + Osmosis + Celestia + dYdX — Phase 1 (addresses only)** | ~400 LOC + proto + trezorlib | `sha256_ripemd160` and `bech32_encode` already in the tree; one HRP table serves all four; secp256k1 + low-S already correct. Pure free-tier: derives, never writes. |
| 4 | **Cosmos Phase 2 (DIRECT sign, `MsgSend` + 4 staking/IBC msgs)** | ~700-900 LOC + ~4× in bindings/tests | Two complete third-party PRs to fork (#6720 mature/closed-for-flash, #5440 with a proven mainnet broadcast). No new C crypto. Real work is the hand-rolled `Any` protobuf reader and the allowlist. eos/tezos band — a lift already done once here. |
| 5 | **Hive + Steem (one app)** | ~187-line envelope reused + ~600 LOC op layer + ~40 strings | Crypto free (`eos_is_canonical` **is** the Graphene predicate). Display is honest — names and legacy assets are self-describing in the signed bytes. Costs: SLIP-48 keychain, a hard-coded op whitelist with **no catch-all**, Hive's HF26 pack boolean, the sorted-map authority landmine, and the `STM`-prefix ambiguity (Hive and Steem show the same `STM7…`; only chain_id distinguishes them). Paid-tier only — accounts must be registered on-chain. |
| 6 | **BitShares** | Same envelope + its own ~500-600 LOC op front-end | Everything in row 5, **plus** a display layer that is structurally unverifiable: `ObjectId` serializes the instance number alone, assets carry no ticker or precision. No `eos_name_to_string` analogue can exist. 78 op tags, none aligning with Hive's. Paid-tier only. |
| 7 | **Zano** *(in flight, calibration ceiling)* | New **C** crypto — `zano_generate_clsag_ggx` — plus a new app directory | The only item on this list requiring new curve math. 3 critical bugs were found behind a clean compile; conformance vectors still owed. Everything above is cheaper than what is already underway. |

Calibration reading: **rows 1-4 all sit below the Zano work already committed.** Rows 5-6 sit at or above it in app-layer cost while sitting below it in crypto cost — and both land exclusively on the paid tier.

---

## 7. What is NOT worth building

**Steem.** Chain_id is 32 zero bytes; Hive is the live fork of it and carries the users. Registering `slip44:135` costs one contract call and is fine. Building op support is not — you would be paying most of the Hive app cost a second time for a chain whose only distinguishing features are SMT ops nobody uses, while inheriting the `STM`-prefix ambiguity that makes the two chains indistinguishable on the confirm screen. **Register it, do not implement it.**

**Full BitShares op coverage.** 78 tags with no catch-all means every op you skip is a hard mid-stream refusal, and every op you implement renders as numeric ids the device cannot verify. Chasing coverage here converges on 78 hand-written decoders that all produce unverifiable screens. **If BitShares ships, it ships as transfer-only with an explicit "device cannot verify recipient name" warning, or it does not ship.**

**A single parameterized Graphene app.** Refuted with high confidence (§1). It saves the 187-line envelope and buys a class of bug that does not otherwise exist: a chain_id/table mismatch parses a Hive tag-2 `transfer` as a BitShares `limit_order_cancel`, shows a cancel-order screen, and emits a valid signature over a real transfer. **Two apps, one shared envelope module. Non-negotiable.**

**A generic "unknown operation" path for anything Graphene.** Structurally impossible — `Static_variant` emits no length, so the device cannot skip an op it does not understand and therefore cannot even finish the digest. Do not budget for it, and do not let anyone promise it.

**Flipping `MICROPY_PY_UJSON` for Cosmos Amino-JSON.** Costs flash and adds an untrusted-input C parser to the attack surface, in exchange for a signing mode DIRECT already covers. Both upstream PRs chose DIRECT for exactly this reason.

**SIGN_MODE_TEXTUAL — for now.** Genuinely the lowest-firmware-complexity option and designed for hardware screens, but ecosystem adoption is thin. Revisit when a chain the fork supports actually requires it.

**A native Injective app, or an `inj1…` display branch.** The device already signs correctly; adding an Injective network definition plus a bech32 branch in `address_from_bytes` buys a cosmetically better address string on a path that is otherwise complete. Real polish, but it competes with Cosmos Phase 1, which is worth strictly more. Revisit after v2. *(The one exception worth doing inline: convert the bare `ValueError` at `sign_typed_data.py:473` to a `DataError` so nested-array refusals reach the host cleanly. That is a one-line correctness fix, not a feature.)*

**Osmosis / Celestia / dYdX as separate apps.** They are one tuple each in the Cosmos chain table. Anyone proposing separate apps has misread the architecture.

**Free-tier Graphene.** Not a judgment call — an architectural impossibility. A Graphene identity is a registered on-chain name, not a derived address. BTS/HIVE/STEEM cannot participate in the billions-of-derived-addresses tier at any engineering cost. If Graphene ships, it ships as a paid-tier-only line item, and the roadmap should say so out loud rather than discovering it during integration.
