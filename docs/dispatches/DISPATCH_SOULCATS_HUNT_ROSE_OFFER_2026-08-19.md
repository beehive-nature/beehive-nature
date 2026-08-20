# DISPATCH — the soul-cats hunt answered, and the bRoSe OFFER mechanism

**From:** Seat 3 (Claude Code) · **2026-08-19** · founder-directed
**Method:** 6-lane research workflow (repo forensics, web hunt, mechanism prior art,
marketplace boarding, in-tree law, two-source chain analysis) — every license read at a
pinned commit body, every absence run with a positive control.
**Status:** OPEN — §1–§3 are findings; §4 is the mechanism map with gates R-1…R-4.

---

## 1 · The hunt: "soul cats + erc20i, planning something in 2024" — NOT one project

After seven search formulations plus full-text token search on Ethereum and Base
Blockscout: **no single project by that description exists — a clean absence, not a thin
trail.** The memory almost certainly fuses three real 2024 threads:

1. **Souli ($SOULI)** — a genuine **2024 ERC-20i art token on Base**
   (`0xb43eA104c7ec75038Ac8EcA57107Eefc8B039aFF`, deployed 2024-06-07, 1,150 holders).
   Seed-generated on-chain art with a stabilize-by-exact-transfer mechanic; its whitepaper
   survives only in a Wayback snapshot (the live GitBook is unpublished) and its market is
   dead (zero DexScreener pairs against a passing FUNGI control). Its art is **soul-flames,
   not cats** — but it is the *archived-2024-ERC-20i* the memory reaches for, and **a
   natural eighth entry for the museum's fallen wing** (gate R-4). Its documented
   exact-transfer rule is also the closest ERC-20i prior art for handing art intact to
   another wallet — directly relevant to §4.
2. **Cool Cats' soulbound program** — real and measured: "Cool Cats Avatars" on Polygon at
   `0xE9a4FD41d6E8f56B1E8C3789867ef9236a814a8e`, verified contract name literally
   **CoolBoundToken**, `mintSoulbound` active through 2024 and still minting 2026-07-15,
   1:1 items-to-owners (1,417/1,417). Plus the SideKX memorial SBT (2023) and a token tease
   (2024-12-19). **The soulbound-cats-in-2024 half of the memory is Cool Cats.** No
   ERC-20i-shaped contract traces to them.
3. **Quantum Cats** (Taproot Wizards, Jan 2024) — cats + inscriptions in 2024, but Bitcoin
   Ordinals, not ERC-20i.

Who "they" were remains UNVERIFIED — but the two halves of the memory each have a real,
receipted home.

## 2 · Core Cats: not soul cats — and raid-worthy anyway

**CoreCats (CCAT) is NOT the project**: created 2025-08-14 (both LICENSE files say
"Copyright (c) 2025"), the word "soul" appears **zero** times in either repo (grep with
positive controls), no ERC-20i/inscription reference anywhere, and the archived repo
(`core-cats-eth`) is a self-described *"Historical ETH rehearsal archive"* of the LIVE
project — a 1,000-piece free-mint, zero-royalty, fully on-chain 24×24 SVG cat collection,
**sold out on Core Blockchain** (the XCB/ICAN core-coin chain — not Core DAO, not
Ethereum) at `cb40316dcf944c9c2d4d1381653753a514e5e01d5df3`. Not soulbound: the active
contract's only override is `tokenURI`; transfers are stock CRC721.

**What IS worth taking (both repos L-VERIFY clean MIT at pinned commits `fc77a46` /
`3ca8920`):**
- The **packed-bytes on-chain data + SVG renderer** pipeline with a receipt discipline we'd
  recognize: 1000/1000 metadata parity AND 1000/1000 pixel-level parity checks, generated
  by one script, with an **EVM-portable reference copy** in `contracts/reference_eth/`.
- **No-admin-by-construction**: no Ownable, immutable renderer, free non-payable
  commit-reveal mint (MoonCat-lineage blockhash entropy) — grep-verified zero owner/admin
  paths. It is the renunciation ledger's Tier-3 "unnameable beats renounced" standard,
  shipped by strangers; their launch principles read like our own doctrine ("no retained
  owner/admin after deploy").
- **Museum verdict:** a strong *guest exhibit* candidate (fully on-chain, MIT, alive,
  values-aligned) — cataloged as a neighbor, never as an ERC-20i family member.

## 3 · Boarding verdicts on the reference repos (raid doctrine)

| target | license (L-VERIFY, pinned body) | verdict |
|---|---|---|
| ervikassingh/nft-market | **NO license ever committed** (API `license: null`, control-verified) — all-rights-reserved | **PATTERN only** — the value was the minimal end-to-end page taxonomy (mint/explore/collection/detail), which the Apiary already substantially implements; code must not board |
| IOTAplus/NFTMarketplace | SPDX header only, no LICENSE body; doesn't compile on OZ v4 or v5; a stats bug counts removals as sales | **PATTERN (strong), code LEAVE** — the 212-line shape is exactly the marketDEX chassis (ERC-721 escrow listings paid in one designated ERC-20 → USDC, bps fee, view-function enumeration a static page can read with no indexer). Rewrite the interface fresh |
| erc721.org | unlicensed ~2018 site | LEAVE — cite EIP-721 itself (CC0, Final) |
| vittominacori/cryptogift | MIT — but **NOT lock-and-redeem**: it force-pushes ETH and force-mints the 721 to the beneficiary in one tx, no claim step, and the owner can burn any holder's gift | LEAVE the mechanism; TAKE the date-gated message reveal; the author's **ERC-1363** (Final, MIT) is the clean pay-and-notify rail |
| Ankr soulbound tutorial | MIT in-snippet | PATTERN — the whole soulbound mechanic is one override (`_beforeTokenTransfer` requiring `from == address(0)`) |
| shobhitic gist | — | LEAVE — a pay-ERC20-to-mint vending machine with an unchecked transferFrom and owner sweep |
| **ERC-6551** token-bound accounts | Review status; canonical registry `0x000000006551c19487814612e58FE06813775758`; reference repo MIT-by-SPDX-headers, CertiK audit in-repo, no root LICENSE | **TAKE the shape** — the gift-721's bound account IS the basket; the basket travels with the token; no shared vault ever holds approvals |
| Peanut V4.4 | **GPL-3.0**, Secure3-audited | **PATTERN — reimplement, never paste** (copyleft): escrow keyed to a claim pubkey; recipient claims by signature; sender reclaims after timeout — offer, acceptance, lapse |
| Charged Particles | LICENSE body MIT (**the GitHub sidebar claims NOASSERTION — the sidebar lied again**) | production proof that an MIT NFT-basket exists |
| Linkdrop | unlicensed at pinned sha | untouchable |

## 4 · The bRoSe OFFER — "buy several erc20i, lock them, send one 721 as a gift/rose/Redemption"

**In-tree check first (law 11): no such shape exists yet, and the fences are already
placed.** SPEC-BNROSE-ONBOARD carries zero rose/gift/redemption language, and its lines
74-76 forbid *"receiving addresses owned by BNR anywhere in the flow"* — so **the vault is
a contract or the user, never BNR**. CONSENT-1 D-8 already discloses "lock/seal tokens
NFT-like (lock fee 0.1 BNRi)". The S-7 PermaLock already custodies one specific ERC-721
(wrong-NFT-rejecting `onERC721Received`) but is **ruled permanent and non-generalizable**
(founder ruling 2026-08-13: a parameterized variant must be a SEPARATE contract). The
2026-08-18 escrow-wire law stands: *"Locked inscriptions only trade."*

**The mechanism, assembled from receipted parts:**

1. **The basket** = an **ERC-6551 token-bound account** owned by the offer-721: the buyer
   sends the erc20i purchases into the 721's own account. No shared vault, no pooled
   approvals — transferring the 721 transfers the basket *by construction*.
2. **The offer ceremony** (Peanut-shaped, reimplemented clean-room under our license):
   the sender escrows the offer-721 keyed to a claim credential; **the recipient's
   signature IS the acceptance** — consent-first, never a forced airdrop (CONSENT-1's
   grammar); unclaimed offers **lapse** back to the sender after a timeout (the
   pawnbroker's 28-day redemption window in b-collateral-lending is the in-tree cadence
   ancestor).
3. **Addressing** = a `.b` name: the sender resolves `alice.b` per the fail-closed
   resolution algorithm; the claim credential travels over bMessenger rails as a pointer.
   Vaulta resolves the person; exSat holds the basket (the bnri-contracts 0.8.25/shanghai
   lane) — the Vaulta × exSat serving the founder asked to see.
4. **erc20i safety, from the measured mechanics:** transfer does NOT automatically destroy
   art (the debit is floor-delta; loose spores absorb first) — but Base-style wrong-amount
   transfers dissolve inscriptions, same-seed collisions inside one vault dissolve
   silently, and only **tier-2 id-addressed pieces** (`transferItem 0x67c65e99`) are safely
   lockable by piece. Souli's exact-transfer rule is the family's own prior art for
   handing art intact. The spec's stated preference stands: *"escrow the payment, never
   the art"* — the OFFER escrows the basket only where tier-2 addressing makes that safe.

**The blocking unknown is already named in-tree, and it gates this build:**
SPEC-ERC20I-MECHANICS-1 §10 — whether a locked record carries a **frozen seed or
recomputes from the holder** — "decides whether a marketplace can exist," and it equally
decides whether an offer-basket preserves the art it wraps. **No contract lands before
§10 resolves.**

**Naming caution (recorded, founder decides):** "voucher" is already three things in-tree
(CD-29 GasSponsorshipVoucher, bTiMe compute vouchers, human vouching), and CD-29's ruled
law says b is *"never a redemption ticket"* — the offer-721 redeems for **the locked art
only**, never for b. Working name here: **the bRoSe OFFER** (a rose handed, not a coupon).

**Trap shelf (from the boarding, binding on any build):** recipient verifies basket
contents at claim (pre-claim drain); the 721 must never enter its own bound account
(permanent lock); exact-amount approvals only; SafeERC20 everywhere; **no owner-privileged
burn/sweep/mutation anywhere in the gift path** (CryptoGift's owner-burn is the
counter-example). The contract enters `docs/ledger/renunciation-candidates.md` at write
time per the standing rule.

## 5 · Founder gates

| | question |
|---|---|
| **R-1** | the name: **bRoSe OFFER** (or your word) — "voucher" is triple-booked in-tree |
| **R-2** | confirm the build waits on MECHANICS-1 §10 (frozen-seed vs recompute) — the same unknown gating the marketplace |
| **R-3** | first chain: exSat (bnri-contracts lane, S-7 discipline, SEPARATE contract per the 2026-08-13 ruling) — confirm |
| **R-4** | museum: induct **Souli** into the fallen wing (the real archived 2024 ERC-20i), and catalog **CCAT** as a values-aligned guest exhibit (fully on-chain, MIT, no-admin-by-construction) — yes/no each |

**Seat 3, 2026-08-19.** Clones and receipts in the session scratchpad; pinned shas above
are the authority.
