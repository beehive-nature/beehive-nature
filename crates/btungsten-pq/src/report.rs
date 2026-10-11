//! The KAT tally: executed and passed per (vector group, implementation),
//! every failure by tcId, and every group not run with its reason.

use std::collections::BTreeMap;

#[derive(Default)]
pub struct Report {
    rows: BTreeMap<(String, &'static str), (usize, usize)>,
    failures: Vec<String>,
    not_run: BTreeMap<String, String>,
}

impl Report {
    /// One case of `key` (e.g. `ML-KEM-768 keyGen`) on implementation `imp`.
    pub fn record(&mut self, key: &str, imp: &'static str, tc: u64, ok: bool) {
        let r = self.rows.entry((key.to_string(), imp)).or_default();
        r.0 += 1;
        if ok {
            r.1 += 1;
        } else {
            self.failures.push(format!("{key} [{imp}] tcId {tc}"));
        }
    }

    /// A group this runner does not execute, and why. Never counted as passed.
    pub fn not_run(&mut self, key: &str, why: &str) {
        self.not_run.insert(key.to_string(), why.to_string());
    }

    pub fn executed(&self, key: &str, imp: &'static str) -> usize {
        self.rows.get(&(key.to_string(), imp)).map_or(0, |r| r.0)
    }

    pub fn failures(&self) -> &[String] {
        &self.failures
    }

    pub fn totals(&self) -> (usize, usize) {
        self.rows
            .values()
            .fold((0, 0), |(e, p), r| (e + r.0, p + r.1))
    }

    pub fn print(&self) {
        self.print_as("PQ01");
    }

    /// The tally, each line tagged with the lane that ran it.
    pub fn print_as(&self, lane: &str) {
        for ((key, imp), (e, p)) in &self.rows {
            println!("{lane} {key} [{imp}]: executed {e} of {e}, passed {p}");
        }
        for (key, why) in &self.not_run {
            println!("{lane} NOT RUN {key}: {why}");
        }
        for f in &self.failures {
            println!("{lane} FAIL {f}");
        }
    }
}
