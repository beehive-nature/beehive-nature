# House profile blueprint · `.b` people, `.a` agents, crest and genealogy

Date: 2026-09-12

Branch: `codex/house-profile-blueprint-2026-09-12`

Base: `origin/main` at `d32acdf9c988d42ac4aaa2e1ab3a42c808b1d43b`

## Result

The existing registered dynasty profile now carries a reusable house archive rather than a second competing profile surface. The first archive uses the founder-supplied von Zutphen crest as the blueprint for `.b` person profiles, `.a` agent profiles, future `.social` domains, and estate marketplace views.

The same record has three presentations:

- **New bee:** the crest, a plain family story, consent-first lineage, and simple share/download actions.
- **Raver:** an immersive crest stage, holder-authored symbolism, and audience-circle controls.
- **Cypherpunk:** the full ceremonial achievement with shield and nine quarters, exact artifact digests, disclosure manifest, privacy seam matrix, evidence states, and the separate `.a` authority/succession model.

The founder's SKAISTS separator artwork now makes the two rails visible in the Cypherpunk view: `.a` is the cell — structure and the hive — while `.b` is the bond — love and the link. The supplied file is recorded accurately as a vector-path identity specimen, not an installable webfont.

## Artifact receipt

Source package: `Family crest millennial design v2.zip`, supplied by the founder outside the repository.

The v2 package was compared with the previously supplied package. Every included file was byte-identical. The canonical copied artifact is:

- `assets/profile-archive/house-crest-von-zutphen-DESIGN.svg`
- SHA-256: `6303A84263857D62568613F9929B33E0F74076A6640CEDF0D643BEB30E579088` (PUBLIC-CONSTANT)
- self-contained scan: no script, `foreignObject`, event handler, external URL, `href`, or `xlink:href`

The source SVG is copied unchanged. The companion JSON records the v2 label, digest, source package, holder, rights state, marketplace state, disclosure defaults, claim policy, symbolism, distribution targets, and `.a` lineage rule.

The founder also supplied the brand separator specimen:

- `assets/brand/skaists-separators.svg`
- SHA-256: `B0D7BA18BA028A6313A29288EBDAC0E77EEE73153344CD866756D3006329EE75` (PUBLIC-CONSTANT)
- self-contained scan: no script, `foreignObject`, event handler, external URL, `href`, or `xlink:href`
- semantics: `.a` cell / structure / hive; `.b` bond / love / link; both hands in the realm header

The separator source is copied unchanged and byte-pinned beside the crest. It is displayed only in the Cypherpunk archive panel so the simpler New Bee and Raver paths keep their visual focus.

The Cypherpunk crest now uses the existing house ceremonial master rather than the compact profile mark:

- `assets/seals/house-crest-von-zutphen-DESIGN.svg`
- SHA-256: `F9B2CE8428FFFC8FE215754858AB6F8DEB8691FB766CA16D226272F7A8331F40` (PUBLIC-CONSTANT)
- full composition: shield, nine quarters, supporters, coronet, crest, motto, and compartment
- the detailed source and evidence boundary remain in `docs/BLAZON.md`

The profile also reuses the existing Beehive Nature breathing bloom rather than rebuilding or renaming it:

- `docs/mvp-walk/assets/genesis-3d/motion/green-teal-breathing.svg`
- SHA-256: `9971D2CA697797AF7430B062CA1842AB063BA3746418E8963A527BD4BF017FE3` (PUBLIC-CONSTANT)
- original artwork by LoVis and his mother; purple represents people, teal AI, and green biomass
- the six-second ring wave runs locally, signals no network presence, and becomes still under reduced-motion preferences

## Profile customization boundary

An “Edit your profile” disclosure previews four bounded fields: published display name, motto, Cypherpunk profile line, and house accent. Text lengths are capped, changes use text nodes rather than HTML, and Reset returns the published blueprint. This first editor intentionally retains values only in the open page: it creates no account, performs no upload, writes no browser storage, and does not alter the signed provenance manifest. Persistent profile editing belongs behind identity, consent, revision, and publication receipts.

## Honesty and privacy boundary

The design notes contain family interpretations and historical or royal imagery. The page publishes them as **holder-authored interpretations**. It does not certify nobility, a legal title, or a genealogical relationship. A historical claim must carry a source or remain explicitly unverified.

Living people are private until each person consents. Dates and locations default private. DNA and health data never default public. The audience control is labeled as a local preview because this static surface does not publish, encrypt, authorize, or persist access policy.

An `.a` record carries charter, runtime/model succession, authority bounds, revocation, and artifact provenance. It may inherit licensed house art; it never claims a blood relationship.

## Marketplace boundary

The crest is **not listed**, has no price, and has no buy action. Rights remain reserved until the holder publishes a license. Provenance and rights must travel with every future copy or listing.

## Translation boundary

The established profile shell still uses the Blanguage dock. The new archive is an English blueprint and says so on the page. It does not claim multilingual coverage until its copy has reviewed language records.

## Verification

- `node --test e2e/profile-views.test.mjs` — 15/15 pass, including compact and ceremonial crest parity, breathing-bloom parity, SKAISTS separator parity, SVG boundaries, local editor limits, three-view content, consent defaults, `.a` lineage, and existing profile contracts.
- Hosted front-door command from `.github/workflows/tests.yml` — 310/310 pass locally with the full achievement, bloom, and editor included.
- `node scripts/estate-check.mjs` — pass; 94 counted, 103 listed, registry and hub source remain consistent.
- `node e2e/profile-house-archive-shot.mjs` — pass; all three 1280 px views, Raver at 390 px, full ceremonial image loading, editor apply/reset, audience and `.a` controls, no horizontal overflow, no page errors, no remote requests.
- Visual receipts are written to the local temporary directory; derived screenshots are not committed.

No live publication, genealogy upload, encryption, marketplace listing, sale, wallet action, or external network write occurred in this lane.
