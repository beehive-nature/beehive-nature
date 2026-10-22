# Local verification receipts

Upstream base `4d41f88f57e92eb439dda184700350f80d86c84a`;
guard-only commit `ff3f46a351d1e01d8ef3f6c0dfe57f4698093cde`; final V3 fix `a9f77b1d6a2cda60c0d44d28aaba066a732fca07`.
The unpatched full-suite control excludes the new coalescing regression,
whose expected failure is separately preserved below. Tool wrappers print
log tails after commands; the test-result lines, not wrapper exit codes,
establish pass/fail. Full-suite failures are not suppressed.

## upstream-revert-test.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/upstream-revert-test.log`.

SHA-256 `4c35a8ac1d8eb0c5cae6ed525d9ce7901cd8444364092eb230b3be8b1fb530bd` PUBLIC-CONSTANT

```text
   Compiling saorsa-gossip-pubsub v0.5.88 (/mnt/c/Users/travi/.codex/worktrees/404d/wt-pq-net-gossip/crates/pubsub)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 9m 39s
     Running unittests src/lib.rs (/home/travi/btmd/pq-net-upstream-test-target/debug/deps/saorsa_gossip_pubsub-e2dccc4a4d32d4de)

running 1 test
test tests::byte_deferred_iwant_retries_once_and_recovers_local_origin_payload ... FAILED

failures:

---- tests::byte_deferred_iwant_retries_once_and_recovers_local_origin_payload stdout ----

thread 'tests::byte_deferred_iwant_retries_once_and_recovers_local_origin_payload' (2165236) panicked at crates/pubsub/src/lib.rs:24933:9:
assertion `left == right` failed: deferred claim must coalesce repeated IHAVE
  left: 48609
 right: 5401
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    tests::byte_deferred_iwant_retries_once_and_recovers_local_origin_payload

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 411 filtered out; finished in 36.70s

error: test failed, to rerun pass `-p saorsa-gossip-pubsub --lib`
```

## upstream-fixed-iwant.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/upstream-fixed-iwant.log`.

SHA-256 `31f54689b8923b8b14ee969bb00f4bc34dcc6acdfb11ff4d71170e9a0968a3f1` PUBLIC-CONSTANT

```text
test tests::byte_deferred_iwant_retries_once_and_recovers_local_origin_payload ... ok

test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 381 filtered out; finished in 5.47s

```

## upstream-fixed-all.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/upstream-fixed-all.log`.

SHA-256 `c6f026c95e263af85b3c92a6a4cdbd37a6f2248513d21878159b703ec3edf3a0` PUBLIC-CONSTANT

```text
test tests::unsolicited_response_keys_never_evict_cached_entries ... ok
test tests::test_single_peer_recovery_probe_timeout_resuppresses_immediately ... ok
test egress::egress_fairness_tests::a_continuously_renewed_intent_still_ages_out ... ok
test compat::tests::migration_cost_and_variant_cache_bounds has been running for over 60 seconds
test compat::tests::migration_cost_and_variant_cache_bounds ... ok
test tests::test_single_peer_bounded_sends_record_cooling_and_skip_suppressed_peer ... ok
test tests::pending_ihave_stays_bounded_on_an_all_eager_topic has been running for over 60 seconds
test tests::pending_ihave_stays_bounded_on_an_all_eager_topic ... ok

failures:

---- tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized stdout ----

thread 'tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized' (2173736) panicked at crates/pubsub/src/lib.rs:26890:9:
assertion `left == right` failed
  left: 573
 right: 1025
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

---- tests::partial_budget_ihave_flush_preserves_each_recipient_exactly_once stdout ----

thread 'tests::partial_budget_ihave_flush_preserves_each_recipient_exactly_once' (2173929) panicked at crates/pubsub/src/lib.rs:19664:9:
assertion `left == right` failed
  left: 2
 right: 1


failures:
    tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized
    tests::partial_budget_ihave_flush_preserves_each_recipient_exactly_once

test result: FAILED. 409 passed; 2 failed; 1 ignored; 0 measured; 0 filtered out; finished in 240.28s

error: test failed, to rerun pass `-p saorsa-gossip-pubsub --lib`
```

## recheck-custody.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/recheck-custody.log`.

SHA-256 `317352fc5c589580af04ced388f79ea38fde111745d26b863e83608005bff7ec` PUBLIC-CONSTANT

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 14.63s
     Running unittests src/lib.rs (/home/travi/btmd/pq-net-upstream-test-target/debug/deps/saorsa_gossip_pubsub-e2dccc4a4d32d4de)

running 1 test
test tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized ... FAILED

failures:

---- tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized stdout ----

thread 'tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized' (2176844) panicked at crates/pubsub/src/lib.rs:26890:9:
assertion `left == right` failed
  left: 577
 right: 1025
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 411 filtered out; finished in 1.47s

error: test failed, to rerun pass `-p saorsa-gossip-pubsub --lib`
```

## recheck-partial.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/recheck-partial.log`.

SHA-256 `d7c440ac2c1d22d19c1b2a3e9dc48c2e49a903bee931a6e775177b8a75b3f22a` PUBLIC-CONSTANT

```text
     Running unittests src/lib.rs (/home/travi/btmd/pq-net-upstream-test-target/debug/deps/saorsa_gossip_pubsub-e2dccc4a4d32d4de)

running 1 test
test tests::partial_budget_ihave_flush_preserves_each_recipient_exactly_once ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 411 filtered out; finished in 0.42s

```

## upstream-base-custody.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/upstream-base-custody.log`.

SHA-256 `8ee2c568399d9af31573df22884ba5e3d898a6d65392740a4d928f2719062e7e` PUBLIC-CONSTANT

```text
     Running unittests src/lib.rs (/home/travi/btmd/pq-net-upstream-test-target/debug/deps/saorsa_gossip_pubsub-e2dccc4a4d32d4de)

running 1 test
test tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 411 filtered out; finished in 0.82s

```

## upstream-base-all.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/upstream-base-all.log`.

SHA-256 `648a3e401b3fd9a8e7b0d8c1f9e21218b0d3ca32f3dbad31f1d702dee2e7328c` PUBLIC-CONSTANT

```text
test tests::test_single_peer_bounded_sends_record_cooling_and_skip_suppressed_peer ... ok
test tests::pending_ihave_stays_bounded_on_an_all_eager_topic has been running for over 60 seconds
test compat::tests::migration_cost_and_variant_cache_bounds ... ok
test tests::pending_ihave_stays_bounded_on_an_all_eager_topic ... ok

failures:

---- tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized stdout ----

thread 'tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized' (2182970) panicked at crates/pubsub/src/lib.rs:26884:9:
assertion `left == right` failed
  left: 342
 right: 1025
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

---- tests::partial_budget_ihave_flush_preserves_each_recipient_exactly_once stdout ----

thread 'tests::partial_budget_ihave_flush_preserves_each_recipient_exactly_once' (2183388) panicked at crates/pubsub/src/lib.rs:19658:9:
assertion `left == right` failed
  left: 2
 right: 1

---- tests::peer_scoring_populated_by_real_handle_eager_path stdout ----

thread 'tests::peer_scoring_populated_by_real_handle_eager_path' (2183395) panicked at crates/pubsub/src/lib.rs:22211:9:
P2 first-delivery (~1.0) recorded from the real handle_eager path (got 0.9863727910980249)


failures:
    tests::deferred_eager_reply_custody_is_bounded_and_cache_authorized
    tests::partial_budget_ihave_flush_preserves_each_recipient_exactly_once
    tests::peer_scoring_populated_by_real_handle_eager_path

test result: FAILED. 407 passed; 3 failed; 1 ignored; 0 measured; 1 filtered out; finished in 379.68s

```

## upstream-clippy.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/upstream-clippy.log`.

SHA-256 `039c5dcc3895c2773d364ed788cb0b48d6dd6a28d1b98bfc8b8316c29a85d399` PUBLIC-CONSTANT

```text
    Checking saorsa-gossip-transport v0.5.88 (/mnt/c/Users/travi/.codex/worktrees/404d/wt-pq-net-gossip/crates/transport)
    Checking saorsa-gossip-membership v0.5.88 (/mnt/c/Users/travi/.codex/worktrees/404d/wt-pq-net-gossip/crates/membership)
    Checking saorsa-gossip-pubsub v0.5.88 (/mnt/c/Users/travi/.codex/worktrees/404d/wt-pq-net-gossip/crates/pubsub)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 11m 36s
```

## v3-revert-test.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/v3-revert-test.log`.

SHA-256 `98f1ad379665d1fecb18e0c33f9180128daae9a76a828aeffd8a72707060610c` PUBLIC-CONSTANT

```text
   Compiling saorsa-gossip-pubsub v0.5.88 (/mnt/c/Users/travi/.codex/worktrees/404d/wt-pq-net-gossip/crates/pubsub)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1m 15s
     Running unittests src/lib.rs (/home/travi/btmd/pq-net-upstream-test-target/debug/deps/saorsa_gossip_pubsub-e2dccc4a4d32d4de)

running 1 test
test tests::key_cache_recovery_intent_coalesces_resigned_control_frames ... FAILED

failures:

---- tests::key_cache_recovery_intent_coalesces_resigned_control_frames stdout ----

thread 'tests::key_cache_recovery_intent_coalesces_resigned_control_frames' (2291666) panicked at crates/pubsub/src/lib.rs:13870:17:
assertion `left == right` failed: re-signing one V3 recovery batch must retain one intent
  left: 8
 right: 1
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    tests::key_cache_recovery_intent_coalesces_resigned_control_frames

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 412 filtered out; finished in 0.49s

error: test failed, to rerun pass `-p saorsa-gossip-pubsub --lib`
```

## v3-fixed-test.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/v3-fixed-test.log`.

SHA-256 `806e7278982fa445f0248ca93b02ee02adc2c9209ffe486d8a39464e3c80fbb4` PUBLIC-CONSTANT

```text
     Running unittests src/lib.rs (/home/travi/btmd/pq-net-upstream-test-target/debug/deps/saorsa_gossip_pubsub-e2dccc4a4d32d4de)

running 2 tests
test tests::key_cache_recovery_intent_preserves_encoding_and_payload_boundaries ... ok
test tests::key_cache_recovery_intent_coalesces_resigned_control_frames ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 412 filtered out; finished in 1.51s

```

## v3-full-tests.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/v3-full-tests.log`.

SHA-256 `47eb864c0ecd089c88f5f8462666e309af13587ecbf7fa557006bf8cfc3b06b9` PUBLIC-CONSTANT

```text
test tests::test_single_peer_recovery_probe_timeout_resuppresses_immediately ... ok
test tests::test_single_peer_bounded_sends_record_cooling_and_skip_suppressed_peer ... ok
test tests::pending_ihave_stays_bounded_on_an_all_eager_topic ... ok

test result: ok. 413 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 56.70s

```

## v3-clippy.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/v3-clippy.log`.

SHA-256 `ac5e13d0988696c5f8101657e6da4772b3915f8f70108ca4335fe798cb49cad1` PUBLIC-CONSTANT

```text
    Checking saorsa-gossip-pubsub v0.5.88 (/mnt/c/Users/travi/.codex/worktrees/404d/wt-pq-net-gossip/crates/pubsub)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 20.11s
```

## v3-clippy-targets.log

Local raw log: `/home/travi/btmd/pq-net-repair-build/v3-clippy-targets.log`.

SHA-256 `d3b429ddd37ac6fd4a25aa1a04a3fd15130f79e215a1b8c13700b2f7b0ea60a3` PUBLIC-CONSTANT

```text
    Checking saorsa-gossip-membership v0.5.88 (/mnt/c/Users/travi/.codex/worktrees/404d/wt-pq-net-gossip/crates/membership)
    Checking saorsa-gossip-pubsub v0.5.88 (/mnt/c/Users/travi/.codex/worktrees/404d/wt-pq-net-gossip/crates/pubsub)
    Checking saorsa-gossip-legacy-compat-fixture v0.5.88 (/mnt/c/Users/travi/.codex/worktrees/404d/wt-pq-net-gossip/test-support/legacy-compat)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1m 20s
```
