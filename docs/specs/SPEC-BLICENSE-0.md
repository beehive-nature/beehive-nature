# SPEC-BLICENSE-0 — THE BNR LICENSING PROGRAM (v0.1-draft, SPEC ONLY)
**Seat:** Cowork · **Date:** 2026-08-13 · **Dispatch:** COWORK — SPEC-BLICENSE-0
**Acceptance target:** *an artist onboarding the launchpad picks license terms the way they
pick LP options.*

> # ⚖️ THIS IS NOT LEGAL ADVICE, AND THE LICENSE TEXT IS NOT READY TO SERVE
> **I am not a lawyer.** §4 drafts the *shape and the selectable terms* of a license artists
> would rely on to protect their copyright. **Before a single artist is offered these terms,
> the text must be reviewed by counsel qualified in the relevant jurisdictions.** A license
> that reads well and fails in court is worse than no license, because the artist relied on
> it. **Every clause below is a DRAFTING PROPOSAL for counsel to accept, amend, or reject.**

---

## §0 — THE ONE CONSTRAINT THAT SHAPES EVERYTHING BELOW

**EIP-2981 IS A SIGNAL, NOT AN ENFORCEMENT MECHANISM — VERIFIED, NOT ASSUMED.**

The standard "only specifies a way to signal royalty information and does not enforce its
payment"; enforcement is **marketplace policy**. From 2023 major venues moved to optional
royalties — OpenSea sunset its Operator Filter — so **payment is voluntary in practice**.

**Consequence, and it is binding on §4:** BNR must **never** phrase a royalty as a promise
the artist can rely on across venues. **The license declares a royalty; the venue decides
whether to honour it.** Anywhere BNR controls the settlement path, BNR enforces it; anywhere
it does not, **the artist is told plainly that it is a request.**

> **This is the same shape the room has now hit four times:** Ed25519 non-malleability held
> by library accident · `canon()` injectivity by field ordering · the Merkle fold by nobody
> checking the shipping Rust · capped spend by whichever tier holds the key. **A guarantee
> that depends on a component you do not control is not a guarantee.** Here the uncontrolled
> component is *every marketplace that is not ours*.

## §1 — WHAT IS INCORPORATED (verified at source, this turn)

| standard | what BNR takes | status |
|---|---|---|
| **EIP-2981** | the `royaltyInfo(tokenId, salePrice)` **signal** — one interface every venue can read | **Final**; signal only, **not enforceable** (§0) |
| **ccREL / schema.org** | machine-readable `license` field pointing at the immutable license URI, so crawlers, wallets and AI training filters can read terms without parsing prose | web-standard, no chain dependency |
| **C2PA** | a **declared manifest**: manifest store → claims → assertions, cryptographically signed; assertions are extensible, so the BNR license reference rides as a custom assertion | spec **v2.3** (2025-12 / doc dated 2026-01-05); v2.4 published |

**⚠ THE DISPATCH CITES AN "EXISTING PROVENANCE RULING" FOR C2PA. I CANNOT FIND IT.** No
C2PA reference exists anywhere in `docs/`. **This spec therefore incorporates C2PA on the
dispatch's word, not on a ruling I could read** — flagged rather than silently treated as
settled, because that is exactly the CD-13/CD-29 identifier problem one level up. **If the
ruling exists, cite its path and this line comes out; if it does not, C2PA needs ruling
before §5 is built.**

## §2 — WHAT IS MODELLED (not copied)

**Story Protocol's PIL** is the reference architecture: an **off-chain legal template mapped
on-chain**, with terms as a machine-readable struct (`PILTerms` in `IPILicenseTemplate.sol`)
covering territory, channels, expiration, derivatives, attribution, commercial use.

**What BNR adopts:** the *pattern* — **on-chain terms bound to authoritative legal text**,
so the machine-readable selection and the human-readable contract cannot drift apart.
**What BNR does not adopt:** Story's chain, token, or template text. **Per the standing
capture test, adopting their chain would put a rail we do not control on every artist's
path** — the same finding Axis 3 reached about the whole AR application layer.

**The artist-retains-copyright / holder-gets-narrow-display-license pattern** is adopted as
the default posture (§4.1). It is the industry's most artist-protective common shape.

## §3 — THE TERMS MENU (the acceptance target, made concrete)

The artist picks from a **closed menu**, the way they pick LP options. **Closed, because a
free-text license field is not a license — it is a liability the platform cannot machine-read
or defend.** Adding a tier is a ruling, not a form field.

| tier | holder may | artist retains | commercial |
|---|---|---|---|
| **D — Display-only** | display, resell the token, private view | **copyright, all commercial rights, all derivative rights** | none |
| **R — Remix-with-attribution** | + create derivatives **with attribution**, non-commercially | copyright; commercial rights in derivatives | none |
| **C1 — Commercial, narrow** | + defined commercial use in **named channels** | copyright; all other channels | scoped |
| **C2 — Commercial, broad** | + commercial use across channels, still **non-exclusive** | **copyright — always** | broad |

**Invariants across every tier, non-negotiable:**
1. **THE ARTIST RETAINS COPYRIGHT.** No tier transfers it. A tier that did would not be a
   license, it would be an assignment, and it does not belong on this menu.
2. **Every grant is NON-EXCLUSIVE.** Exclusivity is a negotiated contract, not a menu pick.
3. **Proceeds split is artist-selectable to 100%.** The platform's cut is a *choice the
   artist makes*, and the default must never silently be non-zero — **the default is the
   decision** (8t).
4. **Moral rights and attribution survive every tier**, to the extent the jurisdiction
   recognises them. **This is one for counsel: moral rights are non-waivable in some
   jurisdictions and waivable in others**, and the text cannot pretend that is uniform.

## §4 — IMMUTABILITY, AND THE THING IT WILL SURPRISE PEOPLE WITH

**Terms are immutable once minted.** The mint binds: `{tier, proceeds split, license text
version, royalty bps}`.

**⚠ STATE THIS IN THE ONBOARDING UI, NOT ONLY HERE: an artist who picks Display-only and
later wants to allow remixes CANNOT change the already-minted work.** They can mint new work
under new terms. **Immutability protects the holder — a license that the issuer can narrow
after purchase is not a license — and it costs the artist optionality. Both halves must be
said at pick time**, or the first artist who wants to loosen terms will experience it as the
platform breaking a promise.

**Versioned reference, same discipline as the spend-receipt rate:** the mint stores a
**`license_text_ref`** — an immutable, content-addressed pointer to the exact legal text.
**Amending the template creates a NEW version; already-minted works keep pointing at the text
they were sold under.** Nothing already sold is retroactively redefined, which is the whole
point of an immutable term.

## §5 — MACHINE-READABLE SURFACE (three layers, one truth)

```
on-chain      EIP-2981 royaltyInfo()  +  {tier, license_text_ref}   ← the binding record
web           schema.org  "license": <license_text_ref URI>          ← crawlers, AI filters
media         C2PA assertion carrying license_text_ref               ← travels with the file
```

**All three MUST resolve to the same `license_text_ref`.** A conformance check should assert
that, and **fail loudly on divergence** — three surfaces stating different terms is worse
than one surface, because each is separately citable. **This is the cross-implementation
lesson applied to a legal artifact: one artifact, several readers, checked against each
other.**

## §6 — INDIGO INDEX AND VIB

**Indigo Index — ADOPTED, and it is defined in-tree:** `CD-18 (REGISTERED)`,
`docs/feature-backlog.md:459`. *The measured value of a region by its level of creativity.*
The load-bearing property for this spec: it is **DERIVABLE at render time from public
settlement events — computed, never asserted.** **Licensing feeds it and must not distort
it:** license *selections* are not creative output, so **a tier choice must never be an
Indigo input**; settled creative transactions may be. CD-18's Q-1/Q-2/Q-3 remain open and
**this spec does not close them.**

**⛔ VIB — ADOPTED AS VOCABULARY BY THE DISPATCH, BUT IT IS DEFINED NOWHERE IN THE TREE.**
Searched `docs/`: no definition. **I have not invented one, and this spec does not use the
term in any normative sentence.** An undefined term in a licensing spec is precisely how a
clause becomes unenforceable — **it needs a definition before it appears in §3 or §4.**

## §7 — SCOPE FENCE

- **Spec only. No architecture, no contracts, no UI.**
- **No royalty percentages, no platform-cut numbers, no fee constants** — those are
  tokenomics and remain behind the standing gate. **No constant appears in this document.**
- **No jurisdiction selected.** Story's PIL builds on US copyright law and leans on the Berne
  Convention for international recognition; **whether BNR follows that choice is a founder +
  counsel decision, not a drafting one.**

## COMPLICATIONS

**C1 — The single biggest risk in this document is §0, and it is a product risk, not a legal
one.** Artists will read "royalty" and hear "I get paid." **Across venues BNR does not
control, they will not, and the standard cannot make them.** If the onboarding UI shows a
royalty field without showing where it is honoured, **BNR has made a promise the protocol
cannot keep.**

**C2 — Three flagged gaps, none of which I closed by guessing:** the C2PA "existing
provenance ruling" I could not find (§1); **VIB undefined** (§6); jurisdiction unselected
(§7).

**C3 — §4's immutability interacts with the right to be forgotten and with takedown
obligations.** An immutable on-chain license pointing at permanent storage **cannot be
withdrawn**. That is a feature for the holder and a hazard where law requires removal.
**Named, not solved — counsel question, and it should be asked before launch rather than
after the first notice arrives.**

**C4 — No chain interaction, nothing signed, nothing spent, no contract deployed.**

## SOURCES

- [ERC-2981: NFT Royalty Standard](https://eips.ethereum.org/EIPS/eip-2981)
- [Enforceable Creator Royalties — Delphi Digital](https://members.delphidigital.io/reports/enforceable-creator-royalties/)
- [C2PA Technical Specification 2.3](https://spec.c2pa.org/specifications/specifications/2.3/specs/_attachments/C2PA_Specification.pdf)
- [C2PA and Content Credentials Explainer (2.4)](https://spec.c2pa.org/specifications/specifications/2.4/explainer/Explainer.html)
- [Story Protocol — PIL Terms](https://docs.story.foundation/concepts/programmable-ip-license/pil-terms)
- [Story Protocol — License Template](https://docs.story.foundation/concepts/licensing-module/license-template)
- In-tree: `docs/feature-backlog.md:459` (CD-18 Indigo Index)
