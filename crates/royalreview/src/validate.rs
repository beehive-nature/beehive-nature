//! Deterministic local validation of a Review against the Lexicon artifact
//! (`dockets/lexicon/com.beehivenature.temp.royalReview.json`). Pure
//! functions, no network, no clock — the same shape as the mirror's K-4
//! predicate: refusal is a verdict, and the error names the exact field and
//! the failed constraint so invalid-input tests are deterministic.
//!
//! Where this implementation is STRICTER than the artifact, the doc says so:
//! stricter-than-schema is validator policy (permitted); laxer is a bug.

use atmirror::cid::Cid;
use atmirror::receipt::{Receipt, StrongRef, RECEIPT_NSID};

use crate::record::{Review, StorageRef, REVIEW_NSID, STORAGE_SCHEMES, VERDICTS};

/// A fetched receipt record with its own coordinates, as a PDS `getRecord`
/// (or atmirror state) would return them: the record's at-uri, its cid,
/// and its JSON value.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FetchedReceipt<'a> {
    pub uri: &'a str,
    pub cid: &'a str,
    pub value: &'a serde_json::Value,
}

/// Everything a validated review carries forward: the review plus the
/// parsed receipt when one was referenced (proof it was really validated).
#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedReview {
    pub review: Review,
    pub receipt: Option<Receipt>,
}

/// Validate `review` locally. `receipt` is the fetched
/// `com.beehivenature.receipt` record the review's `receipt` strongRef
/// points at — **required whenever the strongRef is present** (fail-closed:
/// "validated existing receipt" means validated, not merely referenced).
/// `None` is only legal when the review omits the field entirely.
pub fn validate_review(
    review: &Review,
    receipt: Option<FetchedReceipt<'_>>,
) -> Result<ValidatedReview, String> {
    if review.record_type != REVIEW_NSID {
        return Err(format!(
            "$type: expected {REVIEW_NSID}, got {:?}",
            review.record_type
        ));
    }
    validate_did(&review.author).map_err(|e| format!("author: {e}"))?;

    // subject: at-uri syntax + DID authority + RECORD form (collection and
    // rkey present — a strongRef subject must address a record; official
    // strongRef permits any at-uri, this contract is stricter) + cid syntax.
    let parts = at_uri_parts(&review.subject.uri).map_err(|e| format!("subject.uri: {e}"))?;
    validate_did(parts.authority)
        .map_err(|e| format!("subject.uri authority {:?}: {e}", parts.authority))?;
    if parts.collection.is_none() || parts.rkey.is_none() {
        return Err(format!(
            "subject.uri {:?}: a review subject must address a RECORD \
             (at://did/collection/rkey); repo-root or collection-only uris are \
             legal at-uris but not a reviewable subject here (repo-root strongRefs \
             remain legal INSIDE receipt records, per SPEC_LEXICON-1 §5.1)",
            review.subject.uri
        ));
    }
    Cid::parse_str(&review.subject.cid).map_err(|e| format!("subject.cid: {e}"))?;

    if !VERDICTS.contains(&review.verdict.as_str()) {
        return Err(format!("verdict: {:?} not in {VERDICTS:?}", review.verdict));
    }

    if review.storage_refs.is_empty() {
        return Err(
            "storageRefs: empty — the artifact requires minItems 1 (a review without \
             storage references asserts nothing verifiable)"
                .into(),
        );
    }
    if review.storage_refs.len() > 16 {
        return Err(format!(
            "storageRefs: {} entries exceeds maxLength 16",
            review.storage_refs.len()
        ));
    }
    for (i, sr) in review.storage_refs.iter().enumerate() {
        validate_storage_ref(sr).map_err(|e| format!("storageRefs[{i}]: {e}"))?;
    }

    if let Some(comment) = &review.comment {
        // Lexicon maxLength counts UTF-8 BYTES, not code points ("maximum
        // length of value, in UTF-8 bytes" — atproto Lexicon spec, String
        // type). `str::len` in Rust is exactly that.
        if comment.len() > 20000 {
            return Err(format!(
                "comment: {} UTF-8 bytes exceeds maxLength 20000 (bytes, not \
                 characters — the Lexicon counting rule)",
                comment.len()
            ));
        }
    }

    validate_datetime(&review.created_at).map_err(|e| format!("createdAt: {e}"))?;

    // The optional receipt: fail-closed cross-validation.
    let parsed_receipt = match (&review.receipt, receipt) {
        (None, _) => None,
        (Some(_), None) => {
            return Err(
                "receipt: strongRef present but no receipt record supplied — a referenced \
                 receipt must be validated (parse + contentCid binding) before publication; \
                 omit the field or supply the fetched record"
                    .into(),
            )
        }
        (Some(reference), Some(fetched)) => Some(validate_referenced_receipt(reference, fetched)?),
    };

    Ok(ValidatedReview {
        review: review.clone(),
        receipt: parsed_receipt,
    })
}

/// Cross-validate the referenced receipt record: the reference agrees with
/// the fetched record on BOTH coordinates (uri + cid), the uri's collection
/// is `com.beehivenature.receipt`, the value parses as the atmirror
/// `Receipt` type, and SPEC_LEXICON-1 §5's binding law holds
/// (`contentCid == subject.cid`). Reuses `atmirror::receipt::Receipt` —
/// this lane grows no second receipt parser.
fn validate_referenced_receipt(
    reference: &StrongRef,
    fetched: FetchedReceipt<'_>,
) -> Result<Receipt, String> {
    if reference.uri != fetched.uri {
        return Err(format!(
            "receipt: reference uri {:?} != fetched record uri {:?}",
            reference.uri, fetched.uri
        ));
    }
    if reference.cid != fetched.cid {
        return Err(format!(
            "receipt: reference cid {:?} != fetched record cid {:?}",
            reference.cid, fetched.cid
        ));
    }
    let parts = at_uri_parts(fetched.uri).map_err(|e| format!("receipt.uri: {e}"))?;
    if parts.collection != Some(RECEIPT_NSID) {
        return Err(format!(
            "receipt.uri: collection {:?} is not {RECEIPT_NSID}",
            parts.collection
        ));
    }
    if parts.rkey.is_none() {
        return Err(format!(
            "receipt.uri: must address a receipt RECORD \
             (at://did/{RECEIPT_NSID}/<rkey>), got {:?}",
            fetched.uri
        ));
    }
    if fetched.value.get("$type").and_then(|v| v.as_str()) != Some(RECEIPT_NSID) {
        return Err("receipt record $type is not com.beehivenature.receipt".into());
    }
    let receipt: Receipt = serde_json::from_value(fetched.value.clone())
        .map_err(|e| format!("receipt record does not parse as {RECEIPT_NSID}: {e}"))?;
    if !receipt.binding_ok() {
        return Err(
            "receipt record violates SPEC_LEXICON-1 §5: contentCid != subject.cid \
             (see atmirror::receipt::Receipt::binding_ok)"
                .into(),
        );
    }
    // Grammar parity the atmirror type does not check itself: the receipt's
    // own createdAt must satisfy the same atproto datetime grammar, and its
    // subject uri must be a well-formed at-uri with a DID authority — where
    // repo-root subjects (no collection) are TOLERATED, because SPEC_LEXICON-1
    // §5.1's repo-state receipts carry exactly that shape.
    validate_datetime(&receipt.created_at).map_err(|e| format!("receipt record createdAt: {e}"))?;
    let subject_parts = at_uri_parts(&receipt.subject.uri)
        .map_err(|e| format!("receipt record subject.uri: {e}"))?;
    validate_did(subject_parts.authority).map_err(|e| {
        format!(
            "receipt record subject.uri authority {:?}: {e}",
            subject_parts.authority
        )
    })?;
    Ok(receipt)
}

fn validate_storage_ref(sr: &StorageRef) -> Result<(), String> {
    if !STORAGE_SCHEMES.contains(&sr.scheme.as_str()) {
        return Err(format!(
            "scheme {:?} not in {STORAGE_SCHEMES:?} (same vocabulary as the receipt mediaPointer)",
            sr.scheme
        ));
    }
    if sr.address.is_empty() || sr.address.len() > 512 {
        return Err(format!(
            "address length {} outside 1..=512",
            sr.address.len()
        ));
    }
    if sr.scheme == "ar" {
        // Arweave txId / ANS-104 DataItem id: 43-char Base64URL
        // (same bound as the receipt lexicon's arweaveAnchor.txId).
        let ok = sr.address.len() == 43
            && sr
                .address
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
        if !ok {
            return Err("scheme 'ar' requires a 43-char Base64URL txId".into());
        }
    }
    validate_sha256_hex(&sr.sha256)?;
    if let Some(n) = sr.byte_length {
        if n == 0 {
            return Err(
                "byteLength 0 is meaningless for a reviewed artifact (schema minimum 0 \
                 tolerated; this validator refuses)"
                    .into(),
            );
        }
    }
    if let Some(label) = &sr.label {
        // UTF-8 BYTES per the Lexicon counting rule (see comment check).
        if label.len() > 64 {
            return Err(format!(
                "label: {} UTF-8 bytes exceeds maxLength 64 (bytes, not characters)",
                label.len()
            ));
        }
    }
    Ok(())
}

/// Lowercase hex, exactly 64 chars (sha256). Uppercase hex is refused —
/// the artifact says "lowercase hex" for every sha256 field.
pub fn validate_sha256_hex(s: &str) -> Result<(), String> {
    if s.len() != 64 {
        return Err(format!("sha256: {} chars, expected 64", s.len()));
    }
    if !s
        .bytes()
        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err("sha256: non-lowercase-hex character present".into());
    }
    Ok(())
}

/// Generic DID syntax check: `did:method:idstring`, method lowercase
/// alnum, idchar set per the DID spec. Syntax ONLY — resolution is a
/// network act and stays out of local validation.
pub fn validate_did(s: &str) -> Result<(), String> {
    let rest = s
        .strip_prefix("did:")
        .ok_or("not a did (missing did: prefix)")?;
    let (method, id) = rest.split_once(':').ok_or("missing method segment")?;
    if method.is_empty()
        || method.len() > 32
        || !method
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
    {
        return Err(format!("bad did method {method:?}"));
    }
    if id.is_empty() || id.len() > 256 {
        return Err("did idstring length outside 1..=256".into());
    }
    if !id
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'_'))
    {
        return Err("did idstring has characters outside the DID idchar set".into());
    }
    if s.len() > 512 {
        return Err("did exceeds 512 bytes".into());
    }
    Ok(())
}

/// Parsed at-uri. Syntax per the AT-URI spec
/// (`at://authority[/collection[/rkey]]`); this contract additionally
/// requires a DID authority (validated separately by the caller).
pub struct AtUriParts<'a> {
    pub authority: &'a str,
    pub collection: Option<&'a str>,
    pub rkey: Option<&'a str>,
}

pub fn at_uri_parts(uri: &str) -> Result<AtUriParts<'_>, String> {
    let rest = uri
        .strip_prefix("at://")
        .ok_or("not an at-uri (missing at:// prefix)")?;
    let mut segs = rest.split('/');
    let authority = segs.next().ok_or("empty authority")?;
    if authority.is_empty() {
        return Err("empty authority".into());
    }
    let collection = segs.next().filter(|s| !s.is_empty());
    let rkey = segs.next().filter(|s| !s.is_empty());
    if segs.next().is_some() {
        return Err("more than three path segments".into());
    }
    if let Some(c) = collection {
        validate_nsid_collection(c).map_err(|e| format!("collection: {e}"))?;
    }
    if let Some(r) = rkey {
        // Record-key spec: 1..=512 chars, restricted ASCII — alphanumeric,
        // period, dash, underscore, colon, tilde — and the values "." and
        // ".." are forbidden. Case-sensitive.
        let charset_ok = !r.is_empty()
            && r.len() <= 512
            && r.bytes().all(|b| {
                b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'_' | b':' | b'~')
            });
        if !charset_ok {
            return Err(format!(
                "rkey {:?}: charset is A-Za-z0-9 and .-_:~ per the record-key spec, \
                 length 1..=512",
                r
            ));
        }
        if r == "." || r == ".." {
            return Err("rkey: '.' and '..' are forbidden record keys".into());
        }
    }
    Ok(AtUriParts {
        authority,
        collection,
        rkey,
    })
}

/// Collection grammar = the full NSID grammar (atproto NSID spec): at
/// least 3 segments, total length ≤ 317; every DOMAIN-AUTHORITY segment
/// (all but the last) is 1..=63 chars of [a-z0-9-] with no leading or
/// trailing hyphen, and the first (TLD) must not start with a digit; the
/// NAME segment (last) is 1..=63 chars of [a-zA-Z0-9] with no hyphens and
/// must not start with a digit (uppercase is legal — `strongRef`).
fn validate_nsid_collection(s: &str) -> Result<(), String> {
    let segments: Vec<&str> = s.split('.').collect();
    let fail = |why: &str| Err(format!("{s:?} is not a valid collection NSID: {why}"));
    if segments.len() < 3 {
        return fail("fewer than 3 segments (authority must carry at least two)");
    }
    if s.len() > 317 {
        return fail("total length exceeds 317");
    }
    let name = segments[segments.len() - 1];
    if name.is_empty()
        || name.len() > 63
        || !name.bytes().all(|b| b.is_ascii_alphanumeric())
        || name.starts_with(|c: char| c.is_ascii_digit())
    {
        return fail("name segment must be letters+digits, no hyphens, not digit-first");
    }
    for (i, seg) in segments[..segments.len() - 1].iter().enumerate() {
        if seg.is_empty()
            || seg.len() > 63
            || !seg
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
            || seg.starts_with('-')
            || seg.ends_with('-')
            || (i == 0 && seg.starts_with(|c: char| c.is_ascii_digit()))
        {
            return fail("bad authority segment");
        }
    }
    Ok(())
}

/// The atproto datetime: RFC 3339 ∩ ISO 8601 —
/// `YYYY-MM-DDTHH:MM:SS[.fff](Z|±HH:MM)`, uppercase T, seconds 00–59 (no
/// leap second 60 — the intersection drops it), at most 3 fractional
/// digits, timezone REQUIRED. Returns the instant in Unix seconds
/// (offset-normalized) for the Nostr twin's created_at.
pub fn validate_datetime(s: &str) -> Result<i64, String> {
    let b = s.as_bytes();
    let digits = |r: std::ops::Range<usize>| -> Option<u32> {
        if r.end > b.len() || b[r.clone()].iter().any(|c| !c.is_ascii_digit()) {
            None
        } else {
            Some(
                b[r].iter()
                    .fold(0u32, |acc, c| acc * 10 + (c - b'0') as u32),
            )
        }
    };
    let year = digits(0..4).ok_or("year: expected 4 digits")? as i64;
    if b.get(4) != Some(&b'-') {
        return Err("expected '-' after year".into());
    }
    let month = digits(5..7).ok_or("month: expected 2 digits")? as u32;
    if !(1..=12).contains(&month) {
        return Err(format!("month {month} outside 1..=12"));
    }
    if b.get(7) != Some(&b'-') {
        return Err("expected '-' after month".into());
    }
    let day = digits(8..10).ok_or("day: expected 2 digits")? as u32;
    let dim = days_in_month(year, month).ok_or("month out of range")?;
    if !(1..=dim).contains(&day) {
        return Err(format!("day {day} outside 1..={dim} for {year}-{month:02}"));
    }
    if b.get(10) != Some(&b'T') {
        return Err("separator must be uppercase 'T'".into());
    }
    let hour = digits(11..13).ok_or("hour: expected 2 digits")? as u32;
    if hour > 23 {
        return Err(format!("hour {hour} outside 0..=23"));
    }
    if b.get(13) != Some(&b':') {
        return Err("expected ':' after hour".into());
    }
    let min = digits(14..16).ok_or("minute: expected 2 digits")? as u32;
    if min > 59 {
        return Err(format!("minute {min} outside 0..=59"));
    }
    if b.get(16) != Some(&b':') {
        return Err("expected ':' after minute".into());
    }
    let sec = digits(17..19).ok_or("second: expected 2 digits")? as u32;
    if sec > 59 {
        return Err(format!(
            "second {sec} outside 0..=59 (leap second 60 is not in the RFC3339∩ISO8601 intersection)"
        ));
    }
    let mut i = 19;
    // Optional fraction: '.' + 1..=3 digits.
    if b.get(i) == Some(&b'.') {
        let frac_start = i + 1;
        let mut j = frac_start;
        while j < b.len() && b[j].is_ascii_digit() {
            j += 1;
        }
        let n = j - frac_start;
        if n == 0 {
            return Err("fraction: no digits after '.'".into());
        }
        if n > 3 {
            return Err(format!("fraction: {n} digits, at most 3 allowed"));
        }
        i = j;
    }
    // Timezone: required.
    let tz_len = s.len() - i;
    let offset: i64 = match (b.get(i), tz_len) {
        (Some(b'Z'), 1) => 0,
        (Some(sign @ (b'+' | b'-')), 6) => {
            let hh = digits(i + 1..i + 3).ok_or("tz hour: expected 2 digits")? as i64;
            if hh > 23 {
                return Err(format!("tz hour {hh} outside 0..=23"));
            }
            if b.get(i + 3) != Some(&b':') {
                return Err("tz: expected ':'".into());
            }
            let mm = digits(i + 4..i + 6).ok_or("tz minute: expected 2 digits")? as i64;
            if mm > 59 {
                return Err(format!("tz minute {mm} outside 0..=59"));
            }
            let v = hh * 3600 + mm * 60;
            if *sign == b'+' {
                v
            } else {
                -v
            }
        }
        _ => return Err("timezone required: 'Z' or ±HH:MM (lowercase 'z' is refused)".into()),
    };
    let days = days_from_civil(year, month, day);
    let epoch = days * 86400 + (hour as i64) * 3600 + (min as i64) * 60 + sec as i64 - offset;
    if epoch < 0 {
        return Err(
            "instant is before 1970 — the Nostr twin's created_at is u64; refusing rather \
             than wrapping"
                .into(),
        );
    }
    Ok(epoch)
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn days_in_month(y: i64, m: u32) -> Option<u32> {
    Some(match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap(y) => 29,
        2 => 28,
        _ => return None,
    })
}

/// Howard Hinnant's days_from_civil (proleptic Gregorian) — deterministic,
/// no calendar crate.
fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m as i64 + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

/// TID record-key syntax: exactly 13 chars from the base32-sortable
/// alphabet `234567abcdefghijklmnopqrstuvwxyz` (digits 2–7 then a–z; 0/1/8/9
/// excluded), with the FIRST character restricted to the alphabet's first
/// half `234567abcdefghij` — the reference implementation's exact rule
/// (`TID_REGEX = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/`,
/// packages/syntax/src/tid.ts; the restriction pins the identifier's top
/// bit to zero). Real 2020s TIDs (leading '2'/'3') pass. This resolves the
/// first-character range previously left UNVERIFIED.
pub fn validate_tid(s: &str) -> Result<(), String> {
    const ALPHABET: &[u8] = b"234567abcdefghijklmnopqrstuvwxyz";
    const FIRST_HALF: &[u8] = b"234567abcdefghij";
    if s.len() != 13 {
        return Err(format!("rkey: {} chars, expected 13 (TID)", s.len()));
    }
    if !s.as_bytes()[0].is_ascii_lowercase() && !s.as_bytes()[0].is_ascii_digit() {
        return Err("rkey: TID must be ASCII".into());
    }
    if !FIRST_HALF.contains(&s.as_bytes()[0]) {
        return Err(
            "rkey: TID first character outside 234567abcdefghij (the reference TID_REGEX \
             first-half restriction; pins the top bit of the 64-bit identifier)"
                .into(),
        );
    }
    if !s.bytes().all(|c| ALPHABET.contains(&c)) {
        return Err("rkey: character outside the base32-sortable alphabet 234567a-z".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn datetime_known_instants() {
        assert_eq!(validate_datetime("1970-01-01T00:00:00Z").unwrap(), 0);
        assert_eq!(validate_datetime("1970-01-01T01:00:00+01:00").unwrap(), 0);
        assert_eq!(validate_datetime("1970-01-02T00:00:00Z").unwrap(), 86400);
        assert_eq!(
            validate_datetime("2024-02-29T00:00:00Z").unwrap(),
            1709164800
        );
        assert_eq!(
            validate_datetime("2024-03-01T00:00:00Z").unwrap(),
            1709251200
        );
        // Same instant, two spellings.
        assert_eq!(
            validate_datetime("2026-09-12T12:00:00Z").unwrap(),
            validate_datetime("2026-09-12T06:00:00-06:00").unwrap()
        );
        assert!(validate_datetime("2026-09-12T12:34:56.123Z").is_ok());
    }

    #[test]
    fn datetime_refuses_deterministic_garbage() {
        for bad in [
            "2026-09-12t00:00:00Z",      // lowercase t
            "2026-09-12T00:00:00z",      // lowercase z
            "2026-09-12 00:00:00Z",      // space separator
            "2026-09-12T00:00:00",       // no timezone
            "2026-09-12T00:00:00.1234Z", // 4 fractional digits
            "2026-13-01T00:00:00Z",      // month 13
            "2026-09-31T00:00:00Z",      // day 31 of September
            "2023-02-29T00:00:00Z",      // non-leap Feb 29
            "2026-09-12T24:00:00Z",      // hour 24
            "2026-09-12T00:60:00Z",      // minute 60
            "2026-09-12T00:00:60Z",      // leap second (not in intersection)
            "1969-12-31T23:59:59Z",      // pre-1970
            "2026-9-12T00:00:00Z",       // non-padded month
            "2026-09-12T00:00:00+0600",  // tz without colon
        ] {
            assert!(validate_datetime(bad).is_err(), "should refuse {bad:?}");
        }
    }

    #[test]
    fn did_checks() {
        assert!(validate_did("did:plc:abc123").is_ok());
        assert!(validate_did("did:web:example.com").is_ok());
        for bad in [
            "did:plc:",
            "did:",
            "plc:abc",
            "did:PLC:abc",
            "did:plc:ab:cd",
            "did:plc:a b",
            "",
        ] {
            assert!(validate_did(bad).is_err(), "should refuse {bad:?}");
        }
    }

    #[test]
    fn at_uri_checks() {
        let p = at_uri_parts("at://did:plc:abc/com.beehivenature.receipt/3jzfcijpj2z2a").unwrap();
        assert_eq!(p.authority, "did:plc:abc");
        assert_eq!(p.collection, Some("com.beehivenature.receipt"));
        assert_eq!(p.rkey, Some("3jzfcijpj2z2a"));
        let root = at_uri_parts("at://did:plc:abc").unwrap();
        assert_eq!(root.collection, None);
        for bad in [
            "https://x.com",
            "at://",
            "at://did:plc:abc/a/b/c/d",
            "at://did:plc:abc/BAD.Collection",
        ] {
            assert!(at_uri_parts(bad).is_err(), "should refuse {bad:?}");
        }
    }

    #[test]
    fn tid_checks() {
        assert!(validate_tid("3jzfcijpj2z2a").is_ok());
        assert!(validate_tid("aaaaaaaaaaaaa").is_ok());
        for bad in [
            "3jzfcijpj2z2",   // 12 chars
            "3jzfcijpj2z2aa", // 14 chars
            "3jzfcijpj2z2A",  // uppercase
            "0aaaaaaaaaaaa",  // 0 excluded
            "1aaaaaaaaaaaa",  // 1 excluded
            "8aaaaaaaaaaaa",  // 8 excluded
            "9aaaaaaaaaaaa",  // 9 excluded
            "aaaaaaaaaaa-i",  // '-' is not in the alphabet
        ] {
            assert!(validate_tid(bad).is_err(), "should refuse {bad:?}");
        }
    }

    #[test]
    fn sha256_hex_checks() {
        assert!(validate_sha256_hex(&"ab".repeat(32)).is_ok());
        assert!(validate_sha256_hex(&"AB".repeat(32)).is_err());
        assert!(validate_sha256_hex(&"ab".repeat(31)).is_err());
        assert!(validate_sha256_hex(&"gg".repeat(32)).is_err());
    }
}
