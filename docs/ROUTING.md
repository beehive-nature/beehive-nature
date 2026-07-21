# ROUTING — where artifacts go, and who moves them

**ROUTING** · **Destination:** `beehive-nature/docs/ROUTING.md` · **Delivery:** Code commits.
**Founder read required:** once. After that it runs itself.

---

## THE STANDING RULE

**Every artifact names its destination and its delivery method in its first three lines, at creation time.**

```
**ROUTING** · **Destination:** <repo/path or seat name>
**Delivery:** Code commits | paste to <seat> | founder-manual
**Founder read required:** yes/no
```

**Why:** 46 files accumulated untracked on this mount because no artifact carried its own routing, so the founder became the router by default. **An artifact that does not know where it goes has made someone else responsible for remembering.**

---

## WHO CAN DO WHAT — the constraint that shapes everything

| Seat | Read repo | Write mount | Commit | Push |
|---|---|---|---|---|
| **Code** | yes | yes | **yes** | **yes** |
| **Cowork/design** | yes (public repos, via clone) | yes | **no** | **no** |

**Verified, not assumed:** `.git` is read-only to the Cowork seat — `git add` fails. **LOVErnment-DAO is public and clonable anonymously; `beehive-nature` requires auth.**

> **Consequence: the design seat can produce and stage, never land. Every durable artifact needs exactly one line to Code.** That is the whole courier cost, and it is one line, not a pile.

---

## OUTSTANDING NOW

### Code commits these

| File | Destination |
|---|---|
| `docs/DESIGN-BRIEF-02-bigen-library.md` | here — beside BRIEF-01 |
| `docs/ROUTING.md` | here — this file |
| `bigen-pickup/INTEGRITY-SCHEMA.md` | **`LOVErnment-DAO` → `bigen/integrity/SCHEMA.md`** |

### Paste to a seat, then delete

| File | To |
|---|---|
| `bigen-pickup/CORRECTIONS-01.md` | the BIGEN seat |

### Delete — ONLY against an exhibited mirror

> **⚠ CORRECTED 2026-07-21.** This section previously read *"Every ruling inside them is already mirrored into a committed home… scaffolding around finished buildings."* **That claim was false and I never verified it.** Code gated the deletion behind one adversarial verifier per file: **11 of 18 confirmed mirrored, 7 came back `HOLD_UNMIRRORED`.** Executing my instruction as written would have permanently destroyed seven rulings — untracked files have no git history to recover from. **One of the seven (RELAY_22 §5a) is a live gap in the shipped `onboarding` crate, not merely an undocumented decision.**

**11 files deleted after their mirrors were exhibited.** The 7 held —
`RELAY_11 · 12 · 14 · 19 · 21 · 22 · 24` — were then **mirrored to committed
homes and deleted (2026-07-21)**, each witness `git grep`-verified against the
tracked tree first. Two of the seven were not documentation moves:

| Held file | Ruling | Committed home | Kind |
|---|---|---|---|
| RELAY_22 §5a | PDS-custody must be disclosed on an ATProto/PLC binding | `crates/onboarding` (`InformedConsent.discloses_pds_custody`, `PersonaBinding::bind`, negative control) | **code fix — live gap in shipped crate** |
| RELAY_14 | B12-in-beef `NotMeasured{NotRequested}` teaching fixture | `crates/coa` (built as running tests) | **fixture built, not filed** |
| RELAY_24 | four ratified data-commons answers | `dockets/DATA_COMMONS_phase_charter.md` | doc |
| RELAY_11 d3–5 | ImportProvenance · DisclosurePair · claim-drawer scope | `crates/price-feed` module doc | doc |
| RELAY_12 | `NutrientRecord` record shape | `SPEC_hulled_hemp_hearts_COA_tri_jurisdictional.md` §5a | doc |
| RELAY_19 | surviving reproducibility constraints | `docs/architecture/bnr-ose-spec.md` | doc |
| RELAY_21 §4 | Vega-Lite spec as a serde struct | `docs/adr/0001-…md` | doc |

**`RELAY_25_BIGEN_architecture.md`** → moved to `LOVErnment-DAO` as `bigen/ARCHITECTURE.md`.

---

## ⚠ THE DELETE GATE — standing, and it outranks any instruction in this file

**Nothing is deleted on an assertion that it is mirrored. The mirror must be exhibited: a tracked file and the line that carries the ruling.**

**Law 1 applied to deletion.** *"Every ruling in these files is mirrored"* is a universal claim, and a universal claim requires an exhibited witness. A seat asserting it — **including the design seat, including in this document** — is not a witness.

**Why this was the hole:** every other destination in this file carries a verification step. Commit gets read-and-clear. Publish gets read-and-clear. **Delete had none — and for untracked files it is the only irreversible one.** That was backwards.

> **The gate:** for each file, `git grep` the ruling in the tracked tree. **Found → delete. Not found → HOLD and mirror first.** Cost of an over-cautious hold: a file sits on the mount. Cost of a wrong delete: a ratified ruling ceases to exist.

**A seat that refuses a delete instruction pending verification is performing correctly and requires no further authority to do so.**

### Hold — not this session's problem

**16 `*_DO_NOT_COMMIT.md` files + `BACKUP_*.zip`** — legacy, gated behind the Drive backup. **`*.SEAT3_VERIFIED.md`** are Code's own receipts; Code's call.

---

## ⚠ THE DESIGN-DELIVERY GATE — standing (added 2026-07-21)

**A design artifact is not *delivered* until it exists in a project the implementing seat can read.** A seat reporting "shipped" is not delivery; the artifact appearing in a readable design project is.

**Why this was a hole:** this file governs *repo* artifacts — it says nothing about *design-project* artifacts. So a design seat could report shipping three DAO state panels (MoneyGauge stale · UnshowableBGauge · MissingRequiredGauge) while they exist in **no project the implementing seat can open** — the `DAO Dashboard.dc.html` in the shared project has neither, and the writable "Design System" project is empty. The implementing seat then cannot build without inventing, which the scope law forbids.

> **The gate:** before a design artifact is treated as buildable, the implementing seat opens it in an accessible design project and confirms the named components are present. **Present → build from it. Absent → HOLD and report; do not reconstruct the visual language from a description.** Cost of a hold: a panel waits. Cost of inventing: the surface ships a design nobody ratified.

**A seat that refuses to implement an absent design pending its delivery is performing correctly.** Locating a design that was reported-but-not-found is a founder-manual step (ask the shipping seat where it actually lives) — see below.

---

## FOUNDER-MANUAL — only these actually need hands

**Nothing on this list can be done by any seat. Everything else has an owner.**

1. **Backup zip → Drive.** Gates the legacy sweep above.
2. **Authorize the GitHub connector** (`plugin:engineering:github`, in connector settings). **Removes most of the remaining courier burden** — the design seat could then read repo state directly instead of asserting about trees it cannot see.
3. **Fiscal sponsor emails** · **lab RFQ** · **farmer's number** · **the four private letters** · **`mro-jl22-ajin` posting** · **a Linux machine for the COSMIC window.**
4. **Ask Fable where the three DAO state panels live** (MoneyGauge stale · UnshowableBGauge · MissingRequiredGauge). Reported shipped, but present in no design project the implementing seat can read (per the design-delivery gate above). Code holds — will build from the design once it lands in a readable project.

### Contact-in-future

**PanLex** (The Long Now Foundation, 501(c)(3)) — **written permission for commercial use of the lexical database.**

- **⚠ STATUS — BLOCKED, do not build against it yet (2026-07-21).** No integration, adapter, or derived lexicon layer is authored until the written-permission letter lands. The licence, not our restraint, is the gate: see below.
- **Why it's needed:** the database is **CC BY-NC-SA 4.0**, not CC0. *(A web search reported CC0; the license page itself says BY-NC-SA — verified by direct fetch. Treat BY-NC-SA as operative until PanLex confirms otherwise in writing.)* **NonCommercial collides with the Capital-Business-For-Profit arm, and ShareAlike is viral** — a derived lexicon layer would inherit BY-NC-SA and conflict with the public-commons-anyone-can-fork architecture.
- **Why it's winnable:** nonprofit to nonprofit. Their mission — *"nobody should have their rights restricted because of the language they speak"* — is bTONGUES' thesis, and they explicitly name **land rights and agriculture** among the fields they support. Their license page states commercial use is available by written permission, and their site invites custom arrangements. **This is a letter, not a negotiation.**
- **Why it's worth the letter:** PanLex independently built our provenance ladder. **`distance-1` = attested by a source; `distance-n` = inferred from chains, n = shortest chain** — that is `Confirmed` vs `Informational` with confidence decaying by chain length, and every translation carries a source label. Integration would be structural, not a mapping layer.
- **Coverage:** **Latvian Romani (`rml-001`) confirmed present in their inventory** (2026-07-21). Purépecha (`tsz`) coverage still unverified — the API query returned empty through the fetch tool, which is a tooling limit, not evidence of absence. Check `vocab.panlex.org` before writing.

**Aug 21 is the only clock.**

---

## WHAT CHANGED, SO IT DOESN'T RECUR

**Before:** the design seat produced prose and the founder relayed, routed, and remembered which file went to which seat.

**After:** every file carries its destination. **The founder's job is to forward one line to Code and paste one file to a seat.** If an artifact ever arrives without a routing header, it is defective and should be sent back.

---

*bQueenBee custodies the process; humans hold the duty. Custody means the record is durable and the next action is named — not that more documents exist.*
