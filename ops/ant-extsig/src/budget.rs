//! The plan-wide gas ledger.
//!
//! The gas ceiling is an aggregate over the whole upload and over every
//! attempt at it, not a per-transaction bound
//! (`tools/genealogy/bpay.mjs::reconcile` compares the receipt's total
//! `gasUsedWei` against `maxGasETH`; the retry failure mode is on record in
//! `docs/dispatches/2026-09-12-z2b-negative-review.md:37-52`).
//!
//! Rules this module holds:
//! - Before every signature the transaction's worst case
//!   (`gas_limit × fee_cap`) is reserved against what remains. If it does not
//!   fit, nothing is signed.
//! - The reservation is written to disk before the signature, so a crash or a
//!   rerun still sees it.
//! - One reservation covers every transaction evmlib may send for one call:
//!   `SEND_ATTEMPTS` worst cases, because evmlib retries inside the call.
//! - A reservation is only ever lowered to the larger of two chain readings:
//!   the payer's ETH balance change across the call (with no transaction
//!   still pending) and the receipt cost. A failed, dropped or unknown-outcome
//!   send keeps its full
//!   reservation. Exposure is never freed because a call returned an error.
//! - The ledger file for a plan is at a path derived from the plan, so a rerun
//!   finds it without being told. A ledger file is local state: deleting it,
//!   or naming a different one with `ANT_EXTSIG_LEDGER`, discards the history.
//!   There is no lock: two runs of one plan at the same time lose each other's
//!   entries. Run one at a time.
//! - The fee cap for a send is derived from what remains, so a large
//!   transaction passes when the chain is cheap and refuses when it is not.

use std::path::{Path, PathBuf};

type Res<T> = Result<T, Box<dyn std::error::Error>>;

/// How many transactions one evmlib send call can put on chain. evmlib retries
/// a failed send or confirmation up to `MAX_RETRIES = 3` times
/// (`evmlib` v0.10.0 `retry.rs:9`, loop at `:107-170`), and a retry after a
/// broadcast timeout goes out with a fresh nonce (`:234-238`), so an earlier
/// attempt can still be mined beside it. Every reservation covers all four.
pub const SEND_ATTEMPTS: u128 = 4;

/// The ledger file for a plan when `ANT_EXTSIG_LEDGER` does not name one.
/// The same plan always maps to the same file, so every attempt at a plan
/// meets the earlier attempts. `state_dir` is `ANT_EXTSIG_STATE_DIR`, or the
/// user's local application data directory; with neither, the caller refuses.
pub fn default_ledger_path(state_dir: &Path, plan_id: &str) -> PathBuf {
    use sha2::{Digest, Sha256};
    let digest = hex::encode(Sha256::digest(plan_id.as_bytes()));
    state_dir.join("ant-extsig").join("ledgers").join(format!("gas-ledger-{}.json", &digest[..16]))
}

/// evmlib sets the gas limit to the estimate plus 20 percent
/// (`evmlib` v0.10.0 `retry.rs:219`). The ledger reserves against that.
pub fn gas_limit_with_buffer(estimated_gas: u64) -> u128 {
    (estimated_gas as u128).saturating_mul(120) / 100
}

/// Why `fee_cap` refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeeCapRefusal {
    ZeroGasLimit,
    /// Even the current network fee does not fit; `need_wei` is
    /// `gas_limit × network fee`, saturating.
    Unaffordable { need_wei: u128 },
}

/// The arithmetic of `plan_fee_cap`, without its refusal message.
///
/// Separate so that bTunGsTeN RB03 (`scripts/btungsten/rb03-budget`) can
/// check it symbolically for every input: formatting a symbolic `u128` into
/// the message produces solver goals that do not close.
pub fn fee_cap(
    remaining_wei: u128,
    gas_limit: u128,
    network_fee_per_gas: u128,
    headroom_num: u128,
    headroom_den: u128,
) -> Result<u128, FeeCapRefusal> {
    if gas_limit == 0 {
        return Err(FeeCapRefusal::ZeroGasLimit);
    }
    let budget_cap = remaining_wei / gas_limit;
    if budget_cap < network_fee_per_gas {
        return Err(FeeCapRefusal::Unaffordable { need_wei: gas_limit.saturating_mul(network_fee_per_gas) });
    }
    let with_headroom = network_fee_per_gas.saturating_mul(headroom_num) / headroom_den.max(1);
    Ok(with_headroom.min(budget_cap).max(network_fee_per_gas))
}

/// Choose the per-gas fee cap for one send.
///
/// The cap is the network's current estimate times `headroom_num/headroom_den`
/// (room for the fee to move between check and send), but never more than the
/// remaining budget allows for this gas limit. If even the current network
/// fee does not fit, the send is refused.
pub fn plan_fee_cap(
    remaining_wei: u128,
    gas_limit: u128,
    network_fee_per_gas: u128,
    headroom_num: u128,
    headroom_den: u128,
    stage: &str,
) -> Res<u128> {
    match fee_cap(remaining_wei, gas_limit, network_fee_per_gas, headroom_num, headroom_den) {
        Ok(cap) => Ok(cap),
        Err(FeeCapRefusal::ZeroGasLimit) => Err(format!("REFUSE: zero gas limit for {stage}").into()),
        Err(FeeCapRefusal::Unaffordable { need_wei: need }) => Err(format!(
            "REFUSE: gas budget cannot cover {stage}: gas_limit {gas_limit} × network fee {network_fee_per_gas} wei = {need} wei exceeds remaining budget {remaining_wei} wei by {} wei",
            need.saturating_sub(remaining_wei)
        )
        .into()),
    }
}

/// A lower bound for the gas limit of a payment that has not been approved yet.
///
/// The payment cannot be simulated before the approval is mined, because the
/// vault pulls tokens. Each transfer the payment makes costs on the order of
/// one approval, so half an approval per transfer is used as a floor. This is
/// a heuristic that only refuses early: it stops an approval from being
/// signed when the payment clearly cannot fit afterwards. The real check is
/// the simulated payment against the ledger, after the approval.
pub fn payment_floor_limit(approval_gas_limit: u128, transfers: u128) -> u128 {
    transfers.saturating_mul(approval_gas_limit) / 2
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub stage: String,
    pub reserved_wei: u128,
    /// Set only from the payer's on-chain balance change for this call.
    pub settled_wei: Option<u128>,
}

impl Entry {
    /// What this entry counts for against the ceiling.
    pub fn exposure_wei(&self) -> u128 {
        self.settled_wei.unwrap_or(self.reserved_wei)
    }
}

#[derive(Debug)]
pub struct GasLedger {
    path: PathBuf,
    plan_id: String,
    ceiling_wei: u128,
    entries: Vec<Entry>,
}

impl GasLedger {
    /// Open the ledger for a plan. An existing file for the same plan is
    /// continued, so earlier attempts still count. A file for a different
    /// plan, or one that cannot be parsed, is a refusal: the ledger is never
    /// silently reset.
    pub fn open(path: &Path, plan_id: &str, ceiling_wei: u128) -> Res<GasLedger> {
        let mut ledger = GasLedger {
            path: path.to_path_buf(),
            plan_id: plan_id.to_string(),
            ceiling_wei,
            entries: Vec::new(),
        };
        if path.exists() {
            let content = std::fs::read_to_string(path)
                .map_err(|e| format!("REFUSE: cannot read gas ledger {}: {e}", path.display()))?;
            let v: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("REFUSE: gas ledger {} is not valid JSON: {e}", path.display()))?;
            let file_plan = v["plan_id"].as_str().unwrap_or_default();
            if file_plan != plan_id {
                return Err(format!(
                    "REFUSE: gas ledger {} belongs to plan '{file_plan}', not '{plan_id}'",
                    path.display()
                )
                .into());
            }
            let bad = || format!("REFUSE: gas ledger {} has a malformed entry", path.display());
            for e in v["entries"].as_array().ok_or_else(bad)? {
                let reserved_wei = e["reserved_wei"].as_str().and_then(|s| s.parse().ok()).ok_or_else(bad)?;
                let settled_wei = match &e["settled_wei"] {
                    serde_json::Value::Null => None,
                    serde_json::Value::String(s) => Some(s.parse().map_err(|_| bad())?),
                    _ => return Err(bad().into()),
                };
                ledger.entries.push(Entry {
                    stage: e["stage"].as_str().ok_or_else(bad)?.to_string(),
                    reserved_wei,
                    settled_wei,
                });
            }
        }
        Ok(ledger)
    }

    pub fn ceiling_wei(&self) -> u128 {
        self.ceiling_wei
    }

    pub fn entries(&self) -> &[Entry] {
        &self.entries
    }

    /// Total counted against the ceiling: settled amounts where a receipt was
    /// validated, full reservations everywhere else.
    pub fn exposure_wei(&self) -> u128 {
        self.entries.iter().fold(0u128, |a, e| a.saturating_add(e.exposure_wei()))
    }

    pub fn remaining_wei(&self) -> u128 {
        self.ceiling_wei.saturating_sub(self.exposure_wei())
    }

    /// Check that a set of planned transactions fits in what remains, without
    /// reserving anything. Used before the first payment signature so a
    /// multi-batch payment is never started that cannot finish.
    pub fn check_projection(&self, planned_worst_case_wei: u128, what: &str) -> Res<()> {
        let remaining = self.remaining_wei();
        if planned_worst_case_wei > remaining {
            return Err(format!(
                "REFUSE: planned gas for {what} is {planned_worst_case_wei} wei, which exceeds the remaining budget {remaining} wei by {} wei (ceiling {} wei, already exposed {} wei)",
                planned_worst_case_wei - remaining,
                self.ceiling_wei,
                self.exposure_wei()
            )
            .into());
        }
        Ok(())
    }

    /// Reserve one transaction's worst case and persist the ledger before
    /// returning. Call this immediately before the signature. Returns the
    /// entry index for `settle`.
    pub fn reserve(&mut self, stage: &str, gas_limit: u128, fee_cap_per_gas: u128) -> Res<usize> {
        let worst = gas_limit.saturating_mul(fee_cap_per_gas);
        let remaining = self.remaining_wei();
        if worst > remaining {
            return Err(format!(
                "REFUSE: gas ceiling: {stage} worst case {gas_limit} × {fee_cap_per_gas} wei = {worst} wei exceeds the remaining budget {remaining} wei by {} wei (ceiling {} wei, already exposed {} wei)",
                worst - remaining,
                self.ceiling_wei,
                self.exposure_wei()
            )
            .into());
        }
        self.entries.push(Entry { stage: stage.to_string(), reserved_wei: worst, settled_wei: None });
        self.persist()?;
        Ok(self.entries.len() - 1)
    }

    /// Record what the chain reports the payer spent on this call. This is
    /// the only way a reservation shrinks. A cost above the reservation is
    /// recorded as it is, so a breach is visible rather than hidden.
    pub fn settle(&mut self, index: usize, actual_wei: u128) -> Res<()> {
        let entry = self
            .entries
            .get_mut(index)
            .ok_or_else(|| format!("gas ledger has no entry {index}"))?;
        entry.settled_wei = Some(actual_wei);
        self.persist()
    }

    fn persist(&self) -> Res<()> {
        let entries: Vec<serde_json::Value> = self
            .entries
            .iter()
            .map(|e| {
                serde_json::json!({
                    "stage": e.stage,
                    "reserved_wei": e.reserved_wei.to_string(),
                    "settled_wei": e.settled_wei.map(|s| s.to_string()),
                })
            })
            .collect();
        let body = serde_json::to_string_pretty(&serde_json::json!({
            "schema": "ant-extsig.gas-ledger/1",
            "plan_id": self.plan_id,
            "ceiling_wei": self.ceiling_wei.to_string(),
            "exposure_wei": self.exposure_wei().to_string(),
            "entries": entries,
        }))?;
        use std::io::Write;
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir)
                .map_err(|e| format!("REFUSE: cannot create gas ledger directory {}: {e}", dir.display()))?;
        }
        let tmp = self.path.with_extension("tmp");
        // Flushed to the device before the rename, so the reservation is on
        // disk before the signature that follows it.
        std::fs::File::create(&tmp)
            .and_then(|mut f| f.write_all(body.as_bytes()).and_then(|()| f.sync_all()))
            .map_err(|e| format!("REFUSE: cannot write gas ledger {}: {e}", tmp.display()))?;
        std::fs::rename(&tmp, &self.path)
            .map_err(|e| format!("REFUSE: cannot commit gas ledger {}: {e}", self.path.display()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CEILING: u128 = 200_000_000_000_000; // 0.0002 ETH in wei

    fn temp_ledger(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("ant-extsig-ledger-test-{name}-{}.json", std::process::id()));
        let _ = std::fs::remove_file(&p);
        p
    }

    #[test]
    fn buffer_matches_evmlib() {
        assert_eq!(gas_limit_with_buffer(188_511), 226_213);
        assert_eq!(gas_limit_with_buffer(46_394), 55_672);
    }

    #[test]
    fn fee_cap_gives_headroom_but_never_more_than_the_budget() {
        // Cheap chain, small tx: 2× headroom applies.
        assert_eq!(plan_fee_cap(CEILING, 226_213, 157_379_521, 2, 1, "t").unwrap(), 314_759_042);
        // Large tx on a cheap chain passes: 1.8M gas at 0.02 gwei.
        let cap = plan_fee_cap(CEILING, 1_800_000, 20_000_000, 2, 1, "t").unwrap();
        assert_eq!(cap, 40_000_000);
        assert!(1_800_000 * cap <= CEILING);
        // Headroom is clipped to what the budget allows.
        let cap = plan_fee_cap(CEILING, 1_800_000, 100_000_000, 2, 1, "t").unwrap();
        assert_eq!(cap, CEILING / 1_800_000);
        assert!(1_800_000 * cap <= CEILING);
        // The same large tx on an expensive chain refuses with the overage.
        let err = plan_fee_cap(CEILING, 1_800_000, 1_000_000_000, 2, 1, "wave").unwrap_err().to_string();
        assert!(err.starts_with("REFUSE: gas budget cannot cover wave"), "{err}");
        assert!(err.contains("by 1600000000000000 wei"), "{err}");
        assert!(plan_fee_cap(CEILING, 0, 1, 2, 1, "t").is_err());
    }

    #[test]
    fn plan_fee_cap_is_fee_cap_with_a_message() {
        // RB03 checks fee_cap symbolically; this holds plan_fee_cap to it.
        let m = u128::MAX;
        let vals = [0, 1, 2, 3, 7, 10, 99, 100, 101, 1_000, 226_213, 157_379_521, m / 2, m / 2 + 1, m - 1, m];
        for &r in &vals {
            for &g in &vals {
                for &f in &vals {
                    for (n, d) in [(2, 1), (0, 1), (3, 0), (1, m), (m, 1)] {
                        let plan = plan_fee_cap(r, g, f, n, d, "s");
                        match fee_cap(r, g, f, n, d) {
                            Ok(cap) => assert_eq!(plan.unwrap(), cap),
                            Err(FeeCapRefusal::ZeroGasLimit) => {
                                assert_eq!(plan.unwrap_err().to_string(), "REFUSE: zero gas limit for s")
                            }
                            Err(FeeCapRefusal::Unaffordable { need_wei }) => assert_eq!(
                                plan.unwrap_err().to_string(),
                                format!(
                                    "REFUSE: gas budget cannot cover s: gas_limit {g} × network fee {f} wei = {need_wei} wei exceeds remaining budget {r} wei by {} wei",
                                    need_wei.saturating_sub(r)
                                )
                            ),
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn payment_floor_stops_a_doomed_approval_but_not_a_cheap_one() {
        // Measured on devnet: approval limit 55,672; a 4-transfer payment 226,213.
        let floor = payment_floor_limit(55_672, 4);
        assert_eq!(floor, 111_344);
        assert!(floor < 226_213, "the floor must stay below the measured payment");
        let path = temp_ledger("floor");
        let l = GasLedger::open(&path, "plan-g", CEILING).unwrap();
        // 0.178 gwei: approval plus floor fits.
        assert!(l.check_projection((55_672 + floor) * 178_247_123, "floor").is_ok());
        // 1.78 gwei: it cannot, so the approval is never signed.
        assert!(l.check_projection((55_672 + floor) * 1_782_471_219, "floor").is_err());
    }

    #[test]
    fn reservations_accumulate_and_only_receipts_lower_them() {
        let path = temp_ledger("accumulate");
        let mut l = GasLedger::open(&path, "plan-a", CEILING).unwrap();
        let a = l.reserve("approval", 55_672, 314_759_042).unwrap();
        assert_eq!(l.exposure_wei(), 55_672 * 314_759_042);
        // A validated receipt lowers the approval to what it actually cost.
        l.settle(a, 3_650_732_771_834).unwrap();
        assert_eq!(l.exposure_wei(), 3_650_732_771_834);
        // The payment reserves against what remains.
        let remaining = l.remaining_wei();
        assert_eq!(remaining, CEILING - 3_650_732_771_834);
        l.reserve("payment", 226_213, 314_759_042).unwrap();
        // That send's outcome is unknown: its full reservation stays.
        assert_eq!(l.exposure_wei(), 3_650_732_771_834 + 226_213 * 314_759_042);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn retries_cannot_exceed_the_ceiling() {
        // The z2b probe: repeated failed attempts must not each get a fresh budget.
        let path = temp_ledger("retries");
        let mut l = GasLedger::open(&path, "plan-b", CEILING).unwrap();
        let mut accepted = 0;
        for i in 0..10 {
            // Each attempt: 226,213 gas at a 0.3 gwei cap, about 0.000068 ETH.
            if l.reserve(&format!("attempt-{i}"), 226_213, 300_000_000).is_ok() {
                accepted += 1; // outcome unknown: never settled, never freed
            }
        }
        assert_eq!(accepted, 2, "only two unknown-outcome attempts fit under 0.0002 ETH");
        assert!(l.exposure_wei() <= CEILING);
        let err = l.reserve("one-more", 226_213, 300_000_000).unwrap_err().to_string();
        assert!(err.starts_with("REFUSE: gas ceiling"), "{err}");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn the_ledger_survives_a_rerun() {
        let path = temp_ledger("rerun");
        {
            let mut l = GasLedger::open(&path, "plan-c", CEILING).unwrap();
            l.reserve("attempt-0", 226_213, 300_000_000).unwrap();
            l.reserve("attempt-1", 226_213, 300_000_000).unwrap();
        }
        // A new process opens the same plan and sees the earlier exposure.
        let mut l = GasLedger::open(&path, "plan-c", CEILING).unwrap();
        assert_eq!(l.entries().len(), 2);
        assert_eq!(l.exposure_wei(), 2 * 226_213 * 300_000_000);
        assert!(l.reserve("attempt-2", 226_213, 300_000_000).is_err());
        // A different plan must not reuse or reset this file.
        let err = GasLedger::open(&path, "plan-d", CEILING).unwrap_err().to_string();
        assert!(err.contains("belongs to plan 'plan-c'"), "{err}");
        // A corrupt ledger refuses rather than starting from zero.
        std::fs::write(&path, "{ not json").unwrap();
        assert!(GasLedger::open(&path, "plan-c", CEILING).is_err());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn the_default_ledger_path_is_the_same_for_every_run_of_a_plan() {
        let dir = Path::new("state");
        let a = default_ledger_path(dir, "devnet:0xabc:plan-1");
        assert_eq!(a, default_ledger_path(dir, "devnet:0xabc:plan-1"));
        assert_ne!(a, default_ledger_path(dir, "devnet:0xabc:plan-2"));
        assert!(a.starts_with("state"));
        // Nothing about the process or the clock is in the name.
        assert!(!a.to_string_lossy().contains(&std::process::id().to_string()) || std::process::id() < 10);
    }

    #[test]
    fn one_reservation_covers_every_attempt_evmlib_can_send() {
        let path = temp_ledger("attempts");
        let mut l = GasLedger::open(&path, "plan-h", CEILING).unwrap();
        // The cap is planned against all four attempts, and the reservation holds them.
        let cap = plan_fee_cap(l.remaining_wei(), 226_213 * SEND_ATTEMPTS, 157_379_521, 2, 1, "t").unwrap();
        assert!(cap >= 157_379_521);
        l.reserve("payment", 226_213 * SEND_ATTEMPTS, cap).unwrap();
        assert_eq!(l.exposure_wei(), 4 * 226_213 * cap);
        assert!(l.exposure_wei() <= CEILING);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn projection_refuses_before_anything_is_reserved() {
        let path = temp_ledger("projection");
        let mut l = GasLedger::open(&path, "plan-e", CEILING).unwrap();
        l.reserve("approval", 55_672, 314_759_042).unwrap();
        let before = l.exposure_wei();
        let err = l.check_projection(CEILING, "3 payment batches").unwrap_err().to_string();
        assert!(err.starts_with("REFUSE: planned gas for 3 payment batches"), "{err}");
        assert_eq!(l.exposure_wei(), before, "a projection reserves nothing");
        assert!(l.check_projection(l.remaining_wei(), "exact fit").is_ok());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn an_over_budget_receipt_is_recorded_not_hidden() {
        let path = temp_ledger("breach");
        let mut l = GasLedger::open(&path, "plan-f", CEILING).unwrap();
        let i = l.reserve("payment", 226_213, 300_000_000).unwrap();
        l.settle(i, CEILING + 1).unwrap();
        assert_eq!(l.exposure_wei(), CEILING + 1);
        assert_eq!(l.remaining_wei(), 0);
        assert!(l.reserve("next", 21_000, 1).is_err());
        let _ = std::fs::remove_file(&path);
    }
}
