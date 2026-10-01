# RAID — webmachinelearning (W3C Web ML CG+WG) — the browser as AI runtime — 2026-09-30

**Seat:** zCode · **Order:** the founder's two links, read at source. Full
study: `docs/raids/WEBML-SORT-2026-09-30.md` (pinned heads, RULE/SERVER sort)
+ `docs/raids/WEBML-PICTURE.md` (one screen). Licence receipts: VERIFIED-FACTS
rows **A97–A99**. Estate read at `origin/main` `41c35072c`. Nothing was built.

| what | state read 2026-09-30 | estate bearing |
|---|---|---|
| **WebNN** (`navigator.ml`) | W3C **CR Draft 2026-09-10** (Intel+Microsoft editors); caniuse: **disabled by default** in every engine (Chrome 112–157), 0% usage; Mozilla position positive; `webnn-native` stale since 2023-04 | **WAIT.** Trigger banked: default-on in one stable engine + polyfill parity. Standing law named: no surface hard-requires a disabled-by-default API |
| **Translator + Language Detector** | Chrome **stable 138** (vendor hub page, self-dated 2025-09-12) | **TAKE as enhancement-only** — reader-side assist for the 6,605 unkeyed strings / 27 tongues (coverage table); keyed floors stay absolute; no wall when absent |
| **Summarizer** | Chrome stable 138 | no slice; same class as below |
| **Prompt / Writer / Rewriter / Proofreader** | Prompt stable Chrome 148 (web); Writer/Rewriter/Proofreader dev-trial/OT; **Mozilla position: negative** on Prompt API (`concerns: interoperability`) | **LEAVE for member-facing surfaces** — unpinnable weights, per-browser output; a receipt can't cite "a browser build" as its producer |
| **WebMCP** (`document.modelContext.registerTool()`) | Origin Trial **Chrome 149 / Edge 150**; **ChatGPT Desktop already supports it**; Brave Leo experimental; Meta Ray-Ban announced; Mozilla neutral, **WebKit oppose** | **One read-only tool prototype** (vending catalog query or buzz directory read) behind the trial; zero member-facing dependence. Doors are named, policy-gated (`Permissions-Policy: tools=`), revocable |
| **DAOP** (`estimateQoS()`) | proposal (Intel, 2026-06) — weightless graph probe, callee-responsible QoS, coarse tiers | **Pattern banked, no build**: the placement probe ships shape never weights; the device that would run the model says whether it can. The estate already codes this by hand (local-agent → P1 sidecar) |
| **Model Loader** | **PAUSED** (README → issue #36; no commit since 2024-02-26) | nothing builds on it |
| Charter (2025-09-25) | CG incubates / WG standardizes; scope now includes "**agentic web usages**"; specs must use W3C S&D; out of scope: "mandating any model schema/format" | the group will never standardize model formats — only APIs over whatever models a browser holds |

**Laws banked by this raid** (full wording in the SORT §8–§9):
1. **VENDOR-HELD class named** — browser-resident features that need no
   operator host (not SERVER) but whose substance lives in the vendor's
   binary; L-VERIFY/SRI cannot reach them by construction.
2. **Model-custody wording**: a built-in-AI receipt cites browser+version,
   never bytes; "local/private" over a built-in API is a per-browser measured
   claim or unsayable (the translation explainer explicitly allows cloud
   implementations).
3. **No surface hard-requires a disabled-by-default API.**
4. Estate's own rails unchanged: web-llm in-tab (sw.js pins) + llama.cpp on
   the box — this raid adds doors, not dependencies.

**Slices handed off:** S1 reader-side tongues → language lane (z3.2); S3
model-custody paragraph → law/spec seat; S4 one WebMCP tool → bAiGenT console
lane; S2/S5 banked triggers/patterns, no owner until they fire.

---

# BUILD RIDER — "get it all done" (founder order, 2026-09-30, same branch)

The gems were executed the same night. **S1+S3+S4 BUILT; S2/S5/S6 stay banked.**

| what landed | where | proof |
|---|---|---|
| **S1 — the reader's browser translates the atlas** | `surfaces/browser-translate.js` (new, icon-only `#brtrctl` button in the language host) + `<script>` on `surfaces/index.html` + lang.js census chrome line | 5 vm tests: no-API → no button no throw; page-already-in-tongue → no offer; translate → lettered leaves only, `translate="no"` (names law) untouched, toggle restores; estate-picker event undoes any browser layer then re-offers; pack failure → honest degrade, page unchanged. **No storage writes (floors law) — proven by a throwing localStorage stub** |
| **S4 — ONE read-only machine door** | `surfaces/vending.html` WebMCP block (`/*WEBMCP-START*/` markers): `read_vending_state` via `document.modelContext.registerTool`, empty CLOSED input schema, whitelist payload | 5 vm tests: absent API → inert; permissions refusal → silence; recording host → ONE tool, spec-exact shape; **the reader's typed name and every derivation of it NEVER cross the door** (asserted field-by-field); chain-unread → "not read yet" in the page's own words |
| **S3 — the laws, ratified** | `docs/RULINGS-2026-09-30.md` W1–W6: VENDOR-HELD class · model-custody wording (receipt cites browser+version, never bytes; "local/private" = measured per-browser or unsayable) · no-surface-hard-requires-a-disabled-by-default API · the S1/S4 shape laws · W6 patterns (weightless probe, callee self-assessment, tiers-not-fingerprints, form-as-manual) | provenance quotes the execute order verbatim |

**The founder's WebMCP question, answered with the grep:** "WE ALREADY HAVE
PUT IN WEBMCP IN ONE SURFACE ALREADY?" — at build time `grep -rli
"modelContext|webmcp" surfaces/` returned **zero files**; it exists in
exactly one surface as of this rider.

**Regression, all green:** lang-coverage 13/13 · atlas 14/14 ·
vending-eternal 7/7 · vending-machine 6/6 · vending-cert 2/2 · vending-deck
13/13 (vending-eternal catches the inline-block addition; lang-coverage
catches the census-chrome edit). New: browser-translate 5/5, webmcp-vending
5/5. Browser-render pass (390px shots, real Chrome with the API present)
NOT RUN — needs an origin-trial/flagged browser; the vm worlds cover the
logic and the absent-API world covers today's every-browser case. No
surfaces added or moved — registration ritual not triggered; estate.json,
atlas and review.html untouched.

— zCode
