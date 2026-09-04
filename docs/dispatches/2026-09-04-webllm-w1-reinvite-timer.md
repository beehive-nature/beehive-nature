# DISPATCH — W-1 the in-browser model + invite re-mint timer — 2026-09-04

Seat: z3.2. Two orders: WebLLM in the estate's own surfaces (L-VERIFY first),
and the standing-invite re-mint timer, dry-run only. A third rider: the
vending surface registration handed to this seat by note.

## 1 · W-1 — the pocket model in the browser tab (LANDED)

**Where**: `surfaces/review.html` §5 — the bLOVErAi WINDOW, whose own law said
"the in-browser model (W-1) docks later". It docks now: wake → ask → answered
IN THE TAB, no box, no server, so the pocket works even when the compute node
is unreachable.

**L-VERIFY at HEAD** (mlc-ai/web-llm, read 2026-09-04):
- repo HEAD `56d318cd5855bfc75a87b1b60755328b5994cc23` (main, pushed 2026-09-03)
- LICENSE = stock Apache-2.0, sha256 `d412ab9d5ac17e6931705aac01e5a0d323da5acd2e89a2c19aa8fc05becc59ad` PUBLIC-CONSTANT
- package `@mlc-ai/web-llm` **0.2.84**, ESM `lib/index.js` (6.3 MB self-contained),
  vendored at `surfaces/blight/web-llm.mjs` (sha256 `80cdd52b1ada1bd2a37a8c744bdca6cc5fcc8c62dd38da4aff32a2c7fda56a55` PUBLIC-CONSTANT
  — unmodified bytes beyond ONE same-line PUBLIC-CONSTANT marker comment the
  hex law sanctions, on the bundle's single base64-padding run; license copy
  carried at `surfaces/blight/web-llm.LICENSE`, byte-identical)
- model `SmolLM2-360M-Instruct-q4f16_1-MLC` (Apache-2.0, low-resource flag,
  376 MB VRAM): **≈204 MB fetched ONCE** (7 shards ≈31.7 MB each + tokenizer),
  hosts OBSERVED in the receipt run: `huggingface.co · raw.githubusercontent.com
  · us.aws.cdn.hf.co`; then Cache Storage scopes `webllm/model|config|wasm` —
  zero network thereafter.

**The surface**: one-file vanilla, click-gated lazy import of the vendored
module (nothing model-shaped at page-open — I1 clean by construction), honest
"≈204 MB once" loading state with live progress, `tokens.css`-family vars only
(review.html's sheet), and THE WIRE — an in-page network panel counting every
request since ready, whose honest reading is zero.

**Receipt** — `e2e/webllm-shot.mjs` **9/9 PASS** (system Chrome via playwright,
`--disable-gpu` default removed, WebGPU adapter intel/gen-12lp, headless):
- COLD: loaded once, answered, first-load hosts recorded (the honest cost)
- WARM: page reloaded, model woke from cache, question answered with **ZERO
  network requests — both channels agree** (the harness's request counter AND
  the in-page wire panel read 0)
- OFFLINE: `setOffline(true)`, the tab kept answering ("…zero requests to
  answer" in the answer itself), wire 0, harness 0
- shots: `e2e/shots-webllm/review-webllm-390-loading-once.png` (the honest
  loading state) and `review-webllm-390-offline-answer.png` (the order's
  receipt: a 390px answer with the wire reading zero)
- WebGPU receipt: `e2e/gpu-probe.mjs` (bundled Chromium ships no WebGPU;
  system Chrome with the gpu default dropped exposes it, headed AND headless)

**Gates**: secret-scan tree clean · no-page-errors 98/0 · university-smoke
74/74 · design-acceptance on review.html: 7 pre-existing failures, **zero
regressions** (proven by stash: identical 7/7 before and after the dock —
review.html carries old-surface debt below the five-gate floor; fixing that
is its own lane, not smuggled into this one). Rider allowlist gained
`/\/web-llm\.mjs/` with the observed model hosts named in the comment.

## 2 · The invite re-mint timer (PREPARED, dry-run only)

`/opt/buzz/deploy/compose/invite-re-mint.sh` (copy in-tree at
`ops/invite-re-mint.sh`): reads join.json's code, reads the standing row from
the relay DB (v2 codes are opaque — expiry lives server-side), prints verdict
+ the exact re-mint plan (mint ttl 30d/10k uses with the canonical-origin
signing law, rewrite join.json + the door card, claim-probe). **--live is
refused unless `BUZZ_MINT_SEC` is set** — ready for the day the founder grants
bClaude admin. Dry-run receipt (2026-09-04): standing invite healthy, **23d 15h
left** (expires 2026-09-27 17:57 UTC, 9 uses, unlimited cap); `--live`
correctly refused.

## 3 · Rider: vending.html registered (the handed note)

Per `docs/dispatches/NOTE-VENDING-SURFACE-REGISTRATION-2026-09-03.md` (the
vending seat's explicit handoff — this seat owns the count): row landed in
estate.json, review deck taught, atlas rebuilt: **89 counted · 98 listed**,
estate-check PASS, university-smoke 74/74.
