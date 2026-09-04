# RECEIPT — the vending machine BUILT: one agent minted end-to-end and RESURRECTED from the certificate alone, hash-verified — **11/11 GREEN** (2026-09-01) · **LANDED ON JUNGLE4 2026-09-04: 11/11 GREEN AGAIN ON THE PUBLIC TESTNET**

## THE JUNGLE4 LANDING (2026-09-04, the founder's powerup gesture def01e80…)

The A-paralysis broke the moment the founder's powerup landed (1 day CPU/NET,
2026-09-03T23:57Z). The whole chain ran from `contracts/vending/tool/` with no
decision points:

| step | tx / value |
|---|---|
| RAM 72 KB | `b1fe7725a0d1578630fcc8b6fbd6f1d8db4dc730ebd6779c0a0552b0d37d042e` <!-- PUBLIC-CONSTANT: jungle4 txid --> |
| RAM +208 KB (setcode bills 264 KB on Spring — NOT just wasm size; trap banked) | `17d1df0c4ad51e674a5dc2a9b683e8ad8be05403c30bad2164a5e3b2f1102000` <!-- PUBLIC-CONSTANT: jungle4 txid --> |
| **setcode vending → bnrapolltest** (988 µs of powerup CPU) | `24b904391a5b405c7916976190da5451d14cd16b5ac02d39159823a4a6f41c35` <!-- PUBLIC-CONSTANT: jungle4 txid --> · code hash `a0fe4fdcf5dffc0323c458819c178a74bb7b46bdcf22c13df82ac22bacb76109` <!-- PUBLIC-CONSTANT --> |
| setabi (cleos re-push; the eosjs hex-JSON path stored an EMPTY abi on greymass — trap banked) | `822fd09465a2ed208d3f757f7da5e045aefb6c01e9dd71bc19eb585c17e0cafa` <!-- PUBLIC-CONSTANT: jungle4 txid --> |
| law: init(admin=bnrapolltest, max_certs=7776) | `0c540808f00e151b6453fa7f3b193448c85b9e7f13af6758897727936288b9fb` <!-- PUBLIC-CONSTANT: jungle4 txid --> |
| law: setrate vaulta = 0.6000 A | `71f0cee9f20549b4c93999afbc38cb0e20e82e42ef0c57936a6bd886c66e7f4a` <!-- PUBLIC-CONSTANT: jungle4 txid --> |
| law: settithe 1000 bp → kingbeelovis | `59207c1ad86d91f1f8fe44e77353be516136c296abb9c4ade22f9808161480b0` <!-- PUBLIC-CONSTANT: jungle4 txid --> |
| **THE MINT** (`vending::mint`, vendingtest) | **`d150f7d5f3b722ff05355c49d93ab2565a4437a8220da92588e40a328811d54e`** <!-- PUBLIC-CONSTANT: jungle4 txid --> |
| certificate (Jungle4 mint) | 3234 B · sha256 `f148272a98e9499d08aaca424ae908200012005d2d6b5c3a9c1794ae0962ab75` <!-- PUBLIC-CONSTANT --> · ar://`ITC5RPTM2zpzd0b8ehHBlFnYizDtVd9Wd9tAVIAcwPo` (winc 0) |

**PUBLIC EXPLORER LINKS:**
- the mint tx: https://eosauthority.com/tx/d150f7d5f3b722ff05355c49d93ab2565a4437a8220da92588e40a328811d54e?network=jungle <!-- PUBLIC-CONSTANT: jungle4 mint txid in explorer URL -->
- the account + pointer row: https://eosauthority.com/account/bnrapolltest?network=jungle
(the machine-verifiable leg, any public Jungle4 API: `get_table_rows
code=bnrapolltest scope=bnrapolltest table=certs` → the row with ar_id
ITC5RPTM… + content_hash f148272a… — read back live through both
jungle4.greymass.com and jungle4.cryptolions.io)

**RESURRECTION ON JUNGLE4 — `node resurrect.mjs vendingtest jungle4` — 11
pass, 0 fail**: the name road now reads chain state the estate DOES NOT
CONTROL; the key road returns 4 hits (every certificate this member key ever
minted — the member's own history, derivable, estate-free); hash gate
three-way green; forged-resurrection refused. The receipt's remaining "not
yet" from 2026-09-01 is now closed.

Cost of the landing, honestly: ~58.7 EOS in RAM (quota 292,213 B, most of it
the 264 KB setcode bill — sellram recovers what release frees), ~1 s of
powerup CPU, $0 Arweave.


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

## THE RESURRECTION (from the certificate alone) — FINAL, 11/11

`node resurrect.mjs vendingtest local` — a fresh process holding ONLY the
agent name (member-held input):

- **name road**: name → `vending` `certs` row → ar id (chain state read) ✓
- **gateway fetch** of the certificate bytes over public HTTPS ✓ (arweave.net
  302s to the fast-finality gateway; fetch follows redirects)
- **hash gate**: re-derive canonical JSON → sha256 → equals in-record hash ✓
  AND equals the chain row's `content_hash` ✓ (three-way agreement)
- **recipe carried** (the species-survives property) ✓ · **five answers** ✓
- **KEY ROAD, proven after the L1 bundle posted**: GraphQL
  `transactions(tags:[{name:"Member-Key", values:[<the member's own key>]}])`
  → **1 hit, the same ar id** — the member's key ALONE locates the record on
  Arweave, zero estate involvement ✓ · owner recorded
  `qmkTavp0kgkJI2wVJ6FQDD-FoRky324Ctp-Dpoi0L9Q` (the throwaway RSA uploader —
  the ed25519 owner=member-key door remains the target shape) ✓
- **forged-resurrection negative proof**: one flipped field ⇒ HASH MISMATCH ⇒
  refused ✓

`RESURRECTION PROVEN: 11 pass, 0 fail`

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
resurrection proven from member-held inputs alone (11/11 — both roads, the
hash gate, and the forged-fails proof) — and the two doors that remain
(Jungle4 A-gift, mainnet seat) are founder gestures with every step already
scripted.
