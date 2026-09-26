# LICENSE MISMATCH: root `LICENSE` is Apache-2.0, README says AGPL-3.0-only, and no single ruling settles it

**Seat:** cloud (claude-lovis). **Date:** 2026-09-26. **Branch:** `claude-lovis/brave-brahmagupta-0h2oac`.
**Base:** `origin/main` @ `2fb2052b`.
**Trigger:** `docs/dispatches/2026-09-26-ants-tube-shu-reply.md` (branch
`claude-lovis/jolly-bell-wetfvb`, item 5). It gates any offer of client code
(bViEw pieces) on this mismatch.
**Also open since:** `2026-09-06-astra-stack-audit.md`, "P2 — license and
production-readiness boundaries need an explicit matrix — OPEN".

## Verdict

I found no recorded ruling that decides which license the root `LICENSE` file
carries for code outside the two 2026-08-29 manifests. Two recorded decisions
collide at that one file:

- **2026-07-04:** kernel AGPL-3.0-only.
- **2026-08-29 (FOUNDER RULING):** Apache-2.0 on the rails and BSL 1.1 on the
  moat, with every other path "UNCLASSIFIED".

**Nothing was relicensed in this lane.** This dispatch is the only file changed.
The founder question and a fix prepared for each possible answer follow.

## The record, in order (receipts)

| when | commit | what it recorded |
|---|---|---|
| 2026-07-02 | `8797d662` | Initial commit. The workspace carries `MIT OR Apache-2.0` as a placeholder, and the README says "Choose one before publishing." |
| 2026-07-04 06:15 | `d0757bb4` | *"chore: licensing - AGPL-3.0-only kernel, DCO (no CLA), CC-BY-4.0 docs."* Root `LICENSE` becomes the AGPL-3.0 text, 34,523 bytes; the message says "fetched byte-exact from gnu.org". The workspace `license` becomes `AGPL-3.0-only`. The same commit writes the README badge and prose, `docs/LICENSING.md`, `DCO` and `CONTRIBUTING.md`. It is authored under the founder identity and co-authored by a seat. **It carries no FOUNDER RULING tag.** |
| 2026-07-04 06:54 | `d94cd579` | The repo is flipped public "on the founder's direct instruction". `STATUS.md:849-850` banks "licensing structural (AGPL-3.0-only / DCO / CC-BY-4.0)". |
| 2026-07-07 | tag `kernel-v0.1.0` → `590832d1` | "First kernel release tag — cut for first out-of-tree consumer (skaists/LOVErnment-DAO genesis)". **That tree's `LICENSE` is the AGPL text.** |
| 2026-07-17 | `270490fc` | `crates/type-bindings` lands as `MIT OR Apache-2.0`, **"Founder-directed"**, described as "the FIRST permissive crate in this AGPL workspace". This founder-directed act presumes the AGPL kernel. |
| 2026-08-20 | `6abe66f3`, `1e9fe302` | The Base Batches grant drafts describe the project to an external program as "open source (AGPL)". See `docs/grants/APPLICATION_BASE_BATCHES_004.md:16` and `BASE_BATCHES_SUBMISSION_KIT.md:62,88`. The application's own status line is "DRAFT for the founder's word"; whether anything was submitted is not recorded in the tree. |
| 2026-08-29 01:47 | `c23e8763` | Licensing proposal at the founder's "go full speed". Templates are named `LICENSE-*.txt` "so GitHub auto-apply cannot fire". Its checklist says: *"recommended: leave root unset, carry per-directory LICENSE files so the split is enforced by path."* |
| 2026-08-29 02:00 | `dcf8ba04` | Staged at **"the founder's four-value ruling"**: Licensor, Change Date, Change License, and **Rails = Apache-2.0**. **The same commit overwrites root `LICENSE`, AGPL → Apache**, recorded only as "files named for GitHub recognition — root LICENSE (Apache badge)". This departs from the proposal's own recommendation 13 minutes earlier. **Neither the message, the proposal nor `NOTICE` mentions AGPL or the kernel.** |
| 2026-08-29 02:19 | `9472df64` | **LICENSE PUBLISH.** The founder ruled: "push and start the 4-year BSL clock now". The message lists "root LICENSE + NOTICE + directory LICENSE + headers all in place". |
| 2026-09-06 | `2026-09-06-astra-stack-audit.md:201-213` | The same mismatch is logged as OPEN: "Closure needs the existing L-VERIFY procedure and a path/component/source/deployment matrix, **not a mass LICENSE replacement**." |
| 2026-09-26 | `df4038bd` (unmerged) | The ants.tube dispatch gates the client-code offer on this. |

**Searched, and found nothing further:**
- `git log --all -i --grep=AGPL` over the full history (2,146 commits on main, with the clone unshallowed first).
- A grep over `docs/` for FOUNDER RULING, ORDER or DECISION within 200 characters of licen, AGPL, Apache, BSL or BUSL. The only hits were the 08-29 proposal and the Astra audit.
- `docs/specs/SPEC-BLICENSE-0.md`. It covers the artist-licensing program, not repo licensing.

## What the tree says today (HEAD `2fb2052b`)

| where | says |
|---|---|
| `LICENSE` | **Apache-2.0**, byte-identical to `apache.org/licenses/LICENSE-2.0.txt` (11,358 bytes, fetched and compared with `cmp` this session) |
| `NOTICE` | Apache-2.0 for 7 named surfaces and BSL for `scripts/buzz-meter/`; *"No path outside the two manifests above is licensed by this NOTICE; unclassified paths await a later founder ruling."* |
| `README.md:11` | Badge "license: AGPL-3.0-only" linking to `./LICENSE`, which holds the Apache text |
| `README.md:126` | "Code: **AGPL-3.0-only**", with the word LICENSE linked to `./LICENSE` |
| `docs/LICENSING.md` | AGPL-3.0-only kernel (anti-capture, "-only"); SDK edges ship `MIT OR Apache-2.0` "when split out". No mention of the rails or the BSL. |
| `CONTRIBUTING.md:7` | Contributions are submitted "under this repository's license". Which license that is remains the open question. |
| Cargo (`cargo metadata --no-deps --offline`, 56 workspace packages) | **50 `AGPL-3.0-only`**; 2 `MIT OR Apache-2.0` (`type-bindings`, `reversibility`); 1 `Apache-2.0` (`headroom-textcrusher`, vendored); **3 with no license field** (`voucher-escrow`, `bmesh-ram`, `bmesh-serve`) |
| Outside the workspace | `forge/crates/buzz-gain` AGPL-3.0-only; `ops/ant-writedoor` and `ops/x402-door` MIT; `ui/package.json` AGPL-3.0-only |
| SPDX headers | **20 code files `AGPL-3.0-only`**: `ui/` ×17, `crates/inscription-gate{,-wasm}/src/lib.rs`, `surfaces/blight/fleet.js`. **8 `Apache-2.0`** (`surfaces/`). **18 `BUSL-1.1`** (see drift item 2). |
| AGPL text | **No copy anywhere in the HEAD tree.** The only hit is a quoted excerpt in `docs/register/LVERIFY-DECIMEN-2026-08-13.md`. |
| Our own pages | `surfaces/stack.html:326` says "/LICENSE (Apache-2.0, repo root)". `surfaces/fieldnotes.html:89` links `/LICENSE` as "the rails, Apache". All 8 Apache headers say "See /LICENSE and /NOTICE in this repository." |

**Our own law reads us as Apache.** L-VERIFY (founder order, 2026-07-24,
`docs/ledger/pirate-haul-rulings.md:11`) says: "verify the LICENSE file IN THE
REPO TREE, not the GitHub sidebar label". An outside auditor applying that law to
this repo reads Apache-2.0 at the root, while our README badge says AGPL.

## Why neither record settles it

- **The July AGPL** was recorded once and relied on repeatedly: the release tag,
  the founder-directed `type-bindings` premise, the public-flip ledger, the grant
  kit and 50 manifests. But its text carries no FOUNDER RULING tag. It is a
  seat-co-authored `chore:` commit.
- **The August ruling** is an explicit FOUNDER RULING, but by its own words it
  covers only the rails and moat manifests. It says: "no default license is
  implied for any path not listed above". Putting the Apache text at the root was
  a staging choice, and the founder's publish commit then ratified the staged set
  of files. So the root Apache file is part of a published founder gesture.
- **The contradiction:** the `NOTICE` published in that same gesture disclaims any
  license for non-manifest paths. That contradicts the README's "Code:
  AGPL-3.0-only".
- **What is ruled:** the rails (Apache-2.0), the moat (BSL 1.1 → GPL-2.0-or-later
  on 2030-08-29), the Licensor, and the Change Date.
- **What is not ruled, in any record I found:**
  - (1) whether AGPL-3.0-only still governs the kernel after 08-29;
  - (2) whether the root `LICENSE` is the kernel's license or only the rails'
    carrier.

Per AGENTS.md, FOUNDER RULING laws are not relitigable, so **the four 08-29
values stand under every answer below.** Only (1) and (2) are open.

## THE QUESTION FOR THE FOUNDER

> **Does every code path outside the Apache rails manifest and the BSL moat stay
> AGPL-3.0-only? And which text does the root `LICENSE` file carry?**

- **(A) Kernel stays AGPL-3.0-only, and root `LICENSE` carries the AGPL text.**
  - The rails stay Apache-2.0 through their headers and `NOTICE`. The Apache text
    moves to a non-root path.
  - Matches README, `LICENSING.md`, `CONTRIBUTING.md`, 50 manifests, 20 headers,
    `kernel-v0.1.0`, the grant drafts, and the 08-29 proposal's own "leave root
    unset" recommendation.
  - Cost: GitHub's sidebar will show AGPL, and the rails remain Apache by header
    and `NOTICE`.
- **(B) Apache-2.0 becomes the repo-wide default, and root stays as it is.** This
  relicenses the kernel away from AGPL. It touches:
  - 50 manifests and 20 headers;
  - the README;
  - `LICENSING.md`, whose anti-capture and "-only" rationale is retired;
  - a correction to the grant drafts' "open source (AGPL)".

  Facts relevant to the DCO "consent of all copyright holders" design:
  - Every commit on main since 08-29 is authored as `loVis waTer` (780),
    `Travis Remington` (135) or the seat `zCode` (5).
  - The tree already distributed with the AGPL text (e.g. `kernel-v0.1.0`) keeps
    the text it shipped with.
  - How relicensing interacts with the DCO, and with copies already distributed
    under AGPL, is a counsel question. I am not a lawyer.
- **(C) The literal `NOTICE`: non-manifest paths stay unlicensed until
  classified.** README, `LICENSING.md` and the 50 manifest declarations would have
  to be withdrawn or marked pending. This is listed only because the published
  `NOTICE` says it, and it contradicts everything else in the table above.

**Seat recommendation: (A).** It has the most recorded support, the smallest
diff, and leaves the 08-29 four values untouched. It is also what the 08-29
proposal recommended before the staging commit. This is a recommendation, not a
ruling, and nothing has been applied.

## Unblocking ants.tube without waiting on the whole question

The ants.tube offer is fresh client-only code: a `MediaCapabilities.decodingInfo()`
precheck plus a live MB/s meter. That is the rails pattern: `LICENSING.md` says
"an app talking to the network is the builder's own". `surfaces/bview.html`
carries no SPDX header and appears in neither manifest, so it is "unclassified"
under `NOTICE` and AGPL under the README.

**A narrower founder word unblocks this under A, B or C:** *"the extracted
precheck/meter snippet joins the Apache-2.0 rails manifest"*. The mechanics are
the same shape as `surfaces/adapter-seam.js`: an SPDX header plus one `NOTICE`
line. It stays gated on ants.tube's invitation, as that dispatch says.

## Prepared fix per answer (not applied; the commit is the founder's word away)

### If (A)
```sh
mkdir -p LICENSES
git mv LICENSE LICENSES/Apache-2.0.txt   # the ruled rails text, unchanged bytes
git show d0757bb4:LICENSE > LICENSE      # AGPL-3.0 text as committed 2026-07-04
```
- **Re-verify the AGPL text first.** It is 34,523 bytes. The commit claims
  "byte-exact from gnu.org", but that is **not re-verified this session**:
  `gnu.org` CONNECT was refused 403 by the sandbox proxy. Compare it on a seat
  that has network access.
- **Repoint "See /LICENSE":**
  - the 8 Apache headers (`wallet.html`, `adapter-seam.js`, `arweave.js`,
    `wallet-adapter-{vaulta,hive,solana,bitcoin,arweave}.js`);
  - `stack.html:326`;
  - `fieldnotes.html:89`.

  Point them to `/LICENSES/Apache-2.0.txt`. Those two pages are surfaces, so run
  `estate-check` and `university-smoke`.
- **`NOTICE`:** point the Apache paragraph at the new path and add "All other code:
  AGPL-3.0-only (`LICENSE`)".
- **README and `LICENSING.md`:** add one line each saying the rails are Apache-2.0
  (`NOTICE`) and `scripts/buzz-meter/` is BSL 1.1. Both are silent on this today.
- **`LICENSING-PROPOSAL-2026-08-29.md`:** add a dated amendment note. Do not
  rewrite what was published.
- **Per-package license files.** These materialize licenses the manifests already
  declare; they pick nothing new:
  - `crates/type-bindings/`, `crates/reversibility/`: `LICENSE-MIT` and
    `LICENSE-APACHE`. The MIT copyright line follows the 08-29 holder form,
    "Travis Mark Remington <lovis@skaists.dev>".
  - `ops/ant-writedoor/`, `ops/x402-door/`: `LICENSE` (MIT).
  - `crates/headroom-textcrusher/`: the **upstream** `LICENSE` and `NOTICE` from
    `chopratejas/headroom` @ `e59cf101`, read at source under L-VERIFY. They were
    not fetched here because that repo is outside this session's scope.

### If (B)
- Change the workspace license at `Cargo.toml:70`, and the 5 explicit
  `license = "AGPL-3.0-only"` lines (`inscription-gate`, `inscription-gate-wasm`,
  `bnr-keys`, `bnr-archive`, `forge/crates/buzz-gain`).
- Change `ui/package.json`.
- Change the 20 AGPL SPDX headers.
- Update the README badge and prose, and rewrite `LICENSING.md`.
- Widen `NOTICE`, and add a correction note to the grant drafts.
- The per-package files from (A) are still worth adding.

### If (C)
- Change the README badge and prose and `LICENSING.md` to "pending
  classification". Mark the 50 AGPL manifest declarations pending, or leave them
  for the classification pass.
- Add a scope note beside root `LICENSE` saying it carries the rails text only.

## Drift found in this lane (any answer; the founder or a lawyer sorts it)

1. **The rails manifest has four versions:**
   - the proposal and the `stack.html` panel list 5 files;
   - `NOTICE` lists 7 (it adds `wallet-adapter-solana.js` and `-bitcoin.js`);
   - the SPDX headers cover 8. `surfaces/adapter-seam.js` gained an Apache header
     on 2026-09-20 in `8d187793` but is not in `NOTICE`.
2. **The BSL Licensed Work lists 5 paths**: `meter.py`,
   `voucher_escrow.py` + `test_voucher_escrow.py`, `rate_set.json` and `gate.js`.
   But 18 files carry `BUSL-1.1` headers. Unlisted inside the directory:
   - `x402_meter.py`, `test_x402_meter.py`
   - `test_av3..6_*.py`, `test_serve_bridge.py`

   Outside the directory, pointing at "same LICENSE in scripts/buzz-meter/":
   - `scripts/audit-human-gas.mjs`, `scripts/inv1-bpay-invoice.mjs`
   - `scripts/lib/recon-reconcile.mjs`
   - `scripts/recon1-primitive.mjs`, `scripts/recon1-oracle-verify.mjs`
   - `scripts/fixtures/recon1-seductive.mjs`, `scripts/funnel/broadcast.mjs`

   Whether to widen the Licensed Work is a Licensor question.
3. **`crates/voucher-escrow`** describes itself as "(moat, BUSL-1.1)" but has no
   license field and no header. Under (A) it would fall into the AGPL default
   unless it is classified. `bmesh-ram` and `bmesh-serve` also have no license
   field.
4. **`crates/headroom-textcrusher`** is vendored Apache-2.0 without the upstream
   `LICENSE` or `NOTICE` in-crate. Today the root Apache text happens to cover the
   license-copy leg; under (A) it would not. See the per-package line above.
5. **No AGPL text exists in the tree at HEAD**, while 50 manifests and 20 headers
   declare AGPL-3.0-only.

## Gates and receipts

- **Files changed:** only this dispatch. No license text, manifest, header, README
  or surface was touched.
- **Staging:** added by explicit pathspec. The pre-commit hook was wired with
  `sh scripts/install-hooks.sh` before committing. This is a fresh cloud container
  clone with no other seat's WIP; the worktree law's shared checkout is not
  involved.
- **History:** the clone was shallow (306 commits) and was unshallowed to 2,146
  before any `git log` claim above. All branches were fetched to find the
  2026-09-26 ants.tube dispatch.
- **Network:**
  - `apache.org` 200 (compared).
  - `gnu.org` 403 (AGPL text not re-verified).
  - `chopratejas/headroom` not read (outside session scope).
- **Not done:** any license change, the per-package files, any legal conclusion.
  This dispatch is not legal advice.
