# RELAY · BNRi OS — WHAT WAS ACTUALLY BUILT, AND WHY IT SAYS "POP"
**From:** Cowork/design seat · **To:** founder + Code · **Date:** 2026-07-19
**Trigger:** founder — *"my BNRi COSMIC desktop build still mentions pop; we need to make sure we actually built something along the lines of BNRi_OS (3).md"*
**Method:** measured on the mount, not recalled. Commands and results in §5.

---

## 1. The finding, plainly

**The OS was never built. Nothing in the kernel repo implements any layer of that spec.**

| Spec calls for | In the repo | Result |
|---|---|---|
| NixOS base — `configuration.nix` IS the system | **zero `.nix` files**, anywhere, any branch, ever committed | **absent** |
| `bnri-cosmic` GUI crate, built `--features gui` | **no such crate**; no `gui` feature in any `Cargo.toml`; zero hits for `libcosmic` | **absent** |
| BNR kernel, "16 crates" | **21 crates** on the mount | **spec is stale** |
| systemd units, hardened_malloc, antnode toggle | no unit files, no provisioning script | **absent** |

**What actually exists is two documents and no code:** the spec `BNRi_OS (3).md`, and a draft `configuration.nix` (dated Jul 15) that lives **only in the uploads folder — it was never landed in the repo and has never been committed on any branch.**

**The spec already predicted this state and named it correctly.** Its own acceptance gate:

> *"Day-1 works" is claimable only after a fresh-install run on real hardware or a clean VM… Until that receipt exists, the status is "recipe drafted," never "image works."*

**Status is "recipe drafted." The gate was never passed, and the gate was right.** No drift here — the document was honest; nothing was ever claimed that wasn't true.

---

## 2. Why it still says "pop" — the actual cause

**COSMIC is System76's desktop environment. System76 makes Pop!_OS, and COSMIC ships as the Pop!_OS default.** So the ordinary way to get COSMIC running is to install Pop!_OS, and you then have COSMIC **on a Pop base.**

**That means layer 1 is right and layer 2 is the gap:**

```
    SPEC                          WHAT'S PROBABLY RUNNING
┌──────────────────┐            ┌──────────────────┐
│  COSMIC GUI      │  ✅ same → │  COSMIC GUI      │
├──────────────────┤            ├──────────────────┤
│  NixOS base      │  ❌ ≠   →  │  Pop!_OS base    │  ← every "pop" string lives here
├──────────────────┤            ├──────────────────┤
│  BNR kernel      │  ❌ not installed              │
└──────────────────┘            └──────────────────┘
```

The `pop` strings are in `/etc/os-release`, the greeter, the boot splash, the apt sources — **base-OS identity, not theming.** They cannot be renamed away, and renaming them would be the exact disease this project spent a week killing: a label asserting something the substrate doesn't support.

**And the swapped layer is the one the spec actually cares about.** Re-read the spec's own justification: *"A stale register can't rebuild Pop!_OS from a ruling you ditched, because the ruling IS the config and the config IS the system."* **Pop is named in that sentence as the thing being moved away from.** The entire argument for NixOS is anti-drift — a Pop base is mutable, apt-installed, and drifts; a Nix base converges to one declarative file. **Running COSMIC on Pop keeps the look and discards the whole reason.**

---

## 3. Diagnostic — three commands, on your machine (I cannot see it from here)

```bash
cat /etc/os-release          # ID= line: "pop" vs "nixos" — this is the answer
echo $XDG_CURRENT_DESKTOP    # confirms COSMIC is the session
ls /etc/nixos/ 2>/dev/null   # exists → NixOS; "No such file" → not NixOS
```

**Paste the output.** `ID=pop` confirms §2 and the path forward is a base swap, not a rename. I am not asserting which one you're on — Law 1d: I have not looked at that machine.

---

## 4. Two defects found while checking

**4a · Naming collision — `BNRi` already means something else in the kernel, and it is load-bearing.**

`BNRi` is an **EVM-layer artifact** throughout the tree: `EventPayload::Bnri`, `BnriEvent`, `TrustedRoot("BNRi firmware")`, `BNRI_GENESIS_V0_UNVERIFIED`, the whole exSAT indexer signature table (`crates/chain-exsat-evm/`, `crates/capability/`). `chain-exsat-evm/README.md` states plainly: *"No BNRi contract exists."*

**So "BNRi" currently denotes an unverified EVM contract whose ABI is explicitly unknown — and the spec reuses the same name for an operating system.** In a codebase whose governing discipline is Law 1d (*assert you are looking at the right thing*), one name for two unrelated artifacts is a defect, not a style question. **Needs a founder ruling: rename the OS, rename the EVM artifact, or namespace both.**

**4b · Spec says 16 crates; the mount has 21.** Minor, but it is the drift class the spec exists to prevent — a document asserting a count it no longer measures. Fix by measuring at build time, never by typing a new number.

---

## 5. What was measured

```
mount: /sessions/.../beehive-nature   HEAD 607ce4a
grep -rniE 'pop!_os|pop_os|pop-os|popos|system76'  (excl target,.git)  → 0 hits
find . -name '*.nix'                                                    → 0 files
git log --all --name-only | grep -iE '\.nix$|cosmic|bnri-os'            → 0 results
grep -rliE 'libcosmic|--features gui'                                   → 0 files
ls crates | wc -l                                                       → 21
```

**Note:** the mount's HEAD reads `607ce4a`. If Code's kernel HEAD differs, the mount is a stale working copy and this check should be re-run against Code's tree before anything is ruled on. **Stated as a caveat, not smoothed over** — a clean grep over the wrong tree is a fail-open, and that pattern has bitten this project before.

---

## 6. Recommendation — do not rename anything

**The gap is a base-OS swap, and the honest options are two:**

1. **Land the spec as written** — NixOS base, `configuration.nix` from uploads committed into the repo, COSMIC on top of Nix. Highest fidelity; the anti-drift argument survives intact. The WSL2 path in §"Can I run it on Windows 11 Pro" is the cheap way to prove the config converges before touching a partition.
2. **Keep the Pop base and amend the spec to say so** — legitimate, but then the NixOS anti-drift rationale is struck from the document rather than left standing over a substrate that doesn't deliver it. **A spec claiming immutability over a mutable base is exactly one more stale register.**

**Either is defensible. Silently running Pop under a document that says NixOS is not** — and that is the only thing here that needs deciding today.

---

*Founder rulings are law; the tree is the oracle. Measured, not recalled — and the one thing I did not measure is said so.*
