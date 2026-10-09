//! RB01 inputs, the independent plaintext answer, and the classification of
//! what a PSI provider process did.
//!
//! Inputs are synthetic. Elements are 8 bytes (the width of upstream's
//! `usize::to_le_bytes` fixture and of popsicle's `PRIMARY_KEY_SIZE`), either
//! small integers in little-endian order (the upstream fixture) or the first
//! 8 bytes of SHA-256(label ‖ index) (every other fixture). Nothing here is a
//! secret: a fixture is reproducible from its definition, and its digest is
//! recorded.

use std::collections::HashSet;

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub type Elem = [u8; 8];

#[derive(Clone, Debug)]
pub struct Fixture {
    pub name: String,
    pub definition: String,
    /// The garbler's set.
    pub a: Vec<Elem>,
    /// The evaluator's set.
    pub b: Vec<Elem>,
}

fn synth(label: &str, i: u64) -> Elem {
    let mut h = Sha256::new();
    h.update(label.as_bytes());
    h.update([0]);
    h.update(i.to_le_bytes());
    let d = h.finalize();
    let mut e = [0u8; 8];
    e.copy_from_slice(&d[..8]);
    e
}

fn synth_set(label: &str, range: std::ops::Range<u64>) -> Vec<Elem> {
    range.map(|i| synth(label, i)).collect()
}

impl Fixture {
    /// Upstream `circuit_psi_cardinality.rs`: A = 0..256, B = A with index 10
    /// replaced by 257, as 8-byte little-endian integers. Expected 255.
    pub fn upstream() -> Fixture {
        let a: Vec<Elem> = (0u64..256).map(u64::to_le_bytes).collect();
        let mut b = a.clone();
        b[10] = 257u64.to_le_bytes();
        Fixture {
            name: "upstream-256".into(),
            definition: "A = {0..256} as u64 LE; B = A with B[10] = 257 (upstream circuit_psi_cardinality.rs)".into(),
            a,
            b,
        }
    }

    pub fn identical(n: u64) -> Fixture {
        let a = synth_set("rb01/identical", 0..n);
        Fixture {
            name: format!("identical-{n}"),
            definition: format!("A = B = synth(identical, 0..{n})"),
            b: a.clone(),
            a,
        }
    }

    pub fn disjoint(n: u64) -> Fixture {
        Fixture {
            name: format!("disjoint-{n}"),
            definition: format!("A = synth(disjoint-a, 0..{n}); B = synth(disjoint-b, 0..{n})"),
            a: synth_set("rb01/disjoint-a", 0..n),
            b: synth_set("rb01/disjoint-b", 0..n),
        }
    }

    /// |A| = na, |B| = nb, the first `overlap` elements shared.
    pub fn partial(na: u64, nb: u64, overlap: u64) -> Fixture {
        assert!(overlap <= na.min(nb));
        let mut a = synth_set("rb01/shared", 0..overlap);
        a.extend(synth_set("rb01/only-a", overlap..na));
        let mut b = synth_set("rb01/shared", 0..overlap);
        b.extend(synth_set("rb01/only-b", overlap..nb));
        Fixture {
            name: format!("partial-{na}x{nb}-overlap-{overlap}"),
            definition: format!(
                "A = synth(shared, 0..{overlap}) + synth(only-a, {overlap}..{na}); B = synth(shared, 0..{overlap}) + synth(only-b, {overlap}..{nb})"
            ),
            a,
            b,
        }
    }

    pub fn bytes(set: &[Elem]) -> Vec<u8> {
        set.iter().flatten().copied().collect()
    }

    pub fn expected(&self) -> usize {
        plaintext_cardinality(&self.a, &self.b)
    }

    pub fn describe(&self) -> Value {
        json!({
            "name": self.name,
            "definition": self.definition,
            "element_bytes": 8,
            "n_garbler": self.a.len(),
            "n_evaluator": self.b.len(),
            "garbler_input": crate::digest::sha256_tag(&Fixture::bytes(&self.a)),
            "evaluator_input": crate::digest::sha256_tag(&Fixture::bytes(&self.b)),
            "plaintext_cardinality": self.expected(),
        })
    }
}

/// The independent answer: |A ∩ B| over byte strings, computed with a hash
/// set and nothing from the protocol implementation. Sets are sets: an
/// element repeated in one input counts once.
pub fn plaintext_cardinality(a: &[Elem], b: &[Elem]) -> usize {
    let a: HashSet<&Elem> = a.iter().collect();
    let b: HashSet<&Elem> = b.iter().collect();
    a.intersection(&b).count()
}

/// What one provider process did, read from its exit and its one result line.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Outcome {
    /// `RB01-REFUSAL`, exit 3: refused before any protocol byte.
    Refusal(String),
    /// `RB01-ABORT`, exit 4: the protocol started and failed with an error.
    Abort { stage: String, io_timeout: bool },
    /// The process panicked (Rust exit 101) or died on a signal it did not
    /// receive from this harness.
    Crash(String),
    /// The harness killed it at its budget.
    Timeout,
    /// `RB01-RESULT`, exit 0, with the output it received (None for the
    /// garbler, which receives no output).
    Output(Option<u128>),
    /// Anything this harness does not recognize. Never counted as a pass.
    Unrecognized(String),
}

impl Outcome {
    pub fn label(&self) -> String {
        match self {
            Outcome::Refusal(c) => format!("REFUSAL {c}"),
            Outcome::Abort {
                stage,
                io_timeout: true,
            } => format!("TIMEOUT socket ({stage})"),
            Outcome::Abort {
                stage,
                io_timeout: false,
            } => format!("ABORT {stage}"),
            Outcome::Crash(why) => format!("ABORT crash ({why})"),
            Outcome::Timeout => "TIMEOUT budget".into(),
            Outcome::Output(Some(v)) => format!("OUTPUT {v}"),
            Outcome::Output(None) => "OUTPUT none".into(),
            Outcome::Unrecognized(why) => format!("UNRECOGNIZED {why}"),
        }
    }

    /// The four operational classes the order separates, plus output.
    pub fn class(&self) -> &'static str {
        match self {
            Outcome::Refusal(_) => "refusal",
            Outcome::Abort {
                io_timeout: true, ..
            }
            | Outcome::Timeout => "timeout",
            Outcome::Abort { .. } | Outcome::Crash(_) => "abort",
            Outcome::Output(_) => "output",
            Outcome::Unrecognized(_) => "unrecognized",
        }
    }
}

/// The JSON payload of the line starting with `tag`, if exactly one exists.
pub fn tagged_line(stdout: &str, tag: &str) -> Option<Value> {
    let mut found = stdout
        .lines()
        .filter_map(|l| l.strip_prefix(tag))
        .map(str::trim);
    let first = found.next()?;
    if found.next().is_some() {
        return None;
    }
    serde_json::from_str(first).ok()
}

/// Classify one provider process. `json_output` picks the output field out
/// of a result line (the shapes differ between local and TCP modes).
pub fn classify(
    exit: &crate::measure::Exit,
    stdout: &str,
    json_output: impl Fn(&Value) -> Option<Option<u128>>,
) -> Outcome {
    use crate::measure::Exit;
    match exit {
        Exit::Budget => Outcome::Timeout,
        Exit::Signal(s) => Outcome::Crash(format!("signal {s}")),
        Exit::Code(101) => Outcome::Crash("panic, exit 101".into()),
        Exit::Code(3) => match tagged_line(stdout, "RB01-REFUSAL") {
            Some(v) => Outcome::Refusal(v["code"].as_str().unwrap_or("?").to_string()),
            None => Outcome::Unrecognized("exit 3 without one RB01-REFUSAL line".into()),
        },
        Exit::Code(4) => match tagged_line(stdout, "RB01-ABORT") {
            Some(v) => Outcome::Abort {
                stage: v["stage"].as_str().unwrap_or("?").to_string(),
                io_timeout: v["io_timeout"].as_bool().unwrap_or(false),
            },
            None => Outcome::Unrecognized("exit 4 without one RB01-ABORT line".into()),
        },
        Exit::Code(0) => match tagged_line(stdout, "RB01-RESULT")
            .as_ref()
            .and_then(&json_output)
        {
            Some(out) => Outcome::Output(out),
            None => Outcome::Unrecognized("exit 0 without a parseable RB01-RESULT line".into()),
        },
        Exit::Code(c) => Outcome::Unrecognized(format!("exit {c}")),
    }
}

/// The output field of a result line: `"255"` → Some(Some(255)), null →
/// Some(None), anything else → None (unparseable).
pub fn output_field(v: &Value) -> Option<Option<u128>> {
    match v {
        Value::Null => Some(None),
        Value::String(s) => s.parse().ok().map(Some),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::measure::Exit;

    #[test]
    fn fixtures_have_the_plaintext_answers_they_claim() {
        assert_eq!(Fixture::upstream().expected(), 255);
        assert_eq!(Fixture::identical(256).expected(), 256);
        assert_eq!(Fixture::disjoint(256).expected(), 0);
        assert_eq!(Fixture::partial(1024, 256, 200).expected(), 200);
        for f in [
            Fixture::identical(4096),
            Fixture::disjoint(4096),
            Fixture::partial(4096, 4096, 2048),
        ] {
            let a: HashSet<_> = f.a.iter().collect();
            let b: HashSet<_> = f.b.iter().collect();
            assert_eq!(
                (a.len(), b.len()),
                (f.a.len(), f.b.len()),
                "{}: synthetic sets have no repeats",
                f.name
            );
        }
    }

    #[test]
    fn the_plaintext_answer_treats_inputs_as_sets() {
        let x = [1u8; 8];
        let y = [2u8; 8];
        assert_eq!(plaintext_cardinality(&[x, x, y], &[x]), 1);
        assert_eq!(plaintext_cardinality(&[], &[x]), 0);
    }

    #[test]
    fn process_outcomes_are_classified_from_exit_and_line_together() {
        let out = |v: &Value| output_field(&v["output"]);
        assert_eq!(
            classify(&Exit::Code(0), "RB01-RESULT {\"output\":\"255\"}\n", out),
            Outcome::Output(Some(255))
        );
        assert_eq!(
            classify(&Exit::Code(0), "RB01-RESULT {\"output\":null}\n", out),
            Outcome::Output(None)
        );
        assert!(
            matches!(classify(&Exit::Code(0), "", out), Outcome::Unrecognized(_)),
            "exit 0 alone is not a result"
        );
        assert!(matches!(
            classify(
                &Exit::Code(0),
                "RB01-RESULT {\"output\":1}\nRB01-RESULT {\"output\":1}",
                out
            ),
            Outcome::Unrecognized(_)
        ));
        assert_eq!(
            classify(
                &Exit::Code(3),
                "RB01-REFUSAL {\"code\":\"input-empty\"}",
                out
            ),
            Outcome::Refusal("input-empty".into())
        );
        assert_eq!(
            classify(
                &Exit::Code(4),
                "RB01-ABORT {\"stage\":\"protocol\",\"io_timeout\":true}",
                out
            )
            .class(),
            "timeout"
        );
        assert_eq!(
            classify(
                &Exit::Code(4),
                "RB01-ABORT {\"stage\":\"protocol\",\"io_timeout\":false}",
                out
            )
            .class(),
            "abort"
        );
        assert_eq!(classify(&Exit::Code(101), "", out).class(), "abort");
        assert_eq!(classify(&Exit::Budget, "", out).class(), "timeout");
        assert_eq!(classify(&Exit::Code(9), "", out).class(), "unrecognized");
    }
}
