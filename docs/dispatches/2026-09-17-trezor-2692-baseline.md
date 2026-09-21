# TREZOR SUITE 26.9.2 BASELINE + CLEAR SIGNING ASSESSMENT · 2026-09-17

**Seat:** zBlood (`lane/zcode-lineage-import`). **Context:** founder shared Trezor Suite 26.9.2 release notes; three features directly relevant to the zBlood preservation ceremony.

## Baseline recorded

**Trezor Suite = 26.9.2** (September 2026). The zBlood ceremony tests against this version.

## What the release gives us

| Feature | zBlood relevance |
|---|---|
| WalletConnect account-selection UX improved | `blood.html → review with wallet → Suite → device` — the correct signing account is now more obvious |
| Transaction simulation (Blockaid) extended | The founder sees simulation of what they're about to approve before the hardware gate |
| Clear Signing (ERC-7730) rollout | For covered contracts, the Trezor screen shows decoded actions/tokens/amounts instead of raw calldata |

## The zBlood payment path — what the device actually shows

Our ceremony involves TWO transaction types on Arbitrum One:

### 1. ERC-20 `approve(spender, amount)` on the ANT token

**Clear Signing status: LIKELY COVERED.** ERC-20 approvals are among the most common EVM operations; Trezor has decoded these for years. The device should display:
> "Approve [amount] ANT to [spender address]"

This is the **well-understood** half of the ceremony.

### 2. `payForQuotes(payments)` on the Autonomi payment vault

**Clear Signing status: UNVERIFIED — needs device testing.** This is a custom contract call to the Autonomi payment vault on Arbitrum. Whether Trezor's ERC-7730 registry covers this specific contract determines what the founder sees:

- **If covered (Clear Signing):** the device displays decoded payment details — amounts, destinations, the vault operation
- **If not covered (blind signing):** the device shows a warning + the raw calldata or a generic "unknown contract interaction"

**We cannot claim clear signing for `payForQuotes` yet.** The Autonomi payment vault contract address needs to be checked against Trezor's ERC-7730 registry, and the only definitive test is running the actual ceremony with the device.

## The acceptance target

```
blood.html:      preserve this family edition · 24 storage-node payments · 2.04 ANT · ≤3.2 ANT authorization
Suite:           transaction simulation (Blockaid)
Trezor screen:   the STRONGEST AVAILABLE clear-signing representation
human:           confirms on hardware
antd-bridge:     receives payment evidence, never the key
```

The **Understand** layer of the ceremony just got better with 26.9.2 — but the definitive test is running the real flow and seeing what the device displays for the Autonomi vault call specifically.

## Sign & Verify (non-monetary attestations)

Trezor 26.9.2's revamped Sign & Verify supports Bitcoin, EVMs, and Cardano. Relevant for future zBlood features:
- Founder-attested corrections signed on hardware (Marilyn's deceased status, grandparent attestations)
- Archive edition approvals signed on device
- Non-repudiable family testimony with hardware-backed authorship

These don't move money and don't need the payment infrastructure — they're a separate lane when the founder calls it.

## What needs device testing (the founder's gesture)

1. Connect Trezor through Suite 26.9.2
2. Open blood.html → "preserve this archive"
3. When the "review with wallet" step fires, observe what Suite and the device display for:
   - The ERC-20 approve (expected: decoded)
   - The payForQuotes call (the test: clear or blind?)
4. Report what the screen shows

That observation determines whether we need to pursue ERC-7730 registry coverage for the Autonomi vault contract (a community/vendor contribution) or whether it's already covered.
