# Bloom pack review and connected presentation integration

Reviewed PR #37 at `b839d7e5` (its code is unchanged from `29405ce6`), PR #36
at `ee9fa104`, and the existing #35 contract at `ada68dca`. All three heads
had 8/8 successful GitHub checks before integration. This is an engineering
review and browser walk, not a human adoption observation.

## What works visually

The original bloom, cream canvas, clear maker credit and "the bloom they made
together" language support the artist-first arrival. #37's named color roles
are useful. Its top-of-page warning, several setup explanations and empty
support section currently take more space than the artwork and first action.
Keep a compact preview label; put implementation/release detail in disclosure.

## PR #37: keep draft, reconcile before release

1. **P2 — a separate identity with no return link.**
   `works/bloom-genesis.js:19-27` defines `bloom-genesis-lovis-mother` and an
   empty links array, while #35 uses `bnr-genesis-bloom-v1` with a canonical
   work link. `paintKeep` recognizes only the new ID. Shipping both creates
   two records for one work; the #37 record offers no route back from the
   listening collection. Use the published work/controller contract. The
   connected receive/Keep/share/import path already exists on #35.
2. **P2 — share page loses the chosen experience.**
   `works/bloom-genesis-share.html` has no shared register or view styling.
   Browser walk: Raver work -> Share with someone -> cream card without a
   view toggle. The founder's three-view rule applies to this page too.
3. **P2 — the loaded artwork disappears from accessibility.**
   `works/bloom-genesis.js:70` marks the loaded SVG aria-hidden, while
   `applyBloom` hides the original image. Browser AX contained the heading
   and motion status but no artwork image/description after load. Keep the
   figure's accessible description when replacing its visual content.

The 12 added tests are source-pattern assertions. They do not exercise these
runtime arrival/navigation/identity outcomes. Keep the useful visual work,
but convert #37 to a companion of #35 rather than merge a second engine.
No #37 code or new store ID was incorporated by this integration.

## PR #36: integrated with repairs

The companion branch respects the #35 controller boundary. Its layout,
access targets and credited card presentation are integrated into #35.

- **Skip regression fixed:** its new `#work-content` link was not accepted
  by the work resolver. Activating it hid the artwork as an unknown work.
  The resolver now accepts the focusable section target. A source-to-runtime
  regression walks every local fragment in the actual HTML.
- **Clipped credit fixed:** direct inspection of the supplied 1200x630 PNG
  showed the right edge clipping "LoVis and his mother". Removed that raster
  from the integrated tree and composed an editable 21,691-byte SVG card from
  the unchanged original JPG, with the complete credit on two lines. Browser
  inspection confirms the whole credit is inside the card. This is code-native
  layout of the original art, not a regenerated logo.
- Social metadata uses the original 320x320 JPG with maker credit in its
  title/description. The SVG is the in-page card; no unsupported SVG social
  preview or platform-specific result is claimed.
- Kept the native disclosure marker and removed the 390px overflow-hiding
  rule so clipping cannot masquerade as a successful layout measurement.
- Carried "the bloom they made together" into the shared page. The visible
  card caption leads with the makers; delivery limitations stay in About.

## Verification and limits

- Full front-door command: **184/184 passed**; first-work checks **14/14**.
- CI shape: **39/39 guarded suite steps**. `git diff --check` clean.
- CUA on #37 local preview: Keep writes a reference; Raver -> share loses
  its view; loaded artwork lacks an image entry in AX. Local worktree
  `29405ce6` has the same page/controller bytes as reviewed `b839d7e5`.
- CUA on integrated #35 at 1265px: skip fragment retains visible work and
  focuses work-content; full card/credit visible; Keep and Pause remain
  through Raver/Cypherpunk/New bee; no horizontal overflow at that width.
- Grok's #36 receipt reports a 390px and reduced-motion browser walk at
  `a57d3c1`; that is evidence for its earlier head, not a fresh phone test of
  these integration repairs. Its file-picker import used an older test-audio
  export, so a native re-import of the new bloom export remains unverified.

Preview: `http://127.0.0.1:4190/docs/mvp-walk/first-work.html`.
Public social rendering, QR, artist-selected support destination and human
receive/return observations remain open. #35 remains draft during this pass.
No main deployment, box service, chain action, media upload or campaign.

Integration tooling: initial `git rm` declined removal of the staged incoming
PNG (`the following file has changes staged in the index`). Removed the exact
reviewed file with `git rm -f`; its original remains in #36 history.
