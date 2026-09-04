# RECEIPT-SOUNDNESS-M6 — on-chain root + range checks (founder-ordered)

2026-09-04, the port seat. Both labels the founder promoted to soundness
landed and are receipted below. Reproducible from `contracts/privacy/`.
SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.

## 1 · Range checks (conservation cannot wrap)

`payment.circom` now decomposes every amount to 64 bits in-circuit
(Num2Bits ×3: amountIn, amountOut, fee). 12,166 total constraints; the
pot14 ceremony was REUSED (powersoftau is universal — only `plonk setup`
re-ran). **Receipt: the overflow spend** — amountIn = 2^64 with
amountOut = 2^64−10 and fee = 10 (integers that balance exactly) — **is
refused at witness generation** (Assert Failed: no satisfying witness
exists below 2^64).

## 2 · On-chain incremental merkle (setroot deleted)

- `poseidon2.hpp` — circomlib's t=3 Poseidon in C++ over field256:
  constants PARSED from circomlib's poseidon_constants.circom by
  `gen_poseidon_cpp.js` (never retyped), Montgomery-domain execution.
  **Gate: 68/68 vs circomlibjs** (66 vectors + the zero-chain structural
  checks) before any chain use. tree_zeros.hpp carries the depth-20 zero
  chain (generated, same source).
- `note.cpp` `tree_insert`: Tornado's incremental algorithm, 20 Poseidon
  hashes per insert; a `tree` table (next_index + 20 filled-subtree
  fields — CDT cannot reflect array members, 20 named fields); deposit
  inserts its leaf, transfer inserts the payment's out-note (so a payment
  note is spendable — the gap the runner exposed mid-lane); **no root
  setter exists in the ABI** — actions are deposit/init/transfer/withdraw
  only. Root-rollback is structurally impossible.
- The 12KB poseidon context lives in a static scratch re-initialized per
  action (the WASM stack rejects it — "wasm memory out-of-bounds",
  receipted).

## The T law (this lane's discovery, closing the M1 gotcha exactly)

CDT `checksum256::extract_as_byte_array()` returns T(memory) where T =
reverse + swap-16-byte-halves, an involution. Action params pass through
decode+extract unchanged (T∘T); bytes written by memcpy come back
transformed. M4/M5 gates assembled publics from PARAMS (worked); M6's
gate reads the root from STORAGE and initially fed the pairing T(root).
Evidence: probe accepted (params) / payment rejected (stored root) /
T(display) == proof root (involution) / post-compensation payment
EXECUTED. `t256()` now pre-transforms every storage write (law root,
filled subtrees) — init's empty root displays RAW, the visible proof of
the fix.

## Chain receipts (`paynote1111`, code hash `99aba03e449c2fa00867e5b8c675d1b4f5b05eb2c893f7992d5c9fb62d006136` TESTNET-ONLY)

- init executed; law displays the raw empty root (2134e7…91f3e).
- **deposit: the CONTRACT computed the root** — blk 40452, 29,837 µs
  (the 20-Poseidon insert; no native Poseidon intrinsic exists — a named
  optimization lane).
- **THE PAYMENT executed** — blk 40553, 55,835 µs (verify + the out-note
  insert). The strongest cross-check: the proof (root from tree.js)
  verified against the CONTRACT-computed root — three-way agreement
  (contract == tree.js == proof) proven by execution.
- FORGED (eval_zw +1) → REJECTED (pairing). REPLAY → REJECTED (nullifier
  uniqueness). FEE-TAMPER (claim 11, prove 10) → REJECTED (publics are
  transcript-bound).
- **OVERFLOW → refused at witness generation.**
- **PHANTOM-LEAF → rejected with nowhere to land**: a real commitment
  P(777,1000) inserted only off-chain, proven honestly for its root
  (snarkjs verify OK), refused on-chain — the contract's tree never
  contained that note.
- WITHDRAW of the payment's out-note (leaf 1 of the CONTRACT's tree,
  amountOut=0, value on the fee leg) — blk 40625, **11,971 µs = the pure
  verify bill** (no insert), in band with M5, tripwire < 15 ms PASSED.
- final: tree next_index=2 (both leaves appended by the contract),
  nullifiers 2 (algs 2), commitments amounts [1000, 0] (deposit open,
  payment note private).

## z2.1 coordination (founder-ordered)

Root-rollback and index-binding were on its list; both are closed BY
CONSTRUCTION: no setter exists (deleted from the ABI — the root only
advances via deposit/transfer inserts), and the nullifier binds the
path-derived leaf index (M5). The remaining labeled surfaces for review:
the init/deposit auth shape (governance), the one-participant ceremony
label (until a witnessed multi-party sealing is ruled), the WASM insert
cost, and the range-check width (64-bit — a founder-ruled bound).
Findings land in this tree.
