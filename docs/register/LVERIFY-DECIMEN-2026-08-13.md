# L-VERIFY — DECIMEN OPTICAL TRANSFER (action item 1, PLUR.earth)
**Seat:** Cowork · **Date:** 2026-08-13
**Result: ⛔ DO NOT FORK THE REPO AS WRITTEN. "v0.3.0, MIT" is TRUE about a TAG and FALSE
about the REPOSITORY. Forking `main` today gets AGPL-3.0.**

> **This is not the commissioned triage.** `docs/inbox/PLUREARTH-DRAFT.md` **still does not
> exist** — `docs/inbox/` is not in the tree and no file matching `*PLUREARTH*` is anywhere
> in the repo. This file verifies the **one concrete, checkable claim in the action list**,
> because that claim gates the bottleneck you named (engineer bandwidth) and would have been
> discovered *after* the fork.

---

## THE FINDING

| claim | verdict | evidence |
|---|---|---|
| "Decimen Optical Transfer" exists | ✅ **REAL** | `bashalarmistalt/decimen-optical-transfer`, 4.5k stars, 541 forks; author Evan Crawley |
| "v0.3.0" | ✅ **REAL, and it is the LATEST release** | Releases: **v0.3.0 (04 Aug)**, v0.2.0, v0.1.0. **No v0.4.0 release exists** |
| "MIT" | ⚠️ **TRUE OF THE TAG ONLY** | `main/LICENSE` read directly: **GNU AFFERO GENERAL PUBLIC LICENSE v3** |

**The repository was relicensed to AGPL-3.0 on `main` AFTER v0.3.0 was tagged, and no
release has been cut since.** So the ecosystem shorthand "MIT up to v0.3.0, AGPL from v0.4.0"
describes a version that **has not been released** — the relicense lives on unreleased `main`.
**`git clone` / "Fork" button today ⇒ AGPL-3.0.** Only `git checkout v0.3.0` is MIT.

## WHY THIS IS NOT A PAPERWORK DETAIL — AGPL §13

I read the licence text. **§13 Remote Network Interaction** is the operative clause:

> *"if you modify the Program, your modified version must prominently offer all users
> interacting with it remotely through a computer network … an opportunity to receive the
> Corresponding Source of your version … at no charge"*

**PLUR.earth is a PWA. Users interact with it over a network. That is §13's trigger
condition, not an edge case.** An AGPL Decimen integrated into the PWA would oblige BNR to
offer the corresponding source of **the modified version** to every user of the app.

**Whether that is acceptable is a founder call, not mine** — BNR ships open source and may
welcome it. **But it must be a DECISION, not a side effect of clicking Fork.**

## THE CONSEQUENCE THE ACTION ITEM HIDES

**If you take the MIT path, the fork is FROZEN AT v0.3.0 PERMANENTLY.**

Every upstream commit after the relicense is AGPL. **Cherry-picking a single upstream bugfix
relicenses the result.** So `decimen-adapter` at v0.3.0-MIT means: **no upstream fixes, ever,
unless BNR accepts AGPL.** For a camera/codec component facing real devices at a live event,
"no upstream fixes" is a maintenance commitment, not a footnote.

**The two honest options, both legitimate:**

| option | cost |
|---|---|
| **A — Pin `v0.3.0` (MIT)** | Fork is frozen. BNR maintains it alone. Attribution obligations still apply (below) |
| **B — Take `main` (AGPL-3.0)** | Upstream stays available; **§13 source-offer obligation attaches to the PWA** |

## ALSO VERIFIED, AND IT SURVIVES EVEN THE MIT PATH

v0.3.0's own release notes: *"License banner baked into every built artifact (JS, CSS, HTML,
standalone files); attribution in the footer and LICENSE."* **MIT requires the notice to
survive into built output** — a bundler step that strips banners is a licence violation, not
a build optimisation. **Whoever does the integration needs to know this before, not after.**

## NOT CHECKED — NAMED, NOT CLAIMED

- **`tongatron/decimen-optical-transfer`** advertises *"arbitrary file transfer, PWA support,
  image optimization."* **Its licence is NOT verified here.** If it forked post-relicense it
  is AGPL, and its PWA work may be the thing that looks most attractive. **L-VERIFY it before
  anyone reaches for it.** (Note v0.3.0 already contains PWA icons/installability, so the
  fork's marginal value needs establishing too.)
- **Everything else in the action list** — "the stack is documented," "the architecture is
  validated," the 420-person event, "Light Mesh" — **is untriaged.** They came with the
  document that is not here.

## DISPOSITION

1. **⛔ HOLD action item 1.** Not because Decimen is bad — it looks genuinely well-built —
   but because **"fork v0.3.0, MIT" and "fork the repo" are different acts with different
   licences**, and the action item conflates them.
2. **Founder/Seat 1 ruling needed: option A or option B.** This is a licence-posture choice
   with a maintenance cost either way; it is not a drafting detail.
3. **The triage remains blocked.** `docs/inbox/PLUREARTH-DRAFT.md` is absent. **The claim
   "architecture is validated" is precisely what triage exists to test, and it arrived
   asserted rather than demonstrated** — which is the reason the triage was commissioned.
4. **No fork made, no crate created, nothing vendored.** Verification only.

## SOURCES

- [`main/LICENSE` — AGPL-3.0, read directly](https://raw.githubusercontent.com/bashalarmistalt/decimen-optical-transfer/main/LICENSE)
- [Releases — v0.3.0 latest, no v0.4.0](https://github.com/bashalarmistalt/decimen-optical-transfer/releases)
- [Repository](https://github.com/bashalarmistalt/decimen-optical-transfer/)
- [Maintained fork (licence UNVERIFIED)](https://github.com/tongatron/decimen-optical-transfer)

---

## ⚖️ RULED 2026-08-13 — HOLD LIFTED (Artist-First Fork Doctrine)

**Seat 1 ruled BOTH paths, which is better than either:** fork **`main` (AGPL-3.0)** for
active development, satisfying **§13 via a public source repo + an in-PWA source link**; keep
**`v0.3.0` (MIT) frozen** on a secondary branch as the cutover if AGPL becomes untenable.
**My hold is lifted — the licence posture is now a decision, which is exactly what the hold
asked for.** The §13 approach is standard and sound, and the frozen branch removes the
"no upstream fixes, ever" cost I flagged.

**⚠ ONE CLAUSE NEEDS COUNSEL, AND IT IS THE OUTBOUND POLICY.** The ruling states artists
*"are not required to open-source their art-money token code — only the transport layer."*
**That is very likely right, and it is not ours to declare.** Copyleft scope is fixed by the
licence and by **how the code is combined**, not by the distributor's policy:
- **Arm's-length separation** — artist code in its own process/bundle, talking to the
  transport over a defined interface — **is the strong position** and matches the intent.
- **Linking artist code into the same binary or JS bundle as AGPL Decimen** is where the
  boundary actually gets tested.

**So the policy is sound as a DESIGN CONSTRAINT — "keep the transport at arm's length" — and
unsafe as a PROMISE TO ARTISTS until counsel confirms it.** State it to artists only with the
`DRAFT-FOR-COUNSEL` tag (SPEC-BLICENSE-0 §8). **You cannot policy your way out of a copyleft
boundary; you can architect your way out, and this architecture plausibly does.**

**Still unverified, unchanged:** `tongatron/decimen-optical-transfer`'s licence, and every
non-licence claim in the action list.
