# RECEIPT — the §2.1 selector census, run on all thirteen deployments

**Run 2026-08-25 ≈ 21:5x UTC.** Read-only throughout: `eth_getCode` only, two RPCs per
chain, no keys, no transactions, no state. Tool: `docs/receipts/selector_census.py`;
worklist with every address and its source: `docs/receipts/deployments.json`.

This is the census `SPEC-INSCRIPTION-COMPAT-1` §2.1 promised: the same method §2.2 ran
for `transferItem` on 2026-08-20, pointed at the enumeration question. Every table below
is the tool's verbatim output. The full run (585 lines, including the per-deployment
discovery dump of every PUSH4 immediate) is reproducible with one command:

```
python3 docs/receipts/selector_census.py
```

---

## 1 · Controls, run before any row printed

```
controls: FUNGI carries 0x9c216508, lacks 0x67c65e99 — both receipts re-derived this run
```

The positive control re-derives the catalog's 2026-08-16 receipt (FUNGI carries
`mushroomCount`); the negative control re-derives §2.2's 2026-08-20 census (FUNGI does
not carry `transferItem`). A broken scanner aborts here instead of printing a tidy wall
of absences — the tool exits non-zero and prints nothing further.

## 2 · The membership census — 13/13 AGREE, zero disagreements

Two RPCs per chain, different operators, **byte-identical code required**: Base read on
`mainnet.base.org` + `base-rpc.publicnode.com`; Ethereum on `ethereum-rpc.publicnode.com`
+ `eth.drpc.org`. One amendment at run time, recorded in the worklist: `eth.llamarpc.com`
answered **521** (origin down) and was replaced by `eth.drpc.org` — the museum page's own
third eth RPC — after verifying it returns byte-identical code for PEPi-item.

```
deployment   chain     code/rpcs      mushroomCount    mushroomByIndex  sporesDegree     transferItem     itemCount        itemsPage        decimals         getSvg/PEPI      getSvg/FUNGI     getSvg/TRUFFI    getSvg/item
FUNGI        base      agree/16523B   YES              YES              YES              ·                ·                ·                YES              ·                YES              ·                ·
FROGGI       base      agree/24475B   ·                ·                ·                ·                ·                ·                YES              ·                YES              ·                ·
PEPi-v1      base      agree/20173B   YES              YES              YES              ·                ·                ·                YES              YES              ·                ·                ·
PEPi-v2      base      agree/21581B   YES              YES              YES              ·                ·                ·                YES              YES              ·                ·                ·
JELLI        base      agree/18602B   ·                ·                ·                ·                ·                ·                YES              ·                YES              ·                ·
TRUFFI       base      agree/24212B   ·                ·                ·                ·                ·                ·                YES              ·                ·                YES              ·
JEDI         base      agree/15519B   ·                ·                ·                ·                ·                ·                YES              ·                YES              ·                ·
MiDi-1       base      agree/11744B   ·                ·                ·                ·                ·                ·                YES              ·                YES              ·                ·
MiDi-2       base      agree/11745B   ·                ·                ·                ·                ·                ·                YES              ·                YES              ·                ·
MiDi-3       base      agree/11744B   ·                ·                ·                ·                ·                ·                YES              ·                YES              ·                ·
Souli        base      agree/18423B   ·                ·                ·                ·                ·                ·                YES              ·                YES              ·                ·
NTNT         base      agree/15600B   ·                ·                ·                ·                ·                ·                YES              ·                ·                ·                ·
PEPi-item    ethereum  agree/24341B   YES              ·                YES              YES              YES              YES              YES              ·                ·                ·                YES
```

```
== enumeration verdict (the §2.1 question) ==
FUNGI        FUNGI pair (mushroomCount + mushroomOfOwnerByIndex)
FROGGI       neither known pair — probe per contract, degrade to 'not enumerable'
PEPi-v1      FUNGI pair (mushroomCount + mushroomOfOwnerByIndex)
PEPi-v2      FUNGI pair (mushroomCount + mushroomOfOwnerByIndex)
JELLI        neither known pair — probe per contract, degrade to 'not enumerable'
TRUFFI       neither known pair — probe per contract, degrade to 'not enumerable'
JEDI         neither known pair — probe per contract, degrade to 'not enumerable'
MiDi-1       neither known pair — probe per contract, degrade to 'not enumerable'
MiDi-2       neither known pair — probe per contract, degrade to 'not enumerable'
MiDi-3       neither known pair — probe per contract, degrade to 'not enumerable'
Souli        neither known pair — probe per contract, degrade to 'not enumerable'
NTNT         neither known pair — probe per contract, degrade to 'not enumerable'
PEPi-item    item pair (itemCount + getOwnerItemsPage)
```

## 3 · What this settles, and what it corrects

**The mushroom enumeration pair is NOT "strictly FUNGI" — measured.** §2.1's 2026-08-25
correction quoted the FROGGi maintainer: *"`mushroomOfOwnerByIndex` is strictly fungi."*
The census measures the identical pair — `mushroomCount` **and**
`mushroomOfOwnerByIndex` **and** `sporesDegree` — on **PEPi v1 and PEPi v2 on Base**,
byte-verified by two RPCs each. The REPORTED claim is falsified in its strong form. The
correct family statement: **the mushroom vocabulary is the interface of the
FUNGI-lineage deployments — FUNGI and the two Base PEPi contracts — and of nobody else
measured.** This is the spec's own §0.1 rule operating on the spec itself: a report was
good enough to stop asserting the opposite, and only the census was good enough to
settle it. (Consistency anchor: Pepi.sol's verified source, read 2026-08-16, documents
the shared lineage; the census adds that the *interface* layer shares it too.)

**What the maintainer said that survives:** "contract calls are different per
deployment." Nine of thirteen deployments carry **neither** known enumeration pair —
FROGGI, JELLI, TRUFFI, JEDI, MiDi ×3, Souli, NTNT. For those, a consumer probes per
contract and degrades to "not enumerable". This is now a measured row set, not a
default.

**`transferItem` remains the Ethereum item model's alone** — present on PEPi-item,
absent from all twelve Base deployments, extending §2.2's 2026-08-20 census (ten
deployments) to twelve Base + one Ethereum with the same answer.

**`decimals()` is carried by all thirteen** — the §1.2 amendment's "read it, never
assume 9" is cheap everywhere.

**PEPi-item is a partial superset.** It carries the item pair *and* the item-shaped
`getSvg` *and* `mushroomCount` + `sporesDegree` immediates (but not
`mushroomOfOwnerByIndex`). Consistent with a lineage that grew the item model on top;
its verified source (Sourcify, linked from the museum) would resolve the exact meaning —
**not read this run**, recorded as the follow-up.

**The MiDi triplet is one codebase.** MiDi-1 and MiDi-3 return byte-identical code sizes
(11,744 B) and identical immediate sets; MiDi-2 differs by one byte (11,745 B) and one
immediate. Shared source, corroborating the 2026-08-19 dispatch's finding that the three
share an owner (#1 renounced, #2/#3 not).

**NTNT measures as a genuinely unknown surface.** No known enumeration pair, and **none
of the four known `getSvg` shapes** — the only deployment in the thirteen where the art
entry point is not one of the shapes §1.1 documents. Sixty immediates, most unresolved.
Its museum row (family by venue: inscriptions.market) now carries a measured interface
fact: resolve the surface against verified source before building anything on it. The
discovery dump exists for exactly this case.

**getSvg coverage across the family, measured:** FUNGI-shape `0x422b9e23` on 8
deployments (FUNGI, FROGGI, JELLI, JEDI, MiDi ×3, Souli); PEPI-shape `0xa435130b` on 2
(PEPi v1/v2); TRUFFI-shape `0xa62f5b1b` on 1; item-shape `0x058e7a31` on 1 (PEPi-item);
none on 1 (NTNT). §1.1's "four shapes" stands, now with a census behind it.

## 4 · Method honesty — what the discovery dump is

The tool also prints every PUSH4 immediate per dispatcher, labelling what is known
(family selectors, standard ERC-20/access-control, `Panic(uint256)`, numeric scalars and
masks) and listing the rest for source resolution: **599 immediates total, 35 of them
printable-ASCII string fragments** (trait keys like `body`/`eyes` riding ABI encodings —
labelled as fragments, not sold as selectors), and **357 genuinely unknown**, waiting on
verified-source reads. Two limits,
stated: a PUSH4 immediate is evidence a selector exists in code, and for every
*presence* row above where verified source has been read (FUNGI, PEPi v1/v2 — catalog
2026-08-16; Souli — 2026-08-19 dispatch) the source agrees; where no source has been
read, a presence row is a candidate until the source confirms. An *absence*, by
contrast, is absence from the code itself and needs no source. And the census reads
deployment bytecode only — the SourceHat receipt's rule (audited source ≠ deployed
source) applies to every row here by construction: this is the deployed surface, the
only one a consumer can call.

## 5 · Addresses and their sources

Every address, chain and provenance row lives in `docs/receipts/deployments.json` —
seven from the catalog (`compare.html`, 2026-08-16), three from the museum's SOURCES
wing (MiDi-2, NTNT, PEPi-item — the museum carried PEPi-item's full address all along;
the sprint's "prefix only" note was wrong and this run corrects it), one from the
2026-08-19 haul ledger (Souli), two resolved this day via Base Blockscout search with
prefix match against the 2026-08-19 dispatch plus name/symbol/supply corroboration
(MiDi-1 `0xf7Cf2DF5…df9352d6`, MiDi-3 `0x2d448bC9…A248D5ac`). The tool refuses to run on
any null; none are null.

## 6 · What this changes

1. **§2.1's table is now measured, per deployment** — the spec text is amended to the
   census rows and points here.
2. **The consumer rule survives unchanged but loses its provisional flag**: probe per
   contract; degrade to "not enumerable"; never default to FUNGI's selectors.
3. **The catalog (compare.html) gains PEPI eth, NTNT and MiDi rows** — E1's sync — each
   carrying its measured interface row from this census.
4. **JELLI's Medusa/Polyp report is untouched**: JELLI measures "neither pair", which is
   consistent with a divergent vocabulary and says nothing about trait naming — the
   report stays REPORTED, now beside a measured surface.

*No mainnet transaction and no key material at any point. One HTTP GET surface
(`eth_getCode`), twenty-six calls total.*
