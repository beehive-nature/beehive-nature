# WB002 specimen provenance — SimpleAssets at the 2021 freeze

`simpleassets-e6a042f/` is a VERBATIM copy of the upstream
CryptoLions/SimpleAssets repository at commit
`e6a042f75256008edf38c73cc55f6499fc306a7a` (tag v1.6.1, dated 2021-03-17),
retrieved 2026-10-07 by `git clone https://github.com/CryptoLions/SimpleAssets.git`
on the zCode seat and stripped of nothing but `.git/`. Founder order
2026-10-07: preserve upstream untouched; treat the frozen tree as
bTunGsTeN's first "extinct infrastructure" reference specimen — about
seven years old, one full EOSIO software epoch back, carrying its era's
compiled `build/SimpleAssets/SimpleAssets.wasm` and `.abi` with it.

Upstream facts, re-verified 2026-10-07 (claim → evidence):

- HEAD of `master` IS `e6a042f75256008edf38c73cc55f6499fc306a7a`,
  `git log -1` → `2021-03-17 v1.6.1`. The "current upstream head" claim
  in the founding brief checks out.
- License: `LICENSE` file, GNU LESSER GENERAL PUBLIC LICENSE Version 2.1,
  February 1999 (also asserted in `include/SimpleAssets.hpp` §LICENSE).
  LGPL-2.1 permits verbatim preservation and study; this copy keeps the
  license in place and modifies nothing.
- Field evidence for the failure classes the specimen is tortured with
  (all four issues OPEN upstream at re-check, 2026-10-07, via the GitHub
  API):
  - #26 "Long-running issue of occasional mis-assignment of true asset
    owner" — API-visible ownership assigned incorrectly.
  - #19 "Some assets fail to change when read from API on `update` even
    after successful `update` Tx and table update" — API metadata
    diverging from on-chain table state.
  - #21 "Errors on build." — build failures against newer CDT.
  - #6 "Author contract can freeze trading" — an author-side path able
    to halt marketplace trades.
- `authorctrl` semantics: `createf` doc and `currency_stats` comment
  (`include/SimpleAssets.hpp`, "authorctrl if true(1) allow token author
  (and not just owner) to burn and transfer"); enforced at
  `src/SimpleAssets.cpp:692-695` (`transferf`) and `:787` (`burnf`).

Load-bearing file hashes (sha256, over the vendored bytes) — the port in
`../wb002-simpleassets.mjs` cites these files by line: PUBLIC-CONSTANT

- src/SimpleAssets.cpp — 820af348481dc423cc577add0492cfe80c6e918c405265b66c5d6443258b2f8c (PUBLIC-CONSTANT)
- include/SimpleAssets.hpp — 9c60dcee88b9164b15a8cfae1bbc2a9dac8a0857910fcdbf84ac19637d6e50c9 (PUBLIC-CONSTANT)
- build/SimpleAssets/SimpleAssets.wasm — e58cbeb5149df9fe0f7fb494517476eef05c1a3230d26256ac713533c1e319bf (PUBLIC-CONSTANT)

17 files total (plus one estate-added fence: `.gitattributes` with
`* -text`, which disables git's CRLF/LF normalization for this subtree
so the committed bytes stay byte-identical to upstream — this box runs
`core.autocrlf=true`, and without the fence the index silently
normalizes CRLF→LF, breaking the hashes above; the fence file is the
ONLY thing in this directory upstream did not ship). The wasm is the
epoch's compiled artifact and is part of the specimen; nothing in this
tree is built or executed by the estate — the executable arm is the
faithful port + battery one level up. The upstream remote may move,
fork, or vanish; this copy is the anchor the 1,000-year claim leans on
(SPEC-BTUNGSTEN-1 §axes 6: no permanent dependence on any vendor —
including this one's survival).
