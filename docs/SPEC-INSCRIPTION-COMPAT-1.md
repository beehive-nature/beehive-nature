# SPEC-INSCRIPTION-COMPAT-1 — what makes a token belong in the ecosystem

**Status: DRAFT, founder-gated.** One document, four consumers. The **Studio** enforces it
before art is accepted, the **LaunchPad** gates on it before deploy, the **Gallery** uses it
for capability detection, and the **Marketplace** uses it for eligibility. If those four
check different things, they are four products; if they check this, they are one system.

Every threshold here was measured on 2026-08-15/16 against live contracts. Receipts:
`docs/SPEC-ERC20I-MECHANICS-1.md`, `docs/receipts/evmcheck.py`,
`docs/receipts/selector_census.py`, `surfaces/blight/inscription-explorer.html`.

**Correction pass 2026-08-25** — §0.1, §1.2, §2.1, §2.2 and §2.3 carry amendments sourced
from the **FROGGi maintainer**, in conversation. First-party testimony from a deploying
maintainer, not a measurement: every claim below is marked either **MEASURED** (ours, with a
receipt) or **REPORTED** (his, pending a census). A REPORTED item is good enough to *stop
asserting the opposite* and not good enough to gate a product on.

---

## 0 · The three tiers

| tier | grants | requires |
|---|---|---|
| **1 · viewable** | appears in the Gallery | a readable renderer and readable seeds |
| **2 · tradeable** | appears in the Marketplace | tier 1 + enumeration + a safe transfer primitive |
| **3 · scale-native** | recommended for new deploys | tier 2 + a linear renderer + append-mode upload |

A token may sit at tier 1 forever and still be a first-class citizen of the museum. **Tier 3
is what the LaunchPad emits**, because a token deployed today has no excuse for the defects
the lineage inherited.

### 0.1 The teaching-contract trap

**FUNGI is the family's reference implementation, and that is not the same as being the only
readable one.** It is the one with a canonical public repository, so it is what everybody
reads first and what every tutorial, indexer and agent is built from. But **FROGGI, PEPi v2
and JELLI are all source-verified on Basescan** (REPORTED 2026-08-25, FROGGi maintainer) —
the source was there to check the whole time.

That makes the trap worse, not better. Nothing was hidden; one implementation was simply
treated as the spec, and its vocabulary, constants and bugs were inherited as if they were
the family's. **Reading four sources is cheap. Assuming the first one generalises is what
costs.**

This document has now made that error three times and corrected it three times:
`sporesDegree` presented as universal (§1.2, corrected 2026-08-16, it **reverts** on FROGGi);
the enumeration pair presented as "Base" (§2.1, corrected 2026-08-25, it is **strictly
FUNGI**); and this very section's first draft asserting FUNGI was the only published source,
corrected within the hour by the maintainer it was written about. Same shape all three times:
**one deployment's fact promoted to a family fact.**

Note the third one especially. It was written *by* the section warning against it, *while*
warning against it. The failure mode is not ignorance — it is that a single well-documented
example is the cheapest thing in reach, and generalising from it feels like knowledge.

> **The rule this document now runs on: a claim earns a family label only with a census
> behind it.** Until then a row is named for the single deployment it was measured on, and a
> sentence about "the family" names which members it was checked against.
> §2.2's `transferItem` census (2026-08-20, two independent RPCs, ten deployments) is the
> standard — that is what promotion costs, and nothing gets promoted cheaper.

**And FUNGI is not a clean teacher even for itself.** Its own documented defects are in this
spec: the seed-zero underflow (§1.5), `setFile` validating nothing (§3.4), the increment-only
selection modulus that silently poisons a level (§3.3), and the same-seed collision that
dissolves unrelated art without reverting (§2.2). REPORTED 2026-08-25, FROGGi maintainer:
*"I wouldn't use fungi as the teaching contract, it's quite buggy."*

**So this document is the teaching artifact, not the source.** It is probe-first by
construction; the source is one deployment's answer. Anyone — human or agent — briefing
themselves on the lineage reads §0.1 through §2.4 before opening a contract.

---

## 1 · Tier 1 — viewable

### 1.1 A renderer answers

Four `getSvg` shapes exist in the wild. **There is no single ERC-20i interface**; capability
detection is mandatory, not defensive programming.

| selector | signature | seen on |
|---|---|---|
| `0xa435130b` | `getSvg((uint256,uint256,uint256))` | PEPI v1, v2 (Base) |
| `0x422b9e23` | `getSvg((uint256,uint256,uint256))` | FUNGI, FROGGI, JELLI (Base) |
| `0xa62f5b1b` | `getSvg(...)`, third field an **address** | TRUFFI (Base) |
| `0x058e7a31` | `getSvg((uint8,uint256,uint256,uint256))` | PEPi (Ethereum, item model) |

> Two contracts sharing a signature can still have **different selectors** — the shape is not
> the identity. Probe, do not assume.

**A fifth shape is expected.** Detection must degrade to "unknown renderer" rather than
"no art".

### 1.2 Seeds are READ, never derived — and the seed source is not universal either

`sporesDegree(address)` `0xa775188a` returns the live triple **where it exists**. Its seed
is **not** `balance / 10^decimals`: measured, a holder with **7 whole tokens returns
on-chain seed 3** — the seed is captured from the transfer that created the spore. Deriving
from balance and passing `seed2 = 0` **reverts**.

**Return width varies: 3 words on Base, 4 on Ethereum** (leading `uint8`).

> **CORRECTION 2026-08-16.** An earlier revision presented `sporesDegree` as universal.
> **It reverts on FROGGi.** The seed source is no more standardised than the renderer is,
> and a consumer that assumes it renders nothing for that token.

**So resolution is a fallback chain, not a call:**

1. try `sporesDegree(holder)` → if it returns ≥3 words, use them
2. else derive `seed = balance / 10^decimals` — **reading `decimals()` from the contract,
   never assuming 9** — and try the triple `(seed, 0, 0)`
3. else report **unknown seed source** — never "no art"

Measured on FROGGi: `sporesDegree` reverts, the balance-derived path returns **62,710 B**
of SVG. Both branches are required.

> **AMENDMENT 2026-08-25 — `decimals` is per-deployment.** REPORTED, FROGGi maintainer: the
> exponent is **scaled to the project's total supply** and varies between deployments. FUNGI
> hardcodes `9` in its `Erc20.sol`, which is precisely how the constant propagates into
> consumers that learned the family from the one published source (§0.1). A hardcoded `9`
> against a deployment with different decimals does not error — it derives a **wrong seed**
> and renders **the wrong art**, confidently. Read `decimals()`; cache it per contract.

### 1.2b Vocabulary — "spore" is FUNGI's word

REPORTED 2026-08-25, FROGGi maintainer: *"Spore is a trait from Fungi."* It is one
deployment's trait name, not a family concept, and this document had been using it as the
generic term for a live inscription.

**The divergence is total, not cosmetic.** REPORTED 2026-08-25: **JELLI names its trait
vocabulary Medusa and Polyp** — not spore, not mushroom, not a variant spelling. So "does
this contract expose `mushroomCount`?" is not a hard question about JELLI, it is **the wrong
question**, and the "no" it returns carries no information about whether JELLI is
enumerable. Some deployments do share some calls; **none of that sharing can be assumed**.

**Family term: the *live inscription*** — the one derived from the holder's current position.
**Family term: the *frozen record*** — the enumerable one that survives transfer. Say
"spore" only when the sentence is about FUNGI, "mushroom" likewise, "medusa"/"polyp" only
about JELLI. §2.1 and §2.4 below are amended accordingly.

> **Consequence for every consumer we ship.** Capability detection cannot be a checklist of
> FUNGI's selectors, because a deployment with a different vocabulary fails the checklist
> identically to a deployment with no interface at all. **Detection must enumerate what a
> contract actually exposes, then label it** — which is why `selector_census.py` discovers
> the dispatcher surface rather than only testing membership (§2.1).

### 1.3 Self-containment

The returned SVG must contain **zero external references** beyond the SVG namespace
declaration. Any `http`, `ipfs://`, or `data:` pointing outward disqualifies tier 1 — a
renderer that needs a server is the failure this ecosystem exists to refute.

Mechanical check: strip `www.w3.org`, then assert no remaining `https?://`.

### 1.4 It actually renders

Storable ≠ viewable. See §3.1. A contract that stores art it cannot serve fails tier 1 **on
chain**, though the art remains recoverable off-chain (§3.2).

### 1.5 The seed-zero trap

`seed = 0` reverts with **panic 0x11** — `seed + nonce − 1` underflows. Any consumer that
iterates addresses hits this. **Guard at the API boundary; start `nonce` at 1.** Report it as
"no inscription", never as an error.

---

## 2 · Tier 2 — tradeable

### 2.1 Enumeration

Viewing needs the live inscription. **Trading needs the frozen records**, and a wallet can
hold zero live inscriptions and five frozen pieces — that wallet renders nothing without
enumeration.

| deployment | count | enumerate |
|---|---|---|
| **FUNGI · PEPi v1 · PEPi v2** (Base) — measured 2026-08-25 | `mushroomCount(address)` `0x9c216508` | `mushroomOfOwnerByIndex(address,uint256)` `0x0fd9587e` |
| **PEPi item model** (Ethereum) | `itemCount(address)` `0xc00ae885` | `getOwnerItemsPage(address,uint256,uint256)` `0x92d2036d` |
| **FROGGI · JELLI · TRUFFI · JEDI · MiDi ×3 · Souli · NTNT** | — neither known pair; not enumerable | — |

> **CORRECTION 2026-08-25 — this row said "Base".** REPORTED, FROGGi maintainer:
> *"contract calls are different per deployment, `mushroomOfOwnerByIndex` is strictly
> fungi."* The mushroom vocabulary is FUNGI's, exactly as `sporesDegree` was (§1.2), and
> labelling the row for the whole chain asserted a family interface that §1.1 already says
> does not exist. **Every other Base-family deployment is now unenumerated in this document
> until measured.**
>
> **CENSUS RUN 2026-08-25 — and it corrected the correction.** The tool
> `docs/receipts/selector_census.py` + `docs/receipts/deployments.json` read bytecode on
> two independent RPCs per chain across all thirteen deployments — the identical method
> §2.2 ran for `transferItem` on 2026-08-20 — and the table above is its measured output.
> 13/13 agreed between RPC pairs; both known-receipt controls re-derived before any row
> printed. Receipt, verbatim tables and the discovery dump:
> `docs/receipts/RECEIPT_SELECTOR_CENSUS_2026-08.md`.
>
> **The strong form of the maintainer's claim is falsified by measurement:** PEPi v1 and
> PEPi v2 on Base carry the identical pair — `mushroomCount` *and*
> `mushroomOfOwnerByIndex` *and* `sporesDegree`. The mushroom vocabulary is the interface
> of the **FUNGI-lineage deployments** (FUNGI + both Base PEPi contracts), not of FUNGI
> alone. What survives of the report is the larger half: nine of thirteen deployments —
> FROGGI, JELLI, TRUFFI, JEDI, MiDi ×3, Souli, NTNT — carry **neither** known pair, so
> "contract calls are different per deployment" holds for everything outside the lineage.
> NTNT is the deeper unknown: **none of the four known `getSvg` shapes either** — its art
> entry point is undocumented until its surface is resolved against verified source.
>
> Three properties make the tool's output a receipt rather than an assertion. **A selector
> lives inside a `PUSH4` immediate**, which is exactly what `evmcheck.py`'s opcode walk
> skips, so reusing that walk would report every selector absent everywhere and look clean;
> the census collects immediates instead and counts only a *complete* PUSH4 as presence.
> **Two RPCs must return byte-identical code** — a disagreement prints as DISAGREE and
> yields no verdict, because one of them is wrong and that is the finding. And **every live
> run re-derives two receipts we already hold before printing a single row** — FUNGI *must*
> carry `0x9c216508`, FUNGI *must not* carry `0x67c65e99` (§2.2, 2026-08-20) — so a broken
> scanner aborts instead of reporting a tidy wall of absences.
>
> **It discovers as well as checks.** Testing membership of FUNGI's selector list across a
> family with per-deployment vocabularies (§1.2b — JELLI's Medusa and Polyp) yields a wall of
> absences that reads like a finding and is noise. So each run also dumps every `PUSH4`
> immediate in the dispatcher — the contract's own surface, in its own words — labels what we
> know and lists the rest for resolution. **An absence only means something beside the set of
> things that are present.**
>
> **`deployments.json` shipped with nulls and refused to run until filled; all thirteen
> carry a source line today** (catalog 2026-08-16, museum SOURCES wing, the 2026-08-19 haul
> ledger, and two Base Blockscout prefix-matches recorded in the file). The tool still
> refuses any null: a prefix is not an address, and a fabricated row is worse than a missing
> one because it looks like a receipt. **MiDi and JEDI remain vouched for by nobody we have
> spoken to** — they leave the census with a measured surface and nothing more. Shared
> ancestry is not a quality claim.
>
> **The standing consumer rule, now with a census behind it:** a consumer probes per
> contract and degrades to "not enumerable" — never to an error, and never to FUNGI's
> selectors by default.

**Prefer the paginated form.** The FUNGI shape costs one call per item; the item model
returns a page. At cart and gallery scale that is the difference between usable and not.

### 2.2 A safe transfer primitive

This is the axis that separates the two generations, and it is **not retrofittable**.

- **Base-style:** an inscription moves only by transferring an amount whose whole-token floor
  equals the held seed. **Any other amount dissolves inscriptions**, and a **same-seed
  collision silently dissolves the piece being sold plus unrelated ones, without reverting.**
  > **CORROBORATION 2026-08-25 — and it was never fixed on chain.** This is not only our
  > measurement. **SourceHat's April 2024 audit of `Fungi.sol` raised the `_owns` collision as
  > its Finding #1, severity HIGH** — multiple holders sending identical seed amounts to one
  > recipient leaves that recipient unable to move all the sets. A professional reviewer found
  > the same defect from source that we found from 8,162 burn events.
  > **The remediation is in the repository and not at the address.** FUNGI deployed
  > 2024-03-31, **eight days before the audit began**; the live bytecode matches
  > pre-remediation commit `4581acb`, whose `_removeHolder` still decrements `_holdersCount`
  > before indexing (the audit's Medium Finding #2) and which never received the renames the
  > fixed commit carries. **Every "Resolved" in that report describes GitHub, not Base.**
  > A consumer must therefore treat the audited source and the deployed source as **two
  > different contracts**, and read only the deployed one. Receipt:
  > `docs/receipts/RECEIPT_SOURCEHAT_FUNGI_AUDIT_2026-08-25.md`.
- **Item model:** `transferItem(address,uint256)` `0x67c65e99` moves one inscription **by
  globally-unique id**, carrying exactly its backing tokens, seed data re-added verbatim.
  **Census correction 2026-08-20 — `transferItem` is NOT a family marker.** Bytecode was
  read on two independent RPCs for every Base family member (FUNGI, PEPi v1/v2, FROGGI,
  JELLI, TRUFFI, JEDI, MiDi ×3, Souli): the selector is **absent from all of them**. It
  belongs to the Ethereum Pepi item model alone (`0x3103cd16…`), which remains the only
  tier-2 tradeable deployment in existence. Do not probe for it to test family membership
  — a negative proves nothing but "not the ETH item model."

> **Tier 2 requires an id-addressed transfer** — or a settlement path that makes the
> arithmetic slip structurally impossible. A Base-style token is viewable and collectable,
> and every naive settlement path is one arithmetic slip from destroying art.

> **AMENDMENT 2026-08-25 — "cannot be safely traded" was too strong.** A live Base-style
> marketplace exists and settles through **one-time-use escrow addresses, one per listing**
> (REPORTED, FROGGi maintainer). That is not a workaround bolted on; it is the direct
> mitigation for the hazard this section names. A **freshly created address holds no other
> seeds and no fungible balance**, so the same-seed collision has nothing to collide with and
> §2.3's rules 1 and 2 hold by construction rather than by discipline. The maintainer also
> confirms **seeds move with the listing** — the frozen record survives the hop, so escrow
> does not silently re-roll the art being sold.
>
> **Address isolation protects the receiving side only.** The listing transfer still departs
> a **seller's** wallet that may hold other seeds, and a collision there dissolves unrelated
> pieces with no revert. **A Base-style marketplace must therefore read the seller's full
> frozen-record set before quoting a listing, not only the piece being listed** — an
> id-addressed token needs no such pre-flight, which is the real content of the tier-2 line.
>
> Corollary for the LaunchPad and C-2: id-addressing removes a *class* of settlement bug.
> Per-listing address isolation removes it too, at the cost of one address per listing plus a
> seller-side pre-flight that cannot be skipped.

### 2.3 Custody rules, for any market that escrows

Derived from a live implementation with **8,162 burn events and zero in any marketplace
transaction**:

1. **Items out before any fungible sweep.** Release inscriptions, *then* release ERC-20, then
   destroy the vault. Reversing this dissolves what remains.
2. **An address holding art must never hold fee or treasury balances.** The first sweep
   dissolves its custody.
3. **Escrow may hold multiple items** — the earlier "one inscription per address" rule was an
   artifact of Base's magic-amount semantics and is **withdrawn** for id-addressed tokens.
4. **For Base-style tokens that rule is not withdrawn — it is mandatory, and it is now
   load-bearing.** One escrow address per listing, created for it and never reused.
   Reuse reintroduces exactly what magic-amount semantics punish: a residual fungible
   balance, and a second seed to collide with. REPORTED 2026-08-25, FROGGi maintainer —
   a live marketplace settles this way. **Read rules 1–3 as applying to id-addressed
   tokens and rule 4 as the Base-style substitute, never as alternatives to choose
   between.**

**Preferred: escrow the payment, never the art.** Delivery is provable by an `eth_call`
(`isOwnerOf`), so no contract need ever custody an inscription.

### 2.4 Pools are sinks

Measured: PEPi v2's pool holds **8,292 whole tokens, 0 frozen records, and 0 live
inscriptions.** It is
excluded from inscription accounting entirely. **Transferring an inscription toward a pool
destroys it** — burn reason `TO_SOURCE`, **5,934 occurrences.**

> **A swap button beside an inscription is a delete button wearing a trade label.** Any
> surface offering both must say so.

---

## 3 · Tier 3 — scale-native

### 3.1 The renderer must be linear

`abi.encodePacked` inside a loop is quadratic — Solidity never frees memory, so cost grows as
`e·n²/2`.

| rects | memory | gas |
|---|---|---|
| 2,027 | 117 MB | 2.62 × 10¹⁰ |
| 2,517 | 181 MB | 6.22 × 10¹⁰ |

Public RPCs reject these **even given 500 billion gas**.

| renderer | element ceiling |
|---|---|
| quadratic | **~370** |
| **linear buffer** | thousands, bounded only by response size |

**Emit fewer elements too.** TRUFFI produces 12,641 B from **7 rects, 13 paths and one
`feTurbulence` filter** — instructions, not pixels. That is why it renders where dense
rect art cannot.

### 3.2 …but un-renderable is not unviewable

The quadratic wall is **an EVM memory artifact, not an algorithmic one.** The same
concatenation in JavaScript is milliseconds. Given trait data, published generator logic and
seeds, **any client composes the art locally at no gas.** Tier 3 is about being a good
citizen on-chain, not about whether the art exists.

### 3.3 Upload must append

- `setFile` **replaces**: a second call for the same `(lvl,file)` **wipes the first**.
- `counts[lvl]` is **increment-only and is the selection modulus**. Upload 1, 2, 5 → count 3
  → file 3 renders as `""`, silently. **One out-of-order batch permanently poisons a level.**
  This is how `earsLevelCounts` shipped `[0,0,0,0,0,0]` — a declared layer, empty forever.
- **675 rects per transaction**, bounded by the 2²⁴ gas transaction cap (25,226 gas/rect
  marginal). No candidate BNRi piece fits in one transaction; the smallest is 782 rects.

**Tier 3 requires an append-mode setter and a deterministic upload order.**

### 3.4 No bounds checks exist

`setFile` validates nothing. Out-of-range rects **store silently and are clipped by the
viewport** — data accepted, art lost, no revert. **The Studio must validate; the chain will
not.**

### 3.5 Opcode compatibility

exSat is **Shanghai**. `PUSH0` (`0x5f`) is expected and desirable — it saves one byte and one
gas per zero-push, worth **431 bytes** on a PEPi-sized contract. The cancun trio
`TLOAD`/`TSTORE`/`MCOPY` (`0x5c`–`0x5e`) deploys and then reverts at runtime.

`evm_version = "shanghai"`, `auto_detect_solc = false`. Verify with
`docs/receipts/evmcheck.py`, which walks the instruction stream and strips the CBOR
metadata trailer — **a naive byte scan produces false positives**, since PUSH immediates
contain arbitrary bytes.

### 3.6 The metadata surface

**Specified and frozen 2026-08-25, sprint S26-0825 (claim M1).** The highest-leverage
thing the LaunchPad can emit that no predecessor did — because this family is
uncomposable the same way everywhere: **everyone shipped art and nobody shipped an
interface.** Four `getSvg` shapes (§1.1, now census-confirmed across all thirteen
deployments), enumeration that diverges per deployment (§2.1), JELLI naming its traits
Medusa and Polyp (§1.2b). Every viewer is hand-fitted to one collection and dies with
its author's attention — that is why there has never been more than one working gallery
at a time. Falazen's ask is the general case, not a preference: *he takes care of
sprites; what he wants is trait metadata.* Artistic unity means he will not use foreign
art — he will compose his own, if the interface tells him what is there.

> **RULING.** The LaunchPad emits **one metadata surface, one shape, frozen at deploy,
> identical across every deployment that carries it.** The surface is a contract about
> *shape*, not about *contents*: what the traits are (C-1) and how many pixels they
> occupy (C-3) stay founder gates. The surface is what lets a stranger build on us
> without reading our Solidity — and it is the thing a plural-venue ecosystem is gated
> on.

**The shape.** Two functions, mirroring the two records of §1.2b:

| call | covers | returns |
|---|---|---|
| `liveMetadata(address holder)` | the *live inscription* (§1.2b) — derived from the holder's current position | `metadata JSON` |
| `itemMetadata(uint256 id)` | the *frozen record* — the one that survives transfer | `metadata JSON` |

Both return a **UTF-8 JSON string** — not an abi-encoded struct, which forces the
consumer to run a decoder before reading a single field. JSON is readable from every
language a game, an indexer or an agent is written in, and the family already speaks it:
FUNGI, FROGGI, JELLI and JEDI's `getMeta` all return on-chain JSON (catalog, 2026-08-16),
so the precedent is native, not imported.

**The payload, frozen field by field:**

```json
{
  "v": 1,
  "kind": "bnri",
  "seed": [seed, seed2, extra],
  "generator": { "id": "bNRi-v1", "pixels": 48, "palette": "<32-hex-locked-set-id>" },
  "layers": [ { "name": "…", "variant": "…", "colors": ["#…", "…"] } ],
  "bounds": { "x": 0, "y": 0, "w": 48, "h": 48 }
}
```

- **`v`** — schema version. Additive-only evolution: a consumer that does not know a
  field ignores it and still renders. A field is never renamed or repurposed; payloads
  carry their version (`v`), per the standing payloads-carry-v law.
- **`seed`** — the triple that derived the art, in the clear. §3.2's whole point: given
  traits, published generator logic and seeds, **any client composes locally at no
  gas**. Withholding the seed would re-create the quadratic wall (§3.1) for everyone
  who cannot `eth_call` the renderer.
- **`generator`** — identity + parameters of the composing program (`pixels` here is
  C-3's constant, reported not chosen; `palette` is the locked set the Studio's
  pre-flight enforces). A stranger's engine can decide compatibility mechanically.
- **`layers`** — the trait assignment, in draw order, each with its variant and resolved
  colours. The key names are the deployment's own (C-1's taxonomy); the *envelope* is
  frozen. `layers[]` is ordered — composition order is part of the art.
- **`bounds`** — the sprite's own coordinates, so a game can place it without probing.

**The laws, which are the actual freeze:**

1. **One shape.** Every LaunchPad deployment answers both calls with this envelope.
   Divergence per deployment is the defect this section exists to end (§0.1's
   three-times-corrected lesson, promoted to a rule).
2. **Determinism.** Same inputs → byte-identical JSON. No block data, no timestamps, no
   owner-dependent branching. Metadata that changes silently is a lie told to every
   cache that ever reads it.
3. **Self-description.** The payload alone is sufficient to compose or place the art —
   no companion document, no "read the contract first." `v`, `generator` and `bounds`
   exist for exactly this.
4. **The SVG stays.** `getSvg` remains for wallets and lazy clients; the metadata
   surface is the *composability* answer beside it, not a replacement. A consumer
   chooses its tier: render the art (one call), or own the composition (metadata +
   published generator).
5. **Absence is honest.** A deployment without the surface reports it — probe, then
   degrade — never a stub payload. The consumer rule of §2.1 applies verbatim.

**Not this surface's to decide** (and recorded so it cannot quietly drift): the trait
taxonomy and layer count (**C-1**), `pixelsCount` (**C-3**), the settlement primitive
(**C-2**), and the art itself. If a gate moves, the envelope survives it; that is what
freezing the shape instead of the contents buys.

---

## 4 · The Studio's pre-flight

Run before a trait is accepted, not after deploy. Every item is mechanical.

| check | why |
|---|---|
| palette ⊆ the locked set | style anchor and palette-index encoding both break otherwise |
| alpha is binary, no soft matte | a soft edge destroys hard-edged pixel art |
| bounding box within the layer region | traits must register across bodies |
| rect count after RLE ≤ 675 | one transaction per trait |
| no long horizontal 1px runs | **measured**: they become zigzags on a flat-top lattice |
| no dithering / checkerboard | **measured**: destroyed by the lattice change |
| ≥ 2px edge margin | device render clips 2px per side at 384 px on a 380 px panel |
| coordinates within `pixelsCount` | no bounds check exists on-chain |
| upload order contiguous from 1 | out-of-order poisons the level permanently |

---

## 5 · Founder gates

| | |
|---|---|
| **C-1** | **Trait taxonomy** — how many layers, how many variants each. Blocks the Studio's layer model, the LaunchPad's schema, and all bulk art. Target: ~30 variants × 6 layers × a colour axis ≈ 30 billion combinations, which holds expected collisions under 0.01 at ~5,000 inscriptions. |
| **C-2** | **Is tier 2 mandatory for LaunchPad output?** Emitting only id-addressed tokens makes every downstream marketplace safe by construction — but diverges from the Base lineage BNRi is patterning. |
| **C-3** | **`pixelsCount`** — a compile-time constant. 48 renders comfortably and is crisp on the panel; 96 is 3.43× the cost in every figure. Frozen at deploy. |

---

*Read-only research throughout. No mainnet transaction and no key material at any point.*

*Amendments dated 2026-08-25 are **REPORTED** — first-party testimony from the FROGGi
maintainer, carried here because it contradicts things this document was asserting. They
change what we claim; they do not all carry receipts. The §2.1 census — the cheapest debt
in the document — **ran the same day and is receipted**
(`docs/receipts/RECEIPT_SELECTOR_CENSUS_2026-08.md`): its measured table replaces the
reported one above, and it corrected the correction in the process. The escrow and
`decimals` amendments remain REPORTED pending their own receipts.*
