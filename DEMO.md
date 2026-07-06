# Demo — see it for yourself

This repository is the host-side stack and design of the **Beehive Nature Reserve
Kernel**. It is built to be *checked*, not believed. The fastest way to evaluate it is to
run it — the headline number below is the output of a command, not a marketing claim.

## Verify in two minutes (no node, no wallet, no account)

```bash
git clone https://github.com/beehive-nature/beehive-nature
cd beehive-nature
git config core.hooksPath .githooks
cargo test --workspace --locked
```

The `git config` line installs the local secret-scan hook (one-time per clone; CI re-runs
the same scan on every push). The test run ends in **`180 passed; 1 ignored`**.

That's the demo. The same command runs in CI on every push
([tests workflow](.github/workflows/tests.yml)), so the badge and your local run agree.
The single ignored test is the firmware-gated `slip0010` end-to-end — it says so in its
own name.

**Want to attack specific claims?** Each is its own command:

| Run this | What it demonstrates |
|---|---|
| `cargo test -p chain-zano` | Host key-derivation reproduces **stock Zano** outputs (committed vector, `src/testvec.rs`) — the crypto is proven-compatible, not asserted. |
| `cargo test -p escrow-core` | The escrow state machine is **panic-total** (2048 forged inputs/run can't crash `transition`) and enforces the dual-balance funding check. |
| `cargo test -p dispute-engine` | Adjudication ranks **provenance over popularity** — ten user claims never out-vote one chain proof; nothing auto-enforces below high confidence. |
| `cargo test -p chain-eos` | The SHIP wire codec round-trips against a real mock SHIP server. |

## What is proven vs. observed vs. unbuilt

This project labels its evidence, deliberately (see [`STATUS.md`](./STATUS.md)):

- **PROVEN / reproducible** — anything under `cargo test` above. Anyone re-runs it and gets
  the same result.
- **Dev-chain observed** — the kernel has been driven end-to-end by **real testnet bytes**
  (a Zano testnet USD-denominated asset → `OrderFunded` → escrow `Ok(Funded)`; live Antelope
  SHIP ingestion).
  Real and dated, but it ran on a private node, so **you cannot reproduce it from here** —
  it is marked `(dev-chain observed)` throughout STATUS. To run it yourself, see the
  testnet demo runbook.
- **Not built yet** — the **Trezor firmware** (what makes "the spend key never touches the
  host" *true* rather than *specified*), the DRO's on-chain multisig signer, and any live
  marketplace. **Legal review of operating a venue is open.** None of these is hidden; all
  are in STATUS under "not done."

## What this is not (so no one is misled)

There is **no running marketplace, no token sale, and nothing to buy or connect a wallet
to.** This is open-source infrastructure — an escrow state machine, a confidential-chain
watcher, a DID method, a constitution, and the host-side cryptography for a Trezor-native
Zano integration — published for review. The spend secret `s` never exists in host RAM by
design; that invariant is the one rule everything else defends.

## Orientation for reviewers

1. [`STATUS.md`](./STATUS.md) — the authoritative ledger; every claim dated and staked.
2. [`README.md`](./README.md) — the one rule, the layout, the confirmed crypto facts.
3. [`REVIEWING.md`](./REVIEWING.md) — house rules and the mechanism-not-worldview boundary.
4. [`SECURITY.md`](./SECURITY.md) — anything exploitable goes through the private channel,
   never a public issue. Safe harbor **excludes** live-funds and sanctions-violating tests.
5. [`CONSTITUTION.md`](./docs/CONSTITUTION.md) — the design thesis (draft; founder
   decisions pending).

Code is **AGPL-3.0-only**; docs are **CC-BY-4.0**; contributions take a DCO sign-off, no
CLA ([CONTRIBUTING.md](./CONTRIBUTING.md)). Tear the claims apart — that is what the
command-per-claim design is for.
