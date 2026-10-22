# bSAFE firmware build comparison

Run in Linux/WSL, using two sequential fresh checkouts at the **same absolute
build path** on the Linux filesystem. Preserve
existing firmware work. Do not build from the dirty Windows checkout or copy
its untracked files into a release candidate.

For each checkout:

1. Check out the exact revision, detached. Initialize every recursive submodule
   at its gitlink commit. Local repository mirrors are acceptable sources of
   Git objects; do not copy working files, virtualenvs or compiled outputs.
2. Require `git status --porcelain --ignore-submodules=none` to be empty and
   every line of `git submodule status --recursive` to begin with a space.
3. Run `nix-shell --run 'uv sync --frozen'` using the pinned shell.nix.
4. Export `CFLAGS="-ffile-prefix-map=$PWD=/build/bsafe"` to remove absolute
   checkout paths from C assertions, then run
   `nix-shell --run 'uv run --frozen xtask build firmware --model T3W1 --pyopt true'`.
   Save stdout/stderr and the exit code separately for each build. This is
   universal **development** firmware, not production signing authority.
5. Record Rust, Cargo, ARM GCC, uv and Python versions. Preserve shell.nix,
   lockfiles, source revision and recursive submodule pins with the receipt.

`bash tools/firmware/build-pinned.sh CHECKOUT FULL_COMMIT` enforces those source
checks, refuses an existing build directory, and runs the dependency/build
commands with the path mapping. After the first build, move its entire checkout
to a separate evidence directory. Create a fresh clone at the original build
path, initialize its dependencies and run again. Retain both completed checkouts
for comparison. Do not reuse their target directories or virtualenvs. The fixed
path is necessary because Cargo package identities can affect Rust constant
placement even after C assertion paths are remapped.
This is a same-host Nix-pinned build recipe, not a hermetic container claim.

Example comparison (replace REV with the full source commit):

```sh
python3 tools/firmware/compare-builds.py /path/build-a /path/build-b \
  --revision REV \
  --artifact core/build-xtask/artifacts/T3W1/firmware.bin \
  --receipt /path/outside-checkouts/comparison.json
```

Choose actual final firmware artifacts from the build output; do not substitute
an intermediate ELF, a cached binary or the same checkout twice. Inspect the
resulting configuration for debuglink, vendor header and signing policy before
considering installation. Matching bytes prove only the recorded repeat-build
comparison: not independent reproducibility, firmware safety, PQ user signing,
physical-device behavior, or authorization to flash.

The comparison tool exits nonzero for dirty/wrong source, unresolved submodules,
missing/empty artifacts, or unequal bytes. It writes a negative receipt on
failure. It does not run builds or certify that supplied artifacts came from
the checked-out sources; that evidence belongs in the accompanying build logs.
