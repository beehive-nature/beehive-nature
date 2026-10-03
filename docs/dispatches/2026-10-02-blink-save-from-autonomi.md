# bLink and save-from-Autonomi in bViEw — 2026-10-02

Seat 3 (Claude Code), worktree autonomi-browser-integration-f1b7f6. Founder order: "go ahead and
integrate", on a pasted analysis of the autonomirror browser download button. This is phase 1 of
that analysis: the read half only. Nothing here pays, uploads, signs or holds a key.

## Checked before acting: what had already landed

The analysis's first point (browser-native ingress, no Autonomi client) was already on main:
bViEw direct playback, 2026-09-30, with the official browser SDK 0.1.0 vendored and pinned
(`vendor/ant-browser-sdk/0.1.0/VENDOR.md`). It was not rebuilt. What was missing was a link that
carries more than an address, and any way to keep a file that is not a video.

## What ships

`surfaces/blink.js` is the bLink record: address, name, expected size, type hint, preferred
handler (watch, view, download), adapter id `autonomi`. It parses a bare address, `autonomi://…`,
the query form other Autonomi download buttons publish (`?a=…&n=…&s=…`, read from the public
autonomirror source), and its own fragment form (`#a=…&n=…&s=…&t=…&h=…`). It writes the fragment
form, so the labels are not sent to the server hosting the page. Name, size and type are the
sender's labels: cleaned (path separators, control and direction-override characters, length),
never treated as verified. Parse and format only: no network, no wallet, no storage.

`surfaces/bview.html` now takes any of those links in the address field and in the page fragment.
A link naming a video plays as before and carries its name into My videos. A link naming a file
that is not a video is not sent to the player; the page says it is a file and offers to save it.

`save file` reads the file from Autonomi storage nodes through the same pinned SDK reader in
1 MiB ranges, in order, and writes each range as it arrives. Where the browser has the File
System Access picker, the destination is asked first (while the press is still the person's
gesture) and the page holds one range at a time, whatever the size. Where it does not, the file is held in memory
and handed over as an ordinary download, and a file over 256 MiB is refused in words before a byte
is read. Stop discards the partial file. A short read is a failure, never a saved file. If the
link's size label differs from what the network holds, the page says both numbers. A save in
flight keeps the shared connection open; on the relay route it is closed when the save ends.

The upstream SDK's own limits still apply (`limits.js`: 1 GB maximum file). That is the pinned
SDK's limit, not a limit of the network and not one this change adds or removes.

## Evidence

Mocked network reader, real page, real blink.js (`e2e/blink.test.mjs` 9 passed,
`e2e/bview-save.test.mjs` 8 passed, 0 failed, 0 skipped): ordered writes whose SHA-256 matches
the source, no write larger than one read, reader and connection closed, relay touched zero
times, memory fallback download, too-large refusal with zero reads, stop and cancelled picker,
a failed range repeated without a double write, a range that keeps failing, unanswering network, pasted download-button link that still plays and keeps its name.
Existing suites after the change: bview, bview-direct, bview-eternal, watch-eternal 31 passed,
0 failed. Conformance meter, bview `#eternal`: 100% in all three registers (145/214/502 checks).
The meter caught this lane's first draft (a 13.33px button); fixed with `font:inherit`.
`build-stack-surfaces.mjs` was regenerated because the Engine Room lists each page's scripts.

One live observation, not a benchmark: headless Chromium on 127.0.0.1, the real vendored SDK,
the public network, the relay blocked. The autonomirror demo's public sample `Welcome.md`
(address `52af8a18…453b`) saved 574 B in 16.3 s from press to closed file, relay requests 0.
The demo's public 64 MiB sample (`f6eeba94…ab43`) is the larger case, run twice. First run:
it ended at 19 MiB after 165.3 s when one range did not arrive, and nothing was saved. That was
this lane's defect: one lost range ended the whole save. Repair: each range is asked for up to
three times before the save gives up, and a failure after progress says how far it got. Second
run, same file: 67,108,864 B in 64 ordered writes, 435.3 s, file closed, relay requests 0. That is
about 0.15 MiB/s on this box on this day; it is slow, and it is one session. No published digest
of that sample was found to compare against, so the bytes are checked only by the SDK's own
content addressing, not by an independent hash.

`e2e/stack-eternal.test.mjs` "the same facts in all three" fails on this box at the parent commit
too (`0 !== 5`, the autonomi count), with or without this change. Not caused or repaired here.

## Escalated, not resolved

1. **RETAIN is already a ruled word.** The analysis proposes `RETAIN.resolve(address)` as a storage
   interface. `docs/GLOSSARY-BRIDGE.md:34` rules RETAIN / FORGET as publication-consent routing,
   not storage. No `RETAIN` storage interface exists in the tree. bLink carries a plain adapter id
   instead; naming a storage interface RETAIN needs a ruling.
2. **Receipt and sponsor provenance are left out of the link.** The analysis lists "optional
   integrity/receipt metadata" and "sponsor/payment provenance". A bLink is public by
   construction; spend receipts are private by default (GLOSSARY-BRIDGE MeterReceipt row, §3a).
   blink.js has no such field and a test holds that. Putting any payment fact in a public link
   is a founder ruling.
3. **The publish half is untouched.** Browser upload with a wallet is exactly what is stopped
   today: bPay only (founder 2026-09-26), no agent key material (CLAUDE.md §2), and the capability
   stop of 2026-10-02 (no client applies both ceilings to the payment). The SDK's payment modules
   are in the vendor directory byte-faithful and are still not imported by any page.
4. **`view` has no renderer.** A link naming an image or a document is offered to save. An
   in-page viewer is a new surface decision, not made here.

## For design, and debt

Hooks: `.save-file`, `#save-file`, `#save-stop`, `#save-pg`, `#save-status`. Styling reuses the
existing control tokens only; no register dress was authored. The new words are English only,
like the direct-route words beside them; they are not yet keys in `lang-corpus.json` and owe the
full set of tongues. Relay stays the default playback route; nothing here changes that call.
