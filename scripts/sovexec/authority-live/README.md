# SOVEXEC-002 — antelope-authority against a live Antelope node

The first foreign oracle for `crates/antelope-authority`: the model's verdicts
compared with a running Jungle4 node on permission graphs built for the
purpose, as custom permissions of one disposable test account.

## Files

- `probe.mjs` — builds the graphs (idempotent, resumable through
  `state.json`), asks the chain every case through
  `/v1/chain/get_required_keys` on two independent endpoints, runs the
  minimum-permission rows as real pushes, writes the public receipt to
  `docs/receipts/sovexec-002/receipt-authority-live.json`.
- `state.json` — the run journal (public chain data: permissions created,
  transaction ids, confirmations). No key material.
- The replay: `crates/antelope-authority/tests/live_agreement.rs` reads the
  receipt, builds the model's world from the recorded `get_account`
  permissions and the recorded link state, and asserts agreement row by row.
  CI runs the replay; the probe itself needs the custody box.

## Authority and custody

Account `bzcodejungle` (the WB004 live lane's account; keys in CurrentUser
DPAPI, loaded through `scripts/btungsten/wb004-live/keys.mjs`, plaintext never
printed or written). Four lane keys `AL_C`, `AL_D`, `AL_G`, `AL_W` are
generated once into the same custody file for the custom permissions. Only
public encodings appear in the receipt.

## The graphs (all permissions of `bzcodejungle`)

| permission | parent | authority | the corpus row it mirrors |
|---|---|---|---|
| `alcust` | active | key AL_C | a custom permission |
| `aldeep` | alcust | key AL_D | a grandchild (minimum-permission rows) |
| `alxacct` | active | `junglefaucet@active` w1 | cross-account delegation (class 1) |
| `alcyca`, `alcycb` | active | each references the other | the two-node cycle (class 3) |
| `allinka` … `allinkg` | active | a → b → … → g; g holds AL_G | the depth bound: five edges satisfied, six not (class 3) |
| `allinkz` | active | → `allinkb` | the long path for the artifact |
| `altop` | active | [`allinkb`, `allinkf`] | the order-dependent depth artifact |
| `altopb` | active | [`allinkf`, `allinkz`] | the same structure, direct edge first |
| `alwait` | active | threshold 2: key AL_W + wait 3600 | waits under a delay |
| `aldedup` | active | threshold 2: [`alcust`, `aldeep`] | the cache keyed by actor@permission (class 2) |

The permissions stay on the account after the run so that anyone can re-ask
the chain; the `eosio.token::transfer` links the push rows create are removed
again (`p08`), leaving the account with no links, as found.

## Laws

One push per step; an unresolved outcome is recorded as unresolved and never
re-signed (the 2026-10-13 WB004 correction). Every updateauth is confirmed by
a state read before the next. Every chain refusal is a first-class result
with the chain's own message. Both endpoints are asked every read-only case
and their agreement is recorded.

## Run

```
node probe.mjs            # setup (skips what is already as planned) + cases + pushes + receipt
node probe.mjs --cases    # re-ask the chain only; rewrite the receipt
```
