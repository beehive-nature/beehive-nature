# Hopper-Account Pipeline Design
### BTC → Lightning → V4V → HIVE → Hive Power, with the hot key isolated from the stake

Date: 2026-07-25
Status: Design. Two legs blocked on unverified third-party APIs (§5).

---

## 1. The problem this solves

`transfer_to_vesting` (power up) requires **Active** authority. Verified from the
Hive operation spec:

> **Authority:** Active
> **RC cost is paid by {from} account.**

Any daemon that powers up unattended must therefore hold a live Active key. If
that key belongs to the treasury account, the automation becomes a permanent
remote-code-execution path to the entire 383 HP stake and every other Active
operation on it — transfers, power-down, key rotation, account recovery changes.

The custodial V4V exposure is a *transit* risk: only funds mid-flight are at
stake, for seconds or minutes. A hot treasury Active key is a *standing* risk on
the full balance, indefinitely. It is the larger of the two and it is the one
you would be introducing yourself.

## 2. The hopper pattern

Split the account into two roles.

| Account | Holds | Keys on the automation host | Exposure if host is compromised |
|---|---|---|---|
| `@treasury` | The 383 HP stake, governance weight, ACT claims | **None** | Zero |
| `@hopper` | Only HIVE in transit (minutes), ~0 HP | Active key (hot) | The float only |

`transfer_to_vesting` takes a `to` field distinct from `from`:

> **to** — The account the funds are going to. If null, then the same as from.

So the hopper powers up *into* the treasury. VESTS land on `@treasury`; the hot
Active key never controls it.

```
V4V delivers HIVE ──▶ @hopper (hot active key, ~0 balance at rest)
                          │
                          │  transfer_to_vesting { from: @hopper,
                          │                        to:   @treasury,
                          │                        amount: N HIVE }
                          ▼
                     @treasury  ──▶ VESTS / HP / RC accrue here
                     (keys stay cold / Keychain-only)
```

### 2.1 The RC problem, and its fix

The spec says RC cost is paid by `{from}` — the hopper. A hopper with ~0 HP has
~0 RC and cannot broadcast anything, including the power-up that is its only job.

Do **not** solve this by parking HP in the hopper. That reintroduces exactly the
standing exposure the split removes.

Solve it with `delegate_rc`. Two properties make it the right instrument:

1. RC delegation lends mana **without moving HP**. The stake stays on
   `@treasury`; only the spending capacity moves.
2. `delegate_rc` is a `custom_json` executed under **Posting** authority, not
   Active.

That second point is the load-bearing one. The treasury's *Posting* key performs
the delegation. Posting cannot move funds. So the full standing key exposure of
this design is:

- `@hopper` Active key — hot, controls the float only
- `@treasury` Posting key — used once at setup for the delegation; can be run
  from Keychain by hand and never placed on the host at all

The treasury Active key never appears anywhere in the automation.

### 2.2 Sizing

Delegate enough RC for expected power-up frequency plus headroom, not more. An
over-delegated hopper is a spam vector if the host is compromised; a
under-delegated one stalls silently. Both failure modes are cheap to fix
(re-delegate) and neither risks funds.

Size it from a **measured** power-up RC cost on the actual account, not an
estimate. Per the earlier session finding, RC estimates in this project have run
8–370× wrong; the measurement has been right every time.

### 2.3 What this pattern does *not* fix

- **V4V custodial risk** — unchanged. Funds in V4V's custody are V4V's to lose.
  The hopper limits your blast radius on the Hive side only.
- **Governance delay** — powering up credits VESTS immediately but governance
  voting power only after 30 days (`HIVE_DELAYED_VOTING_TOTAL_INTERVAL_SECONDS`,
  30 days). This is baseline behaviour for *all* `transfer_to_vesting`, not a
  penalty introduced by the cross-account form. The hopper costs you nothing
  here.
- **RC max_mana growth** accrues to whichever account receives the VESTS —
  `@treasury`. This is the desired direction: ACT claims are made by the
  treasury, so RC should pool there. *(Inferred from "RC max_mana is increased"
  in the spec, which does not name the account explicitly — confirm by
  measurement.)*

---

## 3. Leg-by-leg automation status

| # | Leg | Mechanism | Automatable today? |
|---|---|---|---|
| 1 | Fiat → BTC on Coinbase | Coinbase account | Partially — buys are API-accessible; see §5.1 |
| 2 | Coinbase → Lightning | Coinbase/Lightspark LN sends | **Blocked** — see §5.1 |
| 3 | Receive at Phoenix | `phoenixd` HTTP API | **Yes** |
| 4 | LN sats → HIVE | v4v.app | **Blocked** — see §5.2 |
| 5 | HIVE → HP | `transfer_to_vesting` from hopper | **Yes** |

The shape of this table is the honest headline: **the pipeline automates from the
Lightning wallet inward.** The two blocked legs are both at the fiat-facing
front, which is also where the regulatory fence sits. That is a convenient
coincidence rather than a problem — see §6.

### 3.1 Leg 3 — phoenixd

`phoenixd` is ACINQ's headless Lightning daemon. It manages channel liquidity
automatically and exposes an HTTP API on `localhost:9740`, password-authenticated
(password generated on first run, written to the config directory). Relevant
methods include `createinvoice` (params include `description`, `amountSat`,
`expirySeconds`) and `payinvoice`.

This is the cleanest leg in the pipeline. It is self-custodial, headless by
design, and needs no browser automation.

**Operational note:** phoenixd is a hot wallet with its own seed. It belongs in
the same trust tier as the hopper — treat its host as compromisable and keep
balances at working-float levels.

### 3.2 Leg 5 — the power-up

Broadcast `transfer_to_vesting {from: @hopper, to: @treasury, amount}` signed by
the hopper's Active key, with RC borrowed from the treasury delegation.

Library choice: `beem` is the historical Python option but has been effectively
unmaintained; `hive-nectar` is the maintained fork. Verify current maintenance
status before committing — a signing library is not a dependency to inherit
casually. *(UNVERIFIED — not checked in this pass.)*

Confirm success by watching for the `transfer_to_vesting_completed` virtual
operation, which carries the actual VESTS received. Do not infer success from
broadcast acceptance alone.

---

## 4. Failure modes

| Failure | Detection | Response |
|---|---|---|
| V4V holds funds, never delivers HIVE | Expected HIVE never lands on `@hopper` within timeout | Alert. Manual recovery via V4V operator. **No automated retry** — retrying a leg that may have partially executed risks double-spend against your own float. |
| V4V insolvent / offline | Same as above, plus service unreachable | Halt pipeline. Funds in transit are at risk and outside your control. |
| Hopper RC exhausted | Broadcast rejected for insufficient RC | Re-delegate from treasury Posting key. Non-urgent; funds are safe, just stuck. |
| Hopper Active key compromised | Unexpected outbound ops from `@hopper` | Rotate hopper Active key from treasury-independent backup. Treasury unaffected. Loss capped at float. |
| phoenixd host compromised | Unexpected LN sends | Loss capped at phoenixd balance. Treasury and hopper stake unaffected. |
| Power-up broadcasts but VESTS wrong | `transfer_to_vesting_completed` amount ≠ expected | Log and alert. Rate moved between quote and execution; not an error condition, but reconcile. |

The design intent across this table: **every compromise is capped at a float, and
no single compromise reaches the stake.**

---

## 5. Blocking unknowns

These two gaps determine whether "autonomize" means end-to-end or
Lightning-inward. Both need resolution before the front half is built.

### 5.1 Coinbase Lightning withdrawal via API

Coinbase integrated Lightning in mid-2024 in partnership with Lightspark.
Confirmed characteristics: sends (withdrawals) are the primary supported
direction, 0.1% processing fee, an initial $2,000 send cap, availability varying
by region and account type.

**Unknown:** whether Lightning withdrawal to an arbitrary BOLT11 invoice is
exposed through the Coinbase API at all, or is UI-only. Public search surfaced no
API documentation for it.

If UI-only, this leg cannot be scripted against a documented interface. Browser
automation against a KYC'd exchange account is a poor substitute — brittle,
plausibly against terms of service, and it puts exchange credentials on the
automation host, which reintroduces exactly the standing-exposure problem §2 was
built to eliminate. **Recommend leaving leg 2 manual until the API question is
answered from Coinbase's own documentation.**

### 5.2 v4v.app programmatic interface

V4V.app is the Hive ↔ Lightning bridge operated by `@brianoflondon`, DHF-funded,
long-running.

**Unknown:** whether a documented public API exists today. No API documentation
surfaced. The available signal is a stated *intention* — the backend is to be
rewritten and simplified as part of the joint VSC / V4V DHF proposal, with the
goal that it becomes "a fully public repository" that "anyone can run." That is
future tense and tied to a proposal, not a shipped interface.

**Action:** ask the operator directly. This is a small, responsive,
community-funded project; a Hive post or direct message to `@brianoflondon`
asking whether there is a documented API for programmatic Lightning→HIVE
conversion will answer in days what further searching will not. If the rewrite is
in progress, an early integrator asking specific questions is useful to them,
which makes it likely to get a real answer.

**Strategic note:** the same VSC work that would give V4V a public API is also
what would replace the custodial conversion with programmatic access to on-chain
HIVE/BTC markets. If that lands, the SPOF characterization in §4 changes
materially — the custodial hop is what VSC is designed to remove. Worth tracking
as a dependency rather than designing permanently around today's V4V.

---

## 6. The BNR/DAO surface question

The earlier ruling stands and this design respects it: build up to, not through,
capital movement and regulatory permissioning.

Note how the automation boundary and the regulatory boundary coincide. The two
legs that are technically blocked (Coinbase→LN, LN→HIVE) are the two legs that
carry fiat-adjacent and custodial-conversion character. The legs that automate
cleanly (phoenixd inward, power-up) are ordinary self-custodial operations on
assets you already hold.

That suggests the shippable shape for a BNR/skaists surface:

- **In scope:** the hopper→treasury power-up automation, RC delegation
  management, ACT claim scheduling, balance and RC telemetry. All operations on
  the operator's own already-held assets.
- **Out of scope for now:** anything that moves another person's fiat into
  crypto. Exposing legs 1–2 to third parties inside a BNR surface is an on-ramp,
  with the licensing surface that implies. A "here is the route, run it yourself"
  documentation page is not an on-ramp; a button that does it for a user is.

The distinction is whether *you* are in the flow of funds. Documentation is not.
Automation of your own treasury is not. A user-facing button is.

---

## 7. Build order

1. **Measure** the power-up RC cost on the real account. One operation. Ends the
   estimation problem for hopper sizing.
2. Create `@hopper`. Fund with a trivial test amount.
3. Delegate RC from `@treasury` (Posting key, via Keychain, by hand).
4. Script leg 5: hopper → treasury power-up. Verify via
   `transfer_to_vesting_completed`. Run it manually a few times before
   automating.
5. Stand up phoenixd. Script leg 3. Wire 3 → 5 with V4V manual in between.
6. Resolve §5.2 with the V4V operator. If an API exists, close the 3→5 gap.
7. Resolve §5.1 from Coinbase docs. If no API, leg 2 stays manual permanently —
   which is an acceptable end state, not a failure.

Stages 1–5 are buildable now and deliver most of the operational value: the part
that runs repeatedly and unattended is the part that gets automated. Legs 1–2 run
occasionally and involve human judgment about how much fiat to commit, which is
not obviously work you want removed from a human.

---

## UNVERIFIED — carry forward

1. Coinbase Lightning withdrawal API availability (§5.1)
2. v4v.app public API existence and shape (§5.2)
3. `hive-nectar` current maintenance status vs `beem`
4. Which account's `max_mana` increases on cross-account `transfer_to_vesting` —
   spec does not name it (§2.3)
5. Measured RC cost of `transfer_to_vesting` at current HP
6. Measured RC cost of `claim_account` at 383 HP (open from prior session)
7. Whether `delegate_rc` under Posting authority is available on current mainnet
   consensus, or requires Active in some client implementations
8. V4V transit timeout characteristics — how long before a stuck conversion
   should be treated as failed

---

## Sources

- [transfer_to_vesting operation spec — openhive-network/hive](https://github.com/openhive-network/hive/blob/master/doc/devs/operations/03_transfer_to_vesting.md)
- [The Evolution of Hive: Hardfork 26 — RC delegation](https://hive.blog/hive/@hiveio/the-evolution-of-hive-hardfork-26)
- [Direct RC delegations spec — Hive Chain Documentation](https://hivedocs.info/news/core/development/2021/05/05/direct-rc-delegations-vs-rc-pools-and-tentative-direct-rc-delegations-spec.html)
- [ACINQ/phoenixd](https://github.com/ACINQ/phoenixd)
- [phoenixd-client (Node.js/TypeScript)](https://github.com/bob6664569/phoenixd-client/)
- [Coinbase integrates Bitcoin's Lightning Network with Lightspark](https://www.coinbase.com/blog/coinbase-integrates-bitcoins-lightning-network-in-partnership-with)
- [Next phase of VSC Hive Smart Contracts and V4V.APP Joint DHF proposal](https://ecency.com/proposals/303)
- [What's going on with V4VApp! — @brianoflondon](https://hive.blog/dhf/@brianoflondon/whats-going-on-with-v4vapp)
