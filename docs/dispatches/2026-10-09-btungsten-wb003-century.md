# 2026-10-09 — bTunGsTeN WB003: the century ladder (axis 6), red-first, four migration seams repaired

Lane: btungsten / WB003. Seat: zCode. Order: founder 2026-10-09 ("see if
this has already been started; either way godspeed") against the founding
brief whose climax is the 1,000-year test — SimpleAssets as bTunGsTeN's
first extinct-infrastructure specimen.

## Already started? YES — and this beat continues it

The brief was executed as WB002 (2026-10-07): the specimen vendored
verbatim at `scripts/btungsten/wb002-specimen/` (PROVENANCE.md sha256
pins), the faithful Rust model + battery, the extraction semantics
(Adapter profile), sovereignContinuity PROVEN in Cryptol (PR #361) and
the core ≡ spec SAW equivalence, the 2021 wasm run on Spring 1.2.2 (46/46
×3 + CI workflow). Named open when I picked the lane: the live testnet
leg (founder-gesture class), the port-to-twin bridge (CODEX seat's),
WB003+ scale/century legs. This dispatch lands the CENTURY half.

## What this beat built

`crates/btungsten-wb003` — the century ladder: a FIXED, readable
ten-century schedule (no RNG) carrying one 2019 spine (an NFT credential
whose idata is the COMMIT commitment, an NTT capability, a composed
parent∋child object, a seven-century tenure, sovereign funds) through:

- C1 2119 THE EXTRACTION — Specimen → Adapter migration; the F-1
  authorctrl confiscation exercised once (named), then refusing on the
  Adapter side of the same boundary;
- per century: anchored migration with a tampered-bundle refusal EVERY
  time, author extinction (authorx C1; authorgov C7 after F-8 co-signed
  changeauthor), key/algorithm eras (ed25519 → dilithium2 → sphincs-imp →
  ml-dsa-3019), partition+reorg with post-fork healing checkpoints (the
  losing branch, indexer-fed against canonical anchors, must answer
  DISPUTED), marketplace death (offer → expiry refusal → canceloffer →
  direct transfer), post-migration births, mallory probes;
- EVERY action passes through the killer-invariant check (consent
  captured before); EVERY boundary re-derives the whole world from the
  last checkpoint + suffix ONLY and demands it equal canonical truth for
  every id; idata must be byte-identical to 2019 at every boundary.

Result (local, `cargo test -p btungsten-wb003`): **7/7**, the ladder
printing 11 receipts 2019 → 3019; the spine arrives in 3019 alive,
alice holds the credential, the COMMIT commitment byte-stable, 4
anchored migrations in the lineage, zero adapter-era unexplained
sovereignty changes, the sole specimen-era violation the NAMED F-1 row
of century 1, and the final world rebuilt from the last checkpoint
matching canonical truth for every id.

## The red run (receipt — the ladder convicted the model on its first boundary)

Written red-first; against the UNREPAIRED model, all four standalone
seam rows and the ladder itself failed with exactly:

```
thread 'post_migration_mint_never_collides' panicked at wb003.rs:191:13:
id 100000000000003 exists in two scopes (alice) — the migration collision
thread 'live_delegation_is_log_truth_after_migration' panicked at wb003.rs:230:5:
assertion `left == right' failed: the successor's log lost the live tenure (fold said Some("dave"))
thread 'contained_assets_are_log_truth_after_migration' panicked at wb003.rs:286:5:
assertion `left == right' failed: the successor's log cannot see the contained child (fold said None)
thread 'value_continuity_or_refusal' panicked at wb003.rs:261:19:
the successor silently dropped bob's SOVR balance
thread 'ten_centuries_the_spine_survives' panicked at src/lib.rs:576:21:
assertion `left == right' failed: century 1: full-log fold diverged for id 100000000000006
```

## The four repairs (crates/btungsten-wb002/src/chain.rs, import_state)

- **R-A post-migration mint collision** — import did not advance the
  successor's asset counter; the first post-migration mint reused a
  MIGRATED id, one id in two scopes, the newborn resolving to the OLD
  holder (the upstream #26 mis-assignment class at a migration boundary).
  Repair: counter advances past every migrated id (rows recursively,
  token ids, delegation asset ids).
- **R-B live tenure lost from log truth** — a mid-delegation migration
  re-planted the delegates table but emitted no event; table truth said
  the lender, the successor's log fold said the borrower. (The WB002
  torture never caught it: it folds only AFTER closing the tenure.)
  Repair: import emits `delegateopen` per live tenure.
- **R-C silent value drop** — a bundle FT naming a token the successor
  has no contract for was silently skipped: funds lost without a
  refusal. Repair: `bt-wb02:migration-unknown-ft` — value continuity or
  refusal, never a silent drop.
- **R-D contained structure invisible to the fold** — a composed
  parent∋child object migrated as table state only; until the first
  checkpoint the successor's fold could not see the child. Repair:
  import emits the child's spawn + attach events.

Also: `Chain` now derives `Clone` (behavior-neutral; the reorg row forks
the chain mid-history). All repairs are inside the anchored transaction
(refused imports still roll back whole — the tamper row asserts it).

## Boundaries

- The WB002 battery stayed green through all four repairs: 24/24
  (`cargo test -p btungsten-wb002`). The 46-step wasm corpus harness is
  untouched (it never imports).
- WB003 receipts the MODEL at ten-century depth — sampled class; the
  SAW-proven core still underwrites each Adapter action; this is not a
  live-chain or thousand-year empirical claim (SPEC axis-6 honesty
  clause).
- The migration's FT-recreation precondition (successor recreates token
  contracts before import, ids matching genesis order) is asserted by
  value continuity (R-C + the SOVR balance check), not assumed.
- Open offers do not migrate (they are standing consent, not
  sovereignty; the Adapter TTL kills them within the hour) — named
  here, unchanged from WB002.
- fmt + clippy clean on both crates.

## NEXT OWNER

- CI green on this PR → this seat merges (no-stall law).
- Open, named: the SCALE half of axis 5 (10/100 GB storage ladder,
  box-gated); the live leg shared with WB002 §next 4 (founder-gesture
  class); century-depth variations (a migration every century;
  adversarial fragment sets). The port-to-twin bridge stays the CODEX
  seat's.

HUMAN INTERACTION: NONE.
