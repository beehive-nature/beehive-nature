# PUSH PRE-FLIGHT — `main` → `origin/main`, 2026-07-30
Seat: Cowork. Status: **CLEAN — awaiting founder authorization.** Not pushed.

Publishing is a founder decision, not a seat decision. This document is the evidence
package for that decision; the push itself waits for one word.

---

## The decisive fact, stated first

**`beehive-nature/beehive-nature` is a PUBLIC repository** (GitHub API:
`"private": false`, `"visibility": "public"`). Filed as **A52**. Everything below
becomes world-readable the moment it lands. Nothing in the payload is a secret —
but "not a secret" and "intended for publication" are different questions, and only
the second one is yours.

## Payload

5 commits, 16 files, 2,035 insertions:

```
0bc5a10  feat(bsigner): C1 scaffold — device rail, chain registry, process boundary
02dba5f  docs(receipts): Cowork W1-W3
5fab814  governance: graduate the TE gates — tokenomics spec ADOPTED
57d9e91  docs(register): home ruling EXECUTED; A48
193816e  docs: land VERIFIED-FACTS register and specs in tree
```

Files: `crates/bsigner/{lib,device,channel,chain_registry}.rs` + `examples/enumerate.rs`,
`Cargo.{toml,lock}`, `STATUS.md`, and `docs/{VERIFIED-FACTS, RULINGS-2026-07-26,
SPEC-BNROSE-ONBOARD, ONBOARDING-OPTIONS, hopper-pipeline-design,
tokenomics-earned-emission, RECEIPTS-COWORK-2026-07-30}.md`.

## Scan results

| Check | Result |
|---|---|
| `scripts/secret-scan.sh tree` | **exit 0** |
| WIF / `PVT_K1_` / `xprv` / PEM private-key patterns | **0 matches** |
| 64-hex strings | 16 total, **all accounted for** — 14 are `Cargo.lock` dependency checksums (hash-pinning, which is the standing law working as designed); 2 are the Vaulta mainnet chain id, annotated `// PUBLIC-CONSTANT` in source |
| Credential words on added lines | 7 hits, **all documentation prose** — e.g. "no seed/PIN/passphrase", "password-authenticated" describing phoenixd's local API. Zero values. |
| `*_DO_NOT_COMMIT.md` files | **none included** — all 12 remain untracked at repo root |
| `@`-handles on added lines | `@treasury`, `@hopper` (design placeholders), `@brianoflondon`, `@null`, `@trezor`, `@hiveio` — all public or fictional |

## Two judgment calls that are yours, not mine

**1. The register discloses treasury capacity.** A38 carries the exact `max_rc`
(624,977,561,774) at 383 HP. Hive is a public chain, so this is readable by anyone who
knows the account — but publishing it *here* links this repo to that account
permanently. That's a correlation you may want, or may not. It is not a leak; it is a
disclosure.

**2. `bsigner` publishes an in-flight signing crate.** C1 is a scaffold with no signing
path, and the THP blocker (A53, Ruling 2) is unresolved. Publishing it is honest — it
signs nothing — but it does put an unfinished security-load-bearing crate in public
view before its transport question is settled.

Neither is a blocker. Both are reasons a thoughtful person might choose "docs only" or
"wait a day," and neither is a call a seat should make silently.

## Options

| | Effect |
|---|---|
| **Push all 5** | Register history becomes durable on the remote — the entire point of the home ruling. Accepts both disclosures above. |
| **Push docs only** | Register durable now, bsigner held until Ruling 2. Costs git surgery and splits history. |
| **Hold** | Nothing published; founder pushes at the keyboard alongside W1's screenshot and W3's wallet entry. |

**Recommendation: push all 5.** The disclosures are consistent with a project that
already anchors publicly on Hive and Arweave, the scan is clean, and the register's
append-only guarantee is only real once it exists somewhere other than this laptop.
But the word is yours.

## Command, when authorized

```
cd C:\Users\travi\beehive-nature
git push origin main
git rev-parse origin/main    # receipt
```
