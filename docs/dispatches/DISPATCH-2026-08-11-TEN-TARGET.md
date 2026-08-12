DISPATCH-2026-08-11-TEN-TARGET — ten-target raid ruled, full steam, staged. Per verdict-set (NOT ingest-all-ten). L-VERIFY raw LICENSE at pinned commit before touching any repo; report verbatim if a license differs from the ledger.

STAGE 0 — PRIMITIVES FIRST (build these before onboarding any app; each app silos without them):
  P1 bDiD identity rail — the join key every app authenticates against.
  P2 Autonomi+Arweave asset+receipt store — content-addressed, signed receipts (SPEC_LEXICON shape), referenced downstream by hash.
  P3 BNR sovereign MCP tool-gateway — Extism/wasmtime-sandboxed, capability-scoped, over Buzz, operating-room dispatch law. THIS is the Zapier replacement.
  P4 bACCORD spine — accord/escrow front-door; Documenso is its human-facing signing artifact; baton fence before capital movement.
  Deliver as specs/scaffolds; each names its acceptance criteria.

STAGE 1 — SELF-HOST THE FIVE TAKEs (rent-free, on-seat), each behind P1 identity + writing assets to P2:
  - Penpot (MPL-2.0) — standalone self-hosted design service (Clojure = run-not-port).
  - Excalidraw (MIT) — embed editor + self-host excalidraw-room (never the hardcoded oss-collab URL).
  - listmonk (AGPL-3.0) — Go single-binary campaign manager; wire SMTP egress (self-host Postfix first).
  - RustDesk (AGPL-3.0) — self-host client + hbbs/hbbr; **NEVER the public server**; bDiD-gated consent-per-session + audit; BNR-signed builds only.
  - Documenso (AGPL-3.0) — human-facing signing for bACCORD; CA-cert + RFC-3161 timestamp; STOP at regulated execution (baton fence).
  AGPL law: any modified network service triggers source-disclosure — flag each for counsel; do not merge AGPL code into the Rust core, run as service-behind-API.

STAGE 2 — SOVEREIGN BUILDS (harvest pattern, do NOT adopt the code):
  - Dub → BUILD sovereign resolver (axum-localhost/edge + self-hosted ClickHouse/tantivy; aggregate/privacy-preserving; NO user surveillance). Do NOT self-host Dub (Tinybird-locked).
  - fluidVoice → BUILD voice layer on whisper.cpp (MIT/ggml); reference its push-to-talk/Command-Write UX; do NOT depend on the Mac-only app or its closed model.
  - Immich → BUILD media surface on the local-ML-sidecar + pgvecto.rs pattern; face-tagging on FREELY-licensed embeddings (NOT InsightFace weights); frame as clustering, not biometric.
  - cal.diy → harvest MIT scheduling core, HARDEN for production (upstream says non-production); wire to self-hosted LiveKit.

STAGE 3 — REJECT:
  - Zapier-MCP → LEAVE. Its function is delivered by P3 (BNR sovereign MCP gateway).

LAMINATION: every app authenticates via P1, stores assets/receipts via P2, is reachable to the AI mesh via P3, and routes any value-exchange via P4. That's what makes ten apps one creator workflow.
