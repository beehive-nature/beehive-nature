//! Identity-first, bounded previews.
//!
//! The order is the safety argument, so it is fixed:
//!
//! 1. **Size**, before anything is read: over [`Budget::max_input`] is refused.
//! 2. **Identity**: the bytes must hash to the id the listing gave. Nothing
//!    below ever looks inside bytes that are not the bytes that were asked for.
//! 3. **Sniff by content**, never by name: a `.txt` that is a PNG is a PNG.
//! 4. **Structure and bounds** for the one format chosen.
//!
//! What comes back is small and fully described: a bounded, sanitised text
//! excerpt; an image's format and dimensions (the pixels are the platform's
//! to draw, and only after this gate has read the header and refused
//! decompression bombs); or a named reason there is no preview. Any malformed
//! input lands in the last case. There is no path that returns "best effort".
//!
//! The budget is a constant the caller passes by reference; the wasm module
//! uses [`BUDGET`] and exposes no way to pass another, so a page cannot loosen
//! the bound it is held to.

use alloc::string::String;

use crate::id::ObjectId;
use crate::name::is_bidi_control;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Budget {
    /// The largest object hashed and previewed at all.
    pub max_input: usize,
    /// The most of a text object examined (its first bytes).
    pub text_window: usize,
    /// The most UTF-8 bytes of excerpt returned.
    pub max_text_bytes: usize,
    /// The most lines of excerpt returned.
    pub max_text_lines: u32,
    /// The most pixels an image header may declare (Strata's helper caps
    /// source frames at 50 million; the same figure is used here).
    pub max_pixels: u64,
    /// The longest side an image header may declare.
    pub max_side: u32,
}

pub const BUDGET: Budget = Budget {
    max_input: 32 * 1024 * 1024,
    text_window: 1024 * 1024,
    max_text_bytes: 64 * 1024,
    max_text_lines: 2_000,
    max_pixels: 50_000_000,
    max_side: 30_000,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ImageFormat {
    Png,
    Jpeg,
    Gif,
    Webp,
}

impl ImageFormat {
    /// The type the platform is told to decode as — from the sniff, never
    /// from the name.
    pub const fn mime(self) -> &'static str {
        match self {
            ImageFormat::Png => "image/png",
            ImageFormat::Jpeg => "image/jpeg",
            ImageFormat::Gif => "image/gif",
            ImageFormat::Webp => "image/webp",
        }
    }

    pub const fn wire(self) -> u8 {
        match self {
            ImageFormat::Png => 1,
            ImageFormat::Jpeg => 2,
            ImageFormat::Gif => 3,
            ImageFormat::Webp => 4,
        }
    }
}

/// Kinds this preview recognises and deliberately does not draw.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Other {
    Pdf,
    /// Audio or video (MP4/MOV/M4A, WebM/MKV, Ogg, MP3, FLAC, WAV/AVI).
    Media,
    /// ZIP, gzip, 7z, RAR, tar.
    Archive,
    /// An image container this gate does not read (HEIC, AVIF).
    Image,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Unavailable {
    /// Over [`Budget::max_input`]; not hashed.
    TooLarge,
    /// The bytes are not the ones listed.
    IdentityChanged,
    /// Zero bytes.
    Empty,
    /// The format's own structure is broken (truncated, bad checksum,
    /// impossible header).
    Malformed(Option<ImageFormat>),
    /// A well-formed image that declares more than the budget.
    TooManyPixels(ImageFormat),
    /// Not an image, not UTF-8 text.
    Binary,
    Unsupported(Other),
}

impl Unavailable {
    pub const fn wire(self) -> (u8, u8) {
        match self {
            Unavailable::TooLarge => (1, 0),
            Unavailable::IdentityChanged => (2, 0),
            Unavailable::Empty => (3, 0),
            Unavailable::Malformed(f) => (
                4,
                match f {
                    Some(f) => f.wire(),
                    None => 0,
                },
            ),
            Unavailable::TooManyPixels(f) => (5, f.wire()),
            Unavailable::Binary => (6, 0),
            Unavailable::Unsupported(o) => (
                7,
                match o {
                    Other::Pdf => 1,
                    Other::Media => 2,
                    Other::Archive => 3,
                    Other::Image => 4,
                },
            ),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TextPreview {
    /// Sanitised: controls other than tab and newline, and bidirectional
    /// reordering controls, are each replaced by U+FFFD; CRLF and lone CR
    /// become LF. Safe to place as text, never as markup.
    pub text: String,
    /// The excerpt stops before the end of the object.
    pub truncated: bool,
    pub lines: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Preview {
    Text(TextPreview),
    Image {
        format: ImageFormat,
        width: u32,
        height: u32,
    },
    Unavailable(Unavailable),
}

/// Preview `bytes`, which must be the object `expected` names.
pub fn preview(expected: &ObjectId, bytes: &[u8], budget: &Budget) -> Preview {
    if bytes.len() > budget.max_input {
        return Preview::Unavailable(Unavailable::TooLarge);
    }
    if !expected.matches(bytes) {
        return Preview::Unavailable(Unavailable::IdentityChanged);
    }
    if bytes.is_empty() {
        return Preview::Unavailable(Unavailable::Empty);
    }
    let r = match sniff(bytes) {
        Sniff::Png => png(bytes),
        Sniff::Jpeg => jpeg(bytes),
        Sniff::Gif => gif(bytes),
        Sniff::Webp => webp(bytes),
        Sniff::Other(o) => return Preview::Unavailable(Unavailable::Unsupported(o)),
        Sniff::Unknown => return text(bytes, budget),
    };
    match r {
        Err(f) => Preview::Unavailable(Unavailable::Malformed(Some(f))),
        Ok((format, width, height)) => {
            if width > budget.max_side
                || height > budget.max_side
                || width as u64 * height as u64 > budget.max_pixels
            {
                Preview::Unavailable(Unavailable::TooManyPixels(format))
            } else {
                Preview::Image {
                    format,
                    width,
                    height,
                }
            }
        }
    }
}

enum Sniff {
    Png,
    Jpeg,
    Gif,
    Webp,
    Other(Other),
    Unknown,
}

fn at(b: &[u8], off: usize, magic: &[u8]) -> bool {
    b.len() >= off + magic.len() && &b[off..off + magic.len()] == magic
}

fn sniff(b: &[u8]) -> Sniff {
    if at(b, 0, b"\x89PNG\r\n\x1a\n") {
        return Sniff::Png;
    }
    if at(b, 0, &[0xFF, 0xD8, 0xFF]) {
        return Sniff::Jpeg;
    }
    if at(b, 0, b"GIF87a") || at(b, 0, b"GIF89a") {
        return Sniff::Gif;
    }
    if at(b, 0, b"RIFF") && at(b, 8, b"WEBP") {
        return Sniff::Webp;
    }
    if at(b, 0, b"%PDF-") {
        return Sniff::Other(Other::Pdf);
    }
    if at(b, 4, b"ftyp") {
        for brand in [b"avif", b"avis", b"heic", b"heix", b"mif1", b"msf1"] {
            if at(b, 8, brand) {
                return Sniff::Other(Other::Image);
            }
        }
        return Sniff::Other(Other::Media);
    }
    if at(b, 0, &[0x1A, 0x45, 0xDF, 0xA3])
        || at(b, 0, b"OggS")
        || at(b, 0, b"ID3")
        || at(b, 0, b"fLaC")
        || (at(b, 0, b"RIFF") && (at(b, 8, b"WAVE") || at(b, 8, b"AVI ")))
    {
        return Sniff::Other(Other::Media);
    }
    // an MPEG audio frame sync: 0xFF never occurs in UTF-8, so no text is
    // mistaken for it
    if b.len() >= 2 && b[0] == 0xFF && b[1] & 0xE0 == 0xE0 {
        return Sniff::Other(Other::Media);
    }
    if at(b, 0, b"PK\x03\x04")
        || at(b, 0, &[0x1F, 0x8B])
        || at(b, 0, &[b'7', b'z', 0xBC, 0xAF, 0x27, 0x1C])
        || at(b, 0, b"Rar!\x1a\x07")
        || at(b, 257, b"ustar")
    {
        return Sniff::Other(Other::Archive);
    }
    Sniff::Unknown
}

fn be16(b: &[u8], i: usize) -> u32 {
    u16::from_be_bytes([b[i], b[i + 1]]) as u32
}
fn be32(b: &[u8], i: usize) -> u32 {
    u32::from_be_bytes([b[i], b[i + 1], b[i + 2], b[i + 3]])
}
fn le16(b: &[u8], i: usize) -> u32 {
    u16::from_le_bytes([b[i], b[i + 1]]) as u32
}
fn le24(b: &[u8], i: usize) -> u32 {
    b[i] as u32 | (b[i + 1] as u32) << 8 | (b[i + 2] as u32) << 16
}
fn le32(b: &[u8], i: usize) -> u32 {
    u32::from_le_bytes([b[i], b[i + 1], b[i + 2], b[i + 3]])
}

type Dims = Result<(ImageFormat, u32, u32), ImageFormat>;

fn dims(f: ImageFormat, w: u32, h: u32) -> Dims {
    if w == 0 || h == 0 {
        Err(f)
    } else {
        Ok((f, w, h))
    }
}

/// CRC-32 (ISO-HDLC, the PNG polynomial), table built at compile time.
const CRC_TABLE: [u32; 256] = {
    let mut t = [0u32; 256];
    let mut n = 0;
    while n < 256 {
        let mut c = n as u32;
        let mut k = 0;
        while k < 8 {
            c = if c & 1 != 0 {
                0xEDB8_8320 ^ (c >> 1)
            } else {
                c >> 1
            };
            k += 1;
        }
        t[n] = c;
        n += 1;
    }
    t
};

fn crc32(parts: &[&[u8]]) -> u32 {
    let mut c = 0xFFFF_FFFFu32;
    for part in parts {
        for &byte in *part {
            c = CRC_TABLE[((c ^ byte as u32) & 0xFF) as usize] ^ (c >> 8);
        }
    }
    c ^ 0xFFFF_FFFF
}

/// A PNG must be a well-formed chunk stream end to end: IHDR first with a
/// legal depth/colour pair, every chunk's CRC right, at least one IDAT, and
/// IEND as the very last bytes.
fn png(b: &[u8]) -> Dims {
    let f = ImageFormat::Png;
    let mut p = 8;
    let mut header: Option<(u32, u32)> = None;
    let mut saw_idat = false;
    loop {
        if b.len() - p < 12 {
            return Err(f);
        }
        let len = be32(b, p) as usize;
        if len > b.len() - p - 12 {
            return Err(f);
        }
        let ty = &b[p + 4..p + 8];
        let data = &b[p + 8..p + 8 + len];
        if crc32(&[ty, data]) != be32(b, p + 8 + len) {
            return Err(f);
        }
        match (header, ty) {
            (None, b"IHDR") if len == 13 => {
                let (w, h) = (be32(data, 0), be32(data, 4));
                let (depth, colour) = (data[8], data[9]);
                let legal = match colour {
                    0 => matches!(depth, 1 | 2 | 4 | 8 | 16),
                    3 => matches!(depth, 1 | 2 | 4 | 8),
                    2 | 4 | 6 => matches!(depth, 8 | 16),
                    _ => false,
                };
                if !legal || data[10] != 0 || data[11] != 0 || data[12] > 1 {
                    return Err(f);
                }
                if w > i32::MAX as u32 || h > i32::MAX as u32 {
                    return Err(f);
                }
                header = Some((w, h));
            }
            (None, _) | (Some(_), b"IHDR") => return Err(f),
            (Some(_), b"IDAT") => saw_idat = true,
            _ => {}
        }
        p += 12 + len;
        if ty == b"IEND" {
            if len != 0 || p != b.len() || !saw_idat {
                return Err(f);
            }
            let (w, h) = header.ok_or(f)?;
            return dims(f, w, h);
        }
    }
}

fn is_sof(m: u8) -> bool {
    matches!(m, 0xC0..=0xC3 | 0xC5..=0xC7 | 0xC9..=0xCB | 0xCD..=0xCF)
}

/// A JPEG must reach a frame header through well-formed segments, and an
/// end-of-image marker must follow it. Bytes after that marker are allowed
/// (motion photos append a video there).
fn jpeg(b: &[u8]) -> Dims {
    let f = ImageFormat::Jpeg;
    let mut p = 2;
    loop {
        if p >= b.len() || b[p] != 0xFF {
            return Err(f);
        }
        while p < b.len() && b[p] == 0xFF {
            p += 1;
        }
        if p >= b.len() {
            return Err(f);
        }
        let m = b[p];
        p += 1;
        match m {
            0x01 | 0xD0..=0xD7 => continue,
            0x00 | 0xD8 | 0xD9 | 0xDA => return Err(f),
            _ => {}
        }
        if b.len() - p < 2 {
            return Err(f);
        }
        let seg = be16(b, p) as usize;
        if seg < 2 || seg > b.len() - p {
            return Err(f);
        }
        if is_sof(m) {
            if seg < 8 {
                return Err(f);
            }
            let (h, w, components) = (be16(b, p + 3), be16(b, p + 5), b[p + 7] as usize);
            if components == 0 || seg != 8 + 3 * components {
                return Err(f);
            }
            let after = &b[p + seg..];
            if !after.windows(2).any(|w| w == [0xFF, 0xD9]) {
                return Err(f);
            }
            return dims(f, w, h);
        }
        p += seg;
    }
}

fn gif(b: &[u8]) -> Dims {
    let f = ImageFormat::Gif;
    if b.len() < 14 || b[b.len() - 1] != 0x3B {
        return Err(f);
    }
    dims(f, le16(b, 6), le16(b, 8))
}

fn webp(b: &[u8]) -> Dims {
    let f = ImageFormat::Webp;
    if b.len() < 20 || le32(b, 4) as usize != b.len() - 8 {
        return Err(f);
    }
    let size = le32(b, 16) as usize;
    if size > b.len() - 20 {
        return Err(f);
    }
    let data = &b[20..20 + size];
    match &b[12..16] {
        b"VP8 " => {
            if data.len() < 10 || data[0] & 1 != 0 || data[3..6] != [0x9D, 0x01, 0x2A] {
                return Err(f);
            }
            dims(f, le16(data, 6) & 0x3FFF, le16(data, 8) & 0x3FFF)
        }
        b"VP8L" => {
            if data.len() < 5 || data[0] != 0x2F {
                return Err(f);
            }
            let bits = le32(data, 1);
            if bits >> 29 != 0 {
                return Err(f);
            }
            dims(f, (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
        }
        b"VP8X" => {
            if data.len() < 10 {
                return Err(f);
            }
            dims(f, le24(data, 4) + 1, le24(data, 7) + 1)
        }
        _ => Err(f),
    }
}

/// UTF-8 text, judged on its first [`Budget::text_window`] bytes.
fn text(b: &[u8], budget: &Budget) -> Preview {
    let window = &b[..b.len().min(budget.text_window)];
    let cut = window.len() < b.len();
    let s = match core::str::from_utf8(window) {
        Ok(s) => s,
        // the window ended inside a character; that is our cut, not the
        // file's fault
        Err(e) if cut && e.error_len().is_none() => {
            match core::str::from_utf8(&window[..e.valid_up_to()]) {
                Ok(s) => s,
                Err(_) => return Preview::Unavailable(Unavailable::Binary),
            }
        }
        Err(_) => return Preview::Unavailable(Unavailable::Binary),
    };
    let mut total = 0usize;
    let mut controls = 0usize;
    for c in s.chars() {
        total += 1;
        if c == '\0' {
            return Preview::Unavailable(Unavailable::Binary);
        }
        if c.is_control() && !matches!(c, '\n' | '\r' | '\t' | '\x0C') {
            controls += 1;
        }
    }
    if controls * 8 > total {
        return Preview::Unavailable(Unavailable::Binary);
    }
    // The whole budget up front: a growing String frees each outgrown buffer
    // with plaintext still in it, and only the final one can be zeroed
    // (wire::handle does). Measured: 181 canary copies survived without this.
    let mut out = String::with_capacity(budget.max_text_bytes);
    let mut lines = 0u32;
    let mut truncated = cut;
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        let c = match c {
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                '\n'
            }
            '\n' | '\t' => c,
            c if c.is_control() || is_bidi_control(c) => '\u{FFFD}',
            c => c,
        };
        if out.len() + c.len_utf8() > budget.max_text_bytes {
            truncated = true;
            break;
        }
        out.push(c);
        if c == '\n' {
            lines += 1;
            if lines >= budget.max_text_lines {
                truncated = truncated || chars.peek().is_some();
                break;
            }
        }
    }
    if !out.is_empty() && !out.ends_with('\n') {
        lines += 1;
    }
    Preview::Text(TextPreview {
        text: out,
        truncated,
        lines,
    })
}

#[cfg(test)]
pub(crate) mod fixtures {
    //! Minimal, structurally valid images built in-test (no binary files in
    //! the tree), so every malformation test starts from a known-good input.
    use super::crc32;
    use alloc::vec::Vec;

    fn chunk(out: &mut Vec<u8>, ty: &[u8; 4], data: &[u8]) {
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        out.extend_from_slice(ty);
        out.extend_from_slice(data);
        out.extend_from_slice(&crc32(&[ty, data]).to_be_bytes());
    }

    pub fn png(w: u32, h: u32) -> Vec<u8> {
        let mut out = b"\x89PNG\r\n\x1a\n".to_vec();
        let mut ihdr = Vec::new();
        ihdr.extend_from_slice(&w.to_be_bytes());
        ihdr.extend_from_slice(&h.to_be_bytes());
        ihdr.extend_from_slice(&[8, 6, 0, 0, 0]);
        chunk(&mut out, b"IHDR", &ihdr);
        // a real zlib stream (one stored block, one 1-pixel scanline); the
        // gate never inflates IDAT, so it need not match the header
        chunk(
            &mut out,
            b"IDAT",
            &[
                0x78, 0x01, 0x01, 0x05, 0x00, 0xFA, 0xFF, 0, 0, 0, 0, 0, 0, 5, 0, 1,
            ],
        );
        chunk(&mut out, b"IEND", &[]);
        out
    }

    pub fn jpeg(w: u16, h: u16) -> Vec<u8> {
        let mut out = alloc::vec![0xFF, 0xD8];
        // APP0 "JFIF"
        out.extend_from_slice(&[0xFF, 0xE0, 0x00, 0x10]);
        out.extend_from_slice(b"JFIF\0\x01\x01\0\0\x01\0\x01\0\0");
        // SOF0, one component
        out.extend_from_slice(&[0xFF, 0xC0, 0x00, 0x0B, 8]);
        out.extend_from_slice(&h.to_be_bytes());
        out.extend_from_slice(&w.to_be_bytes());
        out.extend_from_slice(&[1, 1, 0x11, 0]);
        // SOS, a scan byte, EOI
        out.extend_from_slice(&[
            0xFF, 0xDA, 0x00, 0x08, 1, 1, 0, 0, 0x3F, 0, 0x55, 0xFF, 0xD9,
        ]);
        out
    }

    pub fn gif(w: u16, h: u16) -> Vec<u8> {
        let mut out = b"GIF89a".to_vec();
        out.extend_from_slice(&w.to_le_bytes());
        out.extend_from_slice(&h.to_le_bytes());
        out.extend_from_slice(&[0, 0, 0, 0x3B]);
        out
    }

    pub fn webp_lossless(w: u32, h: u32) -> Vec<u8> {
        let bits = (w - 1) | (h - 1) << 14;
        let mut data = alloc::vec![0x2F];
        data.extend_from_slice(&bits.to_le_bytes());
        data.push(0);
        let mut out = b"RIFF".to_vec();
        out.extend_from_slice(&((4 + 8 + data.len()) as u32).to_le_bytes());
        out.extend_from_slice(b"WEBPVP8L");
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(&data);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::fixtures::{gif, jpeg, png, webp_lossless};
    use super::*;
    use crate::id::HashAlg;
    use alloc::vec::Vec;

    fn id(b: &[u8]) -> ObjectId {
        ObjectId::of(HashAlg::Sha256, b)
    }
    fn pv(b: &[u8]) -> Preview {
        preview(&id(b), b, &BUDGET)
    }

    #[test]
    fn the_four_image_formats_read_their_true_dimensions() {
        let cases: [(Vec<u8>, ImageFormat, u32, u32); 4] = [
            (png(640, 480), ImageFormat::Png, 640, 480),
            (jpeg(1920, 1080), ImageFormat::Jpeg, 1920, 1080),
            (gif(3, 7), ImageFormat::Gif, 3, 7),
            (webp_lossless(300, 200), ImageFormat::Webp, 300, 200),
        ];
        for (b, format, width, height) in cases {
            assert_eq!(
                pv(&b),
                Preview::Image {
                    format,
                    width,
                    height
                }
            );
        }
    }

    #[test]
    fn identity_is_checked_before_any_byte_is_interpreted() {
        let real = png(10, 10);
        let other = jpeg(10, 10);
        // the listing promised `real`; the rail returned `other`
        assert_eq!(
            preview(&id(&real), &other, &BUDGET),
            Preview::Unavailable(Unavailable::IdentityChanged)
        );
        // a malformed body under the wrong id says identity, not malformed:
        // nothing was parsed
        assert_eq!(
            preview(&id(&real), b"\x89PNG\r\n\x1a\nbroken", &BUDGET),
            Preview::Unavailable(Unavailable::IdentityChanged)
        );
    }

    #[test]
    fn size_is_checked_before_identity() {
        let tight = Budget {
            max_input: 4,
            ..BUDGET
        };
        // wrong id AND too large: refused for size, never hashed
        assert_eq!(
            preview(&id(b"x"), b"12345", &tight),
            Preview::Unavailable(Unavailable::TooLarge)
        );
        assert!(matches!(
            preview(&id(b"1234"), b"1234", &tight),
            Preview::Text(_)
        ));
    }

    #[test]
    fn every_png_malformation_is_refused() {
        let good = png(4, 4);
        let bad_crc = {
            let mut b = good.clone();
            b[29] ^= 1; // inside the IHDR CRC
            b
        };
        let truncated = good[..good.len() - 1].to_vec();
        let trailing = {
            let mut b = good.clone();
            b.push(0);
            b
        };
        let no_idat = {
            let mut b = good[..33].to_vec(); // signature + IHDR
            b.extend_from_slice(&good[good.len() - 12..]); // IEND
            b
        };
        let huge_len = {
            let mut b = good.clone();
            b[8..12].copy_from_slice(&u32::MAX.to_be_bytes());
            b
        };
        let bad_depth = {
            // 16-bit palette is illegal; rebuild so the CRC is right
            let mut ihdr = Vec::new();
            ihdr.extend_from_slice(&4u32.to_be_bytes());
            ihdr.extend_from_slice(&4u32.to_be_bytes());
            ihdr.extend_from_slice(&[16, 3, 0, 0, 0]);
            let mut b = good.clone();
            b[16..29].copy_from_slice(&ihdr);
            let crc = crc32(&[b"IHDR", &ihdr]).to_be_bytes();
            b[29..33].copy_from_slice(&crc);
            b
        };
        for b in [bad_crc, truncated, trailing, no_idat, huge_len, bad_depth] {
            assert_eq!(
                pv(&b),
                Preview::Unavailable(Unavailable::Malformed(Some(ImageFormat::Png)))
            );
        }
    }

    #[test]
    fn decompression_bombs_are_refused_from_the_header() {
        assert_eq!(
            pv(&png(20_000, 20_000)),
            Preview::Unavailable(Unavailable::TooManyPixels(ImageFormat::Png))
        );
        assert_eq!(
            pv(&png(30_001, 1)),
            Preview::Unavailable(Unavailable::TooManyPixels(ImageFormat::Png))
        );
        assert_eq!(
            pv(&webp_lossless(16_384, 16_384)),
            Preview::Unavailable(Unavailable::TooManyPixels(ImageFormat::Webp))
        );
        assert!(matches!(pv(&png(7_000, 7_000)), Preview::Image { .. }));
    }

    #[test]
    fn jpeg_gif_webp_malformations_are_refused() {
        let mjpeg = Preview::Unavailable(Unavailable::Malformed(Some(ImageFormat::Jpeg)));
        let good = jpeg(8, 8);
        assert_eq!(pv(&good[..good.len() - 2]), mjpeg, "no end-of-image");
        assert_eq!(pv(&jpeg(0, 8)), mjpeg, "zero width");
        let mut lying = good.clone();
        lying[4..6].copy_from_slice(&0xFFFFu16.to_be_bytes()); // APP0 length past the end
        assert_eq!(pv(&lying), mjpeg);
        assert_eq!(pv(&[0xFF, 0xD8, 0xFF, 0xD9]), mjpeg, "end before any frame");
        // bytes after the end marker are a motion photo's video, not damage
        let mut motion = good.clone();
        motion.extend_from_slice(b"....ftypmp42");
        assert!(matches!(pv(&motion), Preview::Image { .. }));

        let g = gif(2, 2);
        assert_eq!(
            pv(&g[..g.len() - 1]),
            Preview::Unavailable(Unavailable::Malformed(Some(ImageFormat::Gif)))
        );
        let w = webp_lossless(5, 5);
        let mut short = w.clone();
        short.push(0); // RIFF size no longer matches
        assert_eq!(
            pv(&short),
            Preview::Unavailable(Unavailable::Malformed(Some(ImageFormat::Webp)))
        );
    }

    #[test]
    fn content_decides_not_the_name() {
        // the same bytes are an image whatever the listing called them; the
        // gate never sees a name at all
        assert!(matches!(pv(&gif(1, 1)), Preview::Image { .. }));
        // an SVG is text to be read, never an image to be drawn
        let svg = br#"<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>"#;
        match pv(svg) {
            Preview::Text(t) => assert!(t.text.starts_with("<svg")),
            other => panic!("svg must preview as text, got {other:?}"),
        }
    }

    #[test]
    fn recognised_kinds_are_named_not_drawn() {
        let mut mp4 = alloc::vec![0, 0, 0, 0x18];
        mp4.extend_from_slice(b"ftypisom");
        let mut heic = alloc::vec![0, 0, 0, 0x18];
        heic.extend_from_slice(b"ftypheic");
        let cases: [(&[u8], Other); 6] = [
            (b"%PDF-1.7\n", Other::Pdf),
            (&mp4, Other::Media),
            (&heic, Other::Image),
            (b"PK\x03\x04rest", Other::Archive),
            (&[0x1F, 0x8B, 8, 0], Other::Archive),
            (&[0xFF, 0xFB, 0x90, 0x00], Other::Media),
        ];
        for (b, o) in cases {
            assert_eq!(pv(b), Preview::Unavailable(Unavailable::Unsupported(o)));
        }
    }

    #[test]
    fn text_is_sanitised_bounded_and_counted() {
        let t = |b: &[u8]| match pv(b) {
            Preview::Text(t) => t,
            other => panic!("{other:?}"),
        };
        let x = t(b"one\r\ntwo\rthree\n");
        assert_eq!(
            (x.text.as_str(), x.lines, x.truncated),
            ("one\ntwo\nthree\n", 3, false)
        );
        let x = t("a\u{1b}[31mred\u{202E}b".as_bytes());
        assert_eq!(x.text, "a\u{FFFD}[31mred\u{FFFD}b");
        assert_eq!(x.lines, 1);

        let long = "x\n".repeat(5_000);
        let x = t(long.as_bytes());
        assert_eq!(x.lines, BUDGET.max_text_lines);
        assert!(x.truncated);

        let wide = "ā".repeat(40_000); // 80,000 bytes
        let x = t(wide.as_bytes());
        assert!(x.truncated && x.text.len() <= BUDGET.max_text_bytes);
        assert!(x.text.chars().all(|c| c == 'ā'));
    }

    #[test]
    fn the_window_may_cut_a_character_but_the_file_may_not_end_in_one() {
        let small = Budget {
            text_window: 4,
            ..BUDGET
        };
        // "aāā" = 1 + 2 + 2 bytes; a 4-byte window ends inside the last ā
        match preview(&id("aāā".as_bytes()), "aāā".as_bytes(), &small) {
            Preview::Text(t) => assert_eq!((t.text.as_str(), t.truncated), ("aā", true)),
            other => panic!("{other:?}"),
        }
        // a whole file ending mid-character is not text
        let broken = &"aā".as_bytes()[..2];
        assert_eq!(pv(broken), Preview::Unavailable(Unavailable::Binary));
    }

    #[test]
    fn binary_is_named_binary() {
        assert_eq!(pv(b"ab\0cd"), Preview::Unavailable(Unavailable::Binary));
        assert_eq!(pv(&[0xC3, 0x28]), Preview::Unavailable(Unavailable::Binary));
        assert_eq!(
            pv(&[1, 2, 3, 4, b'a']),
            Preview::Unavailable(Unavailable::Binary)
        );
        assert_eq!(pv(b""), Preview::Unavailable(Unavailable::Empty));
    }

    #[test]
    fn the_crc_table_is_the_published_polynomial() {
        // "123456789" -> 0xCBF43926, the CRC-32/ISO-HDLC check value
        assert_eq!(crc32(&[b"123456789"]), 0xCBF4_3926);
        assert_eq!(crc32(&[b"1234", b"56789"]), 0xCBF4_3926);
    }
}
