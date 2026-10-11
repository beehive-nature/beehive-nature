# 2026-10-10 — zCode/bHERALDRY round 3: the portal read — revision 3, the resolution, the dock

Seat: zCode (GLM-5.3). Founder order bHERALDRY-003: continue lane C from
current main; verify ДВ бр.62/1997 against the disputed transcriptions;
examine the 1995 constitutional ruling and the 2017 Council-of-Ministers
decision; specimen revision 3 only where newly verified evidence supports it;
advance lv/zh/ar through existing bLANGUAGEdock interfaces; integrate the
surface with existing localization; adversarial regressions, deterministic
artifact checks, zero-worse UX gates, independent review; CI, PR, authorized
merge, post-merge verification, receipts, dispatch, handoff. Worktree
`../wt-zcode-bheraldry3`, branch `zcode/bheraldry-003-2026-10-10`, cut from
origin/main `28cdc53bf`.

## 1. The gazette was actually read this time — how

The r2 blocker was the portal's JSF deep links. This round walked the flow
mechanically (curl + the portal's own session cookies, every step the same
gesture a browser makes):

1. `broeveList.faces` (GET) → parse the `broi_form` filters + ViewState;
2. date-filter POST `1.8.1997–10.8.1997` → issue rows, each carrying
   `broi_=62, idObj=5036, date_izd_=1997-08-05`;
3. the issue-download link (`_idJsp109`, `id_=5036`) → **HTTP 302 →
   `fileUploadShowing.jsp?&idFileAtt=191101`** → the official PDF:
   `Content-Disposition: filename=62_1997.pdf`, 1,461,387 bytes,
   **sha256 `a08ec6f10a8834b34fab55a205166c9e8d64a086339ab0707fe20beec337074d`** <!-- PUBLIC-CONSTANT (sha256 of the portal-served 62_1997.pdf) -->
   The bytes are deliberately NOT committed (the issue's приложения carry the
   state insignia images); the digest pins the evidence channel, and the
   walk above is the reproduction recipe.

**What the PDF is, honestly:** a re-typeset MACHINE-TEXT edition — zero image
XObjects (verified by object inspection), glyphs mapped through a
CP1251-flavoured encoding that had to be reversed to read the text. It is
the National Assembly's own publication channel serving the issue, one step
from the 1997 ink print — which itself remains unread. That nuance is
in-record; no claim here says "the print was read".

## 2. The adjudication (item 1 of the order)

- **All seven originally disputed wordings are settled by the portal edition,
  in the direction of the 2026-10-10 lex.bg rendering** (rev 2's choice):
  „има голяма корона“, „с плодове“, „трикольорен кант … изписано“, „две
  кръстосани … клонки“, „от лява и дясна“, the sentence split at „корона.“
  — rev 1's variants („е разположена“, „с желуди“, „кантова ивичка“,
  „написано“, „от лявата и дясната“) are all contradicted by the portal text.
- **Four residual word-level divergences remain open** (portal vs BOTH lex.bg
  renderings): „първообраз на **която** са корони на **български** владетели“
  (lex.bg: „на които са короните на българските“) and „**отделно кръст**“
  without „разположен“ (lex.bg: „отделно разположен кръст“). Retained as the
  shrunken dispute; only the ink print can close them.
- **УКАЗ № 304 (in the same PDF, page 10) resolves the adoption-date
  dispute**: adoption **31 юли 1997** (the law's § 1), decree **издаден в
  София на 4 август 1997**, publication **ДВ бр. 62 от 5 август 1997** —
  three events, all primary-named. English Wikipedia's „4 August“ was the
  decree date all along. The dispute's positions stay; its note records
  RESOLVED BY PRIMARY EVIDENCE (a revised conclusion, not an erasure).
- **Решение № 1 от 4 април 1995 г. по к.д. № 5/1995** — read in full from
  the Constitutional Court's own site (`constcourt.bg/bg/act-1785`, direct
  fetch; published ДВ бр. 35/14.04.1995): чл. 164 fixes the MAIN elements,
  its enumeration „не е и не може да бъде изчерпателно“, and on the crown
  specifically „няма пречка в държавния герб на една република да има
  корона“ — citing the republican arms of Austria, Armenia, Poland, Russia,
  Czechia, Hungary, Finland. Brought by 74 MPs of the 37th НС; separate and
  dissenting opinions exist (their authors deliberately not named — the
  no-living-person boundary). The r2 tertiary channel is replaced by the
  court's own text.
- **Решение № 480 от 28.08.2017** — read from the portal's own material page
  (issue 71/2017 → material `idMat=117459`, ДВ бр. 71 от 1.9.2017 г.,
  стр. 14, direct fetch): a CoM consent „на основание чл. 3, ал. 2 от
  Закона за герб … във връзка с чл. 11, ал. 3 от Закона за марките и
  географските означения“ for the arms' image **in the mark of „Държавен
  вестник“ itself** — the organization elided in r2's snippet, now named by
  the act. Quote-verified; signature blocks are not carried (offices and
  instruments are named, officeholders are not).

Primary evidence, disagreements, and what remains inaccessible are recorded
separately in-record: the four residual wordings + the ink print = the
inaccessible remainder; every access_note above says what channel carried it.

## 3. Revision 3 (item 2) — corrections that do not rewrite

`bg/national-arms` rev 3 supersedes rev 2 by exactly its frozen digest
`fd991cf4…70a759`; **rev 1 and rev 2 builders are byte-identical and still
pinned** (`bulgaria_national_arms_v1`, new `bulgaria_national_arms_r2` —
the refactor moving the public constructor to rev 3 is proven byte-safe by
the unchanged rev-2 frozen vector). Working text = the portal edition's own
Чл. 2 (1) (whitespace-normalized: line-break hyphens joined, extraction
item-boundary spaces restored; no characters changed; the portal's „…“ quote
glyphs kept). New sources: portal PDF, УКАЗ № 304, the court's own
Решение № 1/1995, the quote-verified Решение № 480/2017, and the three
lv/zh/ar Wikipedia claims. Frozen: **rev 3 = 86,087 canonical bytes, digest
`d0106aa4817b9e9d35e3f0c2aa50f6a67eaeea23c7d3b64511e8b84c103976d7`** <!-- PUBLIC-CONSTANT (frozen bg rev3 digest, re-pinned after the review fixes) -->
(re-pinned once after the independent review's citation fix — the first
sealing was 84,085 bytes / `4101baf1…917bc4`, superseded intra-round
before merge; the chain law made the re-pin a fresh freeze, not an edit).
`bnr/house-achievement` stays rev 2 (no new evidence — unchanged bytes).

## 4. lv/zh/ar through bLANGUAGEdock (item 3)

Each of the three ⚙ machine drafts gains a **DocumentedVariant** with a
tertiary SpeakerProvided attestation — the existing tier interface
(`crates/language-authority`), no new mechanism:

- lv „**Vienotība dod spēku**“ (lv.wikipedia — differs from the machine draft
  „rada“ → „dod“);
- zh-Hant „**團結就是力量**“ (zh.wikipedia, served traditional; its own
  simplified gloss 团结就是力量 is the exact machine-draft string);
- ar „**الوحدة تولد القوة**“ (ar.wikipedia — differs from the machine draft
  تصنع → تولد).

The machine drafts REMAIN beside them, ⚙-marked; nothing becomes official;
the original stays the only authority. Quote-level fidelity of the wiki
fetches is assistant-mediated and caveated in-record exactly like r1/r2's
wiki claims. New regression **r06** proves the laundering is impossible three
ways (machine-as-official; no-basis; tertiary-basis), each a named refusal.

## 5. Surface localization (item 4)

The surface joins the estate's localization on the corpus's own terms:
`data-i18n` on the five page-chrome strings (two ledes, the standing
boundary's heading and text, the footer), `scripts/bheraldry-corpus.mjs`
(the `stack-dataflow-corpus.mjs` pattern — idempotent, refuses unless every
key carries all 28 docked tongues), 5 keys × 29 cells committed, `_meta`
drafting ledger updated. **Scope law, in the writer's header and the corpus
note: corpus keys cover page chrome only — record-derived content never
machine-swaps**, because the record's own translations are typed claims with
attestation tiers, not UI strings. The surface enters
`e2e/lang-coverage-set.json` with floor **5** (measured: 266 visible leaves,
5 keyed, 0 empty cells, 0 missing keys — the unkeyed remainder is the name
`bHERALDRY`, pointer principle, plus record content, scope law). Three
registers untouched (the shared control still drives the page), mobile
layout untouched, external links still new-tab with the footer saying so,
standing boundary pinned on top.

## 6. Gates and regressions (item 5)

- **38 crate tests green** under `--locked`: 16 adversarial (r04: portal
  claim paired with lex text → `BlazonTextDivergesFromSourceVerbatim`; r05:
  resolution rollback → shipped digest refuses + the УКАЗ quote checkably
  present; r06: three-way machine laundering → named refusals; a08 extended
  to the real v1→v2→v3 chain), 9 frozen-vector (rev1/rev2/rev3 pins, the
  chain, the portal-wording and corpse checks), 2 artifact-parity (the
  regenerated JSON pinned to fresh seals; tamper refused), 1 bsigner
  ML-DSA seam, 10 positive.
- **Deterministic artifact**: `bheraldry-records.json` regenerated via
  `--export-json`; drift fails CI by test.
- **Zero-worse UX**: `node e2e/footer-audit.mjs --only bheraldry.html` →
  **3 views, 0 findings** (zero is the floor; nothing baselined).
- `cargo fmt --all --check` clean; `estate-check` PASS (112 · 121 · hub in
  sync); `build-stack-inventory --check` 23 components; i18n selftest PASS;
  lang-coverage tests 13/13; atlas tests 15/15.
- **Independent review: APPROVE WITH NOTES, no blockers** (fresh-eyes
  reviewer, read-only, went beyond the lane's own evidence: re-fetched the
  portal PDF — sha256 and the seven settled wordings confirmed byte-for-byte
  — plus the court act page and the 480 material page live; reproduced the
  whole gate set; searched for officeholder names — zero hits). Its findings
  and what this seat did with them: (1) MINOR, r05 had no named
  LawViolation → the test now ASSERTS the rolled-back record still validates
  cleanly, making the digest's solitude checkable instead of hidden; (2)
  NOTE, the ink-print dispute position cited rev 2's pre-read portal claim →
  re-pointed to rev 3's own portal claim (rev 3 re-pinned: 86,087 bytes,
  `d0106aa4…976d7`); (3) NOTE, the УКАЗ 304 note now names the collapsed
  letter-spaced heading explicitly; (4) NOTE, floors/set re-serialization
  noise — accepted (semantic diff is one entry each); (5) NOTE, the
  "266 visible" figure not re-measured by the reviewer — the gate-relevant
  numbers were.

## 7. Boundaries not crossed

- The ink print of ДВ бр. 62 remains unread — said so everywhere it matters;
  the portal edition is named as a machine-text edition, not a photograph.
- No state-insignia bytes committed; the PDF stays out of the tree (digest
  only). No signature blocks of living officeholders anywhere in the record.
- lv/zh/ar remain WITHOUT any official rendering claim; the ⚙ drafts stay
  ⚙. The court ruling is carried as historical interpretation of the
  constitutional article, not as a ruling on the 1997 statute.
- Disputes are still never adjudicated by the crate: what looks like
  adjudication lives in dispute NOTES as revised conclusions, with the
  positions retained as history (the corrective discipline).
- No secrets read, held, or printed.

## 8. Receipts

- Local (Git-for-Windows, cargo 1.98.1): `cargo test -p bheraldry --locked`
  → 38 passed, 0 failed. Build of touched crates clean; `bsigner` built for
  the seam test (`cargo build --workspace --locked` is CI's first step).
- CI receipts for this push: on the PR (all suites), verified before merge.
- Post-merge verification: check-runs of the merge commit, green, quoted in
  the handoff note.

## 9. Next owners + handoff

- **The ink print of ДВ бр. 62** (four residual wordings): needs the paper
  or a faithful photograph of page 10 — not machine-reachable, honestly open.
- **lv/zh/ar attestation**: the documented variants await a speaker or the
  respective state's own rendering to leave tertiary; the bLANGUAGEdock
  persona seam is the prescribed path when social attestation becomes real.
- **Record-content i18n**: deliberately out of corpus scope by law (see §5);
  if a future seat wants translated section headers, that is a corpus-key
  design question first, a code change second.
- Lane queue after this round: EMPTY. Carry-overs recorded above; session
  archivable per the carry-over law once CI is green and memory is updated.
