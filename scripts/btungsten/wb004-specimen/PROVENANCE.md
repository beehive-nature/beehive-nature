# WB004 specimen provenance — eosio.msig at the 2025 freeze

`eosio.msig-c526479a/` is a VERBATIM copy of the `contracts/eosio.msig`
subtree of AntelopeIO/reference-contracts at commit
`c526479a48370981a1e9f0ac6b3bb0e4f737afa2` (2025-01-20, the repository's
final commit; the repo has been quiet since 2025-01-22), retrieved
2026-10-09 by the zCode seat through the GitHub contents API (base64
bytes, written verbatim; `.gitattributes` `* -text` is the ONLY estate
addition inside the subtree — core.autocrlf would otherwise silently
LF-normalize it, the WB002 lesson). The repository root `LICENSE` (MIT,
EOS Network Foundation 2021-2022 / block.one 2017-2019) is carried at the
subtree root so the license travels with the code.

Founder order 2026-10-09: the specimen pair is **msig.app/jungle** (a
2026 UI over Antelope multisig — the UI is a window, not a dependency)
and the underlying **eosio.msig** reference contract. Preserve upstream
untouched; attack the model, not the artifact. Do not modernize, build,
or depend on it.

Upstream facts, re-verified 2026-10-09 first-hand (claim → evidence):

- **Approvals are per-proposal vectors.** `include/eosio.msig/eosio.msig.hpp:124-146`:
  `old_approvals_info` stores `std::vector<permission_level>
  requested_approvals` and `... provided_approvals`; `approvals_info`
  stores `std::vector<approval>` of the same shapes. The reference
  contract is a multisig EXECUTION primitive — nothing in it is
  planetary direct-democracy storage.
- **Transaction expiration gates propose and exec.**
  `src/eosio.msig.cpp:56` and `:218`:
  `check(trx_header.expiration >= eosio::time_point_sec(current_time_point()),
  "transaction expired")`; a non-proposer cancel waits for expiry
  (`:191`).
- **The expiration field cannot cross 2106.** The transaction header's
  `expiration` is an Antelope `time_point_sec`, which Spring v1.2.2
  `libraries/libfc/include/fc/time.hpp:87-99` defines as a class whose
  sole storage is `uint32_t utc_seconds`, with
  `maximum() = std::numeric_limits<uint32_t>::max()`. 4,294,967,295
  seconds after 1970-01-01T00:00:00Z is **2106-02-07 06:28:15 UTC**
  (asserted by computation in the WB004 battery,
  `crates/btungsten-wb004`, row `the_2106_boundary_is_exact`). An
  unchanged present-day Antelope transaction cannot represent an
  expiration past that instant: the wire format itself goes extinct
  seventy years short of the millennium. This is the first CONCRETE
  time-extinction boundary bTunGsTeN attacks (not a simulated
  abstraction) — founder finding 2026-10-09.

Load-bearing file hashes — every vendored file verified equal to
upstream's own git blob SHA at the pin (byte equality in git is blob-SHA
equality), then sha256 recorded:

| file | git blob sha @ c526479a (upstream == vendored) | sha256 (vendored bytes) |
|---|---|---|
| `CMakeLists.txt` | `0947ea9d0e2f069ab31e42aee4d9e332d8c1581b` | `33b4e72d504144d5512a828793e39da5fa6a3e7a1fed9182b54ab166d4a5d80a` | (PUBLIC-CONSTANT)
| `LICENSE` | `42c742fae49be5b2b103d8d3bfbcd406f54c77b3` | `2b420f2e51edf1a06191d8755a241fc17cda603622d1fc82ffc5b2c1d8534e8b` | (PUBLIC-CONSTANT)
| `include/eosio.msig/eosio.msig.hpp` | `d33b0412b017f54897af0b6d5cf606e9251a967c` | `7e2f1bf8755a614d4744669ab40ed8e49046c1c2d52521166b67600581678968` | (PUBLIC-CONSTANT)
| `ricardian/eosio.msig.contracts.md.in` | `b9f3f35f85696b7c64638bcad97e74a92dd9abdb` | `bec0f47673b0a28dc13fa65b883174742c6ca49d7f481fc1ec188919af5033d7` | (PUBLIC-CONSTANT)
| `src/eosio.msig.cpp` | `854814bbaa7830caef77da4df1e4ae7c91206fbc` | `46c7a9ab4d8f377c9fd689081835bdc5b56993f1f501499f1cba64ff8180198e` | (PUBLIC-CONSTANT)

Specimen posture identical to WB002's: preserved, never built, never
executed, never imported by workspace code. The WB004 model cites these
files by line; it does not link them.
