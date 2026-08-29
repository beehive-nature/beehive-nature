# ASSESSMENT — ERC-8196 (AI Agent Authenticated Wallet) vs our stack (2026-08-29)

**Trigger:** founder shared the Virtuals thread (Aug 28) — "agent-authenticated wallets… limits enforced by the wallet itself rather than promised by an app… a compromised agent can be cut off instantly." ERC-8196 authored by Leigh Cronian (Cybercentry) + Chris Johnson (Virtuals), Status **Final**, Standards Track — **read at source** (eips.ethereum.org/EIPS/eip-8196) per cite-or-stop. Requires EIP-155/191/712/4337/8126; created 2026-03-14.

## What it standardizes (verified at source, not recalled)
An on-chain policy-enforcement interface (`IAIAgentAuthenticatedWallet`) for ERC-4337-class wallets: the owner `registerPolicy()`s limits (allowedActions/Contracts, `maxValuePerTx`, optional `maxValuePerDay`, validAfter/Until, `minVerificationScore`) → the CONTRACT refuses any agent action outside them (`ValueExceedsLimit`, `PolicyViolation`) → `revokePolicy()` cuts a compromised agent off instantly. Actions are EIP-712-typed, nonce'd, entropy-commit-reveal'd, bound to a `policyHash`, with a hash-chained audit trail. It is Layer 2 of a two-layer stack: Layer 1 = ERC-8126 identity/risk scoring (`getLatestRiskScore(agentId)`). Prompt injection is not named; the nearest analog is "Host Manipulation," mitigated by commit-reveal + multi-host sampling.

## Where we already are this thesis (verified in our own tree, same day)
- **"Enforced by the wallet itself, never promised by an app"** — this is our R4 verbatim posture ("a keyless relay can be replaced, so a cap only it enforces is not a cap," SPEC-bSMARTWALLET-1) and the reason R3's ceiling is on-chain Spend Permissions.
- **On-chain owner-set caps with instant cutoff** — the $1/24h genesis allowance on bzCode's wallet (Base Spend Permission Manager `0xf85210B2…67Ad`, revocable by hash) IS this class of enforcement: the contract refuses, not the app.
- **maxValuePerDay** — our spend-cap engine (wallet.html, published Apache-2.0 yesterday) implements the same shape client-side: per-unit/day rolling ledger, sign-time refusal, clear = instant.

## Where 8196 is genuinely ahead of us — and where we would differ
1. **The enforcement point for a stolen key.** Our cap engine refuses at signing time in the wallet's own code — the strongest point available to a client-side wallet, since the key only signs there. ERC-8196 enforces IN THE CONTRACT, which still refuses when the agent's key itself is compromised remotely. For remote agent keys (the b-meter's paid lane, future op-key agents), an on-chain policy module is the stronger model — that is the real adoption question this ERC puts to us.
2. **ERC-8126 risk scoring as a MUST** — every action runs `getLatestRiskScore(agentId)`. We would treat a scoring oracle as an optional input, never a dependency (the no-hosted-provider law; scoring oracles centralize the very trust the wallet is supposed to hold). An 8196-compatible module of ours would make minVerificationScore optional-by-policy.
3. **Hash-chained audit trail** — our receipts (b-meter, append-only) are this pattern server-side; a wallet-side chain is a clean future addition.
4. **Entropy commit-reveal / multi-host sampling** against host manipulation — a pattern note for the b-meter lane, nothing to build today.

## What this changes (and does not)
- **Nothing published yesterday changes**: the rails are Apache-2.0 and the cap engine is a valid client-side implementation of the same owner-sovereignty thesis; 8196 is an interface, not a mandate.
- **The open lane option:** an ERC-8196-compatible policy module as the on-chain ceiling for agent keys (Track A's EVM answer beyond Spend Permissions) — squarely within SPEC-bSMARTWALLET-1 R3's "strongest layer available" ladder. Awaits a founder word; nothing scaffolded.
- **Museum note:** Virtuals co-authored this ERC; we hold PROPOSAL-VIRTUALS-LUNA (PENDING-FOUNDER-COPY) — noted, not acted on.

---
*z1 (zCode), chief. Source read 2026-08-29; our-tree claims checked the same day against SPEC-bSMARTWALLET-1, the wallet surface, and the published licensing.*
