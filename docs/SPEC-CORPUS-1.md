# SPEC-CORPUS-1 — Language corpus, and the multilingual naming decision beneath it

**Status: DRAFT, unratified, drafted by Seat 3 2026-08-15 from founder direction.**

**This document rules nothing.** It collects what is true in the tree, what is true about
the two languages named, and where the two disagree. Section 3 contains a *recommendation*
that collides with ratified text at `docs/bzdid-architecture-decision.md:65` and `:100`; per
CLAUDE.md §1 that collision is **escalated by name, not resolved here**. Section 6 lists
what needs the founder's own word.

Two prior workflows fed this. Where they disagreed, the disagreement is shown rather than
smoothed. Where a claim could not be verified, it is marked **UNVERIFIED** and work stops
there (standing law 5, cite or stop).

---

## 1 · THE DIRECTION

Founder, 2026-08-15, verbatim, his spelling preserved:

> "I have a deep passion and fascination with ancient languages and learning through love is
> my favorite. she speaks all of those symbol languages and english.... my favorite language
> that I want to serve equally with a corpus is Latvijan."

Separately, the founder has named the intent as **"a massive voluntary tribal language
corpus."**

The language is **Latvian** — *latviešu valoda* — one of two surviving Baltic languages.

**The project is already named in it.** `SKAISTS` is Latvian for *beautiful*. This is
ruled, not incidental: `docs/feature-backlog.md:413` — "Genesis LOVErnment: name RULED —
skaists (\"beautiful\", Latvian); governance". `skaists.social` is the governance home per
CD-17. The DAO carries a Latvian word in its name and the tree contains **zero Latvian
characters** (§2.5). That gap is the subject of this document.

The second language — "the symbol languages" — is Han script, which the founder is married
into. It is treated here as a first-class constraint, not a comparison case, and §3 will
show that it and Latvian pull on **different** parts of the same decision.

---

## 2 · WHAT ALREADY EXISTS

Two crates carry suggestive names. Both were read in full. **Neither is a foundation for
this work, and they fail in opposite directions.**

### 2.1 `crates/vocabulary` — not about language at all

315 lines, empty `[dependencies]`. It is a naming-policy lint that bans **one English
word**: `pub const NEEDLE: &str = "farming"` (`crates/vocabulary/src/lib.rs:32`), with a
qualifier carve-out for `yield`/`crop` (`:39`), an inline `vocab-allow` marker (`:36`), and
a repo selftest whose allowlist doubles as a self-validating migration worklist
(`:205-237`).

It has no concept of language, script, orthography, codepoint, locale, or normalization.
**Verdict: irrelevant.** A downstream reader who reaches for "the vocabulary crate" as the
home for a controlled term list, a lexicon, or a corpus schema will find a single-word
string search and nothing to build on. The name is correct for what it is and misleading
for what a language project would hope.

Worth keeping from it: the *pattern*. A checkable rule, a positive control proving the
lint bites (`:112` — "a lint never seen to fail is not a lint"), and an allowlist that
fails the build when it goes stale. That is the right shape for a charset rule too.

### 2.2 `crates/language-authority` — about natural language, and it forbids the corpus

This one **is** unambiguously about human natural languages, not protocol vocabulary. The
evidence is structural: `LanguageId` is documented as "BCP-47 or a nation's own identifier.
BNR does not adjudicate which" (`crates/language-authority/src/lib.rs:45`); `Modality` is
`Text | Audio | Braille | Sign { variety } | Simplified` (`:117-124`);
`TranslationAttestation` is `Machine { engine } | SpeakerProvided { speaker } |
CommunityAttested { body }`; `NotTranslatedReason` is `NoAuthority | NotInCorpus |
AuthorityWithdrawn`. It is the enforcement of ratified order **C-4**, language sovereignty
(`:3`).

**And its thesis is line 1: "`language-authority` — BNR holds an interface, never a
corpus."**

That is not a slogan. It is enforced three ways:

1. **No enumeration exists.** `:19-21` — "There is no `keys()`, no `all()`, no `export()`,
   no iterator. A caller cannot obtain the body of a language through this trait because
   there is no call to make." The trait is two methods, `language()` and `render()`
   (`:110-113`).
2. **No cache.** `revoke()` drops the authority rather than flagging it (`:207-212`) —
   "**Immediate and complete** — the authority is dropped, not flagged, so there is nothing
   left to read even by mistake."
3. **A negative control that is demonstrated to bite.** `probe_retention` (`:249-293`) is
   proven in-crate to FAIL on a deliberately retaining implementation (`:400-415`, "THE TEST
   THAT MAKES THE HARNESS REAL. If this passes, the harness is a decoration"). The defect
   it names is the well-meaning one (`:365-368`): caching renderings "for performance"
   quietly makes BNR a holder of the corpus, and revocation stops meaning anything.

**Honest verdict.** `language-authority` is the correct *boundary* and the wrong *home*. It
is where a corpus is **called from**; there is no code path in it for BNR to **hold** one,
and adding one breaches C-4 by construction. It is also read-only — there is no
`contribute`, no submission type, no review queue — and a *voluntary* corpus is by
definition contribution-driven.

### 2.3 The contradiction is already shipped, in public, in prose

`surfaces/onboarding/index.html:218`, user-facing string, live:

> "BNR is building a voluntary language corpus — including tribal and uncommon languages
> the big platforms skip — so this page can one day greet everyone in their own words. Ask
> us how to contribute yours."

with the code comment above it (`:215-216`): "the tribal-corpus breadcrumb: every language
belongs, incl. ones no corporation would ever localize. Voluntary corpus, AI-guided."

So: a shipped surface promises users that **BNR is building a corpus**, and the crate that
governs language is architected so BNR can **never hold one**, with a test that fails any
implementation which caches a rendering.

Both can be true only under one reading: **the corpus is held by each contributing
community's own `LanguageAuthority`, on infrastructure it controls, and BNR holds nothing
but the call.** `lib.rs:9-11` already gestures at exactly this — "A nation runs its own
[`LanguageAuthority`], on infrastructure it controls, or it does not participate — **both
are first-class outcomes.**"

**Nobody has written that reconciliation down, and for a *tribal* corpus it is
load-bearing:** a tribe with no infrastructure has, under the current law, no third option.
"Or it does not participate" is a defensible answer for a nation. It is not obviously the
answer the founder means for the communities he named. This is founder ruling **F-1** and
**F-2** (§6).

### 2.4 `bTONGUES` exists as a named initiative, licence-blocked

`docs/ROUTING.md:118-124`, under "Contact-in-future", is the closest thing in the tree to a
language plan and it names a product. **PanLex** (The Long Now Foundation, 501(c)(3)) —
status **BLOCKED, do not build against it yet (2026-07-21)**: "No integration, adapter, or
derived lexicon layer is authored until the written-permission letter lands. The licence,
not our restraint, is the gate." The database is **CC BY-NC-SA 4.0**, verified by direct
fetch against a web search that wrongly reported CC0; NonCommercial collides with the
for-profit arm and ShareAlike is viral.

Two things there matter beyond the block. PanLex independently built the same provenance
ladder BNR uses — `distance-1` = attested by a source, `distance-n` = inferred, n = shortest
chain — which maps directly onto `TranslationAttestation`'s three tiers. And **Latvian
Romani (`rml-001`) is confirmed present in their inventory** (`ROUTING.md:124`) — note that
Latvian Romani is a Romani variety spoken *in* Latvia, a different language from Latvian.

`bTONGUES` appears **exactly once in the entire tree** (`ROUTING.md:122`). No crate, no
spec, no backlog entry, no docket.

### 2.5 Verified absences — the finding is that there is nothing

Re-verified by this seat, this session, in `C:\Users\travi\beehive-nature`:

| checked | result |
|---|---|
| `unicode-normalization`, `unicode-segmentation`, `icu`/`icu4x`, `idna`, `stringprep`, `caseless`, `precis` in any `Cargo.toml` | **zero** across all **38** workspace members (`Cargo.toml:6-43`) |
| `NFC` / `NFD` / `NFKC` / `NFKD` / `skeleton(` in any `.rs` | **zero** tree-wide |
| Latvian characters (U+0100–U+017E as Latvian text) anywhere in the tree | **zero**. The only chars in that range are incidental — `š` in the Czech surname "Matyáš", `ū` in the Japanese romanization "Monogatarishū" |
| Han characters in any `.rs` | **zero**. Han appears only in `docs/SPEC-ORIGINATION-1.md` (classical citations) and one char in the onboarding surface |
| non-ASCII test fixture in either crate | **zero**. `language-authority`'s fixtures are ASCII sentinels (`TSINDAGIKWA-UNIQUE-STRING`, `LanguageId("xyz")`, `"ASL"`) |
| `i18n` / `l10n` anywhere | **zero** |
| `latvijan` / `latviesu` / `latviešu` | **zero** |
| the word "Latvian" | **two** hits, both prose glosses: `feature-backlog.md:413`, `ROUTING.md:124` |

**The multilingual claim has never been exercised against a multibyte character anywhere in
the codebase.** Every language test in the tree passes on pure ASCII.

**One naming collision to record now:** `crates/normalizer` is **not** a Unicode normalizer
— it is chain-event normalization (`RawChainAction` → `CanonicalEvent`). The name is taken.
A future Unicode normalizer cannot use it. This is precisely the class of collision
`crates/vocabulary` exists to catch, and `vocabulary` cannot catch it because it checks one
hardcoded needle.

---

## 3 · THE NORMALIZATION DECISION — **Latvian drives it**

### 3.1 The lead finding

**Han is essentially undecomposable; Latvian is entirely decomposable. The Latin-script
language with diacritics is what forces the choice.**

Verified by computation this session (`String.Normalize` over all four forms):

- 北 U+5317, 境 U+5883, 之 U+4E4B, 王 U+738B, 方 U+65B9 — **unchanged under NFC, NFD, NFKC
  and NFKD.** 國 U+570B and 国 U+56FD are likewise each invariant under all four, and **no
  normalization form relates them to one another.** So 北境之王 and 北方王 are
  normalization-stable in both scripts — trivially so, because they contain nothing that
  decomposes.
- Every accented Latvian letter has a distinct precomposed form **and** a canonical
  decomposition. `ā` is U+0101, or `a` U+0061 + U+0304. Both render identically. Both hash
  differently. **Twelve letters, twenty-four with capitals, no exceptions.**

Therefore: pick NFD, or fail to normalize at all, and **Latvian names silently fragment
into variants that look identical and are not equal**, while Han is untouched either way.

### 3.2 The precision the lead hides — there are TWO decisions, one owned by each language

This is where the two research passes disagreed, and the disagreement is the useful part.
Both are right about different halves:

| decision | driven by | why |
|---|---|---|
| **NFC vs NFD** | **Latvian, entirely** | Han is invariant under both. Every Latvian diacritic is affected. |
| **NFC vs NFKC** | **Han, entirely** | Verified: for all 24 Latvian letters, `NFKC(x) == NFC(x)` byte-for-byte — **no Latvian character has a compatibility decomposition.** What NFKC folds that NFC does not is the Han-adjacent set: Kangxi Radicals (U+2F00 KANGXI RADICAL ONE is **unchanged by NFC**, folds to 一 U+4E00 only under NFKC), fullwidth forms (U+FF21 → U+0041), halfwidth katakana (U+FF71 → U+30A2). |

A correction to the framing that reached this seat: it is **not** true that "the NFC/NFKC
decision is effectively made by the Latin-script languages." The opposite. Latvian is
indifferent to NFKC; Han is not.

A second correction, which weakens the case for NFKC substantially: **CJK Compatibility
Ideographs are folded by plain NFC, not only by NFKC** — U+F900 → U+8C48 under NFC, because
their canonical decompositions are singletons and singletons are composition exclusions.
Twelve codepoints in that block are exceptions with no decomposition mapping at all —
U+FA0E, FA0F, FA11, FA13, FA14, FA1F, FA21, FA23, FA24, FA27, FA28, FA29 — which are in fact
unified ideographs despite their block. So the compatibility-ideograph homograph vector is
**already closed by NFC**. NFKC buys nothing there.

### 3.3 The Latvian inventory, exactly

The alphabet is **33 letters** and excludes **Q, W, X, Y**. Three diacritic classes:

**Garumzīme (macron), long vowels** — ā U+0101 / NFD `a`+U+0304 · ē U+0113 / `e`+U+0304 ·
ī U+012B / `i`+U+0304 · ū U+016B / `u`+U+0304. Capitals Ā U+0100, Ē U+0112, Ī U+012A,
Ū U+016A.

**Hāčeks (caron)** — č U+010D / `c`+U+030C · š U+0161 / `s`+U+030C · ž U+017E / `z`+U+030C.
Capitals Č U+010C, Š U+0160, Ž U+017D.

**Mīkstinājuma zīme (softening mark)** — ģ U+0123 / `g`+U+0327 · ķ U+0137 / `k`+U+0327 ·
ļ U+013C / `l`+U+0327 · ņ U+0146 / `n`+U+0327. Capitals Ģ U+0122, Ķ U+0136, Ļ U+013B,
Ņ U+0145. Historical ŗ U+0157 / `r`+U+0327, Ŗ U+0156 — see §5.4.

This is the exact set a `.b` charset rule and a corpus tokenizer must admit.

### 3.4 The comma-below versus cedilla trap — ģ ķ ļ ņ ŗ

**State this explicitly in every spec, error message, and docs page, because getting it
wrong reads as an error to a Latvian speaker and sends an implementer to the wrong
codepoint.**

Unicode names these characters "LATIN SMALL LETTER G/K/L/N/R **WITH CEDILLA**" and
canonically decomposes them to base + **U+0327 COMBINING CEDILLA**. But correct Latvian
typography requires a **comma below**, not a cedilla. Unicode's own documentation
acknowledges the mismatch — the diacritics "are considered cedillas, although their Adobe
glyph names are commas" — and they were encoded before 1992, so under the character-name
stability policy **their names cannot ever be altered**. Unicode Chapter 7 states plainly
that for Latvian "it is unacceptable to display commas below as cedillas."

Three consequences:

1. **Encoding and rendering disagree permanently, by design.** There is no fix. Write
   "comma below (encoded as U+0327 COMBINING CEDILLA)" — never "cedilla" alone, never
   "comma below" alone.
2. **U+0326 COMBINING COMMA BELOW is the wrong codepoint for Latvian** despite being the
   typographically honest one. An implementer who normalizes toward U+0326 is generating
   strings no Latvian keyboard produces.
3. **Do not learn this problem from Romanian.** Romanian received *dedicated* comma-below
   characters — ș U+0219 and ț U+021B, distinct from the cedilla forms ş U+015F and
   ţ U+0163. **Latvian never did.** An implementer who builds a Romanian-style ș/ş
   equivalence table for Latvian creates phantom collisions against characters that do not
   exist.

Also note: **ģ** is displayed with a rotated comma **above** the g, not below, because a
cedilla cannot attach under the descender loop. A rendering test that asserts "mark below"
will fail correctly-rendered Latvian.

### 3.5 The one confusables entry that touches Latvian lands in Latvian's favour

`confusables.txt` contains `0327 ; 0326 ; MA` — COMBINING CEDILLA maps to COMBINING COMMA
BELOW. Since `skeleton()` applies NFD first, `ģ` as `g`+U+0327 and a typographically
motivated `g`+U+0326 produce the same skeleton. **No Latvian precomposed letter appears in
`confusables.txt` at all**, and UTS #39's skeleton does not strip diacritics.

That is exactly the behaviour Latvian needs: the two encodings of the softening mark unify,
and Latvian minimal pairs stay distinct — *kazas* (goats) vs *kāzas* (wedding), *sals*
(frost) vs *sāls* (salt), *pile* (drop) vs *pīle* (duck) are **not** collapsed.

### 3.6 RECOMMENDATION — key = NFC; validity = **reject**, do not fold

> `n = NFC(input)`, and it is a **validity rule** that the input must already satisfy
> `NFC(x) == x` **and** `NFKC(x) == x`. Anything else is **rejected at registration**, not
> silently rewritten.

Reasoning:

- **It gets NFKC's entire security benefit at zero data loss.** No fullwidth form, no Kangxi
  radical, no ligature, no Roman-numeral character ever enters the namespace — and because
  Latvian is provably NFKC-invariant (§3.2), applying an NFKC *test* costs Latvian nothing.
- **Folding is what makes display diverge invisibly from the key.** The leaf format at
  `docs/bzdid-architecture-decision.md:74-75` already carries a separate `display` field, so
  the architecture supports the split. The rule should be: display must also be NFC and must
  normalize to the same key.
- **It is ENSIP-15's actual posture.** ENS applies NFC and then *validates and rejects*;
  **NFKC appears nowhere in ENSIP-15**. ENS uses NFD only internally, to check combining-mark
  restrictions, and handles confusables as a separate explicit step rather than folding them
  into normalization. ENS reached this after real homograph incidents, replacing an earlier
  UTS-46 approach.
- **NFD carries a measured byte penalty against a byte-counted cap.** UTF-8, NFC vs NFD:
  `skaistākā` 11 → 13 · `ģimeņu` 8 → 10 · `lāčplēsis` 12 → 15 · `mīļā-latvija` 15 → 18.
  20–27%. Han is unaffected (北境之王 is 12 bytes either way). And every mainstream keyboard
  and IME on Windows, Linux, macOS and Android emits **NFC** — choosing NFD means normalizing
  away from what every user actually types.

**This collides with ratified text and is therefore escalated, not decided.**
`docs/bzdid-architecture-decision.md:65` reads `n = skeleton(NFKC(lowercase(input)))` — "UTS-46
plus Unicode confusable skeleton" — repeated verbatim in the wallet resolution algorithm at
`:100`. That line is **NFKC**, and it is **not** what ENS chose. It also conflates two
different things: **UTS #46 §4 Processing Step 2 applies NFC**, not NFKC. (NFKC_Casefold is
used to *derive* the UTS-46 mapping table; the runtime step is NFC.) So the tree currently
cites UTS-46 for a folding one level more aggressive than UTS-46 performs. See §6, **F-3**.

### 3.7 Two defects in existing artifacts that must clear before UNICODE-NAMING-1 is written

**(a) The worked example at `bzdid-architecture-decision.md:310` appears to be false.** The
doc states: "The tree key is the **confusable skeleton**, so `paypaĺ` and `paypal` are the
same claim and the second one gets a non-membership failure, not a lookalike name." A
research pass verified against Unicode's `confusables.txt` that **U+013A (ĺ) is absent from
the file**, as are U+0101, U+013C, U+0123, U+0161, U+016B, and that UTS #39's skeleton does
not strip diacritics — the spec's own counterexample being that `skeleton("paypal")` is not
equal to `skeleton("pàỳpąl")`.

This matters because `:310` is the **single illustration** the design offers for the `:29`
commitment that without confusable-skeleton normalization "globally unique is a marketing
claim rather than a property." The commitment may still be right; the illustration appears
not to do what the doc says it does. **Per standing law 10 (false-signal), a claim that does
not hold is deleted, not patched.** Owed: an independent re-verification with a pasted
receipt before anything is edited, and before UNICODE-NAMING-1 is written on top of it. Do
not repeat the `paypaĺ` example as a code fact in the meantime.

**(b) UTS #39 forbids using `skeleton()` the way the architecture uses it.** TR #39 states
that a skeleton "is intended only for internal use for testing confusability of strings; the
resulting text is not suitable for display to users," and that skeletons "are not stable
across versions of Unicode, so that they can only be interchanged between systems that use
the same version of Unicode." The architecture uses `skeleton()` as the **permanent Merkle
tree key** (`:65`, `:100`).

Version instability is disqualifying for a depth-40 tree with permanent Arweave records: a
Unicode revision can change what an existing name hashes to, silently invalidating proofs.
The `b:v1:` prefix at `:65` versions the *scheme* but **no Unicode version is pinned
anywhere in the tree**. If skeleton is retained at all, the Unicode version must be a hard,
stated spec parameter. See **F-7**.

### 3.8 What the live contract actually accepts today — none of this

Verified in source at `C:\Users\travi\b-domain\contract\bdomain.cpp`:

- `is_valid_name` (`:28-39`) admits **only** `a-z`, `0-9`, and interior `-`, with a
  `s.size() > 32` cap measured in **bytes** (`:29`), and rejects `--`. **Every Latvian and
  every Han character is rejected today.** Latvian `.b` names are not merely unnormalized —
  they are impossible. So this is a decision about a *future* charset opening, not a repair
  of a live one.
- **Correction to a claim that reached this seat.** It was reported that `to_lower()` at
  `:43-44` "iterates bytes applying `tolower()`; on bytes >= 0x80 that is undefined
  behaviour." **The source does not call `tolower()`.** `:41-49` uses an explicit range test
  — `(c >= 'A' && c <= 'Z') ? c + 32 : c`. There is no UB, and it cannot mangle UTF-8:
  continuation bytes are 0x80–0xBF and lead bytes 0xC2–0xF4, none of which fall in 0x41–0x5A.
  **The real defect is that it performs no Unicode case folding at all** — so the moment the
  charset opens, `Ā` (U+0100) is not folded to `ā` (U+0101) and `ĀBOLS.b` and `ābols.b`
  become two distinct names. ENSIP-15 sidesteps this entirely by **disallowing uppercase
  rather than folding it**, which is the cheaper and safer answer.
- **Adjacent, and it widens if the charset opens:** `hash_name` (`:19-26`) is 64-bit FNV-1a,
  and `registeracc` (`:63-79`) aborts the transaction with `check(false, "fatal: hash
  collision with existing domain")` on collision. FNV-1a is not collision-resistant — a
  colliding preimage can be *constructed*, not merely encountered — and a constructed
  collision **permanently blocks the target name**, since the honest registrant's transaction
  can never succeed. Today's failure mode is safe against **mis-resolution**; it is not safe
  against **denial**. Opening to UTF-8 grants far more byte freedom to construct one. The new
  design moves to sha256 (`bzdid:65`) and fixes this — but `kingbeelovis` is declared frozen,
  "code unchanged" (`bzdid:292`), so the FNV contract stays live. **Serving Latvian on the
  current contract would widen a live vulnerability.** This is an argument for the new
  contract, not against Latvian.

### 3.9 Registry pipeline ≠ corpus pipeline. Write the rule before either is implemented.

The tree has exactly one normalization decision written down and it is a **registry**
decision, whose entire purpose is to make distinct-looking strings **collide**. That is
correct for names.

**Applied to corpus content it is data loss.** Confusable-skeleton folding deliberately
destroys distinctions between visually similar characters, and in a language corpus those
distinctions **are the language** — the ā/a, š/s, ž/z contrasts carry meaning (§3.5's
minimal pairs). Case folding destroys proper nouns. NFKC destroys typographic intent.

`crates/language-authority` currently has no normalization at all, so it has not made this
mistake — but nothing prevents someone reusing the registry pipeline when normalization is
finally added, because **no document in the tree states the two must differ.** It should:

> **Registry keys** get lossy folding (NFC + case rule + whatever confusable policy is
> ruled), because collision is the goal.
> **Corpus content** gets **NFC and nothing else** — no case folding, no skeleton, no NFKC —
> because preservation is the goal.

### 3.10 The one blocking unknown — **UNVERIFIED**

ENSIP-15 states that Latin, Greek, Cyrillic, Han, Japanese, Korean and Bopomofo "only permit
specific Combining Mark sequences," with non-whitelisted groups restricted to unique
non-spacing marks, max 4. Latvian falls inside the **Latin** group. **Whether that whitelist
admits U+0304, U+030C and U+0327 over the specific Latvian bases could not be determined
from the spec page** — it requires reading the `@adraffy/ens-normalize` data tables.

This is the operational meaning of "serve Latvian equally with Han." **Han is a named
first-class group in ENSIP-15. Latvian is a member of a group.** If the Latin CM whitelist
does not admit the Latvian sequences, then adopting ENSIP-15 wholesale makes Latvian
second-class in the founder's own registry, and `.b` must **extend** it — a real design task,
not a copy. **This check is owed before UNICODE-NAMING-1.md is written** (O-2, §6).

### 3.11 The Han question is NOT a normalization question

國 U+570B and 国 U+56FD are connected only by the **informal, non-normative** Unihan
properties `kTraditionalVariant` / `kSimplifiedVariant` (UAX #38), which UAX #38 itself
describes as based on actual practice rather than authority, notes that authorities disagree
on specific correspondences, and says conversion ideally happens at the **word** level, not
character-by-character.

Therefore: **whether 國王 and 国王 are one name or two is a registry POLICY decision, not a
normalization decision.** It belongs with *aliasing*, not with *normalization*. Folding the
two questions into one "pick a normalization form" ruling produces a spec that silently does
nothing for Han.

Note also that the tree has **already answered it by omission**: the onboarding language
selector (`surfaces/onboarding/index.html:170-174`) offers **简体 — Simplified only** — with
no 繁體 option. That is a position, and it is currently held by a dropdown rather than a
ruling. See **F-4**.

---

## 4 · WHAT "SERVE EQUALLY" MEANS CONCRETELY

Not a sentiment. Ten requirements, each with its price. Nothing below is currently met for
any language other than English.

**E-1 · Character admission.** Every letter of the language is registrable and storable.
*Cost:* a per-script admission table that someone maintains, a pinned Unicode version, and a
CI test per script. For Latvian, the 33-letter set plus a ruling on ŗ and ō (§5.4). For Han,
a decision on which of ~90,000 ideographs are admissible at all — ENS restricts by script
group precisely because "all of Unicode" is not a policy.

**E-2 · One identity per name.** `NFC(x) == x` enforced at the boundary, so a name has
exactly one byte form. *Cost:* rejecting input that users' tools may produce, which means a
real error message explaining *why* — in their language (E-9).

**E-3 · Case.** Either full Unicode case folding, or uppercase disallowed. **Do not choose
"ASCII-only folding," which is the current behaviour and is the actual bug** (§3.8).
*Cost:* Latvian case folding is a 12-pair table, not an algorithm; Han has no case at all,
so a case rule written for Latin must be a no-op for Han rather than an error.

**E-4 · Sort order.** *lv-LV* collation is **not** codepoint order: in Latvian, `č` sorts
immediately after `c`, `š` after `s`, `ž` after `z` — not at the end of the alphabet where
their codepoints put them. Any name list, any corpus index, any leaderboard sorted by
`Ord` on a `String` is sorted **wrong** for Latvian. *Cost:* a real collation dependency
(ICU-class) or a hand-written per-language collation table. `LanguageId` and `MessageKey`
currently derive `Ord` on a raw `String` (`language-authority/src/lib.rs:46-51`) — that is
codepoint order, and it is the wrong order for the founder's language.

**E-5 · Search and matching.** A search for `abols` should find `ābols` if the user typed it
without diacritics, without `ābols` and `abols` becoming the same *name*. **Search folding
and identity folding are different operations and must not share code** (§3.9). *Cost:* two
pipelines, deliberately, with a test asserting they differ.

**E-6 · Display.** A font that actually carries ģ ķ ļ ņ with the correct comma-below
rendering — many do not, and many render the U+0327 cedilla instead, which §3.4 says is
unacceptable for Latvian. For Han, a font with the right regional glyph forms. *Cost:* font
licensing and per-surface font-stack testing, plus a rendering test that would currently
fail on ģ if written naively.

**E-7 · Registration cost parity — this one has a number.** The `.b` cap is **32 bytes**
(`bdomain.cpp:29`). In NFC UTF-8 that is 32 ASCII letters, **~16 Latvian macron letters**,
and **~10 Han characters**. A byte cap is not a neutral rule: it gives an English speaker
three times the name length it gives the founder's wife. **If names are capped, cap them in
codepoints (or grapheme clusters), not bytes.** *Cost:* a different validity function and an
explicit RAM answer, since chain RAM is billed in bytes and `bzdid:61` is unforgiving about
per-user byte arithmetic. This is a genuine tension between equality and the RAM law — it
needs a ruling, not a preference.

**E-8 · Corpus weighting.** "Equal" cannot mean "equal token count" — Latvian has ~1.5M
speakers, Mandarin ~1.1 billion, and a tribal language may have 200. If the corpus is ever
used to *train* anything, equal representation and proportional representation are opposite
policies and one must be chosen out loud. *Cost:* whichever is chosen, the other constituency
is disappointed, and the choice must be stated before collection, not after.

**E-9 · Errors, docs, and refusals in-language.** A rejection message in English is a
second-class experience regardless of how correct the charset rule is. `language-authority`'s
`NotTranslatedReason` (`:80-88`) already models honest refusal — `NoAuthority`, `NotInCorpus`,
`AuthorityWithdrawn` — which is the right shape. *Cost:* the message catalogue that does not
exist (§4 note below).

**E-10 · Input.** Whatever the user's keyboard and IME emit must be accepted. They emit NFC.
This is the strongest practical argument in §3.6 and it costs nothing — **as long as NFC is
what is chosen.**

**What equality cannot buy.** Two honest limits. First, "equal" cannot mean "identical
mechanism": Latvian needs a normalization form, Han needs a variant table, and pretending one
lever serves both produces a spec that serves neither (§3.2, §3.11). Second, **a corpus you
cannot read you cannot moderate.** Every language admitted needs at least one human who
speaks it and is willing to review contributions, or the corpus accumulates content nobody in
the project can vouch for. That is a staffing commitment, not an engineering one, and it is
the single hardest cost in this section.

**And note what the surface promises versus what it does.** The entire i18n implementation is
`setLang(v)` at `surfaces/onboarding/index.html:213-222`. It does exactly two things: shows
the corpus breadcrumb for `new`, and sets `dir` to `rtl` for Arabic. There is **no string
table, no message catalogue, no fallback chain** — selecting ES does not translate the page.
The eight-language selector is currently a promise, not a mechanism, and **Latvian is not
among the eight**.

---

## 5 · INTEROPERATE, DO NOT DUPLICATE

### 5.1 A national Latvian corpus already exists, and it is substantial

**Latvian National Corpora Collection**, korpuss.lv, maintained by **AiLab** (Artificial
Intelligence Laboratory), Institute of Mathematics and Computer Science, **University of
Latvia** (IMCS UL / LU MII).

- **LVK2018**, Balanced Corpus of Modern Latvian: **12,289,240 tokens**, 9,813,014 words,
  20,864 documents, texts 1991–2018. Genres: journalism 60%, fiction 20%, scientific 10%,
  legal 8%, transcriptions 2%.
- **LVK2022**: **over 100 million words**. Journalism 60%, fiction 10%, scientific 10%,
  Wikipedia 7%, legal 7%, parliamentary transcripts 3%, subtitles 3%.
- Distributed through the **CLARIN-LV** repository (repository.clarin.lv), the Latvian CLARIN
  B-centre.

**Do not rebuild written-standard modern Latvian. It exists at 100M words and a university
lab maintains it.** That is a plausible partner, not a competitor.

### 5.2 The licence is the blocking unknown — **UNVERIFIED**

The founder's question was "if national or academic Latvian corpora exist **under usable
licences**, say so." The honest answer is: **they exist, they are large, and the licence is
not established.** The CLARIN-LV landing pages for LVK2018 and LVK2022 identify AiLab IMCS UL
as publisher and record ERDF funding (project 1.1.1.1/16/A/219), but state **no licence, no
rights holder, and no distribution format**. It is not determinable from the landing page
whether the corpus is downloadable or query-only through the NoSketch Engine instance.

**This single fact decides whether a voluntary community corpus can MERGE with LVK or only
ALIGN with it.** Balanced corpora built from journalism and fiction usually carry restrictive
terms *precisely because the underlying texts are third-party copyrighted* — which would make
merging impossible regardless of anyone's goodwill. **Establish this before designing any
interoperation.** Contacting AiLab IMCS UL directly is the fastest route (O-8, §6).

The comparable case is already on file: PanLex was reported CC0 by web search and is actually
**CC BY-NC-SA 4.0** by direct fetch (`ROUTING.md:120`). Assume nothing about a corpus licence
without fetching the licence.

### 5.3 The structural argument for aligning rather than merging

LVK is a **balanced, edited, written** corpus: journalism, fiction, scientific, legal,
parliamentary, subtitles, curated for representativeness of the modern **written standard**.

A voluntary community corpus is its **structural complement**: spoken, dialectal, Latgalian,
consent-given, un-edited, contemporary. **These barely overlap.** The community corpus
collects exactly what a balanced written corpus institutionally cannot.

So interoperation belongs at the **format and metadata** layer — CLARIN CMDI metadata,
deposit through CLARIN-LV for discoverability, matching tokenisation and tagging so tools
compose — **not** at the content layer. That framing also survives the C-4 problem in §2.3:
aligning formats requires holding nothing.

`language-authority` already has the right primitive for provenance:
`TranslationAttestation::CommunityAttested { body }` is visibly distinct from
`Machine { engine }`, and the crate tests that the two never serialise identically. **What
does not exist is any notion of dialect, orthographic variant, or script** — `LanguageId` is
a bare `String` (`:47`) and `Modality` (`:117-124`) has no `Script` variant.

### 5.4 Latgalian, and the 1946 removal of ō and ŗ

Standard Latvian orthography was changed by the Latvian SSR legislature on **5 June 1946**:
**CH → H, Ō → O, Ŗ → R** (the ch→h change finalised 1957), on the advice of Soviet
specialists. After the reform, `o` represents /uo/, /o/ and /oː/ — three sounds, one letter.

**Latgalian keeps the distinction**, writing the three as O, Ō and Uo. Latgalian has roughly
150,000 speakers in eastern Latvia and is legally a variety of Latvian, though sometimes
classed as a distinct East Baltic language.

Two consequences, one technical and one not:

1. **A `.b` charset limited to the modern 33 letters silently excludes Latgalian** — an odd
   outcome for a project whose stated aim is voluntary preservation of minority and tribal
   languages. Admitting **ŗ U+0157** and **ō U+014D** costs two table entries.
2. **The 1946 removal was a political act.** Restoring those codepoints is therefore a
   substantive gesture and not an encoding detail. That is a founder call, not a Seat 3 one
   (**F-5**).

### 5.5 What is linguistically true about Latvian — stated without romance

The founder speaks this language. Accuracy is the respect, so the flattering version is not
offered.

- **Confirmed: Latvian and Lithuanian are the only two surviving Baltic languages.** Old
  Prussian died out in the early 18th century, known from word lists, place names and
  catechism translations. Galindian, Sudovian/Yotvingian, Curonian, Selonian and Semigallian
  are all extinct.
- **What Latvian innovated — i.e. lost, where Lithuanian kept:** fixed stress on the **first
  syllable**, against Lithuanian's free, distinctive, mobile stress; **complete loss of the
  neuter gender**; **loss of the dual**; and case-system reduction — the Latvian instrumental
  is always identical to the accusative in the singular and the dative in the plural, so
  Latvian is counted at 6 distinct forms against Lithuanian's 7.
- **The nuance that cuts against the cliché.** It is standard to say "Lithuanian is the more
  archaic Baltic language," and in morphology that is true. But **Latvian is more archaic in
  the inherited Proto-Baltic intonations**: the Proto-Baltic circumflex kept its *falling*
  character in Latvian (it became rising in Lithuanian), and the Proto-Baltic acute kept its
  *rising* character in Latvian (falling in Lithuanian). Latvian retains a pitch/tone system
  on long syllables — *stieptā* (level), *lauztā* (broken), *krītošā* (falling) — reduced to
  two in much of the standard language.
- **The honest framing:** Lithuanian preserved the **system** (free accent, 7 cases,
  vestigial neuter); **Latvian preserved the values** — the Proto-Baltic tone contours
  themselves. And Latvian's fixed initial stress is standardly attributed to
  **Finnic/Livonian contact**, which is the more interesting story than either language being
  "older."
- **A corpus consequence:** the three-tone system means a *spoken* Latvian corpus carries
  information that a written one structurally cannot, and much of the tonal distinction is
  already lost in the standard spoken language. That is a real, dated argument for collecting
  audio, and for collecting it from older and dialectal speakers first.

---

## 6 · WHAT IS OWED

### 6.1 Founder rulings — nothing below can be decided by a seat

**F-1 · Does BNR hold a corpus, or not?** Ratified C-4 and `language-authority` say **never**
(`lib.rs:1`, `:19-21`, tested at `:400-415`). The shipped onboarding surface tells users BNR
**is building one** (`index.html:218`). One of the two must change. **The public-facing half
is the urgent half.** If the answer is the reconciliation in §2.3 — communities hold, BNR
calls — that is a ruling that must be written down, because it is currently an inference.

**F-2 · The infrastructure floor.** `lib.rs:9-11` offers a nation two first-class outcomes:
run your own authority, or do not participate. **A tribe with no infrastructure has no third
option.** A voluntary *tribal* corpus needs one, and inventing it is designing — forbidden to
this seat (ORDERS-1:61).

**F-3 · Normalization form for `.b`.** §3.6 recommends **NFC + reject-don't-fold**. The tree
already says `skeleton(NFKC(lowercase(input)))` at `bzdid-architecture-decision.md:65` and
`:100`, cites UTS-46 for it, and **UTS-46 itself applies NFC**. This is a reconciliation with
ratified text, not a greenfield choice.

**F-4 · Traditional versus Simplified: one name or two?** Not a normalization question
(§3.11) — an aliasing policy question, and a political one Unicode explicitly declines to
answer. Currently answered **by omission** in a dropdown (简体 only,
`index.html:170-174`). A dropdown is not a ruling.

**F-5 · Charset admission: is Latgalian in?** ŗ U+0157 and ō U+014D — two table entries, one
political history (§5.4).

**F-6 · Consent, licence, and attribution per contribution.** `CommunityAttested { body:
String }` is free text. It cannot express **who** consented, **to what use**, or **whether
consent can be withdrawn** — even though withdrawal is the crate's central mechanism. For
tribal material this is the absence that would be most damaging to retrofit and most damaging
to get wrong with exactly the communities named.

**F-7 · Is `skeleton()` retained at all, and against which pinned Unicode version?** UTS #39
says skeletons are not stable across Unicode versions and are not for display; the design
uses one as a permanent tree key (§3.7b).

**F-8 · Name length: bytes or codepoints?** A 32-**byte** cap gives English three times the
name length it gives Latvian and Han (E-7). Changing it to codepoints has a chain-RAM cost
that `bzdid:61` will not let anyone hand-wave.

### 6.2 Engineering, ordered

1. **O-1 — Resolve the public promise.** `surfaces/onboarding/index.html:218` states an
   unbacked commitment to users. Either F-1 lands and the string becomes true, or the string
   is corrected. It is shipped and public; this is first.
2. **O-2 — BLOCKING CHECK: does ENSIP-15's Latin group admit the Latvian combining-mark
   sequences** (U+0304, U+030C, U+0327 over Latvian bases)? Requires reading the
   `@adraffy/ens-normalize` data tables. **UNICODE-NAMING-1.md cannot be written before
   this** (§3.10).
3. **O-3 — Re-verify or retract `bzdid-architecture-decision.md:310`.** The `paypaĺ`/`paypal`
   example appears false against `confusables.txt` (§3.7a). Receipt required. Do not repeat
   it as a code fact in the interim.
4. **O-4 — Add non-ASCII fixtures to `crates/language-authority` tests.** One Latvian
   NFC/NFD pair, one Han pair. **Cheapest, highest-value item in this document** — it moves
   the normalization question from production into CI, and every test in the tree currently
   passes on pure ASCII (§2.5).
5. **O-5 — Normalize at the `LanguageId` / `MessageKey` boundary.** Both are tuple structs
   with **public** fields and no constructor (`lib.rs:46-51`), so no invariant can be
   enforced today, and both derive `Hash` + `Ord` and are used as map keys. `"lv"`, `"LV"`,
   `"lv-LV"`, NFC-`ā` and NFD-`ā` are all distinct identities right now. Private field plus a
   normalizing constructor is a two-line fix **today** and a breaking change with a data
   migration once any authority is connected. Note the tension to resolve deliberately:
   normalizing the identifier is a small act of adjudication over a field the crate says BNR
   does not adjudicate (`:45`).
6. **O-6 — Harden `probe_retention` against normalization-form evasion.** `:278-284` does a
   byte-exact `hay.contains(t.as_str())`. A cache that stores NFD and returns NFC — which
   some filesystems and search indexes do by default — **retains the entire corpus and passes
   the probe Clean.** The existing negative control (`:400-415`) uses a byte-identical
   `clone()`, so it proves the harness catches byte-identical retention and nothing more.
   Fix: NFC-normalize both sides before the check, and add a third negative-control subject
   `RetainingNormalized` that caches an NFD copy. **If that test passes as `Clean` today, the
   harness is a decoration for every language with diacritics** — which is the founder's
   language. This is the strongest technical argument for adopting NFC inside this crate
   specifically.
7. **O-7 — Write `UNICODE-NAMING-1.md`** once F-3, F-4, F-7, F-8 and O-2 have landed. It
   owns: charset admission per script, the NFC rule, the case rule, the alias/variant policy,
   the pinned Unicode version, and the registry-vs-corpus pipeline separation of §3.9.
8. **O-8 — Letter to AiLab IMCS UL / CLARIN-LV** establishing the LVK licence (§5.2). Decides
   merge-versus-align; blocks corpus interoperation design.
9. **O-9 — The PanLex letter**, already owed at `ROUTING.md:118-124` and already blocking
   bTONGUES. Note it may be smaller than it looks: if BNR holds no corpus (F-1), BNR may never
   hold PanLex data at all, and BY-NC-SA's viral clause may never attach.
10. **O-10 — Record the `crates/normalizer` name collision** so a future Unicode normalizer
    does not collide with chain-event normalization (§2.5).

---

## 7 · CORRECTIONS TO THE RECORD

Per standing law 10 — a false signal is deleted, not patched — the following existing text is
contradicted by this document and must be corrected or independently re-verified, **not left
standing while this draft sits unratified**:

| where | what it says | status |
|---|---|---|
| `bzdid-architecture-decision.md:65`, `:100` | `skeleton(NFKC(lowercase(input)))`, "UTS-46 plus Unicode confusable skeleton" | UTS-46 applies **NFC**, not NFKC; ENS chose **NFC**. Conflation, overstated folding. **F-3.** |
| `bzdid-architecture-decision.md:310` | "`paypaĺ` and `paypal` are the same claim" | **CHALLENGED** — U+013A reported absent from `confusables.txt`; UTS #39 skeleton does not strip diacritics. **O-3.** |
| relayed claim about `bdomain.cpp:43-44` | "`tolower()` on bytes ≥ 0x80 is UB" | **FALSE.** Source uses an explicit `'A'..'Z'` range test (`:41-49`). No UB. The real defect is *no Unicode case folding at all*. |
| framing that reached this seat | "the NFC/NFKC decision is made by the Latin-script languages, so Latvian drives it" | **Half right.** Latvian drives **NFC vs NFD**. Han drives **NFC vs NFKC** — Latvian is NFKC-invariant. §3.2. |
| any statement that Han traditional/simplified is a normalization problem | — | It is not. Unihan variant properties, informal and non-normative. §3.11. |

---

## 8 · SOURCES

**In tree** (all paths absolute from repo root unless noted):
`crates/vocabulary/src/lib.rs:32,36,39,50-52,76,112,205-237` ·
`crates/language-authority/src/lib.rs:1,3,9-11,19-25,45-58,80-88,104-124,205-212,249-293,365-368,400-415` ·
`Cargo.toml:6-43` (38 workspace members) ·
`docs/bzdid-architecture-decision.md:29,61,65,74-75,100,292,310` ·
`docs/ROUTING.md:118-124` · `docs/feature-backlog.md:413` ·
`surfaces/onboarding/index.html:170-174,213-222` ·
`docs/dispatches/SPEC_RESOLVER_VALIDITY_RULES_2026-08-08.md:59` ·
`C:\Users\travi\b-domain\contract\bdomain.cpp:19-26,28-39,41-49,63-79`

**Unicode:**
UAX #15 Normalization Forms — https://www.unicode.org/reports/tr15/ ·
UAX #38 Unihan Database (`kSimplifiedVariant` / `kTraditionalVariant`) — https://www.unicode.org/reports/tr38/ ·
UTS #39 Security Mechanisms (skeleton, stability warning) — https://www.unicode.org/reports/tr39/ ·
`confusables.txt` — https://www.unicode.org/Public/security/latest/confusables.txt ·
UTS #46 IDNA Compatibility Processing §4 Step 2 — https://www.unicode.org/reports/tr46/ ·
Unicode Core Spec ch. 7 (Latvian comma-below vs cedilla) — https://unicode.org/versions/Unicode17.0.0/core-spec/chapter-7/ ·
L2/13-127 and L2/13-128, Latvian/Livonian glyph documents — https://www.unicode.org/L2/L2013/13127-latvian-livonian-glyphs.pdf , https://www.unicode.org/L2/L2013/13128-latvian-marshal-adhoc.pdf

**ENS:** ENSIP-15 Normalization Standard — https://docs.ens.domains/ensip/15/ ·
`@adraffy/ens-normalize.js` (data tables, for O-2) — https://github.com/adraffy/ens-normalize.js/

**Latvian language and corpora:**
Latvian National Corpora Collection / AiLab IMCS UL — https://korpuss.lv/en/about ·
CLARIN-LV repository, LVK handles — https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/11 , https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/84 ·
LREC 2022 corpus paper — http://www.lrec-conf.org/proceedings/lrec2022/pdf/2022.lrec-1.548.pdf ·
CLARIN-LV B-centre — https://www.clarin.eu/content/tour-de-clarin-clarin-lv-b-centre ·
Britannica, Baltic languages / comparison of Lithuanian and Latvian — https://www.britannica.com/topic/Baltic-languages , https://www.britannica.com/topic/Baltic-languages/Comparison-of-Lithuanian-and-Latvian ·
Latvian orthography incl. the 1946 reform — https://en.wikipedia.org/wiki/Latvian_orthography ·
CJK Compatibility Ideographs — https://en.wikipedia.org/wiki/CJK_Compatibility_Ideographs ·
Kangxi Radicals block — https://en.wikipedia.org/wiki/Kangxi_Radicals_(Unicode_block)

**Computed this session** (normalization behaviour of all 24 Latvian letters under NFC/NFD/NFKC/NFKD;
Han invariance; U+F900 → U+8C48 under NFC; U+FA0E unchanged; U+2F00 unchanged under NFC and folded
under NFKC; U+FF21 → U+0041 and U+FF71 → U+30A2 under NFKC only; UTF-8 byte counts NFC vs NFD).

---

**END OF DRAFT.** Nothing here is ratified. §6.1 is the founder's; §6.2 waits on it, except
O-1, O-3, O-4 and O-6, which are defect repairs and do not need a ruling to begin.
