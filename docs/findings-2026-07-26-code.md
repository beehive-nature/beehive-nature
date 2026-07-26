# FINDINGS 2026-07-26 — `code` seat, dispatch D-02 … D-05

Verification lane. Every answer below quotes its primary source. Where a
question could not be answered, it is marked UNVERIFIED with the reason —
never inferred.

**Lane note:** three dispatch steps could not be executed as written. Each is
named at its question rather than worked around: D-03 step 4 (device
derivation) needs the physical Safe 7; D-05's four measurements need the
Active key through Keychain, which is founder-held by the dispatch's own
instruction. Where a *read-only primary source of equal or higher tier* could
answer the same question, it was used and labelled as such.

---

## D-02 — Trezor `EXTAPP` capability gate

### Verdict: `LOADABLE-APPS` — **but not by a third party, not on stock firmware, and not for signing.**

The mechanism is real, well-built, and answers none of the questions a Hive or
Zano app would need answered. Detail per question:

**1. Is `EXTAPP_SUPPORT` on in production builds?** **No — it is off by
default and is a build-time argument**, exactly the Nostr `PYOPT == '0'`
precedent (A14). `core/SConscript.firmware`:

```python
EXTAPP_SUPPORT = ARGUMENTS.get('EXTAPP_SUPPORT', '0') == '1'
...
if TREZOR_MODEL in ['T3W1'] and EXTAPP_SUPPORT:
    FEATURES_WANTED += ["app_loading", "ipc"]
```

Default `'0'`. So a stock Safe 7 ships **without** `app_loading` and **without**
`ipc` unless SatoshiLabs flips it in their release build. Closes **B1c**.

**2. The API v1 surface.** Confirms A30 exactly, from
`core/embed/api/trezor_api_v1_impl.c`:

```c
const trezor_api_v1_t trezor_api_v1 = {
    .system_exit, .system_exit_error, .system_exit_error_ex,
    .system_exit_fatal, .system_exit_fatal_ex,
    .systick_ms, .sysevents_poll, .syshandle_read, .dbg_console_write,
    .ipc_register, .ipc_unregister, .ipc_try_receive,
    .ipc_message_free, .ipc_send,
};
```

Fourteen function pointers. No crypto, no keys, no secure element, no display,
no storage, no USB.

**3. What stops a malicious app from requesting a signature?** Three things,
and **none of them is a signature check on the app image**:

- **The API grants nothing dangerous** (above). An extapp cannot sign; it can
  only send an IPC message and hope something answers.
- **Hardware isolation.** `coreapp.c` puts applets behind the MPU and, on
  TrustZone builds, marks their SRAM/flash unprivileged:
  `mpu_set_active_applet(&applet->layout)`, `tz_set_sram_unpriv(...)`,
  `tz_set_flash_unpriv(...)`. Apps are unprivileged tasks with their own
  memory regions and a postmortem record when they die.
- **Only the coreapp can load one.** Images enter through the coreapp's own
  MicroPython module (`trezorapp.create_image` → `.write` → `.finalize` →
  `spawn_task`). First-party firmware decides what is loaded.

**Answering the dispatch's "if you cannot find one, that is itself a major
finding": there is no signature or attestation on the app image.** Searching
`app_cache.c` for `verif|sha256|digest` returns **zero** hits; the 32-byte
`app_hash_t` is used only as an identity for `memcmp` lookup
(`find_entry_by_hash`), and validation at spawn is *structural* — `elf_load`
returns `TS_EINVAL` on a malformed image:

```c
status = elf_load(&entry->applet, image_ptr, image_size);
if (ts_error(status)) { if (!ts_eq(status, TS_ENOMEM)) status = TS_EINVAL; }
```

That is a coherent design *because* the API grants no capability — the security
model is containment, not attestation. Closes **B1b**.

**4. Can a third party build and load an app?** **Not on hardware today.** The
only file-based entry point is emulator-only (A29, confirmed:
`app_cache_load_file` is `#ifdef TREZOR_EMULATOR`). On hardware an image must
be pushed through the coreapp's Python API, and **no in-tree UI, protobuf
message, or host-side command exposes that path**. Closes **B1d**: no
first-party extapp exists in-tree as a worked example — `core/embed/projects/`
contains only `boardloader, bootloader, bootloader_ci, firmware, kernel,
prodtest, secmon, unix`.

**5. B11 — flash headroom.** **UNVERIFIED, and the question is partly
mis-framed.** External app images are **not flashed** — they are allocated in a
RAM arena (`app_arena_alloc(size, APP_ALLOC_IMAGE)`) and cached, so they do not
consume the firmware budget at all. Two hard numbers that *are* verified:
`FIRMWARE_MAXSIZE = 0x342000` (3,416,064 B) from `T3W1/memory.ld`, and —
decisively for any multi-chain plan —

```c
// Maximum number of tracked app loader entries
#define MAX_APP_LOADER_ENTRIES 1
```

**One external app at a time.** Actual free-flash headroom needs a build of the
firmware, which this lane cannot perform (no ARM toolchain here); marked
UNVERIFIED rather than estimated.

**6. B12 — do the dual secure elements constrain an app's curves/ops?**
**UNVERIFIED — and moot for extapps.** API v1 exposes no crypto and no secure
element at all, so an extapp reaches neither TROPIC01 nor the EAL6+ element
regardless of curve. The question only becomes live for a *coreapp fork*, and
answering it there requires reading the SE driver layer — not attempted, not
inferred.

### The question that now sizes everything: B1a

**Does the coreapp expose a signing service over IPC? On `main`, no — no IPC
service of any kind is defined.**

The transport exists and is generic: `ipc_send(systask_id_t remote, uint32_t
fn, const void *data, size_t data_size)`, messages carry an opaque `uint32_t
fn` function code, `IPC_MAX_BUFFER_SIZE (64 * 1024)`. A repo-wide code search
for `ipc_send` returns **only infrastructure** — `sys/ipc/ipc.h`, `ipc.c`,
`syscall_stubs.c`, `syscall_dispatch.c`, `syscall_verifiers.{c,h}`,
`trezor_api_v1{.h,_impl.c}`, `modtrezorio-ipc.h`, `modtrezorio.c`, and
`docs/core/embed-arch/embed-arch.md`. **No handler registry, no service
definition, no `fn` code allocation, no signing endpoint.**

**Consequence, and it is the opposite of the optimistic read:** shipping Hive
or Zano as an extapp would require *defining the IPC service protocol and
implementing the coreapp side of it* — a firmware change, i.e. a fork with
permanent upstream divergence. The extapp mechanism does not shorten that path
today; it is a sandbox for code that needs no secrets, and a wallet app needs
secrets. **`FORK-REQUIRED` is the operative verdict for any chain app**, with
`LOADABLE-APPS` true only in the narrow sense that the loader exists.

---

## D-03 — Zcash shielded reachability

### Verdict: `NOT-PRESENT` — on **both** sides of the wire.

Firmware is already settled by A25–A27 (the signer hardcodes
`nSpendsSapling=0`, `nOutputsSapling=0`, `nActionsOrchard=0`). This lane adds
the host half, which had not been checked:

**Step 1 — PR states** (`gh api repos/trezor/trezor-firmware/pulls/…`):

| PR | state | merged_at | title |
|---|---|---|---|
| #1847 | `closed` | `null` | Zcash shielded transactions |
| #2472 | `open` | `null` | Zcash shielded transactions |

Neither merged. #1847 closed **unmerged**; #2472 still open. Closes **B2a**'s
first half.

**Step 2 — `core/src/apps/zcash/` on `main`** — five files, matching A25–A27:
`__init__.py`, `f4jumble.py`, `hasher.py`, `signer.py`, `unified_addresses.py`.
No Orchard, no Sapling, no note/nullifier/commitment machinery.

**Step 3 — `trezorlib` — the new finding.** `trezorctl` could not be executed
here (WSL has no `pip`, and `python3 -m venv` needs `python3.14-venv` which
requires interactive sudo). **A `trezorctl --help` run was attempted and its
output must be discarded — the binary did not exist, so the "no zcash
subcommand" line it produced was vacuous.** Instead, a *stronger* primary
source: the published package itself, `trezor 0.20.1` wheel from PyPI
(304,646 B, 103 files):

```
zcash-named files : NONE
monero-named files: trezorlib/monero.py, trezorlib/cli/monero.py     (control)
trezorlib/cli/    : benchmark ble btc cardano credentials crypto debug device
                    eos ethereum evolu fido firmware monero nem nostr ripple
                    settings solana stellar telemetry trezorctl tron ui
```

**There is no `trezorlib.zcash` module and no `trezorctl zcash` subcommand —
Zcash is absent from the Python host library entirely**, transparent included.
The Monero control proves the method (Monero *is* present, matching A9), and
note `eos.py` ships in the CLI even though firmware gates EOS to T2T1 —
another instance of host surface and firmware capability being independent.

**Consequence:** the "$130k capability by writing host code only" thesis is
dead twice over. Firmware cannot build a shielded bundle, *and* the Python host
library has no Zcash surface to build on — Suite's Zcash support runs through
`trezor-connect` (TypeScript), a different stack.

**Step 4 — device derivation: NOT ATTEMPTED.** Requires the physical Safe 7 in
hand. No claim is made about on-device behaviour.

**Step 5 — ZF grant final milestone: UNVERIFIED.** `grants.zfnd.org` returned
no fetchable content through this lane's HTTP path (empty body). The dispatch
itself descoped this ("Do not spend a session on it"), and the capability is
absent from `main` regardless.

---

## D-04 — `verify-trezor` crate audit

**What it verifies:** structural validity of a Trezor `AuthenticityProof`, then
classifies it into an `EvidenceClass`. Concretely — a non-empty challenge
(without it a proof is replay-indistinguishable), a non-empty Optiga
certificate chain and signature, no empty certificate inside any chain,
coherence between optional chains and their signatures (certs-without-signature
and signature-without-certs are both refused), and a non-empty `internal_model`.
Any failure is `CapabilityError::UnclassifiableEvidence` — fail-closed, no
fallback tier. 9 tests, all passing.

**What it does *not* verify, and says so:** chain-to-root. `chains_to()`
returns `None` unconditionally.

**Contradictions with VERIFIED-FACTS section A: none.** The crate makes no
claim about which chains a device supports; it is about device authenticity,
not chain capability. A9/A10/A17 are untouched by it. It is orthogonal to
D-02's and D-03's findings — a firmware design built on it inherits no
contradiction.

**Does it hardcode a model?** It defines `MODEL_SAFE_7: &str = "T3W1"` but does
**not** gate on it — the classifier accepts any `internal_model` and has an
explicit test that a T2B1 answering Optiga-only is still structurally valid.
So it applies to the Safe 7 and to older models alike.

**Two findings worth surfacing beyond the question asked:**

1. **It independently corroborates A16's inference.** The crate's docs record
   that `data.trezor.io/firmware/t3w1/authenticity.json` returns **HTTP 404**
   while `t3t1` returns **200** (verified 2026-07-16). That is a measured
   vendor-endpoint fact, and it means **the Safe 7 has no published production
   authenticity root** — so E5 (`IsolatedSigner`) is unreachable for the Safe 7
   *by vendor omission*, not by our code. Any design that assumes a Safe 7 can
   reach the top evidence tier is wrong today.
2. **`t3w1` publishes `authenticity-dev.json`** — emulator debug keys, per
   Trezor's own README. The crate has a dedicated negative test
   (`an_emulator_dev_root_can_never_yield_isolated_signer`) preventing those
   from promoting anything to E5. Enrolling them would let an **emulator**
   claim the tier the quorum protects.

**Overlap with `capability`?** No duplication — `capability` owns the types
(`EvidenceClass`, `FirmwarePolicy`, `EvidenceVerifier`) and `verify-trezor`
implements the Trezor-specific verifier against them. Reported to D-01: not a
census finding.

---

## D-05 — On-chain measurements

**Execution boundary, stated first:** all four items as written require
broadcasting operations signed with Active or Posting authority. The dispatch
forbids automated use of the treasury's Active key and directs manual Keychain
signing, so **B5, B6 and B8's broadcast halves are founder actions and were not
performed.** What follows is what a read-only lane could establish at equal or
higher source tier — plus, for B5, a result that answers the underlying
decision without spending anything.

### B5 — `claim_account` cost. **The estimate is not off by 8–370×. It is off by ~950×, and the answer is that sponsored onboarding is not viable at this stake.**

`rc_api.get_rc_stats` reports the **actual average RC consumed by real
operations** in the recent window — a population measurement from live chain
state, not an estimate. At block **108,432,000**:

| operation | count observed | avg RC cost |
|---|---|---|
| `claim_account_operation` | 1,548 | **10,612,635,408,352** |
| `transfer_to_vesting_operation` | 240 | **120,419,799** |
| `custom_json_operation` | 266,378 | 168,228,785 |
| `vote_operation` | 179,046 | 99,389,613 |

**Units cross-checked against our own prior measurement:** the genesis
`bnr.anchor` (620 B `custom_json`) measured 368,692,399 RC on 2026-07-24; the
chain-wide `custom_json` average here is 168,228,785 — a 620-byte payload
costing ~2.2× the average `custom_json` (most are small votes/follows) is
coherent. The figures are RC per operation.

**The account, read live the same day** (`rc_api.find_rc_accounts` +
`database_api.find_accounts`, account `loviswater`):

```
max_rc                      = 624,977,561,774
current_mana                = 624,199,293,494
max_rc_creation_adjustment  =   5,622,320,093
vesting_shares              = 619,355.241681 VESTS
delegated / received RC     = 0 / 0
```

Independently confirms the dispatch's "383 HP": 619,355.241681 ÷ 1,617.24
VESTS-per-HP = **382.9 HP**.

**The arithmetic, shown:**

```
one claim_account        = 10,612,635,408,352 RC
entire max_rc (383 HP)   =      624,977,561,774 RC
ratio                    = 16.98×
```

**One `claim_account` costs ~17× the account's entire maximum mana bar.** ACT
capacity at 383 HP is **zero** — not 56, not "a few per day". A full bar
cannot buy one claim. Stake required to afford **one** ACT per full bar:

```
needed max_rc  = 10,612,635,408,352
 less creation adjustment (5,622,320,093)
              = 10,607,013,088,259 stake-RC
 ÷ 1e6 RC/VEST = 10,607,013 VESTS
 ÷ 1,617.24    ≈ 6,558 HP
```

**≈6,560 HP to afford a single account claim on a full bar**, versus 383 held —
a ~17× stake increase, before any cadence. The old ~56 figure implied a cost
near 11.2 B RC; the observed cost is ~950× that.

**Labelling, precisely:** this is a *chain-observed population average across
1,548 real operations*, not this account's exact charge at broadcast time — RC
prices move with pool state, and `claim_account` in particular is priced off
the account-creation resource pool. The founder's single manual claim would
pin the exact figure. **But the decision it gates does not need that
precision:** at 17× the whole bar, no plausible pricing swing makes sponsored
onboarding viable at 383 HP.

### B6 — `transfer_to_vesting` cost: **120,419,799 RC** (240 observed ops, same block). Cheap — ~0.019% of the account's max_rc. Hopper RC delegation is a non-issue at this scale. Same population-average caveat.

### B7 — does `delegate_rc` with `max_rc: 0` revoke? **YES — answered from tier-1 source, which outranks the measurement.**

`tests/unit/tests/direct_rc_delegation.cpp` in the canonical Hive repo:

```cpp
// Delete the delegation
op.from = "alice"; op.delegatees = {"bob"}; op.max_rc = 0;
push_transaction(custom_op, alice_post_key);
generate_block();
const rc_direct_delegation_object* delegation_deleted =
    db->find< rc_direct_delegation_object, by_from_to >( boost::make_tuple( alice_id, bob_id ) );
BOOST_REQUIRE( delegation_deleted == nullptr );
BOOST_REQUIRE_EQUAL( from_rc_account_deleted.get_delegated_rc(), 0 );
BOOST_REQUIRE_EQUAL( to_rc_account_deleted.get_received_rc(), 0 );
```

**Operational bonus the question did not ask, and the hopper daemon needs:**
delegating 0 where **no delegation exists throws** —
`BOOST_CHECK_THROW( push_transaction(custom_op, alice_post_key), fc::exception )`,
commented *"Delegating 0 shouldn't work if there isn't already a delegation that
exists (since 0 deletes the delegation)"*. A blind revoke is a failed
transaction, not a no-op. Any revoke path must check for an existing delegation
first.

### B8 — which account's `max_mana` increases on cross-account power-up? **`to` — derived, with a live identity check; the broadcast confirmation remains founder-held.**

Read-only test of the hypothesis `max_rc = own vesting_shares + creation
adjustment` across six live accounts:

| account | own VESTS (µ) | RC deleg in/out | max_rc | identity |
|---|---|---|---|---|
| `loviswater` | 619,355,241,681 | 0 / 0 | 624,977,561,774 | **exact match** |
| `hiveio` | 314,566,314,850 | 0 / 0 | 320,445,617,591 | **exact match** |
| `blocktrades`, `gtg`, `good-karma`, `theycallmedan` | — | non-zero | — | deviates, as expected |

For both accounts carrying **no** delegations the identity holds to the unit;
every deviating account has delegations in or out, which is precisely what RC
delegation does to `max_rc`. So `max_rc` is a function of the **holder's own**
`vesting_shares`. Combined with A2 (proven: `transfer_to_vesting.to` receives
the VESTS) the conclusion is that **`to`'s `max_rc` rises and `from`'s does
not** — `from` spends HIVE, not VESTS.

**This is a derivation from two proven facts plus a 2/2 exact identity match,
not a measurement of a cross-account power-up.** It is strong enough to design
against and should still be confirmed by the founder's B6 broadcast, which
produces the B8 answer for free if `max_rc` is read on both accounts before and
after.

---

## Register updates proposed for `VERIFIED-FACTS.md`

New section-A rows (A32–A40) and closures. `VERIFIED-FACTS.md` is not in this
repo — it lives in the Claude session outputs directory — so these are proposed
for whichever seat maintains it rather than written by this lane.

| # | claim | primary source |
|---|---|---|
| A32 | `EXTAPP_SUPPORT` defaults to `'0'`; `app_loading`+`ipc` require both `T3W1` and the flag | `core/SConscript.firmware` |
| A33 | No signature/attestation on external app images; validation is ELF-structural (`TS_EINVAL`), `app_hash_t` is an identity for lookup | `app_task.c`, `app_cache.c` (zero `verif/sha256/digest` hits) |
| A34 | `MAX_APP_LOADER_ENTRIES 1` — one external app at a time; images live in a RAM arena, not flash | `app_task.c`, `app_arena.h` |
| A35 | The coreapp defines **no** IPC service — the transport exists, no handler/service/`fn` allocation anywhere in-tree | repo-wide `ipc_send` search: infrastructure files only |
| A36 | Apps are MPU/TrustZone-isolated unprivileged tasks | `sys/task/stm32/coreapp.c` |
| A37 | PR #1847 `closed` unmerged; #2472 `open` unmerged | GitHub API |
| A38 | `trezorlib` 0.20.1 ships **no** Zcash module and no `trezorctl zcash` — Monero and EOS both present as controls | PyPI wheel contents |
| A39 | `claim_account` observed avg **10,612,635,408,352 RC** (1,548 ops, block 108,432,000); `transfer_to_vesting` **120,419,799 RC** (240 ops) | `rc_api.get_rc_stats` |
| A40 | `delegate_rc max_rc = 0` deletes the delegation; delegating 0 with **no** existing delegation **throws** | `tests/unit/tests/direct_rc_delegation.cpp` |

Closures: **B1b, B1c, B1d** → A33/A32/§D-02(4). **B1a** → A35 (answered: no
service exists; the fork question is settled toward FORK-REQUIRED).
**B2a** → A37 (PR half; ZF milestone still open). **B5/B6** → A39 with the
population-average caveat. **B7** → A40. **B8** → derived, awaiting broadcast.
**B11/B12** → remain UNVERIFIED, reasons stated above. **B14** → §D-04, no
contradictions found. **B15** → `docs/TREE-CENSUS.md`; note the register's own
"35 crates" is off by one — the tree has **34**.

---

## Addendum 2026-07-26 — B16 and B17 (ONBOARDING-OPTIONS promotion tests)

### B16 — `account_creation_fee`, live config. **CONFIRMED: 3.000 HIVE.**

The promotion curl from ONBOARDING-OPTIONS.md, run from this chain-connected
seat, `api.hive.blog`:

```json
{"jsonrpc":"2.0","result":{"account_creation_fee":"3.000 HIVE",
 "maximum_block_size":65536,"hbd_interest_rate":1000,
 "account_subsidy_budget":797,"account_subsidy_decay":347321},"id":1}
```

Matches the developer-portal figure exactly. (A second node, `anyx.io`,
answered 502 during the window — single-node read, primary + portal
corroboration. It is a witness-voted median; re-read before committing budget.)

### B17 — where the 3 HIVE goes. **BURNED — and the burn buys the new account a permanent RC floor.**

Tier-1 source, `libraries/chain/hive_evaluator_account.cpp` (master),
`account_create_evaluator::do_apply`:

```cpp
_db.adjust_balance( creator, -o_fee );                       // creator pays
...
if( _db.has_hardfork( HIVE_HARDFORK_0_20__1762 ) )
  _db.adjust_balance( _db.get< account_object, by_name >( HIVE_NULL_ACCOUNT ), o_fee );  // → @null
else if( o_fee.amount > 0 )
  initial_vesting_shares = _db.create_vesting( new_account, o_fee );   // pre-HF20 path, dead on mainnet
```

Post-HF20 (2018) the fee is transferred to `@null` — **a burn, so Option 1's
"budget as if burned" assumption is correct**. Two riders from the same
function:

1. **The burn is not economically lost to the new account.** `create_account`
   converts the fee at the vesting share price into
   `rc_adjustment_from_fee`, stored as the account's
   **`max_rc_creation_adjustment`**:

   ```cpp
   if( db.has_hardfork( HIVE_HARDFORK_0_20 ) )
     rc_adjustment_from_fee = ( fee_for_rc_adjustment * dgpo.get_vesting_share_price() ).amount.value;
   ```

   This is precisely the `max_rc_creation_adjustment = 5,622,320,093` observed
   live on `loviswater` — the fee-derived RC grant from that account's own
   creation. A fee-created account therefore arrives with a built-in RC
   baseline, which reduces (not eliminates) Option 1's need for an immediate
   `delegate_rc` top-up.

2. **The fee must be exact, not minimum**, post-HF20__1771:
   `"Must pay the exact account creation fee"` — an over- or under-paying
   `account_create` fails. The hopper must read the live median before each
   creation, not hardcode 3 HIVE.
