# RECEIPT — Beehive University lands: the founder's yes, the fifth dock, and its gates

**From:** zCode (GLM 5.3) — the university seat by founder direction, this session
**Date:** 2026-08-20 · **Against:** `COMMISSION_BEEHIVE_UNIVERSITY_2026-08-20.md` (Seat 3)
**Status:** LANDED — `surfaces/university/index.html` + hub + review-deck registration +
this receipt. Seat 3 verifies on landing; Seat 3 pushes (one seat, one tree).

---

## 0 · THE FOUNDER'S YES — relayed, then verified against disk

Founder, verbatim, this session (2026-08-20):

> *"yes to the fourth seat, and the brief opens by naming what it is not: a content
> silo. The curriculum is the receipts. Every lesson ends in a verifiable act — you
> learn to read a COA by finding the panel undercount in our own material; you learn
> evidence grading by watching the funding flag fire on our own commissioned study.
> A graduate holds signed receipts, not a certificate."*

Relay verification, before any work (house law — relays can arrive stale or duplicated):

```
$ diff <(git show 523953c:docs/dispatches/COMMISSION_BEEHIVE_UNIVERSITY_2026-08-20.md) \
       docs/dispatches/COMMISSION_BEEHIVE_UNIVERSITY_2026-08-20.md && echo IDENTICAL-TO-DISK
IDENTICAL-TO-DISK
```

The pasted brief and the committed brief are the same text (the paste carries CRLF; the
disk file is LF — content identical, 109/109 lines). No duplicate landing: no
`surfaces/university/` existed in history before this commit (`git log --all --
surfaces/university/` empty). Law #9 satisfied.

## 1 · WHAT THE FOUNDER'S WORDS RULED, AND WHAT THEY DID NOT (readings flagged, per house law)

- **U-3 (mint or receipt?) — RULED in substance.** The founder's own sentence — *"A
  graduate holds signed receipts, not a certificate"* — takes Seat 3's recommendation
  as the reading: the signed receipt is the whole credential; nothing mints; the page
  says so and the page mints nothing. **The reading is this seat's; the words are the
  founder's.** If the founder meant narrower words, one line corrects it.
- **U-2 (wing vs repo) — APPLIED as a wing**, per the commission's own recommendation
  ("a separate repo would tempt it into becoming a content silo") which the founder's
  *"naming what it is not: a content silo"* endorses in substance. The surface title
  carries **"Beehive University"** — the founder's own name for the section, verbatim
  in the commission's quoted direction. **The SEAT's name remains the founder's to
  give (U-2 open); nothing on the surface claims a seat name.**
- **U-1 (b-gating vs CD-29) — OPEN, untouched.** The three registers ship UNGATED with
  the toggle note stating the founder's late-beta gating ruling and the open reading.
  Holding is not spending; a seat does not decide it.

## 2 · WHAT LANDED

| artefact | what it is |
|---|---|
| `surfaces/university/index.html` | the wing — charter (founder's words verbatim), three registers (bee 🐝 / raver 🎛 / cypherpunk ⚗ — one set of constants, prose only diverges, per BiGen's level law), five courses, five verifiable acts, transcript, gates table, graduation |
| `surfaces/index.html` | hub card in READ ("🎓 Beehive University · NEW · THE FIFTH DOCK"), footer 31→32 |
| `surfaces/review.html` | `university/index.html` added to the SURFACES roster (28) — review receipts can target the wing; static `/27` fallback corrected to `/28` |
| `e2e/university-smoke.mjs` | the verification below, committed and re-runnable by any stranger (CI still runs `node e2e.mjs` only — the streak is untouched) |

**The five courses, each a view over in-tree receipts (cite or it does not ship):**

1. **How to read a lab report** — cannabinoid receipt (FSANZ confirmed-hulled survey,
   the 0.877 factor, hull-on vs dehulled, the steelman) + the tri-jurisdictional COA
   spec (LOQ ≤ 0.1 µg/g law, no-zero law, blank = rejection). **Act:** find the panel
   undercount — "total THC" is exactly 2 analytes of a family no panel exhausts; then
   compute the claim-vs-median factor live (10,000 mg/kg vs 2.4 mg/kg ≈ 4167×).
   Wrong answers are refused with the reason, never silently passed.
2. **How a requirement is set** — shortfall receipt §3/§6 + the Hexagon's DV/UL
   form-restriction records. **Act:** compute your own protein target (1.2–1.6 g/kg,
   DGA 2025–2030), then map what scales with body mass and what does not; the
   9%-below-EAR-yet-average-below-goal specimen (the bar moved, not the data).
3. **How to be lied to with a true number** — shortfall receipt §1–§4, the brake
   attached. **Act:** reconcile 96% below EAR with 5% at risk of deficiency (intake
   statistic under a minimal-sun assumption vs serum 25(OH)D status), then catch the
   hidden boring half (iron, 6% below EAR, population-wide not a shortfall).
4. **How to read a chain** — the census's two-source method + the corrections ledger.
   **Act:** the witness test — two independent oracles = fact; one oracle asked twice
   = one witness; a timed-out site rendered as "0 holders" = a failed fetch, never a
   value.
5. **How colour communicates** — the founder's law ("colors should never operate
   singular"), the pair-check, the validated set, the 3a0be7b/8b64cc2 correction story.
   **Act:** break the palette — swap green next to orange, watch the live normal-vision
   ΔE and the protan-trap warning fire; restore the validated order (only the
   receipted order carries its validation).

**Every act composes a receipt** in a `[bUni · cN]` grammar (publishable text, local
transcript, localStorage-only). **Graduation** composes a `[bX review]` line — the
grammar the Royal Guard already verifies — and hands it to `review.html` for passkey
signing. The page holds no keys, posts nothing, observes nobody, mints nothing.

**Laws honored:** presentation law (the page leads with method and nutrition framing;
cannabinoids appear only as lab-report pedagogy) · Axis wall (composition and
definitions only; every DGA quote stops at the intake half, per shortfall §7) · corpus
law live (father-tongue select shares `btranslated_pref` with bTranslated — the
preference travels between surfaces local-first; status labels render in the father
tongue, ⚙ machine-draft badged when unattested) · the validated colour set REUSED in
its validated order (works · idea · bug · gap; green never adjacent orange; receipt in
the header comment) · identity never rides colour alone (glyph + label always) ·
nothing hover-only (every value is inline text — the founder reads on an A16) ·
collisions flagged, never resolved silently (§4 below).

## 3 · VERIFICATION — commands and real output (Windows-side node v24.18.0, Git Bash; chromium via the repo's e2e playwright)

Syntax gate (the inline script, extracted and checked):

```
$ node -e "…extract <script> to %TEMP%/buni.js…"
$ node --check "$TEMP/buni.js" && echo SYNTAX-OK
SYNTAX-OK
```

Full browser walk (`cd e2e && node university-smoke.mjs` — self-serves the tree over a
local HTTP server, chromium headless; committed alongside the surface):

```
PASS title
PASS no page/console errors on load
PASS five courses render
PASS gates table states
PASS register switch changes prose (bee→cypherpunk)
PASS bee prose restored
PASS corpus labels follow father tongue (ru)
PASS corpus back to en, no machine badge
PASS c1 correct answer accepted
PASS c1 ratio computed
PASS c1 receipt line
PASS c1 status verified
PASS c1 wrong answer refused honestly
PASS c2 protein computed for 80 kg
PASS c2 receipt line
PASS c3 reconciliation accepted + brake shown
PASS c4 witness A accepted, B/C refused in prose
PASS c4 failed-fetch option refused
PASS c5 swap raises the protan-trap warning
PASS c5 live normal-vision ΔE computed
PASS c5 restore returns the validated order note
PASS c5 status verified after restore
PASS transcript holds all five receipts
PASS progress state reads 5 of 5
PASS graduation line is [bX review] grammar
PASS no errors across the whole walk
PASS hub links the university
PASS hub counts 32
PASS review deck lists the university surface

29 passed, 0 failed
```

Layout sanity: desktop 1280px + mobile 390px screenshots taken (headless chromium);
the wing renders in the house grammar and stacks single-column at phone width with no
clipped content. The ΔE figure computed live in the palette act is labelled honestly:
**normal-vision OKLab only** — the CVD figures on the page are carried from the
receipted validator run, never re-derived by this page.

## 4 · THE BUILD'S OWN CORRECTION LOG (museum doctrine: shown, not hidden)

Three defects were shipped to disk and caught by this seat's own verification before
landing, each fixed in place:

1. **A missing `},`** after course 2's `compute` function broke the entire inline
   script (every course rendered empty). Caught by `node --check`; one character class
   of fix.
2. **A wrong lookup path in the palette act** — the renderer read `c.order` /
   `c.names` / `c.hex` at course level while the data lives at `c.act.order`. The
   course object HAD the keys; the path was wrong — which is exactly why the
   data-section re-evaluation probe kept passing while the page kept failing. Found by
   tapping the live function's arguments from the browser; the probe dump showed the
   key present and the value absent on the wrong object.
3. **Two `onclick` handlers trapped in IIFE scope** (`setReg`, `gradLine`) — the
   register buttons and graduation button silently no-oped with a console ReferenceError.
   Exposed deliberately at boot with a comment saying why.

Pedagogy note cut from the same cloth: course 3's success feedback originally showed
only the "second catch"; it now explains the reconciliation first — feedback that
withholds the reason is a brake-less number.

## 5 · COLLISION FLAGGED, NOT RESOLVED (house law; another seat's surface, mid-sprint)

**`surfaces/bfood.html` still renders saturated fat as one undifferentiated number**
(`{k:'sat. fat', … v:[4.6, 2.65, null, 82.475]}`) while the founder-ruled fatty-acid
disaggregation law (RECEIPT_SHORTFALL_ARBITRAGE §5a, landed b0d0113, 2026-08-20)
states: *"the surface may never render an undifferentiated 'saturated fat' total"* —
three rows (MCT C6–C10 · lauric C12 · LCT C14+), gate FA-2 pending. bfood predates
the law's landing. **This seat does not edit another seat's surface mid-sprint; the
flag goes to Seat 3** (whose verification lane owns bfood), with the note that the
disaggregated USDA chain-length column already exists — "a column we stopped hiding,"
per the receipt. The university's own course 1 teaches exactly this error class and
points at the COA spec's §2.3 as the honest shape, so the two surfaces will agree the
day the law reaches bfood.

## 6 · OPEN FOR THE FOUNDER / SEAT 3

- **U-1** — the b-gating vs CD-29 reading: gates the upper two registers in late beta;
  nothing is gated today.
- **U-2** — the seat's name. The surface carries the founder's own section name;
  the seat label awaits his word (the commission's "zUni" is a placeholder and appears
  nowhere on the surface).
- **U-3** — ruled in substance by the founder's sentence (§1); one line corrects if
  the reading is narrower than the words.
- **Seat 3 verifies on landing**: the smoke is `cd e2e && node university-smoke.mjs`;
  the pair-law receipt for this surface is the REUSED validated set (no new palette to
  validate — reuse was the design decision); mobile path walked (§3).
- **Known non-features, stated rather than hidden:** the corpus layer on this wing is
  six label keys × six father tongues, machine-drafted; full RTL direction handling
  remains the design seat's D-13 lane (Arabic renders as text; the layout does not
  flip). The `[bUni · cN]` exercise lines are not `[bX review]` grammar and do not
  tally on the deck — only the graduation line does, by design: exercises are
  practice receipts, graduation is the published one.

**zCode (GLM 5.3), 2026-08-20 — the university seat, by the founder's word this session.** 🐝
