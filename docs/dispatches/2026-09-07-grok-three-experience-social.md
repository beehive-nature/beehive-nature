# Three experiences on social/people surfaces — 2026-09-07

Seat: Grokbot / Cursor cloud agent. Lane: social/people presentation on
the same URLs, using the shared `body[data-reg]` contract. Gallery and
studio remain Astra's theme-adapter lane and were not rewritten.

## Targets

- `surfaces/buzz-directory.html` — New bee (`body[data-reg=bee]`, the
  HTML default) is one continuous light room: choose-cards, OUR HIVES
  and people-agents share the hub canvas (`#f6f7f2` / white cards / rem
  type). The page restyles the injected tour bar for New bee; `tour.js`
  itself is untouched. Relay-host, fallback and web-door chips live in
  `details.density`, opened for raver and cypherpunk. New bee sees hive
  name, join action and honesty; cypherpunk still has the full receipt
  lines in the same DOM.
- `surfaces/doors/bnature-social.html` — New bee strip and page chrome
  share that light island (veil and hex band hidden). Raver keeps the
  band. Cypherpunk keeps scanline density and restyles the strip to the
  dark terminal. The eleven-tool catalogue sits in `details.density`.
- Tests: additive `e2e/social-three-view.test.mjs`, wired beside the
  existing social-arrival suite. Destinations, this-browser-only honesty
  and the choose-click law stay asserted.

## Limits

- `surfaces/blight/gallery.html` and `surfaces/blight/studio-music.html`
  were not edited. Founder screenshots of those staying dark/dense belong
  to Astra's adapter work.
- `surfaces/register.js` and `surfaces/tour.js` were not edited (cache
  remains register 8 / tour 38). Page CSS overrides the inline tour bar
  for New bee only.
- No corpus, `lang.js` floors or mass translation. New English faces are
  unkeyed; PR #15 remains the additive `social.arrival.*` path.
- Source/fixture checks are not a rendered usability acceptance, a live
  two-device Buzz conversation, or a gallery/studio skin.
- `d.social.who` / `d.social.what` stay keyed on the New bee-visible header
  so the existing `bnature-social` floor of 20 keyed leaves still holds.
  Calmer New bee voice lives in `#start-here`, not by unkeying those leaves.
- Browser check on `http://127.0.0.1:4179`: New bee directory is one light
  room; hive cards show one estate-hive chip; cypherpunk opens relay density
  on the same URL. Triple-chip leak (page `display:inline-flex` beating the
  shared `[data-reg]` hide) was found and removed.

## CI

Pull-request checks on `363a6f9` are green (static, node, test, secret-scan).
The matching push-event static job failed §7 because the force-with-lease
that rewrote Cursor-as-author left `github.event.before` as a discarded
tip that does not resolve in the checkout. This descendant is the cure:
the next push range is parent..tip on the rewritten line. No identity
change to `363a6f9` itself.
