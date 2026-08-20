# DESIGN BRIEF 04 — the BlanguageDOCK

**ROUTING** · **Destination:** `beehive-nature/docs/` — beside `DESIGN-BRIEF-02-bigen-library.md`.
**Delivery:** Code commits. **Audience: the Claude Design session — at the alpha→beta transition, by founder order.**
**Steward seat: zCode (assigned 2026-08-19).**

**Read `DESIGN-CONSTRAINTS.md` and BRIEF-01/02 first.** This extends them. Every constraint binds: colour never sole channel, honest absence, reading levels, logical properties for RTL (§12 is this surface's native country), claims graded or not at all.

---

## 0. WHAT THIS IS

**BlanguageDOCK** — the organism's language corpus, run as a permissionless dock. Every user-visible string on every surface is a corpus record; every language — tribal, indigenous, rare, endangered, or the boring global ones — docks without asking anyone.

The founder's spec, verbatim properties: **decentralized · scalable · fully autonomous · self-healing and improving · contribute and remove permissionless · in all user-visible text surfaces.**

| | traditional i18n | BlanguageDOCK |
|---|---|---|
| Locales | a product decision, added when a market justifies it | a language docks itself; no gatekeeper decides worthiness |
| Strings | `en` first, everything else a translation task | every string is a record with parents: who, when, which sweep passed |
| Absence | silent fallback to English, unmarked | **honest absence** — `absent` renders as absent; machine text renders as machine, labeled |
| Removal | an editor deletes a file | withdrawal with a receipt; history is chain-anchored — the dock forgets nothing, it honors withdrawals |
| Improvement | a release cycle | standing sweeps + git deliberation; forks are dissent |

> **The line that should drive every layout decision: a traditional locale is a product decision. A docked language is a passenger.**

The stakes, cited: UNESCO holds that **no less than 40% of some 6,700 languages** are in danger of disappearing ([unesco.org](https://www.unesco.org/en/articles/towards-world-atlas-languages)); the Atlas's last edition counted 538 critically + 502 severely + 632 definitely endangered + 607 vulnerable languages ([Atlas record](https://en.wikipedia.org/wiki/Atlas_of_the_World%27s_Languages_in_Danger)). A language dying is not a market segment that failed to justify itself. This corpus is the opposite answer.

---

## 1. THE HARD DESIGN PROBLEM — the consent layer (sibling of BiGen's integrity layer)

Every contribution carries a `consent:` block. **The failure mode is appropriation theater**: a warm "we honor your language" veneer over heritage data extraction — recordings, stories, phrasing harvested from communities that get no authority over it. The design job is to make consent read as **measurement, not decoration**.

Three constraints that follow:

1. **Consent flags are symmetric or the dock is worthless.** They apply to English, to our own hub strings, to a fluent elder's contribution and to a machine draft — identically. `community_attested: false` on our English baseline renders exactly as it would on any rare language. *Negative control: the consent block ever rendering softer on our own material → fail.*
2. **Consent never auto-deletes, and withdrawal is honored.** "Remove permissionless" means: any contributor may withdraw **their own** contribution at any time without asking anyone — and no one may remove anyone else's, or the history. Withdrawal is a marker with a date; surfaces stop rendering the record; the chain keeps the memory. Vandalism heals the same way everything here heals: sweeps + supersession, never deletion. *Negative control: a withdrawn string still rendering on any surface → fail; a withdrawal erasing history → also fail.*
3. **Machine contribution never renders unlabeled.** The `unmeasured is never zero` law, translated: **machine is never silent about being machine.** An autotranslated string that renders indistinguishably from a speaker's string is the corpus's version of fabrication. *Negative control: a machine-drafted string rendering without its label → fail.*

**External anchors that must be cited, not paraphrased:** the **CARE Principles** for Indigenous Data Governance — Collective benefit, Authority to control, Responsibility, Ethics ([Carroll et al. 2020, Data Science Journal, DOI 10.5334/dsj-2020-043](https://doi.org/10.5334/dsj-2020-043); [GIDA](https://www.gida-global.org/careprinciples)) — and **UNDRIP Articles 13–14** on language and education rights ([OHCHR text](https://www.ohchr.org/en/instruments-mechanisms/instruments/united-nations-declaration-rights-indigenous-peoples)). Where CARE and a permissionless dock tension, the surface shows the tension; it does not resolve it silently.

### The attestation seam — prescribed now, built at beta (founder ruling 2026-08-19)

When speaker-community attestation stops being socially empty, it must ride the **persona machinery, never the root**: per-contribution consent bound to a **persona nullifier**, with **`DisclosureMode` per binding** — the wellness lane's data law, already standing, not new doctrine. Lane C's law ([`BSAFE-DEVICE-1.md`](../BSAFE-DEVICE-1.md)): sealed to a persona with `DisclosureMode` per binding (default `Selective`), *never touching the identity path*, consent-gated per study; personas are context nullifiers `PRF(seed, context)` below the bzDiD ([`biometric-uniqueness-ledger.md`](../biometric-uniqueness-ledger.md)), and FileKey's per-namespace derivation already implements the unlinkability pattern ([`filekey-bdid-integration-review.md`](../filekey-bdid-integration-review.md)).

**A speaker docking their grandmother's language must not correlate that act with their wallet, their festival wristband, or their name.** The classification of empty attestation as "the work, not a bug" stands — and this seam is how the work stays safe to do.

> *Negative control: an attestation joinable to the bzDiD root — or linkable across contributions through any other persona — → fail.* **A beta design that binds attestation to the root does not reach beta.**

### ⚠ Stated plainly for the design seat

**This surface can very easily become a colonial trophy wall.** Flags, exotic scripts as decoration, a scroll of dying languages consumed as content. The endangered-language register must render as **a register with receipts** — statuses linked to their Atlas sources, codes linked to the ISO 639-3 registry — never as atmosphere. *If a page section exists mainly to make us look virtuous, cut it.*

---

## 2. THE THREE OBJECT TYPES — they must not look interchangeable

| Type | Contains | Output artifact |
|---|---|---|
| **Dock entry** | a language record: endonym, exonym, ISO 639-3 code *where one exists*, script, text direction, vitality **with source** | metadata card |
| **String record** | key + per-language renderings + status: `human-attested / community-attested / machine-drafted (labeled) / absent` | the corpus unit every surface consumes |
| **Sweep record** | a standing query's output: violations found, healed, pending | the self-healing, visible |

**A dock entry and a string record must be visually unmistakable.** A string rendering with dock-entry furniture would assert a language fact about a UI string — same category error as an evidence map rendering a pooled estimate. *Negative control: a string record displaying a vitality badge → fail.*

**Absence of an ISO 639-3 code is a finding, not a blank** (languages exist that the registry has never coded) — same family as `Absent { reason }` and `UNTESTED`.

---

## 3. REAL DATA TO RENDER — all cited, none invented

### The corpus genesis: the hub's own strings

The dock starts by eating the organism's own UI — `surfaces/index.html` verbatim strings as the first records, baseline `en`, full consent blocks on our own material (the symmetry specimen ships first, same lesson as BRIEF-02's LiBBY block).

### The seed register (vitality statuses linked to Atlas/ELP sources)

| Language | ISO 639-3 | Vitality (Atlas-linked) |
|---|---|---|
| English | `eng` | safe — **the control specimen: ours, no special treatment** |
| te reo Māori | `mri` | definitely endangered — kōhanga reo immersion revitalization |
| ʻŌlelo Hawaiʻi | `haw` | severely endangered — Pūnana Leo revitalization |
| Diné bizaad (Navajo) | `nav` | vulnerable — large speaker base, transmission weakening |
| aynu itak (Ainu) | `ain` | critically endangered ([ELP record](https://endangeredlanguages.com/elp-language/1212)) |

Statuses cite the Atlas record and its successor, the [World Atlas of Languages](https://www.unesco.org/en/articles/unesco-hosts-ad-hoc-expert-meeting-world-atlas-languages) — the surface states which edition it reads.

### The gap map (the highest-value single artifact, again)

Strings × languages: **only the `en` column filled; every other cell `absent`.** No cell is machine-filled, no cell is invented by a non-speaker. **The empty cells are the corpus's first finding and its invitation** — the same absence-as-information pattern as BRIEF-02's diagonal gap map.

---

## 4. WHAT MAKES IT DIFFERENT FROM EVERY i18n SYSTEM

**A string that visibly has parents.** Who contributed, when, which consent block, which sweep last passed it. Freshness receipts (`last_run`, `new_since_last`) — a living corpus advertises when it last looked.

**Withdrawal rendered as a first-class state.** Not a 404, not a hole: *this string was withdrawn by its contributor on this date; history preserved.* A removed language leaves a receipt shaped like itself.

**Self-healing is visible machinery**, not a claim: `missing-key-sweep` (every UI key exists or renders `Absent{reason}`), `withdrawal-sweep` (nothing withdrawn still renders), `machine-label-sweep` (nothing machine renders unlabeled), `direction-sweep` (RTL renders logical properties, D-13).

---

## 5. THE DELIVERABLE I'D ASK FOR (at beta transition)

**One string-corpus page, in three states:**

1. **Clean** — a docked language rendering attested strings, direction honored.
2. **Withdrawn** — the receipt state; history preserved, surfaces honoring the marker. **This is the real deliverable** — no precedent to borrow from.
3. **Machine-drafted** — labeled unmistakably, attestation pending shown as pending.

**Plus:** the bidi/RTL edge exercised for real (§12 is first-class here, not a mirror); reading-level law on translated prose (same numbers, different prose — never different facts).

**One small thing worth getting right early:** the consent block rendered on *English*, our own baseline. If it looks like a formality there, it is wrong everywhere.

---

## 6. NOT YET

**Don't design:** audio archives, lexicon/phonetic datasets, the contribution flow UX, chain-anchoring specifics (defer to the anchor doctrine — the anchor is the truth), any machine-translation pipeline, gamified "save a language" mechanics. **Those are beta-and-after** — but the contribution flow's *data law* is prescribed now (§1, the attestation seam): when the flow gets designed, consent arrives persona-bound or it doesn't arrive.

---

*Seven thousand ways of saying "welcome," forty percent of them fading — a dock where any of them boards without asking permission, and none leaves without a receipt.*
