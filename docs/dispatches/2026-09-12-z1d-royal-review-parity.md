# z1.d — Sprint 2: schema/validator parity pass + integration-ready core PR

2026-09-12 · z1.d, Sprint 2 order from [#10 comment 5647975452](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647975452),
scope per Astra's acceptance note [#10 comment 5647902093](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647902093).
Medium effort, fixture-only; no signing/OAuth/live adapters, no PDS/posting/deployment, no new
dependencies, no storage fetcher, no vocabulary broadening.

| | |
|---|---|
| Parent | `8fcbd6d9` (accepted identity/uncertainty corrections — NOT repeated here) |
| Candidate | descendant on `z1d/royal-review-2026-09-12` (this dispatch's commit), **draft integration PR opened** |
| Owned paths | `crates/royalreview/**`, `dockets/lexicon/com.beehivenature.temp.royalReview.json` (descriptions only — no structural schema change), this dispatch |

## 1 · Verified against primary sources, then fixed

| # | Finding (with source) | Fix |
|---|---|---|
| 1 | **Length counting**: Lexicon String `maxLength` counts **UTF-8 bytes** ("maximum length of value, in UTF-8 bytes" — Lexicon spec, String type). The comment/label checks counted **code points** — 6,700 CJK chars (20,100 bytes) passed a 20,000 budget. | Both checks now count bytes (`str::len`); error text names the rule. Boundary test pins the exact divergence (6,666 CJK chars = 19,998 B passes; 6,700 = 20,100 B refuses; 20,000/20,001 ASCII at the seam). |
| 2 | **TID first-character bound** (was UNVERIFIED, now pinned): the reference regex is `TID_REGEX = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/` (packages/syntax/src/tid.ts — first char = the alphabet's first half, pinning the top bit of the 64-bit id). | `validate_tid` enforces the first-half bound; resolves the previously ledgered UNVERIFIED gap. Boundary tests: 'j' passes, 'k'/'v'/'z' first char refused; 0/1/8/9 anywhere refused; 12/14 length refused. |
| 3 | **Record-key grammar** (record-key spec): charset `A-Za-z0-9.-_:~`, length 1..=512, `.`/`..` forbidden, case-sensitive. Our at-uri rkey check was length-only. | Full charset + reserved-name checks in `at_uri_parts`; the spec's own valid (`~1.2-3_`, `pre:fix`, `example.com`) and invalid (`@handle`, `a+b`, spaces) examples are the tests. |
| 4 | **Collection = full NSID grammar** (NSID spec): ≥3 segments, total ≤317; authority segments [a-z0-9-] no lead/trail hyphen, TLD not digit-first; NAME segment letters+digits, no hyphens, not digit-first (uppercase legal — `royalReview`, like upstream's `strongRef`). Ours was charset-only and admitted 1–2-segment "collections". | Full grammar in `validate_nsid_collection`; boundaries tested both directions. |
| 5 | **strongRef subject form**: official strongRef accepts any at-uri; a review subject that names no record is meaningless. | Contract-strict: subject must be `at://did/collection/rkey` (repo-root/collection-only refused). **Receipt subjects keep repo-root legality** (SPEC_LEXICON-1 §5.1 repo-state form) — the two rules are distinct and now both tested. |
| 6 | **Receipt record grammar beyond parse**: atmirror's `Receipt` type checks structure/binding but not string grammars. | Cross-validation now also enforces the receipt's `createdAt` datetime grammar and its subject-uri at-uri/DID form. Wrong-typed fields were already refused by serde; now tested. |
| 7 | **Open properties** (Lexicon spec: "Unexpected fields … should be ignored") — the OPPOSITE of tightening: extra fields must be TOLERATED. | No change (correct as-was); pinned by test: a receipt with a forward-compatible extra field cross-validates. |
| 8 | **knownValues is non-enforcing** ("Values are not limited to this set (aka, not a closed enum)") while our validator enforces the four verdicts strictly. | Kept (permitted stricter-than-schema local policy, now stated in the artifact); flagged to Astra that closed-at-schema = swap `knownValues`→`enum`, a vocabulary decision for them. |
| 9 | **CID syntax scope**: official `format: cid` admits other multibase encodings (e.g. base58btc CIDv0 `Qm…`); atmirror's parser (reused) accepts base32-multibase CIDv1 only. | Documented restriction, deliberately stricter (everything this estate emits/references is base32 CIDv1); boundary tests pin base58/CIDv0/uppercase refusals so a future relax is a visible decision, not drift. |

## 2 · Syntax ≠ claimed identity ≠ verified bytes (the required separation)

New crate-doc section (`lib.rs`) names three levels and never lets them blur:
**L0 syntax** (hex shape, parseable CID, well-formed uri — all this crate proves), **L1 claimed
identity** (`subject.cid`/`contentCid` are the REFERENCED RECORD'S WRITER's assertions — shape
and internal consistency checked, underlying blocks never hashed by us), **L2 retrieved-and-hashed**
(fetch `storageRefs` bytes and hash — a live-adapter responsibility; nothing here performs it).
The lexicon JSON's sha256/storageRefs descriptions now say the same in contract language.

## 3 · Rejection-before-write vs ambiguous live-adapter semantics (the required documentation)

Also in `lib.rs`: the fixtures prove the orchestrator's decision table with zero sockets, and
NOT network delivery, NOT that a live relay/PDS maps errors onto `Rejected`→`Failed` vs
transport→`Unconfirmed` the way the fixtures do, and NOT any cross-rail atomicity (the write
pair is not a transaction; the partial state is surfaced, never hidden). The future live-sink
contract is stated as ACCEPTANCE REQUIREMENTS: only proven rejection-before-write maps to
`Failed`; ambiguous server/transport maps to `Unconfirmed` and must settle by probe;
concurrent-writer duplicate/create races are adapter acceptance requirements — sequential
fixtures cannot prove them. The sink-reported atproto CID limitation is restated unchanged.

## 4 · Tests

`cargo test -p royalreview` — **53/53 green** (14 unit + **14 new boundary** + 17 orchestration
+ 8 validation), zero network; `cargo fmt --all --check` clean; `cargo build --locked` green.
New suite `tests/boundaries.rs`, each case citing its rule: TID first-half bound; UTF-8 byte
budgets (the exact CJK divergence, ASCII seam, label bytes); multilingual content validity
(RTL/CJK/emoji; lone surrogates impossible in Rust `&str` — structural); NSID grammar
(segments, TLD digit, name hyphen/digit, 63/317 caps); record-key charset (spec's own valid
and invalid examples, `.`/`..`, 512/513); subject record-form vs receipt repo-root tolerance;
CID restriction (base58btc/CIDv0/uppercase refused — documented, not accidental); receipt
grammar (createdAt, subject-uri, wrong-typed fields, unknown-extra-field tolerance);
datetime fraction/offset seams.

## 5 · Integration PR

Draft PR opened from `z1d/royal-review-2026-09-12` → `main` (link in the #10 receipt).
It carries: the lexicon artifact, `crates/royalreview`, the workspace membership line and
lockfile entry (proposed in-candidate for Astra's integration, per the sprint note), and the
three dispatches (slice, corrections, parity). Unsupported/live behaviors are listed in the PR
body: no signing/BIP-340, no OAuth, no live adapters, no PDS write, no public posting, no
storage retrieval, no cross-rail atomicity, sink-reported atproto CID.

## 6 · Explicitly not done

Everything the assignment fenced off: signing/OAuth adapters, any PDS/publication, a storage
fetcher, new dependencies, record-vocabulary changes, `knownValues`→`enum` (Astra's call),
and the people/artist/Autonomi lanes (owned by z1.a/z1.b/z1.c and Astra).
