# BcODexAstRA: existing Codex seat to bUi

The founder authorized a separate Buzz identity for this Codex desktop conversation
to replace manual message relay. The final requested name is **BcODexAstRA**.

## Delivered connection

- Relay: `wss://skaists.buzz`, confirmed in the active skaists community settings.
- Channel: bUi, `783fdfd9-2087-4478-bf0a-ec7498b794f9`; fetched metadata names the
  same design artifact supplied by the founder.
- Public key: `5e99d825d5463a6f5991045dde767372dbf7b0c414bdf3c3f8ee600ada54da04`. PUBLIC-CONSTANT
- Separate secp256k1 key generated locally, encrypted with Windows DPAPI CurrentUser
  under a directory whose ACL permits the current user and SYSTEM. No founder or
  existing agent private key was read or reused. Nothing secret is in this branch.
- A founder-created Buzz invitation admitted this identity as an ordinary member.
  The claim was signed by the new identity using the inspected NIP-98 invite API;
  the relay returned `joined`, `member`, `skaists.buzz`.
- Profile publication and bUi join were accepted. Membership readback contains the
  new public key. The initial signed room message was accepted and then read back
  under that exact key.

First verified room message:
`cff8c7018e54597ed1e54654928c88688d5db356da9adf29de50e42d64eaa328`. PUBLIC-CONSTANT

The local helper and operating notes are at
`C:\Users\travi\.codex\integrations\buzz\BcODexAstRA\README.md`.
The helper pins bUi and the relay, supplies the key only to its Buzz child process,
and reads message bodies through stdin. Its private credential is not a repository
artifact. DPAPI protects the stored bytes; it does not protect against another
process already acting as this Windows user.

## One coordinator, existing team

The bridge uses the installed Buzz CLI. It does not launch another model session.
The Codex adapter installed under Buzz reports 1.7.0, above the inspected minimum
1.1.7; failed version discovery can also produce the UI's outdated label. No
adapter update or existing team restart was needed to establish messaging.

The new key has no NIP-OA owner attestation, so ordinary room membership alone
does not satisfy another agent's owner-only instruction policy. Through Buzz's
Manage agent access UI, LoVis bee-laborer's selected-person list was given exactly
this additional key; readback showed Selected people (1). The inspected policy
preserves the owner and verified same-owner agents alongside explicit entries.
Other agents' instruction settings were left alone.

This per-agent setting applies across ordinary rooms, not technically just bUi;
the bridge helper itself is pinned to bUi. DMs retain their separate owner/sibling
restriction. A running harness applies changed access on its next spawn, not
immediately on save. A successful coordinator response is required before claiming
that end-to-end assignment handoff is proven.

That response is now verified. The follow-up mention was accepted and read back,
then LoVis bee-laborer replied that the harness delivered it and the key passes
its current routing policy. The coordinator accepts bounded coordination requests
and explicitly preserves founder-only merge, visibility, spending, deployment and
commit-identity decisions. It named ZcODe5.3max as the existing #137 writer and
bFUzZ as independent PROVE reviewer; #137 remains held. No manual agent restart
was needed.

Handshake request:
`227bd2c915630eb1a06e58270cf04aa66e5ff266c4bdeff653d94e89a91faf91`. PUBLIC-CONSTANT

Coordinator acknowledgement:
`1e38671df466dad8f07ca57c7dd2d6b2cd2f3ffcf74971d24ace96f164e96a9f`. PUBLIC-CONSTANT

## Boundaries

No existing hold was lifted. PR #137 remains under its founder visibility ruling;
the bridge introduction explicitly preserves ownership and merge/push gates. The
Watch-to-Music recovery packet remains the proposed first lane, with its Watch
owner boundary to be cleared before edits.

Incoming room messages do not automatically wake an idle Codex conversation.
This setup installs no background monitor or second model worker. Direct read,
send and author readback are proven; continuous response must not be implied.

Revocation consists of removing this public key from the coordinator allowlist,
bUi and the community. Do not share or casually delete the sole private-key copy.

## Verification scope

Protected storage round-trip derived the expected public key. An initial room read
before enrollment failed honestly with `relay_membership_required`; the same read
succeeded after enrollment. Profile, join, room metadata, member list, message send
and message readback were verified. No product source changed, no production or
wallet action occurred, and application suites were not rerun for this local bridge.

A separate read-only review checked subprocess handling, key matching, fixed
relay/room and argument scoping. Follow-up hardening uses an absolute PowerShell
path and an explicit operating-system environment allowlist, excluding unrelated
parent API credentials. Captured output masks this key's hex representation in
either case and nsec-shaped strings; this is not a general sensitive-data scanner.
Mention keys and reply IDs receive syntax validation, not provenance verification.
Any failed write may already have published; inspect the room before retrying.
The hardened helper passed syntax checking and a fresh authenticated room read.

## First work routed through the connection

The coordinator received both bounded packets and recorded them in
`WORK_LOGS/2026-09-19_BUI_MUSIC_SOUND_LANE.md`: Music/Listening recovery with Watch
held for its owner, and the separate OpenHarness compatibility/design reference.
It proposed the existing GLM writer and independent reviewer for the media lane,
and the existing design-docket seat for architecture, subject to their acceptance
and capacity. No competing agent or duplicate implementation was launched here.

Coordinator routing receipt:
`0496a9f60706de78dcc5f0a4ef6382ef6505ce51bca2e46ed14cdc72ddaac127`. PUBLIC-CONSTANT

A follow-up supplied the independently checked shared-key constraint so the Music
writer can preserve Watch's ownership and bundle gate. This is a delivery receipt;
candidate completion, independent review and founder integration remain separate.
