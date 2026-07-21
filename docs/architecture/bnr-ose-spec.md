# BNR OSe — reproducibility constraints (ruled)

**Status:** the committed home for the constraints ruled in RELAY_19 (2026-07-19).
The full OS recipe still lives outside the tree; what is captured here is the
part that is **ratified law**, so it is not lost with the correspondence that
produced it. Names ruled the same day: **`BNR OSe`** is the environment,
**`BNRi`** stays the EVM-layer artifact, and the GUI crate is **`bnr-shell`**
(not `bnri-cosmic` — `bnri` is reserved and `cosmic` is a vendor name in a
permanent artifact).

---

## 1. The base is deferred; the reproducibility requirement is not

**Ruled (RELAY_19 §6a, Reading A):**

- **Pop!_OS is the DEVELOPMENT reference** — build and test the shell on it
  today, on the machine that already runs COSMIC.
- **The shipped-image base is DEFERRED, not decided** — revisited when there is
  an image to ship, at which point COSMIC-on-Nix maturity is knowable and a
  shell exists to test on both.
- **The reproducibility requirement SURVIVES the deferral.** This is the
  load-bearing constraint and it stays on the board regardless of which base
  ships:

  > **Whatever base ships must be either _derivable_ (NixOS: the image rebuilds
  > from one `configuration.nix` at a pinned nixpkgs revision) or
  > _digest-reproducible_ (a pinned build manifest — apt sources and package
  > versions — plus a published build script and a digest of the resulting
  > image). Not "trust the person who built it."**

**Why it cannot quietly evaporate because the base changed:** a project whose
thesis is "verifiable, reproducible, no trusted authority" cannot ship an OS
image that must be taken on trust. That is the same contradiction as a
subscriber-only price benchmark or a COA with a blank cell — **Tier R applied
to the substrate the surfaces run on.** A non-derivable image is a defect the
new base has to answer, not a shrug.

## 2. Negative control — the shell stays base-agnostic from line one

**Binding on `bnr-shell` from the first commit:** it is an ordinary Rust crate
against `libcosmic`, carrying **no base-specific coupling.** That absence is
exactly what makes the base deferral free.

> **Negative control: any Pop / apt / System76-specific dependency in
> `bnr-shell` → fail.**

## 3. The config gate is itself reproducible (the durable technical facts)

The draft `configuration.nix` in uploads **was written and never evaluated**,
and contained two option names that do not exist. Article IV applied to our own
artifacts: documentation is provisional, a passing build is a fact. The
corrected, evaluable form:

```nix
# not services.cosmic-greeter.enable / programs.cosmic-desktop.enable — neither exists
services.displayManager.cosmic-greeter.enable = true;
services.desktopManager.cosmic.enable        = true;
```

- **Pin the channel to NixOS 25.05 or later** — the `desktopManager.cosmic` /
  `displayManager.cosmic-greeter` modules landed in 25.05; earlier channels
  carry the packages without the integration modules.
- **Prove it in WSL2 before any partition:** `nixos-rebuild dry-build` must
  *evaluate*, then install NixOS-WSL and confirm convergence. WSL2 is the
  **config gate** (evaluation + package resolution); bare metal is the
  **session gate** (WSLg's rendering path is not the bare-metal one). Receipt =
  the logged run, pasted.
- **Pin the nixpkgs revision and record the digest** so a broken COSMIC update
  rolls back to a generation that worked — the property Pop cannot offer, which
  partly cancels the COSMIC-on-Nix immaturity risk.

## 4. The day-1 gate — unchanged, do not soften

A build is "image works," never merely "recipe drafted," only after a
fresh-install run on real hardware or a clean VM: **GUI opens themed · kernel
unit green · sidecar answers one inference · toggle starts and stops one
antnode.** Receipt = the logged run, pasted. Until that receipt exists the
status is "recipe drafted."

---

*The base is packaging; the shell is the build. Whatever ships must be
derivable or digest-reproducible — reproducible by a stranger beats convenient,
applied to the machine the surfaces run on.*
