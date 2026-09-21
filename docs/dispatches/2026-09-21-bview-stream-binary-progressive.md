# Receipt — bViEw honest /stream binary progressive (2026-09-21 MDT)

## Root cause
Live `/stream` is honest (CL **214091829**, ACAO `https://skaists.dev`) but **Accept-Ranges is absent** (Range ignored → full body). Tip client after #201 still did: `fetch(/stream)` → **cancel body** → `video.src = remote URL`. That second media GET competed with no range support; first frame never cleared `s-slow` ("Fetching…") + video spinner (founder screenshot). Not a popup loop in bview/lang/dock; live HTML was already post-#201 (byte-identical to tip). Tab-spam not evidenced in estate code — deferred.

## Fix (local commit `b1184e25` on `hotfix/bview-stream-cors`)
- Honest CL (≥ STUB_CL): **never** assign remote URL to `video.src`.
- Consume the probe fetch ReadableStream as **binary progressive** Blobs (shared `flushEarlyPaint` / `finishBinary` with JSON path).
- Stub CL still aborts fast → JSON envelope progressive.
- Cache + tap-for-sound kept.
- e2e **8/8** (adjusted upgraded-door → expect `blob:`; added honest-stream early-paint case).

## Ship blocker
GitHub MCP PAT is **write-403** (`create_branch` / `create_repository` / `push_files` unavailable from this box). No `machineId` Shell to loVis from this executor.

## Apply on loVis (founder / agent with write)
```powershell
cd C:\Users\travi\wt-cowork-watchant   # or C:\Users\travi\beehive-nature
git fetch origin main
git checkout -B hotfix/bview-stream-cors origin/main
git am 0001-bViEw-honest-stream-as-binary-progressive-Blob-no-re.patch
# or copy surfaces/bview.html + e2e/bview.test.mjs from this artifact folder
node --test e2e/bview.test.mjs
git push -u origin HEAD
gh pr create --base main --title "bViEw: honest /stream as binary progressive Blob" --body "..."
gh pr merge --merge
```

Patch path on box: `/workspace/artifacts/bview-stream-binary-progressive/0001-bViEw-honest-stream-as-binary-progressive-Blob-no-re.patch`

## Founder re-eval (after merge + Pages)
1. Hard refresh: https://skaists.dev/surfaces/bview.html — Ctrl+Shift+R (or empty cache).
2. Confirm response `last-modified` is after this merge (not only #201).
3. Paste the repro `autonomi://` XOR; expect early paint (Blob) while MB counter moves — **not** stuck on Fetching… + spinner.
4. Prefer `bview.html` directly (not `watch-ant.html` redirect) for eval.
