# Seat 3 · compile-gate verification of `RELAY_BNRi_OS_build_state_check.md`

From: Code / Seat 3 (compile gate) · To: founder + Cowork · Date: 2026-07-19
Method: measured first-hand against the **oracle** (`origin/main`), not the mount, not recall.
Status: DRAFT on the mount, un-landed — see §H for why it is not pushed.

## Verdict in one line

Cowork is **right** about the NixOS gap and the `BNRi` naming collision; **wrong, by its own
Law 1d,** about "no libcosmic / no gui feature" (it never opened `bnri-cosmic`); **mis-grounded**
on "why pop"; and **the crate-count finding is worse than it said and caught it too** — because
Cowork's mount *and my own first local read* were both the same stale commit, and neither was
the oracle.

## A · The stale-copy trap — both readings were the wrong tree

The relay's §5 asked Code to re-run "if Code's kernel HEAD differs from the mount." It did not
differ — and that was the trap. Both were `607ce4a`. But `607ce4a` is **not** `origin/main`:

| tree | HEAD | crates |
|---|---|---|
| Cowork's mount | `607ce4a` | 21 |
| my local checkout (as found) | `607ce4a` | 21 |
| **`origin/main` — the oracle** | **`ecc9af8`** (15 commits ahead) | **26** |

Two working copies pinned at the same stale commit agree with **each other**, not with the
oracle. The §5 test ("does Code's HEAD match the mount's?") passed while the real question
("does either match origin?") failed. The oracle is 15 commits ahead — carrying D-14
(`denomination`), C-4 (`language-authority`), the decentralization ladder, Law 1d itself, plus
`adapter-lti`, `mastery-ledger`, `type-bindings`. **Trust the repo, not any working copy's
head** — including mine.

## B · The tree Cowork did not open — `bnri-cosmic` builds the COSMIC layer

`C:\Users\travi\bnri-cosmic` · remote `github.com/beehive-nature/bnri-cosmic` · HEAD `b6db04a`.

```
Cargo.toml: description = "BNRi inscription explorer + bLOVErAi interface — COSMIC desktop app"
Cargo.toml: gui = ["dep:libcosmic", "wgpu"]           # the gui feature Cowork said exists nowhere
Cargo.toml: libcosmic = { git = "https://github.com/pop-os/libcosmic", rev = "511384f…" }
src/main.rs: "Built on libcosmic (Rust GUI toolkit by System76/COSMIC)"
```

"No gui feature / zero libcosmic" is **true of the kernel and false of the project.** The COSMIC
**app** is built — rev-pinned, feature-gated. What is NOT built is the **NixOS base** (§C).

## C · Corrected layer picture

```
SPEC (BNRi_OS)                 WHAT ACTUALLY EXISTS, MEASURED ON THE ORACLE
┌───────────────┐             ┌──────────────────────────────────────────────┐
│  COSMIC GUI   │  BUILT   →  │ bnri-cosmic — desktop APP, `--features gui`,   │
│               │             │ pop-os/libcosmic rev 511384f. A client of the  │
│               │             │ kernel; honest that it is an app, not an OS.   │
├───────────────┤             ├──────────────────────────────────────────────┤
│  NixOS base   │  NOT BUILT →│ nothing. 0 .nix in EITHER repo, at the oracle  │
│               │             │ head too. The one configuration.nix draft      │
│               │             │ lives only in ~/Downloads-uploads, uncommitted.│
├───────────────┤             ├──────────────────────────────────────────────┤
│  BNR kernel   │  EXISTS   → │ beehive-nature — 26 crates on origin/main, as  │
│  (installed)  │  not as OS  │ a repo, NOT an installed/booted system.        │
└───────────────┘             └──────────────────────────────────────────────┘
```

The real gap is the **NixOS integration layer** binding app + kernel into one bootable,
declarative system. An app plus a library-workspace is not yet an OS. The relay's acceptance
gate ("recipe drafted, never image works") was never passed — and it was right to say so.

## D · Why it says "pop" — measured, and not what the relay assumed

The relay theorised base-OS identity (`/etc/os-release`, greeter, apt) on a machine nobody
measured. In the build the founder was looking at, all 44 pop strings in `bnri-cosmic` are:

```
· pop-os/* dependency SOURCE URLs in Cargo.lock — libcosmic, winit, window_clipboard,
  softbuffer, smithay-clipboard, freedesktop-icons, dbus-settings-bindings
· System76/COSMIC attribution comments (Cargo.toml, src/main.rs)
· one apt hint: README "Install build deps (Pop!_OS / Ubuntu)"
Zero are base-OS identity strings.
```

**`pop-os` is the GitHub org where System76 develops COSMIC.** `libcosmic` *is*
`github.com/pop-os/libcosmic`. You cannot depend on COSMIC without depending on `pop-os/*`; this
pop is correct, load-bearing, **unremovable** — deleting it deletes COSMIC. It is the toolkit's
return address, not a Pop!_OS base leak.

Two different "pop"s, do not conflate:
1. **In the build (measured):** `pop-os/libcosmic` upstream coordinates — correct, keep.
2. **On the machine (unmeasured):** IF the founder installed Pop!_OS to obtain COSMIC, then
   `/etc/os-release` says `pop`. The relay's three commands (`cat /etc/os-release`,
   `echo $XDG_CURRENT_DESKTOP`, `ls /etc/nixos/`) settle that; only the founder can run them.

## E · §4a confirmed and sharpened — the collision is the *spec's* name

`BNRi` is unambiguously the EVM inscription artifact in the kernel (`EventPayload::Bnri`,
`BnriEvent`, `BNRI_GENESIS_V0_UNVERIFIED`, ten founder-settled `Bnri*` `EventType` variants, the
`chain-exsat-evm` signature table). **Already adjudicated** — `docs/CD-29…md` U-12 corrected a
prior draft claiming "grep returns nothing," ruling BNRi *is* named here and that only the BNRi
*contract* is unverified ("No BNRi contract exists").

Sharper: the app repo `bnri-cosmic` is the "BNRi inscription **explorer**" — named *about*
BNRi-the-artifact, so **consistent**, not colliding. The collision is the **spec naming the
whole OS "BNRi OS,"** overloading `BNRi` from "an EVM artifact" to "an operating system." The
ruling needed is narrow: rename the **OS spec**, not the artifact and not the app.

## F · §4b confirmed and enlarged — 26 crates; the count has drifted twice

The oracle has **26** crates. The drift is a chain: the spec/README say **16**; both stale
mounts read **21**; the oracle is **26**. The "16" I can locate sits in `bnri-cosmic/README.md`
lines 37 and 132 ("16 crates, 324/0/1 tests") — a tree I own. That same line carries a second
count ("324/0/1 tests") I have NOT measured and will not assert stale. Fix any count by
measuring at build time, never by typing a new number — which is the whole point, since typed
numbers are exactly what drifted 16→21→26.

## G · Founder rulings that remain

- **Base-OS direction:** land NixOS (commit `configuration.nix`, the WSL2 converge-proof first)
  vs amend the spec to a Pop base and strike the anti-drift rationale. Either is defensible;
  running Pop silently under a doc that says NixOS is not.
- **The `BNRi OS` name collision** (§E) — rename the OS spec / namespace it / accept with a note.

## H · What I did NOT do, and why

- **No `.nix`, no OS build, no rename** — founder rulings, not compile-gate actions.
- **No edit to `bnri-cosmic/README.md`** — the 16→26 fix is one line in a tree I own, but it is
  out of any current order, the same line has an unmeasured second count, and editing another
  surface unilaterally during a constitutional reassessment is the moving-fast-past-things
  pattern that reassessment exists to catch.
- **This receipt is NOT pushed.** The mount it sits on is stale (`607ce4a`) and holds the
  founder's un-committed relay files and a locally-modified `docs/fusd-peg-monitor.md`; pushing
  from here would disturb the mount and I will not do that under the freeze. Cowork's report is
  itself an un-committed mount relay file, so the error it contains is not in the durable tree —
  a chat/relay correction is symmetric with how it arrived. If you want this durable, I will
  land it cleanly from a fresh checkout of `origin/main`, on your word.

Founder rulings are law; the tree is the oracle. Measured against the oracle, not the mount —
and the machine I did not measure is said so.
