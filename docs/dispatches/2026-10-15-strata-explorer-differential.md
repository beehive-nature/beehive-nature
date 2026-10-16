# Strata, read as a differential — and the explorer it became — 2026-10-15

Serves **L1 (eternal data)**. Order: the founder opened the Strata file-interface study
"to fully exploit all the value and leverage our fully decentralized stack". Branch
`claude-LoVis/strata-file-interface-study-471d96`, cut from main `de36ef416`.

## 1. What Strata is, checked at the source (not the website)

`lgse/strata` tag `v1.0.0` → commit `0a086aa3bdb2`, published 2026-10-12T20:15:04Z
(GitHub releases API). Read: `LICENSE`, `Cargo.toml`, `THIRD_PARTY_LICENSES.md`,
`docs/{preview-sandbox,file-providers,signed-updates,performance-baseline,architecture}.md`.
Nothing was built, run or copied; the pattern was taken, no code.

| claim in the brief | at v1.0.0 |
|---|---|
| Rust edition 2024, GTK4/GIO/GStreamer/Poppler desktop app | true (`Cargo.toml`) |
| licence | **MIT** in `LICENSE` and `Cargo.toml`; stratafiles.io says GPL-3.0-or-later. The versioned files are the record |
| default `rar` feature links UnRAR (non-free licence) | true; `--no-default-features` excludes it (`THIRD_PARTY_LICENSES.md:86`) |
| native decoders in bubblewrap; Landlock ABI 3 + seccomp workers; text and pure-Rust document parsers in-process | true (`preview-sandbox.md:4,54-64,172-180`); "No unsandboxed fallback" (`:673`) |
| providers are trusted programs, not sandboxes; outcomes accepted / rejected / partial / unknown; no replay; revalidate on activation; remote-only unsupported | true (`file-providers.md:5,126-163,240,261`) |
| updates authenticated by Ed25519 manifests (size, sha256, source commit, bounded download) | true (`signed-updates.md:10-63`) — classical, not post-quantum |
| 135 MiB for 100k entries is app-group charged memory incl. cache; charts omit hardware/versions/cache/run counts | true (stratafiles.io, quoted by fetch) |
| bounded 128-entry batches; phases window / first provider batch / first UI batch / enumeration / publication | true (`performance-baseline.md`); single engineering samples on one machine |

## 2. The differential against our rails

| capability | Strata v1.0.0 | x0x | ANT | Vaulta | Hive | AR | pick |
|---|---|---|---|---|---|---|---|
| list what you own | GIO/GVfs native paths, Miller columns | transport, no listing | no directory; a data map per file | `.b` table, paged keyless reads | account history, paged | GraphQL by owner/tags, paged | **the device index is the truth** (My Space); each rail's listing stays its adapter's |
| first rows before all rows | 128-entry batches | — | — | — | — | — | **ours now**: `bnr-explorer` navigator + My Space slices (§3) |
| a late answer never paints | generation identity per request | — | — | — | — | — | **ours now**: tickets in the kernel and in My Space's draw |
| preview isolation | bubblewrap + Landlock + seccomp, Linux only | — | bytes checked against the index | — | — | bytes checked against the index | **ours**: a wasm module with **no imports**, pinned, in a worker, on every OS and browser; missing isolation = no preview |
| outcome states | accepted / rejected / partial / unknown | — | `bpay.ant.journal/1` UNKNOWN held | contract §5: submit is never terminal | — | — | **ours already** (SPEC-ADAPTER-CONTRACT-1 §5–§6, BNRoSe UNKNOWN). Partial stays a shell summary: §6 forbids partial at the adapter |
| a listing is not permission | providers must revalidate | — | — | `capability::Delegation` | — | — | **ours now**: every act re-reads its row (`fresh`), kernel `open::revalidate` |
| decentralized persistence | none (SFTP via GVfs; remote-only refused) | mesh | private, paid | identity, `.b` names | cheap public text | permanent anchor | **ours**; Strata has no answer here |
| update authentication | Ed25519 manifests | — | — | — | — | — | **ours**: ML-DSA-65 law signatures (`docs/PQ-LAW.json`); the explorer module is pinned + reproducible, the same shape |

Use Strata as a design reference only. Not a dependency, not a provider, not bTunGsTeN-passed.

## 3. What landed

- **`crates/bnr-explorer`** — `no_std`, `forbid(unsafe_code)`, no clock, no I/O. Navigator
  (≤128 per batch, tickets that never wrap, six phase marks), folder projection over sorted
  `/` paths (`bnr-archive`'s shape), `open::revalidate`, identity-first preview (size →
  sha256 → sniff by content → structure: full PNG chunk walk with CRCs, JPEG segments to a
  frame and an end marker, GIF trailer, WebP RIFF size; 50 million pixel gate; UTF-8 text
  sanitised of controls and bidi overrides; SVG is text), one wire. 44 tests, two of them
  over `atmirror::rail::Rail` — the kernel reads through the existing storage trait and adds none.
- **`crates/bnr-explorer-wasm` → `surfaces/bnr-explorer.wasm`** — 40,691 B, zero imports,
  six exports. `scripts/bnr-explorer/build-wasm.sh --check` rebuilds it with paths remapped
  and compares bytes (reproduced from two target directories here; now a CI step); the Rust
  test reads the committed module and asserts the empty import section.
- **My Space** (`surfaces/myspace.js`, `myspace.html`, `bnr-explorer-worker.js`): Preview on
  every row; the list drawn at once and in slices; three false signals removed (below).
- **`e2e/myspace-explorer.mjs`** — the gate (52 checks) + the meter, now in CI. The gate drives
  the real page: a slow rail, a late stale read, text / PNG / broken PNG / 20000×20000 header /
  SVG-with-script / a text file named `.png`, a recorded digest that does not match, the module
  driven directly with a wrong digest and with 32 MB + 1 byte, a row moved or deleted in another
  tab, previews with the module missing, swapped or WebAssembly absent (bytes never read), a
  module with one import given its own digest as the pin, a hive read that hangs and answers
  late, a share upload that drops and one the hive refuses. Existing gates still pass:
  `myspace-seam.mjs` 136/136, `myspace-eternal` 4/4, `tour-bar-clearance` 4/4, footer audit no
  findings, skaists conformance 100 in all three registers for `myspace.html` and `stack.html`.

## 4. False signals found on the live page, and removed

| was | measured | now |
|---|---|---|
| every row said "the rail that holds this is not answering" while rails were only starting | one adapter held 3 s: both rows said it for 3.15 s, the kept one included | each row says its own rail's state; "asking" is its own sentence |
| a share PUT that timed out or dropped said "Nothing left this phone" | code path: any failure without `e.sent` | refused = "reached the rail and the rail refused"; anything else after hand-off = "possibly shared" |
| a move whose old copy failed to clear said "Nothing changed" | code path: row written last | the row is written the moment the new copy exists; a failed clear is named |
| a failed delete on a sealed rail said "the copy out there stays" | `catch` swallowed it | the failure is said |

## 5. Measured (one machine, Chromium 151, five runs per line, median / worst)

`node e2e/myspace-explorer.mjs --measure`; "before" served `git archive de36ef416 surfaces`
through the same meter (`EXPLORER_ROOT`). A seeded index, a fresh context per run (cold) or a
reload (warm); "slow" holds one adapter script 3 s. "True words" is the first row showing its
rail's declared terms, not a placeholder. The worst frame is a long-animation-frame in which
`myspace.js` ran. The box was shared with other seats' builds; the numbers are noisy.

| rows | mode | first row, before → after | true words, before → after | worst frame with My Space work, before → after |
|---|---|---|---|---|
| 200 | cold | 286 / 342 → 366 / 1,260 ms | 337 / 455 → 616 / 1,678 ms | 71 / 94 → 60 / 298 ms |
| 200 | warm | 116 / 138 → 151 / 204 ms | 212 / 253 → 348 / 555 ms | 0 / 63 → 0 / 191 ms |
| 200 | one rail 3 s slow | 214 / 235 → 151 / 166 ms | **3,172 / 3,224 → 325 / 362 ms** | 68 / 80 → 108 / 141 ms |
| 2,000 | cold | 357 / 1,995 → 593 / 697 ms | 358 / 1,995 → 593 / 697 ms | **369 / 626 → 85 / 99 ms** |
| 2,000 | warm | 234 / 318 → 202 / 226 ms | 234 / 318 → 202 / 226 ms | **352 / 384 → 52 / 56 ms** |
| 20,000 | cold | 959 / 1,192 → 1,039 / 1,335 ms | 959 / 1,193 → 1,039 / 1,335 ms | **4,952 / 6,366 → 646 / 718 ms** |
| 20,000 | warm | 6,203 / 9,031 → 1,641 / 2,768 ms | same | **6,645 / 7,926 → 712 / 945 ms** |

Read plainly: the freeze is gone (seven to eight times shorter worst frame at 20,000 rows, the one
remaining long frame is the single swap of the off-screen rows); a slow rail no longer withholds
the truth about files on the rails that answered (ten times sooner); first-row times at 200 to
20,000 rows show **no reliable difference** at this noise level, and the small-list worst cases in
this sample are worse, not better. All 20,000 rows are drawn by 2.4 s (median), where the old page
inserted them at 0.96 s and then held the page about five seconds. CI gates only the freeze
(2.5 s budget at 20,000 rows). First verified preview, tap to checked text on screen: 126 to 415 ms
with the worker cold (module fetched, pinned, compiled), 88 to 210 ms warm (three gate runs).

Engineering note kept because it cost an hour: `scheduler.yield()` resumes ahead of every other
task, so it starved the rails' own `describe` answers until a 20,000-row draw had finished, and
indexing `list.children[i]` after each removal made a redraw quadratic. Both are fixed and the
reasons sit in `myspace.js` beside the code.

## 6. Not claimed

No mobile device, no CI-runner timing, no memory claim beyond wasm pages. The worker's removal
of its own `fetch` is a forbid, not an unnameable; the empty import list is what holds.
Images are drawn by the browser's decoder after the header gate — the gate is not a decoder.
PR #211 (slice W, last touched 2026-10-01) predates the 2026-10-04 rewrite and will need a
rebase across this change.

**For design (Astra):** `.sheet-look`, `#look-view[data-kind]` (`reading | text | image | none | off`),
`#look-view[data-reason]`, `.look pre`, `.look img`; row button `#look-<id>`; copy keys
`look`, `look-close`, `look-save`, `reading`, `asking`, `checked` in all three registers.
