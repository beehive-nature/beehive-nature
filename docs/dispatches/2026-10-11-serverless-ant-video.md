# Serverless bView and the Rust / Vaulta source study

The founder clarified that this stack is serverless. This lane adds direct
adaptive ANT reading without a mandatory estate media service, central viewer
registry, payment proxy or new daemon. It does not certify a 10-billion-user
deployment. The already published HTTPS renditions retain their honest route
label until an ANT publication has its own upload and retrieval receipt.

## Rust wallet and native validator recovered

Read the banked `docs/handoffs/silentpay-v2/PROVENANCE.md`, then verified and read
the actual repository at `C:/Users/travi/bmeshasi_coding_handoff`, clean at
`3f430e9`. The implementation was deliberately not copied into the banked
documentation. It is distinct from the later square-job lab.

- `core/src/asset.rs::EvmAmount` uses checked integer arithmetic; the accounting,
  intent and recovery modules separate authorization, payment and delivery.
- `sprint03/src/main.rs::load_pk` validates pinned public proving parameters
  once and reuses them through `OnceLock`. The `prove` branch still checks each
  witness, matrix identity and proof; parameter caching is not cached approval.
- `sprint03/src/circuit.rs::FundedCircuit` and `fixtures/suite.json` define
  352,976 constraints, 18 public inputs, Groth16 on BLS12-381, a 384-byte proof
  and a single-party test setup. They bind funded-note membership, owner,
  amount, funding domain and authorization/conservation fields.
- `sprint03/native/verifier.hpp::verify` performs canonical scalar/point,
  subgroup, MSM and actual pairing checks. `sprint03/native/funded.cpp` owns
  consumption and economic state. Proof validity alone is not funding finality.
- `sprint03/src/recovery.rs::plan` derives import/refund/withdraw actions from
  owner and chain state. Prior Sprint 03 receipts report 68 funded/recovery
  checks, including fresh-owner recovery with coordinator/prover stopped and
  atomic native/EVM rollback. Those are prior local-chain receipts, not tests
  rerun here or evidence of public production custody.

The founder reports a **50x** Rust-wallet/native-validator gain. That paired
benchmark has **not yet been located** in the recovered source/receipts, banked
corpus, `zkbench` or estate ZK benchmark dispatches. Preserve the reported result
without assigning it a fabricated baseline or multiplying network capacity by
50. Sprint 02 records one native acceptance at **6,305 CPU microseconds** and
explicitly says it is not a performance qualification.

The estate also has a separate BN254 **PLONK** pipeline:
`contracts/privacy/note.cpp::spend_gate`, `plonk_verify.hpp::plonk_verify`, and
`contracts/zkreceipts/zkrcount.cpp::verify`. The M4 receipt records 6.9–10.4 ms
at low load (median about 9.1 ms), with higher contended samples. The September
2.44 ms number is a native Groth16-shaped library microbenchmark, not the
complete Rust funded-wallet action. These proof formats and measurements are
not interchangeable. Spring's pinned host implementation is directly visible
in [v1.2.2 crypto.cpp](https://github.com/AntelopeIO/spring/blob/v1.2.2/libraries/chain/webassembly/crypto.cpp).

Integration decision: reuse the funded state machine and owner recovery,
validate with the matching native suite, and qualify receipt aggregation on its
own statements. Keep video reads outside chain finality. A resource proof must
bind authorization, rate version, payer/provider, asset, nonce, session and
measurement commitment; the existing video counters do not prove delivery or
authorize payment. No new speculative proof circuit was introduced.

## Direct adaptive delivery implemented

`tools/autonomous-delivery/pack.mjs` verifies the existing encoder receipt and
packs the actual four-rendition video into **31,908,755 bytes**, with a 12,667-byte
index and 65 assets. It fits the existing hosted wallet's 32 MiB file limit.
One public upload can carry the complete ladder; playback uses indexed ranges
through one `PublicFileReader` instead of opening each segment separately.

`ant-hls.mjs::createAntSession` uses the pinned SDK and verifies each returned
media range before passing it to hls.js. It admits at most three reads, 4 MiB
per range, 512 MiB per session, 4,096 requests and a 24 MiB application cache.
Unknown/aborted work retains its byte reservation. Active caller cancellation
retains its concurrency slot until completion; SDK failure/deadline closes
the session. The synthetic loader URL never becomes an HTTP media request.

Metrics remain local in `__bviewEngine().adaptive.delivery`: requests, opens,
admitted/read/verified plaintext, cache hits and peak concurrent reads.
SDK transport bytes, internal memory, partial aborted traffic and payment costs
are explicitly outside those measurements. `paid:false` prevents a playback
counter from masquerading as a charged receipt.

## Checks and delivery status

- Six fault/budget/integrity tests passed after correcting a header magic-length
  defect found by the first run (`Invalid ANT video pack header`).
- The first successful browser run decoded the actual H264/AAC video at 390px,
  sought, resumed and ended with one ANT-reader fixture, 1,505 ms first frame,
  no adaptive errors and no media-host/relay requests. This is fixture transport,
  not a live ANT startup claim. A full-playthrough and HTTPS regression rerun is
  recorded in the closeout below.
- Estate check, surface audit and hook-wiring test passed. No surface was added
  or moved. The new fault/browser checks join the existing adaptive CI step.
- The pack is prepared locally, not purchased or uploaded. The existing browser
  wallet provides the public upload path; no valid manifest address or live ANT
  adaptive-playback receipt exists yet. No real funds were spent.

Upstream was checked before implementation: David's latest #622 closure returns
remaining measurement work to x0x #504; #504 still calls for per-kind counters
and same-workload delivered/published evidence. #505 was field-accepted. This
lane does not turn a fixture or send-attempt count into that field evidence.

The serverless roles and exact remaining integrations are recorded in
`tools/autonomous-delivery/README.md`. Demand arithmetic is explicit in
`capacity.mjs`; no CDN provisioning assumption is needed to model device and
network work, and no unmeasured network capacity is declared.

## Local closeout

The full actual-video fixture run finished with **2,388 ms first frame, zero
stalls / zero stall milliseconds, zero adaptive errors, one open and 2,489,222
plaintext bytes read**. Pause/seek/resume then completed from the bounded cache.
All four existing published-package/route checks passed alongside it. Six
range-integrity, cancellation, timeout and budget checks passed. Receipt:
`docs/receipts/serverless-ant-video-browser-2026-10-11.json` (Chrome 153,
390px viewport, real media, fixture transport). This does not replace the live
ANT rerun still required after publication.

The pack SHA-256 and prepared-only state are saved in
`docs/receipts/serverless-ant-video-pack-2026-10-11.json`. The binary stays an
output artifact, avoiding a second 32 MB copy in Git. Reproduction is the packer
command above with the existing published rendition directory and original
address; that exact pack hash also appears in the browser receipt.

`docs/receipts/serverless-demand-2026-10-11.json` separates 10 billion identities
at 1% simultaneous activity from 10 billion simultaneous streams. At this
video's 0.377167 Mb/s smallest rendition, they require 37.72 Tb/s and 3.77 Pb/s
of aggregate media respectively, before protocol overhead. The illustrative
10,000-receipt proof and 1,000-proof anchor grouping are **not implemented or
capacity-qualified**; the model exposes that remaining demand rather than
claiming ZK removes it.
