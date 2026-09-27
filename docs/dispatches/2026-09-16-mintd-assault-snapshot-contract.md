# ASSAULT ON THE SELF-HOSTED-MINT ASSUMPTION + the capability-snapshot/drift-watch contract + NUT-24 resolved · 2026-09-16

**Order (founder, verbatim):** *"Attack the self-hosted-mint assumption.
Deep-read `cdk-mintd` for capability/config persistence, upgrade behavior,
keyset rotation, backup/recovery, and whether NUT-10/11 support can change
underneath already-issued proofs. Design the capability-snapshot +
drift-watch contract needed at issuance, including what happens to
outstanding bearer notes during a mint upgrade. Also resolve the NUT-24
discrepancy at source… No integration yet. Roll forward."* **Mode:** source
read at `main` (GitHub API + raw); zero build, zero integration.
**Companions:** `2026-09-16-cdk-adapter-deepread.md` (the 4/5 chain + the
drift attack's client-side limits — this roll moves INSIDE the mint).
**Branch** `zcode/cdk-adapter-deepread-2026-09-16`, worktree
`../wt-zcode-eddies`.

## 0 · Findings, one screen

| attack vector | verdict at source |
|---|---|
| "self-hosted ⇒ capability changes only on redeploy" | **FALSE as stated.** Three live channels: binary upgrade (code-level enforcement), **management-RPC/DB mutation** (`reconcile_canonical_configuration` merges config with DB-stored values; RPC-managed values preserved), config reload. Self-hosting buys **attributability**, not immutability |
| NUT-10/11 support under issued proofs | **CAN change** — enforcement is binary code (e.g., the verified `required_sigs == 0` refund path); NUT flags/MintVersion mutate via info channels; keyset retirement is the loud hard-loss variant |
| Key custody / backup | Seed **or** mnemonic **or** REMOTE SIGNATORY (`build_with_signatory`); secrets via `SecretRef::{Environment, File}` (`env:`/`file:`, e.g. `CDK_MINTD_MNEMONIC`); **the v0.17 migration NULLS local seed/mnemonic when a legacy remote signatory existed** — an upgrade can silently redirect WHO signs |
| Keyset rotation | Real backends: none at runtime — rotation exists ONLY as fake-wallet test scaffolding (`with_keyset_rotation`, `final_expiry`); production rotation = manual/new-keyset-per-config |
| Upgrade behavior | ONE manual migration (v0.17 legacy TOML → canonical): atomic staged writes, source never overwritten, secrets externalized to 0600 `file:` refs, no NUT/mint-info/keyset material changes — EXCEPT the signatory redirection above |
| NUT-24 discrepancy | **RESOLVED mechanically**: commit `7246ea2e` renamed `nut24.rs` → `nut25.rs` ("fix: bolt12 is nut25", #1020). CDK's "nut24" was the Bolt12 payment method under pre-renumber numbering; **the X-Cashu/HTTP-402 spec was never implemented**; the README ✔24 is stale documentation |

## 1 · The assault, in detail (all at `main`)

**Capability/config persistence.** `config.rs` has NO operator-facing
NUT-support flags — metadata (`name`, `motd`, contacts…) plus `Auth`
(per-endpoint Clear/Blind/None), `Limits{max_inputs, max_outputs}`,
`Info{input_fee_ppk, use_keyset_v2, quote_ttl}`. Payment backends are
compile-time feature-gated (`#[cfg(feature = "cln")]`…). `lib.rs` assembles
via `MintBuilder::new(localstore)` → `configure_basic_info` (`.with_motd`,
`.with_version(MintVersion::new("cdk-mintd", CARGO_PKG_VERSION))`…) →
backend registration per unit/method. **The supported-NUT map is code +
registration, not a config toggle.** Then
`reconcile_canonical_configuration` **merges config with DB-stored
(RPC-managed) values** — mint info is effectively three-way mutable:
config file, management RPC, database.

**Keys.** Three build paths: `build_with_seed(keystore, &seed_bytes)`,
mnemonic (`to_seed_normalized("")`), or `build_with_signatory(remote)` —
the signatory crate means mint keys can live OFF the mint box. Runtime
keyset rotation: fake-wallet only. Backup/recovery = the seed/mnemonic (or
signatory backup); nothing in-tree rotates or escrows them.

**The migration gotcha (law-worthy).** `config_migration.rs` is manual,
atomic, source-preserving — and contains this precedence: because released
v0.17 preferred the remote signatory, migration sets
`settings.info.seed = None; settings.info.mnemonic = None` when a legacy
signatory existed. An operator who "just migrated the config" can move the
signing authority from local seed to remote signatory **without touching
key material consciously**.

## 2 · The capability-snapshot + drift-watch contract (DESIGN — nothing built)

**Snapshot at issuance (receipt-anchored, hash-chained into the bPay
SpendReceipt side-link):**

```text
CapabilitySnapshot v1
  mint_url + TLS pin (cert/hash)
  nut06        = VERBATIM NUT-06 JSON + sha256   (nuts map incl. "10"/"11"/"12",
                                                 motd, time)
  binary       = MintVersion{name="cdk-mintd", version}  (from nut06 — pins
                                                 the BINARY identity)
  keysets      = [(keyset_id, unit, active?, input_fee_ppk,
                   sha256(keyset public keys from NUT-01/02))]
  fees_limits  = quote TTLs, Limits, min/max mint/melt
  probe        = BEHAVIORAL: mint a dust condition-carrying proof, attempt a
                 wrong-witness swap, EXPECT typed refusal   ← the CD-4
                 lying-manifest cross-check, executed live
  bPay side    = cap-policy hash + projected condition (data/locktime/
                 refund_keys/num_sigs_refund) + receipt linkage
```

The `probe` field is the contract's core novelty: **declared support is
cross-checked by experiment at issuance** — the only honest answer to
"`supported: true` is a claim, not a proof."

**Drift-watch state machine (periodic + pre-spend + pre-issuance):**

```text
re-fetch {nut06, keysets, fees} → diff vs snapshot → classify:
  BENIGN    motd/description only                     → continue
  SEMANTIC  nut "10"/"11"/"12" flag, MintVersion, keyset KEYS changed,
            fees/limits moved                          → REFUSE new issuance;
                                                        alert; redemption-gate
  HARD      keyset RETIRED while proofs outstanding    → redemption-only mode:
                                                        drain or reissue
  SILENT    nut06 unreachable / probe refused          → treat as SEMANTIC
                                                        (fail-closed)
```

**Outstanding-notes-during-upgrade semantics (the pin → probe → carry/drain
protocol):**

1. **Pin:** freeze issuance (G1 refuses); verify snapshot integrity.
2. **Probe:** after the upgrade, re-run the behavioral probe against the NEW
   binary AND verify every snapshot keyset still listed with byte-equal
   public keys (NUT-01 fetch vs snapshot hash).
3. **Carry or drain:** carry outstanding notes ONLY if probe passes and
   keysets hold; otherwise drain first (redeem against the old binary
   before cut-over) or reissue under the new capability snapshot with fresh
   conditions. Never "same major version ⇒ same enforcement" — the probe is
   the truth, the version is a label.
4. **Invariant written as law:** an outstanding note's semantics =
   `secret bytes (immutable)` × `keyset keys (must remain listed and
   byte-equal)` × `enforcement behavior (must re-probe equal)`. All three
   legs are checked; none is assumed.

**What this contract concedes (honest):** it makes drift DETECTED and
ATTRIBUTED, not prevented — prevention remains physical (our deploy
boundary, management-RPC access control, signatory continuity checks at
every upgrade, and capped exposure as the standing backstop). The
self-hosted mint is a **change-control perimeter**, not a cryptographic
guarantee.

## 3 · Laws banked

1. **Self-hosting buys attributability, not immutability** — count the
   mutation channels (binary, management-RPC/DB, config, signatory
   redirection) before trusting "ours".
2. **Migrations can move custody, not just config** — the v0.17
   signatory-precedence rule nulls local seed/mnemonic; check signer
   continuity at every upgrade.
3. **Declared support must be probed, not read** — the issuance-time
   wrong-witness probe is the only behavioral truth.
4. **NUT-24 in CDK: RESOLVED** — `nut24.rs` was renamed to `nut25.rs`
   (bolt12); X-Cashu/HTTP-402 was never implemented; the README ✔24 is
   stale pre-renumber documentation. Cite accordingly.

## 4 · Standing classes (unchanged, sharpened)

ADAPT (condition grammar + four-gate adapter — the snapshot/drift-watch
contract is now the G4 specification); WRAP (declared, not built); WATCH
(cdk ALPHA — the fake-wallet-only rotation and the RPC/DB mutation surface
are moving parts); BUILD-if-ever (G1 refund rule, G4 watch + probe — all
ours, no open implementation). Zero integration this roll.

## Landing receipt

Queue item #4 updated. Sources: GitHub API listings + raw fetches of
`cdk-mintd/{config.rs, config_migration.rs, secret.rs, setup.rs, lib.rs}`,
commit `7246ea2e` file array (the rename proof), prior-roll files for
enforcement facts. §7 seat shape, four pre-push checks, pushed branch +
main. Rolling forward hot.
