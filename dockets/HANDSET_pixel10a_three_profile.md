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
2. **Relock the bootloader** as the installer's final step. An unlocked
   bootloader means no verified boot, and the device cannot be E4 whatever OS
   it runs. The relock is mandatory. Then turn off OEM unlocking in Developer
   options. GrapheneOS recommends this and Auditor reports its state, but it
   is not an E4 condition under the ladder (E4 = hardware keystore plus
   verified boot). A device that is relocked and verified, with the toggle
   still on, is E4 with a flagged setup step.
3. On first boot, confirm the boot-time notice shows a non-stock OS with a
   **locked** bootloader. A yellow "different OS" notice is expected; an
   unlocked or orange state is not.

## 3. Auditor pairing (the ongoing E4 evidence)

1. Install **Auditor** in the **owner** profile. That device is the *auditee*.
2. Pair it with a **second phone** that runs Auditor as the *auditor*. This
   is the permanent, mature configuration (founder ruling, 2026-09-27).
   **Interim:** until that second physical GrapheneOS device is provisioned, a
   verifier service may stand in, so deployment is not blocked (founder
   amendment, same day). **Status (2026-09-29):** no such verifier service
   exists yet. The Beehive verifier is a separate, later lane (§5, §6.1), and
   this docket builds none. E4 *tier standing* needs more than a pairing: it
   needs the scheduled re-attestation that T3 §2 routes through *our*
   verifier (TOFU to our verifier, rolling attestations; T3 §2 cadence is
   "scheduled, e.g. daily, and on sensitive ops"). So:
   - **Second phone only:** the owner gets local Auditor assurance. Beehive
     receives no re-attestation it can count, so no E4 tier standing.
   - **Beehive verifier (whenever it lands):** the only path to E4 tier
     standing in this docket. The second phone stays the founder-ruled
     permanent auditor alongside it.
   - **attestation.app:** the owner's own monitoring only, never Beehive tier
     evidence.

   Until the verifier lane lands, the handset holds no E4 standing. This is a
   **recorded future dependency** (founder, 2026-09-29), not an open decision:
   the handset's E4 standing waits on the Beehive verifier lane. Each
   verifier pins the auditee's persistent
   attestation key on first use (TOFU), and each keeps its own pin:
   - **Auditor phone:** scanning the QR code pins the key on that phone. Keep
     the phone physically separate from the handset. Losing it means
     re-pairing that phone only.
   - **Beehive verifier** (the only path to E4 standing, per the status
     note above; scheduled remote verification per T3 enrollment §2): pairing pins the key in the
     verifier's own trust state. Losing the auditor phone does not touch it.
   - **Both:** when both are paired, each pin is independent. A mismatch
     reported by either one is a failed attestation.
3. Turn on scheduled remote verification, the same shape as attestation.app,
   and re-attest before sensitive operations (T3 §2 cadence).
4. The Beehive verifier treats the GrapheneOS verified-boot key as a
   first-class result. A non-stock OS is **not** a failure (T3 §2).

A missed attestation, a changed verified-boot key or a failed pairing drops
the device's standing tier. That is ladder behaviour and needs no change.

## 4. The three profiles

| Profile | Name | Holds | Never holds |
|---|---|---|---|
| **Owner** | Sovereign core | Only the day-one T4 allowlist (§4a) | Sandboxed Google Play; experimental Buzz builds; development tooling; root keys or any unbounded fund-moving key (root keys stay on the signer). The one exception is the device's own non-exportable key and its tier-bounded delegation (T3 enrollment §0 and §2), which T4 `wallet/send-limited` needs |
| **Profile 2** | Normal world | Sandboxed Google Play and the proprietary apps that need it (maps, ride-hailing and similar) | Wallet, identity or signer tooling |
| **Profile 3** | Beehive/Buzz lab | Our own debug APKs, W@tch/bViEw builds, experimental wallet adapters, Nostr/Buzz clients, developer utilities | Sandboxed Google Play (initially); production keys; any key that can move funds; Auditor |

Rules that make the layout mean something:

- **Keep Google Play out of the owner profile.** GrapheneOS does not need Play
  as privileged system software, so there is no reason to put it in the
  sovereign profile. Sandboxed Play is installed per profile and only where
  needed: Profile 2 now. Profile 3 gets it only when a concrete Beehive test
  requires Play services (founder ruling, 2026-09-27).
- **Experimental code never shares a profile with signer tooling.** A lab
  build that turns out to be malicious or buggy should find nothing worth
  taking.
- **End sessions for idle profiles.** Profile 3 is closed when testing
  finishes, so its data is at rest behind that profile's own credential.
- **One-way direction.** Promotion from Profile 3 to the owner profile
  requires a **signed release artifact**. A development build never crosses,
  even one built locally by us (founder ruling, 2026-09-27).
- **Profiles are separate spaces on one device, not a defence against the
  device owner.** The owner profile creates, deletes and ends the others. The
  boundary protects apps from each other, which is what this layout needs.

## 4a. Day-one T4 allowlist (owner profile)

Founder ruling, 2026-09-27. Keep it minimal:

1. **Auditor** and the attestation tooling it needs.
2. The **signer companion/interface** for the E5 hardware signer.
3. **Mature** Beehive identity and receipt-verification surfaces the handset
   role needs.

Nothing else. In particular: no experimental Buzz builds, no development
tooling, no root key and no unbounded fund-moving key. The one exception is the
device's own non-exportable key and its tier-bounded delegation (T3 enrollment
§0 and §2), which T4 `wallet/send-limited` needs.

## 4b. Four evidence dimensions, never one flag

The handset's standing is four **independent** properties, reported
separately. Never collapse them into a single `trusted_handset` boolean:

| Dimension | Evidence | Degrades when |
|---|---|---|
| Verified boot | locked bootloader, verified-boot key (§2) | unlocked, or the boot key changes |
| Hardware memory tagging | MTE enabled for the OS and compatible apps | disabled, or an app runs outside it |
| Auditor attestation | fresh attestation from the pinned key (§3); OEM unlocking state reported, with disabled expected (§2, flagged if not) | missed, stale, or pairing broken |
| Profile isolation | owner profile holds only the §4a allowlist | Play or unapproved apps appear in owner |

One degraded property lowers only the authority that depends on it. The whole
handset is never declared simply "trusted" or "untrusted". This keeps the
eventual T4-from-E4 evidence something BNRoSe can reason about item by item.
Hardware memory tagging hardens the device, but it is still not attestation
evidence and does not change a tier by itself (§5).

## 5. What this docket does not claim

- **Verified by the founder** against grapheneos.org (FAQ and releases pages)
  on 2026-09-27. This seat could not reach the site from its build sandbox, so
  the check is the founder's, not the seat's:
  - Pixel 10a is `stallion`, with official production GrapheneOS support and a
    Google minimum support window through March 2033;
  - it has ARMv9 hardware memory tagging, which GrapheneOS enables by default
    for the base OS and known-compatible user apps;
  - installation requires relocking the bootloader, and Auditor distinguishes
    a locked from an unlocked device;
  - disabling OEM unlocking after install is recommended, and Auditor can
    report whether it is disabled;
  - the releases index lists **2026091900** as Pixel 10a Stable and Beta.
    **2026092500 is not Stable**; it was an Alpha build when relayed.
- **Still UNVERIFIED:** the reclaiming of storage that stock Pixel OS
  reserves for AI models (relayed, not re-checked).
- Hardware memory tagging makes certain memory-corruption exploits harder. It
  is not attestation evidence and changes no tier.
- This docket builds no verifier code. Auditor pairing to a *Beehive* verifier
  stays the T3 §2 design, and wiring it is a separate lane.

## 6. Open questions for the founder

1. ~~Which second device is the permanent auditor?~~ **Ruled 2026-09-27: a
   second physical phone**, with a verifier service allowed in the interim
   (§3). Remote verification through a Beehive verifier (T3 §2) is still a
   separate, later lane.
2. ~~Does Profile 3 get sandboxed Play?~~ **Ruled 2026-09-27: not
   initially.** Added only when a concrete test requires Play services.
3. ~~Which Beehive apps are allowed at T4 on day one?~~ **Ruled 2026-09-27:**
   the §4a allowlist.
