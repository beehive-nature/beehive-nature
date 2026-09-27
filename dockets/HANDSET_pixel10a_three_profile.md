⟨Research → Design/Ops · Beehive sovereign handset: Pixel 10a, GrapheneOS, three profiles · 2026-09-27⟩

# Beehive sovereign handset — one phone, three capability boundaries

**Companion to** `TIERED_ACCESS_attestation_design.md` (the evidence ladder)
and `T3_device_enrollment_flows.md` §2 (GrapheneOS enrollment). This docket
adds no new tier. It says how one physical handset is set up so it can earn
**E4** and how its apps are split so that no single app holds every capability
on the device.

**Design law, applied to the phone:** an actor does not get every capability
just because it shares the machine. Profiles are that boundary on the handset,
in the same way `buzz-acp --agent-env-isolation` (skaists/buzz#7) is for agents.

## 1. What this device can and cannot prove

| Question | Answer | Source in this repo |
|---|---|---|
| Highest evidence class | **E4**: hardware keystore plus verified boot, via GrapheneOS attestation and Auditor pairing | ladder §2, T3 §2 |
| Highest access tier | **T4**: `wallet/send-limited`, `farm/toggle`, day-to-day console, with E-bio for sensitive operations | ladder T4 row |
| Explicitly **not** allowed | unbounded spend, **root-key operations** | ladder T4 row |

The phone is therefore the **interface** to the E5 hardware signer (Trezor,
Arculus), never where root keys live. bSAFE root custody stays on the signer.
The phone approves and relays; the signer's own screen and buttons decide.

## 2. Install, then relock (E4 depends on the relock)

Set up the phone before it holds anything worth keeping, because unlocking
the bootloader wipes it.

1. Install GrapheneOS with the official web installer, on the **Stable**
   channel. Do not hand-pick an Alpha build. Newer builds arrive through OTA
   once they are promoted.
2. **Relock the bootloader** as the installer's final step, then turn off
   OEM unlocking in Developer options. An unlocked bootloader means no verified
   boot, and the device cannot be E4 whatever OS it runs. This step is
   mandatory.
3. On first boot, confirm the boot-time notice shows a non-stock OS with a
   **locked** bootloader. A yellow "different OS" notice is expected; an
   unlocked or orange state is not.

## 3. Auditor pairing (the ongoing E4 evidence)

1. Install **Auditor** in the **owner** profile. That device is the *auditee*.
2. Pair it with a second device that runs Auditor as the *auditor*. Scanning
   the QR code pins the auditee's persistent attestation key on first use
   (TOFU).
3. Turn on scheduled remote verification, the same shape as attestation.app,
   and re-attest before sensitive operations (T3 §2 cadence).
4. The Beehive verifier treats the GrapheneOS verified-boot key as a
   first-class result. A non-stock OS is **not** a failure (T3 §2).

A missed attestation, a changed verified-boot key or a failed pairing drops
the device's standing tier. That is ladder behaviour and needs no change.

## 4. The three profiles

| Profile | Name | Holds | Never holds |
|---|---|---|---|
| **Owner** | Sovereign core | Auditor (auditee); the Trezor, Arculus and Vaulta/Anchor companion tooling that *talks to* the E5 signer; bSAFE interface; Beehive identity apps at T4 | Sandboxed Google Play; experimental APKs; root keys (those stay on the signer) |
| **Profile 2** | Normal world | Sandboxed Google Play and the proprietary apps that need it (maps, ride-hailing and similar) | Wallet, identity or signer tooling |
| **Profile 3** | Beehive/Buzz lab | Our own debug APKs, W@tch/bViEw builds, experimental wallet adapters, Nostr/Buzz clients, developer utilities | Production keys; any key that can move funds; Auditor |

Rules that make the layout mean something:

- **Keep Google Play out of the owner profile.** Sandboxed Play is installed
  per profile and only where needed: Profile 2, and Profile 3 only if a test
  truly requires it.
- **Experimental code never shares a profile with signer tooling.** A lab
  build that turns out to be malicious or buggy should find nothing worth
  taking.
- **End sessions for idle profiles.** Profile 3 is closed when testing
  finishes, so its data is at rest behind that profile's own credential.
- **One-way direction.** Nothing is copied from Profile 3 into the owner
  profile except artifacts whose origin has been checked (signed release
  APKs), never debug builds.
- **Profiles are separate spaces on one device, not a defence against the
  device owner.** The owner profile creates, deletes and ends the others. The
  boundary protects apps from each other, which is what this layout needs.

## 5. What this docket does not claim

- The GrapheneOS and Pixel 10a facts behind this layout are **UNVERIFIED by
  this seat**; grapheneos.org was unreachable from the build sandbox on
  2026-09-27. They are carried from a founder-relayed note of 2026-09-26:
  - the device codename `stallion`;
  - production support, with a support window to 2033;
  - the release numbers 2026091900 (Stable) and 2026092500 (Alpha);
  - the reclaiming of storage stock Pixel OS reserves for AI models;
  - the use of hardware memory tagging (MTE) by default.
  Check them against the GrapheneOS releases and device pages before relying
  on any one of them.
- Hardware memory tagging makes certain memory-corruption exploits harder. It
  is not attestation evidence and changes no tier.
- This docket builds no verifier code. Auditor pairing to a *Beehive* verifier
  stays the T3 §2 design, and wiring it is a separate lane.

## 6. Open questions for the founder

1. Which second device is the permanent auditor: a second phone, or a
   verifier service on the oracle box?
2. Does Profile 3 get sandboxed Play at all, or do lab builds have to work
   without it?
3. Which Beehive apps are allowed at T4 on this handset on day one?
