//! The authority structure and its validation (`authority.hpp`).
//!
//! An authority is a threshold over weighted keys, weighted account
//! permissions and weighted waits (`authority.hpp:180-206`). The chain
//! accepts one only when `validate` holds (`authority.hpp:308-353`): a
//! non-zero threshold, strictly ascending unique keys, strictly ascending
//! unique account permissions, strictly ascending waits none of which is
//! zero, at most 2^16 entries in total, and a total weight that can reach
//! the threshold.

use crate::name::PermissionLevel;
use std::fmt;

/// `weight_type` is `uint16_t` (`authority.hpp:313`).
pub type Weight = u16;

/// A public key as the model sees it: an opaque, comparable token. This
/// crate is keyless by construction: it never parses, derives, signs or
/// verifies; a key is only ever compared for equality with a provided key
/// (`authority_checker.hpp:213`). MODEL ORDER: keys sort by their text. The
/// chain sorts `public_key_type` by its binary form (`authority.hpp:328`);
/// equivalence of the two orders is NOT claimed, only that the rule
/// "strictly ascending, unique" in `validate` is enforced over SOME total
/// order.
#[derive(Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Key(pub String);

impl Key {
    pub fn new(text: &str) -> Key {
        Key(text.to_string())
    }
}

impl fmt::Debug for Key {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.0)
    }
}

/// `authority.hpp:95-98`.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct KeyWeight {
    pub key: Key,
    pub weight: Weight,
}

/// `authority.hpp:80-82`.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct PermissionLevelWeight {
    pub permission: PermissionLevel,
    pub weight: Weight,
}

/// `authority.hpp:148-150`.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct WaitWeight {
    pub wait_sec: u32,
    pub weight: Weight,
}

/// `authority.hpp:180-206`.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Authority {
    pub threshold: u32,
    pub keys: Vec<KeyWeight>,
    pub accounts: Vec<PermissionLevelWeight>,
    pub waits: Vec<WaitWeight>,
}

/// Why `validate` refused (`authority.hpp:309-353`), named per rule.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum AuthorityError {
    /// more than 2^16 entries (`:319-320`)
    TooManyEntries,
    /// `threshold == 0` (`:322-323`)
    ZeroThreshold,
    /// keys not strictly ascending (`:328`)
    KeysUnsorted,
    /// account permissions not strictly ascending (`:336`)
    AccountsUnsorted,
    /// first wait is zero (`:343-344`)
    ZeroWait,
    /// waits not strictly ascending (`:346`)
    WaitsUnsorted,
    /// total weight below the threshold (`:352`)
    Unreachable,
}

impl fmt::Display for AuthorityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            AuthorityError::TooManyEntries => "authority:too-many-entries",
            AuthorityError::ZeroThreshold => "authority:zero-threshold",
            AuthorityError::KeysUnsorted => "authority:keys-unsorted",
            AuthorityError::AccountsUnsorted => "authority:accounts-unsorted",
            AuthorityError::ZeroWait => "authority:zero-wait",
            AuthorityError::WaitsUnsorted => "authority:waits-unsorted",
            AuthorityError::Unreachable => "authority:unreachable",
        })
    }
}

impl Authority {
    /// `authority(const public_key_type&)` (`authority.hpp:181-182`).
    pub fn key(k: Key) -> Authority {
        Authority {
            threshold: 1,
            keys: vec![KeyWeight { key: k, weight: 1 }],
            accounts: vec![],
            waits: vec![],
        }
    }

    /// `authority(const permission_level&)` (`authority.hpp:190-191`).
    pub fn account(p: PermissionLevel) -> Authority {
        Authority {
            threshold: 1,
            keys: vec![],
            accounts: vec![PermissionLevelWeight {
                permission: p,
                weight: 1,
            }],
            waits: vec![],
        }
    }

    /// `authority(uint32_t, keys, accounts, waits)` (`authority.hpp:199-200`).
    pub fn new(
        threshold: u32,
        keys: Vec<KeyWeight>,
        accounts: Vec<PermissionLevelWeight>,
        waits: Vec<WaitWeight>,
    ) -> Authority {
        Authority {
            threshold,
            keys,
            accounts,
            waits,
        }
    }

    /// `authority.hpp:309-353`, rule by rule, in the order the chain checks.
    pub fn validate(&self) -> Result<(), AuthorityError> {
        if self.keys.len() + self.accounts.len() + self.waits.len() > (1 << 16) {
            return Err(AuthorityError::TooManyEntries);
        }
        if self.threshold == 0 {
            return Err(AuthorityError::ZeroThreshold);
        }
        let mut total: u32 = 0;
        let mut prev: Option<&KeyWeight> = None;
        for k in &self.keys {
            if let Some(p) = prev {
                if !(p.key < k.key) {
                    return Err(AuthorityError::KeysUnsorted);
                }
            }
            total += k.weight as u32;
            prev = Some(k);
        }
        let mut prev: Option<&PermissionLevelWeight> = None;
        for a in &self.accounts {
            if let Some(p) = prev {
                if p.permission >= a.permission {
                    return Err(AuthorityError::AccountsUnsorted);
                }
            }
            total += a.weight as u32;
            prev = Some(a);
        }
        if let Some(first) = self.waits.first() {
            if first.wait_sec == 0 {
                return Err(AuthorityError::ZeroWait);
            }
        }
        let mut prev: Option<&WaitWeight> = None;
        for w in &self.waits {
            if let Some(p) = prev {
                if p.wait_sec >= w.wait_sec {
                    return Err(AuthorityError::WaitsUnsorted);
                }
            }
            total += w.weight as u32;
            prev = Some(w);
        }
        if total >= self.threshold {
            Ok(())
        } else {
            Err(AuthorityError::Unreachable)
        }
    }
}
