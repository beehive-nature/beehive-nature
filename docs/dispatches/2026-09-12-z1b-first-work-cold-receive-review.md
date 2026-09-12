# z1.b cold receive/export/import review — PR #35 at 8eac7117 — 2026-09-12

Seat: z1.b (zCode GLM 5.3, Max), the docket's independent read-only reviewer.
Fresh session, own worktree `wt-z1b-first-work` (detached at the pinned head).
Reviewed head: **`8eac7117`** (PR #35, branch `codex/first-work-journey-2026-09-07`,
merge base vs origin/main `df895c7c`, 12 commits, 24 files, +2248/−3).
Release contract read first: `docs/specs/first-work-release-contract.md` (v1).
No source edits, no merge pushed, no deploy. Receipt branch
`z1b/first-work-review-receipt-2026-09-12` (based on origin/main `de7120d4`,
i.e. after PR #58's observer release; adds only this file and
`e2e/shots-z1b-first-work/`).

## Verdict

**Acceptance-ready. No release blockers on the receive, Keep, share, export,
import, merge, refusal, denial, motion, keyboard, print or 390px paths.**
One minor cosmetic finding (W1) and one mechanical integration item for Astra
(I1). The PR's self-declared outstanding items — native re-import of the new
bloom export, and a fresh 390px/print check on an integrated head — are both
covered green by this review. z1.b does not merge or deploy; integration is
Astra's.

## The walk (real browser, local fixtures and browser stores only)

86 named checks (phases A–R), desktop 1280×800 and 390×844, served from the
pinned worktree at `http://127.0.0.1:4191`. Run **twice**: once at the pure
head `8eac7117` and once at the trial merge `a6431950` (head + origin/main
at `8d42da28`, see I1). Identical results both runs: **84/86 pass**, the two
exceptions dissected below (one harness artifact, one real-minor). Committed
evidence: 18 screenshots in `e2e/shots-z1b-first-work/` (taken at the
integrated head — the release-relevant tree). After PR #58 landed on main
mid-review, I repeated the trial merge against current main `de7120d4`:
clean (PR #58's CI addition does not touch the front-door line), head
`0c554b40`; PR suites 51/51 and estate-check PASS re-run there; no surface
file changed vs the walked merge, so the browser evidence stands.

Receive and credit first — verified:
- Cold arrival on `#work=bnr-genesis-bloom-v1` shows the work and the full
  maker credit ("Original artwork by LoVis and his mother") before any
  prompt; unknown-work panel hidden; zero external requests; zero page
  errors; the same-origin SVG bloom loads inside its object.
- Share link is canonical (query stripped, work fragment kept) even when
  arriving with `?utm_source=…`; `#makers`/`#collection`/`#share` anchors
  resolve the same work; `#share` arrival opens the share details.
- Unknown fragments all refuse Keep and show the honest unknown-work panel:
  impostor id, `#work=<id>&extra=1` (two params), and a 250-char hash
  (length guard), each verified in the rendered DOM.

Keep, duplicates, persistence — verified:
- Explicit Keep → exactly one canonical record (`bnr-genesis-bloom-v1`,
  artist "LoVis and his mother", schema `bnr-listen-later/1`), button flips
  to disabled "In your collection", survives reload and skin changes.
- Triple-tap burst keeps one record (busy guard); a forced click on the
  disabled button is a no-op; re-import of an exact duplicate file counts
  once ("0 added; 2 already"); exact duplicates inside ONE file dedup in the
  preview (1 row, 1 added).
- Impostor protection: a store pre-seeded with the bloom ID under a forged
  artist never lets Keep claim success (refuses with "same ID with different
  details"), and a forged envelope is rejected at file-choose time before
  any preview renders, writing nothing.

Share/receive retention, motion, keyboard — verified:
- Share opens without changing the selected work; share link focused and
  selected; the details stay open across skin changes.
- Skin changes (bee→raver→bee via the real register control) never recreate
  the work object, Keep button or collection list (element-identity marks
  survive), kept state and open import preview included.
- Pause toggles `is-paused` on the SVG root with `aria-pressed` and label
  flip, and resumes; pause does not touch Keep/share. Under emulated
  reduced motion the button is disabled and labeled "Motion reduced" and the
  bloom starts paused. Visibility-hidden pagehide/refresh behavior in source
  (`receive.js:216-233`).
- Keyboard: skip link is the first tab stop and lands focus on
  `#work-content` (work stays visible); tab order reaches Keep through the
  real controls; Enter keeps; after a focused Remove, focus lands back in
  the collection area (verified `collection-status`/adjacent row restore —
  my first probe failed only because a programmatic `.click()` never moves
  focus; with a real focused click the restore works).

Export / import / merge — verified end to end:
- Export (2-item store) fires a real browser download of
  `bnr-listen-later.json`; envelope = schema + note + exportedAt + 2 items,
  bloom credit travels; status says "Download requested", never a cloud claim.
- Isolated second browser store (fresh context): choosing the file ONLY
  previews (store still `null`), Cancel dismisses with "Import cancelled.
  Your collection is unchanged." and writes nothing; deliberate Add merges
  both items ("2 added; 0 already"); the imported bloom row links to the
  canonical work page; external rows are `_blank` + `noopener noreferrer`.
- Merge with an existing collection (pre-seeded third record): existing
  record preserved, both new added ("2 added; 0 already"), no duplicates.
- Refusals: conflicting ID vs the existing store refuses the ENTIRE import
  ("Nothing was added or replaced"), store byte-unchanged; malformed file
  and wrong-schema file each refused with "not a supported BNR collection";
  empty file: "This file has no references to add", Add stays disabled,
  nothing written (see W1 for the cosmetic part).
- Stale reads: generation counters verified in source
  (`receive.js:13-14,177-203`; pagehide bumps both) and covered by the PR's
  DOM suite (stale file/clipboard callbacks cannot update state); in-browser
  sequential choose verified (newer valid read replaces the older error). A
  genuine async race is not deterministically reproducible without
  artificial I/O delay, so the suite remains the evidence there — stated,
  not papered.
- Two tabs, one origin: Keep in tab 1 is visible in tab 2; Remove in tab 2
  refreshes tab 1 back to "Keep this bloom" via the storage event.

Failure states — verified:
- Fully denied storage: the work and credit still render; Keep/Export and
  all Remove buttons disabled; statuses honest ("The browser refused the
  change. Nothing was replaced." / "Your collection is unavailable. You can
  still enjoy and share the bloom."). No success claim anywhere.
- Denied write with working read: Keep reports refusal, button never claims
  "In your collection".
- Clipboard unavailable: falls back to a focused+selected link with "Copy
  was unavailable…", never success; the link keeps the canonical URL.
- `native-share` stays hidden without the API (headless), per contract.

Presentation — verified:
- 390px: zero horizontal overflow (scrollWidth delta 0) on arrival and with
  the share card open; tap Keep works; zero page errors.
- Print (emulated `media: print` on `works/bloom-genesis-share.html`, the
  printable card): the mounted view control and page chrome (preview line,
  crumbs, actions) are hidden; card, art and maker credit stay visible —
  including the `#bregctl`-in-host case (my first probe queried `#bregbar`,
  which does not exist on pages that supply their own
  `[data-register-host]`; direct probe of host+ctl under print: both
  hidden — harness artifact, product correct).
- Both companion pages (`works/bloom-genesis.html`,
  `works/bloom-genesis-share.html`) render with credit, zero page errors,
  and lead back to the canonical work (`first-work.html#work=…`).

Candidate suites reproduced at both heads: `node --test` on the three PR
files = **51/51** at `8eac7117`; **99/99** at the trial merge `a6431950`
(51 PR + 48 main-side, incl. `register`, `lang-coverage`, and three of the
#55 view suites) plus `scripts/estate-check.mjs` PASS (93 counted, hub in
sync); re-confirmed 51/51 + estate-check PASS at `0c554b40`.

## Findings

- **W1 (minor, cosmetic — not a blocker):** choosing an EMPTY collection
  file (`items: []`) still unhides the `#import-preview` box:
  `receive.js:197` sets `import-preview.hidden = false` unconditionally, so
  the reader sees "Check these references" with zero rows (Add disabled,
  honest status, nothing written). Smallest cure: unhide only when
  `preview.items.length` is nonzero. Astra may fold this into integration or
  accept as-is.
- **I1 (integration, mechanical — for Astra):** merging the branch into
  current origin/main produces exactly ONE textual conflict:
  `.github/workflows/tests.yml` "Front door" line, where both sides appended
  suites (branch: `first-work`, `bloom-work-pack`; main: the eight #55 view
  suites). Everything else merges clean — including the +122-line
  `surfaces/register.js`, `tour.js` and `lang.js` drift from main's side,
  and PR #58's separate CI addition. I resolved the line as the union in
  LOCAL trial merges (never pushed): `a6431950` vs main `8d42da28` and
  `0c554b40` vs main `de7120d4` (current, post-#58, clean beyond the same
  one line); the full 86-check walk ran green on the merged tree (84/86,
  same two known items), so current shared chrome does NOT regress the
  candidate. Astra's real merge needs the same union line (proven green
  here, observer suite intact alongside).
- **Store/identity law:** the shared-library delta is purely additive
  (`previewImport` + `importItems` on the same `bnr-listen-later` store,
  schema and exclusive lock) — no second store, no second work identity, per
  the sprint's constraint. Verified in the diff, not just the claim.
- **Honest claims re-checked on the rendered page:** the evidence panel
  states no ownership transfer, no chain receipt, social previews/QR
  unverified, no human-adoption measurement — matching the contract's
  wording. og/twitter metadata carries the original JPG with credit in
  title/description; no platform-render claim is made anywhere.

## Not claimed by this review

Human adoption observation, public social-card render, QR scan,
native-language approval, JAMS compatibility, media upload, ownership
transfer. Per contract those are separate evidence; a public route test
follows release. The translation corpus does not cover this page and the
contract does not ask it to.

## z1.a / PR #57 delta

PR #57 was still at `f19513c1` when this review closed (z1.a claimed the
Sprint 2 patch at #10 comment 5647992765; head not yet pushed). The delta
review (F1/F4/F5, repaired profile assertion, mobile/RTL wrapping, retained
accepted paths) follows in a separate receipt with its own exact head, per
the docket.
