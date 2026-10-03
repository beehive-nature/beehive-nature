# bSAFE reproducible-build gate

2026-10-02 (America/Denver). This lane builds without hardware integration.
No device enumeration, flashing, signing ceremony, payment or upload occurred.

**Measured result: the fixed-path baseline's firmware, kernel and secure-monitor
binaries matched byte for byte across two fresh compilations.** This passes the
recorded baseline comparison, not the newer incomplete source release or a
hardware-integration gate. The committed receipt records artifact hashes and
submodule pins.

## Source selection

The newer local firmware commit `9330ef0607658a41eaa97c8e473b65e80844c23b`
is not a complete source release. `core/embed/rtl/build.rs` and
`core/SConscript.firmware` reference `crypto/zano/clsag_ggx.c` and
`crypto/zano/zano_generators.c`, which are absent from its Git tree. They exist
as untracked work in the original checkout. That work was not imported,
modified or committed. A successful build in that dirty checkout would not
establish reproducibility of this commit.

The measured baseline is the published **beehive branch**, commit
`4524b956222e81d1c1073ce74f0e362bae758bbf`, firmware version 2.12.4.
It is an older source baseline, not the newer Zano work and not current upstream.
The upstream/security reconciliation from the preceding audit remains open.

Two isolated Linux checkouts were used: `/home/travi/wt-bsafe-baseline-a` and
`/home/travi/wt-bsafe-baseline-b`. Git objects came from the existing clean
Linux mirror; recursive submodules were checked out at recorded gitlinks.
Source and submodule cleanliness are checked by the comparison tool. No
compiled firmware was copied between build directories.

An attempted clone from the Windows partial repository failed with
`lazy fetching disabled; some objects may not be available` and `early EOF`.
The 13 newer commits were instead transferred to a separate inspection clone
through a Git bundle. Docker was not used: its socket returned permission
denied. Nix was already available. An early dependency sync before submodule
initialization failed on missing ts-tvl metadata; it passed after initialization.
These failed preparation attempts are not successful builds.

## Initial failure and correction

Both initial T3W1 builds exited 0 and produced 2,352,128-byte firmware images,
but their bytes differed. `comparison-initial.json` records the failed gate.
The images differed in 371 byte positions. The uncompressed secure monitor
differed in 98 positions: hashes/signature plus two absolute checkout-path
characters in C assertion strings. The kernel binary was byte-identical.

The first correction is build configuration, not a cryptographic source change:

```sh
export CFLAGS="-ffile-prefix-map=$PWD=/build/bsafe"
nix-shell --run 'uv run --frozen xtask build firmware --model T3W1 --pyopt true'
```

Initial build directories were moved outside each checkout and retained.
The corrected runs start with empty `core/build-xtask` directories. The
same path mapping is applied in each checkout. This made both secure-monitor
binaries match, but the final firmware still differed. The firmware embeds a
prebuilt bootloader and the newly built kernel; it does not embed this newly
built secure-monitor binary. The secure-monitor difference was a separate
reproducibility defect, not the cause of the final firmware mismatch.

The second difference is Rust constant placement: both Cargo package/object
identities and placement of a `25519` string differ between checkout paths.
The final recipe therefore fixes the absolute build path too. Two sequential,
fresh clones are built at `/home/travi/bsafe-canonical-build`, then moved to
`/home/travi/bsafe-canonical-run-1` and `-2` for comparison. Neither target
directory nor virtualenv is copied into the second clone. This explicit path
constraint replaces a claim of path-independent builds. See the final receipt
for the outcome; failed comparisons are retained rather than waived.

The first fixed-path wrapper exited 0. The second completed firmware generation
and validation but then exited 1: the wrapper had been edited while Bash was
executing it, causing a trailing quote parse error after the build command.
The binary comparison already passed at that point. The wrapper was syntax
checked again and the build command rerun directly; its outcome is retained in
`canonical-2-confirm.log`: exit 0, followed by another successful three-artifact
comparison. This handling error is not concealed as a clean
wrapper run. Do not edit build scripts while they are executing.

## Toolchain and scope

- shell.nix pins nixpkgs `59682e0069f0ed0a452e2179a7f4c1f247027b9e`
  and rust-overlay `f600ea449c7b5bb596fa1cf21c871cc5b9e31316` with content hashes.
- Rust 1.96.0-nightly (`1e2183119`, 2026-03-15); Cargo 1.96.0-nightly
  (`cbb9bb8bd`, 2026-03-13).
- ARM GNU Toolchain 13.3.Rel1 / GCC 13.3.1; uv 0.11.26; Python 3.14.6;
  Nix 2.35.1.
- `uv sync --frozen`; T3W1; universal firmware; pyopt true; development keys.
- Resolved build commands do not include debuglink. Firmware's own inspection
  reports DEVEL signatures and valid hashes; that is not production authority.

This is a same-host, separately compiled repeat-build comparison using pinned
Nix inputs and source locks, not an independent-builder or hermetic-container
attestation. Matching development images do not authorize installation or prove
PQ user signing, recovery, secure-element behavior or safety of the fork.

## Reusable gates and evidence

`tools/firmware/build-pinned.sh` refuses dirty/wrong source, unresolved
submodules and existing build directories. `tools/firmware/compare-builds.py`
checks source/submodule pins and artifact equality, writes a negative receipt
on failure, and never reports hardware acceptance. Its self-comparison,
missing-artifact and deliberately unequal-artifact controls each refused as
expected. `bash -n` and `git diff --check` validate the wrapper/change syntax.
The build wrapper also refused a deliberately wrong revision and an existing
build directory. These controls exercised refusals without rebuilding or
modifying firmware inputs.

Full local logs, binaries, toolchain and submodule list live in
`C:/Users/travi/bsafe-build-20261002/`. Public binary hashes in receipts are
PUBLIC-CONSTANT values. The original firmware work and seven genealogy
screenshot artifacts remain separate from this lane.
The compact committed receipt is
`docs/receipts/bsafe-build-baseline-2026-10-02.json`; it records the initial
failure, wrapper error, confirmation exit, source pins and final artifact hashes.

Upstream priority: #622's latest comment still routes the remaining public-mesh
measurement work to x0x #504. This build is not new mesh field evidence.
During this lane, the founder supplied an updated release trigger. Fresh GitHub
API checks confirmed annotated v0.46.0 resolves to
`cea64f20eddc3d8c71cfe4fba7464d3f137eb5c4`; its Cargo.toml pins the
saorsa-gossip components to `=0.5.86`. The release-by-tag endpoint still returned
404. Source trigger met; signed release assets and their SHA256/GPG provenance
run remain unverified. An annotated tag is not itself proof of signed assets.
