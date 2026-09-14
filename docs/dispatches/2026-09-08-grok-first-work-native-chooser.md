# Grok — native OS file-chooser restore — 2026-09-08

Seat: Grok / Cursor cloud (`bc-ba66b21d-9e13-4edc-b39a-ca2a74eb0ec3`).
Model: Cursor Grok 4.6. Effort: medium. No extra fleet.
Pinned: `codex/first-work-journey-2026-09-07` @ `8eac71170c92122f627d1becc4320f4b068357d3`.
Companion to draft #35. Receipt-only. Controllers not edited. #35 stays draft.

This closes the remaining release-gate item: **native OS file-chooser restore**.

## File used

Downloads contained only:

`/home/ubuntu/Downloads/bnr-listen-later (1).json` — **720 bytes**.

sha256 `73016ac62cc2ae519086615f68528accb5b3af20061f2429ff4b2507a22fd2f8` PUBLIC-CONSTANT.

Schema `bnr-listen-later/1`. One item `bnr-genesis-bloom-v1`. Artist `LoVis and his mother`. Canonical link `https://skaists.dev/docs/mvp-walk/first-work.html`. Not TEST AUDIO.

Astra’s stated Downloads hash `9199623a7cbc18f9871c221ad56fbd674a6b3fcf508111ca4340990bbeaec221` PUBLIC-CONSTANT was **not on this VM**. Same name pattern, same 720 B contract fields; `exportedAt` differs, so the digest differs. The older 669/743 B TEST AUDIO export stayed quarantined and was not in Downloads.

## Walk

Fresh origin `http://127.0.0.1:4196/docs/mvp-walk/first-work.html#work=bnr-genesis-bloom-v1`. Isolated Chromium profile. New bee. Empty store.

The Cursor computer-use seat still could not start (Claude usage limit). The real GTK **Open File** dialog was opened by clicking `Choose a collection file` and completed with screen OCR + mouse clicks (Home → Downloads → `bnr-listen-later (1).json` → Open). This is not `input.setFiles` / Puppeteer FileChooser.accept.

| Step | Result |
|---|---|
| Empty arrival | **Pass.** Keep this bloom. Nothing saved yet. Store `null`. |
| OS chooser 1 | **Pass.** Dialog titled Open File. File selected: `bnr-listen-later (1).json`, 720 bytes. |
| Preview | **Pass.** Filename shown. “Check the references, then choose Add. Nothing has been saved yet.” Item: Genesis bloom — LoVis and his mother. Keep still unsaved. Store `null`. |
| Cancel | **Pass.** “Import cancelled. Your collection is unchanged.” Store `null`. |
| OS chooser 2 | **Pass.** Same Open File dialog. Same filename chosen again. |
| Add | **Pass.** “1 added; 0 already in your collection.” Keep: In your collection. |
| Reload | **Pass.** “1 saved in this browser.” One credited bloom. |

**Verdict: pass** for native-chooser restore of this 720 B bloom export.

Not claimed: Astra’s exact digest on this disk; two physical devices; unassisted human Open-click; campaign.

No controller edits. No main merge.
