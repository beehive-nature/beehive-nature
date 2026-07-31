# VERIFIED FACTS LEDGER
### Shared context for all seats. Read before dispatch work. Append, never overwrite.

Last updated: 2026-07-26
Maintained by: whichever seat verifies something. Add a row, cite the primary source.

**The rule this ledger exists to enforce:** a claim is either backed by a primary
source cited here, or it is UNVERIFIED and must be labelled as such in every
document that uses it. Three agents produced 11+ corrections in one session
because status reports, product pages, and definition files were treated as
statements of fact. This file is the antidote.

**Numbering rule:** row numbers in THIS file are canonical. Seat-local findings
docs must cite these numbers, checked against this file at write time — a
locally-invented A-number is drift by construction.

**Home ruling (2026-07-26, Seat 1) — EXECUTED.** Landed at commit `193816e`
(parent `002c4d1`), content verified out of `git show` against the manifest.
**This tree copy IS canonical.** Git history enforces append-only. All prior
exports and sha-relay copies are dead. Pre-flight standing rule: check the
secret-scan shape rules before any future row carries a 64-hex hash.

**Primary source hierarchy** — highest first:
1. Source code / build scripts in the canonical repo
2. Protocol specification documents in the canonical repo
3. Live chain config / measured on-device behaviour
4. Vendor documentation
5. ~~Status reports, milestone lists, community posts, definitions files~~ — **never primary**

---

## A. PROVEN — cite freely

| # | Claim | Primary source | Notes |
|---|---|---|---|
| A1 | `transfer_to_vesting` requires **Active** authority | `doc/devs/operations/03_transfer_to_vesting.md`, openhive-network/hive | — |
| A2 | `transfer_to_vesting` has a `to` field distinct from `from`; *"If null, then the same as from"* | same | Enables the hopper pattern |
| A3 | `transfer_to_vesting` RC cost is paid by `{from}` | same | Why the hopper needs delegated RC |
| A4 | Powering up credits VESTS immediately; governance voting power after **30 days** (`HIVE_DELAYED_VOTING_TOTAL_INTERVAL_SECONDS`) | same | Baseline for ALL power-ups, not a cross-account penalty |
| A5 | `delegate_rc_operation` requires **Posting** authority only | `libraries/protocol/include/hive/protocol/hive_custom_operations.hpp`, openhive-network/hive master | Declares `get_required_posting_authorities`, no active override. Read on GitHub mirror, not GitLab canonical — negligible risk on an HF26-era stable header, but noted |
| A6 | RC custom operation id is `"rc"` | `#define HIVE_RC_CUSTOM_OPERATION_ID "rc"`, same header | 2 chars, well inside the 32-char custom_json id limit |
| A7 | `delegate_rc.max_rc` is `int64_t` — an absolute ceiling, not a delta | same header | Re-delegation sets a new cap. 0 deletes the delegation — settled by A40 |
| A8 | `delegate_rc.delegatees` is a `flat_set` — multiple targets per operation | same header | One broadcast can provision hopper + sponsored accounts |
| A9 | Monero **is** compiled into every universal Trezor build incl. Safe 7 | `core/SConscript.firmware`: `USE_MONERO`, `apps/monero/*/*/*.py`, `vendor/trezor-crypto/monero/{base58,serialize,xmr}.c` | Absent from Suite, present on device. Template for Zano |
| A10 | `apps/eos/` is present in trezor-firmware `main`, gated to `TREZOR_MODEL == "T2T1"` | same build script | **Inclusion gate on T2T1**, not an exclusion clause on T3W1 |
| A11 | `apps/zcash/*` + `sign_tx/zcash_v4.py` + `enums/Zcash*` build for all universal models incl. T3W1 | same | Contents unread — see B2 |
| A12 | No RSA anywhere in `SOURCE_MOD_CRYPTO` | same | Arweave RSA-4096 is a missing primitive, not a build gate |
| A13 | `EXTAPP_SUPPORT` → `app_loading` + `ipc` features exist, gated to `T3W1` alone, backed by `embed/api/trezor_api_v1_impl.c` and `embed/upymod/modtrezorapp/` | same | **Existence proven. Meaning UNVERIFIED — see B1** |
| A14 | Nostr app is in-tree, gated to `PYOPT == '0'` (debug builds only) | same | Precedent: in-tree ≠ production-enabled |
| A15 | Trezor firmware is GPLv3; Suite/Connect are MIT | ZF grant text, corroborated by repo licensing | Clean split for the credible-exit posture |
| A16 | Trezor Safe 7 exists, launched late 2025, TROPIC01 + EAL6+ dual secure element | trezor.io/trezor-safe-7 | Model code T3W1 — strongly indicated by `CHANGELOG.T3W1.md` + BLE/power-manager features, **not** directly stated in a Trezor doc |
| A17 | Trezor Suite supports Zcash **t-addresses only**; z-addresses explicitly unsupported | trezor.io/coins/wallet/zcash | Product-level statement about Suite, NOT about firmware capability |
| A18 | Trezor publishes official instructions for installing custom firmware on Safe 7 | trezor.io/support/.../install-custom-firmware-on-trezor-safe-7 | Fork path is vendor-sanctioned |
| A19 | `phoenixd` exposes an HTTP API on `localhost:9740`, password auth, incl. `createinvoice` / `payinvoice` | ACINQ/phoenixd | Self-custodial but hot |
| A20 | Coinbase Lightning is live via Lightspark since mid-2024; sends primary, 0.1% fee, initial $2k cap, region-dependent | coinbase.com/blog | API exposure UNVERIFIED — see B3 |
| A21 | Zano's own roadmap lists hardware-wallet integration as *planned, no timeline* | zano.org/roadmap | Building it puts you ahead of the chain's schedule |
| A22 | Zcash shielded-on-Trezor was ZF/ZOMG funded: $130k / 13 months, SatoshiLabs + Tomas Krnak, per ZIP-305 | grants.zfnd.org | Funding is proven. **Delivery is not — see B2** |
| A23 | Zano host-side derivation proven against stock Zano v2.2.1.501 | committed test vector, `cargo test -p chain-zano`, both tests GREEN | Reproducible. Firmware app is the unstarted piece |
| A24 | Hive custom_json limits: 32-char id, 8KB payload | live chain config | Measured, not estimated |
| A25 | `apps/zcash/signer.py` hardcodes `nSpendsSapling=0`, `nOutputsSapling=0`, `nActionsOrchard=0` | `core/src/apps/zcash/signer.py`, main | **Firmware cannot construct a shielded bundle.** Not a Suite limitation |
| A26 | Zcash signer is `class Zcash(Bitcoinlike)`, requires `tx.version == 5`, uses `hash_zip244` | same | v5/ZIP-225 + ZIP-244 transparent only |
| A27 | Zcash unified-address handling extracts only transparent receivers; raises `DataError` if none present | same | Explains why `u...` addresses appear supported but aren't shielded |
| A28 | External apps are separate system tasks: `app_task_spawn`, `app_task_is_running`, `app_task_get_pminfo`, `app_task_unload`; content-addressed by `app_hash_t`; `TS_EINVAL` if image invalid | `core/embed/io/app_loader/inc/io/app_loader.h` | Real process isolation with postmortem capture |
| A29 | `trezorapp.load_file()` is `#ifdef TREZOR_EMULATOR` only | `core/embed/upymod/modtrezorapp/modtrezorapp.c` | On hardware apps enter via `create_image` into app cache |
| A30 | **API v1 grants external apps: process exit, `systick_ms`, `sysevents_poll`, `syshandle_read`, `dbg_console_write`, and five IPC calls. No crypto, no keys, no secure element, no display, no storage, no USB** | `core/embed/api/trezor_api_v1_impl.c` | The security model. An extapp cannot sign; it must ask the coreapp over IPC |
| A31 | API version negotiation exists: `coreapp_api_get(version)` returns NULL for unknown versions | same | Surface can grow past v1 |
| A32 | Tree has **34** crates (= workspace members); 570 tests pass / 0 fail / 3 ignored | `docs/TREE-CENSUS.md`, commit 9981f50; `cargo test --workspace` exit 0 | README said 14; dispatch premise said 35. Both wrong |
| A33 | 7 trap crates whose names overstate capability: `adapter-autonomi` parses `antctl` telemetry from fixture — **not** storage put/get; `adapter-arweave` is a Merkle bundler with mock client; `verify-trezor` never verifies a chain to a root; `bnr-shell` has no shell; `mastery-ledger` has no commons anchor; `adapter-lti` has no live capture; `type-bindings` holds one 43-line type | census, code seat 2026-07-26 | Three-tier storage is NOT partly built — see C-log. Each crate is honest in its own module docs; the trap is the name read from a directory listing |
| A34 | `EXTAPP_SUPPORT` defaults `'0'` (build flag, T3W1-gated). App image validation is ELF-structural only — no signature, no attestation; `app_hash_t` is lookup identity. `MAX_APP_LOADER_ENTRIES` = 1; images are RAM-resident, not flash | code seat source read, `app_cache.c` / build config | Containment-not-attestation is coherent *because* API v1 grants no crypto (A30) |
| A35 | **Coreapp defines no IPC service at all.** Transport is generic (`ipc_send`, opaque `fn` code); repo-wide search finds only infrastructure — no handler, no `fn` allocation, no signing endpoint, no first-party extapp example | code seat repo-wide search | **FORK-REQUIRED is operative** for any chain app that needs signing |
| A36 | PR #1847 **closed unmerged**; #2472 **open unmerged**. trezorlib 0.20.1 ships no zcash module and no `trezorctl zcash` subcommand (`monero.py`, `eos.py` present as controls) | PyPI wheel contents, PR states | Zcash shielded dead on both firmware and host sides |
| A37 | Safe 7 (`t3w1`) `authenticity.json` returns HTTP 404; `t3t1` returns 200 | verify-trezor audit | **No published production authenticity root for the Safe 7** — vendor omission, watch for publication |
| A38 | `claim_account` chain-observed cost: **10,612,635,408,352 RC** avg over 1,548 real ops (block 108,432,000). Treasury `max_rc` at 383 HP: **624,977,561,774** | `rc_api.get_rc_stats`, no key spent | **~17× the full mana bar. ACT capacity = 0.** Old ~56 estimate off ~950× |
| A39 | `transfer_to_vesting` chain-observed cost: ~120,419,799 RC | same | Trivial — hopper RC sizing is a non-issue |
| A40 | `delegate_rc` with `max_rc: 0` **deletes** the delegation; delegating 0 with no existing delegation **throws** | canonical hived test | Hopper tooling must query delegation state before revoking — blind revoke is a failed tx |
| A41 | Live `account_creation_fee` = **"3.000 HIVE"** | `condenser_api.get_chain_properties`, chain-connected seat, 2026-07-26 | Single-node read (corroborating node 502'd); witness-voted median — re-read before committing budget |
| A42 | Post-HF20 the creation fee is transferred to `@null` (**burned**) and its value converts at the vesting share price into the new account's `max_rc_creation_adjustment` — an RC floor the account keeps | `account_create_evaluator::do_apply`, `hive_evaluator_account.cpp`; field read live on an 8-year-old account (5,622,320,093) | Option 1 is a cost, not a transfer — but fee-created accounts arrive with a built-in RC baseline, trimming the immediate `delegate_rc` top-up |
| A43 | Post-HF20 the creation fee must be **exact** — over- or under-payment fails the transaction | same evaluator: "Must pay the exact account creation fee" | **Daemon requirement:** read the live median before every `account_create`; never hardcode 3 HIVE |
| A44 | `BLedger`'s only mint path is proof-gated: `mint(who, amount, at, proof, verifier)` with `UnprovenMint` refusal. No grant/airdrop mint. No emission schedule, epochs, or 420 constant anywhere in `b-token`/`treasury-t0`/`denomination` — supply law exists in backlog prose only | code seat read, `main @ 002c4d1` | Grant sizing is a green-field constants decision, not a read-off |
| A45 | Maturation schedule bounds **collateralization**, not transfer; D-14 displays b in function units | same read | Sybil inequality is carried entirely by grant sizing; the ~$10 bound is a sizing input, never a surface number |
| A46 | Autonomi put cost, measured live: 100 KiB = **0.10630 ANT + 0.00015 ETH gas**, 3 chunks, `priced_sample` confidence | `ant file cost`, live network, nothing spent | At plausible spots the Arbitrum gas leg rivals storage — the binding constraint. Demand-priced: BNRoSE re-quotes at onboard time (A43-class pre-flight). Dollarization pending a working price feed |
| A47 | `chain-eos` is **read-only**: SHIP codec + stream ingester. No transaction construction, no signing, no account creation, no write path | code seat read, same sha | Nothing in the tree can provision a Vaulta account or move a Vaulta-native asset today. G7's write side is new work on either branch |
| A48 | Host environment: Git for Windows' msys2 runtime is broken — `sh.exe`, `bash.exe`, `usr/bin/sha256sum.exe` fail with `STATUS_DLL_NOT_FOUND`. `git.exe` works, so hook-gated commits fail with exit 1 and **no output**; `.githooks/pre-commit` (`exec sh scripts/secret-scan.sh diff`) can never run. WSL git 2.53.0 runs the same hook clean | code seat diagnosis while landing `193816e` | **Blocks every hook-gated commit on this machine outside WSL, silently.** Working path: commit via WSL. Real fix: repair/reinstall Git for Windows. Do not use `--no-verify` as a workaround — it skips the named pre-flight. **SUPERSEDED by A49; retained because it was true when recorded** |
| A49 | **A48 no longer reproduces.** Git for Windows is now `2.55.0.windows.2`; `sh.exe`, `bash.exe`, `usr/bin/sha256sum.exe` all start and exit 0. `git hook run pre-commit` → exit 0; a no-op commit on a scratch branch succeeded Windows-side with the secret-scan gate running | Cowork W2, 2026-07-30 — raw probe + hook run in `docs/RECEIPTS-COWORK-2026-07-30.md` | **The WSL fallback is retired as a requirement.** Windows-side git is a working commit path again. Supersedes — does not delete — A48 |
| A50 | `esr:` protocol handler is correctly registered in BOTH `HKCU\Software\Classes\esr` and `HKCR\esr`, pointing at `C:\Program Files\Anchor Wallet\Anchor Wallet.exe`; no `UserChoice` override exists. Anchor version `1.3.12.0` | Cowork W1, `reg query` output, same receipt | **Rules out Windows association as the esr:// failure cause.** If links still fail the defect is inside Anchor's URL handling (greymass/anchor #958 lineage). Prompt-render itself remains UNVERIFIED — no visual receipt obtained |
| A51 | exSat EVM `eth_chainId` → `0x1c20` (7200), live, verified pre-connect | Cowork W3, `curl` POST to `https://evm.exsat.network` | Agrees with the C1 `verify_chain_id()` pin by construction. Re-verify before any signature per standing law |
| A52 | **`beehive-nature/beehive-nature` is a PUBLIC GitHub repo** (`"private": false`, `"visibility": "public"`) | GitHub API, Cowork push pre-flight 2026-07-30 | **Standing fact governing every commit.** Anything landed here is published. The secret-scan gate is the last line, not the only one — treat `docs/` as world-readable at write time, not at review time |
| A53 | **THP and EXTAPP are different layers and do not gate each other.** THP is the host↔device transport (Noise handshake, pairing, session); EXTAPP is on-device application loading (A28–A31, A34–A35). The EXTAPP read is complete and contains nothing that constrains the transport question | Seat-1 layer analysis over A28–A35 + the C1 receipt, 2026-07-30 | **Removes a false dependency.** "Rank-0 EXTAPP read may reshape both" does not hold for THP — that read is done and orthogonal. **Ruling 2 is unblocked and can be made now** |

---

## B. UNVERIFIED REGISTER — label as such wherever used

| # | Open question | Why it's load-bearing | Assigned |
|---|---|---|---|
| ~~B1~~ | ~~What `EXTAPP` is~~ | **ANSWERED 2026-07-26** → A28–A31. Verdict: `LOADABLE-APPS-CONFIRMED, NO-CRYPTO-IN-API-V1`. See `FINDINGS-2026-07-26.md` §2 | closed |
| ~~B1a~~ | ~~Coreapp IPC signing service?~~ | **ANSWERED** → A35. None exists. Hive/Zano signing requires coreapp changes: fork or upstream | closed |
| ~~B1b~~ | ~~Image validation~~ | **ANSWERED** → A34. ELF-structural only, no attestation | closed |
| ~~B1c~~ | ~~Production-enabled?~~ | **ANSWERED** → A34. Defaults `'0'` — Nostr precedent exactly | closed |
| ~~B1d~~ | ~~First-party extapp example?~~ | **ANSWERED** → A35. None found in-tree | closed |
| ~~B2~~ | ~~Zcash shielded reachability~~ | **ANSWERED 2026-07-26** → A25–A27. Verdict: `NOT-PRESENT` on main. Orchard shielded is not in the firmware; only v5/ZIP-244 transparent landed | closed |
| B2a | ZF grant final milestone status only — PR states are now A36 (#1847 closed unmerged, #2472 open unmerged) | Residual of a residual; the capability is absent from `main` regardless. Grant page was unfetchable when tried. Zero urgency | anyone, incidental |
| B3 | Is Coinbase Lightning withdrawal to an arbitrary BOLT11 exposed via API, or UI-only? | Decides whether pipeline leg 2 can ever be automated | **D-06 → bgoose** |
| B4 | Does v4v.app expose a documented public API today? | Decides whether pipeline leg 4 can be automated. Ask `@brianoflondon` directly — faster than searching | **D-06 → bgoose** |
| ~~B5~~ | ~~`claim_account` cost~~ | **ANSWERED** → A38. ACT capacity = 0 at 383 HP. Chain-observed n=1,548, stronger than a single broadcast | closed |
| ~~B6~~ | ~~`transfer_to_vesting` cost~~ | **ANSWERED** → A39. ~120M RC, trivial | closed |
| ~~B7~~ | ~~`max_rc: 0` revoke?~~ | **ANSWERED** → A40, from canonical test. Blind revoke throws | closed |
| B8 | Which account's `max_mana` increases on cross-account power-up | **DERIVED, not measured** — identity holds to the unit on 2/2 delegation-free accounts. The first real hopper→treasury broadcast confirms it for free: read `max_mana` on both accounts before/after | bgoose, during D-06 first run |
| B9 | Why was EOS gated to T2T1? | **ANSWERED (inferred) — defect ruled out.** Evidence (bgoose, 2026-07-26): EOS and NEM gated with the identical condition on adjacent lines of `SConscript.firmware`; additional T2T1-only gates (NEM includes, Decred) — one condition dropping multiple apps is systematic resource pressure, not per-app defects; GitHub issue search (21 "EOS" results) found no T3W1/Safe defect; issue #7041 ("Replace INTERNAL_MODEL checks with feature flags") treats model gates as resource management; 63 flash-related PRs. **Caveats:** (1) the gate is `== T2T1`, i.e. EOS is excluded from *all* post-Model-T devices — it predates the Safe 7, so "the Safe 7's SE consumed the flash" is narrative, not evidence; (2) the evidence rules out defect but does not discriminate flash budget vs. layout-port cost. **Promotion test:** build T3W1 with EOS enabled. Flash overflow → flash. Layout compile errors → port cost. Clean build that fits → gate was stale. Any of the three unblocks or kills D-07 decisively | pending build |
| B10 | Did Vaulta change chain-ID or tx format vs. 2018 EOS? | Decides whether `apps/eos/` serialization still applies | **D-07 → bgoose** |
| B11 | Safe 7 flash headroom for additional apps | Caps how many chains can ship on one device | **D-02 → code** |
| B12 | Does the dual secure element (TROPIC01 + EAL6+) constrain which curves/ops a new app may use? | Could block Zano/CLSAG regardless of B1 | **D-02 → code** |
| B13 | `hive-nectar` vs `beem` current maintenance status | Signing library choice for the hopper daemon | **D-06 → bgoose** |
| ~~B14~~ | ~~`verify-trezor` contents~~ | **ANSWERED** by D-04 (landed `977fa73`): structural proof validation, fail-closed, 9 tests, no `capability` overlap, no model hardcoding excluding the Safe 7, zero section-A contradictions. Produced A37 as a by-product. Row lagged its own answer — closed on the code seat's reconciliation flag | closed |
| ~~B15~~ | ~~Tree vs docs~~ | **ANSWERED** → A32, A33. 34 crates, census at `docs/TREE-CENSUS.md`, README fixed. Premise of this row was itself wrong (35) | closed |
| ~~B16~~ | ~~Live creation fee~~ | **ANSWERED** → A41. "3.000 HIVE" verbatim from live config | closed |
| ~~B17~~ | ~~Fee destination~~ | **ANSWERED** → A42, A43 (tier-1, evaluator source). Burned to `@null`, grants RC floor, must be exact | closed |

---

## C. CORRECTIONS LOG — do not regress

| What was believed | Why it was wrong | Correct source |
|---|---|---|
| Trezor supports EOS/Vaulta natively on Safe 7 | Read `connect.trezor.io/9/data/coins.json` as a support list. It is a **definitions** file carrying legacy entries | `core/SConscript.firmware` build gates |
| Trezor has never supported Monero, so no Monero path for Zano | Read the Suite product surface as device capability — the same error, one layer up | `USE_MONERO` + `apps/monero/` in the build script |
| Zano works on Trezor "via the Monero path" | Two contradictory cells in one table ("❌ not in list" / "✅ confirmed working") were not reconciled | Zano roadmap: planned, no timeline |
| Zcash on Trezor is fully native | Conflated firmware-level and Suite-level support | trezor.io: t-addresses only |
| Zcash shielded firmware is COMPLETE | A milestone status list was read as a shipped state | **A25 — the signer hardcodes all shielded bundle counts to zero** |
| Zcash shielded is "the highest capability-per-effort item — write host code only" | Mine. I hedged the delivery claim in prose, then ranked it #1 as if I hadn't. A hedge that doesn't change the ranking isn't a hedge | A25–A27 |
| EXTAPP might make the custody model "all hardware except Arweave" | Mine. Inferred capability from the existence of a loader without reading what the API grants | A30 — API v1 has no crypto at all |
| "`chain-eos` is PROVEN per census so the adapter exists" (G7, and the "strengthens D-07" note) | Mine — and made *after* the trap-crate lesson was already in this file. PROVEN-for-reading is not capable-of-writing; I cited the census's maturity grade as if it covered a capability the census never tested | A47 — read-only, no write path. D-07's hardware-signing case presumed a software signing path that doesn't exist yet |
| `delegate_rc` authority unknown / possibly Active | Searched `hive_operations.hpp`; the op lives in `hive_custom_operations.hpp` | A5 |
| Three-tier storage (Hive/Arweave/Autonomi) is a new design | Docs are behind the tree; `adapter-autonomi` already exists | **This correction was itself wrong.** `adapter-autonomi` parses `antctl` telemetry, not storage put/get (A33). The original "new design" framing was right. A correction based on a directory name is still a directory-name claim |
| Codebase is 35 crates (dispatch premise, B15) | A user-relayed count was propagated into a dispatch without verification | A32 — 34, counted programmatically |
| ACT capacity ≈ 56 claims | Estimated from cost at a different HP level | **A38 — capacity is 0.** Cost estimate was off ~950×, worse than the prior 8–370× record |
| Codebase is 14 crates | README stale | 34 crates in `crates/` (A32) |

**The pattern in every row: the right repo, the wrong artifact.** Before citing
anything, ask which file in this repo is *authoritative for this question* — not
which file is easiest to find.
