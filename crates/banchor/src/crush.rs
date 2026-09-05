//! CRUSH — headroom's TextCrusher wired into the snapshot path (z3.1
//! order B, 2026-09-05: offline mode ONLY, beacon cut at source — see
//! crates/headroom-textcrusher, whose tests PROVE no outbound capability
//! exists in the vendored code).
//!
//! THE RULES OF THIS SEAM:
//!   * INTERACTIVE TARGETS ARE SACRED — any line carrying a `[ref=@eN]`
//!     is protected verbatim (M3's law: every target stays addressable;
//!     the model must never lose a click target to compression).
//!   * PROVENANCE HEADERS ARE SACRED — lines starting `#` (the counting
//!     artifacts' provenance + integrity lines) pass through untouched.
//!   * The GOAL is the relevance query — headroom's BM25 scores each
//!     crushable run against what the loop is actually trying to do, so
//!     goal-bearing lines survive and boilerplate goes first.
//!   * Runs between protected lines crush IN PLACE — order is preserved,
//!     protected lines stay anchored where they were, and runs shorter
//!     than headroom's own `min_segments_for_crush` pass through intact
//!     (the crusher refuses to crush what is already small).
//!   * Deterministic by construction (same text + goal + ratio ⇒ same
//!     bytes) — receipts carry the algorithm id `headroom.text-crusher/1`
//!     beside the tokenizer id, per the every-count-carries-its-id law.

use headroom_textcrusher::{TextCrusher, TextCrusherConfig};

/// The receipt id — re-exported so callers never hardcode the string.
pub const CRUSH_ALG: &str = headroom_textcrusher::ALG_ID;

/// Is this snapshot line protected from crushing? (refs + `#` headers)
pub fn is_protected_line(line: &str) -> bool {
    line.contains("[ref=@") || line.starts_with('#')
}

/// The outcome a receipt renders for one crush pass.
#[derive(Debug, Clone)]
pub struct CrushOutcome {
    pub text: String,
    pub lines_in: usize,
    pub lines_out: usize,
    pub protected_lines: usize,
    pub crushable_lines: usize,
    pub segments_kept: usize,
    pub segments_total: usize,
    pub target_ratio: f64,
    pub alg: &'static str,
}

impl CrushOutcome {
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "alg": self.alg,
            "target_ratio": self.target_ratio,
            "lines_in": self.lines_in,
            "lines_out": self.lines_out,
            "protected_lines": self.protected_lines,
            "crushable_lines": self.crushable_lines,
            "segments_kept": self.segments_kept,
            "segments_total": self.segments_total,
            "source": "vendored headroom TextCrusher, offline-only cut (crates/headroom-textcrusher)",
        })
    }
}

/// Crush a snapshot text: protected lines verbatim and anchored, the runs
/// between them extractively compressed toward `target_ratio` of their
/// characters, scored by recency + BM25-relevance-to-`goal` + salience.
pub fn crush_snapshot(text: &str, goal: &str, target_ratio: f64) -> CrushOutcome {
    let crusher = TextCrusher::new(TextCrusherConfig {
        target_ratio,
        ..TextCrusherConfig::default()
    });
    let lines: Vec<&str> = text.split('\n').collect();
    let mut out_lines: Vec<String> = Vec::with_capacity(lines.len());
    let mut run: Vec<&str> = Vec::new();
    let (mut protected, mut segments_kept, mut segments_total) = (0usize, 0usize, 0usize);

    fn flush(
        run: &mut Vec<&str>,
        crusher: &TextCrusher,
        goal: &str,
        out: &mut Vec<String>,
        kept: &mut usize,
        total: &mut usize,
    ) {
        if run.is_empty() {
            return;
        }
        let joined = run.join("\n");
        let result = crusher.compress(&joined, goal, None);
        *kept += result.kept_segments;
        *total += result.total_segments;
        for line in result.compressed.split('\n') {
            if !line.trim().is_empty() {
                out.push(line.to_string());
            }
        }
        run.clear();
    }

    for line in &lines {
        if is_protected_line(line) {
            flush(
                &mut run,
                &crusher,
                goal,
                &mut out_lines,
                &mut segments_kept,
                &mut segments_total,
            );
            protected += 1;
            out_lines.push((*line).to_string());
        } else {
            run.push(line);
        }
    }
    flush(
        &mut run,
        &crusher,
        goal,
        &mut out_lines,
        &mut segments_kept,
        &mut segments_total,
    );

    CrushOutcome {
        text: out_lines.join("\n"),
        lines_in: lines.len(),
        lines_out: out_lines.len(),
        protected_lines: protected,
        crushable_lines: lines.len() - protected,
        segments_kept,
        segments_total,
        target_ratio,
        alg: CRUSH_ALG,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROSE_SNAPSHOT: &str = "# banchor snapshot artifact — provenance line
# integrity: sha3-256:h4-0rpd_3W2L_LDwBJ7CdoJsMKcKvO2YMBgtwokdp7U
- rootwebarea
  - generic:
    - heading \"Example Domain\" [ref=@e1]
    - paragraph: This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.
    - paragraph: Additional information about the example domain is available in the help center, where documentation describes registration and usage patterns for example domains.
    - link \"More information...\" →iana.org [ref=@e2]
      - paragraph: The help center contains guidance about reserved domains and the special-purpose registry maintained by IANA for documentation use.
      - paragraph: Launched in 1992, the registry has grown to cover many top-level domains reserved for documentation, testing, and interoperability scenarios across the internet.
      - paragraph: Launched in 1993, a near duplicate paragraph about the registry that has grown to cover top-level domains reserved for documentation.
    - link \"Home page\" →example.com [ref=@e3]";

    #[test]
    fn refs_and_headers_survive_any_ratio() {
        let outcome = crush_snapshot(
            PROSE_SNAPSHOT,
            "more information about example domains",
            0.05,
        );
        assert!(
            outcome.text.contains("[ref=@e1]"),
            "heading ref must survive"
        );
        assert!(outcome.text.contains("[ref=@e2]"), "link ref must survive");
        assert!(
            outcome.text.contains("[ref=@e3]"),
            "second link ref must survive"
        );
        assert!(
            outcome.text.starts_with("# banchor snapshot"),
            "provenance header survives"
        );
        assert!(
            outcome.text.contains("integrity: sha3-256"),
            "integrity line survives"
        );
        assert_eq!(outcome.protected_lines, 5, "2 headers + 3 refs");
    }

    #[test]
    fn protected_lines_keep_their_relative_order() {
        let outcome = crush_snapshot(PROSE_SNAPSHOT, "example domain", 0.5);
        let pos = |needle: &str| outcome.text.find(needle).unwrap_or(usize::MAX);
        assert!(pos("[ref=@e1]") < pos("[ref=@e2]"));
        assert!(pos("[ref=@e2]") < pos("[ref=@e3]"));
        assert!(pos("# banchor") < pos("[ref=@e1]"), "header stays on top");
    }

    #[test]
    fn goal_relevant_line_survives_irrelevant_prose_dies() {
        // "registration" only appears in the goal-relevant paragraph;
        // the near-duplicate paragraph is the designed loser
        let outcome = crush_snapshot(PROSE_SNAPSHOT, "registration and usage patterns", 0.3);
        assert!(
            outcome.text.contains("registration"),
            "goal-bearing text survives: {}",
            outcome.text
        );
    }

    #[test]
    fn crush_actually_shrinks_a_prose_run() {
        let prose = (0..24)
            .map(|i| format!("Sentence number {i} talks about the history of the browser engine and its release cycle across many years of development effort."))
            .collect::<Vec<_>>()
            .join("\n");
        let outcome = crush_snapshot(&prose, "browser engine", 0.5);
        assert!(
            outcome.text.len() < prose.len() * 9 / 10,
            "24-sentence run at ratio 0.5 must shrink ({} → {})",
            prose.len(),
            outcome.text.len()
        );
        assert!(outcome.segments_kept < outcome.segments_total);
    }

    #[test]
    fn short_snapshots_pass_through() {
        let small = "- rootwebarea\n  - link \"More\" [ref=@e2]";
        let outcome = crush_snapshot(small, "anything", 0.5);
        assert_eq!(outcome.text, small);
        assert_eq!(
            outcome.segments_kept, outcome.segments_total,
            "nothing crushed"
        );
    }

    #[test]
    fn deterministic_bytes() {
        let a = crush_snapshot(PROSE_SNAPSHOT, "example domain", 0.4);
        let b = crush_snapshot(PROSE_SNAPSHOT, "example domain", 0.4);
        assert_eq!(a.text, b.text, "same input + goal + ratio ⇒ same bytes");
        assert_eq!(a.alg, "headroom.text-crusher/1");
    }

    #[test]
    fn empty_and_blank_only_inputs_are_safe() {
        assert_eq!(crush_snapshot("", "g", 0.5).text, "");
        let blanks = "\n\n\n";
        let outcome = crush_snapshot(blanks, "g", 0.5);
        assert!(outcome.text.trim().is_empty());
    }
}
