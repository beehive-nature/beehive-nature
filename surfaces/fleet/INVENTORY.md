# fleet — true inventory

Follow-up note to **`482412f`** *"fleet: preserve seven founder surfaces verbatim
(no edits)"*. The subject line says **seven**. The real count is **nine HTML
surfaces**, and the commit preserved **26 files** in total. The commit body was
already correct — it says "NINE founder HTML surfaces (not seven)". Only the
subject is short, and a merged subject line is not worth rewriting history for.

This note exists so the next reader counts from the directory, not the subject.

## What 482412f actually preserved — 26 files

| group | count | what |
|---|---|---|
| HTML surfaces | **9** | acid-cascade, blend-lab, bnr-dashboard, edible-tracker, flower-lab, indigo-index, intake-tracker, resonance, spliff-lab |
| value map | 1 | `VALUE-LOOP-MAP.md` |
| `iq-wiki-entries/` | 16 | `00-MASTER-INDEX.md` + 15 numbered articles |
| **total** | **26** | all additions; no existing file changed except one `.gitattributes` line |

## Two things measured at the merge gate, recorded so they are not repeated

**1. The files are LF, not CRLF.** `482412f`'s body states that "every file is
CRLF and the repo-wide eol=lf law would have rewritten the bytes at add-time."
Measured across all 26 files, in both the source at `bn-fleet/` and the committed
blob: **zero carriage returns**. Nothing was rescued from conversion.

The `surfaces/fleet/** -text` pin is still correct and should stay — it is real
protection against a future file that *is* CRLF, and against any later change to
the repo-wide `eol` law. Its stated justification was simply wrong, not its value.

**2. The bytes are intact, verified against the originals.** The gate did not
accept a reported digest; it re-hashed `C:/Users/travi/bn-fleet/` — the untouched
source — and compared. All ten top-level files matched as blob, and matched again
as a working-tree checkout after the merge, which is where eol normalization would
actually bite. `git check-attr text -- surfaces/fleet/acid-cascade.html` reports
`text: unset`, so the pin is in force and not merely present in the file.

## Standing rule for this directory

**Study it. Never edit it.** These are founder surfaces preserved byte-exact. A
seat that restyles one is out of the OR. Original work beats the bar by being
better, not by touching the reference — and the one place it can be better without
touching the art is the phone: all nine reference surfaces carry **zero** media
queries.
