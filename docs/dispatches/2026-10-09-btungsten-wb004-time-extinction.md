# 2026-10-09 — bTunGsTeN WB004: the time-extinction specimen — the 2106 boundary, epochal governance, and the 10B laws (L1-L4)

Lane: btungsten / WB004. Seat: zCode. Order: founder 2026-10-09 — the
requirement upgrade ("at least 10 billion unique, ACTIVE sovereign users
continuously across a 1,000-year operational horizon"), the msig.app/jungle
specimen, and the `time_point_sec` 2106 discovery.

## Claims verified first-hand before any canon landed

- **`time_point_sec` is `uint32_t` seconds.** Spring v1.2.2
  `libraries/libfc/include/fc/time.hpp:87-99` (fetched at the tag):
  `class time_point_sec` holds one member `uint32_t utc_seconds`;
  `maximum()` is `numeric_limits<uint32_t>::max()`. 4,294,967,295 s
  after 1970-01-01 is **2106-02-07 06:28:15 UTC** — asserted by
  computation in the battery (civil date derived by Hinnant's algorithm,
  no time crate). The wire format cannot represent expirations past it.
- **eosio.msig approvals are per-proposal vectors.** Reference
  contracts at `c526479a` (2025-01-20, the repo's final commit):
  `eosio.msig.hpp:124-146` — `std::vector<permission_level>
  requested_approvals` / `provided_approvals` (and the approvals2
  variants). Expiration gates propose and exec (`eosio.msig.cpp:56,218`,
  "transaction expired"); a non-proposer cancel waits for expiry
  (`:191`). It is a multisig EXECUTION primitive, not planetary
  direct-democracy storage — exactly as ordered.

## What landed

**The specimen** — `scripts/btungsten/wb004-specimen/eosio.msig-c526479a/`:
the `contracts/eosio.msig` subtree vendored VERBATIM through the GitHub
contents API (base64 bytes), every file verified EQUAL to upstream's own
git blob SHA at the pin, then sha256-recorded in `PROVENANCE.md`
(`.gitattributes * -text` is the only estate addition inside the subtree
— the WB002 CRLF lesson). MIT (ENF/block.one) carried in place.

**The canon** — SPEC-BTUNGSTEN-1 gains §laws:
- **L1 Millennium Authority Continuity**: 10B unique ACTIVE sovereigns,
  continuously, across the whole horizon — uniquely attributable,
  authenticating, exercising/revoking, recovering, participating,
  migrating; authority changes only through the currently authorized
  sovereign action; no dependence on any original key, signer set,
  algorithm, clock representation, contract, chain, org, or UI.
- **L2 Epochal governance**: never a 1,000-year proposal — what lasts
  is authority continuity, not serialized transactions; the epochal
  cycle is named in the spec.
- **L3 The execution layer is bounded**: population-scale authorization
  lives in proofs+aggregation; msig receives a compact verifiable
  aggregate.
- **L4 Time-representation extinction is a boundary**: fail closed
  before it, migrate across it; the 2106 horizon is its first instance.
The §workbench sequence now records WB003 (done) and WB004 (CURRENT).

**The model** — `crates/btungsten-wb004` (13 tests, all green; fmt+clippy
clean; no dependencies beyond sha2):

- `time.rs` — the two representations; the fail-closed encoder; the
  naive truncating encoder kept as the TEETH artifact: **a 2200-era
  intent, naively truncated, becomes a VALID-LOOKING ~2063 expiration**
  — semantic time travel, convicted by name in the battery. TTL
  compression: `max_ttl = horizon − now`; at 29 days out, a 30-day TTL
  refuses to exist.
- `msig.rs` — the execution layer, specimen-shaped (approval vectors,
  `:56/:191/:218` semantics), with `MSIG_APPROVALS_CAP` (L3) enforced at
  propose: the 10B-rows anti-pattern is refused at the door.
- `authority.rs` — the constitutional object (m-of-n signers over an
  immutable digest), the hash-chained receipt log (what actually lasts
  1,000 years), its verifier, its continuity fold (an evidence-free
  authority change refuses), and the anchored migration bundle.
- `epoch.rs` — the epochal engine: COMMIT+PROVE at model scale →
  256-member shards → order-independent aggregate (no indispensable
  aggregator — any survivor folds the same root) → bounded 7-day-TTL
  proposal → exec → SETTLE receipt → next epoch. Quorum-gated rotation
  and the representation migration (u32 wire replaced by u64, chain
  replaced, authority anchored across) — the ONLY way the schedule
  crosses 2106.

**The ladder row**: 65,536 unique registered sovereigns, 2026 → 3026;
the u32 wire proven dead at 2180 (a 1-day TTL refuses to exist);
signer/key/algorithm rotations (ed25519 → dilithium2 → sphincs-imp →
ml-dsa-3019), humans retired and agents seated; the final audit folds
the whole provenance chain and equals the live authority; continuity
ledger empty; every epoch executed inside a bounded execution layer.

## Receipts

- `cargo test -p btungsten-wb004`: **13/13** (2 unit + 11 battery).
- Boundary arithmetic asserted from first principles (no time crate):
  `the_horizon_is_2106_02_07_062815`.
- Specimen provenance: 5/5 files blob-SHA-equal to upstream at
  `c526479a` (the MATCH lines ran during vendoring; sha256s recorded).

## Boundaries

- 2^16 sovereigns is SAMPLED. The 10B claim here is structural
  (per-layer counts as functions of population; the execution layer
  constant at 256/4,096/65,536) plus the named physical-scale legs.
- Unique-human proof cryptography is NOT this crate (SK001/PQ lanes);
  registration refusing duplicates models the interface only. The
  participation "signature" is a deterministic hash — the scheme is an
  interface; algorithms are separate lanes.
- The live leg (a real chain refusing a post-2106 expiration at
  propose) is named open, not run. No millennium proposal was created
  anywhere — that is the law.

## NEXT OWNER

- CI green on this PR → this seat merges.
- Open, named: the Cryptol twin of the continuity predicate and the
  wraparound refusal; the live-leg check; real aggregation cryptography
  behind the fixed interface; the population scale-up toward axis 5.

HUMAN INTERACTION: NONE.
