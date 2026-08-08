# DISPATCH — BNR INVITE/ONBOARDING SPEC, from creatormagic recon (2026-08-08)

**Landing metadata (Seat 3; not part of the dispatch text):** received 2026-08-08 by
founder relay into the Seat 3 session. Not previously on the bus — mailbox swept before
landing; no invite/creatormagic dispatch existed, and `creatormagic` appears nowhere in
either public tree (grep receipt in the COURSE_SYNC). Origin as stated by the dispatch
itself: creatormagic recon (Buzz-surface observation; the Buzz mirror is
`skaists/buzz`, pinned `02f640bc4559c48ac0c2ec595ef34dd2c294b0db`). Body below is
verbatim as relayed; nothing edited. Provenance recorded as relay — no seat attribution
invented. **Routing: unrouted — Seat 0/1 to docket the spec draft.**
COURSE_SYNC: `RECEIPT_COURSE_SYNC_INVITE_2026-08-08.md` (2 escalations, 3 fences).

---

DISPATCH: BNR invite/onboarding spec (from creatormagic recon)

1. Two token classes. (a) 1:1 invites (direct pubkey or single-recipient link): single-use, long TTL (7–30 days), auto-reissue on expiry. (b) Social/public invites (posted to X/YouTube): multi-use, capped (e.g., 25–100 redemptions) with an explicit, visible expiry (e.g., 7 days) AND a self-service "Request access" fallback.
2. No dead-ends. When a token is stale/spent, the failure screen MUST offer a one-tap "Request a fresh invite" path (notifies owner / regenerates), never a terminal "expired" message with no recovery — the exact anti-pattern observed in Buzz.
3. Kill the two-stage ambiguity. Validate the invite/approval server-side BEFORE the web page accepts ToS + mints identity, so the user never mints an identity against a token that's already spent. Fail fast, fail clear, with the reason (expired vs at-cap vs revoked).
4. Idempotent re-open. Re-opening a still-valid link must be idempotent (resume, not re-consume). Re-opening an invalid link must route to the "Request access" fallback.
5. Owner controls. Give community owners: use-count + TTL sliders per link, live redemption counter, one-tap reissue, and a "convert public-post link → request-access gate" toggle.
6. Identity minting parity. Preserve mobile-native identity minting for invite-coded joins (confirmed to exist in Buzz); do NOT gate invite joins behind a desktop-pairing wall. Keep the desktop-pairing requirement (if any) only for the bare add-community path.
