# WEBML RAID — RULE-vs-SERVER SORT — 2026-09-30

Founder order: the two links — `webmachinelearning.github.io` and
`github.com/webmachinelearning` — read as sources. Nothing was built; every row
names a fact at a pinned commit, a fetched page, or a read repo file, or is
marked UNVERIFIED.

**The question this raid answers.** The W3C Web Machine Learning group (a
Working Group that standardizes, plus a Community Group that incubates — §1)
is turning the browser itself into the AI runtime: a neural-net hardware API
(WebNN), browser-held language models (Translator / Language Detector /
Summarizer / Writer / Rewriter / Proofreader / Prompt), and an agent-actuation
door (WebMCP). The estate already runs AI on two HOME rails — WebLLM in the
tab (`surfaces/local-agent/`) and llama.cpp on the box (`ops/bmeshllm/`). What
here is RULE the estate can take, what is vendor-held paper, and what is real
in a browser today versus real on a status page.

**Sort rule** (verbatim from `X402-SORT-2026-09-01.md`, reused, not
re-derived): RULE = runs with no seller-operated box (pure library, on-chain
contract or ledger record, client-side logic, static data/schema, protocol
text, CLI that only talks to a public chain). SERVER = needs an
operator-run process/host. This raid names a third class the rule lumps with
RULE and should not: **VENDOR-HELD** — needs no operator-run host (so not
SERVER), but its substance lives inside someone else's binary, the browser:
the runtime AND, for the built-in AI family, the model weights themselves.
A VENDOR-HELD feature dies the day the vendor's build stops shipping it, and
— the part that touches estate law — its bytes can never be L-VERIFY'd or
SRI-pinned by the page. The founder's day-the-hosting-stops question reads
here as: *the day the vendor's browser stops*.

**Assertion language.** "Page P states X" / "file F at HEAD asserts X" /
"explainer E states X". Vendor and aggregator pages (Chrome docs, caniuse)
are tier-4; W3C spec text at a pinned TR date is tier 1–2; standards-position
issues are quoted by label only where the reasoning text did not load.

## 0 · Pins (read 2026-09-30)

| target | repo | HEAD read (date) | licence receipt |
|---|---|---|---|
| WebNN spec | `webmachinelearning/webnn` | `59db71f2` (2026-09-10) | W3C S&D pointer — A97 |
| TR page | `w3.org/TR/webnn` | CR Draft "10 September 2026" | — |
| Prompt API | `…/prompt-api` | `9fcb9a4e` (2026-09-24) | W3C S&D pointer — A98 |
| Translator + Language Detector | `…/translation-api` | `4334048` (2026-09-30) | A98 |
| Summarizer / Writer / Rewriter | `…/writing-assistance-apis` | `dd37ddd2` (2026-08-10) | A98 |
| Proofreader | `…/proofreader-api` | `4bcc10ee` (2026-08-10) | A98 |
| WebMCP | `…/webmcp` | `d61d0e6` (2026-09-30) | A98 |
| WebMCP aux | `…/webmcp-polyfill` `0466265` (2026-09-23) · `…/webmcp-types` `a8d8292` (2026-09-28) | | MIT — A98 |
| DAOP | `…/daop` | `d65aafc6` (2026-06-04) | A98 |
| Hybrid AI | `…/hybrid-ai` | `03b1c04` (2025-04-10) | A98 |
| Model Loader | `…/model-loader` | `14b035e` (2024-02-26) | A98 — **paused** |
| CG charter | `…/charter` | `c7fc78d0` (2025-09-25) | no LICENSE file in repo; charter text mandates S&D for specs (§1) |
| Ethics doc | `…/webmachinelearning-ethics` | `c10760e` (2024-01-08) | A97 |
| WebNN impls | `webnn-baseline` `360ee24` (2025-06-24) · `webnn-polyfill` `49bcf8b` (2024-10-22) · `webnn-native` `8a090c2` (**2023-04-06, stale**) · `webnn-samples` `516bf64` (2026-04-22) | | Apache-2.0 stock text — A99 |
| Site | `…/webmachinelearning.github.io` | `bca1385a` (2026-09-25) | — |
| Index lists | `awesome-webnn` `557e8e3` (CC0-1.0) · `awesome-webmcp` `6ee403bf` (CC0-1.0) · `awesome-built-in-ai` `e4a67d4` (2026-09-29, licence NOASSERTION — read as an index only, nothing lifted) | | A99 (CC0 pair) |
| Status pages | `caniuse.com/mdn-api_navigator_ml` · `developer.chrome.com/docs/ai/built-in-apis` (page self-dates "September 12, 2025") · `mozilla/standards-positions` #1213 #1215 #1412 · `WebKit/standards-positions` #670 | read 2026-09-30 | — |
| the estate | `beehive-nature` `origin/main` | `41c35072c` (2026-09-30) | — |

Licence hashes live only in `docs/VERIFIED-FACTS.md` rows A97–A99; this file
cites the row numbers.

---

## 1 · Governance — CG incubates, WG standardizes, S&D licence

The site states the split plainly: the **Web Machine Learning Working Group**
"standardizes Web APIs for in-device machine learning inference", using
"well-received Community Group incubations as seeds"; the sister **Community
Group** "incubates new proposals and is the place where new ideas are
discussed and explored before formal standardization." Tagline: "Making
Machine Learning a first-class web citizen."

The CG charter (`charter` at `c7fc78d0`, charter start 2025-09-25): mission is
to "make Machine Learning a first-class web citizen by incubating Web APIs for
machine learning inference **and agentic web usages**" — the agentic scope is
new with this charter. Deliverables: WebNN, Translator/Language Detector,
Writing Assistance, Proofreader, Prompt, **WebMCP**. Out of scope: training,
hardware features, generic linear algebra, and "mandating any model
schema/format" — the CG will never standardize a model format, only APIs over
whatever models a browser chooses to hold. Specs "must use the" W3C Software
and Document License; contributions under the W3C CLA. Liaisons include the
**AI Agent Protocol CG** ("consider WebMCP API requirements").

## 2 · WebNN — a Candidate-Recommendation spec that no browser turns on by default

TR page `w3.org/TR/webnn` (fetched 2026-09-30): "This document was published
by the Web Machine Learning Working Group as a **Candidate Recommendation
Draft**" on **10 September 2026** (matches repo HEAD date); editors Ningxin Hu
(Intel) and Dwayne Robinson (Microsoft); abstract: "a dedicated low-level API
for neural network inference hardware acceleration."

| component | class | what it does | the day the vendor's browser stops |
|---|---|---|---|
| the spec (`webnn`, W3C S&D — A97) | RULE (text) | `navigator.ml` → `ML.createContext()` (own options or a WebGPU device) → `MLGraphBuilder` (conv2d, matmul, gemm, lstm, …) → compile → `MLContext.dispatch()`; CPU/GPU/NPU; secure context; permissions policy `webnn` | Spec text survives; everything else in this table is the browser's |
| the API in browsers | **VENDOR-HELD** | caniuse `mdn-api_navigator_ml` (read 2026-09-30): Chrome/Edge "Disabled by default" from 112 through 157/154, Firefox "Not supported" 2–160, Safari "Not supported" through 27.2; **global usage 0%** | The estate's pages keep working — they never depended on it (§7); a default-on flip is the trigger, not an assumption |
| `webnn-polyfill` (Apache-2.0 — A99) | RULE (library, TensorFlow.js-backed) | Runs WebNN-shaped code on TF.js where the API is absent | Keeps running; it is the compatibility story for "write WebNN now, run everywhere" |
| `webnn-baseline` (Apache-2.0 — A99) | RULE (pure JS, "double-precision baseline implementation of WebNN operations **for testing purpose**") | The reference oracle: slow by design, correct by construction, exists to TEST fast implementations | Keeps running; its role is the estate's synthetic-vs-measured law in spec form |
| `webnn-native` (Apache-2.0 — A99) | RULE as code, **stale** | Standalone native impl (DirectMLX backend matrix in README); last commit **2023-04-06** — the standalone impl was folded into browser engines (Chromium/Dawn), the repo is a fossil | Already effectively stopped; do not adopt |
| `test-data` repo | RULE (weights) | "Reusable model weights and other test data" (no LICENSE file found at read — UNVERIFIED terms for any actual lift) | — |

**Verdict: TAKE the shape, WAIT the API.** WebNN is what the estate's
`local-agent` already does by other means — build a graph, run it on the
device's silicon — moved into the platform. But at read time it is
disabled-by-default everywhere (caniuse, above) and Mozilla-positive only as
a position (#1215, label `position: positive`, closed 2026-01-12; reasoning
text not read). The estate's rail stays WebGPU/web-llm; **the adoption
trigger is banked in §8-S2, and the standing law is that no surface
hard-requires a disabled-by-default API** (the onboarding law already
forbids the wall this would build).

## 3 · The built-in AI family — stable where Chrome says, unpinnable everywhere

Chrome's hub page (`developer.chrome.com/docs/ai/built-in-apis`, page
self-dated September 12, 2025 — statuses are page-at-read, may lag):
Translator "available from Chrome 138 stable", Language Detector "Chrome 138
stable", Summarizer "Chrome 138 stable"; **Prompt API "Chrome 148"** (web;
"Chrome 138" extensions); Writer / Rewriter / Proofreader "Developer trial"
(Proofreader "also available in an origin trial"). The `prompt-api` explainer
at `9fcb9a4e`: "Implementations are experimentally available in Google Chrome
and Microsoft Edge."

Two explainer lines carry the whole estate bearing:

1. `translation-api` at `4334048`, Goals: "Allow a variety of implementation
   strategies, **including on-device vs. cloud-based translation**, while
   keeping these details abstracted from developers." → Privacy is a
   per-browser implementation fact, never a spec promise.
2. The same explainer: language packs arrive by "on-the-fly downloading of
   different languages instead of assuming all are present from the start" —
   the weights ride the **vendor's** component-updater wire, not the estate's
   door, and are outside the page's custody entirely.

| API | class | shipped state (page-at-read) | the estate's custody |
|---|---|---|---|
| Translator + Language Detector | VENDOR-HELD (runtime + weights) | Chrome stable 138 | None. The estate's L-VERIFY/SRI law (sw.js pins, `2026-09-05-local-agent-webllm.md`) cannot reach browser-held weights at all |
| Summarizer | VENDOR-HELD | Chrome stable 138 | none |
| Prompt API | VENDOR-HELD | Chrome stable 148 web (hub page); Edge experimental ("experimentally available", explainer) | none; output differs per browser/model — Mozilla's standards position on Prompt API is **`position: negative`** with label `concerns: interoperability` (#1213, closed 2026-05-05; reasoning text not read) |
| Writer / Rewriter / Proofreader | VENDOR-HELD | developer trial / origin trial (hub page) | none |

Real-world use exists (not estate evidence, adoption signal only):
`awesome-built-in-ai` at `e4a67d4` lists Elk and Phanpy shipping "single-click
social feed localization" on Language Detector + Translator "[As of: 2026.06]".

**Verdict: LEAVE the dependency, TAKE two stable rails as enhancement-only.**
Translator and Language Detector are the only members of the family that are
(Chrome-page) stable, genuinely useful to the estate's tongue lane (§7), and
free — no key, no server, no 204 MB. But by the two explainer lines above they
are VENDOR-HELD with vendor-chosen privacy, so they may never sit under a
member-facing claim of "local" or "private", and never behind a wall. The
Prompt API family (Writer/Rewriter/Prompt) is LEAVE outright for
member-facing surfaces: unpinnable weights, per-browser output, one engine
negative on interop grounds — incompatible with the estate's receipt laws
(a receipt must cite what produced it; here that is "a browser build",
§8-S3).

## 4 · WebMCP — the estate's agent doctrine, arriving from outside

`webmcp` at `d61d0e6`: "lets developers expose web application functionality —
either JavaScript functions or HTML `<form>` elements — as 'tools' with
natural language descriptions and structured schemas, designed for AI agent
ingestion," invocable by agents "built into the browser, hosted in iframes,
or running in extensions."

| component | class | the shape, as written | shipped state |
|---|---|---|---|
| `document.modelContext.registerTool()` | RULE (page-held capability) | Imperative tool registration: the PAGE declares its own functions + schemas; a Model Context Provider "registers tools by calling the `document.modelContext.registerTool()` method" in "a secure, browser-mediated environment" | Origin Trial **Chrome 149** and **Edge 150** (`implementation-status.md` at HEAD) |
| declarative counterpart | RULE | "allows the browser to automatically synthesize tool definitions from `<form>` elements" — a form IS a capability description | same |
| permission gate | RULE (platform policy) | "`registerTool()` will return a promise rejected with `NotAllowedError` … when the permission is disabled, whether by the `allow` attribute or the `Permissions-Policy: tools=()` header" — a named, policy-gated, revocable capability | same |
| cross-origin exposure | RULE (policy) | `registerTool()` + `exposedTo` for cross-origin iframes | same |
| the callers | VENDOR/THIRD-HELD | `implementation-status.md`: "WebMCP is supported in **ChatGPT Desktop**"; Brave Leo "Experimental support"; Meta Ray-Ban Display "coming soon … letting Meta AI on the glasses call tools registered with `document.modelContext.registerTool()`" | live in ChatGPT Desktop today |
| engine positions | — | Mozilla `position: neutral` (#1412, closed); **WebKit `position: oppose`** (#670, closed; flags include privacy, security, portability, venue) | Safari adoption not coming as read |

**Verdict: WATCH, and prototype exactly one tool.** This is the agent-door
doctrine the estate already lives (capability receipts, bearer-gated doors,
one concept per click) arriving as a platform API — with the signature
inverted: the estate's doors gate AGENTS OUTSIDE calling in; WebMCP lets the
PAGE publish tools TO agents. The estate can register a read-only capability
(vending catalog query or buzz directory read) behind the origin trial
(§8-S4) — nothing member-facing rests on it: WebKit opposes, Mozilla is
neutral, and the trial ends when Chrome says.

## 5 · DAOP + Hybrid AI — the box-vs-tab decision, as protocol text

`daop` at `d65aafc6` (author Jonathan Ding, Intel): the "Dynamic AI
Offloading Protocol" — the cloud↔client "where does inference run" question.
Goals: "Enable efficient offloading of AI inference from cloud to client
devices," "Define a protocol that works regardless of whether the decision
logic resides in the App's cloud or on the client." The mechanism:

- **Callee-responsible QoS**: the device that would RUN the model evaluates
  it, "By shifting responsibility for QoS evaluation to the callee, the
  protocol achieves both privacy protection and more reliable offloading
  decisions."
- **Weightless by design**: `estimateQoS()` takes "a `.webnn` graph
  description as input" with "late binding **where weights are only provided
  and processed after the offloading decision is made**" — the probe ships
  shape, never weights.
- **Anti-fingerprinting**: `estimateQoS()` returns "a `performanceTier`
  string" — coarse tiers "while still enabling meaningful offloading
  decisions."

`hybrid-ai` at `03b1c04` is the discussion shell only ("hosts discussions
and any non-normative reports"), untouched since 2025-04.

**Verdict: TAKE the pattern, build nothing.** The estate already codes this
decision by hand (`local-agent`: no WebGPU → P1 sidecar door; §7). DAOP is
that fallback generalized and standardized — a proposal, not a shipped API.
The raid banks its two rules: the placement probe is weightless, and the
device that runs the model is the one that says whether it can.

## 6 · The dormants and the shelf

- `model-loader` at `14b035e`: README states "__This incubation is on
  pause__," pointing at issue #36; no commit since **2024-02-26**. Nothing
  builds on it.
- `webnn-native`: stale since **2023-04-06** (§2).
- `webmachinelearning-ethics` at `c10760e` (WG deliverable, editor's draft):
  "documents ethical issues associated with using Machine Learning on the
  Web, to help identify what mitigations its normative specifications should
  take into account" — read as existence + intent; content not audited here.
- `webnn-docs` (CC0-1.0) and the `awesome-*` indexes: navigation shelf.

---

## 7 · THE ESTATE'S OWN PIECES — the two home rails, read at `41c35072c`

| piece | where | class | the one line |
|---|---|---|---|
| **in-tab LLM** `surfaces/local-agent/` (index.html + qwen05/ + sw.js) | browser | RULE (client) + estate door | Qwen2.5-0.5B-Instruct runs IN THE TAB via vendored web-llm 0.2.84 (Apache-2.0, L-VERIFY'd at landing); **sw.js is the pin** — "every artifact is hashed by the service worker BEFORE a byte reaches the engine; mismatch → 410 refused loudly" (receipt `2026-09-05-local-agent-webllm.md`; 17 pins at landing, 20 sha256 strings in file at read); weights mirrored on the estate door `relay.skaists.dev/model/`, "zero HF/jsdelivr at render"; **the honest fallback**: no WebGPU → the P1 sidecar — the estate's hand-coded DAOP |
| **pocket model W-1** `surfaces/review.html` §5 | browser | RULE (client) | SmolLM2-360M "≈204 MB fetched ONCE … then Cache Storage scopes … zero network thereafter" (`2026-09-04-webllm-w1-reinvite-timer.md`) |
| **box rail** `ops/bmeshllm/` (staged, not deployed) | the box | SERVER (estate-run) | `buzz-compute.service` llama-server, model `qwen2.5-3b-instruct-q4_k_m.gguf`, "bound 172.18.0.1:8090 (docker bridge only)"; meter-gate + receipts sidecar in front (README:5-9); the 4B step is staged behind the 16 GB threshold (`2026-09-15-raid-16gb-threshold.md`) |
| **the gate** `e2e/local-agent-shot.mjs` | CI | RULE | COLD/WARM/OFFLINE proofs: "OFFLINE — network off, the tab keeps answering" — the estate's own availability law, already measured |
| **tongue lane** `docs/COVERAGE-TABLE-2026-08-29.md` | tree | RULE (data) | "7305 visible strings · 700 keyed (10%) · 6605 unkeyed · 0 empty cells"; "all 27 docked tongues … at 100% non-empty … **The gap is KEYING, never translation**" — the map the Translator API slice reads (§8-S1) |
| **privacy-lens** `surfaces/privacy-lens.html` | browser | RULE (client) | the estate's AI-adjacent privacy surface (82,510 bytes at read); any built-in-AI wording lands under its lens (§8-S3) |

The estate and the group are building the same triangle from opposite
corners: the group standardizes **the browser as runtime** (weights inside
the vendor's binary, page brings prompts); the estate built **the page as
runtime custodian** (weights estate-mirrored, sha256-gated before a byte
runs). Neither replaces the other; §8 is the exchange.

## 8 · WHAT LANDS — the slices

> **RIDER 2026-09-30 (founder order "get it all done", same branch):** S1, S3
> and S4 are **EXECUTED** — `surfaces/browser-translate.js` + `surfaces/index.html`
> + lang.js census chrome (`#brtrctl`); `docs/RULINGS-2026-09-30.md` (W1–W6);
> one read-only WebMCP tool in `surfaces/vending.html`. Tests:
> `e2e/browser-translate.test.mjs` (5) + `e2e/webmcp-vending.test.mjs` (5),
> vm-executed; regression suites green. The founder's WebMCP question — "WE
> ALREADY HAVE PUT IN WEBMCP IN ONE SURFACE ALREADY?" — answered by grep at
> build time: zero surfaces before, exactly one now. S2/S5/S6 stay banked
> triggers/patterns.

| # | the gap (fact) | the slice (one sentence) | owner |
|---|---|---|---|
| S1 | coverage table: 6,605 unkeyed strings across 27 tongues; Translator + Language Detector Chrome-stable since 138, zero-download after pack fetch | **READER-SIDE TONGUES**: feature-detected, opt-in "let your browser translate the unkeyed prose" on ONE surface — enhancement-only; keyed floors stay ABSOLUTE (founder reframe: keying backlog, never translator-substituted); absent API → honest-degrade, no wall (onboarding law) | language lane seat (z3.2 surfaces) |
| S2 | caniuse: navigator.ml disabled-by-default in every engine, 0% usage | **WEBNN TRIGGER BANKED**: adopt only when default-on in one stable engine AND polyfill parity; standing law: no surface hard-requires a disabled-by-default API | banked here; no owner until trigger |
| S3 | translation-api explainer allows cloud impls; browser weights are outside L-VERIFY/SWI reach by construction | **MODEL-CUSTODY WORDING**: one law paragraph — a built-in-AI receipt cites browser+version, never bytes; "local/private" over a built-in API is a per-browser measured claim or it is unsayable | law/spec seat (one paragraph, ratified like R-laws) |
| S4 | WebMCP OT live (Chrome 149/Edge 150), ChatGPT Desktop already calls tools; estate has agent doors of its own | **ONE TOOL PROTOTYPE**: register one READ-ONLY estate capability (vending catalog query or buzz directory read) via `document.modelContext.registerTool()` behind the trial token; zero member-facing dependence (WebKit oppose, trial-bounded) | bAiGenT console lane |
| S5 | estate's box-vs-tab fallback is hand-coded; DAOP generalizes it (weightless probe, callee-responsible, tier strings) | **DAOP SHAPE BANKED**: no build — the two rules (probe ships shape never weights; the runner self-assesses) become the estate's wording when the rail multiplies | banked here |
| S6 | CG ethics doc exists; estate holds its own privacy doctrine | no slice: recorded that the estate's doctrine (privacy lens, no living-id leak) is ALIGNED-OR-STRICter; nothing adopted unread | — |

**What the raid does NOT propose:** no WebNN adoption, no Prompt/Writer/
Rewriter/Proofreader use on member-facing surfaces, no model-loader revival,
no webnn-native, no dependency on any vendor page's promise, no replacement
of web-llm/llama.cpp rails, no second translation table.

## 9 · RULES → estate seats

Mechanisms travel, files do not.

| RULE row (source) | lands in | the rule, one line |
|---|---|---|
| translation-api: "on-the-fly downloading of different languages instead of assuming all are present" | language lane (S1) | Tongues are packs the reader's browser fetches; the estate's floors stay keyed counts in-tree |
| translation-api: "on-device vs. cloud-based … abstracted from developers" | law seat (S3), privacy lens | Where a built-in model runs is the BROWSER's choice; the estate never labels it local/private without a measured fact |
| prompt-api: models arrive with the browser/OS; Mozilla negative on Prompt API, `concerns: interoperability` | receipt laws (claim-evidence) | No member-facing text claim rests on an API whose producer differs per browser build; if ever used, the receipt cites the browser, not the model |
| DAOP: "weights are only provided and processed after the offloading decision is made" | local-agent / bmeshllm | The placement probe is weightless — no bytes of model cross a wire to decide where the model runs |
| DAOP: callee-responsible QoS + coarse `performanceTier` | bmeshllm, surfaces | The device that would run the model says whether it can, in tiers — capability reports never become device fingerprints |
| WebMCP: `Permissions-Policy: tools=()` gate, `NotAllowedError` on refusal | agent-door laws | An agent door is named, policy-gated, and revocable — never ambient |
| WebMCP: tools synthesized from `<form>` elements | vending / buzz surfaces | Keep forms agent-legible: a form is already a capability description |
| webnn-baseline: "double-precision baseline implementation … for testing purpose" | estate test law | A reference implementation exists to test the fast one, never to ship |
| estate `sw.js`: "hashed … BEFORE a byte reaches the engine" | — (already law) | The one custody rule no vendor API satisfies; the raid extends it in words (S3), not in reach |

## What is NOT lifted (VENDOR-HELD class — recorded as boarding fact)

Browser-held model weights (unpinnable, uninspectable — the filer's own open
question on mozilla #1215: "Can models be inspected or are they allowed to be
obfuscated?" — unanswered at read); the vendor component-updater wire that
delivers them; Chrome's EPP/origin-trial infrastructure (tokens, allowlists —
a server-held gate the estate only borrows); `webnn-native` (stale 2023);
`model-loader` (paused 2024); `awesome-built-in-ai` (licence NOASSERTION —
index only). The estate's own rails — web-llm in-tab, llama.cpp on the box —
keep everything they have today; this raid adds doors, not dependencies.
