//! adapter-pixellab — MCP stdio server. Spawned by buzz via
//! `ServerSpec { command, args, ... }`. Args are literals (env is scrubbed
//! and `${VAR}` interpolation does not happen), so configuration arrives
//! only here.

use std::path::PathBuf;
use std::process::exit;
use std::sync::Arc;

struct Args {
    key_file: String,
    out_dir: String,
    max_spend: Option<f64>,
    base_url: String,
}

fn parse_args() -> Result<Args, String> {
    let mut a = Args {
        key_file: String::new(),
        out_dir: String::new(),
        max_spend: None,
        base_url: "https://api.pixellab.ai/v1".into(),
    };
    let mut it = std::env::args().skip(1);
    while let Some(flag) = it.next() {
        let val = it.next().ok_or_else(|| format!("flag {flag} needs a value"))?;
        match flag.as_str() {
            "--key-file" => a.key_file = val,
            "--out-dir" => a.out_dir = val,
            "--max-spend" => {
                a.max_spend = Some(
                    val.parse::<f64>().map_err(|_| format!("--max-spend: not a number: {val}"))?,
                )
            }
            "--base-url" => a.base_url = val,
            _ => return Err(format!("unknown flag {flag}")),
        }
    }
    if a.key_file.is_empty() {
        return Err("--key-file is required".into());
    }
    if a.out_dir.is_empty() {
        return Err("--out-dir is required".into());
    }
    // A spend cap is REQUIRED, not optional. This adapter is driven by an autonomous agent
    // against a balance that is real money, and cost-per-call is not declared anywhere in
    // PixelLab's OpenAPI — it can only be measured after the fact. An uncapped default is
    // therefore a runaway with no brake. Refuse to start rather than start unbounded.
    match a.max_spend {
        None => return Err(
            "--max-spend <usd> is required.\n\n  \
             This adapter spends real credits autonomously, and PixelLab does not declare \
             cost-per-call\n  anywhere in its schema — spend is only measurable as a \
             balance delta AFTER the fact.\n  Starting uncapped means there is no brake. \
             Pick a ceiling you would not mind losing,\n  e.g. --max-spend 2.00".into()),
        Some(v) if !(v > 0.0) || !v.is_finite() => return Err(
            format!("--max-spend must be a positive finite number of USD, got {v}")),
        _ => {}
    }
    Ok(a)
}

#[tokio::main]
async fn main() {
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!(
                "adapter-pixellab: {e}\n\n\
                 usage: adapter-pixellab --key-file <path> --out-dir <path> \
                 --max-spend <usd> [--base-url <url>]"
            );
            exit(2);
        }
    };
    let key = match adapter_pixellab::load_key(PathBuf::from(&args.key_file).as_path()) {
        Ok(k) => k,
        Err(e) => {
            eprintln!("adapter-pixellab: {e}");
            exit(2);
        }
    };
    let transport = Arc::new(adapter_pixellab::pixellab::HttpTransport::new(&args.base_url, key));
    let config = Arc::new(adapter_pixellab::ServerConfig {
        out_dir: PathBuf::from(&args.out_dir),
        max_spend_usd: args.max_spend,
    });
    if let Err(e) =
        adapter_pixellab::run_server(transport, config, tokio::io::stdin(), tokio::io::stdout()).await
    {
        eprintln!("adapter-pixellab: {e}");
        exit(1);
    }
}
