# Reviewing bNature

Welcome — and thank you for reading closely. This project was built to be
verified by strangers; adversarial review is the point, not an intrusion.

## What this repository is

A **coordination kernel** (see [`docs/CONSTITUTION.md`](./docs/CONSTITUTION.md))
plus the Rust workspace that implements it: escrow settlement, dispute
adjudication, chain ingest, reputation, and permanence anchoring. The
constitution freezes *semantics*, not technology — implementations are meant
to be replaced while the invariants hold.

## The authority hierarchy (read this first)

1. **[`STATUS.md`](./STATUS.md) is the canonical ledger** of what is proven,
   refuted, decided, and pending. It beats any README, any comment, and any
   maintainer's memory — including the author's. If a claim and `STATUS.md`
   disagree, `STATUS.md` wins or the claim is a bug.
2. **The Verification Principle:** a claim becomes a fact only when it is
   source-cited or test-backed. Marketing and memory are provisional. You are
   invited to *falsify* — a reproducible counter-example is the most valuable
   contribution here.
3. **Counts and status** (crates, passing tests, what's live) come from
   `STATUS.md` + `cargo test --workspace`, never from prose. Don't trust a
   number in a doc; run the tree.

## The reproduction-command rule (house standard)

A number can drift and a label can overclaim; a command can't lie. So:

- **Every count is stated as the command that verifies it.** Not "179 tests"
  but `cargo test --workspace` → **`179 passed; 1 ignored`** (the ignored one
  is the firmware-gated `slip0010` end-to-end). Run it; if it doesn't match,
  that's a finding.
- **Every "proven" declares its reproduction path, or it is "dev-chain
  observed."** *Proven* means anyone can re-run it — e.g. the stock-Zano
  derivation vector, `cargo test -p chain-zano`. *Dev-chain observed* means it
  was seen against a local dev/testnet node that a stranger can't reach; those
  entries in `STATUS.md` are tagged `(dev-chain observed)` precisely so the
  two are never confused. Hold us to the distinction — it is the credibility.

## In scope for review

The code and its specifications: the crates listed in `STATUS.md`,
`docs/CONSTITUTION.md`, and the design findings under `docs/`.

## Out of scope (important)

The repository's **application/plugin-layer theses are not the code under
review and are not endorsed by the kernel.** Per `docs/CONSTITUTION.md`
Article VII, the kernel deliberately contains no medical, nutritional,
longevity, economic, political, or metaphysical claims — those live in
application/vision content above the kernel. Please review the *mechanism*
(does the escrow machine hold, is the crypto sound, does the ledger stay
honest), not the founder's worldview. Health/economic assertions elsewhere in
the project are not warranted by this codebase and are not the subject of
code review.

## How to report

- **General findings, questions, design critique →** open an **Issue**.
- **Anything exploitable (moves funds, forges state, breaks an auth
  boundary) →** the **Security** tab / [`SECURITY.md`](./SECURITY.md),
  privately. Not a public Issue.
- Cite the crate + commit; a failing test or reproduction beats an assertion.

## Closed decisions — don't relitigate without new evidence

Some questions are settled with citations; reopening them needs a source, not
an opinion. Examples (all in `docs/`):

- **No native Zano multisig-proposal timeout** → off-chain enforcement is the
  permanent design (source-verified;
  `docs/architecture/zano-timelock-findings.md`).
- **OREC adaptation is clean-room / cited-and-pinned** (mechanism, not
  expression; see `docs/article-vi-ratification-draft.md`).
- The frozen wire protocol and cryptographic derivation (see `STATUS.md`).

If you think one is wrong, cite the file/line that proves it and stop there —
that citation is the contribution.

## How findings are handled (the house rules)

- **Wrong** → answered with citations. The record does the arguing.
- **Out of scope** → a polite pointer back to this document.
- **Right — including right in a way that stings** → an Issue, a fix, a
  `STATUS.md` ledger line, and **credit by name**. The register already cites
  the disasters that taught it (see `docs/risk-register.md`, R-004 ← the
  Kelp DAO post-mortem); reviewers who teach it get the same treatment.

## An audit lens you're welcome to use

Every automated enforcer can be defeated exactly three ways — **make it
absent, lie to it, or become it** (availability / input-integrity /
authority-integrity; see `docs/risk-register.md` R-001 and R-004, and the
meta-tier argument in `docs/article-vi-ratification-draft.md` — draft
amendment text, not yet ratified constitution). Walking any
settlement-critical component against those three, in order, is a fast way to
find what's missing.

## Good faith, both directions

Reviewers get patience and citations; maintainers get the benefit of the
doubt and reproducible reports. That reciprocity is what makes peer review
real.
