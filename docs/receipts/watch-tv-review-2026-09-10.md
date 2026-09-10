# Follow-up recommendations from the device run

These are review proposals. The ARMv7 contribution does not change application
startup or logging behavior.

**Priority: remote-operable video controls.** The founder reports that the normal
play/pause, forward/rewind and skip controls are not appearing during Big Buck
Bunny. Two device captures show video without the transport overlay. The app uses
`Video(controller: _controller)` with adaptive defaults. On Android those defaults
select `MaterialVideoControls`, whose controls start hidden and are exposed through
pointer/touch gestures; the overlay has no explicit D-pad shortcut handler. Existing
TV focus tests exercise library cards, not the player. This is a likely explanation
for the observed control problem, requiring a controlled remote-button reproduction.

Recommended next contribution: a TV-aware transport overlay with visible focus,
select/play-pause behavior, bounded seeking, and defined Back behavior. Show
previous/next only when an actual adjacent item exists. Test those keys in widget
tests and on this Streamer, preserving phone touch behavior. Merely making the
overlay permanently visible does not supply remote navigation.

The founder clarified that streaming is smooth and there is no screen jumping.
No crash or unintended player-exit finding is asserted.

**Focus visibility across the TV UI.** The founder reports that the remote's
highlight is hard to follow. Use a strong outline plus a modest size change so
focus is distinguishable from an ordinary filled or selected button. Preserve
focus predictably when returning from a dialog or player. Validate from the
founder's usual viewing distance; the exact affected controls still need a
controlled remote-navigation pass.

**Create device link stops at Continue.** The founder reports this blocker; direct
capture shows the "Name this device" dialog, a nonempty default name and an
apparently enabled Continue button. `_askDeviceName()` autofocusses the text field;
Continue should pop the dialog with the trimmed name, after which `_createLink()`
calls the API. A still image cannot prove which control has keyboard focus or
whether the callback ran. One subsequent ADB coordinate tap on Continue advanced
to "Link created" with a QR invitation. Direct touch activation and link creation
therefore work; reproduce text-field-to-button traversal and activation with the
physical D-pad. Second-device joining and sync remain untested. The pre-submit
capture is retained locally as `streamer-link-device.png`; the QR capture is kept
outside the shareable bundle and not committed.
[Source: MyWatchScreen, _askDeviceName / _createLink](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/lib/screens/my_watch_screen.dart#L172).

Sources:
- [PlayerScreen build](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/lib/screens/player_screen.dart)
- [Adaptive control selection](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/third_party/media_kit_video/lib/media_kit_video_controls/src/controls/adaptive.dart#L15)
- [Material controls](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/third_party/media_kit_video/lib/media_kit_video_controls/src/controls/material.dart)
- [Existing TV focus tests](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/test/tv_focus_test.dart)

Additional review topics:

1. **Review networking before terms acceptance.** The first-launch Terms screen
   was visible when the native engine reported five connected Autonomi bootstrap
   peers. `main()` deliberately awaits `EmbeddedClient.start()` before constructing
   `TermsGate`; the gate comment explicitly says networking continues warming up.
   Consider explaining that behavior on the screen or deferring the start until
   acceptance, with the startup-latency tradeoff made explicit. This is documented
   behavior, not an inferred crash or claim that the gate protects networking.
   [Source: main.dart, main / TermsGate](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/lib/main.dart#L65).

2. **Filter Android release logs without silencing traffic accounting.** The
   physical release build emits verbose transport/DHT messages, including peer
   endpoints, into logcat. In `init_tracing()`, Android attaches its log layer
   without the INFO-default filter used by the non-Android formatter. Add a
   per-layer filter to the Android logger while preserving `AntTrafficLayer`,
   which feeds data-usage accounting. Verify both reduced log output and unchanged
   traffic capture. This should be a separate, tested change.
   [Source: lib.rs, init_tracing](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/native/watchit_core/src/lib.rs#L49).

The founder's TV-design reference also supplies acceptance criteria for legibility,
remote focus feedback and shared-screen privacy. Focus visibility is now a reported
usability issue; the other criteria need observed screen/action evidence before
becoming defect reports.
