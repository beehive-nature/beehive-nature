//! bnr-url — the `bnr://` URL scheme: parse, normalize, validate.
//!
//! Built to ORDER cC (SPRINT-2026-08-23-N). Every rule enforced here is either
//! ruled in that order or read out of a named source. Nothing is invented.
//!
//! # Ruled by ORDER cC (founder, 2026-08-23)
//!
//! - Canonical scheme is `bnr`. The address form is NAME-FIRST: `bnr://alice.b`.
//! - Schemes are case-insensitive and lowercase-normalized: `BNR://` === `bnr://`.
//! - `b://` is rejected — it collides with a Windows drive letter.
//! - Web surfaces can only ever register `web+bnr`; a bare `bnr://` needs native
//!   OS registration. Both spellings parse; `web+bnr` normalizes to `bnr`.
//! - `bee`, `bsafe`, `bnri` and `bn` are rejected aliases and are NOT implemented.
//! - Rail resolution is out of scope. [`ResolveBName`] is a seam with no
//!   implementation in this crate, and there is no network code in this file.
//!
//! # Where the label law comes from (LAW 8a — crate + ref on every source claim)
//!
//! The label grammar is not this crate's invention. It mirrors, exactly, the
//! validator the deployed `.b` registry runs today.
//!
//! `b-domain @ 7f2be7f`, `contract/bdomain.cpp:28-38` (`bdomain::is_valid_name`):
//! 1 to 32 characters; each one of `a-z`, `0-9`, or `-`; a `-` may be neither
//! first nor last; the sequence `--` is refused anywhere in the name.
//!
//! `b-domain @ 7f2be7f`, `contract/bdomain.cpp:41-49` (`bdomain::to_lower`) folds
//! ASCII `A-Z` only and passes every other byte through unchanged;
//! `contract/bdomain.cpp:55` applies it BEFORE validation. This crate folds over
//! the same range, in the same order, so that a name this parser accepts is a
//! name the registry would accept.
//!
//! Component splitting (authority / path / query / fragment) follows
//! `RFC 3986 §3.2-3.5`: the fragment is split off first because it runs to the
//! end of the URI, then the query, then what remains is the path.
//!
//! # One label, never two
//!
//! `bnr://pay.alice.b` is REJECTED. `b-domain @ 7f2be7f`,
//! `docs/UNICODE-NAMING-1.md` §6.3 records the 2022 ENS separator attack
//! ($15,000 bounty): a flat label containing a dot rendered as a subdomain of a
//! name its registrant did not own, because the label/separator boundary was
//! enforced in a renderer instead of in the validator. `.b` has no subdomains.
//! The boundary is enforced here, in the validator, and nowhere downstream.
//!
//! # Non-ASCII is rejected, and the script classifier only says WHY
//!
//! Every non-ASCII label is refused, because the registry refuses it
//! (`is_valid_name`, above). `b-domain @ 7f2be7f`, `docs/UNICODE-NAMING-1.md` is
//! the analysis of what opening that charset would cost. It is **DRAFT and
//! unratified**, its §7 item 0 is an open founder gate, and this crate therefore
//! implements none of it.
//!
//! [`Script`] and [`ParseError::MixedScriptLabel`] exist so that a rejection can
//! name its own reason. THEY ARE A DIAGNOSTIC ON A PATH THAT IS ALREADY CLOSED.
//! The classifier never admits a codepoint the ASCII rule would have refused, it
//! is deliberately coarse, and it is NOT a security control. Do not build one on
//! it: the reject model that would be load-bearing is ENSIP-15, per
//! `docs/UNICODE-NAMING-1.md:106` ("ADOPT, DO NOT INVENT"), and it is not
//! written here.

use std::fmt;
use std::str::FromStr;

/// The canonical scheme. `web+bnr` normalizes to this; nothing else is accepted.
pub const CANONICAL_SCHEME: &str = "bnr";

/// The spelling a web surface is permitted to register (`registerProtocolHandler`
/// only accepts a `web+` prefixed custom scheme). Normalizes to [`CANONICAL_SCHEME`].
pub const WEB_SCHEME: &str = "web+bnr";

/// The only namespace this scheme resolves in.
pub const NAMESPACE_SUFFIX: &str = ".b";

/// Maximum label length. `b-domain @ 7f2be7f`, `contract/bdomain.cpp:29`.
pub const MAX_LABEL_LEN: usize = 32;

/// Scheme spellings ruled dead by ORDER cC. Kept as data so the parser can name
/// the ruling in its error instead of returning a generic "unknown scheme".
const REJECTED_ALIASES: [&str; 4] = ["bee", "bsafe", "bnri", "bn"];

// ── Errors ─────────────────────────────────────────────────────────

/// Every way an input can fail to be a `bnr://` URL. One variant per rejection
/// path — no catch-all, so a caller can react to each cause distinctly.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseError {
    /// The input was empty.
    Empty,
    /// The input had leading or trailing whitespace. Not trimmed: a URL that
    /// needs trimming was mis-handled by whatever produced it.
    SurroundingWhitespace,
    /// A C0, DEL or C1 control character anywhere in the input.
    ControlCharacter { at: usize, codepoint: u32 },
    /// A zero-width or bidi-format character anywhere in the input. Named
    /// separately from a control character because this is the ENS
    /// zero-width-insertion class (`b-domain @ 7f2be7f`,
    /// `docs/UNICODE-NAMING-1.md` §6.1), not a stray byte.
    InvisibleCharacter { at: usize, codepoint: u32 },
    /// No `:` at all, so there is no scheme.
    MissingSchemeDelimiter,
    /// `b://` — ruled dead by ORDER cC: it collides with a Windows drive letter.
    DriveLetterScheme,
    /// One of the aliases ORDER cC ruled dead and forbade implementing.
    RejectedAlias { alias: String },
    /// Some other scheme entirely.
    UnknownScheme { found: String },
    /// The scheme was fine but `//` did not follow it.
    MissingAuthorityMarker,
    /// `bnr://` with nothing after it.
    EmptyAuthority,
    /// `user:pass@` — credentials never travel in a name-first URL.
    EmbeddedCredentials,
    /// A bracketed IP literal. A rail resolves names, not addresses.
    IpLiteralNotPermitted,
    /// A `:port` was supplied. A `.b` name carries no port.
    PortNotPermitted,
    /// The authority does not end in `.b`.
    NotBNamespace { authority: String },
    /// More than one label before `.b` — see the separator attack in the module
    /// docs. `labels` counts every label including the `b`.
    SubdomainNotPermitted { labels: usize },
    /// `bnr://.b` — the `.b` was there but the name was not.
    EmptyLabel,
    /// `b-domain @ 7f2be7f`, `contract/bdomain.cpp:29`.
    LabelTooLong { len: usize, max: usize },
    /// A character outside `a-z0-9-` in the label.
    InvalidLabelCharacter { at: usize, ch: char },
    /// `b-domain @ 7f2be7f`, `contract/bdomain.cpp:33` — a `-` may not lead.
    LabelLeadingHyphen,
    /// `b-domain @ 7f2be7f`, `contract/bdomain.cpp:33` — a `-` may not trail.
    LabelTrailingHyphen,
    /// `b-domain @ 7f2be7f`, `contract/bdomain.cpp:36` — `--` is refused anywhere.
    LabelDoubleHyphen { at: usize },
    /// A non-ASCII label in a single identified script (or none). Rejected: the
    /// registry charset is ASCII today. See the module docs before "fixing" this.
    NonAsciiLabel {
        at: usize,
        codepoint: u32,
        script: Script,
    },
    /// Two different identified scripts in one label — the Latin/Cyrillic
    /// homograph shape. Rejected, and named, so the failure is legible.
    MixedScriptLabel { first: Script, second: Script },
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Empty => write!(f, "empty input"),
            Self::SurroundingWhitespace => write!(f, "leading or trailing whitespace"),
            Self::ControlCharacter { at, codepoint } => {
                write!(f, "control character U+{codepoint:04X} at byte {at}")
            }
            Self::InvisibleCharacter { at, codepoint } => {
                write!(f, "invisible character U+{codepoint:04X} at byte {at}")
            }
            Self::MissingSchemeDelimiter => write!(f, "no scheme: missing ':'"),
            Self::DriveLetterScheme => write!(
                f,
                "scheme 'b' is rejected: it collides with a Windows drive letter — use 'bnr'"
            ),
            Self::RejectedAlias { alias } => {
                write!(f, "scheme '{alias}' is a rejected alias — use 'bnr'")
            }
            Self::UnknownScheme { found } => {
                write!(f, "unknown scheme '{found}' — expected 'bnr' or 'web+bnr'")
            }
            Self::MissingAuthorityMarker => write!(f, "scheme must be followed by '//'"),
            Self::EmptyAuthority => write!(f, "no name after 'bnr://'"),
            Self::EmbeddedCredentials => write!(f, "embedded credentials are not permitted"),
            Self::IpLiteralNotPermitted => write!(f, "IP literals are not permitted; use a name"),
            Self::PortNotPermitted => write!(f, "a port is not permitted on a .b name"),
            Self::NotBNamespace { authority } => {
                write!(f, "'{authority}' is not in the .b namespace")
            }
            Self::SubdomainNotPermitted { labels } => write!(
                f,
                ".b has no subdomains: {labels} labels supplied, expected 2"
            ),
            Self::EmptyLabel => write!(f, "empty name before '.b'"),
            Self::LabelTooLong { len, max } => {
                write!(f, "name is {len} characters, maximum is {max}")
            }
            Self::InvalidLabelCharacter { at, ch } => {
                write!(
                    f,
                    "invalid character {ch:?} at position {at}; names are a-z 0-9 -"
                )
            }
            Self::LabelLeadingHyphen => write!(f, "a name may not begin with '-'"),
            Self::LabelTrailingHyphen => write!(f, "a name may not end with '-'"),
            Self::LabelDoubleHyphen { at } => write!(f, "'--' at position {at} is not permitted"),
            Self::NonAsciiLabel {
                at,
                codepoint,
                script,
            } => write!(
                f,
                "non-ASCII character U+{codepoint:04X} ({script}) at position {at}; \
                 the .b charset is ASCII today"
            ),
            Self::MixedScriptLabel { first, second } => write!(
                f,
                "name mixes {first} and {second} — refused as a homograph risk"
            ),
        }
    }
}

impl std::error::Error for ParseError {}

// ── Script classification ──────────────────────────────────────────

/// A deliberately coarse script bucket. Used ONLY to explain a rejection — read
/// the module docs before treating this as a gate. `Common` covers digits and
/// ASCII punctuation, which belong to no script; `Other` covers non-ASCII this
/// classifier does not identify.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Script {
    Common,
    Latin,
    Greek,
    Cyrillic,
    Armenian,
    Hebrew,
    Arabic,
    Devanagari,
    Han,
    Hiragana,
    Katakana,
    Hangul,
    Other,
}

impl Script {
    /// Bucket one character. Ranges are the primary blocks only; this is not a
    /// UAX-24 implementation and does not claim to be.
    pub fn of(ch: char) -> Self {
        if ch.is_ascii() {
            return if ch.is_ascii_alphabetic() {
                Self::Latin
            } else {
                Self::Common
            };
        }
        match ch as u32 {
            0x00C0..=0x024F | 0x1E00..=0x1EFF => Self::Latin,
            0x0370..=0x03FF | 0x1F00..=0x1FFF => Self::Greek,
            0x0400..=0x052F => Self::Cyrillic,
            0x0530..=0x058F => Self::Armenian,
            0x0590..=0x05FF => Self::Hebrew,
            0x0600..=0x06FF | 0x0750..=0x077F => Self::Arabic,
            0x0900..=0x097F => Self::Devanagari,
            0x1100..=0x11FF | 0xAC00..=0xD7AF => Self::Hangul,
            0x3040..=0x309F => Self::Hiragana,
            0x30A0..=0x30FF => Self::Katakana,
            0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF => Self::Han,
            _ => Self::Other,
        }
    }

    /// Whether this bucket names a script that can collide with another.
    /// `Common` and `Other` cannot: one is script-neutral, the other unidentified.
    fn is_identified(self) -> bool {
        !matches!(self, Self::Common | Self::Other)
    }
}

impl fmt::Display for Script {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match self {
            Self::Common => "Common",
            Self::Latin => "Latin",
            Self::Greek => "Greek",
            Self::Cyrillic => "Cyrillic",
            Self::Armenian => "Armenian",
            Self::Hebrew => "Hebrew",
            Self::Arabic => "Arabic",
            Self::Devanagari => "Devanagari",
            Self::Han => "Han",
            Self::Hiragana => "Hiragana",
            Self::Katakana => "Katakana",
            Self::Hangul => "Hangul",
            Self::Other => "unidentified script",
        };
        f.write_str(name)
    }
}

// ── The name ───────────────────────────────────────────────────────

/// A validated `.b` name. Constructing one is the only way to assert the label
/// law held, so every downstream type carries the proof by carrying this.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct BName {
    label: String,
}

impl BName {
    /// Parse a fully-qualified name such as `alice.b`. ASCII-folds first, then
    /// validates — the same order as `b-domain @ 7f2be7f`, `contract/bdomain.cpp:55`.
    pub fn parse_fqn(input: &str) -> Result<Self, ParseError> {
        let folded = input.to_ascii_lowercase();
        let Some(label) = folded.strip_suffix(NAMESPACE_SUFFIX) else {
            return Err(ParseError::NotBNamespace { authority: folded });
        };
        if label.contains('.') {
            return Err(ParseError::SubdomainNotPermitted {
                labels: label.split('.').count() + 1,
            });
        }
        validate_label(label)?;
        Ok(Self {
            label: label.to_string(),
        })
    }

    /// The registrable label, without the namespace suffix: `alice`.
    pub fn label(&self) -> &str {
        &self.label
    }

    /// The fully-qualified name: `alice.b`.
    pub fn fqn(&self) -> String {
        format!("{}{NAMESPACE_SUFFIX}", self.label)
    }
}

impl fmt::Display for BName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{NAMESPACE_SUFFIX}", self.label)
    }
}

/// Enforce the deployed registry's label law. `b-domain @ 7f2be7f`,
/// `contract/bdomain.cpp:28-38`. The script pass runs first only so that a
/// non-ASCII rejection can name its own cause; it changes nothing about WHICH
/// labels are accepted.
fn validate_label(label: &str) -> Result<(), ParseError> {
    if label.is_empty() {
        return Err(ParseError::EmptyLabel);
    }

    let len = label.chars().count();
    if len > MAX_LABEL_LEN {
        return Err(ParseError::LabelTooLong {
            len,
            max: MAX_LABEL_LEN,
        });
    }

    // Diagnostic pass over a path that is already closed — see the module docs.
    let mut identified: Option<Script> = None;
    let mut first_non_ascii: Option<(usize, char)> = None;
    for (at, ch) in label.char_indices() {
        if !ch.is_ascii() && first_non_ascii.is_none() {
            first_non_ascii = Some((at, ch));
        }
        let script = Script::of(ch);
        if !script.is_identified() {
            continue;
        }
        match identified {
            None => identified = Some(script),
            Some(seen) if seen != script => {
                return Err(ParseError::MixedScriptLabel {
                    first: seen,
                    second: script,
                })
            }
            Some(_) => {}
        }
    }
    if let Some((at, ch)) = first_non_ascii {
        return Err(ParseError::NonAsciiLabel {
            at,
            codepoint: ch as u32,
            script: Script::of(ch),
        });
    }

    // The charset law itself. Everything here is ASCII by the pass above.
    for (at, ch) in label.char_indices() {
        let permitted = ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-';
        if !permitted {
            return Err(ParseError::InvalidLabelCharacter { at, ch });
        }
    }
    if label.starts_with('-') {
        return Err(ParseError::LabelLeadingHyphen);
    }
    if label.ends_with('-') {
        return Err(ParseError::LabelTrailingHyphen);
    }
    if let Some(at) = label.find("--") {
        return Err(ParseError::LabelDoubleHyphen { at });
    }
    Ok(())
}

// ── The resolver seam ──────────────────────────────────────────────

/// What a rail is handed. Carries the parsed name and nothing else: a rail
/// resolves a NAME. Path, query and fragment stay on the [`BnrUrl`] and are the
/// caller's business, not the rail's.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ResolutionTarget {
    name: BName,
}

impl ResolutionTarget {
    pub fn new(name: BName) -> Self {
        Self { name }
    }

    pub fn name(&self) -> &BName {
        &self.name
    }

    pub fn label(&self) -> &str {
        self.name.label()
    }
}

impl From<BName> for ResolutionTarget {
    fn from(name: BName) -> Self {
        Self::new(name)
    }
}

impl fmt::Display for ResolutionTarget {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.name, f)
    }
}

/// The resolver seam.
///
/// NOTHING IN THIS CRATE IMPLEMENTS THIS TRAIT, and nothing in this crate opens
/// a socket. ORDER cC fenced rail resolution out of tonight's scope, so the
/// record type is an associated type rather than a struct defined here: this
/// crate does not know what a resolved record looks like and refuses to guess.
/// The rail that implements this names both types.
pub trait ResolveBName {
    /// Whatever the implementing rail returns. Not specified here.
    type Record;
    /// Whatever the implementing rail fails with. Not specified here.
    type Error;

    fn resolve(&self, target: &ResolutionTarget) -> Result<Self::Record, Self::Error>;
}

// ── The URL ────────────────────────────────────────────────────────

/// A parsed, normalized `bnr://` URL.
///
/// Normalization is lossy by ruling: `bnr` and `web+bnr` mean the same URL, so
/// the spelling that arrived is DISCARDED rather than stored. Two inputs that
/// differ only in scheme spelling, or in the case of the scheme and name,
/// compare equal — the property ORDER cC's acceptance asks for.
///
/// Case folding applies to the scheme and the name ONLY. Path, query and
/// fragment are preserved byte-for-byte: their case is significant and this
/// crate does not own their meaning.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct BnrUrl {
    name: BName,
    path: Option<String>,
    query: Option<String>,
    fragment: Option<String>,
}

impl BnrUrl {
    /// Parse and normalize. See [`ParseError`] for every way this says no.
    pub fn parse(input: &str) -> Result<Self, ParseError> {
        if input.is_empty() {
            return Err(ParseError::Empty);
        }
        if input.starts_with(char::is_whitespace) || input.ends_with(char::is_whitespace) {
            return Err(ParseError::SurroundingWhitespace);
        }
        scan_forbidden(input)?;

        let Some((raw_scheme, rest)) = input.split_once(':') else {
            return Err(ParseError::MissingSchemeDelimiter);
        };
        let scheme = raw_scheme.to_ascii_lowercase();
        if scheme != CANONICAL_SCHEME && scheme != WEB_SCHEME {
            return Err(classify_scheme(scheme));
        }

        let Some(after) = rest.strip_prefix("//") else {
            return Err(ParseError::MissingAuthorityMarker);
        };

        // RFC 3986 §3.2: the authority ends at the first '/', '?' or '#'.
        let split = match after.find(['/', '?', '#']) {
            Some(index) => index,
            None => after.len(),
        };
        let authority = &after[..split];
        let tail = &after[split..];

        if authority.is_empty() {
            return Err(ParseError::EmptyAuthority);
        }
        if authority.contains('@') {
            return Err(ParseError::EmbeddedCredentials);
        }
        if authority.contains('[') || authority.contains(']') {
            return Err(ParseError::IpLiteralNotPermitted);
        }
        if authority.contains(':') {
            return Err(ParseError::PortNotPermitted);
        }

        let name = BName::parse_fqn(authority)?;

        // RFC 3986 §3.5: the fragment runs to the end of the URI, so it splits
        // off first; §3.4: the query is what is left after '?'.
        let (before_fragment, fragment) = match tail.split_once('#') {
            Some((head, frag)) => (head, Some(frag.to_string())),
            None => (tail, None),
        };
        let (raw_path, query) = match before_fragment.split_once('?') {
            Some((head, q)) => (head, Some(q.to_string())),
            None => (before_fragment, None),
        };
        let path = if raw_path.is_empty() {
            None
        } else {
            Some(raw_path.to_string())
        };

        Ok(Self {
            name,
            path,
            query,
            fragment,
        })
    }

    /// Always [`CANONICAL_SCHEME`] — a parsed URL has already been normalized.
    pub fn scheme(&self) -> &'static str {
        CANONICAL_SCHEME
    }

    pub fn name(&self) -> &BName {
        &self.name
    }

    /// The registrable label, without the suffix: `alice`.
    pub fn label(&self) -> &str {
        self.name.label()
    }

    /// The path INCLUDING its leading `/`, or `None` when none was supplied.
    /// The distinction is preserved: `bnr://alice.b` yields `None`,
    /// `bnr://alice.b/` yields `Some("/")`.
    pub fn path(&self) -> Option<&str> {
        self.path.as_deref()
    }

    /// The query WITHOUT its leading `?`. `Some("")` means a bare `?` was there.
    pub fn query(&self) -> Option<&str> {
        self.query.as_deref()
    }

    /// The fragment WITHOUT its leading `#`. `Some("")` means a bare `#` was there.
    pub fn fragment(&self) -> Option<&str> {
        self.fragment.as_deref()
    }

    /// What a rail is handed. Carries the name only.
    pub fn target(&self) -> ResolutionTarget {
        ResolutionTarget::new(self.name.clone())
    }

    /// The normalized spelling. Re-parsing this yields an equal value.
    pub fn canonical(&self) -> String {
        let optional = |part: &Option<String>| part.as_ref().map_or(0, |s| s.len() + 1);
        let hint = CANONICAL_SCHEME.len()
            + 3
            + self.name.label.len()
            + NAMESPACE_SUFFIX.len()
            + optional(&self.path)
            + optional(&self.query)
            + optional(&self.fragment);

        let mut out = String::with_capacity(hint);
        out.push_str(CANONICAL_SCHEME);
        out.push_str("://");
        out.push_str(&self.name.label);
        out.push_str(NAMESPACE_SUFFIX);
        if let Some(path) = &self.path {
            out.push_str(path);
        }
        if let Some(query) = &self.query {
            out.push('?');
            out.push_str(query);
        }
        if let Some(fragment) = &self.fragment {
            out.push('#');
            out.push_str(fragment);
        }
        out
    }
}

impl fmt::Display for BnrUrl {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.canonical())
    }
}

impl FromStr for BnrUrl {
    type Err = ParseError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s)
    }
}

/// Name a dead scheme by its ruling rather than lumping it under "unknown".
fn classify_scheme(scheme: String) -> ParseError {
    if scheme == "b" {
        return ParseError::DriveLetterScheme;
    }
    if REJECTED_ALIASES.contains(&scheme.as_str()) {
        return ParseError::RejectedAlias { alias: scheme };
    }
    ParseError::UnknownScheme { found: scheme }
}

/// Refuse control and invisible characters ANYWHERE in the input — not just in
/// the label. A zero-width character in a path is the same class of lie.
fn scan_forbidden(input: &str) -> Result<(), ParseError> {
    for (at, ch) in input.char_indices() {
        let codepoint = ch as u32;
        if codepoint <= 0x1F || codepoint == 0x7F || (0x80..=0x9F).contains(&codepoint) {
            return Err(ParseError::ControlCharacter { at, codepoint });
        }
        if is_invisible(codepoint) {
            return Err(ParseError::InvisibleCharacter { at, codepoint });
        }
    }
    Ok(())
}

/// Zero-width, soft-hyphen and bidi-format characters. The attack class named in
/// `b-domain @ 7f2be7f`, `docs/UNICODE-NAMING-1.md` §6.1 (ENS zero-width
/// insertion, reported 2017-10-12, unfixed until 2023).
fn is_invisible(codepoint: u32) -> bool {
    matches!(codepoint,
        0x00AD                 // SOFT HYPHEN
        | 0x200B..=0x200F      // ZWSP, ZWNJ, ZWJ, LRM, RLM
        | 0x202A..=0x202E      // bidi embedding and override
        | 0x2060..=0x2064      // WORD JOINER and invisible operators
        | 0x2066..=0x2069      // bidi isolates
        | 0xFEFF               // ZWNBSP / BOM
    )
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn ok(input: &str) -> BnrUrl {
        BnrUrl::parse(input).expect("expected this input to parse")
    }

    // ORDER cC acceptance case 1 — the plain form, asserted whole.
    #[test]
    fn plain_name() {
        let url = ok("bnr://alice.b");
        assert_eq!(url.scheme(), "bnr");
        assert_eq!(url.label(), "alice");
        assert_eq!(url.name().fqn(), "alice.b");
        assert_eq!(url.path(), None);
        assert_eq!(url.query(), None);
        assert_eq!(url.fragment(), None);
        assert_eq!(url.canonical(), "bnr://alice.b");
    }

    // ORDER cC acceptance case 2 — BNR://ALICE.B normalizes EQUAL, not merely parses.
    #[test]
    fn uppercase_normalizes_equal() {
        assert_eq!(ok("BNR://ALICE.B"), ok("bnr://alice.b"));
        assert_eq!(ok("BnR://Alice.B").canonical(), "bnr://alice.b");
    }

    // ORDER cC acceptance case 3 — web+bnr normalizes to bnr.
    #[test]
    fn web_scheme_normalizes_equal() {
        assert_eq!(ok("web+bnr://alice.b"), ok("bnr://alice.b"));
        assert_eq!(ok("WEB+BNR://alice.b").canonical(), "bnr://alice.b");
        assert_eq!(ok("web+bnr://alice.b").scheme(), "bnr");
    }

    // ORDER cC acceptance case 4 — every part split, and each one asserted.
    #[test]
    fn parts_split_correctly() {
        let url = ok("bnr://alice.b/path?q=1#frag");
        assert_eq!(url.label(), "alice");
        assert_eq!(url.path(), Some("/path"));
        assert_eq!(url.query(), Some("q=1"));
        assert_eq!(url.fragment(), Some("frag"));
        assert_eq!(url.canonical(), "bnr://alice.b/path?q=1#frag");
    }

    // ORDER cC acceptance case 5 — b:// is dead, and says why.
    #[test]
    fn drive_letter_scheme_rejected() {
        assert_eq!(
            BnrUrl::parse("b://alice.b"),
            Err(ParseError::DriveLetterScheme)
        );
    }

    // ORDER cC acceptance case 6 — credentials never travel here.
    #[test]
    fn embedded_credentials_rejected() {
        assert_eq!(
            BnrUrl::parse("bnr://user:pass@alice.b"),
            Err(ParseError::EmbeddedCredentials)
        );
        assert_eq!(
            BnrUrl::parse("bnr://user@alice.b"),
            Err(ParseError::EmbeddedCredentials)
        );
    }

    // ORDER cC acceptance case 7 — the empty authority.
    #[test]
    fn empty_authority_rejected() {
        assert_eq!(BnrUrl::parse("bnr://"), Err(ParseError::EmptyAuthority));
        assert_eq!(
            BnrUrl::parse("bnr:///path"),
            Err(ParseError::EmptyAuthority)
        );
    }

    // ORDER cC acceptance case 8a — a Latin/Cyrillic homograph, named as one.
    // U+0430 CYRILLIC SMALL LETTER A followed by ASCII "lice".
    #[test]
    fn cyrillic_latin_homograph_rejected() {
        assert_eq!(
            BnrUrl::parse("bnr://\u{0430}lice.b"),
            Err(ParseError::MixedScriptLabel {
                first: Script::Cyrillic,
                second: Script::Latin,
            })
        );
    }

    // ORDER cC acceptance case 8b — U+03BF GREEK SMALL LETTER OMICRON inside "bob".
    #[test]
    fn greek_latin_homograph_rejected() {
        assert_eq!(
            BnrUrl::parse("bnr://b\u{03BF}b.b"),
            Err(ParseError::MixedScriptLabel {
                first: Script::Latin,
                second: Script::Greek,
            })
        );
    }

    // ORDER cC acceptance case 8c — a zero-width space hiding inside a name.
    #[test]
    fn zero_width_insertion_rejected() {
        assert_eq!(
            BnrUrl::parse("bnr://ali\u{200B}ce.b"),
            Err(ParseError::InvisibleCharacter {
                at: 9,
                codepoint: 0x200B,
            })
        );
    }

    // ORDER cC acceptance case 8d — a C0 control character, in the name and the path.
    #[test]
    fn control_character_rejected() {
        assert_eq!(
            BnrUrl::parse("bnr://ali\u{0007}ce.b"),
            Err(ParseError::ControlCharacter {
                at: 9,
                codepoint: 0x07,
            })
        );
        assert_eq!(
            BnrUrl::parse("bnr://alice.b/p\u{000A}th"),
            Err(ParseError::ControlCharacter {
                at: 15,
                codepoint: 0x0A,
            })
        );
    }

    // A single-script non-ASCII name is refused too, and is NOT called a mix.
    #[test]
    fn single_script_non_ascii_rejected_without_claiming_a_mix() {
        // U+5317 U+4EAC — two Han characters, one script.
        assert_eq!(
            BnrUrl::parse("bnr://\u{5317}\u{4EAC}.b"),
            Err(ParseError::NonAsciiLabel {
                at: 0,
                codepoint: 0x5317,
                script: Script::Han,
            })
        );
    }

    #[test]
    fn rejected_aliases_named_by_their_ruling() {
        for alias in REJECTED_ALIASES {
            let input = format!("{alias}://alice.b");
            assert_eq!(
                BnrUrl::parse(&input),
                Err(ParseError::RejectedAlias {
                    alias: alias.to_string()
                }),
                "{alias} must be refused as a ruled alias, not as an unknown scheme"
            );
        }
    }

    #[test]
    fn unknown_scheme_is_not_confused_with_an_alias() {
        assert_eq!(
            BnrUrl::parse("https://alice.b"),
            Err(ParseError::UnknownScheme {
                found: "https".to_string()
            })
        );
    }

    #[test]
    fn subdomains_refused_at_the_validator() {
        assert_eq!(
            BnrUrl::parse("bnr://pay.alice.b"),
            Err(ParseError::SubdomainNotPermitted { labels: 3 })
        );
    }

    #[test]
    fn non_b_namespace_refused() {
        assert_eq!(
            BnrUrl::parse("bnr://alice.eth"),
            Err(ParseError::NotBNamespace {
                authority: "alice.eth".to_string()
            })
        );
        assert_eq!(
            BnrUrl::parse("bnr://alice"),
            Err(ParseError::NotBNamespace {
                authority: "alice".to_string()
            })
        );
    }

    // The label law, mirrored from b-domain @ 7f2be7f contract/bdomain.cpp:28-38.
    #[test]
    fn label_law_matches_the_registry() {
        assert_eq!(BnrUrl::parse("bnr://.b"), Err(ParseError::EmptyLabel));
        assert_eq!(
            BnrUrl::parse("bnr://-alice.b"),
            Err(ParseError::LabelLeadingHyphen)
        );
        assert_eq!(
            BnrUrl::parse("bnr://alice-.b"),
            Err(ParseError::LabelTrailingHyphen)
        );
        assert_eq!(
            BnrUrl::parse("bnr://ali--ce.b"),
            Err(ParseError::LabelDoubleHyphen { at: 3 })
        );
        assert_eq!(
            BnrUrl::parse("bnr://ali_ce.b"),
            Err(ParseError::InvalidLabelCharacter { at: 3, ch: '_' })
        );
        // A single interior hyphen and digits are lawful.
        assert_eq!(ok("bnr://ali-ce9.b").label(), "ali-ce9");
    }

    #[test]
    fn label_length_boundary_is_the_registry_boundary() {
        // 32 is written LITERALLY here, never as MAX_LABEL_LEN. This test must
        // assert the registry's boundary (b-domain @ 7f2be7f,
        // contract/bdomain.cpp:29), not merely agree with whatever this crate's
        // own constant happens to say. Caught by a mutation pass: written the
        // other way it stayed green when the limit was moved to 63.
        assert_eq!(MAX_LABEL_LEN, 32, "the .b registry limit is 32");

        let at_max = "a".repeat(32);
        assert_eq!(ok(&format!("bnr://{at_max}.b")).label(), at_max);

        let over = "a".repeat(33);
        assert_eq!(
            BnrUrl::parse(&format!("bnr://{over}.b")),
            Err(ParseError::LabelTooLong { len: 33, max: 32 })
        );
    }

    #[test]
    fn ports_and_ip_literals_refused() {
        assert_eq!(
            BnrUrl::parse("bnr://alice.b:8080"),
            Err(ParseError::PortNotPermitted)
        );
        assert_eq!(
            BnrUrl::parse("bnr://[::1]"),
            Err(ParseError::IpLiteralNotPermitted)
        );
    }

    #[test]
    fn malformed_shapes_refused() {
        assert_eq!(BnrUrl::parse(""), Err(ParseError::Empty));
        assert_eq!(
            BnrUrl::parse(" bnr://alice.b"),
            Err(ParseError::SurroundingWhitespace)
        );
        assert_eq!(
            BnrUrl::parse("bnr://alice.b "),
            Err(ParseError::SurroundingWhitespace)
        );
        assert_eq!(
            BnrUrl::parse("alice.b"),
            Err(ParseError::MissingSchemeDelimiter)
        );
        assert_eq!(
            BnrUrl::parse("bnr:alice.b"),
            Err(ParseError::MissingAuthorityMarker)
        );
    }

    // Absent and empty are different things, and stay different.
    #[test]
    fn empty_components_are_preserved_not_collapsed() {
        let bare = ok("bnr://alice.b");
        let slash = ok("bnr://alice.b/");
        assert_eq!(bare.path(), None);
        assert_eq!(slash.path(), Some("/"));
        assert_ne!(bare, slash);

        let empty_query = ok("bnr://alice.b?");
        assert_eq!(empty_query.query(), Some(""));
        assert_eq!(empty_query.canonical(), "bnr://alice.b?");

        let empty_fragment = ok("bnr://alice.b#");
        assert_eq!(empty_fragment.fragment(), Some(""));
        assert_eq!(empty_fragment.canonical(), "bnr://alice.b#");
    }

    // RFC 3986 §3.5 — the fragment runs to the end, so a '?' inside it is text.
    #[test]
    fn fragment_swallows_a_later_question_mark() {
        let url = ok("bnr://alice.b/p#frag?notquery");
        assert_eq!(url.path(), Some("/p"));
        assert_eq!(url.query(), None);
        assert_eq!(url.fragment(), Some("frag?notquery"));
    }

    // RFC 3986 sect. 3.5 — the fragment begins at the FIRST '#' and runs to the
    // end, so a second '#' is fragment text, never a path or query character.
    // Added after a mutation pass: with only one '#' in the corpus, split_once
    // and rsplit_once were indistinguishable and the mutation survived.
    #[test]
    fn first_delimiter_wins() {
        let url = ok("bnr://alice.b/p#frag#second");
        assert_eq!(url.path(), Some("/p"));
        assert_eq!(url.query(), None);
        assert_eq!(url.fragment(), Some("frag#second"));

        let url = ok("bnr://alice.b/p?a=1?b=2");
        assert_eq!(url.path(), Some("/p"));
        assert_eq!(url.query(), Some("a=1?b=2"));
        assert_eq!(url.fragment(), None);

        // Both together: the '#' cut happens before '?' is even considered.
        let url = ok("bnr://alice.b/p?a=1#f?g#h");
        assert_eq!(url.path(), Some("/p"));
        assert_eq!(url.query(), Some("a=1"));
        assert_eq!(url.fragment(), Some("f?g#h"));
    }

    // Case folds on scheme and name ONLY. The path is not the parser's to fold.
    #[test]
    fn path_case_is_preserved() {
        let url = ok("BNR://ALICE.B/Path/To?Q=One#Frag");
        assert_eq!(url.label(), "alice");
        assert_eq!(url.path(), Some("/Path/To"));
        assert_eq!(url.query(), Some("Q=One"));
        assert_eq!(url.fragment(), Some("Frag"));
    }

    #[test]
    fn canonical_round_trips() {
        for input in [
            "bnr://alice.b",
            "BNR://ALICE.B/Path?Q=1#F",
            "web+bnr://a-9.b/",
            "bnr://alice.b?",
            "bnr://alice.b#",
        ] {
            let once = ok(input);
            let twice = ok(&once.canonical());
            assert_eq!(once, twice, "canonical form of {input} must re-parse equal");
            assert_eq!(once.canonical(), twice.canonical());
        }
    }

    #[test]
    fn target_carries_the_name_and_nothing_else() {
        let url = ok("bnr://alice.b/path?q=1#frag");
        let target = url.target();
        assert_eq!(target.label(), "alice");
        assert_eq!(target.to_string(), "alice.b");
        // Two URLs differing only below the name resolve to the SAME target.
        assert_eq!(target, ok("bnr://alice.b/other").target());
        assert_ne!(target, ok("bnr://bob.b/path?q=1#frag").target());
    }

    #[test]
    fn from_str_agrees_with_parse() {
        let parsed: Result<BnrUrl, ParseError> = "bnr://alice.b".parse();
        assert_eq!(parsed, BnrUrl::parse("bnr://alice.b"));
    }

    // Errors carry a legible reason, not just a discriminant.
    #[test]
    fn errors_say_why() {
        assert_eq!(
            ParseError::DriveLetterScheme.to_string(),
            "scheme 'b' is rejected: it collides with a Windows drive letter — use 'bnr'"
        );
        assert_eq!(
            ParseError::MixedScriptLabel {
                first: Script::Cyrillic,
                second: Script::Latin
            }
            .to_string(),
            "name mixes Cyrillic and Latin — refused as a homograph risk"
        );
    }

    /// Proves the SHAPE of the resolver seam compiles and accepts a
    /// ResolutionTarget. It proves NOTHING about resolution: there is no rail
    /// here, no network, and this double answers from a hardcoded pair.
    #[test]
    fn resolver_seam_is_implementable_by_a_test_double() {
        struct Double;
        impl ResolveBName for Double {
            type Record = &'static str;
            type Error = ();
            fn resolve(&self, target: &ResolutionTarget) -> Result<Self::Record, Self::Error> {
                match target.label() {
                    "alice" => Ok("a hardcoded string, not a resolution"),
                    _ => Err(()),
                }
            }
        }
        let target = ok("bnr://alice.b").target();
        assert_eq!(
            Double.resolve(&target),
            Ok("a hardcoded string, not a resolution")
        );
        assert_eq!(Double.resolve(&ok("bnr://bob.b").target()), Err(()));
    }
}
