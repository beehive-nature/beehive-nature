//! ALGORITHM REGISTRY — the crypto-agility law, made of code.
//!
//! "Every signature and hash carries an algorithm identifier — nothing
//! hardcoded, so the estate can migrate for 1000 years." The registry maps
//! stable string ids to parameter sets; every envelope written by this organ
//! names its algorithms with these ids; every verification dispatches on the
//! id it READS, never on a default. An unknown id is a hard error, because a
//! migration the verifier can't name is a forgery it can't catch.

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SigAlg {
    MlDsa44,
    MlDsa65,
    MlDsa87,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KemAlg {
    MlKem512,
    MlKem768,
    MlKem1024,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HashAlg {
    Sha3256,
}

impl SigAlg {
    pub fn id(self) -> &'static str {
        match self {
            SigAlg::MlDsa44 => "ml-dsa-44",
            SigAlg::MlDsa65 => "ml-dsa-65",
            SigAlg::MlDsa87 => "ml-dsa-87",
        }
    }
    pub fn parse(id: &str) -> Result<Self, String> {
        match id {
            "ml-dsa-44" => Ok(SigAlg::MlDsa44),
            "ml-dsa-65" => Ok(SigAlg::MlDsa65),
            "ml-dsa-87" => Ok(SigAlg::MlDsa87),
            other => Err(format!("crypto-agility: unknown signature algorithm id {other:?} — refuse rather than guess")),
        }
    }
}

impl KemAlg {
    pub fn id(self) -> &'static str {
        match self {
            KemAlg::MlKem512 => "ml-kem-512",
            KemAlg::MlKem768 => "ml-kem-768",
            KemAlg::MlKem1024 => "ml-kem-1024",
        }
    }
    pub fn parse(id: &str) -> Result<Self, String> {
        match id {
            "ml-kem-512" => Ok(KemAlg::MlKem512),
            "ml-kem-768" => Ok(KemAlg::MlKem768),
            "ml-kem-1024" => Ok(KemAlg::MlKem1024),
            other => Err(format!(
                "crypto-agility: unknown kem algorithm id {other:?} — refuse rather than guess"
            )),
        }
    }
}

impl HashAlg {
    pub fn id(self) -> &'static str {
        match self {
            HashAlg::Sha3256 => "sha3-256",
        }
    }
    pub fn parse(id: &str) -> Result<Self, String> {
        match id {
            "sha3-256" => Ok(HashAlg::Sha3256),
            other => Err(format!(
                "crypto-agility: unknown hash algorithm id {other:?} — refuse rather than guess"
            )),
        }
    }
}

impl fmt::Display for SigAlg {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.id())
    }
}
impl fmt::Display for KemAlg {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.id())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_roundtrip() {
        for alg in [SigAlg::MlDsa44, SigAlg::MlDsa65, SigAlg::MlDsa87] {
            assert_eq!(SigAlg::parse(alg.id()).unwrap(), alg);
        }
        for alg in [KemAlg::MlKem512, KemAlg::MlKem768, KemAlg::MlKem1024] {
            assert_eq!(KemAlg::parse(alg.id()).unwrap(), alg);
        }
        assert_eq!(HashAlg::parse("sha3-256").unwrap(), HashAlg::Sha3256);
    }

    #[test]
    fn unknown_ids_are_hard_errors() {
        // the 1000-year migration test: an id this build has never heard of
        // (a future algorithm) is REFUSED, never defaulted, never guessed
        assert!(SigAlg::parse("ml-dsa-65-hedged").is_err());
        assert!(SigAlg::parse("slh-dsa-128s").is_err());
        assert!(KemAlg::parse("ml-kem-768-x").is_err());
        assert!(HashAlg::parse("sha3-512").is_err());
    }
}
