//! The 24 recovery words in Rust (SPEC-BTUNGSTEN-PQ-1 PQ11). Until now only
//! the browser could read them (`surfaces/onboarding/bzdid-key.js`, over
//! @scure/bip39); bsigner took the bech32m `bdidrec1` code alone.
//!
//! BIP-39 over bpq-core's packing (`bpq_core::bip39`, SAW-proven a bijection
//! for any checksum hash), SHA-256 for the checksum, and the official English
//! list (`data/bip39-english.txt`, bitcoin/bips `ce1862ac6bcf`
//! bip-0039/english.txt, the same 2048 words as
//! `surfaces/onboarding/vendor/bip39-wordlist.js`; a test holds them equal).
//! The phrase is the masterPrk's encoding, so its 256 bits ARE the masterPrk
//! (SPEC-BPQ-1 §2), the same reading as bzdid-key.js `decodeRecoveryPhrase`.

use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use bpq_core::bip39::{decode_ok, unpack, WORDS};

const LIST: &str = include_str!("../data/bip39-english.txt");

fn list() -> Vec<&'static str> {
    LIST.lines().collect()
}

fn checksum(entropy: &[u8; 32]) -> u8 {
    Sha256::digest(entropy)[0]
}

/// The masterPrk 24 recovery words carry. Words are matched after trimming
/// and lowercasing, separated by any whitespace; the count, every word and the
/// checksum must hold.
pub fn master_prk_from_phrase(p: &str) -> Result<Zeroizing<[u8; 32]>, String> {
    let lower = Zeroizing::new(p.trim().to_lowercase());
    let given: Vec<&str> = lower.split_whitespace().collect();
    if given.len() != WORDS {
        return Err(format!(
            "a recovery phrase is exactly {WORDS} words, got {}",
            given.len()
        ));
    }
    let words = list();
    let mut idx = [0u16; WORDS];
    for (slot, w) in idx.iter_mut().zip(&given) {
        *slot = words
            .binary_search(w)
            .map_err(|_| "a word is not on the BIP-39 English list".to_string())?
            as u16;
    }
    let (entropy, _) = unpack(&idx);
    let entropy = Zeroizing::new(entropy);
    if !decode_ok(&idx, checksum(&entropy)) {
        return Err("the words fail their checksum: check each against the printed list".into());
    }
    Ok(entropy)
}

/// The masterPrk from what the owner holds: the `bdidrec1…` recovery code or
/// the 24 recovery words.
pub fn master_prk_from_recovery(s: &str) -> Result<Zeroizing<[u8; 32]>, String> {
    if s.trim().to_ascii_lowercase().starts_with("bdidrec1") {
        crate::bpq::master_prk_from_recovery_code(s).map_err(|e| e.to_string())
    } else {
        master_prk_from_phrase(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bpq_core::bip39::indices;

    // the encoder exists for these tests only: bsigner never prints the words
    /// The 24 words of a masterPrk, space-separated.
    pub fn phrase(master_prk: &[u8; 32]) -> Zeroizing<String> {
        let words = list();
        let idx = indices(master_prk, checksum(master_prk));
        Zeroizing::new(
            idx.iter()
                .map(|&i| words[i as usize])
                .collect::<Vec<_>>()
                .join(" "),
        )
    }

    #[test]
    fn the_list_is_the_browser_list() {
        let js = include_str!("../../../surfaces/onboarding/vendor/bip39-wordlist.js");
        let words = list();
        assert_eq!(words.len(), 2048);
        assert!(words.windows(2).all(|w| w[0] < w[1]), "sorted, so binary search holds");
        // the vendored JS carries the same words in the same order
        let mut at = 0;
        for w in &words {
            let quoted = format!("\"{w}\"");
            let pos = js[at..].find(&quoted).unwrap_or_else(|| panic!("{w} missing from the JS list"));
            at += pos + quoted.len();
        }
    }

    #[test]
    fn phrases_round_trip_and_refuse_a_bad_checksum() {
        for seed in [0u8, 1, 0x7f, 0xff] {
            let prk = [seed; 32];
            let p = phrase(&prk);
            assert_eq!(p.split(' ').count(), 24);
            assert_eq!(*master_prk_from_phrase(&p).unwrap(), prk);
            assert_eq!(*master_prk_from_phrase(&p.to_uppercase()).unwrap(), prk);
            assert_eq!(*master_prk_from_recovery(&format!("  {}\n", *p)).unwrap(), prk);
        }
        // BIP-39's all-zero 256-bit vector: 23 x abandon + art
        let zero = phrase(&[0u8; 32]);
        assert_eq!(*zero, format!("{}art", "abandon ".repeat(23)));
        // the next word after "art" keeps the entropy and moves the checksum
        // byte by one, so only the checksum can refuse it
        let next = list()[list().binary_search(&"art").unwrap() + 1];
        let wrong = format!("{}{next}", "abandon ".repeat(23));
        assert!(master_prk_from_phrase(&wrong).is_err(), "checksum");
        assert!(master_prk_from_phrase("abandon abandon").is_err(), "count");
        let typo = zero.replacen("abandon", "abandin", 1);
        assert!(master_prk_from_phrase(&typo).is_err(), "unknown word");
    }

    #[test]
    fn the_recovery_code_and_the_words_name_the_same_root() {
        let prk = [0x42u8; 32];
        let code = crate::bpq::recovery_code(&prk);
        assert_eq!(*master_prk_from_recovery(&code).unwrap(), prk);
        assert_eq!(*master_prk_from_recovery(&phrase(&prk)).unwrap(), prk);
    }
}
