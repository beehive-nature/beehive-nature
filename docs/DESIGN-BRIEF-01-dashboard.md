# DESIGN BRIEF 01 — the DAO dashboard
**Answers to the design session's questions.** Companion to `DESIGN-CONSTRAINTS.md`.
**Everything below is read from the tree, except where marked `INVENT IT`.**

---

## 0. THE AUDITED TOKEN LAYER — real values, extracted from the grant-v5 surfaces

**These are read from the F-4-remediated WELLness surfaces, not recalled. Do not fabricate alternatives** — they came out of a 161-element browser contrast audit.

### Light surfaces (7 of 8)

| Token | Value | Role |
|---|---|---|
| `--ink` | `#1A2320` | primary text |
| `--ink-mut` | `#57655F` | secondary text |
| `--ink-dim` | `#68726A` | muted text — **see the per-surface caveat below** |
| `--paper` | `#F6F8F1` | page |
| `--card` | `#FFFFFF` | card surface |
| `--line` | `#E4EBDC` | hairline |
| **`--biomass`** | `#5FA544` | **datum fill only — never text** |
| **`--biomass-ink`** | `#487D34` | **the AA-clean text derivative of biomass** |
| `--ai` | `#0B7A89` | accent text — darkened, hue kept |
| `--info` | `#2A73AE` | info text |
| `--guard` | `#7D5FB0` | flags and badges |
| **`--b-value`** | `#E8B54B` | **honey, unchanged — dark chip only** |

### Dark surface (`bqueenbee_analytics`)

`--ink #E9F2EC` · `--mut #8FA79C` · `--card #0C1412` · `--line #1E2B26` · `--biomass #86CC72` · `--ai #45C2DC` · `--info #6FA9E0` · **`--guard #B7A8F7`** (raised here) · `--b-value #E8B54B`

### ⚠ Three treatments that are structural, not decoration

1. **`--biomass` is a DATUM colour** — fills, seals, chart marks. **Text uses `--biomass-ink`.** Using the datum hue for text reintroduces a failure the audit fixed.
2. **Honey `--b-value` stays `#E8B54B` and clears AA *only on a dark chip*.** Putting a `+b` number on paper reintroduces the **1.88:1 failure found on 17 instances**. The brand colour survives by getting a dark background, never by being repainted.
3. **The semantic hues are theme-aware.** `--ai`, `--info`, `--guard` have genuinely different light and dark values — this is not a filter or an opacity shift.

### ⚠ And the caveat that matters most

**These were computed per-surface against each surface's own composited background.** That is why `--ink-dim` is not a single value — two surfaces sit at `#64746D` and `#64746F`.

> **The dashboard is a NEW surface. Slot these as the starting palette, then re-run the contrast check against the dashboard's own composited backgrounds before trusting AA.**

**Copying a passing value onto a different background is not a guarantee** — and that assumption is exactly how 161 failures accumulated behind a surface that had already been granted.

**Ask Code for `verify/check-contrast.mjs` alongside the tokens.** Without the tool, "re-run the check" is aspirational.

### Durability

**This palette currently lives only in ephemeral session scratchpad.** A 161-element audit is expensive to redo. **Ruling: commit it to `beehive-nature/docs/` as the interim home — beside this brief and `DESIGN-CONSTRAINTS.md` — moving to a frontend tree when one exists.**

**It is documentation of a design decision, not a frontend asset**, so it does not make the kernel depend on it. Ephemeral-and-expensive beats layering purity here, and the docs that reference it are already in that folder.

---

## 1. WHAT BNR IS — one line, for copy

> **A sovereign operating environment where what you know is measured, what isn't measured says so, and nobody needs permission to read it.**

**The OSe** is the shell that surrounds everything — your keys, your `b`, your surfaces. Plugins change; the shell doesn't. **You visit regulated services from home; you never move there.**

## 2. THE TWO FRONTENDS

**`skaists.social`** — *pure web / PWA, no desktop build.*
**Who:** DAO members and anyone curious. **Device:** any browser, installable to home screen. **Does:** watch the DAO's state daily — Respect standings, treasury, commissioning — and vote or file worker-bee proposals.

**`bNature.social`** — *web for status, Tauri desktop for operations.*
**Who:** growers and node operators. **Device:** browser to watch, desktop app to run things. **Does:** node ops, mining, cultivation records. **The operations panels exist only in the desktop build** — a browser can't spawn daemons, and the web version says so rather than appearing broken.

---

## 3. GROW FROM: the DAO dashboard, `skaists.social`

**Why this one first:**

1. **The founder uses it daily** — a real feedback loop, not an imagined user.
2. **The data already exists** — `crates/dashboard` is built and tested, with real shapes.
3. **It needs no identity.** Read-only, no auth ceremony, no consent surfaces, no age gates. **The display problem is isolated.**
4. **It exercises the hardest constraint immediately** — it ships with **two honest-empty panels**. Designing *how an honest absence looks* is the single most distinctive thing in this whole system, and this is where it appears first.

---

## 4. COMPONENT INVENTORY — confirmed, with one addition and two deferrals

| Component | Needed for the dashboard? | Notes |
|---|---|---|
| **`Gauge`** (paired b + money) | **yes** | never renders alone |
| **Non-value states** | **yes** | §6 below — four distinct kinds |
| **`Panel<T>`** | **yes — ADD THIS** | missing from your list; it is the dashboard's core unit |
| **`Hud` renderer** | **yes** | the frame that carries the gauges |
| **`GradeStatus`** | **later** | onboarding, not the dashboard |
| **`ClaimCard`** | **later** | WELLness — the dashboard makes no effect-claims |
| **`ConsentSurface`** | **later** | onboarding and data-release |

**Sequence the components by surface. Do not build the last three yet.**

---

## 5. REAL DATA TO RENDER — from the tree

### `b` function-denominations
`b` buys **OSe function**, not goods. Real readings:

- **"enough for 3 OSe updates"**
- **"enough for 12 accord signings"**
- **"enough for 2 node deployments"**

**Note the type:** `function_reading` is `Option<String>` and is **present only when the balance is `Known`.** A function reading over a stale balance would be a confident statement about the wrong number — the code enforces this.

### Money
**Default `USD`.** Second demo locale **`MXN`** — the paradigm user is a grower in Michoacán, so a currency switch is a real test, not a checkbox.

### A product, if useful
`INVENT IT` — but keep it plausible: **hulled hemp seed (hemp hearts), sold by the pound.** Real anchors if you want them: retail ~$10.39/lb for 16 oz, ~$12.80/lb for 8 oz. **That 23% small-package penalty is a real finding from USDA data and would make a good panel.**

---

## 6. NON-VALUE GAUGE STATES — four, and they differ in kind

**These are from real enum definitions, not invented:**

| State | Source | Means | Must not look like |
|---|---|---|---|
| **Stale** | `BBalance` / `BGauge::stale()` | we have a gauge, we cannot vouch for the number | a number. Ever. `function_reading` is `None` here by construction |
| **Refused** | `HudRefusal::UnshowableBGauge` | the surface declines to render rather than show a wrong figure | an error the user caused |
| **Absent, with reason** | `Panel::Absent { reason }` | deliberately not shown, and here is why | an empty box, a spinner, or a zero |
| **Breach** | `Headroom::Breach(n)` | **an impossible state that occurred — the floor law failed** | `AtCap`. **This is the one that must be unmissable** |

**`AtCap` vs `Breach` is the sharpest pair in the system.** At-cap is legitimate ("no room left"); breach means a kernel invariant broke. **They must be visually unmistakable from each other — a boundary and a violation cannot wear the same costume.**

**Other refusals to design for:** `MissingRequiredGauge { which }` and `RateOutsideDrawFacility`.

---

## 7. GRADE SCALE FOR CLAIMS

**`High · Moderate · Low · Very low · Ungraded`** — plus the state **`Ungraded · No source attached`**, which is the honest default and must be *visible*, not hidden.

**Not needed for the dashboard.** Design it when WELLness comes.

---

## 8. READING LEVEL — yes, include it

**Three: plain / standard / technical.** Cheap in a mockup and one of the most distinctive behaviours.

**Hard rule: prose changes, numbers never.** The same figure, the same method stamp, different sentence. *A reading level that alters a displayed value is a bug.*

---

## 9. RTL — not a variant in this pass, but do not preclude it

**Don't design an RTL mockup yet.** **Do** use logical properties throughout — `inline-start`/`inline-end`, never hard-coded left/right.

**Why:** D-13 makes RTL first-class, and retrofitting it after a layout hard-codes direction is expensive. Costs nothing now.

---

## 10. VARIATIONS — explore the absences, not the palette

**The unusual thing here is not how a healthy dashboard looks. It is how a dishonest one is made impossible.**

**Worth several variations:**
- **How does `Absent { reason }` read** so it feels informative rather than broken or apologetic?
- **How does `Stale` differ from `Absent`** at a glance?
- **How loud is `Breach`** without being alarm-fatiguing — it should almost never fire, and be unmissable when it does.
- **How do two gauges sit together** without one dominating?

**Not worth variations yet:** colour schemes (tokens are already audited), typography scale, iconography.

---

## 11. STARTING DESIGN SYSTEM — skip it

**Recommend building from the constraints rather than adapting an existing system.**

**Why:** Material, Carbon, and their relatives all assume the normal case is *a value*. **This system's most important case is a non-value** — stale, absent, refused, breached. Those systems have no vocabulary for "we cannot vouch for this number," and adapting one means fighting its defaults on the exact axis that matters most.

**The tokens and behaviours already exist. What's missing is the visual language for honest absence, and no off-the-shelf system has one.**

---

## 12. THE DELIVERABLE I'D ASK FOR

**One screen — the DAO dashboard — in three states:**

1. **Everything measured** — the healthy case.
2. **Mixed** — some panels measured, the circle panel `Absent` (lexicon not landed), the spirit panel `Absent` (SPIRIT-1 undefined), one gauge `Stale`.
3. **Breach** — `Headroom::Breach` firing.

**State 2 is the real deliverable.** It is the state the dashboard will actually be in on day one, and it is the one no existing design system knows how to draw.

---

*Read the constraints doc first. Appearance is entirely yours; the behaviours above are ruled and mostly compile-enforced, so you cannot drift from them by accident — only by fighting them on purpose.*
