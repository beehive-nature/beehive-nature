//! Antelope names and permission levels, exactly as the chain normalizes and
//! orders them.
//!
//! `name::set` (Spring v1.2.2 `libraries/chain/name.cpp:9-16`) accepts a
//! string only when it is at most 13 characters AND round-trips through
//! `to_string` unchanged. `to_string` (`name.cpp:19-33`) decodes 5-bit symbols
//! from the charmap `.12345abcdefghijklmnopqrstuvwxyz` (the 13th character
//! from its first 16 entries, `name.hpp:37-38`) and trims trailing dots — so
//! an out-of-charset character (which `char_to_symbol`, `name.hpp:16-22`, maps
//! silently to `.`) or a trailing dot fails normalization. Ordering is by the
//! encoded `u64` (`name.hpp:24-40`), never by the text.

use std::cmp::Ordering;
use std::fmt;

/// `name.cpp:20` — the symbol alphabet, index = 5-bit symbol value.
pub const CHARMAP: &[u8; 32] = b".12345abcdefghijklmnopqrstuvwxyz";

/// `name.cpp:11` — the longest string `name::set` accepts.
pub const MAX_LEN: usize = 13;

/// Why a string is not a name. Every arm is a `name_type_exception` on the
/// chain (`name.cpp:11,13`); the model names which rule refused.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum NameError {
    /// longer than 13 characters (`name.cpp:11`)
    TooLong,
    /// a character outside `.12345a-z` (`name.hpp:16-22` maps it to `.`, so
    /// `to_string() == str` fails at `name.cpp:13`)
    BadChar,
    /// a 13th character past `j` (only 4 bits are stored, `name.hpp:38`)
    ThirteenthChar,
    /// a trailing dot (`to_string` trims it, `name.cpp:31`, so normalization fails)
    TrailingDot,
}

impl fmt::Display for NameError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            NameError::TooLong => "name:too-long",
            NameError::BadChar => "name:bad-char",
            NameError::ThirteenthChar => "name:thirteenth-char",
            NameError::TrailingDot => "name:trailing-dot",
        })
    }
}

/// `name.hpp:16-22`.
pub const fn char_to_symbol(c: u8) -> u64 {
    if c >= b'a' && c <= b'z' {
        return (c - b'a') as u64 + 6;
    }
    if c >= b'1' && c <= b'5' {
        return (c - b'1') as u64 + 1;
    }
    0
}

/// `name.hpp:24-40` — the encoding every ordering in this crate is defined by.
pub fn string_to_u64(s: &str) -> u64 {
    let b = s.as_bytes();
    let mut n: u64 = 0;
    let mut i = 0;
    while i < b.len() && i < 12 {
        n |= (char_to_symbol(b[i]) & 0x1f) << (64 - 5 * (i + 1));
        i += 1;
    }
    if i < b.len() && i == 12 {
        n |= char_to_symbol(b[12]) & 0x0f;
    }
    n
}

/// A normalized Antelope name. The empty name is a value (`name()`), used by
/// the chain as the "any permission of this actor" cache key
/// (`authority_checker.hpp:140`) and the contract-wide link key
/// (`authorization_manager.cpp:289`).
#[derive(Clone, PartialEq, Eq, Hash)]
pub struct Name {
    text: String,
    value: u64,
}

impl Name {
    /// `name::set` — refuse everything the chain refuses, for the named reason.
    pub fn parse(s: &str) -> Result<Name, NameError> {
        if s.len() > MAX_LEN {
            return Err(NameError::TooLong);
        }
        for (i, &c) in s.as_bytes().iter().enumerate() {
            let idx = CHARMAP
                .iter()
                .position(|&m| m == c)
                .ok_or(NameError::BadChar)?;
            if i == 12 && idx >= 16 {
                return Err(NameError::ThirteenthChar);
            }
        }
        if s.ends_with('.') {
            return Err(NameError::TrailingDot);
        }
        Ok(Name {
            text: s.to_string(),
            value: string_to_u64(s),
        })
    }

    /// The empty name (`name()`), `value == 0`.
    pub fn empty() -> Name {
        Name {
            text: String::new(),
            value: 0,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.text.is_empty()
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }

    /// The chain's `uint64_t` for this name.
    pub fn value(&self) -> u64 {
        self.value
    }
}

impl PartialOrd for Name {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Name {
    fn cmp(&self, other: &Self) -> Ordering {
        self.value.cmp(&other.value)
    }
}

impl fmt::Debug for Name {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.text)
    }
}

impl fmt::Display for Name {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.text)
    }
}

/// A test-corpus convenience: parse or panic with the named rule. Vectors
/// are literals; a typo in a vector must fail the corpus, not be normalized.
pub fn n(s: &str) -> Name {
    match Name::parse(s) {
        Ok(v) => v,
        Err(e) => panic!("{s:?} is not a name: {e}"),
    }
}

/// `actor@permission` — the identity every cache entry, every delegation edge
/// and every declared authorization is keyed by (`authority.hpp:80-91`,
/// `authority_checker.hpp:70`). Ordered by (actor, permission) in the chain's
/// `u64` order, which is the order `check_authorization` traverses declared
/// authorizations (`authorization_manager.cpp:562-564`).
#[derive(Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct PermissionLevel {
    pub actor: Name,
    pub permission: Name,
}

impl PermissionLevel {
    pub fn new(actor: Name, permission: Name) -> PermissionLevel {
        PermissionLevel { actor, permission }
    }

    /// Corpus convenience over literals.
    pub fn of(actor: &str, permission: &str) -> PermissionLevel {
        PermissionLevel::new(n(actor), n(permission))
    }

    /// `{actor, name()}` — the wildcard form `permission_status_in_cache`
    /// consults second (`authority_checker.hpp:140`).
    pub fn any_of(actor: &Name) -> PermissionLevel {
        PermissionLevel::new(actor.clone(), Name::empty())
    }
}

impl fmt::Debug for PermissionLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}@{}", self.actor, self.permission)
    }
}

impl fmt::Display for PermissionLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}@{}", self.actor, self.permission)
    }
}
