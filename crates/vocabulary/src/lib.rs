//! `vocabulary` — the project's naming-law lints, consolidated. The prose home is
//! `docs/VOCABULARY.md`; this crate is where the laws that can be *checked* are checked.
//!
//! **Why a lint and not a style note.** Three naming collisions have now cost this project a
//! reconciliation each — `BNRi` (OS vs EVM artifact), PLUR's `Respect` (interpretive vs governance
//! unit), and the activity-noun for node work vs crop work — and **all three were invisible in
//! prose and obvious the moment someone wrote a type signature.** Prose tolerates ambiguity; a
//! compiler does not. A lint moves the catch earlier than the type does.
//!
//! **v1: the RELAY_22 ruling.** The bare, unqualified activity-noun (the gerund of "to farm") is
//! banned across both products, the kernel crates, and documentation — copy, identifiers, type
//! names, doc comments. The approved terms are `node ops` / `mining` (crypto / infrastructure) and
//! `grow ops` / `cultivation` (agricultural). A qualifier immediately preceding the word (as in
//! "yield ⟨farm-noun⟩", "crop ⟨farm-noun⟩") passes, per the founder's "unqualified" wording — but
//! the four approved terms cover every real case, so a qualified use is a smell, not a need.
//!
//! Two escape hatches, both deliberate:
//! - **A qualifier carve-out** for the ratified `yield`/`crop` forms (see above).
//! - **An inline [`ALLOW_MARKER`]** (`vocab-allow`) for any line that must *name* the banned term
//!   definitionally rather than *use* it — a doc that quotes the rule, a test decoy. This is the
//!   naming-lint analogue of skipping comment lines in NC-VII1's scan: the lint must not trip on
//!   the text that defines it.
//!
//! The word is spelled out nowhere in this file's checkable surface without the marker or the
//! carve-out — the needle lives only in [`NEEDLE`], assembled so the lint does not flag its own
//! source, and the repo selftest excludes this crate's directory.

#![forbid(unsafe_code)]

/// The banned activity-noun, lowercased. Kept as the single source so the rest of this file can
/// discuss the rule without spelling the word (which would make the crate flag itself).
pub const NEEDLE: &str = "farming";

/// Inline marker exempting a line: it *names* the banned term definitionally rather than *using*
/// it. Put it in a comment on the same line (`<!-- vocab-allow -->`, `// vocab-allow`).
pub const ALLOW_MARKER: &str = "vocab-allow";

/// Qualifiers whose immediate precedence makes the word pass, per RELAY_22's "unqualified" wording.
const QUALIFIERS: &[&str] = &["yield", "crop"];

/// One flagged line: a bare, unqualified use of the banned activity-noun.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FarmingFinding {
    /// 1-based line number.
    pub line_no: usize,
    /// The offending line, trimmed.
    pub line: String,
}

fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// Does `prefix` (everything on the line before an occurrence) end in a ratified qualifier — i.e.
/// is the word "qualified"? Strips trailing separators (space, tab, hyphen), then reads the last
/// word. `anti-⟨word⟩` does NOT pass: "anti" is not a domain qualifier, so the anti-gaming sense
/// (mastery-ledger) is surfaced as a finding rather than silently blessed.
fn preceded_by_qualifier(prefix: &str) -> bool {
    let trimmed = prefix.trim_end_matches([' ', '\t', '-']);
    let last_word: String = trimmed
        .chars()
        .rev()
        .take_while(|c| is_word_char(*c))
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    QUALIFIERS.contains(&last_word.to_lowercase().as_str())
}

/// True if `line` contains at least one bare, unqualified, word-boundaried occurrence of the banned
/// noun. Word boundaries mean glued identifiers (`BnriFarmingLocked`, `cropfarming`) do NOT match —
/// they carry the ambiguity in a different form and are handled by their own rename, not this token
/// lint.
fn line_has_bare_needle(line: &str) -> bool {
    let lower = line.to_lowercase();
    let mut start = 0;
    while let Some(pos) = lower[start..].find(NEEDLE) {
        let idx = start + pos;
        let end = idx + NEEDLE.len();
        let before = lower[..idx].chars().last();
        let after = lower[end..].chars().next();
        let boundary_before = before.map_or(true, |c| !is_word_char(c));
        let boundary_after = after.map_or(true, |c| !is_word_char(c));
        if boundary_before && boundary_after && !preceded_by_qualifier(&lower[..idx]) {
            return true;
        }
        start = end;
    }
    false
}

/// Scan `text` for bare, unqualified uses of the banned activity-noun. A line carrying the
/// [`ALLOW_MARKER`] is skipped (it names the term definitionally). Returns one finding per offending
/// line.
pub fn farming_findings(text: &str) -> Vec<FarmingFinding> {
    text.lines()
        .enumerate()
        .filter(|(_, line)| !line.contains(ALLOW_MARKER))
        .filter(|(_, line)| line_has_bare_needle(line))
        .map(|(i, line)| FarmingFinding {
            line_no: i + 1,
            line: line.trim().to_string(),
        })
        .collect()
}

#[cfg(test)]
mod lint_controls {
    use super::*;

    // ── positive control: the lint is SHOWN to bite (a lint never seen to fail is not a lint) ──

    #[test]
    fn a_bare_use_is_caught() {
        let hits = farming_findings("The farming panel shows node health.");
        assert_eq!(hits.len(), 1, "a bare use must be flagged");
        assert_eq!(hits[0].line_no, 1);
    }

    #[test]
    fn case_is_ignored() {
        // `Farming,` — an enum variant — is the same violation as the lowercase word.
        assert_eq!(farming_findings("    Farming,").len(), 1);
    }

    #[test]
    fn a_hyphen_prefixed_use_is_caught_surfacing_the_third_sense() {
        // "anti-<noun>" (the anti-gaming sense) is NOT a ratified qualifier, so it is flagged —
        // which is how the third meaning gets surfaced for a ruling instead of quietly blessed.
        assert_eq!(
            farming_findings("the anti-farming property lives on identity").len(),
            1
        );
    }

    // ── the carve-outs, each a control the other way ──

    #[test]
    fn a_ratified_qualifier_passes() {
        assert!(farming_findings("yield farming rewards accrue").is_empty());
        assert!(farming_findings("crop farming is the literal domain").is_empty());
    }

    #[test]
    fn the_approved_terms_are_clean() {
        for ok in [
            "node ops",
            "mining",
            "grow ops",
            "cultivation",
            "a farmer's plot",
        ] {
            assert!(
                farming_findings(ok).is_empty(),
                "approved/adjacent term wrongly flagged: {ok}"
            );
        }
    }

    #[test]
    fn glued_identifiers_are_not_token_matches() {
        // These carry the ambiguity, but not as this token — no word boundary. They are handled by
        // their own (deferred) rename, not by this lint. Documenting the boundary is the point.
        for id in [
            "BnriFarmingLocked",
            "farmington",
            "refarming",
            "cropfarming",
        ] {
            assert!(
                farming_findings(id).is_empty(),
                "glued identifier wrongly token-matched: {id}"
            );
        }
    }

    #[test]
    fn the_allow_marker_exempts_a_definitional_line() {
        let with = "the farming panel is banned <!-- vocab-allow: defining the rule -->";
        let without = "the farming panel is banned";
        assert!(
            farming_findings(with).is_empty(),
            "an allow-marked line is exempt"
        );
        assert_eq!(
            farming_findings(without).len(),
            1,
            "and without the marker it bites"
        );
    }
}

/// Repo selftest: the kernel crate sources must be clean of bare uses **except** an explicit,
/// self-validating pending-migration worklist. This is the guard the founder ratified, and it is
/// deliberately loud about what it has NOT yet migrated — the allowlist IS the worklist.
#[cfg(test)]
mod repo_selftest {
    use super::*;
    use std::path::{Path, PathBuf};

    /// (path-substring, line-substring, why-still-pending). Every entry MUST still match at least
    /// one finding — a stale entry fails the test, so the worklist cannot silently rot. Any finding
    /// NOT covered here fails the guard — new drift is caught immediately.
    const PENDING: &[(&str, &str, &str)] = &[
        (
            "chain-exsat-evm",
            "farming lock / unlock",
            "BNRi/exSat yield sense — migrates with the exSat scoping (no BNRi contract exists yet)",
        ),
        (
            "chain-exsat-evm",
            "Farming,",
            "BnriFamily::Farming variant + uses — one coherent BNRi rename, with the exSat scoping \
             (likely landing word `Yield`: it is EVM yield-farming, not node ops or mining)",
        ),
        (
            "shared-types",
            "entered farming lock",
            "BNRi inscription event doc — renames with the exSat/BNRi vocabulary as a whole",
        ),
        (
            "shared-types",
            "left farming lock",
            "BNRi inscription event doc — renames with the exSat/BNRi vocabulary as a whole",
        ),
        (
            "shared-types",
            "Farming tickets accrued",
            "BNRi inscription event doc — renames with the exSat/BNRi vocabulary as a whole",
        ),
        (
            "shared-types",
            "/ farming / draw data",
            "BNRi event-family doc — renames with the exSat/BNRi vocabulary as a whole",
        ),
    ];

    fn crates_dir() -> PathBuf {
        // CARGO_MANIFEST_DIR = .../crates/vocabulary → parent = .../crates
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("crate has a parent dir")
            .to_path_buf()
    }

    fn collect(dir: &Path, self_dir: &Path, out: &mut Vec<PathBuf>) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                // skip build output and THIS crate (its source names the term to define it).
                if name == "target" || p == self_dir {
                    continue;
                }
                collect(&p, self_dir, out);
            } else {
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name.ends_with(".rs") || name == "Cargo.toml" {
                    out.push(p);
                }
            }
        }
    }

    #[test]
    fn kernel_sources_are_clean_except_the_declared_pending_worklist() {
        let root = crates_dir();
        let self_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let mut files = Vec::new();
        collect(&root, &self_dir, &mut files);
        assert!(
            files.len() > 15,
            "non-vacuous: expected to scan many crate files, scanned {}",
            files.len()
        );

        let mut pending_hits = vec![0usize; PENDING.len()];
        let mut unexpected: Vec<String> = Vec::new();

        for f in &files {
            let text = std::fs::read_to_string(f).unwrap_or_default();
            let rel = f.to_string_lossy().replace('\\', "/");
            for find in farming_findings(&text) {
                let matched = PENDING
                    .iter()
                    .enumerate()
                    .find(|(_, (fp, ls, _))| rel.contains(fp) && find.line.contains(ls));
                match matched {
                    Some((k, _)) => pending_hits[k] += 1,
                    None => unexpected.push(format!("{}:{}  {}", rel, find.line_no, find.line)),
                }
            }
        }

        assert!(
            unexpected.is_empty(),
            "unexpected bare use of the banned term — migrate to node ops/mining or grow \
             ops/cultivation, or (if genuinely deferred) add to PENDING:\n{}",
            unexpected.join("\n")
        );
        for (k, (fp, ls, _)) in PENDING.iter().enumerate() {
            assert!(
                pending_hits[k] > 0,
                "stale PENDING entry no longer matches any finding — it has been migrated, so \
                 remove it: [{fp}] {ls}"
            );
        }
    }
}
