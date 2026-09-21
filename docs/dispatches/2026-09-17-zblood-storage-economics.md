# zBLOOD MISSION: FIRST REAL STORAGE-ECONOMICS RECEIPT · 2026-09-16/17

**Seat:** zBlood (`lane/zcode-lineage-import`). **Experiment object:** the FIRST approved zBlood public preservation snapshot — not a synthetic 1 GB/TB example. **Law carried through:** quote ≠ purchased ≠ uploaded ≠ retrieved ≠ hash-verified. Five states, never conflated; no synthetic projection labeled measured.

## A. The artifact (measured)

- **manifest SHA-256:** `440b502a6e1ac2dc086902f743f9f750437e7079040dfd5e76c8dd42c7de4389` (recomputed at measurement — matches) <!-- PUBLIC-CONSTANT public chain data -->
- **approval:** bound intact — founder, 2026-09-16T22:36:15Z, destination "bnr genesis — skaists.dev blood archive (ANT/AR pending adapter receipt)"
- **20,537 files · 62,139,972 bytes (0.057872 GiB) · 10,259 person objects · 3 evidence packs**
- **upload form:** NOT YET UPLOADED. Planned tar+zstd; **all quotes measured on the uncompressed byte count** and labeled so — a compressed form requires fresh timestamped quotes.

## B. Quotes (timestamped, raw preserved)

**Arweave — LIVE QUOTE (2026-09-16T22:40Z):**
- `arweave.net/price/62139972` → **809,313,015,684 winston** = **0.8093 AR** × $2.51 (coingecko, same minute) = **$2.0314**
- 10× sanity point (621,399,720 bytes → 8,062.15 µ-AR): near-linear, quote consistent
- manifest-only (3,614,894 bytes): 37,444,936,280 winston = **$0.094** — the split-route object
- **QUOTE ONLY. No purchase, no transaction.**

**Autonomi — REAL CLIENT-SIDE ESTIMATE OBTAINED (2026-09-16T23:28Z, display-only):** the released client on this seat (ant 0.3.1) implements the no-payment cost command; run on the exact deterministic upload object —
- **object:** pkg3.tar — 80,998,400 bytes, sha256 fec5fba8…, deterministic (sort=name, fixed mtime), built 23:27:22Z; no zstd on this seat so the UNCOMPRESSED tar is the measured object
- **raw output (preserved):** chunk_count 23 · storage_cost 3.106827 ANT · gas 0.00015 ETH · payment_mode single · **confidence: priced_sample**
- **USD:** storage 3.106827 × $0.03466683 = **$0.1077** + gas 0.00015 × $2411.39 = **$0.3617** → **total ≈ $0.4694** (≈ **$1.43/GiB** tar-basis)
- **qualifications preserved:** display-only (true cost reconciles at payment), sampled confidence, storage/gas separate line items; no spending key, no node migration, no ant update
- **earlier REST claim withdrawn** as unestablished; the client cost command was the direct route

**Superseded note (kept for the record):**
- No public pricing REST exists; probed 2026-09-16T22:40:59Z — `api.autonomi.org`, `api.autonomi.network`, `stats.autonomi.org`, `antstats.autonomi.org` all unreachable from this seat.
- Autonomi prices via a live node's API (network record count, ANT-denominated); the estate's node runs on the **box** (fenced loop; SSH filtered from the laptop this session).
- **Staged for the box run:** query the node pricing route immediately before purchase, preserve the raw response + network composition, compute actual $/GiB against ANT/USD **$0.03466683** (coingecko, 2026-09-16T22:40Z).
- Prior estate finding (banked, NOT a quote): pricing quadratic in node RECORD count, ANT-denominated; per-byte rejected at source.

## C. Purchase/upload — NOT DONE, by gate

The adversarial preservation fixes are green (24/24 @ `c9bad70e`), and the founder approval binds the exact manifest + destination — but the actual ANT purchase/upload waits for the node-route run on the box (keys live there). Protected/living-family material is not in the package (public-only law, tested).

## D. Retrieval proof — NOT DONE (impossible before upload)

The existing acceptance journey (`profile → crest → Rockwood/Donna → person archive → fractal → evidence/lore`) re-runs from a **fresh ANT retrieval** once upload exists; only then does the milestone become **ANT retrieval-verified**.

## E. The economics experiment (model, labeled)

**Question:** does Beehive Nature's marginal storage/egress obligation for an already-purchased immutable archive stay effectively unchanged as independent retrieval count rises?

**Structural answer — YES for ANT/AR** (one-time prepaid storage; the network serves retrievals; uploader egress $0). **Honest counterweight:** TODAY the archive is served from estate-operated infrastructure (the box), where OUR egress scales with every view until network publication detaches it. Publication is precisely what changes our obligation curve.

At **1,000,000 realistic page views (2 MiB each)** — list-price assumptions, documented 2026-09-16, NOT measured:

| route | storage | egress at 1M views |
|---|---|---|
| S3+CloudFront | $0.0013/mo | **$166.02** |
| Backblaze B2 | $0.0003/mo | **$19.53** |
| Cloudflare R2 | $0.0009/mo | $0 (egress-free, storage recurring) |
| Arweave (quoted) | $0 after **$2.03** once | **$0** |
| Autonomi | pending quote | $0 |

**The Discord argument in numbers:** egress-billed routes cost real money at scale; endowment routes cost the uploader nothing; and until we publish, WE are the egress-billed route.

## F. Reproducible

`assets/profile-archive/lineage/zblood-storage-economics.json` — every input timestamped, raw quote responses preserved, formulae stated. **No `$747/TB` hardcoded claim anywhere** — that number is deliberately absent; every figure is a timestamped quote or an explicitly-labeled list-price assumption.

## G. AR comparison — split-route finding (measured inputs)

Manifest-only on AR: **$0.094**. Full archive on AR: **$2.0314**. Both pocket change at this size — the split (AR carries the tiny permanent provenance root, ANT carries payload) becomes meaningful at scale (~60 GB → ≈$1,966 full-AR vs $0.09 root + ANT at its own rate). **Recommendation: quote both live at upload time; founder rules. No duplication before both quotes exist.**

## The live card

`blood.html` now carries the receipt card beside the Rockwood demonstration path, rendered from the JSON with the five states shown: today it reads *"Arweave quote to preserve this whole archive: 0.8093 AR ≈ $2.0314 (live) — purchase awaits the approval gate · retrievals tested: 0 · developer egress: serving from our own box until network publication."* The numbers update from the receipt as states advance.

**Public demonstration path:** Albert Perry Rockwood → biography/records/lore → blood fractal → the underlying archived evidence → this receipt.


---

## CORRECTIONS + WORKLOAD SPLIT (same-day rider)

- **Timestamps fixed:** the placeholder times (22:40:5xZ) are replaced by honest minute-precision captures (22:40Z, 23:27-23:28Z).
- **Upload object made real:** the Arweave figure remains a historical size-based estimate on uncompressed content bytes; the ACTUAL deterministic object is pkg3.tar (80,998,400 bytes, sha256 fec5fba8…) and the ANT estimate quotes THAT.
- **Workloads split — never conflated:** full-archive retrievals at 1M = **62.14 TB** (CloudFront gross $4,919.15 / after 1TB-free $4,840.02; B2 $578.72); assumed 2 MiB page views at 1M = **2.10 TB** (CloudFront gross $166.02 / after free $86.88; B2 $19.53) — a 29.6x difference; the 2 MiB figure stays labeled UNMEASURED until cold/warm journeys are network-traced (the corpus alone is 59 MiB).
- **Two acceptance outcomes named:** (1) archive retrieved + restored from storage; (2) family experience delivered WITHOUT our box carrying the payload — proven by blocking the estate payload origin in the test browser and repeating the journey through the network-backed route. Both pending.
- **Approved snapshot stays frozen:** the economics card/receipt are NOT silently added to pkg3 — any newer archived edition gets its own manifest.