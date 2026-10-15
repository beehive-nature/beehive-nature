# 2026-10-15 · BNROSE-EVOLVE ANCHOR — the journal head held where its writer cannot reach

Order: the founder, 2026-10-15, through the bnrose-evolve session: the
controller is to use the decentralized stack. This beat is the one the
controller's dispatch (`2026-10-15-bnrose-evolve-controller.md`) named next:
anchor `Journal::head()` externally. Delivered from `wt-bevanchor` (branch
`zcode/bevolve-anchor-2026-10-15`), stacked on PR #435
(`zcode/bevolve-2026-10-15`), which is stacked on #422.

**Leg served (SPEC-BNROSE-0 §0.1): L2, eternal runtime.** A repairer's record
of what it did must survive the repairer's own store being rewritten.

## The gap, shown before it was closed

The journal is an unkeyed SHA3 chain. Every battery row below first rewrites
the store the way a writer with store access would: records changed, dropped
or added, then every link and the head recomputed exactly as the journal
computes them. **`Controller::open` accepts each of those rewrites.** That
is asserted in every row (`plain_open_accepts`), so the gap is shown in the
same run that shows it closed.

## Delivered

- `crates/bnrose-evolve/src/anchor.rs` (new module, no socket):
  - `AnchorStatement` = (subject, journal head `(count, last link)`, digest
    of the latest PROMOTE `Decision::statement()`, digest of the policy in
    force). A strict canonical encoding (version 1, kind `0xA0`, apart from
    every journal record kind; short, trailing or foreign bytes refused) and
    a domain-separated digest. The subject is an Antelope name so a Vaulta
    table can key by it.
  - `check()`: refuses as `Tampered` when the local journal holds fewer
    records than the anchor (truncation), when its first `count` records do
    not end at the anchored link (a rewrite, re-chained or not, regrown or
    not), and when the head matches but the anchored promote or policy
    digest does not. An unreachable carrier is refused (`unknown`, "fails
    closed"), never read as "never anchored".
  - `Controller::open_anchored()`: runs the check after the journal is
    verified and replayed and **before recovery writes anything**, so a
    refused journal gets nothing appended.
- Additive read-side changes to bnrose-evolve: `Journal::head_at(n)` (the
  head after the first `n` records, from links recomputed at open),
  `Controller::latest_promote()`, `Controller::local_view()`. **The authority
  model is unchanged**: no new write path, no new authority, the crate still
  depends on exactly {adapter-store, ml-dsa, serde_json, sha3} and its
  authority row still passes.
- `crates/bnrose-anchor-vaulta` (new crate, the part that touches a chain):
  `latest()` reads the subject's row with `get_table_rows` on every endpoint
  given, after pinning each endpoint's chain id (Jungle4 by default). A
  transport failure, a wrong chain, endpoints that disagree, or a row whose
  statement does not decode or does not match the row's subject and count
  all become `Unreachable`, so the open fails closed. `anchor_action()`
  builds the **unsigned** `anchor` action. Command face:
  `bnrose-anchor-vaulta open|action`, where `action` prints the next action
  only after the anchored open accepted (a refused journal is never
  re-anchored). Authority row: dependencies exactly
  {bnrose-evolve, serde_json, ureq}; no source names a signing key, a push
  or a wallet.
- `contracts/evanchor/evanchor.cpp` (the carrier, built, **not deployed**):
  one row per subject. The first anchor binds the publisher. Only that
  publisher may advance it. `count` strictly grows, so a truncation cannot
  be hidden by re-anchoring shorter. The statement's own subject and count
  must equal the action's. The statement is bounded at 256 B. The publisher
  pays the row's RAM (CONSTITUTION Art. V.1). RAM: one row per subject,
  overwritten in place at a fixed statement size (≤124 B), so advancing an
  anchor is net RAM delta 0, the same shape as bzdid-architecture-decision's
  ring.
- `scripts/bnrose-evolve/teeth.sh` (+5 teeth),
  `scripts/bnrose-evolve/anchor-vaulta-teeth.sh` (4 carrier teeth),
  `scripts/bnrose-evolve/evanchor-build.sh` (CDT build + digests),
  `.github/workflows/bnrose-evolve.yml` (carrier suite and carrier teeth,
  every step `if: always()`).

## Battery rows (both engines, real processes)

| row | what it does | outcome |
|---|---|---|
| `anchor::an_honest_journal_is_accepted_against_its_anchor` | adopt → repair → verify → canary → PROMOTE → anchor; reopen; grow; reopen | `Matches{count}`, then `Extends{anchored, local}`; a `NeverAnchored` lookup is named `Unanchored`, not hidden |
| `anchor::a_rewritten_and_rechained_journal_is_refused_against_the_anchor` | the record after the PROMOTE relabelled at the same length and re-chained; then also regrown past the anchor | plain open ACCEPTS both; anchored open REFUSES both (`tampered`, "not the anchored ones"), nothing appended; honest bytes restored → `Matches` |
| `anchor::a_truncated_journal_is_refused_against_the_anchor` | the last record dropped, re-chained; everything from the PROMOTE on dropped (the promotion erased); truncated then regrown to the anchored length | plain open ACCEPTS all three; anchored open REFUSES all three (`truncated`, `truncated`, "not the anchored ones") |
| `anchor::an_anchor_that_does_not_describe_its_journal_is_refused` | right head, other promote digest; right head, no policy; another subject's anchor | `tampered`, `tampered`, `unknown` |
| `anchor::an_unreachable_carrier_fails_closed` | the carrier did not answer | `unknown` ("fails closed"), nothing appended |

## Teeth (each guard disabled alone; its row must go red)

| tooth | guard | convicted by |
|---|---|---|
| `anchor-truncation-ignored` | short journal → refuse | the truncation row |
| `anchor-prefix-unchecked` | anchored prefix ≠ anchored head → refuse | the rewrite row |
| `anchor-statement-unchecked` | equal head, other promote/policy → refuse | the statement row |
| `anchor-down-read-as-never` | unreachable ≠ never anchored | the unreachable row |
| `anchor-prefix-off-by-one` | `head_at(n)` is the link after record `n-1` | the honest row |
| carrier `wrong-chain-read` | chain id pinned | `only_a_wrong_chain_is_refused_by_the_chain_check` |
| carrier `split-answers-merge` | endpoints must agree | `endpoints_must_all_answer_and_all_agree` |
| carrier `row-trusted-over-statement` | row subject/count = statement's | `a_row_that_does_not_carry_its_statement_is_refused` |
| carrier `failed-endpoint-skipped` | every endpoint must answer | `endpoints_must_all_answer_and_all_agree` |

Not toothed, named: `Journal::append` extending its link list is unreachable
through the anchored open (open recomputes every link), and the gate running
before recovery writes is held by construction in `open_claimed`, with no
row that could tell the two orders apart.

## Receipts

Local, WSL2 (Linux 6.18 x86_64), on the worktree before commit. Each file
holds its command line and the raw output.

- `docs/receipts/bnrose-evolve/battery-anchor-local.txt`:
  `test result: ok. 10 passed; 0 failed` (unit, incl. 2 anchor) and
  `test result: ok. 28 passed; 0 failed … finished in 70.11s` (battery,
  23 prior + 5 anchor); `exit=0`.
- `docs/receipts/bnrose-evolve/teeth-anchor-local.txt`: control GREEN, then
  `TEETH: 17 convicted, 0 escaped`, `exit=0`. (Run with the five new teeth
  written one per line; the committed file has the same five teeth in the
  file's multi-line style, and the CI run is on the committed form.)
- `docs/receipts/bnrose-evolve/anchor-vaulta-local.txt`: carrier
  `test result: ok. 5 passed; 0 failed; 1 ignored` (the ignored one is the
  live read) plus 1 unit; `exit=0`.
- `docs/receipts/bnrose-evolve/anchor-vaulta-teeth-local.txt`: control
  GREEN, then `TEETH: 4 convicted, 0 escaped`, `exit=0`.
- `docs/receipts/bnrose-evolve/fmt-anchor-local.txt`:
  `cargo fmt --all -- --check`, `exit=0`. Taken after rustfmt reflowed five
  spots in this beat's new files (whitespace only); the five anchor rows and
  the carrier suite were re-run green after it and every tooth pattern was
  re-checked present. `node scripts/build-stack-inventory.mjs --check` and
  `node scripts/build-stack-surfaces.mjs --check`: green after
  regeneration (78 workspace crates).
- `docs/receipts/bnrose-evolve/evanchor-build-local.txt`: `cdt-cpp version
  4.1.1`, `exit=0`, `evanchor.wasm` 7636 B
  `sha256:P7xNIZph0Yr20ZHkU/HHtc4Ddh5vrKzwNsljPoseItA=`, `evanchor.abi`
  1918 B `sha256:cOwB/cKNezNAMndlC3R9qEwBwDQB5SP+2nz0KlWRHmM=`, and the ABI.
- `docs/receipts/bnrose-evolve/anchor-vaulta-live-read.txt` (the opt-in live
  read, reads only): Jungle4 on two endpoints for `bnrevanchor1/evolve.ctr1`
  → `Unreachable(… get_table_rows … status code 400)`, because the carrier
  account does not exist (`get_account` in the same receipt: "unable to
  retrieve account info"); a Vaulta mainnet endpoint asked with Jungle4's
  chain id pinned → `Unreachable("… serves chain aca376f206b8fc25…, not
  73e4385a2708e6d7…")`. Both fail closed, as built.

CI (`bnrose-evolve.yml`, `tests.yml`) on the pushed head is the receipt that
counts. Its verdict is recorded in the PR, not predicted here.

## Boundaries not crossed

- **No chain write of any kind.** No deploy, no push, no account created.
  No key was held, asked for, or read. The live receipt is reads only.
- **No mainnet act.** The default chain is Jungle4; the mainnet endpoint was
  asked one `get_info` and refused by the chain-id pin.
- The publishing seat is the signer lane: deploy `evanchor` to a Jungle4
  account (`bnrevanchor1` is the name the receipt probed, unregistered), then
  sign the `anchor` action `bnrose-anchor-vaulta action` prints. Per the
  WB004 persistence law, the action is a pure function of the statement:
  rebroadcast the identical signed bytes only; an unresolved push is UNKNOWN.
- An anchor covers its prefix only. Records after the latest anchor are as
  strong as the chain until the next anchor is published.
- A compromised publisher key can advance the anchor to a forged head: the
  anchored open then refuses the honest journal (loud), it never accepts a
  rewrite.
- **Autonomi persistence: not built.** `adapter-autonomi` is node telemetry
  (`antctl status` snapshots), not a storage client, so "persist the
  statement bytes through adapter-autonomi" has no seam to call. The
  statement is ≤124 B and self-describing; the ANT lane's upload path is the
  candidate carrier.
- No x0x, no ZK: a peer carrying the statement and a proof over the
  controller's verdicts are later beats.

## Next owners

- **Signer lane** (wallet one-press / cleos with its own wallet), Jungle4
  only: deploy `evanchor` from the receipt's build (verify the wasm digest
  above), publish the first anchor, then rerun
  `cargo test -p bnrose-anchor-vaulta --test carrier -- --ignored
  live_jungle4_read` and an anchored open against the live row. Any
  mainnet deploy needs founder word.
- **ANT lane**: whether the statement bytes should also ride an Autonomi
  upload, and through which client.

## Status

DELIVERED on this branch as a draft PR stacked on #435. HUMAN INTERACTION:
NONE. NEXT OWNER: the signer lane for the testnet deploy; an authorized
merger after CI on the exact head.
