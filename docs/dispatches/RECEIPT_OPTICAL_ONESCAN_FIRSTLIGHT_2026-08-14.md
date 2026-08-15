# RECEIPT — one-scan optical onboarding: first light on stock hardware
**Seat 3 · 2026-08-14 · founder-verified beta**

Two live receipts, same day, founder's own devices:

1. **First optical transfer:** 186 bytes received as light — laptop wizard QR →
   phone camera → validated `bnr-pair-request` — served over GitHub Pages https.
   *"ran the mobile page from github pages and it worked perfect. 186 bytes of light."*
2. **One-scan install+pair on the mass-adoption device class:** stock **Samsung
   Galaxy A16 camera app** (no BNR software present) → scanned the wizard QR →
   opened the link → receiver page installed → envelope delivered via the
   #fragment (touched no server) → consent shell reached.
   *"worked perfect from my dumb stock samsung a16 camera app."*

What this proves, precisely: the entry funnel requires **no app, no account, no
BNR software, no flagship hardware, and no server that ever sees the payload** —
a budget Android's built-in camera is a complete on-ramp. The doorstep funnel's
stage 0→2 is live end-to-end; the incumbent QR-login gesture now bootstraps a
sovereign ceremony instead of a vendor session.

Stack: `surfaces/onboarding/` (wizard `4077cf4`, receiver, vendored MIT encoder
jsQR-conformance-proven) · lanes: Pages https (live), relay `/onboard` routes
(localhost/VPS) · spec: `docs/UX-OPTICAL-PAIRING-1.md`.

Open legs, in build order: reply lane (double-flash), iOS in-app decoder,
`bcomb` scaffold. INDEX row: Cowork's standing duty.
