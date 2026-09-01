# RECEIPT — the vending machine BUILT: one agent minted end-to-end and RESURRECTED from the certificate alone, hash-verified (2026-09-01)

Lane: SPEC-VENDING-1 §order-of-work item 2 → built as SPEC-VENDING-2 (this
tree). The headline property — **the species survives the estate** — is now
an artifact, not a plan: the Arweave birth certificate carries the recipe,
and a fresh process holding nothing but member-side inputs re-stood the
agent and proved the record's hash.

## THE MINT (the artifact of record)

| what | value |
|---|---|
| agent | `vendingtest` (house .a, rehearsal specimen, template `bqueenbee-genesis-1`, tongue `latvian`) |
| member key (ed25519 pub, hex) | `a340e1c1b4bb2a9df0cdecd6f94732b92f4c95d673450bf7fc7cc01ed6e0d7cc` PUBLIC-CONSTANT (TESTNET-ONLY key, temp vault, never the tree) |
| certificate | 3234 B canonical JSON · sha256 `90e746e8028e7c164abc28b128e02a7a071242d1cc8d4bc56b0cf7ea5a0d5ecd` PUBLIC-CONSTANT |
| Arweave id | `XviV59rLsgo2UxcitNlM4zoupGltUm6tBGqEcJX82UE` PUBLIC-CONSTANT — Turbo free tier, **winc: 0** |
| Vaulta pointer row | tx `8b7122ca787d528b160e50821f39727dfe09f9ba03526bd780640dcb70da3165` — `vending::update` (in-place, bounded) <!-- PUBLIC-CONSTANT: local rehearsal txid --> |
| law rows (same chain) | `rates[vaulta] = 0.6000 A` · `tithe = 1000 bp → kingbeelovis` · `init(admin, 7776)` |
| contract deploy | setcode tx `abc1726be1cacd521361f879c8e223f139f03c3d21791b715ab69b08262c5e10` · setabi tx `ede8bc2831ee79aad51fbb61fda6ae877f3e8eabfdaef8c50584322aeba2d6ea` <!-- PUBLIC-CONSTANT: local rehearsal txids --> |
| chain | LOCAL Spring 1.2.2 rehearsal, chain_id `8a34ec7df1b8cd06ff4a8abbaa7cc50300823350cadc59ab296cb00d104d2b8f` PUBLIC-CONSTANT — Vaulta's own consensus family; Jungle4/mainnet doors mapped in §doors below |

Certificate contents (self-describing, hash-carried): the five answers + THE
RECIPE (four layers, re-stand steps, contract source, spec of record) + the
ANT store binding with a REAL signed a1-genesis revision hash. Read it
yourself: https://arweave.net/XviV59rLsgo2UxcitNlM4zoupGltUm6tBGqEcJX82UE

## THE RESURRECTION (from the certificate alone)

`node resurrect.mjs vendingtest local` — a fresh process holding ONLY the
agent name (member-held input):

- **name road**: name → `vending` `certs` row → ar id (chain state read) ✓
- **gateway fetch** of the certificate bytes over public HTTPS ✓
- **hash gate**: re-derive canonical JSON → sha256 → equals in-record hash ✓
  AND equals the chain row's `content_hash` ✓ (three-way agreement)
- **recipe carried** (the species-survives property) ✓ · **five answers** ✓
- **forged-resurrection negative proof**: one flipped field ⇒ HASH MISMATCH ⇒
  refused ✓
- **owner/tags L1-index read**: pending the bundler's L1 batch (data leg
  served from fast-finality caches; GraphQL fills when the bundle posts) —
  appended below when it lands.

## THE A1 MEMORY FORMAT (ANT store binding, layer 2)

`node a1.mjs` self-test green: a shuffled 3-revision chain VERIFIES to its
head; a tampered middle revision is REFUSED. Genesis revision of `vendingtest`
signed under the member key, hash carried in the certificate. The FUNDED
Autonomi write remains gated on the ANT custody review
(storage-substrate-split item 8) — existing law, not crossed.

## §doors — what was probed live, and the one founder gesture

- **Arweave free tier, RSA door** (operational): throwaway RSA-4096 per mint,
  `winc: 0` receipted repeatedly. **Ed25519 door** (owner = member key, the
  target shape): receipted working at 06:0xZ (`F8f2GF_ToN4oRZbohhHGiaIo7MXZ-RdVPOje3jAZ7U4`, winc 0),
  then throttled (`Invalid Data Item`/503) after a morning of probe uploads
  from the box IP. Both doors documented in SPEC-VENDING-2 §ar-doors.
- **Turbo upload layout trap** (receipted so no future seat trips it):
  arbundles `SolanaSigner` 64-byte secret is **pub(32) ‖ seed(32)** — built
  seed-first, the class silently publishes the SEED as the item owner.
- **Jungle4 A-paralysis** (probed exhaustively): Greymass Fuel carries
  ordinary actions INCLUDING setcode/setabi (reached the RAM check — the
  deploy would fly) but blocks every resource action (delegatebw, buyram*).
  REX rentcpu and core.vaulta::buyram are fuel-covered but demand **A**, and
  A has no living faucet (grease/eosn dead from box AND local; eosio.faucet
  unfunded). Chain-wide staking yields ~2 µs/EOS (producers included).
  **UNBLOCK = one founder gesture: ~5 A from `kingbeelovis@jungle4` (111.5 A
  idle) → `bnrapolltest`; the whole landing is already scripted.**
- **Vaulta mainnet**: no agent-held account by law; the mainnet seat is a
  founder ceremony. The code is compiled and proven (wasm 25,918 B, abi 8,149 B).

## §sizing — re-read at build (the pricing law honored)

RAM 0.3498 EOS/KB marginal (rammarket base 74,724,125,941 B / quote
25,522,844.7087 EOS, 0.5/0.5) · EOS $0.074832 · 2026-09-01T08:28Z · block
517,882,094 · `eos.api.eosnation.io` (api.vaulta.com SNI-blocked from this
wifi — named, not worked around). Cert row ≈ 462 B ⇒ **≈ 0.16 EOS ≈ $0.012
per minted agent** at HEAD. Free-tier Arweave ⇒ $0 measured today, priced
never (R3).

## Strays (honest ledger)

Probe uploads from door-testing, all throwaway keys, all free tier:
`HnATcTfkdS…` (RSA probe), `Xf2lwOsUJY…` (RSA door check), `1Fg2arClLo…`
(first mint's cert — its chain row never landed; superseded by the re-mint),
`3Hcqk6wv13…` (placeholder-genesis cert, superseded in-place by
`vending::update`). The `F8f2GF_ToN4…` ed25519 probe item carries its own
seed as owner (the trap above) — throwaway in-memory key, harmless, kept as
the trap's receipt.

## The one-line

The machine is built: certificate hashed and permanent, pointer bounded and
member-owned, law rows governed-mutable, memory format owner-signed,
resurrection proven from member-held inputs alone — and the two doors that
remain (Jungle4 A-gift, mainnet seat) are founder gestures with every step
already scripted.
