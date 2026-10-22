# Vaulta anchors — the estate's fractal anchor, adapted (bFrAcnter seam)

## Learn (what already exists — this lane designs nothing parallel)

The fractal anchor POC/MVP is already built and receipted in this
repo; this lane rides it, it does not replace it:

- **Statement**: `bnrose_evolve::anchor::AnchorStatement` (subject =
  Antelope name, journal head `(count, last link)`, PROMOTE digest,
  policy digest), canonical encoding version 1 / kind `0xA0`, ≤124 B,
  domain-separated digest. `Controller::open_anchored` fails closed
  against it (`crates/bnrose-evolve/src/anchor.rs`).
- **Vaulta carrier**: `contracts/evanchor/evanchor.cpp` — one row
  per subject, first anchor binds its publisher, count strictly
  grows, publisher pays RAM. Built with CDT 4.1.1 (wasm 7636 B;
  digests in `docs/receipts/bnrose-evolve/evanchor-build-local.txt`).
  **Not deployed** (its own README and the 2026-10-15 anchor
  dispatch both say so; no chain write of any kind was made).
- **Client**: `crates/bnrose-anchor-vaulta` — `latest()` reads the
  row from every endpoint after chain-id pinning (Jungle4 default),
  any doubt is `Unreachable`; `anchor_action()` builds the UNSIGNED
  action. It holds no key, signs nothing, pushes nothing — those
  belong to the signer lane by design. Tests green (5 passed, 1
  live-read ignored).
- **Arweave witness leg**: the vending lane's upload door
  (`contracts/vending/tool/ar-upload.cjs`, `arweave-owner-audit.mjs`)
  is the estate's working Arweave path — audited uploads, owner
  field verified. It witnesses statement bytes as a second carrier;
  it is not a chain of record. (Autonomi persistence is explicitly
  not built — the anchor dispatch names this.)
- **Ordinal seam**: evanchor's `seq` + strictly-growing `count` IS
  the ordinal index. There is no separate ordinal registry to
  design; ordinal-0 is the first `anchor` action for a subject.

## Live state, re-queried 2026-10-22 (reads only)

- Intended testnet deployment: contract account `bnrevanchor1`,
  subject `evolve.ctr1` (carrier test constants). Fresh
  `get_account` on Jungle4 AND on Vaulta mainnet
  (`vaulta.greymass.com`, chain `aca376f2…`): **both names unknown
  on both chains**. The POC is built + battery-tested, not live.
- Founder reports a mainnet Vaulta/Arweave fractal anchor under
  the estate's mainnet contracts (bDomain/.a/bDesk hold the
  RAM/CPU/NET). Under the POC's names nothing is visible; if the
  mainnet anchor lives under those accounts, the account/contract
  names are the one missing input — name them and this seat reads
  the live row and pins the measurement. Not guessed at here.

## Adapt (ordinal-0 for the zkAdaptor scoreboard)

1. Statement: the B9 receipt-chain commitment (zk-adaptor
   `receipt_statement`, SHA3-256) is wrapped as an anchored journal
   head — subject is the estate's Antelope name for the B9 chain,
   count = receipt count, head = the commitment digest.
2. Authorization shape: Schnorr-BIP340 verdict (bzDiD-bound) rides
   inside the anchor statement's digest, per the scoreboard below.
   The bTungsten GF(16) evaluation shape produces the evaluation
   verdict that gets anchored — verified, never trusted alone.
3. Carrier writes, in order: (a) evanchor `anchor` action on the
   founder's chosen chain/account, signed+pushed by the signer
   lane (this crate family holds no keys, by its authority test);
   (b) the same statement bytes witnessed on Arweave via the
   vending upload door. Either carrier alone fails closed in
   `latest()`-style agreement reads.
4. "plank25" reads as plank-Poseidon at the interop seam
   (SHA3/SHA-256 native); no Vaulta-native ZK validator is
   designed around — none is verified to exist (auth-gated
   testnet proxy; reachable Antelope endpoints expose no ZK
   intrinsics). Validators, when foreign shapes need them, are
   WASM contracts priced by the measured CPU/NET below.

## Scoreboard (operator-side measured 2026-10-22, B9 statement;
## Vaulta columns measured at first live anchor — not yet taken)

| shape | proof bytes | prove (op) | verify (op) | Vaulta CPU/NET per verify | RAM/ordinal | setup | PQ |
|---|---|---|---|---|---|---|---|
| schnorr-bip340 | 64 | 2269us | 948–1629us | UNMEASURED | UNMEASURED | none | no |
| ml-dsa-65 | 3309 | 17008–22486us | 6821–9283us | UNMEASURED | UNMEASURED | none | yes |
| btungsten-gf16-eval | 32 | 37–39us | 22–23us | UNMEASURED | UNMEASURED | none | no |

bTungsten row: GF(16) tower circuit 102 gates (10 Toffoli-class),
evaluation-commitment shape in `crates/zk-adaptor` — honestly
bounded in its doc comment: no key, no identity binding, security
is SHA3 binding + deterministic re-evaluation, verifier ≈ prover.
Its measured edge is size/speed; authorization stays with the
signature shapes and anchoring is via evanchor above.

evanchor RAM per row is known by construction (one row per
subject, statement ≤124 B at fixed size, advancing = net RAM
delta 0 — anchor dispatch 2026-10-15); the scoreboard's
RAM/ordinal cell is filled from the live `get_table_rows` after
first inscription, not from the design.

## Unblock (unchanged in kind, exact)

Signer-lane act, founder's word: create/deploy under a named
account (testnet `bnrevanchor1` on Jungle4 was the POC's intent;
mainnet needs founder word per the anchor dispatch), env-place
the publisher key for the signer lane only, and the first
`anchor` push returns tx + CPU/NET receipts that complete the
scoreboard. This seat holds no Vaulta keys and invents none.
