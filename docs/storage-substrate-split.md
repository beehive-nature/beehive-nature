# Storage substrate — Arweave vs Autonomi

<!-- 5 agents. NOTE: Autonomi 2.0 (relaunched 2026-04-07) is immutable chunks
     only; Pointer/Scratchpad existed in maidsafe/autonomi 0.10.2, archived
     2026-05-22. Mutability comes from x0x (saorsa-labs), a separate network. -->

# BNR Storage Substrate Split — Decision

**Measurement date: 2026-08-04.** ANT = $0.031231, AR = $1.84. Three facts below were re-verified live during this write-up because two of the input measurements contradicted each other on the single most load-bearing point. See §2.

> **CORRECTED 2026-08-21** per deck-clear order (founder word), source
> `docs/dispatches/RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md` (on-chain receipts: 150
> decoded payment-vault txns, Arbitrum One). Three inputs were stale, now fixed in place:
> **batch width 256, not 64** (64 is the Merkle *threshold*; width = `MAX_LEAVES = 2⁸`,
> `evmlib/src/merkle_batch_payment.rs:26`, splitting verbatim at `ant-core merkle.rs:358-378`);
> **per-batch gas ~$0.040 all-in, not $0.25** (measured 1.606e-5 ETH per 256-chunk Merkle
> batch at 0.02 gwei, L1 poster fee included); **live per-chunk storage ~0.085 ANT ≈
> $0.0035, not the $0.000122 formula floor** (median of 150 on-chain payments — the network
> now prices near the old n≈12k formula row). §1's crossovers, the verdict table, §3, and
> §6's debt table are recomputed below. **The 256 KiB routing rule survives** — more
> conservative than ever, since the live crossover moved *up* to ~163–198 KiB.

---

## 0. The correction that reorders everything

The `mutable-primitives` measurement and the `ant-cli` audit disagree about whether Autonomi has Pointer/Scratchpad. I resolved it against primary sources today:

| Source | Result |
|---|---|
| `docs.rs/ant-core` v0.5.1, published **2026-07-29**, `MIT OR Apache-2.0` | modules: `config`, `data`, `datamap_file`, `error`, `node`, `update`. **No Pointer, Scratchpad, Register, GraphEntry.** |
| `ant_core::data::client::Client` full public API (60+ methods) | chunk / file / data / batch / payment / quote. **No `pointer_*`, `scratchpad_*`, `register_*`, `graph_*`.** `chunk_exists` **does** exist. |
| `docs.autonomi.com/developers/core-concepts/data-types` | Types: Public data, Private data, Chunk, File, DataMap. Verbatim: *"This is why Autonomi is immutable rather than update-in-place."* |

The `mutable-primitives` research was correct **about the archived generation** — `maidsafe/autonomi` `autonomi` 0.10.2, GPL-3.0, last published 2026-02-12, repo archived 2026-05-22. Everything it says about `pointer_update` being free is true of a codebase that is no longer the network.

**On the live Autonomi 2.0 network (relaunched 7 April 2026), Autonomi is immutable content-addressed chunk storage and nothing else.** Treat the Pointer/Scratchpad analysis as historical. It is not a design option today.

---

## 1. The split

### The rule an implementer follows

```
route(payload):
  if payload must be resolvable by an unmodified browser over plain HTTP
      -> ARWEAVE (Autonomi has no public HTTP gateway; see §7 R6)
  else if size >= 256 KiB
      -> AUTONOMI
  else
      -> ARWEAVE, ANS-104 bundled, signature type 2 (Ed25519)
  and: identity / DID-log payloads ALWAYS -> ARWEAVE primary, Autonomi mirror
```

**256 KiB is the operating threshold, not the naive crossover.** Three crossovers exist and they differ by 40×, because Autonomi's Arbitrum gas is a fixed per-batch cost that the token price alone hides.

### The measured crossovers

Autonomi price is **flat per chunk up to 4 MiB**:
`price_chunk_ANT(n) = 0.00390625 + 0.03515625 × (n/6000)²`

| node fullness | ANT/chunk | USD/chunk |
|---|---|---|
| n=0 (empty) | 0.00390625 | $0.000122 |
| n=6000 (half) | 0.0390625 | $0.001220 |
| n=12000 (full) | 0.14453125 | $0.004514 |

Arweave bundled is **linear**: 10,057 winston/byte = **$1.85049 × 10⁻⁸/byte**, plus a fixed ANS-104 header — **1,081 B measured with RSA-4096**, **~116 B with Ed25519 (sig type 2)**.

Setting them equal, `S = P_chunk_USD / 1.85049e-8 − H`:

| scenario | n=0 | n=6000 | n=12000 |
|---|---|---|---|
| **(a) token cost only, gas ignored** | 5,512 B | 64,847 B (63 KiB) | 242,835 B (237 KiB) |
| **(b) bulk campaign, gas amortized over 256-chunk Merkle batches** (+$0.000158/chunk, measured 2026-08-21) | 15,020 B (15 KiB) | 74,356 B (73 KiB) | 252,363 B (246 KiB) |
| **(c) one isolated small upload = one Arbitrum tx** (+$0.0084, a 3-chunk quotes tx measured 2026-08-21) | 475,721 B (465 KiB) | 653,728 B (639 KiB) | 1,187,749 B (1.13 MiB) |

Row (a) is the number the naive comparison produces and it is **wrong** for real workloads. Corrected gas: a measured $0.0405 per 256-chunk Merkle batch is **$0.000158/chunk** — ~1.3× the n=0 formula floor, but at the **live** per-chunk quote (~$0.0035) gas is **~4%** of all-in cost: **ANT, not gas, is the dominant term on the Autonomi side at every measured price today.** Gas only dominates sub-batch isolated uploads priced at the formula floor. (At live prices the (b) crossover sits at ~163–198 KiB and (c) at ~0.9–1.0 MiB.)

Ed25519 headers shift row (a) up by 965 B (5,512 → 6,477 at n=0); the effect is negligible above 64 KB.

**256 KiB is chosen as the rule because it stays above the crossover at every plausible node fullness and is conservative** — it never routes a payload to Autonomi that Arweave would have carried cheaper, in exchange for occasionally overpaying slightly on payloads just under the rule. Corrected 2026-08-21: the (b) band now spans 15 KiB (formula n=0) to 246 KiB (n=12000) with live prices at ~163–198 KiB, so 256 KiB remains on the safe side with a thinner margin (198→256 KiB vs the old 211→256 KiB). It coincides with Arweave's own L1 minimum chunk, which is a convenience for reasoning, not a derivation.

### Verdict on the founder's instinct: **CONFIRMED, with the crossover measured**

"Autonomi publi too (especially for larger file sizes)" is correct and the advantage is large and widens without bound.

| payload | Autonomi n=0 (+gas) | Autonomi n=6000 (+gas) | Autonomi **live, measured 08-21** | Arweave bundled (Ed25519) | Arweave +35% Turbo top-up |
|---|---|---|---|---|---|
| 300 B | $0.00028 | $0.0014 | $0.0119 (isolated tx) | **$0.0000077** | $0.0000104 |
| 10 KB | $0.00028 | $0.0014 | $0.0119 (isolated tx) | **$0.000188** | $0.000254 |
| 256 KB | **$0.00028** | $0.0014 | $0.0119 (isolated tx) | $0.00474 | $0.00640 |
| 4 MiB | **$0.00028** | **$0.0014** | $0.0119 (isolated tx) | $0.0776 | $0.1048 |
| 100 MB (25 chunks) | **$0.0070** | $0.0345 | **$0.140** (one quotes tx) | $1.940 | $2.619 |
| 1 GiB (256 chunks) | **$0.0717** | **$0.3528** | **$0.939** | $19.87 | $26.82 |
| 1 TiB | **$73.4** | **$361.3** | **$961.3** | $20,346 | $27,467 |

(Formula columns use the corrected $0.000158/chunk amortized Merkle gas; the live column uses the measured 0.0848 ANT/chunk median at ANT $0.0414 with the measured $0.0405/batch — sub-threshold payloads pay an isolated quotes tx, ≥64-chunk payloads ride 256-chunk Merkle batches.)

At 1 GiB, Autonomi is **~21× cheaper** all-in at live prices (not the 636× the token price alone suggests — but also no longer "gas eats most of the margin": at live quotes gas is ~4%). Against **raw Arweave L1 with no bundler**, Autonomi wins at every size, because L1's 256 KiB minimum chunk means a 300-byte record costs $0.0049. The crossover exists only because ANS-104 exists.

**~~Uncertain~~ RESOLVED 2026-08-21 (receipt, no funded run needed):** the batch width is **256** — `MAX_LEAVES = 2^MAX_MERKLE_DEPTH`, `MAX_MERKLE_DEPTH = 8` (`evmlib/src/merkle_batch_payment.rs:26`); the on-chain `PaymentVaultV2` caps depth at 12 but the client self-caps at 8. The Merkle *threshold* is 64 (`ant-core/src/data/client/merkle.rs:38`). The $0.25/batch doc datapoint is superseded by the measured **$0.0405 all-in** per 256-chunk batch (gas 0.02 gwei, L1 poster fee included, Arbiscan-cross-checked). Live per-chunk quote observed at **0.0848 ANT median** across 150 on-chain payments — the network now prices near the formula's n≈12k row, not n=0.

**Neither substrate touches Vaulta's 70.90 GiB.** Arweave is its own chain; Autonomi is a DHT, not a chain. The only thing that ever needs Vaulta is the name→key binding (§5, item 12).

---

## 2. Mutability is the real axis — and Autonomi loses it

**Plainly: no. Autonomi does not offer a self-authenticating mutable object controlled by the user's key. Not today, not on the live network.**

The archived generation did. `Pointer` was addressed at the owner's BLS public key, carried a `u64` counter with highest-wins resolution, was verifiable by any reader against the owner's signature alone, and — the seductive part — `pointer_update` was documented as *"free as the pointer was already paid for at creation."* That is exactly the primitive `RootIdentity` was reaching for when `crates/onboarding/src/lib.rs:59-67` describes the DID as *"the stable identifier every record keys off."*

It is gone. `ant-core` 0.5.1's `Client` has no method that writes a mutable record. `WithAutonomi/ant-protocol` defines `ChunkMessage`, `ChunkPutResponse`, `ChunkGetResponse`, `DataChunk`, `PaymentProof` — no mutable record type. The `ant` CLI's subcommands are `Node`, `Wallet`, `File`, `Chunk`, `Update`.

**Consequence: the premise that Autonomi is the mutable rail and Arweave the immutable one is obsolete.** Both rails are immutable content-addressed append-only stores. They have identical update semantics. There is no mutability axis between them to split on — which is why §1's rule splits on size and read-path instead.

### Two things worth knowing even if pointers come back

**(i) "Free updates" was never free.** A Pointer update is free, but the *new target chunk* is a fresh paid chunk put plus fresh Arbitrum gas. At 10B users × 1 update/year that is ~$3.51M ANT + ~$0.16M gas annually at live receipts regardless of the free pointer move (§3; the stale inputs had this as $1.22M + $39M — the ANT leg roughly tripled, the gas leg collapsed 247×). Only **Scratchpad** — where the mutable content lives *inside* the paid object — gave genuinely free updates, and Scratchpad was always-encrypted with no documented public-read flag, which a world-readable `.b` record cannot use. The free-update argument was weaker than it appeared even in the generation that had it.

**(ii) Autonomi never solved name→key.** A Pointer is found by *public key*, not by the string `alice.b`. Self-authentication once you know the key is not identity. That gap is unchanged and is the real architectural hole (§5, item 12).

### What replaces it

Mutability moves **up a layer**, into a hash-linked append-only log — `did:webvh`'s `did.jsonl`. Both substrates then do what they are actually good at: storing immutable append-only content. Latest-wins is not something BNR invents and readers must trust; it is a hash chain each reader verifies for themselves, with the head reachable independently through either rail. This is strictly stronger than "BNR-authored latest-wins indexer over Arweave txids," which is a centralized component wearing a decentralized costume.

---

## 3. The 10B cost table

10 × 10⁹ identity records, 300 bytes each.

### Autonomi — **UNAFFORDABLE, AND UNEXECUTABLE** *(recomputed 2026-08-21; verdict unchanged, the load-bearing wall moved from gas to supply)*

```
storage:  10e9 records × 1 chunk × 0.0848 ANT (live median, 08-21) = 84,800,000 ANT
                                × $0.0414                    = $3,510,720    (live regime)
          (2026-08-04 formula n=0 floor: 39,062,500 ANT = $1,219,961 — the floor
           is not the market; observed pricing now sits near the n≈12k formula row)
gas:      10e9 / 256 chunks-per-batch = 3,906,250 Merkle batches
                                × $0.0405 (measured)         = $158,090
                                                               -------------
                                                          TOTAL ~$3.67M
          (stale inputs had this at ~$40.3M: 64-wide batches × $0.25 = $39.06M gas)
```

Three independent walls, any one of which is fatal:

1. **84.8M ANT is 24.8% of the entire 341.57M circulating supply** at the *live median* quote (the stale floor said 11.4%), against a **$10.67M market cap** and **$341,118/day volume**. Acquiring it is **10,290 days ≈ 28 years of total global ANT trading volume** ($3.51M / $341,118). The nominal number is fiction — slippage is the entire cost.
2. **At n=6000 the formula requirement is 390,625,000 ANT — more than all the ANT that exists**, and observed pricing already sits near that regime. Unbuyable at any price.
3. **Capacity: 10e9 records ÷ 6,000 records/node × 5 close-group replicas = 8.33M nodes** for identity records alone. Reported node counts have ranged 8K–175K. Short by **48× to 1,000×**. This wall does not move with price.

### Arweave (ANS-104 bundled) — **AFFORDABLE**

```
Ed25519 (sig type 2, 116 B header):
  10e9 × (300 + 116) B = 4.16 TB
  4.16e12 B × 10,057 winston/B = 4.1837e16 winston = 41,837 AR
  × $1.84                                          = $76,980
  × 1.35 Turbo crypto top-up                       = $103,923

RSA-4096 (1,081 B header):
  10e9 × 1,381 B = 13.81 TB → 138,889 AR           = $255,556
  × 1.35                                            = $344,999
```

41,837 AR is **0.064% of circulating supply** and **~1.5% of one day's $5.07M volume**. (The economics measurement's "two weeks of daily volume" for the RSA figure is also a slip: $255,556 / $5.07M = **5% of one day**.) This is a rounding error in the AR market and it is a **one-time, permanent, ~200-year-prepaid** cost.

**The Ed25519-vs-RSA choice is a 3.3× lever on the largest line item in this system.** It is the highest-leverage single change available.

### One update per user per year

| substrate | annual cost | verdict |
|---|---|---|
| Arweave bundled, Ed25519 | 4.16 TB/yr → **$76,980/yr** (+35% = $103,923) | affordable, permanent, scales |
| Arweave bundled, RSA-4096 | 13.81 TB/yr → **$255,556/yr** | affordable, 3.3× wasteful |
| Autonomi 2.0 (immutable — the live network) | **~$3.67M/yr** at live receipts (ANT-dominated; gas ~$158K) | **unaffordable** |
| Autonomi + hypothetical Pointer (does not exist) | still **~$3.67M/yr** — free pointer move, paid new target chunk + gas | unaffordable even so |
| Autonomi + hypothetical Scratchpad (does not exist) | ~$0.16M/yr gas for updates, but ~$3.5M creation and always-encrypted | blocked at creation and at read |

**Bottom line: Arweave carries identity at $77K/year. Autonomi cannot carry it at any price — the ANT purchase is a quarter of all ANT that exists at live quotes and the node fleet is 48–1000× too small. Gas, the old headline wall, is now a rounding error (~$158K/yr); the supply and capacity walls are why this verdict survives the correction.**

**~~Uncertain~~ PINNED 2026-08-21:** the receipt settled both inputs — width **256** (source-pinned, `evmlib` `MAX_LEAVES = 2⁸`) and **$0.0405/batch measured all-in** (L1 poster included, Arbiscan-cross-checked). The gas leg of §3 is therefore **~$158K**, not $39M; the ANT leg at the live 0.0848 ANT/chunk median is **~$3.5M**. The supply and capacity walls stand regardless — this was the "pin this number before anyone re-litigates Autonomi as an identity rail" demand, and it is now pinned with tx receipts.

---

## 4. `did:autonomi` — not real, and now doubly blocked

**It does not exist.** No entry in the W3C DID Extensions: Methods registry. No draft spec anywhere. Web search for `"did:autonomi"` returns **zero hits** — no repo, no forum post, no gist. No DIF Universal Resolver driver. Repo-wide grep in `beehive-nature` returns **only test string literals**, and their shape is the tell: `did:autonomi:earner-1`, `did:autonomi:a`, `did:autonomi:stranger-9` — hand-assigned sequence labels, not hashes or multibase keys. **No derivation rule was ever chosen, so there is nothing to specify.**

Two traps: the registered `did:safe` is **Gnosis/Safe Ecosystem Foundation** via Ceramic CIP-101, *not* MaidSafe — do not cite it as precedent. `arweave` appears only inside the `zk` method's registry field.

**It is now blocked at the substrate too.** The only coherent construction — DID document in a mutable object addressed by the root key — required Pointer or Scratchpad. Those are gone (§2). Building `did:autonomi` today means writing a full DID Core §Methods spec (ABNF, CRUD, security/privacy), *plus* a `did:webvh`-style hash-linked log layered over immutable chunks, *plus* a Universal Resolver driver, *plus* a gateway — and the log design would be `did:webvh` reimplemented with worse interop.

Cautionary precedent: **`did:ion` is dying.** It is the closest architectural analogue — a DID anchored to a decentralized store — it was W3C-registered, universal-resolver-supported, and Microsoft-sponsored, and Microsoft has **removed it as a trust system from Entra Verified ID**, leaving only `did:web`, with a published migration path off it. Stated reason: little uptake. Proposing an *unregistered* anchored method for 10 billion users should price that in.

### Options

| | spec work | resolver work | substrate work | interop day 1 |
|---|---|---|---|---|
| **A** — adopt `did:webvh` as root | **zero** | low (`didwebvh-rs`) | none | full (DIF) |
| **B** — `did:webvh` root, log mirrored to Arweave + Autonomi | **zero** | low | **BNR's existing immutable chunk put is the correct primitive** | full |
| **C** — specify `did:autonomi` | high | high | high (and blocked — no mutable type) | **zero**, probably forever |
| **D** — do nothing | — | — | — | — |

### Recommendation: **Option B**

- **Identity root = `did:webvh`.** `did:web` + a self-certifying identifier (SCID) + a hash-chained `did.jsonl` log signed by independent update keys. Self-custodial, so it satisfies the Constitution's objection to `did:plc` at `crates/onboarding/src/lib.rs:96-105` (*"a rogue PDS operator could overtake your account"*) — that objection indicts PLC's **operational custody**, not its cryptographic design, and `did:webvh` keeps the design while removing the custodian.
- **BNR already has the seam.** `crates/atmirror/src/did.rs`: `DidDirectory` trait at `:54`, `HttpDirectory` at `:87`, the `did:web` branch at `:91` is ~6 lines from being a `did:webvh` branch. Working `did:plc`/`did:web` resolution already exists; this extends it rather than replacing it.
- **`anchored` becomes durability, not identity.** Arweave primary (small, cheap, plain HTTP GET), Autonomi mirror for anything ≥256 KiB per §1. The log is self-verifying regardless of who hosts it, so identity depends on **neither** substrate's availability. This is the only option where `AntCli::put`'s immutable chunk put is the *right* primitive — a `did.jsonl` log is append-only by construction.
- **This satisfies "decentralized, automatic, autonomous"** in a way an unverified `ant --json` parse feeding a caller-asserted boolean does not.

### Option D is not an option, it is the current state — and it is the load-bearing weakness

`reachable_grade` (`crates/onboarding/src/lib.rs:314-318`) gates Settlement adoption on:

```rust
Some(b) if enrolment.root.anchored && b.is_settlement_grade()
```

`anchored: bool` is caller-asserted with nothing behind it. **The `GradeDisclosure` unforgeable-witness pattern at `lib.rs:321-328` is genuinely well-built, and it is currently protecting a value that means nothing.** The strongest structural argument in the crate is load-bearing on the weakest fact in the crate.

The fix is to make `anchored` the same shape as the thing next to it: replace the bool with a constructor-private witness carrying `{ scid, log_head_hash, arweave_txid, autonomi_address, verified_at }`, constructible only by a verifier that actually fetched and checked the chain. Same pattern, one file over.

---

## 5. What must be built

### A. Port work — replace the `ant` subprocess with the Rust crate (`crates/atmirror`)

**The license gate is gone.** `crates/atmirror/src/autonomi.rs:3-9` justifies the subprocess boundary entirely on *"the `autonomi` crate is GPL-3.0 and this workspace is AGPL-3.0-only."* The live library is **`ant-core` 0.5.1, `MIT OR Apache-2.0`**, published 2026-07-29 — permissively compatible with AGPL-3.0-only. The D-2 deferral is **moot**. `ant-cli` is a thin shell over `ant-core`; there is nothing the subprocess can do that linking cannot.

1. **Add `ant-core` 0.5.1 as a dependency; delete `AntCli`.** (`autonomi.rs:25-55`)
2. **Delete `extract_address` and its tests.** (`:71-88`, `:151-172`) `chunk_put` returns a typed `XorName`. Scraping human-readable stdout for ≥64-char hex tokens stops being a thing BNR does.
3. **Implement `probe` via `chunk_exists`.** Currently a hard `Err(Unsupported("existence probe"))` at `:140-144`. Real idempotency, verified today as present on `Client`.
4. **Delete the temp-file round-trip.** (`:96-105`, `:113-117`) Use `data_upload(Bytes)` / `data_download(&DataMap)`. This kills the `put-<bytes.len()>.bin` collision at `:98` — two puts of different content with identical length in one process currently collide on one path — and the `std::process::id()` PID-reuse hazard.
5. **Fix the private-by-default bug — this is a correctness defect, not a port.** `put()` never passes `--public`; **both** CLI generations default to a **private** upload, where the retrieval handle is a `.datamap` file on the uploader's disk and `atmirror` deletes its temp dir. Every object BNR believes it mirrored may be unretrievable by anyone else. Use `file_upload_public_with_mode` / `*_prepare_upload_with_visibility`.
6. **Fix `get()`'s destination argument.** `ant file download <addr> <dest>` passes the destination positionally (`:117`); the live CLI takes `-o <FILE>`. Moot once linked, but confirms the current code cannot have worked.
7. **Cross-check the address locally** via `ant_core::data::compute_address` (BLAKE3). Today `arweave.rs` honours `rail.rs:1-5`'s promise (*"every put's returned address is cross-checked"*) via local DataItem id vs bundler with `AddressMismatch`; `autonomi.rs` **cannot** and takes whatever hex the CLI printed. So `AutonomiAnchor { address, sha256, byte_length }` at `mirror.rs:309-313` records an address of unverified provenance next to a locally-computed sha256 — **only half the receipt is trustworthy.** This closes it.
8. **Decide key custody explicitly.** `ant-core` takes a `Wallet` via `.with_wallet()`; the CLI requires `SECRET_KEY` in the environment. The header claim at `autonomi.rs:13-14` — *"uploads cost ANT via the wallet configured in `ant` itself; this tool holds no key"* — describes a wallet model that **does not exist in either generation**. This is an unaddressed design hole, not a parsing bug, and it must be resolved before any funded run.
9. **Fix the error surface.** `RailError::Rejected { status }` coerces a process exit code into a u16 that `Display`s as `"HTTP {status}"` (`rail.rs:36-38`) — a clap usage error renders as *"rail rejected upload: HTTP 2"*. Disappears with the port; make sure the replacement doesn't reintroduce it.

### B. Genuinely new work

10. **`did:webvh` resolution** — extend `DidDirectory` (`crates/atmirror/src/did.rs:54`) and `HttpDirectory` (`:87`); the `did:web` branch at `:91` is the seam. `didwebvh-rs` exists on docs.rs. *(crate: `atmirror`)*
11. **DID-log writer** — `did.jsonl` generation, SCID derivation, update-key signing, hash-chain append. Nothing in the repo does this. *(new crate, or `crates/onboarding`)*
12. **Anchor verifier + witness type** — replace `anchored: bool` (`crates/onboarding/src/lib.rs:59-67`) with a constructor-private witness mirroring `GradeDisclosure` (`:321-328`), so `reachable_grade` (`:314-318`) gates on something a caller cannot fabricate. **This is the piece the Settlement gate actually needs.** *(crate: `onboarding`)*
13. **Ed25519 ANS-104 signatures** — confirm whether `crates/atmirror/src/arweave.rs`'s `deep_hash` / DataItem construction uses RSA-4096 or sig type 2. If RSA: switching is **3.3× off the largest cost line in the system** ($255,556 → $76,980 at 10B records). *(crate: `atmirror`)*
14. **Mirror-fanout policy engine** — implement §1's routing rule with the crossover formula as a configurable, re-measurable constant rather than a magic number. *(crates: `atmirror` — `rail.rs` / `mirror.rs`)*
15. **Name → key resolution (`alice.b` → DID).** **Neither substrate solves this and it is the real architectural gap.** Sketch: one 32-byte Merkle root per epoch committed to Vaulta + off-chain inclusion proofs — 1 root/hour = 8,760 × 32 B = **280 KB/year on-chain**, comfortably O(1) against the 70.90 GiB budget. Out of scope for the storage split, but it blocks the product and nothing above unblocks it.

**Note the shape:** items 1–9 are a mechanical port that deletes more code than it adds. Items 10–15 are where the design lives. The port should not be allowed to feel like progress on the design.

---

## 6. The verification debt — settleable for under $2

Everything BNR believes about Autonomi's interface has been inferred from docs, never observed. One funded upload ends this.

### What one funded run settles, definitively

| Question | Current state | Predicted answer |
|---|---|---|
| Which `ant` generation is on the host? | unknown | Gen-2 (ant-core-backed) if freshly installed; Gen-1 0.5.2 GPL if from crates.io |
| Does `--json` exist as a global flag before the subcommand? | assumed (`autonomi.rs:106,117`) | yes on Gen-2, **no on Gen-1** (fails at arg parsing, never touches network) |
| Exact JSON schema | assumed: one ≥64-hex token | `address`, `datamap`, `store_durations_ms`, `retries_histogram`, `chunk_attempts_total` — **≥2 hex tokens → `extract_address` returns `Unparseable`** |
| Is default upload private? | never considered | **yes** — `address` is null, handle is a local `.datamap` file |
| Does `--public` yield a resolvable non-null address? | never tested | yes |
| Does `file download` require `-o`? | assumed positional | **yes, `-o`** |
| Is `SECRET_KEY` env required? | crate claims "holds no key" | **yes** — settles the custody hole (item 8) |
| Real per-chunk quote in ANT | formula only | **SETTLED 2026-08-21 from the on-chain record: 0.0848 ANT median** (range 0.025–0.148 across 150 payments) — observed pricing sits near the n≈12k formula row |
| Real Arbitrum gas per upload tx, and per-chunk amortized | one doc datapoint | **SETTLED 2026-08-21: $0.0405 per 256-chunk Merkle batch all-in** ($0.000158/chunk amortized; isolated 3-chunk quotes tx $0.0084) — §3's gas leg is ~$158K |
| Actual Merkle batch width | undocumented above 64 | **SETTLED 2026-08-21: 256**, source-pinned (`MAX_LEAVES = 2⁸`, client-capped; on-chain contract would allow 2¹²) |
| Does `chunk_exists` work against the live network? | verified in API only | yes |

### Cost of that run

Upload three objects — 300 B, 1 MiB, 8 MiB (1 + 1 + 2 chunks = 4 chunks), one public and one private for comparison, then download each back.

```
storage:  4 chunks × $0.0035 (live median)   = ~$0.014
gas:      ~4 Arbitrum txs × $0.0084 (measured) = ~$0.034
                                               ---------------
                                    expect  < $0.05 total
```

**Fund with ~$25 of ETH on Arbitrum One and ~$10 of ANT** (ANT contract `0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684`, Arbitrum One) and expect to spend under $2 of it. This is the cheapest high-value action on the entire list and it has been an open unknown for months. **Note it requires a funded key in the environment — do not run it until item 8's custody boundary is decided and reviewed.**

### The second debt: price volatility

ANT ranged **17× peak-to-trough in 18 months** — ATH $0.3307 (Feb 2025) → ATL $0.01935 (Dec 2025) → $0.0312 today, **−91% from ATH**. The chunk price is a **hard-coded ANT constant with no oracle** — Autonomi's own docs present this as a feature ("without requiring external price oracles"). It means **USD cost is pure token beta**: if ANT 10×s, storage is 10× more expensive with zero protocol response; if ANT halves, operators are paid half and leave.

So the 256 KiB rule is valid only inside a price band. Recompute with:

```
S_crossover = (price_chunk_ANT × P_ANT + gas_per_chunk_USD) / (1.0057e-8 × P_AR) − H_bytes

where H_bytes = 116 (Ed25519) or 1081 (RSA-4096)
```

**Re-measure whenever the ANT/AR ratio moves more than 2× in either direction.** Note the direction: **ANT price up → crossover up → route *more* to Arweave.** Two stale figures in circulation prove the point — a search-index snapshot said $0.09746 and a May 2026 review said "around $0.10"; ANT has fallen ~68% since. Never take a cached ANT price.

---

## 7. Risks — what would make this split wrong, and the earliest signal

**R1 — Autonomi restores mutable types under post-quantum signatures. (Likely, not speculative.)**
Autonomi's own 2026 publication frames 1.0's *"signed data types (pointers, graph entries, scratchpad)"* as precisely the gap that 2.0 *"closes entirely, across every component"* with ML-DSA-65. That reads as intent to reintroduce them, not to abandon them. **Signal: a `pointer_*` or `scratchpad_*` method appearing on `ant_core::data::client::Client`, or a `Pointer`/`Scratchpad` subcommand in `ant-cli`.** Check monthly — it is one docs.rs fetch. Consequence: reopens native mutable identity records — but note §2(i), free updates were never free, and §3's supply and node-capacity walls stand regardless. **Restoring pointers would not make Autonomi affordable as the identity rail.**

**R2 — ANT/AR price ratio moves >2×.** Signal: the §6 formula. Wrong-direction risk: routing large files to Arweave when Autonomi got cheap, or vice versa. Low severity — the rule is conservative and the cost is a fraction, not a wall.

**R3 — Turbo's free-under-100 KiB tier is mistaken for the plan.** Uploads under 100 KiB are nominally free, which would make 10B × 300 B cost **$0**. It is **ArDrive's corporate subsidy, not a protocol guarantee**, and it fails "decentralized, automatic, autonomous" outright. Signal: any ArDrive pricing or funding announcement. **Mitigation: never price the plan at $0. Use $76,980.** If anyone ever writes "$0" in a BNR planning doc, this risk has already materialized.

**R4 — Arweave gateway reliability.** arweave.net has had frequent outages; ar-io.net was announced for shutdown March 1; block production halted entirely for 24+ hours in Feb 2025. Signal: resolver p99 latency and error rate. Mitigation: run a BNR `ar-io-node` fleet — open source, operationally normal, but **name it as a real cost line** rather than assuming arweave.net.

**R5 — Autonomi node capacity, if anyone re-proposes Autonomi for identity.** 8.33M nodes needed for identity records alone vs 8K–175K reported. Signal: published network node count. **This wall is independent of price and is the reason Autonomi cannot be the identity rail at any ANT valuation.**

**R6 — Autonomi has no public HTTP gateway.** "Download without running a node" means running a *client* that joins the DHT — not an HTTP GET from a browser. For 10B users that means shipping a client to every device or BNR operating a gateway fleet, which reintroduces exactly the custodial centralization the Constitution rejects. **Signal: an official Autonomi HTTP gateway launching would change the read-path clause in §1's rule** and is worth watching, but do not design assuming it.

**R7 — `did:webvh` adoption stalls.** `did:ion` is the precedent: registered, resolver-supported, Microsoft-sponsored, and removed from Entra Verified ID for lack of uptake. Signal: DIF registry activity and whether a `webvh` driver lands in the Universal Resolver. Mitigation is structural — a `did:webvh` log is self-verifying regardless of who hosts it, so a stall costs interop, not correctness.

**R8 — ANS-104 sig type 2 not accepted by bundlers.** If Turbo or alternatives reject Ed25519 DataItems, the $76,980 figure reverts to $255,556 and the 3.3× lever vanishes. Signal: settled by the same funded run (upload one Ed25519-signed DataItem). Cheap to check, 3.3× to get wrong.

**R9 — the deepest one: someone makes a rail the source of truth.** This split is only correct while **both** substrates are mirrors of a self-verifying hash chain. The moment identity resolution fetches an address and trusts what comes back, instead of verifying a chain, the design inherits that rail's availability, that rail's gateway operator, and that rail's centralization — and it does so silently, because it will still work in testing. **Signal: any code path in `crates/atmirror` or `crates/onboarding` that resolves an identity by address without verifying the log's hash linkage.** This is the one to write a test against before the code exists.

---

### Summary in one line

**Arweave carries identity and everything under 256 KiB (ANS-104 bundled, Ed25519 — $76,980 for all 10 billion records, $76,980/year for a full annual re-issue). Autonomi carries bulk payloads at 256 KiB and above, where it is ~21× cheaper per GiB all-in at live prices and widens from there — confirming the founder's instinct, with the crossover re-measured 2026-08-21 at 15–246 KiB across the formula band (~163–198 KiB at live quotes) once Arbitrum gas is counted at its measured $0.0405 per 256-chunk Merkle batch, rather than the 5.4 KB the token price alone implies. Mutability is not a difference between them: Autonomi 2.0 deleted its mutable primitives, so both rails are immutable and mutability moves up into a `did:webvh` hash-linked log that neither substrate has to be trusted for. `did:autonomi` does not exist and should not be built. `anchored: bool` must become a verified witness or the Settlement gate is decorative.**
