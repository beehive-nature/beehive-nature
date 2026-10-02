# bViEw personal video memory — 2026-09-30

Seat: Codex. Own worktree: `C:/Users/travi/wt-codex-bview-ci`.
Branch: `codex/bview-personal-playlist`. Base: main's PR #280 merge.

## Delivered behavior

The same My videos section follows the address field through all three
registers. Actual `playing` events remember normalized Autonomi addresses;
failed fetches and malformed addresses do not count as playback. The reader
can save an address before playback, name it, replay it, and remove it.
Removing the current video suppresses automatic reinsertion on resume or
progressive source swaps. A new explicit play may remember it again.

The versioned `bnr.bview.playlist.v1` record contains only normalized public
video addresses and optional names. It persists in this browser's storage;
the page explicitly explains device/browser scope and clearing-site-data
loss. It is not an authenticated bzDiD record or remote backup. No keys,
wallet creation, signing, payment, or upload are involved. Save operations
refresh the record before mutation; storage events update other tabs.
Unreadable storage is preserved and failures never report a successful save.
Names render as input values and addresses as text, never HTML.

## Founder direction carried forward

- One bzDiD must carry across surfaces. Base/Arbitrum/other EVM free first-line
  wallet access precedes the full 1:1 bzDiD path; no native-gas-first onboarding.
- WebRTC priority was explicitly clarified as peer-to-peer video/data delivery,
  rather than phone signing or device-pairing work in this slice.
- Once x0x/WebRTC and Autonomi prove solid, the estate intends to leave the
  current web dependencies. A successful simulated fetch is not that proof.

Current implementation boundaries inspected: `tour.js` loads
`rails-badge.js` on surfaces; that badge reads `bnr_soul` and derives a display
fingerprint, not an EVM signing address or an authenticated shared session.
`wallet.html::keychainOn` holds the actual master key in tab memory. Its QR
bridge uses public Nostr relay WebSockets, not WebRTC. `bdata.js` has local
purchase/quote state and the `bdata-ask` BroadcastChannel, not a bzDiD playlist
sync protocol. No display fingerprint is used to claim playlist ownership.

The direct delivery integration point is the upstream Autonomi browser SDK:
`WithAutonomi/ant-browser-sdk` main was inspected at
`8cbf5a730c1ae928fe1fa50ef233875c54807928` (PUBLIC-CONSTANT).
Its README exposes `AutonomiClient.connect()`, verified public downloads and
random-access media readers over certificate-pinned WebRTC Direct. It labels
the SDK experimental and requires matching SDK/node versions. Client PR #186
and node PR #220 merged September 22; their merge is not proof of this site's
network path. bViEw still uses the HTTPS relay in this delivery. Wallet-backed
personal data and browser-direct transport remain separate implementation and
live-proof work; neither is described as shipped here. Stored video addresses
contain no relay URLs, so changing the transport need not replace the playlist.

## Acceptance evidence

`node --test bview.test.mjs bview-eternal.test.mjs` from `e2e`:
22 passed, 0 failed, 0 cancelled, 0 skipped, exit 0; 121590.6695 ms.
Three new browser tests cover manual save/name/dedup/reload/cross-tab/removal,
real VP9 playback recording/replay/removal on resume, and unavailable or
corrupt storage. The door is mocked; the media and Chromium playback are real.
Existing progressive/slowdown/end-of-file tests and three-register contracts
all pass. Slow case: start at 768 KiB against 759 KiB floor, longest stop
156 ms, end reached 9.77/10 seconds. Drop: 12-second estimate, 11.8-second wait.

First run: 20 passed, 2 failed. My new test used the wrong fixture directory
and failed ENOENT; corrected it to the existing repo-level fixture. The
existing slow-door estimate assertion reported 14 seconds vs actual 8.4;
final run reported 11 vs 8.5 and passed the unchanged assertion. No test was
weakened or skipped. Playback is paused at the start of a new address to stop
the outgoing source while cache lookup happens; recording ignores paused or
unready events.

`node --test e2e/estate-source.mjs`: 11 inner cases passed, outer 1 passed,
0 failed, exit 0. Generated hub remains unchanged. `git diff --check`: clean.
Mobile 390-pixel screenshot inspected: all playlist controls visible, address
wraps, no horizontal overflow. Existing surface registration retained; no
surface added or moved. Local logs/screenshots remain untracked evidence.

Checked David Irvine priority before feature work: #622's September 30 reply
folds its remaining slices and measurement requirements back into #504;
#504's matching reply retains delivered/published acceptance and the ordered
v0.46 follow-up work. #505 is field-accepted and closed. This UI change neither
implements nor claims those backend acceptance results.

Hosted CI, merge, Pages commit and production-byte verification are recorded
in the PR's final deployment receipt. Completion requires the public site.
