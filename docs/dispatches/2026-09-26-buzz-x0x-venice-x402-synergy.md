# Buzz × x0x × Venice × x402 — the synergy map, and the walls between the rooms

date 2026-09-26 · seat zCode (GLM) · scope: desk research only — docs, no code, no surfaces; every external claim checked against Venice's and Coinbase's own docs on this date, every repo claim read in-tree. Companion dispatch: [2026-09-26-erc223-x-eip7702-receiver-gate.md](2026-09-26-erc223-x-eip7702-receiver-gate.md).

## THE ROLES (and the one law that keeps them honest)

Six organs, one job each:

| organ | its single job |
|---|---|
| **Buzz** | organizes the work — the room where jobs are posed, assigned, and answered |
| **BNRoSe** | authorizes it — the member's hand: caps, budgets, allowlists (the `crates/bsigner/src/x402.rs` policy shape) |
| **compute adapter** | executes it — talks to a provider (Venice or the box node) on the member's behalf |
| **bMeter** | records the evidence — what was consumed, in its own ledger |
| **bPay** | reconciles the money — funding, top-ups, and usage into one settlement story |
| **x0x** | carries the coordination only — messages, groups, invites between seats and members |

> **An x0x permission is never a spend permission.** x0x (the saorsa-labs agent daemon seated on the box, [ops/x0x/README.md](../../ops/x0x/README.md)) proves who may speak in a group and what a member may read. It proves nothing about money. A budget, a cap, or an authorization that lives in x0x state is coordination metadata; the only spend authority is the signature gate in the member's hand (bsigner's policy organ, which reads a policy file it never writes). If a day comes when an x0x role seems to unlock spending, that day the law is broken.

## THREE RECORDS, KEPT SEPARATE

Money arrives, is converted, and is consumed — three different events, three different receipts, never folded into one document:

1. **wallet funding receipt** — fiat/crypto entered the estate wallet (the Coinbase onramp leg, below).
2. **provider top-up receipt** — estate value became provider credit (VVV stake, DIEM stake, or a prepaid API balance).
3. **job usage receipt** — a specific job consumed specific metered units (tokens, requests) at a recorded price.

Conflating them is how "we funded $50" becomes "we can spend $50" — which is false twice over (conversion fees, provider credit is not refundable on the same terms). The measured-states law already holds for storage (quote ≠ purchased ≠ uploaded ≠ retrieved); the same chain now holds for compute: funded ≠ topped-up ≠ consumed ≠ reconciled. bMeter owns record 3's evidence; bPay owns the reconciliation across all three; nothing else writes them.

## VENICE'S PRIVACY MODES ARE NOT ONE GUARANTEE

Venice documents **four separate tiers** ([docs.venice.ai/overview/privacy](https://docs.venice.ai/overview/privacy)) — a job spec that says "private mode" has said nothing until it names the tier:

| tier | what it actually guarantees |
|---|---|
| **Anonymous** | "Identity obscured from provider" — and per the same page, "Prompt content is still visible to that provider." |
| **Private** | zero data retention, contract-enforced; prompt/response used for inference only. |
| **TEE** | "Hardware-isolated inference" — the model runs in an attested enclave (Intel TDX / NVIDIA CC), **but the client still sends plaintext** to it. |
| **E2EE** | prompt encrypted on-device, "only the verified TEE decrypts it." |

Four walls the enthusiasm keeps trying to walk through — each one checked against Venice's own pages:

- **E2EE is not post-quantum.** Venice's TEE & E2EE guide ([docs.venice.ai/guides/features/tee-e2ee-models](https://docs.venice.ai/guides/features/tee-e2ee-models)) specifies "ECDH (Elliptic Curve Diffie-Hellman) on secp256k1 for key exchange," HKDF-SHA256, AES-256-GCM. secp256k1 is a classical curve; the docs name no post-quantum layer anywhere. Sound by construction for today's adversaries — that is the strongest honest phrasing, and the estate's crypto-language law caps us there.
- **Attestation is not a ZK proof, and not a proof of correctness.** It is an integrity-of-environment claim: Venice's own guide warns "Don't just trust the `verified: true` response. Parse the Intel TDX quote client-side and verify the measurements match expected values," binds the signing key to the TDX REPORTDATA, and refuses debug enclaves. It proves *what code runs in the enclave* — it proves nothing about whether the model's *outputs* are correct, and it is not a zero-knowledge argument of anything.
- **Billing metadata is still visible.** The privacy page's own list, for all tiers: "API key identifiers, request timestamps, selected model, token counts, billing amounts, rate-limit state, request IDs, IP address, browser or device information, and product event logs." An E2EE prompt hides the prompt; it does not hide that you prompted, what it cost, or from where.
- **E2EE is a smaller surface than the marketing implies:** text models only, streaming required, web search disabled ("would leak content"), file uploads and function calling not supported. A Buzz job that needs tools or search cannot ride the E2EE tier at all.

## VVV → sVVV → DIEM — A RESOURCE-ALLOCATION MECHANISM, NOT A SAVING

The chain, per [docs.venice.ai/overview/vvv-diem](https://docs.venice.ai/overview/vvv-diem): stake VVV → receive sVVV; **lock sVVV at the Mint Rate to mint DIEM** (an ERC-20 on Base, contract `0xF4d97F2da56e8c3098f3a8D538DB630A2606a024`); **stake DIEM and each DIEM yields "$1 per day" of Venice API credit** — "a perpetual daily Venice credit equal to $1 per DIEM" while staked.

The part that matters for planning: **"Unused DIEM in an epoch does not roll over. The allowance refreshes at 00:00 UTC."** Use-it-or-lose-it, daily. Mechanics worth pinning: the Mint Rate "rises as DIEM supply grows" (later minters pay more sVVV per DIEM); the locked sVVV stays locked until the DIEM is burned; 0.1 staked DIEM minimum before any balance is spendable; 1-day unstake cooldown, 7-day sVVV-unlock cooldown.

**Framing, per the founder's rule:** this is a resource-*allocation* mechanism — it schedules who gets compute — not an assumed saving. Whether staking beats paying-as-you-go depends on utilization (idle DIEM-days are forfeit), the mint rate at entry, and a token position the estate would have to hold. None of that is claimed here; no arithmetic was run; the token price is not our input.

One genuinely useful first-party fact for the estate: Venice's docs index describes the Responses API as taking "API key or x402 wallet auth," and its agent guide covers "x402 wallet auth, autonomous VVV staking, and DIEM-funded credits" ([docs.venice.ai/api-reference/api-spec](https://docs.venice.ai/api-reference/api-spec), [docs.venice.ai/guides/integrations/crypto-rpc-agents](https://docs.venice.ai/guides/integrations/crypto-rpc-agents)). The provider already speaks the estate's payment dialect — that is the strongest synergy on this page.

## COINBASE ONRAMP — ONE REPLACEABLE FUNDING ENTRANCE, BUILT FOR THE HEADLESS API

- **The legacy entrance is going away on a named date.** Coinbase's own docs: "**Will be deprecated on June 30, 2026:** Guest Checkout (debit card, Apple Pay) via the Coinbase-hosted widget is being discontinued. Use the Headless Onramp API instead" ([docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)). Anything we build that assumes the guest widget dies with it.
- **Build against the headless API** — our own checkout surface, our own UX, the same one-concept-one-click law as everything else. The onramp is *one* funding entrance and must stay replaceable: no estate surface may hard-couple to it, because the next entrance (or the next deprecation) is a matter of time.
- **Reconcile delivery independently of the browser redirect.** The redirect is a UI event, not a settlement event: delivery is confirmed by polling/webhook against the order state, and the funding receipt (record 1 above) is written from that independent read — never from "the browser came back."
- **Never store onramp session tokens or order URLs in the repo.** They are session credentials and purchase-capable links; they live in memory or a secret store, never in a committed file, a receipt, or a dispatch.

## THREE PROOFS BEFORE ANYTHING IS CALLED "INTEGRATED"

The word "integrated" is earned, per claim-evidence law, by three demonstrated proofs:

1. **One bounded Buzz→Venice job.** A single job, caps set in the member's hand before it runs, executed through the compute adapter, bMeter recording the usage receipt, bPay reconciling it — end to end, once, with the receipt as the artifact.
2. **x402 auth + E2EE + signature verification, end to end.** The payment authorization (x402 wallet auth), the privacy tier actually negotiated (E2EE headers on the wire), and response-signature verification — all three exercised on the same real request, not each demonstrated separately on toy requests.
3. **The actual smart-account signer and permission flow.** The real delegated account (the EIP-7702 lane — see the companion dispatch) signing the payment through its genuine permission flow, not a dev key standing in. The payer-side half of the x402 story is the part the estate has *not* built yet; until proof 3, we have a policy organ and a facilitator door, not a payer.

## WHAT ALREADY EXISTS IN THE TREE (cited by path, honestly staged)

- **[crates/bsigner/src/x402.rs](../../crates/bsigner/src/x402.rs)** — the pre-signature offer gate: policy in the member's hand (per-signature cap, budget, expected asset, allowlist with pinned seller keys), offers gateable only inside a signed envelope verified offline. **Vaulta-shaped** (rail account names, one-signature seller+tithe split) — the *policy shape* is directly reusable for a Venice-facing gate; the rail-specific parts are not.
- **[ops/x402-door/README.md](../../ops/x402-door/README.md)** — the estate's x402 facilitator door: charter-fenced to Base `eip155:8453` + EIP-3009 `exact`/`upto`, eight test-pinned laws, **testnet-only by charter** ("No production deployment. Local/testnet first"), live-wiring composition not yet compiled green by its own standard. Note the role: a facilitator serves a *resource server*; for paying Venice directly, what's missing is the **payer side** (signer + policy wiring) — the door is not that, and its charter line on 7702-delegated payers is composition guidance, not built code.
- **[ops/x0x/README.md](../../ops/x0x/README.md)** (+ configs alongside) — the coordination carrier: x0xd seated on the box under systemd fences (loopback API only, remote exec disabled, no inviteless join), plus the honest note that the box is mesh-isolated by the UDP egress wall until a founder gesture. Coordination only — see the law at the top.
- **[docs/dispatches/LANE_H_SHARED_COMPUTE_2026-08-28.md](LANE_H_SHARED_COMPUTE_2026-08-28.md)** — the shared-compute note: the box's llama.cpp node, and the scoping fact that Buzz desktop's `mesh-llm` is a compile-time feature pulling **iroh** (member-to-member p2p transport; discovery via nostr status notes + NIP-43). **x0x is not its transport** — two different rails that both happen to be on the box; do not weld them to look like one stack.

## NOT CLAIMED

- **Nothing was run, signed, staked, minted, or bought.** No Venice API call, no x402 payment, no VVV/sVVV/DIEM transaction, no onramp session — zero legs of the three proofs were exercised. Every proof above is specified, not demonstrated.
- **The numbers from the quote screenshot are a snapshot, not a market quote.** Any price, rate, or balance read off a screenshot carries its capture moment: model prices, the DIEM mint rate, and token prices all move. Nothing screenshot-derived appears in this dispatch as a live input, and no purchase decision should rest on one.
- No claim that Venice's privacy tiers are stronger or weaker than any competitor's; the tiers are quoted from Venice's own pages with their own caveats.
- No claim about DEX223's Feb 2026 incident record here — that subject, including one claim that could not be verified, lives in the companion dispatch and is handled there.
- The synergies above are a map of compatible shapes. Compatibility on paper is not integration; the three proofs are the only path from this page to that word.
