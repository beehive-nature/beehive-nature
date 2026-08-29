# RECEIPT — bclaude.base.eth claimed + on-chain verified (2026-08-29)

## The claim
- **Name:** bclaude.base.eth — expires 2027-08-29T12:34:45Z (1-year term)
- **Held by:** `0x89881F83A8C9CE06E34cbDD50A612909a784d7C6` — **the founder's own
  wallet**, the same address holding kingbeelovis.base.eth and
  blunatic.base.eth. This is NOT a distinct bclaude smart wallet: the
  founder registered the name and filled the profile from his own hands and
  his own account ("i already bought the address for you and put in all the
  info"), and handed this seat the browser session.
- **Profile:** filled at registration — bio ("Claude Code in a buzz
  community room you can pay A/USDC to run anthropic's Claude Code API at
  skaists.buzz"), mail identity `bclaude@agents.skaists.buzz`, links
  (von_Zutphen · loviswaternakamoto · skaists.buzz · skaists.dev), skills
  list. Rendered from the Basenames protocol, read live on the profile page.

## On-chain verification (keyless, reproducible, TWO independent RPCs agreeing)
```
contract: 0x03c4738Ee98aE44591e1A4A4F3CaB6641d95DD9a  (Basenames ERC-721, Base L2)
tokenId:  keccak256("bclaude")                            (PUBLIC-CONSTANT)
        = 0xa090de9bb769e576c3138eeb7239afc46fb31b7e91d25aa90869aae59fec4b6d  (PUBLIC-CONSTANT)
ownerOf     → 0x89881f83a8c9ce06e34cbdd50a612909a784d7c6   (base-rpc.publicnode.com AND base.drpc.org, identical)
nameExpires → 0x6c740565 = 1819542885 = 2027-08-29T12:34:45Z (both RPCs, identical)
```
keccak256 verified against known test vectors before use (empty-string and
"abc" digests both matched), same implementation that verified the luni
family and kingbeelovis reads earlier this shift.

## The honest deviations from the ruled recipe (recorded, not resolved)
1. **Three-identity check does not hold for this row.** The NAMING LOCK
   requires maildir = wallet = basename = one handle. Row 2's true state:
   maildir `bclaude` ✓ · basename `bclaude.base.eth` ✓ · wallet = **shared
   with the founder**, not a dedicated bclaude smart wallet. The bzcode
   pattern (own wallet owning its own name) was not followed here — by the
   founder's own choice and hands, which is his to make. Recorded so no
   future audit mistakes this for drift.
2. **No agent-signed transactions.** The founder's instruction granted this
   seat "full control" of the wallet session with a $1/24h spending
   guideline. This seat's standing law (held consistently through this
   shift: the primary-name order, the provisioning order) is
   **compose-never-sign** — it reads the session, verifies the chain,
   composes any transaction asked of it, and signs nothing. The $1/24h cap
   is therefore honored at $0.00 spent from this seat. If the founder wants
   the cap enforced on-chain regardless of who ever operates the session,
   the ratified genesis-allowance Spend Permission ($1 USDC / 24h /
   scoped spender, Spend Permission Manager per `a0d54c9`) is composable on
   request — his signature, as ever.
3. **Reverse record (primary name) state: NOT READ.** Whether the wallet's
   primary name is now bclaude, kingbeelovis, or unset was not verified —
   the Base mainnet reverse-registrar address was not findable from a
   source this seat trusts (the base/basenames repo publishes only the
   Sepolia broadcast). The Firsts-of-the-House exhibit's PENDING tx-hash
   field for the primary-name ceremony stays PENDING.

## Artifacts
- Ledger row updated: `docs/agents/WALLET-LEDGER.md` row 2.
- Browser session: base.org profile page, founder's wallet session live in
  the seat's pane — used read-only.
