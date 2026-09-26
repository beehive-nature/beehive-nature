# bViEw — three authored experiences, the address written once (2026-09-26)

**Seat:** Claude (cloud session; committer `Claude <noreply@anthropic.com>`, author the founder per §7).
**Branch:** `claude-lovis/magical-allen-dd0xqh` (PR #233, on top of the time-based prebuffer).
**Surface:** `surfaces/bview.html`.
**Founder review, same day:**

> D+ UI design… autonomi:// written three times right in the same section… slapping a + on a D is moot… make SURE THERE ARE THREE SEPERATE USER EXPERIENCES AND INTERFACES/GRAPHICS/DESIGN/INFORMATION FOR THREE SEPERATE PERSONA'S

## What was wrong (measured, 390 px, `before-three-registers-390.png`)

- **One page in three colours.** The same column in every register: brand, h1, lead, label, input + Open, bar, MB counter, wait row, video, address echo, sheet link and note. Only the palette and the lead line changed.
- **The address was written 4–5 times on one screen**:
  - "Paste an autonomi:// address" in the lead;
  - "autonomi:// address" in the label;
  - the field itself;
  - the echo line under the video;
  - in cypherpunk, the sheet again, wrapped over four lines.
- **Raver carried no pulse** and no graphic.
- **Cypherpunk put a cream card on a black page.**
- **Casing law broken:** `text-transform:uppercase` on the sheet labels.
- **Brand law broken:** "—" drawn for every unknown value.
- **The "skaists.dev" brand link** repeated the register bar's own home link.

## The canon it now follows

Research sweep of `docs/`, `surfaces/` and `e2e/`:

- **Three authored presentations**, as `surfaces/bnamesday.html` does them.
- **Register canon 2026-08-28** (`surfaces/register.js:2-3`): "one set of facts, capabilities and access".
- **Register dress 2026-09-25** (PR #232):
  - bee: paper, serif title, one magenta action, 20/12 px corners, no glow;
  - raver: black, magenta, display 800, pills, one glow;
  - cypherpunk: black, mono, teal actions, 4 px corners.
- **New bee** (`docs/DESIGN-CONSTRAINTS.md` §13, 2026-09-07 social arrival): familiar words, 16 px, no step lists, adult and dignified.
- **Raver law** (`docs/RAVER-REGISTER-LAW.md`): literal language, motion optional, nothing faster than 3 Hz, still under reduced motion and when the tab hides.
- **Cypherpunk founder lock 2026-09-12**: never a trimmed bee twin; the complete instrument at first paint.
- **Casing law** ("capitals are never decoration") and **brand law** (never a dash for an unknown value).

## The three experiences

**New bee — a calm room.**
- A serif title and one sentence: "Watch a video someone shared with you."
- One card holding one question ("The link you were sent") and one magenta **watch**.
- The video sits in a soft 20 px frame.
- While waiting, the number is on the picture: a ring that fills as the head start arrives, "26 s". Under it is one plain sentence without a number: "It starts by itself…"
- No MB/s and no jargon.
- The note speaks in bee's own word, "link". The facts wait behind **details**.

**Raver — the drop.**
- A gradient display title and original art: an equaliser with a breathing halo. The art can be paused with **pause the motion**, the choice is remembered estate-wide in `bnr.motion.paused`, and it is still under reduced motion or a hidden tab.
- One glowing pill with a round ▶.
- A full-bleed stage. While waiting, a big "26 — till it plays" sits on a neon ring.
- A **flow meter**: five bars plus one literal sentence, the delivery rate ÷ the video's own bitrate: "the network sends 0.50× as fast as this plays, so it builds up first." It shows only while waiting or stalled.
- Facts behind **the numbers**.

**Cypherpunk — the instrument, complete before any address.**
- Mono throughout, teal **fetch**, 4 px corners.
- A **byte map** (SVG): moov, arrived, the playing copy, where play is allowed, and the playhead.
- The **start rule** written out with live numbers: `25 MB ÷ 0.50 MB/s × 1.15 + 2 s = 59.3 s > 30.0 s left → hold ~35 s`.
- The device's own **decodingInfo** answer.
- A timestamped **receipts** log that never repeats the address.
- The **your file** grid open, dark with no cream card, including the new facts: length, bitrate, codec, picture, this device, and what is in the playing copy.
- "not measured" for the network stats this client cannot see. "done in X s via the estate door" at the end.

**Shared by all three, by construction**
- One engine and one facts sheet, and the same actions.
- **The address appears once, in the field.** The address being played rides on `#out[data-addr]` and is never drawn a second time.
- **"autonomi://" appears nowhere in the text**, only as the empty field's format hint.

## Receipts

- **`node --test e2e/bview.test.mjs`: 15/15 pass** (13 playback tests + 2 new).
  - **Test 14** measures each register at 390 px, at arrival and while waiting.
  - Rules checked in all three:
    - no sideways scroll;
    - 0 × "autonomi://" in the text;
    - the address on screen exactly once;
    - no "—" for unknown values;
    - facts open, or one tap away;
    - no `text-transform` in the file.
  - The exact dress it asserts:

    | | bg | title / font | action | corners |
    |---|---|---|---|---|
    | bee | rgb(251,247,240) | serif title | rgb(168,35,140) "watch" | 12 px |
    | raver | rgb(6,17,12) | own art at arrival | rgb(214,85,187) | 999 px |
    | cypherpunk | black (as raver) | mono | rgb(69,194,220) "fetch" | 4 px |

  - Composition it asserts:
    - cypherpunk: 4 instrument panes at first paint, sheet open;
    - no two registers share a dress;
    - the wait said once each way: bee "N s" on the picture plus one sentence and a framed 358 px stage; raver "N" plus "till it plays" plus the flow meter on a full-bleed 390 px stage, with no sentence repeating it; cypherpunk the rule line ending `→ hold ~N s`, with no veil.
  - **Test 15:** raver motion pauses with one tap, is remembered across reload, and the art's animation is `none` when paused.
- **Red before:** the same file against the page before this lane (`968d4da7`). Tests 14 and 15 fail; so do 4 of the 13 playback tests, because they now read the new wait and address markers.
- **Other gates on this tree:**
  - `e2e/estate-source.mjs` 11/11 (corpus English matches the page; 28 tongues cover every key);
  - `e2e/register.test.mjs` 15/15;
  - `e2e/university-smoke.mjs` 87/87.
- **`e2e/reachability.mjs` is 7/1 with one inherited failure.** The failure is R0 "hub href … `web+bnr:/skaists.dev`". It is identical with this lane's changes stashed, so it comes from `main`, not from here.
- **390 px, same moments, same mocked door** (30 MB VP9 at half its bitrate): `before-three-registers-390.png` / `after-three-registers-390.png` (columns bee · raver · cypherpunk; rows arrival · waiting at 12 s · playing at 44 s).

## Strings

29 `bview.*` keys added or changed, in en + 28 tongues:
- `bee.*`, `raver.*`, `cy.*`;
- `badOne`, `tap`, `notYet`, `done`;
- six new sheet labels;
- `sheet.title` lowercased.

Keys the page no longer uses were removed: `lead`, `go`, `bad`, `wait`, `label`, `note`, `n.address`. All are machine-drafted (⚙); tt, sa and gd are the least certain. `_meta.drafted` records it.

## Not done here

- No live door or real 8K upload. All playback facts are from the mocked door, as in `2026-09-26-bview-time-prebuffer.md`.
- Raver's art is a first-party equaliser. A credited artwork (the estate's FUNGi/FROGGi/PEPi pieces) would lift it further; that is the founder's pick.
- The engine is unchanged. This lane is presentation: markup, dress, the render layer and the log.
