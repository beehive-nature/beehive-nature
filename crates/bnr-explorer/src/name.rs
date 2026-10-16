//! Display names. A name in a listing came from whoever wrote the index or the
//! manifest, so it is data to be admitted, not text to be trusted: a name that
//! could reorder what the person reads (bidirectional overrides, the "Trojan
//! Source" class), hide characters (controls), or pose as a path is refused
//! whole. Refused, not repaired: a cleaned-up name would show the person a
//! name nobody wrote.

/// The longest admitted name, in UTF-8 bytes (the common filesystem limit).
pub const MAX_NAME_BYTES: usize = 255;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NameRefusal {
    Empty,
    TooLong,
    /// A C0/C1 control or DEL.
    Control,
    /// An embedding, override or isolate that reorders displayed text.
    Bidi,
    /// `/` — names are single segments; folders come from [`crate::tree`].
    Separator,
    /// `.` or `..`.
    DotSegment,
}

impl NameRefusal {
    pub const fn wire(self) -> u8 {
        match self {
            NameRefusal::Empty => 1,
            NameRefusal::TooLong => 2,
            NameRefusal::Control => 3,
            NameRefusal::Bidi => 4,
            NameRefusal::Separator => 5,
            NameRefusal::DotSegment => 6,
        }
    }
}

/// The reordering controls of Unicode's bidirectional algorithm: LRE, RLE,
/// PDF, LRO, RLO (U+202A..U+202E), LRI, RLI, FSI, PDI (U+2066..U+2069), and
/// the Arabic letter mark U+061C.
pub fn is_bidi_control(c: char) -> bool {
    matches!(c, '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}' | '\u{061C}')
}

/// Admit `s` as one displayable name segment.
pub fn admit_name(s: &str) -> Result<(), NameRefusal> {
    if s.is_empty() {
        return Err(NameRefusal::Empty);
    }
    if s.len() > MAX_NAME_BYTES {
        return Err(NameRefusal::TooLong);
    }
    if s == "." || s == ".." {
        return Err(NameRefusal::DotSegment);
    }
    for c in s.chars() {
        if c == '/' {
            return Err(NameRefusal::Separator);
        }
        if c.is_control() {
            return Err(NameRefusal::Control);
        }
        if is_bidi_control(c) {
            return Err(NameRefusal::Bidi);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinary_names_in_any_script_pass() {
        for n in [
            "notes.txt",
            "Māra un Laima.jpg",
            "蜂巢.png",
            "a b",
            ".hidden",
            "x..y",
        ] {
            assert_eq!(admit_name(n), Ok(()), "{n}");
        }
    }

    #[test]
    fn a_name_that_reads_as_a_different_file_is_refused() {
        // "invoice" + RLO + "fdp.exe" displays as "invoiceexe.pdf"
        assert_eq!(admit_name("invoice\u{202E}fdp.exe"), Err(NameRefusal::Bidi));
        assert_eq!(admit_name("a\u{2067}b"), Err(NameRefusal::Bidi));
        assert_eq!(admit_name("a\u{061C}b"), Err(NameRefusal::Bidi));
    }

    #[test]
    fn controls_paths_and_dots_are_refused() {
        assert_eq!(admit_name(""), Err(NameRefusal::Empty));
        assert_eq!(admit_name("a\nb"), Err(NameRefusal::Control));
        assert_eq!(admit_name("a\u{0}b"), Err(NameRefusal::Control));
        assert_eq!(admit_name("a\u{7f}"), Err(NameRefusal::Control));
        assert_eq!(admit_name("a\u{85}"), Err(NameRefusal::Control));
        assert_eq!(admit_name("dir/file"), Err(NameRefusal::Separator));
        assert_eq!(admit_name("."), Err(NameRefusal::DotSegment));
        assert_eq!(admit_name(".."), Err(NameRefusal::DotSegment));
    }

    #[test]
    fn the_length_limit_is_bytes_not_characters() {
        let at = "a".repeat(MAX_NAME_BYTES);
        assert_eq!(admit_name(&at), Ok(()));
        let over = "ā".repeat(MAX_NAME_BYTES / 2 + 1); // 2 bytes each
        assert_eq!(admit_name(&over), Err(NameRefusal::TooLong));
    }
}
