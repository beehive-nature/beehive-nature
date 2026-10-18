# 2026-10-16 · SOVEXEC-002 — antelope-authority against a live Antelope node: 31 of 31 rows agree with Jungle4 on Spring v1.2.2, every transaction irreversible on two nodes

Seat: Claude Code (Fable 5.1), the SOVEXEC-001 session continued. Order: the founder, 2026-10-15/16, after the sublane card failed to start twice ("Run the antelope-authority live-node agreement lane in this session now, with the same brief as the card"). Branch `claude-LoVis/sovexec-002-authority-live`, stacked on PR #448 (`3283d2032`, the crate this lane qualifies); nothing of #449 is in it.

## 0 · The claim this lane earns

`crates/antelope-authority` (SOVEXEC-001) was a model read from Spring v1.2.2 source with the honesty clause "sampled agreement with a running node is the named next beat, not a claim made here". This lane is that beat: the permission graphs the conformance corpus uses were built as custom permissions of one disposable Jungle4 account, the chain was asked its verdict for every case, and the model was replayed against the chain's answers. **31 of 31 rows agree**, including the exact set of keys the chain reports as required, on the node that runs the very version the model was read from (CryptoLions, `v1.2.2`) and on an independent node one minor version behind (Greymass, `v1.1.5`). Zero model defects were found; no vector was weakened.

## 1 · What was built on chain (receipt: `docs/receipts/sovexec-002/receipt-authority-live.json`, sha256 `c5dddd5928f8b6ebb91dc0186b369544f7845e2c2e82a156b87aeab30552daa1` PUBLIC-CONSTANT)

Account `bzcodejungle` (the WB004 live lane's test account; keys in CurrentUser DPAPI through `scripts/btungsten/wb004-live/keys.mjs`, plaintext never printed or written; four new lane keys `AL_C`, `AL_D`, `AL_G`, `AL_W` generated into the same custody file, public encodings only in the receipt). Seventeen permissions by `updateauth`, each confirmed by a `get_account` read before the next push:

| permission | authority | mirrors |
|---|---|---|
| `alcust` (parent active), `aldeep` (parent alcust) | one key each | a custom permission and its grandchild (minimum-permission rows) |
| `alxacct` | `junglefaucet@active` w1 | cross-account delegation (class 1) |
| `alcyca` ↔ `alcycb` | each references the other | the two-node cycle (class 3) |
| `allinka` → … → `allinkg` (key `AL_G`) | a six-edge chain | the depth bound (class 3) |
| `allinkz` → `allinkb` | | the long path for the artifact |
| `altop` = [`allinkb`, `allinkf`]; `altopb` = [`allinkf`, `allinkz`] | | the order-dependent depth artifact, both orders |
| `alwait` | threshold 2: key + wait 3600 | waits under a delay |
| `aldedup` | threshold 2: [`alcust`, `aldeep`] | the cache keyed by actor@permission (class 2) |

Cost, from `get_account` before and after: RAM 4,472 → 9,952 bytes of 21,878 (5,480 bytes for 17 permissions); CPU 3.5 ms; NET 3.5 KB; 0.0003 EOS donated to `junglefaucet` by the three accepted transfers. The permissions are left in place so anyone can re-ask the chain the same questions; the `eosio.token::transfer` links the push rows created were removed (`p08`), and `p09` proves the account ended with no link, as found. `wbfoursignr` untouched.

## 2 · The oracle, and what it does and does not gate

`/v1/chain/get_required_keys` takes a transaction and candidate PUBLIC keys and answers with the subset it used (`authorization_manager::get_required_keys` → `checker.used_keys()`) or refuses `unsatisfied_authorization`. It is read-only and costs nothing, which is why 22 rows run through it on both nodes. It applies authority SATISFACTION only: the minimum-permission gate (`lookup_minimum_permission`, `irrelevant_auth_exception`) runs in `check_authorization` on a real push, so those rows (9) are real transactions, three of them accepted transfers.

Two facts about the chain learned on the way, both recorded in the probe: an unknown permission is "does not have signatures for it", not a different error (the model's `NotFound → unsatisfied` is the chain's behavior); and the `processed.block_num` a push returns is the pushing node's speculative block: 5 of the 23 transactions landed one to two blocks later, so `verify-inclusion.mjs` walks forward from it.

## 3 · The rows (every one agrees; `tests/live_agreement.rs` replays them)

Read-only rows, both nodes agreeing on every one:

| id | declared | candidates | delay | chain | the corpus row it confirms |
|---|---|---|---|---|---|
| r01/r02 | active | active key / none | 0 | SAT / UNSAT | one key satisfies; none does not |
| r03/r04 | alcust | its key / the active key | 0 | SAT / UNSAT | a child is not its parent |
| r05/r06 | alxacct | faucet active key / unrelated | 0 | SAT / UNSAT | **class 1 live**: the chain follows `junglefaucet@active` as written; a resolver following under the enclosing name would look for `junglefaucet@alxacct` and refuse |
| r07/r08/r18 | alcyca, alcycb | none / every lane key | 0 | UNSAT | **class 3 live**: a two-node cycle terminates unsatisfied |
| r09/r10 | allinkb / allinka | `AL_G` | 0 | SAT / UNSAT | **five delegation edges are followed, the sixth is not** (the count SOVEXEC-001 corrected on itself, now the chain's own answer) |
| r11/r12/r13 | alwait | `AL_W` | 3600 / 0 / 3599 | SAT / UNSAT / UNSAT | waits count only under a sufficient delay |
| r14/r15/r22 | aldedup | `AL_C` / `AL_C`+`AL_D` / active key | 0 | UNSAT / SAT (2 keys) / UNSAT | **class 2 live**: one key is not both of an actor's permissions |
| r16/r17 | altop / altopb | `AL_G` | 0 | **UNSAT / SAT** | **the order-dependent depth artifact is the chain's behavior**: `allinkf` reached first through the long path at depth 5 is cached unsatisfied and the direct edge reads the cache; the same structure with the direct edge sorted first is satisfied. Spring v1.2.2 and v1.1.5 both answer so |
| r19 | aldeep | `AL_D` | 0 | SAT | a grandchild by its own key |
| r20 | active | active key + `AL_C` | 0 | SAT, required = [active key] | an irrelevant candidate is not required (the used-key SET agrees) |
| r21 | nosuchperm | active key | 0 | UNSAT | an unknown level is unsatisfied, not an error of another kind |

Push rows (real transactions; every acceptance included in a block on both nodes and below both nodes' last irreversible block; every refusal the chain's own `irrelevant_auth_exception` message):

| id | what | chain | PUBLIC-CONSTANT on-chain trx id |
|---|---|---|---|
| p01 | transfer declared `aldeep`, no link | REFUSED irrelevant (min is active) | |
| p02 | `linkauth` transfer → `alcust` | included, block 292273766 | `8f47f94e01245ec58ce70c053db515fdf821c9c9a44c63647f8ad9c2b4660086` PUBLIC-CONSTANT |
| p03 | transfer declared `alcust` | included, block 292273836 | `ced6d279305d05490d65a8457006357815f8ab0218299938cc84afb5b48d7bee` PUBLIC-CONSTANT |
| p04 | transfer declared `aldeep` under that link | REFUSED irrelevant (below the linked minimum) | |
| p05 | transfer declared `active` under that link | included, block 292273906 | `95f236ccf60fef3a08ac701ff30c5ba4b69c475d7071f644ab26e105491a346a` PUBLIC-CONSTANT |
| p06 | `linkauth` transfer → `eosio.any` | included, block 292273975 | `74c543a6b1ae1dad43cd5c80948b766e207687f181d0a2fe3865e93a89c5e176` PUBLIC-CONSTANT |
| p07 | transfer declared `aldeep` under `eosio.any` | included, block 292274047 | `6566dce8109bbeed30700dfd9007121757814419286adc6a8616be95af5cf502` PUBLIC-CONSTANT |
| p08 | `unlinkauth` transfer | included, block 292274116 | `b20879c9ec7e3bcd2ec8677b618e37e3c2cf4d56bb50693fdaa2cd4587d05a52` PUBLIC-CONSTANT |
| p09 | transfer declared `alcust` after the unlink | REFUSED irrelevant (min is active again) | |

The replay (`crates/antelope-authority/tests/live_agreement.rs`) rebuilds the world from the receipt's `get_account` permissions (keys sorted into MODEL ORDER; a permutation of keys changes no verdict and the used SET is what is compared), replays each read-only row through `Checker::satisfied` and compares the verdict and the used-key set with the chain's, replays each push row through `check_authorization` with the recorded link state and expects `Satisfied` where the chain included and `IrrelevantAuthority` where it refused, and asserts that the model REFUSES the `eosio::linkauth`/`unlinkauth` rows by name rather than answering them. It also pins the chain id and that the primary runs `v1.2.2`, and fails if the receipt is missing: an unexecuted replay is not a pass.

## 4 · Receipts

Probe run (`node probe.mjs`, 2026-10-16T00:13:37Z to 00:18:38Z; the full log is in the session, the chain's answers are in the receipt): setup 17 permissions confirmed; 22 read-only rows, 22 with both nodes agreeing; 9 push rows, 9 matching their expectation; `exit=0`. Inclusion (`node verify-inclusion.mjs`, 00:22:52Z): `checked 23 not confirmed 0`, all 23 below both nodes' last irreversible block (292274691 at the time).

`cargo test -p antelope-authority --locked` (WSL, rustc 1.98.1), 2026-10-16:

```
test the_receipt_is_the_pinned_chain_and_both_nodes_agreed ... ok
test every_get_required_keys_row_agrees_with_the_model ... ok
test every_push_row_agrees_with_the_transaction_gate ... ok
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
```

together with the 29 corpus rows unchanged (32 passed, 0 failed across the crate). `cargo fmt --all --check` clean. `Cargo.lock` delta: `serde_json` as a dev-dependency of `antelope-authority` (already locked through the workspace).

Laws honored: one push per step, never a re-signed replacement on an unresolved outcome (the 2026-10-13 WB004 correction); every acceptance confirmed by a chain read; every refusal a first-class result with the chain's message; both endpoints asked every read-only row; the receipt and the run journal written as one-line JSON carrying the `PUBLIC-CONSTANT` marker so the pre-commit hex law holds (the estate's `docs/receipts/*.json` shape); no production authority, no mainnet, no key material anywhere in the tree.

## 5 · Boundaries not crossed, and what is not claimed

- One account's permission graph (plus `junglefaucet@active`, read-only) on one testnet; the model's `check_but_dont_fail` and `satisfied_authorizations` paths, `canceldelay` delays and the five native authority actions were not exercised live (the model refuses the last by name, and the replay asserts that).
- Greymass `v1.1.5` agreeing is incidental evidence about an older minor version; the pin stays `v1.2.2`.
- MODEL ORDER on keys (text vs the chain's binary order) was not discriminated: every authority here holds at most one key, so no row depends on key order.
- The probe runs only on the custody box; CI runs the replay from the receipt. A stranger can re-ask the chain every read-only row with the public keys in the receipt, since the permissions stay on the account.

## 6 · Next owner

HUMAN INTERACTION: NONE for landing. Next beats: the SOVEXEC-001 seam proposal to ZCode (§4.6 there) now rests on live evidence; a multi-key authority row (two keys, mixed weights) would discriminate MODEL ORDER and is a one-permission addition to `probe.mjs`; the stacked PRs #448 → this → #449 land in that order on CI's verdict.
