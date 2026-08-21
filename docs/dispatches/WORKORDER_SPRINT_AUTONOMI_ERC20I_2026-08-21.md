# WORKORDER — the new sprint: deploy the newly updated repos, finish the ERC-20i estate, feed the mirror

**Founder's orders, verbatim, 2026-08-21:** *"new sprint deploy newly updated repos"* ·
*"we need to add Jedi, MiDi, Pepi v0 native Eth and all other family erc20i's to all
ui/ux"* · *"don't forget source links especially in mesuem"* · the mirror order (in
`SPEC-MIRROR-COMMONS-1`) · the Trezor lane (in `SPEC-AUTONOMI-TREZOR-1`).
**Seat 3 (Fable 5).** Research basis: the three-lane verified pass, this session.

## 0 · WHAT ALREADY LANDED THIS SESSION (no seat re-does these)

- Gallery overhauled for mobile (flex deck, real controls, swipe) — `9e15c1a`
- **PEPI eth** (`0x3103cD16…`, mainnet) in the gallery with true multi-chain RPC;
  Jedi + MiDi confirmed already aboard
- Museum **SOURCES & DOORS** wing: per-family contract/explorer/Sourcify links, live
  sites (every one fetched from this host first), our four doors, the receipted
  ERC-20i timeline (Fungi, Base, 2024-03-31, the first)
- The register layer (🐝/🎛/⚗) + the external-links-new-tab law on every page — `b48cc21`
- Mirror phase 1+2 harvester running; SPEC lands with this commit

## 1 · AUTONOMI LANE — the "newly updated repos", verified state

**WithAutonomi is the canonical successor org** (maidsafe/autonomi is ARCHIVED); all 27
repos pushed within the last 30 days; the stack was **relicensed GPLv3 → MIT/Apache-2.0**
(26/27 Apache; only `antget` stays GPL-3.0, fine as a standalone tool). The network is a
**pure post-quantum rewrite mid-transition** (ML-DSA-65 + ML-KEM-768; testnet phase 3 in
progress) — so write-path acts stay probe-sized until it settles.

| task | act | seat |
|---|---|---|
| **T1 · read-path receipt** (zero keys, zero cost) | install `ant` CLI 0.3.3 (sha256-digested release) + `antget` 0.1.1; fetch antget's documented public address `711c7e20…78a`; receipt the hashes. antget binaries carry gh-attestation provenance — our culture, their tooling. | **Seat 3**, WSL, this week |
| **T2 · local-devnet write E2E** (no real funds) | `ant-client` `start-local-devnet` (25 nodes + Anvil); upload the docs/receipts tarball, download back, receipt DataMap + hashes both directions | **goose** (Pop!OS native cargo); Seat 3 fallback |
| **T3 · production probe** | one small paid `--public` upload of a single receipt PDF via the **external-signer flow** (the Trezor lane's AT-1→AT-2 ceremony — keys stay in hardware by design, which beats any §4a script) | seat preps, **founder signs** |
| **T4 · mirror phase 3** | when AT-2 clears: `ant file cost` vs Arweave pricing on the staged vault, both numbers receipted, founder picks; permanent addresses appended to the mirror manifest | Seat 3 + founder |

**License tripwire, recorded:** crates.io `self_encryption 0.36.0` is still published
GPL-3.0 (the repo HEAD is relicensed, the registry is not), and ant-client's lockfile
pins it — every binary built against the registry today is a GPL-3.0 combined work.
Binds **redistribution only**, not use. We run such binaries; we do not ship them.

**x0x:** lives under **saorsa-labs**, not WithAutonomi. Watch gate AT-4; candidate
transport for bMessenger + the buzz studios when public.

## 2 · ERC-20i ESTATE — what remains after this session

| task | act | seat |
|---|---|---|
| **E1** | explorer + catalog + bnri-gallery sync: PEPI eth row (with its Ethereum chain tag) and the NTNT collection wherever families enumerate; catalog gains the receipted timeline footnote | zCode (UI lane) |
| **E2** | wings live-links: each wing card carries its museum SOURCES row's links (site-alive per the link gate; never the squatter domains) | zCode |
| **E3** | the official `ERC-20i/Pepi` repo: founder gate **PL-1** — accept in-file SPDX-MIT (10 of 12 files) as a grant? If yes those files upgrade to TAKE-per-MIT with attribution; `Erc20.sol`/`Airdrop.sol` stay patterns-only regardless. Sourcify remains the code-of-record cite either way | founder |
| **E4** | museum: a Neutants/NTNT facts row in FACTS (it renders in wings but carries no dossier) | zCode, low priority |

## 3 · STANDING CADENCE

- `mirror-harvest.mjs` re-runs weekly (append-only manifest; a changed government PDF
  is a catch, not an error) — Seat 3.
- `ant update` only after release notes are read (AT-5) — this week's notes changed
  payment semantics materially, which is the proof of the rule.

**Open founder gates this order adds: PL-1 (SPDX-MIT reading), plus the standing
AT-1…AT-3 and BS-1 already filed.** 🐝
