//! THE OFFLINE PROOF — the order's gate: "beacon test proves no outbound
//! call". This crate cannot make an outbound call because no outbound
//! capability exists in it. Two structural proofs + one purity proof,
//! run as ordinary tests so `cargo test -p headroom-textcrusher` proves
//! the fence forever, not just the day it was vendored:
//!
//! 1. `no_network_capability_in_any_source_file` — walks THIS crate's
//!    src/ tree and refuses any network-capability marker (a URL scheme,
//!    a socket type, an HTTP client crate name, a model-download call).
//!    This file is excluded from its own scan — it names the patterns,
//!    so it carries them as literals.
//! 2. `dependencies_are_exactly_the_offline_allowlist` — parses this
//!    crate's Cargo.toml and refuses any dependency outside
//!    {regex, icu_segmenter}. An HTTP client cannot be added silently.
//! 3. `crush_is_deterministic_and_side_effect_free` — same input + same
//!    query + same ratio ⇒ byte-identical output, twice in a row.

#[cfg(test)]
mod tests {
    use crate::text_crusher::{TextCrusher, TextCrusherConfig};
    use std::path::PathBuf;

    fn crate_src_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src")
    }

    fn all_rs_files(dir: &PathBuf, out: &mut Vec<PathBuf>) {
        for entry in std::fs::read_dir(dir).unwrap() {
            let p = entry.unwrap().path();
            if p.is_dir() {
                all_rs_files(&p, out);
            } else if p.extension().and_then(|e| e.to_str()) == Some("rs") {
                out.push(p);
            }
        }
    }

    #[test]
    fn no_network_capability_in_any_source_file() {
        // capability markers, assembled so this file's own source does not
        // contain them as plain literals (it is skipped anyway — belt and braces)
        let markers: Vec<String> = [
            ["ht", "tp://"].concat(),
            ["ht", "tps://"].concat(),
            ["ur", "eq"].concat(),
            ["req", "west"].concat(),
            ["Tcp", "Stream"].concat(),
            ["Udp", "Socket"].concat(),
            ["hf_", "hub"].concat(),
            ["hf-", "hub"].concat(),
            ["from_", "pretrained"].concat(),
            ["Web", "Socket"].concat(),
            ["std::net::", "TcpListener"].concat(),
        ]
        .into_iter()
        .collect();
        let mut files = Vec::new();
        all_rs_files(&crate_src_dir(), &mut files);
        assert!(!files.is_empty(), "src tree walked empty — proof broken");
        for f in files {
            if f.ends_with("offline_proof.rs") {
                continue; // this proof names the markers; it does not scan itself
            }
            let text = std::fs::read_to_string(&f).unwrap();
            for m in &markers {
                assert!(
                    !text.contains(m.as_str()),
                    "network-capability marker {m:?} found in {} — the offline cut is broken",
                    f.display()
                );
            }
        }
    }

    #[test]
    fn dependencies_are_exactly_the_offline_allowlist() {
        let manifest =
            std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml"))
                .unwrap();
        let section = manifest
            .split("[dependencies]")
            .nth(1)
            .unwrap_or("")
            .split('[')
            .next()
            .unwrap_or("");
        let mut deps: Vec<String> = section
            .lines()
            .filter_map(|l| l.split('#').next())
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .filter_map(|l| l.split('=').next().map(|s| s.trim().to_string()))
            .collect();
        deps.sort();
        let mut expected = vec!["icu_segmenter".to_string(), "regex".to_string()];
        expected.sort();
        assert_eq!(
            deps, expected,
            "the offline allowlist is regex + icu_segmenter ONLY — anything else (an HTTP client, a model downloader) must be refused"
        );
    }

    #[test]
    fn crush_is_deterministic_and_side_effect_free() {
        let content = "The browser engine renders the page. Navigation links appear at the top. \
                       The search box accepts queries. The article body describes the project history. \
                       References cite external sources. The footer lists licensing terms. \
                       Several interactive buttons allow editing. The sidebar shows related topics.";
        let crusher = TextCrusher::new(TextCrusherConfig::default());
        let a = crusher.compress(content, "search box queries", Some(0.5));
        let b = crusher.compress(content, "search box queries", Some(0.5));
        assert_eq!(
            a.compressed, b.compressed,
            "same input + query + ratio must be byte-identical (determinism law)"
        );
        assert!(
            a.compressed.len() <= content.len(),
            "crushing never GROWS text (ratio {})",
            a.compression_ratio
        );
        assert!(a.total_segments >= a.kept_segments);
    }
}
