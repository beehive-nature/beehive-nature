# ant-extsig: review fixes for PR #341, the merkle arm, an archive-sized upload, and a keyless mainnet quote

Seat: Claude (Seat 3). Date: 2026-10-03. Branch `claude-LoVis/ant-extsig-client`
(PR #341), on top of head `247ec9514`.

## Why this exists

PR #341 at `247ec9514` was reviewed read-only by a separate agent against the
code at that sha. Verdict: not mergeable. Its receipts recomputed correctly
and the earlier blockers were fixed, but two new ones stood. Both are fixed
here, with the smaller findings.

## What the review found, and what changed

**Blocking 1: evmlib retries inside one send call.** evmlib retries a failed
send or confirmation up to three times (`evmlib` v0.10.0 `retry.rs:9`, loop at
`:107-170`). A retry after a broadcast timeout goes out with a fresh nonce
(`:234-238`), so an earlier attempt can still be mined beside it. The ledger
reserved one worst case per call and settled from the last attempt's receipt
only. Up to three further transactions were uncounted.

- Every reservation is now `gas_limit × 4 attempts × fee_cap`
  (`budget.rs` `SEND_ATTEMPTS`). The fee cap is derived against all four.
- A reservation is no longer settled from the last receipt alone. It is
  settled at the larger of that receipt cost and the payer's ETH balance
  change across the call, read from the chain, and only when the payer has no
  pending transaction. The payment token is an ERC-20, so ETH leaves this
  account only as gas; the balance change covers every transaction that
  mined. Otherwise the full reservation stays.
- The pre-approval floor counts four attempts too, so an approval is not
  signed for a payment that will not fit (run W100 below).

**Blocking 2: a rerun started from an empty ledger by default.** The default
ledger path carried the process id. Only a run that set `ANT_EXTSIG_LEDGER`
met its history. The earlier dispatch's sentence saying otherwise was false
and is deleted there.

- The default path is now derived from the plan id (network, payer, DataMap
  address) under `ANT_EXTSIG_STATE_DIR` or the user's local application data
  directory. With neither available the run refuses. Runs A1 and A2 below use
  no ledger variable and A2 opens with A1's exposure.

**Smaller findings, fixed:**

- Ceilings no longer pass through a float. A JSON number in the gate is read
  from the file's own characters (`gate.rs` `raw_number_literal`); a value a
  float would have rounded is refused.
- The ledger file is flushed to the device before the rename.
- The stop conditions were skipped for any file whose sha256 was not the
  gate's, so a changed artifact could never trip them. They are now enforced
  for every file the caller names. Only the harness's own generated fixtures,
  or a file passed with `--devnet-fixture`, skip them.
- The allowance is checked again before paying. evmlib's pay calls approve an
  unlimited amount themselves when the allowance is short
  (`evmlib` v0.10.0 `wallet.rs`); the harness now refuses instead of reaching
  them short.
- A mistyped file path is no longer filled with the fixture and uploaded.
- The anvil wrapper's comment citing an 800,000,000 wei cap described code
  that no longer exists. Deleted.

**Added for the large-file runs:** `--nodes N`, `--mode auto|merkle|single`,
`--fixture-bytes N` (deterministic bytes), and `ANT_EXTSIG_ANVIL_BASE_FEE` for
the wrapper. On Windows the wrapper now places the real anvil in a
kill-on-close job object. Before this, a killed wrapper left anvil running;
seven such processes from earlier runs were found on this box.

## Receipts

Every block is the program's own output from one build of this branch. The
generator drops node log lines (`INFO`, `DEBUG`, `WARN`, `TRACE`) and any line
carrying a hex string of 48 or more characters, because this repository is
public and its scanner rejects them. Nothing else is removed and nothing is
typed by hand. The first line of each block is the command; the last is the
exit code. Each run started from an empty state directory except A2.

### Unit tests

```
test budget::tests::buffer_matches_evmlib ... ok
test budget::tests::payment_floor_stops_a_doomed_approval_but_not_a_cheap_one ... ok
test budget::tests::fee_cap_gives_headroom_but_never_more_than_the_budget ... ok
test budget::tests::the_default_ledger_path_is_the_same_for_every_run_of_a_plan ... ok
test gate::tests::decimal_is_exact_and_refuses_bad_shapes ... ok
test gate::tests::ceilings_are_read_from_the_gate_text_not_through_a_float ... ok
test gate::tests::missing_or_zero_fields_refuse_instead_of_defaulting ... ok
test gate::tests::gate_path_never_uses_the_working_directory ... ok
test gate::tests::stop_conditions_name_every_tripped_condition ... ok
test gate::tests::parses_the_real_gate_shape ... ok
test tests::an_unparseable_amount_fails_closed ... ok
test tests::merkle_cost_of_no_pools_is_zero ... ok
test tests::storage_ceiling_exceeded_refuses_with_the_overage ... ok
test tests::storage_ceiling_within_limit ... ok
test budget::tests::projection_refuses_before_anything_is_reserved ... ok
test tests::fixture_is_deterministic_and_exactly_sized ... ok
test budget::tests::one_reservation_covers_every_attempt_evmlib_can_send ... ok
test budget::tests::retries_cannot_exceed_the_ceiling ... ok
test budget::tests::an_over_budget_receipt_is_recorded_not_hidden ... ok
test budget::tests::the_ledger_survives_a_rerun ... ok
test budget::tests::reservations_accumulate_and_only_receipts_lower_them ... ok
test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### A1: small upload, wave arm, 8 nodes

```
$ ant-extsig   (base fee -)
[0/6] gate C:\Users\travi\beehive-nature\.claude\worktrees\autonomi-browser-integration-f1b7f6\ops\ant-extsig\..\..\ETERNALIZATION-EDITION-V2.json: storage <= 100000000000000000000 atto-ANT, gas <= 200000000000000 wei (aggregate, all attempts)
[1/6] starting 8-node LocalDevnet + Anvil...
[3/6] preparing the upload of a1-genesis.json (295 bytes, mode Auto)...
      gate stop conditions: not applied to a devnet fixture; ceilings still apply
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
      arm: WAVE (4 quote payments, total 46875000000000000 atto)
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
[4/6] member wallet paying (wave arm)...
      gas ledger C:\Users\travi\AppData\Local\Temp\claude\C--Users-travi-beehive-nature--claude-worktrees-autonomi-browser-integration-f1b7f6\4f0ed443-540a-4de2-be7c-3935d0b9c9b7\scratchpad\stateA\ant-extsig\ledgers\gas-ledger-e41e9264889d2104.json: ceiling 200000000000000 wei, carried exposure 0 wei from 0 earlier entr(ies)
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
      plan [token_approval]: gas_limit=55672 x 4 attempts network_fee=178247123 fee_cap=356494246 worst_case=79386990653248 wei (remaining 200000000000000 wei)
      floor [approval + payment lower bound]: (55672 + 111344) gas x 4 attempts x 178247123 wei = 119080485979872 wei (remaining 200000000000000 wei)
      approval settled at 3650732771834 wei, the larger of balance change Some(3650732771834) and receipt Some(3650732771834) (ledger exposure 3650732771834 wei, remaining 196349267228166 wei)
      plan [wave_payment(1 tx)]: gas_limit=226170 x 4 attempts network_fee=157379521 fee_cap=217037258 worst_case=196349266567440 wei (remaining 196349267228166 wei)
      paid 4 quote payments: gas_limit_set=226170 max_fee_set=Some(157379521) gas_used=183675 receipt_cost=12652262087700 wei balance_change=Some(12652262087700) settled=12652262087700 wei (ledger exposure 16302994859534 wei)
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
  "gas_exposure_wei": "16302994859534",
  "gas_ledger": [
    {
      "reserved_wei": "79386990653248",
      "settled_wei": "3650732771834",
      "stage": "token_approval"
    },
    {
      "reserved_wei": "196349266567440",
      "settled_wei": "12652262087700",
      "stage": "wave_payment(1 tx)"
    }
  ],
  "gas_ledger_path": "C:\\Users\\travi\\AppData\\Local\\Temp\\claude\\C--Users-travi-beehive-nature--claude-worktrees-autonomi-browser-integration-f1b7f6\\4f0ed443-540a-4de2-be7c-3935d0b9c9b7\\scratchpad\\stateA\\ant-extsig\\ledgers\\gas-ledger-e41e9264889d2104.json",
  "gate_path": "C:\\Users\\travi\\beehive-nature\\.claude\\worktrees\\autonomi-browser-integration-f1b7f6\\ops\\ant-extsig\\..\\..\\ETERNALIZATION-EDITION-V2.json",
  "interrupt": "client destroyed after payment; fresh client finalized",
  "network": "devnet",
  "node_count": 8,
  "paid_atto": "46875000000000000",
  "payer_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "payment_arm": "wave",
  "payment_mode_requested": "Auto",
  "resumed_without_new_quote": true,
  "roundtrip_byte_identical": true,
  "storage_ceiling_atto": "100000000000000000000",
  "storage_ceiling_met": true,
  "total_chunks": 4,
  "upload_result_debug": "FileUploadResult { data_map: DataMap:\n        ChunkInfo { index: 0, dst_hash: 9b0de8..7141a6, src_hash: 052138..34a8ad, ",
  "winner_hashes": []
}
exit code 0
```

### A2: the same command again, no ledger variable

```
$ ant-extsig   (base fee -)
[0/6] gate C:\Users\travi\beehive-nature\.claude\worktrees\autonomi-browser-integration-f1b7f6\ops\ant-extsig\..\..\ETERNALIZATION-EDITION-V2.json: storage <= 100000000000000000000 atto-ANT, gas <= 200000000000000 wei (aggregate, all attempts)
[1/6] starting 8-node LocalDevnet + Anvil...
[3/6] preparing the upload of a1-genesis.json (295 bytes, mode Auto)...
      gate stop conditions: not applied to a devnet fixture; ceilings still apply
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
      arm: WAVE (4 quote payments, total 46875000000000000 atto)
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
[4/6] member wallet paying (wave arm)...
      gas ledger C:\Users\travi\AppData\Local\Temp\claude\C--Users-travi-beehive-nature--claude-worktrees-autonomi-browser-integration-f1b7f6\4f0ed443-540a-4de2-be7c-3935d0b9c9b7\scratchpad\stateA\ant-extsig\ledgers\gas-ledger-e41e9264889d2104.json: ceiling 200000000000000 wei, carried exposure 16302994859534 wei from 2 earlier entr(ies)
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
      plan [token_approval]: gas_limit=55672 x 4 attempts network_fee=178247123 fee_cap=356494246 worst_case=79386990653248 wei (remaining 183697005140466 wei)
      floor [approval + payment lower bound]: (55672 + 111344) gas x 4 attempts x 178247123 wei = 119080485979872 wei (remaining 183697005140466 wei)
      approval settled at 3650732771834 wei, the larger of balance change Some(3650732771834) and receipt Some(3650732771834) (ledger exposure 19953727631368 wei, remaining 180046272368632 wei)
      plan [wave_payment(1 tx)]: gas_limit=226198 x 4 attempts network_fee=157379521 fee_cap=198991892 worst_case=180046271946464 wei (remaining 180046272368632 wei)
      paid 4 quote payments: gas_limit_set=226198 max_fee_set=Some(157379521) gas_used=183699 receipt_cost=12653915302836 wei balance_change=Some(12653915302836) settled=12653915302836 wei (ledger exposure 32607642934204 wei)
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
  "gas_exposure_wei": "32607642934204",
  "gas_ledger": [
    {
      "reserved_wei": "79386990653248",
      "settled_wei": "3650732771834",
      "stage": "token_approval"
    },
    {
      "reserved_wei": "196349266567440",
      "settled_wei": "12652262087700",
      "stage": "wave_payment(1 tx)"
    },
    {
      "reserved_wei": "79386990653248",
      "settled_wei": "3650732771834",
      "stage": "token_approval"
    },
    {
      "reserved_wei": "180046271946464",
      "settled_wei": "12653915302836",
      "stage": "wave_payment(1 tx)"
    }
  ],
  "gas_ledger_path": "C:\\Users\\travi\\AppData\\Local\\Temp\\claude\\C--Users-travi-beehive-nature--claude-worktrees-autonomi-browser-integration-f1b7f6\\4f0ed443-540a-4de2-be7c-3935d0b9c9b7\\scratchpad\\stateA\\ant-extsig\\ledgers\\gas-ledger-e41e9264889d2104.json",
  "gate_path": "C:\\Users\\travi\\beehive-nature\\.claude\\worktrees\\autonomi-browser-integration-f1b7f6\\ops\\ant-extsig\\..\\..\\ETERNALIZATION-EDITION-V2.json",
  "interrupt": "client destroyed after payment; fresh client finalized",
  "network": "devnet",
  "node_count": 8,
  "paid_atto": "46875000000000000",
  "payer_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "payment_arm": "wave",
  "payment_mode_requested": "Auto",
  "resumed_without_new_quote": true,
  "roundtrip_byte_identical": true,
  "storage_ceiling_atto": "100000000000000000000",
  "storage_ceiling_met": true,
  "total_chunks": 4,
  "upload_result_debug": "FileUploadResult { data_map: DataMap:\n        ChunkInfo { index: 0, dst_hash: 9b0de8..7141a6, src_hash: 052138..34a8ad, ",
  "winner_hashes": []
}
exit code 0
```

### M: the merkle arm, 20 nodes

`--mode merkle` asks for merkle at 2 chunks or more
(ant-core `681d48f` `merkle.rs` `should_use_merkle`); 20 nodes gives the 16
remote peers a candidate pool needs (`evmlib` `CANDIDATES_PER_POOL`).

```
$ ant-extsig --mode merkle --nodes 20  (base fee -)
[0/6] gate C:\Users\travi\beehive-nature\.claude\worktrees\autonomi-browser-integration-f1b7f6\ops\ant-extsig\..\..\ETERNALIZATION-EDITION-V2.json: storage <= 100000000000000000000 atto-ANT, gas <= 200000000000000 wei (aggregate, all attempts)
[1/6] starting 20-node LocalDevnet + Anvil...
[3/6] preparing the upload of a1-genesis.json (295 bytes, mode Merkle)...
      gate stop conditions: not applied to a devnet fixture; ceilings still apply
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
      arm: MERKLE (1 batch(es), total estimated 46875000000000000 atto)
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
[4/6] member wallet paying (merkle arm)...
      gas ledger C:\Users\travi\AppData\Local\Temp\claude\C--Users-travi-beehive-nature--claude-worktrees-autonomi-browser-integration-f1b7f6\4f0ed443-540a-4de2-be7c-3935d0b9c9b7\scratchpad\stateM\ant-extsig\ledgers\gas-ledger-e41e9264889d2104.json: ceiling 200000000000000 wei, carried exposure 0 wei from 0 earlier entr(ies)
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
      plan [token_approval]: gas_limit=55672 x 4 attempts network_fee=178247123 fee_cap=356494246 worst_case=79386990653248 wei (remaining 200000000000000 wei)
      floor [approval + payment lower bound]: (55672 + 27836) gas x 4 attempts x 178247123 wei = 59540242989936 wei (remaining 200000000000000 wei)
      approval settled at 3650732771834 wei, the larger of balance change Some(3650732771834) and receipt Some(3650732771834) (ledger exposure 3650732771834 wei, remaining 196349267228166 wei)
      plan [merkle_payment(1 tx)]: gas_limit=302197 x 4 attempts network_fee=157379521 fee_cap=162434824 worst_case=196349266033312 wei (remaining 196349267228166 wei)
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
  "gas_exposure_wei": "20667207282718",
  "gas_ledger": [
    {
      "reserved_wei": "79386990653248",
      "settled_wei": "3650732771834",
      "stage": "token_approval"
    },
    {
      "reserved_wei": "196349266033312",
      "settled_wei": "17016474510884",
      "stage": "merkle_batch_0"
    }
  ],
  "gas_ledger_path": "C:\\Users\\travi\\AppData\\Local\\Temp\\claude\\C--Users-travi-beehive-nature--claude-worktrees-autonomi-browser-integration-f1b7f6\\4f0ed443-540a-4de2-be7c-3935d0b9c9b7\\scratchpad\\stateM\\ant-extsig\\ledgers\\gas-ledger-e41e9264889d2104.json",
  "gate_path": "C:\\Users\\travi\\beehive-nature\\.claude\\worktrees\\autonomi-browser-integration-f1b7f6\\ops\\ant-extsig\\..\\..\\ETERNALIZATION-EDITION-V2.json",
  "interrupt": "client destroyed after payment; fresh client finalized",
  "network": "devnet",
  "node_count": 20,
  "paid_atto": "46875000000000000",
  "payer_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "payment_arm": "merkle",
  "payment_mode_requested": "Merkle",
  "resumed_without_new_quote": true,
  "roundtrip_byte_identical": true,
  "storage_ceiling_atto": "100000000000000000000",
  "storage_ceiling_met": true,
  "total_chunks": 4,
  "upload_result_debug": "FileUploadResult { data_map: DataMap:\n        ChunkInfo { index: 0, dst_hash: 9b0de8..7141a6, src_hash: 052138..34a8ad, ",
  "winner_hashes": [
  ]
}
exit code 0
```

### W20: an archive-sized file at today's Arbitrum One fee

106,833,920 bytes is the gate artifact's `tarBytes`. The devnet base fee was
set to 20,000,000 wei. `eth_gasPrice` read 20,000,000 wei on
`arb1.arbitrum.io/rpc` and 20,074,000 wei on `arbitrum-one-rpc.publicnode.com`
on 2026-10-03.

```
$ ant-extsig --fixture-bytes 106833920  (base fee 20000000)
[0/6] gate C:\Users\travi\beehive-nature\.claude\worktrees\autonomi-browser-integration-f1b7f6\ops\ant-extsig\..\..\ETERNALIZATION-EDITION-V2.json: storage <= 100000000000000000000 atto-ANT, gas <= 200000000000000 wei (aggregate, all attempts)
[1/6] starting 8-node LocalDevnet + Anvil...
[3/6] preparing the upload of ant-extsig-fixture-106833920.bin (106833920 bytes, mode Auto)...
      gate stop conditions: not applied to a devnet fixture; ceilings still apply
      storage check [prepare_quotes]: 351562500000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
      arm: WAVE (30 quote payments, total 351562500000000000 atto)
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
[4/6] member wallet paying (wave arm)...
      gas ledger C:\Users\travi\AppData\Local\Temp\claude\C--Users-travi-beehive-nature--claude-worktrees-autonomi-browser-integration-f1b7f6\4f0ed443-540a-4de2-be7c-3935d0b9c9b7\scratchpad\stateW\ant-extsig\ledgers\gas-ledger-9f6435f43ac08cba.json: ceiling 200000000000000 wei, carried exposure 0 wei from 0 earlier entr(ies)
      current vault allowance 0 < required 351562500000000000; approving EXACT amount...
      plan [token_approval]: gas_limit=55672 x 4 attempts network_fee=35649427 fee_cap=71298854 worst_case=15877399199552 wei (remaining 200000000000000 wei)
      floor [approval + payment lower bound]: (55672 + 835080) gas x 4 attempts x 35649427 wei = 127019193596416 wei (remaining 200000000000000 wei)
      approval settled at 730146637876 wei, the larger of balance change Some(730146637876) and receipt Some(730146637876) (ledger exposure 730146637876 wei, remaining 199269853362124 wei)
      plan [wave_payment(1 tx)]: gas_limit=1197500 x 4 attempts network_fee=31475907 fee_cap=41601221 worst_case=199269848590000 wei (remaining 199269853362124 wei)
      paid 30 quote payments: gas_limit_set=1197500 max_fee_set=Some(31475907) gas_used=993117 receipt_cost=13681969320015 wei balance_change=Some(13681969320015) settled=13681969320015 wei (ledger exposure 14412115957891 wei)
      storage check [pre_finalize]: 351562500000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
[5/6] INTERRUPT: client destroyed -- reconnecting FRESH for the resume...
RECEIPT {
  "bytes_stored": 106833920,
  "client_version": "ant-extsig 0.3.0",
  "estate_client_held_wallet": false,
  "file": "C:\\Users\\travi\\AppData\\Local\\Temp\\ant-extsig-fixture-106833920.bin",
  "file_is_gate_artifact": false,
  "gas_ceiling_met": true,
  "gas_ceiling_wei": "200000000000000",
  "gas_exposure_wei": "14412115957891",
  "gas_ledger": [
    {
      "reserved_wei": "15877399199552",
      "settled_wei": "730146637876",
      "stage": "token_approval"
    },
    {
      "reserved_wei": "199269848590000",
      "settled_wei": "13681969320015",
      "stage": "wave_payment(1 tx)"
    }
  ],
  "gas_ledger_path": "C:\\Users\\travi\\AppData\\Local\\Temp\\claude\\C--Users-travi-beehive-nature--claude-worktrees-autonomi-browser-integration-f1b7f6\\4f0ed443-540a-4de2-be7c-3935d0b9c9b7\\scratchpad\\stateW\\ant-extsig\\ledgers\\gas-ledger-9f6435f43ac08cba.json",
  "gate_path": "C:\\Users\\travi\\beehive-nature\\.claude\\worktrees\\autonomi-browser-integration-f1b7f6\\ops\\ant-extsig\\..\\..\\ETERNALIZATION-EDITION-V2.json",
  "interrupt": "client destroyed after payment; fresh client finalized",
  "network": "devnet",
  "node_count": 8,
  "paid_atto": "351562500000000000",
  "payer_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "payment_arm": "wave",
  "payment_mode_requested": "Auto",
  "resumed_without_new_quote": true,
  "roundtrip_byte_identical": true,
  "storage_ceiling_atto": "100000000000000000000",
  "storage_ceiling_met": true,
  "total_chunks": 30,
  "upload_result_debug": "FileUploadResult { data_map: DataMap:\n    child: 1\n        ChunkInfo { index: 0, dst_hash: 82e658..fedc33, src_hash: 145",
  "winner_hashes": []
}
exit code 0
```

### W100: the same file at the wrapper's default 0.1 gwei

```
$ ant-extsig --fixture-bytes 106833920  (base fee -)
[0/6] gate C:\Users\travi\beehive-nature\.claude\worktrees\autonomi-browser-integration-f1b7f6\ops\ant-extsig\..\..\ETERNALIZATION-EDITION-V2.json: storage <= 100000000000000000000 atto-ANT, gas <= 200000000000000 wei (aggregate, all attempts)
[1/6] starting 8-node LocalDevnet + Anvil...
[3/6] preparing the upload of ant-extsig-fixture-106833920.bin (106833920 bytes, mode Auto)...
      gate stop conditions: not applied to a devnet fixture; ceilings still apply
      storage check [prepare_quotes]: 351562500000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
      arm: WAVE (30 quote payments, total 351562500000000000 atto)
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
[4/6] member wallet paying (wave arm)...
      gas ledger C:\Users\travi\AppData\Local\Temp\claude\C--Users-travi-beehive-nature--claude-worktrees-autonomi-browser-integration-f1b7f6\4f0ed443-540a-4de2-be7c-3935d0b9c9b7\scratchpad\stateW100\ant-extsig\ledgers\gas-ledger-9f6435f43ac08cba.json: ceiling 200000000000000 wei, carried exposure 0 wei from 0 earlier entr(ies)
      current vault allowance 0 < required 351562500000000000; approving EXACT amount...
      plan [token_approval]: gas_limit=55672 x 4 attempts network_fee=178247123 fee_cap=356494246 worst_case=79386990653248 wei (remaining 200000000000000 wei)
      floor [approval + payment lower bound]: (55672 + 835080) gas x 4 attempts x 178247123 wei = 635095925225984 wei (remaining 200000000000000 wei)
exit code 1
Error: "REFUSE: planned gas for the approval plus a lower bound for the payment is 635095925225984 wei, which exceeds the remaining budget 200000000000000 wei by 435095925225984 wei (ceiling 200000000000000 wei, already exposed 0 wei)"
```

## What these runs do and do not show

- **The merkle arm has now executed**, with one batch of 4 chunks. A
  multi-batch merkle payment has not run.
- **An archive-sized wave payment has now executed**: 30 quote payments in
  one transaction, 993,117 gas. The fixture is random bytes and prepared as
  30 chunks. The gate's artifact was quoted at 29. The real artifact was not
  uploaded.
- **The retry path was not exercised.** No send was retried in any run, so
  the four-attempt reservation and the pending-nonce guard are covered by unit
  test and by reading evmlib, not by a live retry.
- **Headroom at today's fee is thin.** In W20 the payment's fee cap was
  41,601,221 wei per gas against a network estimate of 31,475,907: the
  four-attempt reservation of a 1.2M-gas payment uses nearly the whole
  0.0002 ETH. Anvil does not charge Arbitrum's L1 data fee, so a mainnet
  estimate will be higher. At 0.1 gwei the pre-approval floor refuses the
  same upload (W100), before any signature.
- **The balance change assumes nothing else moves the payer's ETH during the
  call.** ETH leaving for another reason is counted as gas, which errs high.
  ETH arriving makes the balance change smaller, which errs low; the settle
  is then bounded below only by the last attempt's receipt, so an extra mined
  retry could go uncounted in that case. A second review found this in the
  first version of the fix (`2b63ad216`), which used the balance change alone.
- **A named file cannot be paid for yet, even on the devnet.** The gate's
  quote names `ant 0.3.9` and this client is `ant-extsig 0.3.0`, so the client
  version stop condition trips for every file not declared a fixture, the
  real artifact included, until the gate is re-issued.
- **A devnet ledger outlives its chain.** The devnet payer is always the same
  test account, so the default ledger for a fixture carries exposure from
  chains that no longer exist and refuses after about twelve runs. Delete the
  file under the state directory, or set `ANT_EXTSIG_STATE_DIR`, between
  devnet campaigns. The runs here each used their own state directory.
- **The ledger has no lock.** Two runs of one plan at the same time lose each
  other's entries.
- **A ledger file is local state.** Deleting it, or naming another with
  `ANT_EXTSIG_LEDGER`, discards the history. The chain is the only record
  that cannot be discarded, and this client does not rebuild the ledger from it.
- **The gas limit is still not bound.** evmlib re-estimates when it sends.
  The fee cap is enforced by the signer; the spend is recorded as it is.
- **No mainnet transaction was made and no real key was used.**

## Mainnet: quote only

`--network mainnet` connects to the real network and Arbitrum One. Without
`--pay` it quotes and stops: no key is read, no wallet object exists and
nothing is signed. With `--pay` it enforces every gate stop condition for
every file, requires the gate's own `paymentClientCapability.uploadEnabled`
to be true, and reads the key only from the file `MEMBER_KEY_FILE` names. No
`--pay` run has been made on mainnet and no key has been given to this seat.

### Q1: a small public file from this repository

```
$ ant-extsig --network mainnet ops/ant-extsig/BROWSER-PATTERN.md
[0/6] gate C:\Users\travi\beehive-nature\.claude\worktrees\autonomi-browser-integration-f1b7f6\ops\ant-extsig\..\..\ETERNALIZATION-EDITION-V2.json: storage <= 100000000000000000000 atto-ANT, gas <= 200000000000000 wei (aggregate, all attempts)
[1/6] network: Autonomi mainnet, payments on Arbitrum One (quote only: no key, no wallet, no signature)
[3/6] preparing the upload of BROWSER-PATTERN.md (5740 bytes, mode Auto)...
      gate stop condition tripped (reported, a quote signs nothing): chunk count change: prepared 4 vs gate 29
      gate stop condition tripped (reported, a quote signs nothing): client version change: this client 'ant-extsig 0.3.0' vs gate 'ant 0.3.9'
      storage check [prepare_quotes]: 217483010742187500 atto-ANT (ceiling: 100000000000000000000 atto-ANT)
      arm: WAVE (4 quote payments, total 217483010742187500 atto)
QUOTE {
  "captured_unix": 1791058329,
  "chunks_already_stored": 0,
  "client_version": "ant-extsig 0.3.0",
  "file": "C:/Users/travi/beehive-nature/.claude/worktrees/autonomi-browser-integration-f1b7f6/ops/ant-extsig/BROWSER-PATTERN.md",
  "file_is_gate_artifact": false,
  "file_size": 5740,
  "gas_ceiling_wei": "200000000000000",
  "gate_path": "C:\\Users\\travi\\beehive-nature\\.claude\\worktrees\\autonomi-browser-integration-f1b7f6\\ops\\ant-extsig\\..\\..\\ETERNALIZATION-EDITION-V2.json",
  "gate_stop_conditions_tripped": [
    "chunk count change: prepared 4 vs gate 29",
    "client version change: this client 'ant-extsig 0.3.0' vs gate 'ant 0.3.9'"
  ],
  "network": "arbitrum-one",
  "payment_arm": "wave",
  "payment_mode_requested": "Auto",
  "signed": false,
  "storage_ceiling_atto": "100000000000000000000",
  "storage_cost_atto": "217483010742187500",
  "total_chunks": 4,
  "wallet_constructed": false
}
exit code 0
```

### Q2: `--pay` with no key present refuses at the gate

The refusal names the three tripped stop conditions. Its line carries two
digests, so the generator drops it; the exit code and the absence of any
payment line remain.

```
$ ant-extsig --network mainnet --pay ops/ant-extsig/BROWSER-PATTERN.md   (MEMBER_KEY_FILE not set)
[0/6] gate C:\Users\travi\beehive-nature\.claude\worktrees\autonomi-browser-integration-f1b7f6\ops\ant-extsig\..\..\ETERNALIZATION-EDITION-V2.json: storage <= 100000000000000000000 atto-ANT, gas <= 200000000000000 wei (aggregate, all attempts)
[1/6] network: Autonomi mainnet, payments on Arbitrum One
[3/6] preparing the upload of BROWSER-PATTERN.md (5740 bytes, mode Auto)...
exit code 1
```

### Q3: a fixture is refused on mainnet

```
$ ant-extsig --network mainnet --fixture-bytes 4096
exit code 1
Error: "REFUSE: --network mainnet takes a real file; fixtures are for the devnet"
```

### What is left for the gate

The gate itself is not changed by this branch. `uploadEnabled` stays false and
the artifact changed on 2026-10-03, so the gate still needs the rebuilt
artifact, a quote of it from this client, and a re-issue naming
`ant-extsig 0.3.0`. No quote of the archive is recorded in this dispatch; that
belongs to the archive lane, which owns the private package.
