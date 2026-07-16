⟨Research → Design/Code · T4: console capability matrix (tier → panel-action ceilings) · 2026-07-16⟩

# T4 — What each tier unlocks in the console

Bridges the attestation ladder (`TIERED_ACCESS`, T1–T5) to the console panels.
Every cell is expressed in the **exact `capability`-crate vocabulary** Code
landed in `18aa8f4`, so this table *is* the gate's data, not a picture of it:
- `Capability { with, can }` — `with` = the panel/resource, `can` = the action.
- `Delegation.tier_ceiling` + `allows_at_tier(.., device_tier)` — the min-tier check.
- **Respect** composes on governance (device tier ≠ unique human; both required).
- **BioPresence** composes (AND-gate) on value-moving and high-governance acts.

## Render law (non-negotiable, carried from §2.5)
A capability the device's tier can't reach is **absent from the UI, not
disabled**. No greyed-out spend button teasing an upgrade — the surface is
exactly the authority. Falling a tier (attestation lapse) *removes* controls
quietly (violet guard-state), never locks the user out of what they still hold.

## Action verbs (`can` paths — hierarchical, `farm/*` covers all `farm/…`)
`view` · `farm/operate` · `servers/operate` · `data/read` · `data/write` ·
`vault/unlock` · `vault/read` · `vault/write` · `ai/converse` · `ai/write-memory` ·
`wallet/view` · `wallet/draft` · `wallet/spend-capped` · `wallet/spend` ·
`wallet/cosign` · `defi/view` · `defi/manage-capped` · `defi/execute` ·
`gov/view` · `gov/propose` · `gov/vote` · `gov/execute` · `bp/operate` ·
`id/revoke` · `id/rotate` · `id/delegate`

## The matrix — minimum tier per panel-action
Legend: **+R** = also requires a Respect (unique-human) bond · **+bio** = also
requires live BioPresence · **—** = never available from any tier (design floor).

| Panel (`with`) | Action (`can`) | Min tier | Notes |
|---|---|---|---|
| **P1 Farming** (`storage.sovereign`) | `view` | T1 | public health glance |
| | `farm/operate` (start/stop/±nodes) | **T2** | VPS peer operates its own nodes |
| **P2 DeFi/LP** (`defi`) | `defi/view` | T1 | positions, income |
| | `defi/manage-capped` (LP add/remove within caps) | **T4 +bio** | bLOVErAi-proposed caps |
| | `defi/execute` (swap/trade, unbounded) | **T5** | moves value = signer tier |
| **P3 Servers** (`servers`) | `view` | T1 | |
| | `servers/operate` (GPU/DATA mgmt) | **T3** | VPS-self at T2 for its own box |
| **P4 bLOVErAi** (`ai`) | `ai/converse` | **T2** | talk/advice, no persistence |
| | `ai/write-memory` (persist to zbData) | **T4** | writing private self-encrypted data |
| **P5 Governance** (`gov`,`bp`) | `gov/view` | T1 | |
| | `gov/propose` | **T3 +R** | a unique human, on a real device |
| | `gov/vote` | **T4 +R** | Respect is the vote weight; device proves the machine |
| | `gov/execute` (enact passed proposal) | **T5 +R +bio** | |
| | `bp/operate` (Vaulta block-producer) | **T5 +R** | dedicated key; Respect-weighted, never token-weighted |
| **P6 Wallet** (`wallet`) | `wallet/view` | **T3** | private balances are not a T1 sight |
| | `wallet/draft` (stage tx, no execute) | **T3** | compose freely; executing is the gate |
| | `wallet/spend-capped` (within daily/per-tx caps) | **T4 +bio** | the BLS-anchored, human-ratified caps (§6) |
| | `wallet/spend` (unbounded) | **T5 +bio** | isolated-signer only |
| | `wallet/cosign` (escrow release) | **T5 +bio** | Trezor co-sign, the marketplace's whole integrity |
| **P7 bData/zbData + Vault** (`data`,`vault`) | `data/read` (bData public) | T1 | |
| | `data/read` (zbData private) / `vault/unlock` / `vault/read` | **T3** | your private layer needs a real key |
| | `data/write` (bData) | **T3** | |
| | `data/write` (zbData) / `vault/write` | **T4** | secrets that *authorize spend* are read at use behind T5 |
| **Identity** (`id`, all panels) | `id/revoke` (kill a device) | **T4** | revoke must be EASY — see asymmetry below |
| | `id/rotate` (root key) | **T5 +bio** | |
| | `id/delegate` (issue a device's delegation) | **T5 +bio** | the anchor grants; nothing else can |

## The load-bearing asymmetry: granting is hard, revoking is easy
`id/delegate` / `id/rotate` = **T5** (only the isolated-signer anchor extends
trust). `id/revoke` = **T4** (any decent device can kill a lost/compromised one,
including revoke-all-except-anchor). Security should make *removing* trust cheap
and *adding* trust expensive — never the reverse.

## Worked reads (same DID, five contexts)
- **Phone (T4) at skaists.social:** votes (`gov/vote` +R), manages farming,
  spends within caps (+bio), writes zbData. Cannot rotate the root key or make
  an unbounded transfer — those want the Trezor.
- **Cafe browser (T1), self-authed:** sees public faces and own governance
  feed; the spend/vote controls aren't greyed — they're **not there**.
- **VPS (T2):** operates its own farming nodes and serves the read-API. Holds
  no funds, casts no votes, writes no zbData — by tier, not by policy toggle.
- **Laptop (T3):** full management + drafting + private reads; value-moving and
  root-identity actions are absent until a T4/T5 device co-acts.
- **Trezor (T5) present:** the only context where unbounded spend, escrow
  cosign, key rotation, and delegation issuance appear at all.

## What Code implements (optional follow-on, after T5)
This table is a **default policy** — encode it as data in `capability` (e.g.
`default_ceiling(with, can) -> (Tier, needs_respect: bool, needs_bio: bool)`),
so the gate has one canonical source and the console reads ceilings rather than
hard-coding them. A user/DAO may *raise* a ceiling (never lower a floor);
Article-VI-class change. Mock-first, table-driven, unit-tested against these rows.

## Open founder questions (do not design past)
1. `wallet/view` at T3 (not T1): confirm private balances should never render on
   a session-only device, even one the user just self-authed on.
2. `defi/execute` at T5 vs a T4-capped tier for small swaps — mirror the wallet
   spend-capped/spend split, or keep all trading at T5?
3. `id/revoke` at T4: comfortable that a T4 device can revoke *other* devices
   (not the anchor)? The panic path is "revoke-all-except-anchor from any T4."

## Cross-refs
`TIERED_ACCESS_attestation_design.md` (ladder + §6 bLOVErAi consent/caps) ·
`T3_device_enrollment_flows.md` (how a device earns its tier) ·
`DESIGN_INPUT_LOVErnment_console.md` §5 (the matrix this supersedes) ·
`capability` crate `18aa8f4` (the enforcement types).
