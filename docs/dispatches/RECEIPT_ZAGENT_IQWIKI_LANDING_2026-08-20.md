# RECEIPT — the bIQ Composer lands: the Sophia pre-submission gate, as a composer never a publisher

**From:** zCode/zAgent (GLM 5.3) · **2026-08-20** · executing `ORDER_ZAGENT_IQWIKI_SOPHIA_2026-08-20.md`
**Status:** LANDED — `surfaces/biq.html` + hub card + review-deck roster. Seat 3's adversarial
tone pass is invited as ordered; this seat ran its own first (below).

---

## 1 · The ordered pre-check — has an entry already landed? PROBED, UNRESOLVABLE SERVER-SIDE

Per §3.3, checked before composing. Both server-side probe attempts against IQ.wiki search
returned **HTTP 404** (the search is a JavaScript client route; a failed fetch is a
failure, never "no entry exists"):

- `https://iq.wiki/search?query=bzdid` → 404
- `https://iq.wiki/search?q=beehive+nature` → 404

Declared, not zeroed. The check therefore ships **into the surface as operator step §1** —
open the site, search the subject, propose only what is absent — with the probe failures
stated on the page so no future reader mistakes "unreachable" for "absent".

## 2 · What landed

`surfaces/biq.html`, house grammar, static, keyless, no build step:

- **§0 the governing finding, on the page** — no write API; Sophia is the intake; composer
  never publisher; the /about-vs-/faq migration collision **flagged, not resolved**.
- **§2 the subject register** — exactly the four ordered subjects (bzDiD, the .b registry,
  the adapter register, bNRoSe), each with its scope-clearance reason printed. Nutrition
  surfaces are not selectable: the cheapest rejection refused here rather than there.
- **§3 the sentence editor** — 14 seeded sentences, every one composed from the project's
  own ratified records (which IQ.wiki's citation policy explicitly permits — official docs
  qualify) with linked GitHub citations; contributor sentences accepted **only** with a
  label and an openable URL — an uncited sentence is refused with the reason shown, the
  receipt rule expressed as an editor. bNRoSe's sentences say *specified but undeployed*,
  because a proposal that overstates deployment dies on verification.
- **§4 the tone check** — six rule families (first person, second person,
  superlatives/promotional adjectives, promotional verbs, unfalsifiable phrasing,
  exclamation marks). Flagged sentences are shown with the rule that fired; nothing is
  silently rewritten; a flagged sentence enters the draft **only** by an explicit
  keep-anyway tick — the human gate, visible at the seam it belongs.
- **§5 the draft** — chat-window-sized block, numbered citations, copy button only. The
  handoff panel states in plain words that a human carries it to the Sophia chat, that the
  page never posts and never holds a key, and that the wallet question (§4 of the order)
  rides open with the operator.

## 3 · Verification — this seat's own adversarial pass, then the full walk

The attack Seat 3 promised: a promotional sentence with a citation attached.
`"We are the best and most revolutionary project in crypto!"` →

- **blocked the draft** with *"unacknowledged flag"* (first person + superlative +
  promotional-adjective families all fired) until keep-anyway was explicitly ticked —
  then and only then emitted.

The pass **caught a real defect before landing**: the per-sentence flag and keep-anyway
controls originally rendered inside CSS-hidden containers (`display:none` by class), so
the gate logic enforced correctly while its controls were invisible — the exact
silent-friction failure the order forbids. Fixed in place (controls render visible;
`44 passed, 0 failed` re-run below). The correction is logged here per the museum law.

Full committed walk (`cd e2e && node university-smoke.mjs` — now covers the university,
its quests, bIQ, the rebuilt bFood, hub and review deck): **44 passed, 0 failed**, zero
page/console errors, including: four subjects render; seeded sentences cited and
preselected; clean draft composes with numbered citations; **uncited sentence refused**;
**promotional sentence blocked → acknowledged → emitted**; page states it never posts;
hub counts 33; review roster 29.

## 4 · Open for Seat 3 / the founder

- **Seat 3's adversarial pass** — invited as ordered; the tone-rule families and their
  word lists are in the page source, cheap to extend.
- **The wallet question (order §4)** — still open, still founder/thirty-seconds; the
  surface prints the handoff both ways until it closes.
- **Non-features, stated:** no auto-submission, no wallet connection, no key handling, no
  scraping — as scoped. The corpus father-tongue layer is not wired on this surface
  (status text always rides beside its colour); it docks when the D-13/lane unification
  reaches the instrument class.

## 5 · ADDENDUM (same day) — the adversarial verdict came back, and it beat this seat's own gate

Seat 3 honored the adversarial commitment in §4. **The architecture held: zero network
calls of any kind** (no fetch, XHR, beacon, or form — the page cannot post by
construction). **The tone gate did not hold:** four of six subtler promotional sentences
passed and were labelled "✓ tone-clean" — *"widely regarded as the most secure…"*,
*"unparalleled scalability… the obvious choice"*, *"elegant… trusted by a growing
community of believers"*, *"robust, enterprise-grade assurance."* None contain a
blocklist word.

**What this seat owns in place:** (a) the defect is the one the receipts law exists to
catch — **a fixed keyword list only catches the words its author thought of**, and the
author was me; (b) the affirmative "tone-clean" label was worse than a miss — a false
assurance the human gate then trusts, and the human *is* the gate in this design;
(c) this seat's own §3 adversarial pass ("We are the best and most revolutionary…")
was too loud to be a test — an obvious attack proves nothing about subtle ones.

**Seat 3's fix, verified on disk and re-run by this seat:** three structural rules that
catch the register rather than the vocabulary (attribution with no attributee ·
comparative with no "than" · vague quantifiers standing in for numbers), the false
assurance removed — *"no pattern matched — a scan, not a verdict"* — the summary line
stating that sentences have beaten this gate so the next operator inherits the finding
rather than the confidence, and idiom exclusions after "a lower bound" false-positived.
Their receipts: **6/6 attacks caught, 0/12 legitimate encyclopedic sentences flagged.**
This seat's re-run after the fix: **48/48 smoke green**, seeded paths intact.

**And the bfood note Seat 3 routed here, recorded so nothing grades against absent
cells:** the dirty `bfood.html` this seat correctly left untouched (2026-08-20 morning)
was the **protein-quality and fibre work — not amino-acid wiring**; it landed at
`79db636`, and the EAA family is **deliberately absent until the numbers are citable**.
Surfaces that reference bFood's families (this seat's bSymposium included) must not
grade against an EAA row that does not exist. Separately, another seat's audit
(`47af02f`) found **five dead citation links on this seat's bSymposium** and fixed them
with the failure confessed on the page's face — same law, second application, both
welcome.

**zAgent (GLM 5.3), 2026-08-20.** 🐝
