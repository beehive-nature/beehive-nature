# TREE CENSUS — what is actually built
**Generated 2026-07-26 by dispatch D-01 (`code` seat). Census only — nothing was fixed, refactored, or improved.**
Every number here is read from the tree or from a real `cargo test --workspace` run; none is retyped by hand. Regenerate: `cargo test --workspace` plus the generator in the D-01 receipt.

## Maturity rule
- **PROVEN** — has passing tests against a *real external system*, with the citation in the row.
- **COMPILES** — builds and passes unit/integration tests against fixtures or mocks only.
- **STUB** — skeleton that does not do the thing its name implies.

**No crate in this tree is a STUB by that definition.** Every one of the 34 builds and carries passing tests. But 7 are *trap crates* — the name implies a capability the code does not deliver — and that distinction, not STUB, is what has been causing designs to be proposed for things that "exist." See §2.

## 1. The 34 crates

| # | crate | LOC | pass | fail | ignore | last touched | maturity | what it actually is |
|---|---|---|---|---|---|---|---|---|
| 1 | `adapter-arweave` ⚠️ | 310 | 5 | 0 | 0 | 2026-07-03 | COMPILES | Merkle bundler + MockArweaveClient. No real Arweave client; upload gates on credentials. |
| 2 | `adapter-autonomi` ⚠️ | 382 | 9 | 0 | 0 | 2026-07-20 | COMPILES | parses `antctl status` telemetry from a pinned fixture. It is node-ops read-out, NOT storage put/get. |
| 3 | `adapter-carrier` | 371 | 9 | 0 | 0 | 2026-07-16 | COMPILES | Carrier-tracking evidence adapter — the dispute engine's first |
| 4 | `adapter-lti` ⚠️ | 587 | 11 | 0 | 1 | 2026-07-17 | COMPILES | mapping logic only; real LTI 1.3 AGS capture is an #[ignore]d test. |
| 5 | `atmirror` | 5283 | 43 | 0 | 0 | 2026-07-25 | **PROVEN** | live bQueenBee repo + live Arweave upload/restore (RECEIPT 2026-07-25) |
| 6 | `b-token` | 536 | 10 | 0 | 0 | 2026-07-20 | COMPILES | `resource.accounting` core (Phase 3 scaffold) — the `b` / Respect model |
| 7 | `bnr-shell` ⚠️ | 300 | 5 | 0 | 0 | 2026-07-20 | COMPILES | the D-14 frame + gauge wiring. No COSMIC view, no window (libcosmic deferred). |
| 8 | `capability` | 2007 | 60 | 0 | 0 | 2026-07-20 | COMPILES | `identity.root` + the Capability primitive (Phase 2 scaffold) — the |
| 9 | `chain-eos` | 1886 | 23 | 0 | 0 | 2026-07-03 | **PROVEN** | SHIP ingestion vs local dev chain, block 2832 (STATUS, dev-chain observed) |
| 10 | `chain-exsat-evm` | 3614 | 82 | 0 | 0 | 2026-07-16 | COMPILES | `chain-exsat-evm` — the exSat EVM log adapter (C-1) |
| 11 | `chain-zano` | 661 | 9 | 0 | 1 | 2026-07-03 | **PROVEN** | host-side derivation vs stock Zano v2.2.1.501 (committed vector, STATUS 2026-07-03) |
| 12 | `coa` | 192 | 3 | 0 | 0 | 2026-07-21 | COMPILES | `coa` — the honest-absence machinery for a composition / certificate-of-analysis record, and th |
| 13 | `composition` | 2746 | 0 | 0 | 0 | 2026-07-16 | COMPILES | The composition runtime: wires the proven crates into one process |
| 14 | `console-api` | 251 | 6 | 0 | 0 | 2026-07-20 | COMPILES | Console read-model — the derived [`ConsoleView`] the SKAISTS LOVErnment |
| 15 | `dashboard` | 395 | 6 | 0 | 0 | 2026-07-20 | COMPILES | `dashboard` — the read-only analytics surface (sprint v1). It **composes what the kernel |
| 16 | `denomination` | 474 | 14 | 0 | 0 | 2026-07-19 | COMPILES | The Denomination Constant (D-14) — `b` and money, everywhere, always |
| 17 | `dispute-engine` | 802 | 18 | 0 | 0 | 2026-07-13 | COMPILES | Tier-1 dispute adjudication — provenance-weighted, deterministic, |
| 18 | `dro-signer` | 922 | 17 | 0 | 0 | 2026-07-04 | COMPILES | DRO settlement authority — v1 of `dro-signer` per |
| 19 | `escrow-core` | 1730 | 54 | 0 | 0 | 2026-07-05 | COMPILES | bNature escrow state machine — build brief §9.1 (transition table) and |
| 20 | `escrow-engine` | 574 | 6 | 0 | 0 | 2026-07-03 | COMPILES | Escrow engine — the bus consumer that drives `escrow-core` |
| 21 | `event-bus` | 191 | 6 | 0 | 0 | 2026-07-02 | COMPILES | In-memory event bus — the runtime nervous system's local transport |
| 22 | `language-authority` | 554 | 9 | 0 | 0 | 2026-07-19 | COMPILES | `language-authority` — BNR holds an interface, never a corpus |
| 23 | `mastery-ledger` ⚠️ | 434 | 7 | 0 | 1 | 2026-07-20 | COMPILES | in-memory ledger; the commons anchor is an #[ignore]d test awaiting adapter-arweave. |
| 24 | `normalizer` | 474 | 11 | 0 | 0 | 2026-07-12 | COMPILES | Normalizer — the nervous-system step (brief §9.3): raw chain actions in, |
| 25 | `onboarding` | 913 | 17 | 0 | 0 | 2026-07-21 | COMPILES | `onboarding` — the identity ladder (RELAY_22) and its invariants, with age assurance folded in |
| 26 | `price-feed` | 437 | 7 | 0 | 0 | 2026-07-21 | COMPILES | `price-feed` — the USDA AMS hemp price series and the **computed small-package penalty** |
| 27 | `reputation-engine` | 830 | 14 | 0 | 0 | 2026-07-20 | COMPILES | Emergent reputation — deterministically recomputed from evidence and |
| 28 | `sense-atproto` | 1481 | 38 | 0 | 0 | 2026-07-20 | COMPILES | `sense-atproto` — the ATProto social-layer seam adapter (BIND-1) |
| 29 | `shared-types` | 861 | 24 | 0 | 0 | 2026-07-16 | COMPILES | bNature shared types. Two modules: the canonical event schema |
| 30 | `treasury-t0` | 1000 | 19 | 0 | 0 | 2026-07-20 | COMPILES | `treasury-t0` — the Treasury smartCONTRACT (T-0): `b` as collateral, lock-and-burn |
| 31 | `type-bindings` ⚠️ | 43 | 1 | 0 | 0 | 2026-07-17 | COMPILES | holds only `Did` (43 LOC). The 'canonical wire types' it names are still in shared-types. |
| 32 | `verify-trezor` ⚠️ | 340 | 9 | 0 | 0 | 2026-07-16 | COMPILES | structural proof validation only. chains_to() returns None always; no t3w1 root published, no proof fixture. |
| 33 | `vocabulary` | 314 | 8 | 0 | 0 | 2026-07-20 | COMPILES | `vocabulary` — the project's naming-law lints, consolidated. The prose home is |
| 34 | `zano-watcher` | 410 | 6 | 0 | 0 | 2026-07-03 | COMPILES | Zano sense adapter — a **view-only wallet scanner**, not a block parser |

**Totals: 34 crates · 570 passed · 0 failed · 3 ignored** (`cargo test --workspace`, 2026-07-26, exit 0).

## 2. Trap crates — name implies a capability the code does not deliver

These are why designs get proposed for things that already "exist," and why they get proposed as *new* when a partial exists. None is defective; each is honest in its own module docs. The trap is the **name read from a directory listing**.

| crate | the name implies | what the code does |
|---|---|---|
| `adapter-arweave` | an Arweave client | Merkle bundler + MockArweaveClient. No real Arweave client; upload gates on credentials. |
| `adapter-autonomi` | Autonomi storage put/get | parses `antctl status` telemetry from a pinned fixture. It is node-ops read-out, NOT storage put/get. |
| `verify-trezor` | Trezor authenticity verification | structural proof validation only. chains_to() returns None always; no t3w1 root published, no proof fixture. |
| `bnr-shell` | a desktop shell | the D-14 frame + gauge wiring. No COSMIC view, no window (libcosmic deferred). |
| `mastery-ledger` | a permanent commons ledger | in-memory ledger; the commons anchor is an #[ignore]d test awaiting adapter-arweave. |
| `adapter-lti` | a live LTI 1.3 integration | mapping logic only; real LTI 1.3 AGS capture is an #[ignore]d test. |
| `type-bindings` | the shared canonical wire types | holds only `Did` (43 LOC). The 'canonical wire types' it names are still in shared-types. |

## 3. Stale doc claims found by this census

| document | claim | actual | status |
|---|---|---|---|
| `README.md` (3 places) | `180 passed / 0 failed / 1 ignored` | 570 passed / 0 failed / 3 ignored | **STALE** — corrected in this commit |
| `STATUS.md` evidence-tiers legend | `cargo test --workspace` → **179 passed; 1 ignored** | 570 passed; 3 ignored | **STALE** — the legend's own rule is that a count is stated as the command that produces it |
| `VERIFIED-FACTS.md` B15 / C-log | "README says 14 crates, tree has 35" | tree has **34** (`ls -d crates/*/ | wc -l`), workspace members **34** | **BOTH WRONG** — README states no crate count at all today; 35 is one over |
| `STATUS.md` 2026-07-04 entry | "**14 crates**, 146 tests" | dated historical entry, true when written | **NOT stale** — dated ledger lines record the number at their commit |

### The 3 ignored tests, each with its stated gate

| crate | test | gate |
|---|---|---|
| `chain-zano` | `composes_with_keys_module` | *"insert a verified end-to-end (seed → Zano view_public) vector before enabling"* |
| `adapter-lti` | `process_real_ags_capture` | *"waiting on C-5's real LTI 1.3 AGS capture"* |
| `mastery-ledger` | `real_commons_round_trip` | *"waiting on the L2 commons MasteryLedger (adapter-arweave anchor)"* |

All three are honest absences with named blockers, not skipped failures.
