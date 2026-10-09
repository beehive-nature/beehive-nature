//! The RB receipt: one JSON document per lane run.
//!
//! A receipt names the job, the source and toolchain identities, the host,
//! the workload, the assumptions, every result row with the class of claim it
//! makes, the raw measurements, the evidence files (by digest), and a verdict
//! computed from the rows alone.
//!
//! Result classes (SPEC-BTUNGSTEN-1 §result-classes, extended for the RB
//! lanes; no class is ever recorded as another):
//!
//! - `VECTOR`               a concrete input with a known answer
//! - `SAMPLED-ADVERSARIAL`  an operational fault or hostile input, sampled;
//!                          never a proof of malicious security
//! - `BOUNDED-SYMBOLIC`     symbolic exploration under a stated bound
//! - `PROVE-UNIVERSAL`      a property proven for every input of a stated
//!                          domain
//! - `EQUIVALENCE`          implementation equal to a specification over a
//!                          stated domain
//! - `TEETH`                a deliberately false claim the verifier must
//!                          reject; PASS means it was rejected
//! - `MEASUREMENT`          an operational measurement; PASS means it was
//!                          taken and its run produced the expected result
//! - `CHARACTERIZATION`     upstream behaviour outside the bench's input
//!                          policy, recorded as observed
//!
//! Outcomes: `PASS`, `FAIL`, `INCONCLUSIVE` (a timeout, an incomplete
//! exploration or verifier output this harness does not recognize),
//! `UNSUPPORTED` (the tool cannot express or execute it), `NOT-RUN`.

use std::path::{Path, PathBuf};
use std::time::Instant;

use serde_json::{json, Map, Value};

use crate::digest::file_tag;

pub const SCHEMA: &str = "btungsten.rb-receipt/1";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Class {
    Vector,
    SampledAdversarial,
    BoundedSymbolic,
    ProveUniversal,
    Equivalence,
    Teeth,
    Measurement,
    Characterization,
}

impl Class {
    pub fn as_str(self) -> &'static str {
        match self {
            Class::Vector => "VECTOR",
            Class::SampledAdversarial => "SAMPLED-ADVERSARIAL",
            Class::BoundedSymbolic => "BOUNDED-SYMBOLIC",
            Class::ProveUniversal => "PROVE-UNIVERSAL",
            Class::Equivalence => "EQUIVALENCE",
            Class::Teeth => "TEETH",
            Class::Measurement => "MEASUREMENT",
            Class::Characterization => "CHARACTERIZATION",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Pass,
    Fail,
    Inconclusive,
    Unsupported,
    NotRun,
}

impl Outcome {
    pub fn as_str(self) -> &'static str {
        match self {
            Outcome::Pass => "PASS",
            Outcome::Fail => "FAIL",
            Outcome::Inconclusive => "INCONCLUSIVE",
            Outcome::Unsupported => "UNSUPPORTED",
            Outcome::NotRun => "NOT-RUN",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Row {
    pub id: String,
    pub class: Class,
    pub outcome: Outcome,
    /// A required row decides the verdict; an optional one is recorded only.
    pub required: bool,
    pub claim: String,
    pub expected: Value,
    pub observed: Value,
    pub evidence: Vec<String>,
}

impl Row {
    pub fn new(id: &str, class: Class, claim: &str) -> Row {
        Row {
            id: id.to_string(),
            class,
            outcome: Outcome::NotRun,
            required: true,
            claim: claim.to_string(),
            expected: Value::Null,
            observed: Value::Null,
            evidence: Vec::new(),
        }
    }

    pub fn optional(mut self) -> Row {
        self.required = false;
        self
    }

    pub fn expect(mut self, v: Value) -> Row {
        self.expected = v;
        self
    }

    pub fn observe(mut self, outcome: Outcome, v: Value) -> Row {
        self.outcome = outcome;
        self.observed = v;
        self
    }

    pub fn evidence(mut self, paths: &[&str]) -> Row {
        self.evidence.extend(paths.iter().map(|s| s.to_string()));
        self
    }

    fn json(&self) -> Value {
        json!({
            "id": self.id,
            "class": self.class.as_str(),
            "outcome": self.outcome.as_str(),
            "required": self.required,
            "claim": self.claim,
            "expected": self.expected,
            "observed": self.observed,
            "evidence": self.evidence,
        })
    }
}

pub struct Receipt {
    pub lane: String,
    pub job: String,
    pub out_dir: PathBuf,
    pub started_utc: String,
    pub sections: Map<String, Value>,
    pub assumptions: Vec<String>,
    pub obligations: Vec<String>,
    pub rows: Vec<Row>,
    pub measurements: Map<String, Value>,
    evidence: Vec<(String, &'static str)>,
}

impl Receipt {
    pub fn new(lane: &str, job: &str, out_dir: &Path) -> Receipt {
        Receipt {
            lane: lane.to_string(),
            job: job.to_string(),
            out_dir: out_dir.to_path_buf(),
            started_utc: crate::host::utc_now(),
            sections: Map::new(),
            assumptions: Vec::new(),
            obligations: Vec::new(),
            rows: Vec::new(),
            measurements: Map::new(),
            evidence: Vec::new(),
        }
    }

    pub fn section(&mut self, key: &str, v: Value) {
        self.sections.insert(key.to_string(), v);
    }

    pub fn row(&mut self, r: Row) {
        println!(
            "{} {} [{}] {}: {}",
            self.lane,
            r.outcome.as_str(),
            r.class.as_str(),
            r.id,
            r.claim
        );
        self.rows.push(r);
    }

    pub fn measure(&mut self, key: &str, v: Value) {
        self.measurements.insert(key.to_string(), v);
    }

    /// Register an evidence file (relative to the output directory). Its
    /// digest is taken when the receipt is written. `retention` says where
    /// the bytes live: "committed", "ci-artifact" or "local-only".
    pub fn evidence_file(&mut self, rel: &str, retention: &'static str) {
        if !self.evidence.iter().any(|(r, _)| r == rel) {
            self.evidence.push((rel.to_string(), retention));
        }
    }

    /// (overall, counts): FAIL if any required row failed; INCONCLUSIVE if
    /// any required row is inconclusive, unsupported or not run; else PASS.
    pub fn verdict(&self) -> (&'static str, Value) {
        let mut counts: Map<String, Value> = Map::new();
        for r in &self.rows {
            let key = format!("{} {}", r.class.as_str(), r.outcome.as_str());
            let n = counts.get(&key).and_then(Value::as_u64).unwrap_or(0);
            counts.insert(key, json!(n + 1));
        }
        let req = || self.rows.iter().filter(|r| r.required);
        let overall = if self.rows.is_empty() {
            "INCONCLUSIVE"
        } else if req().any(|r| r.outcome == Outcome::Fail) {
            "FAIL"
        } else if req().any(|r| r.outcome != Outcome::Pass) {
            "INCONCLUSIVE"
        } else {
            "PASS"
        };
        (overall, Value::Object(counts))
    }

    fn body(&self, serialization: Value) -> Value {
        let (overall, counts) = self.verdict();
        let evidence: Vec<Value> = self
            .evidence
            .iter()
            .map(|(rel, retention)| match file_tag(&self.out_dir.join(rel)) {
                Ok((tag, bytes)) => {
                    json!({ "path": rel, "sha256": tag, "bytes": bytes, "retention": retention })
                }
                Err(e) => json!({ "path": rel, "missing": e.to_string(), "retention": retention }),
            })
            .collect();
        let mut v = json!({
            "schema": SCHEMA,
            "job": { "lane": self.lane, "name": self.job, "started_utc": self.started_utc, "finished_utc": crate::host::utc_now() },
            "assumptions": self.assumptions,
            "remaining_obligations": self.obligations,
            "results": self.rows.iter().map(Row::json).collect::<Vec<_>>(),
            "measurements": self.measurements,
            "evidence": evidence,
            "verdict": { "overall": overall, "counts": counts, "rule": "FAIL if any required row FAIL; INCONCLUSIVE if any required row is INCONCLUSIVE, UNSUPPORTED or NOT-RUN; PASS otherwise. Computed from the rows; no row is a process exit code alone." },
            "receipt_serialization": serialization,
        });
        for (k, val) in &self.sections {
            v[k] = val.clone();
        }
        v
    }

    /// Write `receipt-<lane>.json` into the output directory and return its
    /// path and verdict. Serialization is measured on a first pass (render +
    /// write + fsync) and that measurement is embedded in the final pass.
    pub fn write(&self) -> std::io::Result<(PathBuf, &'static str)> {
        let path = self
            .out_dir
            .join(format!("receipt-{}.json", self.lane.to_lowercase()));
        let t0 = Instant::now();
        let first = serde_json::to_vec_pretty(&self.body(json!("first pass")))?;
        let t_render = t0.elapsed().as_nanos() as u64;
        write_synced(&path, &first)?;
        let t_total = t0.elapsed().as_nanos() as u64;
        let ser = json!({
            "render_ns": t_render,
            "render_write_fsync_ns": t_total,
            "bytes_first_pass": first.len(),
            "note": "measured on a first pass of this receipt without this field; the final file differs only by this object and the finish timestamp",
        });
        let fin = serde_json::to_vec_pretty(&self.body(ser))?;
        write_synced(&path, &fin)?;
        let (overall, _) = self.verdict();
        println!(
            "{} receipt: {} ({} bytes) verdict {overall}",
            self.lane,
            path.display(),
            fin.len()
        );
        Ok((path, overall))
    }
}

fn write_synced(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let tmp = path.with_extension("json.tmp");
    let mut f = std::fs::File::create(&tmp)?;
    f.write_all(bytes)?;
    f.write_all(b"\n")?;
    f.sync_all()?;
    std::fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn receipt_with(rows: &[(Outcome, bool)]) -> Receipt {
        let mut r = Receipt::new("RBX", "test", Path::new("."));
        for (i, (o, req)) in rows.iter().enumerate() {
            let mut row = Row::new(&format!("r{i}"), Class::Vector, "c").observe(*o, Value::Null);
            row.required = *req;
            r.rows.push(row);
        }
        r
    }

    #[test]
    fn the_verdict_is_computed_from_required_rows_only() {
        assert_eq!(
            receipt_with(&[]).verdict().0,
            "INCONCLUSIVE",
            "no rows is not a pass"
        );
        assert_eq!(receipt_with(&[(Outcome::Pass, true)]).verdict().0, "PASS");
        assert_eq!(
            receipt_with(&[(Outcome::Pass, true), (Outcome::NotRun, false)])
                .verdict()
                .0,
            "PASS"
        );
        assert_eq!(
            receipt_with(&[(Outcome::Pass, true), (Outcome::NotRun, true)])
                .verdict()
                .0,
            "INCONCLUSIVE"
        );
        assert_eq!(
            receipt_with(&[(Outcome::Unsupported, true)]).verdict().0,
            "INCONCLUSIVE"
        );
        assert_eq!(
            receipt_with(&[(Outcome::Inconclusive, true), (Outcome::Fail, true)])
                .verdict()
                .0,
            "FAIL"
        );
        assert_eq!(
            receipt_with(&[(Outcome::Pass, true), (Outcome::Fail, false)])
                .verdict()
                .0,
            "PASS"
        );
    }
}
