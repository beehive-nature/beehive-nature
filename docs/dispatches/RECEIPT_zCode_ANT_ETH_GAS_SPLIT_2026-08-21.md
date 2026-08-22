# RECEIPT — the real ANT-vs-ETH cost split for an Autonomi upload (1 TB / 1 GB / 1 MB)

**Tasking:** founder dispatch via Seat 3, 2026-08-21 (Discord dispute: "~0.05/99.95 ANT/ETH"; DavidMc0: "near 40/60, ANT sometimes > ETH, for large Merkle-batched files").
**Seat:** zCode (GLM 5.3). **Pass:** measure-and-report only — no surface copy touched, no atticked drafts touched.
**Oracle rule honored:** every constant below cites a file:line in Autonomi's own current source; every cost figure cites an on-chain tx hash or a named price endpoint. Our surfaces appear only in §6 as the audited subject.

---

## TL;DR — the real split

| upload | chunks | on-chain txns | ANT cost | ETH gas cost | **ANT/ETH split (USD)** |
|---|---|---|---|---|---|
| **1 MB** | 3 (small-file rule) | 1 × `payForQuotes(n=3)` | 0.2544 ANT ≈ **$0.0105** | 3.34e-6 ETH ≈ **$0.0084** | **55/45** |
| **1 GB** | 239 | 1 × `payForMerkleTree(d=8)` | 20.27 ANT ≈ **$0.839** | 1.606e-5 ETH ≈ **$0.0405** | **95/5** |
| **1 TB** | 238,652 | ~933 × `payForMerkleTree(d=8)` | 20,238 ANT ≈ **$837** | 0.01499 ETH ≈ **$37.76** | **96/4** |

Priced at ANT $0.04137896 and ETH $2,519.20 (CoinGecko `simple/price`, fetched 2026-08-21 ~22:35 UTC; Arbitrum gas at 0.0208 gwei per `eth_gasPrice` same minute). At Blockscout's CoinGecko-fed ANT print ($0.03451015, 2026-08-21) the rows read 51/49, 94.5/5.5, 94.9/5.1.

**One-line verdict:** the disputed 0.05/99.95 split is wrong at every size — the real split is size-dependent: **~55/45 ANT/ETH at 1 MB, ~95/5 at 1 GB and 1 TB**. DavidMc0's ~40/60 describes only the small-file (single-batch) regime; his parenthetical "(ANT sometimes > ETH)" is the large-file truth — at ≥1 GB, ANT is ~95% of the all-in cost. `bantfarm.html` states no numeric split; its qualitative "plus a little ETH for gas" is correct for archive-scale uploads and wrong for small files (§6).

---

## 1. Chunk model — VERIFIED (source)

- `MAX_CHUNK_SIZE = 4_190_208` bytes (4 MiB − 4 KiB) — **`WithAutonomi/self_encryption` @ HEAD `4021f66` (2026-08-07), `src/lib.rs:154-160`**; identical constant in `maidsafe/self_encryption` (archived gen) `src/lib.rs:154`. The doc line "Set to 4190208 (4MiB - 4KiB) to leave headroom for occasional compression growth" is verbatim in source.
- `MIN_CHUNK_SIZE = 1` B; files < 3 B are not self-encrypted (`lib.rs:150,163`).
- **Small-file rule:** any file < 3 × MAX_CHUNK_SIZE (12,570,624 B) splits into exactly **3 chunks** — `self_encryption/src/utils.rs:110-112` (`if file_size < (3 * max_chunk_size) { return 3; }`). So a 1 MB upload is 3 chunks, not 1.
- Large files: `file_size / max_chunk_size` (+1 if not multiple) — `utils.rs:113-117`.
- Chunk counts: 1 TB (10¹² B) → **238,652 chunks** (238,651 full + 1 partial); 1 TiB (2⁴⁰) → 262,401; 1 GB → 239; 1 GiB → 257; 1 MB → 3.
- The dispatch's expected "~262,144 chunks/TB" = 2⁴⁰/(4×2²⁰): correct order, off by 1.0% on TiB (real constant is 4,190,208, not 4,194,304) and 9.1% vs decimal TB. Receipt above uses exact constants.

## 2. Payment batching — the ~256 assumption CONFIRMED (source)

Two payment paths live on one vault contract (`PaymentVaultV2`, verified source via Blockscout):

- **Per-batch mode** (`payForQuotes`): up to `MAX_TRANSFERS_PER_TRANSACTION = 256` chunk payments per on-chain tx — **`WithAutonomi/evmlib` @ HEAD `fbf879b` (2026-08-12), `src/contract/payment_vault/mod.rs:11`**; used at `src/wallet.rs:438`.
- **Merkle mode** (`payForMerkleTree`): one on-chain tx per Merkle tree of `2..=MAX_LEAVES` chunk-leaves, **`MAX_LEAVES = 1 << MAX_MERKLE_DEPTH = 256`** — **`WithAutonomi/evmlib` `src/merkle_batch_payment.rs:26` (`MAX_MERKLE_DEPTH: u8 = 8`) + `src/merkle_payments/merkle_tree.rs:25`**; splitting logic documented verbatim at **`WithAutonomi/ant-client` @ HEAD `50b4370` (2026-08-18), `ant-core/src/data/client/merkle.rs:358-378`**: *"Every batch becomes one MerkleTree… 257 splits as [255, 2] and 513 as [256, 255, 2]"* and `merkle.rs:546`: *"pays on-chain in one tx… Anything longer than MAX_LEAVES is split… one transaction per sub-batch."*
- **Mode switch:** `DEFAULT_MERKLE_THRESHOLD = 64` chunks — `ant-core/src/data/client/merkle.rs:38` (unit-tested =64 at `merkle.rs:1899`); matches docs.autonomi.com payment-model: "In ant-core, the Merkle threshold is 64 chunks."
- **So:** 1 TB → 238,652/256 ≈ **933 on-chain txns** (the dispatch's ~1,024/TB is the TiB-4MiB-rounded version — confirmed in shape). 1 GB (239 chunks) → 1 txn. 1 GiB (257) → 2 txns (`[255, 2]`).
- Note: the on-chain contract caps depth at 12 (4,096 leaves, `PaymentVaultV2.sol:34`); the client self-caps at 8 (256). Client cap governs real uploads.
- **Correction to our ledger's model** (sibling copy, §6): 64 is the *threshold*, not the batch *width*. Width is 256 in both modes. The docs' "batching auto-triggers at 64+" (correct) got misread as "64-chunk batches" in `storage-substrate-split.md`.

## 3. Arbitrum gas per payment tx — LIVE RECEIPTS (no estimates)

150 most-recent txns to the vault pulled from `arbitrum.blockscout.com/api/v2` (keyless), calldata fully decoded (array length = chunk payments; tuple = `(address,uint256,bytes32)` per verified ABI), ANT cross-checked against the tx's actual ERC-20 Transfer events — calldata amounts matched on-chain transfers exactly on every sampled tx. Representative receipts:

| tx hash | when (UTC) | mode | chunks paid | gas used | total fee (ETH, incl L1 poster) | ANT paid (on-chain) |
|---|---|---|---|---|---|---|
| `0x63a519800a60d786b9195f565cf7e96e86be565b44760dd2d12a36670475c39d` | 08-21 01:42 | quotes n=1 | 1 | 80,767 | 1.6173e-6 | 0.064736 | <!-- PUBLIC-CONSTANT: public Arbitrum One tx hash -->
| `0x5f0e9a1935943ab62a4f3ff67fdf35f59631b9cbfe5335bf7a6170e0fb2cbef6` | 08-21 14:02 | quotes n=3 | 3 | 161,377 | 3.4577e-6 | 0.232014 | <!-- PUBLIC-CONSTANT: public Arbitrum One tx hash -->
| `0xaf4a26f49b0e3171a972cc6cb6c8be8dc5e6da7fa4862cac99d4fc4431cdff6d` | 08-21 22:07 | quotes n=10 | 10 | 449,037 | 9.0229e-6 | 0.878673 | <!-- PUBLIC-CONSTANT: public Arbitrum One tx hash -->
| `0x16c9209c2712f565ca49ff33880402593d49c62ebaa7f6a23ed1164f9b99cf97` | 08-19 21:57 | quotes n=12 | 12 | 519,958 | 1.1384e-5 | 0.954236 | <!-- PUBLIC-CONSTANT: public Arbitrum One tx hash -->
| `0x8c6c2605ad6e2af8e677fcb4f4934c3147e51abcd874c9549ce071d9a75dd604` | 08-19 12:57 | merkle d=7 | 128 | 728,641 | 1.4573e-5 | 13.907064 | <!-- PUBLIC-CONSTANT: public Arbitrum One tx hash -->
| `0xcfe43b08592f2ceda6e249bc831e2abffced2f64da6e83e239c8a998ac77bbf4` | 08-19 13:11 | merkle d=8 | 256 | 800,678 | 1.6014e-5 | 18.925248 | <!-- PUBLIC-CONSTANT: public Arbitrum One tx hash -->
| `0x107ec2d653f44976f026108ecfe89fc6f4fb71bc51bc2ad92f32757d4b44e755` | 08-19 13:10 | merkle d=8 | 256 | 790,709 | 1.5923e-5 | 35.848443 | <!-- PUBLIC-CONSTANT: public Arbitrum One tx hash -->
| `0xc35c9d25023f3739fb3159026b0604e3b32a687c6fd1c62cc464d627409366e6` | 08-19 13:10 | merkle d=8 | 256 | 812,848 | 1.6257e-5 | 22.347181 | <!-- PUBLIC-CONSTANT: public Arbitrum One tx hash -->

- Gas shape: quotes mode ≈ 80k base + ~40k per payment (256 payments would be ~10.3M gas ≈ 2.1e-4 ETH — which is *why* Merkle mode exists); **merkle d=8 covers 256 chunks at ~800k gas (~3.1k gas/chunk — ~12.8× cheaper per chunk than quotes)**.
- **L1 component verified** on Arbiscan for `0xcfe43b08…`: total fee 0.00001601356 ETH ("$0.04" at Arbiscan's $1,914.81/ETH that day) = network fee 0.00001574318 + poster fee (L1) 0.00000027038 ETH, gas price paid 0.02 gwei, L1 gas used 13,519. Blockscout's `fee` field matches Arbiscan's L1-inclusive total to the digit — the table above is all-in.
- `eth_gasPrice` on `arb1.arbitrum.io/rpc` at fetch time: 0x13d5260 = **0.0208 gwei** — receipts are at current gas, not a spike or a trough.

## 4. ANT per chunk / per TB — LIVE RECEIPTS

- **Per-chunk ANT, measured on-chain across all 150 decoded vault txns (both modes): min 0.025198 / p25 0.064115 / median 0.084802 / p75 0.098674 / max 0.147986 ANT per chunk.** Merkle batches alone: 0.049–0.140/chunk. This is the *quote-variability* the docs' node-pricing formula predicts (`BASELINE + K × (n/D)²` per docs.autonomi.com payment-model — node fullness varies the price; no fixed per-chunk figure exists by design).
- Per TB: 238,652 × 0.084802 ≈ **20,238 ANT ≈ $698–837** at today's ANT prints.
- ANT/USD sources (both 2026-08-21): CoinGecko API `simple/price?ids=autonomi` → **$0.04137896** (used for headline); Blockscout token object for `0xa78d…b684` (CoinGecko-fed) → **$0.03451015**. The ~20% spread between two same-day CoinGecko-derived prints is itself a sensitivity input (§5).
- ETH/USD: CoinGecko `simple/price?ids=ethereum` → **$2,519.20** (2026-08-21 ~22:35 UTC).
- No daemon "live quote" was available to this seat without running a client — the on-chain payment record *is* the executed price, so this row is measured, not estimated.

## 5. The split + sensitivity

Headline table in TL;DR. Model: 1 MB = 3 chunks → 1 quotes txn (avg of 74 observed n=3 txns: 3.35e-6 ETH); ≥64 chunks → merkle txns at the observed d=8 average 1.6065e-5 ETH/txn × ⌈chunks/256⌉; ANT = chunks × median 0.084802.

- **Regime map (ETH share of all-in cost):** 1 MB → 45%; ~24-chunk (100 MB) quotes upload → ~38%; 64–300 MB (1 merkle txn) → 5–15%; ≥1 GB → ~5%. The "little ETH" phrasing becomes true at roughly ≥50 MB and gets *truer* with size.
- **Sensitivity, 1 TB row (ETH share):** gas ×1 (0.02 gwei, today) → 4.3–5.1%; gas ×2.5 (0.05 gwei) → 10.1–11.9%; gas ×5 (0.1 gwei) → 18.4–21.3% (ranges = ANT $0.0414/$0.0345). ETH share scales ~linearly with gas price; ANT share scales with the ANT/chunk quote (0.025–0.148 observed). **No plausible gas×ANT combination reaches either 99.95% extreme**; crossing 50/50 needs ~gas ×10–12 *and* cheap-ANT quotes — i.e. a small-file world, which is exactly the 1 MB row.
- Why the Discord figures diverge: they are both real regimes. Single-batch small files at current gas sit near 55/45 (DavidMc0's ballpark); the "~0.05/99.95" shape matches a world of $0.25+/batch gas with near-free storage — *neither* holds today (poster fees post-EIP-4844 are 1.7% of a 0.02-gwei tx; storage is the expensive term).

## 6. Surface audit — exact lines, verdicts

**`surfaces/bantfarm.html`** (the named subject):

- **L117** (`data-reg="bee"`): *"Storing things on Autonomi costs **ANT**, plus a little ETH for gas, on Arbitrum One."* — **VERDICT: size-dependent; correct at archive scale, wrong at small scale.** At the page's own subject (the TB-scale archive) gas is 4–5% — "a little" is fair. For ≤ ~50 MB uploads, gas is 38–49% of cost — not "a little". Suggested founder-gated fix (NOT applied): e.g. "…plus ETH gas for the on-chain payments — a few percent at archive scale, up to half the cost for small files."
- **L126** (`data-reg="cypherpunk"`): *"Uploads to Autonomi are paid in **ANT** with ETH gas, on Arbitrum One."* — **CORRECT** (neutral, no split claim).
- No numeric ANT/ETH split exists anywhere on the surface (grepped `99.9`, `0.05`, `%` patterns): **the "~0.05/99.95" figure is not ours and contradicts nothing on the page.** The Discord dispute does not attach to this surface as stated.
- Incidental: ANT token constant at L285 (`0xa78d8321B20c4Ef90eCd72f2588AA985A4BDb684`) matches `evmlib/src/lib.rs:64-65` — correct.

**`docs/storage-substrate-split.md`** (sibling cost copy — audited, NOT edited):

- **L48** "flat per chunk up to 4 MiB" — **correct** (source: 4,190,208 B constant).
- **L64/L67/L89** "64-chunk batches" / "batch width… maximum is undocumented" — **wrong/stale on width, now settled**: 64 is the Merkle *threshold*; *width* is 256 leaves (receipts §2). The previously-flagged §6 uncertainty is closed by this receipt.
- **L67** "$0.25/batch… $0.0039/chunk" gas figures — **stale by ~6×**: today's all-in merkle batch is $0.040/256 chunks ≈ **$0.000158/chunk** (at 0.02 gwei). Their figure belonged to an older gas regime / quotes-mode batches.
- **L67** "$0.000122/chunk n=0 storage cost" — **stale by ~22×**: live median is 0.0848 ANT/chunk ≈ $0.0035 at $0.0414. Either quotes rose with node fullness since that measurement, or that floor was optimistic; today's on-chain record is the floor's replacement.
- **L126/L128 (§3 identity math)** "10e9 / 64 chunks-per-batch = 156,250,000 batches × $0.25 = $39,062,500" — **both inputs wrong today**: real width 256 → 3,906,250 txns; real cost $0.0405/txn → **≈ $158K gas** (247× lower), while the ANT side at today's quotes is ≈ $3.5M (2.9× higher than the doc's $1.22M). The §3 "UNAFFORDABLE" verdict's gas leg collapses; its ANT leg roughly triples. The doc's own L168 demanded exactly this pin: **pinned**.
- Net: the 256 KiB routing rule and the Arweave comparisons were derived under the stale numbers — re-derivation is founder-gated follow-up, out of this pass's scope.

**Context row (optional sub-task): S3 / Arweave / Filecoin per-TB — UNVERIFIED.** WebSearch is dead on this box and vendor pricing pages are JS-shells to our fetchers; per the oracle rule (no invented figures), left blank. Our own `storage-substrate-split.md` has Arweave numbers but is the audited subject, not a witness.

## 7. Acceptance

- Receipts table: §1–§4 (source per row: repo file:line, tx hash, or named price endpoint).
- One-line verdict: §TL;DR — **~55/45 at 1 MB; ~95/5 at 1 GB; ~96/4 at 1 TB (ANT/ETH, USD, 2026-08-21 gas & prices); no size supports 0.05/99.95.**
- Named corrections (founder-gated, none applied): `surfaces/bantfarm.html:117` (qualify "a little ETH" by size); `docs/storage-substrate-split.md` L64/L67 (batch width 256, gas $0.000158/chunk), L67 ($0.000122 storage floor stale), L126/L128 (§3 gas math $158K not $39M; ANT leg $3.5M), L89 (uncertainty closed).
- Scope fence held: zero edits to surfaces/, ledger, attic; this file is the only tree change; delivered as git-am patch per relay protocol — Seat 3 compiles/verifies/pushes.
