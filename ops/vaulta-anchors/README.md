# Vaulta anchors — ordinal-indexed proof registry (staged)

## Probe first (L0V3 correction, honored)

No public evidence exists that Vaulta exposes native ZK proof
validators or precompiles: web search returned none, the
`testnet.vaulta.com` endpoint is an auth-gated proxy (403/ES
policy, not a node API), and the reachable Antelope testnet
(Jungle4) exposes no ZK intrinsics. **Nothing in this lane is
designed around a native ZK surface.** If/when a native surface
is verified on the actual VM, this file is revised with the
measurement; until then, validators live in our WASM contracts
and every verify carries a measured CPU/NET price.

## Design

- **Ordinal registry**: each anchored proof gets a sequential
  ordinal in a Vaulta table (bFrAcnter seam:
  `crates/bnrose-anchor-vaulta`, `anchor_statement`). Ordinal N
  commits (SHA3-256 native) to statement + proof-shape id +
  previous ordinal hash — a hash-chained, ordinal-indexed
  history, mirroring the B9 receipt chain.
- **First shape**: Schnorr-authorized (BIP-340 via bsigner's
  existing taproot path — used, not rebuilt), hash-committed.
  Ordinal-0 statement is the B9 chain commitment
  `b3a68919042e6e179ed78bcf155f6ad92b12a8fa7578500fdef8d272d08a873c` PUBLIC-CONSTANT
  (zk-adaptor bench, `crates/zk-adaptor/examples/b9_bench.rs`).
- **Interop seam**: foreign shapes (SNARK/STARK/Groth16) are
  committed with Poseidon (plank-Poseidon) at the adaptor seam
  and verified by WASM validator contracts; verdicts anchor as
  ordinals. Shapes are verified, never trusted.
- **Resources**: the founder's mainnet MVP contracts
  (bDomain/.a/bDesk) hold RAM/CPU/NET — anchors are estate-held
  resource spend, "free to us, not free to the chain," and the
  metered gate prices them from the measurements below.

## Scoreboard (the deliverable; Vaulta columns measured at
## first inscription — no account action taken yet)

| shape | proof bytes | prove (op) | verify (op) | Vaulta CPU/NET per verify | RAM/ordinal | setup | PQ |
|---|---|---|---|---|---|---|---|
| schnorr-bip340 | 64 | 3327us | 1629us | UNMEASURED | UNMEASURED | none | no |
| ml-dsa-65 | 3309 | 22486us | 9283us | UNMEASURED | UNMEASURED | none | yes |

Operator-side numbers measured 2026-10-22 over the B9 chain
(zk-adaptor bench). Verifies-per-block follows from the CPU/NET
measurement once a testnet account inscribes ordinal-0; that
inscription is the next action and needs the founder's Vaulta
account/keys (env only, never in this repo).

## Inscription attempt — 2026-10-22 (BLOCKED, exact)

Ordinal-0 was NOT inscribed. No agent-side channel exists:

- No Vaulta/EOS account or key material in any env scope
  (Process/User/Machine swept for `VAULTA*`, `EOS*`, `ANTELOPE*`,
  `JUNGLE*`, `BDOMAIN*`, `BDESK*` — all absent; values never
  printed, presence only).
- No chain tooling on PATH (`cleos`, `anchor`, `nodeos` absent).
- `https://testnet.vaulta.com/v1/chain/get_info` unreachable
  from this seat (curl `http:000`, 2026-10-22). The reachable
  Antelope testnet (Jungle4, `get_info` 200) is not Vaulta and
  this seat holds no account there either.
- The anchor client (`crates/bnrose-anchor-vaulta`) reads/writes
  an `evanchor` contract via signed transactions; no deployed
  contract account is known to this seat.

Unblock (any one): founder places a Vaulta testnet account name
+ signing key in env (names only in chat, values via env), or
founder/L0V3 inscribes ordinal-0 (statement above) from their
seat and returns the tx id + CPU/NET receipts. On either, this
scoreboard's Vaulta columns get measured, not estimated.
