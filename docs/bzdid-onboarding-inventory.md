<!-- Generated 2026-08-04 by a 7-agent read-only inventory of the workspace.
     Every claim carries a file:line. Re-run before trusting it after major changes. -->

# bzDiD onboarding — what exists, what does not

**Why this document exists.** The founder's instruction was *"what we are not doing is
version after version of half built software."* The way that happens is starting to build
before knowing what the tree already does. This is the measurement taken first.

**The one-line finding:** *nothing in this workspace can sign a transaction on any chain.*
Every action in the requirement is a write. The read side and the pure logic are real and
substantial; the write side is absent everywhere.

---

# bzDiD Onboarding & Auto-Provisioning — Build-vs-Reuse Ledger

Tree: `C:\Users\travi\beehive-nature` (35 crates). All paths absolute-relative to `crates/`.

**Correction to the requirement, up front.** The founder's list — `RAM/CPU/NET/ANT/AR/HIVE/Zano/xbtc/ARB1ETH` — is not nine addresses. It is **five or six key namespaces plus resources and assets held inside them**:

| Founder token | What it actually is |
|---|---|
| RAM / CPU / NET | Not accounts. Staked resources **inside one Antelope account** (`buyrambytes`, `powerup`/`delegatebw`). One address, three purchases. |
| ANT | Autonomi network token — pays for uploads via the `ant` CLI's own wallet. |
| AR | Arweave — one RSA-4096 JWK; address = b64url(sha256(modulus)). |
| HIVE | Hive account name; creation is paid by an existing account and the **creator sets the keys**. |
| Zano | One `{S, V}` keypair → one `Zx…` address. |
| xbtc | An **asset on an EVM chain**, not a chain. Zero occurrences repo-wide. Not an address. |
| ARB1ETH | Arbitrum One — an EVM address, same secp256k1 key as any other EVM chain. |

So the provisioning target is: **1 Antelope account, 1 EVM keypair (reused across ARB1/exSat/Vaulta-EVM), 1 Zano keypair, 1 Arweave JWK, 1 Hive account, 1 Autonomi wallet reference** — then resource purchases and asset balances *within* those. Any plan that models nine parallel "accounts" is already the wrong shape.

---

## 1. Reuse ledger

Ruthless rule applied: a crate counts only if the named function is REAL, reachable in a non-test build, and does what the row says. Scaffold = NOTHING EXISTS.

### Identity ladder

| Capability needed | Crate that provides it | Exact call | Notes |
|---|---|---|---|
| Refuse enrolment without written-code recovery floor | `onboarding` | `Enrolment::complete(Authenticator, RootIdentity, Vec<RecoveryPath>, Vec<PersonaBinding>) -> Result<Enrolment, EnrolError>` (`onboarding/src/lib.rs:259`) | REAL, tested |
| Private-by-default disclosure | `onboarding` | `persona::DisclosureMode::default()` → `Selective` (`:127-131`) | REAL |
| Refuse a custodial persona bound without custody disclosure | `onboarding` | `persona::PersonaBinding::bind(PersonaRef, DisclosureMode, InformedConsent) -> Result<_, BindingError>` (`:194`) | REAL |
| Unforgeable "user was shown their grade" witness | `onboarding` | `disclose_grade(ViewGrade) -> (GradeStatus, GradeDisclosure)` (`:365`); `gate_on_settlement(ViewGrade, &GradeDisclosure)` (`:399`) | REAL; `GradeDisclosure` has a private field + no `Deserialize` |
| **Generate the root keypair** | — | **NOTHING EXISTS** | `RootIdentity` is `{ did: Did, anchored: bool }` (`:62-67`). There is no key material, no seed, no RNG anywhere in the crate. "Generated locally" is doc prose (`:10-11`), not a type. |
| **Anchor `did:autonomi`** | — | **NOTHING EXISTS** | Repo-wide grep for `did:autonomi` returns **only test string literals** (`adapter-lti`, `b-token`). `anchored: bool` is caller-asserted with nothing behind it. |
| Resolve `did:plc` / `did:web` → PDS + signing key | `atmirror` | `did::HttpDirectory::new(plc_base)` + `DidDirectory::did_document(&self, did)`; `did::identity_from_document(did: &str, doc: &Json) -> Result<AccountIdentity, DidError>` (`atmirror/src/did.rs:107`) | REAL, live HTTPS via ureq+rustls |
| Bidirectional-binding witness feeding `SettlementBinding` | `sense-atproto` | `IndependentSocialView::witness(&self, at_uri: &str, binding: Option<&DidBinding>) -> Option<SocialWitness>` (`sense-atproto/src/lib.rs:381`) | REAL pure logic; you supply the `SocialSource` impls |
| Canonical principal type | `type-bindings` | `Did(pub String)`, `Did::is_root()` (`type-bindings/src/lib.rs`) | REAL. Do not fork (K-D1). |

### Address derivation & encoding

| Capability needed | Crate | Exact call | Notes |
|---|---|---|---|
| Validate an Antelope account name against real chain rules | `chain-eos` | `chain_eos::name_to_u64(s: &str) -> Option<u64>` (`chain-eos/src/lib.rs:475`) | REAL, anchored to an external vector (`:950`). Enforces uppercase/`6`/13-char/`.1-5a-j` rules. |
| Zano `v = keccak256(s) mod l` (dependent key) | `chain-zano` | `keys.rs:70-78` / `view.rs:51-58` | REAL, proven against a stock `simplewallet v2.2.1.501` export (`testvec.rs:20-25`) |
| Zano `S = s·G`, `V = v·G` | `chain-zano` | `keys.rs:85-98`, `view.rs:66-85` | REAL, non-circularly proven via independent address decode (`testvec.rs:33-51`) |
| Zano view-only account (no spend secret in RAM) | `chain-zano` | `view::view_account_from_view_secret_hex(&str)` (`view.rs:89`) | REAL but **no test calls it** |
| **Seed → Zano spend secret (SLIP-0010)** | — | **NOTHING EXISTS** | `chain_zano::slip0010::{master_node, derive_hardened}` (`slip0010.rs:57-86`) is never checked against SLIP-0010's *published* Ed25519 vectors. The only end-to-end test is `#[ignore]` + `todo!()` (`slip0010.rs:169-178`). Its three live tests are tautologies. |
| **Encode a `Zx…` address string** | — | **NOTHING EXISTS** | The only CN-base58 code in the tree is a **decoder**, and it is `#[cfg(test)] pub(crate) mod testvec` (`chain-zano/src/lib.rs:34`). Cannot produce an address for a user, cannot validate one they paste. |
| **Derive an EVM address from a key** | — | **NOTHING EXISTS** | `bsigner::device::ethereum_address` (`bsigner/src/device.rs:124-137`) *reads* one off a Trezor, and returns `Failure_InvalidProtocol` on the founder's T3W1 (`device.rs:23-49`). No secp256k1 in the tree. |
| Keccak-256 (needed for EVM address = last 20 bytes) | `chain-exsat-evm` | `abi::keccak256` (`chain-exsat-evm/src/abi.rs:111-115`) | REAL, KAT-pinned (`:292-295`) |
| Arweave wallet load / generate + address | `atmirror` | `arweave::ArweaveRail::from_jwk_file(path, bundler, gateways)` (`arweave.rs:51`); `ArweaveRail::ephemeral(bundler, gateways)` (`:83`) | REAL, RSA-4096, client-side only. **`ephemeral()` discards the key** — an ephemeral address is not a user identity. |
| **Hive account name / key / address** | — | **NOTHING EXISTS** | `atmirror::receipt::HiveAnchor` (`receipt.rs:65`) is a serde struct. Every construction site sets `hive: None` (`mirror.rs:325`, `receipt.rs:138,178`). Zero Hive code. |

### Write path (creating and funding accounts)

| Capability needed | Crate | Exact call | Notes |
|---|---|---|---|
| **Encode an Antelope action** (`newaccount`, `buyrambytes`, `powerup`, `transfer`) | — | **NOTHING EXISTS** | `chain-eos` has `Abi::decode_action` (`abi.rs:150`) and **no encoder**. `Abi` exposes exactly `from_json` and `decode_action` (`abi.rs:124-128`). Worse: it *refuses to parse* `public_key`/`signature` types (`abi.rs:249-251`) — it cannot even read a key out of an action. |
| **Sign a transaction on any chain** | — | **NOTHING EXISTS. Zero chains.** | `bsigner::channel::RefusingSigner::sign` is `Err(SigningRefused)` (`channel.rs:109-111`). `dro_signer::MockSigner` emits `format!("MOCK-UNSIGNED-PLACEHOLDER:{}", …)` (`dro-signer/src/lib.rs:437-451`). `chain-eos` *skips* 65 signature bytes (`lib.rs:335-343`). No `secp256k1`, no `k256::ecdsa` sign, no `ed25519` sign in any chain crate. |
| **`push_transaction` / any chain RPC write** | — | **NOTHING EXISTS** | `chain-eos/Cargo.toml` has no HTTP dep at all; `/v1/chain` untouched. `chain-exsat-evm` has no `LogSource` impl outside tests (`indexer.rs:368-379`). |
| Upload bytes to Arweave (real, paid, live) | `atmirror` | `<ArweaveRail as rail::Rail>::put(&mut self, bytes, tags) -> Result<String, RailError>` (`arweave.rs:192`) | REAL: ANS-104 DataItem, `deep_hash` (`:308`), id computed locally and cross-checked against the bundler (`AddressMismatch`) |
| Upload bytes to Autonomi | `atmirror` | `autonomi::AntCli::new(bin)` + `Rail::put` (`autonomi.rs:105`) | REAL subprocess against `ant`. Output schema **UNVERIFIED** against a live funded run; parser is fail-closed (`extract_address`, `:75`). |
| Confirm someone else's `newaccount` landed on chain | `chain-eos` | `stream_ship(url, start_block, on_event)` (`lib.rs:586`) + `extract_actions(block) -> Result<Vec<ExtractedAction>, _>` (`lib.rs:398`) + `Abi::decode_action` | REAL, but **`ws://` only** — `Cargo.toml:13-15` refuses TLS, so no public `wss://` SHIP endpoint is reachable. Localhost/LAN nodeos only. |
| Idempotent "already provisioned" state | `atmirror` | `state::State::load(path, did)` / `State::save(path)` (`state.rs:52,77`) | REAL per-DID reuse ledger. Copy this posture, not `chain-eos`'s untested watermark (`chain-eos/src/main.rs:30-36,54` — errors discarded, zero tests). |

### Money

| Capability needed | Crate | Exact call | Notes |
|---|---|---|---|
| Fiat → asset price | — | **NOTHING EXISTS** | `price-feed` is a **USDA hemp-seed $/lb series** (`price-feed/src/lib.rs:85-93`). No type in the crate can hold "1 ASSET = X USD". `PriceReportSource` (`:242-245`) has no production impl, so `read_price` can never return `Measured` outside tests. |
| Per-asset decimals / atomic-unit scale | — | **NOTHING EXISTS** | Repo-wide grep for `decimals\|smallest_unit\|atomic_units\|wei\|satoshi` = zero. `b-token`'s `pub type Amount = u128` is "atomic units" with **no scale factor stated anywhere** (`b-token/src/lib.rs:33`). |
| Split one amount across N targets with conservation | — | **NOTHING EXISTS for N.** Closest prior art is 2-way. | `dro_signer::settlement_intent_for_split` (`dro-signer/src/lib.rs:161-187`) enforces `buyer.checked_add(seller)? == escrow.amount` and refuses rather than normalising; the odd-atomic-unit rule is at `:127-138`. Generalise this; do not invent. |
| `b` balance ledger keyed by root DID | `b-token` | `BLedger::{balance_of, spendable_of, reserve, unreserve, burn, transfer, mint}` (`b-token/src/lib.rs:93-209`) | REAL, four enforced invariants. But `mint`'s gate is `ProofVerifier::verify`, whose only impl accepts **any non-empty string** (`:294-298`). |
| Currency conversion / `b → $` | — | **NOTHING EXISTS** | `denomination` owns the concept and contains no arithmetic: `rate_b_to_currency` is copied verbatim at `denomination/src/lib.rs:193` and never multiplied by anything. `Money.amount` is `f64` (`:39-42`). |
| Observe a Zano balance | `zano-watcher` | `parse_balances(&Value, asset_id) -> Result<…>` (`zano-watcher/src/lib.rs:156`) | Parser REAL + tested. `observe_balances` (the only networked fn) has **zero test coverage** and its RPC body sends **no params** (`:93`) — it returns whatever wallet the endpoint serves, ignoring `multisig_address` entirely. |
| Index EVM logs / balances | `chain-exsat-evm` | `Indexer::observe_block`, `drain_confirmed`, `drive` (`indexer.rs:558,748,812`) | Machine REAL and well-tested — but every row of the signature table is `"PLACEHOLDER_…"` (`signatures.rs:107-168`), so `Indexer::new` **fails to construct** against production config (`indexer.rs:910-919`). |

### Authority

| Capability needed | Crate | Exact call | Notes |
|---|---|---|---|
| Ed25519 sign/verify a scoped grant | `capability` | `Ed25519Verifier::new(keys: BTreeMap<Did, VerifyingKey>, now: i64)` (`capability/src/lib.rs:907`), `Delegation::allows` (`:730`), `allows_at_tier` (`:751`) | REAL, `verify_strict`, adversarially tested (`:1840-1942`). **But**: nothing in the workspace builds that key map; no revocation; **no attenuation / delegation chaining** (grep `attenuat|delegation_chain` = zero). |
| Amount/budget/rate limits on a grant | — | **NOTHING EXISTS** | `Capability` is exactly two strings (`capability/src/lib.rs:46-49`). "May spend" is expressible; "how much" is not. |
| Authorize a fund-moving act from ≥2 independent Settlement-grade sources | `treasury-t0` | `SettlementAuthorization::from_evidence(&[Evidence]) -> Result<Self, T0Refusal>` (`treasury-t0/src/lib.rs:118`) | REAL, unforgeable (private fields, no `Deserialize`) |
| Classify device evidence to E5/T5 | — | **NOTHING EXISTS** | `verify_trezor::TrezorVerifier::chains_to` is `fn(…) -> Option<&[u8]> { None }` (`verify-trezor/src/lib.rs:77-79`). E5 is statically unreachable. Roots are `b"PLACEHOLDER-…-UNVERIFIED"`. |

---

## 2. The duplication traps

Places a naive onboarding implementation will rewrite something that already exists — or, worse, reach for the *wrong* existing thing.

1. **Antelope name validation.** Do not write a regex. `chain_eos::name_to_u64` (`chain-eos/src/lib.rs:475`) already encodes the full rule set including the 13th-character `.1-5a-j` restriction, and it is pinned to an external vector (`:950`). A hand-rolled validator will pass `"userA"` or a 14-char name.

2. **Keccak-256 for the EVM address.** `chain_exsat_evm::abi::keccak256` (`abi.rs:111-115`) exists and is anchored to published KATs (`:292-327`). Adding a second `sha3` wrapper in a new crate gives you two implementations, one untested.

3. **Zano `dependent_key`.** Already implemented **twice inside `chain-zano`** — `keys.rs:70-78` and `view.rs:51-58`. A third copy in a provisioning crate makes three. Consolidate to one before adding a caller.

4. **CN-base58.** The trap is the opposite of duplication: there *is* a working, self-validating decoder with a checksum assert (`chain-zano/src/testvec.rs:55-88`), but it is `#[cfg(test)]`-gated (`chain-zano/src/lib.rs:34`). Writing a fresh encoder without promoting that decoder and round-tripping against it forfeits the only Zano address ground truth in the tree.

5. **Arweave: `adapter-arweave` is the wrong crate.** It is a workspace orphan whose only "client" is `MockArweaveClient`, a `HashMap` (`adapter-arweave/src/lib.rs:174-207`), and its `bundle`/`merkle_root` (`:99-165`) is a **bespoke bNature hash scheme, not ANS-104** — nothing it outputs is uploadable. The real Arweave code is `atmirror::arweave` (`deep_hash` at `:308`, `avro_tags` at `:271`, golden-byte tests at `:343-370`). Reaching for the crate whose name matches is the trap.

6. **The N-way split.** `dro_signer::settlement_intent_for_split` (`dro-signer/src/lib.rs:161-187`) already solves "divide an amount without losing or inventing a unit": conservation via `checked_add`, refusal instead of normalisation, odd atomic unit assigned deterministically (`:127-138`), tested on an odd amount (`:487, 626-642`). A deposit splitter should generalise that rule to N. Writing `amount as f64 * pct` reintroduces exactly the defect `denomination` already has (`Money.amount: f64`, `denomination/src/lib.rs:39-42`).

7. **The consent/disclosure witness idiom.** Two crates already implement "a protection the restrained party cannot conjure": `onboarding::GradeDisclosure` (`:337-347`, private field, no `Deserialize`, `compile_fail` doctest at `:331-336`) and `treasury_t0::SettlementAuthorization` (`:109-142`). A publication gate taking `consented: bool` is the `thread_age` defect the crate docs explicitly name (`onboarding/src/lib.rs:328`). Reuse the shape.

8. **Ed25519.** `capability::Ed25519Verifier` (`capability/src/lib.rs:894-975`) already wraps `verify_strict` with a canonical signing payload and back-compat invariant (`:716-722`). Pulling a second ed25519 stack into a provisioning crate splits the trust surface.

9. **Idempotency.** `atmirror::state::State` (`state.rs:43-83`) is a real, per-DID, load/save reuse ledger with an explicit probe-then-reuse flow (`mirror.rs:79-108`). Provisioning needs exactly that shape. The alternative in-tree pattern — `chain-eos/src/main.rs:54`, `let _ = std::fs::write(&wm, …)` with the error discarded and zero tests — is what a naive implementation will imitate because it is shorter.

10. **Confirmation depth / reorg.** `chain_exsat_evm::reorg::ChainTracker::{classify, observe, fork_point_for, rollback_above}` (`reorg.rs:161-259`) is a real, 11-test state machine. "Wait 12 blocks then call it done" in a provisioning loop duplicates it badly. Caveat: it assumes strictly contiguous ascending block numbers and refuses gaps (`:202-206`) — sound for L1, **questionable for Arbitrum**, and it has no `removed`-flag handling (refuses such logs outright at `indexer.rs:566-571`).

11. **`Did`.** `type_bindings::Did` is the canonical principal and is deliberately MIT/Apache-licensed for the SDK edge. `mastery-ledger` and `adapter-lti` both pull `capability` *solely* to avoid forking it (see their `Cargo.toml` comments citing K-D1). Do not declare a new `AccountOwner(String)`.

12. **Hex.** `atmirror::rail::hex_lower` (`rail.rs`, shipped path) already exists; so does `chain_zano::view::decode_hex_32`. That is already two.

---

## 3. What must actually be written

Nine modules. This is the floor for the stated requirement, not a wish list. Modules 5–7 are each blocked on a signer that does not exist anywhere in the tree.

1. **`provisioning::accounts`** — root-keyed `RootAccounts { root: Did, accounts: Vec<ProvisionedAccount> }` and `AccountKind`; addresses and custody facts only, **no amount field anywhere**, enforced by a source-scan negative control in the style of `onboarding`'s `containment` test (`onboarding/src/lib.rs:617-638`).
2. **`provisioning::derive`** — one root seed → per-namespace keypairs via SLIP-0010 (ed25519) and BIP-32/BIP-44 (secp256k1), each pinned to **published** vectors before any address is derived from it.
3. **`provisioning::address`** — per-namespace encode + validate: Zano CN-base58 encoder (promote and round-trip `chain-zano`'s test-gated decoder), EVM EIP-55 checksum over `chain_exsat_evm::abi::keccak256`, Arweave `b64url(sha256(owner))`, Antelope via `chain_eos::name_to_u64`, Hive account-name rules.
4. **`provisioning::plan`** — one deposit (u128 atomic units) → an integer-exact allocation across `AccountKind`s; conservation invariant `sum(parts) == deposit` and an explicit dust rule, generalising `dro_signer::settlement_intent_for_split`.
5. **`chain_eos::abi::encode_action` + transaction packing** — the mirror of the existing decoder, plus `public_key`/`signature` type support that `abi.rs:249-251` currently refuses outright.
6. **`provisioning::signer`** — a real signing seam with at least one working implementation (secp256k1 for Antelope/EVM, ed25519 for Hive/Zano-adjacent), since every existing `sign` in the tree returns a placeholder or an error.
7. **`provisioning::execute`** — a `Provisioner` trait per namespace and the write RPCs behind it: Antelope `newaccount`+`buyrambytes`+`powerup`, Hive `account_create`, funding transfers, plus a TLS-capable HTTP/`wss://` transport (`chain-eos` cannot reach any public endpoint today).
8. **`provisioning::publish`** — the per-address publication gate: one explicit act per address, its own consent digest, irreversible, with the cross-chain **join disclosure** invariant of §5 below.
9. **`provisioning::observe`** — join `RootAccounts` to per-chain balance views at read time (`zano_watcher::parse_balances`, `chain_exsat_evm::Indexer`, `chain_eos::extract_actions`), returning a derived R-004 view that is never persisted onto an identity type.

---

## 4. The §2a collision

The founder wants a user's addresses attached to their bzDiD. RELAY_22 §2a says no type in the persona model carries a balance, a mint path, or a PoUL signal, and everything economic keys off the root. These are **not** in conflict, because the requirement conflates three distinct things that must live in three places.

### Where each thing lives

**Addresses live on the root, in a new root-keyed type — not on a persona.**

```
provisioning::RootAccounts { root: Did, accounts: Vec<ProvisionedAccount> }
provisioning::ProvisionedAccount {
    kind: AccountKind,          // Antelope | Evm{chain_id} | Zano | Arweave | Hive | Autonomi
    address: String,
    custody: Custody,           // UserHoldsKey | PlatformHoldsKey | ExternalProcessHoldsKey
    provisioned_at: i64,
    published: Option<Publication>,   // None until an explicit, per-address opt-in
}
```

`RootAccounts` keys off `Did` — the same principal `b_token::BLedger` and `treasury_t0::ThreadStanding::from_ledger` key off. That satisfies "everything economic keys off the ROOT" without touching `persona`.

**Balances live nowhere persistent.** They are derived views (R-004), computed at read time by joining `RootAccounts` addresses to the chain adapters, and returned as a transient view type — the exact posture `adapter-autonomi` already documents for node telemetry ("never becomes a `CanonicalEvent` and never rides the bus", `adapter-autonomi/src/lib.rs:9-16`). Enforce it with a source-scan test asserting no field named `balance`/`amount`/`b`/`minted` exists in `provisioning::accounts`, with a positive-control decoy — the idiom already proven at `onboarding/src/lib.rs:617-638`.

The one exception is `b` itself, which already lives correctly in `b_token::BLedger` keyed by root `Did`. `provisioning` must not mirror it.

**The link type is `ProvisionedAccount`, and it is one-directional.** A persona never points at an account; an account never points at a persona. Address→root is the only edge, and it is private.

### Does `PersonaRef` need extending?

**Only if the user chooses to *present* an address as a persona.** Auto-provisioning must **not** create persona bindings. A `PersonaBinding` requires an `InformedConsent` with a `shown_text_digest` (`onboarding/src/lib.rs:157-165`); six bindings minted automatically at signup would all carry a consent digest for text the user never saw. That is a forged consent, and it is exactly what `PersonaBinding::bind` exists to prevent.

When a user *does* opt in, these variants are needed. `PersonaRef` is `#[non_exhaustive]` (`:79`) and `is_pds_custodial` is an explicit match (`:101-106`), so additions are legal and each must declare custody:

| New variant | `is_pds_custodial()` must return |
|---|---|
| `Antelope { account: String, user_holds_owner_key: bool }` | `!user_holds_owner_key` |
| `Hive { account: String, user_holds_owner_key: bool }` | `!user_holds_owner_key` |
| `Autonomi(String)` | `true` — the `ant` binary holds the wallet; `atmirror/src/autonomi.rs:16` states "this tool holds no key". Custody sits with whoever configured `ant`. |
| `EvmScoped { chain_id: u64, address: String }` | `false` — but see the note below |
| **No `Arweave` variant** | — a `ArweaveRail::ephemeral()` key is discarded in-process (`arweave.rs:83-90`). An ephemeral address is not an identity anyone controls; it must stay in `RootAccounts` and never become presentable. |

**Two sharp consequences.**

*First:* an Antelope or Hive account **created by BNR** is one where BNR set the `owner` key. `is_pds_custodial`'s own doc defines the predicate as "an identity a third party can seize?" (`onboarding/src/lib.rs:90`). A platform-provisioned Antelope account is precisely that. So `user_holds_owner_key: false` must return `true`, and `PersonaBinding::bind` will then **refuse** the binding unless the consent text disclosed it. That is correct behaviour, and it is the single most important structural outcome of this whole exercise: **auto-provisioning custodial accounts and calling them the user's is the failure mode `bind` was written to catch.**

*Second:* the existing `Evm(String)` (`:84`) carries **no chain id**. An Arbitrum address and an exSat address are the same 20 bytes and are currently indistinguishable in the persona model. For a product whose requirement names `ARB1ETH` and `xbtc` separately, that is already a defect. Add `EvmScoped` rather than mutating `Evm` (version by addition, never mutation).

*Recommended refinement:* the predicate's name has drifted from its meaning — three of the five new variants are custodial for reasons having nothing to do with a PDS. Introduce `is_third_party_custodial(&self) -> bool` as the real predicate, keep `is_pds_custodial` as a thin delegating method so no existing caller breaks, and require every variant to carry its custody discriminant explicitly rather than inferring it from the variant tag. The "explicit match, not a wildcard" property (`:99-100`) is preserved.

---

## 5. The publication problem

**Stated plainly: "a new user automatically gets all addresses published" is incompatible with the crate's own law. It is not a tension to be balanced — it directly contradicts three enforced properties.**

1. `DisclosureMode::default()` is `Selective` (`onboarding/src/lib.rs:127-131`), and `Public` is documented as "explicit opt-in only — never the default" (`:119-120`). An automatic path that produces `Public` bindings has no way to be an opt-in.
2. `InformedConsent` requires `shown_text_digest` — the digest of the exact text shown (`:157-165`). Auto-publication has no shown text. Any digest it supplies is a fabrication of the one artifact the type exists to make reconstructible.
3. Public is irreversible: "once a binding is public, correlation has already happened; switching to a private mode afterwards restores nothing" (`:110-115`).

**And bulk publication is strictly worse than the sum of its parts.** Publishing one address exposes one chain. Publishing six under one root publishes the **join** — it hands any observer a correlation key linking a Zano address (a privacy chain, whose entire value proposition is that its outputs are not linkable) to an EVM address to an Arweave address to a Hive account name. The privacy loss is not additive; it is the graph. §2a's disclosure obligation requires the shown text to state "the correlation consequence of the chosen `DisclosureMode` **in that mode's own terms**" (`:146-148`). One digest covering six chains cannot state six different consequences. A blanket consent is a fake consent.

### The compliant flow

1. **Provision all, publish none.** `Enrolment::complete` runs unchanged. `RootAccounts` is populated with every address the user can have. `published: None` on every entry. This satisfies the founder's actual intent — the user *has* everything from moment one — with zero correlation.
2. **Publication is a separate, later, per-address act.** One address, one screen, one consent digest, one irreversible acknowledgement.
3. **The join disclosure — a new invariant not in the crate today.** `publish()` must take the set of *already-published* addresses for that root and refuse without a consent digest that names the specific linkage being created. Publishing the second address is a materially different act from publishing the first, and the current model has no way to express that.
4. **Gate it with an unforgeable witness, not a bool.** Mint a `PublicationDisclosure` only from the function that renders the warning — private field, no `Deserialize`, `compile_fail` doctest — exactly as `GradeDisclosure` (`:337-347`) and `SettlementAuthorization` (`treasury-t0/src/lib.rs:109-142`) already do. The "published without disclosing" case should not compile.
5. **Custodial accounts carry a second obligation.** If `custody != UserHoldsKey`, the shown text must also disclose that the published address is one a third party can seize — the §5a rule, applied at publication as well as at binding.
6. **A default `Pairwise` path for anything that must be shown to a relying party.** `DisclosureMode::Pairwise` (`:123-124`) already exists in the enum and has no implementation. It is the correct answer for "prove to this counterparty that I control an address" without publishing to the world.

There is no `.b` registry in this tree. Repo-wide, no crate implements a public address registry; `adapter-autonomi` is node telemetry and `console-api` has no registry surface. So the publication gate is being designed **before** the thing it gates exists — which is the cheapest possible moment, and precisely the "not version after version of half built software" discipline.

---

## 6. Blocking unknowns

Each is stated with what would settle it.

1. **Who pays for account creation, and with which key?**
   Antelope `newaccount` + `buyrambytes` costs a payer account and RAM at market. Hive account creation costs 3 HIVE or an Account Creation Token, and the creator sets the keys. Autonomi uploads cost ANT from a wallet configured in `ant` itself. Arweave uploads cost AR. **The tree has no payer account, no funded wallet, and no signer for any of them.** "The identity costs nothing" (`onboarding/src/lib.rs:11`) is true of the local keypair only.
   *Settles it:* a founder decision on whether BNR operates a payer account per chain. If yes, every account it creates is `PlatformHoldsKey` at birth, and §4's custody answer follows mechanically.

2. **What is "the $"?** Fiat? A stablecoin? On which chain does it arrive? There is no fiat on-ramp, no stablecoin type, no `decimals` concept anywhere (repo-wide grep = zero), and the one `Money` type is `f64` (`denomination/src/lib.rs:39-42`).
   *Settles it:* naming the deposit asset and its arrival rail, plus a decision that all internal money is `u128` atomic units with a per-asset scale table.

3. **What are "the standard resource accounts", and what are the split ratios?** Not derivable from any source in the tree. Nothing distributes one amount across N targets.
   *Settles it:* a founder-supplied table of `AccountKind → weight`, plus a dust rule.

4. **xBTC.** Zero occurrences repo-wide (case-insensitive). Contract address, chain, and decimals all unknown. It is an ERC-20-shaped asset, not an address, so it does not need provisioning — it needs a token registry that does not exist.
   *Settles it:* contract address + chain id + decimals, pinned as constants with a live `eth_call` verification.

5. **Is `did:autonomi` a real DID method?** There is no generator, no resolver, no anchoring code, and no specification reference in the tree. `RootIdentity.anchored` is a `bool` the caller sets. The entire adoption gate at `reachable_grade` (`onboarding/src/lib.rs:314-319`) rests on it.
   *Settles it:* one root anchored against a live Autonomi node, with the resulting document captured as a fixture — and a decision on whether `did:autonomi` is a registered method or a local convention.

6. **Is the SLIP-0010 derivation correct?** `chain_zano::slip0010::{master_node, derive_hardened}` (`slip0010.rs:57-86`) has never been checked against SLIP-0010's published Ed25519 vectors. The file spends 26 lines (`:12-27`) explaining that getting Ed25519 derivation wrong "yields silent garbage," then never tests it. If one seed derives every address, this is the single point of failure for the entire feature.
   *Settles it:* adding the published vectors. They exist, they are free, and this should land before any address is derived from that code.

7. **Coin type 1018.** Declared twice with three contradictory confidence claims: "VERIFIED against the official SLIP-0044 registry" (`keys.rs:20-22`), "VERIFY before production" (`keys.rs:38`), "VERIFY against the registry before production" (`slip0010.rs:47`). Also, `keys::derivation_path` returns a **3-level** path (`keys.rs:44-51`) while `slip0010::zano_path` returns a **5-level** one, and `proto/messages-zano.proto` specifies the 5-level form.
   *Settles it:* one look at the SLIP-0044 registry, then delete `keys::derivation_path` (dead, uncalled, contradicts its sibling).

8. **Will the Safe 7 ever be the signer?** `bsigner` enumerates the device but every message returns `Failure_InvalidProtocol` — `trezor-client` 0.1.6 is ProtocolV1-only and T3W1 needs THP (`bsigner/src/device.rs:23-49`). If the answer is "yes," provisioning's signer seam must be device-shaped from day one, not retrofitted.
   *Settles it:* a THP-capable client, or a decision that provisioning signs with software keys and the device is a later tier.

9. **Confirmation policy for account creation.** `chain-exsat-evm`'s `confirmation_depth` has no defensible value and no default (`indexer.rs:114-122`); `0` is an accepted config, at which point logs emit at the tip. `zano-watcher` has `block_num: 0` and a synthetic `tx_id` (`zano-watcher/src/lib.rs:148-149`) — no confirmations, no reorg handling, no ability to distinguish two deposits.
   *Settles it:* a per-chain confirmation table, and a real tx identity for Zano (the current watcher cannot tell you *which* deposit funded an account, or whether it was one deposit or two).

10. **`ant` CLI output schema.** `atmirror::autonomi` parses the address out of `ant --json file upload` output with a fail-closed heuristic, and the crate says the schema is unconfirmed against a live funded run (`autonomi.rs:11-18`).
    *Settles it:* one funded upload, captured and pinned.

11. **Is `chain-eos`'s SHIP decoder actually right?** All 23 tests decode bytes produced by the crate's own mirror encoder (`lib.rs:673-816`); there is **no captured real-chain fixture in the repo**. If encoder and decoder share a wrong assumption, every test still passes. The only external anchor is the name codec vector (`lib.rs:950`). The live-nodeos evidence lives in `STATUS.md:1006-1019`, outside where CI can re-run it.
    *Settles it:* committing one captured block from a real nodeos as a fixture.

---

**One line to carry forward.** The single largest gap is not any chain adapter — it is that **nothing in this workspace can sign a transaction on any chain**. Every provisioning action the founder described is a write, and the write side is absent in `chain-eos` (decode only, refuses to parse `public_key`), refused by construction in `bsigner`, and a `format!` placeholder in `dro-signer`. The reusable material is real and substantial — Antelope name validation, Zano key math, ANS-104 Arweave signing and upload, DID resolution, the disclosure-witness idiom, the conservation-enforcing split rule — but it is all either read-side or pure logic. Building the signer and the Antelope action encoder first, with published vectors, is what keeps this from becoming another half-built version.
