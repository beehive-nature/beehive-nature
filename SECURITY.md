# Security Policy

## Reporting a vulnerability

**Please do not open a public Issue for security-relevant findings.** Use a
private channel so a fix can land before the details are public:

- **Preferred — GitHub Private Vulnerability Reporting** (enabled for this
  repo): the **Security** tab → **"Report a vulnerability."** Private by
  default, no email required.
- If you cannot use PVR, open a public Issue saying only *"security-relevant,
  requesting a private channel"* — no details — and a maintainer will arrange
  one.

Please include: affected crate + commit hash, a minimal reproduction, the
impact you believe it has, and any suggested fix.

## What is in scope

The **coordination kernel and its Rust workspace** — anything whose failure
moves funds, corrupts the event ledger, or breaks an identity/authorization
boundary:

- `escrow-core` / `escrow-engine` (state machine, funding check, timeout
  logic, and the bus consumer that drives transitions)
- `dro-signer` settlement-intent logic and the signer seam
- `dispute-engine` adjudication and provenance weighting
- `shared-types`, `normalizer`, `event-bus`, `composition` (the canonical
  event schema and event integrity end-to-end)
- `chain-eos` / `chain-zano` / `zano-watcher` (chain ingest + view-only
  crypto)
- `reputation-engine`, `adapter-carrier`, `adapter-arweave`
- the cryptographic derivation / wire-protocol material referenced in `docs/`

Consult [`STATUS.md`](./STATUS.md) for exactly what is proven, refuted, or
still unbuilt — it is the authoritative record and it names the gated work
(e.g. firmware-track crypto) so you don't report as a vulnerability something
documented-as-pending.

## What is out of scope

- **Unbuilt, explicitly-gated work** — items `STATUS.md` marks not-done (they
  live behind named traits, not faked). Design feedback is welcome via
  Issues, but they aren't "vulnerabilities" yet.
- **Third-party networks** (Zano, Vaulta, Autonomi, Arweave, GitHub) — report
  to those projects.
- **The application/plugin-layer theses** (medical, nutritional, economic,
  governance-philosophy) — these are *not code* and are out of scope for
  security review; see [`REVIEWING.md`](./REVIEWING.md).
- **Testing against live funds or other people's escrows / testnet wallets.**
  Don't. Reproduce against your own local instance.

## Good-faith safe harbor

Good-faith security research on your **own local instances** is welcome and
we won't pursue action for it. This safe harbor does **not** extend to
testing that touches other users, live or third-party funds, or anything
that would violate applicable sanctions or export-control law.

## What happens after you report

Acknowledge → triage against `STATUS.md`/tests → fix → a ledger line
recording the finding, the fix, and — with your consent — **credit by name**.
Same handling as any review finding (see [`REVIEWING.md`](./REVIEWING.md)):
the register cites the disasters and the reviewers that taught it.
