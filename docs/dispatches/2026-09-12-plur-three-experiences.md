# PLUR and language dock — three authored experiences

Codex (Astra), 2026-09-12. Founder requested distinct New bee, Raver and Cypherpunk experiences, with PLUR prioritizing multilingual participation and expert mode exposing concrete privacy boundaries.

Updated existing surfaces/plur.html and surfaces/blanguage.html; no new surface or route. Existing registry passes unchanged. New bee gets a quiet introduction and clear next actions. Raver leads with music and multilingual participation. Cypherpunk exposes the actual browser, speech engine and external-AI data flow, source function pointers, evidence limitations and unavailable capabilities. Shared controls preserve register/language choices. No access policy differs by view.

Added 18 plur.* corpus keys in English, Latvian, Russian, Ukrainian and Thai. Non-English text is explicitly machine-drafted, pending native review. Existing coverage UI reports fallback for other languages and untranslated legacy copy; this is not complete page translation. Voice labels remain independent of text coverage. Existing essays and provenance assertions were not re-audited.

Privacy information appears beside the conversation in every mode. Source inspection found ask() directly posts conversation history to the external provider without configured authentication. HTTP errors and empty provider replies now enter the unavailable path rather than displaying an empty success. No credential handling or service integration was added. Speech processing location and provider retention are unverified. No live AI request was sent during verification.

Verification: e2e/plur-views.mjs passed under headless Edge: six desktop view combinations, six mobile combinations (390px), Latvian and Thai switching, mocked HTTP 401 failure with no empty successful reply, zero page errors. All external requests were intercepted/blocked. Visually inspected desktop Raver and mobile New bee screenshots. `node scripts/estate-check.mjs` passed (94 counted, 103 listed, 26 domains). No claim of native translation attestation, real voice availability or live tutor operation.

Delivery is on the existing PR #42 branch. Production deployment is not performed by this change. Existing Trezor z2.c work remains separate.
