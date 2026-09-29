# Proof-lights docket: Shields badges derived from signed state

> **Superseded (2026-09-27).** The founder amended this docket the same day.
> See `docs/dispatches/2026-09-27-proof-lights-docket-amendment.md` and the
> docket's §3 and §5.
> - P0 (public Shields) and P1 (a self-hosted Shields with a verifier) are
>   withdrawn. The adopted path is offline rendering and same-origin
>   publication, with no badge server.
> - The three open questions below were ruled in §5: a dedicated
>   CI-attestation key, no badge server, and text first.
>
> This file is kept as the original lane receipt. Do not implement from it.

date 2026-09-27 · seat Claude · founder order: "write the shields badge docket"

## What landed

`dockets/PROOF_LIGHTS_shields_badges.md`:
- **Design law:** don't trust the badge; verify what generated it.
- **Status document:** canonical JSON, signed with a `bsigner` algorithm id,
  with `expires_at`. Every claim carries the source run that produced it.
- **Three phases:**
  - P0: public Shields.io.
  - P1: self-hosted, with a verifier that emits static badges.
  - P2: claims come from signed receipts.
- **Badge rule:** only badges derived by a machine check are shown. Typed
  claims (`TELEMETRY | NONE`, `AUDIT | GREEN`, `KEYS | USER-HELD`) wait for
  a check that backs them.

## Finding that shaped it

Upstream source (badges/shields@0a0ac0e, `doc/self-hosting.md`,
`config/default.yml`) has a single switch, `dynamicAndEndpointBadgesEnabled`,
that disables Dynamic **and** Endpoint badges together. A self-hosted instance
therefore cannot keep Endpoint badges while refusing requester-supplied
fetches. P1 resolves this with a verifier that fetches only allowlisted status
documents, checks the signature and expiry, and redirects to local static
badges, which need no fetch.

## Receipts and limits

- The Shields facts are read from the pinned source. shields.io itself was
  unreachable from the sandbox.
- No code: no verifier, no signing step, no deployment.
- Open questions for the founder were in the docket's §5: the status signing
  key, the P1 host, and the glyph language. All three are now ruled (see the
  banner above).
