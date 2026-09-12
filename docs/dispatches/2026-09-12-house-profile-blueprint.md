# House profile blueprint · `.b` people, `.a` agents, crest and genealogy

Date: 2026-09-12

Branch: `codex/house-profile-blueprint-2026-09-12`

Base: `origin/main` at `d32acdf9c988d42ac4aaa2e1ab3a42c808b1d43b`

## Result

The existing registered dynasty profile now carries a reusable house archive rather than a second competing profile surface. The first archive uses the founder-supplied von Zutphen crest as the blueprint for `.b` person profiles, `.a` agent profiles, future `.social` domains, and estate marketplace views.

The same record has three presentations:

- **New bee:** the crest, a plain family story, consent-first lineage, and simple share/download actions.
- **Raver:** an immersive crest stage, holder-authored symbolism, and audience-circle controls.
- **Cypherpunk:** the exact artifact digest, disclosure manifest, privacy seam matrix, evidence states, and the separate `.a` authority/succession model.

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

## Honesty and privacy boundary

The design notes contain family interpretations and historical or royal imagery. The page publishes them as **holder-authored interpretations**. It does not certify nobility, a legal title, or a genealogical relationship. A historical claim must carry a source or remain explicitly unverified.

Living people are private until each person consents. Dates and locations default private. DNA and health data never default public. The audience control is labeled as a local preview because this static surface does not publish, encrypt, authorize, or persist access policy.

An `.a` record carries charter, runtime/model succession, authority bounds, revocation, and artifact provenance. It may inherit licensed house art; it never claims a blood relationship.

## Marketplace boundary

The crest is **not listed**, has no price, and has no buy action. Rights remain reserved until the holder publishes a license. Provenance and rights must travel with every future copy or listing.

## Translation boundary

The established profile shell still uses the Blanguage dock. The new archive is an English blueprint and says so on the page. It does not claim multilingual coverage until its copy has reviewed language records.

## Verification

- `node --test e2e/profile-views.test.mjs` — 13/13 pass, including v2 crest and SKAISTS separator byte/hash parity, SVG safety, three-view content, consent defaults, `.a` lineage, and existing profile contracts.
- Hosted front-door command from `.github/workflows/tests.yml` — 308/308 pass locally with the separator specimen included.
- `node scripts/estate-check.mjs` — pass; 94 counted, 103 listed, registry and hub source remain consistent.
- `node e2e/profile-house-archive-shot.mjs` — pass; all three 1280 px views, Raver at 390 px, no horizontal overflow, audience and `.a` controls, no page errors, no remote requests.
- Visual receipts are written to the local temporary directory; derived screenshots are not committed.

No live publication, genealogy upload, encryption, marketplace listing, sale, wallet action, or external network write occurred in this lane.
