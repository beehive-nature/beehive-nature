# SPEC-VENDING-2 — the vending machine BUILD (SPEC-VENDING-1 §order-of-work item 2)

Status: BUILT 2026-09-01 — mint + resurrection receipted in
docs/dispatches/RECEIPT_VENDING_MINT_2026-09-01.md · The genesis spec is
SPEC-VENDING-1 (@c8de310); this doc is the build: the formats, the laws the
code enforces, and the doors as measured — not as hoped.

## §certificate — the birth certificate format (the headline artifact)

Plain UTF-8 JSON, every field named in plain English, ~2–3 KiB, carried free
on Arweave's Turbo tier (≤105 KiB subsidized; **R3 stands: never price the
plan at $0** — the subsidy is ArDrive's, not a protocol guarantee).

- **Canonical form** (the hash depends on it, stated in-record): JSON with
  keys sorted at every level, no whitespace, UTF-8.
- **Content hash**: `sha256(canonical JSON of the record with hash.value
  removed)`. The record says this itself — readable and re-derivable in 1000
  years with only the SHA-256 specification.
- **The five answers** (§layers layer 1): what this agent is · who owns it
  (member ed25519 key hex + Vaulta account) · when minted (UTC) · where
  memory lives (the ANT store binding) · how to make another (→ recipe).
- **THE RECIPE** (§headline — the species survives the estate): the four
  layers, their roles, the re-stand steps, the contract source location, the
  spec of record. A stranger with this record can stand the machine up again.
- Tooling: `contracts/vending/tool/cert.mjs` (compose/canonicalize/hash/
  verify — one module, zero dependencies).

## §pointer-law — as built (both roads, both estate-free)

The certificate's location is DERIVED from what the member holds. Replication
is not the mechanism.

- **NAME ROAD**: agent name → `vending` contract `certs` row (FNV-1a-64 pk,
  exact-string collision refusal) → `ar_id` + `content_hash`. Chain state is
  public; the row is the member's own (their auth, their RAM, `release` is
  theirs).
- **KEY ROAD**: member ed25519 key → the record locates by its `Member-Key`
  tag; when the ed25519 signing door is open, the key ALSO equals the Arweave
  data-item **owner** (probe-receipted 2026-09-01, id `F8f2GF_ToN4oRZbohhHGiaIo7MXZ-RdVPOje3jAZ7U4`,
  winc 0) — first-class GraphQL `owners:` search, no estate involvement at all.
- **TAGS** on every certificate: `App-Name skaists-vending`, `Type
  agent-birth-certificate`, `Content-Type application/json`, `Agent-Name`,
  `Member-Key`, `Spec SPEC-VENDING-1`, `Hash-Algorithm sha256`.
- **CONTENT HASH** in three places, all compared at resurrection: inside the
  record, in the chain row, and (for road-2-only recovery) re-derived from the
  fetched bytes. A forged resurrection fails the hash — receipted.

## §ar-doors — measured, not hoped (read 2026-09-01)

- The upload door runs SERVER-SIDE on the oracle box (the wifi SNI wall is
  never the member's problem — the onboarding law).
- **RSA door (operational)**: Turbo arweave-token path, fresh throwaway RSA
  key per mint, `winc: 0` measured repeatedly. This minted the receipted
  certificate.
- **Ed25519 door (the target shape)**: `SolanaSigner`, 64-byte secret =
  **pub(32) ‖ seed(32)** (Solana layout — the arbundles class signs with the
  LAST 32 and publishes the FIRST 32 as owner; built wrong it silently puts
  the SEED in the owner field — trap receipted). Worked at 06:0xZ, then the
  door began refusing with `Invalid Data Item`/503 (free-tier throttling
  per-IP across many probe uploads). Both doors re-read at build time; the
  mint takes whichever is open, the certificate records which one signed.

## §contract — `vending` (contracts/vending/src/vending.cpp, CDT 4.x)

The law and the pointer, never bulk history (§layers layer 3):

| table | shape | law |
|---|---|---|
| `config` | singleton | admin · `max_certs` (the RAM bound — mint closes at the cap) · count · spec citation |
| `rates` | one row per rail, ≤32 | `basis` per call in A — **governed-mutable by founder word, no redeploy** |
| `tithe` | singleton | `percent_bp` (1000 = 10.00%) + destination — **THE TITHE = 10%, founder-word-only** |
| `certs` | ONE row per agent | name (full UTF-8, §charset law) · owner · member_key · ar_id(43) · content_hash(64) · template · tongue · minted |

- `mint` writes the member's row under **the member's own auth and RAM**;
  `update` re-points in place (bounded); `release` erases (RAM refund; the
  key road keeps working — the certificate outlives its row by design).
- Names: ANY UTF-8 (mīlestībairkaralis-class names mint whole — SPEC-A-NAMES-1
  §charset cited, not re-specified). pk = FNV-1a-64(bytes); collision ⇒ REFUSE,
  never hijack.
- Seeded law (rehearsal): `rates[vaulta] = 0.6000 A` (the b-meter basis),
  `tithe = 1000 bp → kingbeelovis`.
- Deploy: Jungle4 rehearsal blocked by A-paralysis (§deploy-doors); the
  receipted run is a **local Spring 1.2.2 chain** (Vaulta's own consensus
  family) — deploy + law rows + mint + update all executed there.

## §deploy-doors — the honest map (all probed live 2026-09-01)

- **Jungle4 (Vaulta community testnet)**: Greymass Fuel carries ordinary
  actions INCLUDING `setcode/setabi` (receipted: reached the RAM check) — but
  every resource-acquiring action (`delegatebw`, `buyram`, `buyrambytes`,
  `buyramself`) is fuel-blocked, REX `rentcpu` needs a fund deposit in **A**,
  `core.vaulta::buyram` (fuel-covered!) needs **A**, and **A has no faucet**.
  Chain-side staking yields ~2 µs CPU per EOS chain-wide (even producers) —
  the 8-29 era when `bnrapolltest` transacted freely is gone.
  **THE UNBLOCK = ONE FOUNDER GESTURE**: ~5 A from `kingbeelovis@jungle4`
  (111.5 A idle) to `bnrapolltest`; then fuel-covered `core.vaulta::buyram` →
  `setcode` → law rows → mint. Every step is already scripted in
  `contracts/vending/tool/`.
- **Vaulta mainnet**: no agent-held account (correctly — wallet ceremony
  law). The contract's mainnet seat is a founder ceremony; the code and ABI
  are compiled and proven.
- **Local Spring 1.2.2** (the rehearsal that ran): WSL, custom genesis,
  chain_id `8a34ec7d…`, accounts `vending`/`bnrapolltest`/`kingbeelovis`,
  setcode tx `abc1726b…`, law rows + mint + update receipted.

## §memory — the ANT store binding (layer 2 as built)

- Format: **a1-log v1** (`contracts/vending/tool/a1.mjs`) — append-only,
  hash-linked, owner-signed ed25519 (the member's own key), highest-VALID-
  revision wins; shuffled chains verify, tampered middles refuse (self-test
  green). Autonomi 2.0's immutability is WHY mutability lives in the log
  (storage-substrate-split §2 cited).
- The certificate carries a REAL signed genesis revision's hash
  (`a1_genesis.sha256`) — the day the store is funded, its first chunk is
  verifiable against this record.
- **The funded Autonomi write is GATED** on the ANT custody review
  (storage-substrate-split item 8) and priced honestly (~0.085 ANT/chunk
  live median + gas; never $0 — R3). This gate is existing law; the build
  does not cross it.

## §money — the Base layer (cited, not re-specified)

Payments in / cash-out through the proven PYUSD door; the $1/24h genesis
allowance and CREATE2 0xbee salt-not-key law are SPEC-A-NAMES-1 (cited). The
genesis mint needed no payment; the first PAID mint is the door's first
receipt and belongs to the founder-gated mainnet stand.

## §sizing — re-read at build time (the pricing law)

RAM 0.3498 EOS/KB marginal · rammarket base 74,724,125,941 B / quote
25,522,844.7087 EOS · weights 0.5/0.5 · EOS $0.074832 (CoinGecko) · read
2026-09-01T08:28Z at block 517,882,094 via `eos.api.eosnation.io` (the same
host as §sizing-basis; `api.vaulta.com` was SNI-blocked from this wifi —
noted, not worked around: agents don't ship VPNs). Cert row ≈ 462 B (112
overhead + ~350 payload) ≈ **0.16 EOS ≈ $0.012 per minted agent** at HEAD.
These move; re-read before any pricing claim.

## §fence — standing (do not re-open)

ANT farming is participation, not revenue. The tithe is the business.
SPEC-VENDING-1 §fence rules; the z2.1 objection was rejected as muddled and
that rejection is law.

## §what-the-receipt-proves — and what it does not

PROVEN (receipted, 11/11): certificate format + hash law; free-tier AR upload
of the real certificate; name-road derivation; in-place update; resurrection
from member-held inputs with hash verification; the KEY ROAD by GraphQL
Member-Key tag search (the member's key alone finds the record — L1 bundle
posted, 1 hit); forged-resurrection negative proof; A1 format; contract law
rows on a Vaulta-class chain; compile.
NOT YET (honestly): the pointer on a chain the estate does not control
(Jungle4 = one founder gesture; mainnet = one ceremony); the ed25519 owner-
equals-member-key door as the OPERATIONAL path (probed working, throttled
during the mint window — the RSA door + Member-Key tag carries the key road
meanwhile); the funded ANT write (custody-gated).
