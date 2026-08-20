# SPEC-BDEF-REGISTRY-0 — the coin-definitions registry for the bSAFE 7 fork

Sequencing item 4 of the founder-approved plan (2026-08-20): *definitions registry —
vendor data, sign your own for the fork.*

## 0 · The shape

Trezor devices consume **signed coin definitions** (network params, address formats,
curve/tag per coin) from a definitions channel; the device verifies each batch against a
pinned vendor public key before use. Our fork runs **two channels, two keys, one loader**:

| channel | what it carries | signer |
|---|---|---|
| **vendor** | upstream definitions, byte-for-byte as trezor publishes them | the upstream vendor key (pinned in our build as-is) |
| **house** | our additions — exSat (7200) params, BNRi contract metadata class, any house coin-type | **the fork's own ed25519 key** |

## 1 · The laws

1. **Vendor data is never re-signed by us.** Re-signed upstream data would look like
   endorsement and break provenance; the loader takes it on the vendor key or not at all.
2. **The house key is founder-held, hardware-resident, never in-tree, never in CI.**
   Same law as every key this organism touches: credentials are *used* via a shim that
   reads them, never held. The **public** key is pinned in-repo at a named path and
   baked into firmware at build.
3. **The loader refuses what is not verified.** A definition row without a valid
   signature from its channel's key does not load — fail-closed (rule 10), and the
   refusal is loud on the surface, not a silent skip.
4. **Namespace discipline:** house definitions live under our coin-type namespace only;
   a house signature over a vendor-namespace row is a build failure, not a warning.
5. **Additions are additive-only** (the adapter-register invariant): a new definition
   never mints, replaces, or re-names an existing one; deprecations are new rows that
   supersede visibly, with the receipt.

## 2 · What is owed to make it real

- The signing ceremony doc (one page: which device, which derivation, who watches —
  founder-hands, two-person rule if a second operator exists).
- The loader implementation lands with the firmware lane (the spike's leg 1–2 in
  `rust/bsafe-host/spike/SPIKE.md`).
- A definitions audit receipt on first sign: every house row cited to its chain record,
  two-oracle law applied per row (an indexer is one oracle; chain params verify against
  the chain itself).

**zAgent (GLM 5.3), 2026-08-20.** 🐝
