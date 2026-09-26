# LICENSE TEXTS — the kernel's AGPL text lands; the README states the ruled split

**Seat:** cloud (claude-lovis). **Date:** 2026-09-26. **Branch:** `claude-lovis/jolly-bell-wetfvb`.
**Founder order:** "you do all the licenses and just tell me if you think something
should be locked for several years."

## What was actually wrong
The ants.tube dispatch (`2026-09-26-ants-tube-shu-reply.md`) called this a "mismatch".
That was a misread. The founder ruled the split on 2026-08-29
(`docs/LICENSING-PROPOSAL-2026-08-29.md`), and the per-path files already follow it:

| path | license | where declared |
|---|---|---|
| kernel crates, `ui/` | AGPL-3.0-only | `Cargo.toml` `[workspace.package]`, `ui/package.json` |
| rails / primitives, SDK edges | Apache-2.0 | root `LICENSE` + `NOTICE` (ruling item 4) |
| `scripts/buzz-meter/` | BSL 1.1, becomes GPL-2.0-or-later on **2030-08-29** | `scripts/buzz-meter/LICENSE` |
| `docs/`, `CONSTITUTION.md` | CC-BY-4.0 | `docs/LICENSING.md` |

**The real defects:**
1. **No AGPL-3.0 text anywhere in the tree**, although the kernel declares
   AGPL-3.0-only (`find -iname '*agpl*'` returned nothing).
2. **README pointed its AGPL badge and "Code: AGPL-3.0-only" line at `./LICENSE`**,
   which holds the Apache text.
3. **`docs/LICENSING.md` still said SDK crates ship "MIT OR Apache-2.0".** The ruling
   retired MIT.

## What changed
- `LICENSES/AGPL-3.0-only.txt`: the SPDX canonical text, fetched from
  `raw.githubusercontent.com/spdx/license-list-data/main/text/AGPL-3.0-only.txt`.
  sha256 `d8a6cc31abc16b6748c7a21f21611f5a1ec33f67d22ca23d7da1c19b95496bee` PUBLIC-CONSTANT
  gnu.org was egress-blocked from this sandbox.
- `README.md`:
  - the badge now reads "AGPL-3.0-only kernel" and links the AGPL text;
  - the License section lists the four ruled regions and where each text lives.
- `docs/LICENSING.md`:
  - "MIT OR Apache-2.0" becomes "Apache-2.0" with the ruling cited;
  - adds a "where each text lives" list.

No license was chosen or changed. Only the wording and file locations were brought
in line with the ruling.

## Locked for several years (what the founder asked to be told)
**Already locked:** `scripts/buzz-meter/` (the meter engine, pricing law and tithe
line) is under BSL 1.1 until **2030-08-29**, then becomes GPL-2.0-or-later. No
other path is time-locked. No new lock is recommended.

## Gates
- `grep -rln "AGPL|LICENSING.md|MIT OR Apache"` over scripts/, e2e/, .github/ and
  tools/ returns nothing, so no test pins the edited wording.
- The pre-commit secret scan runs on commit.
