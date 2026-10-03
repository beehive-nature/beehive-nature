# ant-extsig 0.3.0: ceilings from the gate, a persistent gas ledger, and four real devnet runs

Seat: Claude (Seat 3). Date: 2026-10-03. Branch `claude-LoVis/ant-extsig-client`,
built on `lane/ant-extsig-dual-ceiling` (PR #324) and carrying its commits.

## What was built

- `ops/ant-extsig/src/gate.rs` — reads `ETERNALIZATION-EDITION-V2.json`. The
  path comes from `--gate`, `ANT_EXTSIG_GATE`, or the crate's own location,
  never the working directory. A missing file, missing key, zero ceiling or
  malformed decimal refuses. There is no built-in fallback number. Decimals
  are parsed exactly, without floating point. It also carries the gate's
  artifact stop conditions (tar sha256, chunk count, client version).
- `ops/ant-extsig/src/budget.rs` — the plan-wide gas ledger. Before every
  signature the transaction's worst case (`gas_limit × fee_cap`) is reserved
  and written to disk. Only a mined receipt lowers a reservation. A failed or
  unknown-outcome send keeps it. A rerun of the same plan opens the same
  ledger and sees the earlier exposure. The fee cap for each send is derived
  from what remains, so a large transaction passes on a cheap chain and
  refuses on an expensive one.
- `ops/ant-extsig/src/main.rs` — wired to both. The fixed `ceiling / 300_000`
  fee cap is gone. The payment is simulated after the approval is mined, and
  the whole payment must fit before its first signature. Before the approval
  a lower-bound check stops an approval from being signed when the payment
  clearly cannot fit afterwards.

Unit tests: 17, all calling the code above.

## Receipts

Every block below is the program's own stdout from a run of this branch. Two
filters were applied by the command that wrote this file and nothing was
typed by hand: node log lines (`INFO`, `DEBUG`, `WARN`, `TRACE`) are dropped,
and so is any line carrying a hex string of 48 or more characters (DataMap
address, quote hashes, transaction hash, file sha256), because this
repository is public and its scanner rejects them.

### Unit tests

```
test budget::tests::buffer_matches_evmlib ... ok
test budget::tests::fee_cap_gives_headroom_but_never_more_than_the_budget ... ok
test budget::tests::payment_floor_stops_a_doomed_approval_but_not_a_cheap_one ... ok
test budget::tests::retries_cannot_exceed_the_ceiling ... ok
test budget::tests::reservations_accumulate_and_only_receipts_lower_them ... ok
test budget::tests::projection_refuses_before_anything_is_reserved ... ok
test budget::tests::an_over_budget_receipt_is_recorded_not_hidden ... ok
test gate::tests::gate_path_never_uses_the_working_directory ... ok
test gate::tests::missing_or_zero_fields_refuse_instead_of_defaulting ... ok
test gate::tests::decimal_is_exact_and_refuses_bad_shapes ... ok
test gate::tests::parses_the_real_gate_shape ... ok
test budget::tests::the_ledger_survives_a_rerun ... ok
test tests::an_unparseable_amount_fails_closed ... ok
test gate::tests::stop_conditions_name_every_tripped_condition ... ok
test tests::merkle_cost_of_no_pools_is_zero ... ok
test tests::storage_ceiling_exceeded_refuses_with_the_overage ... ok
test tests::storage_ceiling_within_limit ... ok
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### Run A — the upload passes (devnet base fee 0.1 gwei)

Command: `ops/ant-extsig/target/debug/ant-extsig.exe`

```
[0/6] gate C:\Users\travi\beehive-nature\.claude\worktrees\friendly-mclean-e83996\ops\ant-extsig\..\..\ETERNALIZATION-EDITION-V2.json: storage <= 100000000000000000000 atto-ANT, gas <= 200000000000000 wei (aggregate, all attempts)
[1/6] starting 8-node LocalDevnet + Anvil...
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
[3/6] preparing the a1-genesis upload...
      gate stop conditions: not applied, this file is not the gate artifact (devnet fixture); ceilings still apply
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
      arm: WAVE (4 quote payments, total 46875000000000000 atto)
[4/6] member wallet paying (wave arm)...
      gas ledger C:\Users\travi\AppData\Local\Temp\ant-extsig-gas-ledger-30540.json: ceiling 200000000000000 wei, carried exposure 0 wei from 0 earlier entr(ies)
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
      plan [token_approval]: gas_limit=55672 network_fee=178247123 fee_cap=356494246 worst_case=19846747663312 wei (remaining 200000000000000 wei)
      floor [approval + payment lower bound]: (55672 + 111344) gas x 178247123 wei = 29770121494968 wei (remaining 200000000000000 wei)
      approval mined: gas_used=46394, cost=3650732771834 wei (ledger exposure 3650732771834 wei, remaining 196349267228166 wei)
      plan [wave_payment(1 tx)]: gas_limit=226198 network_fee=157379521 fee_cap=314759042 worst_case=71197865782316 wei (remaining 196349267228166 wei)
      paid 4 quote payments: gas_limit_set=226198 max_fee_set=Some(157379521) gas_used=183699 cost=12653915302836 wei (ledger exposure 16304648074670 wei)
      storage check [pre_finalize]: 46875000000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
[5/6] INTERRUPT: client destroyed -- reconnecting FRESH for the resume...
RECEIPT {
  "bytes_stored": 295,
  "client_version": "ant-extsig 0.3.0",
  "estate_client_held_wallet": false,
  "file": "C:\\Users\\travi\\AppData\\Local\\Temp\\a1-genesis.json",
  "file_is_gate_artifact": false,
  "gas_ceiling_met": true,
  "gas_ceiling_wei": "200000000000000",
  "gas_exposure_wei": "16304648074670",
  "gas_ledger": [
    {
      "reserved_wei": "19846747663312",
      "settled_wei": "3650732771834",
      "stage": "token_approval"
    },
    {
      "reserved_wei": "71197865782316",
      "settled_wei": "12653915302836",
      "stage": "wave_payment(1 tx)"
    }
  ],
  "gas_ledger_path": "C:\\Users\\travi\\AppData\\Local\\Temp\\ant-extsig-gas-ledger-30540.json",
  "gate_path": "C:\\Users\\travi\\beehive-nature\\.claude\\worktrees\\friendly-mclean-e83996\\ops\\ant-extsig\\..\\..\\ETERNALIZATION-EDITION-V2.json",
  "interrupt": "client destroyed after payment; fresh client finalized",
  "paid_atto": "46875000000000000",
  "payer_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "payment_arm": "wave",
  "resumed_without_new_quote": true,
  "roundtrip_byte_identical": true,
  "storage_ceiling_atto": "100000000000000000000",
  "storage_ceiling_met": true,
  "upload_result_debug": "FileUploadResult { data_map: DataMap:\n        ChunkInfo { index: 0, dst_hash: 9b0de8..7141a6, src_hash: 052138..34a8ad, ",
  "winner_hashes": []
}
```

### Run B — a default Anvil base fee refuses before anything is signed

The binary was copied alone into an empty directory and run from a different
working directory, with the stock `anvil` on `PATH`. The gate was still found,
which is the working-directory independence. Exit code 1.

```
[0/6] gate C:\Users\travi\beehive-nature\.claude\worktrees\friendly-mclean-e83996\ops\ant-extsig\..\..\ETERNALIZATION-EDITION-V2.json: storage <= 100000000000000000000 atto-ANT, gas <= 200000000000000 wei (aggregate, all attempts)
[1/6] starting 8-node LocalDevnet + Anvil...
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
[3/6] preparing the a1-genesis upload...
      gate stop conditions: not applied, this file is not the gate artifact (devnet fixture); ceilings still apply
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
      arm: WAVE (4 quote payments, total 46875000000000000 atto)
[4/6] member wallet paying (wave arm)...
      gas ledger C:\Users\travi\AppData\Local\Temp\ant-extsig-gas-ledger-14176.json: ceiling 200000000000000 wei, carried exposure 0 wei from 0 earlier entr(ies)
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
      plan [token_approval]: gas_limit=55672 network_fee=1782471219 fee_cap=3564942438 worst_case=198467475408336 wei (remaining 200000000000000 wei)
      floor [approval + payment lower bound]: (55672 + 111344) gas x 1782471219 wei = 297701213112504 wei (remaining 200000000000000 wei)
Error: "REFUSE: planned gas for the approval plus a lower bound for the payment is 297701213112504 wei, which exceeds the remaining budget 200000000000000 wei by 97701213112504 wei (ceiling 200000000000000 wei, already exposed 0 wei)"
```

### Runs C1 and C2 — the same plan twice against one persistent ledger

`ANT_EXTSIG_LEDGER` named one file for both runs. The second run opens with
the first run's exposure carried, and adds to it.

C1:

```
      gas ledger C:\Users\travi\AppData\Local\Temp/ant-extsig-final-ledger.json: ceiling 200000000000000 wei, carried exposure 0 wei from 0 earlier entr(ies)
      plan [token_approval]: gas_limit=55672 network_fee=178247123 fee_cap=356494246 worst_case=19846747663312 wei (remaining 200000000000000 wei)
      floor [approval + payment lower bound]: (55672 + 111344) gas x 178247123 wei = 29770121494968 wei (remaining 200000000000000 wei)
      approval mined: gas_used=46394, cost=3650732771834 wei (ledger exposure 3650732771834 wei, remaining 196349267228166 wei)
      plan [wave_payment(1 tx)]: gas_limit=226213 network_fee=157379521 fee_cap=314759042 worst_case=71202587167946 wei (remaining 196349267228166 wei)
      paid 4 quote payments: gas_limit_set=226213 max_fee_set=Some(157379521) gas_used=183711 cost=12654741910404 wei (ledger exposure 16305474682238 wei)
  "gas_exposure_wei": "16305474682238",
```

C2:

```
      gas ledger C:\Users\travi\AppData\Local\Temp/ant-extsig-final-ledger.json: ceiling 200000000000000 wei, carried exposure 16305474682238 wei from 2 earlier entr(ies)
      plan [token_approval]: gas_limit=55672 network_fee=178247123 fee_cap=356494246 worst_case=19846747663312 wei (remaining 183694525317762 wei)
      floor [approval + payment lower bound]: (55672 + 111344) gas x 178247123 wei = 29770121494968 wei (remaining 183694525317762 wei)
      approval mined: gas_used=46394, cost=3650732771834 wei (ledger exposure 19956207454072 wei, remaining 180043792545928 wei)
      plan [wave_payment(1 tx)]: gas_limit=226213 network_fee=157379521 fee_cap=314759042 worst_case=71202587167946 wei (remaining 180043792545928 wei)
      paid 4 quote payments: gas_limit_set=226213 max_fee_set=Some(157379521) gas_used=183711 cost=12654741910404 wei (ledger exposure 32610949364476 wei)
  "gas_exposure_wei": "32610949364476",
```

## What these runs do not show

- **The merkle arm has not executed.** The fixture is 4 chunks and the devnet
  has 8 nodes; `PaymentMode::Auto` selects wave below 64 chunks
  (ant-core `681d48f` `merkle.rs:44`, `:720-725`), and merkle needs 16 remote
  peers (`merkle.rs:1293-1304`). The merkle code path compiles and is
  budgeted the same way, but it is UNVERIFIED by a run.
- **No mainnet transaction was made and no real key was used.** The payer is
  the devnet's funded test account.
- **The gate artifact was not uploaded.** Its stop conditions are implemented
  and unit-tested; on these runs they print as not applied because the
  fixture is not the gate artifact. For the real artifact two of them are
  already tripped: the artifact changed on 2026-10-03, and this client is not
  the `ant 0.3.9` the gate's quote names. The gate must be rebuilt, re-quoted
  and re-issued for `ant-extsig 0.3.0` before a real run can pass them.
- **The gas limit is not bound.** evmlib re-estimates gas when it sends
  (`evmlib` v0.10.0 `retry.rs:211-221`). The ledger reserves against the
  pre-send estimate and the fee cap the signer enforces. The mined cost is
  then recorded as it is, including when it exceeds the reservation.
- **The pre-approval floor is a heuristic.** Half an approval per transfer is
  a lower bound chosen from one measurement (approval 55,672 gas; a
  four-transfer payment 226,213). It only refuses early.
- **The harness is devnet-only.** It starts `LocalDevnet` itself. Pointing it
  at mainnet with an external signer is the remaining step toward a paid
  upload.

## One platform fact worth keeping

On Windows the devnet's `anvil` is resolved from the directory of the running
binary before `PATH`. The `anvil` wrapper built beside `ant-extsig.exe` is
therefore always used when the binary runs from `target/debug`, whatever
`PATH` says. Run B copied the binary elsewhere for that reason.

## Relation to PR #324

This branch contains #324's commits and replaces its gate loading, its fixed
fee cap and its per-transaction gas check. `/api/preserve/upload` stays
disabled; this CLI is the execution path, as the gate requires.
