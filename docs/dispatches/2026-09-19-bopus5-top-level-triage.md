# 2026-09-19 · bOPus5 · top-level dead-directory triage (Slice S4)

**Order.** LoVis bee-laborer cut Refill 4 (Buzz event `2d4ddb78`) from bFaBLe5.1's map. S4
is output only: one ledger, **no deletion and no move in this slice**. Deletions and moves,
if any, come later as one-file cuts on the Slice B / S1 precedent, after the ledger is read.

**Base.** `d7b9b2c6` (main after #138). Every measurement below was taken at that commit.

## Method

1. **Provenance.** First commit (`git log --diff-filter=A`) and last commit per path.
2. **References.** `git grep -l -F` for each directory path or file name over the whole
   tree, excluding the path itself. `docs/dispatches/` hits are counted separately, because
   a dispatch that names a file is history, not a consumer. `ui/` and `hex/` were re-run
   word-bounded (`(^|[^A-Za-z0-9_.-])ui/`), because the bare pattern also matches words such
   as `gui/`. Every remaining hit was read in context.
3. **Rulings.** Checked before any verdict. `docs/dispatches/RULINGS_SUCCESSION_RAILS_NOFEE_2026-08-08.md`
   §4: *"Founder ruled COMMIT the root-level untracked files (`ACTION_*`, `ASSESSMENT_*`,
   `RELAY_*`, `SOVEREIGN_*`, `bigen-pickup/`, `surfaces/`)"*. That landed as `7c858b78`
   ("docs(repo-is-the-record): … per founder ruling 4"). `docs/ROUTING.md` also has a section
   headed *"Delete — ONLY against an exhibited mirror"*.
4. **Live.** The repo root is served by GitHub Pages at `skaists.dev`. Measured: `adr0008.md`,
   `RELAY_UI_digestible_kernel.md`, `docker-compose.ar-io.yml`, `ant-door-cors.html`,
   `sims/meshfest/params.py`, `ui/index.html`, `hex/README.md`, `verify/ant-eth-split.mjs` →
   all **200**. Control `zz-control-404.md` → **404**. So every deletion or move below also
   changes a public URL.
5. Nothing was run except `git` and `curl`. No simulation, build or browser tool ran.

Verdict key:
- **KEEP**: a present job, a live consumer, or a ruled record.
- **DELETE-CANDIDATE**: a one-off whose job is done and whose result is recorded elsewhere
  (the mirror is named).
- **MOVE-TO-docs**: worth keeping, but in the wrong place.

## The ledger

### Directories

| path | files | first → last | who names it (outside dispatches) | verdict |
|---|---|---|---|---|
| `sims/meshfest/` | 3 | `6de6c29e` 08-14 | no path reference; it is the implementation of `docs/specs/SIM-MESHFEST-0.md`, and `RESULTS.txt` is its gated run | **KEEP** (the only implementation of a committed spec; the spec does not point back to the path) |
| `svgwall/receipt-midi.mjs` | 1 | `9ed9f7ed` 08-26 | 0 | **DELETE-CANDIDATE** (one-shot live-URL receipt; the mirror is `9ed9f7ed`'s own receipt; it imports playwright from `file:///C:/Users/travi/…`, so it runs on one machine only) |
| `ui/` | 22 | `0572efdd` 07-06 → `cfab957f` 07-07 | `STATUS.md:255,400,425` (run instructions), `surfaces/blight/toll.js:3` (emits the "ui/ scenario viewer schema"), `forge/visual/MULTIPLAYER-SEAM.md:6,8`, 4 `docs/audits/glm-*` reports, `docs/receipts/RECEIPT_SZLI6792_RAID_2026-08-21.md:106` | **KEEP** (the T-1 scenario viewer; a live schema contract with `toll.js`; not built here) |
| `hex/` | 40 | `f9f335e9` → `6a2877d1` 08-26 | `surfaces/blight/pixelrefiner.html:3615` ("Regenerate: node hex/tools/build.mjs && node hex/tools/inline-hexcore.mjs") | **KEEP** (the generator of a live surface; `README.md` law "hex is a MODE alongside square") |
| `bigen-pickup/CORRECTIONS-01.md` | 1 | `7c858b78` 08-07 | `docs/ROUTING.md:52` | **KEEP** (ruled record, ruling 4). Its own header says "do not commit … Delete after the edits land"; the later founder ruling to commit it governs |
| `governance/anti-capture.md` | 1 | `d3f7cdff` → `b9847ffa` 07-18 | `README.md`, `docs/SPEC-ORIGINATION-1.md`, `crates/reputation-engine/src/lib.rs`, `crates/mastery-ledger/Cargo.toml`, 3 `dockets/`, 6 more `docs/` | **KEEP** (governance doctrine, widely cited) |
| `verify/ant-eth-split.mjs` | 1 | `e29d25ed` 08-21 | `surfaces/bmeshasi.html:265` and `surfaces/royalguard.html:135` ("re-run: verify/ant-eth-split.mjs · keyless"), `docs/ledger/pirate-haul-candidates.md` | **KEEP** (live pages cite it as their re-run tool) |

### Root files

| path | first → last | who names it (outside dispatches) | verdict |
|---|---|---|---|
| `docker-compose.ar-io.yml` | `5ac64c76` 08-11 | 0 by name; it landed with `crates/wallet-relay/src/lib.rs` + `docs/CONTRACT.md` ("seam 2 read-back + ar-io-node deploy config"), and `RELAY_GATEWAYS`/ar-io appear in `crates/wallet-relay`, `crates/adapter-arweave` | **KEEP** (deploy config of a live crate seam; whether it belongs under `ops/` is the wallet-relay owner's call). No key, token or password in its 35 lines |
| `adr0008.md` | `8838c769` 08-29 | 0 by file name. (`docs/runbooks/autonomi-fence-readiness.md:55` mentions "a captured upstream ADR-0008 copy", but that is an untracked file in the Grok worktrees, not this file.) The upstream is `WithAutonomi/ant-node` `docs/adr/ADR-0008-…` (linked from `docs/dispatches/2026-09-12-eco-adaptor-sweep.md:74`) | **MOVE-TO-docs** (a foreign ADR, authored upstream by Anselme @grumbach, captured at the repo root inside a 97-file i18n commit; `docs/adr/` holds this repo's own ADRs, so the likely home is beside the 09-15 ant-node ADR raid, which is the owner's call). The copy's upstream license was not checked |
| `HANDOFF-FIX-VISUALS.md` | `aefbea91` 08-18 | 0 | **DELETE-CANDIDATE** (a handoff order that was executed the same day by `4b2d1c4a` "surfaces: the visual layer fixed"; today 63 of 114 `surfaces/*.html` carry its step-1 Cache-Control meta. Its own "done" test is the founder's device, which this ledger cannot check) |
| `DISPATCH-RECEIPTS-2026-07-24.md` | `7c858b78` 08-07 | 0 | **KEEP** (ruled record, ruling 4) |
| `RELAY_BNRi_OS_build_state_check.md` | `7c858b78` 08-07 | its `.SEAT3_VERIFIED` sibling | **KEEP** (ruled record) |
| `RELAY_BNRi_OS_build_state_check.SEAT3_VERIFIED.md` | `7c858b78` 08-07 | 0 | **KEEP** (ruled record) |
| `RELAY_SEED_lipid_cannabinoid_taxonomy.md` | `7c858b78` 08-07 | `RELAY_SEED_sources_GRAS765_and_descriptors.md`, `RELAY_UI_digestible_kernel.md` | **KEEP** (ruled record) |
| `RELAY_SEED_sources_GRAS765_and_descriptors.md` | `7c858b78` 08-07 | `RELAY_SEED_sources_SEAT3_VERIFIED.md`, `RELAY_UI_digestible_kernel.md` | **KEEP** (ruled record) |
| `RELAY_SEED_sources_SEAT3_VERIFIED.md` | `7c858b78` 08-07 | 0 | **KEEP** (ruled record) |
| `RELAY_UI_digestible_kernel.md` | `7c858b78` 08-07 | 0 | **KEEP** (ruled record) |
| `RELAY_SEED_founder_acre_economics.md` | `df193f31` → `7ed0a01e` 08-20 | `docs/receipts/RECEIPT_CARBON_CLAIMS_FIRST_GRADING_2026-08-20.md` | **KEEP** (founder-sourced data, cited by a receipt; landed after ruling 4 in the same class) |
| `ant-door-cors.html` | `7ed97b63` → `9fe6a170` 09-04 | `e2e/ant-door-cors-shot.mjs` (its receipt rig) | **KEEP** (a deployed receipt page) |

### e2e

| path | first → last | who names it | verdict |
|---|---|---|---|
| `e2e/build-midi-blue.mjs` | `b9285d2d` 08-28 | `docs/SPRINT-2026-08-28-PLAN.md:25,98` (committed as worktree residue in triage) | **DELETE-CANDIDATE** (a one-shot merge builder that reads `C:/Users/travi/midi-blue-old-index.html` and writes `C:/Users/travi/midi-blue-new/`; the mirror is `b9285d2d`. The S2 exemption row in `e2e/no-local-path.test.mjs` must be deleted in the same change) |

## Tally

- **KEEP: 16.** 6 directories, 7 `RELAY_*` + `DISPATCH-RECEIPTS` as ruled record,
  `docker-compose.ar-io.yml`, `ant-door-cors.html`.
- **DELETE-CANDIDATE: 3.** `svgwall/receipt-midi.mjs`, `HANDOFF-FIX-VISUALS.md`,
  `e2e/build-midi-blue.mjs`.
- **MOVE-TO-docs: 1.** `adr0008.md`.
- Total: 20 entries = 7 directories + 12 root files + 1 e2e file.

## Differences from the map (`RESEARCH/WIDE_REFILL4_2026-09-19.md` §4)

- `RELAY_*.md` is **7** files, not 6, so there are 12 root files in scope, not 10 root
  strays + `ant-door-cors.html`.
- `sims/` is not unreferenced in substance: it implements `docs/specs/SIM-MESHFEST-0.md`.
  Only the path is uncited.
- 9 of the root files are a **ruled record** (ruling 4), not strays. None of them is a
  deletion candidate without a new founder ruling, and the "exhibited mirror" practice
  in `docs/ROUTING.md` applies on top.

## What this does not claim

- "Zero references" is scoped to `git grep` over this tree at `d7b9b2c6`. Other branches,
  seats' workspaces and chat history were not searched.
- No tool here was run. `sims/meshfest`, `ui/` and `hex/tools` verdicts rest on source and
  commits, not on a run at base.
- KEEP does not mean "wire into CI", and MOVE-TO-docs names no destination. Both are
  separate cuts with their own owners.
- A deletion also removes a live `skaists.dev` URL (see Method 4). Whether anything outside
  the repo links to these URLs was not measured.
