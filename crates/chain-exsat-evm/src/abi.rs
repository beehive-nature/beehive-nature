//! EVM log decoding — **the verifiable half of this adapter.**
//!
//! Hand-rolled, following the `chain-eos` precedent (that crate hand-rolled
//! the SHIP codec rather than pull an SDK, and said why). The same reasoning
//! applies here and the Verification Principle demands it be stated rather
//! than assumed: `alloy` and `ethers` are full node-interaction stacks —
//! providers, signers, transports, contract codegen. This adapter needs one
//! frozen slice of the ABI specification: how a log's topics and data are
//! laid out. Pulling either crate would import a signing surface into a
//! read-only indexer, which is the opposite of what this crate is for.
//!
//! # The spec this file implements
//!
//! From the Solidity ABI specification, "Events" and "Formal Specification of
//! the Encoding" (cited as the spec it is — this is not a claim about any
//! exSat-specific behaviour; see the crate README):
//!
//! 1. For a **non-anonymous** event, `topics[0]` = `keccak256(signature)`,
//!    where the canonical signature is `EventName(type1,type2,...)`: canonical
//!    type names, comma-separated, no spaces, and **no `indexed` keyword** —
//!    indexedness is not part of the signature.
//! 2. Each **indexed** parameter occupies one of `topics[1..=3]`. A
//!    non-anonymous event therefore has at most 4 topics.
//! 3. **Non-indexed** parameters are ABI-encoded, in declaration order, into
//!    `data`.
//! 4. Value types (`uint<M>`, `int<M>`, `address`, `bool`, `bytes<M>`) each
//!    occupy exactly one 32-byte big-endian word.
//! 5. An indexed parameter of **dynamic** type (`string`, `bytes`, arrays,
//!    structs) stores `keccak256` of the encoded value in its topic, **not**
//!    the value. The value is not recoverable from the log.
//!
//! # What this decoder deliberately refuses
//!
//! Only rule-4 value types are decoded. A signature naming a dynamic type is
//! refused with [`AbiError::UnsupportedType`] rather than guessed at: dynamic
//! non-indexed parameters are encoded as head offsets plus a tail, so
//! `data.len() / 32` stops equalling the parameter count and the structural
//! arity check below would silently mean nothing. Refusing keeps the check
//! honest. This mirrors `chain-eos` Phase 1, which decodes exactly what it
//! needs and errors rather than guessing on structures it does not handle.

use sha3::{Digest, Keccak256};

/// One 32-byte ABI word.
pub type Word = [u8; 32];

/// Why a log could not be decoded. Every variant is a refusal, never a guess.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AbiError {
    /// A non-anonymous event log must carry `topics[0]`.
    MissingTopic0,
    /// `topics[0]` did not equal keccak256 of the signature it was matched to.
    Topic0Mismatch { expected: String, actual: String },
    /// More than 4 topics: topic0 + at most 3 indexed parameters (spec rule 2).
    TooManyTopics { count: usize },
    /// `data` is not a whole number of 32-byte words (spec rule 4).
    UnalignedData { len: usize },
    /// `(topics.len() - 1) + data.len()/32` did not equal the signature's
    /// parameter count. The log does not structurally fit the signature it
    /// was matched to, so decoding it would be fabrication.
    ArityMismatch {
        signature: String,
        params: usize,
        indexed: usize,
        data_words: usize,
    },
    /// The signature names a dynamic type this decoder refuses to guess at.
    UnsupportedType { signature: String, ty: String },
    /// The signature string is not `Name(type,...)`.
    MalformedSignature(String),
}

impl std::fmt::Display for AbiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AbiError::MissingTopic0 => write!(f, "log has no topic0"),
            AbiError::Topic0Mismatch { expected, actual } => {
                write!(f, "topic0 mismatch: expected {expected}, got {actual}")
            }
            AbiError::TooManyTopics { count } => {
                write!(f, "{count} topics: a non-anonymous event has at most 4")
            }
            AbiError::UnalignedData { len } => {
                write!(f, "data length {len} is not a multiple of 32")
            }
            AbiError::ArityMismatch {
                signature,
                params,
                indexed,
                data_words,
            } => write!(
                f,
                "{signature}: {params} params but log carries {indexed} indexed \
                 + {data_words} data words"
            ),
            AbiError::UnsupportedType { signature, ty } => write!(
                f,
                "{signature}: type `{ty}` is dynamic; this decoder refuses to guess"
            ),
            AbiError::MalformedSignature(s) => write!(f, "malformed signature: {s}"),
        }
    }
}

impl std::error::Error for AbiError {}

/// keccak256 — **original** Keccak padding, as the EVM uses.
///
/// Not NIST SHA3-256: the two use different padding and produce different
/// digests for the same input. `sha3::Keccak256` is the former.
pub fn keccak256(bytes: &[u8]) -> Word {
    let mut h = Keccak256::new();
    h.update(bytes);
    h.finalize().into()
}

/// `topics[0]` for a non-anonymous event with this canonical signature
/// (spec rule 1).
pub fn topic0_of(signature: &str) -> Word {
    keccak256(signature.as_bytes())
}

/// 0x-prefixed lowercase hex.
pub fn hex0x(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(2 + bytes.len() * 2);
    s.push_str("0x");
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// A canonical signature split into its name and parameter types.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedSignature<'a> {
    pub name: &'a str,
    pub params: Vec<&'a str>,
}

/// Parse `Name(type1,type2,...)`.
///
/// `Name()` parses to zero parameters — not one empty-string parameter.
pub fn parse_signature(signature: &str) -> Result<ParsedSignature<'_>, AbiError> {
    let malformed = || AbiError::MalformedSignature(signature.to_string());

    let open = signature.find('(').ok_or_else(malformed)?;
    if !signature.ends_with(')') {
        return Err(malformed());
    }
    let name = &signature[..open];
    if name.is_empty() {
        return Err(malformed());
    }
    let inner = &signature[open + 1..signature.len() - 1];

    // Nested parens would mean a tuple type, which is dynamic-capable and out
    // of this decoder's scope; reject rather than mis-split on the comma.
    if inner.contains('(') || inner.contains(')') {
        return Err(AbiError::UnsupportedType {
            signature: signature.to_string(),
            ty: inner.to_string(),
        });
    }

    let params: Vec<&str> = if inner.is_empty() {
        Vec::new()
    } else {
        inner.split(',').collect()
    };
    if params.iter().any(|p| p.is_empty()) {
        return Err(malformed());
    }
    Ok(ParsedSignature { name, params })
}

/// Whether `ty` is a value type occupying exactly one 32-byte word
/// (spec rule 4).
///
/// `uint`/`int` without a size are canonicalized to `uint256`/`int256` in a
/// signature, so the bare spellings are **not** accepted here: a signature
/// carrying them is not canonical, and its keccak256 would not be the real
/// topic0. Rejecting them surfaces the mistake instead of hashing a
/// non-canonical string.
pub fn is_static_value_type(ty: &str) -> bool {
    match ty {
        "address" | "bool" => return true,
        _ => {}
    }
    if let Some(bits) = ty.strip_prefix("uint").or_else(|| ty.strip_prefix("int")) {
        return matches!(
            bits.parse::<u32>(),
            Ok(n) if (8..=256).contains(&n) && n.is_multiple_of(8)
        );
    }
    if let Some(n) = ty.strip_prefix("bytes") {
        // bytes1..=bytes32 are static; bare `bytes` is dynamic and has no
        // suffix, so it falls through to false.
        return matches!(n.parse::<u32>(), Ok(n) if (1..=32).contains(&n));
    }
    false
}

/// A log's words, split as the ABI lays them out.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedLog {
    /// `topics[1..]` — the indexed parameters.
    pub indexed_words: Vec<Word>,
    /// `data` split into 32-byte words — the non-indexed parameters.
    pub data_words: Vec<Word>,
}

/// Decode one log against the signature it was matched to.
///
/// Checks, in order: topic count (rule 2), topic0 (rule 1), all parameter
/// types static (rule 4), data alignment, and structural arity. Any failure
/// is an error — a recognized event with a payload that does not fit its
/// signature is never decoded on a best-effort basis.
pub fn decode_log(topics: &[Word], data: &[u8], signature: &str) -> Result<DecodedLog, AbiError> {
    if topics.is_empty() {
        return Err(AbiError::MissingTopic0);
    }
    if topics.len() > 4 {
        return Err(AbiError::TooManyTopics {
            count: topics.len(),
        });
    }

    let expected_topic0 = topic0_of(signature);
    if topics[0] != expected_topic0 {
        return Err(AbiError::Topic0Mismatch {
            expected: hex0x(&expected_topic0),
            actual: hex0x(&topics[0]),
        });
    }

    let parsed = parse_signature(signature)?;
    for ty in &parsed.params {
        if !is_static_value_type(ty) {
            return Err(AbiError::UnsupportedType {
                signature: signature.to_string(),
                ty: (*ty).to_string(),
            });
        }
    }

    if !data.len().is_multiple_of(32) {
        return Err(AbiError::UnalignedData { len: data.len() });
    }

    let indexed = topics.len() - 1;
    let data_word_count = data.len() / 32;
    if indexed + data_word_count != parsed.params.len() {
        return Err(AbiError::ArityMismatch {
            signature: signature.to_string(),
            params: parsed.params.len(),
            indexed,
            data_words: data_word_count,
        });
    }

    let data_words = data
        .chunks_exact(32)
        .map(|c| {
            let mut w = [0u8; 32];
            w.copy_from_slice(c);
            w
        })
        .collect();

    Ok(DecodedLog {
        indexed_words: topics[1..].to_vec(),
        data_words,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // -- keccak256 known-answer vectors ------------------------------------
    //
    // These are the load-bearing tests for this file. They pin the hash
    // function and the signature->topic0 rule against values published
    // independently of this repo, which is what makes the DECODER verifiable
    // even while the BNRi signature table is not.

    #[test]
    fn keccak256_matches_published_empty_string_vector() {
        // The canonical Keccak-256 digest of the empty input. If this file
        // ever reached for sha3::Sha3_256 (NIST padding) instead, this test
        // is what would catch it.
        assert_eq!(
            hex0x(&keccak256(b"")),
            "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470" // PUBLIC-CONSTANT: keccak256 of the empty input
        );
    }

    #[test]
    fn topic0_matches_published_erc20_transfer_vector() {
        // ERC-20's `Transfer(address,address,uint256)` topic0 is the most
        // widely published topic0 in existence. Matching it demonstrates that
        // this crate's signature->topic0 derivation agrees with the published
        // value for *this* signature — without inventing a single BNRi
        // signature.
        //
        // What these three KATs demonstrate, exactly: agreement on three
        // published vectors. Not agreement on every signature — that would be
        // a claim about inputs no test here supplies, and it is contingent on
        // canonicalisation in any case (`is_static_value_type` rejects
        // non-canonical spellings like bare `uint` precisely because a
        // non-canonical string hashes to a topic0 nobody else derives). They
        // pin the hash function and the derivation rule against values
        // published independently of this repo; that is what makes the decoder
        // checkable while the BNRi signature table is not. Sound by
        // construction, not proven.
        assert_eq!(
            hex0x(&topic0_of("Transfer(address,address,uint256)")),
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" // PUBLIC-CONSTANT: ERC-20 Transfer topic0
        );
    }

    #[test]
    fn topic0_matches_published_erc20_approval_vector() {
        assert_eq!(
            hex0x(&topic0_of("Approval(address,address,uint256)")),
            "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925" // PUBLIC-CONSTANT: ERC-20 Approval topic0
        );
    }

    // -- signature parsing --------------------------------------------------

    #[test]
    fn parses_name_and_params() {
        let p = parse_signature("Transfer(address,address,uint256)").unwrap();
        assert_eq!(p.name, "Transfer");
        assert_eq!(p.params, vec!["address", "address", "uint256"]);
    }

    #[test]
    fn zero_arg_signature_has_no_params_not_one_empty_param() {
        let p = parse_signature("Paused()").unwrap();
        assert_eq!(p.name, "Paused");
        assert!(p.params.is_empty());
    }

    #[test]
    fn malformed_signatures_are_refused() {
        for bad in ["Transfer", "Transfer(address", "(address)", "T(address,)"] {
            assert!(
                matches!(
                    parse_signature(bad),
                    Err(AbiError::MalformedSignature(_)) | Err(AbiError::UnsupportedType { .. })
                ),
                "{bad} should not parse"
            );
        }
    }

    #[test]
    fn tuple_signature_is_refused_not_mis_split() {
        assert!(matches!(
            parse_signature("E((uint256,address))"),
            Err(AbiError::UnsupportedType { .. })
        ));
    }

    // -- type classification ------------------------------------------------

    #[test]
    fn static_value_types_are_recognized() {
        for ty in [
            "address", "bool", "uint8", "uint256", "int128", "int256", "bytes1", "bytes32",
        ] {
            assert!(is_static_value_type(ty), "{ty} is a static value type");
        }
    }

    #[test]
    fn dynamic_and_noncanonical_types_are_rejected() {
        for ty in [
            "string",
            "bytes",
            "uint256[]",
            "bytes33",
            "uint7",
            "uint0",
            "uint512",
            "",
            // Non-canonical: a canonical signature spells these uint256/int256.
            // Hashing them would produce a topic0 no contract ever emits.
            "uint",
            "int",
        ] {
            assert!(!is_static_value_type(ty), "{ty} must not be static");
        }
    }

    // -- decode -------------------------------------------------------------

    const SIG: &str = "Transfer(address,address,uint256)";

    fn word(n: u8) -> Word {
        let mut w = [0u8; 32];
        w[31] = n;
        w
    }

    #[test]
    fn decodes_indexed_and_data_words() {
        // Two indexed params in topics[1..=2], one non-indexed in data.
        let topics = vec![topic0_of(SIG), word(1), word(2)];
        let data = word(42).to_vec();
        let d = decode_log(&topics, &data, SIG).unwrap();
        assert_eq!(d.indexed_words, vec![word(1), word(2)]);
        assert_eq!(d.data_words, vec![word(42)]);
    }

    #[test]
    fn decodes_fully_non_indexed_event() {
        let topics = vec![topic0_of(SIG)];
        let mut data = Vec::new();
        data.extend_from_slice(&word(1));
        data.extend_from_slice(&word(2));
        data.extend_from_slice(&word(3));
        let d = decode_log(&topics, &data, SIG).unwrap();
        assert!(d.indexed_words.is_empty());
        assert_eq!(d.data_words.len(), 3);
    }

    #[test]
    fn wrong_topic0_is_refused() {
        let topics = vec![word(9), word(1), word(2)];
        let err = decode_log(&topics, &word(42), SIG).unwrap_err();
        assert!(matches!(err, AbiError::Topic0Mismatch { .. }));
    }

    #[test]
    fn missing_topic0_is_refused() {
        assert_eq!(
            decode_log(&[], &[], SIG).unwrap_err(),
            AbiError::MissingTopic0
        );
    }

    #[test]
    fn more_than_four_topics_is_refused() {
        let topics = vec![topic0_of(SIG), word(1), word(2), word(3), word(4)];
        assert_eq!(
            decode_log(&topics, &[], SIG).unwrap_err(),
            AbiError::TooManyTopics { count: 5 }
        );
    }

    #[test]
    fn unaligned_data_is_refused() {
        let topics = vec![topic0_of(SIG), word(1), word(2)];
        let err = decode_log(&topics, &[0u8; 31], SIG).unwrap_err();
        assert_eq!(err, AbiError::UnalignedData { len: 31 });
    }

    #[test]
    fn arity_mismatch_is_refused_not_padded() {
        // Signature says 3 params; log carries 2 indexed + 0 data = 2.
        // A best-effort decoder would zero-fill. This one refuses.
        let topics = vec![topic0_of(SIG), word(1), word(2)];
        let err = decode_log(&topics, &[], SIG).unwrap_err();
        assert!(matches!(
            err,
            AbiError::ArityMismatch {
                params: 3,
                indexed: 2,
                data_words: 0,
                ..
            }
        ));
    }

    #[test]
    fn extra_data_words_are_refused_not_ignored() {
        let topics = vec![topic0_of(SIG), word(1), word(2)];
        let mut data = Vec::new();
        data.extend_from_slice(&word(42));
        data.extend_from_slice(&word(43)); // one word too many
        let err = decode_log(&topics, &data, SIG).unwrap_err();
        assert!(matches!(err, AbiError::ArityMismatch { data_words: 2, .. }));
    }

    #[test]
    fn dynamic_type_in_signature_is_refused() {
        const DYN: &str = "Note(address,string)";
        let topics = vec![topic0_of(DYN), word(1)];
        let err = decode_log(&topics, &word(0), DYN).unwrap_err();
        assert!(matches!(
            err,
            AbiError::UnsupportedType { ref ty, .. } if ty == "string"
        ));
    }

    #[test]
    fn hex0x_is_lowercase_and_prefixed() {
        assert_eq!(hex0x(&[0xDE, 0xAD, 0xBE, 0xEF]), "0xdeadbeef");
        assert_eq!(hex0x(&[]), "0x");
    }
}
