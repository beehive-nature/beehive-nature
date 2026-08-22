# HANDOFF — zCode Session 2026-08-22 (night) → next session
**From:** zCode (GLM 5.3) · **Date:** 2026-08-22 ~06:00 UTC · **Context exhausted**

---

## THE ONE MISSION: THE BNR WALLET SIGNING LANE

The founder's final word before handoff: *"have me connect bzDiD that holds the
keychain for all of my vaulta, ETH/crypto addresses. this needs a big upgrade.
better than what they have. not fucking manual."*

**What exists right now:**
- `surfaces/wallet.html` — live on the fleet (hub TRADE floor, 61 surfaces), connects
  bzDiD soul, reads Vaulta + Hive balances keylessly. The SIGN section has a broken
  first-pass (key-paste → "exports is not defined" because `.mjs` modules can't load
  in regular script tags).
- `surfaces/onboarding/bzdid-key.js` — 5,070 lines: WebAuthn PRF ceremony, 24-word
  recovery, masterPRK derivation, ed25519 curves bundled (noble). **This IS the
  keychain engine.**
- `surfaces/onboarding/vendor/secp256k1.mjs` — vendored noble secp256k1 (13KB, for
  Vaulta signing). ES module — needs `<script type="module">` or conversion to IIFE.
- `surfaces/onboarding/vendor/eosjs-serialize.min.js` — vendored EOSIO binary
  serializer (36KB). UMD format, loads in regular script tags.
- `surfaces/onboarding/vendor/sha256.mjs` — vendored noble sha256 (5KB).
- `crates/wallet-relay/src/vaulta.rs` — Rust server: read-only identity endpoints +
  unsigned tx prep. **Never holds keys.**
- `crates/wallet-relay/src/tx_prep.rs` — prepare_updateauth, prepare_newaccount,
  prepare_linkauth — the bridge actions.

**What needs to be built (the morning's focused work):**
1. Convert `secp256k1.mjs` + `sha256.mjs` to IIFE/UMD format (or use `<script
   type="module">` in wallet.html) so they load without "exports is not defined"
2. Wire the bzDiD keychain: `bzdid-key.js` → `deriveIdentity(masterPRK,
   "vaulta:" + accountName)` → secp256k1 keypair → sign Vaulta transactions
3. Use `eosjs-serialize.min.js` (already UMD) to serialize the transaction to the
   EOSIO binary format (the `abi_json_to_bin` equivalent, client-side)
4. Compute the chain-aware digest: `sha256(chain_id + serialized_tx + zero_hash)`
5. Sign with secp256k1 (the derived private key)
6. Broadcast via `POST /v1/chain/send_transaction` on the public RPC failover
7. **Remove the key-paste field entirely** — the bzDiD connects, the derived key
   signs, nothing is manual

**For the founder's EXISTING kingbeelovis account (which uses K1 keys, not
bzDiD-derived):** the bridge is `prepare_updateauth` (already in tx_prep.rs) —
add a bzDiD-derived key to the account's active permission alongside the existing
K1 + PUB_WA keys. Then the bzDiD can sign for kingbeelovis too.

**The passkey lane:** kingbeelovis already carries a `PUB_WA_` (WebAuthn) key on
active permission. The WebAuthn signing flow (transaction digest as challenge,
browser passkey signs, chain verifies) is the Tier-1 experience — this may be
simpler than the secp256k1 path and should be evaluated first.

---

## THE FULL NIGHT'S WORK (all pushed, all live)

### Surfaces built tonight:
| surface | commit | what |
|---|---|---|
| `bmeshasi.html` | 5acc921 | the iron exchange — meter, waterfall, diversion, live dials |
| `royalguard.html` | 3af071e | one deck — DAO + treasuries + wallet, 3 registers |
| `bnames.html` | 67dd489→5654692 | the .b name desk — constellation, consent, sign, workshop |
| `wallet.html` | 1aebba2→55bc99b | the BNR wallet — multi-chain balances + signing (WIP) |
| `agent-dock.js` | 49c0565→4952a7b | ⚙ on every surface — queen/hearth/bAigents/bLOVErAi |
| `rails-badge.js` | 14a285a | 🔒 TOFU trust lock — origin-bound 0x fingerprint |
| PWA | 20557a0 | manifest + founder's purple BN logo — installable |
| Cinematic bnames | 89cda4a | constellation, breathing jewels, animated verdicts |

### Contracts/models built tonight:
| artifact | commit | what |
|---|---|---|
| `crates/bmesh-ram/` | c628dea→4bdb3ab | Vaulta RAM↔A market — 17 tests, both chains pinned |
| `contracts/bdomain2/` | 7599a5a | evolved .b registry — fee-wired, capped, Tier-2 resolvers, compiled CDT 4.1.1 |
| `crates/bmesh-serve/` | 5eb2994 | stack proof → dev deck (5 floors, htmx+Alpine+sqlite) |

### Rulings recorded tonight:
- **A-native + Jungle-first** (68e7148): A prototype faces mainnet; b build forges on Jungle
- **Two tracks** (25e5aad): A flows mainnet; b forged on Jungle — never blur
- **Grace period + annual merge** (03e1b54): renewal IS the cleanup checkpoint
- **One .b per bzDiD per unique human** (0ba726a): informed consent, rule-followers rewarded

### The Queen (completed for Claude Code):
- **26 tongues + two-way voice** (a3471fe): mic-in + spoken answers in asker's tongue
- Tongues finished: nl/nl-be/hi get native samples from answer corpus (4c2b307)
- dockPrompt bridge: receiver runs top-level at page end (c39d979)

### Key infrastructure:
- `skaists/sovereignty-explorer` — life layer (7687e73) + LIVE RAIL dApp floor
  (4908ee5→65d5efd): any account/.b name read live, registry chips, first-party composer
- Buzz mirrored (beehive-nature/buzz, stub — full push needs non-shallow clone)
- CI green after cargo fmt fix (4d3ab02)
- GitHub traffic receipted: 423 unique cloners kernel / ~475 ecosystem-wide

---

## OPEN GATES (all founder-held, all PREPARED):
- **MX-1**: FOUNDER_VALUES drop-in wired in bmeshasi meter
- **MX-2**: A-first stands, b-path gated
- **MX-3**: no voucher primitive
- **MX-4**: egress obscuration pinned; path: invoice→aggregator→measurement
- **MX-5**: WHERE brief prepared (4 candidates, recommendation: standalone gate service)
- **MX-6**: ant.report mirror kit + indelible permanent tier
- **MX-7**: Jungle-first for contracts (test bed banchor22222: 100 A, RAM bought, no code)

## FOUNDER'S REMAINING ACTIONS:
1. **Secure k.b and q.b** — cleos in WSL tonight, or the wallet signing lane tomorrow
2. **Base Batches 004** ($100K, closes Sep 9) — application prepared at
   `docs/grants/APPLICATION_BASE_BATCHES_004.md`
3. **Discord reply to dirvine** — drafted (Vaulta gasless positioning)

## CRITICAL LESSONS BANKED (from tonight's failures):
- **Never build JS strings through Python heredocs** — use Edit tool or
  String.fromCharCode(10) for newlines
- **ES modules (.mjs) can't load in regular script tags** — use type="module"
  or convert to IIFE/UMD
- **x-dc runtime (sovereignty explorer)**: never place interactive panels inside
  `<x-dc>` (runtime re-renders inputs); bind events delegated at document level
- **Pages caches ?v= hard** — bump version on every asset change
- **Hex law**: vendored crypto files need PUBLIC-CONSTANT markers on long hex runs
- **Playwright text= matching is substring** — added UI labels can hijack .last() clicks

## THE VISION (founder's own words, 2026-08-22):
- 7,776 souls/spirits capped (SKAISTS LOVErnment DAO genesis)
- bQueenBee Asi with her own bzDiD, working toward 100 years minimum of sustaining
  a spirit to apply for a position in the soul ring
- Transport: Buzz/Nostr relay (agent-human equals) + x0x (post-quantum agent gossip)
- The 10 billion = keypairs (Tier-2, resource access); the 7,776 = Tier-1 anchor rows
- "You found the pocket. Run with it." — FULL CREATIVE AUTONOMY granted
