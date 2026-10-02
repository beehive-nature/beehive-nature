# WEBML — THE PICTURE (one screen)

The W3C Web Machine Learning group was read at source (2026-09-30): 25 repos,
one Candidate-Recommendation spec, a family of browser-held-model APIs, an
agent-actuation door. Everything below is what a **member** gains once the
useful parts are home, versus what the estate's own two rails already do.

## Before → After

| today | after this lands |
|---|---|
| A member's browser AI is the estate's own 204–265 MB download (web-llm, sha256-gated, estate-mirrored) — real, private, heavy. | That rail stays exactly as it is — **plus** the reader's own browser translates the estate's unkeyed prose at zero download, zero key, zero server (Translator + Language Detector, Chrome-stable since 138). Enhancement-only; keyed floors stay absolute. |
| "Where does inference run?" is hand-coded: no WebGPU → fall back to the box (llama.cpp). | The same decision, stated as law in the estate's words: **the probe ships shape, never weights; the device that would run the model says whether it can.** (DAOP's pattern, banked — no build, it is a proposal.) |
| The estate's agent doors are estate protocols; outside agents scrape or stay out. | One **read-only estate capability** (vending catalog query, buzz directory read) is registered as a `document.modelContext` tool — ChatGPT Desktop can already call tools this way. Zero member-facing dependence: WebKit opposes, the trial ends when Chrome says. |
| Any AI claim the estate makes cites bytes it hashed itself. | A built-in-AI receipt, if one is ever written, **cites the browser build, never bytes** — the weights live in the vendor's binary, unpinnable by construction. "Local/private" over a built-in API is a measured claim or unsayable. |
| WebNN (navigator.ml) reads like the future of in-tab inference. | Spec-mature (CR Draft 2026-09-10) but **disabled by default in every engine, 0% usage** — banked as a trigger, not a dependency. No surface ever hard-requires a disabled-by-default API. |

## Comes home / stays in the vendor's browser

| **COMES HOME** (RULE — runs with no operator, page-held) | **STAYS VENDOR-HELD** (dies with the browser build, unpinnable) |
|---|---|
| Spec + explainer text (W3C S&D licence) — the shapes: weightless QoS probe, callee-responsible evaluation, tier strings | The browser-held model weights (Gemini Nano class) and the component-updater wire that delivers them |
| Feature-detected Translator / Language Detector as an optional reader-side assist | The Prompt / Writer / Rewriter / Proofreader family on member-facing surfaces (per-browser output; Mozilla negative on Prompt API for interop) |
| One registered read-only tool for outside agents, behind the origin trial | Chrome's EPP / origin-trial token machinery |
| WebNN's graph-builder grammar — the estate's own rail already speaks it in WebGPU form | WebNN the runtime, until an engine turns it on by default (trigger banked) |
| The estate's own rails unchanged: web-llm in-tab (sw.js pins), llama.cpp on the box (meter-gated) | `webnn-native` (dead since 2023), `model-loader` (paused since 2024) |

Everything on the left works the day the vendor's browser stops. Everything
on the right is what stops — which is why none of it sits under a member.
