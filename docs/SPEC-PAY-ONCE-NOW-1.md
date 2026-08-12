# SPEC-PAY-ONCE-NOW-1 v0.1 — Pay-Once-Now Invariants

Status: FOUNDER-ruled (2026-08-12). Apply to ALL durable-data code.
These are trivial to enforce today and a billion-user migration if deferred.

---

## The four invariants

### 1. bDiD minted on Vaulta + post-quantum-ready from record one

Do not mint identity on a classical-only key that forces a re-mint later.
Autonomi's own model = "establish a new quantum-safe identity," not migrate.
Use a PQ-ready / hybrid key format for the identity root.

**Vaulta correction standing:** registry = Vaulta account-set roles
(owner/active/custom), NOT an ANT scratchpad. Build the identity registry
on Vaulta's permission system. The prior report's rec #1 is superseded.

**Enforcement point:** the identity-mint code path must use a versioned
key envelope (invariant #2) that supports algorithm succession without
re-minting. The Vaulta record stores the key envelope, not a raw public key.

### 2. Every durable record self-describing + versioned + additive-only

Every key, address, identity record, and DID document is wrapped in an
**algorithm-agnostic versioned envelope**:

```json
{
  "v": 1,
  "self_desc": {
    "algo": "secp256k1",
    "hash": "sha2-256",
    "encoding": "multibase"
  },
  "data": { ... }
}
```

- `v` = schema version (additive only; old versions never rewritten)
- `self_desc` = multicodec-style tags naming the exact algorithm
- `data` = the actual payload

New algorithm versions add new records; old records stay valid.
Mirror the spend-receipt schema discipline: computed-not-stored totals,
closed enums, versioned rate refs.

### 3. Adapter-ring as a hard rule

NO direct third-party endpoint calls anywhere in the codebase.
Every rail/gateway/RPC sits behind a thin swappable adapter:

```
Handler → Adapter trait → {configurable base URL} → external endpoint
```

Each adapter has a configurable base URL (not hardcoded).
The ArNS AO↔Solana and maidsafe→WithAutonomi transitions prove this pays.

**Current violations:** `rails.rs` makes direct calls to
horizon.stellar.org, api.mainnet-beta.solana.com, api.hive.blog, wax.eosrio.io.
These must be refactored behind adapters.

### 4. Local-first is the only durable write path

The VPS is cache/bootstrap, never a system of record.
Nothing durable may hard-depend on it.

The deleted env-var registry (`WATCH_ONLY_ADDRESSES`) was the anti-pattern.
Durable data lives on Arweave (immutable) or Vaulta (mutable identity records),
not on the relay's env vars. The relay is a read cache + write forwarder.

---

## Acceptance criteria

1. No `ureq::get/post` call in the codebase targets a hardcoded URL.
   All external calls go through adapter structs with configurable base URLs.
2. Every balance/identity/status response includes `v` and `self_desc` fields.
3. The identity-mint path uses a versioned key envelope, not a raw key.
4. The relay can be shut down and all durable data is still readable from
   Arweave/Vaulta directly.

---

## Code audit — current state (2026-08-12)

| File | Violation | Fix |
|------|-----------|-----|
| `rails.rs` stellar_balance | Direct call to horizon.stellar.org | Move to StellarAdapter |
| `rails.rs` solana_balance | Direct call to api.mainnet-beta.solana.com | Move to SolanaAdapter |
| `rails.rs` hive_balance | Direct call to api.hive.blog | Move to HiveAdapter |
| `rails.rs` vaulta_balance | Direct call to wax.eosrio.io | Move to VaultaAdapter |
| `lib.rs` arweave_* | Gateway pool (already adapter-shaped) | Rename `gateway_used` → `source` |
| `dashboard.rs` test_upload | Direct forward to Turbo | Move to TurboAdapter |

---

*Goose, primary executor. Cites: SPEC_KEYRING-1 (custody tiers, bDiD), SPEC_DOCTRINE-HARVEST-1 (additive patterns), adapter-ring proof (ArNS AO↔Solana, maidsafe→WithAutonomi), local-first law (VPS = bootstrap crutch), spend-receipt schema discipline.*
