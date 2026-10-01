# 2026-09-27 — Proof-lights docket amended to #250's offline path

Seat: Claude Code. Trigger: the founder's source review of #250 and of `dockets/PROOF_LIGHTS_shields_badges.md`.

## Findings on the docket

1. **Correction.** "Shields fetches nothing" with `DYNAMIC_AND_ENDPOINT_BADGES_ENABLED=false` was wrong. Two things show it at `badges/shields@0a0ac0e` (PUBLIC-CONSTANT):
   - `core/server/server.js`, around line 481: the setting only filters the open-ended service families out of route registration.
   - `services/github/github-license.service.js`: this service, among others, still calls `_requestJson`.
   
   The setting is not a global switch for outbound network access.
2. **Conflict with the implementation.** The docket's P0 (a public Shields Endpoint) and P1 (self-hosted Shields plus a verifier) conflicted with #250's explicit offline, same-origin design. Both phases are withdrawn. The docket now follows the simpler path: measure → validate evidence → derive document → verify signature when supported → render locally → publish same-origin.
3. **Historical versus live.** An immutable, revision-labelled SVG is a historical measurement. The "expired or unreachable shows unknown" rule belongs to a future live path with a freshness evaluator, not to a static file.
4. **Git addressing versus evidence binding.** The git blob id stays as the locator. The integrity commitment is an algorithm-tagged `sha3-256` digest, implemented in #253.

## Founder rulings recorded (§5)

- **Signing key:** a dedicated CI-attestation key (ml-dsa-65 from the `bsigner` registry), isolated from PR execution, pinned by reviewed trust configuration, with versioned ids, validity periods and a rotation and revocation procedure.
- **Hosting:** no badge server.
- **Presentation:** text first, glyphs optional. Three register readings of one fact, evaluated by Fable.

## Not changed

- The held-back claim badges stay held back.
- "REPRODUCIBLE" now explicitly means the instrument exists, not that every subject commit has earned it.
- No code is in this commit. The gate repair is #253, stacked on #250.
