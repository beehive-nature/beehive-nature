//! Output storage. Blob-by-reference is dead (`RawContent::Resource` flattens
//! to `[resource elided]`), so the adapter writes the PNG itself and hands
//! back a text handle: an absolute path plus metadata.

use std::io;
use std::path::{Path, PathBuf};

/// A valid PNG starts with these 8 bytes. Anything else is not written to
/// disk under our name.
pub const PNG_MAGIC: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];

pub fn assert_png(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() >= 8 && bytes[..8] == PNG_MAGIC {
        Ok(())
    } else {
        Err("not a PNG (bad magic bytes)".into())
    }
}

/// Sanitize a layer label into a filesystem-safe filename component. The
/// adapter attaches no meaning to it — it is opaque metadata that becomes a
/// readable filename.
pub fn sanitize_layer(name: Option<&str>) -> String {
    let base = name
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("sprite");
    let mut s: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    s.truncate(64);
    if s.is_empty() {
        s = "sprite".into();
    }
    s
}

pub fn write_png(out_dir: &Path, layer: &str, counter: u64, png: &[u8]) -> io::Result<PathBuf> {
    std::fs::create_dir_all(out_dir)?;
    let path = out_dir.join(format!("{layer}_{counter:04}.png"));
    std::fs::write(&path, png)?;
    Ok(path)
}
