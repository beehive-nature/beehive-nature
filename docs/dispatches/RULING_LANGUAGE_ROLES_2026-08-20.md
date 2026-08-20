# RULING — the three language roles: father, mother, student (founder, 2026-08-20)

**From:** zAgent (GLM 5.3), recording founder doctrine verbatim and building the first
implementation. **Routing note:** the corpus lane is zCode-R's (BlanguageDOCK,
bTranslated); the schema extension below extends that lane's storage key — flagged to
the lane owner in §4, backward compatible by construction.

Founder (King Bee), verbatim: *"we need to be able to pick at least a mother language,
father language and a student language. My Father is EngLish and my chosen mother
language is my adopted culture and language (still young).  Russian and Thai I am
actively studying."*

---

## 1 · THE DOCTRINE — three roles, and one assumption retired

The preference model grows from a **top-2 pair** to **at least three roles**:

| role | meaning | constraints |
|---|---|---|
| **father language** | the hardcoded pivot-set member a surface renders through (§7, DISPATCH_BTRANSLATED_B_NAMES) | the father set (founding + founder-hardwired members) |
| **mother language** | **chosen** — one's own culture's language, **which may be adopted and young**. The native-only assumption ("mother tongue = the language you grew up speaking") is **retired by this ruling**: a mother language is a relationship, not a birthright | gateless — any language, via the corpus, exactly as BRIEF-04 rules |
| **student languages** | languages in active study — an exposure relationship, plural ("at least" three roles; students already plural) | gateless; render with machine-draft badging — the learner *wants* the exposure |

**The first specimen is the founder's own triple:** father — **English**; mother — his
adopted culture's language, his word and his choice (the UI holds it; the tree's
genesis-reference connection to Latvian exists but the choice is not assumed here);
students — **Russian and Thai** (both already father-set/hardwired members: ru
founder-hardwired, th rung two — the preference now *uses* two anchors the register
already carries).

## 2 · THE DESIGN LAWS

1. **Local-first, persona-bound, never the root** — the T-6 lineage, unchanged; the
   triple is presentation-layer.
2. **Backward compatible schema:** the shared key `btranslated_pref` grows a `students`
   array beside `father`/`mother`; every existing two-field value parses as-is.
3. **Honest absence at the preference layer:** if a chosen role language has no docked
   rendering in the corpus for a given label, the surface renders the absence by name
   ("no rendering docked for X yet — the corpus is gateless") rather than silently
   falling back to father-only. A chosen language the tree cannot yet serve is an
   **invitation to dock**, not an error.
4. **Machine drafts badged, always** — especially for student languages, where the
   draft is pedagogically the point; attestation upgrades it per the corpus's law.
5. **The student role's home is the teaching surfaces** — on the university, labels
   render in all three roles with role badges; a student language turns every label on
   every page into one repetition in the language being studied. The corpus becomes
   visible exactly where learning happens — the unification law, extended one role.

## 3 · WHAT LANDED WITH THIS RULING

- `surfaces/university/index.html` — the full tri-role picker (father select · mother
  free input, chosen not native · students multi-entry) and role-badged corpus chips
  with honest absence, in the registers section.
- `surfaces/btranslated.html` — schema-compat: the §1 preference block gains the
  students field so the shared key carries the triple; its §5 unification demo remains
  father-driven pending the corpus lane's own tri-role pass (§4).
- The smoke (`e2e/university-smoke.mjs`) asserts all three roles, including the
  honest-absence chip for a language with no rendering.

## 4 · FOR THE CORPUS LANE (zCode-R)

The storage contract is now `{father, mother, students[]}` on `btranslated_pref`. No
breakage exists (absent fields read as unset), and the corpus's own surfaces may adopt
tri-role rendering at the lane's pace. The mother-role doctrine change (chosen, possibly
adopted, possibly young) may touch BRIEF-04's wording — the lane owner rules whether a
one-line amendment rides there; this dispatch is the doctrine's record either way.

**zAgent (GLM 5.3), 2026-08-20.** 🐝
