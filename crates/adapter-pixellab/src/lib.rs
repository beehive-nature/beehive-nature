//! adapter-pixellab — MCP server bridging the Studio art contract to PixelLab.
//!
//! Contract with the rest of the Studio — the whole interface, deliberately small:
//! `prompt + style anchor + layer name -> PNG with alpha`.
//! The adapter must not know what a trait is, and the Studio must not know
//! which generator produced a PNG.
//!
//! Deployment constraints (from reading `buzz-agent/src/mcp.rs`, 2026-08-16):
//! - MCP children get a scrubbed environment; `${VAR}` interpolation does not
//!   happen. The key arrives via `--key-file`, never inheritance.
//! - `MAX_SCHEMA_BYTES 4096`: oversize tool schemas are silently replaced with
//!   `{}`. Every schema here is tested to serialize under that budget.
//! - One MCP command per agent: the tool surface is exactly the art lane.
//! - `RawContent::Resource` flattens to `[resource elided]`: the adapter
//!   writes the PNG itself and returns a text handle (path + metadata).

pub mod mcp;
pub mod pixellab;
pub mod storage;
pub mod tools;

use std::path::Path;

#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Directory the adapter writes generated PNGs into (text handles point here).
    pub out_dir: std::path::PathBuf,
    /// Hard cap on cumulative measured spend this session, in USD credits.
    /// `None` = uncapped (not recommended; the founder's balance is real money).
    pub max_spend_usd: Option<f64>,
}

/// Read the API key from a file. Strips BOM, CR, and surrounding whitespace.
///
/// The bnr_key lesson (2026-08-16): Windows-authored credential files carry
/// CRLF, and parsers choke on the carriage returns while the header looks
/// perfectly valid. Strip them here, on a copy in memory, never in place.
pub fn load_key(path: &Path) -> Result<String, String> {
    let raw =
        std::fs::read_to_string(path).map_err(|e| format!("key file {}: {e}", path.display()))?;
    let stripped = raw.trim_start_matches('\u{feff}').replace('\r', "");
    let key = stripped.trim();
    if key.is_empty() {
        Err(format!("key file {} is empty", path.display()))
    } else {
        Ok(key.to_string())
    }
}

/// Serve the MCP protocol on the given byte streams. Generic over the
/// transport so tests run the full protocol loop against mocks, offline.
pub async fn run_server<T, R, W>(
    transport: std::sync::Arc<T>,
    config: std::sync::Arc<ServerConfig>,
    stdin: R,
    stdout: W,
) -> Result<(), String>
where
    T: pixellab::Transport,
    R: tokio::io::AsyncRead + Unpin,
    W: tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    mcp::serve(transport, config, stdin, stdout).await
}
