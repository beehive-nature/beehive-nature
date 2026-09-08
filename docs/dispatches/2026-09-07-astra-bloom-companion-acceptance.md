# Bloom companion accepted into the connected journey

Reviewed #37 at `756b22730cb031fa75288c0e5ade16fc8bc1771f`, targeting #35
at `d96c1593`. Both tips had 8/8 successful remote checks when inspected.
This receipt closes the three #37 findings in
`2026-09-07-astra-bloom-pack-integration.md` at the revised source below.

## Findings closed

| Finding | Source and browser evidence |
| --- | --- |
| Duplicate work identity / no return link | The WORK_REF/save/remove wrapper and collection script are gone. Presentation and card link to `../first-work.html#work=bnr-genesis-bloom-v1`. Browser click reached the known visible work and its existing single saved bloom reference. |
| Share page loses the selected view | Both pages load the shared register and define all views. CUA verified Raver presentation -> share card -> connected page; Cypherpunk also survives navigation to the card. No replacement store or view control. |
| Loaded artwork disappears from accessibility | `nameLoadedArtwork` removes aria-hidden, assigns role=img and maker-named text; visible figcaption stays. CUA AX contains the loaded bloom image and original artist description. |

The presentation now leads with the bloom, its family credit and named colors.
Release details are folded in About. The empty support CTA is gone. The
earlier draft ID is named as withdrawn and is never written by these pages.
Existing private browser pointers from an old preview are not silently
migrated or deleted.

## Two integration corrections

- Copy writes a URL only. Its success text now accurately says the work link
  was copied and that opening it shows maker credit; it no longer says artist
  names themselves were also copied into the clipboard.
- The light print layout now explicitly resets ink/dim/color-role variables
  for every selected view. Raver/Cypherpunk light text cannot inherit onto
  the cream print background. This is a source correction, not a fresh
  physical print receipt.

## Verification

- Full front-door command including both first-work and companion suites:
  **197/197 pass**. The 13 companion checks are source assertions; they are
  supplemented here by the browser walk, not described as runtime tests.
- CI shape **39/39 guarded suite steps**; whitespace check clean.
- Companion still and first-work original JPG hashes match byte-for-byte.
- CUA on the combined worktree at `127.0.0.1:4190`, 1265px: accessible loaded
  image, pause retained on a skin change, both dark views retained in card
  navigation, copy success, canonical receive navigation, existing Keep
  retained, full maker text in DOM and no horizontal page overflow.
- Shared first-work controller, collection library and register are unchanged
  from #35. New bee was restored after the walk.

Grok's #37 receipt reports its earlier 390px and one-page print walk at the
reviewed tip. Those observations remain attributed to that seat/head. A fresh
390px/physical print check after the two local corrections, public social
rendering, QR and native re-import of the new bloom export are not claimed.
Neither software tests nor this walk establish recipient demand or adoption.

Merged as a presentation companion into #35, retaining both branches' history
with canonical founder/seat identity. #35 remains the draft release boundary;
this pass does not merge main, deploy a box service, upload media or launch a
campaign. No additional worker or fleet was started.

Preview: `http://127.0.0.1:4190/docs/mvp-walk/first-work.html`.
Card: `http://127.0.0.1:4190/docs/mvp-walk/works/bloom-genesis-share.html`.
