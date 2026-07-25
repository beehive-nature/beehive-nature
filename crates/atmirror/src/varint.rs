//! Unsigned LEB128 varints — the length prefixes of CARv1 sections and the
//! multicodec prefixes inside CIDs. Strict: bounded length, no overlong
//! encodings accepted beyond u64 range.

/// Read one unsigned varint from `buf` starting at `*pos`, advancing `*pos`.
/// Errors on truncation or a value exceeding u64.
pub fn read(buf: &[u8], pos: &mut usize) -> Result<u64, VarintError> {
    let mut value: u64 = 0;
    let mut shift: u32 = 0;
    loop {
        let byte = *buf.get(*pos).ok_or(VarintError::Truncated)?;
        *pos += 1;
        if shift == 63 && byte > 1 {
            return Err(VarintError::Overflow);
        }
        value |= u64::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            return Ok(value);
        }
        shift += 7;
        if shift > 63 {
            return Err(VarintError::Overflow);
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VarintError {
    Truncated,
    Overflow,
}

impl std::fmt::Display for VarintError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VarintError::Truncated => write!(f, "varint truncated"),
            VarintError::Overflow => write!(f, "varint exceeds u64"),
        }
    }
}

impl std::error::Error for VarintError {}

#[cfg(test)]
mod tests {
    use super::*;

    fn rt(v: u64) {
        // Encode by hand (test-only) and read back.
        let mut buf = Vec::new();
        let mut x = v;
        loop {
            let mut b = (x & 0x7f) as u8;
            x >>= 7;
            if x != 0 {
                b |= 0x80;
            }
            buf.push(b);
            if x == 0 {
                break;
            }
        }
        let mut pos = 0;
        assert_eq!(read(&buf, &mut pos), Ok(v));
        assert_eq!(pos, buf.len());
    }

    #[test]
    fn round_trips() {
        for v in [0, 1, 127, 128, 300, 0x1200, 0xe7, u32::MAX as u64, u64::MAX] {
            rt(v);
        }
    }

    #[test]
    fn truncated_is_error() {
        let mut pos = 0;
        assert_eq!(read(&[0x80], &mut pos), Err(VarintError::Truncated));
    }

    #[test]
    fn overflow_is_error() {
        // 10 continuation bytes push past 64 bits.
        let buf = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x02];
        let mut pos = 0;
        assert_eq!(read(&buf, &mut pos), Err(VarintError::Overflow));
    }
}
