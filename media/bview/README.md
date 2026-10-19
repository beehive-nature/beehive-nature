# Published bView renditions

These are explicitly published, lossy H264/AAC derivatives of an independently
hash-verified public Autonomi video. Each immutable bundle has its own master,
four aligned renditions, `package.json` with asset hashes, and `publication.json`
binding the publication to the original address, SHA256 and byte count.

The source was 3318 x 2132 at about 60 fps. These copies are 240p through 1080p
at 30 fps. Their bytes do not have the original file hash. Package hashes establish
asset identity, not visual equivalence or a cryptographic proof of transcoding.

`Adaptive when available` is the default for fresh bView visits. A curated map
in bView resolves the original address to a bundle. Existing saved original-route
preferences remain intact. `?route=adaptive` explicitly selects the published
copy for a share link without rewriting a saved route preference. Direct-only
always reads the original through Autonomi; it never silently substitutes HTTPS.

Prepare future packages with `tools/video-trial/package-hls.mjs`. Verify the
original hash and every package file before publication. Never overwrite a
published bundle. Add its address mapping only in the same release as its assets.
Run `node --test e2e/bview-published.test.mjs` before publishing changes.

GitHub Pages supplies these HTTPS bytes. No upload to Autonomi or chain is made.
This small public release is not a billion-viewer delivery deployment. Pages
controls HTTP caching headers; the content version in each path prevents mutable
segment URLs, but this repository cannot promise an immutable Cache-Control header.
