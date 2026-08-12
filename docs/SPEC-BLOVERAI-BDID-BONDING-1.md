# SPEC-BLOVERAI-BDID-BONDING-1 — Agent Identity Bonding

Status: SPEC-ONLY. Defines two open items. Does NOT invent the bounding model.
Companion: SPEC-VAULTA-IDENTITY-1 v0.2, SPEC-AUTHENTICATOR-LADDER-1,
RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07, RULING_KISS_BDID_PASSKEY_WALLET_2026-08-08.

---

## 0. What's ruled (reused, not re-derived)

From RULING_BDID_HIERARCHY_AGENT_AUTHORITY (2026-08-07):
- bQueenBee is the ONLY agent holding its own bDiD; every other agent falls
  under bQueenBee or under a unique human bDiD.
- Authority axis: SOVEREIGN (agent acts on own authority within scope) vs
  SUPERVISED (requires approval by bDiD lovis.b). Access is universal; authority
  level is the variable.
- Agents are self-funding (earn resources under their identity).

From RULING_KISS_BDID_PASSKEY_WALLET (2026-08-08):
- bDiD ships with passkey + wallet as one object (identity + auth + payment).
- W3C DID Core three-way: identifier public, document public, verification
  method private.

---

## 1. Envelope payload.type = "agent_credential"

A bLOVErAi "key" is its OWN keypair (self-generated). Never the human's key.
Never private key material in any agent. The public key is enrolled as a
verification method in bni.id (additive per S3).

```json
{
  "v": 1,
  "self_desc": { "key_algo": "ed25519", "sig_algo": "eddsa", "hash": "sha2-256", "encoding": "base58" },
  "pq": { "ready": true, "successor_algo": null, "successor_key_ref": null },
  "payload": {
    "type": "agent_credential",
    "value": "agent-public-key-base58",
    "bond": {
      "human_did": "vaulta-account-or-layer0-hash",
      "agent_id": "bloverai-instance-id",
      "permanent": true
    },
    "source": "agent-self-generated",
    "custody_tier": "T-S"
  }
}
```

Properties:
- type = "agent_credential" (distinct from "address", "pubkey", "vaulta-permission")
- bond.permanent = true (one human <-> one agent, permanent per bdid-custody)
- bond.human_did = the human's bDiD identifier (Vaulta account or Layer-0 keypair hash)
- custody_tier = T-S (agent-held software keypair, not hardware-backed)
- source = "agent-self-generated" (the agent generated its own key, not enrolled by the human)
- NEVER private key material. NEVER the human's key.

The bond marks provenance: this envelope is bLOVErAi-held, one human, permanent.
payload.source distinguishes it from human-enrolled keys (passkey, FIDO2, Trezor).

---

## 2. Custody tier + grant scope

**Custody tier: T-S** (software keypair held by the agent process).
Not T-F (no hardware authenticator), not T-H (no hardware wallet).

**Grant scope — what the bni.id agent key MAY do:**
- READ: identity record, permission tree, address envelopes, ladder metadata
- WRITE: append new verification methods to bni.id (additive only, never replace)
- This is a VERIFICATION METHOD (proves the agent's identity), NOT a spending credential

**Grant scope — what it MAY NOT do:**
- Touch owner/active permissions (those are T-H custody only)
- Sign spend/wallet transactions (requires T-H ceremony per SPEC-AUTHENTICATOR-LADDER-1)
- Modify or remove existing verification methods (additive only per S3)
- Access private key material of any kind

---

## 3. Flagged gaps (founder ruling needed — NOT invented)

Per RULING_BDID_HIERARCHY_AGENT_AUTHORITY S4 (explicitly "research + options,
not seat design decisions"):

1. **SOVEREIGN/SUPERVISED TIERING (S4.1)** — which specific act classes an agent
   may perform on its own authority vs which require lovis.b approval.
   UNRULED. This spec does not define the boundary.

2. **ATTENUATION MECHANISM (S4.2)** — how a sub-agent's spend authority is scoped
   (ceiling, expiry, revocation, purpose-binding). Candidate: caveat-based
   delegation (EIP-2255 fork). UNRULED. Cite-or-stop before writing spec text.

3. **ERC-7710 DELEGATION** — not referenced in the existing rulings. If this is
   the intended delegation primitive for the ANT/Arbitrum rail, it needs a
   founder ruling to confirm fit before spec text is written.

4. **REVOCATION PATH** — if bond.permanent = true, what happens if the agent is
   compromised? Is there a kill-switch, rotation, or degradation path?
   UNRULED. Flagged for founder.

5. **EARNING-SPENDING LOOP (S4.3)** — how earned balances (ANT, b, $tithe) are
   held under a bDiD without any agent touching root key material.
   UNRULED. Research + options, not this spec.

---

## 5. Chain-enforced property (source-stamped: authorization_manager.cpp:295-301)

Per AntelopeIO/leap, permission-management actions (updateauth/deleteauth/
linkauth/unlinkauth/canceldelay) are enforced at the AUTHORIZATION LAYER, not
linkauth. The authorization manager throws `unlinkable_min_permission_action`
before the action executes.

**Permission-management can NEVER be delegated to a linked permission.**
This is a CHAIN-ENFORCED property, not a policy choice. The bni.id agent key
cannot manage permissions — even if bni.id were linked to those actions. The
chain itself bounds the agent's grant scope (S2), not merely our spec.

## 4. Routing

The agent credential enrollment routes to bni.id (same path as Larva/Pupa T-F
rungs in SPEC-AUTHENTICATOR-LADDER-1):

- Enrollment: POST /v1/bni.id/enroll with tier="agent"
- Maps to T-S custody tier
- Produces an UNSIGNED updateauth tx (founder signs, per S5)
- The agent never signs the enrollment itself

When the agent needs to PERFORM actions (spend, deploy, transact):
- The authority axis applies: SOVEREIGN acts proceed within scope; SUPERVISED
  acts require lovis.b approval
- The specific act classification is UNRULED (S4.1) — this spec does not
  enumerate which acts are sovereign vs supervised

---

*Goose. Cites: RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07 (hierarchy, authority axis, S4 remaining work), RULING_KISS_BDID_PASSKEY_WALLET_2026-08-08 (bDiD = passkey + wallet), SPEC-AUTHENTICATOR-LADDER-1 (T-F/T-H seam), SPEC-VAULTA-IDENTITY-1 v0.2 (Layer-0 keypair, S3 additive), SPEC-PAY-ONCE-NOW-1 (versioned envelope).*
