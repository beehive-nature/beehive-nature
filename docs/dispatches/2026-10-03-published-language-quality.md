# Published language quality and stack reconciliation — 2026-10-03

Founder priority: published language quality first; synthetic previews now, native review later. Si is the requested quality ambition, not a certification claimed by this dispatch.

## Fresh published evidence

PR #323 merged at c5c15f6d79cdd858815ef7b41817e7febebd9d6b. Pages run 37089683739 succeeded. The open tab still rendered the old edition under v=103debede; navigating to v=c5c15f6d restored 76/76 word routes and 33 language/locale samples. Actual completion statuses were observed for lv, ar, tt, sa and ja. All three registers retained coverage without horizontal overflow in the current browser viewport. These observations prove playback completion, not pronunciation quality. Seven pre-existing genealogy screenshots were not edited.

## Inventory: use each stack for its actual job

| Existing resource | Evidence and present boundary | Quality-first use |
|---|---|---|
| Shared language corpus and dock | surfaces/lang.js, surfaces/blanguage.html; existing coverage measurement and floors | Preserve authored keys and provenance. Nonempty cells are not linguistic approval. |
| Browser speech + eSpeak NG | PLUR bvoice module; assets/plur-voices/manifest.json; public playback above | Immediate fixed previews; exact-language matching and visible approximations. No arbitrary-text fallback claim. |
| Browser Translator | surfaces/browser-translate.js; deployed reference in index.html | Optional reader draft only. Corrected stale Translation API name to Translator, excluded keyed text, and avoided replacing containers with text. Live inference remains unverified. |
| MADLAD-400 | docs/ledger/pirate-haul-candidates.md; https://huggingface.co/google/madlad400-3b-mt | Broad draft candidate generation for comparison against source meaning; no local serving integration found in inspected PLUR code. |
| OPUS-MT | same historical ledger; https://github.com/Helsinki-NLP/Opus-MT | Pair-specific translation candidates; verify the exact language pair, model and license before adoption. Not a PLUR runtime. |
| Bergamot | same ledger; https://github.com/browsermt/bergamot-translator | Browser translation candidate where model packs fit. Not proof of universal language support or current integration. |
| IndicTrans2 | same ledger; https://github.com/AI4Bharat/IndicTrans2 | Indic-language comparison candidate; exact language/script support must be established per item. |
| Kokoro | crates/bmesh-hwfit/src/catalog.rs; docs/receipts/FIRSTLIGHT-AGENT-0814.md; https://huggingface.co/hexgrad/Kokoro-82M | Neural pronunciation candidate for supported languages. Catalog selection is not installed serving or a quality result. |
| Chatterbox | historical pirate-haul candidate; https://github.com/resemble-ai/chatterbox | Candidate for later voice evaluation; no cloning or new service introduced. Pin code/weights and inspect terms before use. |
| Piper / VoiceVox / AirI pattern | historical voice studies; https://github.com/OHF-Voice/piper1-gpl | Candidate adapters, with per-engine and per-voice checks; historical license summaries are not current clearance. |
| whisper.cpp / voice-scribe | ops/voice-scribe; 2026-09-04-buzz-voice-lv dispatch; https://github.com/ggml-org/whisper.cpp | Transcription, not translation or TTS. Historical Latvian mic proof is not a fresh service measurement or pronunciation approval. |

Primary upstream pages above were opened during this audit. Browser API source: https://developer.chrome.com/docs/ai/translator-api. No upstream model was downloaded or served in this lane. Prior benchmark/latency claims were not promoted to current facts.

## Concrete quality controls

scripts/audit-plur-language-quality.mjs builds assets/plur-voices/quality.json from the actual cards, manifest and WAV bytes. It checks missing samples/cards, duplicate IDs, malformed or silent PCM, and stale durations. CI --check rejects an outdated ledger. The review queue binds text and synthesis input to each exact audio digest, records engine voice, and prioritizes Sanskrit/Flemish approximations plus Japanese/Arabic transformed inputs. Current result: 109 mechanically valid clips, ZERO native-reviewed clips. Native review requires reviewer, date, reference, matching text and matching audio digest; a status label alone cannot promote a recording. Presence of such evidence is not an independent authentication of the reviewer.

Review criteria: meaning in PLUR context, script/dialect, intelligible pronunciation/stress, cultural terms and names, and provenance. Compare replacement candidates per language against this fixed queue; do not replace reviewed source text with machine output or rank every language with one aggregate score. Human/native review remains later as instructed. New model integration and a linguistic benchmark are not complete.

## Checks and stale CI

Five voice-routing/audio tests and six browser-translation boundary tests pass locally. No localhost browser server was run. Existing rendered tests are left for GitHub CI. Updated old browser-only test expectations and the speech-event stub. The parent-only eternal tests now fixture the festival iframe rather than count its independent RPC reads as PLUR gesture transmissions; festival behavior retains its separate suite.

Previous full CI run 37089684100: static passed; node/eternal/wallet failed. PLUR-specific failures included the obsolete optional-example copy, obsolete “say N words” assertion, and festival RPC reads in parent-only tests. Other failures (comprehension, engineflow, wallet, bottom-half) are not claimed resolved here. Public deployment, focused tests and the broad suite are distinct.

## Upstream priority freshness

Fresh x0x discussion check found the standing handoff itself stale: #622's latest dirvine comment (2026-09-30) moves remaining work BACK to #504, which is open. #505's latest dirvine comment (2026-09-15) records field acceptance. No new backend measurement or communication was performed. This publication-quality lane does not depend on promoting an x0x binary.

Follow-up: PR #329 first CI passed the PLUR rendered adapters and voice ledger, but caught a missed atlas-template version bump. Corrected scripts/build-atlas.mjs and regenerated; estate-source now passes 11/11 locally. All 32 non-English language/locale samples subsequently completed playback on the published page; the English route uses the installed browser voice.
