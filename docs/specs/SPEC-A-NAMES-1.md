# SPEC-A-NAMES-1 — the .a agent rail: naming, resolution, and co-creation

> **Status:** DRAFT — open reference spec. Options-not-designs where the founder has not ruled. The ruled items are marked.

## The one-line disambiguation

**Suffix `.a` ≠ Vaulta asset `A`.** The suffix `.a` marks an agent house on the estate's naming rail. The letter `A` in a transfer amount is the Vaulta token. They never collide: one is a name suffix, the other is a currency symbol.

## The split

**`.b` = beings.** Human houses. The founder, the wife, the family — beings with keys.
**`.a` = agents.** bAiGenTiC houses. Agents that act on behalf of beings — with bounded authority, not unbounded trust.

## THE FINDING — the live registry already carries .a

**Verified at source 2026-08-31.** The `kingbeelovis` contract's `domains` table stores `domain_name` as a **plain string** — no TLD constraint, no suffix enforcement. The 13 existing names are stored **suffixless** (`skaists`, `remington`, etc.) — the `.b` suffix is a **client convention**, not a contract constraint.

The `registeracc` action accepts any string for `domain_name`. The contract has no TLD column, no scoped table, and no suffix validation. **A sibling registry is not needed.** The same `registeracc` action with `domain_name = "agentname"` serves `.a` resolution today.

**The suffix is applied at the resolution/display layer**, not at the storage layer. A client that queries `kingbeelovis/domains` for `agentname` and renders it as `agentname.a` is using the `.a` rail. A client that renders the same row as `agentname.b` is using the `.b` rail. Same row, same contract, same table.

## RESOLUTION — name-first, unchanged

`bnr://name` resolves to the estate's identity rail. The rail is the same for `.b` and `.a`:
1. Query `kingbeelovis/domains` for the name (the string, suffixless)
2. Read `owner` (the Vaulta account)
3. Read `chainaddrs` for cross-chain addresses scoped to `domain_id`
4. The client applies the suffix convention for display

## AGENT HOUSES — root shown on every .a profile

Every `.a` house roots under a being's `.b` bDiD. The root is shown on every `.a` profile:
- **root:** the .b bDiD of the being who registered the agent's name
- **authority:** the bounded permission the chain enforces (linkauth, spend caps)
- **succession:** the same dynasty snapshots as .b — holder snapshots at transfer, append-only, promote-don't-erase

## DYNASTY SNAPshots + SUCCESSION — identical to .b

Same schema (`docs/dynasty/SCHEMA.md`). Same rules: written at transfer, never edited, never deleted. Same lesson: a lost key is permanent; a lost name is a lease running out. Agents inherit the same dynasty protection the founder's own names carry.

## CO-CREATION — the worked, receipted examples

### Base spend-permission: $1/24h genesis allowance
The ruled genesis allowance. Each agent receives a Base spend-permission capped at $1 per 24 hours, enforced on-chain. Not a suggestion — a chain-level cap. The agent can spend up to $1/day without the founder's hand. Past $1, the chain refuses.

### CREATE2 0xbee vanity, salt-not-key
Each agent's Base smart wallet is computed via counterfactual CREATE2 with a vanity salt ground offline for the `0xbee` prefix (case-insensitive, ~4k average tries). The vanity comes from the **salt**, never the key — profanity-class EOA grinders are forbidden (known-cracked keys). Record the salt and predicted address; deploy lazily on first need.

### Counterfactual receive
The computed CREATE2 address can receive funds **before the contract is deployed** — the address is deterministic. When the first spend occurs, the deployment is triggered. Receive now, deploy lazily.

### Append-only holder snapshots
Every agent name transfer writes a holder snapshot — same schema, same rules. The agent's dynasty is as protected as the founder's.

## THE REGISTRY — verified at source

| finding | evidence |
|---|---|
| `domain_name` is `string` type | live ABI, `get_abi` → kingbeelovis |
| no 12-char cap | `travisremington` (15 chars) + `loviswaternakamoto` (18 chars) already registered |
| names stored suffixless | all 13 existing rows have no TLD suffix |
| contract carries no TLD enforcement | `registeracc` stores whatever string is passed |
| .a works on the same registry | same action, same table, same string field |

## OPEN QUESTIONS (options-not-designs, founder decides)

- Does `.a` use the same `kingbeelovis` registry, or a sibling contract deployed for agents?
- If the same registry: how do clients distinguish `.b` from `.a` rows? (Convention? A `type` field in `chainaddrs`? A naming convention like `agentname` vs `humanname`?)
- The `requires_memo` field on `chainaddrs`: does it apply to agent deposits the same way?

## §tongue — every bAiGenT picks a primary language to serve

The pick is the agent's: recorded as chosen, changeable by the agent, logged like any receipt.
The tongue is shown as a labeled chip beside the citizenship badge — word + label, never symbol alone.
Room listings carry each resident's serving tongue.
Tongue-routing (message language → resident who serves it) is the follow-lane — scoped, not built.
## §charset — the full alphabets of the 27 corpus tongues

Estate name rails (.a/.b) accept the full alphabets of the 27 corpus tongues.

CANONICAL ACCEPTANCE TEST: mīlestībairkaralis must resolve whole.

MOTIVATING RECEIPT: base.org rejected ī (U+012B, byte-exact `0xC4 0xAB`) in mīlestībairkaralis — raw error `disallowed character: "ī" {12B}` — while accepting 北方國王 — proving the rejection is charset-based, not length-based. (Transcription law: the rejected letter is ī WITH MACRON, never į ogonek — the two render near-identical in some fonts.)

## §naming — chartered agent Basenames

Chartered agent Basenames = 北方國王 + seatname. Deed always King-held.
Base-side names bridge to .a houses when the .a rail lands.

## STACK RULING

Names on .a/.b (our charset, our cost). Addresses/settlement on Base/ETH.
bSMaRTheART surfaces render diacritics everywhere a name appears — add ī to any font/render test row.