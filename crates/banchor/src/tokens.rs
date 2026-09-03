//! TOKEN COUNTING — the receipt number of Milestone 1.
//!
//! "Report the snapshot's token count. That number decides whether a local
//! model can carry Agent Mode." One number, three honest measurements, every
//! one labeled with its algorithm id (crypto-agility law applies to tokenizers
//! too — a count without its tokenizer named is not a receipt):
//!
//! - `bytes`        — the raw size of the formatted snapshot,
//! - `whitespace`   — whitespace-split words (dumbest possible count),
//! - `cl100k_base`  — OpenAI BPE (tiktoken-rs 0.12, ranks embedded, offline),
//! - `r50k_base`    — GPT-2-generation BPE, the closer structural cousin of
//!                    Qwen2.5's 151k byte-level BPE.
//!
//! HONESTY NOTE, carried in every receipt: none of these IS the qwen2.5
//! tokenizer. They bracket it. Exact-qwen counting happens on the compute
//! lane (estate iron runs qwen2.5-3b via llama.cpp); until that wiring
//! exists, r50k is the conservative upper bound of the bracket and cl100k
//! the tighter lower one for English UI text.

use std::sync::OnceLock;
use tiktoken_rs::CoreBPE;

static CL100K: OnceLock<CoreBPE> = OnceLock::new();
static R50K: OnceLock<CoreBPE> = OnceLock::new();

fn cl100k() -> &'static CoreBPE {
    CL100K.get_or_init(|| tiktoken_rs::cl100k_base().expect("cl100k_base is embedded"))
}

fn r50k() -> &'static CoreBPE {
    R50K.get_or_init(|| tiktoken_rs::r50k_base().expect("r50k_base is embedded"))
}

/// Counts of one text. All fields public; serialize through [`Counts::to_json`]
/// so algorithm ids travel with the numbers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Counts {
    pub bytes: usize,
    pub words: usize,
    pub cl100k: usize,
    pub r50k: usize,
}

pub fn count(text: &str) -> Counts {
    Counts {
        bytes: text.as_bytes().len(),
        words: text.split_whitespace().count(),
        cl100k: cl100k().encode_ordinary(text).len(),
        r50k: r50k().encode_ordinary(text).len(),
    }
}

impl Counts {
    /// Every count carries its algorithm id. Nothing bare.
    pub fn to_json(self) -> serde_json::Value {
        serde_json::json!({
            "bytes": self.bytes,
            "tokens": [
                { "alg": "whitespace", "n": self.words },
                { "alg": "cl100k_base", "n": self.cl100k },
                { "alg": "r50k_base", "n": self.r50k },
            ],
            "qwen_note": "bracket, not exact: qwen2.5 tokenizer count lands near r50k for English UI text; exact count is a compute-lane follow-up"
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_text_is_zero_everywhere() {
        let c = count("");
        assert_eq!((c.bytes, c.words, c.cl100k, c.r50k), (0, 0, 0, 0));
    }

    #[test]
    fn english_text_brackets_sane() {
        let text =
            "- heading \"Example Domain\" [level=1]\n- link \"More information...\" [ref=@e1]";
        let c = count(text);
        assert!(c.cl100k >= 8, "cl100k suspiciously low: {c:?}");
        // r50k is a coarser merge table than cl100k for English
        assert!(
            c.r50k >= c.cl100k,
            "r50k < cl100k breaks the bracket: {c:?}"
        );
        assert!(c.words <= c.r50k);
        assert!(c.bytes > c.r50k);
    }

    #[test]
    fn counts_are_deterministic() {
        let t = "the quick brown accessibility tree jumps over the lazy vision model";
        assert_eq!(count(t), count(t));
    }

    #[test]
    fn json_carries_alg_ids() {
        let j = count("hello world").to_json();
        let s = j.to_string();
        assert!(s.contains("\"cl100k_base\""));
        assert!(s.contains("\"r50k_base\""));
        assert!(s.contains("\"whitespace\""));
    }
}
