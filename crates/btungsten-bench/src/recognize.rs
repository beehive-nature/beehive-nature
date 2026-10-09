//! Verifier verdicts, recognized from the verifier's own output lines.
//!
//! A process exit status is never read as a verdict on its own. A proof
//! counts only where the verifier printed its success line for that
//! obligation; a refutation only where it printed a counterexample; anything
//! else (a tool error, a solver crash, a timeout, a line shape this module
//! does not know) is reported as unrecognized and becomes INCONCLUSIVE.

/// ANSI escape sequences (crux-mir redraws progress with `ESC[0K`).
pub fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        if c == '\u{1b}' && it.peek() == Some(&'[') {
            it.next();
            for d in it.by_ref() {
                if d.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// `aes_verif/bd9eaa76::toplevel_decrypt_block_256[0]` →
/// `aes_verif::toplevel_decrypt_block_256`: the crate disambiguator and the
/// `[n]` instance suffixes mir-json adds are dropped.
pub fn normalize_fn(name: &str) -> String {
    let name = name.trim();
    let mut s = String::with_capacity(name.len());
    for (i, seg) in name.split("::").enumerate() {
        if i > 0 {
            s.push_str("::");
        }
        let seg = if i == 0 {
            seg.split('/').next().unwrap_or(seg)
        } else {
            seg
        };
        s.push_str(seg.split('[').next().unwrap_or(seg));
    }
    s
}

#[derive(Debug, Default)]
pub struct SawReport {
    /// Normalized names from `Proof succeeded! <fn>`.
    pub succeeded: Vec<String>,
    /// Normalized names from `Subgoal failed: <fn> ...` outside `fails` blocks.
    pub failed: Vec<String>,
    /// Error lines of shapes this module does not classify.
    pub unrecognized: Vec<String>,
}

impl SawReport {
    pub fn proved(&self, f: &str) -> bool {
        self.succeeded.iter().any(|s| s == f)
    }
}

pub fn saw_report(text: &str) -> SawReport {
    let text = strip_ansi(text);
    let mut r = SawReport::default();
    for raw in text.lines() {
        let line = strip_timestamp(raw);
        if let Some(f) = line.strip_prefix("Proof succeeded! ") {
            r.succeeded.push(normalize_fn(f));
        } else if line.contains("Parse error")
            || line.contains("user error")
            || line.starts_with("Cryptol error")
            || line.contains("Could not resolve")
        {
            r.unrecognized.push(line.to_string());
        }
    }
    // a failed subgoal inside a `fails` block is the anticipated failure
    r.failed = failed_outside_anticipated(&text);
    r
}

/// SAW prefixes progress lines with `[HH:MM:SS.mmm] `.
fn strip_timestamp(l: &str) -> &str {
    let t = l.trim_start();
    if t.starts_with('[') {
        if let Some(i) = t.find("] ") {
            let stamp = &t[1..i];
            if stamp.len() >= 8
                && stamp
                    .chars()
                    .all(|c| c.is_ascii_digit() || c == ':' || c == '.')
            {
                return &t[i + 2..];
            }
        }
    }
    t
}

/// The counterexample block in a segment of output: from a line containing
/// `Counterexample` (mir_verify) or starting with `Invalid: [` (prove_print)
/// to the end of that block, or empty.
fn counterexample(segment: &[&str]) -> String {
    let start = segment.iter().position(|l| {
        let s = strip_timestamp(l);
        s.contains("Counterexample") || s.starts_with("Invalid: [")
    });
    match start {
        None => String::new(),
        Some(i) => segment[i..]
            .iter()
            .map(|l| strip_timestamp(l))
            .take_while(|l| !l.starts_with("Stack trace"))
            .take(40)
            .collect::<Vec<_>>()
            .join("\n"),
    }
}

fn failed_outside_anticipated(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut pending: Vec<String> = Vec::new();
    for raw in text.lines() {
        let line = strip_timestamp(raw);
        if let Some(rest) = line.strip_prefix("Subgoal failed: ") {
            pending.push(normalize_fn(rest.split_whitespace().next().unwrap_or(rest)));
        } else if line.starts_with("== Anticipated failure message ==") {
            pending.clear();
        } else if line.starts_with("Proof succeeded! ") || line.starts_with("RB02-SAW") {
            out.append(&mut pending);
        }
    }
    out.append(&mut pending);
    out
}

/// Crux's `Goal status:` block.
#[derive(Debug, Default, PartialEq, Eq, Clone, Copy)]
pub struct GoalCounts {
    pub total: u64,
    pub proved: u64,
    pub disproved: u64,
    pub incomplete: u64,
    pub unknown: u64,
}

/// For a SAW script that prints `<prefix> <name>` after each obligation (and
/// after each `fails` block), the output belonging to the obligation named
/// `name`: every line since the previous `<prefix>`-family line. SAW's
/// `fails` prints the caught failure AFTER `== Anticipated failure message
/// ==`, and `mir_verify` prints its counterexample before it, so the whole
/// segment is read.
pub fn saw_segment(text: &str, family: &str, line: &str) -> Option<String> {
    let text = strip_ansi(text);
    let mut seg: Vec<&str> = Vec::new();
    for raw in text.lines() {
        let l = strip_timestamp(raw);
        if l.starts_with(family) {
            if l == line {
                return Some(seg.join("\n"));
            }
            seg.clear();
            continue;
        }
        seg.push(raw);
    }
    None
}

/// The refutation evidence in a `fails` segment: the anticipated-failure
/// marker must be there, and so must a solver counterexample
/// (`Counterexample` from mir_verify, `Invalid: [` from prove_print). Returns
/// the counterexample block, or None.
pub fn saw_refutation(segment: &str) -> Option<String> {
    if !segment.contains("== Anticipated failure message ==") {
        return None;
    }
    let lines: Vec<&str> = segment.lines().collect();
    let cex = counterexample(&lines);
    (!cex.is_empty()).then_some(cex)
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct CruxReport {
    /// (normalized test name, status word: "ok", "FAILED", ...)
    pub tests: Vec<(String, String)>,
    /// The text after `Overall status:` (e.g. "Valid.", "Invalid."), if printed.
    pub overall: Option<String>,
    /// The `Goal status:` counts, when printed (they are not printed when
    /// every goal was discharged by simplification).
    pub goals: Option<GoalCounts>,
    /// Counterexample / failing-goal text, if any was printed.
    pub counterexamples: Vec<String>,
    /// Tool errors (solver protocol failures, Haskell `user error`, crashes).
    pub errors: Vec<String>,
}

impl CruxReport {
    pub fn status(&self, test: &str) -> Option<&str> {
        self.tests
            .iter()
            .find(|(n, _)| n.ends_with(test))
            .map(|(_, s)| s.as_str())
    }
}

pub fn crux_report(text: &str) -> CruxReport {
    let text = strip_ansi(text);
    let mut r = CruxReport::default();
    let mut in_cex = false;
    let mut cex = String::new();
    // a test line whose status comes on a later line: "test X: [Crux] Attempting
    // to prove verification conditions." then "FAILED" / "ok"
    let mut pending: Option<String> = None;
    let mut goals = GoalCounts::default();
    let mut saw_goals = false;
    for line in text.lines() {
        let t = line.trim();
        if let Some(rest) = line.strip_prefix("test ") {
            if let Some((name, status)) = rest.rsplit_once(": ") {
                let status = status.trim();
                if status.starts_with('[') {
                    pending = Some(normalize_fn(name));
                } else if !status.is_empty() {
                    r.tests.push((normalize_fn(name), status.to_string()));
                }
            }
        } else if let Some(name) = pending.as_ref() {
            if t == "ok" || t == "FAILED" {
                r.tests.push((name.clone(), t.to_string()));
                pending = None;
            }
        }
        if let Some(i) = line.find("Overall status: ") {
            r.overall = Some(line[i + "Overall status: ".len()..].trim().to_string());
        }
        let count = |key: &str| {
            t.strip_prefix("[Crux]")
                .map(str::trim)
                .and_then(|x| x.strip_prefix(key))
                .and_then(|x| x.trim().parse::<u64>().ok())
        };
        if let Some(v) = count("Total:") {
            goals.total = v;
            saw_goals = true;
        }
        if let Some(v) = count("Proved:") {
            goals.proved = v;
        }
        if let Some(v) = count("Disproved:") {
            goals.disproved = v;
        }
        if let Some(v) = count("Incomplete:") {
            goals.incomplete = v;
        }
        if let Some(v) = count("Unknown:") {
            goals.unknown = v;
        }
        if line.contains("user error")
            || line.contains("Unexpected response from solver")
            || line.contains("CallStack (from HasCallStack)")
        {
            r.errors.push(t.to_string());
        }
        // the failing goal (stderr) and, with --show-model, the model (stdout)
        if line.contains("Found counterexample") || t == "Model:" {
            in_cex = true;
        }
        if in_cex {
            cex.push_str(line);
            cex.push('\n');
            if t.is_empty() || line.contains("Overall status") {
                in_cex = false;
                r.counterexamples.push(std::mem::take(&mut cex));
            }
        }
    }
    if !cex.is_empty() {
        r.counterexamples.push(cex);
    }
    if saw_goals {
        r.goals = Some(goals);
    }
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn function_names_are_normalized() {
        assert_eq!(
            normalize_fn("aes_verif/bd9eaa76::toplevel_decrypt_block_256[0]"),
            "aes_verif::toplevel_decrypt_block_256"
        );
        assert_eq!(
            normalize_fn("aes/eb198c42::soft[0]::fixslice[0]::bitslice[0]"),
            "aes::soft::fixslice::bitslice"
        );
        assert_eq!(
            normalize_fn("rb03_budget/8fcb1e6a::props[0]::p1_zero_gas_limit_refuses[0]"),
            "rb03_budget::props::p1_zero_gas_limit_refuses"
        );
    }

    #[test]
    fn crux_lines_from_a_real_run_are_recognized() {
        // verbatim from the 2026-10-08 RB03 trial (crux-mir 0.13.0.0.99 at crucible 25d0f369)
        let text = "test rb03_budget/8fcb1e6a::vectors[0]::gas_buffer_vectors[0]: \u{1b}[0Kok\n\
                    test rb03_budget/8fcb1e6a::vectors[0]::payment_floor_vectors[0]: \u{1b}[0Kok\n\
                    \n[Crux-MIR] ---- FINAL RESULTS ----\n\
                    [Crux] All goals discharged through internal simplification.\n\
                    [Crux] Overall status: Valid.\n";
        let r = crux_report(text);
        assert_eq!(r.tests.len(), 2);
        assert_eq!(r.status("gas_buffer_vectors"), Some("ok"));
        assert_eq!(r.overall.as_deref(), Some("Valid."));
        assert!(r.errors.is_empty());
    }

    #[test]
    fn a_crux_solver_crash_is_an_error_not_a_verdict() {
        // verbatim shape from the 2026-10-08 RB03 trial (yices, goal timeout 300 s)
        let text = "user error (Unexpected response from solver while awaiting acknowledgement\n*** result:\"interrupted\"\n\
                    in response to command\n***: (pop)\n)\n\
                    test rb03_budget/8fcb1e6a::props[0]::p1_zero_gas_limit_refuses[0]: \u{1b}[0Kok\n\
                    test rb03_budget/8fcb1e6a::props[0]::p2_refuses_iff_network_fee_unaffordable[0]: [Crux] Attempting to prove verification conditions.\n";
        let r = crux_report(text);
        assert_eq!(r.status("p1_zero_gas_limit_refuses"), Some("ok"));
        assert_eq!(
            r.status("p2_refuses_iff_network_fee_unaffordable"),
            None,
            "no status word was printed for p2"
        );
        assert!(r.overall.is_none());
        assert!(!r.errors.is_empty());
    }

    #[test]
    fn a_crux_refutation_from_a_real_run_is_recognized() {
        // verbatim from the 2026-10-08 RB03 teeth trial (t1, bitwuzla offline)
        let text = "[Crux] Found counterexample for verification goal\n\
[Crux]   ./libs/crucible/lib.rs:50:9: 50:79 !src/props.rs:62:9: 62:62: error: in rb03_budget/1f17ab51::props[0]::check_cap_fits[0]\n\
[Crux]   MIR assertion at src/props.rs:62:9:\n\
[Crux]   \tfits(cap, i.gas_limit, i.remaining)\n\
[Crux] Overall status: Invalid.\n\
test rb03_budget/1f17ab51::faulty[0]::crux_teeth[0]::t1_wrapping_affordability_cap_fits[0]: [Crux] Attempting to prove verification conditions.\n\
\u{1b}[0KFAILED\n\nfailures:\n\n\
---- rb03_budget/1f17ab51::faulty[0]::crux_teeth[0]::t1_wrapping_affordability_cap_fits[0] counterexamples ----\n\n\
[Crux-MIR] ---- FINAL RESULTS ----\n\
[Crux] Goal status:\n[Crux]   Total: 16\n[Crux]   Proved: 15\n[Crux]   Disproved: 1\n[Crux]   Incomplete: 0\n[Crux]   Unknown: 0\n";
        let r = crux_report(text);
        assert_eq!(
            r.status("t1_wrapping_affordability_cap_fits"),
            Some("FAILED")
        );
        assert_eq!(r.overall.as_deref(), Some("Invalid."));
        assert_eq!(
            r.goals,
            Some(GoalCounts {
                total: 16,
                proved: 15,
                disproved: 1,
                incomplete: 0,
                unknown: 0
            })
        );
        assert_eq!(r.counterexamples.len(), 1);
        assert!(r.counterexamples[0].contains("fits(cap, i.gas_limit, i.remaining)"));
        assert!(r.errors.is_empty());
    }

    #[test]
    fn a_crux_model_is_kept_as_counterexample_evidence() {
        // verbatim shape from the 2026-10-08 RB03 smoke (t1, cvc5 int-blasting, --show-model)
        let text = "failures:\n\n---- rb03_budget/ebcc880f::faulty[0]::crux_teeth[0]::t1_wrapping_affordability_cap_fits[0] counterexamples ----\n\
Model:\nremaining_wei = 0x4 (signed), 0x4 (unsigned), 4 (decimal)\ngas_limit = 0x2 (signed), 0x2 (unsigned), 2 (decimal)\n\n\
[Crux-MIR] ---- FINAL RESULTS ----\n";
        let r = crux_report(text);
        assert_eq!(r.counterexamples.len(), 1);
        assert!(r.counterexamples[0].contains("gas_limit = 0x2"));
    }

    #[test]
    fn a_saw_fails_block_needs_its_counterexample() {
        // the shape SAW 1.6 printed on this host for `fails (prove_print z3 {{ True == False }})`
        let text = "RB02-SAW PROVEN f\n== Anticipated failure message ==\nStack trace:\n   (builtin) in z3\n\
                    prove: 1 unsolved subgoal(s)\nInvalid: []\n\nRB02-SAW-TEETH REFUTED t1\n\
                    == Anticipated failure message ==\nStack trace:\n   (builtin) in mir_verify\nsome other error\n\
                    RB02-SAW-TEETH REFUTED t2\n";
        let s1 = saw_segment(text, "RB02-SAW", "RB02-SAW-TEETH REFUTED t1").unwrap();
        assert!(saw_refutation(&s1).is_some_and(|c| c.starts_with("Invalid: [")));
        let s2 = saw_segment(text, "RB02-SAW", "RB02-SAW-TEETH REFUTED t2").unwrap();
        assert_eq!(
            saw_refutation(&s2),
            None,
            "a failure without a counterexample is not a refutation"
        );
        assert_eq!(
            saw_segment(text, "RB02-SAW", "RB02-SAW-TEETH REFUTED t3"),
            None
        );
    }

    #[test]
    fn saw_success_lines_count_only_as_printed() {
        let text = "[23:49:28.437] Proof succeeded! aes/eb198c42::soft[0]::fixslice[0]::bitslice[0]\n\
                    [23:58:13.048] Proof succeeded! aes_verif/bd9eaa76::toplevel_decrypt_block_256[0]\n";
        let r = saw_report(text);
        assert!(r.proved("aes_verif::toplevel_decrypt_block_256"));
        assert!(!r.proved("aes_verif::toplevel_encrypt_block_256"));
        assert!(r.failed.is_empty());
    }
}
