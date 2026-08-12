# SPEC-VAULTA-IDENTITY-1 v0.2 — Vaulta Identity Record / bDiD Mint

Status: **SPEC-FIRST (founder-gated)**. No account creation or key operations in a seat.
Companion to: SPEC_KEYRING-1 §2.6/§3, SPEC-PAY-ONCE-NOW-1 #1/#2,
SPEC-ONBOARDING-IDENTITY-1, FABLE 8i/8j/8h.

---

## 0.1 Layer architecture (v0.2 AMENDMENT — the scaling direction)

Per DISPATCH_CLAUDECODE_BDOMAIN_ADDENDUM_R8 (founder-confirmed ruled shape)
and bdomain-scaling.md (RAM re-derivation: 2,537 B/user for 11-chain whole-account
model; registeracc require_auth means registrant must already BE an Antelope account),
the .b identity has THREE layers:

**Layer-0 — bDiD keypair (scales to 10^10, FREE):**
Locally generated keypair. Zero Vaulta rows, zero cost. Signed bDiD record
content-addressed on AR/ANT. The ONLY shape that reaches 10 billion users.
The mass individual identity = a keypair, NOT an account.

**Layer-1 — frozen resolution kernel:**
Deterministic, never-changing rule: name -> H(name) -> deterministically
derived Autonomi address -> append-only owner-attested record.

**Layer-2 — anchor adapters (millions, NOT billions):**
Vaulta account names, Zano aliases, DNS, ATProto handles, ENS — premium,
scarce, human-readable attestation sources. INVARIANT: adapter transfer or
loss can NEVER rebind a Layer-0 keypair. Chains are demoted from registry
to adapter.

### What the full-account shape (§1) IS and IS NOT

The owner/active/bni.id/bni.deploy permission structure = **HUB / DAO-ROOT /
FOUNDER tier** — correct for the ROOT identity (the founder's own mint, the
DAO root account). NOT the per-user template.

Per bdomain-scaling.md: full accounts scale to ~3.2x10^8 rows (Vaulta
max_ram_size ceiling) = 31.5x SHORT of 10^10. RAM is unbuyable in bulk
(physical ceiling). registeracc's require_auth + is_account means a registrant
must already BE an Antelope account. Full accounts do NOT scale to 10 billion.

**The per-user identity = Layer-0 keypair.** Zero rows, zero cost,
content-addressed. The Vaulta full-account model is the hub/root shape.
Vaulta naming = Layer-2 premium convenience, NOT the identity itself.

**187-bit pointer ruling STAMP:** UNLOCATED in repo docs as of 2026-08-12.
Searched all .md files in beehive-nature/docs + Downloads. The "187 bits on
Vaulta that points to AR" ruling may be from a chat session or external doc.
FLAG: founder to provide source doc/commit for stamping.

Cited: DISPATCH_CLAUDECODE_BDOMAIN_ADDENDUM_R8 (ruled shape, commit context),
bdomain-scaling.md (RAM re-derivation, 2,537 B/user), FABLE 8h (key-derivation
= data migration), 8i (deploy = custom permission), 8j (key sort by bytes).

## 0.2 S7 audit amendments (2026-08-12, intern research audited + source-stamped)

### Antelope key types (STAMPED: AntelopeIO/leap main, public_key.hpp:24)

Antelope keys are K1/R1/WebAuthn ONLY — no PQ key type in the variant:
`variant<ecc::public_key_shim, r1::public_key_shim, webauthn::public_key>`.

**PQ-readiness lives in the S2 envelope layer, NOT the Vaulta permission tree.**
Account authority stays K1/R1/WA until Antelope ships a PQ key type.
Hybrid (K1/R1 + ML-DSA dual-sig at envelope layer) is the bridge.
Default PQ signature: **ML-DSA-65** (FIPS 204).
SLH-DSA (FIPS 205) reserved for long-horizon archival anchors (7,856 B min sig).

### Five-action authorization bar (STAMPED: authorization_manager.cpp:295-301)

updateauth/deleteauth/linkauth/unlinkauth/canceldelay are enforced at the
AUTHORIZATION LAYER (authorization_manager::lookup_minimum_permission), NOT
at linkauth. apply_eosio_linkauth has NO forbidden list. Phrase: "enforced at
the authorization layer." Never stronger than standing law allows.

### Envelope improvements (adopted into S2)

1. **Domain-separation string** ("bNRi/identity/v1"-style) so one hash function
   cannot be replayed across contexts.
2. **Per-chain self_desc hash** (not global) — Zano=Keccak, Antelope=SHA-256.

### RAM price table (VERIFIED at source 2026-08-12)

Location: `code=eosio, scope=eosio, table=rammarket` (NOT eosio.ram — returns empty).
Returns Bancor RAM market: supply (RAMCORE), base.balance (RAM bytes),
quote.balance (WAX tokens). Verified via live RPC.

### Account cost (receipted numbers, not estimates)

Full-account all-in: ~3,450 B account base + 2,537 B registry row = ~5,983 B+
(Receipted at commit 8840740, bdomain-scaling.md. Not the intern's 2-3 KiB range.)

### Owner permission parent encoding

ROOT owner permission's `parent` field = EMPTY STRING (""), not null.
Encode as `""` in updateauth transactions.

### Layer-0/Layer-2 split STANDS

Native permission table (intern's item-4) is authority of record for the HUB
TIER ONLY — native permissions require an ACCOUNT, accounts hit the RAM wall
(~3.2x10^8 ceiling = 31.5x short of 10^10). v0.2 split stands. Do not collapse.

## 0. Prior design synthesized

The prior Vaulta identity-hub + bDiD custody design is distributed across:
- SPEC_KEYRING-1 §2.6: Vaulta = secp256k1, T-H target, custom PUB_WA = T-F
- SPEC_KEYRING-1 §3: bDiD = verification-method succession (additive, never remove)
- FABLE 8i: deploy authority = custom permission linkauth'd to setcode/setabi/buyram ONLY
- FABLE 8j: Antelope sorts authority keys by serialized key bytes, not base58 text
- FABLE 8h: key-derivation change = data migration (even when struct is byte-identical)
- Founder ruling 2026-08-12: registry = Vaulta account-set roles, NOT ANT, NOT env var

---

## 1. Account structure (Vaulta account-set roles)

The bDiD lives ON the Vaulta account's permission structure:

| Permission | Authority | Role | Custody tier |
|---|---|---|---|
| `owner` | recovery multisig | account recovery, permission reset | T-H |
| `active` | hardware key(s) | operational transactions | T-H |
| `bni.id` | linked key(s) | identity record read/write | T-F or T-H |
| `bni.deploy` | linked key(s) | setcode/setabi/buyram ONLY | T-H |

Per FABLE 8i: deploy authority is NEVER `@active`. It is a custom permission
linkauth'd to setcode/setabi/buyram only. Threshold-1 with two weight-1 keys
means EITHER KEY ALONE — unacceptable for non-testnet.

Per FABLE 8j: when setting authority keys, sort by serialized 33-byte compressed
key bytes, NOT the base58 text string. Antelope rejects mismatches as
"invalid authority" which misdirects to the authority, not the sort.

---

## 2. PQ-ready versioned envelope (invariant #1 + #2)

Every key, address, and identity claim is wrapped in this envelope from record one:

```json
{
  "v": 1,
  "self_desc": {
    "key_algo": "secp256k1",
    "sig_algo": "ecdsa",
    "hash": "sha2-256",
    "encoding": "base58"
  },
  "pq": {
    "ready": true,
    "successor_algo": null,
    "successor_key_ref": null
  },
  "payload": {
    "type": "address",
    "value": "...",
    "source": "trezor-device-read",
    "custody_tier": "T-H"
  },
  "timestamp": 0
}
```

- **v** = schema version (additive-only; old records never rewritten)
- **self_desc** = algorithm-agnostic tags naming the exact algorithm (multicodec-style, never a hardcoded curve/hash assumption)
- **pq.ready** = this record CAN be superseded by a PQ key without re-minting the identity
- **pq.successor_algo/key_ref** = filled when a PQ successor is added (additive, not replacing)
- **payload.source** = provenance (device-read, manual, oauth, etc.)

When a PQ successor is added: a NEW envelope record is created (additive).
The old record's `pq.successor_key_ref` points to the new one. Both remain valid.
The identity is NOT re-minted — the Vaulta account stays, the key set grows.

---

## 3. bDiD record schema (on Vaulta)

The bDiD record maps to the Vaulta account's permission tree + a data table:

**Permission tree (updateauth/linkauth):**
- `owner` keys = [{envelope: T-H recovery key}]
- `active` keys = [{envelope: T-H hardware key}]
- `bni.id` keys = [{envelope: T-F passkey}, {envelope: T-H Trezor EVM}]
- `bni.deploy` linkauth'd to: setcode, setabi, buyram

**Identity data table (on-chain or contract):**
- Each row = one versioned envelope (address or pubkey or DID method)
- Primary key = envelope hash (deterministic, never recomputed per FABLE 8h)
- Additive only — new rows appended, old rows never modified

**Device-read addresses (EVM/BTC/ZEC from Trezor):**
- Stored as envelope rows with payload.type = "address"
- payload.source = "trezor-device-read"
- payload.custody_tier = "T-H"
- Each network gets its own envelope row

---

## 4. Device-read integration flow

```
Trezor (local bridge 127.0.0.1:21328)
  → derives EVM/BTC/ZEC public addresses (granted set only)
Dashboard
  → wraps each address in a versioned envelope (§2)
  → sends envelopes to relay
Relay (adapter ring)
  → VaultaAdapter prepares the update transaction (UNSIGNED)
  → surfaces to founder for signing
Founder (T-H active key)
  → reviews + signs the transaction
  → transaction posts to Vaulta
Dashboard
  → reads identity record from Vaulta (via VaultaAdapter)
  → displays addresses + balances via adapter ring
```

The relay NEVER holds a private key. The Vaulta update requires the founder's
active permission key. The seat prepares unsigned transactions only.

---

## 5. Irreversible / founder-gated actions (spec-first)

These actions are SPEC-ONLY from a seat. Execution requires the founder:

| Action | Why gated | Who executes |
|---|---|---|
| Create Vaulta account | irreversible on-chain | Founder |
| Set `owner` permission | root authority | Founder |
| Set `active` permission | operational authority | Founder |
| Create `bni.id` permission | identity management | Founder |
| Create `bni.deploy` permission | code deployment | Founder |
| Deploy identity contract | code on account | Founder (bni.deploy) |
| Add PQ successor key | identity succession | Founder |
| Write device-read addresses | requires active key sign | Founder |

The seat CAN: read the Vaulta identity record (public data), prepare unsigned
transactions, wrap addresses in envelopes, display the record via dashboard.
The seat CANNOT: sign, send, create accounts, set permissions.

---

## 6. Acceptance criteria

1. Vaulta account has owner/active/bni.id/bni.deploy permissions per §1.
2. Every key and address wrapped in versioned envelope per §2.
3. Envelope includes pq.ready=true and successor fields from record one.
4. Device-read addresses (EVM/BTC/ZEC) write into the record as envelopes.
5. Old records never rewritten — additions only (verification-method succession).
6. Dashboard reads registry from Vaulta (via adapter ring) and displays balances.
7. No seat holds a Vaulta private key or signs a transaction.
8. Permission keys sorted by serialized bytes, not base58 (FABLE 8j).

---

## 7. UNVERIFIED register

- Vaulta RPC endpoint for reading permission tree: verify exact API shape via adapter
- Vaulta account creation cost/process: founder action, not yet scoped
- Identity data table: contract-based or native multi-sig table — design when implementing
- PQ key algorithm (ML-DSA / SLH-DSA / hybrid): spec when PQ crypto library is selected
- Transaction format for permission updates (updateauth/linkauth): verify via Vaulta adapter
- Envelope hash function for primary key: sha2-256 default, self_desc makes it swappable

---

*Goose, primary executor. Synthesizes: SPEC_KEYRING-1 §2.6/§3, SPEC-PAY-ONCE-NOW-1 #1/#2, SPEC-ONBOARDING-IDENTITY-1, FABLE 8i/8j/8h, founder ruling 2026-08-12 (Vaulta account-set roles, NOT ANT).*
