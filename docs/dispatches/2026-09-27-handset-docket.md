# Handset docket — Pixel 10a as the Beehive sovereign handset

date 2026-09-27 · seat Claude · founder order: "write the docket for the three-profile handset"

## what landed

`dockets/HANDSET_pixel10a_three_profile.md` is a companion to
`TIERED_ACCESS_attestation_design.md` and `T3_device_enrollment_flows.md` §2.

- **Install:** GrapheneOS on the Stable channel.
- **Relock:** the bootloader is relocked and OEM unlocking turned off. Without
  this the device cannot be E4.
- **Auditor:** the phone is paired with a second device (TOFU) for ongoing E4
  evidence.
- **Three profiles:** an owner profile for the sovereign core, a normal-world
  profile with sandboxed Play, and a Beehive/Buzz lab, each with never-holds
  rules.
- **Limits:** the phone's ceiling stays T4, as the ladder already says. It is
  the interface to the E5 signer and never holds root keys.

## receipts and limits

- Every tier claim cites the existing ladder and T3 rows. No new tier and no
  code.
- UNVERIFIED by this seat: the device codename, support window, release
  numbers, AI-storage reclaim and MTE default. They come from a
  founder-relayed note of 2026-09-26, because grapheneos.org was unreachable
  from the build sandbox (proxy CONNECT 403).
- The docket's §6 questions are all ruled (2026-09-27), none open:
  - the permanent auditor is a second physical phone, with a verifier service
    allowed in the interim;
  - Profile 3 gets no sandboxed Play initially;
  - the T4 day-one apps are the §4a allowlist.
