# SPEC-BNRI-INSCRIPTION-1 — ERC-20i INSCRIPTIONS, PEPi, AND WHAT BNRi ON exSAT SHOULD BE

**Status: DRAFT, unratified. Seat 3, 2026-08-15.**

Scope note: the address supplied as context (`0xd9bfc1bdf09a1f2ec395106a2388870e219f28e3`)
was used **only** to establish that it is not the token contract — `eth_getCode` on Base
returns `0x`, i.e. it is an externally-owned account. No balances, holdings, transactions
or portfolio of that account were read, and none appear below. Every statement about PEPi
in this document comes from the **contract**.

---

## §1 — THE THREE QUESTIONS, ANSWERED FIRST

### 1.1 "Would the chain account have to control the inscription for it to show up? Where?"

**No. Nowhere.**

The render function takes the seed as a **calldata argument**. It performs no `msg.sender`
check, no `balanceOf` check, no ownership lookup on any path. Anyone with an RPC endpoint
can hand PEPi's contract any seed they like and get finished artwork back.

Verified by live `eth_call` against Base mainnet: using the burn address and a synthetic
seed of 56 — holding nothing — `getMeta` returned `{"level":6,"background":"#db4161",
"bodyColor":"#538234","clothes":83,"eyes":12,"mouth":10,"accessory":41,...}` and `getSvg`
returned the full 32×32 artwork. A level-6 PEPi was rendered for an address that owns none.

So the answer to "where does it have to be controlled" is: **ownership is a completely
separate concern from rendering.** In ERC-20i the contract holds both, but they never touch:

| concern | where it lives in PEPi | gated on ownership? |
|---|---|---|
| **rendering** | `getSvg`, `getMeta`, `getItemData` — pure `view`, seed is an argument | **no** |
| **ownership** | `isOwnerOf(address,uint256)`, `mushroomCount(address)`, `mushroomOfOwnerByIndex(address,uint256)`, `sporesDegree(address)`, and the `OnMushroomTransfer` / `OnSporesGrow` / `OnSporesShrink` events | yes |

That is the same split already settled for the Trezor homescreen: **the renderer is a pure
function anyone can call; the trust claim has to come from independently reading the
ownership views for the address bound to device X.** The art is not the proof. It never was.

Also, the level arithmetic, since it was raised: **level 6 is `>= 56` PEPi, not `> 56`.**
`seedLevel6 = 56`, `lvl()` returns 5 at `seed >= seedLevel6`, and `getItemData` does
`data.lvl = rnd.lvl() + 1`. The thresholds are compile-time constants in bytecode
(`seedLevel2 = 11`, `3 = 22`, `4 = 33`, `5 = 44`, `6 = 56`; `levelsCount = 6`), not
owner-settable, not convention.

### 1.2 "Can you use their inscription(s)?"

**Technically yes, in one RPC call. Lawfully — no, not without asking.** See §3. The
constraint here is not engineering; the engineering is already done and demonstrated. The
constraint is that **no licence was found for the artwork**, and the direction of that
uncertainty is one-way.

### 1.3 "What does BNRi on exSAT need?"

Six things, in dependency order. Detail in §5 and §6.

1. **A keying decision, and it is the expensive-later one.** BNRi's art must be a *pure
   deterministic function of state any RPC caller can read* — no private inputs, no
   signer-only values, no off-chain oracle. **See §5.0**, which corrects an earlier and
   stricter version of this item.
   **What the two models actually cost:** Fungi's `(address, balance)` keying is
   derivable off-chain with **zero contract reads**. PEPi's (a stored `seed2` and an
   `extra` from an incrementing `_random_nonce`) is **not derivable — but it is
   readable**, which is the property verification needs. The trade is *one `eth_call`
   against event-driven art*, not *verifiable against unverifiable*. Both are sound;
   pick on how much the art should react to history. Choose now either way — it is a
   storage layout, and storage layouts do not get changed after deploy.
2. **A licence declared *in* the contract**, not only in an SPDX header on the source. §5.4.
3. **A Solidity toolchain the project does not currently have.** `find . -name '*.sol'`
   over the tree returns **0 files**; there is no `foundry.toml`, no `hardhat.config`, no
   `remappings.txt` anywhere in the repo.
4. **`evm_version = "paris"`.** Not the solc default. This is a hard deploy constraint. §6.2.
5. **A rasterisation contract.** ERC-20i emits SVG at 24×24 or 32×32 logical pixels; the
   verified Trezor path renders a **380×520 JPEG**. That step is currently unspecified
   anywhere in the tree and must be byte-deterministic if any receipt is to reproduce. §7.
6. **The real ABI, to replace ten placeholders.** `crates/chain-exsat-evm/src/signatures.rs`
   holds `BNRI_GENESIS_V0_UNVERIFIED` — ten `PLACEHOLDER_*` entries, correctly refused by
   `SignatureTable::new` unless `allow_unverified_signatures` is set. No BNRi contract
   exists anywhere in the tree today.

---

## §2 — HOW ERC-20i ACTUALLY WORKS

### 2.1 It is not an EIP

There is no EIP or ERC document for "ERC-20i". It is a naming convention attached to a
specific contract lineage, originating with **Fungi** on Base
(`0x7d9ce55d54ff3feddb611fc63ff63ec01f26d15f`, deployed 2024-03-31T16:57:09Z, creation tx
`0x10c3371fa313a621f9df2dc0f8e161a677b382c27829cdb1461bade47569f336`). **Joining ERC-20i <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->
means adopting a de-facto contract shape, not conforming to a registered standard** — there
is no conformance test and no registry to be listed in.

The `i` adds **no new external interface**. The ERC-20 ABI is untouched:
`transfer`/`transferFrom`/`balanceOf`/`approve` are all standard. What is added is
(a) a per-holder `SeedData` struct maintained inside `_transfer`, and (b) on-chain
generative rendering view functions.

### 2.2 Where the art lives: generated as an SVG string, in Solidity, at read time

Not calldata inscriptions. Not IPFS. Not Arweave. **No `tokenURI`, no base64 data URI, no
CID anywhere in either ABI.** The contract holds pixel-rect layer data in storage — uploaded
post-deployment through owner-only setters (`setStems`/`setCaps`/`setDots`/`setSpores` on
Fungi; `setBodies`/`setCloths`/`setEyes`/`setMouths`/`setHats`/`setEars`/`setAccessories` on
PEPi) — and **concatenates a literal SVG document in Solidity** when you call the view.

```solidity
struct SeedData { uint seed; uint seed2; uint extra; }          // PEPi
function getSvg(SeedData calldata seed_data) external view returns (string memory);
function getMeta(SeedData calldata seed_data) external view returns (string memory);
function getItemData(SeedData calldata seed_data) external view returns (ItemData memory);
```

`getSvg` is a one-liner: `return toSvg(this.getItemData(seed_data));`. The private `toSvg`
composes `"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"` then
`backgroundSvg, bodySvg, clothSvg, earsSvg, mouthSvg, eyesSvg, accessorySvg, hatSvg` — flat
coloured `<rect>` elements, no raster, no external reference.

| | Fungi | PEPi (Base) |
|---|---|---|
| signature | `getSvg((uint256,uint256))` | `getSvg((uint256,uint256,uint256))` |
| selector | `0x422b9e23` | `0xa435130b` |
| grid | 24×24 (`pixelsCount = 24`) | 32×32 (`pixelsCount = 32`) |
| observed return | 2,471 bytes of `<svg …viewBox='0 0 24 24'>…` | 7,352 bytes of `<svg …viewBox='0 0 32 32'>…` |

`getMeta` selector is `0x63f6e78c`. `sporesDegree(address)` is `0xa775188a`;
`mushroomOfOwnerByIndex(address,uint256)` is `0x0fd9587e`. Byte-level corroboration: PEPi's
21,581-byte runtime contains the literal ASCII strings `<svg xmlns='http://www.w3.org/20`
and `<rect x='`.

### 2.3 How it is keyed — and the determinism fork

**Fungi:** `SeedData { uint seed; uint extra; }`. In `trySeedTransfer`,
`uint seed = amount / (10 ** decimals())` — **the seed is the balance in whole tokens**, and
`extra` is `uint(keccak256(abi.encode(account)))`. So Fungi art = `f(whole-token balance,
keccak256(abi.encode(holder)))`. There is no per-token id; **the balance IS the id.** That
is the ERC-20i trick.

**PEPi** extends it with a third word: `_spores[account].seed2 =
RandLib.random_value(++_random_nonce)` and `extra = keccak256(abi.encodePacked(account,
++_random_nonce))`. `_random_nonce` is contract-mutable and advances on every transfer.

Rendering is deterministic in **both** — `RandLib.next(Rand) = uint(keccak256(
abi.encodePacked(rnd.seed + rnd.nonce++ - 1, rnd.extra)))`; pure keccak, no `block.timestamp`,
no `blockhash`, no `prevrandao`, no private input. Given a `SeedData`, anyone reproduces the
exact SVG off-chain.

**The difference is whether you can *derive* the SeedData:**

- **Fungi: yes.** From public chain state alone, zero extra reads.
- **PEPi: no.** You must read the stored struct from the contract, because `seed2` and
  `extra` depend on a mutable on-chain nonce.

That fork is the single most consequential design choice available to BNRi. See §5.1.

### 2.4 The lineage is alive, and still moving

Checked 2026-08-15. Fungi: 46,969 holders, transfers today. PEPi (Base): 18,064 holders,
62,533 lifetime transfers, `mushroomsTotalCount()` = 167 mature inscriptions ever formed,
transfers today. A structurally **new** generation was deployed to Ethereum mainnet on
2026-03-03 (`0x3103cd1602d5fa8f4b9283f9d5a7fa2290795d51`): `SeedData { uint8 lvl; uint256
value; uint256 seed1; uint256 seed2; }`, explicit per-item ids, `transferItem(address,
uint256)`, `itemIdsByValue`, `getOwnerItemsPage`, `OnItemMint`/`OnItemTransfer`/
`OnItemBurn`/`OnRoeGrow`/`OnRoeShrink`, and "roe" for the fractional remainder — i.e. it has
drifted **back toward per-token ids**. BNRi would be joining a **live practice, not a live
standard**.

### 2.5 Real ERC-20i event topics — for reference only, do NOT paste into the BNRi table

`crates/chain-exsat-evm/src/signatures.rs:107-167` holds ten `PLACEHOLDER_*` entries. The
actual ERC-20i lineage emits nothing resembling those names. Recorded here so the *shape* of
a real ERC-20i event set is on the record — **these are other projects' signatures**:

| event | topic0 |
|---|---|
| `OnMushroomTransfer(address,address,(uint256,uint256,uint256))` | `0x6ff3d06dc3f0549ae8f3284ae87ffdc9b4547229c3062c11c22b80b1fc40865e` | <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->
| `OnSporesGrow(address,(uint256,uint256,uint256))` | `0xc0ed2f507ba32ecf45fa2603886bf221661ac1ac706468fb1bb203b073348d06` | <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->
| `OnSporesShrink(address,(uint256,uint256,uint256))` | `0x3680d86cad43530d49d879ddd9012f83a955bc07d08ec59bbc4a7bf723a87128` | <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->

(2-word `SeedData` variants: `0x882cd5197c658fe29ff1ed21d4a9c2c50495592e1e9337e75267eff5a3c65302`, <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->
`0x00fb093446d003bea3dc7db8b593d37cc6a34ea254b80cd1aa5d942b828a5d6d`, <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->
`0xaa626bf76e4a6a5b23f2cd43ad5451ce8410ccdca0112dc86a79b5964f177edc`.) The keccak <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->
implementation used was pinned to the same published vectors `abi.rs` uses —
`keccak256("") = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470` and <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->
`Transfer(address,address,uint256) = 0xddf252ad…` — before these were computed.

---

## §3 — THE LICENSING ANSWER

**No licence was found for PEPi's artwork, and therefore we DO NOT USE IT — not one rect, not one render — unless and until an identifiable rights holder gives us an explicit written grant.**

That is the whole answer. What follows is why it is not softer than that.

**What the MIT header does and does not cover.** Every `.sol` file carries
`// SPDX-License-Identifier: MIT`. That is a licence on the **source code**. It is not, on
its face, a grant to reproduce the resulting pixel artwork in a hardware product — and
critically, **the artwork is not in the `.sol` files at all.** The trait rectangles were
uploaded *after* deployment, as calldata through `setBodies`/`setCloths`/`setEyes`/
`setMouths`/`setAccessories`/`setHats`/`setEars`. The MIT header does not even sit on the
bytes that constitute the images.

**No licence was asserted anywhere else, either.** Blockscout's licence field for the
contract reads `license_type: "none"` — the deployer never asserted one. The project URL is
baked *immutably into the contract's own metadata* (`string constant web =
"https://pepe-erc20i.vip/"`, emitted into every `getMeta` output) and **that domain is
dead** — resolves to a parking range, refuses connections on 443. The current site `pepi.sh`
is a JS shell; its full 2,906,280-byte bundle contains **zero** occurrences of licence,
license, terms of, copyright, rights reserved, public domain, or CC0.

**There is no convention that fills the gap.** CC0 in NFT art is always an affirmative,
announced act — Moonbirds' shift was a deliberate unilateral relicensing; Nouns-style
projects declare it loudly. a16z published the "Can't Be Evil" licence suite in 2022
precisely because no default grant existed. The legal baseline absent an express grant is
**all rights reserved**. *"It's on-chain and anyone can read it"* is an **access** fact, not
a **licence** fact.

**The provenance problem is one layer deeper than PEPi.** PEPi is itself a fork of Fungi and
did not rename its internals — the verified source still declares `abstract contract
Mushrooms is PoolCreatableErc20i`, with `mapping(address owner => SeedData seed_data)
_spores;`, `_mushroomsTotalCount`, `OnSporesGrow`. Fungi's own domain now serves an
unrelated Turkish content farm and `fungifungi.art/whitepaper.pdf` returns HTTP 404. **Even
a grant from PEPi's operators would not obviously clear the upstream layer.**

**Asking is possible but weak.** Live channels exist — Telegram `t.me/pepe_ERC20i` (511
subscribers, hardcoded in the contract's own source header), X `@Pepi_ERC20i` and
`@Pepeinscribed`. No Discord, no email, no named team, no company, no legal entity, no
repository; deployer `0x1609e546E316297b64186c6cF7d504AbEECCAdC3` is unattributed. **An
anonymous admin's "gm sure" is not a licence from an identifiable copyright holder and would
not survive a later challenge.** If we ask anyway: ask for an explicit written grant or a
public CC0 declaration *naming the contract address*, and keep the reply as a receipt — but
do not treat a casual yes as clearance.

**And it would contradict our own posture.** `docs/specs/SPEC-BLICENSE-0.md` is building a
program where an artist picks licence terms the way they pick LP options, and it opens with
an explicit "THIS IS NOT LEGAL ADVICE" and an insistence that text be reviewed by counsel
before an artist relies on it. Rendering someone else's unlicensed art inside a product
built on that spec is not a position we can hold.

*Not legal advice. This is a Seat 3 engineering finding about what was and was not found.*

---

## §4 — WHAT DISPLAYING PROVES, AND WHAT IT DOES NOT

Seat 3 demonstrated today that a Trezor Safe 7 renders any 380×520 JPEG via
`trezorui_api.confirm_homescreen(title, image)` — byte-verified, receipt at
`docs/receipts/RECEIPT_T3W1_BCOMB_FIRSTLIGHT_2026-08-15.md`. **Displaying is solved.**

**Displaying proves nothing about holdings.** The homescreen is **host-supplied**. A
compromised or merely lying host can push art for tokens the user does not hold. Art on a
screen is a picture, not an attestation — and this is structurally identical to §1.1: PEPi's
own renderer will hand a level-6 image to an address holding nothing. **A page must not be
its own witness.**

The design answer, already established: **the device signs "I am device X", and a verifier
independently reads chain state for the address bound to X.** The device never needs chain
awareness.

### Where the check could live

| the check lives… | what it would take | why it fails / wins |
|---|---|---|
| **on the device** | firmware with an RPC client, chain-state parsing, a trusted view of head, and a fork-choice model — on a device with no network stack of its own and a signed-firmware review burden for every chain change | **Fails.** It imports a whole chain client and its trust assumptions into the most security-critical, hardest-to-update component we have, to answer a question the device does not need to answer. Also unnameable-vs-forbidden: a device with no chain awareness *cannot* be tricked about chain state. |
| **on the host** | nothing — the host already draws the homescreen | **Fails, and this is the trap.** The host is exactly the party whose honesty is in question. Host-side "verification" is the host marking its own homework; a compromised host supplies both the art and the claim about it. |
| **verifier-side** | the device signs a device-identity statement; any third party reads chain state for the address bound to X, re-derives the art, and compares | **Wins.** Every component is independently checkable by anyone, the foreign-oracle rule is satisfiable (ask the chain, not the wallet that drew the picture), the device stays dumb and therefore un-trickable, and the check works for a verifier who trusts neither the host nor us. |

**The one property that makes verifier-side possible at all** is that the art be
reproducible by a third party from chain state. That is not automatic — it is §5.1, and it
is a storage-layout decision.

---

## §5 — BNRi RECOMMENDATIONS

We control this design. These are the things to do differently.

### 5.0 CORRECTION 2026-08-15 — §5.1 below states the requirement TOO STRONGLY

**goose's PEPi seed verification (`8ff40f6`) shows the constraint this document argues for
is stricter than the property it needs, and would cost BNRi its most interesting mechanics
for nothing.**

PEPi's determinism decomposes into **three separable streams**, not one:

| stream | keyed to | behaviour |
|---|---|---|
| `seed` | **balance** | whole-token snapshot; zeroes below 1 whole token, restores on the way back up |
| `seed2` | **event randomness** | `RandLib.random_value(++_random_nonce)` — a separate nonce stream, rolling **per inscription event, not per balance** |
| `extra` | **address identity** | `keccak256(account ‖ nonce)` — fixed per wallet, modulo inscription events |

**So PEPi's art is NOT derivable from `(address, balance)` alone — and it does not need to
be.** §5.1's requirement conflates two different things:

| | requirement | what it costs |
|---|---|---|
| **§5.1 as written** | art **derivable** from `(address, balance)` alone | forbids event-driven variation entirely. The art could never respond to anything except a number going up |
| **what verifier-side checking actually needs** | art **deterministic given the on-chain seeds**, and **those seeds readable** | one extra `eth_call`, and every mechanic survives |

**A verifier does not have to *derive* the seeds. It reads them, renders deterministically,
and compares.** That is the whole requirement, and **PEPi already satisfies it** — `getSvg`
is `external view` and the seed accessor is public.

**Corrected recommendation, superseding §5.1:**

> **BNRi's art must be a pure deterministic function of state that any RPC caller can read.**
> No private inputs, no signer-only values, no off-chain oracles. Event-driven randomness is
> **permitted and encouraged**, provided the resulting seed is publicly readable.

The failure mode §5.1 was reaching for is real but narrower: **art that depends on something
a verifier cannot obtain** breaks the anti-MiM check. Event randomness stored on-chain is
obtainable. A private input is not. **That is the line, and it is much further out than
§5.1 drew it.**

*(Methodological note worth keeping, also from `8ff40f6`: the runtime bytecode contains
**zero** occurrences of `3b9aca00` (10⁹), because the division uses a dynamic `decimals()`
call. **A bytecode-pattern check would have silently missed the seed's units** — this seat's
own probe was string-extraction over bytecode, and would have found nothing. Source was
necessary and Sourcify had it.)*

### 5.1 Key the art on `(address, balance)` and nothing else — SUPERSEDED BY §5.0

**Recommendation: BNRi art MUST be a pure deterministic function of `(holder address,
whole-token balance)`, with no stored per-holder randomness and no dependence on any mutable
contract state.** Fungi's model, not PEPi's.

Why this is the load-bearing choice:

- **It is what makes verifier-side checking possible.** A verifier holding only an address
  and an RPC can compute the expected artwork *itself* and compare it against what the
  device displayed. With PEPi's stored-nonce keying, the verifier must ask the contract what
  the art is — reintroducing a read the verifier cannot audit from first principles, and
  making offline and archival verification impossible.
- **It costs nothing now and cannot be retrofitted.** It is a storage layout. After deploy,
  changing it means a new contract and a migration.
- **It removes an entire class of state bugs.** No `_random_nonce`, no five write sites, no
  question of what the seed was at block N.

Concretely: `seed = balanceOf(holder) / 10**decimals()`;
`extra = uint(keccak256(abi.encode(holder)))`; render = pure keccak expansion over those two
words. Publish the derivation as a spec section, so a third-party implementation is possible
without reading our Solidity.

**Consequence to accept honestly:** with balance-derived art, the image changes when the
balance changes. That is the ERC-20i bargain — the balance *is* the id — and it must be
stated plainly in whatever the user sees, or people will report it as a bug.

### 5.2 Generate our own layer data. Do not reuse anyone's.

This moots §3 entirely. The MIT-licensed **contract pattern** is on solid ground to reuse;
another project's on-chain sprite data, project names, and the Pepe likeness (with its own
upstream IP history) are a different object.

### 5.3 Split token from renderer; put data in code, not storage

- A BNRi **token** contract and a separate **renderer** contract, so EIP-170 binds only on
  logic (§6.3).
- Palette and trait data as **SSTORE2/SSTORE3** data-only contracts read via `EXTCODECOPY`.
- **Generate from seed rather than store**, which is what PEPi does and why it fits at all.

### 5.4 Declare the licence *in* the contract

**Recommended: dedicate the BNRi artwork to the public domain under CC0-1.0, and say so
on-chain.** The reasoning is not generosity, it is mechanism: **verifier-side checking
requires that any third party be able to reproduce our art.** A licence that makes a
verifier's render an infringement breaks the design. CC0 is the only choice that removes the
question for every future verifier without anyone having to ask us.

Do it the way `SPEC-BLICENSE-0 §1` contemplates — a machine-readable ccREL/schema.org
`license` field pointing at an immutable licence URI, exposed in the metadata the renderer
emits — **not only** an SPDX header on the source, which §3 shows does not travel with the
art.

Contract **source** licensing is a separate line and follows house policy rather than this
spec: `docs/LICENSING.md` sets AGPL-3.0-only for the kernel and a standing intent of
`MIT OR Apache-2.0` for SDK edges. **Which of those a deployed EVM art contract is, is a
founder ruling** (§7), not a Seat 3 call.

**And: do not hardcode a mutable-world URL into immutable metadata.** PEPi baked
`https://pepe-erc20i.vip/` permanently into every piece of metadata it will ever emit, and
that domain is now dead. If a URI goes into immutable bytes, it must be **content-addressed**.

### 5.5 Keep the device dumb

Nothing in §5 or §6 touches firmware. The device signs "I am device X"; the verifier does
the rest. That property is worth defending against every future proposal to "just have the
device check".

---

## §6 — COSTS AND CONSTRAINTS ON exSAT, HONESTLY

### 6.1 What exSat is, verified live

`eth_chainId` → `0x1c20` = **7200**; `net_version` → `7200`. This confirms
`EXSAT_MAINNET_CHAIN_ID: u64 = 7200` at `crates/chain-exsat-evm/src/indexer.rs:61`, a
verification the crate's README names as a caller obligation it cannot discharge itself —
now discharged by observation for `https://evm.exsat.network`. `web3_clientVersion` returns
literally `"EOS EVM Node"`. Gas token is **BTC at 18 decimals**; blocks are ~1s.

### 6.2 HARD DEPLOY CONSTRAINT: compile with `evm_version = "paris"`

EOS EVM went **Istanbul → Shanghai** and there is no announced Cancun support. Cancun
opcodes are therefore absent: `TSTORE`/`TLOAD` (EIP-1153), `MCOPY` (EIP-5656), `BLOBHASH`.

**This matters directly for an on-chain SVG contract**, because `solc >= 0.8.25` defaults
its EVM target to `cancun` and will emit `MCOPY` for memory copies — exactly the operation
string concatenation does constantly. Deployed bytecode would hit an invalid opcode at
runtime.

Empirical confirmation from exSat production: both verified contracts pulled from the
explorer are `solc v0.8.26+commit.8a97fa7a` with `"evm_version": "paris"` —
`0xDCe4393eA8DE3BbE54c4700e40d710F501448b04` and `0x98613435b6c2F62bbE8ae700e44cf14720272379`,
optimizer on, 9999 runs. Production practice on exSat is `paris`, one notch below even
Shanghai, meaning deployers are not relying on `PUSH0` either.

**Action:** set `evm_version = "paris"` in the build config, and **assert the emitted runtime
contains no `0x5c`/`0x5d`/`0x5e`/`0x5f` before deploying.**

### 6.3 EIP-170 is the binding constraint, and PEPi shows how tight it is

PEPi's deployed runtime is **21,581 bytes against EIP-170's 24,576** — **87.8% consumed,
2,995 bytes of headroom, for a 32×32 pixel grid.** At the 380×520 geometry the Trezor path
verified, a naive on-chain SVG emitting one `<rect>` per pixel is not merely expensive, it is
structurally impossible to express in 24 KiB if palette or coordinate data lives as bytecode
constants. Hence §5.3. (Targeting `paris` means EIP-3860 initcode metering is not charged;
the EIP-170 **runtime** limit is Spurious Dragon and binds regardless.)

### 6.4 Gas: cheap, but sell the predictability, not the cheapness

Observed live: `eth_gasPrice` = `0x7a120` = **500,000 wei** (0.0005 gwei); `baseFeePerGas`
identical; `eth_maxPriorityFeePerGas` = `0x0`; network utilisation **0.0%**. Block `gasLimit`
is `0x7ffffffffff` = **8,796,093,022,207** — roughly 250,000× Ethereum's. The price is a
**configured parameter** of the EOS EVM contract on the native layer, not a market-cleared
EIP-1559 fee, so **it does not spike**.

Worked deploy cost for a PEPi-sized 21,581-byte contract: code deposit 200 gas/byte =
4,316,200; ~22 KB initcode calldata at 16 gas/byte ≈ 352,000; tx base 21,000; constructor and
storage ≈ 200,000 → **≈4.9M gas ≈ 2.45e12 wei = 245 satoshis**, ≈ **$0.15** at the BTC price
observed 2026-08-15.

**Honest caveat, and do not repeat the comparison as fact:** Base's per-gas figure at the
same instant was *lower*, and Base's L1 data-availability fee — the dominant term for a
~22 KB deploy, and not charged on exSat — **was not measured**. "exSat is cheaper than Base
for a large deploy" is **UNVERIFIED**. USD figures are a single snapshot; the
BTC-denominated ~245 sats is the stable number.

**The real advantage is the block gas limit and price stability**, not the headline price.
On exSat a render heavy enough to be uncallable on Ethereum is affordable. That is the one
place exSat is genuinely differentiated.

### 6.5 Facts about the RPC that change how the indexer must be built

**Settled today (was UNVERIFIED in the crate README):** exSat's RPC **does** emit
spec-conformant `logIndex`, `removed`, `blockHash` and `transactionIndex`. Confirmed on
`eth_getTransactionReceipt` for tx
`0x0cc12a1488a6906210e145e6713d9ae3b375f06b683e8b0cc47db787382d634b` (block `0x37ace2a`). <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->
Better: the topic0 values on those logs are `0xddf252ad…` (ERC-20 `Transfer`) and
`0x8c5be1e5…` (`Approval`) — **byte-identical to the two known-answer vectors `abi.rs`
already pins.** The decoder is validated against live exSat data without changing a line, and
the `(block_number, tx_hash, log_index)` idempotency key is well-founded on this chain.

**New caveat, not in the repo: exSat block headers are partially synthetic.**
`eth_getBlockByNumber` returns `stateRoot`, `receiptsRoot` and header `gasUsed` all **zeroed**
— even for a block whose receipt shows 150,450 gas consumed. `difficulty` is `0x1`,
`sha3Uncles` zeroed. **Any future validation leaning on those header fields will read zero
and must not treat that as meaningful.** `hash` and `parentHash` *are* populated with real
distinct values, and parent-hash linkage is the only header field `reorg::ChainTracker`
consumes, so the reorg design is unaffected.

**New caller obligation: the public gateway is method-restricted.** `https://evm.exsat.network`
is fronted by openresty with an allowlist. Working: `eth_chainId`, `net_version`,
`eth_protocolVersion`, `eth_gasPrice`, `eth_maxPriorityFeePerGas`, `eth_getBlockByNumber`,
`eth_getLogs`, `eth_getTransactionReceipt`, `eth_getCode`, `eth_call`, `web3_clientVersion`.
**HTTP 403: `eth_syncing`, `eth_feeHistory`.** So node-lag detection is unavailable from that
endpoint — which is precisely the failure mode behind the README's documented silent-drop
residue. Running the adapter for real needs a self-hosted exSat EVM node or a less restricted
provider.

### 6.6 The honest surface-area cost of exSat as a third chain

`chain-exsat-evm` is **not a stub** — five modules, ~105 KB: `abi.rs` (hand-rolled EVM log
decoder pinned to published keccak vectors), `indexer.rs`, `reorg.rs`, `cursor.rs`,
`signatures.rs`. It is read-only, holds no keys, signs nothing, cannot construct transactions,
and deliberately pulls in neither `alloy` nor `ethers` because those would import a signing
surface into a read-only indexer. It has **no RPC transport** — `LogSource` is a named trait
seam — so against a live chain it indexes nothing today.

What exSat costs that nothing else in the tree does:

1. **The reorg machinery exists solely for this chain.** `reorg.rs` plus both documented
   unrecoverable halts (`ReorgBelowEmitted` latching permanently; one undecodable log wedging
   the indexer) are pure exSat tax. Vaulta on Savanna has instant finality; Arweave is pull.
2. **No Solidity toolchain exists** (§1.3 item 3). BNRi means adopting solc, a test
   framework, a Blockscout verification flow, and an audit surface in a language the project
   does not currently build.
3. **A third gas asset.** Gas on exSat is BTC, which must be custodied to deploy or write.
   The `b` boundary is explicit and correct — never an EVM token, never bridged, never gas —
   and that is exactly what makes exSat gas a **new treasury line**, not a reuse.
4. **`confirmation_depth` is unmeasured.** The crate ships no default, deliberately.
   Operating it requires a measurement campaign against a live endpoint that has not happened.
5. **Low activity cuts both ways.** 2,203,448 lifetime transactions, 49 today, 0.0%
   utilisation. Upside: guaranteed block space, stable price, likely small confirmation depth.
   **Downside: deploying BNRi on exSat places it where essentially no one is looking** — there
   is no wallet-display or secondary-market ecosystem for an ERC-20i on exSat comparable to
   PEPi's on Base. If BNRi's value is the on-chain art plus verifier-side device binding
   (which needs no third-party indexer), that is survivable. If it depends on wallets
   rendering it natively, it is not. **Founder decision, but the number should be visible.**

Offsetting all of that: the read side is already written, already tested, already fail-closed,
and its decoder was validated against live exSat logs today at zero cost. **The marginal cost
of exSat is now almost entirely on the write side.**

---

## §7 — WHAT IS OWED, AND WHAT NEEDS A FOUNDER RULING

### 7.1 Still UNVERIFIED — stays marked

| item | status |
|---|---|
| **Which PEPi deployment the project calls "v2"** | **UNVERIFIED.** Three live contracts share the PEPI symbol: Base `0x19706c142d33376240e418d6385f05691a5fa8e2` ("Pepe Inscriptions", 2024-04-10), Base `0x28a5e71bfc02723eac17e39c84c5190415c0de9f` ("PEPi", 2024-04-24), Ethereum `0x3103cd1602d5fa8f4b9283f9d5a7fa2290795d51` ("PEPi", 2026-03-03, items+roe). Everything in this document about "PEPi" is read from the **Base 0x28a5e71b** contract, identified by name/symbol and by its `seedLevel6 = 56` matching the founder's own statement. CoinGecko describes that Base address as the **old** contract and the Ethereum one as current. basescan.org was unreachable (ECONNRESET) and pepi.sh returned 403, so this could not be adjudicated. **Confirm with the founder before citing either as "v2" in any downstream doc.** |
| **Any claim about ERC-20i author *intent*** | **UNVERIFIED / unsourced.** No project-published spec exists that could be retrieved: `fungifungi.art/whitepaper.pdf` → HTTP 404; `pepe-erc20i.vip` → connection refused. Everything mechanical above is read from verified on-chain source and confirmed by live `eth_call`, **not** from project documentation. |
| **exSat testnet chain id** | **UNVERIFIED.** Docs say 840000; 839999 has also been reported. `https://evm2.exactsat.io` returned Cloudflare 522 today, so no `eth_chainId` confirmation was obtainable. **The crate should keep shipping neither constant.** Note 840,000 is also the Bitcoin halving height exSat syncs around, a plausible origin for the discrepancy. |
| **exSat vs Base deploy cost** | **UNVERIFIED.** Base's L1 DA fee was not measured (§6.4). Do not repeat the comparison as fact. |
| **§5 / §6.6 recommendations** | **Seat 3 synthesis, not a ruling.** Derived from verified findings, but the choices themselves are unratified. |

### 7.2 Owed work (Seat 3, no ruling needed)

1. **Pin the SVG → 380×520 JPEG rasteriser.** This is the largest unspecified gap. ERC-20i
   emits 24×24 or 32×32 logical SVG; the verified device path takes a 380×520 JPEG. Nothing
   in the repo pins that step, and **if any receipt is to be byte-reproducible, the renderer
   and its exact parameters must be pinned** — encoder, version, scaling filter, quantisation
   tables, chroma subsampling. Until that lands, no BNRi display receipt can reproduce.
2. **Write the `LogSource`**, against a self-hosted node or an unrestricted provider (§6.5).
3. **Measure exSat fork depths** and choose `confirmation_depth` from data.
4. **Add to `chain-exsat-evm/README.md`:** the synthetic-header caveat (§6.5), the 403 method
   allowlist, and the now-discharged chain-id verification.
5. **Replace the ten `PLACEHOLDER_*` signatures** with the real ABI once a BNRi contract
   exists, flipping each to `Verification::Verified { source }` citing the Solidity file and
   event declaration at a pinned commit. **Note that the placeholder names already presuppose
   a commit-reveal draw and a lock/unlock farming model** (`PLACEHOLDER_DrawCommitted`,
   `PLACEHOLDER_DrawRevealed`, `PLACEHOLDER_FarmingLocked/Unlocked`, `PLACEHOLDER_TicketAccrued`)
   — design decisions embedded in a table, which should be **re-confirmed against whatever
   BNRi actually becomes** rather than inherited by default.

### 7.3 Founder rulings needed

| # | ruling |
|---|---|
| **F-1** | **REVISED by §5.0 — the question was wrong, not just the answer.** Verifier-side checking needs the seeds **readable**, not **derivable**; PEPi's `seed2` event randomness satisfies it via one `eth_call`, so the original framing would have banned event-driven art for no gain. **The real question: should BNRi's art react to on-chain history (`seed2`-style, one read to verify) or only to the balance (Fungi-style, zero reads)?** Recommended: **react to history** — patterning PEPi means keeping its mechanism, and the verification cost is one RPC call. Either way, accept that the image changes with the balance. Storage layout, so it is free now and a migration later. |
| **F-2** | **Do we ask PEPi/Fungi for a grant at all?** Recommendation: **no** — §5.2 makes it moot, and §3 shows there is no one who can demonstrably grant. If yes, it is an outbound message on the founder's word, and only an explicit written grant naming the contract address counts. |
| **F-3** | **CC0-1.0 for the BNRi artwork, declared on-chain (§5.4)?** Recommended: yes, on mechanism grounds — a verifier's render must not be an infringement. |
| **F-4** | **What licence does the BNRi contract source ship under?** AGPL-3.0-only (kernel) vs `MIT OR Apache-2.0` (the standing SDK-edge intent in `docs/LICENSING.md`). A deployed EVM art contract is not obviously either. Seat 3 will not pick this. |
| **F-5** | **Does BNRi deploy to exSat given §6.6 item 5** — that exSat has essentially no ERC-20i display ecosystem? Survivable if the value is on-chain art plus verifier-side binding; not survivable if it depends on third-party wallets rendering it. |
| **F-6** | **Confirm which contract "PEPi (v2)" means** (§7.1 row 1), so downstream docs cite the right address. |

---

## SOURCES

- Live `eth_call` / `eth_getCode` / `eth_getTransactionReceipt` / `eth_getBlockByNumber`
  against `https://mainnet.base.org`, `https://base-rpc.publicnode.com`,
  `https://evm.exsat.network`, `https://ethereum-rpc.publicnode.com` — all observed
  2026-08-15.
- Verified sources via `https://base.blockscout.com/api/v2/smart-contracts/…` and
  `https://eth.blockscout.com/api/v2/smart-contracts/…`
  (`contracts/token/Fungi.sol`, `contracts/token/Pepi.sol`, `contracts/Generator.sol`,
  `contracts/lib/Ownable.sol`); exSat explorer `https://scan.exsat.network/api/v2/…`.
- Fungi `0x7d9ce55d54ff3feddb611fc63ff63ec01f26d15f` (Base, 2024-03-31);
  PEPi `0x28a5e71bfc02723eac17e39c84c5190415c0de9f` (Base, 2024-04-24, tx
  `0xfbac0e2ddfa5bd3c1d73d9bee33ff82c2b09a79124a50545e890d69bb73b0d94`, block 13591109); <!-- PUBLIC-CONSTANT: public chain data, derivable by anyone -->
  "Pepe Inscriptions" `0x19706c142d33376240e418d6385f05691a5fa8e2` (Base, 2024-04-10);
  PEPi `0x3103cd1602d5fa8f4b9283f9d5a7fa2290795d51` (Ethereum, 2026-03-03).
- `https://eips.ethereum.org/EIPS/eip-170`, `…/eip-3860`,
  `https://eosnetwork.com/resources/eos-evm-1-0-new-dynamic-gas-fee-model/`,
  `https://eosnetwork.com/blog/eos-evm-architecture-deep-dive/`, `https://docs.exsat.network/`,
  `https://a16zcrypto.com/posts/article/introducing-nft-licenses/`,
  `https://www.4byte.directory/api/v1/signatures/?text_signature=getSvg((uint256,uint256,uint256))`.
- In-tree: `crates/chain-exsat-evm/src/lib.rs`, `…/indexer.rs:61`, `…/signatures.rs:107-167`,
  `crates/chain-exsat-evm/README.md`; `docs/specs/SPEC-BLICENSE-0.md`; `docs/LICENSING.md`;
  `docs/receipts/RECEIPT_T3W1_BCOMB_FIRSTLIGHT_2026-08-15.md`.
