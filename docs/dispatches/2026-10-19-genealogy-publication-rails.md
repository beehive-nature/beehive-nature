# 2026-10-19 — genealogy publication rails: the Rust seal, bound and gated

Founder orders this wake (three mid-lane constraints, verbatim intent):
"rust, fully decentralized, dApp web based if possible and scalable to 10
billion others without added costs to me the dev"; "when i say fully
decentralized it means fully leveraging our stack including
bDomain/.b/a b-index adapters"; "x0x seems also critical; plus the buzz
genealogy Agentic studio… we already built all most of the 13k+ wikis
with the buzz team running without one prompt from me for 27 hours".
Plus the standing instruction: autonomous engineering, not more
reconciliation receipts.

Delivered: `crates/genealogy-publication` in the root workspace — the
content-addressed publication seal for the existing corpus. Nothing was
re-harvested, no page rewritten, no receipt re-verified.

## What the crate does (Rust 1.98.1, workspace-member, zero network)

- **bind** — deterministic seal: `publication-state.json` (every one of
  the 11,041 staged persons' html+json sha256/bytes, all 9 corpus input
  digests, census) + `publication-index.json` (the machine index: per
  person — era, publication status, FamilySearch refs, record arks from
  the sources index, parents/spouses/children edges, page digests —
  digest-bound to the state). No timestamps: identical tree in,
  byte-identical artifacts out (proven by rebind: state `d8666b9c…`,
  index `a6704041…`, twice).
- **check** — the gate: re-derives everything from the tree and names
  drift (changed page with old→new hashes, changed corpus file, stray,
  missing, absent/stale/tampered state or index). Wired into CI as
  `.github/workflows/genealogy-publication.yml` (SHA-pinned actions,
  `--locked`, pinned toolchain, YAML-validated pre-push).
- **resolve** — the decentralized resolution record per person: canonical
  `bnr://` address under a `.b` anchor validated by `bnr-url` (ORDER cC
  label law — name-first, one label; the pages' legacy
  `bnr://skaists.dev/blood/…` host-form strings are display strings, not
  canonical addresses, and are not laundered into ones), content hashes,
  and the rail locators: github-pages bootstrap, arweave, autonomi, x0x.
  Locators only — rails fetch, this crate never does.
- **index counts at tip:** 11,041 persons; 11,035 FS refs; 9,927 record
  arks linked (cohort-scoped sources index); census 11,041 html + 11,041
  json + 0 strays.

## Evidence

- `cargo test -p genealogy-publication`: **5/5**, including sabotage
  negative controls (page tamper, corpus tamper, stray, missing page,
  stale/tampered/absent state — each goes red with the right name) and
  resolve (canonical `bnr://blood.b/person/pa`, ORDER-cC rejection of
  `Bad..x.b`, null-anchor path).
- Real-corpus receipts: bind green; check `{"green": true, "findings":
  0}`; determinism rebind byte-identical; real-scale sabotage — one byte
  appended to `persons/p3d44ccaffd.html` → three named REDs (page drift
  with both digests, total drift 1, stale index) → `git checkout` →
  green 0 findings.
- Real resolve: `bnr://blood.b/person/p3d44ccaffd` carries fsRef
  KWCL-VJ6, 9 record arks, both page digests, state+index digests, 4 rails.
- Hex-law compliance: both artifacts carry the top-level `hexLawNote`
  PUBLIC-CONSTANT marker (images-summary precedent) — same-line marker
  for their machine-generated 64-hex content digests; the secret-scan
  hook passed on staging.

## Honest boundaries

- Scale claim is bounded: static, immutable, content-addressed artifacts
  served from any host — adding readers adds no dev-owned capacity. NOT
  a load-tested 10-billion-user claim (bTunGsTeN doctrine wording kept).
- The seal is the RAILS layer. The buzz agentic studio's 13k+ wiki
  articles (27 h autonomous run, zero founder prompts — founder-stated
  baseline, not re-verified here) is the content engine; when the studio
  updates pages, `gp bind` re-seals in one command and CI holds the rest.
- Not done, named: no fetch code in any rail (adapters/dApp own that);
  no `.b` name registered (founder gesture — resolve takes `--bname` the
  day one exists); pages still carry legacy display addresses; no
  Autonomi/Arweave upload (fs-8gen gates unchanged: bytes HELD,
  uploaded:false); no IQ.wiki publication; no surfaces/ changes (the
  registration ritual is a separate beat when a surface consumes the
  index).
- Zero FamilySearch requests, zero private-tier writes, no wallet, no
  spend.

NEXT OWNER: the dApp read path (blood.html-class surface consuming
publication-index.json + verifying digests client-side) is the named
follow-on; rails fetch belongs to adapter-arweave / adapter-autonomi /
x0x (ops/x0x); `.b` anchor registration and IQ.wiki publication are
founder gestures; the buzz studio keeps the content.
